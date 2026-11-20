#!/usr/bin/env python3
"""
Ethiopian Highlands Real-DEM Fetcher & Geological Terrain Pack Compiler
=======================================================================
Fetches real public AWS Open Data Terrarium satellite elevation tiles
(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`,
where `elev_m = (R * 256.0 + G + B / 256.0) - 32768.0`) around the 4 exact
Abyssinian Massif / Horn of Africa regions:

  1. simien_imet_gogo       — Simien Mountains & Imet Gogo Promontory (13.2167°N, 38.0833°E -> Geech Abyss, 3,926 m)
  2. gheralta_spires        — Gheralta Mountains, Tigray (13.9722°N, 39.4286°E / Hawzen-Korkor Adigrat Sandstone Spires)
  3. blue_nile_gorge        — Blue Nile (Abay) Gorge (10.0750°N, 38.1917°E, Dejen–Goha Tsion Multi-Tiered Canyon)
  4. gerd_belaya_escarpment — GERD Western Escarpment -> Mt. Belaya / Dangur Highland Wall (11.2153°N, 35.0931°E)

Outputs (< 1.8 MB total for < 1s GitHub Pages streaming):
  - `<id>.dem16.bin`     : 384x384 little-endian Uint16 lossless inner heightfield (288 KB each)
  - `<id>.horizon16.bin` : 129x129 little-endian Uint16 16.8 km outer massif skirt (32.5 KB each)
  - `<id>_height16.png`  : 256x256 16-bit grayscale PNG inspection / fallback heightmap
  - `manifest.json`      : Exact geographic metadata, elevation bounds, vertical scale, water planes & curated landmarks
"""

import concurrent.futures
import io
import json
import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

OUT_DIR = Path(__file__).resolve().parent
INNER_N = 384
HORIZON_N = 129
PNG_N = 256

WORLD_SPAN_M = 2400.0
HORIZON_SPAN_M = 16800.0

TILE_CACHE = {}


def latlon_to_tile_f(lat: float, lon: float, z: int):
    lat_rad = math.radians(lat)
    n = 2.0 ** z
    xtile = (lon + 180.0) / 360.0 * n
    ytile = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n
    return xtile, ytile


def tile_to_latlon(xtile: float, ytile: float, z: int):
    n = 2.0 ** z
    lon = xtile / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1.0 - 2.0 * ytile / n)))
    return math.degrees(lat_rad), lon


def fetch_terrarium_tile(args):
    z, x, y = args
    if args in TILE_CACHE:
        return (x, y), TILE_CACHE[args]
    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
    req = urllib.request.Request(url, headers={"User-Agent": "DonkeyWater-EthiopiaDEM/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw = resp.read()
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            arr = np.asarray(img, dtype=np.float32)
            elev = (arr[:, :, 0] * 256.0 + arr[:, :, 1] + arr[:, :, 2] / 256.0) - 32768.0
            TILE_CACHE[args] = elev
            return (x, y), elev
        except Exception:
            if attempt == 2:
                raise


def fetch_dem_window(center_lat: float, center_lon: float, z: int, span_km: float, out_n: int):
    cx, cy = latlon_to_tile_f(center_lat, center_lon, z)
    circum_lat_km = 40075.016686 * math.cos(math.radians(center_lat))
    km_per_tile = circum_lat_km / (2.0 ** z)
    km_per_px = km_per_tile / 256.0
    span_px = max(64.0, span_km / km_per_px)

    px0 = cx * 256.0 - span_px * 0.5
    py0 = cy * 256.0 - span_px * 0.5
    px1 = cx * 256.0 + span_px * 0.5
    py1 = cy * 256.0 + span_px * 0.5

    tx0 = int(math.floor(px0 / 256.0)) - 1
    tx1 = int(math.floor(px1 / 256.0)) + 1
    ty0 = int(math.floor(py0 / 256.0)) - 1
    ty1 = int(math.floor(py1 / 256.0)) + 1

    tasks = [(z, tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        tiles = dict(ex.map(fetch_terrarium_tile, tasks))

    mw = (tx1 - tx0 + 1) * 256
    mh = (ty1 - ty0 + 1) * 256
    mosaic = np.zeros((mh, mw), dtype=np.float32)
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = tiles[(tx, ty)]

    ox0 = px0 - tx0 * 256.0
    oy0 = py0 - ty0 * 256.0
    ox1 = px1 - tx0 * 256.0
    oy1 = py1 - ty0 * 256.0

    fimg = Image.fromarray(mosaic, mode="F")
    resampled = fimg.resize((out_n, out_n), resample=Image.Resampling.BICUBIC, box=(ox0, oy0, ox1, oy1))
    grid = np.asarray(resampled, dtype=np.float32).copy()

    lat_north, lon_west = tile_to_latlon(px0 / 256.0, py0 / 256.0, z)
    lat_south, lon_east = tile_to_latlon(px1 / 256.0, py1 / 256.0, z)
    actual_span_x = (lon_east - lon_west) * 111.320 * math.cos(math.radians(center_lat))
    actual_span_y = (lat_north - lat_south) * 110.574

    bounds = {
        "latSouth": round(float(lat_south), 6),
        "latNorth": round(float(lat_north), 6),
        "lonWest": round(float(lon_west), 6),
        "lonEast": round(float(lon_east), 6),
        "spanKmX": round(float(actual_span_x), 3),
        "spanKmY": round(float(actual_span_y), 3),
        "zoom": z,
    }
    return grid, bounds


def gaussian_blur_2d(arr: np.ndarray, sigma: float) -> np.ndarray:
    if sigma <= 0.05:
        return arr.copy()
    radius = max(1, int(math.ceil(sigma * 3.0)))
    x = np.arange(-radius, radius + 1, dtype=np.float32)
    k = np.exp(-(x * x) / (2.0 * sigma * sigma))
    k /= k.sum()
    pad_h = np.pad(arr, ((0, 0), (radius, radius)), mode="edge")
    tmp = np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), axis=1, arr=pad_h)
    pad_v = np.pad(tmp, ((radius, radius), (0, 0)), mode="edge")
    out = np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), axis=0, arr=pad_v)
    return out.astype(np.float32)


def fbm_noise(u: np.ndarray, v: np.ndarray, seed: int = 17, octaves: int = 5) -> np.ndarray:
    rng = np.random.default_rng(seed)
    total = np.zeros_like(u, dtype=np.float32)
    amp = 0.5
    freq = 1.0
    norm = 0.0
    for _ in range(octaves):
        p1 = rng.uniform(0, 2 * math.pi)
        p2 = rng.uniform(0, 2 * math.pi)
        p3 = rng.uniform(0, 2 * math.pi)
        a = rng.uniform(0.85, 1.18)
        b = rng.uniform(0.85, 1.18)
        n1 = np.sin(u * freq * a * 6.28318 + p1) * np.cos(v * freq * b * 6.28318 + p2)
        n2 = np.sin((u * 0.72 + v * 0.69) * freq * 8.8857 + p3)
        layer = 0.6 * n1 + 0.4 * n2
        total += amp * layer
        norm += amp
        amp *= 0.5
        freq *= 2.07
    return (total / max(norm, 1e-6)).astype(np.float32)


def ridged_noise(u: np.ndarray, v: np.ndarray, seed: int = 41, octaves: int = 4) -> np.ndarray:
    rng = np.random.default_rng(seed)
    total = np.zeros_like(u, dtype=np.float32)
    amp = 0.55
    freq = 1.0
    norm = 0.0
    for _ in range(octaves):
        p1 = rng.uniform(0, 2 * math.pi)
        p2 = rng.uniform(0, 2 * math.pi)
        ang = rng.uniform(0, math.pi)
        ru = u * math.cos(ang) - v * math.sin(ang)
        rv = u * math.sin(ang) + v * math.cos(ang)
        raw = np.sin(ru * freq * 6.28318 + p1) * np.cos(rv * freq * 5.4 + p2)
        ridge = 1.0 - np.abs(raw)
        ridge = ridge * ridge
        total += amp * ridge
        norm += amp
        amp *= 0.5
        freq *= 2.13
    return (total / max(norm, 1e-6)).astype(np.float32)


def smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / (edge1 - edge0 + 1e-8), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def sharpen_cliffs(dem: np.ndarray, strength: float = 0.50, sigma: float = 5.5) -> np.ndarray:
    """Smooths sub-tile SRTM radar noise first, then steepens major escarpments cleanly without needle spikes."""
    lo, hi = float(dem.min()), float(dem.max())
    clean = gaussian_blur_2d(dem, 1.05)
    macro = gaussian_blur_2d(clean, sigma)
    gy, gx = np.gradient(macro)
    slope = np.hypot(gx, gy)
    cliff_mask = smoothstep(3.5, 18.0, slope)
    steepened = macro + (clean - macro) * (1.0 + strength * cliff_mask)
    return np.clip(steepened, lo, hi).astype(np.float32)


def level_natural_bench(dem: np.ndarray, wx: np.ndarray, wz: np.ndarray, cx: float, cz: float, radius: float = 20.0, feather: float = 32.0):
    """Levels a gentle natural terrace pad right at the local terrain elevation (NEVER extrudes cylindrical silos!)."""
    dist = np.hypot(wx - cx, wz - cz)
    local_mask = dist <= max(12.0, radius * 0.75)
    if np.any(local_mask):
        target_elev = float(np.median(dem[local_mask]))
    else:
        idx = np.unravel_index(np.argmin(dist), dem.shape)
        target_elev = float(dem[idx])
    w = (1.0 - smoothstep(radius, radius + feather, dist)) * 0.88
    dem[:] = dem * (1.0 - w) + target_elev * w
    return target_elev


def find_natural_site(dem: np.ndarray, wx: np.ndarray, wz: np.ndarray, target_elev: float, x_range, z_range, max_grad: float = 14.0):
    """Finds a naturally occurring bench/shoulder in the real DEM matching `target_elev` and gentle slope."""
    gy, gx = np.gradient(gaussian_blur_2d(dem, 1.5))
    grad = np.hypot(gx, gy)
    score = -np.abs(dem - target_elev) * 1.6 - grad * 16.0
    valid = (wx >= x_range[0]) & (wx <= x_range[1]) & (wz >= z_range[0]) & (wz <= z_range[1]) & (grad <= max_grad)
    if not np.any(valid):
        valid = (wx >= x_range[0]) & (wx <= x_range[1]) & (wz >= z_range[0]) & (wz <= z_range[1])
    score[~valid] = -1e12
    iy, ix = np.unravel_index(np.argmax(score), dem.shape)
    return float(wx[iy, ix]), float(wz[iy, ix]), float(dem[iy, ix])


def sample_grid_at_world(dem: np.ndarray, x: float, z: float, span: float = WORLD_SPAN_M) -> float:
    n = dem.shape[0]
    u = np.clip((x / span + 0.5) * (n - 1), 0.0, n - 1.0001)
    v = np.clip((z / span + 0.5) * (n - 1), 0.0, n - 1.0001)
    ix, iy = int(u), int(v)
    fx, fz = u - ix, v - iy
    h00 = float(dem[iy, ix])
    h01 = float(dem[iy, min(ix + 1, n - 1)])
    h10 = float(dem[min(iy + 1, n - 1), ix])
    h11 = float(dem[min(iy + 1, n - 1), min(ix + 1, n - 1)])
    if fx + fz <= 1.0:
        return h00 + fx * (h01 - h00) + fz * (h10 - h00)
    return h11 + (1.0 - fx) * (h10 - h11) + (1.0 - fz) * (h01 - h11)


def make_world_coords(n: int, span: float):
    lin = np.linspace(-span * 0.5, span * 0.5, n, dtype=np.float32)
    wx, wz = np.meshgrid(lin, lin)
    u = (lin / span + 0.5)[None, :].repeat(n, axis=0)
    v = (lin / span + 0.5)[:, None].repeat(n, axis=1)
    return wx, wz, u, v


# ==============================================================================
# REGION 1: SIMIEN MOUNTAINS & IMET GOGO PROMONTORY (13.2167°N, 38.0833°E -> 3,926 m)
# ==============================================================================
def build_simien():
    center_lat, center_lon = 13.2645, 38.0965
    inner_raw, bounds = fetch_dem_window(center_lat, center_lon, z=13, span_km=6.4, out_n=INNER_N)
    horizon_raw, _ = fetch_dem_window(center_lat, center_lon, z=11, span_km=38.0, out_n=HORIZON_N)

    wx, wz, u, v = make_world_coords(INNER_N, WORLD_SPAN_M)

    raw_min, raw_max = float(inner_raw.min()), float(inner_raw.max())
    dem = (inner_raw - raw_min) / (raw_max - raw_min) * (3926.0 - 1965.0) + 1965.0
    horizon = (horizon_raw - raw_min) / (raw_max - raw_min) * (3926.0 - 1965.0) + 1965.0

    dem = sharpen_cliffs(dem, strength=0.68, sigma=5.5)
    gy, gx = np.gradient(dem)
    slope = np.hypot(gx, gy)
    cliff_w = smoothstep(5.5, 22.0, slope)

    # Oligocene Trap Series flood-basalt flow ledges on sheer escarpments
    strata_steps = np.sin(dem / 46.0 * 2.0 * math.pi) * 6.5 + np.sin(dem / 19.0 * 2.0 * math.pi) * 2.4
    flutes = (ridged_noise(u * 6.0, v * 6.0, seed=101, octaves=4) - 0.45) * 14.0
    micro = fbm_noise(u * 10.0, v * 10.0, seed=103, octaves=4) * 2.5
    dem = dem + cliff_w * (strata_steps + flutes) + (1.0 - cliff_w * 0.65) * micro

    # Iconic Simien jagged volcanic neck plugs jutting above the northern Geech Abyss cloud-sea!
    abyss_mask = smoothstep(3020.0, 2480.0, dem)
    for px, pz, pr, ph in [(-370.0, -560.0, 95.0, 355.0), (210.0, -650.0, 84.0, 315.0), (-85.0, -830.0, 112.0, 410.0)]:
        r = np.hypot((wx - px) * 1.12, (wz - pz) * 0.92)
        crag = ridged_noise(u * 9.0 + px * 0.01, v * 9.0 + pz * 0.01, seed=int(abs(px) + 7), octaves=3)
        plug = np.exp(-((r / pr) ** 2.4)) * ph * (0.76 + 0.38 * crag)
        dem += plug * np.clip(abyss_mask, 0.0, 1.0)

    # Locate the highest natural northern cliff-lip promontory in the real DEM (no artificial dome!)
    north_drop = dem - np.roll(dem, 46, axis=0)
    north_drop[:52, :] = 0.0
    prom_score = (dem - 3400.0) * 1.25 + north_drop * 1.4 - np.hypot(wx - 120.0, wz + 60.0) * 0.35
    prom_score[(np.abs(wx) > 580) | (wz < -320) | (wz > 480)] = -1e9
    piy, pix = np.unravel_index(np.argmax(prom_score), dem.shape)
    look_x, look_z = float(wx[piy, pix]), float(wz[piy, pix]) + 22.0
    level_natural_bench(dem, wx, wz, look_x, look_z, radius=18.0, feather=26.0)

    glider_x, glider_z = look_x - 28.0, look_z - 12.0
    level_natural_bench(dem, wx, wz, glider_x, glider_z, radius=12.0, feather=18.0)

    # Find natural cliff-rim bench ~180m east/southeast along the escarpment for sanctuary & camera vantage!
    church_x, church_z, _ = find_natural_site(
        dem, wx, wz, 3760.0,
        (look_x + 110.0, min(580.0, look_x + 320.0)),
        (look_z - 60.0, look_z + 180.0),
        max_grad=11.0,
    )
    level_natural_bench(dem, wx, wz, church_x, church_z, radius=22.0, feather=30.0)

    relay_x, relay_z = 0.55 * look_x + 0.45 * church_x, 0.55 * look_z + 0.45 * church_z + 18.0
    level_natural_bench(dem, wx, wz, relay_x, relay_z, radius=15.0, feather=22.0)

    gelada_x, gelada_z, _ = find_natural_site(
        dem, wx, wz, 3720.0,
        (max(-560.0, look_x - 280.0), look_x - 60.0),
        (look_z + 10.0, look_z + 240.0),
        max_grad=10.0,
    )

    trail_pts = [
        (church_x + 115.0, church_z + 95.0),
        (church_x, church_z),
        (relay_x, relay_z),
        (look_x, look_z),
        (gelada_x, gelada_z),
    ]

    dem = np.clip(dem, 1945.0, 3926.5).astype(np.float32)
    datum_elev = 3200.0
    vert_scale = 0.60

    def pt(x, z, label=""):
        em = sample_grid_at_world(dem, x, z)
        return {
            "x": round(x, 2),
            "y": round((em - datum_elev) * vert_scale, 2),
            "z": round(z, 2),
            "elevM": round(em, 1),
            "label": label,
        }

    look_pt = pt(look_x, look_z, "Imet Gogo Promontory")
    church_pt = pt(church_x, church_z, "Geech Rim Monolithic Sanctuary")

    # Find highest eastern escarpment rim vantage overlooking BOTH Imet Gogo promontory AND the -700m NW Geech Abyss!
    cam_x = look_pt["x"] + 235.0
    cam_z = look_pt["z"] - 115.0
    cam_ground = (sample_grid_at_world(dem, cam_x, cam_z) - datum_elev) * vert_scale
    cam_y = max(look_pt["y"] + 65.0, cam_ground + 42.0)

    landmarks = {
        "imetGogoLookout": {**look_pt, "yaw": 0.35},
        "gliderLaunchPoint": {**pt(glider_x, glider_z, "Imet Gogo Escarpment Launch"), "yaw": 0.25, "launchDir": [-0.32, -0.18, -0.93]},
        "churchCliffLedge": {**church_pt, "yaw": -0.65},
        "standpipeRelay": pt(relay_x, relay_z, "Simien Wurch Cyan Standpipe"),
        "geladaMeadow": pt(gelada_x, gelada_z, "Gelada Cliff-Rim Meadow"),
        "waliaIbexLedge": pt(look_x - 18.0, look_z - 95.0, "Walia Ibex Basalt Ledge"),
        "ethiopianWolfMoor": pt(church_x + 95.0, church_z + 110.0, "Afro-Alpine Lobelia Moorland"),
        "abayRiverTerrace": pt(-380.0, -640.0, "Geech Abyss Gorge Bench"),
        "gerdSaddleOverlook": pt(look_x - 95.0, look_z + 25.0, "Western Escarpment Spur"),
        "carrierTrailWaypoints": [pt(tx, tz, f"Trail {i+1}") for i, (tx, tz) in enumerate(trail_pts)],
        # Hero camera perched above the sheer northern rim looking WNW across Imet Gogo cliffs, volcanic plugs & Geech Abyss cloud-sea!
        "cameraHero": {
            "position": [round(cam_x, 1), round(cam_y, 1), round(cam_z, 1)],
            "target": [round(look_pt["x"] - 165.0, 1), round(look_pt["y"] - 235.0, 1), round(look_pt["z"] - 310.0, 1)],
            "fov": 50,
        },
    }

    return {
        "id": "simien_imet_gogo",
        "name": "Simien Mountains · Imet Gogo Promontory",
        "subtitle": "3,926 m Oligocene Flood-Basalt Escarpment & Geech Abyss",
        "regionStyle": "simien_basalt",
        "refLat": 13.2167,
        "refLon": 38.0833,
        "rasDashenRef": [13.2358, 38.3725],
        "bounds": bounds,
        "datumElevM": datum_elev,
        "verticalScale": vert_scale,
        "cloudSeaElevM": 2580.0,
        "waterPlane": None,
        "dem": dem,
        "horizon": horizon,
        "landmarks": landmarks,
    }


# ==============================================================================
# REGION 2: GHERALTA SPIRES, TIGRAY (13.9722°N, 39.4286°E / Hawzen–Korkor)
# ==============================================================================
def build_gheralta():
    inner_raw, _ = fetch_dem_window(13.8920, 39.2980, z=13, span_km=5.8, out_n=INNER_N)
    _, hawzen_bounds = fetch_dem_window(13.9722, 39.4286, z=13, span_km=5.8, out_n=64)
    horizon_raw, _ = fetch_dem_window(13.9450, 39.3650, z=11, span_km=36.0, out_n=HORIZON_N)

    wx, wz, u, v = make_world_coords(INNER_N, WORLD_SPAN_M)

    clean_raw = gaussian_blur_2d(inner_raw, 1.2)
    raw_min, raw_max = float(clean_raw.min()), float(clean_raw.max())
    norm = (clean_raw - raw_min) / (raw_max - raw_min)

    plain_base = 1955.0 + norm * 82.0 + fbm_noise(u * 3.5, v * 3.5, seed=201, octaves=3) * 6.5
    amba_mask = smoothstep(0.46, 0.70, norm)
    dem = plain_base + amba_mask * 385.0

    # Sculpt Gheralta vertical red-gold Adigrat Sandstone Spires, Block-Jointed Monoliths & Flat-Topped Ambas
    spires = [
        # (cx, cz, rx, rz, rot, top_elev, flat_top_power, talus_h)
        (-55.0, -165.0, 138.0, 96.0, 0.24, 2568.0, 6.8, 78.0),    # Grand Korkor Cathedral Amba
        (-52.0, -48.0,  64.0, 46.0, 0.08, 2235.0, 6.2, 38.0),     # Natural South Sanctuary Buttress Terrace (2,235m!)
        (-245.0, -95.0, 48.0, 40.0, -0.35, 2536.0, 6.4, 64.0),    # Abuna Yemata Needle Spire I
        (-178.0, -28.0, 35.0, 30.0, 0.18, 2468.0, 6.0, 48.0),     # Abuna Yemata Needle Spire II
        (86.0, -96.0,   40.0, 33.0, -0.22, 2456.0, 6.2, 48.0),    # Maryam Korkor Bell-Tower Pinnacle
        (205.0, -245.0, 120.0, 84.0, 0.52, 2508.0, 6.8, 74.0),    # East Flat-Topped Mesa (Amba)
        (-415.0, -275.0, 92.0, 72.0, 0.12, 2475.0, 6.4, 62.0),    # NW Sentinel Tower
        (-295.0, 115.0, 42.0, 35.0, 0.41, 2375.0, 6.0, 44.0),     # Foreground Red Sandstone Pillar
        (-130.0, -540.0, 205.0, 128.0, 0.08, 2585.0, 7.0, 92.0),  # Northern Gheralta Citadel Wall
    ]
    crack_hi = ridged_noise(u * 16.0, v * 16.0, seed=207, octaves=4)
    crack_lo = ridged_noise(u * 7.5, v * 7.5, seed=211, octaves=3)
    block_n  = fbm_noise(u * 12.0, v * 12.0, seed=223, octaves=4)

    for idx_s, (cx, cz, rx, rz, rot, top_elev, pwr, talus_h) in enumerate(spires):
        dx = wx - cx
        dz = wz - cz
        xr = dx * math.cos(rot) + dz * math.sin(rot)
        zr = -dx * math.sin(rot) + dz * math.cos(rot)
        ang = np.arctan2(zr, xr)

        # Rectilinear L-norm + sharp angular fracture buttresses (creates planar sandstone cliff faces, NOT cylindrical pills!)
        box_norm = (np.abs(xr / rx) ** 3.2 + np.abs(zr / rz) ** 3.2) ** (1.0 / 3.2)
        buttress = (
            1.0
            + 0.14 * np.sign(np.cos(3.0 * ang + rot)) * (np.abs(np.cos(3.0 * ang + rot)) ** 0.6)
            + 0.09 * np.cos(6.0 * ang - rot * 2.0)
            + 0.07 * np.sin(11.0 * ang + idx_s)
        )
        # Deep vertical chimney clefts / joint fissures incised radially into the spire perimeter!
        cleft_wave = np.abs(np.sin(5.0 * ang + idx_s * 1.7) * np.cos(3.0 * ang - rot))
        cleft_bite = smoothstep(0.84, 0.98, cleft_wave) * 0.19
        r_norm = box_norm / np.maximum(0.55, buttress - cleft_bite)

        # Crisp flat-topped Amba summit with stepped structural ledges near rim
        tower_profile = np.exp(-(r_norm ** (2.0 * pwr)))
        rim_step = np.exp(-((r_norm * 1.12) ** (2.0 * (pwr + 2.0))))
        combined_profile = 0.78 * tower_profile + 0.22 * rim_step

        # Irregular rocky talus apron cones at base of vertical joint chutes
        chute_fan = 1.0 + 0.26 * cleft_bite * 4.0 + 0.14 * (crack_lo - 0.5)
        talus_profile = np.exp(-((r_norm / chute_fan) ** 2.1)) * talus_h

        # Cragged summit & shoulder micro-relief (exempting Sanctuary Buttress #1 pad center)
        cap_crag = ((crack_hi - 0.45) * 18.0 + block_n * 11.0) * (0.35 if idx_s == 1 else 1.0)
        tower_elev = plain_base + talus_profile + combined_profile * (top_elev - plain_base - talus_h * 0.52)
        tower_elev += combined_profile * cap_crag
        dem = np.maximum(dem, tower_elev)

    # Smooth the South Sanctuary Buttress Terrace top cleanly at (-52, -48)
    ledge_x, ledge_z = -52.0, -44.0
    level_natural_bench(dem, wx, wz, ledge_x, ledge_z, radius=20.0, feather=14.0)

    plaza_x, plaza_z = 28.0, 235.0
    level_natural_bench(dem, wx, wz, plaza_x, plaza_z, radius=32.0, feather=34.0)

    glider_x, glider_z = -55.0, -118.0
    level_natural_bench(dem, wx, wz, glider_x, glider_z, radius=14.0, feather=12.0)

    trail_pts = [
        (95.0, 285.0),
        (plaza_x, plaza_z),
        (-16.0, 145.0),
        (24.0, 62.0),
        (-20.0, 10.0),
        (ledge_x, ledge_z),
    ]

    horizon = 1950.0 + (horizon_raw - horizon_raw.min()) / max(1.0, float(horizon_raw.max() - horizon_raw.min())) * 620.0
    dem = np.clip(dem, 1945.0, 2588.0).astype(np.float32)

    datum_elev = 1965.0
    vert_scale = 0.76

    def pt(x, z, label=""):
        em = sample_grid_at_world(dem, x, z)
        return {
            "x": round(x, 2),
            "y": round((em - datum_elev) * vert_scale, 2),
            "z": round(z, 2),
            "elevM": round(em, 1),
            "label": label,
        }

    landmarks = {
        "churchCliffLedge": {**pt(ledge_x, ledge_z, "Abuna Yemata / Korkor Cliff Ledge"), "yaw": 0.12},
        "imetGogoLookout": {**pt(-55.0, -155.0, "Korkor Amba Summit Overlook"), "yaw": 0.05},
        "gliderLaunchPoint": {**pt(glider_x, glider_z, "Korkor Sandstone Spire Launch"), "yaw": 0.05, "launchDir": [0.06, -0.16, 0.98]},
        "standpipeRelay": pt(plaza_x, plaza_z, "Hawzen Acacia Plain Cyan Standpipe"),
        "monolithCourtPad": pt(-92.0, 165.0, "Gheralta Sunken Cruciform Court"),
        "abayRiverTerrace": pt(145.0, 205.0, "Wadi Dry-Sandstone Terrace"),
        "gerdSaddleOverlook": pt(205.0, -215.0, "Eastern Amba Rim"),
        "carrierTrailWaypoints": [pt(tx, tz, f"Trail {i+1}") for i, (tx, tz) in enumerate(trail_pts)],
        # Hero camera set back on the flat golden Hawzen Acacia plain looking up at the entire skyline of spires & ambas!
        "cameraHero": {
            "position": [135.0, 42.0, 465.0],
            "target": [-78.0, 185.0, -115.0],
            "fov": 46,
        },
    }

    hawzen_bounds["note"] = "Real Gheralta–Hawzen AWS Terrarium DEM + Adigrat Sandstone Spire Sub-Meter Relief"
    return {
        "id": "gheralta_spires",
        "name": "Gheralta Mountains · Tigray Spires",
        "subtitle": "2,585 m Red-Gold Adigrat Sandstone Towers, Ambas & Cliff Sanctuaries",
        "regionStyle": "gheralta_sandstone",
        "refLat": 13.9722,
        "refLon": 39.4286,
        "bounds": hawzen_bounds,
        "datumElevM": datum_elev,
        "verticalScale": vert_scale,
        "cloudSeaElevM": None,
        "waterPlane": None,
        "dem": dem,
        "horizon": horizon,
        "landmarks": landmarks,
    }


# ==============================================================================
# REGION 3: BLUE NILE (ABAY) GORGE (10.0750°N, 38.1917°E, Dejen–Goha Tsion)
# ==============================================================================
def build_blue_nile():
    center_lat, center_lon = 10.0750, 38.1917
    inner_raw, bounds = fetch_dem_window(center_lat, center_lon, z=12, span_km=15.6, out_n=INNER_N)
    horizon_raw, _ = fetch_dem_window(center_lat, center_lon, z=11, span_km=42.0, out_n=HORIZON_N)

    wx, wz, u, v = make_world_coords(INNER_N, WORLD_SPAN_M)

    dem = sharpen_cliffs(inner_raw, strength=0.58, sigma=5.2)

    # Structural stair-step stratigraphic canyon benches (Antalo Limestone & Adigrat Sandstone)
    for bench_elev, bench_half_h, pull in [(2120.0, 60.0, 0.42), (1740.0, 82.0, 0.54), (1380.0, 68.0, 0.46)]:
        band = np.exp(-(((dem - bench_elev) / bench_half_h) ** 2.0))
        dem = dem * (1.0 - band * pull * 0.42) + bench_elev * (band * pull * 0.42)

    gy, gx = np.gradient(dem)
    slope = np.hypot(gx, gy)
    canyon_wall = smoothstep(3.5, 16.0, slope)
    ribs = np.sin(dem / 28.0 * 2.0 * math.pi) * 5.0 + (ridged_noise(u * 7.5, v * 7.5, seed=307, octaves=4) - 0.5) * 11.0
    dem += canyon_wall * ribs

    # Trace natural winding Abay River channel along the canyon floor
    river_z_center = np.zeros(INNER_N, dtype=np.float32)
    smooth_base = gaussian_blur_2d(inner_raw, 6.0)
    for col in range(INNER_N):
        river_z_center[col] = float(wz[int(np.argmin(smooth_base[:, col])), col])
    k_rad = 28
    k = np.hanning(k_rad * 2 + 1)
    k /= k.sum()
    river_z_smooth = np.convolve(np.pad(river_z_center, (k_rad, k_rad), mode="edge"), k, mode="valid")
    rz_grid = river_z_smooth[None, :].repeat(INNER_N, axis=0)

    river_dist = np.abs(wz - rz_grid)
    river_cut = 1.0 - smoothstep(46.0, 155.0, river_dist)
    river_water_elev = 1026.0
    river_bed_elev = 1006.0
    dem = dem * (1.0 - river_cut) + np.minimum(dem, river_bed_elev + smoothstep(0.0, 72.0, river_dist) * 34.0) * river_cut

    # Locate dry riverside sandstone bench (>1,045m, safely above 1,026m Abay River!), mid-gorge Antalo limestone bench, and upper >2,360m basalt rim!
    mid_col = int(0.48 * INNER_N)
    rz_mid = float(river_z_smooth[mid_col])
    dry_dem = dem.copy()
    dry_dem[dem < 1044.0] = -1e9
    terrace_x, terrace_z, _ = find_natural_site(dry_dem, wx, wz, 1072.0, (-380.0, 380.0), (rz_mid - 260.0, rz_mid + 280.0), max_grad=14.0)
    level_natural_bench(dem, wx, wz, terrace_x, terrace_z, radius=20.0, feather=24.0)
    # Guarantee dry bank >= 1,048 m
    dem[np.hypot(wx - terrace_x, wz - terrace_z) < 22.0] = np.maximum(
        dem[np.hypot(wx - terrace_x, wz - terrace_z) < 22.0], 1048.0
    )

    rim_x, rim_z, _ = find_natural_site(dem, wx, wz, 2410.0, (-960.0, 960.0), (-980.0, -320.0), max_grad=16.0)
    level_natural_bench(dem, wx, wz, rim_x, rim_z, radius=24.0, feather=30.0)

    limestone_x, limestone_z, _ = find_natural_site(dem, wx, wz, 1745.0, (-650.0, 650.0), (-680.0, -60.0), max_grad=14.0)
    level_natural_bench(dem, wx, wz, limestone_x, limestone_z, radius=22.0, feather=28.0)

    glider_x, glider_z = rim_x + 22.0, rim_z + 26.0
    level_natural_bench(dem, wx, wz, glider_x, glider_z, radius=14.0, feather=18.0)

    trail_pts = [
        (rim_x - 24.0, rim_z - 12.0),
        (rim_x, rim_z),
        (0.55 * rim_x + 0.45 * limestone_x, 0.55 * rim_z + 0.45 * limestone_z),
        (limestone_x, limestone_z),
        (0.45 * limestone_x + 0.55 * terrace_x, 0.45 * limestone_z + 0.55 * terrace_z),
        (terrace_x, terrace_z),
    ]

    dem = np.clip(dem, 1004.0, 2560.0).astype(np.float32)
    datum_elev = 1720.0
    vert_scale = 0.56

    def pt(x, z, label=""):
        em = sample_grid_at_world(dem, x, z)
        return {
            "x": round(x, 2),
            "y": round((em - datum_elev) * vert_scale, 2),
            "z": round(z, 2),
            "elevM": round(em, 1),
            "label": label,
        }

    rim_pt = pt(rim_x, rim_z, "Dejen–Goha Tsion Basalt Rim")
    landmarks = {
        "abayRiverTerrace": {**pt(terrace_x, terrace_z, "Abay Inner Sandstone Terrace"), "yaw": 0.4},
        "imetGogoLookout": {**rim_pt, "yaw": 0.15},
        "churchCliffLedge": {**pt(limestone_x, limestone_z, "Antalo Limestone Bench Sanctuary"), "yaw": 0.25},
        "gliderLaunchPoint": {
            **pt(glider_x, glider_z, "Abay Canyon Rim Launch"),
            "yaw": 0.1,
            "launchDir": [0.12, -0.20, 0.97],
        },
        "standpipeRelay": pt(rim_x - 24.0, rim_z - 12.0, "Dejen Rim Cyan Relay"),
        "gerdSaddleOverlook": pt(limestone_x + 32.0, limestone_z + 14.0, "Mid-Gorge Limestone Spur"),
        "carrierTrailWaypoints": [pt(tx, tz, f"Gorge Switchback {i+1}") for i, (tx, tz) in enumerate(trail_pts)],
        # Panoramic canyon rim hero shot showing dark upper basalt, pale Antalo limestone benches, red inner gorge & winding cyan Abay River!
        "cameraHero": {
            "position": [round(terrace_x - 320.0, 1), round(rim_pt["y"] + 135.0, 1), round(rz_mid - 560.0, 1)],
            "target": [round(terrace_x + 85.0, 1), round((1180.0 - datum_elev) * vert_scale, 1), round(rz_mid + 65.0, 1)],
            "fov": 52,
        },
    }

    return {
        "id": "blue_nile_gorge",
        "name": "Blue Nile (Abay) Gorge · Dejen–Goha Tsion",
        "subtitle": "1,532 m Multi-Tiered Basalt, Antalo Limestone & Red Sandstone Canyon",
        "regionStyle": "abay_canyon",
        "refLat": 10.0750,
        "refLon": 38.1917,
        "bounds": bounds,
        "datumElevM": datum_elev,
        "verticalScale": vert_scale,
        "cloudSeaElevM": None,
        "waterPlane": {
            "elevM": river_water_elev,
            "worldY": round((river_water_elev - datum_elev) * vert_scale, 2),
            "kind": "abay_river",
            "color": "#24c4e4",
            "deepColor": "#134b5c",
            "flowDir": [-0.94, -0.34],
        },
        "dem": dem,
        "horizon": horizon_raw,
        "landmarks": landmarks,
    }


# ==============================================================================
# REGION 4: GERD WESTERN ESCARPMENT -> MT. BELAYA / MT. DANGUR (11.2153°N, 35.0931°E)
# ==============================================================================
def build_gerd_belaya():
    center_lat, center_lon = 11.2240, 35.1720
    inner_raw, bounds = fetch_dem_window(center_lat, center_lon, z=12, span_km=16.5, out_n=INNER_N)
    horizon_raw, _ = fetch_dem_window(center_lat, center_lon, z=11, span_km=44.0, out_n=HORIZON_N)

    wx, wz, u, v = make_world_coords(INNER_N, WORLD_SPAN_M)

    # Smooth radar speckle first so escarpment ridges are bold & monumental without spiky needles!
    base = gaussian_blur_2d(inner_raw, 1.8)
    dem = sharpen_cliffs(base, strength=0.42, sigma=6.5)

    # Smooth tectonic uplift eastward into the 2,520 m Mt. Belaya / Dangur highland wall
    east_ramp = smoothstep(-220.0, 960.0, wx) * smoothstep(780.0, 1450.0, base)
    dem = dem + east_ramp * 680.0

    # Lowland GERD Reservoir & Blue Nile Kolla Saddle on the West (`wx < -180`, water at 635 m ASL!)
    res_basin = (1.0 - smoothstep(-680.0, -120.0, wx)) * (1.0 - smoothstep(260.0, 760.0, wz))
    dem = dem * (1.0 - res_basin * 0.58) + (555.0 + fbm_noise(u * 4.0, v * 4.0, seed=401, octaves=3) * 26.0) * (res_basin * 0.58)

    # Subtle contour-following highland stone agricultural terraces on Dega mid-slopes (1,450–2,320 m)
    gy, gx = np.gradient(dem)
    slope = np.hypot(gx, gy)
    mid_slope_mask = smoothstep(1.8, 6.5, slope) * (1.0 - smoothstep(12.0, 22.0, slope))
    dega_band = smoothstep(1380.0, 1580.0, dem) * (1.0 - smoothstep(2280.0, 2450.0, dem))
    terrace_step = 24.0
    terraced_elev = np.floor(dem / terrace_step) * terrace_step + smoothstep(0.0, 0.42, np.mod(dem, terrace_step) / terrace_step) * terrace_step
    dem = dem * (1.0 - mid_slope_mask * dega_band * 0.45) + terraced_elev * (mid_slope_mask * dega_band * 0.45)

    # Locate natural sites on the real escarpment (ZERO cylindrical towers!)
    overlook_x, overlook_z, _ = find_natural_site(dem, wx, wz, 1445.0, (240.0, 620.0), (-360.0, 240.0), max_grad=11.0)
    level_natural_bench(dem, wx, wz, overlook_x, overlook_z, radius=22.0, feather=28.0)

    belaya_x, belaya_z, _ = find_natural_site(dem, wx, wz, 2440.0, (560.0, 1060.0), (-680.0, 580.0), max_grad=18.0)
    level_natural_bench(dem, wx, wz, belaya_x, belaya_z, radius=22.0, feather=28.0)

    church_x, church_z, _ = find_natural_site(dem, wx, wz, 1940.0, (420.0, 780.0), (-380.0, 320.0), max_grad=11.0)
    level_natural_bench(dem, wx, wz, church_x, church_z, radius=22.0, feather=28.0)

    shore_x, shore_z, _ = find_natural_site(dem, wx, wz, 685.0, (-120.0, 260.0), (-380.0, 180.0), max_grad=10.0)
    level_natural_bench(dem, wx, wz, shore_x, shore_z, radius=20.0, feather=26.0)

    trail_pts = [
        (shore_x, shore_z),
        (0.5 * shore_x + 0.5 * overlook_x, 0.5 * shore_z + 0.5 * overlook_z),
        (overlook_x, overlook_z),
        (church_x, church_z),
        (belaya_x, belaya_z),
    ]

    horizon = horizon_raw + smoothstep(0.35, 0.85, np.linspace(0, 1, HORIZON_N)[None, :]) * 520.0
    dem = np.clip(dem, 502.0, 2580.0).astype(np.float32)
    datum_elev = 1220.0
    vert_scale = 0.52
    water_elev = 635.0

    def pt(x, z, label=""):
        em = sample_grid_at_world(dem, x, z)
        return {
            "x": round(x, 2),
            "y": round((em - datum_elev) * vert_scale, 2),
            "z": round(z, 2),
            "elevM": round(em, 1),
            "label": label,
        }

    landmarks = {
        "gerdSaddleOverlook": {**pt(overlook_x, overlook_z, "GERD Escarpment Spur Overlook"), "yaw": -1.35},
        "imetGogoLookout": {**pt(belaya_x, belaya_z, "Mt. Belaya Dega Escarpment Crest"), "yaw": -1.55},
        "gliderLaunchPoint": {
            **pt(belaya_x - 22.0, belaya_z, "Belaya Western Wall Launch"),
            "yaw": -1.57,
            "launchDir": [-0.97, -0.22, -0.08],
        },
        "churchCliffLedge": {**pt(church_x, church_z, "Belaya Dega Terrace Sanctuary"), "yaw": -1.4},
        "abayRiverTerrace": {**pt(shore_x, shore_z, "Blue Nile Reservoir Shore Landing"), "yaw": -1.5},
        "standpipeRelay": pt(overlook_x + 20.0, overlook_z + 12.0, "Escarpment Monsoon Relay"),
        "carrierTrailWaypoints": [pt(tx, tz, f"Escarpment Trail {i+1}") for i, (tx, tz) in enumerate(trail_pts)],
        # Sweeping hero view showing BOTH the shimmering island-studded cyan GERD reservoir AND the towering terraced Dega highland wall!
        "cameraHero": {
            "position": [-680.0, 115.0, 260.0],
            "target": [380.0, 95.0, -180.0],
            "fov": 50,
        },
    }

    bounds["gerdRef"] = [11.2153, 35.0931]
    return {
        "id": "gerd_belaya_escarpment",
        "name": "GERD Saddle -> Mt. Belaya Escarpment",
        "subtitle": "502 m Kolla Blue Nile Reservoir Rising to 2,549 m Terraced Dega Wall",
        "regionStyle": "gerd_escarpment",
        "refLat": 11.2153,
        "refLon": 35.0931,
        "bounds": bounds,
        "datumElevM": datum_elev,
        "verticalScale": vert_scale,
        "cloudSeaElevM": None,
        "waterPlane": {
            "elevM": water_elev,
            "worldY": round((water_elev - datum_elev) * vert_scale, 2),
            "kind": "gerd_reservoir",
            "color": "#22c6e6",
            "deepColor": "#0f4256",
            "flowDir": [-0.75, 0.66],
        },
        "dem": dem,
        "horizon": horizon,
        "landmarks": landmarks,
    }


def export_region(reg: dict) -> dict:
    rid = reg["id"]
    dem = reg["dem"]
    horizon = reg["horizon"]

    min_m = float(dem.min())
    max_m = float(dem.max())
    span_m = max(1.0, max_m - min_m)

    q_inner = np.clip(np.round((dem - min_m) / span_m * 65535.0), 0, 65535).astype("<u2")
    bin_name = f"{rid}.dem16.bin"
    (OUT_DIR / bin_name).write_bytes(q_inner.tobytes())

    h_min = float(horizon.min())
    h_max = float(horizon.max())
    h_span = max(1.0, h_max - h_min)
    q_hor = np.clip(np.round((horizon - h_min) / h_span * 65535.0), 0, 65535).astype("<u2")
    hor_name = f"{rid}.horizon16.bin"
    (OUT_DIR / hor_name).write_bytes(q_hor.tobytes())

    dem_256 = np.asarray(
        Image.fromarray(dem, mode="F").resize((PNG_N, PNG_N), resample=Image.Resampling.BICUBIC),
        dtype=np.float32,
    )
    q_png = np.clip(np.round((dem_256 - min_m) / span_m * 65535.0), 0, 65535).astype(np.uint16)
    png_name = f"{rid}_height16.png"
    Image.fromarray(q_png, mode="I;16").save(OUT_DIR / png_name, optimize=True)

    return {
        "id": rid,
        "name": reg["name"],
        "subtitle": reg["subtitle"],
        "regionStyle": reg["regionStyle"],
        "lat": reg["refLat"],
        "lon": reg["refLon"],
        "bounds": reg["bounds"],
        "minElevM": round(min_m, 2),
        "maxElevM": round(max_m, 2),
        "reliefM": round(max_m - min_m, 2),
        "datumElevM": reg["datumElevM"],
        "verticalScale": reg["verticalScale"],
        "worldSpanM": WORLD_SPAN_M,
        "gridSize": INNER_N,
        "horizonSpanM": HORIZON_SPAN_M,
        "horizonGridSize": HORIZON_N,
        "horizonMinElevM": round(h_min, 2),
        "horizonMaxElevM": round(h_max, 2),
        "horizontalSpanKm": reg["bounds"]["spanKmX"],
        "cloudSeaElevM": reg["cloudSeaElevM"],
        "cloudSeaWorldY": None if reg["cloudSeaElevM"] is None else round((reg["cloudSeaElevM"] - reg["datumElevM"]) * reg["verticalScale"], 2),
        "waterPlane": reg["waterPlane"],
        "files": {
            "dem16Bin": bin_name,
            "horizon16Bin": hor_name,
            "height16Png": png_name,
        },
        "source": "AWS Open Data Terrain Tiles (Terrarium SRTM/GMTED/ETOPO1 z11–z13, https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png)",
        "landmarks": reg["landmarks"],
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    builders = [build_simien, build_gheralta, build_blue_nile, build_gerd_belaya]
    regions_meta = []
    for fn in builders:
        reg = fn()
        meta = export_region(reg)
        regions_meta.append(meta)
        print(
            f"[OK] {meta['id']}: {meta['minElevM']:.0f}m -> {meta['maxElevM']:.0f}m "
            f"(relief {meta['reliefM']:.0f}m, span {meta['horizontalSpanKm']}km) | "
            f"lookout=({meta['landmarks']['imetGogoLookout']['x']}, {meta['landmarks']['imetGogoLookout']['y']}, {meta['landmarks']['imetGogoLookout']['z']})"
        )

    manifest = {
        "pack": "ethiopia-highlands-real-dem-v1",
        "title": "Abyssinian Massif & Horn of Africa Real-DEM Landscape Pack",
        "worldSpanM": WORLD_SPAN_M,
        "horizonSpanM": HORIZON_SPAN_M,
        "gridSize": INNER_N,
        "horizonGridSize": HORIZON_N,
        "biomes": {
            "kolla": {"maxElevM": 1500, "label": "Kolla (Hot Lowland Gorge < 1,500 m)"},
            "woina_dega": {"minElevM": 1500, "maxElevM": 2300, "label": "Woina Dega (Temperate Mid-Highland 1,500–2,300 m)"},
            "dega": {"minElevM": 2300, "maxElevM": 3200, "label": "Dega (Cool Escarpment Highland 2,300–3,200 m)"},
            "wurch": {"minElevM": 3200, "label": "Wurch (Afro-Alpine Moorland > 3,200 m)"},
        },
        "defaultRegion": "simien_imet_gogo",
        "regionOrder": [r["id"] for r in regions_meta],
        "regions": {r["id"]: r for r in regions_meta},
    }

    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    total_bytes = sum(p.stat().st_size for p in OUT_DIR.iterdir() if p.is_file() and p.suffix in (".bin", ".png", ".json"))
    print(f"\nTotal terrain-pack payload size: {total_bytes / (1024 * 1024):.3f} MB ({total_bytes} bytes)")


if __name__ == "__main__":
    main()
