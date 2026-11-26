#!/usr/bin/env python3
"""Measure a Genie take: what held, what drifted, what moved, and when, against what we sent.

    python3 genie/v2g/measure.py <take.mp4> --seed <seed.jpg> [--log log.jsonl] --out <dir> [--name NAME]

Everything is measured from the pixels, with no model in the loop. At 8 samples a second it records:

  look    mean CIE Lab, chroma, contrast (L std), vignette (corner L / centre L), grain (fine-detail energy).
          Each is compared with the seed. "drift" is the dE76 of the frame's mean colour from the seed's, plus how far
          contrast and vignette moved. Genie's default photoreal look shows up as vignette going to 1 and contrast rising.
  cut     a jump in the colour histogram between neighbouring samples, far above the take's own median.
  motion  dense optical flow (Farneback) on a 320 px greyscale copy. "push" is the mean outward flow from the centre,
          positive when the camera moves forward. "yaw" is the mean sideways flow, i.e. the camera turning. "still"
          means both are small.
  cues    every line we sent (from log.jsonl), and the first measurable change that follows it: a cut, a jump in drift,
          or the walk stopping.

Writes <out>/<name>.json and a strip chart, <out>/<name>.png, with a frame every few seconds over the curves."""
import argparse, json, os, subprocess
import numpy as np, cv2
from PIL import Image


def lab_of(rgb):  # uint8 HxWx3 RGB -> float Lab (OpenCV scales L to 0-255 for uint8, so use float32 0-1)
    return cv2.cvtColor(rgb.astype(np.float32) / 255, cv2.COLOR_RGB2LAB)


def look(rgb):
    lab = lab_of(rgb); L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]; h, w = L.shape
    cy, cx = slice(h // 3, 2 * h // 3), slice(w // 3, 2 * w // 3); k = h // 6
    corners = np.concatenate([L[:k, :k].ravel(), L[:k, -k:].ravel(), L[-k:, :k].ravel(), L[-k:, -k:].ravel()])
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32); fine = g - cv2.GaussianBlur(g, (0, 0), 1.2)
    return dict(L=float(L.mean()), a=float(a.mean()), b=float(b.mean()), chroma=float(np.hypot(a, b).mean()),
                contrast=float(L.std()), vignette=float(corners.mean() / max(1, L[cy, cx].mean())), grain=float(np.abs(fine).mean()))


def hist(rgb):
    h = cv2.calcHist([cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)], [0, 1], None, [24, 16], [0, 180, 0, 256]); return cv2.normalize(h, h).flatten()


def frames(mp4, fps):
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', mp4, '-vf', f'fps={fps},scale=320:180', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    while True:
        b = p.stdout.read(320 * 180 * 3)
        if len(b) < 320 * 180 * 3: break
        yield np.frombuffer(b, np.uint8).reshape(180, 320, 3)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('mp4'); ap.add_argument('--seed'); ap.add_argument('--log'); ap.add_argument('--out', required=True)
    ap.add_argument('--name'); ap.add_argument('--fps', type=float, default=8); A = ap.parse_args()
    os.makedirs(A.out, exist_ok=True); name = A.name or os.path.basename(os.path.dirname(os.path.abspath(A.mp4)))
    seed = np.asarray(Image.open(A.seed).convert('RGB').resize((320, 180), Image.LANCZOS)) if A.seed else None
    S = look(seed) if seed is not None else None
    yy, xx = np.mgrid[0:180, 0:320].astype(np.float32); rx, ry = xx - 160, yy - 90; rn = np.hypot(rx, ry) + 1e-3; rx, ry = rx / rn, ry / rn
    rows, prevg, prevh = [], None, None
    for i, f in enumerate(frames(A.mp4, A.fps)):
        t = i / A.fps; lk = look(f); g = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY); h = hist(f); r = dict(t=round(t, 3), **{k: round(v, 3) for k, v in lk.items()})
        if S: r['drift'] = round(float(np.linalg.norm([lk['L'] - S['L'], lk['a'] - S['a'], lk['b'] - S['b']])), 2)
        if prevg is not None:
            fl = cv2.calcOpticalFlowFarneback(prevg, g, None, .5, 3, 21, 3, 5, 1.1, 0); fx, fy = fl[..., 0], fl[..., 1]
            band = slice(10, 170); r['push'] = round(float((fx * rx + fy * ry)[band].mean()), 3); r['yaw'] = round(float(fx[band].mean()), 3)
            r['jump'] = round(float(cv2.compareHist(prevh, h, cv2.HISTCMP_CHISQR_ALT)), 3)
        rows.append(r); prevg, prevh = g, h
    J = np.array([r.get('jump', 0) for r in rows]); med = float(np.median(J[1:])) if len(J) > 2 else 0
    cuts = [rows[i]['t'] for i in range(1, len(rows)) if J[i] > max(8 * med, .6)]
    def state(r):
        p, y = r.get('push', 0), r.get('yaw', 0)
        return 'turn' if abs(y) > .9 else 'walk' if p > 1.0 else 'creep' if p > .25 else 'back' if p < -.25 else 'still'
    sm = lambda key, i, w=8: float(np.mean([rows[j].get(key, 0) for j in range(max(0, i - w // 2), min(len(rows), i + w // 2))]))
    for i, r in enumerate(rows): r['state'] = state(dict(push=sm('push', i), yaw=sm('yaw', i)))
    segs = []
    for r in rows:
        if segs and segs[-1]['state'] == r['state']: segs[-1]['t1'] = r['t']
        else: segs.append(dict(state=r['state'], t0=r['t'], t1=r['t']))
    segs = [s for s in segs if s['t1'] - s['t0'] >= .75]
    cues = []
    if A.log and os.path.exists(A.log):
        ev = [json.loads(l) for l in open(A.log)]; f0 = next((e['at'] for e in ev if e['event'] == 'first frame'), 0)   # video time 0 is the first frame
        for e in ev:
            e['at'] = round(e['at'] - f0, 2)
            if e['event'] in ('say', 'down', 'up'): cues.append(dict(at=e['at'], kind=e['event'], key=e.get('key'), text=(e.get('text') or '')[:120], chars=len(e.get('text') or '')))
    for c in cues:
        if c['kind'] != 'say': continue
        nxt = [x for x in cuts if x > c['at']]; c['next_cut'] = round(nxt[0] - c['at'], 2) if nxt else None
        st = lambda T: next((r['state'] for r in rows if r['t'] >= T), None); c['before'], c['after'] = st(c['at'] - .5), st(c['at'] + 2.5)
    first20 = [r for r in rows if r['t'] < 2]; drift_at = lambda T: next((r['drift'] for r in rows if r['t'] >= T), None)
    summary = dict(name=name, seconds=round(rows[-1]['t'], 2), seed=S and {k: round(v, 3) for k, v in S.items()}, cuts=cuts,
                   look_start={k: round(float(np.mean([r[k] for r in first20])), 3) for k in ('L', 'chroma', 'contrast', 'vignette', 'grain')},
                   look_end={k: round(float(np.mean([r[k] for r in rows[-16:]])), 3) for k in ('L', 'chroma', 'contrast', 'vignette', 'grain')},
                   drift_1s=drift_at(1), drift_8s=drift_at(8), drift_max=max((r.get('drift', 0) for r in rows), default=None),
                   time_walking=round(sum(s['t1'] - s['t0'] for s in segs if s['state'] == 'walk'), 1),
                   time_turning=round(sum(s['t1'] - s['t0'] for s in segs if s['state'] == 'turn'), 1),
                   time_still=round(sum(s['t1'] - s['t0'] for s in segs if s['state'] == 'still'), 1), time_creep=round(sum(s['t1'] - s['t0'] for s in segs if s['state'] == 'creep'), 1),
                   walk_ends=[s['t1'] for s in segs if s['state'] == 'walk'], segments=segs, cues=cues)
    json.dump(dict(summary=summary, rows=rows), open(f'{A.out}/{name}.json', 'w'), indent=0)
    chart(A.mp4, rows, summary, f'{A.out}/{name}.png'); print(json.dumps({k: v for k, v in summary.items() if k not in ('segments', 'cues', 'rows')}))


def chart(mp4, rows, s, png):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    T = [r['t'] for r in rows]; n = 10; dur = T[-1]; ts = [dur * (i + .5) / n for i in range(n)]
    thumbs = []
    for t in ts:
        b = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.2f}', '-i', mp4, '-frames:v', '1', '-vf', 'scale=256:144', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
        thumbs.append(np.frombuffer(b, np.uint8).reshape(144, 256, 3) if len(b) == 256 * 144 * 3 else np.zeros((144, 256, 3), np.uint8))
    fig = plt.figure(figsize=(16, 9), dpi=110, facecolor='#101214'); gs = fig.add_gridspec(5, n, height_ratios=[1.1, 1, 1, 1, .5], hspace=.35, wspace=.04)
    for i, im in enumerate(thumbs):
        ax = fig.add_subplot(gs[0, i]); ax.imshow(im); ax.set_axis_off(); ax.set_title(f'{ts[i]:.0f}s', color='#ccc', fontsize=8)
    def lane(row, keys, title, colors):
        ax = fig.add_subplot(gs[row, :]); ax.set_facecolor('#16191c')
        for k, c in zip(keys, colors): ax.plot(T, [r.get(k, np.nan) for r in rows], color=c, lw=1.1, label=k)
        for x in s['cuts']: ax.axvline(x, color='#ff5a5a', lw=.8, ls='--')
        for c in s['cues']:
            if c['kind'] == 'say': ax.axvline(c['at'], color='#f5c26b', lw=.5, alpha=.6)
        ax.set_xlim(0, dur); ax.tick_params(colors='#999', labelsize=7); [sp.set_color('#333') for sp in ax.spines.values()]
        ax.legend(loc='upper right', fontsize=7, facecolor='#16191c', labelcolor='#ccc', edgecolor='#333'); ax.set_ylabel(title, color='#ccc', fontsize=8)
    lane(1, ['drift'], 'drift from seed (dE)', ['#7fd1c7'])
    lane(2, ['contrast', 'chroma'], 'look', ['#e8e8e8', '#f08a5d'])
    ax = fig.add_subplot(gs[3, :]); ax.set_facecolor('#16191c'); ax.plot(T, [r.get('push', 0) for r in rows], color='#8fd18f', lw=1, label='push (forward)')
    ax.plot(T, [r.get('yaw', 0) / 10 for r in rows], color='#b48ef0', lw=1, label='yaw / 10 (turn)'); ax.axhline(0, color='#444', lw=.6)
    ax.set_xlim(0, dur); ax.tick_params(colors='#999', labelsize=7); ax.legend(loc='upper right', fontsize=7, facecolor='#16191c', labelcolor='#ccc', edgecolor='#333'); ax.set_ylabel('camera', color='#ccc', fontsize=8)
    for x in s['cuts']: ax.axvline(x, color='#ff5a5a', lw=.8, ls='--')
    ax = fig.add_subplot(gs[4, :]); ax.set_facecolor('#16191c'); col = dict(walk='#8fd18f', creep='#3d6b3d', turn='#b48ef0', still='#666', back='#d88')
    for sg in s['segments']: ax.axvspan(sg['t0'], sg['t1'], color=col[sg['state']], alpha=.8)
    ax.set_xlim(0, dur); ax.set_yticks([]); ax.tick_params(colors='#999', labelsize=7); ax.set_xlabel('seconds  (yellow lines: text cues sent · red dashes: cuts)  ·  bar: walk green, creep dark green, turn violet, still grey', color='#aaa', fontsize=8)
    fig.suptitle(f"{s['name']} · {s['seconds']:.0f}s · drift at 1s {s['drift_1s']} → 8s {s['drift_8s']} dE · walking {s['time_walking']}s, creeping {s['time_creep']}s, turning {s['time_turning']}s, still {s['time_still']}s · cuts {len(s['cuts'])}", color='#eee', fontsize=11)
    fig.savefig(png, facecolor=fig.get_facecolor(), bbox_inches='tight'); plt.close(fig)


if __name__ == '__main__': main()
