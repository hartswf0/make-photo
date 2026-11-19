/* ============================================================================
   SCION EYELIDS & PALPEBRAL CONTINUUM ENGINE (v5 Scion)
   Exposes window.ScionEyelids for donkey/human-sculpt-v3.js, donkey/characters.js,
   and donkey/expressions-v4.js.

   Replaces legacy 36-seg static collar + floating SphereGeometry uLid visor +
   black ribbon eyelash strips with:
   1. ONE watertight, high-density (72 circumferential x 14 radial rings per eye)
      spherical-wrap morphing palpebral eyelid, 1.6mm wet Meibomian waterline
      shelf, convex tarsal plate, 3D supratarsal crease groove, and orbital skin
      continuum matching evalOrbitalSkinZ(px, py) 1:1 at tv = 1.0 (zero portrait
      double-eyelid ghosting, zero outer-canthus staircase notches, zero gaps!).
   2. 38 upper + 20 lower individual root-to-tip tapered (0.14mm -> 0.015mm)
      curved 3D micro-lash hairs per eye driven by the exact same GPU spherical-
      wrap vertex shader at 60+ FPS.
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
  const frac = x => x - Math.floor(x);
  const hash = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const g1 = (x, c, w) => { const d = (x - c) / w; return Math.exp(-d * d); };
  const g2 = (x, y, cx, cy, wx, wy) => {
    const dx = (x - cx) / wx, dy = (y - cy) / (wy || wx);
    return Math.exp(-(dx * dx + dy * dy));
  };

  /* Exact Cutout & Surface Continuity Contract shared with human-sculpt-v3.js */
  const ORBIT_CUTOUT = {
    cx: 0.0300,
    cy: 1.6158,
    rx: 0.0215,
    ry: 0.0135,
    omitThreshold: 1.14,
    outerRx: 0.0242,
    outerRy: 0.0152
  };

  /* Aligned 1:1 with window.ScionEyeGlobe.EYE_SPEC */
  const DEFAULT_EYE_SPEC = {
    centerL: [ 0.0300, 1.6158, 0.0598],
    centerR: [-0.0300, 1.6158, 0.0598],
    radius: 0.0116,
    corneaRadius: 0.0057,
    corneaProtrusion: 0.0010,
    irisRadius: 0.00555,
    pupilRadius: 0.00195
  };

  /* 15 radial vertex stations (14 quad rings) from conjunctival fornix (iv=0)
     -> wet 1.6mm Meibomian waterline shelf (iv=1..3) -> convex tarsal plate (iv=4..7)
     -> 3D supratarsal crease sulcus (iv=8) -> preseptal fold (iv=9..10)
     -> outer orbital continuum skirt matching evalOrbitalSkinZ 1:1 (iv=11..14) */
  const N_CIRC = 72;
  const RING_TV = [
    0.000, // iv=0: Conjunctival fornix seal tucked behind globe waterline
    0.050, // iv=1: Posterior globe-kissing waterline margin (R_wrap)
    0.105, // iv=2: Mid wet Meibomian mucosal shelf
    0.160, // iv=3: Crisp anterior lash-line margin (+1.60mm radial shelf, lash roots!)
    0.240, // iv=4: Lower pretarsal plate
    0.330, // iv=5: Mid-lower tarsal plate
    0.420, // iv=6: Mid-upper tarsal plate
    0.510, // iv=7: Superior tarsal border
    0.580, // iv=8: Anatomical supratarsal eyelid crease groove (tucks inward!)
    0.650, // iv=9: Preseptal orbital fold overhang crest
    0.725, // iv=10: Preseptal orbital hood slope
    0.800, // iv=11: Outer orbital blend onset (portrait photo still ~0%)
    0.875, // iv=12: Mid outer orbital skirt
    0.945, // iv=13: Outer orbital rim feather
    1.000  // iv=14: Watertight outer rim (rx=0.0222, ry=0.0140) == evalOrbitalSkinZ!
  ];
  const RING_ZONE = [
    0.0, // iv=0: fornix tuck
    1.0, // iv=1: posterior waterline
    1.5, // iv=2: mid waterline
    2.0, // iv=3: anterior lash margin
    3.0, // iv=4: tarsal
    3.0, // iv=5: tarsal
    3.0, // iv=6: tarsal
    3.0, // iv=7: tarsal
    4.0, // iv=8: supratarsal crease
    5.0, // iv=9: preseptal fold
    5.0, // iv=10: preseptal slope
    6.0, // iv=11: outer orbital
    6.0, // iv=12: outer orbital
    6.0, // iv=13: outer orbital
    6.0  // iv=14: outer orbital rim
  ];
  const V_RINGS = RING_TV.length - 1; // 14 quad rings

  /* Standalone fallback orbital skin evaluator matching human-sculpt-v3.js periorbital rings
     if opts.evalOrbitalSkinZ is not supplied directly by buildWetEyeAssembly */
  function makeFallbackOrbitalEvaluators(spec = {}) {
    const fem = spec.fem !== undefined ? spec.fem : 0.65;
    const noseLen = spec.noseLen || 1.0;
    const periorbitalRings = [
      { y: 1.582, z0:  0.000,  w: 0.070, f: 0.0840, e: 1.03 },
      { y: 1.605, z0: -0.002,  w: 0.073, f: 0.0840, e: 1.01 },
      { y: 1.611, z0: -0.003,  w: 0.074, f: 0.0835, e: 1.00 },
      { y: 1.616, z0: -0.003,  w: 0.074, f: 0.0835, e: 1.00 },
      { y: 1.621, z0: -0.003,  w: 0.074, f: 0.0835, e: 1.00 },
      { y: 1.628, z0: -0.004,  w: 0.074, f: 0.0840, e: 1.00 },
      { y: 1.644, z0: -0.005,  w: 0.073, f: 0.0850, e: 1.00 }
    ];

    const sampleAtY = py => {
      let i = 0;
      while (i < periorbitalRings.length - 2 && periorbitalRings[i + 1].y <= py) i++;
      const r0 = periorbitalRings[i], r1 = periorbitalRings[i + 1];
      const t = clamp((py - r0.y) / Math.max(1e-6, r1.y - r0.y), 0, 1);
      return {
        z0: lerp(r0.z0, r1.z0, t),
        w: lerp(r0.w, r1.w, t),
        f: lerp(r0.f, r1.f, t),
        e: lerp(r0.e, r1.e, t)
      };
    };

    const evalOrbitalSkinZ = (px, py) => {
      const rr = sampleAtY(py);
      const ax = Math.abs(px);
      let saA = clamp(ax / Math.max(0.02, rr.w), 0, 0.99);
      let caA = Math.sqrt(1 - saA * saA);
      const temple0 = g2(ax, py, 0.066, 1.628, 0.016, 0.022) * g1(caA, 0.25, 0.35);
      const malar0 = g2(ax, py, 0.052, 1.594, 0.020, 0.016) * smooth(-0.05, 0.72, caA);
      const alar0 = g2(ax, py, 0.0162, 1.579, 0.0095, 0.0085) * smooth(0.45, 0.96, caA);
      const effAx = Math.max(0, ax - (0.0052 * malar0 + 0.0038 * alar0 - 0.0042 * temple0));
      saA = clamp(Math.pow(effAx / Math.max(0.02, rr.w), 1.0 / rr.e), 0, 0.992);
      caA = Math.sqrt(1 - saA * saA);

      let zS = rr.z0 + Math.pow(caA, rr.e) * rr.f;
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
    };

    const evalHeadPoreUV = (px, py, pz) => {
      const uH = (0.5 + Math.atan2(px, Math.max(0.015, pz)) / TAU) * 3.0;
      const vH = clamp((py - 1.380) / (1.732 - 1.380), 0, 1) * 3.0;
      return [uH, vH];
    };

    return { evalOrbitalSkinZ, evalHeadPoreUV };
  }

  /* ==========================================================================
     CPU Reference Palpebral Fissure & Tarsal Evaluator (for bind-pose geometry,
     lash root frames, and raycast/bounds accuracy — mirrored 1:1 in GLSL!)
     ========================================================================== */
  function evalMarginFissureJS(cth, sth) {
    // True upper-dominant human almond fissure (locked 1:1 to ScionEyeGlobe Pass 2 #157!):
    // Medial canthus (cth=-1): dx=-0.0106 (x=±0.0194), dy=-0.0010 (y=1.6148)
    // Lateral canthus (cth=+1): dx=+0.01158 (x=±0.04158, +0.78mm lateral seal for 90° profile!)
    const dx = 0.0001 + 0.0107 * cth + 0.00078 * smooth(0.58, 0.98, cth);
    const yCanthus = -0.0002 + 0.0008 * cth;
    const tearLake = Math.exp(-Math.pow((cth + 0.88) / 0.14, 2.0));

    let dyOpen;
    if (sth >= 0.0) {
      // High curved human upper arch (+0.00445m, peaking medial-of-center cth ~ -0.12)
      const sU = Math.pow(Math.max(0, sth), 1.04);
      const asymU = 1.0 - 0.12 * cth - 0.06 * cth * cth;
      dyOpen = yCanthus + 0.00445 * sU * asymU + 0.00032 * sth * tearLake;
    } else {
      // Shallower lower lid (-0.00400m, sweeping lateral-of-center cth ~ +0.16, kissing bottom iris rim with zero bag!)
      const sL = Math.pow(Math.max(0, -sth), 1.10);
      const asymL = 1.0 + 0.16 * cth - 0.05 * cth * cth;
      dyOpen = yCanthus - 0.00400 * sL * asymL - 0.00028 * (-sth) * tearLake;
    }

    // Gently curved sleeping crescent where upper & lower margins kiss cleanly at open == 0.0
    const archSpan = Math.pow(Math.max(0, 1.0 - cth * cth), 0.62);
    const dyClosed = yCanthus - 0.00315 * archSpan;

    return { dx, dyOpen, dyClosed, yCanthus };
  }

  function evalBindLidVertexJS(th, tv, zoneCode, side, eyeSpec, evalOrbitalSkinZ) {
    const cx = ORBIT_CUTOUT.cx;
    const cy = ORBIT_CUTOUT.cy;
    const cz = eyeSpec.centerL ? eyeSpec.centerL[2] : 0.0598;
    const rGlobe = eyeSpec.radius || 0.0116;

    const cth = Math.cos(th), sth = Math.sin(th);
    const fis = evalMarginFissureJS(cth, sth);

    const outDx = ORBIT_CUTOUT.outerRx * cth;
    const outDy = ORBIT_CUTOUT.outerRy * sth;

    // Radial progression in (dx, dy) from anterior lash line (tv=0.16) to outer rim (tv=1.00)
    const tOut = clamp((tv - 0.16) / 0.84, 0, 1);
    const radCurve = Math.pow(tOut, 0.94);

    let dx, dy;
    if (tv <= 0.16) {
      const shelfT = clamp((tv - 0.05) / 0.11, 0, 1);
      const bevelOut = 0.00010 * shelfT;
      dx = fis.dx + bevelOut * cth;
      dy = fis.dyOpen + bevelOut * sth;
    } else {
      dx = lerp(fis.dx + 0.00010 * cth, outDx, radCurve);
      dy = lerp(fis.dyOpen + 0.00010 * sth, outDy, radCurve);
      if (sth > 0.06) {
        const uShape = smooth(0.06, 0.36, sth) * (1.0 - 0.18 * cth * cth);
        const creasePinchY = 0.00045 * g1(tv, 0.58, 0.048) * uShape;
        const foldDrapeY = -0.00052 * g1(tv, 0.655, 0.052) * uShape;
        dy += creasePinchY + foldDrapeY;
      }
    }

    const px = side * (cx + dx);
    const py = cy + dy;

    const rXY2 = dx * dx + dy * dy;
    const rWrap = rGlobe + 0.00022;
    const dCornea = Math.hypot(dx, dy) / 0.0063;
    const cornealLift = 0.00118 * Math.pow(Math.max(0, 1.0 - dCornea * dCornea), 1.55);
    const zSpherePost = cz + Math.sqrt(Math.max(0.000004, rWrap * rWrap - Math.min(rWrap * rWrap - 0.000004, rXY2))) + cornealLift;

    const canthusTaper = 0.72 + 0.28 * Math.pow(Math.max(0, 1.0 - cth * cth), 0.45);
    const shelfThick = 0.00160 * canthusTaper;
    // 90° profile Whitnall's tubercle tuck at lateral commissure (cth > 0.58) so lateral corner hugs globe equator 100% flush!
    const latTubercleTuck = -0.00175 * smooth(0.58, 0.98, cth) * (1.0 - smooth(0.16, 0.38, tv));

    const zOrbital = evalOrbitalSkinZ(px, py);
    let pz;

    if (zoneCode < 0.5) {
      // iv=0: Conjunctival fornix tucked -1.35mm (-3.45mm at lateral equator) straight behind posterior waterline into sclera
      const latFornixExtra = 0.00210 * smooth(0.52, 0.98, cth);
      pz = zSpherePost - 0.00135 - latFornixExtra + latTubercleTuck;
    } else if (tv <= 0.16) {
      const shelfT = clamp((tv - 0.05) / 0.11, 0, 1);
      const shelfStep = Math.pow(shelfT, 0.86) * shelfThick;
      const latWaterlineSeal = -0.00095 * smooth(0.56, 0.98, cth) * (1.0 - shelfT);
      pz = zSpherePost + shelfStep + latTubercleTuck + latWaterlineSeal;
    } else {
      const rFissure2 = fis.dx * fis.dx + fis.dyOpen * fis.dyOpen;
      const rTarsal2 = Math.min(rXY2, Math.max(rFissure2, 0.0096 * 0.0096));
      const zSphereTarsal = cz + Math.sqrt(Math.max(0.000004, rWrap * rWrap - Math.min(rWrap * rWrap - 0.000004, rTarsal2))) + cornealLift;
      const tarsalConvex = shelfThick + 0.00024 * Math.sin(clamp((tv - 0.16) / 0.38, 0, 1) * Math.PI) + latTubercleTuck;
      const zTarsal = zSphereTarsal + tarsalConvex;
      const medFast = smooth(-0.55, -0.92, cth) * (1.0 - smooth(0.26, 0.58, sth));
      const wOrbEnd = lerp(0.74, 0.28, Math.max(cth * cth, medFast));
      const wOrb = smooth(0.17, wOrbEnd, tv);
      pz = lerp(zTarsal, zOrbital, wOrb);
      const medGuard = smooth(-0.62, -0.88, cth) * (1.0 - smooth(0.20, 0.50, sth)) * smooth(0.22, 0.38, tv);
      if (medGuard > 0.001 && zOrbital > zTarsal) {
        const zSafeMed = zOrbital - 0.00035 * (1.0 - smooth(0.24, 0.52, tv));
        pz = lerp(pz, Math.max(pz, zSafeMed), medGuard);
      }

      if (sth > 0.05) {
        const uShape = smooth(0.05, 0.36, sth) * (1.0 - 0.16 * cth * cth);
        const creaseGroove = -0.00120 * g1(tv, 0.58, 0.044) * uShape;
        const preseptalFold = +0.00062 * g1(tv, 0.655, 0.055) * uShape;
        pz += creaseGroove + preseptalFold;
      } else if (sth < -0.05) {
        const lShape = smooth(0.05, 0.38, -sth) * (1.0 - 0.22 * cth * cth);
        const pretarsalRoll = +0.00030 * g1(tv, 0.35, 0.11) * lShape;
        const infraGroove = -0.00012 * g1(tv, 0.66, 0.08) * lShape;
        pz += pretarsalRoll + infraGroove;
      }

      // Zero pre-normal torus bump -> 100% pure orbital normals (post-normal chord cushion applied after computeVertexNormals!)

      if (tv < 0.82 && rXY2 < 0.0124 * 0.0124) {
        const minSafeZ = cz + Math.sqrt(Math.max(1e-6, 0.01205 * 0.01205 - rXY2)) + cornealLift + 0.00055 * (1.0 - smooth(0.65, 0.82, tv));
        pz = Math.max(pz, minSafeZ);
      }
    }

    return { px, py, pz, dx, dy, zOrbital };
  }

  /* ==========================================================================
     1. Build 72 x 14 Watertight Palpebral Continuum Geometry (Both Eyes)
     ========================================================================== */
  function buildPalpebralContinuumGeo(T, spec, eyeSpec, evalOrbitalSkinZ, evalHeadPoreUV) {
    const pos = [];
    const uv = [];
    const col = [];
    const lidParam = [];
    const orbitalBind = [];
    const faceMeta = [];
    const idx = [];
    const seamPairs = [];

    const hairStyle = spec.hair || "croppedCoily";
    const hasWrapOrHat = hairStyle === "turban" || hairStyle === "shashWrap" || hairStyle === "feltHat" || hairStyle === "hood";
    const topFadeY = hasWrapOrHat ? 1.662 : 1.692;

    for (const side of [1, -1]) {
      const baseV = pos.length / 3;
      const rCols = N_CIRC + 1;

      for (let iv = 0; iv <= V_RINGS; iv++) {
        const tv = RING_TV[iv];
        const zoneCode = RING_ZONE[iv];
        const rowStart = baseV + iv * rCols;
        seamPairs.push([rowStart, rowStart + N_CIRC]);

        for (let iu = 0; iu <= N_CIRC; iu++) {
          // Keep th monotonic 0 -> TAU (never wrap iu=N_CIRC back to 0, which would interpolate th backward across lateral canthus!)
          const th = (iu / N_CIRC) * TAU;
          const vtx = evalBindLidVertexJS(th, tv, zoneCode, side, eyeSpec, evalOrbitalSkinZ);
          const { px, py, pz, zOrbital } = vtx;

          pos.push(px, py, pz);
          const [uP, vP] = evalHeadPoreUV(px, py, Math.max(0.03, zOrbital));
          uv.push(uP, vP);

          // Match headMesh ScionNeck.computeAnatomicalVertexAO & sssAmt 1:1 -> zero seam jump in both Daylight & Night Mode!
          const socketAO = g2(Math.abs(px), py, 0.0300, 1.6158, 0.019, 0.012);
          const baseL = 0.982 + 0.018 * smooth(1.36, 1.62, py) - 0.09 * socketAO;
          col.push(baseL, baseL, baseL);

          lidParam.push(th, tv, zoneCode, side);
          orbitalBind.push(px, py, zOrbital);

          // Reach full headMesh wFront / wSide weight by tv=0.84 so fragment smoothstep(0.68, 0.992, tvF) feathers 1:1 into headMesh!
          const azim = Math.abs(Math.atan2(px, pz + 0.012));
          const vertMask = 1.0 - smooth(topFadeY, topFadeY + 0.028, py);
          const lidPhotoFade = smooth(0.48, 0.72, tv) * vertMask;
          const wFront = (1.0 - smooth(0.38, 0.68, azim)) * lidPhotoFade;
          const wSide = smooth(0.38, 0.70, azim) * (1.0 - smooth(2.05, 2.50, azim)) * lidPhotoFade;
          const headSssAmt = clamp(0.40 + 0.55 * g1(py, 1.582, 0.038), 0, 1);
          const sssAmt = lerp(0.46, headSssAmt, smooth(0.45, 0.95, tv));
          faceMeta.push(wFront, wSide, 0.0, sssAmt);
        }
      }

      for (let iv = 0; iv < V_RINGS; iv++) {
        for (let iu = 0; iu < N_CIRC; iu++) {
          const A = baseV + iv * rCols + iu;
          const Bv = A + 1;
          const C = A + rCols;
          const D = C + 1;
          // Verified outward (+Z / lumen-facing) CCW winding for both Left (side=+1) & Right (side=-1) eyes!
          if (side > 0) idx.push(A, C, Bv, Bv, C, D);
          else idx.push(A, Bv, C, Bv, D, C);
        }
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setAttribute("aLidParam", new T.Float32BufferAttribute(lidParam, 4));
    g.setAttribute("aOrbitalBind", new T.Float32BufferAttribute(orbitalBind, 3));
    g.setAttribute("aFaceMeta", new T.Float32BufferAttribute(faceMeta, 4));
    g.setIndex(idx);
    g.computeVertexNormals();

    const N = g.attributes.normal;
    // 1. Weld circumferential seam normals at iu=0 / iu=72 (lateral canthus) cleanly
    for (let k = 0; k < seamPairs.length; k++) {
      const [c0, c1] = seamPairs[k];
      const nx = N.getX(c0) + N.getX(c1);
      const ny = N.getY(c0) + N.getY(c1);
      const nz = N.getZ(c0) + N.getZ(c1);
      const nl = Math.hypot(nx, ny, nz) || 1;
      N.setXYZ(c0, nx / nl, ny / nl, nz / nl);
      N.setXYZ(c1, nx / nl, ny / nl, nz / nl);
    }

    // 2. Smoothly blend outer orbital skirt normals (iv=9..14, tv=0.655..1.00) onto exact evalOrbitalSkinZ gradient -> ZERO doughnut lighting ring!
    const epsN = 0.0014;
    const rCols = N_CIRC + 1;
    const vertsPerEye = (V_RINGS + 1) * rCols;
    for (let eIdx = 0; eIdx < 2; eIdx++) {
      const baseV = eIdx * vertsPerEye;
      for (const [ivOut, wUp, wLow] of [[6, 0.0, 0.28], [7, 0.0, 0.52], [8, 0.12, 0.74], [9, 0.34, 0.88], [10, 0.62, 0.96], [11, 0.84, 1.00], [12, 0.96, 1.00], [13, 1.00, 1.00], [14, 1.00, 1.00]]) {
        const rowStart = baseV + ivOut * rCols;
        for (let iu = 0; iu <= N_CIRC; iu++) {
          const thU = (iu / N_CIRC) * TAU;
          const lowerW = 0.5 - 0.5 * Math.sin(thU);
          const wBlend = lerp(wUp, wLow, lowerW);
          const vi = rowStart + iu;
          const vx = pos[vi * 3], vy = pos[vi * 3 + 1];
          const dzdx = (evalOrbitalSkinZ(vx + epsN, vy) - evalOrbitalSkinZ(vx - epsN, vy)) / (2 * epsN);
          const dzdy = (evalOrbitalSkinZ(vx, vy + epsN) - evalOrbitalSkinZ(vx, vy - epsN)) / (2 * epsN);
          const gl = Math.hypot(-dzdx, -dzdy, 1.0) || 1.0;
          const gx = -dzdx / gl, gy = -dzdy / gl, gz = 1.0 / gl;
          const mx = lerp(N.getX(vi), gx, wBlend);
          const my = lerp(N.getY(vi), gy, wBlend);
          const mz = lerp(N.getZ(vi), gz, wBlend);
          const ml = Math.hypot(mx, my, mz) || 1.0;
          N.setXYZ(vi, mx / ml, my / ml, mz / nlOr(ml));
        }
      }
    }
    function nlOr(v) { return v || 1.0; }

    g.setAttribute("aBindNrm", new T.Float32BufferAttribute(Float32Array.from(N.array), 3));
    // 3. Apply +0.58mm naso-orbital chord clearance AFTER saving pure smooth normals (0.000mm at tv=1.00, ZERO normal ring!)
    const P = g.attributes.position;
    for (let eIdx = 0; eIdx < 2; eIdx++) {
      const baseV = eIdx * vertsPerEye;
      for (let iv = 8; iv <= V_RINGS; iv++) {
        const tv = RING_TV[iv];
        const chordZ = 0.00058 * Math.sin(smooth(0.68, 1.00, tv) * Math.PI);
        if (chordZ > 0) {
          const rowStart = baseV + iv * rCols;
          for (let iu = 0; iu <= N_CIRC; iu++) {
            const vi = rowStart + iu;
            P.setZ(vi, P.getZ(vi) + chordZ);
          }
        }
      }
    }
    g.boundingSphere = new T.Sphere(new T.Vector3(0, 1.616, 0.068), 0.16);
    return g;
  }

  /* ==========================================================================
     2. Build 38 Upper + 20 Lower Individual Tapered 3D Micro-Lash Hairs / Eye
        (0.14mm root -> 0.015mm tip curved 3-sided keratin micro-tubes, NEVER
        black polygon staple strips!)
     ========================================================================== */
  function buildIndividualMicroLashesGeo(T, spec, eyeSpec, evalOrbitalSkinZ) {
    const fem = spec.fem !== undefined ? spec.fem : 0.65;
    const lenScale = lerp(0.86, 1.02, fem);

    const pos = [];
    const nrm = [];
    const lashParam = []; // (th, side, isUpper, sAlong)
    const lashLocal = []; // local (dxChar, dyUp, dzFwd) offset from tv=0.16 root!
    const lashShade = []; // (rootToTipShade, hairSeed, 0, 0)
    const idx = [];

    const UPPER_COUNT = 38;
    const LOWER_COUNT = 20;
    const SEG_S = 4; // 4 axial segments (s = 0, 0.25, 0.50, 0.75 -> 1.0 apex tip)

    const appendLashHair = (side, thRoot, isUpper, lashLen, rRoot, rTip, splayX, rowJitterY, clumpTipX, seed) => {
      const bindRoot = evalBindLidVertexJS(thRoot, 0.160, 2.0, side, eyeSpec, evalOrbitalSkinZ);
      const baseId = pos.length / 3;

      // Trajectory in local lash frame (s in [0, 1]):
      // Upper lash: emerges forward & sweeps upward in a lush human J-curl (+0.72 * lashLen lift)!
      // Lower lash: emerges forward & downward (-26° -> -52° delicate C-curl)!
      const evalSpine = s => {
        const s2 = s * s;
        let lx, ly, lz;
        if (isUpper) {
          lx = splayX * lashLen * Math.pow(s, 1.16) + clumpTipX * s2;
          ly = rowJitterY + lashLen * (-0.12 * s + 0.46 * Math.pow(s, 1.75));
          lz = lashLen * (1.02 * s - 0.14 * s2);
        } else {
          lx = splayX * lashLen * Math.pow(s, 1.15) + clumpTipX * 0.65 * s2;
          ly = rowJitterY + lashLen * (-0.38 * s - 0.30 * Math.pow(s, 1.80));
          lz = lashLen * (0.84 * s - 0.15 * s2);
        }
        return [lx, ly, lz];
      };

      for (let is = 0; is < SEG_S; is++) {
        const s = is / SEG_S;
        const [cxL, cyL, czL] = evalSpine(s);
        const [nxL, nyL, nzL] = evalSpine(Math.min(1.0, s + 0.08));
        let tx = nxL - cxL, ty = nyL - cyL, tz = nzL - czL;
        const tl = Math.hypot(tx, ty, tz) || 1e-6;
        tx /= tl; ty /= tl; tz /= tl;

        // Orthonormal hair cross-section frame (B1 ~ X, B2 ~ T x B1)
        let b1x = 1.0 - tx * tx, b1y = -tx * ty, b1z = -tx * tz;
        const b1l = Math.hypot(b1x, b1y, b1z) || 1e-6;
        b1x /= b1l; b1y /= b1l; b1z /= b1l;
        const b2x = ty * b1z - tz * b1y;
        const b2y = tz * b1x - tx * b1z;
        const b2z = tx * b1y - ty * b1x;

        // Tapered radius: 2*rRoot = 0.14mm (rRoot=0.000070) -> 2*rTip = 0.015mm (rTip=0.0000075)
        const rad = lerp(rRoot, rTip, Math.pow(s, 0.82));

        for (let k = 0; k < 3; k++) {
          const ang = (k / 3) * TAU + 0.52;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const rnx = b1x * ca + b2x * sa;
          const rny = b1y * ca + b2y * sa;
          const rnz = b1z * ca + b2z * sa;

          const ox = cxL + rnx * rad;
          const oy = cyL + rny * rad;
          const oz = czL + rnz * rad;

          pos.push(bindRoot.px + ox, bindRoot.py + oy, bindRoot.pz + oz);
          nrm.push(rnx, rny, rnz);
          lashParam.push(thRoot, side, isUpper ? 1.0 : 0.0, s);
          lashLocal.push(ox, oy, oz);
          lashShade.push(s, seed);
        }
      }

      // Fine tapered 0.015mm tip vertex at s = 1.0
      const [tipX, tipY, tipZ] = evalSpine(1.0);
      const tipId = pos.length / 3;
      pos.push(bindRoot.px + tipX, bindRoot.py + tipY, bindRoot.pz + tipZ);
      nrm.push(0, isUpper ? 0.55 : -0.55, 0.83);
      lashParam.push(thRoot, side, isUpper ? 1.0 : 0.0, 1.0);
      lashLocal.push(tipX, tipY, tipZ);
      lashShade.push(1.0, seed);

      // Stitch 3-sided tube segments (CCW outward!)
      for (let is = 0; is < SEG_S - 1; is++) {
        const r0 = baseId + is * 3;
        const r1 = r0 + 3;
        for (let k = 0; k < 3; k++) {
          const k1 = (k + 1) % 3;
          const A = r0 + k, Bv = r0 + k1, C = r1 + k, D = r1 + k1;
          idx.push(A, Bv, C, Bv, D, C);
        }
      }
      const lastRing = baseId + (SEG_S - 1) * 3;
      for (let k = 0; k < 3; k++) {
        idx.push(lastRing + k, lastRing + ((k + 1) % 3), tipId);
      }
    };

    for (const side of [1, -1]) {
      // 38 Upper Individual Feathered Eyelashes per Eye (cth from -0.80 medial to +0.96 lateral)
      for (let i = 0; i < UPPER_COUNT; i++) {
        const u = i / (UPPER_COUNT - 1); // 0 = medial, 1 = lateral
        const uJit = clamp(u + (hash(i * 3.7 + side) - 0.5) * 0.012, 0.002, 0.998);
        const cth = lerp(-0.80, 0.965, uJit);
        const th = Math.acos(clamp(cth, -0.995, 0.995)); // in (0, PI) -> sth > 0!

        // Natural anatomical length envelope: delicate 2.3mm medial -> lush 5.8mm mid-lateral -> 4.1mm outer wing
        const archEnv = Math.sin(Math.pow(u, 0.78) * Math.PI * 0.92);
        const latPeak = 0.82 + 0.28 * g1(u, 0.66, 0.28);
        const lenVar = 0.88 + 0.24 * hash(i * 7.3 + 1.1);
        const lashLen = (0.0021 + 0.0038 * archEnv * latPeak) * lenScale * lenVar;

        // 0.14mm root diameter (r=0.070mm) -> 0.015mm tip diameter (r=0.0075mm)
        const rRoot = 0.000084 * (0.90 + 0.20 * archEnv);
        const rTip = 0.0000075;

        // Radial splay outward toward temple + subtle organic 2-3 hair tip micro-feathering
        const splayX = side * (0.30 * cth + 0.08 + (hash(i * 11.1) - 0.5) * 0.10);
        const rowJitterY = ((i % 2) - 0.5) * 0.00016;
        const clumpGroup = Math.floor(i / 2.5);
        const clumpCenterU = (clumpGroup * 2.5 + 1.0) / UPPER_COUNT;
        const clumpTipX = side * (clumpCenterU - u) * 0.0018;

        appendLashHair(side, th, true, lashLen, rRoot, rTip, splayX, rowJitterY, clumpTipX, hash(i * 5.9 + 0.3));
      }

      // 20 Lower Individual Delicate Micro-Lashes per Eye (softened length * 0.68, finer 0.08mm root, organic irregular spacing!)
      for (let i = 0; i < LOWER_COUNT; i++) {
        const u = i / (LOWER_COUNT - 1);
        const uJit = clamp(u + (hash(i * 4.3 + 9.0 + side) - 0.5) * 0.044, 0.008, 0.992);
        const cth = lerp(-0.70, 0.90, uJit);
        const th = TAU - Math.acos(clamp(cth, -0.995, 0.995)); // in (PI, TAU) -> sth < 0!

        const archEnv = Math.sin(Math.pow(u, 0.82) * Math.PI * 0.94);
        const lenVar = 0.78 + 0.38 * hash(i * 9.7 + 2.4);
        const lashLen = (0.00088 + 0.00112 * archEnv) * lenScale * lenVar;

        const rRoot = 0.000040 * (0.88 + 0.18 * archEnv);
        const rTip = 0.0000070;
        const splayX = side * (0.24 * cth + 0.03 + (hash(i * 13.7) - 0.5) * 0.18);
        const rowJitterY = ((i % 2) - 0.5) * 0.00009;
        const clumpGroupL = Math.floor(i / 2.0);
        const clumpCenterUL = (clumpGroupL * 2.0 + 0.5) / LOWER_COUNT;
        const clumpTipX = side * (clumpCenterUL - u) * 0.0011;

        appendLashHair(side, th, false, lashLen, rRoot, rTip, splayX, rowJitterY, clumpTipX, hash(i * 8.3 + 4.7));
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(nrm, 3));
    g.setAttribute("aLashParam", new T.Float32BufferAttribute(lashParam, 4));
    g.setAttribute("aLashLocal", new T.Float32BufferAttribute(lashLocal, 3));
    g.setAttribute("aLashShade", new T.Float32BufferAttribute(lashShade, 2));
    g.setIndex(idx);
    g.boundingSphere = new T.Sphere(new T.Vector3(0, 1.616, 0.072), 0.14);
    return g;
  }

  /* ==========================================================================
     3. Shared GPU GLSL Spherical-Wrap Palpebral Rig + Outer FACS Helpers
     ========================================================================== */
  const GLSL_SCION_LID_COMMON =
    "float scionG1(float x, float c, float w) { float d = (x - c) / w; return exp(-d * d); }\n" +
    "float scionG2(float x, float y, float cx, float cy, float wx, float wy) { float dx = (x - cx) / wx; float dy = (y - cy) / wy; return exp(-(dx * dx + dy * dy)); }\n" +
    "// Exact outer-orbital FACS continuity matching human-sculpt-v3.js evalHumanFacsDisp at tv = 1.0!\n" +
    "vec3 evalOuterOrbitalFacs(vec3 bp, vec4 uA, vec4 uB, vec4 uC) {\n" +
    "  float smile = uA.x, sad = uA.y;\n" +
    "  float browIn = uB.x, browOut = uB.y, furrow = uB.z;\n" +
    "  float noseWr = uC.z;\n" +
    "  float ax = abs(bp.x);\n" +
    "  float sx = clamp(bp.x / 0.008, -1.0, 1.0);\n" +
    "  float fwd = smoothstep(-0.005, 0.052, bp.z);\n" +
    "  vec3 d = vec3(0.0);\n" +
    "  float wCheek = scionG2(ax, bp.y, 0.0440, 1.5880, 0.0230, 0.0190) * fwd;\n" +
    "  d.y += 0.0032 * smile * wCheek;\n" +
    "  d.z += 0.0024 * smile * wCheek;\n" +
    "  d.x += sx * 0.0015 * smile * wCheek;\n" +
    "  float wAlar = scionG2(ax, bp.y, 0.0165, 1.578, 0.011, 0.009) * fwd;\n" +
    "  d.x += sx * 0.0022 * noseWr * wAlar;\n" +
    "  d.y += 0.0022 * noseWr * wAlar;\n" +
    "  float wBrowIn  = scionG2(ax, bp.y, 0.0130, 1.636, 0.0175, 0.0165) * fwd;\n" +
    "  float wBrowOut = scionG2(ax, bp.y, 0.0370, 1.638, 0.0185, 0.0155) * fwd;\n" +
    "  float wFurrow  = scionG2(ax, bp.y, 0.0175, 1.635, 0.0220, 0.0140) * fwd;\n" +
    "  d.y += 0.0096 * browIn * wBrowIn + (0.0060 * browOut - 0.0026 * sad) * wBrowOut - 0.0044 * furrow * wFurrow;\n" +
    "  d.x -= sx * (0.0032 * furrow * wFurrow + 0.0022 * browIn * sad * wBrowIn);\n" +
    "  d.z += (0.0012 * (browIn + browOut) * max(wBrowIn, wBrowOut) + 0.0015 * furrow * wFurrow);\n" +
    "  float wGlabCrease = scionG2(ax, bp.y, 0.0062, 1.635, 0.0026, 0.010) * fwd;\n" +
    "  d.z -= 0.0016 * furrow * wGlabCrease;\n" +
    "  return d;\n" +
    "}\n" +
    "// Live dynamic corneal dome bulge tracking eyeball gaze (gazeX, gazeY)\n" +
    "float evalLiveCornealLift(float dx, float dy, float side, float gazeX, float gazeY) {\n" +
    "  float cDx = side * sin(gazeX) * cos(gazeY) * 0.0116;\n" +
    "  float cDy = sin(gazeY) * 0.0116;\n" +
    "  float dC = length(vec2(dx - cDx, dy - cDy)) / 0.0063;\n" +
    "  return 0.00118 * pow(max(0.0, 1.0 - dC * dC), 1.55);\n" +
    "}\n" +
    "// Exact spherical-wrap palpebral fissure state at angle th & side (±1)\n" +
    "void evalPalpebralFissureState(\n" +
    "  float th, float side, vec4 rigA, vec4 rigB, vec4 rigC,\n" +
    "  out float dxBase, out float dyBindOpen, out float dyLive, out float effOpen\n" +
    ") {\n" +
    "  float cth = cos(th), sth = sin(th);\n" +
    "  float openRaw = side > 0.0 ? rigA.x : rigA.y;\n" +
    "  float squint  = side > 0.0 ? rigA.z : rigA.w;\n" +
    "  float gazeX   = rigB.x, gazeY = rigB.y;\n" +
    "  float wide    = rigB.z, duch  = rigB.w;\n" +
    "  float browIn  = rigC.x, furrow = rigC.z;\n" +
    "  effOpen = clamp(openRaw + 0.28 * wide - 0.14 * squint, 0.0, 1.42);\n" +
    "  float close01 = clamp(1.0 - effOpen, 0.0, 1.0);\n" +
    "  float wideExtra = max(0.0, effOpen - 1.0);\n" +
    "\n" +
    "  dxBase = 0.0001 + 0.0107 * cth + 0.00078 * smoothstep(0.58, 0.98, cth);\n" +
    "  float yCanthus = -0.0002 + 0.0008 * cth;\n" +
    "  float tearLake = exp(-pow((cth + 0.88) / 0.14, 2.0));\n" +
    "  float archSpan = pow(max(0.0, 1.0 - cth * cth), 0.62);\n" +
    "  float mobileEnv = pow(max(0.0, 1.0 - cth * cth), 0.55);\n" +
    "\n" +
    "  // Closed-eye crescent (locked 1:1 to ScionEyeGlobe Pass 2 #157!)\n" +
    "  float dyClosed = yCanthus - (0.00315 - 0.00105 * clamp(duch, 0.0, 1.1)) * archSpan;\n" +
    "  // +32% vertical corneal gaze-follow when open\n" +
    "  float gazeTrackY = 0.0037 * sin(clamp(gazeY, -0.45, 0.45)) * mobileEnv * clamp(effOpen, 0.0, 1.0);\n" +
    "\n" +
    "  if (sth >= 0.0) {\n" +
    "    float sU = pow(max(0.0, sth), 1.04);\n" +
    "    float asymU = 1.0 - 0.12 * cth - 0.06 * cth * cth;\n" +
    "    dyBindOpen = yCanthus + 0.00445 * sU * asymU + 0.00032 * sth * tearLake;\n" +
    "    // Curved medial-central oblique grief arch (AU1+4 peaking at cth ~ -0.25) -> soulful & deeply human, zero flat drugged droop!\n" +
    "    float griefArch = 0.00105 * browIn * (1.0 - 0.35 * furrow) * sU * exp(-pow((cth + 0.25) / 0.52, 2.0));\n" +
    "    float wideLift  = 0.0048 * wideExtra * sU * asymU;\n" +
    "    float dyTargetOpen = dyBindOpen + wideLift + griefArch + gazeTrackY;\n" +
    "    dyLive = mix(dyTargetOpen, dyClosed, close01);\n" +
    "  } else {\n" +
    "    float sL = pow(max(0.0, -sth), 1.10);\n" +
    "    float asymL = 1.0 + 0.16 * cth - 0.05 * cth * cth;\n" +
    "    dyBindOpen = yCanthus - 0.00400 * sL * asymL - 0.00028 * (-sth) * tearLake;\n" +
    "    // Genuine +1.8mm Duchenne lower-lid rise over lower iris on smile/laugh/squint!\n" +
    "    float duchRise = 0.00180 * clamp(duch, 0.0, 1.15) * sL * (0.88 + 0.20 * cth);\n" +
    "    float wideDrop = -0.0012 * wideExtra * sL;\n" +
    "    float dyTargetOpen = min(yCanthus - 0.0007 * sL, dyBindOpen + duchRise + wideDrop + gazeTrackY * 0.78);\n" +
    "    dyLive = mix(dyTargetOpen, dyClosed, close01);\n" +
    "  }\n" +
    "}\n";

  /* ==========================================================================
     4. Create Palpebral Continuum Material + Individual Micro-Lash Material
     ========================================================================== */
  function createPalpebralMaterial(T, cfg) {
    const portrait = cfg.portrait;
    const facsBundle = cfg.facsUniforms;
    const cyanGlow = cfg.cyanGlowUniform;
    const rigUniforms = cfg.rigUniforms;

    const skinBase = new T.Color(cfg.skinHex !== undefined ? cfg.skinHex : 0x5c4030);
    skinBase.offsetHSL(0, -0.03, 0.04);

    const mat = new T.MeshStandardMaterial({
      color: skinBase,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.0,
      envMapIntensity: 0.30,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });

    const uFaceCfg = {
      value: new T.Vector4(0.87, 0.36, cfg.beardKeep ? 1.0 : 0.0, 0.0)
    };

    mat.onBeforeCompile = sh => {
      sh.uniforms.tHeadFront = { value: portrait ? portrait.front : null };
      sh.uniforms.tHeadSide = { value: portrait ? portrait.side : null };
      sh.uniforms.uHeadFrontU = { value: portrait ? portrait.frontU : new T.Vector4(1, 0, 0, 0.5) };
      sh.uniforms.uHeadFrontV = { value: portrait ? portrait.frontV : new T.Vector4(0, 1, 0, 0.5) };
      sh.uniforms.uHeadSideU = { value: portrait ? portrait.sideU : new T.Vector4(0, 0, 1, 0.5) };
      sh.uniforms.uHeadSideV = { value: portrait ? portrait.sideV : new T.Vector4(0, 1, 0, 0.5) };
      sh.uniforms.uSideLumScale = (portrait && portrait.sideLumScale) || { value: 1.0 };
      sh.uniforms.uCheekSkinLin = cfg.cheekSkinUniform;
      sh.uniforms.uHeadCheekLin = cfg.headCheekUniform || cfg.cheekSkinUniform;
      sh.uniforms.uFaceCfg = uFaceCfg;
      sh.uniforms.uCyanGlow = cyanGlow;
      sh.uniforms.uFacsA = facsBundle.uFacsA;
      sh.uniforms.uFacsB = facsBundle.uFacsB;
      sh.uniforms.uFacsC = facsBundle.uFacsC;
      sh.uniforms.uFacsD = facsBundle.uFacsD;
      sh.uniforms.uLidRigA = rigUniforms.uLidRigA;
      sh.uniforms.uLidRigB = rigUniforms.uLidRigB;
      sh.uniforms.uLidRigC = rigUniforms.uLidRigC;

      sh.vertexShader =
        "attribute vec4 aLidParam;\n" +
        "attribute vec3 aOrbitalBind;\n" +
        "attribute vec4 aFaceMeta;\n" +
        "attribute vec3 aBindNrm;\n" +
        "uniform vec4 uFacsA, uFacsB, uFacsC, uFacsD;\n" +
        "uniform vec4 uLidRigA, uLidRigB, uLidRigC;\n" +
        "varying vec4 vLidParam;\n" +
        "varying vec4 vFaceMeta;\n" +
        "varying vec3 vBindPos;\n" +
        "varying vec3 vBindNrm;\n" +
        "varying vec3 vVertShade;\n" +
        "varying float vEffOpen;\n" +
        GLSL_SCION_LID_COMMON +
        sh.vertexShader
          .replace(
            "#include <beginnormal_vertex>",
            "#include <beginnormal_vertex>\n" +
            "float thN = aLidParam.x, tvN = aLidParam.y, zoneN = aLidParam.z, sideN = aLidParam.w;\n" +
            "float dxBN, dyBON, dyLN, effOpN;\n" +
            "evalPalpebralFissureState(thN, sideN, uLidRigA, uLidRigB, uLidRigC, dxBN, dyBON, dyLN, effOpN);\n" +
            "if (tvN < 0.90) {\n" +
            "  float sthN = sin(thN), cthN = cos(thN);\n" +
            "  float followWN = tvN <= 0.16 ? 1.0 : (1.0 - smoothstep(0.16, 0.70, tvN));\n" +
            "  float dyCurN = (aOrbitalBind.y - 1.6158) + (dyLN - dyBON) * followWN;\n" +
            "  float dxCurN = sideN * aOrbitalBind.x - 0.0300;\n" +
            "  // Gentle anatomical tarsal convexity (never pointing steeply downward into floor shadow below lower lid!)\n" +
            "  float nySph = sthN >= 0.0 ? clamp(dyCurN * 42.0, -0.18, 0.42) : clamp(dyCurN * 18.0 + 0.10, -0.14, 0.22);\n" +
            "  float nxSph = sideN * clamp(dxCurN * 26.0, -0.28, 0.34);\n" +
            "  vec3 sphNrm = normalize(vec3(nxSph, nySph, 0.92));\n" +
            "  vec3 lidLiveNrm = sphNrm;\n" +
            "  if (zoneN < 1.8) {\n" +
            "    // Wet waterline shelf normal faces into palpebral lumen with rounded anterior bevel\n" +
            "    vec3 lumenN = normalize(vec3(-sideN * 0.12 * cthN, -(sthN >= 0.0 ? 1.0 : -1.0) * 0.82, 0.56));\n" +
            "    lidLiveNrm = normalize(mix(lumenN, sphNrm, smoothstep(0.08, 0.165, tvN)));\n" +
            "  } else if (sthN > 0.06 && tvN > 0.48 && tvN < 0.72) {\n" +
            "    // Dynamic 3D supratarsal crease & preseptal overhang normal modulation\n" +
            "    float crMod = clamp(effOpN, 0.15, 1.25) * smoothstep(0.06, 0.35, sthN);\n" +
            "    float tiltY = -0.32 * scionG1(tvN, 0.55, 0.035) * crMod + 0.28 * scionG1(tvN, 0.62, 0.038) * crMod;\n" +
            "    lidLiveNrm = normalize(sphNrm + vec3(0.0, tiltY, 0.0));\n" +
            "  }\n" +
            "  objectNormal = normalize(mix(lidLiveNrm, aBindNrm, smoothstep(0.32, 0.78, tvN)));\n" +
            "} else {\n" +
            "  objectNormal = aBindNrm;\n" +
            "}"
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\n" +
            "float th = aLidParam.x, tv = aLidParam.y, zoneCode = aLidParam.z, side = aLidParam.w;\n" +
            "float cth = cos(th), sth = sin(th);\n" +
            "float dxB, dyBindOpen, dyLive, effOpen;\n" +
            "evalPalpebralFissureState(th, side, uLidRigA, uLidRigB, uLidRigC, dxB, dyBindOpen, dyLive, effOpen);\n" +
            "\n" +
            "float cx = 0.0300, cy = 1.6158, cz = 0.0598;\n" +
            "float deltaMarginY = dyLive - dyBindOpen;\n" +
            "float followW = tv <= 0.16 ? 1.0 : pow(1.0 - smoothstep(0.16, 0.74, tv), 1.15);\n" +
            "\n" +
            "float bindDx = side * aOrbitalBind.x - cx;\n" +
            "float bindDy = aOrbitalBind.y - cy;\n" +
            "float dx = bindDx;\n" +
            "float dy = bindDy + deltaMarginY * followW;\n" +
            "\n" +
            "// Unfold supratarsal crease Y-pinch smoothly as upper lid closes (open: 1 -> 0)\n" +
            "if (sth > 0.06 && tv > 0.45 && tv < 0.75) {\n" +
            "  float uSh = smoothstep(0.06, 0.36, sth) * (1.0 - 0.18 * cth * cth);\n" +
            "  float unfold = 1.0 - clamp(effOpen, 0.0, 1.0);\n" +
            "  dy -= unfold * (0.00038 * scionG1(tv, 0.58, 0.048) - 0.00042 * scionG1(tv, 0.655, 0.052)) * uSh;\n" +
            "}\n" +
            "\n" +
            "float rXY2 = dx * dx + dy * dy;\n" +
            "float rWrap = 0.01182;\n" +
            "float cLift = evalLiveCornealLift(dx, dy, side, uLidRigB.x, uLidRigB.y);\n" +
            "float zSpherePost = cz + sqrt(max(0.000004, rWrap * rWrap - min(rWrap * rWrap - 0.000004, rXY2))) + cLift;\n" +
            "float canthusTaper = 0.72 + 0.28 * pow(max(0.0, 1.0 - cth * cth), 0.45);\n" +
            "float shelfThick = 0.00160 * canthusTaper;\n" +
            "float latTubercleTuck = -0.00175 * smoothstep(0.58, 0.98, cth) * (1.0 - smoothstep(0.16, 0.38, tv));\n" +
            "float zOrb = aOrbitalBind.z;\n" +
            "float pz;\n" +
            "\n" +
            "if (zoneCode < 0.5) {\n" +
            "  float close01 = clamp(1.0 - effOpen, 0.0, 1.0);\n" +
            "  float latFornixExtra = 0.00210 * smoothstep(0.52, 0.98, cth) * (1.0 - close01);\n" +
            "  pz = zSpherePost - mix(0.00135 + latFornixExtra, 0.00035, close01) + latTubercleTuck;\n" +
            "} else if (tv <= 0.16) {\n" +
            "  float close01S = clamp(1.0 - effOpen, 0.0, 1.0);\n" +
            "  float shelfT = clamp((tv - 0.05) / 0.11, 0.0, 1.0);\n" +
            "  float latWaterlineSeal = -0.00095 * smoothstep(0.56, 0.98, cth) * (1.0 - shelfT) * (1.0 - close01S);\n" +
            "  pz = zSpherePost + pow(shelfT, 0.86) * shelfThick + latTubercleTuck + latWaterlineSeal;\n" +
            "} else {\n" +
            "  float rFiss2 = dxB * dxB + dyLive * dyLive;\n" +
            "  float rTars2 = min(rXY2, max(rFiss2, 0.0096 * 0.0096));\n" +
            "  float zSphereTars = cz + sqrt(max(0.000004, rWrap * rWrap - min(rWrap * rWrap - 0.000004, rTars2))) + cLift;\n" +
            "  float tarsalConvex = shelfThick + 0.00024 * sin(clamp((tv - 0.16) / 0.38, 0.0, 1.0) * 3.14159265) + latTubercleTuck;\n" +
            "  float zTarsal = zSphereTars + tarsalConvex;\n" +
            "  float medFast = smoothstep(-0.55, -0.92, cth) * (1.0 - smoothstep(0.26, 0.58, sth));\n" +
            "  float wOrbEnd = mix(0.74, 0.28, max(cth * cth, medFast));\n" +
            "  float wOrb = smoothstep(0.17, wOrbEnd, tv);\n" +
            "  pz = mix(zTarsal, zOrb, wOrb);\n" +
            "  float medGuard = smoothstep(-0.62, -0.88, cth) * (1.0 - smoothstep(0.20, 0.50, sth)) * smoothstep(0.22, 0.38, tv);\n" +
            "  if (medGuard > 0.001 && zOrb > zTarsal) {\n" +
            "    float zSafeMed = zOrb - 0.00035 * (1.0 - smoothstep(0.24, 0.52, tv));\n" +
            "    pz = mix(pz, max(pz, zSafeMed), medGuard);\n" +
            "  }\n" +
            "  if (sth > 0.05) {\n" +
            "    float uShape = smoothstep(0.05, 0.36, sth) * (1.0 - 0.16 * cth * cth);\n" +
            "    float crScale = mix(0.18, 1.0, clamp(effOpen, 0.0, 1.0)) + 0.22 * max(0.0, effOpen - 1.0);\n" +
            "    pz += (-0.00120 * scionG1(tv, 0.58, 0.044) + 0.00062 * scionG1(tv, 0.655, 0.055)) * uShape * crScale;\n" +
            "  } else if (sth < -0.05) {\n" +
            "    float lShape = smoothstep(0.05, 0.38, -sth) * (1.0 - 0.22 * cth * cth);\n" +
            "    float duchPlump = 1.0 + 0.85 * clamp(uLidRigB.w, 0.0, 1.1);\n" +
            "    pz += (0.00030 * duchPlump * scionG1(tv, 0.35, 0.11) - 0.00012 * scionG1(tv, 0.66, 0.08)) * lShape;\n" +
            "  }\n" +
            "  // Matched 1:1 to post-normal CPU chordZ (+0.58mm naso-orbital saddle clearance -> 0.000mm at tv=1.00, ZERO normal ring)!\n" +
            "  pz += 0.00058 * sin(smoothstep(0.68, 1.00, tv) * 3.14159265);\n" +
            "  if (tv < 0.82 && rXY2 < 0.0124 * 0.0124) {\n" +
            "    float minSafeZ = cz + sqrt(max(1e-6, 0.01205 * 0.01205 - rXY2)) + cLift + 0.00055 * (1.0 - smoothstep(0.65, 0.82, tv));\n" +
            "    pz = max(pz, minSafeZ);\n" +
            "  }\n" +
            "}\n" +
            "\n" +
            "vec3 livePos = vec3(side * (cx + dx), cy + dy, pz);\n" +
            "// Add exact outer-orbital FACS displacement weighted to 1.0 at tv = 1.0 -> 0.000mm seam under all emotions!\n" +
            "vec3 outerFacs = evalOuterOrbitalFacs(aOrbitalBind, uFacsA, uFacsB, uFacsC);\n" +
            "transformed = livePos + outerFacs * smoothstep(0.28, 0.88, tv);\n" +
            "vLidParam = aLidParam;\n" +
            "vFaceMeta = aFaceMeta;\n" +
            "vBindPos = aOrbitalBind;\n" +
            "vBindNrm = aBindNrm;\n" +
            "vEffOpen = effOpen;\n" +
            "#ifdef USE_COLOR\n  vVertShade = color.rgb;\n#else\n  vVertShade = vec3(1.0);\n#endif"
          );

      sh.fragmentShader =
        "uniform sampler2D tHeadFront, tHeadSide;\n" +
        "uniform vec4 uHeadFrontU, uHeadFrontV, uHeadSideU, uHeadSideV;\n" +
        "uniform vec4 uFaceCfg;\n" +
        "uniform vec4 uCyanGlow;\n" +
        "uniform float uSideLumScale;\n" +
        "uniform vec3 uCheekSkinLin, uHeadCheekLin;\n" +
        "uniform vec4 uFacsA, uFacsB, uFacsC, uFacsD;\n" +
        "uniform vec4 uLidRigA, uLidRigB, uLidRigC;\n" +
        "varying vec4 vLidParam;\n" +
        "varying vec4 vFaceMeta;\n" +
        "varying vec3 vBindPos;\n" +
        "varying vec3 vBindNrm;\n" +
        "varying vec3 vVertShade;\n" +
        "varying float vEffOpen;\n" +
        "vec3 scionSampleLod(sampler2D tex, vec2 uv, float lod) {\n" +
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
            "float thF = vLidParam.x, tvF = vLidParam.y, sideF = vLidParam.w;\n" +
            "float cthF = cos(thF), sthF = sin(thF);\n" +
            "// Match human-sculpt-v3.js Unified Canonical Linear Skin Albedo 1:1 -> 0.000 dE at tv=1.00!\n" +
            "float cLumHead = max(0.008, dot(uHeadCheekLin, vec3(0.299, 0.587, 0.114)));\n" +
            "float dGrA = fract(sin(dot(floor(vBindPos.xy * 980.0 + vBindPos.z * 790.0), vec2(12.9898, 78.233))) * 43758.5453);\n" +
            "float dGrB = sin(vBindPos.x * 460.0 + sin(vBindPos.y * 520.0 + vBindPos.z * 380.0)) * 0.5 + 0.5;\n" +
            "float dGrain = 1.0 + ((dGrA - 0.5) * 0.042 + (dGrB - 0.5) * 0.028);\n" +
            "vec3 headBaseSkin = uHeadCheekLin * vVertShade * dGrain;\n" +
            "\n" +
            "// 1. C-Infinity Ink-Free Orbital Illumination Blend normalized to uHeadCheekLin (canonicalSkinLin)\n" +
            "vec4 hpMedF = vec4(sideF * 0.0095, 1.6140, 0.0755, 1.0);\n" +
            "vec4 hpLatF = vec4(sideF * 0.0535, 1.6130, 0.0565, 1.0);\n" +
            "vec4 hpLowF = vec4(sideF * 0.0325, 1.5935, 0.0735, 1.0);\n" +
            "vec4 hpTopF = vec4(sideF * 0.0280, 1.6375, 0.0705, 1.0);\n" +
            "vec2 uvMedF = clamp(vec2(dot(uHeadFrontU, hpMedF), dot(uHeadFrontV, hpMedF)), vec2(0.30, 0.30), vec2(0.70, 0.78));\n" +
            "vec2 uvLatF = clamp(vec2(dot(uHeadFrontU, hpLatF), dot(uHeadFrontV, hpLatF)), vec2(0.28, 0.30), vec2(0.72, 0.78));\n" +
            "vec2 uvLowF = clamp(vec2(dot(uHeadFrontU, hpLowF), dot(uHeadFrontV, hpLowF)), vec2(0.30, 0.30), vec2(0.70, 0.60));\n" +
            "vec2 uvTopF = clamp(vec2(dot(uHeadFrontU, hpTopF), dot(uHeadFrontV, hpTopF)), vec2(0.28, 0.52), vec2(0.72, 0.82));\n" +
            "vec3 sMedF = scionSampleLod(tHeadFront, uvMedF, 2.0);\n" +
            "vec3 sLatF = scionSampleLod(tHeadFront, uvLatF, 2.0);\n" +
            "vec3 sLowF = scionSampleLod(tHeadFront, uvLowF, 2.0);\n" +
            "vec3 sUpF  = max(scionSampleLod(tHeadFront, uvTopF, 2.0), sLowF * 0.56);\n" +
            "vec3 sRimF = mix(mix(sMedF, sLatF, 0.5 + 0.5 * cthF), mix(sLowF, sUpF, 0.5 + 0.5 * sthF), 0.48);\n" +
            "vec3 sBroadRimF = scionSampleLod(tHeadFront, clamp(uvLowF, vec2(0.38, 0.36), vec2(0.62, 0.68)), 3.6);\n" +
            "vec3 linRimF = pow(max(vec3(0.002), sRimF), vec3(2.2));\n" +
            "vec3 linBroadRimF = pow(max(vec3(0.004), sBroadRimF), vec3(2.2));\n" +
            "float rimLumN = dot(linRimF, vec3(0.299, 0.587, 0.114));\n" +
            "float broadRimLumN = max(0.012, dot(linBroadRimF, vec3(0.299, 0.587, 0.114)));\n" +
            "float rimNuance = clamp(rimLumN / broadRimLumN, 0.92, 1.08);\n" +
            "vec3 portraitBaseSkin = uHeadCheekLin * vVertShade * mix(1.0, rimNuance, 0.35);\n" +
            "\n" +
            "// 2. Delicate 1.6x Fine-Grain Human Eyelid Micro-Pores from clean shadow-free outer-malar 9mmx9mm square (LOD 0 vs LOD 1.5)\n" +
            "float innerMask = 1.0 - smoothstep(0.68, 0.96, tvF);\n" +
            "float triU = 1.0 - abs(fract((sideF * vBindPos.x - 0.0300) * 1.6 / 0.0180 + 0.5) * 2.0 - 1.0);\n" +
            "float triV = 1.0 - abs(fract((vBindPos.y - 1.6158) * 1.6 / 0.0180 + 0.5) * 2.0 - 1.0);\n" +
            "vec4 hpPore = vec4(\n" +
            "  sideF * mix(0.0365, 0.0455, triU),\n" +
            "  mix(1.5845, 1.5935, triV),\n" +
            "  0.0745,\n" +
            "  1.0\n" +
            ");\n" +
            "vec2 uvPore = clamp(vec2(dot(uHeadFrontU, hpPore), dot(uHeadFrontV, hpPore)), vec2(0.35, 0.38), vec2(0.65, 0.49));\n" +
            "vec3 sPoreHi = pow(max(vec3(0.001), texture2D(tHeadFront, uvPore).rgb), vec3(2.2));\n" +
            "vec3 sPoreLo = pow(max(vec3(0.001), scionSampleLod(tHeadFront, uvPore, 1.5)), vec3(2.2));\n" +
            "float lHi = dot(sPoreHi, vec3(0.299, 0.587, 0.114));\n" +
            "float lLo = max(0.008, dot(sPoreLo, vec3(0.299, 0.587, 0.114)));\n" +
            "float photoPoreRatio = clamp(lHi / lLo, 0.955, 1.045);\n" +
            "float poreMod = mix(1.0, photoPoreRatio, innerMask * 0.92);\n" +
            "float vPoreLocal = (photoPoreRatio - 1.0) * innerMask;\n" +
            "\n" +
            "// Natural concave periorbital socket depth across tv = 0.00..0.92\n" +
            "float socketHollow = pow(1.0 - smoothstep(0.22, 0.92, tvF), 1.10) * (0.55 + 0.45 * max(0.0, sthF));\n" +
            "float medHollow = smoothstep(-0.20, -0.88, cthF) * smoothstep(-0.05, 0.65, sthF) * (1.0 - smoothstep(0.45, 0.88, tvF));\n" +
            "vec3 orbitalGrad = mix(vec3(1.0), vec3(0.88, 0.85, 0.83), socketHollow) * (1.0 - 0.05 * medHollow);\n" +
            "vec3 lidSkin = portraitBaseSkin * poreMod * orbitalGrad;\n" +
            "\n" +
            "if (sthF > 0.0) {\n" +
            "  // Warm upper-tarsal vascular melanin richness (tv = 0.16..0.55)\n" +
            "  float tarsalMask = smoothstep(0.14, 0.22, tvF) * (1.0 - smoothstep(0.46, 0.58, tvF)) * sthF;\n" +
            "  lidSkin *= mix(vec3(1.0), vec3(0.96, 0.89, 0.85), tarsalMask * 0.45);\n" +
            "  // Anatomical Supratarsal Crease Fold AO Groove at tv ~ 0.58 (unfolds cleanly on closed blink!)\n" +
            "  float creaseShape = smoothstep(0.06, 0.36, sthF) * (1.0 - 0.18 * cthF * cthF);\n" +
            "  float foldFactor = mix(0.22, 1.0, clamp(vEffOpen, 0.0, 1.0)) + 0.20 * max(0.0, vEffOpen - 1.0);\n" +
            "  float creaseAO = exp(-pow((tvF - 0.580) / 0.036, 2.0)) * creaseShape * clamp(foldFactor, 0.20, 1.25);\n" +
            "  float foldHighlight = exp(-pow((tvF - 0.655) / 0.045, 2.0)) * creaseShape * 0.040;\n" +
            "  lidSkin = lidSkin * (1.0 - 0.30 * creaseAO) + lidSkin * foldHighlight;\n" +
            "} else {\n" +
            "  // Subtle lower pretarsal orbicularis warmth & smooth youthful malar blend\n" +
            "  float lMask = -sthF;\n" +
            "  float preRoll = exp(-pow((tvF - 0.34) / 0.12, 2.0)) * lMask;\n" +
            "  lidSkin *= mix(vec3(1.0), vec3(1.02, 0.985, 0.97), preRoll * 0.35);\n" +
            "}\n" +
            "\n" +
            "// Subtle lateral Duchenne laugh crow's-feet crinkle when smiling/laughing\n" +
            "if (cthF > 0.72 && uLidRigB.w > 0.15) {\n" +
            "  float crowEnv = smoothstep(0.72, 0.96, cthF) * smoothstep(0.28, 0.45, tvF) * (1.0 - smoothstep(0.82, 0.96, tvF));\n" +
            "  float crowWave = 0.5 + 0.5 * sin(thF * 38.0);\n" +
            "  lidSkin *= (1.0 - 0.11 * uLidRigB.w * crowEnv * crowWave);\n" +
            "}\n" +
            "\n" +
            "// Rich dark follicular lash-root tightline right at tv = 0.162\n" +
            "float lashSpan = smoothstep(-0.84, -0.60, cthF) * (1.0 - smoothstep(0.95, 0.995, cthF));\n" +
            "float tightStrength = sthF >= 0.0 ? (0.68 * smoothstep(0.0, 0.20, sthF)) : (0.16 * smoothstep(0.0, 0.25, -sthF));\n" +
            "float tightLine = exp(-pow((tvF - 0.162) / 0.021, 2.0)) * lashSpan * tightStrength;\n" +
            "lidSkin = mix(lidSkin, lidSkin * vec3(0.16, 0.11, 0.10), tightLine);\n" +
            "\n" +
            "// Glistening wet Meibomian pink-brown mucosal waterline shelf across tv = 0.00..0.14\n" +
            "if (tvF < 0.155) {\n" +
            "  float wetMask = 1.0 - smoothstep(0.115, 0.155, tvF);\n" +
            "  vec3 meibomian = mix(lidSkin * vec3(1.18, 0.64, 0.60), vec3(0.155, 0.048, 0.046), 0.36);\n" +
            "  float fornixAO = mix(0.48, 1.0, smoothstep(0.00, 0.052, tvF));\n" +
            "  lidSkin = mix(lidSkin, meibomian * fornixAO, wetMask * 0.86);\n" +
            "}\n" +
            "diffuseColor.rgb = lidSkin;\n" +
            "\n" +
            "// 3. Outer orbital rim (tv = 0.76..1.00): 100.0% bit-for-bit identical Two-Band Intrinsic formula to human-sculpt-v3.js!\n" +
            "float wFront = vFaceMeta.x;\n" +
            "float wSide = vFaceMeta.y;\n" +
            "if (wFront + wSide > 0.002) {\n" +
            "  vec4 hpF = vec4(vBindPos, 1.0);\n" +
            "  vec4 hpS = vec4(0.0, vBindPos.y, vBindPos.z, 1.0);\n" +
            "  vec2 uvF = clamp(vec2(dot(uHeadFrontU, hpF), dot(uHeadFrontV, hpF)), vec2(0.28, 0.165), vec2(0.72, 0.86));\n" +
            "  vec2 uvS = clamp(vec2(dot(uHeadSideU, hpS), dot(uHeadSideV, hpS)), vec2(0.20, 0.20), vec2(0.87, 0.88));\n" +
            "  vec3 sF = texture2D(tHeadFront, uvF).rgb;\n" +
            "  vec3 sS = texture2D(tHeadSide, uvS).rgb;\n" +
            "  float warmF = smoothstep(0.07, 0.19, (sF.r - sF.b) / max(0.05, sF.r));\n" +
            "  float warmS = smoothstep(0.08, 0.20, (sS.r - sS.b) / max(0.05, sS.r));\n" +
            "  float inCoreF = (1.0 - smoothstep(0.12, 0.17, abs(uvF.x - 0.5))) * smoothstep(0.22, 0.32, uvF.y) * (1.0 - smoothstep(0.64, 0.72, uvF.y));\n" +
            "  float notGreyF = smoothstep(0.030, 0.085, length(sF - vec3(0.2588)));\n" +
            "  float notClothF = 1.0 - smoothstep(0.46, 0.62, max(sF.r, max(sF.g, sF.b))) * (1.0 - warmF);\n" +
            "  float sideEyeMask = 1.0 - 0.94 * exp(-pow((uvS.x - 0.352) / 0.028, 2.0) - pow((uvS.y - 0.560) / 0.022, 2.0));\n" +
            "  float validF = max(warmF, inCoreF * notGreyF) * notClothF * smoothstep(0.168, 0.225, uvF.y);\n" +
            "  float validS = warmS * sideEyeMask;\n" +
            "  vec3 linF = pow(max(vec3(0.001), sF), vec3(2.2));\n" +
            "  vec3 linS = pow(max(vec3(0.001), sS), vec3(2.2)) * uSideLumScale;\n" +
            "  float wfE = wFront * validF;\n" +
            "  float wsE = wSide * validS;\n" +
            "  float wValidSum = wfE + wsE;\n" +
            "  if (wValidSum > 0.002) {\n" +
            "    vec3 pPhoto = (linF * wfE + linS * wsE) / wValidSum;\n" +
            "    vec2 uvLocF = clamp(uvF, vec2(0.32, 0.22), vec2(0.68, 0.78));\n" +
            "    vec2 uvLocS = clamp(uvS, vec2(0.28, 0.26), vec2(0.76, 0.78));\n" +
            "    vec3 locLinF = pow(max(vec3(0.002), scionSampleLod(tHeadFront, uvLocF, 2.2)), vec3(2.2));\n" +
            "    vec3 locLinS = pow(max(vec3(0.002), scionSampleLod(tHeadSide, uvLocS, 2.2)), vec3(2.2)) * uSideLumScale;\n" +
            "    vec3 pLoc = (locLinF * wfE + locLinS * wsE) / wValidSum;\n" +
            "    float minEnvY = uFaceCfg.z > 0.5 ? 0.44 : 0.28;\n" +
            "    vec2 uvEnvF = clamp(uvF, vec2(0.34, minEnvY), vec2(0.66, 0.74));\n" +
            "    vec3 eF0 = scionSampleLod(tHeadFront, uvEnvF, 3.6);\n" +
            "    vec3 eF1 = scionSampleLod(tHeadFront, clamp(uvEnvF + vec2( 0.030, 0.0), vec2(0.34, minEnvY), vec2(0.66, 0.74)), 3.6);\n" +
            "    vec3 eF2 = scionSampleLod(tHeadFront, clamp(uvEnvF + vec2(-0.030, 0.0), vec2(0.34, minEnvY), vec2(0.66, 0.74)), 3.6);\n" +
            "    vec3 eF3 = scionSampleLod(tHeadFront, clamp(uvEnvF + vec2(0.0,  0.030), vec2(0.34, minEnvY), vec2(0.66, 0.74)), 3.6);\n" +
            "    vec3 eF4 = scionSampleLod(tHeadFront, clamp(uvEnvF + vec2(0.0, -0.030), vec2(0.34, minEnvY), vec2(0.66, 0.74)), 3.6);\n" +
            "    vec3 envLinF = pow(max(vec3(0.004), (eF0 * 2.0 + eF1 + eF2 + eF3 + eF4) / 6.0), vec3(2.2));\n" +
            "    vec2 uvEnvS = clamp(vec2(uvS.x, max(minEnvY, uvS.y)), vec2(0.34, minEnvY), vec2(0.60, 0.72));\n" +
            "    vec3 envLinS = pow(max(vec3(0.004), scionSampleLod(tHeadSide, uvEnvS, 3.6)), vec3(2.2)) * uSideLumScale;\n" +
            "    vec3 pBroad = (envLinF * wfE + envLinS * wsE) / wValidSum;\n" +
            "    float pLum     = max(0.006, dot(pPhoto, vec3(0.299, 0.587, 0.114)));\n" +
            "    float locLum   = max(0.006, dot(pLoc,   vec3(0.299, 0.587, 0.114)));\n" +
            "    float broadLum = max(0.012, dot(pBroad, vec3(0.299, 0.587, 0.114)));\n" +
            "    float isDarkFeature = (1.0 - smoothstep(0.26, 0.48, locLum / broadLum)) * (1.0 - smoothstep(0.08, 0.22, (sF.r - sF.b) / max(0.05, sF.r)));\n" +
            "    float tZoneLid = (1.0 - smoothstep(0.017, 0.027, abs(vBindPos.x))) * smoothstep(1.542, 1.556, vBindPos.y) * step(0.035, vBindPos.z);\n" +
            "    float skinMed = mix(clamp(locLum / broadLum, 0.96, 1.04), clamp(locLum / broadLum, 0.76, 1.20), tZoneLid);\n" +
            "    float featMed = clamp(locLum / broadLum, 0.18, 1.24);\n" +
            "    float effMed  = mix(mix(1.0, skinMed, max(0.16, tZoneLid * 0.62)), featMed, isDarkFeature);\n" +
            "    float skinHi  = mix(clamp(pLum / locLum, 0.93, 1.07), clamp(pLum / locLum, 0.80, 1.18), tZoneLid);\n" +
            "    float featHi  = clamp(pLum / locLum, 0.24, 1.45);\n" +
            "    float effHi   = mix(mix(1.0, skinHi, max(0.66, tZoneLid * 0.88)), featHi, isDarkFeature);\n" +
            "    float skinScalarDetail = effMed * effHi;\n" +
            "    vec3 melAdapted = uHeadCheekLin * vVertShade * skinScalarDetail;\n" +
            "    // Deep-ink-only guard inside tv < 0.74 so tv = 0.74..1.00 feathers 100.0% cleanly into headMesh orbital socket (ZERO 0.50m halo)!\n" +
            "    melAdapted = mix(melAdapted, max(melAdapted, lidSkin * 0.55), 1.0 - smoothstep(0.56, 0.74, tvF));\n" +
            "    float effMix = clamp(wValidSum, 0.0, 1.0) * uFaceCfg.x;\n" +
            "    vec3 outerTarget = mix(headBaseSkin, melAdapted, effMix);\n" +
            "    diffuseColor.rgb = mix(lidSkin, outerTarget, smoothstep(0.58, 0.93, tvF));\n" +
            "  }\n" +
            "}\n" +
            "if (vBindPos.z > 0.04 && tvF > 0.75) {\n" +
            "  float axF = abs(vBindPos.x);\n" +
            "  float glabCrease = uFacsB.z * exp(-pow((axF - 0.0062) / 0.0022, 2.0)) * exp(-pow((vBindPos.y - 1.635) / 0.0095, 2.0));\n" +
            "  diffuseColor.rgb *= (1.0 - 0.22 * glabCrease * smoothstep(0.75, 0.95, tvF));\n" +
            "}"
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\n" +
            "if (vLidParam.y < 0.15) {\n" +
            "  // Glistening wet tear-film Meibomian waterline!\n" +
            "  roughnessFactor = mix(0.11, 0.66, smoothstep(0.10, 0.15, vLidParam.y));\n" +
            "} else {\n" +
            "  float tarsalSatin = (1.0 - smoothstep(0.20, 0.62, vLidParam.y)) * 0.06;\n" +
            "  float poreRough = (fract(sin(dot(floor(vBindPos.xy * 1350.0 + vBindPos.z * 920.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.028 - vPoreLocal * 0.12;\n" +
            "  roughnessFactor = clamp(roughnessFactor - tarsalSatin + poreRough, 0.64, 0.86);\n" +
            "}"
          )
          .replace(
            "#include <aomap_fragment>",
            "#include <aomap_fragment>\n" +
            "{\n" +
            "  float ndvLid = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);\n" +
            "  float lidSkinZone = smoothstep(0.16, 0.42, vLidParam.y);\n" +
            "  float sssLid = smoothstep(0.025, 0.30, 1.0 - ndvLid) * smoothstep(0.01, 0.14, ndvLid) * lidSkinZone;\n" +
            "  float grazeLid = smoothstep(0.45, 0.82, 1.0 - ndvLid) * smoothstep(0.01, 0.14, ndvLid) * lidSkinZone;\n" +
            "  float bDLid = max(0.006, dot(material.diffuseColor, vec3(0.2126, 0.7152, 0.0722)));\n" +
            "  float lDLid = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3(0.2126, 0.7152, 0.0722));\n" +
            "  float lEnvLid = clamp(lDLid / bDLid, 0.0, 2.6);\n" +
            "  reflectedLight.directDiffuse *= (1.0 + 0.34 * sssLid + 0.44 * grazeLid);\n" +
            "  reflectedLight.indirectDiffuse *= (1.0 + 0.14 * sssLid + 0.26 * grazeLid);\n" +
            "  reflectedLight.directSpecular += vec3(0.0108) * (sssLid + 0.48 * grazeLid) * lEnvLid;\n" +
            "}"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "vec3 Vdir = normalize(vViewPosition);\n" +
            "float ndv = abs(dot(normalize(vNormal), Vdir));\n" +
            "// Attenuate daylight warm rimSSS when Night Mode cyan uplight (uCyanGlow.w) is active -> ZERO orange goggles in Night Convoy!\n" +
            "float nightDamp = 1.0 - clamp(uCyanGlow.w * 0.95, 0.0, 0.88);\n" +
            "float rimSSS = pow(1.0 - ndv, 2.8) * vFaceMeta.w * uFaceCfg.y * nightDamp;\n" +
            "totalEmissiveRadiance += diffuseColor.rgb * vec3(1.08, 0.94, 0.88) * (rimSSS * 0.22);\n" +
            "if (uCyanGlow.w > 0.001) {\n" +
            "  vec3 toS = vBindPos - uCyanGlow.xyz;\n" +
            "  float d2 = dot(toS, toS) + 0.032;\n" +
            "  vec3 cyanNrm = normalize(mix(vec3(vBindNrm.x, clamp(vBindNrm.y, -0.26, 0.06), max(0.86, vBindNrm.z)), vBindNrm, smoothstep(0.55, 0.92, vLidParam.y)));\n" +
            "  float ndl = clamp(dot(cyanNrm, normalize(-toS)) * 0.65 + 0.35, 0.0, 1.0);\n" +
            "  vec2 dSock = vec2((abs(vBindPos.x) - 0.030) / 0.020, (vBindPos.y - 1.616) / 0.013);\n" +
            "  float sockRecess = 0.65 * exp(-dot(dSock, dSock));\n" +
            "  float eyeGuard = (1.0 - sockRecess) * (1.0 - 0.45 * smoothstep(1.635, 1.695, vBindPos.y));\n" +
            "  float att = uCyanGlow.w * eyeGuard * ndl / (1.0 + 15.0 * d2);\n" +
            "  totalEmissiveRadiance += vec3(0.14, 0.72, 0.96) * att * (0.36 + 0.64 * diffuseColor.rgb);\n" +
            "}"
          );
    };
    mat.customProgramCacheKey = () => "scionPalpebralContinuum_v52g";
    return mat;
  }

  function createMicroLashMaterial(T, cfg) {
    const cyanGlow = cfg.cyanGlowUniform;
    const rigUniforms = cfg.rigUniforms;

    const lashMat = new T.MeshStandardMaterial({
      color: 0x130e0c,
      roughness: 0.44,
      metalness: 0.02,
      envMapIntensity: 0.35
    });

    lashMat.onBeforeCompile = sh => {
      sh.uniforms.uLidRigA = rigUniforms.uLidRigA;
      sh.uniforms.uLidRigB = rigUniforms.uLidRigB;
      sh.uniforms.uLidRigC = rigUniforms.uLidRigC;
      sh.uniforms.uCyanGlow = cyanGlow;

      sh.vertexShader =
        "attribute vec4 aLashParam;\n" +
        "attribute vec3 aLashLocal;\n" +
        "attribute vec2 aLashShade;\n" +
        "uniform vec4 uLidRigA, uLidRigB, uLidRigC;\n" +
        "varying vec2 vLashShade;\n" +
        "varying vec3 vLashPos;\n" +
        GLSL_SCION_LID_COMMON +
        sh.vertexShader
          .replace(
            "#include <beginnormal_vertex>",
            "#include <beginnormal_vertex>\n" +
            "float thLN = aLashParam.x, sideLN = aLashParam.y, isUpLN = aLashParam.z;\n" +
            "float dxBLN, dyBOLN, dyLLN, effOpLN;\n" +
            "evalPalpebralFissureState(thLN, sideLN, uLidRigA, uLidRigB, uLidRigC, dxBLN, dyBOLN, dyLLN, effOpLN);\n" +
            "float pitchLN = isUpLN > 0.5\n" +
            "  ? (-1.24 * pow(clamp(1.0 - effOpLN, 0.0, 1.0), 0.74) + 0.34 * max(0.0, effOpLN - 1.0))\n" +
            "  : (-0.14 * clamp(1.0 - effOpLN, 0.0, 1.0) + 0.16 * clamp(uLidRigB.w, 0.0, 1.0));\n" +
            "float cpLN = cos(pitchLN), spLN = sin(pitchLN);\n" +
            "objectNormal = normalize(vec3(\n" +
            "  objectNormal.x,\n" +
            "  objectNormal.y * cpLN + objectNormal.z * spLN,\n" +
            "  -objectNormal.y * spLN + objectNormal.z * cpLN\n" +
            "));"
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\n" +
            "float thL = aLashParam.x, sideL = aLashParam.y, isUpL = aLashParam.z;\n" +
            "float cthL = cos(thL), sthL = sin(thL);\n" +
            "float dxBL, dyBOL, dyLL, effOpL;\n" +
            "evalPalpebralFissureState(thL, sideL, uLidRigA, uLidRigB, uLidRigC, dxBL, dyBOL, dyLL, effOpL);\n" +
            "\n" +
            "// Exact tv=0.16 anterior lash-line root matching createPalpebralMaterial 1:1 (0.000mm root lock!)\n" +
            "float dxRoot = dxBL + 0.00010 * cthL;\n" +
            "float dyRoot = dyLL + 0.00010 * sthL;\n" +
            "float rXY2L = dxRoot * dxRoot + dyRoot * dyRoot;\n" +
            "float rWrapL = 0.01182;\n" +
            "float cLiftL = evalLiveCornealLift(dxRoot, dyRoot, sideL, uLidRigB.x, uLidRigB.y);\n" +
            "float zSphereL = 0.0598 + sqrt(max(0.000004, rWrapL * rWrapL - min(rWrapL * rWrapL - 0.000004, rXY2L))) + cLiftL;\n" +
            "float canthusTaperL = 0.72 + 0.28 * pow(max(0.0, 1.0 - cthL * cthL), 0.45);\n" +
            "float latTuckL = -0.00175 * smoothstep(0.58, 0.98, cthL);\n" +
            "vec3 rootLive = vec3(sideL * (0.0300 + dxRoot), 1.6158 + dyRoot, zSphereL + 0.00160 * canthusTaperL + latTuckL);\n" +
            "\n" +
            "// Spherical-wrap lash rotation: sweeps downward (-71°) on blink & fans upward (+20°) on wide-eyed awe!\n" +
            "float pitchL = isUpL > 0.5\n" +
            "  ? (-1.24 * pow(clamp(1.0 - effOpL, 0.0, 1.0), 0.74) + 0.34 * max(0.0, effOpL - 1.0))\n" +
            "  : (-0.14 * clamp(1.0 - effOpL, 0.0, 1.0) + 0.16 * clamp(uLidRigB.w, 0.0, 1.0));\n" +
            "float cpL = cos(pitchL), spL = sin(pitchL);\n" +
            "vec3 rotOff = vec3(\n" +
            "  aLashLocal.x,\n" +
            "  aLashLocal.y * cpL + aLashLocal.z * spL,\n" +
            "  -aLashLocal.y * spL + aLashLocal.z * cpL\n" +
            ");\n" +
            "transformed = rootLive + rotOff;\n" +
            "vLashShade = aLashShade;\n" +
            "vLashPos = transformed;"
          );

      sh.fragmentShader =
        "uniform vec4 uCyanGlow;\n" +
        "varying vec2 vLashShade;\n" +
        "varying vec3 vLashPos;\n" +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "// Rich natural dark espresso-keratin root -> delicate warm-sepia 0.015mm tip\n" +
            "float sTip = vLashShade.x;\n" +
            "float hVar = 0.88 + 0.24 * vLashShade.y;\n" +
            "vec3 rootKeratin = vec3(0.0055, 0.0038, 0.0032);\n" +
            "vec3 tipKeratin  = vec3(0.0155, 0.0102, 0.0082);\n" +
            "diffuseColor.rgb = mix(rootKeratin, tipKeratin, smoothstep(0.25, 1.0, sTip)) * hVar;"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "if (uCyanGlow.w > 0.001) {\n" +
            "  vec3 toS = vLashPos - uCyanGlow.xyz;\n" +
            "  float d2 = dot(toS, toS) + 0.035;\n" +
            "  totalEmissiveRadiance += vec3(0.04, 0.18, 0.24) * (uCyanGlow.w * 0.22 / (1.0 + 16.0 * d2));\n" +
            "}"
          );
    };
    lashMat.customProgramCacheKey = () => "scionMicroLashes3D_v5";
    return lashMat;
  }

  /* Helper: discover portrait, facsUniforms, and cyanGlowUniform from headAnchor's character hierarchy if omitted */
  function discoverHeadContext(T, headAnchor, opts) {
    let portrait = opts.portrait || null;
    let facsUniforms = opts.facsUniforms || null;
    let cyanGlowUniform = opts.cyanGlowUniform || null;

    if ((!portrait || !facsUniforms) && headAnchor) {
      let root = headAnchor;
      while (root && root.parent && root.parent.type !== "Scene") {
        root = root.parent;
      }
      if (root && root.traverse) {
        root.traverse(obj => {
          const m = obj.material;
          if (m && m.userData) {
            if (!facsUniforms && m.userData.facsUniforms) facsUniforms = m.userData.facsUniforms;
            if (!portrait && m.userData.portrait) portrait = m.userData.portrait;
          }
        });
      }
    }

    if (!facsUniforms) {
      facsUniforms = {
        uFacsA: { value: new T.Vector4(0, 0, 0, 0) },
        uFacsB: { value: new T.Vector4(0, 0, 0, 0) },
        uFacsC: { value: new T.Vector4(0, 0, 0, 0) },
        uFacsD: { value: new T.Vector4(0, 0, 0, 0) }
      };
    }
    if (!cyanGlowUniform) {
      cyanGlowUniform = { value: new T.Vector4(0, 1.15, 0.26, 0) };
    }
    return { portrait, facsUniforms, cyanGlowUniform };
  }

  /* ==========================================================================
     5. Public Factory: ScionEyelids.createRig(THREE, opts)
     ========================================================================== */
  function createRig(T, opts = {}) {
    if (!T) throw new Error("ScionEyelids.createRig requires THREE");
    const headAnchor = opts.headAnchor || null;
    const spec = opts.spec || {};
    const eyeSpec = (typeof window !== "undefined" && window.ScionEyeGlobe && window.ScionEyeGlobe.EYE_SPEC)
      || opts.eyeSpec
      || DEFAULT_EYE_SPEC;

    const ctx = discoverHeadContext(T, headAnchor, opts);
    const fallbackEval = makeFallbackOrbitalEvaluators(spec);
    const evalOrbitalSkinZ = typeof opts.evalOrbitalSkinZ === "function" ? opts.evalOrbitalSkinZ : fallbackEval.evalOrbitalSkinZ;
    const evalHeadPoreUV = typeof opts.evalHeadPoreUV === "function" ? opts.evalHeadPoreUV : fallbackEval.evalHeadPoreUV;

    const canonPortraitUniform = ctx.portrait && (ctx.portrait.canonicalSkinLin || ctx.portrait.cheekSkinLin);
    const cheekSkinUniform = canonPortraitUniform
      ? { value: canonPortraitUniform.value.clone() }
      : { value: new T.Vector3(0.160, 0.062, 0.034) };

    const rigUniforms = {
      // uLidRigA: (openL, openR, squintL, squintR)
      uLidRigA: { value: new T.Vector4(1.0, 1.0, 0.0, 0.0) },
      // uLidRigB: (gazeX, gazeY, wideEyes, duchenne)
      uLidRigB: { value: new T.Vector4(0.0, 0.0, 0.0, 0.0) },
      // uLidRigC: (browInner, browOuter, browFurrow, 0)
      uLidRigC: { value: new T.Vector4(0.0, 0.0, 0.0, 0.0) }
    };

    const headCheekUniform = canonPortraitUniform || cheekSkinUniform;
    const lidGeo = buildPalpebralContinuumGeo(T, spec, eyeSpec, evalOrbitalSkinZ, evalHeadPoreUV);
    const lidMat = createPalpebralMaterial(T, {
      portrait: ctx.portrait,
      facsUniforms: ctx.facsUniforms,
      cyanGlowUniform: ctx.cyanGlowUniform,
      rigUniforms,
      cheekSkinUniform,
      headCheekUniform,
      skinHex: spec.skinHex,
      beardKeep: Boolean(spec.beard)
    });

    const lashGeo = buildIndividualMicroLashesGeo(T, spec, eyeSpec, evalOrbitalSkinZ);
    const lashMat = createMicroLashMaterial(T, {
      cyanGlowUniform: ctx.cyanGlowUniform,
      rigUniforms
    });

    const mesh = new T.Mesh(lidGeo, lidMat);
    mesh.name = "ScionPalpebralContinuum";
    mesh.castShadow = false;
    mesh.receiveShadow = true;

    const lashMesh = new T.Mesh(lashGeo, lashMat);
    lashMesh.name = "ScionMicroLashes3D";
    lashMesh.castShadow = false;
    lashMesh.receiveShadow = false;

    if (headAnchor) {
      headAnchor.add(mesh);
      headAnchor.add(lashMesh);
    }

    // Internal compositional state so characters.js (blink + saccade gaze) and
    // expressions-v4.js (emotion aperture + Duchenne + wideEyes + brows) compose cleanly!
    const state = {
      baseOpenL: 1.0,
      baseOpenR: 1.0,
      blinkCloseL: 0.0,
      blinkCloseR: 0.0,
      squintL: 0.0,
      squintR: 0.0,
      wideEyes: 0.0,
      duchenne: 0.0,
      charGazeX: 0.0,
      charGazeY: 0.0,
      gazeX: 0.0,
      gazeY: 0.0,
      browInner: 0.0,
      browOuter: 0.0,
      browFurrow: 0.0
    };

    function flushUniforms() {
      const openL = clamp(state.baseOpenL * (1.0 - state.blinkCloseL), 0.0, 1.42);
      const openR = clamp(state.baseOpenR * (1.0 - state.blinkCloseR), 0.0, 1.42);
      rigUniforms.uLidRigA.value.set(openL, openR, state.squintL, state.squintR);
      rigUniforms.uLidRigB.value.set(state.gazeX, state.gazeY, state.wideEyes, state.duchenne);
      rigUniforms.uLidRigC.value.set(state.browInner, state.browOuter, state.browFurrow, 0.0);
    }

    function syncSkinColor(linCol) {
      if (!linCol) return;
      const r = linCol.x !== undefined ? linCol.x : linCol.r;
      const g = linCol.y !== undefined ? linCol.y : linCol.g;
      const b = linCol.z !== undefined ? linCol.z : linCol.b;
      if (r !== undefined) {
        cheekSkinUniform.value.set(Math.max(0.001, r), Math.max(0.001, g), Math.max(0.001, b));
      }
    }

    if (opts.skinColorLin) {
      syncSkinColor(opts.skinColorLin);
    } else if (canonPortraitUniform) {
      syncSkinColor(canonPortraitUniform.value);
    }
    if (ctx.portrait && Array.isArray(ctx.portrait.lidListeners)) {
      ctx.portrait.lidListeners.push(syncSkinColor);
    }

    const rig = {
      mesh,
      lashMesh,
      uniforms: rigUniforms,
      uLidRig: rigUniforms,
      state,
      setBlink(blinkClose01, blinkCloseR) {
        const bL = clamp(blinkClose01 || 0, 0, 1);
        const bR = blinkCloseR !== undefined ? clamp(blinkCloseR, 0, 1) : bL;
        state.blinkCloseL = bL;
        state.blinkCloseR = bR;
        flushUniforms();
        return rig;
      },
      setGaze(yawRad, pitchRad) {
        const gx = clamp(yawRad || 0, -0.52, 0.52);
        const gy = clamp(pitchRad || 0, -0.45, 0.45);
        state.charGazeX = gx;
        state.charGazeY = gy;
        state.gazeX = gx;
        state.gazeY = gy;
        flushUniforms();
        return rig;
      },
      setState(patch = {}) {
        if (patch.open !== undefined) {
          state.baseOpenL = clamp(patch.open, 0, 1.42);
          state.baseOpenR = clamp(patch.open, 0, 1.42);
        }
        if (patch.openL !== undefined) state.baseOpenL = clamp(patch.openL, 0, 1.42);
        if (patch.openR !== undefined) state.baseOpenR = clamp(patch.openR, 0, 1.42);
        if (patch.blink !== undefined) {
          const b = clamp(patch.blink, 0, 1);
          state.blinkCloseL = b;
          state.blinkCloseR = b;
        }
        if (patch.blinkL !== undefined) state.blinkCloseL = clamp(patch.blinkL, 0, 1);
        if (patch.blinkR !== undefined) state.blinkCloseR = clamp(patch.blinkR, 0, 1);
        if (patch.squint !== undefined) {
          state.squintL = clamp(patch.squint, 0, 1.2);
          state.squintR = clamp(patch.squint, 0, 1.2);
        }
        if (patch.squintL !== undefined) state.squintL = clamp(patch.squintL, 0, 1.2);
        if (patch.squintR !== undefined) state.squintR = clamp(patch.squintR, 0, 1.2);
        if (patch.wideEyes !== undefined) state.wideEyes = clamp(patch.wideEyes, 0, 1.2);
        if (patch.duchenne !== undefined) state.duchenne = clamp(patch.duchenne, 0, 1.2);
        if (patch.gazeX !== undefined) state.gazeX = clamp(patch.gazeX, -0.52, 0.52);
        if (patch.gazeY !== undefined) state.gazeY = clamp(patch.gazeY, -0.45, 0.45);
        if (patch.browInner !== undefined) state.browInner = clamp(patch.browInner, 0, 1.2);
        if (patch.browOuter !== undefined) state.browOuter = clamp(patch.browOuter, 0, 1.2);
        if (patch.browFurrow !== undefined) state.browFurrow = clamp(patch.browFurrow, 0, 1.2);
        flushUniforms();
        return rig;
      },
      getEffectiveAperture() {
        const rawL = rigUniforms.uLidRigA.value.x;
        const rawR = rigUniforms.uLidRigA.value.y;
        const sqL = rigUniforms.uLidRigA.value.z;
        const sqR = rigUniforms.uLidRigA.value.w;
        const wide = rigUniforms.uLidRigB.value.z;
        const openL = clamp(rawL + 0.28 * wide - 0.14 * sqL, 0.0, 1.38);
        const openR = clamp(rawR + 0.28 * wide - 0.14 * sqR, 0.0, 1.38);
        return {
          openL,
          openR,
          squint: Math.max(sqL, sqR, state.duchenne * 0.85)
        };
      },
      setLod(lodDist) {
        lashMesh.visible = (lodDist || 0) < 16;
      },
      syncSkinColor
    };

    if (headAnchor) {
      headAnchor.userData = headAnchor.userData || {};
      headAnchor.userData.scionLids = rig;
    }
    return rig;
  }

  if (typeof window !== "undefined") {
    window.ScionEyelids = {
      version: "5.0.0",
      ORBIT_CUTOUT,
      EYE_SPEC: DEFAULT_EYE_SPEC,
      createRig,
      buildPalpebralContinuumGeo,
      buildIndividualMicroLashesGeo
    };
  }
})();
