# Legacy Chronicles write contract — extraction gate

Source of truth: `chess-studio/backend-python/chronicles_run_store.py` and `chess-studio/backend-go/internal/chroniclesrun/store.go`. Before implementing standalone HTTP writes, pin an exact source SHA and compare the full request/response contract against these implementations.

## Persistent run model
Mongo collection: `chronicles_runs`; identity key `_id` is the run ID; `owner` is derived from authenticated server-side identity, never a client header. Stored fields include `seed`, `currentMapId`, `contentVersion`, `manifestRevision`, `status`, `worldVersion`, `consumedContentIds`, `claimedRewards`, `worldFlags`, `inventory`, `quests`, `createdAt`, `updatedAt`, `createFingerprint`, and optional `partyLevel`, `contentPlacementVersion`, route metadata and `plannerSnapshot`.

## Write invariants
1. **Create/replay:** insert only if absent. An existing ID is replayable only for the same authenticated owner and identical `createFingerprint`; otherwise `idempotency-conflict`. Replay must not allocate a new seed or planner result.
2. **Checkpoint:** update only an active run belonging to the authenticated owner whose `worldVersion` equals `expected_world_version`. Increment by exactly one atomically; a stale version produces `world-version-conflict`. Missing or foreign runs are indistinguishable.
3. **Monotonic collections:** `consumedContentIds` and `claimedRewards` are set-like additions, never replacements or removals. Do not resurrect consumed content or regrant rewards.
4. **Terminal state:** once terminal, further checkpoints fail with `run-terminal`, except an identical replay of the terminal checkpoint at the preceding expected version, which returns the stored result.
5. **Deletion:** delete only by both run ID and authenticated owner. A missing/foreign ID returns false without leaking existence.
6. **Read isolation:** all reads and listings filter by authenticated owner. Public responses must omit `owner` and `createFingerprint`.
7. **Durability:** Mongo failures fail closed; do not silently fall back to ephemeral in-memory state in staging or production.

## Test matrix before enabling standalone writes
- Fresh create, exact retry, changed fingerprint, other-owner ID collision.
- Checkpoint succeeds once, stale concurrent checkpoint rejected, read-after-write/F5 returns updated inventory, quests and world flags.
- Duplicate consumed IDs/reward claims remain unique and never disappear on subsequent checkpoints.
- Terminal transition, exact terminal retry, altered retry rejected.
- Cross-user get/list/checkpoint/delete denial; missing/foreign indistinguishability.
- Invalid payloads, Mongo unavailable, interrupted/retried operations.
- Compare semantic public JSON with legacy Python fixtures, including optional route/planner/party fields and timestamps.

## Deployment gates
- Use only an isolated synthetic Mongo staging database for write tests.
- Keep write routes disabled by default, reject production opt-in, and require verified JWT/session revision.
- Independently validate standalone frontend, cross-origin save continuity, OCI staging smoke and rollback before production cutover.
- Never remove Chess Studio's live Chronicles routes while these gates remain incomplete.

Tracking: #52. This document is a preliminary invariant inventory, **not** proof of complete HTTP contract parity; exact source-SHA and golden fixtures remain follow-up work.
