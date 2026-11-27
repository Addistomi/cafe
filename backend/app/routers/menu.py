from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Category, Meal
from app.schemas import CategoryRead, MealRead

router = APIRouter(tags=["menu"])


@router.get("/categories", response_model=list[CategoryRead])
def list_categories(db: Session = Depends(get_db)):
    statement = (
        select(Category)
        .where(Category.is_active.is_(True))
        .order_by(Category.sort_order.asc(), Category.name.asc())
    )
    return db.scalars(statement).all()


@router.get("/meals", response_model=list[MealRead])
def list_meals(category_id: UUID | None = None, db: Session = Depends(get_db)):
    statement = (
        select(Meal)
        .join(Category, Meal.category_id == Category.id)
        .where(
            Meal.is_available.is_(True),
            Meal.archived_at.is_(None),
            Category.is_active.is_(True),
        )
        .order_by(Category.sort_order.asc(), Meal.name.asc())
    )
    if category_id is not None:
        statement = statement.where(Meal.category_id == category_id)
    return db.scalars(statement).all()


@router.get("/meals/{meal_id}", response_model=MealRead)
def get_meal(meal_id: UUID, db: Session = Depends(get_db)):
    statement = (
        select(Meal)
        .join(Category, Meal.category_id == Category.id)
        .where(
            Meal.id == meal_id,
            Meal.is_available.is_(True),
            Meal.archived_at.is_(None),
            Category.is_active.is_(True),
        )
    )
    meal = db.scalar(statement)
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found.")
    return meal
