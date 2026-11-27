from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class HealthResponse(BaseModel):
    status: str
    service: str
    database: str

class RegistrationRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    full_name: str = Field(min_length=2, max_length=160)
    phone: str = Field(min_length=7, max_length=40)
    floor: int = Field(ge=4, le=10)
    apartment_number: str = Field(min_length=1, max_length=40)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    description: str | None
    is_active: bool
    sort_order: int

class MealRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    category_id: UUID
    name: str
    slug: str
    description: str | None
    base_price: Decimal
    image_url: str | None
    is_available: bool
    preparation_minutes: int | None
