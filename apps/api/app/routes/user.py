from fastapi import APIRouter, Request

from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/user", tags=["user"])


@router.delete("/")
async def delete_user(request: Request):
    user_id = request.state.user_id
    supabase = get_supabase_client()

    supabase.from_("user_active_plants").delete().eq("profiles_id", user_id).execute()
    supabase.from_("user_allergies").delete().eq("profiles_id", user_id).execute()
    supabase.from_("food_rotation_history").delete().eq("profiles_id", user_id).execute()
    supabase.from_("food_skip_tracking").delete().eq("profiles_id", user_id).execute()
    supabase.from_("profiles").delete().eq("id", user_id).execute()
    supabase.auth.admin.delete_user(user_id)

    return {"success": True}
