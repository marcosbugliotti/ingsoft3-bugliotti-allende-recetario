from fastapi import FastAPI

from app.database import Base, engine
from app.routers import auth, ingredients, recipes

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Recetario API")

app.include_router(auth.router)
app.include_router(recipes.router)
app.include_router(ingredients.router)


@app.get("/health")
def health():
    return {"status": "ok"}
