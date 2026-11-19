/* ============================================================================
   SCION EYE GLOBE ENGINE (v5) — Physically Based Multi-Layer Human Ocular Apparatus
   Owns: window.ScionEyeGlobe (/donkey/scion-eye-globe.js)
   Layers:
     - Layer A: Clean Ivory-Porcelain Sclera (#f1ece3 linear) + Dark Limbal Ring +
                Concave Anterior-Chamber Dish (-0.9mm) Radial Iris Stroma +
                100% Velvet Jet-Black (#020202) Pupil + Live Head-Space Eyelid AO
     - Layer B: +1.0mm Convex Wet Refractive Cornea Dome (IOR 1.376, Clearcoat 1.0)
                with View-Consistent Primary Window Catchlight + Warm Fill Spark
                & Zero Diffuse Veil / Zero Bottom White Reflection Bar
     - Layer C: Medial Coral-Rose Lacrimal Caruncle + Plica Semilunaris +
                Hair-Thin (0.45mm) Concave Capillary Lower Tear-Line Meniscus
   ============================================================================ */
(function (root) {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  /* --------------------------------------------------------------------------
     1. CANONICAL ADULT HUMAN OPHTHALMIC SPECIFICATION (0.01mm Locked Contract)
     -------------------------------------------------------------------------- */
  const EYE_SPEC = Object.freeze({
    centerL: [ 0.0300, 1.6158, 0.0598],
    centerR: [-0.0300, 1.6158, 0.0598],
    radius: 0.0116,           // True 23.2mm adult human ocular globe
    corneaRadius: 0.0057,     // True 11.4mm human corneal/limbal diameter
    corneaProtrusion: 0.0010, // +1.0mm anterior corneal dome bulge over limbus
    irisRadius: 0.00555,      // 11.1mm human iris diameter -> crisp white sclera triangles at both canthi
    pupilRadius: 0.00195      // 3.9mm crisp jet-black pupil
  });

  const CONCAVE_IRIS_DEPTH = 0.00090; // -0.9mm inward anterior chamber iris dish

  /* Shared geometry cache keyed by THREE namespace to avoid duplicate GPU buffers */
  const geoCacheMap = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function getGeoCache(T) {
    if (!geoCacheMap) return {};
    let c = geoCacheMap.get(T);
    if (!c) {
      c = {};
      geoCacheMap.set(T, c);
    }
    return c;
  }

  /* --------------------------------------------------------------------------
     2. LAYER A GEOMETRY — Polar +Z Axisymmetric Sclera + -0.9mm Concave Iris Dish
     -------------------------------------------------------------------------- */
  function evalInnerGlobeZFromR(r) {
    const R = EYE_SPEC.radius;
    const rIris = EYE_SPEC.irisRadius;
    const zLimbus = Math.sqrt(R * R - rIris * rIris);
    const zSphere = Math.sqrt(Math.max(0, R * R - r * r));
    const u = r / rIris;
    const bowlShape = Math.pow(Math.max(0, 1.0 - u * u), 1.12);
    const zDish = zLimbus - CONCAVE_IRIS_DEPTH * bowlShape;
    const wSphere = smooth(0.89, 1.05, u);
    return lerp(zDish, zSphere, wSphere);
  }

  function buildInnerOcularGlobeGeo(T) {
    const cache = getGeoCache(T);
    if (cache.innerGlobeGeo) return cache.innerGlobeGeo;

    const R = EYE_SPEC.radius;
    // High radial density across pupil, collarette, concave iris dish & limbal ring;
    // clean spherical spacing across visible & peripheral sclera to posterior pole.
    const thetaStops = [
      0.000, 0.045, 0.090, 0.132, 0.168, 0.200, 0.235, 0.275,
      0.318, 0.360, 0.400, 0.436, 0.466, 0.490, 0.512, 0.536,
      0.568, 0.610, 0.665, 0.735, 0.820, 0.925, 1.050, 1.200,
      1.380, 1.580, 1.820, 2.120, 2.500, Math.PI
    ];

    const NSEGS = 48;
    const NRINGS = thetaStops.length;
    const cols = NSEGS + 1;
    const pos = [];
    const nrm = [];
    const uv = [];
    const idx = [];

    const eps = 0.00008;
    for (let i = 0; i < NRINGS; i++) {
      const th = thetaStops[i];
      const sinTh = Math.sin(th);
      const cosTh = Math.cos(th);
      const rPlanar = R * sinTh;
      const isAnteriorDish = th < 0.62;

      let pzRing, nRad, nZ;
      if (i === 0) {
        pzRing = evalInnerGlobeZFromR(0);
        nRad = 0;
        nZ = 1;
      } else if (isAnteriorDish) {
        pzRing = evalInnerGlobeZFromR(rPlanar);
        const rMinus = Math.max(0, rPlanar - eps);
        const rPlus = Math.min(R * 0.98, rPlanar + eps);
        const dzdr = (evalInnerGlobeZFromR(rPlus) - evalInnerGlobeZFromR(rMinus)) / Math.max(1e-7, rPlus - rMinus);
        // Surface z = f(r) -> outward normal proportional to (-dz/dr * cosPhi, -dz/dr * sinPhi, 1)
        const invL = 1.0 / Math.hypot(dzdr, 1.0);
        nRad = -dzdr * invL;
        nZ = invL;
      } else {
        pzRing = R * cosTh;
        nRad = sinTh;
        nZ = cosTh;
      }

      const vCoord = th / Math.PI;
      for (let j = 0; j <= NSEGS; j++) {
        const phi = (j === NSEGS ? 0 : j / NSEGS) * TAU;
        const cph = Math.cos(phi);
        const sph = Math.sin(phi);
        pos.push(rPlanar * cph, rPlanar * sph, pzRing);
        nrm.push(nRad * cph, nRad * sph, nZ);
        uv.push(j / NSEGS, vCoord);
      }
    }

    for (let i = 0; i < NRINGS - 1; i++) {
      for (let j = 0; j < NSEGS; j++) {
        const A = i * cols + j;
        const B = A + 1;
        const C = A + cols;
        const D = C + 1;
        // At i === 0, A and B coincide at +Z apex; skip degenerate first triangle
        if (i > 0) idx.push(A, C, B);
        if (i < NRINGS - 2) idx.push(B, C, D);
        else idx.push(B, C, D);
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(nrm, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.boundingSphere = new T.Sphere(new T.Vector3(0, 0, 0), R + 0.002);
    cache.innerGlobeGeo = g;
    return g;
  }

  /* --------------------------------------------------------------------------
     3. LAYER B GEOMETRY — +1.0mm Convex Wet Refractive Cornea Dome Cap
     -------------------------------------------------------------------------- */
  function evalCorneaDomeZFromR(r) {
    const R = EYE_SPEC.radius;
    const rCornea = EYE_SPEC.corneaRadius; // 0.0057m
    const zSphere = Math.sqrt(Math.max(0, R * R - r * r));
    const u = r / (rCornea * 1.03);
    const bulge = u < 1.0
      ? EYE_SPEC.corneaProtrusion * Math.pow(1.0 - u * u, 1.26)
      : 0.0;
    // +0.065mm perilimbal tear-film clearance over Layer A sclera
    return zSphere + 0.000065 + bulge;
  }

  function buildCorneaDomeGeo(T) {
    const cache = getGeoCache(T);
    if (cache.corneaDomeGeo) return cache.corneaDomeGeo;

    const NRINGS = 18;
    const NSEGS = 48;
    const cols = NSEGS + 1;
    const rMax = 0.00650; // Covers 5.70mm cornea + smooth 0.80mm perilimbal feather skirt
    const pos = [];
    const nrm = [];
    const uv = [];
    const idx = [];

    const eps = 0.00006;
    for (let i = 0; i <= NRINGS; i++) {
      const t = i / NRINGS;
      // Slightly denser near apex & limbus for razor-smooth specular reflections
      const r = rMax * (0.82 * t + 0.18 * t * t);
      const pz = evalCorneaDomeZFromR(r);

      let nRad = 0, nZ = 1;
      if (i > 0) {
        const r0 = Math.max(0, r - eps);
        const r1 = r + eps;
        const dzdr = (evalCorneaDomeZFromR(r1) - evalCorneaDomeZFromR(r0)) / (r1 - r0);
        const invL = 1.0 / Math.hypot(dzdr, 1.0);
        nRad = -dzdr * invL;
        nZ = invL;
      }

      for (let j = 0; j <= NSEGS; j++) {
        const phi = (j === NSEGS ? 0 : j / NSEGS) * TAU;
        const cph = Math.cos(phi);
        const sph = Math.sin(phi);
        pos.push(r * cph, r * sph, pz);
        nrm.push(nRad * cph, nRad * sph, nZ);
        uv.push(j / NSEGS, r / rMax);
      }
    }

    for (let i = 0; i < NRINGS; i++) {
      for (let j = 0; j < NSEGS; j++) {
        const A = i * cols + j;
        const B = A + 1;
        const C = A + cols;
        const D = C + 1;
        if (i > 0) idx.push(A, C, B);
        idx.push(B, C, D);
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(nrm, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.boundingSphere = new T.Sphere(new T.Vector3(0, 0, 0.011), 0.008);
    cache.corneaDomeGeo = g;
    return g;
  }

  /* --------------------------------------------------------------------------
     4. LAYER C GEOMETRIES — Medial Lacrimal Caruncle + Plica Semilunaris &
        Hair-Thin (0.45mm) Concave Capillary Lower Tear-Line Meniscus
     -------------------------------------------------------------------------- */
  function evalAlmondMarginsAtLatX(dxLat, open01, squint01, pitchRad) {
    // Pass 2 natural human fissure ratio: high curved upper arch (+4.45mm) & cradled lower lid (-4.00mm)
    const cth = clamp((dxLat - 0.0001) / 0.0107, -1.0, 1.0);
    const sth = Math.sqrt(Math.max(0.0, 1.0 - cth * cth));
    const yCanthus = -0.0002 + 0.0008 * cth;
    const tearLake = Math.exp(-Math.pow((cth + 0.88) / 0.14, 2.0));
    const archPinch = Math.pow(Math.max(0.0, 1.0 - cth * cth), 0.62);

    const sU = Math.pow(sth, 1.04);
    const asymU = 1.0 - 0.12 * cth - 0.06 * cth * cth;
    const yUpperNeutral = yCanthus + 0.00445 * sU * asymU + 0.00032 * sth * tearLake;

    const sL = Math.pow(sth, 1.10);
    const asymL = 1.0 + 0.16 * cth - 0.05 * cth * cth;
    const yLowerNeutral = yCanthus - 0.00400 * sL * asymL - 0.00028 * sth * tearLake;

    const gazeFollowY = pitchRad * EYE_SPEC.radius * 0.32 * archPinch;
    const yLower = yLowerNeutral + 0.00165 * squint01 * archPinch + gazeFollowY * 0.65;
    const yClosed = yCanthus - 0.00315 * archPinch;

    let yUpper;
    if (open01 <= 1.0) {
      yUpper = lerp(yClosed, yUpperNeutral + gazeFollowY - 0.00055 * squint01 * archPinch, clamp(open01, 0.0, 1.0));
    } else {
      const extraWide = clamp(open01 - 1.0, 0.0, 0.45);
      yUpper = yUpperNeutral + gazeFollowY + 0.0056 * extraWide * archPinch;
    }
    return { yUpper, yLower, archPinch };
  }

  function buildCaruncleAndPlicaGeo(T, side) {
    const cache = getGeoCache(T);
    const key = side > 0 ? "caruncleGeoL" : "caruncleGeoR";
    if (cache[key]) return cache[key];

    const R = EYE_SPEC.radius;
    const NU = 12; // Delicate 1.7mm medial tear-duct nub (-0.01105 -> -0.00845)
    const NV = 12;
    const cols = NV + 1;
    const pos = [];
    const uv = [];
    const idx = [];

    for (let iu = 0; iu <= NU; iu++) {
      const u = iu / NU; // 0 = deep medial seal, 0.56 = sulcus, 0.74 = fine plica rim, 1.0 = seamless sclera feather
      const dxLat = lerp(-0.01105, -0.00845, u);
      for (let iv = 0; iv <= NV; iv++) {
        const v = iv / NV;
        const vCentered = (v - 0.5) * 2.0; // -1 .. +1
        const halfSpanY = lerp(0.00092, 0.00172, smooth(0.15, 0.80, u)) * (1.0 - 0.22 * smooth(0.84, 1.0, u));
        const bowX = 0.00020 * (1.0 - vCentered * vCentered) * smooth(0.45, 0.95, u);
        const effDxLat = dxLat + bowX;
        const dy = -0.00035 + vCentered * halfSpanY;

        const r2 = Math.max(0.000010, R * R - effDxLat * effDxLat - dy * dy);
        const zGlobe = Math.sqrt(r2);
        const vEnv = Math.max(0, 1.0 - vCentered * vCentered);

        // Delicate ovoid caruncle mound + subtle plica crescent fold
        const caruncleMound = Math.exp(-Math.pow((u - 0.34) / 0.22, 2.0)) * Math.pow(vEnv, 0.76) * 0.00048;
        const plicaFold = Math.exp(-Math.pow((u - 0.74) / 0.11, 2.0)) * Math.pow(vEnv, 0.58) * 0.00016;
        const baseClearance = 0.00003 * (1.0 - smooth(0.90, 1.0, Math.abs(vCentered)));

        const radialLift = caruncleMound + plicaFold + baseClearance;
        const scaleR = (R + radialLift) / R;
        const px = side * effDxLat * scaleR;
        const py = dy * scaleR;
        const pz = zGlobe * scaleR;

        pos.push(px, py, pz);
        uv.push(u, v);
      }
    }

    for (let iu = 0; iu < NU; iu++) {
      for (let iv = 0; iv < NV; iv++) {
        const A = iu * cols + iv;
        const B = A + 1;
        const C = A + cols;
        const D = C + 1;
        if (side > 0) {
          idx.push(A, C, B, B, C, D);
        } else {
          idx.push(A, B, C, B, D, C);
        }
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.boundingSphere = new T.Sphere(new T.Vector3(-side * 0.0092, -0.0005, 0.0062), 0.004);
    cache[key] = g;
    return g;
  }

  function buildTearMeniscusGeo(T, side) {
    const cache = getGeoCache(T);
    const key = side > 0 ? "meniscusGeoL" : "meniscusGeoR";
    if (cache[key]) return cache[key];

    const R = EYE_SPEC.radius;
    const NU = 28;
    const NV = 3; // 4 cross-sectional vertices spanning 0.45mm concave tear-fillet height
    const cols = NV + 1;
    const pos = [];
    const nrm = [];
    const uv = [];
    const idx = [];

    for (let iu = 0; iu <= NU; iu++) {
      const u = iu / NU;
      const dxLat = lerp(-0.0095, 0.0101, u);
      const endTaper = Math.sin(u * Math.PI);
      const height = 0.00045 * Math.pow(endTaper, 0.65); // 0.45mm hair-thin wet tear strip
      const depthOut = 0.00032 * Math.pow(endTaper, 0.65);

      const { yLower } = evalAlmondMarginsAtLatX(dxLat, 1.0, 0.0, 0.0);
      const px = side * dxLat;

      for (let iv = 0; iv <= NV; iv++) {
        const tv = iv / NV; // 0 = upper contact on globe, 1 = lower lid waterline shelf
        const py = yLower + height * (0.62 - tv);
        const r2 = Math.max(0.000015, R * R - dxLat * dxLat - py * py);
        const zGlobe = Math.sqrt(r2);
        // Concave capillary meniscus profile between globe (tv=0) and waterline margin (tv=1)
        const pz = zGlobe + 0.00004 + depthOut * Math.pow(tv, 1.45);

        pos.push(px, py, pz);

        // Azimuthally curved concave fillet normal -> prevents 1D horizontal bar reflection!
        const nxGlobe = px / R;
        const nyFillet = lerp(-0.12, 0.58, Math.sin(tv * Math.PI * 0.65));
        const nzFillet = Math.sqrt(Math.max(0.15, 1.0 - nxGlobe * nxGlobe * 0.85));
        const nl = Math.hypot(nxGlobe * 0.92, nyFillet, nzFillet) || 1.0;
        nrm.push((nxGlobe * 0.92) / nl, nyFillet / nl, nzFillet / nl);
        uv.push(u, tv);
      }
    }

    for (let iu = 0; iu < NU; iu++) {
      for (let iv = 0; iv < NV; iv++) {
        const A = iu * cols + iv;
        const B = A + 1;
        const C = A + cols;
        const D = C + 1;
        if (side > 0) {
          idx.push(A, B, C, B, D, C);
        } else {
          idx.push(A, C, B, B, C, D);
        }
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(nrm, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.boundingSphere = new T.Sphere(new T.Vector3(0, -0.004, 0.010), 0.013);
    cache[key] = g;
    return g;
  }

  /* --------------------------------------------------------------------------
     5. COLOR & SHADER HELPERS
     -------------------------------------------------------------------------- */
  function parseLinearIrisPalette(T, irisHex) {
    const c = new T.Color(irisHex !== undefined && irisHex !== null ? irisHex : 0x4e2b16);
    // Note: in Three r160 ColorManagement.enabled=true, new THREE.Color(hex) ALREADY stores linear RGB!
    const isLinearApi = new T.Color(0x808080).r < 0.35;
    let lr = isLinearApi ? c.r : Math.pow(Math.max(0.0005, c.r), 2.2);
    let lg = isLinearApi ? c.g : Math.pow(Math.max(0.0005, c.g), 2.2);
    let lb = isLinearApi ? c.b : Math.pow(Math.max(0.0005, c.b), 2.2);

    // Guarantee warm living chestnut/espresso collagen visibility above the #020202 jet-black pupil
    // with balanced mahogany warmth (never fiery orange, never flat black!)
    const lum = lr * 0.299 + lg * 0.587 + lb * 0.114;
    if (lum < 0.026) {
      const boost = 0.026 / Math.max(0.004, lum);
      lr = lerp(lr * boost, 0.052, 0.32);
      lg = lerp(lg * boost, 0.024, 0.32);
      lb = lerp(lb * boost, 0.012, 0.32);
    }

    const mid = new T.Vector3(lr, Math.max(lg, lr * 0.42), Math.max(lb, lr * 0.19));
    const deep = new T.Vector3(mid.x * 0.22, mid.y * 0.20, mid.z * 0.18);
    const highlight = new T.Vector3(
      Math.min(0.32, mid.x * 1.85 + 0.022),
      Math.min(0.19, mid.y * 1.78 + 0.012),
      Math.min(0.10, mid.z * 1.65 + 0.006)
    );
    return { deep, mid, highlight };
  }

  function extractSkinLinVec3(T, src, outVec) {
    if (!src) return outVec;
    const v = src.value ? src.value : src;
    if (typeof v.x === "number" && typeof v.y === "number" && typeof v.z === "number") {
      outVec.set(Math.max(0.002, v.x), Math.max(0.002, v.y), Math.max(0.002, v.z));
    } else if (typeof v.r === "number" && typeof v.g === "number" && typeof v.b === "number") {
      outVec.set(Math.max(0.002, v.r), Math.max(0.002, v.g), Math.max(0.002, v.b));
    }
    return outVec;
  }

  const GLSL_ALMOND_SHADOW_FN =
    "vec2 evalScionLidMargins(float dxLat, float open01, float squint01, float pitchRad) {\n" +
    "  float cth = clamp((dxLat - 0.0001) / 0.0107, -1.0, 1.0);\n" +
    "  float sth = sqrt(max(0.0, 1.0 - cth * cth));\n" +
    "  float yCanthus = -0.0002 + 0.0008 * cth;\n" +
    "  float tearLake = exp(-pow((cth + 0.88) / 0.14, 2.0));\n" +
    "  float archPinch = pow(max(0.0, 1.0 - cth * cth), 0.62);\n" +
    "  float yUpperNeutral = yCanthus + 0.00445 * pow(sth, 1.04) * (1.0 - 0.12 * cth - 0.06 * cth * cth) + 0.00032 * sth * tearLake;\n" +
    "  float yLowerNeutral = yCanthus - 0.00400 * pow(sth, 1.10) * (1.0 + 0.16 * cth - 0.05 * cth * cth) - 0.00028 * sth * tearLake;\n" +
    "  float gazeFollowY = pitchRad * 0.0116 * 0.32 * archPinch;\n" +
    "  float yLower = yLowerNeutral + 0.00165 * squint01 * archPinch + gazeFollowY * 0.65;\n" +
    "  float yClosed = yCanthus - 0.00315 * archPinch;\n" +
    "  float yUpper = open01 <= 1.0\n" +
    "    ? mix(yClosed, yUpperNeutral + gazeFollowY - 0.00055 * squint01 * archPinch, clamp(open01, 0.0, 1.0))\n" +
    "    : (yUpperNeutral + gazeFollowY + 0.0056 * clamp(open01 - 1.0, 0.0, 0.45) * archPinch);\n" +
    "  return vec2(yLower, yUpper);\n" +
    "}\n";

  function createInnerGlobeMaterial(T, sideSign, sharedU, eyeRotUniform, lidStateUniform) {
    // Base white so shader drives exact linear sRGB-converted colors without darkened material tint
    const mat = new T.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.0
    });

    mat.onBeforeCompile = sh => {
      sh.uniforms.uEyeSide = { value: sideSign };
      sh.uniforms.uEyeRot = eyeRotUniform;
      sh.uniforms.uLidState = lidStateUniform; // x=open, y=squint, z=yaw, w=pitch
      sh.uniforms.uPupilRadius = sharedU.uPupilRadius;
      sh.uniforms.uIrisDeep = sharedU.uIrisDeep;
      sh.uniforms.uIrisMid = sharedU.uIrisMid;
      sh.uniforms.uIrisHi = sharedU.uIrisHi;
      sh.uniforms.uSkinLin = sharedU.uSkinLin;
      sh.uniforms.uCyanGlow = sharedU.uCyanGlow;
      sh.uniforms.uHeadCenter = {
        value: new T.Vector3(
          sideSign > 0 ? EYE_SPEC.centerL[0] : EYE_SPEC.centerR[0],
          EYE_SPEC.centerL[1],
          EYE_SPEC.centerL[2]
        )
      };

      sh.vertexShader =
        "uniform mat3 uEyeRot;\n" +
        "varying vec3 vEyeLocalPos;\n" +
        "varying vec3 vSocketPos;\n" +
        "varying vec3 vSocketNrm;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n" +
          "vEyeLocalPos = position;\n" +
          "vSocketPos = uEyeRot * position;\n" +
          "vSocketNrm = normalize(uEyeRot * objectNormal);"
        );

      sh.fragmentShader =
        "uniform float uEyeSide;\n" +
        "uniform vec4 uLidState;\n" +
        "uniform float uPupilRadius;\n" +
        "uniform vec3 uIrisDeep;\n" +
        "uniform vec3 uIrisMid;\n" +
        "uniform vec3 uIrisHi;\n" +
        "uniform vec3 uSkinLin;\n" +
        "uniform vec4 uCyanGlow;\n" +
        "uniform vec3 uHeadCenter;\n" +
        "varying vec3 vEyeLocalPos;\n" +
        "varying vec3 vSocketPos;\n" +
        "varying vec3 vSocketNrm;\n" +
        GLSL_ALMOND_SHADOW_FN +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "float rPlanar = length(vEyeLocalPos.xy);\n" +
            "float rIrisRef = 0.00555;\n" +
            "float rGlobeRef = 0.0116;\n" +
            "float polarAngle = atan(rPlanar, max(0.0001, vEyeLocalPos.z));\n" +
            "vec2 dir2 = rPlanar > 1e-6 ? (vEyeLocalPos.xy / rPlanar) : vec2(1.0, 0.0);\n" +
            "float ang = atan(dir2.y, dir2.x);\n" +
            "\n" +
            "// 1. Clean Living Human Sclera: #f1ece3 sRGB -> exact pow(c, 2.2) = (0.8832, 0.8434, 0.7745)\n" +
            "vec3 scleraIvory = vec3(0.8832, 0.8434, 0.7745);\n" +
            "// Crisp avascular perilimbal collagen sheen right outside limbus\n" +
            "float perilimbalClean = exp(-pow((polarAngle - 0.515) / 0.065, 2.0));\n" +
            "vec3 scleraCol = mix(scleraIvory, vec3(0.905, 0.875, 0.820), 0.35 * perilimbalClean);\n" +
            "\n" +
            "// Subtle warm coral-pink episcleral vascularity ONLY far past angle > 0.50 rad toward canthi!\n" +
            "if (polarAngle > 0.50) {\n" +
            "  float farT = smoothstep(0.50, 0.86, polarAngle);\n" +
            "  float horizBand = pow(abs(dir2.x), 1.35);\n" +
            "  float medMore = uEyeSide * dir2.x < 0.0 ? 1.18 : 0.85;\n" +
            "  float vWave1 = pow(0.5 + 0.5 * sin(ang * 19.0 + sin(polarAngle * 26.0) * 1.7), 6.0);\n" +
            "  float vWave2 = pow(0.5 + 0.5 * cos(ang * 31.0 - cos(polarAngle * 34.0) * 1.4), 8.0);\n" +
            "  float capThreads = (0.60 * vWave1 + 0.45 * vWave2) * smoothstep(0.53, 0.74, polarAngle) * horizBand;\n" +
            "  vec3 vesselTint = vec3(0.68, 0.17, 0.14);\n" +
            "  scleraCol = mix(scleraCol, vec3(0.80, 0.56, 0.50), farT * 0.24 * horizBand * medMore);\n" +
            "  scleraCol = mix(scleraCol, vesselTint, clamp(capThreads * 0.11 * medMore, 0.0, 0.14));\n" +
            "}\n" +
            "\n" +
            "// 2. High-Definition Radial Iris Stroma + Collarette + Caustic Bowl + #020202 Pupil\n" +
            "float innerChamberMask = 1.0 - smoothstep(rIrisRef * 0.95, rIrisRef * 1.035, rPlanar);\n" +
            "float lidShadowAO = 1.0;\n" +
            "if (rPlanar < rIrisRef * 1.05) {\n" +
            "  float tIris = clamp((rPlanar - uPupilRadius) / max(0.0006, rIrisRef - uPupilRadius), 0.0, 1.0);\n" +
            "  // Organic multi-scale interlaced collagen trabeculae & ciliary crypts (integer angular harmonics -> ZERO +/-PI seam!)\n" +
            "  float warpA = 0.055 * sin(ang * 5.0 + 0.8) + 0.038 * cos(ang * 11.0 - 0.5 + tIris * 2.4) + 0.022 * sin(ang * 19.0 - tIris * 3.8);\n" +
            "  float wAng = ang + warpA;\n" +
            "  float fCoarse = 0.5 + 0.5 * sin(wAng * 29.0 + 1.2 * sin(ang * 7.0 + tIris * 2.6));\n" +
            "  float fMid = 0.5 + 0.5 * cos(wAng * 57.0 - 0.9 * cos(ang * 13.0 - tIris * 4.2));\n" +
            "  float fFine = 0.5 + 0.5 * sin(wAng * 109.0 + 0.6 * sin(ang * 23.0) + tIris * 2.8);\n" +
            "  float fMicro = 0.5 + 0.5 * cos(ang * 168.0 - tIris * 3.5);\n" +
            "  float fiberVal = 0.34 * fCoarse + 0.32 * fMid + 0.22 * fFine + 0.12 * fMicro;\n" +
            "\n" +
            "  // Scalloped autonomic collarette wreath (~0.48 * irisRadius -> tIris ~ 0.33)\n" +
            "  float rColWreath = 0.33 + 0.036 * sin(ang * 7.0 + 0.6) + 0.024 * cos(ang * 13.0 - 0.4) + 0.014 * sin(ang * 21.0);\n" +
            "  float collarettePeak = exp(-pow((tIris - rColWreath) / 0.092, 2.0)) * (0.65 + 0.35 * fMid);\n" +
            "  // Organic diamond Fuchs ciliary crypts & pupillary spokes\n" +
            "  float cryptAngular = pow(0.5 + 0.5 * sin(wAng * 18.0 + 1.35 * sin(ang * 5.0)), 4.5);\n" +
            "  float cryptMask = cryptAngular * exp(-pow((tIris - (rColWreath + 0.13)) / 0.14, 2.0));\n" +
            "  float furrow = (0.5 + 0.5 * sin(tIris * 32.0 + 0.6 * sin(ang * 8.0))) * smoothstep(0.52, 0.86, tIris) * 0.10;\n" +
            "\n" +
            "  vec3 irisCol = mix(uIrisDeep, uIrisMid, smoothstep(0.0, 0.22, tIris));\n" +
            "  irisCol = mix(irisCol, uIrisHi, clamp((fiberVal - 0.30) * 0.72 + 0.42 * collarettePeak + furrow, 0.0, 0.88));\n" +
            "  irisCol = mix(irisCol, uIrisDeep * 0.52, 0.54 * cryptMask + 0.26 * (1.0 - smoothstep(0.0, 0.15, tIris)));\n" +
            "\n" +
            "  // Concave anterior-chamber opposite-lower iris caustic glow (overhead/upper-left sky refracted into lower bowl!)\n" +
            "  vec2 causticDir = normalize(vec2(0.28, -0.96));\n" +
            "  float causticAlign = max(0.0, dot(vSocketPos.xy / max(0.0005, rIrisRef), causticDir));\n" +
            "  float causticRadial = exp(-pow((tIris - 0.52) / 0.28, 2.0));\n" +
            "  float causticGlow = pow(causticAlign, 1.50) * causticRadial * smoothstep(0.20, 0.85, uLidState.x);\n" +
            "  irisCol += uIrisHi * (0.52 * causticGlow * (0.75 + 0.25 * fiberVal));\n" +
            "\n" +
            "  // Crisp soft dark limbal ring (r = 0.90..1.02 * irisRadius), softened at 90-deg edge-on silhouette so zero vertical line!\n" +
            "  float rNormI = rPlanar / rIrisRef;\n" +
            "  float ndvLimb = abs(dot(normalize(vNormal), normalize(vViewPosition)));\n" +
            "  float limbalDark = smoothstep(0.80, 0.945, rNormI) * (1.0 - smoothstep(0.985, 1.045, rNormI)) * smoothstep(0.08, 0.38, ndvLimb);\n" +
            "  vec3 limbalCol = uIrisDeep * 0.16 + vec3(0.0022, 0.0012, 0.0009);\n" +
            "  irisCol = mix(irisCol, limbalCol, 0.88 * limbalDark);\n" +
            "\n" +
            "  // 100% Velvet Jet-Black Pupil (#020202 sRGB -> ~0.00030 linear) + dark espresso pupillary ruff\n" +
            "  float pupilEdge = smoothstep(uPupilRadius - 0.00009, uPupilRadius + 0.00012, rPlanar);\n" +
            "  float ruffRing = exp(-pow((rPlanar - uPupilRadius - 0.00008) / 0.00014, 2.0));\n" +
            "  irisCol = mix(irisCol, vec3(0.010, 0.004, 0.002), 0.55 * ruffRing);\n" +
            "  vec3 pupilBlack = vec3(0.00028, 0.00028, 0.00032);\n" +
            "  vec3 anteriorChamberCol = mix(pupilBlack, irisCol, pupilEdge);\n" +
            "\n" +
            "  float irisBlend = 1.0 - smoothstep(rIrisRef * 0.965, rIrisRef * 1.035, rPlanar);\n" +
            "  scleraCol = mix(scleraCol, anteriorChamberCol, irisBlend);\n" +
            "}\n" +
            "\n" +
            "// 3. Head-Space Upper/Lower Eyelid Contact Ambient Occlusion (stationary in socket regardless of eye rotation!)\n" +
            "float dxLat = uEyeSide * vSocketPos.x;\n" +
            "vec2 lidMargins = evalScionLidMargins(dxLat, uLidState.x, uLidState.y, uLidState.w);\n" +
            "float distFromUpper = lidMargins.y - vSocketPos.y;\n" +
            "float distFromLower = vSocketPos.y - lidMargins.x;\n" +
            "// Dual-scale upper-eyelid AO: crisp lash-margin contact shadow + wide ~34% soft upper-sclera gradient (zero popped stare in Silver Gelatin!)\n" +
            "float upperTightT = 1.0 - smoothstep(-0.0006, 0.0020, distFromUpper);\n" +
            "float upperBroadT = 1.0 - smoothstep(0.0000, 0.0046, distFromUpper);\n" +
            "float lowerShadowT = 1.0 - smoothstep(-0.0004, 0.0013, distFromLower);\n" +
            "float canthusCornerT = smoothstep(0.0076, 0.0108, abs(dxLat));\n" +
            "lidShadowAO = (1.0 - 0.44 * upperTightT - 0.30 * upperBroadT) * (1.0 - 0.22 * lowerShadowT) * (1.0 - 0.30 * canthusCornerT);\n" +
            "lidShadowAO = clamp(lidShadowAO, 0.24, 1.0);\n" +
            "// Warm dermal shadow bounce tint from character's melanin skin tone (never muddy olive/grey!)\n" +
            "float skinLum = max(0.015, dot(uSkinLin, vec3(0.299, 0.587, 0.114)));\n" +
            "vec3 warmUmberTint = mix(vec3(1.0), clamp((uSkinLin / skinLum) * 0.45 + vec3(0.62, 0.54, 0.50), 0.45, 1.12), 0.42);\n" +
            "vec3 shadedTint = mix(warmUmberTint * lidShadowAO, vec3(lidShadowAO), 0.45);\n" +
            "// Keep #020202 pupil strictly jet-black\n" +
            "float notPupil = smoothstep(uPupilRadius - 0.00005, uPupilRadius + 0.00018, rPlanar);\n" +
            "diffuseColor.rgb = scleraCol * mix(vec3(1.0), shadedTint, notPupil);"
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\n" +
            "// Wet tear-coated sclera (0.16) vs aqueous-submerged matte iris/pupil (0.95 -> zero diffuse washout!)\n" +
            "roughnessFactor = mix(0.16, 0.95, innerChamberMask);"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "// Subtle warm collagen subsurface wrap floor on open sclera/iris so recessed sockets stay luminous & human\n" +
            "float openVis = smoothstep(0.08, 0.55, uLidState.x) * lidShadowAO;\n" +
            "float notPupilEm = smoothstep(uPupilRadius, uPupilRadius + 0.00020, rPlanar);\n" +
            "totalEmissiveRadiance += diffuseColor.rgb * (0.055 * openVis * notPupilEm);\n" +
            "if (uCyanGlow.w > 0.001) {\n" +
            "  vec3 worldApprox = uHeadCenter + vSocketPos;\n" +
            "  vec3 toPh = worldApprox - uCyanGlow.xyz;\n" +
            "  float d2 = dot(toPh, toPh) + 0.030;\n" +
            "  float ndl = clamp(dot(vSocketNrm, normalize(-toPh)) * 0.6 + 0.4, 0.0, 1.0);\n" +
            "  float att = uCyanGlow.w * 0.22 * ndl * openVis * notPupilEm / (1.0 + 15.0 * d2);\n" +
            "  totalEmissiveRadiance += vec3(0.14, 0.74, 0.98) * att * diffuseColor.rgb;\n" +
            "}"
          )
          .replace(
            "#include <lights_fragment_end>",
            "#include <lights_fragment_end>\n" +
            "// Suppress Layer A air-interface F0 specular over submerged iris & pupil (Layer B cornea dome owns 100% of corneal specular!)\n" +
            "float scleraSpecKeep = (1.0 - innerChamberMask) * smoothstep(-0.22, 0.08, vSocketNrm.y) * mix(0.35, 1.0, lidShadowAO);\n" +
            "reflectedLight.directSpecular *= scleraSpecKeep;\n" +
            "reflectedLight.indirectSpecular *= scleraSpecKeep;"
          );
    };

    mat.customProgramCacheKey = () => "scionInnerEyeGlobe_v5";
    return mat;
  }

  function createCorneaDomeMaterial(T, sideSign, sharedU, eyeRotUniform, lidStateUniform) {
    // Unit white diffuse probe lets Three.js compute exact scene irradiance for 90-deg grazing aqueous refraction,
    // while our custom opaque_fragment outputs ZERO diffuse at 0-deg front view (preserving 100% #020202 black pupil)!
    const mat = new T.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.015,
      metalness: 0.0,
      ior: 1.376,
      reflectivity: 0.94,
      clearcoat: 1.0,
      clearcoatRoughness: 0.018,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      fog: false
    });

    mat.onBeforeCompile = sh => {
      sh.uniforms.uEyeSide = { value: sideSign };
      sh.uniforms.uEyeRot = eyeRotUniform;
      sh.uniforms.uLidState = lidStateUniform;
      sh.uniforms.uPupilRadius = sharedU.uPupilRadius;
      sh.uniforms.uIrisDeep = sharedU.uIrisDeep;
      sh.uniforms.uIrisMid = sharedU.uIrisMid;
      sh.uniforms.uIrisHi = sharedU.uIrisHi;
      sh.uniforms.uSkinLin = sharedU.uSkinLin;
      sh.uniforms.uCyanGlow = sharedU.uCyanGlow;

      sh.vertexShader =
        "uniform mat3 uEyeRot;\n" +
        "varying vec3 vCorneaLocal;\n" +
        "varying vec3 vCorneaLocalNrm;\n" +
        "varying vec3 vEyeViewFromCam;\n" +
        "varying vec3 vSocketPos;\n" +
        "varying vec3 vSocketNrm;\n" +
        sh.vertexShader
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\n" +
            "vCorneaLocal = position;\n" +
            "vCorneaLocalNrm = objectNormal;\n" +
            "vSocketPos = uEyeRot * position;\n" +
            "vSocketNrm = normalize(uEyeRot * objectNormal);"
          )
          .replace(
            "#include <project_vertex>",
            "#include <project_vertex>\n" +
            "// Exact eye-local ray from camera to cornea surface (mvPosition.xyz * mat3(modelViewMatrix) == R^T * mvPosition)!\n" +
            "vEyeViewFromCam = mvPosition.xyz * mat3(modelViewMatrix);"
          );

      sh.fragmentShader =
        "uniform float uEyeSide;\n" +
        "uniform vec4 uLidState;\n" +
        "uniform float uPupilRadius;\n" +
        "uniform vec3 uIrisDeep;\n" +
        "uniform vec3 uIrisMid;\n" +
        "uniform vec3 uIrisHi;\n" +
        "uniform vec3 uSkinLin;\n" +
        "uniform vec4 uCyanGlow;\n" +
        "varying vec3 vCorneaLocal;\n" +
        "varying vec3 vCorneaLocalNrm;\n" +
        "varying vec3 vEyeViewFromCam;\n" +
        "varying vec3 vSocketPos;\n" +
        "varying vec3 vSocketNrm;\n" +
        GLSL_ALMOND_SHADOW_FN +
        sh.fragmentShader
          .replace(
            "#include <opaque_fragment>",
            "float rCornea = length(vCorneaLocal.xy);\n" +
            "float edgeFade = 1.0 - smoothstep(0.00585, 0.00648, rCornea);\n" +
            "\n" +
            "// Eyelid aperture occlusion masks\n" +
            "float dxLatC = uEyeSide * vSocketPos.x;\n" +
            "vec2 marginsC = evalScionLidMargins(dxLatC, uLidState.x, uLidState.y, uLidState.w);\n" +
            "float visUpper = smoothstep(-0.00020, 0.00055, marginsC.y - vSocketPos.y);\n" +
            "float visLower = smoothstep(-0.00015, 0.00065, vSocketPos.y - marginsC.x);\n" +
            "float blinkOpenVis = smoothstep(0.06, 0.22, uLidState.x);\n" +
            "float lidCorneaMask = visUpper * visLower * blinkOpenVis;\n" +
            "// Tighter clip for primary pinpoint catchlight: stays 100% bright whenever below marginsC.y + 0.1mm!\n" +
            "float catchLidMask = smoothstep(-0.00015, 0.00015, marginsC.y - vSocketPos.y) * smoothstep(-0.00015, 0.00030, vSocketPos.y - marginsC.x) * blinkOpenVis;\n" +
            "\n" +
            "// Suppress floor-bounce directional light artifact on bottom of cornea (ZERO bottom white bar!)\n" +
            "float noBottomBar = smoothstep(-0.26, 0.04, vSocketNrm.y);\n" +
            "vec3 pbrSpec = (reflectedLight.directSpecular + reflectedLight.indirectSpecular) * noBottomBar * 0.50;\n" +
            "\n" +
            "// View-consistent 3D corneal pinpoint reflections\n" +
            "vec3 Vview = normalize(vViewPosition);\n" +
            "vec3 Nview = normalize(normal);\n" +
            "vec3 Rview = reflect(-Vview, Nview);\n" +
            "\n" +
            "// Primary upper-left sky/window spark at pupillary border (survives ACES, Sad/Squint lids & all 14 shaders!)\n" +
            "vec3 Lwin = normalize(vec3(-0.24, 0.13, 0.962));\n" +
            "float cosWin = max(0.0, dot(Rview, Lwin));\n" +
            "float winCore = smoothstep(0.9780, 0.9955, cosWin);\n" +
            "float winHalo = 0.22 * pow(cosWin, 96.0);\n" +
            "vec3 primaryCatch = vec3(2.45, 2.40, 2.32) * (winCore + winHalo) * catchLidMask;\n" +
            "\n" +
            "// Faint secondary warm reflector pinpoint (strictly inside central dome rCornea < 0.0040 -> never a bottom bar!)\n" +
            "vec3 Lfill = normalize(vec3(0.36, -0.16, 0.919));\n" +
            "float cosFill = max(0.0, dot(Rview, Lfill));\n" +
            "float fillPin = smoothstep(0.9920, 0.9985, cosFill) * (1.0 - smoothstep(0.0030, 0.0043, rCornea));\n" +
            "vec3 secondaryCatch = vec3(0.32, 0.26, 0.20) * fillPin * lidCorneaMask;\n" +
            "\n" +
            "// Night cyan phone screen pinpoint reflex when uCyanGlow is active (Study 5)\n" +
            "vec3 cyanCatch = vec3(0.0);\n" +
            "if (uCyanGlow.w > 0.005) {\n" +
            "  vec3 Lphone = normalize(vec3(0.08, -0.26, 0.962));\n" +
            "  float cosPh = max(0.0, dot(Rview, Lphone));\n" +
            "  float phPin = smoothstep(0.9910, 0.9982, cosPh) * (1.0 - smoothstep(0.0034, 0.0046, rCornea));\n" +
            "  cyanCatch = vec3(0.24, 0.92, 1.20) * phPin * clamp(uCyanGlow.w, 0.0, 1.2) * 0.65 * catchLidMask;\n" +
            "}\n" +
            "\n" +
            "float ndvCornea = max(0.0, dot(Nview, Vview));\n" +
            "float fresnelTear = 0.032 * pow(1.0 - ndvCornea, 3.6);\n" +
            "vec3 totalCorneaSpec = (pbrSpec * lidCorneaMask + primaryCatch + secondaryCatch + cyanCatch + vec3(fresnelTear * lidCorneaMask)) * edgeFade;\n" +
            "\n" +
            "// Snell's-Law Aqueous Refraction (ior = 1.376): fills the +1.0mm convex corneal bulge in 3/4 & 90-deg profile\n" +
            "// with refracted warm iris & pupil (eliminating the 1px vertical limbal line & empty dome!), while keeping 0-deg front at grazing == 0!\n" +
            "float grazing = smoothstep(0.24, 0.62, 1.0 - ndvCornea) * (1.0 - smoothstep(0.00585, 0.00645, rCornea)) * blinkOpenVis;\n" +
            "vec3 refractedOut = vec3(0.0);\n" +
            "float refrAlpha = 0.0;\n" +
            "if (grazing > 0.002) {\n" +
            "  vec3 Ieye = normalize(vEyeViewFromCam);\n" +
            "  vec3 Neye = normalize(vCorneaLocalNrm);\n" +
            "  float dIN = dot(Ieye, Neye);\n" +
            "  if (dIN > -0.03) Ieye = normalize(Ieye - (dIN + 0.03) * Neye);\n" +
            "  vec3 refr = refract(Ieye, Neye, 1.0 / 1.376);\n" +
            "  float dzCh = max(0.0, vCorneaLocal.z - 0.00995);\n" +
            "  vec2 hitXY = vCorneaLocal.xy + refr.xy * (dzCh / max(0.28, -refr.z));\n" +
            "  float rHit = length(hitXY);\n" +
            "  float rIrisRefC = 0.00555;\n" +
            "  float angHit = atan(hitXY.y, hitXY.x);\n" +
            "  float tIrisC = clamp((rHit - uPupilRadius) / max(0.0006, rIrisRefC - uPupilRadius), 0.0, 1.0);\n" +
            "  float fC = 0.5 + 0.5 * sin(angHit * 34.0 + 0.9 * sin(angHit * 9.0 + tIrisC * 2.5));\n" +
            "  float colPeakC = exp(-pow((tIrisC - 0.34) / 0.11, 2.0));\n" +
            "  vec3 refrIris = mix(uIrisDeep, uIrisMid, smoothstep(0.0, 0.22, tIrisC));\n" +
            "  refrIris = mix(refrIris, uIrisHi, clamp((fC - 0.28) * 0.68 + 0.45 * colPeakC + 0.22, 0.0, 0.90));\n" +
            "  float limbalC = smoothstep(0.82, 0.95, rHit / rIrisRefC) * (1.0 - smoothstep(0.98, 1.05, rHit / rIrisRefC));\n" +
            "  refrIris = mix(refrIris, uIrisDeep * 0.22 + vec3(0.004, 0.002, 0.0015), 0.78 * limbalC);\n" +
            "  float pupEdgeC = smoothstep(uPupilRadius - 0.00012, uPupilRadius + 0.00016, rHit);\n" +
            "  vec3 chCol = mix(vec3(0.0004, 0.0004, 0.0005), refrIris, pupEdgeC);\n" +
            "  vec3 scleraIvC = vec3(0.8832, 0.8434, 0.7745);\n" +
            "  vec3 refrAlbedo = mix(scleraIvC, chCol, 1.0 - smoothstep(rIrisRefC * 0.96, rIrisRefC * 1.05, rHit));\n" +
            "  // Upper-lid AO + live scene diffuse irradiance on the refracted chamber\n" +
            "  float uAOc = 1.0 - 0.52 * (1.0 - smoothstep(-0.0005, 0.0032, marginsC.y - vSocketPos.y));\n" +
            "  vec3 sceneIrr = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + vec3(0.055);\n" +
            "  refractedOut = refrAlbedo * sceneIrr * uAOc;\n" +
            "  refrAlpha = clamp(grazing * 0.97, 0.0, 0.97);\n" +
            "}\n" +
            "\n" +
            "// Composite specular spark over grazing aqueous refraction with exact un-premultiplied NormalBlending!\n" +
            "float specPeak = max(totalCorneaSpec.r, max(totalCorneaSpec.g, totalCorneaSpec.b));\n" +
            "float specAlpha = clamp(specPeak / (1.0 + 0.25 * specPeak), 0.0, 0.98);\n" +
            "float finalAlpha = clamp(refrAlpha + specAlpha * (1.0 - refrAlpha), 0.0, 0.985);\n" +
            "vec3 combinedPremult = refractedOut * refrAlpha * (1.0 - specAlpha * 0.35) + totalCorneaSpec;\n" +
            "vec3 unpremultOut = finalAlpha > 1e-4 ? (combinedPremult / finalAlpha) : vec3(0.0);\n" +
            "gl_FragColor = vec4(unpremultOut, finalAlpha);"
          );
    };

    mat.customProgramCacheKey = () => "scionCorneaDome_v5_2";
    return mat;
  }

  function createCaruncleMaterial(T, sharedU) {
    const mat = new T.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22,
      transparent: true,
      depthWrite: false
    });

    mat.onBeforeCompile = sh => {
      sh.uniforms.uSkinLin = sharedU.uSkinLin;
      sh.uniforms.uCyanGlow = sharedU.uCyanGlow;

      sh.vertexShader =
        "varying vec2 vCarUv;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvCarUv = uv;"
        );

      sh.fragmentShader =
        "uniform vec3 uSkinLin;\n" +
        "uniform vec4 uCyanGlow;\n" +
        "varying vec2 vCarUv;\n" +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "// Delicate 1.7mm melanin-harmonized rose-umber caruncle -> translucent warm rose-ivory plica\n" +
            "vec3 mucosalCoral = mix(vec3(0.165, 0.038, 0.032), uSkinLin * vec3(1.25, 0.52, 0.46), 0.48);\n" +
            "vec3 plicaRose = mix(vec3(0.32, 0.13, 0.11), uSkinLin * vec3(1.55, 0.85, 0.78), 0.35);\n" +
            "float sulcusGroove = exp(-pow((vCarUv.x - 0.56) / 0.10, 2.0));\n" +
            "vec3 cCol = mix(mucosalCoral, plicaRose, smoothstep(0.48, 0.82, vCarUv.x));\n" +
            "cCol = mix(cCol, vec3(0.84, 0.78, 0.72), smoothstep(0.80, 1.0, vCarUv.x) * 0.78);\n" +
            "float cornerAO = 0.72 + 0.28 * smoothstep(0.0, 0.30, vCarUv.x);\n" +
            "diffuseColor.rgb = cCol * cornerAO * (1.0 - 0.22 * sulcusGroove);\n" +
            "float edgeAlphaX = 1.0 - smoothstep(0.74, 1.0, vCarUv.x);\n" +
            "float edgeAlphaY = sin(clamp(vCarUv.y, 0.0, 1.0) * 3.14159265);\n" +
            "diffuseColor.a = edgeAlphaX * smoothstep(0.0, 0.22, edgeAlphaY);"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "if (uCyanGlow.w > 0.005) {\n" +
            "  totalEmissiveRadiance += vec3(0.12, 0.68, 0.92) * diffuseColor.rgb * clamp(uCyanGlow.w * 0.08, 0.0, 0.12);\n" +
            "}"
          );
    };

    mat.customProgramCacheKey = () => "scionCarunclePlica_v5_2";
    return mat;
  }

  function createTearMeniscusMaterial(T, sharedU, lidStateUniform) {
    const mat = new T.MeshPhysicalMaterial({
      color: 0x000000, // 100% optically clear tear film -> ZERO white ribbon bar!
      roughness: 0.03,
      metalness: 0.0,
      ior: 1.336,
      clearcoat: 1.0,
      clearcoatRoughness: 0.025,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      fog: false
    });

    mat.onBeforeCompile = sh => {
      sh.uniforms.uLidState = lidStateUniform;
      sh.uniforms.uCyanGlow = sharedU.uCyanGlow;

      sh.vertexShader =
        "varying vec2 vMenUv;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvMenUv = uv;"
        );

      sh.fragmentShader =
        "uniform vec4 uLidState;\n" +
        "uniform vec4 uCyanGlow;\n" +
        "varying vec2 vMenUv;\n" +
        sh.fragmentShader.replace(
          "#include <opaque_fragment>",
          "float uM = vMenUv.x;\n" +
          "float vM = vMenUv.y;\n" +
          "float endFeather = sin(uM * 3.14159265);\n" +
          "float crossFeather = sin(vM * 3.14159265);\n" +
          "float blinkVis = smoothstep(0.12, 0.32, uLidState.x);\n" +
          "\n" +
          "// Subtle broken-up micro-tear capillary glints (NEVER a continuous white horizontal bar!)\n" +
          "vec3 Vm = normalize(vViewPosition);\n" +
          "vec3 Nm = normalize(normal);\n" +
          "vec3 Rm = reflect(-Vm, Nm);\n" +
          "vec3 Lsky = normalize(vec3(-0.28, 0.52, 0.806));\n" +
          "float beadMod = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uM * 38.0 + 1.3 * sin(uM * 13.0)), 3.0);\n" +
          "float spark = smoothstep(0.965, 0.996, max(0.0, dot(Rm, Lsky))) * beadMod;\n" +
          "vec3 pbrTear = (reflectedLight.directSpecular + reflectedLight.indirectSpecular) * 0.14 * beadMod;\n" +
          "vec3 tearSpec = (pbrTear + vec3(0.85, 0.86, 0.88) * spark * 0.55) * endFeather * crossFeather * blinkVis;\n" +
          "if (uCyanGlow.w > 0.005) {\n" +
          "  tearSpec += vec3(0.14, 0.78, 1.0) * spark * clamp(uCyanGlow.w, 0.0, 1.0) * 0.25 * endFeather * crossFeather * blinkVis;\n" +
          "}\n" +
          "float mPeak = max(tearSpec.r, max(tearSpec.g, tearSpec.b));\n" +
          "float mAlpha = clamp(mPeak, 0.0, 0.36);\n" +
          "vec3 mCol = mAlpha > 1e-4 ? (tearSpec / mAlpha) : vec3(0.0);\n" +
          "gl_FragColor = vec4(mCol, mAlpha);"
        );
    };

    mat.customProgramCacheKey = () => "scionTearMeniscus_v5";
    return mat;
  }

  /* --------------------------------------------------------------------------
     6. PUBLIC APPARATUS FACTORY — ScionEyeGlobe.createEyeApparatus(THREE, opts)
     -------------------------------------------------------------------------- */
  function createEyeApparatus(T, opts = {}) {
    const headAnchor = opts.headAnchor || null;
    const irisPalette = parseLinearIrisPalette(T, opts.irisHex);
    const skinLinVec = extractSkinLinVec3(T, opts.skinColorLin, new T.Vector3(0.075, 0.042, 0.028));
    const cyanGlowUniform = (opts.cyanGlowUniform && opts.cyanGlowUniform.value)
      ? opts.cyanGlowUniform
      : { value: new T.Vector4(0, 0, 0, 0) };

    const sharedU = {
      uPupilRadius: { value: EYE_SPEC.pupilRadius },
      uIrisDeep: { value: irisPalette.deep },
      uIrisMid: { value: irisPalette.mid },
      uIrisHi: { value: irisPalette.highlight },
      uSkinLin: { value: skinLinVec },
      uCyanGlow: cyanGlowUniform
    };

    const innerGeo = buildInnerOcularGlobeGeo(T);
    const corneaGeo = buildCorneaDomeGeo(T);
    const caruncleGeoL = buildCaruncleAndPlicaGeo(T, 1);
    const caruncleGeoR = buildCaruncleAndPlicaGeo(T, -1);
    const meniscusGeoL = buildTearMeniscusGeo(T, 1);
    const meniscusGeoR = buildTearMeniscusGeo(T, -1);

    const eyeRotL = { value: new T.Matrix3() };
    const eyeRotR = { value: new T.Matrix3() };
    const lidStateL = { value: new T.Vector4(1.0, 0.0, 0.0, 0.0) }; // open, squint, yaw, pitch
    const lidStateR = { value: new T.Vector4(1.0, 0.0, 0.0, 0.0) };

    const innerMatL = createInnerGlobeMaterial(T, 1, sharedU, eyeRotL, lidStateL);
    const innerMatR = createInnerGlobeMaterial(T, -1, sharedU, eyeRotR, lidStateR);
    const corneaMatL = createCorneaDomeMaterial(T, 1, sharedU, eyeRotL, lidStateL);
    const corneaMatR = createCorneaDomeMaterial(T, -1, sharedU, eyeRotR, lidStateR);
    const caruncleMat = createCaruncleMaterial(T, sharedU);
    const meniscusMatL = createTearMeniscusMaterial(T, sharedU, lidStateL);
    const meniscusMatR = createTearMeniscusMaterial(T, sharedU, lidStateR);

    const buildEyeGroup = (center, innerMat, corneaMat, sideTag) => {
      const grp = new T.Group();
      grp.name = "scionEye_" + sideTag;
      grp.position.set(center[0], center[1], center[2]);
      grp.rotation.order = "YXZ";

      const globeMesh = new T.Mesh(innerGeo, innerMat);
      globeMesh.name = "scionGlobeInner_" + sideTag;
      globeMesh.castShadow = false;
      globeMesh.receiveShadow = false; // Prevent blocky 6.5mm head PCF shadow-acne darkening the sclera!
      grp.add(globeMesh);

      const corneaMesh = new T.Mesh(corneaGeo, corneaMat);
      corneaMesh.name = "scionCorneaDome_" + sideTag;
      corneaMesh.castShadow = false;
      corneaMesh.receiveShadow = false;
      corneaMesh.renderOrder = 3;
      grp.add(corneaMesh);

      grp.userData.globeMesh = globeMesh;
      grp.userData.corneaMesh = corneaMesh;
      return grp;
    };

    const eyeL = buildEyeGroup(EYE_SPEC.centerL, innerMatL, corneaMatL, "L");
    const eyeR = buildEyeGroup(EYE_SPEC.centerR, innerMatR, corneaMatR, "R");

    const caruncleL = new T.Mesh(caruncleGeoL, caruncleMat);
    caruncleL.name = "scionCaruncle_L";
    caruncleL.position.set(EYE_SPEC.centerL[0], EYE_SPEC.centerL[1], EYE_SPEC.centerL[2]);
    caruncleL.castShadow = false;
    caruncleL.receiveShadow = false;
    caruncleL.renderOrder = 2;

    const caruncleR = new T.Mesh(caruncleGeoR, caruncleMat);
    caruncleR.name = "scionCaruncle_R";
    caruncleR.position.set(EYE_SPEC.centerR[0], EYE_SPEC.centerR[1], EYE_SPEC.centerR[2]);
    caruncleR.castShadow = false;
    caruncleR.receiveShadow = false;
    caruncleR.renderOrder = 2;

    const meniscusL = new T.Mesh(meniscusGeoL, meniscusMatL);
    meniscusL.name = "scionTearMeniscus_L";
    meniscusL.position.set(EYE_SPEC.centerL[0], EYE_SPEC.centerL[1], EYE_SPEC.centerL[2]);
    meniscusL.castShadow = false;
    meniscusL.receiveShadow = false;
    meniscusL.renderOrder = 4;

    const meniscusR = new T.Mesh(meniscusGeoR, meniscusMatR);
    meniscusR.name = "scionTearMeniscus_R";
    meniscusR.position.set(EYE_SPEC.centerR[0], EYE_SPEC.centerR[1], EYE_SPEC.centerR[2]);
    meniscusR.castShadow = false;
    meniscusR.receiveShadow = false;
    meniscusR.renderOrder = 4;

    if (headAnchor && typeof headAnchor.add === "function") {
      headAnchor.add(eyeL);
      headAnchor.add(eyeR);
      headAnchor.add(caruncleL);
      headAnchor.add(caruncleR);
      headAnchor.add(meniscusL);
      headAnchor.add(meniscusR);
    }

    const caruncles = [caruncleL, caruncleR];
    const menisci = [meniscusL, meniscusR];

    // Zero-GC scratch objects for Matrix3 socket rotation updates
    const scratchMat4 = new T.Matrix4();
    let curYaw = 0.0;
    let curPitch = 0.0;
    let curOpenL = 1.0;
    let curOpenR = 1.0;
    let curSquint = 0.0;

    function syncMenisciTransforms() {
      const gazeLiftY = curPitch * EYE_SPEC.radius * 0.22;
      const squintLiftY = curSquint * 0.00165;
      const dy = gazeLiftY + squintLiftY;
      meniscusL.position.y = EYE_SPEC.centerL[1] + dy;
      meniscusR.position.y = EYE_SPEC.centerR[1] + dy;
      meniscusL.visible = curOpenL > 0.10;
      meniscusR.visible = curOpenR > 0.10;
      caruncleL.visible = curOpenL > 0.08;
      caruncleR.visible = curOpenR > 0.08;
    }

    // Subtle natural binocular convergence (~0.75 deg inward per eye -> living focal point, never wall-eyed!)
    const CONVERGENCE_RAD = 0.013;

    function setGaze(yawRad = 0, pitchRad = 0) {
      curYaw = clamp(Number.isFinite(yawRad) ? yawRad : 0, -0.52, 0.52);
      curPitch = clamp(Number.isFinite(pitchRad) ? pitchRad : 0, -0.40, 0.40);

      // Left eye (+X): inward convergence is -Y rotation; pitchRad > 0 (UP) is -X rotation
      const yawL = curYaw - CONVERGENCE_RAD;
      const yawR = curYaw + CONVERGENCE_RAD;
      const rx = -curPitch;

      eyeL.rotation.set(rx, yawL, 0, "YXZ");
      eyeR.rotation.set(rx, yawR, 0, "YXZ");

      scratchMat4.makeRotationFromEuler(eyeL.rotation);
      eyeRotL.value.setFromMatrix4(scratchMat4);

      scratchMat4.makeRotationFromEuler(eyeR.rotation);
      eyeRotR.value.setFromMatrix4(scratchMat4);

      lidStateL.value.z = yawL;
      lidStateL.value.w = curPitch;
      lidStateR.value.z = yawR;
      lidStateR.value.w = curPitch;
      syncMenisciTransforms();
    }

    function setLidShadow(openL = 1.0, openR = openL, squint = 0.0) {
      curOpenL = clamp(Number.isFinite(openL) ? openL : 1.0, 0.0, 1.45);
      curOpenR = clamp(Number.isFinite(openR) ? openR : curOpenL, 0.0, 1.45);
      curSquint = clamp(Number.isFinite(squint) ? squint : 0.0, 0.0, 1.15);
      lidStateL.value.x = curOpenL;
      lidStateL.value.y = curSquint;
      lidStateR.value.x = curOpenR;
      lidStateR.value.y = curSquint;
      syncMenisciTransforms();
    }

    function setPupil(dilate01 = 0.5) {
      const d = clamp(Number.isFinite(dilate01) ? dilate01 : 0.5, 0.0, 1.0);
      // d = 0.5 -> exact 0.00195m (3.9mm diameter); 0.0 -> 2.8mm bright-sun constriction; 1.0 -> 5.2mm emotional/night dilation
      const rPupil = d <= 0.5
        ? lerp(0.00140, EYE_SPEC.pupilRadius, d * 2.0)
        : lerp(EYE_SPEC.pupilRadius, 0.00260, (d - 0.5) * 2.0);
      sharedU.uPupilRadius.value = rPupil;
    }

    function syncSkinColor(linCol) {
      extractSkinLinVec3(T, linCol, sharedU.uSkinLin.value);
    }

    function setIrisColor(irisHex) {
      const pal = parseLinearIrisPalette(T, irisHex);
      sharedU.uIrisDeep.value.copy(pal.deep);
      sharedU.uIrisMid.value.copy(pal.mid);
      sharedU.uIrisHi.value.copy(pal.highlight);
    }

    // Initialize rest convergence & matrices immediately
    setGaze(0, 0);
    setLidShadow(1.0, 1.0, 0.0);
    setPupil(0.5);

    const ctrl = {
      eyeL,
      eyeR,
      caruncles,
      menisci,
      setGaze,
      setLidShadow,
      setPupil,
      syncSkinColor,
      setIrisColor,
      uniforms: sharedU,
      spec: EYE_SPEC
    };

    if (headAnchor) {
      headAnchor.userData = headAnchor.userData || {};
      headAnchor.userData.scionEyes = ctrl;
    }

    return ctrl;
  }

  const ScionEyeGlobe = {
    version: "5.0.0",
    EYE_SPEC,
    createEyeApparatus,
    buildInnerOcularGlobeGeo,
    buildCorneaDomeGeo,
    buildCaruncleAndPlicaGeo,
    buildTearMeniscusGeo
  };

  root.ScionEyeGlobe = ScionEyeGlobe;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = ScionEyeGlobe;
  }
})(typeof window !== "undefined" ? window : globalThis);
