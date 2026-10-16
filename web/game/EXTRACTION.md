# First extracted Chronicles mechanic: the character forge

The staging landing shell now includes a **real, interactive party editor**
powered by unchanged game-rule source copied from Chess Studio's
`41535b8f482f2f0eab3221725a607a5a4bab9b3a`:
`frontend/src/chronicles/chroniclesMM3Rules.js` and
`frontend/src/chronicles/chroniclesCharacterBuilds.js`, independently served
as `web/game/*.js` browser ES modules.

The editor supports the canonical company, rerolling all seven 3d6 attributes,
all ten rule-constrained classes, names, races, sex/alignment choices, and
actual derived HP/SP/attack/initiative/armor values. The logic does not depend
on Chess Studio auth, API or browser storage. It **does not save**, issue
network requests, call production services, or constitute a playable campaign.
All changes are temporary to the open tab and disappear on reload.

## What this does not prove

- The dungeon exploration engine and runtime, character inventory, equipment,
  combat, quests, persistence and account management are **not yet extracted**.
- This preview's party is not automatically imported into real saves.
- No claim of live public deployment, DNS/TLS activation, or OCI container
  installation is made by merging the source PR.
- The existing deployment smoke marker `todavía no es el juego` is retained
  on purpose so Cloudflare Pages and OCI checks remain accurate.
- ShadowOps Infra retains complete control of Cloudflare/OCI deployments.

## Verification

`npm test` exercises the exact MM3 build and rules modules with Node and
an offline no-network widget contract. The independent nginx image copies
the browser modules; the existing ARM64 image test fetches their URLs before
publishing its signed multiarch manifest. The Pages staging publisher still
runs the app's shell test and checks the unchanged non-playable marker.

Do not remove the legacy Chess Studio feature or transfer live saved games
until the complete independent runtime has parity and a separately tested,
owner-scoped migration.
