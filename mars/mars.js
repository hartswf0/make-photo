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

  // ---------- renderer, camera, light: the film's light, a low warm sun from behind-left in a pale rose haze ----------
  // Every colour below starts from the Genie take, measured region by region (see v2g/palette.json), then corrected by the loop in v2g/loop.py.
  const TUNE = Object.assign({"ground": "#f5a689", "mesa": "#ff7748", "wood": "#ffeecc", "spire": "#ce7551", "fog": "#e2cfc6", "fogD": 0.00211, "skyTop": [0.6334, 0.6164, 0.7127], "skyHor": [0.9905, 0.9242, 0.8567], "sun": 3.204, "hemi": 0.362, "exposure": 1.0, "sunDir": [110, 55, -150], "spireFog": 0.87}, window.MARS_TUNE || {});
  const canvas = $("c"), renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = TUNE.exposure;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(50, 1, .1, 3000);
  const HAZE = new T.Color(TUNE.fog), STORMCOL = new T.Color(0xc98a62); let BASE_FOG = TUNE.fogD; scene.fog = new T.FogExp2(HAZE.clone(), TUNE.fogD);
  const hemi = new T.HemisphereLight(0xf3e4dc, 0x8a5a44, TUNE.hemi); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffe2bc, TUNE.sun); sun.position.set(-120, 70, -160); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 500 }); sun.shadow.radius = 3; scene.add(sun, sun.target);

  const sky = new T.Mesh(new T.SphereGeometry(2200, 32, 16), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { uStorm: { value: 0 }, uSun: { value: new T.Vector3(...TUNE.sunDir).normalize() }, uTop: { value: new T.Vector3(...TUNE.skyTop) }, uHor: { value: new T.Vector3(...TUNE.skyHor) } },
    vertexShader: "varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `varying vec3 vD; uniform float uStorm; uniform vec3 uSun, uTop, uHor;
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float nz(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y); }
      void main(){ float h=clamp(vD.y,0.,1.); vec3 c=mix(uHor,uTop,smoothstep(0.,.55,h));
        vec2 q=vD.xz/(vD.y+.18)*1.6; float cl=nz(q)*.6+nz(q*2.3)*.4; c=mix(c,uHor*1.03,smoothstep(.55,.85,cl)*.35*smoothstep(.02,.25,h));
        float s=max(dot(vD,uSun),0.); c+=vec3(1.,.9,.76)*(pow(s,500.)*1.6+pow(s,10.)*.12);
        c=mix(c,vec3(.80,.55,.42),uStorm); gl_FragColor=vec4(c,1.); }` }));
  sky.userData.cls = "sky"; scene.add(sky);
  const moon = (r, x, y, z) => { const m = new T.Mesh(new T.SphereGeometry(r, 24, 16), new T.MeshBasicMaterial({ color: 0xf6ede8, fog: false, transparent: true, opacity: .85 })); m.position.set(x, y, z); m.userData.cls = "sky"; scene.add(m); return m; };
  const moons = [moon(16, -300, 700, -1300), moon(8, -520, 560, -1250)];

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
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14000; i++) { const r = hash(i, 1), x = hash(i, 2) * 512, y = hash(i, 3) * 512; g.fillStyle = r < .55 ? `rgba(90,45,30,${.06 + r * .16})` : `rgba(255,235,215,${(r - .55) * .5})`; g.fillRect(x, y, 1 + r * 2, 1 + r * 2); }
    for (let i = 0; i < 70; i++) { const x = hash(i, 8) * 512, y = hash(i, 9) * 512, r = 3 + hash(i, 10) * 6; g.fillStyle = "rgba(80,40,25,.18)"; g.beginPath(); g.ellipse(x, y, r, r * .6, hash(i, 11) * 3, 0, 6.3); g.fill(); }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(120, 120); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  const G = new T.PlaneGeometry(900, 900, 300, 300); G.rotateX(-Math.PI / 2);
  { const p = G.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i) - 120, y = heightAt(x, z); p.setZ(i, z + 0); p.setY(i, y);
      const street = 1 - smooth(5, 12, Math.abs(x)), rut = street * (Math.exp(-Math.pow((Math.abs(x) - 1.3) / .35, 2)) * .14), n = fbm(x * .04, z * .04);
      c.setRGB(1, 1, 1).multiplyScalar(.9 + .16 * n - rut).lerp(new T.Color(1.04, 1.02, 1), street * .4); if (y < -1) c.multiplyScalar(.7); col.set([c.r, c.g, c.b], i * 3); }
    G.setAttribute("color", new T.BufferAttribute(col, 3)); G.computeVertexNormals(); }
  const GROUND = new T.MeshStandardMaterial({ color: TUNE.ground, map: groundTex(), vertexColors: true, roughness: .97 });
  const ground = new T.Mesh(G, GROUND); ground.receiveShadow = true; ground.userData.cls = "ground"; scene.add(ground);
  { const far = new T.Mesh(new T.RingGeometry(440, 3000, 64, 1), new T.MeshStandardMaterial({ color: TUNE.ground, roughness: 1 })); far.rotation.x = -Math.PI / 2; far.position.set(0, -1.2, -120); far.userData.cls = "ground"; scene.add(far); GROUND.userData.far = far.material; }   // the plain runs on to the far mesas
  // scrub and stones, the film's sage tufts along the street and out in the desert
  { const tuft = new T.ConeGeometry(.45, .5, 7), rock = new T.DodecahedronGeometry(.4, 0), n = 1400;
    const tm = new T.InstancedMesh(tuft, new T.MeshStandardMaterial({ color: 0xb3ad80, roughness: 1, flatShading: true }), n), rm = new T.InstancedMesh(rock, new T.MeshStandardMaterial({ color: 0xb57a5a, roughness: 1, flatShading: true }), 700);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), ps = new T.Vector3(); let k = 0, kr = 0;
    for (let i = 0; i < 6000 && (k < n || kr < 700); i++) { const x = (hash(i, 21) - .5) * 220, z = 30 - hash(i, 22) * 330; if (Math.abs(x) < 3.2) continue; if (Math.max(Math.abs(x - CH.x), Math.abs(z - CH.z)) < CH.half + 3) continue;
      const big = Math.abs(x) > 8 || hash(i, 23) < .3, s = .5 + hash(i, 24) * 1.1;
      if (k < n && big) { e.set(0, hash(i, 25) * 6, 0); q.setFromEuler(e); sc.set(s * 1.2, s * (.6 + hash(i, 26) * .5), s * 1.2); ps.set(x, heightAt(x, z) + sc.y * .3, z); m4.compose(ps, q, sc); tm.setMatrixAt(k++, m4); }
      else if (kr < 700) { e.set(hash(i, 27) * 3, hash(i, 28) * 6, 0); q.setFromEuler(e); sc.setScalar(.3 + hash(i, 29) * (Math.abs(x) > 14 ? 2.5 : .8)); ps.set(x, heightAt(x, z) + sc.x * .15, z); m4.compose(ps, q, sc); rm.setMatrixAt(kr++, m4); } }
    tm.count = k; rm.count = kr; tm.receiveShadow = rm.castShadow = rm.receiveShadow = true; tm.userData.cls = "scrub"; rm.userData.cls = "ground"; scene.add(tm, rm); }

  // ---------- mesas: layered sandstone buttes like the film's, vertical walls, stepped tiers, strata, a talus skirt ----------
  const MESA = new T.MeshStandardMaterial({ color: TUNE.mesa, vertexColors: true, roughness: 1, flatShading: true });
  function tier(r, h, seed, sides = 28) {
    const pts = []; for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2, k = .72 + fbm(Math.cos(a) * 1.7 + seed, Math.sin(a) * 1.7 + seed, 3) * .62; pts.push(new T.Vector2(Math.cos(a) * r * k * 1.25, Math.sin(a) * r * k * .8)); }
    const g = new T.ExtrudeGeometry(new T.Shape(pts), { depth: h, bevelEnabled: false, steps: Math.max(2, Math.round(h / 6)) }); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i), z = p.getZ(i); if (y > .1 && y < h - .1) { const w = (fbm(x * .08 + seed, y * .3 + z * .08) - .5) * 2.4; p.setX(i, x + w); p.setZ(i, z + w * .6); }
      const band = .5 + .5 * Math.sin(y * .9 + fbm(x * .02, seed) * 4), pale = smooth(h * .55, h, y) * .12; col.set([.9 + .12 * band + pale, .86 + .1 * band + pale, .84 + .08 * band + pale], i * 3); }
    g.setAttribute("color", new T.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  }
  function mesa(x, z, r, h, seed) {
    const g = new T.Group(), y0 = heightAt(x, z) - 3; g.position.set(x, y0, z); g.rotation.y = hash(seed) * 6.28;
    const skirt = new T.Mesh(new T.CylinderGeometry(r * 1.05, r * 1.6, h * .28, 24, 2), MESA); skirt.position.y = h * .14; g.add(skirt);
    let y = h * .22, rr = r;
    for (let t = 0; t < 3 && y < h; t++) { const hh = (h - y) * (t === 2 ? 1 : .45 + hash(seed, t) * .25), m = new T.Mesh(tier(rr, hh, seed + t * 3.1), MESA); m.position.y = y; m.castShadow = m.receiveShadow = true; g.add(m); y += hh; rr *= .72 + hash(seed, t + 5) * .18; }
    g.traverse(o => o.userData.cls = Math.hypot(x, z) > 650 ? "mesa_far" : "mesa_near"); scene.add(g); return g;
  }
  [[-250, -190, 60, 60], [-200, -480, 80, 70], [250, -480, 75, 60], [380, -260, 55, 70], [-480, -300, 95, 60], [470, -60, 60, 45], [60, -760, 150, 100], [-400, -700, 110, 90], [400, -700, 90, 85], [300, 160, 70, 40], [-280, 200, 60, 45], [-150, -40, 34, 52]]
    .forEach(([x, z, r, h], i) => mesa(x, z, r, h, i * 7.3));
  // the far ring: big buttes 700-1100 m out that the haze turns lavender, as on the film's horizon
  for (let i = 0; i < 16; i++) { const b = -1.25 + i / 15 * 2.5 + (hash(i, 40) - .5) * .08, d = 720 + hash(i, 41) * 380; mesa(Math.sin(b) * d, -Math.cos(b) * d - 120, 90 + hash(i, 42) * 120, 70 + hash(i, 43) * 90, 50 + i * 3.7); }

  // ---------- the frontier town: false fronts, porches, tukuls, a windmill, stelae, domes, the rock church ----------
  const past = new T.Group(), future = new T.Group(); scene.add(past, future); future.visible = false;
  const planks = (base, seed) => { const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d"); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) { g.fillStyle = `rgba(0,0,0,${.12 + hash(y, seed) * .2})`; g.fillRect(0, y, 256, 2); for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,230,200,${hash(k, y + seed) * .08})`; g.fillRect(hash(k * 3, y) * 256, y + 3, 30 + hash(k, y) * 60, 1); } }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; return t; };
  const sign = (txt) => { const c = document.createElement("canvas"); c.width = 512; c.height = 96; const g = c.getContext("2d"); g.fillStyle = "#3b2416"; g.fillRect(0, 0, 512, 96);
    g.fillStyle = "#f1dcb8"; g.font = "bold 54px Georgia"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 256, 50); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
  const mk = (geo, mat, x, y, z, parent = past) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  const WOOD = ["#f2efea", "#e2ded8", "#faf7f2", "#d6d1ca", "#ebe7e0"];   // neutral boards: the colour comes from the material, which the loop sets
  const WOODMATS = [];
  function falseFront(x, z, side, i, label) {
    const two = hash(i, 7) > .4, w = 9 + hash(i) * 3, d = 9, h = (two ? 7.2 : 4.6) + hash(i, 2) * 1.2, fh = h + 2.2 + hash(i, 3) * 1.6, y0 = heightAt(x, z), face = side > 0 ? -1 : 1;
    const tex = planks(WOOD[i % WOOD.length], i), mat = new T.MeshStandardMaterial({ color: TUNE.wood, map: tex, roughness: .9 }); WOODMATS.push(mat); tex.repeat.set(w / 6, h / 6);
    const g = new T.Group(); g.position.set(x, y0, z); g.rotation.y = face * Math.PI / 2; past.add(g);
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
      "#ifdef USE_FOG\n float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );\n gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * uFogK );\n#endif"); };   // the film keeps its spires dark and sharp through the haze
    const g = new T.Group(), y0 = heightAt(x, z) - 2; g.position.set(x, y0, z); g.rotation.y = (hash(i, 3) - .5) * .5; future.add(g);
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
    const f = mk(new T.PlaneGeometry(40, 26), new T.MeshStandardMaterial({ color: 0x77925a, roughness: .9 }), x + 20, heightAt(x + 20, z + 25) + .08, z + 25, future); f.rotation.x = -Math.PI / 2; }
  // a blue-white train on a long elevated line across the valley, far off on the left as in the film
  const RAIL_Z = -260, PY = new T.MeshStandardMaterial({ color: 0xe9e4de, roughness: .5, metalness: .2 });
  for (let x = -520; x <= 120; x += 30) mk(new T.CylinderGeometry(.8, 1.2, 26, 10), PY, x, heightAt(x, RAIL_Z) + 13, RAIL_Z, future);
  mk(new T.BoxGeometry(660, 1.3, 2.6), PY, -200, 26.6, RAIL_Z, future);
  const train = new T.Group(); future.add(train);
  for (let k = 0; k < 7; k++) { const car = new T.Mesh(new T.CapsuleGeometry(1.7, 13, 6, 12), new T.MeshStandardMaterial({ color: k % 2 ? 0x6e8fd6 : 0xdfe6f2, emissive: 0x8fb4ff, emissiveIntensity: .25, roughness: .3, metalness: .4 })); car.rotation.z = Math.PI / 2; car.position.x = -k * 16; car.position.y = 29; train.add(car); }
  train.position.z = RAIL_Z;
  // wind turbines on the ridge
  const turbines = [];
  for (let i = 0; i < 5; i++) { const x = -40 + i * 75, z = -280 - hash(i, 3) * 90, y = heightAt(x, z); mk(new T.CylinderGeometry(.6, 1.1, 70, 10), PY, x, y + 35, z, future);
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
  $("storm").onclick = callStorm;

  // ---------- people: Tex, and the settlers of the colony ----------
  const surfaceAt = (x, z) => heightAt(x, z);
  const make = spec => { try { return window.makeExpeditionCharacter(T, Object.assign({ textureBase: "../donkey/" }, spec)); } catch (e) { console.warn("character", spec.id, e); return null; } };
  const mount = window.makeDonkey({ assetPath: "../donkey/", shells: 10 }); mount.group.scale.setScalar(1.22); scene.add(mount.group); mount.place(-7, 30, Math.PI - .16, heightAt); mount.state.brainOff = true; mount.setCargo([]); mount.setLoad(0); mount.pack.visible = false;   // start at the film's opening: the open edge of town, desert and tukuls on the left, the street ahead and to the right
  let SADDLE = .62;   // hip height of the ride pose: the group sits this far below the saddle seat
  // a saddle: a striped blanket with a tibeb border and a leather seat, carried on the donkey's saddle point
  const saddle = new T.Group(); scene.add(saddle);
  { const blanket = new T.Mesh(new T.BoxGeometry(.62, .04, .78), new T.MeshStandardMaterial({ color: 0xb8372a, roughness: .9 })); blanket.position.y = -.05; saddle.add(blanket);
    const border = new T.Mesh(new T.BoxGeometry(.64, .03, .1), new T.MeshStandardMaterial({ color: 0x2f6b4a, roughness: .9 })); for (const zz of [-.37, .37]) { const b = border.clone(); b.position.set(0, -.03, zz); saddle.add(b); }
    const seat = new T.Mesh(new T.BoxGeometry(.4, .08, .5), new T.MeshStandardMaterial({ color: 0x5b3a22, roughness: .6 })); seat.position.y = .0; saddle.add(seat);
    const horn = new T.Mesh(new T.CylinderGeometry(.03, .04, .14, 8), seat.material); horn.position.set(0, .08, .24); saddle.add(horn);
    for (const sx of [-1, 1]) { const flap = new T.Mesh(new T.BoxGeometry(.02, .26, .3), seat.material); flap.position.set(sx * .3, -.16, .02); saddle.add(flap); }
    saddle.traverse(o => { if (o.isMesh) o.castShadow = true; }); }
  const RIDE = { y: 0, v: 0, prevY: null, bob: 0, sway: 0, rock: 0 }, _sp = new T.Vector3(), _sq = new T.Quaternion(), _up = new T.Vector3(), _rq = new T.Quaternion(), _ax = new T.Vector3(1, 0, 0);
  mount.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // Tex Lexington: a Black Ethiopian-Texan cowboy in his thirties. Felt cowboy hat, white cotton shamma with a red tibeb border, brown shirt, denim.
  const tex = make({ id: "tex", name: "Tex Lexington", role: "Rider", scale: 1.0, build: 1.06, fem: .08, skinHex: 0x3a2418, hair: "feltHat", hatHex: 0x9a7650, beard: true, hairHex: 0x141110,
    outer: "shamma", coatHex: 0xe9e2d2, shirtHex: 0x5a3b26, trouserHex: 0x2f3c52, tibebTrim: true, pose: "ride" });
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
  const cam = { p: new T.Vector3(0, 4, 8), l: new T.Vector3() }, fwd = new T.Vector3(), tmp = new T.Vector3(), _right = new T.Vector3();
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
    if (MASK.on) maskRender(); else renderer.render(scene, camera);
  }
  function step(dt) {
    clock += dt;
    // ride
    let thr = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - stick.dy, st = (keys.a || keys.arrowleft ? 1 : 0) - (keys.d || keys.arrowright ? 1 : 0) - stick.dx;
    let pace = keys.shift ? 3 : 1; if (AUTO.on) { thr = AUTO.throttle; st = AUTO.steer; pace = AUTO.pace; }
    mount.update(dt, { throttle: clamp(thr, -1, 1), steer: clamp(st, -1, 1), pace }, heightAt);
    const M = mount.state; fwd.set(Math.sin(M.heading), 0, Math.cos(M.heading));
    if (tex) {   // ride: the seat moves with the donkey's back; the rider's body gives against it on a spring, leans with speed, sways into turns
      mount.saddleAt(_sp, _sq); saddle.position.copy(_sp); saddle.quaternion.copy(_sq);
      if (RIDE.prevY === null) { RIDE.y = _sp.y; RIDE.prevY = _sp.y; }
      const k = 260, c = 22; RIDE.v += ((_sp.y - RIDE.y) * k - RIDE.v * c) * dt; RIDE.y += RIDE.v * dt;
      // what a rider does on top of the animal's own movement: post at the trot (up every other beat), sit the canter's rocking seat
      const ph = (M.phase || 0) * Math.PI * 2, trotW = (M.gait || 0) * (1 - (M.g2 || 0)) * (M.moving || 0), canW = (M.g2 || 0) * (M.moving || 0), walkW = (1 - (M.gait || 0)) * (M.moving || 0);
      const post = trotW * .05 * Math.max(0, Math.sin(ph * 2)) + canW * .035 * Math.cos(ph + .9) + walkW * .012 * Math.cos(ph * 2);
      RIDE.rock = canW * .09 * Math.sin(ph + .9) + trotW * .03 * Math.sin(ph * 2);
      RIDE.bob = clamp(RIDE.y - _sp.y + post, -.07, .09);
      RIDE.sway = lerp(RIDE.sway, clamp(-(M.yawRate || 0) * .6, -1, 1), 1 - Math.exp(-dt * 4));
      const sp = Math.abs(M.speed || 0), lean = clamp(sp / 9, 0, 1) * .22 + (M.speed < -.1 ? -.08 : 0);
      _up.set(0, 1, 0).applyQuaternion(_sq); tex.group.quaternion.copy(_sq).multiply(_rq.setFromAxisAngle(_ax, RIDE.rock || 0)); tex.group.position.copy(_sp).addScaledVector(_up, -SADDLE + .04 + Math.max(0, RIDE.bob) * .6);
      tex.state.x = tex.group.position.x; tex.state.y = tex.group.position.y; tex.state.z = tex.group.position.z; tex.state.heading = M.heading;
      tex.update(dt, clock, { pose: "ride", rideBob: RIDE.bob, rideLean: lean, rideSway: RIDE.sway, rideBarrel: .26, rideLook: RIDE.sway * .3, lodDist: 3 });
    }
    // people walk their paths and turn back
    for (const p of people) { const [a, b] = p.s.path, L = Math.hypot(b[0] - a[0], b[1] - a[1]), sp = 1.1 / L; p.u = (p.u + dt * sp) % 2; const k = p.u < 1 ? p.u : 2 - p.u, dir = p.u < 1 ? 1 : -1;
      const x = lerp(a[0], b[0], k), z = lerp(a[1], b[1], k), hd = Math.atan2((b[0] - a[0]) * dir, (b[1] - a[1]) * dir);
      p.ch.place(x, z, hd, surfaceAt); p.ch.update(dt, clock, { pose: "walk", surfaceAt, lodDist: Math.hypot(camera.position.x - x, camera.position.z - z) });
      if (p.d) { p.d.state.x = x + Math.cos(hd) * 1.3 - Math.sin(hd) * 1.4; p.d.state.z = z - Math.sin(hd) * 1.3 - Math.cos(hd) * 1.4; p.d.state.heading = hd; p.d.update(dt, { throttle: .5, steer: 0, pace: 0 }, heightAt); } }
    // windmill, train, turbines, drones
    mill.userData.hub.rotation.z += dt * (1.2 + STORM_W() * 6);
    if (future.visible) { train.position.x = ((clock * 18) % 700) - 540; turbines.forEach((t, i) => t.rotation.z += dt * (.6 + i * .05));
      drones.forEach(d => { const u = d.userData; u.a += dt * u.s; d.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(u.a * 2) * 2, u.cz + Math.sin(u.a) * u.r * .5); d.rotation.y = -u.a; }); }
    // storm
    stormStep(dt);
    // camera: locked behind and above, like the Genie take; Wide pulls back to see the street
    const back = wide ? 16 : 6.8, high = wide ? 7.5 : 3.3, ahead = wide ? 18 : 9;
    const right = _right.set(-fwd.z, 0, fwd.x).multiplyScalar(-1), side = wide ? 3 : 1.6;   // the Genie framing: the camera sits off his right shoulder, Tex in the left third
    tmp.set(M.x, (M.y || 0), M.z); const goal = tmp.clone().addScaledVector(fwd, -back).addScaledVector(right, side); goal.y = Math.max(heightAt(goal.x, goal.z) + 1.4, tmp.y + high);
    cam.p.lerp(goal, 1 - Math.exp(-dt * 4)); cam.l.lerp(tmp.clone().addScaledVector(fwd, ahead).add(new T.Vector3(0, 1.9, 0)), 1 - Math.exp(-dt * 6));
    camera.position.copy(cam.p); camera.lookAt(cam.l);
    const ov = window.__mars && window.__mars.camSide; if (ov) { const r = new T.Vector3(Math.cos(M.heading), 0, -Math.sin(M.heading)); camera.position.set(M.x, (M.y || 0), M.z).addScaledVector(r, ov).add(new T.Vector3(0, 1.5, 0)).addScaledVector(fwd, .6); camera.lookAt(M.x, (M.y || 0) + 1.35, M.z); }
    sun.position.set(M.x + TUNE.sunDir[0], TUNE.sunDir[1], M.z + TUNE.sunDir[2]); sun.target.position.set(M.x, 0, M.z);   // low, ahead and to the right, as the film's shadows say
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
    const side = STORM.phase === "far" ? 300 : STORM.phase === "coming" ? lerp(300, 0, smooth(-620, -200, STORM.z)) : 0;   // in the film the storm stands off to the right before it comes
    wall.position.set(M.x + side, 0, STORM.z); wall.scale.x = STORM.phase === "far" ? .55 : lerp(.55, 1, smooth(-620, -200, STORM.z));
    for (const p of puffs) { const b = p.userData.base; p.position.x = b.x + Math.sin(STORM.t * p.userData.sp + b.z) * 6; p.material.rotation += dt * .05 * p.userData.sp; }
    const B = BASE_FOG, dens = STORM.phase === "inside" ? lerp(B, .09, smooth(0, 1.2, STORM.t)) : STORM.phase === "clearing" ? lerp(.09, B, smooth(0, 4.5, STORM.t)) : STORM.phase === "clear" ? B : B + .01 * smooth(-160, -25, STORM.z - M.z);
    scene.fog.density = dens; const st = clamp((dens - B) / .03, 0, 1); sky.material.uniforms.uStorm.value = st; scene.fog.color.copy(HAZE).lerp(STORMCOL, st);
    hemi.intensity = TUNE.hemi * (1 - .35 * clamp((dens - B) / .05, 0, 1)); sun.intensity = TUNE.sun * (1 - st * .8);
  }

  // ---------- the loop's eyes: a flat class mask, and live tuning of every colour the loop corrects ----------
  const MASK = { on: false }, CLS = { sky: 0x000000, storm: 0x808080, ground: 0xff0000, scrub: 0x00ff00, mesa_near: 0x0000ff, mesa_far: 0xffff00, wood: 0xff00ff, spire: 0x00ffff, other: 0x808080 }, flat = {};
  function clsOf(o) { for (let q = o; q; q = q.parent) if (q.userData && q.userData.cls) return q.userData.cls; return "other"; }
  function maskRender() {
    const swaps = [], hidden = [], fog = scene.fog, tm = renderer.toneMapping; scene.fog = null; renderer.toneMapping = T.NoToneMapping;
    scene.traverse(o => { if (o.isSprite) { swaps.push([o, o.material]); o.material = flat.storm = flat.storm || new T.SpriteMaterial({ color: 0x808080, fog: false, transparent: true, map: o.material.map, alphaTest: .25 }); return; }
      if (o.isMesh) { const c = clsOf(o); flat[c] = flat[c] || new T.MeshBasicMaterial({ color: CLS[c], fog: false, side: c === "sky" ? T.BackSide : T.FrontSide }); swaps.push([o, o.material]); o.material = flat[c]; } });
    renderer.render(scene, camera); for (const [o, m] of swaps) o.material = m; for (const o of hidden) o.visible = true; scene.fog = fog; renderer.toneMapping = tm;
  }
  function tune(o) {
    Object.assign(TUNE, o);
    GROUND.color.set(TUNE.ground); if (GROUND.userData.far) GROUND.userData.far.color.set(TUNE.ground); MESA.color.set(TUNE.mesa); WOODMATS.forEach(m => m.color.set(TUNE.wood)); SPIREMATS.forEach(m => m.color.set(TUNE.spire)); SPIREFOG.value = TUNE.spireFog;
    HAZE.set(TUNE.fog); scene.fog.color.copy(HAZE); BASE_FOG = TUNE.fogD; sky.material.uniforms.uTop.value.set(...TUNE.skyTop); sky.material.uniforms.uHor.value.set(...TUNE.skyHor);
    sun.intensity = TUNE.sun; hemi.intensity = TUNE.hemi; renderer.toneMappingExposure = TUNE.exposure; return TUNE;
  }

  // ---------- boot ----------
  const done = () => { $("boot").classList.add("done"); window.__ready = true; };
  try { addSettlers(); } catch (e) { console.warn("settlers", e); }
  requestAnimationFrame(t => { last = t; frame(t); setTimeout(done, 300); });
  // hooks for the study and for checks
  window.__mars = { mask: v => MASK.on = v, tune, TUNE, setSaddle: v => SADDLE = v, paused: false, sim: (sec, ctl) => { if (ctl) Object.assign(AUTO, ctl, { on: true }); for (let t = 0; t < sec; t += .05) step(.05); }, mount, tex, STORM, callStorm, AUTO, setWide, say, future, keys, heightAt, place: (x, z, h) => { mount.place(x, z, h, heightAt); cam.p.set(x, 5, z + 8); } };
})();
