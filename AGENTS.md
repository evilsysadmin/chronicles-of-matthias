# AGENTS.md — Chronicles of Matthias

> Guía operativa **viva** para asistentes/agentes que trabajen en este repositorio.
> Aplica a todo el árbol. Actualizarla cuando una decisión repetible cambie el
> trabajo futuro; no convertirla en un changelog de cada PR. El código y las
> pruebas del repositorio prevalecen si alguna indicación se queda obsoleta.

## 1. Propiedad, arquitectura y fuentes de verdad

- **Este repositorio es la fuente de verdad de Chronicles of Matthias** (juego
  y API), independiente de Chess Studio. No implementar cambios de Chronicles
  en Chess Studio ni introducir dependencias nuevas de su código.
- `frontend/`: React 18, Vite 6, Three.js, reglas y experiencia MM3;
  `frontend/src/components/ChroniclesOfMatthias.jsx` es el orquestador
  principal de la vista en primera persona.
- `frontend/src/chroniclesOfMatthias.js`: reglas de juego/reductor.
  `frontend/src/chroniclesOfMatthiasThree.js`: renderizado 3D.
  `frontend/src/chronicles/`: funciones puras, equipamiento, mundo,
  presentación, audio, pruebas y adaptadores específicos.
- `api/`: API Go, autenticación, saves y generadores `cmd/terragen` y
  `cmd/spritegen`. No sustituir la API real por mocks en el runtime.
- Los mapas se versionan en dos lugares: `frontend/src/chronicles/maps` y
  `api/internal/chronicles/content/maps`. Se generan/espejan con
  `cd api && go run ./cmd/terragen`. **No editar una sola copia**.
  Verificar con `go run ./cmd/terragen -check`.
- La infraestructura, Cloudflare Pages, OCI y los releases son responsabilidad
  de `evilsysadmin/shadowops-infra`, **no de este repositorio**. No modificar
  infraestructura o producción por comodidad ni publicar manualmente fuera
  del workflow propietario.
- Consultar `README.md`, `docs/` y los tests específicos antes de tocar
  contratos sensibles. Preferir el comportamiento real a una suposición
  heredada de conversaciones antiguas.

## 2. Disciplina de trabajo y GitHub

1. Trabajar **PR a PR**, una mejora vertical pequeña y comprobable por PR.
   Evitar mezclar UX, reglas, assets, persistencia e infraestructura en cambios
   grandes. Antes de editar, consultar `main` y PR abiertas para evitar pisar
   cambios de otra iteración.
2. Inspeccionar solo los archivos/rangos necesarios. Al usar el conector
   GitHub, preferir llamadas dirigidas de metadata, SHA, archivos pequeños,
   checks y PR; evitar diffs completos, búsquedas masivas y lecturas de
   archivos grandes salvo necesidad real.
3. Añadir/modificar pruebas útiles para la regresión detectada. No manipular
   expectativas de tests para ocultar defectos de producción. Si un test
   contradice las reglas actuales, verificar primero el contrato real.
4. Crear la PR, revisar resultados de CI **para el SHA concreto**, corregir
   errores y volver a verificar. No confundir PR abierta, automerge habilitado,
   CI verde y PR **realmente fusionada**. Habilitar automerge cuando proceda;
   si la PR ya es fusionable y GitHub rechaza habilitarlo por estado `clean`,
   fusionar de forma controlada tras confirmar los checks requeridos.
5. Confirmar explícitamente que `merged=true`. Si aplica despliegue,
   comprobar además la CI del **commit definitivo en `main`**, que puede
   diferir del SHA de la rama por squash/merge.
6. Actualizar la issue/épica correspondiente con PR y estado **verificados**,
   no marcar aceptaciones completas a partir de una mejora parcial.
   La épica MM3 principal es
   [#134](https://github.com/evilsysadmin/chronicles-of-matthias/issues/134).
7. Mantener al usuario informado durante ejecuciones largas: qué se ha
   comprobado, qué falta y qué bloquea. No pedir confirmación entre PRs cuando
   la tarea y dirección ya están autorizadas. No entregar ZIP salvo petición
   explícita.

## 3. Pruebas y calidad

- Pruebas de contrato: `npm test` en la raíz (`node --test tests/*.test.mjs`).
- Juego: `cd frontend && npm ci && npm test && npm run build`.
- El workflow `.github/workflows/react-frontend.yml` incluye Vitest,
  build real y Chromium smoke de montaje de Chronicles/Tactics.
- API: `cd api && go vet ./cmd/... && go test ./internal/chronicles/... ./internal/gamesapi/... ./cmd/...`
  y `go run ./cmd/terragen -check`. El workflow `api.yml` además ejerce
  registro, nueva campaña, save y recuperación con Go + MongoDB real.
- Workflows obligatorios: **Chronicles CI**, **Chronicles frontend** y
  **Chronicles API**. Exigir resultados de éxito y distinguir `pull_request`
  de `push` sobre `main`. El pipeline de API publica imagen multi-arquitectura
  en `main`, lo que puede tardar más que los tests.
- Para UX, probar teclado, ratón y tacto; validar vistas de 360/390/430 px,
  scroll, overlays, foco, etiquetas accesibles y rendimiento. Capturas y
  Chromium cuando sea posible. **CI de build no equivale a validación visual**.
- No introducir assets grandes ni imágenes externas en runtime por un efecto
  pequeño; preferir geometría reutilizable/materiales compartidos y
  liberación correcta de recursos Three.js.

## 4. Contratos de experiencia MM3

- Inspiración Might & Magic III / Terra: primera persona, grupo con
  progresión real, salvas colectivas antes de contacto y combate por turnos
  al entrar en contacto. No romper el modo Tactics al mejorar MM3.
- **Controles de teclado vigentes**: flechas ↑/↓ avanzan/retroceden;
  ←/→ giran; **Q/E** hacen strafe lateral izquierda/derecha sin girar;
  en el menú de aventura **Q** abre la confirmación de salida sin guardar;
  **A** ataca cuerpo a cuerpo **solo durante iniciativa de combate** (en
  exploración es inerte); **S** dispara con el grupo fuera del combate y
  con el héroe activo en iniciativa. **Espacio NO ataca**
  ni tiene alias de ataque automático en primera persona; no recuperarlo.
  El botón táctil de ataque automático permanece disponible por separado.
  `C` abre magia. Mantener código, ayuda, botones y pruebas sincronizados.
- En MM3 **no existe el atributo «Alcance»** de equipo. Melee, incluidas lanza y bastón, ataca adyacente; arco, ballesta, honda y conjuros ofensivos/paralizantes actúan sobre enemigos visibles en línea recta sin atravesar paredes. El recorrido está limitado por el propio mapa. El HUD y las tiendas no deben anunciar diferencias de casillas ficticias. Mantener intacta la geometría de combate del modo Tactics y los identificadores/metadatos históricos de los objetos para guardados existentes.
- Recogidas y botín MM3: dar un aviso breve no modal tras ganar realmente objetos, mostrando el nombre/cantidad del inventario tras la acción, tanto de objetos del suelo como de enemigos derrotados. Nunca anunciar recompensas por intentos fallidos, compras o restauración de saves.
- Tiempo de exploración MM3: toda acción que **consume turno** (caminar, girar, disparar, conjurar) avanza detección y persecución una sola vez, incluso si el grupo no cambia de casilla. Las acciones rechazadas y transiciones de mapa no hacen avanzar criaturas. El contacto abre iniciativa; no introducir ataques gratis ni atravesar muros. Las criaturas orgánicas como arañas persiguen a razón de **una casilla cardinal caminable por acción**, sin saltos de caballo de ajedrez aunque algún dato antiguo indique `knight-chase`; los enemigos especiales explícitamente ajedrecísticos mantienen sus propias reglas.
- Cada tiro visual corresponde a un héroe vivo que lleva **arma de proyectiles
  válida para su clase**: arco, ballesta u honda. Puede haber animación/sonido
  de proyectiles disparados al aire, pero **no inventar impactos, daño, XP,
  loot ni reacciones de enemigo** sin un objetivo real. Mantener coste de
  turno y guardados conforme al reductor.
- Curaciones MM3: se pueden lanzar sobre un personaje al 100 % de PV, y la curación grupal sin heridos sigue gastando PH y turno sin aumentar PV. Personajes a 0 PV siguen necesitando resurrección; no inventar un efecto ni cancelar automáticamente el lanzamiento.
- Para **impactos reales** (cuerpo a cuerpo y proyectiles), usar la gota de
  sangre con **número de daño** compartida:
  `chroniclesHitImpacts` / `ChroniclesHitSplat`. No duplicar feedback
  con banners u overlays competidores.
- **Pistas de región de la Crónica:** autorar las fases en
  `frontend/src/chronicles/campaign/quest-region-hints.json` con un
  `mapId` canónico, `clue` y, si procede, requisitos declarativos
  `when` o `objectiveIncludes`. El motor
  `chroniclesQuestRegionHint` resuelve por orden y nunca inventa
  coordenadas o lugares de encargos desconocidos. Mantener las condiciones
  acordes a los efectos reales `start-quest`/`advance-quest`; no añadir
  `switch` específicos de misiones ni duplicar pistas en el estado guardado.
- **Historia de cada encargo:** la Crónica solo presenta acontecimientos
  que existen de verdad en el registro de la expedición. Mantener los vínculos
  entre misión y recibos `journal.id` en
  `frontend/src/chronicles/campaign/quest-event-links.json`, sin inventar
  hitos a partir del estado `completed` ni generar comentarios ficticios
  de Matthias. El orden es el de `state.journal`, no el del catálogo.
- La banda naranja/narrador se reserva para **sucesos narrativos relevantes**;
  no mostrarla por acciones rutinarias, disparos al aire, cada impacto o
  mensajes mecánicos repetidos. La Crónica puede conservar contexto útil.
- El arte 3D de disparos vive en
  `frontend/src/chronicles/chroniclesVolleyProjectileArt.js` y su
  trayectoria en `frontend/src/chroniclesOfMatthiasThree.js`.
  Objetivo visual: **retro-premium**, lectura clara y elegante para arco,
  virote y piedra; estela discreta, vuelo natural y gasto GPU moderado.
  Preferir una mejora visual pequeña y validable a efectos exagerados.
- **Combate MM3 estacionario:** mientras exista iniciativa, el grupo **no puede avanzar, retroceder ni desplazarse lateralmente** con teclado, táctil ni llamada directa al reductor. Rechazar sin gastar turnos ni cambiar posición; conservar los giros para orientar ataques y permitir desplazamientos al concluir el combate. No modificar el movimiento táctico de enemigos ni el modo Tactics.
- Defensa MM3: durante iniciativa **B** es BLOCK del héroe activo (+4 CA, consume una acción completa y expira cuando el héroe vuelve a tener turno). No se acumula; sin combate o durante turno enemigo es inerte. El HUD debe ofrecerlo también en táctil.
- Equipo MM3: arma de mano **A**, proyectiles **S**, armadura y escudo;
  seguir clases, ranuras, stock, bonificaciones *reales* y reglas de manos.
  Una vista previa no debe mutar inventario, campaña ni persistencia.
  Objetos de misión/desconocidos no deben desaparecer al filtrar.
- Persistencia: el servidor/saves y los checkpoints de área/manual son
  contratos reales. No introducir autosave por cada movimiento, disparo
  o diálogo; preservar recuperación de sesión y propiedad de los datos.

## 5. Dirección visual y próximos cortes

- La escena 3D marca el estándar. Las pantallas de **CAST (C)** y
  **menú de aventura** deben elevarse a ese nivel: composición consistente,
  jerarquía clara, controles legibles, foco/tacto y estilo diegético, sin
  convertirlas en paneles administrativos recargados.
- **Separar** mejoras visuales en PRs independientes: (1) proyectiles S,
  (2) CAST/hechizos, (3) menú de aventura. Mantener reglas y guardados
  intactos en PRs puramente visuales; tests y capturas por pantalla.
  Esta sección es una **dirección de trabajo**, no una afirmación de que
  esos cortes estén completados. Revisar PRs/issue antes de iterar.
- **Tiendas MM3:** interiores de comercio a pantalla completa, catálogo seleccionable y
  ficha de compra/venta con datos reales; no mostrar la escena del juego detrás.
  La Forja de Brunna usa el mock canónico optimizado en
  `frontend/src/assets/chronicles/ui/shops/brunna-forge.webp` (WebP 1672×941),
  con tendera visible entre los paneles. No reintroducir el antiguo sprite
  pixelado como fondo principal ni añadir decoraciones que escondan la cara.
  Presentación, filtros y ordenación jamás deben mutar el inventario, el oro,
  las reglas de equipabilidad ni las operaciones `shop-buy` / `shop-sell`.
  La venta solo ofrece existencias sin equipar; la compra no equipa.
- Evitar alertas, bandas y carteles persistentes para feedback de combate.
  Respetar UX móvil y preferencias de movimiento reducido sin dejar
  desaparecida toda señal de una acción válida.

## 6. Staging y publicación: no confundir código con despliegue

- Frontend de staging:
  `https://staging.chronicles.shadowops.dpdns.org/`.
  API dedicada: `https://chronicles-api-staging.shadowops.dpdns.org/`.
- Cloudflare Pages se publica **desde** el workflow propietario
  `evilsysadmin/shadowops-infra/.github/workflows/chronicles-pages-release.yml`.
  El workflow de Infra puede evolucionar (manual, programado o disparado
  desde el repo fuente): **inspeccionar su estado actual** antes de solicitar
  un release; no asumir que cada merge en Chronicles ya está desplegado.
- Antes de declarar un cambio disponible, verificar: CI requerida del SHA
  exacto de `main`, job efectivo de publicación, SHA fuente usado en
  `VITE_BUILD_SHA` / comprobante y marker
  `CHRONICLES_PAGES_STAGING_HTTPS_OK`.
- Una publicación HTTPS correcta **no certifica** una animación concreta
  en el navegador del usuario: distinguir deploy verificado, smoke de
  montaje y prueba visual interactiva. Producción necesita su propia
  promoción explícita y controles.

## 7. Mantenimiento de esta guía

- Agregar decisiones **duraderas y accionables** aquí después de validarlas.
  El contexto efímero de una PR va en su descripción o en la issue, no aquí.
- Si aparece una instrucción más específica para un subárbol, colocarla
  en otro `AGENTS.md` allí y mantener este archivo como contrato general.
- Corregir contradicciones en código, pruebas y documentación juntos.
  Evitar prometer trabajo asíncrono o despliegues que no estén programados
  o no hayan sido realmente ejecutados y comprobados.
