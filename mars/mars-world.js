/* Ethiopia on Mars: the world itself, with no renderer, camera, player or loop of its own, so that one copy of it serves both
   the standalone level (mars/index.html, where Tex is the player) and the jerry can (mars/can.json, poured into the trough,
   where the trough's own rider walks, rides, drives, flies and sails through it). See atlas/JERRYCAN.md.
   MarsWorld.heightAt(x, z) is the level's own ground in local metres (the town at the origin, the street running to -z).
   MarsWorld.create(T, { Y, tune, ground }) builds the frontier town, its stelae, domes and rock church, the carved city that the
   storm reveals, and the storm itself, every piece standing on Y(x, z); it returns { root, update(dt, t, player), ... }. */
(() => {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const frac = x => x - Math.floor(x), hash = (a, b = 0) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
  const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); };
  const fbm = (x, y, o = 4) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; };

  // ---------- the level's ground: the street is flat, the desert rolls, the rock church is cut down into it ----------
  const CH = { x: 34, z: -150, half: 13, depth: 9 };   // Lalibela-style cross church in its pit
  function heightAt(x, z) {
    const street = smooth(9, 22, Math.abs(x)) * (z < 30 ? 1 : 1);   // 0 on the street, 1 out in the desert
    let h = street * (fbm(x * .02, z * .02) * 4.5 - 1.5) + fbm(x * .09 + 9, z * .09) * .35;
    const d = Math.max(Math.abs(x - CH.x), Math.abs(z - CH.z));
    if (d < CH.half + 2.5) h = lerp(-CH.depth, h, smooth(CH.half, CH.half + 2.5, d));
    return h;
  }

  const TUNE0 = {"ground": "#f5a689", "mesa": "#ff7748", "wood": "#ffeecc", "spire": "#ce7551", "spireFog": 0.87};
  function create(T, o = {}) {
    const TUNE = Object.assign({}, TUNE0, o.tune || {}), Y = o.Y || heightAt, root = new T.Group(), scene = root;   // everything is added to root
    const MESA = new T.MeshStandardMaterial({ color: TUNE.mesa, vertexColors: false, roughness: 1, flatShading: true });
    function groundTex() {   // red regolith with pebbles and tyre-less wagon ruts
      const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 14000; i++) { const r = hash(i, 1), x = hash(i, 2) * 512, y = hash(i, 3) * 512; g.fillStyle = r < .55 ? `rgba(90,45,30,${.06 + r * .16})` : `rgba(255,235,215,${(r - .55) * .5})`; g.fillRect(x, y, 1 + r * 2, 1 + r * 2); }
      for (let i = 0; i < 70; i++) { const x = hash(i, 8) * 512, y = hash(i, 9) * 512, r = 3 + hash(i, 10) * 6; g.fillStyle = "rgba(80,40,25,.18)"; g.beginPath(); g.ellipse(x, y, r, r * .6, hash(i, 11) * 3, 0, 6.3); g.fill(); }
      const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(120, 120); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
    }
    const G = new T.PlaneGeometry(900, 900, 300, 300); G.rotateX(-Math.PI / 2);
    { const p = G.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color();
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i) - 120, y = Y(x, z); p.setZ(i, z + 0); p.setY(i, y);
        const street = 1 - smooth(5, 12, Math.abs(x)), rut = street * (Math.exp(-Math.pow((Math.abs(x) - 1.3) / .35, 2)) * .14), n = fbm(x * .04, z * .04);
        c.setRGB(1, 1, 1).multiplyScalar(.9 + .16 * n - rut).lerp(new T.Color(1.04, 1.02, 1), street * .4); if (y < -1) c.multiplyScalar(.7); col.set([c.r, c.g, c.b], i * 3); }
      G.setAttribute("color", new T.BufferAttribute(col, 3)); G.computeVertexNormals(); }
    const GROUND = new T.MeshStandardMaterial({ color: TUNE.ground, map: groundTex(), vertexColors: true, roughness: .97 });
    const ground = new T.Mesh(G, GROUND); ground.receiveShadow = true; ground.userData.cls = "ground"; scene.add(ground);
    // scrub and stones, the film's sage tufts along the street and out in the desert
    { const tuft = new T.ConeGeometry(.45, .5, 7), rock = new T.DodecahedronGeometry(.4, 0), n = 1400;
      const tm = new T.InstancedMesh(tuft, new T.MeshStandardMaterial({ color: 0xb3ad80, roughness: 1, flatShading: true }), n), rm = new T.InstancedMesh(rock, new T.MeshStandardMaterial({ color: 0xb57a5a, roughness: 1, flatShading: true }), 700);
      const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), ps = new T.Vector3(); let k = 0, kr = 0;
      for (let i = 0; i < 6000 && (k < n || kr < 700); i++) { const x = (hash(i, 21) - .5) * 220, z = 30 - hash(i, 22) * 330; if (Math.abs(x) < 3.2) continue; if (Math.max(Math.abs(x - CH.x), Math.abs(z - CH.z)) < CH.half + 3) continue;
        const big = Math.abs(x) > 8 || hash(i, 23) < .3, s = .5 + hash(i, 24) * 1.1;
        if (k < n && big) { e.set(0, hash(i, 25) * 6, 0); q.setFromEuler(e); sc.set(s * 1.2, s * (.6 + hash(i, 26) * .5), s * 1.2); ps.set(x, Y(x, z) + sc.y * .3, z); m4.compose(ps, q, sc); tm.setMatrixAt(k++, m4); }
        else if (kr < 700) { e.set(hash(i, 27) * 3, hash(i, 28) * 6, 0); q.setFromEuler(e); sc.setScalar(.3 + hash(i, 29) * (Math.abs(x) > 14 ? 2.5 : .8)); ps.set(x, Y(x, z) + sc.x * .15, z); m4.compose(ps, q, sc); rm.setMatrixAt(kr++, m4); } }
      tm.count = k; rm.count = kr; tm.receiveShadow = rm.castShadow = rm.receiveShadow = true; tm.userData.cls = "scrub"; rm.userData.cls = "ground"; scene.add(tm, rm); }

    // ---------- the frontier town: false fronts, porches, tukuls, a windmill, stelae, domes, the rock church ----------
    const past = new T.Group(), future = new T.Group(); scene.add(past, future); future.visible = false;
    const BLOCK = [], ring = (x, z, r, n = 10) => Array.from({ length: n }, (_, k) => [x + Math.cos(k / n * 6.2832) * r, z + Math.sin(k / n * 6.2832) * r]);   // footprints the trough will not let you walk through
    const rect = (x, z, w, d, rot, dz = 0) => [[-w / 2, -d / 2 + dz], [w / 2, -d / 2 + dz], [w / 2, d / 2 + dz], [-w / 2, d / 2 + dz]].map(([a, b]) => [x + a * Math.cos(rot) + b * Math.sin(rot), z - a * Math.sin(rot) + b * Math.cos(rot)]);
    const planks = (base, seed) => { const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d"); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 16) { g.fillStyle = `rgba(0,0,0,${.12 + hash(y, seed) * .2})`; g.fillRect(0, y, 256, 2); for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,230,200,${hash(k, y + seed) * .08})`; g.fillRect(hash(k * 3, y) * 256, y + 3, 30 + hash(k, y) * 60, 1); } }
      const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; return t; };
    const sign = (txt) => { const c = document.createElement("canvas"); c.width = 512; c.height = 96; const g = c.getContext("2d"); g.fillStyle = "#3b2416"; g.fillRect(0, 0, 512, 96);
      g.fillStyle = "#f1dcb8"; g.font = "bold 54px Georgia"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 256, 50); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
    const mk = (geo, mat, x, y, z, parent = past) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
    const WOOD = ["#f2efea", "#e2ded8", "#faf7f2", "#d6d1ca", "#ebe7e0"];   // neutral boards: the colour comes from the material, which the loop sets
    const WOODMATS = [];
    function falseFront(x, z, side, i, label) {
      const two = hash(i, 7) > .4, w = 9 + hash(i) * 3, d = 9, h = (two ? 7.2 : 4.6) + hash(i, 2) * 1.2, fh = h + 2.2 + hash(i, 3) * 1.6, y0 = Y(x, z), face = side > 0 ? -1 : 1;
      const tex = planks(WOOD[i % WOOD.length], i), mat = new T.MeshStandardMaterial({ color: TUNE.wood, map: tex, roughness: .9 }); WOODMATS.push(mat); tex.repeat.set(w / 6, h / 6);
      const g = new T.Group(); g.position.set(x, y0, z); g.rotation.y = face * Math.PI / 2; past.add(g); BLOCK.push(rect(x, z, w, d, g.rotation.y));
      const body = new T.Mesh(new T.BoxGeometry(w, h, d), mat); body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
      const front = new T.Mesh(new T.BoxGeometry(w + .4, fh, .35), mat); front.position.set(0, fh / 2, d / 2 + .15); front.castShadow = true; g.add(front);
      const s = new T.Mesh(new T.PlaneGeometry(w * .7, w * .13), new T.MeshStandardMaterial({ map: sign(label), roughness: .8 })); s.position.set(0, fh - 1.1, d / 2 + .34); g.add(s);
      const roof = new T.Mesh(new T.BoxGeometry(w + .4, .18, 2.6), new T.MeshStandardMaterial({ color: 0x5a3a26, roughness: .9 })); roof.position.set(0, 3.2, d / 2 + 1.5); roof.castShadow = true; g.add(roof);
      for (const px of [-w / 2, -w / 6, w / 6, w / 2]) { const p = new T.Mesh(new T.BoxGeometry(.18, 3.2, .18), new T.MeshStandardMaterial({ color: 0x4a2e1e })); p.position.set(px, 1.6, d / 2 + 2.7); p.castShadow = true; g.add(p); }
      const boards = new T.Mesh(new T.BoxGeometry(w + .4, .2, 2.8), new T.MeshStandardMaterial({ color: 0x6b4630 })); boards.position.set(0, .1, d / 2 + 1.4); g.add(boards);
      if (two) { const bal = new T.Mesh(new T.BoxGeometry(w * .8, .15, 1.4), mat); bal.position.set(0, 4.3, d / 2 + .9); g.add(bal); for (let k = -4; k <= 4; k++) { const r = new T.Mesh(new T.BoxGeometry(.08, 1, .08), mat); r.position.set(k * w * .09, 4.85, d / 2 + 1.55); g.add(r); }
        const rail = new T.Mesh(new T.BoxGeometry(w * .8, .1, .1), mat); rail.position.set(0, 5.35, d / 2 + 1.55); g.add(rail); for (const wx of [-w / 4, 0, w / 4]) { const win = new T.Mesh(new T.PlaneGeometry(1.1, 1.5), new T.MeshStandardMaterial({ color: 0x2a1a12 })); win.position.set(wx, 5.6, d / 2 + .34); g.add(win); } }
      g.traverse(o => o.userData.cls = "wood");
      for (const wx of [-w / 4, w / 4]) { const win = new T.Mesh(new T.PlaneGeometry(1.4, 1.6), new T.MeshStandardMaterial({ color: 0x1b0f0a, emissive: 0x5a2a10, emissiveIntensity: .35 })); win.position.set(wx, 1.9, d / 2 + .34); g.add(win); }
    }
    const LABELS = ["SALOON", "LIVERY", "WATER & ICE", "BUNA BET", "ASSAY", "GENERAL STORE", "HOTEL ADDIS", "TELEGRAPH"];
    for (let i = 0; i < 8; i++) falseFront(i % 2 ? 17 : -17, -10 - Math.floor(i / 2) * 15 - (i % 2) * 4, i % 2 ? 1 : -1, i, LABELS[i]);
    const STONE = new T.MeshStandardMaterial({ color: 0x9c6a52, roughness: 1, flatShading: true }), THATCH = new T.MeshStandardMaterial({ color: 0xc79a55, roughness: 1, flatShading: true });
    function tukul(x, z, r = 3.2) { const y = Y(x, z); BLOCK.push(ring(x, z, r)); mk(new T.CylinderGeometry(r, r * 1.04, 2.6, 18), STONE, x, y + 1.3, z); mk(new T.ConeGeometry(r * 1.25, 3.4, 18), THATCH, x, y + 4.3, z);
      mk(new T.BoxGeometry(1, 1.8, .2), new T.MeshStandardMaterial({ color: 0x1a0d08 }), x + (x > 0 ? -r : r) * .98, y + .9, z).rotation.y = Math.PI / 2; }
    [[-27, 6], [-30, -18], [-25, -42], [26, 10], [29, -30], [-33, -70], [31, -66]].forEach(([x, z], i) => tukul(x, z, 2.8 + hash(i) * .8));
    // windmill pump and tank beside the street
    const mill = new T.Group(); mill.position.set(-12, Y(-12, -58), -58); past.add(mill);
    { const steel = new T.MeshStandardMaterial({ color: 0x6b6560, roughness: .6, metalness: .5 });
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const leg = new T.Mesh(new T.CylinderGeometry(.06, .08, 12.4, 6), steel); leg.position.set(a * .9, 6, b * .9); leg.rotation.set(-b * .07, 0, a * .07); leg.castShadow = true; mill.add(leg); }
      for (let k = 1; k < 6; k++) { const ring = new T.Mesh(new T.TorusGeometry(1.0 - k * .1, .03, 4, 4), steel); ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 4; ring.position.y = k * 2.1; mill.add(ring); }
      const hub = new T.Group(); hub.position.set(0, 12.4, .6); mill.add(hub);
      for (let k = 0; k < 16; k++) { const b = new T.Mesh(new T.BoxGeometry(.32, 1.9, .03), new T.MeshStandardMaterial({ color: 0xd8d0c4, roughness: .7 })); b.position.y = 1.4; const arm = new T.Group(); arm.rotation.z = k / 16 * Math.PI * 2; arm.add(b); b.rotation.y = .5; hub.add(arm); }
      const vane = new T.Mesh(new T.BoxGeometry(.04, 1.2, 2.6), new T.MeshStandardMaterial({ color: 0xb33a24 })); vane.position.set(0, 12.4, -1.8); mill.add(vane);
      const tank = new T.Mesh(new T.CylinderGeometry(2, 2, 2.4, 20), new T.MeshStandardMaterial({ color: 0x5d4232, roughness: .9 })); tank.position.set(3.5, 1.2, 0); tank.castShadow = true; mill.add(tank);
      mill.userData.hub = hub; } BLOCK.push(ring(-8.5, -58, 2.2));
    // Aksum stelae: tall carved granite with false doors and window bands, a rounded head
    function stelaTex() { const c = document.createElement("canvas"); c.width = 128; c.height = 1024; const g = c.getContext("2d"); g.fillStyle = "#8f7a6c"; g.fillRect(0, 0, 128, 1024);
      for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${hash(i) < .5 ? "40,30,26" : "220,205,190"},${hash(i, 4) * .18})`; g.fillRect(hash(i, 1) * 128, hash(i, 2) * 1024, 2, 2); }
      g.fillStyle = "rgba(30,22,18,.65)"; g.fillRect(44, 930, 40, 94); for (let r = 0; r < 9; r++) { const y = 100 + r * 92; g.fillRect(10, y, 108, 6); g.fillRect(22, y + 20, 20, 30); g.fillRect(54, y + 20, 20, 30); g.fillRect(86, y + 20, 20, 30); }
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
    const STELA = new T.MeshStandardMaterial({ map: stelaTex(), roughness: .85 });
    [[-14, -104, 19], [-8, -118, 24], [14, -112, 15]].forEach(([x, z, h]) => { const y = Y(x, z); BLOCK.push(rect(x, z, 2.6, 1.6, 0)); mk(new T.BoxGeometry(2.4, h, 1.4), STELA, x, y + h / 2, z); mk(new T.CylinderGeometry(1.2, 1.2, 1.4, 20, 1, false, 0, Math.PI), STELA, x, y + h, z).rotation.set(Math.PI / 2, 0, Math.PI / 2); });
    // glass greenhouse domes with green rows inside
    const GLASS = new T.MeshPhysicalMaterial({ color: 0xcfeee0, roughness: .08, transmission: .6, transparent: true, opacity: .42, thickness: .4, metalness: 0, side: T.DoubleSide });
    function dome(x, z, r, parent = past) { const y = Y(x, z); if (parent === past) BLOCK.push(ring(x, z, r * .97, 14)); const d = mk(new T.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), GLASS, x, y, z, parent); d.castShadow = false;
      const ribs = new T.Mesh(new T.SphereGeometry(r * 1.002, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshBasicMaterial({ color: 0xe9f2ec, wireframe: true, transparent: true, opacity: .35 })); ribs.position.copy(d.position); parent.add(ribs);
      const crops = new T.Mesh(new T.CircleGeometry(r * .95, 32), new T.MeshStandardMaterial({ color: 0x3f8f3a, emissive: 0x1d5a1b, emissiveIntensity: .45, roughness: .9 })); crops.rotation.x = -Math.PI / 2; crops.position.set(x, y + .06, z); parent.add(crops); }
    dome(40, -96, 9); dome(55, -78, 6.5); dome(-46, -92, 7.5);
    // the rock church: a cross cut down into the red rock, roof at the ground, walls of the pit around it
    { const RED = new T.MeshStandardMaterial({ color: 0xa04a30, roughness: 1, flatShading: true }), y0 = -CH.depth, H = CH.depth - .3;
      mk(new T.BoxGeometry(14, H, 5), RED, CH.x, y0 + H / 2, CH.z); mk(new T.BoxGeometry(5, H, 14), RED, CH.x, y0 + H / 2, CH.z);
      const cross = new T.MeshStandardMaterial({ color: 0x7a3420, roughness: 1 });
      for (const [w, d] of [[11, 1.6], [1.6, 11], [7, 1.2], [1.2, 7]]) mk(new T.BoxGeometry(w, .25, d), cross, CH.x, -.15 + (w > 8 || d > 8 ? 0 : .2), CH.z);
      for (let r = 0; r < 3; r++) for (const s of [-1, 1]) { const win = mk(new T.BoxGeometry(.9, 1.6, .2), new T.MeshStandardMaterial({ color: 0x1a0b06 }), CH.x + s * 7.02, y0 + 2.5 + r * 2.2, CH.z); win.rotation.y = Math.PI / 2; }
      const pitWall = new T.MeshStandardMaterial({ color: 0x7c3420, roughness: 1, side: T.DoubleSide });
      for (const [dx, dz, ry] of [[CH.half, 0, Math.PI / 2], [-CH.half, 0, Math.PI / 2], [0, CH.half, 0], [0, -CH.half, 0]]) { const w = mk(new T.PlaneGeometry(CH.half * 2, CH.depth + 1), pitWall, CH.x + dx, -CH.depth / 2 - .3, CH.z + dz); w.rotation.y = ry; } }

    // ---------- the future, standing behind the town when the storm clears ----------
    // In the film the future is not glass: it is carved sandstone. Monoliths the size of skyscrapers, the colour of the mesas,
    // cut like Aksum stelae with false doors and window bands and stepped like the rock churches, softened by the haze.
    function carvedTex(seed) { const c = document.createElement("canvas"); c.width = 256; c.height = 1024; const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 256, 1024);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${hash(i, seed) < .5 ? "70,45,35" : "255,240,225"},${hash(i, 4 + seed) * .14})`; g.fillRect(hash(i, 1 + seed) * 256, hash(i, 2 + seed) * 1024, 2, 3); }
      for (let r = 0; r < 14; r++) { const y = 40 + r * 70; g.fillStyle = "rgba(60,38,28,.55)"; g.fillRect(0, y, 256, 7);                                  // the beam ends of Aksum stelae, band by band
        for (let k = 0; k < 4; k++) { if (hash(r, k + seed) < .25) continue; g.fillStyle = "rgba(45,28,20,.62)"; g.fillRect(22 + k * 58, y + 18, 32, 38); g.fillStyle = "rgba(255,235,210,.18)"; g.fillRect(22 + k * 58, y + 18, 32, 4); } }
      g.fillStyle = "rgba(40,25,18,.6)"; g.fillRect(100, 930, 56, 94);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }
    const SPIRES = [], SPIREMATS = [], SPIREFOG = { value: TUNE.spireFog };
    function spire(x, z, h, w, i) {
      const mat = new T.MeshStandardMaterial({ color: TUNE.spire, map: carvedTex(i), roughness: .95, flatShading: true }); SPIREMATS.push(mat);
      mat.onBeforeCompile = sh => { sh.uniforms.uFogK = SPIREFOG; sh.fragmentShader = "uniform float uFogK;\n" + sh.fragmentShader.replace("#include <fog_fragment>",
        "#ifdef USE_FOG\n #ifdef FOG_EXP2\n float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );\n #else\n float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );\n #endif\n gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * uFogK );\n#endif"); };   // the film keeps its spires dark and sharp through the haze
      const g = new T.Group(), y0 = Y(x, z) - 2; g.position.set(x, y0, z); g.rotation.y = (hash(i, 3) - .5) * .5; future.add(g);
      const base = new T.Mesh(new T.CylinderGeometry(w * 1.1, w * 1.6, h * .18, 10), MESA); base.position.y = h * .09; g.add(base);   // it rises out of its own rock
      let y = h * .12, ww = w;
      for (let t = 0; t < 4; t++) { const hh = h * [.42, .24, .16, .1][t], m = new T.Mesh(new T.BoxGeometry(ww, hh, ww * (.62 + hash(i, t) * .2)), mat); m.position.y = y + hh / 2; m.castShadow = true; g.add(m);
        if (t < 3) { const ledge = new T.Mesh(new T.BoxGeometry(ww * 1.06, hh * .04, ww * .8), mat); ledge.position.y = y + hh; g.add(ledge); } y += hh; ww *= .8; }
      const cap = new T.Mesh(new T.CylinderGeometry(ww * .5, ww * .5, ww * .62, 16, 1, false, 0, Math.PI), mat); cap.rotation.set(Math.PI / 2, 0, Math.PI / 2); cap.position.y = y; g.add(cap);   // the rounded head of a stele
      g.traverse(o => o.userData.cls = "spire"); SPIRES.push(g);
    }
    [[60, -330, 210, 34], [105, -300, 170, 28], [150, -360, 240, 40], [25, -420, 150, 26], [215, -300, 150, 26], [-45, -400, 130, 22], [270, -420, 200, 32], [-120, -460, 110, 22]]
      .forEach(([x, z, h, w], i) => spire(x, z, h, w, i));
    for (let i = 0; i < 4; i++) { const x = -60 + i * 70, z = -200 - hash(i, 7) * 50; dome(x, z, 12 + hash(i, 9) * 8, future);
      const f = mk(new T.PlaneGeometry(40, 26), new T.MeshStandardMaterial({ color: 0x77925a, roughness: .9 }), x + 20, Y(x + 20, z + 25) + .08, z + 25, future); f.rotation.x = -Math.PI / 2; }
    // a blue-white train on a long elevated line across the valley, far off on the left as in the film
    const RAIL_Z = -260, PY = new T.MeshStandardMaterial({ color: 0xe9e4de, roughness: .5, metalness: .2 });
    for (let x = -520; x <= 120; x += 30) mk(new T.CylinderGeometry(.8, 1.2, 26, 10), PY, x, Y(x, RAIL_Z) + 13, RAIL_Z, future);
    mk(new T.BoxGeometry(660, 1.3, 2.6), PY, -200, 26.6, RAIL_Z, future);
    const train = new T.Group(); future.add(train);
    for (let k = 0; k < 7; k++) { const car = new T.Mesh(new T.CapsuleGeometry(1.7, 13, 6, 12), new T.MeshStandardMaterial({ color: k % 2 ? 0x6e8fd6 : 0xdfe6f2, emissive: 0x8fb4ff, emissiveIntensity: .25, roughness: .3, metalness: .4 })); car.rotation.z = Math.PI / 2; car.position.x = -k * 16; car.position.y = 29; train.add(car); }
    train.position.z = RAIL_Z;
    // wind turbines on the ridge
    const turbines = [];
    for (let i = 0; i < 5; i++) { const x = -40 + i * 75, z = -280 - hash(i, 3) * 90, y = Y(x, z); mk(new T.CylinderGeometry(.6, 1.1, 70, 10), PY, x, y + 35, z, future);
      const hub = new T.Group(); hub.position.set(x, y + 70, z + 2); future.add(hub); for (let k = 0; k < 3; k++) { const b = new T.Mesh(new T.BoxGeometry(1.4, 26, .4), PY); b.position.y = 13; const a = new T.Group(); a.rotation.z = k * Math.PI * 2 / 3; a.add(b); hub.add(a); } turbines.push(hub); }
    // water drones: four rotors and a yellow 20 L can slung under each
    const drones = [];
    function drone(i) { const g = new T.Group(), dark = new T.MeshStandardMaterial({ color: 0x2b2b2e, roughness: .5, metalness: .6 });
      g.add(new T.Mesh(new T.BoxGeometry(1.4, .3, 1.4), dark)); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const r = new T.Mesh(new T.CylinderGeometry(.55, .55, .05, 16), new T.MeshBasicMaterial({ color: 0x9fd9ff, transparent: true, opacity: .45 })); r.position.set(a * .9, .2, b * .9); g.add(r); }
      const can = new T.Mesh(new T.BoxGeometry(.6, .8, .6), new T.MeshStandardMaterial({ color: 0xdfe9f2, emissive: 0x9fe8ff, emissiveIntensity: .8, roughness: .4 })); can.position.y = -1.2; g.add(can);   // a lit water can, as in the film
      const lamp = new T.Mesh(new T.SphereGeometry(.12, 8, 6), new T.MeshBasicMaterial({ color: 0x7ff0ff })); lamp.position.y = -.2; g.add(lamp);
      g.userData = { r: 30 + hash(i) * 50, a: hash(i, 2) * 6.28, y: 22 + hash(i, 3) * 18, cz: -90 - hash(i, 4) * 60, s: .12 + hash(i, 5) * .12 }; future.add(g); drones.push(g); }
    for (let i = 0; i < 9; i++) drone(i);

    // ---------- the storm: a wall of red dust that comes up the street, whites everything out, and passes ----------
    function cloudTex() { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), img = g.createImageData(256, 256);
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const dx = (x - 128) / 128, dy = (y - 128) / 128, r = Math.hypot(dx, dy), n = fbm(x * .03, y * .03, 5), a = Math.pow(clamp((1 - r) * 2.2, 0, 1), 1.2) * clamp(n * 2.2 - .25, 0, 1);
        const i = (y * 256 + x) * 4; img.data[i] = 200 + n * 55; img.data[i + 1] = 170 + n * 60; img.data[i + 2] = 140 + n * 60; img.data[i + 3] = clamp(a, 0, 1) * 255; }
      g.putImageData(img, 0, 0); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
    const CLOUD = cloudTex(), puffs = [], wall = new T.Group(); scene.add(wall);
    for (let i = 0; i < 180; i++) { const m = new T.Sprite(new T.SpriteMaterial({ map: CLOUD, transparent: true, depthWrite: false, fog: false, opacity: .92, color: new T.Color(0xe2c0a0).multiplyScalar(.86 + hash(i, 4) * .2) }));
      const s = 50 + hash(i, 1) * 110; m.scale.set(s, s * .85, 1); m.position.set((hash(i, 2) - .5) * 700, hash(i, 3) * 170 + s * .2, (hash(i, 5) - .5) * 70); m.userData = { base: m.position.clone(), sp: .3 + hash(i, 6) };
      wall.add(m); puffs.push(m); }
    const STORM = { phase: "far", z: -620, t: 0 };   // far -> coming -> inside -> clearing -> clear
    wall.position.z = STORM.z;
    function callStorm() { if (STORM.phase === "far" || STORM.phase === "clear") { STORM.phase = "coming"; STORM.t = 0; if (STORM.phase === "clear") STORM.z = -620; } }


    if (o.ground === false) { ground.visible = false; }
    // ---- the storm, step by step: it comes up the street, whites everything out, changes the town, and passes ----
    const LINES = { coming: "The storm rolls into town, swallowing the mesas, the saloons and the stelae.", inside: "Red dust fills everything; only the white shamma shows through.", clearing: "The storm blows past, and the future is standing behind the town." };
    let clock = 0;
    function update(dt, t, pl) {
      clock += dt; const px = pl ? pl.x : 0, pz = pl ? pl.z : 0; STORM.t += dt; let line = "";
      if (STORM.phase === "coming") { STORM.z += dt * 42; if (STORM.z > pz - 160) line = LINES.coming; if (STORM.z > pz - 25) { STORM.phase = "inside"; STORM.t = 0; } }
      else if (STORM.phase === "inside") { STORM.z += dt * 42; line = LINES.inside; if (STORM.t > 2.2 && !future.visible) future.visible = true; if (STORM.t > 4.5) { STORM.phase = "clearing"; STORM.t = 0; } }   // the change happens where nobody can see it
      else if (STORM.phase === "clearing") { STORM.z += dt * 42; line = LINES.clearing; if (STORM.t > 5) { STORM.phase = "clear"; STORM.t = 0; } }
      else if (STORM.phase === "clear") { if (STORM.t < 5) line = LINES.clearing; STORM.z = Math.min(STORM.z + dt * 42, 400); }
      const side = STORM.phase === "far" ? 300 : STORM.phase === "coming" ? lerp(300, 0, smooth(-620, -200, STORM.z)) : 0;   // in the film the storm stands off to the right before it comes
      wall.position.set(px + side, 0, STORM.z); wall.scale.x = STORM.phase === "far" ? .55 : lerp(.55, 1, smooth(-620, -200, STORM.z));
      for (const p of puffs) { const b = p.userData.base; p.position.x = b.x + Math.sin(STORM.t * p.userData.sp + b.z) * 6; p.material.rotation += dt * .05 * p.userData.sp; }
      const amount = STORM.phase === "inside" ? smooth(0, 1.2, STORM.t) : STORM.phase === "clearing" ? 1 - smooth(0, 4.5, STORM.t) : STORM.phase === "coming" ? .12 * smooth(-160, -25, STORM.z - pz) : 0;
      mill.userData.hub.rotation.z += dt * (1.2 + amount * 6);
      if (future.visible) { train.position.x = ((clock * 18) % 700) - 540; turbines.forEach((h, i) => h.rotation.z += dt * (.6 + i * .05));
        drones.forEach(d => { const u = d.userData; u.a += dt * u.s; d.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(u.a * 2) * 2, u.cz + Math.sin(u.a) * u.r * .5); d.rotation.y = -u.a; }); }
      return { amount, line, phase: STORM.phase };
    }
    function setFuture(on) { future.visible = on; STORM.phase = on ? "clear" : "far"; STORM.t = 9; STORM.z = on ? 400 : -620; }
    // ---- what the trough needs to know: where things are, and what you cannot walk through ----
    const landmarks = { street: { x: 0, z: -30 }, gate: { x: -7, z: 30 }, tank: { x: mill.position.x + 3.5, z: mill.position.z }, church: { x: CH.x, z: CH.z }, stelae: { x: -8, z: -112 }, saloon: { x: -17, z: -10 }, city: { x: 90, z: -360 } };
    function dispose() { root.traverse(x => { if (x.geometry) x.geometry.dispose(); const m = x.material; if (m) [].concat(m).forEach(mm => { if (mm.map) mm.map.dispose(); mm.dispose(); }); }); }
    return { root, update, dispose, callStorm, setFuture, STORM, future, past, wall, ground, GROUND, MESA, WOODMATS, SPIREMATS, SPIREFOG, mill, train, landmarks, blockers: BLOCK };
  }
  window.MarsWorld = { create, heightAt, CH };
})();
