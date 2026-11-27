from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AccountStatus, Profile, UserRole
from app.schemas import LoginRequest, ProfileRead, RegistrationRequest, TokenResponse
from app.security import create_access_token, get_current_profile, hash_password, verify_password

router = APIRouter(tags=["authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegistrationRequest, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    phone = payload.phone.strip()
    existing = db.scalar(
        select(Profile).where(or_(Profile.email == email, Profile.phone == phone))
    )
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email or phone already exists.")

    profile = Profile(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        phone=phone,
        role=UserRole.CUSTOMER,
        account_status=AccountStatus.PENDING,
        floor=payload.floor,
        apartment_number=payload.apartment_number.strip(),
    )
    db.add(profile)
    try:
        db.commit()
        db.refresh(profile)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email or phone already exists.")

    # New resident accounts remain PENDING until the KYC review workflow approves them.
    return TokenResponse(access_token=create_access_token(profile.id))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    profile = db.scalar(select(Profile).where(Profile.email == email))
    if profile is None or not verify_password(payload.password, profile.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if profile.account_status == AccountStatus.SUSPENDED:
        raise HTTPException(status_code=403, detail="This account has been suspended.")
    return TokenResponse(access_token=create_access_token(profile.id))


@router.get("/me", response_model=ProfileRead)
def me(profile: Profile = Depends(get_current_profile)):
    return profile
