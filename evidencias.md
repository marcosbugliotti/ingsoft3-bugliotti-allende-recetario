# Evidencias — TP1

## 1. Push directo a main rechazado

GitHub rechaza el push porque main está protegida y la regla alcanza también al dueño del repo
(`GH006: Protected branch update failed`, `protected branch hook declined`).

## 2. El PR de la rama B no se puede mergear: conflicto
![aviso conflicto](img/aviso-conflicto.png)
GitHub detecta que ambas ramas modificaron la misma línea del README y no puede mergear
automáticamente.

## 3. Marcadores de conflicto
![marcadores](img/marcadores-conflicto.png)
Los marcadores `<<<<<<<`, `=======` y `>>>>>>>` delimitan las dos versiones en pugna antes de
resolver el conflicto.

## 4. Release v1.0.0 publicada
![release](img/release-publicada.png)
Tag `v1.0.0` sobre `main` con la release publicada y sus notas.
