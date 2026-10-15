# Chronicles extraction audit — initial pass

Source repository: `evilsysadmin/chess-studio` (`main` at audit time; pin an exact commit before copying files).

## Confirmed source areas

- `frontend/src/components/ChroniclesOfMatthias.jsx`: main React game surface.
- `frontend/src/chronicles/`: gameplay, maps, UI, sound, saves and client-side services.
- `frontend/src/chroniclesOfMatthias*.js`: game rules, turn engine, Three.js scene, targeting, tactics and other subsystems.
- `backend-python/chronicles_*.py` and `backend-python/chronicles_campaign/`: procedural maps, campaign and run persistence.
- `backend-go/internal/chronicles/` and `backend-go/internal/gamesapi/chronicles.go`: Go Chronicles endpoints; audit whether runtime uses Go, Python, or both before extraction.
- `e2e/chronicles-*.spec.js`, `e2e/chronicles-of-matthias*.spec.js`: runtime, visual and tactics E2E coverage.
- `scripts/chronicles_*.py`, `scripts/validate_chronicles_campaign.py`, `scripts/art/*chronicles*`, `scripts/blender/*chronicles*`: quality gates and art pipeline.
- `docs/operations/chronicles-*.md`: existing product and engineering contracts.

## Coupling confirmed from main component imports

- Shared `../sound.js` ambient volume API: replace with a local audio facade or extract a compatible audio module.
- `chroniclesRunClient.js` and `chroniclesGameBootstrap.js`: inspect remote API base URL, authentication and persistence before changing origins.
- Runtime imports cross `frontend/src/chronicles/`, `frontend/src/chroniclesOfMatthias*.js` and React components; copy as a coherent dependency graph rather than individually.

## Critical migration hazards

1. Browser localStorage and IndexedDB are scoped to origin. A new subdomain cannot read saves directly from Chess Studio; design an explicit, verified export/import or origin-based transfer.
2. The current app may rely on authenticated Chess Studio profile, API, sound, CSS and asset paths. Identify all shared imports and APIs.
3. Preserve live deployments and existing saves until independent staging and rollback are validated.
4. Keep Godot experimentation out of the initial extraction.

## Next actionable PRs

- Pin exact source SHA and generate a complete file/dependency/asset manifest.
- Add a minimal standalone app and CI using pinned dependencies; import modules in bounded batches.
- Extract remote API contracts and test compatibility before production cutover.
- Validate mobile, F5 resume, quests, inventory, encounters, audio and save migration.

Tracking: https://github.com/evilsysadmin/chess-studio/issues/5632
