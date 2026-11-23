#!/usr/bin/env python3
"""Free the elevation locked inside single-file worlds so the atlas can stream it like any tile.
Writes atlas/data/<id>.bin (uint16 LE, rows north to south, normalized min..max) and atlas/data/terrain.json.
Sources: MONOLITH-3.html (far, near, detail grids: height = (R*256+G)*0.1 + B*0.02 - 120 m above base, rows from z=-north),
night-post/ahiya-real-terrain.js (91 x 91 at 10 m about the Simien pump)."""
import re, json, base64, io, math, pathlib
import numpy as np
from PIL import Image
R = pathlib.Path(__file__).resolve().parent.parent; OUT = R / 'atlas' / 'data'; OUT.mkdir(exist_ok=True)
def write(id_, arr):
    lo, hi = float(arr.min()), float(arr.max()); u = np.round((arr - lo) / max(1e-6, hi - lo) * 65535).astype('<u2'); (OUT / f'{id_}.bin').write_bytes(u.tobytes()); return lo, hi
def bbox_m(lat0, lon0, west, east, south, north):      # metres east / north about an origin -> [S, W, N, E]
    k = 111320 * math.cos(math.radians(lat0)); return [round(lat0 + south / 110574, 6), round(lon0 + west / k, 6), round(lat0 + north / 110574, 6), round(lon0 + east / k, 6)]
tiles = []
s = (R / 'MONOLITH-3.html').read_text(encoding='utf-8')
blob = lambda i: re.search(r'<script type="text/plain" id="%s"[^>]*>(.*?)</script>' % i, s, re.S).group(1).strip()
td = json.loads(blob('terrain-data')); lon0, lat0 = td['origin']; base = td['base']
for key in ['far', 'near', 'detail']:
    im = np.asarray(Image.open(io.BytesIO(base64.b64decode(blob(key + '-height').split(',', 1)[1]))).convert('RGB')).astype(np.float64)
    h = (im[..., 0] * 256 + im[..., 1]) * .1 + im[..., 2] * .02 - 120 + base
    lo, hi = write('teton_' + key, h); w, e, so, no = td[key]['bounds']
    tiles.append({'id': 'teton_' + key, 'title': f'Grand Teton · {key} grid', 'bbox': bbox_m(lat0, lon0, w, e, so, no), 'dem': './data/teton_' + key + '.bin', 'w': im.shape[1], 'h': im.shape[0], 'elev': [round(lo, 1), round(hi, 1)], 'source': 'USGS 3DEP via MONOLITH-3'})
a = (R / 'night-post' / 'ahiya-real-terrain.js').read_text()
n = int(re.search(r'\bn:(\d+)', a).group(1)); x0 = float(re.search(r'x0:(-?[\d.]+)', a).group(1)); z0 = float(re.search(r'z0:(-?[\d.]+)', a).group(1)); step = float(re.search(r'step:([\d.]+)', a).group(1))
hv = json.loads('[' + re.search(r'\bh:\[(.*?)\]', a, re.S).group(1) + ']'); arr = np.array(hv, dtype=np.float64).reshape(n, n)
pump = (13.22461, 38.10454); lo, hi = write('ahiya', arr)
# game metres about the pump at (-1460, 760); z is south. The 10 degree layout rotation is ignored here, so the box is approximate.
tiles.append({'id': 'ahiya', 'title': 'Ahiya · the pump hillside', 'approx': True, 'bbox': bbox_m(pump[0], pump[1], x0 + 1460, x0 + (n - 1) * step + 1460, -(z0 + (n - 1) * step - 760), -(z0 - 760)), 'dem': './data/ahiya.bin', 'w': n, 'h': n, 'elev': [round(lo, 1), round(hi, 1)], 'source': 'Copernicus GLO-30 via night-post'})
json.dump({'tiles': tiles}, open(OUT / 'terrain.json', 'w'), indent=1); print(json.dumps([(t['id'], t['w'], t['h'], t['bbox'], t['elev']) for t in tiles]))
