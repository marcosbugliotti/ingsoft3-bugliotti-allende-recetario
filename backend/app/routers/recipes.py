from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user, get_current_user_optional
from app.models import Ingredient, Recipe, RecipeIngredient, User
from app.schemas import (
    RecipeCreate,
    RecipeIngredientOut,
    RecipeOut,
    RecipeSummaryOut,
    RecipeUpdate,
)

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


def _visible_or_404(recipe: Recipe | None, user: User | None) -> Recipe:
    if recipe is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")
    is_owner = user is not None and recipe.owner_id == user.id
    if not recipe.is_public and not is_owner:
        # Regla de negocio: autorización de lectura — una receta privada no revela
        # ni siquiera su existencia a quien no es el dueño.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")
    return recipe


def _owned_or_403(recipe: Recipe | None, user: User) -> Recipe:
    if recipe is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")
    if recipe.owner_id != user.id:
        # Regla de negocio: autorización de escritura.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="No sos el dueño de esta receta"
        )
    return recipe


def _build_recipe_out(recipe: Recipe, servings_requested: int, user: User | None) -> RecipeOut:
    # Regla de negocio: cálculo — escala cada ingrediente proporcional a las porciones pedidas.
    factor = servings_requested / recipe.servings_base
    ingredients = [
        RecipeIngredientOut(
            ingredient=link.ingredient,
            quantity_base=link.quantity_base,
            quantity_scaled=round(link.quantity_base * factor, 2),
        )
        for link in recipe.ingredient_links
    ]
    return RecipeOut(
        id=recipe.id,
        title=recipe.title,
        description=recipe.description,
        servings_base=recipe.servings_base,
        servings_requested=servings_requested,
        prep_time_minutes=recipe.prep_time_minutes,
        is_public=recipe.is_public,
        owner_id=recipe.owner_id,
        is_owner=user is not None and recipe.owner_id == user.id,
        ingredients=ingredients,
    )


def _sync_ingredients(db: Session, recipe: Recipe, items: list) -> None:
    recipe.ingredient_links.clear()
    db.flush()
    for item in items:
        ingredient = db.get(Ingredient, item.ingredient_id)
        if ingredient is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ingrediente {item.ingredient_id} no existe",
            )
        recipe.ingredient_links.append(
            RecipeIngredient(ingredient_id=ingredient.id, quantity_base=item.quantity_base)
        )


def _check_title_unique(
    db: Session, owner_id: int, title: str, exclude_id: int | None = None
) -> None:
    # Regla de negocio: validación — título no vacío (por el schema) y único por usuario.
    query = db.query(Recipe).filter(Recipe.owner_id == owner_id, Recipe.title == title)
    if exclude_id is not None:
        query = query.filter(Recipe.id != exclude_id)
    if query.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya tenés una receta con ese título",
        )


@router.get("", response_model=list[RecipeSummaryOut])
def list_recipes(
    search: str = "",
    mine: bool = False,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    query = db.query(Recipe).options(
        joinedload(Recipe.ingredient_links).joinedload(RecipeIngredient.ingredient)
    )

    if mine:
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
        query = query.filter(Recipe.owner_id == user.id)
    elif user is not None:
        # Regla de negocio: autorización de lectura — públicas + las propias.
        query = query.filter(or_(Recipe.is_public.is_(True), Recipe.owner_id == user.id))
    else:
        query = query.filter(Recipe.is_public.is_(True))

    if search:
        like = f"%{search}%"
        query = (
            query.join(Recipe.ingredient_links, isouter=True)
            .join(RecipeIngredient.ingredient, isouter=True)
            .filter(or_(Recipe.title.ilike(like), Ingredient.name.ilike(like)))
        )

    return query.distinct().order_by(Recipe.created_at.desc()).all()


@router.post("", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
def create_recipe(
    data: RecipeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _check_title_unique(db, user.id, data.title)
    recipe = Recipe(
        title=data.title,
        description=data.description,
        servings_base=data.servings_base,
        prep_time_minutes=data.prep_time_minutes,
        owner_id=user.id,
        is_public=False,
    )
    db.add(recipe)
    db.flush()
    _sync_ingredients(db, recipe, data.ingredients)
    db.commit()
    db.refresh(recipe)
    return _build_recipe_out(recipe, recipe.servings_base, user)


@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(
    recipe_id: int,
    servings: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    recipe = _visible_or_404(db.get(Recipe, recipe_id), user)
    servings_requested = servings if servings is not None else recipe.servings_base
    return _build_recipe_out(recipe, servings_requested, user)


@router.put("/{recipe_id}", response_model=RecipeOut)
def update_recipe(
    recipe_id: int,
    data: RecipeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    recipe = _owned_or_403(db.get(Recipe, recipe_id), user)
    _check_title_unique(db, user.id, data.title, exclude_id=recipe.id)
    recipe.title = data.title
    recipe.description = data.description
    recipe.servings_base = data.servings_base
    recipe.prep_time_minutes = data.prep_time_minutes
    _sync_ingredients(db, recipe, data.ingredients)
    db.commit()
    db.refresh(recipe)
    return _build_recipe_out(recipe, recipe.servings_base, user)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    recipe = _owned_or_403(db.get(Recipe, recipe_id), user)
    db.delete(recipe)
    db.commit()


@router.patch("/{recipe_id}/publish", response_model=RecipeOut)
def publish_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    recipe = _owned_or_403(db.get(Recipe, recipe_id), user)
    # Regla de negocio: validación + transición de estado — solo pasa a pública si
    # cumple los requisitos mínimos para ser cocinada por otra persona.
    if not recipe.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La receta necesita un título"
        )
    if recipe.prep_time_minutes <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El tiempo de preparación debe ser mayor a 0 para publicar",
        )
    if len(recipe.ingredient_links) < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La receta necesita al menos un ingrediente para publicar",
        )
    recipe.is_public = True
    db.commit()
    db.refresh(recipe)
    return _build_recipe_out(recipe, recipe.servings_base, user)
