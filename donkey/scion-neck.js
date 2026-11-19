/* True Non-Concentric Oval V-Jaw + Cylindrical SCM Neck + 1.408m Clavicular-Sternal Bust & C2 3-Joint Skinning Engine (v5.2 Scion).
   Separates the anterior diagonal oval V-jaw hull (ca > 0) from the sleek cylindrical cervical neck column (z0 = -0.015m),
   aligns S-clavicles & suprasternal jugular notch 1:1 with osteological B.CLAV = 1.404 / B.NECK_LOW = 1.422 at y = 1.408m,
   and provides C2-smooth quintic 3-joint cervical C-curve skinning for supple +/-26 deg neck leaning.
   Exposes window.ScionNeck for donkey/human-sculpt-v3.js and donkey/characters.js. */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  // Quintic C2-continuous smootherstep for zero-kink multi-joint cervical C-curve skinning
  const smooth5 = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  const g1 = (x, c, w) => {
    const d = (x - c) / w;
    return Math.exp(-d * d);
  };
  const g2 = (x, y, cx, cy, wx, wy) => {
    const dx = (x - cx) / wx;
    const dy = (y - cy) / (wy || wx);
    return Math.exp(-(dx * dx + dy * dy));
  };
  const smoothPos = (d, k) => 0.5 * (d + Math.sqrt(d * d + k * k));

  function catmull(a, b, c, d, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  }

  function refineRings(rings, sub) {
    if (rings.length < 3 || sub <= 1) return rings;
    const keys = Object.keys(rings[0]).filter(k => k !== "p" && typeof rings[0][k] === "number");
    const get = i => rings[clamp(i, 0, rings.length - 1)];
    const out = [];
    for (let i = 0; i < rings.length - 1; i++) {
      const n = i === 0 || i === rings.length - 2 ? sub + 1 : sub;
      const A = get(i - 1), B = get(i), C = get(i + 1), D = get(i + 2);
      for (let s = 0; s < n; s++) {
        const u = s / n;
        const r = { p: [0, 1, 2].map(k => catmull(A.p[k], B.p[k], C.p[k], D.p[k], u)) };
        for (const k of keys) {
          const v = catmull(A[k], B[k], C[k], D[k], u);
          r[k] = (k === "w" || k === "f" || k === "b") ? Math.max(0.0008, v) : v;
        }
        out.push(r);
      }
    }
    out.push(rings[rings.length - 1]);
    return out;
  }

  function resolveScales(spec = {}) {
    const fem = spec.fem !== undefined ? spec.fem : 0.65;
    const build = spec.build !== undefined ? spec.build : 1.0;
    const youthSlim = (spec.scale !== undefined && spec.scale < 0.88) ? 0.965 : 1.0;
    const jawScale = lerp(1.055, 0.965, fem);
    // Athletic true-to-photo human cervical neck radius (~10.4-10.7cm full width on Imani/Hanna/June = 72-74% of 14.33cm cheekbone width; ~11.6cm on Elder!)
    const halfWNeck = lerp(0.0580, 0.0522, fem) * lerp(1.0, build, 0.30) * youthSlim;
    const neckScale = halfWNeck / 0.0535;
    return { fem, build, jawScale, neckScale, halfWNeck };
  }

  // Canonical anatomical bust cross-sections (fem = 0.65, build = 1.0; chin menton 1.512 -> jugular notch 1.408 = 10.4cm, aligned 1:1 with B.CLAV = 1.404!)
  const BUST_CROSS_SECTIONS = [
    { y: 1.265, z0: -0.013, halfW: 0.1410, f: 0.084, b: 0.094, zFront: 0.0710, zBack: -0.1070 },
    { y: 1.330, z0: -0.013, halfW: 0.1480, f: 0.091, b: 0.099, zFront: 0.0780, zBack: -0.1120 },
    { y: 1.376, z0: -0.013, halfW: 0.1390, f: 0.077, b: 0.090, zFront: 0.0640, zBack: -0.1030 },
    { y: 1.408, z0: -0.014, halfW: 0.1140, f: 0.064, b: 0.081, zFront: 0.0500, zBack: -0.0950 },
    { y: 1.432, z0: -0.015, halfW: 0.0758, f: 0.055, b: 0.070, zFront: 0.0400, zBack: -0.0850 },
    { y: 1.454, z0: -0.015, halfW: 0.0572, f: 0.051, b: 0.062, zFront: 0.0360, zBack: -0.0770 },
    { y: 1.478, z0: -0.015, halfW: 0.0542, f: 0.050, b: 0.060, zFront: 0.0350, zBack: -0.0750 },
    { y: 1.500, z0: -0.014, halfW: 0.0540, f: 0.050, b: 0.060, zFront: 0.0360, zBack: -0.0740 },
    { y: 1.516, z0: -0.013, halfW: 0.0545, f: 0.052, b: 0.063, zFront: 0.0785, zBack: -0.0760 },
    { y: 1.533, z0: -0.007, halfW: 0.0562, f: 0.063, b: 0.071, zFront: 0.0790, zBack: -0.0780 },
    { y: 1.5525, z0: 0.001, halfW: 0.0595, f: 0.0836, b: 0.084, zFront: 0.0846, zBack: -0.0830 }
  ];

  /* Unified Head-Neck-Clavicle-Thoracic Bust Rings (y = 1.258 tucked skirt .. y = 1.732 closed vertex crown).
     ANATOMICAL PROPORTION & TOPOLOGY LAWS (v5.2):
     1. Posterior/lateral cervical neck column (y = 1.454..1.533, z0 = -0.015m) is an athletic, graceful cylindrical muscular column
        (`halfWNeck ~ 0.0528..0.0540m` = 10.5..10.8cm on Imani/Hanna/June = 72..74% of cheekbone width; ~11.6cm on Elder) running cleanly
        above the concave trapezius C-curve (y = 1.454 -> 1.408m).
     2. S-clavicles & suprasternal jugular notch sit at y = 1.408m (10.4cm below chin menton 1.512m), aligned 1:1 with
        osteological joints B.CLAV = 1.404m and B.NECK_LOW = 1.422m so +/-26 deg neck leaning never kinks above the collarbone!
     3. Anterior oval V-jaw (ca > 0, y = 1.488..1.550) is unioned cleanly IN FRONT OF the cylindrical neck via
        `evalAnteriorJawDeltaZ` — ZERO square chipmunk/bulldog jowls at y = 1.515 and ZERO hourglass neck pinch! */
  function buildRawHeadNeckBustRings(spec = {}) {
    const { build, jawScale, halfWNeck } = resolveScales(spec);
    const b100 = build;
    const b70  = lerp(1.0, build, 0.70);
    const b50  = lerp(1.0, build, 0.50);
    const wClav = 0.114 * b50;

    return [
      // 1. Upper-Thoracic / Sternal / Scapular / Deltoid-Root Skin Bust (tucked cleanly underneath shirts, tanks, coats & shammas!)
      { p: [0, 1.258, -0.013], w: 0.135 * b100,                 f: 0.078,  b: 0.088, e: 0.95 }, // Inward-tucked lower bust skirt hem
      { p: [0, 1.280, -0.013], w: 0.145 * b100,                 f: 0.088,  b: 0.097, e: 0.94 }, // Lower pectoral / infrascapular bust
      { p: [0, 1.330, -0.013], w: 0.148 * b100,                 f: 0.091,  b: 0.099, e: 0.94 }, // Mid-pectoralis / sternal body
      { p: [0, 1.376, -0.013], w: 0.139 * b70,                  f: 0.077,  b: 0.090, e: 0.96 }, // Infraclavicular manubrium shelf
      { p: [0, 1.408, -0.014], w: wClav,                        f: 0.064,  b: 0.081, e: 0.98 }, // S-clavicles & suprasternal jugular notch (1.408m == B.CLAV!)
      // 2. Concave Trapezius C-Curve (1.408..1.454) -> Athletic Cylindrical Muscular SCM Neck Column (1.454..1.533)
      { p: [0, 1.432, -0.015], w: lerp(halfWNeck, wClav, 0.36), f: 0.055,  b: 0.070, e: 1.00 }, // Concave mid-trapezius C-curve slope
      { p: [0, 1.454, -0.015], w: halfWNeck * 1.055,            f: 0.051,  b: 0.062, e: 1.00 }, // Upper trapezius C-curve onset (~5.8cm below menton!)
      { p: [0, 1.478, -0.015], w: halfWNeck * 1.000,            f: 0.050,  b: 0.060, e: 1.00 }, // Mid-cervical cylindrical SCM column (72-74% cheekbone!)
      { p: [0, 1.500, -0.014], w: halfWNeck * 0.998,            f: 0.050,  b: 0.060, e: 1.00 }, // Hyoid / cervico-mental throat notch (zFront ~ +0.036m)
      { p: [0, 1.516, -0.013], w: halfWNeck * 1.006,            f: 0.052,  b: 0.063, e: 1.00 }, // Chin-level lateral/posterior neck cylinder (ZERO jowl blocks!)
      { p: [0, 1.533, -0.007], w: lerp(halfWNeck * 1.03, 0.0568 * jawScale, 0.65), f: 0.063, b: 0.071, e: 1.01 }, // Gonial / mastoid transition (zBack = -0.078m)
      // 3. C2-Smooth Oval V-Tapered Perioral & Buccal Ring Band (flush modiolus transition for split vermilion lips!)
      { p: [0, 1.544, -0.002], w: 0.0576 * jawScale,            f: 0.0795, b: 0.078, e: 1.02 }, // Lower vermilion / oval lower cheek
      { p: [0, 1.5525, 0.001], w: 0.0598 * jawScale,            f: 0.0836, b: 0.084, e: 1.03 }, // Oral rima / stomion
      { p: [0, 1.561,  0.001], w: 0.0630 * jawScale,            f: 0.0842, b: 0.089, e: 1.03 }, // Upper vermilion Cupid's bow
      { p: [0, 1.582,  0.000], w: 0.0688,                      f: 0.0840, b: 0.098, e: 1.02 }, // Subnasale / malar base
      // 4. High-Density Periorbital Ring Band (aligned 1:1 to ScionEyelids ORBIT_CUTOUT cy = 1.6158)
      { p: [0, 1.602, -0.002], w: 0.0730,                      f: 0.0840, b: 0.107, e: 1.01 }, // Infraorbital tear-trough rim
      { p: [0, 1.610, -0.003], w: 0.0740,                      f: 0.0835, b: 0.109, e: 1.00 }, // Lower palpebral zone
      { p: [0, 1.6158,-0.003], w: 0.0740,                      f: 0.0835, b: 0.111, e: 1.00 }, // Ocular globe / canthus axis (1.6158m)
      { p: [0, 1.622, -0.003], w: 0.0740,                      f: 0.0835, b: 0.111, e: 1.00 }, // Supratarsal crease zone
      { p: [0, 1.629, -0.004], w: 0.0740,                      f: 0.0840, b: 0.112, e: 1.00 }, // Upper orbital fold rim
      { p: [0, 1.644, -0.005], w: 0.0730,                      f: 0.0850, b: 0.112, e: 1.00 }, // Supraorbital brow / parietal widest
      // 5. Frontal Eminence & Cranial Dome
      { p: [0, 1.680, -0.008], w: 0.0690,                      f: 0.0820, b: 0.104, e: 1.00 }, // Frontal eminence
      { p: [0, 1.712, -0.012], w: 0.0510,                      f: 0.0610, b: 0.078, e: 1.00 }, // Upper parietal dome
      { p: [0, 1.728, -0.015], w: 0.0220,                      f: 0.0260, b: 0.032, e: 1.00 }, // Vertex crown
      { p: [0, 1.732, -0.016], w: 0.0020,                      f: 0.0020, b: 0.002, e: 1.00 }  // Closed crown pole
    ];
  }

  /* Shared C∞-Smooth Diagonal Oval V-Jaw Hull Z-Projection (unioned cleanly in front of the `halfWNeck` cylinder).
     Used identically by BOTH the seg=64 bust-head grid AND `evalFacialSkinZ` (48-seg mouthBag outer blend)
     so:
     - Anterior mandible slopes diagonally inward from crisp gonial angle (±0.053m at y=1.540) -> ±0.035m at y=1.522 ->
       rounded ±0.022m oval chin pad at y=1.511 (z = +0.0825m), tucking behind the 9.9cm neck cylinder laterally!
     - `mouthBag` (iv=7) and `headMesh` (seg=64) match to 0.0000mm with ZERO modiolus cheek trench! */
  function evalAnteriorJawDeltaZ(ax, yBase, ca, zBaseCur, rZ0, jawScale) {
    if (yBase <= 1.488 || yBase >= 1.550 || ca <= 0.0) return 0.0;
    const tJawY = smooth(1.505, 1.546, yBase);
    // Diagonal V-tapered anterior jaw half-width: soft 2.70cm rounded oval chin pad -> 3.9cm mid-jaw -> 5.75cm upper mandible
    const xJawHalf = lerp(0.0270, 0.0575, Math.pow(tJawY, 0.82)) * jawScale;
    const uJaw = ax / Math.max(0.012, xJawHalf);
    if (uJaw >= 1.18) return 0.0;

    // True Ricketts E-plane rounded pogonion (y=1.518, z ~ +0.0778m tucked naturally behind full vermilion lips!) + soft submental sweep (1.490..1.514)
    const zChinApex = 0.0762 + 0.0020 * g1(yBase, 1.518, 0.0082) - 0.0020 * g1(yBase, 1.535, 0.0058) + 0.0042 * smooth(1.528, 1.546, yBase);
    const subShelf = smooth(1.490, 1.514, yBase);
    const zMid = lerp(0.0355, zChinApex, Math.pow(subShelf, 0.82));

    const ovalProfile = Math.pow(Math.max(0.0, 1.0 - Math.pow(Math.min(1.0, uJaw), 1.84)), 0.78);
    const zWant = 0.004 + (zMid - 0.004) * ovalProfile;
    const wMand = smooth(1.489, 1.498, yBase) * (1.0 - smooth(1.538, 1.549, yBase)) * smooth(0.0, 0.16, ca);
    return smoothPos(zWant - zBaseCur, 0.0046) * wMand;
  }

  /* Evaluates full 3D anatomical displacement (dx, dy, dz) for the Cervico-Mandibular-Clavicular-Sternal Bust
     (diagonal V-jaw + crisp high gonial angle at y=1.539, ~108 deg submental plane, larynx at y=1.476,
      oblique SCM V-pillars from mastoid y=1.534 to medial clavicle y=1.409, suprasternal jugular notch at y=1.408,
      S-curved clavicles at y=1.409..1.415, supraclavicular/infraclavicular fossae, and C7/nuchal posterior relief). */
  function evalCervicalClavicularRelief(ax, sLat, yBase, ca, zBaseCur, rZ0, spec = {}) {
    const { fem, jawScale, halfWNeck } = resolveScales(spec);
    let dx = 0.0, dy = 0.0, dz = 0.0;

    // 1. Diagonal Oval Anterior Mandible + Subtle Crisp High Gonial Angle (±0.0545 * jawScale, 1.539, +0.004)
    if (yBase > 1.488 && yBase < 1.550 && ca > -0.15) {
      if (ca > 0.0) {
        dz += evalAnteriorJawDeltaZ(ax, yBase, ca, zBaseCur, rZ0, jawScale);
      }
      const gonion = g2(ax, yBase, 0.0545 * jawScale, 1.539, 0.011, 0.011) * g1(ca, 0.12, 0.24);
      dx += sLat * 0.0014 * gonion;
      dz += 0.0022 * gonion;
      dy -= 0.0010 * gonion;

      // Subtle submandibular digastric tuck strictly beneath anterior chin/jaw body (zero lateral neck pinch!)
      const subMand = g2(ax, yBase, 0.019 * jawScale, 1.504, 0.013, 0.0065) * smooth(0.45, 0.90, ca);
      dy += 0.0014 * subMand;
    }

    // 2. Anterior Cervical Column & 1.408m Clavicular/Sternal Landmarks
    if (yBase > 1.320 && yBase < 1.540 && ca > -0.25) {
      // Subtle laryngeal / thyroid cartilage prominence at (0, 1.476, +0.036) (fem-scaled)
      const larynx = g1(ax, 0, 0.0088) * g1(yBase, 1.476, 0.0090) * smooth(0.65, 1.0, ca) * lerp(0.0026, 0.0007, fem);
      dz += larynx;

      // Oblique Sternocleidomastoid (SCM) V-pillars: mastoid (±halfWNeck*0.98, 1.534, -0.014) -> medial clavicle (±0.0125, 1.409, +0.049)
      const tScm = clamp((yBase - 1.409) / (1.534 - 1.409), 0, 1);
      const xScm = lerp(0.0125, halfWNeck * 0.98, tScm);
      const caScm = lerp(0.92, -0.08, tScm);
      const scmMask = g1(ax, xScm, 0.0105) * g1(ca, caScm, 0.42) * smooth(1.403, 1.422, yBase) * (1.0 - smooth(1.520, 1.538, yBase));
      const scmStr = lerp(1.18, 0.90, fem);
      dz += 0.0034 * scmMask * Math.max(0.2, ca + 0.3) * scmStr;
      dx += sLat * 0.0012 * scmMask * scmStr;

      // Suprasternal (jugular) fossa hollow at (0, 1.408, +0.048) framed between medial clavicular heads!
      const jugHollow = g2(ax, yBase, 0.0, 1.408, 0.0135, 0.0145) * smooth(0.55, 1.0, ca);
      dz -= 0.0056 * jugHollow;

      // S-curved clavicular ridge from sternoclavicular head (±0.012, 1.409, +0.050) out to acromion (±0.116, 1.415, +0.020)
      const yClav = 1.409 + 0.006 * smooth(0.024, 0.114, ax);
      const clavEnv = smooth(0.009, 0.018, ax) * (1.0 - smooth(0.106, 0.132, ax));
      const sCurveCa = lerp(0.92, 0.28, smooth(0.020, 0.116, ax));
      const clavRidge = g1(yBase, yClav, 0.0088) * clavEnv * g1(ca, sCurveCa, 0.42);
      const supraFossa = g2(ax, yBase, 0.056, 1.423, 0.023, 0.0085) * g1(ca, 0.52, 0.35);
      const infraFossa = g2(ax, yBase, 0.074, 1.390, 0.024, 0.0115) * smooth(0.25, 0.85, ca);
      dz += 0.0044 * clavRidge - 0.0018 * supraFossa - 0.0020 * infraFossa;
      dy += 0.0016 * clavRidge;

      // Subtle midline sternal inter-pectoral furrow along manubrium/sternum (y = 1.295..1.382)
      const sternalGroove = g1(ax, 0, 0.011) * smooth(1.295, 1.325, yBase) * (1.0 - smooth(1.372, 1.395, yBase)) * smooth(0.65, 1.0, ca);
      dz -= 0.0016 * sternalGroove;
    }

    // 3. Posterior Nuchal Groove & C7 Vertebra Prominens (y = 1.420..1.535, ca < -0.45)
    if (yBase > 1.418 && yBase < 1.536 && ca < -0.45) {
      const backW = smooth(-0.45, -0.95, ca);
      const c7Bump = g1(ax, 0, 0.014) * g1(yBase, 1.440, 0.015) * backW;
      const nuchalHollow = g1(ax, 0, 0.012) * g1(yBase, 1.498, 0.022) * backW;
      dz += -0.0025 * c7Bump + 0.0020 * nuchalHollow;
    }

    return { dx, dy, dz };
  }

  /* Direct surface point query `(y, a, spec) -> [px, py, pz]` for garment collar tailoring & silhouette tests */
  function evalBustRadius(yQuery, a, spec = {}) {
    const rings = refineRings(buildRawHeadNeckBustRings(spec), 4);
    let lo = 0, hi = rings.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (rings[mid].p[1] <= yQuery) lo = mid;
      else hi = mid;
    }
    const r0 = rings[lo], r1 = rings[hi];
    const t = clamp((yQuery - r0.p[1]) / Math.max(1e-6, r1.p[1] - r0.p[1]), 0, 1);
    const z0 = lerp(r0.p[2], r1.p[2], t);
    const w = lerp(r0.w, r1.w, t);
    const f = lerp(r0.f, r1.f, t);
    const b = lerp(r0.b, r1.b, t);
    const e = lerp(r0.e || 1, r1.e || 1, t);

    const sa = Math.sin(a), ca = Math.cos(a);
    const rz = ca >= 0 ? f : b;
    const lx = Math.sign(sa) * Math.pow(Math.abs(sa), e) * w;
    const lz = Math.sign(ca) * Math.pow(Math.abs(ca), e) * rz;
    const ax = Math.abs(lx);
    const sLat = clamp(lx / 0.010, -1, 1);
    const rel = evalCervicalClavicularRelief(ax, sLat, yQuery, ca, z0 + lz, z0, spec);
    return [lx + rel.dx, yQuery + rel.dy, z0 + lz + rel.dz];
  }

  /* Spatial TMJ Mandibular Hinge Weight (strictly anterior mandible & chin/submental, NEVER neck column!) */
  function evalSpatialJawWeight(px, py, pz) {
    if (pz <= 0.004 || py >= 1.556 || py < 1.494) return 0.0;
    const ax = Math.abs(px);
    const yCut = lerp(1.5525, 1.545, smooth(0.022, 0.045, ax));
    return (1.0 - smooth(yCut - 0.004, yCut + 0.004, py))
      * smooth(0.006, 0.044, pz)
      * smooth(1.495, 1.512, py)
      * 0.95;
  }

  /* Supple C2-Continuous 3-Joint Cervical C-Curve Skinning across:
     B.HEAD (1.534), B.JAW (1.564), B.NECK_HIGH (1.480), B.NECK_LOW (1.422), B.CHEST (1.295), B.CLAV_L/R (1.404).
     - Aligned 1:1 with osteological pivots (y = 1.408 clavicles == B.CLAV = 1.404, B.NECK_LOW = 1.422, B.NECK_HIGH = 1.480, B.HEAD = 1.534)!
     - Wide overlapping quintic C2 spans (`tLow: 1.395..1.468`, `tHigh: 1.440..1.512`, `tHead: 1.488..1.542`) produce an organic
       continuous cervical C-curve on +/-26 deg leans with ZERO lollipop kink at 1.51m and ZERO collar crease!
     - `chinSkullBoost` keeps anterior chin/jaw (pz > +0.020, y > 1.504) rigid with [B.HEAD, B.JAW] so leaning/turning never warps the chin! */
  function computeBustSkinning(px, py, pz, B) {
    const ax = Math.abs(px);
    const jawW = evalSpatialJawWeight(px, py, pz);
    const rem = Math.max(0.0, 1.0 - jawW);

    // Keep anterior oval chin & mandibular body locked to [B.HEAD, B.JAW] during +/-26 deg neck lean & +/-45 deg yaw!
    const chinSkullBoost = 0.036 * smooth5(0.018, 0.056, pz) * smooth5(1.498, 1.514, py) * (1.0 - smooth5(1.538, 1.552, py));
    // Anchor lateral clavicular & acromial trapezius wings cleanly to [B.CHEST, B.CLAV_L/R]
    const latShoulderAnchor = 0.026 * smooth5(0.050, 0.114, ax) * (1.0 - smooth5(1.448, 1.485, py));
    const yEff = py + chinSkullBoost - latShoulderAnchor;

    // Wide C2-smooth quintic partition of unity: CHEST/CLAV -> NECK_LOW (1.422) -> NECK_HIGH (1.480) -> HEAD (1.534)
    const tLow  = smooth5(1.395, 1.468, yEff);
    const tHigh = smooth5(1.440, 1.512, yEff);
    const tHead = smooth5(1.488, 1.542, yEff);

    const wChestBase = 1.0 - tLow;
    const wNeckLow   = tLow * (1.0 - tHigh);
    const wNeckHigh  = tHigh * (1.0 - tHead);
    const wHead      = tHead;

    // Split thoracic/shoulder base between B.CHEST, lateral B.CLAV_L/R, and outer acromial-deltoid B.UARM_L/R (when present)
    const clavFrac = 0.58 * smooth5(0.038, 0.116, ax) * smooth5(1.345, 1.404, py) * (1.0 - smooth5(1.442, 1.478, py));
    const hasUarm = B.UARM_L !== undefined && B.UARM_R !== undefined;
    const uarmFrac = hasUarm ? (0.42 * smooth5(0.132, 0.178, ax) * smooth5(1.350, 1.375, py) * (1.0 - smooth5(1.405, 1.425, py))) : 0.0;
    const wUarm  = wChestBase * uarmFrac;
    const wClav  = wChestBase * (1.0 - uarmFrac) * clavFrac;
    const wChest = wChestBase * (1.0 - uarmFrac) * (1.0 - clavFrac);
    const bClav  = px >= 0 ? B.CLAV_L : B.CLAV_R;
    const bUarm  = hasUarm ? (px >= 0 ? B.UARM_L : B.UARM_R) : 0;

    const cands = [
      [B.HEAD,      wHead * rem],
      [B.JAW,       jawW],
      [B.NECK_HIGH, wNeckHigh * rem],
      [B.NECK_LOW,  wNeckLow * rem],
      [B.CHEST,     wChest * rem],
      [bClav,       wClav * rem],
      [bUarm,       wUarm * rem]
    ];
    cands.sort((a, b) => b[1] - a[1]);

    const w0 = cands[0][1], w1 = cands[1][1], w2 = cands[2][1], w3 = cands[3][1];
    const sum = (w0 + w1 + w2 + w3) || 1.0;
    return {
      indices: [
        w0 > 1e-5 ? cands[0][0] : 0,
        w1 > 1e-5 ? cands[1][0] : 0,
        w2 > 1e-5 ? cands[2][0] : 0,
        w3 > 1e-5 ? cands[3][0] : 0
      ],
      weights: [w0 / sum, w1 / sum, w2 / sum, w3 / sum]
    };
  }

  /* Wide 3.4cm Jaw-to-Neck Portrait Feather (`y = 1.510..1.544` along diagonal V-mandible):
     Combined with low-frequency illumination envelope normalization in `applyDualPortraitSubsurfaceShader`,
     produces a 100% invisible transition from portrait face -> oval jaw -> cylindrical neck! */
  function computePortraitFadeMask(px, py, azim, topFadeY, eyeCut) {
    const ax = Math.abs(px);
    const jawRise = 0.016 * smooth(0.022, 0.054, ax);
    const neckPortraitFade = smooth5(1.510 + jawRise, 1.538 + jawRise, py);
    return neckPortraitFade * (1.0 - smooth(topFadeY, topFadeY + 0.028, py)) * eyeCut;
  }

  function computeAnatomicalVertexAO(px, py, ca) {
    const ax = Math.abs(px);
    const fwd = Math.max(0.0, ca);
    const socketAO = g2(ax, py, 0.0300, 1.6158, 0.019, 0.012) * fwd;
    const nostrilAO = g2(ax, py, 0.0105, 1.574, 0.0058, 0.0042) * fwd;
    // Gentle anatomical submental & jugular relief shading while keeping mid-neck & chest at 1.000x canonicalSkinLin!
    const submentalAO = g1(ax, 0, 0.024) * g1(py, 1.501, 0.009) * smooth(0.35, 0.95, ca) * 0.065;
    const jugularAO = g2(ax, py, 0.0, 1.408, 0.0135, 0.0135) * smooth(0.45, 1.0, ca) * 0.065;
    const supraclavAO = g2(ax, py, 0.056, 1.423, 0.023, 0.0085) * smooth(0.20, 0.85, ca) * 0.035;
    const clavHighlight = g1(py, 1.409 + 0.005 * smooth(0.024, 0.112, ax), 0.0075)
      * smooth(0.010, 0.020, ax) * (1.0 - smooth(0.100, 0.126, ax)) * fwd * 0.018;
    const lipFlush = g1(ax, 0, 0.023) * g1(py, 1.553, 0.009) * fwd;

    // 1.000x neutral dermal base across chest, clavicles, neck, jaw & face -> <= 1% match to bare shoulder/forearm/hand!
    const baseL = 0.996 + 0.004 * smooth(1.36, 1.60, py)
      - 0.09 * socketAO
      - 0.52 * nostrilAO
      - submentalAO
      - jugularAO
      - supraclavAO
      + clavHighlight;
    return [
      baseL + 0.035 * lipFlush,
      baseL - 0.012 * lipFlush,
      baseL - 0.022 * lipFlush
    ];
  }

  /* Programmatic Silhouette Verifier (measures total halfW, anterior jaw halfW z>+0.015, zFront, zBack from y=1.595 down to y=1.275) */
  function auditFrontSilhouette(spec = {}) {
    const slices = [1.595, 1.5525, 1.540, 1.530, 1.516, 1.500, 1.478, 1.452, 1.430, 1.408, 1.376, 1.330, 1.280];
    return slices.map(y => {
      let halfW = 0;
      let antHalfW = 0;
      for (let j = 0; j <= 128; j++) {
        const p = evalBustRadius(y, (j / 128) * TAU + Math.PI, spec);
        if (Math.abs(p[0]) > halfW) halfW = Math.abs(p[0]);
        if (p[2] > 0.015 && Math.abs(p[0]) > antHalfW) antHalfW = Math.abs(p[0]);
      }
      const pF = evalBustRadius(y, 0, spec);
      const pB = evalBustRadius(y, Math.PI, spec);
      return {
        y,
        halfW: +halfW.toFixed(5),
        fullWidthCm: +(halfW * 200).toFixed(2),
        antJawFullCm: +(antHalfW * 200).toFixed(2),
        zFront: +pF[2].toFixed(5),
        zBack: +pB[2].toFixed(5)
      };
    });
  }

  const api = {
    version: "5.2.0",
    BUST_CROSS_SECTIONS,
    resolveScales,
    buildRawHeadNeckBustRings,
    evalAnteriorJawDeltaZ,
    evalCervicalClavicularRelief,
    evalBustRadius,
    evalSpatialJawWeight,
    computeBustSkinning,
    computePortraitFadeMask,
    computeAnatomicalVertexAO,
    auditFrontSilhouette
  };

  if (typeof window !== "undefined") {
    window.ScionNeck = api;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
