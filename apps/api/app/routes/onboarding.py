from fastapi import APIRouter, HTTPException, Request

from app.schemas.onboarding import OnboardingRequest
from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

VALID_DIFFICULTIES = {"beginner", "intermediate", "advanced", "expert"}
VALID_ALLERGIES = {"tree_nuts", "peanuts", "wheat", "soybeans", "sesame"}


@router.post("/")
async def complete_onboarding(request: Request, body: OnboardingRequest):
    user_id = request.state.user_id

    if body.difficulty_level not in VALID_DIFFICULTIES:
        raise HTTPException(status_code=400, detail="Invalid difficulty level")

    supabase = get_supabase_client()

    supabase.from_("profiles").upsert({
        "id": user_id,
        "difficulty_level": body.difficulty_level,
        "is_guest_user": body.is_guest_user,
    }).execute()

    valid_allergies = [a for a in body.allergies if a in VALID_ALLERGIES]
    if valid_allergies:
        supabase.from_("user_allergies").insert([
            {"profiles_id": user_id, "allergy": a} for a in valid_allergies
        ]).execute()

    return {"success": True}
