/* THRESHOLD · Donkey Water Sci-Fi & Eleven Tonal Worlds
 * Features:
 *  - Authentic 1940s Woody Station Wagon ported from field-plates/game.js (drivable + roof-deck + 4 roof cyan jerrycans + WiFi mast)
 *  - Shared procedural burro Mistletoe carrying sculpted 20L electric-cyan jerrycans + swaying WiFi transceiver antenna
 *  - Live concentric terrain-hugging WiFi Water broadcast rings & pulsing 3D wave arcs
 *  - 5 Cistern Relays + Kiosk Awning + 9-building Highland Pueblo on the Zone IX-X ridge (windows light up electric cyan!)
 *  - 14 High-definition Zone/JellyOrchestra GPU shaders + selective Blue Jerikan #47B isolation
 *  - Cyan Jerikan Over Cosmic Addis soundtrack, REC PPC camcorder HUD & WiFi Coverage 8x10 Plate Box. */
(function () {
  "use strict";
  const T = window.THREE;
  const TAU = Math.PI * 2;
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
    { id: "jerikan", name: "CYAN JERIKAN", zone: -1, trail: .32, desc: "Silver-gelatin stone & burro with selective electric-cyan WiFi water & jerrycans." }
  ];

  const ZONES = [
    { z: 0, look: 0, refl: .05, name: "Lava Tube Cavern", swatch: "#080809", x: -126, pz: -102, desc: "Obsidian archway with glowing cyan-ember crystals." },
    { z: 1, look: 1, refl: .11, name: "Basalt Night Mesa", swatch: "#15161a", x: -96, pz: -72, desc: "Hexagonal basalt columns scanned across high-res phosphor." },
    { z: 2, look: 2, refl: .18, name: "Sequoia Thermal Slot", swatch: "#262328", x: -64, pz: -46, desc: "Dark redwood trunks in a shaded geothermal cleft." },
    { z: 3, look: 3, refl: .27, name: "Merced Pine Timber", swatch: "#393734", x: -30, pz: -22, desc: "Sierra conifers backing crisp paper silhouettes." },
    { z: 4, look: 13, refl: .38, name: "Wellhead & Terrace", swatch: "#54524a", x: 0, pz: 0, desc: "Cast-iron hand pump, cyan basin, Woody Wagon & Mistletoe." },
    { z: 5, look: 5, refl: .50, name: "Tuolumne Meadow", swatch: "#76746b", x: 28, pz: 20, desc: "Meadow Relay Basin & middle-gray silver-gelatin trail." },
    { z: 6, look: 6, refl: .64, name: "Cyan River Ford", swatch: "#96948a", x: 58, pz: 42, desc: "Focus-solidified stone causeway & River Ford WiFi Relay." },
    { z: 7, look: 7, refl: .74, name: "Kiosk Ridge Wall", swatch: "#b5b2a6", x: 88, pz: 64, desc: "Cassette Kiosk Awning Relay & mural cliff." },
    { z: 8, look: 8, refl: .83, name: "Gypsum Dune Wash", swatch: "#cfcbb9", x: 114, pz: 86, desc: "Wind-sculpted white dunes & focus-locked chasm arch." },
    { z: 9, look: 9, refl: .90, name: "Cosmic Addis Flats", swatch: "#e4e3d8", x: 140, pz: 108, desc: "Lower Pueblo edge exposed as Prussian blue cyanotype." },
    { z: 10, look: 10, refl: .96, name: "Highland Pueblo Ridge", swatch: "#f6f4ec", x: 160, pz: 123, desc: "Terraced adobe Pueblo Plaza cistern & blue-lit sanctuary steps." }
  ];

  const MODES = [
    { id: "jerikan", label: "DONKEY WATER", sub: "Cyan Jerikan Sci-Fi", desc: "High-definition silver-gelatin world with electric-cyan WiFi water, jerrycans & pueblo coverage; focus sweeps a cyan threshold wave." },
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
    [220, "“Cosmic Addis Arkestra — carry WiFi water up to the Highland Pueblo.”"]
  ];

  const STORAGE_KEY = "make-photo-zones-v3";
  const urlMode = new URLSearchParams(location.search).get("mode");
  const initModeIdx = urlMode && MODES.some(m => m.id === urlMode) ? MODES.findIndex(m => m.id === urlMode) : 0;

  /* ---------- WebAudio: Three Clocks + Iron Pump + WiFi Relay Chime + Tape Analyser ---------- */
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
    function relayChime(isPueblo) {
      const notes = isPueblo ? [293.66, 392, 440, 587.33, 783.99] : [293.66, 440, 587.33];
      notes.forEach((f, idx) => setTimeout(() => tone(f, .42, .12, "triangle", (idx - 1) * .25, true), idx * 95));
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
      connectTape, sampleTape, tick, shutter, pumpClank, relayChime, step
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
    const gx = (x - 150) * .75 - (z - 115) * .66;
    const crevMask = smooth(6.2, 2.5, Math.abs(gx)) * smooth(24, 6, Math.hypot(x - 150, z - 115));
    return { river: waterMask, chasm: chasmMask, crev: crevMask };
  }

  function terrainHeight(x, z) {
    const proj = valleyProjection(x, z);
    const zCoord = proj.t * 10;
    const ridgeWall = smooth(16, 68, proj.dist);
    const coarse = (fbm(x * .014 + 3.1, z * .014 + 1.7, 4) - .46) * (6.0 + ridgeWall * 25.0);
    const detail = (fbm(x * .06, z * .06, 2) - .5) * 1.15;
    const macro = lerp(-3.0, 12.2, smooth(0, 10, zCoord)) + ridgeWall * (7.5 + 1.0 * zCoord);
    let h = macro + coarse * (.30 + .70 * ridgeWall) + detail;
    for (const Z of ZONES) {
      const k = smooth(14, 3.5, Math.hypot(x - Z.x, z - Z.pz));
      h = lerp(h, macro + (fbm(Z.x * .014 + 3.1, Z.pz * .014 + 1.7, 4) - .46) * 1.8, k * .82);
    }
    const ch = channelFactor(x, z);
    h -= ch.river * 2.7;
    h -= ch.chasm * 5.0;
    h -= ch.crev * 5.2;
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
    return clamp(base + strat + ridgeline - ch.river * .12 - ch.chasm * .30 - ch.crev * .18, .05, .97);
  }

  /* ---------- Threshold Crossings (Widened for Woody Wagon + Mistletoe WiFi Solidification) ---------- */
  const thresholds = [];
  function inThresholdSpan(x, z) {
    for (const th of thresholds) {
      const dx = x - th.x, dz = z - th.z;
      const along = dx * th.dirX + dz * th.dirZ;
      const across = Math.abs(-dx * th.dirZ + dz * th.dirX);
      if (Math.abs(along) <= th.halfLen + 2.4 && across <= th.halfWidth + 1.0) return th;
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
  scene.fog = new T.FogExp2(0x74746e, .0028);

  const NEAR = 0.25, FAR = 520;
  const camera = new T.PerspectiveCamera(46, 1, NEAR, FAR);

  scene.add(new T.HemisphereLight(0xf6f4ee, 0x2e2e2a, 0.96));
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

  /* ---------- Terrain Mesh ---------- */
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
    cols[i * 3] = alb; cols[i * 3 + 1] = alb; cols[i * 3 + 2] = alb;
  }
  tGeo.setAttribute("color", new T.BufferAttribute(cols, 3));
  tGeo.computeVertexNormals();
  const terrainMesh = new T.Mesh(tGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: .04 }));
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  /* ---------- Electric-Cyan Water Material + Cyan River Seam ---------- */
  const cyanWaterMat = new T.MeshStandardMaterial({
    color: 0x008cff,
    emissive: 0x00a6ff,
    emissiveIntensity: 1.0,
    roughness: .16,
    metalness: .1
  });
  const waterGeo = new T.PlaneGeometry(22, 185, 12, 48);
  waterGeo.rotateX(-Math.PI / 2);
  const wPos = waterGeo.attributes.position;
  for (let i = 0; i < wPos.count; i++) {
    const lx = wPos.getX(i), lz = wPos.getZ(i), ang = .68;
    const wx = 58 + lx * Math.cos(ang) - lz * Math.sin(ang);
    const wz = 42 + lx * Math.sin(ang) + lz * Math.cos(ang);
    wPos.setXYZ(i, wx, 0.35 + Math.sin(lz * .08) * .05, wz);
  }
  waterGeo.computeVertexNormals();
  scene.add(new T.Mesh(waterGeo, cyanWaterMat));

  /* ---------- Film-Strip Texture (Zone Monoliths & Spray Mural) ---------- */
  const filmCanvas = document.createElement("canvas");
  filmCanvas.width = 256; filmCanvas.height = 512;
  const fctx = filmCanvas.getContext("2d");
  fctx.fillStyle = "#161513"; fctx.fillRect(0, 0, 256, 512);
  for (let row = 0; row < 16; row++) {
    const y = row * 32 + 6;
    fctx.fillStyle = "#efe9d8";
    fctx.fillRect(10, y, 16, 18); fctx.fillRect(230, y, 16, 18);
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

  /* ---------- Sculpted 20L Electric-Cyan Jerrycan Builder ---------- */
  const jerikanMat = new T.MeshStandardMaterial({
    color: 0x009aff,
    emissive: 0x004ca8,
    emissiveIntensity: .54,
    roughness: .28,
    metalness: .06
  });
  const jerikanRibMat = new T.MeshStandardMaterial({
    color: 0x0072d6,
    emissive: 0x003a88,
    emissiveIntensity: .46,
    roughness: .34
  });
  const whiteCapMat = new T.MeshStandardMaterial({ color: 0xf4f4f0, roughness: .42 });
  const strapMat = new T.MeshStandardMaterial({ color: 0x1e1b17, roughness: .7 });
  const antennaMat = new T.MeshStandardMaterial({ color: 0xe6e3d8, roughness: .25, metalness: .85 });
  const beaconCyanMat = new T.MeshStandardMaterial({ color: 0x36d8ff, emissive: 0x00c8ff, emissiveIntensity: 1.5, roughness: .15 });

  // Chamfered 20L Jerrycan profile (rounded rectangle body + recessed X-ribs + twin handles + pour cap)
  const jerBodyGeo = (() => {
    const s = new T.Shape();
    const a = .115, b = .175, r = .032;
    s.moveTo(-a, -b - r); s.lineTo(a, -b - r); s.quadraticCurveTo(a + r, -b - r, a + r, -b);
    s.lineTo(a + r, b); s.quadraticCurveTo(a + r, b + r, a, b + r); s.lineTo(-a, b + r);
    s.quadraticCurveTo(-a - r, b + r, -a - r, b); s.lineTo(-a - r, -b); s.quadraticCurveTo(-a - r, -b - r, -a, -b - r);
    const g = new T.ExtrudeGeometry(s, { depth: .21, bevelEnabled: true, bevelThickness: .022, bevelSize: .018, bevelSegments: 2 });
    g.translate(0, 0, -.105);
    return g;
  })();
  const jerRibGeo = new T.BoxGeometry(.24, .026, .275);
  const jerHandleGeo = new T.BoxGeometry(.16, .048, .056);
  const jerSpoutGeo = new T.CylinderGeometry(.032, .042, .065, 12);
  const jerCapGeo = new T.CylinderGeometry(.038, .038, .036, 12);

  function makeJerikan(scale = 1) {
    const g = new T.Group();
    const b = new T.Mesh(jerBodyGeo, jerikanMat); b.position.y = .21; b.castShadow = true; b.receiveShadow = true; g.add(b);
    // Embossed stiffening ribs on front/back faces
    for (const sgn of [-1, 1]) {
      for (const ang of [.48, -.48]) {
        const rb = new T.Mesh(jerRibGeo, jerikanRibMat);
        rb.position.set(0, .20, sgn * .118); rb.rotation.z = ang; g.add(rb);
      }
    }
    const h = new T.Mesh(jerHandleGeo, jerikanMat); h.position.set(-.035, .435, 0); h.castShadow = true; g.add(h);
    const sp = new T.Mesh(jerSpoutGeo, jerikanMat); sp.position.set(.085, .43, 0); sp.rotation.z = -.25; g.add(sp);
    const cp = new T.Mesh(jerCapGeo, whiteCapMat); cp.position.set(.098, .465, 0); cp.rotation.z = -.25; g.add(cp);
    g.scale.setScalar(scale);
    return g;
  }

  /* ---------- Ported 1940s Woody Station Wagon Builder (from field-plates/game.js) ---------- */
  function buildWagon() {
    const woodBox = new T.BoxGeometry(1, 1, 1), ball = new T.SphereGeometry(1, 18, 12);
    const coach = new T.MeshStandardMaterial({ color: 0x8e9597, roughness: .42, metalness: .18 });
    const ash = new T.MeshStandardMaterial({ color: 0xc2a67a, roughness: .72 });
    const walnut = new T.MeshStandardMaterial({ color: 0x5c3822, roughness: .78 });
    const deckWood = new T.MeshStandardMaterial({ color: 0x9b805c, roughness: .82 });
    const charcoal = new T.MeshStandardMaterial({ color: 0x262825, roughness: .82 });
    const nickel = new T.MeshStandardMaterial({ color: 0xe6e4dc, roughness: .22, metalness: .86 });
    const rubber = new T.MeshStandardMaterial({ color: 0x1c1c1a, roughness: .92 });
    const sidewall = new T.MeshStandardMaterial({ color: 0x33322d, roughness: .88 });
    const safetyGlass = new T.MeshStandardMaterial({ color: 0x2c3b46, roughness: .14, metalness: .35, transparent: true, opacity: .66 });
    const amber = new T.MeshStandardMaterial({ color: 0xe8bc64, emissive: 0x5a4218, emissiveIntensity: .6, roughness: .2 });
    const redLens = new T.MeshStandardMaterial({ color: 0xc93828, emissive: 0x501008, emissiveIntensity: .5, roughness: .25 });
    const darkTailgate = new T.MeshStandardMaterial({ color: 0x4c3220, roughness: .78 });

    const meshAt = (g, m, grp, x = 0, y = 0, z = 0) => {
      const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; grp.add(o); return o;
    };
    const billet = (grp, m, x, y, z, w, h, l) => { const o = meshAt(woodBox, m, grp, x, y, z); o.scale.set(w, h, l); return o; };
    const oval = (grp, m, x, y, z, w, h, l) => { const o = meshAt(ball, m, grp, x, y, z); o.scale.set(w, h, l); return o; };
    const spar = (grp, m, a, b, r1, r2 = r1, sides = 8) => {
      const p = new T.Vector3(...a), q = new T.Vector3(...b), off = q.clone().sub(p);
      const t = meshAt(new T.CylinderGeometry(r2, r1, off.length(), sides, 1), m, grp);
      t.position.copy(p).lerp(q, .5); t.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), off.normalize());
      return t;
    };
    const pipe = (grp, m, pts, rad, seg = 20) => meshAt(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), seg, rad, 7, false), m, grp);
    const loft = (grp, m, profs, sides = 28, segs = 22, flat = 1) => {
      const spine = new T.CatmullRomCurve3(profs.map(([z, y, xr, yr]) => new T.Vector3(xr, yr, z)));
      const levels = new T.CatmullRomCurve3(profs.map(([z, y]) => new T.Vector3(0, y, z)));
      const p = [], uv = [], tri = [];
      for (let j = 0; j <= segs; j++) {
        const t = j / segs, pt = spine.getPoint(t), y = levels.getPoint(t).y;
        for (let i = 0; i <= sides; i++) {
          const th = (i / sides) * TAU, cnt = v => Math.sign(v) * (Math.abs(v) ** flat);
          p.push(cnt(Math.cos(th)) * Math.max(.001, pt.x), y + cnt(Math.sin(th)) * Math.max(.001, pt.y), pt.z);
          uv.push(i / sides, t);
          if (j < segs && i < sides) {
            const a = j * (sides + 1) + i;
            if (profs[0][0] < profs[profs.length - 1][0]) tri.push(a, a + 1, a + sides + 1, a + 1, a + sides + 2, a + sides + 1);
            else tri.push(a, a + sides + 1, a + 1, a + 1, a + sides + 1, a + sides + 2);
          }
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(p, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setIndex(tri); g.computeVertexNormals();
      return meshAt(g, m, grp);
    };
    const roundedCase = (grp, m, x, y, z, w, h, l, r = .06) => {
      const sh = new T.Shape(), a = w * .5 - r, b = h * .5 - r;
      sh.moveTo(-a, -b - r); sh.lineTo(a, -b - r); sh.quadraticCurveTo(a + r, -b - r, a + r, -b);
      sh.lineTo(a + r, b); sh.quadraticCurveTo(a + r, b + r, a, b + r); sh.lineTo(-a, b + r);
      sh.quadraticCurveTo(-a - r, b + r, -a - r, b); sh.lineTo(-a - r, -b); sh.quadraticCurveTo(-a - r, -b - r, -a, -b - r);
      const gm = new T.ExtrudeGeometry(sh, { depth: l, bevelEnabled: false, curveSegments: 4 }); gm.translate(0, 0, -l * .5);
      return meshAt(gm, m, grp, x, y, z);
    };
    const panelSide = (grp, m, side, pts, thk) => {
      const sh = new T.Shape();
      pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); sh.closePath();
      const g = new T.ExtrudeGeometry(sh, { depth: thk, bevelEnabled: false, curveSegments: 4 });
      g.rotateY(-Math.PI * .5); g.translate(thk * .5, 0, 0);
      return meshAt(g, m, grp, side, 0, 0);
    };
    const makeWheel = (grp, x, y, z, front) => {
      const mount = new T.Group(); mount.position.set(x, y, z); grp.add(mount);
      const spin = new T.Group(); mount.add(spin);
      const tire = meshAt(new T.TorusGeometry(.30, .091, 12, 30), rubber, spin); tire.rotation.y = Math.PI * .5; tire.scale.z = 1.22;
      const dir = Math.sign(x);
      for (const off of [-.047, .047]) {
        const bead = meshAt(new T.TorusGeometry(.303, .051, 10, 28), sidewall, spin, off, 0, 0); bead.rotation.y = Math.PI * .5;
      }
      meshAt(new T.CylinderGeometry(.218, .218, .145, 24), charcoal, spin).rotation.z = Math.PI * .5;
      oval(spin, nickel, dir * .097, 0, 0, .038, .145, .145);
      oval(spin, coach, dir * .124, 0, 0, .019, .084, .084);
      const ring = meshAt(new T.TorusGeometry(.183, .011, 6, 24), nickel, spin, dir * .077, 0, 0); ring.rotation.y = Math.PI * .5;
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * TAU;
        billet(spin, rubber, 0, .387 * Math.cos(ang), .387 * Math.sin(ang), .176, .014, .022).rotation.x = ang;
      }
      return { mount, spin, front };
    };

    const root = new T.Group();
    const inner = new T.Group();
    inner.rotation.y = Math.PI; // flip so +Z local is forward matching wagon.heading
    root.add(inner);
    const body = new T.Group();
    inner.add(body);

    loft(body, coach, [[-2.61, .72, .08, .07], [-2.5, .77, .72, .24], [-2.1, .83, .93, .38], [-1.47, .87, .98, .43],
      [-.9, .88, .99, .45], [.1, .89, .97, .43], [1.1, .88, .96, .40], [1.99, .81, .94, .36], [2.44, .78, .75, .30], [2.59, .76, .016, .029]], 34, 30, .55);
    loft(body, coach, [[-2.6, .91, .045, .026], [-2.46, 1.04, .43, .22], [-2.14, 1.14, .58, .215], [-1.65, 1.22, .62, .214],
      [-1.15, 1.25, .68, .23], [-.79, 1.24, .69, .21]], 28, 22, .68);
    loft(body, charcoal, [[-1.26, 1.35, .72, .048], [-1.04, 1.65, .76, .17], [-.77, 1.75, .83, .32], [-.38, 1.78, .85, .34], [.52, 1.80, .86, .34],
      [1.43, 1.77, .85, .32], [2.04, 1.73, .78, .27], [2.33, 1.59, .70, .15], [2.48, 1.29, .67, .044]], 28, 28, .63);

    for (const sgn of [-1, 1]) {
      const x = sgn * .90;
      panelSide(body, walnut, x + sgn * .031, [[-1.03, .59], [-1.18, 1.28], [-.66, 1.41], [1.97, 1.41], [2.35, 1.10], [2.36, .66]], .037);
      for (const y of [.70, .91, 1.13, 1.365]) billet(body, ash, x + sgn * .018, y, .51, .068, .052, 3.28).rotation.x = -.016;
      const win = [[-1.03, 1.38], [-.64, 1.91], [1.87, 1.90], [2.15, 1.75], [2.35, 1.41]];
      panelSide(body, safetyGlass, x - sgn * .072, win, .035);
      pipe(body, ash, win.concat([win[0]]).map(([z, y]) => [x - sgn * .051, y, z]), .030, 20);
      for (const z of [-.96, .02, 1.08, 2.14]) {
        const y = z === -.96 ? 1.43 : 1.57;
        billet(body, ash, x + sgn * .010, y, z, .070, z === -.96 ? .80 : 1.16, .050).rotation.x = z === -.96 ? -.25 : z === 2.14 ? .30 : .007;
      }
      for (const z of [-.52, .52]) billet(body, nickel, x + sgn * .089, 1.23, z, .034, .038, .165).rotation.x = -.075;
      loft(body, coach, [[-2.58, .68, .019, .035], [-2.40, .75, .211, .224], [-2.06, .78, .276, .32], [-1.66, .77, .285, .30],
        [-1.27, .72, .237, .24], [-.94, .63, .14, .18], [-.57, .57, .03, .054]], 20, 18, .83).position.x = sgn * .73;
      loft(body, coach, [[.55, .57, .013, .028], [.87, .64, .155, .156], [1.27, .73, .271, .274], [1.66, .76, .295, .312],
        [2.12, .71, .254, .237], [2.48, .63, .139, .14], [2.58, .59, .016, .025]], 20, 18, .75).position.x = sgn * .735;
      for (const h of [.52, .58, .64]) { billet(body, nickel, sgn * 1.00, h, -1.74, .029, .022, 1.32); billet(body, nickel, sgn * 1.01, h, 1.71, .028, .021, 1.46); }
      oval(body, nickel, sgn * .66, .88, -2.36, .185, .187, .18);
      oval(body, amber, sgn * .66, .88, -2.48, .129, .131, .073);
      oval(body, redLens, sgn * .79, .65, 2.482, .051, .083, .046);
      oval(body, nickel, sgn * 1.01, 1.43, -.95, .082, .063, .032);
    }
    roundedCase(body, darkTailgate, 0, 1.049, 2.426, 1.61, .600, .135, .145);
    for (const y of [.84, 1.024, 1.205]) billet(body, ash, 0, y, 2.502, 1.43, .044, .052);
    for (const x of [-.735, .735]) billet(body, ash, x, 1.062, 2.50, .050, .44, .064);
    billet(body, nickel, 0, 1.248, 2.512, .218, .049, .038);
    for (const sgn of [-1, 1]) {
      billet(body, safetyGlass, sgn * .382, 1.615, -.946, .743, .405, .033).rotation.x = .59;
      billet(body, safetyGlass, sgn * .376, 1.60, 2.22, .696, .344, .04).rotation.x = -.44;
    }
    billet(body, ash, 0, 1.62, 2.224, .067, .42, .088).rotation.x = -.44;
    billet(body, nickel, 0, 1.59, -1.000, .038, .49, .05).rotation.x = .59;
    for (let i = 0; i < 5; i++) {
      const z = -2.35 + i * .173;
      for (let k = -2; k <= 2; k++) billet(body, nickel, k * .072, 1.35 + i * .025, z, .016, .015, .167);
      billet(body, nickel, 0, .60 + i * .062, -2.567 + i * .008, .99 - i * .031, .035, .050);
    }
    billet(body, nickel, 0, .467, -2.59, 1.77, .121, .17);
    billet(body, nickel, 0, .446, 2.535, 1.85, .123, .19);
    for (const s of [-1, 1]) {
      billet(body, nickel, s * .58, .495, -2.658, .105, .245, .17);
      billet(body, deckWood, s * .95, 2.37, .44, .090, .118, 3.65);
      for (const z of [-1.06, .20, 1.65]) {
        billet(body, nickel, s * .944, 1.885, z, .035, .84, .062);
        billet(body, deckWood, s * .93, 2.36, z, .091, .367, .065);
      }
      spar(body, charcoal, [s * .946, 2.49, -1.39], [s * .946, 2.49, 2.29], .021);
    }
    for (let i = 0; i < 12; i++) billet(body, i % 3 ? deckWood : ash, (i - 5.5) * .153, 2.265, .43, .145, .065, 3.69);
    for (const x of [-.87, -.40]) spar(body, charcoal, [x, .37, 2.62], [x, 2.29, 2.10], .031, .028);
    for (let i = 0; i < 7; i++) {
      const f = (i + .38) / 7;
      spar(body, nickel, [-.87, lerp(.37, 2.29, f), lerp(2.62, 2.10, f)], [-.40, lerp(.37, 2.29, f), lerp(2.62, 2.10, f)], .023);
    }
    // 4 sculpted 20L Electric-Cyan Jerrycans + WiFi omni mast on roof-deck!
    for (const sgn of [-1, 1]) {
      for (const z of [-.15, .95]) {
        const jc = makeJerikan(1.0);
        jc.position.set(sgn * .48, 2.30, z);
        jc.rotation.y = sgn * .25;
        body.add(jc);
      }
    }
    spar(body, antennaMat, [0, 2.28, -.75], [0, 3.35, -.75], .022, .010, 8);
    const wagonBeacon = meshAt(new T.SphereGeometry(.09, 14, 10), beaconCyanMat, body, 0, 3.38, -.75);

    const wheels = [
      makeWheel(inner, -.862, .394, -1.71, true),
      makeWheel(inner, .862, .394, -1.71, true),
      makeWheel(inner, -.882, .394, 1.61, false),
      makeWheel(inner, .882, .394, 1.61, false)
    ];

    const wx = -3.8, wz = 4.0;
    const wy = terrainHeight(wx, wz);
    const heading = Math.atan2(58 - wx, 42 - wz);
    root.position.set(wx, wy, wz);
    root.rotation.y = heading;
    scene.add(root);
    return {
      group: root, wheels, beacon: wagonBeacon,
      x: wx, z: wz, y: wy, heading, speed: 0, steerAngle: 0,
      get deckY() { return this.y + 2.30; }
    };
  }
  const wagon = buildWagon();

  /* ---------- Biome Props, Cairn Landmarks, Film Monoliths & Pueblo ---------- */
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
    if (Z.z === 4) fm.position.set(18.0, gy + 5.8, -4.5);
    else fm.position.set(Z.x + 5.6, gy + 5.8, Z.pz - 5.6);
    fm.rotation.y = .45 + Z.z * .22;
    fm.castShadow = true;
    propGroup.add(fm);
    filmStrips.push({ mesh: fm, baseY: gy + 5.8, phase: Z.z * .7 });

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
    propGroup.add(cairnBase);
    solids.push({ x: Z.x - 4.0, z: Z.pz + 4.4, r: .95 });

    const count = Z.z === 3 ? 14 : Z.z >= 9 ? 4 : 8;
    for (let k = 0; k < count; k++) {
      const ang = (k / count) * TAU + hash2(Z.z, k) * .9;
      const rad = 11.5 + hash2(k, Z.z + 11) * 19;
      const px = Z.x + Math.cos(ang) * rad, pz = Z.pz + Math.sin(ang) * rad;
      if (inThresholdSpan(px, pz) || Math.hypot(px, pz) < 11) continue;
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

  /* ---------- Highland Pueblo Village (Zone IX-X Ridge) + Kiosk Awning + 5 WiFi Relays ---------- */
  const puebloDarkWinMat = new T.MeshStandardMaterial({ color: 0x101214, emissive: 0x001018, emissiveIntensity: .2 });
  const puebloGlowWinMat = new T.MeshStandardMaterial({ color: 0x00a8ff, emissive: 0x00b4ff, emissiveIntensity: 1.35, roughness: .2 });
  const puebloWinMeshes = [];
  const puebloDishes = [];

  (() => {
    const adobe1 = new T.MeshStandardMaterial({ color: 0x9b9689, roughness: .92 });
    const adobe2 = new T.MeshStandardMaterial({ color: 0x7b776c, roughness: .94 });
    const vigaWood = new T.MeshStandardMaterial({ color: 0x3b3328, roughness: .88 });
    const PuebloHouses = [
      [148, 114, 5.2, 3.8, 4.6, .35, true],
      [147, 125, 4.8, 3.4, 4.2, -.2, false],
      [158, 111, 5.8, 4.2, 4.8, .12, true],
      [166, 117, 6.2, 4.8, 5.2, -.45, true],
      [168, 128, 5.4, 3.9, 4.6, .55, false],
      [155, 132, 4.9, 3.3, 4.4, -.12, true],
      [142, 120, 4.6, 3.2, 4.2, .7, false],
      [172, 122, 5.5, 4.0, 4.5, .25, false]
    ];
    for (const [hx, hz, w, h, d, ry, twoStory] of PuebloHouses) {
      const hy = terrainHeight(hx, hz);
      const grp = new T.Group();
      grp.position.set(hx, hy, hz);
      grp.rotation.y = ry;
      const body = new T.Mesh(new T.BoxGeometry(w, h, d), twoStory ? adobe1 : adobe2);
      body.position.y = h * .5 - .2; body.castShadow = true; body.receiveShadow = true; grp.add(body);
      // Timber vigas protruding along roof line
      for (let i = -1; i <= 1; i++) {
        const vig = new T.Mesh(new T.CylinderGeometry(.09, .09, d + .9, 6), vigaWood);
        vig.rotation.x = Math.PI / 2; vig.position.set(i * w * .28, h - .65, 0); grp.add(vig);
      }
      // Second stepped terrace story
      if (twoStory) {
        const top = new T.Mesh(new T.BoxGeometry(w * .62, h * .68, d * .64), adobe2);
        top.position.set(-.3, h + h * .34 - .25, .2); top.castShadow = true; top.receiveShadow = true; grp.add(top);
        // Rooftop mesh node dish
        const pole = new T.Mesh(new T.CylinderGeometry(.04, .05, 1.4, 6), antennaMat);
        pole.position.set(.4, h + h * .68 + .4, -.3); grp.add(pole);
        const orb = new T.Mesh(new T.SphereGeometry(.14, 10, 8), puebloDarkWinMat);
        orb.position.set(.4, h + h * .68 + 1.15, -.3); grp.add(orb);
        puebloDishes.push(orb);
      }
      // Glowing doorways & windows facing Pueblo plaza
      for (const sgn of [-1, 1]) {
        const win = new T.Mesh(new T.BoxGeometry(.78, .92, .12), puebloDarkWinMat);
        win.position.set(sgn * w * .24, h * .48, d * .5 + .03);
        grp.add(win);
        puebloWinMeshes.push(win);
      }
      const door = new T.Mesh(new T.BoxGeometry(1.1, 1.9, .14), puebloDarkWinMat);
      door.position.set(0, .95, d * .5 + .03);
      grp.add(door);
      puebloWinMeshes.push(door);
      scene.add(grp);
      solids.push({ x: hx, z: hz, r: Math.max(w, d) * .48 });
    }

    // Kiosk Awning Stall at Zone VII (ref: "Kidase hums beneath the kiosk awning")
    const kx = 85.5, kz = 67.5, ky = terrainHeight(kx, kz);
    const kg = new T.Group();
    kg.position.set(kx, ky, kz); kg.rotation.y = -.7;
    const stall = new T.Mesh(new T.BoxGeometry(3.4, 2.3, 2.2), adobe2); stall.position.y = 1.1; stall.castShadow = true; kg.add(stall);
    const awning = new T.Mesh(new T.BoxGeometry(3.9, .12, 2.6), adobe1); awning.position.set(0, 2.45, .8); awning.rotation.x = .24; awning.castShadow = true; kg.add(awning);
    for (const sx of [-1.5, 1.5]) {
      const p = new T.Mesh(new T.CylinderGeometry(.07, .07, 2.3, 6), vigaWood); p.position.set(sx, 1.15, 1.8); kg.add(p);
    }
    const tapeDeck = new T.Mesh(new T.BoxGeometry(1.0, .34, .45), beaconCyanMat); tapeDeck.position.set(0, 1.22, 1.12); kg.add(tapeDeck);
    scene.add(kg);
    solids.push({ x: kx, z: kz, r: 2.1 });
  })();

  /* ---------- Zone X Stone Steps & Blue-Lit Sanctuary Door ---------- */
  (() => {
    const Z = ZONES[10];
    const gy = terrainHeight(Z.x, Z.pz);
    const doorGrp = new T.Group();
    doorGrp.position.set(Z.x + 8.5, gy, Z.pz + 6.5);
    doorGrp.rotation.y = -Math.PI * .72;
    const stone = new T.MeshStandardMaterial({ color: 0x3b3b3c, roughness: .92 });
    for (let i = 0; i < 8; i++) {
      const st = new T.Mesh(new T.BoxGeometry(3.4, .28, .75), stone);
      st.position.set(0, .14 + i * .26, 3.6 - i * .58);
      st.castShadow = true; st.receiveShadow = true; doorGrp.add(st);
    }
    const lintel = new T.Mesh(new T.BoxGeometry(4.2, .9, 1.4), stone); lintel.position.set(0, 5.4, -.5); doorGrp.add(lintel);
    for (const sx of [-1.7, 1.7]) {
      const col = new T.Mesh(new T.BoxGeometry(.85, 5.2, 1.3), stone); col.position.set(sx, 2.6, -.5); doorGrp.add(col);
    }
    const door = new T.Mesh(new T.BoxGeometry(2.5, 4.4, .28), new T.MeshStandardMaterial({
      color: 0x00aaff, emissive: 0x00a2ff, emissiveIntensity: 1.45, roughness: .2
    }));
    door.position.set(0, 2.5, -.5); doorGrp.add(door);
    const beacon = new T.PointLight(0x18b4ff, 4.5, 22);
    beacon.position.set(0, 2.8, .6); doorGrp.add(beacon);
    scene.add(doorGrp);
  })();

  /* ---------- Interactive Cast-Iron Wellhead Pump, Hose & Cyan Basin ---------- */
  const well = (() => {
    const wx = 1.4, wz = -1.2, wy = terrainHeight(wx, wz);
    const g = new T.Group(); g.position.set(wx, wy, wz);
    const concrete = new T.MeshStandardMaterial({ color: 0x5d5c57, roughness: .94 });
    const iron = new T.MeshStandardMaterial({ color: 0x262626, roughness: .48, metalness: .68 });
    const basinPlastic = new T.MeshStandardMaterial({ color: 0xbcb9b0, roughness: .65, side: T.DoubleSide });
    const pad = new T.Mesh(new T.BoxGeometry(1.1, .28, .9), concrete); pad.position.set(0, .14, 0); pad.castShadow = true; pad.receiveShadow = true; g.add(pad);
    const barrel = new T.Mesh(new T.CylinderGeometry(.13, .16, 1.05, 12), iron); barrel.position.set(0, .78, 0); barrel.castShadow = true; g.add(barrel);
    const cap = new T.Mesh(new T.CylinderGeometry(.17, .17, .12, 12), iron); cap.position.set(0, 1.30, 0); g.add(cap);
    const spout = new T.Mesh(new T.CylinderGeometry(.048, .048, .42, 10), iron); spout.rotation.z = Math.PI / 2.4; spout.position.set(.22, .68, 0); g.add(spout);

    const leverPivot = new T.Group(); leverPivot.position.set(0, 1.18, 0);
    const leverArm = new T.Mesh(new T.BoxGeometry(.85, .045, .05), iron); leverArm.position.set(-.36, .16, 0); leverArm.rotation.z = -.32;
    leverPivot.add(leverArm); g.add(leverPivot);

    const hosePts = [new T.Vector3(.38, .58, 0), new T.Vector3(.75, .20, .35), new T.Vector3(1.15, .08, .85), new T.Vector3(1.55, .14, 1.32), new T.Vector3(1.75, .36, 1.62)];
    const hose = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(hosePts), 20, .042, 8, false), new T.MeshStandardMaterial({ color: 0xe6e4dc, roughness: .62 }));
    hose.castShadow = true; g.add(hose);

    const bx = 1.75, bz = 1.75;
    const basin = new T.Mesh(new T.CylinderGeometry(.68, .50, .36, 22, 1, true), basinPlastic); basin.position.set(bx, .18, bz); basin.castShadow = true; basin.receiveShadow = true; g.add(basin);
    const basinBottom = new T.Mesh(new T.CircleGeometry(.50, 20), basinPlastic); basinBottom.rotation.x = -Math.PI / 2; basinBottom.position.set(bx, .02, bz); g.add(basinBottom);
    const cyanPool = new T.Mesh(new T.CircleGeometry(.60, 22), cyanWaterMat); cyanPool.rotation.x = -Math.PI / 2; cyanPool.position.set(bx, .24, bz); g.add(cyanPool);

    const stream = new T.Mesh(new T.CylinderGeometry(.032, .048, .55, 10), cyanWaterMat); stream.position.set(bx, .46, bz); g.add(stream);
    const j1 = makeJerikan(1.0); j1.position.set(-.95, 0, .4); j1.rotation.y = .4; g.add(j1);
    const j2 = makeJerikan(1.0); j2.position.set(-.88, 0, -.55); j2.rotation.y = -.5; g.add(j2);
    scene.add(g);
    solids.push({ x: wx, z: wz, r: .9 });
    return { x: wx, z: wz, leverPivot, stream, pool: cyanPool };
  })();

  /* ---------- 5 Cistern WiFi Relays & Mesh Link Arcs (Wellhead -> Highland Pueblo) ---------- */
  function makeTerrainRing(radius, segs = 48, mat) {
    const pts = new Float32Array((segs + 1) * 3);
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pts, 3));
    const line = new T.Line(geo, mat);
    line.frustumCulled = false;
    scene.add(line);
    return { line, pts, segs, radius };
  }
  function updateTerrainRing(ring, cx, cz, yOff = .18) {
    const { pts, segs, radius } = ring;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * TAU;
      const x = cx + Math.cos(a) * radius, z = cz + Math.sin(a) * radius;
      pts[i * 3] = x; pts[i * 3 + 1] = terrainHeight(x, z) + yOff; pts[i * 3 + 2] = z;
    }
    ring.line.geometry.attributes.position.needsUpdate = true;
  }

  const dryWaterMat = new T.MeshStandardMaterial({ color: 0x2a2926, roughness: .95 });
  const relayRingMat = new T.LineBasicMaterial({ color: 0x18b4ff, transparent: true, opacity: .82 });
  const relayDefs = [
    { id: "wellhead", name: "Rift Wellhead", x: 1.4, z: -1.2, lit: true },
    { id: "meadow", name: "Meadow Relay Cistern", x: 28, z: 20, lit: false },
    { id: "ford", name: "River Ford Relay", x: 68, z: 49, lit: false },
    { id: "kiosk", name: "Kiosk Awning Relay", x: 90, z: 65, lit: false },
    { id: "pueblo", name: "Highland Pueblo Plaza", x: 156, z: 121, lit: false }
  ];
  const relays = [];
  for (let i = 0; i < relayDefs.length; i++) {
    const d = relayDefs[i], gy = terrainHeight(d.x, d.z);
    const grp = new T.Group(); grp.position.set(d.x, gy, d.z);
    let poolMesh = null, beaconRing = null, arcLine = null, covRing = null;
    if (i > 0) {
      const wall = new T.Mesh(new T.CylinderGeometry(1.45, 1.65, .52, 20, 1, true), midRockMat);
      wall.position.y = .24; wall.castShadow = true; grp.add(wall);
      const base = new T.Mesh(new T.CircleGeometry(1.45, 20), dryWaterMat);
      base.rotation.x = -Math.PI / 2; base.position.y = .04; grp.add(base);
      poolMesh = new T.Mesh(new T.CircleGeometry(1.38, 22), d.lit ? cyanWaterMat : dryWaterMat);
      poolMesh.rotation.x = -Math.PI / 2; poolMesh.position.y = .36; grp.add(poolMesh);
      const mast = new T.Mesh(new T.CylinderGeometry(.04, .06, 3.2, 8), antennaMat);
      mast.position.set(1.5, 1.5, 0); grp.add(mast);
      beaconRing = new T.Mesh(new T.TorusGeometry(.42, .055, 8, 24), d.lit ? beaconCyanMat : dryWaterMat);
      beaconRing.rotation.x = Math.PI / 2; beaconRing.position.set(1.5, 3.1, 0); grp.add(beaconRing);
      solids.push({ x: d.x, z: d.z, r: 1.5 });
    }
    scene.add(grp);
    covRing = makeTerrainRing(20, 48, relayRingMat);
    updateTerrainRing(covRing, d.x, d.z, .22);
    covRing.line.visible = d.lit;

    if (i > 0) {
      const prev = relayDefs[i - 1];
      const py = terrainHeight(prev.x, prev.z);
      const midX = (prev.x + d.x) * .5, midZ = (prev.z + d.z) * .5;
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(prev.x, py + 3.2, prev.z),
        new T.Vector3(midX, Math.max(py, gy) + 12.0, midZ),
        new T.Vector3(d.x, gy + 3.2, d.z)
      ]);
      arcLine = new T.Mesh(new T.TubeGeometry(curve, 24, .11, 6, false), beaconCyanMat);
      arcLine.visible = d.lit;
      scene.add(arcLine);
    }
    relays.push({ ...d, y: gy, group: grp, poolMesh, beaconRing, covRing, arcLine });
  }

  /* ---------- Falling Electric-Cyan Raindrops ---------- */
  const rain = (() => {
    const N = 240, positions = new Float32Array(N * 6), seeds = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      seeds[i * 3] = (Math.random() - .5) * 44; seeds[i * 3 + 1] = Math.random() * 22; seeds[i * 3 + 2] = (Math.random() - .5) * 44;
    }
    const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.BufferAttribute(positions, 3));
    const mesh = new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0x18b4ff, transparent: true, opacity: .82 }));
    mesh.frustumCulled = false; scene.add(mesh);
    return { N, positions, seeds, geo, mesh };
  })();

  /* ---------- Three Focus-Gated Threshold Crossings ---------- */
  function addThresholdBridge(id, name, cx, cz, dirX, dirZ, halfLen, halfWidth, yTop, tintHex) {
    const grp = new T.Group(); grp.position.set(cx, yTop, cz); grp.rotation.y = Math.atan2(dirX, dirZ);
    const solidMat = new T.MeshStandardMaterial({ color: tintHex, roughness: .42, metalness: .15, transparent: true, opacity: .30 });
    const wireMat = new T.MeshBasicMaterial({ color: 0x18b4ff, wireframe: true, transparent: true, opacity: .82 });
    const slabs = 6;
    for (let i = 0; i < slabs; i++) {
      const zOff = lerp(-halfLen + 1.2, halfLen - 1.2, i / (slabs - 1));
      const g = new T.BoxGeometry(halfWidth * 1.9, .45, (halfLen * 2) / slabs - .35);
      const m = new T.Mesh(g, solidMat); m.position.set(0, -.22, zOff); m.castShadow = true; m.receiveShadow = true;
      const w = new T.Mesh(g, wireMat); w.position.copy(m.position);
      grp.add(m, w);
    }
    scene.add(grp);
    thresholds.push({ id, name, x: cx, z: cz, dirX, dirZ, halfLen, halfWidth, yTop, group: grp, solidMat, wireMat, solidFactor: 0 });
  }
  const lenRiver = Math.hypot(58 - 28, 42 - 20);
  addThresholdBridge("river_causeway", "Cyan River Causeway (Zone VI)", 58, 42, (58 - 28) / lenRiver, (42 - 20) / lenRiver, 11.5, 3.2, 2.6, 0x9b988e);
  addThresholdBridge("dune_arch", "Gypsum Chasm Span (Zone VIII)", 114, 86, .79, .61, 8.8, 3.2, 7.6, 0xd8d3c3);
  addThresholdBridge("ice_bridge", "Pueblo Approach Bridge (Zone X)", 150, 115, .79, .61, 8.2, 3.2, 11.0, 0xf2f7fc);

  /* ---------- Mistletoe: Prominent Electric-Cyan Flank & Top Jerrycans + WiFi Antenna + Mobile Wavefront ---------- */
  const donkey = window.makeDonkey({
    assetPath: "../donkey/",
    shells: phone ? 6 : 11,
    contactShadow: true,
    alwaysHalter: true
  });
  scene.add(donkey.group);
  donkey.setCargo([
    { name: "Cyan Jerikan L (20L)", kg: 12, slot: "L" },
    { name: "Cyan Jerikan R (20L)", kg: 12, slot: "R" },
    { name: "Scion WiFi Transceiver", kg: 8, slot: "T" }
  ]);
  // Hide default gray canvas bags & bedroll groups while keeping fitted pad, cinch & leather straps
  for (const c of donkey.pack.children) if (c.isGroup) c.visible = false;

  const donkeyRig = new T.Group();
  donkey.pack.add(donkeyRig);
  for (const sgn of [-1, 1]) {
    const jc = makeJerikan(1.12);
    jc.position.set(sgn * .35, .86, .04);
    jc.rotation.y = sgn * Math.PI * .5;
    jc.rotation.z = sgn * .14;
    donkeyRig.add(jc);
    // Leather lashing strap visibly securing cyan jerrycan onto pannier frame
    const band = new T.Mesh(new T.BoxGeometry(.38, .05, .28), strapMat);
    band.position.set(sgn * .34, 1.04, .04); band.rotation.z = sgn * .14; donkeyRig.add(band);
  }
  const topJer = makeJerikan(.96);
  topJer.position.set(0, 1.25, .08);
  topJer.rotation.y = .35;
  donkeyRig.add(topJer);
  // Swaying silver whip antenna & glowing cyan WiFi orb rising from Mistletoe's Scion jerrycan
  const whip = new T.Mesh(new T.CylinderGeometry(.009, .016, .88, 6), antennaMat);
  whip.position.set(-.05, 1.85, .08); donkeyRig.add(whip);
  const donkeyBeacon = new T.Mesh(new T.SphereGeometry(.072, 12, 10), beaconCyanMat);
  donkeyBeacon.position.set(-.05, 2.30, .08); donkeyRig.add(donkeyBeacon);

  donkey.place(2.2, -3.4, 1.1, heightAt);
  donkey.state.onStep = (leg, gait) => audio.step(leg, gait);

  // Live Concentric WiFi Coverage Rings gliding across terrain around Mistletoe + Expanding 3D Wavefront Arcs
  const donkeyRings = [
    makeTerrainRing(4.5, 44, new T.LineBasicMaterial({ color: 0x26ccff, transparent: true, opacity: .88 })),
    makeTerrainRing(9.5, 52, new T.LineBasicMaterial({ color: 0x14a8ff, transparent: true, opacity: .66 })),
    makeTerrainRing(15.5, 60, new T.LineBasicMaterial({ color: 0x0a84ff, transparent: true, opacity: .44 }))
  ];
  const waveArcs = [];
  for (let i = 0; i < 4; i++) {
    const m = new T.Mesh(new T.TorusGeometry(1.0, .032, 6, 36), new T.MeshBasicMaterial({ color: 0x24cbff, transparent: true, opacity: .7 }));
    m.rotation.x = Math.PI / 2;
    scene.add(m);
    waveArcs.push({ mesh: m, phase: i / 4 });
  }

  const ropePts = new Float32Array(13 * 3);
  const ropeGeo = new T.BufferGeometry();
  ropeGeo.setAttribute("position", new T.BufferAttribute(ropePts, 3));
  const leadRope = new T.Line(ropeGeo, new T.LineBasicMaterial({ color: 0xcbb182, transparent: true, opacity: .85 }));
  leadRope.frustumCulled = false; scene.add(leadRope);

  /* ---------- Multi-Pass High-Definition GPU Shader Pipeline ---------- */
  const rtScene = new T.WebGLRenderTarget(64, 64, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true });
  rtScene.depthTexture = new T.DepthTexture(64, 64);
  rtScene.depthTexture.format = T.DepthFormat; rtScene.depthTexture.type = T.UnsignedIntType;
  rtScene.depthTexture.minFilter = T.NearestFilter; rtScene.depthTexture.magFilter = T.NearestFilter;

  let rtA = new T.WebGLRenderTarget(64, 64, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false });
  let rtB = rtA.clone();

  const postScene = new T.Scene();
  const postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postQuad = new T.Mesh(new T.PlaneGeometry(2, 2), null);
  postScene.add(postQuad);

  const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const accMat = new T.ShaderMaterial({
    uniforms: { tCur: { value: null }, tPrev: { value: null }, uDamp: { value: .30 } },
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
          float flutter = step(0.992, h(vec2(floor(uv.y * 190.0), floor(uT * 11.0)))) * uAudioHigh * 0.22;
          return silverBase * (0.92 + 0.08 * vg) + vec3(0.16, 0.72, 1.0) * flutter;
        }
        return col;
      }

      vec3 evalByFloat(float fz, vec2 uv, vec3 raw, vec3 silverBase, vec3 tr, float l, float ed, float vg) {
        float cf = clamp(fz, 0.0, 10.0);
        int i0 = int(floor(cf)), i1 = i0 < 10 ? i0 + 1 : 10;
        vec3 a = evalLook(i0, uv, raw, silverBase, tr, l, ed, vg);
        vec3 b = (i1 == i0) ? a : evalLook(i1, uv, raw, silverBase, tr, l, ed, vg);
        return mix(a, b, smoothstep(0.15, 0.85, fract(cf)));
      }

      void main() {
        vec2 uv = vUv, e = 1.0 / uRes;
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
          vec3 jk = evalLook(13, uv, raw, silverBase, tr, l, ed, vg);
          vec3 fLook = evalLook(uFocusLook, uv, raw, silverBase, tr, l, ed, vg);
          float focalBand = 1.0 - smoothstep(0.45, 1.15, abs(coc));
          outCol = mix(jk, fLook, focalBand * 0.45);
          float cyanWave = smoothstep(0.16, 0.0, abs(abs(coc) - 0.86)) * (0.12 + 0.72 * uFocusPulse);
          outCol = mix(outCol, vec3(0.08, 0.74, 1.0), cyanWave * 0.65);
        } else if (uRouteMode == 1) {
          float zBand = clamp(l * 10.0 + coc * 2.1, 0.0, 10.0);
          vec3 strataCol = evalByFloat(zBand, uv, raw, silverBase, tr, l, ed, vg);
          vec3 focalCol = evalLook(uFocusLook, uv, raw, silverBase, tr, l, ed, vg);
          float sharp = 1.0 - smoothstep(0.45, 1.15, abs(coc));
          outCol = mix(strataCol, focalCol, sharp * (1.0 - uStrataLock));
          float ring = smoothstep(0.14, 0.0, abs(abs(coc) - 0.90)) * uFocusPulse;
          outCol = mix(outCol, vec3(0.18, 0.78, 1.0), ring * 0.65);
        } else if (uRouteMode == 2) {
          float shellZ = clamp(5.0 + coc * 2.4, 0.0, 10.0);
          outCol = evalByFloat(shellZ, uv, raw, silverBase, tr, l, ed, vg);
          float bound = smoothstep(0.09, 0.0, abs(fract(shellZ + 0.5) - 0.5)) * (0.14 + 0.45 * uFocusPulse);
          outCol = mix(outCol, vec3(0.18, 0.78, 1.0), bound);
        } else {
          outCol = evalByFloat(l * 10.0, uv, raw, silverBase, tr, l, ed, vg);
        }

        /* Hue-ratio selective Blue Jerikan #47B pass: shadow-safe vivid electric cyan */
        if (uJerikanFilter > 0.5 || uRouteMode == 0 || uSoloLook == 13) {
          float maxRG = max(raw.r, raw.g);
          float blueDom = (raw.b - maxRG) / max(raw.b, 0.035);
          float cyanMask = smoothstep(0.18, 0.46, blueDom) * smoothstep(0.03, 0.10, raw.b);
          float cyanShade = clamp(0.48 + 0.82 * raw.b - raw.r * 0.15, 0.44, 1.30);
          vec3 cyanGlow = mix(vec3(0.0, 0.50, 0.96), vec3(0.32, 0.92, 1.0), smoothstep(0.16, 0.86, raw.b)) * cyanShade * (0.95 + 0.24 * uAudioBass);
          outCol = mix(outCol, cyanGlow, cyanMask);
        }

        gl_FragColor = vec4(clamp(outCol, 0.0, 1.0), 1.0);
      }
    `
  });

  /* ---------- Interactive State & Initial Trailhead Framing ---------- */
  const state = {
    x: -7.8, z: -4.8, y: 0,
    yaw: Math.atan2(-(1.2 - (-7.8)), -(-1.2 - (-4.8))),
    pitch: -0.06,
    cartYawOffset: 0, cartPitchOffset: 0,
    modeIdx: initModeIdx,
    stopIdx: 2,
    filterIdx: 5,
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
    wifiCharge: 1.0,
    signalDbm: -38,
    litRelays: 1,
    coveragePct: 20,
    meteredZone: 4,
    currentZone: 4,
    plates: []
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.plates)) state.plates = saved.plates;
  } catch {}
  state.y = heightAt(state.x, state.z) + 1.68;

  /* ---------- Step Wedge & HUD ---------- */
  const wedgeEl = $("step-wedge");
  ZONES.forEach(Z => {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "swatch";
    btn.style.background = Z.swatch; btn.style.color = Z.z < 5 ? "#f1eee6" : "#141512";
    btn.textContent = ROMAN[Z.z];
    btn.title = `Zone ${ROMAN[Z.z]} · ${Z.name} (${LOOKS[Z.look].name}) — Click focuses, double-click travels`;
    let clickTimer = null;
    btn.addEventListener("click", ev => {
      if (ev.shiftKey) { teleportZone(Z.z); return; }
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        const d = clamp(Math.hypot(Z.x - camera.position.x, Z.pz - camera.position.z), 1.4, 260);
        state.focusDist = d; state.focusLook = Z.look; state.focusPulse = 1.0; updateHUD();
        toast(`Focus racked to Zone ${ROMAN[Z.z]} · ${Z.name} (${d.toFixed(1)} m)`);
      }, 170);
    });
    btn.addEventListener("dblclick", () => { clearTimeout(clickTimer); teleportZone(Z.z); });
    wedgeEl.appendChild(btn);
  });

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3400);
  }
  function formatMMSS(sec) {
    const s = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  function updateFocusKnobVisual() {
    const k = clamp((Math.log(state.focusDist) - Math.log(1.2)) / (Math.log(260) - Math.log(1.2)), 0, 1);
    $("focus-knob").style.setProperty("--ang", lerp(-140, 140, k).toFixed(1) + "deg");
    $("focus-knob").setAttribute("aria-valuenow", state.focusDist.toFixed(1));
  }

  function updateHUD() {
    const m = MODES[state.modeIdx], st = STOPS[state.stopIdx], fl = FILTERS[state.filterIdx], Z = ZONES[state.currentZone];
    const activeLook = state.soloLook >= 0 ? LOOKS[state.soloLook] : LOOKS[state.focusLook];
    $("zone-title").textContent = `Zone ${ROMAN[Z.z]} · ${Z.name}`;
    $("hud-sub").textContent = `${m.label} · ${state.drivingCart ? "WAGON " + Math.abs(wagon.speed).toFixed(1) + " m/s · " : ""}FOCUS ${state.focusDist.toFixed(1)} m · ${st.name} · ${fl.name}`;
    $("focus-dist-val").textContent = `${state.focusDist.toFixed(1)} m`;
    $("focus-look-val").textContent = state.soloLook >= 0 ? `SOLO · ${activeLook.name}` : `FOCUS · ${activeLook.name}`;
    $("wedge-caption").textContent = `Meter Zone ${ROMAN[state.meteredZone]} · WiFi ${state.signalDbm} dBm · Pueblo ${state.litRelays}/5 (${state.coveragePct}%)`;
    $("ppc-wifi").textContent = `(((•))) ${state.signalDbm} dBm · PUEBLO ${state.litRelays}/5 (${state.coveragePct}%)`;

    $("btn-cart").setAttribute("aria-pressed", String(state.drivingCart));
    $("btn-cart").textContent = state.drivingCart ? "Exit Wagon (C)" : "Drive Wagon (C)";
    $("btn-ride").setAttribute("aria-pressed", String(state.riding));
    $("btn-jerikan").setAttribute("aria-pressed", String(fl.jerikan === 1));
    $("btn-ppc").setAttribute("aria-pressed", String(state.ppcOn));
    $("ppc-hud").hidden = !state.ppcOn;

    const swans = wedgeEl.querySelectorAll(".swatch"), capSet = new Set(state.plates.map(p => p.zone));
    swans.forEach((b, idx) => { b.classList.toggle("active", idx === state.meteredZone); b.classList.toggle("captured", capSet.has(idx)); });
    updateFocusKnobVisual();

    const u = lookMat.uniforms;
    u.uFocusDist.value = state.focusDist; u.uDofOctaves.value = st.oct; u.uTilt.value = state.tilt;
    u.uStrataLock.value = st.lock; u.uRouteMode.value = state.modeIdx; u.uSoloLook.value = state.soloLook;
    u.uFocusLook.value = state.focusLook; u.uFilter.value.set(fl.rgb[0], fl.rgb[1], fl.rgb[2]);
    u.uJerikanFilter.value = fl.jerikan;
  }

  function renderTray() {
    const tray = $("rack-tray"), tab = state.trayTab;
    ["mode", "look", "lens", "burro"].forEach(k => $("sp-" + k).setAttribute("aria-pressed", String(tab === k)));
    if (!tab) { tray.hidden = true; return; }
    tray.hidden = false;

    if (tab === "mode") {
      tray.innerHTML = `
        <div class="tray-head"><h2>Focus Pull Mode</h2><button type="button" class="chip" id="tr-close">Done</button></div>
        <p class="tray-note">${MODES[state.modeIdx].desc}</p>
        <div class="chip-grid">${MODES.map((m, i) => `<button type="button" class="chip wide" data-mode="${i}" aria-pressed="${state.modeIdx === i}">${m.label} — ${m.sub}</button>`).join("")}</div>
        <div class="sec-label">Teleport to Zone Sanctuary</div>
        <div class="chip-grid">${ZONES.map(z => `<button type="button" class="chip" data-tp="${z.z}">Z-${ROMAN[z.z]} ${z.name}</button>`).join("")}</div>`;
      tray.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { state.modeIdx = +b.dataset.mode; state.focusPulse = 1; renderTray(); updateHUD(); });
      tray.querySelectorAll("[data-tp]").forEach(b => b.onclick = () => teleportZone(+b.dataset.tp));
    } else if (tab === "look") {
      const targetName = state.soloLook >= 0 ? `SOLO FULL: ${LOOKS[state.soloLook].name}` : `AT FOCUS: ${LOOKS[state.focusLook].name}`;
      tray.innerHTML = `
        <div class="tray-head"><h2>Look Rack (14 Shaders)</h2><button type="button" class="chip" id="tr-close">Done</button></div>
        <p class="tray-note">${targetName}</p>
        <button type="button" class="chip wide" id="lk-all" aria-pressed="${state.soloLook < 0}">All Zone Modes Active (Disable Solo)</button>
        <div class="chip-grid">${LOOKS.map((L, idx) => `<button type="button" class="chip" data-solo="${idx}" aria-pressed="${state.soloLook === idx || (state.soloLook < 0 && state.focusLook === idx)}">${L.zone >= 0 ? "Z-" + ROMAN[L.zone] + " · " : ""}${L.name}</button>`).join("")}</div>`;
      $("lk-all").onclick = () => { state.soloLook = -1; renderTray(); updateHUD(); };
      tray.querySelectorAll("[data-solo]").forEach(b => b.onclick = () => {
        const idx = +b.dataset.solo; state.soloLook = state.soloLook === idx ? -1 : idx;
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
        <div class="tray-head"><h2>Wagon, WiFi &amp; Mistletoe</h2><button type="button" class="chip" id="tr-close">Done</button></div>
        <p class="tray-note">${ds.thought} · Broadcast ${state.signalDbm} dBm · Pueblo Coverage ${state.litRelays}/5 (${state.coveragePct}%).</p>
        <div class="chip-grid">
          <button type="button" class="chip" id="br-cart" aria-pressed="${state.drivingCart}">${state.drivingCart ? "Exit Wagon (C)" : "Drive Wagon (C)"}</button>
          <button type="button" class="chip" id="br-ride" aria-pressed="${state.riding}">${state.riding ? "Dismount (V)" : "Ride Mistletoe (V)"}</button>
          <button type="button" class="chip" id="br-deck" aria-pressed="${state.onWagon}">${state.onWagon ? "Step Off Deck (B)" : "Wagon Roof-Deck (B)"}</button>
          <button type="button" class="chip" id="br-pour">Pour WiFi (F)</button>
          <button type="button" class="chip" id="br-pump">Pump Well (P)</button>
          <button type="button" class="chip" id="br-gait">Pace: ${["Walk", "Trot", "Canter", "Gallop"][state.gaitIdx]}</button>
        </div>
        <div class="sec-label">Pack Donkey Mind &amp; WiFi Tank</div>
        ${bar("WiFi Water", state.wifiCharge)}
        ${bar("Trust", m.trust)}
        ${bar("Calm", 1 - m.fear)}
        ${bar("Energy", ds.stamina)}
        <div class="chip-grid">
          <button type="button" class="chip" id="br-feed">Feed Oats</button>
          <button type="button" class="chip" id="br-soothe">Soothe</button>
          <button type="button" class="chip" id="br-bray">Bray</button>
        </div>`;
      $("br-cart").onclick = () => { toggleCart(); renderTray(); };
      $("br-ride").onclick = () => { toggleRide(); renderTray(); };
      $("br-deck").onclick = () => { toggleWagonDeck(); renderTray(); };
      $("br-pour").onclick = () => { pourWifi(); renderTray(); };
      $("br-pump").onclick = () => { pumpWell(); renderTray(); };
      $("br-gait").onclick = () => { state.gaitIdx = (state.gaitIdx + 1) % 4; renderTray(); };
      $("br-feed").onclick = () => { donkey.feed(); toast("Mistletoe munches oats gratefully."); renderTray(); };
      $("br-soothe").onclick = () => { donkey.soothe(); toast("A steady hand on Mistletoe’s shoulder."); renderTray(); };
      $("br-bray").onclick = () => { donkey.bray(); toast("Mistletoe brays across the ridge."); };
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

  /* ---------- Actions: Pump Well, Pour WiFi Water into Relays & Pueblo, Drive Wagon ---------- */
  function igniteRelay(r) {
    if (r.lit) return;
    r.lit = true;
    if (r.poolMesh) r.poolMesh.material = cyanWaterMat;
    if (r.beaconRing) r.beaconRing.material = beaconCyanMat;
    if (r.covRing) r.covRing.line.visible = true;
    if (r.arcLine) r.arcLine.visible = true;
    state.wifiCharge = clamp(state.wifiCharge - .18, .25, 1.0);
    state.litRelays = relays.filter(x => x.lit).length;
    state.coveragePct = Math.round((state.litRelays / relays.length) * 100);
    if (r.id === "pueblo") {
      for (const m of puebloWinMeshes) m.material = puebloGlowWinMat;
      for (const d of puebloDishes) d.material = beaconCyanMat;
      audio.relayChime(true);
      toast("PUEBLO CISTERN FILLED · Electric-cyan WiFi floods the Highland Pueblo (100%)!");
    } else {
      audio.relayChime(false);
      toast(`${r.name} energized with Cyan WiFi Water (${state.litRelays}/5 · ${state.coveragePct}%).`);
    }
    updateHUD();
  }

  function pourWifi() {
    let closest = null, bestD = 1e9;
    for (const r of relays) {
      if (r.lit) continue;
      const dp = Math.hypot(r.x - state.x, r.z - state.z);
      const dm = Math.hypot(r.x - donkey.state.x, r.z - donkey.state.z);
      const d = Math.min(dp, dm);
      if (d < bestD) { bestD = d; closest = r; }
    }
    if (closest && bestD < 28) {
      igniteRelay(closest);
    } else if (Math.hypot(well.x - state.x, well.z - state.z) < 15) {
      state.wifiCharge = 1.0;
      toast("Cyan jerrycans refilled to 100% WiFi Charge at the Wellhead.");
    } else {
      toast(closest ? `Carry the cyan ${Math.round(bestD)} m closer to ${closest.name} to pour WiFi water.` : "All 5 WiFi Cisterns across the Pueblo ridge are active (100%)!");
    }
  }
  $("btn-pour").addEventListener("click", pourWifi);

  function pumpWell() {
    state.pumpFlow = 1.0;
    state.pumpLeverPhase = 0.01;
    state.wifiCharge = 1.0;
    audio.pumpClank();
    donkey.feed(); donkey.soothe();
    toast("Iron lever cracks — cyan WiFi water refills the basin & Mistletoe’s jerrycans!");
    if (state.trayTab === "burro") renderTray();
  }
  $("btn-pump").addEventListener("click", pumpWell);

  function toggleCart() {
    state.riding = false; state.onWagon = false;
    state.drivingCart = !state.drivingCart;
    if (state.drivingCart) {
      state.cartYawOffset = 0; state.cartPitchOffset = 0;
      toast("Driving Woody Station Wagon — W/S throttle, A/D steer, Space brake, C exit.");
    } else {
      wagon.speed = 0;
      state.x = wagon.x + Math.cos(wagon.heading) * 2.6;
      state.z = wagon.z - Math.sin(wagon.heading) * 2.6;
      state.y = heightAt(state.x, state.z) + 1.68;
      toast("Parked and stepped out beside the Woody Wagon.");
    }
    updateHUD();
  }
  $("btn-cart").addEventListener("click", toggleCart);

  function teleportZone(zoneIdx) {
    const Z = ZONES[clamp(zoneIdx, 0, 10)];
    state.riding = false; state.onWagon = false; state.drivingCart = false;
    state.x = Z.x - 5.5; state.z = Z.pz + 5.5;
    state.y = heightAt(state.x, state.z) + 1.68;
    state.yaw = Math.atan2(-(Z.x - state.x), -(Z.pz - state.z));
    state.pitch = -.06;
    state.focusDist = 11.0; state.focusLook = Z.look; state.focusPulse = 1.0;
    donkey.place(Z.x - 1.5, Z.pz + 2.5, state.yaw + .4, heightAt);
    updateHUD();
    toast(`Arrived at Zone ${ROMAN[Z.z]} · ${Z.name}`);
  }

  function toggleRide() {
    if (state.onWagon || state.drivingCart) { state.onWagon = false; state.drivingCart = false; }
    if (!state.riding && Math.hypot(donkey.state.x - state.x, donkey.state.z - state.z) > 12) {
      donkey.place(state.x + 1.8, state.z + 1.8, state.yaw, heightAt);
    }
    state.riding = !state.riding; state.leadMode = "lead"; donkey.state.tethered = false;
    if (state.riding) state.yaw = donkey.state.heading + Math.PI;
    updateHUD();
    toast(state.riding ? "Mounted Mistletoe — WASD to ride, F pour WiFi water at relays." : "Dismounted.");
  }
  $("btn-ride").addEventListener("click", toggleRide);

  function toggleWagonDeck() {
    state.riding = false; state.drivingCart = false; wagon.speed = 0;
    state.onWagon = !state.onWagon;
    if (state.onWagon) {
      state.x = wagon.x; state.z = wagon.z;
      state.y = wagon.deckY + 1.66;
      state.yaw = Math.atan2(-(58 - wagon.x), -(42 - wagon.z));
      state.pitch = -0.06;
      toast("Atop Woody Station Wagon roof-deck — panoramic WiFi Survey view.");
    } else {
      state.x = wagon.x + 2.8; state.z = wagon.z + 1.4;
      state.y = heightAt(state.x, state.z) + 1.68;
      toast("Stepped down from roof-deck.");
    }
    updateHUD();
  }

  $("btn-jerikan").addEventListener("click", () => {
    state.filterIdx = state.filterIdx === 5 ? 0 : 5;
    updateHUD(); if (state.trayTab === "lens") renderTray();
  });
  $("btn-ppc").addEventListener("click", () => { state.ppcOn = !state.ppcOn; updateHUD(); });

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
      signalDbm: state.signalDbm,
      coveragePct: state.coveragePct,
      dataUrl: tmp.toDataURL("image/jpeg", .84)
    };
    state.plates.push(plate);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ plates: state.plates.slice(-22) })); } catch {}
    updateHUD();
    toast(`WiFi Coverage Plate #${plate.id} · Zone ${plate.roman} · ${plate.signalDbm} dBm (Pueblo ${plate.coveragePct}%)`);
  }
  $("expose-btn").addEventListener("click", exposePlate);

  function openPlateBox() {
    const box = $("platebox"), grid = $("pl-grid"), big = $("pl-big"), note = $("pl-note");
    const got = new Set(state.plates.map(p => p.zone));
    note.textContent = `${state.plates.length} WiFi Coverage Plate(s) · ${got.size}/11 Tonal Zones · Pueblo Mesh ${state.litRelays}/5 (${state.coveragePct}%).`;
    big.hidden = true;
    grid.innerHTML = state.plates.length ? state.plates.slice().reverse().map(p => `
      <button type="button" class="pl-card" data-pid="${p.id}">
        <img src="${p.dataUrl}" alt="Zone ${p.roman} plate">
        <small><strong>#${p.id} · Zone ${p.roman}</strong> (${p.place})<br>WiFi ${p.signalDbm ?? -40} dBm · Pueblo ${p.coveragePct ?? 20}% · ${p.focus}</small>
      </button>`).join("") : `<p class="tray-note">No coverage plates exposed yet. Press Space or click Expose 8×10.</p>`;
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
    else if (e.code === "KeyF") pourWifi();
    else if (e.code === "KeyH") { state.ppcOn = !state.ppcOn; updateHUD(); }
    else if (e.code === "KeyG") { state.groundGlass = !state.groundGlass; document.body.classList.toggle("ground-glass", state.groundGlass); }
    else if (e.code === "Space") {
      e.preventDefault();
      if (state.drivingCart) wagon.speed *= .2;
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
    const w = Math.max(2, Math.floor(innerWidth * dpr)), h = Math.max(2, Math.floor(innerHeight * dpr));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / Math.max(1, innerHeight); camera.updateProjectionMatrix();
    rtScene.setSize(w, h); rtA.setSize(w, h); rtB.setSize(w, h);
  }
  addEventListener("resize", resize);
  resize();

  /* ---------- Raycast Meter & Simulation Loop ---------- */
  const raycaster = new T.Raycaster(), centerVec = new T.Vector2(0, 0);
  const donkeyHand = new T.Vector3(), halterOut = new T.Vector3(), saddlePos = new T.Vector3();

  function sampleMeter() {
    raycaster.setFromCamera(centerVec, camera);
    const hits = raycaster.intersectObject(terrainMesh, false);
    if (hits.length) {
      const p = hits[0].point, alb = terrainAlbedo(p.x, p.z, p.y), fl = FILTERS[state.filterIdx];
      state.meteredZone = clamp(Math.round(alb * (fl.rgb[0] * .3 + fl.rgb[1] * .59 + fl.rgb[2] * .11) * 10), 0, 10);
    } else state.meteredZone = 8;
    const proj = valleyProjection(state.x, state.z);
    state.currentZone = clamp(Math.round(proj.t * 10), 0, 10);

    // Compute live WiFi dBm telemetry from Mistletoe + Wagon + active Relays
    const dM = Math.hypot(donkey.state.x - state.x, donkey.state.z - state.z);
    const dW = Math.hypot(wagon.x - state.x, wagon.z - state.z);
    let bestRelayD = 1e9;
    for (const r of relays) if (r.lit) bestRelayD = Math.min(bestRelayD, Math.hypot(r.x - state.x, r.z - state.z));
    const eff = Math.min(dM * 1.15, dW * 1.45, bestRelayD * .85);
    state.signalDbm = Math.round(clamp(-32 - eff * 1.1, -92, -32));
    state.litRelays = relays.filter(r => r.lit).length;
    state.coveragePct = Math.round((state.litRelays / relays.length) * 100);
  }

  let lastT = performance.now(), meterClock = 0;
  function step(dt) {
    const fwdInput = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const sideInput = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const shiftPace = keys.ShiftLeft || keys.ShiftRight ? Math.max(1, state.gaitIdx) : state.gaitIdx;

    if (state.drivingCart) {
      const topFwd = (keys.ShiftLeft || keys.ShiftRight) ? 17.5 : 13.5;
      const targetSpd = fwdInput > 0 ? topFwd : fwdInput < 0 ? -5.8 : 0;
      const accelRate = fwdInput === 0 ? 3.6 : 4.2;
      wagon.speed = lerp(wagon.speed, targetSpd, 1 - Math.exp(-dt * accelRate));
      if (Math.abs(wagon.speed) < .04 && fwdInput === 0) wagon.speed = 0;

      const steerRate = 1.65, steerDir = wagon.speed < -0.5 ? 1 : -1;
      wagon.heading += sideInput * steerDir * steerRate * dt;
      wagon.steerAngle = lerp(wagon.steerAngle, -sideInput * .38, 1 - Math.exp(-dt * 8));

      let nx = clamp(wagon.x + Math.sin(wagon.heading) * wagon.speed * dt, -172, 200);
      let nz = clamp(wagon.z + Math.cos(wagon.heading) * wagon.speed * dt, -172, 200);
      for (const s of solids) {
        const dx = nx - s.x, dz = nz - s.z, minD = s.r + 1.5;
        const d = Math.hypot(dx, dz);
        if (d < minD && d > .001) { nx = s.x + (dx / d) * minD; nz = s.z + (dz / d) * minD; }
      }
      const ch = channelFactor(nx, nz), th = inThresholdSpan(nx, nz);
      if ((ch.river > .58 || ch.chasm > .58 || ch.crev > .58) && !(th && th.solidFactor >= .45)) wagon.speed = 0;
      else { wagon.x = nx; wagon.z = nz; }

      wagon.y = heightAt(wagon.x, wagon.z);
      wagon.group.position.set(wagon.x, wagon.y, wagon.z);
      wagon.group.rotation.y = wagon.heading;
      const hf = heightAt(wagon.x + Math.sin(wagon.heading) * 1.8, wagon.z + Math.cos(wagon.heading) * 1.8);
      const hb = heightAt(wagon.x - Math.sin(wagon.heading) * 1.8, wagon.z - Math.cos(wagon.heading) * 1.8);
      wagon.group.rotation.x = clamp((hb - hf) * .25, -.28, .28);
      for (const w of wagon.wheels) {
        w.spin.rotation.x -= (wagon.speed * dt) / .394;
        if (w.front) w.mount.rotation.y = wagon.steerAngle;
      }

      if (!dragLook) state.cartYawOffset *= Math.exp(-dt * 2.4);
      const camAngle = wagon.heading + state.cartYawOffset;
      const camX = wagon.x - Math.sin(camAngle) * 8.2, camZ = wagon.z - Math.cos(camAngle) * 8.2;
      const camY = Math.max(heightAt(camX, camZ) + 2.5, wagon.y + 3.8);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(wagon.x + Math.sin(camAngle) * 9.5, wagon.y + 1.6 + state.cartPitchOffset * 5.0, wagon.z + Math.cos(camAngle) * 9.5);
      camera.updateMatrixWorld();
      state.x = wagon.x; state.z = wagon.z; state.y = wagon.y + 1.8;

      const tDX = wagon.x - Math.cos(wagon.heading) * 3.1 - Math.sin(wagon.heading) * 1.4;
      const tDZ = wagon.z + Math.sin(wagon.heading) * 3.1 - Math.cos(wagon.heading) * 1.4;
      const mdx = tDX - donkey.state.x, mdz = tDZ - donkey.state.z, md = Math.hypot(mdx, mdz);
      if (state.leadMode === "lead" && md > 1.8) {
        const want = Math.atan2(mdx, mdz), df = Math.atan2(Math.sin(want - donkey.state.heading), Math.cos(want - donkey.state.heading));
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
        if (Math.hypot(nx - wagon.x, nz - wagon.z) < 2.2) blocked = true;
        const ch = channelFactor(nx, nz), th = inThresholdSpan(nx, nz);
        if ((ch.river > .55 || ch.chasm > .55 || ch.crev > .55) && !(th && th.solidFactor >= .45)) blocked = true;
        if (!blocked) { state.x = nx; state.z = nz; }
        state.y = lerp(state.y, heightAt(state.x, state.z) + 1.68, clamp(dt * 12, 0, 1));
      }
      const dx = state.x - donkey.state.x, dz = state.z - donkey.state.z, dist = Math.hypot(dx, dz);
      if (state.leadMode === "lead" && dist > 3.6) {
        const want = Math.atan2(dx, dz), df = Math.atan2(Math.sin(want - donkey.state.heading), Math.cos(want - donkey.state.heading));
        donkey.update(dt, { throttle: clamp((dist - 3.0) * .5, 0, 1), steer: clamp(df * 1.4, -1, 1), pace: dist > 9 ? 1 : 0, near: 1, drop: 0 }, heightAt);
      } else donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: dist < 3.5 ? 1 : 0, drop: 0 }, heightAt);
      camera.position.set(state.x, state.y, state.z);
      camera.rotation.order = "YXZ"; camera.rotation.y = state.yaw; camera.rotation.x = state.pitch;
      camera.updateMatrixWorld();
    }

    // Auto-energize unlit WiFi Cistern Relays when Mistletoe or Wagon carries the cyan within 10 m
    for (const r of relays) {
      if (r.lit) continue;
      if (Math.hypot(r.x - donkey.state.x, r.z - donkey.state.z) < 10.0 || (state.drivingCart && Math.hypot(r.x - wagon.x, r.z - wagon.z) < 10.5)) {
        igniteRelay(r);
      }
    }

    // Threshold bridges solidify in Focus, in Wagon beam, or in Mistletoe's active WiFi radius (18 m)
    const stOct = STOPS[state.stopIdx].oct;
    for (const th of thresholds) {
      const distToBridge = Math.hypot(th.x - camera.position.x, th.z - camera.position.z);
      const logDiff = Math.abs(Math.log2(Math.max(1, distToBridge) / state.focusDist));
      const inCartBeam = state.drivingCart && Math.hypot(th.x - wagon.x, th.z - wagon.z) < 22;
      const inDonkeyWifi = Math.hypot(th.x - donkey.state.x, th.z - donkey.state.z) < 18;
      const targetSolid = (logDiff <= Math.max(0.45, stOct * 0.95) || inCartBeam || inDonkeyWifi) ? 1 : 0;
      th.solidFactor = lerp(th.solidFactor, targetSolid, 1 - Math.exp(-dt * 12));
      th.solidMat.opacity = lerp(0.24, 0.96, th.solidFactor);
      th.wireMat.opacity = lerp(0.82, 0.08, th.solidFactor);
    }

    // Update Mistletoe's concentric WiFi contours & expanding 3D wavefronts
    for (const rg of donkeyRings) updateTerrainRing(rg, donkey.state.x, donkey.state.z, .18);
    const nowSec = performance.now() * .001;
    for (const wv of waveArcs) {
      const p = fract(nowSec * .42 + wv.phase);
      const rad = lerp(.65, 8.8, p);
      wv.mesh.position.set(donkey.state.x, donkey.state.y + 1.9 + p * 1.4, donkey.state.z);
      wv.mesh.scale.setScalar(rad);
      wv.mesh.material.opacity = (1 - p) * .78 * (.6 + .4 * state.wifiCharge);
    }
    whip.rotation.z = Math.sin(nowSec * 3.1) * .08;

    // Wellhead Pump Lever & Basin Shimmer
    if (state.pumpFlow > .05) {
      state.pumpFlow = Math.max(.22, state.pumpFlow - dt * .04);
      state.pumpLeverPhase += dt * 4.5;
      well.leverPivot.rotation.z = Math.sin(state.pumpLeverPhase) * .35 * smooth(.22, .65, state.pumpFlow);
    }
    well.stream.visible = state.pumpFlow > .25;
    well.stream.scale.set(state.pumpFlow, 1, state.pumpFlow);
    well.pool.position.y = .21 + Math.sin(nowSec * 4.0) * .012;

    // Falling Cyan Raindrops
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

    const sp = audio.sampleTape();
    lookMat.uniforms.uAudioBass.value = lerp(lookMat.uniforms.uAudioBass.value, sp.bass, clamp(dt * 10, 0, 1));
    lookMat.uniforms.uAudioHigh.value = lerp(lookMat.uniforms.uAudioHigh.value, sp.high, clamp(dt * 10, 0, 1));
    skyMat.uniforms.uTime.value = nowSec;
    lookMat.uniforms.uT.value = nowSec;
    state.focusPulse = Math.max(0, state.focusPulse - dt * 1.4);
    lookMat.uniforms.uFocusPulse.value = state.focusPulse;

    meterClock += dt;
    if (meterClock > .12) {
      meterClock = 0; sampleMeter();
      $("thought").textContent = donkey.state.thought || "Broadcasting cyan WiFi across the ridge.";
      if (!audioEl.paused || audioEl.currentTime > 0) {
        const curT = audioEl.currentTime, dur = Number.isFinite(audioEl.duration) ? audioEl.duration : 283;
        $("tape-time").textContent = `${formatMMSS(curT)} / ${formatMMSS(dur)}`;
        $("ppc-timecode").textContent = `01:${String(12 + Math.floor(curT / 60)).padStart(2, "0")}:${String(Math.floor(curT % 60)).padStart(2, "0")}`;
        let line = LYRICS[0][1];
        for (const [ts, txt] of LYRICS) if (curT >= ts) line = txt;
        $("lyric-line").textContent = line;
      } else {
        $("ppc-timecode").textContent = `01:14:${String(17 + (Math.floor(nowSec) % 42)).padStart(2, "0")}`;
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
      signalDbm: state.signalDbm,
      litRelays: state.litRelays,
      coveragePct: state.coveragePct,
      plates: state.plates.length,
      audioReady: audioEl.readyState >= 1,
      audioDuration: Number.isFinite(audioEl.duration) ? audioEl.duration : null,
      thresholds: thresholds.map(t => ({ id: t.id, dist: Math.hypot(t.x - state.x, t.z - state.z), solid: +(t.solidFactor.toFixed(2)) }))
    }),
    getRelays: () => relays.map(r => ({ id: r.id, name: r.name, lit: r.lit })),
    setMode: id => { const i = MODES.findIndex(m => m.id === id); if (i >= 0) { state.modeIdx = i; state.focusPulse = 1; updateHUD(); if (state.trayTab) renderTray(); } },
    setFocus: m => { state.focusDist = clamp(m, 1.2, 260); state.focusPulse = 1; updateHUD(); },
    setStop: i => { state.stopIdx = clamp(i, 0, STOPS.length - 1); updateHUD(); if (state.trayTab) renderTray(); },
    setFilter: i => { state.filterIdx = clamp(i, 0, FILTERS.length - 1); updateHUD(); if (state.trayTab) renderTray(); },
    setSoloLook: id => { state.soloLook = id ? LOOKS.findIndex(l => l.id === id) : -1; updateHUD(); if (state.trayTab) renderTray(); },
    exposePlate, teleportZone, toggleRide, toggleWagonDeck, toggleCart, pumpWell, pourWifi, toggleTape
  };
})();
