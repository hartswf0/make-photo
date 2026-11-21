// A small water kit for the stepping-stone demos: a stage, a painted dusk scene, a marching-squares membrane, glass drops, splash.
// No game, no dependencies. Each demo is one idea in isolation.
(() => {
const K = window.Water = {}, clamp = K.clamp = (v, a, b) => Math.max(a, Math.min(b, v)), TAU = Math.PI * 2;
K.lerp = (a, b, t) => a + (b - a) * t;
K.stage = draw => {
  const cv = document.querySelector('canvas'), g = cv.getContext('2d'), st = { W: 0, H: 0, t: 0, used: false, ptr: { x: -999, y: -999, x0: 0, y0: 0, down: false, t0: 0, moved: 0 }, on: {} };
  const size = () => { const d = st.dpr = Math.min(2, devicePixelRatio || 1); st.W = innerWidth; st.H = innerHeight; cv.width = Math.round(st.W * d); cv.height = Math.round(st.H * d); st.ground = st.H * .66; st.on.size && st.on.size(st); };
  addEventListener('resize', size); size();
  cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch { } Object.assign(st.ptr, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, down: true, t0: performance.now(), moved: 0 }); st.used = true; st.on.down && st.on.down(st.ptr); });
  cv.addEventListener('pointermove', e => { const p = st.ptr; p.dx = e.clientX - p.x; p.dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; if (p.down) { p.moved = Math.max(p.moved, Math.hypot(p.x - p.x0, p.y - p.y0)); st.on.move && st.on.move(p); } });
  const up = e => { const p = st.ptr; if (!p.down) return; p.down = false; st.on.up && st.on.up(p); if (p.moved < 12 && performance.now() - p.t0 < 420) st.on.tap && st.on.tap(p); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  let last = performance.now(); const frame = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; st.t += dt; g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); draw(g, st, dt); K.fx(g, st, dt); requestAnimationFrame(frame); }; requestAnimationFrame(frame);
  return st;
};
// ---- the scene: dusk, hills, wet ground, the game's thin cyan rain -----------------------------------------------------
const streaks = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), l: .02 + Math.random() * .05, v: .5 + Math.random() * .5 }));
K.scene = (g, st, o = {}) => {
  const { W, H, ground } = st, pan = o.pan || 0, sky = g.createLinearGradient(0, 0, 0, ground); sky.addColorStop(0, '#1b2430'); sky.addColorStop(.6, '#33414f'); sky.addColorStop(1, '#5d6a72'); g.fillStyle = sky; g.fillRect(0, 0, W, ground + 2);
  const hill = (y, a, f, col, par) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, ground + 2); for (let x = 0; x <= W; x += 12) g.lineTo(x, y + Math.sin((x + pan * par) * f) * a + Math.sin((x + pan * par) * f * 2.3 + 1) * a * .4); g.lineTo(W, ground + 2); g.fill(); };
  hill(ground - H * .16, 22, .006, '#2a3540', .25); hill(ground - H * .07, 14, .011, '#232d36', .5);
  const gr = g.createLinearGradient(0, ground, 0, H); gr.addColorStop(0, '#22303c'); gr.addColorStop(1, '#101a24'); g.fillStyle = gr; g.fillRect(0, ground, W, H - ground);
  g.strokeStyle = 'rgba(110,235,245,.5)'; g.lineWidth = 1; g.beginPath(); const n = Math.round(streaks.length * (o.rain ?? .5));
  for (let i = 0; i < n; i++) { const s = streaks[i]; s.y += s.v * .012; if (s.y > 1) { s.y = -s.l; s.x = Math.random(); } g.moveTo(s.x * W, s.y * H); g.lineTo(s.x * W, (s.y + s.l) * H); } g.stroke();
};
K.pump = (g, x, y, s = 1) => { g.fillStyle = '#1f5fae'; g.fillRect(x - 9 * s, y - 78 * s, 18 * s, 78 * s); g.fillRect(x - 9 * s, y - 66 * s, 40 * s, 9 * s); g.fillRect(x + 25 * s, y - 66 * s, 7 * s, 16 * s); g.fillStyle = '#17487f'; g.fillRect(x - 30 * s, y - 86 * s, 34 * s, 6 * s);
  g.fillStyle = '#2b3944'; g.fillRect(x + 8 * s, y - 24 * s, 62 * s, 24 * s); g.fillStyle = '#39e0ee'; g.fillRect(x + 13 * s, y - 20 * s, 52 * s, 8 * s); };
K.donkey = (g, x, y, s = 1, down) => { g.save(); g.translate(x, y); if (down) { g.translate(0, -8 * s); g.rotate(.5); } g.fillStyle = '#4d4c45'; g.beginPath(); g.ellipse(0, -46 * s, 42 * s, 20 * s, 0, 0, TAU); g.fill();
  for (const lx of [-30, -18, 18, 30]) g.fillRect((lx - 4) * s, -34 * s, 8 * s, 34 * s); g.beginPath(); g.ellipse(48 * s, -64 * s, 16 * s, 11 * s, -.5, 0, TAU); g.fill(); g.fillRect(34 * s, -62 * s, 14 * s, 22 * s);
  g.fillRect(44 * s, -92 * s, 5 * s, 22 * s); g.fillRect(53 * s, -90 * s, 5 * s, 20 * s); g.fillStyle = '#124854'; g.fillRect(-16 * s, -64 * s, 24 * s, 16 * s); g.restore(); };
K.person = (g, x, y, s = 1, col = '#8a4a2c') => { g.fillStyle = col; g.beginPath(); g.moveTo(x - 20 * s, y); g.quadraticCurveTo(x - 24 * s, y - 70 * s, x, y - 92 * s); g.quadraticCurveTo(x + 24 * s, y - 70 * s, x + 20 * s, y); g.fill(); g.fillStyle = '#2a1c16'; g.beginPath(); g.arc(x, y - 100 * s, 12 * s, 0, TAU); g.fill(); };
K.wall = (g, x, y, s = 1) => { g.fillStyle = '#3a444c'; g.fillRect(x - 46 * s, y - 96 * s, 92 * s, 96 * s); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(x - 46 * s, y - i * 16 * s); g.lineTo(x + 46 * s, y - i * 16 * s); g.stroke(); } };
K.can = (g, x, y, s = 1, fill = 0) => { g.fillStyle = '#1b6fc0'; g.fillRect(x - 11 * s, y - 28 * s, 22 * s, 28 * s); g.fillRect(x - 4 * s, y - 34 * s, 10 * s, 7 * s); g.fillStyle = 'rgba(90,240,250,.9)'; const h = 24 * s * clamp(fill, 0, 1); g.fillRect(x - 8 * s, y - 2 * s - h, 16 * s, h); };
// ---- one membrane: every body of water summed and contoured with marching squares, soft, never outlined --------------------
let F = null, low = null, img = null;
K.membrane = (g, st, src, o = {}) => {
  const { W, H } = st, cell = W < 700 ? 6 : 9, cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1; if (!src.length) return;
  if (!F || F.length !== cols * rows) { F = new Float32Array(cols * rows); low = document.createElement('canvas'); low.width = cols; low.height = rows; img = low.getContext('2d').createImageData(cols, rows); }
  F.fill(0);
  for (const s of src) { const x = s[0], y = s[1], rx = s[2], ry = s[3] || s[2], c0 = Math.max(0, Math.floor((x - rx * 3) / cell)), c1 = Math.min(cols - 1, Math.ceil((x + rx * 3) / cell)), r0 = Math.max(0, Math.floor((y - ry * 3) / cell)), r1 = Math.min(rows - 1, Math.ceil((y + ry * 3) / cell));
    for (let r = r0; r <= r1; r++) { const dy = (r * cell - y) / ry, dy2 = dy * dy; for (let c = c0; c <= c1; c++) { const dx = (c * cell - x) / rx, d2 = dx * dx + dy2; if (d2 < 9) F[r * cols + c] += 1 / (d2 + .06) - .11; } } }
  const d = img.data, tone = o.tone || [150, 228, 236], A = o.alpha ?? 60; for (let i = 0; i < F.length; i++) { const t = clamp((F[i] - .7) / .7, 0, 1), a = t * t * (3 - 2 * t); d[i * 4] = tone[0]; d[i * 4 + 1] = tone[1]; d[i * 4 + 2] = tone[2]; d[i * 4 + 3] = a * A; }
  low.getContext('2d').putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(low, -cell / 2, -cell / 2, cols * cell, rows * cell);
  const T = 1, L = (a, b) => (T - a) / (b - a); g.beginPath();
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) { const i = r * cols + c, a = F[i], b = F[i + 1], cc = F[i + cols + 1], dd = F[i + cols], k = (a > T ? 8 : 0) | (b > T ? 4 : 0) | (cc > T ? 2 : 0) | (dd > T ? 1 : 0); if (k === 0 || k === 15) continue;
    const x = c * cell, y = r * cell, tp = [x + L(a, b) * cell, y], rt = [x + cell, y + L(b, cc) * cell], bt = [x + L(dd, cc) * cell, y + cell], lf = [x, y + L(a, dd) * cell], S = (p, q) => { g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); };
    switch (k) { case 1: case 14: S(lf, bt); break; case 2: case 13: S(bt, rt); break; case 3: case 12: S(lf, rt); break; case 4: case 11: S(tp, rt); break; case 6: case 9: S(tp, bt); break; case 7: case 8: S(tp, lf); break; case 5: S(tp, lf); S(bt, rt); break; case 10: S(tp, rt); S(lf, bt); break; } }
  g.lineCap = 'round'; g.shadowColor = 'rgba(200,248,250,.6)'; g.shadowBlur = 8; g.lineWidth = 2; g.strokeStyle = 'rgba(206,250,250,.10)'; g.stroke(); g.shadowBlur = 0;
};
// a glass drop: soft body, one highlight, optional level and a word or number
K.drop = (g, x, y, r, o = {}) => {
  const a = o.alpha ?? 1, tone = o.tone || '170,236,242'; g.save(); g.globalAlpha = a;
  const b = g.createRadialGradient(x - r * .3, y - r * .35, r * .1, x, y, r * 1.05); b.addColorStop(0, `rgba(${tone},.34)`); b.addColorStop(.6, `rgba(${tone},.12)`); b.addColorStop(1, `rgba(${tone},0)`); g.fillStyle = b; g.beginPath(); g.arc(x, y, r * 1.05, 0, TAU); g.fill();
  if (o.fill != null) { g.save(); g.beginPath(); g.arc(x, y, r * .86, 0, TAU); g.clip(); g.fillStyle = `rgba(${tone},.30)`; const h = r * 1.72 * clamp(o.fill, 0, 1); g.fillRect(x - r, y + r * .86 - h, r * 2, h); g.restore(); }
  g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(x - r * .38, y - r * .46, r * .17, r * .08, -.6, 0, TAU); g.fill();
  if (o.text) K.ink(g, o.text, x, y + (o.sub ? -2 : r * .12), 1, o.size || Math.max(13, r * .55), 'center', o.color);
  if (o.sub) K.ink(g, o.sub, x, y + r * .46, .8, Math.max(10, r * .3), 'center', o.color);
  g.restore();
};
K.ink = (g, text, x, y, a = 1, size = 16, align = 'center', color = '#eef6f2') => { g.save(); g.globalAlpha *= a; g.font = `italic ${size}px Georgia,'Iowan Old Style',serif`; g.textAlign = align; g.lineWidth = 3; g.strokeStyle = 'rgba(3,16,22,.75)'; g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y); g.restore(); };
// ---- splash and falling drops ------------------------------------------------------------------------------------------
const parts = [], rings = [], falls = [];
K.parts = parts;
K.splash = (x, y, k = 1, tone = '178,247,240') => { for (let i = 0; i < 3; i++) rings.push({ x, y, r: 4 + i * 5, v: (210 - i * 55) * k, a: .85 - i * .2, tone, w: 2.6 - i * .6 });
  const n = Math.round(10 + 10 * k); for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.25, sp = (150 + Math.random() * 260) * k; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1.2 + Math.random() * 2.6, life: 0, ttl: .55 + Math.random() * .5, tone }); }
  if (navigator.vibrate && k > 1.2) { try { navigator.vibrate(8); } catch { } } };
K.fall = (x, ty, o = {}) => falls.push({ x, y: o.from ?? -20, ty, v: 420, vx: o.vx || 0, tone: o.tone || '200,248,250', k: o.k ?? .5 });
K.fx = (g, st, dt) => { g.lineCap = 'round';
  for (const f of falls) { f.v += 1500 * dt; f.y += f.v * dt; f.x += f.vx * dt; if (f.y >= f.ty) { f.done = true; K.splash(f.x, f.ty, f.k, f.tone); continue; } g.strokeStyle = `rgba(${f.tone},.8)`; g.lineWidth = 2.2; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x - f.vx * .05, f.y - Math.min(46, f.v * .05)); g.stroke(); }
  for (const r of rings) { r.r += r.v * dt; r.v *= Math.pow(.05, dt); r.a -= dt * 1.25; if (r.a <= 0) continue; g.strokeStyle = `rgba(${r.tone},${r.a})`; g.lineWidth = r.w; g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * .42, 0, 0, TAU); g.stroke(); }
  for (const p of parts) { p.life += dt; p.vy += 1150 * dt; p.x += p.vx * dt; p.y += p.vy * dt; const a = 1 - p.life / p.ttl; if (a <= 0) continue; g.strokeStyle = `rgba(${p.tone},${a * .9})`; g.lineWidth = p.r * 2; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * .022, p.y - p.vy * .022); g.stroke(); }
  for (const arr of [falls, rings, parts]) for (let i = arr.length - 1; i >= 0; i--) { const o = arr[i]; if (o.done || o.a <= 0 || (o.ttl && o.life >= o.ttl)) arr.splice(i, 1); } };
// the only words a demo is allowed at rest: its name, and one line that dries after the first touch
K.chrome = (g, st, name, hint) => { K.ink(g, name, 18, st.H - 20, .55, 15, 'left'); st.hintA = K.lerp(st.hintA ?? 1, st.used ? 0 : 1, .03); if (st.hintA > .02) K.ink(g, hint, st.W / 2, st.H * .14, st.hintA, 17); };
K.near = (p, x, y, r) => Math.hypot(p.x - x, p.y - y) < r;
})();
