from fastapi import APIRouter, Query, Request

from app.services.calculate_current_user_active_plants import DIFFICULTY_SLOT_COUNT
from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/calendar")
async def calendar_stats(
    request: Request,
    start: str = Query(...),
    end: str = Query(...),
):
    """Returns consumed-plant timestamps in [start, end] (UTC ISO bounds) plus the
    user's current daily target and weekly goal. The frontend buckets the
    timestamps into local calendar days for the heatmap.
    """
    user_id = request.state.user_id
    supabase = get_supabase_client()

    profile = (
        supabase
        .from_("profiles")
        .select("difficulty_level")
        .eq("id", user_id)
        .execute()
    )
    difficulty = (profile.data[0] if profile.data else {}).get("difficulty_level", "beginner")
    target = DIFFICULTY_SLOT_COUNT.get(difficulty, 2)

    rows = (
        supabase
        .from_("food_rotation_history")
        .select("removed_from_pantry_at")
        .eq("profiles_id", user_id)
        .eq("leave_reason", "consumed")
        .gte("removed_from_pantry_at", start)
        .lte("removed_from_pantry_at", end)
        .execute()
    ).data or []

    events = [r["removed_from_pantry_at"] for r in rows if r["removed_from_pantry_at"]]

    return {"target": target, "goal": target * 7, "events": events}


@router.get("/day")
async def day_plants(
    request: Request,
    start: str = Query(...),
    end: str = Query(...),
):
    """Returns the distinct plant foods consumed within [start, end] (UTC ISO
    bounds for one local day), with totals. Duplicates of the same plant collapse
    to a single row.
    """
    user_id = request.state.user_id
    supabase = get_supabase_client()

    rows = (
        supabase
        .from_("food_rotation_history")
        .select("north_american_plant_foods_id, north_american_plant_foods(common_name, fiber_quantity)")
        .eq("profiles_id", user_id)
        .eq("leave_reason", "consumed")
        .gte("removed_from_pantry_at", start)
        .lte("removed_from_pantry_at", end)
        .execute()
    ).data or []

    seen: set[int] = set()
    plants = []
    for r in rows:
        pid = r["north_american_plant_foods_id"]
        food = r.get("north_american_plant_foods")
        if pid in seen or not food:
            continue
        seen.add(pid)
        plants.append({
            "common_name": food["common_name"],
            "fiber_quantity": food["fiber_quantity"],
        })

    plants.sort(key=lambda p: p["common_name"].lower())
    total_fiber = sum(p["fiber_quantity"] for p in plants)

    return {"plants": plants, "total_plants": len(plants), "total_fiber": total_fiber}
