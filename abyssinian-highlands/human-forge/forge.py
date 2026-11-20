#!/usr/bin/env python3
"""ABYSSINIAN HIGHLANDS human-forge: offline allometric synthesis on naver/anny (Apache-2.0,
MPFB2/MakeHuman CC0 data).  Produces Y-up (m), +Z-forward, feet on y=0 meshes with 4-influence
skin weights, .glb (skinned) and a compact base64 asset pack for the zero-dependency runtime.

    python3 forge.py            # builds assets/*.glb + assets/human-assets.js + assets/meta.json
"""
import json, base64, struct, os, sys, warnings
import numpy as np
warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")

# --------------------------------------------------------------------------- allometry
def cole_green(M, L, S, z):
    """Cole-Green LMS centile curve: X = M (1 + L S z)^(1/L)."""
    if abs(L) < 1e-9:
        return M * np.exp(S * z)
    return M * (1.0 + L * S * z) ** (1.0 / L)

def huxley(y0, x, alpha):
    """Huxley power law y = y0 * x^alpha (x = relative size)."""
    return y0 * np.power(x, alpha)

# Height-for-age LMS (cm): median M(age) and S taken as approximations of the public WHO
# 2007 reference (L=1).  APPROXIMATE hand-fitted values, NOT copied tables -- see LICENSE-AUDIT.md.
def height_lms(age_y, sex):
    ages = np.array([5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20.0])
    mB = np.array([109.2, 115.5, 121.7, 127.3, 132.6, 137.8, 149.1, 163.2, 172.5, 175.8, 176.5])
    mG = np.array([108.4, 114.6, 120.8, 126.6, 132.5, 138.6, 151.5, 159.8, 162.7, 163.4, 163.5])
    M = np.interp(age_y, ages, mB if sex == "m" else mG)
    S = np.interp(age_y, ages, [.042, .043, .044, .045, .046, .047, .050, .047, .040, .038, .038])
    return M, 1.0, S

# --------------------------------------------------------------------------- cast
# anny_age: Anny phenotype age parameter (0.5 ~ 25 y), chosen so that the head-height ratio is
# near target before the Huxley head correction; stature in metres is then set by uniform
# Huxley (alpha=1) scaling to a centile curve / East African adult norm.
CAST = {
    "child7":  dict(label="Child, 7 y (6.0-head)", gender=0.35, anny_age=0.215, target_heads=6.0, sex="f",
                    centile_z=0.0, tps=0.4, african=1.0, muscle=.35, weight=.40, height=.5, prop=.5),
    "adult_f": dict(label="Adult woman (7.5-head)", gender=0.0, anny_age=0.52, target_heads=7.5, stature=1.60, tps=0.7,
                    african=1.0, muscle=.45, weight=.40, height=.5, prop=.55),
    "adult_m": dict(label="Adult man (7.5-head)", gender=1.0, anny_age=0.55, target_heads=7.5, stature=1.72,
                    african=1.0, muscle=.55, weight=.40, height=.5, prop=.55),
    "elder":   dict(label="Elder (7.5-head)", gender=0.35, anny_age=0.88, target_heads=7.5, stature=1.58,
                    african=1.0, muscle=.30, weight=.30, height=.4, prop=.5),
}

HAIR = {
    "child7":  dict(forehead=0.86, temple=0.66, nape=0.46, crown=0.17, side=0.11),
    "adult_f": dict(forehead=0.84, temple=0.62, nape=0.40, crown=0.26, side=0.17),
    "adult_m": dict(forehead=0.80, temple=0.50, nape=0.22, crown=0.21, side=0.13),
    "elder":   dict(forehead=0.80, temple=0.60, nape=0.45, crown=0.12, side=0.08),
}

def rot_to_yup(v):
    """Anny frame (Z up, -Y forward) -> (Y up, +Z forward). Proper rotation."""
    v = np.asarray(v)
    return np.stack([v[..., 0], v[..., 2], -v[..., 1]], -1)

_MODEL = None
def model():
    global _MODEL
    if _MODEL is None:
        import anny
        _MODEL = anny.Anny(phenotypes="all", topology="anny")
    return _MODEL

def top4(m):
    idx = m.vertex_bone_indices.numpy().astype(np.int64)
    w = m.vertex_bone_weights.numpy().astype(np.float64)
    o = np.argsort(-w, 1)[:, :4]
    i4 = np.take_along_axis(idx, o, 1)
    w4 = np.take_along_axis(w, o, 1)
    w4 /= np.maximum(w4.sum(1, keepdims=True), 1e-9)
    return i4, w4

def head_mask(m, w4, i4, thr=0.5):
    hi = m.bone_labels.index("head")
    return (w4 * (i4 == hi)).sum(1) > thr

def head_height(v, hm):
    return v[hm, 1].max() - v[hm, 1].min()

def build_one(name, spec, tps=True):
    import torch
    m = model()
    kw = dict(gender=spec["gender"], age=spec["anny_age"], muscle=spec["muscle"], weight=spec["weight"],
              height=spec["height"], proportions=spec["prop"], african=spec["african"], asian=0.0,
              caucasian=0.0)
    with torch.no_grad():
        out = m(phenotype_kwargs=kw)
    v = rot_to_yup(out["rest_vertices"][0].numpy().astype(np.float64))
    heads = rot_to_yup(out["rest_bone_heads"][0].numpy().astype(np.float64))
    tails = None
    for k in ("rest_bone_tails",):
        if k in out:
            tails = rot_to_yup(out[k][0].numpy().astype(np.float64))
    faces = m.get_triangular_faces().numpy().astype(np.int64)
    i4, w4 = top4(m)
    hm = head_mask(m, w4, i4)
    # --- 1) ground + centre
    dy = v[:, 1].min(); cx = 0.5 * (v[:, 0].min() + v[:, 0].max())
    off = np.array([cx * 0, -dy, 0.0]); v += off; heads += off
    if tails is not None: tails += off
    # --- 2) stature by uniform Huxley (alpha=1) scaling to centile / norm
    H0 = v[:, 1].max()
    if "centile_z" in spec:
        M, L, S = height_lms(7.0, spec["sex"])
        stature = cole_green(M, L, S, spec["centile_z"]) / 100.0
    else:
        stature = spec["stature"]
    s = stature / H0
    v *= s; heads *= s
    if tails is not None: tails *= s
    # --- 3) head-height Huxley correction so heads-tall hits the target exactly
    H = v[:, 1].max()
    hh = head_height(v, hm)
    want = H / spec["target_heads"]
    k = want / hh                                  # head scale factor
    jh = heads[m.bone_labels.index("head")]
    # smooth weight: head bone weight fully scaled, neck ramps in
    wh = np.zeros(len(v))
    for nm, f in (("head", 1.0), ("neck03", 0.5), ("neck02", 0.2), ("eye.L", 1.0), ("eye.R", 1.0)):
        bi = m.bone_labels.index(nm); wh += f * (w4 * (i4 == bi)).sum(1)
    wh = np.clip(wh, 0, 1)
    pivot = np.array([0.0, v[hm, 1].min(), jh[2]])
    pivot[1] = v[hm, 1].min()                     # scale about chin level: height grows upward
    sc = 1.0 + (k - 1.0) * wh
    fig_headw = wh.copy()
    v = pivot + (v - pivot) * sc[:, None]
    # re-seat bones in head chain
    for bi, nm in enumerate(m.bone_labels):
        if nm in ("head", "eye.L", "eye.R"):
            heads[bi] = pivot + (heads[bi] - pivot) * k
    H = v[:, 1].max(); hh = head_height(v, hm)
    info = dict(pivot=[float(x) for x in pivot], stature=H, head_h=hh, heads_tall=H / hh, head_scale=k, anny_age=spec["anny_age"])
    return dict(headw=fig_headw, v=v, faces=faces, i4=i4, w4=w4, heads=heads, hm=hm, info=info, label=spec["label"])


# --------------------------------------------------------------------------- regularized 3D Bookstein thin-plate spline
def tps_fit(src, dst, lam=1e-5):
    """3D TPS with kernel U(r)=r (biharmonic in R^3), regularized by lam. Returns a callable warp."""
    n = len(src); K = np.linalg.norm(src[:, None] - src[None], axis=2) + lam * np.eye(n)
    P = np.hstack([np.ones((n, 1)), src]); A = np.zeros((n + 4, n + 4)); A[:n, :n] = K; A[:n, n:] = P; A[n:, :n] = P.T
    Y = np.vstack([dst - src, np.zeros((4, 3))]); sol = np.linalg.solve(A, Y); w, a = sol[:n], sol[n:]
    def warp(x):
        U = np.linalg.norm(x[:, None] - src[None], axis=2)
        return x + U @ w + np.hstack([np.ones((len(x), 1)), x]) @ a
    return warp

def craniofacial_landmarks(v, hm, heads, m, hh):
    """Geometric landmark detection (Y-up, +Z forward): zygion, gonion, nasion/pronasale, pogonion, suprasternal notch, neck sides."""
    ymin = v[hm, 1].min(); t = (v[:, 1] - ymin) / hh; cz = v[hm, 2].mean(); H = {}
    pick = lambda mask, key, sign=1: np.where(mask)[0][np.argmax(sign * key[mask])]
    front = (v[:, 2] > cz) & hm; back = (v[:, 2] <= cz) & hm
    for side, sg in (("L", 1), ("R", -1)):
        sm = sg * v[:, 0] > 0
        H["zyg" + side] = pick(front & sm & (t > .38) & (t < .62), sg * v[:, 0])
        H["gon" + side] = pick(hm & sm & (t > .04) & (t < .30) & (v[:, 2] < cz + .02), sg * v[:, 0])
    mid = np.abs(v[:, 0]) < 0.006 * hh / 0.2
    H["pronasale"] = pick(hm & mid & (t > .30) & (t < .60), v[:, 2]); H["pogonion"] = pick(hm & mid & (t < .16), v[:, 2])
    H["nasion"] = pick(hm & mid & (t > .52) & (t < .70), v[:, 2])
    cl = heads[m.bone_labels.index("clavicle.L")][1]
    band = (np.abs(v[:, 0]) < 0.012) & (v[:, 2] > 0) & (v[:, 1] > cl - 0.01) & (v[:, 1] < cl + 0.12 * hh / 0.2)
    H["suprasternal"] = np.where(band)[0][np.argmin(v[band, 2])]
    nb = m.bone_labels.index("neck02"); ny = heads[nb][1]
    for side, sg in (("L", 1), ("R", -1)):
        mm = (np.abs(v[:, 1] - ny) < 0.01) & (sg * v[:, 0] > 0); H["neck" + side] = np.where(mm)[0][np.argmax(sg * v[mm, 0])]
    return H

def apply_craniofacial(fig, m, k):
    """East-African facial-plane sharpening via TPS landmark displacements, scaled by k (0..1). Anchors pin the cranial vault, torso and limbs."""
    v, hm, heads = fig["v"], fig["hm"], fig["heads"]; hh = fig["info"]["head_h"]
    H = craniofacial_landmarks(v, hm, heads, m, hh); u = hh  # displacement unit = head height
    disp = {}
    for s, sg in (("L", 1), ("R", -1)):
        disp["zyg" + s] = np.array([sg * 0.040 * u, 0.0, 0.030 * u])          # high, projecting zygomatic arch
        disp["gon" + s] = np.array([-sg * 0.055 * u, 0.010 * u, -0.005 * u])    # narrower, squarer mandibular angle
        disp["neck" + s] = np.array([-sg * 0.075 * u, 0, 0])                     # slender neck
    disp["nasion"] = np.array([0, 0, 0.030 * u]); disp["pronasale"] = np.array([0, -0.004 * u, 0.045 * u])
    disp["pogonion"] = np.array([0, 0.004 * u, 0.035 * u]); disp["suprasternal"] = np.array([0, 0, -0.050 * u])
    names = list(disp); src = np.array([v[H[n]] for n in names]); dst = src + k * np.array([disp[n] for n in names])
    # anchors: cranial vault + back of head + torso/limbs sampled sparsely (zero displacement)
    rng = np.random.default_rng(3); far = np.where(~hm | (v[:, 2] < v[hm, 2].mean() - 0.3 * u))[0]
    keep = far[rng.choice(len(far), 120, replace=False)]
    cz = v[hm, 2].mean(); top = np.where(hm & (v[:, 1] > v[hm, 1].max() - 0.12 * u))[0][::7]
    anc = np.unique(np.concatenate([keep, top])); src = np.vstack([src, v[anc]]); dst = np.vstack([dst, v[anc]])
    warp = tps_fit(src, dst, lam=1e-4 * u)
    # only warp the head+neck+upper-torso region (everything else is far from landmarks and effectively fixed)
    sel = v[:, 1] > v[hm, 1].min() - 0.9 * u
    v2 = v.copy(); v2[sel] = warp(v[sel]); fig["v"] = v2; fig["landmarks"] = {n: v[H[n]].tolist() for n in H}
    # keep bones consistent for head chain (translation of eyes only)
    return H

# --------------------------------------------------------------------------- 4C hair cap (baked, curl-displaced scalp shell)
def _vnoise(p, f, seed):
    """3D value noise (trilinear, smoothstep) at frequency f."""
    q = p * f; i = np.floor(q).astype(np.int64); u = q - i; u = u * u * (3 - 2 * u)
    def h(ix, iy, iz):
        n = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (seed * 2654435761 & 0xffffffff)
        n = (n ^ (n >> 13)) * 1274126177 & 0xffffffff
        return ((n ^ (n >> 16)) & 0xffff) / 65535.0
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (u[:, 0] if dx else 1 - u[:, 0]) * (u[:, 1] if dy else 1 - u[:, 1]) * (u[:, 2] if dz else 1 - u[:, 2])
                out = out + w * h(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz)
    return out

def build_hair(fig, m, style):
    """Scalp shell: head-bone vertices above a hairline surface, pushed along vertex normals by a crown/side thickness profile
    plus multi-octave curl displacement ('lifted' coils). Inherits the skin weights of the underlying scalp vertices."""
    v, f, hm, heads = fig["v"], fig["faces"], fig["hm"], fig["heads"]
    hh = fig["info"]["head_h"]; nrm = normals(v, f)
    eye = heads[m.bone_labels.index("eye.L")]; ymin = v[hm, 1].min(); ymax = v[hm, 1].max()
    cx, cz = 0.0, v[hm, 2].mean()
    t = (v[:, 1] - ymin) / hh                              # 0 chin .. 1 crown
    front = (v[:, 2] - cz) > 0.02 * hh                      # face side
    lat = np.abs(v[:, 0]) / (0.5 * (v[hm, 0].max() - v[hm, 0].min()) + 1e-9)
    # hairline height (in head units): high on forehead, low at nape and temples
    line = np.where(front, style["forehead"], np.where(lat > 0.55, style["temple"], style["nape"]))
    ear = (lat > 0.88) & (t < 0.62) & (t > 0.30)
    hw_ = np.zeros(len(v))
    for nm in ("head", "neck03", "neck02"):
        hw_ += (fig["w4"] * (fig["i4"] == m.bone_labels.index(nm))).sum(1)
    sel = (hw_ > 0.2) & (t > line) & (t < 1.2) & ~ear & (v[:, 1] > ymin)
    # keep only faces entirely inside the selection
    keep = sel[f].all(1); ff = f[keep]; used = np.unique(ff); remap = -np.ones(len(v), int); remap[used] = np.arange(len(used))
    hv = v[used].copy(); hn = nrm[used]; ht = t[used]
    bnd = np.ones(len(used))
    # distance-to-boundary taper (graph hops) so the shell roots into the scalp
    edges = np.concatenate([ff[:, [0, 1]], ff[:, [1, 2]], ff[:, [2, 0]]]); e = remap[edges]
    cnt = {}
    for a, b in e: cnt[(min(a, b), max(a, b))] = cnt.get((min(a, b), max(a, b)), 0) + 1
    boundary = np.zeros(len(used), bool)
    for (a, b), c in cnt.items():
        if c == 1: boundary[a] = boundary[b] = True
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import dijkstra
    n = len(used); L = np.linalg.norm(hv[e[:, 0]] - hv[e[:, 1]], axis=1)
    G = coo_matrix((np.r_[L, L], (np.r_[e[:, 0], e[:, 1]], np.r_[e[:, 1], e[:, 0]])), shape=(n, n)).tocsr()
    dist = dijkstra(G, indices=np.where(boundary)[0], min_only=True)
    taper = np.clip(dist / (0.55 * hh), 0, 1); taper = taper * taper * (3 - 2 * taper)
    up = np.clip(0.5 + 0.5 * hn[:, 1], 0, 1)
    thick = hh * (style["side"] + (style["crown"] - style["side"]) * up) * taper
    p3 = hv / hh
    curl = 0.50 * _vnoise(p3, 9.0, 1) + 0.32 * _vnoise(p3, 22.0, 2) + 0.18 * _vnoise(p3, 47.0, 3)
    disp = thick * (0.70 + 0.65 * curl)
    hv2 = hv + hn * disp[:, None]
    hf = remap[ff]
    # subdivide once for denser coil silhouette? keep topology (Anny scalp ~5 mm) -- documented
    return dict(v=hv2, faces=hf, i4=fig["i4"][used], w4=fig["w4"][used], headw=fig["headw"][used], src=used)

def orient_bones(m, heads):
    """Per-bone unit direction head->(mean child head) in Y-up frame, plus length."""
    par = m.bone_parents.numpy() if hasattr(m.bone_parents, "numpy") else np.array(m.bone_parents)
    n = len(par); dirs = np.zeros((n, 3)); ch = [[] for _ in range(n)]
    for i, p in enumerate(par):
        if p >= 0: ch[p].append(i)
    for i in range(n):
        if ch[i]:
            d = np.mean([heads[c] for c in ch[i]], 0) - heads[i]
        else:
            d = heads[i] - heads[par[i]]
        L = np.linalg.norm(d)
        dirs[i] = d / L if L > 1e-9 else [0, 1, 0]
    return par, dirs

def normals(v, f):
    n = np.zeros_like(v)
    t = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    for k in range(3): np.add.at(n, f[:, k], t)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)

# --------------------------------------------------------------------------- glb writer
def write_glb(path, name, v, f, i4, w4, heads, par, bone_names, nrm):
    """Minimal skinned glTF 2.0 binary (POSITION, NORMAL, JOINTS_0, WEIGHTS_0, indices, skin)."""
    nb = len(bone_names)
    # compact joint set: bones that influence something
    used = np.unique(i4[w4 > 0]); remap = -np.ones(nb, int); remap[used] = np.arange(len(used))
    # keep ancestors too so hierarchy is valid
    keep = set(used.tolist())
    for b in list(keep):
        p = par[b]
        while p >= 0 and p not in keep: keep.add(p); p = par[p]
    keep = sorted(keep); remap = -np.ones(nb, int); remap[keep] = np.arange(len(keep))
    J = remap[i4].astype(np.uint16); Wt = w4.astype(np.float32)
    chunks = []; views = []; accs = []
    def add(arr, target, comp, typ, count, minmax=None):
        data = arr.tobytes(); pad = (-len(data)) % 4
        off = sum(len(c) for c in chunks)
        chunks.append(data + b"\0" * pad)
        views.append(dict(buffer=0, byteOffset=off, byteLength=len(data), **({"target": target} if target else {})))
        a = dict(bufferView=len(views) - 1, componentType=comp, count=count, type=typ)
        if minmax: a["min"], a["max"] = minmax
        accs.append(a); return len(accs) - 1
    ap = add(v.astype(np.float32), 34962, 5126, "VEC3", len(v), ([float(x) for x in v.min(0)], [float(x) for x in v.max(0)]))
    an = add(nrm.astype(np.float32), 34962, 5126, "VEC3", len(v))
    aj = add(J.reshape(-1, 4), 34962, 5123, "VEC4", len(v))
    aw = add(Wt, 34962, 5126, "VEC4", len(v))
    ai = add(f.astype(np.uint32).ravel(), 34963, 5125, "SCALAR", f.size)
    ibm = []
    for b in keep:
        M = np.eye(4); M[:3, 3] = -heads[b]; ibm.append(M.T.ravel())      # column-major
    aibm = add(np.array(ibm, np.float32), None, 5126, "MAT4", len(keep))
    nodes = [dict(name=name, mesh=0, skin=0)]
    for b in keep:
        nd = dict(name=bone_names[b])
        t = heads[b] - (heads[par[b]] if par[b] >= 0 else 0)
        nd["translation"] = [float(x) for x in t]
        ch = [remap[c] + 1 for c in keep if par[c] == b]
        if ch: nd["children"] = [int(c) for c in ch]
        nodes.append(nd)
    roots = [remap[b] + 1 for b in keep if par[b] < 0 or par[b] not in keep]
    nodes.append(dict(name="skel_root", children=[int(r) for r in roots])) if len(roots) > 1 else None
    skel_root = int(roots[0]) if len(roots) == 1 else len(nodes) - 1
    gltf = dict(asset=dict(version="2.0", generator="abyss-human-forge (anny, Apache-2.0 / CC0 MPFB2)"),
                scene=0, scenes=[dict(nodes=[0, skel_root])], nodes=nodes,
                meshes=[dict(name=name, primitives=[dict(attributes=dict(POSITION=ap, NORMAL=an, JOINTS_0=aj, WEIGHTS_0=aw), indices=ai)])],
                skins=[dict(joints=[int(remap[b] + 1) for b in keep], inverseBindMatrices=aibm, skeleton=skel_root)],
                accessors=accs, bufferViews=views, buffers=[dict(byteLength=sum(len(c) for c in chunks))])
    js = json.dumps(gltf, separators=(",", ":")).encode(); js += b" " * ((-len(js)) % 4)
    bin_ = b"".join(chunks)
    glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_))
    glb += struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(bin_), 0x004E4942) + bin_
    open(path, "wb").write(glb)
    return len(glb)

# --------------------------------------------------------------------------- compact runtime pack
def pack_runtime(fig, bone_names, par, dirs):
    v, f, i4, w4, heads = fig["v"], fig["faces"], fig["i4"], fig["w4"], fig["heads"]
    nrm = normals(v, f); hair = fig.get("hair")
    parts = []
    def put(a): b = a.tobytes(); parts.append(b + b"\0" * ((-len(b)) % 4)); return len(parts[-1])
    layout = {}
    def reg(k, a, dt):
        a = np.ascontiguousarray(a.astype(dt)); layout[k] = dict(offset=sum(len(p) for p in parts), count=int(a.size), dtype=np.dtype(dt).name)
        put(a)
    reg("pos", v, np.float32)
    reg("nrm", np.round(nrm * 32767), np.int16)
    reg("joints", i4, np.uint8)
    reg("weights", np.round(w4 * 255), np.uint8)
    reg("idx", f, np.uint16)
    reg("headw", np.round(fig["headw"] * 255), np.uint8)
    if hair is not None:
        hn = normals(hair["v"], hair["faces"])
        reg("h_pos", hair["v"], np.float32); reg("h_nrm", np.round(hn * 32767), np.int16); reg("h_joints", hair["i4"], np.uint8)
        reg("h_weights", np.round(hair["w4"] * 255), np.uint8); reg("h_idx", hair["faces"], np.uint16); reg("h_headw", np.round(hair["headw"] * 255), np.uint8)
    return b"".join(parts), layout

def main(only=None):
    os.makedirs(ASSETS, exist_ok=True)
    m = model()
    names = list(m.bone_labels)
    meta = dict(generator="abyss-human-forge", base="naver/anny 0.6.2 (Apache-2.0) + MPFB2 CC0", figures={})
    js = ["window.HUMAN_FORGE_ASSETS={};"]
    for key, spec in CAST.items():
        if only and key not in only: continue
        fig = build_one(key, spec)
        apply_craniofacial(fig, m, spec.get("tps", 1.0))
        fig["hair"] = build_hair(fig, m, HAIR[key])
        par, dirs = orient_bones(m, fig["heads"])
        nrm = normals(fig["v"], fig["faces"])
        n = write_glb(os.path.join(ASSETS, key + ".glb"), key, fig["v"], fig["faces"], fig["i4"], fig["w4"], fig["heads"], par, names, nrm)
        blob, layout = pack_runtime(fig, names, par, dirs)
        info = fig["info"]
        meta["figures"][key] = dict(label=fig["label"], info=info, nverts=len(fig["v"]), ntris=len(fig["faces"]), hair_verts=len(fig["hair"]["v"]), hair_tris=len(fig["hair"]["faces"]), glb_bytes=n,
                                    blob_bytes=len(blob), layout=layout,
                                    bones=dict(names=names, parents=[int(p) for p in par],
                                               heads=np.round(fig["heads"], 5).tolist(), dirs=np.round(dirs, 4).tolist()))
        js.append("window.HUMAN_FORGE_ASSETS[%s]={meta:%s,blob:'%s'};" % (json.dumps(key), json.dumps(meta["figures"][key], separators=(",", ":")), base64.b64encode(blob).decode()))
        print("%-8s H=%.3f m  head=%.3f  heads=%.3f  tris=%d  glb=%dKB" % (key, info["stature"], info["head_h"], info["heads_tall"], len(fig["faces"]), n // 1024))
    json.dump({k: dict(v, bones=None, layout=None) for k, v in meta["figures"].items()}, open(os.path.join(ASSETS, "meta.json"), "w"), indent=1)
    open(os.path.join(ASSETS, "human-assets.js"), "w").write("\n".join(js) + "\n")

if __name__ == "__main__":
    main(sys.argv[1:] or None)
