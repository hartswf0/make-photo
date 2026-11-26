#!/usr/bin/env python3
"""Play one scored take into a single Genie 4 session: one world, steered live, then stopped.

    python3 genie/take.py genie/takes/bottle.json                         # dry run: the plan, the timings, the cost
    python3 genie/take.py genie/takes/bottle.json --live --i-accept-the-cost

A score (genie/takes/*.json) holds the world prompt, a seed image, and four tracks (camera, character, world, time).
Each track holds cues. A cue either holds a key (native: W A S D move, arrows look) or sends an event line (generative).
The runner merges the tracks into one timeline. It sends each event line as an impulse (the same line a few times,
150 ms apart) so it lands on a generation-step boundary. It keeps conflicting lines at least `gap` seconds apart, and
it ends the session with interaction.complete, because closing the socket does not stop billing.

Protocol and timings as measured on the live service (wygwyl/world/tide/genie_runner.py):
  - generation starts about 4 s after world_setup;
  - frames are 1280x720 JPEG 2000, and arrive at 17 to 22 a second, not 24;
  - audio is 48 kHz stereo 16-bit PCM;
  - mid-session text is {"event_type": "input", "content": [{"type": "text", "text": ...}]}.
The key is read from GEMINI_API_KEY and never written anywhere."""
import argparse, asyncio, base64, io, json, os, subprocess, sys, time

URL = 'wss://generativelanguage.googleapis.com/v1beta/interactions/live'
RATE = 240 * 24 * 17.5 / 1e6          # dollars per generated second: 240 tokens a frame, 24 frames, $17.50 per million
STARTUP = 4.0                          # world_setup -> first frame
KEYS = {'W': 'key_w', 'A': 'key_a', 'S': 'key_s', 'D': 'key_d', 'UP': 'arrow_up', 'DOWN': 'arrow_down', 'LEFT': 'arrow_left', 'RIGHT': 'arrow_right'}


def seed(path, limit=48_000):
    """The seed squeezed under the size limit: full 1280x720 first, softened a little, then smaller."""
    from PIL import Image, ImageFilter
    src = Image.open(path).convert('RGB')
    for size in ((1280, 720), (1024, 576), (960, 540), (768, 432)):
        im = src.resize(size, Image.LANCZOS)
        for blur in (0, .5, .9):
            j = im.filter(ImageFilter.GaussianBlur(blur)) if blur else im
            for q in range(80, 40, -5):
                b = io.BytesIO(); j.save(b, 'JPEG', quality=q)
                if b.tell() <= limit: return b.getvalue(), f'{size[0]}x{size[1]} q{q} blur{blur}'
    return b.getvalue(), 'over limit'


def timeline(score):
    """Merge the four tracks into one list of sends, measured from the first frame (world_setup is at -STARTUP)."""
    out, rep, gap = [], score.get('impulse', {}).get('repeat', 6), score.get('gap', 3.0)
    for track, cues in score['tracks'].items():
        for c in cues:
            t = c['t']
            if 'key' in c:
                k = KEYS[c['key']]; out.append(dict(t=t, track=track, do='down', key=k, why=c.get('why', '')))
                out.append(dict(t=t + c['ms'] / 1000, track=track, do='up', key=k))
            if 'say' in c: out.append(dict(t=t, track=track, do='say', text=c['say'], rep=c.get('repeat', rep), verify=c.get('verify', '')))
    out.sort(key=lambda a: (a['t'], a['do'] != 'up'))
    says = [a for a in out if a['do'] == 'say']
    for a, b in zip(says, says[1:]):
        if b['t'] - a['t'] < gap: print(f"  ! {b['t']:.1f}s comes {b['t'] - a['t']:.1f}s after the last line (gap {gap}s): {b['text'][:60]}", file=sys.stderr)
    return out


def show(score, plan, img):
    print(f"TAKE {score['id']} · {score['title']}\n{score['duration']} s · about ${score['duration'] * RATE:.2f} of video · seed {score['seed']} ({len(img[0]) // 1024} KB, {img[1]})\n")
    print('WORLD SETUP (' + str(len(score['world'].split())) + ' words)\n' + score['world'] + '\n')
    for a in plan:
        if a['do'] == 'up': continue
        what = f"hold {a['key']}" if a['do'] == 'down' else f"\"{a['text']}\" ×{a['rep']}"
        print(f"{a['t']:5.1f}s  {a['track']:<9} {what}")
        if a.get('why'): print(' ' * 18 + '(' + a['why'] + ')')
        if a.get('verify'): print(' ' * 18 + 'verify: ' + a['verify'])


async def live(score, plan, img, out):
    import ssl, websockets
    ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE')); os.makedirs(out + '/jp2', exist_ok=True)
    st = dict(t0=None, f=0, usage=None); pcm = open(out + '/world.pcm', 'wb'); log = open(out + '/log.jsonl', 'w')
    note = lambda **k: (log.write(json.dumps(dict(at=round(time.monotonic() - (st['t0'] or time.monotonic()), 2), **k)) + '\n'), log.flush(), print(json.dumps(k)[:160], flush=True))
    cap = score['duration'] + STARTUP + 2
    async with websockets.connect(URL, additional_headers={'x-goog-api-key': os.environ['GEMINI_API_KEY']}, ssl=ctx, open_timeout=25, max_size=None) as ws:
        send = lambda ev: ws.send(json.dumps(ev))
        async def pump():
            async for raw in ws:
                d = json.loads(raw.decode() if isinstance(raw, bytes) else raw)
                for e in (d.get('events') or [d]):
                    k, dl = e.get('event_type'), e.get('delta') or {}
                    if k == 'step.delta' and dl.get('type') == 'video':
                        st['f'] += 1; open(f"{out}/jp2/{st['f']:05d}.jp2", 'wb').write(base64.b64decode(dl['data']))
                        if st['f'] == 1: st['f0'] = time.monotonic(); note(event='first frame')
                        st['f1'] = time.monotonic()
                    elif k == 'step.delta' and dl.get('type') == 'audio': pcm.write(base64.b64decode(dl['data']))
                    elif k == 'interaction.completed': st['usage'] = e.get('usage'); note(event=k, usage=e.get('usage')); return
                    elif k in ('interaction.cancelled', 'error'): note(event=k, body=e); return
                    elif k != 'step.delta': note(event=k)
        await send(dict(event_type='interaction.create', model=score.get('model', 'genie-4')))
        reader = asyncio.create_task(pump())
        async def watchdog():                    # a hard stop that does not depend on the timeline
            await asyncio.sleep(cap + 6); note(event='watchdog'); await send(dict(event_type='interaction.cancel'))
        dog = asyncio.create_task(watchdog())
        try:
            await asyncio.sleep(.8)
            await send(dict(event_type='world_setup', world_prompt=score['world'], reference_image=dict(data=base64.b64encode(img[0]).decode(), mime_type='image/jpeg')))
            st['t0'] = time.monotonic() + STARTUP; note(event='world_setup')
            for a in plan:
                w = a['t'] - (time.monotonic() - st['t0'])
                if w > 0: await asyncio.sleep(w)
                if reader.done() or time.monotonic() - st['t0'] > score['duration']: break
                if a['do'] in ('down', 'up'): await send(dict(event_type='user_action', action='key_' + a['do'], input=a['key'])); note(event=a['do'], key=a['key'])
                else:
                    for i in range(a['rep']):
                        await send(dict(event_type='input', content=[dict(type='text', text=a['text'])])); await asyncio.sleep(.15)
                    note(event='say', track=a['track'], text=a['text'])
            rest = score['duration'] - (time.monotonic() - st['t0'])
            if rest > 0 and not reader.done(): await asyncio.sleep(rest)
        finally:
            for k in KEYS.values():
                try: await send(dict(event_type='user_action', action='key_up', input=k))
                except Exception: pass
            try: await send(dict(event_type='interaction.complete')); await asyncio.wait_for(reader, 15)
            except Exception:
                try: await send(dict(event_type='interaction.cancel'))
                except Exception: pass
            dog.cancel()
    pcm.close(); log.close()
    fps = max(1., (st['f'] - 1) / max(.1, st.get('f1', 1) - st.get('f0', 0)))
    print(f"frames {st['f']} at {fps:.1f}/s · usage {json.dumps(st['usage'])[:200]}")
    if st['f']: film(out, fps)


def film(out, fps):
    from PIL import Image
    os.makedirs(out + '/f', exist_ok=True)
    for f in sorted(os.listdir(out + '/jp2')): Image.open(f'{out}/jp2/{f}').convert('RGB').save(f"{out}/f/{f[:-4]}.jpg", quality=90)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', f'{fps:.3f}', '-i', out + '/f/%05d.jpg', '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', out + '/world.pcm',
                    '-r', '24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-c:a', 'aac', '-shortest', out + '/take.mp4'])
    print('take:', out + '/take.mp4')


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('score'); ap.add_argument('--live', action='store_true'); ap.add_argument('--i-accept-the-cost', action='store_true')
    ap.add_argument('--out', default=None); a = ap.parse_args()
    score = json.load(open(a.score)); img = seed(os.path.join(os.path.dirname(a.score), score['seed'])); plan = timeline(score)
    show(score, plan, img)
    if not a.live: return
    if not a.i_accept_the_cost: sys.exit('\nlive needs --i-accept-the-cost')
    out = a.out or os.path.join('takes-out', f"{score['id']}-{time.strftime('%Y%m%d-%H%M%S')}")
    asyncio.run(live(score, plan, img, out))


if __name__ == '__main__': main()
