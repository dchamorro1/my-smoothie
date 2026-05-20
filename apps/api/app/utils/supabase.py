from supabase import create_client
from app.config import settings

def get_supabase_client():
    """
    Returns Supabase client with Service Role Key for backend operations.
    Only use this for trusted server-to-Supabase operations.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
