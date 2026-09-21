from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.deps import get_current_user, get_current_user_optional
from app.models import User


def test_sin_token_no_hay_usuario():
    assert get_current_user_optional(token=None, db=Mock()) is None


def test_token_invalido_no_da_usuario():
    db = Mock()
    assert get_current_user_optional(token="token-invalido", db=db) is None
    db.get.assert_not_called()  # ni siquiera va a buscar el usuario


def test_token_valido_busca_y_devuelve_el_usuario():
    from app.security import create_access_token

    db = Mock()
    db.get.return_value = User(id=7, email="a@a.com", name="A")
    token = create_access_token(subject="7")

    resultado = get_current_user_optional(token=token, db=db)

    assert resultado.id == 7
    db.get.assert_called_once_with(User, 7)


def test_get_current_user_sin_usuario_lanza_401():
    with pytest.raises(HTTPException) as exc:
        get_current_user(user=None)

    assert exc.value.status_code == 401


def test_get_current_user_con_usuario_lo_devuelve():
    user = User(id=1, email="a@a.com", name="A")

    assert get_current_user(user=user) is user
