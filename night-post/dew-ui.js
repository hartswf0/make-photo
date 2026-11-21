/* The interface is rain. One pane, one water.
   After the Afterlight screening room (bolas/afterlight/room): Dew five ways, Air, Lens.

   Everything on the glass is a drop in the same simulation:
     rain      lands small, pins, gathers, merges, lets go, runs, thins, pins again; out of the rain the glass dries
     controls  are stubborn drops: real lenses, sized by what they carry, that stay near their place, swell when rain
               feeds them, shed drips that run, and let go and fall the moment their action stops being true
     words     are written in beaded script beside the speaker's drop, and run or lift when the line ends
     streaks   are ribbons of water; each keeps the moment its drop passed (worms), and later drops follow them
     memory    an action you did hangs from the litres as a worm of its own frames
     touch     your finger is in the water: it smears the pane, drags loose drops, leaves a wet path, raises mist
   SMOKE takes the colour of what it leaves. FLARE is the beacon, seen. BREATH is yours. BLOOM is a plate being made.

   The DOM controls stay underneath, invisible, as the touch targets and for screen readers; the water is their body.
   The layer itself never takes a touch (pointer-events: none). */
(function () {
  window.makeDew = function (game) {
    const cv = document.createElement('canvas'); cv.id = 'dew-glass';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:64';
    document.body.append(cv);
    const text = document.createElement('div'); text.id = 'dew-text'; document.body.append(text);
    const st = document.createElement('style');
    st.textContent = `#dew-text{position:fixed;inset:0;pointer-events:none;z-index:63}
      #dew-text p{position:absolute;margin:0;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`;
    document.head.append(st);
    try { const ff = new FontFace('Dancing Script', 'url(./fonts/dancing-script-latin-600-normal.woff2)', { weight: '600' }); ff.load().then(f => document.fonts.add(f)).catch(() => { }); } catch (e) { }
    const ctx = cv.getContext('2d'), snap = document.createElement('canvas'), sctx = snap.getContext('2d', { willReadFrequently: true });
    const CELL = 24, COLS = 16, ROWS = 12, atlas = document.createElement('canvas'), actx = atlas.getContext('2d'); atlas.width = CELL * COLS; atlas.height = CELL * ROWS;
    let cell = 0, W = 0, H = 0, dpr = 1, snapAge = 9, dirty = false, T = 0, tick = 0;
    function size() {
      dpr = Math.min(1.5, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); snap.width = Math.max(64, Math.round(W / 3)); snap.height = Math.max(64, Math.round(H / 3));
    }
    size(); addEventListener('resize', size);
    const drops = [], beads = [], wisps = [], msgs = [], streaks = [], wetPts = [], skins = new Map(), memory = [];
    const D = { drops, beads, wisps, msgs, streaks, skins, rain: 0, enabled: true, light: null, flare: 0, breath: 0, bloomT: 0, mark: null, wet: 0,
      select: '#dk-status,#dk-menu-btn,#dk-rail .bead,#dk-row .bead,#dk-verbs .verb,#dk-offers .verb,#dk-chips button,#dk-expose,#dk-veh', pool: null, hint: '', drag: null, onMerge: null, ways: [], onSwat: null, onWipe: null, onBreathe: null, lastTouch: 0, wind: 0, mist: 0, smoke: 0, titleT: 0, titleText: '' };
    const RK = 2.1, rOf = m => RK * Math.cbrt(m), mOf = r => Math.pow(r / RK, 3), R_RUN = 7.6, R_STOP = 3.0;
    const SERIF = 'Georgia,"Iowan Old Style","Times New Roman",serif';

    function snapshot() { try { sctx.drawImage(game, 0, 0, snap.width, snap.height); } catch (e) { } snapAge = 0; }
    function lightDir(x, y) { const L = D.light || [W * .2, -H * .2], dx = L[0] - x, dy = L[1] - y, n = Math.hypot(dx, dy) || 1; return [dx / n, dy / n]; }
    /* ---------- shapes ---------- */
    function blob(x, y, rx, ry, seed, amp, tear) {                      // a closed liquid outline; tear: pointed at the top
      const N = 16, P = [];
      for (let i = 0; i < N; i++) {
        const th = i / N * 6.2832, k = 1 + amp * (.5 * Math.sin(2 * th + seed + T * .7) + .3 * Math.sin(3 * th + seed * 2.3 - T * .5) + .2 * Math.sin(5 * th + seed * .7 + T * .9));
        if (tear) { const s = Math.sin(th / 2); P.push([x + rx * k * Math.sin(th) * Math.pow(s, 1.5) * 1.3, y - ry * k * Math.cos(th) * (Math.cos(th) > 0 ? 1.15 : .9)]); }
        else P.push([x + Math.cos(th) * rx * k, y + Math.sin(th) * ry * k]);
      }
      ctx.beginPath();
      for (let i = 0; i < N; i++) { const a = P[i], b = P[(i + 1) % N], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; if (!i) { const z = P[N - 1]; ctx.moveTo((z[0] + a[0]) / 2, (z[1] + a[1]) / 2); } ctx.quadraticCurveTo(a[0], a[1], mx, my); }
      ctx.closePath();
    }
    /* water: the world through it (flipped, wider than it covers), a dark rim, gathered light, the light itself */
    function water(x, y, rx, ry, a, tint, pathFn) {
      const k = snap.width / W, m = 1.9, [lx, ly] = lightDir(x, y), R = Math.max(rx, ry);
      ctx.save(); ctx.globalAlpha = a; pathFn(); ctx.clip();
      ctx.translate(x, y); ctx.scale(-1, -1);
      ctx.drawImage(snap, (x - rx * m) * k, (y - ry * m) * k, rx * 2 * m * k, ry * 2 * m * k, -rx * 1.25, -ry * 1.25, rx * 2.5, ry * 2.5);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bx = x - rx * 1.4, by = y - ry * 1.4, bw = rx * 2.8, bh = ry * 2.8;
      if (tint) { ctx.fillStyle = tint; ctx.fillRect(bx, by, bw, bh); }
      let g = ctx.createRadialGradient(x + lx * rx * .15, y + ly * ry * .15, Math.min(rx, ry) * .3, x, y, R * 1.12);
      ctx.fillStyle = 'rgba(225,242,250,.10)'; ctx.fillRect(bx, by, bw, bh);                                    // water is brighter than what is behind it
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.8, 'rgba(0,8,14,.05)'); g.addColorStop(1, 'rgba(0,6,12,.46)'); ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
      g = ctx.createRadialGradient(x - lx * rx * .5, y - ly * ry * .5, 0, x - lx * rx * .5, y - ly * ry * .5, R * .8);
      g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
      ctx.restore();
      ctx.save(); ctx.globalAlpha = a; pathFn(); ctx.lineWidth = R > 12 ? 1.4 : 1; ctx.strokeStyle = 'rgba(255,255,255,.62)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath();                                                    // the light, small and bright, on the near side
      ctx.ellipse(x + lx * rx * .52, y + ly * ry * .52, Math.max(.8, Math.min(6, rx * .12)), Math.max(.6, Math.min(3.2, ry * .08)), Math.atan2(ly, lx) + 1.57, 0, 6.2832); ctx.fill();
      if (R > 16) { ctx.globalAlpha = a * .5; ctx.beginPath(); ctx.ellipse(x - lx * rx * .55, y - ly * ry * .6, rx * .3, ry * .12, Math.atan2(ly, lx) + 1.57, 0, 6.2832); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill(); }
      ctx.restore();
    }
    /* a drop about a place: an upright, magnified view of exactly that spot; off screen, the last view it had */
    const wayMem = new Map();
    function tele(Wy, dt) {
      const x = Wy.sx, y = Wy.sy, r = Wy.r, k = snap.width / W, zoom = 2.6, seed = Wy.id.length * 1.3;
      let mem = wayMem.get(Wy.id); if (!mem) { mem = { cv: document.createElement('canvas'), has: false, t: 9 }; mem.cv.width = mem.cv.height = 72; wayMem.set(Wy.id, mem); }
      mem.t += dt;
      if (Wy.on && mem.t > .6) { mem.t = 0; mem.has = true; const f = r / zoom * 1.3; try { mem.cv.getContext('2d').drawImage(snap, (Wy.tx - f) * k, (Wy.ty - f) * k, f * 2 * k, f * 2 * k, 0, 0, 72, 72); } catch (e) { } }
      const path = () => blob(x, y, r, r * 1.04, seed, .06);
      ctx.save(); path(); ctx.clip();
      if (Wy.on) { const f = r / zoom * 1.3; ctx.drawImage(snap, (Wy.tx - f) * k, (Wy.ty - f) * k, f * 2 * k, f * 2 * k, x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6); }
      else if (mem.has) { ctx.globalAlpha = .85; ctx.drawImage(mem.cv, x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6); ctx.globalAlpha = 1; }
      else { ctx.fillStyle = 'rgba(214,228,234,.34)'; ctx.fillRect(x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6); }           // never seen: only fog in it
      const [lx, ly] = lightDir(x, y); let g = ctx.createRadialGradient(x, y, r * .45, x, y, r * 1.1);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,6,12,.55)'); ctx.fillStyle = g; ctx.fillRect(x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6);
      ctx.restore();
      ctx.save(); path(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(x + lx * r * .55, y + ly * r * .55, Math.min(5, r * .14), Math.min(3, r * .08), Math.atan2(ly, lx) + 1.57, 0, 6.2832); ctx.fill();
      if (!Wy.on) { const a = Wy.dir; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath();                               // it leans toward where the place is
        ctx.moveTo(x + Math.cos(a) * (r + 13), y + Math.sin(a) * (r + 13)); ctx.lineTo(x + Math.cos(a + .5) * (r + 2), y + Math.sin(a + .5) * (r + 2)); ctx.lineTo(x + Math.cos(a - .5) * (r + 2), y + Math.sin(a - .5) * (r + 2)); ctx.closePath(); ctx.fill(); }
      const right = x < W * .55; ctx.textAlign = right ? 'left' : 'right'; ctx.textBaseline = 'middle';
      beaded(Wy.label, x + (right ? r + 9 : -r - 9), y - 8, 19, .95); ctx.globalAlpha = .9; ctx.shadowColor = 'rgba(0,8,14,.95)'; ctx.shadowBlur = 6;
      ctx.font = `italic 12.5px ${SERIF}`; ctx.fillStyle = 'rgba(226,240,246,.9)'; ctx.fillText(Wy.note, x + (right ? r + 10 : -r - 10), y + 13); ctx.restore();
    }
    D.title = t => { D.titleText = t; D.titleT = 4.2; dirty = true; for (let i = 0; i < 14; i++) drop({ x: 20 + Math.random() * (W - 40), y: -10 - Math.random() * 120, r: 3 + Math.random() * 4, state: 'fall', vy: 60 + Math.random() * 120, grow: 1, forced: true }); };   // an area arrives as a shower
    const lens = (x, y, rx, ry, a, tint) => water(x, y, rx, ry, a, tint, () => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832); });
    /* ---------- loose drops ---------- */
    function drop(o) {
      const d = Object.assign({ x: W / 2, y: H / 2, r: 14, grow: 0, state: 'hold', vy: 0, vx: 0, life: 1e9, t: 0, a: 1, tint: null, lastPt: -1e9, wob: Math.random() * 6, held: false, trail: null }, o);
      d.m = mOf(d.r); drops.push(d); dirty = true;
      d.release = () => { if (d.state === 'hold') { d.state = 'fall'; d.vy = Math.max(d.vy, 20); d.held = false; d.forced = true; } };
      d.smoke = () => { if (d.state !== 'gone') { for (let i = 0; i < 10; i++) wisp(d.x + (Math.random() - .5) * d.r, d.y + (Math.random() - .5) * d.r); d.state = 'gone'; } };
      return d;
    }
    function cellRect(c) { return [(c % COLS) * CELL, Math.floor(c / COLS) * CELL]; }
    function capture(x, y, f, upright) {                                 // keep a moment: a round cell of what the glass shows here, now
      const c = cell; cell = (cell + 1) % (COLS * ROWS); const [cx, cy] = cellRect(c), k = snap.width / W;
      actx.save(); actx.clearRect(cx, cy, CELL, CELL); actx.beginPath(); actx.arc(cx + CELL / 2, cy + CELL / 2, CELL / 2 - .5, 0, 6.2832); actx.clip();
      actx.translate(cx + CELL / 2, cy + CELL / 2); if (!upright) actx.scale(-1, -1);
      try { actx.drawImage(snap, (x - f) * k, (y - f) * k, f * 2 * k, f * 2 * k, -CELL / 2, -CELL / 2, CELL, CELL); } catch (e) { }
      actx.setTransform(1, 0, 0, 1, 0, 0);
      const g = actx.createRadialGradient(cx + CELL * .5, cy + CELL * .5, CELL * .22, cx + CELL * .5, cy + CELL * .5, CELL * .5);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,6,12,.55)'); actx.fillStyle = g; actx.fillRect(cx, cy, CELL, CELL);
      actx.fillStyle = 'rgba(255,255,255,.85)'; actx.beginPath(); actx.arc(cx + CELL * .34, cy + CELL * .3, CELL * .06, 0, 6.2832); actx.fill();
      actx.restore(); return c;
    }
    function bead(x, y, r, life, c) { if (beads.length > 170) beads.shift(); if (c == null) c = capture(x, y, Math.max(r * 3.4, 8)); const [cx, cy] = cellRect(c); beads.push({ x, y, r, t: 0, life, cx, cy }); }
    D.remember = () => { if (snapAge > .2) snapshot(); const s = Math.min(W, H) * .32; memory.push(capture(W / 2, H * .52, s, true)); if (memory.length > 9) memory.shift(); };
    D.recall = (x, y) => {                                               // what you just did runs down the glass as a worm of its own frames
      if (!memory.length) return; const cells = memory.splice(0); drop({ x, y, r: 13, state: 'fall', vy: 14, grow: 1, forced: true, cells, slow: true });
    };
    function colourAt(x, y) { try { const d = sctx.getImageData(Math.max(0, Math.min(snap.width - 1, x * snap.width / W | 0)), Math.max(0, Math.min(snap.height - 1, y * snap.height / H | 0)), 1, 1).data; return [d[0], d[1], d[2]]; } catch (e) { return [200, 215, 220]; } }
    function wisp(x, y, o = {}) {
      const c = o.rgb || colourAt(x, y), mix = v => Math.round(v * .45 + 232 * .55);
      wisps.push(Object.assign({ x, y, vx: (Math.random() - .5) * 14, vy: -18 - Math.random() * 26, r: 5 + Math.random() * 7, t: 0, life: 1.6 + Math.random() * 1.2, rgb: [mix(c[0]), mix(c[1]), mix(c[2])] }, o)); dirty = true;
    }
    function streakPt(S, x, y) { S.pts.push({ x, y, t: 0 }); if (S.pts.length > 110) S.pts.shift(); wetPts.push(S.pts[S.pts.length - 1]); if (wetPts.length > 260) wetPts.shift(); }
    function newStreak(w, life, rgb) { const S = { pts: [], w, life, rgb: rgb || '214,238,248' }; streaks.push(S); if (streaks.length > 26) streaks.shift(); return S; }
    /* ---------- messages ---------- */
    function say(o) {
      const p = document.createElement('p'); if (o.name) { const b = document.createElement('b'); b.textContent = o.name + ': '; p.append(b); }
      const s = document.createElement('span'); p.append(s); p.setAttribute('role', 'status'); text.append(p);
      const a0 = o.anchor && o.anchor() || [W / 2, H * .4];
      const d = drop({ x: a0[0], y: a0[1], r: o.me ? 9 : 15, grow: 0, held: true, tint: o.me ? 'rgba(56,232,255,.16)' : null });
      const M = { d, p, s, full: o.text || '', shown: 0, anchor: o.anchor, me: !!o.me, done: false, name: o.name || '', fade: 1, box: null };
      M.set = (t, frac) => { const n = Math.ceil(t.length * Math.min(1, frac)); if (n !== M.shown || t !== M.full) { M.full = t; M.shown = n; s.textContent = t.slice(0, n); } };
      M.end = (how = 'fall') => {
        if (M.done) return; M.done = true; M.how = how; setTimeout(() => p.remove(), 800);
        if (how === 'smoke') d.smoke(); else d.release();
        if (M.box) for (let i = 0; i < (how === 'smoke' ? 7 : 5); i++) {
          const x = M.box[0] + Math.random() * M.box[2], y = M.box[1] + Math.random() * M.box[3];
          if (how === 'smoke') wisp(x, y); else drop({ x, y, r: 2.6 + Math.random() * 2.4, state: 'fall', vy: 10 + Math.random() * 30, grow: 1, forced: true });
        }
      };
      M.place = () => { if (M.done) return; const a = M.anchor && M.anchor(); if (a) { d.x += (a[0] - d.x) * .25; d.y += (a[1] - d.y) * .25; } };
      msgs.push(M); return M;
    }
    const SCRIPT = px => `600 ${px}px "Dancing Script","Snell Roundhand","Segoe Script","Apple Chancery","Bradley Hand",cursive`, NOTE = `italic 13.5px ${SERIF}`;
    function wrap(str, font, maxW) { ctx.font = font; const out = []; let line = ''; for (const w of str.split(/\s+/)) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
    function beaded(l, x, y, px, a, fill) {                               // script whose every stroke is a row of beads
      ctx.font = SCRIPT(px); ctx.lineJoin = ctx.lineCap = 'round'; ctx.globalAlpha = a; ctx.shadowColor = 'rgba(0,8,14,.95)'; ctx.shadowBlur = 7;
      ctx.fillStyle = fill || 'rgba(240,250,255,.58)'; ctx.fillText(l, x, y);
      ctx.shadowBlur = 0; ctx.setLineDash([.1, 3.6]); ctx.lineWidth = Math.max(1.5, px / 15); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.strokeText(l, x, y); ctx.setLineDash([]);
    }
    function writing(M) {
      const full = M.full || ''; if (!full) return;
      const shown = full.slice(0, M.shown), quoted = t => (t.match(/“[^”]*”?/g) || []).map(q => q.replace(/[“”]/g, '').trim()).join(' ');
      const spoken = M.me ? shown : quoted(shown), note = M.me ? '' : shown.replace(/“[^”]*”?/g, ' ').replace(/\s+/g, ' ').trim();
      const maxW = Math.min(250, W * .58), d = M.d, a = Math.max(0, M.done ? M.fade : 1), px = M.me ? 22 : 29;
      const sl = spoken ? wrap(spoken, SCRIPT(px), maxW) : [], nl = note ? wrap(note, NOTE, maxW) : [];
      const lh = M.me ? 26 : 33, hgt = (M.name ? 16 : 0) + sl.length * lh + nl.length * 18 + 4;
      const roomR = W - 12 - (d.x + d.r + 12), roomL = d.x - d.r - 12 - 12; let x, y, al = 'left';
      if (roomR >= maxW) { x = d.x + d.r + 12; y = d.y - Math.min(hgt / 2, 26); } else if (roomL >= maxW) { x = d.x - d.r - 12; al = 'right'; y = d.y - Math.min(hgt / 2, 26); }
      else { x = Math.max(12, Math.min(W - maxW - 12, d.x - maxW / 2)); y = d.y + d.r + 10; }
      y = Math.max(58, Math.min(H - hgt - 150, y)); M.box = [al === 'right' ? x - maxW : x, y, maxW, hgt];
      ctx.save(); ctx.textAlign = al; ctx.textBaseline = 'top'; ctx.globalAlpha = a; ctx.shadowColor = 'rgba(0,8,14,.95)'; ctx.shadowBlur = 7;
      if (M.name) { ctx.font = `italic 15px "Dancing Script","Snell Roundhand",cursive`; ctx.fillStyle = 'rgba(214,240,248,.86)'; ctx.fillText(M.name, x, y); y += 16; }
      for (const l of sl) { beaded(l, x, y, px, a, M.me ? 'rgba(200,244,255,.62)' : null); y += lh; }
      ctx.globalAlpha = a; ctx.shadowBlur = 7; ctx.font = NOTE; ctx.fillStyle = 'rgba(226,240,246,.86)'; for (const l of nl) { ctx.fillText(l, x, y + 2); y += 18; }
      ctx.restore();
    }
    D.bloom = () => { D.bloomT = 1; dirty = true; };
    /* ---------- touch: your finger is in the water ---------- */
    const finger = { down: false, x: 0, y: 0, vx: 0, vy: 0, S: null, acc: 0 };
    addEventListener('pointerdown', e => { finger.down = true; finger.x = e.clientX; finger.y = e.clientY; finger.vx = finger.vy = 0; finger.S = null; finger.t0 = T; finger.len = 0; finger.wiped = finger.breathed = false; D.lastTouch = T; finger.onUi = !!(e.target.closest && e.target.closest('button,select,input'));
      const el = e.target.closest && e.target.closest('button,#dk-status'), U = el && skins.get(el); D.drag = U ? { U, moved: false, x0: e.clientX, y0: e.clientY } : null; }, { capture: true, passive: true });
    addEventListener('pointermove', e => {
      if (!finger.down || !D.enabled) return; const dx = e.clientX - finger.x, dy = e.clientY - finger.y, n = Math.hypot(dx, dy); if (n < 1) return;
      finger.vx = dx; finger.vy = dy; finger.x = e.clientX; finger.y = e.clientY;
      if (D.drag && Math.hypot(finger.x - D.drag.x0, finger.y - D.drag.y0) > 26) D.drag.moved = true;
      finger.len += n; D.lastTouch = T;
      if (!finger.onUi && !finger.wiped && !D.pool && finger.len > 230 && T - finger.t0 < .75) {                 // one fast stroke wipes the glass
        finger.wiped = true; if (D.onWipe) D.onWipe();
        for (const d of drops) if (!d.held) { d.state = 'fall'; d.forced = true; d.vx += dx * 30; d.vy = Math.max(d.vy, 40 + Math.random() * 80); }
      }
      if (finger.onUi) return; dirty = true;
      if (!finger.S) finger.S = newStreak(7, 5.5); finger.acc += n;
      if (finger.acc > 6) { streakPt(finger.S, finger.x, finger.y);                                           // the wet path your finger leaves
        if (finger.acc > 18 && drops.length < 70 && Math.random() < .7) drop({ amb: true, x: finger.x + (Math.random() - .5) * 22, y: finger.y + (Math.random() - .5) * 22, r: 1.4 + Math.random() * 2.4, grow: .3, a: .9 });   // mist raised by the touch
        finger.acc = 0; }
      for (const d of drops) { if (d.held || d.ui) continue; const q = Math.hypot(d.x - finger.x, d.y - finger.y); if (q < 30 + d.r) {         // loose water goes with the finger
        const k = 1 - q / (30 + d.r); d.x += dx * k * .9; d.y += dy * k * .9; d.vx += dx * k * 6; if (d.state === 'hold' && n > 2) { d.state = 'fall'; d.vy = Math.max(6, dy * 8); d.t = 0; } } }
      for (const U of skins.values()) { const q = Math.hypot(U.x - finger.x, U.y - finger.y); if (q < U.rx + 26) { U.ox += dx * .12; U.oy += dy * .12; } }   // even the stubborn ones lean
    }, { capture: true, passive: true });
    const lift = () => {
      finger.down = false; finger.S = null; const G = D.drag; D.drag = null;
      if (G && G.moved) {                                                  // water carried from one drop into another: that is the act
        let hit = null; for (const U of skins.values()) if (U !== G.U && Math.abs(finger.x - U.x) < U.rx + 14 && Math.abs(finger.y - U.y) < U.ry + 14) { hit = U; break; }
        if (hit) { hit.swell = 1; G.U.swell = .6; if (D.onMerge) D.onMerge(G.U.el, hit.el); }
        else if (Math.hypot(finger.vx, finger.vy) > 7 && D.onSwat && (G.U.el.dataset.key || G.U.el.dataset.offer)) { G.U.fling = [finger.vx * 34, finger.vy * 34]; D.onSwat(G.U.el); }   // flicked: it flies off and stays away a while
        else drop({ x: finger.x, y: finger.y, r: 7, state: 'fall', vy: 20, grow: 1, forced: true });   // let go over nothing: it just falls
      }
    }; addEventListener('pointerup', lift, { capture: true, passive: true }); addEventListener('pointercancel', lift, { capture: true, passive: true });
    /* ---------- stubborn drops: the controls ---------- */
    function labelOf(el) {
      if (el.dataset.dewLabel) return [el.dataset.dewLabel, ''];
      let main = '', sub = '';
      for (const n of el.childNodes) if (n.nodeType === 3) main += n.textContent;
      main = main.trim(); const b = el.querySelector('b,i,#dk-l,#field-stick-name'); if (!main && b) main = b.textContent.trim();
      const s = el.querySelector('.csq,small,em'); if (s) sub = s.textContent.trim();
      return [main || el.getAttribute('aria-label') || '', sub];
    }
    function syncSkins() {
      const seen = new Set();
      const row = document.getElementById('dk-row'), rr = row && !row.hidden ? row.getBoundingClientRect() : null;
      for (const el of document.querySelectorAll(D.select)) {
        if (el.closest('[hidden]')) continue; const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue;
        if (rr && el.parentElement === row && (r.right > rr.right - 6 || r.left < rr.left - 6)) continue;
        seen.add(el); let U = skins.get(el);
        if (!U) { const sky = el.classList.contains('verb') || el.parentElement.id === 'dk-chips';   // what the weather brings falls in from above and lands on its thing
          U = { el, x: r.left + r.width / 2 + (sky ? (Math.random() - .5) * 30 + D.wind * -.4 : 0), y: sky ? -40 - Math.random() * 70 : r.top + r.height / 2 - 14, land: sky, rx: 4, ry: 4, ox: 0, oy: 0, seed: Math.random() * 9, wetq: Math.random() * .6, swell: 0, a: 0, ui: true }; skins.set(el, U); dirty = true; }
        const sc = +(el.dataset.dewScale || 1); U.hx = r.left + r.width / 2; U.hy = r.top + r.height / 2; U.trx = r.width / 2 * sc; U.try = r.height / 2 * sc;
        U.kind = el.id === 'dk-expose' ? 'tear' : el.id === 'dk-menu-btn' ? 'amber' : el.id === 'field-stick' ? 'pool' : el.classList.contains('verb') && !el.classList.contains('alt') ? 'go' : el.classList.contains('urgent') ? 'urgent' : 'clear';
        const inMenu = el.parentElement && (el.parentElement.id === 'dk-rail' || el.parentElement.id === 'dk-row');
        if (inMenu) U.kind = el.classList.contains('on') ? 'amber' : 'honey';
        else if (el.classList.contains('on') && U.kind === 'clear') U.kind = 'go';
        [U.label, U.sub] = labelOf(el); U.pic = el.classList.contains('pic') ? el.style.backgroundImage : ''; U.cap = el.parentElement === row;
        U.press = el.matches(':active');
      }
      for (const [el, U] of skins) if (!seen.has(el)) {                    // its action is no longer true: it lets go, and falls like any other water
        skins.delete(el); const r = Math.min(16, Math.max(5, Math.min(U.rx, U.ry) * .55));
        const hon = U.kind === 'amber' || U.kind === 'honey';
        drop({ x: U.x, y: U.y, r, state: 'fall', vx: U.fling ? U.fling[0] : 0, vy: U.fling ? Math.max(30, U.fling[1]) : hon ? 4 : 8 + Math.random() * 20, grow: 1, forced: true, visc: hon ? 5 : 0, tint: hon ? 'rgba(232,160,40,.42)' : U.kind === 'go' ? 'rgba(56,232,255,.2)' : null });
      }
    }
    const TINT = { amber: 'rgba(232,150,28,.50)', honey: 'rgba(236,176,70,.26)', go: 'rgba(56,232,255,.20)', urgent: 'rgba(255,90,70,.42)' };
    function drawSkin(U, dt) {
      U.a = Math.min(1, U.a + dt * 3.2); U.ox *= 1 - Math.min(1, dt * 3); U.oy *= 1 - Math.min(1, dt * 3); U.swell *= 1 - Math.min(1, dt * 1.2);
      const k = Math.min(1, dt * (U.land ? 5 : 7)); U.x += (U.hx + U.ox - U.x) * k; U.y += (U.hy + U.oy - U.y) * k;       // stubborn: it comes back to its place
      if (U.land && Math.abs(U.y - U.hy) < 4) { U.land = false; U.swell = 1; for (let i = 0; i < 4; i++) drop({ x: U.x + (Math.random() - .5) * U.trx * 1.6, y: U.y + U.try * .6, r: 2 + Math.random() * 2, state: 'fall', vy: 20 + Math.random() * 40, vx: (Math.random() - .5) * 120, grow: 1, forced: true }); }   // it lands, and splashes
      const g = U.a * (2 - U.a) * (U.press ? .93 : 1) * (1 + U.swell * .1); U.rx += (U.trx * g - U.rx) * k; U.ry += (U.try * g - U.ry) * k;
      const fixed = U.el.id === 'dk-status' || U.el.id === 'dk-menu-btn' || U.el.id === 'dk-expose', nearF = finger.down && Math.hypot(finger.x - U.x, finger.y - U.y) < U.rx + 90;
      const want = nearF || U.press || U.land ? 1 : U.el.dataset.dewFaint ? .42 : fixed ? (T - D.lastTouch > 5 && !document.body.classList.contains('dk-menu-open') ? .5 : 1) : U.el.dataset.key && U.age > 5 ? .72 : 1;   // water yields: it thins when you are not reaching for it
      U.vis = (U.vis ?? 1) + (want - (U.vis ?? 1)) * Math.min(1, dt * 2.2);
      if (U.el.dataset.ax && !U.land) { const ax = +U.el.dataset.ax, ay = +U.el.dataset.ay, dx = ax - U.x, dy = ay - U.y, n = Math.hypot(dx, dy) || 1;   // a hair of water to the thing it is about
        if (n > U.rx + 8) { ctx.save(); ctx.globalAlpha = .55 * U.vis; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(U.x + dx / n * U.rx * .95, U.y + dy / n * U.ry * .95);
          ctx.quadraticCurveTo((U.x + ax) / 2, (U.y + ay) / 2 + 10, ax, ay); ctx.stroke(); ctx.restore(); lens(ax, ay, 3.2, 3.6, U.vis); } }
      U.age = (U.age || 0) + dt; const sag = U.kind === 'urgent' ? .1 + .05 * Math.sin(T * 9) : U.el.dataset.dewLife ? Math.min(.42, Math.pow(U.age / +U.el.dataset.dewLife, 2) * .42) : U.el.classList.contains('verb') ? Math.min(.18, U.age * .012) : 0;   // what waits, sags; what is about to go, hangs
      const x = U.x + (U.kind === 'urgent' ? Math.sin(T * 23) * 1.2 : 0), y = U.y + Math.sin(T * .8 + U.seed) * 1.2 + U.ry * sag * .5, rx = U.rx * (1 - sag * .25), ry = U.ry * (1 + sag), tear = U.kind === 'tear', amp = U.kind === 'pool' ? .05 : rx > 30 ? .075 : .05;
      water(x, y, rx, ry, Math.min(1, U.a * 1.2) * U.vis, TINT[U.kind], () => blob(x, y, rx, ry, U.seed, amp, tear));
      if (U.kind === 'pool') { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1; for (let i = 0; i < 2; i++) { const u = ((T * .35 + i * .5) % 1); ctx.globalAlpha = (1 - u) * .8; ctx.beginPath(); ctx.ellipse(x, y, rx * (.35 + u * .6), ry * (.35 + u * .6), 0, 0, 6.2832); ctx.stroke(); } ctx.restore(); }
      // the rain feeds it; when it holds too much it sheds a drip that runs
      if (D.rain > .2) { U.wetq += dt * D.rain * (.05 + Math.random() * .1); if (U.wetq > 1 && U.kind !== 'pool') { U.wetq = 0; U.swell = 0; drop({ x: x + (Math.random() - .5) * rx * .8, y: y + ry * (tear ? 1 : .9), r: 3 + Math.random() * 2.6, state: 'fall', vy: 6, grow: .2, forced: true, tint: U.kind === 'amber' ? 'rgba(230,150,30,.4)' : null }); } }
      const hang = U.wetq > .55 && U.kind !== 'pool' ? (U.wetq - .55) / .45 : 0;                            // the drip gathering under it
      if (hang > 0) { const hx = x + Math.sin(U.seed * 3) * rx * .45, hy = y + ry * .96; lens(hx, hy + hang * 5, 2 + hang * 2.2, 2.6 + hang * 5, U.a, TINT[U.kind === 'amber' ? 'amber' : '']); }
      // what it says
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = U.a * Math.min(1, U.vis + .25); ctx.shadowColor = 'rgba(0,8,14,.95)'; ctx.shadowBlur = 6; ctx.fillStyle = '#fff';
      if (U.pic) { /* a held picture is drawn by the element itself, under the water */ }
      const fs = U.cap ? 12 : Math.max(12, Math.min(17, rx * .34 + 6)), ly = tear ? y + ry * .22 : y - (U.sub && !U.cap ? 6 : 0);
      ctx.font = `500 ${fs}px ${SERIF}`; ctx.fillText(U.label, x, ly, rx * 1.75);
      if (U.sub) { ctx.font = U.cap ? `italic 10.5px ${SERIF}` : `italic 11.5px ${SERIF}`; ctx.globalAlpha = U.a * .9; ctx.fillText(U.sub, x, U.cap ? y + ry + 9 : ly + 15, U.cap ? 70 : rx * 1.8); }
      ctx.restore();
    }
    /* ---------- per frame ---------- */
    let rainT = 0;
    function frame(dt) {
      if (!D.enabled) return;
      dt = Math.min(.05, dt); T += dt; tick++;
      if (tick % 4 === 0 || !skins.size) syncSkins();
      rainT -= dt;
      if (D.rain > .2 && rainT <= 0) {                                   // rain lands small and gathers; on a beaded pane it feeds what is there
        rainT = (.1 + Math.random() * .22) / D.rain;
        const x = 8 + Math.random() * (W - 16), y = 30 + Math.random() * (H * .7), r = 1.6 + Math.random() * 2.6;
        let ui = null; for (const U of skins.values()) if (Math.abs(x - U.x) < U.rx && Math.abs(y - U.y) < U.ry) { ui = U; break; }
        if (ui) { ui.swell = Math.min(1, ui.swell + .5); ui.wetq += .16; }                                 // rain on a control: it takes it in
        else {
          const amb = drops.filter(d => d.amb && d.state === 'hold');
          let hit = amb.find(d => Math.hypot(d.x - x, d.y - y) < d.r + r + 3);
          if (!hit && amb.length >= 24) { let bd = 1e9; for (const d of amb) { const q = Math.hypot(d.x - x, d.y - y); if (q < bd) { bd = q; hit = d; } } }
          if (hit) { hit.m += mOf(r) * 1.6; hit.r = rOf(hit.m); } else drop({ amb: true, x, y, r, grow: .4, a: .9 });
          for (const d of amb) for (const o of amb) if (o !== d && o.state === 'hold' && d.state === 'hold' && d.m >= o.m && Math.hypot(o.x - d.x, o.y - d.y) < (o.r + d.r) * .92) {
            d.x = (d.x * d.m + o.x * o.m) / (d.m + o.m); d.y = (d.y * d.m + o.y * o.m) / (d.m + o.m); d.m += o.m; d.r = rOf(d.m); o.state = 'gone'; }
        }
      }
      if (finger.down && !finger.onUi && !finger.breathed && !D.pool && finger.len < 12 && T - finger.t0 > .55) {   // held still on empty glass: your breath brings the drops back
        finger.breathed = true; for (let i = 0; i < 12; i++) wisp(finger.x + (Math.random() - .5) * 70, finger.y + (Math.random() - .5) * 50, { vy: -6 - Math.random() * 10, r: 14 + Math.random() * 14, rgb: [232, 240, 244] }); if (D.onBreathe) D.onBreathe(); }
      for (const M of msgs) M.place();
      for (let i = msgs.length - 1; i >= 0; i--) { const M = msgs[i]; if (M.done) { M.fade -= dt * 1.1; if (M.fade <= 0) msgs.splice(i, 1); } }
      D.wet += ((D.rain > .2 ? 1 : 0) - D.wet) * Math.min(1, dt * .6);
      const busy = D.ways.length || D.titleT > 0 || D.mist > .02 || D.smoke > .02 || drops.length || beads.length || wisps.length || msgs.length || streaks.length || skins.size || D.flare > .02 || D.breath > .02 || D.bloomT > 0 || D.wet > .02 || D.mark;
      if (!busy) { if (dirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); dirty = false; } return; }
      dirty = true; snapAge += dt; if (snapAge > .033) snapshot();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      // BREATH
      if (D.breath > .02) {
        const ph = .5 + .5 * Math.sin(T * (2.4 + 2.2 * D.breath)), a = D.breath * (.16 + .2 * ph);
        const g = ctx.createRadialGradient(W / 2, H + 30, 20, W / 2, H + 30, H * (.34 + .16 * ph));
        g.addColorStop(0, `rgba(226,236,240,${a})`); g.addColorStop(.6, `rgba(226,236,240,${a * .45})`); g.addColorStop(1, 'rgba(226,236,240,0)'); ctx.fillStyle = g; ctx.fillRect(0, H * .4, W, H * .6);
      }
      // FLARE, and what the light tells you, written beside it
      if (D.flare > .02 && D.light) {
        const [lx, ly] = D.light, a = D.flare, cx = W / 2, cy = H / 2;
        let g = ctx.createLinearGradient(0, 0, W, 0); const u = Math.max(0, Math.min(1, lx / W));
        g.addColorStop(0, 'rgba(120,230,255,0)'); g.addColorStop(Math.max(0, u - .001), `rgba(150,240,255,${.5 * a})`); g.addColorStop(Math.min(1, u + .001), `rgba(150,240,255,${.5 * a})`); g.addColorStop(1, 'rgba(120,230,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, ly - 1, W, 2);
        g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 46); g.addColorStop(0, `rgba(200,250,255,${.42 * a})`); g.addColorStop(1, 'rgba(200,250,255,0)'); ctx.fillStyle = g; ctx.fillRect(lx - 46, ly - 46, 92, 92);
        [[.45, 9, '160,240,255'], [.85, 16, '255,214,150'], [1.3, 26, '150,220,255'], [1.7, 12, '255,190,160']].forEach(([t, r, c]) => {
          const x = lx + (cx - lx) * t, y = ly + (cy - ly) * t; ctx.strokeStyle = `rgba(${c},${.22 * a})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke(); ctx.fillStyle = `rgba(${c},${.07 * a})`; ctx.fill(); });
        if (D.mark) { ctx.save(); ctx.textAlign = lx > W * .6 ? 'right' : 'left'; ctx.textBaseline = 'middle'; beaded(D.mark, lx + (lx > W * .6 ? -16 : 16), Math.max(70, ly + 26), 24, a); ctx.restore(); }
      }
      // MIST of a place: it takes the top of the glass first
      if (D.mist > .02) { const g = ctx.createLinearGradient(0, 0, 0, H * .75); g.addColorStop(0, `rgba(214,226,232,${.34 * D.mist})`); g.addColorStop(1, 'rgba(214,226,232,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * .75);
        if (Math.random() < dt * 2.2 * D.mist) wisp(Math.random() * W, 60 + Math.random() * H * .4, { vx: D.wind * .3 + (Math.random() - .5) * 10, vy: -4, r: 16 + Math.random() * 18, life: 3 + Math.random() * 2, rgb: [226, 234, 238] }); }
      // SMOKE of a place: a fire nearby sends it up the glass
      if (D.smoke > .02 && Math.random() < dt * 5 * D.smoke) wisp(Math.random() * W, H + 10, { vx: (Math.random() - .5) * 16 + D.wind * .2, vy: -34 - Math.random() * 30, r: 9 + Math.random() * 10, life: 3 + Math.random() * 2, rgb: [236, 206, 170] });
      // the name of where you have come to, written by the shower that brought it
      if (D.titleT > 0) { D.titleT -= dt; const a = Math.min(1, D.titleT / .8) * Math.min(1, (4.2 - D.titleT) / .5); ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; beaded(D.titleText, W / 2, H * .27, Math.min(40, W / (D.titleText.length * .52)), a); ctx.restore();
        if (D.titleT <= 0) for (let i = 0; i < 6; i++) drop({ x: W * .2 + Math.random() * W * .6, y: H * .27 + (Math.random() - .5) * 20, r: 2.6 + Math.random() * 3, state: 'fall', vy: 10 + Math.random() * 30, grow: 1, forced: true }); }
      // PLACES: each a drop over where it is, looking at it
      for (const Wy of D.ways) tele(Wy, dt);
      // WATER DOWN THE FRAME
      if (D.wet > .02) for (const side of [0, 1]) {
        const bx = side ? W - 7 : 7, sg = side ? -1 : 1;
        for (const [off, w, col] of [[1.8, 4.4, `rgba(0,10,16,${.22 * D.wet})`], [0, 3.4, `rgba(210,240,250,${.15 * D.wet})`], [-1, 1, `rgba(255,255,255,${.5 * D.wet})`]]) {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath();
          for (let y = -10; y <= H + 10; y += 14) { const x = bx + sg * (off + 3.6 * Math.sin(y * .021 + T * .5 + side * 2) + 2 * Math.sin(y * .067 - T * .9) + 2.6 * Math.sin(y * .009 + side)); if (y < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
          ctx.stroke(); }
      }
      // STREAKS: ribbons of water, thinning from the tail; the easy way down for whatever comes next
      ctx.lineCap = ctx.lineJoin = 'round';
      for (let i = streaks.length - 1; i >= 0; i--) {
        const S = streaks[i]; let alive = false;
        for (const p of S.pts) { p.t += dt; if (p.t < S.life) alive = true; }
        if (!alive && S.pts.length) { streaks.splice(i, 1); continue; }
        for (let k = 1; k < S.pts.length; k += 1) {
          const a = S.pts[k - 1], b = S.pts[k], al = Math.max(0, 1 - b.t / S.life); if (al <= 0 || Math.hypot(a.x - b.x, a.y - b.y) > 60) continue;
          const w = S.w * (.45 + .55 * al) * (.8 + .3 * Math.sin(k * .9 + S.w));
          ctx.strokeStyle = `rgba(0,8,14,${.26 * al})`; ctx.lineWidth = w + 1.6; ctx.beginPath(); ctx.moveTo(a.x + .8, a.y); ctx.lineTo(b.x + .8, b.y); ctx.stroke();
          ctx.strokeStyle = `rgba(${S.rgb},${(S.rgb[0] === '2' && S.rgb[1] === '4' ? .34 : .16) * al})`; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${.55 * al})`; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(a.x - w * .32, a.y); ctx.lineTo(b.x - w * .32, b.y); ctx.stroke();
        }
      }
      // WORMS: the moments kept along the way
      for (let i = beads.length - 1; i >= 0; i--) {
        const b = beads[i]; b.t += dt; const a = 1 - b.t / b.life; if (a <= 0) { beads.splice(i, 1); continue; }
        const r = b.r * (.7 + .3 * a); ctx.globalAlpha = Math.min(1, a * 1.5); ctx.drawImage(atlas, b.cx, b.cy, CELL, CELL, b.x - r, b.y - r * 1.08, r * 2, r * 2.16);
      }
      ctx.globalAlpha = 1;
      for (const M of msgs) writing(M);
      // the menu's beads hang on one thread of water
      const rail = [...skins.values()].filter(U => U.el.parentElement && U.el.parentElement.id === 'dk-rail').sort((a, b) => a.y - b.y), menu = [...skins.values()].find(U => U.el.id === 'dk-menu-btn');
      if (rail.length && menu) {                                          // the menu is honey: it pours slowly from the amber drop and carries its beads
        const end = rail[rail.length - 1], path = () => { ctx.beginPath(); ctx.moveTo(menu.x, menu.y); let px = menu.x, py = menu.y; for (const U of rail) { ctx.quadraticCurveTo(px + 7 * Math.sin(T * .4 + py * .05), (py + U.y) / 2, U.x, U.y); px = U.x; py = U.y; } ctx.lineTo(end.x + 2 * Math.sin(T * .5), end.y + end.ry + 14 + 6 * Math.sin(T * .7)); };
        ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(60,24,0,.45)'; ctx.lineWidth = 15; path(); ctx.stroke();
        ctx.strokeStyle = 'rgba(232,160,40,.55)'; ctx.lineWidth = 12; path(); ctx.stroke(); ctx.strokeStyle = 'rgba(255,236,180,.7)'; ctx.lineWidth = 1.6; ctx.save(); ctx.translate(-3.5, 0); path(); ctx.stroke(); ctx.restore();
      }
      // THE POOL: where your thumb rests, the ground you walk from
      if (D.pool) { const P = D.pool, a = Math.min(1, (P.a = (P.a || 0) + dt * 6));
        water(P.x, P.y, 58 * a, 46 * a, a, null, () => blob(P.x, P.y, 58 * a, 46 * a, 1.7, .06));
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1; for (let i = 0; i < 2; i++) { const u = (T * .5 + i * .5) % 1; ctx.globalAlpha = (1 - u) * .8; ctx.beginPath(); ctx.ellipse(P.x, P.y, 58 * (.3 + u * .75), 46 * (.3 + u * .75), 0, 0, 6.2832); ctx.stroke(); } ctx.restore();
        lens(P.x + P.kx * 40, P.y + P.ky * 32, 15, 15, 1, Math.hypot(P.kx, P.ky) > .93 ? 'rgba(56,232,255,.3)' : null); }
      else if (D.hint) { ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; beaded(D.hint, 22, H - 96, 21, .8 + .2 * Math.sin(T * 1.4)); ctx.restore(); }
      // WATER IN YOUR HAND: a strand drawn from one drop toward another
      if (D.drag && D.drag.moved) { const G = D.drag, U = G.U, mx = (U.x + finger.x) / 2 + (finger.y - U.y) * .12, my = (U.y + finger.y) / 2 + 14;
        ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,8,14,.3)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(U.x, U.y); ctx.quadraticCurveTo(mx, my, finger.x, finger.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(190,240,255,.34)'; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(U.x - 2, U.y); ctx.quadraticCurveTo(mx - 2, my, finger.x - 2, finger.y); ctx.stroke();
        lens(finger.x, finger.y, 13, 15, 1, 'rgba(56,232,255,.18)'); }
      // THE PANE: loose water
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.t += dt;
        if (d.grow < 1) d.grow = Math.min(1, d.grow + dt * 3);
        if (d.state === 'hold' && !d.held) {
          if (d.t > d.life || d.r > R_RUN) { d.state = 'fall'; d.vy = 12; }
          else if (d.amb && D.rain < .15) { d.m *= 1 - dt * .12; d.r = rOf(d.m); if (d.r < 1.1) d.state = 'gone'; }
        }
        if (d.state === 'fall') {
          const vis = d.visc || (d.slow ? 4 : 1);                                               // honey is slow and does not wander; water is quick
          d.vy = Math.min(560 / vis, d.vy + (150 + d.r * 22) / vis * dt);
          let pull = 0, wet = 0;
          for (let k = wetPts.length - 1, n = 0; k >= 0 && n < 90; k--, n++) { const b = wetPts[k], dy = b.y - d.y; if (b.t < 6 && dy > 0 && dy < 30 && Math.abs(b.x - d.x) < 20) { pull += (b.x - d.x); wet++; } }
          d.vx += ((wet ? pull / wet * 7 : Math.sin(d.t * 5 / (d.visc || 1) + d.wob) * (d.slow ? 34 : 24 / (d.visc || 1))) - d.vx) * dt * 4; if (wet) d.vy += 120 * dt;
          d.x += (d.vx + D.wind * (d.visc ? .1 : .6)) * dt; d.y += d.vy * dt;                 // the wind leans the rain
          for (const o of drops) if (o !== d && o.state === 'hold' && !o.held && Math.hypot(o.x - d.x, o.y - d.y) < o.r + d.r) { d.m += o.m; d.r = rOf(d.m); d.x += (o.x - d.x) * .25; o.state = 'gone'; }
          for (const U of skins.values()) if (!d.forced && Math.abs(d.x - U.x) < U.rx * .9 && Math.abs(d.y - U.y) < U.ry * .9) { U.swell = Math.min(1, U.swell + .7); U.wetq += .3; d.state = 'gone'; }   // a stubborn drop swallows it
          if (!d.trail) d.trail = newStreak(Math.max(2.2, d.r * (d.cells ? 1.5 : d.visc ? 1.25 : .9)), d.cells ? 16 : d.visc ? 14 : 6 + Math.random() * 4, d.visc ? '240,180,70' : null);
          if (Math.hypot(d.x - (d.lpx ?? -1e9), d.y - (d.lpy ?? -1e9)) > 5) {
            d.lpx = d.x; d.lpy = d.y; streakPt(d.trail, d.x, d.y - d.r * .6); d.steps = (d.steps || 0) + 1;
            if (d.cells) { if (d.steps % 5 === 2 && d.cells.length) bead(d.x, d.y - d.r, 12, 15 + Math.random() * 4, d.cells.shift()); if (!d.cells.length && d.steps > 60) d.cells = null; }   // the action, frame by frame
            else if (d.steps % 2 === 0) { const br = Math.min(d.r * .55, 1.6 + Math.random() * 2.6); bead(d.x + (Math.random() - .5) * d.r * .3, d.y - d.r, br, 5 + Math.random() * 6); d.m = Math.max(.2, d.m - mOf(br) * .7); d.r = rOf(d.m); }
            if (!d.cells && !d.slow) { if (d.r < R_STOP && !d.forced && d.amb) { d.state = 'hold'; d.vy = 0; d.t = 0; d.life = 1e9; d.trail = null; } else if (d.r < 2.2) d.state = 'gone'; }
          }
          if (d.y - d.r > H) d.state = 'gone';
        }
        if (d.state === 'gone') { drops.splice(i, 1); continue; }
        const g = d.grow * (2 - d.grow), stretch = d.state === 'fall' ? 1 + Math.min(.55, d.vy / 700) : 1 + .04 * Math.sin(d.t * 2.2 + d.wob);
        lens(d.x, d.y, d.r * g / Math.sqrt(stretch), d.r * g * stretch, d.a, d.tint);
      }
      // the stubborn ones, over everything loose
      for (const U of skins.values()) drawSkin(U, dt);
      // SMOKE
      for (let i = wisps.length - 1; i >= 0; i--) {
        const w = wisps[i]; w.t += dt; const u = w.t / w.life; if (u >= 1) { wisps.splice(i, 1); continue; }
        w.x += (w.vx + Math.sin(w.t * 3 + w.r) * 9) * dt; w.y += w.vy * dt; w.vy *= 1 - dt * .5; const r = w.r * (1 + u * 3.4), a = (u < .15 ? u / .15 : 1 - u) * .36, c = w.rgb.join(',');
        const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, r); g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, 6.2832); ctx.fill();
      }
      // BLOOM
      if (D.bloomT > 0) {
        D.bloomT = Math.max(0, D.bloomT - dt * 1.9); const u = 1 - D.bloomT, a = D.bloomT * D.bloomT * .7;
        const g = ctx.createRadialGradient(W / 2, H * (.42 + .18 * u), 10, W / 2, H * (.42 + .18 * u), Math.max(W, H) * (.25 + .6 * u));
        g.addColorStop(0, `rgba(255,252,240,${a})`); g.addColorStop(1, 'rgba(255,252,240,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    }
    return Object.assign(D, { frame, drop, wisp, say, size: () => [W, H] });
  };
})();
