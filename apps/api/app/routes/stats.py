import re
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query, Request

from app.services.calculate_current_user_active_plants import DIFFICULTY_SLOT_COUNT
from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/stats", tags=["stats"])


_ISO_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})")


def _parse_iso(ts: str) -> datetime:
    """Parse an ISO timestamp to an aware UTC datetime.

    Python 3.9's datetime.fromisoformat is too strict for Postgres output:
    it rejects hour-only offsets ('+00') and fractional seconds that aren't
    exactly 3 or 6 digits (Postgres trims trailing zeros). All our timestamps
    are UTC, so we just extract the date/time fields and treat them as UTC,
    ignoring the (UTC) offset and sub-second precision.
    """
    m = _ISO_RE.match(ts.strip())
    if not m:
        raise ValueError(f"Unrecognized timestamp: {ts!r}")
    year, month, day, hour, minute, second = (int(g) for g in m.groups())
    return datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)


def _target_for(supabase, user_id: str) -> int:
    profile = (
        supabase
        .from_("profiles")
        .select("difficulty_level")
        .eq("id", user_id)
        .execute()
    )
    difficulty = (profile.data[0] if profile.data else {}).get("difficulty_level", "beginner")
    return DIFFICULTY_SLOT_COUNT.get(difficulty, 2)


@router.get("/calendar")
async def calendar_stats(
    request: Request,
    start: str = Query(...),
    end: str = Query(...),
    month_start: str = Query(...),
    month_end: str = Query(...),
):
    """Returns consumed-plant timestamps in [start, end] (the calendar grid range)
    plus the count of distinct plants consumed within [month_start, month_end] (the
    viewed month) and the user's daily target / weekly goal. The frontend buckets
    the timestamps into local calendar days for the heatmap.
    """
    user_id = request.state.user_id
    supabase = get_supabase_client()
    target = _target_for(supabase, user_id)

    rows = (
        supabase
        .from_("food_rotation_history")
        .select("north_american_plant_foods_id, removed_from_pantry_at")
        .eq("profiles_id", user_id)
        .eq("leave_reason", "consumed")
        .gte("removed_from_pantry_at", start)
        .lte("removed_from_pantry_at", end)
        .execute()
    ).data or []

    month_lo = _parse_iso(month_start)
    month_hi = _parse_iso(month_end)

    events = []
    unique_ids: set[int] = set()
    for r in rows:
        ts = r["removed_from_pantry_at"]
        if not ts:
            continue
        events.append(ts)
        if month_lo <= _parse_iso(ts) <= month_hi:
            unique_ids.add(r["north_american_plant_foods_id"])

    return {
        "target": target,
        "goal": target * 7,
        "events": events,
        "unique_this_month": len(unique_ids),
    }


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
        .select("north_american_plant_foods_id, north_american_plant_foods(common_name, fiber_quantity, category)")
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
            "category": food["category"],
        })

    plants.sort(key=lambda p: p["common_name"].lower())
    total_fiber = sum(p["fiber_quantity"] for p in plants)

    return {"plants": plants, "total_plants": len(plants), "total_fiber": total_fiber}


@router.get("/streak")
async def streak_stats(
    request: Request,
    tz_offset: int = Query(0),  # minutes to add to UTC to get the user's local time
):
    """Current streak: consecutive local days (up to today) where the user consumed
    at least their daily target. Month-independent.
    """
    user_id = request.state.user_id
    supabase = get_supabase_client()
    target = _target_for(supabase, user_id)

    rows = (
        supabase
        .from_("food_rotation_history")
        .select("removed_from_pantry_at")
        .eq("profiles_id", user_id)
        .eq("leave_reason", "consumed")
        .execute()
    ).data or []

    offset = timedelta(minutes=tz_offset)
    day_counts: Counter = Counter()
    for r in rows:
        ts = r["removed_from_pantry_at"]
        if not ts:
            continue
        local_date = (_parse_iso(ts).astimezone(timezone.utc).replace(tzinfo=None) + offset).date()
        day_counts[local_date] += 1

    met_days = {d for d, c in day_counts.items() if c >= target}

    today = (datetime.now(timezone.utc).replace(tzinfo=None) + offset).date()
    # Today still in progress: if not met yet, start counting from yesterday.
    cursor = today if today in met_days else today - timedelta(days=1)
    streak = 0
    while cursor in met_days:
        streak += 1
        cursor -= timedelta(days=1)

    return {"streak": streak, "target": target}
