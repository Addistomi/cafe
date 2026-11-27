from __future__ import annotations
import enum, uuid
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

def enum_col(cls, name):
    return SAEnum(cls, name=name, native_enum=False, create_constraint=True, values_callable=lambda values: [v.value for v in values])

class UserRole(str, enum.Enum):
    CUSTOMER="CUSTOMER"; OWNER="OWNER"; MANAGER="MANAGER"; KITCHEN="KITCHEN"
class AccountStatus(str, enum.Enum):
    PENDING="PENDING"; ACTIVE="ACTIVE"; SUSPENDED="SUSPENDED"
class OrderStatus(str, enum.Enum):
    PENDING_ACCEPTANCE="PENDING_ACCEPTANCE"; ACCEPTED="ACCEPTED"; AWAITING_PAYMENT="AWAITING_PAYMENT"; PREPARING="PREPARING"; READY="READY"; OUT_FOR_DELIVERY="OUT_FOR_DELIVERY"; DELIVERED="DELIVERED"; REJECTED="REJECTED"; CANCELLED="CANCELLED"; EXPIRED="EXPIRED"
class PaymentStatus(str, enum.Enum):
    PENDING="PENDING"; SUCCESS="SUCCESS"; FAILED="FAILED"; EXPIRED="EXPIRED"; REFUND_PENDING="REFUND_PENDING"; REFUNDED="REFUNDED"
class ReservationStatus(str, enum.Enum):
    RESERVED="RESERVED"; CONSUMED="CONSUMED"; RELEASED="RELEASED"
class MovementType(str, enum.Enum):
    PURCHASE="PURCHASE"; CONSUMPTION="CONSUMPTION"; WASTAGE="WASTAGE"; ADJUSTMENT_IN="ADJUSTMENT_IN"; ADJUSTMENT_OUT="ADJUSTMENT_OUT"; RETURN="RETURN"
class BaseUnit(str, enum.Enum):
    GRAM="GRAM"; MILLILITRE="MILLILITRE"; PIECE="PIECE"
class KycStatus(str, enum.Enum):
    PENDING="PENDING"; APPROVED="APPROVED"; REJECTED="REJECTED"

class Profile(Base):
    __tablename__="profiles"
    __table_args__=(CheckConstraint("floor IS NULL OR floor BETWEEN 4 AND 10"),)
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str]=mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str]=mapped_column(String(255))
    full_name: Mapped[str]=mapped_column(String(160))
    phone: Mapped[str|None]=mapped_column(String(40), unique=True)
    role: Mapped[UserRole]=mapped_column(enum_col(UserRole,"user_role"), default=UserRole.CUSTOMER)
    account_status: Mapped[AccountStatus]=mapped_column(enum_col(AccountStatus,"account_status"), default=AccountStatus.PENDING)
    floor: Mapped[int|None]=mapped_column(Integer)
    apartment_number: Mapped[str|None]=mapped_column(String(40))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Category(Base):
    __tablename__="categories"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str]=mapped_column(String(100), unique=True)
    description: Mapped[str|None]=mapped_column(Text)
    is_active: Mapped[bool]=mapped_column(Boolean, default=True, server_default=text("true"))
    sort_order: Mapped[int]=mapped_column(Integer, default=0, server_default=text("0"))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), server_default=func.now())

class Ingredient(Base):
    __tablename__="ingredients"
    __table_args__=(CheckConstraint("on_hand_quantity >= 0"), CheckConstraint("minimum_stock_quantity >= 0"))
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str]=mapped_column(String(120), unique=True)
    base_unit: Mapped[BaseUnit]=mapped_column(enum_col(BaseUnit,"base_unit"))
    on_hand_quantity: Mapped[Decimal]=mapped_column(Numeric(12,3), default=Decimal("0"))
    minimum_stock_quantity: Mapped[Decimal]=mapped_column(Numeric(12,3), default=Decimal("0"))
    is_active: Mapped[bool]=mapped_column(Boolean, default=True, server_default=text("true"))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), server_default=func.now())

class Meal(Base):
    __tablename__="meals"
    __table_args__=(CheckConstraint("base_price > 0"),)
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("categories.id"))
    name: Mapped[str]=mapped_column(String(160)); slug: Mapped[str]=mapped_column(String(180), unique=True)
    description: Mapped[str|None]=mapped_column(Text); base_price: Mapped[Decimal]=mapped_column(Numeric(12,2))
    image_url: Mapped[str|None]=mapped_column(Text); is_available: Mapped[bool]=mapped_column(Boolean, default=True)
    preparation_minutes: Mapped[int|None]=mapped_column(Integer); archived_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), server_default=func.now())

class RecipeIngredient(Base):
    __tablename__="recipe_ingredients"
    __table_args__=(UniqueConstraint("meal_id","ingredient_id"), CheckConstraint("quantity_per_serving > 0"))
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meal_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("meals.id",ondelete="CASCADE"))
    ingredient_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("ingredients.id"))
    quantity_per_serving: Mapped[Decimal]=mapped_column(Numeric(12,3))
    is_removable: Mapped[bool]=mapped_column(Boolean, default=False)

class MealAddon(Base):
    __tablename__="meal_addons"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meal_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("meals.id",ondelete="CASCADE"))
    name: Mapped[str]=mapped_column(String(120)); additional_price: Mapped[Decimal]=mapped_column(Numeric(12,2),default=0)
    ingredient_id: Mapped[uuid.UUID|None]=mapped_column(ForeignKey("ingredients.id")); quantity: Mapped[Decimal|None]=mapped_column(Numeric(12,3))
    is_available: Mapped[bool]=mapped_column(Boolean,default=True)

class CafeOrder(Base):
    __tablename__="orders"
    __table_args__=(Index("ix_orders_status_created","status","created_at"),Index("ix_orders_customer_created","customer_id","created_at"),CheckConstraint("floor_snapshot BETWEEN 4 AND 10"))
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    order_number: Mapped[str]=mapped_column(String(40),unique=True,index=True)
    customer_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("profiles.id"))
    status: Mapped[OrderStatus]=mapped_column(enum_col(OrderStatus,"order_status"),default=OrderStatus.PENDING_ACCEPTANCE)
    subtotal: Mapped[Decimal]=mapped_column(Numeric(12,2)); delivery_fee: Mapped[Decimal]=mapped_column(Numeric(12,2),default=0); total_amount: Mapped[Decimal]=mapped_column(Numeric(12,2))
    currency: Mapped[str]=mapped_column(String(3),default="ETB")
    customer_name_snapshot: Mapped[str]=mapped_column(String(160)); phone_snapshot: Mapped[str|None]=mapped_column(String(40))
    floor_snapshot: Mapped[int]=mapped_column(Integer); apartment_snapshot: Mapped[str]=mapped_column(String(40)); note: Mapped[str|None]=mapped_column(Text)
    accepted_by: Mapped[uuid.UUID|None]=mapped_column(ForeignKey("profiles.id")); accepted_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    reservation_expires_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),server_default=func.now()); updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),server_default=func.now(),onupdate=func.now())

class OrderItem(Base):
    __tablename__="order_items"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    order_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("orders.id")); meal_id: Mapped[uuid.UUID|None]=mapped_column(ForeignKey("meals.id"))
    meal_name_snapshot: Mapped[str]=mapped_column(String(160)); unit_price_snapshot: Mapped[Decimal]=mapped_column(Numeric(12,2))
    quantity: Mapped[int]=mapped_column(Integer); line_total: Mapped[Decimal]=mapped_column(Numeric(12,2)); note: Mapped[str|None]=mapped_column(Text)

class OrderItemIngredient(Base):
    __tablename__="order_item_ingredients"
    __table_args__=(CheckConstraint("source_type IN ('RECIPE','ADDON')"),)
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    order_item_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("order_items.id")); ingredient_id: Mapped[uuid.UUID|None]=mapped_column(ForeignKey("ingredients.id"))
    ingredient_name_snapshot: Mapped[str]=mapped_column(String(120)); quantity_per_serving_snapshot: Mapped[Decimal]=mapped_column(Numeric(12,3))
    total_quantity: Mapped[Decimal]=mapped_column(Numeric(12,3)); was_removed: Mapped[bool]=mapped_column(Boolean,default=False); source_type: Mapped[str]=mapped_column(String(10))

class OrderStatusHistory(Base):
    __tablename__="order_status_history"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    order_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("orders.id")); from_status: Mapped[str|None]=mapped_column(String(32))
    to_status: Mapped[str]=mapped_column(String(32)); reason: Mapped[str|None]=mapped_column(Text)
    changed_by: Mapped[uuid.UUID|None]=mapped_column(ForeignKey("profiles.id")); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),server_default=func.now())

class Payment(Base):
    __tablename__="payments"
    __table_args__=(Index("ix_payments_order_status","order_id","status"),Index("uq_payments_receipt_reference_ci",func.lower(func.trim(text("receipt_reference"))),unique=True,postgresql_where=text("receipt_reference IS NOT NULL")),Index("uq_payments_pending_receipt_order","order_id",unique=True,postgresql_where=text("status = 'PENDING' AND receipt_storage_path IS NOT NULL")))
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    order_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("orders.id")); provider: Mapped[str]=mapped_column(String(30),default="TELEBIRR")
    merchant_order_id: Mapped[str]=mapped_column(String(120),unique=True); transaction_id: Mapped[str|None]=mapped_column(String(120),unique=True)
    receipt_reference: Mapped[str|None]=mapped_column(String(160)); receipt_storage_path: Mapped[str|None]=mapped_column(Text)
    amount: Mapped[Decimal]=mapped_column(Numeric(12,2)); currency: Mapped[str]=mapped_column(String(3),default="ETB")
    status: Mapped[PaymentStatus]=mapped_column(enum_col(PaymentStatus,"payment_status"),default=PaymentStatus.PENDING)
    signature_verified: Mapped[bool]=mapped_column(Boolean,default=False); receipt_verified: Mapped[bool]=mapped_column(Boolean,default=False)
    receipt_verified_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); receipt_verification_message: Mapped[str|None]=mapped_column(Text)
    verified_recipient_name: Mapped[str|None]=mapped_column(String(180)); verified_settled_amount: Mapped[Decimal|None]=mapped_column(Numeric(12,2))
    paid_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),server_default=func.now())

class InventoryReservation(Base):
    __tablename__="inventory_reservations"
    __table_args__=(UniqueConstraint("order_id","ingredient_id"),)
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    order_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("orders.id")); ingredient_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("ingredients.id"))
    quantity: Mapped[Decimal]=mapped_column(Numeric(12,3)); status: Mapped[ReservationStatus]=mapped_column(enum_col(ReservationStatus,"reservation_status"),default=ReservationStatus.RESERVED)
    expires_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),server_default=func.now())

class InventoryMovement(Base):
    __tablename__="inventory_movements"
    __table_args__=(CheckConstraint("direction IN ('IN','OUT')"),)
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    ingredient_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("ingredients.id")); movement_type: Mapped[MovementType]=mapped_column(enum_col(MovementType,"movement_type"))
    quantity: Mapped[Decimal]=mapped_column(Numeric(12,3)); direction: Mapped[str]=mapped_column(String(3))
    reference_type: Mapped[str|None]=mapped_column(String(60)); reference_id: Mapped[uuid.UUID|None]=mapped_column(UUID(as_uuid=True))
    note: Mapped[str|None]=mapped_column(Text); created_by: Mapped[uuid.UUID|None]=mapped_column(ForeignKey("profiles.id"))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),server_default=func.now())

class ResidentKyc(Base):
    __tablename__="resident_kyc"
    __table_args__=(CheckConstraint("resident_type IN ('OWNER','TENANT','FAMILY_MEMBER','EMPLOYEE')"),CheckConstraint("id_document_type IN ('FAYDA','KEBELE_ID','PASSPORT','DRIVER_LICENSE','OTHER')"),CheckConstraint("id_document_last4 ~ '^[A-Za-z0-9]{2,4}$'"))
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4); user_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("profiles.id",ondelete="CASCADE"),unique=True)
    email: Mapped[str]=mapped_column(String(320)); legal_name: Mapped[str]=mapped_column(String(180)); date_of_birth: Mapped[date]=mapped_column(Date)
    nationality: Mapped[str]=mapped_column(String(100)); resident_type: Mapped[str]=mapped_column(String(20)); id_document_type: Mapped[str]=mapped_column(String(30))
    id_document_last4: Mapped[str]=mapped_column(String(4)); id_front_storage_path: Mapped[str]=mapped_column(Text); id_back_storage_path: Mapped[str|None]=mapped_column(Text)
    residence_proof_storage_path: Mapped[str|None]=mapped_column(Text); emergency_contact_name: Mapped[str|None]=mapped_column(String(160))
    emergency_contact_phone: Mapped[str|None]=mapped_column(String(40)); emergency_contact_relation: Mapped[str|None]=mapped_column(String(80))
    status: Mapped[KycStatus]=mapped_column(enum_col(KycStatus,"resident_kyc_status"),default=KycStatus.PENDING)
    review_note: Mapped[str|None]=mapped_column(Text); reviewed_by: Mapped[uuid.UUID|None]=mapped_column(ForeignKey("profiles.id"))
    reviewed_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),server_default=func.now())
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),server_default=func.now(),onupdate=func.now())
