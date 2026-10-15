# First standalone Go API binary

This PR creates a **health-only** standalone Go service compatible with the infra Compose binary path and healthcheck invocation. It intentionally returns 404 for gameplay routes: the game backend has **not** been extracted. Never cut over traffic or deploy this placeholder as a production Chronicles API.

The container uses a non-root static Go binary and scratch runtime. Next extract real gameplay and persistence endpoints, add integration tests, and publish a signed GHCR image only when functionality is present. No changes to Chess Studio.
