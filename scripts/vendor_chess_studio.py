#!/usr/bin/env python3
"""Vendor Chronicles of Matthias *verbatim* from a pinned Chess Studio commit.

The standalone game is not a port: it is the exact Chess Studio source graph
reachable from the game's entry points, copied byte for byte into
``frontend/src``. Only ``frontend/src/standalone/`` is authored here.

Usage:
  vendor_chess_studio.py sync  <chess-studio-checkout>   # (re)vendor + lock
  vendor_chess_studio.py check [<chess-studio-checkout>] # verify lock/bytes

``check`` without a checkout verifies that no vendored file was edited by
hand (sha256 vs lock) and that nothing unlisted crept into the vendored
tree. With a checkout at the locked SHA it also proves byte identity with
the upstream source.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
FRONTEND = REPO / "frontend"
DEST = FRONTEND / "src"
LOCK = FRONTEND / "VENDOR.lock.json"
OWNED = "standalone"  # frontend/src/standalone/ is ours; everything else is vendored

# Entry points of the game exactly as Chess Studio mounts them.
ENTRIES = [
    "components/ChroniclesOfMatthias.jsx",
    "components/ChroniclesOfMatthiasTactics.jsx",
    "components/LoginScreen.jsx",
    "styles.css",
    "styles/29-motion-coherence.css",
    "styles/30-modal-layering.css",
    "userPreferences.js",
]

JS_EXT = (".js", ".jsx", ".mjs")
RESOLVE = ["", ".js", ".jsx", ".mjs", "/index.js", "/index.jsx"]
JS_IMPORT = re.compile(
    r"""(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]"""
    r"""|\bimport\s*['"]([^'"]+)['"]"""
    r"""|\bimport\(\s*['"]([^'"]+)['"]\s*\)"""
    r"""|new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url"""
)
# Vite glob imports: import.meta.glob('./maps/*.json') or an array of patterns.
GLOB_CALL = re.compile(r"""import\.meta\.glob\(\s*(\[[^\]]*\]|['"][^'"]+['"])""")
GLOB_PATTERN = re.compile(r"""['"]([^'"]+)['"]""")
# Anything dynamic we cannot resolve statically must stop vendoring, never
# silently drop files (a missing glob once shipped a game without 44 maps).
DYNAMIC = re.compile(r"""import\(\s*[^'"\s)]|new\s+URL\(\s*`|import\.meta\.glob\(\s*[^'"\[\s]""")
CSS_IMPORT = re.compile(r"""@import\s+(?:url\()?\s*['"]?([^'")\s;]+)""")
CSS_URL = re.compile(r"""url\(\s*['"]?([^'")]+)['"]?\s*\)""")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def resolve(base: Path, spec: str, src_root: Path) -> Path | None:
    spec = spec.split("?")[0].split("#")[0]
    target = (base.parent / spec).resolve()
    for ext in RESOLVE:
        candidate = Path(str(target) + ext)
        if candidate.is_file():
            try:
                candidate.relative_to(src_root)
            except ValueError:
                raise SystemExit(f"{base}: import escapes src/: {spec}")
            return candidate
    return None


def closure(src_root: Path) -> tuple[list[str], set[str]]:
    seen: set[Path] = set()
    packages: set[str] = set()
    unresolved: list[str] = []
    stack = [src_root / e for e in ENTRIES]
    while stack:
        path = stack.pop()
        if path in seen:
            continue
        seen.add(path)
        if path.suffix in JS_EXT:
            text = path.read_text(encoding="utf-8", errors="replace")
            specs = [next(g for g in m.groups() if g) for m in JS_IMPORT.finditer(text)]
            for m in DYNAMIC.finditer(text):
                unresolved.append(f"{path.relative_to(src_root)} -> unsupported dynamic import: {m.group(0)}")
            for call in GLOB_CALL.findall(text):
                for pattern in GLOB_PATTERN.findall(call):
                    if pattern.startswith("!") or not pattern.startswith("."):
                        unresolved.append(f"{path.relative_to(src_root)} -> unsupported glob: {pattern}")
                        continue
                    hits = sorted(path.parent.glob(pattern))
                    if not hits:
                        unresolved.append(f"{path.relative_to(src_root)} -> empty glob: {pattern}")
                    for hit in hits:
                        hit = hit.resolve()
                        hit.relative_to(src_root)
                        if hit.is_file():
                            stack.append(hit)
        elif path.suffix == ".css":
            text = path.read_text(encoding="utf-8", errors="replace")
            specs = CSS_IMPORT.findall(text) + CSS_URL.findall(text)
        else:
            continue
        for spec in specs:
            if spec.startswith(("data:", "http:", "https:", "#", "/")):
                continue
            if spec.startswith("."):
                hit = resolve(path, spec, src_root)
                if hit is None:
                    unresolved.append(f"{path.relative_to(src_root)} -> {spec}")
                else:
                    stack.append(hit)
            elif path.suffix in JS_EXT:
                parts = spec.split("/")
                packages.add("/".join(parts[:2]) if spec.startswith("@") else parts[0])
    if unresolved:
        raise SystemExit("Unresolved imports:\n  " + "\n  ".join(sorted(set(unresolved))))
    return sorted(str(p.relative_to(src_root)) for p in seen), packages


def vendored_on_disk() -> list[str]:
    out = []
    for path in DEST.rglob("*"):
        if path.is_file():
            rel = path.relative_to(DEST)
            if rel.parts[0] != OWNED:
                out.append(str(rel))
    return sorted(out)


def sync(checkout: Path) -> None:
    checkout = checkout.resolve()
    src_root = (checkout / "frontend" / "src").resolve()
    sha = subprocess.check_output(["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True).strip()
    if subprocess.check_output(["git", "-C", str(checkout), "status", "--porcelain"], text=True).strip():
        raise SystemExit("Chess Studio checkout is dirty: refusing to vendor")
    files, packages = closure(src_root)
    for rel in vendored_on_disk():
        (DEST / rel).unlink()
    for rel in files:
        target = DEST / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_root / rel, target)
    for d in sorted((p for p in DEST.rglob("*") if p.is_dir()), reverse=True):
        if not any(d.iterdir()):
            d.rmdir()
    lock = {
        "source": "evilsysadmin/chess-studio",
        "commit": sha,
        "entries": ENTRIES,
        "packages": sorted(packages),
        "files": {rel: sha256(DEST / rel) for rel in files},
    }
    LOCK.write_text(json.dumps(lock, indent=1, sort_keys=False) + "\n", encoding="utf-8")
    print(f"Vendored {len(files)} files from chess-studio@{sha[:12]}; packages: {', '.join(sorted(packages))}")


def check(checkout: Path | None) -> None:
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    errors = []
    on_disk = set(vendored_on_disk())
    locked = set(lock["files"])
    errors += [f"unlisted vendored file: {f}" for f in sorted(on_disk - locked)]
    errors += [f"missing vendored file: {f}" for f in sorted(locked - on_disk)]
    for rel in sorted(on_disk & locked):
        if sha256(DEST / rel) != lock["files"][rel]:
            errors.append(f"modified vendored file (edit upstream and re-vendor): {rel}")
    if checkout is not None:
        sha = subprocess.check_output(["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True).strip()
        if sha != lock["commit"]:
            errors.append(f"checkout is {sha}, lock pins {lock['commit']}")
        else:
            src_root = (checkout / "frontend" / "src").resolve()
            files, _ = closure(src_root)
            if set(files) != locked:
                errors.append("upstream closure differs from lock (re-run sync)")
            for rel in sorted(locked):
                upstream = src_root / rel
                if not upstream.is_file() or sha256(upstream) != lock["files"][rel]:
                    errors.append(f"not byte-identical to upstream: {rel}")
    if errors:
        raise SystemExit("Vendor check failed:\n  " + "\n  ".join(errors))
    print(f"OK: {len(locked)} files byte-identical to chess-studio@{lock['commit'][:12]}")


def main(argv: list[str]) -> None:
    if len(argv) >= 2 and argv[1] == "sync" and len(argv) == 3:
        sync(Path(argv[2]))
    elif len(argv) >= 2 and argv[1] == "check" and len(argv) in (2, 3):
        check(Path(argv[2]).resolve() if len(argv) == 3 else None)
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv)
