/* ABYSSINIAN HIGHLANDS · Continuous 4-Zone GTA Compressed Transect & Worldtext Simulation Engine
 * Connects:
 *   Zone 1 · Escarpment Citadel (3,200–3,926 m, Wurch)  — Simien cliffs, Gheralta spires, Lalibela sunken cross, radio mast, contour ribbons
 *   Zone 2 · Sacred-Tech Sanctuary (2,400–2,850 m, Dega) — Hidmo compound, 3-act Buna threshold, stone chapel, cyan server vault, polygon quilt
 *   Zone 3 · Rift-Edge Market Hub (1,800–2,200 m, Weyna Dega) — Cobblestone roundabout, circular church forest, Telebirr/Safaricom kiosks, ERA Ge'ez signs, river strips
 *   Zone 4 · Blue Nile Gorge & GERD Dam (500–1,200 m, Kolla) — Canyon hairpin highway, curved concrete dam, branching cyan reservoir, lowland blocks
 */
(function () {
  "use strict";

  const T = window.THREE;
  const Kits = window.AbyssinianKits;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const frac = x => x - Math.floor(x);
  const hash2 = (x, y) => frac(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
  };
  const fbm = (x, y, oct = 4) => {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
    return s;
  };
  const TAU = Math.PI * 2;

  /* ---------- 1. Analytical + Grid Triangle-Exact Compressed Transect Heightfield ---------- */
  const WORLD_W = 860, WORLD_D = 380;
  const SEG_X = 215, SEG_Z = 95;
  const HALF_W = WORLD_W * 0.5, HALF_D = WORLD_D * 0.5;

  // Trunk highway centerline control points (from Simien Citadel -> Sanctuary -> Roundabout -> Gorge Hairpins -> Dam Overlook)
  const ROAD_PTS = [
    [-385,  32], [-305,  34], [-235,  22], [-155,  28], [-75,  24],
    [  18,  10], [  48,   0], // approaches Market Roundabout at (76, 0)
    [ 106,   4], [ 162, -18], [ 205, -54], [ 236,  48], [ 272, -38], [ 296, -18]
  ];
  const roadCurve = new T.CatmullRomCurve3(ROAD_PTS.map(p => new T.Vector3(p[0], 0, p[1])));
  const roadSamples = roadCurve.getSpacedPoints(320);

  function minDistToRoad(x, z) {
    // Also include circular roundabout ring at (76, 0) radius 26m
    let best = Math.abs(Math.hypot(x - 76, z) - 26);
    for (let i = 0; i < roadSamples.length; i += 2) {
      const dx = x - roadSamples[i].x, dz = z - roadSamples[i].z;
      const d = Math.hypot(dx, dz);
      if (d < best) best = d;
    }
    return best;
  }

  function rawElevation(x, z) {
    // Base 4-terrace GTA compressed transect curve (West high -> East gorge/dam)
    const p1 = 58 * (1 - smooth(-255, -185, x));          // Zone 1 Citadel step (+58m above Zone 2)
    const p2 = 38 * (1 - smooth( -48,   18, x));          // Zone 2 Sanctuary step
    const p3 = 22 * (1 - smooth( 155,  255, x));          // Zone 3 Market Hub step -> Gorge descent
    let h = 3.2 + p1 * 0.38 + p2 * 0.48 + p3 * 0.92;     // ~64m at x=-380 -> ~41m at x=-130 -> ~23.5m at x=+76 -> ~3.2m at x=+340

    // Dramatic Simien & Gheralta spires on Zone 1 northern/western rim (avoiding sunken church pad at -332, -14)
    if (x < -215) {
      const spireMask = smooth(24, 62, Math.hypot(x + 332, z + 14)) * smooth(14, 34, Math.abs(z - 32));
      const crag = Math.pow(fbm(x * 0.032 + 4.1, z * 0.032 + 1.7, 4), 2.2) * 34;
      const tower = Math.max(0, 1 - Math.hypot(x + 372, z + 68) / 28) * 28
                  + Math.max(0, 1 - Math.hypot(x + 292, z + 74) / 22) * 22;
      h += (crag + tower) * spireMask * (1 - smooth(-245, -205, x));
    }

    // Gentle highland undulations on Zones 2 & 3 (flattened cleanly around compounds & roundabout)
    const flatSanctuary = smooth(12, 38, Math.hypot(x + 128, z + 12));
    const flatMarket = smooth(34, 58, Math.hypot(x - 76, z));
    h += (fbm(x * 0.018, z * 0.018, 3) - 0.5) * 4.2 * flatSanctuary * flatMarket;

    // Blue Nile (Abay) winding canyon & branching GERD reservoir basin on East (x > 165)
    if (x > 150) {
      const riverCenterZ = Math.sin(x * 0.022) * 26;
      const distRiver = Math.abs(z - riverCenterZ);
      // Branching tributary arms behind GERD dam (x > 305)
      const branchA = Math.hypot((x - 355) * 0.85, z - 68);
      const branchB = Math.hypot((x - 368) * 0.85, z + 72);
      const resMask = x > 302 ? Math.min(distRiver, branchA * 0.65, branchB * 0.65) : distRiver;
      const canyonCut = (1 - smooth(10, 44, resMask)) * smooth(155, 215, x) * 14.5;
      h -= canyonCut;
      // Steep canyon rim walls framing the reservoir at |z| > 88
      const rimWall = smooth(72, 145, Math.abs(z)) * smooth(185, 265, x) * 22.0;
      h += rimWall;
    }

    // Gently grade road bed
    const rd = minDistToRoad(x, z);
    if (rd < 7.5 && x < 298) {
      const flatten = 1 - smooth(3.5, 7.5, rd);
      const avg = 3.2 + (58 * (1 - smooth(-255, -185, x))) * 0.38 + (38 * (1 - smooth(-48, 18, x))) * 0.48 + (22 * (1 - smooth(155, 255, x))) * 0.92;
      h = lerp(h, avg + 0.15, flatten * 0.72);
    }
    return h;
  }

  // Bake vertex grid so `groundAt(x, z)` matches PlaneGeometry triangles to <0.1mm!
  const gridCols = SEG_X + 1, gridRows = SEG_Z + 1;
  const heightGrid = new Float32Array(gridCols * gridRows);
  for (let iz = 0; iz < gridRows; iz++) {
    const wz = -HALF_D + (iz / SEG_Z) * WORLD_D;
    for (let ix = 0; ix < gridCols; ix++) {
      const wx = -HALF_W + (ix / SEG_X) * WORLD_W;
      heightGrid[iz * gridCols + ix] = rawElevation(wx, wz);
    }
  }

  function groundAt(x, z) {
    const gx = clamp(((x + HALF_W) / WORLD_W) * SEG_X, 0, SEG_X - 0.0001);
    const gz = clamp(((z + HALF_D) / WORLD_D) * SEG_Z, 0, SEG_Z - 0.0001);
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const fx = gx - ix, fz = gz - iz;
    const h00 = heightGrid[iz * gridCols + ix];
    const h10 = heightGrid[iz * gridCols + ix + 1];
    const h01 = heightGrid[(iz + 1) * gridCols + ix];
    const h11 = heightGrid[(iz + 1) * gridCols + ix + 1];
    // Standard Three.js PlaneGeometry diagonal split: (fx + fz <= 1) vs (> 1)
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }

  function realMetersAt(x, z) {
    // Maps world height (approx -8..+92) cleanly onto real Ethiopian transect altitude (520 m .. 3,926 m)
    const wy = groundAt(x, z);
    return Math.round(clamp(540 + (wy + 6) * 44.5, 500, 3926));
  }

  function agroZoneForMeters(m) {
    if (m >= 3100) return { code: "WURCH", geez: "ውርጭ", name: "Escarpment Citadel · Contour Ribbons" };
    if (m >= 2300) return { code: "DEGA", geez: "ደጋ", name: "Sacred-Tech Sanctuary · Polygon Quilt" };
    if (m >= 1500) return { code: "WEYNA DEGA", geez: "ወይና ደጋ", name: "Rift-Edge Market Hub · River Strips" };
    return { code: "KOLLA", geez: "ቆላ", name: "Blue Nile & GERD · Lowland Blocks" };
  }

  /* ---------- 2. Renderer, Scene & Lighting ---------- */
  const wrap = $("stage-wrap");
  const canvas = $("view");
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const scene = new T.Scene();
  const SKY_COLOR = new T.Color(0xcfd4cc);
  const PAPER_COLOR = new T.Color(0xd9d5cb);
  scene.background = SKY_COLOR.clone();
  scene.fog = new T.FogExp2(0xcfd4cc, 0.00145);

  const camera = new T.PerspectiveCamera(44, 1, 0.2, 1600);

  const hemi = new T.HemisphereLight(0xf5f2ea, 0x6c685e, 1.35);
  scene.add(hemi);

  const sun = new T.DirectionalLight(0xfff9ee, 2.35);
  sun.position.set(-120, 185, 110);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00035;
  Object.assign(sun.shadow.camera, { left: -220, right: 220, top: 190, bottom: -190, near: 10, far: 520 });
  scene.add(sun, sun.target);

  const worldRoot = new T.Group();
  scene.add(worldRoot);

  const studyRoot = new T.Group();
  studyRoot.visible = false;
  scene.add(studyRoot);

  /* ---------- 3. Build 4-Biome Terrain Mesh with All 4 Orbital Field Geometries ---------- */
  {
    const geo = new T.PlaneGeometry(WORLD_W, WORLD_D, SEG_X, SEG_Z);
    geo.rotateX(-Math.PI * 0.5);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i), wz = pos.getZ(i);
      const wy = heightGrid[i];
      pos.setY(i, wy);

      // Compute which of the 4 Orbital Field Geometries applies at (wx, wz):
      let r = 0.44, g = 0.43, b = 0.38;
      const rd = minDistToRoad(wx, wz);
      const distRoundabout = Math.hypot(wx - 76, wz);

      if (distRoundabout < 20.5) {
        // Dark indigenous Circular Church Forest floor!
        r = 0.16; g = 0.24; b = 0.15;
      } else if (Math.abs(distRoundabout - 26) < 4.5 || (rd < 3.8 && wx < 298)) {
        // Cobblestone / asphalt trunk road
        const cobble = 0.34 + 0.06 * vnoise(wx * 2.2, wz * 2.2);
        r = cobble; g = cobble * 0.99; b = cobble * 0.96;
      } else if (wx < -205) {
        // ZONE 1: CONTOUR RIBBONS (`fanya juu` stone-bund terraces wrapping elevation contours!)
        const band = frac(wy * 0.55);
        const bund = band < 0.13 ? 0.25 : (0.42 + 0.14 * Math.sin(wy * 1.8));
        r = bund * 1.04; g = bund * 0.98; b = bund * 0.86;
      } else if (wx < 20) {
        // ZONE 2: POLYGON QUILT (Smallholder skewed trapezoidal teff & wheat mosaic!)
        const u = wx * 0.055 + 0.35 * vnoise(wx * 0.02, wz * 0.02);
        const v = wz * 0.062 + 0.35 * vnoise(wz * 0.02 + 5, wx * 0.02);
        const cid = hash2(Math.floor(u), Math.floor(v));
        const edge = Math.min(frac(u), 1 - frac(u), frac(v), 1 - frac(v));
        if (edge < 0.055) {
          r = 0.28; g = 0.26; b = 0.23; // stone bund boundary
        } else if (cid < 0.36) {
          r = 0.54; g = 0.50; b = 0.34; // golden ripening teff
        } else if (cid < 0.72) {
          r = 0.35; g = 0.44; b = 0.28; // lush green barley/wheat
        } else {
          r = 0.30; g = 0.26; b = 0.22; // dark volcanic vertisol fallow
        }
      } else if (wx < 195) {
        // ZONE 3: PERPENDICULAR RIVER STRIPS (long narrow water-access lanes!)
        const stripIdx = Math.floor((wx + wz * 0.22) * 0.18);
        const edge = frac((wx + wz * 0.22) * 0.18);
        const tone = 0.34 + 0.20 * hash2(stripIdx, 7);
        r = edge < 0.08 ? 0.25 : tone * 0.96;
        g = edge < 0.08 ? 0.25 : tone * 1.08;
        b = edge < 0.08 ? 0.22 : tone * 0.76;
      } else {
        // ZONE 4: LARGE RECTANGULAR LOWLAND BLOCKS (Metekel mechanized sesame/sorghum!)
        const bx = Math.floor(wx * 0.028), bz = Math.floor(wz * 0.032);
        const ex = frac(wx * 0.028), ez = frac(wz * 0.032);
        const bid = hash2(bx, bz);
        if (ex < 0.04 || ez < 0.04) {
          r = 0.42; g = 0.36; b = 0.28;
        } else {
          r = 0.32 + bid * 0.24; g = 0.38 + bid * 0.18; b = 0.24 + bid * 0.10;
        }
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    geo.setAttribute("color", new T.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const terrainMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.04 });
    const terrainMesh = new T.Mesh(geo, terrainMat);
    terrainMesh.receiveShadow = true;
    worldRoot.add(terrainMesh);
  }

  /* ---------- 4. Populate All 4 Transect Zones with Hero Architecture, Totems & Habitus ---------- */
  const mats = Kits.getMaterials(T);

  // ZONE 1: Escarpment Citadel (-332, -14) Lalibela Sunken Cruciform Church + (-238, -42) Ridge Radio Mast
  const sunkenChurch = Kits.makeLalibelaSunkenChurch(T);
  sunkenChurch.position.set(-332, groundAt(-332, -14) - 1.2, -14);
  worldRoot.add(sunkenChurch);

  const radioMast = Kits.makeRidgeRadioMast(T, 32);
  radioMast.position.set(-238, groundAt(-238, -42), -42);
  worldRoot.add(radioMast);

  // ZONE 2: Sacred-Tech Sanctuary (-128, -12) — Hidmo Compound, Live 3-Act Buna Threshold, Stone Chapel & Cyan Server Vault!
  if (window.makeArchitectureStudyPiece) {
    const hidmo = window.makeArchitectureStudyPiece(T, "hidmo");
    hidmo.position.set(-142, groundAt(-142, -18), -18);
    worldRoot.add(hidmo);

    const chapel = window.makeArchitectureStudyPiece(T, "chapel");
    chapel.position.set(-104, groundAt(-104, -22), -22);
    worldRoot.add(chapel);

    const vault = window.makeArchitectureStudyPiece(T, "sanctuary");
    vault.position.set(-122, groundAt(-122, 10) - 0.1, 10);
    worldRoot.add(vault);
  }

  const worldBuna = Kits.makeBunaThresholdSet(T, { includeWall: true, includeJerrycanLifecycle: true });
  worldBuna.group.position.set(-134, groundAt(-134, -4), -4);
  worldRoot.add(worldBuna.group);

  // Glowing electric-cyan subterranean cooling conduit network linking Hidmo, Chapel, Vault & River (`transect_map.jpg`!)
  const conduitPaths = [
    [[-142, -16], [-122, -16], [-122, 10]],
    [[-104, -18], [-122, -18]],
    [[-122, 10], [-65, 14], [18, 12], [175, 4]]
  ];
  for (const pts of conduitPaths) {
    const crv = new T.CatmullRomCurve3(pts.map(([px, pz]) => new T.Vector3(px, groundAt(px, pz) + 0.22, pz)));
    worldRoot.add(new T.Mesh(new T.TubeGeometry(crv, 36, 0.28, 8, false), mats.cyanWaterMat));
  }

  // ZONE 3: Rift-Edge Market Hub (+76, 0) — Circular Church Forest, Tangled Poles, Telebirr/Safaricom Kiosks & Bilingual Signs!
  {
    const canopyMat = new T.MeshStandardMaterial({ color: 0x223824, roughness: 0.88 });
    for (let i = 0; i < 28; i++) {
      const a = (i * 2.39996) % TAU;
      const r = 2.5 + 15.5 * Math.sqrt((i + 0.5) / 28);
      const tx = 76 + Math.cos(a) * r, tz = Math.sin(a) * r;
      const ty = groundAt(tx, tz);
      const trunk = new T.Mesh(new T.CylinderGeometry(0.18, 0.26, 4.2, 7), mats.timberMat);
      trunk.position.set(tx, ty + 2.1, tz);
      worldRoot.add(trunk);
      const crown = new T.Mesh(new T.SphereGeometry(2.2 + (i % 3) * 0.55, 10, 8), canopyMat);
      crown.position.set(tx, ty + 4.8 + (i % 2) * 0.7, tz);
      crown.castShadow = true;
      worldRoot.add(crown);
    }

    // Ring of crooked Eucalyptus utility poles + cat's-cradle sagging overhead wires + Solar Cobra Lights + Kiosks!
    const poleTops = [];
    for (let p = 0; p < 7; p++) {
      const a = -0.8 + p * 0.62;
      const px = 76 + Math.cos(a) * 32.5, pz = Math.sin(a) * 32.5;
      const py = groundAt(px, pz);
      const pole = Kits.makeEucalyptusUtilityPole(T, p % 2 === 0);
      pole.position.set(px, py, pz);
      pole.rotation.y = -a;
      worldRoot.add(pole);
      poleTops.push(new T.Vector3(px, py + 5.8, pz));

      if (p < 4) {
        const kiosk = Kits.makeStreetKiosk(T, p % 2 === 0 ? "telebirr" : "emerald");
        const kx = 76 + Math.cos(a + 0.22) * 34.5, kz = Math.sin(a + 0.22) * 34.5;
        kiosk.position.set(kx, groundAt(kx, kz), kz);
        kiosk.rotation.y = -a - Math.PI * 0.5;
        worldRoot.add(kiosk);
      }
    }
    for (let i = 0; i < poleTops.length - 1; i++) {
      const p0 = poleTops[i], p1 = poleTops[i + 1];
      for (const sag of [0.65, 1.15]) {
        const mid = p0.clone().lerp(p1, 0.5);
        mid.y -= sag;
        const wire = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([p0, mid, p1]), 12, 0.022, 5, false), mats.tireMat);
        worldRoot.add(wire);
      }
    }
    for (const [sx, sz, ry] of [[42, 8, 0.2], [108, -8, -2.8]]) {
      const sl = Kits.makeSolarCobraLight(T);
      sl.position.set(sx, groundAt(sx, sz), sz);
      sl.rotation.y = ry;
      worldRoot.add(sl);
    }

    const signs = Kits.makeRoadSignsSet(T);
    signs.position.set(108, groundAt(108, 12), 12);
    signs.rotation.y = -0.55;
    worldRoot.add(signs);
  }

  // ZONE 4: Blue Nile Gorge & GERD Dam (+304, 0) + Glowing Branching Cyan Reservoir & River!
  const gerdDam = Kits.makeGerdDamWall(T);
  gerdDam.position.set(304, 4.0, 0);
  worldRoot.add(gerdDam);

  // Upstream Reservoir Water Plane (x = 304..428) + Canyon River Ribbon (x = 165..304)
  const resGeo = new T.PlaneGeometry(124, 340);
  resGeo.rotateX(-Math.PI * 0.5);
  const reservoirMesh = new T.Mesh(resGeo, mats.cyanWaterMat);
  reservoirMesh.position.set(366, 12.2, 0);
  worldRoot.add(reservoirMesh);

  const riverPts = [];
  for (let rx = 165; rx <= 304; rx += 6) {
    const rz = Math.sin(rx * 0.022) * 26;
    riverPts.push(new T.Vector3(rx, Math.max(1.2, groundAt(rx, rz) + 0.55), rz));
  }
  worldRoot.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(riverPts), 48, 3.6, 8, false), mats.cyanWaterMat));

  /* ---------- 5. Player Rig (Carrier / Mistletoe / Drivable HiAce & Bajaj) + AI Escarpment Traffic ---------- */
  const playerCarrierGroup = new T.Group();
  worldRoot.add(playerCarrierGroup);

  let playerHuman = null, playerDonkey = null;
  if (window.makeExpeditionCharacter) {
    playerHuman = window.makeExpeditionCharacter(T, {
      id: "imani_ah", name: "Imani", skinHex: 0x3b261b, hair: "croppedCoily",
      outer: "shamma", coatHex: 0xc8c0b0, toolBelt: true, pose: "idle"
    });
    playerCarrierGroup.add(playerHuman.group);
  }
  if (window.makeDonkey) {
    playerDonkey = window.makeDonkey({ assetPath: "../donkey/", shells: 10, monochrome: false, contactShadow: true, alwaysHalter: true });
    playerDonkey.setCargo([{ kg: 14, slot: "L" }, { kg: 14, slot: "R" }]);
    worldRoot.add(playerDonkey.group);
  }

  // Drivable Player Vehicles: HiAce Line Taxi & Sky-Blue Bajaj!
  const playerHiAce = Kits.makeLineTaxiHiAce(T);
  playerHiAce.position.set(44, groundAt(44, -6), -6);
  playerHiAce.rotation.y = 1.35;
  worldRoot.add(playerHiAce);

  const playerBajaj = Kits.makeBajajRickshaw(T);
  playerBajaj.position.set(52, groundAt(52, 16), 16);
  playerBajaj.rotation.y = 0.85;
  worldRoot.add(playerBajaj);

  // Autonomous AI Traffic looping along the Trunk Escarpment Highway!
  const aiTraffic = [
    { mesh: Kits.makeIsuzuEscarpmentTruck(T), u: 0.72, speed: 0.014, dir: -1 },
    { mesh: Kits.makeLineTaxiHiAce(T),        u: 0.26, speed: 0.022, dir:  1 },
    { mesh: Kits.makeBajajRickshaw(T),        u: 0.52, speed: 0.026, dir: -1 }
  ];
  for (const tv of aiTraffic) worldRoot.add(tv.mesh);

  /* ---------- 6. Isolated Study Plate Turntable Stage (Matching /donkey/ & /study/ #d9d5cb Paper) ---------- */
  const studyShadowCatcher = new T.Mesh(
    new T.PlaneGeometry(40, 40),
    new T.ShadowMaterial({ opacity: 0.26 })
  );
  studyShadowCatcher.rotation.x = -Math.PI * 0.5;
  studyShadowCatcher.receiveShadow = true;
  studyRoot.add(studyShadowCatcher);

  const studyHolder = new T.Group();
  studyRoot.add(studyHolder);
  let studyBuna = null;

  function populateStudyPlate(plateId) {
    while (studyHolder.children.length) studyHolder.remove(studyHolder.children[0]);
    studyBuna = null;
    if (plateId === "plate_buna") {
      studyBuna = Kits.makeBunaThresholdSet(T, { includeWall: true, includeJerrycanLifecycle: true });
      studyBuna.setRound(worldBuna.getRound());
      studyHolder.add(studyBuna.group);
    } else if (plateId === "plate_transit") {
      const hi = Kits.makeLineTaxiHiAce(T); hi.position.set(-3.4, 0, 0.4); hi.rotation.y = 0.95; studyHolder.add(hi);
      const bj = Kits.makeBajajRickshaw(T); bj.position.set(-0.2, 0, 1.1); bj.rotation.y = 0.65; studyHolder.add(bj);
      const iz = Kits.makeIsuzuEscarpmentTruck(T); iz.position.set( 3.2, 0, -0.5); iz.rotation.y = -1.12; studyHolder.add(iz);
    } else if (plateId === "plate_signage") {
      const sg = Kits.makeRoadSignsSet(T); sg.position.set(-1.6, 0, -0.4); studyHolder.add(sg);
      const k1 = Kits.makeStreetKiosk(T, "telebirr"); k1.position.set(2.1, 0, -0.3); k1.rotation.y = -0.35; studyHolder.add(k1);
      const pl = Kits.makeEucalyptusUtilityPole(T, true); pl.position.set(0.2, 0, -1.5); studyHolder.add(pl);
    }
  }

  /* ---------- 7. Controls, Camera Modes & Zone Presets ---------- */
  const state = {
    mode: "aerial", // "walk" | "hiace" | "bajaj" | "aerial" | "study"
    studyPlate: "plate_buna",
    monochrome: true,
    x: -131.5,
    z: 2.2,
    heading: -2.4,
    speed: 0,
    reverseLatch: false,
    camYaw: -0.32,
    camPitch: 0.46,
    camDist: 165,
    targetX: -20,
    targetY: 26,
    targetZ: 0,
    keys: {}
  };

  function setPaletteMode(mono) {
    state.monochrome = mono;
    document.body.classList.toggle("silver-cyan-filter", mono);
    const btn = $("btn-palette");
    if (btn) {
      btn.setAttribute("aria-pressed", String(mono));
      btn.textContent = mono ? "Look: #47B Silver+Cyan" : "Look: Natural Highland";
    }
  }

  function jumpToBookmark(id) {
    studyRoot.visible = false;
    worldRoot.visible = true;
    scene.background.copy(SKY_COLOR);
    scene.fog.density = 0.00055;
    Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 190, bottom: -190 });
    sun.shadow.camera.updateProjectionMatrix();

    if (id === "overview") {
      state.mode = "aerial";
      state.targetX = -12; state.targetZ = 4; state.targetY = 24;
      state.camYaw = -0.08; state.camPitch = 0.52; state.camDist = 385;
    } else if (id === "z1_citadel") {
      state.mode = "aerial";
      state.targetX = -318; state.targetZ = -18; state.targetY = groundAt(-318, -18) + 3;
      state.camYaw = 0.42; state.camPitch = 0.36; state.camDist = 52;
      state.x = -318; state.z = -4;
    } else if (id === "z2_sanctuary") {
      state.mode = "walk";
      state.x = -133.2; state.z = 2.6; state.heading = Math.PI;
      state.camYaw = 0.25; state.camPitch = 0.24; state.camDist = 6.2;
    } else if (id === "z3_market") {
      state.mode = "hiace";
      playerHiAce.position.set(44, groundAt(44, -6), -6);
      playerHiAce.rotation.y = 1.35;
      state.x = 44; state.z = -6; state.heading = 1.35; state.speed = 0;
      state.camYaw = -1.35; state.camPitch = 0.24; state.camDist = 11.5;
    } else if (id === "z4_gerd") {
      state.mode = "aerial";
      state.targetX = 304; state.targetZ = 0; state.targetY = 14;
      state.camYaw = -0.82; state.camPitch = 0.34; state.camDist = 92;
      state.x = 288; state.z = -16;
    } else if (id.startsWith("plate_")) {
      state.mode = "study";
      state.studyPlate = id;
      worldRoot.visible = false;
      studyRoot.visible = true;
      scene.background.copy(PAPER_COLOR);
      scene.fog.density = 0;
      Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
      sun.shadow.camera.updateProjectionMatrix();
      populateStudyPlate(id);
      state.targetX = 0; state.targetZ = 0; state.targetY = id === "plate_buna" ? 0.85 : 1.25;
      state.camYaw = id === "plate_transit" ? 0.18 : 0.42;
      state.camPitch = 0.24;
      state.camDist = id === "plate_buna" ? 3.8 : (id === "plate_transit" ? 10.6 : 7.8);
    }
    syncModePills(id);
  }

  function syncModePills(activeBookmark) {
    document.querySelectorAll("[data-jump]").forEach(b => {
      b.classList.toggle("active", b.dataset.jump === activeBookmark);
    });
    document.querySelectorAll("[data-mode]").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === state.mode);
    });
  }

  /* ---------- 8. Diegetic 3-Station Ethiopian WebAudio Radio Dial ---------- */
  const STATIONS = [
    { id: "off", name: "RADIO OFF", freq: "—", ticker: "Press R or tap station to tune highland broadcast" },
    { id: "tizita", name: "TIZITA CLASSICS FM", freq: "93.4 MHz", ticker: "Ethio-Jazz & Krar · D-Tizita Minor Pentatonic" },
    { id: "beat", name: "HIGHLAND BEAT FM", freq: "101.8 MHz", ticker: "6/8 Eskista Shoulder-Bounce & Addis Synth Bass" },
    { id: "voice", name: "VOICE OF THE PLATEAU", freq: "88.9 MHz", ticker: "Teff: 11,400 ETB/qtl · GERD Storage: 74.0B m³ · Abay Clear" }
  ];
  let stationIdx = 0, audioCtx = null, radioTimer = null, stepCount = 0;

  function playNote(freq, dur, type = "triangle", gainVal = 0.045) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gainVal, t0 + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function cycleRadioStation(nextIdx) {
    stationIdx = typeof nextIdx === "number" ? nextIdx : (stationIdx + 1) % STATIONS.length;
    if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
    const st = STATIONS[stationIdx];
    $("radio-name").textContent = `${st.name} ${st.freq !== "—" ? "· " + st.freq : ""}`;
    $("radio-ticker").textContent = st.ticker;
    $("btn-radio").setAttribute("aria-pressed", String(stationIdx > 0));
    if (stationIdx === 0) return;

    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();

    // D Tizita Minor scale (Hz): D4=293.66, E4=329.63, F4=349.23, A4=440.0, Bb4=466.16, D5=587.33
    const tizitaNotes = [293.66, 329.63, 349.23, 440.00, 466.16, 440.00, 349.23, 329.63];
    const eskistaNotes = [146.83, 293.66, 220.00, 349.23, 233.08, 220.00];
    radioTimer = setInterval(() => {
      stepCount++;
      if (stationIdx === 1) {
        const n = tizitaNotes[stepCount % tizitaNotes.length];
        playNote(n, 0.42, "triangle", 0.042);
        if (stepCount % 4 === 0) playNote(146.83, 0.85, "sine", 0.05);
      } else if (stationIdx === 2) {
        const n = eskistaNotes[stepCount % eskistaNotes.length];
        playNote(n, 0.19, "sawtooth", 0.025);
      } else if (stationIdx === 3 && stepCount % 6 === 0) {
        playNote(587.33, 0.18, "sine", 0.028);
        setTimeout(() => playNote(440.0, 0.26, "sine", 0.024), 190);
      }
    }, stationIdx === 2 ? 230 : 420);
  }

  /* ---------- 9. Input Listeners & UI Wiring ---------- */
  let drag = null, pinch = 0;
  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointermove", e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    state.camYaw -= dx * 0.0065;
    state.camPitch = clamp(state.camPitch + dy * 0.0055, 0.06, 1.32);
  });
  canvas.addEventListener("pointerup", e => { if (drag && drag.id === e.pointerId) drag = null; });
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    state.camDist = clamp(state.camDist * Math.exp(e.deltaY * 0.0011), 2.2, 460);
  }, { passive: false });
  canvas.addEventListener("touchstart", e => {
    if (e.touches.length === 2) {
      pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", e => {
    if (e.touches.length === 2 && pinch > 0) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      state.camDist = clamp(state.camDist * (pinch / Math.max(20, d)), 2.2, 460);
      pinch = d;
    }
  }, { passive: true });

  window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    state.keys[k] = true;
    if (k === "r") cycleRadioStation();
    if (k === "b") advanceBunaRound();
    if (k === "g") setPaletteMode(!state.monochrome);
    if (k === "1") jumpToBookmark("z1_citadel");
    if (k === "2") jumpToBookmark("z2_sanctuary");
    if (k === "3") jumpToBookmark("z3_market");
    if (k === "4") jumpToBookmark("z4_gerd");
    if (k === "0") jumpToBookmark("overview");
  });
  window.addEventListener("keyup", e => { state.keys[e.key.toLowerCase()] = false; });

  const BUNA_LABELS = ["Buna: 1 · Abol (Roast)", "Buna: 2 · Tona (Incense)", "Buna: 3 · Baraka (Blessing)"];
  function advanceBunaRound() {
    const next = (worldBuna.getRound() + 1) % 3;
    worldBuna.setRound(next);
    if (studyBuna) studyBuna.setRound(next);
    $("btn-buna").textContent = BUNA_LABELS[next];
  }

  document.querySelectorAll("[data-jump]").forEach(btn => {
    btn.addEventListener("click", () => jumpToBookmark(btn.dataset.jump));
  });
  document.querySelectorAll("[data-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      const m = btn.dataset.mode;
      studyRoot.visible = false;
      worldRoot.visible = true;
      scene.background.copy(SKY_COLOR);
      scene.fog.density = 0.00145;
      state.mode = m;
      if (m === "walk") { state.camDist = 6.5; state.camPitch = 0.24; }
      if (m === "hiace") { state.x = playerHiAce.position.x; state.z = playerHiAce.position.z; state.heading = playerHiAce.rotation.y; state.camDist = 11.5; }
      if (m === "bajaj") { state.x = playerBajaj.position.x; state.z = playerBajaj.position.z; state.heading = playerBajaj.rotation.y; state.camDist = 8.2; }
      if (m === "aerial") { state.targetX = state.x; state.targetZ = state.z; state.targetY = groundAt(state.x, state.z) + 4; state.camDist = 135; }
      syncModePills("");
    });
  });

  $("btn-buna").addEventListener("click", advanceBunaRound);
  $("btn-radio").addEventListener("click", () => cycleRadioStation());
  $("btn-palette").addEventListener("click", () => setPaletteMode(!state.monochrome));
  $("btn-reverse").addEventListener("click", () => {
    state.reverseLatch = !state.reverseLatch;
    $("btn-reverse").setAttribute("aria-pressed", String(state.reverseLatch));
  });
  $("btn-drawer").addEventListener("click", () => {
    const closed = document.body.classList.toggle("drawer-closed");
    $("btn-drawer").setAttribute("aria-pressed", String(!closed));
    $("btn-drawer").textContent = closed ? "Worldtext & Sheets ▴" : "Worldtext & Sheets ▾";
  });

  document.querySelectorAll(".d-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      document.querySelectorAll(".d-tab").forEach(t => t.setAttribute("aria-selected", String(t === tab)));
      $("tab-sheets").hidden = target !== "sheets";
      $("tab-worldtext").hidden = target !== "worldtext";
      $("tab-geertz").hidden = target !== "geertz";
    });
  });
  document.querySelectorAll("[data-zoom]").forEach(el => {
    el.addEventListener("click", () => {
      $("lightbox-img").src = el.dataset.zoom;
      $("lightbox").hidden = false;
    });
  });
  $("lightbox").addEventListener("click", () => { $("lightbox").hidden = true; });

  function resize() {
    const w = Math.max(1, wrap.clientWidth), h = Math.max(1, wrap.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(wrap);
  if (window.innerWidth <= 900) {
    document.body.classList.add("drawer-closed");
    $("btn-drawer").setAttribute("aria-pressed", "false");
    $("btn-drawer").textContent = "Worldtext & Sheets ▴";
  }

  /* ---------- 10. GTA Transect Radar Minimap Canvas ---------- */
  const mapCnv = $("transect-map");
  const mapCtx = mapCnv ? mapCnv.getContext("2d") : null;

  function drawMinimap() {
    if (!mapCtx) return;
    const w = mapCnv.width, h = mapCnv.height;
    mapCtx.fillStyle = "#141819";
    mapCtx.fillRect(0, 0, w, h);

    // 4 zone vertical bands
    const bands = [
      [0, w * 0.24, "rgba(180,174,160,0.16)", "Z1"],
      [w * 0.24, w * 0.26, "rgba(140,152,130,0.14)", "Z2"],
      [w * 0.50, w * 0.24, "rgba(120,145,120,0.14)", "Z3"],
      [w * 0.74, w * 0.26, "rgba(40,216,240,0.14)", "Z4"]
    ];
    for (const [bx, bw, col, lbl] of bands) {
      mapCtx.fillStyle = col;
      mapCtx.fillRect(bx, 0, bw, h);
      mapCtx.fillStyle = "rgba(242,238,228,0.45)";
      mapCtx.font = "600 9px ui-monospace, monospace";
      mapCtx.fillText(lbl, bx + 4, 11);
    }

    const toMap = (wx, wz) => [
      ((wx + HALF_W) / WORLD_W) * w,
      ((wz + HALF_D) / WORLD_D) * h
    ];

    // Cyan reservoir & cooling conduits
    mapCtx.fillStyle = "rgba(40, 216, 240, 0.55)";
    const [rx0] = toMap(304, 0);
    mapCtx.fillRect(rx0, h * 0.14, w - rx0, h * 0.72);

    // Trunk highway polyline
    mapCtx.strokeStyle = "rgba(241, 238, 230, 0.72)";
    mapCtx.lineWidth = 2;
    mapCtx.beginPath();
    roadSamples.forEach((pt, idx) => {
      const [mx, mz] = toMap(pt.x, pt.z);
      if (idx === 0) mapCtx.moveTo(mx, mz); else mapCtx.lineTo(mx, mz);
    });
    mapCtx.stroke();

    // Circular Church Forest + Roundabout
    const [cx, cz] = toMap(76, 0);
    mapCtx.fillStyle = "#2b5430";
    mapCtx.beginPath(); mapCtx.arc(cx, cz, 5, 0, TAU); mapCtx.fill();
    mapCtx.strokeStyle = "#f1eee6";
    mapCtx.beginPath(); mapCtx.arc(cx, cz, 7, 0, TAU); mapCtx.stroke();

    // AI traffic dots
    mapCtx.fillStyle = "#f2b84b";
    for (const tv of aiTraffic) {
      const [tx, tz] = toMap(tv.mesh.position.x, tv.mesh.position.z);
      mapCtx.fillRect(tx - 1.5, tz - 1.5, 3, 3);
    }

    // Player marker & heading
    const focusX = state.mode === "aerial" ? state.targetX : state.x;
    const focusZ = state.mode === "aerial" ? state.targetZ : state.z;
    const [px, pz] = toMap(focusX, focusZ);
    mapCtx.fillStyle = "#3ce8ff";
    mapCtx.beginPath(); mapCtx.arc(px, pz, 4, 0, TAU); mapCtx.fill();
  }

  /* ---------- 11. Main Simulation Loop ---------- */
  setPaletteMode(true);
  const startPreset = new URLSearchParams(location.search).get("zone") || "overview";
  jumpToBookmark(startPreset);
  resize();
  $("world-loader").classList.add("fade-out");
  setTimeout(() => { $("world-loader").hidden = true; }, 450);

  let lastNow = performance.now();
  function frame(now) {
    const dt = clamp((now - lastNow) * 0.001, 0.001, 0.05);
    lastNow = now;
    const nowSec = now * 0.001;

    worldBuna.update(nowSec);
    if (studyBuna) studyBuna.update(nowSec);

    // Advance AI Escarpment Traffic along trunk highway
    for (const tv of aiTraffic) {
      tv.u += tv.dir * tv.speed * dt;
      if (tv.u > 0.96) { tv.u = 0.96; tv.dir = -1; }
      if (tv.u < 0.04) { tv.u = 0.04; tv.dir =  1; }
      const p = roadCurve.getPointAt(tv.u);
      const pAhead = roadCurve.getPointAt(clamp(tv.u + tv.dir * 0.012, 0, 1));
      const py = groundAt(p.x, p.z);
      tv.mesh.position.set(p.x, py, p.z);
      tv.mesh.rotation.y = Math.atan2(pAhead.x - p.x, pAhead.z - p.z);
      for (const wh of tv.mesh.userData.wheels || []) wh.rotation.x += dt * 6.0;
    }

    // Player movement / vehicle physics
    const fwdInput = (state.keys["w"] || state.keys["arrowup"] ? 1 : 0)
                   - (state.keys["s"] || state.keys["arrowdown"] ? 1 : 0)
                   + (state.reverseLatch ? -0.85 : 0);
    const steerInput = (state.keys["a"] || state.keys["arrowleft"] ? 1 : 0)
                     - (state.keys["d"] || state.keys["arrowright"] ? 1 : 0);

    if (state.mode === "walk") {
      state.heading += steerInput * dt * 2.1;
      const moveSpd = fwdInput * 5.6;
      state.x = clamp(state.x + Math.sin(state.heading) * moveSpd * dt, -HALF_W + 12, HALF_W - 12);
      state.z = clamp(state.z + Math.cos(state.heading) * moveSpd * dt, -HALF_D + 12, HALF_D - 12);
      state.targetX = state.x; state.targetZ = state.z; state.targetY = groundAt(state.x, state.z) + 1.35;
    } else if (state.mode === "hiace" || state.mode === "bajaj") {
      const veh = state.mode === "hiace" ? playerHiAce : playerBajaj;
      const maxSpd = state.mode === "hiace" ? 18.0 : 14.5;
      state.speed = lerp(state.speed, fwdInput * maxSpd, 1 - Math.exp(-dt * 4.2));
      if (Math.abs(state.speed) > 0.2) {
        state.heading += steerInput * dt * 1.65 * Math.sign(state.speed);
      }
      state.x = clamp(state.x + Math.sin(state.heading) * state.speed * dt, -HALF_W + 14, HALF_W - 14);
      state.z = clamp(state.z + Math.cos(state.heading) * state.speed * dt, -HALF_D + 14, HALF_D - 14);
      veh.position.set(state.x, groundAt(state.x, state.z), state.z);
      veh.rotation.y = state.heading;
      for (const wh of veh.userData.wheels || []) wh.rotation.x += state.speed * dt * 2.2;
      state.targetX = state.x; state.targetZ = state.z; state.targetY = veh.position.y + 1.4;
    } else if (state.mode === "aerial") {
      const panSpd = 58 * dt;
      state.targetX = clamp(state.targetX - steerInput * panSpd, -HALF_W + 20, HALF_W - 20);
      state.targetZ = clamp(state.targetZ - fwdInput * panSpd, -HALF_D + 20, HALF_D - 20);
      state.targetY = lerp(state.targetY, groundAt(state.targetX, state.targetZ) + 4.0, 0.12);
    }

    // Place carrier & Mistletoe
    const py = groundAt(state.x, state.z);
    playerCarrierGroup.visible = state.mode !== "hiace" && state.mode !== "bajaj";
    playerCarrierGroup.position.set(state.x, py, state.z);
    playerCarrierGroup.rotation.y = state.heading;
    if (playerHuman) {
      playerHuman.update(dt, nowSec, {
        pose: Math.abs(fwdInput) > 0.1 && state.mode === "walk" ? "walk" : "idle",
        surfaceAt: () => 0
      });
    }
    if (playerDonkey) {
      playerDonkey.place(-136.2, -1.6, 0.85, groundAt);
      playerDonkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 2, drop: 0 }, groundAt);
    }

    // Orbit camera around active target with portrait aspect compensation
    const effDist = state.camDist * (camera.aspect < 0.85 ? clamp(0.88 / camera.aspect, 1.0, 1.48) : 1.0);
    const cp = Math.cos(state.camPitch), sp = Math.sin(state.camPitch);
    camera.position.set(
      state.targetX + Math.sin(state.camYaw) * cp * effDist,
      state.targetY + sp * effDist,
      state.targetZ + Math.cos(state.camYaw) * cp * effDist
    );
    camera.lookAt(state.targetX, state.targetY, state.targetZ);

    // Update live HUD altitude & Ge'ez agro-ecological zone
    const altM = realMetersAt(state.targetX, state.targetZ);
    const az = agroZoneForMeters(altM);
    $("hud-elev").textContent = `${altM.toLocaleString()} m · ${az.geez} ${az.code}`;
    $("hud-zone").textContent = state.mode === "study" ? `STUDY PLATE · ${state.studyPlate.replace("plate_", "").toUpperCase()}` : az.name;

    drawMinimap();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__abyssinian = {
    isReady: () => true,
    jumpToBookmark,
    advanceBunaRound,
    cycleRadioStation,
    getState: () => ({
      mode: state.mode,
      bunaRound: worldBuna.getRound(),
      station: STATIONS[stationIdx].id,
      elevationM: realMetersAt(state.targetX, state.targetZ)
    })
  };
})();
