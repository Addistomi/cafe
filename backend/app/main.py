from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.system import router as system_router
from app.settings import settings

app = FastAPI(
    title="Fana Cafe API",
    version="1.0.0",
    description="Standalone API for the Fana Cafe resident, admin, and kitchen platforms.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(system_router)
