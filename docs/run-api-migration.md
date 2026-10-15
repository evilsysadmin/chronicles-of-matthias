# Chronicles run API compatibility baseline

Derived from Chess Studio's `frontend/src/chronicles/chroniclesRunClient.js`. This is a **client-facing inventory**, not a claim that the new Go binary implements these routes. Today the new binary deliberately returns 404 for gameplay APIs.

Before implementing the five run endpoints, pin a source SHA and inspect the existing Python backend request/response schemas, authentication, Mongo ownership checks, checkpoint version conflicts, idempotency and recovery behavior. Add fixtures comparing actual legacy responses and negative authorization cases. Never return dummy success responses or create a second incompatible save format.

Chess Studio remains authoritative until the new backend is verified end-to-end.
