from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Request

from app.services.calculate_current_user_active_plants import calculate_and_assign_user_active_plants
from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/user-active-plants", tags=["user_active_plants"])


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


@router.get("/")
async def get_user_active_plants(request: Request):
    user_id = request.state.user_id
    supabase = get_supabase_client()

    plants = _fetch_active_plants(supabase, user_id)

    if not plants:
        calculate_and_assign_user_active_plants(user_id)
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

    new_plant = _calculate_and_return_new_plant(supabase, user_id)
    return {"success": True, "new_plant": new_plant}


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

    new_plant = _calculate_and_return_new_plant(supabase, user_id)
    return {"success": True, "new_plant": new_plant}
