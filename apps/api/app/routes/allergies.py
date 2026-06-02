from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List

from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/allergies", tags=["allergies"])

VALID_ALLERGIES = {"tree_nuts", "peanuts", "wheat", "soybeans", "sesame"}


class AllergyUpdateRequest(BaseModel):
    allergies: List[str]


@router.get("/")
async def get_allergies(request: Request):
    user_id = request.state.user_id
    supabase = get_supabase_client()
    resp = (
        supabase
        .from_("user_allergies")
        .select("allergy")
        .eq("profiles_id", user_id)
        .execute()
    )
    return {"allergies": [row["allergy"] for row in (resp.data or [])]}


@router.put("/")
async def update_allergies(request: Request, body: AllergyUpdateRequest):
    user_id = request.state.user_id
    supabase = get_supabase_client()

    supabase.from_("user_allergies").delete().eq("profiles_id", user_id).execute()

    valid = [a for a in body.allergies if a in VALID_ALLERGIES]
    if valid:
        supabase.from_("user_allergies").insert([
            {"profiles_id": user_id, "allergy": a} for a in valid
        ]).execute()

    return {"allergies": valid}
