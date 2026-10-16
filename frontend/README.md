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
