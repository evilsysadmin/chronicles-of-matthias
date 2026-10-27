# Chronicles · baseline de presión de encuentros MM3

Registro de la simulación determinista en `frontend/src/chronicles/chroniclesEnemyPressureBenchmark.test.js` (PR #727).

## Qué mide y qué no

- **Cuatro rondas de exposición pasiva**, con los **cuatro héroes** en su estado de salida y sin ataques, curaciones, retiradas ni bloqueo.
- `createChroniclesState`, `chroniclesStartInitiativeCombat` y `chroniclesResolveEnemyActor` reales: mapas, PV, IA, línea de visión, obstáculos, desplazamientos, `d20`, CA y turnos sin acciones adicionales.
- El combate mixto utiliza enemigos **existentes** del Camino de los Estandartes y los reposiciona **solo dentro del test** en casillas transitables. Ningún mapa de producción ni atributo de enemigo cambia.
- **No** mide tasa de victorias, botín, XP, acciones defensivas ni progresión de una expedición completa. Tampoco permite atribuir toda la diferencia de daño a la geometría: los tres arquetipos del encuentro mixto tienen estadísticas distintas de las de los goblins.

## Lectura inicial (motor real, cuatro rondas)

| Escenario | Actores enemigos | Acciones disponibles | Movimientos | Bloqueados | Ataques | Aciertos | PV perdidos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Goblin aislado, pasillo occidental de cloacas | 1 | 4 | 0 | 0 | 4 | 3 | 3 |
| Tres goblins en fila, mismo pasillo | 3 | 12 | 3 | 5 | 4 | 3 | 3 |
| Dos melee y arquero con línea de visión, zona abierta | 3 | 12 | 1 | 0 | 11 | 11 | 18 |

En el pasillo, el primer goblin absorbe **los cuatro ataques**; los otros dos gastan **ocho acciones** entre movimiento/bloqueo y no alcanzan al grupo. El daño total durante cuatro rondas es **idéntico** al de un solo goblin. El equipo mixto, en cambio, aprovecha el espacio y la distancia: el primer melee y el arquero atacan en las cuatro rondas, y el segundo melee entra en alcance tras moverse.

### Qué recomendar a continuación

1. Comparar la **misma clase de enemigo** en pasillo frente a una cámara con dos entradas transitables y, por separado, medir combinaciones de melee + proyectiles: aislar geometría de estadísticas.
2. Añadir un **guion de acciones del grupo** con ataques, fallos, curaciones y varios resultados de iniciativa (sin recompensas inventadas) para obtener ratios de supervivencia, gasto de recursos y tiempo hasta victoria.
3. Cuando los puntos anteriores existan, diseñar uno o dos encuentros de 3–4 criaturas en salas/cruces reales, con XP acotado, y comprobar que ningún pasillo genera ataques cuerpo a cuerpo a través de compañeros.

Los datos y sus invariantes se reproducen con el test mencionado; no sustituirlos por estimaciones ni confundir exposición pasiva con dificultad global.
