#!/usr/bin/env python3
"""The archipelago: one invented sea holding the real terrain of every level we have, each at its true scale.
Only the arrangement is fiction. Each island is its level's own elevation grid, lowered into the sea at its edges.
Writes atlas/archipelago.jpg (the painted map) and atlas/archipelago.json (islands, places, roads in map km)."""
import re, json, base64, io, zlib, math, pathlib
import numpy as np
from PIL import Image, ImageFilter
R = pathlib.Path(__file__).resolve().parent.parent
W_KM, H_KM, MPP = 80.0, 68.0, 20.0                       # map size and metres per pixel
PW, PH = int(W_KM * 1000 / MPP), int(H_KM * 1000 / MPP)
rng = np.random.default_rng(7)
def noise(h, w, scale):                                   # smooth fractal noise, 0..1
    out = np.zeros((h, w)); amp = 1; tot = 0
    for o in range(4):
        n = max(2, int(scale * 2 ** o)); small = rng.random((n, n)).astype(np.float32)
        out += amp * np.asarray(Image.fromarray(small).resize((w, h), Image.BICUBIC)); tot += amp; amp *= .5
    out /= tot; return (out - out.min()) / max(1e-6, out.max() - out.min())
def smooth(e): e = np.clip(e, 0, 1); return e * e * (3 - 2 * e)
def islandize(h, fall=.3, depth=None, keep=30.0):        # metres above a local sea; the outline is a warped rounded shape the terrain then carves
    h = h.astype(np.float64); base = np.percentile(h, 3); rel = h - base; H, W = rel.shape
    yy, xx = np.mgrid[0:H, 0:W]; u = (xx / (W - 1)) * 2 - 1; v = (yy / (H - 1)) * 2 - 1
    r = (np.abs(u) ** 3.2 + np.abs(v) ** 3.2) ** (1 / 3.2)                                  # 0 centre, 1 at the tile edge, rounded corners
    rn = r + (noise(H, W, 2) - .5) * .5 + (noise(H, W, 7) - .5) * .12                        # capes and bays
    f = smooth((1 - fall * .35 - rn) / fall); f[r > .985] = 0
    return (rel + keep) * f - (1 - f) * 380
I = []
def island(id_, name, h, km_w, km_h, cx, cy, level, entry, places=(), roads=(), local=None, **kw):
    I.append(dict(id=id_, name=name, h=h, w=km_w, hgt=km_h, cx=cx, cy=cy, level=level, entry=entry, places=list(places), roads=list(roads), local=local, **kw))
# ---------- Grand Teton (MONOLITH-3, zones, Donkey Water west) ----------
s3 = (R / 'MONOLITH-3.html').read_text(encoding='utf-8')
blob = lambda i: re.search(r'<script type="text/plain" id="%s"[^>]*>(.*?)</script>' % i, s3, re.S).group(1).strip()
td = json.loads(blob('terrain-data'))
im = np.asarray(Image.open(io.BytesIO(base64.b64decode(blob('far-height').split(',', 1)[1]))).convert('RGB')).astype(np.float64)
teton = (im[..., 0] * 256 + im[..., 1]) * .1 + im[..., 2] * .02 - 120 + td['base']
tw, te, ts, tn = td['far']['bounds']
tl = lambda x, z: ((x - tw) / (te - tw), (z + tn) / (tn - ts))             # local metres -> 0..1 (row 0 north)
west = {'overlook': (-14.8, .8, 'Overlook Wellhead'), 'switchback': (-40, -157, 'Moraine Switchback'), 'ford': (-236.5, -46.5, 'Silver Ford'), 'oxbow': (-504.5, 106.5, 'Cottonwood Oxbow'), 'plaza': (-772.5, -19.5, 'Highland Pueblo')}
road = [['overlook', 'switchback'], ['switchback', 'ford'], ['ford', 'oxbow'], ['oxbow', 'plaza']]
TETON_FRAME = dict(x0=tw, w=te - tw, z0=-tn, h=tn - ts)
island('teton', 'GRAND TETON', islandize(teton, .2), 24.6, 38.7, 17.5, 30.5, 'MONOLITH-3 · zones · Donkey Water west', '../MONOLITH-3.html',
  places=[dict(name=v[2], uv=tl(v[0], v[1]), world='Donkey Water', entry='../night-post/index.html') for v in west.values()] + [dict(name='Snake River Overlook', uv=tl(-46.3, 1.4), world='MONOLITH-3', entry='../MONOLITH-3.html'), dict(name='Sage Bench', uv=tl(-162, -112), world='zones', entry='../zones/index.html')],
  roads=[dict(kind='trail', uv=[tl(*west[a][:2]), tl(*west[b][:2])]) for a, b in road], note='USGS 3DEP elevation; Jackson Hole and the Teton Range, 24.6 by 38.7 km', frame=TETON_FRAME)
# ---------- Half Dome (MONOLITH-3 ridge) ----------
hs = json.loads(blob('half-survey')); raw = zlib.decompress(base64.b64decode(hs['data']))
u = np.frombuffer(raw, dtype='<u2').reshape(hs['size'], hs['size']).astype(np.float64)
half = hs['meters'] * (hs['low'] + hs['range'] * u / 65535) + hs['datum'];
same = np.abs(np.diff(u, axis=0)).mean(axis=1) < 10; top = int(np.argmax(~same)) if same[0] else 0   # the survey's first rows are its edge extruded; drop them
half = half[top:]; hsz = hs['span'] * hs['meters'] / 2; hc = hs['center'] * hs['meters']
hl = lambda x, z: ((x + hsz) / (2 * hsz), ((z + (-hc + hsz)) / (2 * hsz) * hs['size'] - top) / (hs['size'] - top))
island('halfdome', 'HALF DOME', islandize(half, .3), 18, 18 * half.shape[0] / hs['size'], 40, 11.5, 'MONOLITH · field plates', '../MONOLITH.html',
  places=[dict(name='Granite Notch', uv=hl(75, 8), world='MONOLITH-3', entry='../MONOLITH-3.html'), dict(name='East Granite Apron', uv=hl(220, -45), world='MONOLITH-3', entry='../MONOLITH-3.html'), dict(name='Ridge Observatory', uv=hl(75, -88), world='MONOLITH-3', entry='../MONOLITH-3.html')],
  note='Yosemite survey, 18 by 18 km')
# ---------- Highland Exposure corridor ----------
he = json.loads(re.search(r'<script type="application/json" id="terrain-src">(.*?)</script>', (R / 'highland-exposure' / 'index.html').read_text(encoding='utf-8'), re.S).group(1))
hn = he['n']; hev = np.frombuffer(base64.b64decode(he['data']), dtype='<u2').reshape(hn, hn).astype(np.float64) * .1
hev = hev[::-1]                                           # rows run with z; Ras Dashen (+z) is north, so flip to put north up
hel = lambda x, z: ((x - he['minX']) / he['size'], 1 - (z - he['minZ']) / he['size'])
island('corridor', 'ENTOTO–SIMIEN CORRIDOR', islandize(hev, .26), 14, 14, 37.5, 31, 'Highland Exposure · Scion Demiurge (40:1 corridor)', '../highland-exposure/index.html',
  places=[dict(name=a['name'], uv=hel(a['x'], a['z']), world='Highland Exposure', entry='../highland-exposure/index.html') for a in he['anchors']],
  roads=[dict(kind='river', uv=[hel(p['x'], p['z']) for p in hy['points']]) for hy in he['hydro']] + [dict(kind='highway', uv=[hel(a['x'], a['z']) for a in he['anchors']])],
  note='Copernicus WorldDEM-30, compressed about 40:1 along the corridor')
# ---------- Ethiopia tiles, with Ahiya at its true place below Simien ----------
m = json.load(open(R / 'ethiopia-highlands' / 'terrain-pack' / 'manifest.json'))
spots = {'simien_imet_gogo': (58, 11), 'gheralta_spires': (68.5, 17.5), 'blue_nile_gorge': (54, 31), 'gerd_belaya_escarpment': (34, 52)}
names = {'simien_imet_gogo': 'SIMIEN', 'gheralta_spires': 'GHERALTA', 'blue_nile_gorge': 'BLUE NILE GORGE', 'gerd_belaya_escarpment': 'BELAYA ESCARPMENT'}
for rid, (cx, cy) in spots.items():
    r = m['regions'][rid]; b = r['bounds']; n = r['gridSize']; span = r['worldSpanM']
    raw = np.frombuffer((R / 'ethiopia-highlands' / 'terrain-pack' / r['files']['dem16Bin']).read_bytes(), dtype='<u2').reshape(n, n).astype(np.float64)
    dem = r['minElevM'] + raw / 65535 * (r['maxElevM'] - r['minElevM'])
    el = lambda x, z: (x / span + .5, z / span + .5)
    pl, rd = [], []
    for k, l in r['landmarks'].items():
        if isinstance(l, dict) and 'x' in l: pl.append(dict(name=l.get('label', k), uv=el(l['x'], l['z']), world='Ethiopia Highlands', entry='../ethiopia-highlands/index.html?region=' + rid))
        elif isinstance(l, list): rd.append(dict(kind='trail', uv=[el(p['x'], p['z']) for p in l if isinstance(p, dict)]))
    island(rid, names[rid], islandize(dem, .32), b['spanKmX'], b['spanKmY'], cx, cy, 'Ethiopia Highlands', '../ethiopia-highlands/index.html?region=' + rid, places=pl, roads=rd,
           note=f"real elevation {r['minElevM']:.0f} to {r['maxElevM']:.0f} m, {b['spanKmX']} by {b['spanKmY']} km", bbox=[b['latSouth'], b['lonWest'], b['latNorth'], b['lonEast']])
a = (R / 'night-post' / 'ahiya-real-terrain.js').read_text(); an = int(re.search(r'\bn:(\d+)', a).group(1))
ah = np.array(json.loads('[' + re.search(r'\bh:\[(.*?)\]', a, re.S).group(1) + ']'), dtype=np.float64).reshape(an, an) + 3397.3
x0 = float(re.search(r'x0:(-?[\d.]+)', a).group(1)); z0 = float(re.search(r'z0:(-?[\d.]+)', a).group(1)); st = float(re.search(r'step:([\d.]+)', a).group(1)); ext = (an - 1) * st
sim = I[[i['id'] for i in I].index('simien_imet_gogo')]; sb = sim['bbox']; pump = (13.22461, 38.10454)
kx = 111.32 * math.cos(math.radians(pump[0])); px_km = (pump[1] - sb[1]) * kx - sim['w'] / 2; py_km = (sb[2] - pump[0]) * 110.574 - sim['hgt'] / 2   # pump relative to the Simien centre, km
gx = (x0 + 1460) / 1000; gz = (z0 - 760) / 1000                                                    # Ahiya grid corner relative to the pump, km (z south)
acx = sim['cx'] + px_km + gx + ext / 2000; acy = sim['cy'] + py_km + gz + ext / 2000
al = lambda x, z: ((x - x0) / ext, (z - z0) / ext)
stops = {'Basalt Pump': (-1460, 760), 'Cross-Beacon Watch': (-1610, 590), 'Hill Archive': (-1765, 540), 'Daylight Compound': (-1680, 775)}
ring = ['Basalt Pump', 'Cross-Beacon Watch', 'Hill Archive', 'Daylight Compound', 'Basalt Pump']
island('ahiya', 'AHIYA', islandize(ah, .3, depth=140, keep=20), ext / 1000, ext / 1000, acx, acy, 'Donkey Water · Ahiya circuit', '../night-post/index.html?circuit=ahiya&demo=ahiya',
  places=[dict(name=k, uv=al(*v), world='Donkey Water', entry='../night-post/index.html?circuit=ahiya&demo=ahiya') for k, v in stops.items()],
  roads=[dict(kind='trail', uv=[al(*stops[ring[i]]), al(*stops[ring[i + 1]])]) for i in range(4)], note='Copernicus GLO-30, 0.9 km at the Basalt Pump; at its true place 1 km below Simien', small=True, frame=dict(x0=x0, w=ext, z0=z0, h=ext))
# ---------- WYGWYL island (city suite) ----------
hg = json.load(open(R / 'city' / 'island' / 'data' / 'height_grid.json')); city = np.array(hg['data'], dtype=np.float64).reshape(hg['ny'], hg['nx']) / 10
meta = json.load(open(R / 'city' / 'island' / 'data' / 'meta.json')); roads = json.load(open(R / 'city' / 'island' / 'data' / 'roads.json'))
cl = lambda x, y: (x / hg['W'], y / hg['H'])
crd = [dict(kind='highway', uv=[cl(*p) for p in h['pts']]) for h in roads['highways']] + [dict(kind='rail', uv=[cl(*p) for p in r_['pts']]) for r_ in roads['rails'] if 'pts' in r_] + [dict(kind='river', uv=[cl(*p) for p in r_['pts']]) for r_ in roads['rivers'] if 'pts' in r_]
streets = [[cl(*p) for p in s_['pts']] for s_ in roads['streets'][:2500] if 'pts' in s_]
island('wygwyl', 'WYGWYL', np.minimum(np.where(city > 0, city + 6, city - 30), islandize(np.maximum(city, 0), .22)), hg['W'] / 1000, hg['H'] / 1000, 52, 48.5, 'City suite · Atlantis · Nolli block', '../city/island/index.html',
  places=[dict(name=g['name'], uv=cl(g['x'], g['y']), world='WYGWYL island', entry='../city/island/index.html') for g in meta['regions']], roads=crd, streets=streets, note='six real places rotated into one island, 9.6 by 6.4 km')
# ---------- arrange: a tight archipelago; where a bridge crosses, the strait is a few hundred metres ----------
from scipy.spatial import cKDTree
PAIRS = [('teton', 'corridor'), ('teton', 'gerd_belaya_escarpment'), ('corridor', 'halfdome'), ('corridor', 'blue_nile_gorge'), ('halfdome', 'simien_imet_gogo'),   # one chain that joins every island
         ('simien_imet_gogo', 'gheralta_spires'), ('simien_imet_gogo', 'ahiya'), ('blue_nile_gorge', 'wygwyl')]
GAP, CLEAR, MARGIN = 420.0, 1400.0, 3000.0
for i in I:
    pw, ph = max(2, int(i['w'] * 1000 / MPP)), max(2, int(i['hgt'] * 1000 / MPP))
    a_ = np.asarray(Image.fromarray(i['h'].astype(np.float32)).resize((pw, ph), Image.BILINEAR), dtype=np.float64); i['ras'] = a_
    m_ = a_ > 2; e_ = m_ & ~(np.roll(m_, 1, 0) & np.roll(m_, -1, 0) & np.roll(m_, 1, 1) & np.roll(m_, -1, 1)); e_[0, :] = e_[-1, :] = e_[:, 0] = e_[:, -1] = False
    ys_, xs_ = np.nonzero(e_); pts = np.stack([xs_ * MPP - pw * MPP / 2, ys_ * MPP - ph * MPP / 2], 1).astype(float); i['cl'] = pts[:: max(1, len(pts) // 900)]; i['kd'] = cKDTree(i['cl'])
    i['pos'] = np.array([i['cx'] * 1000.0, i['cy'] * 1000.0])
ID = {i['id']: i for i in I}; ah_off = ID['ahiya']['pos'] - ID['simien_imet_gogo']['pos']
EDGES = list(PAIRS); MOV = list(I)
def on_land(i, pw_):
    r_ = i['ras']; loc = (pw_ - i['pos']) / MPP + np.array([r_.shape[1] / 2, r_.shape[0] / 2]); x = loc[:, 0].astype(int); y = loc[:, 1].astype(int)
    ok = (x >= 0) & (y >= 0) & (x < r_.shape[1]) & (y < r_.shape[0]); o = np.zeros(len(pw_), bool); o[ok] = r_[y[ok], x[ok]] > 0; return o
def gap(A, B):                                                   # nearest coast to coast, and the way from A to B; negative when they overlap
    pb = B['cl'] + B['pos']; d, k = A['kd'].query(pb - A['pos']); j = int(np.argmin(d)); u = pb[j] - (A['cl'][k[j]] + A['pos']); u = u / max(np.hypot(*u), 1e-6)
    ov = on_land(A, pb).mean() + on_land(B, A['cl'] + A['pos']).mean()
    if ov > 0: c = B['pos'] - A['pos']; return -min(3000.0, 400 + ov * 6000), c / np.hypot(*c)
    return float(d[j]), u
for it in range(500):
    k_ = .55 if it < 350 else .25
    for a_, b_ in EDGES:
        A, B = ID[a_], ID[b_]; d, u = gap(A, B); st = (d - GAP) * .5 * k_; A['pos'] += u * st; B['pos'] -= u * st
    for x in range(len(MOV)):
        for y in range(x + 1, len(MOV)):
            A, B = MOV[x], MOV[y]
            if (A['id'], B['id']) in EDGES or (B['id'], A['id']) in EDGES: continue
            d, u = gap(A, B)
            if d < CLEAR: st = (CLEAR - d) * .5 * k_; A['pos'] -= u * st; B['pos'] += u * st
print('straits', [(a_[:6], b_[:6], round(gap(ID[a_], ID[b_])[0])) for a_, b_ in PAIRS])
lo = np.min([i['pos'] - np.array([i['w'], i['hgt']]) * 500 for i in I], 0) - MARGIN; hi = np.max([i['pos'] + np.array([i['w'], i['hgt']]) * 500 for i in I], 0) + MARGIN
for i in I: i['pos'] -= lo; i['cx'], i['cy'] = i['pos'][0] / 1000, i['pos'][1] / 1000
W_KM, H_KM = math.ceil((hi[0] - lo[0]) / 2000) * 2.0, math.ceil((hi[1] - lo[1]) / 2000) * 2.0; PW, PH = int(W_KM * 1000 / MPP), int(H_KM * 1000 / MPP)
if ID['teton'].get('frame'): pass
print('sea', W_KM, 'by', H_KM, 'km')
# ---------- compose ----------
Hmap = np.full((PH, PW), -400.0); OWN = np.full((PH, PW), -1, np.int16)
for i in I:
    a_ = i['ras']; ph, pw = a_.shape; x0p = int(round((i['cx'] - i['w'] / 2) * 1000 / MPP)); y0p = int(round((i['cy'] - i['hgt'] / 2) * 1000 / MPP))
    ys, xs = slice(max(0, y0p), min(PH, y0p + ph)), slice(max(0, x0p), min(PW, x0p + pw))
    sub = a_[ys.start - y0p: ys.stop - y0p, xs.start - x0p: xs.stop - x0p]; win = sub > Hmap[ys, xs]; Hmap[ys, xs] = np.where(win, sub, Hmap[ys, xs]); OWN[ys, xs] = np.where(win & (sub > 0), I.index(i), OWN[ys, xs])
    i['px'] = [x0p, y0p, pw, ph]
land = Hmap > 0
# ---------- paint: sea with shallows, land with height bands and light from the north-west ----------
lm = Image.fromarray((land * 255).astype(np.uint8)); near = np.asarray(lm.filter(ImageFilter.GaussianBlur(14)), dtype=np.float64) / 255; far = np.asarray(lm.filter(ImageFilter.GaussianBlur(60)), dtype=np.float64) / 255
sea = np.zeros((PH, PW, 3)); deep = np.array([28, 70, 140]); mid = np.array([38, 120, 186]); shal = np.array([92, 196, 222]); foam = np.array([168, 230, 236])
t1 = np.clip(far * 2.2, 0, 1)[..., None]; t2 = np.clip(near * 1.8, 0, 1)[..., None]; t3 = np.clip((near - .55) * 4, 0, 1)[..., None]
sea = deep * (1 - t1) + mid * t1; sea = sea * (1 - t2) + shal * t2; sea = sea * (1 - t3) + foam * t3
gy, gx_ = np.gradient(np.maximum(Hmap, 0), MPP); shade = np.clip(.72 - (gx_ * -.7 + gy * -.7) * 1.6, .28, 1.25)[..., None]
stops_ = [(0, (238, 222, 160)), (30, (190, 214, 150)), (300, (150, 190, 120)), (800, (120, 164, 104)), (1300, (160, 164, 126)), (1800, (176, 164, 140)), (2400, (200, 198, 194)), (3000, (244, 246, 248))]
hh = np.maximum(Hmap, 0); col = np.zeros((PH, PW, 3))
for (a0, c0), (a1, c1) in zip(stops_, stops_[1:]):
    t = np.clip((hh - a0) / (a1 - a0), 0, 1)[..., None]; msk = ((hh >= a0) & (hh < a1))[..., None] | ((a1 == stops_[-1][0]) & (hh >= a1))[..., None]
    col = np.where(msk, np.array(c0) * (1 - t) + np.array(c1) * t, col)
landc = np.clip(col * shade, 0, 255)
img = np.where(land[..., None], landc, sea)
grid = np.zeros((PH, PW), bool); step = int(5000 / MPP); grid[::step, :] = True; grid[:, ::step] = True; img = np.where(grid[..., None] & ~land[..., None], img * .9 + 25, img)
# ---------- each island at its own full resolution, for close views ----------
(R / 'atlas' / 'isles').mkdir(exist_ok=True)
def paint_land(Hl, mpp):
    hh = np.maximum(Hl, 0); gy, gx = np.gradient(hh, mpp); sh = np.clip(.72 - (gx * -.7 + gy * -.7) * 1.6, .28, 1.25)[..., None]; c = np.zeros(Hl.shape + (3,))
    for (a0, c0), (a1, c1) in zip(stops_, stops_[1:]):
        t = np.clip((hh - a0) / (a1 - a0), 0, 1)[..., None]; m_ = ((hh >= a0) & (hh < a1))[..., None] | ((a1 == stops_[-1][0]) & (hh >= a1))[..., None]; c = np.where(m_, np.array(c0) * (1 - t) + np.array(c1) * t, c)
    return np.clip(c * sh, 0, 255)
for i in I:
    up = max(1, int(round(900 / max(i['h'].shape))))                       # at least about 900 px on the long side
    Hl = np.asarray(Image.fromarray(i['h'].astype(np.float32)).resize((i['h'].shape[1] * up, i['h'].shape[0] * up), Image.BICUBIC), dtype=np.float64)
    if Hl.shape[1] <= i['px'][2] * 1.15: i['detail'] = None; continue        # the base map is already as sharp
    mpp_l = i['w'] * 1000 / Hl.shape[1]; rgb = paint_land(Hl, mpp_l); alpha = np.clip(Hl / 6 + .5, 0, 1) * 255
    Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), 'RGBA').save(R / 'atlas' / 'isles' / f"{i['id']}.webp", quality=86, method=5); i['detail'] = f"./isles/{i['id']}.webp"
Image.fromarray(img.astype(np.uint8)).save(R / 'atlas' / 'archipelago.jpg', quality=84, optimize=True, progressive=True)
Image.fromarray(img.astype(np.uint8)).resize((PW // 4, PH // 4), Image.LANCZOS).save(R / 'atlas' / 'archipelago-small.jpg', quality=80)
# ---------- vector layer in map km ----------
def km(i, uv): return [round(i['cx'] - i['w'] / 2 + uv[0] * i['w'], 4), round(i['cy'] - i['hgt'] / 2 + uv[1] * i['hgt'], 4)]
out = dict(width_km=W_KM, height_km=H_KM, mpp=MPP, image='./archipelago.jpg', preview='./archipelago-small.jpg', islands=[])
for i in I:
    out['islands'].append(dict(id=i['id'], name=i['name'], level=i['level'], entry=i['entry'], note=i.get('note', ''), center=[i['cx'], i['cy']], size=[i['w'], i['hgt']], small=i.get('small', False), frame=i.get('frame'), detail=i.get('detail'), detail_px=i['h'].shape[1],
      places=[dict(name=p['name'], at=km(i, p['uv']), world=p['world'], entry=p['entry']) for p in i['places'] if 0 <= p['uv'][0] <= 1 and 0 <= p['uv'][1] <= 1],
      roads=[dict(kind=r_['kind'], pts=[km(i, q) for q in r_['uv']]) for r_ in i['roads'] if len(r_['uv']) > 1],
      streets=[[km(i, q) for q in s_] for s_ in i.get('streets', [])]))
json.dump(out, open(R / 'atlas' / 'archipelago.json', 'w'), separators=(',', ':'))
print('islands', [(i['id'], round(i['w'], 1), round(i['hgt'], 1)) for i in I], 'land %', round(land.mean() * 100, 1), 'px', PW, PH)

# ================= the overworld: streamed terrain tiles, bridges, roads in 3D =================
OW = R / 'atlas' / 'ow'; (OW / 't').mkdir(parents=True, exist_ok=True)
T = 100                                                                       # samples per tile edge: 2 km tiles at 20 m
def Hm(x, z):                                                                 # metres -> height, bilinear
    u = np.clip(x / MPP, 0, PW - 1.001); v = np.clip(z / MPP, 0, PH - 1.001); i = np.floor(u).astype(int); j = np.floor(v).astype(int); fu = u - i; fv = v - j
    return Hmap[j, i] * (1 - fu) * (1 - fv) + Hmap[j, i + 1] * fu * (1 - fv) + Hmap[j + 1, i] * (1 - fu) * fv + Hmap[j + 1, i + 1] * fu * fv
tiles = []
for tj in range(PH // T):
    for ti in range(PW // T):
        blk = Hmap[tj * T: tj * T + T + 1, ti * T: ti * T + T + 1]
        if blk.shape != (T + 1, T + 1): blk = np.pad(blk, ((0, T + 1 - blk.shape[0]), (0, T + 1 - blk.shape[1])), mode='edge')
        if blk.max() < -2: continue
        q = np.clip(np.round((blk + 1000) * 10), 0, 65535).astype('<u2'); (OW / 't' / f'{ti}_{tj}.bin').write_bytes(q.tobytes()); tiles.append([ti, tj])
# bridges: the shortest crossing between neighbouring islands, coast to coast
coast = {}
land_ = Hmap > 2
for k, i in enumerate(I):
    m_ = (OWN == k) & land_
    edge = m_ & ~(np.roll(m_, 1, 0) & np.roll(m_, -1, 0) & np.roll(m_, 1, 1) & np.roll(m_, -1, 1))
    ys_, xs_ = np.nonzero(edge); pts = np.stack([xs_, ys_], 1)[:: max(1, len(xs_) // 4000)] * MPP; coast[i['id']] = pts
bridges = []
for a_, b_ in PAIRS:
    A_, B_ = coast[a_], coast[b_]
    if not len(A_) or not len(B_): continue
    d, idx = cKDTree(B_).query(A_); best = None
    for k in np.argsort(d)[:700]:                                                  # short, and landing on low shore at both ends
        q0, q1 = A_[k].astype(float), B_[idx[k]].astype(float); L0 = float(d[k]); dv = (q1 - q0) / max(L0, 1); q0 = q0 - dv * 160; q1 = q1 + dv * 160
        h0, h1 = (float(Hm(np.array([q[0]]), np.array([q[1]]))[0]) for q in (q0, q1)); sc = L0 + 6 * max(h0, h1, 0) + 3 * abs(h0 - h1)
        if best is None or sc < best[0]: best = (sc, q0, q1)
    p0, p1 = best[1], best[2]; L = float(np.hypot(*(p1 - p0)))
    n = max(4, int(L / 40)); xs_ = np.linspace(p0[0], p1[0], n + 1); zs_ = np.linspace(p0[1], p1[1], n + 1); ground = Hm(xs_, zs_)
    e0, e1 = max(ground[0], 1) + 1.5, max(ground[-1], 1) + 1.5; t = np.linspace(0, 1, n + 1)
    deck = e0 * (1 - t) + e1 * t + np.sin(t * np.pi) * min(60, 14 + L / 120)       # a gentle arch over the channel
    deck = np.maximum(deck, ground + 1.2)
    bridges.append(dict(a=a_, b=b_, length_m=round(L), pts=[[round(x, 1), round(y, 2), round(z, 1)] for x, y, z in zip(xs_, deck, zs_)]))
# ferries: sea lanes between islands no bridge joins; a pier reaches out from each shore
NEAR = sorted((gap(A, B)[0], A['id'], B['id']) for x, A in enumerate(I) for B in I[x + 1:] if (A['id'], B['id']) not in PAIRS and (B['id'], A['id']) not in PAIRS)
FERRY = [(a_, b_) for d_, a_, b_ in NEAR if 1000 < d_ < 4000][:5]                  # ferries across the next-narrowest straits no bridge takes
ferries = []
for a_, b_ in FERRY:
    A_, B_ = coast[a_], coast[b_]; d, idx = cKDTree(B_).query(A_); order = np.argsort(d)
    for k in order[:400:20]:                                                     # the shortest lane that stays on water
        p0, p1 = A_[k].astype(float), B_[idx[k]].astype(float); L = float(d[k]); dv = (p1 - p0) / max(L, 1)
        q0, q1 = p0 + dv * 70, p1 - dv * 70; t = np.linspace(0, 1, max(8, int(L / 60))); xs_ = q0[0] + (q1[0] - q0[0]) * t; zs_ = q0[1] + (q1[1] - q0[1]) * t
        if (Hm(xs_, zs_) > -1.5).mean() < .03:
            pier = lambda a, b: [[round(a[0] - dv[0] * 30 * s_, 1), round(max(1.2, float(Hm(np.array([a[0] - dv[0] * 30 * s_]), np.array([a[1] - dv[1] * 30 * s_]))[0]) + 1.2), 2), round(a[1] - dv[1] * 30 * s_, 1)] for s_ in (1, 0)] + [[round(b[0], 1), 1.6, round(b[1], 1)]]
            ferries.append(dict(a=a_, b=b_, length_m=round(L), lane=[[round(x, 1), 0, round(z, 1)] for x, z in zip(xs_, zs_)], piers=[pier(p0, q0), pier(p1 + dv * 0, q1) if False else [[round(p1[0] + dv[0] * 30, 1), round(max(1.2, float(Hm(np.array([p1[0] + dv[0] * 30]), np.array([p1[1] + dv[1] * 30]))[0]) + 1.2), 2), round(p1[1] + dv[1] * 30, 1)], [round(p1[0], 1), 1.6, round(p1[1], 1)], [round(q1[0], 1), 1.6, round(q1[1], 1)]]]))
            break
# roads in 3D: each island's highways and trails at the terrain, plus a connector from every bridge end to its island's nearest road
def road3d(pts_km, lift=1.0, step=30.0):
    out = []
    for (x0_, z0_), (x1_, z1_) in zip(pts_km, pts_km[1:]):
        L = math.hypot(x1_ - x0_, z1_ - z0_) * 1000; n = max(1, int(L / step))
        for t in np.arange(n) / n: x = (x0_ + (x1_ - x0_) * t) * 1000; z = (z0_ + (z1_ - z0_) * t) * 1000; out.append([round(x, 1), round(max(float(Hm(np.array([x]), np.array([z]))[0]), 0.5) + lift, 2), round(z, 1)])
    x, z = pts_km[-1][0] * 1000, pts_km[-1][1] * 1000; out.append([round(x, 1), round(max(float(Hm(np.array([x]), np.array([z]))[0]), .5) + lift, 2), round(z, 1)]); return out
roads3 = []
for i in out['islands']:
    for r_ in i['roads']:
        if r_['kind'] in ('highway', 'trail'): roads3.append(dict(kind=r_['kind'], island=i['id'], pts=road3d(r_['pts'])))
for b in bridges:
    for end, isl in ((b['pts'][0], b['a']), (b['pts'][-1], b['b'])):
        cand = [p_ for r_ in roads3 if r_['island'] == isl for p_ in r_['pts']]
        if not cand: continue
        c = np.array(cand); d = np.hypot(c[:, 0] - end[0], c[:, 2] - end[2]); k = int(np.argmin(d))
        if d[k] < 9000: roads3.append(dict(kind='highway', island=isl, pts=road3d([[end[0] / 1000, end[2] / 1000], [c[k, 0] / 1000, c[k, 2] / 1000]])))
places3 = [dict(name=p_['name'], island=i['id'], world=p_['world'], entry=p_['entry'], x=round(p_['at'][0] * 1000, 1), z=round(p_['at'][1] * 1000, 1)) for i in out['islands'] for p_ in i['places']]
LOW = 10; lowh = Hmap[::LOW, ::LOW]; (OW / 'low.bin').write_bytes(np.clip(np.round((lowh + 1000) * 10), 0, 65535).astype('<u2').tobytes())
json.dump(dict(ferries=ferries, tile=T, mpp=MPP, tiles=tiles, low=dict(step=LOW * MPP, w=lowh.shape[1], h=lowh.shape[0]), width_m=PW * MPP, height_m=PH * MPP, encode='(h+1000)*10 uint16 LE, rows south-increasing z', bridges=bridges, roads=roads3, places=places3,
               islands=[dict(id=i['id'], name=i['name'], level=i['level'], entry=i['entry'], center=[i['center'][0] * 1000, i['center'][1] * 1000], size=[i['size'][0] * 1000, i['size'][1] * 1000], frame=i['frame']) for i in out['islands']],
               texture='./archipelago.jpg'), open(OW / 'world.json', 'w'), separators=(',', ':'))
print('ends', [(b['a'][:6], b['b'][:6], b['pts'][0][1], b['pts'][-1][1]) for b in bridges]); print('ferries', [(f['a'][:6], f['b'][:6], f['length_m']) for f in ferries]); print('overworld', len(tiles), 'tiles', len(bridges), 'bridges', [(b['a'][:6], b['b'][:6], b['length_m']) for b in bridges], len(roads3), 'roads')
