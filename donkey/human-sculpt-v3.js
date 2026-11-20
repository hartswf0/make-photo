/* Next-Gen Human Anatomy, 56-Bone Anatomical Skeleton, Watertight Skinned Ortho Hands,
   Donkey-Method Multi-Shell Volumetric Hair & Dual-Portrait Subsurface Face Engine (v3).
   Exposes window.HumanSculptV3 for donkey/characters.js and study/study.js. */
(function () {
  "use strict";

  // Auto-bridge human-physical-v6.js if a legacy HTML page loaded human-sculpt-v3.js without it
  if (typeof window !== "undefined" && !window.HumanPhysicalV6 && typeof document !== "undefined") {
    try {
      const scripts = document.getElementsByTagName("script");
      for (let i = scripts.length - 1; i >= 0; i--) {
        const src = scripts[i].src || "";
        const m = src.match(/^(.*\/donkey\/)human-sculpt-v3\.js(\?.*)?$/);
        if (m) {
          const v6Url = m[1] + "human-physical-v6.js" + (m[2] || "?v=v6sculpt1");
          if (typeof XMLHttpRequest !== "undefined") {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", v6Url, false);
            xhr.send(null);
            if (xhr.status >= 200 && xhr.status < 400 && xhr.responseText) {
              // eslint-disable-next-line no-new-func
              new Function(xhr.responseText)();
            }
          }
          break;
        }
      }
    } catch (_e) {
      // Graceful fallback if synchronous XHR is blocked
    }
  }

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const frac = x => x - Math.floor(x);
  const hash = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const h = (a, b) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
  };
  const fbm = (x, y, oct = 4) => {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) {
      s += a * vnoise(x * f, y * f);
      f *= 2.03;
      a *= 0.5;
    }
    return s;
  };
  const g1 = (x, c, w) => { const d = (x - c) / w; return Math.exp(-d * d); };
  const g2 = (x, y, cx, cy, wx, wy) => {
    const dx = (x - cx) / wx, dy = (y - cy) / (wy || wx);
    return Math.exp(-(dx * dx + dy * dy));
  };

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

  /* ============================================================================
     1. 56-BONE ANATOMICAL SKELETON ROSTER (+ 9 Volume / Cloth / Hair Helpers)
     56 Anatomical Osteological Bones:
       - 8 Axial S-Curve Spine & Skull: PELVIS, LUMBAR, THORAX, CHEST, NECK_LOW, NECK_HIGH, HEAD, JAW
       - 10 Upper Limb Bones: CLAV, UARM, FARM, FARM_TWIST, HAND (x2)
       - 30 Finger Phalanges: THUMB_1..3, INDEX_1..3, MID_1..3, RING_1..3, PINKY_1..3 (x2)
       - 8 Lower Limb Bones: ULEG, LLEG, FOOT, TOE (x2)
     + 9 Rig/Volume/Garment/Hair Physics Helper Bones:
       - ROOT, ELBOW_VOL_L/R, KNEE_VOL_L/R, COAT_B/L/R, HAIR_TAIL
     ============================================================================ */
  const B = {
    ROOT: 0,
    PELVIS: 1,
    LUMBAR: 2,
    THORAX: 3,
    CHEST: 4,
    NECK_LOW: 5,
    NECK_HIGH: 6,
    HEAD: 7,
    JAW: 8,

    CLAV_L: 9,
    UARM_L: 10,
    ELBOW_VOL_L: 11,
    FARM_L: 12,
    FARM_TWIST_L: 13,
    HAND_L: 14,

    CLAV_R: 15,
    UARM_R: 16,
    ELBOW_VOL_R: 17,
    FARM_R: 18,
    FARM_TWIST_R: 19,
    HAND_R: 20,

    // Left Hand 15 Phalanges (21..35)
    L_THUMB_1: 21, L_THUMB_2: 22, L_THUMB_3: 23,
    L_INDEX_1: 24, L_INDEX_2: 25, L_INDEX_3: 26,
    L_MID_1:   27, L_MID_2:   28, L_MID_3:   29,
    L_RING_1:  30, L_RING_2:  31, L_RING_3:  32,
    L_PINKY_1: 33, L_PINKY_2: 34, L_PINKY_3: 35,

    // Right Hand 15 Phalanges (36..50)
    R_THUMB_1: 36, R_THUMB_2: 37, R_THUMB_3: 38,
    R_INDEX_1: 39, R_INDEX_2: 40, R_INDEX_3: 41,
    R_MID_1:   42, R_MID_2:   43, R_MID_3:   44,
    R_RING_1:  45, R_RING_2:  46, R_RING_3:  47,
    R_PINKY_1: 48, R_PINKY_2: 49, R_PINKY_3: 50,

    // Legs & Volume Helpers (51..60)
    ULEG_L: 51, KNEE_VOL_L: 52, LLEG_L: 53, FOOT_L: 54, TOE_L: 55,
    ULEG_R: 56, KNEE_VOL_R: 57, LLEG_R: 58, FOOT_R: 59, TOE_R: 60,

    // Garment & Hair Physics (61..64)
    COAT_B: 61, COAT_L: 62, COAT_R: 63,
    HAIR_TAIL: 64,

    // Legacy compatibility aliases
    SPINE: 2,
    NECK: 5,
    ANATOMICAL_COUNT: 56,
    TOTAL_COUNT: 65
  };

  // Canonical hand phalanx bind offsets relative to B_HAND (in meters, adult scale=1) + exact manifest.json UVs
  const FINGER_BIND_SPECS = [
    { name: "index", mcp: [ 0.0015, -0.0715,  0.0245], l1: 0.0315, l2: 0.0205, l3: 0.0155, r: 0.0080, splay:  0.044, mcpU: 0.382, tipU: 0.375, mcpV: 0.448, tipV: 0.145 },
    { name: "mid",   mcp: [ 0.0022, -0.0750,  0.0082], l1: 0.0345, l2: 0.0225, l3: 0.0165, r: 0.0084, splay:  0.010, mcpU: 0.500, tipU: 0.500, mcpV: 0.440, tipV: 0.092 },
    { name: "ring",  mcp: [ 0.0014, -0.0720, -0.0082], l1: 0.0318, l2: 0.0212, l3: 0.0158, r: 0.0079, splay: -0.022, mcpU: 0.602, tipU: 0.610, mcpV: 0.448, tipV: 0.140 },
    { name: "pinky", mcp: [-0.0006, -0.0650, -0.0238], l1: 0.0255, l2: 0.0165, l3: 0.0138, r: 0.0069, splay: -0.056, mcpU: 0.684, tipU: 0.720, mcpV: 0.462, tipV: 0.244 }
  ];

  const THUMB_BIND_SPEC = {
    cmc: [-0.0085, -0.0180, 0.0220],
    mcp: [-0.0140, -0.0455, 0.0435],
    ip:  [-0.0170, -0.0705, 0.0565],
    tip: [-0.0178, -0.0925, 0.0655]
  };

  function createSkeleton56(T, build = 1.0, fem = 0.65) {
    const hipX = 0.094 * build;
    const shX = (0.184 - 0.016 * fem) * build;
    const L_THIGH = 0.40, L_SHIN = 0.39;
    const L_UARM = 0.275, L_FARM = 0.255;

    const bind = new Array(B.TOTAL_COUNT);
    const names = new Array(B.TOTAL_COUNT);
    const isHelper = new Set([
      B.ROOT, B.ELBOW_VOL_L, B.ELBOW_VOL_R, B.KNEE_VOL_L, B.KNEE_VOL_R,
      B.COAT_B, B.COAT_L, B.COAT_R, B.HAIR_TAIL
    ]);

    const def = (idx, name, x, y, z, parent) => {
      bind[idx] = [x, y, z, parent];
      names[idx] = name;
    };

    // 1. S-Curve Spine & Skull (Natural lumbar lordosis +Z, thoracic kyphosis -Z, cervical lordosis +Z)
    def(B.ROOT,      "root",       0, 0,     0,      -1);
    def(B.PELVIS,    "pelvis",     0, 0.885,  0.003, B.ROOT);
    def(B.LUMBAR,    "lumbar",     0, 1.015,  0.014, B.PELVIS);
    def(B.THORAX,    "thorax",     0, 1.155, -0.010, B.LUMBAR);
    def(B.CHEST,     "chest",      0, 1.295, -0.017, B.THORAX);
    def(B.NECK_LOW,  "neck_low",   0, 1.422, -0.010, B.CHEST);
    def(B.NECK_HIGH, "neck_high",  0, 1.480, -0.001, B.NECK_LOW);
    def(B.HEAD,      "head",       0, 1.534,  0.006, B.NECK_HIGH);
    def(B.JAW,       "jaw",        0, 1.564,  0.016, B.HEAD); // True TMJ hinge anterior to tragus

    // 2. Arms + Elbow Volume Helpers + Forearm Twist Bones
    for (const side of [1, -1]) {
      const sTag = side > 0 ? "L" : "R";
      const bClav  = side > 0 ? B.CLAV_L      : B.CLAV_R;
      const bUarm  = side > 0 ? B.UARM_L      : B.UARM_R;
      const bElbV  = side > 0 ? B.ELBOW_VOL_L : B.ELBOW_VOL_R;
      const bFarm  = side > 0 ? B.FARM_L      : B.FARM_R;
      const bTwist = side > 0 ? B.FARM_TWIST_L: B.FARM_TWIST_R;
      const bHand  = side > 0 ? B.HAND_L      : B.HAND_R;

      const ax = side * shX, az = -0.012;
      const ySh = 1.385, yElb = ySh - L_UARM, yTw = yElb - L_FARM * 0.52, yWri = yElb - L_FARM;

      def(bClav,  "clav_" + sTag,       side * 0.062 * build, 1.404, 0.008, B.CHEST);
      def(bUarm,  "uarm_" + sTag,       ax, ySh,  az, bClav);
      def(bElbV,  "elbow_vol_" + sTag,  ax, yElb, az, bUarm);
      def(bFarm,  "farm_" + sTag,       ax, yElb, az, bUarm);
      def(bTwist, "farm_twist_" + sTag, ax, yTw,  az, bFarm);
      def(bHand,  "hand_" + sTag,       ax, yWri, az, bTwist);

      // 3. 15 Finger Phalanx Bones per Hand
      const baseIdx = side > 0 ? B.L_THUMB_1 : B.R_THUMB_1;
      const tb = THUMB_BIND_SPEC;
      def(baseIdx + 0, sTag + "_thumb_1", ax + side * tb.cmc[0], yWri + tb.cmc[1], az + tb.cmc[2], bHand);
      def(baseIdx + 1, sTag + "_thumb_2", ax + side * tb.mcp[0], yWri + tb.mcp[1], az + tb.mcp[2], baseIdx + 0);
      def(baseIdx + 2, sTag + "_thumb_3", ax + side * tb.ip[0],  yWri + tb.ip[1],  az + tb.ip[2],  baseIdx + 1);

      for (let f = 0; f < 4; f++) {
        const fs = FINGER_BIND_SPECS[f];
        const fBase = baseIdx + 3 + f * 3;
        const mx = ax + side * fs.mcp[0];
        const my = yWri + fs.mcp[1];
        const mz = az + fs.mcp[2];
        const spZ1 = Math.sin(fs.splay) * fs.l1;
        const spZ2 = Math.sin(fs.splay) * (fs.l1 + fs.l2);
        def(fBase + 0, `${sTag}_${fs.name}_1`, mx, my, mz, bHand);
        def(fBase + 1, `${sTag}_${fs.name}_2`, mx, my - fs.l1, mz + spZ1, fBase + 0);
        def(fBase + 2, `${sTag}_${fs.name}_3`, mx, my - fs.l1 - fs.l2, mz + spZ2, fBase + 1);
      }
    }

    // 4. Legs, Knee Volume Helpers & Toes
    const yHip = 0.875, yKnee = yHip - L_THIGH, yAnk = yKnee - L_SHIN;
    def(B.ULEG_L,     "uleg_L",      hipX, yHip,  0.000, B.PELVIS);
    def(B.KNEE_VOL_L, "knee_vol_L",  hipX, yKnee, 0.004, B.ULEG_L);
    def(B.LLEG_L,     "lleg_L",      hipX, yKnee, 0.000, B.ULEG_L);
    def(B.FOOT_L,     "foot_L",      hipX, yAnk,  0.000, B.LLEG_L);
    def(B.TOE_L,      "toe_L",       hipX, yAnk - 0.055, 0.105, B.FOOT_L);

    def(B.ULEG_R,     "uleg_R",     -hipX, yHip,  0.000, B.PELVIS);
    def(B.KNEE_VOL_R, "knee_vol_R", -hipX, yKnee, 0.004, B.ULEG_R);
    def(B.LLEG_R,     "lleg_R",     -hipX, yKnee, 0.000, B.ULEG_R);
    def(B.FOOT_R,     "foot_R",     -hipX, yAnk,  0.000, B.LLEG_R);
    def(B.TOE_R,      "toe_R",      -hipX, yAnk - 0.055, 0.105, B.FOOT_R);

    // 5. Coat Skirt & Dynamic Hair Ponytail Bones
    def(B.COAT_B,    "coat_B",     0,             0.86, -0.11, B.PELVIS);
    def(B.COAT_L,    "coat_L",     0.13 * build,  0.86,  0.02, B.PELVIS);
    def(B.COAT_R,    "coat_R",    -0.13 * build,  0.86,  0.02, B.PELVIS);
    def(B.HAIR_TAIL, "hair_tail",  0,             1.592, -0.106, B.HEAD);

    const bones = bind.map(([x, y, z, p], idx) => {
      const b = new T.Bone();
      b.name = names[idx];
      if (p < 0) b.position.set(x, y, z);
      else b.position.set(x - bind[p][0], y - bind[p][1], z - bind[p][2]);
      b.userData.rest = b.position.clone();
      b.userData.worldBind = new T.Vector3(x, y, z);
      b.userData.isAnatomical = !isHelper.has(idx);
      b.userData.parentIdx = p;
      return b;
    });
    bind.forEach((b, i) => { if (b[3] >= 0) bones[b[3]].add(bones[i]); });

    return {
      bones,
      bind,
      hipX,
      shX,
      L_THIGH,
      L_SHIN,
      L_UARM,
      L_FARM
    };
  }

  /* ============================================================================
     2. SHARED TEXTURES_V3 LOADER, MANIFEST LANDMARK SOLVER & MOTION PRIORS
     ============================================================================ */
  let v3AssetCache = null;
  let globalDebugSkeleton = false;
  const activeCharactersSet = new Set();

  // Canonical default portrait fits (eyes at y=0.44 from top -> v=0.56, nose=0.56 -> v=0.44, mouth=0.66 -> v=0.34, chin=0.80 -> v=0.20)
  // Automatically refined to sub-pixel precision if textures_v3/manifest.json provides exact pixel landmarks!
  function solveAffineFit4D(T, pairs3DtoUV, regZ = 0.0018, regX = 0.0) {
    const A = [0, 1, 2, 3].map(() => [0, 0, 0, 0, 0, 0]);
    for (const q of pairs3DtoUV) {
      const x = [q[0], q[1], q[2], 1];
      const uTgt = q[3], vTgt = q[4], wt = q[5] || 1;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) A[i][j] += wt * x[i] * x[j];
        A[i][4] += wt * x[i] * uTgt;
        A[i][5] += wt * x[i] * vTgt;
      }
    }
    A[0][0] += regX;
    A[2][2] += regZ;
    for (let i = 0; i < 4; i++) {
      let m = i;
      for (let k = i + 1; k < 4; k++) if (Math.abs(A[k][i]) > Math.abs(A[m][i])) m = k;
      [A[i], A[m]] = [A[m], A[i]];
      const piv = Math.abs(A[i][i]) > 1e-9 ? A[i][i] : 1e-9;
      for (let k = 0; k < 4; k++) {
        if (k !== i) {
          const f = A[k][i] / piv;
          for (let j = i; j < 6; j++) A[k][j] -= f * A[i][j];
        }
      }
    }
    const U = A.map((r, i) => r[4] / r[i]);
    const V = A.map((r, i) => r[5] / r[i]);
    return {
      uVec: new T.Vector4(U[0], U[1], U[2], U[3]),
      vVec: new T.Vector4(V[0], V[1], V[2], V[3])
    };
  }

  function makeDefaultFrontFit(T, cfg = {}) {
    const eyeY = cfg.eyeY !== undefined ? cfg.eyeY : 0.438;
    const mouthY = cfg.mouthY !== undefined ? cfg.mouthY : 0.660;
    const spanEM = Math.max(0.18, mouthY - eyeY);
    const noseY = cfg.noseY !== undefined ? cfg.noseY : (eyeY + spanEM * 0.545);
    const chinY = cfg.chinY !== undefined ? cfg.chinY : clamp(mouthY + spanEM * 0.625, 0.77, 0.875);
    const eyeSpan = cfg.eyeSpan !== undefined ? cfg.eyeSpan : 0.098;
    const cheekSpan = cfg.cheekSpan !== undefined ? cfg.cheekSpan : 0.168;
    const L = [
      [ 0.0310, 1.6160, 0.074, 0.5 + eyeSpan, 1 - eyeY, 28],
      [-0.0310, 1.6160, 0.074, 0.5 - eyeSpan, 1 - eyeY, 28],
      [ 0.0000, 1.6360, 0.090, 0.500,         1 - (eyeY - spanEM * 0.20), 6],
      [ 0.0000, 1.5820, 0.112, 0.500,         1 - noseY, 14],
      [ 0.0175, 1.5790, 0.096, 0.5 + 0.050,   1 - (noseY + 0.008), 5],
      [-0.0175, 1.5790, 0.096, 0.5 - 0.050,   1 - (noseY + 0.008), 5],
      [ 0.0000, 1.5525, 0.088, 0.500,         1 - mouthY, 52],
      [ 0.0240, 1.5525, 0.082, 0.5 + 0.074,   1 - mouthY, 18],
      [-0.0240, 1.5525, 0.082, 0.5 - 0.074,   1 - mouthY, 18],
      [ 0.0000, 1.5080, 0.088, 0.500,         1 - chinY, 12],
      [ 0.0680, 1.5940, 0.042, 0.5 + cheekSpan, 1 - (eyeY + spanEM * 0.25), 6],
      [-0.0680, 1.5940, 0.042, 0.5 - cheekSpan, 1 - (eyeY + spanEM * 0.25), 6],
      [ 0.0000, 1.6820, 0.082, 0.500,         1 - (eyeY - spanEM * 0.74), 5]
    ];
    return solveAffineFit4D(T, L, 0.0020, 0.0);
  }

  function makeDefaultSideFit(T, facingLeft = true, cfg = {}) {
    const dir = facingLeft ? -1 : 1;
    const uAt = du => 0.5 + dir * du;
    const eyeY = cfg.eyeY !== undefined ? cfg.eyeY : 0.440;
    const mouthY = cfg.mouthY !== undefined ? cfg.mouthY : 0.671;
    const spanEM = Math.max(0.18, mouthY - eyeY);
    const noseY = cfg.noseY !== undefined ? cfg.noseY : (eyeY + spanEM * 0.545);
    const chinY = cfg.chinY !== undefined ? cfg.chinY : clamp(mouthY + spanEM * 0.615, 0.77, 0.875);
    const noseU = cfg.noseU !== undefined ? cfg.noseU : uAt(0.255);
    const eyeU = cfg.eyeU !== undefined ? cfg.eyeU : uAt(0.148);
    const mouthU = cfg.mouthU !== undefined ? cfg.mouthU : uAt(0.213);
    const chinU = cfg.chinU !== undefined ? cfg.chinU : uAt(0.200);
    const earU = cfg.earU !== undefined ? cfg.earU : (facingLeft ? 0.62 : 0.38);
    const earY = cfg.earY !== undefined ? cfg.earY : (eyeY + spanEM * 0.24);

    const L = [
      [0, 1.6160,  0.074, eyeU,   1 - eyeY,   26],
      [0, 1.6360,  0.090, lerp(eyeU, noseU, 0.35), 1 - (eyeY - spanEM * 0.20), 6],
      [0, 1.5820,  0.112, noseU,  1 - noseY,  14],
      [0, 1.5525,  0.088, mouthU, 1 - mouthY, 46],
      [0, 1.5080,  0.086, chinU,  1 - chinY,  12],
      [0, 1.5960, -0.008, earU,   1 - earY,   14],
      [0, 1.5320,  0.006, lerp(earU, chinU, 0.26), 1 - (chinY - 0.055), 6],
      [0, 1.6300, -0.112, cfg.occiputU ?? uAt(-0.355), 1 - 0.42, 6],
      [0, 1.4600, -0.012, earU,   1 - 0.90,   5]
    ];
    return solveAffineFit4D(T, L, 0.0, 0.004);
  }

  function makeFallbackCanvasTex(T, w, h, drawFn, srgb = false, repeat = false) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    drawFn(ctx, w, h);
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = repeat ? T.RepeatWrapping : T.ClampToEdgeWrapping;
    tex.minFilter = repeat ? T.LinearMipmapLinearFilter : T.LinearFilter;
    tex.magFilter = T.LinearFilter;
    tex.generateMipmaps = repeat;
    if (srgb && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    else tex.colorSpace = T.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function getAssetsV3(T, donkeyBaseUrl, useV3Files = true) {
    if (v3AssetCache) return v3AssetCache;
    const base = donkeyBaseUrl.endsWith("/") ? donkeyBaseUrl : donkeyBaseUrl + "/";
    const v3Dir = base + "textures_v3/";
    const v2Dir = base + "textures/";

    // Load photographic V3 plates directly via THREE.TextureLoader (mipmapped, anisotropic, zero texStorage2D resize overflow!)
    const texLoader = new T.TextureLoader();
    if (texLoader.setCrossOrigin) texLoader.setCrossOrigin("anonymous");
    const loadSmartTex = (url, w, h, fallbackFn, opts = {}) => {
      if (!useV3Files) {
        return makeFallbackCanvasTex(T, w, h, fallbackFn, Boolean(opts.srgb), Boolean(opts.repeat));
      }
      const tex = texLoader.load(url, img => {
        if (opts.onLoad) opts.onLoad(img, tex);
      });
      tex.wrapS = tex.wrapT = opts.repeat ? T.RepeatWrapping : T.ClampToEdgeWrapping;
      tex.minFilter = T.LinearMipmapLinearFilter;
      tex.magFilter = T.LinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = 4;
      if (opts.srgb && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
      else tex.colorSpace = T.NoColorSpace;
      return tex;
    };

    const neutralSkinFallback = (hexStr = "#6e4d3b") => (ctx, w, h) => {
      ctx.fillStyle = "#424242";
      ctx.fillRect(0, 0, w, h);
      const grd = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.06, w * 0.5, h * 0.5, w * 0.44);
      grd.addColorStop(0, hexStr);
      grd.addColorStop(0.82, hexStr);
      grd.addColorStop(1, "#424242");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    };

    // Procedural high-detail 4C micro-coil shell RGBA fallback + enhancer
    const drawCoilyShell = (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const img = ctx.createImageData(w, h);
      const d = img.data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const u = x / w, v = y / h;
          // Tileable multi-scale spiral curl clusters
          let maxC = 0, shade = 0.35;
          for (let k = 0; k < 2; k++) {
            const freq = k === 0 ? 18 : 34;
            const gx = u * freq, gy = v * freq;
            const ix = Math.floor(gx), iy = Math.floor(gy);
            const fx = gx - ix, fy = gy - iy;
            for (let oy = -1; oy <= 1; oy++) {
              for (let ox = -1; ox <= 1; ox++) {
                const cx = ((ix + ox + freq) % freq), cy = ((iy + oy + freq) % freq);
                const seed = cx * 37.1 + cy * 91.7 + k * 19.3;
                const px = ox + 0.2 + 0.6 * hash(seed) - fx;
                const py = oy + 0.2 + 0.6 * hash(seed + 1.7) - fy;
                const r = Math.hypot(px, py);
                const ang = Math.atan2(py, px);
                // Tight ringlet hollow center + spiral ridge!
                const ring = Math.exp(-Math.pow((r - 0.28) / 0.16, 2)) * (0.78 + 0.22 * Math.sin(ang * 2.0 + r * 18.0 + seed));
                const core = Math.exp(-Math.pow(r / 0.24, 2)) * 0.72;
                const val = Math.max(ring, core) * (0.65 + 0.35 * hash(seed + 4.2));
                if (val > maxC) {
                  maxC = val;
                  shade = 0.42 + 0.58 * ring;
                }
              }
            }
          }
          const idx = (y * w + x) * 4;
          const lum = clamp(shade * 235, 25, 250) | 0;
          d[idx] = lum; d[idx + 1] = (lum * 0.94) | 0; d[idx + 2] = (lum * 0.88) | 0;
          d[idx + 3] = clamp(Math.pow(maxC, 0.75) * 255, 0, 255) | 0;
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    // Procedural feathered hair-strand ribbon RGBA card fallback
    const drawStrandCards = (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < 240; i++) {
        const x0 = (i / 240) * w + (hash(i * 3.1) - 0.5) * 3.0;
        const tipY = h * (0.68 + 0.31 * Math.pow(hash(i * 7.3), 0.65));
        const rootLum = Math.floor(115 + 125 * hash(i * 5.7));
        const alpha = 0.38 + 0.56 * hash(i * 11.3);
        const grad = ctx.createLinearGradient(x0, 0, x0, tipY);
        grad.addColorStop(0.0, `rgba(${(rootLum * 0.65) | 0},${(rootLum * 0.60) | 0},${(rootLum * 0.56) | 0},${alpha})`);
        grad.addColorStop(0.25, `rgba(${rootLum},${(rootLum * 0.94) | 0},${(rootLum * 0.88) | 0},${alpha})`);
        grad.addColorStop(0.82, `rgba(${Math.min(255, (rootLum * 1.15) | 0)},${Math.min(255, (rootLum * 1.08) | 0)},${rootLum},${alpha * 0.85})`);
        grad.addColorStop(1.0, `rgba(${rootLum},${rootLum},${rootLum},0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.9 + 1.6 * hash(i * 2.9);
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        const wave = (hash(i * 13.1) - 0.5) * 8.0;
        ctx.bezierCurveTo(x0 + wave, tipY * 0.35, x0 - wave * 0.8, tipY * 0.70, x0 + wave * 0.5, tipY);
        ctx.stroke();
      }
    };

    // Procedural twisted loc/braid bump & albedo atlas fallback
    const drawLocsBraids = (ctx, w, h) => {
      ctx.fillStyle = "#78685c";
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) {
        const v = y / h;
        for (let x = 0; x < w; x += 2) {
          const u = x / w;
          const plait = 0.5 + 0.5 * Math.sin(v * TAU * 18 + Math.sin(u * TAU * 3) * 1.8);
          const fiber = 0.82 + 0.18 * Math.sin(u * TAU * 42 + v * 28);
          const g = clamp((0.28 + 0.64 * plait * fiber) * 255, 20, 248) | 0;
          ctx.fillStyle = `rgb(${g},${(g * 0.92) | 0},${(g * 0.85) | 0})`;
          ctx.fillRect(x, y, 2, 2);
        }
      }
    };

    // Portrait archetypes (5 Front + Left-Side pairs with pixel-measured per-archetype eyeY, stomion mouthY & calibrated linear canonicalSkinLin!)
    const archetypes = {
      imani: {
        hex: "#4a2f22", unbake: 0.47, initCanon: [0.1225, 0.0475, 0.0258],
        frontUrl: v3Dir + "imani_head_front.jpg", sideUrl: v3Dir + "imani_head_side.jpg",
        frontCalib: { eyeY: 0.438, mouthY: 0.660, eyeSpan: 0.098 },
        sideCalib:  { eyeY: 0.440, mouthY: 0.671 }
      },
      youth: {
        hex: "#4e3224", unbake: 0.47, initCanon: [0.1451, 0.0542, 0.0299],
        frontUrl: v3Dir + "youth_head_front.jpg", sideUrl: v3Dir + "youth_head_side.jpg",
        frontCalib: { eyeY: 0.438, mouthY: 0.674, eyeSpan: 0.096 },
        sideCalib:  { eyeY: 0.442, mouthY: 0.685 }
      },
      elder: {
        hex: "#523627", unbake: 0.47, initCanon: [0.0703, 0.0331, 0.0226],
        frontUrl: v3Dir + "elder_head_front.jpg", sideUrl: v3Dir + "elder_head_side.jpg",
        frontCalib: { eyeY: 0.433, mouthY: 0.706, eyeSpan: 0.100 },
        sideCalib:  { eyeY: 0.438, mouthY: 0.678 }
      },
      operator_f: {
        hex: "#9a7560", unbake: 0.54, initCanon: [0.2801, 0.1417, 0.0846],
        frontUrl: v3Dir + "operator_f_head_front.jpg", sideUrl: v3Dir + "operator_f_head_side.jpg",
        frontCalib: { eyeY: 0.434, mouthY: 0.680, eyeSpan: 0.097 },
        sideCalib:  { eyeY: 0.438, mouthY: 0.692 }
      },
      operator_m: {
        hex: "#8e6b56", unbake: 0.54, initCanon: [0.2487, 0.1163, 0.0689],
        frontUrl: v3Dir + "operator_m_head_front.jpg", sideUrl: v3Dir + "operator_m_head_side.jpg",
        frontCalib: { eyeY: 0.437, mouthY: 0.700, eyeSpan: 0.099 },
        sideCalib:  { eyeY: 0.440, mouthY: 0.667 }
      }
    };

    const sampleMidCheekRgbLin = (imgOrTex, u, vFromBottom) => {
      try {
        const el = (imgOrTex && imgOrTex.image) ? imgOrTex.image : imgOrTex;
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const cx = c.getContext("2d");
        cx.drawImage(el, 0, 0, 64, 64);
        const px = clamp(Math.floor(u * 64), 1, 61);
        const py = clamp(Math.floor((1 - vFromBottom) * 64), 1, 61);
        const d = cx.getImageData(px - 1, py - 1, 3, 3).data;
        let sr = 0, sg = 0, sb = 0, cnt = 0;
        for (let k = 0; k < d.length; k += 4) {
          sr += Math.pow(Math.max(0.001, d[k] / 255), 2.2);
          sg += Math.pow(Math.max(0.001, d[k + 1] / 255), 2.2);
          sb += Math.pow(Math.max(0.001, d[k + 2] / 255), 2.2);
          cnt++;
        }
        sr /= cnt; sg /= cnt; sb /= cnt;
        return {
          r: sr, g: sg, b: sb,
          lum: Math.max(0.012, sr * 0.299 + sg * 0.587 + sb * 0.114)
        };
      } catch (_e) {
        return { r: 0.095, g: 0.045, b: 0.028, lum: 0.060 };
      }
    };

    const hexToLinVec3 = (hexStr, scale = 1.0) => {
      // Parse hex directly in sRGB [0..1] -> pow(2.2) linear so Three.js ColorManagement never double-gammas!
      const h = String(hexStr || "#4a2f22").replace("#", "");
      const num = parseInt(h, 16) || 0x4a2f22;
      const sr = ((num >> 16) & 255) / 255;
      const sg = ((num >> 8) & 255) / 255;
      const sb = (num & 255) / 255;
      return new T.Vector3(
        Math.pow(Math.max(0.001, sr), 2.2) * scale,
        Math.pow(Math.max(0.001, sg), 2.2) * scale,
        Math.pow(Math.max(0.001, sb), 2.2) * scale
      );
    };

    const portraits = {};
    for (const key of Object.keys(archetypes)) {
      const a = archetypes[key];
      const fFit = makeDefaultFrontFit(T, a.frontCalib);
      const sFit = makeDefaultSideFit(T, true, a.sideCalib);
      const sideLumScale = { value: 1.0 };
      const initVec = new T.Vector3(a.initCanon[0], a.initCanon[1], a.initCanon[2]);
      const canonicalSkinLin = { value: initVec.clone() };
      const cheekSkinLin = { value: initVec.clone() };
      const orbitalSkinLin = { value: initVec.clone() };
      const lidListeners = [];
      let fLum = null, sLum = null;
      const syncLum = () => {
        if (fLum !== null && sLum !== null) {
          sideLumScale.value = lerp(1.0, clamp(fLum / sLum, 0.72, 1.38), 0.86);
        }
      };
      const hasV6 = typeof window !== "undefined" && Boolean(window.HumanPhysicalV6);
      portraits[key] = {
        front: hasV6
          ? makeFallbackCanvasTex(T, 32, 32, neutralSkinFallback(a.hex))
          : loadSmartTex(a.frontUrl, 256, 256, neutralSkinFallback(a.hex), {
              onLoad: texOrImg => {
                const p1L = sampleMidCheekRgbLin(texOrImg, 0.385, 0.435);
                const p1R = sampleMidCheekRgbLin(texOrImg, 0.615, 0.435);
                const p2L = sampleMidCheekRgbLin(texOrImg, 0.415, 0.365);
                const p2R = sampleMidCheekRgbLin(texOrImg, 0.585, 0.365);
                const p3L = sampleMidCheekRgbLin(texOrImg, 0.440, 0.650);
                const p3R = sampleMidCheekRgbLin(texOrImg, 0.560, 0.650);

                const mixSpec = (aV, bV) => lerp(Math.min(aV, bV), 0.5 * (aV + bV), 0.42);
                const rawR = 0.44 * mixSpec(p1L.r, p1R.r) + 0.34 * mixSpec(p2L.r, p2R.r) + 0.22 * mixSpec(p3L.r, p3R.r);
                const rawG = 0.44 * mixSpec(p1L.g, p1R.g) + 0.34 * mixSpec(p2L.g, p2R.g) + 0.22 * mixSpec(p3L.g, p3R.g);
                const rawB = 0.44 * mixSpec(p1L.b, p1R.b) + 0.34 * mixSpec(p2L.b, p2R.b) + 0.22 * mixSpec(p3L.b, p3R.b);

                const unbake = a.unbake || 0.50;
                const hLin = hexToLinVec3(a.hex, 1.05);
                const cR = Math.max(0.002, 0.82 * (rawR * unbake) + 0.18 * hLin.x);
                const cG = Math.max(0.002, 0.82 * (rawG * unbake) + 0.18 * hLin.y);
                const cB = Math.max(0.002, 0.82 * (rawB * unbake) + 0.18 * hLin.z);

                fLum = 0.5 * (p1L.lum + p1R.lum);
                canonicalSkinLin.value.set(cR, cG, cB);
                cheekSkinLin.value.set(cR, cG, cB);
                orbitalSkinLin.value.set(cR, cG, cB);
                for (let i = 0; i < lidListeners.length; i++) lidListeners[i](canonicalSkinLin.value);
                syncLum();
              }
            }),
        side: hasV6
          ? makeFallbackCanvasTex(T, 32, 32, neutralSkinFallback(a.hex))
          : loadSmartTex(a.sideUrl, 256, 256, neutralSkinFallback(a.hex), {
              onLoad: texOrImg => {
                const cs = sampleMidCheekRgbLin(texOrImg, 0.46, 0.46);
                sLum = cs.lum;
                syncLum();
              }
            }),
        frontU: fFit.uVec,
        frontV: fFit.vVec,
        sideU:  sFit.uVec,
        sideV:  sFit.vVec,
        sideLumScale,
        canonicalSkinLin,
        canonicalSkinLinVec: canonicalSkinLin.value,
        cheekSkinLin,
        orbitalSkinLin,
        lidListeners,
        sideToneScale: new T.Vector3(1, 1, 1)
      };
    }

    // Dorsal & Palmar Photographic Hand Plates + UV Landmark Mapping
    const handDorsal = loadSmartTex(v3Dir + "hand_dorsal.jpg", 256, 256, neutralSkinFallback("#6b4a38"));
    const handPalmar = loadSmartTex(v3Dir + "hand_palmar.jpg", 256, 256, neutralSkinFallback("#855f4b"));
    // uHandRect: (uCenter, vWrist, uScale, vFingerTip) — auto-calibrated from manifest.json if present!
    const handUvUniform = { value: new T.Vector4(0.50, 0.84, 0.46, 0.14) };

    // Volumetric Hair Maps
    const hairCoilyShell = loadSmartTex(v3Dir + "hair_coily_shell.png", 256, 256, drawCoilyShell, { srgb: false, repeat: true });
    hairCoilyShell.wrapS = hairCoilyShell.wrapT = T.RepeatWrapping;
    const proceduralCoilNoise = makeFallbackCanvasTex(T, 256, 256, drawCoilyShell, false, true);

    const hairStrandCards = loadSmartTex(v3Dir + "hair_strand_cards.png", 256, 256, drawStrandCards, { srgb: false, repeat: false });
    const proceduralStrandCards = makeFallbackCanvasTex(T, 256, 256, drawStrandCards, false, false);

    const hairLocsBraids = loadSmartTex(v3Dir + "hair_locs_braids.jpg", 256, 256, drawLocsBraids, { srgb: false, repeat: true });
    hairLocsBraids.wrapS = hairLocsBraids.wrapT = T.RepeatWrapping;

    // Photorealistic Imani Full-Body Garment Plates (replacing v2 comic sketch!)
    const platesImaniPhoto = {
      front: loadSmartTex(v3Dir + "imani_photo_front.jpg", 256, 512, neutralSkinFallback("#4b4f4a")),
      side:  loadSmartTex(v3Dir + "imani_photo_side.jpg",  256, 512, neutralSkinFallback("#4b4f4a")),
      back:  loadSmartTex(v3Dir + "imani_photo_back.jpg",  256, 512, neutralSkinFallback("#4b4f4a")),
      head:  portraits.imani.front
    };

    // High-res 512x512 Lifelike Human Sclera + High-Contrast Radial Iris + Corneal Catchlight Textures
    const makeRealisticEyeTex = (irisOuterHex, irisMidHex, irisInnerHex) => makeFallbackCanvasTex(T, 512, 512, (ctx, s) => {
      // Clean warm off-white human ivory sclera (#f2ece1) across the visible palpebral zone (zero muddy brown cataract!)
      ctx.fillStyle = "#f2ece1";
      ctx.fillRect(0, 0, s, s);
      const sg = ctx.createRadialGradient(256, 256, 96, 256, 256, 250);
      sg.addColorStop(0.0, "rgba(242,236,225,0)");
      sg.addColorStop(0.52, "rgba(224,205,192,0.26)");
      sg.addColorStop(0.84, "rgba(186,150,136,0.52)");
      sg.addColorStop(1.0, "rgba(128,92,80,0.75)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, s, s);

      // Subtle delicate episcleral vessels strictly in far medial/lateral periphery
      for (let i = 0; i < 26; i++) {
        const a = hash(i * 2.7) * TAU;
        if (Math.abs(Math.sin(a)) > 0.48) continue;
        ctx.strokeStyle = "rgba(182,88,76,0.13)";
        ctx.lineWidth = 0.7 + hash(i) * 0.6;
        ctx.beginPath();
        const r0 = 104 + hash(i + 1.1) * 24, r1 = 165 + hash(i + 2.3) * 60;
        ctx.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0);
        ctx.quadraticCurveTo(
          256 + Math.cos(a + 0.08) * ((r0 + r1) * 0.5),
          256 + Math.sin(a - 0.06) * ((r0 + r1) * 0.5),
          256 + Math.cos(a) * r1,
          256 + Math.sin(a) * r1
        );
        ctx.stroke();
      }

      // Soft upper-eyelid ambient occlusion strictly above equatorial palpebral opening (y < 224)
      const uShade = ctx.createLinearGradient(0, 56, 0, 224);
      uShade.addColorStop(0.0, "rgba(32,22,18,0.56)");
      uShade.addColorStop(0.62, "rgba(48,34,28,0.20)");
      uShade.addColorStop(1.0, "rgba(48,34,28,0)");
      ctx.fillStyle = uShade;
      ctx.fillRect(0, 0, s, 226);

      // Equirectangular 1:2 spherical aspect compensation at equator so iris & pupil map 100% circular!
      // On r=10.8mm eyeball, R_IRIS=52 px -> 12.2mm true anatomical human iris diameter!
      ctx.save();
      ctx.translate(256, 256);
      ctx.scale(1, 2);
      const R_IRIS = 52;
      const ig = ctx.createRadialGradient(0, 1.5, 10, 0, 0, R_IRIS);
      ig.addColorStop(0.0, "#040303");
      ig.addColorStop(0.32, irisInnerHex);
      ig.addColorStop(0.68, irisMidHex);
      ig.addColorStop(0.87, irisOuterHex);
      ig.addColorStop(0.96, "#080504"); // Razor-crisp dark limbal ring!
      ig.addColorStop(1.0, "rgba(18,12,10,0)");
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.arc(0, 0, R_IRIS, 0, TAU); ctx.fill();

      // Radial iris stroma crypts & collarette fibers
      for (let i = 0; i < 112; i++) {
        const a = (i / 112) * TAU + (hash(i) - 0.5) * 0.04;
        const bright = i % 3 === 0;
        ctx.strokeStyle = bright ? "rgba(204,146,96,0.28)" : "rgba(14,8,5,0.34)";
        ctx.lineWidth = 0.75 + hash(i * 1.9) * 0.85;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 18.5, Math.sin(a) * 18.5);
        ctx.lineTo(Math.cos(a + (hash(i * 4.1) - 0.5) * 0.08) * 46.5, Math.sin(a) * 46.5);
        ctx.stroke();
      }
      // Concave lower-iris warm caustic lift
      const cg = ctx.createRadialGradient(4, 15, 3, 4, 15, 30);
      cg.addColorStop(0, "rgba(238,182,126,0.32)");
      cg.addColorStop(1, "rgba(238,182,126,0)");
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(4, 13, 30, 0, TAU); ctx.fill();

      // Deep velvet jet-black pupil (4.4mm anatomical diameter)
      ctx.fillStyle = "#010102";
      ctx.beginPath(); ctx.arc(0, 0, 18.5, 0, TAU); ctx.fill();

      // Crisp living corneal window specular catchlight + subtle secondary sky pin-reflex!
      ctx.fillStyle = "rgba(255,253,248,0.88)";
      ctx.beginPath();
      ctx.ellipse(-14.5, -13.5, 5.4, 4.0, -0.35, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(245,248,255,0.42)";
      ctx.beginPath();
      ctx.arc(13.0, 11.5, 2.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }, true, false);

    const eyeTexDark = makeRealisticEyeTex("#22120a", "#58341d", "#341c0f");
    const eyeTexHazel = makeRealisticEyeTex("#281b10", "#76522e", "#4a3118");

    // Curved feathered 3D eyelash fan alpha texture
    const eyelashTex = makeFallbackCanvasTex(T, 256, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(14,10,9,0.92)";
      ctx.fillRect(0, 0, w, 7);
      for (let i = 0; i < 42; i++) {
        const u = (i + 0.5) / 42;
        const env = Math.sin(u * Math.PI);
        if (env < 0.08) continue;
        const x0 = u * w + (hash(i * 3.7) - 0.5) * 2.2;
        const len = h * (0.34 + 0.62 * Math.pow(env, 0.7) * (0.82 + 0.32 * hash(i * 5.1)));
        const splay = (u - 0.5) * 14.0 + (hash(i * 9.1) - 0.5) * 3.5;
        const g = ctx.createLinearGradient(x0, 3, x0 + splay, len);
        g.addColorStop(0.0, "rgba(12,9,8,0.96)");
        g.addColorStop(0.68, "rgba(18,13,11,0.78)");
        g.addColorStop(1.0, "rgba(22,16,14,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.35 + 0.8 * env;
        ctx.beginPath();
        ctx.moveTo(x0, 2);
        ctx.quadraticCurveTo(x0 + splay * 0.45, len * 0.55, x0 + splay, len);
        ctx.stroke();
      }
    }, true, false);

    const corneaMat = new T.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.14,
      roughness: 0.018,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.012,
      ior: 1.376,
      reflectivity: 0.96,
      depthWrite: false
    });

    const caruncleMat = new T.MeshPhysicalMaterial({
      color: 0x6e3a34,
      roughness: 0.26,
      clearcoat: 0.78,
      clearcoatRoughness: 0.10
    });

    const tearMeniscusMat = new T.MeshPhysicalMaterial({
      color: 0xd8e4ea,
      transparent: true,
      opacity: 0.14,
      roughness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      depthWrite: false
    });

    const eyelashMat = new T.MeshStandardMaterial({
      map: eyelashTex,
      color: 0x120d0b,
      roughness: 0.65,
      alphaTest: 0.18,
      alphaToCoverage: true,
      transparent: false,
      side: T.DoubleSide
    });

    const motionPriors = { loaded: false, data: null };

    // Asynchronously load manifest.json & video_motion_priors.json when useV3Files is enabled
    if (useV3Files && typeof fetch === "function") {
      fetch(v3Dir + "manifest.json")
        .then(r => (r.ok ? r.json() : null))
        .then(man => {
          if (!man) return;
          const pMeta = man.portraits || man.heads || man;
          for (const key of Object.keys(portraits)) {
            const entry = pMeta[key] || pMeta[key + "_head"] || null;
            if (!entry) continue;
            const aCal = archetypes[key] || {};
            const fn = entry.front_landmarks_norm;
            if (fn) {
              // Preserve pixel-measured per-archetype eyeY & mouthY so generic 0.66 in manifest.json never misregisters lips!
              const fEyeY = (aCal.frontCalib && aCal.frontCalib.eyeY) ?? fn.eye_line_y ?? 0.438;
              const fMouthY = (aCal.frontCalib && aCal.frontCalib.mouthY) ?? (fn.mouth_seam ? fn.mouth_seam[1] : 0.66);
              const eyeSpan = (aCal.frontCalib && aCal.frontCalib.eyeSpan)
                ?? ((fn.pupil_right && fn.pupil_left) ? Math.abs(fn.pupil_right[0] - fn.pupil_left[0]) * 0.5 : 0.098);
              const fFit = makeDefaultFrontFit(T, {
                eyeY: fEyeY,
                mouthY: fMouthY,
                eyeSpan
              });
              portraits[key].frontU.copy(fFit.uVec);
              portraits[key].frontV.copy(fFit.vVec);
            }
            const sn = entry.side_landmarks_norm;
            if (sn) {
              const sEyeY = (aCal.sideCalib && aCal.sideCalib.eyeY) ?? (sn.eye_pupil ? sn.eye_pupil[1] : 0.44);
              const sMouthY = (aCal.sideCalib && aCal.sideCalib.mouthY) ?? (sn.mouth_corner ? sn.mouth_corner[1] : 0.671);
              const sFit = makeDefaultSideFit(T, true, {
                eyeU: sn.eye_pupil ? sn.eye_pupil[0] : 0.352,
                eyeY: sEyeY,
                noseU: sn.nose_tip ? sn.nose_tip[0] : 0.245,
                mouthU: sn.mouth_corner ? sn.mouth_corner[0] : 0.287,
                mouthY: sMouthY,
                chinU: sn.chin_bottom ? sn.chin_bottom[0] : 0.300,
                earU: sn.ear_canal ? sn.ear_canal[0] : 0.62,
                occiputU: sn.occiput_back ? sn.occiput_back[0] : 0.865
              });
              portraits[key].sideU.copy(sFit.uVec);
              portraits[key].sideV.copy(sFit.vVec);
            }
          }
          const mpFile = typeof man.motion_priors_file === "string" ? man.motion_priors_file : "video_motion_priors.json";
          fetch(v3Dir + mpFile)
            .then(r => (r.ok ? r.json() : null))
            .then(mp => { if (mp) { motionPriors.loaded = true; motionPriors.data = mp; } })
            .catch(() => {});
        })
        .catch(() => {});
    }

    v3AssetCache = {
      v2Dir,
      v3Dir,
      portraits,
      handDorsal,
      handPalmar,
      handUvUniform,
      hairCoilyShell,
      proceduralCoilNoise,
      hairStrandCards,
      proceduralStrandCards,
      hairLocsBraids,
      platesImaniPhoto,
      eyeMatDark: new T.MeshStandardMaterial({ map: eyeTexDark, color: 0xd8cfc3, roughness: 0.22, metalness: 0.0 }),
      eyeMatHazel: new T.MeshStandardMaterial({ map: eyeTexHazel, color: 0xd8cfc3, roughness: 0.22, metalness: 0.0 }),
      corneaMat,
      caruncleMat,
      tearMeniscusMat,
      eyelashMat,
      motionPriors
    };
    return v3AssetCache;
  }

  function selectPortraitArchetype(spec, assetsV3) {
    const scale = spec.scale || 1.0;
    const fem = spec.fem !== undefined ? spec.fem : 0.65;
    const id = (spec.id || "").toLowerCase();
    const hair = spec.hair || "croppedCoily";
    if (scale < 0.88 || id.indexOf("june") >= 0 || id.indexOf("child") >= 0 || id.indexOf("yared") >= 0) {
      return assetsV3.portraits.youth;
    }
    if (id.indexOf("op_f") >= 0 || id.indexOf("hanna") >= 0 || id === "tess" || id === "tess_sanc" || hair === "ponytail" || hair === "silverSwept") {
      return assetsV3.portraits.operator_f;
    }
    if (id.indexOf("op_m") >= 0 || id.indexOf("daniel") >= 0 || hair === "glassesCrop") {
      return assetsV3.portraits.operator_m;
    }
    if (fem < 0.42) {
      return assetsV3.portraits.elder;
    }
    return assetsV3.portraits.imani;
  }

  /* ============================================================================
     3. CRANIO-MANDIBULAR SCULPTED HEAD (seg = 64) + SPLIT-LIP ORAL CAVITY +
        FLUSH PALPEBRAL EYELIDS + ROUNDED EARS + HIGH-CONTRAST WET EYES (v4)
     ============================================================================ */
  function buildCranioMandibularHeadGeo(T, spec, B) {
    if (typeof window !== "undefined" && window.HumanPhysicalV6 && typeof window.HumanPhysicalV6.buildSculptedHeadBustGeo === "function") {
      return window.HumanPhysicalV6.buildSculptedHeadBustGeo(T, spec || {}, B);
    }
    const noseLen = spec.noseLen || 1.0;
    const lipFull = spec.lipFull !== undefined ? spec.lipFull : 1.0;
    const fem = spec.fem !== undefined ? spec.fem : 0.65;
    const SN = typeof window !== "undefined" ? window.ScionNeck : null;
    const SE = typeof window !== "undefined" ? window.ScionEyelids : null;
    const SG = typeof window !== "undefined" ? window.ScionEyeGlobe : null;
    const useScionEyes = Boolean(SE && SG);
    const orbitCut = (SE && SE.ORBIT_CUTOUT) || { cx: 0.0300, cy: 1.6158, rx: 0.0215, ry: 0.0135, omitThreshold: 0.88 };

    const jawScale = SN ? SN.resolveScales(spec).jawScale : lerp(1.06, 0.94, fem);
    const neckScale = SN ? SN.resolveScales(spec).neckScale : lerp(1.07, 0.95, fem);

    // Delegate non-concentric cranio-cervical-clavicular-sternal bust rings (y = 1.258..1.732) to ScionNeck when present!
    const rawHeadRings = SN ? SN.buildRawHeadNeckBustRings(spec) : [
      { p: [0, 1.380, -0.012], w: 0.108,            f: 0.078,  b: 0.086, e: 1.00 },
      { p: [0, 1.414, -0.013], w: 0.084,            f: 0.065,  b: 0.073, e: 1.00 },
      { p: [0, 1.450, -0.013], w: 0.064 * neckScale, f: 0.058, b: 0.063, e: 1.00 },
      { p: [0, 1.486, -0.011], w: 0.059 * neckScale, f: 0.056, b: 0.061, e: 1.02 },
      { p: [0, 1.506, -0.010], w: 0.057 * neckScale, f: 0.052, b: 0.064, e: 1.00 },
      { p: [0, 1.526, -0.006], w: 0.058 * neckScale, f: 0.062, b: 0.074, e: 1.01 },
      { p: [0, 1.544,  0.001], w: 0.059 * jawScale, f: 0.084,  b: 0.080, e: 1.05 },
      { p: [0, 1.5525, 0.002], w: 0.061 * jawScale, f: 0.085,  b: 0.084, e: 1.06 },
      { p: [0, 1.561,  0.001], w: 0.064 * jawScale, f: 0.085,  b: 0.089, e: 1.05 },
      { p: [0, 1.582,  0.000], w: 0.070,            f: 0.084,  b: 0.098, e: 1.03 },
      { p: [0, 1.602, -0.002], w: 0.073,            f: 0.084,  b: 0.107, e: 1.01 },
      { p: [0, 1.610, -0.003], w: 0.074,            f: 0.0835, b: 0.109, e: 1.00 },
      { p: [0, 1.6158,-0.003], w: 0.074,            f: 0.0835, b: 0.111, e: 1.00 },
      { p: [0, 1.622, -0.003], w: 0.074,            f: 0.0835, b: 0.111, e: 1.00 },
      { p: [0, 1.629, -0.004], w: 0.074,            f: 0.084,  b: 0.112, e: 1.00 },
      { p: [0, 1.644, -0.005], w: 0.073,            f: 0.085,  b: 0.112, e: 1.00 },
      { p: [0, 1.680, -0.008], w: 0.069,            f: 0.082,  b: 0.104, e: 1.00 },
      { p: [0, 1.712, -0.012], w: 0.051,            f: 0.061,  b: 0.078, e: 1.00 },
      { p: [0, 1.728, -0.015], w: 0.022,            f: 0.026,  b: 0.032, e: 1.00 },
      { p: [0, 1.732, -0.016], w: 0.002,            f: 0.002,  b: 0.002, e: 1.00 }
    ];
    const rings = refineRings(rawHeadRings, 4);

    const seg = 64, n = rings.length, cols = seg + 1;
    const pos = [], uv = [], col = [], si = [], sw = [], faceMeta = [], facsMeta = [], idx = [];

    const hairStyle = spec.hair || "croppedCoily";
    const hasWrapOrHat = hairStyle === "turban" || hairStyle === "shashWrap" || hairStyle === "feltHat" || hairStyle === "hood";
    const topFadeY = hasWrapOrHat ? 1.662 : 1.692;

    // Shared spatial jaw skinning evaluator for outer cheek/chin/mandible continuity
    const evalSpatialJawWeight = (px, py, pz) => {
      if (SN) return SN.evalSpatialJawWeight(px, py, pz);
      if (pz <= 0.002 || py >= 1.556 || py < 1.494) return 0.0;
      const ax = Math.abs(px);
      const yCut = lerp(1.5525, 1.545, smooth(0.024, 0.046, ax));
      return (1.0 - smooth(yCut - 0.004, yCut + 0.004, py)) * smooth(0.002, 0.046, pz) * smooth(1.496, 1.512, py) * 0.95;
    };

    for (let i = 0; i < n; i++) {
      const r = rings[i], e = r.e || 1.0, v = i / Math.max(1, n - 1);
      const yBase = r.p[1];
      for (let j = 0; j <= seg; j++) {
        // Place UV/index seam at -Z (back of skull under hair) so +Z nose/lips/neck/sternum are 100% seamless!
        const a = (j / seg) * TAU + Math.PI, sa = Math.sin(a), ca = Math.cos(a);
        const rz = ca >= 0 ? r.f : r.b;
        let lx = Math.sign(sa) * Math.pow(Math.abs(sa), e) * r.w;
        let lz = Math.sign(ca) * Math.pow(Math.abs(ca), e) * rz;
        let ly = 0;

        const ax = Math.abs(lx);
        const sLat = clamp(lx / 0.010, -1, 1);

        // 1 & 2. Non-Concentric Mandibular Horseshoe + Submental Plane + SCM V-Pillars + Jugular Fossa + S-Clavicles
        if (SN) {
          const rel = SN.evalCervicalClavicularRelief(ax, sLat, yBase, ca, r.p[2] + lz, r.p[2], spec);
          lx += rel.dx;
          ly += rel.dy;
          lz += rel.dz;
        } else {
          if (yBase > 1.488 && yBase < 1.548 && ca > 0.0) {
            const archExp = lerp(3.0, 1.45, smooth(1.508, 1.542, yBase));
            const archCa = Math.pow(ca, archExp);
            const yBorder = 1.5035 + 0.0295 * Math.pow(smooth(0.010, 0.053 * jawScale, ax), 1.15);
            const subRamp = smooth(yBorder - 0.0095, yBorder + 0.0085, yBase) * (1.0 - smooth(1.538, 1.547, yBase));
            const zWant = r.p[2] + (0.0845 - r.p[2]) * archCa;
            if (zWant > r.p[2] + lz) lz += (zWant - (r.p[2] + lz)) * subRamp;
          }
          if (yBase < 1.515 && ca > -0.25) {
            const scmLine = 0.014 + 0.038 * smooth(1.405, 1.508, yBase);
            const scm = g1(ax, scmLine, 0.013) * smooth(1.398, 1.492, yBase) * (1 - smooth(1.492, 1.522, yBase)) * smooth(0.05, 0.78, ca);
            lz += 0.0038 * scm;
            lx += sLat * 0.0022 * scm;
            const notch = g1(ax, 0, 0.015) * g1(yBase, 1.400, 0.016) * smooth(0.55, 1.0, ca);
            lz -= 0.0052 * notch;
          }
        }

        // 3. Detailed Anterior Facial Anatomy
        if (ca > -0.35) {
          const latOrbitalWrap = g2(ax, yBase, 0.0422, 1.616, 0.0062, 0.0085) * smooth(0.25, 0.85, ca);
          const tearTrough = g2(ax, yBase, 0.029, 1.603, 0.013, 0.0035) * smooth(0.35, 0.90, ca);
          if (useScionEyes) {
            // Keep pre-normal headMesh 100% smooth on exact evalOrbitalSkinZ so outer boundary normals match ScionEyelids tv=1.0 1:1;
            // inner socket & mouth apron Z-recesses are applied AFTER computeVertexNormals()!
            lz += 0.0034 * latOrbitalWrap - 0.0012 * tearTrough;
          } else {
            const dxE = (ax - 0.0310) / 0.0124;
            const dyE = (yBase - 1.6160) / 0.0056;
            const socketRecess = (1.0 - smooth(0.55, 1.22, Math.hypot(dxE, dyE))) * smooth(0.35, 0.92, ca);
            lz += -0.0220 * socketRecess + 0.0034 * latOrbitalWrap - 0.0012 * tearTrough;
          }

          // Supraorbital brow ridge & glabella
          const brow = g2(ax, yBase, 0.029, 1.635, 0.028, 0.0095) * smooth(0.28, 0.92, ca);
          const glabella = g1(ax, 0, 0.012) * g1(yBase, 1.632, 0.009) * smooth(0.65, 1.0, ca);
          lz += (0.0078 * brow + 0.0045 * glabella) * lerp(1.15, 0.88, fem);

          // Temporal hollow behind lateral orbital rim
          const temple = g2(ax, yBase, 0.066, 1.628, 0.016, 0.022) * g1(ca, 0.25, 0.35);
          lx -= sLat * 0.0042 * temple;

          // Smooth rounded anatomical nasal dorsum & pronasale ball
          const nasionNotch = g1(ax, 0, 0.014) * g1(yBase, 1.621, 0.007) * smooth(0.60, 1.0, ca);
          const bridge = g1(ax, 0, 0.0125) * g1(yBase, 1.602, 0.019) * smooth(0.55, 0.98, ca);
          const noseTip = g1(ax, 0, 0.0148) * g1(yBase, 1.583, 0.0145) * smooth(0.62, 1.0, ca);
          const columella = g1(ax, 0, 0.0075) * g1(yBase, 1.572, 0.0065) * smooth(0.62, 1.0, ca);
          const alar = g2(ax, yBase, 0.0162, 1.579, 0.0095, 0.0085) * smooth(0.45, 0.96, ca);
          const nostrilHole = g2(ax, yBase, 0.0102, 1.574, 0.0048, 0.0035) * smooth(0.60, 1.0, ca);
          lz += (-0.0032 * nasionNotch + 0.0112 * bridge + 0.0168 * noseTip + 0.0085 * columella + 0.0088 * alar) * noseLen;
          ly += (-0.0010 * noseTip + 0.0022 * nostrilHole);
          lz -= 0.0042 * nostrilHole;
          lx += sLat * 0.0038 * alar;

          // Zygomatic arch & malar cheekbone prominence + gentle high-buccal taper (zero horizontal cheek crease!)
          const malar = g2(ax, yBase, 0.052, 1.594, 0.020, 0.016) * smooth(-0.05, 0.72, ca);
          const buccalHollow = g2(ax, yBase, 0.054, 1.560, 0.019, 0.019) * smooth(0.05, 0.58, ca);
          lx += sLat * (0.0052 * malar - 0.0018 * buccalHollow);
          lz += 0.0055 * malar - 0.0014 * buccalHollow;

          // Nasolabial fold crease
          const nlLine = 0.019 + (1.578 - yBase) * 0.34;
          const nlFold = g1(ax, nlLine, 0.0055) * smooth(1.546, 1.578, yBase) * (1 - smooth(1.578, 1.586, yBase)) * smooth(0.4, 0.9, ca);
          lz -= 0.0018 * nlFold;

          // Philtrum dimple, Soft Rounded Upper/Lower Vermilion Lips & Compact Oral Commissures (zero lateral cheek trench!)
          const philtrum = g1(ax, 0, 0.0055) * g1(yBase, 1.566, 0.0055) * smooth(0.7, 1.0, ca);
          const uLip = g1(ax, 0, 0.0230) * g1(yBase, 1.559, 0.0062) * smooth(0.58, 1.0, ca);
          const lLip = g1(ax, 0, 0.0210) * g1(yBase, 1.546, 0.0066) * smooth(0.58, 1.0, ca);
          const rima = g1(ax, 0, 0.0245) * g1(yBase, 1.5525, 0.0024) * smooth(0.52, 1.0, ca);
          const commissure = g2(ax, yBase, 0.0246, 1.5528, 0.0044, 0.0038) * smooth(0.55, 0.96, ca);
          lz += (0.0105 * uLip + 0.0112 * lLip) * lipFull - 0.0018 * philtrum - 0.0055 * rima - 0.0028 * commissure;

          // Labiomental sulcus above rounded pogonion
          const labiomental = g1(ax, 0, 0.0185) * g1(yBase, 1.535, 0.0056) * smooth(0.60, 1.0, ca);
          lz += -0.0035 * labiomental;
        }
        // Subtle anatomical pre-auricular / conchal fossa depression on lateral temporal bone so 3D ear concha & tragus sit 100% un-occluded!
        if (yBase > 1.564 && yBase < 1.628 && Math.abs(sa) > 0.80) {
          const earFossa = g2(yBase, r.p[2] + lz, 1.596, -0.017, 0.025, 0.014) * smooth(0.82, 0.98, Math.abs(sa));
          lx -= sLat * 0.0032 * earFossa;
        }

        let px = r.p[0] + lx, py = yBase + ly, pz = r.p[2] + lz;

        let eOrbitVal = 99.0;
        if (useScionEyes && pz > 0.035) {
          const dxO = (Math.abs(px) - orbitCut.cx) / orbitCut.rx;
          const dyO = (py - orbitCut.cy) / orbitCut.ry;
          eOrbitVal = dxO * dxO + dyO * dyO;
        }
        pos.push(px, py, pz);
        uv.push((j / seg) * 3.0, v * 3.0);

        const azim = Math.abs(Math.atan2(px, pz + 0.012));
        // Suppress 2D portrait eye inside ScionEyelids cutout (eOrbit < 0.94) -> ZERO double-eyelid portrait ghosting!
        const eyeCut = useScionEyes
          ? (ca > 0.25 ? smooth(0.94, 1.04, eOrbitVal) : 1.0)
          : (1.0 - 0.99 * g2(Math.abs(px), py, 0.0310, 1.6160, 0.0088, 0.0030) * smooth(0.30, 0.88, ca));

        const vertMask = SN
          ? SN.computePortraitFadeMask(px, py, azim, topFadeY, eyeCut)
          : (smooth(1.525, 1.543, py + 0.008 * (1.0 - smooth(0.018, 0.056, Math.abs(px)))) * (1.0 - smooth(topFadeY, topFadeY + 0.028, py)) * eyeCut);

        const wFrontRaw = 1.0 - smooth(0.38, 0.68, azim);
        const under3DEar = 1.0 - 0.98 * g2(py, pz, 1.596, -0.019, 0.031, 0.019) * smooth(0.058, 0.068, Math.abs(px));
        const wSideRaw  = smooth(0.38, 0.70, azim) * (1.0 - smooth(2.05, 2.50, azim)) * under3DEar;

        const hairlineLine = 1.682 - 0.018 * g1(Math.abs(px), 0.052, 0.022) - 0.082 * smooth(0.78, 1.65, azim) - 0.048 * smooth(2.00, 2.75, azim);
        const hairlineRoot = (!hasWrapOrHat && py > hairlineLine - 0.012)
          ? smooth(hairlineLine - 0.012, hairlineLine + 0.010, py)
          : 0.0;
        const sssAmt = clamp(0.40 + 0.55 * g1(py, 1.582, 0.038) * smooth(0.35, 1.0, ca), 0, 1);

        faceMeta.push(wFrontRaw * vertMask, wSideRaw * vertMask, hairlineRoot, sssAmt);
        const lipSignGrid = g1(Math.abs(px), 0, 0.028) * g1(py, 1.5525, 0.018) * (py >= 1.5525 ? 1.0 : -1.0) * smooth(0.35, 0.9, ca);
        facsMeta.push(lipSignGrid, 0.0, 0.0, 0.0);

        if (SN) {
          const [cr, cg, cb] = SN.computeAnatomicalVertexAO(px, py, ca);
          col.push(cr, cg, cb);
          const sk = SN.computeBustSkinning(px, py, pz, B);
          si.push(sk.indices[0], sk.indices[1], sk.indices[2], sk.indices[3]);
          sw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
        } else {
          const socketAO = g2(Math.abs(px), py, 0.0310, 1.616, 0.019, 0.012) * Math.max(0, ca);
          const nostrilAO = g2(Math.abs(px), py, 0.0105, 1.574, 0.0058, 0.0042) * Math.max(0, ca);
          const underJawAO = g1(py, 1.498, 0.013) * g1(Math.abs(px), 0, 0.035) * Math.max(0, ca) * 0.13;
          const suprasternalAO = g1(Math.abs(px), 0, 0.016) * g1(py, 1.398, 0.016) * Math.max(0, ca) * 0.10;
          const lipFlush = g1(Math.abs(px), 0, 0.023) * g1(py, 1.553, 0.009) * Math.max(0, ca);
          const baseL = 0.98 + 0.02 * smooth(1.40, 1.65, py) - 0.10 * socketAO - 0.52 * nostrilAO - underJawAO - suprasternalAO;
          col.push(baseL + 0.035 * lipFlush, baseL - 0.012 * lipFlush, baseL - 0.022 * lipFlush);

          if (py < 1.448) {
            const wNeck = smooth(1.388, 1.448, py) * (1.0 - 0.72 * smooth(0.062, 0.098, Math.abs(px)));
            si.push(B.NECK_LOW, B.CHEST, 0, 0);
            sw.push(wNeck, 1 - wNeck, 0, 0);
          } else if (py < 1.495) {
            const w = smooth(1.448, 1.495, py);
            si.push(B.NECK_HIGH, B.NECK_LOW, 0, 0);
            sw.push(w, 1 - w, 0, 0);
          } else {
            const headW = smooth(1.492, 1.528, py);
            const jawZone = evalSpatialJawWeight(px, py, pz);
            const rem = 1 - jawZone;
            si.push(B.HEAD, B.NECK_HIGH, B.JAW, 0);
            sw.push(headW * rem, (1 - headW) * rem, jawZone, 0);
          }
        }
      }
    }

    // Omit coarse head-grid quads when ALL 4 quad corners sit inside mouthBag's iv<=6 interior (5mm solid overlap to iv=7 -> ZERO open-jaw polygon poke-through!)
    const isVertInsideMouthPocket = vId => {
      const vx = pos[vId * 3], vy = pos[vId * 3 + 1], vz = pos[vId * 3 + 2];
      if (vz <= 0.042) return false;
      const nx = vx / 0.0375;
      const ny = vy >= 1.5525 ? (vy - 1.5525) / 0.0146 : (vy - 1.5525) / 0.0212;
      return (nx * nx + ny * ny) < 1.0;
    };
    // Omit quads strictly inside eOrbit < 0.96 (1.5mm inside ScionEyelids 0.0222 x 0.0140 outer rim -> ZERO outer gap & clean overlap!)
    const omitOrbitThresh = 0.96;
    const isVertInsideEyePocket = (vId, sideSign) => {
      const vx = pos[vId * 3], vy = pos[vId * 3 + 1], vz = pos[vId * 3 + 2];
      if (vz <= 0.035 || vx * sideSign <= 0) return false;
      if (useScionEyes) {
        const nx = (Math.abs(vx) - orbitCut.cx) / orbitCut.rx;
        const ny = (vy - orbitCut.cy) / orbitCut.ry;
        return (nx * nx + ny * ny) < omitOrbitThresh;
      }
      const nx = (vx - sideSign * 0.0310) / 0.0122, ny = (vy - 1.6160) / 0.0050;
      return (nx * nx + ny * ny) < 1.0;
    };
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const A = i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
        if (isVertInsideMouthPocket(A) && isVertInsideMouthPocket(Bv) && isVertInsideMouthPocket(C) && isVertInsideMouthPocket(D)) {
          continue;
        }
        if (
          (isVertInsideEyePocket(A, 1) && isVertInsideEyePocket(Bv, 1) && isVertInsideEyePocket(C, 1) && isVertInsideEyePocket(D, 1)) ||
          (isVertInsideEyePocket(A, -1) && isVertInsideEyePocket(Bv, -1) && isVertInsideEyePocket(C, -1) && isVertInsideEyePocket(D, -1))
        ) {
          continue;
        }
        idx.push(A, Bv, C, Bv, D, C);
      }
    }

    // Exact continuous facial/orbital skin surface & pore-UV evaluator for ScionEyelids (tv=1.0) & 48-seg Split-Lip Oral Pouch (iv=7)
    const sampleRingAtY = py => {
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (rings[mid].p[1] <= py) lo = mid;
        else hi = mid;
      }
      const r0 = rings[lo], r1 = rings[hi];
      const tR = clamp((py - r0.p[1]) / Math.max(1e-6, r1.p[1] - r0.p[1]), 0, 1);
      return {
        z0: lerp(r0.p[2], r1.p[2], tR),
        w: lerp(r0.w, r1.w, tR),
        f: lerp(r0.f, r1.f, tR),
        e: lerp(r0.e || 1, r1.e || 1, tR),
        vGrid: (lo + tR) / Math.max(1, n - 1)
      };
    };

    const evalHeadPoreUV = (px, py, pz) => {
      const uH = (0.5 + Math.atan2(px, Math.max(0.015, pz)) / TAU) * 3.0;
      const vH = sampleRingAtY(py).vGrid * 3.0;
      return [uH, vH];
    };

    const evalFacialSkinZ = (px, py, includeLips = false) => {
      const rr = sampleRingAtY(py);
      const ax = Math.abs(px);
      let saA = clamp(ax / Math.max(0.02, rr.w), 0, 0.99);
      let caA = Math.sqrt(1 - saA * saA);
      const temple0 = g2(ax, py, 0.066, 1.628, 0.016, 0.022) * g1(caA, 0.25, 0.35);
      const malar0 = g2(ax, py, 0.052, 1.594, 0.020, 0.016) * smooth(-0.05, 0.72, caA);
      const buccal0 = g2(ax, py, 0.054, 1.560, 0.019, 0.019) * smooth(0.05, 0.58, caA);
      const alar0 = g2(ax, py, 0.0162, 1.579, 0.0095, 0.0085) * smooth(0.45, 0.96, caA);
      const gonion0 = py < 1.550 ? g2(ax, py, 0.0545 * jawScale, 1.539, 0.011, 0.011) * g1(caA, 0.12, 0.24) : 0.0;
      const effAx = Math.max(0, ax - (0.0052 * malar0 - 0.0018 * buccal0 + 0.0038 * alar0 - 0.0042 * temple0 + 0.0014 * gonion0));
      saA = clamp(Math.pow(effAx / Math.max(0.02, rr.w), 1.0 / rr.e), 0, 0.992);
      caA = Math.sqrt(1 - saA * saA);

      let zS = rr.z0 + Math.pow(caA, rr.e) * rr.f;
      if (SN) {
        zS += SN.evalAnteriorJawDeltaZ(ax, py, caA, zS, rr.z0, jawScale) + 0.0022 * gonion0;
      } else if (py > 1.488 && py < 1.548) {
        const archExp = lerp(3.0, 1.45, smooth(1.508, 1.542, py));
        const archCa = Math.pow(caA, archExp);
        const yBorder = 1.5035 + 0.0295 * Math.pow(smooth(0.010, 0.053 * jawScale, ax), 1.15);
        const subRamp = smooth(yBorder - 0.0095, yBorder + 0.0085, py) * (1.0 - smooth(1.538, 1.547, py));
        const zWant = rr.z0 + (0.0845 - rr.z0) * archCa;
        if (zWant > zS) zS += (zWant - zS) * subRamp;
      }
      const brow = g2(ax, py, 0.029, 1.635, 0.028, 0.0095) * smooth(0.28, 0.92, caA);
      const glabella = g1(ax, 0, 0.012) * g1(py, 1.632, 0.009) * smooth(0.65, 1.0, caA);
      const nasionNotch = g1(ax, 0, 0.014) * g1(py, 1.621, 0.007) * smooth(0.60, 1.0, caA);
      const bridge = g1(ax, 0, 0.0125) * g1(py, 1.602, 0.019) * smooth(0.55, 0.98, caA);
      const noseTip = g1(ax, 0, 0.0148) * g1(py, 1.583, 0.0145) * smooth(0.62, 1.0, caA);
      const columella = g1(ax, 0, 0.0075) * g1(py, 1.572, 0.0065) * smooth(0.62, 1.0, caA);
      const alar = g2(ax, py, 0.0162, 1.579, 0.0095, 0.0085) * smooth(0.45, 0.96, caA);
      const nostrilHole = g2(ax, py, 0.0102, 1.574, 0.0048, 0.0035) * smooth(0.60, 1.0, caA);
      const malar = g2(ax, py, 0.052, 1.594, 0.020, 0.016) * smooth(-0.05, 0.72, caA);
      const buccalHollow = g2(ax, py, 0.054, 1.560, 0.019, 0.019) * smooth(0.05, 0.58, caA);
      const nlLine = 0.019 + (1.578 - py) * 0.34;
      const nlFold = g1(ax, nlLine, 0.0055) * smooth(1.546, 1.578, py) * (1 - smooth(1.578, 1.586, py)) * smooth(0.4, 0.9, caA);
      const latOrbitalWrap = g2(ax, py, 0.0422, 1.616, 0.0062, 0.0085) * smooth(0.25, 0.85, caA);
      const tearTrough = g2(ax, py, 0.029, 1.603, 0.013, 0.0035) * smooth(0.35, 0.90, caA);
      const labiomental = g1(ax, 0, 0.0185) * g1(py, 1.535, 0.0056) * smooth(0.60, 1.0, caA);

      zS += (0.0078 * brow + 0.0045 * glabella) * lerp(1.15, 0.88, fem);
      zS += (-0.0032 * nasionNotch + 0.0112 * bridge + 0.0168 * noseTip + 0.0085 * columella + 0.0088 * alar) * noseLen;
      zS -= 0.0042 * nostrilHole;
      zS += 0.0055 * malar - 0.0014 * buccalHollow - 0.0018 * nlFold + 0.0034 * latOrbitalWrap - 0.0012 * tearTrough;
      zS += -0.0035 * labiomental;

      if (includeLips) {
        const philtrum = g1(ax, 0, 0.0055) * g1(py, 1.566, 0.0055) * smooth(0.7, 1.0, caA);
        const uLip = g1(ax, 0, 0.0230) * g1(py, 1.559, 0.0062) * smooth(0.58, 1.0, caA);
        const lLip = g1(ax, 0, 0.0210) * g1(py, 1.546, 0.0066) * smooth(0.58, 1.0, caA);
        const rima = g1(ax, 0, 0.0245) * g1(py, 1.5525, 0.0024) * smooth(0.52, 1.0, caA);
        const commissure = g2(ax, py, 0.0246, 1.5528, 0.0044, 0.0038) * smooth(0.55, 0.96, caA);
        zS += (0.0105 * uLip + 0.0112 * lLip) * lipFull - 0.0018 * philtrum - 0.0055 * rima - 0.0028 * commissure;
      }
      return zS;
    };

    // 4. Eyelid Collar: OMITTED when ScionEyelids + ScionEyeGlobe (72x14 spherical-wrap continuum) are active!
    const bindPosOverrides = [];
    const seamNormalPairs = [];
    if (!useScionEyes) {
      const NRIM = 36, VRIM = 4;
      for (const side of [1, -1]) {
        const baseRim = pos.length / 3;
        const ex = side * 0.0310, ey = 1.6160, ez = 0.0614;
        for (let iv = 0; iv <= VRIM; iv++) {
          seamNormalPairs.push([baseRim + iv * (NRIM + 1), baseRim + iv * (NRIM + 1) + NRIM]);
          const tv = iv / VRIM;
          for (let iu = 0; iu <= NRIM; iu++) {
            const th = (iu / NRIM) * TAU;
            const cth = Math.cos(th), sth = Math.sin(th);
            const canthusPinch = Math.pow(Math.max(0.02, 1.0 - cth * cth), 0.60);
            const canthalTilt = 0.00042 * cth;
            const inX = 0.0102 * cth;
            const inY = (sth >= 0 ? 0.00270 * sth : 0.00285 * sth) * canthusPinch + canthalTilt;
            const outX = 0.0156 * cth;
            const outY = (0.0068 * sth + 0.00025 * sth * sth) + canthalTilt;

            const radFrac = iv === 0 ? 0.0 : (iv === 1 ? 0.0 : (iv === 2 ? 0.36 : (iv === 3 ? 0.72 : 1.0)));
            const dx = iv === 0 ? (inX * 0.76) : lerp(inX, outX, radFrac);
            const dy = iv === 0 ? (inY * 0.70) : lerp(inY, outY, radFrac);
            const px = ex + side * dx;
            const py = ey + dy;

            const rSq = Math.max(0, 0.01215 * 0.01215 - dx * dx - dy * dy);
            const zEyeRim = ez + Math.sqrt(rSq);
            const zSkin = evalFacialSkinZ(px, py, false);

            let pz;
            if (iv === 0) pz = ez + 0.0038;
            else if (iv === 1) pz = lerp(zEyeRim + 0.00030, zSkin, 0.28);
            else if (iv === 2) pz = lerp(zEyeRim + 0.00040, zSkin, 0.74);
            else if (iv === 3) pz = zSkin;
            else pz = zSkin - 0.00022;

            pos.push(px, py, pz);
            const [uLidPore, vLidPore] = evalHeadPoreUV(px, py, Math.max(0.03, zSkin));
            uv.push(uLidPore, vLidPore);
            const lashMarginAO = iv === 0 ? 0.24 : (iv === 1 ? 0.62 : (iv === 2 ? 0.88 : 0.99));
            col.push(lashMarginAO, lashMarginAO * 0.96, lashMarginAO * 0.94);
            si.push(B.HEAD, 0, 0, 0);
            sw.push(1, 0, 0, 0);

            const azim = Math.atan2(Math.abs(px), pz + 0.012);
            const lidPhotoFade = smooth(0.48, 0.96, tv);
            const wFrontR = (1.0 - smooth(0.38, 0.68, azim)) * lidPhotoFade;
            const wSideR = smooth(0.38, 0.70, azim) * lidPhotoFade;
            faceMeta.push(wFrontR, wSideR, 0.0, 0.58);

            const lidMobility = smooth(0.05, 0.22, tv) * (1.0 - smooth(0.24, 0.92, tv)) * canthusPinch * (sth >= 0 ? 1.0 : -1.0);
            facsMeta.push(0.0, lidMobility, 0.0, 0.0);
          }
        }
        const rCols = NRIM + 1;
        for (let iv = 0; iv < VRIM; iv++) {
          for (let iu = 0; iu < NRIM; iu++) {
            const A = baseRim + iv * rCols + iu;
            const Bv = A + 1;
            const C = A + rCols;
            const D = C + 1;
            if (side > 0) idx.push(A, C, Bv, Bv, C, D);
            else idx.push(A, Bv, C, Bv, D, C);
          }
        }
      }
    }

    // 5. True Split-Vermilion Openable Mouth + Recessed Wet Mucosal Oral Cavity Pouch (mouthBag)
    //    - iv = 3 (V_RIMA): Upper lip (sth >= 0) & Lower lip (sth <= 0) kiss at IDENTICAL (px, rimaY, pz) -> 0.000mm closed gap!
    //    - iv = 4..7: Smooth vermilion belly, white-roll & 12mm outer cheek/chin blend anchored to B.HEAD (upper) & B.JAW (lower).
    //    - iv = 2..0: Wet inner mucosal lip roll -> deep dark burgundy oral vestibule pouch enclosing 3D teeth & tongue!
    const NMOUTH = 48, VMOUTH = 7;
    const baseMouth = pos.length / 3;
    for (let iv = 0; iv <= VMOUTH; iv++) {
      const rowStartV = baseMouth + iv * (NMOUTH + 1);
      seamNormalPairs.push([rowStartV, rowStartV + NMOUTH]);
      for (let iu = 0; iu <= NMOUTH; iu++) {
        const iuWrap = iu === NMOUTH ? 0 : iu;
        const th = (iuWrap / NMOUTH) * TAU;
        const cth = Math.cos(th), sth = Math.sin(th); // cth=±1 commissures; sth>0 upper lip, sth<0 lower lip
        const centerFactor = Math.max(0, 1.0 - cth * cth);
        const rimaY = 1.5525
          - 0.00038 * g1(cth, 0, 0.22)
          + 0.00030 * (g1(cth, 0.36, 0.22) + g1(cth, -0.36, 0.22))
          - 0.00032 * Math.pow(Math.abs(cth), 2.2);
        const zRima = evalFacialSkinZ(0.0252 * cth, rimaY, true);

        let px, py, pz, mucosaDepth = 0.0, rimaEdge = 0.0;
        if (iv === 0) {
          // Deep pharyngeal oral back cap (collapsed to exact 0.0mm watertight apex!)
          px = 0.0;
          py = 1.5525;
          pz = 0.0445;
          mucosaDepth = 1.0;
        } else if (iv === 1) {
          // Deep oral vestibule wall strictly BEHIND entire maxillary/mandibular dental arches (z = 0.048m -> ZERO gum occlusion!)
          px = 0.0275 * cth;
          py = 1.5525 + 0.0215 * sth;
          pz = 0.0485 - 0.0040 * cth * cth;
          mucosaDepth = 0.88;
        } else if (iv === 2) {
          // Fleshy wet inner mucosal lip roll (tucked cleanly above upper gumline & below lower gumline!)
          px = 0.0250 * cth;
          const innerLift = sth >= 0 ? 0.0038 : 0.0028;
          py = rimaY + sth * innerLift * (0.35 + 0.65 * Math.pow(centerFactor, 0.50));
          pz = zRima - 0.0046;
          mucosaDepth = 0.34;
          rimaEdge = 0.45;
        } else if (iv === 3) {
          // Exact kissing rima contact seam (0.0000mm gap at jawOpen == 0!)
          px = 0.0252 * cth;
          py = rimaY;
          pz = zRima;
          rimaEdge = 1.0;
        } else {
          // iv = 4..7: Outer vermilion roll -> Cupid's bow / lower lip belly -> smooth philtrum/chin blend (staying below nostrils -> ZERO stair-step!)
          const tOut = (iv - 3) / 4.0;
          const xSpan = lerp(0.0252, 0.0425, Math.pow(tOut, 0.90));
          const ySpan = (sth >= 0 ? 0.0168 : 0.0248) * Math.pow(tOut, 0.88);
          const archShape = lerp(Math.pow(Math.max(0.08, centerFactor), 0.40), 1.0, smooth(0.20, 0.90, tOut));
          px = xSpan * cth;
          py = rimaY + sth * ySpan * archShape;
          const zSurf = evalFacialSkinZ(px, py, true);
          pz = iv === 7 ? zSurf : (zSurf + 0.00038 * Math.sin(tOut * Math.PI));
          rimaEdge = iv === 4 ? 0.36 : 0.0;
        }

        pos.push(px, py, pz);
        const [uMouthPore, vMouthPore] = evalHeadPoreUV(px, py, Math.max(0.03, zRima));
        uv.push(uMouthPore, vMouthPore);

        // Smooth C^2 rounded commissure & parabolic oval jaw hinge (eliminates sharp < / > triangle corners at cth = ±1!)
        let wJawM;
        if (iv === 0) {
          wJawM = 0.50;
        } else {
          // Keep upper-lip jaw pull focused at commissure corners (|cth| > 0.70) so lateral upper lip never droops in front of premolars/gums!
          const uJaw = 0.36 * Math.pow(cth * cth, 2.35);
          const lJaw = lerp(0.36, 0.95, Math.pow(centerFactor, 0.84));
          const cornerSmooth = smooth(-0.34, 0.34, sth);
          const wJawLip = lerp(lJaw, uJaw, cornerSmooth);
          if (iv <= 4) {
            wJawM = wJawLip;
          } else {
            const wSpatial = evalSpatialJawWeight(px, py, pz);
            wJawM = lerp(wJawLip, wSpatial, smooth(4.4, 6.2, iv));
          }
        }
        if (SN && iv >= 6) {
          const skBase = SN.computeBustSkinning(px, py, pz, B);
          // Blend iv=6..7 into exact ScionNeck skinning while preserving smooth lip-hinge wJawM
          const headBoost = smooth(1.492, 1.528, py + 0.026 * smooth(0.018, 0.062, pz));
          const remM = 1.0 - wJawM;
          if (iv === 7) {
            si.push(skBase.indices[0], skBase.indices[1], skBase.indices[2], skBase.indices[3]);
            sw.push(skBase.weights[0], skBase.weights[1], skBase.weights[2], skBase.weights[3]);
          } else {
            si.push(B.HEAD, B.NECK_HIGH, B.JAW, 0);
            sw.push(headBoost * remM, (1.0 - headBoost) * remM, wJawM, 0);
          }
        } else {
          const headW = smooth(1.492, 1.528, py + (SN ? 0.026 * smooth(0.018, 0.062, pz) : 0.0));
          const rem = 1.0 - wJawM;
          si.push(B.HEAD, B.NECK_HIGH, B.JAW, 0);
          sw.push(headW * rem, (1.0 - headW) * rem, wJawM, 0);
        }

        if (iv <= 2) {
          const aoM = iv === 2 ? 0.72 : (iv === 1 ? 0.08 : 0.02);
          col.push(aoM, aoM * 0.85, aoM * 0.85);
          faceMeta.push(0.0, 0.0, 0.0, iv === 2 ? 0.55 : 0.0);
        } else {
          // Exact 1:1 vertex color & neckPortraitFade continuity with seg=64 head grid (ZERO stepped border!)
          if (SN) {
            const [cr, cg, cb] = SN.computeAnatomicalVertexAO(px, py, 1.0);
            col.push(cr, cg, cb);
          } else {
            const nostrilAO = g2(Math.abs(px), py, 0.0105, 1.574, 0.0058, 0.0042);
            const lipFlush = g1(Math.abs(px), 0, 0.023) * g1(py, 1.553, 0.009);
            const baseL = 0.98 + 0.02 * smooth(1.40, 1.65, py) - 0.52 * nostrilAO;
            col.push(baseL + 0.035 * lipFlush, baseL - 0.012 * lipFlush, baseL - 0.022 * lipFlush);
          }

          const azim = Math.abs(Math.atan2(px, pz + 0.012));
          const neckFadeM = SN
            ? SN.computePortraitFadeMask(px, py, azim, topFadeY, 1.0)
            : smooth(1.525, 1.543, py + 0.008 * (1.0 - smooth(0.018, 0.056, Math.abs(px))));
          const wF = (1.0 - smooth(0.38, 0.68, azim)) * neckFadeM;
          const wS = smooth(0.38, 0.70, azim) * neckFadeM;
          faceMeta.push(wF, wS, 0.0, 0.65);
        }

        const lipSign = (sth >= 0 ? 1.0 : -1.0) * (1.0 - smooth(5.5, 7.0, iv));
        facsMeta.push(lipSign, 0.0, mucosaDepth, rimaEdge);
      }
    }
    const mCols = NMOUTH + 1;
    for (let iv = 0; iv < VMOUTH; iv++) {
      for (let iu = 0; iu < NMOUTH; iu++) {
        const A = baseMouth + iv * mCols + iu;
        const Bv = A + 1;
        const C = A + mCols;
        const D = C + 1;
        // Outward (+Z on outer lips) & lumen-facing (inside oral cavity) FrontSide CCW winding!
        idx.push(A, C, Bv, Bv, C, D);
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    g.setAttribute("aFaceMeta", new T.Float32BufferAttribute(faceMeta, 4));
    g.setAttribute("aFacsMeta", new T.Float32BufferAttribute(facsMeta, 4));
    g.setIndex(idx);
    g.computeVertexNormals();

    const N = g.attributes.normal;
    for (let i = 0; i < n; i++) {
      const a0 = i * cols, a1 = a0 + seg;
      const nx = N.getX(a0) + N.getX(a1), ny = N.getY(a0) + N.getY(a1), nz = N.getZ(a0) + N.getZ(a1);
      const nl = Math.hypot(nx, ny, nz) || 1;
      N.setXYZ(a0, nx / nl, ny / nl, nz / nl);
      N.setXYZ(a1, nx / nl, ny / nl, nz / nl);
    }
    for (let k = 0; k < seamNormalPairs.length; k++) {
      const [c0, c1] = seamNormalPairs[k];
      const nx = N.getX(c0) + N.getX(c1), ny = N.getY(c0) + N.getY(c1), nz = N.getZ(c0) + N.getZ(c1);
      const nl = Math.hypot(nx, ny, nz) || 1;
      N.setXYZ(c0, nx / nl, ny / nl, nz / nl);
      N.setXYZ(c1, nx / nl, ny / nl, nz / nl);
    }
    // Match kissing upper & lower rima normals (iv === 3) identically across twins so closed lips have ZERO horizontal lighting step!
    const rimaRowStart = baseMouth + 3 * mCols;
    for (let iu = 0; iu <= NMOUTH / 2; iu++) {
      const iTop = rimaRowStart + iu;
      const iBot = rimaRowStart + (NMOUTH - iu);
      const th = (iu / NMOUTH) * TAU;
      const cth = Math.cos(th);
      const nx = 0.24 * cth, ny = -0.02, nz = 0.97;
      const nl = Math.hypot(nx, ny, nz);
      N.setXYZ(iTop, nx / nl, ny / nl, nz / nl);
      N.setXYZ(iBot, nx / nl, ny / nl, nz / nl);
    }
    N.setXYZ(rimaRowStart + NMOUTH, N.getX(rimaRowStart), N.getY(rimaRowStart), N.getZ(rimaRowStart));

    // Align outer mouth-patch boundary normals (iv === 6..7) to exact continuous skin gradient so transition to seg=64 is 100% seamless!
    const epsN = 0.0016;
    for (const ivOut of [6, 7]) {
      const outRow = baseMouth + ivOut * mCols;
      const wBlend = ivOut === 7 ? 1.0 : 0.65;
      for (let iu = 0; iu <= NMOUTH; iu++) {
        const vi = outRow + iu;
        const vx = pos[vi * 3], vy = pos[vi * 3 + 1];
        const dzdx = (evalFacialSkinZ(vx + epsN, vy, true) - evalFacialSkinZ(vx - epsN, vy, true)) / (2 * epsN);
        const dzdy = (evalFacialSkinZ(vx, vy + epsN, true) - evalFacialSkinZ(vx, vy - epsN, true)) / (2 * epsN);
        const gl = Math.hypot(-dzdx, -dzdy, 1.0) || 1.0;
        const gx = -dzdx / gl, gy = -dzdy / gl, gz = 1.0 / gl;
        const mx = lerp(N.getX(vi), gx, wBlend);
        const my = lerp(N.getY(vi), gy, wBlend);
        const mz = lerp(N.getZ(vi), gz, wBlend);
        const ml = Math.hypot(mx, my, mz) || 1.0;
        N.setXYZ(vi, mx / ml, my / ml, mz / ml);
      }
    }

    // Save pure un-recessed bind positions & smooth normals FIRST, then tuck hidden head-grid straddle vertices cleanly behind mouthBag & ScionEyelids!
    const bindPosArr = Float32Array.from(pos);
    for (let k = 0; k < bindPosOverrides.length; k++) {
      const ov = bindPosOverrides[k];
      bindPosArr[ov[0] * 3] = ov[1];
      bindPosArr[ov[0] * 3 + 1] = ov[2];
      bindPosArr[ov[0] * 3 + 2] = ov[3];
    }
    const P = g.attributes.position;
    const gridCount = n * cols;
    for (let vi = 0; vi < gridCount; vi++) {
      const vx = P.getX(vi), vy = P.getY(vi), vz = P.getZ(vi);
      if (vz <= 0.035) continue;
      let dzTuck = 0.0;
      if (useScionEyes) {
        const dxO = (Math.abs(vx) - orbitCut.cx) / orbitCut.rx;
        const dyO = (vy - orbitCut.cy) / orbitCut.ry;
        const eOrb = dxO * dxO + dyO * dyO;
        if (eOrb < 1.06) {
          const rOrb = Math.sqrt(eOrb);
          // Deep recess (-18mm) inside medial tear lake / globe (rOrb < 0.85) + -6.6mm across straddle ring, reaching 0.000mm at rOrb >= 1.002!
          dzTuck -= 0.0180 * (1.0 - smooth(0.45, 0.85, rOrb)) + 0.0066 * (1.0 - smooth(0.60, 1.002, rOrb));
        }
      }
      if (vy > 1.5260 && vy < 1.5715 && Math.abs(vx) < 0.0440) {
        const dyM = vy >= 1.5525 ? (vy - 1.5525) / 0.0168 : (vy - 1.5525) / 0.0248;
        const rApron = Math.hypot(vx / 0.0425, dyM);
        if (rApron < 1.010) {
          dzTuck -= 0.0028 * (1.0 - smooth(0.72, 1.005, rApron));
        }
      }
      if (dzTuck !== 0.0) {
        P.setZ(vi, vz + dzTuck);
      }
    }
    g.setAttribute("aBindPos", new T.Float32BufferAttribute(bindPosArr, 3));
    g.setAttribute("aBindNrm", new T.Float32BufferAttribute(Float32Array.from(N.array), 3));
    g.userData = g.userData || {};
    g.userData.evalOrbitalSkinZ = (px, py) => evalFacialSkinZ(px, py, false);
    g.userData.evalHeadPoreUV = evalHeadPoreUV;
    return g;
  }

  /* Sculpted Multi-Fold Rounded Human Ear (Smooth C-Helix, Antihelix, Concha Cavum, Tragus, Earlobe — ZERO Pointy Spike or Crease!) */
  function buildSculptedHumanEarsGeo(T, B) {
    if (typeof window !== "undefined" && window.HumanPhysicalV6 && typeof window.HumanPhysicalV6.buildEmptyWeldedEarsStubGeo === "function") {
      return window.HumanPhysicalV6.buildEmptyWeldedEarsStubGeo(T, B);
    }
    const pos = [], uv = [], col = [], si = [], sw = [], faceMeta = [], facsMeta = [], idx = [];
    const NU = 24, NV = 16;

    for (const side of [1, -1]) {
      const baseV = pos.length / 3;
      // Follow natural ~10 deg upward-outward auricular cant: flush into 0.064m ramus/mastoid at earlobe (u=0) -> 0.0746m at mid/upper temple!
      const cy = 1.597, cz = -0.009;
      for (let iu = 0; iu <= NU; iu++) {
        const u = iu / NU; // 0 = bottom rounded earlobe, 1 = rounded superior helix arch
        const cx = side * lerp(0.0638, 0.0746, smooth(0.0, 0.54, u));
        const thU = u * Math.PI;
        const sinU = Math.sin(thU);
        const yLocal = -0.0268 * Math.cos(thU);
        const earSpanZ = 0.0014 + 0.0212 * Math.pow(sinU, 0.72) * (0.84 + 0.16 * smooth(0.22, 0.76, u));
        const splayOut = 0.0022 + 0.0056 * Math.pow(sinU, 0.78);

        for (let iv = 0; iv <= NV; iv++) {
          const v = iv / NV; // 0 = pre-auricular cheek weld -> 0.62 = rounded outer C-helix -> 1.0 = posterior mastoid root
          const rimTurn = smooth(0.60, 1.0, v);
          const tFront = clamp(v / 0.62, 0, 1);
          const zCurve = Math.sin(tFront * Math.PI * 0.5);
          // Soft rounded U-droplet human earlobe contour (eliminates flat horizontal bottom cut edge when head tilts!)
          const lobeDrop = -0.0040 * (1.0 - smooth(0.0, 0.28, u)) * Math.sin(clamp(v / 0.88, 0, 1) * Math.PI);
          const ly = yLocal + lobeDrop;

          const concha = g2(v, u, 0.25, 0.44, 0.11, 0.20);
          const cymba = g2(v, u, 0.29, 0.71, 0.10, 0.10);
          const scapha = g1(v, 0.50, 0.052) * smooth(0.24, 0.88, u);
          const antihelix = g2(v, u, 0.40, 0.54, 0.085, 0.27);
          const crusHelix = g2(v, u, 0.18, 0.58, 0.08, 0.06);
          const helixRoll = g1(v, 0.60, 0.075) * smooth(0.10, 0.96, u);
          const tragus = g2(v, u, 0.10, 0.39, 0.055, 0.095);
          const antitragus = g2(v, u, 0.23, 0.23, 0.075, 0.075);
          const lobe = (1 - smooth(0.0, 0.26, u)) * Math.sin(tFront * Math.PI) * 0.0028;
          // Watertight pre-auricular & sub-lobular weld into headMesh while keeping concha floor >= 0.0736m exterior!
          const rootTuckFront = -0.0062 * Math.pow(1 - clamp(v / 0.14, 0, 1), 2.1);

          const xFront = rootTuckFront + zCurve * splayOut
            - 0.0024 * concha - 0.0015 * cymba - 0.0013 * scapha
            + 0.0024 * antihelix + 0.0016 * crusHelix + 0.0028 * helixRoll
            + 0.0026 * tragus + 0.0018 * antitragus + lobe;
          const xAtHelix = splayOut + 0.0024;
          const xBack = lerp(xAtHelix, -0.0082, Math.pow(rimTurn, 0.82));
          const endBlend = Math.pow(sinU, 0.46);
          const lx = side * lerp(xFront, xBack, rimTurn) * (0.70 + 0.30 * endBlend);

          const zFront = -zCurve * earSpanZ + 0.0032 * (1 - clamp(v / 0.18, 0, 1)) * sinU - 0.0012 * helixRoll + 0.0018 * tragus;
          // Tuck posterior wall straight medially (-X) into mastoid behind the ear without sweeping forward in +Z!
          const zBack = lerp(-earSpanZ - 0.0010 * smooth(0.14, 0.94, u), -earSpanZ + 0.0042, rimTurn);
          const lz = lerp(zFront, zBack, rimTurn);

          // Sculptural 5-fold AO & ridge contrast matched to shaded lateral temple luminance
          const ridgeLift = 0.095 * (antihelix + helixRoll + 0.75 * tragus + 0.60 * antitragus + 0.55 * crusHelix);
          const hollowAO = 0.48 * concha + 0.30 * cymba + 0.26 * scapha;
          const ao = lerp(0.78 - hollowAO + ridgeLift, 0.64, rimTurn);

          const px = cx + lx, py = cy + ly, pz = cz + lz;
          pos.push(px, py, pz);
          uv.push(v, u);
          const warmRim = 0.020 * (helixRoll + (1.0 - smooth(0.0, 0.28, u)));
          col.push(ao + 0.012 + warmRim, ao - 0.006 + warmRim * 0.22, ao - 0.012);
          si.push(B.HEAD, 0, 0, 0);
          sw.push(1, 0, 0, 0);
          const wSide = 0.42 * (1.0 - smooth(0.0, 0.14, v)) * endBlend;
          faceMeta.push(0.0, wSide, 0.0, 0.92);
          facsMeta.push(0.0, 0.0, 0.0, 0.0);
        }
      }

      const rowStride = NV + 1;
      for (let iu = 0; iu < NU; iu++) {
        for (let iv = 0; iv < NV; iv++) {
          const A = baseV + iu * rowStride + iv;
          const Bv = A + 1;
          const C = A + rowStride;
          const D = C + 1;
          // Right-side-out outward (+X on side=+1, -X on side=-1) CCW triangle winding!
          if (side > 0) idx.push(A, Bv, C, Bv, D, C);
          else idx.push(A, C, Bv, Bv, C, D);
        }
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    g.setAttribute("aFaceMeta", new T.Float32BufferAttribute(faceMeta, 4));
    g.setAttribute("aFacsMeta", new T.Float32BufferAttribute(facsMeta, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.setAttribute("aBindPos", new T.Float32BufferAttribute(Float32Array.from(pos), 3));
    g.setAttribute("aBindNrm", new T.Float32BufferAttribute(Float32Array.from(g.attributes.normal.array), 3));
    return g;
  }

  /* Curved 3D Feathered Eyelash Ribbon Geometry (rides uLid / lLid on r=11.0mm globe) */
  let cachedLashGeos = null;
  function getEyelashGeos(T) {
    if (cachedLashGeos) return cachedLashGeos;
    const makeArc = (isUpper, side) => {
      const segs = 16;
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const phi = lerp(-0.52, 0.58, u) * side;
        const rBase = isUpper ? 0.0124 : 0.0122;
        const yOff = isUpper ? 0.0001 : -0.0001;
        const x0 = Math.sin(phi) * rBase;
        const z0 = Math.cos(phi) * rBase;

        const lashLen = (isUpper ? 0.00125 : 0.00065) * Math.sin(u * Math.PI);
        const curlY = isUpper ? lashLen * 0.16 : -lashLen * 0.22;
        const curlZ = lashLen * 0.96;
        const flareX = Math.sin(phi) * lashLen * 0.28;

        pos.push(x0, yOff, z0);
        uv.push(u, 0.02);
        pos.push(x0 + flareX, yOff + curlY, z0 + curlZ);
        uv.push(u, 0.98);
      }
      for (let i = 0; i < segs; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    cachedLashGeos = {
      uL: makeArc(true, 1),
      uR: makeArc(true, -1),
      lL: makeArc(false, 1),
      lR: makeArc(false, -1)
    };
    return cachedLashGeos;
  }

  /* Cornea Bulge Geometry: Sphere r=0.01185 with +0.00036m anterior corneal dome over the iris (tucked cleanly inside r=0.01245 uLid!) */
  let cachedCorneaGeo = null;
  function getCorneaBulgeGeo(T) {
    if (cachedCorneaGeo) return cachedCorneaGeo;
    const g = new T.SphereGeometry(0.01185, 24, 18);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const r = Math.hypot(vx, vy, vz) || 1;
      const cosPupil = vx / r;
      if (cosPupil > 0.78) {
        const dome = smooth(0.78, 1.0, cosPupil) * 0.00036;
        const sc = (r + dome) / r;
        p.setXYZ(i, vx * sc, vy * sc, vz * sc);
      }
    }
    g.computeVertexNormals();
    cachedCorneaGeo = g;
    return g;
  }

  function discoverCharacterHeadContext(headAnchor) {
    let root = headAnchor;
    while (root && root.parent && root.parent.type !== "Scene") {
      root = root.parent;
    }
    let facsUniforms = null, cyanGlow = null, evalOrbitalSkinZ = null, evalHeadPoreUV = null;
    if (root && root.traverse) {
      root.traverse(obj => {
        if (obj.material && obj.material.userData) {
          if (!facsUniforms && obj.material.userData.facsUniforms) facsUniforms = obj.material.userData.facsUniforms;
          if (!cyanGlow && obj.material.userData.cyanGlow) cyanGlow = obj.material.userData.cyanGlow;
        }
        if (obj.geometry && obj.geometry.userData) {
          if (!evalOrbitalSkinZ && obj.geometry.userData.evalOrbitalSkinZ) evalOrbitalSkinZ = obj.geometry.userData.evalOrbitalSkinZ;
          if (!evalHeadPoreUV && obj.geometry.userData.evalHeadPoreUV) evalHeadPoreUV = obj.geometry.userData.evalHeadPoreUV;
        }
      });
    }
    return { root, facsUniforms, cyanGlow, evalOrbitalSkinZ, evalHeadPoreUV };
  }

  function buildWetEyeAssembly(T, headAnchor, assetsV3, skinMatHeadRigid, spec = {}) {
    const portrait = selectPortraitArchetype(spec, assetsV3);
    const SG = typeof window !== "undefined" ? window.ScionEyeGlobe : null;
    const SE = typeof window !== "undefined" ? window.ScionEyelids : null;

    // Delegate ocular globe, concave iris, wet cornea, caruncle, 72x14 spherical-wrap eyelids & 3D micro-lashes to ScionEyeGlobe + ScionEyelids!
    if (SG && SE && typeof SG.createEyeApparatus === "function" && typeof SE.createRig === "function") {
      const ctx = discoverCharacterHeadContext(headAnchor);
      const useHazel = (spec.skinHex !== undefined && spec.skinHex > 0x705040);
      const irisHex = spec.irisHex !== undefined ? spec.irisHex : (useHazel ? 0x5c3c20 : 0x3b2112);
      const orbitalColorLin = portrait
        ? (portrait.canonicalSkinLin ? portrait.canonicalSkinLin.value : (portrait.orbitalSkinLin ? portrait.orbitalSkinLin.value : (portrait.cheekSkinLin ? portrait.cheekSkinLin.value : null)))
        : null;

      const scionEyes = SG.createEyeApparatus(T, {
        headAnchor,
        irisHex,
        skinColorLin: orbitalColorLin,
        cyanGlowUniform: ctx.cyanGlow
      });

      const scionLids = SE.createRig(T, {
        headAnchor,
        spec,
        portrait,
        skinColorLin: orbitalColorLin,
        facsUniforms: ctx.facsUniforms,
        cyanGlowUniform: ctx.cyanGlow,
        evalOrbitalSkinZ: ctx.evalOrbitalSkinZ || undefined,
        evalHeadPoreUV: ctx.evalHeadPoreUV || undefined,
        eyeApparatus: scionEyes
      });
      if (orbitalColorLin && scionLids && typeof scionLids.syncSkinColor === "function") {
        scionLids.syncSkinColor(orbitalColorLin);
      }

      if (portrait && portrait.lidListeners) {
        portrait.lidListeners.push(linVec => {
          const canonV = portrait.canonicalSkinLin ? portrait.canonicalSkinLin.value : linVec;
          if (scionEyes && typeof scionEyes.syncSkinColor === "function") scionEyes.syncSkinColor(canonV);
          if (scionLids && typeof scionLids.syncSkinColor === "function") scionLids.syncSkinColor(canonV);
        });
      }
      if (scionEyes && typeof scionEyes.setLidShadow === "function") {
        if (scionLids && typeof scionLids.getEffectiveAperture === "function") {
          const ap = scionLids.getEffectiveAperture();
          scionEyes.setLidShadow(ap.openL, ap.openR, ap.squint || 0.0);
        } else {
          scionEyes.setLidShadow(1.0, 1.0, 0.0);
        }
      }

      headAnchor.userData = headAnchor.userData || {};
      headAnchor.userData.scionEyes = scionEyes;
      headAnchor.userData.scionLids = scionLids;
      if (ctx.root) {
        ctx.root.userData = ctx.root.userData || {};
        ctx.root.userData.scionEyes = scionEyes;
        ctx.root.userData.scionLids = scionLids;
      }

      const lids = [];
      Object.defineProperty(lids, "scionEyes", { value: scionEyes, enumerable: false });
      Object.defineProperty(lids, "scionLids", { value: scionLids, enumerable: false });
      headAnchor.userData.wetLids = lids;
      return lids;
    }

    const lids = [];
    const lashGeos = getEyelashGeos(T);
    const corneaGeo = getCorneaBulgeGeo(T);
    const useHazel = (spec.skinHex !== undefined && spec.skinHex > 0x705040);
    const eyeMat = useHazel ? assetsV3.eyeMatHazel : assetsV3.eyeMatDark;

    // Clean dedicated tarsal eyelid material (NEVER clone skinMatHeadRigid, which carries head portrait projection shader!)
    const lidMat = new T.MeshStandardMaterial({
      color: spec.skinHex !== undefined ? spec.skinHex : 0x3b261b,
      roughness: 0.76,
      metalness: 0.02
    });
    const isLinearColorApi = new T.Color(0x808080).r < 0.35;
    const syncLidColor = linVec => {
      const lx = Math.max(0.001, linVec.x * 0.82);
      const ly = Math.max(0.001, linVec.y * 0.82);
      const lz = Math.max(0.001, linVec.z * 0.82);
      if (isLinearColorApi) {
        lidMat.color.setRGB(lx, ly, lz);
      } else {
        lidMat.color.setRGB(Math.pow(lx, 1 / 2.2), Math.pow(ly, 1 / 2.2), Math.pow(lz, 1 / 2.2));
      }
    };
    if (portrait && portrait.cheekSkinLin) {
      syncLidColor(portrait.cheekSkinLin.value);
      if (portrait.lidListeners) portrait.lidListeners.push(syncLidColor);
    }

    for (const s of [1, -1]) {
      const ex = s * 0.0310, ey = 1.6160, ez = 0.0614;

      const eyeGrp = new T.Group();
      eyeGrp.position.set(ex, ey, ez);
      eyeGrp.rotation.order = "YXZ";
      eyeGrp.rotation.y = -Math.PI * 0.5;

      const eyeBall = new T.Mesh(new T.SphereGeometry(0.0118, 24, 18), eyeMat);
      eyeBall.castShadow = false;
      eyeGrp.add(eyeBall);

      const cornea = new T.Mesh(corneaGeo, assetsV3.corneaMat);
      cornea.castShadow = false;
      cornea.renderOrder = 3;
      eyeGrp.add(cornea);
      headAnchor.add(eyeGrp);

      const caruncle = new T.Mesh(new T.SphereGeometry(0.00085, 8, 6), assetsV3.caruncleMat);
      caruncle.scale.set(1.25, 0.80, 0.72);
      caruncle.position.set(ex - s * 0.0092, ey - 0.0003, ez + 0.0092);
      caruncle.castShadow = false;
      headAnchor.add(caruncle);

      const mPts = [];
      for (let k = -3; k <= 3; k++) {
        const phi = (k / 3) * 0.42;
        mPts.push(new T.Vector3(
          Math.sin(phi) * 0.0119,
          -0.0028 - 0.0006 * Math.cos(phi * 2.4),
          Math.cos(phi) * 0.0119
        ));
      }
      const meniscusGeo = new T.TubeGeometry(new T.CatmullRomCurve3(mPts), 12, 0.00016, 5, false);
      const meniscus = new T.Mesh(meniscusGeo, assetsV3.tearMeniscusMat);
      meniscus.position.set(ex, ey, ez);
      meniscus.castShadow = false;
      meniscus.renderOrder = 4;
      headAnchor.add(meniscus);

      const uLid = new T.Mesh(
        new T.SphereGeometry(0.01245, 22, 10, Math.PI * 0.14, Math.PI * 0.72, Math.PI * 0.06, Math.PI * 0.44),
        lidMat
      );
      uLid.position.set(ex, ey, ez);
      uLid.rotation.x = -0.18;
      uLid.castShadow = false;
      headAnchor.add(uLid);

      const uLash = new T.Mesh(s > 0 ? lashGeos.uL : lashGeos.uR, assetsV3.eyelashMat);
      uLash.scale.setScalar(0.96);
      uLash.castShadow = false;
      uLid.add(uLash);

      const lLid = new T.Object3D();
      lLid.position.set(ex, ey, ez);
      headAnchor.add(lLid);

      const lLash = new T.Mesh(s > 0 ? lashGeos.lL : lashGeos.lR, assetsV3.eyelashMat);
      lLash.castShadow = false;
      lLid.add(lLash);

      lids.push({ eye: eyeGrp, uLid, lLid, s });
    }
    headAnchor.userData.wetLids = lids;
    return lids;
  }

  /* ============================================================================
     4. DUAL-AXIS PHOTOGRAPHIC PORTRAIT + MELANIN-MATCHED NECK + GPU FACS SHADER
     ============================================================================ */
  const GLSL_FACS_HELPERS =
    "float facsG1(float x, float c, float w) { float d = (x - c) / w; return exp(-d * d); }\n" +
    "float facsG2(float x, float y, float cx, float cy, float wx, float wy) { float dx = (x - cx) / wx; float dy = (y - cy) / wy; return exp(-(dx * dx + dy * dy)); }\n" +
    "vec3 evalHumanFacsDisp(vec3 bp, vec4 fMeta, vec4 uA, vec4 uB, vec4 uC, vec4 uD) {\n" +
    "  float smile = uA.x, sad = uA.y, funnel = uA.z, stretch = uA.w;\n" +
    "  float browIn = uB.x, browOut = uB.y, furrow = uB.z, squint = uB.w;\n" +
    "  float wide = uC.x, lipPress = uC.y, noseWr = uC.z, chinUp = uC.w;\n" +
    "  float lipTuck = uD.w;\n" +
    "  float ax = abs(bp.x);\n" +
    "  float sx = clamp(bp.x / 0.008, -1.0, 1.0);\n" +
    "  float fwd = smoothstep(-0.005, 0.052, bp.z) * (1.0 - smoothstep(0.72, 0.96, fMeta.z));\n" +
    "  vec3 d = vec3(0.0);\n" +
    "  if (fwd < 0.001) return d;\n" +
    "  float lipSign = fMeta.x;\n" +
    "  float lidMob = fMeta.y;\n" +
    "  float rimaEdge = fMeta.w;\n" +
    "  // 1. Smile (AU12 + AU6) & Natural Clamped Sad Grief (AU15 + AU1 + AU17 — ZERO 4c62f3d6 mouth inversion!)\n" +
    "  float wComm = facsG2(ax, bp.y, 0.0245, 1.5525, 0.0155, 0.0140) * fwd;\n" +
    "  float wSadComm = facsG2(ax, bp.y, 0.0240, 1.5515, 0.0145, 0.0130) * fwd;\n" +
    "  float wCheek = facsG2(ax, bp.y, 0.0440, 1.5880, 0.0230, 0.0190) * fwd;\n" +
    "  float sadClamp = clamp(sad, 0.0, 0.85);\n" +
    "  d.x += sx * (0.0046 * smile + 0.0042 * stretch) * wComm + sx * 0.0006 * sadClamp * wSadComm;\n" +
    "  d.y += 0.0050 * smile * wComm - 0.0022 * sadClamp * wSadComm;\n" +
    "  d.z += (-0.0018 * smile - 0.0014 * stretch) * wComm - 0.0005 * sadClamp * wSadComm * (1.0 - rimaEdge);\n" +
    "  d.y += 0.0032 * smile * wCheek;\n" +
    "  d.z += 0.0024 * smile * wCheek;\n" +
    "  d.x += sx * 0.0015 * smile * wCheek;\n" +
    "  // Deepen nasolabial crease on smile & nose wrinkle\n" +
    "  float nlX = 0.019 + max(0.0, 1.578 - bp.y) * 0.35;\n" +
    "  float wNL = facsG1(ax, nlX, 0.0052) * smoothstep(1.542, 1.554, bp.y) * (1.0 - smoothstep(1.576, 1.586, bp.y)) * fwd;\n" +
    "  d.z -= 0.0018 * (smile + 0.6 * noseWr) * wNL;\n" +
    "  // 2. Protruding Rounded OO Lip Funnel (AU22), Rounded Open-Mouth Commissures & Stretch (EE)\n" +
    "  float wOrb = facsG2(ax, bp.y, 0.0, 1.5525, 0.033, 0.017) * fwd * (1.0 - 0.65 * fMeta.z);\n" +
    "  d.x -= bp.x * (0.44 * funnel + 0.17 * uD.x * (1.0 - 0.6 * smile)) * wOrb;\n" +
    "  d.z += 0.0062 * funnel * facsG2(ax, bp.y, 0.0, 1.5525, 0.022, 0.013) * fwd * (1.0 - 0.72 * fMeta.z);\n" +
    "  if (abs(lipSign) > 0.01) {\n" +
    "    float sgn = lipSign >= 0.0 ? 1.0 : -1.0;\n" +
    "    float wMidLip = facsG1(ax, 0.0, 0.0165) * abs(lipSign);\n" +
    "    // True circular/oval OO aperture: parts central 20mm vermilion into an O while pinching/sealing lateral corners (>11mm)!\n" +
    "    float oProfile = 1.65 * exp(-pow(ax / 0.0108, 2.0)) - 0.58 * smoothstep(0.010, 0.021, ax);\n" +
    "    d.y += sgn * (0.0029 * funnel * oProfile * abs(lipSign) + (0.0009 * stretch + 0.0028 * smile * max(0.0, sgn)) * wMidLip);\n" +
    "    // Round open-mouth oral commissures into soft fleshy U-corners (eliminating acute < / > razor triangles!)\n" +
    "    float wCornerRound = exp(-pow((ax - 0.0232) / 0.0046, 2.0)) * abs(lipSign) * (0.45 + 0.55 * rimaEdge);\n" +
    "    d.y += sgn * 0.0016 * uD.x * wCornerRound;\n" +
    "    // Bilabial Lip Press (MM/BB/PP): seals & rolls lips inward\n" +
    "    d.y -= sgn * 0.0012 * lipPress * abs(lipSign) * (0.4 + 0.6 * rimaEdge);\n" +
    "    d.z -= 0.0022 * lipPress * abs(lipSign) * (0.3 + 0.7 * rimaEdge);\n" +
    "    // Labiodental Tuck (FF/VV): tucks lower lip under upper incisors while lifting upper lip!\n" +
    "    if (sgn < 0.0) {\n" +
    "      d.z -= 0.0044 * lipTuck * abs(lipSign) * facsG1(ax, 0.0, 0.020);\n" +
    "      d.y += 0.0018 * lipTuck * abs(lipSign) * facsG1(ax, 0.0, 0.020);\n" +
    "    } else {\n" +
    "      d.y += (0.0018 * lipTuck + 0.0024 * noseWr) * abs(lipSign) * facsG1(ax, 0.0, 0.019);\n" +
    "    }\n" +
    "  }\n" +
    "  // 3. Nose Wrinkler & Alar Flare (AU9) + Chin Mentalis Pout/Dimple (AU17)\n" +
    "  float wAlar = facsG2(ax, bp.y, 0.0165, 1.578, 0.011, 0.009) * fwd;\n" +
    "  d.x += sx * 0.0022 * noseWr * wAlar;\n" +
    "  d.y += 0.0022 * noseWr * wAlar;\n" +
    "  float wChin = facsG2(ax, bp.y, 0.0, 1.522, 0.019, 0.011) * (1.0 - smoothstep(1.532, 1.542, bp.y)) * fwd;\n" +
    "  d.y += (0.0026 * chinUp + 0.0014 * sadClamp) * wChin;\n" +
    "  d.z += (0.0016 * chinUp + 0.0009 * sadClamp) * wChin;\n" +
    "  // 4. Brows: Oblique Inner Grief Arch (AU1), Outer Arch (AU2) & Glabellar Furrow (AU4)\n" +
    "  float wBrowIn  = facsG2(ax, bp.y, 0.0130, 1.636, 0.0175, 0.0165) * fwd;\n" +
    "  float wBrowOut = facsG2(ax, bp.y, 0.0370, 1.638, 0.0185, 0.0155) * fwd;\n" +
    "  float wFurrow  = facsG2(ax, bp.y, 0.0175, 1.635, 0.0220, 0.0140) * fwd;\n" +
    "  d.y += 0.0096 * browIn * wBrowIn + (0.0060 * browOut - 0.0026 * sad) * wBrowOut - 0.0044 * furrow * wFurrow;\n" +
    "  d.x -= sx * (0.0032 * furrow * wFurrow + 0.0022 * browIn * sad * wBrowIn);\n" +
    "  d.z += (0.0012 * (browIn + browOut) * max(wBrowIn, wBrowOut) + 0.0015 * furrow * wFurrow);\n" +
    "  float wGlabCrease = facsG2(ax, bp.y, 0.0062, 1.635, 0.0026, 0.010) * fwd;\n" +
    "  d.z -= 0.0016 * furrow * wGlabCrease;\n" +
    "  // 5. 36-Seg Almond Palpebral Eyelid Rim: Wide Eyes (AU5) & Duchenne Squint (AU6/AU7)\n" +
    "  if (abs(lidMob) > 0.001) {\n" +
    "    if (lidMob > 0.0) {\n" +
    "      float wU = lidMob;\n" +
    "      d.y += (0.0022 * wide - 0.00075 * squint - 0.00045 * furrow) * wU;\n" +
    "      d.z += (-0.0004 * wide + 0.00025 * squint) * wU;\n" +
    "    } else {\n" +
    "      float wL = -lidMob;\n" +
    "      float duch = clamp(squint + 0.45 * smile, 0.0, 1.0);\n" +
    "      d.y += (0.00095 * duch - 0.00075 * wide) * wL;\n" +
    "      d.z += (0.00025 * duch - 0.00015 * wide) * wL;\n" +
    "    }\n" +
    "  }\n" +
    "  return d;\n" +
    "}\n";

  function createSharedFacsUniformBundle(T) {
    return {
      uFacsA: { value: new T.Vector4(0, 0, 0, 0) }, // smile, sad, mouthFunnel, mouthStretch
      uFacsB: { value: new T.Vector4(0, 0, 0, 0) }, // browUpInner, browUpOuter, browFurrow, squint
      uFacsC: { value: new T.Vector4(0, 0, 0, 0) }, // wideEyes, lipPress, noseWrinkle, chinRaise
      uFacsD: { value: new T.Vector4(0, 0, 0, 0) }, // jawOpen, tongueLift, tongueOut, lowerLipTuck
      uNeckLean: { value: new T.Vector4(0, 0, 0, 0) } // leanRollRz, leanPitchRx, headYawRy, glideX
    };
  }

  const GLSL_NECK_LEAN_HELPERS =
    "// Dynamic contralateral Sternocleidomastoid (SCM) cord & supraclavicular hollow relief + compressed-side volume preservation on neck lean/turn!\n" +
    "void evalDynamicNeckLean(vec3 bp, vec3 bn, vec4 uLean, out vec3 dPos, out vec3 dNrm, out float scmShade) {\n" +
    "  dPos = vec3(0.0); dNrm = vec3(0.0); scmShade = 0.0;\n" +
    "  if (bp.y <= 1.394 || bp.y >= 1.536) return;\n" +
    "  float leanRoll  = clamp(uLean.x, -0.60, 0.60);\n" +
    "  float leanPitch = clamp(uLean.y, -0.55, 0.55);\n" +
    "  float headYaw   = clamp(uLean.z, -0.85, 0.85);\n" +
    "  float sLat = bp.x >= 0.0 ? 1.0 : -1.0;\n" +
    "  float ax = abs(bp.x);\n" +
    "  // +leanRoll (+Z rot) leans head toward -X (screen-left), stretching +X contralateral SCM; +headYaw (+Y rot) turns nose toward +X, contracting -X SCM!\n" +
    "  float stretchLat = smoothstep(0.08, 0.42, sLat * leanRoll);\n" +
    "  float stretchYaw = smoothstep(0.10, 0.54, -sLat * headYaw) * 0.78;\n" +
    "  float stretchExt = smoothstep(0.08, 0.40, -leanPitch) * 0.65;\n" +
    "  float scmTaut = clamp(stretchLat + stretchYaw + stretchExt, 0.0, 1.25);\n" +
    "  if (scmTaut > 0.002) {\n" +
    "    float tScm = clamp((bp.y - 1.409) / (1.534 - 1.409), 0.0, 1.0);\n" +
    "    float xScm = mix(0.0125, 0.0530, tScm);\n" +
    "    float zScm = mix(0.0480, -0.0140, tScm);\n" +
    "    float yEnv = smoothstep(1.402, 1.420, bp.y) * (1.0 - smoothstep(1.515, 1.534, bp.y));\n" +
    "    float zEnv = exp(-pow((bp.z - zScm) / 0.028, 2.0));\n" +
    "    float dxScm = (ax - xScm) / 0.0098;\n" +
    "    float wCord = exp(-dxScm * dxScm) * zEnv * yEnv;\n" +
    "    float wHollow = exp(-pow((ax - (xScm + 0.0165)) / 0.0128, 2.0)) * smoothstep(-0.006, 0.036, bp.z) * smoothstep(1.406, 1.422, bp.y) * (1.0 - smoothstep(1.468, 1.494, bp.y));\n" +
    "    float radialPush = scmTaut * (0.0032 * wCord - 0.0020 * wHollow);\n" +
    "    vec3 radDir = normalize(vec3(bn.x, 0.0, bn.z) + vec3(0.0, 0.0, 0.001));\n" +
    "    dPos += radDir * radialPush;\n" +
    "    float nrmTiltX = -sLat * scmTaut * (0.26 * (-2.0 * dxScm) * wCord);\n" +
    "    dNrm = vec3(nrmTiltX, 0.0, scmTaut * (0.12 * wCord - 0.10 * wHollow));\n" +
    "    scmShade = scmTaut * (0.042 * wCord - 0.052 * wHollow);\n" +
    "  }\n" +
    "  // Subtle ipsilateral soft-tissue volume preservation on compressed concave side of a 24 deg lateral lean (zero polygon pinch!)\n" +
    "  float compLat = smoothstep(0.08, 0.44, -sLat * leanRoll);\n" +
    "  if (compLat > 0.002) {\n" +
    "    float compBell = sin(clamp((bp.y - 1.410) / 0.105, 0.0, 1.0) * 3.14159265);\n" +
    "    float latMask = smoothstep(0.020, 0.046, ax) * (1.0 - smoothstep(0.070, 0.106, ax));\n" +
    "    dPos.x += sLat * 0.0028 * compLat * compBell * latMask;\n" +
    "    dPos.z += 0.0010 * compLat * compBell * latMask * clamp(bp.z * 20.0, -1.0, 1.0);\n" +
    "  }\n" +
    "}\n";

  function applyDualPortraitSubsurfaceShader(T, mat, cfg) {
    const portrait = cfg.portrait;
    const cyanGlow = cfg.cyanGlow;
    const facsBundle = cfg.facsUniforms || createSharedFacsUniformBundle(T);
    if (!facsBundle.uNeckLean) {
      facsBundle.uNeckLean = { value: new T.Vector4(0, 0, 0, 0) };
    }
    mat.userData = mat.userData || {};
    mat.userData.facsUniforms = facsBundle;
    mat.userData.uNeckLean = facsBundle.uNeckLean;
    mat.userData.neckLeanUniform = facsBundle.uNeckLean;
    mat.userData.portrait = portrait;
    mat.userData.cyanGlow = cyanGlow;

    const uFaceCfg = {
      value: new T.Vector4(
        cfg.photoMix !== undefined ? cfg.photoMix : 0.87,
        cfg.sssStrength !== undefined ? cfg.sssStrength : 0.36,
        cfg.beardKeep ? 1.0 : 0.0,
        cfg.hairlineStrength !== undefined ? cfg.hairlineStrength : 0.72
      )
    };
    const uHairRootCol = {
      value: (cfg.hairRootColor || new T.Color(0x14100e)).clone()
    };

    mat.onBeforeCompile = sh => {
      const canonUniform = (portrait && portrait.canonicalSkinLin)
        || (portrait && portrait.cheekSkinLin)
        || { value: new T.Vector3(0.160, 0.062, 0.034) };
      sh.uniforms.tHeadFront = { value: portrait.front };
      sh.uniforms.tHeadSide = { value: portrait.side };
      sh.uniforms.uHeadFrontU = { value: portrait.frontU };
      sh.uniforms.uHeadFrontV = { value: portrait.frontV };
      sh.uniforms.uHeadSideU = { value: portrait.sideU };
      sh.uniforms.uHeadSideV = { value: portrait.sideV };
      sh.uniforms.uFaceCfg = uFaceCfg;
      sh.uniforms.uHairRootCol = uHairRootCol;
      sh.uniforms.uCyanGlow = cyanGlow;
      sh.uniforms.uSideLumScale = portrait.sideLumScale || { value: 1.0 };
      sh.uniforms.uCanonicalSkinLin = canonUniform;
      sh.uniforms.uCheekSkinLin = canonUniform;
      sh.uniforms.uFacsA = facsBundle.uFacsA;
      sh.uniforms.uFacsB = facsBundle.uFacsB;
      sh.uniforms.uFacsC = facsBundle.uFacsC;
      sh.uniforms.uFacsD = facsBundle.uFacsD;
      sh.uniforms.uNeckLean = facsBundle.uNeckLean;
      mat.userData.shaderUniforms = sh.uniforms;

      sh.vertexShader =
        "attribute vec4 aFaceMeta;\nattribute vec4 aFacsMeta;\nattribute vec3 aBindPos;\nattribute vec3 aBindNrm;\n" +
        "uniform vec4 uFacsA, uFacsB, uFacsC, uFacsD, uNeckLean;\n" +
        "varying vec4 vFaceMeta;\nvarying vec4 vFacsMeta;\nvarying vec3 vBindPos;\nvarying vec3 vBindNrm;\nvarying vec2 vPoreUv;\nvarying vec3 vVertShade;\nvarying float vScmShade;\n" +
        GLSL_FACS_HELPERS +
        GLSL_NECK_LEAN_HELPERS +
        sh.vertexShader
          .replace(
            "#include <beginnormal_vertex>",
            "#include <beginnormal_vertex>\n" +
            "vec3 dLeanPosN, dLeanNrmN; float scmShN;\n" +
            "evalDynamicNeckLean(aBindPos, aBindNrm, uNeckLean, dLeanPosN, dLeanNrmN, scmShN);\n" +
            "objectNormal = normalize(objectNormal + dLeanNrmN);"
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\n" +
            "vec3 dLeanPos, dLeanNrm; float scmShV;\n" +
            "evalDynamicNeckLean(aBindPos, aBindNrm, uNeckLean, dLeanPos, dLeanNrm, scmShV);\n" +
            "transformed += evalHumanFacsDisp(position, aFacsMeta, uFacsA, uFacsB, uFacsC, uFacsD) + dLeanPos;\n" +
            "vFaceMeta = aFaceMeta;\nvFacsMeta = aFacsMeta;\nvBindPos = aBindPos;\nvBindNrm = aBindNrm;\nvPoreUv = uv;\nvScmShade = scmShV;\n" +
            "#ifdef USE_COLOR\n  vVertShade = color.rgb;\n#else\n  vVertShade = vec3(1.0);\n#endif"
          );

      sh.fragmentShader =
        "uniform sampler2D tHeadFront, tHeadSide;\n" +
        "uniform vec4 uHeadFrontU, uHeadFrontV, uHeadSideU, uHeadSideV;\n" +
        "uniform vec4 uFaceCfg;\nuniform vec3 uHairRootCol;\nuniform vec4 uCyanGlow;\nuniform float uSideLumScale;\nuniform vec3 uCanonicalSkinLin, uCheekSkinLin;\n" +
        "uniform vec4 uFacsA, uFacsB, uFacsC, uFacsD, uNeckLean;\n" +
        "varying vec4 vFaceMeta;\nvarying vec4 vFacsMeta;\nvarying vec3 vBindPos;\nvarying vec3 vBindNrm;\nvarying vec2 vPoreUv;\nvarying vec3 vVertShade;\nvarying float vScmShade;\n" +
        "vec3 headSampleLod(sampler2D tex, vec2 uv, float lod) {\n" +
        "#if __VERSION__ == 300\n" +
        "  return textureLod(tex, uv, lod).rgb;\n" +
        "#else\n" +
        "  return texture2D(tex, uv, lod).rgb;\n" +
        "#endif\n" +
        "}\n" +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "// 1. Unified Canonical Linear Skin Albedo across 3D neck, submental shelf, 1.408m clavicles, chest, ears & crown (1:1 with arms & hands!)\n" +
            "float cLumRef = max(0.008, dot(uCanonicalSkinLin, vec3(0.299, 0.587, 0.114)));\n" +
            "float dGrainA = fract(sin(dot(floor(vBindPos.xy * 980.0 + vBindPos.z * 790.0), vec2(12.9898, 78.233))) * 43758.5453);\n" +
            "float dGrainB = sin(vBindPos.x * 460.0 + sin(vBindPos.y * 520.0 + vBindPos.z * 380.0)) * 0.5 + 0.5;\n" +
            "float dermalGrain = 1.0 + ((dGrainA - 0.5) * 0.042 + (dGrainB - 0.5) * 0.028);\n" +
            "vec3 baseDermalSkin = uCanonicalSkinLin * vVertShade * dermalGrain * (1.0 + vScmShade);\n" +
            "diffuseColor.rgb = baseDermalSkin;\n" +
            "float mucosaDepth = vFacsMeta.z;\n" +
            "float openAmtM = smoothstep(0.02, 0.14, uFacsD.x + uFacsA.z * 0.38);\n" +
            "if (mucosaDepth < 0.36) {\n" +
            "  float wFront = vFaceMeta.x;\n" +
            "  float wSide = vFaceMeta.y;\n" +
            "  float wTot = wFront + wSide;\n" +
            "  if (wTot > 0.002) {\n" +
            "    // When mouth parts open, nudge rima margin sample +/-2.2mm into pure upper/lower vermilion so closed lip-seam shadow never smears!\n" +
            "    float openAmt = openAmtM;\n" +
            "    float lipUvShiftY = (vFacsMeta.x >= 0.0 ? 1.0 : -1.0) * 0.0022 * openAmt * vFacsMeta.w;\n" +
            "    vec3 sampleBind = vec3(vBindPos.x, vBindPos.y + lipUvShiftY, vBindPos.z);\n" +
            "    vec4 hpF = vec4(sampleBind, 1.0);\n" +
            "    vec4 hpS = vec4(0.0, sampleBind.y, sampleBind.z, 1.0);\n" +
            "    vec2 uvF = clamp(vec2(dot(uHeadFrontU, hpF), dot(uHeadFrontV, hpF)), vec2(0.28, 0.165), vec2(0.72, 0.86));\n" +
            "    vec2 uvS = clamp(vec2(dot(uHeadSideU, hpS), dot(uHeadSideV, hpS)), vec2(0.20, 0.20), vec2(0.87, 0.88));\n" +
            "    vec3 sF = texture2D(tHeadFront, uvF).rgb;\n" +
            "    vec3 sS = texture2D(tHeadSide, uvS).rgb;\n" +
            "    float warmF = smoothstep(0.07, 0.19, (sF.r - sF.b) / max(0.05, sF.r));\n" +
            "    float warmS = smoothstep(0.08, 0.20, (sS.r - sS.b) / max(0.05, sS.r));\n" +
            "    float inCoreF = (1.0 - smoothstep(0.12, 0.17, abs(uvF.x - 0.5))) * smoothstep(0.22, 0.32, uvF.y) * (1.0 - smoothstep(0.64, 0.72, uvF.y));\n" +
            "    float notGreyF = smoothstep(0.030, 0.085, length(sF - vec3(0.2588)));\n" +
            "    float notClothF = (1.0 - smoothstep(0.46, 0.62, max(sF.r, max(sF.g, sF.b))) * (1.0 - warmF));\n" +
            "    float sideEyeMask = 1.0 - 0.94 * exp(-pow((uvS.x - 0.352) / 0.028, 2.0) - pow((uvS.y - 0.560) / 0.022, 2.0));\n" +
            "    float validF = max(warmF, inCoreF * notGreyF) * notClothF * smoothstep(0.168, 0.225, uvF.y);\n" +
            "    float validS = warmS * sideEyeMask;\n" +
            "    vec3 linF = pow(max(vec3(0.001), sF), vec3(2.2));\n" +
            "    vec3 linS = pow(max(vec3(0.001), sS), vec3(2.2)) * uSideLumScale;\n" +
            "    float wfE = wFront * validF;\n" +
            "    float wsE = wSide * validS;\n" +
            "    float wValidSum = wfE + wsE;\n" +
            "    if (wValidSum > 0.002) {\n" +
            "      vec3 pPhoto = (linF * wfE + linS * wsE) / wValidSum;\n" +
            "      // Two-Band Intrinsic Albedo Normalization: divide out broad studio flash hotspots & dark jaw-edge shadows (LOD 3.6)\n" +
            "      // while preserving 100% of crisp pores, brows, nostrils, vermilion lips & Elder's beard!\n" +
            "      vec2 uvLocF = clamp(uvF, vec2(0.32, 0.22), vec2(0.68, 0.78));\n" +
            "      vec2 uvLocS = clamp(uvS, vec2(0.28, 0.26), vec2(0.76, 0.78));\n" +
            "      vec3 locLinF = pow(max(vec3(0.002), headSampleLod(tHeadFront, uvLocF, 2.2)), vec3(2.2));\n" +
            "      vec3 locLinS = pow(max(vec3(0.002), headSampleLod(tHeadSide, uvLocS, 2.2)), vec3(2.2)) * uSideLumScale;\n" +
            "      vec3 pLoc = (locLinF * wfE + locLinS * wsE) / wValidSum;\n" +
            "\n" +
            "      float minEnvY = uFaceCfg.z > 0.5 ? 0.44 : 0.28;\n" +
            "      vec2 uvEnvF = clamp(uvF, vec2(0.34, minEnvY), vec2(0.66, 0.74));\n" +
            "      vec3 eF0 = headSampleLod(tHeadFront, uvEnvF, 3.6);\n" +
            "      vec3 eF1 = headSampleLod(tHeadFront, clamp(uvEnvF + vec2( 0.030, 0.0), vec2(0.34, minEnvY), vec2(0.66, 0.74)), 3.6);\n" +
            "      vec3 eF2 = headSampleLod(tHeadFront, clamp(uvEnvF + vec2(-0.030, 0.0), vec2(0.34, minEnvY), vec2(0.66, 0.74)), 3.6);\n" +
            "      vec3 eF3 = headSampleLod(tHeadFront, clamp(uvEnvF + vec2(0.0,  0.030), vec2(0.34, minEnvY), vec2(0.66, 0.74)), 3.6);\n" +
            "      vec3 eF4 = headSampleLod(tHeadFront, clamp(uvEnvF + vec2(0.0, -0.030), vec2(0.34, minEnvY), vec2(0.66, 0.74)), 3.6);\n" +
            "      vec3 envLinF = pow(max(vec3(0.004), (eF0 * 2.0 + eF1 + eF2 + eF3 + eF4) / 6.0), vec3(2.2));\n" +
            "      vec2 uvEnvS = clamp(vec2(uvS.x, max(minEnvY, uvS.y)), vec2(0.34, minEnvY), vec2(0.60, 0.72));\n" +
            "      vec3 envLinS = pow(max(vec3(0.004), headSampleLod(tHeadSide, uvEnvS, 3.6)), vec3(2.2)) * uSideLumScale;\n" +
            "      vec3 pBroad = (envLinF * wfE + envLinS * wsE) / wValidSum;\n" +
            "\n" +
            "      float pLum     = max(0.006, dot(pPhoto, vec3(0.299, 0.587, 0.114)));\n" +
            "      float locLum   = max(0.006, dot(pLoc,   vec3(0.299, 0.587, 0.114)));\n" +
            "      float broadLum = max(0.012, dot(pBroad, vec3(0.299, 0.587, 0.114)));\n" +
            "\n" +
            "      // Local scalar luminance normalization: centers pBroad directly on uvF (zero nose-bridge flash bias -> Cheek == Neck within <3%!)\n" +
            "      // and gates isDarkFeature strictly to achromatic hair/nostrils/beard x jawFeather (zero asymmetric chin shadow smudge!)\n" +
            "      float jawFeather = uFaceCfg.z > 0.5\n" +
            "        ? 1.0\n" +
            "        : smoothstep(1.514, 1.548, vBindPos.y - 0.012 * smoothstep(0.022, 0.054, abs(vBindPos.x)));\n" +
            "      float rawDarkFeat = (1.0 - smoothstep(0.26, 0.48, locLum / broadLum)) * (1.0 - smoothstep(0.08, 0.22, (sF.r - sF.b) / max(0.05, sF.r)));\n" +
            "      float isDarkFeature = uFaceCfg.z > 0.5\n" +
            "        ? clamp(rawDarkFeat + (1.0 - smoothstep(1.545, 1.582, vBindPos.y)) * (1.0 - smoothstep(0.34, 0.64, locLum / broadLum)), 0.0, 1.0)\n" +
            "        : (rawDarkFeat * jawFeather);\n" +
            "      float lipChroma = exp(-pow(vBindPos.x / 0.0235, 2.0) - pow((vBindPos.y - 1.5525) / 0.0085, 2.0)) * step(0.05, vBindPos.z);\n" +
            "      // Keep outer cheeks & V-jaw (|x| > 0.027 || y < 1.542) flat-matched (<3% to Neck/Chest/Arm/Hand),\n" +
            "      // while restoring crisp central T-zone (nose bridge, alar nostrils, philtrum, lips, glabella) sculpting!\n" +
            "      float tZoneMask = (1.0 - smoothstep(0.017, 0.027, abs(vBindPos.x))) * smoothstep(1.542, 1.556, vBindPos.y) * step(0.035, vBindPos.z);\n" +
            "      float skinMed = mix(clamp(locLum / broadLum, 0.96, 1.04), clamp(locLum / broadLum, 0.76, 1.20), tZoneMask);\n" +
            "      float featMed = clamp(locLum / broadLum, 0.18, 1.24);\n" +
            "      float effMed  = mix(mix(1.0, skinMed, max(0.16 * jawFeather, tZoneMask * 0.62)), featMed, isDarkFeature);\n" +
            "      float skinHi  = mix(clamp(pLum / locLum, 0.93, 1.07), clamp(pLum / locLum, 0.80, 1.18), tZoneMask);\n" +
            "      float featHi  = clamp(pLum / locLum, 0.24, 1.45);\n" +
            "      float effHi   = mix(mix(1.0, skinHi, max(0.36 + 0.30 * jawFeather, tZoneMask * 0.88)), featHi, max(isDarkFeature, lipChroma));\n" +
            "      float skinScalarDetail = effMed * effHi;\n" +
            "      vec3 dermalNormalized = uCanonicalSkinLin * vVertShade * skinScalarDetail;\n" +
            "\n" +
            "      // Preserve natural rose/plum vermilion lip chroma strictly inside vermilion border\n" +
            "      float coolLip = 1.0 - smoothstep(1.04, 1.38, pPhoto.r / max(0.004, pPhoto.b));\n" +
            "      vec3 pLipClean = mix(pPhoto, (uCanonicalSkinLin / cLumRef) * pLum, coolLip * 0.72);\n" +
            "      vec3 lipRgbRatio = clamp(pLipClean / max(vec3(0.012), pBroad), vec3(0.22), vec3(1.42));\n" +
            "      vec3 lipNormalized = uCanonicalSkinLin * vVertShade * mix(vec3(skinScalarDetail), lipRgbRatio, 0.86);\n" +
            "\n" +
            "      vec3 melAdapted = mix(dermalNormalized, lipNormalized, lipChroma);\n" +
            "      float effMix = clamp(wValidSum, 0.0, 1.0) * uFaceCfg.x;\n" +
            "      diffuseColor.rgb = mix(baseDermalSkin, melAdapted, effMix);\n" +
            "    }\n" +
            "  }\n" +
            "  // Dynamic FACS expression dermal micro-creases (glabellar '11' frown lines, grief arch, nasolabial & sad Marionette crease)\n" +
            "  if (vBindPos.z > 0.04) {\n" +
            "    float axF = abs(vBindPos.x);\n" +
            "    float glabCrease = uFacsB.z * exp(-pow((axF - 0.0062) / 0.0022, 2.0)) * exp(-pow((vBindPos.y - 1.635) / 0.0095, 2.0));\n" +
            "    float griefCrease = uFacsA.y * uFacsB.x * exp(-pow((axF - 0.0125) / 0.0065, 2.0)) * exp(-pow((vBindPos.y - 1.648) / 0.0055, 2.0));\n" +
            "    float marionette = uFacsA.y * exp(-pow((axF - (0.0245 + max(0.0, 1.550 - vBindPos.y) * 0.18)) / 0.0042, 2.0)) * smoothstep(1.528, 1.542, vBindPos.y) * (1.0 - smoothstep(1.550, 1.556, vBindPos.y));\n" +
            "    float nlLineF = 0.019 + max(0.0, 1.578 - vBindPos.y) * 0.35;\n" +
            "    float nlCrease = (uFacsA.x * 0.85 + uFacsC.z * 0.55) * exp(-pow((axF - nlLineF) / 0.0042, 2.0)) * smoothstep(1.543, 1.555, vBindPos.y) * (1.0 - smoothstep(1.575, 1.585, vBindPos.y));\n" +
            "    float browWave = (uFacsB.x + uFacsB.y) * 0.5 * (0.5 + 0.5 * sin((vBindPos.y - 1.652) * 520.0)) * exp(-pow(axF / 0.036, 2.0)) * exp(-pow((vBindPos.y - 1.660) / 0.012, 2.0));\n" +
            "    diffuseColor.rgb *= (1.0 - 0.22 * glabCrease - 0.16 * griefCrease - 0.09 * marionette - 0.14 * nlCrease - 0.08 * browWave);\n" +
            "  }\n" +
            "}\n" +
            "if (mucosaDepth > 0.01) {\n" +
            "  // Smoothly feather outer vermilion into wet inner mucosal lip roll -> deep velvet-burgundy oral cavity AO (zero closed-lip seam wire!)\n" +
            "  vec3 wetMucosa = mix(baseDermalSkin * vec3(1.22, 0.56, 0.54), vec3(0.118, 0.026, 0.028), 0.58);\n" +
            "  vec3 deepOralAO = vec3(0.0155, 0.0042, 0.0046);\n" +
            "  vec3 oralTarget = mix(wetMucosa, deepOralAO, smoothstep(0.32, 0.88, mucosaDepth));\n" +
            "  float mucosaBlend = smoothstep(mix(0.20, 0.03, openAmtM), mix(0.34, 0.18, openAmtM), mucosaDepth);\n" +
            "  diffuseColor.rgb = mix(diffuseColor.rgb, oralTarget, mucosaBlend);\n" +
            "}\n" +
            "// Smooth fibrous baby-hair & root fade along hairline\n" +
            "if (vFaceMeta.z > 0.005 && uFaceCfg.w > 0.01) {\n" +
            "  float hAng = atan(vBindPos.x, vBindPos.z + 0.015);\n" +
            "  float wisp = 0.5 + 0.5 * sin(hAng * 290.0 + sin(vBindPos.y * 180.0) * 2.4);\n" +
            "  float stipple = smoothstep(0.18, 0.95, vFaceMeta.z * (0.74 + 0.34 * wisp)) * uFaceCfg.w * 0.52;\n" +
            "  diffuseColor.rgb = mix(diffuseColor.rgb, uHairRootCol * 0.55, clamp(stipple, 0.0, 0.78));\n" +
            "}"
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\n" +
            "float lipSpec = exp(-pow((vBindPos.y - 1.549) / 0.008, 2.0)) * exp(-pow(vBindPos.x / 0.022, 2.0)) * step(0.06, vBindPos.z);\n" +
            "float microPore = (fract(sin(dot(floor(vBindPos.xy * 1150.0 + vBindPos.z * 870.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.024;\n" +
            "float baseLipRough = clamp(roughnessFactor - 0.12 * lipSpec + microPore, 0.60, 0.86);\n" +
            "float mOpen = smoothstep(0.02, 0.12, uFacsD.x + uFacsA.z * 0.40);\n" +
            "float wetM = mOpen * smoothstep(0.12, 0.28, vFacsMeta.z) * (1.0 - smoothstep(0.55, 0.72, vFacsMeta.z));\n" +
            "roughnessFactor = mix(baseLipRough, 0.32, wetM);"
          )
          .replace(
            "#include <aomap_fragment>",
            "#include <aomap_fragment>\n" +
            "// Physically-based dermal subsurface wrap-scatter & epidermal micro-facet sheen across curved facial/mandibular skin:\n" +
            "// prevents un-wrapped Lambertian N.L + GGX F0=0.04 off-axis drop from darkening curved cheeks/V-jaw relative to front-facing neck!\n" +
            "{\n" +
            "  float ndvFace = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);\n" +
            "  float faceZone = smoothstep(1.494, 1.522, vBindPos.y) * (1.0 - smoothstep(0.04, 0.25, vFacsMeta.z));\n" +
            "  float sssWrap = smoothstep(0.025, 0.30, 1.0 - ndvFace) * smoothstep(0.01, 0.14, ndvFace) * faceZone;\n" +
            "  float grazeBoost = smoothstep(0.45, 0.82, 1.0 - ndvFace) * smoothstep(0.01, 0.14, ndvFace) * faceZone;\n" +
            "  float baseD = max(0.006, dot(material.diffuseColor, vec3(0.2126, 0.7152, 0.0722)));\n" +
            "  float litD  = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3(0.2126, 0.7152, 0.0722));\n" +
            "  float lightEnv = clamp(litD / baseD, 0.0, 2.6);\n" +
            "  reflectedLight.directDiffuse *= (1.0 + 0.34 * sssWrap + 0.44 * grazeBoost);\n" +
            "  reflectedLight.indirectDiffuse *= (1.0 + 0.14 * sssWrap + 0.26 * grazeBoost);\n" +
            "  reflectedLight.directSpecular += vec3(0.0108) * (sssWrap + 0.48 * grazeBoost) * lightEnv;\n" +
            "}"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "vec3 Vdir = normalize(vViewPosition);\n" +
            "float ndv = abs(dot(normalize(vNormal), Vdir));\n" +
            "float nightDamp = 1.0 - clamp(uCyanGlow.w * 0.95, 0.0, 0.88);\n" +
            "float rimSSS = pow(1.0 - ndv, 2.8) * vFaceMeta.w * uFaceCfg.y * nightDamp;\n" +
            "totalEmissiveRadiance += diffuseColor.rgb * vec3(1.08, 0.94, 0.88) * (rimSSS * 0.22);\n" +
            "if (uCyanGlow.w > 0.001 && vFacsMeta.z < 0.25) {\n" +
            "  vec3 toS = vBindPos - uCyanGlow.xyz;\n" +
            "  float d2 = dot(toS, toS) + 0.032;\n" +
            "  float ndl = clamp(dot(normalize(vBindNrm), normalize(-toS)) * 0.65 + 0.35, 0.0, 1.0);\n" +
            "  float sockRecess = 0.65 * exp(-pow((abs(vBindPos.x) - 0.030) / 0.020, 2.0) - pow((vBindPos.y - 1.616) / 0.013, 2.0));\n" +
            "  float eyeGuard = (1.0 - sockRecess) * (1.0 - 0.48 * smoothstep(1.635, 1.695, vBindPos.y));\n" +
            "  float att = uCyanGlow.w * eyeGuard * ndl / (1.0 + 15.0 * d2);\n" +
            "  totalEmissiveRadiance += vec3(0.14, 0.72, 0.96) * att * (0.36 + 0.64 * diffuseColor.rgb);\n" +
            "}"
          );
    };
    mat.customProgramCacheKey = () => "v52DualPortraitCanonicalBust_v8";
    return mat;
  }

  /* ============================================================================
     5. WATERTIGHT 1-PIECE SKINNED ANATOMICAL HAND + PHOTOGRAPHIC HAND SHADER
     44-seg Wrist/Carpus -> Thumb Web Bifurcation (12-seg Thumb + 38-seg Metacarpus) ->
     3 Sloped Interdigital Skin Webs -> 4 x 14-seg Fingers + Recessed Fingernail Plates!
     ============================================================================ */
  let cachedWatertightHands = null;
  function getWatertightHandGeos(T) {
    if (cachedWatertightHands) return cachedWatertightHands;

    function buildCanonicalLeftHand() {
      const pos = [], uvs = [], handUv = [], handMeta = [], si = [], sw = [], idx = [];
      const addV = (x, y, z, u, v, hu, hv, dorsalW, nailW, sssW, aoW, b0, w0, b1, w1, b2 = 0, w2 = 0) => {
        const id = pos.length / 3;
        pos.push(x, y, z);
        uvs.push(u, v);
        handUv.push(clamp(hu, 0.04, 0.96), clamp(hv, 0.04, 0.96));
        handMeta.push(dorsalW, nailW, sssW, aoW);
        const tot = (w0 + w1 + w2) || 1;
        si.push(b0, b1, b2, 0);
        sw.push(w0 / tot, w1 / tot, w2 / tot, 0);
        return id;
      };

      const stitchLoops = (ringA, ringB) => {
        const N = ringA.length;
        for (let j = 0; j < N; j++) {
          const j1 = (j + 1) % N;
          const A = ringA[j], Bv = ringA[j1], C = ringB[j], D = ringB[j1];
          idx.push(A, Bv, C, Bv, D, C);
        }
      };

      // Helper mapping perimeter index j in 44-seg LoopW:
      // 0..16: Dorsal (-Z pinky to +Z index), 16..25: Radial/Thenar (+Z thumb bulge), 25..41: Palmar (+Z to -Z), 41..44: Ulnar (-Z)
      const angleOnLoop44 = j => {
        if (j <= 16) {
          // Dorsal face: z from -1 to +1, x > 0
          const u = j / 16;
          return lerp(-0.82 * Math.PI * 0.5, 0.82 * Math.PI * 0.5, u);
        } else if (j <= 25) {
          // Radial/Thenar face around +Z
          const u = (j - 16) / 9;
          return lerp(0.82 * Math.PI * 0.5, Math.PI - 0.82 * Math.PI * 0.5, u);
        } else if (j <= 41) {
          // Palmar face: z from +1 to -1, x < 0
          const u = (j - 25) / 16;
          return lerp(Math.PI - 0.82 * Math.PI * 0.5, Math.PI + 0.82 * Math.PI * 0.5, u);
        }
        const u = (j - 41) / 3;
        return lerp(Math.PI + 0.82 * Math.PI * 0.5, TAU - 0.82 * Math.PI * 0.5, u);
      };

      // --- PART A: Forearm/Wrist Cuff down to Thumb-Index Crotch (y = +0.024 to -0.032, 44 segs) ---
      const wristYLevels = [0.024, 0.012, 0.002, -0.009, -0.020, -0.032];
      const wristRings = [];
      for (let ri = 0; ri < wristYLevels.length; ri++) {
        const y = wristYLevels[ri];
        const ring = [];
        const tCarpus = smooth(0.025, -0.032, y);
        const rxBase = lerp(0.0230, 0.0165, tCarpus);
        const rzNeg  = lerp(0.0260, 0.0335, tCarpus);
        const rzPos  = lerp(0.0268, 0.0455, tCarpus); // Expands toward +Z thumb CMC & thenar pad!

        for (let j = 0; j < 44; j++) {
          const a = angleOnLoop44(j);
          const ca = Math.cos(a), sa = Math.sin(a); // ca > 0 = Dorsal (+X), ca < 0 = Palmar (-X), sa > 0 = Radial (+Z)
          let x = Math.sign(ca) * Math.pow(Math.abs(ca), 0.86) * rxBase;
          let z = sa >= 0 ? sa * rzPos : sa * rzNeg;

          // Anatomical landmarks: Ulnar styloid process bump at (y ~ 0.003, dorsal-ulnar) & Radial styloid
          const ulnarStyloid = g1(y, 0.003, 0.009) * smooth(-0.55, -0.95, sa) * smooth(0.0, 0.7, ca);
          x += 0.0028 * ulnarStyloid;
          z -= 0.0024 * ulnarStyloid;

          // Muscular Thenar Eminence pad on radial-palmar face (y = -0.012..-0.034, sa > 0.35, ca < 0.2)
          const thenar = smooth(0.002, -0.028, y) * smooth(0.25, 0.92, sa) * smooth(0.25, -0.75, ca);
          x -= 0.0068 * thenar;
          z += 0.0045 * thenar;

          // Hypothenar ulnar palmar pad
          const hypothenar = smooth(0.00, -0.032, y) * smooth(-0.35, -0.90, sa) * smooth(0.1, -0.8, ca);
          x -= 0.0036 * hypothenar;

          const dorsalW = smooth(-0.18, 0.22, ca);
          // Stay strictly inside hv <= 0.78 so wrist UVs NEVER cross the top crop border of hand_dorsal.jpg (~0.83) into #424242 bleed!
          const hu = clamp(0.51 - z * 4.5, 0.22, 0.78);
          const hv = clamp(0.75 + y * 1.15, 0.58, 0.78);

          const wHand = smooth(0.036, -0.006, y);
          const wThumbCmc = thenar * 0.48;
          const rem = 1 - wThumbCmc;
          // Monotonic axial wrist-fade: 0.0 down to y=+0.008 -> smooth 0..1 across y=+0.008..-0.028 carpus!
          const axialFadeV = clamp((0.008 - y) / 0.036, 0.0, 1.0);
          ring.push(addV(
            x, y, z, j / 44, axialFadeV, hu, hv,
            dorsalW, 0.0, 0.12 * thenar, 1.0,
            B.HAND_L, wHand * rem, B.FARM_TWIST_L, (1 - wHand) * rem, B.L_THUMB_1, wThumbCmc
          ));
        }
        wristRings.push(ring);
        if (ri > 0) stitchLoops(wristRings[ri - 1], ring);
      }

      // --- PART B: Thumb-Index First Interdigital Web Bifurcation at y = -0.032 ---
      const rCrotch = wristRings[wristRings.length - 1];
      // Bridge from Dorsal-Radial rCrotch[16] to Palmar-Radial rCrotch[25] via 2 concave saddle vertices
      const pD16 = [pos[rCrotch[16] * 3], pos[rCrotch[16] * 3 + 1], pos[rCrotch[16] * 3 + 2]];
      const pP25 = [pos[rCrotch[25] * 3], pos[rCrotch[25] * 3 + 1], pos[rCrotch[25] * 3 + 2]];
      const makeThumbWebPt = t => {
        const x = lerp(pD16[0], pP25[0], t);
        const y = lerp(pD16[1], pP25[1], t) - 0.0085 * Math.sin(t * Math.PI); // Sloped distal thumb-web fold!
        const z = 0.0325 - 0.0020 * Math.sin(t * Math.PI);
        const dW = 1 - t;
        return addV(
          x, y, z, 0.4, 1.0, 0.34, 0.66,
          dW, 0.0, 0.85, 0.90, // Strong warm subsurface scatter through thin thumb web!
          B.HAND_L, 0.62, B.L_THUMB_1, 0.38
        );
      };
      const twA = makeThumbWebPt(1 / 3);
      const twB = makeThumbWebPt(2 / 3);

      // Extract 12-vertex Thumb Base Loop (Dorsal 16 -> Radial 17..24 -> Palmar 25 -> Web twB, twA)
      const thumbLoop0 = [
        rCrotch[16], rCrotch[17], rCrotch[18], rCrotch[19], rCrotch[20],
        rCrotch[21], rCrotch[22], rCrotch[23], rCrotch[24], rCrotch[25],
        twB, twA
      ];

      // Sweep Thumb (9 rings along CMC -> MCP -> IP -> Tip + Thumbnail!)
      const tb = THUMB_BIND_SPEC;
      const thumbCurvePts = [
        [-0.0085, -0.034, 0.037],
        tb.mcp,
        [lerp(tb.mcp[0], tb.ip[0], 0.5), lerp(tb.mcp[1], tb.ip[1], 0.5), lerp(tb.mcp[2], tb.ip[2], 0.5)],
        tb.ip,
        [lerp(tb.ip[0], tb.tip[0], 0.42), lerp(tb.ip[1], tb.tip[1], 0.42), lerp(tb.ip[2], tb.tip[2], 0.42)],
        [lerp(tb.ip[0], tb.tip[0], 0.78), lerp(tb.ip[1], tb.tip[1], 0.78), lerp(tb.ip[2], tb.tip[2], 0.78)],
        tb.tip
      ];
      let prevThumbRing = thumbLoop0;
      for (let ti = 0; ti < thumbCurvePts.length; ti++) {
        const uT = (ti + 1) / thumbCurvePts.length;
        const c = thumbCurvePts[ti];
        const taper = ti === thumbCurvePts.length - 1 ? 0.52 : (1.0 - 0.24 * uT);
        const jointSwell = 1.0 + 0.08 * g1(uT, 0.28, 0.12) + 0.07 * g1(uT, 0.58, 0.10);
        const radX = 0.0094 * taper * jointSwell;
        const radZ = 0.0106 * taper * jointSwell;
        const inNail = uT > 0.62 && uT < 0.88 && ti < thumbCurvePts.length - 1;
        const ring = [];

        for (let k = 0; k < 12; k++) {
          // k=0..3 dorsal-lateral, k=3..6 radial ridge, k=6..9 palmar thumb pad, k=9..12 ulnar thumb side
          const ang = (k / 12) * TAU - 0.35;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          let ox = ca * radX;
          let oz = sa * radZ * 0.86;
          let oy = -sa * radZ * 0.48;

          // Fleshy palmar thumb pulp pad on ca < -0.3
          if (ca < -0.2 && uT > 0.55) {
            ox -= 0.0018 * (-ca) * Math.sin(((uT - 0.55) / 0.45) * Math.PI);
          }
          // Dorsal IP knuckle skin crease
          const ipCrease = g1(uT, 0.56, 0.05) * Math.max(0, ca);
          ox -= 0.0005 * ipCrease * (0.5 + 0.5 * Math.cos(uT * 260));

          // Sculpted recessed thumbnail bed & keratin nail plate strictly on dorsal face (ca > 0.58 -> zero palmar bleed!)
          let nailMask = 0.0;
          if (inNail && ca > 0.58) {
            const latW = smooth(0.58, 0.78, ca);
            const lenU = (uT - 0.62) / 0.26;
            const cuticleDip = g1(lenU, 0.08, 0.09);
            ox += (-0.0005 * cuticleDip + 0.00065 * smooth(0.08, 0.25, lenU)) * latW;
            nailMask = latW * smooth(0.05, 0.18, lenU) * (1.0 - smooth(0.88, 1.0, lenU));
          }

          // Smooth phalanx bone weights: L_THUMB_1 -> L_THUMB_2 -> L_THUMB_3
          let b0 = B.L_THUMB_1, b1 = B.L_THUMB_2, w0 = 1, w1 = 0;
          if (uT < 0.30) {
            w1 = smooth(0.14, 0.30, uT); w0 = 1 - w1;
          } else if (uT < 0.60) {
            b0 = B.L_THUMB_2; b1 = B.L_THUMB_3;
            w1 = smooth(0.48, 0.62, uT); w0 = 1 - w1;
          } else {
            b0 = B.L_THUMB_3; b1 = B.L_THUMB_2; w0 = 1; w1 = 0;
          }

          const dW = uT > 0.82 ? smooth(0.18, 0.55, ca) : smooth(-0.12, 0.26, ca);
          // Exact manifest.json thumb UV path: CMC (0.345,0.665) -> MCP (0.270,0.555) -> IP (0.222,0.485) -> Tip (0.180,0.438)
          const hu = lerp(0.325, 0.182, uT) - sa * 0.024;
          const hv = lerp(0.640, 0.440, uT);
          ring.push(addV(
            c[0] + ox, c[1] + oy, c[2] + oz,
            k / 12, 1.0 + uT * 0.35, hu, hv,
            dW, nailMask, smooth(0.55, 1.0, uT) * 0.55, 1.0 - 0.18 * ipCrease,
            b0, w0, b1, w1
          ));
        }
        stitchLoops(prevThumbRing, ring);
        prevThumbRing = ring;
      }
      // Watertight Thumb Tip Cap (strictly palmar-weighted so dorsal thumbnail texture never wraps onto thumb pad!)
      const thumbTipId = addV(
        tb.tip[0], tb.tip[1] - 0.0032, tb.tip[2] + 0.0018,
        0.5, 1.0, 0.180, 0.438,
        0.05, 0.0, 0.78, 1.0,
        B.L_THUMB_3, 1, B.L_THUMB_2, 0
      );
      for (let k = 0; k < 12; k++) {
        idx.push(prevThumbRing[k], prevThumbRing[(k + 1) % 12], thumbTipId);
      }

      // --- PART C: 38-Segment Metacarpal Dorsum & Palm (y = -0.032 down to Arched MCP Knuckles) ---
      const metaLoop0 = [
        ...rCrotch.slice(0, 17), // 0..16 Dorsal
        twA, twB,                // 17, 18 Thumb-web radial border
        ...rCrotch.slice(25, 44) // 19..34 Palmar (25..40) + 35..37 Ulnar (41..43)
      ]; // Exact 38 vertices!

      const angleOnLoop38 = j => {
        if (j <= 16) return lerp(-0.84 * Math.PI * 0.5, 0.84 * Math.PI * 0.5, j / 16);
        if (j <= 19) return lerp(0.84 * Math.PI * 0.5, Math.PI - 0.84 * Math.PI * 0.5, (j - 16) / 3);
        if (j <= 35) return lerp(Math.PI - 0.84 * Math.PI * 0.5, Math.PI + 0.84 * Math.PI * 0.5, (j - 19) / 16);
        return lerp(Math.PI + 0.84 * Math.PI * 0.5, TAU - 0.84 * Math.PI * 0.5, (j - 35) / 3);
      };

      const metaSteps = [0.34, 0.68, 1.00];
      let prevMetaRing = metaLoop0;
      for (let mi = 0; mi < metaSteps.length; mi++) {
        const sM = metaSteps[mi];
        const ring = [];
        for (let j = 0; j < 38; j++) {
          const a = angleOnLoop38(j);
          const ca = Math.cos(a), sa = Math.sin(a);
          const zSpan = lerp(0.0345, 0.0355, sM);
          let z = sa * zSpan;
          // Arched distal metacarpal knuckle curve (deepest at middle finger z ~ +0.008, curved back toward pinky -Z!)
          const archDrop = 0.0065 * g1(z, 0.008, 0.022) - 0.0055 * smooth(-0.008, -0.034, z);
          // Palmar distal margin sits ~5mm further distal (-Y) than dorsal web apex!
          const palmarSlope = ca < 0 ? (-ca) * 0.0048 * sM : 0;
          const y = lerp(-0.034, -0.0685, sM) - archDrop * sM - palmarSlope;

          let x = Math.sign(ca) * Math.pow(Math.abs(ca), 0.78) * lerp(0.0155, 0.0118, sM);

          // 4 Sculpted Dorsal Extensor Digitorum Tendon Ridges + 4 Prominent MCP Knuckle Domes!
          let creaseAO = 1.0;
          if (ca > 0.15) {
            for (let f = 0; f < 4; f++) {
              const fz = FINGER_BIND_SPECS[f].mcp[2];
              const tendonZ = lerp(fz * 0.35, fz, sM);
              const tendon = g1(z, tendonZ, 0.0042) * smooth(0.15, 0.90, ca) * (0.45 + 0.55 * sM);
              const knuckleDome = g1(z, fz, 0.0068) * smooth(0.55, 1.0, sM) * smooth(0.25, 0.95, ca);
              x += 0.0018 * tendon + 0.0038 * knuckleDome;
              creaseAO += 0.04 * (tendon + knuckleDome);
            }
            // Concave inter-metacarpal valleys between knuckle heads
            for (const wz of [0.0164, 0.000, -0.0160]) {
              const valley = g1(z, wz, 0.0045) * smooth(0.50, 1.0, sM) * smooth(0.2, 0.9, ca);
              x -= 0.0022 * valley;
              creaseAO -= 0.08 * valley;
            }
          } else {
            // Central palmar hollow + transverse palmar heart/head flexion creases!
            const palmHollow = g1(z, 0.002, 0.018) * g1(sM, 0.48, 0.35) * (-ca);
            const transverseCrease = (g1(sM, 0.62, 0.08) + g1(sM, 0.36, 0.08)) * (-ca) * smooth(-0.026, 0.026, -Math.abs(z) + 0.032);
            x += 0.0036 * palmHollow + 0.0008 * transverseCrease;
            creaseAO -= 0.12 * transverseCrease;
          }

          const dW = smooth(-0.18, 0.22, ca);
          const hu = clamp(0.51 - z * 5.2, 0.28, 0.76);
          const hv = lerp(0.68, 0.46, sM);

          // Blend distal knuckle ring smoothly into the nearest finger's MCP phalanx bone!
          let nearF = 0, bestDz = 99;
          for (let f = 0; f < 4; f++) {
            const dz = Math.abs(z - FINGER_BIND_SPECS[f].mcp[2]);
            if (dz < bestDz) { bestDz = dz; nearF = f; }
          }
          const bMcp = B.L_INDEX_1 + nearF * 3;
          const wFinger = smooth(0.62, 1.0, sM) * 0.36;
          ring.push(addV(
            x, y, z, j / 38, 1.0 + sM * 0.25, hu, hv,
            dW, 0.0, smooth(0.7, 1.0, sM) * 0.25, clamp(creaseAO, 0.72, 1.08),
            B.HAND_L, 1 - wFinger, bMcp, wFinger
          ));
        }
        stitchLoops(prevMetaRing, ring);
        prevMetaRing = ring;
      }

      // --- PART D: 3 Sloped Interdigital Skin Webs + 4 Seamless 14-Segment Fingers ---
      const rKnuckle = prevMetaRing;
      // Cleft 1 (Index|Middle): d=12, p=23; Cleft 2 (Middle|Ring): d=8, p=27; Cleft 3 (Ring|Pinky): d=4, p=31
      const makeFingerWeb = (dIdx, pIdx, zMid, bFingerA, bFingerB, huWeb) => {
        const dId = rKnuckle[dIdx], pId = rKnuckle[pIdx];
        const dx = pos[dId * 3], dy = pos[dId * 3 + 1];
        const px = pos[pId * 3], py = pos[pId * 3 + 1];
        const mk = t => {
          // Real human interdigital web slopes downward/distally from dorsal knuckles to palmar digital crease!
          const x = lerp(dx, px, t);
          const y = lerp(dy, py - 0.0035, t) - 0.0052 * Math.sin(t * Math.PI);
          return addV(
            x, y, zMid, 0.5, 0.62, huWeb, 0.44,
            1 - t, 0.0, 0.88, 0.88, // Rich translucent dermal scatter in finger webs!
            B.HAND_L, 0.46, bFingerA, 0.27, bFingerB, 0.27
          );
        };
        return [mk(1 / 3), mk(2 / 3)];
      };

      const [w1a, w1b] = makeFingerWeb(12, 23,  0.0164, B.L_INDEX_1, B.L_MID_1,   0.43);
      const [w2a, w2b] = makeFingerWeb(8,  27,  0.0000, B.L_MID_1,   B.L_RING_1,  0.54);
      const [w3a, w3b] = makeFingerWeb(4,  31, -0.0160, B.L_RING_1,  B.L_PINKY_1, 0.65);

      const fingerStartRings = [
        // f=0 Index (14 verts): Dorsal 12..16, Radial 17..19, Palmar 20..23, Web1 [w1b, w1a]
        [rKnuckle[12], rKnuckle[13], rKnuckle[14], rKnuckle[15], rKnuckle[16], rKnuckle[17], rKnuckle[18], rKnuckle[19], rKnuckle[20], rKnuckle[21], rKnuckle[22], rKnuckle[23], w1b, w1a],
        // f=1 Middle (14 verts): Dorsal 8..12, Web1 [w1a, w1b], Palmar 23..27, Web2 [w2b, w2a]
        [rKnuckle[8], rKnuckle[9], rKnuckle[10], rKnuckle[11], rKnuckle[12], w1a, w1b, rKnuckle[23], rKnuckle[24], rKnuckle[25], rKnuckle[26], rKnuckle[27], w2b, w2a],
        // f=2 Ring (14 verts): Dorsal 4..8, Web2 [w2a, w2b], Palmar 27..31, Web3 [w3b, w3a]
        [rKnuckle[4], rKnuckle[5], rKnuckle[6], rKnuckle[7], rKnuckle[8], w2a, w2b, rKnuckle[27], rKnuckle[28], rKnuckle[29], rKnuckle[30], rKnuckle[31], w3b, w3a],
        // f=3 Pinky (14 verts): Dorsal 0..4, Web3 [w3a, w3b], Palmar 31..35, Ulnar 36..37
        [rKnuckle[0], rKnuckle[1], rKnuckle[2], rKnuckle[3], rKnuckle[4], w3a, w3b, rKnuckle[31], rKnuckle[32], rKnuckle[33], rKnuckle[34], rKnuckle[35], rKnuckle[36], rKnuckle[37]]
      ];

      // Angle table around each 14-vertex finger ring (0..4 Dorsal, 4..7 Radial, 7..11 Palmar, 11..14 Ulnar)
      const angleOnFinger14 = k => {
        if (k <= 4) return lerp(-0.78 * Math.PI * 0.5, 0.78 * Math.PI * 0.5, k / 4);
        if (k <= 7) return lerp(0.78 * Math.PI * 0.5, Math.PI - 0.78 * Math.PI * 0.5, (k - 4) / 3);
        if (k <= 11) return lerp(Math.PI - 0.78 * Math.PI * 0.5, Math.PI + 0.78 * Math.PI * 0.5, (k - 7) / 4);
        return lerp(Math.PI + 0.78 * Math.PI * 0.5, TAU - 0.78 * Math.PI * 0.5, (k - 11) / 3);
      };

      for (let f = 0; f < 4; f++) {
        const fs = FINGER_BIND_SPECS[f];
        const b1 = B.L_INDEX_1 + f * 3, b2 = b1 + 1, b3 = b1 + 2;
        const totLen = fs.l1 + fs.l2 + fs.l3;
        const uPip = fs.l1 / totLen;
        const uDip = (fs.l1 + fs.l2) / totLen;
        const nRings = 11;
        let prevFRing = fingerStartRings[f];

        for (let ri = 1; ri <= nRings; ri++) {
          const uF = ri / nRings; // 0 -> 1 from MCP web to rounded fingertip
          const dist = uF * totLen;
          const cx = fs.mcp[0] - 0.0012 * uF; // Subtle natural slight palmar curve
          const cy = fs.mcp[1] - dist;
          const cz = fs.mcp[2] + Math.sin(fs.splay) * dist;

          // Bicondylar PIP/DIP joint widening + natural distal taper
          const tipRound = ri === nRings ? 0.54 : (ri === nRings - 1 ? 0.80 : 1.0);
          const taper = lerp(1.04, 0.74, uF) * tipRound;
          const jointWidenZ = 1.0 + 0.09 * g1(uF, uPip, 0.07) + 0.07 * g1(uF, uDip, 0.06);
          const rx = fs.r * 0.92 * taper;
          const rz = fs.r * 1.05 * taper * jointWidenZ;

          const pipCrease = g1(uF, uPip, 0.045);
          const dipCrease = g1(uF, uDip, 0.040);
          const nailStart = uDip + 0.055;
          // Keep distal ring (ri === nRings, uF > 0.89) at nailMask = 0 so nail never interpolates onto palmar fingertip pad!
          const inNail = uF > nailStart && uF < 0.895 && ri < nRings;

          // Multi-bone phalanx weights across MCP -> PIP -> DIP
          let skA = b1, skB = b2, wtA = 1, wtB = 0;
          if (uF < 0.14) {
            skA = b1; skB = B.HAND_L;
            wtA = smooth(0.0, 0.14, uF); wtB = 1 - wtA;
          } else if (uF < uPip + 0.10) {
            skA = b1; skB = b2;
            wtB = smooth(uPip - 0.09, uPip + 0.09, uF); wtA = 1 - wtB;
          } else {
            skA = b2; skB = b3;
            wtB = smooth(uDip - 0.08, uDip + 0.08, uF); wtA = 1 - wtB;
          }

          const ring = [];
          for (let k = 0; k < 14; k++) {
            const ang = angleOnFinger14(k);
            const ca = Math.cos(ang), sa = Math.sin(ang);
            // Slightly flatter dorsal phalanx plate, fuller convex palmar finger pad!
            let ox = ca >= 0 ? Math.pow(ca, 0.82) * rx : -Math.pow(-ca, 0.92) * rx * 1.06;
            const oz = sa * rz;
            let ao = 1.0;

            if (ca > 0.25) {
              // 3-line PIP & DIP dorsal knuckle skin folds!
              const wrinkle = 0.5 + 0.5 * Math.cos((uF - uPip) * 340.0);
              const dCrease = (pipCrease * (0.55 + 0.45 * wrinkle) + dipCrease * 0.75) * smooth(0.25, 0.85, ca);
              ox -= 0.00055 * dCrease;
              ao -= 0.14 * dCrease;
            } else if (ca < -0.25) {
              // Fleshy palmar phalanx belly pads + crisp palmar joint flexion creases!
              const belly = (g1(uF, uPip * 0.52, 0.16) + g1(uF, (uPip + uDip) * 0.5, 0.11) + g1(uF, (uDip + 0.96) * 0.5, 0.11)) * (-ca);
              const pJointCrease = (pipCrease + dipCrease) * (-ca);
              ox -= 0.0011 * belly - 0.0008 * pJointCrease;
              ao -= 0.15 * pJointCrease;
            }

            // Sculpted Recessed Eponychium Nail Fold + Convex Keratin Fingernail Plate (strictly dorsal ca > 0.58!)
            let nailMask = 0.0;
            if (inNail && k >= 1 && k <= 3) {
              const latU = Math.abs(k - 2) / 1.45;
              if (latU <= 0.96 && ca > 0.58) {
                const latMask = 1.0 - smooth(0.65, 0.96, latU);
                const lenN = (uF - nailStart) / Math.max(0.05, 0.895 - nailStart);
                const cuticleGroove = g1(lenN, 0.08, 0.09);
                const latGroove = g1(latU, 0.82, 0.10);
                ox += (-0.00050 * cuticleGroove - 0.00035 * latGroove + 0.00070 * smooth(0.08, 0.25, lenN)) * latMask;
                nailMask = clamp(latMask * smooth(0.05, 0.18, lenN) * (0.15 + 0.85 * lenN), 0, 1);
                ao -= 0.10 * (cuticleGroove + latGroove);
              }
            }

            const dW = uF > 0.84 ? smooth(0.20, 0.56, ca) : smooth(-0.12, 0.26, ca);
            // Map finger UVs cleanly down the exact manifest.json finger centerline of hand_dorsal.jpg & hand_palmar.jpg
            const hu = lerp(fs.mcpU, fs.tipU, uF) - sa * 0.028;
            const hv = lerp(fs.mcpV, fs.tipV, uF);
            ring.push(addV(
              cx + ox, cy, cz + oz,
              k / 14, 0.62 + uF * 0.38, hu, hv,
              dW, nailMask, smooth(0.60, 1.0, uF) * 0.65, clamp(ao, 0.72, 1.06),
              skA, wtA, skB, wtB
            ));
          }
          stitchLoops(prevFRing, ring);
          prevFRing = ring;
        }

        // Watertight Rounded Distal Fingertip Cap (palmar-weighted so dorsal nail texture never curls onto fingerpad!)
        const tipZ = fs.mcp[2] + Math.sin(fs.splay) * (totLen + 0.003);
        const tipId = addV(
          fs.mcp[0] - 0.0014, fs.mcp[1] - totLen - 0.0030, tipZ,
          0.5, 1.0, fs.tipU, fs.tipV,
          0.05, 0.0, 0.82, 1.0,
          b3, 1, b2, 0
        );
        for (let k = 0; k < 14; k++) {
          idx.push(prevFRing[k], prevFRing[(k + 1) % 14], tipId);
        }
      }

      // Shift bind positions from B_HAND local space into character world bind space when instantiated!
      return { pos, uvs, handUv, handMeta, si, sw, idx };
    }

    const baseL = buildCanonicalLeftHand();
    cachedWatertightHands = baseL;
    return cachedWatertightHands;
  }

  function buildCharacterSkinnedHandsGeo(T, skelInfo) {
    const raw = getWatertightHandGeos(T);
    const vPerHand = raw.pos.length / 3;
    const totalV = vPerHand * 2;

    const pos = new Float32Array(totalV * 3);
    const uvs = new Float32Array(totalV * 2);
    const handUv = new Float32Array(totalV * 2);
    const handMeta = new Float32Array(totalV * 4);
    const si = new Uint16Array(totalV * 4);
    const sw = new Float32Array(totalV * 4);
    const idx = [];

    const mapLeftBoneToRight = b => {
      if (b === B.HAND_L) return B.HAND_R;
      if (b === B.FARM_TWIST_L) return B.FARM_TWIST_R;
      if (b === B.FARM_L) return B.FARM_R;
      if (b >= B.L_THUMB_1 && b <= B.L_PINKY_3) return b + (B.R_THUMB_1 - B.L_THUMB_1);
      return b;
    };

    for (let h = 0; h < 2; h++) {
      const side = h === 0 ? 1 : -1;
      const bHandIdx = side > 0 ? B.HAND_L : B.HAND_R;
      const wb = skelInfo.bind[bHandIdx];
      const vo = h * vPerHand;

      for (let i = 0; i < vPerHand; i++) {
        pos[(vo + i) * 3]     = wb[0] + side * raw.pos[i * 3];
        pos[(vo + i) * 3 + 1] = wb[1] + raw.pos[i * 3 + 1];
        pos[(vo + i) * 3 + 2] = wb[2] + raw.pos[i * 3 + 2];

        uvs[(vo + i) * 2]     = raw.uvs[i * 2];
        uvs[(vo + i) * 2 + 1] = raw.uvs[i * 2 + 1];

        handUv[(vo + i) * 2]     = raw.handUv[i * 2];
        handUv[(vo + i) * 2 + 1] = raw.handUv[i * 2 + 1];

        for (let c = 0; c < 4; c++) {
          handMeta[(vo + i) * 4 + c] = raw.handMeta[i * 4 + c];
          const bOrig = raw.si[i * 4 + c];
          si[(vo + i) * 4 + c] = side > 0 ? bOrig : mapLeftBoneToRight(bOrig);
          sw[(vo + i) * 4 + c] = raw.sw[i * 4 + c];
        }
      }

      for (let t = 0; t < raw.idx.length; t += 3) {
        const a = vo + raw.idx[t], b = vo + raw.idx[t + 1], c = vo + raw.idx[t + 2];
        if (side > 0) idx.push(a, b, c);
        else idx.push(a, c, b); // Chiral X-mirror reverses triangle winding for 100% outward FrontSide normals!
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    const handBaseUvAttr = new T.BufferAttribute(uvs, 2);
    g.setAttribute("uv", handBaseUvAttr);
    g.setAttribute("uv1", handBaseUvAttr);
    g.setAttribute("aHandUv", new T.BufferAttribute(handUv, 2));
    g.setAttribute("aHandMeta", new T.BufferAttribute(handMeta, 4));
    g.setAttribute("skinIndex", new T.BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new T.BufferAttribute(sw, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.setAttribute("aBindPos", new T.Float32BufferAttribute(Float32Array.from(pos), 3));
    g.setAttribute("aBindNrm", new T.Float32BufferAttribute(Float32Array.from(g.attributes.normal.array), 3));
    return g;
  }

  /* Photographic Dual-Side Dorsal/Palmar Hand Shader + Glossy Keratin Fingernails + Web SSS */
  function applyPhotographicHandShader(T, mat, cfg) {
    const assetsV3 = cfg.assetsV3;
    const cyanGlow = cfg.cyanGlow;
    mat.userData = mat.userData || {};
    mat.userData.cyanGlow = cyanGlow;
    const uHandCfg = {
      value: new T.Vector4(
        cfg.photoMix !== undefined ? cfg.photoMix : 0.86,
        0.38, // Fingertip & web warm subsurface scatter
        0.0,
        0.0
      )
    };

    mat.onBeforeCompile = sh => {
      sh.uniforms.tHandDorsal = { value: assetsV3.handDorsal };
      sh.uniforms.tHandPalmar = { value: assetsV3.handPalmar };
      sh.uniforms.uHandUvRect = assetsV3.handUvUniform;
      sh.uniforms.uHandCfg = uHandCfg;
      sh.uniforms.uCyanGlow = cyanGlow;

      sh.vertexShader =
        "attribute vec2 aHandUv;\nattribute vec4 aHandMeta;\nattribute vec3 aBindPos;\nattribute vec3 aBindNrm;\n" +
        "varying vec2 vHandUv;\nvarying vec4 vHandMeta;\nvarying vec3 vBindPos;\nvarying vec3 vBindNrm;\nvarying vec2 vSkinMicro;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvHandUv = aHandUv;\nvHandMeta = aHandMeta;\nvBindPos = aBindPos;\nvBindNrm = aBindNrm;\nvSkinMicro = uv;"
        );

      sh.fragmentShader =
        "uniform sampler2D tHandDorsal, tHandPalmar;\nuniform vec4 uHandUvRect;\nuniform vec4 uHandCfg;\nuniform vec4 uCyanGlow;\n" +
        "varying vec2 vHandUv;\nvarying vec4 vHandMeta;\nvarying vec3 vBindPos;\nvarying vec3 vBindNrm;\nvarying vec2 vSkinMicro;\n" +
        "vec3 handSampleLod(sampler2D tex, vec2 uv, float lod) {\n" +
        "#if __VERSION__ == 300\n" +
        "  return textureLod(tex, uv, lod).rgb;\n" +
        "#else\n" +
        "  return texture2D(tex, uv, lod).rgb;\n" +
        "#endif\n" +
        "}\n" +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "float dorsalW = vHandMeta.x;\n" +
            "float nailM = vHandMeta.y;\n" +
            "float webSSS = vHandMeta.z;\n" +
            "float creaseAO = vHandMeta.w;\n" +
            "vec2 hUv = clamp(vHandUv, vec2(0.08), vec2(0.92));\n" +
            "// manifest.json: 1:1 identical (u, v) silhouette between dorsal & palmar (no horizontal flip!)\n" +
            "vec3 sDor = texture2D(tHandDorsal, hUv).rgb;\n" +
            "vec3 sPal = texture2D(tHandPalmar, hUv).rgb;\n" +
            "// Smooth warmth gate rejects #424242 studio grey without creating jagged saturation islands on wrist skin!\n" +
            "float validD = smoothstep(0.06, 0.18, (sDor.r - sDor.b) / max(0.05, sDor.r));\n" +
            "float validP = smoothstep(0.06, 0.18, (sPal.r - sPal.b) / max(0.05, sPal.r));\n" +
            "// Monotonic axial wrist fade (vSkinMicro.y = 0 at y=+0.024 forearm rim -> 1.0 by y=-0.016 carpus) -> ZERO wrist or thumb-crotch seam!\n" +
            "float cuffFade = smoothstep(0.12, 0.78, clamp(vSkinMicro.y, 0.0, 1.0));\n" +
            "float palmZone = (1.0 - dorsalW) * cuffFade;\n" +
            "float dGrA = fract(sin(dot(floor(vBindPos.xy * 980.0 + vBindPos.z * 790.0), vec2(12.9898, 78.233))) * 43758.5453);\n" +
            "float dGrB = sin(vBindPos.x * 460.0 + sin(vBindPos.y * 520.0 + vBindPos.z * 380.0)) * 0.5 + 0.5;\n" +
            "float dermalGrain = 1.0 + ((dGrA - 0.5) * 0.042 + (dGrB - 0.5) * 0.028);\n" +
            "vec3 targetSkin = diffuseColor.rgb * mix(vec3(1.0), vec3(1.18, 1.10, 1.05), palmZone);\n" +
            "float plateW = mix(validP, validD, dorsalW);\n" +
            "vec3 rawLinD = pow(max(vec3(0.001), sDor), vec3(2.2));\n" +
            "vec3 rawLinP = pow(max(vec3(0.001), sPal), vec3(2.2));\n" +
            "vec3 rawPlate = mix(rawLinP, rawLinD, dorsalW);\n" +
            "vec2 hUvSafe = clamp(hUv, vec2(0.14, 0.14), vec2(0.86, 0.82));\n" +
            "vec3 loLinD = pow(max(vec3(0.002), handSampleLod(tHandDorsal, hUvSafe, 2.4)), vec3(2.2));\n" +
            "vec3 loLinP = pow(max(vec3(0.002), handSampleLod(tHandPalmar, hUvSafe, 2.4)), vec3(2.2));\n" +
            "vec3 loPlate = mix(loLinP, loLinD, dorsalW);\n" +
            "float rawLum = max(0.008, dot(rawPlate, vec3(0.299, 0.587, 0.114)));\n" +
            "float loLum  = max(0.008, dot(loPlate, vec3(0.299, 0.587, 0.114)));\n" +
            "float baseLum = max(0.008, dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));\n" +
            "float tLum = max(0.008, dot(targetSkin, vec3(0.299, 0.587, 0.114)));\n" +
            "// Local LOD 2.4 normalization + neutral creaseAO: 1.000x canonicalSkinLin luminance & R/B match from forearm -> wrist -> metacarpals!\n" +
            "float handDetail = clamp(rawLum / loLum, 0.95, 1.06);\n" +
            "vec3 plateChroma = rawPlate * (tLum / rawLum);\n" +
            "vec3 adaptedPlate = mix(targetSkin, plateChroma, 0.03) * mix(1.0, handDetail, 0.58) * 1.005;\n" +
            "vec3 adaptedHand = mix(targetSkin, adaptedPlate, plateW);\n" +
            "float neutralCrease = clamp(creaseAO + 0.07, 0.97, 1.04);\n" +
            "diffuseColor.rgb = mix(targetSkin, adaptedHand, uHandCfg.x * cuffFade) * mix(1.0, neutralCrease, cuffFade * plateW * 0.25) * dermalGrain;\n" +
            "// True Linear-Space Translucent Keratin Fingernail Bed, Subtle Lunula & Natural Free Edge (zero chalk-white stickers!)\n" +
            "if (nailM > 0.03 && dorsalW > 0.45) {\n" +
            "  float nProg = clamp((nailM - 0.12) / 0.88, 0.0, 1.0);\n" +
            "  float lunula = 1.0 - smoothstep(0.06, 0.25, nProg);\n" +
            "  float freeTip = smoothstep(0.82, 0.96, nProg);\n" +
            "  vec3 linRose = pow(vec3(0.42, 0.27, 0.23), vec3(2.2));\n" +
            "  vec3 linIvory = pow(vec3(0.50, 0.42, 0.37), vec3(2.2));\n" +
            "  float melScale = clamp(baseLum * 5.8, 0.48, 1.28);\n" +
            "  vec3 nailCol = mix(diffuseColor.rgb * vec3(1.14, 1.05, 1.03), linRose * melScale, 0.34);\n" +
            "  nailCol = mix(nailCol, nailCol * 1.24 + vec3(0.010, 0.008, 0.007), lunula * 0.42);\n" +
            "  nailCol = mix(nailCol, linIvory * melScale, freeTip * 0.38);\n" +
            "  diffuseColor.rgb = mix(diffuseColor.rgb, nailCol, smoothstep(0.03, 0.26, nailM) * smoothstep(0.45, 0.75, dorsalW));\n" +
            "}"
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\n" +
            "if (vHandMeta.y > 0.05) {\n" +
            "  roughnessFactor = mix(roughnessFactor, 0.20, smoothstep(0.05, 0.25, vHandMeta.y));\n" +
            "}"
          )
          .replace(
            "#include <aomap_fragment>",
            "#include <aomap_fragment>\n" +
            "{\n" +
            "  float ndvH = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);\n" +
            "  float sssH = smoothstep(0.015, 0.24, 1.0 - ndvH) * smoothstep(0.16, 0.50, ndvH) * cuffFade;\n" +
            "  float bDH = max(0.006, dot(material.diffuseColor, vec3(0.2126, 0.7152, 0.0722)));\n" +
            "  float lDH = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3(0.2126, 0.7152, 0.0722));\n" +
            "  float lEnvH = clamp(lDH / bDH, 0.0, 2.6);\n" +
            "  reflectedLight.directDiffuse *= (1.0 + 0.12 * sssH);\n" +
            "  reflectedLight.directSpecular += vec3(0.0028) * cuffFade * (0.35 + 0.65 * sssH) * lEnvH;\n" +
            "}"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "// vec3(1.55, 0.52, 0.28) neutral-warm dermal rim\n" +
            "float handRim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.8);\n" +
            "float hNightDamp = 1.0 - clamp(uCyanGlow.w * 0.95, 0.0, 0.88);\n" +
            "float hSssAmt = mix(0.32, 0.65, vHandMeta.z);\n" +
            "totalEmissiveRadiance += diffuseColor.rgb * vec3(1.08, 0.94, 0.88) * (handRim * hSssAmt * 0.22 * hNightDamp);\n" +
            "if (uCyanGlow.w > 0.001) {\n" +
            "  vec3 toS = vBindPos - uCyanGlow.xyz;\n" +
            "  float d2 = dot(toS, toS) + 0.028;\n" +
            "  float ndl = clamp(dot(normalize(vBindNrm), normalize(-toS)) * 0.6 + 0.4, 0.0, 1.0);\n" +
            "  totalEmissiveRadiance += vec3(0.14, 0.75, 1.0) * (uCyanGlow.w * 0.85 * ndl / (1.0 + 13.5 * d2)) * (0.45 + 0.55 * diffuseColor.rgb);\n" +
            "}"
          );
    };
    mat.customProgramCacheKey = () => "v52PhotoHandCanonicalSSS_v3";
    return mat;
  }

  /* ============================================================================
     6. 30-BONE PHALANX ARTICULATION + FOREARM TWIST + ELBOW/KNEE VOLUME SOLVERS
     ============================================================================ */
  function poseHandPhalanges(bones, side, curlBase, spread = 0.22, mode = "wrap", nowSec = 0) {
    if (typeof window !== "undefined" && window.HumanPhysicalV6) {
      if (mode === "ballKnob") {
        window.HumanPhysicalV6.poseCylinderOrBallGrip(bones, B, side, curlBase || 1.0, true);
        return;
      }
      if (mode === "bowlRim") {
        window.HumanPhysicalV6.poseBowlRimRest(bones, B, side, curlBase || 1.0);
        return;
      }
    }
    const cBase = clamp(curlBase, 0, 1.20);
    const baseIdx = side > 0 ? B.L_THUMB_1 : B.R_THUMB_1;
    const th1 = bones[baseIdx], th2 = bones[baseIdx + 1], th3 = bones[baseIdx + 2];

    for (let i = 0; i < 4; i++) {
      const fBase = baseIdx + 3 + i * 3;
      const mcp = bones[fBase], pip = bones[fBase + 1], dip = bones[fBase + 2];
      const fs = FINGER_BIND_SPECS[i];

      let c = cBase * (0.90 + i * 0.065);
      let mcpA = 0, pipA = 0, dipA = 0, sp = spread;

      if (mode === "inspectWave") {
        // Organic sequential phalanx articulation wave for Macro M1 Hand Showcase!
        const wave = Math.max(0, Math.sin(nowSec * 2.4 - i * 0.45 - (side > 0 ? 0 : 0.9)));
        const w2 = Math.pow(wave, 1.6) * cBase;
        mcpA = 0.06 + w2 * 0.72;
        pipA = 0.08 + w2 * 0.88;
        dipA = 0.04 + w2 * 0.54;
        sp = 0.36 - w2 * 0.18;
      } else if (mode === "pinch") {
        if (i === 0) {
          mcpA = 0.54; pipA = 0.76; dipA = 0.42; sp = 0.08;
        } else {
          const k = 0.72 + i * 0.10;
          mcpA = 0.86 * k; pipA = 1.04 * k; dipA = 0.66 * k; sp = 0.12;
        }
      } else if (mode === "cradle" || mode === "sideWrap") {
        mcpA = c * 0.70; pipA = c * 0.82; dipA = c * 0.36; sp = 0.28;
      } else if (mode === "underRib" || mode === "ribBottom") {
        mcpA = c * 0.68; pipA = c * 0.86; dipA = c * 0.52; sp = 0.26;
      } else if (mode === "handleTop") {
        mcpA = c * 0.82; pipA = c * 1.22; dipA = c * 0.86; sp = 0.18;
      } else if (mode === "flat") {
        mcpA = 0.10 + c * 0.30; pipA = 0.14 + c * 0.34; dipA = 0.08 + c * 0.20; sp = 0.36;
      } else {
        mcpA = c * 1.04; pipA = c * 1.16; dipA = c * 0.74;
      }

      mcp.rotation.set(-fs.splay * (sp - 0.22) * 1.45, 0, -side * mcpA, "XZY");
      pip.rotation.set(0, 0, -side * pipA);
      dip.rotation.set(0, 0, -side * dipA);
    }

    // Articulated 3-Bone Thumb (true +X adduction/flexion across +Z -> -Z + palmar opposition -side*Z)
    if (mode === "inspectWave") {
      const tw = Math.pow(Math.max(0, Math.sin(nowSec * 2.4 + 0.5)), 1.6) * cBase;
      th1.rotation.set(-0.12 + tw * 0.34, side * (-0.10 + tw * 0.28), -side * tw * 0.32, "YZX");
      th2.rotation.set(tw * 0.26, 0, -side * (0.05 + tw * 0.32));
      th3.rotation.set(tw * 0.24, 0, -side * (0.04 + tw * 0.36));
    } else if (mode === "pinch") {
      // Tripod pen pinch: +X adducts thumb inward from +Z=+0.066 to +0.033 while -side*Z opposes onto pen barrel!
      th1.rotation.set(0.40, side * 0.26, -side * 0.44, "YZX");
      th2.rotation.set(0.28, 0, -side * 0.24);
      th3.rotation.set(0.24, 0, -side * 0.20);
    } else if (mode === "pumpBar") {
      // Cylindrical iron-bar lock: +X wraps thumb down & around front/underside of the 14.5mm bar!
      th1.rotation.set(0.56, side * 0.28, -side * 0.54, "YZX");
      th2.rotation.set(0.46, 0, -side * 0.42);
      th3.rotation.set(0.42, 0, -side * 0.38);
    } else if (mode === "cradle" || mode === "sideWrap") {
      th1.rotation.set(0.26, side * 0.20, -side * 0.22, "YZX");
      th2.rotation.set(0.18, 0, -side * (0.14 + cBase * 0.16));
      th3.rotation.set(0.16, 0, -side * (0.12 + cBase * 0.18));
    } else if (mode === "flat") {
      th1.rotation.set(-0.06, side * 0.06, side * 0.05, "YZX");
      th2.rotation.set(0.04, 0, -side * 0.05);
      th3.rotation.set(0.04, 0, -side * 0.05);
    } else if (mode === "handleTop") {
      th1.rotation.set(0.48, side * 0.26, -side * 0.46, "YZX");
      th2.rotation.set(0.38, 0, -side * 0.38);
      th3.rotation.set(0.36, 0, -side * 0.42);
    } else {
      th1.rotation.set(0.14 + cBase * 0.30, side * (0.12 + cBase * 0.24), -side * (0.08 + cBase * 0.38), "YZX");
      th2.rotation.set(cBase * 0.28, 0, -side * (0.10 + cBase * 0.34));
      th3.rotation.set(cBase * 0.26, 0, -side * (0.10 + cBase * 0.38));
    }
  }

  /* Solves 3-DOF Wrist + Distributes 32%/68% Radius-Ulna Twist onto B_FARM & B_FARM_TWIST +
     Updates Half-Angle Volume-Preserving B_ELBOW_VOL so 90°-135° bends NEVER collapse sleeve/skin volume! */
  function solveWristTwistAndElbowVolume(ik, farmBone, twistBone, elbowVolBone, handBone, side, palmNormalWorld, fingerDirWorld, maxWristRad = 0.68) {
    // 1. Half-angle volume-preserving elbow helper BEFORE forearm twist is added!
    const elbBend = 2.0 * Math.acos(clamp(Math.abs(farmBone.quaternion.w), 0, 1));
    elbowVolBone.quaternion.set(0, 0, 0, 1).slerp(farmBone.quaternion, 0.5);
    const volBoost = 1.0 / Math.max(0.74, Math.cos(elbBend * 0.44));
    elbowVolBone.scale.set(volBoost, 1.0, volBoost);

    // 2. Forearm direction S -> W
    twistBone.quaternion.identity();
    farmBone.updateMatrixWorld(true);
    handBone.updateMatrixWorld(true);
    farmBone.getWorldPosition(ik.S);
    handBone.getWorldPosition(ik.J);
    ik.fArmDir.subVectors(ik.J, ik.S);
    if (ik.fArmDir.lengthSq() > 1e-8) ik.fArmDir.normalize();
    else ik.fArmDir.set(0, -1, 0);

    if (fingerDirWorld && fingerDirWorld.lengthSq() > 1e-6) {
      ik.fDir.copy(fingerDirWorld).normalize();
      const cosAng = clamp(ik.fArmDir.dot(ik.fDir), -1, 1);
      const ang = Math.acos(cosAng);
      if (ang > maxWristRad && ang > 1e-5) {
        ik.fDir.copy(ik.fArmDir).lerp(ik.fDir, maxWristRad / ang).normalize();
      }
    } else {
      ik.fDir.copy(ik.fArmDir);
    }

    ik.yAx.copy(ik.fDir).negate();
    if (palmNormalWorld && palmNormalWorld.lengthSq() > 1e-6) ik.pNrm.copy(palmNormalWorld).normalize();
    else ik.pNrm.set(-side, 0, 0);

    ik.pNrm.addScaledVector(ik.yAx, -ik.pNrm.dot(ik.yAx));
    if (ik.pNrm.lengthSq() < 1e-6) {
      ik.pNrm.set(0, 1, 0).addScaledVector(ik.yAx, -ik.yAx.y);
      if (ik.pNrm.lengthSq() < 1e-6) ik.pNrm.set(1, 0, 0);
    }
    ik.pNrm.normalize();

    ik.xAx.copy(ik.pNrm).multiplyScalar(-side);
    ik.zAx.crossVectors(ik.xAx, ik.yAx).normalize();
    ik.mHand.makeBasis(ik.xAx, ik.yAx, ik.zAx);
    ik.qHandWorld.setFromRotationMatrix(ik.mHand);

    // 3. Measure longitudinal pronation/supination twist and split 32% on B_FARM + 68% on B_FARM_TWIST!
    farmBone.getWorldQuaternion(ik.qLowerWorld);
    ik.qRel.copy(ik.qLowerWorld).invert().multiply(ik.qHandWorld);
    if (ik.qRel.w < 0) ik.qRel.set(-ik.qRel.x, -ik.qRel.y, -ik.qRel.z, -ik.qRel.w);
    const totalTwistY = clamp(2.0 * Math.atan2(ik.qRel.y, ik.qRel.w), -1.56, 1.56);

    farmBone.rotateY(totalTwistY * 0.32);
    twistBone.rotation.set(0, totalTwistY * 0.68, 0);
    farmBone.updateMatrixWorld(true);
    twistBone.updateMatrixWorld(true);

    twistBone.getWorldQuaternion(ik.qLowerWorld);
    handBone.quaternion.copy(ik.qLowerWorld).invert().multiply(ik.qHandWorld);
    handBone.updateMatrixWorld(true);
  }

  function updateKneeVolumeHelper(llegBone, kneeVolBone) {
    const q = llegBone.quaternion;
    const kneeBend = 2.0 * Math.acos(clamp(Math.abs(q.w), 0, 1));
    kneeVolBone.quaternion.set(0, 0, 0, q.w < 0 ? -1 : 1).slerp(q, 0.5);
    const vol = Math.min(1.18, 1.0 / Math.max(0.84, Math.cos(kneeBend * 0.36)));
    kneeVolBone.scale.set(vol, 1.0, vol);
  }

  /* ============================================================================
     7. DONKEY-METHOD VOLUMETRIC HAIR, LOCS/BRAIDS, PONYTAIL CARDS & CURLY BEARDS
     (Single-Draw-Call Batched Shell Meshes with Triplanar 4C Spiral Coils -> 60 FPS!)
     ============================================================================ */
  function buildBatchedShellGeo(T, baseGeo, shellFracs) {
    const pSrc = baseGeo.attributes.position.array;
    const nSrc = baseGeo.attributes.normal.array;
    const uSrc = baseGeo.attributes.uv.array;
    const lSrc = baseGeo.attributes.aHairLen.array;
    const siSrc = baseGeo.attributes.skinIndex.array;
    const swSrc = baseGeo.attributes.skinWeight.array;
    const idxSrc = baseGeo.index.array;

    const vCount = baseGeo.attributes.position.count;
    const iCount = idxSrc.length;
    const S = shellFracs.length;

    const pos = new Float32Array(vCount * S * 3);
    const nrm = new Float32Array(vCount * S * 3);
    const uv = new Float32Array(vCount * S * 2);
    const hLen = new Float32Array(vCount * S);
    const sFrac = new Float32Array(vCount * S);
    const si = new Uint16Array(vCount * S * 4);
    const sw = new Float32Array(vCount * S * 4);
    const idx = new Uint32Array(iCount * S);

    for (let s = 0; s < S; s++) {
      const sf = shellFracs[s];
      const vOff = s * vCount;
      pos.set(pSrc, vOff * 3);
      nrm.set(nSrc, vOff * 3);
      uv.set(uSrc, vOff * 2);
      hLen.set(lSrc, vOff);
      si.set(siSrc, vOff * 4);
      sw.set(swSrc, vOff * 4);
      sFrac.fill(sf, vOff, vOff + vCount);
      const iOff = s * iCount;
      for (let k = 0; k < iCount; k++) idx[iOff + k] = idxSrc[k] + vOff;
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("normal", new T.BufferAttribute(nrm, 3));
    g.setAttribute("uv", new T.BufferAttribute(uv, 2));
    g.setAttribute("aHairLen", new T.BufferAttribute(hLen, 1));
    g.setAttribute("aShellFrac", new T.BufferAttribute(sFrac, 1));
    g.setAttribute("skinIndex", new T.BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new T.BufferAttribute(sw, 4));
    g.setIndex(new T.BufferAttribute(idx, 1));
    g.userData.indicesPerShell = iCount;
    g.userData.totalShells = S;
    return g;
  }

  function createHairShellMaterial(T, baseCol, shellFrac, assetsV3, cyanGlow, uvScale = 1.0, isBeard = false, facsUniforms = null) {
    const m = new T.MeshStandardMaterial({
      color: baseCol,
      roughness: isBeard ? 0.80 : 0.82,
      metalness: 0.02,
      alphaToCoverage: true,
      side: isBeard ? T.DoubleSide : T.FrontSide
    });
    const uShell = { value: new T.Vector4(shellFrac, uvScale, isBeard ? 1.0 : 0.0, 0.0) };
    const facsBundle = isBeard ? (facsUniforms || createSharedFacsUniformBundle(T)) : null;
    if (facsBundle) {
      m.userData = m.userData || {};
      m.userData.facsUniforms = facsBundle;
    }

    m.onBeforeCompile = sh => {
      sh.uniforms.uShell = uShell;
      sh.uniforms.tCoil = { value: assetsV3.hairCoilyShell };
      sh.uniforms.tCoilProc = { value: assetsV3.proceduralCoilNoise };
      sh.uniforms.uCyanGlow = cyanGlow;
      if (facsBundle) {
        sh.uniforms.uFacsA = facsBundle.uFacsA;
        sh.uniforms.uFacsB = facsBundle.uFacsB;
        sh.uniforms.uFacsC = facsBundle.uFacsC;
        sh.uniforms.uFacsD = facsBundle.uFacsD;
      }

      sh.vertexShader =
        "attribute float aHairLen;\nattribute float aShellFrac;\nuniform vec4 uShell;\n" +
        (facsBundle ? "uniform vec4 uFacsA, uFacsB, uFacsC, uFacsD;\n" + GLSL_FACS_HELPERS : "") +
        "varying float vHairLen;\nvarying float vShellFrac;\nvarying vec3 vHairBind;\nvarying vec3 vHairNrm;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "float hSh = aShellFrac >= 0.0 ? aShellFrac : uShell.x;\n" +
          "float baseInset = (uShell.z < 0.5 && hSh < 0.001) ? -0.0016 : 0.0;\n" +
          "vec3 bPos = position;\n" +
          (facsBundle
            ? "float beardLipSign = (bPos.y >= 1.5535 ? 1.0 : -1.0) * facsG1(abs(bPos.x), 0.0, 0.028) * facsG1(bPos.y, 1.553, 0.018);\n" +
              "bPos += evalHumanFacsDisp(position, vec4(beardLipSign, 0.0, 0.0, 0.0), uFacsA, uFacsB, uFacsC, uFacsD);\n"
            : "") +
          "vec3 transformed = bPos + objectNormal * (baseInset + aHairLen * hSh);\n" +
          "vHairLen = aHairLen;\nvShellFrac = hSh;\nvHairBind = position;\nvHairNrm = objectNormal;"
        );

      sh.fragmentShader =
        "uniform vec4 uShell;\nuniform sampler2D tCoil, tCoilProc;\nuniform vec4 uCyanGlow;\n" +
        "varying float vHairLen;\nvarying float vShellFrac;\nvarying vec3 vHairBind;\nvarying vec3 vHairNrm;\n" +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "float hSh = vShellFrac;\n" +
            "vec3 bN = normalize(vHairNrm);\n" +
            "vec3 wTri = pow(abs(bN), vec3(3.0));\n" +
            "wTri /= max(0.001, wTri.x + wTri.y + wTri.z);\n" +
            "float scUv = 6.6 * uShell.y;\n" +
            "vec2 spiralOff = vec2(cos(hSh * 5.8), sin(hSh * 5.8)) * 0.048;\n" +
            "vec2 uvY = vHairBind.xz * scUv + spiralOff;\n" +
            "vec2 uvX = vHairBind.zy * scUv + spiralOff + vec2(0.31, 0.17);\n" +
            "vec2 uvZ = vHairBind.xy * scUv + spiralOff + vec2(0.63, 0.47);\n" +
            "vec4 sPhoto = texture2D(tCoil, uvY) * wTri.y + texture2D(tCoil, uvX) * wTri.x + texture2D(tCoil, uvZ) * wTri.z;\n" +
            "vec4 sProc  = texture2D(tCoilProc, uvY * 1.15) * wTri.y + texture2D(tCoilProc, uvX * 1.15) * wTri.x + texture2D(tCoilProc, uvZ * 1.15) * wTri.z;\n" +
            "float density = mix(sProc.a, max(sPhoto.a * 0.94, sProc.a), 0.65);\n" +
            "if (uShell.z > 0.5) {\n" +
            "  float bEdge = smoothstep(0.0012, 0.0068, vHairLen);\n" +
            "  float bThresh = hSh < 0.001 ? 0.34 : mix(0.26, 0.90, pow(hSh, 0.72));\n" +
            "  if (vHairLen < 0.0012 || density * bEdge < bThresh) discard;\n" +
            "} else {\n" +
            "  float hEdge = smoothstep(0.0010, 0.0060, vHairLen);\n" +
            "  if (hSh < 0.001) {\n" +
            "    if (vHairLen < 0.0012 || density * hEdge < 0.28) discard;\n" +
            "  } else {\n" +
            "    float thresh = mix(0.22, 0.91, pow(hSh, 0.72));\n" +
            "    if (vHairLen < 0.0014 || density * hEdge < thresh) discard;\n" +
            "  }\n" +
            "}\n" +
            "float rootTip = uShell.z > 0.5 ? (hSh < 0.001 ? 0.24 : mix(0.28, 0.94, pow(hSh, 0.82))) : (hSh < 0.001 ? 0.38 : mix(0.42, 1.38, pow(hSh, 0.85)));\n" +
            "float curlTex = max(sPhoto.r, sProc.r);\n" +
            "float clVar = 0.72 + 0.58 * curlTex;\n" +
            "diffuseColor.rgb *= rootTip * clVar;\n" +
            "if (uShell.z > 0.5) {\n" +
            "  diffuseColor.rgb += vec3(0.011, 0.010, 0.009) * smoothstep(0.80, 0.96, curlTex) * (0.25 + 0.75 * hSh);\n" +
            "}"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "float fresH = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);\n" +
            "totalEmissiveRadiance += (diffuseColor.rgb * 1.20 + vec3(0.012, 0.009, 0.007)) * (fresH * (0.16 + 0.42 * vShellFrac));\n" +
            "if (uCyanGlow.w > 0.001) {\n" +
            "  vec3 toS = vHairBind - uCyanGlow.xyz;\n" +
            "  float d2 = dot(toS, toS) + 0.035;\n" +
            "  float ndl = clamp(dot(normalize(vHairNrm), normalize(-toS)) * 0.55 + 0.45, 0.0, 1.0);\n" +
            "  float hairTopDamp = uShell.z > 0.5 ? 1.0 : (1.0 - 0.84 * smoothstep(1.595, 1.668, vHairBind.y));\n" +
            "  totalEmissiveRadiance += vec3(0.14, 0.74, 1.0) * (uCyanGlow.w * 0.48 * hairTopDamp * ndl / (1.0 + 14.0 * d2)) * (0.25 + 0.75 * vShellFrac);\n" +
            "}"
          );
    };
    m.customProgramCacheKey = () => isBeard ? "v5CoilShellBatch_beard_facs_v2" : "v5CoilShellBatch_hair_v2";
    return m;
  }

  function buildCoilyScalpGeo(T, isTaperedShort = false, insetMasked = true) {
    // Posterior rings aligned 1:1 to ScionNeck's exact occipital-nuchal profile (zBack = -0.077 -> -0.098 -> -0.111m)
    // so 4C hair hugs the back of the neck with a smooth barber-tapered nape (ZERO mushroom overhang shelf in 90° profile!)
    const isCombedCap = !insetMasked;
    const crownTopY = isCombedCap ? 1.7395 : 1.734;
    const rings = refineRings([
      { p: [0, 1.528, -0.004], w: 0.0595, f: 0.016, b: 0.0735, e: 1.00 },
      { p: [0, 1.552,  0.000], w: 0.0620, f: 0.026, b: 0.0840, e: 1.00 },
      { p: [0, 1.582,  0.000], w: 0.0700, f: 0.040, b: 0.0980, e: 1.00 },
      { p: [0, 1.608, -0.003], w: 0.0740, f: 0.056, b: 0.1095, e: 1.00 },
      { p: [0, 1.638, -0.005], w: 0.0745, f: 0.074, b: 0.1120, e: 1.00 },
      { p: [0, 1.676, -0.007], w: 0.0715, f: 0.084, b: 0.1080, e: 1.00 },
      { p: [0, 1.712, -0.012], w: 0.0535, f: 0.064, b: 0.0810, e: 1.00 },
      { p: [0, 1.729, -0.015], w: 0.0255, f: 0.030, b: 0.0370, e: 1.00 },
      { p: [0, crownTopY, -0.016], w: 0.0020, f: 0.002, b: 0.0020, e: 1.00 }
    ], 3);

    const seg = 48, n = rings.length, cols = seg + 1;
    const pos = [], uv = [], hLen = [], si = [], sw = [], idx = [];
    const maxCrown = isTaperedShort ? 0.0165 : 0.0275;
    const sideLen  = isTaperedShort ? 0.0075 : 0.0165;

    for (let i = 0; i < n; i++) {
      const r = rings[i], v = i / Math.max(1, n - 1), y = r.p[1];
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * TAU + Math.PI, sa = Math.sin(a), ca = Math.cos(a);
        const rz = ca >= 0 ? r.f : r.b;
        const surfLift = isCombedCap ? lerp(1.003, 1.015, smooth(1.668, 1.718, y)) : lerp(1.002, 1.008, smooth(1.545, 1.600, y));
        let lx = Math.sign(sa) * Math.pow(Math.abs(sa), r.e) * r.w * surfLift;
        let lz = Math.sign(ca) * Math.pow(Math.abs(ca), r.e) * rz * surfLift;

        const hairlineY = isCombedCap
          ? (1.696 - 0.008 * g1(sa, 0, 0.28) - 0.048 * Math.pow(Math.abs(sa), 1.45) - 0.036 * smooth(0.25, -0.45, ca))
          : (1.676 - 0.048 * (1 - ca));
        const pzRaw = r.p[2] + lz;
        const sideburnTab = !isCombedCap
          ? g2(y, pzRaw, 1.609, 0.006, 0.018, 0.014) * smooth(1.588, 1.598, y) * smooth(0.68, 0.94, Math.abs(sa)) * 0.74
          : 0.0;
        const frontHairMask = clamp(smooth(hairlineY - 0.011, hairlineY + 0.011, y) + sideburnTab, 0, 1);
        // Smooth azimuthal blend + keep lower hair strictly on posterior occipital nape (ca < -0.52) -> ZERO detached coil dots below earlobe!
        const backBlend = smooth(0.04, -0.34, ca);
        const lowNapeGuard = lerp(smooth(-0.50, -0.78, ca), 1.0, smooth(1.576, 1.598, y));
        const subLobeClear = (Math.abs(lx) > 0.048 && pzRaw > -0.042 && y < 1.578) ? 0.0 : 1.0;
        const faceMask = lerp(frontHairMask, 1.0, backBlend) * lowNapeGuard * subLobeClear;

        // Snug C-shaped ear cutout evaluated at TRUE world pzRaw
        const earNotch = g2(y, pzRaw, 1.595, -0.016, 0.026, 0.017) * smooth(0.62, 0.92, Math.abs(sa));
        const earClear = clamp(1.0 - 1.55 * earNotch, 0, 1);
        const napeFade = smooth(1.529, 1.556, y);

        const mask = clamp(faceMask * earClear * napeFade, 0, 1);
        if (earNotch > 0.06 || mask < 0.12) {
          const tuckAmt = Math.max(clamp(earNotch * 1.35, 0, 1), 1.0 - smooth(0.01, 0.12, mask));
          lx -= Math.sign(sa) * 0.021 * tuckAmt;
        }
        if (mask < 0.08 && ca > -0.58) {
          lz -= 0.018 * (1 - smooth(0.0, 0.08, mask));
        }

        const crownFactor = smooth(1.595, 1.685, y);
        const tuftMacro = 0.68 + 0.54 * vnoise(sa * 11.2 + 2.1, v * 13.5);
        const tuftMicro = 0.86 + 0.28 * vnoise(sa * 23.0 - 1.3, v * 26.0);
        // Smooth barber-tapered occipital nape: 1.5mm stubble at y=1.532 ramping smoothly along occipital curve to full 4C volume above y=1.605!
        const taperLow = smooth(1.529, 1.604, y) * (0.16 + 0.84 * smooth(1.545, 1.612, y));
        const len = isCombedCap
          ? mask * 0.010
          : (mask * lerp(sideLen, maxCrown, crownFactor) * taperLow * tuftMacro * tuftMicro);

        pos.push(r.p[0] + lx, y, r.p[2] + lz);
        uv.push((j / seg) * 3, v * 3);
        hLen.push(len);

        const wHead = smooth(1.535, 1.565, y);
        si.push(B.HEAD, B.NECK_HIGH, 0, 0);
        sw.push(wHead, 1 - wHead, 0, 0);
      }
    }

    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const A = i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
        idx.push(A, Bv, C, Bv, D, C);
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setAttribute("aHairLen", new T.Float32BufferAttribute(hLen, 1));
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* 68 Individually Routed, Smoothly Rope-Twisted Locs / Cornrow Braids Merged into 1 SkinnedMesh */
  function buildHelicalLocsOrBraidsGeo(T, isCornrows) {
    const pos = [], uv = [], col = [], si = [], sw = [], idx = [];

    const appendTwistedStrand = (pts, rBase, rTip, twists, beadFrac, rootWeightTail = 0) => {
      const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2])));
      const segU = 22;
      const segR = 8;
      const frames = curve.computeFrenetFrames(segU, false);
      const baseV = pos.length / 3;

      for (let i = 0; i <= segU; i++) {
        const u = i / segU;
        const pt = curve.getPoint(u);
        const N = frames.normals[i], Bv = frames.binormals[i];
        const tipRound = i === segU ? 0.16 : (i === segU - 1 ? 0.72 : 1.0);
        const taper = lerp(rBase, rTip, Math.pow(u, 1.15)) * tipRound;
        const onBead = beadFrac > 0 && Math.abs(u - beadFrac) < 0.055;

        for (let j = 0; j <= segR; j++) {
          const a = (j / segR) * TAU;
          // Smooth continuous 2-strand rope/plait helical contour (zero accordion discs!)
          const plait = onBead ? 1.32 : (1.0 + 0.10 * Math.cos(2.0 * a + u * twists));
          const rad = taper * plait;
          const ca = Math.cos(a), sa = Math.sin(a);
          const px = pt.x + (N.x * ca + Bv.x * sa) * rad;
          const py = pt.y + (N.y * ca + Bv.y * sa) * rad;
          const pz = pt.z + (N.z * ca + Bv.z * sa) * rad;

          pos.push(px, py, pz);
          uv.push(j / segR, u * 3.8);
          if (onBead) {
            col.push(2.15, 1.62, 0.92); // Warm brass/wood hair cuff accent!
          } else {
            const sh = lerp(0.54, 1.14, u) * (0.90 + 0.10 * plait);
            col.push(sh, sh * 0.98, sh * 0.95);
          }
          const wTail = rootWeightTail * smooth(0.35, 0.95, u);
          si.push(B.HEAD, B.HAIR_TAIL, 0, 0);
          sw.push(1 - wTail, wTail, 0, 0);
        }
      }

      const stride = segR + 1;
      for (let i = 0; i < segU; i++) {
        for (let j = 0; j < segR; j++) {
          const A = baseV + i * stride + j, B1 = A + 1, C = A + stride, D = C + 1;
          idx.push(A, B1, C, B1, D, C);
        }
      }
    };

    // Exact 3D cranial surface evaluator so EVERY loc & cornrow hugs the skull ON TOP OF the scalp cap (zero buried or floating strands!)
    const evalCraniumPt = (dx, dy, dz, lift = 0.0045) => {
      const len = Math.hypot(dx, dy, dz) || 1;
      const nx = dx / len, ny = dy / len, nz = dz / len;
      const rx = 0.0745 + lift;
      const ry = (ny >= 0 ? 0.1145 : 0.098) + lift;
      const rz = (nz >= 0 ? 0.0845 : 0.1095) + lift;
      return [
        nx * rx,
        1.618 + ny * ry,
        -0.010 + nz * rz
      ];
    };

    if (!isCornrows) {
      // 68 Individually Routed Twisted Locs ON TOP OF the Cranium across 360° Crown, Center-Parted Forehead Fringe, Temples, Sides & Nape (matching youth_head_front.jpg!)
      const tiers = [
        { count: 12, polar0: 0.08, azSpan: Math.PI * 0.985, lenMin: 0.068, lenMax: 0.088 },
        { count: 14, polar0: 0.23, azSpan: Math.PI * 0.985, lenMin: 0.072, lenMax: 0.095 },
        { count: 16, polar0: 0.42, azSpan: Math.PI * 0.985, lenMin: 0.070, lenMax: 0.098 },
        { count: 16, polar0: 0.64, azSpan: Math.PI * 0.920, lenMin: 0.064, lenMax: 0.092 },
        { count: 10, polar0: 0.88, azSpan: Math.PI * 0.560, lenMin: 0.058, lenMax: 0.082 }
      ];
      let sIdx = 0;
      for (let ti = 0; ti < tiers.length; ti++) {
        const tr = tiers[ti];
        for (let k = 0; k < tr.count; k++) {
          sIdx++;
          const u = tr.count > 1 ? (k / (tr.count - 1)) * 2 - 1 : 0;
          const az = Math.PI + u * tr.azSpan + (hash(sIdx * 3.7) - 0.5) * 0.05;
          const sa = Math.sin(az), ca = Math.cos(az);
          const frontFactor = smooth(0.15, 0.85, ca); // 1 on forehead bangs -> shorter so brows & eyes stay 100% clear!
          const p0 = evalCraniumPt(sa * Math.sin(tr.polar0), Math.cos(tr.polar0), ca * Math.sin(tr.polar0), 0.0040);
          const pol1 = Math.min(1.22 - 0.36 * frontFactor, tr.polar0 + lerp(0.36, 0.24, frontFactor));
          const p1 = evalCraniumPt(sa * Math.sin(pol1), Math.cos(pol1), ca * Math.sin(pol1), 0.0068);
          const pol2 = Math.min(1.48 - 0.56 * frontFactor, tr.polar0 + lerp(0.68, 0.44, frontFactor));
          const p2Base = evalCraniumPt(sa * Math.sin(pol2), Math.cos(pol2), ca * Math.sin(pol2), 0.0096);

          const baseHang = lerp(tr.lenMin, tr.lenMax, hash(sIdx * 7.1));
          const hangLen = baseHang * lerp(1.0, 0.30, frontFactor);
          const flareOut = (0.006 + 0.006 * hash(sIdx * 5.3)) * lerp(1.0, 0.42, frontFactor);
          const curlKick = (hash(sIdx * 11.9) - 0.5) * 0.008;
          const minEyeSafeY = frontFactor > 0.35 ? 1.666 : 1.480;
          const p2 = [
            p2Base[0] + sa * flareOut * 0.5,
            Math.max(minEyeSafeY + 0.012, Math.min(p1[1] - 0.010, p2Base[1] - hangLen * 0.20)),
            p2Base[2] + ca * flareOut * 0.4
          ];
          const p3 = [
            p2[0] + sa * flareOut + curlKick,
            Math.max(minEyeSafeY, p2[1] - hangLen * 0.46),
            p2[2] + ca * 0.004 - 0.002
          ];
          const rB = 0.0056 + 0.0018 * hash(sIdx * 2.3);
          const bead = (sIdx % 14 === 3 && frontFactor < 0.4) ? 0.68 : 0;
          appendTwistedStrand([p0, p1, p2, p3], rB, rB * 0.74, 15.0, bead, frontFactor > 0.3 ? 0.05 : 0.28);
        }
      }
      // 10 Dedicated Center-Parted Front-Crown Locs framing the upper forehead & temples cleanly above eyebrows!
      for (const side of [1, -1]) {
        for (let f = 0; f < 5; f++) {
          sIdx++;
          const uF = f / 4; // 0 = right next to center part, 1 = temple
          const rootX = side * (0.0045 + uF * 0.014);
          const rootZ = lerp(0.032, -0.008, uF);
          const p0 = evalCraniumPt(rootX / 0.075, 1.0, rootZ / 0.085, 0.0038);
          const midAz = side * lerp(0.20, 0.88, uF);
          const p1 = evalCraniumPt(Math.sin(midAz) * 0.55, 0.82, Math.cos(midAz) * 0.55, 0.0068);
          const p2 = evalCraniumPt(Math.sin(midAz * 1.12) * 0.78, 0.58 - uF * 0.10, Math.cos(midAz * 1.12) * 0.78, 0.0095);
          const tipY = lerp(1.674, 1.632, uF) - 0.005 * hash(sIdx * 3.1);
          const p3 = [
            p2[0] + side * (0.006 + uF * 0.006),
            tipY,
            p2[2] + 0.004 * (1 - uF)
          ];
          appendTwistedStrand([p0, p1, p2, p3], 0.0058, 0.0043, 14.0, 0, 0.04);
        }
      }
    } else {
      // 11 Sculpted 3-Strand Scalp Cornrows Hugging Exact 3D Cranial Ellipsoid + 46 Braided Nape/Bun Strands (Makeda!)
      for (let b = -5; b <= 5; b++) {
        const latFrac = b / 5.0; // -1..+1 across cranium width
        const pts = [];
        for (let k = 0; k <= 8; k++) {
          const t = k / 8;
          // Sweep from arched front hairline (pitch = 0.58 + 0.16*latFrac^2) over parietal dome to occipital bun (pitch = 2.48)
          const pitch = lerp(0.60 + 0.16 * latFrac * latFrac, 2.48, t);
          const latWidth = latFrac * 0.84 * (1.0 - 0.58 * smooth(0.60, 1.0, t));
          const ny = Math.cos(pitch) * Math.sqrt(Math.max(0.08, 1.0 - latWidth * latWidth * 0.65));
          const nz = Math.sin(pitch <= Math.PI * 0.5 ? (Math.PI * 0.5 - pitch) : -(pitch - Math.PI * 0.5));
          // Exact unit direction on 3D skull: +Z at front (t=0) -> +Y at crown (t=0.45) -> -Z at occiput (t=1)
          const fwdZ = Math.cos(pitch);
          const upY = Math.sin(pitch);
          pts.push(evalCraniumPt(latWidth, upY, fwdZ, 0.0038));
        }
        appendTwistedStrand(pts, 0.0064, 0.0050, 30.0, 0, 0);
      }
      // Coiled multi-braid bun & cascading braided ends at nape (46 individual twisted braids!)
      for (let i = 0; i < 46; i++) {
        const a0 = (i / 46) * TAU;
        const r0 = 0.016 + (i % 4) * 0.008;
        const cx = 0, cy = 1.568, cz = -0.112;
        if (i < 30) {
          // Wrapped coiled chignon braids
          const pts = [];
          for (let s = 0; s <= 4; s++) {
            const th = a0 + s * 0.68;
            const rr = r0 + 0.010 * Math.sin(s * 0.9);
            pts.push([
              cx + Math.cos(th) * rr * 1.15,
              cy + Math.sin(th) * rr * 0.95,
              cz - 0.012 - 0.018 * Math.sin((s / 4) * Math.PI) - (i % 3) * 0.005
            ]);
          }
          appendTwistedStrand(pts, 0.0058, 0.0046, 24.0, i % 11 === 0 ? 0.5 : 0, 0.35);
        } else {
          // 16 Shoulder-skimming loose braided ends below the bun!
          const u = (i - 30) / 15 - 0.5;
          const xStart = u * 0.056;
          const len = 0.075 + 0.045 * hash(i * 4.3);
          appendTwistedStrand([
            [xStart * 0.6, cy - 0.008, cz - 0.005],
            [xStart * 1.05, cy - len * 0.45, cz - 0.016],
            [xStart * 1.25 + (hash(i) - 0.5) * 0.014, cy - len, cz - 0.010]
          ], 0.0054, 0.0036, 22.0, i % 5 === 0 ? 0.72 : 0, 0.75);
        }
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* Layered Curved Anisotropic Strand-Ribbon Hair Cards (Ponytail & SilverSwept — ZERO Banana Tubes!) */
  function buildLayeredHairCardsGeo(T, isPonytail) {
    const pos = [], uv = [], col = [], si = [], sw = [], idx = [];

    const addRibbonCard = (pts, wRoot, wMid, wTip, shade, tailWeightMax = 0) => {
      const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2])));
      const segs = 12;
      const baseV = pos.length / 3;
      const headCenter = new T.Vector3(0, 1.615, -0.015);
      const tan = new T.Vector3(), radDir = new T.Vector3(), sideDir = new T.Vector3();

      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const p = curve.getPoint(u);
        curve.getTangent(u, tan);
        radDir.subVectors(p, headCenter);
        if (radDir.lengthSq() < 1e-6) radDir.set(0, 1, 0);
        else radDir.normalize();
        sideDir.crossVectors(tan, radDir);
        if (sideDir.lengthSq() < 1e-6) sideDir.set(1, 0, 0);
        else sideDir.normalize();

        const halfW = (u < 0.45 ? lerp(wRoot, wMid, u / 0.45) : lerp(wMid, wTip, (u - 0.45) / 0.55)) * 0.5;
        // Subtle transverse cup curvature across the 3-vertex ribbon width so light rolls naturally across locks!
        for (let k = -1; k <= 1; k++) {
          const crownCup = k === 0 ? 0.0018 : 0.0;
          const px = p.x + sideDir.x * (k * halfW) + radDir.x * crownCup;
          const py = p.y + sideDir.y * (k * halfW) + radDir.y * crownCup;
          const pz = p.z + sideDir.z * (k * halfW) + radDir.z * crownCup;
          pos.push(px, py, pz);
          // manifest.json: hair_strand_cards.png lock spans u = 0.26..0.74, root at v=1.0 -> feathered V-tip at v=0.0!
          uv.push(lerp(0.26, 0.74, (k + 1) * 0.5), 1.0 - u);
          const sLum = shade * lerp(0.68, 1.16, Math.sin(u * Math.PI * 0.85));
          col.push(sLum, sLum * 0.98, sLum * 0.96);

          const wTail = tailWeightMax * smooth(0.12, 0.88, u);
          si.push(B.HEAD, B.HAIR_TAIL, 0, 0);
          sw.push(1 - wTail, wTail, 0, 0);
        }
      }

      for (let i = 0; i < segs; i++) {
        const r0 = baseV + i * 3, r1 = r0 + 3;
        idx.push(r0, r0 + 1, r1, r0 + 1, r1 + 1, r1);
        idx.push(r0 + 1, r0 + 2, r1 + 1, r0 + 2, r1 + 2, r1 + 1);
      }
    };

    const gatherY = isPonytail ? 1.592 : 1.560;
    const gatherZ = isPonytail ? -0.112 : -0.108;

    // 1. 78 Wide Shingled Crown, Parietal & Side-Swept Hair Cards across 3 overlapping layers (zero crown/side gaps!)
    const partX = 0.008;
    const layerCounts = [28, 26, 24];
    for (let layer = 0; layer < 3; layer++) {
      const lift = 0.0038 + layer * 0.0026;
      const count = layerCounts[layer];
      for (let i = 0; i < count; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const k = Math.floor(i / 2) / (count / 2 - 1); // 0 = front arched hairline -> 1 = rear crown
        const rootZ = lerp(0.062, -0.078, k);
        const rootY = 1.7375 - 0.052 * Math.pow(Math.max(0, rootZ + 0.010) / 0.076, 1.85) - 0.024 * Math.pow(Math.max(0, -rootZ - 0.010) / 0.072, 1.55) + lift * 0.72;
        const rootX = partX * (1 - 0.5 * k) + side * (0.002 + 0.008 * k);

        const midAng = lerp(0.42, 2.62, k);
        const midX = side * (0.0795 + lift + 0.0025 * Math.sin(k * 6.0 + layer)) * Math.sin(midAng * 0.86 + 0.34);
        const midY = lerp(1.644, 1.672, k) + lift * 0.5;
        const midZ = lerp(0.018, -0.106, k);

        const endSpreadX = side * lerp(0.014, 0.005, k) + (hash(i * 3.1 + layer) - 0.5) * 0.007;
        const endSpreadY = gatherY + (hash(i * 7.3 + layer) - 0.5) * 0.011;

        addRibbonCard(
          [
            [rootX, rootY, rootZ],
            [lerp(rootX, midX, 0.56), lerp(rootY, midY, 0.36) + 0.006, lerp(rootZ, midZ, 0.44)],
            [midX, midY, midZ],
            [endSpreadX, endSpreadY, gatherZ - lift * 0.45]
          ],
          0.034, 0.048, 0.024,
          0.84 + 0.26 * hash(i * 5.7 + layer * 13),
          0.0
        );
      }
    }

    // 2. 10 Soft Arched Forehead-to-Temple Framing Locks (sweeping cleanly above superior ear helix y >= 1.632 toward ponytail gather!)
    for (const side of [1, -1]) {
      for (let w = 0; w < 5; w++) {
        const fw = w / 4;
        const dz = w * 0.0075;
        addRibbonCard(
          [
            [partX + side * (0.006 + fw * 0.022), 1.724 - fw * 0.016, 0.044 - dz * 0.6],
            [side * (0.056 + fw * 0.016), 1.684 - fw * 0.012, 0.040 - dz],
            [side * 0.080, 1.644 - fw * 0.008, -0.004 - dz],
            [side * 0.028, gatherY + 0.004, gatherZ]
          ],
          0.020, 0.028, 0.014,
          0.92 + 0.14 * fw,
          0.0
        );
      }
    }

    if (isPonytail) {
      // 34 Multi-Layered Feathered Ponytail Strand-Cards Skinned Smoothly to [B_HEAD -> B_HAIR_TAIL]!
      for (let p = 0; p < 34; p++) {
        const a = (p / 34) * TAU;
        const layerR = (p % 3) * 0.0055 + 0.004;
        const sx = Math.cos(a), sy = Math.sin(a);
        const len = 0.150 + 0.052 * hash(p * 4.9);
        const splayX = sx * (0.028 + 0.015 * hash(p * 2.1));
        const kickZ = -0.132 - 0.024 * sy - 0.012 * hash(p * 8.3);

        addRibbonCard(
          [
            [sx * 0.010, gatherY + sy * 0.010, gatherZ - 0.004],
            [sx * (0.017 + layerR), gatherY + 0.009 + sy * 0.012 - len * 0.18, gatherZ - 0.034 - layerR],
            [splayX * 0.88, gatherY - len * 0.58, kickZ],
            [splayX * 1.18, gatherY - len, kickZ + 0.018]
          ],
          0.020, 0.032, 0.014,
          0.84 + 0.30 * hash(p * 6.3),
          0.92
        );
      }
    } else {
      // Elegant Multi-Ribbon Twisted Silver Chignon / Bun for Etta (silverSwept)
      for (let b = 0; b < 20; b++) {
        const a0 = (b / 20) * TAU;
        const rr = 0.022 + (b % 3) * 0.006;
        addRibbonCard(
          [
            [Math.cos(a0) * 0.014, gatherY + Math.sin(a0) * 0.014, gatherZ],
            [Math.cos(a0 + 1.1) * rr * 1.2, gatherY + Math.sin(a0 + 1.1) * rr, gatherZ - 0.022],
            [Math.cos(a0 + 2.2) * rr * 1.1, gatherY + Math.sin(a0 + 2.2) * rr, gatherZ - 0.026],
            [Math.cos(a0 + 3.1) * 0.012, gatherY + Math.sin(a0 + 3.1) * 0.012, gatherZ - 0.014]
          ],
          0.018, 0.024, 0.012,
          0.88 + 0.24 * hash(b * 3.9),
          0.35
        );
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function createAnisotropicHairCardMat(T, hairCol, assetsV3, cyanGlow) {
    const m = new T.MeshStandardMaterial({
      color: hairCol,
      vertexColors: true,
      roughness: 0.56,
      metalness: 0.04,
      alphaToCoverage: true,
      side: T.DoubleSide
    });
    m.onBeforeCompile = sh => {
      sh.uniforms.tStrand = { value: assetsV3.hairStrandCards };
      sh.uniforms.tStrandProc = { value: assetsV3.proceduralStrandCards };
      sh.uniforms.uCyanGlow = cyanGlow;

      sh.vertexShader =
        "varying vec2 vCardUv;\nvarying vec3 vCardPos;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvCardUv = uv;\nvCardPos = position;"
        );

      sh.fragmentShader =
        "uniform sampler2D tStrand, tStrandProc;\nuniform vec4 uCyanGlow;\nvarying vec2 vCardUv;\nvarying vec3 vCardPos;\n" +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "vec4 stA = texture2D(tStrand, vCardUv);\n" +
            "vec4 stP = texture2D(tStrandProc, vec2((vCardUv.x - 0.26) / 0.48, 1.0 - vCardUv.y));\n" +
            "float normX = clamp((vCardUv.x - 0.26) / 0.48, 0.0, 1.0);\n" +
            "float edgeFade = sin(normX * 3.14159265);\n" +
            "float tipFade = smoothstep(0.01, 0.22, vCardUv.y);\n" +
            "float alphaVal = max(stA.a, stP.a * pow(edgeFade, 0.45) * tipFade);\n" +
            "if (alphaVal < 0.22) discard;\n" +
            "// Extract neutral luminance from hair_strand_cards.png so silver & dark-espresso hair tints stay 100% color-true!\n" +
            "float texLum = dot(stA.rgb, vec3(0.299, 0.587, 0.114));\n" +
            "float strandMod = stA.a > 0.1 ? clamp(texLum * 1.95, 0.45, 1.55) : (0.72 + 0.55 * stP.r);\n" +
            "// Kajiya-Kay dual-shifted anisotropic hair highlight band!\n" +
            "float anisoBand = exp(-pow((vCardUv.y - 0.66 + 0.05 * sin(normX * 42.0)) / 0.14, 2.0));\n" +
            "diffuseColor.rgb *= (strandMod + 0.34 * anisoBand);\n" +
            "if (!gl_FrontFacing) diffuseColor.rgb *= 0.68;"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "float fresC = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.8);\n" +
            "totalEmissiveRadiance += diffuseColor.rgb * (fresC * 0.26);"
          );
    };
    m.customProgramCacheKey = () => "v3AnisoHairCard_v1";
    return m;
  }

  /* Skinned 8-Shell Volumetric Curly Beard + Mustache Geometry (Skinned 1:1 to [B_JAW, B_HEAD]!) */
  function buildVolumetricBeardGeo(T) {
    const rings = refineRings([
      { p: [0, 1.494, 0.042], w: 0.036, f: 0.048, b: 0.012, e: 0.90 },
      { p: [0, 1.512, 0.014], w: 0.056, f: 0.078, b: 0.015, e: 0.88 },
      { p: [0, 1.534, 0.006], w: 0.068, f: 0.088, b: 0.018, e: 0.88 },
      { p: [0, 1.560, 0.002], w: 0.073, f: 0.090, b: 0.018, e: 0.90 },
      { p: [0, 1.586, -0.002], w: 0.076, f: 0.074, b: 0.018, e: 0.92 }
    ], 3);

    const seg = 34, n = rings.length, cols = seg + 1;
    const pos = [], uv = [], hLen = [], si = [], sw = [], idx = [];
    const a0 = -1.48, a1 = 1.48;

    for (let i = 0; i < n; i++) {
      const r = rings[i], v = i / Math.max(1, n - 1), y = r.p[1];
      for (let j = 0; j <= seg; j++) {
        const u = j / seg, a = lerp(a0, a1, u), sa = Math.sin(a), ca = Math.cos(a);
        const lx = Math.sign(sa) * Math.pow(Math.abs(sa), r.e) * r.w;
        const lz = Math.sign(ca) * Math.pow(Math.abs(ca), r.e) * (ca >= 0 ? r.f : r.b);
        const ax = Math.abs(lx);

        // Keep vermilion lips, philtrum mustache & open oral aperture 100% clear (portrait plate carries crisp hair-by-hair upper mustache -> ZERO grey blobs!)
        const mouthClear = g1(ax, 0, 0.0295) * smooth(1.539, 1.550, y);
        const sideburnArchY = lerp(1.540, 1.580, smooth(0.026, 0.064, ax));
        const upperCheekOpen = smooth(sideburnArchY + 0.005, sideburnArchY - 0.014, y);
        const edgeFade = Math.sin(u * Math.PI) * smooth(0.0, 0.14, v) * (1.0 - smooth(0.82, 0.99, v));

        const beardMask = clamp(upperCheekOpen * (1.0 - mouthClear) * Math.pow(Math.max(0, edgeFade), 0.45), 0, 1);
        const chinFullness = 1.0 + 0.65 * g1(y, 1.514, 0.018) * g1(ax, 0, 0.032);
        const len = beardMask * 0.0135 * chinFullness * (0.82 + 0.35 * vnoise(u * 14, v * 12));

        const pz = r.p[2] + lz - (beardMask < 0.08 ? 0.024 : 0.0);
        pos.push(r.p[0] + lx, y, pz);
        uv.push(u * 2.5, v * 2.0);
        hLen.push(len);

        // Exact 0.95 B_JAW weight on chin/mandible matching lower lip skinning 1:1; 0.0 B_JAW on mustache!
        const yJawCut = lerp(1.5525, 1.546, smooth(0.024, 0.046, ax));
        const wJaw = (1.0 - smooth(yJawCut - 0.004, yJawCut + 0.004, y)) * 0.95;
        si.push(B.JAW, B.HEAD, 0, 0);
        sw.push(wJaw, 1 - wJaw, 0, 0);
      }
    }

    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const A = i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
        idx.push(A, Bv, C, Bv, D, C);
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setAttribute("aHairLen", new T.Float32BufferAttribute(hLen, 1));
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ============================================================================
     7B. 3D SCULPTED MAXILLARY & MANDIBULAR DENTAL ARCHES + GINGIVA + MUSCULAR TONGUE
     (Recessed ~9.4mm behind closed lip rima -> ZERO closed-lip poke-through;
      Natural warm ivory #dfd6c7 enamel + interdental grooves + oral depth AO!)
     ============================================================================ */
  let cachedOralGeo = null;
  function buildOralDentitionAndTongueGeo(T) {
    if (cachedOralGeo) return cachedOralGeo.clone();

    const pos = [], uv = [], col = [], oralMeta = [], si = [], sw = [], idx = [];
    // Tooth arch boundaries along |u| in [0, 1]: Central(0..0.17), Lateral(0.17..0.31), Canine(0.31..0.47), Premolar1(0.47..0.68), Premolar2/Molar(0.68..1.0)
    const TOOTH_BOUNDS = [0.00, 0.17, 0.31, 0.47, 0.68, 1.001];

    const evalToothSlot = absU => {
      for (let k = 0; k < 5; k++) {
        if (absU <= TOOTH_BOUNDS[k + 1]) {
          const tLocal = clamp((absU - TOOTH_BOUNDS[k]) / (TOOTH_BOUNDS[k + 1] - TOOTH_BOUNDS[k]), 0, 1);
          return { toothIdx: k, tLocal };
        }
      }
      return { toothIdx: 4, tLocal: 0.5 };
    };

    const appendDentalArch = isUpper => {
      const NU = 52, NV = 5;
      const baseV = pos.length / 3;
      for (let iv = 0; iv <= NV; iv++) {
        for (let iu = 0; iu <= NU; iu++) {
          const u = (iu / NU) * 2.0 - 1.0; // -1 (right molar) .. +1 (left molar)
          const absU = Math.abs(u);
          const phi = u * 1.36;
          const rx = Math.sin(phi), rz = Math.cos(phi);

          // Narrowed, recessed horseshoe dental arch (~11mm behind outer vermilion -> ZERO closed-lip, profile, or OO pucker poke-through!)
          const archX = (isUpper ? 0.0168 : 0.0154) * rx;
          const archZ = (isUpper ? 0.0746 : 0.0730) - (isUpper ? 0.0192 : 0.0180) * (1.0 - rz);

          const { toothIdx, tLocal } = evalToothSlot(absU);
          const crownBelly = Math.sin(tLocal * Math.PI);
          const rawEmbrasure = 1.0 - smooth(0.0, 0.20, Math.min(tLocal, 1.0 - tLocal));
          // Soften geometric V-notch right at median u=0 so central incisors never form a 45° specular laser stripe in Night/Cyanotype!
          const medianGeoSoft = absU < 0.045 ? 0.32 : 1.0;
          const embrasure = rawEmbrasure;
          const geoEmbrasure = rawEmbrasure * medianGeoSoft;

          // Anatomical 5.6mm maxillary incisor crowns (subtle scalloped gingiva only at very top of wide AA/laugh — ZERO gummy wall!)
          let yGum, yEdge;
          if (isUpper) {
            const gumBase = toothIdx === 0 || toothIdx === 2 ? 1.5566 : 1.5560;
            yGum = gumBase - 0.0014 * embrasure;
            const edgeBase = toothIdx === 0 ? 1.5504 : (toothIdx === 1 ? 1.5509 : (toothIdx === 2 ? 1.5501 : 1.5510));
            const canineTip = toothIdx === 2 ? -0.00040 * crownBelly : 0.0;
            yEdge = edgeBase + canineTip + 0.00028 * geoEmbrasure;
          } else {
            const gumBase = 1.5468;
            yGum = gumBase + 0.0012 * embrasure;
            const edgeBase = toothIdx === 2 ? 1.5514 : (toothIdx <= 1 ? 1.5511 : 1.5508);
            yEdge = edgeBase - 0.00022 * geoEmbrasure;
          }

          let py, radOff, isGum = 0.0, shade = 1.0;
          if (iv === 0) {
            py = isUpper ? 1.5635 : 1.5415;
            radOff = 0.0003;
            isGum = 1.0;
            shade = 0.72;
          } else if (iv === 1) {
            py = yGum;
            radOff = 0.00115 - 0.00015 * geoEmbrasure;
            isGum = 0.96;
            shade = 0.90;
          } else if (iv === 2) {
            py = lerp(yGum, yEdge, 0.28);
            radOff = 0.00128 + 0.00046 * crownBelly - 0.00032 * geoEmbrasure;
            isGum = 0.0;
            shade = 0.95 - 0.20 * embrasure;
          } else if (iv === 3) {
            py = yEdge;
            radOff = 0.00095 + 0.00034 * crownBelly - 0.00028 * geoEmbrasure;
            isGum = 0.0;
            shade = 1.00 - 0.22 * embrasure;
          } else if (iv === 4) {
            py = yEdge + (isUpper ? 0.00045 : -0.00045);
            radOff = -0.0011;
            isGum = 0.0;
            shade = 0.72;
          } else {
            py = isUpper ? 1.5615 : 1.5440;
            radOff = -0.0025;
            isGum = 1.0;
            shade = 0.45;
          }

          const px = archX + rx * radOff;
          const pz = archZ + rz * radOff;
          pos.push(px, py, pz);
          uv.push((u + 1) * 0.5, iv / NV);
          col.push(shade, shade, shade);
          // oralMeta: (partId: 0=upperArch, 1=lowerArch, 2=tongue; tipProg; isGum; embrasure)
          oralMeta.push(isUpper ? 0.0 : 1.0, iv === 3 ? 1.0 : 0.0, isGum, embrasure);

          if (isUpper) {
            si.push(B.HEAD, 0, 0, 0);
            sw.push(1.0, 0.0, 0.0, 0.0);
          } else {
            si.push(B.JAW, B.HEAD, 0, 0);
            sw.push(0.96, 0.04, 0.0, 0.0);
          }
        }
      }

      const stride = NU + 1;
      for (let iv = 0; iv < NV; iv++) {
        for (let iu = 0; iu < NU; iu++) {
          const A = baseV + iv * stride + iu;
          const Bv = A + 1;
          const C = A + stride;
          const D = C + 1;
          if (isUpper) idx.push(A, C, Bv, Bv, C, D);
          else idx.push(A, Bv, C, Bv, D, C);
        }
      }
    };

    appendDentalArch(true);
    appendDentalArch(false);

    // Sculpted 3D Muscular Tongue (median longitudinal sulcus + tapered rounded tip tucked cleanly inside 0.0730m mandibular arch!)
    const UT = 16, VT = 14;
    const baseT = pos.length / 3;
    for (let iu = 0; iu <= UT; iu++) {
      const u = iu / UT; // 0 = pharyngeal root (z=0.0465) -> 1 = rounded tongue tip (z=0.0706)
      const cz = lerp(0.0465, 0.0706, u);
      const cy = lerp(1.5450, 1.5480, Math.sin(u * Math.PI * 0.68));
      const widthEnv = u < 0.65 ? lerp(0.82, 1.0, u / 0.65) : Math.pow(Math.max(0.04, 1.0 - Math.pow((u - 0.65) / 0.35, 1.8)), 0.52);
      const rxT = 0.0124 * widthEnv;
      const ryT = 0.0038 * (1.0 - 0.56 * Math.pow(u, 2.0));

      for (let iv = 0; iv <= VT; iv++) {
        const th = (iv / VT) * TAU;
        const cth = Math.cos(th), sth = Math.sin(th); // sth > 0 dorsal tongue surface
        const sulcus = sth > 0 ? -0.00075 * g1(cth, 0, 0.26) * smooth(0.12, 0.86, u) * sth : 0.0;
        const px = cth * rxT;
        const py = cy + sth * ryT + sulcus;
        const pz = cz + (iu === UT ? 0.0012 * (1.0 - 0.5 * (cth * cth + sth * sth)) : 0.0);

        pos.push(px, py, pz);
        uv.push(iv / VT, u);
        const dorsalLight = 0.72 + 0.28 * Math.max(0, sth);
        const sulcusAO = 1.0 - 0.18 * (sth > 0 ? g1(cth, 0, 0.22) : 0);
        const sh = dorsalLight * sulcusAO * lerp(0.45, 1.0, smooth(0.0, 0.55, u));
        col.push(sh, sh, sh);
        oralMeta.push(2.0, u, 0.0, Math.max(0, sth));

        const wJaw = lerp(0.76, 0.96, smooth(0.0, 0.36, u));
        si.push(B.JAW, B.HEAD, 0, 0);
        sw.push(wJaw, 1.0 - wJaw, 0.0, 0.0);
      }
    }
    const tStride = VT + 1;
    for (let iu = 0; iu < UT; iu++) {
      for (let iv = 0; iv < VT; iv++) {
        const A = baseT + iu * tStride + iv;
        const Bv = A + 1;
        const C = A + tStride;
        const D = C + 1;
        // Outward normal: dP/d(iv) x dP/d(iu) -> CCW outward!
        idx.push(A, Bv, C, Bv, D, C);
      }
    }
    // Rounded anterior tongue tip cap
    const tipCapId = pos.length / 3;
    pos.push(0.0, 1.5480, 0.0715);
    uv.push(0.5, 1.0);
    col.push(0.96, 0.96, 0.96);
    oralMeta.push(2.0, 1.0, 0.0, 0.8);
    si.push(B.JAW, B.HEAD, 0, 0);
    sw.push(0.96, 0.04, 0.0, 0.0);
    const lastRingStart = baseT + UT * tStride;
    for (let iv = 0; iv < VT; iv++) {
      idx.push(lastRingStart + iv, lastRingStart + iv + 1, tipCapId);
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setAttribute("aOralMeta", new T.Float32BufferAttribute(oralMeta, 4));
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    // Smooth dental-arch normals toward macroscopic horseshoe normal so interdental V-grooves NEVER catch a vertical specular mirror stripe!
    const nAttr = g.attributes.normal;
    const archVertsPer = (5 + 1) * (52 + 1);
    for (let archIdx = 0; archIdx < 2; archIdx++) {
      const isUp = archIdx === 0;
      const baseArch = archIdx * archVertsPer;
      for (let iv = 0; iv <= 5; iv++) {
        for (let iu = 0; iu <= 52; iu++) {
          const vi = baseArch + iv * 53 + iu;
          const u = (iu / 52) * 2.0 - 1.0;
          const phi = u * 1.36;
          const axN = Math.sin(phi), ayN = isUp ? -0.06 : 0.06, azN = Math.cos(phi);
          const nx = lerp(nAttr.getX(vi), axN, 0.80);
          const ny = lerp(nAttr.getY(vi), ayN, 0.80);
          const nz = lerp(nAttr.getZ(vi), azN, 0.80);
          const nl = Math.hypot(nx, ny, nz) || 1.0;
          nAttr.setXYZ(vi, nx / nl, ny / nl, nz / nl);
        }
      }
    }
    for (let iu = 0; iu <= UT; iu++) {
      const a0 = baseT + iu * tStride, a1 = a0 + VT;
      const nx = nAttr.getX(a0) + nAttr.getX(a1), ny = nAttr.getY(a0) + nAttr.getY(a1), nz = nAttr.getZ(a0) + nAttr.getZ(a1);
      const nl = Math.hypot(nx, ny, nz) || 1.0;
      nAttr.setXYZ(a0, nx / nl, ny / nl, nz / nl);
      nAttr.setXYZ(a1, nx / nl, ny / nl, nz / nl);
    }
    cachedOralGeo = g;
    return g;
  }

  function createOralDentitionMat(T, facsUniforms) {
    const facsBundle = facsUniforms || createSharedFacsUniformBundle(T);
    const m = new T.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.26,
      metalness: 0.0,
      envMapIntensity: 0.28
    });
    m.userData = m.userData || {};
    m.userData.facsUniforms = facsBundle;

    m.onBeforeCompile = sh => {
      sh.uniforms.uFacsA = facsBundle.uFacsA;
      sh.uniforms.uFacsB = facsBundle.uFacsB;
      sh.uniforms.uFacsC = facsBundle.uFacsC;
      sh.uniforms.uFacsD = facsBundle.uFacsD;

      sh.vertexShader =
        "attribute vec4 aOralMeta;\nuniform vec4 uFacsA, uFacsB, uFacsC, uFacsD;\n" +
        "varying vec4 vOralMeta;\nvarying vec3 vOralBind;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n" +
          "vOralMeta = aOralMeta;\nvOralBind = position;\n" +
          "float closedOralRecess = 1.0 - smoothstep(0.008, 0.055, uFacsD.x + uFacsA.z * 0.45 + uFacsD.w * 0.65);\n" +
          "transformed.z -= 0.0022 * closedOralRecess;\n" +
          "if (aOralMeta.x > 1.5) {\n" +
          "  // Articulated 3D Tongue: curls tip behind upper incisors on LL/N/T (tongueLift) & protrudes on TH (tongueOut)!\n" +
          "  float tProg = smoothstep(0.20, 0.96, aOralMeta.y);\n" +
          "  float jawOp = uFacsD.x, tLift = uFacsD.y, tOut = uFacsD.z;\n" +
          "  transformed.y += tProg * (tLift * (0.0072 + 0.0155 * jawOp) + tOut * 0.0048 * jawOp);\n" +
          "  transformed.z += tProg * (tOut * 0.0052 + tLift * 0.0020);\n" +
          "}"
        );

      sh.fragmentShader =
        "uniform vec4 uFacsA, uFacsB, uFacsC, uFacsD;\n" +
        "varying vec4 vOralMeta;\nvarying vec3 vOralBind;\n" +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "// Warm natural ivory #dfd6c7 enamel, rose-coral gingiva & plush muscular rose-burgundy tongue (NEVER white Chiclets!)\n" +
            "vec3 linEnamelBody = pow(vec3(0.875, 0.839, 0.780), vec3(2.2));\n" +
            "vec3 linEnamelNeck = pow(vec3(0.810, 0.752, 0.670), vec3(2.2));\n" +
            "vec3 linEnamelTip  = pow(vec3(0.800, 0.782, 0.755), vec3(2.2));\n" +
            "vec3 linGingiva    = pow(vec3(0.470, 0.215, 0.225), vec3(2.2));\n" +
            "vec3 linTongue     = pow(vec3(0.565, 0.245, 0.255), vec3(2.2));\n" +
            "vec3 baseOral;\n" +
            "if (vOralMeta.x > 1.5) {\n" +
            "  float pap = 0.92 + 0.14 * fract(sin(dot(floor(vOralBind.xz * 1800.0), vec2(12.9898, 78.233))) * 43758.5453);\n" +
            "  baseOral = linTongue * pap;\n" +
            "} else {\n" +
            "  vec3 toothCol = mix(linEnamelNeck, linEnamelBody, smoothstep(0.0, 0.55, vOralMeta.y));\n" +
            "  toothCol = mix(toothCol, linEnamelTip, smoothstep(0.65, 1.0, vOralMeta.y) * 0.45);\n" +
            "  toothCol *= (1.0 - 0.14 * vOralMeta.w);\n" +
            "  float gumBlend = smoothstep(0.26, 0.58, vOralMeta.z);\n" +
            "  baseOral = mix(toothCol, linGingiva, gumBlend);\n" +
            "}\n" +
            "// Strong 3D oral-cavity depth shadow + natural upper-lip overhang AO!\n" +
            "float depthAO = smoothstep(0.047, 0.0752, vOralBind.z);\n" +
            "float buccalAO = 1.0 - 0.46 * smoothstep(0.010, 0.019, abs(vOralBind.x));\n" +
            "float uLipOverhang = vOralMeta.x < 0.5 ? (0.52 + 0.48 * smoothstep(1.5580, 1.5520, vOralBind.y)) : 1.0;\n" +
            "float mouthExpose = clamp(uFacsD.x * 1.45 + uFacsA.x * 0.38 + uFacsA.z * 0.28 + uFacsA.w * 0.30 + uFacsC.z * 0.28 + uFacsD.w * 0.35, 0.0, 1.0);\n" +
            "float lipShadowAO = mix(0.24, 1.0, smoothstep(0.02, 0.38, mouthExpose)) * uLipOverhang;\n" +
            "diffuseColor.rgb *= baseOral * (0.26 + 0.74 * depthAO) * buccalAO * lipShadowAO;"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "float oralSubsurf = mix(0.05, 0.22, smoothstep(0.24, 0.56, vOralMeta.z));\n" +
            "if (vOralMeta.x > 1.5) oralSubsurf = 0.22;\n" +
            "totalEmissiveRadiance += baseOral * oralSubsurf * lipShadowAO * (0.45 + 0.55 * depthAO) * mix(1.0, buccalAO, 0.70);"
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\n" +
            "roughnessFactor = vOralMeta.x > 1.5 ? 0.38 : mix(mix(0.25, 0.62, vOralMeta.w), 0.32, smoothstep(0.24, 0.56, vOralMeta.z));"
          );
    };
    m.customProgramCacheKey = () => "v5OralDentitionTongue_v9";
    return m;
  }

  function findCharacterFacsBundle(headAnchor) {
    let root = headAnchor;
    while (root && root.parent && root.parent.type !== "Scene") {
      root = root.parent;
    }
    let found = null;
    if (root && root.traverse) {
      root.traverse(obj => {
        if (!found && obj.material && obj.material.userData && obj.material.userData.facsUniforms) {
          found = obj.material.userData.facsUniforms;
        }
      });
    }
    return found;
  }

  function buildVolumetricHairAssembly(T, spec, skeleton, addSkinnedFn, headAnchor, assets, assetsV3, cyanGlowUniform) {
    const hairStyle = spec.hair || "croppedCoily";
    const hairCol = new T.Color(spec.hairHex !== undefined ? spec.hairHex : 0x1a1512);
    if (hairCol.r + hairCol.g + hairCol.b < 0.24) hairCol.offsetHSL(0, 0, 0.035);

    // Discover shared per-character FACS uniform bundle from the head's skinMat so teeth, tongue & beard stay 100% synced!
    const sharedFacs = findCharacterFacsBundle(headAnchor) || createSharedFacsUniformBundle(T);

    // Attach 3D Sculpted Maxillary & Mandibular Dental Arches + Rose Gingiva + Articulated Muscular Tongue!
    const oralGeo = buildOralDentitionAndTongueGeo(T);
    const oralMat = createOralDentitionMat(T, sharedFacs);
    const oralMesh = addSkinnedFn(oralGeo, oralMat);
    oralMesh.castShadow = false;
    oralMesh.receiveShadow = false;

    const COIL_SHELL_ORDER = [0, 4 / 12, 8 / 12, 12 / 12, 2 / 12, 6 / 12, 10 / 12, 1 / 12, 3 / 12, 5 / 12, 7 / 12, 9 / 12, 11 / 12];
    const BEARD_SHELL_ORDER = [0, 3 / 8, 6 / 8, 8 / 8, 1 / 8, 4 / 8, 2 / 8, 5 / 8, 7 / 8];
    const WISPY_SHELL_ORDER = [0, 0.45, 0.82, 0.25];
    const batchedMeshes = [];

    if (hairStyle === "croppedCoily" || hairStyle === "glassesCrop") {
      const isShort = hairStyle === "glassesCrop" || (spec.fem !== undefined && spec.fem < 0.35);
      const scalpGeo = buildCoilyScalpGeo(T, isShort);
      const batchedCoilGeo = buildBatchedShellGeo(T, scalpGeo, COIL_SHELL_ORDER);
      const coilMat = createHairShellMaterial(T, hairCol, 0.0, assetsV3, cyanGlowUniform, isShort ? 1.25 : 1.05, false);
      const m = addSkinnedFn(batchedCoilGeo, coilMat);
      m.castShadow = true;
      batchedMeshes.push({ geo: batchedCoilGeo, nearShells: 13, midShells: 7, farShells: 4 });

      if (hairStyle === "glassesCrop") {
        const lensMat = new T.MeshPhysicalMaterial({
          color: 0xdff4fa, transparent: true, opacity: 0.14, roughness: 0.04, clearcoat: 1.0, depthWrite: false
        });
        for (const s of [-1, 1]) {
          const rim = new T.Mesh(new T.TorusGeometry(0.0150, 0.0012, 7, 24), assets.ironDarkMat);
          rim.position.set(s * 0.0308, 1.6160, 0.0838);
          headAnchor.add(rim);
          const lens = new T.Mesh(new T.CircleGeometry(0.0140, 22), lensMat);
          lens.position.set(s * 0.0308, 1.6160, 0.0840);
          headAnchor.add(lens);
          const padStrut = new T.Mesh(new T.BoxGeometry(0.0012, 0.0036, 0.0052), assets.ironDarkMat);
          padStrut.position.set(s * 0.0142, 1.6145, 0.0815);
          headAnchor.add(padStrut);
          const armCurve = new T.CatmullRomCurve3([
            new T.Vector3(s * 0.0458, 1.6180, 0.0838),
            new T.Vector3(s * 0.0650, 1.6200, 0.0580),
            new T.Vector3(s * 0.0750, 1.6218, 0.0260),
            new T.Vector3(s * 0.0766, 1.6248, -0.0120),
            new T.Vector3(s * 0.0752, 1.6080, -0.0360)
          ]);
          const arm = new T.Mesh(new T.TubeGeometry(armCurve, 20, 0.00115, 6, false), assets.ironDarkMat);
          headAnchor.add(arm);
        }
        const bridgeCurve = new T.CatmullRomCurve3([
          new T.Vector3(-0.0158, 1.6175, 0.0840),
          new T.Vector3(-0.0085, 1.6204, 0.0855),
          new T.Vector3( 0.0000, 1.6214, 0.0862),
          new T.Vector3( 0.0085, 1.6204, 0.0855),
          new T.Vector3( 0.0158, 1.6175, 0.0840)
        ]);
        const bridge = new T.Mesh(new T.TubeGeometry(bridgeCurve, 14, 0.00118, 6, false), assets.ironDarkMat);
        headAnchor.add(bridge);
      }
    } else if (hairStyle === "shortLocs" || hairStyle === "cornrowBraids") {
      const isCornrows = hairStyle === "cornrowBraids";
      const scalpGeo = buildCoilyScalpGeo(T, true);
      const aLen = scalpGeo.attributes.aHairLen;
      for (let i = 0; i < aLen.count; i++) aLen.setX(i, aLen.getX(i) * 0.22);

      const batchedWispyGeo = buildBatchedShellGeo(T, scalpGeo, WISPY_SHELL_ORDER);
      const wispyMat = createHairShellMaterial(T, hairCol, 0.0, assetsV3, cyanGlowUniform, 1.45, false);
      const wm = addSkinnedFn(batchedWispyGeo, wispyMat);
      wm.castShadow = false;
      batchedMeshes.push({ geo: batchedWispyGeo, nearShells: 4, midShells: 2, farShells: 1 });

      const locMat = new T.MeshStandardMaterial({
        color: hairCol.clone().multiplyScalar(1.25),
        vertexColors: true,
        map: assetsV3.hairLocsBraids,
        bumpMap: assetsV3.hairLocsBraids,
        bumpScale: 0.018,
        roughness: 0.70,
        metalness: 0.04
      });
      const locsGeo = buildHelicalLocsOrBraidsGeo(T, isCornrows);
      addSkinnedFn(locsGeo, locMat);
    } else if (hairStyle === "ponytail" || hairStyle === "silverSwept") {
      const isPonytail = hairStyle === "ponytail";
      const combedCapGeo = buildCoilyScalpGeo(T, true, false);
      const combedCapMat = new T.MeshStandardMaterial({
        color: hairCol.clone().multiplyScalar(0.72),
        bumpMap: assetsV3.hairLocsBraids,
        bumpScale: 0.016,
        roughness: 0.62,
        metalness: 0.03,
        alphaToCoverage: true
      });
      combedCapMat.onBeforeCompile = sh => {
        sh.vertexShader = "attribute float aHairLen;\nvarying float vCapLen;\nvarying vec3 vCapPos;\n" +
          sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvCapLen = aHairLen;\nvCapPos = position;");
        sh.fragmentShader = "varying float vCapLen;\nvarying vec3 vCapPos;\n" +
          sh.fragmentShader.replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "float capAng = atan(vCapPos.x - 0.008, vCapPos.z + 0.020);\n" +
            "float strandWave = 0.5 + 0.5 * sin(capAng * 108.0 + sin(vCapPos.y * 55.0) * 1.1);\n" +
            "float babyWisp = 0.5 + 0.5 * sin(capAng * 260.0 + 0.8 * sin(capAng * 67.0));\n" +
            "float strandGroove = 0.80 + 0.34 * strandWave;\n" +
            "float capAlpha = smoothstep(0.0018, 0.0074, vCapLen + (babyWisp * 0.65 + strandWave * 0.35 - 0.52) * 0.0038);\n" +
            "if (capAlpha < 0.30) discard;\n" +
            "diffuseColor.rgb *= strandGroove;\n" +
            "diffuseColor.a = capAlpha;"
          );
      };
      combedCapMat.customProgramCacheKey = () => "v5CombedHairCap_v3";
      addSkinnedFn(combedCapGeo, combedCapMat);

      const cardMat = createAnisotropicHairCardMat(T, hairCol, assetsV3, cyanGlowUniform);
      const cardsGeo = buildLayeredHairCardsGeo(T, isPonytail);
      addSkinnedFn(cardsGeo, cardMat);

      if (isPonytail) {
        const tieMat = new T.MeshStandardMaterial({ color: 0x1c2329, roughness: 0.72 });
        const tie = new T.Mesh(new T.TorusGeometry(0.0145, 0.0044, 8, 18), tieMat);
        tie.position.set(0, 1.592, -0.111);
        tie.rotation.x = 0.35;
        headAnchor.add(tie);
      }
    }

    // Single-draw-call 9-layer Skinned Curly Beard (`B_JAW` + `B_HEAD` + live GPU FACS deformation!)
    if (spec.beard) {
      const beardGeo = buildVolumetricBeardGeo(T);
      const batchedBeardGeo = buildBatchedShellGeo(T, beardGeo, BEARD_SHELL_ORDER);
      const beardCol = hairCol.clone();
      const beardMat = createHairShellMaterial(T, beardCol, 0.0, assetsV3, cyanGlowUniform, 1.45, true, sharedFacs);
      const bm = addSkinnedFn(batchedBeardGeo, beardMat);
      bm.castShadow = false;
      batchedMeshes.push({ geo: batchedBeardGeo, nearShells: 9, midShells: 6, farShells: 4 });
    }

    let lastLodTier = 0;
    function setHairLod(lodDist) {
      const tier = lodDist < 14 ? 0 : (lodDist < 22 ? 1 : 2);
      oralMesh.visible = lodDist < 18;
      if (tier === lastLodTier) return;
      lastLodTier = tier;
      for (let i = 0; i < batchedMeshes.length; i++) {
        const b = batchedMeshes[i];
        const count = tier === 0 ? b.nearShells : (tier === 1 ? b.midShells : b.farShells);
        b.geo.setDrawRange(0, count * b.geo.userData.indicesPerShell);
      }
    }

    return { setHairLod, oralMesh, facsUniforms: sharedFacs };
  }

  /* ============================================================================
     8. CLINICAL X-RAY 56-BONE SKELETON & LIVE MUSCLE VISUALIZER
     (`ch.setDebugSkeleton(bool)` — 100% zero-GC, depthTest: false, 60+ FPS!)
     ============================================================================ */
  function createXRaySkeletonVisualizer(T, bones, group) {
    // Collect bone links: octahedral 4-rib diamond prisms for major bones + crisp phalanx links + radius/ulna crossover!
    const boneLinks = [];
    for (let i = 1; i < bones.length; i++) {
      const p = bones[i].userData.parentIdx;
      if (p <= 0) continue; // Skip root -> pelvis ground link!
      const isFinger = (i >= B.L_THUMB_1 && i <= B.R_PINKY_3);
      const isHelper = !bones[i].userData.isAnatomical;
      if (i === B.COAT_B || i === B.COAT_L || i === B.COAT_R) continue;
      boneLinks.push({ a: p, b: i, isFinger, isHelper });
    }

    // Anatomical muscle lines (Sternocleidomastoid, Deltoid, Biceps, Triceps, Brachioradialis, Quadriceps, Calf)
    const muscleLinks = [
      [B.HEAD, B.CLAV_L], [B.HEAD, B.CLAV_R],
      [B.CLAV_L, B.UARM_L], [B.CLAV_R, B.UARM_R],
      [B.UARM_L, B.FARM_TWIST_L], [B.UARM_R, B.FARM_TWIST_R], // Biceps/brachialis line
      [B.UARM_L, B.ELBOW_VOL_L],  [B.UARM_R, B.ELBOW_VOL_R],  // Triceps -> olecranon
      [B.PELVIS, B.KNEE_VOL_L],   [B.PELVIS, B.KNEE_VOL_R],   // Rectus femoris
      [B.KNEE_VOL_L, B.FOOT_L],   [B.KNEE_VOL_R, B.FOOT_R]    // Gastrocnemius
    ];

    // Each major bone link gets an octahedral prism (8 segments = 16 verts), each finger/helper gets 2 crisp crossed/axial segments,
    // plus ribcage & pelvis anatomical hoops + muscle lines!
    let segCount = 0;
    for (const lk of boneLinks) {
      segCount += (lk.isFinger || lk.isHelper) ? 1 : 8;
    }
    segCount += 12; // Ribcage & iliac pelvic hoops + dual radius-ulna crossover rods!
    segCount += muscleLinks.length;

    const linePos = new Float32Array(segCount * 2 * 3);
    const lineCol = new Float32Array(segCount * 2 * 3);
    const lineGeo = new T.BufferGeometry();
    lineGeo.setAttribute("position", new T.BufferAttribute(linePos, 3));
    lineGeo.setAttribute("color", new T.BufferAttribute(lineCol, 3));
    lineGeo.boundingSphere = new T.Sphere(new T.Vector3(0, 0.9, 0), 2.5);

    const lineMat = new T.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false
    });
    const lineMesh = new T.LineSegments(lineGeo, lineMat);
    lineMesh.frustumCulled = false;
    lineMesh.renderOrder = 998;
    lineMesh.visible = false;

    // Joint Node Diamonds (56 anatomical joints + key volume helpers!)
    const jointIndices = [];
    for (let i = 1; i < bones.length; i++) {
      if (i === B.COAT_B || i === B.COAT_L || i === B.COAT_R) continue;
      jointIndices.push(i);
    }
    const jointGeo = new T.OctahedronGeometry(1, 0);
    const jointMat = new T.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false
    });
    const jointInst = new T.InstancedMesh(jointGeo, jointMat, jointIndices.length);
    jointInst.frustumCulled = false;
    jointInst.renderOrder = 999;
    jointInst.visible = false;

    const cBone = new T.Color(0x38ecff);
    const cFinger = new T.Color(0x6effc8);
    const cHelper = new T.Color(0xffb340);
    const cJoint = new T.Color();
    for (let k = 0; k < jointIndices.length; k++) {
      const bi = jointIndices[k];
      if (!bones[bi].userData.isAnatomical) cJoint.copy(cHelper);
      else if (bi >= B.L_THUMB_1 && bi <= B.R_PINKY_3) cJoint.copy(cFinger);
      else cJoint.copy(cBone);
      jointInst.setColorAt(k, cJoint);
    }
    if (jointInst.instanceColor) jointInst.instanceColor.needsUpdate = true;

    group.add(lineMesh);
    group.add(jointInst);

    const mInvGrp = new T.Matrix4();
    const vA = new T.Vector3(), vB = new T.Vector3(), vMid = new T.Vector3();
    const vDir = new T.Vector3(), vN1 = new T.Vector3(), vN2 = new T.Vector3(), vUp = new T.Vector3(0, 0, 1);
    const pCorner = [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()];
    const mDummy = new T.Matrix4(), qIdent = new T.Quaternion(), vSc = new T.Vector3();

    let enabled = false;

    function update() {
      if (!enabled) return;
      mInvGrp.copy(group.matrixWorld).invert();

      let ptr = 0;
      const writeSeg = (ax, ay, az, bx, by, bz, r, g, b) => {
        if (ptr + 6 > linePos.length) return;
        linePos[ptr] = ax; linePos[ptr + 1] = ay; linePos[ptr + 2] = az;
        linePos[ptr + 3] = bx; linePos[ptr + 4] = by; linePos[ptr + 5] = bz;
        lineCol[ptr] = r; lineCol[ptr + 1] = g; lineCol[ptr + 2] = b;
        lineCol[ptr + 3] = r * 0.88; lineCol[ptr + 4] = g * 0.88; lineCol[ptr + 5] = b * 0.88;
        ptr += 6;
      };

      const localPosOf = (bIdx, out) => {
        bones[bIdx].getWorldPosition(out);
        return out.applyMatrix4(mInvGrp);
      };

      for (let i = 0; i < boneLinks.length; i++) {
        const lk = boneLinks[i];
        localPosOf(lk.a, vA);
        localPosOf(lk.b, vB);

        if (lk.isHelper) {
          writeSeg(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, 1.0, 0.70, 0.24);
        } else if (lk.isFinger) {
          writeSeg(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, 0.42, 1.0, 0.78);
        } else {
          // 3D Octahedral Bone Envelope!
          vDir.subVectors(vB, vA);
          const len = vDir.length();
          if (len < 1e-4) {
            for (let s = 0; s < 8; s++) writeSeg(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, 0.22, 0.92, 1.0);
          } else {
            vDir.divideScalar(len);
            vUp.set(Math.abs(vDir.z) > 0.9 ? 1 : 0, 0, Math.abs(vDir.z) > 0.9 ? 0 : 1);
            vN1.crossVectors(vDir, vUp).normalize();
            vN2.crossVectors(vDir, vN1).normalize();
            const rad = clamp(len * 0.13, 0.008, 0.024);
            vMid.copy(vA).lerp(vB, 0.26);
            pCorner[0].copy(vMid).addScaledVector(vN1, rad);
            pCorner[1].copy(vMid).addScaledVector(vN2, rad);
            pCorner[2].copy(vMid).addScaledVector(vN1, -rad);
            pCorner[3].copy(vMid).addScaledVector(vN2, -rad);
            for (let c = 0; c < 4; c++) {
              const p = pCorner[c];
              writeSeg(vA.x, vA.y, vA.z, p.x, p.y, p.z, 0.24, 0.94, 1.0);
              writeSeg(p.x, p.y, p.z, vB.x, vB.y, vB.z, 0.18, 0.80, 0.96);
            }
          }
        }
      }

      // Thoracic ribcage hoop, pelvic iliac hoop & dual radius-ulna forearm crossover lines!
      localPosOf(B.CHEST, vA);
      localPosOf(B.CLAV_L, pCorner[0]);
      localPosOf(B.CLAV_R, pCorner[1]);
      localPosOf(B.THORAX, vB);
      writeSeg(pCorner[0].x, pCorner[0].y, pCorner[0].z, pCorner[1].x, pCorner[1].y, pCorner[1].z, 0.20, 0.78, 0.92);
      writeSeg(vB.x - 0.11, vB.y, vB.z + 0.07, vB.x + 0.11, vB.y, vB.z + 0.07, 0.18, 0.68, 0.85);
      writeSeg(vB.x - 0.11, vB.y, vB.z - 0.07, vB.x + 0.11, vB.y, vB.z - 0.07, 0.18, 0.68, 0.85);
      writeSeg(vB.x - 0.11, vB.y, vB.z - 0.07, vB.x - 0.11, vB.y, vB.z + 0.07, 0.18, 0.68, 0.85);
      writeSeg(vB.x + 0.11, vB.y, vB.z - 0.07, vB.x + 0.11, vB.y, vB.z + 0.07, 0.18, 0.68, 0.85);

      localPosOf(B.ULEG_L, pCorner[0]);
      localPosOf(B.ULEG_R, pCorner[1]);
      localPosOf(B.LUMBAR, vMid);
      writeSeg(pCorner[0].x, pCorner[0].y, pCorner[0].z, pCorner[1].x, pCorner[1].y, pCorner[1].z, 0.24, 0.86, 0.96);
      writeSeg(pCorner[0].x, pCorner[0].y, pCorner[0].z, vMid.x, vMid.y, vMid.z, 0.20, 0.75, 0.90);
      writeSeg(pCorner[1].x, pCorner[1].y, pCorner[1].z, vMid.x, vMid.y, vMid.z, 0.20, 0.75, 0.90);

      // Radius-over-Ulna anatomical crossover rods on both forearms!
      for (const [bF, bH, s] of [[B.FARM_L, B.HAND_L, 1], [B.FARM_R, B.HAND_R, -1]]) {
        localPosOf(bF, vA);
        localPosOf(bH, vB);
        bones[bH].getWorldQuaternion(qIdent);
        vN1.set(0, 0, 0.015).applyQuaternion(qIdent); // Radial styloid offset (+Z of hand!)
        writeSeg(vA.x, vA.y, vA.z + 0.012, vB.x + vN1.x, vB.y + vN1.y, vB.z + vN1.z, 1.0, 0.78, 0.30);
        writeSeg(vA.x, vA.y, vA.z - 0.012, vB.x - vN1.x, vB.y - vN1.y, vB.z - vN1.z, 0.28, 0.88, 1.0);
      }

      // Live Crimson-Coral Muscle Lines!
      for (let m = 0; m < muscleLinks.length; m++) {
        localPosOf(muscleLinks[m][0], vA);
        localPosOf(muscleLinks[m][1], vB);
        writeSeg(vA.x, vA.y + 0.012, vA.z + 0.015, vB.x, vB.y, vB.z + 0.012, 1.0, 0.36, 0.28);
      }

      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.color.needsUpdate = true;

      qIdent.identity();
      for (let k = 0; k < jointIndices.length; k++) {
        const bi = jointIndices[k];
        localPosOf(bi, vA);
        const isF = bi >= B.L_THUMB_1 && bi <= B.R_PINKY_3;
        const rJ = isF ? 0.0042 : (!bones[bi].userData.isAnatomical ? 0.0095 : 0.0115);
        vSc.setScalar(rJ);
        mDummy.compose(vA, qIdent, vSc);
        jointInst.setMatrixAt(k, mDummy);
      }
      jointInst.instanceMatrix.needsUpdate = true;
    }

    function setVisible(flag) {
      enabled = Boolean(flag);
      lineMesh.visible = enabled;
      jointInst.visible = enabled;
      if (enabled) update();
    }

    return { setVisible, update, isEnabled: () => enabled };
  }

  function evalOrbitalSkinZ(px, py, spec = {}) {
    if (typeof window !== "undefined" && window.HumanPhysicalV6 && typeof window.HumanPhysicalV6.evalOrbitalSkinZ === "function") {
      return window.HumanPhysicalV6.evalOrbitalSkinZ(px, py, spec);
    }
    const noseLen = spec.noseLen || 1.0;
    const fem = spec.fem !== undefined ? spec.fem : 0.65;
    const ax = Math.abs(px);
    const rrW = 0.0740;
    const rrZ0 = lerp(-0.002, -0.004, smooth(1.602, 1.629, py));
    const rrF = lerp(0.084, 0.084, smooth(1.602, 1.629, py));
    let saA = clamp(ax / rrW, 0, 0.99);
    let caA = Math.sqrt(1 - saA * saA);
    const temple0 = g2(ax, py, 0.066, 1.628, 0.016, 0.022) * g1(caA, 0.25, 0.35);
    const malar0 = g2(ax, py, 0.052, 1.594, 0.020, 0.016) * smooth(-0.05, 0.72, caA);
    const alar0 = g2(ax, py, 0.0162, 1.579, 0.0095, 0.0085) * smooth(0.45, 0.96, caA);
    const effAx = Math.max(0, ax - (0.0052 * malar0 + 0.0038 * alar0 - 0.0042 * temple0));
    saA = clamp(effAx / rrW, 0, 0.992);
    caA = Math.sqrt(1 - saA * saA);

    let zS = rrZ0 + caA * rrF;
    const brow = g2(ax, py, 0.029, 1.635, 0.028, 0.0095) * smooth(0.28, 0.92, caA);
    const glabella = g1(ax, 0, 0.012) * g1(py, 1.632, 0.009) * smooth(0.65, 1.0, caA);
    const nasionNotch = g1(ax, 0, 0.014) * g1(py, 1.621, 0.007) * smooth(0.60, 1.0, caA);
    const bridge = g1(ax, 0, 0.0125) * g1(py, 1.602, 0.019) * smooth(0.55, 0.98, caA);
    const noseTip = g1(ax, 0, 0.0148) * g1(py, 1.583, 0.0145) * smooth(0.62, 1.0, caA);
    const malar = g2(ax, py, 0.052, 1.594, 0.020, 0.016) * smooth(-0.05, 0.72, caA);
    const latOrbitalWrap = g2(ax, py, 0.0422, 1.616, 0.0062, 0.0085) * smooth(0.25, 0.85, caA);
    const tearTrough = g2(ax, py, 0.029, 1.603, 0.013, 0.0035) * smooth(0.35, 0.90, caA);
    zS += (0.0078 * brow + 0.0045 * glabella) * lerp(1.15, 0.88, fem);
    zS += (-0.0032 * nasionNotch + 0.0112 * bridge + 0.0168 * noseTip) * noseLen;
    zS += 0.0055 * malar + 0.0034 * latOrbitalWrap - 0.0012 * tearTrough;
    return zS;
  }

  function registerCharacterInstance(ch) {
    activeCharactersSet.add(ch);
    if (globalDebugSkeleton && ch.setDebugSkeleton) {
      ch.setDebugSkeleton(true);
    }
    let scionEyes = (ch.userData && ch.userData.scionEyes) || null;
    let scionLids = (ch.userData && ch.userData.scionLids) || null;
    if ((!scionEyes || !scionLids) && ch.group && ch.group.traverse) {
      ch.group.traverse(obj => {
        if (obj.userData) {
          if (!scionEyes && obj.userData.scionEyes) scionEyes = obj.userData.scionEyes;
          if (!scionLids && obj.userData.scionLids) scionLids = obj.userData.scionLids;
        }
      });
    }
    if (scionEyes) {
      ch.scionEyes = scionEyes;
      if (ch.userData) ch.userData.scionEyes = scionEyes;
    }
    if (scionLids) {
      ch.scionLids = scionLids;
      if (ch.userData) ch.userData.scionLids = scionLids;
    }
    // Automatically upgrade character skin, eyelids & hands to HumanPhysicalV6 MeshPhysicalMaterial!
    const T_Ref = (typeof window !== "undefined" && window.THREE) || null;
    if (typeof window !== "undefined" && window.HumanPhysicalV6 && T_Ref) {
      window.HumanPhysicalV6.upgradeCharacterSkinMeshes(T_Ref, ch);
    }
    // Ensure 3D Sculpted Maxillary/Mandibular Dental Arches & Articulated Tongue are present even when ScionGroomGarments replaces buildVolumetricHairAssembly!
    if (T_Ref && ch.group && ch.group.traverse) {
      let hasOral = false;
      let refSkinned = null;
      ch.group.traverse(obj => {
        if (obj.geometry && obj.geometry.attributes && obj.geometry.attributes.aOralMeta) hasOral = true;
        if (!refSkinned && obj.isSkinnedMesh && obj.skeleton && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.aFaceMeta) {
          refSkinned = obj;
        }
      });
      if (!hasOral && refSkinned && refSkinned.parent) {
        const facsRef = (ch.v6Skin && ch.v6Skin.facsUniforms) || findCharacterFacsBundle(ch.group) || createSharedFacsUniformBundle(T_Ref);
        const oralGeo = buildOralDentitionAndTongueGeo(T_Ref);
        const oralMat = createOralDentitionMat(T_Ref, facsRef);
        const oralMesh = new T_Ref.SkinnedMesh(oralGeo, oralMat);
        oralMesh.name = "scionOralDentitionTongue";
        oralMesh.frustumCulled = false;
        oralMesh.castShadow = false;
        oralMesh.receiveShadow = false;
        oralMesh.bind(refSkinned.skeleton, refSkinned.bindMatrix);
        refSkinned.parent.add(oralMesh);
      }
    }
    // Automatically attach HumanExpressionsV4 controller if loaded on page!
    if (typeof window !== "undefined" && window.HumanExpressionsV4 && T_Ref) {
      window.HumanExpressionsV4.attachCharacterExpressionController(T_Ref, ch, {
        scionEyes,
        scionLids
      });
    }
  }

  function setGlobalDebugSkeleton(flag) {
    globalDebugSkeleton = Boolean(flag);
    for (const ch of activeCharactersSet) {
      if (ch && ch.setDebugSkeleton) ch.setDebugSkeleton(globalDebugSkeleton);
    }
  }

  if (typeof window !== "undefined") {
    window.HumanSculptV3 = {
      version: "5.0.0",
      B,
      FINGER_BIND_SPECS,
      THUMB_BIND_SPEC,
      createSkeleton56,
      getAssetsV3,
      selectPortraitArchetype,
      createSharedFacsUniformBundle,
      buildCranioMandibularHeadGeo,
      buildSculptedHumanEarsGeo,
      buildWetEyeAssembly,
      evalOrbitalSkinZ,
      applyDualPortraitSubsurfaceShader,
      buildOralDentitionAndTongueGeo,
      createOralDentitionMat,
      buildCharacterSkinnedHandsGeo,
      applyPhotographicHandShader,
      poseHandPhalanges,
      solveWristTwistAndElbowVolume,
      updateKneeVolumeHelper,
      buildVolumetricHairAssembly,
      createXRaySkeletonVisualizer,
      registerCharacterInstance,
      setGlobalDebugSkeleton,
      getActiveCharacters: () => activeCharactersSet
    };
  }
})();
