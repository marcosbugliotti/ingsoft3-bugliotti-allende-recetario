# ---- Etapa 1: build (instala dependencias) ----
FROM python:3.12-slim AS build
WORKDIR /app

COPY requirements.txt .
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt

# ---- Etapa 2: tests (parte de build: mismas dependencias, más las de test) ----
FROM build AS test
RUN cp -a /install/. /usr/local/
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY . .
ENTRYPOINT ["pytest", "--cov", "--cov-fail-under=80", "--cov-report=term-missing", "--cov-report=xml:/out/coverage.xml", "--cov-report=html:/out/htmlcov", "--junitxml=/out/junit.xml"]

# ---- Etapa 3: runtime (sin pip ni cache de instalación) ----
FROM python:3.12-slim AS final
WORKDIR /app

COPY --from=build /install /usr/local
COPY app/ ./app/

EXPOSE 8000
ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
