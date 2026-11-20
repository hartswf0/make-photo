#!/usr/bin/env python3
"""Bundles engine_template.html + crucible_pack.json into dependency-free scion-demiurge/index.html."""
import hashlib
import os

ROOT = "/Users/gaia/make-photo/make-photo/scion-demiurge"
tpl_path = os.path.join(ROOT, "runtime", "engine_template.html")
pack_path = os.path.join(ROOT, "compiled", "crucible_pack.json")
out_path = os.path.join(ROOT, "index.html")

tpl = open(tpl_path, "r", encoding="utf-8").read()
pack_json = open(pack_path, "r", encoding="utf-8").read()
assert "__CRUCIBLE_PACK_JSON__" in tpl, "Placeholder missing in template"

html = tpl.replace("__CRUCIBLE_PACK_JSON__", pack_json, 1)
with open(out_path, "w", encoding="utf-8") as f:
    f.write(html)

sz = os.path.getsize(out_path)
digest = hashlib.sha256(html.encode("utf-8")).hexdigest()
print(f"[SCION DEMIURGE] Bundled single-file runtime: {out_path} ({sz / 1024:.1f} KB · sha256={digest[:16]}...)")

