# Decisiones — TP1

## 1. Por qué Git no pudo resolver el conflicto solo
Las ramas `feature/titulo-a` y `feature/titulo-b` nacieron las dos de `main` y modificaron **la
misma línea** del README (la primera) con contenido distinto: "versión A" en una, "versión B" en
la otra. Git fusiona automáticamente cuando dos ramas tocan líneas distintas, pero cuando ambas
tocan la misma línea no tiene ninguna forma de saber cuál es la versión "correcta" — es una
decisión de contenido, no algo que se pueda resolver con una regla técnica. Por eso, al mergear
primero el PR de A y después intentar el de B, GitHub avisó que no podía mergear automáticamente
y me lo delegó a mí: tuve que abrir el archivo, ver los marcadores `<<<<<<<` / `=======` /
`>>>>>>>` y decidir manualmente qué quedaba.

Para que nunca hubiera aparecido, alguna de las dos ramas tendría que haber nacido **después** de
que la otra ya estuviera mergeada en `main` (así heredaría el cambio en vez de competir con él), o
directamente no tocar la misma línea.

## 2. Qué problemas encontré y cómo los solucioné
- Al activar "Require a pull request" GitHub tildó solo "Require approvals" en 1, tuve que
  destildarlo a mano porque siendo autor único nunca puedo aprobar mi propio PR.
- En el primer PR (sección de instalación) usé "Merge pull request" (merge común) en vez de
  "Squash and merge" que pedía la guía. Quedó un commit de merge con dos padres en vez de un solo
  commit limpio sobre `main`. Para los PRs siguientes usé squash como corresponde.
- Al probar el push directo a `main`, VS Code mostró un mensaje genérico ("Can't push refs to
  remote. Try running Pull first") que no explicaba el motivo real. Tuve que abrir "Show Command
  Output" para ver el error verdadero de GitHub (`GH006: Protected branch update failed`,
  `protected branch hook declined`), que es la evidencia real de que la protección funciona.
- Resolví el conflicto de la rama B en VS Code en vez del editor web (`git fetch` + `git merge
  origin/main` sobre la rama, edición manual de los marcadores, commit y push). El resultado es
  el mismo que resolverlo en la web, solo cambia la herramienta.
- Traté de pushear un tag desde la terminal integrada de WSL (Ubuntu) y falló con "Password
  authentication is not supported": esa terminal usa un Git distinto al de Windows, con su propio
  almacén de credenciales, y nunca la autentiqué contra GitHub. Lo resolví pusheando desde el Git
  de Windows (ya autenticado con `gh auth login`).
- Terminé creando el tag `v1.0.0` dos veces por error de tipeo (quedó también un `v1.0.0-` con un
  guión de más). Borré el tag repetido localmente (`git tag -d`) y en el remoto
  (`git push origin --delete v1.0.0-`) antes de publicar la release, para que quedara uno solo.

## 3. Declaración de uso de IA
Usé Claude Code como consulta cuando los comandos en la terminal o en VS Code no respondían como
esperaba (por ejemplo, errores de autenticación, el push rechazado por la protección de rama, o
tags duplicados). Verifiqué cada solución revisando yo mismo el resultado en GitHub y en la
terminal antes de seguir.

## TP2 — Contenedores

### 1. Elección de la app del semestre
Contra los criterios de la guía (§3.3):
- **¿Corre localmente hoy?** Sí: backend FastAPI + frontend React + PostgreSQL, sin dependencias externas raras (nada de colas, cache, ni APIs pagas de terceros).
- **¿Tiene reglas de negocio testeables?** Sí, 5 reglas cubriendo los 5 tipos que pide la cátedra:
  autorización de lectura, autorización de escritura, cálculo (escalado de porciones), validación + transición de estado (publicar una receta), y restricción (no borrar un ingrediente en uso).
  Detalle en el `README.md`.
- **¿La entiendo lo suficiente para modificarla en vivo?** Sí
- **Tamaño**: 3 pantallas (login/registro, listado + buscador, detalle/crear/editar receta) y 9 endpoints — dentro de lo que sugiere la guía ("2-3 pantallas alcanzan").

Elegí un recetario porque el dominio da reglas de negocio reales de forma natural (privacidad de recetas, escalado de porciones, restricción de borrado de ingredientes en uso) sin necesitar nada externo. 

### 2. Decisiones de contenerización
- **Imágenes base**: `python:3.12-slim` para el backend (build y runtime), `node:22-alpine` para buildear el frontend y `nginx:alpine` para servirlo.
- **Backend multi-stage**: la etapa `build` instala las dependencias con `pip install --prefix=/install`; la etapa final solo copia ese directorio más el código, sin `pip` ni el cache de instalación. Python no compila binarios en este proyecto (no hace falta `gcc`: `psycopg2-binary` ya viene precompilado), pero igual separar build de runtime evita dejar herramientas de instalación en la imagen final.
- **Frontend multi-stage**: se buildea con Node (`npm ci` + `npm run build`) y se sirve con nginx — el SDK/tooling de Node no viaja a producción.
- **Qué persiste**: solo los datos de PostgreSQL, en el volumen nombrado `db_data`. Los contenedores de backend y frontend son descartables y se reconstruyen desde cero en cada deploy.
- **Comunicación por nombre**: el backend se conecta a `db:5432` (no a `localhost`, que dentro del contenedor sería el contenedor mismo). El frontend corre en el browser del usuario, así que no puede resolver `backend` directamente — por eso nginx hace de proxy en `/api/` hacia `http://backend:8000` dentro de la red interna de compose (mismo origen para el browser, sin necesidad de CORS).
- **`depends_on` + `healthcheck`**: el backend espera a que PostgreSQL esté `healthy` (`pg_isready`), no solo "arrancado" — `depends_on` solo garantiza orden de arranque, no que el servicio ya acepte conexiones.
- **Secretos**: `DB_PASSWORD` y `SECRET_KEY` viven en `.env` (no versionado, está en `.gitignore`), con `.env.example` como plantilla commiteada.

### 3. Problemas encontrados y cómo se resolvieron
- `passlib` 1.7.4 resultó incompatible con las versiones nuevas de `bcrypt` (4.1+): rompía el hash de contraseñas incluso con contraseñas cortas (`password cannot be longer than 72 bytes`). Se detectó corriendo un smoke test funcional del backend antes de dockerizar. Se resolvió pineando `bcrypt==4.0.1` explícitamente en `requirements.txt`.
- Corriendo `docker compose up` desde la terminal de WSL (Ubuntu) dio `permission denied while trying to connect to the docker API at unix:///var/run/docker.sock`.
  No era que Docker Desktop estuviera apagado (el motor respondía bien desde Windows): la integración WSL↔Docker Desktop no estaba activa para esa distro. Se resolvió cambiando el perfil de terminal por defecto de VS Code de `Ubuntu (WSL)` a `PowerShell` (`terminal.integrated.defaultProfile.windows`) — con PowerShell, al hablar directo con el Docker Desktop de Windows, el problema desaparece.
- El primer `docker compose up -d --build` mostró varios pasos como `CACHED` — no es un error: Docker reutiliza capas de un build anterior si `requirements.txt`/`package.json`/el código no cambiaron. Para una captura de "arranque desde cero" más representativa se forzó un build sin cache con `docker compose down --rmi local` + `docker builder prune -af` antes de repetir el `up --build`.
- Al pedir `docker images` para comparar tamaños, `python:3.12-slim` y `node:22-alpine` no aparecían listadas sueltas pese a haberse usado en el build: los builds nuevos (`bake`, ver los logs con `#1 [internal] load local bake definitions`) usan un cache de build separado del almacén clásico de imágenes para las bases que solo se usan dentro de un multi-stage. Se resolvió bajándolas explícitamente con `docker pull python:3.12-slim` y `docker pull node:22-alpine` antes de comparar.

### 4. Declaración de uso de IA
Usé Claude Code durante todo este TP, con un rol distinto en cada etapa:

- **Antes de elegir la app**, lo usé para analizar junto con la IA si la idea de un recetario (recetas propias públicas/privadas, buscador, escalado de porciones) encajaba con lo que pide la materia o si me estaba yendo de scope — comparamos la idea contra los criterios de `elegir-app.md` (tamaño, reglas de negocio testeables, dependencias externas) antes de
  decidirme.
- Con la app ya elegida, armamos juntos un **plan de qué incluir y qué dejar afuera** (entidades, pantallas, las 5 reglas de negocio) antes de tocar una línea de código, para no terminar con una app más grande de lo que conviene para la materia.
- Con ese plan acordado, **fuimos armando el backend y el frontend en conjunto**: yo iba revisando y probando cada parte a medida que la escribíamos, en vez de aceptar todo de una — smoke test funcional del backend (registro/login, privacidad de recetas, escalado de porciones, publicación con validación, búsqueda por ingrediente, restricción de borrado de ingrediente en
  uso, autorización de escritura entre usuarios distintos, todo contra una base SQLite temporal con `TestClient` de FastAPI), y `npm run build` + `npm run preview` del frontend.
- En los **archivos de Docker** (Dockerfiles, `docker-compose.yml`, `nginx.conf`) el rol fue distinto: la IA me asistió a escribirlos y ajustarlos, siguiendo de cerca la guía del TP para no perderme ningún requisito puntual que pedía el profesor (multi-stage, `healthcheck`, secretos por `.env`, etc.).
- Durante todo el proceso de levantar Docker de verdad, también la usé para que me ayudara a **entender los errores** que me iban apareciendo (el `permission denied` de WSL, por qué salían pasos `CACHED`, por qué no aparecían las imágenes base en `docker images`) — entendiendo la causa de cada uno, no solo pegando la solución. El detalle de cada verificación real (`docker compose up`, `ps`, prueba de persistencia, comparación de tamaños, publicación en ghcr.io) está en `evidencias.md`, con capturas.

