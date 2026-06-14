import random
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.utils.supabase import get_supabase_client

DIFFICULTY_SLOT_COUNT = {
    "beginner": 2,
    "intermediate": 3,
    "advanced": 4,
    "expert": 5,
}

CANDIDATE_POOL_SIZE = 10
FIBER_NOISE_MAX = 2.0


def _current_week_start_iso() -> str:
    """Returns ISO timestamp of Monday 12am UTC for the current week."""
    now = datetime.now(timezone.utc)
    monday = now - timedelta(days=now.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def _current_season_column() -> str:
    month = datetime.now().month
    if month in (12, 1, 2):
        return "available_in_winter"
    elif month in (3, 4, 5):
        return "available_in_spring"
    elif month in (6, 7, 8):
        return "available_in_summer"
    else:
        return "available_in_fall"


def calculate_and_assign_user_active_plants(user_id: str, count: Optional[int] = None) -> None:
    supabase = get_supabase_client()

    profile_resp = (
        supabase
        .from_("profiles")
        .select("difficulty_level")
        .eq("id", user_id)
        .single()
        .execute()
    )
    difficulty = (profile_resp.data or {}).get("difficulty_level", "beginner")
    # When no explicit count is given, seed a full week's worth (daily amount × 7).
    slot_count = count if count is not None else DIFFICULTY_SLOT_COUNT.get(difficulty, 2) * 7

    season_col = _current_season_column()

    allergies_resp = (
        supabase
        .from_("user_allergies")
        .select("allergy")
        .eq("profiles_id", user_id)
        .execute()
    )
    user_allergens = {row["allergy"] for row in (allergies_resp.data or [])}

    # Exclude plants the user already has active
    active_resp = (
        supabase
        .from_("user_active_plants")
        .select("north_american_plant_foods_id, position_index")
        .eq("profiles_id", user_id)
        .execute()
    )
    active_rows = active_resp.data or []
    active_plant_ids = {row["north_american_plant_foods_id"] for row in active_rows}
    # New plants are appended after any existing ones
    base_index = max((row["position_index"] or 0 for row in active_rows), default=-1) + 1

    # Exclude plants already cycled through this week (resets every Monday 12am UTC)
    week_start = _current_week_start_iso()
    weekly_resp = (
        supabase
        .from_("food_rotation_history")
        .select("north_american_plant_foods_id")
        .eq("profiles_id", user_id)
        .gte("removed_from_pantry_at", week_start)
        .execute()
    )
    weekly_plant_ids = {row["north_american_plant_foods_id"] for row in (weekly_resp.data or [])}

    excluded_ids = active_plant_ids | weekly_plant_ids

    candidates_resp = (
        supabase
        .from_("north_american_plant_foods")
        .select("id, common_name, fiber_quantity, alllergen")
        .eq("is_active", True)
        .eq(season_col, True)
        .execute()
    )
    candidates = [
        p for p in (candidates_resp.data or [])
        if p["id"] not in excluded_ids
        and p["alllergen"] not in user_allergens
    ]

    if not candidates:
        return

    # Build a map of plant_id -> most recent removed_from_pantry_at for this user
    history_resp = (
        supabase
        .from_("food_rotation_history")
        .select("north_american_plant_foods_id, removed_from_pantry_at")
        .eq("profiles_id", user_id)
        .execute()
    )
    last_seen: dict[int, str] = {}
    for row in (history_resp.data or []):
        plant_id = row["north_american_plant_foods_id"]
        ts = row["removed_from_pantry_at"]
        if ts and (plant_id not in last_seen or ts > last_seen[plant_id]):
            last_seen[plant_id] = ts

    # Never-seen plants sort first (empty string < any ISO timestamp)
    candidates.sort(key=lambda p: last_seen.get(p["id"]) or "")

    # Pool of least-recently-seen plants to choose from. Must be larger than the
    # number we need so the fiber scoring still has room to vary the selection.
    pool_size = max(CANDIDATE_POOL_SIZE, slot_count + 5)
    pool = candidates[:pool_size]

    # Score by fiber + noise so high-fiber plants lead but low-fiber still get picked
    scored = [(p, p["fiber_quantity"] + random.uniform(0, FIBER_NOISE_MAX)) for p in pool]
    scored.sort(key=lambda x: x[1], reverse=True)
    selected = [p for p, _ in scored[:slot_count]]

    rows = [
        {
            "profiles_id": user_id,
            "north_american_plant_foods_id": p["id"],
            "status": "pending",
            "position_index": base_index + i,
        }
        for i, p in enumerate(selected)
    ]
    supabase.from_("user_active_plants").insert(rows).execute()
