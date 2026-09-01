# Recetario

[![CI](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/workflows/ci.yml/badge.svg)](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/workflows/ci.yml)

Aplicación full-stack para guardar, buscar y cocinar recetas propias: recetas públicas y privadas,
escalado automático de ingredientes según las porciones que necesites, y checklist de ingredientes
para cocinar. Proyecto del semestre para Ingeniería del Software 3 (UCC, 2026).

## Stack

- **Backend**: Python + FastAPI + SQLAlchemy
- **Frontend**: React + Vite
- **Base de datos**: PostgreSQL
- **Contenedores**: Docker + Docker Compose

## Arranque con Docker (recomendado)

Requisitos: Docker Desktop instalado y corriendo.

```bash
cp .env.example .env
# opcional: editar .env y poner tus propios valores de DB_PASSWORD / SECRET_KEY
docker compose up -d --build
```

- Frontend: http://localhost:3000
- Backend (API): http://localhost:8000 — health check en http://localhost:8000/health

Para bajar todo conservando los datos: `docker compose down`.
Para bajar todo y borrar también los datos: `docker compose down -v`.

### Levantar usando las imágenes publicadas (sin buildear)

```bash
cp .env.example .env
docker compose -f docker-compose.registry.yml up -d
```

## Desarrollo local sin Docker

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Necesita un Postgres accesible. Por ejemplo, uno suelto en Docker:
docker run -d --name recetario-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=recetario -p 5432:5432 postgres:16-alpine

export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recetario"   # Windows: $env:DATABASE_URL = "..."
export SECRET_KEY="dev-secret"                                                  # Windows: $env:SECRET_KEY = "dev-secret"

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abrí http://localhost:5173 — el proxy de Vite reenvía `/api` al backend en `localhost:8000`.

## Reglas de negocio implementadas

- **Autorización (lectura)**: una receta privada solo la ve su dueño.
- **Autorización (escritura)**: solo el dueño edita/borra su receta.
- **Cálculo**: las cantidades de ingredientes se escalan según las porciones deseadas.
- **Validación + transición de estado**: una receta solo se puede publicar si tiene título, al
  menos un ingrediente, y tiempo de preparación > 0.
- **Restricción**: no se puede borrar un ingrediente del catálogo si está en uso por alguna receta.

## Documentación del proyecto

- `decisiones.md` / `evidencias.md`: historial de decisiones y evidencias, TP a TP.
