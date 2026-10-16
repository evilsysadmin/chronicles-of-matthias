# Standalone React frontend — migration staging

The original Chronicles React frontend is **not yet fully transferred**.
This directory is the independent Vite/React application entrypoint and the
first real component migration, rather than a replacement for Chess Studio.

## Already transferred intact

Source commit: `evilsysadmin/chess-studio@89c482369f942adb0a241004f674f8ed5bb5e12d`.

- `src/components/ChroniclesCharacterSetup.jsx` — original complete React
  party builder, and its original `ChroniclesCharacterSetup.css`.
- `src/chronicles/chroniclesCharacterBuilds.js`,
  `src/chronicles/chroniclesMM3Rules.js`, original draft helper, portrait
  registry, four canonical WebP portraits, original safeStorage and original
  Lab intent compatibility helper.
- `src/chroniclesOfMatthias.js` is **only** the original `CHRONICLES_PARTY`
  constant to unblock the creator. It must not be mistaken for the game's
  `chroniclesReduce` runtime. Preserve/replace this boundary as the actual
  renderer, complete gameplay reducer and world engine migrate.
- `src/App.jsx` mounts the **actual** creator and connects the confirmed
  company to the already extracted authored crypt navigation subset.
  The navigation viewport is a temporary React UI. No real enemy AI,
  initiative/combat, 3D renderer, quests, real API access or run saves yet.

## Build and safety

```sh
cd frontend
npm install --ignore-scripts
npm run build
npm run dev
```

The independent React CI compiles the real sources and stores the output as
a short-lived artifact. **This PR does not switch production or staging**
to the Vite bundle. The existing `web/` staging HTML and its independent
Cloudflare Pages publisher remain intact as a rollback.

No credentials, Chess Studio auth, production sessions, player saves or
Cloudflare secrets are imported. Real multiplayer/auth and owner-scoped save
operations must wait until the standalone API proves parity.

## Remaining main migration sequence

1. Move the remaining Chronicles React components (character sheet,
   automap, journal, audio controls, menus, combat HUD) and their styles,
   preserving module contracts and testing mobile landscape/portrait.
2. Transfer original authored map catalog, movement/state reducer, event
   engine and scene model, with existing content/behavior tests.
3. Transfer the original Three.js first-person renderer and dependencies
   (dungeon geometry, enemies, lighting, Swordhaven scenes), preserving
   actual visual assets and readiness/lifecycle contracts.
4. Hook the React app to standalone authenticated backend, guarded
   owner-scoped checkpoints, safe reload and migration of saves.
5. Move protected Pages staging release ownership to built `frontend/dist`
   only after build, browser runtime and end-to-end smoke tests pass.
6. Cut over public production separately. Remove the temporary `web/`
   explorer only after real parity, keeping a rollback point.

Do not label the Vite frontend as the full game before these gates pass.

## Original Chronicle journal — first in-game modal migrated

Source pinned to `evilsysadmin/chess-studio@80a8700a6eb8e80620d7383832f1f483a2451500`:
`ChroniclesJournalModal.jsx`, `ChroniclesJournalModal.css`,
`ChroniclesQuestLog.jsx` and the canonical `campaign/intro.json`.
The modal renders the **actual journal entries** produced by the extracted
exploration state. The J shortcut, close button, Escape key, scrollable pages,
focus-return and tab containment remain connected. Quests are empty when the
preview has not started any real quest; none are fabricated to populate UI.

The QuestLog imports the pure, semantically unchanged `chroniclesQuestEntries`
selector extracted from the source content runtime instead of pulling in the
entire Chess Studio map catalog. `useEscapeToClose` is an explicit standalone
keyboard lifecycle adapter rather than copying the Chess Studio global history
stack. These are the only integration modifications; the original journal
component and CSS are unchanged.

The full character sheet still requires the original combat, equipment,
progression and spell APIs; it is **not** being faked with preview-only values.
The public Cloudflare Pages staging site is still the existing static shell
until ShadowOps explicitly validates and promotes the Vite/React bundle.

## Parallel preview deployment path

Vite supports `CHRONICLES_DEPLOY_BASE=/react/ npm run build` so the
independent React app can be hosted at `/react/` on the existing Chronicles
staging Pages site **without replacing** the static `/` rollback. The
source repository **does not publish Pages**; ShadowOps alone builds and
assembles the protected source SHA after validating source ownership.
The React path is a development preview only, with no auth, combat, backend
or saved games. Do not change `/` or production before browser smoke.

## First ORIGINAL Swordhaven 3D scene — visual migration slice

Source: `chess-studio@86036ea3b1799e2b5ce927b8746eb0567a6ac4bc`.
The two source files `src/chronicles/chroniclesSwordhaven3D.js` and
`src/chronicles/chroniclesPixelTextures.js` are **byte-for-byte identical**
to their original counterparts (Git blob SHA tested). The original
`buildSwordhavenScene` renders the actual authored Swordhaven buildings,
fountain, road, sky, trees, clouds, pixel-art materials, lighting and shadows.

`SwordhavenViewport.jsx` is an isolated lifecycle adapter that mounts
the real Three.js scene with its original camera position/facing/FOV formula.
`swordhavenWalk.js` moves across the original 19x19 authored collision grid
and real spawn location; it prevents walking through buildings/fountain/walls,
respects touch/keyboard controls and keeps turns in ephemeral React memory.

The Home entry **Recorrer Swordhaven original en 3D** opens this new visual
slice without replacing the crypt. The party portraits are the original
assets imported in the prior React extraction. The view does not yet use
the full original `createChroniclesOfMatthiasGame` engine or real authenticated
game state. It intentionally does **not** offer combat, monsters, trading,
quests, cross-map transitions, items, gold or resumable save operations.

Browser smoke and visual parity against the real screenshot are required
before calling this successful 3D migration; CI compilation and source
provenance only establish that it packages correct source files. If WebGL
initialization fails, the view reports it instead of pretending the town is
playable. The static root fallback and Chess Studio remain untouched.

## Reference-driven HUD parity pass — Swordhaven 3D

The user's side-by-side portrait/landscape references made the remaining
problem explicit: React's 3D renderer is authentic but its UI still looked
like a document. This pass renders **one fullscreen first-person scene** in
either orientation, with objective and four canonical portrait miniatures at
the upper left; a compact, real visited-cells minimap at the right; Chronicle
(J) / menu controls; and six keyboard/touch movement controls at the lower
left. The old header, large below-canvas panel and stacked article layout
are removed from the Swordhaven view only.

The minimap uses the original `createSwordhavenWalkGrid()` 19×19 collision
data and the ephemeral list of cells actually visited in this visual walk.
Fog-of-war defaults to undiscovered; only immediate neighbors of genuinely
visited cells are revealed. No invented shops, loot or enemies are placed.
The journal uses the original React modal. It records only the real arrival
and reaching the original southern gate if those have happened; it does not
create fictitious quests. The menu provides existing real navigation, reset
and help; there is **no pretend attack button** without the migrated engine.

Source original Three.js scene, textures, field of view, keyboard controls,
collision and mobile WebGL setup are unchanged. The authenticated runtime,
true party HP/MP, monster encounters, treasure, stores, quests, combat, and
persistence remain in the source migration backlog. A viewport fit check
does not establish full MM3 gameplay parity.

## Mobile landscape on entering Chronicles gameplay

Entering Swordhaven 3D or confirming the party into the dungeon now calls
`requestFullscreen({navigationUI:'hide'})` and
`screen.orientation.lock('landscape')` as part of the **actual Play/Confirm
tap**, the only context in which Android Chromium-class browsers may grant
those APIs. The game releases its own landscape lock and fullscreen on
returning to Home. Existing user fullscreen is never forcibly closed.
Desktop, tablets already in landscape and browsers without support are safe.

A mobile web page **cannot change OS autorotation settings** and cannot
guarantee a device rotation when the user merely opens a URL: browser
permissions, fullscreen availability, installed-app mode, and the Android
rotation lock are authoritative. If Brave denies the API, a concise prompt
offers retry and manual rotation; no fake CSS rotation or touch-axis
transformation is used. Once the physical viewport changes to landscape,
the prompt automatically disappears.

The relative PWA manifest also declares `orientation: landscape` and
`display: standalone` for installed-app use; this is not a promise that
ordinary Brave tabs obey it.

Node contracts and touch-emulated Chromium tests cover successful lock,
missing/denied API, responsive prompt, entering/exiting the view and
fullscreen ownership. The complete gameplay migration is still pending.

## Exact original Chronicles Home and MM3 look (visual parity tranche)

Pinned source: `evilsysadmin/chess-studio@ab0531d7e2812eed8c24003e8ef3386e8853b5a9`.

The **actual original** `ChroniclesSaveMenu.jsx`, original
`ChroniclesSaveMenu.css`, the untouched 49 KB `ChroniclesMM3Chrome.css`,
two canonical expedition-library AVIF backdrops, five original MM3 PNG
materials (sapphire menu, ruby, carved frame, gray stone, sandstone) and
the licensed VT323 bitmap-style font/attribution have been imported into
their original paths. Source blob SHA tests prove CSS/art byte identity.
The original Home component has precisely **one changed import**:
`chroniclesSavedExpeditionArea` points to an explicit standalone adapter
so the app does not transitively depend on Chess Studio's full map catalog.

`App.jsx` now **mounts that original book/library Home**, not a recreation.
The source Home disables Resume/Load when the independent backend has not
delivered real saves; Manage correctly reports none. Original Home action
Nueva campaña enters **only the current authored Swordhaven visual preview**,
and Nuevo juego opens the migrated authentic character creator; the UI
clearly marks combat and saved runs unavailable. Returning to castle is an
explicit link to the stable Chess Studio staging host, not a fake router.

The real `mm3-sapphire.png` gem and other original MM3 assets are applied
to the actual Swordhaven React HUD, with additional responsive bridging
selectors; pixel art is not generated or imitated with a new stylesheet.
Source JS and mobile Chromium tests cover Home, backgrounds, disabled
save actions, genuine castle-navigation button presence, gemstone URL and
navigation to real WebGL scene.

**This is a visual-source extraction, not the entire React game transfer.**
The full `ChroniclesOfMatthias.jsx` still imports hundreds of files from
Chess Studio (renderer, quests, combat, saves, sound, auth, overlays).
Move those originals under an immutable provenance snapshot in separate
small PRs, resolve external dependencies, then switch to the canonical
runtime, with non-fabricated backend state and real regression tests.
Do not copy or overwrite the current preview reducer blindly: preserve
root / legacy publishing rollback and secure save behavior.

## Complete pinned Chronicles React source snapshot (418 files)

The reproducible vendoring workflow has now committed **418 original source
files** to `frontend/original-chess-studio/` (source pin
`ab0531d7e2812eed8c24003e8ef3386e8853b5a9`). This includes original
`ChroniclesOfMatthias.jsx`, all `Chronicles*` React components and styling,
the original `chroniclesOfMatthias*.js` core/renderer/AI/turn logic,
`src/chronicles/` campaign runtime/map catalog/tests, image/UI/sprite
assets, and the legacy shared sound/persistence hooks needed to inspect and
untangle the original imports.

These files are **in the new repository, not yet the app's active runtime**.
The original files are preserved in a separate read-only migration snapshot,
so compilation and current standalone staging are not silently altered
by incompatible legacy service imports. The active Home, original character
creator, Chronicle dialog and authored Swordhaven 3D are already wired in
`frontend/src/`; actual original combat, map transitions, party state and
reliable authenticated saves still require modular integration.

## Visual parity: original MM3 VGA art extracted verbatim

Source: `evilsysadmin/chess-studio@55e95f75d5c417e95dbe39f87c9e2732bf3736fa`.
All five original `mm3-*.png` stone/gem/sapphire/frame texture assets and
the original VT323 pixel font are **byte-for-byte identical**, verified by
their Git blob hashes in CI. The original font's SIL OFL license is copied
with it. In contrast to the earlier approximation with flat CSS, the
independent Swordhaven now renders its HUD controls, ornate frame,
ruby corners, sapphire menu, stone portraits, sandstone narration,
map bezel and typography using the actual original artwork. The extracted
art is loaded only for the in-game view, not for party setup or login.

The standalone app still uses an interim React HUD, not the legacy
`ChroniclesOfMatthias.jsx` or its complete MM3 state machine. The real
original battle controls, member HP/SP, pause/save menu, shops, quests,
NPC conversations and full Three.js engine must be ported rather than
faked with decorative buttons or fabricated party numbers.
This visual pass improves *asset fidelity*, not feature equivalence.

Screenshot validation of landscape Chromium/WebGL verifies computed
texture backgrounds and the actual loaded pixel font, alongside the
existing 360/390/430 portrait and landscape fit tests. Cloudflare remains
published exclusively by ShadowOps with the stable static `/` rollback.

## Canonical game-engine prerequisite extraction

A focused source-only foundation copies **unchanged original** world/catalog
and mechanical code from `chess-studio@55e95f75d5c417e95dbe39f87c9e2732bf3736fa`:
13 modules covering map catalog, world material atlas and return links,
content effects/quests, item equipment and real inventory transfers,
spell point rules, shops, guilds, EnemyBuild AI attributes, authored arrival,
Lost King introduction and the Swordhaven portal; plus the 17 explicit
authored maps and the original campaign intro manifest (31 files total).
Every source file was transferred by its original Git blob SHA.

The first integration tests assert real equipment equip/unequip inventory
ownership, spell points from class/stat/level, enemy skill modifiers,
unique rectangular authored maps and original source blob checks.
This prepares for replacing the temporary `src/chroniclesOfMatthias.js`
compatibility party stub with the **real** reducer and for mounting the
real MM3 game component in subsequent small PRs. This source-only PR
deliberately does not switch the visible gameplay, save API, scene renderer,
auth, Mongo or production. It does not yet include optional Terra maps
discovered by the original catalog's import.meta.glob; those must be
imported before declaring **full** world parity.

## Original 35KB game reducer restored, now used by React

The 1.1KB temporary compatibility export in
`frontend/src/chroniclesOfMatthias.js` is replaced **byte-for-byte** with
the complete canonical Chess Studio MM3 reducer, Git blob
`4021a49e0465279700da5ccda31effdcdb97f18e`, including
`createChroniclesState`, `chroniclesReduce`, `chroniclesObjective`,
combat attacks/spells, item equip/unequip, guild/shops, content and journals.
This relies on the 31 exact dependency/area files imported in PR #74.

React now calls `createChroniclesState('swordhaven-square', build,
{ rules:'mm3' })` for the *actual authored initial MM3 party* at play.
The upper-left four portraits show genuine initial HP and spell points
derived from the original character rules and the current build.
The original map ID and phase are inspectable for safe browser smoke.
These are real **initial** figures, not fabricated live combat telemetry.

**Limitation:** the walking-camera slice is still isolated: it continues
using the original scene/collision walk preview, not the newly imported
full reducer as its movement/interaction authority yet. The game has
not silently gained active combats, saved runs, NPCs or dungeon travel.
The next small PR must bind original reducer state to interactive gameplay
and later port the complete original first-person renderer / HUD rather
than adding decorative buttons.

Browser smoke runs on both portrait and landscape and validates
the same original map, four heroes, actual initial health values and
no fatal JS errors. Source integrity tests guard against regressions.
