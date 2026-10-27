# Chronicles · baseline de presión de encuentros MM3

Simulación determinista del motor real en `frontend/src/chronicles/chroniclesEnemyPressureBenchmark.test.js`, introducida en PR #727 y actualizada tras la ruta de flanqueo de cloacas de PR #750. Los valores siguientes proceden del log `CHRONICLES_MM3_PRESSURE_BENCHMARK` del [workflow frontend verde de `3374319`](https://github.com/evilsysadmin/chronicles-of-matthias/actions/runs/40565583312), 27-10-2026.

## Qué mide y qué no

- **Cuatro rondas de exposición pasiva**, con los **cuatro héroes** en su estado de salida y sin ataques, curaciones, retiradas ni bloqueo.
- `createChroniclesState`, `chroniclesStartInitiativeCombat` y `chroniclesResolveEnemyActor` reales: mapas, PV, IA, línea de visión, obstáculos, desplazamientos, `d20`, CA y turnos sin acciones adicionales.
- El combate mixto usa enemigos existentes del Camino de los Estandartes, reposicionados **solo en el test**. El escenario de cámara usa los mismos tres goblins de cloacas, también reposicionados solo en el test.
- **No** mide victorias, botín, XP, decisiones de los héroes, gasto de recursos ni una expedición completa. No atribuir la diferencia del equipo mixto únicamente a la geometría: sus arquetipos y estadísticas son distintos.

## Presión actual tras abrir la ruta de flanqueo (#750)

| Escenario | Enemigos | Acciones | Movimientos | Bloqueados | Ataques | Aciertos | PV perdidos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Goblin aislado, pasillo occidental de cloacas | 1 | 4 | 0 | 0 | 4 | 3 | 3 |
| Tres goblins del grupo occidental, pasillo con desagüe abierto | 3 | 12 | 4 | 3 | 5 | 4 | 4 |
| Dos melee y arquero, zona abierta | 3 | 12 | 1 | 0 | 11 | 11 | 18 |

**Cambio comprobado:** el grupo de tres goblins ya no causa exactamente el mismo daño que uno solo. El primero realiza cuatro ataques; el goblin de desbordamiento recorre tres casillas y consigue un ataque adicional que alcanza a otro héroe. El tercero aún consume cuatro turnos sin atacar (uno de movimiento y tres bloqueados). La mejora es **modesta: 4 PV frente a 3**, no una garantía de dificultad satisfactoria.

### Geometría aislada: mismos tres goblins, mismos héroes, dos rondas

| Disposición | Acciones | Movimientos | Bloqueados | Ataques | Aciertos | PV perdidos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Pasillo de cloacas tras #750 | 6 | 3 | 1 | 2 | 1 | 1 |
| Cámara con tres aproximaciones cardinales, posiciones solo de test | 6 | 0 | 0 | 6 | 3 | 3 |

La cámara demuestra que la geometría, sin cambiar las estadísticas ni los enemigos, multiplica las oportunidades de ataque. **No es un encuentro desplegado en producción** y no debe confundirse con el comportamiento de todos los cruces del mapa.

## Próximo experimento antes de subir la dificultad

1. Añadir un **guion reproducible de acciones reales del grupo** (ataques, bloqueos y curaciones) y varias tiradas de iniciativa para medir supervivencia, recursos y rondas hasta victoria. Mantener separados los resultados de exposición pasiva.
2. Con esos datos, diseñar un encuentro acotado de 3–4 criaturas en una sala o cruce real, comprobando que no se ataca a través de aliados ni se regala XP.
3. Repetir el benchmark tras cambios de mapa o IA; actualizar esta tabla solo con cifras obtenidas de CI para el SHA correspondiente.

El test exige ahora que el grupo occidental produzca **más daño real** que el goblin aislado, además de más ataques. Es una regresión determinista, no un umbral de balance general.
