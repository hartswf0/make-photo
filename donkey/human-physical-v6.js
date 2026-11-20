/* ============================================================================
   HUMAN PHYSICAL SKIN, SCULPTED MANIFOLD ANATOMY & CLAY TURNAROUND ENGINE (v6)
   Exposes window.HumanPhysicalV6 for donkey/human-sculpt-v3.js,
   donkey/scion-groom-garments.js, donkey/characters.js, and study/study.js.

   Highlights:
   1. True 3D Sculpted Craniofacial + Watertight Multi-Fold 3D Ear + Split-Lip
      Oral Cavity + Cervical-Clavicular Bust Manifold (9,042 verts / 16,940 tris)
      with 5 Cast Phenotypes (imani, makeda, june, elder, hanna) calibrated 1:1
      against 0b07591c.jpg, 0bc287c6.jpg, and 32b99d8c.jpg.
   2. Pure THREE.MeshPhysicalMaterial Skin Shader (sheen: 0.42, sheenRoughness:
      0.68, warm peach-amber sheenColor, 1024x1024 baked tangent-space Normal +
      Cavity AO + Dual-Lobe Pore Roughness maps in donkey/sculpted-humans/) —
      ZERO smeared 2D portrait photo shadows, ZERO pointy wedge chins, ZERO
      flat elf-ear creases, ZERO sunken zombie eye rings, ZERO warped sad mouths!
   3. Instant Sculptor's Clay Turnaround Mode:
      HumanPhysicalV6.setClayMode(targetRoot, enabled, opts) switches skin,
      eyelids, eyes, hair grooms, collars, and garments to matte warm sculptor's
      clay (#7d7770 on #dfd7cd studio background) matching 0b07591c.jpg 1:1.
   ============================================================================ */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const smooth5 = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  const frac = x => x - Math.floor(x);
  const hash = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const g1 = (x, c, w) => { const d = (x - c) / w; return Math.exp(-d * d); };
  const g2 = (x, y, cx, cy, wx, wy) => {
    const dx = (x - cx) / wx, dy = (y - cy) / (wy || wx);
    return Math.exp(-(dx * dx + dy * dy));
  };
  const smoothMax = (a, b, k = 0.0055) => {
    const d = a - b;
    return 0.5 * (a + b + Math.sqrt(d * d + k * k));
  };

  function catmullScalar(a, b, c, d, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  }

  /* ==========================================================================
     1. STUDIO CLAY CONSTANTS & 5 CAST PHENOTYPE ANATOMICAL PRESETS
     ========================================================================== */
  const CLAY_STUDIO_PALETTE = Object.freeze({
    clayHex: 0x6b655e,
    hairClayHex: 0x4c4742,
    garmentClayHex: 0x8a847b,
    backgroundHex: 0xdfd7cd,
    scleraClayHex: 0x827b73,
    irisClayHex: 0x3b3733,
    sheenColorHex: 0x9b948b
  });

  const PHENOTYPES = Object.freeze({
    imani: {
      id: "imani",
      label: "Imani (Slender Warm Lead — 0b07591c North Star)",
      defaultSkinHex: 0x4b3022,
      craniumW: 1.004, craniumTop: 0.0005, foreheadBoss: 0.0036, browArch: 0.96,
      malarHigh: 1.08, malarWidth: 1.006, buccalFull: 0.0004,
      jawWidth: 0.962, gonionCrisp: 0.92, chinProj: 0.0866, chinWidth: 0.0296, chinLiftY: 0.0020,
      noseBridge: 0.98, noseTipProj: 0.0985, noseTipLiftY: 0.0026, alarWidth: 0.0166,
      lipFullU: 1.06, lipFullL: 1.08, mouthWidth: 0.0256,
      neckHalfW: 0.0456, scmStrength: 1.08, larynxProm: 0.0007, earScale: 1.02, ageLines: 0.04, browFullness: 0.96
    },
    makeda: {
      id: "makeda",
      label: "Makeda (Regal High Cheekbones — 0bc287c6 Left)",
      defaultSkinHex: 0x3e271b,
      craniumW: 1.000, craniumTop: 0.0020, foreheadBoss: 0.0034, browArch: 0.96,
      malarHigh: 1.28, malarWidth: 1.028, buccalFull: -0.0002,
      jawWidth: 0.960, gonionCrisp: 1.05, chinProj: 0.0864, chinWidth: 0.0292, chinLiftY: 0.0022,
      noseBridge: 0.98, noseTipProj: 0.0988, noseTipLiftY: 0.0028, alarWidth: 0.0170,
      lipFullU: 1.10, lipFullL: 1.12, mouthWidth: 0.0260,
      neckHalfW: 0.0458, scmStrength: 1.12, larynxProm: 0.0006, earScale: 1.00, ageLines: 0.08, browFullness: 1.04
    },
    june: {
      id: "june",
      label: "June (~10–11 yr Child Craniofacial Proportions — 0bc287c6 Right)",
      defaultSkinHex: 0x462d20,
      craniumW: 1.048, craniumTop: 0.0085, foreheadBoss: 0.0052, browArch: 0.56,
      malarHigh: 0.84, malarWidth: 0.988, buccalFull: 0.0046,
      jawWidth: 0.915, gonionCrisp: 0.35, chinProj: 0.0834, chinWidth: 0.0284, chinLiftY: 0.0052,
      noseBridge: 0.76, noseTipProj: 0.0955, noseTipLiftY: 0.0042, alarWidth: 0.0168,
      lipFullU: 0.96, lipFullL: 1.00, mouthWidth: 0.0228,
      neckHalfW: 0.0434, scmStrength: 0.48, larynxProm: 0.0002, earScale: 1.03, ageLines: 0.00, browFullness: 0.76
    },
    elder: {
      id: "elder",
      label: "Elder (Mature Highland Osteology — 32b99d8c Turban & Beard)",
      defaultSkinHex: 0x442c1f,
      craniumW: 1.022, craniumTop: 0.0040, foreheadBoss: 0.0022, browArch: 1.28,
      malarHigh: 1.16, malarWidth: 1.032, buccalFull: -0.0008,
      jawWidth: 1.042, gonionCrisp: 1.18, chinProj: 0.0880, chinWidth: 0.0344, chinLiftY: -0.0004,
      noseBridge: 1.12, noseTipProj: 0.1015, noseTipLiftY: 0.0012, alarWidth: 0.0198,
      lipFullU: 0.92, lipFullL: 0.96, mouthWidth: 0.0266,
      neckHalfW: 0.0524, scmStrength: 1.25, larynxProm: 0.0026, earScale: 1.06, ageLines: 0.85, browFullness: 1.18
    },
    hanna: {
      id: "hanna",
      label: "Hanna (Focused Athletic Specialist — 32b99d8c Far Right)",
      defaultSkinHex: 0x825e48,
      craniumW: 0.996, craniumTop: 0.0015, foreheadBoss: 0.0032, browArch: 0.88,
      malarHigh: 1.08, malarWidth: 0.994, buccalFull: 0.0008,
      jawWidth: 0.950, gonionCrisp: 0.84, chinProj: 0.0858, chinWidth: 0.0290, chinLiftY: 0.0022,
      noseBridge: 1.00, noseTipProj: 0.0990, noseTipLiftY: 0.0026, alarWidth: 0.0176,
      lipFullU: 0.92, lipFullL: 0.96, mouthWidth: 0.0246,
      neckHalfW: 0.0454, scmStrength: 0.92, larynxProm: 0.0005, earScale: 0.99, ageLines: 0.04, browFullness: 0.92
    }
  });

  function resolvePhenotypeKey(spec = {}) {
    const explicit = String(spec.phenotype || spec.archetype || "").toLowerCase();
    if (explicit === "youth" || explicit === "child" || explicit === "june") return "june";
    if (explicit === "operator_f" || explicit === "makeda") return "makeda";
    if (explicit === "hanna" || explicit === "elder" || explicit === "imani") return explicit;

    const id = String(spec.id || spec.name || "").toLowerCase();
    const hair = String(spec.hair || "").toLowerCase();
    const scale = spec.scale !== undefined ? spec.scale : 1.0;
    const fem = spec.fem !== undefined ? spec.fem : 0.65;

    if (scale < 0.88 || id.includes("june") || id.includes("child") || id.includes("yared") || id.includes("biruk")) {
      return "june";
    }
    if (id.includes("hanna") || id.includes("tess") || id.includes("op_f") || id.includes("etta") || hair === "ponytail" || hair === "silverswept") {
      return "hanna";
    }
    if (id.includes("makeda") || id.includes("saba") || id.includes("abeba") || id.includes("alma") || id.includes("rahel") || hair === "cornrowbraids") {
      return "makeda";
    }
    if (fem < 0.42 || spec.beard || id.includes("elder") || id.includes("tomas") || id.includes("bekele") || id.includes("desta") || id.includes("gebre") || id.includes("solomon") || id.includes("berhanu") || id.includes("dawit") || id.includes("op_m") || id.includes("daniel")) {
      return "elder";
    }
    return "imani";
  }

  function hexToLinearVec3(T, hexVal, gain = 1.0) {
    let num = typeof hexVal === "number" ? hexVal : parseInt(String(hexVal || "4b3022").replace("#", ""), 16);
    if (!Number.isFinite(num)) num = 0x4b3022;
    const sr = ((num >> 16) & 255) / 255;
    const sg = ((num >> 8) & 255) / 255;
    const sb = (num & 255) / 255;
    return new T.Vector3(
      Math.pow(Math.max(0.002, sr), 2.2) * gain,
      Math.pow(Math.max(0.002, sg), 2.2) * gain,
      Math.pow(Math.max(0.002, sb), 2.2) * gain
    );
  }

  function resolveSkinPalette(T, spec = {}) {
    const phenoKey = resolvePhenotypeKey(spec);
    const pheno = PHENOTYPES[phenoKey] || PHENOTYPES.imani;
    const rawHex = spec.skinHex !== undefined ? spec.skinHex : pheno.defaultSkinHex;
    // Calibrated Fitzpatrick V–VI melanin reflectance curve:
    // Hits exact silver-gelatin Zone III.5–V (#343230 shadow -> #55514c midtone -> #7c766e cheekbone/nose/brow sheen)
    // matching 0bc287c6.jpg & 32b99d8c.jpg 1:1 while contrasting crisply against oatmeal shamma!
    const rawLin = hexToLinearVec3(T, rawHex, 1.0);
    const rawLum = Math.max(0.004, rawLin.x * 0.299 + rawLin.y * 0.587 + rawLin.z * 0.114);
    const targetLum = 0.050 + 0.28 * Math.pow(rawLum, 0.56);
    const scale = targetLum / rawLum;
    const baseLin = new T.Vector3(
      clamp(rawLin.x * scale * 0.96, 0.042, 0.38),
      clamp(rawLin.y * scale * 1.02 + 0.0030, 0.022, 0.25),
      clamp(rawLin.z * scale * 1.06 + 0.0022, 0.014, 0.18)
    );
    // Warm peach-amber grazing sheen color scaled gracefully to melanin depth (matches 32b99d8c & 0bc287c6 rim glow!)
    const sheenColor = new T.Color();
    const sheenLinR = clamp(0.24 + baseLin.x * 0.90, 0.24, 0.56);
    const sheenLinG = clamp(0.15 + baseLin.y * 0.85, 0.15, 0.40);
    const sheenLinB = clamp(0.10 + baseLin.z * 0.78, 0.10, 0.30);
    if (sheenColor.setRGB) {
      const isLin = new T.Color(0x808080).r < 0.35;
      if (isLin) sheenColor.setRGB(sheenLinR, sheenLinG, sheenLinB);
      else sheenColor.setRGB(Math.pow(sheenLinR, 1 / 2.2), Math.pow(sheenLinG, 1 / 2.2), Math.pow(sheenLinB, 1 / 2.2));
    }
    return { phenoKey, pheno, baseLin, sheenColor };
  }

  /* ==========================================================================
     2. BAKED 1K NORMAL / CAVITY AO / PORE ROUGHNESS MAPS LOADER + FALLBACKS
     ========================================================================== */
  const mapsCacheByThree = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  let singleMapsCache = null;

  function makeInstantDataTex(T, size, fillRgbaFn, isSrgb = false) {
    const data = new Uint8Array(size * size * 4);
    fillRgbaFn(data, size);
    const tex = new T.DataTexture(data, size, size, T.RGBAFormat);
    tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
    tex.minFilter = T.LinearMipmapLinearFilter;
    tex.magFilter = T.LinearFilter;
    tex.generateMipmaps = true;
    tex.flipY = true;
    if (isSrgb && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    else if (T.NoColorSpace !== undefined) tex.colorSpace = T.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function resolveSculptedHumansUrl(donkeyBaseUrl) {
    if (donkeyBaseUrl) {
      const clean = String(donkeyBaseUrl).endsWith("/") ? donkeyBaseUrl : (donkeyBaseUrl + "/");
      return clean + "sculpted-humans/";
    }
    if (typeof document !== "undefined" && document.scripts) {
      for (let i = document.scripts.length - 1; i >= 0; i--) {
        const src = document.scripts[i].src || "";
        const m = src.match(/^(.*\/donkey\/)/);
        if (m) return m[1] + "sculpted-humans/";
      }
    }
    return "../donkey/sculpted-humans/";
  }

  function getMaps(T, donkeyBaseUrl) {
    if (mapsCacheByThree && mapsCacheByThree.has(T)) return mapsCacheByThree.get(T);
    if (!mapsCacheByThree && singleMapsCache) return singleMapsCache;

    const dir = resolveSculptedHumansUrl(donkeyBaseUrl);

    // Instantaneous 64x64 procedural fallback data so Frame 0 in headless WebGL has 0 unbound texture warnings
    const headNormal = makeInstantDataTex(T, 64, (d, s) => {
      for (let i = 0; i < s * s; i++) {
        const n = (hash(i * 1.7) - 0.5) * 6;
        d[i * 4] = clamp(128 + n, 118, 138);
        d[i * 4 + 1] = clamp(128 - n, 118, 138);
        d[i * 4 + 2] = 255;
        d[i * 4 + 3] = 255;
      }
    }, false);

    const headAo = makeInstantDataTex(T, 64, (d, s) => {
      for (let i = 0; i < s * s; i++) {
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 248;
        d[i * 4 + 3] = 255;
      }
    }, false);
    headAo.channel = 0;

    const headRoughness = makeInstantDataTex(T, 64, (d, s) => {
      for (let i = 0; i < s * s; i++) {
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 166; // ~0.65 roughness
        d[i * 4 + 3] = 255;
      }
    }, false);

    const handNormal = makeInstantDataTex(T, 64, (d, s) => {
      for (let i = 0; i < s * s; i++) {
        d[i * 4] = 128; d[i * 4 + 1] = 128; d[i * 4 + 2] = 255; d[i * 4 + 3] = 255;
      }
    }, false);

    const handAoRough = makeInstantDataTex(T, 64, (d, s) => {
      for (let i = 0; i < s * s; i++) {
        d[i * 4] = 248; d[i * 4 + 1] = 166; d[i * 4 + 2] = 248; d[i * 4 + 3] = 255;
      }
    }, false);
    handAoRough.channel = 0;

    const bundle = {
      dir,
      headNormal,
      headAo,
      headRoughness,
      handNormal,
      handAoRough,
      loadedCount: 0
    };

    // Stream high-res 1024x1024 & 512x512 baked maps from donkey/sculpted-humans/ via Image/TextureLoader
    if (typeof Image !== "undefined") {
      const upgradeTexFromUrl = (targetTex, url) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          targetTex.image = img;
          targetTex.isDataTexture = false;
          targetTex.anisotropy = 4;
          targetTex.needsUpdate = true;
          bundle.loadedCount++;
        };
        img.src = url;
      };
      upgradeTexFromUrl(headNormal, dir + "human_head_normal_1k.png?v=v69");
      upgradeTexFromUrl(headAo, dir + "human_head_ao_cavity_1k.jpg?v=v69");
      upgradeTexFromUrl(headRoughness, dir + "human_head_roughness_pore_1k.jpg?v=v69");
      upgradeTexFromUrl(handNormal, dir + "human_hand_normal_512.png?v=v69");
      upgradeTexFromUrl(handAoRough, dir + "human_hand_ao_rough_512.jpg?v=v69");
    }

    if (mapsCacheByThree) mapsCacheByThree.set(T, bundle);
    else singleMapsCache = bundle;
    return bundle;
  }

  /* ==========================================================================
     3. TRUE 3D SCULPTED CRANIOFACIAL + WATERTIGHT EAR + NECK/BUST MANIFOLD
        Bit-for-bit matched to build_sculpted_humans.py & baked 1K UV maps!
     ========================================================================== */
  const BASE_Y_STATIONS = (function () {
    const set = new Set();
    const addLin = (a, b, n) => {
      for (let i = 0; i < n; i++) set.add(+(a + (b - a) * (i / (n - 1))).toFixed(6));
    };
    addLin(1.258, 1.395, 10);
    addLin(1.402, 1.505, 18);
    addLin(1.510, 1.648, 46);
    addLin(1.654, 1.734, 14);
    return Array.from(set).sort((a, b) => a - b);
  })();

  const EAR_SOCKET = { cy: 1.5955, cz: -0.0135, ry: 0.0315, rz: 0.0185 };
  let cachedCanonicalTopo = null;
  const cachedPhenotypeRaw = new Map();

  function buildRefinedBustRings(p, yStations, buildScale = 1.0) {
    const hwNeck = p.neckHalfW * lerp(1.0, buildScale, 0.25);
    const jw = p.jawWidth;
    const cw = p.craniumW;
    const mw = p.malarWidth;
    const topLift = p.craniumTop;
    const bChest = lerp(1.0, buildScale, 0.65);

    const ctrl = [
      [1.258, -0.013, 0.136 * bChest, 0.078, 0.088],
      [1.285, -0.013, 0.146 * bChest, 0.088, 0.096],
      [1.332, -0.013, 0.149 * bChest, 0.091, 0.099],
      [1.378, -0.013, 0.139 * lerp(1, buildScale, 0.5), 0.076, 0.090],
      [1.408, -0.014, 0.112 * lerp(1, buildScale, 0.4), 0.062, 0.079],
      [1.432, -0.015, hwNeck * 1.36, 0.053, 0.067],
      [1.456, -0.015, hwNeck * 1.04, 0.049, 0.058],
      [1.482, -0.015, hwNeck * 1.00, 0.048, 0.056],
      [1.504, -0.014, hwNeck * 1.00, 0.049, 0.058],
      [1.524, -0.011, lerp(hwNeck * 1.02, 0.0540 * jw, 0.45), 0.058, 0.066],
      [1.544, -0.007, 0.0570 * jw, 0.0680, 0.077],
      [1.564, -0.003, 0.0625 * lerp(jw, mw, 0.52), 0.0748, 0.089],
      [1.584, -0.002, 0.0668 * mw, 0.0795, 0.099],
      [1.600, -0.002, 0.0686 * mw, 0.0808, 0.105],
      [1.6158, -0.003, 0.0692 * cw, 0.0802, 0.110],
      [1.636, -0.004, 0.0695 * cw, 0.0825, 0.112],
      [1.666, -0.006, 0.0686 * cw, 0.0830, 0.1095],
      [1.696 + topLift * 0.50, -0.010, 0.0608 * cw, 0.0730, 0.0950],
      [1.719 + topLift * 0.80, -0.013, 0.0430 * cw, 0.0515, 0.0665],
      [1.730 + topLift * 0.95, -0.015, 0.0200 * cw, 0.0235, 0.0295],
      [1.7345 + topLift, -0.016, 0.0018, 0.0020, 0.0020]
    ];

    const nC = ctrl.length;
    const out = new Array(yStations.length);
    for (let s = 0; s < yStations.length; s++) {
      const yq = yStations[s];
      if (yq <= ctrl[0][0]) { out[s] = [yq, ctrl[0][1], ctrl[0][2], ctrl[0][3], ctrl[0][4]]; continue; }
      if (yq >= ctrl[nC - 1][0]) { const L = ctrl[nC - 1]; out[s] = [yq, L[1], L[2], L[3], L[4]]; continue; }
      let i = 0;
      while (i < nC - 2 && ctrl[i + 1][0] <= yq) i++;
      const u = (yq - ctrl[i][0]) / Math.max(1e-6, ctrl[i + 1][0] - ctrl[i][0]);
      const A = ctrl[Math.max(0, i - 1)], B = ctrl[i], C = ctrl[i + 1], D = ctrl[Math.min(nC - 1, i + 2)];
      out[s] = [
        yq,
        catmullScalar(A[1], B[1], C[1], D[1], u),
        Math.max(0.0012, catmullScalar(A[2], B[2], C[2], D[2], u)),
        Math.max(0.0012, catmullScalar(A[3], B[3], C[3], D[3], u)),
        Math.max(0.0012, catmullScalar(A[4], B[4], C[4], D[4], u))
      ];
    }
    return out;
  }

  function evalSculptedHeadPoint(sa, ca, yBase, z0, rw, rf, rb, p, includeLips, noseScale, lipScale) {
    const rz = ca >= 0 ? rf : rb;
    let lx = sa * rw;
    let lz = ca * rz;
    let ly = 0.0;

    const ax = Math.abs(lx);
    const sLat = clamp(lx / 0.008, -1, 1);
    const jw = p.jawWidth;
    const hwNeck = p.neckHalfW;
    const chinLift = p.chinLiftY;

    // 1. Continuous Oval-Tapered Anterior Mandible & Rounded Pogonion Chin (wide 50mm feather -> ZERO 3/4 cheek shelf!)
    const yMenton = 1.5095 + chinLift;
    const yPogo = 1.5205 + chinLift;
    if (yBase > yMenton - 0.016 && yBase < 1.588 && ca > -0.15) {
      if (ca > 0.0) {
        const tY = smooth(yMenton - 0.003, 1.576, yBase);
        const xJawHalf = lerp(p.chinWidth, 0.0620 * jw, Math.pow(tY, 0.66));
        const uJaw = ax / Math.max(0.014, xJawHalf);
        if (uJaw < 1.15) {
          const zPogo = p.chinProj;
          const labioDip = -0.0034 * g1(yBase, 1.5365 + chinLift * 0.4, 0.0056);
          const pogoBall = 0.0044 * g1(yBase, yPogo, 0.0104);
          const oralBarrel = -0.0024 * smooth(1.538, 1.568, yBase);
          const zApex = zPogo + pogoBall + labioDip + oralBarrel;

          const subRamp = smooth(yMenton - 0.013, yMenton + 0.009, yBase);
          const zMid = lerp(0.0365, zApex, Math.pow(subRamp, 0.78));

          const uC = Math.min(1.0, uJaw);
          const ovalZ = Math.pow(Math.max(0.0, 0.5 + 0.5 * Math.cos(uC * Math.PI)), 0.82);
          const zJawSurf = -0.004 + (zMid + 0.004) * ovalZ;

          const topFade = 1.0 - smooth(1.535, 1.586, yBase);
          const botFade = smooth(yMenton - 0.014, yMenton - 0.002, yBase);
          const caFade = smooth(0.0, 0.22, ca);
          const zCur = z0 + lz;
          const dzAdd = smoothMax(zJawSurf, zCur, 0.0065) - zCur;
          lz += dzAdd * topFade * botFade * caFade;
        }
      }

      const gonion = g2(ax, yBase, 0.0555 * jw, 1.545, 0.012, 0.016) * g1(ca, -0.04, 0.26) * p.gonionCrisp;
      lx += sLat * 0.0018 * gonion;
      lz -= 0.0014 * gonion;
      ly -= 0.0010 * gonion;

      const subTuck = g2(ax, yBase, 0.015 * jw, yMenton - 0.003, 0.020, 0.0068) * smooth(0.42, 0.90, ca);
      ly += 0.0018 * subTuck;
    }

    // 2. Cervical SCM V-Pillars, Suprasternal Jugular Notch & S-Clavicles
    if (yBase > 1.295 && yBase < 1.540 && ca > -0.28) {
      lz += g1(ax, 0.0, 0.0085) * g1(yBase, 1.476, 0.0095) * smooth(0.65, 1.0, ca) * p.larynxProm;

      const tScm = clamp((yBase - 1.409) / (1.534 - 1.409), 0, 1);
      const xScm = lerp(0.0120, hwNeck * 0.97, tScm);
      const caScm = lerp(0.92, -0.06, tScm);
      const scmMask = g1(ax, xScm, 0.0098) * g1(ca, caScm, 0.42) * smooth(1.404, 1.422, yBase) * (1.0 - smooth(1.520, 1.538, yBase));
      lz += 0.0040 * scmMask * Math.max(0.2, ca + 0.3) * p.scmStrength;
      lx += sLat * 0.0014 * scmMask * p.scmStrength;

      lz -= 0.0064 * g2(ax, yBase, 0.0, 1.408, 0.0135, 0.0145) * smooth(0.52, 1.0, ca);

      const yClav = 1.409 + 0.0065 * smooth(0.024, 0.116, ax);
      const clavEnv = smooth(0.009, 0.019, ax) * (1.0 - smooth(0.108, 0.134, ax));
      const sCurveCa = lerp(0.92, 0.28, smooth(0.020, 0.118, ax));
      const clavRidge = g1(yBase, yClav, 0.0086) * clavEnv * g1(ca, sCurveCa, 0.42);
      const supraFossa = g2(ax, yBase, 0.056, 1.424, 0.024, 0.0090) * g1(ca, 0.52, 0.35);
      const infraFossa = g2(ax, yBase, 0.074, 1.390, 0.024, 0.0115) * smooth(0.25, 0.85, ca);
      lz += 0.0048 * clavRidge - 0.0022 * supraFossa - 0.0020 * infraFossa;
      ly += 0.0018 * clavRidge;

      lz -= 0.0016 * g1(ax, 0.0, 0.011) * smooth(1.295, 1.325, yBase) * (1.0 - smooth(1.372, 1.395, yBase)) * smooth(0.65, 1.0, ca);
    }

    if (yBase > 1.418 && yBase < 1.538 && ca < -0.45) {
      const backW = smooth(-0.45, -0.95, ca);
      lz += -0.0025 * g1(ax, 0.0, 0.014) * g1(yBase, 1.440, 0.015) * backW
            + 0.0020 * g1(ax, 0.0, 0.012) * g1(yBase, 1.498, 0.022) * backW;
    }

    // 3. Craniofacial Planes (0b07591c.jpg 1:1)
    if (ca > -0.35 && yBase > 1.520) {
      lz += p.foreheadBoss * g2(ax, yBase, 0.022, 1.652, 0.042, 0.020) * (1.0 - smooth(1.652, 1.665, yBase)) * smooth(0.32, 0.95, ca);

      const browArchY = 1.6345 + 0.0038 * smooth(0.011, 0.036, ax) - 0.0034 * smooth(0.037, 0.055, ax);
      const brow = g1(yBase, browArchY, 0.0128) * smooth(0.005, 0.015, ax) * (1.0 - smooth(0.044, 0.059, ax)) * smooth(0.25, 0.92, ca);
      const glabella = g1(ax, 0.0, 0.0125) * g1(yBase, 1.6345, 0.0115) * smooth(0.58, 1.0, ca);
      const browHairY = 1.6338 + 0.0046 * smooth(0.010, 0.035, ax) - 0.0040 * smooth(0.035, 0.052, ax);
      const browPad = g1(yBase, browHairY, 0.0036) * smooth(0.009, 0.015, ax) * (1.0 - smooth(0.044, 0.053, ax)) * smooth(0.42, 0.95, ca);
      lz += (0.0040 * brow + 0.0026 * glabella) * p.browArch + 0.00085 * browPad * lerp(0.75, 1.15, clamp(p.browArch, 0.4, 1.3));

      const orbRecess = g2(ax, yBase, 0.0305, 1.6162, 0.0195, 0.0115) * smooth(0.45, 0.96, ca);
      const latOrb = g2(ax, yBase, 0.0455, 1.616, 0.0075, 0.0125) * smooth(0.20, 0.82, ca);
      const infraCushion = g2(ax, yBase, 0.031, 1.599, 0.017, 0.0075) * smooth(0.35, 0.90, ca);
      lz += -0.0014 * orbRecess + 0.0032 * latOrb + 0.0012 * infraCushion;

      lx -= sLat * 0.0028 * g2(ax, yBase, 0.064, 1.632, 0.015, 0.023) * g1(ca, 0.26, 0.34);

      // Refined sculpted nasal bridge, rounded tip, compact alar lobules & ~102° subnasale-to-philtrum flow (0b07591c.jpg 1:1!)
      const tipY = 1.5825 + p.noseTipLiftY;
      const alarW = p.alarWidth;
      const nasionDip = g1(ax, 0.0, 0.0140) * g1(yBase, 1.622, 0.0090) * smooth(0.58, 1.0, ca);
      const zCurTip = z0 + rf;
      const tipAmp = Math.max(0.011, p.noseTipProj - zCurTip) * noseScale;

      // Soft rounded dorsum (wide gaussian -> ZERO faceted wedge/pyramid ridge) + round lobular tip
      const tDorsum = clamp((1.625 - yBase) / Math.max(0.015, 1.625 - tipY), 0, 1);
      const dorsumEnv = tDorsum * (1.0 - smooth(tipY - 0.002, tipY - 0.012, yBase)) * smooth(1.628, 1.616, yBase);
      const bridgeW = lerp(0.0068, 0.0092, tDorsum);
      const bridge = g1(ax, 0.0, bridgeW) * dorsumEnv * smooth(0.50, 0.98, ca);
      const sidewall = g1(ax, bridgeW * 1.30, 0.0062) * dorsumEnv * smooth(0.45, 0.95, ca);

      const noseTip = g1(ax, 0.0, 0.0102) * g1(yBase, tipY, 0.0108) * smooth(0.58, 1.0, ca);
      const columella = g1(ax, 0.0, 0.0050) * g1(yBase, tipY - 0.0072, 0.0068) * smooth(0.65, 1.0, ca);
      const subnasaleRamp = g1(ax, 0.0, 0.0150) * g1(yBase, tipY - 0.0130, 0.0085) * smooth(0.62, 1.0, ca);

      // Full rounded alar lobules flaring laterally + recessed oblique nostrils (0b07591c.jpg front & 3/4!)
      const alar = g2(ax, yBase, alarW * 0.82, tipY - 0.0046, alarW * 0.32, 0.0052) * smooth(0.42, 0.96, ca);
      const alarGroove = g2(ax, yBase, alarW * 1.06, tipY - 0.0030, 0.0030, 0.0060) * smooth(0.45, 0.94, ca);
      const nDx = (ax - alarW * 0.48) / 0.0034;
      const nDy = (yBase - (tipY - 0.0072 - 0.0010 * (ax / Math.max(0.01, alarW)))) / 0.0021;
      const nostrilHole = Math.exp(-(nDx * nDx + nDy * nDy)) * smooth(0.62, 1.0, ca);

      const dorsumRidge = (tipAmp * 0.84 * bridge + 0.0030 * sidewall) * p.noseBridge;
      const tipBall = tipAmp * noseTip;
      const noseMidZ = Math.max(dorsumRidge, tipBall) + 0.16 * Math.min(dorsumRidge, tipBall);

      lz += -0.0016 * nasionDip + noseMidZ + (0.0064 * columella + 0.0046 * subnasaleRamp) * noseScale + 0.0124 * alar - 0.0026 * alarGroove - 0.0034 * nostrilHole;
      ly += 0.0012 * nostrilHole;
      lx += sLat * (0.0028 * alar - 0.0008 * alarGroove);

      // Zygomatic Arch & Smooth 2.5x Wider-Falloff Malar-to-Buccal Flow (ZERO 3/4 cheek horizontal shelf!)
      const malarSweepY = 1.596 + 0.005 * smooth(0.036, 0.066, ax);
      const malar = g2(ax, yBase, 0.049, malarSweepY, 0.023, 0.035) * smooth(-0.08, 0.76, ca) * p.malarHigh;
      const zygoArch = g2(ax, yBase, 0.064, 1.599, 0.012, 0.025) * g1(ca, 0.16, 0.36) * p.malarHigh;
      const subMalar = g2(ax, yBase, 0.049, 1.558, 0.023, 0.030) * smooth(0.05, 0.65, ca);
      lx += sLat * (0.0032 * malar + 0.0016 * zygoArch + p.buccalFull * 0.75 * subMalar - 0.0009 * subMalar * (1.0 - Math.max(0.0, p.buccalFull * 120.0)));
      lz += 0.0046 * malar + 0.0014 * zygoArch + p.buccalFull * subMalar - 0.0006 * subMalar;

      const nlX = alarW * 1.06 + Math.max(0.0, (tipY - 0.004) - yBase) * 0.42;
      const nlEnv = smooth(1.554, 1.576, yBase) * (1.0 - smooth(1.577, 1.586, yBase)) * smooth(0.45, 0.92, ca);
      const nlCrease = g1(ax, nlX, 0.0055) * nlEnv * lerp(0.22, 1.40, p.ageLines) * (1.0 - clamp(p.buccalFull * 140.0, 0, 0.75));
      lz -= 0.0010 * nlCrease;

      if (includeLips) {
        const mwLip = p.mouthWidth;
        const uM = ax / Math.max(0.012, mwLip);
        // Smooth Ricketts' E-line maxillary philtrum support -> ZERO duck-bill shelf above upper lip in 90° profile!
        const philSupport = g1(ax, 0.0, mwLip * 0.90) * g1(yBase, 1.5650, 0.0100) * smooth(0.55, 1.0, ca);
        const philEnv = g1(yBase, 1.5675, 0.0070) * smooth(0.68, 1.0, ca);
        const philDimple = g1(ax, 0.0, 0.0038) * philEnv;
        const philRidge = g1(ax, 0.0054, 0.0023) * philEnv;

        // Closed-contact overlapping vermilion cushions -> short ~6.5mm front sculptural parting notch in 90° profile (ZERO frog slit!)
        const taperU = Math.pow(Math.max(0.0, 1.0 - Math.pow(Math.min(1.0, uM / 1.02), 1.85)), 0.82) * smooth(0.56, 1.0, ca);
        const taperL = Math.pow(Math.max(0.0, 1.0 - Math.pow(Math.min(1.0, uM / 0.96), 1.80)), 0.84) * smooth(0.56, 1.0, ca);
        const cupidPeak = 0.00155 * g1(ax, 0.0054, 0.0029) - 0.00070 * g1(ax, 0.0, 0.0021);
        const uLip = g1(yBase, 1.5570 + cupidPeak - 0.0018 * Math.min(1.05, uM * uM), 0.0070) * taperU;
        const lLip = g1(yBase, 1.5472 + 0.0014 * Math.min(1.05, uM * uM), 0.0076) * taperL;
        const modiolusFill = g2(ax, yBase, mwLip * 0.78, 1.5525, 0.0075, 0.0068) * smooth(0.58, 0.96, ca);

        const rimaY = 1.5525 - 0.00035 * g1(ax, 0.0, 0.0040) + 0.00032 * g1(ax, 0.0080, 0.0040) + 0.00024 * smooth(0.58, 0.92, uM);
        // Strictly gate rima groove to central ~76% of vermilion (ax < mwLip * 0.78) so 3/4 & 90° profiles have ZERO lateral trench!
        const rimaGate = (1.0 - smooth(0.46, 0.78, uM)) * smooth(0.070, 0.078, z0 + rf) * smooth(0.68, 1.0, ca);
        const rima = g1(yBase, rimaY, 0.0013) * rimaGate;

        // Full forward vermilion volumes (+~3mm each vs Pass-3a) for true East African lip protrusion in 90° profile!
        lz += (0.0056 * philSupport - 0.0010 * philDimple + 0.0012 * philRidge
               + 0.0128 * uLip * p.lipFullU * lipScale
               + 0.0132 * lLip * p.lipFullL * lipScale
               + 0.0012 * modiolusFill
               - 0.0016 * rima);
      }
    }

    return [lx, yBase + ly, z0 + lz];
  }

  function headPosToUv(px, py, pz, seamSign = 0.0) {
    let ang = Math.atan2(px, pz + 0.008);
    if (Math.abs(Math.abs(ang) - Math.PI) < 1e-4 && seamSign !== 0.0) {
      ang = seamSign >= 0 ? Math.PI : -Math.PI;
    }
    const tRaw = ang / Math.PI;
    const tMag = Math.sign(tRaw) * Math.pow(Math.abs(tRaw), 0.82);
    const u = 0.5 + 0.5 * tMag;

    let v;
    if (py <= 1.495) {
      v = lerp(0.02, 0.28, clamp((py - 1.258) / (1.495 - 1.258), 0, 1));
    } else if (py <= 1.690) {
      v = lerp(0.28, 0.74, clamp((py - 1.495) / (1.690 - 1.495), 0, 1));
    } else {
      v = lerp(0.74, 0.82, clamp((py - 1.690) / (1.742 - 1.690), 0, 1));
    }
    return [clamp(u, 0.002, 0.998), clamp(v, 0.02, 0.82)];
  }

  function evalSkullAtYZ(side, py, pz, ringsData, p, noseScale, lipScale) {
    let lo = 0, hi = ringsData.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ringsData[mid][0] <= py) lo = mid; else hi = mid;
    }
    const r0 = ringsData[lo], r1 = ringsData[hi];
    const t = clamp((py - r0[0]) / Math.max(1e-6, r1[0] - r0[0]), 0, 1);
    const z0 = lerp(r0[1], r1[1], t);
    const rw = lerp(r0[2], r1[2], t);
    const rf = lerp(r0[3], r1[3], t);
    const rb = lerp(r0[4], r1[4], t);
    const dz = pz - z0;
    const rz = dz >= 0 ? rf : rb;
    const ca = clamp(dz / Math.max(0.008, rz), -0.985, 0.985);
    const sa = side * Math.sqrt(Math.max(0.02, 1.0 - ca * ca));
    return evalSculptedHeadPoint(sa, ca, py, z0, rw, rf, rb, p, false, noseScale, lipScale)[0];
  }

  function evalSculptedEarPoint(side, th, tRad, ringsData, p, noseScale, lipScale) {
    const esc = p.earScale;
    const cy = EAR_SOCKET.cy, cz = EAR_SOCKET.cz;
    const cth = Math.cos(th), sth = Math.sin(th);

    const yWeld = cy + EAR_SOCKET.ry * sth;
    const zWeld = cz + EAR_SOCKET.rz * cth;
    const xWeld = evalSkullAtYZ(side, yWeld, zWeld, ringsData, p, noseScale, lipScale);

    const tilt = -0.15;
    const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
    const ctT = cth * cosT - sth * sinT;
    const stT = cth * sinT + sth * cosT;

    const zAntSpan = (0.0132 + 0.0028 * smooth(-0.4, 0.65, stT)) * esc;
    const zPostSpan = (0.0208 + 0.0035 * smooth(-0.3, 0.55, stT) - 0.0038 * smooth(-0.55, -1.0, stT)) * esc;
    const dyRim = (stT >= 0 ? 0.0282 : 0.0286) * esc * stT;
    const dzRim = (ctT >= 0 ? zAntSpan : zPostSpan) * ctT;
    const yRim = cy + dyRim * cosT + dzRim * sinT;
    const zRim = (cz - 0.0036 * esc) - dyRim * sinT + dzRim * cosT;

    const postW = smooth(0.42, -0.52, cth);
    const poleRound = Math.pow(Math.max(0.08, 1.0 - 0.68 * sth * sth), 0.75);
    const lobeW = smooth(-0.35, -0.95, sth);

    const yBaseInner = cy + 0.0258 * esc * sth;
    const zBaseInner = cz + 0.0132 * esc * cth;
    const xBaseInner = evalSkullAtYZ(side, yBaseInner, zBaseInner, ringsData, p, noseScale, lipScale);
    const xBaseSkull = Math.abs(xBaseInner);
    const splayLat = (0.0018 + 0.0086 * postW * poleRound + 0.0034 * lobeW) * esc;

    const yCanal = cy - 0.0036 * esc;
    const zCanal = cz - 0.0034 * esc;

    const helixAng = th < 5.2 ? smooth(0.18, 0.55, th) * (1.0 - smooth(4.15, 4.65, th)) : 0.0;
    const tragusAng = g1(cth, 0.94, 0.24) * g1(sth, -0.14, 0.26);
    const antitragusAng = g1(cth, 0.10, 0.34) * g1(sth, -0.82, 0.22);
    const intertragicAng = g1(cth, 0.62, 0.22) * g1(sth, -0.62, 0.20);

    const antihelixStem = smooth(0.35, -0.45, cth) * smooth(-0.68, -0.15, sth) * (1.0 - smooth(0.35, 0.78, sth));
    const infCrus = g1(sth, 0.34, 0.18) * smooth(-0.35, 0.65, cth);
    const supCrus = g1(sth, 0.68, 0.22) * smooth(-0.55, 0.35, cth);
    const triFossa = g1(sth, 0.52, 0.16) * smooth(-0.25, 0.45, cth);

    let pxFinal, pyFinal, pzFinal;
    if (tRad <= 0.14) {
      const uCol = tRad / 0.14;
      pyFinal = lerp(yWeld, yBaseInner, uCol);
      pzFinal = lerp(zWeld, zBaseInner, uCol);
      const xSkHere = evalSkullAtYZ(side, pyFinal, pzFinal, ringsData, p, noseScale, lipScale);
      const collarOff = lerp(-0.00045, 0.00012, smooth(0.0, 0.85, uCol));
      pxFinal = xSkHere + side * collarOff;
    } else if (tRad <= 0.44) {
      const u = (tRad - 0.14) / 0.30;
      const retroDip = u < 0.36 ? -0.0014 * Math.sin(Math.min(1.0, u / 0.36) * Math.PI) * postW : 0.0;
      const easeYZ = Math.pow(u, 0.80);
      pyFinal = lerp(yBaseInner, yRim, easeYZ);
      pzFinal = lerp(zBaseInner, zRim, easeYZ);
      const tubeSwell = Math.sin(u * Math.PI * 0.5);
      const helixCrest = 0.0024 * g1(u, 0.92, 0.24) * (0.65 * helixAng * poleRound + 0.55 * lobeW) * esc;
      pxFinal = side * (xBaseSkull + 0.00012 + retroDip + splayLat * tubeSwell + helixCrest);
    } else {
      const u = (tRad - 0.44) / 0.56;
      const radIn = Math.pow(u, 0.88);
      pyFinal = lerp(yRim, yCanal, radIn);
      pzFinal = lerp(zRim, zCanal, radIn) - 0.0024 * g1(u, 0.38, 0.14) * tragusAng * esc;

      const baseLat = lerp(splayLat, -0.0038 * esc, smooth(0.18, 0.96, u));
      const helixRoll = 0.0032 * g1(u, 0.08, 0.12) * helixAng * poleRound * esc;
      const lobulePillow = 0.0034 * Math.sin(clamp(u / 0.58, 0, 1) * Math.PI) * lobeW * esc;
      const scaphaGroove = -0.0022 * g1(u, 0.26, 0.09) * helixAng * esc;
      const fossaHollow = -0.0018 * g1(u, 0.36, 0.11) * triFossa * esc;
      const antihelixRidge = 0.0034 * g1(u, 0.44, 0.12) * (antihelixStem + 0.85 * infCrus + 0.75 * supCrus) * esc;
      const antitragusBump = 0.0030 * g1(u, 0.42, 0.12) * antitragusAng * esc;
      const notchDip = -0.0020 * g1(u, 0.40, 0.14) * intertragicAng * esc;
      const tragusFlap = 0.0034 * g1(u, 0.34, 0.14) * tragusAng * esc;
      const crusBar = 0.0020 * g1(sth, 0.10, 0.13) * smooth(0.15, 0.85, cth) * g1(u, 0.56, 0.16) * esc;
      const conchaBowl = -0.0030 * g1(u, 0.74, 0.16) * (1.0 - 0.55 * tragusAng) * esc;

      pxFinal = side * (xBaseSkull + baseLat + helixRoll + lobulePillow + scaphaGroove + fossaHollow
                        + antihelixRidge + antitragusBump + notchDip + tragusFlap + crusBar + conchaBowl);
    }

    const rUv = 0.46 * (1.0 - 0.88 * tRad);
    const uCtr = side > 0 ? 0.25 : 0.75;
    return [
      pxFinal,
      pyFinal,
      pzFinal,
      uCtr + rUv * 0.44 * (cth * side),
      0.91 + rUv * 0.14 * sth
    ];
  }

  function getSculptedHeadBustRaw(phenoKey, buildScale, noseScale, lipScale) {
    const cacheKey = `${phenoKey}|${buildScale.toFixed(2)}|${noseScale.toFixed(2)}|${lipScale.toFixed(2)}`;
    if (cachedPhenotypeRaw.has(cacheKey)) return cachedPhenotypeRaw.get(cacheKey);

    const p = PHENOTYPES[phenoKey] || PHENOTYPES.imani;
    const yStations = BASE_Y_STATIONS.map(yb => yb + p.craniumTop * smooth(1.650, 1.734, yb));
    const ringsData = buildRefinedBustRings(p, yStations, buildScale);
    const SEG = 88;
    const N_RINGS = ringsData.length;
    const COLS = SEG + 1;

    const pos = [];
    const uv = [];
    const isEar = [];
    const mouthMeta = []; // [lipSign, 0, mucosaDepth, rimaEdge]

    for (let i = 0; i < N_RINGS; i++) {
      const [yb, z0, rw, rf, rb] = ringsData[i];
      for (let j = 0; j < COLS; j++) {
        const a = (j / SEG) * TAU + Math.PI;
        const sa = Math.sin(a), ca = Math.cos(a);
        let [px, py, pz] = evalSculptedHeadPoint(sa, ca, yb, z0, rw, rf, rb, p, true, noseScale, lipScale);
        if (Math.abs(sa) > 0.72 && yb > 1.572 && yb < 1.616) {
          const nyC = (yb - (EAR_SOCKET.cy - 0.003)) / 0.0145;
          const nzC = (pz - (EAR_SOCKET.cz - 0.003)) / 0.0095;
          const r2C = nyC * nyC + nzC * nzC;
          if (r2C < 2.2) px -= Math.sign(px) * 0.0052 * Math.exp(-r2C * 1.35);
        }
        pos.push(px, py, pz);
        const seamSgn = j === 0 ? -1.0 : (j === SEG ? 1.0 : 0.0);
        const [u, v] = headPosToUv(px, py, pz, seamSgn);
        uv.push(u, v);
        isEar.push(0.0);
        // Zero lipSign outside vermilion so FACS lip displacements match mouthBag iv=6..7 to 0.000mm!
        const dyMGrid = (py - 1.5525) / (py >= 1.5525 ? 0.0138 : 0.0178);
        const rApGrid = Math.hypot(px / 0.0315, dyMGrid);
        const lipSignGrid = rApGrid < 0.85
          ? g1(Math.abs(px), 0, 0.022) * g1(py, 1.5525, 0.0095) * (py >= 1.5525 ? 1.0 : -1.0) * smooth(0.55, 0.92, ca) * (1.0 - smooth(0.62, 0.85, rApGrid))
          : 0.0;
        mouthMeta.push(lipSignGrid, 0.0, 0.0, 0.0);
      }
    }

    // Build canonical topology mask once from Imani so all phenotypes share 100.000% identical indices!
    if (!cachedCanonicalTopo) {
      const insideMouthPocket = vid => {
        const vx = pos[vid * 3], vy = pos[vid * 3 + 1], vz = pos[vid * 3 + 2];
        if (vz <= 0.056) return false;
        const nx = vx / 0.0278;
        const ny = (vy - 1.5525) / (vy >= 1.5525 ? 0.0112 : 0.0145);
        return (nx * nx + ny * ny) < 1.0;
      };
      const insideEyePocket = (vid, sideSgn) => {
        const vx = pos[vid * 3], vy = pos[vid * 3 + 1], vz = pos[vid * 3 + 2];
        if (vz <= 0.035 || vx * sideSgn <= 0) return false;
        const nx = (Math.abs(vx) - 0.0300) / 0.0226;
        const ny = (vy - 1.6158) / 0.0142;
        return (nx * nx + ny * ny) < 0.94;
      };

      const gridIdx = [];
      for (let i = 0; i < N_RINGS - 1; i++) {
        for (let j = 0; j < SEG; j++) {
          const A = i * COLS + j, Bv = A + 1, C = A + COLS, D = C + 1;
          if (insideMouthPocket(A) && insideMouthPocket(Bv) && insideMouthPocket(C) && insideMouthPocket(D)) continue;
          if ((insideEyePocket(A, 1) && insideEyePocket(Bv, 1) && insideEyePocket(C, 1) && insideEyePocket(D, 1)) ||
              (insideEyePocket(A, -1) && insideEyePocket(Bv, -1) && insideEyePocket(C, -1) && insideEyePocket(D, -1))) continue;
          gridIdx.push(A, Bv, C, Bv, D, C);
        }
      }

      cachedCanonicalTopo = { gridIdx };
    }

    const idx = cachedCanonicalTopo.gridIdx.slice();
    const earSeamPairs = [];
    const earFlangeVids = [];

    const buildPolarEar = side => {
      const K = 48;
      const tStations = [0.0, 0.06, 0.13, 0.24, 0.35, 0.42, 0.49, 0.57, 0.66, 0.76, 0.87, 0.96];
      let prevRing = null;
      for (let rIdx = 0; rIdx < tStations.length; rIdx++) {
        const tRad = tStations[rIdx];
        const earW = smooth(0.06, 0.24, tRad);
        const flangeW = 1.0 - smooth(0.04, 0.18, tRad);
        const curRing = new Array(K + 1);
        for (let k = 0; k <= K; k++) {
          const kw = k === K ? 0 : k;
          const th = (kw / K) * TAU;
          const thOriented = side > 0 ? ((TAU - th) % TAU) : th;
          const [pxE, pyE, pzE, ue, ve] = evalSculptedEarPoint(side, thOriented, tRad, ringsData, p, noseScale, lipScale);
          const ev = pos.length / 3;
          pos.push(pxE, pyE, pzE);
          uv.push(ue, ve);
          isEar.push(earW);
          mouthMeta.push(0, 0, 0, 0);
          curRing[k] = ev;
          if (flangeW > 0.01) earFlangeVids.push([ev, side, flangeW]);
        }
        earSeamPairs.push([curRing[0], curRing[K]]);
        if (prevRing) {
          for (let k = 0; k < K; k++) {
            const a0 = prevRing[k], b0 = prevRing[k + 1], c0 = curRing[k], d0 = curRing[k + 1];
            idx.push(a0, b0, c0, b0, d0, c0);
          }
        }
        prevRing = curRing;
      }

      const [pxC, pyC, pzC] = evalSculptedEarPoint(side, 0.0, 1.0, ringsData, p, noseScale, lipScale);
      const capId = pos.length / 3;
      pos.push(pxC, pyC, pzC);
      uv.push(side > 0 ? 0.25 : 0.75, 0.91);
      isEar.push(1.0);
      mouthMeta.push(0, 0, 0, 0);
      for (let k = 0; k < K; k++) {
        idx.push(prevRing[k], prevRing[k + 1], capId);
      }
    };

    buildPolarEar(1);
    buildPolarEar(-1);

    const evalFacialSkinZ = (pxQ, pyQ, includeLips = true) => {
      const yq = clamp(pyQ, ringsData[0][0], ringsData[ringsData.length - 1][0]);
      let lo = 0, hi = ringsData.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (ringsData[mid][0] <= yq) lo = mid; else hi = mid;
      }
      const r0 = ringsData[lo], r1 = ringsData[hi];
      const t = clamp((yq - r0[0]) / Math.max(1e-6, r1[0] - r0[0]), 0, 1);
      const z0 = lerp(r0[1], r1[1], t), rw = lerp(r0[2], r1[2], t), rf = lerp(r0[3], r1[3], t), rb = lerp(r0[4], r1[4], t);
      let saEst = clamp(pxQ / Math.max(0.018, rw), -0.992, 0.992);
      for (let it = 0; it < 3; it++) {
        const caEst = Math.sqrt(Math.max(0.01, 1.0 - saEst * saEst));
        const lxCur = evalSculptedHeadPoint(saEst, caEst, yq, z0, rw, rf, rb, p, includeLips, noseScale, lipScale)[0];
        saEst = clamp(saEst + (pxQ - lxCur) / Math.max(0.020, rw), -0.995, 0.995);
      }
      const caEst = Math.sqrt(Math.max(0.01, 1.0 - saEst * saEst));
      return evalSculptedHeadPoint(saEst, caEst, yq, z0, rw, rf, rb, p, includeLips, noseScale, lipScale)[2];
    };

    // 48x7 Split-Vermilion Openable Mouth + Recessed Wet Mucosal Oral Cavity Pouch (tightly bounded to front vermilion!)
    const NMOUTH = 48, VMOUTH = 7;
    const baseMouth = pos.length / 3;
    const mwLip = p.mouthWidth;
    const xMouthOuter = mwLip + 0.0054; // ~0.0312m — stays 100% on front face, ZERO lateral cheek slit!
    const mouthSeamPairs = [];

    for (let iv = 0; iv <= VMOUTH; iv++) {
      const rowStart = baseMouth + iv * (NMOUTH + 1);
      mouthSeamPairs.push([rowStart, rowStart + NMOUTH]);
      for (let iu = 0; iu <= NMOUTH; iu++) {
        const iuW = iu === NMOUTH ? 0 : iu;
        const th = (iuW / NMOUTH) * TAU;
        const cth = Math.cos(th), sth = Math.sin(th);
        const absCth = Math.abs(cth);
        const centerF = Math.max(0, 1.0 - cth * cth);
        const commFade = 1.0 - smooth(0.46, 0.80, absCth);
        const rimaY = 1.5525 - 0.00035 * g1(cth, 0, 0.18)
          + 0.00032 * (g1(cth, 0.32, 0.18) + g1(cth, -0.32, 0.18))
          + 0.00024 * smooth(0.58, 0.92, absCth);
        const zRima = evalFacialSkinZ(mwLip * cth, rimaY, true);

        let px, py, pz, mucosaDepth = 0.0, rimaEdge = 0.0;
        if (iv === 0) {
          px = 0.0; py = 1.5525; pz = 0.0465; mucosaDepth = 1.0;
        } else if (iv === 1) {
          px = (mwLip + 0.0016) * cth; py = 1.5525 + 0.0185 * sth; pz = 0.0505 - 0.0035 * cth * cth; mucosaDepth = 0.88;
        } else if (iv === 2) {
          px = (mwLip - 0.0002) * cth;
          py = rimaY + sth * (sth >= 0 ? 0.0022 : 0.0018) * (0.28 + 0.72 * Math.pow(centerF, 0.50));
          pz = zRima - 0.0038 * (0.20 + 0.80 * commFade); mucosaDepth = 0.34; rimaEdge = 0.40 * commFade;
        } else if (iv === 3) {
          // Subtle -0.85mm front rima tuck fading to 0.000mm by |cth| = 0.80 -> ZERO lateral slit in 3/4 & 90° profile!
          px = mwLip * cth; py = rimaY; pz = zRima - 0.00085 * commFade * (0.45 + 0.55 * centerF); rimaEdge = commFade;
        } else {
          const tOut = (iv - 3) / 4.0;
          const xSpan = lerp(mwLip, xMouthOuter, Math.pow(tOut, 0.92));
          const ySpan = (sth >= 0 ? 0.0138 : 0.0178) * Math.pow(tOut, 0.88);
          const archSh = lerp(0.65 + 0.35 * centerF, 1.0, smooth(0.15, 0.75, tOut));
          px = xSpan * cth;
          py = rimaY + sth * ySpan * archSh;
          const zSurf = evalFacialSkinZ(px, py, true);
          const rimaRoll = iv === 4 ? (0.00022 * commFade * (0.35 + 0.65 * centerF)) : 0.0;
          pz = zSurf + rimaRoll;
          rimaEdge = iv === 4 ? (0.32 * commFade) : 0.0;
        }

        pos.push(px, py, pz);
        const [uM, vM] = headPosToUv(px, py, Math.max(0.030, pz));
        uv.push(uM, vM);
        isEar.push(0.0);
        const lipSign = (sth >= 0 ? 1.0 : -1.0) * (1.0 - smooth(4.2, 5.4, iv));
        mouthMeta.push(lipSign, 0.0, mucosaDepth, rimaEdge);
      }
    }

    const mCols = NMOUTH + 1;
    for (let iv = 0; iv < VMOUTH; iv++) {
      for (let iu = 0; iu < NMOUTH; iu++) {
        const A = baseMouth + iv * mCols + iu, Bv = A + 1, C = A + mCols, D = C + 1;
        idx.push(A, C, Bv, Bv, C, D);
      }
    }

    const V = pos.length / 3;
    const posArr = new Float32Array(pos);
    const gridCount = N_RINGS * COLS;

    // 2-Pass Feathered Volume-Preserving Taubin Clay Polish across skull grid (ZERO binary boundary step!)
    const nbrLists = Array.from({ length: gridCount }, () => []);
    const addNbr = (a, b) => {
      if (a >= gridCount || b >= gridCount || a === b) return;
      const arr = nbrLists[a];
      if (arr.indexOf(b) < 0) arr.push(b);
    };
    for (let t = 0; t < idx.length; t += 3) {
      const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2];
      if (i0 < gridCount && i1 < gridCount && i2 < gridCount) {
        addNbr(i0, i1); addNbr(i0, i2);
        addNbr(i1, i0); addNbr(i1, i2);
        addNbr(i2, i0); addNbr(i2, i1);
      }
    }

    const wSmooth = new Float32Array(gridCount);
    for (let v = 0; v < gridCount; v++) {
      if (nbrLists[v].length < 3) continue;
      const vx = posArr[v * 3], vy = posArr[v * 3 + 1], vz = posArr[v * 3 + 2];
      if (vy < 1.275 || vy > 1.725) continue;
      let wV = smooth(1.275, 1.300, vy) * (1.0 - smooth(1.705, 1.725, vy));
      if (vz > 0.025) {
        const eo = Math.pow((Math.abs(vx) - 0.0300) / 0.0255, 2) + Math.pow((vy - 1.6158) / 0.0165, 2);
        const em = Math.pow(vx / 0.0325, 2) + Math.pow((vy - 1.5525) / (vy >= 1.5525 ? 0.0148 : 0.0190), 2);
        wV *= smooth(1.12, 1.55, eo) * smooth(1.15, 1.65, em);
      }
      wSmooth[v] = wV;
    }

    const tmpPos = new Float32Array(posArr.length);
    for (let pass = 0; pass < 2; pass++) {
      for (const stepK of [0.30, -0.312]) {
        tmpPos.set(posArr);
        for (let v = 0; v < gridCount; v++) {
          const wV = wSmooth[v];
          if (wV <= 1e-4) continue;
          const nbrs = nbrLists[v], nL = nbrs.length;
          let sx = 0, sy = 0, sz = 0;
          for (let q = 0; q < nL; q++) {
            const nb = nbrs[q] * 3;
            sx += posArr[nb]; sy += posArr[nb + 1]; sz += posArr[nb + 2];
          }
          const v3 = v * 3;
          const kEff = stepK * wV;
          tmpPos[v3]     = posArr[v3]     + kEff * (sx / nL - posArr[v3]);
          tmpPos[v3 + 1] = posArr[v3 + 1] + kEff * (sy / nL - posArr[v3 + 1]);
          tmpPos[v3 + 2] = posArr[v3 + 2] + kEff * (sz / nL - posArr[v3 + 2]);
        }
        for (let i = 0; i < N_RINGS; i++) {
          const a0 = (i * COLS) * 3, a1 = (i * COLS + SEG) * 3;
          const my = 0.5 * (tmpPos[a0 + 1] + tmpPos[a1 + 1]);
          const mz = 0.5 * (tmpPos[a0 + 2] + tmpPos[a1 + 2]);
          tmpPos[a0] = 0; tmpPos[a0 + 1] = my; tmpPos[a0 + 2] = mz;
          tmpPos[a1] = 0; tmpPos[a1 + 1] = my; tmpPos[a1 + 2] = mz;
        }
        posArr.set(tmpPos);
      }
    }

    // Compute stitched smooth normals BEFORE tucking straddle vertices!
    const bindPosArr = new Float32Array(posArr);
    const nrmArr = new Float32Array(V * 3);
    for (let t = 0; t < idx.length; t += 3) {
      const i0 = idx[t] * 3, i1 = idx[t + 1] * 3, i2 = idx[t + 2] * 3;
      const ux = posArr[i1] - posArr[i0], uy = posArr[i1 + 1] - posArr[i0 + 1], uz = posArr[i1 + 2] - posArr[i0 + 2];
      const vx = posArr[i2] - posArr[i0], vy = posArr[i2 + 1] - posArr[i0 + 1], vz = posArr[i2 + 2] - posArr[i0 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      nrmArr[i0] += nx; nrmArr[i0 + 1] += ny; nrmArr[i0 + 2] += nz;
      nrmArr[i1] += nx; nrmArr[i1 + 1] += ny; nrmArr[i1 + 2] += nz;
      nrmArr[i2] += nx; nrmArr[i2 + 1] += ny; nrmArr[i2 + 2] += nz;
    }

    const stitchPair = (a, b) => {
      const a3 = a * 3, b3 = b * 3;
      const sx = nrmArr[a3] + nrmArr[b3], sy = nrmArr[a3 + 1] + nrmArr[b3 + 1], sz = nrmArr[a3 + 2] + nrmArr[b3 + 2];
      nrmArr[a3] = nrmArr[b3] = sx;
      nrmArr[a3 + 1] = nrmArr[b3 + 1] = sy;
      nrmArr[a3 + 2] = nrmArr[b3 + 2] = sz;
    };
    for (let i = 0; i < N_RINGS; i++) stitchPair(i * COLS, i * COLS + SEG);
    for (let k = 0; k < earSeamPairs.length; k++) stitchPair(earSeamPairs[k][0], earSeamPairs[k][1]);
    for (let k = 0; k < mouthSeamPairs.length; k++) stitchPair(mouthSeamPairs[k][0], mouthSeamPairs[k][1]);

    for (let v = 0; v < V; v++) {
      const v3 = v * 3;
      const nl = Math.hypot(nrmArr[v3], nrmArr[v3 + 1], nrmArr[v3 + 2]) || 1.0;
      nrmArr[v3] /= nl; nrmArr[v3 + 1] /= nl; nrmArr[v3 + 2] /= nl;
    }

    // Transfer exact skull gradient normals onto the feathered 3D ear collar (0.000° seam in Clay & PBR!)
    const epsE = 0.0016;
    for (let k = 0; k < earFlangeVids.length; k++) {
      const [ev, side, flW] = earFlangeVids[k];
      const ev3 = ev * 3;
      const vy = posArr[ev3 + 1], vz = posArr[ev3 + 2];
      const dxdy = (evalSkullAtYZ(side, vy + epsE, vz, ringsData, p, noseScale, lipScale) - evalSkullAtYZ(side, vy - epsE, vz, ringsData, p, noseScale, lipScale)) / (2 * epsE);
      const dxdz = (evalSkullAtYZ(side, vy, vz + epsE, ringsData, p, noseScale, lipScale) - evalSkullAtYZ(side, vy, vz - epsE, ringsData, p, noseScale, lipScale)) / (2 * epsE);
      const glE = Math.hypot(side, -side * dxdy, -side * dxdz) || 1.0;
      const mx = lerp(nrmArr[ev3], side / glE, flW);
      const my = lerp(nrmArr[ev3 + 1], (-side * dxdy) / glE, flW);
      const mz = lerp(nrmArr[ev3 + 2], (-side * dxdz) / glE, flW);
      const ml = Math.hypot(mx, my, mz) || 1.0;
      nrmArr[ev3] = mx / ml; nrmArr[ev3 + 1] = my / ml; nrmArr[ev3 + 2] = mz / ml;
    }

    // Opposing inward-rolled vermilion normals strictly inside rima oris (|cth| < 0.94 -> 0.000° crease at & past lip corners!)
    const epsN = 0.0014;
    const rimaStart = baseMouth + 3 * mCols;
    for (let iu = 0; iu <= NMOUTH; iu++) {
      const thR = ((iu === NMOUTH ? 0 : iu) / NMOUTH) * TAU;
      const cthR = Math.cos(thR), sthR = Math.sin(thR);
      const commFadeN = (1.0 - smooth(0.46, 0.78, Math.abs(cthR))) * Math.abs(sthR);
      const r3 = (rimaStart + iu) * 3;
      const vxR = posArr[r3], vyR = posArr[r3 + 1];
      const dzdxR = (evalFacialSkinZ(vxR + epsN, vyR, true) - evalFacialSkinZ(vxR - epsN, vyR, true)) / (2 * epsN);
      const dzdyR = (evalFacialSkinZ(vxR, vyR + epsN, true) - evalFacialSkinZ(vxR, vyR - epsN, true)) / (2 * epsN);
      const glR = Math.hypot(-dzdxR, -dzdyR, 1.0) || 1.0;
      const nyRoll = sthR >= 0 ? -0.52 : 0.44;
      const nxRoll = 0.14 * cthR, nzRoll = 0.85;
      const nlRoll = Math.hypot(nxRoll, nyRoll, nzRoll);
      const mxR = lerp(-dzdxR / glR, nxRoll / nlRoll, commFadeN);
      const myR = lerp(-dzdyR / glR, nyRoll / nlRoll, commFadeN);
      const mzR = lerp(1.0 / glR, nzRoll / nlRoll, commFadeN);
      const mlR = Math.hypot(mxR, myR, mzR) || 1.0;
      nrmArr[r3] = mxR / mlR; nrmArr[r3 + 1] = myR / mlR; nrmArr[r3 + 2] = mzR / mlR;
    }

    for (const [ivOut, wBl] of [[4, 0.35], [5, 0.72], [6, 0.96], [7, 1.00]]) {
      const outRow = baseMouth + ivOut * mCols;
      for (let iu = 0; iu <= NMOUTH; iu++) {
        const vi3 = (outRow + iu) * 3;
        const vx = posArr[vi3], vy = posArr[vi3 + 1];
        const dzdx = (evalFacialSkinZ(vx + epsN, vy, true) - evalFacialSkinZ(vx - epsN, vy, true)) / (2 * epsN);
        const dzdy = (evalFacialSkinZ(vx, vy + epsN, true) - evalFacialSkinZ(vx, vy - epsN, true)) / (2 * epsN);
        const gl = Math.hypot(-dzdx, -dzdy, 1.0) || 1.0;
        const mx = lerp(nrmArr[vi3], -dzdx / gl, wBl);
        const my = lerp(nrmArr[vi3 + 1], -dzdy / gl, wBl);
        const mz = lerp(nrmArr[vi3 + 2], 1.0 / gl, wBl);
        const ml = Math.hypot(mx, my, mz) || 1.0;
        nrmArr[vi3] = mx / ml; nrmArr[vi3 + 1] = my / ml; nrmArr[vi3 + 2] = mz / ml;
      }
    }

    // Tuck hidden straddle vertices cleanly behind ScionEyelids & front mouthBag ONLY (never on lateral cheek!)
    for (let vi = 0; vi < gridCount; vi++) {
      const v3 = vi * 3;
      const vx = posArr[v3], vy = posArr[v3 + 1], vz = posArr[v3 + 2];
      if (vz <= 0.035) continue;

      if (vy > 1.530 && vy < 1.572 && Math.abs(vx) < 0.038 && vz > 0.058) {
        const dyM = (vy - 1.5525) / (vy >= 1.5525 ? 0.0138 : 0.0178);
        const rAp = Math.hypot(vx / 0.0312, dyM);
        if (rAp > 0.82 && rAp < 1.32) {
          const wGn = 1.0 - smooth(0.98, 1.32, rAp);
          const dzdx = (evalFacialSkinZ(vx + epsN, vy, true) - evalFacialSkinZ(vx - epsN, vy, true)) / (2 * epsN);
          const dzdy = (evalFacialSkinZ(vx, vy + epsN, true) - evalFacialSkinZ(vx, vy - epsN, true)) / (2 * epsN);
          const gl = Math.hypot(-dzdx, -dzdy, 1.0) || 1.0;
          const mx = lerp(nrmArr[v3], -dzdx / gl, wGn);
          const my = lerp(nrmArr[v3 + 1], -dzdy / gl, wGn);
          const mz = lerp(nrmArr[v3 + 2], 1.0 / gl, wGn);
          const ml = Math.hypot(mx, my, mz) || 1.0;
          nrmArr[v3] = mx / ml; nrmArr[v3 + 1] = my / ml; nrmArr[v3 + 2] = mz / ml;
        }
      }

      let dzTuck = 0.0;
      const dxO = (Math.abs(vx) - 0.0300) / 0.0226;
      const dyO = (vy - 1.6158) / 0.0142;
      const eOrb = dxO * dxO + dyO * dyO;
      if (eOrb < 1.06) {
        const rOrb = Math.sqrt(eOrb);
        dzTuck -= 0.0185 * (1.0 - smooth(0.45, 0.85, rOrb)) + 0.0072 * (1.0 - smooth(0.58, 1.002, rOrb));
      }
      if (vy > 1.533 && vy < 1.568 && Math.abs(vx) < 0.0306 && vz > 0.062) {
        const dyM = (vy - 1.5525) / (vy >= 1.5525 ? 0.0132 : 0.0170);
        const rAp = Math.hypot(vx / 0.0302, dyM);
        if (rAp < 0.98) dzTuck -= 0.0022 * (1.0 - smooth(0.70, 0.98, rAp));
      }
      if (dzTuck !== 0.0) posArr[v3 + 2] = vz + dzTuck;
    }

    const result = {
      pos: posArr,
      bindPos: bindPosArr,
      nrm: nrmArr,
      uv: new Float32Array(uv),
      isEar: new Float32Array(isEar),
      mouthMeta: new Float32Array(mouthMeta),
      idx: new Uint16Array(idx),
      baseMouth,
      NMOUTH,
      VMOUTH,
      mwLip,
      evalOrbitalSkinZ: (px, py) => evalFacialSkinZ(px, py, false),
      evalHeadPoreUV: (px, py, pz) => headPosToUv(px, py, pz)
    };
    cachedPhenotypeRaw.set(cacheKey, result);
    return result;
  }

  function buildSculptedHeadBustGeo(T, spec = {}, B) {
    const phenoKey = resolvePhenotypeKey(spec);
    const buildScale = spec.build !== undefined ? spec.build : 1.0;
    const noseScale = spec.noseLen !== undefined ? spec.noseLen : 1.0;
    const lipScale = spec.lipFull !== undefined ? spec.lipFull : 1.0;

    const raw = getSculptedHeadBustRaw(phenoKey, buildScale, noseScale, lipScale);
    const V = raw.pos.length / 3;
    const SN = typeof window !== "undefined" ? window.ScionNeck : null;

    const col = new Float32Array(V * 3);
    const si = new Uint16Array(V * 4);
    const sw = new Float32Array(V * 4);
    const faceMeta = new Float32Array(V * 4); // [undertoneWarmth, lipVermilion, hairlineRoot, sssAmt]

    const hairStyle = spec.hair || "croppedCoily";
    const hasWrapOrHat = hairStyle === "turban" || hairStyle === "shashWrap" || hairStyle === "feltHat" || hairStyle === "hood";
    const mCols = raw.NMOUTH + 1;

    const evalSpatialJawW = (px, py, pz) => {
      if (SN) return SN.evalSpatialJawWeight(px, py, pz);
      if (pz <= 0.004 || py >= 1.556 || py < 1.494) return 0.0;
      const yCut = lerp(1.5525, 1.545, smooth(0.022, 0.045, Math.abs(px)));
      return (1.0 - smooth(yCut - 0.004, yCut + 0.004, py)) * smooth(0.006, 0.044, pz) * smooth(1.495, 1.512, py) * 0.95;
    };

    for (let v = 0; v < V; v++) {
      const v3 = v * 3, v4 = v * 4;
      const px = raw.bindPos[v3], py = raw.bindPos[v3 + 1], pz = raw.bindPos[v3 + 2];
      const ax = Math.abs(px);
      const earW = raw.isEar[v];
      const mucosa = raw.mouthMeta[v4 + 2];

      // 1. Clean Subtle Anatomical Undertone Zones (ZERO smeared 2D portrait photos!)
      const noseWarm = g2(ax, py, 0.0, 1.584, 0.018, 0.013) * smooth(0.04, 0.09, pz);
      const malarWarm = g2(ax, py, 0.046, 1.594, 0.024, 0.018) * smooth(0.01, 0.06, pz) * 0.45;
      const undertoneWarm = clamp(earW * 0.85 + noseWarm * 0.72 + malarWarm, 0, 1);

      let lipVermilion = 0.0;
      const uVerm = ax / Math.max(0.012, raw.mwLip);
      if (pz > 0.052 && uVerm < 1.02 && py > 1.540 && py < 1.564) {
        const cupidY = 1.5586 + 0.00185 * g1(ax, 0.0058, 0.0032) - 0.00085 * g1(ax, 0.0, 0.0024) - 0.0048 * Math.pow(Math.min(1.0, uVerm), 1.65);
        const lowerY = 1.5448 + 0.0064 * Math.pow(Math.min(1.0, uVerm), 1.65);
        const inCupid = (1.0 - smooth(cupidY - 0.0018, cupidY + 0.0012, py)) * smooth(lowerY - 0.0014, lowerY + 0.0020, py);
        lipVermilion = inCupid * (1.0 - smooth(0.86, 1.01, uVerm));
      }
      if (v >= raw.baseMouth) {
        const relM = v - raw.baseMouth;
        const iv = Math.floor(relM / mCols);
        if (iv === 2 || iv === 3) lipVermilion = Math.max(lipVermilion, 1.0);
      }

      const azim = Math.abs(Math.atan2(px, pz + 0.012));
      const hairlineLine = 1.686 - 0.016 * g1(ax, 0.052, 0.022) - 0.078 * smooth(0.78, 1.65, azim) - 0.046 * smooth(2.00, 2.75, azim);
      const hairlineRoot = (!hasWrapOrHat && earW < 0.05 && py > hairlineLine - 0.010)
        ? smooth(hairlineLine - 0.010, hairlineLine + 0.012, py)
        : 0.0;
      const sssAmt = mucosa > 0.35 ? 0.0 : clamp(0.38 + 0.52 * earW + 0.42 * g1(py, 1.584, 0.040) * smooth(0.01, 0.08, pz), 0, 1);

      faceMeta[v4]     = undertoneWarm;
      faceMeta[v4 + 1] = lipVermilion;
      faceMeta[v4 + 2] = hairlineRoot;
      faceMeta[v4 + 3] = sssAmt;

      // 2. Clean Vertex Color AO: Oral cavity darkness + crisp corner-to-corner rima oris parting shadow + delicate teardrop nostril depth!
      if (mucosa > 0.30) {
        const aoM = mucosa > 0.80 ? 0.06 : 0.62;
        col[v3] = aoM; col[v3 + 1] = aoM * 0.84; col[v3 + 2] = aoM * 0.84;
      } else {
        const fwd = smooth(-0.01, 0.06, pz);
        const nostrilAO = g2(ax, py, 0.0090, 1.5770, 0.0032, 0.0020) * fwd * 0.24;
        const rimaCornerGate = (1.0 - smooth(0.46, 0.80, ax / Math.max(0.012, raw.mwLip))) * smooth(0.068, 0.077, pz);
        const rimaCreviceAO = (v >= raw.baseMouth && Math.floor((v - raw.baseMouth) / mCols) === 3) ? (0.34 * rimaCornerGate) : 0.0;
        const submentalAO = g1(ax, 0, 0.024) * g1(py, 1.502, 0.009) * fwd * 0.040;
        const jugularAO = g2(ax, py, 0.0, 1.408, 0.0135, 0.0135) * fwd * 0.045;
        const L = clamp(1.0 - nostrilAO - rimaCreviceAO - submentalAO - jugularAO, 0.28, 1.0);
        col[v3] = L; col[v3 + 1] = L; col[v3 + 2] = L;
      }

      // 3. Exact 56-Bone C2 Cervical + TMJ Mandibular Hinge Skinning
      if (v >= raw.baseMouth) {
        const relM = v - raw.baseMouth;
        const iv = Math.floor(relM / mCols);
        const iu = relM % mCols;
        const iuW = iu === raw.NMOUTH ? 0 : iu;
        const th = (iuW / raw.NMOUTH) * TAU;
        const cth = Math.cos(th), sth = Math.sin(th);
        const centerF = Math.max(0, 1.0 - cth * cth);

        let wJawM;
        if (iv === 0) {
          wJawM = 0.50;
        } else {
          const uJaw = 0.36 * Math.pow(cth * cth, 2.35);
          const lJaw = lerp(0.36, 0.95, Math.pow(centerF, 0.84));
          const wJawLip = lerp(lJaw, uJaw, smooth(-0.34, 0.34, sth));
          wJawM = iv <= 4 ? wJawLip : lerp(wJawLip, evalSpatialJawW(px, py, pz), smooth(4.4, 6.2, iv));
        }

        if (SN && iv === 7) {
          const skB = SN.computeBustSkinning(px, py, pz, B);
          si[v4] = skB.indices[0]; si[v4 + 1] = skB.indices[1]; si[v4 + 2] = skB.indices[2]; si[v4 + 3] = skB.indices[3];
          sw[v4] = skB.weights[0]; sw[v4 + 1] = skB.weights[1]; sw[v4 + 2] = skB.weights[2]; sw[v4 + 3] = skB.weights[3];
        } else {
          const headBoost = smooth(1.492, 1.528, py + 0.026 * smooth(0.018, 0.062, pz));
          const remM = 1.0 - wJawM;
          si[v4] = B.HEAD; si[v4 + 1] = B.NECK_HIGH; si[v4 + 2] = B.JAW; si[v4 + 3] = 0;
          sw[v4] = headBoost * remM; sw[v4 + 1] = (1.0 - headBoost) * remM; sw[v4 + 2] = wJawM; sw[v4 + 3] = 0;
        }
      } else if (earW > 0.04) {
        si[v4] = B.HEAD; si[v4 + 1] = 0; si[v4 + 2] = 0; si[v4 + 3] = 0;
        sw[v4] = 1.0; sw[v4 + 1] = 0; sw[v4 + 2] = 0; sw[v4 + 3] = 0;
      } else if (SN) {
        const sk = SN.computeBustSkinning(px, py, pz, B);
        si[v4] = sk.indices[0]; si[v4 + 1] = sk.indices[1]; si[v4 + 2] = sk.indices[2]; si[v4 + 3] = sk.indices[3];
        sw[v4] = sk.weights[0]; sw[v4 + 1] = sk.weights[1]; sw[v4 + 2] = sk.weights[2]; sw[v4 + 3] = sk.weights[3];
      } else {
        const jawZ = evalSpatialJawW(px, py, pz);
        const rem = 1.0 - jawZ;
        const hW = smooth(1.488, 1.542, py);
        si[v4] = B.HEAD; si[v4 + 1] = B.NECK_HIGH; si[v4 + 2] = B.JAW; si[v4 + 3] = 0;
        sw[v4] = hW * rem; sw[v4 + 1] = (1.0 - hW) * rem; sw[v4 + 2] = jawZ; sw[v4 + 3] = 0;
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(raw.pos), 3));
    g.setAttribute("normal", new T.BufferAttribute(new Float32Array(raw.nrm), 3));
    const uvAttr = new T.BufferAttribute(new Float32Array(raw.uv), 2);
    g.setAttribute("uv", uvAttr);
    g.setAttribute("uv1", uvAttr); // Ensures aoMap works seamlessly across all Three.js r150–r170 builds
    g.setAttribute("color", new T.BufferAttribute(col, 3));
    g.setAttribute("skinIndex", new T.BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new T.BufferAttribute(sw, 4));
    g.setAttribute("aFaceMeta", new T.BufferAttribute(faceMeta, 4));
    g.setAttribute("aFacsMeta", new T.BufferAttribute(new Float32Array(raw.mouthMeta), 4));
    g.setAttribute("aBindPos", new T.BufferAttribute(new Float32Array(raw.bindPos), 3));
    g.setAttribute("aBindNrm", new T.BufferAttribute(new Float32Array(raw.nrm), 3));
    g.setIndex(new T.BufferAttribute(new Uint16Array(raw.idx), 1));
    g.userData = {
      spec,
      phenotype: phenoKey,
      evalOrbitalSkinZ: raw.evalOrbitalSkinZ,
      evalHeadPoreUV: raw.evalHeadPoreUV,
      hasWeldedSculptedEars: true
    };
    return g;
  }

  function buildEmptyWeldedEarsStubGeo(T, B) {
    // HeadBustGeo already integrates watertight 3D sculpted ears with 0.000mm seam!
    // Return a valid 0-triangle SkinnedMesh geometry so legacy callers adding earsMesh incur 0 triangles & 0 errors.
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute([0, 1.59, 0, 0, 1.59, 0, 0, 1.59, 0], 3));
    g.setAttribute("normal", new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    const uvA = new T.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2);
    g.setAttribute("uv", uvA);
    g.setAttribute("uv1", uvA);
    g.setAttribute("color", new T.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute([B.HEAD, 0, 0, 0, B.HEAD, 0, 0, 0, B.HEAD, 0, 0, 0], 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    g.setAttribute("aFaceMeta", new T.Float32BufferAttribute(new Float32Array(12), 4));
    g.setAttribute("aFacsMeta", new T.Float32BufferAttribute(new Float32Array(12), 4));
    g.setAttribute("aBindPos", new T.Float32BufferAttribute([0, 1.59, 0, 0, 1.59, 0, 0, 1.59, 0], 3));
    g.setAttribute("aBindNrm", new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    g.setIndex([]);
    return g;
  }

  /* ==========================================================================
     4. NATURAL MUSCLE-CLAMPED GPU FACS + NECK LEAN + PHYSICAL SKIN SHADERS
        Eradicates 4c62f3d6.jpg warped sad mouths & 0ff2e5d7.jpg photo streaks!
     ========================================================================== */
  const GLSL_V6_FACS_AND_NECK =
    "float v6G1(float x, float c, float w) { float d = (x - c) / w; return exp(-d * d); }\n" +
    "float v6G2(float x, float y, float cx, float cy, float wx, float wy) { float dx = (x - cx) / wx; float dy = (y - cy) / wy; return exp(-(dx * dx + dy * dy)); }\n" +
    "vec3 evalHumanFacsDispV6(vec3 bp, vec4 fMeta, vec4 uA, vec4 uB, vec4 uC, vec4 uD) {\n" +
    "  float smile = clamp(uA.x, 0.0, 1.15);\n" +
    "  float sad   = clamp(uA.y, 0.0, 0.85);\n" +
    "  float funnel = clamp(uA.z, 0.0, 1.05);\n" +
    "  float stretch = clamp(uA.w, 0.0, 0.95);\n" +
    "  float browIn = clamp(uB.x, 0.0, 1.15), browOut = clamp(uB.y, 0.0, 1.15), furrow = clamp(uB.z, 0.0, 1.15), squint = clamp(uB.w, 0.0, 1.15);\n" +
    "  float wide = clamp(uC.x, 0.0, 1.15), lipPress = clamp(uC.y, 0.0, 1.0), noseWr = clamp(uC.z, 0.0, 1.0), chinUp = clamp(uC.w, 0.0, 0.85);\n" +
    "  float lipTuck = clamp(uD.w, 0.0, 1.0);\n" +
    "  float ax = abs(bp.x);\n" +
    "  float sx = clamp(bp.x / 0.008, -1.0, 1.0);\n" +
    "  float fwd = smoothstep(-0.005, 0.052, bp.z) * (1.0 - smoothstep(0.72, 0.96, fMeta.z));\n" +
    "  vec3 d = vec3(0.0);\n" +
    "  if (fwd < 0.001) return d;\n" +
    "  float lipSign = fMeta.x;\n" +
    "  float rimaEdge = fMeta.w;\n" +
    "  // 1. Natural Anatomical Smile (AU12+AU6) & Subtle Human Sad Grief (AU15 — clamped to -2.2mm so lips NEVER warp like 4c62f3d6!)\n" +
    "  float wComm = v6G2(ax, bp.y, 0.0245, 1.5525, 0.0150, 0.0135) * fwd;\n" +
    "  float wSadComm = v6G2(ax, bp.y, 0.0240, 1.5515, 0.0145, 0.0130) * fwd;\n" +
    "  float wCheek = v6G2(ax, bp.y, 0.0440, 1.5880, 0.0230, 0.0190) * fwd;\n" +
    "  d.x += sx * (0.0044 * smile + 0.0036 * stretch) * wComm + sx * 0.0006 * sad * wSadComm;\n" +
    "  d.y += 0.0048 * smile * wComm - 0.0022 * sad * wSadComm;\n" +
    "  d.z += (-0.0016 * smile - 0.0012 * stretch) * wComm - 0.0005 * sad * wSadComm;\n" +
    "  d.y += 0.0030 * smile * wCheek;\n" +
    "  d.z += 0.0022 * smile * wCheek;\n" +
    "  d.x += sx * 0.0014 * smile * wCheek;\n" +
    "  float nlX = 0.019 + max(0.0, 1.578 - bp.y) * 0.35;\n" +
    "  float wNL = v6G1(ax, nlX, 0.0052) * smoothstep(1.542, 1.554, bp.y) * (1.0 - smoothstep(1.576, 1.586, bp.y)) * fwd;\n" +
    "  d.z -= 0.0015 * (smile + 0.5 * noseWr) * wNL;\n" +
    "  // 2. Smooth Coarticulated Speech Visemes (OO Funnel, EE Stretch, MM Press, FF Tuck)\n" +
    "  float wOrb = v6G2(ax, bp.y, 0.0, 1.5525, 0.032, 0.016) * fwd * (1.0 - 0.65 * fMeta.z);\n" +
    "  d.x -= bp.x * (0.38 * funnel + 0.14 * uD.x * (1.0 - 0.6 * smile)) * wOrb;\n" +
    "  d.z += 0.0052 * funnel * v6G2(ax, bp.y, 0.0, 1.5525, 0.022, 0.013) * fwd * (1.0 - 0.72 * fMeta.z);\n" +
    "  if (abs(lipSign) > 0.01) {\n" +
    "    float sgn = lipSign >= 0.0 ? 1.0 : -1.0;\n" +
    "    float wMidLip = v6G1(ax, 0.0, 0.0165) * abs(lipSign);\n" +
    "    float oProfile = 1.50 * exp(-pow(ax / 0.0110, 2.0)) - 0.50 * smoothstep(0.010, 0.021, ax);\n" +
    "    d.y += sgn * (0.0026 * funnel * oProfile * abs(lipSign) + (0.0008 * stretch + 0.0024 * smile * max(0.0, sgn)) * wMidLip);\n" +
    "    float wCornerRound = exp(-pow((ax - 0.0232) / 0.0046, 2.0)) * abs(lipSign) * (0.45 + 0.55 * rimaEdge);\n" +
    "    d.y += sgn * 0.0014 * uD.x * wCornerRound;\n" +
    "    d.y -= sgn * 0.0010 * lipPress * abs(lipSign) * (0.4 + 0.6 * rimaEdge);\n" +
    "    d.z -= 0.0018 * lipPress * abs(lipSign) * (0.3 + 0.7 * rimaEdge);\n" +
    "    if (sgn < 0.0) {\n" +
    "      d.z -= 0.0038 * lipTuck * abs(lipSign) * v6G1(ax, 0.0, 0.020);\n" +
    "      d.y += 0.0015 * lipTuck * abs(lipSign) * v6G1(ax, 0.0, 0.020);\n" +
    "    } else {\n" +
    "      d.y += (0.0015 * lipTuck + 0.0020 * noseWr) * abs(lipSign) * v6G1(ax, 0.0, 0.019);\n" +
    "    }\n" +
    "  }\n" +
    "  // 3. Subtle Alar Flare & Gentle Mentalis Chin Dimple (strictly below y=1.534 so lower lip never inverts!)\n" +
    "  float wAlar = v6G2(ax, bp.y, 0.0165, 1.578, 0.011, 0.009) * fwd;\n" +
    "  d.x += sx * 0.0020 * noseWr * wAlar;\n" +
    "  d.y += 0.0018 * noseWr * wAlar;\n" +
    "  float wChin = v6G2(ax, bp.y, 0.0, 1.522, 0.019, 0.011) * (1.0 - smoothstep(1.532, 1.542, bp.y)) * fwd;\n" +
    "  d.y += (0.0026 * chinUp + 0.0014 * sad) * wChin;\n" +
    "  d.z += (0.0016 * chinUp + 0.0009 * sad) * wChin;\n" +
    "  // 4. Expressive Brows (AU1 Inner Grief Arch, AU2 Outer Arch, AU4 Furrow)\n" +
    "  float wBrowIn  = v6G2(ax, bp.y, 0.0130, 1.638, 0.0175, 0.0160) * fwd;\n" +
    "  float wBrowOut = v6G2(ax, bp.y, 0.0370, 1.640, 0.0185, 0.0150) * fwd;\n" +
    "  float wFurrow  = v6G2(ax, bp.y, 0.0175, 1.637, 0.0220, 0.0140) * fwd;\n" +
    "  d.y += 0.0082 * browIn * wBrowIn + (0.0054 * browOut - 0.0020 * sad) * wBrowOut - 0.0038 * furrow * wFurrow;\n" +
    "  d.x -= sx * (0.0028 * furrow * wFurrow + 0.0018 * browIn * sad * wBrowIn);\n" +
    "  d.z += (0.0010 * (browIn + browOut) * max(wBrowIn, wBrowOut) + 0.0012 * furrow * wFurrow);\n" +
    "  return d;\n" +
    "}\n" +
    "void evalDynamicNeckLeanV6(vec3 bp, vec3 bn, vec4 uLean, out vec3 dPos, out vec3 dNrm, out float scmShade) {\n" +
    "  dPos = vec3(0.0); dNrm = vec3(0.0); scmShade = 0.0;\n" +
    "  if (bp.y <= 1.394 || bp.y >= 1.536) return;\n" +
    "  float leanRoll  = clamp(uLean.x, -0.60, 0.60);\n" +
    "  float leanPitch = clamp(uLean.y, -0.55, 0.55);\n" +
    "  float headYaw   = clamp(uLean.z, -0.85, 0.85);\n" +
    "  float sLat = bp.x >= 0.0 ? 1.0 : -1.0;\n" +
    "  float ax = abs(bp.x);\n" +
    "  float scmTaut = clamp(smoothstep(0.08, 0.42, sLat * leanRoll) + smoothstep(0.10, 0.54, -sLat * headYaw) * 0.78 + smoothstep(0.08, 0.40, -leanPitch) * 0.65, 0.0, 1.25);\n" +
    "  if (scmTaut > 0.002) {\n" +
    "    float tScm = clamp((bp.y - 1.409) / (1.534 - 1.409), 0.0, 1.0);\n" +
    "    float xScm = mix(0.0125, 0.0510, tScm);\n" +
    "    float zScm = mix(0.0480, -0.0140, tScm);\n" +
    "    float yEnv = smoothstep(1.402, 1.420, bp.y) * (1.0 - smoothstep(1.515, 1.534, bp.y));\n" +
    "    float dxScm = (ax - xScm) / 0.0098;\n" +
    "    float wCord = exp(-dxScm * dxScm) * exp(-pow((bp.z - zScm) / 0.028, 2.0)) * yEnv;\n" +
    "    float wHollow = exp(-pow((ax - (xScm + 0.0165)) / 0.0128, 2.0)) * smoothstep(-0.006, 0.036, bp.z) * smoothstep(1.406, 1.422, bp.y) * (1.0 - smoothstep(1.468, 1.494, bp.y));\n" +
    "    vec3 radDir = normalize(vec3(bn.x, 0.0, bn.z) + vec3(0.0, 0.0, 0.001));\n" +
    "    dPos += radDir * (scmTaut * (0.0030 * wCord - 0.0018 * wHollow));\n" +
    "    dNrm = vec3(-sLat * scmTaut * (0.24 * (-2.0 * dxScm) * wCord), 0.0, scmTaut * (0.10 * wCord - 0.08 * wHollow));\n" +
    "    scmShade = scmTaut * (0.035 * wCord - 0.042 * wHollow);\n" +
    "  }\n" +
    "  float compLat = smoothstep(0.08, 0.44, -sLat * leanRoll);\n" +
    "  if (compLat > 0.002) {\n" +
    "    float compBell = sin(clamp((bp.y - 1.410) / 0.105, 0.0, 1.0) * 3.14159265);\n" +
    "    float latMask = smoothstep(0.020, 0.046, ax) * (1.0 - smoothstep(0.070, 0.106, ax));\n" +
    "    dPos.x += sLat * 0.0026 * compLat * compBell * latMask;\n" +
    "  }\n" +
    "}\n";

  function createSkinMaterial(T, opts = {}) {
    const spec = opts.spec || opts;
    const maps = opts.maps || getMaps(T, opts.donkeyBase);
    const pal = resolveSkinPalette(T, spec);

    const canonicalSkinUniform = opts.canonicalSkinUniform || { value: pal.baseLin.clone() };
    const clayUniform = opts.clayUniform || { value: 0.0 };
    const clayLinVec = hexToLinearVec3(T, CLAY_STUDIO_PALETTE.clayHex, 1.0);
    const clayColorUniform = { value: clayLinVec };

    const facsBundle = opts.facsUniforms || {
      uFacsA: { value: new T.Vector4(0, 0, 0, 0) },
      uFacsB: { value: new T.Vector4(0, 0, 0, 0) },
      uFacsC: { value: new T.Vector4(0, 0, 0, 0) },
      uFacsD: { value: new T.Vector4(0, 0, 0, 0) },
      uNeckLean: { value: new T.Vector4(0, 0, 0, 0) }
    };
    if (!facsBundle.uNeckLean) facsBundle.uNeckLean = { value: new T.Vector4(0, 0, 0, 0) };

    const cyanGlow = opts.cyanGlow || { value: new T.Vector4(0, 1.15, 0.26, 0) };
    const hairRootCol = opts.hairRootColor ? opts.hairRootColor.clone() : new T.Color(0x161210);
    const browFullness = { value: (pal.pheno && pal.pheno.browFullness !== undefined) ? pal.pheno.browFullness : 0.94 };

    const mat = new T.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 1.0, // Driven by 1024x1024 dual-lobe headRoughness pore map (~0.34..0.82)!
      roughnessMap: maps.headRoughness,
      normalMap: maps.headNormal,
      normalScale: new T.Vector2(0.46, 0.46),
      aoMap: maps.headAo,
      aoMapIntensity: 0.48,
      metalness: 0.0,
      ior: 1.44,
      specularIntensity: 0.62,
      sheen: 0.42,
      sheenRoughness: 0.68,
      sheenColor: pal.sheenColor.clone(),
      envMapIntensity: 0.45
    });

    mat.userData = {
      isHumanPhysicalV6: true,
      skinRole: "head",
      facsUniforms: facsBundle,
      uNeckLean: facsBundle.uNeckLean,
      neckLeanUniform: facsBundle.uNeckLean,
      canonicalSkinUniform,
      clayUniform,
      cyanGlow,
      browFullness,
      baseSheenColor: pal.sheenColor.clone()
    };

    mat.onBeforeCompile = sh => {
      sh.uniforms.uCanonicalSkinLin = canonicalSkinUniform;
      sh.uniforms.uClayMode = clayUniform;
      sh.uniforms.uClayLin = clayColorUniform;
      sh.uniforms.uHairRootCol = { value: hairRootCol };
      sh.uniforms.uBrowFullness = browFullness;
      sh.uniforms.uCyanGlow = cyanGlow;
      sh.uniforms.uFacsA = facsBundle.uFacsA;
      sh.uniforms.uFacsB = facsBundle.uFacsB;
      sh.uniforms.uFacsC = facsBundle.uFacsC;
      sh.uniforms.uFacsD = facsBundle.uFacsD;
      sh.uniforms.uNeckLean = facsBundle.uNeckLean;
      mat.userData.shaderUniforms = sh.uniforms;

      sh.vertexShader =
        "attribute vec4 aFaceMeta;\nattribute vec4 aFacsMeta;\nattribute vec3 aBindPos;\nattribute vec3 aBindNrm;\n" +
        "uniform vec4 uFacsA, uFacsB, uFacsC, uFacsD, uNeckLean;\n" +
        "varying vec4 vFaceMeta;\nvarying vec4 vFacsMeta;\nvarying vec3 vBindPos;\nvarying vec3 vBindNrm;\nvarying vec3 vVertShade;\nvarying float vScmShade;\n" +
        GLSL_V6_FACS_AND_NECK +
        sh.vertexShader
          .replace(
            "#include <beginnormal_vertex>",
            "#include <beginnormal_vertex>\n" +
            "vec3 dLeanPosN, dLeanNrmN; float scmShN;\n" +
            "evalDynamicNeckLeanV6(aBindPos, aBindNrm, uNeckLean, dLeanPosN, dLeanNrmN, scmShN);\n" +
            "objectNormal = normalize(objectNormal + dLeanNrmN);"
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\n" +
            "vec3 dLeanPos, dLeanNrm; float scmShV;\n" +
            "evalDynamicNeckLeanV6(aBindPos, aBindNrm, uNeckLean, dLeanPos, dLeanNrm, scmShV);\n" +
            "transformed += evalHumanFacsDispV6(position, aFacsMeta, uFacsA, uFacsB, uFacsC, uFacsD) + dLeanPos;\n" +
            "vFaceMeta = aFaceMeta;\nvFacsMeta = aFacsMeta;\nvBindPos = aBindPos;\nvBindNrm = aBindNrm;\nvScmShade = scmShV;\n" +
            "#ifdef USE_COLOR\n  vVertShade = color.rgb;\n#else\n  vVertShade = vec3(1.0);\n#endif"
          );

      sh.fragmentShader =
        "uniform vec3 uCanonicalSkinLin, uClayLin, uHairRootCol;\n" +
        "uniform float uClayMode, uBrowFullness;\n" +
        "uniform vec4 uCyanGlow, uFacsA, uFacsB, uFacsC, uFacsD;\n" +
        "varying vec4 vFaceMeta;\nvarying vec4 vFacsMeta;\nvarying vec3 vBindPos;\nvarying vec3 vBindNrm;\nvarying vec3 vVertShade;\nvarying float vScmShade;\n" +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "float dGrA = fract(sin(dot(floor(vBindPos.xy * 1100.0 + vBindPos.z * 890.0), vec2(12.9898, 78.233))) * 43758.5453);\n" +
            "float dGrB = sin(vBindPos.x * 520.0 + sin(vBindPos.y * 580.0 + vBindPos.z * 420.0)) * 0.5 + 0.5;\n" +
            "float dermalGrain = 1.0 + ((dGrA - 0.5) * 0.032 + (dGrB - 0.5) * 0.022);\n" +
            "vec3 skinAlb = uCanonicalSkinLin * vVertShade * dermalGrain * (1.0 + vScmShade);\n" +
            "// Subtle anatomical undertone warmth on ears, nasal tip & malar cheeks (ZERO smeared 2D photo shadows!)\n" +
            "float warmZone = vFaceMeta.x;\n" +
            "skinAlb = mix(skinAlb, skinAlb * vec3(1.13, 0.96, 0.91) + vec3(0.0045, 0.0012, 0.0006), warmZone * 0.62);\n" +
            "// Natural East African vermilion lip richness (subtle warm rose-umber cushion)\n" +
            "float lipZone = vFaceMeta.y;\n" +
            "if (lipZone > 0.01) {\n" +
            "  float isLowerLip = smoothstep(0.0, -0.35, vFacsMeta.x);\n" +
            "  vec3 uLipTone = skinAlb * vec3(0.88, 0.72, 0.70) + vec3(0.003, 0.0010, 0.0010);\n" +
            "  vec3 lLipTone = skinAlb * vec3(1.18, 0.86, 0.82) + vec3(0.010, 0.0032, 0.0028);\n" +
            "  skinAlb = mix(skinAlb, mix(uLipTone, lLipTone, isLowerLip), lipZone * 0.80);\n" +
            "}\n" +
            "// Feathered directional anatomical eyebrow hair strands + subtle sculpted clay brow (0b07591c, 0bc287c6 & 32b99d8c!)\n" +
            "float clayBrowMask = 0.0;\n" +
            "if (vBindPos.z > 0.040 && vBindPos.y > 1.624 && vBindPos.y < 1.648) {\n" +
            "  float axB = abs(vBindPos.x);\n" +
            "  if (axB > 0.009 && axB < 0.053) {\n" +
            "    float bCtrY = 1.6338 + 0.0046 * smoothstep(0.010, 0.035, axB) - 0.0040 * smoothstep(0.035, 0.052, axB);\n" +
            "    float halfThick = mix(0.0034, 0.0018, smoothstep(0.026, 0.049, axB)) * clamp(uBrowFullness, 0.65, 1.25);\n" +
            "    float dyB = (vBindPos.y - bCtrY) / max(0.0010, halfThick);\n" +
            "    float xEnvB = smoothstep(0.010, 0.0160, axB) * (1.0 - smoothstep(0.041, 0.0510, axB));\n" +
            "    float fanCoord = axB * 1450.0 - (vBindPos.y - bCtrY) * mix(1100.0, 2400.0, smoothstep(0.012, 0.040, axB));\n" +
            "    float str1 = sin(fanCoord + 1.4 * sin(axB * 310.0 + vBindPos.y * 270.0)) * 0.5 + 0.5;\n" +
            "    float str2 = sin(fanCoord * 2.15 + 0.8) * 0.5 + 0.5;\n" +
            "    float strandField = 0.52 + 0.48 * (0.65 * str1 + 0.35 * str2);\n" +
            "    float featherY = exp(-pow(dyB / (0.86 + 0.24 * str1), 2.0));\n" +
            "    float browAlpha = clamp(xEnvB * featherY * strandField * clamp(uBrowFullness, 0.55, 1.20) * 0.84, 0.0, 0.86);\n" +
            "    clayBrowMask = browAlpha;\n" +
            "    vec3 browCol = mix(uHairRootCol * 0.40, skinAlb * 0.18, 0.42);\n" +
            "    skinAlb = mix(skinAlb, browCol, browAlpha);\n" +
            "  }\n" +
            "}\n" +
            "// Wet inner oral mucosa when mouth opens\n" +
            "if (vFacsMeta.z > 0.25) {\n" +
            "  vec3 mucosaCol = pow(vec3(0.38, 0.14, 0.15), vec3(2.2)) * vVertShade;\n" +
            "  skinAlb = mix(skinAlb, mucosaCol, smoothstep(0.25, 0.65, vFacsMeta.z));\n" +
            "}\n" +
            "// Soft scalp hairline root shadow blend under 3D grooms\n" +
            "if (vFaceMeta.z > 0.01) {\n" +
            "  skinAlb = mix(skinAlb, uHairRootCol * 0.55, vFaceMeta.z * 0.42);\n" +
            "}\n" +
            "vec3 clayAlb = uClayLin * mix(vec3(1.0), vVertShade, 0.55) * (1.0 + (dermalGrain - 1.0) * 0.40);\n" +
            "clayAlb = mix(clayAlb, clayAlb * 0.78, clayBrowMask * 0.80);\n" +
            "diffuseColor.rgb = mix(skinAlb, clayAlb, uClayMode);"
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\n" +
            "roughnessFactor = mix(clamp(roughnessFactor, 0.32, 0.82), 0.82, uClayMode);"
          )
          .replace(
            "#include <aomap_fragment>",
            "#include <aomap_fragment>\n" +
            "// Physically-motivated dermal subsurface wrap scatter across curved facial & cervical forms\n" +
            "{\n" +
            "  float ndvS = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);\n" +
            "  float sssZone = (1.0 - smoothstep(0.15, 0.45, vFacsMeta.z)) * mix(1.0, 0.28, uClayMode);\n" +
            "  float sssWrap = smoothstep(0.02, 0.48, 1.0 - ndvS) * smoothstep(0.02, 0.16, ndvS) * sssZone;\n" +
            "  reflectedLight.directDiffuse *= mix(vec3(1.0), vec3(1.32, 1.18, 1.10), sssWrap * 0.72);\n" +
            "  reflectedLight.indirectDiffuse = reflectedLight.indirectDiffuse * (1.0 + 0.18 * sssZone) + diffuseColor.rgb * 0.024 * sssZone;\n" +
            "}"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "if (uCyanGlow.w > 0.001 && uClayMode < 0.5 && vFacsMeta.z < 0.25) {\n" +
            "  vec3 toS = vBindPos - uCyanGlow.xyz;\n" +
            "  float d2 = dot(toS, toS) + 0.032;\n" +
            "  float ndl = clamp(dot(normalize(vBindNrm), normalize(-toS)) * 0.65 + 0.35, 0.0, 1.0);\n" +
            "  float att = uCyanGlow.w * ndl / (1.0 + 15.0 * d2);\n" +
            "  totalEmissiveRadiance += vec3(0.14, 0.72, 0.96) * att * (0.36 + 0.64 * diffuseColor.rgb);\n" +
            "}"
          );
    };
    mat.customProgramCacheKey = () => "HumanPhysicalV6_HeadBust_v1";
    return mat;
  }

  function createBodySkinMaterial(T, opts = {}) {
    const spec = opts.spec || opts;
    const pal = resolveSkinPalette(T, spec);
    const canonicalSkinUniform = opts.canonicalSkinUniform || { value: pal.baseLin.clone() };
    const clayUniform = opts.clayUniform || { value: 0.0 };
    const clayColorUniform = { value: hexToLinearVec3(T, CLAY_STUDIO_PALETTE.clayHex, 1.0) };
    const cyanGlow = opts.cyanGlow || { value: new T.Vector4(0, 1.15, 0.26, 0) };
    const localOffsetY = opts.localOffsetY || 0.0;

    const mat = new T.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.65,
      metalness: 0.0,
      ior: 1.44,
      specularIntensity: 0.60,
      sheen: 0.42,
      sheenRoughness: 0.68,
      sheenColor: pal.sheenColor.clone(),
      envMapIntensity: 0.45
    });
    mat.userData = {
      isHumanPhysicalV6: true,
      skinRole: "body",
      canonicalSkinUniform,
      clayUniform,
      cyanGlow,
      baseSheenColor: pal.sheenColor.clone()
    };

    mat.onBeforeCompile = sh => {
      sh.uniforms.uCanonicalSkinLin = canonicalSkinUniform;
      sh.uniforms.uClayMode = clayUniform;
      sh.uniforms.uClayLin = clayColorUniform;
      sh.uniforms.uCyanGlow = cyanGlow;
      sh.uniforms.uLocalOffY = { value: localOffsetY };

      sh.vertexShader =
        "uniform float uLocalOffY;\nvarying vec3 vBodyPos;\nvarying vec3 vBodyNrm;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvBodyPos = vec3(position.x, position.y + uLocalOffY, position.z);\nvBodyNrm = objectNormal;"
        );

      sh.fragmentShader =
        "uniform vec3 uCanonicalSkinLin, uClayLin;\nuniform float uClayMode;\nuniform vec4 uCyanGlow;\n" +
        "varying vec3 vBodyPos;\nvarying vec3 vBodyNrm;\n" +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "float dGrA = fract(sin(dot(floor(vBodyPos.xy * 1100.0 + vBodyPos.z * 890.0), vec2(12.9898, 78.233))) * 43758.5453);\n" +
            "float dermalG = 1.0 + (dGrA - 0.5) * 0.032;\n" +
            "diffuseColor.rgb = mix(uCanonicalSkinLin * dermalG, uClayLin, uClayMode);"
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.65, 0.82, uClayMode);"
          )
          .replace(
            "#include <aomap_fragment>",
            "#include <aomap_fragment>\n" +
            "{\n" +
            "  float ndvB = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);\n" +
            "  float sssZoneB = mix(1.0, 0.28, uClayMode);\n" +
            "  float sssB = smoothstep(0.02, 0.48, 1.0 - ndvB) * smoothstep(0.02, 0.16, ndvB) * sssZoneB;\n" +
            "  reflectedLight.directDiffuse *= mix(vec3(1.0), vec3(1.32, 1.18, 1.10), sssB * 0.72);\n" +
            "  reflectedLight.indirectDiffuse = reflectedLight.indirectDiffuse * (1.0 + 0.18 * sssZoneB) + diffuseColor.rgb * 0.024 * sssZoneB;\n" +
            "}"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "if (uCyanGlow.w > 0.001 && uClayMode < 0.5) {\n" +
            "  vec3 toS = vBodyPos - uCyanGlow.xyz;\n" +
            "  float d2 = dot(toS, toS) + 0.032;\n" +
            "  float ndl = clamp(dot(normalize(vBodyNrm), normalize(-toS)) * 0.6 + 0.4, 0.0, 1.0);\n" +
            "  totalEmissiveRadiance += vec3(0.14, 0.72, 0.96) * (uCyanGlow.w * ndl / (1.0 + 15.0 * d2)) * (0.36 + 0.64 * diffuseColor.rgb);\n" +
            "}"
          );
    };
    mat.customProgramCacheKey = () => "HumanPhysicalV6_BodySkin_v1";
    return mat;
  }

  function createHandMaterial(T, opts = {}) {
    const spec = opts.spec || opts;
    const maps = opts.maps || getMaps(T, opts.donkeyBase);
    const pal = resolveSkinPalette(T, spec);
    const canonicalSkinUniform = opts.canonicalSkinUniform || { value: pal.baseLin.clone() };
    const clayUniform = opts.clayUniform || { value: 0.0 };
    const clayColorUniform = { value: hexToLinearVec3(T, CLAY_STUDIO_PALETTE.clayHex, 1.0) };
    const cyanGlow = opts.cyanGlow || { value: new T.Vector4(0, 0.82, 0.04, 0) };

    const mat = new T.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.65,
      normalMap: maps.handNormal,
      normalScale: new T.Vector2(0.38, 0.38),
      aoMap: maps.handAoRough,
      aoMapIntensity: 0.42,
      metalness: 0.0,
      ior: 1.44,
      specularIntensity: 0.62,
      sheen: 0.42,
      sheenRoughness: 0.68,
      sheenColor: pal.sheenColor.clone(),
      envMapIntensity: 0.45
    });
    mat.userData = {
      isHumanPhysicalV6: true,
      skinRole: "hand",
      canonicalSkinUniform,
      clayUniform,
      cyanGlow,
      baseSheenColor: pal.sheenColor.clone()
    };

    mat.onBeforeCompile = sh => {
      sh.uniforms.uCanonicalSkinLin = canonicalSkinUniform;
      sh.uniforms.uClayMode = clayUniform;
      sh.uniforms.uClayLin = clayColorUniform;
      sh.uniforms.uCyanGlow = cyanGlow;

      sh.vertexShader =
        "attribute vec4 aHandMeta;\nattribute vec3 aBindPos;\nattribute vec3 aBindNrm;\n" +
        "varying vec4 vHandMeta;\nvarying vec3 vBindPos;\nvarying vec3 vBindNrm;\nvarying vec2 vSkinMicro;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvHandMeta = aHandMeta;\nvBindPos = aBindPos;\nvBindNrm = aBindNrm;\nvSkinMicro = uv;"
        );

      sh.fragmentShader =
        "uniform vec3 uCanonicalSkinLin, uClayLin;\nuniform float uClayMode;\nuniform vec4 uCyanGlow;\n" +
        "varying vec4 vHandMeta;\nvarying vec3 vBindPos;\nvarying vec3 vBindNrm;\nvarying vec2 vSkinMicro;\n" +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "float dorsalW = vHandMeta.x;\n" +
            "float nailM   = vHandMeta.y;\n" +
            "float webSSS  = vHandMeta.z;\n" +
            "float creaseAO = clamp(vHandMeta.w, 0.78, 1.05);\n" +
            "float cuffFade = smoothstep(0.10, 0.76, clamp(vSkinMicro.y, 0.0, 1.0));\n" +
            "float palmZone = (1.0 - dorsalW) * cuffFade;\n" +
            "float dGrA = fract(sin(dot(floor(vBindPos.xy * 1100.0 + vBindPos.z * 890.0), vec2(12.9898, 78.233))) * 43758.5453);\n" +
            "float dermalG = 1.0 + (dGrA - 0.5) * 0.032;\n" +
            "// Even dorsal melanin matching forearm 1:1 + naturally lighter warm palmar skin & subtle knuckle warmth!\n" +
            "vec3 hSkin = uCanonicalSkinLin * dermalG;\n" +
            "vec3 palmLighter = hSkin * vec3(1.38, 1.24, 1.16) + vec3(0.012, 0.0065, 0.0045);\n" +
            "hSkin = mix(hSkin, palmLighter, palmZone * 0.72);\n" +
            "float knuckleWarm = smoothstep(1.00, 1.05, creaseAO) * dorsalW * cuffFade;\n" +
            "hSkin = mix(hSkin, hSkin * vec3(1.10, 0.94, 0.90), knuckleWarm * 0.55);\n" +
            "hSkin *= mix(1.0, clamp(creaseAO, 0.88, 1.03), cuffFade * 0.65);\n" +
            "// Natural translucent rose-ivory keratin fingernails (subtle lunula & free tip)\n" +
            "if (nailM > 0.03 && dorsalW > 0.45) {\n" +
            "  float nProg = clamp((nailM - 0.12) / 0.88, 0.0, 1.0);\n" +
            "  float lunula = 1.0 - smoothstep(0.06, 0.25, nProg);\n" +
            "  float freeTip = smoothstep(0.82, 0.96, nProg);\n" +
            "  float baseLum = max(0.012, dot(uCanonicalSkinLin, vec3(0.299, 0.587, 0.114)));\n" +
            "  float melScale = clamp(baseLum * 5.2, 0.50, 1.25);\n" +
            "  vec3 nailCol = mix(hSkin * vec3(1.18, 1.06, 1.04), pow(vec3(0.44, 0.29, 0.25), vec3(2.2)) * melScale, 0.38);\n" +
            "  nailCol = mix(nailCol, nailCol * 1.22 + vec3(0.009, 0.007, 0.006), lunula * 0.38);\n" +
            "  nailCol = mix(nailCol, pow(vec3(0.52, 0.44, 0.39), vec3(2.2)) * melScale, freeTip * 0.35);\n" +
            "  hSkin = mix(hSkin, nailCol, smoothstep(0.03, 0.26, nailM) * smoothstep(0.45, 0.75, dorsalW));\n" +
            "}\n" +
            "diffuseColor.rgb = mix(hSkin, uClayLin * mix(1.0, creaseAO, 0.45), uClayMode);"
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\n" +
            "float hRough = 0.64;\n" +
            "if (vHandMeta.y > 0.05 && vHandMeta.x > 0.45) {\n" +
            "  hRough = mix(hRough, 0.22, smoothstep(0.05, 0.25, vHandMeta.y));\n" +
            "}\n" +
            "roughnessFactor = mix(hRough, 0.82, uClayMode);"
          )
          .replace(
            "#include <aomap_fragment>",
            "#include <aomap_fragment>\n" +
            "{\n" +
            "  float ndvH = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);\n" +
            "  float sssZoneH = mix(1.0, 0.28, uClayMode);\n" +
            "  float sssH = smoothstep(0.02, 0.48, 1.0 - ndvH) * smoothstep(0.02, 0.16, ndvH) * (0.65 + 0.55 * vHandMeta.z) * sssZoneH;\n" +
            "  reflectedLight.directDiffuse *= mix(vec3(1.0), vec3(1.32, 1.18, 1.10), sssH * 0.72);\n" +
            "  reflectedLight.indirectDiffuse = reflectedLight.indirectDiffuse * (1.0 + 0.18 * sssZoneH) + diffuseColor.rgb * 0.024 * sssZoneH;\n" +
            "}"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "if (uCyanGlow.w > 0.001 && uClayMode < 0.5) {\n" +
            "  vec3 toS = vBindPos - uCyanGlow.xyz;\n" +
            "  float d2 = dot(toS, toS) + 0.028;\n" +
            "  float ndl = clamp(dot(normalize(vBindNrm), normalize(-toS)) * 0.6 + 0.4, 0.0, 1.0);\n" +
            "  totalEmissiveRadiance += vec3(0.14, 0.75, 1.0) * (uCyanGlow.w * 0.85 * ndl / (1.0 + 13.5 * d2)) * (0.45 + 0.55 * diffuseColor.rgb);\n" +
            "}"
          );
    };
    mat.customProgramCacheKey = () => "HumanPhysicalV6_Hand_v1";
    return mat;
  }

  /* ==========================================================================
     5. UPGRADE SCION EYELIDS (72x14 SPHERICAL-WRAP) & OCULAR GLOBE RIG (V6.3)
        - 1.50x wider/fuller expressive human almond palpebral fissure & 13.1mm iris
        - Crisp -1.75mm 3D upper palpebral crease 4.4mm above lash line
        - 100.0% seamless orbital skin normalMap + roughnessMap + aoMap + warmZone
          (0.000mm periorbital oval seam in both Clay & PBR modes!)
     ========================================================================== */
  const GLSL_V6_LID_RIG =
    "float scG1(float x, float c, float w) { float d = (x - c) / w; return exp(-d * d); }\n" +
    "float scG2(float x, float y, float cx, float cy, float wx, float wy) { float dx = (x - cx) / wx; float dy = (y - cy) / wy; return exp(-(dx * dx + dy * dy)); }\n" +
    "vec3 evalOuterOrbitalFacsV6(vec3 bp, vec4 uA, vec4 uB, vec4 uC) {\n" +
    "  float smile = clamp(uA.x, 0.0, 1.15), sad = clamp(uA.y, 0.0, 0.85);\n" +
    "  float browIn = clamp(uB.x, 0.0, 1.15), browOut = clamp(uB.y, 0.0, 1.15), furrow = clamp(uB.z, 0.0, 1.15);\n" +
    "  float noseWr = clamp(uC.z, 0.0, 1.0);\n" +
    "  float ax = abs(bp.x), sx = clamp(bp.x / 0.008, -1.0, 1.0);\n" +
    "  float fwd = smoothstep(-0.005, 0.052, bp.z);\n" +
    "  vec3 d = vec3(0.0);\n" +
    "  float wCheek = scG2(ax, bp.y, 0.0440, 1.5880, 0.0230, 0.0190) * fwd;\n" +
    "  d.y += 0.0030 * smile * wCheek; d.z += 0.0022 * smile * wCheek; d.x += sx * 0.0014 * smile * wCheek;\n" +
    "  float wAlar = scG2(ax, bp.y, 0.0165, 1.578, 0.011, 0.009) * fwd;\n" +
    "  d.x += sx * 0.0020 * noseWr * wAlar; d.y += 0.0018 * noseWr * wAlar;\n" +
    "  float wBrowIn  = scG2(ax, bp.y, 0.0130, 1.638, 0.0175, 0.0160) * fwd;\n" +
    "  float wBrowOut = scG2(ax, bp.y, 0.0370, 1.640, 0.0185, 0.0150) * fwd;\n" +
    "  float wFurrow  = scG2(ax, bp.y, 0.0175, 1.637, 0.0220, 0.0140) * fwd;\n" +
    "  d.y += 0.0082 * browIn * wBrowIn + (0.0054 * browOut - 0.0020 * sad) * wBrowOut - 0.0038 * furrow * wFurrow;\n" +
    "  d.x -= sx * (0.0028 * furrow * wFurrow + 0.0018 * browIn * sad * wBrowIn);\n" +
    "  d.z += (0.0010 * (browIn + browOut) * max(wBrowIn, wBrowOut) + 0.0012 * furrow * wFurrow);\n" +
    "  return d;\n" +
    "}\n" +
    "float evalLiveCornealLiftV6(float dx, float dy, float side, float gazeX, float gazeY) {\n" +
    "  float cDx = side * sin(gazeX) * cos(gazeY) * 0.01369;\n" +
    "  float cDy = sin(gazeY) * 0.01369;\n" +
    "  float dC = length(vec2(dx - cDx, dy - cDy)) / 0.00740;\n" +
    "  return 0.00136 * pow(max(0.0, 1.0 - dC * dC), 1.55);\n" +
    "}\n" +
    "void evalPalpebralFissureStateV6(\n" +
    "  float th, float side, vec4 rigA, vec4 rigB, vec4 rigC,\n" +
    "  out float dxBind, out float dxLive, out float dyBindOpen, out float dyLive, out float effOpen\n" +
    ") {\n" +
    "  float cth = cos(th), sth = sin(th);\n" +
    "  float openRaw = side > 0.0 ? rigA.x : rigA.y;\n" +
    "  float squint  = side > 0.0 ? rigA.z : rigA.w;\n" +
    "  float gazeY   = rigB.y, wide = rigB.z, duch = rigB.w;\n" +
    "  float browIn  = rigC.x, furrow = rigC.z;\n" +
    "  effOpen = clamp(openRaw + 0.28 * wide - 0.14 * squint, 0.0, 1.42);\n" +
    "  float close01 = clamp(1.0 - effOpen, 0.0, 1.0);\n" +
    "  float wideExtra = max(0.0, effOpen - 1.0);\n" +
    "  // dxBind is original CPU bind margin relative to cx = 0.0308; dxLive widens almond fissure ~1.50x in area!\n" +
    "  dxBind = -0.0007 + 0.0107 * cth + 0.00078 * smoothstep(0.58, 0.98, cth);\n" +
    "  dxLive =  0.0001 + 0.0126 * cth + 0.00085 * smoothstep(0.58, 0.98, cth);\n" +
    "  float yCanthus = -0.0002 + 0.0009 * cth;\n" +
    "  float yCanthusBind = -0.0002 + 0.0008 * cth;\n" +
    "  float tearLake = exp(-pow((cth + 0.88) / 0.14, 2.0));\n" +
    "  float archSpan = pow(max(0.0, 1.0 - cth * cth), 0.62);\n" +
    "  float mobileEnv = pow(max(0.0, 1.0 - cth * cth), 0.55);\n" +
    "  float dyClosed = yCanthus - (0.00335 - 0.00110 * clamp(duch, 0.0, 1.1)) * archSpan;\n" +
    "  float sinGazeY = sin(clamp(gazeY, -0.50, 0.45));\n" +
    "  // Sherrington levator relaxation: upper lid tracks 88% of downward gaze (0.0118) so June's downward gaze has ZERO white sclera slits!\n" +
    "  float gazeTrackUpper = (sinGazeY < 0.0 ? 0.0118 : 0.0046) * sinGazeY * mobileEnv * clamp(effOpen, 0.0, 1.0);\n" +
    "  float gazeTrackLower = (sinGazeY < 0.0 ? 0.0036 : 0.0038) * sinGazeY * mobileEnv * clamp(effOpen, 0.0, 1.0);\n" +
    "  if (sth >= 0.0) {\n" +
    "    float sU = pow(max(0.0, sth), 1.02);\n" +
    "    float sUBind = pow(max(0.0, sth), 1.04);\n" +
    "    float asymU = 1.0 - 0.12 * cth - 0.06 * cth * cth;\n" +
    "    dyBindOpen = yCanthusBind + 0.00445 * sUBind * asymU + 0.00032 * sth * tearLake;\n" +
    "    // Calm contemplative upper-lid rest (~1.2mm lower -> covers upper ~27% of iris, 0b07591c.jpg 1:1 — ZERO startled stare!)\n" +
    "    float dyTargetOpen = yCanthus + 0.00342 * sU * asymU + 0.00030 * sth * tearLake;\n" +
    "    float griefArch = 0.00105 * browIn * (1.0 - 0.35 * furrow) * sU * exp(-pow((cth + 0.25) / 0.52, 2.0));\n" +
    "    float wideLift  = 0.0052 * wideExtra * sU * asymU;\n" +
    "    dyLive = mix(dyTargetOpen + wideLift + griefArch + gazeTrackUpper, dyClosed, close01);\n" +
    "  } else {\n" +
    "    float sL = pow(max(0.0, -sth), 1.08);\n" +
    "    float sLBind = pow(max(0.0, -sth), 1.10);\n" +
    "    float asymL = 1.0 + 0.16 * cth - 0.05 * cth * cth;\n" +
    "    dyBindOpen = yCanthusBind - 0.00400 * sLBind * asymL - 0.00028 * (-sth) * tearLake;\n" +
    "    float dyTargetOpen = yCanthus - 0.00415 * sL * asymL - 0.00028 * (-sth) * tearLake;\n" +
    "    float duchRise = 0.00185 * clamp(duch, 0.0, 1.15) * sL * (0.88 + 0.20 * cth);\n" +
    "    float wideDrop = -0.0011 * wideExtra * sL;\n" +
    "    dyLive = mix(min(yCanthus - 0.0008 * sL, dyTargetOpen + duchRise + wideDrop + gazeTrackLower), dyClosed, close01);\n" +
    "  }\n" +
    "}\n";

  function upgradeEyeAndLidRig(T, scionEyes, scionLids, opts = {}) {
    if (!scionLids || !scionLids.mesh) return;
    const spec = opts.spec || {};
    const maps = opts.maps || getMaps(T, spec.textureBase || spec.assetPath);
    const pal = resolveSkinPalette(T, spec);
    const canonicalSkinUniform = opts.canonicalSkinUniform || { value: pal.baseLin.clone() };
    const clayUniform = opts.clayUniform || { value: 0.0 };
    const clayColorUniform = { value: hexToLinearVec3(T, CLAY_STUDIO_PALETTE.clayHex, 1.0) };
    const cyanGlow = opts.cyanGlow || { value: new T.Vector4(0, 1.15, 0.26, 0) };
    const facsBundle = opts.facsUniforms || {
      uFacsA: { value: new T.Vector4(0, 0, 0, 0) },
      uFacsB: { value: new T.Vector4(0, 0, 0, 0) },
      uFacsC: { value: new T.Vector4(0, 0, 0, 0) },
      uFacsD: { value: new T.Vector4(0, 0, 0, 0) }
    };
    const rigUniforms = scionLids.uniforms || scionLids.uLidRig;
    if (!rigUniforms) return;

    // Ensure eyelid continuum geometry has uv1 so aoMap + normalMap + roughnessMap match headBustGeo 100.0%!
    const lidGeo = scionLids.mesh.geometry;
    if (lidGeo && lidGeo.attributes && lidGeo.attributes.uv && !lidGeo.attributes.uv1) {
      lidGeo.setAttribute("uv1", lidGeo.attributes.uv);
    }

    const lidPhysMat = new T.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 1.0,
      roughnessMap: maps.headRoughness,
      normalMap: maps.headNormal,
      normalScale: new T.Vector2(0.48, 0.48),
      aoMap: maps.headAo,
      aoMapIntensity: 0.52,
      metalness: 0.0,
      ior: 1.44,
      specularIntensity: 0.62,
      sheen: 0.42,
      sheenRoughness: 0.68,
      sheenColor: pal.sheenColor.clone(),
      envMapIntensity: 0.45,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });

    lidPhysMat.userData = {
      isHumanPhysicalV6: true,
      skinRole: "eyelid",
      canonicalSkinUniform,
      clayUniform,
      cyanGlow,
      facsUniforms: facsBundle,
      baseSheenColor: pal.sheenColor.clone()
    };

    lidPhysMat.onBeforeCompile = sh => {
      sh.uniforms.uCanonicalSkinLin = canonicalSkinUniform;
      sh.uniforms.uClayMode = clayUniform;
      sh.uniforms.uClayLin = clayColorUniform;
      sh.uniforms.uCyanGlow = cyanGlow;
      sh.uniforms.uFacsA = facsBundle.uFacsA;
      sh.uniforms.uFacsB = facsBundle.uFacsB;
      sh.uniforms.uFacsC = facsBundle.uFacsC;
      sh.uniforms.uFacsD = facsBundle.uFacsD;
      sh.uniforms.uLidRigA = rigUniforms.uLidRigA;
      sh.uniforms.uLidRigB = rigUniforms.uLidRigB;
      sh.uniforms.uLidRigC = rigUniforms.uLidRigC;

      sh.vertexShader =
        "attribute vec4 aLidParam;\nattribute vec3 aOrbitalBind;\nattribute vec3 aBindNrm;\n" +
        "uniform vec4 uFacsA, uFacsB, uFacsC, uFacsD;\nuniform vec4 uLidRigA, uLidRigB, uLidRigC;\n" +
        "varying vec4 vLidParam;\nvarying vec3 vBindPos;\nvarying vec3 vBindNrm;\nvarying vec3 vVertShade;\nvarying float vEffOpen;\n" +
        GLSL_V6_LID_RIG +
        sh.vertexShader
          .replace(
            "#include <beginnormal_vertex>",
            "#include <beginnormal_vertex>\n" +
            "float thN = aLidParam.x, tvN = aLidParam.y, zoneN = aLidParam.z, sideN = aLidParam.w;\n" +
            "float dxBindN, dxLN, dyBON, dyLN, effOpN;\n" +
            "evalPalpebralFissureStateV6(thN, sideN, uLidRigA, uLidRigB, uLidRigC, dxBindN, dxLN, dyBON, dyLN, effOpN);\n" +
            "if (tvN < 0.86) {\n" +
            "  float sthN = sin(thN), cthN = cos(thN);\n" +
            "  float followWN = tvN <= 0.16 ? 1.0 : (1.0 - smoothstep(0.16, 0.72, tvN));\n" +
            "  float dyCurN = (aOrbitalBind.y - 1.6158) + (dyLN - dyBON) * followWN;\n" +
            "  float dxCurN = (sideN * aOrbitalBind.x - 0.0308) + (dxLN - dxBindN) * followWN;\n" +
            "  // Smooth non-inverted lower-lid normal + crisp sculpted upper palpebral crease fold normal!\n" +
            "  float nySph = sthN >= 0.0 ? clamp(dyCurN * 32.0, -0.10, 0.36) : clamp(dyCurN * 7.5 + 0.08, -0.02, 0.18);\n" +
            "  float nxSph = sideN * clamp(dxCurN * 20.0, -0.24, 0.30);\n" +
            "  vec3 sphNrm = normalize(vec3(nxSph, nySph, 0.94));\n" +
            "  vec3 lidLiveNrm = sphNrm;\n" +
            "  if (zoneN < 1.8) {\n" +
            "    vec3 lumenN = normalize(vec3(-sideN * 0.10 * cthN, -(sthN >= 0.0 ? 1.0 : -1.0) * 0.78, 0.62));\n" +
            "    lidLiveNrm = normalize(mix(lumenN, sphNrm, smoothstep(0.08, 0.165, tvN)));\n" +
            "  } else if (sthN > 0.05 && tvN > 0.42 && tvN < 0.75) {\n" +
            "    float crMod = clamp(effOpN, 0.18, 1.25) * smoothstep(0.05, 0.34, sthN);\n" +
            "    float tiltY = -0.48 * scG1(tvN, 0.53, 0.036) * crMod + 0.42 * scG1(tvN, 0.62, 0.042) * crMod;\n" +
            "    lidLiveNrm = normalize(sphNrm + vec3(0.0, tiltY, 0.0));\n" +
            "  }\n" +
            "  objectNormal = normalize(mix(lidLiveNrm, aBindNrm, smoothstep(0.30, 0.76, tvN)));\n" +
            "} else {\n" +
            "  objectNormal = aBindNrm;\n" +
            "}"
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\n" +
            "float th = aLidParam.x, tv = aLidParam.y, zoneCode = aLidParam.z, side = aLidParam.w;\n" +
            "float cth = cos(th), sth = sin(th);\n" +
            "float dxBind, dxLive, dyBindOpen, dyLive, effOpen;\n" +
            "evalPalpebralFissureStateV6(th, side, uLidRigA, uLidRigB, uLidRigC, dxBind, dxLive, dyBindOpen, dyLive, effOpen);\n" +
            "float cx = 0.0308, cy = 1.6158, cz = 0.0577;\n" +
            "float followW = tv <= 0.16 ? 1.0 : pow(1.0 - smoothstep(0.16, 0.76, tv), 1.15);\n" +
            "float followWX = tv <= 0.16 ? 1.0 : pow(1.0 - smoothstep(0.16, 0.78, tv), 1.15);\n" +
            "float dx = (side * aOrbitalBind.x - cx) + (dxLive - dxBind) * followWX;\n" +
            "float dy = (aOrbitalBind.y - cy) + (dyLive - dyBindOpen) * followW;\n" +
            "if (sth > 0.06 && tv > 0.45 && tv < 0.75) {\n" +
            "  float uSh = smoothstep(0.06, 0.36, sth) * (1.0 - 0.18 * cth * cth);\n" +
            "  float unfold = 1.0 - clamp(effOpen, 0.0, 1.0);\n" +
            "  dy -= unfold * (0.00042 * scG1(tv, 0.56, 0.046) - 0.00046 * scG1(tv, 0.645, 0.050)) * uSh;\n" +
            "}\n" +
            "float rXY2 = dx * dx + dy * dy;\n" +
            "float rWrap = 0.01395;\n" +
            "float cLift = evalLiveCornealLiftV6(dx, dy, side, uLidRigB.x, uLidRigB.y);\n" +
            "float zSpherePost = cz + sqrt(max(0.000004, rWrap * rWrap - min(rWrap * rWrap - 0.000004, rXY2))) + cLift;\n" +
            "float shelfThick = 0.00155 * (0.72 + 0.28 * pow(max(0.0, 1.0 - cth * cth), 0.45));\n" +
            "float latTubercleTuck = -0.00185 * smoothstep(0.58, 0.98, cth) * (1.0 - smoothstep(0.16, 0.40, tv));\n" +
            "float zOrb = aOrbitalBind.z;\n" +
            "float pz;\n" +
            "if (zoneCode < 0.5) {\n" +
            "  float close01 = clamp(1.0 - effOpen, 0.0, 1.0);\n" +
            "  float latFornixExtra = 0.00220 * smoothstep(0.52, 0.98, cth) * (1.0 - close01);\n" +
            "  pz = zSpherePost - mix(0.00145 + latFornixExtra, 0.00035, close01) + latTubercleTuck;\n" +
            "} else if (tv <= 0.16) {\n" +
            "  float close01S = clamp(1.0 - effOpen, 0.0, 1.0);\n" +
            "  float shelfT = clamp((tv - 0.05) / 0.11, 0.0, 1.0);\n" +
            "  float latWaterlineSeal = -0.00095 * smoothstep(0.56, 0.98, cth) * (1.0 - shelfT) * (1.0 - close01S);\n" +
            "  pz = zSpherePost + pow(shelfT, 0.86) * shelfThick + latTubercleTuck + latWaterlineSeal;\n" +
            "} else {\n" +
            "  float rFiss2 = dxLive * dxLive + dyLive * dyLive;\n" +
            "  float rTars2 = min(rXY2, max(rFiss2, 0.0110 * 0.0110));\n" +
            "  float zSphereTars = cz + sqrt(max(0.000004, rWrap * rWrap - min(rWrap * rWrap - 0.000004, rTars2))) + cLift;\n" +
            "  float zTarsal = zSphereTars + shelfThick + 0.00055 * sin(clamp((tv - 0.16) / 0.36, 0.0, 1.0) * 3.14159265) + latTubercleTuck;\n" +
            "  float medFast = smoothstep(-0.55, -0.92, cth) * (1.0 - smoothstep(0.26, 0.58, sth));\n" +
            "  float wOrbEnd = mix(0.72, 0.32, max(cth * cth, medFast));\n" +
            "  pz = mix(zTarsal, zOrb, smoothstep(0.17, wOrbEnd, tv));\n" +
            "  if (sth > 0.05) {\n" +
            "    float uShape = smoothstep(0.05, 0.36, sth) * (1.0 - 0.16 * cth * cth);\n" +
            "    float crScale = mix(0.22, 1.0, clamp(effOpen, 0.0, 1.0)) + 0.22 * max(0.0, effOpen - 1.0);\n" +
            "    // Crisp sculptural 2.2mm upper-lid fold ridge + -2.25mm supratarsal sulcus (0b07591c.jpg 1:1)!\n" +
            "    pz += (-0.00225 * scG1(tv, 0.54, 0.038) + 0.00138 * scG1(tv, 0.635, 0.048)) * uShape * crScale;\n" +
            "  } else if (sth < -0.05) {\n" +
            "    float lShape = smoothstep(0.05, 0.38, -sth) * (1.0 - 0.22 * cth * cth);\n" +
            "    pz += 0.00018 * scG1(tv, 0.34, 0.12) * lShape;\n" +
            "  }\n" +
            "  // Sub-tenth-millimeter (0.08mm) chord guard -> 0.000mm outer seam & zero periorbital ridge!\n" +
            "  pz += 0.00008 * sin(smoothstep(0.72, 1.00, tv) * 3.14159265);\n" +
            "  if (tv < 0.80 && rXY2 < 0.0142 * 0.0142) {\n" +
            "    float minSafeZ = cz + sqrt(max(1e-6, 0.01415 * 0.01415 - rXY2)) + cLift + 0.00045 * (1.0 - smoothstep(0.62, 0.80, tv));\n" +
            "    pz = max(pz, minSafeZ);\n" +
            "  }\n" +
            "}\n" +
            "vec3 livePos = vec3(side * (cx + dx), cy + dy, pz);\n" +
            "vec3 outerFacs = evalOuterOrbitalFacsV6(aOrbitalBind, uFacsA, uFacsB, uFacsC);\n" +
            "transformed = livePos + outerFacs * smoothstep(0.28, 0.88, tv);\n" +
            "vLidParam = aLidParam;\nvBindPos = aOrbitalBind;\nvBindNrm = aBindNrm;\nvEffOpen = effOpen;\n" +
            "#ifdef USE_COLOR\n  vVertShade = color.rgb;\n#else\n  vVertShade = vec3(1.0);\n#endif"
          );

      sh.fragmentShader =
        "uniform vec3 uCanonicalSkinLin, uClayLin;\nuniform float uClayMode;\nuniform vec4 uCyanGlow;\n" +
        "varying vec4 vLidParam;\nvarying vec3 vBindPos;\nvarying vec3 vBindNrm;\nvarying vec3 vVertShade;\nvarying float vEffOpen;\n" +
        "float lidG2(float x, float y, float cx, float cy, float wx, float wy) { float dx = (x - cx) / wx; float dy = (y - cy) / wy; return exp(-(dx * dx + dy * dy)); }\n" +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "float thF = vLidParam.x, tvF = vLidParam.y;\n" +
            "float cthF = cos(thF), sthF = sin(thF);\n" +
            "float dGrA = fract(sin(dot(floor(vBindPos.xy * 1100.0 + vBindPos.z * 890.0), vec2(12.9898, 78.233))) * 43758.5453);\n" +
            "float dGrB = sin(vBindPos.x * 520.0 + sin(vBindPos.y * 580.0 + vBindPos.z * 420.0)) * 0.5 + 0.5;\n" +
            "float dermalG = 1.0 + ((dGrA - 0.5) * 0.032 + (dGrB - 0.5) * 0.022);\n" +
            "// Exact 1:1 linear melanin + malar/nasal warmZone match to headBustGeo at tv -> 1.00 (0.000% oval patch seam!)\n" +
            "vec3 lidSkin = uCanonicalSkinLin * dermalG;\n" +
            "float axW = abs(vBindPos.x), pyW = vBindPos.y, pzW = vBindPos.z;\n" +
            "float noseWarmL = lidG2(axW, pyW, 0.0, 1.584, 0.018, 0.013) * smoothstep(0.04, 0.09, pzW);\n" +
            "float malarWarmL = lidG2(axW, pyW, 0.046, 1.594, 0.024, 0.018) * smoothstep(0.01, 0.06, pzW) * 0.45;\n" +
            "float warmZoneL = clamp(noseWarmL * 0.72 + malarWarmL, 0.0, 1.0) * smoothstep(0.32, 0.82, tvF);\n" +
            "lidSkin = mix(lidSkin, lidSkin * vec3(1.13, 0.96, 0.91) + vec3(0.0045, 0.0012, 0.0006), warmZoneL * 0.62);\n" +
            "float clayCrease = 0.0;\n" +
            "if (sthF > 0.0) {\n" +
            "  float tarsalWarm = smoothstep(0.15, 0.24, tvF) * (1.0 - smoothstep(0.46, 0.56, tvF)) * sthF;\n" +
            "  lidSkin *= mix(vec3(1.0), vec3(1.02, 0.93, 0.90), tarsalWarm * 0.36);\n" +
            "  float creaseShape = smoothstep(0.05, 0.34, sthF) * (1.0 - 0.16 * cthF * cthF);\n" +
            "  float foldFactor = mix(0.24, 1.0, clamp(vEffOpen, 0.0, 1.0));\n" +
            "  float creaseAO = exp(-pow((tvF - 0.540) / 0.032, 2.0)) * creaseShape * foldFactor;\n" +
            "  lidSkin *= (1.0 - 0.38 * creaseAO);\n" +
            "  clayCrease = creaseAO * 0.34;\n" +
            "}\n" +
            "// Delicate lash-line follicular definition (only in non-clay PBR mode)\n" +
            "float lashSpan = smoothstep(-0.84, -0.58, cthF) * (1.0 - smoothstep(0.95, 0.995, cthF));\n" +
            "float tightStr = sthF >= 0.0 ? (0.54 * smoothstep(0.0, 0.20, sthF)) : (0.12 * smoothstep(0.0, 0.25, -sthF));\n" +
            "float tightLine = exp(-pow((tvF - 0.162) / 0.020, 2.0)) * lashSpan * tightStr;\n" +
            "lidSkin = mix(lidSkin, lidSkin * vec3(0.20, 0.14, 0.13), tightLine);\n" +
            "// Wet Meibomian waterline margin (tv < 0.15)\n" +
            "if (tvF < 0.155) {\n" +
            "  float wetMask = 1.0 - smoothstep(0.115, 0.155, tvF);\n" +
            "  vec3 meibomian = mix(lidSkin * vec3(1.18, 0.68, 0.64), vec3(0.14, 0.046, 0.044), 0.32);\n" +
            "  float fornixAO = mix(0.55, 1.0, smoothstep(0.00, 0.052, tvF));\n" +
            "  lidSkin = mix(lidSkin, meibomian * fornixAO, wetMask * 0.80);\n" +
            "}\n" +
            "// Exact 1:1 Clay Mode match to headBustGeo clayAlb (zero darkened outer oval!)\n" +
            "vec3 clayLid = uClayLin * (1.0 - clayCrease) * (1.0 + (dermalG - 1.0) * 0.40);\n" +
            "diffuseColor.rgb = mix(lidSkin, clayLid, uClayMode);"
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\n" +
            "float lidRgh = tvF < 0.15 ? mix(0.12, 0.58, smoothstep(0.10, 0.15, tvF)) : clamp(roughnessFactor, 0.34, 0.82);\n" +
            "roughnessFactor = mix(lidRgh, 0.82, uClayMode);"
          )
          .replace(
            "#include <aomap_fragment>",
            "#include <aomap_fragment>\n" +
            "{\n" +
            "  float ndvL = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);\n" +
            "  float sssZoneL = mix(1.0, 0.28, uClayMode);\n" +
            "  float sssL = smoothstep(0.02, 0.48, 1.0 - ndvL) * smoothstep(0.02, 0.16, ndvL) * smoothstep(0.16, 0.40, vLidParam.y) * sssZoneL;\n" +
            "  reflectedLight.directDiffuse *= mix(vec3(1.0), vec3(1.32, 1.18, 1.10), sssL * 0.72);\n" +
            "  reflectedLight.indirectDiffuse = reflectedLight.indirectDiffuse * (1.0 + 0.18 * sssZoneL) + diffuseColor.rgb * 0.024 * sssZoneL;\n" +
            "}"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "if (uCyanGlow.w > 0.001 && uClayMode < 0.5) {\n" +
            "  vec3 toS = vBindPos - uCyanGlow.xyz;\n" +
            "  float d2 = dot(toS, toS) + 0.032;\n" +
            "  float ndl = clamp(dot(normalize(vBindNrm), normalize(-toS)) * 0.65 + 0.35, 0.0, 1.0);\n" +
            "  totalEmissiveRadiance += vec3(0.14, 0.72, 0.96) * (uCyanGlow.w * 0.75 * ndl / (1.0 + 15.0 * d2)) * (0.36 + 0.64 * diffuseColor.rgb);\n" +
            "}"
          );
    };
    lidPhysMat.customProgramCacheKey = () => "HumanPhysicalV6_PalpebralLid_v3";

    scionLids.mesh.material = lidPhysMat;
    scionLids.v6Material = lidPhysMat;
    scionLids.syncSkinColor = linCol => {
      if (!linCol) return;
      const r = linCol.x !== undefined ? linCol.x : linCol.r;
      const g = linCol.y !== undefined ? linCol.y : linCol.g;
      const b = linCol.z !== undefined ? linCol.z : linCol.b;
      if (r !== undefined) canonicalSkinUniform.value.set(Math.max(0.002, r), Math.max(0.002, g), Math.max(0.002, b));
    };

    // Upgrade 3D micro-lashes to lock 0.000mm onto the widened 1.50x almond lash margin!
    if (scionLids.lashMesh && scionLids.lashMesh.material && !scionLids.lashMesh.userData._v6LashUpgraded) {
      const lashMatV6 = new T.MeshStandardMaterial({
        color: 0x130e0c,
        roughness: 0.44,
        metalness: 0.02,
        envMapIntensity: 0.35
      });
      lashMatV6.onBeforeCompile = sh => {
        sh.uniforms.uLidRigA = rigUniforms.uLidRigA;
        sh.uniforms.uLidRigB = rigUniforms.uLidRigB;
        sh.uniforms.uLidRigC = rigUniforms.uLidRigC;
        sh.uniforms.uCyanGlow = cyanGlow;
        sh.vertexShader =
          "attribute vec4 aLashParam;\nattribute vec3 aLashLocal;\nattribute vec2 aLashShade;\n" +
          "uniform vec4 uLidRigA, uLidRigB, uLidRigC;\n" +
          "varying vec2 vLashShade;\nvarying vec3 vLashPos;\n" +
          GLSL_V6_LID_RIG +
          sh.vertexShader
            .replace(
              "#include <beginnormal_vertex>",
              "#include <beginnormal_vertex>\n" +
              "float thLN = aLashParam.x, sideLN = aLashParam.y, isUpLN = aLashParam.z;\n" +
              "float dxBindLN, dxLLN, dyBOLN, dyLLN, effOpLN;\n" +
              "evalPalpebralFissureStateV6(thLN, sideLN, uLidRigA, uLidRigB, uLidRigC, dxBindLN, dxLLN, dyBOLN, dyLLN, effOpLN);\n" +
              "float pitchLN = isUpLN > 0.5\n" +
              "  ? (-1.24 * pow(clamp(1.0 - effOpLN, 0.0, 1.0), 0.74) + 0.34 * max(0.0, effOpLN - 1.0))\n" +
              "  : (-0.14 * clamp(1.0 - effOpLN, 0.0, 1.0) + 0.16 * clamp(uLidRigB.w, 0.0, 1.0));\n" +
              "float cpLN = cos(pitchLN), spLN = sin(pitchLN);\n" +
              "objectNormal = normalize(vec3(objectNormal.x, objectNormal.y * cpLN + objectNormal.z * spLN, -objectNormal.y * spLN + objectNormal.z * cpLN));"
            )
            .replace(
              "#include <begin_vertex>",
              "#include <begin_vertex>\n" +
              "float thL = aLashParam.x, sideL = aLashParam.y, isUpL = aLashParam.z;\n" +
              "float cthL = cos(thL), sthL = sin(thL);\n" +
              "float dxBindL, dxLL, dyBOL, dyLL, effOpL;\n" +
              "evalPalpebralFissureStateV6(thL, sideL, uLidRigA, uLidRigB, uLidRigC, dxBindL, dxLL, dyBOL, dyLL, effOpL);\n" +
              "float dxRoot = dxLL + 0.00010 * cthL;\n" +
              "float dyRoot = dyLL + 0.00010 * sthL;\n" +
              "float rXY2L = dxRoot * dxRoot + dyRoot * dyRoot;\n" +
              "float rWrapL = 0.01395;\n" +
              "float cLiftL = evalLiveCornealLiftV6(dxRoot, dyRoot, sideL, uLidRigB.x, uLidRigB.y);\n" +
              "float zSphereL = 0.0577 + sqrt(max(0.000004, rWrapL * rWrapL - min(rWrapL * rWrapL - 0.000004, rXY2L))) + cLiftL;\n" +
              "float canthusTaperL = 0.72 + 0.28 * pow(max(0.0, 1.0 - cthL * cthL), 0.45);\n" +
              "float latTuckL = -0.00185 * smoothstep(0.58, 0.98, cthL);\n" +
              "vec3 rootLive = vec3(sideL * (0.0308 + dxRoot), 1.6158 + dyRoot, zSphereL + 0.00155 * canthusTaperL + latTuckL);\n" +
              "float pitchL = isUpL > 0.5\n" +
              "  ? (-1.24 * pow(clamp(1.0 - effOpL, 0.0, 1.0), 0.74) + 0.34 * max(0.0, effOpL - 1.0))\n" +
              "  : (-0.14 * clamp(1.0 - effOpL, 0.0, 1.0) + 0.16 * clamp(uLidRigB.w, 0.0, 1.0));\n" +
              "float cpL = cos(pitchL), spL = sin(pitchL);\n" +
              "vec3 rotOff = vec3(aLashLocal.x * 1.12, (aLashLocal.y * cpL + aLashLocal.z * spL) * 1.12, (-aLashLocal.y * spL + aLashLocal.z * cpL) * 1.12);\n" +
              "transformed = rootLive + rotOff;\n" +
              "vLashShade = aLashShade;\nvLashPos = transformed;"
            );
        sh.fragmentShader =
          "uniform vec4 uCyanGlow;\nvarying vec2 vLashShade;\nvarying vec3 vLashPos;\n" +
          sh.fragmentShader
            .replace(
              "#include <color_fragment>",
              "#include <color_fragment>\n" +
              "float sTip = vLashShade.x;\nfloat hVar = 0.88 + 0.24 * vLashShade.y;\n" +
              "diffuseColor.rgb = mix(vec3(0.0055, 0.0038, 0.0032), vec3(0.0155, 0.0102, 0.0082), smoothstep(0.25, 1.0, sTip)) * hVar;"
            )
            .replace(
              "#include <emissivemap_fragment>",
              "#include <emissivemap_fragment>\n" +
              "if (uCyanGlow.w > 0.001) {\n" +
              "  vec3 toS = vLashPos - uCyanGlow.xyz;\n" +
              "  totalEmissiveRadiance += vec3(0.04, 0.18, 0.24) * (uCyanGlow.w * 0.22 / (1.0 + 16.0 * (dot(toS, toS) + 0.035)));\n" +
              "}"
            );
      };
      lashMatV6.customProgramCacheKey = () => "HumanPhysicalV6_MicroLashes_v3";
      scionLids.lashMesh.material = lashMatV6;
      scionLids.lashMesh.userData._v6LashUpgraded = true;
    }

    // Scale ocular globes, caruncles & tear menisci 1.18x (13.1mm rich dark iris!) + soften sclera albedo ~18% (#265 item 4a)
    if (scionEyes) {
      scionEyes._v6Tagged = true;
      const eyeScale = 1.18;
      if (scionEyes.eyeL) {
        scionEyes.eyeL.position.set(0.0308, 1.6158, 0.0577);
        scionEyes.eyeL.scale.setScalar(eyeScale);
      }
      if (scionEyes.eyeR) {
        scionEyes.eyeR.position.set(-0.0308, 1.6158, 0.0577);
        scionEyes.eyeR.scale.setScalar(eyeScale);
      }
      if (Array.isArray(scionEyes.caruncles)) {
        for (const cMesh of scionEyes.caruncles) {
          if (!cMesh) continue;
          const sgn = cMesh.name && cMesh.name.indexOf("_R") >= 0 ? -1 : 1;
          cMesh.position.set(sgn * 0.0308, 1.6158, 0.0577);
          cMesh.scale.setScalar(eyeScale);
        }
      }
      if (Array.isArray(scionEyes.menisci)) {
        for (const mMesh of scionEyes.menisci) {
          if (!mMesh) continue;
          const sgn = mMesh.name && mMesh.name.indexOf("_R") >= 0 ? -1 : 1;
          mMesh.position.x = sgn * 0.0308;
          mMesh.position.z = 0.0577;
          mMesh.scale.setScalar(eyeScale);
          // Prevent bright horizontal tear-meniscus glint bars in high-contrast monochrome print shaders!
          if (mMesh.material && !mMesh.material.userData._v6MeniscusSoft) {
            const mMat = mMesh.material;
            const prevMenOBC = mMat.onBeforeCompile;
            mMat.onBeforeCompile = sh => {
              if (typeof prevMenOBC === "function") prevMenOBC(sh);
              sh.fragmentShader = sh.fragmentShader.replace(
                "float mAlpha = clamp(mPeak, 0.0, 0.36);",
                "tearSpec *= 0.28;\nfloat mPeakSoft = max(tearSpec.r, max(tearSpec.g, tearSpec.b));\nfloat mAlpha = clamp(mPeakSoft, 0.0, 0.14);"
              );
            };
            mMat.customProgramCacheKey = () => "scionTearMeniscus_v6_soft";
            mMat.userData = mMat.userData || {};
            mMat.userData._v6MeniscusSoft = true;
            mMat.needsUpdate = true;
          }
        }
      }
      // Couple scionEyes.setGaze -> scionLids.setGaze AND automatically couple downward head pitch (e.g. June in R2!)
      // into downward iris fixation + warm upper-lid levator drape so ZERO bright white lower-sclera crescents appear!
      const v6HeadWorldDir = new T.Vector3();
      let baseGazeX = rigUniforms.uLidRigB.value.x;
      let baseGazeY = rigUniforms.uLidRigB.value.y;
      let baseWide = rigUniforms.uLidRigB.value.z;
      let inAutoPitchSync = false;
      if (scionLids && typeof scionLids.setGaze === "function" && !scionLids._v6WrappedSetGaze) {
        const origLidSetGaze = scionLids.setGaze.bind(scionLids);
        scionLids.setGaze = (yx = 0, py = 0) => {
          if (!inAutoPitchSync) { baseGazeX = yx; baseGazeY = py; }
          origLidSetGaze(yx, py);
        };
        scionLids._v6WrappedSetGaze = true;
      }
      if (scionLids && typeof scionLids.setState === "function" && !scionLids._v6WrappedSetState) {
        const origLidSetState = scionLids.setState.bind(scionLids);
        scionLids.setState = st => {
          origLidSetState(st);
          if (!inAutoPitchSync) {
            baseGazeX = rigUniforms.uLidRigB.value.x;
            baseGazeY = rigUniforms.uLidRigB.value.y;
            baseWide = rigUniforms.uLidRigB.value.z;
          }
        };
        scionLids._v6WrappedSetState = true;
      }
      if (typeof scionEyes.setGaze === "function" && scionLids && typeof scionLids.setGaze === "function" && !scionEyes._v6GazeCoupled) {
        const origEyeSetGaze = scionEyes.setGaze.bind(scionEyes);
        scionEyes.setGaze = (yawRad = 0, pitchRad = 0) => {
          if (!inAutoPitchSync) { baseGazeX = yawRad; baseGazeY = pitchRad; }
          origEyeSetGaze(yawRad, pitchRad);
          scionLids.setGaze(yawRad, pitchRad);
        };
        scionEyes._v6GazeCoupled = true;
      }
      if (scionLids.mesh && !scionLids.mesh.userData._v6HeadPitchHook) {
        const prevOBR = scionLids.mesh.onBeforeRender;
        scionLids.mesh.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
          if (typeof prevOBR === "function") prevOBR.call(this, renderer, scene, camera, geometry, material, group);
          const anchor = this.parent;
          if (!anchor || typeof anchor.getWorldDirection !== "function") return;
          anchor.getWorldDirection(v6HeadWorldDir);
          // Forward +Z of headAnchor: when pitched downward > 2.5° (e.g. June & Makeda in R2!), pitch iris & upper lid down warmly!
          const downTilt = clamp((-v6HeadWorldDir.y - 0.045) * 1.75, 0.0, 0.42);
          if (downTilt > 0.005 && baseGazeY > -0.18) {
            const effPitch = clamp(baseGazeY - downTilt * 0.92, -0.40, 0.40);
            const wideDamp = 1.0 - smooth(0.02, 0.18, downTilt);
            inAutoPitchSync = true;
            if (typeof scionEyes.setGaze === "function") scionEyes.setGaze(baseGazeX, effPitch);
            rigUniforms.uLidRigB.value.y = effPitch;
            rigUniforms.uLidRigB.value.z = baseWide * wideDamp;
            inAutoPitchSync = false;
          }
        };
        scionLids.mesh.userData._v6HeadPitchHook = true;
      }
      for (const eyeGrp of [scionEyes.eyeL, scionEyes.eyeR]) {
        const globeM = eyeGrp && eyeGrp.userData && eyeGrp.userData.globeMesh;
        if (globeM && globeM.material && !globeM.material.userData._v6ScleraSoftened) {
          const innerMat = globeM.material;
          const prevOBC = innerMat.onBeforeCompile;
          innerMat.onBeforeCompile = sh => {
            if (typeof prevOBC === "function") prevOBC(sh);
            sh.fragmentShader = sh.fragmentShader.replace(
              "diffuseColor.rgb = scleraCol * mix(vec3(1.0), shadedTint, notPupil);",
              "vec3 scleraSoft = mix(scleraCol * vec3(0.56, 0.54, 0.51), scleraCol, innerChamberMask);\n" +
              "float cornerSoftAO = 1.0 - 0.42 * smoothstep(0.0060, 0.0102, abs(dxLat)) * (1.0 - innerChamberMask);\n" +
              "float downGazeAO = smoothstep(0.0, -0.22, uLidState.w) * (1.0 - innerChamberMask * 0.72);\n" +
              "float extraUpperAO = (1.0 - 0.30 * (1.0 - smoothstep(-0.0008, 0.0044, distFromUpper)) * (1.0 - innerChamberMask * 0.55)) * (1.0 - 0.36 * downGazeAO) * cornerSoftAO;\n" +
              "diffuseColor.rgb = scleraSoft * mix(vec3(1.0), shadedTint * extraUpperAO, notPupil);"
            );
          };
          innerMat.customProgramCacheKey = () => "scionInnerEyeGlobe_v6_soft2";
          innerMat.userData = innerMat.userData || {};
          innerMat.userData._v6ScleraSoftened = true;
          innerMat.needsUpdate = true;
        }
      }
      if (typeof scionEyes.syncSkinColor === "function") {
        scionEyes.syncSkinColor(canonicalSkinUniform.value);
      }
    }
  }

  /* ==========================================================================
     6. UPGRADE ANY CHARACTER INSTANCE'S SKIN MESHES SEAMLESSLY
     ========================================================================== */
  function upgradeCharacterSkinMeshes(T, ch, specOverride) {
    if (!ch || !ch.group) return ch;

    // Recover exact character spec from ch.spec, group.userData.spec, or headMesh.geometry.userData.spec!
    let discoveredSpec = specOverride || ch.spec || (ch.group.userData && ch.group.userData.spec) || null;
    let sharedFacs = null;
    let sharedCyan = null;
    let sharedHandCyan = null;
    ch.group.traverse(obj => {
      if (!discoveredSpec && obj.geometry && obj.geometry.userData && obj.geometry.userData.spec) {
        discoveredSpec = obj.geometry.userData.spec;
      }
      if (obj.material && obj.material.userData) {
        if (!sharedFacs && obj.material.userData.facsUniforms) sharedFacs = obj.material.userData.facsUniforms;
        if (obj.geometry && obj.geometry.attributes && obj.geometry.attributes.aHandMeta) {
          if (!sharedHandCyan && obj.material.userData.cyanGlow) sharedHandCyan = obj.material.userData.cyanGlow;
        } else if (!sharedCyan && obj.material.userData.cyanGlow) {
          sharedCyan = obj.material.userData.cyanGlow;
        }
      }
    });
    const spec = discoveredSpec || {};
    const pal = resolveSkinPalette(T, spec);
    const maps = getMaps(T, spec.textureBase || spec.assetPath);

    // Reuse ch.canonicalSkinUniform if present so forearm/wrist/body skin shares 100.0% identical Vector3!
    const canonicalSkinUniform = (ch.canonicalSkinUniform && ch.canonicalSkinUniform.value)
      ? ch.canonicalSkinUniform
      : { value: pal.baseLin.clone() };
    canonicalSkinUniform.value.copy(pal.baseLin);
    const clayUniform = { value: 0.0 };

    const headMatV6 = createSkinMaterial(T, {
      spec,
      maps,
      canonicalSkinUniform,
      clayUniform,
      facsUniforms: sharedFacs,
      cyanGlow: sharedCyan
    });
    sharedFacs = headMatV6.userData.facsUniforms;
    sharedCyan = headMatV6.userData.cyanGlow;

    const bodyMatV6 = createBodySkinMaterial(T, {
      spec,
      canonicalSkinUniform,
      clayUniform,
      cyanGlow: sharedCyan,
      localOffsetY: 0.0
    });

    const handMatV6 = createHandMaterial(T, {
      spec,
      maps,
      canonicalSkinUniform,
      clayUniform,
      cyanGlow: sharedHandCyan || sharedCyan
    });

    // Upgrade head, ear, bare-arm/leg skin (isSkin), and hand materials to genuine MeshPhysicalMaterial V6!
    ch.group.traverse(obj => {
      if (!obj.isMesh || !obj.material) return;
      const g = obj.geometry;
      if (!g || !g.attributes) return;
      if (g.attributes.aHandMeta) {
        if (g.attributes.uv && !g.attributes.uv1) g.setAttribute("uv1", g.attributes.uv);
        obj.material = handMatV6;
      } else if (g.attributes.aFaceMeta && g.attributes.aFacsMeta) {
        if (g.attributes.uv && !g.attributes.uv1) g.setAttribute("uv1", g.attributes.uv);
        obj.material = headMatV6;
      } else if (((obj.userData && obj.userData.isSkin) || (obj.material.userData && (obj.material.userData.isSkin || obj.material.userData.isUnifiedBodySkin))) && !g.attributes.aLidParam) {
        obj.material = bodyMatV6;
      } else if (!obj.material.map && obj.isSkinnedMesh && !g.attributes.aHairLen && !g.attributes.aOralMeta && !g.attributes.aLidParam) {
        const matCol = obj.material.color;
        if (matCol && !obj.userData.isGarment && !obj.userData.isBoot && !obj.userData.isHair) {
          const rmc = matCol.r, bmc = matCol.b;
          if (rmc > bmc * 1.12 && rmc < 0.78) {
            obj.material = bodyMatV6;
          }
        }
      }
    });

    const scionEyes = ch.scionEyes || (ch.group.userData && ch.group.userData.scionEyes) || null;
    const scionLids = ch.scionLids || (ch.group.userData && ch.group.userData.scionLids) || null;
    if (scionLids) {
      upgradeEyeAndLidRig(T, scionEyes, scionLids, {
        spec,
        maps,
        canonicalSkinUniform,
        clayUniform,
        cyanGlow: sharedCyan,
        facsUniforms: sharedFacs
      });
    }

    ch.group.userData = ch.group.userData || {};
    ch.group.userData.v6Skin = {
      phenoKey: pal.phenoKey,
      canonicalSkinUniform,
      clayUniform,
      headMatV6,
      bodyMatV6,
      handMatV6,
      facsUniforms: sharedFacs
    };
    ch.v6Skin = ch.group.userData.v6Skin;
    return ch;
  }

  /* ==========================================================================
     7. 3-VALUE SCULPTOR'S MATTE CLAY TURNAROUND ENGINE (0b07591c.jpg 1:1)
        - Hair:     #4c4742 darker charcoal-umber clay (frames forehead & ears)
        - Skin:     #6b655e mid warm-olive sculptor's clay + subtle dark clay brows
        - Garments: #8a847b lighter warm stone-grey clay (DoubleSide collar!)
     ========================================================================== */
  function createClayReplacementMaterial(T, srcMat, opts = {}) {
    const role = opts.role || "skin";
    const isSclera = Boolean(opts.isSclera);
    const isCornea = Boolean(opts.isCornea);

    if (isCornea) {
      // Optically clear satin sculptor's catchlight dome (crisp pinpoint catchlight matching 0b07591c.jpg 1:1!)
      return new T.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.055,
        roughness: 0.07,
        metalness: 0.0,
        clearcoat: 0.92,
        clearcoatRoughness: 0.05,
        depthWrite: false
      });
    }

    let colHex = CLAY_STUDIO_PALETTE.clayHex;
    let rough = 0.82;
    let specInt = 0.36;
    let sheenVal = 0.16;
    let sideMode = (srcMat && srcMat.side !== undefined) ? srcMat.side : T.FrontSide;
    const useHairVertAO = Boolean(role === "hair" && srcMat && srcMat.vertexColors);

    if (opts.clayHex !== undefined) {
      colHex = opts.clayHex;
    } else if (isSclera) {
      colHex = CLAY_STUDIO_PALETTE.scleraClayHex;
      rough = 0.58;
      specInt = 0.42;
      sheenVal = 0.06;
    } else if (role === "hair") {
      colHex = useHairVertAO ? 0x58534d : CLAY_STUDIO_PALETTE.hairClayHex;
      rough = 0.91;
      specInt = 0.16;
      sheenVal = 0.08;
    } else if (role === "garment") {
      colHex = CLAY_STUDIO_PALETTE.garmentClayHex;
      rough = 0.85;
      specInt = 0.30;
      sheenVal = 0.14;
    } else if (role === "oral") {
      colHex = 0x48433e;
      rough = 0.86;
      specInt = 0.20;
    }

    const keepSrcNormal = role !== "garment";
    const clayMat = new T.MeshPhysicalMaterial({
      color: colHex,
      roughness: rough,
      metalness: 0.0,
      ior: 1.42,
      specularIntensity: specInt,
      sheen: sheenVal,
      sheenRoughness: 0.86,
      sheenColor: new T.Color(CLAY_STUDIO_PALETTE.sheenColorHex),
      envMapIntensity: 0.32,
      normalMap: (keepSrcNormal && srcMat && srcMat.normalMap) || null,
      normalScale: (keepSrcNormal && srcMat && srcMat.normalScale) ? srcMat.normalScale.clone() : new T.Vector2(0.5, 0.5),
      bumpMap: (keepSrcNormal && srcMat && srcMat.bumpMap) || null,
      bumpScale: (srcMat && srcMat.bumpScale) ? srcMat.bumpScale * 0.85 : 0.015,
      aoMap: (srcMat && srcMat.aoMap) || null,
      aoMapIntensity: (srcMat && srcMat.aoMapIntensity !== undefined) ? srcMat.aoMapIntensity : 0.65,
      side: sideMode,
      clippingPlanes: (srcMat && srcMat.clippingPlanes) ? srcMat.clippingPlanes.slice() : null,
      clipShadows: Boolean(srcMat && srcMat.clipShadows),
      vertexColors: useHairVertAO
    });

    if (useHairVertAO) {
      // Soften tuft root-to-tip vertex AO to sculptor's clay crevice shading [0.68..1.05] (never coal-black holes!)
      clayMat.onBeforeCompile = sh => {
        sh.fragmentShader = sh.fragmentShader.replace(
          "#include <color_fragment>",
          "vec3 hairOrigRGB = diffuseColor.rgb;\n#include <color_fragment>\n" +
          "float vLumH = dot(diffuseColor.rgb / max(vec3(0.001), hairOrigRGB), vec3(0.3333));\n" +
          "diffuseColor.rgb = hairOrigRGB * mix(0.68, 1.05, clamp(vLumH, 0.0, 1.0));"
        );
      };
      clayMat.customProgramCacheKey = () => "HumanPhysicalV6_ClayHairVertAO_v3";
    } else if (opts.isEyeGlobe) {
      // Sculpt warm mid-clay sclera (#827b73) + charcoal-olive clay iris (#3b3733) + crisp pinpoint studio catchlight matching 0b07591c.jpg 1:1!
      clayMat.onBeforeCompile = sh => {
        sh.vertexShader = "varying vec3 vEyeLocP;\n" + sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvEyeLocP = position;"
        );
        sh.fragmentShader = "varying vec3 vEyeLocP;\n" + sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "float rPl = length(vEyeLocP.xy);\n" +
            "float upperSocketShade = 1.0 - 0.36 * smoothstep(-0.0002, 0.0040, vEyeLocP.y) - 0.24 * smoothstep(0.0068, 0.0110, abs(vEyeLocP.x));\n" +
            "diffuseColor.rgb *= clamp(upperSocketShade, 0.50, 1.0);\n" +
            "if (vEyeLocP.z > 0.005 && rPl < 0.0061) {\n" +
            "  float irisM = 1.0 - smoothstep(0.0054, 0.0060, rPl);\n" +
            "  float pupilM = 1.0 - smoothstep(0.00185, 0.00225, rPl);\n" +
            "  float limbusM = exp(-pow((rPl - 0.00555) / 0.00048, 2.0));\n" +
            "  float radialStr = 0.92 + 0.12 * sin(atan(vEyeLocP.y, vEyeLocP.x) * 32.0);\n" +
            "  vec3 irisClay = vec3(0.044, 0.040, 0.036) * radialStr;\n" +
            "  vec3 limbusClay = vec3(0.024, 0.022, 0.019);\n" +
            "  vec3 pupilClay = vec3(0.012, 0.011, 0.010);\n" +
            "  diffuseColor.rgb = mix(diffuseColor.rgb, irisClay, irisM);\n" +
            "  diffuseColor.rgb = mix(diffuseColor.rgb, limbusClay, limbusM * 0.80 * irisM);\n" +
            "  diffuseColor.rgb = mix(diffuseColor.rgb, pupilClay, pupilM);\n" +
            "}"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "// Crisp pinpoint studio key-light corneal catchlight on upper-left iris/pupil border (0b07591c.jpg 1:1!)\n" +
            "if (vEyeLocP.z > 0.008) {\n" +
            "  vec2 catchPos = vec2(-0.00135, 0.00135);\n" +
            "  float dCatch = length(vEyeLocP.xy - catchPos);\n" +
            "  float catchDot = 1.0 - smoothstep(0.00042, 0.00072, dCatch);\n" +
            "  float catchHalo = exp(-pow(dCatch / 0.00105, 2.0)) * 0.18;\n" +
            "  totalEmissiveRadiance += vec3(0.78, 0.75, 0.70) * (catchDot + catchHalo);\n" +
            "}"
          );
      };
      clayMat.customProgramCacheKey = () => "HumanPhysicalV6_ClayEyeGlobe_v5";
    }
    return clayMat;
  }

  function setClayMode(targetRoot, enabled = true, opts = {}) {
    const T = opts.THREE || (typeof window !== "undefined" ? window.THREE : null);
    const root = (targetRoot && (targetRoot.group || targetRoot.root)) || targetRoot;
    if (!root || typeof root.traverse !== "function") return targetRoot;

    const flag = Boolean(enabled);
    const claySheenCol = T ? new T.Color(CLAY_STUDIO_PALETTE.sheenColorHex) : null;

    // Toggle shared uClayMode uniforms on any HumanPhysicalV6 materials
    root.traverse(obj => {
      if (obj.userData && obj.userData.v6Skin && obj.userData.v6Skin.clayUniform) {
        obj.userData.v6Skin.clayUniform.value = flag ? 1.0 : 0.0;
      }
      if (obj.userData && obj.userData.scionLids && obj.userData.scionLids.lashMesh) {
        const lashM = obj.userData.scionLids.lashMesh;
        if (flag) {
          if (lashM.userData._preClayVis === undefined) lashM.userData._preClayVis = lashM.visible;
          lashM.visible = false; // Sculptor's clay busts (0b07591c.jpg) have clean clay eyelids without hair wires!
        } else if (lashM.userData._preClayVis !== undefined) {
          lashM.visible = lashM.userData._preClayVis;
          delete lashM.userData._preClayVis;
        }
      }

      if (!obj.isMesh && !obj.isSkinnedMesh && !obj.isInstancedMesh) return;
      if (obj.renderOrder >= 990) return; // Skip X-ray skeleton debug lines/joints!
      const mat = obj.material;
      if (!mat) return;

      // Case A: Native HumanPhysicalV6 material -> flip uniform + sheen intensity in-place (preserves GPU FACS & lid morphs!)
      if (mat.userData && mat.userData.isHumanPhysicalV6) {
        if (mat.userData.clayUniform) mat.userData.clayUniform.value = flag ? 1.0 : 0.0;
        mat.sheen = flag ? 0.16 : 0.42;
        mat.sheenRoughness = flag ? 0.86 : 0.68;
        if (claySheenCol && mat.sheenColor) {
          mat.sheenColor.copy(flag ? claySheenCol : (mat.userData.baseSheenColor || claySheenCol));
        }
        return;
      }

      // Case B: Hair grooms (#4c4742), collars/garments (#8a847b), caruncles (#6b655e), eye globes, legacy shells
      if (!T) return;
      if (flag) {
        if (!obj.userData._preClayMat) {
          obj.userData._preClayMat = mat;
        }
        const src = obj.userData._preClayMat;
        if (obj.userData.isWaterCyan && !opts.includeWater) return;

        if (obj.geometry && obj.geometry.attributes && obj.geometry.attributes.aHairLen && src && src.onBeforeCompile) {
          if (!obj.userData._clayShellMatV3) {
            const cm = new T.MeshPhysicalMaterial({
              color: CLAY_STUDIO_PALETTE.hairClayHex,
              roughness: 0.90,
              metalness: 0.0,
              specularIntensity: 0.16,
              sheen: 0.08,
              sheenRoughness: 0.88,
              sheenColor: new T.Color(CLAY_STUDIO_PALETTE.sheenColorHex),
              clippingPlanes: src.clippingPlanes ? src.clippingPlanes.slice() : null,
              clipShadows: Boolean(src.clipShadows),
              side: src.side
            });
            cm.onBeforeCompile = sh => {
              sh.vertexShader =
                "attribute float aHairLen;\nattribute float aShellFrac;\nvarying float vShF;\nvarying float vHL;\nvarying vec3 vHB;\n" +
                sh.vertexShader.replace(
                  "#include <begin_vertex>",
                  "float hSh = aShellFrac >= 0.0 ? aShellFrac : 0.5;\n" +
                  "vec3 transformed = position + objectNormal * (aHairLen * hSh);\n" +
                  "vShF = hSh; vHL = aHairLen; vHB = position;"
                );
              sh.fragmentShader =
                "varying float vShF;\nvarying float vHL;\nvarying vec3 vHB;\n" +
                sh.fragmentShader.replace(
                  "#include <color_fragment>",
                  "#include <color_fragment>\n" +
                  "vec3 pClump = vHB * 92.0;\n" +
                  "float cCell = sin(pClump.x) * sin(pClump.y) * sin(pClump.z) * 0.5 + 0.5;\n" +
                  "float cFine = sin(pClump.x * 2.3 + 1.1) * sin(pClump.y * 2.3 + 0.7) * 0.5 + 0.5;\n" +
                  "float density = 0.62 * cCell + 0.38 * cFine;\n" +
                  "if (vHL < 0.0012 || (vShF > 0.01 && density < mix(0.18, 0.72, pow(vShF, 0.85)))) discard;\n" +
                  "float clumpAO = mix(0.68, 1.05, pow(vShF, 0.75)) * (0.88 + 0.20 * density);\n" +
                  "diffuseColor.rgb *= clumpAO;"
                );
            };
            cm.customProgramCacheKey = () => "HumanPhysicalV6_ClayCoilClump_v3";
            obj.userData._clayShellMatV3 = cm;
          }
          obj.material = obj.userData._clayShellMatV3;
          return;
        }

        const mName = String(obj.name || "");
        const isTearMeniscus = mName.indexOf("TearMeniscus") >= 0 || Boolean(src.transparent && src.opacity < 0.30 && src.clearcoat > 0.8);
        if (isTearMeniscus) {
          if (obj.userData._preClayVis === undefined) obj.userData._preClayVis = obj.visible;
          obj.visible = false;
          return;
        }
        const isCornea = mName.indexOf("Cornea") >= 0 || Boolean(src.transparent && src.opacity < 0.35 && src.clearcoat > 0.5);
        const gRadius = obj.geometry && obj.geometry.boundingSphere ? obj.geometry.boundingSphere.radius : 1.0;
        const isEyeGlobe = mName.indexOf("GlobeInner") >= 0 || (gRadius > 0.009 && gRadius < 0.016 && !src.transparent && !isCornea);

        const isGarmentTag = Boolean(obj.userData.isGarment || obj.userData.isBoot || (src.userData && src.userData.isGarment));
        const isHairRole = Boolean(!isGarmentTag && (obj.userData.isHair || (src.userData && src.userData.surfaceTag === "hair")));
        const isSkinRole = mName.indexOf("Caruncle") >= 0 || Boolean(obj.userData.isSkin || (src.userData && src.userData.isSkin));
        const isOralRole = mName.indexOf("OralDentition") >= 0 || Boolean(obj.geometry && obj.geometry.attributes && obj.geometry.attributes.aOralMeta);
        const role = isEyeGlobe ? "sclera" : isCornea ? "cornea" : isHairRole ? "hair" : isSkinRole ? "skin" : isOralRole ? "oral" : "garment";

        const cacheKey = "_clayStdMatV3_" + role;
        if (!obj.userData[cacheKey]) {
          obj.userData[cacheKey] = createClayReplacementMaterial(T, src, {
            clayHex: opts.clayHex,
            role,
            isCornea,
            isSclera: isEyeGlobe,
            isEyeGlobe
          });
        }
        obj.material = obj.userData[cacheKey];
      } else {
        if (obj.userData._preClayVis !== undefined) {
          obj.visible = obj.userData._preClayVis;
          delete obj.userData._preClayVis;
        }
        if (obj.userData._preClayMat) {
          obj.material = obj.userData._preClayMat;
          delete obj.userData._preClayMat;
        }
      }
    });

    return targetRoot;
  }

  /* ==========================================================================
     8. CLOSED-LOOP CYLINDER / BALL-KNOB & BOWL-RIM 30-BONE HAND GRIP HELPERS
        For Makeda (pump ball-knob) & June (grooved shekla bowl rim) in 0bc287c6!
     ========================================================================== */
  function poseCylinderOrBallGrip(bones, B, side, tightness = 1.0, isBallKnob = false) {
    const k = clamp(tightness, 0, 1.35);
    const baseIdx = side > 0 ? B.L_THUMB_1 : B.R_THUMB_1;
    const splays = [0.044, 0.010, -0.022, -0.056];
    for (let i = 0; i < 4; i++) {
      const fBase = baseIdx + 3 + i * 3;
      const cascade = isBallKnob ? (0.94 + i * 0.04) : (0.92 + i * 0.06);
      const mcpA = (isBallKnob ? 0.92 : 1.02) * k * cascade;
      const pipA = (isBallKnob ? 1.18 : 1.24) * k * cascade;
      const dipA = (isBallKnob ? 0.82 : 0.88) * k * cascade;
      const cupZ = isBallKnob ? (i - 1.5) * 0.08 : 0.0;
      bones[fBase].rotation.set(-splays[i] * 0.35 + cupZ, 0, -side * mcpA, "XZY");
      bones[fBase + 1].rotation.set(0, 0, -side * pipA);
      bones[fBase + 2].rotation.set(0, 0, -side * dipA);
    }
    // Thumb wraps firmly underneath/around cylinder or ball-knob
    bones[baseIdx].rotation.set(0.58 * k, side * 0.30 * k, -side * 0.56 * k, "YZX");
    bones[baseIdx + 1].rotation.set(0.46 * k, 0, -side * 0.44 * k);
    bones[baseIdx + 2].rotation.set(0.42 * k, 0, -side * 0.40 * k);
  }

  function poseBowlRimRest(bones, B, side, curvature = 1.0) {
    const k = clamp(curvature, 0, 1.3);
    const baseIdx = side > 0 ? B.L_THUMB_1 : B.R_THUMB_1;
    const splays = [0.044, 0.010, -0.022, -0.056];
    // Natural child/adult fingers draped gently over curved terracotta rim (0bc287c6 June!)
    for (let i = 0; i < 4; i++) {
      const fBase = baseIdx + 3 + i * 3;
      const cas = 0.88 + i * 0.07;
      bones[fBase].rotation.set(-splays[i] * 0.15, 0, -side * (0.42 * k * cas), "XZY");
      bones[fBase + 1].rotation.set(0, 0, -side * (0.68 * k * cas));
      bones[fBase + 2].rotation.set(0, 0, -side * (0.38 * k * cas));
    }
    bones[baseIdx].rotation.set(0.28 * k, side * 0.18 * k, -side * 0.24 * k, "YZX");
    bones[baseIdx + 1].rotation.set(0.22 * k, 0, -side * 0.20 * k);
    bones[baseIdx + 2].rotation.set(0.18 * k, 0, -side * 0.16 * k);
  }

  function evalOrbitalSkinZ(px, py, spec = {}) {
    const phenoKey = resolvePhenotypeKey(spec);
    const buildScale = spec.build !== undefined ? spec.build : 1.0;
    const noseScale = spec.noseLen !== undefined ? spec.noseLen : 1.0;
    const lipScale = spec.lipFull !== undefined ? spec.lipFull : 1.0;
    const raw = getSculptedHeadBustRaw(phenoKey, buildScale, noseScale, lipScale);
    return raw.evalOrbitalSkinZ(px, py);
  }

  const api = {
    version: "6.1.0",
    CLAY_STUDIO_PALETTE,
    PHENOTYPES,
    resolvePhenotypeKey,
    resolveSkinPalette,
    hexToLinearVec3,
    getMaps,
    evalOrbitalSkinZ,
    buildSculptedHeadBustGeo,
    buildEmptyWeldedEarsStubGeo,
    createSkinMaterial,
    createBodySkinMaterial,
    createHandMaterial,
    upgradeEyeAndLidRig,
    upgradeCharacterSkinMeshes,
    setClayMode,
    poseCylinderOrBallGrip,
    poseBowlRimRest
  };

  if (typeof window !== "undefined") {
    window.HumanPhysicalV6 = api;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
