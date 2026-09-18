import pytest
from fastapi import HTTPException

from app.models import Recipe, User
from app.routers.recipes import _owned_or_403, _visible_or_404


def _recipe(owner_id, is_public):
    return Recipe(id=1, title="Tarta", servings_base=4, prep_time_minutes=30,
                  is_public=is_public, owner_id=owner_id)


# ---------- _visible_or_404: autorización de lectura ----------

def test_receta_inexistente_da_404():
    with pytest.raises(HTTPException) as exc:
        _visible_or_404(None, user=None)
    assert exc.value.status_code == 404


def test_receta_publica_es_visible_sin_usuario():
    recipe = _recipe(owner_id=1, is_public=True)

    resultado = _visible_or_404(recipe, user=None)

    assert resultado is recipe


def test_receta_privada_ajena_da_404_no_403():
    # Regla de negocio: una receta privada no revela ni su existencia a quien no es dueño.
    recipe = _recipe(owner_id=1, is_public=False)
    otro = User(id=2, email="b@b.com", name="B")

    with pytest.raises(HTTPException) as exc:
        _visible_or_404(recipe, user=otro)

    assert exc.value.status_code == 404


def test_receta_privada_es_visible_para_su_dueno():
    recipe = _recipe(owner_id=1, is_public=False)
    dueno = User(id=1, email="a@a.com", name="A")

    resultado = _visible_or_404(recipe, user=dueno)

    assert resultado is recipe


# ---------- _owned_or_403: autorización de escritura ----------

def test_editar_receta_inexistente_da_404():
    dueno = User(id=1, email="a@a.com", name="A")
    with pytest.raises(HTTPException) as exc:
        _owned_or_403(None, dueno)
    assert exc.value.status_code == 404


def test_editar_receta_ajena_da_403():
    recipe = _recipe(owner_id=1, is_public=True)
    otro = User(id=2, email="b@b.com", name="B")

    with pytest.raises(HTTPException) as exc:
        _owned_or_403(recipe, otro)

    assert exc.value.status_code == 403


def test_editar_receta_propia_no_lanza():
    recipe = _recipe(owner_id=1, is_public=True)
    dueno = User(id=1, email="a@a.com", name="A")

    resultado = _owned_or_403(recipe, dueno)

    assert resultado is recipe
