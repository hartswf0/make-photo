/* MESA CHIP: the cyber-western of glass. A world with no renderer, camera, player or loop (like mars-world.js and knox-world.js).
   Every zone is one keyframe of the film's breakdown (mesa/keyframes.json):
     title_gate (kf_01) . clockwork_iris (kf_02) . dune_open (kf_03) . main_street_glass (kf_04) . cathedral_trench (kf_05)
     silhouette_wall (kf_06) . hoodoo_ridge (kf_07) . duel_arena (kf_08) . uncle_chip_booth (kf_09) . north_curtain_wall (kf_10)
     oasis_pond (kf_11) . ziggurat_steps (kf_12), and the salt flat perimeter with its orange buttes.
   Frame: metres, x east, z south (north is -z). The film walks north: from the title gate up Main Street, through the iris, past
   the sign into the duel arena, down the glass canyon over the sunken cathedral, to the ziggurat under the curtain wall.
   MesaWorld.heightAt(x, z); MesaWorld.create(T) -> { root, colliders, zones, prisms, glass, mirrors, caustics, iris, horseAt, ... } */
(() => {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const frac = x => x - Math.floor(x), hash = (a, b = 0) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); };
  const fbm = (x, y, o = 4) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); f *= 2.03; a *= .5; } return s; };
  const BOUND = { x0: -520, x1: 520, z0: -520, z1: 420 };

  const Z = {   /* the zones, keyed by the keyframe they come from */
    title_gate: { kf: "kf_01", x: 0, z: 140, r: 24, name: "The Title Gate" },
    clockwork_iris: { kf: "kf_02", x: 0, z: 78, r: 10, name: "The Clockwork Iris" },
    dune_open: { kf: "kf_03", x: 120, z: 150, r: 70, name: "The Open Dunes" },
    main_street_glass: { kf: "kf_04", x: 0, z: 90, r: 40, name: "Main Street" },
    cathedral_trench: { kf: "kf_05", x: 0, z: -160, r: 60, name: "The Glass Cathedral" },
    silhouette_wall: { kf: "kf_06", x: -95, z: -30, r: 50, name: "The Silhouette Wall" },
    hoodoo_ridge: { kf: "kf_07", x: -170, z: -150, r: 60, name: "Hoodoo Ridge" },
    duel_arena: { kf: "kf_08", x: 0, z: 0, r: 30, name: "The Duel Arena" },
    uncle_chip_booth: { kf: "kf_09", x: 26, z: 2, r: 8, name: "Uncle Chip's Booth" },
    north_curtain_wall: { kf: "kf_10", x: 0, z: -360, r: 160, name: "The Curtain Wall" },
    oasis_pond: { kf: "kf_11", x: 135, z: -70, r: 40, name: "The Oasis" },
    ziggurat_steps: { kf: "kf_12", x: 0, z: -292, r: 22, name: "The Ziggurat" }
  };
  const PIT = { x: 0, z: -160, hx: 9, hz: 46, depth: 7 };
  function base(x, z) { let h = fbm(x / 160 + 4.2, z / 160 + 1.3, 4) * 7 + fbm(x / 34, z / 34, 2) * 1.2;   /* dunes */
    h += smooth(-110, -200, x) * smooth(-60, -120, z) * smooth(-260, -200, z) * 16 * (.7 + .3 * fbm(x / 40, z / 40, 3));   /* the ridge, west */
    const r = Math.hypot(x, z + 60); h = lerp(h, 1.2 + fbm(x / 90, z / 90, 2) * .6, smooth(300, 360, r));   /* the salt flats: flat and white beyond the town */
    return h; }
  const FLAT = [[0, 70, 20, 90], [0, 0, 34, 34], [0, -100, 14, 220], [0, -292, 30, 26], [-95, -30, 50, 16], [135, -70, 46, 46]];   /* [x, z, half-width, half-depth] */
  const FLATH = FLAT.map(([x, z]) => base(x, z));
  function heightAt(x, z) { let h = base(x, z);
    FLAT.forEach(([fx, fz, hx, hz], i) => { const dx = Math.abs(x - fx) - hx, dz = Math.abs(z - fz) - hz, d = Math.max(dx, dz); if (d < 12) h = lerp(h, FLATH[i], smooth(12, 0, d)); });
    { const dx = Math.abs(x - PIT.x) - PIT.hx, dz = Math.abs(z - PIT.z) - PIT.hz; if (dx < 4 && dz < 4) h -= PIT.depth * smooth(4, 0, Math.max(dx, dz)); }   /* the sunken cathedral floor */
    { const d = Math.hypot(x - Z.oasis_pond.x, z - Z.oasis_pond.z); if (d < 26) h -= 2.2 * smooth(26, 14, d); }   /* the oasis bowl */
    return h; }
  const OASIS_Y = () => FLATH[5] - 1.1, CATHEDRAL_Y = () => FLATH[2] - PIT.depth + .02;

  /* ---------- stained glass, painted on a canvas: cells of colour held in lead ---------- */
  const PAL = ["#2fd0d8", "#f2a83a", "#d8342c", "#f2d04a", "#2a9a5a", "#2a4ab8", "#e85aa8", "#f6efe0"];
  const CACHE = new Map();
  function leaded(T, seed, opt = {}) { const key = JSON.stringify(opt) + "|" + (opt.text ? seed : seed % 6); if (CACHE.has(key)) return CACHE.get(key);
    const S = opt.text ? 512 : 256, c = document.createElement("canvas"); c.width = c.height = S; const q = c.getContext("2d"), n = opt.cells || 9, pal = opt.pal || PAL;
    if (opt.stripes) { const bands = opt.stripes; for (let i = 0; i < bands; i++) { q.fillStyle = pal[(i + seed) % pal.length]; q.fillRect(0, i * S / bands, S, S / bands + 1); }
      q.strokeStyle = "#1a1410"; q.lineWidth = S / 85; for (let i = 0; i <= bands; i++) { q.beginPath(); q.moveTo(0, i * S / bands); q.lineTo(S, i * S / bands); q.stroke(); } q.lineWidth = S / 170; for (let i = 0; i <= 6; i++) { q.beginPath(); q.moveTo(i * S / 6 + (i % 2) * S / 25, 0); q.lineTo(i * S / 6 - (i % 2) * S / 25, S); q.stroke(); } }
    else { /* a jittered grid of cells, each pixel compared only with the nine cells around it */
      const P = [], cw = S / n; for (let i = 0; i < n; i++) { P.push([]); for (let j = 0; j < n; j++) { const col = pal[Math.floor(hash(i * 7 + seed, j * 3) * pal.length)]; P[i].push([(i + .15 + hash(i + seed, j) * .7) * cw, (j + .15 + hash(j, i + seed * 3) * .7) * cw, parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)]); } }
      const img = q.createImageData(S, S), lw = S / 110;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const ci = Math.floor(x / cw), cj = Math.floor(y / cw); let b1 = 1e9, b2 = 1e9, k = null;
          for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const ii = (ci + di + n) % n, jj = (cj + dj + n) % n, p = P[ii][jj], px = p[0] + (ci + di < 0 ? -S : ci + di >= n ? S : 0), py = p[1] + (cj + dj < 0 ? -S : cj + dj >= n ? S : 0), d = (x - px) ** 2 + (y - py) ** 2; if (d < b1) { b2 = b1; b1 = d; k = p; } else if (d < b2) b2 = d; }
          const lead = Math.sqrt(b2) - Math.sqrt(b1) < lw, i4 = (y * S + x) * 4, sh = .8 + .2 * hash(x >> 2, y >> 2);
          img.data[i4] = lead ? 26 : k[2] * sh; img.data[i4 + 1] = lead ? 20 : k[3] * sh; img.data[i4 + 2] = lead ? 16 : k[4] * sh; img.data[i4 + 3] = 255; } q.putImageData(img, 0, 0); }
    if (opt.text) { q.textAlign = "center"; q.font = `700 ${opt.size || 74}px Georgia`; for (const [i, line] of opt.text.entries()) { const y = S * (.36 + i * .28); q.lineWidth = 16; q.strokeStyle = "#1a1410"; q.strokeText(line, S / 2, y); q.fillStyle = i ? "#2fd0d8" : "#f2d04a"; q.fillText(line, S / 2, y); } }
    const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4; CACHE.set(key, tx); return tx; }
  function glassMat(T, tx, o = {}) { return new T.MeshStandardMaterial(Object.assign({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: .55, roughness: .15, metalness: .1, transparent: true, opacity: .82, side: T.DoubleSide, depthWrite: true }, o)); }

  function create(T) {
    const root = new T.Group(), colliders = [], zones = Z, prisms = [], glass = [], caustics = [], mirrors = [], shadowOf = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
    const M = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .85 }, o)), box = (w, h, d, m) => new T.Mesh(new T.BoxGeometry(w, h, d), m);
    const solid = (x, y, z, hx, hy, hz, ry, tag) => { const k = { type: "box", x, y, z, hx, hy, hz, ry: ry || 0, tag }; colliders.push(k); return k; };

    /* ---------- ground: sand, salt and red rock by height and distance ---------- */
    { const W = BOUND.x1 - BOUND.x0, D = BOUND.z1 - BOUND.z0, g = new T.PlaneGeometry(W, D, 300, 270); g.rotateX(-Math.PI / 2); const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color();
      const sand = new T.Color("#e2a66a"), deep = new T.Color("#c8743e"), salt = new T.Color("#f4efe6"), rock = new T.Color("#b0502a");
      for (let i = 0; i < p.count; i++) { const x = p.getX(i) + (BOUND.x0 + BOUND.x1) / 2, z = p.getZ(i) + (BOUND.z0 + BOUND.z1) / 2, y = heightAt(x, z); p.setXYZ(i, x, y, z);
        c.copy(sand).lerp(deep, fbm(x / 22, z / 22, 3) * .8); c.lerp(salt, smooth(300, 350, Math.hypot(x, z + 60))); c.lerp(rock, smooth(6, 14, y) * .6); col.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute("color", new T.BufferAttribute(col, 3)); g.computeVertexNormals(); const m = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); m.receiveShadow = true; m.userData.cls = "ground"; root.add(m); }

    /* ---------- the orange buttes on the salt-flat ring, and the hoodoos on the ridge ---------- */
    /* the buttes as al-Idrisi draws his mountains on the Tabula Rogeriana: bands of red, yellow and purple, each edged in dark
       ink and scalloped with scales */
    const IDRISI = [["#d8342c", "#f2c84a", "#e88a2a"], ["#9a4a9a", "#e86ab0", "#f2c84a"], ["#d8342c", "#9a4a9a", "#f2d04a"]];
    const idrisi = k => { const c = document.createElement("canvas"); c.width = 256; c.height = 256; const q = c.getContext("2d"), pal = IDRISI[k % 3], n = 7;
      for (let i = 0; i < n; i++) { const y0 = i * 256 / n, h = 256 / n; q.fillStyle = pal[i % pal.length]; q.fillRect(0, y0, 256, h + 1); q.strokeStyle = "rgba(40,20,10,.85)"; q.lineWidth = 3;
        q.beginPath(); for (let x = 0; x <= 256; x += 16) { q.moveTo(x + 8, y0 + h); q.arc(x, y0 + h, 8, 0, Math.PI, true); } q.stroke(); q.beginPath(); q.moveTo(0, y0); q.lineTo(256, y0); q.stroke(); }
      const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(3, 1); return new T.MeshStandardMaterial({ map: tx, roughness: .95 }); };
    const butteMs = [0, 1, 2].map(idrisi), butteTop = new T.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 1 });
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + hash(i) * .3, r = 420 + hash(i, 2) * 60, x = Math.cos(a) * r, z = Math.sin(a) * r - 60, h = 26 + hash(i, 3) * 40, w = 16 + hash(i, 4) * 18;   /* islands of mountain at the rim, small enough to see past */
      const g = new T.Group(); const butteM = [butteMs[i % 3], butteTop, butteTop]; const s = new T.Mesh(new T.CylinderGeometry(w * 1.3, w * 1.9, h * .35, 9), butteM); s.position.y = h * .17; g.add(s); const t = new T.Mesh(new T.CylinderGeometry(w, w * 1.05, h, 9), butteM); t.position.y = h * .5 + h * .2; g.add(t);
      g.position.set(x, heightAt(x, z) - 2, z); g.rotation.y = hash(i, 5) * 6; root.add(g); }
    /* the Continuous Monument: a colossal wall of glass grid standing on the salt to the east, after Superstudio */
    { const c = document.createElement("canvas"); c.width = c.height = 256; const q = c.getContext("2d"); q.fillStyle = "rgba(190,228,222,.5)"; q.fillRect(0, 0, 256, 256); q.strokeStyle = "rgba(20,60,56,.85)"; q.lineWidth = 3;
      for (let k = 0; k <= 8; k++) { q.beginPath(); q.moveTo(k * 32, 0); q.lineTo(k * 32, 256); q.stroke(); q.beginPath(); q.moveTo(0, k * 32); q.lineTo(256, k * 32); q.stroke(); }
      const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; tx.wrapS = tx.wrapT = T.RepeatWrapping;
      for (let i = 0; i < 16; i++) { const a = -.55 + i * .085, r = 485, x = Math.cos(a) * r, z = Math.sin(a) * r - 60, w = Math.sin(.085) * r * 1.02, h = 64, t = tx.clone(); t.needsUpdate = true; t.repeat.set(w / 6, h / 6);
        const mat = new T.MeshStandardMaterial({ map: t, transparent: true, opacity: .82, roughness: .1, metalness: .3, emissive: 0x6a9a94, emissiveIntensity: .35, side: T.DoubleSide, depthWrite: false });
        const m = new T.Mesh(new T.BoxGeometry(w, h, 6), mat); m.position.set(x, heightAt(x, z) + h / 2, z); m.rotation.y = -a + Math.PI / 2; root.add(m); } }
    const hoodooM = new T.MeshStandardMaterial({ color: 0xc86a3a, roughness: 1, flatShading: true }), capM = new T.MeshStandardMaterial({ color: 0x7a3a22, roughness: 1, flatShading: true });
    for (let i = 0; i < 26; i++) { const x = -210 + hash(i, 1) * 90, z = -210 + hash(i, 2) * 120, y = heightAt(x, z), h = 5 + hash(i, 3) * 9, g = new T.Group();
      for (let k = 0; k < 3; k++) { const seg = new T.Mesh(new T.CylinderGeometry(.9 - k * .15 + hash(i, k) * .3, 1.2 - k * .15, h / 3, 7), hoodooM); seg.position.y = h / 6 + k * h / 3; g.add(seg); }
      const cap = new T.Mesh(new T.CylinderGeometry(1.5, 1.1, .9, 7), capM); cap.position.y = h + .3; g.add(cap); g.position.set(x, y, z); root.add(shadowOf(g)); colliders.push({ type: "cyl", x, y: y + h / 2, z, r: 1.1, hh: h / 2, tag: "hoodoo" }); }

    /* ---------- the title gate: two frosted glass-block towers and a lintel over the start of Main Street ---------- */
    { const z = Z.title_gate.z, y = heightAt(0, z), frost = new T.MeshStandardMaterial({ color: 0xdff4f4, roughness: .35, metalness: .05, transparent: true, opacity: .55, side: T.DoubleSide }), mortar = M(0xb8b0a4);
      for (const s of [-1, 1]) { const g = new T.Group(); for (let i = 0; i < 4; i++) for (let j = 0; j < 9; j++) { const b = box(.95, .95, .95, frost); b.position.set((i - 1.5), j + .5, 0); g.add(b); } const fr = box(4.2, 9.2, 1.1, mortar); fr.position.y = 4.6; fr.scale.set(1, 1, .2); g.add(fr);
        g.position.set(s * 8, y, z); root.add(g); solid(s * 8, y + 4.6, z, 2.1, 4.6, .6, 0, "gate"); }
      const lint = box(20, 1.4, 1.4, mortar); lint.position.set(0, y + 9.9, z); root.add(lint); }

    /* ---------- Main Street: glass-fronted false fronts on both sides, stained-glass windows lit from inside ---------- */
    const wood = M(0x8a5a3a), woodD = M(0x5a3a26);
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) { const z = 122 - i * 12, x = s * 15, y = heightAt(x, z), h = 7 + hash(i, s + 2) * 4, w = 10.5, g = new T.Group();
      const f = box(w, h, .4, wood); f.position.set(0, h / 2, 0); g.add(f); const body = box(w, h - 1.5, 9, woodD); body.position.set(0, (h - 1.5) / 2, -4.6 * 1); g.add(body);
      const win = new T.Mesh(new T.PlaneGeometry(w * .74, h * .5), glassMat(T, leaded(T, i * 2 + (s > 0 ? 1 : 0), { cells: 6 }), { opacity: .9, emissiveIntensity: .8 })); win.position.set(0, h * .46, .22); g.add(win); glass.push(win);
      const porch = box(w, .2, 2.4, woodD); porch.position.set(0, .5, 1.4); g.add(porch); g.position.set(x, y, z); g.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; root.add(shadowOf(g)); solid(x + s * 4.4, y + h / 2, z, 4.8, h / 2, w / 2, 0, "front"); }

    /* ---------- the clockwork iris: a brass ring with twelve glass blades that open and close across Main Street ---------- */
    const iris = new T.Group(); { const z = Z.clockwork_iris.z, y = heightAt(0, z) + 6.5, brass = M(0xc8963a, { metalness: .8, roughness: .3 }), dark = M(0x5a4020, { metalness: .6, roughness: .4 });
      const ring = new T.Mesh(new T.TorusGeometry(6, .55, 12, 64), brass); iris.add(ring); const ring2 = new T.Mesh(new T.TorusGeometry(6.9, .25, 8, 64), dark); iris.add(ring2);
      for (let k = 0; k < 24; k++) { const t = box(.3, .6, .5, brass); const a = k / 24 * Math.PI * 2; t.position.set(Math.cos(a) * 7.25, Math.sin(a) * 7.25, 0); t.rotation.z = a; iris.add(t); }
      const bladeTx = leaded(T, 40, { cells: 4, pal: ["#2fd0d8", "#f2a83a", "#c8963a", "#e9f4f0"] }), blades = [];
      for (let k = 0; k < 12; k++) { const piv = new T.Group(), a = k / 12 * Math.PI * 2; piv.position.set(Math.cos(a) * 6, Math.sin(a) * 6, 0); const bl = new T.Mesh(new T.PlaneGeometry(4.2, 2.1), glassMat(T, bladeTx, { opacity: .7 })); bl.position.set(-2.1, 0, 0); piv.add(bl); piv.rotation.z = a + Math.PI / 2; iris.add(piv); blades.push({ piv, a }); glass.push(bl); }
      for (const s of [-1, 1]) { const post = box(1.2, 14, 1.2, dark); post.position.set(s * 8, -6.5 + 7, 0); iris.add(post); solid(s * 8, y - 6.5 + 7, z, .6, 7, .6, 0, "iris"); }
      iris.position.set(0, y, z); iris.userData.blades = blades; iris.userData.y = y; root.add(shadowOf(iris)); }

    /* ---------- the sign monolith: UNCLE MESA over MESA CHIP in stained glass, anchoring the duel arena ---------- */
    const sign = new T.Group(); { const z = Z.duel_arena.z + 26, y = heightAt(0, z), frame = M(0x2a1e16);
      const slab = new T.Mesh(new T.BoxGeometry(14, 22, .6), [frame, frame, frame, frame, glassMat(T, leaded(T, 77, { cells: 7, text: ["UNCLE MESA", "MESA CHIP"], size: 62 }), { opacity: .95, emissiveIntensity: 1.1 }), glassMat(T, leaded(T, 78, { cells: 7 }), { opacity: .95 })]);
      slab.position.y = 11 + 1; sign.add(slab); const base2 = box(16, 2, 3, frame); base2.position.y = 1; sign.add(base2);
      const lawman = new T.Mesh(new T.PlaneGeometry(5, 9), glassMat(T, leaded(T, 81, { cells: 5, pal: ["#1a1410", "#2a4ab8", "#f2a83a", "#d8342c"] }), { opacity: .9 })); lawman.position.set(-10.2, 6.5, 0); lawman.rotation.y = .35; sign.add(lawman);
      sign.position.set(0, y, z); sign.rotation.y = 0; root.add(shadowOf(sign)); solid(0, y + 12, z, 7, 12, .5, 0, "sign"); }

    /* ---------- the duel arena: a round of packed sand ringed by low adobe walls, and Uncle Chip's booth on the east side ---------- */
    const adobe = M(0xc99a6a);
    for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; if (Math.abs(Math.sin(a)) > .93) continue; const x = Math.cos(a) * 31, z = Math.sin(a) * 31, y = heightAt(x, z), w = box(9, 1.2, 1, adobe); w.position.set(x, y + .6, z); w.rotation.y = -a + Math.PI / 2; root.add(shadowOf(w)); solid(x, y + .6, z, 4.5, .6, .5, -a + Math.PI / 2, "adobe"); }
    const booth = new T.Group(); { const b = Z.uncle_chip_booth, y = heightAt(b.x, b.z), wd = M(0x6a3a22), cloth = M(0x2a4ab8);
      const counter = box(4, 1.1, 1.6, wd); counter.position.y = .55; booth.add(counter); for (const s of [-1, 1]) { const p = box(.2, 3.4, .2, wd); p.position.set(s * 1.9, 1.7, -.7); booth.add(p); }
      const awn = box(4.4, .1, 2.2, cloth); awn.position.set(0, 3.4, -.1); awn.rotation.x = .12; booth.add(awn);
      const head = new T.Mesh(new T.PlaneGeometry(4.2, 1.1), glassMat(T, leaded(T, 90, { cells: 4, text: ["UNCLE CHIP"], size: 84, pal: ["#e85aa8", "#2a4ab8", "#f2d04a"] }), { opacity: .95, emissiveIntensity: 1.2 })); head.position.set(0, 4.1, .1); booth.add(head);
      const stool = new T.Mesh(new T.CylinderGeometry(.25, .22, .7, 10), wd); stool.position.set(0, .35, 1.4); booth.add(stool); booth.userData.seat = new T.Vector3(b.x, y + .7, b.z + 1.4);
      booth.position.set(b.x, y, b.z); booth.rotation.y = -Math.PI / 2; root.add(shadowOf(booth)); solid(b.x, y + .55, b.z, .8, .55, 2, 0, "booth"); }

    /* ---------- the glass canyon: two walls of towering stained-glass slabs, the trench between them, prisms for cover ---------- */
    for (let i = 0; i < 18; i++) for (const s of [-1, 1]) { const z = -40 - i * 13, x = s * (13 + hash(i, s) * 3), y = heightAt(x, z), h = 24 + hash(i, s + 4) * 38, w = 11, d = 2.4;
      const m = new T.Mesh(new T.BoxGeometry(d, h, w), glassMat(T, leaded(T, i * 3 + (s > 0 ? 100 : 0), { cells: 8 }), { opacity: .78 })); m.position.set(x, y + h / 2, z); m.rotation.y = (hash(i, 9) - .5) * .15; root.add(m); glass.push(m);
      solid(x, y + h / 2, z, d / 2, h / 2, w / 2, m.rotation.y, "canyon");
      if (i % 3 === 1) { const c = new T.Mesh(new T.PlaneGeometry(6, 9), new T.MeshBasicMaterial({ map: m.material.map, transparent: true, opacity: .35, blending: T.AdditiveBlending, depthWrite: false })); c.rotation.x = -Math.PI / 2; c.position.set(x - s * 6, heightAt(x - s * 6, z) + .06, z); root.add(c); caustics.push(c); } }
    const prismTx = leaded(T, 300, { cells: 5, pal: ["#2fd0d8", "#f2a83a", "#e9f4f0", "#f2d04a"] });
    for (let i = 0; i < 7; i++) { const z = -52 - i * 30 + (i % 2) * 8, x = (i % 2 ? 4.5 : -4.5), y = (Math.abs(z - PIT.z) < PIT.hz ? CATHEDRAL_Y() : heightAt(x, z)), m = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 2.6, 3), glassMat(T, prismTx, { opacity: .72, emissiveIntensity: .7 }));
      m.position.set(x, y + 1.3, z); m.rotation.y = hash(i, 8) * 3; root.add(m); prisms.push({ mesh: m, x, y: y + 1.3, z, hp: 2, broken: false, tex: prismTx }); }

    /* ---------- the sub-dune glass cathedral: a sunken mirror floor between the canyon walls, ribs of glass, god-rays ---------- */
    { const y = CATHEDRAL_Y(), floor = new T.Mesh(new T.PlaneGeometry(PIT.hx * 2 + 2, PIT.hz * 2 + 2), new T.MeshStandardMaterial({ color: 0x6a8a90, metalness: .6, roughness: .08 })); floor.rotation.x = -Math.PI / 2; floor.position.set(PIT.x, y, PIT.z); root.add(floor);
      mirrors.push({ mesh: floor, y, x: PIT.x, z: PIT.z, r: 60, tint: [.78, .92, .95] });
      const grid = new T.Mesh(new T.PlaneGeometry(PIT.hx * 2 + 2, PIT.hz * 2 + 2, 10, 46), new T.MeshBasicMaterial({ color: 0x1a2a2a, wireframe: true, transparent: true, opacity: .35 })); grid.rotation.x = -Math.PI / 2; grid.position.set(PIT.x, y + .03, PIT.z); root.add(grid);
      const ribTx = leaded(T, 500, { cells: 6 });
      for (let i = 0; i < 8; i++) { const z = PIT.z - PIT.hz + 6 + i * 12, a = new T.Mesh(new T.TorusGeometry(10, .35, 6, 24, Math.PI), glassMat(T, ribTx, { opacity: .8 })); a.position.set(0, y, z); root.add(a); glass.push(a); }
      for (let i = 0; i < 6; i++) { const ray = new T.Mesh(new T.CylinderGeometry(.6, 4, 40, 12, 1, true), new T.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: .09, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); ray.position.set((hash(i) - .5) * 10, y + 20, PIT.z - 36 + i * 14); ray.rotation.z = .25; ray.userData.god = true; root.add(ray); }
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const st = box(4, .35, 1.2, M(0x9a8a7a)); st.position.set(s * 4, heightAt(s * 4, PIT.z - PIT.hz - 2) - 1 - k * 1.6, PIT.z - PIT.hz - 2 + k * 1.3); root.add(st); } }

    /* ---------- the silhouette wall: a long horizontal-striped stained-glass wall, and the lone horse in front of it ---------- */
    { const w = Z.silhouette_wall, y = heightAt(w.x, w.z), wall = new T.Mesh(new T.BoxGeometry(80, 18, 1.2), glassMat(T, leaded(T, 7, { stripes: 9, pal: ["#f2d04a", "#d8342c", "#2a4ab8", "#f2a83a", "#2fd0d8"] }), { opacity: .9, emissiveIntensity: .8 }));
      wall.material.map.repeat.set(4, 1); wall.material.map.wrapS = T.RepeatWrapping; wall.position.set(w.x, y + 9, w.z - 8); root.add(wall); glass.push(wall); solid(w.x, y + 9, w.z - 8, 40, 9, .6, 0, "silhouette wall");
      const c = new T.Mesh(new T.PlaneGeometry(80, 14), new T.MeshBasicMaterial({ map: wall.material.map, transparent: true, opacity: .25, blending: T.AdditiveBlending, depthWrite: false })); c.rotation.x = -Math.PI / 2; c.position.set(w.x, y + .07, w.z); root.add(c); caustics.push(c); }

    /* ---------- the oasis: a mirror-still pond in a bowl, saguaros, stained-glass light on the sand around them ---------- */
    { const o = Z.oasis_pond, y = OASIS_Y(), pond = new T.Mesh(new T.CircleGeometry(22, 48), new T.MeshStandardMaterial({ color: 0x3a6a78, metalness: .3, roughness: .05 })); pond.rotation.x = -Math.PI / 2; pond.position.set(o.x, y, o.z); root.add(pond);
      mirrors.push({ mesh: pond, y, x: o.x, z: o.z, r: 90, tint: [.7, .86, .92] });
      const cactus = M(0x4a7a3a, { roughness: .8 }), ctx = leaded(T, 640, { cells: 5, pal: ["#2a9a5a", "#f2d04a", "#2fd0d8", "#e85aa8"] });
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28 + hash(i) * .3, r = 26 + hash(i, 1) * 26, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r, yy = heightAt(x, z), h = 4 + hash(i, 2) * 5, g = new T.Group();
        const t = new T.Mesh(new T.CylinderGeometry(.42, .5, h, 10), cactus); t.position.y = h / 2; g.add(t);
        for (const s of [-1, 1]) if (hash(i, s + 5) > .3) { const ah = h * (.3 + hash(i, s) * .25), arm = new T.Mesh(new T.CylinderGeometry(.3, .32, 1.6, 8), cactus); arm.rotation.z = s * Math.PI / 2; arm.position.set(s * .9, ah, 0); g.add(arm); const up = new T.Mesh(new T.CylinderGeometry(.28, .3, 2.2, 8), cactus); up.position.set(s * 1.65, ah + 1.05, 0); g.add(up); }
        g.position.set(x, yy, z); g.rotation.y = hash(i, 7) * 6; root.add(shadowOf(g)); colliders.push({ type: "cyl", x, y: yy + h / 2, z, r: .5, hh: h / 2, tag: "saguaro" });
        const p = new T.Mesh(new T.CircleGeometry(2.6, 18), new T.MeshBasicMaterial({ map: ctx, transparent: true, opacity: .45, blending: T.AdditiveBlending, depthWrite: false })); p.rotation.x = -Math.PI / 2; p.position.set(x + 1.5, yy + .06, z + 1); root.add(p); caustics.push(p); } }

    /* ---------- the ziggurat: stepped stone at the canyon's end, giant glass columns behind it ---------- */
    const zig = { seat: null }; { const zz = Z.ziggurat_steps, y = heightAt(zz.x, zz.z), stone = M(0xd8b48a, { roughness: .95 });
      for (let k = 0; k < 6; k++) { const w = 36 - k * 5, d = 26 - k * 3.6, s = box(w, 1.2, d, stone); s.userData.cls = "zig"; s.position.set(zz.x, y + .6 + k * 1.2, zz.z - k * .6); root.add(shadowOf(s)); solid(zz.x, y + .6 + k * 1.2, zz.z - k * .6, w / 2, .6, d / 2, 0, "ziggurat"); }
      zig.seat = new T.Vector3(zz.x + 6, y + 2.4, zz.z + 26 / 2 - 4.6);
      const colTx = leaded(T, 900, { cells: 6, pal: ["#f2d04a", "#2fd0d8", "#f2a83a", "#e9f4f0"] });
      for (let i = 0; i < 7; i++) { const x = zz.x - 24 + i * 8, h = 30 + (i % 3) * 12, c = new T.Mesh(new T.BoxGeometry(3, h, 3), glassMat(T, colTx, { opacity: .8 })); c.position.set(x, y + h / 2, zz.z - 22); root.add(c); glass.push(c); solid(x, y + h / 2, zz.z - 22, 1.5, h / 2, 1.5, 0, "column"); } }

    /* ---------- the north curtain wall: colossal vertical glass monoliths across the end of the world ---------- */
    { const cz = Z.north_curtain_wall.z, tx = [leaded(T, 1200, { cells: 5, pal: ["#d8342c", "#2fd0d8", "#f2d04a"] }), leaded(T, 1201, { cells: 5, pal: ["#2fd0d8", "#f2a83a", "#e9f4f0"] })];
      for (let i = 0; i < 22; i++) { const x = -190 + i * 18 + hash(i) * 5, h = 110 + hash(i, 1) * 90, w = 14, y = heightAt(x, cz), m = new T.Mesh(new T.BoxGeometry(w, h, 5), glassMat(T, tx[i % 2], { opacity: .7, emissiveIntensity: .45 })); m.position.set(x, y + h / 2 - 2, cz - hash(i, 2) * 20); root.add(m); glass.push(m); solid(x, y + h / 2, m.position.z, w / 2, h / 2, 2.5, 0, "curtain"); } }

    const horseAt = { x: Z.silhouette_wall.x + 6, z: Z.silhouette_wall.z, h: Math.PI / 2 };
    function zoneAt(x, z) { let best = null, bd = 1e9; for (const k in Z) { const q = Z[k], d = Math.hypot(x - q.x, z - q.z) - q.r; if (d < bd) { bd = d; best = q; } } if (Math.hypot(x, z + 60) > 300) return "The Salt Flats"; return bd < 25 ? best.name : "The Desert"; }
    return { root, colliders, zones: Z, prisms, glass, caustics, mirrors, iris, sign, booth, zig, horseAt, zoneAt, BOUND, PIT, cathedralY: CATHEDRAL_Y(), oasisY: OASIS_Y(), leaded: (s, o) => leaded(T, s, o), glassMat: (tx, o) => glassMat(T, tx, o) };
  }
  window.MesaWorld = { heightAt, create, BOUND, ZONES: Z };
})();
