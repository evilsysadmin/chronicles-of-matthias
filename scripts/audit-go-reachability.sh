#!/usr/bin/env bash
# Advisory Go import reachability. A package outside command graphs can still be
# used by unit tests, code generators, build-tag variants or external tools.
set -euo pipefail
api_dir="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../api" && pwd)}"
cd "$api_dir"
export GOTOOLCHAIN=local
module="$(go list -m)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

go list -f '{{.ImportPath}}' ./internal/... | LC_ALL=C sort -u > "$tmp/all"
go list -deps -f '{{.ImportPath}}' ./cmd/chronicles-api | LC_ALL=C sort -u > "$tmp/server-deps"
go list -deps -f '{{.ImportPath}}' ./cmd/... | LC_ALL=C sort -u > "$tmp/command-deps"
for category in server-deps command-deps; do
  awk -v prefix="$module/internal/" 'index($0, prefix) == 1' "$tmp/$category" > "$tmp/$category-internal"
done
comm -23 "$tmp/all" "$tmp/server-deps-internal" > "$tmp/not-server"
comm -12 "$tmp/not-server" "$tmp/command-deps-internal" > "$tmp/other-commands"
comm -23 "$tmp/all" "$tmp/command-deps-internal" > "$tmp/review"
printf 'GO_INTERNAL_AUDIT total=%s server=%s other_commands=%s review=%s\n' \
  "$(wc -l < "$tmp/all" | tr -d ' ')" \
  "$(wc -l < "$tmp/server-deps-internal" | tr -d ' ')" \
  "$(wc -l < "$tmp/other-commands" | tr -d ' ')" \
  "$(wc -l < "$tmp/review" | tr -d ' ')"
printf 'Go packages used by other command entrypoints (not by the API server):\n'
sed 's/^/  /' "$tmp/other-commands"
printf 'Go packages not reached from any cmd/... production import graph (manual review only):\n'
sed 's/^/  /' "$tmp/review"
# Reporting only: no file edits, no package removals, no failure on candidates.
