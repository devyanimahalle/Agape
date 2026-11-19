"""SharePlate FastAPI application entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from app.admin.router import router as admin_router
    from app.impact.router import router as impact_router
except ImportError:
    from backend.app.admin.router import router as admin_router
    from backend.app.impact.router import router as impact_router

app = FastAPI(
    title="SharePlate API",
    description="Food surplus redistribution platform",
    version="1.0.0",
)

# CORS — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers under /api/v1
app.include_router(admin_router, prefix="/api/v1")
app.include_router(impact_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
