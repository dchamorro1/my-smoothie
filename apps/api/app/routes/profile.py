from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.calculate_current_user_active_plants import (
    DIFFICULTY_SLOT_COUNT,
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

    # Top up active plants if the new level expects more than are currently shown
    new_slot_count = DIFFICULTY_SLOT_COUNT[body.difficulty_level]
    count_resp = (
        supabase
        .from_("user_active_plants")
        .select("id", count="exact")
        .eq("profiles_id", user_id)
        .execute()
    )
    current_count = count_resp.count or 0
    deficit = new_slot_count - current_count
    if deficit > 0:
        calculate_and_assign_user_active_plants(user_id, count=deficit)

    return resp.data[0]
