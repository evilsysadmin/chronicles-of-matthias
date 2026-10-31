#!/usr/bin/env python3
"""One public R2 WebP integrity/CORS gate for the pinned Chronicles sprites."""
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

ASSET_ORIGIN = "https://assets.chronicles.shadowops.dpdns.org"
GAME_ORIGIN = "https://staging.chronicles.shadowops.dpdns.org"
MANIFEST = pathlib.Path(__file__).with_name("chronicles-r2-sprites.json")
NAME_RE = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*\Z")
SHA_RE = re.compile(r"[0-9a-f]{64}\Z")
EXPECTED_SIZE = (2560, 320)


def read_assets(path=MANIFEST):
    doc = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    if not isinstance(doc, dict) or doc.get("schema") != 1:
        raise ValueError("Unexpected R2 sprite manifest schema")
    assets = doc.get("assets")
    if not isinstance(assets, list) or not assets:
        raise ValueError("R2 sprite manifest must contain assets")
    seen = set()
    for asset in assets:
        if not isinstance(asset, dict) or set(asset) != {"name", "sha256"}:
            raise ValueError("Malformed R2 asset manifest row")
        name, sha = asset["name"], asset["sha256"]
        if (not isinstance(name, str) or not NAME_RE.fullmatch(name)
                or not isinstance(sha, str) or not SHA_RE.fullmatch(sha)
                or name in seen):
            raise ValueError("Invalid or duplicate pinned R2 sprite asset")
        seen.add(name)
    return assets


def inspect_response(image, raw_headers, name, expected_sha, origin=GAME_ORIGIN):
    """Validate the *final* HTTP response, the exact approved WebP and CORS."""
    blocks = [b.splitlines() for b in raw_headers.replace("\r", "").split("\n\n") if b.strip()]
    if not blocks or not re.fullmatch(r"HTTP/\S+\s+200(?:\s+.*)?", blocks[-1][0]):
        raise ValueError(f"{name}: expected final HTTP 200")
    headers = {}
    for line in blocks[-1][1:]:
        if ":" in line:
            key, val = line.split(":", 1)
            headers[key.strip().lower()] = val.strip()
    if headers.get("content-type", "").split(";", 1)[0].lower() != "image/webp":
        raise ValueError(f"{name}: wrong WebP MIME")
    if headers.get("access-control-allow-origin") not in (origin, "*"):
        raise ValueError(f"{name}: staging CORS blocked")
    if len(image) < 30 or image[:4] != b"RIFF" or image[8:16] != b"WEBPVP8X":
        raise ValueError(f"{name}: invalid extended WebP")
    width = 1 + int.from_bytes(image[24:27], "little")
    height = 1 + int.from_bytes(image[27:30], "little")
    if (width, height) != EXPECTED_SIZE:
        raise ValueError(f"{name}: wrong atlas dimensions {width}x{height}")
    digest = hashlib.sha256(image).hexdigest()
    if digest != expected_sha:
        raise ValueError(f"{name}: SHA-256 changed ({digest})")
    return f"R2_OK {name} HTTP=200 MIME=image/webp CORS=OK SIZE={width}x{height} FRAMES=8 SHA256={digest} cache-control={headers.get('cache-control', '(none)')}"


def check_asset(asset):
    name, sha = asset["name"], asset["sha256"]
    url = f"{ASSET_ORIGIN}/sprites/{name}-{sha[:16]}.webp"
    with tempfile.TemporaryDirectory(prefix="chronicles-r2-") as directory:
        image = pathlib.Path(directory) / "image.webp"
        headers = pathlib.Path(directory) / "headers.txt"
        subprocess.run(
            ["curl", "--fail", "--location", "--silent", "--show-error",
             "--max-time", "25", "--retry", "1", "--header", f"Origin: {GAME_ORIGIN}",
             "--dump-header", str(headers), "--output", str(image), url],
            check=True, timeout=65,
        )
        return inspect_response(image.read_bytes(), headers.read_text(encoding="latin-1"), name, sha)


def main():
    assets = read_assets()
    # Bounded fan-out avoids one slow asset multiplying CI duration by 14.
    # Each download is independently SHA-pinned and checked; no checks are skipped.
    with ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(check_asset, assets):
            print(result, flush=True)
    print(f"CHRONICLES_R2_ATLASES_OK count={len(assets)}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError) as exc:
        print(f"CHRONICLES_R2_ATLAS_FAILURE: {exc}", file=sys.stderr)
        sys.exit(1)
