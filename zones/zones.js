/* THRESHOLD · Eleven Tonal Worlds
 * Combines 11 Ansel Adams Zone shaders + 2 bonus JellyOrchestra print shaders,
 * 3 optical focus-pull routing modes (THRESHOLD, DEPTH SHELLS, TONAL STRATA),
 * shared procedural pack donkey Mistletoe, Woody Wagon Roof-Deck, Three Clocks audio,
 * and 8x10 contact-plate capture. */
(function () {
  "use strict";
  const T = window.THREE;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const fract = v => v - Math.floor(v);
  const hash2 = (x, z) => fract(Math.sin(x * 127.1 + z * 311.7 + 4.3) * 43758.5453123);
  function noise2(x, z) {
    const i = Math.floor(x), j = Math.floor(z), u = smooth(0, 1, x - i), v = smooth(0, 1, z - j);
    return lerp(lerp(hash2(i, j), hash2(i + 1, j), u), lerp(hash2(i, j + 1), hash2(i + 1, j + 1), u), v);
  }
  function fbm(x, z, oct = 4) {
    let s = 0, a = .5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * noise2(x * f, z * f); a *= .5; f *= 2.04; }
    return s;
  }

  /* ---------- Core catalog: 11 Zone Worlds + 13 Shader Looks ---------- */
  const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const LOOKS = [
    { id: "embers", name: "LIGHT ALONE", zone: 0, trail: .92, desc: "Darkness pierced only by drifting embers and trail memory." },
    { id: "set", name: "THE SET", zone: 1, trail: .42, desc: "Curved 1950s CRT phosphor lines with horizontal sync sweep." },
    { id: "cave", name: "WARM CAVE", zone: 2, trail: .82, desc: "Thermal skin vision: void violet through ember orange to white heat." },
    { id: "silhouette", name: "SILHOUETTE", zone: 3, trail: .25, desc: "Warm lit tissue backing sharp dark cut-outs and vermilion peaks." },
    { id: "woodblock", name: "WOODBLOCK", zone: 4, trail: .15, desc: "Carved indigo, slate, cream, and rust woodcut blocks with grain." },
    { id: "silver", name: "SILVER GELATIN", zone: 5, trail: .08, desc: "Selenium-toned archival 8x10 silver print across middle gray." },
    { id: "card", name: "THE CARD", zone: 6, trail: .12, desc: "Cream archival stock hatched and cross-engraved by its own light." },
    { id: "spray", name: "SPRAY WALL", zone: 7, trail: .88, desc: "Celluloid mural wall, scissor-cut paper cores, and paint drips." },
    { id: "watercolour", name: "WATERCOLOUR", zone: 8, trail: .18, desc: "Pencil underdrawing washed with pigment pools on cold-pressed paper." },
    { id: "cyanotype", name: "CYANOTYPE", zone: 9, trail: .72, desc: "Brushed Prussian blue blueprint exposed to bright sunlight." },
    { id: "glass", name: "GLASS", zone: 10, trail: .82, desc: "X-ray optical refraction showing only luminous edges and depth contours." },
    { id: "risograph", name: "RISOGRAPH", zone: -1, trail: .14, desc: "Misregistered pink, yellow, and cobalt halftone drum screens on cream." },
    { id: "inkwash", name: "INK WASH", zone: -1, trail: .18, desc: "Three dilutions of sumi-e ink on fibrous paper with dry-brush & seal." }
  ];

  const ZONES = [
    { z: 0, look: 0, refl: .03, name: "Lava Tube Cavern", swatch: "#080809", x: -126, pz: -102, desc: "Obsidian archway of pure Zone 0 density and drifting embers." },
    { z: 1, look: 1, refl: .09, name: "Basalt Night Mesa", swatch: "#15161a", x: -96, pz: -72, desc: "Stepped hexagonal basalt columns scanned through CRT phosphor." },
    { z: 2, look: 2, refl: .16, name: "Sequoia Thermal Slot", swatch: "#262328", x: -64, pz: -46, desc: "Dark redwood trunks glowing by heat in shaded canyon soil." },
    { z: 3, look: 3, refl: .25, name: "Merced Pine Timber", swatch: "#393734", x: -30, pz: -22, desc: "Dense sierra conifers backing warm paper silhouette theatre." },
    { z: 4, look: 4, refl: .36, name: "Snake River Terrace", swatch: "#54524a", x: 0, pz: 0, desc: "Woody station wagon trailhead & Mistletoe’s woodblock bench." },
    { z: 5, look: 5, refl: .50, name: "Tuolumne Meadow", swatch: "#76746b", x: 28, pz: 20, desc: "18% middle-gray equilibrium meadow & silver-gelatin split-rail fence." },
    { z: 6, look: 6, refl: .64, name: "Silver River Ford", swatch: "#96948a", x: 58, pz: 42, desc: "Cross-hatched engraving river crossing — focus locks the stone piers." },
    { z: 7, look: 7, refl: .75, name: "Painted Canyon Wall", swatch: "#b5b2a6", x: 86, pz: 62, desc: "Vertical granite monoliths cut onto concrete & dripping pigment." },
    { z: 8, look: 8, refl: .84, name: "Gypsum Dune Wash", swatch: "#cfcbb9", x: 114, pz: 86, desc: "Sunlit wind dunes & focus-solidified chasm arch rendered in watercolour." },
    { z: 9, look: 9, refl: .91, name: "Mono Salt Flats", swatch: "#e4e3d8", x: 140, pz: 108, desc: "Alkali tufa spires exposed as Prussian blue cyanotype paper." },
    { z: 10, look: 10, refl: .97, name: "Sierra Ice Lens", swatch: "#f6f4ec", x: 164, pz: 126, desc: "Refractive glacial summit & focus-locked ice bridge at Zone X." }
  ];

  const MODES = [
    { id: "threshold", label: "THRESHOLD", sub: "Tonal + Depth Pull", desc: "All 11 Zone shaders populate tonal & depth bands simultaneously while the sharp focal plane crystallizes solid form." },
    { id: "shells", label: "DEPTH SHELLS", sub: "Spatial Slides", desc: "Eleven concentric depth shells radiate around your focal distance; turning the brass knob sweeps Worlds 0–X across space." },
    { id: "strata", label: "TONAL STRATA", sub: "11-Zone Bands", desc: "Filtered scene luminance routes every pixel directly into its home Zone shader (0–X) while focus controls optical sharpness." }
  ];

  const STOPS = [
    { name: "f/5.6", oct: .32, lock: 0 },
    { name: "f/8", oct: .48, lock: .08 },
    { name: "f/16", oct: .78, lock: .25 },
    { name: "f/32", oct: 1.25, lock: .58 },
    { name: "f/64", oct: 2.1, lock: .88 }
  ];

  const FILTERS = [
    { name: "CLEAR", short: "Clear", rgb: [1, 1, 1] },
    { name: "YELLOW #8", short: "Yellow", rgb: [1.14, 1.05, .42] },
    { name: "ORANGE #15", short: "Orange", rgb: [1.26, .88, .24] },
    { name: "RED #25", short: "Red", rgb: [1.45, .44, .18] },
    { name: "GREEN #58", short: "Green", rgb: [.52, 1.32, .56] }
  ];

  const STORAGE_KEY = "make-photo-zones-v1";
  const urlMode = new URLSearchParams(location.search).get("mode");
  const initModeIdx = Math.max(0, MODES.findIndex(m => m.id === urlMode));

  /* ---------- WebAudio: Three Clocks + Hoof + Shutter ---------- */
  const audio = (() => {
    let ctx = null, master = null, enabled = false;
    const clocks = [
      { period: 1.0, acc: 0, ratio: 1.0, pan: -.45 },
      { period: 1.37, acc: .35, ratio: 1.25, pan: 0 },
      { period: 1.73, acc: .8, ratio: 1.5, pan: .45 }
    ];
    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = .45;
        master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
      return true;
    }
    function tone(freq, dur, vol, type = "triangle", pan = 0) {
      if (!enabled || !ensure()) return;
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * .96), t0 + dur);
      g.gain.setValueAtTime(.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + .012);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      if (p) { p.pan.value = pan; o.connect(g); g.connect(p); p.connect(master); }
      else { o.connect(g); g.connect(master); }
      o.start(t0); o.stop(t0 + dur + .02);
    }
    function shutter() {
      if (!ensure()) return;
      const was = enabled; enabled = true;
      tone(190, .06, .18, "square", 0);
      setTimeout(() => tone(840, .04, .09, "triangle", 0), 35);
      enabled = was;
    }
    function step(leg, gait) {
      if (!enabled) return;
      const base = gait > 1 ? 125 : 92;
      tone(base + leg * 11, .055, gait > 1 ? .08 : .045, "triangle", leg % 2 ? .28 : -.28);
    }
    function tick(dt, zoneIdx) {
      if (!enabled) return;
      const baseFreq = 165 * Math.pow(2, zoneIdx * .07);
      for (const c of clocks) {
        c.acc += dt;
        if (c.acc >= c.period) {
          c.acc -= c.period;
          tone(baseFreq * c.ratio, .34, .06, zoneIdx < 3 ? "sine" : "triangle", c.pan);
        }
      }
    }
    return {
      toggle() { enabled = !enabled; if (enabled) ensure(); return enabled; },
      isOn: () => enabled,
      tick, shutter, step
    };
  })();

  /* ---------- Terrain & Biome Field Functions ---------- */
  function valleyProjection(x, z) {
    // River & expedition valley runs roughly along p = 0.65x + 0.5z in [-150..+180]
    let bestT = 0, bestD = 1e9;
    const len = ZONES.length - 1;
    for (let i = 0; i < len; i++) {
      const a = ZONES[i], b = ZONES[i + 1];
      const dx = b.x - a.x, dz = b.pz - a.pz, d2 = dx * dx + dz * dz || 1;
      const u = clamp(((x - a.x) * dx + (z - a.pz) * dz) / d2, 0, 1);
      const px = a.x + dx * u, pz = a.pz + dz * u;
      const dist = Math.hypot(x - px, z - pz);
      if (dist < bestD) { bestD = dist; bestT = (i + u) / len; }
    }
    return { t: bestT, dist: bestD };
  }

  function channelFactor(x, z) {
    // Water river runs perpendicular across Zone VI ford near [58, 42]
    const rx = (x - 58) * .78 - (z - 42) * .62;
    const bend = Math.sin((x + z) * .045) * 9.5;
    const riverDist = Math.abs(rx + bend);
    const waterMask = smooth(11.5, 4.5, riverDist) * smooth(135, 35, Math.hypot(x - 58, z - 42));
    // Gypsum sand chasm near Zone VIII [114, 86]
    const cx = (x - 114) * .75 - (z - 86) * .66;
    const chasmDist = Math.abs(cx);
    const chasmMask = smooth(7.5, 3.2, chasmDist) * smooth(32, 10, Math.hypot(x - 114, z - 86));
    // Glacial crevasse near Zone X [154, 118]
    const gx = (x - 153) * .75 - (z - 118) * .66;
    const crevDist = Math.abs(gx);
    const crevMask = smooth(7.2, 3.0, crevDist) * smooth(30, 8, Math.hypot(x - 153, z - 118));
    return { river: waterMask, chasm: chasmMask, crev: crevMask };
  }

  function terrainHeight(x, z) {
    const proj = valleyProjection(x, z);
    const zCoord = proj.t * 10;
    const ridgeWall = smooth(14, 64, proj.dist);
    const coarse = (fbm(x * .014 + 3.1, z * .014 + 1.7, 4) - .46) * (6.5 + ridgeWall * 28.0);
    const detail = (fbm(x * .06, z * .06, 2) - .5) * 1.4;
    // Slight terrace elevation climbing gently from Zone IV -> Zone X, depressed in canyon Zones 0-II
    const macro = lerp(-3.5, 11.5, smooth(0, 10, zCoord)) + ridgeWall * (8.0 + 1.1 * zCoord);
    let h = macro + coarse * (.35 + .65 * ridgeWall) + detail;
    // Flatten cairn pads gently
    for (const Z of ZONES) {
      const k = smooth(11, 2.5, Math.hypot(x - Z.x, z - Z.pz));
      h = lerp(h, macro + (fbm(Z.x * .014 + 3.1, Z.pz * .014 + 1.7, 4) - .46) * 2.2, k * .75);
    }
    const ch = channelFactor(x, z);
    h -= ch.river * 2.7;
    h -= ch.chasm * 5.2;
    h -= ch.crev * 5.8;
    return h;
  }

  function terrainAlbedo(x, z, h) {
    const proj = valleyProjection(x, z);
    const zf = clamp(proj.t * 10, 0, 10);
    const z0 = Math.floor(zf), z1 = Math.min(10, z0 + 1);
    let base = lerp(ZONES[z0].refl, ZONES[z1].refl, zf - z0);
    // Inject micro-strata variation so close-up views also carry shadow & highlight pockets
    const strat = (fbm(x * .075 + h * .18, z * .075, 3) - .5) * .36;
    const ridgeline = smooth(20, 68, proj.dist) * .16;
    const ch = channelFactor(x, z);
    base = clamp(base + strat + ridgeline - ch.river * .14 - ch.chasm * .35 - ch.crev * .2, .015, .98);
    return base;
  }

  /* ---------- Threshold Bridges (Solidified when in Camera Focus) ---------- */
  const thresholds = []; // { id, name, x, z, dirX, dirZ, halfLen, halfWidth, yTop, group, solidMat, wireMat, solidFactor }
  function inThresholdSpan(x, z) {
    for (const th of thresholds) {
      const dx = x - th.x, dz = z - th.z;
      const along = dx * th.dirX + dz * th.dirZ;
      const across = Math.abs(-dx * th.dirZ + dz * th.dirX);
      if (Math.abs(along) <= th.halfLen + 1.8 && across <= th.halfWidth + 0.4) {
        return th;
      }
    }
    return null;
  }

  function heightAt(x, z) {
    const g = terrainHeight(x, z);
    const th = inThresholdSpan(x, z);
    if (th && th.solidFactor >= .5) return Math.max(g, th.yTop);
    return g;
  }

  /* ---------- Scene Setup ---------- */
  const canvas = $("view");
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  const phone = matchMedia("(pointer:coarse)").matches || Math.min(innerWidth, innerHeight) < 560;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  scene.background = new T.Color(0x6c6c68);
  scene.fog = new T.FogExp2(0x787872, .0036);

  const NEAR = 0.25, FAR = 520;
  const camera = new T.PerspectiveCamera(44, 1, NEAR, FAR);

  // Lighting sculpted to create genuine darks (0-III) & bright snow/rock faces (VII-X)
  scene.add(new T.HemisphereLight(0xf6f4ee, 0x161614, 0.72));
  const sun = new T.DirectionalLight(0xfff9ee, 2.45);
  sun.position.set(110, 145, -75);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.near = 10; sc.far = 420; sc.left = -140; sc.right = 140; sc.top = 140; sc.bottom = -140;
  sun.shadow.bias = -.0005;
  scene.add(sun);

  // Procedural Sky Dome with high dynamic horizon & zenith cloud strata
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1.,0.)),f.x), mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x), f.y); }
      void main(){
        float y = clamp(vDir.y, -0.2, 1.0);
        float c1 = n(vDir.xz / max(0.18, y + 0.35) * 3.2 + vec2(uTime * 0.008, 0.0));
        float c2 = n(vDir.xz / max(0.18, y + 0.35) * 7.5 - vec2(uTime * 0.012, 3.0));
        float cloud = smoothstep(0.45, 0.85, c1 * 0.65 + c2 * 0.35);
        float horizon = smoothstep(0.48, -0.02, y);
        vec3 base = mix(vec3(0.06, 0.07, 0.09), vec3(0.76, 0.75, 0.71), horizon);
        vec3 sunGlow = pow(max(0.0, dot(normalize(vDir), normalize(vec3(0.62, 0.55, -0.4)))), 18.0) * vec3(1.1, 1.02, 0.88);
        vec3 col = mix(base, vec3(0.96, 0.94, 0.89), cloud * (0.28 + 0.45 * (1.0 - horizon))) + sunGlow;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  scene.add(new T.Mesh(new T.SphereGeometry(420, 32, 20), skyMat));

  /* ---------- Terrain Mesh (220x220 segments over 420m) ---------- */
  const TERRAIN_SPAN = 420, SEG = 210;
  const tGeo = new T.PlaneGeometry(TERRAIN_SPAN, TERRAIN_SPAN, SEG, SEG);
  tGeo.rotateX(-Math.PI / 2);
  tGeo.translate(18, 0, 12);
  const posAttr = tGeo.attributes.position;
  const cols = new Float32Array(posAttr.count * 3);
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i), z = posAttr.getZ(i);
    const h = terrainHeight(x, z);
    posAttr.setY(i, h);
    const alb = terrainAlbedo(x, z, h);
    // Warm-cool mineral tint before filter & Zone shader evaluation
    cols[i * 3] = alb * 1.02;
    cols[i * 3 + 1] = alb * 1.0;
    cols[i * 3 + 2] = alb * .96;
  }
  tGeo.setAttribute("color", new T.BufferAttribute(cols, 3));
  tGeo.computeVertexNormals();
  const terrainMesh = new T.Mesh(tGeo, new T.MeshStandardMaterial({
    vertexColors: true, roughness: .92, metalness: .04
  }));
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // Silver river ribbon along Zone VI Ford
  const waterGeo = new T.PlaneGeometry(24, 180, 12, 48);
  waterGeo.rotateX(-Math.PI / 2);
  const wPos = waterGeo.attributes.position;
  for (let i = 0; i < wPos.count; i++) {
    const lx = wPos.getX(i), lz = wPos.getZ(i);
    const ang = .68;
    const wx = 58 + lx * Math.cos(ang) - lz * Math.sin(ang);
    const wz = 42 + lx * Math.sin(ang) + lz * Math.cos(ang);
    wPos.setXYZ(i, wx, 0.35 + Math.sin(lz * .08) * .05, wz);
  }
  waterGeo.computeVertexNormals();
  const waterMesh = new T.Mesh(waterGeo, new T.MeshPhysicalMaterial({
    color: 0xd6dcd8, roughness: .12, metalness: .45, clearcoat: 1, transparent: true, opacity: .88
  }));
  scene.add(waterMesh);

  /* ---------- Sprocket Film-Strip Texture (for Zone Monoliths & LookPass Mural) ---------- */
  const filmCanvas = document.createElement("canvas");
  filmCanvas.width = 256; filmCanvas.height = 512;
  const fctx = filmCanvas.getContext("2d");
  fctx.fillStyle = "#161513"; fctx.fillRect(0, 0, 256, 512);
  // Sprocket holes & silver test frames
  for (let row = 0; row < 16; row++) {
    const y = row * 32 + 6;
    fctx.fillStyle = "#efe9d8";
    fctx.fillRect(10, y, 16, 18);
    fctx.fillRect(230, y, 16, 18);
  }
  for (let fr = 0; fr < 4; fr++) {
    const y = fr * 128 + 12;
    const g = fctx.createLinearGradient(42, y, 214, y + 104);
    g.addColorStop(0, fr % 2 ? "#0d0d0d" : "#d8d4c8");
    g.addColorStop(.5, "#747169");
    g.addColorStop(1, fr % 2 ? "#e9e5da" : "#181817");
    fctx.fillStyle = g;
    fctx.fillRect(42, y, 172, 104);
    fctx.fillStyle = "rgba(255,255,255,.35)";
    fctx.beginPath();
    fctx.moveTo(42, y + 104);
    fctx.lineTo(118, y + 32 + fr * 6);
    fctx.lineTo(214, y + 104);
    fctx.fill();
  }
  const filmTex = new T.CanvasTexture(filmCanvas);
  filmTex.wrapS = T.RepeatWrapping;
  filmTex.wrapT = T.RepeatWrapping;

  /* ---------- Biome Props, Cairn Landmarks & Film Monoliths ---------- */
  const propGroup = new T.Group();
  scene.add(propGroup);
  const darkRockMat = new T.MeshStandardMaterial({ color: 0x161618, roughness: .94 });
  const midRockMat = new T.MeshStandardMaterial({ color: 0x6c6b64, roughness: .88 });
  const paleRockMat = new T.MeshStandardMaterial({ color: 0xe8e5db, roughness: .52 });
  const woodMat = new T.MeshStandardMaterial({ color: 0x3b352c, roughness: .9 });
  const treeMat = new T.MeshStandardMaterial({ color: 0x1d211b, roughness: .95 });
  const iceMat = new T.MeshPhysicalMaterial({ color: 0xf4f8fc, roughness: .18, metalness: .1, clearcoat: .9 });
  const solids = []; // { x, z, r }

  const rockGeo = new T.DodecahedronGeometry(1, 1);
  const coneGeo = new T.ConeGeometry(1.5, 6.5, 7);
  const trunkGeo = new T.CylinderGeometry(.18, .3, 2.2, 6);
  const filmGeo = new T.PlaneGeometry(2.8, 12.5, 1, 8);

  const filmStrips = [];
  for (const Z of ZONES) {
    const gy = terrainHeight(Z.x, Z.pz);
    // Film-strip monolith standing at each Zone Sanctuary
    const fmMat = new T.MeshStandardMaterial({
      map: filmTex, emissive: new T.Color(Z.refl * .4 + .12, Z.refl * .38 + .11, Z.refl * .34 + .09),
      roughness: .4, side: T.DoubleSide
    });
    const fm = new T.Mesh(filmGeo, fmMat);
    fm.position.set(Z.x + 5.2, gy + 5.8, Z.pz - 5.2);
    fm.rotation.y = .45 + Z.z * .22;
    fm.castShadow = true;
    propGroup.add(fm);
    filmStrips.push({ mesh: fm, baseY: gy + 5.8, phase: Z.z * .7 });

    // Low survey cairn marker alongside trail
    const cairnBase = new T.Group();
    cairnBase.position.set(Z.x - 3.6, gy, Z.pz + 4.4);
    for (let s = 0; s < 3; s++) {
      const m = new T.Mesh(rockGeo, Z.z < 4 ? darkRockMat : Z.z < 8 ? midRockMat : paleRockMat);
      const sc = .56 - s * .13;
      m.scale.set(sc * 1.15, sc * .38, sc);
      m.position.y = .10 + s * .20;
      m.castShadow = true; m.receiveShadow = true;
      cairnBase.add(m);
    }
    propGroup.add(cairnBase);
    solids.push({ x: Z.x - 3.6, z: Z.pz + 4.4, r: .9 });

    // Biome-specific clusters around each Zone
    const count = Z.z === 3 ? 16 : 9;
    for (let k = 0; k < count; k++) {
      const ang = (k / count) * Math.PI * 2 + hash2(Z.z, k) * .9;
      const rad = 7.5 + hash2(k, Z.z + 11) * 20;
      const px = Z.x + Math.cos(ang) * rad, pz = Z.pz + Math.sin(ang) * rad;
      if (inThresholdSpan(px, pz)) continue;
      const py = terrainHeight(px, pz);
      if (Z.z === 2 || Z.z === 3) {
        const s = .75 + hash2(k, 5) * 1.1;
        const tr = new T.Mesh(trunkGeo, woodMat);
        tr.position.set(px, py + 1.0 * s, pz); tr.scale.setScalar(s); tr.castShadow = true;
        const cn = new T.Mesh(coneGeo, treeMat);
        cn.position.set(px, py + 4.4 * s, pz); cn.scale.setScalar(s); cn.castShadow = true;
        propGroup.add(tr, cn);
        solids.push({ x: px, z: pz, r: .7 * s });
      } else if (Z.z === 1 || Z.z === 7 || Z.z === 9) {
        const colH = 3.2 + hash2(k, Z.z * 3) * 6.5;
        const col = new T.Mesh(new T.CylinderGeometry(.65, .95, colH, Z.z === 1 ? 6 : 8),
          Z.z === 1 ? darkRockMat : Z.z === 7 ? midRockMat : paleRockMat);
        col.position.set(px, py + colH * .45, pz);
        col.castShadow = true; col.receiveShadow = true;
        propGroup.add(col);
        solids.push({ x: px, z: pz, r: 1.0 });
      } else {
        const rs = .7 + hash2(k, Z.z * 7) * 1.9;
        const rk = new T.Mesh(rockGeo, Z.z < 3 ? darkRockMat : Z.z < 7 ? midRockMat : Z.z < 10 ? paleRockMat : iceMat);
        rk.scale.set(rs, rs * (.6 + hash2(k, 2) * .8), rs * .9);
        rk.position.set(px, py + rs * .14, pz);
        rk.rotation.set(hash2(k, 1), hash2(k, 3), 0);
        rk.castShadow = true; rk.receiveShadow = true;
        propGroup.add(rk);
        solids.push({ x: px, z: pz, r: rs * .75 });
      }
    }
  }

  /* ---------- Three Focus-Gated Threshold Crossings ---------- */
  function addThresholdBridge(id, name, cx, cz, dirX, dirZ, halfLen, halfWidth, yTop, tintHex) {
    const grp = new T.Group();
    grp.position.set(cx, yTop, cz);
    grp.rotation.y = Math.atan2(dirX, dirZ);
    const solidMat = new T.MeshStandardMaterial({
      color: tintHex, roughness: .42, metalness: .15, transparent: true, opacity: .28
    });
    const wireMat = new T.MeshBasicMaterial({
      color: 0xcbb182, wireframe: true, transparent: true, opacity: .75
    });
    const slabs = 6;
    for (let i = 0; i < slabs; i++) {
      const zOff = lerp(-halfLen + 1.2, halfLen - 1.2, i / (slabs - 1));
      const g = new T.BoxGeometry(halfWidth * 1.9, .45, (halfLen * 2) / slabs - .35);
      const m = new T.Mesh(g, solidMat);
      m.position.set(0, -.22, zOff);
      m.castShadow = true; m.receiveShadow = true;
      const w = new T.Mesh(g, wireMat);
      w.position.copy(m.position);
      grp.add(m, w);
    }
    scene.add(grp);
    thresholds.push({ id, name, x: cx, z: cz, dirX, dirZ, halfLen, halfWidth, yTop, group: grp, solidMat, wireMat, solidFactor: 0 });
  }
  const lenRiver = Math.hypot(58 - 28, 42 - 20);
  addThresholdBridge("river_causeway", "Silver River Causeway (Zone VI)", 58, 42, (58 - 28) / lenRiver, (42 - 20) / lenRiver, 11, 2.2, 2.6, 0x9b988e);
  addThresholdBridge("dune_arch", "Gypsum Chasm Span (Zone VIII)", 114, 86, .79, .61, 8.5, 2.2, 7.6, 0xd8d3c3);
  addThresholdBridge("ice_bridge", "Glacial Crevasse Bridge (Zone X)", 153, 118, .79, .61, 8.2, 2.2, 11.2, 0xf2f7fc);

  /* ---------- Woody Survey Station Wagon & Roof-Deck at Zone IV Trailhead ---------- */
  const wagon = (() => {
    const g = new T.Group();
    const wx = -3.8, wz = 5.6;
    const wy = terrainHeight(wx, wz);
    g.position.set(wx, wy, wz);
    g.rotation.y = .72;
    const bodyDark = new T.MeshStandardMaterial({ color: 0x1d1e1c, roughness: .42, metalness: .3 });
    const ashWood = new T.MeshStandardMaterial({ color: 0x857862, roughness: .75 });
    const chrome = new T.MeshStandardMaterial({ color: 0xd8d5cb, roughness: .22, metalness: .88 });
    const addBox = (mat, px, py, pz, sx, sy, sz) => {
      const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), mat);
      m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
    };
    // Lower chassis, hood, wood paneling & camera roof deck
    addBox(bodyDark, 0, .72, 1.55, 1.72, .72, 1.35); // hood
    addBox(ashWood, 0, 1.05, -.45, 1.82, 1.32, 2.75); // woody cabin
    addBox(bodyDark, 0, 1.74, -.45, 1.78, .10, 2.78); // roof platform
    addBox(ashWood, 0, 1.88, -.45, 1.62, .12, 2.45); // shooting deck planks
    // Roof rack rails & ladder
    for (const s of [-.84, .84]) {
      addBox(chrome, s, 2.04, -.45, .06, .22, 2.35);
      for (const z of [-1.25, .95]) {
        const w = new T.Mesh(new T.CylinderGeometry(.38, .38, .28, 18), bodyDark);
        w.rotation.z = Math.PI / 2; w.position.set(s * 1.02, .38, z); g.add(w);
      }
    }
    addBox(chrome, .94, 1.15, -1.6, .06, 1.55, .42); // access ladder
    scene.add(g);
    solids.push({ x: wx, z: wz, r: 2.2 });
    return { x: wx, z: wz, deckY: wy + 1.94, standX: wx, standZ: wz - .35 };
  })();

  /* ---------- Mistletoe (Shared Skinned Pack Donkey) ---------- */
  const donkey = window.makeDonkey({
    assetPath: "../donkey/",
    shells: phone ? 6 : 11,
    contactShadow: true,
    alwaysHalter: true
  });
  scene.add(donkey.group);
  const cargoItems = [
    { name: "8x10 Holders", kg: 15, slot: "L" },
    { name: "Brass Lenses & Meter", kg: 15, slot: "R" },
    { name: "Ash Tripod & Dark Cloth", kg: 11, slot: "T" }
  ];
  donkey.setCargo(cargoItems);
  donkey.place(2.2, -0.4, 2.2, heightAt);
  donkey.state.onStep = (leg, gait) => audio.step(leg, gait);

  // Lead rope linking player hand & Mistletoe's halter ring
  const ropePts = new Float32Array(13 * 3);
  const ropeGeo = new T.BufferGeometry();
  ropeGeo.setAttribute("position", new T.BufferAttribute(ropePts, 3));
  const leadRope = new T.Line(ropeGeo, new T.LineBasicMaterial({ color: 0xcbb182, transparent: true, opacity: .82 }));
  leadRope.frustumCulled = false;
  scene.add(leadRope);

  /* ---------- Multi-Pass GPU Shader Pipeline (RT + Depth + Trail + LookPass) ---------- */
  const rtScene = new T.WebGLRenderTarget(64, 64, {
    minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true
  });
  rtScene.depthTexture = new T.DepthTexture(64, 64);
  rtScene.depthTexture.format = T.DepthFormat;
  rtScene.depthTexture.type = T.UnsignedIntType;
  rtScene.depthTexture.minFilter = T.NearestFilter;
  rtScene.depthTexture.magFilter = T.NearestFilter;

  let rtA = new T.WebGLRenderTarget(64, 64, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false });
  let rtB = rtA.clone();

  const postScene = new T.Scene();
  const postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postQuad = new T.Mesh(new T.PlaneGeometry(2, 2), null);
  postScene.add(postQuad);

  const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const accMat = new T.ShaderMaterial({
    uniforms: { tCur: { value: null }, tPrev: { value: null }, uDamp: { value: .72 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tCur, tPrev; uniform float uDamp; varying vec2 vUv;
      void main(){ vec3 cur = texture2D(tCur, vUv).rgb; vec3 prv = texture2D(tPrev, vUv).rgb;
        gl_FragColor = vec4(max(cur, prv * uDamp), 1.0); }`
  });

  const lookMat = new T.ShaderMaterial({
    uniforms: {
      tScene: { value: rtScene.texture },
      tDepth: { value: rtScene.depthTexture },
      tTrail: { value: rtA.texture },
      tFilm: { value: filmTex },
      uRes: { value: new T.Vector2(800, 600) },
      uT: { value: 0 },
      uNear: { value: NEAR },
      uFar: { value: FAR },
      uFocusDist: { value: 14.0 },
      uDofOctaves: { value: .78 },
      uTilt: { value: 0.0 },
      uStrataLock: { value: .25 },
      uFocusPulse: { value: 0.0 },
      uRouteMode: { value: initModeIdx },
      uSoloLook: { value: -1 },
      uFocusLook: { value: 4 },
      uFilter: { value: new T.Vector3(1, 1, 1) }
    },
    vertexShader: VS,
    fragmentShader: `
      uniform sampler2D tScene, tDepth, tTrail, tFilm;
      uniform vec2 uRes;
      uniform float uT, uNear, uFar, uFocusDist, uDofOctaves, uTilt, uStrataLock, uFocusPulse;
      uniform int uRouteMode, uSoloLook, uFocusLook;
      uniform vec3 uFilter;
      varying vec2 vUv;

      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float lum(vec3 c){ return clamp(dot(c * uFilter, vec3(0.30, 0.59, 0.11)), 0.0, 1.0); }
      float n2(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), f.x), f.y);
      }
      float readDist(vec2 uv){
        float zb = texture2D(tDepth, uv).x;
        return (uNear * uFar) / max(0.0001, uFar - zb * (uFar - uNear));
      }
      float drip(vec2 uv){
        float cx = floor(uv.x * uRes.x / 6.0);
        if (h(vec2(cx, 7.0)) < 0.78) return 0.0;
        float len = 0.04 + 0.18 * h(vec2(cx, 3.0)), m = 0.0;
        for (int k = 1; k <= 5; k++) {
          float lk = lum(texture2D(tScene, vec2(uv.x, min(1.0, uv.y + len * float(k) / 5.0))).rgb);
          m = max(m, step(0.55, lk));
        }
        return m;
      }

      vec3 evalLook(int mode, vec2 uv, vec3 c, vec3 tr, float l, float ed, float vg) {
        vec2 px = uv * uRes;
        if (mode == 0) {
          /* 0: LIGHT ALONE (Zone 0) */
          float spk = smoothstep(0.992, 1.0, h(floor(px / 2.2) + floor(uT * 6.0) * 3.1));
          vec3 em = mix(c * 0.28, tr, 0.72) * smoothstep(0.18, 0.85, l);
          return em * vec3(1.12, 0.68, 0.34) + spk * vec3(1.0, 0.75, 0.4) * (0.25 + 0.75 * l);
        } else if (mode == 1) {
          /* 1: THE SET (Zone I) */
          vec2 q = uv - 0.5; q *= 1.0 + dot(q, q) * 0.16; vec2 gu = q + 0.5;
          float rows = 96.0;
          vec2 g = vec2(gu.x, (floor(gu.y * rows) + 0.5) / rows);
          float ls = lum(texture2D(tScene, clamp(g, 0.0, 1.0)).rgb);
          float line = 0.72 + 0.28 * sin(gu.y * rows * 6.2832);
          float sweep = smoothstep(0.05, 0.0, abs(fract(gu.y - uT * 0.12) - 0.5) - 0.45) * 0.14;
          vec3 col = vec3(0.76, 0.92, 1.0) * (pow(max(ls - 0.03, 0.0) * 1.45, 0.85) * line + sweep) * vg;
          if (gu.x < 0.0 || gu.x > 1.0 || gu.y < 0.0 || gu.y > 1.0) col = vec3(0.0);
          return col;
        } else if (mode == 2) {
          /* 2: WARM CAVE (Zone II) */
          float th = pow(clamp(l * 1.15, 0.0, 1.0), 0.78);
          vec3 col = th < 0.28 ? mix(vec3(0.04, 0.01, 0.09), vec3(0.45, 0.04, 0.46), th / 0.28)
                   : th < 0.58 ? mix(vec3(0.45, 0.04, 0.46), vec3(0.92, 0.22, 0.08), (th - 0.28) / 0.30)
                   : mix(vec3(0.92, 0.22, 0.08), vec3(1.0, 0.82, 0.28), (th - 0.58) / 0.42);
          return col * (0.9 + 0.1 * sin(px.y * 1.3));
        } else if (mode == 3) {
          /* 3: SILHOUETTE THEATRE (Zone III) */
          vec3 tissue = vec3(0.95, 0.84, 0.64) * (0.76 + 0.24 * vg) * (0.96 + 0.04 * h(floor(px / 2.0)));
          float cut = 1.0 - smoothstep(0.18, 0.36, l);
          vec3 col = mix(tissue, vec3(0.09, 0.07, 0.08), cut);
          col = mix(col, vec3(0.78, 0.14, 0.09), smoothstep(0.76, 0.92, l) * 0.7);
          return col;
        } else if (mode == 4) {
          /* 4: WOODBLOCK (Zone IV) */
          float grain = n2(vec2(px.x / 120.0, px.y / 2.4)) * 0.6 + n2(vec2(px.x / 26.0, px.y / 1.4)) * 0.4;
          vec3 indigo = vec3(0.10, 0.17, 0.28), slate = vec3(0.36, 0.46, 0.52), cream = vec3(0.90, 0.86, 0.75), rust = vec3(0.68, 0.35, 0.18);
          float lq = l + (grain - 0.5) * 0.06;
          vec3 col = lq < 0.16 ? indigo : lq < 0.38 ? slate : lq < 0.72 ? cream : rust;
          if (lq >= 0.16 && lq < 0.38) col = mix(col, indigo, step(0.62, fract((px.x + px.y) / 7.0)) * 0.42);
          col = mix(col, indigo * 0.65, smoothstep(0.04, 0.14, ed));
          return col * (0.92 + 0.10 * grain) * (0.88 + 0.12 * vg);
        } else if (mode == 5) {
          /* 5: SILVER GELATIN (Zone V - Ansel Adams print) */
          float s = smoothstep(0.02, 0.96, l);
          s = s * s * (3.0 - 2.0 * s);
          float gr = (h(floor(px / 1.4)) - 0.5) * 0.032;
          vec3 printTone = mix(vec3(0.04, 0.042, 0.046), vec3(0.96, 0.94, 0.89), clamp(s + gr, 0.0, 1.0));
          return printTone * (0.88 + 0.12 * vg);
        } else if (mode == 6) {
          /* 6: THE CARD (Zone VI - Steel Engraving) */
          vec2 gp = px / 5.2;
          float a = fract(gp.x + gp.y), b = fract(gp.x - gp.y);
          float ink = step(a, smoothstep(0.10, 0.78, 1.0 - l) * 0.88);
          ink = max(ink, step(b, smoothstep(0.42, 0.96, 1.0 - l) * 0.76));
          ink = max(ink, smoothstep(0.06, 0.18, ed));
          return mix(vec3(0.93, 0.90, 0.82) * (0.84 + 0.16 * vg), vec3(0.09, 0.08, 0.10), ink * 0.92);
        } else if (mode == 7) {
          /* 7: SPRAY WALL (Zone VII) */
          float wn = n2(px / 95.0) * 0.6 + n2(px / 22.0) * 0.3 + h(floor(px / 2.0)) * 0.1;
          float ml = smoothstep(0.06, 0.85, lum(texture2D(tFilm, uv).rgb));
          vec3 wall = vec3(0.54, 0.51, 0.47) * (0.65 + 0.45 * wn) * (0.72 + 0.45 * ml);
          float dr = drip(uv);
          float edgeHalo = smoothstep(0.04, 0.14, ed);
          vec3 paste = mix(vec3(l * 0.92 + 0.05), vec3(0.96, 0.94, 0.89), edgeHalo);
          vec3 col = mix(wall, paste, smoothstep(0.28, 0.62, l + edgeHalo * 0.45));
          return mix(col, vec3(0.14, 0.12, 0.11), dr * 0.32) * (0.86 + 0.14 * vg);
        } else if (mode == 8) {
          /* 8: WATERCOLOUR (Zone VIII) */
          float tooth = n2(px / 2.4) * 0.6 + n2(px / 6.5) * 0.4;
          vec3 paper = vec3(0.96, 0.94, 0.89) * (0.94 + 0.08 * tooth);
          vec3 wash = mix(vec3(0.42, 0.58, 0.74), vec3(0.86, 0.70, 0.52), l);
          float pool = smoothstep(0.04, 0.10, ed);
          vec3 col = mix(paper, paper * wash, (0.35 + 0.55 * (1.0 - l)) * (0.65 + 0.4 * tooth));
          col = mix(col, vec3(0.28, 0.30, 0.34), pool * 0.55);
          return col * (0.9 + 0.1 * vg);
        } else if (mode == 9) {
          /* 9: CYANOTYPE (Zone IX) */
          float brush = n2(vec2(px.x / 3.0, px.y / 140.0)) * 0.5 + n2(px / 55.0) * 0.5;
          vec2 q = abs(uv - 0.5) * 2.0;
          float coat = smoothstep(0.98, 0.90, max(q.x, q.y) + (n2(px / 24.0) - 0.5) * 0.08);
          float d = smoothstep(0.16, 0.88, l + 0.08 * n2(px / 40.0));
          vec3 cyano = mix(vec3(0.05, 0.21, 0.52) * (0.82 + 0.3 * brush), vec3(0.94, 0.97, 1.0), d);
          return mix(vec3(0.95, 0.94, 0.90), cyano, coat);
        } else if (mode == 10) {
          /* 10: GLASS / X-RAY (Zone X) */
          float distContour = smoothstep(0.88, 0.98, sin(readDist(uv) * 1.4));
          vec3 xcol = vec3(0.82, 0.93, 1.0) * (smoothstep(0.02, 0.12, ed) * 1.25 + distContour * 0.22);
          return xcol + mix(c, tr, 0.65) * 0.32 * smoothstep(0.55, 0.98, l);
        } else if (mode == 11) {
          /* 11: RISOGRAPH */
          vec3 col = vec3(0.96, 0.93, 0.85);
          float g1 = length(fract(px / 5.5) - 0.5) * 1.5;
          float g2 = length(fract((mat2(0.966, 0.259, -0.259, 0.966) * px) / 5.5) - 0.5) * 1.5;
          float g3 = length(fract((mat2(0.707, 0.707, -0.707, 0.707) * px) / 5.5) - 0.5) * 1.5;
          float l1 = lum(texture2D(tScene, uv + vec2(3.0, 1.0) / uRes).rgb);
          float l2 = lum(texture2D(tScene, uv + vec2(-2.0, 2.5) / uRes).rgb);
          col *= mix(vec3(1.0), vec3(1.0, 0.34, 0.60), step(g1, smoothstep(0.15, 0.75, 1.0 - l1) * 0.85));
          col *= mix(vec3(1.0), vec3(1.0, 0.86, 0.12), step(g2, smoothstep(0.25, 0.85, l2) * 0.75));
          col *= mix(vec3(1.0), vec3(0.14, 0.34, 0.78), step(g3, smoothstep(0.1, 0.55, 1.0 - l) * 0.82));
          col *= mix(vec3(1.0), vec3(0.10, 0.09, 0.12), smoothstep(0.04, 0.15, ed) * 0.85);
          return col;
        } else {
          /* 12: INK WASH */
          float fib = n2(vec2(px.x / 85.0, px.y / 2.2)) * 0.5 + n2(vec2(px.x / 3.0, px.y / 68.0)) * 0.5;
          vec3 paper = vec3(0.95, 0.93, 0.87) * (0.94 + 0.08 * fib);
          float dark = 1.0 - l;
          float ink = smoothstep(0.25, 0.45, dark) * 0.28 + smoothstep(0.50, 0.72, dark) * 0.32 + smoothstep(0.76, 0.95, dark) * 0.35;
          vec3 col = paper * (1.0 - ink * (0.9 + 0.1 * fib));
          vec2 sq = (uv - vec2(0.90, 0.14)) * vec2(uRes.x / uRes.y, 1.0);
          float seal = step(max(abs(sq.x), abs(sq.y)), 0.032) * step(0.28, n2(px / 3.0));
          return mix(col, vec3(0.72, 0.10, 0.08), seal) * (0.9 + 0.1 * vg);
        }
      }

      vec3 evalByFloat(float fz, vec2 uv, vec3 c, vec3 tr, float l, float ed, float vg) {
        float cf = clamp(fz, 0.0, 10.0);
        int i0 = int(floor(cf));
        int i1 = i0 < 10 ? i0 + 1 : 10;
        float t = fract(cf);
        vec3 a = evalLook(i0, uv, c, tr, l, ed, vg);
        vec3 b = (i1 == i0) ? a : evalLook(i1, uv, c, tr, l, ed, vg);
        return mix(a, b, smoothstep(0.15, 0.85, t));
      }

      void main() {
        vec2 uv = vUv;
        vec2 e = 1.0 / uRes;
        float dist = readDist(uv);
        float planeD = uFocusDist * exp((uv.y - 0.5) * uTilt * 2.0);
        float coc = (log2(clamp(dist, uNear, uFar)) - log2(max(planeD, 0.5))) / max(0.12, uDofOctaves);
        float blurR = clamp(abs(coc) - 0.35, 0.0, 2.5) * 0.0028;

        vec3 c = texture2D(tScene, uv).rgb;
        if (blurR > 0.0004) {
          c = (c
            + texture2D(tScene, uv + vec2(blurR, 0.0)).rgb
            + texture2D(tScene, uv - vec2(blurR, 0.0)).rgb
            + texture2D(tScene, uv + vec2(0.0, blurR * 1.2)).rgb
            + texture2D(tScene, uv - vec2(0.0, blurR * 1.2)).rgb) * 0.2;
        }
        vec3 tr = texture2D(tTrail, uv).rgb;
        float l = lum(c);

        float lx = lum(texture2D(tScene, uv + vec2(1.6, 0.0) * e).rgb) - lum(texture2D(tScene, uv - vec2(1.6, 0.0) * e).rgb);
        float ly = lum(texture2D(tScene, uv + vec2(0.0, 1.6) * e).rgb) - lum(texture2D(tScene, uv - vec2(0.0, 1.6) * e).rgb);
        float ed = length(vec2(lx, ly)) * 2.4;
        float vg = smoothstep(1.30, 0.32, length((uv - 0.5) * vec2(1.12, 1.0)) * 1.55);

        vec3 outCol;
        if (uSoloLook >= 0) {
          outCol = evalLook(uSoloLook, uv, c, tr, l, ed, vg);
        } else if (uRouteMode == 0) {
          /* MODE 0: THRESHOLD (Hybrid Tonal + Depth Focus Pull) */
          float zBand = clamp(l * 10.0 + coc * 2.1, 0.0, 10.0);
          vec3 strataCol = evalByFloat(zBand, uv, c, tr, l, ed, vg);
          vec3 focalCol = evalLook(uFocusLook, uv, c, tr, l, ed, vg);
          float sharp = 1.0 - smoothstep(0.45, 1.15, abs(coc));
          outCol = mix(strataCol, focalCol, sharp * (1.0 - uStrataLock));
          float ring = smoothstep(0.14, 0.0, abs(abs(coc) - 0.90)) * uFocusPulse;
          outCol = mix(outCol, vec3(0.95, 0.80, 0.45), ring * 0.65);
        } else if (uRouteMode == 1) {
          /* MODE 1: DEPTH SHELLS (Spatial Microscope Slides around focus plane) */
          float shellZ = clamp(5.0 + coc * 2.4, 0.0, 10.0);
          outCol = evalByFloat(shellZ, uv, c, tr, l, ed, vg);
          float bound = smoothstep(0.09, 0.0, abs(fract(shellZ + 0.5) - 0.5)) * (0.14 + 0.45 * uFocusPulse);
          outCol = mix(outCol, vec3(0.92, 0.82, 0.58), bound);
        } else {
          /* MODE 2: TONAL STRATA (Pure 11-Zone Luminance Stratification) */
          outCol = evalByFloat(l * 10.0, uv, c, tr, l, ed, vg);
          float peak = smoothstep(0.10, 0.0, abs(coc)) * smoothstep(0.05, 0.16, ed) * uFocusPulse;
          outCol = mix(outCol, vec3(0.95, 0.82, 0.55), peak * 0.4);
        }
        gl_FragColor = vec4(clamp(outCol, 0.0, 1.0), 1.0);
      }
    `
  });

  /* ---------- Interactive State & Controls ---------- */
  const state = {
    x: -8.5, z: -4.5, y: 0, yaw: Math.atan2(-22.5, -14.5), pitch: -0.05,
    modeIdx: initModeIdx,
    stopIdx: 2, // f/16
    filterIdx: 0, // Clear
    tilt: 0, // -0.4..+0.4
    focusDist: 14.0,
    soloLook: -1, // -1 = all 11 zones; 0..12 = solo look
    focusLook: 4, // Zone IV Woodblock default
    riding: false,
    onWagon: false,
    leadMode: "lead",
    gaitIdx: 0,
    trayTab: null,
    groundGlass: false,
    focusPulse: 0,
    meteredZone: 4,
    currentZone: 4,
    plates: []
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.plates)) state.plates = saved.plates;
  } catch {}
  state.y = heightAt(state.x, state.z) + 1.68;

  /* ---------- Step Wedge & UI Construction ---------- */
  const wedgeEl = $("step-wedge");
  ZONES.forEach(Z => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch";
    btn.style.background = Z.swatch;
    btn.style.color = Z.z < 5 ? "#f1eee6" : "#141512";
    btn.textContent = ROMAN[Z.z];
    btn.title = `Zone ${ROMAN[Z.z]} · ${Z.name} (${LOOKS[Z.look].name}) — Click focuses, double-click travels`;
    let clickTimer = null;
    btn.addEventListener("click", ev => {
      if (ev.shiftKey) { teleportZone(Z.z); return; }
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        const d = clamp(Math.hypot(Z.x - camera.position.x, Z.pz - camera.position.z), 1.4, 260);
        state.focusDist = d;
        state.focusLook = Z.look;
        state.focusPulse = 1.0;
        updateHUD();
        toast(`Focus racked to Zone ${ROMAN[Z.z]} · ${Z.name} (${d.toFixed(1)} m)`);
      }, 170);
    });
    btn.addEventListener("dblclick", () => {
      clearTimeout(clickTimer);
      teleportZone(Z.z);
    });
    wedgeEl.appendChild(btn);
  });

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 3200);
  }

  function updateFocusKnobVisual() {
    const minL = Math.log(1.2), maxL = Math.log(260);
    const k = clamp((Math.log(state.focusDist) - minL) / (maxL - minL), 0, 1);
    const deg = lerp(-140, 140, k);
    $("focus-knob").style.setProperty("--ang", deg.toFixed(1) + "deg");
    $("focus-knob").setAttribute("aria-valuenow", state.focusDist.toFixed(1));
  }

  function updateHUD() {
    const m = MODES[state.modeIdx];
    const st = STOPS[state.stopIdx];
    const fl = FILTERS[state.filterIdx];
    const Z = ZONES[state.currentZone];
    const activeLook = state.soloLook >= 0 ? LOOKS[state.soloLook] : LOOKS[state.focusLook];
    $("zone-title").textContent = `Zone ${ROMAN[Z.z]} · ${Z.name}`;
    $("hud-sub").textContent = `${m.label} · FOCUS ${state.focusDist.toFixed(1)} m · ${st.name} · ${(state.tilt * 45).toFixed(0)}° TILT · ${fl.name}`;
    $("focus-dist-val").textContent = `${state.focusDist.toFixed(1)} m`;
    $("focus-look-val").textContent = state.soloLook >= 0 ? `SOLO · ${activeLook.name}` : `FOCUS · ${activeLook.name}`;
    $("wedge-caption").textContent = `Meter Zone ${ROMAN[state.meteredZone]} (${LOOKS[ZONES[state.meteredZone].look].name}) · ${m.desc}`;

    const swans = wedgeEl.querySelectorAll(".swatch");
    const capSet = new Set(state.plates.map(p => p.zone));
    swans.forEach((b, idx) => {
      b.classList.toggle("active", idx === state.meteredZone);
      b.classList.toggle("captured", capSet.has(idx));
    });
    updateFocusKnobVisual();

    // Sync shader uniforms
    const u = lookMat.uniforms;
    u.uFocusDist.value = state.focusDist;
    u.uDofOctaves.value = st.oct;
    u.uTilt.value = state.tilt;
    u.uStrataLock.value = st.lock;
    u.uRouteMode.value = state.modeIdx;
    u.uSoloLook.value = state.soloLook;
    u.uFocusLook.value = state.focusLook;
    u.uFilter.value.set(fl.rgb[0], fl.rgb[1], fl.rgb[2]);
  }

  function renderTray() {
    const tray = $("rack-tray");
    const tab = state.trayTab;
    ["mode", "look", "lens", "burro"].forEach(k => $("sp-" + k).setAttribute("aria-pressed", String(tab === k)));
    if (!tab) { tray.hidden = true; return; }
    tray.hidden = false;

    if (tab === "mode") {
      tray.innerHTML = `
        <div class="tray-head"><h2>Focus Pull Mode</h2><button type="button" class="chip" id="tr-close">Done</button></div>
        <p class="tray-note">${MODES[state.modeIdx].desc}</p>
        <div class="chip-grid">
          ${MODES.map((m, i) => `<button type="button" class="chip wide" data-mode="${i}" aria-pressed="${state.modeIdx === i}">${m.label} — ${m.sub}</button>`).join("")}
        </div>
        <div class="sec-label">Teleport to Zone Sanctuary</div>
        <div class="chip-grid">
          ${ZONES.map(z => `<button type="button" class="chip" data-tp="${z.z}">Z-${ROMAN[z.z]} ${z.name}</button>`).join("")}
        </div>`;
      tray.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { state.modeIdx = +b.dataset.mode; state.focusPulse = 1; renderTray(); updateHUD(); });
      tray.querySelectorAll("[data-tp]").forEach(b => b.onclick = () => teleportZone(+b.dataset.tp));
    } else if (tab === "look") {
      const targetName = state.soloLook >= 0 ? `SOLO FULL: ${LOOKS[state.soloLook].name}` : `AT FOCUS: ${LOOKS[state.focusLook].name} (with All 11 Zones active)`;
      tray.innerHTML = `
        <div class="tray-head"><h2>Look Rack (13 Shaders)</h2><button type="button" class="chip" id="tr-close">Done</button></div>
        <p class="tray-note">${targetName}</p>
        <button type="button" class="chip wide" id="lk-all" aria-pressed="${state.soloLook < 0}">All 11 Zone Worlds Live (Disable Solo)</button>
        <div class="sec-label">Solo Look or Assign Sharp Plane Look</div>
        <div class="chip-grid">
          ${LOOKS.map((L, idx) => `<button type="button" class="chip" data-solo="${idx}" aria-pressed="${state.soloLook === idx || (state.soloLook < 0 && state.focusLook === idx)}">${L.zone >= 0 ? "Z-" + ROMAN[L.zone] + " · " : ""}${L.name}</button>`).join("")}
        </div>`;
      $("lk-all").onclick = () => { state.soloLook = -1; renderTray(); updateHUD(); };
      tray.querySelectorAll("[data-solo]").forEach(b => b.onclick = () => {
        const idx = +b.dataset.solo;
        state.soloLook = state.soloLook === idx ? -1 : idx;
        if (state.soloLook < 0) state.focusLook = idx;
        renderTray(); updateHUD();
      });
    } else if (tab === "lens") {
      tray.innerHTML = `
        <div class="tray-head"><h2>8×10 Optical Standard</h2><button type="button" class="chip" id="tr-close">Done</button></div>
        <div class="sec-label">Aperture Stop (controls focal slice & strata lock)</div>
        <div class="chip-grid">${STOPS.map((s, i) => `<button type="button" class="chip" data-stop="${i}" aria-pressed="${state.stopIdx === i}">${s.name}</button>`).join("")}</div>
        <div class="sec-label">Scheimpflug Front Standard Tilt</div>
        <div class="chip-grid">
          <button type="button" class="chip" data-tilt="-0.32" aria-pressed="${state.tilt < -0.1}">Near-Far Tilt (−)</button>
          <button type="button" class="chip" data-tilt="0" aria-pressed="${Math.abs(state.tilt) < 0.05}">Level (0°)</button>
          <button type="button" class="chip" data-tilt="0.32" aria-pressed="${state.tilt > 0.1}">Reverse Tilt (+)</button>
        </div>
        <div class="sec-label">Optical Filter Glass (1–5)</div>
        <div class="chip-grid">${FILTERS.map((f, i) => `<button type="button" class="chip" data-flt="${i}" aria-pressed="${state.filterIdx === i}">${f.short}</button>`).join("")}</div>
        <button type="button" class="chip wide" id="gg-tgl" aria-pressed="${state.groundGlass}">Ground-Glass Dark Cloth (G)</button>`;
      tray.querySelectorAll("[data-stop]").forEach(b => b.onclick = () => { state.stopIdx = +b.dataset.stop; state.focusPulse = .8; renderTray(); updateHUD(); });
      tray.querySelectorAll("[data-tilt]").forEach(b => b.onclick = () => { state.tilt = +b.dataset.tilt; renderTray(); updateHUD(); });
      tray.querySelectorAll("[data-flt]").forEach(b => b.onclick = () => { state.filterIdx = +b.dataset.flt; renderTray(); updateHUD(); });
      $("gg-tgl").onclick = () => { state.groundGlass = !state.groundGlass; document.body.classList.toggle("ground-glass", state.groundGlass); renderTray(); };
    } else if (tab === "burro") {
      const m = donkey.mind, ds = donkey.state;
      const bar = (lbl, v) => `<div class="mind-bar"><span>${lbl}</span><i><em style="width:${Math.round(v * 100)}%"></em></i><b>${Math.round(v * 100)}%</b></div>`;
      tray.innerHTML = `
        <div class="tray-head"><h2>Mistletoe &amp; Wagon</h2><button type="button" class="chip" id="tr-close">Done</button></div>
        <p class="tray-note">${ds.thought} · Gait: ${["Walk", "Trot", "Canter", "Gallop"][state.gaitIdx]} · Load ${Math.round(ds.cargo.m)} kg.</p>
        <div class="chip-grid">
          <button type="button" class="chip" id="br-ride" aria-pressed="${state.riding}">${state.riding ? "Dismount (V)" : "Ride Mistletoe (V)"}</button>
          <button type="button" class="chip" id="br-deck" aria-pressed="${state.onWagon}">${state.onWagon ? "Step Off Deck (B)" : "Wagon Roof-Deck (B)"}</button>
          <button type="button" class="chip" id="br-gait">Pace: ${["Walk", "Trot", "Canter", "Gallop"][state.gaitIdx]}</button>
          <button type="button" class="chip" id="br-teth" aria-pressed="${state.leadMode === "tethered"}">${state.leadMode === "tethered" ? "Lead Rope" : "Tether"}</button>
        </div>
        <div class="sec-label">Pack Donkey Mind</div>
        ${bar("Trust", m.trust)}
        ${bar("Calm", 1 - m.fear)}
        ${bar("Energy", ds.stamina)}
        ${bar("Fed", 1 - m.hunger)}
        <div class="chip-grid">
          <button type="button" class="chip" id="br-feed">Feed Oats</button>
          <button type="button" class="chip" id="br-soothe">Soothe</button>
          <button type="button" class="chip" id="br-bray">Bray</button>
        </div>`;
      $("br-ride").onclick = () => { toggleRide(); renderTray(); };
      $("br-deck").onclick = () => { toggleWagonDeck(); renderTray(); };
      $("br-gait").onclick = () => { state.gaitIdx = (state.gaitIdx + 1) % 4; renderTray(); };
      $("br-teth").onclick = () => {
        state.leadMode = state.leadMode === "tethered" ? "lead" : "tethered";
        donkey.state.tethered = state.leadMode === "tethered";
        renderTray();
      };
      $("br-feed").onclick = () => { donkey.feed(); toast("Mistletoe munches oats gratefully."); renderTray(); };
      $("br-soothe").onclick = () => { donkey.soothe(); toast("A steady hand on Mistletoe’s shoulder."); renderTray(); };
      $("br-bray").onclick = () => { donkey.bray(); toast("Mistletoe brays across the valley."); };
    }
    const cls = $("tr-close");
    if (cls) cls.onclick = () => { state.trayTab = null; renderTray(); };
  }

  ["mode", "look", "lens", "burro"].forEach(k => {
    $("sp-" + k).addEventListener("click", () => {
      state.trayTab = state.trayTab === k ? null : k;
      renderTray();
    });
  });

  $("sp-clocks").addEventListener("click", () => {
    const on = audio.toggle();
    $("sp-clocks").setAttribute("aria-pressed", String(on));
    toast(on ? "Three Clocks WebAudio engaged — tone tracks your Zone." : "Three Clocks sound muted.");
  });

  /* ---------- Actions: Teleport, Ride, Wagon Deck, Expose Plate ---------- */
  function teleportZone(zoneIdx) {
    const Z = ZONES[clamp(zoneIdx, 0, 10)];
    state.riding = false; state.onWagon = false;
    state.x = Z.x; state.z = Z.pz + 6.5;
    state.y = heightAt(state.x, state.z) + 1.68;
    state.yaw = Math.atan2(-(Z.x - state.x), -(Z.pz - state.z));
    state.pitch = -.06;
    state.focusDist = 7.5;
    state.focusLook = Z.look;
    state.focusPulse = 1.0;
    donkey.place(Z.x + 2.8, Z.pz + 2.2, state.yaw + .4, heightAt);
    updateHUD();
    toast(`Arrived at Zone ${ROMAN[Z.z]} · ${Z.name}`);
  }

  function toggleRide() {
    if (state.onWagon) state.onWagon = false;
    if (!state.riding && Math.hypot(donkey.state.x - state.x, donkey.state.z - state.z) > 12) {
      donkey.place(state.x + 1.8, state.z + 1.8, state.yaw, heightAt);
    }
    state.riding = !state.riding;
    state.leadMode = "lead"; donkey.state.tethered = false;
    if (state.riding) state.yaw = donkey.state.heading + Math.PI;
    toast(state.riding ? "Mounted Mistletoe — WASD to ride, [ / ] to pull focus." : "Dismounted.");
  }

  function toggleWagonDeck() {
    state.riding = false;
    state.onWagon = !state.onWagon;
    if (state.onWagon) {
      state.x = wagon.standX; state.z = wagon.standZ;
      state.y = wagon.deckY + 1.66;
      state.yaw = Math.atan2(-(58 - wagon.standX), -(42 - wagon.standZ));
      state.pitch = -0.06;
      toast("Atop Woody Station Wagon roof-deck — panoramic tripod elevation.");
    } else {
      state.x = wagon.x + 3.2; state.z = wagon.z + 1.4;
      state.y = heightAt(state.x, state.z) + 1.68;
      toast("Climbed down from Woody Station Wagon.");
    }
  }

  function renderFrame() {
    const w = renderer.domElement.width, h = renderer.domElement.height;
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);

    const lookInfo = LOOKS[state.soloLook >= 0 ? state.soloLook : state.focusLook];
    accMat.uniforms.tCur.value = rtScene.texture;
    accMat.uniforms.tPrev.value = rtA.texture;
    accMat.uniforms.uDamp.value = state.soloLook >= 0 ? lookInfo.trail : .76;
    postQuad.material = accMat;
    renderer.setRenderTarget(rtB);
    renderer.render(postScene, postCam);
    [rtA, rtB] = [rtB, rtA];

    lookMat.uniforms.tTrail.value = rtA.texture;
    lookMat.uniforms.uRes.value.set(w, h);
    postQuad.material = lookMat;
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  function exposePlate() {
    audio.shutter();
    const fl = $("flash"); fl.classList.remove("go"); void fl.offsetWidth; fl.classList.add("go");
    renderFrame();

    // Capture 5:4 archival contact plate crop
    const tmp = document.createElement("canvas");
    const cw = 640, ch = 512;
    tmp.width = cw; tmp.height = ch;
    const tx = tmp.getContext("2d");
    const sw = canvas.width, sh = canvas.height;
    const aspect = 5 / 4;
    let sx = 0, sy = 0, sWidth = sw, sHeight = sh;
    if (sw / sh > aspect) { sWidth = Math.round(sh * aspect); sx = Math.round((sw - sWidth) / 2); }
    else { sHeight = Math.round(sw / aspect); sy = Math.round((sh - sHeight) / 2); }
    tx.drawImage(canvas, sx, sy, sWidth, sHeight, 0, 0, cw, ch);

    const plate = {
      id: state.plates.length + 1,
      zone: state.meteredZone,
      roman: ROMAN[state.meteredZone],
      place: ZONES[state.meteredZone].name,
      mode: MODES[state.modeIdx].label,
      look: LOOKS[state.soloLook >= 0 ? state.soloLook : state.focusLook].name,
      focus: state.focusDist.toFixed(1) + " m",
      stop: STOPS[state.stopIdx].name,
      filter: FILTERS[state.filterIdx].short,
      dataUrl: tmp.toDataURL("image/jpeg", .84)
    };
    state.plates.push(plate);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ plates: state.plates.slice(-22) })); } catch {}
    updateHUD();
    toast(`Exposed Plate #${plate.id} · Zone ${plate.roman} (${plate.look} @ ${plate.focus})`);
  }
  $("expose-btn").addEventListener("click", exposePlate);

  function openPlateBox() {
    const box = $("platebox"), grid = $("pl-grid"), big = $("pl-big"), note = $("pl-note");
    const got = new Set(state.plates.map(p => p.zone));
    note.textContent = `${state.plates.length} exposed plate(s) · ${got.size}/11 Tonal Zones captured across the valley.`;
    big.hidden = true;
    grid.innerHTML = state.plates.length ? state.plates.slice().reverse().map(p => `
      <button type="button" class="pl-card" data-pid="${p.id}">
        <img src="${p.dataUrl}" alt="Zone ${p.roman} plate">
        <small><strong>#${p.id} · Zone ${p.roman}</strong> (${p.place})<br>${p.mode} · ${p.look} · ${p.focus} · ${p.stop}</small>
      </button>`).join("") : `<p class="tray-note">No 8×10 plates exposed yet. Rack the brass focus knob and press Space or Expose.</p>`;
    grid.querySelectorAll("[data-pid]").forEach(btn => {
      btn.onclick = () => {
        const p = state.plates.find(x => x.id === +btn.dataset.pid);
        if (p) { big.src = p.dataUrl; big.hidden = false; }
      };
    });
    box.hidden = false;
  }
  $("sp-plates").addEventListener("click", openPlateBox);
  $("pl-close").addEventListener("click", () => { $("platebox").hidden = true; });

  /* ---------- Input: Keyboard, Pointer Drag Look, Wheel & Brass Focus Knob ---------- */
  const keys = Object.create(null);
  addEventListener("keydown", e => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    keys[e.code] = true;
    if (e.code === "BracketLeft") { state.focusDist = clamp(state.focusDist * .86, 1.2, 260); state.focusPulse = 1; updateHUD(); }
    else if (e.code === "BracketRight") { state.focusDist = clamp(state.focusDist * 1.16, 1.2, 260); state.focusPulse = 1; updateHUD(); }
    else if (e.code === "KeyV") toggleRide();
    else if (e.code === "KeyB") toggleWagonDeck();
    else if (e.code === "KeyG") { state.groundGlass = !state.groundGlass; document.body.classList.toggle("ground-glass", state.groundGlass); }
    else if (e.code === "Space") { e.preventDefault(); exposePlate(); }
    else if (e.code === "KeyQ") { state.tilt = clamp(state.tilt - .16, -.35, .35); updateHUD(); }
    else if (e.code === "KeyE") { state.tilt = clamp(state.tilt + .16, -.35, .35); updateHUD(); }
    else if (e.code >= "Digit1" && e.code <= "Digit5") { state.filterIdx = +e.code.slice(5) - 1; updateHUD(); }
  });
  addEventListener("keyup", e => { keys[e.code] = false; });

  // Pointer drag look on canvas
  let dragLook = false, lastPX = 0, lastPY = 0;
  canvas.addEventListener("pointerdown", e => {
    dragLook = true; lastPX = e.clientX; lastPY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if (!dragLook) return;
    state.yaw -= (e.clientX - lastPX) * .0045;
    state.pitch = clamp(state.pitch - (e.clientY - lastPY) * .0038, -.82, .82);
    lastPX = e.clientX; lastPY = e.clientY;
  });
  addEventListener("pointerup", () => { dragLook = false; });

  // Scroll wheel racks focus
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.09 : 0.917;
    state.focusDist = clamp(state.focusDist * factor, 1.2, 260);
    state.focusPulse = 1.0;
    updateHUD();
  }, { passive: false });

  // Draggable rotary brass focus knob
  const knobEl = $("focus-knob");
  let dragKnob = false, knobX0 = 0, knobF0 = 14;
  knobEl.addEventListener("pointerdown", e => {
    dragKnob = true; knobX0 = e.clientX; knobF0 = state.focusDist;
    knobEl.setPointerCapture(e.pointerId); e.stopPropagation();
  });
  knobEl.addEventListener("pointermove", e => {
    if (!dragKnob) return;
    const dx = e.clientX - knobX0;
    state.focusDist = clamp(knobF0 * Math.exp(dx * .014), 1.2, 260);
    state.focusPulse = 1.0;
    updateHUD();
  });
  addEventListener("pointerup", () => { dragKnob = false; });

  /* ---------- Resize ---------- */
  function resize() {
    const dpr = renderer.getPixelRatio();
    const w = Math.max(2, Math.floor(innerWidth * dpr));
    const h = Math.max(2, Math.floor(innerHeight * dpr));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / Math.max(1, innerHeight);
    camera.updateProjectionMatrix();
    rtScene.setSize(w, h);
    rtA.setSize(w, h);
    rtB.setSize(w, h);
  }
  addEventListener("resize", resize);
  resize();

  /* ---------- Raycast Meter for Center Reticle ---------- */
  const raycaster = new T.Raycaster();
  const centerVec = new T.Vector2(0, 0);
  const donkeyHand = new T.Vector3(), halterOut = new T.Vector3(), saddlePos = new T.Vector3();

  function sampleMeter() {
    raycaster.setFromCamera(centerVec, camera);
    const hits = raycaster.intersectObject(terrainMesh, false);
    if (hits.length) {
      const p = hits[0].point;
      const alb = terrainAlbedo(p.x, p.z, p.y);
      const filtered = alb * (FILTERS[state.filterIdx].rgb[0] * .3 + FILTERS[state.filterIdx].rgb[1] * .59 + FILTERS[state.filterIdx].rgb[2] * .11);
      state.meteredZone = clamp(Math.round(filtered * 10), 0, 10);
    } else {
      state.meteredZone = 8; // high sky/cloud
    }
    const proj = valleyProjection(state.x, state.z);
    state.currentZone = clamp(Math.round(proj.t * 10), 0, 10);
  }

  /* ---------- Main Simulation & Render Loop ---------- */
  let lastT = performance.now(), meterClock = 0;
  function step(dt) {
    const fwdInput = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const sideInput = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const shiftPace = keys.ShiftLeft || keys.ShiftRight ? Math.max(1, state.gaitIdx) : state.gaitIdx;

    if (state.onWagon && (fwdInput || sideInput)) {
      // Step down smoothly if walking off the roof-deck
      if (Math.abs(fwdInput) > 0) toggleWagonDeck();
    }

    if (state.riding) {
      // Ride Mistletoe directly
      const prevH = donkey.state.heading;
      donkey.update(dt, {
        throttle: fwdInput,
        steer: -sideInput,
        pace: shiftPace,
        near: 0, drop: 0
      }, heightAt);
      state.yaw += Math.atan2(Math.sin(donkey.state.heading - prevH), Math.cos(donkey.state.heading - prevH));
      donkey.saddleAt(saddlePos);
      state.x = donkey.state.x; state.z = donkey.state.z; state.y = saddlePos.y + .72;
    } else if (!state.onWagon) {
      // Walk on foot
      const speed = (keys.ShiftLeft || keys.ShiftRight ? 9.5 : 5.4);
      const sx = Math.sin(state.yaw), cz = Math.cos(state.yaw);
      let nx = state.x + (-sx * fwdInput + cz * sideInput) * speed * dt;
      let nz = state.z + (-cz * fwdInput - sx * sideInput) * speed * dt;
      nx = clamp(nx, -180, 210); nz = clamp(nz, -180, 210);
      // Collide solids + unfrozen chasms
      let blocked = false;
      for (const s of solids) {
        if (Math.hypot(nx - s.x, nz - s.z) < s.r + .45) { blocked = true; break; }
      }
      const ch = channelFactor(nx, nz);
      const th = inThresholdSpan(nx, nz);
      const onSolidBridge = th && th.solidFactor >= .5;
      if ((ch.river > .55 || ch.chasm > .55 || ch.crev > .55) && !onSolidBridge) {
        blocked = true;
      }
      if (!blocked) { state.x = nx; state.z = nz; }
      state.y = lerp(state.y, heightAt(state.x, state.z) + 1.68, clamp(dt * 12, 0, 1));

      // Mistletoe follows when tethered=false in lead mode
      const dx = state.x - donkey.state.x, dz = state.z - donkey.state.z;
      const dist = Math.hypot(dx, dz);
      if (state.leadMode === "lead" && dist > 3.6) {
        const wantAng = Math.atan2(dx, dz);
        const diff = Math.atan2(Math.sin(wantAng - donkey.state.heading), Math.cos(wantAng - donkey.state.heading));
        donkey.update(dt, { throttle: clamp((dist - 3.0) * .5, 0, 1), steer: clamp(diff * 1.4, -1, 1), pace: dist > 9 ? 1 : 0, near: 1, drop: 0 }, heightAt);
      } else {
        donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: dist < 3.5 ? 1 : 0, drop: 0 }, heightAt);
      }
    } else {
      donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 0, drop: 0 }, heightAt);
    }

    // Update Camera
    camera.position.set(state.x, state.y, state.z);
    camera.rotation.order = "YXZ";
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
    camera.updateMatrixWorld();

    // Update Threshold-of-Recognition bridges based on focal plane intersection
    const stOct = STOPS[state.stopIdx].oct;
    for (const th of thresholds) {
      const distToBridge = Math.hypot(th.x - camera.position.x, th.z - camera.position.z);
      const logDiff = Math.abs(Math.log2(Math.max(1, distToBridge) / state.focusDist));
      const targetSolid = logDiff <= Math.max(0.45, stOct * 0.95) ? 1 : 0;
      th.solidFactor = lerp(th.solidFactor, targetSolid, 1 - Math.exp(-dt * 12));
      th.solidMat.opacity = lerp(0.18, 0.96, th.solidFactor);
      th.wireMat.opacity = lerp(0.85, 0.08, th.solidFactor);
    }

    // Animate Film Strips subtly
    const nowSec = performance.now() * .001;
    for (const f of filmStrips) {
      f.mesh.position.y = f.baseY + Math.sin(nowSec * .9 + f.phase) * .22;
    }

    // Update Lead Rope catenary
    leadRope.visible = !state.riding && !state.onWagon;
    if (leadRope.visible) {
      donkey.halterRing(halterOut);
      donkeyHand.set(state.x + Math.cos(state.yaw) * .35, state.y - .42, state.z - Math.sin(state.yaw) * .35);
      const posArr = ropeGeo.attributes.position.array;
      const distR = halterOut.distanceTo(donkeyHand);
      const sag = clamp(distR * .14, .1, 1.1);
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        posArr[i * 3] = lerp(donkeyHand.x, halterOut.x, u);
        posArr[i * 3 + 1] = lerp(donkeyHand.y, halterOut.y, u) - Math.sin(u * Math.PI) * sag;
        posArr[i * 3 + 2] = lerp(donkeyHand.z, halterOut.z, u);
      }
      ropeGeo.attributes.position.needsUpdate = true;
    }

    // Uniform animations
    skyMat.uniforms.uTime.value = nowSec;
    lookMat.uniforms.uT.value = nowSec;
    state.focusPulse = Math.max(0, state.focusPulse - dt * 1.4);
    lookMat.uniforms.uFocusPulse.value = state.focusPulse;

    meterClock += dt;
    if (meterClock > .12) {
      meterClock = 0;
      sampleMeter();
      $("thought").textContent = donkey.state.thought || "Listening to the terrain tones.";
      updateHUD();
    }
    audio.tick(dt, state.meteredZone);
  }

  function loop(now) {
    const dt = Math.min(.05, (now - lastT) / 1000);
    lastT = now;
    step(dt);
    renderFrame();
    requestAnimationFrame(loop);
  }

  // Initial sync & expose automation/inspection hook
  updateHUD();
  requestAnimationFrame(loop);

  window.__zones = {
    getState: () => ({
      mode: MODES[state.modeIdx].id,
      soloLook: state.soloLook,
      focusLook: LOOKS[state.focusLook].id,
      focusDist: state.focusDist,
      stop: STOPS[state.stopIdx].name,
      filter: FILTERS[state.filterIdx].name,
      currentZone: state.currentZone,
      meteredZone: state.meteredZone,
      x: state.x, z: state.z, y: state.y,
      riding: state.riding,
      onWagon: state.onWagon,
      plates: state.plates.length,
      thresholds: thresholds.map(t => ({ id: t.id, dist: Math.hypot(t.x - state.x, t.z - state.z), solid: +(t.solidFactor.toFixed(2)) }))
    }),
    setMode: id => { const i = MODES.findIndex(m => m.id === id); if (i >= 0) { state.modeIdx = i; state.focusPulse = 1; updateHUD(); if (state.trayTab) renderTray(); } },
    setFocus: m => { state.focusDist = clamp(m, 1.2, 260); state.focusPulse = 1; updateHUD(); },
    setStop: i => { state.stopIdx = clamp(i, 0, STOPS.length - 1); updateHUD(); if (state.trayTab) renderTray(); },
    setFilter: i => { state.filterIdx = clamp(i, 0, FILTERS.length - 1); updateHUD(); if (state.trayTab) renderTray(); },
    setSoloLook: id => { state.soloLook = id ? LOOKS.findIndex(l => l.id === id) : -1; updateHUD(); if (state.trayTab) renderTray(); },
    exposePlate,
    teleportZone,
    toggleRide,
    toggleWagonDeck
  };
})();
