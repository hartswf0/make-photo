#!/usr/bin/env python3
"""
Deterministic Tier-1 lossless builder for MONOLITH-3.html.

Combines:
- Embedded @font-face rules, #archive print, and terrain/Three.js assets from MONOLITH-3.html
- Tier-1 100% bit-exact lossless asset optimizations:
  * far-surface, near-surface, detail-surface: strip unused G/B/A channels, save .r as lossless WebP
  * canopy: strip unused R channel, save (g, g, b) as lossless WebP
  * river-level, crown-positions, three-core, three-module: zlib level-9 deflate + base64
  * drop unused prop-cobbles
- Modular source files:
  * monolith3/ui.css
  * monolith3/body.html
  * donkey/donkey.js + donkey/coat_*.jpg
  * monolith3/game.js
"""

from __future__ import annotations

import argparse
import base64
import io
import os
import re
import urllib.parse
import zlib
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SURFACE_IDS = {"far-surface", "near-surface", "detail-surface"}
DEFLATE_BIN_IDS = {"river-level", "crown-positions"}
DEFLATE_TEXT_IDS = {"three-core", "three-module"}
DROP_IDS = {"prop-cobbles"}
COAT_FILES = [
    ("coat-side", "donkey/coat_side.jpg"),
    ("coat-top", "donkey/coat_top.jpg"),
    ("coat-front", "donkey/coat_front.jpg"),
    ("coat-rear", "donkey/coat_rear.jpg"),
    ("coat-head", "donkey/coat_head.jpg"),
]


def to_lossless_webp_r_only(b64_uri: str, label: str) -> str:
    if b64_uri.startswith("data:image/webp;"):
        return b64_uri
    raw = base64.b64decode(b64_uri.split(",", 1)[1])
    im = Image.open(io.BytesIO(raw))
    r_ch = im.getchannel(0)
    buf = io.BytesIO()
    r_ch.save(buf, format="WEBP", lossless=True, quality=100, method=6)
    out_bytes = buf.getvalue()
    # Verify bit-exact round-trip on channel 0
    check = Image.open(io.BytesIO(out_bytes)).convert("RGB").getchannel(0)
    diff = max(abs(a - b) for a, b in zip(r_ch.getdata(), check.getdata()))
    assert diff == 0, f"{label}: lossless R channel mismatch diff={diff}"
    return "data:image/webp;base64," + base64.b64encode(out_bytes).decode("ascii")


def to_lossless_webp_canopy(b64_uri: str) -> str:
    if b64_uri.startswith("data:image/webp;"):
        return b64_uri
    raw = base64.b64decode(b64_uri.split(",", 1)[1])
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    _, g, b = im.split()
    packed = Image.merge("RGB", (g, g, b))
    buf = io.BytesIO()
    packed.save(buf, format="WEBP", lossless=True, quality=100, method=6)
    out_bytes = buf.getvalue()
    check = Image.open(io.BytesIO(out_bytes)).convert("RGB")
    diff_g = max(abs(x - y) for x, y in zip(g.getdata(), check.getchannel(1).getdata()))
    diff_b = max(abs(x - y) for x, y in zip(b.getdata(), check.getchannel(2).getdata()))
    assert diff_g == 0 and diff_b == 0, f"canopy mismatch g={diff_g}, b={diff_b}"
    return "data:image/webp;base64," + base64.b64encode(out_bytes).decode("ascii")


def deflate_bytes_b64(raw: bytes, label: str) -> str:
    comp = zlib.compress(raw, level=9)
    assert zlib.decompress(comp) == raw, f"{label}: deflate round-trip mismatch"
    return base64.b64encode(comp).decode("ascii")


def build(source_html: Path, target_html: Path) -> None:
    html = source_html.read_text(encoding="utf-8")

    # 1. Extract font licenses + @font-face declarations up to the last woff2 rule
    style_m = re.search(r"<style>\s*(.*?)\s*</style>", html, re.S)
    assert style_m, "Missing <style> block in source HTML"
    style_body = style_m.group(1)
    marker = 'format("woff2"); }'
    idx = style_body.rfind(marker)
    assert idx != -1, "Missing @font-face rules in <style>"
    font_css = style_body[: idx + len(marker)]

    # 2. Extract #archive src attribute
    arch_m = re.search(r'<img id="archive"[^>]*src="([^"]+)"', html)
    assert arch_m, "Missing #archive data URI"
    archive_src = arch_m.group(1)

    # 3. Extract Three.js license comment block (between </main> and first <script type="text/plain")
    lic_m = re.search(r"</main>\s*(<!-- Three\.js.*?-->)", html, re.S)
    three_license = lic_m.group(1) if lic_m else ""

    # 4. Extract & Tier-1 optimize all <script type="text/plain" ...> assets
    coat_id_set = {cid for cid, _ in COAT_FILES}
    asset_tags: list[str] = []
    saved_bytes = 0

    for m in re.finditer(r'<script\s+type="text/plain"\s+id="([^"]+)"([^>]*)>(.*?)</script>', html, re.S):
        sid, attrs, body = m.group(1), m.group(2), m.group(3).strip()
        if sid in DROP_IDS or sid in coat_id_set:
            saved_bytes += len(body)
            continue

        orig_len = len(body)
        new_attrs = attrs
        new_body = body

        if sid in SURFACE_IDS:
            new_body = to_lossless_webp_r_only(body, sid)
        elif sid == "canopy":
            new_body = to_lossless_webp_canopy(body)
        elif sid in DEFLATE_BIN_IDS:
            if 'data-encoding="deflate"' not in attrs:
                raw = base64.b64decode(body)
                new_body = deflate_bytes_b64(raw, sid)
                new_attrs = ' data-encoding="deflate"'
        elif sid in DEFLATE_TEXT_IDS:
            if 'data-encoding="deflate"' not in attrs:
                raw = body.encode("utf-8")
                new_body = deflate_bytes_b64(raw, sid)
                new_attrs = ' data-encoding="deflate"'

        delta = orig_len - len(new_body)
        saved_bytes += delta
        if delta > 0:
            print(f"  [lossless] {sid:18s}: {orig_len:9,d} -> {len(new_body):9,d} B (saved {delta:,} B)")
        asset_tags.append(f'<script type="text/plain" id="{sid}"{new_attrs}>\n{new_body}\n</script>')

    # 5. Append embedded donkey coat textures
    coat_bytes_total = 0
    for cid, rel_path in COAT_FILES:
        jpg_bytes = (ROOT / rel_path).read_bytes()
        uri = "data:image/jpeg;base64," + base64.b64encode(jpg_bytes).decode("ascii")
        coat_bytes_total += len(uri)
        asset_tags.append(f'<script type="text/plain" id="{cid}">\n{uri}\n</script>')
    print(f"  [coats]    5 donkey coats : +{coat_bytes_total:,} B")

    # 6. Load modular HTML, CSS, donkey.js, and game.js
    ui_css = (ROOT / "monolith3" / "ui.css").read_text(encoding="utf-8")
    body_html = (ROOT / "monolith3" / "body.html").read_text(encoding="utf-8").replace("__ARCHIVE_SRC__", archive_src)
    donkey_js = (ROOT / "donkey" / "donkey.js").read_text(encoding="utf-8")
    game_js = (ROOT / "monolith3" / "game.js").read_text(encoding="utf-8")

    assert "</script>" not in donkey_js, "donkey.js must not contain literal </script>"
    assert "</script>" not in game_js, "game.js must not contain literal </script>"

    favicon_svg = (ROOT / "favicon.svg").read_text(encoding="utf-8")
    favicon_uri = "data:image/svg+xml," + urllib.parse.quote(re.sub(r"\s+", " ", favicon_svg).strip(), safe=",/:;=#")

    out = "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
        '<meta name="theme-color" content="#171715">',
        f'<link rel="icon" type="image/svg+xml" href="{favicon_uri}">',
        "<title>MONOLITH · A field expedition</title>",
        "<style>",
        font_css,
        ui_css,
        "</style>",
        "</head>",
        "<body>",
        body_html.rstrip(),
        three_license,
        *asset_tags,
        '<script id="donkey-module">',
        donkey_js.rstrip(),
        "</script>",
        '<script type="module">',
        game_js.rstrip(),
        "</script>",
        "</body>",
        "</html>",
        "",
    ])

    target_html.write_text(out, encoding="utf-8")
    final_sz = target_html.stat().st_size
    print(f"Built {target_html.name}: {final_sz:,} bytes ({final_sz/1e6:.2f} MB decimal, {final_sz/1048576:.2f} MiB)")
    assert final_sz < 23_000_000, f"Output size {final_sz} exceeds 23 MB budget!"


def main() -> None:
    ap = argparse.ArgumentParser(description="Build Tier-1 lossless MONOLITH-3.html")
    default_target = ROOT / "MONOLITH-3.html"
    ap.add_argument("--source", type=Path, default=default_target)
    ap.add_argument("--target", type=Path, default=default_target)
    args = ap.parse_args()
    build(args.source, args.target)


if __name__ == "__main__":
    main()

