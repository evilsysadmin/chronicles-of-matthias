# Standalone cutover gates

Chronicles remains playable in Chess Studio until **all** of these gates have independently verifiable evidence. The standalone Go read-only staging API is not a playable game.

| Gate | Evidence required | Current status |
| --- | --- | --- |
| Browser game | Independently built frontend loads the real game, assets, input, exploration and combat | Not verified |
| API parity | Authenticated create, read, update and delete run operations match the legacy contract, including validation and errors | Read-only staging subset only |
| Save continuity | A legacy run can be transferred securely, resumed after reload and written without loss of flags, inventory, quests or party state | Not verified |
| Isolation | Two users cannot access each other's runs; session revocation remains effective for all write endpoints | Read coverage exists; writes not verified |
| Infrastructure | OCI staging runs a verified immutable ARM64 image and the standalone frontend uses its own origin | Image publication prepared; deployment not verified |
| End-to-end | Real browser smoke covers new run → exploration → combat → save → F5 → resume | Not verified |
| Rollback | Chess Studio remains usable and old saves remain recoverable throughout rollout | Required |

## Migration order

1. Bring over the real frontend and its required assets, with an explicit inventory of imports and runtime dependencies. Do not substitute a decorative shell for the playable game.
2. Port the run write contract into Go behind staging-only gates; test against the legacy Python behavior using synthetic saves.
3. Exercise save portability with a deliberate authenticated transfer mechanism. A new browser origin does **not** inherit localStorage from Chess Studio.
4. Deploy and smoke test on independent staging using a pinned image digest.
5. Only after the gates pass, plan production cutover, rollback and removal of the embedded game.

## Non-negotiable boundaries

- No automatic production promotion, DNS mutation, live-data copy or deletion of the embedded game as part of preparatory PRs.
- No production write routes before authorization, parity, migration and rollback checks pass.
- Prefer one focused PR per gate; CI green is necessary but does not replace actual browser and staging evidence.
