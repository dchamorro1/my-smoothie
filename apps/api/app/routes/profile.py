from fastapi import APIRouter, HTTPException, Request

from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/")
async def get_profile(request: Request):
    user_id = request.state.user_id
    supabase = get_supabase_client()

    resp = (
        supabase
        .from_("profiles")
        .select("id, difficulty_level, is_guest_user")
        .eq("id", user_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return resp.data[0]
