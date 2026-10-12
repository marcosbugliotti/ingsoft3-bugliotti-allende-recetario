variable "image_repo_api" {
  default = "ghcr.io/marcosbugliotti/ingsoft3-bugliotti-allende-recetario-backend" # SIN la etiqueta
}

variable "image_repo_front" {
  default = "ghcr.io/marcosbugliotti/ingsoft3-bugliotti-allende-recetario-frontend" # SIN la etiqueta
}

variable "image_tag" {
  default = "sha-54a12b9fe8be2ebbf51a145cc731f9d4164976c4" # merge del PR de infra/ + footer de preprod (TP8)
}

variable "region" {
  default = "ohio" # frankfurt | ohio | oregon | singapore | virginia — misma región que QA/PROD desde el TP6
}

variable "secret_key" {
  type      = string
  sensitive = true # tu auth JWT la usa para firmar tokens: NO lleva default, sale de un *.tfvars local
}
