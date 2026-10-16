#!/usr/bin/env python3
"""Vendor Chronicles' API *verbatim* from a pinned Chess Studio commit.

api/ keeps Chess Studio's Go module path so every vendored file stays byte
identical (Go's internal/ rule then lets our command import them). The only
authored code is api/cmd/chronicles-api/. Everything else under api/ —
go.mod, go.sum and the internal packages our command transitively imports —
is copied byte for byte and locked by sha256 in api/VENDOR.lock.json.

Usage:
  vendor_chess_studio_api.py sync  <chess-studio-checkout>
  vendor_chess_studio_api.py check [<chess-studio-checkout>]
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
API = REPO / "api"
LOCK = API / "VENDOR.lock.json"
OWNED = ("cmd", "VENDOR.lock.json", "Dockerfile", "README.md", ".dockerignore")
MODULE = "github.com/evilsysadmin/chess-studio/backend-go"
TOP_FILES = ("go.mod", "go.sum")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def go(*args: str, cwd: Path) -> str:
    return subprocess.check_output(["go", *args], cwd=cwd, text=True)


def closure(backend: Path) -> list[str]:
    """Internal packages our command imports, resolved in the upstream module."""
    roots = go("list", "-f", '{{join .Imports "\\n"}}', "./cmd/chronicles-api", cwd=API).split()
    roots = [p for p in roots if p.startswith(MODULE + "/")]
    deps = go("list", "-deps", "-f", "{{.ImportPath}}", *roots, cwd=backend).split()
    files: list[str] = list(TOP_FILES)
    for pkg in sorted(p for p in deps if p.startswith(MODULE + "/internal/")):
        rel_dir = pkg[len(MODULE) + 1:]
        # Non-test Go files and embedded assets the package ships with; tests
        # stay upstream (they may need fixtures from outside the closure).
        listed = go("list", "-f",
                    '{{range .GoFiles}}{{.}}\n{{end}}{{range .EmbedFiles}}{{.}}\n{{end}}', "./" + rel_dir,
                    cwd=backend).split()
        files += [f"{rel_dir}/{name}" for name in listed]
    return sorted(set(files))


def vendored_on_disk() -> list[str]:
    out = []
    for path in API.rglob("*"):
        if path.is_file():
            rel = path.relative_to(API)
            if rel.parts[0] not in OWNED:
                out.append(str(rel))
    return sorted(out)


def sync(checkout: Path) -> None:
    checkout = checkout.resolve()
    backend = checkout / "backend-go"
    sha = subprocess.check_output(["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True).strip()
    if subprocess.check_output(["git", "-C", str(checkout), "status", "--porcelain"], text=True).strip():
        raise SystemExit("Chess Studio checkout is dirty: refusing to vendor")
    # go.mod must exist before `go list` can read our command's imports.
    for name in TOP_FILES:
        shutil.copy2(backend / name, API / name)
    files = closure(backend)
    for rel in vendored_on_disk():
        (API / rel).unlink()
    for rel in files:
        target = API / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(backend / rel, target)
    for d in sorted((p for p in API.rglob("*") if p.is_dir()), reverse=True):
        if not any(d.iterdir()):
            d.rmdir()
    lock = {
        "source": "evilsysadmin/chess-studio",
        "path": "backend-go",
        "commit": sha,
        "module": MODULE,
        "files": {rel: sha256(API / rel) for rel in files},
    }
    LOCK.write_text(json.dumps(lock, indent=1) + "\n", encoding="utf-8")
    print(f"Vendored {len(files)} API files from chess-studio@{sha[:12]}")


def check(checkout: Path | None) -> None:
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    errors = []
    on_disk, locked = set(vendored_on_disk()), set(lock["files"])
    errors += [f"unlisted vendored file: {f}" for f in sorted(on_disk - locked)]
    errors += [f"missing vendored file: {f}" for f in sorted(locked - on_disk)]
    for rel in sorted(on_disk & locked):
        if sha256(API / rel) != lock["files"][rel]:
            errors.append(f"modified vendored file (edit upstream and re-vendor): {rel}")
    if checkout is not None:
        backend = checkout.resolve() / "backend-go"
        sha = subprocess.check_output(["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True).strip()
        if sha != lock["commit"]:
            errors.append(f"checkout is {sha}, lock pins {lock['commit']}")
        else:
            if set(closure(backend)) != locked:
                errors.append("upstream closure differs from lock (re-run sync)")
            for rel in sorted(locked):
                up = backend / rel
                if not up.is_file() or sha256(up) != lock["files"][rel]:
                    errors.append(f"not byte-identical to upstream: {rel}")
    if errors:
        raise SystemExit("API vendor check failed:\n  " + "\n  ".join(errors))
    print(f"OK: {len(locked)} API files byte-identical to chess-studio@{lock['commit'][:12]}")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "sync":
        sync(Path(sys.argv[2]))
    elif len(sys.argv) in (2, 3) and sys.argv[1] == "check":
        check(Path(sys.argv[2]) if len(sys.argv) == 3 else None)
    else:
        raise SystemExit(__doc__)
