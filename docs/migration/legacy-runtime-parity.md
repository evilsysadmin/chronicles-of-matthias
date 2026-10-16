# Chronicles standalone: legacy runtime parity gates

Status: migration contract; **not** proof that the standalone runtime is playable.

## Source of truth
The running Chronicles implementation in `evilsysadmin/chess-studio` is authoritative until a tested cutover. Pin a concrete source SHA before copying any implementation; record destination SHA and file mapping in each migration PR. Never infer behavior from Swordhaven placeholders.

## Dependency inventory and transfer order
1. Frontend runtime: identify original expedition entry point, state machine, map generation and authored maps, encounter transitions, initiative (Agility + 1d8), combat resolution, character/party statistics, inventory, quests, and level progression.
2. Assets and data: track every imported map, sprite, audio asset, JSON fixture, and runtime loader; preserve licensing and case-sensitive paths.
3. Backend: identify authentication/session ownership, run create/update/progress/resume/delete endpoints, serialization versions, optimistic concurrency, and Mongo collections.
4. Integration: replace standalone placeholders only behind verified original behavior, preserving deep-link/reload and error recovery.
5. Verification: unit fixtures for deterministic RNG, movement/map bounds, turn ordering, enemy actions, inventory and persistence; browser journey from character creation through encounter, save, F5 and resume.

## Non-negotiable checks
- Compare deterministic legacy and standalone outputs for the same fixtures and seeded RNG. Document any intentionally changed rule separately.
- Never trust client-provided owner IDs. Reject cross-account reads/writes and stale revisions.
- Use an isolated synthetic Mongo database for write parity. No staging writer may point to production collections.
- Browser localStorage is origin-scoped: validate an explicit authenticated transfer for existing saves before cutover.
- No deletion of original Chess Studio routes, game code, or assets until standalone gameplay, save portability, staging smoke and rollback all pass.
- Require successful build/tests and a small manual gameplay smoke before declaring parity.

## PR evidence checklist
Each extraction PR must state: source SHA and paths; destination paths; preserved rules; fixtures/tests run; known gaps; deployment impact; rollback. Missing evidence means the feature is **not** marked migrated.

## Next executable slice
Pin source SHA; inventory the real frontend expedition entry and transitive imports; extract a minimal deterministic gameplay module and its original tests, without touching production routing. Follow with map/combat slices, then backend writes and browser integration.
