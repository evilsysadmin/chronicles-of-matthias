"""No-network contract checks for the Chronicles pinned public R2 verifier."""
import hashlib
import json
import pathlib
import tempfile
import unittest

from scripts.verify_chronicles_r2_assets import inspect_response, read_assets

MANIFEST = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "chronicles-r2-sprites.json"


def fixture():
    data = bytearray(30)
    data[:4] = b"RIFF"
    data[8:16] = b"WEBPVP8X"
    data[24:27] = (2560 - 1).to_bytes(3, "little")
    data[27:30] = (320 - 1).to_bytes(3, "little")
    blob = bytes(data)
    return blob, hashlib.sha256(blob).hexdigest()


class PublicR2AtlasTests(unittest.TestCase):
    def test_manifest_contains_all_original_pins(self):
        assets = read_assets(MANIFEST)
        self.assertEqual(len(assets), 14)
        self.assertEqual(len(set(a["name"] for a in assets)), 14)
        for name in ("sewer-spider", "sewer-smuggler", "dire-wolf", "harpy", "troll", "ice-wraith"):
            self.assertIn(name, {a["name"] for a in assets})

    def test_valid_final_webp_cors_and_sha(self):
        image, sha = fixture()
        headers = ("HTTP/1.1 301 Moved Permanently\r\nlocation: /next\r\n\r\n"
                   "HTTP/2 200\r\nContent-Type: image/webp\r\n"
                   "Access-Control-Allow-Origin: https://staging.chronicles.shadowops.dpdns.org\r\n\r\n")
        self.assertIn("R2_OK test-sprite", inspect_response(image, headers, "test-sprite", sha))

    def test_fails_closed_on_headers_and_image(self):
        image, sha = fixture()
        ok = ("HTTP/2 200\ncontent-type: image/webp\n"
              "access-control-allow-origin: *\n\n")
        bad = [
            (image, ok.replace("200", "404"), sha),
            (image, ok.replace("image/webp", "text/html"), sha),
            (image, ok.replace("access-control-allow-origin: *", "access-control-allow-origin: https://evil.example"), sha),
            (image, "HTTP/2 302\nlocation: /redirect\n\n", sha),
            (image[:20], ok, sha),
            (image[:8] + b"NOTWEBPX" + image[16:], ok, sha),
            (image[:24] + b"\x00\x00\x00" + image[27:], ok, sha),
            (image, ok, "0" * 64),
        ]
        for item, headers, digest in bad:
            with self.subTest(case=headers[:32], sha=digest):
                with self.assertRaises(ValueError):
                    inspect_response(item, headers, "test-sprite", digest)

    def test_rejects_malformed_or_duplicate_manifest(self):
        assets = read_assets(MANIFEST)
        for invalid in [
            {"schema": 2, "assets": assets},
            {"schema": 1, "assets": []},
            {"schema": 1, "assets": assets + [assets[0]]},
            {"schema": 1, "assets": [{"name": "../escape", "sha256": "a" * 64}]},
            {"schema": 1, "assets": [{"name": "safe", "sha256": "abc"}]},
        ]:
            with tempfile.TemporaryDirectory() as directory:
                file = pathlib.Path(directory) / "manifest.json"
                file.write_text(json.dumps(invalid))
                with self.assertRaises(ValueError):
                    read_assets(file)


if __name__ == "__main__":
    unittest.main()
