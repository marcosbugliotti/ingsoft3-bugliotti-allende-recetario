from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.models import Ingredient, RecipeIngredient
from app.routers.ingredients import create_ingredient, delete_ingredient
from app.schemas import IngredientCreate


def test_crear_ingrediente_existente_no_duplica():
    db = Mock()
    existente = Ingredient(id=1, name="Harina", unit="g")
    db.query.return_value.filter.return_value.first.return_value = existente

    resultado = create_ingredient(IngredientCreate(name="harina", unit="g"), db=db, _=None)

    assert resultado is existente
    db.add.assert_not_called()


def test_crear_ingrediente_nuevo_lo_guarda():
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = None

    create_ingredient(IngredientCreate(name="Azúcar", unit="g"), db=db, _=None)

    db.add.assert_called_once()
    db.commit.assert_called_once()


def test_borrar_ingrediente_inexistente_da_404():
    db = Mock()
    db.get.return_value = None

    with pytest.raises(HTTPException) as exc:
        delete_ingredient(1, db=db, _=None)

    assert exc.value.status_code == 404


def test_no_borra_un_ingrediente_en_uso():
    db = Mock()
    db.get.return_value = Ingredient(id=1, name="Harina", unit="g")
    db.query.return_value.filter.return_value.first.return_value = Mock(spec=RecipeIngredient)

    with pytest.raises(HTTPException) as exc:
        delete_ingredient(1, db=db, _=None)

    assert exc.value.status_code == 409
    db.delete.assert_not_called()


def test_borra_un_ingrediente_sin_uso():
    db = Mock()
    db.get.return_value = Ingredient(id=1, name="Harina", unit="g")
    db.query.return_value.filter.return_value.first.return_value = None

    delete_ingredient(1, db=db, _=None)

    db.delete.assert_called_once()
    db.commit.assert_called_once()
