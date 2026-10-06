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

## TP6 — CD: environments, aprobaciones y deployment patterns

### Enlaces de este TP

- **Paquetes públicos** (descargables sin credenciales):
  [`-backend`](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/pkgs/container/ingsoft3-bugliotti-allende-recetario-backend) ·
  [`-frontend`](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/pkgs/container/ingsoft3-bugliotti-allende-recetario-frontend)
- **La cadena del §3.0**:
  1. [Corrida de un PR](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/runs/37131487068/job/111227321145) con los tests en verde y el paso "Entrar al registry" **salteado** (evento `pull_request`, no publica).
  2. [Corrida de `main`](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/runs/36805359201/job/110188368120) donde "Construir y publicar la imagen del backend" es el **último** paso del job, después de los tests.
- **URLs vivas**: QA — [api](https://recetario-api-qa.onrender.com) · [front](https://recetario-front-qa.onrender.com). PROD — [api](https://recetario-api-prod.onrender.com) · [front](https://recetario-front-prod.onrender.com).
- **El gate humano, las dos corridas**: [rechazo](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/runs/37136413028) con motivo · [aprobación](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/runs/37138121841) con el flujo completo QA→PROD.

### 1. Por qué el artefacto se publica solo con la verificación en verde

La garantía no sale de un control nuevo: sale de encadenar tres cosas que ya tenía del TP4/TP5. Nada entra a `main` sin el pipeline en verde (el gate del TP4 más el umbral de cobertura del TP5). Solo lo que entra a `main` publica (`push: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}` en los dos jobs de build). Y el paso que publica es el **último** del mismo job que corrió los tests — si algo falla antes, el job muere y ese paso nunca llega a correr. Lo verifiqué de las dos formas que pide la Tarea 1 y no de una sola: con una corrida de PR donde el login al registry queda salteado (prueba el segundo eslabón), y con el orden real de los pasos de una corrida de `main` (prueba el tercero, que es el que realmente distingue un pipeline bien armado de uno que publica antes de testear).

Si se publicara igual cuando los tests fallan, "está en ghcr.io" dejaría de significar "esto pasó la verificación" — el registry pasaría a ser un depósito de lo que alguna vez se construyó, no de lo que se puede confiar en desplegar.

### 2. Continuous Delivery, no Continuous Deployment

Implementé Continuous Delivery: todo cambio verificado llega automáticamente hasta QA, pero a PROD no llega solo — hace falta mi aprobación manual explícita. Me corresponde a este contexto por dos motivos. Primero, de madurez: tengo 44 tests de backend y 19 de frontend cubriendo reglas de negocio, pero ni e2e ni monitoreo todavía (eso es TP7/TP9) — sin esa red de seguridad completa, sacar al humano del todo sería automatizar la propagación de un error que mis tests no alcanzan a ver. Segundo, porque el trabajo es individual: no hay otra persona que revise el cambio antes de que llegue a producción, así que la aprobación manual es el único punto donde alguien (yo, con otra cabeza puesta, mirando la evidencia en vez de escribiendo el código) para a preguntarse "¿esto está listo?" antes de que lo vea cualquiera que abra la app.

Lo que me faltaría para Continuous Deployment de verdad: e2e contra un entorno real (TP7), observabilidad que avise sola si algo se rompe después del deploy (TP9), y feature flags para poder apagar algo sin redesplegar si igual se cuela un bug. Hoy no lo querría ni con todo eso — prefiero mantener el gate humano en PROD mientras trabajo solo, porque es también donde practico la disciplina de "qué miro antes de aprobar" (§4).

### 3. El diseño de la cadena: `needs`/`if`/environments y el alcance de los secrets

`deploy-qa` depende de `[build-backend, build-frontend]` y lleva `if: github.ref == 'refs/heads/main'` — así un PR corre los tests pero nunca dispara un deploy. `deploy-prod` depende solo de `deploy-qa` y **no repite** el `if` de rama: no hace falta, porque si `deploy-qa` no corrió (por no ser push a `main`), `deploy-prod` tampoco puede correr — la condición se hereda por la cadena de `needs`, repetirla sería redundante.

Los secrets de los deploy hooks (`RENDER_HOOK_API_QA`, `RENDER_HOOK_FRONT_QA`, `RENDER_HOOK_API_PROD`, `RENDER_HOOK_FRONT_PROD`) viven en el **environment** correspondiente, no en el repo: un job con `environment: qa` no puede leer los de `production` y viceversa. Si alguien comprometiera el job de QA, no tendría forma de disparar un deploy a PROD con esos secrets — el alcance de cada uno está limitado a lo que ese entorno necesita, ni más.

### 4. Qué mira mi aprobador antes de aprobar

Para que el gate no sea un click automático, me puse criterios concretos antes de aprobar: que `deploy-qa` haya dado verde (smoke test pasó: API, base y front respondiendo), haber navegado yo mismo el cambio en la URL de QA, y que el diff no toque el esquema de la base ni agregue dependencias nuevas sin revisar. El texto real que escribí al aprobar el deploy del footer/ícono de entorno:

> "QA está verde y probé el footer/ícono de entorno ahí mismo: cambia bien de olla a plato según el host y el commit coincide con /api/version. Sin cambios de lógica de negocio ni de esquema de base. Apruebo el deploy a producción."

Y el rechazo real, con un motivo mío y específico (no el de ejemplo de la guía), sobre el primer deploy a PROD que armé (el gate humano en sí):

> "No es el momento correcto para subirlo a producción a los cambios."

Fue un rechazo deliberado: quise comprobar primero que el botón "Reject" realmente frena el job (no solo lo demora) y que el motivo queda registrado en el historial del run, antes de aprobar ningún deploy real. Es la misma idea del §2.4: la aprobación "compra" timing de negocio, no solo verificación técnica — y un gate que nunca rechaza no se puede distinguir de uno que no existe.

### 5. La letra chica del free tier

El cold start es real y lo vi en la primera corrida de `deploy-qa`: el primer intento del smoke test dio `curl: (28) Operation timed out after 10002 milliseconds` (el `--max-time 10` cortándolo antes de que el runner se cuelgue), y el segundo intento, 20 segundos después, ya respondió `{"status":"ok"}`. Sin el loop de reintentos, ese primer timeout hubiera tumbado el deploy entero por un falso negativo — el servicio no estaba roto, estaba despertando.

Las otras dos letras chicas que tengo presentes para no quedarme sin presupuesto antes de la defensa: las 750 horas de instancia son del **workspace**, no por servicio — mis 4 servicios duermen a los 15 min sin tráfico, así que en uso normal no debería gastarlas todas, pero lo voy a revisar en *Workspace → Billing* antes de P2. Y los 500 minutos de build mensuales del workspace: cada promoción QA→PROD de este TP reconstruye 4 veces (back y front, en los dos entornos), así que varios ciclos de prueba seguidos los consumen rápido.

### 6. Qué garantía pierdo porque Render reconstruye en vez de ejecutar mi imagen

Mi pipeline publica una imagen en ghcr.io etiquetada con el commit exacto que pasó los tests (§1). Pero Render, en este TP, **no corre esa imagen** — el deploy hook le pide que reconstruya el mismo commit desde mi repo, con su propio build de Docker. Aunque el código fuente sea idéntico, los *bytes* resultantes pueden no serlo: si una dependencia de `requirements.txt` o `package.json` sacó una versión nueva entre que corrió mi pipeline y que corrió el build de Render, o si cambió la imagen base (`python:3.12-slim`, `node:22-alpine`), el mismo commit puede producir una imagen distinta a la que mis tests verificaron.

Por eso, aunque mi `/health` devuelva el `RENDER_GIT_COMMIT` y pueda confirmar "el código correcto está desplegado", eso **no es lo mismo** que "el artefacto que verifiqué está corriendo" — son dos afirmaciones distintas, y hoy solo puedo sostener la primera. Cerrar la segunda es exactamente lo que hace el TP7, desplegando la imagen real del registry en vez de reconstruir.

### 7. Qué prueba mi smoke test y qué no

Prueba tres cosas encadenadas con `&&`: que `/health` responde (proceso vivo), que `/api/ingredients` responde (la base conecta — un `/health` que no toca la base podría dar verde con la connection string rota), y que el front sirve algo en `/`. Lo que **no** prueba: que el código desplegado sea el mismo artefacto verificado (§6), que las rutas que requieren login funcionen (no autentico en el smoke), ni que el `/api/` del front llegue de verdad al backend correcto — eso último lo verifiqué a mano la primera vez, navegando la URL de QA y creando una receta de prueba, no con el smoke automático.

### 8. Deployment pattern y plan de rollback

**Para una producción real con usuarios** elegiría **blue-green**: mi app no tiene estado en los contenedores (la base vive aparte, en Neon), así que tener dos entornos completos y cambiar el router de uno a otro es barato de implementar y me da rollback instantáneo con solo revertir el switch — más valioso que el costo de 2× infraestructura para una app chica como esta. Descarté canary porque requiere observabilidad que no tengo (TP9): sin métricas en vivo que digan "el canario está sangrando", repartir tráfico entre dos versiones es decidir a ciegas. Feature flags los usaría **además**, no en lugar de blue-green, para separar el riesgo de desplegar código del riesgo de mostrarlo — por ejemplo, para probar una función como "recetas sugeridas" en PROD apagada, antes de prenderla para todos.

**Mi rollback actual** es redesplegar el commit anterior conocido: disparar los mismos deploy hooks de PROD con `&ref=<sha-del-deploy-bueno-anterior>` en vez del SHA nuevo — el mismo mecanismo que uso para desplegar, apuntado hacia atrás. Lo medí de verdad, no lo estimé: después de cerrar `v6.0.0` (commit `fa7be7c8`), mergeé y aprobé un cambio más que se nota (commit `5c54d98`, el ícono/entorno también en el backend), y después volví atrás con los hooks apuntando a `fa7be7c8` de nuevo. Disparé los dos hooks a las **17:13:12** y medí el momento real en que `/api/version` de PROD empezó a responder con el commit viejo —en vez de confiar en la etiqueta "Live" del dashboard de Render, que puede demorar en actualizarse— con sondeos cada 10 segundos: a las 17:13:51 ya respondía `{"commit":"fa7be7c"}`. **Rollback: 39 segundos** (con un margen de ±10s por el intervalo de sondeo; el valor real está entre 29 y 39s). Una prueba extra de que el rollback fue real y no solo cosmético: la respuesta de `fa7be7c8` ni siquiera tiene los campos `entorno`/`icono` que agregué en el commit posterior — volvió el comportamiento real de esa versión, no solo la etiqueta del commit.

Lo que el rollback de código **no** deshace: si un cambio futuro incluyera una migración que borra una columna, volver el código atrás no resucita esa columna — para eso hace falta un plan de rollback de datos aparte, que hoy no tengo porque no desplegué ningún cambio de esquema todavía.

### 9. El footer e ícono de entorno (mejora propia)

Agregué un endpoint `/api/version` (separado de `/health`, que ya usa el smoke test) y un footer en el frontend que muestra, por entorno, un ícono de comida (🧑‍🍳 local, 🥘 QA, 🍽️ PROD — y el mismo ícono como favicon de la pestaña) con el commit corriendo. La decisión de diseño fue a propósito: no quiero que cualquier visitante de PROD vea esta información todo el tiempo (no es grave, pero tampoco hace falta regalarla), así que el texto con el commit queda oculto por default y solo aparece con un triple click sobre el ícono — accesible para mí en la defensa, invisible para un usuario normal.

### Problemas encontrados y cómo los resolví

- **Un servicio de Render quedó con la URL vieja después de renombrarlo.** El campo "Name" de Render es solo una etiqueta del dashboard — no regenera el subdominio `.onrender.com`, que queda fijo al que se creó la primera vez. Lo noté porque el dashboard decía "recetario-front-prod" pero la URL pública seguía siendo la del nombre por default del repo. Lo resolví borrando ese servicio y recreándolo con el nombre correcto puesto *antes* del primer deploy.
- **A punto de taggear con un commit que no existía.** Vi en una captura del video de la guía el comando `gh api 'repos/{owner}/{repo}/deployments?environment=production'` y por un momento pensé que ya lo había corrido yo. Antes de pushear el tag, verifiqué el SHA contra `git log` y la API de GitHub — no existía en mi repo, así que `git tag` lo hubiera rechazado solo. Confirmé que efectivamente no se había creado ningún tag con ese commit, y corrí el comando real parado en mi propio repo para sacar el SHA correcto (`13cb4155c92c3b13ded059ccd6d99b80bd9d87c6`, el que de verdad está en Deployments de `production`).
- **El resumen de coverage del backend no mostraba el número que realmente frena el build.** Mi tabla del summary solo parseaba `line-rate` y `branch-rate` del `coverage.xml` (Cobertura), que son dos métricas separadas — pero `--cov-fail-under=80` evalúa un **total combinado** que no está en ese XML. Lo resolví agregando `--cov-report=json` al `ENTRYPOINT` del Dockerfile y leyendo `totals.percent_covered` de ese JSON, que es exactamente el número que decide pasa/falla.

### Declaración de uso de IA

Usé Claude Code durante todo este TP, con un rol más de pair-programming hablado que de "hacé esto": le explicaba qué quería lograr y por qué, y revisábamos juntos cada paso antes de aplicarlo. Su rol concreto:

- Explicarme la diferencia entre CD y Continuous Deployment, los deployment patterns y por qué el orden del `ci.yml` (build final al final del job) es lo que hace cierta la frase "el artefacto sale solo si la verificación pasó" — no un `if` explícito, sino el orden de los pasos.
- Verificar cada paso contra el estado real con `gh`/`curl`/Docker local en vez de confiar en lo que yo describía que veía en pantalla — por ejemplo, confirmando con `curl` contra mis URLs de Render que el commit desplegado coincidía con el aprobado, en vez de asumirlo.
- Implementar conmigo las mejoras del footer/ícono de entorno y el fix del coverage, discutiendo antes el diseño (por qué ocultar el commit en PROD, por qué un ícono y no texto) y solo después escribiendo el código.
- Ayudarme a redactar esta sección de `decisiones.md`, a partir de los links, SHAs y comentarios reales que fuimos juntando durante el TP (no inventados después de memoria).

Las decisiones fueron mías: qué deployment pattern elegir y por qué, los criterios de aprobación del gate, el motivo del rechazo, y el diseño del footer. Verifiqué cada corrección pidiendo que confirmara contra el estado real del repo/Render/Neon, no contra lo que "debería" haber pasado según la guía.

## TP7 — Contenedores en el pipeline + integración y e2e

### Enlaces de este TP

- **Paquetes públicos**, con la etiqueta del último commit en `main` al momento de escribir esto (`sha-d1cabd3dbcf7f6e65d2e3ad82775bde6c57b7b30`):
  [`-backend`](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/pkgs/container/ingsoft3-bugliotti-allende-recetario-backend) ·
  [`-frontend`](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/pkgs/container/ingsoft3-bugliotti-allende-recetario-frontend)
- **Los entornos ejecutando la imagen (§3.2)**: el commit `ac87ffae9789a2ac27198dfee154a1d778b433a3` (PR [#129](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/pull/129)) cambió `deploy-qa`/`deploy-prod` de `&ref=` a `imgURL`. [Corrida de ese merge](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/runs/37224046929) con los 4 servicios desplegando por `imgURL`.
- **Las dos suites (§3.3)**: PR [#130](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/pull/130), `frontend/e2e/api.spec.js` (5 pruebas de integración) y `frontend/e2e/recetas.spec.js` (3 flujos e2e).
- **La corrida completa en verde, antes de romper nada**: [run 37255744997](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/runs/37255744997) — `build → deploy-qa → integracion → e2e → deploy-prod`, los 6 jobs en verde.
- **El par que diagnostica (§3.4, la evidencia central)**: el commit `4205ecb8188af97f2d4df17770a5d1cfedbf89ad` (PR [#131](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/pull/131)) rompió el front a propósito (detalle en §6). [Corrida roja](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/runs/37256820547): `integracion` ✅ verde, `e2e` ❌ rojo, `deploy-prod` ni se muestra como pendiente de aprobación. Los dos reportes de esa corrida, como artefactos: `playwright-report-integracion` (verde) y `playwright-report-e2e` (rojo) — descargables desde esa misma página de *Actions*.
- **El fix y la corrida completa en verde posterior**: commit `d1cabd3dbcf7f6e65d2e3ad82775bde6c57b7b30` (PR [#132](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/pull/132)). [Corrida verde](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/runs/37258212042) completa, hasta PROD.
- **URLs vivas**: las mismas del TP6 — QA — [api](https://recetario-api-qa.onrender.com) · [front](https://recetario-front-qa.onrender.com). PROD — [api](https://recetario-api-prod.onrender.com) · [front](https://recetario-front-prod.onrender.com).
- **El fix del mensaje de error** (el bug de UX del §9, aparte del intencional): commit `8e0c05b8b2f61df405dbcc3d0af250e3d751cba2` (PR [#133](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/pull/133)). [Corrida verde](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/runs/37363144439) completa, hasta PROD (esta corrida tardó por un incidente de GitHub Actions ajeno al repo — *"delays when assigning GitHub-hosted runners"*, confirmado en [githubstatus.com](https://www.githubstatus.com) — no por ningún problema del código).
- **Release `v7.0.0`**: [tag y release](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/releases/tag/v7.0.0), sobre el commit `8e0c05b8b2f61df405dbcc3d0af250e3d751cba2` — el que `Deployments` confirmó como el real en `production` en el momento de taguear (coincide con el de la PR #133 porque fue el deploy inmediato siguiente, sin nada en el medio).

### 1. Build once, deploy many: qué resuelve, con mi propio ejemplo

En el TP6 (§6 de esa sección) ya había dejado anotado el problema sin resolver: mi `/health` podía confirmar "el código correcto está desplegado" (el commit coincide), pero no "el artefacto que verifiqué está corriendo" — porque Render reconstruía el mismo commit en cada entorno, con su propio build de Docker, en un momento distinto. Dos builds del mismo código no garantizan los mismos bytes: si entre que corrió mi pipeline y que corrió el build de Render salió una versión nueva de una dependencia de `requirements.txt`, o cambió `python:3.12-slim`, el resultado podía diferir.

Con `imgURL` eso se cierra: el pipeline construye la imagen **una sola vez**, la publica con el tag del commit, y tanto QA como PROD reciben la orden explícita de ejecutar *esa* imagen — no de reconstruirla. Lo verifiqué de forma muy concreta en el primer deploy manual del front de QA (§3.2 de la guía, antes de tocar el pipeline): cambié la fuente a *Existing Image*, y la app **no cambió** hasta que corrí el `curl` con `imgURL` a mano — ahí vi en *Events* "Triggered via Deploy Hook" con el tag `sha-3d896b0e...`, y recién ahí la app reflejó esa imagen. Esa separación entre "cambiar la fuente" y "desplegar" es la prueba de que ya no hay ningún build de por medio.

### 2. Estrategia de etiquetas

`sha-<commit>` en el registry identifica **qué código generó esa imagen**, de forma trazable y verificable con `docker pull` desde cualquier máquina, sin sesión — lo comprobé en el checkpoint de §3.1 antes de tocar Render. Mi pipeline no publica `latest` a propósito: si lo hiciera, cualquier deploy que lo nombrara correría "lo último que se subió", sin importar si pasó las e2e o no — con una sola etiqueta por imagen no hay forma de desplegar algo sin decir exactamente qué es.

Los 4 servicios de Render quedaron configurados en *Settings → Image* con la imagen del commit `3d896b0ee9791226fe3e9a488a7a0830eb731e96` (el que estaba en `main` cuando armé la cadena) — esa **no** es la que corre hoy: es solo el punto de partida que usé para conectar la fuente la primera vez. Lo que corre en cada momento lo decide el `imgURL` del hook de cada deploy, que mi pipeline arma con `${{ github.sha }}` de esa corrida — no hace falta volver a tocar *Settings* con cada merge, porque Render solo exige que coincidan el registry y el nombre de la imagen, no la etiqueta. No creé servicios nuevos (cambié la fuente de los 4 que ya tenía desde el TP6), así que no hay servicios viejos que dar de baja.

### 3. Cómo se comprueba, desde afuera, que un entorno ejecuta mi imagen y no una reconstrucción

Desde *Actions*/el repo: el tag `sha-<commit>` tiene que existir en ambos paquetes públicos (confirmable con `docker pull` sin sesión), y es el mismo string que el pipeline mandó como `imgURL`. Desde Render (*Events* de cada servicio, no público — lo muestro en vivo en la defensa): cada deploy real dice **"Triggered via Deploy Hook"** y nombra esa misma etiqueta — un deploy manual desde el panel no diría eso, y por eso dejé de usar *Manual Deploy* para cualquier cosa.

Lo que el **smoke test no prueba**: que la imagen que levantó el servicio sea la que el pipeline mandó. El smoke solo confirma que el proceso responde (`/health`), que la base conecta (`/api/ingredients`) y que el front sirve algo — si el deploy real hubiera fallado silenciosamente y Render siguiera sirviendo la versión anterior, el smoke daría verde igual, porque "responde" no es lo mismo que "responde con la imagen de esta corrida" (es el límite que ya había anotado en el TP6 §7, y que la guía confirma en su §2.4: cerrarlo del todo necesitaría hornear el commit en la imagen y comparar contra el endpoint de vida, algo que queda fuera de este TP).

### 4. Integración: qué pruebo, y por qué elegí la amplia y no la estrecha

Mi `api.spec.js` tiene **5 pruebas**, todas contra la API de QA ya desplegada (la base de verdad), sin ningún doble:

1. Alta + verificación (`GET` con `mine=true`) + borrado, con limpieza comprobada.
2. Título vacío → `422` (no `400`: en mi stack, Pydantic valida `title: str = Field(min_length=1)` *antes* de que mi código de negocio corra — es un detalle real de FastAPI que la guía, escrita sobre .NET, no menciona).
3. **Autorización de lectura**: un usuario B no puede ver una receta privada de A (`404`, no `403` — mi código la oculta como si no existiera).
4. **Autorización de escritura**, la que elegí como extra: B no puede borrar (ni editar) una receta de A (`403` — acá sí confirma que existe, porque borrar ya asume que sabés el id). La agregué después de notar que 3 y 4 son la misma entidad con dos reglas de negocio distintas y dos códigos distintos.
5. Un `ingredient_id` que no existe → `400` (integridad referencial, no un error de formato).

Elegí la **amplia** (contra QA desplegado) y no la estrecha (`WebApplicationFactory`/una base descartable en el job) porque ya tengo QA corriendo la imagen exacta de cada corrida, y me ahorra levantar un Postgres aparte en el pipeline — con una fracción de la configuración, pruebo lo mismo y de paso confirmo que el *despliegue* quedó bien. Lo que pierdo: más lenta que la estrecha (corre en segundos contra la red, no en el mismo proceso), depende de que QA esté arriba y despierto, y comparte el mismo entorno con mis propias corridas sucesivas.

**Lo que NO puse en integración y por qué**: no repetí la regla de "no borrar un ingrediente en uso" (`409`, `delete_ingredient`) — ya la tengo cubierta con un unitario con doble del TP5, y esa regla es lógica de aplicación pura (una fila en `RecipeIngredient` sí o no), no depende de qué conteste la base de verdad. Agregarla acá hubiera sido duplicar cobertura sin sumar nada que el unitario no viera ya.

### 5. e2e: qué flujos elegí, y por qué

`recetas.spec.js` tiene **3 flujos**, todos contra el front de QA desplegado, con un usuario nuevo por corrida (email con timestamp, registrado por la UI real):

1. **Creación**: completar el formulario de receta, verla en el listado (con el buscador real), borrarla, confirmar que no está.
2. **Validación**: crear dos recetas con el mismo título → la segunda muestra el error (con `role="alert"`, que tuve que agregar — ver §9) y no se crea una receta de más.
3. **Publicar**, la que elegí como tercera: crear una receta completa, publicarla, y ver el badge cambiar de "Privada" a "Pública". La elegí porque es el flujo que le da sentido a tener un recetario en primer lugar — compartir una receta es la razón de ser de la app; si se rompe, no hay "receta pública" para nadie más, que es literalmente el producto.

**Lo que NO puse en e2e y por qué**: no agregué un flujo que pruebe el escalado de porciones (`scaleIngredients`) de punta a punta con el navegador, aunque es una función central de la app — ya la tengo cubierta al 100% por unitarios del TP5 (con dobles, porque es cálculo puro, no necesita ni API ni navegador). Repetirla en e2e solo hubiera sumado un test caro y lento verificando algo que ya sé que funciona.

### 6. El par verde/rojo que diagnosticó mi rotura

Para generar la evidencia rompí el **front**, no la API ni los tests: en `RecipeDetailPage.jsx`, justo antes de llamar a `api.createRecipe`, le renombro al payload el campo de `title` a `titulo` (ver el commit `4205ecb8`). Elegí ese punto a propósito: `buildRecipePayload` (en `lib/recipes.js`) sigue devolviendo `title` bien, así que el unitario del TP5 que valida el nombre del campo (`recipes.test.js`, línea 91) **sigue verde** — confirmé esto corriendo `npx vitest run` antes de subir el commit. El bug vive un nivel más arriba, donde ningún test del TP5 mira.

El resultado, corrida [37256820547](https://github.com/marcosbugliotti/ingsoft3-bugliotti-allende-recetario/actions/runs/37256820547): `integracion` quedó **verde** (le habla a la API con el campo `title` correcto, directo, sin pasar por mi bug) y `e2e` quedó **roja** (el navegador usa mi formulario roto). Leído contra la tabla de §2.5, sin abrir el código: fila 1, "se rompió el front, la API está sana". Lo confirmé mirando el reporte rojo — el screenshot del fallo muestra el formulario trabado en `/recipes/new`, con el error crudo de FastAPI en pantalla (`"loc":["body","title"],"msg":"Field required"`, con `"titulo"` adentro del `input` que mandé), no el mensaje genérico que vería un usuario.

Si en cambio hubiera roto la API (por ejemplo, el endpoint de alta), `integracion` se habría puesto roja y `e2e` **no habría llegado a correr** (su `needs: integracion` no se cumple) — fila 2 de la tabla, y es justo la razón por la que no se gasta un browser en confirmar algo que la integración ya sabe.

### 7. Cold start y test flaky

Mis e2e corren después del smoke de `deploy-qa`, que ya despertó el servicio — por eso el minuto de `timeout: 60_000` del `playwright.config.js` alcanza en el pipeline. Cuando corrí las suites a mano contra un QA recién dormido (fuera del pipeline), medí ~22 segundos de cold start en el primer pedido (`curl` directo a `/health`). El `retries: 1` del config absorbe una demora suelta de la red — pero un test que pasa recién al reintentar queda marcado como **flaky** en el reporte, y eso no es gratis: si el mismo test sale flaky dos corridas seguidas, ya no es "el plan gratis", es un test mal escrito que hay que arreglar, porque entrena a ignorar el rojo.

### 8. Cómo logro que la misma imagen del front sirva en QA y en PROD

El `Dockerfile` del frontend no tiene nada específico de entorno — nginx sirve los mismos estáticos siempre. Lo que distingue QA de PROD son dos variables de entorno que lee `default.conf.template` al arrancar el contenedor (`BACKEND_URL` y `DNS_RESOLVER`), ya configuradas por servicio desde el TP6 y que no toqué en este TP. Por eso cuando conecté los 4 servicios a *Existing Image* con la misma etiqueta, nada se rompió: la imagen es idéntica, y el único cambio real entre entornos sigue viviendo fuera de ella, en la config del servicio.

### 9. Problemas encontrados y cómo los resolví

- **Labels sin `htmlFor`/`id` en el formulario de receta.** Al escribir la primera e2e, `getByLabel('Título')` no encontraba nada — mirando el JSX, el `<label>` y el `<input>` estaban uno al lado del otro visualmente pero sin ninguna conexión en el HTML. Lo arreglé agregando `id`/`htmlFor` a los 4 campos del formulario (título, descripción, porciones base, tiempo de preparación): no fue un parche para que pasara el test, es una mejora real de accesibilidad que la app necesitaba.
- **Los errores no tenían `role="alert"`.** Mismo motivo: sin eso, `getByRole('alert')` no encuentra el mensaje de error, y usar un selector de CSS (`.error`) es justo lo que la guía pide evitar porque se rompe con cualquier cambio de diseño. Lo agregué a los dos lugares donde el formulario muestra errores.
- **`window.confirm` en el borrado bloquea Playwright.** Mi `handleDelete` usa el `confirm()` nativo del navegador; Playwright lo descarta automáticamente si no hay un handler. Lo resolví con `page.once('dialog', (dialog) => dialog.accept())` antes de cada click en "Borrar" en los specs — no toqué el código de la app, porque un `confirm()` nativo es una decisión de UX válida, no un bug.
- **El endpoint local no es el 8080 de la guía.** Mi `docker-compose.yml` publica el backend en el **8888** (no 8080 como la app de cátedra) — tuve que usarlo como default de `API_BASE_URL` en los specs y en los comandos locales, si no los tests fallaban contra un puerto que no existía.
- **Encontré un bug real de UX, aparte del intencional**: cuando la API devuelve un error de validación con `detail` como array (el formato real de Pydantic), mi `api.js` caía al `JSON.stringify(message)` y el usuario veía el JSON crudo en vez de un mensaje legible — lo vi en el screenshot del reporte rojo de la Tarea 4. No lo mezclé en ese commit a propósito (mezclar un bug real con el intencional ensucia la evidencia de la Tarea 4): lo arreglé aparte, agregando `mensajeDeError()` en `api.js`. La primera versión solo unía los `msg` de cada campo (`"Field required"`) y dejaba el string tal cual cuando ya venía legible — mejor que el JSON crudo, pero con 2 campos inválidos a la vez seguía sin decir **cuál** era cuál. La corregí agregando el nombre del campo, tomado del último elemento de `loc` (`item.loc?.at(-1)`), así el mensaje queda `"title: Field required"` en vez de solo `"Field required"`. Lo verifiqué con Node directo, por fuera del navegador, armando a mano el mismo array de `detail` que había visto en el screenshot del bug real (con `loc: ["body","title"]`) y uno con dos campos inválidos a la vez. Es difícil de disparar con el formulario de recetas de hoy (el `required`/`min` del HTML ya bloquea los casos más obvios antes de que la API llegue a devolver ese formato), pero cualquier regla de validación nueva que agregue en el futuro —o cualquier otro formulario de la app— se beneficia del arreglo sin tener que acordarme de este caso de nuevo.

### 10. El footer vuelve a mostrar un commit (mejora propia, más allá de lo que pide este TP)

Al aprobar el deploy del PR #133 verifiqué `/health` a mano y encontré una regresión: devolvía `"commit":"local"` en QA y PROD, porque `RENDER_GIT_COMMIT` (la variable que leía) solo existe en deploys por Git — y mis servicios son *Existing Image* desde §3.2. El footer con triple-click del TP6 quedó roto por este efecto colateral.

Lo arreglé sin tocar `Dockerfile`/`ci.yml`/`main.py` (la solución "de libro" del §2.4 — hornear el commit con un `ARG` — la descarté por ser demasiado para un ícono de footer): el footer le pregunta directo a la API pública de Deployments de GitHub (`.../deployments?environment=<qa|production>`, la misma que uso en §3.5 para el tag) y muestra `sha-<commit>` del último deployment real de ese entorno.

Un detalle que encontré probando con datos reales y no en la teoría: el registro de deployment aparece apenas `deploy-prod` queda **esperando mi aprobación**, no cuando el deploy termina (lo vi con `gh api .../statuses`: `waiting → queued → in_progress → success`). Si tomara el más reciente sin filtrar, el footer de PROD mostraría el commit nuevo *antes* de que yo lo aprobara — mintiendo que ya estaba desplegado. Arreglé `obtenerCommitDesplegado()` para recorrer los últimos deployments y quedarse con el primero cuyo estado sea `success`, no el primero por fecha.

### Declaración de uso de IA

Usé Claude Code durante todo este TP, de la misma forma que en el TP6: le iba explicando qué quería entender o lograr, y revisábamos juntos cada paso contra el estado real antes de seguir (nunca "aplicá esto" a ciegas). Su rol concreto acá:

- Leer la guía completa del TP7 junto conmigo y contrastarla con mi código real (backend FastAPI + auth, que la app de cátedra no tiene) para anticipar los puntos de fricción: el `422` vs `400` de Pydantic, el puerto `8888` de mi compose, la falta de `htmlFor`/`id` en mis labels, el `window.confirm` del borrado — se lo expliqué de la guía y las encontró leyendo mi código, no al revés.
- Diagnosticar conmigo el bug de UX del mensaje de error (el `JSON.stringify` crudo) a partir del screenshot del reporte rojo — lo encontré yo viendo el screenshot, pero él me lo implementó.
- Me ayudó a redactar esta sección a partir de los SHAs, run IDs y código reales de la cursada.
- Me asistió para identificar algunos de los comandos que se ven en la terminal del video y cómo aplicarlos usando git u otras alternativas, para comprender mejor lo que estoy haciendo y no simplemente copiar y pegar.

Las decisiones fueron mías: qué romper y dónde (elegí el punto exacto para no pisar el unitario del TP5), qué iba en cada suite y por qué, y qué dejar afuera de cada una por la pirámide. Verifiqué cada paso contra el estado real (corridas de Actions, reportes de Playwright, `vitest run`) antes de darlo por bueno.
