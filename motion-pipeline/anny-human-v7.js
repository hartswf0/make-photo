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

    for (let v = 0; v < vCount; v++) {
      const vy = pos.getY(v);
      const vz = pos.getZ(v);
      if (vy < minY) minY = vy;
      if (vy > maxY) maxY = vy;

      const w0 = sw.getX(v), w1 = sw.getY(v), w2 = sw.getZ(v), w3 = sw.getW(v);
      let bestK = 0, bestW = w0;
      if (w1 > bestW) { bestK = 1; bestW = w1; }
      if (w2 > bestW) { bestK = 2; bestW = w2; }
      if (w3 > bestW) { bestK = 3; }
      const bIdx = bestK === 0 ? si.getX(v) : bestK === 1 ? si.getY(v) : bestK === 2 ? si.getZ(v) : si.getW(v);
      const reg = boneRegion[bIdx] || 'torso';
      vRegion[v] = reg;

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

    // Head bounding box in head-bone local coordinates
    const headBone = bonesByNorm.get('head');
    const headMetrics = { cx: 0, cy: 0.08, cz: 0.01, rx: 0.075, ry: 0.095, rz: 0.085, minY: 0, maxY: 0.18, maxZ: 0.09 };
    if (headBone) {
      const invHead = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
      const headToBody = new THREE.Matrix4().multiplyMatrices(invHead, bodyMesh.matrixWorld);
      let hx0 = Infinity, hx1 = -Infinity, hy0 = Infinity, hy1 = -Infinity, hz0 = Infinity, hz1 = -Infinity;
      for (let idx = 0; idx < regionVerts.head.length; idx++) {
        const v = regionVerts.head[idx];
        tmpV.set(pos.getX(v), pos.getY(v), pos.getZ(v)).applyMatrix4(headToBody);
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
    }

    return {
      minY,
      maxY,
      height,
      centerZ,
      vRegion,
      regionVerts,
      sampleTorsoRadius,
      bonePosLocal,
      headMetrics,
    };
  }

  /**
   * Build 4 GPU morph targets directly onto Anny's SkinnedMesh geometry for real-time lip-sync:
   *  0: jawOpen, 1: mouthWide, 2: mouthRound, 3: lipPress
   */
  function attachFacialLipSyncMorphs(THREE, bodyMesh, bodyData, headBone) {
    const geo = bodyMesh.geometry;
    if (geo.morphAttributes && geo.morphAttributes.position && geo.morphAttributes.position.length >= 4) {
      return true;
    }
    if (!headBone) return false;

    const pos = geo.attributes.position;
    const vCount = pos.count;
    const hm = bodyData.headMetrics;

    bodyMesh.updateMatrixWorld(true);
    const invHead = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
    const toHead = new THREE.Matrix4().multiplyMatrices(invHead, bodyMesh.matrixWorld);
    const headRotToBody = new THREE.Matrix4().copy(toHead).invert();
    const rotOnly = new THREE.Matrix3().setFromMatrix4(headRotToBody);

    // Mouth landmark in head-bone local coordinates
    const mouthY = hm.cy - hm.ry * 0.44;
    const mouthZ = hm.cz + hm.rz * 0.72;
    const mouthW = hm.rx * 0.46;
    const mouthH = hm.ry * 0.30;

    const mJaw = new Float32Array(vCount * 3);
    const mWide = new Float32Array(vCount * 3);
    const mRound = new Float32Array(vCount * 3);
    const mPress = new Float32Array(vCount * 3);

    // Copy base positions first (Three.js non-relative morph targets store target positions)
    for (let i = 0; i < vCount * 3; i++) {
      const val = pos.array[i];
      mJaw[i] = val;
      mWide[i] = val;
      mRound[i] = val;
      mPress[i] = val;
    }

    const pHead = new THREE.Vector3();
    const delta = new THREE.Vector3();
    const headVerts = bodyData.regionVerts.head;

    for (let idx = 0; idx < headVerts.length; idx++) {
      const v = headVerts[idx];
      pHead.set(pos.getX(v), pos.getY(v), pos.getZ(v)).applyMatrix4(toHead);

      // Only affect front lower face around mouth & chin
      if (pHead.z < hm.cz + hm.rz * 0.20) continue;
      const dx = pHead.x - hm.cx;
      const dy = pHead.y - mouthY;
      const dz = pHead.z - mouthZ;

      const rx = Math.abs(dx) / (mouthW * 1.45);
      const ry = Math.abs(dy) / (mouthH * 1.75);
      const rz = Math.max(0, -dz) / (hm.rz * 0.65);
      const d2 = rx * rx + ry * ry + rz * rz;
      if (d2 >= 1.0) continue;

      const falloff = (1 - d2) * (1 - d2);
      const isLower = dy <= 0.004;

      // 0: jawOpen (pulls lower lip & chin down and slightly back; lifts upper lip very slightly)
      delta.set(
        0,
        isLower ? -hm.ry * 0.24 * falloff : hm.ry * 0.035 * falloff,
        isLower ? -hm.rz * 0.06 * falloff : hm.rz * 0.015 * falloff
      ).applyMatrix3(rotOnly);
      mJaw[v * 3] += delta.x;
      mJaw[v * 3 + 1] += delta.y;
      mJaw[v * 3 + 2] += delta.z;

      // 1: mouthWide (pulls corners laterally outward & slightly up)
      const cornerSign = dx >= 0 ? 1 : -1;
      const cornerFactor = clamp(Math.abs(dx) / Math.max(0.01, mouthW), 0, 1);
      delta.set(
        cornerSign * hm.rx * 0.14 * falloff * (0.35 + 0.65 * cornerFactor),
        hm.ry * 0.03 * falloff * cornerFactor,
        -hm.rz * 0.025 * falloff
      ).applyMatrix3(rotOnly);
      mWide[v * 3] += delta.x;
      mWide[v * 3 + 1] += delta.y;
      mWide[v * 3 + 2] += delta.z;

      // 2: mouthRound (purses lips inward horizontally & forward along +Z)
      delta.set(
        -dx * 0.26 * falloff,
        (isLower ? -hm.ry * 0.04 : hm.ry * 0.02) * falloff,
        hm.rz * 0.12 * falloff
      ).applyMatrix3(rotOnly);
      mRound[v * 3] += delta.x;
      mRound[v * 3 + 1] += delta.y;
      mRound[v * 3 + 2] += delta.z;

      // 3: lipPress (draws upper & lower lips gently together)
      delta.set(
        0,
        (isLower ? hm.ry * 0.055 : -hm.ry * 0.055) * falloff,
        -hm.rz * 0.03 * falloff
      ).applyMatrix3(rotOnly);
      mPress[v * 3] += delta.x;
      mPress[v * 3 + 1] += delta.y;
      mPress[v * 3 + 2] += delta.z;
    }

    geo.morphAttributes.position = [
      new THREE.Float32BufferAttribute(mJaw, 3),
      new THREE.Float32BufferAttribute(mWide, 3),
      new THREE.Float32BufferAttribute(mRound, 3),
      new THREE.Float32BufferAttribute(mPress, 3),
    ];
    geo.morphTargetsRelative = false;
    bodyMesh.morphTargetDictionary = { jawOpen: 0, mouthWide: 1, mouthRound: 2, lipPress: 3 };
    bodyMesh.morphTargetInfluences = [0, 0, 0, 0];
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
   * Build sculpted laced lug-sole leather work boots (Imani, Elder, Makeda) or strapped
   * Ethiopian leather sandals/ankle boots (June) cleanly covering the foot with soles at y = 0.
   */
  function buildLacedBoot(THREE, footBone, side, heightScale, bootMat, soleMat, accentMat, disposables, isSandal) {
    const group = new THREE.Group();
    group.name = `anny_v7_boot_${side}`;
    const s = heightScale / 1.65;

    // Generous lugged boot sole (flat grounded base covering full foot footprint)
    const soleGeo = new THREE.BoxGeometry(0.112 * s, 0.028 * s, 0.275 * s);
    const upperGeo = new THREE.BoxGeometry(0.104 * s, isSandal ? 0.056 * s : 0.078 * s, 0.245 * s);
    const cuffGeo = new THREE.CylinderGeometry(0.058 * s, 0.064 * s, isSandal ? 0.088 * s : 0.135 * s, 12);
    const toeGeo = new THREE.SphereGeometry(0.054 * s, 10, 8);
    const strapGeo = new THREE.BoxGeometry(0.108 * s, 0.012 * s, 0.022 * s);
    disposables.push(soleGeo, upperGeo, cuffGeo, toeGeo, strapGeo);

    const sole = new THREE.Mesh(soleGeo, soleMat);
    sole.position.set(0, -0.048 * s, 0.052 * s);
    sole.castShadow = true;
    sole.receiveShadow = true;
    group.add(sole);

    const upper = new THREE.Mesh(upperGeo, bootMat);
    upper.position.set(0, -0.002 * s, 0.044 * s);
    upper.castShadow = true;
    upper.receiveShadow = true;
    group.add(upper);

    const toe = new THREE.Mesh(toeGeo, bootMat);
    toe.position.set(0, -0.012 * s, 0.156 * s);
    toe.scale.set(1.04, 0.76, 1.18);
    toe.castShadow = true;
    group.add(toe);

    const cuff = new THREE.Mesh(cuffGeo, bootMat);
    cuff.position.set(0, (isSandal ? 0.044 : 0.064) * s, -0.012 * s);
    cuff.castShadow = true;
    group.add(cuff);

    // Laces or leather sandal straps
    const strapCount = isSandal ? 2 : 3;
    for (let k = 0; k < strapCount; k++) {
      const strap = new THREE.Mesh(strapGeo, accentMat);
      strap.position.set(0, (0.018 + k * 0.026) * s, (0.056 - k * 0.016) * s);
      group.add(strap);
    }

    footBone.add(group);
    return { group, soleLocalY: -0.062 * s };
  }

  /**
   * Build real 3D eyes (ivory-white sclera, dark iris, black pupil, wet specular catchlight,
   * skin-toned blinking upper eyelids, sculpted expressive brows) + talking mouth interior
   * (dark oral cavity, ivory upper/lower teeth, tongue) cleanly fitted to Anny's face.
   */
  function buildEyesAndMouthV7(THREE, headBone, eyeL, eyeR, hm, palette, disposables) {
    const faceGroup = new THREE.Group();
    faceGroup.name = 'anny_v7_face_rig';

    const scleraMat = getSharedSolidMaterial(THREE, 'eye_sclera', {
      color: 0xf4efe6,
      roughness: 0.18,
      metalness: 0.0,
    });
    const irisMat = getSharedSolidMaterial(THREE, 'eye_iris', {
      color: 0x2a180d,
      roughness: 0.14,
      metalness: 0.05,
    });
    const pupilMat = getSharedSolidMaterial(THREE, 'eye_pupil', {
      color: 0x090706,
      roughness: 0.08,
      metalness: 0.05,
    });
    const catchMat = getSharedSolidMaterial(THREE, 'eye_catchlight', {
      color: 0xffffff,
      roughness: 0.0,
      metalness: 0.0,
      emissive: 0xffffff,
      emissiveIntensity: 0.85,
    });
    const lidMat = getSharedSkinMaterial(THREE, palette);
    const browMat = getSharedSolidMaterial(THREE, `brow_${palette.id}`, {
      color: palette.hairHex,
      roughness: 0.92,
      metalness: 0.0,
    });
    const cavityMat = getSharedSolidMaterial(THREE, 'mouth_cavity', {
      color: 0x1b0b0b,
      roughness: 0.95,
    });
    const teethMat = getSharedSolidMaterial(THREE, 'mouth_teeth', {
      color: 0xf2eadc,
      roughness: 0.25,
    });
    const tongueMat = getSharedSolidMaterial(THREE, 'mouth_tongue', {
      color: 0x9b4644,
      roughness: 0.55,
    });

    const eyeR_rad = Math.max(0.0105, hm.rx * 0.165);
    const scleraGeo = new THREE.SphereGeometry(eyeR_rad, 14, 12);
    const irisGeo = new THREE.CircleGeometry(eyeR_rad * 0.50, 14);
    const pupilGeo = new THREE.CircleGeometry(eyeR_rad * 0.24, 12);
    const catchGeo = new THREE.CircleGeometry(eyeR_rad * 0.10, 8);
    const lidGeo = new THREE.SphereGeometry(eyeR_rad * 1.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const browGeo = new THREE.CapsuleGeometry(hm.rx * 0.032, hm.rx * 0.22, 4, 8);
    disposables.push(scleraGeo, irisGeo, pupilGeo, catchGeo, lidGeo, browGeo);

    const upperLids = [];
    const brows = [];

    const mountEye = (eyeBone, sideSign) => {
      const eg = new THREE.Group();
      eg.name = `anny_v7_eye_${sideSign < 0 ? 'R' : 'L'}`;

      const sclera = new THREE.Mesh(scleraGeo, scleraMat);
      eg.add(sclera);

      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.set(0, 0, eyeR_rad * 0.96);
      eg.add(iris);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(0, 0, eyeR_rad * 1.01);
      eg.add(pupil);

      const catchlight = new THREE.Mesh(catchGeo, catchMat);
      catchlight.position.set(eyeR_rad * 0.18, eyeR_rad * 0.20, eyeR_rad * 1.04);
      eg.add(catchlight);

      const lid = new THREE.Mesh(lidGeo, lidMat);
      lid.rotation.x = -0.35; // open rest angle
      eg.add(lid);
      upperLids.push(lid);

      // Compute exact eye-socket position in headBone local space so eyes always face +Z forward
      if (eyeBone) {
        headBone.updateMatrixWorld(true);
        const invHead = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
        const ePos = new THREE.Vector3();
        eyeBone.getWorldPosition(ePos).applyMatrix4(invHead);
        eg.position.set(ePos.x, ePos.y, ePos.z + eyeR_rad * 0.55);
      } else {
        eg.position.set(hm.cx + sideSign * hm.rx * 0.36, hm.cy + hm.ry * 0.08, hm.cz + hm.rz * 0.80);
      }
      faceGroup.add(eg);

      // Expressive brow ridge seated cleanly above each eye socket
      const brow = new THREE.Mesh(browGeo, browMat);
      const baseY = eg.position.y + eyeR_rad * 1.45;
      brow.position.set(eg.position.x, baseY, eg.position.z + eyeR_rad * 0.45);
      brow.rotation.z = Math.PI * 0.5 - sideSign * 0.08;
      faceGroup.add(brow);
      brows.push({ mesh: brow, side: sideSign, baseY });
    };

    mountEye(eyeL, 1);
    mountEye(eyeR, -1);

    // Talking mouth interior (oral cavity + upper/lower ivory teeth + tongue)
    // Positioned anatomically below the actual eye line
    const mouthGroup = new THREE.Group();
    mouthGroup.name = 'anny_v7_mouth_interior';
    const refEyeY = brows.length ? brows[0].baseY - eyeR_rad * 1.45 : (hm.cy + hm.ry * 0.08);
    const refEyeZ = brows.length ? brows[0].mesh.position.z - eyeR_rad * 0.45 : (hm.cz + hm.rz * 0.78);
    const mouthY = refEyeY - hm.ry * 0.66;
    const mouthZ = refEyeZ - hm.rz * 0.14;
    mouthGroup.position.set(hm.cx, mouthY, mouthZ);

    const cavGeo = new THREE.SphereGeometry(hm.rx * 0.24, 12, 10);
    const toothGeo = new THREE.BoxGeometry(hm.rx * 0.32, hm.ry * 0.055, hm.rz * 0.10);
    const tongueGeo = new THREE.SphereGeometry(hm.rx * 0.15, 10, 8);
    disposables.push(cavGeo, toothGeo, tongueGeo);

    const cavity = new THREE.Mesh(cavGeo, cavityMat);
    cavity.scale.set(1.05, 0.72, 0.65);
    mouthGroup.add(cavity);

    const upperTeeth = new THREE.Mesh(toothGeo, teethMat);
    upperTeeth.position.set(0, hm.ry * 0.048, hm.rz * 0.075);
    mouthGroup.add(upperTeeth);

    const lowerTeeth = new THREE.Mesh(toothGeo, teethMat);
    lowerTeeth.position.set(0, -hm.ry * 0.058, hm.rz * 0.068);
    mouthGroup.add(lowerTeeth);

    const tongue = new THREE.Mesh(tongueGeo, tongueMat);
    tongue.position.set(0, -hm.ry * 0.045, hm.rz * 0.01);
    tongue.scale.set(0.95, 0.45, 0.85);
    mouthGroup.add(tongue);

    mouthGroup.visible = false;
    faceGroup.add(mouthGroup);

    headBone.add(faceGroup);

    return {
      faceGroup,
      upperLids,
      brows,
      mouthGroup,
      lowerTeeth,
      tongue,
      hm,
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
      // Imani: Dense sculpted matte 4C afro crown seated cleanly behind forehead hairline + brass hoops
      const crownGeo = new THREE.IcosahedronGeometry(1, 2);
      const puffGeo = new THREE.IcosahedronGeometry(rx * 0.36, 1);
      const hoopGeo = new THREE.TorusGeometry(rx * 0.16, rx * 0.022, 8, 16);
      disposables.push(crownGeo, puffGeo, hoopGeo);

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

      for (const side of [-1, 1]) {
        const hoop = new THREE.Mesh(hoopGeo, brassMat);
        hoop.position.set(cx + side * rx * 1.02, cy - ry * 0.18, cz - rz * 0.06);
        hoop.rotation.y = Math.PI * 0.5;
        group.add(hoop);
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

      for (const side of [-1, 1]) {
        const stud = new THREE.Mesh(studGeo, brassMat);
        stud.position.set(cx + side * rx * 1.0, cy - ry * 0.18, cz - rz * 0.04);
        group.add(stud);
      }
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

    // -------------------------------------------------------------------------
    // Archetype-Specific Tailored Garments + Verlet Cloth Panels
    // -------------------------------------------------------------------------
    if (archKey === 'adult_f') {
      // 1. Scoop inner tunic (smooth hem, clean scooped neckline)
      const tunicMat = getSharedMaterial(THREE, 'imani_tunic', {
        baseHex: palette.tunicHex,
        mode: 'weave',
        repX: 4,
        repY: 4,
        roughness: 0.86,
      });
      addGarment(buildTorsoLoft(THREE, bodyMesh, bodyData, {
        name: 'imani_v7_tunic',
        material: tunicMat,
        rings: 14,
        segs: 28,
        yMin: 0.49,
        yMax: (theta) => 0.81 - Math.max(0, Math.cos(theta)) * 0.055,
        ease: 0.011,
      }));

      // 2. Loose pleated cargo trousers (pelvis waist + both legs + side cargo pockets)
      const trouserMat = getSharedMaterial(THREE, 'imani_trousers', {
        baseHex: palette.trouserHex,
        mode: 'twill',
        repX: 3,
        repY: 4,
        roughness: 0.88,
        doubleSide: true,
      });
      addGarment(buildTorsoLoft(THREE, bodyMesh, bodyData, {
        name: 'imani_v7_trouser_waist',
        material: trouserMat,
        rings: 8,
        segs: 24,
        yMin: 0.44,
        yMax: 0.56,
        ease: 0.018,
      }));
      addGarment(buildLimbTube(THREE, bodyMesh, bodyData, {
        name: 'imani_v7_trouser_L',
        material: trouserMat,
        region: 'legL',
        boneKeys: ['upperleg01l', 'lowerleg01l', 'footl'],
        tStart: 0.03,
        tEnd: 0.99,
        rings: 16,
        segs: 18,
        pleats: 4,
        ease: (v) => (0.018 - v * 0.004) * hScale,
      }));
      addGarment(buildLimbTube(THREE, bodyMesh, bodyData, {
        name: 'imani_v7_trouser_R',
        material: trouserMat,
        region: 'legR',
        boneKeys: ['upperleg01r', 'lowerleg01r', 'footr'],
        tStart: 0.03,
        tEnd: 0.99,
        rings: 16,
        segs: 18,
        pleats: 4,
        ease: (v) => (0.018 - v * 0.004) * hScale,
      }));

      // Side cargo pockets mounted on upperleg01.L/R
      const cargoGeo = new THREE.BoxGeometry(0.024 * hScale, 0.135 * hScale, 0.115 * hScale);
      disposables.push(cargoGeo);
      if (thighL) {
        const pkL = new THREE.Mesh(cargoGeo, trouserMat);
        pkL.position.set(0.095 * hScale, -0.14 * hScale, 0.01 * hScale);
        pkL.castShadow = true;
        thighL.add(pkL);
        attachedObjects.push(pkL);
      }
      if (thighR) {
        const pkR = new THREE.Mesh(cargoGeo, trouserMat);
        pkR.position.set(-0.095 * hScale, -0.14 * hScale, 0.01 * hScale);
        pkR.castShadow = true;
        thighR.add(pkR);
        attachedObjects.push(pkR);
      }

      // 3. Clean tailored open-front duster coat (upper bodice + V-notch collar + rolled-cuff sleeves)
      const coatMat = getSharedMaterial(THREE, 'imani_coat', {
        baseHex: palette.coatHex,
        mode: 'twill',
        repX: 3,
        repY: 4,
        roughness: 0.82,
        doubleSide: true,
      });
      const lapelMat = getSharedMaterial(THREE, 'imani_lapel', {
        baseHex: palette.coatTrimHex,
        mode: 'twill',
        repX: 2,
        repY: 2,
        roughness: 0.80,
        doubleSide: true,
      });

      // Open-front upper duster bodice (waist 0.54 to collar 0.84, clean straight front edges + V-notch)
      addGarment(buildTorsoLoft(THREE, bodyMesh, bodyData, {
        name: 'imani_v7_duster_bodice',
        material: coatMat,
        closed: false,
        rings: 14,
        segs: 26,
        yMin: 0.535,
        yMax: (theta) => 0.835 - Math.max(0, Math.cos(theta)) * 0.028,
        openHalfAngle: (v) => lerp(0.32, 0.44, Math.pow(v, 1.3)),
        ease: (v) => (0.024 + (1 - v) * 0.006) * hScale,
      }));

      // Crisp turned-back lapel strips along left & right front openings
      addGarment(buildTorsoLoft(THREE, bodyMesh, bodyData, {
        name: 'imani_v7_duster_collar',
        material: lapelMat,
        closed: false,
        rings: 6,
        segs: 18,
        yMin: 0.785,
        yMax: 0.842,
        openHalfAngle: () => 0.42,
        ease: 0.030 * hScale,
      }));

      // Full coat sleeves with rolled cuffs (snug onto deltoid shoulder)
      addGarment(buildLimbTube(THREE, bodyMesh, bodyData, {
        name: 'imani_v7_sleeve_L',
        material: coatMat,
        region: 'armL',
        boneKeys: ['shoulder01l', 'upperarm01l', 'lowerarm01l', 'wristl'],
        tStart: 0.06,
        tEnd: 0.88,
        rings: 16,
        segs: 16,
        ease: (v) => (v < 0.22 ? 0.010 : v > 0.86 ? 0.021 : 0.013) * hScale,
      }));
      addGarment(buildLimbTube(THREE, bodyMesh, bodyData, {
        name: 'imani_v7_sleeve_R',
        material: coatMat,
        region: 'armR',
        boneKeys: ['shoulder01r', 'upperarm01r', 'lowerarm01r', 'wristr'],
        tStart: 0.06,
        tEnd: 0.88,
        rings: 16,
        segs: 16,
        ease: (v) => (v < 0.22 ? 0.010 : v > 0.86 ? 0.021 : 0.013) * hScale,
      }));

      // 4. REAL VERLET-SIMULATED FLARING LOWER DUSTER COAT PANEL (waist 0.545 down to mid-calf 0.21)
      const waistY = minY + 0.545 * height;
      const hemY = minY + 0.215 * height;
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
          const rad = sampleTorsoRadius(0.545, theta) + (0.028 + v * 0.068) * hScale;
          out.set(Math.sin(theta) * rad, lerp(waistY, hemY, v), centerZ + Math.cos(theta) * rad);
        },
        samplePin: (c, cols, out) => {
          const u = c / (cols - 1);
          const theta = lerp(openHalf, Math.PI * 2 - openHalf, u);
          const rad = sampleTorsoRadius(0.545, theta) + 0.028 * hScale;
          // Transform local waist ring point by live spine05 world-to-root matrix
          _vB.set(Math.sin(theta) * rad, 0.01 * hScale, Math.cos(theta) * rad);
          spineLow.updateMatrixWorld(false);
          _vB.applyMatrix4(spineLow.matrixWorld);
          out.copy(_vB).applyMatrix4(_matInv);
        },
      });
      annyRoot.add(dusterPanel.mesh);
      clothPanels.push(dusterPanel);
      garmentMeshes.push(dusterPanel.mesh);

      // 5. Buckled leather tool-belt + brass buckle + side utility pouch
      const beltMat = getSharedMaterial(THREE, 'imani_belt', {
        baseHex: palette.beltHex,
        mode: 'leather',
        repX: 4,
        repY: 1,
        roughness: 0.65,
      });
      const beltGroup = new THREE.Group();
      beltGroup.name = 'imani_v7_tool_belt';
      const waistR = sampleTorsoRadius(0.55, 0) + 0.016 * hScale;
      const beltGeo = new THREE.TorusGeometry(waistR, 0.015 * hScale, 8, 28);
      const buckleGeo = new THREE.BoxGeometry(0.044 * hScale, 0.036 * hScale, 0.018 * hScale);
      const pouchGeo = new THREE.BoxGeometry(0.046 * hScale, 0.072 * hScale, 0.068 * hScale);
      disposables.push(beltGeo, buckleGeo, pouchGeo);

      const belt = new THREE.Mesh(beltGeo, beltMat);
      belt.rotation.x = Math.PI * 0.5;
      belt.scale.set(1.12, 0.90, 1.0);
      belt.castShadow = true;
      beltGroup.add(belt);

      const buckle = new THREE.Mesh(buckleGeo, brassMat);
      buckle.position.set(0, 0, waistR * 0.92);
      beltGroup.add(buckle);

      const pouch = new THREE.Mesh(pouchGeo, beltMat);
      pouch.position.set(waistR * 1.08, -0.02 * hScale, -0.01 * hScale);
      pouch.castShadow = true;
      beltGroup.add(pouch);

      spineLow.add(beltGroup);
      attachedObjects.push(beltGroup);
    } else if (archKey === 'child7') {
      // June: Side-slit woven knit tunic + stitched knee-patch trousers + Verlet front/back tunic flaps
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
      const patchMat = getSharedSolidMaterial(THREE, 'june_patch', {
        color: palette.patchHex,
        roughness: 0.90,
      });

      addGarment(buildTorsoLoft(THREE, bodyMesh, bodyData, {
        name: 'june_v7_knit_bodice',
        material: tunicMat,
        rings: 14,
        segs: 24,
        yMin: 0.52,
        yMax: (theta) => 0.81 - Math.max(0, Math.cos(theta)) * 0.035,
        ease: 0.018 * hScale,
      }));
      addGarment(buildLimbTube(THREE, bodyMesh, bodyData, {
        name: 'june_v7_sleeve_L',
        material: tunicMat,
        region: 'armL',
        boneKeys: ['upperarm01l', 'lowerarm01l'],
        tStart: 0.0,
        tEnd: 0.72,
        rings: 10,
        segs: 14,
        ease: 0.015 * hScale,
      }));
      addGarment(buildLimbTube(THREE, bodyMesh, bodyData, {
        name: 'june_v7_sleeve_R',
        material: tunicMat,
        region: 'armR',
        boneKeys: ['upperarm01r', 'lowerarm01r'],
        tStart: 0.0,
        tEnd: 0.72,
        rings: 10,
        segs: 14,
        ease: 0.015 * hScale,
      }));
      addGarment(buildTorsoLoft(THREE, bodyMesh, bodyData, {
        name: 'june_v7_trouser_waist',
        material: trouserMat,
        rings: 6,
        segs: 22,
        yMin: 0.44,
        yMax: 0.55,
        ease: 0.014 * hScale,
      }));
      addGarment(buildLimbTube(THREE, bodyMesh, bodyData, {
        name: 'june_v7_trouser_L',
        material: trouserMat,
        region: 'legL',
        boneKeys: ['upperleg01l', 'lowerleg01l', 'footl'],
        tStart: 0.0,
        tEnd: 0.94,
        rings: 14,
        segs: 16,
        ease: 0.018 * hScale,
      }));
      addGarment(buildLimbTube(THREE, bodyMesh, bodyData, {
        name: 'june_v7_trouser_R',
        material: trouserMat,
        region: 'legR',
        boneKeys: ['upperleg01r', 'lowerleg01r', 'footr'],
        tStart: 0.0,
        tEnd: 0.94,
        rings: 14,
        segs: 16,
        ease: 0.018 * hScale,
      }));

      // Stitched knee patches on lowerleg01.L/R
      const patchGeo = new THREE.BoxGeometry(0.056 * hScale, 0.068 * hScale, 0.016 * hScale);
      disposables.push(patchGeo);
      for (const kneeBone of [shinL, shinR]) {
        if (!kneeBone) continue;
        const p = new THREE.Mesh(patchGeo, patchMat);
        p.position.set(0, 0.01 * hScale, 0.056 * hScale);
        kneeBone.add(p);
        attachedObjects.push(p);
      }

      // Verlet side-slit front & back tunic flaps
      const flapTopY = minY + 0.53 * height;
      const flapBotY = minY + 0.36 * height;
      for (const sideCfg of [
        { name: 'june_v7_flap_front', a0: -0.95, a1: 0.95 },
        { name: 'june_v7_flap_back', a0: Math.PI - 0.95, a1: Math.PI + 0.95 },
      ]) {
        const panel = createVerletClothPanel(THREE, {
          name: sideCfg.name,
          material: tunicMat,
          cols: 9,
          rows: 5,
          gravity: -8.2,
          damping: 0.93,
          flareOut: 1.1,
          initPoint: (c, r, cols, rows, out) => {
            const u = c / (cols - 1);
            const v = r / (rows - 1);
            const theta = lerp(sideCfg.a0, sideCfg.a1, u);
            const rad = sampleTorsoRadius(0.53, theta) + (0.022 + v * 0.025) * hScale;
            out.set(Math.sin(theta) * rad, lerp(flapTopY, flapBotY, v), centerZ + Math.cos(theta) * rad);
          },
          samplePin: (c, cols, out) => {
            const u = c / (cols - 1);
            const theta = lerp(sideCfg.a0, sideCfg.a1, u);
            const rad = sampleTorsoRadius(0.53, theta) + 0.022 * hScale;
            _vB.set(Math.sin(theta) * rad, 0.0, Math.cos(theta) * rad);
            spineLow.updateMatrixWorld(false);
            _vB.applyMatrix4(spineLow.matrixWorld);
            out.copy(_vB).applyMatrix4(_matInv);
          },
        });
        annyRoot.add(panel.mesh);
        clothPanels.push(panel);
        garmentMeshes.push(panel.mesh);
      }
    } else {
      // Makeda (elder) & Elder (adult_m): Tunic + Trousers + Diagonally Draped Multi-Fold Shamma/Gabi + Verlet Shoulder Drape
      const tunicMat = getSharedMaterial(THREE, `${archKey}_tunic`, {
        baseHex: palette.tunicHex,
        mode: 'weave',
        repX: 4,
        repY: 4,
        roughness: 0.85,
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

      addGarment(buildTorsoLoft(THREE, bodyMesh, bodyData, {
        name: `${archKey}_v7_tunic`,
        material: tunicMat,
        rings: 14,
        segs: 26,
        yMin: 0.44,
        yMax: (theta) => 0.82 - Math.max(0, Math.cos(theta)) * 0.032,
        ease: (v) => (0.018 + (1 - v) * 0.012) * hScale,
      }));
      addGarment(buildLimbTube(THREE, bodyMesh, bodyData, {
        name: `${archKey}_v7_sleeve_L`,
        material: tunicMat,
        region: 'armL',
        boneKeys: ['upperarm01l', 'lowerarm01l', 'wristl'],
        tStart: 0.0,
        tEnd: 0.88,
        rings: 14,
        segs: 16,
        ease: 0.018 * hScale,
      }));
      addGarment(buildLimbTube(THREE, bodyMesh, bodyData, {
        name: `${archKey}_v7_sleeve_R`,
        material: tunicMat,
        region: 'armR',
        boneKeys: ['upperarm01r', 'lowerarm01r', 'wristr'],
        tStart: 0.0,
        tEnd: 0.88,
        rings: 14,
        segs: 16,
        ease: 0.018 * hScale,
      }));
      addGarment(buildLimbTube(THREE, bodyMesh, bodyData, {
        name: `${archKey}_v7_trouser_L`,
        material: trouserMat,
        region: 'legL',
        boneKeys: ['upperleg01l', 'lowerleg01l', 'footl'],
        tStart: 0.0,
        tEnd: 0.95,
        rings: 14,
        segs: 16,
        ease: 0.022 * hScale,
      }));
      addGarment(buildLimbTube(THREE, bodyMesh, bodyData, {
        name: `${archKey}_v7_trouser_R`,
        material: trouserMat,
        region: 'legR',
        boneKeys: ['upperleg01r', 'lowerleg01r', 'footr'],
        tStart: 0.0,
        tEnd: 0.95,
        rings: 14,
        segs: 16,
        ease: 0.022 * hScale,
      }));

      // Diagonally draped multi-fold shamma / gabi wrap around chest & waist
      addGarment(buildTorsoLoft(THREE, bodyMesh, bodyData, {
        name: `${archKey}_v7_shamma_wrap`,
        material: shammaMat,
        rings: 12,
        segs: 30,
        yMin: (theta) => 0.49 + Math.sin(theta) * 0.075,
        yMax: (theta) => 0.77 + Math.sin(theta) * 0.065,
        ease: (v, u, theta) => (0.032 + Math.sin(v * Math.PI * 5) * 0.005 + Math.max(0, Math.sin(theta)) * 0.006) * hScale,
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

    // Laced lug-sole work boots (Imani/Elder/Makeda) or strapped Ethiopian sandals/ankle boots (June)
    const isSandal = archKey === 'child7';
    let bootSoleOffsetL = -0.062 * hScale;
    let bootSoleOffsetR = -0.062 * hScale;
    if (footL) {
      const bL = buildLacedBoot(THREE, footL, 'L', height, bootMat, soleMat, brassMat, disposables, isSandal);
      attachedObjects.push(bL.group);
      bootSoleOffsetL = bL.soleLocalY;
    }
    if (footR) {
      const bR = buildLacedBoot(THREE, footR, 'R', height, bootMat, soleMat, brassMat, disposables, isSandal);
      attachedObjects.push(bR.group);
      bootSoleOffsetR = bR.soleLocalY;
    }

    // Real 3D eyes (ivory sclera + iris + pupil + catchlight + blinking lids + brows) & talking mouth interior
    const eyeL = bonesByNorm.get('eyel');
    const eyeR = bonesByNorm.get('eyer');
    let faceRig = null;
    if (headBone) {
      faceRig = buildEyesAndMouthV7(THREE, headBone, eyeL, eyeR, bodyData.headMetrics, palette, disposables);
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
    const smoothMorph = [0, 0, 0, 0];
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

    function update(dt) {
      const h = clamp(Number(dt) || 0.016, 0.001, 0.05);
      simTime += h;

      // 1. Exact foot-to-ground pinning
      pinFeetToGround();

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

      const rate = 1 - Math.exp(-18 * h);
      smoothMorph[0] = lerp(smoothMorph[0], wantJaw, rate);
      smoothMorph[1] = lerp(smoothMorph[1], wantWide, rate);
      smoothMorph[2] = lerp(smoothMorph[2], wantRound, rate);
      smoothMorph[3] = lerp(smoothMorph[3], wantPress, rate);

      if (hasLipMorphs && bodyMesh.morphTargetInfluences) {
        bodyMesh.morphTargetInfluences[0] = smoothMorph[0];
        bodyMesh.morphTargetInfluences[1] = Math.max(0, smoothMorph[1]);
        bodyMesh.morphTargetInfluences[2] = smoothMorph[2];
        bodyMesh.morphTargetInfluences[3] = smoothMorph[3];
        currentViseme = targetViseme;
      }

      // 2b. Real 3D eyes (natural blink + expression lids/brows) & talking mouth interior
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
        const lidAngle = -0.36 + expr.lidDrop * 0.45 + blinkAmt * 0.82;
        for (let i = 0; i < faceRig.upperLids.length; i++) {
          faceRig.upperLids[i].rotation.x = lidAngle;
        }
        for (let i = 0; i < faceRig.brows.length; i++) {
          const br = faceRig.brows[i];
          br.mesh.position.y = br.baseY + expr.browY;
          br.mesh.rotation.z = Math.PI * 0.5 - br.side * (0.08 + expr.browTilt);
        }
        const jawNow = smoothMorph[0];
        faceRig.mouthGroup.visible = jawNow > 0.06;
        if (faceRig.mouthGroup.visible) {
          faceRig.mouthGroup.scale.set(
            0.85 + Math.max(0, smoothMorph[1]) * 0.28 - smoothMorph[2] * 0.22,
            0.35 + jawNow * 0.95,
            1.0
          );
          faceRig.lowerTeeth.position.y = -faceRig.hm.ry * (0.048 + jawNow * 0.085);
          faceRig.tongue.position.y = -faceRig.hm.ry * (0.042 + jawNow * 0.055);
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
        if (rig) rig.update(dt);
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
