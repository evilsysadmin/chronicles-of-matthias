# Checkpoint validation extraction — first subset

Pure Go decoding and validation of selected existing Python checkpoint invariants. **Not yet parity-complete**: inventory/quest item schemas, payload byte limits, normalization/deduplication, exact Pydantic field presence/type semantics, map transitions, persistence, authorization and optimistic concurrency remain unimplemented.

The new validator is intentionally **not wired to HTTP**. Do not enable writes or claim save compatibility until parity fixtures and security tests pass. Source of truth remains Chess Studio's `backend-python/chronicles_api.py`. No changes to Chess Studio.
