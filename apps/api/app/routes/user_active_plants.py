from fastapi import APIRouter, Request
from app.services.calculate_current_user_active_plants import calculate_current_user_active_plants

router = APIRouter(prefix="/api/user-active-plants", tags=["user_active_plants"])


@router.get("/")
async def get_user_active_plants_count(request: Request):
    user_id = request.state.user_id
    count = calculate_current_user_active_plants(user_id)

    return {"count": count}
