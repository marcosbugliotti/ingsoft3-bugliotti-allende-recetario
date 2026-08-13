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
