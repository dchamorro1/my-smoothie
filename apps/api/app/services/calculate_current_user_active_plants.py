from app.utils.supabase import get_supabase_client


def calculate_current_user_active_plants(user_id: str) -> int:
    """Return the number of active plants stored for the signed-in user."""
    supabase = get_supabase_client()

    response = (
        supabase
        .from_("user_active_plants")
        .select("id", count="exact")
        .eq("profile_id", user_id)
        .execute()
    )

    if response.error:
        raise RuntimeError(
            f"Failed to query user_active_plants for user {user_id}: {response.error.message}"
        )

    if response.count is not None:
        return response.count

    return len(response.data or [])
