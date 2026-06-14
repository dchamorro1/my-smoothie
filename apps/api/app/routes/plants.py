import difflib

from fastapi import APIRouter, Query, Request

from app.services.calculate_current_user_active_plants import _current_week_start_iso
from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/plants", tags=["plants"])

MAX_RESULTS = 8
FUZZY_THRESHOLD = 0.4


def _selectable_candidates(supabase, user_id: str) -> list[dict]:
    """All plants the user is allowed to manually add right now:
    active, not an allergen, not already in their list, and not consumed
    earlier this week. Season is intentionally ignored for manual search —
    if the user has the plant, they can add it regardless of season.
    """
    allergies = (
        supabase
        .from_("user_allergies")
        .select("allergy")
        .eq("profiles_id", user_id)
        .execute()
    ).data or []
    user_allergens = {row["allergy"] for row in allergies}

    active = (
        supabase
        .from_("user_active_plants")
        .select("north_american_plant_foods_id")
        .eq("profiles_id", user_id)
        .execute()
    ).data or []
    active_ids = {row["north_american_plant_foods_id"] for row in active}

    consumed = (
        supabase
        .from_("food_rotation_history")
        .select("north_american_plant_foods_id")
        .eq("profiles_id", user_id)
        .eq("leave_reason", "consumed")
        .gte("removed_from_pantry_at", _current_week_start_iso())
        .execute()
    ).data or []
    consumed_ids = {row["north_american_plant_foods_id"] for row in consumed}

    excluded = active_ids | consumed_ids

    plants = (
        supabase
        .from_("north_american_plant_foods")
        .select("id, common_name, fiber_quantity, alllergen, category")
        .eq("is_active", True)
        .execute()
    ).data or []

    return [
        {
            "id": p["id"],
            "common_name": p["common_name"],
            "fiber_quantity": p["fiber_quantity"],
            "category": p["category"],
        }
        for p in plants
        if p["id"] not in excluded and p["alllergen"] not in user_allergens
    ]


def is_plant_selectable(supabase, user_id: str, plant_id: int) -> bool:
    return any(c["id"] == plant_id for c in _selectable_candidates(supabase, user_id))


@router.get("/search")
async def search_plants(request: Request, q: str = Query("", max_length=64)):
    user_id = request.state.user_id
    supabase = get_supabase_client()

    candidates = _selectable_candidates(supabase, user_id)

    query = q.strip().lower()
    if not query:
        # No query yet — return an alphabetical starter list.
        results = sorted(candidates, key=lambda c: c["common_name"].lower())
        return {"results": results[:MAX_RESULTS]}

    # Prefix match first
    prefix = [c for c in candidates if c["common_name"].lower().startswith(query)]
    if prefix:
        prefix.sort(key=lambda c: c["common_name"].lower())
        return {"results": prefix[:MAX_RESULTS]}

    # Fuzzy fallback (ranked by similarity)
    scored = []
    for c in candidates:
        ratio = difflib.SequenceMatcher(None, query, c["common_name"].lower()).ratio()
        if ratio >= FUZZY_THRESHOLD:
            scored.append((ratio, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    return {"results": [c for _, c in scored[:MAX_RESULTS]]}
