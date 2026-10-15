# Go migration plan

Chronicles will progressively replace its Python run API with an independent Go service. Each change requires compatibility tests and preserves existing saved games.

1. Validate Go HTTP health and readiness behavior.
2. Define golden compatibility fixtures for Python run APIs.
3. Introduce MongoDB storage and owner isolation.
4. Migrate run reads before versioned checkpoint writes.
5. Migrate maps and persistent world state.
6. Validate economy and progression on the server.
7. Migrate turn-based combat rules incrementally.
8. Validate the standalone frontend and cross-origin save transfer.
9. Deploy to staging through ShadowOps Infra, then promote a verified release.
10. Retire legacy Chess Studio integration only after rollback and restore tests.

Never deploy two independent writers to the same run state during cutover.
