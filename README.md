# Chronicles of Matthias

Juego de rol en primera persona estilo Might and Magic III, con su modo Tactics.
Nació dentro de [Chess Studio](https://github.com/evilsysadmin/chess-studio) y
desde octubre de 2026 vive aquí: **este repo es la única fuente de verdad del
juego y de su API** (origen en [`docs/PROVENANCE.md`](docs/PROVENANCE.md)).

| Parte | Ruta | Desplegado en |
| --- | --- | --- |
| Juego (React + Three.js) | `frontend/` | `https://staging.chronicles.shadowops.dpdns.org` (Cloudflare Pages) |
| API (Go: cuentas, sesión y partidas guardadas — saves) | `api/` | `https://chronicles-api-staging.shadowops.dpdns.org` (OCI A1 + túnel propio) |
| Pipeline de arte y mundo | `scripts/art`, `scripts/blender`, `scripts/chronicles` | — |

La infraestructura (Pages, túnel, Vault, despliegue en OCI) vive en
[`shadowops-infra`](https://github.com/evilsysadmin/shadowops-infra).

## Desarrollo

```sh
cd frontend && npm ci
npm test                 # tests del juego (Vitest)
VITE_API_URL=http://127.0.0.1:8090/api npm run dev

cd api && go build ./cmd/chronicles-api   # MONGO_URL, MONGO_DB_NAME, JWT_SECRET
```

CI: `react-frontend.yml` (tests, build, smoke de montaje) y `api.yml` (build,
E2E del juego real contra la API y un MongoDB; en `main` publica la imagen
`ghcr.io/evilsysadmin/chronicles-api:staging-<sha>`).
