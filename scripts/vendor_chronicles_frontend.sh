#!/usr/bin/env bash
# Copy all Chronicles-specific React/runtime source from an immutable
# Chess Studio revision without importing unrelated chess code or overwriting
# the standalone frontend. The snapshot is inactive until parity is proven.
set -euo pipefail
if [ "$#" -ne 2 ]; then
  echo "Usage: vendor_chronicles_frontend.sh <chess-studio-checkout> <chronicles-checkout>" >&2
  exit 2
fi
legacy="$(realpath "$1")"
target="$(realpath "$2")"
source_sha="ab0531d7e2812eed8c24003e8ef3386e8853b5a9"
actual="$(git -C "$legacy" rev-parse HEAD)"
if [ "$actual" != "$source_sha" ]; then
  echo "Rejecting unpinned Chess Studio checkout" >&2
  exit 1
fi
if [ ! -f "$legacy/frontend/src/components/ChroniclesOfMatthias.jsx" ] ||
   [ ! -f "$target/frontend/package.json" ]; then
  echo "Unexpected source/destination layout" >&2
  exit 1
fi
snapshot="$target/frontend/original-chess-studio"
if [ -e "$snapshot" ]; then
  echo "Snapshot destination already exists: refusing overwrite" >&2
  exit 1
fi
mkdir -p "$snapshot/src/components" "$snapshot/src/assets"
src="$legacy/frontend/src"
# Preserve original *relative* import structure across the entire game code,
# maps, tests, authored campaign content, sound boundaries, sprites and UI art.
cp -a "$src/chronicles" "$snapshot/src/chronicles"
cp -a "$src/assets/chronicles" "$snapshot/src/assets/chronicles"
while IFS= read -r -d '' path; do
  cp -a "$path" "$snapshot/src/components/"
done < <(find "$src/components" -maxdepth 1 -type f -name 'Chronicles*' -print0 | sort -z)
while IFS= read -r -d '' path; do
  cp -a "$path" "$snapshot/src/"
done < <(find "$src" -maxdepth 1 -type f -name 'chronicles*' -print0 | sort -z)
for file in sound.js soundFx.js soundPreferences.js safeStorage.js useEscapeToClose.js labLaunchIntent.js; do
  cp -a "$src/$file" "$snapshot/src/$file"
done
cat > "$snapshot/PROVENANCE.md" <<EOF
# Original Chronicles frontend — immutable migration snapshot

Source: \`evilsysadmin/chess-studio@$source_sha\`

This is the complete relevant **Chronicles-specific source snapshot**:
Chronicles React components/CSS, all game modules, authored maps and tests,
portrait/UI/sprite assets, plus shared helper sources required by original
imports. Its contents are not imported by production until modules have
been isolated from legacy auth/saves/sound and verified. Do not silently
modify these originals, or mistake a source snapshot for a playable port.

Active compiled entry remains \`frontend/src/App.jsx\`. Replace modules
incrementally, preserving source provenance and tests.
EOF
find "$snapshot" -type l -print -quit | grep -q . && {
  echo "Rejecting symlink in snapshot" >&2
  exit 1
}
test -f "$snapshot/src/components/ChroniclesSaveMenu.jsx"
test -f "$snapshot/src/components/ChroniclesMM3Chrome.css"
test -f "$snapshot/src/components/ChroniclesOfMatthias.jsx"
test -f "$snapshot/src/chronicles/chroniclesMapCatalog.js"
test -f "$snapshot/src/assets/chronicles/ui/mm3-sapphire.png"
echo "CHRONICLES_FRONTEND_SOURCE_SNAPSHOT_OK $source_sha"
