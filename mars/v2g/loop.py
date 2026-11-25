#!/usr/bin/env python3
"""The video-to-game loop for Tex Lexington: measure the Genie take, render the game, compare, correct, repeat.

    python3 mars/v2g/loop.py [rounds]     (serve make-photo on http://localhost:8790 first)

1. palette.json holds the film's colours, region by region (median RGB of a box in a named Genie frame).
2. Each round renders the level twice (the main street, and after the storm) with a flat class mask beside each render,
   so every pixel is known to be sky, ground, mesa, wood or spire.
3. Each region's median in the render is compared with the film in CIE Lab (dE76), and the material or light that owns
   that region is corrected: surface colours by the ratio in linear light, the sky and the haze by the difference,
   shadow depth by the sky light's strength.
4. loop.json records every round; tune.json is the result, which mars.js reads as its defaults.
What the loop can and cannot close is written up in study.html."""
import json, os, subprocess, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
URL = os.environ.get('MARS_URL', 'http://localhost:8790/mars/')
WORK = os.environ.get('LOOP_WORK', '/tmp/mars-loop'); os.makedirs(WORK, exist_ok=True)
FILM = json.load(open(f'{HERE}/palette.json'))['regions']
CLS = {'sky': (0, 0, 0), 'ground': (255, 0, 0), 'scrub': (0, 255, 0), 'mesa_near': (0, 0, 255), 'mesa_far': (255, 255, 0), 'wood': (255, 0, 255), 'spire': (0, 255, 255)}

def lin(c): c = np.asarray(c, float) / 255; return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)
def srgb(l): l = np.clip(l, 0, 1); return np.where(l <= .0031308, l * 12.92, 1.055 * l ** (1 / 2.4) - .055) * 255
def lab(c):
    r, g, b = lin(c); X = (.4124 * r + .3576 * g + .1805 * b) / .95047; Y = .2126 * r + .7152 * g + .0722 * b; Z = (.0193 * r + .1192 * g + .9505 * b) / 1.08883
    f = lambda t: np.where(t > .008856, np.cbrt(t), 7.787 * t + 16 / 116); fx, fy, fz = f(X), f(Y), f(Z)
    return np.array([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)])
def dE(a, b): return float(np.linalg.norm(lab(a) - lab(b)))
def hexc(c): return '#%02x%02x%02x' % tuple(int(round(v)) for v in np.clip(c, 0, 255))
def unhex(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)

def measure(png, mask):
    im = np.asarray(Image.open(png).convert('RGB')).astype(float); mk = np.asarray(Image.open(mask).convert('RGB')).astype(int); H = im.shape[0]
    sel = lambda c: (np.abs(mk - np.array(CLS[c])).sum(-1) < 60)
    out = {}
    s = sel('sky'); rows = np.where(s.any(1))[0]
    if len(rows):
        top = s.copy(); top[int(H * .1):] = False
        hor = s.copy(); low = int(np.percentile(np.where(s)[0], 97)); hor[:max(0, low - 40)] = False; hor[low:] = False
        if top.any(): out['sky_top'] = np.median(im[top], 0)
        if hor.any(): out['sky_horizon'] = np.median(im[hor], 0)
    g = sel('ground'); g[:int(H * .45)] = False
    if g.any():
        px = im[g]; L = px @ [.2126, .7152, .0722]
        out['ground_light'] = np.median(px[L >= np.percentile(L, 70)], 0); out['ground_shadow'] = np.median(px[L <= np.percentile(L, 8)], 0)
    for c, k, lit in (('mesa_far', 'mesa_far', 0), ('mesa_near', 'cliff_near', 60), ('wood', 'wood', 85), ('spire', 'spire', 40)):
        m = sel(c)
        if m.sum() > 200:
            px = im[m]
            if lit: L = px @ [.2126, .7152, .0722]; px = px[L >= np.percentile(L, lit)]   # the film's boxes sit on sunlit faces
            out[k] = np.median(px, 0)
    return out

def render(tune, tag):
    tp = f'{WORK}/{tag}.json'; json.dump(tune, open(tp, 'w'))
    subprocess.run(['node', f'{HERE}/loop_render.js', URL, tp, f'{WORK}/{tag}'], check=True, timeout=900)
    m = measure(f'{WORK}/{tag}-street.png', f'{WORK}/{tag}-street-mask.png')
    f = measure(f'{WORK}/{tag}-future.png', f'{WORK}/{tag}-future-mask.png')
    if 'spire' in f: m['spire'] = f['spire']
    return m

Y = np.array([.2126, .7152, .0722])
def lum(c): return float(lin(c) @ Y)

def correct(t, m, damp=.6):
    """Light and colour are separated: shadow depth sets the sky light, sunlit brightness is shared between the sun and the
    ground's albedo, hue is corrected on its own, the haze by its density. Damped, because every surface sees every light."""
    t = dict(t); film = {k: np.array(v['rgb'], float) for k, v in FILM.items()}
    def albedo(key, region, share=1.):
        if region not in m: return
        a = lin(unhex(t[key])); r = lin(film[region]) / np.maximum(lin(m[region]), 1e-4)
        hue = r / max(1e-4, float(r @ Y)); bright = float(r @ Y) ** share
        hue = np.clip(hue, .85, 1.18); hue = hue / float(hue @ Y)   # a guard rail: hue may drift a little per round, never into another colour family
        a = a * (hue * bright) ** damp; over = a.max(); t[key] = hexc(srgb(a / max(1., over)))
        t.setdefault('limits', {})[region] = round(over, 2) if over > 1 else None   # >1: the surface would have to be brighter than white
    if 'ground_shadow' in m: t['hemi'] = round(t['hemi'] * (lum(film['ground_shadow']) / max(1e-4, lum(m['ground_shadow']))) ** (.8 * damp), 3)
    if 'ground_light' in m:
        r = lum(film['ground_light']) / max(1e-4, lum(m['ground_light'])); t['sun'] = round(t['sun'] * r ** (.6 * damp), 3); albedo('ground', 'ground_light', .4)
    albedo('mesa', 'cliff_near'); albedo('wood', 'wood')
    if 'spire' in m:   # the spires: haze first (their lightness), then their stone (their hue and the rest)
        dl = lab(film['spire'])[0] - lab(m['spire'])[0]; t['spireFog'] = round(float(np.clip(t.get('spireFog', 1) * (1 + .03 * dl * damp), .05, 1)), 3); albedo('spire', 'spire', .5)
    if 'mesa_far' in m:   # far mesas too dark: not enough haze between them and us
        dl = lab(film['mesa_far'])[0] - lab(m['mesa_far'])[0]; t['fogD'] = round(float(np.clip(t['fogD'] * (1 + .025 * dl * damp), .0008, .008)), 5)
    for k, key in (('sky_top', 'skyTop'), ('sky_horizon', 'skyHor')):
        if k in m: t[key] = [round(float(v), 4) for v in np.clip(np.array(t[key]) + damp * (film[k] - m[k]) / 255, 0, 1)]
    return t

if __name__ == '__main__':
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    tune = json.load(open(f'{HERE}/tune.json')) if os.path.exists(f'{HERE}/tune.json') and os.environ.get('LOOP_RESUME') else json.load(open(f'{HERE}/tune_start.json'))
    log = []
    for r in range(rounds + 1):
        m = render(tune, f'r{r}'); errs = {k: round(dE(m[k], FILM[k]['rgb']), 1) for k in FILM if k in m}
        log.append(dict(round=r, tune=tune, measured={k: hexc(v) for k, v in m.items()}, dE=errs, mean_dE=round(float(np.mean(list(errs.values()))), 1)))
        print(f'round {r}: mean dE {log[-1]["mean_dE"]}  ' + '  '.join(f'{k} {v}' for k, v in errs.items()), flush=True)
        if r < rounds: tune = correct(tune, m)
    best = min(log, key=lambda x: x['mean_dE'])
    json.dump(dict(film={k: v['hex'] for k, v in FILM.items()}, rounds=log, best_round=best['round']), open(f'{HERE}/loop.json', 'w'), indent=1)
    json.dump(best['tune'], open(f'{HERE}/tune.json', 'w'), indent=1); print('best round', best['round'], 'mean dE', best['mean_dE'])
