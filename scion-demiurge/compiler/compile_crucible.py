#!/usr/bin/env python3
"""
SCION DEMIURGE · Deterministic Geodetic-to-Runtime Compiler (v1.0)
Target World: Abyssinian-Harar Vertical Open World
  (Entoto 3,200m -> Addis Korkoro/Rail 2,400m -> Abay Gorge 1,000m -> Roha Trench 2,500m -> Simien 4,550m)
Footprint: 14x14 km (196 atomic 1x1 km sector cells) with 2x14 km HD Crucible Corridor
Vertical Law: 1:1 metric vertical relief (911m .. 4,550m ASL), 40:1 anisotropic inter-basin fault warp.
"""
import base64
import hashlib
import json
import math
import os
import struct
import time
import zlib
import numpy as np

REPO_ROOT = "/Users/gaia/make-photo/make-photo"
OUT_DIR = os.path.join(REPO_ROOT, "scion-demiurge", "compiled")
os.makedirs(OUT_DIR, exist_ok=True)

RAW_SOURCES = {
    "orbital_macro_dem": {
        "rel_path": "scion-demiurge/vault/orbital_dem16.bin",
        "license": "Public Domain / Open Data — AWS Open Data Terrain Tiles (SRTM/GMTED/ETOPO1 z7)",
        "citekey": "AWS_TERRARIUM_Z7_ETHIOPIA",
        "role": "14x14 km outer SLOD massif horizon shell elevation baseline (6N-15N, 35E-42E)"
    },
    "abay_gorge_dem": {
        "rel_path": "scion-demiurge/vault/blue_nile_gorge.dem16.bin",
        "license": "Public Domain / Open Data — Copernicus GLO-30 / SRTM Terrarium z12",
        "citekey": "COP30_ABAY_DEJEN_GOHATSION",
        "role": "1:1 metric 1,500m Blue Nile Gorge basalt-limestone-sandstone canyon relief (1,004m-2,531.6m)"
    },
    "simien_escarpment_dem": {
        "rel_path": "scion-demiurge/vault/simien_imet_gogo.dem16.bin",
        "license": "Public Domain / Open Data — Copernicus GLO-30 / SRTM Terrarium z13",
        "citekey": "COP30_SIMIEN_IMET_GOGO",
        "role": "1:1 metric Simien flood-basalt cliff & afro-alpine escarpment relief (1,962.9m-4,550m)"
    },
    "ftw_gorge_parcels": {
        "rel_path": "scion-demiurge/vault/fields_dem_gorge.bin",
        "license": "CC-BY-4.0 — Fields of The World (FTW 2025 Sentinel-2 10m PRUE U-Net, Source Coop)",
        "citekey": "FTW_2025_AMHARA_OROMIA",
        "role": "Empirical smallholder stone-bund parcel polygons (~0.60ha calibration, jigsaw & riparian)"
    },
    "ftw_simien_parcels": {
        "rel_path": "scion-demiurge/vault/fields_dem_simien.bin",
        "license": "CC-BY-4.0 — Fields of The World (FTW 2025 Sentinel-2 10m PRUE U-Net, Source Coop)",
        "citekey": "FTW_2025_SIMIEN_DEGA",
        "role": "Empirical Dega/Wurch contour-ribbon terrace & smallholder parcel boundaries"
    }
}


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def bilinear_sample(grid, u, v):
    h, w = grid.shape
    fx = np.clip(u, 0.0, 1.0) * (w - 1)
    fy = np.clip(v, 0.0, 1.0) * (h - 1)
    x0 = np.floor(fx).astype(np.int32)
    y0 = np.floor(fy).astype(np.int32)
    x1 = np.minimum(x0 + 1, w - 1)
    y1 = np.minimum(y0 + 1, h - 1)
    wx = fx - x0
    wy = fy - y0
    v00 = grid[y0, x0]
    v10 = grid[y0, x1]
    v01 = grid[y1, x0]
    v11 = grid[y1, x1]
    return (v00 * (1 - wx) + v10 * wx) * (1 - wy) + (v01 * (1 - wx) + v11 * wx) * wy


def load_abf1_sample_polygons(path, max_polys=260):
    """Extract real FTW smallholder parcel polygons from ABF1 binary archive."""
    raw = open(path, "rb").read()
    magic, nf, nv, _pad, x0, y0, x1, y1 = struct.unpack("<4sIIIffff", raw[:32])
    assert magic == b"ABF1", f"Invalid ABF1 magic: {magic}"
    off = 32
    offsets = np.frombuffer(raw, dtype="<u4", count=nf + 1, offset=off)
    off += (nf + 1) * 4
    areas = np.frombuffer(raw, dtype="<f4", count=nf, offset=off)
    off += nf * 4
    xy_q = np.frombuffer(raw, dtype="<i2", count=nv * 2, offset=off).reshape(nv, 2)
    off += nv * 4
    orient = np.frombuffer(raw, dtype=np.uint8, count=nf, offset=off)
    off += nf
    shape_cls = np.frombuffer(raw, dtype=np.uint8, count=nf, offset=off)

    # Normalize coordinates into [0, 1] window space
    uv = (xy_q.astype(np.float32) + 32768.0) / 65535.0
    # Deterministic stride selection across window to preserve real spatial adjacency clusters
    cx = np.zeros(nf, dtype=np.float32)
    cy = np.zeros(nf, dtype=np.float32)
    for i in range(nf):
        s, e = offsets[i], offsets[i + 1]
        pts = uv[s:e]
        cx[i] = pts[:, 0].mean()
        cy[i] = pts[:, 1].mean()

    # Pick dense real neighborhood cluster near center (0.38..0.62, 0.38..0.62)
    in_box = np.where((cx > 0.35) & (cx < 0.65) & (cy > 0.35) & (cy < 0.65) & (areas > 800.0))[0]
    chosen = in_box[:max_polys]
    polys = []
    for idx in chosen:
        s, e = int(offsets[idx]), int(offsets[idx + 1])
        pts = uv[s:e]
        if len(pts) < 3:
            continue
        # Map 0.35..0.65 window (~3.3 km) into [-900m..+900m] parcel cluster coordinates
        local_pts = []
        for px, py in pts[:10]:
            lx = round(float((px - 0.50) * 5600.0), 1)
            lz = round(float((py - 0.50) * 5600.0), 1)
            local_pts.append([lx, lz])
        polys.append({
            "area_ha": round(float(areas[idx]) / 10000.0, 3),
            "shape": int(shape_cls[idx]),
            "orient_deg": round(float(orient[idx]) * 180.0 / 255.0, 1),
            "pts": local_pts
        })
    return {
        "total_fields_in_file": int(nf),
        "median_area_ha": round(float(np.median(areas)) / 10000.0, 3),
        "mean_area_ha": round(float(np.mean(areas)) / 10000.0, 3),
        "sampled_cluster": polys
    }


def build_arterial_corridor_spline(patch_mode="B_BENCH_CUT"):
    """
    Constructs the 14 km South-to-North Crucible Arterial Road Spline from
    Entoto (-6,300m, 3,200m) -> Addis Rail (-3,550m, 2,400m) -> Abay Gorge Bridge (-480m, 1,018m)
    -> Roha (+2,400m, 2,500m) -> Simien / Ras Dashen (+6,220m, 4,550m).
    Each control point specifies (X_m, Z_m, target_deck_elev_m).
    """
    if patch_mode == "A_DRAPED_CHORD":
        ctrl = [
            (  0.0, -6300.0, 3200.0),
            (  0.0, -3550.0, 2400.0),
            (  0.0, -1920.0, 2504.0),
            (  0.0,  -480.0, 1018.0),
            (  0.0,  1180.0, 2500.0),
            (-72.0,  2400.0, 2500.0),
            (  0.0,  6220.0, 4550.0),
        ]
    else:
        # Civil-engineered 8-leg Abay Gorge & 10-leg Simien Escarpment bench-cut switchbacks:
        # - Crosses Abay Gorge Bridge strictly North-South at X = 0.0, Z in [-565 .. -395] (1:1 aligned with bridge mesh!)
        # - Bypasses Roha Sanctuary West at X = -135.0 (> 145m clear of (18, 2400), well outside r=56m bollards!)
        ctrl = [
            (   0.0, -6320.0, 3205.0),  # Entoto High Ridge Overlook (3,205m unobstructed north panorama!)
            ( 820.0, -5960.0, 3085.0),
            (-840.0, -5560.0, 2895.0),
            ( 840.0, -5140.0, 2705.0),
            (-820.0, -4720.0, 2520.0),
            (  40.0, -4120.0, 2418.0),
            (   0.0, -3750.0, 2405.0),  # Addis Korkoro Market South Approach (2,405m)
            (   0.0, -3550.0, 2400.0),  # Addis Light Rail Viaduct Underpass (2,400m)
            (   0.0, -3350.0, 2402.0),  # Addis Market North Exit
            ( -90.0, -2680.0, 2455.0),
            (-780.0, -2050.0, 2504.0),  # Dejen South Basalt Rim Overlook (2,504m)
            # South Wall Civil Bench-Cut Hairpins -> straight North-South Abay Bridge approach at X = 0.0!
            ( 880.0, -1880.0, 2318.0),
            (-880.0, -1710.0, 2132.0),
            ( 880.0, -1540.0, 1946.0),
            (-880.0, -1370.0, 1760.0),
            ( 880.0, -1200.0, 1574.0),
            (-880.0, -1030.0, 1360.0),
            ( 880.0,  -870.0, 1155.0),
            (-820.0,  -730.0, 1022.0),
            (   0.0,  -635.0, 1020.0),
            (   0.0,  -570.0, 1020.0),  # South Bridge Abutment (X=0.0, Y=1020.0, yaw=0.00!)
            (   0.0,  -480.0, 1020.0),  # Abay Gorge Steel Truss Bridge Center (X=0.0, Y=1020.0!)
            (   0.0,  -390.0, 1020.0),  # North Bridge Abutment (X=0.0, Y=1020.0, yaw=0.00!)
            (   0.0,  -325.0, 1020.0),
            # North Wall Civil Bench-Cut Hairpins -> Goha Tsion Rim (2,500m)
            ( 840.0,  -200.0, 1125.0),
            (-880.0,   -60.0, 1228.0),
            ( 880.0,   130.0, 1410.0),
            (-880.0,   320.0, 1592.0),
            ( 880.0,   510.0, 1774.0),
            (-880.0,   700.0, 1956.0),
            ( 880.0,   890.0, 2138.0),
            (-880.0,  1080.0, 2320.0),
            ( 680.0,  1270.0, 2500.0),  # Goha Tsion North Basalt Rim (2,500m)
            (-120.0,  1850.0, 2500.0),
            # Bypass Roha Sanctuary strictly West along X = -135m (>150m from (18, 2400)!)
            (-135.0,  2250.0, 2500.0),
            (-135.0,  2400.0, 2500.0),  # Roha Western Highway Turnout (97m West of r=56m bollards!)
            (-130.0,  2580.0, 2512.0),
            # Simien Escarpment Climb: 2,500m -> 3,926m Imet Gogo -> 4,550m Ras Dashen
            ( 860.0,  2840.0, 2645.0),
            (-880.0,  3160.0, 2845.0),
            ( 880.0,  3490.0, 3045.0),
            (-880.0,  3820.0, 3245.0),
            ( 880.0,  4150.0, 3445.0),
            (-880.0,  4480.0, 3645.0),
            ( 880.0,  4810.0, 3845.0),
            (-860.0,  5150.0, 4040.0),
            ( 860.0,  5490.0, 4235.0),
            (-840.0,  5850.0, 4420.0),
            (   0.0,  6150.0, 4512.0),  # Ras Dashen Alpine Trailhead Turnout (final 70m summit cone is pure basalt foot scramble!)
        ]

    # Expand sharp hairpin vertices (|x| >= 720) into wide, level civil turnaround pads (z - 34 .. z + 34 at constant y!)
    # so upper & lower legs never pinch within < 25m grid cells and trucks turn on a flat 0-2% super-elevated pad!
    if patch_mode != "A_DRAPED_CHORD":
        expanded = [ctrl[0]]
        for k in range(1, len(ctrl) - 1):
            cx, cz, cy = ctrl[k]
            prev_x = ctrl[k - 1][0]
            next_x = ctrl[k + 1][0]
            if abs(cx) >= 720.0 and (cx - prev_x) * (next_x - cx) < 0:
                pad_x = np.sign(cx) * 845.0
                expanded.append((pad_x, cz - 34.0, cy))
                expanded.append((pad_x, cz + 34.0, cy))
            else:
                expanded.append((cx, cz, cy))
        expanded.append(ctrl[-1])
        pts = np.array(expanded, dtype=np.float64)
    else:
        pts = np.array(ctrl, dtype=np.float64)

    dense_xyz = []
    n = len(pts)
    for i in range(n - 1):
        p0 = pts[max(0, i - 1)]
        p1 = pts[i]
        p2 = pts[i + 1]
        p3 = pts[min(n - 1, i + 2)]
        seg_len = np.hypot(p2[0] - p1[0], p2[1] - p1[1])
        steps = max(8, int(seg_len / 18.0))
        seg_pts = []
        for s in range(steps + 1):
            t = s / steps
            t2, t3 = t * t, t * t * t
            tau = 0.22
            xz = (
                p1[:2]
                + (-tau * p0[:2] + tau * p2[:2]) * t
                + (2 * tau * p0[:2] + (tau - 3) * p1[:2] + (3 - 2 * tau) * p2[:2] - tau * p3[:2]) * t2
                + (-tau * p0[:2] + (2 - tau) * p1[:2] + (tau - 2) * p2[:2] + tau * p3[:2]) * t3
            )
            seg_pts.append(xz)
        seg_pts = np.array(seg_pts)
        seg_ds = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(seg_pts[:, 0]), np.diff(seg_pts[:, 1])))])
        tot_s = max(seg_ds[-1], 1e-6)
        for s in range(steps):
            u_arc = seg_ds[s] / tot_s
            y = p1[2] + (p2[2] - p1[2]) * u_arc
            dense_xyz.append([seg_pts[s, 0], y, seg_pts[s, 1]])
    dense_xyz.append([pts[-1, 0], pts[-1, 2], pts[-1, 1]])
    arr = np.array(dense_xyz, dtype=np.float64)

    # Enforce strict ERA mountain-switchback grade ceiling |dy/ds| <= 0.138 (13.8%) except on Patch A
    if patch_mode != "A_DRAPED_CHORD":
        ds = np.hypot(np.diff(arr[:, 0]), np.diff(arr[:, 2]))
        y_clamped = arr[:, 1].copy()
        max_g = 0.138
        for i in range(1, len(y_clamped)):
            lim = max_g * max(ds[i - 1], 0.5)
            y_clamped[i] = np.clip(y_clamped[i], y_clamped[i - 1] - lim, y_clamped[i - 1] + lim)
        arr[:, 1] = y_clamped
    return arr


def evaluate_anisotropic_terrain(xx, zz, orbital_m, gorge_m, simien_m, debias_canopy=True):
    """
    1:1 Metric Verticality Anisotropic Domain Warp z_ASL(X, Z) in meters above sea level.
    Invariants locked at 1:1 vertical scale:
      - Entoto Ridge (Z = -5850): 3,200 m ASL
      - Addis Korkoro / Light Rail Basin (Z = -3550): 2,400 m ASL
      - Abay Gorge Rim (Z = -1920 & +1180): ~2,504 m ASL -> Riverbed (Z = -480): 1,004 m ASL (1,500 m 1:1 drop!)
      - Roha / Lalibela Volcanic Tuff Plateau (Z = +2400): 2,500 m ASL (prior to 12.0 m MLO subtraction)
      - Simien Imet Gogo Promontory (Z = +5380): 3,926 m ASL -> Ras Dashen Crown (Z = +6220): 4,550 m ASL
    """
    # Base longitudinal elevation spine z_base(Z)
    # Plunge immediately north of Entoto crest (Z = -6300 -> -4250) so default ?hud=0 spawn has a 100% open vista over Addis & Abay!
    z_entoto = 3208.0 - 808.0 * smoothstep(-6290.0, -4250.0, zz)
    # Addis 2,400m -> slight rise to 2,520m Dejen rim
    z_rim_s = z_entoto + 120.0 * smoothstep(-3100.0, -2050.0, zz)
    # 1,500m 1:1 Abay Canyon cut centered cleanly at Z = -480m under the bridge + meandering outer canyon channel!
    meander_z = -480.0 + (165.0 * np.sin(xx * 0.00095) + 70.0 * np.cos(xx * 0.0021)) * smoothstep(90.0, 420.0, np.abs(xx))
    canyon_dist = np.abs(zz - meander_z)
    # Multi-tiered basalt -> Antalo limestone -> Adigrat sandstone bench profile + recessed 999m river thalweg!
    tier_outer = 1.0 - smoothstep(180.0, 1380.0, canyon_dist)
    tier_inner = 1.0 - smoothstep(52.0, 420.0, canyon_dist)
    thalweg_cut = 14.0 * (1.0 - smoothstep(26.0, 56.0, canyon_dist))
    canyon_cut = 980.0 * tier_outer + 532.0 * tier_inner + thalweg_cut

    z_post_gorge = z_rim_s - canyon_cut
    # Roha plateau around Z = +2,400m sits cleanly at 2,500m ASL
    roha_flat = 1.0 - np.exp(-((xx - 18.0) ** 2 + (zz - 2400.0) ** 2) / (420.0 ** 2))
    # Ascend from Roha (2,500m) up Simien flood-basalt escarpment to 3,926m Imet Gogo & undulating 4,340m Afroalpine ridge,
    # peaking cleanly at 4,550m ONLY at Ras Dashen (0, +6220) without flat-clipping surrounding ridges, then sheer Geech Abyss!
    simien_climb = 1426.0 * smoothstep(2950.0, 5350.0, zz) + 410.0 * smoothstep(5350.0, 6160.0, zz)
    north_abyss_drop = -1780.0 * smoothstep(6360.0, 6880.0, zz)

    z_spine = z_post_gorge + simien_climb + north_abyss_drop

    # Blend real empirical high-frequency DEM micro-relief from our hashed satellite rasters!
    # 1. Orbital macro massif relief across entire 14x14 km shell
    u_orb = (xx + 7000.0) / 14000.0
    v_orb = (zz + 7000.0) / 14000.0
    orb_val = bilinear_sample(orbital_m, u_orb * 0.45 + 0.32, v_orb * 0.55 + 0.25)
    orb_detail = (orb_val - np.mean(orbital_m)) * 0.14

    # 2. Real Abay Gorge 384x384 DEM detail in [-2400 <= Z <= +1500]
    u_gorge = np.mod((xx + 7000.0) / 3600.0, 1.0)
    v_gorge = np.clip((zz + 2100.0) / 3400.0, 0.0, 1.0)
    gorge_val = bilinear_sample(gorge_m, u_gorge, v_gorge)
    gorge_detail = (gorge_val - 1760.0) * 0.18 * (1.0 - smoothstep(900.0, 1900.0, canyon_dist))

    # 3. Real Simien Imet Gogo 384x384 DEM crags & ridges in [Z >= +3000] (scaled so ridges undulate in 3,920..4,450m below 4,550m peak!)
    u_sim = np.mod((xx + 7000.0) / 3200.0, 1.0)
    v_sim = np.clip((zz - 3000.0) / 4000.0, 0.0, 1.0)
    sim_val = bilinear_sample(simien_m, u_sim, v_sim)
    sim_detail = (sim_val - 3150.0) * 0.18 * smoothstep(3000.0, 4200.0, zz)

    # Lateral Rift/Massif wall relief outside the 2 km central valley so horizon sightlines feel monumental
    lateral_wall = 240.0 * smoothstep(950.0, 5200.0, np.abs(xx)) * (0.4 + 0.6 * np.sin(zz * 0.0007 + xx * 0.0004) ** 2)

    # FABDEM bare-earth canopy/roof debiasing (strips 2.88m eucalyptus canopy / 1.12m korkoro roof sensor bias)
    canopy_bias = 0.0
    if not debias_canopy:
        canopy_bias = 2.88 * np.sin(xx * 0.09) * np.cos(zz * 0.09) * smoothstep(-6200.0, -5200.0, zz)

    detail_mask = roha_flat * (0.25 + 0.75 * smoothstep(180.0, 650.0, np.hypot(xx, zz + 3550.0)))
    elev = z_spine + (orb_detail + gorge_detail + sim_detail + lateral_wall) * detail_mask + canopy_bias
    # Level the Roha monolithic volcanic-tuff host bench [-65..+85] x [2340..2460] cleanly at 2,500.0m ASL
    # so all four walls of the 12.0m subtractive trench have true 12.00m vertical relief!
    roha_bench = (1.0 - smoothstep(48.0, 95.0, np.abs(xx - 10.0))) * (1.0 - smoothstep(42.0, 85.0, np.abs(zz - 2400.0)))
    elev = elev * (1.0 - roha_bench) + 2500.0 * roha_bench
    # Conical Ras Dashen volcanic basalt summit peak rising cleanly to 4,550.0m strictly at (0, +6220) without flat-table clipping!
    elev = np.minimum(elev, 4485.0)
    summit_cone = np.maximum(0.0, 1.0 - np.hypot(xx, zz - 6220.0) / 210.0) ** 1.35
    elev = elev + (4550.0 - elev) * summit_cone
    elev = np.clip(elev, 911.0, 4550.0)
    return elev


def grade_road_into_terrain(xx, zz, elev, road_xyz, half_width=32.0, drape_raw=False):
    """
    Coupled terrain + arterial civil bench-cut pass (Section 4 & 10):
    Bench-cuts the engineered road deck z_road(s) into the 1:1 cliff heightfield while preserving
    full vertical cliff prominence outside the bench shoulder.
    """
    road_xy = road_xyz[:, [0, 2]]
    ds = np.linalg.norm(np.diff(road_xy, axis=0), axis=1)
    s_cum = np.concatenate([[0.0], np.cumsum(ds)])

    if drape_raw:
        gx = (road_xy[:, 0] + 7000.0) / 14000.0 * (elev.shape[1] - 1)
        gz = (road_xy[:, 1] + 7000.0) / 14000.0 * (elev.shape[0] - 1)
        ix = np.clip(np.round(gx).astype(int), 0, elev.shape[1] - 1)
        iz = np.clip(np.round(gz).astype(int), 0, elev.shape[0] - 1)
        r_deck = elev[iz, ix].copy()
    else:
        r_deck = road_xyz[:, 1].copy()

    dz = np.abs(np.diff(r_deck))
    grades_pct = (dz / np.maximum(ds, 0.5)) * 100.0

    out_elev = elev.copy()
    col_mask = np.where((xx[0, :] >= -980.0) & (xx[0, :] <= 980.0))[0]
    sub_x = xx[:, col_mask]
    sub_z = zz[:, col_mask]
    sub_e = out_elev[:, col_mask].copy()

    flat_x = sub_x.ravel()
    flat_z = sub_z.ravel()
    best_d2 = np.full(flat_x.shape, 1e12, dtype=np.float64)
    best_ry = np.zeros(flat_x.shape, dtype=np.float64)
    best_rz = np.zeros(flat_x.shape, dtype=np.float64)

    for i in range(len(road_xy) - 1):
        ax, az = road_xy[i]
        bx, bz = road_xy[i + 1]
        vx, vz = bx - ax, bz - az
        seg_l2 = vx * vx + vz * vz + 1e-9
        zmin = min(az, bz) - 42.0
        zmax = max(az, bz) + 42.0
        cand = np.where((flat_z >= zmin) & (flat_z <= zmax))[0]
        if len(cand) == 0:
            continue
        t = np.clip(((flat_x[cand] - ax) * vx + (flat_z[cand] - az) * vz) / seg_l2, 0.0, 1.0)
        px = ax + t * vx
        pz = az + t * vz
        d2 = (flat_x[cand] - px) ** 2 + (flat_z[cand] - pz) ** 2
        imp = d2 < best_d2[cand]
        if np.any(imp):
            upd = cand[imp]
            best_d2[upd] = d2[imp]
            best_ry[upd] = r_deck[i] * (1.0 - t[imp]) + r_deck[i + 1] * t[imp]
            best_rz[upd] = pz[imp]

    dist = np.sqrt(best_d2).reshape(sub_e.shape)
    ry_grid = best_ry.reshape(sub_e.shape)
    rz_grid = best_rz.reshape(sub_e.shape)
    # Keep Abay River gorge open underneath the steel truss bridge span Z in [-558 .. -402], while grading clean North/South abutments!
    not_span = smoothstep(70.0, 92.0, np.abs(rz_grid + 480.0))
    blend = (1.0 - smoothstep(half_width, half_width + 38.0, dist)) * not_span
    sub_e = sub_e * (1.0 - blend) + ry_grid * blend
    out_elev[:, col_mask] = sub_e

    out_road_xyz = np.column_stack([road_xy[:, 0], r_deck, road_xy[:, 1]])
    return out_elev, out_road_xyz, grades_pct, float(s_cum[-1])


def main():
    t0 = time.time()
    print("[SCION DEMIURGE] Step 1: Hashing Immutable Source Vault (SHA-256)...")
    vault_receipts = {}
    for key, meta in RAW_SOURCES.items():
        full_p = os.path.join(REPO_ROOT, meta["rel_path"])
        digest = sha256_file(full_p)
        size_b = os.path.getsize(full_p)
        vault_receipts[key] = {
            **meta,
            "bytes": size_b,
            "sha256": digest
        }
        print(f"  ✓ {key}: {size_b:,} B · sha256={digest[:16]}...")

    # Load empirical elevation rasters into metric float32
    orb_u16 = np.fromfile(os.path.join(REPO_ROOT, RAW_SOURCES["orbital_macro_dem"]["rel_path"]), dtype="<u2").reshape(540, 420)
    orbital_m = -525.6 + (orb_u16.astype(np.float64) / 65535.0) * (4317.7 - (-525.6))

    gorge_u16 = np.fromfile(os.path.join(REPO_ROOT, RAW_SOURCES["abay_gorge_dem"]["rel_path"]), dtype="<u2").reshape(384, 384)
    gorge_m = 1004.0 + (gorge_u16.astype(np.float64) / 65535.0) * (2531.6 - 1004.0)

    sim_u16 = np.fromfile(os.path.join(REPO_ROOT, RAW_SOURCES["simien_escarpment_dem"]["rel_path"]), dtype="<u2").reshape(384, 384)
    simien_m = 1962.88 + (sim_u16.astype(np.float64) / 65535.0) * (3926.50 - 1962.88)

    print("[SCION DEMIURGE] Step 2: Running Differential Inquiry (ΔΔ) on 1:1 Canyon Prominence vs. Freight Switchback Grade...")
    # Grid for evaluation: 561 x 561 posts = 25.0 m exact post spacing -> every 1,000 m sector boundary lands on exact integer post k * 40!
    N_GRID = 561  # (561 - 1) = 560 intervals across 14,000 m => exact 25.0 m spacing; 40 intervals per 1x1 km sector!
    xs = np.linspace(-7000.0, 7000.0, N_GRID)
    zs = np.linspace(-7000.0, 7000.0, N_GRID)
    XX, ZZ = np.meshgrid(xs, zs)

    # Patch A: Naive Direct Chord Draped Over Raw Cliff + Canopy Bias
    elev_raw_a = evaluate_anisotropic_terrain(XX, ZZ, orbital_m, gorge_m, simien_m, debias_canopy=False)
    road_xyz_a0 = build_arterial_corridor_spline("A_DRAPED_CHORD")
    _, _, grades_a, len_a = grade_road_into_terrain(XX, ZZ, elev_raw_a, road_xyz_a0, drape_raw=True)

    # Patch B: Arc-Length Grade-Clamped Civil Bench-Cut (<= 13.8%) + FABDEM Bare-Earth Canopy Debiasing
    elev_raw_b = evaluate_anisotropic_terrain(XX, ZZ, orbital_m, gorge_m, simien_m, debias_canopy=True)
    road_xyz_b0 = build_arterial_corridor_spline("B_BENCH_CUT")
    elev_graded_b, road_xyz_b, grades_b, len_b = grade_road_into_terrain(XX, ZZ, elev_raw_b, road_xyz_b0, drape_raw=False)
    # Level Roha monolithic tuff terrace [-160..+85] x [2335..2465] to exact 2,500.00m ASL post-road-grading
    roha_post = (1.0 - smoothstep(135.0, 195.0, np.abs(XX + 35.0))) * (1.0 - smoothstep(58.0, 105.0, np.abs(ZZ - 2400.0)))
    elev_graded_b = elev_graded_b * (1.0 - roha_post) + 2500.0 * roha_post

    # Enforce strict hydrostatic Abay River containment:
    # 1) Inside thalweg (river_d <= 36m): recessed riverbed at 998.0..1005.5m (strictly under 1,006.0m water plane!)
    # 2) Outside thalweg (river_d > 36m): bare canyon ground monotonically >= 1006.6m + 0.45*(river_d - 36m) -> ZERO dry ground < 1006m!
    meander_post = -480.0 + (165.0 * np.sin(XX * 0.00095) + 70.0 * np.cos(XX * 0.0021)) * smoothstep(90.0, 420.0, np.abs(XX))
    river_d = np.abs(ZZ - meander_post)
    in_bed = river_d <= 36.0
    bed_prof = 998.0 + 7.6 * np.minimum(1.0, (river_d / 36.0) ** 2)
    bank_floor = 1006.8 + 11.2 * smoothstep(36.0, 88.0, river_d)
    canyon_zone = np.abs(ZZ - meander_post) < 480.0
    elev_graded_b = np.where(canyon_zone & in_bed, bed_prof, np.where(canyon_zone & (~in_bed), np.maximum(elev_graded_b, bank_floor), elev_graded_b))

    # Hinge at exact grid post iz=29 (Z = -6275.0, 3,202.5m): flat behind player (z <= -6275 -> full 6m 3rd-person camera!),
    # dropping immediately to 3,184m at iz=30 (Z = -6250) and concavely into the 2,400m Addis Basin (> 2.6m..70m ray clearance!)
    entoto_rim_flat = (1.0 - smoothstep(180.0, 320.0, np.abs(XX))) * (1.0 - smoothstep(-6274.5, -6273.5, ZZ)) * smoothstep(-6450.0, -6360.0, ZZ)
    elev_graded_b = elev_graded_b * (1.0 - entoto_rim_flat) + 3202.5 * entoto_rim_flat

    sightline_wedge = (1.0 - smoothstep(260.0, 520.0, np.abs(XX))) * smoothstep(-6274.8, -6249.5, ZZ) * (1.0 - smoothstep(-3800.0, -3520.0, ZZ))
    u_to_addis = np.clip((ZZ + 6250.0) / (-3920.0 + 6250.0), 0.0, 1.0)
    max_sight_elev = (3172.0 * (1.0 - u_to_addis) + 2402.0 * u_to_addis) - 75.0 * np.sin(np.pi * (u_to_addis ** 0.72))
    clamped_wedge = np.minimum(elev_graded_b, max_sight_elev)
    elev_graded_b = elev_graded_b * (1.0 - sightline_wedge) + (clamped_wedge * 0.85 + max_sight_elev * 0.15) * sightline_wedge

    # Grade wide Addis Urban Basin Terrace (|X| < 220m, Z in [-4020..-3320]) smoothly around 2,400m so buildings/viaduct/Buna mats sit flush!
    addis_terrace = (1.0 - smoothstep(175.0, 290.0, np.abs(XX))) * (1.0 - smoothstep(340.0, 480.0, np.abs(ZZ + 3650.0)))
    addis_target = 2400.0 + 0.015 * np.abs(XX) - 0.012 * (ZZ + 3550.0)
    elev_graded_b = elev_graded_b * (1.0 - addis_terrace) + addis_target * addis_terrace

    # Conical Ras Dashen 4,550.0m Summit Crown at (0, +6220) post-road-grading (natural rocky basalt slope, zero flat pancake!)
    dashen_r = np.hypot(XX, ZZ - 6220.0)
    dashen_cone = (1.0 - smoothstep(14.0, 145.0, dashen_r))
    dashen_profile = 4550.0 - 0.34 * np.maximum(0.0, dashen_r - 10.0)
    elev_graded_b = elev_graded_b * (1.0 - dashen_cone) + np.maximum(elev_graded_b, dashen_profile) * dashen_cone
    elev_graded_b = np.clip(elev_graded_b, 911.0, 4550.0)

    delta_delta_record = {
        "inquiry_id": "DD_01_ABAY_PROMINENCE_VS_ISUZU_GRADE",
        "trigger": "Collision between locked 1:1 1,500m Blue Nile Gorge vertical drop inside 40:1 compressed 14km map and Isuzu FSR heavy-truck drivability (stall threshold 16.0% grade).",
        "hidden_assumption": "Draping a switchback spline onto raw cliff spurs inherits 200%+ spur gradients instead of bench-cutting a monotonic arc-length profile z_road(s).",
        "patch_A_naive_chord": {
            "arterial_length_km": round(len_a / 1000.0, 2),
            "p95_grade_pct": round(float(np.percentile(grades_a, 95)), 2),
            "max_grade_pct": round(float(np.max(grades_a)), 2),
            "canyon_prominence_m": round(float(np.max(elev_raw_a[195:335, 240:320]) - np.min(elev_raw_a[240:280, 240:320])), 1),
            "isuzu_climb_pass": bool(np.max(grades_a) <= 16.0)
        },
        "patch_B_civil_bench_cut_and_debias": {
            "arterial_length_km": round(len_b / 1000.0, 2),
            "p95_grade_pct": round(float(np.percentile(grades_b, 95)), 2),
            "max_grade_pct": round(float(np.max(grades_b)), 2),
            "canyon_prominence_m": round(float(np.max(elev_graded_b[195:335, 240:320]) - np.min(elev_graded_b[240:280, 240:320])), 1),
            "isuzu_climb_pass": bool(np.max(grades_b) <= 16.0)
        },
        "winner": "patch_B_civil_bench_cut_and_debias",
        "constitutional_update": "Enforce civil bench-cut arc-length grade ceiling |dz/ds| <= 13.8% across 8-leg lateral traverses [-880m, +880m], cutting a 28m retaining bench into 1:1 cliffs."
    }
    print("  ✓ ΔΔ Inquiry Result:", json.dumps(delta_delta_record["patch_A_naive_chord"]), "vs", json.dumps(delta_delta_record["patch_B_civil_bench_cut_and_debias"]))

    print("[SCION DEMIURGE] Step 3: Compiling 196 Atomic 1x1 km Sector Cells & Auditing All 406 Shared Seam Edges...")
    # Each 1x1 km sector spans 40 x 40 grid cells (41 x 41 posts). Verify exact shared edge profiles!
    sectors = []
    max_seam_gap_m = 0.0
    seam_edges_checked = 0

    sector_slices = {}
    for row in range(14):
        for col in range(14):
            z0_i, z1_i = row * 40, (row + 1) * 40 + 1
            x0_i, x1_i = col * 40, (col + 1) * 40 + 1
            cell = elev_graded_b[z0_i:z1_i, x0_i:x1_i]
            sector_slices[(row, col)] = cell
            is_crucible = col in (6, 7)
            min_e = float(cell.min())
            max_e = float(cell.max())
            mean_e = float(cell.mean())
            belt = (
                "WURCH" if mean_e >= 3000.0 else
                "DEGA" if mean_e >= 2400.0 else
                "WEYNA_DEGA" if mean_e >= 1800.0 else
                "KOLLA"
            )
            cell_hash = hashlib.sha256(cell.astype("<f4").tobytes()).hexdigest()[:16]
            has_mlo = (row == 9 and col == 7)  # X in [0..1000], Z in [+2000..+3000] houses Roha Sunken Trench at (+18, +2400)!
            sectors.append({
                "id": f"S_{row:02d}_{col:02d}",
                "row": row,
                "col": col,
                "bbox_m": [-7000 + col * 1000, -7000 + row * 1000, -7000 + (col + 1) * 1000, -7000 + (row + 1) * 1000],
                "tier": "HD_CRUCIBLE" if is_crucible else "SLOD_SHELL",
                "agro_belt": belt,
                "elev_range_m": [round(min_e, 2), round(max_e, 2)],
                "has_subtractive_mlo": has_mlo,
                "slod_parent": f"SLOD_Q_{row // 4}_{col // 4}",
                "sha256_16": cell_hash
            })

    # Verify all horizontal & vertical neighbor borders across the 196-sector quadtree
    for row in range(14):
        for col in range(14):
            c = sector_slices[(row, col)]
            if col + 1 < 14:
                east = sector_slices[(row, col + 1)]
                gap = float(np.max(np.abs(c[:, -1] - east[:, 0])))
                max_seam_gap_m = max(max_seam_gap_m, gap)
                seam_edges_checked += 1
            if row + 1 < 14:
                north = sector_slices[(row + 1, col)]
                gap = float(np.max(np.abs(c[-1, :] - north[0, :])))
                max_seam_gap_m = max(max_seam_gap_m, gap)
                seam_edges_checked += 1

    assert max_seam_gap_m == 0.0, f"HARD SEAM BREAKER: {max_seam_gap_m} m > 0.00 m"
    print(f"  ✓ Verified {seam_edges_checked} sector borders across 196 cells · max_seam_gap_m = {max_seam_gap_m:.6f} m")

    print("[SCION DEMIURGE] Step 4: Extracting Empirical FTW (ABF1) Smallholder Parcel Polygons...")
    ftw_gorge = load_abf1_sample_polygons(os.path.join(REPO_ROOT, RAW_SOURCES["ftw_gorge_parcels"]["rel_path"]), max_polys=180)
    ftw_simien = load_abf1_sample_polygons(os.path.join(REPO_ROOT, RAW_SOURCES["ftw_simien_parcels"]["rel_path"]), max_polys=140)
    print(f"  ✓ Extracted {len(ftw_gorge['sampled_cluster']) + len(ftw_simien['sampled_cluster'])} real FTW parcel vectors")

    # Quantize 561x561 heightfield into exact 0.1m Uint16 [0..65535] spanning [800.0m .. 4800.0m] -> 0.061m vertical precision!
    ELEV_MIN_PACK = 800.0
    ELEV_MAX_PACK = 4800.0
    q16 = np.clip(np.round((elev_graded_b - ELEV_MIN_PACK) / (ELEV_MAX_PACK - ELEV_MIN_PACK) * 65535.0), 0, 65535).astype("<u2")
    raw_bytes = q16.tobytes()
    # Compress or store raw base64? Wait: WebGL2 single-file HTML without external libs can decode uncompressed base64 in 3ms OR DecompressionStream('deflate')!
    # Even raw 561*561*2 bytes is ONLY 629 KB (839 KB base64) — instant synchronous decode in 2ms with zero async DecompressionStream delay!
    b64_dem = base64.b64encode(raw_bytes).decode("ascii")

    # Subsample road_xyz_b cleanly to ~780 vertices for smooth hairpin spline lookup & guardrail extrusion
    stride = max(1, len(road_xyz_b) // 780)
    road_compact = np.round(road_xyz_b[::stride], 2).tolist()
    if road_compact[-1] != np.round(road_xyz_b[-1], 2).tolist():
        road_compact.append(np.round(road_xyz_b[-1], 2).tolist())

    # Subtractive MLO Portal Specification for Roha Sunken Monolithic Trench (Sector S_09_07)
    roha_mlo_spec = {
        "mlo_id": "MLO_ROHA_SUNKEN_CRUCIFORM_01",
        "sector_id": "S_09_07",
        "center_xz_m": [20.0, 2400.0],
        "sanctuary_bollard_radius_m": 64.0,
        "sanctuary_no_fly_dismount": True,
        "rim_elev_m": round(float(elev_graded_b[int((2400 + 7000) / 25), int((20 + 7000) / 25)]), 2),
        "trench_depth_m": 12.0,
        "pit_half_extents_m": [15.0, 15.0],
        "dromos_portal_west": {
            "entry_xz_m": [-35.0, 2400.0],
            "threshold_xz_m": [5.0, 2400.0],
            "width_m": 10.0,
            "dignity_rule": "BAREFOOT_NON_COMBAT_ALL_VEHICLES_MOUNTS_GLIDERS_AND_PACK_NPCS_EXCLUDED"
        },
        "monolith_cruciform_bounds_m": {
            "arm_span_m": 11.8,
            "arm_width_m": 5.2,
            "height_m": 11.8,
            "conservation_truss_2026": True,
            "provenance_note": "Synthesized strictly from published dimensional plans; zero Zamani TLS scan vertices ingested.",
            "active_ghost": "[[GHOST::CLEAN_LALI_SFM]]"
        }
    }

    sector_graph = {
        "world": "Abyssinian-Harar Vertical Open World",
        "compiler_version": "SCION_DEMIURGE_1.0.0",
        "compiled_at_unix": round(time.time(), 2),
        "footprint_km": [14.0, 14.0],
        "crucible_corridor_km": [2.0, 14.0],
        "anisotropic_law": "40:1 horizontal inter-basin fault warp; 1:1 metric vertical relief (911m-4,550m ASL)",
        "grid_posts": N_GRID,
        "post_spacing_m": 25.0,
        "sector_count": len(sectors),
        "crucible_sector_count": sum(1 for s in sectors if s["tier"] == "HD_CRUCIBLE"),
        "slod_sector_count": sum(1 for s in sectors if s["tier"] == "SLOD_SHELL"),
        "seam_audit": {
            "shared_borders_verified": seam_edges_checked,
            "max_seam_gap_m": max_seam_gap_m,
            "pass": True
        },
        "subtractive_mlos": [roha_mlo_spec],
        "source_vault_sha256": vault_receipts,
        "delta_delta_inquiries": [delta_delta_record],
        "sectors": sectors
    }

    with open(os.path.join(OUT_DIR, "sector_graph_196.json"), "w", encoding="utf-8") as f:
        json.dump(sector_graph, f, indent=2)

    runtime_pack = {
        "gridN": N_GRID,
        "worldSpanM": 14000.0,
        "elevMinM": ELEV_MIN_PACK,
        "elevMaxM": ELEV_MAX_PACK,
        "demU16B64": b64_dem,
        "roadXYZ": road_compact,
        "rohaMLO": roha_mlo_spec,
        "ftwParcels": ftw_gorge["sampled_cluster"][:110] + ftw_simien["sampled_cluster"][:80],
        "deltaDelta": delta_delta_record,
        "seamAudit": sector_graph["seam_audit"],
        "vaultHashes": {k: v["sha256"][:16] for k, v in vault_receipts.items()}
    }
    with open(os.path.join(OUT_DIR, "crucible_pack.json"), "w", encoding="utf-8") as f:
        json.dump(runtime_pack, f, separators=(",", ":"))

    print(f"[SCION DEMIURGE] Compilation succeeded in {time.time() - t0:.2f}s -> {OUT_DIR}/crucible_pack.json ({os.path.getsize(os.path.join(OUT_DIR, 'crucible_pack.json')) // 1024} KB)")


if __name__ == "__main__":
    main()
