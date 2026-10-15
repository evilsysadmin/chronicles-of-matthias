# Cross-origin save migration contract

Chess Studio and Chronicles subdomains have separate browser storage. The new site **cannot** directly read the old site's localStorage/sessionStorage/IndexedDB.

## Required transfer sequence

1. From the authenticated **old origin**, identify the active user and enumerate Chronicles saved-run metadata and current remote checkpoints without exposing credentials.
2. Build a versioned, bounded, schema-validated transfer payload. Preserve run IDs, party, inventory, world flags, quests and checkpoint provenance; never trust unvalidated JSON.
3. Deliver the payload to the new origin only through an explicitly user-authorized flow (e.g. downloadable export/import, or a one-time server-issued transfer token). Do not place save data in URL query parameters.
4. On the **new origin**, verify account ownership, schema version, size and integrity; reject cross-account transfers. Deduplicate by stable run ID and prevent overwriting a newer remote checkpoint.
5. Display import preview and result; keep old saves intact and provide retry/rollback. Import must be idempotent.
6. Test interrupted transfer, stale tokens, malformed data, legacy saves, F5 resume, mobile and cross-account isolation.

## Current behavior

The existing `chroniclesRefreshResume.js` stores a **session-only navigation hint**, not the canonical game state. It uses key `chess-study-chronicles-playing-v1` and depends on the existing saved-run catalog and server checkpoint. Do not treat copying that hint as save migration.

**No cutover** until a real transfer implementation and tests satisfy this contract.
