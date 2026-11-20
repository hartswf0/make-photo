/* ABYSSINIAN HIGHLANDS — Roof of Africa (abyss-world.js)
   Orbit → region → ground in one WebGL scene.
   - ORBIT: real elevations (AWS Terrarium z7 → orbital/orbital_dem16.bin, 6–15°N 35–42°E) drawn as a STYLIZED mesh
     (6× vertical exaggeration, hypsometric tint). River/rift lines and label positions are approximate.
   - REGION/GROUND: real-DEM `window.EthiopiaHighlandsPack` (4 regions), endemic fauna/flora reuse, Imani + Mistletoe.
   - FIELDS: real polygons from `window.AbyssFieldPack` draped by canvas-texture overlay; colour = crop / agro-zone / geometry.
     Seasonal colours are STYLIZED phenology, not satellite observations.
   - LOOKS: `window.LookAuditionMV` post-processor. */
(function () {
  "use strict";
  const T = window.THREE;
  if (!T) { console.error("[abyss] THREE missing"); return; }
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const wrapAngle = a => { let r = (a + Math.PI) % TAU; if (r < 0) r += TAU; return r - Math.PI; };
  const ease = t => t * t * (3 - 2 * t);
  const fmt = (n, d = 0) => Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const isNarrow = window.innerWidth < 768;

  /* ---------- Data ---------- */
  const ZONES = {
    kolla:      { name: "Kolla",      geez: "ቆላ",    range: "< 1,500 m",       color: "#e7955a", desc: "hot lowland: sorghum, maize, sesame, cotton" },
    woina_dega: { name: "Woina Dega", geez: "ወይና ደጋ", range: "1,500–2,300 m",  color: "#e6c35c", desc: "temperate: teff, wheat, maize, coffee (to ~2,000 m)" },
    dega:       { name: "Dega",       geez: "ደጋ",    range: "2,300–3,200 m",  color: "#7fcf8a", desc: "cool highland: barley, wheat, pulses, enset" },
    wurch:      { name: "Wurch",      geez: "ውርጭ",   range: "> 3,200 m",       color: "#8fd6ee", desc: "afro-alpine: barley at the limit, grazing" }
  };
  const zoneOf = e => (e >= 3200 ? "wurch" : e >= 2300 ? "dega" : e >= 1500 ? "woina_dega" : "kolla");

  const REGIONS = [
    { id: "simien_imet_gogo", fieldKey: "simien", demKey: "dem_simien", short: "Simien", title: "Simien Mountains · Imet Gogo", lat: 13.2167, lon: 38.0833, yaw: 0.56, windDir: [0.18, -0.98] },
    { id: "gheralta_spires", fieldKey: "gheralta", demKey: "dem_gheralta", short: "Gheralta", title: "Gheralta · Tigray sandstone spires", lat: 13.9722, lon: 39.4286, yaw: 0.28 },
    { id: "blue_nile_gorge", fieldKey: "gorge", demKey: "dem_gorge", short: "Blue Nile gorge", title: "Blue Nile (Abay) gorge", lat: 10.0750, lon: 38.1917, yaw: Math.PI - 0.16 },
    { id: "gerd_belaya_escarpment", fieldKey: "metekel", demKey: "dem_gerd", short: "GERD", title: "GERD · Belaya escarpment", lat: 11.2153, lon: 35.0931, yaw: -1.28 }
  ];
  const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r]));

  const CROPS = {
    teff:  { label: "Teff", note: "Eragrostis tef · staple of injera", base: "#d9b45f",
      keys: [[0, "#8d7656"], [5.5, "#86714f"], [7, "#9aa850"], [8.6, "#6aa24a"], [9.8, "#a9b052"], [10.9, "#e2b84c"], [12, "#8d7656"]] },
    barley: { label: "Barley", note: "highland cereal, to >3,000 m", base: "#c9b46e",
      keys: [[0, "#8a7a5c"], [5.3, "#85774f"], [6.4, "#8eb05a"], [8.2, "#5d9d4c"], [9.6, "#b7b358"], [10.6, "#dfc060"], [12, "#8a7a5c"]] },
    wheat: { label: "Wheat", note: "dega/woina dega cereal", base: "#e0c070",
      keys: [[0, "#8c7a58"], [5.8, "#857350"], [7, "#8bad55"], [8.8, "#52994c"], [10, "#b3b155"], [11.1, "#e6bf4f"], [12, "#8c7a58"]] },
    maize_sorghum: { label: "Maize / sorghum", note: "lowland & mid-altitude cereals", base: "#c8a24a",
      keys: [[0, "#927b55"], [4.2, "#8a744e"], [5.4, "#7fb552"], [7.3, "#3f9650"], [9.2, "#6ea04a"], [10.4, "#cba644"], [12, "#927b55"]] },
    coffee: { label: "Coffee", note: "Coffea arabica · evergreen shrub", base: "#2f7a46",
      keys: [[0, "#35703f"], [2.6, "#3c7a46"], [3.3, "#8fb59a"], [4.2, "#3a7a44"], [8, "#2b7440"], [12, "#35703f"]] },
    other: { label: "Other / unknown", note: "unclassified", base: "#a79a80",
      keys: [[0, "#8d8068"], [8, "#7f9a58"], [11, "#c9ad62"], [12, "#8d8068"]] }
  };
  const SHAPES = {
    "jigsaw":        { label: "Irregular jigsaw polygons", short: "Jigsaw",   color: "#f2a950", desc: "small hand-parcelled plots; edges follow paths, streams and inheritance splits" },
    "contour-ribbon": { label: "Contour terrace ribbons",  short: "Terrace",  color: "#e56fd0", desc: "long narrow strips following hill contours; stone-bund terraces on slopes" },
    "riparian-strip": { label: "Riparian strips",          short: "Riparian", color: "#28d8f0", desc: "elongated plots perpendicular to a river or wetland margin" },
    "lowland-block":  { label: "Lowland mechanized blocks", short: "Mech. block", color: "#c9f05a", desc: "large rectilinear blocks on flat low ground, tractor-scale" },
    "unknown":        { label: "Unclassified",              short: "Other",   color: "#9aa0a6", desc: "geometry not classified" }
  };
  const FIELD_REGION_LABEL = {
    simien: "Simien", gheralta: "Gheralta", gorge: "Blue Nile gorge", metekel: "Metekel / GERD", tana: "Lake Tana plain"
  };

  /* Orbital map labels (lat, lon real; kind drives colour). `approx` marks hand-placed positions of extended features. */
  const MAP_LABELS = [
    { t: "Lake Tana", s: "1,786 m · source of Blue Nile", lat: 12.0, lon: 37.3, k: "water" },
    { t: "Blue Nile / Abay", s: "great loop (approx. course)", lat: 10.35, lon: 37.3, k: "water" },
    { t: "Ras Dashen", s: "~4,550 m · Simien", lat: 13.2417, lon: 38.37, k: "range" },
    { t: "Gheralta", s: "Tigray sandstone spires ▾", lat: 13.9722, lon: 39.4286, k: "range", region: "gheralta_spires" },
    { t: "Lalibela", s: "rock-hewn churches", lat: 12.0317, lon: 39.0417, k: "site" },
    { t: "Aksum", s: "ancient capital", lat: 14.13, lon: 38.72, k: "site" },
    { t: "Addis Ababa", s: "2,355 m", lat: 9.03, lon: 38.74, k: "site" },
    { t: "GERD", s: "11.2153°N 35.0931°E ▾", lat: 11.2153, lon: 35.0931, k: "gerd", region: "gerd_belaya_escarpment" },
    { t: "Abay gorge", s: "10.0750°N 38.1917°E ▾", lat: 10.075, lon: 38.1917, k: "water", region: "blue_nile_gorge" },
    { t: "Imet Gogo", s: "13.2167°N 38.0833°E ▾", lat: 13.2167, lon: 38.0833, k: "site", region: "simien_imet_gogo" },
    { t: "Main Ethiopian Rift", s: "divides Abyssinian | Harar–Bale massifs", lat: 8.6, lon: 39.45, k: "rift" },
    { t: "Abyssinian massif", s: "NW of the rift", lat: 11.0, lon: 38.9, k: "massif" },
    { t: "Harar–Bale massif", s: "SE of the rift", lat: 7.4, lon: 39.9, k: "massif" },
    { t: "Afar depression", s: "below sea level in places", lat: 12.0, lon: 41.0, k: "water" }
  ];
  const RIVER_PTS = [[11.60, 37.40], [11.49, 37.59], [11.15, 37.82], [10.80, 38.05], [10.075, 38.19], [10.10, 37.75], [10.35, 37.25], [10.70, 36.75], [11.05, 36.30], [11.12, 35.70], [11.2153, 35.0931]];
  const RIFT_PTS = [[6.2, 37.9], [7.0, 38.45], [7.9, 38.9], [8.6, 39.45], [9.3, 40.0], [10.2, 40.55], [11.2, 41.0]];

  /* ---------- Info cards ---------- */
  const INFO = [
    { id: "tectonics", tab: "Tectonics", title: "How the roof got there", html: `
      <p>The highlands sit on an old Precambrian basement, later buried by Mesozoic seas (Adigrat Sandstone, Antalo Limestone).
      Estimates for the start of regional uplift vary — some studies place it around <b>~75 Ma</b>; this is debated.</p>
      <p>About <b>30 Ma</b>, the Afar plume erupted vast <b>flood basalts</b> (the Ethiopia–Yemen traps, up to ~2 km thick) that built the plateau's dark cap — the Simien and much of the northwest plateau.</p>
      <p>The <b>Red Sea, Gulf of Aden and Main Ethiopian Rift</b> then split the dome: the rift divides the Abyssinian massif (northwest) from the Harar–Bale massif (southeast). Rivers like the Blue Nile have since cut gorges more than a kilometre deep.</p>
      <p class="sub">Ages are rounded literature values. The orbital rift line is a stylized approximation.</p>` },
    { id: "climate", tab: "Climate", title: "Altitude sets the weather", html: `
      <p>At roughly 2,000–2,500 m, mean annual temperatures run about <b>15–20 °C</b> with cool nights; frost is common above ~3,200 m.</p>
      <p>The main rains — the <b>kiremt</b> — fall from <b>June to mid-September</b>, when the monsoon is pulled up the escarpment from the southwest. Short <b>belg</b> rains come in about February–May; October–January is mostly dry.</p>
      <p>Traditional agro-ecological zones: <b>kolla</b> (&lt;1,500 m), <b>woina dega</b> (1,500–2,300 m), <b>dega</b> (2,300–3,200 m) and <b>wurch</b> (&gt;3,200 m). Use the season slider to follow the cropping calendar.</p>
      <p class="sub">The slider's colours are a stylized crop calendar, not a satellite time series.</p>` },
    { id: "culture", tab: "Culture", title: "A high-ground civilization", html: `
      <p><b>Aksum</b> (c. 1st–10th century CE) controlled Red Sea trade from these highlands and raised the great stelae. <b>Lalibela</b>'s eleven rock-hewn churches were carved in the 12th–13th century.</p>
      <p>The region is a centre of crop origin: <b>Coffea arabica</b> comes from the forests of Ethiopia's southwest highlands, and <b>teff</b> (<i>Eragrostis tef</i>) and <b>enset</b> were domesticated in the highlands — teff is still the basis of injera.</p>
      <p>Orthodox <b>church forests</b> — dense tree rings around churches — are often the last native woodland in a farmed landscape. Ploughing with a pair of oxen and the <i>maresha</i> ard is still common.</p>` },
    { id: "data", tab: "Data & honesty", title: "What is real here", html: `
      <ul>
        <li><b>Real:</b> elevations (AWS Terrarium: SRTM/GMTED/ETOPO1), field polygons (see Fields panel &amp; manifest), landmark coordinates.</li>
        <li><b>Stylized:</b> orbital vertical exaggeration (6×), tints, river &amp; rift lines, season colours, trees, oxen, stone bunds and church ring at ground level.</li>
        <li>Each ground-level DEM tile covers roughly 6–16 km of real terrain but is drawn in a 2.4 km world (horizontally compressed, 0.6× vertical): fields and slopes keep their real layout but look smaller and steeper than life. Crop colours are inferred from altitude zone — crop type is not in the field data.</li>
        <li>Orbital grid is ~1.8 km/cell, so peaks are smoothed (max ~4,300 m vs Ras Dashen ~4,550 m).</li>
      </ul>` }
  ];

  /* ---------- Colour helpers ---------- */
  const _c1 = new T.Color(), _c2 = new T.Color();
  function keyColor(keys, m, out) {
    let i = 0;
    while (i < keys.length - 2 && m > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[i + 1];
    const t = clamp((m - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1);
    _c1.set(a[1]); _c2.set(b[1]);
    return out.copy(_c1).lerp(_c2, ease(t));
  }
  function cssRGB(c, a) { return `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},${a === undefined ? 1 : a})`; }
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function seasonLabel(m) {
    const n = MONTHS[Math.floor(m) % 12];
    let ph;
    if (m < 2) ph = "dry (bega)";
    else if (m < 5) ph = "belg rains · sowing";
    else if (m < 8.5) ph = "monsoon (kiremt)";
    else if (m < 9.5) ph = "late rains";
    else if (m < 11.5) ph = "harvest";
    else ph = "threshing · dry";
    return `${n} · ${ph}`;
  }

  /* ---------- Orbital geometry constants ---------- */
  const LAT0 = 6, LAT1 = 15, LON0 = 35, LON1 = 42;
  const KM_LON = 111.32 * Math.cos(10.5 * DEG), KM_LAT = 110.6, VE = 6;
  const CEN_LON = 38.5, CEN_LAT = 10.5;
  const orbX = lon => (lon - CEN_LON) * KM_LON;
  const orbZ = lat => (CEN_LAT - lat) * KM_LAT;
  const orbInvLon = x => x / KM_LON + CEN_LON;
  const orbInvLat = z => CEN_LAT - z / KM_LAT;

  /* ---------- Boot ---------- */
  async function boot() {
    const canvas = $("view"), stageWrap = $("stage-wrap"), loaderEl = $("loader");
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    } catch (e) { $("loader-sub").textContent = "WebGL unavailable on this device."; return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isNarrow ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    if (T.SRGBColorSpace) renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    const scene = new T.Scene();
    const BG_ORBIT = new T.Color(0x0a1016);
    scene.background = BG_ORBIT.clone();

    const camOrb = new T.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 1, 7000);
    const camGnd = new T.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.25, 28000);
    let camera = camOrb;

    const hemiLight = new T.HemisphereLight(0xdcebff, 0x7b634b, 0.92);
    const sunLight = new T.DirectionalLight(0xfff0d4, 2.3);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 2; sunLight.shadow.camera.far = 360;
    const shSpan = 68;
    Object.assign(sunLight.shadow.camera, { left: -shSpan, right: shSpan, top: shSpan, bottom: -shSpan });
    sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.06;
    scene.add(hemiLight, sunLight, sunLight.target);

    /* Look post-processor */
    const LAMV = window.LookAuditionMV || null;
    const post = LAMV && LAMV.createPostProcessor ? LAMV.createPostProcessor(T, renderer) : null;
    if (LAMV && LAMV.injectSharedStyles) LAMV.injectSharedStyles();

    const orbitalRoot = new T.Group(); orbitalRoot.name = "OrbitalRoot";
    const terrainRoot = new T.Group(); terrainRoot.name = "TerrainRoot";
    const ecologyRoot = new T.Group(); ecologyRoot.name = "EcologyRoot";
    const castRoot = new T.Group(); castRoot.name = "CastRoot";
    const extrasRoot = new T.Group(); extrasRoot.name = "ExtrasRoot";
    const fieldRoot = new T.Group(); fieldRoot.name = "FieldRoot";
    scene.add(orbitalRoot, terrainRoot, ecologyRoot, castRoot, extrasRoot, fieldRoot);

    /* ================= ORBITAL MESH ================= */
    $("loader-sub").textContent = "Loading orbital elevation grid…";
    const [omani, obuf] = await Promise.all([
      fetch("./orbital/orbital_manifest.json").then(r => r.json()),
      fetch("./orbital/orbital_dem16.bin").then(r => r.arrayBuffer())
    ]);
    const OW = omani.width, OH = omani.height;
    const u16 = new Uint16Array(obuf);
    const elevGrid = new Float32Array(OW * OH);
    for (let i = 0; i < elevGrid.length; i++) elevGrid[i] = omani.minElevM + (u16[i] / 65535) * (omani.maxElevM - omani.minElevM);
    const orbSample = (lat, lon) => {
      const u = (lon - LON0) / (LON1 - LON0) * OW - 0.5, v = (LAT1 - lat) / (LAT1 - LAT0) * OH - 0.5;
      const i = clamp(Math.floor(u), 0, OW - 2), j = clamp(Math.floor(v), 0, OH - 2);
      const fx = clamp(u - i, 0, 1), fy = clamp(v - j, 0, 1);
      const a = elevGrid[j * OW + i], b = elevGrid[j * OW + i + 1], c = elevGrid[(j + 1) * OW + i], d = elevGrid[(j + 1) * OW + i + 1];
      return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
    };
    const dispElev = e => Math.max(e, -150);
    const orbHeightKm = (lat, lon) => dispElev(orbSample(lat, lon)) / 1000 * VE;
    const orbHeightAtXZ = (x, z) => orbHeightKm(orbInvLat(z), orbInvLon(x));

    const orbGeo = new T.BufferGeometry();
    {
      const pos = new Float32Array(OW * OH * 3), nor = new Float32Array(OW * OH * 3), el = new Float32Array(OW * OH), uv = new Float32Array(OW * OH * 2);
      const dx = KM_LON * (LON1 - LON0) / OW, dz = KM_LAT * (LAT1 - LAT0) / OH;
      for (let j = 0; j < OH; j++) for (let i = 0; i < OW; i++) {
        const k = j * OW + i;
        const lon = LON0 + (i + 0.5) / OW * (LON1 - LON0), lat = LAT1 - (j + 0.5) / OH * (LAT1 - LAT0);
        const e = elevGrid[k];
        pos[k * 3] = orbX(lon); pos[k * 3 + 1] = dispElev(e) / 1000 * VE; pos[k * 3 + 2] = orbZ(lat);
        el[k] = e; uv[k * 2] = i / (OW - 1); uv[k * 2 + 1] = j / (OH - 1);
      }
      for (let j = 0; j < OH; j++) for (let i = 0; i < OW; i++) {
        const k = j * OW + i;
        const hl = pos[(j * OW + Math.max(i - 1, 0)) * 3 + 1], hr = pos[(j * OW + Math.min(i + 1, OW - 1)) * 3 + 1];
        const hu = pos[(Math.max(j - 1, 0) * OW + i) * 3 + 1], hd = pos[(Math.min(j + 1, OH - 1) * OW + i) * 3 + 1];
        const nx = (hl - hr) / (2 * dx), nz = (hu - hd) / (2 * dz);
        const len = Math.hypot(nx, 1, nz);
        nor[k * 3] = nx / len; nor[k * 3 + 1] = 1 / len; nor[k * 3 + 2] = nz / len;
      }
      const idx = new Uint32Array((OW - 1) * (OH - 1) * 6);
      let q = 0;
      for (let j = 0; j < OH - 1; j++) for (let i = 0; i < OW - 1; i++) {
        const a = j * OW + i, b = a + 1, c = a + OW, d = c + 1;
        idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
      }
      orbGeo.setAttribute("position", new T.BufferAttribute(pos, 3));
      orbGeo.setAttribute("normal", new T.BufferAttribute(nor, 3));
      orbGeo.setAttribute("aElev", new T.BufferAttribute(el, 1));
      orbGeo.setAttribute("uv", new T.BufferAttribute(uv, 2));
      orbGeo.setIndex(new T.BufferAttribute(idx, 1));
    }
    const orbUniforms = {
      uSun: { value: new T.Vector3(-0.55, 0.62, -0.5).normalize() },
      uBg: { value: BG_ORBIT.clone() },
      uZones: { value: 1.0 },
      uFocus: { value: new T.Vector3(0, 0, 0) }, uFocusR: { value: 0 }
    };
    const orbMat = new T.ShaderMaterial({
      uniforms: orbUniforms,
      vertexShader: `
        attribute float aElev; varying float vElev; varying vec3 vN; varying vec2 vUv; varying vec3 vW;
        void main(){ vElev=aElev; vN=normal; vUv=uv; vW=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        precision highp float;
        varying float vElev; varying vec3 vN; varying vec2 vUv; varying vec3 vW;
        uniform vec3 uSun; uniform vec3 uBg; uniform float uZones; uniform vec3 uFocus; uniform float uFocusR;
        vec3 hypso(float e){
          vec3 sea=vec3(.30,.36,.42), low=vec3(.62,.60,.40), kol=vec3(.74,.60,.38), woi=vec3(.78,.66,.34), deg=vec3(.46,.58,.34), wur=vec3(.72,.80,.84);
          vec3 c=mix(sea,low,smoothstep(-150.,60.,e));
          c=mix(c,kol,smoothstep(300.,1100.,e));
          c=mix(c,woi,smoothstep(1350.,1650.,e));
          c=mix(c,deg,smoothstep(2200.,2500.,e));
          c=mix(c,wur,smoothstep(3150.,3450.,e));
          return c;
        }
        float line(float e,float lvl){ float w=fwidth(e)*1.1+0.5; return 1.0-clamp(abs(e-lvl)/w,0.,1.); }
        void main(){
          vec3 n=normalize(vN);
          float ndl=clamp(dot(n,normalize(uSun)),0.,1.);
          float shade=0.30+0.95*ndl;
          vec3 col=hypso(vElev)*shade;
          // highlands (>=1500 m) get a warm lift so the plateau reads as one mass
          col+=vec3(.05,.035,.0)*smoothstep(1450.,1600.,vElev);
          float l15=line(vElev,1500.), l23=line(vElev,2300.), l32=line(vElev,3200.);
          col=mix(col,vec3(1.,.82,.45),l15*0.85*uZones);
          col=mix(col,vec3(.55,1.,.65),l23*0.45*uZones);
          col=mix(col,vec3(.75,.95,1.),l32*0.55*uZones);
          // fade to background at the data-window edge so the cut is not a hard cliff
          vec2 e2=min(vUv,1.0-vUv); float edge=min(e2.x*1.0,e2.y*0.8);
          col=mix(uBg,col,smoothstep(0.0,0.07,edge));
          // region focus ring
          float d=length(vW.xz-uFocus.xz); col+=vec3(.15,.85,.95)*0.55*(1.0-smoothstep(0.0,3.0,abs(d-uFocusR)))*step(0.5,uFocusR);
          gl_FragColor=vec4(col,1.0);
        }`
    });
    orbMat.extensions = { derivatives: true };
    const orbMesh = new T.Mesh(orbGeo, orbMat);
    orbMesh.frustumCulled = false;
    orbitalRoot.add(orbMesh);

    // ribbons: river (cyan, approx.) + rift (violet dashed, approx.)
    function ribbon(ptsLL, widthKm, color, dash) {
      const P = [];
      const dense = [];
      for (let i = 0; i < ptsLL.length - 1; i++) {
        const [a1, o1] = ptsLL[i], [a2, o2] = ptsLL[i + 1];
        const n = 14;
        for (let s = 0; s < n; s++) dense.push([lerp(a1, a2, s / n), lerp(o1, o2, s / n)]);
      }
      dense.push(ptsLL[ptsLL.length - 1]);
      const pos = [], ind = [];
      let vi = 0;
      for (let i = 0; i < dense.length; i++) {
        const [la, lo] = dense[i];
        const x = orbX(lo), z = orbZ(la), y = orbHeightKm(la, lo) + 0.18;
        const [la2, lo2] = dense[Math.min(i + 1, dense.length - 1)], [la0, lo0] = dense[Math.max(i - 1, 0)];
        let tx = orbX(lo2) - orbX(lo0), tz = orbZ(la2) - orbZ(la0);
        const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        pos.push(x - tz * widthKm, y, z + tx * widthKm, x + tz * widthKm, y, z - tx * widthKm);
      }
      for (let i = 0; i < dense.length - 1; i++) {
        if (dash && (i % 20) > 11) continue;
        const a = i * 2;
        ind.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.setIndex(ind);
      const m = new T.Mesh(g, new T.MeshBasicMaterial({ color, side: T.DoubleSide, transparent: true, opacity: 0.95, depthTest: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      m.frustumCulled = false;
      return m;
    }
    const riverMesh = ribbon(RIVER_PTS, 2.6, 0x28d8f0, false);
    const riftMesh = ribbon(RIFT_PTS, 3.4, 0xe8a0ff, true);
    orbitalRoot.add(riverMesh, riftMesh);
    // GERD + region pins (small vertical beacons)
    const pinMat = new T.MeshBasicMaterial({ color: 0xff9d66 });
    for (const r of REGIONS) {
      const p = new T.Mesh(new T.ConeGeometry(2.2, 9, 8), new T.MeshBasicMaterial({ color: r.id === "gerd_belaya_escarpment" ? 0xff9d66 : 0x28d8f0 }));
      p.position.set(orbX(r.lon), orbHeightKm(r.lat, r.lon) + 5.5, orbZ(r.lat));
      p.rotation.x = Math.PI;
      orbitalRoot.add(p);
    }
    // sparse star points (decor)
    {
      const n = 600, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const th = Math.random() * TAU, ph = Math.acos(2 * Math.random() - 1), R = 5200;
        a[i * 3] = Math.sin(ph) * Math.cos(th) * R; a[i * 3 + 1] = Math.abs(Math.cos(ph)) * R * 0.9 + 300; a[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * R;
      }
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(a, 3));
      const stars = new T.Points(g, new T.PointsMaterial({ color: 0xcfd8e4, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.6 }));
      stars.frustumCulled = false;
      orbitalRoot.add(stars);
    }

    /* ================= STATE ================= */
    const S = {
      mode: "orbit", // orbit | aerial | walk
      region: null, busy: false, season: 7.5, colorBy: "crop",
      fieldsOn: true, labelsOn: true, look: "raw", golden: 0.36, mist: 0.30,
      fps: 60
    };
    // Orbital camera (km units): orbit around target (x,z)
    const OC = { x: orbX(38.45), z: orbZ(10.9), dist: 1500, yaw: 0, pitch: 1.0 };
    const OC_HOME = Object.assign({}, OC);
    // Ground camera: orbit around focus
    const GC = { x: 0, y: 0, z: 0, yaw: 0.3, pitch: 0.4, dist: 900 };

    window.__abyss = { S, OC, GC, T, scene, renderer, post, camOrb, camGnd };
    $("loader-sub").textContent = "Preparing terrain pack…";

    /* ================= GROUND: pack, adapter, ecology ================= */
    const PackAPI = window.EthiopiaHighlandsPack;
    let manifestData = null, packInstance = null, activeTerrain = null, activeEcology = null;
    try { manifestData = await fetch("../ethiopia-highlands/terrain-pack/manifest.json").then(r => r.json()); } catch (e) { console.warn("[abyss] manifest", e); }

    function wrapTerrain(raw, regionId) {
      const meta = (manifestData && manifestData.regions[regionId]) || raw.activeRegion || {};
      const span = meta.worldSpanM || 2400, half = span * 0.5;
      const waterPlane = meta.waterPlane || null;
      const waterY = waterPlane && typeof waterPlane.worldY === "number" ? waterPlane.worldY : -99999;
      const tmpN = new T.Vector3();
      const sampleHeight = (x, z) => { const h = raw.sampleHeight(x, z); return Number.isFinite(h) ? h : 0; };
      const sampleNormal = (x, z, out) => {
        out = out || new T.Vector3();
        const r = raw.sampleNormal(x, z, out);
        if (r && r.isVector3) { if (r !== out) out.copy(r); return out; }
        if (Array.isArray(r)) return out.set(r[0], r[1], r[2]).normalize();
        const e = 2.5;
        return out.set(sampleHeight(x - e, z) - sampleHeight(x + e, z), 2 * e, sampleHeight(x, z - e) - sampleHeight(x, z + e)).normalize();
      };
      const sampleSlope = (x, z) => {
        const s = raw.sampleSlope(x, z);
        if (Number.isFinite(s)) return s;
        sampleNormal(x, z, tmpN); return Math.sqrt(Math.max(0, 1 - tmpN.y * tmpN.y)) / Math.max(0.05, tmpN.y);
      };
      const elevM = (x, z) => {
        const e = raw.sampleElevationMeters ? raw.sampleElevationMeters(x, z) : NaN;
        return Number.isFinite(e) ? e : meta.datumElevM + sampleHeight(x, z) / meta.verticalScale;
      };
      return {
        regionId, raw, meta, minX: -half, maxX: half, minZ: -half, maxZ: half, spanX: span, spanZ: span, waterY,
        datumElev: meta.datumElevM, vScale: meta.verticalScale, landmarks: raw.landmarks || meta.landmarks || {},
        sampleHeight, sampleNormal, sampleSlope,
        sampleRealElevM: elevM,
        sampleBiome: (x, z) => zoneOf(elevM(x, z)),
        worldToLatLon: (x, z) => raw.worldToLatLon(x, z),
        latLonToWorld: (la, lo) => raw.latLonToWorld(la, lo)
      };
    }

    /* ---- Cast: Imani + Mistletoe (+ a ploughman) ---- */
    const donkey = typeof window.makeDonkey === "function"
      ? window.makeDonkey({ assetPath: "../donkey/", shells: isNarrow ? 6 : 10, contactShadow: true, alwaysHalter: true }) : null;
    if (donkey) { donkey.state.tireless = true; castRoot.add(donkey.group); }
    const makeChar = spec => {
      if (typeof window.makeExpeditionCharacter !== "function") return null;
      try {
        const ch = window.makeExpeditionCharacter(T, Object.assign({ textureBase: "../donkey/" }, spec));
        if (ch && ch.label && ch.label.sprite) ch.label.sprite.visible = false;
        if (ch && ch.group) castRoot.add(ch.group);
        return ch;
      } catch (e) { console.warn("[abyss] character", e); return null; }
    };
    const imani = makeChar({ id: "abyss_imani", name: "Imani", skinHex: 0x3b261b, fem: 0.86, scale: 1.0, build: 1.0, hair: "croppedCoily", outer: "duster", coatHex: 0x3b403c, shirtHex: 0x5c605a, trouserHex: 0x2c3032, toolBelt: true });
    const farmer = makeChar({ id: "abyss_farmer", name: "Ploughman", skinHex: 0x3a2519, fem: 0.08, scale: 1.0, build: 1.04, hair: "turban", beard: "full", outer: "shamma", coatHex: 0xe6dfd0, shirtHex: 0x6a6358, trouserHex: 0x33312e });
    const worldBridge = window.Mesh2MotionWorldBridge
      ? window.Mesh2MotionWorldBridge.createWorldCastDriver(T, {
          clipsBaseUrl: "../motion-pipeline/mesh2motion/clips",
          preload: ["idle", "idle-talking", "walk", "walk-carry", "jog", "greeting"],
          defaultBlend: 0.85,
          defaultFade: 0.25
        })
      : null;
    if (worldBridge) {
      if (imani) worldBridge.registerActor("abyss_imani", imani, { defaultClip: "idle", blend: 0.85 });
      if (farmer) worldBridge.registerActor("abyss_farmer", farmer, { defaultClip: "walk", blend: 0.82, phaseOffset: 0.6 });
    }
    const ROPE_PTS = 12, ropeArr = new Float32Array(ROPE_PTS * 3), ropeGeo = new T.BufferGeometry();
    ropeGeo.setAttribute("position", new T.BufferAttribute(ropeArr, 3));
    const leadRope = new T.Line(ropeGeo, new T.LineBasicMaterial({ color: 0xb89d6f }));
    leadRope.frustumCulled = false; castRoot.add(leadRope);

    const player = { x: 0, y: 0, z: 0, heading: 0, speed: 0, gait: 0 };
    const keys = Object.create(null), stick = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
    function walkSurfaceAt(x, z) { return activeTerrain ? activeTerrain.sampleHeight(x, z) : 0; }

    /* ---- Atmosphere ---- */
    const sunDirVec = new T.Vector3(0.5, 0.5, 0.5);
    function applyAtmosphere() {
      if (packInstance) {
        packInstance.setGoldenHour(S.golden); packInstance.setMist(S.mist);
        if (packInstance.uniforms && packInstance.uniforms.uSunDir) sunDirVec.copy(packInstance.uniforms.uSunDir.value).normalize();
      }
      sunLight.color.setHex(0xfff4df).lerp(new T.Color(0xff9b48), S.golden * 0.78);
      sunLight.intensity = lerp(2.25, 2.65, S.golden);
      hemiLight.intensity = lerp(0.92, 0.72, S.golden);
      if (scene.fog) { scene.fog.density = lerp(0.000042, 0.00021, S.mist); }
    }

    /* ================= FIELDS (real polygons → canvas texture drape) ================= */
    const FIELD_TEX = isNarrow ? 2048 : 3072;
    const fieldCanvas = document.createElement("canvas"); fieldCanvas.width = fieldCanvas.height = FIELD_TEX;
    const fctx = fieldCanvas.getContext("2d");
    const fieldTex = new T.CanvasTexture(fieldCanvas);
    fieldTex.flipY = false; fieldTex.generateMipmaps = true; fieldTex.minFilter = T.LinearMipmapLinearFilter;
    fieldTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (T.SRGBColorSpace) fieldTex.colorSpace = T.SRGBColorSpace;
    let fieldMesh = null, fieldSet = null, fieldsDirty = false, fieldDrawT = 0;
    S.hiShape = null;
    const stripePats = [];
    function stripePattern(orientDeg) {
      const b = Math.round(((orientDeg % 180) + 180) % 180 / 15) % 12;
      if (stripePats[b]) return stripePats[b];
      const c = document.createElement("canvas"); c.width = 6; c.height = 6;
      const x = c.getContext("2d"); x.fillStyle = "rgba(0,0,0,0.20)"; x.fillRect(0, 0, 6, 1.4);
      x.fillStyle = "rgba(255,255,255,0.07)"; x.fillRect(0, 3, 6, 1.2);
      const pat = fctx.createPattern(c, "repeat");
      if (pat && pat.setTransform) pat.setTransform(new DOMMatrix().rotate(-b * 15));
      return (stripePats[b] = pat);
    }
    const _fc = new T.Color();
    function inferCrop(p, zone, regionKey) {
      const h = p.hash;
      if (zone === "kolla") return h < 0.86 ? "maize_sorghum" : "other";
      if (zone === "woina_dega") {
        if ((regionKey === "gorge" || regionKey === "metekel") && h > 0.9) return "coffee";
        return h < 0.58 ? "teff" : h < 0.8 ? "wheat" : "maize_sorghum";
      }
      if (zone === "dega") return h < 0.62 ? "barley" : h < 0.92 ? "wheat" : "teff";
      return "barley";
    }
    function fieldColor(p, out) {
      const by = S.colorBy;
      if (by === "shape") return out.set((SHAPES[p.shapeName] || SHAPES.unknown).color);
      if (by === "zone") { out.set(ZONES[p.zone].color); keyColor(CROPS.other.keys, S.season, _c2); return out.lerp(_c2, 0.28); }
      return keyColor(CROPS[p.crop].keys, S.season, out);
    }
    function drawFields() {
      fieldsDirty = false;
      fctx.clearRect(0, 0, FIELD_TEX, FIELD_TEX);
      if (!fieldSet) { fieldTex.needsUpdate = true; return; }
      const k = FIELD_TEX / activeTerrain.spanX, half = activeTerrain.spanX / 2;
      const hi = S.hiShape;
      for (let pass = 0; pass < 2; pass++) {
        for (const p of fieldSet.polys) {
          const isHi = hi && p.shapeName === hi;
          if (pass === 0 ? isHi : !isHi) continue;
          const dim = hi && !isHi;
          const n = p.x.length;
          fctx.beginPath();
          fctx.moveTo((p.x[0] + half) * k, (p.z[0] + half) * k);
          for (let i = 1; i < n; i++) fctx.lineTo((p.x[i] + half) * k, (p.z[i] + half) * k);
          fctx.closePath();
          fieldColor(p, _fc);
          fctx.fillStyle = cssRGB(_fc, dim ? 0.22 : 0.88);
          fctx.fill();
          if (!dim) {
            fctx.fillStyle = stripePattern(p.orient); fctx.fill();
            fctx.lineWidth = isHi ? 2.4 : (p.shapeName === "contour-ribbon" ? 1.5 : 0.9);
            fctx.strokeStyle = isHi ? "rgba(255,255,255,0.95)" : (S.colorBy === "shape" || p.shapeName === "contour-ribbon" ? "rgba(255,255,255,0.55)" : "rgba(20,14,8,0.55)");
            fctx.stroke();
          }
        }
      }
      fieldTex.needsUpdate = true;
    }
    function markFieldsDirty() { fieldsDirty = true; }

    function clearFields() {
      if (fieldMesh) { fieldRoot.remove(fieldMesh); fieldMesh.geometry.dispose(); fieldMesh.material.dispose(); fieldMesh = null; }
      fieldSet = null;
    }
    function buildFieldOverlayMesh() {
      const N = isNarrow ? 288 : 384, span = activeTerrain.spanX;
      const pos = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i, x = (i / (N - 1) - 0.5) * span, z = (j / (N - 1) - 0.5) * span;
        pos[k * 3] = x; pos[k * 3 + 1] = activeTerrain.sampleHeight(x, z) + 0.28; pos[k * 3 + 2] = z;
        uv[k * 2] = i / (N - 1); uv[k * 2 + 1] = j / (N - 1);
      }
      const idx = new Uint32Array((N - 1) * (N - 1) * 6); let q = 0;
      for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
        const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
        idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("uv", new T.BufferAttribute(uv, 2));
      g.setIndex(new T.BufferAttribute(idx, 1)); g.computeVertexNormals();
      const m = new T.MeshLambertMaterial({ map: fieldTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const mesh = new T.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.receiveShadow = true;
      return mesh;
    }
    async function buildFields(regionId) {
      clearFields();
      const FP = window.AbyssFieldPack;
      const r = REGION_BY_ID[regionId];
      if (!FP) { S.fieldStatus = "Field pack not loaded."; return; }
      let man = null; try { man = await FP.manifest(); } catch (e) { /* handled below */ }
      const key = man && man.regions && man.regions[r.demKey] ? r.demKey : r.fieldKey;
      let data;
      try { data = await FP.load(key); } catch (e) { S.fieldStatus = "No field data for this tile."; console.warn("[abyss] fields", e); return; }
      const b = activeTerrain.meta.bounds, span = activeTerrain.spanX, half = span / 2;
      const polys = []; let outside = 0, i = 0;
      for (const p of data.polys) {
        i++;
        const n = p.ring.length / 2, xs = new Float32Array(n), zs = new Float32Array(n);
        let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9, cx = 0, cz = 0;
        for (let k = 0; k < n; k++) {
          const lon = p.ring[2 * k], lat = p.ring[2 * k + 1];
          const x = ((lon - b.lonWest) / (b.lonEast - b.lonWest) - 0.5) * span, z = ((b.latNorth - lat) / (b.latNorth - b.latSouth) - 0.5) * span;
          xs[k] = x; zs[k] = z; cx += x; cz += z;
          if (x < minx) minx = x; if (x > maxx) maxx = x; if (z < minz) minz = z; if (z > maxz) maxz = z;
        }
        if (maxx < -half || minx > half || maxz < -half || minz > half) { outside++; continue; }
        cx /= n; cz /= n;
        const ccx = clamp(cx, -half + 1, half - 1), ccz = clamp(cz, -half + 1, half - 1);
        const zone = zoneOf(activeTerrain.sampleRealElevM(ccx, ccz));
        const o = { x: xs, z: zs, cx, cz, area: p.area, orient: p.orient, shapeName: p.shapeName, zone, hash: ((i * 2654435761) >>> 0) / 4294967296, cropName: p.cropName };
        o.cropInferred = !(CROPS[p.cropName] && p.cropName !== "other" && p.cropName !== "unknown");
        o.crop = o.cropInferred ? inferCrop(o, zone, r.fieldKey) : p.cropName;
        polys.push(o);
      }
      fieldSet = { polys, key, total: data.count, outside, license: man && man.license, source: man && man.source };
      if (polys.length) {
        fieldMesh = buildFieldOverlayMesh(); fieldRoot.add(fieldMesh);
        fieldMesh.visible = S.fieldsOn;
      }
      drawFields();
      const by = {}; for (const p of polys) by[p.shapeName] = (by[p.shapeName] || 0) + 1;
      fieldSet.byShape = by;
      S.fieldStatus = polys.length
        ? `${fmt(polys.length)} real field polygons inside this ${fmt(activeTerrain.meta.horizontalSpanKm || 6.4, 1)} km real-DEM tile (Fields of The World, 10 m Sentinel-2 model, CC-BY-4.0).`
        : `No field polygons fall inside this DEM tile (pack '${key}' window lies outside it).`;
    }

    /* ================= GROUND EXTRAS (stylized): church forest, stone bunds, ox-plough ================= */
    let extras = null;
    function disposeExtras() {
      if (!extras) return;
      extrasRoot.remove(extras.group);
      extras.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      extras = null;
    }
    function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    function buildOx() {
      const g = new T.Group();
      const hide = new T.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9 });
      const dark = new T.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.9 });
      const horn = new T.MeshStandardMaterial({ color: 0xd9cfb8, roughness: 0.6 });
      const sph = (r, sx, sy, sz, m) => { const q = new T.Mesh(new T.SphereGeometry(r, 14, 10), m); q.scale.set(sx, sy, sz); q.castShadow = true; return q; };
      const body = sph(0.5, 1.0, 0.82, 1.9, hide); body.position.set(0, 1.05, 0); g.add(body);
      const hump = sph(0.28, 1, 0.9, 1.2, hide); hump.position.set(0, 1.5, 0.45); g.add(hump);
      const neck = sph(0.3, 0.9, 0.9, 1.4, hide); neck.position.set(0, 1.18, 0.95); neck.rotation.x = -0.5; g.add(neck);
      const head = sph(0.22, 0.85, 0.85, 1.35, hide); head.position.set(0, 1.0, 1.35); head.rotation.x = 0.45; g.add(head);
      const muzzle = sph(0.12, 1, 0.8, 1, dark); muzzle.position.set(0, 0.82, 1.58); g.add(muzzle);
      for (const sx of [-1, 1]) {
        const h = new T.Mesh(new T.TorusGeometry(0.2, 0.03, 6, 12, Math.PI * 0.85), horn);
        h.position.set(sx * 0.2, 1.22, 1.3); h.rotation.set(0.2, 0, sx * 1.3); g.add(h);
        const ear = sph(0.07, 1.5, 0.4, 0.8, hide); ear.position.set(sx * 0.27, 1.12, 1.24); g.add(ear);
      }
      const legs = [];
      for (const [lx, lz] of [[-0.26, 0.62], [0.26, 0.62], [-0.26, -0.62], [0.26, -0.62]]) {
        const pivot = new T.Group(); pivot.position.set(lx, 0.8, lz);
        const up = new T.Mesh(new T.CylinderGeometry(0.1, 0.07, 0.5, 8), hide); up.position.y = -0.22; up.castShadow = true;
        const lo = new T.Mesh(new T.CylinderGeometry(0.055, 0.045, 0.5, 8), dark); lo.position.y = -0.62; lo.castShadow = true;
        pivot.add(up, lo); g.add(pivot); legs.push(pivot);
      }
      const tail = new T.Mesh(new T.CylinderGeometry(0.02, 0.01, 0.8, 5), dark); tail.position.set(0, 1.0, -1.0); tail.rotation.x = 0.3; g.add(tail);
      g.userData.legs = legs;
      return g;
    }
    function buildPlough() {
      const g = new T.Group();
      const wood = new T.MeshStandardMaterial({ color: 0x6c4c32, roughness: 0.85 });
      const iron = new T.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.5, metalness: 0.6 });
      const bar = (a, b, r, m) => { const va = new T.Vector3(...a), vb = new T.Vector3(...b), d = vb.clone().sub(va); const c = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 6), m); c.position.copy(va).lerp(vb, 0.5); c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); c.castShadow = true; g.add(c); };
      bar([0, 1.35, 0.2], [0, 0.55, -1.6], 0.04, wood);      // beam (maresha)
      bar([0, 0.5, -1.6], [0, 0.05, -1.25], 0.035, wood);    // sole/share post
      bar([0, 0.5, -1.55], [0, 1.15, -2.3], 0.03, wood);     // stilt (handle)
      const share = new T.Mesh(new T.ConeGeometry(0.06, 0.32, 5), iron); share.rotation.x = -Math.PI / 2; share.position.set(0, 0.04, -1.1); g.add(share);
      bar([-0.55, 1.4, 0.15], [0.55, 1.4, 0.15], 0.035, wood); // yoke
      return g;
    }
    function buildExtras(spawn) {
      disposeExtras();
      const grp = new T.Group(); grp.name = "GroundExtras";
      const rng = mulberry(7 + (spawn.x * 13 | 0) + (spawn.z * 7 | 0));
      const h = (x, z) => activeTerrain.sampleHeight(x, z), sl = (x, z) => activeTerrain.sampleSlope(x, z);
      const half = activeTerrain.spanX / 2 - 30;
      const out = { group: grp, ox: null, plough: null, ploughLine: null, bunds: null };

      // --- church forest ring ---
      let best = null, bestS = 1e9;
      for (let a = 0; a < 28; a++) {
        const ang = a / 28 * TAU, rr = 58;
        const cx = clamp(spawn.x + Math.cos(ang) * rr, -half, half), cz = clamp(spawn.z + Math.sin(ang) * rr, -half, half);
        let s = 0; for (let k = 0; k < 8; k++) s += sl(cx + Math.cos(k * 0.785) * 22, cz + Math.sin(k * 0.785) * 22);
        s += (h(cx, cz) <= activeTerrain.waterY + 3 ? 99 : 0);
        if (s < bestS) { bestS = s; best = { x: cx, z: cz }; }
      }
      if (best) {
        const cy = h(best.x, best.z);
        const nT = isNarrow ? 70 : 120;
        const trunkG = new T.CylinderGeometry(0.22, 0.4, 1, 6); trunkG.translate(0, 0.5, 0);
        const canG = new T.IcosahedronGeometry(1, 1);
        const trunks = new T.InstancedMesh(trunkG, new T.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.95 }), nT);
        const crowns = new T.InstancedMesh(canG, new T.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.92 }), nT * 2);
        const m4 = new T.Matrix4(), qq = new T.Quaternion(), sc = new T.Vector3(), pp = new T.Vector3(), cc = new T.Color();
        let ci = 0;
        for (let i = 0; i < nT; i++) {
          const ang = rng() * TAU, rad = 18 + Math.pow(rng(), 0.6) * 15 + (rng() < 0.18 ? rng() * 10 : 0);
          const x = best.x + Math.cos(ang) * rad, z = best.z + Math.sin(ang) * rad;
          if (Math.abs(x) > half || Math.abs(z) > half) { trunks.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; }
          const y = h(x, z), th = 7 + rng() * 9;
          qq.setFromAxisAngle(new T.Vector3(0, 1, 0), rng() * TAU);
          m4.compose(pp.set(x, y - 0.1, z), qq, sc.set(1, th * 0.55, 1)); trunks.setMatrixAt(i, m4);
          for (let c = 0; c < 2; c++) {
            const r = 2.6 + rng() * 2.4;
            m4.compose(pp.set(x + (rng() - 0.5) * 2, y + th * (0.72 + c * 0.14), z + (rng() - 0.5) * 2), qq, sc.set(r * 1.05, r * 0.78, r * 1.05));
            crowns.setMatrixAt(ci, m4); cc.setHSL(0.27 + rng() * 0.05, 0.38 + rng() * 0.12, 0.2 + rng() * 0.1); crowns.setColorAt(ci, cc); ci++;
          }
        }
        crowns.count = ci;
        trunks.castShadow = crowns.castShadow = true;
        grp.add(trunks, crowns);
        // round church (maqdas): stone drum + tin/thatch cone + cross
        const church = new T.Group(); church.position.set(best.x, cy, best.z);
        const stone = new T.MeshStandardMaterial({ color: 0x9a8a72, roughness: 0.95 });
        const roof = new T.MeshStandardMaterial({ color: 0x7a5d3c, roughness: 0.9 });
        const drum = new T.Mesh(new T.CylinderGeometry(4.6, 4.9, 3.6, 18), stone); drum.position.y = 1.8; drum.castShadow = true;
        const inner = new T.Mesh(new T.CylinderGeometry(2.8, 2.9, 5.6, 14), stone); inner.position.y = 2.8;
        const cone = new T.Mesh(new T.ConeGeometry(5.5, 3.6, 18), roof); cone.position.y = 5.6; cone.castShadow = true;
        const cone2 = new T.Mesh(new T.ConeGeometry(3.2, 2.4, 14), roof); cone2.position.y = 8.0;
        const crossM = new T.MeshStandardMaterial({ color: 0xd0a854, metalness: 0.7, roughness: 0.4 });
        const cv = new T.Mesh(new T.BoxGeometry(0.1, 1.5, 0.1), crossM); cv.position.y = 9.9;
        const ch2 = new T.Mesh(new T.BoxGeometry(0.8, 0.1, 0.1), crossM); ch2.position.y = 10.1;
        church.add(drum, inner, cone, cone2, cv, ch2);
        grp.add(church);
        out.church = { x: best.x, z: best.z };
      }

      // --- stone bunds along contours ---
      let bs = null;
      for (let t = 0; t < 400; t++) {
        const x = clamp(spawn.x + (rng() - 0.5) * 320, -half, half), z = clamp(spawn.z + (rng() - 0.5) * 320, -half, half);
        const s = sl(x, z);
        if (s > 0.14 && s < 0.45 && h(x, z) > activeTerrain.waterY + 3) { const d = Math.hypot(x - spawn.x, z - spawn.z); if (!bs || d < bs.d) bs = { x, z, d }; }
      }
      if (bs) {
        out.bunds = { x: bs.x, z: bs.z - 4 };
        const rockG = new T.DodecahedronGeometry(1, 0);
        const total = isNarrow ? 160 : 300;
        const rocks = new T.InstancedMesh(rockG, new T.MeshStandardMaterial({ color: 0x8b8272, roughness: 0.96, flatShading: true }), total);
        const m4 = new T.Matrix4(), qq = new T.Quaternion(), eu = new T.Euler(), sc = new T.Vector3(), pp = new T.Vector3(), cc = new T.Color();
        let ri = 0; const nb = 5, per = Math.floor(total / nb);
        const gtmp = new T.Vector3();
        for (let b = 0; b < nb && ri < total; b++) {
          // walk downslope b*7 m, then trace a contour
          let x = bs.x, z = bs.z;
          for (let k = 0; k < b * 6; k++) { activeTerrain.sampleNormal(x, z, gtmp); const gl = Math.hypot(gtmp.x, gtmp.z) || 1; x += gtmp.x / gl * 1.2; z += gtmp.z / gl * 1.2; }
          const y0 = h(x, z);
          for (let k = 0; k < per && ri < total; k++) {
            activeTerrain.sampleNormal(x, z, gtmp);
            let gx = gtmp.x, gz = gtmp.z; const gl = Math.hypot(gx, gz) || 1; gx /= gl; gz /= gl; // downslope dir
            // step along contour (perpendicular to gradient), correct height drift
            x += -gz * 0.32; z += gx * 0.32;
            const dy = h(x, z) - y0; const slp = Math.max(0.08, sl(x, z));
            x -= gx * (dy / slp) * 0.6; z -= gz * (dy / slp) * 0.6;
            if (Math.abs(x) > half || Math.abs(z) > half) break;
            const y = h(x, z), row = (k % 3) === 2 ? 1 : 0;
            const s = 0.28 + rng() * 0.22;
            eu.set(rng() * 0.6, rng() * TAU, rng() * 0.6); qq.setFromEuler(eu);
            m4.compose(pp.set(x + (rng() - 0.5) * 0.15, y + 0.1 + row * 0.22, z + (rng() - 0.5) * 0.15), qq, sc.set(s * 1.5, s * 0.8, s * 1.1));
            rocks.setMatrixAt(ri, m4); cc.setHSL(0.09, 0.08 + rng() * 0.06, 0.38 + rng() * 0.14); rocks.setColorAt(ri, cc); ri++;
          }
        }
        rocks.count = ri; rocks.castShadow = true; rocks.receiveShadow = true;
        grp.add(rocks);
      }

      // --- ox-plough on the field nearest the spawn ---
      let tgt = null;
      if (fieldSet) {
        let bd = 1e9;
        for (const p of fieldSet.polys) {
          if (p.area < 2500 || p.area > 40000) continue;
          const d = Math.hypot(p.cx - spawn.x, p.cz - spawn.z);
          if (d > 25 && d < bd && Math.abs(p.cx) < half && Math.abs(p.cz) < half && sl(p.cx, p.cz) < 0.3) { bd = d; tgt = p; }
        }
      }
      const px = tgt ? tgt.cx : spawn.x + 22, pz = tgt ? tgt.cz : spawn.z + 14;
      const ang = tgt ? -tgt.orient * DEG : 0.4;
      const ux = Math.cos(ang), uz = Math.sin(ang);
      const L = tgt ? clamp(Math.sqrt(tgt.area) * 0.5, 8, 22) : 12;
      out.ploughLine = { ax: px - ux * L, az: pz - uz * L, bx: px + ux * L, bz: pz + uz * L, L: L * 2 };
      const oxA = buildOx(), oxB = buildOx(), plough = buildPlough();
      oxB.position.x = 1.1; // set in a pair; moved as a unit
      const team = new T.Group(); oxA.position.x = -0.55; oxB.position.x = 0.55;
      team.add(oxA, oxB, plough); plough.position.set(0, 0, -1.9);
      team.visible = true; grp.add(team);
      out.team = team; out.ox = [oxA, oxB]; out.ploughPhase = 0;
      extrasRoot.add(grp);
      extras = out;
      return out;
    }
    function stepExtras(dt, nowSec) {
      if (!extras || !extras.team) return;
      const L = extras.ploughLine;
      extras.ploughPhase = (extras.ploughPhase + dt * 0.62 / L.L) % 2;      // ~0.62 m/s, there and back
      const f = extras.ploughPhase < 1 ? extras.ploughPhase : 2 - extras.ploughPhase;
      const dirSign = extras.ploughPhase < 1 ? 1 : -1;
      const x = lerp(L.ax, L.bx, f), z = lerp(L.az, L.bz, f);
      const heading = Math.atan2((L.bx - L.ax) * dirSign, (L.bz - L.az) * dirSign);
      const y = walkSurfaceAt(x, z);
      extras.team.position.set(x, y, z);
      extras.team.rotation.y = heading;
      const ph = nowSec * 3.2;
      extras.ox.forEach((o, i) => o.userData.legs.forEach((lg, k) => { lg.rotation.x = Math.sin(ph + (k % 2) * Math.PI + i * 0.7) * 0.32; }));
      if (farmer) {
        const fx = x - Math.sin(heading) * 4.1, fz = z - Math.cos(heading) * 4.1;
        farmer.place(fx, fz, heading, walkSurfaceAt);
        farmer.update(dt, nowSec, { pose: "walk", gaitPhase: ph * 0.8, walkRate: 3.2, stepLen: 0.2, surfaceAt: walkSurfaceAt, lodDist: Math.hypot(camGnd.position.x - fx, camGnd.position.z - fz) });
      }
    }

    /* ================= REGION LOADING / STAGING ================= */
    let loadToken = 0;
    function setLoader(t) { const e = $("loader-sub"); if (e) e.textContent = t; }
    function pickSpawn(regionId) {
      const r = REGION_BY_ID[regionId], lm = (activeEcology && activeEcology.landmarks) || {};
      const half = activeTerrain.spanX / 2 - 40;
      let spawn = null, yaw = r.yaw;
      if (fieldSet && fieldSet.polys.length > 8) {
        // densest gentle-slope cluster of fields (bucket count within ~110 m)
        const B = 110, cells = new Map(), key = (i, j) => i * 100003 + j;
        for (const p of fieldSet.polys) { const k = key(Math.floor(p.cx / B), Math.floor(p.cz / B)); cells.set(k, (cells.get(k) || 0) + 1); }
        let bs = -1;
        for (const p of fieldSet.polys) {
          if (Math.abs(p.cx) > half || Math.abs(p.cz) > half || p.area < 1500) continue;
          const s = activeTerrain.sampleSlope(p.cx, p.cz);
          if (s > 0.3 || activeTerrain.sampleHeight(p.cx, p.cz) < activeTerrain.waterY + 3) continue;
          const i = Math.floor(p.cx / B), j = Math.floor(p.cz / B);
          let n = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) n += cells.get(key(i + a, j + b)) || 0;
          const sc = n - s * 40 - Math.hypot(p.cx, p.cz) * 0.01;
          if (sc > bs) { bs = sc; spawn = { x: p.cx, z: p.cz }; }
        }
      }
      if (!spawn) {
        const pl = lm.primaryLookout || { x: 0, z: 0 };
        spawn = { x: pl.x, z: pl.z };
        if (regionId === "simien_imet_gogo") { spawn = { x: 6, z: -434 }; yaw = 0.56; }
      }
      return { spawn, yaw };
    }
    function stageCast(spawn, yaw) {
      player.x = spawn.x; player.z = spawn.z; player.y = walkSurfaceAt(spawn.x, spawn.z);
      player.heading = wrapAngle(yaw + Math.PI * 0.82); player.speed = 0;
      GC.yaw = yaw;
      if (imani) imani.place(player.x, player.z, player.heading, walkSurfaceAt);
      if (donkey) donkey.place(player.x + Math.cos(yaw) * 1.35 + Math.sin(yaw) * 0.45, player.z - Math.sin(yaw) * 1.35 + Math.cos(yaw) * 0.45, player.heading - 0.18, walkSurfaceAt);
    }
    async function loadRegion(regionId) {
      const token = ++loadToken;
      S.regionLoading = regionId;
      setLoader(`Loading real-DEM tile · ${REGION_BY_ID[regionId].title}`);
      if (activeEcology) { ecologyRoot.remove(activeEcology.root); try { activeEcology.dispose(); } catch (e) { /* ignore */ } activeEcology = null; }
      disposeExtras(); clearFields();
      if (!PackAPI) throw new Error("EthiopiaHighlandsPack missing");
      if (!packInstance) {
        packInstance = await PackAPI.create(T, { baseUrl: "../ethiopia-highlands/terrain-pack/", region: regionId, goldenHour: S.golden, mist: S.mist, includeSky: true });
        terrainRoot.add(packInstance.group);
      } else { await packInstance.loadRegion(regionId); }
      if (token !== loadToken) return null;
      activeTerrain = wrapTerrain(packInstance, regionId);
      if (window.EthiopiaEndemicFauna) { activeEcology = window.EthiopiaEndemicFauna.createEndemicWorld(T, activeTerrain); ecologyRoot.add(activeEcology.root); }
      await buildFields(regionId);
      if (token !== loadToken) return null;
      const ps = pickSpawn(regionId);
      GC.x = ps.spawn.x; GC.z = ps.spawn.z; GC.y = walkSurfaceAt(ps.spawn.x, ps.spawn.z);
      stageCast(ps.spawn, ps.yaw);
      buildExtras(ps.spawn);
      S.region = regionId; S.spawn = ps.spawn; S.aerialYaw = ps.yaw;
      applyAtmosphere();
      refreshLegend(); refreshCompareIfOpen();
      return regionId;
    }

    /* ================= VISIBILITY / MODES ================= */
    const fogColor = new T.Color(0xc4d4e4);
    function applyVisibility() {
      const orbit = S.mode === "orbit";
      orbitalRoot.visible = orbit;
      terrainRoot.visible = ecologyRoot.visible = castRoot.visible = extrasRoot.visible = !orbit;
      fieldRoot.visible = !orbit && S.fieldsOn;
      if (orbit) { scene.fog = null; scene.background = BG_ORBIT; camera = camOrb; }
      else { if (!scene.fog) scene.fog = new T.FogExp2(fogColor.getHex(), 0.00008); scene.background = fogColor; camera = camGnd; applyAtmosphere(); }
      hemiLight.visible = sunLight.visible = !orbit;
      $("stylized-note").textContent = orbit
        ? "STYLIZED orbital view · real elevations, 6× vertical exaggeration · river & rift lines approximate"
        : "REAL DEM + real field polygons · trees, oxen, bunds, church ring & season colours are STYLIZED";
      $("btn-ground").hidden = orbit;
      jumpRow.hidden = S.mode !== "walk";
      $("btn-ground").textContent = S.mode === "walk" ? "Aerial ▴" : "Walk ▾";
      $("mobile-pad").classList.toggle("on", S.mode === "walk");
      document.body.dataset.mode = S.mode;
      syncStagePills();
    }
    const fadeEl = $("fade");
    function fade(on) { fadeEl.classList.toggle("on", on); return new Promise(r => setTimeout(r, 580)); }
    const tweens = [];
    function tween(dur, fn) { return new Promise(res => { tweens.push({ t0: performance.now(), dur: dur * 1000, fn, res }); }); }
    function stepTweens() {
      const now = performance.now();
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i], u = clamp((now - tw.t0) / tw.dur, 0, 1);
        tw.fn(ease(u), u);
        if (u >= 1) { tweens.splice(i, 1); tw.res(); }
      }
    }
    function orbitTarget(r) { return { x: orbX(r.lon_c !== undefined ? r.lon_c : r.lon), z: orbZ(r.lat_c !== undefined ? r.lat_c : r.lat) }; }
    function regionCenterLL(id) {
      const b = manifestData && manifestData.regions[id] && manifestData.regions[id].bounds;
      const r = REGION_BY_ID[id];
      return b ? { lat: (b.latSouth + b.latNorth) / 2, lon: (b.lonWest + b.lonEast) / 2 } : { lat: r.lat, lon: r.lon };
    }
    function setOrbitAt(id, dist, pitch) { const c = regionCenterLL(id); OC.x = orbX(c.lon); OC.z = orbZ(c.lat); OC.dist = dist; OC.pitch = pitch; }

    async function diveTo(regionId, opts = {}) {
      if (S.busy || !REGION_BY_ID[regionId]) return;
      S.busy = true;
      try {
        const c = regionCenterLL(regionId);
        const loadP = loadRegion(regionId).catch(e => { console.error("[abyss] load", e); throw e; });
        if (S.mode !== "orbit") {   // coming from the ground: rise to orbit first
          await fade(true);
          S.mode = "orbit"; applyVisibility(); setOrbitAt(regionId, 60, 0.7); OC.yaw = 0;
          await fade(false);
        }
        const from = { x: OC.x, z: OC.z, d: OC.dist, p: OC.pitch, y: OC.yaw };
        const tx = orbX(c.lon), tz = orbZ(c.lat);
        orbUniforms.uFocus.value.set(tx, 0, tz); orbUniforms.uFocusR.value = 9;
        await tween(opts.fast ? 0.2 : 2.4, e => { OC.x = lerp(from.x, tx, e); OC.z = lerp(from.z, tz, e); OC.dist = Math.exp(lerp(Math.log(from.d), Math.log(14), e)); OC.pitch = lerp(from.p, 0.55, e); OC.yaw = lerp(from.y, 0.0, e); });
        await loadP;
        setLoader("");
        await fade(true);
        orbUniforms.uFocusR.value = 0;
        S.mode = "aerial";
        GC.dist = 3400; GC.pitch = 0.62; GC.yaw = S.aerialYaw;
        applyVisibility(); syncRegionUI();
        await fade(false);
        const d0 = GC.dist, p0 = GC.pitch;
        await tween(opts.fast ? 0.2 : 2.6, e => { GC.dist = lerp(d0, 1150, e); GC.pitch = lerp(p0, 0.5, e); });
      } finally { S.busy = false; }
    }
    async function toOrbit() {
      if (S.busy) return; S.busy = true;
      try {
        await fade(true);
        const id = S.region || "simien_imet_gogo";
        S.mode = "orbit"; applyVisibility(); setOrbitAt(id, 22, 0.55); OC.yaw = 0; syncRegionUI();
        await fade(false);
        const from = { x: OC.x, z: OC.z, d: OC.dist, p: OC.pitch };
        await tween(2.4, e => { OC.x = lerp(from.x, OC_HOME.x, e); OC.z = lerp(from.z, OC_HOME.z, e); OC.dist = Math.exp(lerp(Math.log(from.d), Math.log(OC_HOME.dist), e)); OC.pitch = lerp(from.p, OC_HOME.pitch, e); });
      } finally { S.busy = false; }
    }
    async function dropToWalk() {
      if (S.busy || S.mode === "orbit") return;
      S.busy = true;
      try {
        if (S.mode === "walk") {   // back up to aerial
          const f = { x: GC.x, z: GC.z, d: GC.dist, p: GC.pitch };
          S.mode = "aerial"; applyVisibility();
          await tween(1.8, e => { GC.dist = lerp(f.d, 700, e); GC.pitch = lerp(f.p, 0.62, e); });
        } else {
          const f = { x: GC.x, y: GC.y, z: GC.z, d: GC.dist, p: GC.pitch };
          const tx = player.x, tz = player.z, ty = walkSurfaceAt(tx, tz) + 1.38;
          await tween(3.2, e => {
            GC.x = lerp(f.x, tx, e); GC.z = lerp(f.z, tz, e); GC.y = lerp(f.y, ty, e);
            GC.dist = Math.exp(lerp(Math.log(f.d), Math.log(8.6), e)); GC.pitch = lerp(f.p, 0.24, e);
          });
          S.mode = "walk"; applyVisibility();
        }
      } finally { S.busy = false; }
    }

    /* ================= CAMERAS ================= */
    const _v = new T.Vector3();
    function updateOrbitCam() {
      const ty = orbHeightAtXZ(OC.x, OC.z);
      const cp = Math.cos(OC.pitch);
      let cx = OC.x + Math.sin(OC.yaw) * cp * OC.dist, cz = OC.z + Math.cos(OC.yaw) * cp * OC.dist;
      let cy = ty + Math.sin(OC.pitch) * OC.dist;
      cy = Math.max(cy, orbHeightAtXZ(cx, cz) + 1.5);
      camOrb.position.set(cx, cy, cz); camOrb.lookAt(OC.x, ty, OC.z);
      camOrb.near = Math.max(0.2, OC.dist * 0.01); camOrb.far = 8000; camOrb.updateProjectionMatrix();
    }
    function updateGroundCam(dt) {
      if (!activeTerrain) return;
      if (S.mode === "aerial" && !S.busy) GC.y = lerp(GC.y, walkSurfaceAt(GC.x, GC.z), 0.2);
      const cp = Math.cos(GC.pitch);
      const cx = GC.x + Math.sin(GC.yaw) * cp * GC.dist, cz = GC.z + Math.cos(GC.yaw) * cp * GC.dist;
      const cy = Math.max(GC.y + Math.sin(GC.pitch) * GC.dist, walkSurfaceAt(cx, cz) + (S.mode === "walk" ? 0.85 : 6));
      camGnd.position.set(cx, cy, cz); camGnd.lookAt(GC.x, GC.y, GC.z);
    }
    function stepWalk(dt, nowSec) {
      const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - stick.dy;
      const str = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stick.dx;
      const mag = Math.min(1, Math.hypot(fwd, str)), sprint = keys.ShiftLeft || keys.ShiftRight ? 1.55 : 1;
      if (mag > 0.05 && !S.busy) {
        const md = Math.atan2(-Math.sin(GC.yaw) * fwd + Math.cos(GC.yaw) * str, -Math.cos(GC.yaw) * fwd - Math.sin(GC.yaw) * str);
        player.heading = wrapAngle(player.heading + clamp(wrapAngle(md - player.heading), -7.5 * dt, 7.5 * dt));
        player.speed = lerp(player.speed, 3.8 * sprint * mag, dt * 6.5);
        const nx = clamp(player.x + Math.sin(player.heading) * player.speed * dt, activeTerrain.minX + 12, activeTerrain.maxX - 12);
        const nz = clamp(player.z + Math.cos(player.heading) * player.speed * dt, activeTerrain.minZ + 12, activeTerrain.maxZ - 12);
        if (activeTerrain.sampleSlope(nx, nz) < 0.66 && walkSurfaceAt(nx, nz) > activeTerrain.waterY + 1.1) { player.x = nx; player.z = nz; }
      } else player.speed = lerp(player.speed, 0, dt * 8);
      player.y = walkSurfaceAt(player.x, player.z);
    }
    const hand = new T.Vector3(), halter = new T.Vector3();
    function stepCast(dt, nowSec) {
      const walking = player.speed > 0.14;
      if (imani) {
        imani.place(player.x, player.z, player.heading, walkSurfaceAt);
        if (walking) { player.gait += dt * (3.6 + player.speed * 1.15); imani.update(dt, nowSec, { pose: "walk", gaitPhase: player.gait, walkRate: 4.8, stepLen: clamp(0.18 + player.speed * 0.035, 0.18, 0.31), surfaceAt: walkSurfaceAt, lodDist: GC.dist }); }
        else imani.update(dt, nowSec, { pose: "idle", carryCan: true, surfaceAt: walkSurfaceAt, lookAt: donkey ? donkey.group.position : camGnd.position, lodDist: GC.dist });
      }
      if (donkey) {
        const fx = player.x - Math.sin(player.heading) * 1.75 + Math.cos(player.heading) * 1.15, fz = player.z - Math.cos(player.heading) * 1.75 - Math.sin(player.heading) * 1.15;
        const dx = fx - donkey.state.x, dz = fz - donkey.state.z, dist = Math.hypot(dx, dz);
        let throttle = 0, steer = 0, pace = 0;
        if (dist > 0.65) { steer = clamp(wrapAngle(Math.atan2(dx, dz) - donkey.state.heading) * 1.35, -1, 1); throttle = clamp((dist - 0.55) * 0.65, 0, 1); pace = dist > 4.2 ? 1 : 0; }
        donkey.update(dt, { throttle, steer, pace, near: dist < 2.6 }, walkSurfaceAt);
        if (imani && donkey.halterRing) {
          donkey.halterRing(halter);
          hand.set(player.x + Math.cos(player.heading) * 0.28 + Math.sin(player.heading) * 0.12, player.y + 0.94, player.z - Math.sin(player.heading) * 0.28 + Math.cos(player.heading) * 0.12);
          const sag = clamp(0.26 - dist * 0.04, 0.05, 0.28);
          for (let i = 0; i < ROPE_PTS; i++) { const f = i / (ROPE_PTS - 1); ropeArr[i * 3] = lerp(hand.x, halter.x, f); ropeArr[i * 3 + 1] = lerp(hand.y, halter.y, f) - Math.sin(f * Math.PI) * sag; ropeArr[i * 3 + 2] = lerp(hand.z, halter.z, f); }
          ropeGeo.attributes.position.needsUpdate = true;
        }
      }
    }

    /* ================= INPUT ================= */
    const ptrs = new Map(); let lastPinch = 0, dragMoved = 0;
    canvas.addEventListener("pointerdown", e => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, shift: e.shiftKey || e.button === 2 }); try { canvas.setPointerCapture(e.pointerId); } catch (_e) { /* ignore */ } lastPinch = 0; dragMoved = 0; });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    canvas.addEventListener("pointermove", e => {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.has = true;
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; dragMoved += Math.abs(dx) + Math.abs(dy);
      if (ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastPinch) zoomBy(lastPinch / d); lastPinch = d; return;
      }
      if (S.busy) return;
      if (S.mode === "orbit") {
        if (p.shift) { const k = OC.dist * 0.0016; OC.x -= (Math.cos(OC.yaw) * dx + Math.sin(OC.yaw) * dy) * k; OC.z -= (-Math.sin(OC.yaw) * dx + Math.cos(OC.yaw) * dy) * k; }
        else { OC.yaw = wrapAngle(OC.yaw - dx * 0.0055); OC.pitch = clamp(OC.pitch + dy * 0.0045, 0.12, 1.5); }
      } else {
        GC.yaw = wrapAngle(GC.yaw - dx * 0.0055); GC.pitch = clamp(GC.pitch + dy * 0.0045, S.mode === "walk" ? -0.1 : 0.12, 1.45);
      }
    });
    const endPtr = e => { ptrs.delete(e.pointerId); lastPinch = 0; };
    canvas.addEventListener("pointerup", endPtr); canvas.addEventListener("pointercancel", endPtr);
    function zoomBy(f) {
      if (S.busy) return;
      if (S.mode === "orbit") OC.dist = clamp(OC.dist * f, 40, 2400);
      else if (S.mode === "aerial") GC.dist = clamp(GC.dist * f, 60, 4200);
      else GC.dist = clamp(GC.dist * f, 2.2, 68);
    }
    canvas.addEventListener("wheel", e => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    const padEl = $("mobile-pad"), knobEl = $("mobile-knob");
    padEl.addEventListener("pointerdown", e => { e.stopPropagation(); stick.active = true; stick.id = e.pointerId; const r = padEl.getBoundingClientRect(); stick.ox = r.left + r.width / 2; stick.oy = r.top + r.height / 2; try { padEl.setPointerCapture(e.pointerId); } catch (_e) { /* ignore */ } });
    padEl.addEventListener("pointermove", e => {
      if (!stick.active || e.pointerId !== stick.id) return;
      const rx = e.clientX - stick.ox, ry = e.clientY - stick.oy, d = Math.hypot(rx, ry) || 1, cl = Math.min(30, d), nx = rx / d * cl, ny = ry / d * cl;
      stick.dx = nx / 30; stick.dy = ny / 30; knobEl.style.transform = `translate(${nx.toFixed(1)}px,${ny.toFixed(1)}px)`;
    });
    const resetPad = () => { stick.active = false; stick.dx = stick.dy = 0; knobEl.style.transform = "translate(0,0)"; };
    padEl.addEventListener("pointerup", resetPad); padEl.addEventListener("pointercancel", resetPad);
    window.addEventListener("keydown", e => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      keys[e.code] = true;
      if (e.code === "Digit0") toOrbit();
      else if (/^Digit[1-4]$/.test(e.code)) diveTo(REGIONS[+e.code.slice(5) - 1].id);
      else if (e.code === "KeyV") dropToWalk();
    });
    window.addEventListener("keyup", e => { keys[e.code] = false; });
    window.addEventListener("resize", () => {
      const w = window.innerWidth, h = Math.max(1, window.innerHeight);
      renderer.setSize(w, h, false); camOrb.aspect = camGnd.aspect = w / h; camOrb.updateProjectionMatrix(); camGnd.updateProjectionMatrix();
      if (post && post.syncSize) post.syncSize(w, h);
    });
    const mouse = { x: 0, y: 0, has: false };
    const dockEl = document.querySelector(".dock");
    const syncDock = () => document.documentElement.style.setProperty("--dock-h", dockEl.offsetHeight + "px");
    if (window.ResizeObserver) new ResizeObserver(syncDock).observe(dockEl); syncDock();

    function stepAerialPan(dt) {
      if (S.mode !== "aerial" || S.busy) return;
      const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      if (!f && !s) return;
      const sp = GC.dist * 0.5 * dt;
      GC.x = clamp(GC.x + (-Math.sin(GC.yaw) * f + Math.cos(GC.yaw) * s) * sp, activeTerrain.minX + 40, activeTerrain.maxX - 40);
      GC.z = clamp(GC.z + (-Math.cos(GC.yaw) * f - Math.sin(GC.yaw) * s) * sp, activeTerrain.minZ + 40, activeTerrain.maxZ - 40);
      // keep the walking party at the focus when we return to walk
    }

    /* ================= LABELS & HUD ================= */
    const labelsEl = $("labels");
    const labelObjs = MAP_LABELS.map(L => {
      const el = document.createElement("div");
      el.className = "lbl k-" + L.k + (L.region ? " k-region" : "");
      el.innerHTML = `${L.t}<small>${L.s}</small>`;
      if (L.region) { el.style.pointerEvents = "auto"; el.style.cursor = "pointer"; el.addEventListener("click", () => diveTo(L.region)); el.title = "Dive to this region"; }
      labelsEl.appendChild(el);
      const x = orbX(L.lon), z = orbZ(L.lat);
      const y = orbHeightKm(L.lat, L.lon) + (L.k === "gerd" || L.region ? 8 : 4);
      return { L, el, pos: new T.Vector3(x, y, z) };
    });
    function updateLabels() {
      labelsEl.classList.toggle("far", OC.dist > 1000);
      const show = S.mode === "orbit" && S.labelsOn;
      const w = window.innerWidth, h = window.innerHeight;
      for (const o of labelObjs) {
        if (!show) { if (!o.hidden) { o.el.classList.add("hidden"); o.hidden = true; } continue; }
        _v.copy(o.pos).project(camOrb);
        const vis = _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05 && !(o.L.mind && OC.dist < o.L.mind) && !(o.L.maxd && OC.dist > o.L.maxd);
        if (!vis) { if (!o.hidden) { o.el.classList.add("hidden"); o.hidden = true; } continue; }
        if (o.hidden) { o.el.classList.remove("hidden"); o.hidden = false; }
        o.el.style.transform = `translate3d(${((_v.x * 0.5 + 0.5) * w).toFixed(1)}px,${((-_v.y * 0.5 + 0.5) * h).toFixed(1)}px,0) translate(-50%,-100%)`;
      }
    }
    const _ray = new T.Vector3(), _ro = new T.Vector3();
    function pickOrbit(px, py) {
      _ro.copy(camOrb.position);
      _ray.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1, 0.5).unproject(camOrb).sub(_ro).normalize();
      let t = 0, prevT = 0; const maxT = OC.dist * 3 + 400;
      const step = Math.max(1.5, OC.dist / 260);
      let hit = false;
      while (t < maxT) {
        const x = _ro.x + _ray.x * t, y = _ro.y + _ray.y * t, z = _ro.z + _ray.z * t;
        const lon = orbInvLon(x), lat = orbInvLat(z);
        if (lon > LON0 && lon < LON1 && lat > LAT0 && lat < LAT1 && y <= orbHeightKm(lat, lon)) { hit = true; break; }
        prevT = t; t += step;
      }
      if (!hit) return null;
      let a = prevT, b = t;
      for (let i = 0; i < 8; i++) {
        const m = (a + b) / 2, x = _ro.x + _ray.x * m, y = _ro.y + _ray.y * m, z = _ro.z + _ray.z * m;
        if (y <= orbHeightKm(orbInvLat(z), orbInvLon(x))) b = m; else a = m;
      }
      const x = _ro.x + _ray.x * b, z = _ro.z + _ray.z * b;
      const lat = orbInvLat(z), lon = orbInvLon(x);
      return { lat, lon, elev: orbSample(lat, lon) };
    }
    const fmtLL = (lat, lon) => `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"} · ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? "E" : "W"}`;
    let hudT = 0;
    function updateHud(dt) {
      hudT += dt; if (hudT < 0.14) return; hudT = 0;
      let gps = "—", el = "", zone = "";
      if (S.mode === "orbit") {
        const px = mouse.has && !isNarrow ? mouse.x : window.innerWidth / 2, py = mouse.has && !isNarrow ? mouse.y : window.innerHeight * 0.45;
        const p = pickOrbit(px, py);
        if (p) {
          const z = ZONES[zoneOf(p.elev)];
          gps = fmtLL(p.lat, p.lon); el = `${fmt(Math.max(p.elev, -150))} m ASL (grid ~1.8 km)`; zone = p.elev >= 0 ? `${z.name.toUpperCase()} · ${z.range}` : "BELOW SEA LEVEL";
          $("hud-zone").style.color = p.elev >= 0 ? z.color : "#9fb";
        } else { gps = "— · —"; el = "orbit · drag to look · wheel to zoom"; zone = ""; }
      } else if (activeTerrain) {
        const gx = S.mode === "walk" ? player.x : GC.x, gz = S.mode === "walk" ? player.z : GC.z;
        const ll = activeTerrain.worldToLatLon(gx, gz), e = activeTerrain.sampleRealElevM(gx, gz), z = ZONES[zoneOf(e)];
        gps = fmtLL(ll.lat, ll.lon);
        el = `${fmt(e)} m ASL · slope ${Math.round(Math.atan(activeTerrain.sampleSlope(gx, gz)) / DEG)}° · ${S.mode.toUpperCase()}`;
        zone = `${z.name.toUpperCase()} (${z.geez}) · ${z.range}`;
        $("hud-zone").style.color = z.color;
      }
      $("hud-gps").textContent = gps; $("hud-elev").textContent = el; $("hud-zone").textContent = zone;
      $("hud-fps").textContent = `${Math.round(S.fps)} FPS`;
    }

    /* ================= UI ================= */
    function syncStagePills() {
      document.querySelectorAll("#stage-pills .pill").forEach(b => {
        const id = b.dataset.stage;
        b.classList.toggle("active", id === "orbit" ? S.mode === "orbit" : (S.mode !== "orbit" && S.region === id));
      });
    }
    function syncRegionUI() { syncStagePills(); refreshLegend(); }
    {
      const wrap = $("stage-pills");
      const mk = (id, text, title) => { const b = document.createElement("button"); b.type = "button"; b.className = "pill"; b.dataset.stage = id; b.textContent = text; b.title = title || text; wrap.appendChild(b); b.addEventListener("click", () => id === "orbit" ? (S.mode === "orbit" ? null : toOrbit()) : diveTo(id)); };
      mk("orbit", "◎ Orbit", "Orbital view of the massif");
      REGIONS.forEach((r, i) => mk(r.id, `${i + 1} ${r.short}`, r.title));
    }
    const LOOK_BAR = [["raw", "Raw"], ["silver", "Silver Gelatin"], ["risograph", "Risograph Stipple"], ["woodblock", "Woodblock"], ["jerikan", "Cyan Jerikan"]];
    function setLook(id) {
      if (post) { try { post.setContactSheet(false); const r = post.setLook(id); S.look = r && r.id ? r.id : id; } catch (e) { console.warn("[abyss] look", e); S.look = "raw"; } }
      document.querySelectorAll("#look-pills .pill").forEach(b => b.classList.toggle("active", b.dataset.look === S.look));
      try { const u = new URL(location.href); u.searchParams.set("look", S.look); history.replaceState(null, "", u); } catch (e) { /* ignore */ }
      return S.look;
    }
    {
      const wrap = $("look-pills");
      for (const [id, name] of LOOK_BAR) { const b = document.createElement("button"); b.type = "button"; b.className = "pill"; b.dataset.look = id; b.textContent = name; b.addEventListener("click", () => setLook(id)); wrap.appendChild(b); }
    }
    function setSeason(m) {
      S.season = clamp(m, 0, 11.99); $("sl-season").value = S.season;
      $("val-season").textContent = seasonLabel(S.season);
      markFieldsDirty();
    }
    $("sl-season").addEventListener("input", e => setSeason(parseFloat(e.target.value)));
    function setColorBy(by) {
      S.colorBy = by; markFieldsDirty();
      document.querySelectorAll("#color-by .pill").forEach(b => b.classList.toggle("active", b.dataset.by === by));
      refreshLegend();
    }
    document.querySelectorAll("#color-by .pill").forEach(b => b.addEventListener("click", () => setColorBy(b.dataset.by)));
    $("tg-fields").addEventListener("change", e => { S.fieldsOn = e.target.checked; fieldRoot.visible = S.mode !== "orbit" && S.fieldsOn; });
    $("tg-labels").addEventListener("change", e => { S.labelsOn = e.target.checked; });
    $("tg-zones").addEventListener("change", e => { orbUniforms.uZones.value = e.target.checked ? 1 : 0; });
    $("btn-ground").addEventListener("click", dropToWalk);

    function openSheet(id) {
      const el = $(id), was = !el.hidden;
      ["sheet-layers", "sheet-info", "sheet-compare"].forEach(s => { $(s).hidden = true; });
      el.hidden = was;
      $("btn-layers").classList.toggle("active", !$("sheet-layers").hidden);
      $("btn-info").classList.toggle("active", !$("sheet-info").hidden);
      if (!el.hidden && id === "sheet-compare") buildCompare();
    }
    $("btn-layers").addEventListener("click", () => openSheet("sheet-layers"));
    $("btn-info").addEventListener("click", () => openSheet("sheet-info"));
    $("btn-compare").addEventListener("click", () => openSheet("sheet-compare"));
    $("btn-share").addEventListener("click", () => {
      const u = new URL(location.href); u.searchParams.set("look", S.look); u.searchParams.set("season", S.season.toFixed(1)); u.searchParams.set("by", S.colorBy);
      if (S.mode !== "orbit" && S.region) { u.searchParams.set("region", S.region); u.searchParams.set("mode", S.mode); }
      else { u.searchParams.delete("region"); u.searchParams.delete("mode"); }
      const done = () => { $("btn-share").textContent = "Copied ✓"; setTimeout(() => { $("btn-share").textContent = "Share link"; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u.toString()).then(done, done); else done();
    });
    // info cards
    {
      const tabs = $("info-tabs"), body = $("info-body");
      const show = id => { const c = INFO.find(i => i.id === id); body.innerHTML = `<h3>${c.title}</h3>${c.html}`; tabs.querySelectorAll(".pill").forEach(b => b.classList.toggle("active", b.dataset.id === id)); };
      for (const c of INFO) { const b = document.createElement("button"); b.type = "button"; b.className = "pill"; b.dataset.id = c.id; b.textContent = c.tab; b.addEventListener("click", () => show(c.id)); tabs.appendChild(b); }
      show("tectonics");
      window.__abyssInfo = show;
    }

    const jumpRow = document.createElement("div"); jumpRow.className = "row"; jumpRow.id = "jump-row"; jumpRow.hidden = true;
    jumpRow.innerHTML = `<span class="tag-k">Jump to</span>`;
    [["spawn", "Fields & Imani"], ["plough", "Ox-plough"], ["church", "Church forest"], ["bunds", "Stone bunds"]].forEach(([k, t]) => { const b = document.createElement("button"); b.type = "button"; b.className = "pill"; b.textContent = t; b.addEventListener("click", () => jumpTo(k)); jumpRow.appendChild(b); });
    $("stage-pills").parentNode.insertBefore(jumpRow, $("stage-pills").nextSibling);
    function jumpTo(kind) {
      if (S.busy || S.mode !== "walk" || !activeTerrain) return;
      let t = null, yaw = GC.yaw;
      if (kind === "spawn") t = { x: S.spawn.x, z: S.spawn.z };
      else if (kind === "plough" && extras && extras.team) { t = { x: extras.team.position.x - 7, z: extras.team.position.z - 7 }; yaw = Math.atan2(-1, -1); }
      else if (kind === "church" && extras && extras.church) { t = { x: extras.church.x + 22, z: extras.church.z + 4 }; yaw = Math.PI / 2; }
      else if (kind === "bunds" && extras && extras.bunds) { t = { x: extras.bunds.x, z: extras.bunds.z }; }
      if (!t) return;
      stageCast(t, yaw); GC.x = player.x; GC.z = player.z; GC.y = player.y + 1.38; GC.yaw = yaw;
    }
    function refreshLegend() {
      const lg = $("legend"), st = $("ag-status");
      st.textContent = fieldSet ? S.fieldStatus : (S.fieldStatus || "Real field polygons draped on the DEM. Dive into a region to see them.");
      const items = [];
      const count = f => { const c = {}; if (fieldSet) for (const p of fieldSet.polys) { const k = f(p); c[k] = (c[k] || 0) + 1; } return c; };
      if (S.colorBy === "crop") {
        const c = count(p => p.crop);
        for (const k of ["teff", "barley", "wheat", "maize_sorghum", "coffee"]) items.push([CROPS[k].base, CROPS[k].label, c[k] ? `${fmt(c[k])} · inferred` : CROPS[k].note]);
        items.push(["#8d7656", "Season-driven", "tan dry → green monsoon → gold harvest"]);
      } else if (S.colorBy === "zone") {
        const c = count(p => p.zone);
        for (const k of Object.keys(ZONES)) items.push([ZONES[k].color, `${ZONES[k].name} ${ZONES[k].range}`, c[k] ? `${fmt(c[k])} fields` : ZONES[k].desc]);
      } else {
        const c = count(p => p.shapeName);
        for (const k of ["jigsaw", "contour-ribbon", "riparian-strip", "lowland-block"]) items.push([SHAPES[k].color, SHAPES[k].short, c[k] ? `${fmt(c[k])} in this tile` : "none here · see exemplar in Compare"]);
      }
      lg.innerHTML = items.map(i => `<div class="lg"><span class="sw" style="background:${i[0]}"></span><span>${i[1]}<small>${i[2]}</small></span></div>`).join("") +
        (S.colorBy === "crop" ? `<p class="sub" style="grid-column:1/-1">Crop type is <b>not observed</b> in the field data (all “unknown”). Colours here are <b>inferred from altitude zone</b> — a stylized guide, not a crop map.</p>` : "");
    }

    /* ---- Compare shapes panel ---- */
    let exemplarCache = null;
    function pcaElong(ring) {
      const n = ring.length / 2; let mx = 0, my = 0;
      const k = Math.cos(ring[1] * DEG);
      const xs = new Float64Array(n), ys = new Float64Array(n);
      for (let i = 0; i < n; i++) { xs[i] = ring[2 * i] * k * 111320; ys[i] = ring[2 * i + 1] * 110574; mx += xs[i]; my += ys[i]; }
      mx /= n; my /= n; let sxx = 0, syy = 0, sxy = 0;
      for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxx += a * a; syy += b * b; sxy += a * b; }
      const tr = sxx + syy, det = sxx * syy - sxy * sxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
      const l1 = tr / 2 + disc, l2 = Math.max(1e-6, tr / 2 - disc);
      return Math.sqrt(l1 / l2);
    }
    function svgOutline(ring, color) {
      const n = ring.length / 2, k = Math.cos(ring[1] * DEG); let minx = 1e18, miny = 1e18, maxx = -1e18, maxy = -1e18; const pts = [];
      for (let i = 0; i < n; i++) { const x = ring[2 * i] * k * 111320, y = -ring[2 * i + 1] * 110574; pts.push([x, y]); minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
      const w = maxx - minx || 1, h = maxy - miny || 1, sc = Math.min(110 / w, 58 / h), ox = 60 - w * sc / 2, oy = 37 - h * sc / 2;
      const d = pts.map((p, i) => `${i ? "L" : "M"}${((p[0] - minx) * sc + ox).toFixed(1)},${((p[1] - miny) * sc + oy).toFixed(1)}`).join("") + "Z";
      return `<svg viewBox="0 0 120 74" aria-hidden="true"><path d="${d}" fill="${color}" fill-opacity=".55" stroke="${color}" stroke-width="1.4"/></svg><div class="sub" style="text-align:center;font-size:9.5px">${fmt(w)} × ${fmt(h)} m bbox</div>`;
    }
    async function loadExemplars() {
      if (exemplarCache) return exemplarCache;
      const FP = window.AbyssFieldPack; if (!FP) return (exemplarCache = {});
      let man; try { man = await FP.manifest(); } catch (e) { return (exemplarCache = {}); }
      const ids = Object.keys(man.regions);
      const pri = id => (id.startsWith("dem_") ? 0 : id.startsWith("ex_") ? 1 : 2);
      ids.sort((a, b) => pri(a) - pri(b));
      const packs = {};
      await Promise.all(ids.map(id => FP.load(id).then(d => { packs[id] = d; }).catch(() => { /* optional */ })));
      const pick = {};
      for (const shape of ["jigsaw", "contour-ribbon", "riparian-strip", "lowland-block"]) {
        const here = fieldSet ? fieldSet.key : null;
        const prefer = shape === "lowland-block" ? ["ex_block"] : shape === "riparian-strip" ? ["ex_riparian", "ex_block"] : [here];
        const order = prefer.filter(Boolean).concat(ids.filter(i => !prefer.includes(i) && !(i.startsWith("ex_") && shape !== "lowland-block" && shape !== "riparian-strip")));
        for (const id of order) {
          const d = packs[id]; if (!d) continue;
          const cand = d.polys.filter(p => p.shapeName === shape && p.ring.length >= 6);
          if (!cand.length) continue;
          const areas = cand.map(p => p.area).sort((a, b) => a - b), med = areas[areas.length >> 1];
          cand.sort((a, b) => Math.abs(a.area - med) - Math.abs(b.area - med));
          const stats = { n: cand.length, share: cand.length / d.count, medHa: med / 1e4, elong: (() => { const e = cand.slice(0, 300).map(p => pcaElong(p.ring)).sort((a, b) => a - b); return e[e.length >> 1]; })() };
          pick[shape] = { poly: cand[0], pack: id, stats, packTotal: d.count };
          break;
        }
      }
      return (exemplarCache = pick);
    }
    async function buildCompare() {
      const body = $("cmp-body"); body.innerHTML = `<p class="sub">Loading polygons…</p>`;
      const ex = await loadExemplars();
      let st = null; try { st = await window.AbyssFieldPack.stats(); } catch (e) { /* optional */ }
      $("cmp-sub").textContent = "Real polygons from Fields of The World (CC-BY-4.0). Shape classes are geometry heuristics, not ground-truth labels. Hover a card to highlight that shape on the terrain.";
      const cards = ["jigsaw", "contour-ribbon", "riparian-strip", "lowland-block"].map(k => {
        const e = ex[k], S0 = SHAPES[k];
        const here = fieldSet && fieldSet.byShape ? (fieldSet.byShape[k] || 0) : null;
        const regionRows = st ? Object.keys(st).filter(r => st[r] && st[r].shareByShape).map(r => `${FIELD_REGION_LABEL[r] || r}: ${(st[r].shareByShape[k] * 100).toFixed(st[r].shareByShape[k] < 0.01 ? 2 : 1)}%`).join(" · ") : "";
        return `<div class="cmp-card${S.hiShape === k ? " hi" : ""}" data-shape="${k}" style="border-top:3px solid ${S0.color}">
          ${e ? svgOutline(e.poly.ring, S0.color) : `<div class="sub" style="height:74px;display:flex;align-items:center;justify-content:center">no example in loaded packs</div>`}
          <h4 style="color:${S0.color}">${S0.label}</h4>
          <p style="font-size:10.5px">${S0.desc}</p>
          <dl>
            <dt>This tile</dt><dd>${here === null ? "—" : fmt(here) + " fields"}</dd>
            ${e ? `<dt>Median area</dt><dd>${e.stats.medHa.toFixed(2)} ha</dd><dt>Elongation</dt><dd>${e.stats.elong.toFixed(1)} : 1</dd><dt>Example from</dt><dd>${e.pack}</dd>` : ""}
          </dl>
          ${regionRows ? `<p class="sub" style="font-size:9.5px;margin-top:4px">Share of windows — ${regionRows}</p>` : ""}
        </div>`;
      }).join("");
      body.innerHTML = `<div class="cmp-grid">${cards}</div><p class="sub" style="margin-top:8px">Honest note: sampled smallholder windows are ~95–98% irregular jigsaw; mechanized blocks and riparian strips are rare there, so exemplars may come from other pack windows (see “Example from”).</p>`;
      body.querySelectorAll(".cmp-card").forEach(c => {
        const k = c.dataset.shape;
        const on = () => { S.hiShape = S.hiShape === k ? null : k; markFieldsDirty(); body.querySelectorAll(".cmp-card").forEach(x => x.classList.toggle("hi", x.dataset.shape === S.hiShape)); };
        c.addEventListener("click", on);
      });
    }
    function refreshCompareIfOpen() { if (!$("sheet-compare").hidden) buildCompare(); }
    $("sheet-compare").addEventListener("pointerleave", () => { /* keep selection until clicked again */ });

    /* ================= MAIN LOOP ================= */
    let last = performance.now(), fpsS = 60, frameN = 0;
    function animate(now) {
      requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (dt > 0) fpsS = lerp(fpsS, 1 / dt, 0.08); S.fps = fpsS;
      const nowSec = now / 1000; frameN++;
      stepTweens();
      if (S.mode === "orbit") {
        if (!S.busy) { const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0); if (f || s) { const sp = OC.dist * 0.5 * dt; OC.x += (-Math.sin(OC.yaw) * f + Math.cos(OC.yaw) * s) * sp; OC.z += (-Math.cos(OC.yaw) * f - Math.sin(OC.yaw) * s) * sp; } }
        OC.x = clamp(OC.x, orbX(LON0), orbX(LON1)); OC.z = clamp(OC.z, orbZ(LAT1), orbZ(LAT0));
        updateOrbitCam();
      } else if (activeTerrain) {
        if (S.mode === "walk" && !S.busy) {
          stepWalk(dt, nowSec);
          GC.x = lerp(GC.x, lerp(player.x, donkey ? donkey.state.x : player.x, 0.28), clamp(dt * 12, 0, 1));
          GC.z = lerp(GC.z, lerp(player.z, donkey ? donkey.state.z : player.z, 0.28), clamp(dt * 12, 0, 1));
          GC.y = walkSurfaceAt(GC.x, GC.z) + 1.38;
        }
        stepAerialPan(dt);
        updateGroundCam(dt);
        if (S.mode === "walk" || S.busy || GC.dist < 500) stepCast(dt, nowSec);
        stepExtras(dt, nowSec);
        if (worldBridge) {
          if (imani && imani.group.visible) {
            const spd = S.mode === "walk" ? player.speed : 0;
            worldBridge.setActorLocomotion("abyss_imani", {
              speedMps: spd,
              carrying: spd > 0.14 ? spd < 2.2 : true,
              blend: 0.85
            });
          }
          if (farmer && farmer.group.visible) {
            const dF = Math.hypot(player.x - farmer.state.x, player.z - farmer.state.z);
            worldBridge.setActorLocomotion("abyss_farmer", {
              speedMps: dF < 5.0 ? 0 : 1.15,
              greeting: dF < 5.0,
              talking: dF >= 5.0 && dF < 12.0,
              blend: 0.82
            });
          }
          worldBridge.update(dt);
        }
        if (activeEcology && (S.mode === "walk" || (frameN & 1))) {
          _v.set(player.x, player.y, player.z);
          const dpos = donkey ? new T.Vector3(donkey.state.x, donkey.group.position.y, donkey.state.z) : null;
          activeEcology.update(dt, nowSec, { playerPos: _v, donkeyPos: dpos });
        }
        if (packInstance) { packInstance.update(dt, nowSec); if (packInstance.skyMesh) packInstance.skyMesh.position.copy(camGnd.position); }
        sunLight.target.position.set(GC.x, GC.y - 2, GC.z);
        sunLight.position.copy(sunLight.target.position).addScaledVector(sunDirVec, 155);
        if (fieldsDirty && now - fieldDrawT > 70) { fieldDrawT = now; drawFields(); }
      }
      updateLabels();
      updateHud(dt);
      if (post) post.render(scene, camera, dt, nowSec, null); else renderer.render(scene, camera);
    }

    /* ================= PUBLIC API / BOOT ================= */
    Object.assign(window.__abyss, {
      diveTo, toOrbit, dropToWalk, setLook, setSeason, setColorBy, openSheet, buildCompare,
      state: () => ({ mode: S.mode, region: S.region, look: S.look, season: S.season, colorBy: S.colorBy, fps: S.fps, busy: S.busy,
        fields: fieldSet ? { total: fieldSet.total, inside: fieldSet.polys.length, key: fieldSet.key, byShape: fieldSet.byShape } : null,
        player: { x: player.x, y: player.y, z: player.z }, gl: renderer.getContext().getError(), status: S.fieldStatus,
        worldBridge: worldBridge ? {
          loadedClips: worldBridge.getLoadedClips(),
          imani: worldBridge.getActorState("abyss_imani"),
          farmer: worldBridge.getActorState("abyss_farmer")
        } : null }),
      setHiShape: k => { S.hiShape = k; markFieldsDirty(); },
      get terrain() { return activeTerrain; }, get fieldSet() { return fieldSet; }
    });

    // initial UI state
    applyVisibility(); setSeason(S.season); setColorBy("crop"); syncStagePills();
    const qp = new URLSearchParams(location.search);
    if (qp.get("season")) setSeason(parseFloat(qp.get("season")));
    if (qp.get("by")) setColorBy(qp.get("by"));
    if (qp.get("tour") === "0") { /* reserved */ }
    OC.yaw = 0;
    updateOrbitCam();
    requestAnimationFrame(animate);

    const startLook = (qp.get("look") || "raw").toLowerCase();
    setLook(startLook);

    const rq = qp.get("region") ? REGIONS.find(r => r.id === qp.get("region") || r.fieldKey === qp.get("region") || r.short.toLowerCase().startsWith(qp.get("region").toLowerCase())) : null;
    if (rq) {
      try {
        await loadRegion(rq.id);
        S.mode = (qp.get("mode") === "walk") ? "walk" : "aerial";
        if (S.mode === "walk") { GC.dist = 8.6; GC.pitch = 0.24; GC.x = player.x; GC.z = player.z; GC.y = player.y + 1.38; } else { GC.dist = 1150; GC.pitch = 0.5; GC.yaw = S.aerialYaw; }
        applyVisibility(); syncRegionUI();
      } catch (e) { console.error("[abyss] initial region", e); }
    }
    loaderEl.classList.add("out"); setTimeout(() => { loaderEl.hidden = true; }, 520);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
