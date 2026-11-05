import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.fair import router as fair_router
from app.routes import router as routes_router
from app.stops import router as stops_router

app = FastAPI(title="Commute.ph API", description="Jeepney fare checker for Marikina City", version="1.0.0")

# Browsers may call the API only from these origins (comma-separated in CORS_ORIGINS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health():
    """Basic liveness check for the host's health probe."""
    return {"status": "ok"}


app.include_router(routes_router.router)
app.include_router(stops_router.router)
app.include_router(stops_router.admin_router)
app.include_router(fair_router.router)
