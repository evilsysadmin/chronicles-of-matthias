# Historical save migration: private, read-only reconciliation

Run this only **after authorised, complete exports** of the historical source
`chronicles_runs` and independent Chronicles target `chronicles_runs`.

The current operator importer uses Chess Studio staging
(`chess_study_staging`), whereas Chess Studio production uses `chess_study`.
Do not connect the staging importer to production automatically. Obtain a
separately reviewed, read-only production export if migration of those saves
is required. Never upload these files to Git, CI artifacts or a chat.

```bash
umask 077
# Create source.jsonl and target.jsonl privately with approved mongoexport
cd api
go run ./cmd/legacyreconcile \
  -source /private/source.jsonl -target /private/target.jsonl
```

This standard-library-only command reads local mongoexport JSON Lines,
including string IDs and Extended JSON `{"$oid":"..."}`. It does not open a
database, make network calls, modify files or print any owners, IDs, paths,
or save payloads. It prints aggregate `sourceRuns`, `targetRuns`,
`missing`, `wrongOwner` and `extraTarget`. New saves in target and
checkpoint updates after import are permitted.

Exit 0: each source ID is present with its **original owner**; exit 1:
missing IDs or owner mismatch; exit 2: bad/corrupt input, duplicate IDs,
or empty source (which could be an accidentally wrong source database).
Only a collection inventory, not a proof of browser gameplay compatibility
or source completeness. Use Chess Studio's separate archive doctor for
byte/document-level backup/restore verification before an import. Keep the
Chess Studio historical recovery and owner-based purge until all evidence
is obtained. Track: Chronicles #482 / Chess Studio #5632.
