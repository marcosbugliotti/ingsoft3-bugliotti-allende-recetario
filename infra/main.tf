terraform {
  required_version = ">= 1.5"

  required_providers {
    neon = {
      source  = "kislerdm/neon"
      version = "0.18.0" # fijada: el provider la cambia de nombre más adelante, ver decisiones.md
    }
    render = {
      source  = "render-oss/render"
      version = "1.9.1"
    }
  }
}

provider "neon" {}   # lee NEON_API_KEY
provider "render" {} # lee RENDER_API_KEY y RENDER_OWNER_ID

# --- El proyecto de Neon de PREPROD: no existe hasta que esto se aplica ---

resource "neon_project" "preprod" {
  name = "recetario-preprod"

  # 🔴 Divergencia con la guía (no estaba el 21-09-2026): Neon ahora exige org_id al crear
  #    un proyecto. Sin esto el apply falla con "org_id is required". Se saca de la consola:
  #    selector de organización (arriba a la izquierda) → Settings → Org ID.
  org_id = "org-little-hall-52660203"

  # 🔴 SIN esta línea tu PRIMER apply falla. El provider pide por defecto 86400 segundos
  #    (un día) de historial y el tope del plan gratuito es 21600 (seis horas). El error
  #    —"requested history retention seconds exceeds allowed maximum"— no dice qué hacer.
  history_retention_seconds = 21600
}

resource "neon_role" "preprod" {
  project_id = neon_project.preprod.id
  branch_id  = neon_project.preprod.default_branch_id # 🔴 default_branch_id, NO branch_id
  name       = "recetario_preprod_owner"
}

resource "neon_database" "preprod" {
  project_id = neon_project.preprod.id
  branch_id  = neon_project.preprod.default_branch_id
  name       = "recetario_preprod"
  owner_name = neon_role.preprod.name
}

# --- Los dos servicios de PREPROD, corriendo la imagen del TP7 ---

locals {
  # Formato SQLAlchemy/psycopg2 (no el de .NET): se ARMA con lo que devolvió Neon,
  # nadie lo copia y pega. sslmode=require porque Neon lo exige.
  conn = "postgresql://${neon_role.preprod.name}:${neon_role.preprod.password}@${neon_project.preprod.database_host}/${neon_database.preprod.name}?sslmode=require"
}

resource "render_web_service" "api" {
  name   = "recetario-api-preprod"
  plan   = "free"
  region = var.region

  runtime_source = {
    image = {
      image_url = var.image_repo_api # SIN la etiqueta pegada
      tag       = var.image_tag      #    la etiqueta va en su propio campo
    }
  }

  env_vars = {
    DATABASE_URL = { value = local.conn }
    SECRET_KEY   = { value = var.secret_key } # tu auth JWT, no la tiene la guía
  }
}

resource "render_web_service" "front" {
  name   = "recetario-front-preprod"
  plan   = "free"
  region = var.region

  runtime_source = {
    image = {
      image_url = var.image_repo_front
      tag       = var.image_tag
    }
  }

  env_vars = {
    BACKEND_URL  = { value = render_web_service.api.url } # sale de Terraform, no de un copy-paste
    DNS_RESOLVER = { value = "8.8.8.8" }
  }
}