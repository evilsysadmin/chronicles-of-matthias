# Chronicles API

API propia de Chronicles of Matthias: auth (registro con invitación, login,
sesión, cuenta, recuperación), estado del sistema y runs (`/api/chronicles/runs`).

- **Todo `api/internal/`, `go.mod` y `go.sum` es el backend Go de Chess Studio
  copiado byte a byte** (`VENDOR.lock.json`, verificado en CI contra el SHA
  fijado). Por eso el módulo conserva la ruta `github.com/evilsysadmin/chess-studio/backend-go`.
- Lo único propio es `cmd/chronicles-api/main.go`, que cablea esos handlers
  igual que `backend-go/cmd/pvp-edge/native_runtime.go`.
- Datos propios: `MONGO_DB_NAME` apunta a una base de Chronicles, así que
  cuentas y partidas son independientes de Chess Studio.

Re-vendorizar tras cambiar el backend en Chess Studio:

```sh
python3 scripts/vendor_chess_studio_api.py sync <checkout-de-chess-studio>
```

Entorno: `MONGO_URL`, `MONGO_DB_NAME`, `JWT_SECRET` (obligatorios),
`INVITE_CODE`, `CORS_ORIGINS`, `ENVIRONMENT`, `PORT` (8080),
`ALLOW_REGISTRATION` (true), `ENABLE_EMAIL_RECOVERY` (false),
`RESEND_API_KEY` / `PASSWORD_RESET_FROM` / `PASSWORD_RESET_URL` (si hay recuperación por email).
