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
