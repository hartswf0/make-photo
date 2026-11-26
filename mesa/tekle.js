/* The Hall of Liberation: our own triptych in the manner of Afewerk Tekle's stained glass (Total Liberation of Africa, Africa Hall,
   1961). Not a copy of it: a hand-built composition, painted in code on three canvases, keeping what his glass is made of:
     - jewel-tone glass laid as a mosaic of small irregular pieces;
     - the heavy lead treated as drawing: long calligraphic sweeps that cut across the figures, over a rhythm of structural bars;
     - figures in the Ethiopian manner: large dark eyes, white shamma with tibeb borders, a crowd behind;
     - the three movements: then (cool, fractured, a dark sun, chains), then-and-now (a torchbearer raising the flame against a
       burst of broken light), now-and-the-future (gold, red and green, a rising sun, arms raised, the tools and towers of what comes).
   MesaTekle.paint(T) -> [CanvasTexture x3]; MesaTekle.hall(T, { x, z, y, W, H }) -> { group, panels, torch, door }. */
(() => {
  "use strict";
  const frac = x => x - Math.floor(x), hash = (a, b = 0) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
  const W = 512, H = 1024;
  function mosaic(q, pal, seed, cell = 22) { /* small irregular pieces: a jittered grid, each square split into two triangles of nearby colours */
    for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) { const j = (a, b) => [x + (hash(x + a, y + seed) - .5) * cell * .5 + a * cell, y + (hash(y + b, x + seed) - .5) * cell * .5 + b * cell];
      const p = [j(0, 0), j(1, 0), j(1, 1), j(0, 1)], split = hash(x, y + seed * 7) > .5;
      for (const tri of split ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]]) { const yy = y / H, k = Math.floor(hash(x * 3 + tri[1], y + seed) * pal.length);
        q.fillStyle = typeof pal === "function" ? pal(x / W, yy, hash(x + tri[0], y * 2 + seed)) : pal[k]; q.beginPath(); q.moveTo(...p[tri[0]]); q.lineTo(...p[tri[1]]); q.lineTo(...p[tri[2]]); q.closePath(); q.fill(); } }
    q.strokeStyle = "rgba(24,16,10,.55)"; q.lineWidth = 1.6; for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) { if (hash(x, y + seed * 3) > .45) { q.beginPath(); q.moveTo(x, y); q.lineTo(x + cell, y + cell * (hash(y, x) > .5 ? 1 : 0)); q.stroke(); } } }
  function lead(q, seed, sweeps = 7) { /* the bars, then the calligraphic sweeps over everything */
    q.strokeStyle = "#140d08"; q.lineWidth = 9; for (let k = 1; k < 4; k++) { q.beginPath(); q.moveTo(k * W / 4, 0); q.lineTo(k * W / 4, H); q.stroke(); } for (let k = 1; k < 7; k++) { q.beginPath(); q.moveTo(0, k * H / 7); q.lineTo(W, k * H / 7); q.stroke(); }
    for (let s = 0; s < sweeps; s++) { const x0 = hash(s, seed) * W, y0 = hash(seed, s) * H * .3, x1 = hash(s + 9, seed) * W, y1 = H * (.6 + hash(s, seed + 2) * .4); q.lineWidth = 5 + hash(s, 4) * 8; q.beginPath(); q.moveTo(x0, y0); q.bezierCurveTo(x0 + (x1 - x0) * .2 + 120 * (hash(s, 5) - .5), (y0 + y1) * .35, x1 - 160 * (hash(s, 6) - .5), (y0 + y1) * .7, x1, y1); q.stroke(); } }
  function face(q, x, y, s, skin = "#6a3820") { /* the Ethiopian icon's face: a long oval, a cap of hair, large dark eyes looking out */
    q.fillStyle = "#1a120c"; q.beginPath(); q.ellipse(x, y - s * .3, s * 1.0, s * .85, 0, 0, Math.PI * 2); q.fill();
    q.fillStyle = skin; q.beginPath(); q.ellipse(x, y + s * .1, s * .62, s * .82, 0, 0, Math.PI * 2); q.fill();
    for (const e of [-1, 1]) { q.fillStyle = "#f4efe2"; q.beginPath(); q.ellipse(x + e * s * .27, y - s * .05, s * .16, s * .1, 0, 0, Math.PI * 2); q.fill(); q.fillStyle = "#120c08"; q.beginPath(); q.arc(x + e * s * .27, y - s * .05, s * .075, 0, Math.PI * 2); q.fill(); }
    q.strokeStyle = "#2a1408"; q.lineWidth = s * .06; q.beginPath(); q.moveTo(x, y); q.lineTo(x - s * .05, y + s * .3); q.lineTo(x + s * .06, y + s * .32); q.stroke(); q.beginPath(); q.moveTo(x - s * .18, y + s * .5); q.lineTo(x + s * .18, y + s * .5); q.stroke(); }
  function robe(q, x, y, w, h, sash) { /* white shamma in broken glass, a tibeb border, a coloured sash */
    for (let k = 0; k < 40; k++) { const px = x - w / 2 + hash(k, x) * w, py = y + hash(x, k) * h; q.fillStyle = ["#f4f1e8", "#dfe6ea", "#c8d8e0", "#eef0e6"][k % 4]; q.beginPath(); q.moveTo(px, py); q.lineTo(px + 18 + hash(k, 3) * 20, py + 6); q.lineTo(px + 6, py + 26 + hash(k, 4) * 20); q.closePath(); q.fill(); }
    q.fillStyle = sash || "#2a9a5a"; q.beginPath(); q.moveTo(x - w * .3, y); q.lineTo(x - w * .15, y); q.lineTo(x + w * .2, y + h); q.lineTo(x + w * .05, y + h); q.closePath(); q.fill();
    for (let k = 0; k < 8; k++) { q.fillStyle = ["#d8342c", "#f2c84a", "#2a4ab8"][k % 3]; q.fillRect(x - w * .27 + k * w * .045, y + k * h / 8, 6, 8); }
    q.strokeStyle = "#140d08"; q.lineWidth = 3; q.strokeRect(x - w / 2, y, w, h); }
  function paint(T) {
    const out = [];
    /* I. Then: cool and fractured; a dark sun, chains, bowed heads */
    { const c = document.createElement("canvas"); c.width = W; c.height = H; const q = c.getContext("2d");
      mosaic(q, (u, v, r) => ["#1e2e5a", "#2a3a70", "#3a4a62", "#4a5a6a", "#22243a", "#5a5a72", "#2a4a6a"][Math.floor(r * 7)], 11);
      q.fillStyle = "#14141e"; q.beginPath(); q.arc(W * .68, H * .16, 70, 0, Math.PI * 2); q.fill(); q.strokeStyle = "#6a6a80"; q.lineWidth = 5; q.stroke();
      for (let k = 0; k < 5; k++) { const x = 70 + k * 92, y = H * .55 + (k % 2) * 40; robe(q, x, y + 60, 74, 300, "#3a3a5a"); face(q, x, y + 20, 34, "#4a2a18"); }
      q.strokeStyle = "#8a8a98"; q.lineWidth = 7; for (let k = 0; k < 12; k++) { q.beginPath(); q.ellipse(60 + k * 36, H * .74, 16, 10, (k % 2) * Math.PI / 2, 0, Math.PI * 2); q.stroke(); }
      lead(q, 3, 9); out.push(c); }
    /* II. Then and now: the torchbearer, the flame, broken light bursting out behind */
    { const c = document.createElement("canvas"); c.width = W; c.height = H; const q = c.getContext("2d");
      mosaic(q, (u, v, r) => { const d = Math.hypot(u - .5, v - .12); return d < .28 ? ["#f2c84a", "#f2a83a", "#e86a2a", "#f4e070"][Math.floor(r * 4)] : d < .5 ? ["#f2a83a", "#2a6ad8", "#f2c84a", "#3a8ae0"][Math.floor(r * 4)] : ["#2a4ab8", "#1e7a8a", "#2a9a5a", "#f2c84a", "#3a5ad0"][Math.floor(r * 5)]; }, 22);
      q.fillStyle = "#d8342c"; q.beginPath(); q.moveTo(W * .5, H * .02); q.bezierCurveTo(W * .7, H * .08, W * .62, H * .16, W * .5, H * .2); q.bezierCurveTo(W * .38, H * .16, W * .3, H * .08, W * .5, H * .02); q.fill();
      q.fillStyle = "#f6e070"; q.beginPath(); q.moveTo(W * .5, H * .07); q.bezierCurveTo(W * .6, H * .11, W * .56, H * .16, W * .5, H * .18); q.bezierCurveTo(W * .44, H * .16, W * .4, H * .11, W * .5, H * .07); q.fill();
      q.fillStyle = "#e8e4dc"; q.fillRect(W * .47, H * .2, W * .06, 26); q.fillStyle = "#5a3018"; q.fillRect(W * .485, H * .225, W * .03, H * .13);
      robe(q, W * .45, H * .42, 160, 520, "#2a9a5a"); face(q, W * .42, H * .36, 52); q.fillStyle = "#6a3820"; q.save(); q.translate(W * .52, H * .36); q.rotate(-.12); q.fillRect(-14, -H * .02, 28, H * .1); q.restore();
      for (let k = 0; k < 6; k++) { const x = 40 + k * 90 + (k > 2 ? 70 : 0), y = H * .62 + (k % 2) * 50; if (Math.abs(x - W * .45) < 90) continue; robe(q, x, y + 40, 60, 260, ["#d8342c", "#f2c84a", "#2a4ab8"][k % 3]); face(q, x, y, 28); }
      lead(q, 21, 8); out.push(c); }
    /* III. Now and the future: gold, red and green; a rising sun, raised arms, towers, gears and a rocket */
    { const c = document.createElement("canvas"); c.width = W; c.height = H; const q = c.getContext("2d");
      mosaic(q, (u, v, r) => v < .35 ? ["#f2c84a", "#f4e070", "#f2a83a", "#e8c040"][Math.floor(r * 4)] : v < .7 ? ["#d8342c", "#f2a83a", "#2a9a5a", "#f2c84a", "#e85a3a"][Math.floor(r * 5)] : ["#2a9a5a", "#1f7a3a", "#3aaa5a", "#d8342c"][Math.floor(r * 4)], 31);
      q.fillStyle = "#f6f0c0"; q.beginPath(); q.arc(W * .5, H * .22, 90, Math.PI, 0); q.fill(); q.strokeStyle = "#f2a83a"; q.lineWidth = 8; for (let k = 0; k < 12; k++) { const a = Math.PI + k / 11 * Math.PI; q.beginPath(); q.moveTo(W * .5 + Math.cos(a) * 100, H * .22 + Math.sin(a) * 100); q.lineTo(W * .5 + Math.cos(a) * 170, H * .22 + Math.sin(a) * 170); q.stroke(); }
      q.fillStyle = "#3a3a46"; for (const [x, w, h] of [[60, 34, 220], [110, 24, 160], [400, 30, 240], [446, 22, 150]]) q.fillRect(x, H * .42 - h, w, h);
      q.fillStyle = "#e8e4dc"; q.beginPath(); q.moveTo(W * .82, H * .05); q.lineTo(W * .87, H * .16); q.lineTo(W * .77, H * .16); q.fill(); q.fillRect(W * .79, H * .16, W * .06, 90);
      q.strokeStyle = "#5a5a64"; q.lineWidth = 10; for (const [x, y, r] of [[90, H * .9, 46], [420, H * .88, 38]]) { q.beginPath(); q.arc(x, y, r, 0, Math.PI * 2); q.stroke(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; q.beginPath(); q.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); q.lineTo(x + Math.cos(a) * (r + 14), y + Math.sin(a) * (r + 14)); q.stroke(); } }
      for (let k = 0; k < 5; k++) { const x = 70 + k * 92, y = H * .5 + (k % 2) * 34; robe(q, x, y + 50, 70, 280, ["#2a9a5a", "#d8342c", "#f2c84a"][k % 3]); face(q, x, y, 32); q.fillStyle = "#6a3820"; q.save(); q.translate(x + 26, y + 30); q.rotate(-.5); q.fillRect(-7, -80, 14, 80); q.restore(); }
      lead(q, 37, 8); out.push(c); }
    return out.map(c => { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; });
  }
  function hall(T, o) {
    const g = new T.Group(), tex = paint(T), stone = new T.MeshStandardMaterial({ color: 0xcfc3ae, roughness: .95 }), panels = [];
    const pw = o.W || 22, ph = o.H || 44;
    for (let i = 0; i < 3; i++) { const x = (i - 1) * (pw + 3), m = new T.Mesh(new T.PlaneGeometry(pw, ph), new T.MeshStandardMaterial({ map: tex[i], emissiveMap: tex[i], emissive: 0xffffff, emissiveIntensity: .75, roughness: .2, side: T.DoubleSide }));
      m.position.set(x, ph / 2 + 2, 0); g.add(m); panels.push(m);
      const glow = new T.Mesh(new T.PlaneGeometry(pw * 1.05, 26), new T.MeshBasicMaterial({ map: tex[i], transparent: true, opacity: .32, blending: T.AdditiveBlending, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.set(x, .08, 14); g.add(glow); }
    for (let i = 0; i < 4; i++) { const x = (i - 1.5) * (pw + 3), p = new T.Mesh(new T.BoxGeometry(3, ph + 6, 4), stone); p.position.set(x, (ph + 6) / 2, 0); g.add(p); }
    const lint = new T.Mesh(new T.BoxGeometry((pw + 3) * 3 + 3, 4, 5), stone); lint.position.set(0, ph + 6, 0); g.add(lint); const base = new T.Mesh(new T.BoxGeometry((pw + 3) * 3 + 3, 2, 5), stone); base.position.set(0, 1, 0); g.add(base);
    g.position.set(o.x, o.y, o.z); g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    return { group: g, panels, textures: tex, torchAt: new T.Vector3(o.x - .1 * pw, o.y + ph * .82, o.z + .2), door: new T.Vector3(o.x, o.y, o.z + 3) };
  }
  window.MesaTekle = { paint, hall };
})();
