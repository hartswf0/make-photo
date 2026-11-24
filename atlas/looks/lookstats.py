#!/usr/bin/env python3
"""Colour fingerprints of frames, and how far a trough frame is from the level's own frame.
usage: lookstats.py DIR pairs.json OUT.png  (pairs: [[label, levelPng, beforePng, afterPng], ...])"""
import sys, json, numpy as np
from PIL import Image, ImageDraw, ImageFont
D, pairs, OUT = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]

def load(p):
    im = np.asarray(Image.open(f'{D}/{p}.png').convert('RGB').resize((206, 430)), dtype=np.float64) / 255
    return im[30:-60]                                  # the glass's corner drops and gauge sit at the edges
def fp(im):
    r, g, b = im[..., 0], im[..., 1], im[..., 2]; mx, mn = im.max(-1), im.min(-1)
    l = .2126 * r + .7152 * g + .0722 * b; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    rg, yb = r - g, .5 * (r + g) - b; colourful = np.hypot(rg.std(), yb.std()) + .3 * np.hypot(rg.mean(), yb.mean())
    h = np.zeros_like(l); d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    hist = np.histogram(h, bins=12, range=(0, 1), weights=s)[0]; hist = hist / max(hist.sum(), 1e-6)
    px = im.reshape(-1, 3)[::7]; c = px[np.random.default_rng(1).choice(len(px), 5, replace=False)]
    for _ in range(12):
        k = ((px[:, None] - c[None]) ** 2).sum(-1).argmin(1); c = np.array([px[k == j].mean(0) if (k == j).any() else c[j] for j in range(5)])
    share = np.bincount(k, minlength=5) / len(k); o = np.argsort(-share)
    return dict(luma=l.mean(), contrast=l.std(), sat=s.mean(), colourful=colourful, hue=hist, pal=c[o], share=share[o])
def dist(a, b):                                        # 0 = same look; weights chosen so each term is about 0..1
    return abs(a['luma'] - b['luma']) * 2 + abs(a['contrast'] - b['contrast']) * 3 + abs(a['sat'] - b['sat']) * 2 + abs(a['colourful'] - b['colourful']) * 2 + np.abs(a['hue'] - b['hue']).sum() * .5

rows = []; W, Hh = 206, 430
sheet = Image.new('RGB', (W * 3 + 330, (Hh + 70) * len(pairs)), '#101418'); dr = ImageDraw.Draw(sheet)
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13); FB = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception: F = FB = ImageFont.load_default()
for i, (label, L, B, A) in enumerate(pairs):
    fl, fb, fa = fp(load(L)), fp(load(B)), fp(load(A)); dB, dA = dist(fl, fb), dist(fl, fa)
    rows.append(dict(world=label, before=round(dB, 3), after=round(dA, 3), level={k: round(float(v), 3) for k, v in fl.items() if k in ('luma', 'contrast', 'sat', 'colourful')},
                     trough_before={k: round(float(v), 3) for k, v in fb.items() if k in ('luma', 'contrast', 'sat', 'colourful')}, trough_after={k: round(float(v), 3) for k, v in fa.items() if k in ('luma', 'contrast', 'sat', 'colourful')}))
    y = i * (Hh + 70)
    for j, (p, f, t) in enumerate([(L, fl, 'level'), (B, fb, f'trough before  d={dB:.2f}'), (A, fa, f'trough after  d={dA:.2f}')]):
        sheet.paste(Image.open(f'{D}/{p}.png').convert('RGB').resize((W, Hh)), (j * W, y + 22)); dr.text((j * W + 4, y + 4), t, fill='#e8eef2', font=F)
        for q in range(5): dr.rectangle([j * W + q * (W // 5), y + 22 + Hh + 4, j * W + (q + 1) * (W // 5) - 2, y + 22 + Hh + 40], fill=tuple(int(v * 255) for v in f['pal'][q]))
    dr.text((W * 3 + 14, y + 26), label, fill='#ffffff', font=FB)
    for n, (k, nm) in enumerate([('luma', 'luminance'), ('contrast', 'contrast'), ('sat', 'saturation'), ('colourful', 'colourfulness')]):
        dr.text((W * 3 + 14, y + 60 + n * 22), f"{nm:14s} {fl[k]:.2f}  {fb[k]:.2f}  {fa[k]:.2f}", fill='#c9d3da', font=F)
    dr.text((W * 3 + 14, y + 60 + 4 * 22 + 8), 'level   before   after', fill='#7f8c95', font=F)
    dr.text((W * 3 + 14, y + 60 + 6 * 22), f"distance from level: {dB:.2f} -> {dA:.2f}", fill='#ffd27a' if dA < dB else '#ff8a7a', font=FB)
sheet.save(OUT); print(json.dumps(rows, indent=1))
