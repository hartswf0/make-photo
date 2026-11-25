/* Tex Lexington · Ethiopia on Mars — the video-to-game pass of a Genie 4 take (butterfly-halfworld wygwyl/world/tide/full/mars).
   The film gave the blocking: a locked third-person camera behind a rider, a main street of Texas false fronts and Ethiopian tukuls,
   Aksum stelae and glass domes under a pink sky with two moons, a dust storm on the horizon, and behind the town a future city.
   The game keeps all of it and makes the storm do what the film could not: come through town, white everything out, and leave the
   future standing when it clears. Built on make-photo's own parts: donkey/donkey.js (the mount and the pack animals),
   donkey/characters.js (Tex and the settlers), window.makeWaterWifiCan (the 20 L cans). */
(() => {
  "use strict";
  const T = THREE, $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const frac = x => x - Math.floor(x), hash = (a, b = 0) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
  const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); };
  const fbm = (x, y, o = 4) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; };

  // ---------- renderer, camera, light: low golden sun under a butterscotch-pink sky ----------
  const canvas = $("c"), renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(52, 1, .1, 2400);
  const DUST = new T.Color(0xd99a72); scene.fog = new T.FogExp2(DUST.clone(), .0026);
  const hemi = new T.HemisphereLight(0xffd9c2, 0x6b2c1a, 1.35); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffd29a, 2.6); sun.position.set(-120, 70, -160); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 500 }); scene.add(sun, sun.target);

  const sky = new T.Mesh(new T.SphereGeometry(1800, 32, 16), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { uStorm: { value: 0 }, uSun: { value: new T.Vector3(-.55, .25, -.8).normalize() } },
    vertexShader: "varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `varying vec3 vD; uniform float uStorm; uniform vec3 uSun;
      void main(){ float h=clamp(vD.y,0.,1.); vec3 hor=vec3(.96,.76,.58), mid=vec3(.86,.6,.56), zen=vec3(.55,.42,.52);
        vec3 c=mix(hor,mid,smoothstep(0.,.18,h)); c=mix(c,zen,smoothstep(.18,.85,h));
        float s=max(dot(vD,uSun),0.); c+=vec3(1.,.82,.55)*(pow(s,600.)*3.+pow(s,8.)*.25);
        c=mix(c,vec3(.85,.6,.45),uStorm); gl_FragColor=vec4(c,1.); }` }));
  scene.add(sky);
  const moon = (r, x, y, z) => { const m = new T.Mesh(new T.SphereGeometry(r, 24, 16), new T.MeshBasicMaterial({ color: 0xf3e6dc, fog: false })); m.position.set(x, y, z); scene.add(m); return m; };
  const moons = [moon(14, -420, 520, -1300), moon(7, 260, 640, -1350)];

  // ---------- ground: the street is flat, the desert rolls, the rock church is cut down into it ----------
  const CH = { x: 34, z: -150, half: 13, depth: 9 };   // Lalibela-style cross church in its pit
  function heightAt(x, z) {
    const street = smooth(9, 22, Math.abs(x)) * (z < 30 ? 1 : 1);   // 0 on the street, 1 out in the desert
    let h = street * (fbm(x * .02, z * .02) * 4.5 - 1.5) + fbm(x * .09 + 9, z * .09) * .35;
    const d = Math.max(Math.abs(x - CH.x), Math.abs(z - CH.z));
    if (d < CH.half + 2.5) h = lerp(-CH.depth, h, smooth(CH.half, CH.half + 2.5, d));
    return h;
  }
  function groundTex() {   // red regolith with pebbles and tyre-less wagon ruts
    const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
    g.fillStyle = "#a9472a"; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { const r = hash(i, 1), x = hash(i, 2) * 512, y = hash(i, 3) * 512; g.fillStyle = r < .5 ? `rgba(70,22,12,${.12 + r * .2})` : `rgba(235,150,105,${(r - .5) * .35})`; g.fillRect(x, y, 1 + r * 2.5, 1 + r * 2.5); }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(90, 90); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  const G = new T.PlaneGeometry(900, 900, 300, 300); G.rotateX(-Math.PI / 2);
  { const p = G.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i) - 120, y = heightAt(x, z); p.setZ(i, z + 0); p.setY(i, y);
      const street = 1 - smooth(6, 14, Math.abs(x)); c.setRGB(1, .86 + .14 * fbm(x * .05, z * .05), .8).lerp(new T.Color(1.08, .95, .86), street * .6); if (y < -1) c.multiplyScalar(.62); col.set([c.r, c.g, c.b], i * 3); }
    G.setAttribute("color", new T.BufferAttribute(col, 3)); G.computeVertexNormals(); }
  const ground = new T.Mesh(G, new T.MeshStandardMaterial({ map: groundTex(), vertexColors: true, roughness: .97 })); ground.receiveShadow = true; scene.add(ground);

  // ---------- mesas: West Texas buttes in Martian red, banded ----------
  function mesa(x, z, r, h, seed) {
    const g = new T.CylinderGeometry(r * .82, r, h, 40, 10, false), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color();
    for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), a = Math.atan2(vz, vx), k = 1 + (fbm(a * 3 + seed, vy * .05 + seed) - .5) * .5;
      if (Math.abs(vy) < h / 2 - .01) { p.setX(i, vx * k); p.setZ(i, vz * k); }
      const band = .5 + .5 * Math.sin(vy * .55 + fbm(a * 2, seed) * 3); c.setRGB(.74 + .14 * band, .3 + .1 * band, .18 + .06 * band); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute("color", new T.BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })); m.position.set(x, h / 2 + heightAt(x, z) - 2, z); m.castShadow = true; scene.add(m); return m;
  }
  [[-170, -260, 60, 70], [-60, -420, 90, 95], [120, -380, 70, 60], [260, -250, 55, 85], [-300, -120, 70, 55], [330, -60, 60, 50], [40, -560, 120, 110], [-240, -480, 80, 120], [210, 120, 70, 40], [-200, 160, 60, 45]]
    .forEach(([x, z, r, h], i) => mesa(x, z, r, h, i * 7.3));

  // ---------- the frontier town: false fronts, porches, tukuls, a windmill, stelae, domes, the rock church ----------
  const past = new T.Group(), future = new T.Group(); scene.add(past, future); future.visible = false;
  const planks = (base, seed) => { const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d"); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) { g.fillStyle = `rgba(0,0,0,${.12 + hash(y, seed) * .2})`; g.fillRect(0, y, 256, 2); for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,230,200,${hash(k, y + seed) * .08})`; g.fillRect(hash(k * 3, y) * 256, y + 3, 30 + hash(k, y) * 60, 1); } }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; return t; };
  const sign = (txt) => { const c = document.createElement("canvas"); c.width = 512; c.height = 96; const g = c.getContext("2d"); g.fillStyle = "#3b2416"; g.fillRect(0, 0, 512, 96);
    g.fillStyle = "#f1dcb8"; g.font = "bold 54px Georgia"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 256, 50); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
  const mk = (geo, mat, x, y, z, parent = past) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  const WOOD = ["#8a6040", "#7a5236", "#94704e", "#6d4a33", "#a07850"];
  function falseFront(x, z, side, i, label) {
    const w = 9 + hash(i) * 3, d = 9, h = 4.6 + hash(i, 2) * 1.5, fh = h + 2.6 + hash(i, 3) * 1.6, y0 = heightAt(x, z), face = side > 0 ? -1 : 1;
    const tex = planks(WOOD[i % WOOD.length], i), mat = new T.MeshStandardMaterial({ map: tex, roughness: .9 }); tex.repeat.set(w / 6, h / 6);
    const g = new T.Group(); g.position.set(x, y0, z); g.rotation.y = face * Math.PI / 2; past.add(g);
    const body = new T.Mesh(new T.BoxGeometry(w, h, d), mat); body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
    const front = new T.Mesh(new T.BoxGeometry(w + .4, fh, .35), mat); front.position.set(0, fh / 2, d / 2 + .15); front.castShadow = true; g.add(front);
    const s = new T.Mesh(new T.PlaneGeometry(w * .7, w * .13), new T.MeshStandardMaterial({ map: sign(label), roughness: .8 })); s.position.set(0, fh - 1.1, d / 2 + .34); g.add(s);
    const roof = new T.Mesh(new T.BoxGeometry(w + .4, .18, 2.6), new T.MeshStandardMaterial({ color: 0x5a3a26, roughness: .9 })); roof.position.set(0, 3.2, d / 2 + 1.5); roof.castShadow = true; g.add(roof);
    for (const px of [-w / 2, -w / 6, w / 6, w / 2]) { const p = new T.Mesh(new T.BoxGeometry(.18, 3.2, .18), new T.MeshStandardMaterial({ color: 0x4a2e1e })); p.position.set(px, 1.6, d / 2 + 2.7); p.castShadow = true; g.add(p); }
    const boards = new T.Mesh(new T.BoxGeometry(w + .4, .2, 2.8), new T.MeshStandardMaterial({ color: 0x6b4630 })); boards.position.set(0, .1, d / 2 + 1.4); g.add(boards);
    for (const wx of [-w / 4, w / 4]) { const win = new T.Mesh(new T.PlaneGeometry(1.4, 1.6), new T.MeshStandardMaterial({ color: 0x1b0f0a, emissive: 0x5a2a10, emissiveIntensity: .35 })); win.position.set(wx, 1.9, d / 2 + .34); g.add(win); }
  }
  const LABELS = ["SALOON", "LIVERY", "WATER & ICE", "BUNA BET", "ASSAY", "GENERAL STORE", "HOTEL ADDIS", "TELEGRAPH"];
  for (let i = 0; i < 8; i++) falseFront(i % 2 ? 17 : -17, -10 - Math.floor(i / 2) * 15 - (i % 2) * 4, i % 2 ? 1 : -1, i, LABELS[i]);
  const STONE = new T.MeshStandardMaterial({ color: 0x9c6a52, roughness: 1, flatShading: true }), THATCH = new T.MeshStandardMaterial({ color: 0xc79a55, roughness: 1, flatShading: true });
  function tukul(x, z, r = 3.2) { const y = heightAt(x, z); mk(new T.CylinderGeometry(r, r * 1.04, 2.6, 18), STONE, x, y + 1.3, z); mk(new T.ConeGeometry(r * 1.25, 3.4, 18), THATCH, x, y + 4.3, z);
    mk(new T.BoxGeometry(1, 1.8, .2), new T.MeshStandardMaterial({ color: 0x1a0d08 }), x + (x > 0 ? -r : r) * .98, y + .9, z).rotation.y = Math.PI / 2; }
  [[-27, 6], [-30, -18], [-25, -42], [26, 10], [29, -30], [-33, -70], [31, -66]].forEach(([x, z], i) => tukul(x, z, 2.8 + hash(i) * .8));
  // windmill pump and tank beside the street
  const mill = new T.Group(); mill.position.set(-12, heightAt(-12, -58), -58); past.add(mill);
  { const steel = new T.MeshStandardMaterial({ color: 0x6b6560, roughness: .6, metalness: .5 });
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const leg = new T.Mesh(new T.CylinderGeometry(.06, .08, 12.4, 6), steel); leg.position.set(a * .9, 6, b * .9); leg.rotation.set(-b * .07, 0, a * .07); leg.castShadow = true; mill.add(leg); }
    for (let k = 1; k < 6; k++) { const ring = new T.Mesh(new T.TorusGeometry(1.0 - k * .1, .03, 4, 4), steel); ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 4; ring.position.y = k * 2.1; mill.add(ring); }
    const hub = new T.Group(); hub.position.set(0, 12.4, .6); mill.add(hub);
    for (let k = 0; k < 16; k++) { const b = new T.Mesh(new T.BoxGeometry(.32, 1.9, .03), new T.MeshStandardMaterial({ color: 0xd8d0c4, roughness: .7 })); b.position.y = 1.4; const arm = new T.Group(); arm.rotation.z = k / 16 * Math.PI * 2; arm.add(b); b.rotation.y = .5; hub.add(arm); }
    const vane = new T.Mesh(new T.BoxGeometry(.04, 1.2, 2.6), new T.MeshStandardMaterial({ color: 0xb33a24 })); vane.position.set(0, 12.4, -1.8); mill.add(vane);
    const tank = new T.Mesh(new T.CylinderGeometry(2, 2, 2.4, 20), new T.MeshStandardMaterial({ color: 0x5d4232, roughness: .9 })); tank.position.set(3.5, 1.2, 0); tank.castShadow = true; mill.add(tank);
    mill.userData.hub = hub; }
  // Aksum stelae: tall carved granite with false doors and window bands, a rounded head
  function stelaTex() { const c = document.createElement("canvas"); c.width = 128; c.height = 1024; const g = c.getContext("2d"); g.fillStyle = "#8f7a6c"; g.fillRect(0, 0, 128, 1024);
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${hash(i) < .5 ? "40,30,26" : "220,205,190"},${hash(i, 4) * .18})`; g.fillRect(hash(i, 1) * 128, hash(i, 2) * 1024, 2, 2); }
    g.fillStyle = "rgba(30,22,18,.65)"; g.fillRect(44, 930, 40, 94); for (let r = 0; r < 9; r++) { const y = 100 + r * 92; g.fillRect(10, y, 108, 6); g.fillRect(22, y + 20, 20, 30); g.fillRect(54, y + 20, 20, 30); g.fillRect(86, y + 20, 20, 30); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
  const STELA = new T.MeshStandardMaterial({ map: stelaTex(), roughness: .85 });
  [[-14, -104, 19], [-8, -118, 24], [14, -112, 15]].forEach(([x, z, h]) => { const y = heightAt(x, z); mk(new T.BoxGeometry(2.4, h, 1.4), STELA, x, y + h / 2, z); mk(new T.CylinderGeometry(1.2, 1.2, 1.4, 20, 1, false, 0, Math.PI), STELA, x, y + h, z).rotation.set(Math.PI / 2, 0, Math.PI / 2); });
  // glass greenhouse domes with green rows inside
  const GLASS = new T.MeshPhysicalMaterial({ color: 0xcfeee0, roughness: .08, transmission: .6, transparent: true, opacity: .42, thickness: .4, metalness: 0, side: T.DoubleSide });
  function dome(x, z, r, parent = past) { const y = heightAt(x, z); const d = mk(new T.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), GLASS, x, y, z, parent); d.castShadow = false;
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
  function windowsTex(seed) { const c = document.createElement("canvas"); c.width = 128; c.height = 512; const g = c.getContext("2d"); g.fillStyle = "#c98a5a"; g.fillRect(0, 0, 128, 512);
    for (let y = 8; y < 512; y += 18) for (let x = 6; x < 128; x += 14) { const on = hash(x + seed, y) > .45; g.fillStyle = on ? "#fff1c8" : "#4b2a1b"; g.fillRect(x, y, 8, 10); }
    g.fillStyle = "rgba(255,255,255,.25)"; for (let y = 0; y < 512; y += 72) g.fillRect(0, y, 128, 3); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t; }
  const COPPER = i => new T.MeshStandardMaterial({ map: windowsTex(i), emissiveMap: windowsTex(i), emissive: 0xffc890, emissiveIntensity: .55, roughness: .45, metalness: .55, color: 0xffe0c8 });
  function crossTower(x, z, h, w, i) {   // a tower whose footprint is the cross of the rock churches, stepped like them
    const m = COPPER(i), y = heightAt(x, z);
    for (let s = 0; s < 3; s++) { const hh = h * (1 - s * .28), ww = w * (1 - s * .22); mk(new T.BoxGeometry(ww, hh, ww * .36), m, x, y + hh / 2, z, future); mk(new T.BoxGeometry(ww * .36, hh, ww), m, x, y + hh / 2, z, future); }
    mk(new T.CylinderGeometry(.25, .25, h * .25, 6), new T.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffd08a, emissiveIntensity: 1.2 }), x, y + h + h * .12, z, future);
  }
  [[-70, -190, 120, 26], [-30, -250, 160, 30], [25, -230, 135, 24], [75, -200, 105, 22], [-110, -260, 90, 20], [120, -270, 150, 28], [0, -320, 190, 34], [-160, -210, 70, 18], [160, -180, 80, 18]]
    .forEach(([x, z, h, w], i) => crossTower(x, z, h, w, i));
  for (let i = 0; i < 6; i++) { const x = -150 + i * 60, z = -170 - hash(i, 7) * 60; dome(x, z, 14 + hash(i, 9) * 10, future);
    const f = mk(new T.PlaneGeometry(40, 26), new T.MeshStandardMaterial({ color: 0x4d9a3d, roughness: .9 }), x + 20, heightAt(x + 20, z + 25) + .08, z + 25, future); f.rotation.x = -Math.PI / 2; }
  // a train on tall pylons crossing the plain
  const RAIL_Z = -150, PY = new T.MeshStandardMaterial({ color: 0xe8e2da, roughness: .4, metalness: .3 });
  for (let x = -400; x <= 400; x += 26) mk(new T.CylinderGeometry(.7, 1.1, 22, 10), PY, x, heightAt(x, RAIL_Z) + 11, RAIL_Z, future);
  mk(new T.BoxGeometry(820, 1.2, 2.4), PY, 0, 22.6, RAIL_Z, future);
  const train = new T.Group(); future.add(train);
  for (let k = 0; k < 6; k++) { const car = new T.Mesh(new T.CapsuleGeometry(1.6, 12, 6, 12), new T.MeshStandardMaterial({ color: 0xf6f2ea, emissive: 0xffe2b0, emissiveIntensity: .25, roughness: .25, metalness: .4 })); car.rotation.z = Math.PI / 2; car.position.x = -k * 15; car.position.y = 25; train.add(car); }
  train.position.z = RAIL_Z;
  // wind turbines on the ridge
  const turbines = [];
  for (let i = 0; i < 5; i++) { const x = -260 + i * 120, z = -340 - hash(i, 3) * 60, y = heightAt(x, z); mk(new T.CylinderGeometry(1, 1.6, 60, 10), PY, x, y + 30, z, future);
    const hub = new T.Group(); hub.position.set(x, y + 60, z + 2); future.add(hub); for (let k = 0; k < 3; k++) { const b = new T.Mesh(new T.BoxGeometry(1.4, 26, .4), PY); b.position.y = 13; const a = new T.Group(); a.rotation.z = k * Math.PI * 2 / 3; a.add(b); hub.add(a); } turbines.push(hub); }
  // water drones: four rotors and a yellow 20 L can slung under each
  const drones = [];
  function drone(i) { const g = new T.Group(), dark = new T.MeshStandardMaterial({ color: 0x2b2b2e, roughness: .5, metalness: .6 });
    g.add(new T.Mesh(new T.BoxGeometry(1.4, .3, 1.4), dark)); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const r = new T.Mesh(new T.CylinderGeometry(.55, .55, .05, 16), new T.MeshBasicMaterial({ color: 0x9fd9ff, transparent: true, opacity: .45 })); r.position.set(a * .9, .2, b * .9); g.add(r); }
    const can = new T.Mesh(new T.BoxGeometry(.5, .7, .3), new T.MeshStandardMaterial({ color: 0xf0b81c, roughness: .6 })); can.position.y = -1.2; g.add(can);
    const lamp = new T.Mesh(new T.SphereGeometry(.12, 8, 6), new T.MeshBasicMaterial({ color: 0x7ff0ff })); lamp.position.y = -.2; g.add(lamp);
    g.userData = { r: 30 + hash(i) * 50, a: hash(i, 2) * 6.28, y: 22 + hash(i, 3) * 18, cz: -90 - hash(i, 4) * 60, s: .12 + hash(i, 5) * .12 }; future.add(g); drones.push(g); }
  for (let i = 0; i < 9; i++) drone(i);

  // ---------- the storm: a wall of red dust that comes up the street, whites everything out, and passes ----------
  function cloudTex() { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const dx = (x - 128) / 128, dy = (y - 128) / 128, r = Math.hypot(dx, dy), n = fbm(x * .03, y * .03, 5), a = Math.pow(clamp((1 - r) * 2.2, 0, 1), 1.2) * clamp(n * 2.2 - .25, 0, 1);
      const i = (y * 256 + x) * 4; img.data[i] = 150 + n * 90; img.data[i + 1] = 70 + n * 60; img.data[i + 2] = 44 + n * 40; img.data[i + 3] = clamp(a, 0, 1) * 255; }
    g.putImageData(img, 0, 0); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
  const CLOUD = cloudTex(), puffs = [], wall = new T.Group(); scene.add(wall);
  for (let i = 0; i < 180; i++) { const m = new T.Sprite(new T.SpriteMaterial({ map: CLOUD, transparent: true, depthWrite: false, fog: false, opacity: .92, color: new T.Color().setHSL(.04, .45, .62 + hash(i, 4) * .2) }));
    const s = 50 + hash(i, 1) * 110; m.scale.set(s, s * .85, 1); m.position.set((hash(i, 2) - .5) * 700, hash(i, 3) * 170 + s * .2, (hash(i, 5) - .5) * 70); m.userData = { base: m.position.clone(), sp: .3 + hash(i, 6) };
    wall.add(m); puffs.push(m); }
  const STORM = { phase: "far", z: -620, t: 0 };   // far -> coming -> inside -> clearing -> clear
  wall.position.z = STORM.z;
  function callStorm() { if (STORM.phase === "far" || STORM.phase === "clear") { STORM.phase = "coming"; STORM.t = 0; if (STORM.phase === "clear") STORM.z = -620; } }
  $("storm").onclick = callStorm;

  // ---------- people: Tex, and the settlers of the colony ----------
  const surfaceAt = (x, z) => heightAt(x, z);
  const make = spec => { try { return window.makeExpeditionCharacter(T, Object.assign({ textureBase: "../donkey/" }, spec)); } catch (e) { console.warn("character", spec.id, e); return null; } };
  const mount = window.makeDonkey({ assetPath: "../donkey/", shells: 10 }); mount.group.scale.setScalar(1.22); scene.add(mount.group); mount.place(0, 0, Math.PI, heightAt); mount.state.brainOff = true; mount.setLoad(0);
  let SADDLE = .64;   // the seated body's floor, set so the hips sit on the donkey's back
  mount.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // Tex Lexington: a Black Ethiopian-Texan cowboy in his thirties. Felt cowboy hat, white cotton shamma with a red tibeb border, brown shirt, denim.
  const tex = make({ id: "tex", name: "Tex Lexington", role: "Rider", scale: 1.0, build: 1.06, fem: .08, skinHex: 0x3a2418, hair: "feltHat", hatHex: 0x9a7650, beard: true, hairHex: 0x141110,
    outer: "shamma", coatHex: 0xe9e2d2, shirtHex: 0x5a3b26, trouserHex: 0x2f3c52, tibebTrim: true, pose: "seatedWatch" });
  if (tex) { scene.add(tex.group); tex.group.traverse(o => { if (o.isMesh) o.castShadow = true; }); if (tex.label) tex.label.visible = false; tex.group.children.forEach(c => { if (c.isSprite) c.visible = false; }); }
  // settlers: Black Ethiopian men and women in white cotton, walking the street; two lead pack donkeys with yellow 20 L cans
  const SETTLERS = [
    { id: "almaz", fem: .82, skinHex: 0x4a3326, hair: "shashWrap", wrapHex: 0xefe9dc, outer: "shamma", coatHex: 0xece5d6, shirtHex: 0x8c7a62, trouserHex: 0x3b332c, tibebTrim: true, path: [[-7, -30], [-7, -80]] },
    { id: "dawit", fem: .1, skinHex: 0x3f291d, hair: "turban", wrapHex: 0xf2ede2, beard: true, outer: "shamma", coatHex: 0xe6dfcf, shirtHex: 0x4a463f, trouserHex: 0x2a2826, path: [[6, -70], [6, -20]], donkey: true },
    { id: "selam", fem: .78, skinHex: 0x452e21, hair: "cornrowBraids", hairHex: 0x141210, outer: "shamma", coatHex: 0xf0eadf, shirtHex: 0x6e5948, trouserHex: 0x4a3c32, tibebTrim: true, path: [[-5, -100], [-5, -40]] },
    { id: "yonas", fem: .12, skinHex: 0x3d281c, hair: "croppedCoily", hairHex: 0x171412, outer: "shamma", coatHex: 0xe1d9c8, shirtHex: 0x474a44, trouserHex: 0x26292b, path: [[9, -15], [9, -95]], donkey: true },
    { id: "hirut", fem: .85, skinHex: 0x4b3325, hair: "shashWrap", wrapHex: 0xe9e2d0, outer: "shamma", coatHex: 0xeee8da, shirtHex: 0x7a6650, trouserHex: 0x3a322b, path: [[-10, -60], [-10, -10]] }
  ];
  const people = [];
  function addSettlers() {
    for (const s of SETTLERS) {
      const ch = make(Object.assign({ name: s.id, role: "Settler", scale: s.fem > .5 ? .97 : 1.01, build: 1.0, x: s.path[0][0], z: s.path[0][1], pose: "walk" }, s)); if (!ch) continue;
      scene.add(ch.group); ch.group.traverse(o => { if (o.isMesh) o.castShadow = true; if (o.isSprite) o.visible = false; });
      let d = null; if (s.donkey) { d = window.makeDonkey({ assetPath: "../donkey/", shells: 6 }); scene.add(d.group); d.state.brainOff = true; d.setCargo([{ kg: 20, slot: "L" }, { kg: 20, slot: "R" }]);
        for (const side of [-1, 1]) { const c = window.makeWaterWifiCan ? window.makeWaterWifiCan(T, { textureBase: "../donkey/", withPourAndRipples: false }) : null; if (c) { const o = c.canRoot; o.scale.setScalar(.9); o.position.set(side * .42, .78, 0); d.group.add(o); } } }
      people.push({ s, ch, d, u: hash(people.length) });
    }
  }

  // ---------- control: W A S D ride, Shift gallops; the left thumb on a phone ----------
  const keys = {}, stick = { id: null, x0: 0, y0: 0, dx: 0, dy: 0 };
  addEventListener("keydown", e => { const k = e.key.toLowerCase(); keys[k] = 1; if (k === "f") callStorm(); if (k === "c") setWide(!wide); if (k.startsWith("arrow") || k === " ") e.preventDefault(); });
  addEventListener("keyup", e => { keys[e.key.toLowerCase()] = 0; });
  canvas.addEventListener("pointerdown", e => { if (e.pointerType !== "touch" || stick.id !== null) return; Object.assign(stick, { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }); const el = $("stick"); el.hidden = false; el.style.left = e.clientX + "px"; el.style.top = e.clientY + "px"; });
  addEventListener("pointermove", e => { if (e.pointerId !== stick.id) return; const dx = e.clientX - stick.x0, dy = e.clientY - stick.y0, r = Math.min(1, Math.hypot(dx, dy) / 50), a = Math.atan2(dy, dx);
    stick.dx = Math.cos(a) * r; stick.dy = Math.sin(a) * r; $("stick").firstChild.style.transform = `translate(${stick.dx * 33}px,${stick.dy * 33}px)`; });
  const up = e => { if (e.pointerId === stick.id) { stick.id = null; stick.dx = stick.dy = 0; $("stick").hidden = true; } }; addEventListener("pointerup", up); addEventListener("pointercancel", up);
  let wide = false; const setWide = v => { wide = v; $("cam").setAttribute("aria-pressed", v); }; $("cam").textContent = "Wide"; $("cam").onclick = () => setWide(!wide);
  const AUTO = { on: false, steer: 0, throttle: 0, pace: 1 };   // for the study: drive the same beats as the Genie take

  // ---------- the words: the beats the Genie take was given, shown as the storm plays them ----------
  const say = t => { const el = $("line"); el.textContent = t; el.classList.toggle("on", !!t); };

  // ---------- loop ----------
  const cam = { p: new T.Vector3(0, 4, 8), l: new T.Vector3() }, fwd = new T.Vector3(), tmp = new T.Vector3();
  let last = performance.now(), clock = 0;
  function frame(now) {
    try { frameBody(now); } catch (e) { console.error('frame', e && e.stack || e); }
    requestAnimationFrame(frame);
  }
  function frameBody(now) {
    if (window.__mars) window.__mars.frames = (window.__mars.frames || 0) + 1;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const w = innerWidth, h = innerHeight; if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    if (!window.__mars || !window.__mars.paused) step(dt);
    renderer.render(scene, camera);
  }
  function step(dt) {
    clock += dt;
    // ride
    let thr = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - stick.dy, st = (keys.a || keys.arrowleft ? 1 : 0) - (keys.d || keys.arrowright ? 1 : 0) - stick.dx;
    let pace = keys.shift ? 3 : 1; if (AUTO.on) { thr = AUTO.throttle; st = AUTO.steer; pace = AUTO.pace; }
    mount.update(dt, { throttle: clamp(thr, -1, 1), steer: clamp(st, -1, 1), pace }, heightAt);
    const M = mount.state; fwd.set(Math.sin(M.heading), 0, Math.cos(M.heading));
    if (tex) { tex.place(M.x - fwd.x * .05, M.z - fwd.z * .05, M.heading, () => (M.y || heightAt(M.x, M.z)) + 1.02 * 1.22 - .55); tex.update(dt, clock, { pose: "seatedWatch", seated: true, lodDist: 3 }); tex.group.position.y = (M.y || 0) + SADDLE; tex.group.rotation.x = -(M.pitch || 0); }
    // people walk their paths and turn back
    for (const p of people) { const [a, b] = p.s.path, L = Math.hypot(b[0] - a[0], b[1] - a[1]), sp = 1.1 / L; p.u = (p.u + dt * sp) % 2; const k = p.u < 1 ? p.u : 2 - p.u, dir = p.u < 1 ? 1 : -1;
      const x = lerp(a[0], b[0], k), z = lerp(a[1], b[1], k), hd = Math.atan2((b[0] - a[0]) * dir, (b[1] - a[1]) * dir);
      p.ch.place(x, z, hd, surfaceAt); p.ch.update(dt, clock, { pose: "walk", surfaceAt, lodDist: Math.hypot(camera.position.x - x, camera.position.z - z) });
      if (p.d) { p.d.state.x = x + Math.cos(hd) * 1.3 - Math.sin(hd) * 1.4; p.d.state.z = z - Math.sin(hd) * 1.3 - Math.cos(hd) * 1.4; p.d.state.heading = hd; p.d.update(dt, { throttle: .5, steer: 0, pace: 0 }, heightAt); } }
    // windmill, train, turbines, drones
    mill.userData.hub.rotation.z += dt * (1.2 + STORM_W() * 6);
    if (future.visible) { train.position.x = ((clock * 22) % 900) - 450; turbines.forEach((t, i) => t.rotation.z += dt * (.6 + i * .05));
      drones.forEach(d => { const u = d.userData; u.a += dt * u.s; d.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(u.a * 2) * 2, u.cz + Math.sin(u.a) * u.r * .5); d.rotation.y = -u.a; }); }
    // storm
    stormStep(dt);
    // camera: locked behind and above, like the Genie take; Wide pulls back to see the street
    const back = wide ? 16 : 6.8, high = wide ? 7.5 : 3.3, ahead = wide ? 18 : 9;
    tmp.set(M.x, (M.y || 0), M.z); const goal = tmp.clone().addScaledVector(fwd, -back); goal.y = Math.max(heightAt(goal.x, goal.z) + 1.4, tmp.y + high);
    cam.p.lerp(goal, 1 - Math.exp(-dt * 4)); cam.l.lerp(tmp.clone().addScaledVector(fwd, ahead).add(new T.Vector3(0, 1.9, 0)), 1 - Math.exp(-dt * 6));
    camera.position.copy(cam.p); camera.lookAt(cam.l);
    sun.position.set(M.x - 120, 70, M.z - 160); sun.target.position.set(M.x, 0, M.z);
    $("where").textContent = STORM.phase === "inside" ? "Ethiopia on Mars · inside the storm" : future.visible ? "Ethiopia on Mars · after the storm" : M.z < -95 ? "Ethiopia on Mars · the stelae" : "Ethiopia on Mars · Main Street";
  }
  function STORM_W() { return STORM.phase === "inside" ? 1 : STORM.phase === "coming" ? clamp((STORM.z + 620) / 600, 0, 1) * .6 : 0; }
  function stormStep(dt) {
    const M = mount.state; STORM.t += dt;
    if (STORM.phase === "coming") { STORM.z += dt * 42; say(STORM.z > M.z - 160 ? "The storm rolls into town, swallowing the mesas, the saloons and the stelae." : "");
      if (STORM.z > M.z - 25) { STORM.phase = "inside"; STORM.t = 0; } }
    else if (STORM.phase === "inside") { STORM.z += dt * 42; say("Red dust fills everything; only Tex's white shamma shows through.");
      if (STORM.t > 2.2 && !future.visible) future.visible = true;   // the change happens where nobody can see it
      if (STORM.t > 4.5) { STORM.phase = "clearing"; STORM.t = 0; } }
    else if (STORM.phase === "clearing") { STORM.z += dt * 42; say("The storm blows past, and the future is standing behind the town.");
      if (STORM.t > 5) { STORM.phase = "clear"; STORM.t = 0; } }
    else if (STORM.phase === "clear") { if (STORM.t > 5) say(""); STORM.z = Math.min(STORM.z + dt * 42, 400); }
    wall.position.set(M.x, 0, STORM.z);
    for (const p of puffs) { const b = p.userData.base; p.position.x = b.x + Math.sin(STORM.t * p.userData.sp + b.z) * 6; p.material.rotation += dt * .05 * p.userData.sp; }
    const dens = STORM.phase === "inside" ? lerp(.0026, .09, smooth(0, 1.2, STORM.t)) : STORM.phase === "clearing" ? lerp(.09, .0016, smooth(0, 4.5, STORM.t)) : STORM.phase === "clear" ? .0016 : .0026 + .01 * smooth(-160, -25, STORM.z - M.z);
    scene.fog.density = dens; sky.material.uniforms.uStorm.value = clamp(dens / .03, 0, 1); hemi.intensity = 1.35 - .5 * clamp(dens / .05, 0, 1); sun.intensity = 2.6 * (1 - clamp(dens / .03, 0, 1) * .8);
  }

  // ---------- boot ----------
  const done = () => { $("boot").classList.add("done"); window.__ready = true; };
  try { addSettlers(); } catch (e) { console.warn("settlers", e); }
  requestAnimationFrame(t => { last = t; frame(t); setTimeout(done, 300); });
  // hooks for the study and for checks
  window.__mars = { setSaddle: v => SADDLE = v, paused: false, sim: (sec, ctl) => { if (ctl) Object.assign(AUTO, ctl, { on: true }); for (let t = 0; t < sec; t += .05) step(.05); }, mount, tex, STORM, callStorm, AUTO, setWide, say, future, keys, heightAt, place: (x, z, h) => { mount.place(x, z, h, heightAt); cam.p.set(x, 5, z + 8); } };
})();
