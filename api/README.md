# Chronicles API

API propia de Chronicles of Matthias: auth (registro con invitación, login,
sesión, cuenta, recuperación), estado del sistema y runs (`/api/chronicles/runs`).

- Es el backend Go de Chess Studio en el que se separó Chronicles (ver
  `docs/PROVENANCE.md`); desde la separación **este repo es su fuente de
  verdad**. El módulo conserva la ruta `github.com/evilsysadmin/chess-studio/backend-go`
  de origen.
- `cmd/chronicles-api/main.go` cablea los handlers que usa el juego.
- Datos propios: `MONGO_DB_NAME` apunta a una base de Chronicles, así que
  cuentas y partidas son independientes de Chess Studio.

Entorno: `MONGO_URL`, `MONGO_DB_NAME`, `JWT_SECRET` (obligatorios),
`INVITE_CODE`, `CORS_ORIGINS`, `ENVIRONMENT`, `PORT` (8080),
`ALLOW_REGISTRATION` (true), `ENABLE_EMAIL_RECOVERY` (false),
`RESEND_API_KEY` / `PASSWORD_RESET_FROM` / `PASSWORD_RESET_URL` (si hay recuperación por email).
