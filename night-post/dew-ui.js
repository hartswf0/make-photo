/* Dew on the glass: the interface of the Ahiya demo as water on the lens.
   After the Afterlight screening room (bolas/afterlight/room): Dew five ways, Air, Lens.

   PANE   A drop has volume. Small drops stay pinned where they land; rain adds to them and they merge; a drop heavy
          enough lets go and runs, swallowing what it touches, following tracks that are still wet, thinning as it
          leaves beads behind until it is light enough to stop. One light is shared by every drop.
   WORMS  The track keeps the moment: each bead holds the world as it was when the drop passed.
   SMOKE  What is refused or only narrated does not fall. It leaves as smoke, coloured by the place it left.
   FLARE  The brightest thing in the shot (the beacon, when you can see it) throws a streak and a chain of ghosts.
   BREATH Your own breath fogs the bottom of the lens after you have run.
   BLOOM  Making a plate overfills the glass with light for a moment.

   A message is a drop held beside whoever speaks; when the line ends it lets go.
   The layer never takes a touch (pointer-events: none) and draws nothing when the glass is dry and dark. */
(function () {
  window.makeDew = function (game) {
    const cv = document.createElement('canvas'); cv.id = 'dew-glass';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:61';
    document.body.append(cv);
    const text = document.createElement('div'); text.id = 'dew-text'; document.body.append(text);
    const st = document.createElement('style');
    st.textContent = `#dew-text{position:fixed;inset:0;pointer-events:none;z-index:63;font:15px/1.38 Georgia,'Iowan Old Style',serif;color:#fff}
      #dew-text p{position:absolute;margin:0;text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 10px rgba(0,10,16,.9),0 0 22px rgba(0,10,16,.7);transition:opacity .7s,filter .7s;opacity:0;filter:blur(3px)}
      #dew-text p.on{opacity:1;filter:none}#dew-text p b{display:block;font:600 10.5px system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#bfe9f2;margin-bottom:1px}
      #dew-text p.me{font-style:italic;color:#d8f6ff}`;
    document.head.append(st);
    const ctx = cv.getContext('2d'), snap = document.createElement('canvas'), sctx = snap.getContext('2d', { willReadFrequently: true });
    const CELL = 20, COLS = 16, ROWS = 10, atlas = document.createElement('canvas'), actx = atlas.getContext('2d'); atlas.width = CELL * COLS; atlas.height = CELL * ROWS;
    let cell = 0, W = 0, H = 0, dpr = 1, snapAge = 9, dirty = false;
    function size() {
      dpr = Math.min(1.5, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); snap.width = Math.max(64, Math.round(W / 3)); snap.height = Math.max(64, Math.round(H / 3));
    }
    size(); addEventListener('resize', size);
    const drops = [], beads = [], wisps = [], msgs = [];
    const D = { drops, beads, wisps, msgs, rain: 0, enabled: true, light: null, flare: 0, breath: 0, bloomT: 0 };
    const RK = 2.1, rOf = m => RK * Math.cbrt(m), mOf = r => Math.pow(r / RK, 3);          // volume <-> the radius you see
    const R_RUN = 7.6, R_STOP = 3.0;

    /* one small copy of the world per frame; every lens samples it, flipped as a drop flips it */
    function snapshot() { try { sctx.drawImage(game, 0, 0, snap.width, snap.height); } catch (e) { } snapAge = 0; }
    function lightDir(x, y) {                                           // one light for the whole pane
      const L = D.light || [W * .2, -H * .2], dx = L[0] - x, dy = L[1] - y, n = Math.hypot(dx, dy) || 1; return [dx / n, dy / n];
    }
    function lens(x, y, rx, ry, a, tint) {
      const k = snap.width / W, m = 1.9, [lx, ly] = lightDir(x, y);
      ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832); ctx.clip();
      ctx.translate(x, y); ctx.scale(-1, -1);
      ctx.drawImage(snap, (x - rx * m) * k, (y - ry * m) * k, rx * 2 * m * k, ry * 2 * m * k, -rx, -ry, rx * 2, ry * 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (tint) { ctx.fillStyle = tint; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2); }
      let g = ctx.createRadialGradient(x + lx * rx * .15, y + ly * ry * .15, Math.min(rx, ry) * .35, x, y, Math.max(rx, ry) * 1.02);   // the dark rim that makes it water
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.78, 'rgba(0,8,14,.10)'); g.addColorStop(1, 'rgba(0,6,12,.62)');
      ctx.fillStyle = g; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
      g = ctx.createRadialGradient(x - lx * rx * .5, y - ly * ry * .5, 0, x - lx * rx * .5, y - ly * ry * .5, rx * .85);               // the light it gathers, on the far side
      g.addColorStop(0, 'rgba(255,255,255,.36)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
      ctx.restore();
      ctx.save(); ctx.globalAlpha = a * .9; ctx.fillStyle = 'rgba(255,255,255,.88)';                                                    // the light itself, small, on the near side
      ctx.beginPath(); ctx.ellipse(x + lx * rx * .5, y + ly * ry * .5, Math.max(.8, rx * .2), Math.max(.6, ry * .11), Math.atan2(ly, lx) + 1.57, 0, 6.2832); ctx.fill();
      if (rx > 5) { ctx.globalAlpha = a * .5; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, rx - .5, ry - .5, 0, 0, 6.2832); ctx.stroke(); }
      ctx.restore();
    }
    /* ---------- drops ---------- */
    function drop(o) {
      const d = Object.assign({ x: W / 2, y: H / 2, r: 14, grow: 0, state: 'hold', vy: 0, vx: 0, life: 1e9, t: 0, a: 1, tint: null, lastBead: 0, wob: Math.random() * 6, held: false }, o);
      d.m = mOf(d.r); drops.push(d); dirty = true;
      d.release = () => { if (d.state === 'hold') { d.state = 'fall'; d.vy = Math.max(d.vy, 20); d.held = false; d.forced = true; } };
      d.smoke = () => { if (d.state !== 'gone') { for (let i = 0; i < 10; i++) wisp(d.x + (Math.random() - .5) * d.r, d.y + (Math.random() - .5) * d.r); d.state = 'gone'; } };
      return d;
    }
    function bead(x, y, r, life) {                                      // a worm segment: it keeps what the drop saw as it passed
      const c = cell; cell = (cell + 1) % (COLS * ROWS); const cx = (c % COLS) * CELL, cy = Math.floor(c / COLS) * CELL, k = snap.width / W, f = Math.max(r * 3.4, 7);
      actx.save(); actx.clearRect(cx, cy, CELL, CELL); actx.beginPath(); actx.arc(cx + CELL / 2, cy + CELL / 2, CELL / 2 - .5, 0, 6.2832); actx.clip();
      actx.translate(cx + CELL / 2, cy + CELL / 2); actx.scale(-1, -1);
      try { actx.drawImage(snap, (x - f) * k, (y - f) * k, f * 2 * k, f * 2 * k, -CELL / 2, -CELL / 2, CELL, CELL); } catch (e) { }
      actx.setTransform(1, 0, 0, 1, 0, 0);
      const g = actx.createRadialGradient(cx + CELL * .5, cy + CELL * .5, CELL * .2, cx + CELL * .5, cy + CELL * .5, CELL * .5);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,6,12,.6)'); actx.fillStyle = g; actx.fillRect(cx, cy, CELL, CELL);
      actx.fillStyle = 'rgba(255,255,255,.8)'; actx.beginPath(); actx.arc(cx + CELL * .34, cy + CELL * .3, CELL * .07, 0, 6.2832); actx.fill();
      actx.restore();
      if (beads.length > 150) beads.shift();
      beads.push({ x, y, r, t: 0, life, cx, cy, c });
    }
    function colourAt(x, y) { try { const d = sctx.getImageData(Math.max(0, Math.min(snap.width - 1, x * snap.width / W | 0)), Math.max(0, Math.min(snap.height - 1, y * snap.height / H | 0)), 1, 1).data; return [d[0], d[1], d[2]]; } catch (e) { return [200, 215, 220]; } }
    function wisp(x, y, o = {}) {                                       // smoke takes the colour of the moment it leaves
      const c = o.rgb || colourAt(x, y), mix = v => Math.round(v * .45 + 232 * .55);
      wisps.push(Object.assign({ x, y, vx: (Math.random() - .5) * 14, vy: -18 - Math.random() * 26, r: 5 + Math.random() * 7, t: 0, life: 1.6 + Math.random() * 1.2, rgb: [mix(c[0]), mix(c[1]), mix(c[2])] }, o)); dirty = true;
    }
    /* ---------- a message: a held drop with words beside it ---------- */
    function say(o) {                                                   // o: { anchor: () => [x, y] | null, name, text, me }
      const p = document.createElement('p'); if (o.me) p.className = 'me';
      if (o.name) { const b = document.createElement('b'); b.textContent = o.name; p.append(b); }
      const s = document.createElement('span'); p.append(s); text.append(p); requestAnimationFrame(() => p.classList.add('on'));
      const a0 = o.anchor && o.anchor() || [W / 2, H * .4];
      const d = drop({ x: a0[0], y: a0[1], r: o.me ? 9 : 15, grow: 0, held: true, tint: o.me ? 'rgba(56,232,255,.16)' : null });
      const M = { d, p, s, full: o.text || '', shown: 0, anchor: o.anchor, me: !!o.me, done: false };
      M.set = (t, frac) => { const n = Math.ceil(t.length * Math.min(1, frac)); if (n !== M.shown || t !== M.full) { M.full = t; M.shown = n; s.textContent = t.slice(0, n); } };
      M.end = (how = 'fall') => {                                       // 'fall': it was said, it runs down the glass; 'smoke': refused or only narrated
        if (M.done) return; M.done = true; p.classList.remove('on'); setTimeout(() => p.remove(), 800);
        if (how === 'smoke') d.smoke(); else d.release();
      };
      M.place = () => {
        if (M.done) return; const a = M.anchor && M.anchor(); if (a) { d.x += (a[0] - d.x) * .25; d.y += (a[1] - d.y) * .25; }
        // words sit on the side of the drop with room; with no room on either side, under it
        const pw = Math.min(270, Math.round(W * .62)); p.style.width = pw + 'px'; const ph = p.offsetHeight || 40;
        const roomR = W - 8 - (d.x + d.r + 10), roomL = d.x - d.r - 10 - 8;
        if (roomR >= pw || roomL >= pw) { p.style.left = (roomR >= pw ? d.x + d.r + 10 : d.x - d.r - 10 - pw) + 'px'; p.style.textAlign = roomR >= pw ? 'left' : 'right';
          p.style.top = Math.max(54, Math.min(H - ph - 150, d.y - Math.min(ph / 2, 22))) + 'px'; }
        else { p.style.left = Math.max(8, Math.min(W - pw - 8, d.x - pw / 2)) + 'px'; p.style.textAlign = 'center'; p.style.top = Math.max(54, Math.min(H - ph - 150, d.y + d.r + 8)) + 'px'; }
      };
      msgs.push(M); return M;
    }
    D.bloom = () => { D.bloomT = 1; dirty = true; };
    /* ---------- per frame ---------- */
    let rainT = 0;
    function frame(dt) {
      if (!D.enabled) return;
      dt = Math.min(.05, dt);
      // rain lands on the lens only where it is raining on you; it lands small, and gathers
      rainT -= dt;
      if (D.rain > .2 && rainT <= 0) {
        rainT = (.1 + Math.random() * .22) / D.rain;
        const x = 8 + Math.random() * (W - 16), y = 56 + Math.random() * (H * .62), r = 1.6 + Math.random() * 2.6;
        const amb = drops.filter(d => d.amb && d.state === 'hold');
        let hit = amb.find(d => Math.hypot(d.x - x, d.y - y) < d.r + r + 3);
        if (!hit && amb.length >= 22) { let bd = 1e9; for (const d of amb) { const q = Math.hypot(d.x - x, d.y - y); if (q < bd) { bd = q; hit = d; } } }   // a beaded pane: new rain feeds what is there
        if (hit) { hit.m += mOf(r) * 1.6; hit.r = rOf(hit.m); }
        else drop({ amb: true, x, y, r, grow: .4, a: .9 });
        for (const d of amb) for (const o of amb) if (o !== d && o.state === 'hold' && d.state === 'hold' && d.m >= o.m && Math.hypot(o.x - d.x, o.y - d.y) < (o.r + d.r) * .92) {   // neighbours that touch become one
          d.x = (d.x * d.m + o.x * o.m) / (d.m + o.m); d.y = (d.y * d.m + o.y * o.m) / (d.m + o.m); d.m += o.m; d.r = rOf(d.m); o.state = 'gone'; }
      }
      for (const M of msgs) M.place();
      for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].done) msgs.splice(i, 1);
      const lit = D.flare > .02 || D.breath > .02 || D.bloomT > 0;
      if (!drops.length && !beads.length && !wisps.length && !lit) { if (dirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); dirty = false; } return; }
      dirty = true; snapAge += dt; if (snapAge > .033 && (drops.length || wisps.length)) snapshot();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      // BREATH: fog rising from the bottom edge, in the rhythm of breathing; it clears as you recover
      if (D.breath > .02) {
        const ph = .5 + .5 * Math.sin(performance.now() / 1000 * (2.4 + 2.2 * D.breath)), a = D.breath * (.16 + .2 * ph);
        const g = ctx.createRadialGradient(W / 2, H + 30, 20, W / 2, H + 30, H * (.34 + .16 * ph));
        g.addColorStop(0, `rgba(226,236,240,${a})`); g.addColorStop(.6, `rgba(226,236,240,${a * .45})`); g.addColorStop(1, 'rgba(226,236,240,0)');
        ctx.fillStyle = g; ctx.fillRect(0, H * .4, W, H * .6);
      }
      // FLARE: a streak and a chain of ghosts from the light, only while you can see it
      if (D.flare > .02 && D.light) {
        const [lx, ly] = D.light, a = D.flare, cx = W / 2, cy = H / 2;
        let g = ctx.createLinearGradient(0, 0, W, 0); const u = Math.max(0, Math.min(1, lx / W));
        g.addColorStop(0, 'rgba(120,230,255,0)'); g.addColorStop(Math.max(0, u - .001), `rgba(150,240,255,${.5 * a})`); g.addColorStop(Math.min(1, u + .001), `rgba(150,240,255,${.5 * a})`); g.addColorStop(1, 'rgba(120,230,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, ly - 1, W, 2);
        g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 46); g.addColorStop(0, `rgba(200,250,255,${.42 * a})`); g.addColorStop(1, 'rgba(200,250,255,0)'); ctx.fillStyle = g; ctx.fillRect(lx - 46, ly - 46, 92, 92);
        [[.45, 9, '160,240,255'], [.85, 16, '255,214,150'], [1.3, 26, '150,220,255'], [1.7, 12, '255,190,160']].forEach(([t, r, c]) => {
          const x = lx + (cx - lx) * t, y = ly + (cy - ly) * t; ctx.strokeStyle = `rgba(${c},${.22 * a})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke();
          ctx.fillStyle = `rgba(${c},${.07 * a})`; ctx.fill(); });
      }
      // WORMS: the track, each bead holding the moment it was left, thinning until the glass is dry
      for (let i = beads.length - 1; i >= 0; i--) {
        const b = beads[i]; b.t += dt; const a = 1 - b.t / b.life; if (a <= 0) { beads.splice(i, 1); continue; }
        const r = b.r * (.6 + .4 * a); ctx.globalAlpha = Math.min(1, a * 1.4); ctx.drawImage(atlas, b.cx, b.cy, CELL, CELL, b.x - r, b.y - r * 1.12, r * 2, r * 2.24);
      }
      ctx.globalAlpha = 1;
      // PANE
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.t += dt;
        if (d.grow < 1) d.grow = Math.min(1, d.grow + dt * 3);
        if (d.state === 'hold' && !d.held) {
          if (d.t > d.life || d.r > R_RUN) { d.state = 'fall'; d.vy = 12; }                     // heavy enough: it lets go
          else if (d.amb && D.rain < .15) { d.m *= 1 - dt * .12; d.r = rOf(d.m); if (d.r < 1.1) d.state = 'gone'; }   // out of the rain the glass dries
        }
        if (d.state === 'fall') {
          d.vy = Math.min(560, d.vy + (150 + d.r * 22) * dt);                                  // heavier drops run faster
          let pull = 0, wet = 0;                                                               // a wet track is the easy way down
          for (let k = beads.length - 1, n = 0; k >= 0 && n < 40; k--, n++) { const b = beads[k], dy = b.y - d.y; if (dy > 0 && dy < 26 && Math.abs(b.x - d.x) < 16) { pull += (b.x - d.x); wet++; } }
          d.vx += ((wet ? pull / wet * 6 : Math.sin(d.t * 5 + d.wob) * 24) - d.vx) * dt * 4; if (wet) d.vy += 120 * dt;
          d.x += d.vx * dt; d.y += d.vy * dt;
          for (const o of drops) if (o !== d && o.state === 'hold' && !o.held && Math.hypot(o.x - d.x, o.y - d.y) < o.r + d.r) { d.m += o.m; d.r = rOf(d.m); d.x += (o.x - d.x) * .25; o.state = 'gone'; }   // merge
          if (d.y - d.lastBead > 6 + d.r * .5) {
            d.lastBead = d.y; const br = Math.min(d.r * .5, Math.random() < .22 ? 2.8 + Math.random() * 2.2 : 1.3 + Math.random() * 1.4);
            bead(d.x + (Math.random() - .5) * d.r * .4, d.y - d.r, br, 5 + Math.random() * 6); d.m = Math.max(.2, d.m - mOf(br) * .8); d.r = rOf(d.m);
            if (d.r < R_STOP && !d.forced && d.amb) { d.state = 'hold'; d.vy = 0; d.t = 0; d.life = 1e9; }   // too light to run: it pins again
            else if (d.r < 2.2) d.state = 'gone';
          }
          if (d.y - d.r > H) d.state = 'gone';
        }
        if (d.state === 'gone') { drops.splice(i, 1); continue; }
        const g = d.grow * (2 - d.grow), stretch = d.state === 'fall' ? 1 + Math.min(.55, d.vy / 700) : 1 + .04 * Math.sin(d.t * 2.2 + d.wob);
        lens(d.x, d.y, d.r * g / Math.sqrt(stretch), d.r * g * stretch, d.a, d.tint);
      }
      // SMOKE
      for (let i = wisps.length - 1; i >= 0; i--) {
        const w = wisps[i]; w.t += dt; const u = w.t / w.life; if (u >= 1) { wisps.splice(i, 1); continue; }
        w.x += (w.vx + Math.sin(w.t * 3 + w.r) * 9) * dt; w.y += w.vy * dt; w.vy *= 1 - dt * .5; const r = w.r * (1 + u * 3.4), a = (u < .15 ? u / .15 : 1 - u) * .36, c = w.rgb.join(',');
        const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, r); g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, 6.2832); ctx.fill();
      }
      // BLOOM: the charge spills and runs down
      if (D.bloomT > 0) {
        D.bloomT = Math.max(0, D.bloomT - dt * 1.9); const u = 1 - D.bloomT, a = D.bloomT * D.bloomT * .7;
        const g = ctx.createRadialGradient(W / 2, H * (.42 + .18 * u), 10, W / 2, H * (.42 + .18 * u), Math.max(W, H) * (.25 + .6 * u));
        g.addColorStop(0, `rgba(255,252,240,${a})`); g.addColorStop(1, 'rgba(255,252,240,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    }
    return Object.assign(D, { frame, drop, wisp, say, size: () => [W, H] });
  };
})();
