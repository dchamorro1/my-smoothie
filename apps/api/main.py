from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.middleware.auth import JWTVerificationMiddleware
from app.config import settings
from app.routes import allergies, onboarding, profile, progress, user, user_active_plants

app = FastAPI(title="Smoothie Recommendation Engine")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT Verification Middleware
app.add_middleware(JWTVerificationMiddleware)

# Routes
app.include_router(allergies.router)
app.include_router(profile.router)
app.include_router(onboarding.router)
app.include_router(progress.router)
app.include_router(user.router)
app.include_router(user_active_plants.router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
