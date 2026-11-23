/* Ethiopian Highlands Playable Open-World Expedition, Rogallo Ridge-Soaring Glider,
   Documentary Cinema Drone, Altimeter/GPS/Agro-Ecology HUD & 15-Look Shader Studio (`ethiopia-world.js`).
   Exposes `window.__ethiopiaWorld` and wires:
   - `window.EthiopiaHighlandsPack` (`ethiopia-terrain.js` + `terrain-pack/`)
   - `window.EthiopiaEndemicFauna` (`endemic-fauna.js` — GPU InstancedMesh Flora, Rock-Hewn Church, SILAS Wildlife)
   - `window.makeDonkey` (`donkey/donkey.js` — Mistletoe with Glowing Cyan 20L Ahiya Pack & Lead Rope)
   - `window.makeExpeditionCharacter` (`donkey/characters.js` — Imani, Makeda, June, Elder Berhanu)
   - `window.LookAuditionMV` (`study/look-audition-mv.js` — All 15 GPU Zone/Print Shaders + 3x3 Contact Sheet) */
(function () {
  "use strict";

  const T = typeof window !== "undefined" ? window.THREE : null;
  if (!T) {
    console.error("[ethiopia-world] THREE is required before ethiopia-world.js");
    return;
  }

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const wrapAngle = a => {
    let r = (a + Math.PI) % TAU;
    if (r < 0) r += TAU;
    return r - Math.PI;
  };

  const REGION_META = [
    {
      id: "simien_imet_gogo",
      num: "1",
      short: "1 · Simien / Imet Gogo 3,926m",
      title: "Simien Mountains · Imet Gogo Promontory",
      sub: "3,926 m Oligocene Flood-Basalt Escarpment, Giant Lobelia Moorland & Gelada Cliff Meadows",
      defaultCamYaw: 0.14,
      windDir: [0.18, -0.98]
    },
    {
      id: "gheralta_spires",
      num: "2",
      short: "2 · Gheralta Spires",
      title: "Gheralta Mountains · Tigray Sandstone Spires",
      sub: "2,588 m Red-Gold Adigrat Sandstone Towers, Monolithic Cruciform Church & Acacia Plains",
      defaultCamYaw: 0.28,
      windDir: [0.15, 0.99]
    },
    {
      id: "blue_nile_gorge",
      num: "3",
      short: "3 · Blue Nile Gorge",
      title: "Blue Nile (Abay) Gorge · Dejen–Goha Tsion",
      sub: "1,500 m Multi-Tiered Basalt, Antalo Limestone & Red Sandstone Canyon Above the Abay River",
      defaultCamYaw: Math.PI - 0.16,
      windDir: [-0.12, 0.99]
    },
    {
      id: "gerd_belaya_escarpment",
      num: "4",
      short: "4 · GERD Western Escarpment",
      title: "GERD Saddle → Mt. Belaya Western Escarpment",
      sub: "505 m Kolla Blue Nile Reservoir Saddle Rising to 2,549 m Rain-Catching Dega Terraces",
      defaultCamYaw: -1.28,
      windDir: [-0.96, -0.28]
    }
  ];

  const REGION_ALIASES = {
    "1": "simien_imet_gogo",
    simien: "simien_imet_gogo",
    imet: "simien_imet_gogo",
    imet_gogo: "simien_imet_gogo",
    "2": "gheralta_spires",
    gheralta: "gheralta_spires",
    tigray: "gheralta_spires",
    "3": "blue_nile_gorge",
    abay: "blue_nile_gorge",
    blue_nile: "blue_nile_gorge",
    gorge: "blue_nile_gorge",
    "4": "gerd_belaya_escarpment",
    gerd: "gerd_belaya_escarpment",
    belaya: "gerd_belaya_escarpment"
  };

  function resolveRegionId(raw) {
    if (!raw) return "simien_imet_gogo";
    const clean = String(raw).trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (REGION_ALIASES[clean]) return REGION_ALIASES[clean];
    const hit = REGION_META.find(r => r.id === clean);
    return hit ? hit.id : "simien_imet_gogo";
  }

  const BIOME_INFO = {
    wurch: {
      code: "WURCH",
      geez: "ውርጭ",
      range: "> 3,200 m",
      desc: "Afro-Alpine Lobelia & Gelada Moorland",
      color: "#5be2ff"
    },
    dega: {
      code: "DEGA",
      geez: "ደጋ",
      range: "2,300–3,200 m",
      desc: "Cool Highland Escarpment & Kosso Woods",
      color: "#8ce89b"
    },
    woina_dega: {
      code: "WOINA DEGA",
      geez: "ወይና ደጋ",
      range: "1,500–2,300 m",
      desc: "Temperate Tableland, Acacia & Sanctuaries",
      color: "#ffd479"
    },
    kolla: {
      code: "KOLLA",
      geez: "ቆላ",
      range: "< 1,500 m",
      desc: "Warm Blue Nile Gorge & Lowland Basin",
      color: "#ff9d66"
    }
  };

  /* ---------- 1. Rogallo Delta Hang-Glider Builder ---------- */
  function buildRogalloGlider(T) {
    const root = new T.Group();
    root.name = "RogalloHangGlider";
    root.visible = false;

    const wingPivot = new T.Group();
    root.add(wingPivot);

    const aluMat = new T.MeshStandardMaterial({ color: 0xcbd3dc, roughness: 0.32, metalness: 0.82 });
    const darkWireMat = new T.MeshBasicMaterial({ color: 0x232830 });
    const sailRustMat = new T.MeshStandardMaterial({
      color: 0xc85d34,
      emissive: 0x3a1408,
      emissiveIntensity: 0.18,
      roughness: 0.48,
      side: T.DoubleSide
    });
    const sailCreamMat = new T.MeshStandardMaterial({
      color: 0xf0e6d2,
      roughness: 0.52,
      side: T.DoubleSide
    });
    const sailCyanMat = new T.MeshStandardMaterial({
      color: 0x28d8f0,
      emissive: 0x108eb0,
      emissiveIntensity: 0.82,
      roughness: 0.28,
      side: T.DoubleSide
    });
    sailCyanMat.userData.isWaterCyan = true;

    // Classic Rogallo swept delta geometry (+Z = nose forward, X = +/-4.9m wingspan)
    const nose = [0, 0.12, 2.45];
    const keelRear = [0, 0.08, -1.55];
    const tipL = [4.85, 0.28, -1.35];
    const tipR = [-4.85, 0.28, -1.35];
    const midL = [2.45, 0.44, 0.55];
    const midR = [-2.45, 0.44, 0.55];
    const lobeL = [2.35, 0.36, -1.12];
    const lobeR = [-2.35, 0.36, -1.12];

    const makeTriMesh = (tris, mat) => {
      const pos = [];
      for (const [a, b, c] of tris) pos.push(...a, ...b, ...c);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      const m = new T.Mesh(g, mat);
      m.castShadow = true;
      wingPivot.add(m);
      return m;
    };

    // Selective Cyan Leading-Edge Panels + Terracotta & Cream Billowing Conical Lobes
    makeTriMesh([[nose, midL, [1.55, 0.34, 0.45]], [nose, [-1.55, 0.34, 0.45], midR]], sailCyanMat);
    makeTriMesh([[midL, tipL, [3.4, 0.34, -0.75]], [midR, [-3.4, 0.34, -0.75], tipR]], sailCyanMat);
    makeTriMesh([
      [nose, [1.55, 0.34, 0.45], lobeL],
      [nose, lobeL, keelRear],
      [nose, lobeR, [-1.55, 0.34, 0.45]],
      [nose, keelRear, lobeR]
    ], sailCreamMat);
    makeTriMesh([
      [[1.55, 0.34, 0.45], midL, lobeL],
      [midL, [3.4, 0.34, -0.75], lobeL],
      [[3.4, 0.34, -0.75], tipL, lobeL],
      [[-1.55, 0.34, 0.45], lobeR, midR],
      [midR, lobeR, [-3.4, 0.34, -0.75]],
      [[-3.4, 0.34, -0.75], lobeR, tipR]
    ], sailRustMat);

    const addBar = (p0, p1, r, mat) => {
      const a = new T.Vector3(...p0), b = new T.Vector3(...p1);
      const d = b.clone().sub(a);
      const cyl = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 8), mat);
      cyl.position.copy(a).lerp(b, 0.5);
      cyl.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
      wingPivot.add(cyl);
    };

    // Keel, Leading-Edge Spars, Crossbar, Kingpost & Control A-Frame
    addBar(nose, [0, 0.08, -1.85], 0.026, aluMat);
    addBar(nose, tipL, 0.025, aluMat);
    addBar(nose, tipR, 0.025, aluMat);
    addBar([2.45, 0.24, 0.35], [-2.45, 0.24, 0.35], 0.022, aluMat);
    const kingTop = [0, 1.05, 0.25];
    addBar([0, 0.12, 0.25], kingTop, 0.018, aluMat);
    addBar(kingTop, nose, 0.005, darkWireMat);
    addBar(kingTop, tipL, 0.005, darkWireMat);
    addBar(kingTop, tipR, 0.005, darkWireMat);
    addBar(kingTop, keelRear, 0.005, darkWireMat);

    const barL = [0.62, -1.18, 0.38], barR = [-0.62, -1.18, 0.38], apex = [0, 0.12, 0.42];
    addBar(apex, barL, 0.018, aluMat);
    addBar(apex, barR, 0.018, aluMat);
    addBar(barL, barR, 0.020, aluMat);
    addBar(barL, nose, 0.005, darkWireMat);
    addBar(barR, nose, 0.005, darkWireMat);

    // Suspended Prone Pilot Pod (warm canvas harness + cyan Ahiya dorsal stripe)
    const podMat = new T.MeshStandardMaterial({ color: 0x8e795c, roughness: 0.68 });
    const skinMat = new T.MeshStandardMaterial({ color: 0x3b261b, roughness: 0.55 });
    const pilotPod = new T.Group();
    pilotPod.position.set(0, -0.92, -0.05);
    const podBody = new T.Mesh(new T.CapsuleGeometry(0.18, 1.15, 6, 10), podMat);
    podBody.rotation.x = Math.PI * 0.48;
    const podStripe = new T.Mesh(new T.BoxGeometry(0.12, 0.05, 0.95), sailCyanMat);
    podStripe.position.set(0, 0.17, -0.02);
    const helmet = new T.Mesh(new T.SphereGeometry(0.145, 10, 8), skinMat);
    helmet.position.set(0, 0.08, 0.68);
    const goggles = new T.Mesh(new T.BoxGeometry(0.18, 0.06, 0.08), sailCyanMat);
    goggles.position.set(0, 0.10, 0.78);
    pilotPod.add(podBody, podStripe, helmet, goggles);
    wingPivot.add(pilotPod);
    addBar(apex, [0, -0.85, 0.05], 0.010, darkWireMat);

    const tipAnchorL = new T.Object3D();
    tipAnchorL.position.set(...tipL);
    const tipAnchorR = new T.Object3D();
    tipAnchorR.position.set(...tipR);
    wingPivot.add(tipAnchorL, tipAnchorR);

    // Twin Cyan Wingtip Contrail Ribbons
    const TRAIL_LEN = 38;
    const makeRibbon = () => {
      const arr = new Float32Array(TRAIL_LEN * 3);
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.BufferAttribute(arr, 3));
      const mat = new T.LineBasicMaterial({ color: 0x28d8f0, transparent: true, opacity: 0.82 });
      mat.userData.isWaterCyan = true;
      const line = new T.Line(geo, mat);
      line.frustumCulled = false;
      line.visible = false;
      return { line, arr, pts: Array.from({ length: TRAIL_LEN }, () => new T.Vector3()), inited: false };
    };
    const ribbonL = makeRibbon();
    const ribbonR = makeRibbon();

    const tmpL = new T.Vector3(), tmpR = new T.Vector3();
    function updateContrails(active) {
      ribbonL.line.visible = active;
      ribbonR.line.visible = active;
      if (!active) {
        ribbonL.inited = ribbonR.inited = false;
        return;
      }
      root.updateMatrixWorld(true);
      tipAnchorL.getWorldPosition(tmpL);
      tipAnchorR.getWorldPosition(tmpR);
      for (const [rib, tip] of [[ribbonL, tmpL], [ribbonR, tmpR]]) {
        if (!rib.inited) {
          for (const p of rib.pts) p.copy(tip);
          rib.inited = true;
        } else {
          for (let i = rib.pts.length - 1; i > 0; i--) rib.pts[i].copy(rib.pts[i - 1]);
          rib.pts[0].copy(tip);
        }
        for (let i = 0; i < rib.pts.length; i++) {
          rib.arr[i * 3] = rib.pts[i].x;
          rib.arr[i * 3 + 1] = rib.pts[i].y;
          rib.arr[i * 3 + 2] = rib.pts[i].z;
        }
        rib.line.geometry.attributes.position.needsUpdate = true;
      }
    }

    return { root, wingPivot, pilotPod, ribbonL, ribbonR, updateContrails };
  }

  /* ---------- 2. Mistletoe Glowing Cyan 20L Ahiya Saddle Pack ---------- */
  function attachCyanAhiyaPack(T, donkey) {
    if (!donkey || !donkey.pack) return null;
    donkey.setCargo([
      { name: "Cyan Jerikan L", kg: 14, slot: "L" },
      { name: "Cyan Jerikan R", kg: 14, slot: "R" },
      { name: "Ahiya Transceiver", kg: 8, slot: "T" }
    ]);
    for (const c of donkey.pack.children) {
      if (c.isGroup) c.visible = false;
    }

    const rig = new T.Group();
    donkey.pack.add(rig);

    const woodMat = new T.MeshStandardMaterial({ color: 0x6c4c32, roughness: 0.78 });
    const leatherMat = new T.MeshStandardMaterial({ color: 0x3b281c, roughness: 0.68 });
    const brassMat = new T.MeshStandardMaterial({ color: 0xd0a854, roughness: 0.34, metalness: 0.76 });
    const canShellMat = new T.MeshStandardMaterial({ color: 0x1c7fa6, roughness: 0.36 });
    const cyanWindowMat = new T.MeshStandardMaterial({
      color: 0x28d8f0,
      emissive: 0x16a8cc,
      emissiveIntensity: 0.96,
      roughness: 0.16
    });
    cyanWindowMat.userData.isWaterCyan = true;

    const addBar = (a, b, r, mat) => {
      const va = new T.Vector3(...a), vb = new T.Vector3(...b);
      const d = vb.clone().sub(va);
      const m = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 7), mat);
      m.position.copy(va).lerp(vb, 0.5);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
      rig.add(m);
    };

    // Wooden X-Sawbuck Saddle Trees
    for (const zOff of [-0.14, 0.22]) {
      addBar([-0.22, 1.06, zOff], [0.18, 1.38, zOff], 0.017, woodMat);
      addBar([0.22, 1.06, zOff], [-0.18, 1.38, zOff], 0.017, woodMat);
    }
    for (const sgn of [-1, 1]) {
      addBar([sgn * 0.21, 1.14, -0.21], [sgn * 0.21, 1.14, 0.29], 0.015, woodMat);
      const canGrp = new T.Group();
      canGrp.position.set(sgn * 0.31, 0.96, 0.04);
      canGrp.rotation.z = sgn * 0.12;
      const body = new T.Mesh(new T.BoxGeometry(0.18, 0.36, 0.28), canShellMat);
      body.castShadow = true;
      const win = new T.Mesh(new T.BoxGeometry(0.195, 0.19, 0.18), cyanWindowMat);
      const strap = new T.Mesh(new T.BoxGeometry(0.20, 0.38, 0.04), leatherMat);
      canGrp.add(body, win, strap);
      rig.add(canGrp);
    }
    const topBox = new T.Mesh(new T.BoxGeometry(0.24, 0.13, 0.32), leatherMat);
    topBox.position.set(0, 1.25, 0.04);
    const topLed = new T.Mesh(new T.BoxGeometry(0.18, 0.035, 0.22), cyanWindowMat);
    topLed.position.set(0, 1.325, 0.04);
    const whip = new T.Mesh(new T.CylinderGeometry(0.006, 0.012, 0.65, 6), brassMat);
    whip.position.set(-0.04, 1.64, 0.08);
    const beacon = new T.Mesh(new T.SphereGeometry(0.048, 10, 8), cyanWindowMat);
    beacon.position.set(-0.04, 1.98, 0.08);
    rig.add(topBox, topLed, whip, beacon);
    return { rig, beacon };
  }

  /* ---------- 3. Fallback / Adapter for `window.EthiopiaHighlandsPack` ---------- */
  async function loadManifestFallback() {
    const resp = await fetch("./terrain-pack/manifest.json");
    if (!resp.ok) throw new Error(`manifest HTTP ${resp.status}`);
    return resp.json();
  }

  function wrapTerrainHandle(rawHandle, regionId, manifestRegion) {
    const meta = manifestRegion || (rawHandle && rawHandle.activeRegion) || (rawHandle && rawHandle.manifest) || {};
    const worldSpan = meta.worldSpanM || (rawHandle && rawHandle.worldSpan) || (rawHandle && rawHandle.worldSpanM) || 2400;
    const halfSpan = worldSpan * 0.5;
    const datumElev = meta.datumElevM !== undefined ? meta.datumElevM : 2500;
    const vScale = meta.verticalScale || 0.6;
    const bounds = meta.bounds || { latSouth: 13.235, latNorth: 13.293, lonWest: 38.067, lonEast: 38.126 };
    const sampleW = rawHandle && typeof rawHandle.sampleWaterHeight === "function"
      ? rawHandle.sampleWaterHeight(0, 0)
      : null;
    const waterPlane = meta.waterPlane || (rawHandle && rawHandle.waterPlane) || null;
    const waterY = typeof sampleW === "number"
      ? sampleW
      : (waterPlane && typeof waterPlane.worldY === "number" ? waterPlane.worldY : -99999);

    const sampleHeight = (x, z) => {
      if (rawHandle && typeof rawHandle.sampleHeight === "function") {
        const h = rawHandle.sampleHeight(x, z);
        if (Number.isFinite(h)) return h;
      }
      return 0;
    };

    const sampleNormal = (x, z, outVec) => {
      const out = outVec || new T.Vector3(0, 1, 0);
      if (rawHandle && typeof rawHandle.sampleNormal === "function") {
        const res = rawHandle.sampleNormal(x, z, out);
        if (res && res.isVector3) {
          if (res !== out) out.copy(res);
          return out;
        }
        if (Array.isArray(res) && res.length >= 3) {
          out.set(res[0], res[1], res[2]).normalize();
          return out;
        }
      }
      const eps = 2.5;
      const hL = sampleHeight(x - eps, z), hR = sampleHeight(x + eps, z);
      const hD = sampleHeight(x, z - eps), hU = sampleHeight(x, z + eps);
      return out.set(hL - hR, 2 * eps, hD - hU).normalize();
    };

    const tmpNrm = new T.Vector3();
    const sampleSlope = (x, z) => {
      if (rawHandle && typeof rawHandle.sampleSlope === "function") {
        const s = rawHandle.sampleSlope(x, z);
        if (Number.isFinite(s)) return s;
      }
      sampleNormal(x, z, tmpNrm);
      return Math.sqrt(Math.max(0, 1 - tmpNrm.y * tmpNrm.y)) / Math.max(0.05, tmpNrm.y);
    };

    const sampleSlopeDegrees = (x, z) => {
      if (rawHandle && typeof rawHandle.sampleSlopeDegrees === "function") {
        const d = rawHandle.sampleSlopeDegrees(x, z);
        if (Number.isFinite(d)) return d;
      }
      return Math.atan(sampleSlope(x, z)) / DEG;
    };

    const sampleRealElevM = (x, z) => {
      if (rawHandle && typeof rawHandle.sampleElevationMeters === "function") {
        const em = rawHandle.sampleElevationMeters(x, z);
        if (Number.isFinite(em)) return em;
      }
      if (rawHandle && typeof rawHandle.sampleElevationM === "function") {
        const em = rawHandle.sampleElevationM(x, z);
        if (Number.isFinite(em)) return em;
      }
      const wy = sampleHeight(x, z);
      return datumElev + wy / vScale;
    };

    const sampleBiome = (x, z) => {
      if (rawHandle && typeof rawHandle.sampleBiome === "function") {
        const b = rawHandle.sampleBiome(x, z);
        if (typeof b === "string" && BIOME_INFO[b]) return b;
        if (b && typeof b.id === "string" && BIOME_INFO[b.id]) return b.id;
      }
      const elev = sampleRealElevM(x, z);
      if (elev >= 3200) return "wurch";
      if (elev >= 2300) return "dega";
      if (elev >= 1500) return "woina_dega";
      return "kolla";
    };

    const sampleUpdraft = (x, z, windXZ) => {
      if (rawHandle && typeof rawHandle.sampleUpdraft === "function") {
        const u = rawHandle.sampleUpdraft(x, z, windXZ);
        if (Number.isFinite(u)) return u;
      }
      return Math.min(8.5, sampleSlope(x, z) * 3.8);
    };

    const worldToLatLon = (x, z) => {
      if (rawHandle && typeof rawHandle.worldToLatLon === "function") {
        const ll = rawHandle.worldToLatLon(x, z);
        if (ll && Number.isFinite(ll.lat) && Number.isFinite(ll.lon)) return ll;
      }
      const u = clamp((x + halfSpan) / worldSpan, 0, 1);
      const v = clamp((z + halfSpan) / worldSpan, 0, 1);
      return {
        lat: lerp(bounds.latNorth, bounds.latSouth, v),
        lon: lerp(bounds.lonWest, bounds.lonEast, u)
      };
    };

    return {
      regionId,
      raw: rawHandle,
      meta,
      minX: -halfSpan,
      maxX: halfSpan,
      minZ: -halfSpan,
      maxZ: halfSpan,
      spanX: worldSpan,
      spanZ: worldSpan,
      waterY,
      datumElev,
      vScale,
      landmarks: (rawHandle && rawHandle.landmarks) || meta.landmarks || {},
      sampleHeight,
      sampleNormal,
      sampleSlope,
      sampleSlopeDegrees,
      sampleRealElevM,
      sampleBiome,
      sampleUpdraft,
      worldToLatLon
    };
  }

  /* ---------- 4. Main World Boot & Loop ---------- */
  async function bootEthiopiaWorld() {
    const canvas = document.getElementById("view");
    const stageWrap = document.getElementById("stage-wrap");
    const loaderEl = document.getElementById("world-loader");
    const loaderSub = document.getElementById("loader-sub");

    const renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,                 // the game surface's glass refracts this canvas
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    if (T.SRGBColorSpace) renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    const scene = new T.Scene();
    scene.background = new T.Color(0xc8d9ea);
    scene.fog = new T.FogExp2(0xc4d4e4, 0.00022);

    const camera = new T.PerspectiveCamera(46, window.innerWidth / Math.max(1, window.innerHeight), 0.25, 28000);

    // High-Altitude Abyssinian Sky Dome + Sun & Hemisphere Illumination
    const skyGeo = new T.SphereGeometry(22000, 32, 20);
    const skyUniforms = {
      uTopCol: { value: new T.Color(0x28568a) },
      uMidCol: { value: new T.Color(0x95bad8) },
      uBotCol: { value: new T.Color(0xe6decb) },
      uSunDir: { value: new T.Vector3(0.55, 0.42, 0.72).normalize() },
      uGolden: { value: 0.36 }
    };
    const skyMat = new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopCol;
        uniform vec3 uMidCol;
        uniform vec3 uBotCol;
        uniform vec3 uSunDir;
        uniform float uGolden;
        varying vec3 vWorldDir;
        void main() {
          vec3 d = normalize(vWorldDir);
          float h = clamp(d.y, -0.15, 1.0);
          vec3 col = h > 0.0
            ? mix(uMidCol, uTopCol, pow(h, 0.58))
            : mix(uBotCol, uMidCol, smoothstep(-0.15, 0.0, h));
          col = mix(col, uBotCol, smoothstep(0.22, -0.02, h) * (0.45 + 0.35 * uGolden));
          float sunDot = max(0.0, dot(d, normalize(uSunDir)));
          col += vec3(1.0, 0.78, 0.48) * pow(sunDot, 28.0) * (0.35 + 0.55 * uGolden);
          col += vec3(1.0, 0.94, 0.84) * smoothstep(0.9982, 0.9997, sunDot) * 0.95;
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    const skyDome = new T.Mesh(skyGeo, skyMat);
    skyDome.frustumCulled = false;
    scene.add(skyDome);

    const hemiLight = new T.HemisphereLight(0xdcebff, 0x7b634b, 0.92);
    scene.add(hemiLight);

    const sunLight = new T.DirectionalLight(0xfff0d4, 2.35);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 360;
    const shSpan = 68;
    sunLight.shadow.camera.left = -shSpan;
    sunLight.shadow.camera.right = shSpan;
    sunLight.shadow.camera.top = shSpan;
    sunLight.shadow.camera.bottom = -shSpan;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.06;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // 15-Look GPU Post-Processor (`study/look-audition-mv.js`)
    const LAMV = window.LookAuditionMV || null;
    const post = LAMV && typeof LAMV.createPostProcessor === "function"
      ? LAMV.createPostProcessor(T, renderer)
      : null;
    if (LAMV && typeof LAMV.injectSharedStyles === "function") {
      LAMV.injectSharedStyles();
    }
    let contactOverlay = null;
    if (LAMV && typeof LAMV.mountContactSheetOverlay === "function" && stageWrap) {
      contactOverlay = LAMV.mountContactSheetOverlay(stageWrap, pickedId => {
        setLook(pickedId);
      });
    }

    // World Containers
    const terrainRoot = new T.Group();
    terrainRoot.name = "TerrainPackRoot";
    const ecologyRoot = new T.Group();
    ecologyRoot.name = "EcologyRoot";
    const castRoot = new T.Group();
    castRoot.name = "ExpeditionCastRoot";
    scene.add(terrainRoot, ecologyRoot, castRoot);

    // Build Rogallo Glider + Contrails
    const rogallo = buildRogalloGlider(T);
    castRoot.add(rogallo.root, rogallo.ribbonL.line, rogallo.ribbonR.line);

    // Build Playable Cast: Imani + Mistletoe (with Cyan Pack & Lead Rope) + Makeda + June + Elder Berhanu
    const isNarrow = window.innerWidth < 768;
    const donkey = typeof window.makeDonkey === "function"
      ? window.makeDonkey({
          assetPath: "../donkey/",
          shells: isNarrow ? 6 : 10,
          contactShadow: true,
          alwaysHalter: true
        })
      : null;
    let packAddon = null;
    if (donkey) {
      donkey.state.tireless = true;
      packAddon = attachCyanAhiyaPack(T, donkey);
      castRoot.add(donkey.group);
    }

    const makeChar = spec => {
      if (typeof window.makeExpeditionCharacter !== "function") return null;
      const ch = window.makeExpeditionCharacter(T, Object.assign({ textureBase: "../donkey/" }, spec));
      if (ch && ch.label && ch.label.sprite) ch.label.sprite.visible = false;
      if (ch && ch.group) castRoot.add(ch.group);
      return ch;
    };

    const imani = makeChar({
      id: "eth_imani", name: "Imani", skinHex: 0x3b261b, fem: 0.86, scale: 1.0, build: 1.0,
      hair: "croppedCoily", outer: "duster", coatHex: 0x3b403c, shirtHex: 0x5c605a, trouserHex: 0x2c3032, toolBelt: true
    });
    const makeda = makeChar({
      id: "eth_makeda", name: "Makeda", skinHex: 0x422a1d, fem: 0.88, scale: 0.99, build: 1.0,
      hair: "cornrows", outer: "shamma", coatHex: 0xdfd8c8, shirtHex: 0x7e543a, trouserHex: 0x343230
    });
    const june = makeChar({
      id: "eth_june", name: "June", skinHex: 0x3f291e, fem: 0.56, scale: 0.82, build: 0.96,
      hair: "shortLocs", outer: "none", shirtHex: 0xb2a48c, trouserHex: 0x343635, tibebTrim: true, patchedKnees: true
    });
    const elder = makeChar({
      id: "eth_elder", name: "Elder Berhanu", skinHex: 0x3a2519, fem: 0.08, scale: 1.02, build: 1.04,
      hair: "turban", beard: "full", outer: "shamma", coatHex: 0xe6dfd0, shirtHex: 0x6a6358, trouserHex: 0x33312e
    });

    const worldBridge = window.Mesh2MotionWorldBridge
      ? window.Mesh2MotionWorldBridge.createWorldCastDriver(T, {
          clipsBaseUrl: "../motion-pipeline/mesh2motion/clips",
          preload: ["idle", "idle-talking", "walk", "walk-carry", "jog", "greeting"],
          defaultBlend: 0.85,
          defaultFade: 0.25
        })
      : null;
    if (worldBridge) {
      if (imani) worldBridge.registerActor("eth_imani", imani, { defaultClip: "idle", blend: 0.85 });
      if (makeda) worldBridge.registerActor("eth_makeda", makeda, { defaultClip: "idle-talking", blend: 0.84, phaseOffset: 0.4 });
      if (june) worldBridge.registerActor("eth_june", june, { defaultClip: "greeting", blend: 0.84, phaseOffset: 1.2 });
      if (elder) worldBridge.registerActor("eth_elder", elder, { defaultClip: "idle-talking", blend: 0.84, phaseOffset: 2.1 });
    }

    // Woven Catenary Lead Rope connecting Imani's right hand area to Mistletoe's halter ring
    const ROPE_PTS = 12;
    const ropeArr = new Float32Array(ROPE_PTS * 3);
    const ropeGeo = new T.BufferGeometry();
    ropeGeo.setAttribute("position", new T.BufferAttribute(ropeArr, 3));
    const leadRope = new T.Line(ropeGeo, new T.LineBasicMaterial({ color: 0xb89d6f }));
    leadRope.frustumCulled = false;
    castRoot.add(leadRope);

    // State
    let manifestData = null;
    let packInstance = null;
    let activeTerrain = null;
    let activeEcology = null;
    let activeRegionId = "simien_imet_gogo";
    let activeMode = "walk"; // "walk" | "glider" | "drone"
    let activeLookId = "raw";
    let goldenHour = 0.36;   // 0..1
    let monsoonMist = 0.32;  // 0..1
    let regionLoadToken = 0;

    // Player Walk & Camera Orbit State
    const player = {
      x: 0, y: 0, z: 0,
      heading: 0,
      speed: 0,
      gaitPhase: 0
    };
    const orbit = {
      yaw: 0.14,
      pitch: 0.20,
      dist: 8.6,
      dragging: false,
      lastX: 0,
      lastY: 0
    };

    // Rogallo Glider State
    const glider = {
      x: 0, y: 0, z: 0,
      yaw: 0,
      pitch: -0.08,
      bank: 0,
      airspeed: 16.5,
      vy: -1.1,
      orographicLift: 0,
      agl: 40
    };

    // Cinema Drone State
    const drone = {
      shotIdx: 0,
      shotTime: 0,
      shotDuration: 11.5
    };

    // Input State (Keyboard + Mobile Virtual Stick)
    const keys = Object.create(null);
    const touchStick = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };

    // Smooth surface helper that respects the flat stone relay apron & church court
    function walkSurfaceAt(x, z) {
      if (!activeTerrain) return 0;
      let h = activeTerrain.sampleHeight(x, z);
      if (activeEcology && activeEcology.landmarks) {
        const rp = activeEcology.landmarks.relayPos;
        if (rp) {
          const dr = Math.hypot(x - rp.x, z - rp.z);
          if (dr < 3.18) {
            const blend = smooth(3.18, 2.45, dr);
            h = lerp(h, rp.y, blend);
          }
        }
        const cp = activeEcology.landmarks.churchPos;
        if (cp) {
          const dx = Math.abs(x - cp.x), dz = Math.abs(z - cp.z);
          if (dx < 7.2 && dz < 7.2) {
            const blend = smooth(7.2, 6.2, Math.max(dx, dz));
            h = lerp(h, cp.y, blend);
          }
        }
      }
      return h;
    }

    /* ---------- 5. Sun / Golden-Hour & Monsoon-Mist Synchronization ---------- */
    const sunDirVec = new T.Vector3();
    function applyAtmosphere() {
      if (packInstance && typeof packInstance.setGoldenHour === "function") {
        packInstance.setGoldenHour(goldenHour);
        if (typeof packInstance.setMist === "function") packInstance.setMist(monsoonMist);
        if (packInstance.uniforms && packInstance.uniforms.uSunDir && packInstance.uniforms.uSunDir.value) {
          sunDirVec.copy(packInstance.uniforms.uSunDir.value).normalize();
        }
        if (packInstance.skyMesh) skyDome.visible = false;
      } else {
        const elevRad = lerp(44 * DEG, 9.5 * DEG, goldenHour);
        const azimRad = lerp(52 * DEG, 112 * DEG, goldenHour);
        sunDirVec.set(
          Math.cos(elevRad) * Math.sin(azimRad),
          Math.sin(elevRad),
          Math.cos(elevRad) * Math.cos(azimRad)
        ).normalize();
      }

      skyUniforms.uSunDir.value.copy(sunDirVec);
      skyUniforms.uGolden.value = goldenHour;

      const dayTop = new T.Color(0x24558c), goldTop = new T.Color(0x28365e);
      const dayMid = new T.Color(0x8fb8dc), goldMid = new T.Color(0xd88c58);
      const dayBot = new T.Color(0xe5dfd0), goldBot = new T.Color(0xffbe76);
      skyUniforms.uTopCol.value.copy(dayTop).lerp(goldTop, goldenHour * 0.78);
      skyUniforms.uMidCol.value.copy(dayMid).lerp(goldMid, goldenHour * 0.72);
      skyUniforms.uBotCol.value.copy(dayBot).lerp(goldBot, goldenHour * 0.85);

      sunLight.color.setHex(0xfff4df).lerp(new T.Color(0xff9b48), goldenHour * 0.78);
      sunLight.intensity = lerp(2.25, 2.65, goldenHour);

      hemiLight.color.copy(skyUniforms.uMidCol.value);
      hemiLight.groundColor.setHex(0x7c634a).lerp(new T.Color(0x523828), goldenHour * 0.5);
      hemiLight.intensity = lerp(0.92, 0.72, goldenHour);

      scene.fog.color.copy(skyUniforms.uBotCol.value).lerp(skyUniforms.uMidCol.value, 0.35);
      scene.fog.density = lerp(0.000042, 0.00021, monsoonMist);
      scene.background.copy(scene.fog.color);
    }

    /* ---------- 6. Region Terrain Loader (Native `EthiopiaHighlandsPack` + Fallback) ---------- */
    async function mountFallbackDemTerrain(regionId) {
      if (!manifestData) manifestData = await loadManifestFallback();
      const reg = manifestData.regions[regionId];
      const binResp = await fetch(`./terrain-pack/${reg.files.dem16Bin}`);
      const buf = await binResp.arrayBuffer();
      const u16 = new Uint16Array(buf);
      const grid = reg.gridSize || 384;
      const span = reg.worldSpanM || 2400;
      const half = span * 0.5;
      const heights = new Float32Array(grid * grid);
      for (let i = 0; i < heights.length; i++) {
        const elevM = reg.minElevM + (u16[i] / 65535) * (reg.maxElevM - reg.minElevM);
        heights[i] = (elevM - reg.datumElevM) * reg.verticalScale;
      }

      const geo = new T.PlaneGeometry(span, span, grid - 1, grid - 1);
      geo.rotateX(-Math.PI * 0.5);
      const pos = geo.attributes.position;
      const col = new Float32Array(pos.count * 3);
      const isGheralta = regionId.indexOf("gheralta") >= 0;
      for (let i = 0; i < pos.count; i++) {
        const wy = heights[i] || 0;
        pos.setY(i, wy);
      }
      geo.computeVertexNormals();
      const nrm = geo.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        const wy = pos.getY(i);
        const slope = 1 - nrm.getY(i);
        const elevM = reg.datumElevM + wy / reg.verticalScale;
        let r = 0.34, g = 0.42, b = 0.25;
        if (slope > 0.28) {
          r = isGheralta ? 0.72 : 0.28;
          g = isGheralta ? 0.39 : 0.27;
          b = isGheralta ? 0.24 : 0.29;
        } else if (elevM > 3200) {
          r = 0.42; g = 0.46; b = 0.28;
        }
        col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
      }
      geo.setAttribute("color", new T.BufferAttribute(col, 3));
      const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
      const mesh = new T.Mesh(geo, mat);
      mesh.receiveShadow = true;
      const grp = new T.Group();
      grp.add(mesh);
      terrainRoot.add(grp);

      const sampleHeight = (x, z) => {
        const u = clamp((x + half) / span, 0, 1) * (grid - 1);
        const v = clamp((z + half) / span, 0, 1) * (grid - 1);
        const i0 = Math.floor(u), j0 = Math.floor(v);
        const i1 = Math.min(grid - 1, i0 + 1), j1 = Math.min(grid - 1, j0 + 1);
        const fu = u - i0, fv = v - j0;
        const h00 = heights[j0 * grid + i0], h10 = heights[j0 * grid + i1];
        const h01 = heights[j1 * grid + i0], h11 = heights[j1 * grid + i1];
        return lerp(lerp(h00, h10, fu), lerp(h01, h11, fu), fv);
      };

      return {
        group: grp,
        manifest: reg,
        landmarks: reg.landmarks,
        sampleHeight,
        dispose() {
          geo.dispose();
          mat.dispose();
          terrainRoot.remove(grp);
        }
      };
    }

    async function loadRegion(regionIdInput, opts = {}) {
      const regionId = resolveRegionId(regionIdInput);
      const token = ++regionLoadToken;
      activeRegionId = regionId;

      if (loaderSub) {
        const meta = REGION_META.find(r => r.id === regionId);
        loaderSub.textContent = `Loading Real Satellite DEM · ${meta ? meta.title : regionId}`;
      }

      // Clean previous ecology & fallback terrain
      if (activeEcology) {
        ecologyRoot.remove(activeEcology.root);
        activeEcology.dispose();
        activeEcology = null;
      }
      if (activeTerrain && activeTerrain.raw && activeTerrain.raw._isFallback) {
        activeTerrain.raw.dispose();
      }

      if (!manifestData) {
        try { manifestData = await loadManifestFallback(); } catch (_e) { /* optional */ }
      }
      const manifestReg = manifestData && manifestData.regions ? manifestData.regions[regionId] : null;

      let rawHandle = null;
      let loadedRegionMeta = null;
      const PackAPI = window.EthiopiaHighlandsPack;
      if (PackAPI) {
        try {
          if (!packInstance) {
            packInstance = await PackAPI.create(T, {
              baseUrl: "./terrain-pack/",
              region: regionId,
              goldenHour,
              mist: monsoonMist,
              includeSky: true
            });
            if (packInstance && packInstance.group && packInstance.group.parent !== terrainRoot) {
              terrainRoot.add(packInstance.group);
            }
          } else if (typeof packInstance.loadRegion === "function") {
            loadedRegionMeta = await packInstance.loadRegion(regionId);
          }
          rawHandle = packInstance;
        } catch (err) {
          console.warn("[ethiopia-world] EthiopiaHighlandsPack adapter fallback:", err);
        }
      }

      if (!rawHandle) {
        rawHandle = await mountFallbackDemTerrain(regionId);
        rawHandle._isFallback = true;
      }

      if (token !== regionLoadToken) return null;

      const regionMetaObj = loadedRegionMeta || (packInstance && packInstance.activeRegion) || manifestReg;
      activeTerrain = wrapTerrainHandle(rawHandle, regionId, regionMetaObj);

      // Build Endemic Flora, Rock-Hewn Church, Tukul/Hidmo Hamlet, Cyan Standpipe & SILAS Wildlife
      if (window.EthiopiaEndemicFauna && typeof window.EthiopiaEndemicFauna.createEndemicWorld === "function") {
        activeEcology = window.EthiopiaEndemicFauna.createEndemicWorld(T, activeTerrain);
        ecologyRoot.add(activeEcology.root);
      }

      // Stage Imani, Mistletoe, Makeda, June & Elder Berhanu at Region's Scenic Spawn & Relay
      stageCastForRegion(regionId);
      resetGliderAtLaunch();
      drone.shotIdx = 0;
      drone.shotTime = 0;

      applyAtmosphere();
      syncAllUI();
      syncUrlParams();

      if (loaderEl && !loaderEl.hidden) {
        loaderEl.classList.add("fade-out");
        setTimeout(() => { loaderEl.hidden = true; }, 520);
      }
      return getState();
    }

    /* ---------- 7. Stage Expedition Cast, Donkey & Teleport Landmarks ---------- */
    function stageCastForRegion(regionId) {
      if (!activeTerrain) return;
      const lm = (activeEcology && activeEcology.landmarks) || {};
      const regMeta = REGION_META.find(r => r.id === regionId) || REGION_META[0];

      // Choose hero walk spawn so opening camera frames Imani + Mistletoe + Endemic Flora/Fauna + Sheer Escarpment/Spires!
      let spawnX = 0, spawnZ = 0, camYaw = regMeta.defaultCamYaw;
      if (regionId === "gheralta_spires") {
        // Frame Mistletoe & Imani on the Acacia plain looking past the Cruciform Church straight up at Gheralta's sandstone spires!
        const rp = lm.relayPos || { x: 24, z: 215 };
        const cp = lm.churchPos || { x: -88, z: 145 };
        spawnX = lerp(rp.x, cp.x, 0.35);
        spawnZ = lerp(rp.z, cp.z, 0.25);
        camYaw = Math.atan2(spawnX - (cp.x + 25), spawnZ - (cp.z - 120));
      } else if (lm.primaryLookout) {
        spawnX = lm.primaryLookout.x;
        spawnZ = lm.primaryLookout.z;
        if (regionId === "simien_imet_gogo") {
          // Spawn on the Wurch promontory meadow (6.0, -434.0) looking across Giant Lobelias & seated Geladas (2.5, -446.5) + Imet Gogo basalt cliff wall & cumulus cloud-sea!
          spawnX = 6.0;
          spawnZ = -434.0;
          camYaw = 0.56;
        } else if (regionId === "blue_nile_gorge") {
          spawnZ -= 6.0;
          camYaw = Math.PI - 0.14;
        } else if (regionId === "gerd_belaya_escarpment") {
          camYaw = -1.28;
        }
      }

      player.x = spawnX;
      player.z = spawnZ;
      player.y = walkSurfaceAt(spawnX, spawnZ);
      player.heading = wrapAngle(camYaw + Math.PI * 0.82); // 3/4 heroic expedition angle
      player.speed = 0;

      orbit.yaw = camYaw;
      orbit.pitch = regionId === "simien_imet_gogo" ? 0.28 : 0.19;
      orbit.dist = regionId === "simien_imet_gogo" ? 9.0 : 8.4;

      if (imani) {
        imani.place(player.x, player.z, player.heading, walkSurfaceAt);
      }
      if (donkey) {
        const dx = player.x + Math.cos(orbit.yaw) * 1.35 + Math.sin(orbit.yaw) * 0.45;
        const dz = player.z - Math.sin(orbit.yaw) * 1.35 + Math.cos(orbit.yaw) * 0.45;
        donkey.place(dx, dz, player.heading - 0.18, walkSurfaceAt);
      }

      // Place Makeda & June at the Cyan-Water Standpipe Relay and Elder Berhanu at the Rock-Hewn Church!
      if (lm.relayPos) {
        const rx = lm.relayPos.x, rz = lm.relayPos.z;
        if (makeda) makeda.place(rx - 0.92, rz + 0.35, Math.PI * 0.42, walkSurfaceAt);
        if (june) june.place(rx + 0.86, rz + 0.42, -Math.PI * 0.38, walkSurfaceAt);
      }
      if (lm.churchPos && elder) {
        const chH = lm.churchHeading || 0;
        const ex = lm.churchPos.x + Math.sin(chH) * 5.6;
        const ez = lm.churchPos.z + Math.cos(chH) * 5.6;
        elder.place(ex, ez, chH, walkSurfaceAt);
      }
    }

    function teleportTo(key) {
      if (!activeTerrain || !activeEcology) return getState();
      const lm = activeEcology.landmarks;
      let target = null;
      if (key === "lookout") target = lm.primaryLookout;
      else if (key === "relay") target = lm.relayPos ? { x: lm.relayPos.x + 1.8, z: lm.relayPos.z + 2.6 } : null;
      else if (key === "church") target = lm.churchPos ? { x: lm.churchPos.x + Math.sin(lm.churchHeading || 0) * 8.5, z: lm.churchPos.z + Math.cos(lm.churchHeading || 0) * 8.5 } : null;
      else if (key === "gelada") target = lm.geladaMeadow ? { x: lm.geladaMeadow.x + 5.5, z: lm.geladaMeadow.z + 5.5 } : null;
      else if (key === "ibex") target = lm.ibexLedge ? { x: lm.ibexLedge.x + 4.0, z: lm.ibexLedge.z + 4.0 } : null;

      if (target) {
        setMode("walk");
        player.x = clamp(target.x, activeTerrain.minX + 18, activeTerrain.maxX - 18);
        player.z = clamp(target.z, activeTerrain.minZ + 18, activeTerrain.maxZ - 18);
        player.y = walkSurfaceAt(player.x, player.z);
        if (imani) imani.place(player.x, player.z, player.heading, walkSurfaceAt);
        if (donkey) donkey.place(player.x + 1.4, player.z + 0.6, player.heading, walkSurfaceAt);
      }
      return getState();
    }

    /* ---------- 8. Rogallo Hang-Glider Launch & Ridge-Lift Flight Physics ---------- */
    function resetGliderAtLaunch() {
      if (!activeTerrain) return;
      const rawLm = activeTerrain.landmarks || {};
      const lp = rawLm.gliderLaunchPoint || (activeEcology && activeEcology.landmarks && activeEcology.landmarks.primaryLookout) || { x: 0, z: 0 };
      glider.x = lp.x || 0;
      glider.z = lp.z || 0;
      const gy = activeTerrain.sampleHeight(glider.x, glider.z);
      glider.y = gy + 18.0; // Clean cliff-rim launch altitude
      if (Array.isArray(lp.launchDir) && lp.launchDir.length >= 3) {
        glider.yaw = Math.atan2(lp.launchDir[0], lp.launchDir[2]);
      } else if (typeof lp.yaw === "number") {
        glider.yaw = lp.yaw;
      } else {
        glider.yaw = 0;
      }
      glider.pitch = -0.06;
      glider.bank = 0;
      glider.airspeed = 17.5;
      glider.vy = -0.8;
      glider.orographicLift = 1.6;
      rogallo.updateContrails(false);
    }

    const nrmGlider = new T.Vector3();
    function stepGlider(dt, nowSec) {
      if (!activeTerrain) return;
      const turnInput = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0) - touchStick.dx;
      const pitchInput = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + touchStick.dy;

      // Gentle auto-soar figure-8 ridge patrol if user is hands-off so glider stays scenic & airborne!
      const manual = Math.abs(turnInput) > 0.04 || Math.abs(pitchInput) > 0.04;
      const autoBank = manual ? 0 : Math.sin(nowSec * 0.28) * 0.24;

      const targetBank = clamp(turnInput * 0.68 + autoBank, -0.78, 0.78);
      glider.bank = lerp(glider.bank, targetBank, dt * 3.8);
      glider.yaw = wrapAngle(glider.yaw + Math.sin(glider.bank) * 0.72 * dt);

      const targetPitch = clamp(pitchInput * 0.34 - 0.05, -0.42, 0.28);
      glider.pitch = lerp(glider.pitch, targetPitch, dt * 3.2);

      // Speed responds to dive/climb pitch
      const targetSpeed = clamp(17.5 - glider.pitch * 18.0, 11.5, 29.0);
      glider.airspeed = lerp(glider.airspeed, targetSpeed, dt * 2.2);

      // Real Orographic Ridge Lift from `pack.sampleUpdraft` (`sampleSlope` + windward escarpment lift)!
      const groundY = activeTerrain.sampleHeight(glider.x, glider.z);
      const regMeta = REGION_META.find(r => r.id === activeRegionId) || REGION_META[0];
      glider.agl = Math.max(0, glider.y - groundY);
      const rawUpdraft = activeTerrain.sampleUpdraft(glider.x, glider.z, regMeta.windDir);
      const altDecay = Math.exp(-glider.agl / 260.0);
      glider.orographicLift = rawUpdraft * altDecay + 0.32 * Math.max(0, Math.sin(nowSec * 0.7));

      const polarSink = -1.18 - 0.025 * Math.pow(glider.airspeed - 16.0, 2);
      glider.vy = polarSink + glider.orographicLift + Math.sin(glider.pitch) * glider.airspeed * 0.55;

      glider.x += Math.sin(glider.yaw) * glider.airspeed * dt;
      glider.z += Math.cos(glider.yaw) * glider.airspeed * dt;
      glider.y += glider.vy * dt;

      // Keep inside massif bounds & safely above cliff ground
      const margin = 85;
      if (glider.x < activeTerrain.minX + margin || glider.x > activeTerrain.maxX - margin ||
          glider.z < activeTerrain.minZ + margin || glider.z > activeTerrain.maxZ - margin) {
        glider.yaw = Math.atan2(-glider.x, -glider.z);
      }
      const newGround = activeTerrain.sampleHeight(glider.x, glider.z);
      const minClearance = Math.max(newGround + 6.5, (activeTerrain.waterY || -9999) + 8.0);
      if (glider.y < minClearance) {
        glider.y = minClearance;
        glider.vy = Math.max(0.8, glider.vy);
        glider.pitch = Math.max(0.02, glider.pitch);
      }
      glider.agl = glider.y - newGround;

      rogallo.root.visible = true;
      rogallo.root.position.set(glider.x, glider.y, glider.z);
      rogallo.root.rotation.set(0, glider.yaw, 0, "YXZ");
      rogallo.wingPivot.rotation.set(-glider.pitch * 0.85, 0, -glider.bank);
      rogallo.pilotPod.rotation.z = glider.bank * 0.38;
      rogallo.updateContrails(true);

      // Dramatic Aerial Chase Camera framing Rogallo Delta Sail + Escarpment Abyss
      const chaseDist = 11.6;
      const chaseUp = 4.6;
      const cx = glider.x - Math.sin(glider.yaw) * chaseDist;
      const cz = glider.z - Math.cos(glider.yaw) * chaseDist;
      const cy = Math.max(activeTerrain.sampleHeight(cx, cz) + 2.5, glider.y + chaseUp - glider.pitch * 4.5);
      camera.position.lerp(new T.Vector3(cx, cy, cz), clamp(dt * 6.5, 0, 1));
      camera.lookAt(
        glider.x + Math.sin(glider.yaw) * 14.0,
        glider.y - 2.9,
        glider.z + Math.cos(glider.yaw) * 14.0
      );
    }

    /* ---------- 9. Walk & Lead Controller + Cinema Drone Tour ---------- */
    const halterWorld = new T.Vector3();
    const handAnchorWorld = new T.Vector3();
    const camDesired = new T.Vector3();
    const camLookTarget = new T.Vector3();

    function stepWalkAndLead(dt, nowSec) {
      if (!activeTerrain) return;
      rogallo.root.visible = false;
      rogallo.updateContrails(false);
      if (imani) imani.group.visible = true;
      leadRope.visible = Boolean(imani && donkey);

      const fwdIn = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - touchStick.dy;
      const strIn = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touchStick.dx;
      const mag = Math.min(1, Math.hypot(fwdIn, strIn));
      const sprint = keys.ShiftLeft || keys.ShiftRight ? 1.55 : 1.0;

      if (mag > 0.05) {
        // Move relative to current camera yaw
        const moveDir = Math.atan2(
          -Math.sin(orbit.yaw) * fwdIn + Math.cos(orbit.yaw) * strIn,
          -Math.cos(orbit.yaw) * fwdIn - Math.sin(orbit.yaw) * strIn
        );
        player.heading = wrapAngle(player.heading + clamp(wrapAngle(moveDir - player.heading), -7.5 * dt, 7.5 * dt));
        const maxSpd = 3.8 * sprint * mag;
        player.speed = lerp(player.speed, maxSpd, dt * 6.5);

        const nx = clamp(player.x + Math.sin(player.heading) * player.speed * dt, activeTerrain.minX + 12, activeTerrain.maxX - 12);
        const nz = clamp(player.z + Math.cos(player.heading) * player.speed * dt, activeTerrain.minZ + 12, activeTerrain.maxZ - 12);
        const nSlope = activeTerrain.sampleSlope(nx, nz);
        const ny = walkSurfaceAt(nx, nz);
        if (nSlope < 0.66 && ny > (activeTerrain.waterY || -9999) + 1.1) {
          player.x = nx;
          player.z = nz;
        }
      } else {
        player.speed = lerp(player.speed, 0, dt * 8.0);
      }

      player.y = walkSurfaceAt(player.x, player.z);

      // Update Imani
      if (imani) {
        imani.place(player.x, player.z, player.heading, walkSurfaceAt);
        if (player.speed > 0.14) {
          player.gaitPhase += dt * (3.6 + player.speed * 1.15);
          imani.update(dt, nowSec, {
            pose: "walk",
            gaitPhase: player.gaitPhase,
            walkRate: 4.8,
            stepLen: clamp(0.18 + player.speed * 0.035, 0.18, 0.31),
            surfaceAt: walkSurfaceAt,
            lodDist: orbit.dist
          });
        } else {
          imani.update(dt, nowSec, {
            pose: "idle",
            carryCan: true,
            surfaceAt: walkSurfaceAt,
            lookAt: donkey ? donkey.group.position : camera.position,
            lodDist: orbit.dist
          });
        }
      }

      // Update Mistletoe following smoothly 2.0m behind/beside Imani!
      if (donkey) {
        const followX = player.x - Math.sin(player.heading) * 1.75 + Math.cos(player.heading) * 1.15;
        const followZ = player.z - Math.cos(player.heading) * 1.75 - Math.sin(player.heading) * 1.15;
        const dx = followX - donkey.state.x;
        const dz = followZ - donkey.state.z;
        const dist = Math.hypot(dx, dz);
        let throttle = 0, steer = 0, pace = 0;
        if (dist > 0.65) {
          const wantH = Math.atan2(dx, dz);
          const diffH = wrapAngle(wantH - donkey.state.heading);
          steer = clamp(diffH * 1.35, -1, 1);
          throttle = clamp((dist - 0.55) * 0.65, 0, 1);
          pace = dist > 4.2 ? 1 : 0;
        }
        donkey.update(dt, { throttle, steer, pace, near: dist < 2.6 }, walkSurfaceAt);

        // Update woven lead rope catenary
        donkey.halterRing(halterWorld);
        handAnchorWorld.set(
          player.x + Math.cos(player.heading) * 0.28 + Math.sin(player.heading) * 0.12,
          player.y + 0.94,
          player.z - Math.sin(player.heading) * 0.28 + Math.cos(player.heading) * 0.12
        );
        const sag = clamp(0.26 - dist * 0.04, 0.05, 0.28);
        for (let i = 0; i < ROPE_PTS; i++) {
          const f = i / (ROPE_PTS - 1);
          ropeArr[i * 3] = lerp(handAnchorWorld.x, halterWorld.x, f);
          ropeArr[i * 3 + 1] = lerp(handAnchorWorld.y, halterWorld.y, f) - Math.sin(f * Math.PI) * sag;
          ropeArr[i * 3 + 2] = lerp(handAnchorWorld.z, halterWorld.z, f);
        }
        ropeGeo.attributes.position.needsUpdate = true;
      }

      // Orbit Camera Ground-Safe Placement
      const focusX = donkey ? lerp(player.x, donkey.state.x, 0.28) : player.x;
      const focusZ = donkey ? lerp(player.z, donkey.state.z, 0.28) : player.z;
      const focusY = walkSurfaceAt(focusX, focusZ) + 1.38;
      camLookTarget.set(focusX, focusY, focusZ);

      const cosP = Math.cos(orbit.pitch);
      const cx = focusX + Math.sin(orbit.yaw) * cosP * orbit.dist;
      const cz = focusZ + Math.cos(orbit.yaw) * cosP * orbit.dist;
      const minCamY = activeTerrain.sampleHeight(cx, cz) + 0.85;
      const cy = Math.max(minCamY, focusY + Math.sin(orbit.pitch) * orbit.dist);
      camDesired.set(cx, cy, cz);
      camera.position.copy(camDesired);
      camera.lookAt(camLookTarget);
    }

    function stepCinemaDrone(dt, nowSec) {
      if (!activeTerrain || !activeEcology) return;
      rogallo.root.visible = false;
      rogallo.updateContrails(false);
      if (imani) imani.group.visible = true;
      if (donkey) donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: true }, walkSurfaceAt);
      if (imani) {
        imani.update(dt, nowSec, {
          pose: "idle",
          carryCan: true,
          surfaceAt: walkSurfaceAt,
          lookAt: donkey ? donkey.group.position : undefined,
          lodDist: 6
        });
      }

      drone.shotTime += dt;
      if (drone.shotTime >= drone.shotDuration) {
        drone.shotTime = 0;
        drone.shotIdx = (drone.shotIdx + 1) % 5;
      }
      const u = drone.shotTime / drone.shotDuration;
      const lm = activeEcology.landmarks;
      const rawLm = activeTerrain.landmarks || {};

      if (drone.shotIdx === 0 && rawLm.cameraHero) {
        // Shot 1: Hero Escarpment / Sandstone Spire / Canyon Vista Sweep
        const p = rawLm.cameraHero.position;
        const t = rawLm.cameraHero.target;
        const drift = (u - 0.5) * 34.0;
        const cx = p[0] + drift;
        const cz = p[2] + drift * 0.35;
        const cy = Math.max(activeTerrain.sampleHeight(cx, cz) + 4.0, p[1] + u * 12.0);
        camera.position.set(cx, cy, cz);
        camera.lookAt(t[0], t[1], t[2]);
      } else if (drone.shotIdx === 1) {
        // Shot 2: Gelada Troop & Giant Lobelia Close-Up Tracking Shot
        const gm = lm.geladaMeadow || lm.primaryLookout;
        const ang = -0.6 + u * 0.95;
        const rad = 11.5;
        const cx = gm.x + Math.sin(ang) * rad;
        const cz = gm.z + Math.cos(ang) * rad;
        const cy = activeTerrain.sampleHeight(cx, cz) + 2.35;
        camera.position.set(cx, cy, cz);
        camera.lookAt(gm.x, activeTerrain.sampleHeight(gm.x, gm.z) + 0.9, gm.z);
      } else if (drone.shotIdx === 2) {
        // Shot 3: Rock-Hewn Monolithic Cruciform Church Architectural Orbit
        const cp = lm.churchPos;
        const ang = (lm.churchHeading || 0) - 0.55 + u * 1.1;
        const rad = 16.5;
        const cx = cp.x + Math.sin(ang) * rad;
        const cz = cp.z + Math.cos(ang) * rad;
        const cy = Math.max(activeTerrain.sampleHeight(cx, cz) + 2.5, cp.y + 6.8);
        camera.position.set(cx, cy, cz);
        camera.lookAt(cp.x, cp.y + 3.6, cp.z);
      } else if (drone.shotIdx === 3) {
        // Shot 4: Cyan-Water Standpipe Relay, Makeda & June
        const rp = lm.relayPos;
        const ang = -0.5 + u * 1.0;
        const rad = 6.2;
        const cx = rp.x + Math.sin(ang) * rad;
        const cz = rp.z + Math.cos(ang) * rad;
        const cy = walkSurfaceAt(cx, cz) + 1.85;
        camera.position.set(cx, cy, cz);
        camera.lookAt(rp.x, rp.y + 1.15, rp.z);
      } else {
        // Shot 5: High Aerial Ridge Flyover Above Imani, Mistletoe & Walia Ibex Ledges
        const pl = lm.primaryLookout;
        const ang = orbit.yaw - 0.5 + u * 1.0;
        const rad = 28.0;
        const cx = pl.x + Math.sin(ang) * rad;
        const cz = pl.z + Math.cos(ang) * rad;
        const cy = Math.max(activeTerrain.sampleHeight(cx, cz) + 6.0, pl.y + 14.5);
        camera.position.set(cx, cy, cz);
        camera.lookAt(pl.x, pl.y + 1.5, pl.z);
      }
    }

    function stepSupportingCast(dt, nowSec) {
      for (const ch of [makeda, june, elder]) {
        if (!ch || !ch.group.visible) continue;
        const dCam = Math.hypot(camera.position.x - ch.state.x, camera.position.z - ch.state.z);
        if (dCam < 95) {
          ch.update(dt, nowSec, {
            pose: "idle",
            surfaceAt: walkSurfaceAt,
            lookAt: dCam < 18 ? camera.position : (donkey ? donkey.group.position : undefined),
            lodDist: dCam
          });
        }
      }
    }

    /* ---------- 10. Public Controls, UI & URL Deep-Linking ---------- */
    function setMode(modeInput) {
      const m = String(modeInput || "walk").toLowerCase();
      if (m === "glider" || m === "rogallo" || m === "soar") {
        activeMode = "glider";
        if (imani) imani.group.visible = false;
        leadRope.visible = false;
        resetGliderAtLaunch();
      } else if (m === "drone" || m === "cinema" || m === "tour") {
        activeMode = "drone";
        drone.shotTime = 0;
      } else {
        activeMode = "walk";
      }
      syncAllUI();
      syncUrlParams();
      return activeMode;
    }

    function setLook(lookId) {
      const clean = String(lookId || "raw").trim().toLowerCase();
      if (!post || !LAMV) {
        activeLookId = "raw";
        return activeLookId;
      }
      if (clean === "sheet" || clean === "contact") {
        post.setContactSheet(true);
        activeLookId = "sheet";
        if (contactOverlay) contactOverlay.setVisible(true);
      } else {
        post.setContactSheet(false);
        const resolved = post.setLook(clean);
        activeLookId = resolved ? resolved.id : "raw";
        if (contactOverlay) contactOverlay.setVisible(false);
      }
      syncAllUI();
      syncUrlParams();
      return activeLookId;
    }

    function syncUrlParams() {
      if (typeof history === "undefined" || !history.replaceState) return;
      try {
        const params = new URLSearchParams(window.location.search);
        params.set("region", activeRegionId);
        if (activeLookId && activeLookId !== "raw") params.set("look", activeLookId);
        else params.delete("look");
        if (activeMode && activeMode !== "walk") params.set("mode", activeMode);
        else params.delete("mode");
        const qs = params.toString();
        history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
      } catch (_e) { /* ignore */ }
    }

    // Build & Bind UI Controls
    function initHudBindings() {
      const regRow = document.getElementById("region-pills");
      if (regRow) {
        regRow.innerHTML = REGION_META.map(r => `
          <button type="button" class="pill reg-pill" data-region="${r.id}" title="${r.title}">
            ${r.short}
          </button>
        `).join("");
        regRow.querySelectorAll("[data-region]").forEach(btn => {
          btn.addEventListener("click", () => loadRegion(btn.dataset.region));
        });
      }

      document.querySelectorAll("[data-mode]").forEach(btn => {
        btn.addEventListener("click", () => setMode(btn.dataset.mode));
      });

      document.querySelectorAll("[data-tp]").forEach(btn => {
        btn.addEventListener("click", () => teleportTo(btn.dataset.tp));
      });

      const lookRow = document.getElementById("look-pills");
      if (lookRow && LAMV) {
        const order = LAMV.UI_LOOK_ORDER || ["raw", "jerikan", "silver", "risograph", "woodblock", "cyanotype", "inkwash", "silhouette"];
        const buttonsHtml = order.map(id => {
          const lk = LAMV.resolveLook(id);
          return `<button type="button" class="pill look-pill" data-look="${lk.id}" title="${lk.desc || lk.name}">${lk.short}</button>`;
        }).join("") + `<button type="button" class="pill look-pill" data-look="sheet" title="Live 3×3 9-Look Shader Contact Sheet">3×3 Sheet</button>`;
        lookRow.innerHTML = buttonsHtml;
        lookRow.querySelectorAll("[data-look]").forEach(btn => {
          btn.addEventListener("click", () => setLook(btn.dataset.look));
        });
      }

      const slSun = document.getElementById("sl-golden");
      if (slSun) {
        slSun.value = String(Math.round(goldenHour * 100));
        slSun.addEventListener("input", () => {
          goldenHour = clamp(Number(slSun.value) / 100, 0, 1);
          const lbl = document.getElementById("val-golden");
          if (lbl) lbl.textContent = `${Math.round(goldenHour * 100)}%`;
          applyAtmosphere();
        });
      }

      const slMist = document.getElementById("sl-mist");
      if (slMist) {
        slMist.value = String(Math.round(monsoonMist * 100));
        slMist.addEventListener("input", () => {
          monsoonMist = clamp(Number(slMist.value) / 100, 0, 1);
          const lbl = document.getElementById("val-mist");
          if (lbl) lbl.textContent = `${Math.round(monsoonMist * 100)}%`;
          applyAtmosphere();
        });
      }

      const btnShare = document.getElementById("btn-share");
      if (btnShare) {
        btnShare.addEventListener("click", () => {
          syncUrlParams();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(window.location.href).then(() => {
              const orig = btnShare.textContent;
              btnShare.textContent = "Copied URL!";
              setTimeout(() => { btnShare.textContent = orig; }, 1400);
            }).catch(() => {});
          }
        });
      }

      const btnHudToggle = document.getElementById("btn-hud-toggle");
      if (btnHudToggle) {
        btnHudToggle.addEventListener("click", () => {
          const collapsed = document.body.classList.toggle("hud-compact");
          btnHudToggle.setAttribute("aria-pressed", String(!collapsed));
          btnHudToggle.textContent = collapsed ? "Controls ▴" : "Hide UI ▾";
        });
      }
    }

    function syncAllUI() {
      const regMeta = REGION_META.find(r => r.id === activeRegionId) || REGION_META[0];
      const titleEl = document.getElementById("region-title");
      const subEl = document.getElementById("region-sub");
      if (titleEl) titleEl.textContent = regMeta.title;
      if (subEl) subEl.textContent = regMeta.sub;

      document.querySelectorAll("[data-region]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.region === activeRegionId);
      });
      document.querySelectorAll("[data-mode]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.mode === activeMode);
      });
      document.querySelectorAll("[data-look]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.look === activeLookId);
      });
    }

    const hudEls = {};
    function updateAltimeterHud(fpsVal) {
      if (!activeTerrain) return;
      if (!hudEls.gps) {
        hudEls.gps = document.getElementById("hud-gps");
        hudEls.elev = document.getElementById("hud-elev");
        hudEls.zone = document.getElementById("hud-zone");
        hudEls.zoneSub = document.getElementById("hud-zone-sub");
        hudEls.fauna = document.getElementById("hud-fauna");
        hudEls.flight = document.getElementById("hud-flight");
      }

      const refX = activeMode === "glider" ? glider.x : (activeMode === "drone" ? camera.position.x : player.x);
      const refZ = activeMode === "glider" ? glider.z : (activeMode === "drone" ? camera.position.z : player.z);
      const groundElevM = activeTerrain.sampleRealElevM(refX, refZ);
      const displayElevM = activeMode === "glider"
        ? groundElevM + glider.agl / (activeTerrain.vScale || 0.6)
        : groundElevM;
      const slopeDeg = activeTerrain.sampleSlopeDegrees(refX, refZ);
      const ll = activeTerrain.worldToLatLon(refX, refZ);
      const biomeKey = activeTerrain.sampleBiome(refX, refZ);
      const bInfo = BIOME_INFO[biomeKey] || BIOME_INFO.dega;

      if (hudEls.gps) {
        hudEls.gps.textContent = `${ll.lat.toFixed(4)}° N · ${ll.lon.toFixed(4)}° E`;
      }
      if (hudEls.elev) {
        hudEls.elev.textContent = `${Math.round(displayElevM).toLocaleString()} m ASL · SLOPE ${slopeDeg.toFixed(0)}° · ${Math.round(fpsVal)} FPS`;
      }
      if (hudEls.zone) {
        hudEls.zone.textContent = `${bInfo.code} (${bInfo.geez}) · ${bInfo.range}`;
        hudEls.zone.style.color = bInfo.color;
      }
      if (hudEls.zoneSub) {
        hudEls.zoneSub.textContent = bInfo.desc;
      }
      if (hudEls.flight) {
        if (activeMode === "glider") {
          hudEls.flight.hidden = false;
          const sign = glider.vy >= 0 ? "+" : "";
          hudEls.flight.textContent = `ROGALLO · ${Math.round(glider.airspeed * 3.6)} km/h · VARIO ${sign}${glider.vy.toFixed(1)} m/s (LIFT +${glider.orographicLift.toFixed(1)}) · AGL ${Math.round(glider.agl)}m`;
        } else if (activeMode === "drone") {
          hudEls.flight.hidden = false;
          hudEls.flight.textContent = `CINEMA DRONE · SHOT ${drone.shotIdx + 1}/5 · PRESS [1-4] REGION · [V] WALK`;
        } else {
          hudEls.flight.hidden = true;
        }
      }
      if (hudEls.fauna && activeEcology) {
        const tel = activeEcology.wildlife.getTelemetry({ x: refX, z: refZ });
        if (tel.nearest) {
          hudEls.fauna.textContent = `SILAS FAUNA: ${tel.nearest.label} · ${tel.nearest.state.toUpperCase()} (${tel.nearest.distM}m)`;
        }
      }
    }

    /* ---------- 11. Pointer, Touch & Keyboard Listeners ---------- */
    canvas.addEventListener("pointerdown", e => {
      orbit.dragging = true;
      orbit.lastX = e.clientX;
      orbit.lastY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (_err) { /* ignore */ }
    });
    canvas.addEventListener("pointermove", e => {
      if (!orbit.dragging) return;
      const dx = e.clientX - orbit.lastX;
      const dy = e.clientY - orbit.lastY;
      orbit.lastX = e.clientX;
      orbit.lastY = e.clientY;
      orbit.yaw = wrapAngle(orbit.yaw - dx * 0.0055);
      orbit.pitch = clamp(orbit.pitch + dy * 0.0045, -0.10, 1.18);
    });
    const endDrag = () => { orbit.dragging = false; };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      orbit.dist = clamp(orbit.dist + e.deltaY * 0.012, 2.2, 68.0);
    }, { passive: false });

    // Mobile Virtual Thumbstick
    const padEl = document.getElementById("mobile-pad");
    const knobEl = document.getElementById("mobile-knob");
    if (padEl && knobEl) {
      padEl.addEventListener("pointerdown", e => {
        e.stopPropagation();
        touchStick.active = true;
        touchStick.id = e.pointerId;
        const rect = padEl.getBoundingClientRect();
        touchStick.ox = rect.left + rect.width * 0.5;
        touchStick.oy = rect.top + rect.height * 0.5;
        try { padEl.setPointerCapture(e.pointerId); } catch (_err) { /* ignore */ }
      });
      padEl.addEventListener("pointermove", e => {
        if (!touchStick.active || e.pointerId !== touchStick.id) return;
        const maxR = 34;
        const rx = e.clientX - touchStick.ox;
        const ry = e.clientY - touchStick.oy;
        const d = Math.hypot(rx, ry) || 1;
        const cl = Math.min(maxR, d);
        const nx = (rx / d) * cl;
        const ny = (ry / d) * cl;
        touchStick.dx = nx / maxR;
        touchStick.dy = ny / maxR;
        knobEl.style.transform = `translate(${nx.toFixed(1)}px, ${ny.toFixed(1)}px)`;
      });
      const resetPad = () => {
        touchStick.active = false;
        touchStick.dx = touchStick.dy = 0;
        knobEl.style.transform = "translate(0px, 0px)";
      };
      padEl.addEventListener("pointerup", resetPad);
      padEl.addEventListener("pointercancel", resetPad);
    }

    window.addEventListener("keydown", e => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      keys[e.code] = true;
      if (e.code === "Digit1") loadRegion("simien_imet_gogo");
      else if (e.code === "Digit2") loadRegion("gheralta_spires");
      else if (e.code === "Digit3") loadRegion("blue_nile_gorge");
      else if (e.code === "Digit4") loadRegion("gerd_belaya_escarpment");
      else if (e.code === "KeyV") setMode("walk");
      else if (e.code === "KeyG") setMode("glider");
      else if (e.code === "KeyC") {
        if (activeMode === "drone") { drone.shotIdx = (drone.shotIdx + 1) % 5; drone.shotTime = 0; }
        else setMode("drone");
      } else if (e.code === "KeyR" && activeMode === "glider") {
        resetGliderAtLaunch();
      }
    });
    window.addEventListener("keyup", e => { keys[e.code] = false; });

    window.addEventListener("resize", () => {
      const w = window.innerWidth, h = Math.max(1, window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });

    /* ---------- 12. Parse Initial URL Params & Start Render Loop ---------- */
    initHudBindings();

    const initParams = new URLSearchParams(window.location.search);
    const startRegion = resolveRegionId(initParams.get("region") || "simien_imet_gogo");
    const startMode = initParams.get("mode") || (initParams.get("glider") === "1" ? "glider" : (initParams.get("drone") === "1" || initParams.get("tour") === "1" ? "drone" : "walk"));
    const startLook = initParams.get("look") || "raw";

    let lastMs = performance.now();
    let fpsSmooth = 60;
    let hudTick = 0;
    const playerVec = new T.Vector3();
    const donkeyVec = new T.Vector3();

    await loadRegion(startRegion);
    if (startMode !== "walk") setMode(startMode);
    if (startLook && startLook !== "raw") setLook(startLook);

    function getState() {
      const refX = activeMode === "glider" ? glider.x : player.x;
      const refZ = activeMode === "glider" ? glider.z : player.z;
      return {
        regionId: activeRegionId,
        mode: activeMode,
        lookId: activeLookId,
        fps: +fpsSmooth.toFixed(1),
        glError: post ? post.checkGlError() : renderer.getContext().getError(),
        goldenHour,
        monsoonMist,
        elevM: activeTerrain ? +activeTerrain.sampleRealElevM(refX, refZ).toFixed(1) : 0,
        biome: activeTerrain ? activeTerrain.sampleBiome(refX, refZ) : "dega",
        gps: activeTerrain ? activeTerrain.worldToLatLon(refX, refZ) : null,
        player: { x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2), speed: +player.speed.toFixed(2) },
        donkey: donkey ? { x: +donkey.state.x.toFixed(2), y: +donkey.group.position.y.toFixed(2), z: +donkey.state.z.toFixed(2) } : null,
        glider: { x: +glider.x.toFixed(2), y: +glider.y.toFixed(2), z: +glider.z.toFixed(2), agl: +glider.agl.toFixed(1), lift: +glider.orographicLift.toFixed(2) },
        ecology: activeEcology ? activeEcology.getSummary({ x: refX, z: refZ }) : null,
        worldBridge: worldBridge ? {
          loadedClips: worldBridge.getLoadedClips(),
          imani: worldBridge.getActorState("eth_imani"),
          makeda: worldBridge.getActorState("eth_makeda"),
          june: worldBridge.getActorState("eth_june"),
          elder: worldBridge.getActorState("eth_elder")
        } : null
      };
    }

    // Expose programmatic API for inspection & automated Playwright audit
    window.__ethiopiaWorld = {
      input: { keys, touchStick, orbit },
      landmarks: () => activeEcology ? activeEcology.landmarks : null,
      heightAt: (x, z) => activeTerrain ? activeTerrain.sampleHeight(x, z) : 0,
      renderer,
      scene,
      camera,
      loadRegion,
      setRegion: loadRegion,
      setMode,
      setLook,
      teleportTo,
      setGoldenHour(v) { goldenHour = clamp(v, 0, 1); applyAtmosphere(); return goldenHour; },
      setMonsoonMist(v) { monsoonMist = clamp(v, 0, 1); applyAtmosphere(); return monsoonMist; },
      setDroneShot(idx) { setMode("drone"); drone.shotIdx = ((idx % 5) + 5) % 5; drone.shotTime = 0; return getState(); },
      getState,
      getActiveTerrain: () => activeTerrain,
      getActiveEcology: () => activeEcology
    };

    function animate(nowMs) {
      requestAnimationFrame(animate);
      const rawDt = (nowMs - lastMs) * 0.001;
      lastMs = nowMs;
      const dt = clamp(rawDt, 0.001, 0.05);
      const nowSec = nowMs * 0.001;
      const instFps = 1.0 / Math.max(0.001, rawDt);
      fpsSmooth = lerp(fpsSmooth, clamp(instFps, 5, 144), 0.08);

      // Update terrain animations (water flow, cloud-sea drift) if exposed
      if (packInstance && typeof packInstance.update === "function") {
        packInstance.update(dt, nowSec, camera);
      } else if (activeTerrain && activeTerrain.raw && typeof activeTerrain.raw.update === "function") {
        activeTerrain.raw.update(dt, nowSec, camera);
      }

      if (activeMode === "glider") stepGlider(dt, nowSec);
      else if (activeMode === "drone") stepCinemaDrone(dt, nowSec);
      else stepWalkAndLead(dt, nowSec);

      stepSupportingCast(dt, nowSec);

      if (worldBridge) {
        if (imani && imani.group.visible) {
          const spd = activeMode === "walk" ? player.speed : 0;
          worldBridge.setActorLocomotion("eth_imani", {
            speedMps: spd,
            carrying: spd > 0.14 ? spd < 2.2 : true,
            talking: false,
            blend: 0.85
          });
        }
        const relaySpecs = [
          ["eth_makeda", makeda, true],
          ["eth_june", june, false],
          ["eth_elder", elder, true]
        ];
        for (let ri = 0; ri < relaySpecs.length; ri++) {
          const [rid, ch, talks] = relaySpecs[ri];
          if (!ch || !ch.group.visible) continue;
          const dPlayer = Math.hypot(player.x - ch.state.x, player.z - ch.state.z);
          worldBridge.setActorLocomotion(rid, {
            speedMps: 0,
            greeting: dPlayer < 6.5 || (rid === "eth_june" && dPlayer < 16),
            talking: talks && dPlayer < 30,
            blend: 0.84
          });
        }
        worldBridge.update(dt);
      }

      if (activeEcology) {
        playerVec.set(player.x, player.y, player.z);
        if (donkey) donkeyVec.set(donkey.state.x, donkey.group.position.y, donkey.state.z);
        activeEcology.update(dt, nowSec, {
          playerPos: playerVec,
          donkeyPos: donkey ? donkeyVec : null
        });
      }

      if (packAddon && packAddon.beacon) {
        packAddon.beacon.scale.setScalar(0.9 + 0.15 * Math.sin(nowSec * 3.8));
      }

      // Keep shadow frustum centered around active subject
      const focusAnchor = activeMode === "glider" ? rogallo.root.position : camera.position;
      sunLight.target.position.set(focusAnchor.x, focusAnchor.y - 4, focusAnchor.z);
      sunLight.position.copy(sunLight.target.position).addScaledVector(sunDirVec, 155);
      skyDome.position.copy(camera.position);
      if (packInstance && packInstance.skyMesh) {
        packInstance.skyMesh.position.copy(camera.position);
      }

      if (post) {
        post.render(scene, camera, dt, nowSec, null);
      } else {
        renderer.render(scene, camera);
      }

      hudTick += dt;
      if (hudTick >= 0.14) {
        hudTick = 0;
        updateAltimeterHud(fpsSmooth);
      }
    }

    requestAnimationFrame(animate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootEthiopiaWorld);
  } else {
    bootEthiopiaWorld();
  }
})();
