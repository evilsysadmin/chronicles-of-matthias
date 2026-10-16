# Independent staging web shell

This is a static, dependency-free **deployment probe**, not a playable build. Serve the `web/` directory from any static HTTP server. No external resources, credentials, cookies, storage or API calls are used.

The actual Chronicles UI currently lives in Chess Studio under `frontend/src/components/ChroniclesOfMatthias.jsx` and depends on multiple game modules/assets. Follow-up PRs must extract the dependency closure and bundle it with Vite before changing this staging shell to a playable entrypoint.

Do not route production traffic or promise save compatibility based on this page alone.
