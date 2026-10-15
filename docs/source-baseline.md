# Pinned source baseline

- Source: `evilsysadmin/chess-studio`
- Baseline commit: `c02ac757cb6ef447c6c4bfb9b2e4929259cf9ff6`
- Commit URL: https://github.com/evilsysadmin/chess-studio/commit/c02ac757cb6ef447c6c4bfb9b2e4929259cf9ff6
- Baseline subject: `feat(Chronicles): creación MM3 con raza, identidad y consecuencias reales (#5611)`

## Reproducibility

All extracted files must come from this immutable commit (or an explicitly documented later rebase), not a moving `main`. Record SHA-256 checksums for transferred binary assets and preserve their license/provenance. Do not copy secrets or environment-specific credentials.

## Extraction acceptance gates

1. A standalone frontend build with its own dependency lockfile and executable test scripts.
2. Parity for combat, movement, map generation, character creation, quests, inventory and sound.
3. Cross-origin save transfer and F5 resume verified without clearing old saves.
4. Desktop and mobile visual/runtime evidence.
5. Independent staging health check and rollback before production cutover.
6. No deletion of Chess Studio implementation until the new game passes all gates.

## Dependency investigation

Known coupling includes the shared `sound.js` ambient API, remote run client/bootstrap services, Python and Go Chronicles endpoints, React/Three modules and their assets. Audit each imported symbol before deciding whether to vendor, replace or move it.
