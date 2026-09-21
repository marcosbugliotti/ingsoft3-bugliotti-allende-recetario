from app.security import create_access_token, decode_access_token, hash_password, verify_password


def test_verify_password_acepta_la_contrasena_correcta():
    hashed = hash_password("mi-contrasena-123")

    assert verify_password("mi-contrasena-123", hashed) is True


def test_verify_password_rechaza_la_contrasena_incorrecta():
    hashed = hash_password("mi-contrasena-123")

    assert verify_password("otra-contrasena", hashed) is False


def test_hash_password_no_guarda_la_contrasena_en_texto_plano():
    hashed = hash_password("mi-contrasena-123")

    assert hashed != "mi-contrasena-123"


def test_decode_access_token_recupera_el_subject_del_token_creado():
    token = create_access_token(subject="42")

    assert decode_access_token(token) == "42"


def test_decode_access_token_rechaza_un_token_invalido():
    assert decode_access_token("esto-no-es-un-jwt-valido") is None
