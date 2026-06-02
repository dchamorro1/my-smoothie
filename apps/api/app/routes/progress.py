from fastapi import APIRouter, Query, Request

from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/progress", tags=["progress"])

DIFFICULTY_SLOT_COUNT = {
    "beginner": 2,
    "intermediate": 3,
    "advanced": 4,
    "expert": 5,
}


@router.get("/")
async def get_weekly_progress(request: Request, week_start: str = Query(...)):
    user_id = request.state.user_id
    supabase = get_supabase_client()

    profile_resp = (
        supabase
        .from_("profiles")
        .select("difficulty_level")
        .eq("id", user_id)
        .execute()
    )
    difficulty = (profile_resp.data[0] if profile_resp.data else {}).get("difficulty_level", "beginner")
    slot_count = DIFFICULTY_SLOT_COUNT.get(difficulty, 2)
    goal = slot_count * 7

    count_resp = (
        supabase
        .from_("food_rotation_history")
        .select("id", count="exact")
        .eq("profiles_id", user_id)
        .eq("leave_reason", "consumed")
        .gte("removed_from_pantry_at", week_start)
        .execute()
    )
    consumed = count_resp.count or 0

    return {"consumed": consumed, "goal": goal}
