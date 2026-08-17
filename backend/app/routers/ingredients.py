from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Ingredient, RecipeIngredient, User
from app.schemas import IngredientCreate, IngredientOut

router = APIRouter(prefix="/api/ingredients", tags=["ingredients"])


@router.get("", response_model=list[IngredientOut])
def list_ingredients(search: str = "", db: Session = Depends(get_db)):
    query = db.query(Ingredient)
    if search:
        query = query.filter(Ingredient.name.ilike(f"%{search}%"))
    return query.order_by(Ingredient.name).all()


@router.post("", response_model=IngredientOut, status_code=status.HTTP_201_CREATED)
def create_ingredient(
    data: IngredientCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    existing = db.query(Ingredient).filter(Ingredient.name.ilike(data.name)).first()
    if existing:
        return existing
    ingredient = Ingredient(name=data.name, unit=data.unit)
    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)
    return ingredient


@router.delete("/{ingredient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ingredient(
    ingredient_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ingredient = db.get(Ingredient, ingredient_id)
    if ingredient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingrediente no encontrado"
        )
    in_use = (
        db.query(RecipeIngredient)
        .filter(RecipeIngredient.ingredient_id == ingredient_id)
        .first()
    )
    if in_use is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: el ingrediente está en uso por al menos una receta",
        )
    db.delete(ingredient)
    db.commit()
