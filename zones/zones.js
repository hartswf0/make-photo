/* THRESHOLD · Donkey Water Sci-Fi & Eleven Tonal Worlds
 * Combines 14 high-definition Zone/JellyOrchestra GPU shaders (including CYAN JERIKAN selective-cyan print),
 * 4 optical routing modes (DONKEY WATER, THRESHOLD, DEPTH SHELLS, TONAL STRATA),
 * drivable Survey Cart with jerikans, interactive cast-iron pump well & basin, cyan rain,
 * Zone X blue-lit sanctuary steps, shared Mistletoe burro, Three-Clocks WebAudio & Cyan Jerikan soundtrack. */
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

  /* ---------- Core Catalog: 11 Zone Worlds + 14 High-Definition Shader Looks ---------- */
  const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const LOOKS = [
    { id: "embers", name: "LIGHT ALONE", zone: 0, trail: .88, desc: "Darkness pierced by drifting embers while keeping surface definition." },
    { id: "set", name: "THE SET", zone: 1, trail: .36, desc: "High-definition 320-line phosphor monitor with slow sync sweep." },
    { id: "cave", name: "WARM CAVE", zone: 2, trail: .72, desc: "Thermal heat vision blended with crisp stone relief." },
    { id: "silhouette", name: "SILHOUETTE", zone: 3, trail: .22, desc: "Lit warm tissue paper, crisp ink shadows, and vermilion highlights." },
    { id: "woodblock", name: "WOODBLOCK", zone: 4, trail: .15, desc: "Carved indigo, slate, cream, and rust woodcut blocks with surface grain." },
    { id: "silver", name: "SILVER GELATIN", zone: 5, trail: .08, desc: "High-clarity Ansel Adams selenium-toned 8×10 silver print." },
    { id: "card", name: "THE CARD", zone: 6, trail: .10, desc: "Cream archival stock hatched and cross-engraved by light." },
    { id: "spray", name: "SPRAY WALL", zone: 7, trail: .82, desc: "Celluloid mural wall, white paper outlines, and dripping pigment." },
    { id: "watercolour", name: "WATERCOLOUR", zone: 8, trail: .16, desc: "Pencil underdrawing washed with translucent pigment on paper." },
    { id: "cyanotype", name: "CYANOTYPE", zone: 9, trail: .65, desc: "Brushed Prussian blue blueprint exposed to bright highland sun." },
    { id: "glass", name: "GLASS", zone: 10, trail: .76, desc: "X-ray refraction tracing glowing contour edges over deep stone." },
    { id: "risograph", name: "RISOGRAPH", zone: -1, trail: .12, desc: "Misregistered pink, yellow, and cobalt halftone drums on cream." },
    { id: "inkwash", name: "INK WASH", zone: -1, trail: .16, desc: "Sumi-e ink dilutions on fibrous paper with red stone seal." },
    { id: "jerikan", name: "CYAN JERIKAN", zone: -1, trail: .32, desc: "Silver-gelatin desert & stone with selective electric-cyan water, jerikans, rain & ridge door." }
  ];

  const ZONES = [
    { z: 0, look: 0, refl: .05, name: "Lava Tube Cavern", swatch: "#080809", x: -126, pz: -102, desc: "Obsidian archway with glowing cyan-ember crystals." },
    { z: 1, look: 1, refl: .11, name: "Basalt Night Mesa", swatch: "#15161a", x: -96, pz: -72, desc: "Hexagonal basalt columns scanned across high-res phosphor." },
    { z: 2, look: 2, refl: .18, name: "Sequoia Thermal Slot", swatch: "#262328", x: -64, pz: -46, desc: "Dark redwood trunks in a shaded geothermal cleft." },
    { z: 3, look: 3, refl: .27, name: "Merced Pine Timber", swatch: "#393734", x: -30, pz: -22, desc: "Sierra conifers backing crisp paper silhouettes." },
    { z: 4, look: 13, refl: .38, name: "Wellhead & Terrace", swatch: "#54524a", x: 0, pz: 0, desc: "Cast-iron hand pump, cyan basin, Survey Cart & Mistletoe." },
    { z: 5, look: 5, refl: .50, name: "Tuolumne Meadow", swatch: "#76746b", x: 28, pz: 20, desc: "Middle-gray equilibrium meadow & silver-gelatin split-rail trail." },
    { z: 6, look: 6, refl: .64, name: "Cyan River Ford", swatch: "#96948a", x: 58, pz: 42, desc: "Focus-solidified stone causeway spanning the cyan river seam." },
    { z: 7, look: 7, refl: .74, name: "Kiosk Ridge Wall", swatch: "#b5b2a6", x: 86, pz: 62, desc: "Granite monoliths, cassette kiosk awning & mural relief." },
    { z: 8, look: 8, refl: .83, name: "Gypsum Dune Wash", swatch: "#cfcbb9", x: 114, pz: 86, desc: "Wind-sculpted white dunes & focus-locked chasm arch." },
    { z: 9, look: 9, refl: .90, name: "Cosmic Addis Flats", swatch: "#e4e3d8", x: 140, pz: 108, desc: "Alkali tufa spires exposed on brushed Prussian cyanotype." },
    { z: 10, look: 10, refl: .96, name: "Blue-Lit Sanctuary", swatch: "#f6f4ec", x: 164, pz: 126, desc: "Stone steps climbing toward the luminous cyan sanctuary door." }
  ];

  const MODES = [
    { id: "jerikan", label: "DONKEY WATER", sub: "Cyan Jerikan Sci-Fi", desc: "High-definition silver-gelatin world with electric-cyan water, jerikans & rain; focus sweeps a cyan threshold band across distance." },
    { id: "threshold", label: "THRESHOLD", sub: "Tonal + Depth Pull", desc: "All 11 Zone shaders populate tonal & depth bands while sharp focus crystallizes solid crossings." },
    { id: "shells", label: "DEPTH SHELLS", sub: "Spatial Slides", desc: "Eleven concentric spatial Zone shaders sweep across 3D distance around your focal plane." },
    { id: "strata", label: "TONAL STRATA", sub: "11-Zone Bands", desc: "Filtered scene luminance routes every pixel into its Zone shader (0–X) with sharp 3D surface definition." }
  ];

  const STOPS = [
    { name: "f/5.6", oct: .36, lock: 0 },
    { name: "f/8", oct: .52, lock: .08 },
    { name: "f/16", oct: .84, lock: .24 },
    { name: "f/32", oct: 1.35, lock: .56 },
    { name: "f/64", oct: 2.2, lock: .88 }
  ];

  const FILTERS = [
    { name: "CLEAR", short: "Clear", rgb: [1, 1, 1], jerikan: 0 },
    { name: "YELLOW #8", short: "Yellow", rgb: [1.14, 1.05, .42], jerikan: 0 },
    { name: "ORANGE #15", short: "Orange", rgb: [1.26, .88, .24], jerikan: 0 },
    { name: "RED #25", short: "Red", rgb: [1.45, .44, .18], jerikan: 0 },
    { name: "GREEN #58", short: "Green", rgb: [.52, 1.32, .56], jerikan: 0 },
    { name: "BLUE JERIKAN #47B", short: "Jerikan #47B", rgb: [1.02, 1.02, 1.18], jerikan: 1 }
  ];

  const LYRICS = [
    [0, "Intro · Warm cassette tape wakes before the rooster."],
    [12, "“Iron lever cracks before the rooster / My hands know the cold of it.”"],
    [28, "“Cyan jerikan balanced on my shoulder blade / Stone steps climbing toward a blue-lit door.”"],
    [45, "“Take this water from my well / Will you carry what I cannot.”"],
    [62, "“Carry the cyan up the ridge with me / Hooves on cobble and the tape is turning.”"],
    [94, "“Kidase hums beneath the kiosk awning / Static blooms across the dial.”"],
    [118, "“My father dubbed his Tezeta onto ferric / Every slosh a metronome.”"],
    [152, "“Carry the cyan up the ridge with me / Brass comes back and the crates are spinning.”"],
    [186, "“Rope creaks · Wind holds its breath · The drums step out · And the basin fills.”"],
    [220, "“Cosmic Addis Arkestra — carry the cyan to the blue-lit door.”"]
  ];

  const STORAGE_KEY = "make-photo-zones-v2";
  const urlMode = new URLSearchParams(location.search).get("mode");
  const initModeIdx = urlMode && MODES.some(m => m.id === urlMode) ? MODES.findIndex(m => m.id === urlMode) : 0;

  /* ---------- WebAudio: Three Clocks + Iron Pump + Hoof + Shutter + Tape Analyser ---------- */
  const audio = (() => {
    let ctx = null, master = null, enabled = false;
    let analyser = null, freqData = null, tapeConnected = false;
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
        master.gain.value = .5;
        master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return true;
    }
    function connectTape(el) {
      if (tapeConnected || !el || !ensure()) return;
      try {
        const src = ctx.createMediaElementSource(el);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        freqData = new Uint8Array(analyser.frequencyBinCount);
        src.connect(analyser);
        analyser.connect(ctx.destination);
        tapeConnected = true;
      } catch {}
    }
    function sampleTape() {
      if (!analyser || !freqData) return { bass: 0, high: 0 };
      analyser.getByteFrequencyData(freqData);
      let b = 0, hi = 0;
      for (let i = 0; i < 6; i++) b += freqData[i];
      for (let i = 18; i < 36; i++) hi += freqData[i];
      return { bass: b / (6 * 255), high: hi / (18 * 255) };
    }
    function tone(freq, dur, vol, type = "triangle", pan = 0, force = false) {
      if ((!enabled && !force) || !ensure()) return;
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
    function shutter() { tone(190, .06, .18, "square", 0, true); setTimeout(() => tone(840, .04, .09, "triangle", 0, true), 35); }
    function pumpClank() {
      tone(138, .08, .22, "square", .1, true);
      setTimeout(() => tone(520, .14, .11, "sine", -.15, true), 60);
      setTimeout(() => tone(690, .18, .09, "sine", .15, true), 130);
    }
    function step(leg, gait) {
      if (!enabled) return;
      tone((gait > 1 ? 128 : 92) + leg * 11, .055, gait > 1 ? .08 : .045, "triangle", leg % 2 ? .28 : -.28);
    }
    function tick(dt, zoneIdx) {
      if (!enabled) return;
      const baseFreq = 165 * Math.pow(2, zoneIdx * .07);
      for (const c of clocks) {
        c.acc += dt;
        if (c.acc >= c.period) { c.acc -= c.period; tone(baseFreq * c.ratio, .34, .06, zoneIdx < 3 ? "sine" : "triangle", c.pan); }
      }
    }
    return {
      toggle() { enabled = !enabled; if (enabled) ensure(); return enabled; },
      isOn: () => enabled,
      connectTape, sampleTape, tick, shutter, pumpClank, step
    };
  })();

  /* ---------- Terrain & Biome Field Functions ---------- */
  function valleyProjection(x, z) {
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
    const rx = (x - 58) * .78 - (z - 42) * .62;
    const bend = Math.sin((x + z) * .045) * 9.5;
    const riverDist = Math.abs(rx + bend);
    const waterMask = smooth(11.5, 4.5, riverDist) * smooth(135, 35, Math.hypot(x - 58, z - 42));
    const cx = (x - 114) * .75 - (z - 86) * .66;
    const chasmMask = smooth(7.5, 3.2, Math.abs(cx)) * smooth(32, 10, Math.hypot(x - 114, z - 86));
    const gx = (x - 153) * .75 - (z - 118) * .66;
    const crevMask = smooth(7.2, 3.0, Math.abs(gx)) * smooth(30, 8, Math.hypot(x - 153, z - 118));
    return { river: waterMask, chasm: chasmMask, crev: crevMask };
  }

  function terrainHeight(x, z) {
    const proj = valleyProjection(x, z);
    const zCoord = proj.t * 10;
    const ridgeWall = smooth(15, 66, proj.dist);
    const coarse = (fbm(x * .014 + 3.1, z * .014 + 1.7, 4) - .46) * (6.2 + ridgeWall * 26.0);
    const detail = (fbm(x * .06, z * .06, 2) - .5) * 1.25;
    const macro = lerp(-3.0, 11.8, smooth(0, 10, zCoord)) + ridgeWall * (7.5 + 1.05 * zCoord);
    let h = macro + coarse * (.32 + .68 * ridgeWall) + detail;
    for (const Z of ZONES) {
      const k = smooth(12, 3.0, Math.hypot(x - Z.x, z - Z.pz));
      h = lerp(h, macro + (fbm(Z.x * .014 + 3.1, Z.pz * .014 + 1.7, 4) - .46) * 2.0, k * .78);
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
    const strat = (fbm(x * .085 + h * .16, z * .085, 3) - .5) * .30;
    const ridgeline = smooth(20, 68, proj.dist) * .16;
    const ch = channelFactor(x, z);
    return clamp(base + strat + ridgeline - ch.river * .12 - ch.chasm * .30 - ch.crev * .18, .04, .97);
  }

  /* ---------- Threshold Crossings (Solidified in Focus or Ahead of Cart Headlights) ---------- */
  const thresholds = [];
  function inThresholdSpan(x, z) {
    for (const th of thresholds) {
      const dx = x - th.x, dz = z - th.z;
      const along = dx * th.dirX + dz * th.dirZ;
      const across = Math.abs(-dx * th.dirZ + dz * th.dirX);
      if (Math.abs(along) <= th.halfLen + 2.2 && across <= th.halfWidth + 0.8) return th;
    }
    return null;
  }

  function heightAt(x, z) {
    const g = terrainHeight(x, z);
    const th = inThresholdSpan(x, z);
    if (th && th.solidFactor >= .45) return Math.max(g, th.yTop);
    return g;
  }

  /* ---------- Scene & Lighting ---------- */
  const canvas = $("view");
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  const phone = matchMedia("(pointer:coarse)").matches || Math.min(innerWidth, innerHeight) < 560;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  scene.background = new T.Color(0x6c6c68);
  scene.fog = new T.FogExp2(0x74746e, .0030);

  const NEAR = 0.25, FAR = 520;
  const camera = new T.PerspectiveCamera(46, 1, NEAR, FAR);

  scene.add(new T.HemisphereLight(0xf6f4ee, 0x2a2a26, 0.92));
  const sun = new T.DirectionalLight(0xfff9ee, 2.35);
  sun.position.set(110, 145, -75);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.near = 10; sc.far = 420; sc.left = -140; sc.right = 140; sc.top = 140; sc.bottom = -140;
  sun.shadow.bias = -.0005;
  scene.add(sun);

  const skyMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1.,0.)),f.x), mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x), f.y); }
      void main(){
        float y = clamp(vDir.y, -0.2, 1.0);
        float c1 = n(vDir.xz / max(0.18, y + 0.35) * 3.0 + vec2(uTime * 0.008, 0.0));
        float c2 = n(vDir.xz / max(0.18, y + 0.35) * 7.2 - vec2(uTime * 0.012, 3.0));
        float cloud = smoothstep(0.45, 0.85, c1 * 0.65 + c2 * 0.35);
        float horizon = smoothstep(0.55, -0.02, y);
        vec3 base = mix(vec3(0.10, 0.11, 0.13), vec3(0.78, 0.77, 0.74), horizon);
        vec3 sunGlow = pow(max(0.0, dot(normalize(vDir), normalize(vec3(0.62, 0.55, -0.4)))), 16.0) * vec3(1.05, 0.98, 0.85);
        vec3 col = mix(base, vec3(0.95, 0.94, 0.90), cloud * (0.30 + 0.45 * (1.0 - horizon))) + sunGlow;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  scene.add(new T.Mesh(new T.SphereGeometry(420, 32, 20), skyMat));

  /* ---------- Terrain Mesh (210x210) ---------- */
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
    cols[i * 3] = alb;
    cols[i * 3 + 1] = alb;
    cols[i * 3 + 2] = alb;
  }
  tGeo.setAttribute("color", new T.BufferAttribute(cols, 3));
  tGeo.computeVertexNormals();
  const terrainMesh = new T.Mesh(tGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: .04 }));
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  /* ---------- Electric-Cyan Water Material + Cyan River Seam ---------- */
  const cyanWaterMat = new T.MeshStandardMaterial({
    color: 0x0088ff,
    emissive: 0x00a2ff,
    emissiveIntensity: 1.05,
    roughness: .16,
    metalness: .1
  });
  const waterGeo = new T.PlaneGeometry(22, 185, 12, 48);
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
  scene.add(new T.Mesh(waterGeo, cyanWaterMat));

  /* ---------- Film-Strip Texture (for Zone Monoliths & LookPass Mural) ---------- */
  const filmCanvas = document.createElement("canvas");
  filmCanvas.width = 256; filmCanvas.height = 512;
  const fctx = filmCanvas.getContext("2d");
  fctx.fillStyle = "#161513"; fctx.fillRect(0, 0, 256, 512);
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
  }
  const filmTex = new T.CanvasTexture(filmCanvas);
  filmTex.wrapS = T.RepeatWrapping; filmTex.wrapT = T.RepeatWrapping;

  /* ---------- Reusable 20L Electric-Cyan Jerikan Builder ---------- */
  const jerikanMat = new T.MeshStandardMaterial({
    color: 0x0082ee,
    emissive: 0x004699,
    emissiveIntensity: .42,
    roughness: .30,
    metalness: .08
  });
  const whiteCapMat = new T.MeshStandardMaterial({ color: 0xededeb, roughness: .5 });
  const jerBodyGeo = new T.BoxGeometry(.34, .44, .22);
  const jerHandleGeo = new T.BoxGeometry(.18, .05, .07);
  const jerCapGeo = new T.CylinderGeometry(.04, .04, .05, 10);
  function makeJerikan(scale = 1) {
    const g = new T.Group();
    const b = new T.Mesh(jerBodyGeo, jerikanMat); b.position.y = .22; b.castShadow = true; b.receiveShadow = true; g.add(b);
    const h = new T.Mesh(jerHandleGeo, jerikanMat); h.position.set(-.03, .46, 0); g.add(h);
    const c = new T.Mesh(jerCapGeo, whiteCapMat); c.position.set(.09, .46, 0); g.add(c);
    g.scale.setScalar(scale);
    return g;
  }

  /* ---------- Biome Props, Cairn Landmarks, Film Monoliths & Blue-Lit Ridge Door ---------- */
  const propGroup = new T.Group();
  scene.add(propGroup);
  const darkRockMat = new T.MeshStandardMaterial({ color: 0x262628, roughness: .94 });
  const midRockMat = new T.MeshStandardMaterial({ color: 0x6c6b64, roughness: .88 });
  const paleRockMat = new T.MeshStandardMaterial({ color: 0xe6e3da, roughness: .52 });
  const woodMat = new T.MeshStandardMaterial({ color: 0x4b4338, roughness: .9 });
  const treeMat = new T.MeshStandardMaterial({ color: 0x2b3028, roughness: .95 });
  const iceMat = new T.MeshPhysicalMaterial({ color: 0xf4f8fc, roughness: .18, metalness: .1, clearcoat: .9 });
  const solids = [];

  const rockGeo = new T.DodecahedronGeometry(1, 1);
  const coneGeo = new T.ConeGeometry(1.5, 6.5, 7);
  const trunkGeo = new T.CylinderGeometry(.18, .3, 2.2, 6);
  const filmGeo = new T.PlaneGeometry(2.8, 12.2, 1, 8);
  const filmStrips = [];

  for (const Z of ZONES) {
    const gy = terrainHeight(Z.x, Z.pz);
    const fmMat = new T.MeshStandardMaterial({
      map: filmTex, emissive: new T.Color(Z.refl * .36 + .14, Z.refl * .36 + .14, Z.refl * .38 + .15),
      roughness: .4, side: T.DoubleSide
    });
    const fm = new T.Mesh(filmGeo, fmMat);
    if (Z.z === 4) fm.position.set(16.0, gy + 5.8, -1.5);
    else fm.position.set(Z.x + 5.6, gy + 5.8, Z.pz - 5.6);
    fm.rotation.y = .45 + Z.z * .22;
    fm.castShadow = true;
    propGroup.add(fm);
    filmStrips.push({ mesh: fm, baseY: gy + 5.8, phase: Z.z * .7 });

    // Low survey cairn plinth beside trail + resting cyan jerikan
    const cairnBase = new T.Group();
    cairnBase.position.set(Z.x - 4.0, gy, Z.pz + 4.4);
    for (let s = 0; s < 3; s++) {
      const m = new T.Mesh(rockGeo, Z.z < 4 ? darkRockMat : Z.z < 8 ? midRockMat : paleRockMat);
      const sc = .54 - s * .12;
      m.scale.set(sc * 1.15, sc * .38, sc);
      m.position.y = .10 + s * .20;
      m.castShadow = true; m.receiveShadow = true;
      cairnBase.add(m);
    }
    if (Z.z % 2 === 0 && Z.z !== 4) {
      const jc = makeJerikan(1.0); jc.position.set(.75, 0, .2); jc.rotation.y = Z.z; cairnBase.add(jc);
    }
    propGroup.add(cairnBase);
    solids.push({ x: Z.x - 4.0, z: Z.pz + 4.4, r: .95 });

    const count = Z.z === 3 ? 14 : 8;
    for (let k = 0; k < count; k++) {
      const ang = (k / count) * Math.PI * 2 + hash2(Z.z, k) * .9;
      const rad = 8.5 + hash2(k, Z.z + 11) * 20;
      const px = Z.x + Math.cos(ang) * rad, pz = Z.pz + Math.sin(ang) * rad;
      if (inThresholdSpan(px, pz) || Math.hypot(px, pz) < 9.5) continue;
      const py = terrainHeight(px, pz);
      if (Z.z === 2 || Z.z === 3) {
        const s = .75 + hash2(k, 5) * 1.05;
        const tr = new T.Mesh(trunkGeo, woodMat);
        tr.position.set(px, py + 1.0 * s, pz); tr.scale.setScalar(s); tr.castShadow = true;
        const cn = new T.Mesh(coneGeo, treeMat);
        cn.position.set(px, py + 4.4 * s, pz); cn.scale.setScalar(s); cn.castShadow = true;
        propGroup.add(tr, cn);
        solids.push({ x: px, z: pz, r: .7 * s });
      } else if (Z.z === 1 || Z.z === 7 || Z.z === 9) {
        const colH = 3.2 + hash2(k, Z.z * 3) * 6.0;
        const col = new T.Mesh(new T.CylinderGeometry(.65, .95, colH, Z.z === 1 ? 6 : 8),
          Z.z === 1 ? darkRockMat : Z.z === 7 ? midRockMat : paleRockMat);
        col.position.set(px, py + colH * .44, pz);
        col.castShadow = true; col.receiveShadow = true;
        propGroup.add(col);
        solids.push({ x: px, z: pz, r: 1.0 });
      } else {
        const rs = .68 + hash2(k, Z.z * 7) * 1.7;
        const rk = new T.Mesh(rockGeo, Z.z < 3 ? darkRockMat : Z.z < 7 ? midRockMat : Z.z < 10 ? paleRockMat : iceMat);
        rk.scale.set(rs, rs * (.55 + hash2(k, 2) * .7), rs * .9);
        rk.position.set(px, py + rs * .14, pz);
        rk.rotation.set(hash2(k, 1), hash2(k, 3), 0);
        rk.castShadow = true; rk.receiveShadow = true;
        propGroup.add(rk);
        solids.push({ x: px, z: pz, r: rs * .72 });
      }
    }
  }

  /* ---------- Zone X Blue-Lit Sanctuary Door & Stone Steps ---------- */
  (() => {
    const Z = ZONES[10];
    const gy = terrainHeight(Z.x, Z.pz);
    const doorGrp = new T.Group();
    doorGrp.position.set(Z.x + 7.5, gy, Z.pz + 5.5);
    doorGrp.rotation.y = -Math.PI * .72;
    const stone = new T.MeshStandardMaterial({ color: 0x3b3b3c, roughness: .92 });
    // Stone steps climbing toward the door
    for (let i = 0; i < 8; i++) {
      const st = new T.Mesh(new T.BoxGeometry(3.4, .28, .75), stone);
      st.position.set(0, .14 + i * .26, 3.6 - i * .58);
      st.castShadow = true; st.receiveShadow = true;
      doorGrp.add(st);
    }
    // Rock-hewn portal frame
    const lintel = new T.Mesh(new T.BoxGeometry(4.2, .9, 1.4), stone); lintel.position.set(0, 5.4, -.5); doorGrp.add(lintel);
    for (const sx of [-1.7, 1.7]) {
      const col = new T.Mesh(new T.BoxGeometry(.85, 5.2, 1.3), stone); col.position.set(sx, 2.6, -.5); doorGrp.add(col);
    }
    // Luminous blue-lit sanctuary door
    const door = new T.Mesh(new T.BoxGeometry(2.5, 4.4, .28), new T.MeshStandardMaterial({
      color: 0x00aaff, emissive: 0x00a2ff, emissiveIntensity: 1.45, roughness: .2
    }));
    door.position.set(0, 2.5, -.5);
    doorGrp.add(door);
    const beacon = new T.PointLight(0x18b4ff, 4.5, 22);
    beacon.position.set(0, 2.8, .6);
    doorGrp.add(beacon);
    scene.add(doorGrp);
  })();

  /* ---------- Interactive Cast-Iron Wellhead Pump, Hose & Cyan Basin ---------- */
  const well = (() => {
    const wx = 1.4, wz = -1.2;
    const wy = terrainHeight(wx, wz);
    const g = new T.Group();
    g.position.set(wx, wy, wz);
    const concrete = new T.MeshStandardMaterial({ color: 0x5d5c57, roughness: .94 });
    const iron = new T.MeshStandardMaterial({ color: 0x262626, roughness: .48, metalness: .68 });
    const basinPlastic = new T.MeshStandardMaterial({ color: 0xbcb9b0, roughness: .65, side: T.DoubleSide });
    const pad = new T.Mesh(new T.BoxGeometry(1.1, .28, .9), concrete); pad.position.set(0, .14, 0); pad.castShadow = true; pad.receiveShadow = true; g.add(pad);
    const barrel = new T.Mesh(new T.CylinderGeometry(.13, .16, 1.05, 12), iron); barrel.position.set(0, .78, 0); barrel.castShadow = true; g.add(barrel);
    const cap = new T.Mesh(new T.CylinderGeometry(.17, .17, .12, 12), iron); cap.position.set(0, 1.30, 0); g.add(cap);
    const spout = new T.Mesh(new T.CylinderGeometry(.048, .048, .42, 10), iron);
    spout.rotation.z = Math.PI / 2.4; spout.position.set(.22, .68, 0); g.add(spout);

    // Animated cast-iron handle lever
    const leverPivot = new T.Group();
    leverPivot.position.set(0, 1.18, 0);
    const leverArm = new T.Mesh(new T.BoxGeometry(.85, .045, .05), iron);
    leverArm.position.set(-.36, .16, 0); leverArm.rotation.z = -.32;
    leverPivot.add(leverArm); g.add(leverPivot);

    // Snaking white rubber hose & cyan spout stream into round basin (as in DONKEY WATER SCIFI screenshots)
    const hosePts = [new T.Vector3(.38, .58, 0), new T.Vector3(.75, .20, .35), new T.Vector3(1.15, .08, .85), new T.Vector3(1.55, .14, 1.32), new T.Vector3(1.75, .36, 1.62)];
    const hoseCurve = new T.CatmullRomCurve3(hosePts);
    const hose = new T.Mesh(new T.TubeGeometry(hoseCurve, 20, .042, 8, false), new T.MeshStandardMaterial({ color: 0xe6e4dc, roughness: .62 }));
    hose.castShadow = true; g.add(hose);

    // Round washbasin + electric-cyan water pool
    const bx = 1.75, bz = 1.75;
    const basin = new T.Mesh(new T.CylinderGeometry(.68, .50, .36, 22, 1, true), basinPlastic);
    basin.position.set(bx, .18, bz); basin.castShadow = true; basin.receiveShadow = true; g.add(basin);
    const basinBottom = new T.Mesh(new T.CircleGeometry(.50, 20), basinPlastic);
    basinBottom.rotation.x = -Math.PI / 2; basinBottom.position.set(bx, .02, bz); g.add(basinBottom);
    const cyanPool = new T.Mesh(new T.CircleGeometry(.60, 22), cyanWaterMat);
    cyanPool.rotation.x = -Math.PI / 2; cyanPool.position.set(bx, .24, bz); g.add(cyanPool);

    // Vertical falling cyan water stream arcing out of hose/spout into the basin
    const stream = new T.Mesh(new T.CylinderGeometry(.032, .048, .55, 10), cyanWaterMat);
    stream.position.set(bx, .46, bz); g.add(stream);

    // 2 spare 20L cyan jerikans standing by the wellhead
    const j1 = makeJerikan(1.0); j1.position.set(-.95, 0, .4); j1.rotation.y = .4; g.add(j1);
    const j2 = makeJerikan(1.0); j2.position.set(-.88, 0, -.55); j2.rotation.y = -.5; g.add(j2);

    scene.add(g);
    solids.push({ x: wx, z: wz, r: .9 });
    return { x: wx, z: wz, leverPivot, stream, pool: cyanPool };
  })();

  /* ---------- Falling Electric-Cyan Raindrops ---------- */
  const rain = (() => {
    const N = 260;
    const positions = new Float32Array(N * 6);
    const seeds = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      seeds[i * 3] = (Math.random() - .5) * 44;
      seeds[i * 3 + 1] = Math.random() * 22;
      seeds[i * 3 + 2] = (Math.random() - .5) * 44;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(positions, 3));
    const mesh = new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0x18b4ff, transparent: true, opacity: .82 }));
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { N, positions, seeds, geo, mesh };
  })();

  /* ---------- Three Focus-Gated Threshold Crossings ---------- */
  function addThresholdBridge(id, name, cx, cz, dirX, dirZ, halfLen, halfWidth, yTop, tintHex) {
    const grp = new T.Group();
    grp.position.set(cx, yTop, cz);
    grp.rotation.y = Math.atan2(dirX, dirZ);
    const solidMat = new T.MeshStandardMaterial({ color: tintHex, roughness: .42, metalness: .15, transparent: true, opacity: .30 });
    const wireMat = new T.MeshBasicMaterial({ color: 0x18b4ff, wireframe: true, transparent: true, opacity: .78 });
    const slabs = 6;
    for (let i = 0; i < slabs; i++) {
      const zOff = lerp(-halfLen + 1.2, halfLen - 1.2, i / (slabs - 1));
      const g = new T.BoxGeometry(halfWidth * 1.9, .45, (halfLen * 2) / slabs - .35);
      const m = new T.Mesh(g, solidMat);
      m.position.set(0, -.22, zOff); m.castShadow = true; m.receiveShadow = true;
      const w = new T.Mesh(g, wireMat); w.position.copy(m.position);
      grp.add(m, w);
    }
    scene.add(grp);
    thresholds.push({ id, name, x: cx, z: cz, dirX, dirZ, halfLen, halfWidth, yTop, group: grp, solidMat, wireMat, solidFactor: 0 });
  }
  const lenRiver = Math.hypot(58 - 28, 42 - 20);
  addThresholdBridge("river_causeway", "Cyan River Causeway (Zone VI)", 58, 42, (58 - 28) / lenRiver, (42 - 20) / lenRiver, 11.5, 2.6, 2.6, 0x9b988e);
  addThresholdBridge("dune_arch", "Gypsum Chasm Span (Zone VIII)", 114, 86, .79, .61, 8.8, 2.6, 7.6, 0xd8d3c3);
  addThresholdBridge("ice_bridge", "Sanctuary Crevasse Bridge (Zone X)", 153, 118, .79, .61, 8.5, 2.6, 11.2, 0xf2f7fc);

  /* ---------- Drivable Highland Survey Cart / Woody Wagon (with 4 Cyan Jerikans + Boombox) ---------- */
  const wagon = (() => {
    const g = new T.Group();
    const wx = -3.8, wz = 4.0;
    const bodyDark = new T.MeshStandardMaterial({ color: 0x3b3c36, roughness: .46, metalness: .26 });
    const ashWood = new T.MeshStandardMaterial({ color: 0xa6987e, roughness: .70 });
    const chrome = new T.MeshStandardMaterial({ color: 0xe6e3d8, roughness: .22, metalness: .88 });
    const addBox = (mat, px, py, pz, sx, sy, sz) => {
      const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), mat);
      m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
    };
    addBox(bodyDark, 0, .72, 1.55, 1.72, .72, 1.35);
    addBox(ashWood, 0, 1.05, -.45, 1.82, 1.32, 2.75);
    addBox(bodyDark, 0, 1.74, -.45, 1.78, .10, 2.78);
    addBox(ashWood, 0, 1.88, -.45, 1.62, .12, 2.45);
    // Roof rack + 4 cyan jerikans lashed cleanly on roof-bed
    for (const s of [-.84, .84]) {
      addBox(chrome, s, 2.04, -.45, .06, .22, 2.35);
      for (const z of [-1.1, -.1]) {
        const j = makeJerikan(.92);
        j.position.set(s * .55, 1.94, z);
        g.add(j);
      }
    }
    const wheels = [];
    for (const s of [-.88, .88]) {
      for (const z of [-1.25, .95]) {
        const w = new T.Mesh(new T.CylinderGeometry(.38, .38, .28, 18), bodyDark);
        w.rotation.z = Math.PI / 2; w.position.set(s, .38, z); w.castShadow = true; g.add(w); wheels.push(w);
      }
    }
    addBox(chrome, .94, 1.15, -1.6, .06, 1.55, .42);
    // Warm amber headlights (subtle point illumination forward when driving)
    scene.add(g);
    const obj = {
      group: g, wheels, x: wx, z: wz, y: terrainHeight(wx, wz), heading: Math.atan2(58 - wx, 42 - wz), speed: 0,
      get deckY() { return this.y + 1.94; }
    };
    g.position.set(obj.x, obj.y, obj.z);
    g.rotation.y = obj.heading;
    return obj;
  })();

  /* ---------- Mistletoe (Shared Skinned Pack Donkey + Dual Cyan Jerikans) ---------- */
  const donkey = window.makeDonkey({
    assetPath: "../donkey/",
    shells: phone ? 6 : 11,
    contactShadow: true,
    alwaysHalter: true
  });
  scene.add(donkey.group);
  const cargoItems = [
    { name: "Cyan Jerikan L (20L)", kg: 12, slot: "L" },
    { name: "Cyan Jerikan R (20L)", kg: 12, slot: "R" },
    { name: "8x10 Tripod & Cassette", kg: 8, slot: "T" }
  ];
  donkey.setCargo(cargoItems);
  // Strap electric-cyan jerikans onto Mistletoe's saddle panniers so they catch selective cyan look
  for (const s of [1, -1]) {
    const j = makeJerikan(.72);
    j.position.set(s * .38, .72, .05);
    j.rotation.y = s * Math.PI * .5;
    donkey.pack.add(j);
  }
  donkey.place(2.2, -3.8, 1.1, heightAt);
  donkey.state.onStep = (leg, gait) => audio.step(leg, gait);

  const ropePts = new Float32Array(13 * 3);
  const ropeGeo = new T.BufferGeometry();
  ropeGeo.setAttribute("position", new T.BufferAttribute(ropePts, 3));
  const leadRope = new T.Line(ropeGeo, new T.LineBasicMaterial({ color: 0xcbb182, transparent: true, opacity: .85 }));
  leadRope.frustumCulled = false;
  scene.add(leadRope);

  /* ---------- Multi-Pass High-Definition GPU Shader Pipeline ---------- */
  const rtScene = new T.WebGLRenderTarget(64, 64, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true });
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
    uniforms: { tCur: { value: null }, tPrev: { value: null }, uDamp: { value: .32 } },
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
      uDofOctaves: { value: .84 },
      uTilt: { value: 0.0 },
      uStrataLock: { value: .24 },
      uFocusPulse: { value: 0.0 },
      uRouteMode: { value: initModeIdx },
      uSoloLook: { value: -1 },
      uFocusLook: { value: 13 },
      uFilter: { value: new T.Vector3(1.02, 1.02, 1.18) },
      uJerikanFilter: { value: 1.0 },
      uAudioBass: { value: 0.0 },
      uAudioHigh: { value: 0.0 }
    },
    vertexShader: VS,
    fragmentShader: `
      uniform sampler2D tScene, tDepth, tTrail, tFilm;
      uniform vec2 uRes;
      uniform float uT, uNear, uFar, uFocusDist, uDofOctaves, uTilt, uStrataLock, uFocusPulse, uJerikanFilter, uAudioBass, uAudioHigh;
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
        if (h(vec2(cx, 7.0)) < 0.80) return 0.0;
        float len = 0.04 + 0.16 * h(vec2(cx, 3.0)), m = 0.0;
        for (int k = 1; k <= 5; k++) {
          float lk = lum(texture2D(tScene, vec2(uv.x, min(1.0, uv.y + len * float(k) / 5.0))).rgb);
          m = max(m, step(0.58, lk));
        }
        return m;
      }

      vec3 evalLook(int mode, vec2 uv, vec3 raw, vec3 silverBase, vec3 tr, float l, float ed, float vg) {
        vec2 px = uv * uRes;
        vec3 col;
        if (mode == 0) {
          float spk = smoothstep(0.992, 1.0, h(floor(px / 2.2) + floor(uT * 6.0) * 3.1));
          vec3 em = mix(raw * 0.35, tr, 0.65) * smoothstep(0.14, 0.85, l);
          col = mix(silverBase * 0.42, em * vec3(1.12, 0.68, 0.34) + spk * vec3(1.0, 0.75, 0.4), 0.72);
        } else if (mode == 1) {
          float rows = 320.0;
          vec2 g = vec2(uv.x, (floor(uv.y * rows) + 0.5) / rows);
          float ls = lum(texture2D(tScene, clamp(g, 0.0, 1.0)).rgb);
          float line = 0.80 + 0.20 * sin(uv.y * rows * 6.2832);
          float sweep = smoothstep(0.05, 0.0, abs(fract(uv.y - uT * 0.11) - 0.5) - 0.45) * 0.12;
          col = mix(silverBase * 0.38, vec3(0.76, 0.92, 1.0) * (pow(ls * 1.25 + 0.04, 0.85) * line + sweep) * vg, 0.74);
        } else if (mode == 2) {
          float th = pow(clamp(l * 1.12, 0.0, 1.0), 0.82);
          vec3 hm = th < 0.28 ? mix(vec3(0.08, 0.02, 0.14), vec3(0.45, 0.05, 0.48), th / 0.28)
                  : th < 0.58 ? mix(vec3(0.45, 0.05, 0.48), vec3(0.92, 0.22, 0.08), (th - 0.28) / 0.30)
                  : mix(vec3(0.92, 0.22, 0.08), vec3(1.0, 0.84, 0.30), (th - 0.58) / 0.42);
          col = mix(hm, silverBase * 0.95, 0.32);
        } else if (mode == 3) {
          vec3 tissue = vec3(0.95, 0.84, 0.64) * (0.78 + 0.22 * vg);
          float cut = 1.0 - smoothstep(0.16, 0.38, l);
          vec3 sil = mix(tissue, vec3(0.11, 0.09, 0.10), cut);
          sil = mix(sil, vec3(0.78, 0.14, 0.09), smoothstep(0.76, 0.92, l) * 0.65);
          col = mix(sil, silverBase, 0.36);
        } else if (mode == 4) {
          float grain = n2(vec2(px.x / 120.0, px.y / 2.4)) * 0.6 + n2(vec2(px.x / 26.0, px.y / 1.4)) * 0.4;
          vec3 indigo = vec3(0.14, 0.21, 0.32), slate = vec3(0.38, 0.48, 0.54), cream = vec3(0.90, 0.86, 0.75), rust = vec3(0.68, 0.35, 0.18);
          float lq = l + (grain - 0.5) * 0.06;
          vec3 wb = lq < 0.16 ? indigo : lq < 0.38 ? slate : lq < 0.72 ? cream : rust;
          if (lq >= 0.16 && lq < 0.38) wb = mix(wb, indigo, step(0.62, fract((px.x + px.y) / 7.0)) * 0.36);
          wb = mix(wb, indigo * 0.65, smoothstep(0.05, 0.15, ed));
          col = mix(wb * (0.92 + 0.10 * grain), silverBase, 0.36) * (0.90 + 0.10 * vg);
        } else if (mode == 5) {
          return silverBase * (0.90 + 0.10 * vg);
        } else if (mode == 6) {
          vec2 gp = px / 5.2;
          float a = fract(gp.x + gp.y), b = fract(gp.x - gp.y);
          float ink = step(a, smoothstep(0.12, 0.80, 1.0 - l) * 0.82);
          ink = max(ink, step(b, smoothstep(0.45, 0.96, 1.0 - l) * 0.72));
          ink = max(ink, smoothstep(0.06, 0.18, ed));
          vec3 crd = mix(vec3(0.93, 0.90, 0.82) * (0.86 + 0.14 * vg), vec3(0.12, 0.11, 0.13), ink * 0.84);
          col = mix(crd, silverBase, 0.38);
        } else if (mode == 7) {
          float wn = n2(px / 95.0) * 0.6 + n2(px / 22.0) * 0.3 + h(floor(px / 2.0)) * 0.1;
          float ml = smoothstep(0.06, 0.85, lum(texture2D(tFilm, uv).rgb));
          vec3 wall = vec3(0.54, 0.51, 0.47) * (0.65 + 0.45 * wn) * (0.72 + 0.45 * ml);
          float dr = drip(uv);
          float edgeHalo = smoothstep(0.04, 0.14, ed);
          vec3 paste = mix(silverBase.rgb, vec3(0.96, 0.94, 0.89), edgeHalo);
          col = mix(mix(wall, paste, smoothstep(0.24, 0.62, l + edgeHalo * 0.45)), vec3(0.14, 0.12, 0.11), dr * 0.28);
          col = mix(col, silverBase, 0.32);
        } else if (mode == 8) {
          float tooth = n2(px / 2.4) * 0.6 + n2(px / 6.5) * 0.4;
          vec3 paper = vec3(0.96, 0.94, 0.89) * (0.94 + 0.08 * tooth);
          vec3 wash = mix(vec3(0.42, 0.58, 0.74), vec3(0.86, 0.70, 0.52), l);
          vec3 wc = mix(paper, paper * wash, (0.35 + 0.55 * (1.0 - l)) * (0.65 + 0.4 * tooth));
          wc = mix(wc, vec3(0.26, 0.28, 0.32), smoothstep(0.04, 0.10, ed) * 0.52);
          col = mix(wc, silverBase, 0.35);
        } else if (mode == 9) {
          float brush = n2(vec2(px.x / 3.0, px.y / 140.0)) * 0.5 + n2(px / 55.0) * 0.5;
          vec2 q = abs(uv - 0.5) * 2.0;
          float coat = smoothstep(0.99, 0.92, max(q.x, q.y) + (n2(px / 24.0) - 0.5) * 0.06);
          float d = smoothstep(0.10, 0.90, silverBase.r + 0.06 * n2(px / 40.0));
          vec3 cyano = mix(vec3(0.07, 0.24, 0.56) * (0.85 + 0.25 * brush), vec3(0.94, 0.97, 1.0), d);
          col = mix(vec3(0.95, 0.94, 0.90), cyano, coat);
        } else if (mode == 10) {
          float distContour = smoothstep(0.88, 0.98, sin(readDist(uv) * 1.4));
          vec3 xcol = vec3(0.82, 0.93, 1.0) * (smoothstep(0.02, 0.12, ed) * 1.25 + distContour * 0.22);
          col = mix(silverBase * 0.48, xcol + mix(raw, tr, 0.55) * 0.38, 0.68);
        } else if (mode == 11) {
          vec3 rs = vec3(0.96, 0.93, 0.85);
          float g1 = length(fract(px / 5.5) - 0.5) * 1.5;
          float g2 = length(fract((mat2(0.966, 0.259, -0.259, 0.966) * px) / 5.5) - 0.5) * 1.5;
          float g3 = length(fract((mat2(0.707, 0.707, -0.707, 0.707) * px) / 5.5) - 0.5) * 1.5;
          rs *= mix(vec3(1.0), vec3(1.0, 0.34, 0.60), step(g1, smoothstep(0.15, 0.75, 1.0 - l) * 0.82));
          rs *= mix(vec3(1.0), vec3(1.0, 0.86, 0.12), step(g2, smoothstep(0.25, 0.85, l) * 0.72));
          rs *= mix(vec3(1.0), vec3(0.14, 0.34, 0.78), step(g3, smoothstep(0.1, 0.55, 1.0 - l) * 0.78));
          rs *= mix(vec3(1.0), vec3(0.10, 0.09, 0.12), smoothstep(0.04, 0.15, ed) * 0.82);
          col = mix(rs, silverBase, 0.36);
        } else if (mode == 12) {
          float fib = n2(vec2(px.x / 85.0, px.y / 2.2)) * 0.5 + n2(vec2(px.x / 3.0, px.y / 68.0)) * 0.5;
          vec3 paper = vec3(0.95, 0.93, 0.87) * (0.94 + 0.08 * fib);
          float dark = 1.0 - l;
          float ink = smoothstep(0.22, 0.44, dark) * 0.25 + smoothstep(0.48, 0.72, dark) * 0.30 + smoothstep(0.76, 0.95, dark) * 0.32;
          vec3 iw = paper * (1.0 - ink * (0.9 + 0.1 * fib));
          vec2 sq = (uv - vec2(0.90, 0.14)) * vec2(uRes.x / uRes.y, 1.0);
          float seal = step(max(abs(sq.x), abs(sq.y)), 0.032) * step(0.28, n2(px / 3.0));
          col = mix(mix(iw, vec3(0.72, 0.10, 0.08), seal), silverBase, 0.36);
        } else {
          /* 13: CYAN JERIKAN (High-definition silver gelatin + cassette scan flutter) */
          float flutter = step(0.992, h(vec2(floor(uv.y * 190.0), floor(uT * 11.0)))) * uAudioHigh * 0.22;
          return silverBase * (0.92 + 0.08 * vg) + vec3(0.16, 0.72, 1.0) * flutter;
        }
        return col;
      }

      vec3 evalByFloat(float fz, vec2 uv, vec3 raw, vec3 silverBase, vec3 tr, float l, float ed, float vg) {
        float cf = clamp(fz, 0.0, 10.0);
        int i0 = int(floor(cf));
        int i1 = i0 < 10 ? i0 + 1 : 10;
        float t = fract(cf);
        vec3 a = evalLook(i0, uv, raw, silverBase, tr, l, ed, vg);
        vec3 b = (i1 == i0) ? a : evalLook(i1, uv, raw, silverBase, tr, l, ed, vg);
        return mix(a, b, smoothstep(0.15, 0.85, t));
      }

      void main() {
        vec2 uv = vUv;
        vec2 e = 1.0 / uRes;
        float dist = readDist(uv);
        float planeD = uFocusDist * exp((uv.y - 0.5) * uTilt * 2.0);
        float coc = (log2(clamp(dist, uNear, uFar)) - log2(max(planeD, 0.5))) / max(0.14, uDofOctaves);

        vec3 raw = texture2D(tScene, uv).rgb;
        float rawL = clamp(dot(raw, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
        float l = lum(raw);

        float rawX = dot(texture2D(tScene, uv + vec2(1.2, 0.0) * e).rgb, vec3(0.30, 0.59, 0.11))
                   - dot(texture2D(tScene, uv - vec2(1.2, 0.0) * e).rgb, vec3(0.30, 0.59, 0.11));
        float rawY = dot(texture2D(tScene, uv + vec2(0.0, 1.2) * e).rgb, vec3(0.30, 0.59, 0.11))
                   - dot(texture2D(tScene, uv - vec2(0.0, 1.2) * e).rgb, vec3(0.30, 0.59, 0.11));
        float ed = length(vec2(rawX, rawY)) * 2.5;
        float rawLap = rawL * 4.0
          - dot(texture2D(tScene, uv + vec2(1.3, 0.0) * e).rgb, vec3(0.30, 0.59, 0.11))
          - dot(texture2D(tScene, uv - vec2(1.3, 0.0) * e).rgb, vec3(0.30, 0.59, 0.11))
          - dot(texture2D(tScene, uv + vec2(0.0, 1.3) * e).rgb, vec3(0.30, 0.59, 0.11))
          - dot(texture2D(tScene, uv - vec2(0.0, 1.3) * e).rgb, vec3(0.30, 0.59, 0.11));

        float lifted = clamp(0.11 + 0.89 * pow(rawL, 0.84) + rawLap * 0.34, 0.0, 1.0);
        vec3 silverBase = vec3(lifted * 0.99, lifted * 0.985, lifted * 0.97);
        vec3 tr = texture2D(tTrail, uv).rgb;
        float vg = smoothstep(1.32, 0.32, length((uv - 0.5) * vec2(1.12, 1.0)) * 1.52);

        vec3 outCol;
        if (uSoloLook >= 0) {
          outCol = evalLook(uSoloLook, uv, raw, silverBase, tr, l, ed, vg);
        } else if (uRouteMode == 0) {
          /* MODE 0: DONKEY WATER (Crisp silver print + glowing cyan threshold focal slice) */
          vec3 jk = evalLook(13, uv, raw, silverBase, tr, l, ed, vg);
          vec3 fLook = evalLook(uFocusLook, uv, raw, silverBase, tr, l, ed, vg);
          float focalBand = 1.0 - smoothstep(0.45, 1.15, abs(coc));
          outCol = mix(jk, fLook, focalBand * 0.45);
          float cyanWave = smoothstep(0.16, 0.0, abs(abs(coc) - 0.86)) * (0.12 + 0.72 * uFocusPulse);
          outCol = mix(outCol, vec3(0.08, 0.74, 1.0), cyanWave * 0.65);
        } else if (uRouteMode == 1) {
          /* MODE 1: THRESHOLD (Hybrid Tonal + Depth Focus Pull) */
          float zBand = clamp(l * 10.0 + coc * 2.1, 0.0, 10.0);
          vec3 strataCol = evalByFloat(zBand, uv, raw, silverBase, tr, l, ed, vg);
          vec3 focalCol = evalLook(uFocusLook, uv, raw, silverBase, tr, l, ed, vg);
          float sharp = 1.0 - smoothstep(0.45, 1.15, abs(coc));
          outCol = mix(strataCol, focalCol, sharp * (1.0 - uStrataLock));
          float ring = smoothstep(0.14, 0.0, abs(abs(coc) - 0.90)) * uFocusPulse;
          outCol = mix(outCol, vec3(0.18, 0.78, 1.0), ring * 0.65);
        } else if (uRouteMode == 2) {
          /* MODE 2: DEPTH SHELLS (Spatial Microscope Slides) */
          float shellZ = clamp(5.0 + coc * 2.4, 0.0, 10.0);
          outCol = evalByFloat(shellZ, uv, raw, silverBase, tr, l, ed, vg);
          float bound = smoothstep(0.09, 0.0, abs(fract(shellZ + 0.5) - 0.5)) * (0.14 + 0.45 * uFocusPulse);
          outCol = mix(outCol, vec3(0.18, 0.78, 1.0), bound);
        } else {
          /* MODE 3: TONAL STRATA (Pure 11-Zone Luminance Stratification) */
          outCol = evalByFloat(l * 10.0, uv, raw, silverBase, tr, l, ed, vg);
        }

        /* Selective Blue Jerikan Channel Isolation (#47B): keep 3D light/shadow relief inside the electric cyan */
        if (uJerikanFilter > 0.5 || uRouteMode == 0 || uSoloLook == 13) {
          float cyanMask = smoothstep(0.05, 0.28, raw.b - max(raw.r, raw.g) * 1.04);
          float cyanShade = clamp(0.45 + 0.85 * raw.b - raw.r * 0.2, 0.38, 1.25);
          vec3 cyanGlow = mix(vec3(0.0, 0.44, 0.90), vec3(0.28, 0.90, 1.0), smoothstep(0.22, 0.92, raw.b)) * cyanShade * (0.94 + 0.25 * uAudioBass);
          outCol = mix(outCol, cyanGlow, cyanMask);
        }

        gl_FragColor = vec4(clamp(outCol, 0.0, 1.0), 1.0);
      }
    `
  });

  /* ---------- Interactive State & Initial Framing ---------- */
  const state = {
    x: -7.6, z: -4.6, y: 0,
    yaw: Math.atan2(-(1.4 - (-7.6)), -(-1.2 - (-4.6))), // aims right past Wellhead, Cyan Basin & Mistletoe + Wagon
    pitch: -0.07,
    cartYawOffset: 0, cartPitchOffset: 0,
    modeIdx: initModeIdx,
    stopIdx: 2,
    filterIdx: 5, // Blue Jerikan #47B default
    tilt: 0,
    focusDist: 14.0,
    soloLook: -1,
    focusLook: 13,
    drivingCart: false,
    riding: false,
    onWagon: false,
    leadMode: "lead",
    gaitIdx: 0,
    trayTab: null,
    groundGlass: false,
    ppcOn: true,
    focusPulse: 0,
    pumpFlow: 0.92,
    pumpLeverPhase: 0,
    meteredZone: 4,
    currentZone: 4,
    plates: []
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.plates)) state.plates = saved.plates;
  } catch {}
  state.y = heightAt(state.x, state.z) + 1.68;

  /* ---------- Step Wedge & UI Helpers ---------- */
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
        state.focusDist = d; state.focusLook = Z.look; state.focusPulse = 1.0;
        updateHUD();
        toast(`Focus racked to Zone ${ROMAN[Z.z]} · ${Z.name} (${d.toFixed(1)} m)`);
      }, 170);
    });
    btn.addEventListener("dblclick", () => { clearTimeout(clickTimer); teleportZone(Z.z); });
    wedgeEl.appendChild(btn);
  });

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3200);
  }

  function formatMMSS(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60), r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function updateFocusKnobVisual() {
    const minL = Math.log(1.2), maxL = Math.log(260);
    const k = clamp((Math.log(state.focusDist) - minL) / (maxL - minL), 0, 1);
    $("focus-knob").style.setProperty("--ang", lerp(-140, 140, k).toFixed(1) + "deg");
    $("focus-knob").setAttribute("aria-valuenow", state.focusDist.toFixed(1));
  }

  function updateHUD() {
    const m = MODES[state.modeIdx];
    const st = STOPS[state.stopIdx];
    const fl = FILTERS[state.filterIdx];
    const Z = ZONES[state.currentZone];
    const activeLook = state.soloLook >= 0 ? LOOKS[state.soloLook] : LOOKS[state.focusLook];
    $("zone-title").textContent = `Zone ${ROMAN[Z.z]} · ${Z.name}`;
    $("hud-sub").textContent = `${m.label} · ${state.drivingCart ? "CART " + Math.abs(wagon.speed).toFixed(1) + " m/s · " : ""}FOCUS ${state.focusDist.toFixed(1)} m · ${st.name} · ${fl.name}`;
    $("focus-dist-val").textContent = `${state.focusDist.toFixed(1)} m`;
    $("focus-look-val").textContent = state.soloLook >= 0 ? `SOLO · ${activeLook.name}` : `FOCUS · ${activeLook.name}`;
    $("wedge-caption").textContent = `Meter Zone ${ROMAN[state.meteredZone]} (${LOOKS[ZONES[state.meteredZone].look].name}) · ${m.desc}`;

    $("btn-cart").setAttribute("aria-pressed", String(state.drivingCart));
    $("btn-cart").textContent = state.drivingCart ? "Exit Cart (C)" : "Drive Cart (C)";
    $("btn-ride").setAttribute("aria-pressed", String(state.riding));
    $("btn-jerikan").setAttribute("aria-pressed", String(fl.jerikan === 1));
    $("btn-ppc").setAttribute("aria-pressed", String(state.ppcOn));
    $("ppc-hud").hidden = !state.ppcOn;

    const swans = wedgeEl.querySelectorAll(".swatch");
    const capSet = new Set(state.plates.map(p => p.zone));
    swans.forEach((b, idx) => {
      b.classList.toggle("active", idx === state.meteredZone);
      b.classList.toggle("captured", capSet.has(idx));
    });
    updateFocusKnobVisual();

    const u = lookMat.uniforms;
    u.uFocusDist.value = state.focusDist;
    u.uDofOctaves.value = st.oct;
    u.uTilt.value = state.tilt;
    u.uStrataLock.value = st.lock;
    u.uRouteMode.value = state.modeIdx;
    u.uSoloLook.value = state.soloLook;
    u.uFocusLook.value = state.focusLook;
    u.uFilter.value.set(fl.rgb[0], fl.rgb[1], fl.rgb[2]);
    u.uJerikanFilter.value = fl.jerikan;
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
      const targetName = state.soloLook >= 0 ? `SOLO FULL: ${LOOKS[state.soloLook].name}` : `AT FOCUS: ${LOOKS[state.focusLook].name}`;
      tray.innerHTML = `
        <div class="tray-head"><h2>Look Rack (14 Shaders)</h2><button type="button" class="chip" id="tr-close">Done</button></div>
        <p class="tray-note">${targetName}</p>
        <button type="button" class="chip wide" id="lk-all" aria-pressed="${state.soloLook < 0}">All Zone Modes Active (Disable Solo)</button>
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
        <div class="sec-label">Aperture Stop</div>
        <div class="chip-grid">${STOPS.map((s, i) => `<button type="button" class="chip" data-stop="${i}" aria-pressed="${state.stopIdx === i}">${s.name}</button>`).join("")}</div>
        <div class="sec-label">Scheimpflug Front Standard Tilt</div>
        <div class="chip-grid">
          <button type="button" class="chip" data-tilt="-0.32" aria-pressed="${state.tilt < -0.1}">Near-Far Tilt (−)</button>
          <button type="button" class="chip" data-tilt="0" aria-pressed="${Math.abs(state.tilt) < 0.05}">Level (0°)</button>
          <button type="button" class="chip" data-tilt="0.32" aria-pressed="${state.tilt > 0.1}">Reverse Tilt (+)</button>
        </div>
        <div class="sec-label">Optical Filter Glass (1–6)</div>
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
        <div class="tray-head"><h2>Cart, Well &amp; Mistletoe</h2><button type="button" class="chip" id="tr-close">Done</button></div>
        <p class="tray-note">${ds.thought} · Gait: ${["Walk", "Trot", "Canter", "Gallop"][state.gaitIdx]} · Load ${Math.round(ds.cargo.m)} kg.</p>
        <div class="chip-grid">
          <button type="button" class="chip" id="br-cart" aria-pressed="${state.drivingCart}">${state.drivingCart ? "Exit Cart (C)" : "Drive Cart (C)"}</button>
          <button type="button" class="chip" id="br-ride" aria-pressed="${state.riding}">${state.riding ? "Dismount (V)" : "Ride Mistletoe (V)"}</button>
          <button type="button" class="chip" id="br-deck" aria-pressed="${state.onWagon}">${state.onWagon ? "Step Off Deck (B)" : "Wagon Roof-Deck (B)"}</button>
          <button type="button" class="chip" id="br-pump">Pump Well (P)</button>
          <button type="button" class="chip" id="br-gait">Pace: ${["Walk", "Trot", "Canter", "Gallop"][state.gaitIdx]}</button>
          <button type="button" class="chip" id="br-teth" aria-pressed="${state.leadMode === "tethered"}">${state.leadMode === "tethered" ? "Lead Rope" : "Tether"}</button>
        </div>
        <div class="sec-label">Pack Donkey Mind</div>
        ${bar("Trust", m.trust)}
        ${bar("Calm", 1 - m.fear)}
        ${bar("Energy", ds.stamina)}
        ${bar("Watered & Fed", 1 - m.hunger)}
        <div class="chip-grid">
          <button type="button" class="chip" id="br-feed">Feed Oats</button>
          <button type="button" class="chip" id="br-soothe">Soothe</button>
          <button type="button" class="chip" id="br-bray">Bray</button>
        </div>`;
      $("br-cart").onclick = () => { toggleCart(); renderTray(); };
      $("br-ride").onclick = () => { toggleRide(); renderTray(); };
      $("br-deck").onclick = () => { toggleWagonDeck(); renderTray(); };
      $("br-pump").onclick = () => { pumpWell(); renderTray(); };
      $("br-gait").onclick = () => { state.gaitIdx = (state.gaitIdx + 1) % 4; renderTray(); };
      $("br-teth").onclick = () => { state.leadMode = state.leadMode === "tethered" ? "lead" : "tethered"; donkey.state.tethered = state.leadMode === "tethered"; renderTray(); };
      $("br-feed").onclick = () => { donkey.feed(); toast("Mistletoe munches oats gratefully."); renderTray(); };
      $("br-soothe").onclick = () => { donkey.soothe(); toast("A steady hand on Mistletoe’s shoulder."); renderTray(); };
      $("br-bray").onclick = () => { donkey.bray(); toast("Mistletoe brays toward the ridge."); };
    }
    const cls = $("tr-close");
    if (cls) cls.onclick = () => { state.trayTab = null; renderTray(); };
  }

  ["mode", "look", "lens", "burro"].forEach(k => {
    $("sp-" + k).addEventListener("click", () => { state.trayTab = state.trayTab === k ? null : k; renderTray(); });
  });
  $("sp-clocks").addEventListener("click", () => {
    const on = audio.toggle();
    $("sp-clocks").setAttribute("aria-pressed", String(on));
    toast(on ? "Three Clocks WebAudio engaged." : "Three Clocks sound muted.");
  });

  /* ---------- Cassette Deck Controls ---------- */
  const audioEl = $("jerikan-audio");
  function toggleTape() {
    audio.connectTape(audioEl);
    if (audioEl.paused) {
      audioEl.play().catch(() => {});
      $("tape-btn").setAttribute("aria-pressed", "true");
      $("tape-btn").textContent = "❚❚ Pause Tape";
      document.body.classList.add("tape-playing");
      toast("Ferric tape rolling: Cyan Jerikan Over Cosmic Addis.");
    } else {
      audioEl.pause();
      $("tape-btn").setAttribute("aria-pressed", "false");
      $("tape-btn").textContent = "▶ Play Tape";
      document.body.classList.remove("tape-playing");
    }
  }
  $("tape-btn").addEventListener("click", toggleTape);

  /* ---------- Actions: Pump Well, Drive Cart, Teleport, Ride, Wagon Deck, Expose ---------- */
  function pumpWell() {
    state.pumpFlow = 1.0;
    state.pumpLeverPhase = 0.01;
    audio.pumpClank();
    donkey.feed();
    donkey.soothe();
    toast("Iron lever cracks — cyan water surges through the hose into the basin!");
    if (state.trayTab === "burro") renderTray();
  }
  $("btn-pump").addEventListener("click", pumpWell);

  function toggleCart() {
    state.riding = false; state.onWagon = false;
    state.drivingCart = !state.drivingCart;
    if (state.drivingCart) {
      state.cartYawOffset = 0; state.cartPitchOffset = 0;
      toast("Driving Survey Cart — W/S throttle, A/D steer, Space brake, C exit.");
    } else {
      wagon.speed = 0;
      state.x = wagon.x + Math.cos(wagon.heading) * 2.4;
      state.z = wagon.z - Math.sin(wagon.heading) * 2.4;
      state.y = heightAt(state.x, state.z) + 1.68;
      toast("Parked and stepped out beside the Survey Cart.");
    }
    updateHUD();
  }
  $("btn-cart").addEventListener("click", toggleCart);

  function teleportZone(zoneIdx) {
    const Z = ZONES[clamp(zoneIdx, 0, 10)];
    state.riding = false; state.onWagon = false; state.drivingCart = false;
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
    if (state.onWagon || state.drivingCart) { state.onWagon = false; state.drivingCart = false; }
    if (!state.riding && Math.hypot(donkey.state.x - state.x, donkey.state.z - state.z) > 12) {
      donkey.place(state.x + 1.8, state.z + 1.8, state.yaw, heightAt);
    }
    state.riding = !state.riding;
    state.leadMode = "lead"; donkey.state.tethered = false;
    if (state.riding) state.yaw = donkey.state.heading + Math.PI;
    updateHUD();
    toast(state.riding ? "Mounted Mistletoe — WASD to ride, [ / ] to pull focus." : "Dismounted.");
  }
  $("btn-ride").addEventListener("click", toggleRide);

  function toggleWagonDeck() {
    state.riding = false; state.drivingCart = false; wagon.speed = 0;
    state.onWagon = !state.onWagon;
    if (state.onWagon) {
      state.x = wagon.x; state.z = wagon.z - .2;
      state.y = wagon.deckY + 1.66;
      state.yaw = Math.atan2(-(58 - wagon.x), -(42 - wagon.z));
      state.pitch = -0.06;
      toast("Atop Woody Survey Wagon roof-deck.");
    } else {
      state.x = wagon.x + 2.6; state.z = wagon.z + 1.4;
      state.y = heightAt(state.x, state.z) + 1.68;
      toast("Stepped down from roof-deck.");
    }
    updateHUD();
  }

  $("btn-jerikan").addEventListener("click", () => {
    state.filterIdx = state.filterIdx === 5 ? 0 : 5;
    updateHUD();
    if (state.trayTab === "lens") renderTray();
  });
  $("btn-ppc").addEventListener("click", () => {
    state.ppcOn = !state.ppcOn;
    updateHUD();
  });

  function renderFrame() {
    const w = renderer.domElement.width, h = renderer.domElement.height;
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);

    const lookInfo = LOOKS[state.soloLook >= 0 ? state.soloLook : state.focusLook];
    accMat.uniforms.tCur.value = rtScene.texture;
    accMat.uniforms.tPrev.value = rtA.texture;
    accMat.uniforms.uDamp.value = state.soloLook >= 0 ? lookInfo.trail : .30;
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
    const tmp = document.createElement("canvas");
    const cw = 640, ch = 512;
    tmp.width = cw; tmp.height = ch;
    const tx = tmp.getContext("2d");
    const sw = canvas.width, sh = canvas.height, aspect = 5 / 4;
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
      dataUrl: tmp.toDataURL("image/jpeg", .84)
    };
    state.plates.push(plate);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ plates: state.plates.slice(-22) })); } catch {}
    updateHUD();
    toast(`Exposed Plate #${plate.id} · Zone ${plate.roman} (${plate.look})`);
  }
  $("expose-btn").addEventListener("click", exposePlate);

  function openPlateBox() {
    const box = $("platebox"), grid = $("pl-grid"), big = $("pl-big"), note = $("pl-note");
    const got = new Set(state.plates.map(p => p.zone));
    note.textContent = `${state.plates.length} exposed plate(s) · ${got.size}/11 Tonal Zones captured.`;
    big.hidden = true;
    grid.innerHTML = state.plates.length ? state.plates.slice().reverse().map(p => `
      <button type="button" class="pl-card" data-pid="${p.id}">
        <img src="${p.dataUrl}" alt="Zone ${p.roman} plate">
        <small><strong>#${p.id} · Zone ${p.roman}</strong> (${p.place})<br>${p.mode} · ${p.look} · ${p.focus}</small>
      </button>`).join("") : `<p class="tray-note">No plates exposed yet. Press Space (on foot) or click Expose 8×10.</p>`;
    grid.querySelectorAll("[data-pid]").forEach(btn => {
      btn.onclick = () => { const p = state.plates.find(x => x.id === +btn.dataset.pid); if (p) { big.src = p.dataUrl; big.hidden = false; } };
    });
    box.hidden = false;
  }
  $("sp-plates").addEventListener("click", openPlateBox);
  $("pl-close").addEventListener("click", () => { $("platebox").hidden = true; });

  /* ---------- Input ---------- */
  const keys = Object.create(null);
  addEventListener("keydown", e => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    keys[e.code] = true;
    if (e.code === "BracketLeft") { state.focusDist = clamp(state.focusDist * .86, 1.2, 260); state.focusPulse = 1; updateHUD(); }
    else if (e.code === "BracketRight") { state.focusDist = clamp(state.focusDist * 1.16, 1.2, 260); state.focusPulse = 1; updateHUD(); }
    else if (e.code === "KeyC") toggleCart();
    else if (e.code === "KeyV") toggleRide();
    else if (e.code === "KeyB") toggleWagonDeck();
    else if (e.code === "KeyP") pumpWell();
    else if (e.code === "KeyH") { state.ppcOn = !state.ppcOn; updateHUD(); }
    else if (e.code === "KeyG") { state.groundGlass = !state.groundGlass; document.body.classList.toggle("ground-glass", state.groundGlass); }
    else if (e.code === "Space") {
      e.preventDefault();
      if (state.drivingCart) { wagon.speed *= .2; }
      else exposePlate();
    }
    else if (e.code === "KeyQ") { state.tilt = clamp(state.tilt - .16, -.35, .35); updateHUD(); }
    else if (e.code === "KeyE") { state.tilt = clamp(state.tilt + .16, -.35, .35); updateHUD(); }
    else if (e.code >= "Digit1" && e.code <= "Digit6") { state.filterIdx = +e.code.slice(5) - 1; updateHUD(); }
  });
  addEventListener("keyup", e => { keys[e.code] = false; });

  let dragLook = false, lastPX = 0, lastPY = 0;
  canvas.addEventListener("pointerdown", e => { dragLook = true; lastPX = e.clientX; lastPY = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", e => {
    if (!dragLook) return;
    const dx = e.clientX - lastPX, dy = e.clientY - lastPY;
    lastPX = e.clientX; lastPY = e.clientY;
    if (state.drivingCart) {
      state.cartYawOffset = clamp(state.cartYawOffset - dx * .0045, -1.6, 1.6);
      state.cartPitchOffset = clamp(state.cartPitchOffset - dy * .0035, -.45, .45);
    } else {
      state.yaw -= dx * .0045;
      state.pitch = clamp(state.pitch - dy * .0038, -.82, .82);
    }
  });
  addEventListener("pointerup", () => { dragLook = false; });

  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    state.focusDist = clamp(state.focusDist * (e.deltaY > 0 ? 1.09 : 0.917), 1.2, 260);
    state.focusPulse = 1.0; updateHUD();
  }, { passive: false });

  const knobEl = $("focus-knob");
  let dragKnob = false, knobX0 = 0, knobF0 = 14;
  knobEl.addEventListener("pointerdown", e => { dragKnob = true; knobX0 = e.clientX; knobF0 = state.focusDist; knobEl.setPointerCapture(e.pointerId); e.stopPropagation(); });
  knobEl.addEventListener("pointermove", e => {
    if (!dragKnob) return;
    state.focusDist = clamp(knobF0 * Math.exp((e.clientX - knobX0) * .014), 1.2, 260);
    state.focusPulse = 1.0; updateHUD();
  });
  addEventListener("pointerup", () => { dragKnob = false; });

  function resize() {
    const dpr = renderer.getPixelRatio();
    const w = Math.max(2, Math.floor(innerWidth * dpr));
    const h = Math.max(2, Math.floor(innerHeight * dpr));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / Math.max(1, innerHeight);
    camera.updateProjectionMatrix();
    rtScene.setSize(w, h); rtA.setSize(w, h); rtB.setSize(w, h);
  }
  addEventListener("resize", resize);
  resize();

  /* ---------- Raycast Meter & Simulation Loop ---------- */
  const raycaster = new T.Raycaster();
  const centerVec = new T.Vector2(0, 0);
  const donkeyHand = new T.Vector3(), halterOut = new T.Vector3(), saddlePos = new T.Vector3();

  function sampleMeter() {
    raycaster.setFromCamera(centerVec, camera);
    const hits = raycaster.intersectObject(terrainMesh, false);
    if (hits.length) {
      const p = hits[0].point;
      const alb = terrainAlbedo(p.x, p.z, p.y);
      const fl = FILTERS[state.filterIdx];
      const filtered = alb * (fl.rgb[0] * .3 + fl.rgb[1] * .59 + fl.rgb[2] * .11);
      state.meteredZone = clamp(Math.round(filtered * 10), 0, 10);
    } else state.meteredZone = 8;
    const proj = valleyProjection(state.x, state.z);
    state.currentZone = clamp(Math.round(proj.t * 10), 0, 10);
  }

  let lastT = performance.now(), meterClock = 0;
  function step(dt) {
    const fwdInput = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const sideInput = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const shiftPace = keys.ShiftLeft || keys.ShiftRight ? Math.max(1, state.gaitIdx) : state.gaitIdx;

    if (state.drivingCart) {
      // Easy, responsive cart driving physics
      const topFwd = (keys.ShiftLeft || keys.ShiftRight) ? 17.5 : 13.5;
      const targetSpd = fwdInput > 0 ? topFwd : fwdInput < 0 ? -5.8 : 0;
      const accelRate = fwdInput === 0 ? 3.6 : 4.2;
      wagon.speed = lerp(wagon.speed, targetSpd, 1 - Math.exp(-dt * accelRate));
      if (Math.abs(wagon.speed) < .04 && fwdInput === 0) wagon.speed = 0;

      const steerRate = 1.65 * (keys.ShiftLeft || keys.ShiftRight ? 1.1 : 1.0);
      const steerDir = wagon.speed < -0.5 ? 1 : -1;
      wagon.heading += sideInput * steerDir * steerRate * dt;

      let nx = wagon.x + Math.sin(wagon.heading) * wagon.speed * dt;
      let nz = wagon.z + Math.cos(wagon.heading) * wagon.speed * dt;
      nx = clamp(nx, -172, 200); nz = clamp(nz, -172, 200);

      // Gentle push/slide deflection off rocks & boulders instead of getting stuck
      for (const s of solids) {
        const dx = nx - s.x, dz = nz - s.z, minD = s.r + 1.35;
        const d = Math.hypot(dx, dz);
        if (d < minD && d > .001) { nx = s.x + (dx / d) * minD; nz = s.z + (dz / d) * minD; }
      }
      // Check un-focused deep chasms
      const ch = channelFactor(nx, nz), th = inThresholdSpan(nx, nz);
      if ((ch.river > .58 || ch.chasm > .58 || ch.crev > .58) && !(th && th.solidFactor >= .45)) {
        wagon.speed = 0;
      } else {
        wagon.x = nx; wagon.z = nz;
      }
      wagon.y = heightAt(wagon.x, wagon.z);
      wagon.group.position.set(wagon.x, wagon.y, wagon.z);
      wagon.group.rotation.y = wagon.heading;
      // Align gentle terrain pitch
      const hf = heightAt(wagon.x + Math.sin(wagon.heading) * 1.6, wagon.z + Math.cos(wagon.heading) * 1.6);
      const hb = heightAt(wagon.x - Math.sin(wagon.heading) * 1.6, wagon.z - Math.cos(wagon.heading) * 1.6);
      wagon.group.rotation.x = clamp((hb - hf) * .28, -.28, .28);
      for (const w of wagon.wheels) w.rotation.x += (wagon.speed * dt) / .38;

      if (!dragLook) state.cartYawOffset *= Math.exp(-dt * 2.4);

      const camAngle = wagon.heading + state.cartYawOffset;
      const camX = wagon.x - Math.sin(camAngle) * 7.8;
      const camZ = wagon.z - Math.cos(camAngle) * 7.8;
      const camY = Math.max(heightAt(camX, camZ) + 2.4, wagon.y + 3.65);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(
        wagon.x + Math.sin(camAngle) * 10.5,
        wagon.y + 1.45 + state.cartPitchOffset * 5.0,
        wagon.z + Math.cos(camAngle) * 10.5
      );
      camera.updateMatrixWorld();

      state.x = wagon.x; state.z = wagon.z; state.y = wagon.y + 1.8;

      // Mistletoe trots alongside the cart in lead mode
      const targetDX = wagon.x - Math.cos(wagon.heading) * 2.9 - Math.sin(wagon.heading) * 1.2;
      const targetDZ = wagon.z + Math.sin(wagon.heading) * 2.9 - Math.cos(wagon.heading) * 1.2;
      const mdx = targetDX - donkey.state.x, mdz = targetDZ - donkey.state.z;
      const md = Math.hypot(mdx, mdz);
      if (state.leadMode === "lead" && md > 1.8) {
        const want = Math.atan2(mdx, mdz);
        const df = Math.atan2(Math.sin(want - donkey.state.heading), Math.cos(want - donkey.state.heading));
        donkey.update(dt, { throttle: clamp(md * .45, 0, 1), steer: clamp(df * 1.6, -1, 1), pace: md > 6 ? 1 : 0, near: 1, drop: 0 }, heightAt);
      } else donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, heightAt);
    } else if (state.riding) {
      const prevH = donkey.state.heading;
      donkey.update(dt, { throttle: fwdInput, steer: -sideInput, pace: shiftPace, near: 0, drop: 0 }, heightAt);
      state.yaw += Math.atan2(Math.sin(donkey.state.heading - prevH), Math.cos(donkey.state.heading - prevH));
      donkey.saddleAt(saddlePos);
      state.x = donkey.state.x; state.z = donkey.state.z; state.y = saddlePos.y + .72;
      camera.position.set(state.x, state.y, state.z);
      camera.rotation.order = "YXZ"; camera.rotation.y = state.yaw; camera.rotation.x = state.pitch;
      camera.updateMatrixWorld();
    } else {
      if (state.onWagon && Math.abs(fwdInput) > 0) toggleWagonDeck();
      if (!state.onWagon) {
        const speed = keys.ShiftLeft || keys.ShiftRight ? 9.5 : 5.6;
        const sx = Math.sin(state.yaw), cz = Math.cos(state.yaw);
        let nx = clamp(state.x + (-sx * fwdInput + cz * sideInput) * speed * dt, -180, 210);
        let nz = clamp(state.z + (-cz * fwdInput - sx * sideInput) * speed * dt, -180, 210);
        let blocked = false;
        for (const s of solids) { if (Math.hypot(nx - s.x, nz - s.z) < s.r + .42) { blocked = true; break; } }
        if (Math.hypot(nx - wagon.x, nz - wagon.z) < 1.9) blocked = true;
        const ch = channelFactor(nx, nz), th = inThresholdSpan(nx, nz);
        if ((ch.river > .55 || ch.chasm > .55 || ch.crev > .55) && !(th && th.solidFactor >= .45)) blocked = true;
        if (!blocked) { state.x = nx; state.z = nz; }
        state.y = lerp(state.y, heightAt(state.x, state.z) + 1.68, clamp(dt * 12, 0, 1));
      }
      const dx = state.x - donkey.state.x, dz = state.z - donkey.state.z;
      const dist = Math.hypot(dx, dz);
      if (state.leadMode === "lead" && dist > 3.6) {
        const want = Math.atan2(dx, dz);
        const df = Math.atan2(Math.sin(want - donkey.state.heading), Math.cos(want - donkey.state.heading));
        donkey.update(dt, { throttle: clamp((dist - 3.0) * .5, 0, 1), steer: clamp(df * 1.4, -1, 1), pace: dist > 9 ? 1 : 0, near: 1, drop: 0 }, heightAt);
      } else donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: dist < 3.5 ? 1 : 0, drop: 0 }, heightAt);
      camera.position.set(state.x, state.y, state.z);
      camera.rotation.order = "YXZ"; camera.rotation.y = state.yaw; camera.rotation.x = state.pitch;
      camera.updateMatrixWorld();
    }

    // Update Threshold bridges (cart headlights solidify bridges within 18m automatically too)
    const stOct = STOPS[state.stopIdx].oct;
    for (const th of thresholds) {
      const distToBridge = Math.hypot(th.x - camera.position.x, th.z - camera.position.z);
      const logDiff = Math.abs(Math.log2(Math.max(1, distToBridge) / state.focusDist));
      const inCartBeam = state.drivingCart && Math.hypot(th.x - wagon.x, th.z - wagon.z) < 22;
      const targetSolid = (logDiff <= Math.max(0.45, stOct * 0.95) || inCartBeam) ? 1 : 0;
      th.solidFactor = lerp(th.solidFactor, targetSolid, 1 - Math.exp(-dt * 12));
      th.solidMat.opacity = lerp(0.24, 0.96, th.solidFactor);
      th.wireMat.opacity = lerp(0.82, 0.08, th.solidFactor);
    }

    // Wellhead pump animation & basin shimmer
    if (state.pumpFlow > .05) {
      state.pumpFlow = Math.max(.22, state.pumpFlow - dt * .04);
      state.pumpLeverPhase += dt * 4.5;
      well.leverPivot.rotation.z = Math.sin(state.pumpLeverPhase) * .35 * smooth(.22, .65, state.pumpFlow);
    }
    well.stream.visible = state.pumpFlow > .25;
    well.stream.scale.set(state.pumpFlow, 1, state.pumpFlow);
    well.pool.position.y = .21 + Math.sin(performance.now() * .004) * .012;

    // Falling Cyan Raindrops around active camera
    const rp = rain.positions, rs = rain.seeds;
    for (let i = 0; i < rain.N; i++) {
      rs[i * 3 + 1] -= dt * 11.5;
      if (rs[i * 3 + 1] < -2) rs[i * 3 + 1] += 22;
      const rx = camera.position.x + rs[i * 3], ry = camera.position.y + rs[i * 3 + 1] - 6, rz = camera.position.z + rs[i * 3 + 2];
      const base = i * 6;
      rp[base] = rx; rp[base + 1] = ry; rp[base + 2] = rz;
      rp[base + 3] = rx; rp[base + 4] = ry + .55; rp[base + 5] = rz;
    }
    rain.geo.attributes.position.needsUpdate = true;

    const nowSec = performance.now() * .001;
    for (const f of filmStrips) f.mesh.position.y = f.baseY + Math.sin(nowSec * .9 + f.phase) * .22;

    leadRope.visible = !state.riding && !state.onWagon && !state.drivingCart;
    if (leadRope.visible) {
      donkey.halterRing(halterOut);
      donkeyHand.set(state.x + Math.cos(state.yaw) * .35, state.y - .42, state.z - Math.sin(state.yaw) * .35);
      const posArr = ropeGeo.attributes.position.array, sag = clamp(halterOut.distanceTo(donkeyHand) * .14, .1, 1.1);
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        posArr[i * 3] = lerp(donkeyHand.x, halterOut.x, u);
        posArr[i * 3 + 1] = lerp(donkeyHand.y, halterOut.y, u) - Math.sin(u * Math.PI) * sag;
        posArr[i * 3 + 2] = lerp(donkeyHand.z, halterOut.z, u);
      }
      ropeGeo.attributes.position.needsUpdate = true;
    }

    // Audio Reactivity & Lyric Sync
    const sp = audio.sampleTape();
    lookMat.uniforms.uAudioBass.value = lerp(lookMat.uniforms.uAudioBass.value, sp.bass, clamp(dt * 10, 0, 1));
    lookMat.uniforms.uAudioHigh.value = lerp(lookMat.uniforms.uAudioHigh.value, sp.high, clamp(dt * 10, 0, 1));
    skyMat.uniforms.uTime.value = nowSec;
    lookMat.uniforms.uT.value = nowSec;
    state.focusPulse = Math.max(0, state.focusPulse - dt * 1.4);
    lookMat.uniforms.uFocusPulse.value = state.focusPulse;

    meterClock += dt;
    if (meterClock > .12) {
      meterClock = 0;
      sampleMeter();
      $("thought").textContent = donkey.state.thought || "Hooves on cobble and the tape is turning.";
      if (!audioEl.paused || audioEl.currentTime > 0) {
        const curT = audioEl.currentTime;
        const dur = Number.isFinite(audioEl.duration) ? audioEl.duration : 283;
        $("tape-time").textContent = `${formatMMSS(curT)} / ${formatMMSS(dur)}`;
        const mm = Math.floor(curT / 60), ss = Math.floor(curT % 60), ff = Math.floor((curT % 1) * 24);
        $("ppc-timecode").textContent = `01:${String(12 + mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
        let line = LYRICS[0][1];
        for (const [ts, txt] of LYRICS) if (curT >= ts) line = txt;
        $("lyric-line").textContent = line;
      } else {
        const total = Math.floor(nowSec);
        $("ppc-timecode").textContent = `01:14:${String(17 + (total % 42)).padStart(2, "0")}`;
      }
      updateHUD();
    }
    audio.tick(dt, state.meteredZone);
  }

  function loop(now) {
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    step(dt); renderFrame(); requestAnimationFrame(loop);
  }

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
      wagon: { x: wagon.x, z: wagon.z, speed: wagon.speed },
      drivingCart: state.drivingCart,
      riding: state.riding,
      onWagon: state.onWagon,
      pumpFlow: state.pumpFlow,
      plates: state.plates.length,
      audioReady: audioEl.readyState >= 1,
      audioDuration: Number.isFinite(audioEl.duration) ? audioEl.duration : null,
      thresholds: thresholds.map(t => ({ id: t.id, dist: Math.hypot(t.x - state.x, t.z - state.z), solid: +(t.solidFactor.toFixed(2)) }))
    }),
    setMode: id => { const i = MODES.findIndex(m => m.id === id); if (i >= 0) { state.modeIdx = i; state.focusPulse = 1; updateHUD(); if (state.trayTab) renderTray(); } },
    setFocus: m => { state.focusDist = clamp(m, 1.2, 260); state.focusPulse = 1; updateHUD(); },
    setStop: i => { state.stopIdx = clamp(i, 0, STOPS.length - 1); updateHUD(); if (state.trayTab) renderTray(); },
    setFilter: i => { state.filterIdx = clamp(i, 0, FILTERS.length - 1); updateHUD(); if (state.trayTab) renderTray(); },
    setSoloLook: id => { state.soloLook = id ? LOOKS.findIndex(l => l.id === id) : -1; updateHUD(); if (state.trayTab) renderTray(); },
    exposePlate, teleportZone, toggleRide, toggleWagonDeck, toggleCart, pumpWell, toggleTape
  };
})();
