from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.middleware.auth import JWTVerificationMiddleware
from app.config import settings
from app.routes import recommendations

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
app.include_router(recommendations.router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
