# Chronicles of Matthias

Independent repository for Chronicles of Matthias, originally developed inside [Chess Studio](https://github.com/evilsysadmin/chess-studio).

**Migration in progress:** the playable game remains in Chess Studio until independent builds, tests, deployment and save portability are validated.

## Migration safeguards

- Pin a Chess Studio source commit and inventory all Chronicles code, assets, dependencies and tests.
- Preserve gameplay rules and existing player saves.
- Establish independent CI and staging before production cutover.
- Cross-origin browser saves require an explicit verified transfer mechanism.
- Keep rollback available; do not remove the original game prematurely.
- Godot is a separate future prototype, not part of the extraction.

Tracking: [Chess Studio #5632](https://github.com/evilsysadmin/chess-studio/issues/5632).
