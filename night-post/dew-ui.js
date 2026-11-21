/* Dew on the glass: the interface of the Ahiya demo as water on the lens.
   A drop is a small lens: it shows the world behind it, upside down and magnified, as real dew does.
   A message condenses beside whoever speaks, holds while they speak, then lets go and runs down the glass,
   leaving a track of beads that fades. New drops fall; old drops fade. What is refused or only narrated
   does not fall: it leaves as smoke. In the rain, the lens itself gets wet.
   The layer never takes a touch (pointer-events: none) and draws nothing when the glass is dry. */
(function () {
  window.makeDew = function (game) {
    const cv = document.createElement('canvas'); cv.id = 'dew-glass';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:61';
    document.body.append(cv);
    const text = document.createElement('div'); text.id = 'dew-text'; document.body.append(text);
    const st = document.createElement('style');
    st.textContent = `#dew-text{position:fixed;inset:0;pointer-events:none;z-index:63;font:15px/1.38 Georgia,'Iowan Old Style',serif;color:#fff}
      #dew-text p{position:absolute;margin:0;max-width:min(270px,62vw);text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 10px rgba(0,10,16,.9),0 0 22px rgba(0,10,16,.7);transition:opacity .7s,filter .7s;opacity:0;filter:blur(3px)}
      #dew-text p.on{opacity:1;filter:none}#dew-text p b{display:block;font:600 10.5px system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#bfe9f2;margin-bottom:1px}
      #dew-text p.me{font-style:italic;color:#d8f6ff}`;
    document.head.append(st);
    const ctx = cv.getContext('2d'), snap = document.createElement('canvas'), sctx = snap.getContext('2d');
    let W = 0, H = 0, dpr = 1, snapAge = 9, dirty = false;
    function size() {
      dpr = Math.min(1.5, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); snap.width = Math.max(64, Math.round(W / 3)); snap.height = Math.max(64, Math.round(H / 3));
    }
    size(); addEventListener('resize', size);
    const drops = [], beads = [], wisps = [];
    const D = { drops, beads, wisps, rain: 0, enabled: true };

    /* one small copy of the world per frame; every lens samples it (cheap), flipped as a drop flips it */
    function snapshot() { try { sctx.drawImage(game, 0, 0, snap.width, snap.height); } catch (e) { } snapAge = 0; }
    function lens(x, y, rx, ry, a, tint) {
      const k = snap.width / W, m = 1.9;                               // a drop shows a wider field than it covers
      ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832); ctx.clip();
      ctx.translate(x, y); ctx.scale(-1, -1);
      ctx.drawImage(snap, (x - rx * m) * k, (y - ry * m) * k, rx * 2 * m * k, ry * 2 * m * k, -rx, -ry, rx * 2, ry * 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (tint) { ctx.fillStyle = tint; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2); }
      let g = ctx.createRadialGradient(x - rx * .1, y - ry * .15, Math.min(rx, ry) * .35, x, y, Math.max(rx, ry) * 1.02);   // the dark rim that makes it water
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.78, 'rgba(0,8,14,.10)'); g.addColorStop(1, 'rgba(0,6,12,.62)');
      ctx.fillStyle = g; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
      g = ctx.createRadialGradient(x + rx * .25, y + ry * .55, 0, x + rx * .25, y + ry * .55, rx * .8);                     // light gathered at the bottom
      g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
      ctx.restore();
      ctx.save(); ctx.globalAlpha = a * .9; ctx.fillStyle = 'rgba(255,255,255,.85)';                                         // the window in the drop
      ctx.beginPath(); ctx.ellipse(x - rx * .36, y - ry * .42, rx * .2, ry * .11, -.6, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = a * .5; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, rx - .5, ry - .5, 0, 0, 6.2832); ctx.stroke();
      ctx.restore();
    }
    /* ---------- a drop ---------- */
    function drop(o) {
      const d = Object.assign({ x: W / 2, y: H / 2, r: 14, grow: 0, state: 'hold', vy: 0, vx: 0, life: 1e9, t: 0, a: 1, tint: null, lastBead: 0, wob: Math.random() * 6 }, o);
      drops.push(d); dirty = true;
      d.release = () => { if (d.state === 'hold') { d.state = 'fall'; d.vy = 20; } };
      d.smoke = () => { if (d.state !== 'gone') { for (let i = 0; i < 9; i++) wisp(d.x + (Math.random() - .5) * d.r, d.y + (Math.random() - .5) * d.r); d.state = 'gone'; } };
      return d;
    }
    function wisp(x, y, o = {}) {
      wisps.push(Object.assign({ x, y, vx: (Math.random() - .5) * 14, vy: -18 - Math.random() * 26, r: 5 + Math.random() * 7, t: 0, life: 1.5 + Math.random() * 1.1 }, o)); dirty = true;
    }
    /* ---------- a message: a drop with words beside it ---------- */
    function say(o) {                                                  // o: { anchor: () => [x, y] | null, name, text, me, speak: true|false }
      const p = document.createElement('p'); if (o.me) p.className = 'me';
      if (o.name) { const b = document.createElement('b'); b.textContent = o.name; p.append(b); }
      const s = document.createElement('span'); p.append(s); text.append(p); requestAnimationFrame(() => p.classList.add('on'));
      const a0 = o.anchor && o.anchor() || [W / 2, H * .4];
      const d = drop({ x: a0[0], y: a0[1], r: o.me ? 9 : 15, grow: 1, tint: o.me ? 'rgba(56,232,255,.16)' : null });
      const M = { d, p, s, full: o.text || '', shown: 0, anchor: o.anchor, me: !!o.me, done: false };
      M.set = (t, frac) => { const n = Math.ceil(t.length * Math.min(1, frac)); if (n !== M.shown || t !== M.full) { M.full = t; M.shown = n; s.textContent = t.slice(0, n); } };
      M.end = (how = 'fall') => {                                      // 'fall': it was said, it runs down the glass; 'smoke': it was refused or only narrated
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
    const msgs = [];
    /* ---------- per frame ---------- */
    let rainT = 0;
    function frame(dt) {
      if (!D.enabled) return;
      dt = Math.min(.05, dt);
      // rain on the lens: only where it is raining on you, and never many
      rainT -= dt;
      if (D.rain > .25 && rainT <= 0) {
        rainT = .9 + Math.random() * 2.2 / D.rain;
        if (drops.filter(d => d.amb).length < 7) drop({ amb: true, x: 12 + Math.random() * (W - 24), y: 60 + Math.random() * H * .5, r: 3 + Math.random() * 5, grow: 1, life: 2 + Math.random() * 5, a: .85 });
      }
      for (const M of msgs) M.place();
      for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].done) msgs.splice(i, 1);
      if (!drops.length && !beads.length && !wisps.length) { if (dirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); dirty = false; } return; }
      dirty = true; snapAge += dt; if (snapAge > .033) snapshot();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      // tracks: beads a drop left behind, thinning until the glass is dry again
      for (let i = beads.length - 1; i >= 0; i--) {
        const b = beads[i]; b.t += dt; const a = 1 - b.t / b.life; if (a <= 0) { beads.splice(i, 1); continue; }
        if (b.r > 2.4) lens(b.x, b.y, b.r, b.r * 1.15, a * .9);
        else { ctx.fillStyle = `rgba(255,255,255,${.5 * a})`; ctx.beginPath(); ctx.arc(b.x - b.r * .2, b.y - b.r * .2, b.r * .55, 0, 6.2832); ctx.fill();
          ctx.fillStyle = `rgba(0,10,16,${.35 * a})`; ctx.beginPath(); ctx.arc(b.x + b.r * .15, b.y + b.r * .3, b.r * .8, 0, 6.2832); ctx.fill(); }
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.t += dt;
        if (d.grow < 1) d.grow = Math.min(1, d.grow + dt * 3);
        if (d.state === 'hold' && d.t > d.life) d.release();
        if (d.state === 'fall') {
          d.vy = Math.min(520, d.vy + (260 + d.r * 16) * dt);                                    // heavier drops run faster
          d.vx += (Math.sin(d.t * 5 + d.wob) * 26 - d.vx) * dt * 3; d.x += d.vx * dt; d.y += d.vy * dt;   // the wander of water on glass
          if (d.y - d.lastBead > 7 + d.r * .5) { d.lastBead = d.y; const br = Math.random() < .2 ? 2.6 + Math.random() * 2 : 1 + Math.random() * 1.3;
            if (beads.length > 110) beads.shift();
            beads.push({ x: d.x + (Math.random() - .5) * d.r * .5, y: d.y - d.r, r: Math.min(br, d.r * .5), t: 0, life: 4 + Math.random() * 5 }); d.r = Math.max(2.5, d.r - .05); }
          if (d.y - d.r > H) d.state = 'gone';
        }
        if (d.state === 'gone') { drops.splice(i, 1); continue; }
        const g = d.grow * (2 - d.grow), stretch = d.state === 'fall' ? 1 + Math.min(.55, d.vy / 700) : 1 + .04 * Math.sin(d.t * 2.2 + d.wob);
        lens(d.x, d.y, d.r * g / Math.sqrt(stretch), d.r * g * stretch, d.a, d.tint);
      }
      // smoke: what does not fall, leaves upward
      for (let i = wisps.length - 1; i >= 0; i--) {
        const w = wisps[i]; w.t += dt; const u = w.t / w.life; if (u >= 1) { wisps.splice(i, 1); continue; }
        w.x += (w.vx + Math.sin(w.t * 3 + w.r) * 9) * dt; w.y += w.vy * dt; w.vy *= 1 - dt * .5; const r = w.r * (1 + u * 3.2), a = (u < .15 ? u / .15 : 1 - u) * .34;
        const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, r); g.addColorStop(0, `rgba(226,238,242,${a})`); g.addColorStop(1, 'rgba(226,238,242,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, 6.2832); ctx.fill();
      }
    }
    return Object.assign(D, { frame, drop, wisp, say, msgs, size: () => [W, H] });
  };
})();
