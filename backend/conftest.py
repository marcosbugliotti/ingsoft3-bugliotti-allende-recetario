import os

# Los tests son unitarios: no se conectan a una base real. Se completan estas
# variables antes de importar cualquier módulo de `app`, porque `app.config.Settings`
# las exige y `app.database` crea el engine al importarse.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
