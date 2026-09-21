from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.models import User
from app.routers.auth import login, register
from app.schemas import UserCreate, UserLogin
from app.security import hash_password


def test_registrar_con_email_ya_usado_da_409():
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = Mock(spec=User)

    with pytest.raises(HTTPException) as exc:
        register(UserCreate(email="a@a.com", password="12345678", name="A"), db=db)

    assert exc.value.status_code == 409
    db.query.assert_called_once_with(User)


def test_registrar_con_email_libre_guarda_el_hash_no_la_contrasena_plana():
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = None
    creado = {}
    db.add.side_effect = lambda user: creado.setdefault("user", user)

    register(UserCreate(email="nuevo@a.com", password="12345678", name="Nuevo"), db=db)

    assert creado["user"].password_hash != "12345678"
    db.commit.assert_called_once()


@pytest.mark.parametrize(
    "usuario_existe,password_correcta",
    [
        (False, True),   # el email no está registrado
        (True, False),   # el email existe, pero la contraseña no coincide
    ],
)
def test_login_con_credenciales_invalidas_da_401(usuario_existe, password_correcta):
    db = Mock()
    if usuario_existe:
        hash_valido = hash_password("la-correcta")
        db.query.return_value.filter.return_value.first.return_value = User(
            id=1, email="a@a.com", name="A", password_hash=hash_valido
        )
    else:
        db.query.return_value.filter.return_value.first.return_value = None

    with pytest.raises(HTTPException) as exc:
        login(UserLogin(email="a@a.com", password="lo-que-sea"), db=db)

    assert exc.value.status_code == 401


def test_login_con_credenciales_correctas_devuelve_un_token():
    hash_valido = hash_password("la-correcta")
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = User(
        id=1, email="a@a.com", name="A", password_hash=hash_valido
    )

    token = login(UserLogin(email="a@a.com", password="la-correcta"), db=db)

    assert token.access_token
    assert token.token_type == "bearer"
