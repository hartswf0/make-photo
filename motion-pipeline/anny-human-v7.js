/**
 * anny-human-v7.js — Next-Gen Clothed Anny CC0 (104-bone) Human & Cloth Physics Module
 *
 * Exposes `window.AnnyHumanV7` (and CommonJS `module.exports`).
 * Features:
 *  - Loads Anny CC0 `.glb` cast (`adult_f` Imani, `child7` June, `adult_m` Elder, `elder` Makeda)
 *    and wires `Mesh2MotionAnny.createAnnyDriver` (52/66 bones, palmar-safe hands, torso anti-clip).
 *  - Tailored smooth-hemmed parametric garments (replacing jagged triangle-cutout shells):
 *      * Imani (adult_f): open-front duster coat (smooth V-notch lapels, rolled cuffs, Verlet flaring
 *        lower coat panels), scoop inner tunic, loose pleated cargo trousers, buckled tool-belt,
 *        laced work boots, dense sculpted matte 4C afro crown + brass hoops.
 *      * Makeda (elder) & Elder (adult_m): diagonally draped multi-fold shamma/gabi wrap with
 *        Verlet-simulated hanging shoulder drape, tunic, trousers, laced boots, cornrows (Makeda)
 *        or pleated highland turban + full beard (Elder).
 *      * June (child7): side-slit woven knit tunic with Verlet front/back lower flaps, stitched
 *        knee-patch trousers, ankle boots, and spring-physics hanging twisted locs.
 *  - Exact per-frame boot-sole to `groundY` pinning (zero floating, zero plinth sinking).
 *  - Deterministic English/Amharic phoneme-to-viseme lyric lip-sync (`setLyricSpeech`) driving
 *    GPU morph targets (`jawOpen`, `mouthWide`, `mouthRound`, `lipPress`) directly on Anny's face.
 *  - Zero per-frame heap allocations + shared procedural textile material cache for 60+ FPS.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.AnnyHumanV7 = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const VERSION = '7.0.0';

  const ARCHETYPES = Object.freeze({
    adult_f: {
      id: 'adult_f',
      name: 'Imani',
      label: 'Imani (Adult F)',
      glbFile: 'adult_f.glb',
      skinHex: 0x7b4c33,
      sheenHex: 0xb98566,
      coatHex: 0x354457,
      coatTrimHex: 0x283444,
      tunicHex: 0xe6d7be,
      trouserHex: 0x5d5843,
      bootHex: 0x362217,
      soleHex: 0x1b1512,
      beltHex: 0x563019,
      hairHex: 0x181311,
      accentHex: 0xd9a44b,
    },
    child7: {
      id: 'child7',
      name: 'June',
      label: 'June (Child 7y)',
      glbFile: 'child7.glb',
      skinHex: 0x85553a,
      sheenHex: 0xc29070,
      tunicHex: 0xc36539,
      tunicAccentHex: 0xe8d9bf,
      trouserHex: 0xa48558,
      patchHex: 0x6b5238,
      bootHex: 0x5c3620,
      soleHex: 0x241a14,
      hairHex: 0x181311,
      accentHex: 0xe0a950,
    },
    adult_m: {
      id: 'adult_m',
      name: 'Elder',
      label: 'Elder (Adult M)',
      glbFile: 'adult_m.glb',
      skinHex: 0x6c422c,
      sheenHex: 0xa87658,
      tunicHex: 0xdfd3be,
      shammaHex: 0xf0e7d8,
      trouserHex: 0x3f362e,
      bootHex: 0x302018,
      soleHex: 0x191310,
      turbanHex: 0xeae0ce,
      hairHex: 0x2c2723,
      accentHex: 0xb83e30,
    },
    elder: {
      id: 'elder',
      name: 'Makeda',
      label: 'Makeda (Elder)',
      glbFile: 'elder.glb',
      skinHex: 0x744932,
      sheenHex: 0xb28061,
      tunicHex: 0x753e45,
      shammaHex: 0xf2e8d9,
      trouserHex: 0x3c3431,
      bootHex: 0x33221a,
      soleHex: 0x191310,
      hairHex: 0x302b28,
      accentHex: 0xcf973e,
    },
  });

  // Viseme definitions: [jawOpen, mouthWide, mouthRound, lipPress]
  const VISEME_SHAPES = Object.freeze({
    SIL: [0.00, 0.00, 0.00, 0.05],
    MM:  [0.02, 0.05, 0.08, 0.92],
    FF:  [0.14, 0.20, 0.35, 0.55],
    TH:  [0.24, 0.32, 0.05, 0.12],
    LL:  [0.30, 0.25, 0.10, 0.05],
    EE:  [0.28, 0.85, 0.00, 0.00],
    AA:  [0.78, 0.42, 0.08, 0.00],
    OH:  [0.64, 0.05, 0.72, 0.00],
    OO:  [0.34, 0.00, 0.95, 0.08],
  });

  const VISEMES = Object.freeze(Object.keys(VISEME_SHAPES));

  // Facial expression presets: { jaw, wide, round, press, browY, browTilt, lidDrop, autoTalk }
  const EXPRESSIONS = Object.freeze({
    neutral:   { label: 'Neutral',      jaw: 0.00, wide: 0.05, round: 0.00, press: 0.05, browY: 0.00,  browTilt: 0.00,  lidDrop: 0.00, autoTalk: false },
    talking:   { label: 'Talking',      jaw: 0.00, wide: 0.12, round: 0.05, press: 0.00, browY: 0.002, browTilt: 0.02,  lidDrop: 0.00, autoTalk: true },
    happy:     { label: 'Happy / Smile',jaw: 0.12, wide: 0.85, round: 0.00, press: 0.00, browY: 0.004, browTilt: -0.06, lidDrop: 0.12, autoTalk: false },
    sad:       { label: 'Sad',          jaw: 0.04, wide: -0.15,round: 0.18, press: 0.20, browY: -0.002,browTilt: 0.22,  lidDrop: 0.28, autoTalk: false },
    surprised: { label: 'Surprised',    jaw: 0.68, wide: 0.05, round: 0.72, press: 0.00, browY: 0.009, browTilt: -0.04, lidDrop: -0.22,autoTalk: false },
    strain:    { label: 'Strain / Carry',jaw:0.18, wide: 0.40, round: 0.05, press: 0.45, browY: -0.004,browTilt: -0.18, lidDrop: 0.34, autoTalk: false },
    angry:     { label: 'Angry',        jaw: 0.22, wide: 0.25, round: 0.12, press: 0.55, browY: -0.006,browTilt: -0.32, lidDrop: 0.22, autoTalk: false },
  });

  // Lazy-allocated scratch math objects (zero per-frame allocations, works before THREE loads)
  let _vA = null, _vB = null, _vC = null, _matInv = null, _eulSap = null, _qSap = null;
  function ensureScratch(THREE) {
    if (_vA) return;
    _vA = new THREE.Vector3();
    _vB = new THREE.Vector3();
    _vC = new THREE.Vector3();
    _matInv = new THREE.Matrix4();
    _eulSap = new THREE.Euler(0, 0, 0, 'YXZ');
    _qSap = new THREE.Quaternion();
  }

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Shared texture & material cache across characters (reduces draw/shader/GPU churn)
  const _materialCache = new Map();
  const _timelineCache = new Map();

  // ---------------------------------------------------------------------------
  // Phoneme-to-Viseme Lyric Lip-Sync Engine (English + Amharic Transliteration)
  // ---------------------------------------------------------------------------
  function textToVisemeTimeline(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const cached = _timelineCache.get(raw);
    if (cached) return cached;

    const clean = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s,'\-.;:!?]/g, ' ');

    const tokens = [];
    let i = 0;
    while (i < clean.length) {
      const ch = clean[i];
      const next = i + 1 < clean.length ? clean[i + 1] : '';
      const pair = ch + next;

      if (ch === ' ' || ch === '\t' || ch === '\n') {
        if (tokens.length && tokens[tokens.length - 1].viseme !== 'SIL') {
          tokens.push({ viseme: 'SIL', weight: 0.45 });
        }
        i++;
        continue;
      }
      if (ch === ',' || ch === ';' || ch === '-') {
        tokens.push({ viseme: 'SIL', weight: 0.9 });
        i++;
        continue;
      }
      if (ch === '.' || ch === '!' || ch === '?') {
        tokens.push({ viseme: 'SIL', weight: 1.4 });
        i++;
        continue;
      }
      if (ch === '\'') {
        i++;
        continue;
      }

      // Digraphs first
      if (pair === 'th' || pair === 'sh' || pair === 'ch' || pair === 'zh' || pair === 'ts') {
        tokens.push({ viseme: 'TH', weight: 0.85 });
        i += 2;
        continue;
      }
      if (pair === 'ph') {
        tokens.push({ viseme: 'FF', weight: 0.8 });
        i += 2;
        continue;
      }
      if (pair === 'oo' || pair === 'ou' || pair === 'ow' || pair === 'ue') {
        tokens.push({ viseme: 'OO', weight: 1.55 });
        i += 2;
        continue;
      }
      if (pair === 'ee' || pair === 'ea' || pair === 'ie' || pair === 'ei' || pair === 'ay' || pair === 'ey') {
        tokens.push({ viseme: 'EE', weight: 1.5 });
        i += 2;
        continue;
      }
      if (pair === 'oa' || pair === 'aw' || pair === 'au') {
        tokens.push({ viseme: 'OH', weight: 1.5 });
        i += 2;
        continue;
      }
      if (pair === 'ai' || pair === 'ah' || pair === 'aa') {
        tokens.push({ viseme: 'AA', weight: 1.6 });
        i += 2;
        continue;
      }

      // Single characters
      if (ch === 'm' || ch === 'b' || ch === 'p') {
        tokens.push({ viseme: 'MM', weight: 0.72 });
      } else if (ch === 'f' || ch === 'v') {
        tokens.push({ viseme: 'FF', weight: 0.78 });
      } else if (ch === 'a') {
        tokens.push({ viseme: 'AA', weight: 1.45 });
      } else if (ch === 'e' || ch === 'i' || ch === 'y') {
        tokens.push({ viseme: 'EE', weight: 1.35 });
      } else if (ch === 'o') {
        tokens.push({ viseme: 'OH', weight: 1.4 });
      } else if (ch === 'u' || ch === 'w') {
        tokens.push({ viseme: 'OO', weight: 1.3 });
      } else if (ch === 's' || ch === 'z' || ch === 'c' || ch === 'x') {
        tokens.push({ viseme: 'TH', weight: 0.72 });
      } else if (ch === 'l' || ch === 'r' || ch === 'n' || ch === 'd' || ch === 't' || ch === 'k' || ch === 'g' || ch === 'q' || ch === 'j') {
        tokens.push({ viseme: 'LL', weight: 0.68 });
      } else if (ch === 'h') {
        tokens.push({ viseme: 'AA', weight: 0.55 });
      }
      i++;
    }

    if (!tokens.length) return [];
    // Ensure brief closing silence at end of phrase
    if (tokens[tokens.length - 1].viseme !== 'SIL') {
      tokens.push({ viseme: 'SIL', weight: 0.4 });
    }

    // Merge consecutive identical visemes to avoid jitter
    const merged = [];
    for (let k = 0; k < tokens.length; k++) {
      const cur = tokens[k];
      if (merged.length && merged[merged.length - 1].viseme === cur.viseme) {
        merged[merged.length - 1].weight += cur.weight * 0.65;
      } else {
        merged.push({ viseme: cur.viseme, weight: cur.weight });
      }
    }

    let total = 0;
    for (let k = 0; k < merged.length; k++) total += merged[k].weight;
    const timeline = [];
    let acc = 0;
    for (let k = 0; k < merged.length; k++) {
      const t0 = acc / total;
      acc += merged[k].weight;
      const t1 = acc / total;
      const sh = VISEME_SHAPES[merged[k].viseme] || VISEME_SHAPES.SIL;
      timeline.push({
        viseme: merged[k].viseme,
        t0,
        t1,
        jawOpen: sh[0],
        mouthWide: sh[1],
        mouthRound: sh[2],
        lipPress: sh[3],
      });
    }

    if (_timelineCache.size > 128) _timelineCache.clear();
    _timelineCache.set(raw, timeline);
    return timeline;
  }

  function sampleLyricViseme(text, progress01, audioLevel, outObj) {
    const out = outObj || { viseme: 'SIL', jawOpen: 0, mouthWide: 0, mouthRound: 0, lipPress: 0.05, active: false };
    const level = audioLevel === undefined || audioLevel === null ? 1.0 : clamp(Number(audioLevel) || 0, 0, 1);
    const p = Number(progress01);

    if (!text || !String(text).trim() || !Number.isFinite(p) || p < 0 || p > 1 || level < 0.04) {
      out.viseme = 'SIL';
      out.jawOpen = 0;
      out.mouthWide = 0;
      out.mouthRound = 0;
      out.lipPress = 0.05;
      out.active = false;
      return out;
    }

    const tl = textToVisemeTimeline(text);
    if (!tl.length) {
      out.viseme = 'SIL';
      out.jawOpen = 0;
      out.mouthWide = 0;
      out.mouthRound = 0;
      out.lipPress = 0.05;
      out.active = false;
      return out;
    }

    let idx = 0;
    while (idx < tl.length - 1 && tl[idx].t1 < p) idx++;
    const a = tl[idx];
    const b = tl[Math.min(idx + 1, tl.length - 1)];
    const span = Math.max(1e-4, a.t1 - a.t0);
    const localT = clamp((p - a.t0) / span, 0, 1);
    // Smooth blend only in final 35% of each phoneme window for crisp articulation
    const blend = localT > 0.65 ? (localT - 0.65) / 0.35 : 0;
    const amp = 0.35 + 0.65 * level;

    out.viseme = a.viseme;
    out.jawOpen = lerp(a.jawOpen, b.jawOpen, blend) * amp;
    out.mouthWide = lerp(a.mouthWide, b.mouthWide, blend) * amp;
    out.mouthRound = lerp(a.mouthRound, b.mouthRound, blend) * amp;
    out.lipPress = lerp(a.lipPress, b.lipPress, blend) * (0.5 + 0.5 * level);
    out.active = a.viseme !== 'SIL';
    return out;
  }

  // ---------------------------------------------------------------------------
  // Procedural Shared Textile & Leather Texture / Material Factory
  // ---------------------------------------------------------------------------
  function getSharedMaterial(THREE, key, cfg) {
    const cacheKey = `${key}_${cfg.baseHex}_${cfg.mode || 'weave'}_${cfg.doubleSide ? 'ds' : 'fs'}`;
    if (_materialCache.has(cacheKey)) return _materialCache.get(cacheKey);

    const size = cfg.size || 128;
    const data = new Uint8Array(size * size * 4);
    const base = new THREE.Color(cfg.baseHex || 0xd8cbb4);
    const stripe = cfg.stripeHex !== undefined ? new THREE.Color(cfg.stripeHex) : null;
    const accent = cfg.accentHex !== undefined ? new THREE.Color(cfg.accentHex) : null;
    const mode = cfg.mode || 'weave';

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const warp = Math.sin(x * 1.5) * 0.5 + 0.5;
        const weft = Math.sin(y * 1.5) * 0.5 + 0.5;
        const lum = 0.91 + 0.12 * ((x + y) % 2 === 0 ? warp : weft);
        let r = base.r * lum;
        let g = base.g * lum;
        let b = base.b * lum;

        if (mode === 'tibeb' && stripe && accent) {
          const band = v < 0.16 || (v > 0.87 && v < 0.96);
          if (band) {
            const diamond = Math.abs(((u * 14) % 1) - 0.5) + Math.abs(((v * 14) % 1) - 0.5);
            const c = diamond < 0.42 ? accent : stripe;
            r = c.r * (0.93 + 0.10 * warp);
            g = c.g * (0.93 + 0.10 * warp);
            b = c.b * (0.93 + 0.10 * warp);
          } else if (Math.abs(v - 0.18) < 0.014 || Math.abs(v - 0.85) < 0.012) {
            r = accent.r;
            g = accent.g;
            b = accent.b;
          }
        } else if (mode === 'knit') {
          const rib = Math.sin(x * 0.95) * 0.08 + Math.sin(y * 1.7 + (x % 4) * 0.4) * 0.05;
          r = clamp(base.r * (0.96 + rib), 0, 1);
          g = clamp(base.g * (0.96 + rib), 0, 1);
          b = clamp(base.b * (0.96 + rib), 0, 1);
          if (accent && v < 0.10) {
            r = accent.r * 0.95;
            g = accent.g * 0.95;
            b = accent.b * 0.95;
          }
        } else if (mode === 'twill') {
          const diag = Math.sin((x + y) * 1.15) * 0.065;
          r = clamp(base.r * (0.96 + diag), 0, 1);
          g = clamp(base.g * (0.96 + diag), 0, 1);
          b = clamp(base.b * (0.96 + diag), 0, 1);
        } else if (mode === 'leather') {
          const grain = Math.sin(x * 0.65 + Math.sin(y * 0.43) * 2.0) * 0.05;
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
    tex.repeat.set(cfg.repX || 3, cfg.repY || 3);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: cfg.roughness !== undefined ? cfg.roughness : 0.86,
      metalness: cfg.metalness || 0.0,
      side: cfg.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    });
    _materialCache.set(cacheKey, mat);
    return mat;
  }

  function getSharedSkinMaterial(THREE, palette) {
    const key = `skin_${palette.id}`;
    if (_materialCache.has(key)) return _materialCache.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color: palette.skinHex,
      roughness: 0.56,
      metalness: 0.02,
    });
    _materialCache.set(key, mat);
    return mat;
  }

  function getSharedClayMaterial(THREE) {
    const key = 'clay_base';
    if (_materialCache.has(key)) return _materialCache.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd6b497,
      roughness: 0.62,
      metalness: 0.05,
    });
    _materialCache.set(key, mat);
    return mat;
  }

  function getSharedSolidMaterial(THREE, key, opts) {
    const cacheKey = `solid_${key}_${opts.color}`;
    if (_materialCache.has(cacheKey)) return _materialCache.get(cacheKey);
    const mat = new THREE.MeshStandardMaterial(opts);
    _materialCache.set(cacheKey, mat);
    return mat;
  }

  // ---------------------------------------------------------------------------
  // Body Analysis & GPU Facial Morph Target Synthesis (Lip-Sync on Anny Mesh)
  // ---------------------------------------------------------------------------
  function classifyAnnyBone(name) {
    const n = normName(name);
    if (n.includes('head') || n.includes('neck') || n.includes('eye')) return 'head';
    if (n.includes('wrist') || n.includes('finger') || n.includes('thumb') || n.includes('metacarpal') || n.includes('hand')) {
      return n.endsWith('l') ? 'handL' : 'handR';
    }
    if (n.includes('lowerarm') || n.includes('upperarm')) {
      return n.endsWith('l') ? 'armL' : 'armR';
    }
    if (n.includes('shoulder') || n.includes('clavicle') || n.includes('deltoid')) return 'torso';
    if (n.includes('foot') || n.includes('toe')) {
      return n.endsWith('l') ? 'footL' : 'footR';
    }
    if (n.includes('lowerleg') || n.includes('upperleg')) {
      return n.endsWith('l') ? 'legL' : 'legR';
    }
    if (n.includes('pelvis') || n.includes('root') || n.includes('hip')) return 'pelvis';
    return 'torso';
  }

  function analyzeBody(THREE, bodyMesh, bonesByNorm) {
    const geo = bodyMesh.geometry;
    const pos = geo.attributes.position;
    const si = geo.attributes.skinIndex;
    const sw = geo.attributes.skinWeight;
    const skeletonBones = bodyMesh.skeleton.bones;
    const boneRegion = skeletonBones.map((b) => classifyAnnyBone(b.name));
    const boneNormNames = skeletonBones.map((b) => normName(b.name));
    const eyeLBoneIdx = boneNormNames.indexOf('eyel');
    const eyeRBoneIdx = boneNormNames.indexOf('eyer');

    const vCount = pos.count;
    let minY = Infinity;
    let maxY = -Infinity;
    let torsoZSum = 0;
    let torsoZCount = 0;

    const regionVerts = {
      torso: [],
      armL: [],
      armR: [],
      legL: [],
      legR: [],
      footL: [],
      footR: [],
      head: [],
    };
    const vRegion = new Array(vCount);
    const vDomBone = new Array(vCount);
    const eyeVertMask = new Uint8Array(vCount); // 1 = eye.L, 2 = eye.R

    for (let v = 0; v < vCount; v++) {
      const vy = pos.getY(v);
      const vz = pos.getZ(v);
      if (vy < minY) minY = vy;
      if (vy > maxY) maxY = vy;

      const i0 = si.getX(v), i1 = si.getY(v), i2 = si.getZ(v), i3 = si.getW(v);
      const w0 = sw.getX(v), w1 = sw.getY(v), w2 = sw.getZ(v), w3 = sw.getW(v);
      let bestK = 0, bestW = w0;
      if (w1 > bestW) { bestK = 1; bestW = w1; }
      if (w2 > bestW) { bestK = 2; bestW = w2; }
      if (w3 > bestW) { bestK = 3; }
      const bIdx = bestK === 0 ? i0 : bestK === 1 ? i1 : bestK === 2 ? i2 : i3;
      const reg = boneRegion[bIdx] || 'torso';
      vRegion[v] = reg;
      vDomBone[v] = boneNormNames[bIdx] || 'root';

      let wEyeL = 0, wEyeR = 0;
      if (eyeLBoneIdx >= 0) {
        if (i0 === eyeLBoneIdx) wEyeL += w0;
        if (i1 === eyeLBoneIdx) wEyeL += w1;
        if (i2 === eyeLBoneIdx) wEyeL += w2;
        if (i3 === eyeLBoneIdx) wEyeL += w3;
      }
      if (eyeRBoneIdx >= 0) {
        if (i0 === eyeRBoneIdx) wEyeR += w0;
        if (i1 === eyeRBoneIdx) wEyeR += w1;
        if (i2 === eyeRBoneIdx) wEyeR += w2;
        if (i3 === eyeRBoneIdx) wEyeR += w3;
      }
      if (wEyeL > 0.45) eyeVertMask[v] = 1;
      else if (wEyeR > 0.45) eyeVertMask[v] = 2;

      if (reg === 'torso' || reg === 'pelvis') {
        regionVerts.torso.push(v);
        torsoZSum += vz;
        torsoZCount++;
      } else if (regionVerts[reg]) {
        regionVerts[reg].push(v);
      }
    }

    const height = Math.max(0.5, maxY - minY);
    const centerZ = torsoZCount > 0 ? torsoZSum / torsoZCount : 0.02;

    // Build smooth radial torso envelope table: R(yBin, aBin)
    const yBins = 36;
    const aBins = 36;
    const torsoR = new Float32Array(yBins * aBins);
    for (let idx = 0; idx < regionVerts.torso.length; idx++) {
      const v = regionVerts.torso[idx];
      const vx = pos.getX(v);
      const vy = pos.getY(v);
      const vz = pos.getZ(v) - centerZ;
      const yn = clamp((vy - minY) / height, 0, 0.9999);
      const yb = Math.floor(yn * yBins);
      let ang = Math.atan2(vx, vz);
      if (ang < 0) ang += Math.PI * 2;
      const ab = Math.floor((ang / (Math.PI * 2)) * aBins) % aBins;
      const r = Math.hypot(vx, vz);
      const cell = yb * aBins + ab;
      if (r > torsoR[cell]) torsoR[cell] = r;
    }

    // Fill sparse bins from neighbors and smooth radially & vertically
    for (let pass = 0; pass < 3; pass++) {
      const next = new Float32Array(torsoR);
      for (let yb = 0; yb < yBins; yb++) {
        for (let ab = 0; ab < aBins; ab++) {
          const c = torsoR[yb * aBins + ab];
          const l = torsoR[yb * aBins + ((ab + aBins - 1) % aBins)];
          const r = torsoR[yb * aBins + ((ab + 1) % aBins)];
          const u = torsoR[Math.min(yBins - 1, yb + 1) * aBins + ab];
          const d = torsoR[Math.max(0, yb - 1) * aBins + ab];
          if (c < 0.02) {
            next[yb * aBins + ab] = Math.max(l, r, u, d) * 0.95;
          } else {
            next[yb * aBins + ab] = c * 0.52 + (l + r) * 0.16 + (u + d) * 0.08;
          }
        }
      }
      torsoR.set(next);
    }

    function sampleTorsoRadius(yNorm, theta) {
      const yf = clamp(yNorm, 0, 0.999) * (yBins - 1);
      const y0 = Math.floor(yf);
      const y1 = Math.min(yBins - 1, y0 + 1);
      const ty = yf - y0;

      let a = theta % (Math.PI * 2);
      if (a < 0) a += Math.PI * 2;
      const af = (a / (Math.PI * 2)) * aBins;
      const a0 = Math.floor(af) % aBins;
      const a1 = (a0 + 1) % aBins;
      const ta = af - Math.floor(af);

      const r00 = torsoR[y0 * aBins + a0];
      const r10 = torsoR[y0 * aBins + a1];
      const r01 = torsoR[y1 * aBins + a0];
      const r11 = torsoR[y1 * aBins + a1];
      const r0 = lerp(r00, r10, ta);
      const r1 = lerp(r01, r11, ta);
      return Math.max(0.055 * height, lerp(r0, r1, ty));
    }

    // Compute bone positions in bodyMesh bind-pose local space
    bodyMesh.updateMatrixWorld(true);
    const invBody = new THREE.Matrix4().copy(bodyMesh.matrixWorld).invert();
    const bonePosLocal = new Map();
    const tmpV = new THREE.Vector3();
    for (const [key, bone] of bonesByNorm.entries()) {
      bone.getWorldPosition(tmpV).applyMatrix4(invBody);
      bonePosLocal.set(key, tmpV.clone());
    }

    // Head & exact eye-socket bounding boxes in head-bone local coordinates
    const headBone = bonesByNorm.get('head');
    const headMetrics = { cx: 0, cy: 0.08, cz: 0.01, rx: 0.075, ry: 0.095, rz: 0.085, minY: 0, maxY: 0.18, maxZ: 0.09 };
    const eyeMetrics = { L: null, R: null };
    if (headBone) {
      const invHead = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
      const headToBody = new THREE.Matrix4().multiplyMatrices(invHead, bodyMesh.matrixWorld);
      let hx0 = Infinity, hx1 = -Infinity, hy0 = Infinity, hy1 = -Infinity, hz0 = Infinity, hz1 = -Infinity;
      const eAcc = [
        null,
        { sx: 0, sy: 0, sz: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity, n: 0 },
        { sx: 0, sy: 0, sz: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity, n: 0 },
      ];
      for (let idx = 0; idx < regionVerts.head.length; idx++) {
        const v = regionVerts.head[idx];
        tmpV.set(pos.getX(v), pos.getY(v), pos.getZ(v)).applyMatrix4(headToBody);
        const em = eyeVertMask[v];
        if (em === 1 || em === 2) {
          const a = eAcc[em];
          a.sx += tmpV.x; a.sy += tmpV.y; a.sz += tmpV.z; a.n++;
          if (tmpV.x < a.x0) a.x0 = tmpV.x;
          if (tmpV.x > a.x1) a.x1 = tmpV.x;
          if (tmpV.y < a.y0) a.y0 = tmpV.y;
          if (tmpV.y > a.y1) a.y1 = tmpV.y;
          if (tmpV.z < a.z0) a.z0 = tmpV.z;
          if (tmpV.z > a.z1) a.z1 = tmpV.z;
        }
        if (tmpV.y < -0.02) continue; // skip lower neck
        if (tmpV.x < hx0) hx0 = tmpV.x;
        if (tmpV.x > hx1) hx1 = tmpV.x;
        if (tmpV.y < hy0) hy0 = tmpV.y;
        if (tmpV.y > hy1) hy1 = tmpV.y;
        if (tmpV.z < hz0) hz0 = tmpV.z;
        if (tmpV.z > hz1) hz1 = tmpV.z;
      }
      if (hx1 > hx0) {
        headMetrics.cx = (hx0 + hx1) * 0.5;
        headMetrics.cy = (hy0 + hy1) * 0.5;
        headMetrics.cz = (hz0 + hz1) * 0.5;
        headMetrics.rx = Math.max(0.055, (hx1 - hx0) * 0.5);
        headMetrics.ry = Math.max(0.070, (hy1 - hy0) * 0.5);
        headMetrics.rz = Math.max(0.062, (hz1 - hz0) * 0.5);
        headMetrics.minY = hy0;
        headMetrics.maxY = hy1;
        headMetrics.maxZ = hz1;
      }
      for (const [k, em] of [['L', 1], ['R', 2]]) {
        const a = eAcc[em];
        if (a.n > 8) {
          const rX = (a.x1 - a.x0) * 0.5;
          const rY = (a.y1 - a.y0) * 0.5;
          const rZ = (a.z1 - a.z0) * 0.5;
          eyeMetrics[k] = {
            x: (a.x0 + a.x1) * 0.5,
            y: (a.y0 + a.y1) * 0.5,
            z: (a.z0 + a.z1) * 0.5,
            r: Math.max(0.010, (rX + rY + rZ) / 3),
            maxZ: a.z1,
          };
        }
      }
    }

    // Measure exact foot bounding boxes in foot.L / foot.R bone local coordinates for minimalist sandals
    const footMetrics = { L: null, R: null };
    for (const [side, boneKey, regKey] of [['L', 'footl', 'footL'], ['R', 'footr', 'footR']]) {
      const fb = bonesByNorm.get(boneKey);
      const verts = regionVerts[regKey];
      if (!fb || !verts.length) continue;
      const invF = new THREE.Matrix4().copy(fb.matrixWorld).invert();
      const fToBody = new THREE.Matrix4().multiplyMatrices(invF, bodyMesh.matrixWorld);
      let fx0 = Infinity, fx1 = -Infinity, fy0 = Infinity, fy1 = -Infinity, fz0 = Infinity, fz1 = -Infinity;
      for (let idx = 0; idx < verts.length; idx++) {
        const v = verts[idx];
        tmpV.set(pos.getX(v), pos.getY(v), pos.getZ(v)).applyMatrix4(fToBody);
        if (tmpV.x < fx0) fx0 = tmpV.x;
        if (tmpV.x > fx1) fx1 = tmpV.x;
        if (tmpV.y < fy0) fy0 = tmpV.y;
        if (tmpV.y > fy1) fy1 = tmpV.y;
        if (tmpV.z < fz0) fz0 = tmpV.z;
        if (tmpV.z > fz1) fz1 = tmpV.z;
      }
      if (fx1 > fx0) {
        footMetrics[side] = {
          minX: fx0, maxX: fx1, cx: (fx0 + fx1) * 0.5, w: fx1 - fx0,
          minY: fy0, maxY: fy1, h: fy1 - fy0,
          minZ: fz0, maxZ: fz1, cz: (fz0 + fz1) * 0.5, len: fz1 - fz0,
        };
      }
    }

    return {
      minY,
      maxY,
      height,
      centerZ,
      vRegion,
      vDomBone,
      eyeVertMask,
      regionVerts,
      sampleTorsoRadius,
      bonePosLocal,
      headMetrics,
      eyeMetrics,
      footMetrics,
    };
  }

  /**
   * Build 6 GPU morph targets directly onto Anny's SkinnedMesh geometry for real-time lip-sync & expressions:
   *  0: jawOpen, 1: mouthWide (smile), 2: mouthRound, 3: lipPress, 4: browDown, 5: browUp
   */
  function attachFacialLipSyncMorphs(THREE, bodyMesh, bodyData, headBone) {
    const geo = bodyMesh.geometry;
    if (geo.morphAttributes && geo.morphAttributes.position && geo.morphAttributes.position.length >= 6) {
      return true;
    }
    if (!headBone) return false;

    const pos = geo.attributes.position;
    const vCount = pos.count;
    const hm = bodyData.headMetrics;
    const emL = bodyData.eyeMetrics && bodyData.eyeMetrics.L;
    const emR = bodyData.eyeMetrics && bodyData.eyeMetrics.R;

    bodyMesh.updateMatrixWorld(true);
    const invHead = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
    const toHead = new THREE.Matrix4().multiplyMatrices(invHead, bodyMesh.matrixWorld);
    const headRotToBody = new THREE.Matrix4().copy(toHead).invert();
    const rotOnly = new THREE.Matrix3().setFromMatrix4(headRotToBody);

    // Exact anatomical landmarks anchored to measured eye sockets
    const eyeY = emL ? emL.y : (hm.cy + hm.ry * 0.08);
    const eyeZ = emL ? emL.z : (hm.cz + hm.rz * 0.65);
    const eyeSpanX = (emL && emR) ? Math.abs(emL.x - emR.x) * 0.5 : (hm.rx * 0.38);
    const mouthY = eyeY - eyeSpanX * 2.16;
    const mouthW = Math.max(0.026, eyeSpanX * 0.94);
    const mouthH = eyeSpanX * 0.95;
    const browY = eyeY + eyeSpanX * 0.72;

    const pHead = new THREE.Vector3();
    const delta = new THREE.Vector3();
    const headVerts = bodyData.regionVerts.head;
    const eyeMask = bodyData.eyeVertMask;

    // Measure exact front-surface Z of Anny's lips so the 3D oral cavity, teeth & tongue seat accurately
    let lipSurfaceZ = eyeZ + eyeSpanX * 0.55;
    let maxLipZ = -Infinity;
    for (let idx = 0; idx < headVerts.length; idx++) {
      const v = headVerts[idx];
      if (eyeMask && eyeMask[v]) continue;
      pHead.set(pos.getX(v), pos.getY(v), pos.getZ(v)).applyMatrix4(toHead);
      if (Math.abs(pHead.x - hm.cx) < mouthW * 0.55 && Math.abs(pHead.y - mouthY) < eyeSpanX * 0.32) {
        if (pHead.z > maxLipZ) maxLipZ = pHead.z;
      }
    }
    if (Number.isFinite(maxLipZ)) lipSurfaceZ = maxLipZ;
    const mouthZ = lipSurfaceZ;
    bodyData.mouthMetrics = {
      cx: hm.cx,
      y: mouthY,
      surfaceZ: lipSurfaceZ,
      w: mouthW,
      h: mouthH,
      eyeSpanX,
    };

    const mJaw = new Float32Array(vCount * 3);
    const mWide = new Float32Array(vCount * 3);
    const mRound = new Float32Array(vCount * 3);
    const mPress = new Float32Array(vCount * 3);
    const mBrowDn = new Float32Array(vCount * 3);
    const mBrowUp = new Float32Array(vCount * 3);

    for (let i = 0; i < vCount * 3; i++) {
      const val = pos.array[i];
      mJaw[i] = val;
      mWide[i] = val;
      mRound[i] = val;
      mPress[i] = val;
      mBrowDn[i] = val;
      mBrowUp[i] = val;
    }

    for (let idx = 0; idx < headVerts.length; idx++) {
      const v = headVerts[idx];
      if (eyeMask && eyeMask[v]) continue; // never deform eye verts
      pHead.set(pos.getX(v), pos.getY(v), pos.getZ(v)).applyMatrix4(toHead);

      // Front face only
      if (pHead.z < hm.cz + hm.rz * 0.12) continue;
      const dx = pHead.x - hm.cx;

      // 1. Mouth & Jaw Region (strictly below nose base so nostrils/philtrum stay untouched)
      const dy = pHead.y - mouthY;
      const dz = pHead.z - mouthZ;
      const rx = Math.abs(dx) / (mouthW * 1.58);
      const ry = Math.abs(dy) / (mouthH * 1.75);
      const rz = Math.max(0, -dz) / (hm.rz * 0.78);
      const d2 = rx * rx + ry * ry + rz * rz;
      if (d2 < 1.0 && pHead.y < mouthY + eyeSpanX * 0.48) {
        const falloff = (1 - d2) * (1 - d2);
        const horizMouth = clamp(1 - Math.abs(dx) / (mouthW * 1.08), 0, 1);
        const horizCurve = horizMouth * horizMouth * (3 - 2 * horizMouth);
        const isLower = dy < 0.0;

        // Inner lip-line vertices recess strongly backward (-12..-16 mm) so the closed lip seam
        // opens cleanly around the dark 3D oral cavity, curved ivory teeth & pink tongue.
        const seamDist = Math.abs(dy) / (eyeSpanX * 0.22);
        const seamW = seamDist < 1.0 ? (1 - seamDist * seamDist) * horizCurve : 0;

        // Upper lip parts UP (+4..6 mm) while lower lip + chin hinge DOWN (-16..22 mm)
        const upperW = dy > 0 ? clamp((eyeSpanX * 0.44 - dy) / (eyeSpanX * 0.44), 0, 1) * clamp(dy / (eyeSpanX * 0.08), 0, 1) * horizCurve : 0;
        const lowerW = dy < eyeSpanX * 0.03 ? clamp((eyeSpanX * 0.03 - dy) / (eyeSpanX * 0.34), 0, 1) : 0;

        // 0: jawOpen — true upper/lower lip parting + inner lip-seam recession into oral cavity
        const jawY =
          -eyeSpanX * 0.68 * lowerW * Math.pow(falloff, 0.72) +
          eyeSpanX * 0.22 * upperW * Math.pow(falloff, 0.75);
        const jawZ =
          -eyeSpanX * 0.56 * seamW -
          eyeSpanX * 0.14 * lowerW * falloff +
          eyeSpanX * 0.06 * upperW * falloff;
        delta.set(0, jawY, jawZ).applyMatrix3(rotOnly);
        mJaw[v * 3] += delta.x;
        mJaw[v * 3 + 1] += delta.y;
        mJaw[v * 3 + 2] += delta.z;

        // 1: mouthWide / smile — pulls corners outward & UP + lifts cheeks warmly
        const cornerSign = dx >= 0 ? 1 : -1;
        const cornerFactor = clamp(Math.abs(dx) / Math.max(0.012, mouthW), 0, 1);
        delta.set(
          cornerSign * hm.rx * 0.16 * falloff * (0.35 + 0.65 * cornerFactor),
          hm.ry * 0.115 * falloff * (0.25 + 0.75 * cornerFactor),
          -hm.rz * 0.032 * falloff * cornerFactor
        ).applyMatrix3(rotOnly);
        mWide[v * 3] += delta.x;
        mWide[v * 3 + 1] += delta.y;
        mWide[v * 3 + 2] += delta.z;

        // 2: mouthRound — purses lips inward horizontally & forward
        delta.set(
          -dx * 0.30 * falloff,
          (isLower ? -hm.ry * 0.055 : hm.ry * 0.032) * falloff,
          hm.rz * 0.14 * falloff
        ).applyMatrix3(rotOnly);
        mRound[v * 3] += delta.x;
        mRound[v * 3 + 1] += delta.y;
        mRound[v * 3 + 2] += delta.z;

        // 3: lipPress — draws upper & lower lips gently together
        delta.set(
          0,
          (isLower ? hm.ry * 0.06 : -hm.ry * 0.06) * falloff,
          -hm.rz * 0.03 * falloff
        ).applyMatrix3(rotOnly);
        mPress[v * 3] += delta.x;
        mPress[v * 3 + 1] += delta.y;
        mPress[v * 3 + 2] += delta.z;
      }

      // 2. Brow Region (angry/sad browDown & surprised/happy browUp)
      const bdy = pHead.y - browY;
      const brx = Math.abs(dx) / (eyeSpanX * 1.95);
      const bry = Math.abs(bdy) / (hm.ry * 0.24);
      const bd2 = brx * brx + bry * bry;
      if (bd2 < 1.0 && pHead.z > eyeZ - hm.rz * 0.15) {
        const bf = (1 - bd2) * (1 - bd2);
        const innerBias = 1.0 - clamp(Math.abs(dx) / (eyeSpanX * 1.6), 0, 0.75);
        // 4: browDown (furrow down & slightly inward)
        delta.set(
          -Math.sign(dx) * hm.rx * 0.035 * bf * innerBias,
          -hm.ry * 0.095 * bf * (0.55 + 0.45 * innerBias),
          hm.rz * 0.025 * bf
        ).applyMatrix3(rotOnly);
        mBrowDn[v * 3] += delta.x;
        mBrowDn[v * 3 + 1] += delta.y;
        mBrowDn[v * 3 + 2] += delta.z;

        // 5: browUp (raise brow arch)
        delta.set(
          0,
          hm.ry * 0.105 * bf,
          0
        ).applyMatrix3(rotOnly);
        mBrowUp[v * 3] += delta.x;
        mBrowUp[v * 3 + 1] += delta.y;
        mBrowUp[v * 3 + 2] += delta.z;
      }
    }

    geo.morphAttributes.position = [
      new THREE.Float32BufferAttribute(mJaw, 3),
      new THREE.Float32BufferAttribute(mWide, 3),
      new THREE.Float32BufferAttribute(mRound, 3),
      new THREE.Float32BufferAttribute(mPress, 3),
      new THREE.Float32BufferAttribute(mBrowDn, 3),
      new THREE.Float32BufferAttribute(mBrowUp, 3),
    ];
    geo.morphTargetsRelative = false;
    bodyMesh.morphTargetDictionary = {
      jawOpen: 0,
      mouthWide: 1,
      mouthRound: 2,
      lipPress: 3,
      browDown: 4,
      browUp: 5,
    };
    bodyMesh.morphTargetInfluences = [0, 0, 0, 0, 0, 0];
    return true;
  }

  // ---------------------------------------------------------------------------
  // Nearest-Region Skinning Transfer (Zero Jagged Cuts + 104-Bone Fidelity)
  // ---------------------------------------------------------------------------
  function transferSkinWeights(bodyMesh, vertList, outPos, outSi, outSw) {
    const srcPos = bodyMesh.geometry.attributes.position;
    const srcSi = bodyMesh.geometry.attributes.skinIndex;
    const srcSw = bodyMesh.geometry.attributes.skinWeight;
    const nV = outPos.length / 3;
    const nSrc = vertList.length;

    // Pre-extract source coordinates into flat Float32Array for tight inner loop
    const sCoords = new Float32Array(nSrc * 3);
    for (let j = 0; j < nSrc; j++) {
      const ov = vertList[j];
      sCoords[j * 3] = srcPos.getX(ov);
      sCoords[j * 3 + 1] = srcPos.getY(ov);
      sCoords[j * 3 + 2] = srcPos.getZ(ov);
    }

    for (let i = 0; i < nV; i++) {
      const px = outPos[i * 3];
      const py = outPos[i * 3 + 1];
      const pz = outPos[i * 3 + 2];
      let bestJ = 0;
      let bestD2 = Infinity;
      for (let j = 0; j < nSrc; j++) {
        const dx = px - sCoords[j * 3];
        const dy = py - sCoords[j * 3 + 1];
        const dz = pz - sCoords[j * 3 + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestJ = j;
        }
      }
      const ov = vertList[bestJ];
      outSi[i * 4] = srcSi.getX(ov);
      outSi[i * 4 + 1] = srcSi.getY(ov);
      outSi[i * 4 + 2] = srcSi.getZ(ov);
      outSi[i * 4 + 3] = srcSi.getW(ov);
      outSw[i * 4] = srcSw.getX(ov);
      outSw[i * 4 + 1] = srcSw.getY(ov);
      outSw[i * 4 + 2] = srcSw.getZ(ov);
      outSw[i * 4 + 3] = srcSw.getW(ov);
    }
  }

  function makeSkinnedParametricMesh(THREE, bodyMesh, vertList, posArr, uvArr, indices, material, name) {
    const nV = posArr.length / 3;
    const siArr = new Uint16Array(nV * 4);
    const swArr = new Float32Array(nV * 4);
    transferSkinWeights(bodyMesh, vertList, posArr, siArr, swArr);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(siArr, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(swArr, 4));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.name = name || 'anny_v7_garment';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
    return mesh;
  }

  /**
   * Build a 100% continuous, seamless one-piece skinned garment directly from Anny's connected
   * vertex manifold (exact 104-bone skinIndex/skinWeight, zero shoulder/waist/crotch gaps,
   * boundary-smoothed clean hems & cuffs).
   */
  function buildManifoldGarment(THREE, bodyMesh, bodyData, spec) {
    const srcGeo = bodyMesh.geometry;
    const srcPos = srcGeo.attributes.position;
    let srcNrm = srcGeo.attributes.normal;
    if (!srcNrm) {
      srcGeo.computeVertexNormals();
      srcNrm = srcGeo.attributes.normal;
    }
    const srcSi = srcGeo.attributes.skinIndex;
    const srcSw = srcGeo.attributes.skinWeight;
    const srcIdx = srcGeo.index;
    if (!srcIdx) return null;

    const vCount = srcPos.count;
    const { minY, height, centerZ, vDomBone } = bodyData;
    const hScale = height / 1.65;

    // 1. Mark included vertices via spec.includeVertex
    const vIncluded = new Uint8Array(vCount);
    for (let v = 0; v < vCount; v++) {
      const x = srcPos.getX(v);
      const y = srcPos.getY(v);
      const z = srcPos.getZ(v);
      const yn = (y - minY) / height;
      if (spec.includeVertex(v, x, y, z, yn, vDomBone[v])) {
        vIncluded[v] = 1;
      }
    }

    // 2. Collect triangles where all 3 vertices are included (or >=2 if expandEdges)
    const idxArr = srcIdx.array;
    const triList = [];
    const oldToNew = new Int32Array(vCount).fill(-1);
    const newToOld = [];

    for (let t = 0; t < idxArr.length; t += 3) {
      const a = idxArr[t];
      const b = idxArr[t + 1];
      const c = idxArr[t + 2];
      if (!vIncluded[a] || !vIncluded[b] || !vIncluded[c]) continue;
      for (const ov of [a, b, c]) {
        if (oldToNew[ov] < 0) {
          oldToNew[ov] = newToOld.length;
          newToOld.push(ov);
        }
      }
      triList.push(oldToNew[a], oldToNew[b], oldToNew[c]);
    }

    const nV = newToOld.length;
    if (nV < 12 || triList.length < 12) return null;

    // 3. Detect open boundary edges (hems, cuffs, necklines) for Laplacian rim smoothing
    const edgeCount = new Map();
    const bAdj = new Map();
    const addEdge = (u, v) => {
      const lo = u < v ? u : v;
      const hi = u < v ? v : u;
      const key = lo * nV + hi;
      edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
    };
    for (let t = 0; t < triList.length; t += 3) {
      addEdge(triList[t], triList[t + 1]);
      addEdge(triList[t + 1], triList[t + 2]);
      addEdge(triList[t + 2], triList[t]);
    }
    const isBoundary = new Uint8Array(nV);
    for (const [key, cnt] of edgeCount.entries()) {
      if (cnt === 1) {
        const u = Math.floor(key / nV);
        const v = key - u * nV;
        isBoundary[u] = 1;
        isBoundary[v] = 1;
        if (!bAdj.has(u)) bAdj.set(u, []);
        if (!bAdj.has(v)) bAdj.set(v, []);
        bAdj.get(u).push(v);
        bAdj.get(v).push(u);
      }
    }

    // 4. Populate offset positions, UVs, and exact copied skinIndex/skinWeight
    const outPos = new Float32Array(nV * 3);
    const outUv = new Float32Array(nV * 2);
    const outSi = new Uint16Array(nV * 4);
    const outSw = new Float32Array(nV * 4);

    for (let i = 0; i < nV; i++) {
      const ov = newToOld[i];
      const x = srcPos.getX(ov);
      const y = srcPos.getY(ov);
      const z = srcPos.getZ(ov);
      const nx = srcNrm.getX(ov);
      const ny = srcNrm.getY(ov);
      const nz = srcNrm.getZ(ov);
      const yn = (y - minY) / height;

      const baseOff = typeof spec.offset === 'function'
        ? spec.offset(ov, yn, x, z, isBoundary[i], vDomBone[ov])
        : (spec.offset || 0.009) * hScale;

      outPos[i * 3] = x + nx * baseOff;
      outPos[i * 3 + 1] = y + ny * baseOff;
      outPos[i * 3 + 2] = z + nz * baseOff;

      const theta = Math.atan2(x, z - centerZ);
      outUv[i * 2] = (theta / (Math.PI * 2) + 0.5) * (spec.uvScaleX || 1.0);
      outUv[i * 2 + 1] = yn * (spec.uvScaleY || 2.8);

      outSi[i * 4] = srcSi.getX(ov);
      outSi[i * 4 + 1] = srcSi.getY(ov);
      outSi[i * 4 + 2] = srcSi.getZ(ov);
      outSi[i * 4 + 3] = srcSi.getW(ov);

      outSw[i * 4] = srcSw.getX(ov);
      outSw[i * 4 + 1] = srcSw.getY(ov);
      outSw[i * 4 + 2] = srcSw.getZ(ov);
      outSw[i * 4 + 3] = srcSw.getW(ov);
    }

    // 5. Smooth open boundary rims (4 passes) so hems, collars, and cuffs are crisp & never sawtooth
    const tmpBuf = new Float32Array(nV * 3);
    for (let pass = 0; pass < 4; pass++) {
      tmpBuf.set(outPos);
      for (const [u, nbrs] of bAdj.entries()) {
        if (nbrs.length < 2) continue;
        let sx = 0, sy = 0, sz = 0;
        for (let k = 0; k < nbrs.length; k++) {
          const nb = nbrs[k];
          sx += outPos[nb * 3];
          sy += outPos[nb * 3 + 1];
          sz += outPos[nb * 3 + 2];
        }
        const inv = 1 / nbrs.length;
        tmpBuf[u * 3] = lerp(outPos[u * 3], sx * inv, 0.55);
        tmpBuf[u * 3 + 1] = lerp(outPos[u * 3 + 1], sy * inv, 0.65);
        tmpBuf[u * 3 + 2] = lerp(outPos[u * 3 + 2], sz * inv, 0.55);
      }
      outPos.set(tmpBuf);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(outUv, 2));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(outSi, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(outSw, 4));
    geo.setIndex(triList);
    geo.computeVertexNormals();

    const mesh = new THREE.SkinnedMesh(geo, spec.material);
    mesh.name = spec.name || 'anny_v7_manifold_garment';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
    return mesh;
  }

  // ---------------------------------------------------------------------------
  // Parametric Tailored Garment Builders (Smooth Hems, Lapels, Cuffs, Boots)
  // ---------------------------------------------------------------------------
  function buildTorsoLoft(THREE, bodyMesh, bodyData, spec) {
    const rings = spec.rings || 16;
    const segs = spec.segs || 28;
    const closed = spec.closed !== false;
    const cols = closed ? segs : segs + 1;
    const nV = (rings + 1) * cols;

    const pos = new Float32Array(nV * 3);
    const uv = new Float32Array(nV * 2);
    const idx = [];

    const { minY, height, centerZ, sampleTorsoRadius } = bodyData;

    for (let r = 0; r <= rings; r++) {
      const vFrac = r / rings;
      for (let c = 0; c < cols; c++) {
        const uFrac = closed ? c / segs : c / segs;
        let theta;
        if (closed) {
          theta = uFrac * Math.PI * 2;
        } else {
          const openHalf = typeof spec.openHalfAngle === 'function'
            ? spec.openHalfAngle(vFrac)
            : (spec.openHalfAngle || 0.35);
          theta = lerp(openHalf, Math.PI * 2 - openHalf, uFrac);
        }

        const yLo = typeof spec.yMin === 'function' ? spec.yMin(theta, uFrac) : spec.yMin;
        const yHi = typeof spec.yMax === 'function' ? spec.yMax(theta, uFrac) : spec.yMax;
        const yNorm = lerp(yLo, yHi, vFrac);
        const y = minY + yNorm * height;

        const baseR = sampleTorsoRadius(yNorm, theta);
        const ease = typeof spec.ease === 'function'
          ? spec.ease(vFrac, uFrac, theta, yNorm, height)
          : (spec.ease || 0.014) * (height / 1.65);

        let rad = baseR + ease;
        if (spec.minRadius) {
          const mr = typeof spec.minRadius === 'function' ? spec.minRadius(vFrac, theta, height) : spec.minRadius;
          if (rad < mr) rad = mr;
        }

        const vx = Math.sin(theta) * rad;
        const vz = centerZ + Math.cos(theta) * rad;
        const vi = r * cols + c;
        pos[vi * 3] = vx;
        pos[vi * 3 + 1] = y;
        pos[vi * 3 + 2] = vz;
        uv[vi * 2] = uFrac;
        uv[vi * 2 + 1] = vFrac;
      }
    }

    for (let r = 0; r < rings; r++) {
      for (let c = 0; c < segs; c++) {
        const cNext = closed ? (c + 1) % segs : c + 1;
        const a = r * cols + c;
        const b = r * cols + cNext;
        const d = (r + 1) * cols + c;
        const e = (r + 1) * cols + cNext;
        idx.push(a, b, d, b, e, d);
      }
    }

    return makeSkinnedParametricMesh(THREE, bodyMesh, bodyData.regionVerts.torso, pos, uv, idx, spec.material, spec.name);
  }

  function buildLimbTube(THREE, bodyMesh, bodyData, spec) {
    const bPos = bodyData.bonePosLocal;
    const pts = spec.boneKeys.map((k) => bPos.get(k)).filter(Boolean);
    if (pts.length < 2) return null;

    const vertList = bodyData.regionVerts[spec.region] || bodyData.regionVerts.torso;
    const srcPos = bodyMesh.geometry.attributes.position;

    // Sample polyline centers along the limb bones
    const rings = spec.rings || 14;
    const segs = spec.segs || 16;
    const centers = [];
    const tangents = [];
    const totalSegs = pts.length - 1;

    for (let r = 0; r <= rings; r++) {
      const t = lerp(spec.tStart || 0, spec.tEnd || 1, r / rings);
      const scaled = clamp(t, 0, 0.9999) * totalSegs;
      const sIdx = Math.min(totalSegs - 1, Math.floor(scaled));
      const localT = scaled - sIdx;
      const p = new THREE.Vector3().lerpVectors(pts[sIdx], pts[sIdx + 1], localT);
      const tan = new THREE.Vector3().subVectors(pts[sIdx + 1], pts[sIdx]).normalize();
      centers.push(p);
      tangents.push(tan);
    }

    // Measure limb max radius near each ring center (clamped to tailored anatomical limb radius)
    const isArm = spec.region === 'armL' || spec.region === 'armR';
    const maxCap = isArm ? 0.054 * (bodyData.height / 1.65) : 0.086 * (bodyData.height / 1.65);
    const minCap = isArm ? 0.025 * (bodyData.height / 1.65) : 0.042 * (bodyData.height / 1.65);
    const ringRadii = new Float32Array(rings + 1);
    const tmpP = new THREE.Vector3();
    for (let r = 0; r <= rings; r++) {
      const c = centers[r];
      const tan = tangents[r];
      let maxR = minCap;
      for (let j = 0; j < vertList.length; j++) {
        const ov = vertList[j];
        tmpP.set(srcPos.getX(ov) - c.x, srcPos.getY(ov) - c.y, srcPos.getZ(ov) - c.z);
        const axial = Math.abs(tmpP.dot(tan));
        if (axial > 0.038) continue;
        const radial = Math.sqrt(Math.max(0, tmpP.lengthSq() - axial * axial));
        if (radial > maxR && radial < maxCap) maxR = radial;
      }
      ringRadii[r] = maxR;
    }
    // Smooth ring radii
    for (let r = 1; r < rings; r++) {
      ringRadii[r] = ringRadii[r - 1] * 0.25 + ringRadii[r] * 0.5 + ringRadii[r + 1] * 0.25;
    }

    const nV = (rings + 1) * segs;
    const pos = new Float32Array(nV * 3);
    const uv = new Float32Array(nV * 2);
    const idx = [];
    const upRef = new THREE.Vector3(0, 0, 1);
    const nVec = new THREE.Vector3();
    const bVec = new THREE.Vector3();

    for (let r = 0; r <= rings; r++) {
      const vFrac = r / rings;
      const c = centers[r];
      const tan = tangents[r];
      upRef.set(0, 0, 1);
      if (Math.abs(tan.dot(upRef)) > 0.9) upRef.set(1, 0, 0);
      nVec.crossVectors(tan, upRef).normalize();
      bVec.crossVectors(tan, nVec).normalize();

      const ease = typeof spec.ease === 'function' ? spec.ease(vFrac) : (spec.ease || 0.015);
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        const pleat = spec.pleats ? Math.sin(a * spec.pleats) * 0.004 * (1 - vFrac * 0.4) : 0;
        const rad = ringRadii[r] + ease + pleat;
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        const vi = r * segs + s;
        pos[vi * 3] = c.x + (nVec.x * cosA + bVec.x * sinA) * rad;
        pos[vi * 3 + 1] = c.y + (nVec.y * cosA + bVec.y * sinA) * rad;
        pos[vi * 3 + 2] = c.z + (nVec.z * cosA + bVec.z * sinA) * rad;
        uv[vi * 2] = s / segs;
        uv[vi * 2 + 1] = vFrac;
      }
    }

    // Outward-facing winding order
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segs; s++) {
        const sNext = (s + 1) % segs;
        const a = r * segs + s;
        const b = r * segs + sNext;
        const d = (r + 1) * segs + s;
        const e = (r + 1) * segs + sNext;
        idx.push(a, b, d, b, e, d);
      }
    }

    return makeSkinnedParametricMesh(THREE, bodyMesh, vertList, pos, uv, idx, spec.material, spec.name);
  }

  /**
   * Build clean minimalist Ethiopian leather sandals hugging the exact measured foot geometry:
   * thin contoured leather sole + curved forefoot strap + slim ankle/heel strap at y = 0.
   */
  function buildEthiopianSandal(THREE, footBone, side, footM, heightScale, leatherMat, soleMat, disposables) {
    const group = new THREE.Group();
    group.name = `anny_v7_sandal_${side}`;
    const s = heightScale / 1.65;

    const fm = footM || {
      cx: 0, w: 0.088 * s, minY: -0.044 * s, maxY: 0.03 * s,
      minZ: -0.052 * s, maxZ: 0.185 * s, cz: 0.066 * s, len: 0.237 * s,
    };

    const soleThick = 0.011 * s;
    const soleW = Math.max(0.055 * s, fm.w * 1.04);
    const soleLen = Math.max(0.14 * s, fm.len * 1.02);
    const soleY = fm.minY - soleThick * 0.45;

    // Rounded contoured leather sole using extruded pill/stadium shape
    const hw = soleW * 0.48;
    const hl = Math.max(0.01, soleLen * 0.5 - hw);
    const shape = new THREE.Shape();
    shape.moveTo(-hw, -hl);
    shape.lineTo(-hw, hl);
    shape.absarc(0, hl, hw, Math.PI, 0, true);
    shape.lineTo(hw, -hl);
    shape.absarc(0, -hl, hw, 0, Math.PI, true);

    const soleGeo = new THREE.ExtrudeGeometry(shape, {
      depth: soleThick,
      bevelEnabled: true,
      bevelThickness: 0.002 * s,
      bevelSize: 0.002 * s,
      bevelSegments: 2,
      curveSegments: 12,
    });
    soleGeo.rotateX(Math.PI * 0.5);

    const foreStrapGeo = new THREE.TorusGeometry(soleW * 0.50, 0.0075 * s, 6, 16, Math.PI);
    const ankleStrapGeo = new THREE.TorusGeometry(soleW * 0.46, 0.0065 * s, 6, 16, Math.PI * 1.15);
    disposables.push(soleGeo, foreStrapGeo, ankleStrapGeo);

    const sole = new THREE.Mesh(soleGeo, soleMat);
    sole.position.set(fm.cx, soleY + soleThick * 0.5, fm.cz);
    sole.castShadow = true;
    sole.receiveShadow = true;
    group.add(sole);

    // Forefoot leather strap arching cleanly across the instep
    const foreStrap = new THREE.Mesh(foreStrapGeo, leatherMat);
    foreStrap.position.set(fm.cx, soleY + soleThick * 0.35, fm.cz + soleLen * 0.14);
    foreStrap.scale.set(1.02, 0.62, 1.35);
    foreStrap.castShadow = true;
    group.add(foreStrap);

    // Slim ankle/heel leather strap
    const ankleStrap = new THREE.Mesh(ankleStrapGeo, leatherMat);
    ankleStrap.position.set(fm.cx, soleY + soleThick * 0.5 + 0.018 * s, fm.cz - soleLen * 0.20);
    ankleStrap.rotation.x = -0.32;
    ankleStrap.scale.set(0.98, 0.92, 1.0);
    ankleStrap.castShadow = true;
    group.add(ankleStrap);

    footBone.add(group);
    return { group, soleLocalY: soleY - soleThick * 0.55 };
  }

  /**
   * Strip Anny's built-in brown-skin eye.L / eye.R eyeball triangles from bodyMesh.geometry.index
   * so Anny's sculpted eyelid sockets open directly onto our real 3D ophthalmic eyeballs.
   */
  function stripAnnySkinEyeballs(bodyMesh, eyeVertMask) {
    const geo = bodyMesh.geometry;
    if (!geo || !geo.index || !eyeVertMask || geo.userData._eyesStripped) return 0;
    const oldIdx = geo.index.array;
    const kept = [];
    let removed = 0;
    for (let t = 0; t < oldIdx.length; t += 3) {
      const a = oldIdx[t];
      const b = oldIdx[t + 1];
      const c = oldIdx[t + 2];
      if (eyeVertMask[a] || eyeVertMask[b] || eyeVertMask[c]) {
        removed++;
        continue;
      }
      kept.push(a, b, c);
    }
    if (removed > 0) {
      geo.setIndex(kept);
      geo.userData._eyesStripped = true;
    }
    return removed;
  }

  /**
   * Build real 3D ophthalmic eyes (bright ivory-white sclera, dark iris + hazel ring, black pupil,
   * crisp wet catchlight, wide-open blinking eyelids) + recessed talking mouth interior
   * (dark oral cavity, upper/lower ivory teeth, tongue) seated cleanly inside Anny's face.
   */
  function buildEyesAndMouthV7(THREE, bodyMesh, headBone, bodyData, palette, disposables) {
    const hm = bodyData.headMetrics;
    const emL = bodyData.eyeMetrics && bodyData.eyeMetrics.L;
    const emR = bodyData.eyeMetrics && bodyData.eyeMetrics.R;

    // Remove Anny's brown skin eyeball spheres so our real ophthalmic sclera/iris shine through!
    stripAnnySkinEyeballs(bodyMesh, bodyData.eyeVertMask);

    const faceGroup = new THREE.Group();
    faceGroup.name = 'anny_v7_face_rig';

    const scleraMat = getSharedSolidMaterial(THREE, 'eye_sclera_v2', {
      color: 0xf7f3ea,
      emissive: 0x2a2620,
      emissiveIntensity: 0.35,
      roughness: 0.16,
      metalness: 0.0,
    });
    const irisOuterMat = getSharedSolidMaterial(THREE, 'eye_iris_outer', {
      color: 0x3b2010,
      roughness: 0.14,
      metalness: 0.04,
    });
    const irisMat = getSharedSolidMaterial(THREE, 'eye_iris_v2', {
      color: 0x1e0f07,
      roughness: 0.12,
      metalness: 0.05,
    });
    const pupilMat = getSharedSolidMaterial(THREE, 'eye_pupil_v2', {
      color: 0x050404,
      roughness: 0.06,
      metalness: 0.04,
    });
    const catchMat = getSharedSolidMaterial(THREE, 'eye_catchlight_v2', {
      color: 0xffffff,
      roughness: 0.0,
      metalness: 0.0,
      emissive: 0xffffff,
      emissiveIntensity: 1.0,
    });
    const lidMat = getSharedSkinMaterial(THREE, palette);
    const cavityMat = getSharedSolidMaterial(THREE, 'mouth_cavity', {
      color: 0x160707,
      roughness: 0.96,
    });
    const teethMat = getSharedSolidMaterial(THREE, 'mouth_teeth', {
      color: 0xf4ede0,
      roughness: 0.24,
    });
    const tongueMat = getSharedSolidMaterial(THREE, 'mouth_tongue', {
      color: 0x9b4644,
      roughness: 0.55,
    });

    const eyeR_rad = emL ? clamp(emL.r * 1.04, 0.011, 0.019) : Math.max(0.012, hm.rx * 0.18);
    const scleraGeo = new THREE.SphereGeometry(eyeR_rad, 18, 14);
    const irisOuterGeo = new THREE.CircleGeometry(eyeR_rad * 0.46, 16);
    const irisGeo = new THREE.CircleGeometry(eyeR_rad * 0.38, 16);
    const pupilGeo = new THREE.CircleGeometry(eyeR_rad * 0.20, 14);
    const catchGeo = new THREE.CircleGeometry(eyeR_rad * 0.095, 10);
    const lidGeo = new THREE.SphereGeometry(eyeR_rad * 1.07, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.46);
    disposables.push(scleraGeo, irisOuterGeo, irisGeo, pupilGeo, catchGeo, lidGeo);

    const upperLids = [];
    const brows = [];

    const mountEye = (em, sideSign) => {
      const eg = new THREE.Group();
      eg.name = `anny_v7_eye_${sideSign < 0 ? 'R' : 'L'}`;

      const sclera = new THREE.Mesh(scleraGeo, scleraMat);
      eg.add(sclera);

      const irisOuter = new THREE.Mesh(irisOuterGeo, irisOuterMat);
      irisOuter.position.set(0, 0, eyeR_rad * 0.94);
      eg.add(irisOuter);

      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.set(0, 0, eyeR_rad * 0.97);
      eg.add(iris);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(0, 0, eyeR_rad * 1.01);
      eg.add(pupil);

      const catchlight = new THREE.Mesh(catchGeo, catchMat);
      catchlight.position.set(eyeR_rad * 0.15, eyeR_rad * 0.17, eyeR_rad * 1.04);
      eg.add(catchlight);

      const lid = new THREE.Mesh(lidGeo, lidMat);
      lid.rotation.x = -0.74; // wide-open rest angle so bright white sclera + iris are 100% clear
      eg.add(lid);
      upperLids.push(lid);

      if (em) {
        eg.position.set(em.x, em.y, em.z + eyeR_rad * 0.08);
      } else {
        eg.position.set(hm.cx + sideSign * hm.rx * 0.38, hm.cy + hm.ry * 0.08, hm.cz + hm.rz * 0.72);
      }
      faceGroup.add(eg);
    };

    mountEye(emL, 1);
    mountEye(emR, -1);

    // Recessed 3D oral cavity + curved ivory upper/lower dental arches + moving pink tongue
    const mouthGroup = new THREE.Group();
    mouthGroup.name = 'anny_v7_mouth_interior';
    const mm = bodyData.mouthMetrics;
    const refEyeY = emL ? emL.y : (hm.cy + hm.ry * 0.08);
    const refEyeZ = emL ? emL.z : (hm.cz + hm.rz * 0.65);
    const refEyeSpan = (emL && emR) ? Math.abs(emL.x - emR.x) * 0.5 : (hm.rx * 0.38);
    const mouthY = mm ? mm.y : (refEyeY - refEyeSpan * 2.16);
    const mouthSurfaceZ = mm ? mm.surfaceZ : (refEyeZ + refEyeSpan * 0.55);
    const mouthW = mm ? mm.w : Math.max(0.026, refEyeSpan * 0.94);

    // Seated cleanly behind the parted lips so receding lip-seam vertices frame the oral cavity
    mouthGroup.position.set(hm.cx, mouthY - refEyeSpan * 0.05, mouthSurfaceZ - refEyeSpan * 0.22);

    // Procedural subtle tooth-segmentation texture for realistic ivory dental arches
    const teethArchMat = (() => {
      const ck = 'mouth_teeth_arch_v3';
      if (_materialCache.has(ck)) return _materialCache.get(ck);
      const tw = 128, th = 32;
      const td = new Uint8Array(tw * th * 4);
      for (let y = 0; y < th; y++) {
        const v = y / (th - 1);
        for (let x = 0; x < tw; x++) {
          const u = x / (tw - 1);
          // 8 visible front teeth across the arch with soft inter-tooth shading
          const toothPhase = (u * 8) % 1;
          const groove = Math.min(toothPhase, 1 - toothPhase);
          const sep = groove < 0.07 ? (0.84 + 0.16 * (groove / 0.07)) : 1.0;
          const gumFade = v < 0.20 ? (0.88 + 0.12 * (v / 0.20)) : 1.0;
          const shade = sep * gumFade;
          const i = (y * tw + x) * 4;
          td[i] = Math.round(245 * shade);
          td[i + 1] = Math.round(237 * shade);
          td[i + 2] = Math.round(222 * shade);
          td[i + 3] = 255;
        }
      }
      const ttex = new THREE.DataTexture(td, tw, th, THREE.RGBAFormat);
      if (THREE.SRGBColorSpace) ttex.colorSpace = THREE.SRGBColorSpace;
      ttex.needsUpdate = true;
      const tm = new THREE.MeshStandardMaterial({
        map: ttex,
        color: 0xf7f1e5,
        roughness: 0.24,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });
      _materialCache.set(ck, tm);
      return tm;
    })();

    const darkCavityMat = getSharedSolidMaterial(THREE, 'mouth_cavity_deep', {
      color: 0x1a0608,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    const pinkTongueMat = getSharedSolidMaterial(THREE, 'mouth_tongue_pink', {
      color: 0xb65256,
      roughness: 0.42,
      metalness: 0.02,
    });

    const archR = mouthW * 0.62;
    const archH = refEyeSpan * 0.135;
    const cavGeo = new THREE.SphereGeometry(mouthW * 0.66, 16, 12);
    const upperArchGeo = new THREE.CylinderGeometry(archR, archR * 0.96, archH, 18, 1, true, -0.78, 1.56);
    const lowerArchGeo = new THREE.CylinderGeometry(archR * 0.90, archR * 0.86, archH * 0.84, 16, 1, true, -0.72, 1.44);
    const tongueGeo = new THREE.SphereGeometry(mouthW * 0.38, 14, 10);
    disposables.push(cavGeo, upperArchGeo, lowerArchGeo, tongueGeo);

    // Deep dark oral cavity backdrop seated strictly inside the parted lips
    const cavity = new THREE.Mesh(cavGeo, darkCavityMat);
    cavity.position.set(0, -refEyeSpan * 0.05, -archR * 0.72);
    cavity.scale.set(0.92, 0.58, 0.56);
    mouthGroup.add(cavity);

    // Curved ivory upper dental arch (fixed to maxilla just behind upper lip)
    const upperTeeth = new THREE.Mesh(upperArchGeo, teethArchMat);
    upperTeeth.position.set(0, refEyeSpan * 0.045, -archR * 0.78);
    mouthGroup.add(upperTeeth);

    // Curved ivory lower dental arch (drops dynamically with jawOpen)
    const lowerTeeth = new THREE.Mesh(lowerArchGeo, teethArchMat);
    lowerTeeth.position.set(0, -refEyeSpan * 0.11, -archR * 0.82);
    mouthGroup.add(lowerTeeth);

    // Moving pink tongue seated inside the lower arch
    const tongue = new THREE.Mesh(tongueGeo, pinkTongueMat);
    tongue.position.set(0, -refEyeSpan * 0.14, -archR * 0.50);
    tongue.scale.set(0.88, 0.38, 0.90);
    mouthGroup.add(tongue);

    mouthGroup.visible = false;
    faceGroup.add(mouthGroup);

    headBone.add(faceGroup);

    return {
      faceGroup,
      upperLids,
      brows,
      mouthGroup,
      upperTeeth,
      lowerTeeth,
      tongue,
      hm,
      refEyeSpan,
    };
  }

  // ---------------------------------------------------------------------------
  // Real Multi-Row Verlet Cloth Simulation (Duster Coat Panels, Shamma, Tunic)
  // ---------------------------------------------------------------------------

  function createVerletClothPanel(THREE, opts) {
    const cols = opts.cols || 15;
    const rows = opts.rows || 7;
    const count = cols * rows;

    const pos = new Float32Array(count * 3);
    const prev = new Float32Array(count * 3);
    const nrm = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const pinned = new Uint8Array(count);

    // Build topology
    const idx = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = r * cols + (c + 1);
        const d = (r + 1) * cols + c;
        const e = (r + 1) * cols + (c + 1);
        idx.push(a, b, d, b, e, d);
      }
    }

    // Distance constraints: [i, j, restLen]
    const constraints = [];

    // Initialize rest positions using opts.initPoint(c, r, cols, rows, outVec)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        opts.initPoint(c, r, cols, rows, _vA);
        pos[i * 3] = prev[i * 3] = _vA.x;
        pos[i * 3 + 1] = prev[i * 3 + 1] = _vA.y;
        pos[i * 3 + 2] = prev[i * 3 + 2] = _vA.z;
        uv[i * 2] = c / Math.max(1, cols - 1);
        uv[i * 2 + 1] = 1 - r / Math.max(1, rows - 1);
        if (r === 0) pinned[i] = 1;
      }
    }

    const addConstraint = (i, j) => {
      const dx = pos[j * 3] - pos[i * 3];
      const dy = pos[j * 3 + 1] - pos[i * 3 + 1];
      const dz = pos[j * 3 + 2] - pos[i * 3 + 2];
      const len = Math.hypot(dx, dy, dz);
      if (len > 1e-5) constraints.push(i, j, len);
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (c < cols - 1) addConstraint(i, i + 1);
        if (r < rows - 1) addConstraint(i, i + cols);
        if (c < cols - 1 && r < rows - 1) {
          addConstraint(i, i + cols + 1);
          addConstraint(i + 1, i + cols);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const nrmAttr = new THREE.BufferAttribute(nrm, 3);
    nrmAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('normal', nrmAttr);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);

    const mesh = new THREE.Mesh(geo, opts.material);
    mesh.name = opts.name || 'anny_v7_verlet_cloth';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    const gravity = opts.gravity !== undefined ? opts.gravity : -8.5;
    const damping = opts.damping !== undefined ? opts.damping : 0.945;
    const flareOut = opts.flareOut || 0.0;
    let initialized = false;

    function computeNormalsFast() {
      nrm.fill(0);
      for (let k = 0; k < idx.length; k += 3) {
        const ia = idx[k] * 3;
        const ib = idx[k + 1] * 3;
        const ic = idx[k + 2] * 3;
        const abx = pos[ib] - pos[ia];
        const aby = pos[ib + 1] - pos[ia + 1];
        const abz = pos[ib + 2] - pos[ia + 2];
        const acx = pos[ic] - pos[ia];
        const acy = pos[ic + 1] - pos[ia + 1];
        const acz = pos[ic + 2] - pos[ia + 2];
        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;
        nrm[ia] += nx; nrm[ia + 1] += ny; nrm[ia + 2] += nz;
        nrm[ib] += nx; nrm[ib + 1] += ny; nrm[ib + 2] += nz;
        nrm[ic] += nx; nrm[ic + 1] += ny; nrm[ic + 2] += nz;
      }
      for (let i = 0; i < count; i++) {
        const o = i * 3;
        const l = Math.hypot(nrm[o], nrm[o + 1], nrm[o + 2]) || 1;
        nrm[o] /= l;
        nrm[o + 1] /= l;
        nrm[o + 2] /= l;
      }
    }

    function step(dt, windX, windZ, timeSec, capsules) {
      const h = clamp(dt, 0.001, 0.033);
      const h2 = h * h;

      // Update pinned row-0 anchors from live bones
      for (let c = 0; c < cols; c++) {
        opts.samplePin(c, cols, _vA);
        const o = c * 3;
        if (!initialized) {
          // Snap full panel cleanly on first frame to avoid initial stretch
          const dx = _vA.x - pos[o];
          const dy = _vA.y - pos[o + 1];
          const dz = _vA.z - pos[o + 2];
          for (let r = 0; r < rows; r++) {
            const ri = (r * cols + c) * 3;
            pos[ri] += dx; pos[ri + 1] += dy; pos[ri + 2] += dz;
            prev[ri] = pos[ri]; prev[ri + 1] = pos[ri + 1]; prev[ri + 2] = pos[ri + 2];
          }
        } else {
          prev[o] = pos[o];
          prev[o + 1] = pos[o + 1];
          prev[o + 2] = pos[o + 2];
          pos[o] = _vA.x;
          pos[o + 1] = _vA.y;
          pos[o + 2] = _vA.z;
        }
      }
      initialized = true;

      // Verlet integration for dynamic rows 1..rows-1
      const gust = Math.sin(timeSec * 2.3) * 0.35 + Math.sin(timeSec * 4.7) * 0.18;
      const wx = windX + gust * 0.42;
      const wz = windZ + Math.cos(timeSec * 1.9) * 0.32;

      for (let r = 1; r < rows; r++) {
        const rowFrac = r / (rows - 1);
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const o = i * 3;
          const px = pos[o], py = pos[o + 1], pz = pos[o + 2];
          const vx = (px - prev[o]) * damping;
          const vy = (py - prev[o + 1]) * damping;
          const vz = (pz - prev[o + 2]) * damping;
          prev[o] = px; prev[o + 1] = py; prev[o + 2] = pz;

          // Subtle outward flare force on lower duster panels so coat drapes gracefully
          let fx = wx * (0.4 + 0.6 * rowFrac);
          let fz = wz * (0.4 + 0.6 * rowFrac);
          if (flareOut > 0) {
            const anchorO = c * 3;
            const outX = px - pos[anchorO];
            const outZ = pz - pos[anchorO + 2];
            const outL = Math.hypot(outX, outZ) || 1;
            fx += (outX / outL) * flareOut * rowFrac;
            fz += (outZ / outL) * flareOut * rowFrac;
          }

          pos[o] = px + vx + fx * h2;
          pos[o + 1] = py + vy + gravity * h2;
          pos[o + 2] = pz + vz + fz * h2;
        }
      }

      // Distance constraint solver (3 iterations)
      const cLen = constraints.length;
      for (let iter = 0; iter < 3; iter++) {
        for (let k = 0; k < cLen; k += 3) {
          const i = constraints[k];
          const j = constraints[k + 1];
          const rest = constraints[k + 2];
          const oi = i * 3;
          const oj = j * 3;
          const dx = pos[oj] - pos[oi];
          const dy = pos[oj + 1] - pos[oi + 1];
          const dz = pos[oj + 2] - pos[oi + 2];
          const dist = Math.hypot(dx, dy, dz) || 1e-6;
          const diff = (dist - rest) / dist;
          const pi = pinned[i];
          const pj = pinned[j];
          if (pi && pj) continue;
          if (pi) {
            pos[oj] -= dx * diff;
            pos[oj + 1] -= dy * diff;
            pos[oj + 2] -= dz * diff;
          } else if (pj) {
            pos[oi] += dx * diff;
            pos[oi + 1] += dy * diff;
            pos[oi + 2] += dz * diff;
          } else {
            const half = diff * 0.5;
            pos[oi] += dx * half;
            pos[oi + 1] += dy * half;
            pos[oi + 2] += dz * half;
            pos[oj] -= dx * half;
            pos[oj + 1] -= dy * half;
            pos[oj + 2] -= dz * half;
          }
        }

        // Push dynamic cloth vertices outside live leg & torso capsule colliders
        if (capsules && capsules.length) {
          for (let i = cols; i < count; i++) {
            const o = i * 3;
            let px = pos[o], py = pos[o + 1], pz = pos[o + 2];
            for (let m = 0; m < capsules.length; m++) {
              const cap = capsules[m];
              const abx = cap.bx - cap.ax;
              const aby = cap.by - cap.ay;
              const abz = cap.bz - cap.az;
              const ab2 = abx * abx + aby * aby + abz * abz || 1e-6;
              const t = clamp(((px - cap.ax) * abx + (py - cap.ay) * aby + (pz - cap.az) * abz) / ab2, 0, 1);
              const cx = cap.ax + abx * t;
              const cy = cap.ay + aby * t;
              const cz = cap.az + abz * t;
              const dx = px - cx;
              const dy = py - cy;
              const dz = pz - cz;
              const d2 = dx * dx + dy * dy + dz * dz;
              const r = cap.r;
              if (d2 < r * r) {
                const d = Math.sqrt(d2) || 1e-5;
                const push = (r - d) / d;
                px += dx * push;
                py += dy * push * 0.35;
                pz += dz * push;
              }
            }
            // Keep cloth above ground (y >= 0.03 in root space)
            if (py < 0.03) py = 0.03;
            pos[o] = px; pos[o + 1] = py; pos[o + 2] = pz;
          }
        }
      }

      computeNormalsFast();
      posAttr.needsUpdate = true;
      nrmAttr.needsUpdate = true;
    }

    computeNormalsFast();

    return {
      mesh,
      cols,
      rows,
      vertCount: count,
      step,
      dispose: () => geo.dispose(),
    };
  }

  // ---------------------------------------------------------------------------
  // Head Groom Builders (4C Afro, Cornrows, Pleated Turban + Beard, Spring Locs)
  // ---------------------------------------------------------------------------
  function buildHeadGroomV7(THREE, headBone, hm, archKey, palette, disposables, springLocsOut) {
    const group = new THREE.Group();
    group.name = `anny_v7_groom_${archKey}`;

    const cx = hm.cx, cy = hm.cy, cz = hm.cz;
    const rx = hm.rx, ry = hm.ry, rz = hm.rz;

    const hairMat = getSharedSolidMaterial(THREE, `hair_${archKey}`, {
      color: palette.hairHex,
      roughness: 0.94,
      metalness: 0.0,
    });
    const brassMat = getSharedSolidMaterial(THREE, `brass_${palette.accentHex}`, {
      color: palette.accentHex,
      roughness: 0.28,
      metalness: 0.85,
    });

    if (archKey === 'adult_f') {
      // Imani: Dense sculpted matte 4C afro crown seated cleanly behind forehead hairline
      const crownGeo = new THREE.IcosahedronGeometry(1, 2);
      const puffGeo = new THREE.IcosahedronGeometry(rx * 0.36, 1);
      disposables.push(crownGeo, puffGeo);

      const core = new THREE.Mesh(crownGeo, hairMat);
      core.position.set(cx, cy + ry * 0.44, cz - rz * 0.40);
      core.scale.set(rx * 1.24, ry * 1.02, rz * 1.08);
      core.castShadow = true;
      group.add(core);

      const rings = [
        { y: 0.62, r: 0.86, count: 10, zBias: -0.38 },
        { y: 0.96, r: 0.60, count: 8, zBias: -0.32 },
        { y: 0.24, r: 0.90, count: 8, zBias: -0.44, backOnly: true },
      ];
      for (const ring of rings) {
        for (let i = 0; i < ring.count; i++) {
          const a = (i / ring.count) * Math.PI * 2 + ring.y;
          const px = Math.sin(a) * rx * ring.r;
          const pz = Math.cos(a) * rz * ring.r + rz * ring.zBias;
          if (pz > rz * 0.12) continue;
          if (ring.backOnly && pz > -rz * 0.06) continue;
          const puff = new THREE.Mesh(puffGeo, hairMat);
          puff.position.set(cx + px, cy + ry * ring.y, cz + pz);
          const sc = 0.84 + 0.22 * Math.sin(i * 2.5 + ring.y * 5);
          puff.scale.set(sc, sc * 0.92, sc);
          puff.castShadow = true;
          group.add(puff);
        }
      }
    } else if (archKey === 'child7') {
      // June: Fitted hair base + spring-physics hanging twisted locs
      const capGeo = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56);
      const locGeo = new THREE.CapsuleGeometry(rx * 0.09, rx * 0.42, 4, 7);
      // Shift capsule geometry down so pivot is at the scalp root!
      locGeo.translate(0, -rx * 0.26, 0);
      disposables.push(capGeo, locGeo);

      const cap = new THREE.Mesh(capGeo, hairMat);
      cap.position.set(cx, cy + ry * 0.22, cz - rz * 0.20);
      cap.scale.set(rx * 1.03, ry * 0.92, rz * 0.99);
      cap.castShadow = true;
      group.add(cap);

      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        if (Math.cos(ang) > 0.34) continue; // keep face unobstructed
        const elev = 0.38 + 0.34 * ((i % 3) / 2);
        const pivot = new THREE.Group();
        pivot.position.set(
          cx + Math.sin(ang) * rx * 0.95,
          cy + ry * elev,
          cz + Math.cos(ang) * rz * 0.90 - rz * 0.24
        );
        const restRx = 0.28 + Math.max(0, -Math.cos(ang)) * 0.22;
        const restRz = Math.sin(ang) * 0.30;
        pivot.rotation.set(restRx, 0, restRz);

        const loc = new THREE.Mesh(locGeo, hairMat);
        loc.castShadow = true;
        pivot.add(loc);
        group.add(pivot);

        springLocsOut.push({
          pivot,
          restRx,
          restRz,
          rx: restRx,
          rz: restRz,
          vrx: 0,
          vrz: 0,
          phase: i * 0.73,
        });
      }
    } else if (archKey === 'adult_m') {
      // Elder (Adult M): Pleated highland cloth turban + full sculpted beard & mustache
      const turbanMat = getSharedMaterial(THREE, 'turban_m', {
        baseHex: palette.turbanHex,
        stripeHex: palette.trouserHex,
        accentHex: palette.accentHex,
        mode: 'tibeb',
        repX: 3,
        repY: 1,
        roughness: 0.84,
      });

      const domeGeo = new THREE.SphereGeometry(1, 16, 12);
      const coilGeo = new THREE.TorusGeometry(rx * 0.98, rx * 0.19, 10, 24);
      const beardGeo = new THREE.SphereGeometry(1, 14, 10);
      const stacheGeo = new THREE.CapsuleGeometry(rx * 0.08, rx * 0.34, 4, 8);
      disposables.push(domeGeo, coilGeo, beardGeo, stacheGeo);

      const dome = new THREE.Mesh(domeGeo, turbanMat);
      dome.position.set(cx, cy + ry * 0.68, cz - rz * 0.14);
      dome.scale.set(rx * 1.14, ry * 0.66, rz * 1.14);
      dome.castShadow = true;
      group.add(dome);

      for (let k = 0; k < 4; k++) {
        const coil = new THREE.Mesh(coilGeo, turbanMat);
        coil.position.set(cx, cy + ry * (0.50 + k * 0.15), cz - rz * 0.12);
        coil.rotation.x = Math.PI * 0.5 + (k % 2 === 0 ? -0.10 : 0.12);
        coil.rotation.y = k * 0.28;
        coil.scale.set(1.06 - k * 0.04, 1.09 - k * 0.04, 1.0);
        coil.castShadow = true;
        group.add(coil);
      }

      // Full sculpted beard along jaw & chin (leaves mouth clear for lip-sync)
      const beard = new THREE.Mesh(beardGeo, hairMat);
      beard.position.set(cx, cy - ry * 0.78, cz + rz * 0.36);
      beard.scale.set(rx * 0.68, ry * 0.44, rz * 0.56);
      beard.castShadow = true;
      group.add(beard);

      const stache = new THREE.Mesh(stacheGeo, hairMat);
      stache.position.set(cx, cy - ry * 0.36, cz + rz * 0.86);
      stache.rotation.z = Math.PI * 0.5;
      group.add(stache);
    } else {
      // Makeda (Elder): Sculpted radiating Ethiopian cornrows + braided nape bun + gold studs
      const capGeo = new THREE.SphereGeometry(1, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.60);
      const rowGeo = new THREE.TorusGeometry(rx * 0.98, rx * 0.075, 7, 20, Math.PI * 0.92);
      const bunGeo = new THREE.SphereGeometry(rx * 0.42, 12, 10);
      const studGeo = new THREE.SphereGeometry(rx * 0.075, 8, 8);
      disposables.push(capGeo, rowGeo, bunGeo, studGeo);

      const cap = new THREE.Mesh(capGeo, hairMat);
      cap.position.set(cx, cy + ry * 0.24, cz - rz * 0.18);
      cap.scale.set(rx * 1.02, ry * 0.92, rz * 0.98);
      cap.castShadow = true;
      group.add(cap);

      // 9 parallel cornrow ridges sweeping front-to-back into the nape bun
      for (let i = -4; i <= 4; i++) {
        const ridge = new THREE.Mesh(rowGeo, hairMat);
        ridge.position.set(cx + i * rx * 0.19, cy + ry * 0.24, cz - rz * 0.14);
        ridge.rotation.y = Math.PI * 0.5;
        ridge.rotation.x = i * 0.11;
        ridge.scale.set(1.04 - Math.abs(i) * 0.04, 1.02 - Math.abs(i) * 0.04, 1.0);
        ridge.castShadow = true;
        group.add(ridge);
      }

      const bun = new THREE.Mesh(bunGeo, hairMat);
      bun.position.set(cx, cy + ry * 0.14, cz - rz * 1.08);
      bun.scale.set(1.14, 0.94, 0.98);
      bun.castShadow = true;
      group.add(bun);
    }

    headBone.add(group);
    return group;
  }

  // ---------------------------------------------------------------------------
  // Core V7 Dressing + Cloth Physics + Lip-Sync + Ground Pinning
  // ---------------------------------------------------------------------------
  function dressAnnyV7(THREE, annyRoot, archetype, opts) {
    ensureScratch(THREE);
    const options = Object.assign({ clothed: true, groundY: 0, pinMode: 'exact' }, opts || {});
    const archKey = ARCHETYPES[archetype] ? archetype : 'adult_f';
    const palette = ARCHETYPES[archKey];

    let bodyMesh = null;
    const bonesByName = new Map();
    const bonesByNorm = new Map();
    const restQuats = new Map();

    annyRoot.traverse((o) => {
      if (o.isSkinnedMesh && !bodyMesh) bodyMesh = o;
      if (o.isBone) {
        bonesByName.set(o.name, o);
        bonesByNorm.set(normName(o.name), o);
        restQuats.set(o.name, o.quaternion.clone());
      }
    });

    if (!bodyMesh || !bodyMesh.skeleton) {
      return null;
    }

    const bodyData = analyzeBody(THREE, bodyMesh, bonesByNorm);
    const { minY, height, centerZ, sampleTorsoRadius } = bodyData;
    const hScale = height / 1.65;

    // Attach GPU lip-sync morph targets to Anny's face
    const headBone = bonesByNorm.get('head');
    const hasLipMorphs = attachFacialLipSyncMorphs(THREE, bodyMesh, bodyData, headBone);

    const disposables = [];
    const garmentMeshes = [];
    const attachedObjects = [];
    const clothPanels = [];
    const springLocs = [];

    const melaninMat = getSharedSkinMaterial(THREE, palette);
    const clayMat = getSharedClayMaterial(THREE);
    const parentObj = bodyMesh.parent || annyRoot;

    const addGarment = (mesh) => {
      if (!mesh) return null;
      parentObj.add(mesh);
      garmentMeshes.push(mesh);
      disposables.push(mesh.geometry);
      return mesh;
    };

    const bootMat = getSharedMaterial(THREE, `boot_${archKey}`, {
      baseHex: palette.bootHex,
      mode: 'leather',
      repX: 2,
      repY: 2,
      roughness: 0.72,
    });
    const soleMat = getSharedSolidMaterial(THREE, `sole_${archKey}`, {
      color: palette.soleHex,
      roughness: 0.90,
      metalness: 0.04,
    });
    const brassMat = getSharedSolidMaterial(THREE, `brass_${palette.accentHex}`, {
      color: palette.accentHex,
      roughness: 0.30,
      metalness: 0.82,
    });

    // Helper for pelvis/spine bone anchor lookup in root space
    const pelvisL = bonesByNorm.get('pelvisl') || bonesByNorm.get('root');
    const pelvisR = bonesByNorm.get('pelvisr') || bonesByNorm.get('root');
    const spineLow = bonesByNorm.get('spine05') || bonesByNorm.get('root');
    const spineMid = bonesByNorm.get('spine03') || spineLow;
    const spineTop = bonesByNorm.get('spine01') || spineMid;
    const shoulderL = bonesByNorm.get('shoulder01l') || bonesByNorm.get('claviclel') || spineTop;
    const thighL = bonesByNorm.get('upperleg01l');
    const thighR = bonesByNorm.get('upperleg01r');
    const shinL = bonesByNorm.get('lowerleg01l');
    const shinR = bonesByNorm.get('lowerleg01r');
    const footL = bonesByNorm.get('footl');
    const footR = bonesByNorm.get('footr');
    const toeL = bonesByNorm.get('toe21l') || footL;
    const toeR = bonesByNorm.get('toe21r') || footR;

    // Helper predicates for continuous one-piece connected manifold garments
    const isLegBone = (b) => b.startsWith('pelvis') || b.startsWith('upperleg') || b.startsWith('lowerleg');
    const isTorsoBone = (b) => b.startsWith('spine') || b.startsWith('clavicle') || b.startsWith('shoulder') || b === 'root';
    const isUpperArmBone = (b) => b.startsWith('upperarm');
    const isLowerArmBone = (b) => b.startsWith('lowerarm');
    const isFullTrouserVert = (yn, b) => {
      if (yn < 0.068) return false; // clean ankle cuff above sandal
      if (isLegBone(b)) return true;
      if ((b === 'spine05' || b === 'spine04' || b === 'root') && yn <= 0.565) return true;
      return false;
    };

    // -------------------------------------------------------------------------
    // Archetype-Specific Continuous One-Piece Skinned Garments + Verlet Cloth
    // -------------------------------------------------------------------------
    if (archKey === 'adult_f') {
      // 1. Continuous scoop inner tunic (smooth hem, clean scooped neckline)
      const tunicMat = getSharedMaterial(THREE, 'imani_tunic', {
        baseHex: palette.tunicHex,
        mode: 'weave',
        repX: 4,
        repY: 4,
        roughness: 0.86,
        doubleSide: true,
      });
      addGarment(buildManifoldGarment(THREE, bodyMesh, bodyData, {
        name: 'imani_v7_tunic',
        material: tunicMat,
        includeVertex: (v, x, y, z, yn, b) => {
          if (!isTorsoBone(b)) return false;
          const scoop = z > centerZ ? 0.042 * Math.max(0, 1 - Math.abs(x) / (0.12 * hScale)) : 0.008;
          return yn >= 0.49 && yn <= 0.825 - scoop;
        },
        offset: 0.0065,
      }));

      // 2. Continuous one-piece full-length tailored trousers (pelvis + waist + crotch + both legs)
      const trouserMat = getSharedMaterial(THREE, 'imani_trousers', {
        baseHex: palette.trouserHex,
        mode: 'twill',
        repX: 3,
        repY: 4,
        roughness: 0.88,
        doubleSide: true,
      });
      addGarment(buildManifoldGarment(THREE, bodyMesh, bodyData, {
        name: 'imani_v7_trousers_onepiece',
        material: trouserMat,
        includeVertex: (v, x, y, z, yn, b) => isFullTrouserVert(yn, b),
        offset: (v, yn) => (yn < 0.14 ? 0.012 : 0.010) * hScale,
      }));

      // 3. Continuous one-piece open-front tailored duster coat (torso + shoulders + full long sleeves)
      const coatMat = getSharedMaterial(THREE, 'imani_coat', {
        baseHex: palette.coatHex,
        mode: 'twill',
        repX: 3,
        repY: 4,
        roughness: 0.82,
        doubleSide: true,
      });
      addGarment(buildManifoldGarment(THREE, bodyMesh, bodyData, {
        name: 'imani_v7_duster_onepiece',
        material: coatMat,
        includeVertex: (v, x, y, z, yn, b) => {
          const isSleeve = isUpperArmBone(b) || isLowerArmBone(b);
          if (!isTorsoBone(b) && !isSleeve) return false;
          if (!isSleeve) {
            if (yn < 0.53 || yn > 0.842) return false;
            // Clean open-front center placket revealing inner cream tunic
            if (z > centerZ + 0.02 * hScale && Math.abs(x) < 0.056 * hScale) return false;
          }
          return true;
        },
        offset: (v, yn, x, z, isBnd, b) => {
          if (isLowerArmBone(b)) return (isBnd ? 0.015 : 0.010) * hScale;
          return 0.0125 * hScale;
        },
      }));

      // 4. REAL VERLET-SIMULATED FLARING LOWER DUSTER COAT PANEL (waist 0.545 down to mid-calf 0.22)
      const waistY = minY + 0.545 * height;
      const hemY = minY + 0.225 * height;
      const openHalf = 0.62;
      const dusterCols = 17;
      const dusterRows = 7;

      const dusterPanel = createVerletClothPanel(THREE, {
        name: 'imani_v7_verlet_duster_skirt',
        material: coatMat,
        cols: dusterCols,
        rows: dusterRows,
        gravity: -8.4,
        damping: 0.94,
        flareOut: 2.35,
        initPoint: (c, r, cols, rows, out) => {
          const u = c / (cols - 1);
          const v = r / (rows - 1);
          const theta = lerp(openHalf, Math.PI * 2 - openHalf, u);
          const rad = sampleTorsoRadius(0.545, theta) + (0.020 + v * 0.062) * hScale;
          out.set(Math.sin(theta) * rad, lerp(waistY, hemY, v), centerZ + Math.cos(theta) * rad);
        },
        samplePin: (c, cols, out) => {
          const u = c / (cols - 1);
          const theta = lerp(openHalf, Math.PI * 2 - openHalf, u);
          const rad = sampleTorsoRadius(0.545, theta) + 0.020 * hScale;
          _vB.set(Math.sin(theta) * rad, 0.01 * hScale, Math.cos(theta) * rad);
          spineLow.updateMatrixWorld(false);
          _vB.applyMatrix4(spineLow.matrixWorld);
          out.copy(_vB).applyMatrix4(_matInv);
        },
      });
      annyRoot.add(dusterPanel.mesh);
      clothPanels.push(dusterPanel);
      garmentMeshes.push(dusterPanel.mesh);

      // 5. Buckled leather tool-belt + brass buckle
      const beltMat = getSharedMaterial(THREE, 'imani_belt', {
        baseHex: palette.beltHex,
        mode: 'leather',
        repX: 4,
        repY: 1,
        roughness: 0.65,
      });
      const beltGroup = new THREE.Group();
      beltGroup.name = 'imani_v7_tool_belt';
      const waistR = sampleTorsoRadius(0.55, 0) + 0.014 * hScale;
      const beltGeo = new THREE.TorusGeometry(waistR, 0.013 * hScale, 8, 28);
      const buckleGeo = new THREE.BoxGeometry(0.042 * hScale, 0.032 * hScale, 0.016 * hScale);
      disposables.push(beltGeo, buckleGeo);

      const belt = new THREE.Mesh(beltGeo, beltMat);
      belt.rotation.x = Math.PI * 0.5;
      belt.scale.set(1.10, 0.90, 1.0);
      belt.castShadow = true;
      beltGroup.add(belt);

      const buckle = new THREE.Mesh(buckleGeo, brassMat);
      buckle.position.set(0, 0, waistR * 0.92);
      beltGroup.add(buckle);

      spineLow.add(beltGroup);
      attachedObjects.push(beltGroup);
    } else if (archKey === 'child7') {
      // June: Continuous one-piece woven knit tunic (torso + shoulders + short sleeves — ZERO bare shoulder gaps!)
      // + Continuous one-piece full-length trousers (pelvis + waist + legs — ZERO bare waist/crotch gaps!)
      const tunicMat = getSharedMaterial(THREE, 'june_tunic', {
        baseHex: palette.tunicHex,
        accentHex: palette.tunicAccentHex,
        mode: 'knit',
        repX: 4,
        repY: 4,
        roughness: 0.88,
        doubleSide: true,
      });
      const trouserMat = getSharedMaterial(THREE, 'june_trousers', {
        baseHex: palette.trouserHex,
        mode: 'twill',
        repX: 3,
        repY: 4,
        roughness: 0.86,
        doubleSide: true,
      });

      addGarment(buildManifoldGarment(THREE, bodyMesh, bodyData, {
        name: 'june_v7_knit_tunic_onepiece',
        material: tunicMat,
        includeVertex: (v, x, y, z, yn, b) => {
          // Contiguous torso + clavicle + shoulder + upper bicep short-sleeve
          if (b === 'upperarm01l' || b === 'upperarm01r') return yn >= 0.725;
          if (!isTorsoBone(b)) return false;
          const scoop = z > centerZ ? 0.028 * Math.max(0, 1 - Math.abs(x) / (0.10 * hScale)) : 0.008;
          return yn >= 0.495 && yn <= 0.805 - scoop;
        },
        offset: 0.0095,
      }));

      addGarment(buildManifoldGarment(THREE, bodyMesh, bodyData, {
        name: 'june_v7_trousers_onepiece',
        material: trouserMat,
        includeVertex: (v, x, y, z, yn, b) => {
          if (yn < 0.068) return false;
          if (isLegBone(b)) return true;
          if ((b === 'spine05' || b === 'spine04' || b === 'root') && yn <= 0.54) return true;
          return false;
        },
        offset: 0.009,
      }));
    } else {
      // Makeda (elder) & Elder (adult_m): Continuous one-piece long-sleeve tunic + one-piece trousers
      // + Diagonally Draped Multi-Fold Shamma/Gabi + Verlet Shoulder Drape
      const tunicMat = getSharedMaterial(THREE, `${archKey}_tunic`, {
        baseHex: palette.tunicHex,
        mode: 'weave',
        repX: 4,
        repY: 4,
        roughness: 0.85,
        doubleSide: true,
      });
      const trouserMat = getSharedMaterial(THREE, `${archKey}_trousers`, {
        baseHex: palette.trouserHex,
        mode: 'twill',
        repX: 3,
        repY: 4,
        roughness: 0.88,
        doubleSide: true,
      });
      const shammaMat = getSharedMaterial(THREE, `${archKey}_shamma`, {
        baseHex: palette.shammaHex,
        stripeHex: palette.tunicHex,
        accentHex: palette.accentHex,
        mode: 'tibeb',
        repX: 2,
        repY: 1,
        roughness: 0.84,
        doubleSide: true,
      });

      addGarment(buildManifoldGarment(THREE, bodyMesh, bodyData, {
        name: `${archKey}_v7_tunic_onepiece`,
        material: tunicMat,
        includeVertex: (v, x, y, z, yn, b) => {
          const isSleeve = isUpperArmBone(b) || isLowerArmBone(b);
          if (!isTorsoBone(b) && !isSleeve) return false;
          if (!isSleeve) {
            const scoop = z > centerZ ? 0.025 * Math.max(0, 1 - Math.abs(x) / (0.11 * hScale)) : 0.008;
            return yn >= 0.44 && yn <= 0.832 - scoop;
          }
          return true;
        },
        offset: 0.0095,
      }));

      addGarment(buildManifoldGarment(THREE, bodyMesh, bodyData, {
        name: `${archKey}_v7_trousers_onepiece`,
        material: trouserMat,
        includeVertex: (v, x, y, z, yn, b) => isFullTrouserVert(yn, b),
        offset: 0.0085,
      }));

      // Diagonally draped multi-fold shamma / gabi wrap around chest & waist
      addGarment(buildTorsoLoft(THREE, bodyMesh, bodyData, {
        name: `${archKey}_v7_shamma_wrap`,
        material: shammaMat,
        rings: 12,
        segs: 30,
        yMin: (theta) => 0.49 + Math.sin(theta) * 0.075,
        yMax: (theta) => 0.77 + Math.sin(theta) * 0.065,
        ease: (v, u, theta) => (0.024 + Math.sin(v * Math.PI * 5) * 0.004 + Math.max(0, Math.sin(theta)) * 0.005) * hScale,
      }));

      // Verlet-simulated hanging shoulder drape panel pinned to left shoulder
      const shTopY = minY + 0.81 * height;
      const shBotY = minY + 0.30 * height;
      const drapePanel = createVerletClothPanel(THREE, {
        name: `${archKey}_v7_verlet_shamma_drape`,
        material: shammaMat,
        cols: 8,
        rows: 8,
        gravity: -8.2,
        damping: 0.945,
        flareOut: 0.8,
        initPoint: (c, r, cols, rows, out) => {
          const u = c / (cols - 1);
          const v = r / (rows - 1);
          out.set(
            (0.11 + u * 0.14) * hScale,
            lerp(shTopY, shBotY, v),
            centerZ - (0.06 + v * 0.09 + u * 0.04) * hScale
          );
        },
        samplePin: (c, cols, out) => {
          const u = c / (cols - 1);
          _vB.set((u - 0.5) * 0.14 * hScale, 0.035 * hScale, -0.055 * hScale);
          shoulderL.updateMatrixWorld(false);
          _vB.applyMatrix4(shoulderL.matrixWorld);
          out.copy(_vB).applyMatrix4(_matInv);
        },
      });
      annyRoot.add(drapePanel.mesh);
      clothPanels.push(drapePanel);
      garmentMeshes.push(drapePanel.mesh);
    }

    // Clean minimalist Ethiopian leather sandals (contoured thin sole + forefoot & ankle straps at y = 0)
    let bootSoleOffsetL = -0.048 * hScale;
    let bootSoleOffsetR = -0.048 * hScale;
    if (footL) {
      const sL = buildEthiopianSandal(THREE, footL, 'L', bodyData.footMetrics.L, height, bootMat, soleMat, disposables);
      attachedObjects.push(sL.group);
      bootSoleOffsetL = sL.soleLocalY;
    }
    if (footR) {
      const sR = buildEthiopianSandal(THREE, footR, 'R', bodyData.footMetrics.R, height, bootMat, soleMat, disposables);
      attachedObjects.push(sR.group);
      bootSoleOffsetR = sR.soleLocalY;
    }

    // Real 3D ophthalmic eyes (bright white sclera + iris + pupil + catchlight) & talking mouth interior
    let faceRig = null;
    if (headBone) {
      faceRig = buildEyesAndMouthV7(THREE, bodyMesh, headBone, bodyData, palette, disposables);
    }

    // Head groom
    let groomGroup = null;
    if (headBone) {
      groomGroup = buildHeadGroomV7(THREE, headBone, bodyData.headMetrics, archKey, palette, disposables, springLocs);
      attachedObjects.push(groomGroup);
    }

    // Measure bare-foot sole offset in bind pose for Base Mesh mode
    annyRoot.updateMatrixWorld(true);
    let bareSoleOffset = -0.042 * hScale;
    if (footL) {
      footL.getWorldPosition(_vA);
      bareSoleOffset = minY - _vA.y;
    }

    // State
    let isClothed = !!options.clothed;
    let groundY = Number(options.groundY) || 0;
    let windX = 0.25;
    let windZ = -0.35;
    let simTime = 0;
    let expressionName = 'neutral';
    let hasExplicitSpeech = false;
    let blinkTimer = 2.8;
    let blinkPhase = 0;
    let currentViseme = { viseme: 'SIL', jawOpen: 0, mouthWide: 0, mouthRound: 0, lipPress: 0.05, active: false };
    const targetViseme = { viseme: 'SIL', jawOpen: 0, mouthWide: 0, mouthRound: 0, lipPress: 0.05, active: false };
    const smoothMorph = [0, 0, 0, 0, 0, 0];
    let lastFootMinY = groundY;
    const prevHeadPos = new THREE.Vector3();
    let hasPrevHead = false;
    const AUTO_TALK_LINES = [
      'Selam, the highland spring rises at dawn across the terrace.',
      'Carry the bright water carefully over the stone steps.',
      'Tena yistilign, listen to the wind through the courtyard.',
    ];

    // Preallocated capsule array for Verlet cloth collision (zero per-frame GC)
    const capsules = [
      { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r: 0.095 * hScale }, // thighL -> shinL
      { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r: 0.095 * hScale }, // thighR -> shinR
      { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r: 0.072 * hScale }, // shinL -> footL
      { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r: 0.072 * hScale }, // shinR -> footR
      { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r: 0.135 * hScale }, // torso spineLow -> spineTop
    ];

    function setClothed(flag) {
      isClothed = !!flag;
      bodyMesh.material = isClothed ? melaninMat : clayMat;
      for (let i = 0; i < garmentMeshes.length; i++) garmentMeshes[i].visible = isClothed;
      for (let i = 0; i < attachedObjects.length; i++) attachedObjects[i].visible = isClothed;
      return isClothed;
    }

    function setWireframe(flag) {
      const wf = !!flag;
      annyRoot.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (let i = 0; i < mats.length; i++) mats[i].wireframe = wf;
        }
      });
    }

    function setGroundY(y) {
      groundY = Number(y) || 0;
    }

    function setWind(vx, vz) {
      windX = Number(vx) || 0;
      windZ = Number(vz) || 0;
    }

    function setLyricSpeech(text, progress01, audioLevel) {
      hasExplicitSpeech = !!(text && String(text).trim());
      sampleLyricViseme(text, progress01, audioLevel, targetViseme);
      return targetViseme;
    }

    function setJawOpenness(open01) {
      const v = clamp(Number(open01) || 0, 0, 1);
      hasExplicitSpeech = v > 0.02;
      targetViseme.viseme = v > 0.12 ? 'AA' : 'SIL';
      targetViseme.jawOpen = v;
      targetViseme.mouthWide = v * 0.25;
      targetViseme.mouthRound = v * 0.15;
      targetViseme.lipPress = v < 0.05 ? 0.1 : 0;
      targetViseme.active = v > 0.08;
    }

    function setVisemeShape(jawOpen, mouthWide, mouthRound, lipPress, visemeName) {
      const j = clamp(Number(jawOpen) || 0, 0, 1);
      const w = clamp(Number(mouthWide) || 0, 0, 1);
      const r = clamp(Number(mouthRound) || 0, 0, 1);
      const p = clamp(Number(lipPress) || 0, 0, 1);
      hasExplicitSpeech = j > 0.02 || w > 0.05 || r > 0.05;
      targetViseme.viseme = visemeName || (j > 0.12 ? 'AA' : 'SIL');
      targetViseme.jawOpen = j;
      targetViseme.mouthWide = w;
      targetViseme.mouthRound = r;
      targetViseme.lipPress = p;
      targetViseme.active = hasExplicitSpeech;
    }

    function setExpression(name) {
      const key = EXPRESSIONS[name] ? name : 'neutral';
      expressionName = key;
      if (key !== 'talking') hasExplicitSpeech = false;
      return key;
    }

    function getExpression() {
      return expressionName;
    }

    function updateCapsules() {
      _matInv.copy(annyRoot.matrixWorld).invert();
      const setCap = (idx, bA, bB, radius) => {
        if (!bA || !bB) return;
        bA.getWorldPosition(_vA).applyMatrix4(_matInv);
        bB.getWorldPosition(_vB).applyMatrix4(_matInv);
        const cap = capsules[idx];
        cap.ax = _vA.x; cap.ay = _vA.y; cap.az = _vA.z;
        cap.bx = _vB.x; cap.by = _vB.y; cap.bz = _vB.z;
        cap.r = radius;
      };
      setCap(0, thighL, shinL, 0.118 * hScale);
      setCap(1, thighR, shinR, 0.118 * hScale);
      setCap(2, shinL, footL, 0.088 * hScale);
      setCap(3, shinR, footR, 0.088 * hScale);
      setCap(4, spineLow, spineTop, 0.145 * hScale);
    }

    function pinFeetToGround() {
      annyRoot.updateMatrixWorld(true);
      const soleOffL = isClothed ? bootSoleOffsetL : bareSoleOffset;
      const soleOffR = isClothed ? bootSoleOffsetR : bareSoleOffset;
      let minFootY = Infinity;

      if (footL) {
        footL.getWorldPosition(_vA);
        const yL = _vA.y + soleOffL;
        if (yL < minFootY) minFootY = yL;
      }
      if (footR) {
        footR.getWorldPosition(_vA);
        const yR = _vA.y + soleOffR;
        if (yR < minFootY) minFootY = yR;
      }
      if (toeL) {
        toeL.getWorldPosition(_vA);
        const yTL = _vA.y + soleOffL * 0.45;
        if (yTL < minFootY) minFootY = yTL;
      }
      if (toeR) {
        toeR.getWorldPosition(_vA);
        const yTR = _vA.y + soleOffR * 0.45;
        if (yTR < minFootY) minFootY = yTR;
      }

      if (Number.isFinite(minFootY)) {
        const dy = groundY - minFootY;
        annyRoot.position.y += dy;
        annyRoot.updateMatrixWorld(true);
        lastFootMinY = minFootY + dy;
      }
    }

    function update(dt, uOpts) {
      const h = clamp(Number(dt) || 0.016, 0.001, 0.05);
      simTime += h;

      // 1. Exact foot-to-ground pinning (skipped during articulated ragdoll physics)
      if (!uOpts || !uOpts.skipGroundPin) {
        pinFeetToGround();
      }

      // 2. Smooth GPU morph-target lip-sync & facial expression update
      const expr = EXPRESSIONS[expressionName] || EXPRESSIONS.neutral;
      if (expr.autoTalk && !hasExplicitSpeech) {
        const lineDur = 3.8;
        const lineIdx = Math.floor(simTime / lineDur) % AUTO_TALK_LINES.length;
        const p01 = (simTime % lineDur) / lineDur;
        const env = p01 < 0.88 ? 0.72 + 0.28 * Math.sin(simTime * 11.0) : 0.0;
        sampleLyricViseme(AUTO_TALK_LINES[lineIdx], p01, env, targetViseme);
      }

      const wantJaw = clamp(Math.max(targetViseme.jawOpen, expr.jaw), 0, 1);
      const wantWide = clamp(targetViseme.mouthWide + expr.wide, -0.25, 1);
      const wantRound = clamp(Math.max(targetViseme.mouthRound, expr.round), 0, 1);
      const wantPress = clamp(Math.max(targetViseme.lipPress, expr.press), 0, 1);
      const wantBrowDn = expr.browY < 0 ? clamp(-expr.browY * 140, 0, 1) : 0;
      const wantBrowUp = expr.browY > 0 ? clamp(expr.browY * 110, 0, 1) : 0;

      const rate = 1 - Math.exp(-18 * h);
      smoothMorph[0] = lerp(smoothMorph[0], wantJaw, rate);
      smoothMorph[1] = lerp(smoothMorph[1], wantWide, rate);
      smoothMorph[2] = lerp(smoothMorph[2], wantRound, rate);
      smoothMorph[3] = lerp(smoothMorph[3], wantPress, rate);
      smoothMorph[4] = lerp(smoothMorph[4], wantBrowDn, rate);
      smoothMorph[5] = lerp(smoothMorph[5], wantBrowUp, rate);

      if (hasLipMorphs && bodyMesh.morphTargetInfluences) {
        bodyMesh.morphTargetInfluences[0] = smoothMorph[0];
        bodyMesh.morphTargetInfluences[1] = Math.max(0, smoothMorph[1]);
        bodyMesh.morphTargetInfluences[2] = smoothMorph[2];
        bodyMesh.morphTargetInfluences[3] = smoothMorph[3];
        if (bodyMesh.morphTargetInfluences.length >= 6) {
          bodyMesh.morphTargetInfluences[4] = smoothMorph[4];
          bodyMesh.morphTargetInfluences[5] = smoothMorph[5];
        }
        currentViseme = targetViseme;
      }

      // 2b. Real 3D eyes (wide-open white sclera + natural blink) & talking mouth interior
      if (faceRig) {
        blinkTimer -= h;
        if (blinkTimer <= 0) {
          blinkPhase = 1.0;
          blinkTimer = 2.6 + ((Math.sin(simTime * 3.7) * 0.5 + 0.5) * 2.8);
        }
        if (blinkPhase > 0) {
          blinkPhase = Math.max(0, blinkPhase - h * 6.5);
        }
        const blinkAmt = Math.sin(blinkPhase * Math.PI);
        const lidAngle = -0.74 + expr.lidDrop * 0.35 + blinkAmt * 1.15;
        for (let i = 0; i < faceRig.upperLids.length; i++) {
          faceRig.upperLids[i].rotation.x = lidAngle;
        }
        const jawNow = smoothMorph[0];
        faceRig.mouthGroup.visible = jawNow > 0.06;
        if (faceRig.mouthGroup.visible) {
          const sp = faceRig.refEyeSpan || (faceRig.hm.rx * 0.38);
          faceRig.mouthGroup.scale.set(
            0.90 + Math.max(0, smoothMorph[1]) * 0.22 - smoothMorph[2] * 0.24,
            0.48 + jawNow * 0.92,
            1.0
          );
          faceRig.lowerTeeth.position.y = -sp * (0.10 + jawNow * 0.28);
          const tongueLift = (currentViseme.viseme === 'LL' || currentViseme.viseme === 'TH' || currentViseme.viseme === 'EE') ? 0.08 : 0.0;
          faceRig.tongue.position.y = -sp * (0.14 + jawNow * 0.16 - tongueLift);
          faceRig.tongue.rotation.x = -0.15 + tongueLift * 3.2;
        }
      }

      // 3. Verlet cloth physics step (with live leg/torso capsule colliders)
      if (isClothed && clothPanels.length) {
        updateCapsules();
        for (let i = 0; i < clothPanels.length; i++) {
          clothPanels[i].step(h, windX, windZ, simTime, capsules);
        }
      }

      // 4. Spring-physics hanging locs (June)
      if (isClothed && springLocs.length && headBone) {
        headBone.getWorldPosition(_vC);
        let accX = 0, accZ = 0;
        if (hasPrevHead) {
          accX = clamp((_vC.x - prevHeadPos.x) / h, -3, 3);
          accZ = clamp((_vC.z - prevHeadPos.z) / h, -3, 3);
        }
        prevHeadPos.copy(_vC);
        hasPrevHead = true;

        const stiffness = 36;
        const damp = 5.5;
        for (let i = 0; i < springLocs.length; i++) {
          const loc = springLocs[i];
          const breeze = Math.sin(simTime * 2.8 + loc.phase) * 0.06;
          const forceRx = (loc.restRx - loc.rx) * stiffness - loc.vrx * damp - accZ * 0.55 + breeze;
          const forceRz = (loc.restRz - loc.rz) * stiffness - loc.vrz * damp + accX * 0.55 + breeze * 0.6;
          loc.vrx += forceRx * h;
          loc.vrz += forceRz * h;
          loc.rx = clamp(loc.rx + loc.vrx * h, -0.5, 1.2);
          loc.rz = clamp(loc.rz + loc.vrz * h, -0.85, 0.85);
          loc.pivot.rotation.x = loc.rx;
          loc.pivot.rotation.z = loc.rz;
        }
      }
    }

    // Apply initial clothed state & ground pin
    setClothed(isClothed);
    pinFeetToGround();

    let totalClothVerts = 0;
    for (let i = 0; i < clothPanels.length; i++) totalClothVerts += clothPanels[i].vertCount;

    return {
      archetype: archKey,
      palette,
      bodyMesh,
      bonesByName,
      bonesByNorm,
      restQuats,
      isClothed: () => isClothed,
      setClothed,
      setWireframe,
      setGroundY,
      setWind,
      setLyricSpeech,
      setJawOpenness,
      setVisemeShape,
      setExpression,
      getExpression,
      pinFeetToGround,
      update,
      getMetrics: () => ({
        archetype: archKey,
        height: Number(height.toFixed(3)),
        groundY: Number(groundY.toFixed(3)),
        footMinY: Number(lastFootMinY.toFixed(4)),
        clothPanels: clothPanels.length,
        clothVerts: totalClothVerts,
        springLocs: springLocs.length,
        hasLipMorphs,
        hasEyesRig: !!faceRig,
        expression: expressionName,
        viseme: currentViseme.viseme,
        jawOpen: Number(smoothMorph[0].toFixed(3)),
      }),
      dispose: () => {
        if (faceRig && faceRig.faceGroup && faceRig.faceGroup.parent) {
          faceRig.faceGroup.parent.remove(faceRig.faceGroup);
        }
        for (let i = 0; i < garmentMeshes.length; i++) {
          if (garmentMeshes[i].parent) garmentMeshes[i].parent.remove(garmentMeshes[i]);
        }
        for (let i = 0; i < attachedObjects.length; i++) {
          if (attachedObjects[i].parent) attachedObjects[i].parent.remove(attachedObjects[i]);
        }
        for (let i = 0; i < clothPanels.length; i++) clothPanels[i].dispose();
        for (let i = 0; i < disposables.length; i++) {
          if (disposables[i] && typeof disposables[i].dispose === 'function') disposables[i].dispose();
        }
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Sapiens Tracked Pose & Live Webcam Pose Applicator (Anny 104-Bone Rig)
  // ---------------------------------------------------------------------------
  function applySapiensPoseToRig(rig, sample, mode) {
    if (!rig || !sample || !sample.angles || !rig.bonesByNorm || !_eulSap) return;
    const a = sample.angles;
    const solo = mode === 'solo';

    if (solo) {
      for (const [name, rest] of rig.restQuats.entries()) {
        const b = rig.bonesByName.get(name);
        if (b) b.quaternion.copy(rest);
      }
    }

    const applyBone = (normKey, rx, ry, rz) => {
      const bone = rig.bonesByNorm.get(normKey);
      if (!bone) return;
      _eulSap.set(rx || 0, ry || 0, rz || 0, 'YXZ');
      _qSap.setFromEuler(_eulSap);
      if (solo) {
        const rest = rig.restQuats.get(bone.name);
        if (rest) bone.quaternion.copy(rest).multiply(_qSap);
      } else {
        bone.quaternion.multiply(_qSap);
      }
    };

    const spP = a.spinePitch || 0;
    const spY = a.spineYaw || 0;
    const spR = a.spineRoll || 0;
    const hdP = a.headPitch || 0;
    const hdY = a.headYaw || 0;
    const hdR = a.headRoll || 0;

    applyBone('spine03', spP * 0.5, spY * 0.45, spR * 0.5);
    applyBone('spine01', spP * 0.5, spY * 0.55, spR * 0.5);
    applyBone('neck01', hdP * 0.45, hdY * 0.45, hdR * 0.4);
    applyBone('head', hdP * 0.55, hdY * 0.55, hdR * 0.6);

    // Clamp arm Z angles so arms never clip into torso
    const lArmZ = clamp((a.leftArmZ || 0) * 0.55, -0.22, 1.45);
    const rArmZ = clamp((a.rightArmZ || 0) * 0.55, -0.22, 1.45);
    const lArmX = clamp((a.leftShoulderX || a.leftArmX || 0) * 0.55, -1.2, 1.2);
    const rArmX = clamp((a.rightShoulderX || a.rightArmX || 0) * 0.55, -1.2, 1.2);
    applyBone('upperarm01l', lArmX, 0, lArmZ);
    applyBone('upperarm01r', rArmX, 0, -rArmZ);
    applyBone('lowerarm01l', clamp((a.leftElbowFlex || 0) * 0.5, 0, 1.65), 0, 0);
    applyBone('lowerarm01r', clamp((a.rightElbowFlex || 0) * 0.5, 0, 1.65), 0, 0);
    applyBone('wristl', clamp((a.leftWristFlex || 0) * 0.45, -0.7, 0.7), 0, clamp((a.leftWristRoll || 0) * 0.4, -0.7, 0.7));
    applyBone('wristr', clamp((a.rightWristFlex || 0) * 0.45, -0.7, 0.7), 0, clamp((a.rightWristRoll || 0) * 0.4, -0.7, 0.7));

    // Finger curl scalars (palmar-safe positive X flexion on finger1/2/3/4/5)
    const lCurl = clamp(a.leftFingerCurl || 0, 0, 1);
    const rCurl = clamp(a.rightFingerCurl || 0, 0, 1);
    if (lCurl > 0.02 || solo) {
      const ang = lCurl * 0.78;
      for (let f = 2; f <= 5; f++) {
        applyBone(`finger${f}1l`, ang, 0, 0);
        applyBone(`finger${f}2l`, ang * 0.9, 0, 0);
      }
    }
    if (rCurl > 0.02 || solo) {
      const ang = rCurl * 0.78;
      for (let f = 2; f <= 5; f++) {
        applyBone(`finger${f}1r`, ang, 0, 0);
        applyBone(`finger${f}2r`, ang * 0.9, 0, 0);
      }
    }

    // Mouth jaw openness from Sapiens 308 face keypoints or live webcam
    if (typeof a.jawOpen === 'number' && rig.setJawOpenness) {
      rig.setJawOpenness(clamp(a.jawOpen * 1.45, 0, 1));
    }
  }

  // ---------------------------------------------------------------------------
  // High-Level Character Factory (`AnnyHumanV7.createCharacter`)
  // ---------------------------------------------------------------------------
  async function createCharacter(opts) {
    const cfg = Object.assign({
      archetype: 'adult_f',
      assetBaseUrl: '../abyssinian-highlands/human-forge/assets',
      clipsBaseUrl: 'mesh2motion/clips',
      clothed: true,
      groundY: 0,
      lockRootMotion: true,
      keepVerticalBounce: true,
      preloadClips: ['idle', 'walk'],
      initialClip: 'idle',
      speed: 1.0,
      wireframe: false,
    }, opts || {});

    const THREE = cfg.THREE || (typeof window !== 'undefined' ? window.THREE : null);
    if (!THREE) throw new Error('AnnyHumanV7.createCharacter requires opts.THREE');
    if (!cfg.loader) throw new Error('AnnyHumanV7.createCharacter requires opts.loader (GLTFLoader instance)');

    const archKey = ARCHETYPES[cfg.archetype] ? cfg.archetype : 'adult_f';
    const info = ARCHETYPES[archKey];
    const url = cfg.glbUrl || `${cfg.assetBaseUrl.replace(/\/$/, '')}/${info.glbFile}`;

    const gltf = await cfg.loader.loadAsync(url);
    const annyRoot = gltf.scene;

    annyRoot.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    const rig = dressAnnyV7(THREE, annyRoot, archKey, {
      clothed: cfg.clothed,
      groundY: cfg.groundY,
    });
    if (cfg.wireframe && rig) rig.setWireframe(true);

    let driver = null;
    if (typeof window !== 'undefined' && window.Mesh2MotionAnny && cfg.clipsBaseUrl) {
      driver = window.Mesh2MotionAnny.createAnnyDriver(annyRoot, {
        THREE,
        loader: cfg.loader,
        baseUrl: cfg.clipsBaseUrl,
        lockRootMotion: cfg.lockRootMotion,
        keepVerticalBounce: cfg.keepVerticalBounce,
        armBindAlign: true,
        includeFingers: true,
        defaultFade: 0.25,
        speed: cfg.speed,
      });

      const initialList = Array.from(new Set([cfg.initialClip, ...(cfg.preloadClips || [])].filter(Boolean)));
      if (initialList.length) {
        await driver.loadLibrary(initialList);
        if (cfg.initialClip && driver.hasClip(cfg.initialClip)) {
          driver.play(cfg.initialClip, { fadeDuration: 0 });
          driver.update(0);
        }
      }
    }

    if (rig) rig.pinFeetToGround();

    const instance = {
      version: VERSION,
      archetype: archKey,
      palette: info,
      root: annyRoot,
      annyRoot,
      rig,
      driver,
      bonesByName: rig ? rig.bonesByName : new Map(),
      bonesByNorm: rig ? rig.bonesByNorm : new Map(),
      restQuats: rig ? rig.restQuats : new Map(),
      setClothed: (b) => (rig ? rig.setClothed(b) : false),
      isClothed: () => (rig ? rig.isClothed() : false),
      setWireframe: (b) => (rig ? rig.setWireframe(b) : undefined),
      setGroundY: (y) => (rig ? rig.setGroundY(y) : undefined),
      setWind: (vx, vz) => (rig ? rig.setWind(vx, vz) : undefined),
      setLyricSpeech: (text, progress01, audioLevel) => (rig ? rig.setLyricSpeech(text, progress01, audioLevel) : null),
      setJawOpenness: (v) => (rig ? rig.setJawOpenness(v) : undefined),
      setVisemeShape: (j, w, r, p, v) => (rig ? rig.setVisemeShape(j, w, r, p, v) : undefined),
      setExpression: (name) => (rig ? rig.setExpression(name) : 'neutral'),
      getExpression: () => (rig ? rig.getExpression() : 'neutral'),
      applySapiensPose: (sample, mode) => applySapiensPoseToRig(rig, sample, mode),
      play: (clip, playOpts) => (driver ? driver.play(clip, playOpts) : undefined),
      crossFadeTo: (clip, fade) => (driver ? driver.crossFadeTo(clip, fade) : undefined),
      loadClip: (clip) => (driver ? driver.loadClip(clip) : Promise.resolve(false)),
      hasClip: (clip) => (driver ? driver.hasClip(clip) : false),
      setSpeed: (s) => (driver ? driver.setSpeed(s) : undefined),
      pause: () => (driver ? driver.pause() : undefined),
      resume: () => (driver ? driver.resume() : undefined),
      setRootMotionLock: (b) => (driver ? driver.setRootMotionLock(b) : undefined),
      getBoneCoverage: (clip) => (driver ? driver.getBoneCoverage(clip) : null),
      getClipNames: () => (driver ? driver.getClipNames() : []),
      getMetrics: () => (rig ? rig.getMetrics() : null),
      update: (dt, uOpts) => {
        const skipDriver = uOpts && uOpts.skipDriver;
        if (driver && !skipDriver) driver.update(dt);
        if (rig) rig.update(dt, uOpts);
      },
      dispose: () => {
        if (driver) driver.dispose();
        if (rig) rig.dispose();
      },
    };

    return instance;
  }

  return {
    VERSION,
    ARCHETYPES,
    EXPRESSIONS,
    VISEMES,
    VISEME_SHAPES,
    textToVisemeTimeline,
    sampleLyricViseme,
    dressAnnyV7,
    applySapiensPoseToRig,
    createCharacter,
  };
});
