from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.models import Ingredient, Recipe, RecipeIngredient, User
from app.routers.recipes import publish_recipe


def _recipe(title="Tarta", prep_time_minutes=30, con_ingredientes=True):
    recipe = Recipe(id=1, title=title, description="", servings_base=4,
                     prep_time_minutes=prep_time_minutes, is_public=False, owner_id=1)
    recipe.ingredient_links = (
        [RecipeIngredient(quantity_base=200, ingredient=Ingredient(id=1, name="Harina", unit="g"))]
        if con_ingredientes else []
    )
    return recipe


def _db_con(recipe):
    db = Mock()
    db.get.return_value = recipe
    return db


def test_no_publica_sin_titulo():
    recipe = _recipe(title="   ")
    dueno = User(id=1, email="a@a.com", name="A")

    with pytest.raises(HTTPException) as exc:
        publish_recipe(1, db=_db_con(recipe), user=dueno)

    assert exc.value.status_code == 400
    assert recipe.is_public is False


def test_no_publica_con_tiempo_de_preparacion_cero():
    recipe = _recipe(prep_time_minutes=0)
    dueno = User(id=1, email="a@a.com", name="A")

    with pytest.raises(HTTPException) as exc:
        publish_recipe(1, db=_db_con(recipe), user=dueno)

    assert exc.value.status_code == 400
    assert recipe.is_public is False


def test_no_publica_sin_ingredientes():
    recipe = _recipe(con_ingredientes=False)
    dueno = User(id=1, email="a@a.com", name="A")

    with pytest.raises(HTTPException) as exc:
        publish_recipe(1, db=_db_con(recipe), user=dueno)

    assert exc.value.status_code == 400
    assert recipe.is_public is False


def test_publica_cuando_cumple_los_tres_requisitos():
    recipe = _recipe()
    dueno = User(id=1, email="a@a.com", name="A")

    resultado = publish_recipe(1, db=_db_con(recipe), user=dueno)

    assert recipe.is_public is True
    assert resultado.is_public is True
