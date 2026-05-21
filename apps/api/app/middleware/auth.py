from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.utils.supabase import get_supabase_client

class JWTVerificationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to verify Supabase JWT tokens from Expo app.
    Expects: Authorization: Bearer <token>
    Attaches verified user_id to request.state.user_id
    """

    async def dispatch(self, request: Request, call_next):
        # Skip verification for health check and docs
        if request.url.path in ["/health", "/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)

        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing authorization header"}
            )

        try:
            scheme, token = auth_header.split()
            if scheme.lower() != "bearer":
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid authorization scheme"}
                )
        except ValueError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid authorization header format"}
            )

        try:
            supabase = get_supabase_client()
            user_response = supabase.auth.get_user(token)
            if not user_response or not getattr(user_response, "user", None):
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid token: unable to verify user"}
                )

            request.state.user_id = user_response.user.id
        except Exception as e:
            return JSONResponse(
                status_code=401,
                content={"detail": f"Invalid token: {str(e)}"}
            )

        response = await call_next(request)
        return response
