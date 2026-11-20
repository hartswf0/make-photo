#!/usr/bin/env python3
"""python3 verify.py [--cut Y] -> runs verify.mjs (head ratio / Jacobian / IK gates), 3-view silhouette IoU vs the reference
bust image, and the license lint. Writes verify-report.json and prints a summary. Exit code 1 if a hard gate fails."""
import json, os, re, subprocess, sys, base64, importlib.metadata as md, glob
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
REF = "/Users/gaia/.gemini/antigravity/brain/7c730d47-ad4a-425b-899e-db9b45832307/.user_uploaded/media_1795119163574_0b07591c.jpg"
report = {"hard_pass": True}

# ------------------------------------------------------------------ 1) mjs gates
r = subprocess.run(["node", os.path.join(HERE, "verify.mjs")], capture_output=True, text=True)
mj = json.load(open(os.path.join(HERE, "verify-mjs.json")))
report["head_ratio"] = mj["heads"]; report["jacobian"] = mj["jacobian"]; report["ik"] = mj["ik"]
report["hard_pass"] &= r.returncode == 0

# ------------------------------------------------------------------ 2) silhouette IoU
def load_fig(key):
    src = open(os.path.join(HERE, "assets/human-assets.js")).read()
    m = re.search(r'HUMAN_FORGE_ASSETS\["%s"\]=\{meta:(\{.*?\}),blob:\'([A-Za-z0-9+/=]+)\'\};' % key, src, re.S)
    meta = json.loads(m.group(1)); blob = base64.b64decode(m.group(2)); L = meta["layout"]
    g = lambda k: np.frombuffer(blob, dtype=np.dtype(L[k]["dtype"]), count=L[k]["count"], offset=L[k]["offset"])
    return meta, {k: g(k) for k in L}

def raster(tris2d, W, H):
    im = Image.new("L", (W, H), 0); d = ImageDraw.Draw(im)
    for t in tris2d: d.polygon([tuple(p) for p in t], fill=255)
    return np.array(im) > 0

def sil(meta, D, yaw_deg, cut_frac, hair=True, px=640):
    P = D["pos"].reshape(-1, 3).astype(np.float64); F = D["idx"].reshape(-1, 3).astype(np.int64)
    parts = [(P, F)]
    if hair and "h_pos" in D: parts.append((D["h_pos"].reshape(-1, 3).astype(np.float64), D["h_idx"].reshape(-1, 3).astype(np.int64)))
    c, s = np.cos(np.radians(yaw_deg)), np.sin(np.radians(yaw_deg)); Hh = meta["info"]["stature"]; cut = cut_frac * Hh
    polys = []
    for p, f in parts:
        x = c * p[:, 0] + s * p[:, 2]; y = p[:, 1]
        keep = (y[f] >= cut).all(1)  # whole-triangle bust cut (matches the runtime cut plane to within a triangle)
        polys.append(np.stack([x[f[keep]], y[f[keep]]], -1))
    pts = np.concatenate(polys); x0, x1, y0, y1 = pts[..., 0].min(), pts[..., 0].max(), pts[..., 1].min(), pts[..., 1].max()
    return pts, (x0, x1, y0, y1)

def ref_masks():
    im = np.asarray(Image.open(REF).convert("RGB")).astype(float); h, w, _ = im.shape
    bg = np.median(np.concatenate([im[:6, :6].reshape(-1, 3), im[:6, -6:].reshape(-1, 3), im[-6:, :6].reshape(-1, 3)]), 0)
    m = np.linalg.norm(im - bg, axis=2) > 32; m = ndimage.binary_opening(m, iterations=1); m = ndimage.binary_fill_holes(m)
    out = []
    for i in range(3):
        sub = m[:, i * w // 3:(i + 1) * w // 3]; lab, n = ndimage.label(sub)
        if n > 1: sizes = ndimage.sum(sub, lab, range(1, n + 1)); sub = lab == (1 + int(np.argmax(sizes)))
        ys, xs = np.where(sub); out.append(sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    return out

def iou_for(meta, D, refs, cut_frac, hair=True):
    ious = []; yaws = [0, 35, 90]
    for yaw, ref in zip(yaws, refs):
        pts, (x0, x1, y0, y1) = sil(meta, D, yaw, cut_frac, hair); rh, rw = ref.shape
        sc = rh / (y1 - y0)                              # uniform scale: match bbox HEIGHT only (width/aspect left free)
        Wc = int(max(rw, (x1 - x0) * sc) + 4); Hc = rh
        # horizontal alignment: bbox centres
        ox = (Wc - (x1 - x0) * sc) / 2; tri = [[((x - x0) * sc + ox, (y1 - y) * sc) for x, y in t] for t in pts]
        mine = raster(tri, Wc, Hc); rr = np.zeros((Hc, Wc), bool); rx = (Wc - rw) // 2; rr[:, rx:rx + rw] = ref
        ious.append(float((mine & rr).sum() / max((mine | rr).sum(), 1)))
    return ious

refs = ref_masks(); iou = {}
for key in ["adult_m", "adult_f", "elder", "child7"]:
    meta, D = load_fig(key)
    fixed = iou_for(meta, D, refs, 0.74)
    best = max(((cf, iou_for(meta, D, refs, cf)) for cf in np.arange(0.70, 0.84, 0.02)), key=lambda t: np.mean(t[1]))
    nohair = iou_for(meta, D, refs, best[0], hair=False)
    iou[key] = dict(demo_cut_0p74=dict(per_view=[round(v, 3) for v in fixed], mean=round(float(np.mean(fixed)), 3)),
                    best_cut=dict(cut_frac=round(float(best[0]), 2), per_view=[round(v, 3) for v in best[1]], mean=round(float(np.mean(best[1])), 3)),
                    best_cut_no_hair_mean=round(float(np.mean(nohair)), 3))
report["silhouette_iou_vs_reference"] = dict(method="uniform-scale to ref bbox height, bbox-centre align, views 0/35/90 deg, ref segmented by bg-colour distance; aspiration >=0.94",
                                            results=iou)

# ------------------------------------------------------------------ 3) license lint
lint = {"findings": [], "pass": True}
def bad(msg): lint["findings"].append(msg); lint["pass"] = False
for pkg in ("smplx", "chumpy", "smpl", "smplx-torch", "pyrender"):
    try: md.version(pkg); bad("installed non-allowed/NC-adjacent package: " + pkg)
    except md.PackageNotFoundError: pass
# source scan of everything this folder ships (excluding this lint's own pattern list)
pat = re.compile(r"smpl[-_ ]?x|\bSMPL\b|smplx|chumpy|non-?commercial", re.I)
for fn in glob.glob(os.path.join(HERE, "*.py")) + glob.glob(os.path.join(HERE, "*.mjs")) + glob.glob(os.path.join(HERE, "*.js")) + glob.glob(os.path.join(HERE, "*.html")):
    if os.path.basename(fn) == "verify.py": continue
    for i, line in enumerate(open(fn, errors="ignore")):
        if pat.search(line): bad("%s:%d mentions %s" % (os.path.basename(fn), i + 1, pat.search(line).group(0)))
# anny data: no smplx topology shipped locally; list data licences
import anny
droot = os.path.join(os.path.dirname(anny.__file__), "data")
sm = [p for p in glob.glob(droot + "/**/*", recursive=True) if re.search(r"smpl", os.path.basename(p), re.I)]
if sm: bad("anny package ships SMPL-named data: %s" % sm[:3])
lic = {}
for pkg in ("anny", "torch", "numpy", "scipy", "trimesh", "roma", "warp-lang", "pillow", "PyYAML", "safetensors"):
    try:
        mm = md.metadata(pkg); l = (mm.get("License-Expression") or mm.get("License") or "").strip().splitlines()[0][:60] if (mm.get("License-Expression") or mm.get("License")) else ""
        if not l: cl = [c for c in (mm.get_all("Classifier") or []) if c.startswith("License")]; l = cl[0].split("::")[-1].strip() if cl else "see package"
        lic[pkg] = l
    except md.PackageNotFoundError: lic[pkg] = "not installed"
lint["dependency_licenses"] = lic; lint["pass"] &= True
runtime_files = ["allometric-rig.js", "demo.html", "assets/human-assets.js"]
lint["runtime_external_deps"] = "none (zero-dependency WebGL2; scripts: %s)" % ", ".join(runtime_files)
for k, v in lic.items():
    if re.search(r"non-?commercial|GPL|CC-BY-NC|proprietary", v, re.I): bad("dependency licence flagged: %s=%s" % (k, v))
lint["anny_data_note"] = "anny code Apache-2.0; data/mpfb2 + faceunits01 CC0; 'smplx' topology (non-commercial) is a separate download and is NOT installed or used."
report["license_lint"] = lint; report["hard_pass"] &= lint["pass"]
json.dump(report, open(os.path.join(HERE, "verify-report.json"), "w"), indent=1)
print(json.dumps({k: report[k] for k in ("head_ratio", "silhouette_iou_vs_reference")}, indent=1)); print("license lint:", lint["pass"], lint["findings"]); print("hard gates:", report["hard_pass"])
sys.exit(0 if report["hard_pass"] else 1)
