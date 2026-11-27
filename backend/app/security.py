from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Profile
from app.settings import settings

password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 30


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def create_access_token(user_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm=ALGORITHM)


def get_current_profile(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Profile:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired login session.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.app_secret_key, algorithms=[ALGORITHM])
        user_id = UUID(payload.get("sub", ""))
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise credentials_error

    profile = db.get(Profile, user_id)
    if profile is None or profile.account_status == "SUSPENDED":
        raise credentials_error
    return profile
