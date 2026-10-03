import os
from urllib.parse import quote

from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html

from app.database import Base, engine
from app.routers import auth, ingredients, recipes

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Recetario API", docs_url=None)

app.include_router(auth.router)
app.include_router(recipes.router)
app.include_router(ingredients.router)

ICONOS_POR_ENTORNO = {"local": "🧑‍🍳", "qa": "🥘", "prod": "🍽️"}


def detectar_entorno() -> str:
    # Render inyecta RENDER_SERVICE_NAME con el nombre del servicio (ej.
    # "recetario-api-qa"); misma convención que detectarEntorno() del front,
    # que lee window.location.hostname en vez de esta variable.
    nombre = os.environ.get("RENDER_SERVICE_NAME", "")
    if "-qa" in nombre:
        return "qa"
    if "-prod" in nombre:
        return "prod"
    return "local"


@app.get("/health")
def health():
    entorno = detectar_entorno()
    return {
        "status": "ok",
        "commit": os.environ.get("RENDER_GIT_COMMIT", "local"),
        "entorno": entorno,
        "icono": ICONOS_POR_ENTORNO[entorno],
    }


@app.get("/api/version")
def version():
    commit = os.environ.get("RENDER_GIT_COMMIT", "local")
    entorno = detectar_entorno()
    return {
        "commit": commit[:7] if commit != "local" else commit,
        "entorno": entorno,
        "icono": ICONOS_POR_ENTORNO[entorno],
    }


@app.get("/docs", include_in_schema=False)
def swagger_ui():
    entorno = detectar_entorno()
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        f'<text y=".9em" font-size="90">{ICONOS_POR_ENTORNO[entorno]}</text></svg>'
    )
    favicon = f"data:image/svg+xml,{quote(svg)}"
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} - Docs",
        swagger_favicon_url=favicon,
    )
