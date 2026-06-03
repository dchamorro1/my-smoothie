from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query, Request

from app.services.calculate_current_user_active_plants import DIFFICULTY_SLOT_COUNT
from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _parse_iso(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


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


@router.get("/summary")
async def stats_summary(
    request: Request,
    month_start: str = Query(...),
    month_end: str = Query(...),
    tz_offset: int = Query(0),  # minutes to add to UTC to get the user's local time
):
    """Returns:
    - unique_this_month: distinct plants consumed within [month_start, month_end]
    - streak: consecutive local days (up to today) where consumed >= daily target
    - target: the user's daily target (difficulty slot count)
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
        .select("north_american_plant_foods_id, removed_from_pantry_at")
        .eq("profiles_id", user_id)
        .eq("leave_reason", "consumed")
        .execute()
    ).data or []

    month_lo = _parse_iso(month_start)
    month_hi = _parse_iso(month_end)
    offset = timedelta(minutes=tz_offset)

    unique_ids: set[int] = set()
    day_counts: Counter = Counter()
    for r in rows:
        ts = r["removed_from_pantry_at"]
        if not ts:
            continue
        dt = _parse_iso(ts)
        if month_lo <= dt <= month_hi:
            unique_ids.add(r["north_american_plant_foods_id"])
        local_date = (dt.astimezone(timezone.utc).replace(tzinfo=None) + offset).date()
        day_counts[local_date] += 1

    met_days = {d for d, c in day_counts.items() if c >= target}

    today = (datetime.now(timezone.utc).replace(tzinfo=None) + offset).date()
    # Today still in progress: if not met yet, start counting from yesterday.
    cursor = today if today in met_days else today - timedelta(days=1)
    streak = 0
    while cursor in met_days:
        streak += 1
        cursor -= timedelta(days=1)

    return {
        "unique_this_month": len(unique_ids),
        "streak": streak,
        "target": target,
    }
