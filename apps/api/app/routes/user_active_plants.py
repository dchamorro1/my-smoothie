from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from app.services.calculate_current_user_active_plants import (
    DIFFICULTY_SLOT_COUNT,
    _current_week_start_iso,
    calculate_and_assign_user_active_plants,
)
from app.routes.plants import is_plant_selectable
from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/user-active-plants", tags=["user_active_plants"])


class CustomPlantRequest(BaseModel):
    north_american_plant_foods_id: int


def _weekly_count_for(supabase, user_id: str) -> int:
    """The full week's worth of plants to show = daily amount × 7."""
    resp = (
        supabase
        .from_("profiles")
        .select("difficulty_level")
        .eq("id", user_id)
        .execute()
    )
    difficulty = (resp.data[0] if resp.data else {}).get("difficulty_level", "beginner")
    return DIFFICULTY_SLOT_COUNT.get(difficulty, 2) * 7


def _active_plant_count(supabase, user_id: str) -> int:
    resp = (
        supabase
        .from_("user_active_plants")
        .select("id", count="exact")
        .eq("profiles_id", user_id)
        .execute()
    )
    return resp.count or 0


def _fetch_active_plants(supabase, user_id: str) -> list:
    resp = (
        supabase
        .from_("user_active_plants")
        .select("id, status, position_index, north_american_plant_foods(common_name, fiber_quantity)")
        .eq("profiles_id", user_id)
        .order("status")           # "bought" < "pending" alphabetically → bought first
        .order("position_index")
        .execute()
    )
    return resp.data or []


def _set_last_refill(supabase, user_id: str, week_start: str) -> None:
    supabase.from_("profiles").update({"last_weekly_refill": week_start}).eq("id", user_id).execute()


@router.get("/")
async def get_user_active_plants(request: Request):
    user_id = request.state.user_id
    supabase = get_supabase_client()
    week_start = _current_week_start_iso()

    profile = (
        supabase
        .from_("profiles")
        .select("last_weekly_refill")
        .eq("id", user_id)
        .execute()
    )
    last_refill = (profile.data[0] if profile.data else {}).get("last_weekly_refill")

    # Weekly refill — runs once per week (and for brand-new users, whose marker is
    # null). Clears leftover pending suggestions, keeps bought-but-unconsumed
    # plants, and tops up to the weekly goal. We key this off the refill marker,
    # NOT off an empty list: a list emptied by consuming everything this week must
    # stay empty (no re-seed) until the next week.
    if last_refill != week_start:
        supabase.from_("user_active_plants").delete() \
            .eq("profiles_id", user_id).eq("status", "pending").execute()
        deficit = _weekly_count_for(supabase, user_id) - _active_plant_count(supabase, user_id)
        if deficit > 0:
            calculate_and_assign_user_active_plants(user_id, count=deficit)
        _set_last_refill(supabase, user_id, week_start)

    plants = _fetch_active_plants(supabase, user_id)

    return {
        "plants": [
            {
                "id": p["id"],
                "status": p["status"],
                "position_index": p["position_index"],
                "common_name": p["north_american_plant_foods"]["common_name"],
                "fiber_quantity": p["north_american_plant_foods"]["fiber_quantity"],
            }
            for p in plants
        ]
    }


@router.patch("/{plant_id}/buy")
async def buy_plant(plant_id: int, request: Request):
    user_id = request.state.user_id
    supabase = get_supabase_client()

    resp = (
        supabase
        .from_("user_active_plants")
        .update({"status": "bought"})
        .eq("id", plant_id)
        .eq("profiles_id", user_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Plant not found")

    return {"success": True}


@router.delete("/{plant_id}")
async def remove_plant(
    plant_id: int,
    request: Request,
    reason: str = Query(..., pattern="^(consumed|discarded)$"),
):
    user_id = request.state.user_id
    supabase = get_supabase_client()

    plant_resp = (
        supabase
        .from_("user_active_plants")
        .select("id, status, north_american_plant_foods_id, created_at")
        .eq("id", plant_id)
        .eq("profiles_id", user_id)
        .execute()
    )

    if not plant_resp.data:
        raise HTTPException(status_code=404, detail="Plant not found")

    plant = plant_resp.data[0]
    now = datetime.now(timezone.utc).isoformat()

    supabase.from_("food_rotation_history").insert({
        "profiles_id": user_id,
        "north_american_plant_foods_id": plant["north_american_plant_foods_id"],
        "bought_at": plant["created_at"] if plant["status"] == "bought" else None,
        "removed_from_pantry_at": now,
        "leave_reason": reason,
    }).execute()

    supabase.from_("user_active_plants").delete().eq("id", plant_id).eq("profiles_id", user_id).execute()

    # Consuming shrinks the week's list (no replacement). Discarding means the user
    # never got to eat it, so we suggest a replacement.
    new_plant = _maybe_replace(supabase, user_id) if reason == "discarded" else None
    return {"success": True, "new_plant": new_plant}


def _maybe_replace(supabase, user_id: str):
    """Generate a replacement only if the user is below their weekly count.

    Used for skips and discards (a plant the user never got to eat). Manual
    ('add your own') extras can push the list above the weekly count, and we don't
    top those back up — the list settles back to the weekly target as extras leave.
    """
    if _active_plant_count(supabase, user_id) >= _weekly_count_for(supabase, user_id):
        return None
    return _calculate_and_return_new_plant(supabase, user_id)


def _calculate_and_return_new_plant(supabase, user_id: str):
    calculate_and_assign_user_active_plants(user_id, count=1)
    resp = (
        supabase
        .from_("user_active_plants")
        .select("id, status, position_index, north_american_plant_foods(common_name, fiber_quantity)")
        .eq("profiles_id", user_id)
        .eq("status", "pending")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not resp.data:
        return None
    p = resp.data[0]
    return {
        "id": p["id"],
        "status": p["status"],
        "position_index": p["position_index"],
        "common_name": p["north_american_plant_foods"]["common_name"],
        "fiber_quantity": p["north_american_plant_foods"]["fiber_quantity"],
    }


@router.post("/{plant_id}/skip")
async def skip_plant(plant_id: int, request: Request):
    user_id = request.state.user_id
    supabase = get_supabase_client()

    plant_resp = (
        supabase
        .from_("user_active_plants")
        .select("id, north_american_plant_foods_id, created_at")
        .eq("id", plant_id)
        .eq("profiles_id", user_id)
        .eq("status", "pending")
        .execute()
    )

    if not plant_resp.data:
        raise HTTPException(status_code=404, detail="Pending plant not found")

    plant = plant_resp.data[0]
    now = datetime.now(timezone.utc).isoformat()

    supabase.from_("food_skip_tracking").insert({
        "profiles_id": user_id,
        "north_american_plant_foods_id": plant["north_american_plant_foods_id"],
        "proposed_at": plant["created_at"],
        "skipped_at": now,
        "skip_count": 1,
    }).execute()

    supabase.from_("user_active_plants").delete().eq("id", plant_id).eq("profiles_id", user_id).execute()

    new_plant = _maybe_replace(supabase, user_id)
    return {"success": True, "new_plant": new_plant}


@router.post("/custom")
async def add_custom_plant(request: Request, body: CustomPlantRequest):
    """Manually add a plant the user already has. Lands as 'bought' and is allowed
    to push the active list above the weekly count."""
    user_id = request.state.user_id
    supabase = get_supabase_client()
    plant_id = body.north_american_plant_foods_id

    # Re-validate the same constraints the search applies (defense in depth)
    if not is_plant_selectable(supabase, user_id, plant_id):
        raise HTTPException(status_code=400, detail="This plant can't be added right now.")

    active_rows = (
        supabase
        .from_("user_active_plants")
        .select("position_index")
        .eq("profiles_id", user_id)
        .execute()
    ).data or []
    base_index = max((row["position_index"] or 0 for row in active_rows), default=-1) + 1

    insert_resp = (
        supabase
        .from_("user_active_plants")
        .insert({
            "profiles_id": user_id,
            "north_american_plant_foods_id": plant_id,
            "status": "bought",
            "position_index": base_index,
        })
        .execute()
    )
    new_id = insert_resp.data[0]["id"]

    detail = (
        supabase
        .from_("user_active_plants")
        .select("id, status, position_index, north_american_plant_foods(common_name, fiber_quantity)")
        .eq("id", new_id)
        .execute()
    ).data[0]

    return {
        "plant": {
            "id": detail["id"],
            "status": detail["status"],
            "position_index": detail["position_index"],
            "common_name": detail["north_american_plant_foods"]["common_name"],
            "fiber_quantity": detail["north_american_plant_foods"]["fiber_quantity"],
        }
    }
