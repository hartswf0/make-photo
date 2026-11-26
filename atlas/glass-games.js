// Glass games: the trough's mini-games, drawn on the glass in the rain surface's own language (night-post/rain/rain.css):
// water on a window, cyan for water and amber for warmth, drops that breathe. A can asks for one with ctx.play(kind, opts);
// the trough freezes walking, lends its camera and the player's body, and gives them back when the game ends.
//
//   draw  the revolver. The reticle is a ring of droplets that slide in as you hold steady and scatter as you move or breathe.
//         Pull (drag) or W A S D / arrows to steer the aim; tap, click or Space fires; each shot is a wet streak across the glass
//         from the muzzle to where it landed, and the cylinder is six drops that empty. E or Esc holsters.
//   krar  six strings as six rivulets. Notes fall as drops in a Tezeta phrase; pluck (keys 1-6, or tap the rivulet) as each
//         drop crosses the bridge line. A caught note rings; a missed one smears down the glass. The jar fills with what you caught.
//
// GlassGames.create({ T, camera, canvas }) -> { play(kind, opts, host) -> Promise<result>, letterbox(on), running }
(() => {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const CY = [161, 232, 228], AM = [248, 205, 145], RE = [245, 167, 130], rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function create({ T, camera, canvas }) {
    const cv = document.createElement('canvas'); cv.id = 'glass-games';
    Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: 60, display: 'none', touchAction: 'none', cursor: 'crosshair' });
    const lb = document.createElement('div'); lb.id = 'glass-letterbox'; lb.innerHTML = '<i></i><i></i>';
    const css = document.createElement('style'); css.textContent = `#glass-letterbox i{position:fixed;left:0;right:0;height:0;background:#000;z-index:59;pointer-events:none;transition:height .7s ease}#glass-letterbox i:first-child{top:0}#glass-letterbox i:last-child{bottom:0}#glass-letterbox.on i{height:calc((100vh - 100vw / 2.39) / 2)}
      #glass-hint{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:61;font:500 13px/1.3 system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:.06em;color:#e8f6f3;text-shadow:0 1px 6px #001018;pointer-events:none;text-align:center;display:none;white-space:nowrap}
      #glass-hint b{font-family:'Iowan Old Style','Palatino Linotype',Georgia,serif;font-weight:400;font-size:20px;display:block;letter-spacing:0}`;
    const hint = document.createElement('div'); hint.id = 'glass-hint';
    document.head.append(css); document.body.append(cv, lb, hint);
    const g = cv.getContext('2d'); let W = 0, H = 0, dpr = 1;
    const fit = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    addEventListener('resize', fit); fit();
    const V = new T.Vector3(), proj = p => { V.copy(p).project(camera); return { x: (V.x * .5 + .5) * W, y: (-V.y * .5 + .5) * H, front: V.z < 1 }; };

    // ---- drawing water ----
    function drop(x, y, r, c = CY, a = .85) {
      const gr = g.createRadialGradient(x - r * .3, y - r * .35, r * .1, x, y, r);
      gr.addColorStop(0, rgba([241, 255, 252], .55 * a)); gr.addColorStop(.35, rgba(c, .22 * a)); gr.addColorStop(1, rgba(c, .06 * a));
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 1.08, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = rgba(c, .55 * a); g.lineWidth = 1; g.stroke();
      g.fillStyle = rgba([255, 255, 255], .5 * a); g.beginPath(); g.ellipse(x - r * .35, y - r * .4, r * .22, r * .12, -.4, 0, Math.PI * 2); g.fill();
    }
    function streak(a, b, age, c = CY) {   // a wet line across the glass: bright when new, then it thins, and drips run from it
      const k = clamp(1 - age / 1.6, 0, 1); if (k <= 0) return;
      const gr = g.createLinearGradient(a.x, a.y, b.x, b.y); gr.addColorStop(0, rgba(c, .1 * k)); gr.addColorStop(1, rgba([241, 255, 252], .8 * k));
      g.strokeStyle = gr; g.lineWidth = 1 + 3 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      for (let i = 1; i < 5; i++) { const t = i / 5, x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t) + age * age * 60 * (.5 + (i * 37 % 7) / 7); drop(x, y, 2 + 2 * k, c, k); }
    }
    function splash(p, age, c = CY) { const k = clamp(1 - age / .9, 0, 1); if (k <= 0) return; g.strokeStyle = rgba(c, .7 * k); g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, 6 + age * 70, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 1, d = 8 + age * 90; drop(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d + age * age * 80, 3 * k + 1, c, k); } }
    function label(text, x, y, c = CY, size = 14) { g.font = `500 ${size}px system-ui,-apple-system,'Segoe UI',sans-serif`; g.textAlign = 'center'; g.fillStyle = rgba([232, 246, 243], .92); g.shadowColor = '#001018'; g.shadowBlur = 6; g.fillText(text, x, y); g.shadowBlur = 0; }

    // ---- sound: the games bring their own small synth (a can owns no renderer and no audio graph of the trough's) ----
    let ac = null; const au = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { } } if (ac && ac.state !== 'running') ac.resume(); return ac; };
    function noiseBuf(sec) { const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
    let echo = null; function out() { if (!echo) { echo = ac.createConvolver(); const n = Math.floor(ac.sampleRate * 2.6), b = ac.createBuffer(2, n, ac.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) { const t = i / ac.sampleRate; let v = (Math.random() * 2 - 1) * Math.exp(-t * 2.6) * .35; for (const [at, gg] of [[.28, .5], [.62, .35], [1.05, .22]]) { const dt = t - at - ch * .007; if (dt > 0 && dt < .08) v += (Math.random() * 2 - 1) * gg * Math.exp(-dt * 40); } d[i] = v; } } echo.buffer = b; const eg = ac.createGain(); eg.gain.value = .5; echo.connect(eg); eg.connect(ac.destination); } return echo; }
    const SFX = {
      shot() { if (!au()) return; const t = ac.currentTime; for (const [sec, type, f, gain, dec] of [[.03, 'highpass', 1800, 1.2, .025], [.35, 'lowpass', 1200, .9, .3]]) { const s = ac.createBufferSource(); s.buffer = noiseBuf(sec + .05); const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const gg = ac.createGain(); gg.gain.setValueAtTime(gain, t); gg.gain.exponentialRampToValueAtTime(.0005, t + dec); s.connect(fl); fl.connect(gg); gg.connect(ac.destination); gg.connect(out()); s.start(t); }
        const o = ac.createOscillator(), gg = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(38, t + .18); gg.gain.setValueAtTime(1, t); gg.gain.exponentialRampToValueAtTime(.0005, t + .2); o.connect(gg); gg.connect(ac.destination); gg.connect(out()); o.start(t); o.stop(t + .25); },
      glass() { if (!au()) return; for (let i = 0; i < 5; i++) { const o = ac.createOscillator(), gg = ac.createGain(), t = ac.currentTime + i * .03; o.frequency.value = 2400 + Math.random() * 3600; gg.gain.setValueAtTime(.12, t); gg.gain.exponentialRampToValueAtTime(.0005, t + .25); o.connect(gg); gg.connect(ac.destination); o.start(t); o.stop(t + .3); } },
      tin() { if (!au()) return; for (const f of [1180, 2710]) { const o = ac.createOscillator(), gg = ac.createGain(), t = ac.currentTime; o.frequency.value = f; gg.gain.setValueAtTime(.25, t); gg.gain.exponentialRampToValueAtTime(.0005, t + .4); o.connect(gg); gg.connect(ac.destination); o.start(t); o.stop(t + .45); } },
      click() { if (!au()) return; const o = ac.createOscillator(), gg = ac.createGain(), t = ac.currentTime; o.frequency.value = 1900; gg.gain.setValueAtTime(.15, t); gg.gain.exponentialRampToValueAtTime(.0005, t + .04); o.connect(gg); gg.connect(ac.destination); o.start(t); o.stop(t + .05); },
      krar: (() => { const F = [196, 220, 246.94, 293.66, 329.63, 392], kb = []; return k => { if (!au()) return; if (!kb[k]) { const sr = ac.sampleRate, n = Math.floor(sr * 2.4), b = ac.createBuffer(1, n, sr), d = b.getChannelData(0), N = Math.round(sr / F[k]), ring = new Float32Array(N); for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1; let q = 0; for (let i = 0; i < n; i++) { const a = ring[q]; ring[q] = .4985 * (a + ring[(q + 1) % N]); d[i] = a; q = (q + 1) % N; } kb[k] = b; }
        const s = ac.createBufferSource(); s.buffer = kb[k]; const pk = ac.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 420; pk.gain.value = 6; const gg = ac.createGain(); gg.gain.value = .5; s.connect(pk); pk.connect(gg); gg.connect(ac.destination); gg.connect(out()); s.start(); }; })(),
      smear() { if (!au()) return; const s = ac.createBufferSource(); s.buffer = noiseBuf(.2); const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 500; const gg = ac.createGain(), t = ac.currentTime; gg.gain.setValueAtTime(.08, t); gg.gain.exponentialRampToValueAtTime(.0005, t + .18); s.connect(fl); fl.connect(gg); gg.connect(ac.destination); s.start(t); } };

    // ---- the loop and input, shared by the games ----
    let game = null, raf = 0, last = 0;
    const keys = {}; const kd = e => { if (!game) return; keys[e.code] = true; game.key && game.key(e.code, true); if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); e.stopPropagation(); };
    const ku = e => { if (!game) return; keys[e.code] = false; game.key && game.key(e.code, false); e.stopPropagation(); };
    addEventListener('keydown', kd, true); addEventListener('keyup', ku, true);
    const ptr = { id: null, x: 0, y: 0, x0: 0, y0: 0, t0: 0, moved: 0 };
    cv.addEventListener('pointerdown', e => { if (!game) return; au(); cv.setPointerCapture(e.pointerId); Object.assign(ptr, { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: 0 }); game.down && game.down(e.clientX, e.clientY); });
    cv.addEventListener('pointermove', e => { if (!game || e.pointerId !== ptr.id) return; const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; ptr.moved += Math.hypot(dx, dy); ptr.x = e.clientX; ptr.y = e.clientY; game.drag && game.drag(dx, dy, e.clientX, e.clientY); });
    cv.addEventListener('pointerup', e => { if (!game || e.pointerId !== ptr.id) return; ptr.id = null; const tap = ptr.moved < 10 && performance.now() - ptr.t0 < 350; game.up && game.up(tap, e.clientX, e.clientY); });
    function frame(now) { const dt = Math.min(.05, (now - last) / 1000); last = now; g.clearRect(0, 0, W, H); if (game) { game.tick(dt, now / 1000); raf = requestAnimationFrame(frame); } }
    function begin(gm, host, hintHtml) {
      if (game) game.finish('interrupted');
      game = gm; cv.style.display = 'block'; hint.innerHTML = hintHtml; hint.style.display = 'block'; if (host.freeze) host.freeze(true); if (host.cam) host.cam(gm.cam ? () => gm.cam() : null);
      last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
      return new Promise(res => { gm.finish = why => { if (game !== gm) return; game = null; cv.style.display = 'none'; hint.style.display = 'none'; g.clearRect(0, 0, W, H); for (const k in keys) keys[k] = false; if (host.freeze) host.freeze(false); if (host.cam) host.cam(null); if (host.post) host.post(null); res(Object.assign({ why }, gm.result ? gm.result() : {})); }; });
    }

    // ================= the draw =================
    function draw(o, host) {
      const S = { yaw: o.yaw0 || 0, pitch: o.pitch0 || 0, steady: 0, sway: 0, t: 0, ammo: o.shots || 6, hits: 0, marks: [], move: 0, recoil: 0, lastFire: -9 };
      const dirOf = (yaw, pitch) => new T.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const swayed = () => { const b = (1 - S.steady * .85) * .018; return { yaw: S.yaw + Math.sin(S.t * 1.3) * b + Math.sin(S.t * 3.1) * b * .4, pitch: S.pitch + Math.sin(S.t * 1.7 + 1) * b * .8 + S.recoil * .06 }; };
      function fire() {
        const now = performance.now() / 1000; if (S.ammo <= 0 || now - S.lastFire < .35) { SFX.click(); return; } S.ammo--; S.lastFire = now; S.recoil = 1; S.steady *= .3;   // real time: a slow frame must not swallow a shot
        const a = swayed(), dir = dirOf(a.yaw, a.pitch), r = o.fire ? o.fire(dir) || {} : {}, from = o.muzzle ? o.muzzle() : (o.eye && o.eye());
        SFX.shot(); if (r.what === 'bottle') SFX.glass(); else if (r.what === 'can') SFX.tin();
        if (r.hit) S.hits++; S.marks.push({ from: from && from.clone(), to: r.point ? r.point.clone() : from.clone().addScaledVector(dir, 60), t: 0, hit: !!r.hit, what: r.what });
        if (S.ammo <= 0) setTimeout(() => gm.finish('empty'), 1500);
      }
      const gm = {
        cam() { const eye = o.eye(), d = dirOf(S.yaw, S.pitch * .6), r = new T.Vector3(d.z, 0, -d.x).normalize(); return { pos: eye.clone().addScaledVector(d, -1.7).addScaledVector(r, -.55).add(new T.Vector3(0, .22, 0)), look: eye.clone().addScaledVector(dirOf(S.yaw, S.pitch), 25), fov: lerp(46, 34, S.steady) }; },
        key(c, d) { if (!d) return; if (c === 'Space' || c === 'Enter') fire(); if (c === 'KeyE' || c === 'Escape') gm.finish('holster'); },
        drag(dx, dy) { S.yaw -= dx * .0028; S.pitch = clamp(S.pitch - dy * .0022, -.5, .5); S.move = 1; },
        up(tap) { if (tap) fire(); },
        tick(dt, t) {
          S.t += dt; S.recoil = Math.max(0, S.recoil - dt * 3.5);
          const ky = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0), kp = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
          if (ky || kp) { S.yaw += ky * dt * .9; S.pitch = clamp(S.pitch + kp * dt * .6, -.5, .5); S.move = 1; }
          S.steady = clamp(S.steady + (S.move > .1 ? -dt * 3 : dt / 1.3), 0, 1); S.move = Math.max(0, S.move - dt * 6);
          if (host.post) host.post({ aim: dirOf(S.yaw, S.pitch), raise: 1, recoil: S.recoil });
          const a = swayed(), eye = o.eye(), at = proj(eye.clone().addScaledVector(dirOf(a.yaw, a.pitch), 30));
          // the reticle: seven drops on a ring that closes as you steady; the bead in the centre forms when it is ready
          const R = lerp(74, 9, S.steady);
          for (let i = 0; i < 7; i++) { const ang = i / 7 * Math.PI * 2 + t * .4, rr = R + Math.sin(t * 2.3 + i) * (1 - S.steady) * 7; drop(at.x + Math.cos(ang) * rr, at.y + Math.sin(ang) * rr + (1 - S.steady) * 6, 4.5 + (1 - S.steady) * 2.5, S.steady > .85 ? AM : CY, .9); }
          if (S.steady > .85) drop(at.x, at.y, 3.2, AM, (S.steady - .85) / .15);
          // shots: the streak across the glass, a splash where it struck
          for (const m of S.marks) { m.t += dt; if (!m.from) continue; const a2 = proj(m.from), b2 = proj(m.to); streak(a2, b2, m.t, m.hit ? AM : CY); if (m.hit) { splash(b2, m.t, AM); if (m.t < 1.2 && m.what) label(m.what, b2.x, b2.y - 26 - m.t * 20, AM, 13); } else splash(b2, m.t, CY); }
          if (S.marks.length > 12) S.marks.shift();
          // the cylinder: six drops, lower left
          const cx = 64, cy = H - 92; for (let i = 0; i < (o.shots || 6); i++) { const ang = i / 6 * Math.PI * 2 - Math.PI / 2; drop(cx + Math.cos(ang) * 22, cy + Math.sin(ang) * 22, 7, i < S.ammo ? AM : CY, i < S.ammo ? .95 : .25); }
          label(S.hits + ' hit', cx, cy + 46, CY, 12);
        },
        result: () => ({ shots: (o.shots || 6) - S.ammo, hits: S.hits })
      };
      return begin(gm, host, `<b>Steady the drops</b>pull to aim · tap or Space to fire · E to holster`);
    }

    // ================= the krar =================
    const TEZETA = [[0, 1], [2, 1], [3, 1], [4, 2], [3, 1], [2, 1], [0, 2], [-1, 1], [1, 1], [2, 1], [3, 2], [2, 1], [1, 1], [0, 2], [-1, 1], [4, 1], [5, 1], [4, 1], [3, 1], [2, 2], [3, 1], [2, 1], [0, 3]];   // [string, beats]; -1 is a rest
    function krar(o, host) {
      const bpm = o.bpm || 88, beat = 60 / bpm, lead = 2.4, notes = []; let tt = 1.2;
      for (const [k, b] of (o.melody || TEZETA)) { if (k >= 0) notes.push({ k, at: tt, state: 0, t: 0 }); tt += b * beat; }
      const S = { t: 0, caught: 0, total: notes.length, rings: [], lastK: -1, end: tt + 1.5 };
      const xs = k => W * (.3 + k * .08), lineY = () => H * .72;
      function pluck(k) { SFX.krar(k); if (o.pluck) o.pluck(k); S.rings.push({ k, t: 0 }); let best = null; for (const n of notes) { if (n.state || n.k !== k) continue; const d = Math.abs(n.at - S.t); if (d < .16 && (!best || d < best.d)) best = { n, d }; }
        if (best) { best.n.state = 1; best.n.t = 0; S.caught++; if (o.onNote) o.onNote(true, S.caught, S.total); } }
      const gm = {
        cam: o.cam || null,
        key(c, d) { if (!d) return; const m = /^Digit([1-6])$/.exec(c) || /^Numpad([1-6])$/.exec(c); if (m) pluck(+m[1] - 1); if (c === 'KeyE' || c === 'Escape') gm.finish('stopped'); },
        down(x, y) { let best = 0, bd = 1e9; for (let k = 0; k < 6; k++) { const d = Math.abs(xs(k) - x); if (d < bd) { bd = d; best = k; } } if (bd < W * .05) pluck(best); },
        tick(dt, now) {
          S.t += dt; const L = lineY();
          // the strings: six rivulets running down the glass
          for (let k = 0; k < 6; k++) { const x = xs(k), wob = t => Math.sin(t * 2 + k) * 1.5; g.strokeStyle = rgba(CY, .28); g.lineWidth = 2; g.beginPath(); for (let y = H * .12; y < H * .9; y += 12) g.lineTo(x + wob(y * .02 + now), y); g.stroke(); label(String(k + 1), x, H * .9 + 18, CY, 12); }
          g.strokeStyle = rgba(AM, .55); g.lineWidth = 1.5; g.beginPath(); g.moveTo(xs(0) - 30, L); g.lineTo(xs(5) + 30, L); g.stroke();   // the bridge
          for (const n of notes) { const dtn = n.at - S.t, y = L - dtn / lead * (L - H * .12);
            if (n.state === 1) { n.t += dt; splash({ x: xs(n.k), y: L }, n.t, AM); continue; }
            if (dtn < -.16 && n.state === 0) { n.state = 2; SFX.smear(); if (o.onNote) o.onNote(false, S.caught, S.total); }
            if (n.state === 2) { n.t += dt; if (n.t < 1.5) drop(xs(n.k) + Math.sin(n.t * 9) * 2, L + n.t * n.t * 140, 5, CY, .5 * (1 - n.t / 1.5)); continue; }
            if (y > H * .1) drop(xs(n.k), y, 7 + Math.max(0, 1 - Math.abs(dtn) * 4) * 3, Math.abs(dtn) < .16 ? AM : CY, .95); }
          for (const r of S.rings) { r.t += dt; const k2 = clamp(1 - r.t / .5, 0, 1); if (k2 > 0) { g.strokeStyle = rgba(AM, .6 * k2); g.lineWidth = 2; g.beginPath(); g.moveTo(xs(r.k), H * .12); g.lineTo(xs(r.k) + Math.sin(r.t * 70) * 4 * k2, L); g.stroke(); } }
          // the jar: what you caught
          const jx = W * .82, jy = H * .76, jh = 110, fill = S.caught / S.total; g.strokeStyle = rgba(CY, .55); g.lineWidth = 1.5; g.strokeRect(jx - 26, jy - jh, 52, jh); g.fillStyle = rgba(CY, .28); g.fillRect(jx - 25, jy - jh * fill, 50, jh * fill);
          label(S.caught + ' of ' + S.total, jx, jy + 20, CY, 12);
          if (S.t > S.end) gm.finish('song');
        },
        result: () => ({ caught: S.caught, total: S.total })
      };
      return begin(gm, host, `<b>Play the Tezeta</b>1–6 or tap a string as its drop reaches the bridge · E to stop`);
    }

    function letterbox(on) { lb.classList.toggle('on', !!on); }
    return { play(kind, opts, host) { au(); return kind === 'draw' ? draw(opts, host || {}) : kind === 'krar' ? krar(opts, host || {}) : Promise.reject(new Error('no game ' + kind)); }, letterbox, get running() { return !!game; }, sfx: SFX };
  }
  window.GlassGames = { create };
})();
