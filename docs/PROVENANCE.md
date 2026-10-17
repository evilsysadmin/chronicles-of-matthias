# Procedencia

Chronicles of Matthias nació dentro de Chess Studio y se separó a este repo el
2026-10-16. Desde el 2026-10-17 **este repo es la única fuente de verdad del
juego y de su API**: los cambios de Chronicles se hacen aquí, no en Chess Studio.

Punto de partida de la separación (copia byte a byte, ya no se exige):

| Parte | Origen | Commit de Chess Studio | Ficheros |
| --- | --- | --- | --- |
| `frontend/src` (juego) | `chess-studio/frontend/src` | `83becbc1703de7ed06815b9de1b76adf2e8a465f` | 365 |
| `api/` (backend Go) | `chess-studio/backend-go` | `83becbc1703de7ed06815b9de1b76adf2e8a465f` | 156 |

También se trajeron los tests del juego (Vitest), los samples orquestales y el
modelo de Matthias de `frontend/public`, y el pipeline de arte y mundo
(`scripts/art`, `scripts/blender`). El generador del mundo de Terra se trajo en
Python y se portó a Go (`api/cmd/terragen`) con salida idéntica byte a byte.

La API conserva la ruta de módulo Go `github.com/evilsysadmin/chess-studio/backend-go`
de origen; renombrarla es un cambio mecánico pendiente.
