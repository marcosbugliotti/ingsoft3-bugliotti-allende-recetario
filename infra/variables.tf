variable "image_repo_api" {
  default = "ghcr.io/marcosbugliotti/ingsoft3-bugliotti-allende-recetario-backend" # SIN la etiqueta
}

variable "image_repo_front" {
  default = "ghcr.io/marcosbugliotti/ingsoft3-bugliotti-allende-recetario-frontend" # SIN la etiqueta
}

variable "image_tag" {
  default = "sha-8e0c05b8b2f61df405dbcc3d0af250e3d751cba2" # commit del release v7.0.0 (TP7)
}

variable "region" {
  default = "ohio" # frankfurt | ohio | oregon | singapore | virginia — misma región que QA/PROD desde el TP6
}

variable "secret_key" {
  type      = string
  sensitive = true # tu auth JWT la usa para firmar tokens: NO lleva default, sale de un *.tfvars local
}
