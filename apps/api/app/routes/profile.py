from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.calculate_current_user_active_plants import (
    DIFFICULTY_SLOT_COUNT,
    _current_week_start_iso,
    calculate_and_assign_user_active_plants,
)
from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/profile", tags=["profile"])

VALID_DIFFICULTIES = set(DIFFICULTY_SLOT_COUNT.keys())


class ProfileUpdateRequest(BaseModel):
    difficulty_level: str


@router.get("/")
async def get_profile(request: Request):
    user_id = request.state.user_id
    supabase = get_supabase_client()

    resp = (
        supabase
        .from_("profiles")
        .select("id, difficulty_level, is_guest_user")
        .eq("id", user_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return resp.data[0]


@router.patch("/")
async def update_profile(request: Request, body: ProfileUpdateRequest):
    user_id = request.state.user_id

    if body.difficulty_level not in VALID_DIFFICULTIES:
        raise HTTPException(status_code=400, detail="Invalid difficulty level")

    supabase = get_supabase_client()
    resp = (
        supabase
        .from_("profiles")
        .update({"difficulty_level": body.difficulty_level})
        .eq("id", user_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Resize the active list to match the new level. The home list holds the
    # REMAINING plants for the week, i.e. (daily amount × 7) minus what's already
    # been consumed this week — so prior progress is preserved across a level change.
    new_weekly_count = DIFFICULTY_SLOT_COUNT[body.difficulty_level] * 7
    consumed_resp = (
        supabase
        .from_("food_rotation_history")
        .select("id", count="exact")
        .eq("profiles_id", user_id)
        .eq("leave_reason", "consumed")
        .gte("removed_from_pantry_at", _current_week_start_iso())
        .execute()
    )
    consumed_this_week = consumed_resp.count or 0
    target = max(0, new_weekly_count - consumed_this_week)

    count_resp = (
        supabase
        .from_("user_active_plants")
        .select("id", count="exact")
        .eq("profiles_id", user_id)
        .execute()
    )
    current_count = count_resp.count or 0

    if current_count < target:
        # Increasing: top up with fresh suggestions.
        calculate_and_assign_user_active_plants(user_id, count=target - current_count)
    elif current_count > target:
        # Decreasing: trim the newest PENDING suggestions only — never remove a
        # plant the user has bought (so the list may stay above target if they've
        # bought more than the new level needs).
        to_remove = current_count - target
        pending = (
            supabase
            .from_("user_active_plants")
            .select("id")
            .eq("profiles_id", user_id)
            .eq("status", "pending")
            .order("position_index", desc=True)
            .limit(to_remove)
            .execute()
        ).data or []
        ids = [row["id"] for row in pending]
        if ids:
            supabase.from_("user_active_plants").delete().in_("id", ids).execute()

    return resp.data[0]
