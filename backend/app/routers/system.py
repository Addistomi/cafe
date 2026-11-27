from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db import get_db
from app.schemas import HealthResponse

router = APIRouter(tags=["system"])

@router.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(status="ok", service="fana-cafe-api", database="not_checked")

@router.get("/ready", response_model=HealthResponse)
def readiness_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return HealthResponse(status="ready", service="fana-cafe-api", database="connected")
