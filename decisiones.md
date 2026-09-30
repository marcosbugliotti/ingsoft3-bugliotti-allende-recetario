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

## TP3 -
- **Duración del sprint: 1 semana.** La elegí así porque pienso trabajar en el proyecto sobre todo durante la clase, y un sprint semanal me deja ir poniendo el tablero al día clase a clase en vez de que se acumule desprolijo por varias semanas. Además es el mismo ritmo que uso en otros proyectos donde ya trabajo con sprints semanales, así que me resulta más natural de sostener que inventar una cadencia distinta solo para esta materia.
- **Diagnóstico de la historia mal escrita** (issue #10, *"Como desarrollador quiero crear la tabla usuarios"*): es una **tarea disfrazada de historia**. Describe una solución técnica interna ("crear una tabla"), no una capacidad observable por alguien fuera del equipo — nadie "quiere" que exista una tabla, quiere poder *hacer* algo. Además le falta el "para": sin el beneficio no hay forma de justificar por qué priorizarla frente a otra cosa. Cómo la reescribiría como historia real: *"Como usuario quiero registrarme con email y contraseña para poder guardar mis propias recetas"* — ahí sí hay una capacidad observable (registrarse) y un beneficio (guardar recetas propias); "crear la tabla usuarios" pasaría a ser una de las tareas técnicas *de esa* historia, no la historia en sí. El otro anti-patrón típico que menciona el video y que no es este caso, pero vale tenerlo enfrente para no confundirlo: la historia que en realidad es demasiado grande (dura semanas, no días) — esa no está mal escrita, está mal *dimensionada*, y lo que corresponde es partirla o subirla de nivel a épica.
- **Límite de trabajo en progreso: 2.** La regla de arranque es "cantidad de personas + 1" — trabajando solo, eso da 2. Lo dejo justo en el mínimo porque el límite tiene que generar **incomodidad**: no es un candado de la herramienta (GitHub no te impide pasarte, solo pone el contador en rojo), es un acuerdo que fuerza a cerrar algo antes de abrir otra cosa. Cuanto más chico, más seguido lo voy a sentir; si lo pongo muy alto nunca lo voy a alcanzar y deja de cumplir su función. El "+1" sobre trabajar en una sola tarea a la vez es la válvula para cuando algo queda esperando (una revisión, una respuesta) y necesito poder avanzar en otra cosa sin romper el límite.

### Problemas encontrados y cómo los resolví
- **Los comandos de la guía están escritos para bash, y yo trabajo en PowerShell.** La guía usa `\` al final de línea para continuar un comando multilínea (sintaxis de bash); en PowerShell eso no es continuación de línea, así que el primer `gh issue create` con `--label`/`--body` en líneas separadas se cortó: la épica se creó sin label ni body, y la historia se creó con el label bien pero el body truncado a la primera línea (perdió los criterios de aceptación). Lo detecté revisando el issue recién creado con `gh issue view`. Se resolvió reescribiendo esos comandos en una sola línea y corrigiendo los issues ya mal creados con `gh issue edit --body`.
- **Vincular sub-issues por la web, mal.** Al intentar colgar las tareas de la historia desde la web, usé el cuadro de texto del botón "Create sub-issue" escribiendo el número (`#11`) en vez del buscador "Add existing issue" — eso generó una simple mención cruzada (aparece como "mentioned this in"), no la relación padre-hijo real. Lo detecté porque `gh issue view 9` mostraba los campos `parent`/`sub-issues` vacíos pese a la mención visible en la web. Se resolvió vinculando por terminal con `gh issue edit <padre> --add-sub-issue <hijo>`, que si arma la relación navegable.

### Declaración de uso de IA
Usé Claude Code durante todo este TP, guiándome paso a paso en vez de que hiciera el trabajo por mí — se lo pedí explícitamente así. Su rol fue:
- Revisar el estado real de mi repo con `gh` (labels, issues, jerarquía de sub-issues, PR, Project) después de cada paso que yo ejecutaba, y avisarme cuando algo había quedado mal armado (el body cortado de la historia, las tareas sin vincular a la historia) — sin corregirlo por mí sin que yo lo pidiera primero.
- Diagnosticar y resolver los dos problemas técnicos de arriba ( incompatibilidad bash/PowerShell, mención cruzada vs. sub-issue real), explicándome la causa de cada uno.
Verifiqué cada corrección volviendo a pedirle que releyera el estado con `gh issue view` / `gh project view` y comparando contra lo que esperaba según la guía del TP.

### Revisión final — estado del TP3 al cierre
Chequeo hecho contra la lista de entregables de la consigna, verificando cada ítem con `gh` (no solo mirándolo en la web):

- **Repositorio público**: `github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario` — confirmado con `gh repo view --json visibility`.
- **Project público**: `github.com/users/marcosbugliotti/projects/1` ("ing de soft 3 projecto") — confirmado con `gh project view`, 6 items cargados.
- **Jerarquía navegable**: épica #8 → historia #9 → tareas #11 y #12, confirmada con los campos `parent`/`sub-issues` de `gh issue view` (no una simple mención cruzada).
- **Bug #13**: suelto, sin parent, con qué pasa / qué esperaba / cómo reproducir.
- **Sprint**: "Sprint 1", 21 al 27 de agosto (7 días = 1 semana), con la historia #9 y sus dos tareas (#11, #12) asignadas — verificado en el campo `sprint` de cada item del Project.
- **Board + automatización**: el workflow "cerrar → Done" está probado en vivo, no solo activado: al mergear el PR #14 la tarea #11 pasó sola a `Done` sin tocarla a mano.
- **Límite de trabajo en progreso = 2** en la columna *In Progress* del Board — configurado en la vista (no verificable por API/CLI, confirmado visualmente).
- **Trazabilidad PR → issue**: PR #14 mergeado, `Closes #11` en la descripción, cerró la tarea automáticamente y el enlace queda visible en el historial del issue.
- **`decisiones.md`**: las 5 cosas pedidas están — duración del sprint y por qué, límite de WIP y por qué, diagnóstico de la historia mal escrita, problemas encontrados, declaración de uso de IA.

## TP4 — CI: Pipelines as Code

- **Dos jobs, `build-backend` y `build-frontend`, en paralelo.** Uno por cada Dockerfile que ya tenía del TP2 (`backend/Dockerfile`, `frontend/Dockerfile`) — no inventé un job por stack, sino uno por artefacto que se construye de forma independiente. Van en paralelo porque no dependen entre sí: nada del build del backend afecta al del frontend, así que no tiene sentido serializarlos y hacer esperar uno al otro. Cada uno corre en su propio runner limpio, sin filesystem compartido.
- **El pipeline construye con mi Dockerfile, no compila por su cuenta.** Si el workflow tuviera sus propios pasos (`pip install`, `npm run build`) por fuera del Dockerfile, tendría dos definiciones de cómo se arma la app: una que verifica el pipeline y otra que uso para desplegar — y esas dos divergen tarde o temprano. Usando el mismo Dockerfile para las dos cosas, lo que el pipeline valida es exactamente lo que después se despliega.
- **Qué cachea mi pipeline**: las capas de Docker que instalan dependencias — `RUN pip install -r requirements.txt` en el backend y `RUN npm ci` en el frontend — porque son las que no cambian salvo que yo toque `requirements.txt` o `package.json`. Usé `cache-from`/`cache-to: type=gha` con un `scope` distinto por job (`scope=backend`, `scope=frontend`); sin eso, los dos jobs comparten el mismo estante de cache por default y se pisan entre sí. Verifiqué que funciona buscando la palabra `CACHED` en el log de una segunda corrida sobre la misma rama, no midiendo el tiempo (la propia guía explica por qué el cronómetro no sirve de evidencia con una app de este tamaño).
- **Qué pasa si el cache desaparece**: nada roto — el pipeline vuelve a instalar las dependencias desde cero, solo que más lento. El cache es una optimización, no una dependencia: si mi pipeline fallara sin él, sería señal de que tenía una dependencia escondida en vez de un cache.
- **El gate**: agregué `build-backend` y `build-frontend` como `required_status_checks` sobre `main`, con `strict: true` (rama tiene que estar actualizada) y manteniendo `approvals: 0` y `enforce_admins: true` del TP1 — se lo agregué a la protección existente, no la reescribí desde cero, para no perder lo que ya tenía configurado.
- **Agregué el cache primero al frontend, y solo después de confirmar que funcionaba (`CACHED` en el log) lo repliqué al backend**, en vez de escribir el cache en los dos jobs a la vez. Preferí validar la técnica en un solo job antes de duplicarla: si algo hubiera estado mal configurado, prefería encontrarlo y corregirlo en un solo lugar en vez de depurar dos jobs simultáneamente con el mismo error.

### Problemas encontrados y cómo los resolví
- **Las dos corridas para ver el cache se solaparon la primera vez.** Hice el commit del cambio y, antes de pushearlo, ya había hecho también el commit vacío de la "segunda corrida" — los dos quedaron sin subir. Si los pusheaba juntos, iban a llegar en un solo push y disparar una sola corrida, no dos, perdiendo la comparación. Lo resolví con `git reset --hard HEAD~1` para sacar el commit vacío, pusheando primero el cambio real, esperando a que esa corrida terminara del todo (el cache se sube recién al final), y recién ahí haciendo el commit vacío y el segundo push.


### Declaración de uso de IA
Usé Claude Code guiándome paso a paso sobre la guía del TP, adaptada a mi stack (Python/FastAPI + Node/Vite, no el .NET de los ejemplos). Su rol concreto:
- Revisar mis logs de GitHub Actions con `gh run view --log` para confirmar si el cache realmente se estaba reutilizando (buscando la palabra `CACHED`), en vez de que yo mirara solo el tilde verde
- Verificar el estado real de la protección de rama con `gh api .../branches/main/protection` antes y después de tocarla, para confirmar que no perdí la configuración del TP1.
Verifiqué cada corrección volviendo a pedirle que releyera el log o la protección después de cada cambio, en vez de asumir que había quedado bien.

## TP5 — Testing y calidad

> Esta sección se va completando a medida que avanza el TP, no de una sola vez al final.

### Qué se testeó y por qué (Tarea 1)

Elegí testear las reglas de negocio reales de `recipes.py`, `ingredients.py`, `security.py` y `auth.py` — no los endpoints CRUD completos. La razón: un endpoint como `create_recipe` o `list_ingredients` sólo arma una consulta de SQLAlchemy y delega a funciones que ya están probadas una por una (`_build_recipe_out`, `_visible_or_404`, `_owned_or_403`, `_check_title_unique`, `_sync_ingredients`). Cubrir el endpoint completo mockeando toda la cadena del ORM (`.query().filter().join().all()`) no verifica que el query esté bien armado — el mock devuelve lo que yo le diga, así que sería "cobertura sin verificación". Probarlos de verdad requiere una base real, que es un test de integración: lo dejo para el TP7.

Ejemplo concreto de una regla elegida por dónde duele un bug: la validación de `ingredient_id` en `_sync_ingredients` (`recipes.py:66-78`). No es sólo defensiva contra un `id` inventado: en la app hay una condición de carrera real — `delete_ingredient` sólo bloquea el borrado si el ingrediente ya está linkeado a una receta **guardada**; si tenés una edición sin guardar con un ingrediente que otra persona borra mientras tanto, al guardar tu receta el backend tiene que frenar con 400 en vez de guardar una referencia rota.

### Coverage: qué entra en la cuenta y qué no

Backend, en `backend/.coveragerc`. Queda afuera:
- `app/main.py`: arranque — wiring de FastAPI, `include_router`, sin ninguna regla de negocio.
- `app/database.py`: creación del engine y la sesión — plomería de conexión, sin reglas.
- `app/models.py`: clases de datos de SQLAlchemy — sólo columnas y relaciones, sin comportamiento.
- `app/config.py`: lectura de variables de entorno — sin reglas.

Lo que **no** excluí, a propósito: los 6 endpoints CRUD de `recipes.py` e `ingredients.py` siguen contando en la cuenta aunque no tengan tests directos. Si los excluyera, el número dejaría de reflejar que esa parte del código no está verificada — sería "esconder lo que no testeé" en vez de "medir lo que importa" (la distinción que hace la propia guía).

**Números reales medidos** (44 tests, con las exclusiones de arriba): 84,1% de línea, **79,2% de rama**, 83% combinado. La rama va bastante más atrás que la línea porque mide caminos de `if`, no sólo si la línea se ejecutó una vez.

**Ejemplo propio de por qué coverage alto no garantiza calidad**: antes de excluir `models.py` y `config.py`, esos dos archivos figuraban al 98% y 100% de cobertura — no porque alguien haya escrito un test que verifique sus reglas, sino porque cualquier test que crea un `Recipe(...)` o que importa la app "toca" esas líneas de paso. `models.py` no tiene ninguna regla (son columnas), así que ese 98% no decía nada sobre la calidad de la app; sólo inflaba el número total y tapaba que `recipes.py` (donde sí hay reglas) estaba al 66%.

**Umbral elegido: 80%**, sobre la métrica combinada (línea + rama). Con la medición real en 83%, deja margen para que una línea nueva sin tests lo rompa sin que cualquier cambio mínimo lo haga caer. Para subirlo haría falta testear los 6 endpoints CRUD que hoy quedan afuera, y eso implica la decisión de arriba: o se hace con integración real (TP7), o no cuenta como verificación genuina.

**Por qué combinada y no línea y rama por separado.** La guía del ejemplo en .NET (coverlet) puede exigir las dos métricas por separado y frenar por la que quede más corta (`ThresholdType=line%2cbranch`) — es lo mismo que hace `thresholds: { lines, branches }` en vitest, que usamos en el frontend. `coverage.py`/`pytest-cov`, la herramienta de Python, no tiene ese modo: `--cov-fail-under` sólo puede compararse contra un único número, que quedó verificado empíricamente que es el combinado (probé `--cov-fail-under=84`, que está entre mi línea real de 84,1% y mi rama real de 79,2%, y falló mostrando "Total coverage: 83.28%" — o sea que evalúa la mezcla, no la línea sola). Replicar el comportamiento de coverlet/vitest exigiría un script propio que lea `coverage.xml` y compare línea y rama cada una contra su umbral, algo que no viene con la herramienta y que no agrega verificación real sobre lo que ya hace `--cov-fail-under`.

Hay además un motivo práctico para no separarlas: mi rama hoy da 79,2%, por debajo de 80. Si el umbral exigiera "80% de rama" de forma independiente, el pipeline fallaría **hoy mismo, sin que se toque nada** — no por código nuevo sin tests, sino porque la métrica de rama arrancó más floja que la de línea. Eso rompería la demo del §3.5, que necesita que el freno se active recién cuando entra código nuevo sin cubrir. La combinada evita ese falso negativo y sigue siendo una medida honesta, porque mezcla ambas métricas en vez de ignorar la de rama.

### El ejercicio de la rama sin cubierta

- **Qué línea es**: `backend/app/routers/ingredients.py:15`, el `if search:` de `list_ingredients`.
  ```python
  def list_ingredients(search: str = "", db: Session = Depends(get_db)):
      query = db.query(Ingredient)
      if search:                                          # ← la rama sin cubrir
          query = query.filter(Ingredient.name.ilike(f"%{search}%"))
      return query.order_by(Ingredient.name).all()
  ```
  Ningún test llama a esta función, así que ninguno de los dos caminos del `if` se ejecuta nunca.
- **Qué entrada la recorrería**: `search="harina"` recorre el camino verdadero (agrega el filtro); `search=""` (el valor por default) recorre el camino falso.
- **Qué decidí**: no agregar el test. Es uno de los endpoints CRUD que decidí no cubrir (ver arriba): para probarlo de verdad haría falta mockear toda la cadena de SQLAlchemy, y eso no verificaría que el `ilike` funcione — sólo que el mock devuelve lo que le dije. Se prueba mejor con una base real en el TP7.

### Coverage del frontend: qué entra en la cuenta, y por qué es distinto del backend

En `frontend/vite.config.js` uso `include: ['src/lib/**']`, no `omit`. Es la estrategia opuesta a la del backend, y no es antojo — depende de por qué cada parte quedó sin testear:

- **Los endpoints CRUD del backend** los podría testear con las herramientas que ya tengo (`pytest` + `Mock`) — elegí no hacerlo porque mockear toda la cadena de SQLAlchemy no verifica nada real (la misma trampa del §2.4 de la guía). Es una decisión de calidad, no de falta de herramienta, así que los dejo **adentro** de la cuenta: el número tiene que reflejar esa deuda.
- **Las pantallas del frontend** (`RecipeDetailPage.jsx`, `LoginPage.jsx`, etc.) no las puedo testear con lo que instalé este TP — hace falta `jsdom` + Testing Library, que la guía dice explícito que es *"opcional avanzado, no lo exige el TP"* (esa capa se prueba con e2e recién en el TP7). No es que decida no probarlas por comodidad: la herramienta para hacerlo no está en el alcance de esta materia todavía. Por eso las dejo **afuera** de la cuenta con `include`, en vez de contarlas "en rojo" por algo que no me corresponde resolver ahora.

Con `include: ['src/lib/**']` mido 100% de línea, rama y funciones sobre `src/lib/recipes.js` (46 líneas, 18 ramas) — el único archivo con lógica propia, extraído de `RecipeDetailPage.jsx` en el PR #116. No es un número inflado: es real y motivado, porque el `include` acota la medición a la única carpeta que el TP me pide testear con unit tests.

**Aclaración para que el número no se lea mal en la defensa**: que el front dé 100% y el back 83% no significa que el frontend esté "mejor probado" — significa que miden porciones distintas del código. Si el backend excluyera del mismo modo su capa de orquestación sin testear, también daría un número altísimo. La lógica de negocio en sí también pesa distinto: el backend es la autoridad real (JWT, contraseñas, autorización, integridad de datos); `src/lib/` del frontend es más liviano en responsabilidad (repite el cálculo de escalado para feedback instantáneo, valida el formulario para UX, arma el payload) — el backend vuelve a validar todo lo que importa de verdad.

### Umbral del frontend

**Elegido: 95%**, sobre línea, rama y funciones, cada una evaluada por separado (a diferencia del backend, acá `vitest` sí soporta umbrales independientes por métrica: `thresholds: { lines: 95, branches: 95, functions: 95 }`).

No elegí 100% aunque la medición real de hoy sea 100/100/100. La razón: `src/lib/` es la carpeta que armé a propósito para separar lógica testeable de UI — la regla que quiero sostener de acá en adelante es "todo lo que entra a esta carpeta tiene que estar probado", no "hoy toca dar exacto 100". El 95% conserva prácticamente todo el rigor (con el ejemplo de abajo, agregar ~4 líneas y 1 `if` sin test hace caer la cobertura a ~90-92%, por debajo de 95 igual) y deja un colchón mínimo para algún caso borde legítimamente difícil de cubrir el día de mañana, sin ser tan laxo como para dejar pasar código nuevo sin ningún test.

### Un bug real encontrado al verificar que el umbral rompe de verdad

Antes de dar el umbral del backend por cerrado, no me alcanzó con que `--cov-fail-under=80` "pasara" con la medición de hoy — probé que **rompiera** de verdad subiéndolo artificialmente a 90% (contra una cobertura real de 83%) y revisando el *exit code* del proceso, no sólo el texto que imprime.

Encontré que con `coverage==7.16.2` (la versión que `pip` resolvía por default, porque no la tenía fijada), `pytest` imprimía `FAIL Required test coverage of 90% not reached` — pero terminaba con **exit code 0**. Es decir: el mensaje decía que había fallado, pero el proceso le informaba al sistema que todo había salido bien. Como el `docker run` del pipeline sólo mira el exit code, no el texto, **el pipeline nunca se hubiera puesto rojo por cobertura baja, aunque el número fuera pésimo** — un freno de mentira.

Fijé `coverage==7.16.1` en `requirements-dev.txt` (la versión que sí tenía instalada en mi máquina, y que confirmé que propaga el exit code correcto) y repetí la misma prueba: exit code 1, como corresponde. Verifiqué la corrección en Docker local antes de subirla, y después otra vez en la corrida real de GitHub Actions.

**La lección, más allá del bug puntual**: un umbral que "parece" funcionar porque el texto dice `FAIL` no sirve de nada si el exit code no lo acompaña — hay que probar el mecanismo completo (número → exit code → paso de CI en rojo → merge bloqueado), no confiar en que un mensaje en pantalla implica que el resto de la cadena funciona.

### El gate bloqueando un merge (Tarea 3, §3.5)

Dos Pull Requests distintos, no dos commits del mismo — la guía marca esto en rojo como el error más común de esta parte: uno cuenta la historia completa y se mergea, el otro queda abierto y en rojo como prueba viva de que el freno funciona (la config de *required checks* sólo la ve quien administra el repo; un PR frenado lo puede comprobar cualquiera).

**PR 1 — frontend, `scaleIngredients` (mergeado): [#119](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/pull/119)**

`scaleIngredients` no validaba `servingsBase`/`servingsRequested`: con `0` daba `Infinity` (división por cero), con negativos daba cantidades negativas — ningún `if` lo manejaba, así que ningún test lo detectaba. Es el mismo ejemplo que uso arriba para "por qué coverage alto no garantiza calidad", ahora convertido en la demo del gate.

- Commit 1 (`fix`): agrega la validación **sin test**. Compiló bien, los 15 tests existentes siguieron pasando, pero la cobertura de rama cayó a 94,73% (umbral: 95%) → corrida roja: [`actions/runs/36615407738/job/109567025140`](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/runs/36615407738/job/109567025140) — `ERROR: Coverage for branches (94.73%) does not meet global threshold (95%)`.
- Commit 2 (`test`): agrega el `it.each` con los 4 casos inválidos que faltaban (porciones base y pedidas, en 0 y negativas). Cobertura de vuelta a 100% → corrida verde: [`actions/runs/36616134919/job/109569488786`](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/runs/36616134919/job/109569488786) — 19 tests, 100% en las tres métricas.
- Mergeado a `main`.

**PR 2 — backend, validaciones de recetas (abierto, queda en rojo hasta la defensa): [#120](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/pull/120)**

Seis reglas reales que faltaban al crear/editar una receta (la más importante: `_sync_ingredients` no rechazaba ingredientes repetidos — antes de esto, mandar el mismo `ingredient_id` dos veces terminaba en un `IntegrityError` sin manejar al hacer `commit`, porque `recipe_ingredients` tiene `(recipe_id, ingredient_id)` como clave primaria compuesta; también límites de cantidad de ingredientes, cantidad por ingrediente, largo de título, no volver a publicar una receta ya pública, y despublicar sola una receta que una edición deja inválida). Ninguna tiene test, a propósito.

El backend tiene más margen que el frontend (umbral 80% contra una medición real de 83%): una sola validación chica sólo movía el número ~0,4 puntos por vez, así que hizo falta juntar las seis para cruzar el umbral — de 83,28% a **79,09%**. Corrida roja real: [`actions/runs/36628922175/job/109612895321`](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/runs/36628922175/job/109612895321) — `FAIL Required test coverage of 80% not reached. Total coverage: 79.09%`, 44 tests pasaron igual.

Este PR se queda así — sin segundo commit, sin mergear — hasta la defensa.

### Declaración de uso de IA

Usé Claude Code como asistente durante todo el TP, siguiendo los pasos de la guía en el orden en que están (§3.0 a §3.5), adaptados a mi stack real (Python/FastAPI + pytest, React/Vite + vitest — no el .NET/xUnit/Moq/coverlet de los ejemplos, ni el vitest tal cual lo escribe la guía). Su rol concreto:

- Escribir la implementación de los tests, backend y frontend, a partir de las reglas de negocio que yo le señalaba de mi propia app, siguiendo AAA y las tres técnicas que pide la Tarea 1 (parametrizado, caso de error, mock).
- Traducir cada paso de la guía a los equivalentes reales de mi stack — `pytest-cov` en vez de `coverlet`, un script de `xml.etree` en vez de `ReportGenerator`, `unittest.mock` en vez de `Moq` — y explicarme en qué casos la traducción es literal y en cuáles cambia el mecanismo (por ejemplo, por qué mi umbral queda consolidado en un solo `ENTRYPOINT` del Dockerfile, en vez de partido entre el Dockerfile y el `docker run` como hace `coverlet` en .NET).

Las decisiones fueron mías: qué reglas testear y por qué, los dos umbrales (80% backend, 95% frontend) y su justificación, qué queda afuera de la cuenta de cobertura, y el contenido de los dos PR de la demo del gate. Seguí el orden de la guía sección por sección (§3.1 → §3.2 → §3.3 → §3.4 → §3.5), sin saltear ningún paso ni dar por bueno un resultado sin verlo confirmado en una corrida real.
