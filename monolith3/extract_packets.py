#!/usr/bin/env python3
"""Pours MONOLITH-3.html's embedded blobs out into typed packet files, so the Teton jerry can carries every detail of the level
as itself: heights, NAIP imagery, canopy, river, textures, sky, survey. Writes monolith3/packets/* and monolith3/packets.json."""
import re, json, base64, zlib, pathlib
R = pathlib.Path(__file__).resolve().parent.parent; OUT = R / 'monolith3' / 'packets'; OUT.mkdir(exist_ok=True)
s = (R / 'MONOLITH-3.html').read_text(encoding='utf-8')
td = json.loads(re.search(r'<script type="[^"]+" id="terrain-data"[^>]*>(.*?)</script>', s, re.S).group(1))
KIND = {'height': 'heightfield', 'surface': 'drape', 'sky-plate': 'sky', 'crown-positions': 'canopy', 'river-level': 'water', 'flow-coordinates': 'water', 'flow': 'water',
        'coat': 'body-texture', 'three': 'runtime', 'terrain-data': 'frame', 'half-survey': 'heightfield', 'terrain-still': 'reference'}
man = {'source': 'MONOLITH-3.html', 'frame': {'units': 'metres', 'origin_lonlat': td['origin'], 'base_elev_m': td['base'],
       'note': 'local x east, z south; a bounds quad [west, east, south, north] spans x west..east and z -north..-south'}, 'packets': []}
for m in re.finditer(r'<script type="(text/plain|application/json)" id="([^"]+)"([^>]*)>(.*?)</script>', s, re.S):
    typ, pid, attr, body = m.groups(); body = body.strip(); enc = 'deflate' if 'deflate' in attr else None
    kind = next((v for k, v in KIND.items() if k in pid), 'texture')
    if pid.startswith('three'): continue                                   # the level's private three.js build is not a liquid; the trough has one
    if body.startswith('data:'):
        mime, b64 = body[5:].split(';base64,', 1); ext = {'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg'}[mime]
        f = f'{pid}.{ext}'; (OUT / f).write_bytes(base64.b64decode(b64))
    elif typ == 'application/json' or pid in ('terrain-data', 'half-survey'):
        f = f'{pid}.json'; (OUT / f).write_text(body)
    else:
        raw = base64.b64decode(body); data = zlib.decompress(raw) if enc else raw
        f = f'{pid}.f32' if pid in ('river-level', 'crown-positions') else f'{pid}.bin'; (OUT / f).write_bytes(data)
    entry = {'id': pid, 'kind': kind, 'file': f'./packets/{f}', 'bytes': (OUT / f).stat().st_size}
    for key in ('far', 'near', 'detail'):
        if pid.startswith(key + '-'): entry['bounds'] = td[key]['bounds']; entry['shape'] = td[key]['shape' if pid.endswith('height') else 'surface']
    if pid == 'reach-height': entry['bounds'] = td['reach']['bounds']
    if pid == 'crown-positions': entry.update(layout='x,y,z,height,cover per crown (float32)', count=td['canopy']['count'], bounds=td['canopy']['bounds'], source=td['canopy']['source'])
    if pid == 'river-level': entry.update(layout='float32 water level per cell', grid=td['river']['grid'], bounds=td['river']['bounds'], source=td['river']['source'])
    if pid == 'mountain-relief': entry['bounds'] = td['mountainRelief']
    if pid.endswith('height') and pid != 'half-survey' or pid == 'reach-height': entry['decode'] = 'elev_m = (R*256+G)*0.1 + B*0.02 - 120 + base_elev_m'
    man['packets'].append(entry)
json.dump(man, open(R / 'monolith3' / 'packets.json', 'w'), indent=1)
print(len(man['packets']), 'packets', round(sum(p['bytes'] for p in man['packets']) / 1e6, 1), 'MB')
