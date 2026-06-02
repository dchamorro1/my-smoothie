from fastapi import APIRouter, Request

from app.services.calculate_current_user_active_plants import calculate_and_assign_user_active_plants
from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/user-active-plants", tags=["user_active_plants"])


def _fetch_active_plants(supabase, user_id: str) -> list:
    resp = (
        supabase
        .from_("user_active_plants")
        .select("id, north_american_plant_foods(common_name, fiber_quantity)")
        .eq("profiles_id", user_id)
        .execute()
    )
    return resp.data or []


@router.get("/")
async def get_user_active_plants(request: Request):
    user_id = request.state.user_id
    supabase = get_supabase_client()

    plants = _fetch_active_plants(supabase, user_id)

    if not plants:
        calculate_and_assign_user_active_plants(user_id)
        plants = _fetch_active_plants(supabase, user_id)

    return {
        "plants": [
            {
                "id": p["id"],
                "common_name": p["north_american_plant_foods"]["common_name"],
                "fiber_quantity": p["north_american_plant_foods"]["fiber_quantity"],
            }
            for p in plants
        ]
    }
