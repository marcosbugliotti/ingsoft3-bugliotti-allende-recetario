from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.models import Ingredient, Recipe, RecipeIngredient
from app.routers.recipes import _sync_ingredients
from app.schemas import RecipeIngredientIn


def test_ingrediente_inexistente_da_400():
    db = Mock()
    db.get.return_value = None
    recipe = Recipe(id=1, title="Tarta", servings_base=4, prep_time_minutes=30, owner_id=1)
    recipe.ingredient_links = []

    with pytest.raises(HTTPException) as exc:
        _sync_ingredients(db, recipe, [RecipeIngredientIn(ingredient_id=99, quantity_base=100)])

    assert exc.value.status_code == 400


def test_sincroniza_los_ingredientes_existentes():
    db = Mock()
    db.get.return_value = Ingredient(id=1, name="Harina", unit="g")
    recipe = Recipe(id=1, title="Tarta", servings_base=4, prep_time_minutes=30, owner_id=1)
    recipe.ingredient_links = []

    _sync_ingredients(db, recipe, [RecipeIngredientIn(ingredient_id=1, quantity_base=200)])

    assert len(recipe.ingredient_links) == 1
    assert recipe.ingredient_links[0].quantity_base == 200


def test_reemplaza_los_ingredientes_anteriores_no_los_acumula():
    db = Mock()
    db.get.return_value = Ingredient(id=2, name="Azúcar", unit="g")
    recipe = Recipe(id=1, title="Tarta", servings_base=4, prep_time_minutes=30, owner_id=1)
    recipe.ingredient_links = [RecipeIngredient(ingredient_id=1, quantity_base=999)]  # lo anterior

    _sync_ingredients(db, recipe, [RecipeIngredientIn(ingredient_id=2, quantity_base=50)])

    assert len(recipe.ingredient_links) == 1
    assert recipe.ingredient_links[0].ingredient_id == 2
