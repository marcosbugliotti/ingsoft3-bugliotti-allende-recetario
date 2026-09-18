from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.models import Recipe
from app.routers.recipes import _check_title_unique


def test_titulo_duplicado_lanza_400_y_consulta_el_modelo_correcto():
    # `db` es un doble: nada de esto toca una base real.
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = Mock(spec=Recipe)

    with pytest.raises(HTTPException) as exc:
        _check_title_unique(db, owner_id=1, title="Tarta de manzana")

    assert exc.value.status_code == 400
    # Esto es lo que hace que sea un MOCK y no un stub: el assert mira la
    # interacción (qué se le pidió a la dependencia), no solo el resultado.
    db.query.assert_called_once_with(Recipe)


def test_titulo_no_duplicado_no_lanza():
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = None

    _check_title_unique(db, owner_id=1, title="Tarta de manzana")  # no debe lanzar


def test_al_editar_se_excluye_la_propia_receta_de_la_busqueda():
    # exclude_id agrega un segundo .filter(); si no se llama, la receta se
    # compara consigo misma y cualquier edición fallaría por "duplicada".
    db = Mock()
    query = db.query.return_value.filter.return_value
    query.filter.return_value.first.return_value = None

    _check_title_unique(db, owner_id=1, title="Tarta de manzana", exclude_id=5)

    query.filter.assert_called_once()
