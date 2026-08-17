# ---- Etapa 1: build (instala dependencias) ----
FROM python:3.12-slim AS build
WORKDIR /app

COPY requirements.txt .
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt

# ---- Etapa 2: runtime (sin pip ni cache de instalación) ----
FROM python:3.12-slim AS final
WORKDIR /app

COPY --from=build /install /usr/local
COPY . .

EXPOSE 8000
ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
