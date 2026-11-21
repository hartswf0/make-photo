/**
 * m2m-world-bridge.js — Unified Clothed Anny CC0 Cast + In-World Scion Cast Mesh2Motion Driver
 *
 * Exposes `window.Mesh2MotionWorldBridge` (and `module.exports` in CommonJS/Node):
 *  - Part A: `dressAnnyCharacter(THREE, annyRoot, archetype, opts)`
 *      Dresses any loaded Anny CC0 `.glb` figure (`adult_f` Imani, `child7` June, `adult_m` Elder,
 *      `elder` Makeda) with rich East African melanin PBR skin, zero-clipping skinned layered
 *      Ethiopian garments bound directly to Anny's live 104-bone skeleton, head-mounted 3D groom
 *      (4C afro, twisted locs, coiled turban + beard, draped shash), spring-damped shawl/coat sway,
 *      and a clean `setClothed(bool)` toggle.
 *  - Part B: `createWorldCastDriver(THREE, opts)`
 *      Drives any existing clothed `donkey/characters.js` Scion character (`ch` with 65-bone
 *      `HumanSculptV3` rig) with Mesh2Motion's 35 CC0 clips (`motion-pipeline/mesh2motion/clips/*.glb`),
 *      smoothly slerp-blended AFTER `ch.pose(...)` so FACS facial expressions (`HEAD`/`JAW`),
 *      ophthalmic eyes, and spring-bone coat/shamma/hair follow-through stay 100% alive.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.Mesh2MotionWorldBridge = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const VERSION = '1.0.0';

  const ARCHETYPES = Object.freeze({
    adult_f: {
      id: 'adult_f',
      name: 'Imani',
      label: 'Imani (Adult F)',
      skinHex: 0x7b4c33,
      sheenHex: 0xb98566,
      coatHex: 0x3b485b,
      tunicHex: 0xe4d5bc,
      trouserHex: 0x676049,
      bootHex: 0x3b261a,
      beltHex: 0x5c341c,
      hairHex: 0x1a1513,
      accentHex: 0xd9a44b,
    },
    child7: {
      id: 'child7',
      name: 'June',
      label: 'June (Child 7y)',
      skinHex: 0x85553a,
      sheenHex: 0xc29070,
      tunicHex: 0xc4673b,
      tunicAccentHex: 0xe6d8be,
      trouserHex: 0x45566a,
      bootHex: 0x553421,
      hairHex: 0x1a1513,
      accentHex: 0xe0a950,
    },
    adult_m: {
      id: 'adult_m',
      name: 'Elder',
      label: 'Elder (Adult M)',
      skinHex: 0x6c422c,
      sheenHex: 0xa87658,
      tunicHex: 0xdfd3be,
      shammaHex: 0xeee5d6,
      trouserHex: 0x423931,
      bootHex: 0x332219,
      turbanHex: 0xe8decb,
      hairHex: 0x2f2a26,
      accentHex: 0xb83e30,
    },
    elder: {
      id: 'elder',
      name: 'Makeda',
      label: 'Makeda (Elder)',
      skinHex: 0x744932,
      sheenHex: 0xb28061,
      tunicHex: 0x733f45,
      shammaHex: 0xefe5d6,
      trouserHex: 0x3f3633,
      bootHex: 0x36241b,
      shashHex: 0xe4d5bc,
      hairHex: 0x35302d,
      accentHex: 0xcf973e,
    },
  });

  /** Canonical HumanSculptV3 65-bone indices (matches donkey/human-sculpt-v3.js `B`) */
  const B = Object.freeze({
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
    L_THUMB_1: 21, L_THUMB_2: 22, L_THUMB_3: 23,
    L_INDEX_1: 24, L_INDEX_2: 25, L_INDEX_3: 26,
    L_MID_1:   27, L_MID_2:   28, L_MID_3:   29,
    L_RING_1:  30, L_RING_2:  31, L_RING_3:  32,
    L_PINKY_1: 33, L_PINKY_2: 34, L_PINKY_3: 35,
    R_THUMB_1: 36, R_THUMB_2: 37, R_THUMB_3: 38,
    R_INDEX_1: 39, R_INDEX_2: 40, R_INDEX_3: 41,
    R_MID_1:   42, R_MID_2:   43, R_MID_3:   44,
    R_RING_1:  45, R_RING_2:  46, R_RING_3:  47,
    R_PINKY_1: 48, R_PINKY_2: 49, R_PINKY_3: 50,
    ULEG_L: 51, KNEE_VOL_L: 52, LLEG_L: 53, FOOT_L: 54, TOE_L: 55,
    ULEG_R: 56, KNEE_VOL_R: 57, LLEG_R: 58, FOOT_R: 59, TOE_R: 60,
    COAT_B: 61, COAT_L: 62, COAT_R: 63, HAIR_TAIL: 64,
  });

  /** Mesh2Motion humanoid bone -> HumanSculptV3 bone index map */
  const SCION_BONE_MAP = Object.freeze({
    pelvis: B.PELVIS,
    spine_01: B.LUMBAR,
    spine_02: B.THORAX,
    spine_03: B.CHEST,
    neck_01: B.NECK_LOW,
    head: B.HEAD,
    clavicle_l: B.CLAV_L,
    upperarm_l: B.UARM_L,
    lowerarm_l: B.FARM_L,
    hand_l: B.HAND_L,
    clavicle_r: B.CLAV_R,
    upperarm_r: B.UARM_R,
    lowerarm_r: B.FARM_R,
    hand_r: B.HAND_R,
    thigh_l: B.ULEG_L,
    calf_l: B.LLEG_L,
    foot_l: B.FOOT_L,
    ball_l: B.TOE_L,
    thigh_r: B.ULEG_R,
    calf_r: B.LLEG_R,
    foot_r: B.FOOT_R,
    ball_r: B.TOE_R,
  });

  /** Canonical HumanSculptV3 parent index table for retargeting */
  const SCION_PARENTS = Object.freeze({
    [B.PELVIS]: -1,
    [B.LUMBAR]: B.PELVIS,
    [B.THORAX]: B.LUMBAR,
    [B.CHEST]: B.THORAX,
    [B.NECK_LOW]: B.CHEST,
    [B.HEAD]: B.NECK_LOW,
    [B.CLAV_L]: B.CHEST,
    [B.UARM_L]: B.CLAV_L,
    [B.FARM_L]: B.UARM_L,
    [B.HAND_L]: B.FARM_L,
    [B.CLAV_R]: B.CHEST,
    [B.UARM_R]: B.CLAV_R,
    [B.FARM_R]: B.UARM_R,
    [B.HAND_R]: B.FARM_R,
    [B.ULEG_L]: B.PELVIS,
    [B.LLEG_L]: B.ULEG_L,
    [B.FOOT_L]: B.LLEG_L,
    [B.TOE_L]: B.FOOT_L,
    [B.ULEG_R]: B.PELVIS,
    [B.LLEG_R]: B.ULEG_R,
    [B.FOOT_R]: B.LLEG_R,
    [B.TOE_R]: B.FOOT_R,
  });

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // ---------------------------------------------------------------------------
  // Pure quaternion / vector math helpers (zero allocation hot paths)
  // ---------------------------------------------------------------------------
  function qNormalize(q) {
    const l = Math.hypot(q[0], q[1], q[2], q[3]);
    return l < 1e-12 ? [0, 0, 0, 1] : [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
  }
  function qConj(q) { return [-q[0], -q[1], -q[2], q[3]]; }
  function qMul(a, b) {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
  }
  function qRotateVec(q, v) {
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const vx = v[0], vy = v[1], vz = v[2];
    const ix = qw * vx + qy * vz - qz * vy;
    const iy = qw * vy + qz * vx - qx * vz;
    const iz = qw * vz + qx * vy - qy * vx;
    const iw = -qx * vx - qy * vy - qz * vz;
    return [
      ix * qw + iw * -qx + iy * -qz - iz * -qy,
      iy * qw + iw * -qy + iz * -qx - ix * -qz,
      iz * qw + iw * -qz + ix * -qy - iy * -qx,
    ];
  }
  function vSub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function vDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function vCross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }
  function vNorm(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return l < 1e-12 ? [0, 1, 0] : [v[0] / l, v[1] / l, v[2] / l];
  }
  function qFromUnitVectors(a, b) {
    const va = vNorm(a);
    const vb = vNorm(b);
    const d = clamp(vDot(va, vb), -1, 1);
    if (d > 0.999999) return [0, 0, 0, 1];
    if (d < -0.999999) {
      let axis = vCross([0, 0, 1], va);
      if (Math.hypot(axis[0], axis[1], axis[2]) < 1e-4) axis = vCross([1, 0, 0], va);
      const an = vNorm(axis);
      return [an[0], an[1], an[2], 0];
    }
    const c = vCross(va, vb);
    return qNormalize([c[0], c[1], c[2], 1 + d]);
  }
  function qSlerpArr(a, b, t) {
    let bx = b[0], by = b[1], bz = b[2], bw = b[3];
    let dot = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
    if (dot < 0) { dot = -dot; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    if (dot > 0.9995) {
      return qNormalize([
        a[0] + t * (bx - a[0]),
        a[1] + t * (by - a[1]),
        a[2] + t * (bz - a[2]),
        a[3] + t * (bw - a[3]),
      ]);
    }
    const theta0 = Math.acos(clamp(dot, -1, 1));
    const sin0 = Math.sin(theta0);
    const s0 = Math.sin((1 - t) * theta0) / sin0;
    const s1 = Math.sin(t * theta0) / sin0;
    return [s0 * a[0] + s1 * bx, s0 * a[1] + s1 * by, s0 * a[2] + s1 * bz, s0 * a[3] + s1 * bw];
  }

  // ---------------------------------------------------------------------------
  // Procedural Ethiopian Textile & Leather Texture Generators
  // ---------------------------------------------------------------------------
  function makeWeaveTexture(THREE, opts) {
    const size = opts.size || 128;
    const data = new Uint8Array(size * size * 4);
    const base = new THREE.Color(opts.baseHex || 0xd9cbb5);
    const stripe = opts.stripeHex !== undefined ? new THREE.Color(opts.stripeHex) : null;
    const accent = opts.accentHex !== undefined ? new THREE.Color(opts.accentHex) : null;
    const mode = opts.mode || 'weave';

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        // Subtle basket/twill weave micro-contrast
        const warp = Math.sin(x * 1.45) * 0.5 + 0.5;
        const weft = Math.sin(y * 1.45) * 0.5 + 0.5;
        let lum = 0.90 + 0.14 * ((x + y) % 2 === 0 ? warp : weft);
        let r = base.r * lum;
        let g = base.g * lum;
        let b = base.b * lum;

        if (mode === 'tibeb' && stripe && accent) {
          // Authentic Ethiopian tibeb geometric border band near hem/edge
          const band = v < 0.17 || (v > 0.86 && v < 0.96);
          if (band) {
            const diamond = Math.abs(((u * 16) % 1) - 0.5) + Math.abs(((v * 16) % 1) - 0.5);
            const c = diamond < 0.42 ? accent : stripe;
            r = c.r * (0.92 + 0.12 * warp);
            g = c.g * (0.92 + 0.12 * warp);
            b = c.b * (0.92 + 0.12 * warp);
          } else if (Math.abs(v - 0.19) < 0.015 || Math.abs(v - 0.84) < 0.012) {
            r = accent.r; g = accent.g; b = accent.b;
          }
        } else if (mode === 'knit') {
          const rib = Math.sin(x * 0.95) * 0.08 + Math.sin(y * 1.8 + (x % 4) * 0.4) * 0.06;
          r = clamp(base.r * (0.95 + rib), 0, 1);
          g = clamp(base.g * (0.95 + rib), 0, 1);
          b = clamp(base.b * (0.95 + rib), 0, 1);
          if (accent && v < 0.10) {
            r = accent.r * 0.95; g = accent.g * 0.95; b = accent.b * 0.95;
          }
        } else if (mode === 'twill') {
          const diag = Math.sin((x + y) * 1.15) * 0.07;
          r = clamp(base.r * (0.96 + diag), 0, 1);
          g = clamp(base.g * (0.96 + diag), 0, 1);
          b = clamp(base.b * (0.96 + diag), 0, 1);
        } else if (mode === 'leather') {
          const grain = Math.sin(x * 0.7 + Math.sin(y * 0.43) * 2.1) * 0.05;
          r = clamp(base.r * (0.95 + grain), 0, 1);
          g = clamp(base.g * (0.95 + grain), 0, 1);
          b = clamp(base.b * (0.95 + grain), 0, 1);
        }

        const idx = (y * size + x) * 4;
        data[idx] = clamp(Math.round(r * 255), 0, 255);
        data[idx + 1] = clamp(Math.round(g * 255), 0, 255);
        data[idx + 2] = clamp(Math.round(b * 255), 0, 255);
        data[idx + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repX || 3, opts.repY || 3);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  // ---------------------------------------------------------------------------
  // Part A — Clothed & Groomed Anny CC0 Cast
  // ---------------------------------------------------------------------------

  function classifyAnnyBoneName(name) {
    const n = normName(name);
    if (n.includes('head') || n.includes('neck') || n.includes('jaw') || n.includes('eye') || n.includes('ear')) return 'head';
    if (n.includes('wrist') || n.includes('finger') || n.includes('thumb') || n.includes('metacarpal') || n.includes('hand')) return 'hand';
    if (n.includes('lowerarm')) return 'lowerarm';
    if (n.includes('upperarm') || n.includes('shoulder') || n.includes('clavicle') || n.includes('deltoid')) return 'upperarm';
    if (n.includes('foot') || n.includes('toe') || n.includes('heel') || n.includes('ankle')) return 'foot';
    if (n.includes('lowerleg')) return 'lowerleg';
    if (n.includes('upperleg')) return 'upperleg';
    if (n.includes('spine') || n.includes('breast') || n.includes('rib') || n.includes('chest')) return 'torso';
    if (n.includes('root') || n.includes('pelvis') || n.includes('hip') || n.includes('butt')) return 'pelvis';
    return 'torso';
  }

  /**
   * Extract a zero-clipping SkinnedMesh garment shell directly from Anny's own SkinnedMesh.
   * Because skinIndex & skinWeight are copied verbatim from the underlying Anny vertices and
   * vertices are displaced strictly along outward smooth normals, body skin cannot clip through
   * across any of the 35 Mesh2Motion clips.
   */
  function extractSkinnedGarmentShell(THREE, bodyMesh, bodyData, spec) {
    const srcGeo = bodyMesh.geometry;
    const pos = srcGeo.attributes.position;
    const nrm = srcGeo.attributes.normal;
    const uv = srcGeo.attributes.uv;
    const si = srcGeo.attributes.skinIndex;
    const sw = srcGeo.attributes.skinWeight;
    const index = srcGeo.index;
    const vertCount = pos.count;

    const { minY, height, centerZ, vRegion } = bodyData;
    const includeVert = new Uint8Array(vertCount);
    const triCount = index ? Math.floor(index.count / 3) : Math.floor(vertCount / 3);

    for (let v = 0; v < vertCount; v++) {
      const vx = pos.getX(v);
      const vy = pos.getY(v);
      const vz = pos.getZ(v);
      const yNorm = (vy - minY) / height;
      const zRel = vz - centerZ;
      if (spec.predicate(vx, vy, vz, yNorm, zRel, vRegion[v], height)) {
        includeVert[v] = 1;
      }
    }

    const oldToNew = new Int32Array(vertCount);
    oldToNew.fill(-1);
    const outIdx = [];
    const newVerts = [];

    for (let t = 0; t < triCount; t++) {
      const i0 = index ? index.getX(t * 3) : t * 3;
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      const hits = includeVert[i0] + includeVert[i1] + includeVert[i2];
      if (hits < (spec.minHits || 2)) continue;

      const tri = [i0, i1, i2];
      for (let k = 0; k < 3; k++) {
        const ov = tri[k];
        let nv = oldToNew[ov];
        if (nv < 0) {
          nv = newVerts.length;
          oldToNew[ov] = nv;
          newVerts.push(ov);
        }
        outIdx.push(nv);
      }
    }

    if (newVerts.length === 0 || outIdx.length === 0) return null;

    const nV = newVerts.length;
    const outPos = new Float32Array(nV * 3);
    const outNrm = new Float32Array(nV * 3);
    const outUv = new Float32Array(nV * 2);
    const outSi = new Uint16Array(nV * 4);
    const outSw = new Float32Array(nV * 4);

    for (let i = 0; i < nV; i++) {
      const ov = newVerts[i];
      let vx = pos.getX(ov);
      let vy = pos.getY(ov);
      let vz = pos.getZ(ov);
      const nx = nrm ? nrm.getX(ov) : 0;
      const ny = nrm ? nrm.getY(ov) : 1;
      const nz = nrm ? nrm.getZ(ov) : 0;
      const yNorm = (vy - minY) / height;
      const zRel = vz - centerZ;

      const offset = typeof spec.offset === 'function'
        ? spec.offset(vx, vy, vz, yNorm, zRel, vRegion[ov], height)
        : (spec.offset || 0.012);

      vx += nx * offset;
      vy += ny * offset * 0.45;
      vz += nz * offset;

      if (spec.deform) {
        const d = spec.deform(vx, vy, vz, yNorm, zRel, vRegion[ov], height);
        vx += d[0]; vy += d[1]; vz += d[2];
      }

      outPos[i * 3] = vx;
      outPos[i * 3 + 1] = vy;
      outPos[i * 3 + 2] = vz;
      outNrm[i * 3] = nx;
      outNrm[i * 3 + 1] = ny;
      outNrm[i * 3 + 2] = nz;

      // Cylindrical/planar garment UV mapping so woven patterns & tibeb borders align horizontally
      if (spec.planarUv) {
        const ang = Math.atan2(vx, zRel) / (Math.PI * 2) + 0.5;
        const vMin = spec.uvMinY !== undefined ? spec.uvMinY : 0.0;
        const vMax = spec.uvMaxY !== undefined ? spec.uvMaxY : 1.0;
        outUv[i * 2] = ang;
        outUv[i * 2 + 1] = clamp((yNorm - vMin) / Math.max(0.05, vMax - vMin), 0, 1);
      } else if (uv) {
        outUv[i * 2] = uv.getX(ov);
        outUv[i * 2 + 1] = uv.getY(ov);
      }

      outSi[i * 4] = si.getX(ov);
      outSi[i * 4 + 1] = si.getY(ov);
      outSi[i * 4 + 2] = si.getZ(ov);
      outSi[i * 4 + 3] = si.getW(ov);

      outSw[i * 4] = sw.getX(ov);
      outSw[i * 4 + 1] = sw.getY(ov);
      outSw[i * 4 + 2] = sw.getZ(ov);
      outSw[i * 4 + 3] = sw.getW(ov);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(outNrm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(outUv, 2));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(outSi, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(outSw, 4));
    geo.setIndex(outIdx);
    geo.computeVertexNormals();

    const mesh = new THREE.SkinnedMesh(geo, spec.material);
    mesh.name = spec.name || 'm2m_garment';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
    return mesh;
  }

  /**
   * Build head-mounted 3D groom (4C afro, twisted locs, coiled turban + beard, or draped shash)
   * + subtle natural eyes & brows in `head` bone local coordinates using the actual head bbox.
   */
  function buildHeadGroom(THREE, headBone, headMetrics, archKey, palette, disposables) {
    const group = new THREE.Group();
    group.name = `m2m_groom_${archKey}`;

    const cx = headMetrics.cx;
    const cy = headMetrics.cy;
    const cz = headMetrics.cz;
    const rx = Math.max(0.055, headMetrics.rx);
    const ry = Math.max(0.068, headMetrics.ry);
    const rz = Math.max(0.062, headMetrics.rz);

    // Keep Anny's sculpted face completely unobstructed — mount 3D hair/headwear cleanly
    // behind the hairline & crown.
    const hairMat = new THREE.MeshPhysicalMaterial({
      color: palette.hairHex,
      roughness: 0.94,
      metalness: 0.0,
      sheen: 0.28,
      sheenRoughness: 0.85,
      sheenColor: new THREE.Color(0x3a2e28),
    });
    disposables.push(hairMat);

    if (archKey === 'adult_f') {
      // Imani: Lush 4C matte sculpted afro volume crown seated cleanly behind forehead hairline + warm brass hoops
      const crownGeo = new THREE.IcosahedronGeometry(1, 2);
      disposables.push(crownGeo);
      const baseCrown = new THREE.Mesh(crownGeo, hairMat);
      baseCrown.position.set(cx, cy + ry * 0.42, cz - rz * 0.42);
      baseCrown.scale.set(rx * 1.18, ry * 0.96, rz * 1.04);
      baseCrown.castShadow = true;
      group.add(baseCrown);

      // Sculpted organic 4C coil puffs around crown & back (never covering face +Z)
      const puffGeo = new THREE.IcosahedronGeometry(rx * 0.36, 1);
      disposables.push(puffGeo);
      const rings = [
        { y: 0.62, r: 0.82, count: 9, zBias: -0.38 },
        { y: 0.92, r: 0.56, count: 7, zBias: -0.34 },
        { y: 0.22, r: 0.88, count: 8, zBias: -0.44, backOnly: true },
      ];
      for (const ring of rings) {
        for (let i = 0; i < ring.count; i++) {
          const a = (i / ring.count) * Math.PI * 2 + ring.y;
          const px = Math.sin(a) * rx * ring.r;
          const pz = Math.cos(a) * rz * ring.r + rz * ring.zBias;
          if (pz > rz * 0.14) continue; // strictly behind forehead hairline
          if (ring.backOnly && pz > -rz * 0.05) continue;
          const puff = new THREE.Mesh(puffGeo, hairMat);
          puff.position.set(cx + px, cy + ry * ring.y, cz + pz);
          const s = 0.82 + 0.22 * Math.sin(i * 2.7 + ring.y * 5);
          puff.scale.set(s, s * 0.92, s);
          puff.castShadow = true;
          group.add(puff);
        }
      }

      // Warm brass hoop earrings
      const hoopGeo = new THREE.TorusGeometry(rx * 0.16, rx * 0.022, 8, 18);
      const brassMat = new THREE.MeshStandardMaterial({ color: palette.accentHex, roughness: 0.3, metalness: 0.82 });
      disposables.push(hoopGeo, brassMat);
      for (const side of [-1, 1]) {
        const hoop = new THREE.Mesh(hoopGeo, brassMat);
        hoop.position.set(cx + side * rx * 1.02, cy - ry * 0.18, cz - rz * 0.06);
        hoop.rotation.y = Math.PI * 0.5;
        group.add(hoop);
      }
    } else if (archKey === 'child7') {
      // June: Fitted skull hair cap + short twisted Ethiopian locs behind hairline
      const capGeo = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56);
      disposables.push(capGeo);
      const cap = new THREE.Mesh(capGeo, hairMat);
      cap.position.set(cx, cy + ry * 0.24, cz - rz * 0.22);
      cap.scale.set(rx * 1.02, ry * 0.92, rz * 0.98);
      cap.castShadow = true;
      group.add(cap);

      const locGeo = new THREE.CapsuleGeometry(rx * 0.095, rx * 0.36, 4, 7);
      disposables.push(locGeo);
      const locGroup = new THREE.Group();
      locGroup.name = 'm2m_spring_locs';
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const isFront = Math.cos(ang) > 0.35;
        if (isFront) continue; // keep forehead clear
        const elev = 0.42 + 0.36 * ((i % 3) / 2);
        const loc = new THREE.Mesh(locGeo, hairMat);
        const lx = Math.sin(ang) * rx * 0.96;
        const lz = Math.cos(ang) * rz * 0.92 - rz * 0.24;
        loc.position.set(cx + lx, cy + ry * elev, cz + lz);
        loc.rotation.z = -Math.sin(ang) * 0.72;
        loc.rotation.x = Math.cos(ang) * 0.65;
        loc.castShadow = true;
        locGroup.add(loc);
      }
      group.add(locGroup);
    } else if (archKey === 'adult_m') {
      // Elder (Adult M): Coiled highland cloth turban seated cleanly above brow + sculpted chin beard
      const turbanTex = makeWeaveTexture(THREE, {
        baseHex: palette.turbanHex,
        accentHex: palette.accentHex,
        mode: 'weave',
        repX: 4,
        repY: 2,
      });
      const turbanMat = new THREE.MeshStandardMaterial({
        map: turbanTex,
        roughness: 0.84,
        metalness: 0.0,
      });
      disposables.push(turbanTex, turbanMat);

      const crownGeo = new THREE.SphereGeometry(1, 16, 12);
      const coilGeo = new THREE.TorusGeometry(rx * 0.98, rx * 0.20, 10, 24);
      disposables.push(crownGeo, coilGeo);

      const dome = new THREE.Mesh(crownGeo, turbanMat);
      dome.position.set(cx, cy + ry * 0.68, cz - rz * 0.14);
      dome.scale.set(rx * 1.12, ry * 0.64, rz * 1.12);
      dome.castShadow = true;
      group.add(dome);

      for (let k = 0; k < 3; k++) {
        const coil = new THREE.Mesh(coilGeo, turbanMat);
        coil.position.set(cx, cy + ry * (0.56 + k * 0.18), cz - rz * 0.12);
        coil.rotation.x = Math.PI * 0.5 + (k === 1 ? 0.12 : -0.08);
        coil.rotation.y = k * 0.35;
        coil.scale.set(1.04 - k * 0.05, 1.08 - k * 0.04, 1.0);
        coil.castShadow = true;
        group.add(coil);
      }

      // Sculpted chin & jaw beard seated below lips
      const beardGeo = new THREE.SphereGeometry(1, 14, 10);
      disposables.push(beardGeo);
      const beard = new THREE.Mesh(beardGeo, hairMat);
      beard.position.set(cx, cy - ry * 0.72, cz + rz * 0.36);
      beard.scale.set(rx * 0.62, ry * 0.42, rz * 0.52);
      beard.castShadow = true;
      group.add(beard);
    } else {
      // Makeda (Elder): Draped Ethiopian cloth headwrap (shash) seated above forehead + small gold studs
      const shashTex = makeWeaveTexture(THREE, {
        baseHex: palette.shashHex,
        stripeHex: palette.tunicHex,
        accentHex: palette.accentHex,
        mode: 'tibeb',
        repX: 2,
        repY: 1,
      });
      const shashMat = new THREE.MeshStandardMaterial({
        map: shashTex,
        roughness: 0.82,
        metalness: 0.0,
      });
      disposables.push(shashTex, shashMat);

      const wrapGeo = new THREE.SphereGeometry(1, 16, 12);
      const bandGeo = new THREE.TorusGeometry(rx * 0.98, rx * 0.17, 10, 24);
      const knotGeo = new THREE.SphereGeometry(rx * 0.38, 12, 10);
      disposables.push(wrapGeo, bandGeo, knotGeo);

      const wrap = new THREE.Mesh(wrapGeo, shashMat);
      wrap.position.set(cx, cy + ry * 0.50, cz - rz * 0.24);
      wrap.scale.set(rx * 1.08, ry * 0.84, rz * 1.06);
      wrap.castShadow = true;
      group.add(wrap);

      const band = new THREE.Mesh(bandGeo, shashMat);
      band.position.set(cx, cy + ry * 0.52, cz - rz * 0.16);
      band.rotation.x = Math.PI * 0.46;
      band.scale.set(1.02, 1.06, 1.0);
      group.add(band);

      const bun = new THREE.Mesh(knotGeo, shashMat);
      bun.position.set(cx, cy + ry * 0.36, cz - rz * 1.12);
      bun.scale.set(1.12, 0.92, 1.02);
      bun.castShadow = true;
      group.add(bun);

      const studGeo = new THREE.SphereGeometry(rx * 0.08, 8, 8);
      const goldMat = new THREE.MeshStandardMaterial({ color: palette.accentHex, roughness: 0.28, metalness: 0.85 });
      disposables.push(studGeo, goldMat);
      for (const side of [-1, 1]) {
        const stud = new THREE.Mesh(studGeo, goldMat);
        stud.position.set(cx + side * rx * 1.0, cy - ry * 0.18, cz - rz * 0.04);
        group.add(stud);
      }
    }

    headBone.add(group);
    return group;
  }

  /**
   * Dress any loaded Anny CC0 `.glb` figure with rich East African melanin skin,
   * zero-clipping skinned layered Ethiopian garments, and 3D head groom.
   *
   * @param {Object} THREE - Three.js module
   * @param {THREE.Object3D} annyRoot - Loaded Anny GLTF scene root
   * @param {string} archetype - 'adult_f' | 'child7' | 'adult_m' | 'elder'
   * @param {Object} [opts] - { clothed: true }
   */
  function dressAnnyCharacter(THREE, annyRoot, archetype, opts) {
    const options = Object.assign({ clothed: true }, opts || {});
    const archKey = ARCHETYPES[archetype] ? archetype : 'adult_f';
    const palette = ARCHETYPES[archKey];

    // Find Anny's primary SkinnedMesh and bones
    let bodyMesh = null;
    const bonesByNorm = new Map();
    annyRoot.traverse((o) => {
      if (o.isSkinnedMesh && !bodyMesh) bodyMesh = o;
      if (o.isBone) bonesByNorm.set(normName(o.name), o);
    });
    if (!bodyMesh || !bodyMesh.skeleton) {
      return {
        archetype: archKey,
        isClothed: () => false,
        setClothed: () => {},
        update: () => {},
        dispose: () => {},
      };
    }

    const disposables = [];
    const garmentMeshes = [];
    const attachedObjects = [];
    const springNodes = [];

    // Analyze body geometry in bind pose once
    const pos = bodyMesh.geometry.attributes.position;
    const si = bodyMesh.geometry.attributes.skinIndex;
    const sw = bodyMesh.geometry.attributes.skinWeight;
    const skeletonBones = bodyMesh.skeleton.bones;
    const boneRegion = skeletonBones.map((b) => classifyAnnyBoneName(b.name));

    let minY = Infinity, maxY = -Infinity;
    let torsoZSum = 0, torsoZCount = 0;
    const vRegion = new Array(pos.count);

    for (let v = 0; v < pos.count; v++) {
      const vy = pos.getY(v);
      const vz = pos.getZ(v);
      if (vy < minY) minY = vy;
      if (vy > maxY) maxY = vy;

      // Dominant bone region for vertex
      const weights = [sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v)];
      const indices = [si.getX(v), si.getY(v), si.getZ(v), si.getW(v)];
      let bestK = 0;
      for (let k = 1; k < 4; k++) if (weights[k] > weights[bestK]) bestK = k;
      const reg = boneRegion[indices[bestK]] || 'torso';
      vRegion[v] = reg;

      if (reg === 'torso' || reg === 'pelvis') {
        torsoZSum += vz;
        torsoZCount++;
      }
    }
    const height = Math.max(0.5, maxY - minY);
    const centerZ = torsoZCount > 0 ? torsoZSum / torsoZCount : 0.02;
    const bodyData = { minY, maxY, height, centerZ, vRegion };

    // Rich East African melanin PBR skin material + base clay fallback material
    const clayMat = new THREE.MeshStandardMaterial({
      color: 0xd6b497,
      roughness: 0.62,
      metalness: 0.05,
    });
    const melaninMat = new THREE.MeshPhysicalMaterial({
      color: palette.skinHex,
      roughness: 0.56,
      metalness: 0.0,
      sheen: 0.34,
      sheenRoughness: 0.64,
      sheenColor: new THREE.Color(palette.sheenHex),
      clearcoat: 0.06,
      clearcoatRoughness: 0.52,
    });
    disposables.push(clayMat, melaninMat);

    // Helper to create a fabric MeshPhysicalMaterial with procedural weave
    const makeClothMat = (cfg) => {
      const tex = makeWeaveTexture(THREE, cfg);
      const mat = new THREE.MeshPhysicalMaterial({
        map: tex,
        roughness: cfg.roughness !== undefined ? cfg.roughness : 0.86,
        metalness: cfg.metalness || 0.0,
        sheen: cfg.sheen !== undefined ? cfg.sheen : 0.42,
        sheenRoughness: 0.78,
        sheenColor: new THREE.Color(cfg.sheenHex || 0xd8cfc2),
        side: cfg.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      });
      disposables.push(tex, mat);
      return mat;
    };

    const parentObj = bodyMesh.parent || annyRoot;
    const addShell = (spec) => {
      const mesh = extractSkinnedGarmentShell(THREE, bodyMesh, bodyData, spec);
      if (!mesh) return null;
      parentObj.add(mesh);
      garmentMeshes.push(mesh);
      disposables.push(mesh.geometry);
      return mesh;
    };

    // Archetype-specific layered Ethiopian garments
    if (archKey === 'adult_f') {
      // 1. Scoop-neck inner tunic
      const tunicMat = makeClothMat({ baseHex: palette.tunicHex, mode: 'weave', repX: 4, repY: 4, roughness: 0.85 });
      addShell({
        name: 'imani_inner_tunic',
        material: tunicMat,
        planarUv: true,
        uvMinY: 0.48,
        uvMaxY: 0.82,
        offset: 0.0085,
        predicate: (x, y, z, yN, zR, reg) => {
          if (reg !== 'torso' && reg !== 'pelvis') return false;
          if (yN < 0.48 || yN > 0.815) return false;
          // Scoop neckline opening at front chest
          if (zR > 0.01 && yN > 0.745 && Math.abs(x) < 0.075 * (height / 1.6)) return false;
          return true;
        },
      });

      // 2. Loose cargo trousers
      const trouserMat = makeClothMat({ baseHex: palette.trouserHex, mode: 'twill', repX: 4, repY: 5, roughness: 0.88 });
      addShell({
        name: 'imani_cargo_trousers',
        material: trouserMat,
        planarUv: true,
        uvMinY: 0.08,
        uvMaxY: 0.58,
        offset: (x, y, z, yN) => 0.013 + (yN < 0.36 ? 0.0045 : 0.0),
        predicate: (x, y, z, yN, zR, reg) => {
          if (reg === 'pelvis' || reg === 'upperleg' || reg === 'lowerleg') {
            return yN >= 0.085 && yN <= 0.585;
          }
          return false;
        },
      });

      // 3. Open-front duster coat (torso + sleeves + flared lower skirt)
      const coatMat = makeClothMat({
        baseHex: palette.coatHex,
        mode: 'weave',
        repX: 5,
        repY: 5,
        roughness: 0.88,
        sheen: 0.5,
        sheenHex: 0x556072,
        doubleSide: true,
      });
      addShell({
        name: 'imani_duster_coat',
        material: coatMat,
        planarUv: true,
        uvMinY: 0.30,
        uvMaxY: 0.83,
        offset: (x, y, z, yN, zR, reg) => {
          if (reg === 'upperarm' || reg === 'lowerarm') return 0.015;
          // Slight hem flare below waist
          const flare = yN < 0.54 ? (0.54 - yN) * 0.065 : 0;
          return 0.019 + flare;
        },
        predicate: (x, y, z, yN, zR, reg) => {
          if (reg === 'upperarm' || reg === 'lowerarm') return yN > 0.48;
          if (reg === 'torso' || reg === 'pelvis' || reg === 'upperleg') {
            if (yN < 0.31 || yN > 0.82) return false;
            // Open front lapel placket so inner tunic & belt show cleanly
            if (zR > 0.015 && Math.abs(x) < 0.058 * (height / 1.6)) return false;
            return true;
          }
          return false;
        },
      });

      // 4. Buckled leather belt (skinned band + brass buckle on spine04/root)
      const beltMat = makeClothMat({ baseHex: palette.beltHex, mode: 'leather', repX: 4, repY: 1, roughness: 0.48, sheen: 0.15 });
      addShell({
        name: 'imani_leather_belt',
        material: beltMat,
        offset: 0.017,
        predicate: (x, y, z, yN, zR, reg) => (reg === 'torso' || reg === 'pelvis') && yN >= 0.555 && yN <= 0.588,
      });

      const waistBone = bonesByNorm.get('spine04') || bonesByNorm.get('spine05') || bonesByNorm.get('root');
      if (waistBone) {
        const buckleGroup = new THREE.Group();
        const brassMat = new THREE.MeshStandardMaterial({ color: palette.accentHex, roughness: 0.32, metalness: 0.82 });
        const bGeo = new THREE.BoxGeometry(0.052, 0.036, 0.014);
        disposables.push(brassMat, bGeo);
        const buckle = new THREE.Mesh(bGeo, brassMat);
        buckle.position.set(0, 0.0, 0.115 * (height / 1.6));
        buckleGroup.add(buckle);
        waistBone.add(buckleGroup);
        attachedObjects.push(buckleGroup);
      }

      // 5. Laced boots
      const bootMat = makeClothMat({ baseHex: palette.bootHex, mode: 'leather', repX: 3, repY: 3, roughness: 0.44, sheen: 0.12 });
      addShell({
        name: 'imani_laced_boots',
        material: bootMat,
        offset: 0.0115,
        predicate: (x, y, z, yN, zR, reg) => reg === 'foot' || (reg === 'lowerleg' && yN < 0.135),
      });
    } else if (archKey === 'child7') {
      // June: Knit side-slit tunic + patched trousers + ankle boots
      const tunicMat = makeClothMat({
        baseHex: palette.tunicHex,
        accentHex: palette.tunicAccentHex,
        mode: 'knit',
        repX: 4,
        repY: 3,
        roughness: 0.90,
        doubleSide: true,
      });
      addShell({
        name: 'june_knit_tunic',
        material: tunicMat,
        planarUv: true,
        uvMinY: 0.42,
        uvMaxY: 0.81,
        offset: (x, y, z, yN) => 0.011 + (yN < 0.52 ? (0.52 - yN) * 0.045 : 0),
        predicate: (x, y, z, yN, zR, reg) => {
          if (reg === 'upperarm') return yN > 0.55;
          if (reg === 'torso' || reg === 'pelvis' || reg === 'upperleg') {
            if (yN < 0.43 || yN > 0.81) return false;
            // Side slits at hem
            if (yN < 0.50 && Math.abs(zR) < 0.022 && Math.abs(x) > 0.06 * (height / 1.15)) return false;
            return true;
          }
          return false;
        },
      });

      const trouserMat = makeClothMat({ baseHex: palette.trouserHex, mode: 'twill', repX: 3, repY: 4, roughness: 0.88 });
      addShell({
        name: 'june_patched_trousers',
        material: trouserMat,
        planarUv: true,
        uvMinY: 0.08,
        uvMaxY: 0.56,
        offset: 0.010,
        predicate: (x, y, z, yN, zR, reg) => (reg === 'pelvis' || reg === 'upperleg' || reg === 'lowerleg') && yN >= 0.085 && yN <= 0.56,
      });

      const bootMat = makeClothMat({ baseHex: palette.bootHex, mode: 'leather', repX: 2, repY: 2, roughness: 0.48 });
      addShell({
        name: 'june_ankle_boots',
        material: bootMat,
        offset: 0.009,
        predicate: (x, y, z, yN, zR, reg) => reg === 'foot' || (reg === 'lowerleg' && yN < 0.125),
      });
    } else {
      // adult_m (Elder) & elder (Makeda): Layered tunic (offset > trousers!) + diagonally draped shamma/gabi wrap + trousers + boots
      const tunicMat = makeClothMat({ baseHex: palette.tunicHex, mode: 'weave', repX: 4, repY: 4, roughness: 0.86, doubleSide: true });
      addShell({
        name: `${archKey}_tunic`,
        material: tunicMat,
        planarUv: true,
        uvMinY: 0.44,
        uvMaxY: 0.82,
        offset: (x, y, z, yN) => 0.017 + (yN < 0.56 ? (0.56 - yN) * 0.04 : 0),
        predicate: (x, y, z, yN, zR, reg) => {
          if (reg === 'upperarm' || reg === 'lowerarm') return yN > 0.52;
          if (reg === 'torso' || reg === 'pelvis') {
            return yN >= (archKey === 'elder' ? 0.44 : 0.48) && yN <= 0.82;
          }
          return false;
        },
      });

      const trouserMat = makeClothMat({ baseHex: palette.trouserHex, mode: 'twill', repX: 4, repY: 4, roughness: 0.88 });
      addShell({
        name: `${archKey}_trousers`,
        material: trouserMat,
        offset: 0.011,
        predicate: (x, y, z, yN, zR, reg) => (reg === 'pelvis' || reg === 'upperleg' || reg === 'lowerleg') && yN >= 0.08 && yN <= 0.57,
      });

      // Diagonally draped Ethiopian shamma / gabi wrap with woven tibeb border stripe
      const shammaMat = makeClothMat({
        baseHex: palette.shammaHex,
        stripeHex: archKey === 'elder' ? 0x2c3c5a : 0x264a32,
        accentHex: palette.accentHex,
        mode: 'tibeb',
        repX: 2,
        repY: 1,
        roughness: 0.84,
        sheen: 0.55,
        sheenHex: 0xf4eee4,
        doubleSide: true,
      });
      addShell({
        name: `${archKey}_shamma_wrap`,
        material: shammaMat,
        planarUv: true,
        uvMinY: 0.46,
        uvMaxY: 0.83,
        offset: (x, y, z, yN) => 0.025 + (yN < 0.58 ? (0.58 - yN) * 0.045 : 0),
        predicate: (x, y, z, yN, zR, reg) => {
          if (reg !== 'torso' && reg !== 'pelvis' && reg !== 'upperarm') return false;
          if (yN < 0.48 || yN > 0.83) return false;
          // Diagonal drape from left shoulder (+X, high Y) down across torso to right hip (-X, mid Y)
          const xNorm = x / (0.24 * (height / 1.6));
          const diagLow = 0.56 + xNorm * 0.09;
          const diagHigh = 0.85 + xNorm * 0.07;
          if (reg === 'upperarm') return x > 0.04 && yN > 0.66;
          return yN >= diagLow && yN <= diagHigh;
        },
      });

      // Hanging shamma shoulder tail with spring sway attached to spine01/clavicle.L
      const shBone = bonesByNorm.get('spine01') || bonesByNorm.get('claviclel');
      if (shBone) {
        const tailPivot = new THREE.Group();
        tailPivot.name = `${archKey}_shamma_tail_pivot`;
        tailPivot.position.set(0.11 * (height / 1.6), 0.04 * (height / 1.6), -0.10 * (height / 1.6));
        const tailGeo = new THREE.PlaneGeometry(0.22 * (height / 1.6), 0.46 * (height / 1.6), 4, 8);
        // Curve gently around shoulder back
        const tp = tailGeo.attributes.position;
        for (let i = 0; i < tp.count; i++) {
          const px = tp.getX(i);
          const py = tp.getY(i);
          tp.setY(i, py - 0.23 * (height / 1.6));
          tp.setZ(i, -Math.abs(px) * 0.18 - 0.02);
        }
        tailGeo.computeVertexNormals();
        const tailMesh = new THREE.Mesh(tailGeo, shammaMat);
        tailMesh.castShadow = true;
        tailPivot.add(tailMesh);
        shBone.add(tailPivot);
        attachedObjects.push(tailPivot);
        springNodes.push({ node: tailPivot, baseRotX: 0.08, baseRotZ: 0.06, velX: 0, velZ: 0, curX: 0.08, curZ: 0.06 });
        disposables.push(tailGeo);
      }

      const bootMat = makeClothMat({ baseHex: palette.bootHex, mode: 'leather', repX: 3, repY: 3, roughness: 0.45 });
      addShell({
        name: `${archKey}_boots`,
        material: bootMat,
        offset: 0.011,
        predicate: (x, y, z, yN, zR, reg) => reg === 'foot' || (reg === 'lowerleg' && yN < 0.13),
      });
    }

    // Build head-mounted 3D groom & natural eyes/brows in head bone local space
    const headBone = bonesByNorm.get('head');
    if (headBone) {
      annyRoot.updateMatrixWorld(true);
      const invHead = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
      const tmp = new THREE.Vector3();
      let hMinX = Infinity, hMaxX = -Infinity;
      let hMinY = Infinity, hMaxY = -Infinity;
      let hMinZ = Infinity, hMaxZ = -Infinity;
      let hCount = 0;

      for (let v = 0; v < pos.count; v++) {
        if (vRegion[v] !== 'head') continue;
        const vy = pos.getY(v);
        if ((vy - minY) / height < 0.855) continue; // exclude lower neck
        tmp.set(pos.getX(v), vy, pos.getZ(v)).applyMatrix4(bodyMesh.matrixWorld).applyMatrix4(invHead);
        if (tmp.x < hMinX) hMinX = tmp.x;
        if (tmp.x > hMaxX) hMaxX = tmp.x;
        if (tmp.y < hMinY) hMinY = tmp.y;
        if (tmp.y > hMaxY) hMaxY = tmp.y;
        if (tmp.z < hMinZ) hMinZ = tmp.z;
        if (tmp.z > hMaxZ) hMaxZ = tmp.z;
        hCount++;
      }

      const headMetrics = hCount > 16
        ? {
            cx: (hMinX + hMaxX) * 0.5,
            cy: (hMinY + hMaxY) * 0.5,
            cz: (hMinZ + hMaxZ) * 0.5,
            rx: (hMaxX - hMinX) * 0.5,
            ry: (hMaxY - hMinY) * 0.5,
            rz: (hMaxZ - hMinZ) * 0.5,
          }
        : { cx: 0, cy: 0.09, cz: 0.01, rx: 0.08, ry: 0.105, rz: 0.095 };

      const groomGroup = buildHeadGroom(THREE, headBone, headMetrics, archKey, palette, disposables);
      attachedObjects.push(groomGroup);
    }

    let clothed = !!options.clothed;
    let swayPhase = 0;
    const prevRootPos = new THREE.Vector3();
    const curRootPos = new THREE.Vector3();
    let hasPrevPos = false;

    function applyClothedState() {
      bodyMesh.material = clothed ? melaninMat : clayMat;
      for (const m of garmentMeshes) m.visible = clothed;
      for (const a of attachedObjects) a.visible = clothed;
    }

    applyClothedState();

    function setClothed(flag) {
      clothed = !!flag;
      applyClothedState();
      return clothed;
    }

    function update(dt) {
      if (!clothed || !springNodes.length || !(dt > 0)) return;
      const step = Math.min(0.05, dt);
      swayPhase += step;
      const rootBone = bonesByNorm.get('root') || annyRoot;
      rootBone.getWorldPosition(curRootPos);
      let vx = 0, vz = 0;
      if (hasPrevPos) {
        vx = clamp((curRootPos.x - prevRootPos.x) / step, -2.5, 2.5);
        vz = clamp((curRootPos.z - prevRootPos.z) / step, -2.5, 2.5);
      }
      prevRootPos.copy(curRootPos);
      hasPrevPos = true;

      for (const sp of springNodes) {
        const targetX = sp.baseRotX + 0.04 * Math.sin(swayPhase * 2.1) + clamp(-vz * 0.12, -0.25, 0.25);
        const targetZ = sp.baseRotZ + 0.03 * Math.cos(swayPhase * 1.7) + clamp(vx * 0.10, -0.22, 0.22);
        const k = 28.0, damp = 7.5;
        sp.velX += ((targetX - sp.curX) * k - sp.velX * damp) * step;
        sp.velZ += ((targetZ - sp.curZ) * k - sp.velZ * damp) * step;
        sp.curX = clamp(sp.curX + sp.velX * step, -0.35, 0.45);
        sp.curZ = clamp(sp.curZ + sp.velZ * step, -0.35, 0.35);
        sp.node.rotation.x = sp.curX;
        sp.node.rotation.z = sp.curZ;
      }
    }

    function dispose() {
      for (const m of garmentMeshes) {
        if (m.parent) m.parent.remove(m);
      }
      for (const a of attachedObjects) {
        if (a.parent) a.parent.remove(a);
      }
      for (const d of disposables) {
        if (d && typeof d.dispose === 'function') d.dispose();
      }
      garmentMeshes.length = 0;
      attachedObjects.length = 0;
      disposables.length = 0;
    }

    return {
      archetype: archKey,
      palette,
      garmentMeshes,
      attachedObjects,
      isClothed: () => clothed,
      setClothed,
      update,
      dispose,
    };
  }

  // ---------------------------------------------------------------------------
  // Part B — In-World Scion Cast Performance Driver (`createWorldCastDriver`)
  // ---------------------------------------------------------------------------

  const SOURCE_ALIAS_TO_SCION = Object.freeze({
    pelvis: B.PELVIS, hips: B.PELVIS, hip: B.PELVIS,
    spine01: B.LUMBAR, spine: B.LUMBAR,
    spine02: B.THORAX, spine1: B.THORAX,
    spine03: B.CHEST, spine2: B.CHEST, chest: B.CHEST, upperchest: B.CHEST,
    neck01: B.NECK_LOW, neck: B.NECK_LOW, neck1: B.NECK_LOW,
    head: B.HEAD,
    claviclel: B.CLAV_L, leftshoulder: B.CLAV_L, shoulderl: B.CLAV_L,
    upperarml: B.UARM_L, leftupperarm: B.UARM_L, leftarm: B.UARM_L,
    lowerarml: B.FARM_L, leftlowerarm: B.FARM_L, leftforearm: B.FARM_L,
    handl: B.HAND_L, lefthand: B.HAND_L,
    clavicler: B.CLAV_R, rightshoulder: B.CLAV_R, shoulderr: B.CLAV_R,
    upperarmr: B.UARM_R, rightupperarm: B.UARM_R, rightarm: B.UARM_R,
    lowerarmr: B.FARM_R, rightlowerarm: B.FARM_R, rightforearm: B.FARM_R,
    handr: B.HAND_R, righthand: B.HAND_R,
    thighl: B.ULEG_L, leftupperleg: B.ULEG_L, leftupleg: B.ULEG_L,
    calfl: B.LLEG_L, leftlowerleg: B.LLEG_L, leftleg: B.LLEG_L,
    footl: B.FOOT_L, leftfoot: B.FOOT_L,
    balll: B.TOE_L, lefttoebase: B.TOE_L, lefttoe: B.TOE_L,
    thighr: B.ULEG_R, rightupperleg: B.ULEG_R, rightupleg: B.ULEG_R,
    calfr: B.LLEG_R, rightlowerleg: B.LLEG_R, rightleg: B.LLEG_R,
    footr: B.FOOT_R, rightfoot: B.FOOT_R,
    ballr: B.TOE_R, righttoebase: B.TOE_R, righttoe: B.TOE_R,
  });

  function resolveScionBoneIndex(srcBoneName) {
    const clean = String(srcBoneName || '').replace(/^.*[:|]/, '');
    if (SCION_BONE_MAP[clean] !== undefined) return SCION_BONE_MAP[clean];
    const n = normName(clean);
    return SOURCE_ALIAS_TO_SCION[n] !== undefined ? SOURCE_ALIAS_TO_SCION[n] : -1;
  }

  function collectSourceRestIndex(sourceRoot) {
    const nodes = new Map();
    sourceRoot.updateMatrixWorld(true);
    sourceRoot.traverse((obj) => {
      if (!obj.name) return;
      const p = obj.position;
      const q = obj.quaternion;
      const wp = [0, 0, 0];
      const wq = [0, 0, 0, 1];
      if (obj.matrixWorld && obj.matrixWorld.elements) {
        const e = obj.matrixWorld.elements;
        wp[0] = e[12]; wp[1] = e[13]; wp[2] = e[14];
        // Extract world quaternion via parent chain
      }
      nodes.set(obj.name, {
        name: obj.name,
        parentName: obj.parent && obj.parent.name ? obj.parent.name : null,
        localP: [p.x, p.y, p.z],
        localQ: qNormalize([q.x, q.y, q.z, q.w]),
        worldP: wp,
        worldQ: wq,
      });
    });

    // Compute exact worldQ by traversing up parent chain
    const resolved = new Set();
    function resolveWorld(name) {
      if (resolved.has(name)) return;
      const entry = nodes.get(name);
      if (!entry) return;
      if (entry.parentName && nodes.has(entry.parentName)) {
        resolveWorld(entry.parentName);
        const par = nodes.get(entry.parentName);
        entry.worldQ = qNormalize(qMul(par.worldQ, entry.localQ));
      } else {
        entry.worldQ = entry.localQ.slice();
      }
      resolved.add(name);
    }
    nodes.forEach((_, nm) => resolveWorld(nm));
    return nodes;
  }

  function sampleTrackQuat(track, t) {
    const times = track.times;
    const vals = track.values;
    const n = times.length;
    if (n === 0) return [0, 0, 0, 1];
    if (t <= times[0] || n === 1) return [vals[0], vals[1], vals[2], vals[3]];
    if (t >= times[n - 1]) {
      const o = (n - 1) * 4;
      return [vals[o], vals[o + 1], vals[o + 2], vals[o + 3]];
    }
    let lo = 0, hi = n - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= t) lo = mid;
      else hi = mid;
    }
    const span = Math.max(1e-6, times[hi] - times[lo]);
    const alpha = (t - times[lo]) / span;
    const o0 = lo * 4, o1 = hi * 4;
    return qSlerpArr(
      [vals[o0], vals[o0 + 1], vals[o0 + 2], vals[o0 + 3]],
      [vals[o1], vals[o1 + 1], vals[o1 + 2], vals[o1 + 3]],
      alpha
    );
  }

  /**
   * Retarget a Mesh2Motion AnimationClip directly into a compact, zero-GC Scion 65-bone
   * track table (`{ duration, quatTracks: Map<boneIdx, {times, values}>, pelvisY: {times, values} }`).
   * All HumanSculptV3 bones have identity rest quaternion `(0,0,0,1)` and vertical `-Y` limbs.
   */
  function retargetClipToScion(sourceClip, sourceRoot, clipName) {
    const srcNodes = collectSourceRestIndex(sourceRoot);
    const srcQuatTracks = new Map();
    let rootPosTrack = null;
    let rootSrcName = null;

    for (const tr of sourceClip.tracks) {
      const dot = tr.name.lastIndexOf('.');
      if (dot < 0) continue;
      const boneName = tr.name.slice(0, dot);
      const prop = tr.name.slice(dot + 1);
      if (prop === 'quaternion') {
        srcQuatTracks.set(boneName, tr);
      } else if (prop === 'position' && !rootPosTrack) {
        const n = normName(boneName);
        if (n === 'pelvis' || n === 'hips' || n === 'hip') {
          rootPosTrack = tr;
          rootSrcName = boneName;
        }
      }
    }

    // Compute exact T-pose -> straight-down (-Y) arm alignment for HumanSculptV3 upper arms
    const armAlignByScionIdx = new Map();
    const armSpecs = [
      { src: 'upperarm_l', child: 'lowerarm_l', scionIdx: B.UARM_L, tgtDir: [0, -1, 0] },
      { src: 'upperarm_r', child: 'lowerarm_r', scionIdx: B.UARM_R, tgtDir: [0, -1, 0] },
    ];
    for (const as of armSpecs) {
      let sEntry = srcNodes.get(as.src);
      let cEntry = srcNodes.get(as.child);
      if (!sEntry || !cEntry) {
        srcNodes.forEach((v, k) => {
          const nk = normName(k);
          if (!sEntry && (nk === normName(as.src) || nk === (as.scionIdx === B.UARM_L ? 'leftupperarm' : 'rightupperarm'))) sEntry = v;
          if (!cEntry && (nk === normName(as.child) || nk === (as.scionIdx === B.UARM_L ? 'leftlowerarm' : 'rightlowerarm'))) cEntry = v;
        });
      }
      if (sEntry && cEntry) {
        const srcDir = vNorm(vSub(cEntry.worldP, sEntry.worldP));
        // Rotate target straight-down (-Y) vector onto source T-pose vector
        const qAlign = qFromUnitVectors(as.tgtDir, srcDir);
        armAlignByScionIdx.set(as.scionIdx, qAlign);
      }
    }

    // Map source bone -> scion bone index
    const scionToSrc = new Map();
    srcQuatTracks.forEach((tr, srcBone) => {
      const idx = resolveScionBoneIndex(srcBone);
      if (idx >= 0 && !scionToSrc.has(idx)) {
        scionToSrc.set(idx, { srcBone, track: tr });
      }
    });

    function evalSrcWorldQ(name, t, cache) {
      if (cache.has(name)) return cache.get(name);
      const entry = srcNodes.get(name);
      if (!entry) return [0, 0, 0, 1];
      const tr = srcQuatTracks.get(name);
      const localQ = tr ? sampleTrackQuat(tr, t) : entry.localQ;
      const parW = entry.parentName ? evalSrcWorldQ(entry.parentName, t, cache) : [0, 0, 0, 1];
      const wq = qNormalize(qMul(parW, localQ));
      cache.set(name, wq);
      return wq;
    }

    function evalScionWorldQ(scionIdx, t, srcCache, tgtCache) {
      if (tgtCache.has(scionIdx)) return tgtCache.get(scionIdx);
      const mapped = scionToSrc.get(scionIdx);
      let wq;
      if (mapped && srcNodes.has(mapped.srcBone)) {
        const srcEntry = srcNodes.get(mapped.srcBone);
        const srcAnimW = evalSrcWorldQ(mapped.srcBone, t, srcCache);
        // World delta: Q_delta = Q_src_anim_W * conj(Q_src_rest_W)
        const qDeltaW = qNormalize(qMul(srcAnimW, qConj(srcEntry.worldQ)));
        const qAlign = armAlignByScionIdx.get(scionIdx);
        // HumanSculptV3 rest worldQ is identity (0,0,0,1), so apply qAlign if arm bone
        wq = qAlign ? qNormalize(qMul(qDeltaW, qAlign)) : qDeltaW;
      } else {
        const parIdx = SCION_PARENTS[scionIdx];
        wq = parIdx >= 0 ? evalScionWorldQ(parIdx, t, srcCache, tgtCache) : [0, 0, 0, 1];
      }
      tgtCache.set(scionIdx, wq);
      return wq;
    }

    const quatTracks = new Map();
    scionToSrc.forEach(({ track }, scionIdx) => {
      const times = new Float32Array(track.times);
      const values = new Float32Array(times.length * 4);
      const parIdx = SCION_PARENTS[scionIdx];

      for (let k = 0; k < times.length; k++) {
        const t = times[k];
        const srcCache = new Map();
        const tgtCache = new Map();
        const targetW = evalScionWorldQ(scionIdx, t, srcCache, tgtCache);
        const parentW = parIdx >= 0 ? evalScionWorldQ(parIdx, t, srcCache, tgtCache) : [0, 0, 0, 1];
        const localQ = qNormalize(qMul(qConj(parentW), targetW));
        const o = k * 4;
        values[o] = localQ[0];
        values[o + 1] = localQ[1];
        values[o + 2] = localQ[2];
        values[o + 3] = localQ[3];
      }
      quatTracks.set(scionIdx, { times, values });
    });

    // Vertical hip bounce delta (normalized relative to source rest hip height ~0.917m)
    let pelvisY = null;
    if (rootPosTrack && rootSrcName && srcNodes.has(rootSrcName)) {
      const srcEntry = srcNodes.get(rootSrcName);
      const parEntry = srcEntry.parentName ? srcNodes.get(srcEntry.parentName) : null;
      const parW = parEntry ? parEntry.worldQ : [0, 0, 0, 1];
      const restY = srcEntry.worldP[1] || 0.917;
      const times = new Float32Array(rootPosTrack.times);
      const values = new Float32Array(times.length);
      const srcVals = rootPosTrack.values;
      for (let k = 0; k < times.length; k++) {
        const o = k * 3;
        const wPos = qRotateVec(parW, [srcVals[o], srcVals[o + 1], srcVals[o + 2]]);
        values[k] = clamp((wPos[1] - restY) / Math.max(0.2, restY), -0.35, 0.35);
      }
      pelvisY = { times, values };
    }

    return {
      name: clipName,
      duration: Math.max(0.05, sourceClip.duration || 1.0),
      quatTracks,
      pelvisY,
    };
  }

  function sampleScionQuatTrack(tr, t, outQ) {
    const times = tr.times;
    const vals = tr.values;
    const n = times.length;
    if (n === 0) { outQ.set(0, 0, 0, 1); return; }
    if (t <= times[0] || n === 1) {
      outQ.set(vals[0], vals[1], vals[2], vals[3]);
      return;
    }
    if (t >= times[n - 1]) {
      const o = (n - 1) * 4;
      outQ.set(vals[o], vals[o + 1], vals[o + 2], vals[o + 3]);
      return;
    }
    let lo = 0, hi = n - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= t) lo = mid;
      else hi = mid;
    }
    const alpha = (t - times[lo]) / Math.max(1e-6, times[hi] - times[lo]);
    const o0 = lo * 4, o1 = hi * 4;
    const s = qSlerpArr(
      [vals[o0], vals[o0 + 1], vals[o0 + 2], vals[o0 + 3]],
      [vals[o1], vals[o1 + 1], vals[o1 + 2], vals[o1 + 3]],
      alpha
    );
    outQ.set(s[0], s[1], s[2], s[3]);
  }

  function sampleScalarTrack(tr, t) {
    const times = tr.times;
    const vals = tr.values;
    const n = times.length;
    if (n === 0) return 0;
    if (t <= times[0] || n === 1) return vals[0];
    if (t >= times[n - 1]) return vals[n - 1];
    let lo = 0, hi = n - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= t) lo = mid;
      else hi = mid;
    }
    const alpha = (t - times[lo]) / Math.max(1e-6, times[hi] - times[lo]);
    return vals[lo] + (vals[hi] - vals[lo]) * alpha;
  }

  /**
   * Create an in-world Scion Cast Performance Driver that plays Mesh2Motion CC0 clips onto
   * any `donkey/characters.js` Scion character (`ch` with 65-bone `HumanSculptV3` rig).
   *
   * Call `driver.update(dt)` AFTER `ch.pose(...)` each frame so FACS facial expressions
   * (`HEAD`/`JAW`), ophthalmic eyes, and spring-bone coat/shamma/hair follow-through stay alive.
   */
  function createWorldCastDriver(THREE, opts) {
    const options = Object.assign(
      {
        clipsBaseUrl: '../motion-pipeline/mesh2motion/clips',
        loader: null,
        preload: null,
        defaultBlend: 0.85,
        defaultFade: 0.25,
        headBlendScale: 0.42,
        enablePelvisBounce: true,
        enableFingerCurl: true,
      },
      opts || {}
    );

    const clipCache = new Map();      // clipName -> retargeted Scion clip
    const loadingPromises = new Map(); // clipName -> Promise
    const actors = new Map();          // actorId -> actor state
    let resolvedLoaderPromise = null;

    // Pre-allocated scratch math objects (zero GC per frame)
    const _qA = new THREE.Quaternion();
    const _qB = new THREE.Quaternion();
    const _qFing = new THREE.Quaternion();
    const _eul = new THREE.Euler(0, 0, 0, 'XYZ');

    function resolveClipUrl(clipName) {
      const clean = String(clipName || 'idle').replace(/\.glb$/i, '');
      const base = String(options.clipsBaseUrl || '../motion-pipeline/mesh2motion/clips').replace(/\/+$/, '');
      return `${base}/${clean}.glb`;
    }

    async function ensureLoader() {
      if (options.loader) return options.loader;
      if (resolvedLoaderPromise) return resolvedLoaderPromise;
      resolvedLoaderPromise = (async () => {
        if (THREE && typeof THREE.GLTFLoader === 'function') {
          const l = new THREE.GLTFLoader();
          if (typeof window !== 'undefined' && window.MeshoptDecoder && l.setMeshoptDecoder) {
            l.setMeshoptDecoder(window.MeshoptDecoder);
          }
          return l;
        }
        // Dynamic ESM fallback for pages without a global GLTFLoader
        try {
          const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
            import('three/addons/loaders/GLTFLoader.js'),
            import('three/addons/libs/meshopt_decoder.module.js'),
          ]);
          const l = new GLTFLoader();
          l.setMeshoptDecoder(MeshoptDecoder);
          return l;
        } catch (_e) {
          const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
            import('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js'),
            import('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/meshopt_decoder.module.js'),
          ]);
          const l = new GLTFLoader();
          l.setMeshoptDecoder(MeshoptDecoder);
          return l;
        }
      })();
      return resolvedLoaderPromise;
    }

    async function loadScionClip(clipName) {
      if (clipCache.has(clipName)) return clipCache.get(clipName);
      if (loadingPromises.has(clipName)) return loadingPromises.get(clipName);

      const url = resolveClipUrl(clipName);
      const p = (async () => {
        try {
          let loaded = null;
          const loader = await ensureLoader();
          if (typeof window !== 'undefined' && window.Mesh2MotionAnny && window.Mesh2MotionAnny.loadClip) {
            loaded = await window.Mesh2MotionAnny.loadClip(url, { loader, THREE });
          } else {
            const gltf = await loader.loadAsync(url);
            loaded = { clip: gltf.animations[0], sourceRoot: gltf.scene };
          }
          if (!loaded || !loaded.clip || !loaded.sourceRoot) return null;
          const retargeted = retargetClipToScion(loaded.clip, loaded.sourceRoot, clipName);
          clipCache.set(clipName, retargeted);
          return retargeted;
        } catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(`[Mesh2MotionWorldBridge] Failed to load clip "${clipName}" (${url}):`, err);
          }
          return null;
        } finally {
          loadingPromises.delete(clipName);
        }
      })();

      loadingPromises.set(clipName, p);
      return p;
    }

    function preloadClips(clipNames) {
      const list = Array.isArray(clipNames) ? clipNames : ['idle', 'idle-talking', 'walk', 'walk-carry', 'jog', 'greeting'];
      return Promise.all(list.map((nm) => loadScionClip(nm)));
    }

    function registerActor(id, ch, cfg) {
      if (!ch || !ch.bones || ch.bones.length < 61) return null;
      const c = Object.assign(
        {
          defaultClip: 'idle',
          blend: options.defaultBlend,
          speed: 1.0,
          phaseOffset: Math.random() * 1.7,
        },
        cfg || {}
      );
      const actor = {
        id,
        ch,
        clipName: c.defaultClip,
        prevClipName: null,
        time: c.phaseOffset,
        prevTime: 0,
        fadeTime: 0,
        fadeDuration: 0,
        speed: c.speed,
        blend: clamp(c.blend, 0, 1),
        targetBlend: clamp(c.blend, 0, 1),
        carrying: false,
      };
      actors.set(id, actor);
      loadScionClip(c.defaultClip);
      return actor;
    }

    function unregisterActor(id) {
      actors.delete(id);
    }

    function setClip(id, clipName, cfg) {
      const actor = actors.get(id);
      if (!actor || !clipName) return;
      const c = cfg || {};
      if (typeof c.speed === 'number' && Number.isFinite(c.speed)) actor.speed = c.speed;
      if (typeof c.blend === 'number' && Number.isFinite(c.blend)) actor.targetBlend = clamp(c.blend, 0, 1);

      if (actor.clipName === clipName) return;
      const fade = typeof c.fade === 'number' ? Math.max(0, c.fade) : options.defaultFade;
      actor.prevClipName = actor.clipName;
      actor.prevTime = actor.time;
      actor.clipName = clipName;
      actor.time = 0;
      actor.fadeDuration = fade;
      actor.fadeTime = 0;
      loadScionClip(clipName);
    }

    // metres per second each clip's planted foot travels at playback rate 1 (measured in highland-exposure/motion-lab)
    const CLIP_GROUND_SPEED = { 'walk-happy': 1.14, walk: 0.76, 'walk-carry': 0.61, 'walk-relaxed': 0.85, jog: 3.9, 'walk-backwards': 0.85 };
    function setActorLocomotion(id, loco) {
      const actor = actors.get(id);
      if (!actor || !loco) return;
      const speedMps = Number(loco.speedMps) || 0;
      const carrying = !!loco.carrying;
      const talking = !!loco.talking;
      const dancing = loco.dancing;
      const greeting = !!loco.greeting;
      const sitting = !!loco.sitting;
      const crouching = !!loco.crouching;
      const working = loco.working;

      actor.carrying = carrying;
      let nextClip = 'idle';
      let nextSpeed = 1.0;

      if (greeting) {
        nextClip = 'greeting';
      } else if (dancing) {
        nextClip = dancing === 'simple' ? 'dance-simple' : 'dance-arm-pump';
      } else if (sitting) {
        nextClip = talking ? 'sitting-talking' : 'sitting-idle';
      } else if (crouching) {
        nextClip = speedMps > 0.2 ? 'crouch-walk' : 'crouch-idle';
      } else if (working) {
        nextClip = typeof working === 'string' ? working : 'hammering';
      } else if (loco.backwards && speedMps >= 0.16) {
        nextClip = 'walk-backwards';
        nextSpeed = clamp(speedMps / 0.85, 0.6, 1.5);
      } else if (speedMps >= (actor.clipName === 'jog' ? 2.0 : 2.4)) {
        // playback rate = speed / the ground speed each clip actually covers (measured from its planted foot), so feet do not
        // skate; a floor on cadence, because a jog played in slow motion reads as floating, not as a slower run.
        // Hysteresis on both gait changes stops the clip flickering when speed hovers at a threshold (slopes, turns).
        nextClip = 'jog';
        nextSpeed = clamp(speedMps / CLIP_GROUND_SPEED.jog, 0.82, 1.4);
      } else if (speedMps >= (/^walk/.test(actor.clipName || '') ? 0.12 : 0.22)) {
        nextClip = carrying ? 'walk-carry' : 'walk-happy';
        nextSpeed = clamp(speedMps / CLIP_GROUND_SPEED[nextClip], 0.55, 1.7);
      } else {
        nextClip = talking ? 'idle-talking' : 'idle';
      }

      const blend = typeof loco.blend === 'number' ? loco.blend : actor.targetBlend;
      const fade = typeof loco.fade === 'number' ? loco.fade : options.defaultFade;
      setClip(id, nextClip, { fade, speed: nextSpeed, blend });
    }

    /** Palmar-safe finger curl pose matching locomotion/carry state without hyperextension */
    function applyPalmarSafeFingers(bones, curlAmount, blend) {
      const c = clamp(curlAmount, 0, 1);
      const mcp = c * 0.48;
      const pip = c * 0.64;
      const dip = c * 0.42;

      for (const side of [1, -1]) {
        const base = side > 0 ? B.L_THUMB_1 : B.R_THUMB_1;
        // Thumb opposition inward toward palm
        _eul.set(0.08 * c, side * 0.18 * c, -side * 0.28 * c);
        _qFing.setFromEuler(_eul);
        if (bones[base]) bones[base].quaternion.slerp(_qFing, blend * 0.65);
        _eul.set(0, 0, -side * 0.34 * c);
        _qFing.setFromEuler(_eul);
        if (bones[base + 1]) bones[base + 1].quaternion.slerp(_qFing, blend * 0.65);
        if (bones[base + 2]) bones[base + 2].quaternion.slerp(_qFing, blend * 0.65);

        // 4 fingers: pure palmar curl around local Z (inward toward torso/palm)
        for (let f = 0; f < 4; f++) {
          const fb = base + 3 + f * 3;
          const fScale = 0.88 + f * 0.06;
          _eul.set(0, 0, -side * mcp * fScale);
          _qFing.setFromEuler(_eul);
          if (bones[fb]) bones[fb].quaternion.slerp(_qFing, blend * 0.7);
          _eul.set(0, 0, -side * pip * fScale);
          _qFing.setFromEuler(_eul);
          if (bones[fb + 1]) bones[fb + 1].quaternion.slerp(_qFing, blend * 0.7);
          _eul.set(0, 0, -side * dip * fScale);
          _qFing.setFromEuler(_eul);
          if (bones[fb + 2]) bones[fb + 2].quaternion.slerp(_qFing, blend * 0.7);
        }
      }
    }

    function update(dt) {
      const step = Math.min(0.05, Math.max(0, Number(dt) || 0));
      actors.forEach((actor) => {
        const clip = clipCache.get(actor.clipName);
        if (!clip) return;

        // Smooth blend ramp
        actor.blend += (actor.targetBlend - actor.blend) * Math.min(1, step * 8.0);
        if (actor.blend <= 0.001) return;

        actor.time = (actor.time + step * actor.speed) % clip.duration;
        let prevClip = null;
        let fadeAlpha = 1.0;

        if (actor.prevClipName && actor.fadeDuration > 0 && actor.fadeTime < actor.fadeDuration) {
          actor.fadeTime += step;
          fadeAlpha = clamp(actor.fadeTime / actor.fadeDuration, 0, 1);
          prevClip = clipCache.get(actor.prevClipName) || null;
          if (prevClip) {
            actor.prevTime = (actor.prevTime + step * actor.speed) % prevClip.duration;
          }
          if (fadeAlpha >= 1.0) {
            actor.prevClipName = null;
            prevClip = null;
          }
        }

        const bones = actor.ch.bones;
        const w = actor.blend;

        clip.quatTracks.forEach((track, boneIdx) => {
          const bone = bones[boneIdx];
          if (!bone) return;
          // Never touch JAW (FACS), COAT_B/L/R, HAIR_TAIL, or volume helpers
          if (boneIdx === B.JAW || boneIdx >= B.COAT_B) return;

          sampleScionQuatTrack(track, actor.time, _qA);
          if (prevClip && prevClip.quatTracks.has(boneIdx)) {
            sampleScionQuatTrack(prevClip.quatTracks.get(boneIdx), actor.prevTime, _qB);
            _qB.slerp(_qA, fadeAlpha);
            _qA.copy(_qB);
          }

          // Preserve FACS head tracking & gaze by using gentler blend on HEAD & NECK
          const boneWeight = boneIdx === B.HEAD || boneIdx === B.NECK_LOW
            ? w * options.headBlendScale
            : w;

          bone.quaternion.slerp(_qA, boneWeight);
        });

        // Subtle torso anti-clip clearance for upper arms (prevent inward chest penetration)
        const uL = bones[B.UARM_L];
        const uR = bones[B.UARM_R];
        if (uL) {
          _eul.setFromQuaternion(uL.quaternion, 'XYZ');
          if (_eul.z < -0.14) { _eul.z = -0.14; uL.quaternion.setFromEuler(_eul); }
        }
        if (uR) {
          _eul.setFromQuaternion(uR.quaternion, 'XYZ');
          if (_eul.z > 0.14) { _eul.z = 0.14; uR.quaternion.setFromEuler(_eul); }
        }

        // Scaled vertical pelvis bounce (preserving XZ world placement)
        if (options.enablePelvisBounce && clip.pelvisY && bones[B.PELVIS] && bones[B.PELVIS].userData && bones[B.PELVIS].userData.rest) {
          let dyNorm = sampleScalarTrack(clip.pelvisY, actor.time);
          if (prevClip && prevClip.pelvisY) {
            const pDy = sampleScalarTrack(prevClip.pelvisY, actor.prevTime);
            dyNorm = pDy + (dyNorm - pDy) * fadeAlpha;
          }
          const restY = bones[B.PELVIS].userData.rest.y;
          const targetY = restY + dyNorm * restY * 0.65;
          bones[B.PELVIS].position.y += (targetY - bones[B.PELVIS].position.y) * w;
        }

        // Palmar-safe finger curl (relaxed curve in idle/walk, firmer grip in carry/work)
        if (options.enableFingerCurl) {
          const curl = actor.carrying || actor.clipName === 'walk-carry' || actor.clipName === 'hammering' || actor.clipName === 'rope-pull'
            ? 0.72
            : 0.28;
          applyPalmarSafeFingers(bones, curl, w);
        }
      });
    }

    function getActorState(id) {
      const a = actors.get(id);
      if (!a) return null;
      return {
        id: a.id,
        clip: a.clipName,
        loaded: clipCache.has(a.clipName),
        blend: +a.blend.toFixed(3),
        speed: +a.speed.toFixed(3),
        time: +a.time.toFixed(3),
      };
    }

    function dispose() {
      actors.clear();
      clipCache.clear();
      loadingPromises.clear();
    }

    if (Array.isArray(options.preload) && options.preload.length) {
      preloadClips(options.preload);
    }

    return {
      registerActor,
      unregisterActor,
      setClip,
      setActorLocomotion,
      preloadClips,
      update,
      getActorState,
      getLoadedClips: () => Array.from(clipCache.keys()),
      dispose,
    };
  }

  return Object.freeze({
    VERSION,
    ARCHETYPES,
    SCION_BONE_MAP,
    dressAnnyCharacter,
    createWorldCastDriver,
  });
});
