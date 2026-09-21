import pytest

from app.models import Ingredient, Recipe, RecipeIngredient
from app.routers.recipes import _build_recipe_out


def _recipe(servings_base, quantities_base):
    recipe = Recipe(id=1, title="Tarta", description="", servings_base=servings_base,
                     prep_time_minutes=30, is_public=True, owner_id=1)
    recipe.ingredient_links = [
        RecipeIngredient(quantity_base=q, ingredient=Ingredient(id=i, name=f"ing{i}", unit="g"))
        for i, q in enumerate(quantities_base)
    ]
    return recipe


@pytest.mark.parametrize(
    "servings_base,servings_requested,cantidad_base,cantidad_esperada",
    [
        (4, 4, 200, 200),      # mismas porciones: no escala
        (4, 8, 200, 400),      # el doble de porciones: el doble de cantidad
        (4, 2, 200, 100),      # la mitad de porciones: la mitad de cantidad
        (3, 1, 100, 33.33),    # no exacto: redondea a 2 decimales
    ],
)
def test_escala_la_cantidad_proporcional_a_las_porciones_pedidas(
    servings_base, servings_requested, cantidad_base, cantidad_esperada
):
    recipe = _recipe(servings_base, [cantidad_base])

    resultado = _build_recipe_out(recipe, servings_requested, user=None)

    assert resultado.ingredients[0].quantity_scaled == cantidad_esperada


def test_no_escala_si_no_hay_ingredientes():
    recipe = _recipe(4, [])

    resultado = _build_recipe_out(recipe, 8, user=None)

    assert resultado.ingredients == []


def test_marca_is_owner_true_cuando_el_usuario_es_el_dueno():
    from app.models import User

    recipe = _recipe(4, [])
    user = User(id=1, email="a@a.com", name="A")

    resultado = _build_recipe_out(recipe, 4, user=user)

    assert resultado.is_owner is True


def test_marca_is_owner_false_para_otro_usuario():
    from app.models import User

    recipe = _recipe(4, [])
    otro = User(id=2, email="b@b.com", name="B")

    resultado = _build_recipe_out(recipe, 4, user=otro)

    assert resultado.is_owner is False
