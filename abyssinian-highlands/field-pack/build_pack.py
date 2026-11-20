#!/usr/bin/env python3
"""Build compact field-polygon packs from Fields of The World (FTW) global GeoParquet.
Source: s3://us-west-2.opendata.source.coop/tge-labs/ftw-global-data/predictions/vectors/alpha/results-by-admin/
(anonymous HTTPS, CC-BY-4.0). Only bbox-pushdown reads; nothing is invented.
Shape classes are GEOMETRY HEURISTICS on the real polygons (no ground-truth labels exist)."""
import duckdb, json, math, struct, os, sys, datetime
import numpy as np
from shapely import wkb
from shapely.geometry import Polygon

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = "https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/tge-labs/ftw-global-data/predictions/vectors/alpha/results-by-admin/admin:country_code=ET/"
REGIONS = {
    "tana":    dict(bbox=[37.0, 11.4, 37.8, 12.3],    files=["AM"]),
    "gorge":   dict(bbox=[38.05, 9.95, 38.35, 10.2],  files=["AM", "OR"]),
    "simien":  dict(bbox=[38.0, 13.0, 38.4, 13.4],    files=["AM", "TI"]),
    "gheralta":dict(bbox=[39.3, 13.85, 39.55, 14.05], files=["TI"]),
    "metekel": dict(bbox=[35.0, 10.9, 36.2, 11.8],    files=["BE", "AM"]),
}
CAP = {"tana": 6500, "gorge": 6500, "simien": 6500, "gheralta": 6500, "metekel": 5000}
SHAPES = ["unknown", "jigsaw", "contour-ribbon", "riparian-strip", "lowland-block"]
CROPS = ["unknown"]  # EthCT2020 not downloadable keyless -> see README
TOL_M = 7.0
MIN_AREA = 300.0

con = duckdb.connect()
con.sql("load httpfs; load spatial")

def src(files, bb):
    parts = []
    for f in files:
        parts.append(f"""select bbox.xmin x0,bbox.ymin y0,bbox.xmax x1,bbox.ymax y1,geometry g,
          "metrics:area" a from read_parquet('{BASE}ET_{f}.parquet')
          where year("determination:datetime" at time zone 'UTC')=2025
          and bbox.xmin>{bb[0]} and bbox.xmax<{bb[2]} and bbox.ymin>{bb[1]} and bbox.ymax<{bb[3]}""")
    return " union all ".join(parts)

def src_in(files, bb):
    parts = []
    for f in files:
        parts.append(f"""select bbox.xmin x0,bbox.ymin y0,bbox.xmax x1,bbox.ymax y1,geometry g,
          "metrics:area" a from read_parquet('{BASE}ET_{f}.parquet')
          where year("determination:datetime" at time zone 'UTC')=2025
          and (bbox.xmin+bbox.xmax)/2>={bb[0]} and (bbox.xmin+bbox.xmax)/2<{bb[2]} and (bbox.ymin+bbox.ymax)/2>={bb[1]} and (bbox.ymin+bbox.ymax)/2<{bb[3]}""")
    return " union all ".join(parts)

def pick_window(rid, r):
    bb, cap = r["bbox"], CAP[rid]
    cen = np.array(con.sql(f"select (x0+x1)/2,(y0+y1)/2 from ({src(r['files'], bb)}) where a>={MIN_AREA}").fetchall())
    total = len(cen)
    if total == 0:
        return None, 0, 0
    best = None
    for size in [0.16, 0.12, 0.09, 0.07, 0.05, 0.035, 0.025, 0.015]:
        step = size / 4
        cand = None
        xs = np.arange(bb[0], bb[2] - size + 1e-9, step); ys = np.arange(bb[1], bb[3] - size + 1e-9, step)
        for x in xs:
            for y in ys:
                n = int(((cen[:, 0] >= x) & (cen[:, 0] < x + size) & (cen[:, 1] >= y) & (cen[:, 1] < y + size)).sum())
                if n <= cap and (cand is None or n > cand[0]):
                    cand = (n, [x, y, x + size, y + size])
        if cand and cand[0] >= 0.6 * cap:
            return cand[1], cand[0], total
        if cand and (best is None or cand[0] > best[0]):
            best = cand
    return (best[1], best[0], total) if best else (None, 0, total)

def classify(poly_m, area):
    """poly_m in metres. Returns shape class idx, orientation deg [0,180)."""
    mrr = poly_m.minimum_rotated_rectangle
    xs, ys = mrr.exterior.coords.xy
    e1 = math.hypot(xs[1] - xs[0], ys[1] - ys[0]); e2 = math.hypot(xs[2] - xs[1], ys[2] - ys[1])
    if e1 >= e2:
        L, W, ang = e1, e2, math.atan2(ys[1] - ys[0], xs[1] - xs[0])
    else:
        L, W, ang = e2, e1, math.atan2(ys[2] - ys[1], xs[2] - xs[1])
    orient = math.degrees(ang) % 180.0
    elong = L / max(W, 1e-6)
    fill = area / max(mrr.area, 1e-6)
    if elong >= 5 and W <= 45:
        s = 3 if fill >= 0.62 else 2      # straight narrow strip vs curved ribbon
    elif elong >= 3.0:
        s = 2                              # elongated -> contour terrace ribbon
    elif fill >= 0.80 and elong < 2.4 and area >= 8000:
        s = 4                              # compact rectangular-ish block (>=0.8 ha)
    elif area < 80000:
        s = 1                              # irregular smallholder parcel
    else:
        s = 0
    return s, orient

def build(rid, r, win=None):
    total = -1
    if win is None:
        win, n, total = pick_window(rid, r)
    if win is None:
        return None
    q = f"select ST_AsWKB(g), a from ({src_in(r['files'], win)}) where a>={MIN_AREA}"
    rows = con.sql(q).fetchall()
    lat0 = (win[1] + win[3]) / 2; kx = 111320.0 * math.cos(math.radians(lat0)); ky = 110574.0
    ox, oy = win[0], win[1]
    sx = (win[2] - win[0]) / 65535.0; sy = (win[3] - win[1]) / 65535.0
    rings, areas, orients, shapes = [], [], [], []
    for b, a in rows:
        geom = wkb.loads(bytes(b))
        gs = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
        for g in gs:
            gm = Polygon([((x - ox) * kx, (y - oy) * ky) for x, y in g.exterior.coords])
            if not gm.is_valid:
                gm = gm.buffer(0)
                if gm.geom_type != "Polygon" or gm.is_empty: continue
            ar = gm.area
            if ar < MIN_AREA: continue
            sm = gm.simplify(TOL_M, preserve_topology=True)
            if sm.geom_type != "Polygon" or sm.is_empty or len(sm.exterior.coords) < 4: continue
            s, o = classify(gm, ar)
            pts = list(sm.exterior.coords)[:-1]
            q16 = []
            for x, y in pts:
                qx = int(round(x / kx / sx)) - 32768; qy = int(round(y / ky / sy)) - 32768
                q16.append((max(-32768, min(32767, qx)), max(-32768, min(32767, qy))))
            rings.append(q16); areas.append(ar); orients.append(o); shapes.append(s)
    nf = len(rings); nv = sum(len(x) for x in rings)
    offs = np.zeros(nf + 1, dtype=np.uint32); offs[1:] = np.cumsum([len(x) for x in rings])
    xy = np.array([p for ring in rings for p in ring], dtype="<i2").reshape(-1)
    pad = lambda b: b + b"\0" * ((-len(b)) % 4)
    hdr = struct.pack("<4sIIIffff", b"ABF1", nf, nv, 0, *win)
    blob = (hdr + offs.astype("<u4").tobytes() + np.array(areas, "<f4").tobytes() + xy.tobytes()
            + pad(np.array([int(o / 180 * 255) for o in orients], "u1").tobytes())
            + pad(np.array(shapes, "u1").tobytes()) + pad(np.zeros(nf, "u1").tobytes()))
    path = os.path.join(HERE, f"fields_{rid}.bin")
    open(path, "wb").write(blob)
    sh = np.array(shapes); ar = np.array(areas)
    bins = [0, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 20, 1e9]  # hectares
    hist = np.histogram(ar / 1e4, bins=bins)[0].tolist()
    return dict(file=f"fields_{rid}.bin", bytes=len(blob), regionBbox=r["bbox"], windowBbox=[round(v, 5) for v in win],
        fieldsInRegionAfterFilter=total, fields=nf, vertices=nv, sourceFiles=[f"ET_{f}.parquet" for f in r["files"]],
        areaHistHa=dict(bins=bins[:-1] + ["inf"], counts=hist), medianAreaHa=round(float(np.median(ar)) / 1e4, 3),
        shareByShape={SHAPES[i]: round(float((sh == i).mean()), 4) for i in range(len(SHAPES))},
        countByShape={SHAPES[i]: int((sh == i).sum()) for i in range(len(SHAPES))},
        meanVertices=round(nv / max(nf, 1), 2)), None

if __name__ == "__main__":
    man = dict(
        name="abyssinian-highlands field-pack", built=datetime.date.today().isoformat(),
        source="Fields of The World global (PRUE model on Sentinel-2, 10 m), predictions/vectors/alpha/results-by-admin, year 2025",
        sourceUrl="https://source.coop/tge-labs/ftw-global-data", license="CC-BY-4.0 (Taylor Geospatial et al.; Robinson et al. 2026 arXiv:2605.11055)",
        format=dict(magic="ABF1", header="<4s I nf, I nv, I 0, f32 x0,y0,x1,y1 (window bbox)",
                    arrays=["u32 offsets[nf+1]", "f32 area_m2[nf]", "i16 xy[nv*2] (value+32768)/65535*window span + window min", "u8 orient[nf] (*180/255 deg, long axis, CCW from east)", "u8 shape[nf]", "u8 crop[nf] (all 0 = unknown)"]),
        shapeClasses=SHAPES, cropClasses=CROPS, simplifyToleranceM=TOL_M, minAreaM2=MIN_AREA,
        shapeClassNote="Geometry heuristics (elongation, rectangle fill ratio, area) on real FTW polygons; not ground-truth labels.",
        synthetic=False, regions={})
    stats = {}
    for rid, r in REGIONS.items():
        print("region", rid, flush=True)
        try:
            res = build(rid, r)
        except Exception as e:
            print("FAILED", rid, repr(e)); res = None
        if not res:
            man["regions"][rid] = dict(regionBbox=r["bbox"], fields=0, note="no data / failed"); continue
        info, _ = res
        man["regions"][rid] = info; stats[rid] = {k: info[k] for k in ("fields", "areaHistHa", "medianAreaHa", "shareByShape", "countByShape", "meanVertices")}
        print(rid, info["fields"], info["bytes"], info["shareByShape"], flush=True)
    man["totalBytes"] = sum(v.get("bytes", 0) for v in man["regions"].values())
    json.dump(man, open(os.path.join(HERE, "manifest.json"), "w"), indent=1)
    json.dump(stats, open(os.path.join(HERE, "field-stats.json"), "w"), indent=1)
    print("total bytes", man["totalBytes"])
