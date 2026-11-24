/**
 * anny-hero-v9.js — V9 WYGWYL Poet Hero & Upgraded Biomechanical 104-Bone Cast Engine
 *
 * Pure ES Module safe for import from `/city/` OR `/city/<subpage>/` with zero 404s.
 * Wraps `window.AnnyHumanV7` + `window.Mesh2MotionAnny` + `GLTFLoader` + `MeshoptDecoder`.
 *
 * Exports:
 *  - createHeroOrCastV9({ THREE, loader, role, archetype, wingsMode, glasses, prop, seed, ... })
 *  - evolveHeroPhenotype(heroInst, { poem, shotKind, seed, generation, bgLuminance, lookTargetVec3 })
 *  - resolveClipName(clipName)
 *  - ROLE_PROFILES
 *  - CLIP_ALIASES
 *  - VERSION
 */

import { GLTFLoader } from '../../highland-exposure/motion-lab/vendor/three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../../highland-exposure/motion-lab/vendor/three/addons/libs/meshopt_decoder.module.js';

export const VERSION = '9.1.0-p06-evo';

const ASSET_BASE_URL = new URL('../../abyssinian-highlands/human-forge/assets', import.meta.url).href.replace(/\/$/, '');
const CLIPS_BASE_URL = new URL('../../motion-pipeline/mesh2motion/clips', import.meta.url).href.replace(/\/$/, '');
const HERO_ASSETS_URL = new URL('./assets', import.meta.url).href.replace(/\/$/, '');
const M2M_SCRIPT_URL = new URL('../../motion-pipeline/mesh2motion/m2m-retarget.js', import.meta.url).href;
const ANNY_V7_SCRIPT_URL = new URL('../../motion-pipeline/anny-human-v7.js', import.meta.url).href;

if (typeof window !== 'undefined' && !window.MeshoptDecoder) {
  window.MeshoptDecoder = MeshoptDecoder;
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function seededHash(seedVal, salt = 0) {
  let h = (Math.imul(Math.floor(Number(seedVal) || 0) + 1, 2654435761) ^ Math.imul(salt + 17, 2246822519)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Verified Mesh2Motion CC0 Clip Alias Registry (Zero-404 Guaranteed)
// ---------------------------------------------------------------------------
const VERIFIED_CLIPS = new Set([
  'rest-pose',
  'walk',
  'walk-relaxed',
  'walk-cautious',
  'walk-happy',
  'walk-carry',
  'walk-backwards',
  'jog',
  'sprint',
  'idle',
  'idle-talking',
  'idle-listening',
  'idle-foldarms',
  'greeting',
  'clapping',
  'yes',
  'angry',
  'confused',
  'reject',
  'victory',
  'pray',
  'push',
  'rope-pull',
  'hammering',
  'shovel-dig',
  'farm-watering',
  'crouch-idle',
  'crouch-walk',
  'sitting-idle',
  'sitting-talking',
  'climb-ladder',
  'jump',
  'dance-simple',
  'dance-arm-pump',
  'dance-charleston',
  'guitar-playing',
]);

export const CLIP_ALIASES = Object.freeze({
  idle: 'idle',
  stand: 'idle',
  walk: 'walk',
  relaxed: 'walk-relaxed',
  'walk-relaxed': 'walk-relaxed',
  cautious: 'walk-cautious',
  happy: 'walk-happy',
  jog: 'jog',
  run: 'sprint',
  sprint: 'sprint',
  carry: 'walk-carry',
  'walk-carry': 'walk-carry',
  talk: 'idle-talking',
  talking: 'idle-talking',
  'idle-talking': 'idle-talking',
  listen: 'idle-listening',
  listening: 'idle-listening',
  'idle-listening': 'idle-listening',
  greet: 'greeting',
  greeting: 'greeting',
  wave: 'greeting',
  'fold-arms': 'idle-foldarms',
  foldarms: 'idle-foldarms',
  'idle-foldarms': 'idle-foldarms',
  pump: 'rope-pull',
  'rope-pull': 'rope-pull',
  pull: 'rope-pull',
  water: 'farm-watering',
  watering: 'farm-watering',
  'farm-watering': 'farm-watering',
  'sit-talk': 'sitting-talking',
  'sitting-talking': 'sitting-talking',
  sit: 'sitting-idle',
  'sit-idle': 'sitting-idle',
  'sitting-idle': 'sitting-idle',
  dance: 'dance-simple',
  'dance-simple': 'dance-simple',
  'dance-pump': 'dance-arm-pump',
  'dance-arm-pump': 'dance-arm-pump',
  charleston: 'dance-charleston',
  'dance-charleston': 'dance-charleston',
  clap: 'clapping',
  clapping: 'clapping',
  pray: 'pray',
  victory: 'victory',
  cheer: 'victory',
  yes: 'yes',
  nod: 'yes',
  jump: 'jump',
  glide: 'jump',
  flight: 'jump',
  'wing-glide': 'jump',
  crouch: 'crouch-idle',
  push: 'push',
  hammer: 'hammering',
  dig: 'shovel-dig',
  guitar: 'guitar-playing',
});

export function resolveClipName(clipName) {
  const key = String(clipName || 'idle').trim().toLowerCase();
  if (CLIP_ALIASES[key]) return CLIP_ALIASES[key];
  if (VERIFIED_CLIPS.has(key)) return key;
  return 'idle';
}

const LOCOMOTION_REF_MPS = Object.freeze({
  walk: 1.35,
  'walk-relaxed': 1.15,
  'walk-cautious': 0.95,
  'walk-happy': 1.40,
  'walk-carry': 1.18,
  'walk-backwards': 1.05,
  jog: 2.95,
  sprint: 5.35,
});

export const ROLE_PROFILES = Object.freeze({
  poet_hero: {
    role: 'poet_hero',
    archetype: 'adult_m',
    isPoetHero: true,
    defaultGlasses: true,
    defaultWings: 'off',
    defaultProp: 'none',
    initialClip: 'idle',
    preloadClips: ['idle', 'walk', 'walk-relaxed', 'jog', 'sprint', 'walk-carry', 'idle-talking', 'idle-listening', 'greeting', 'idle-foldarms', 'dance-simple', 'victory', 'jump'],
  },
  imani: {
    role: 'imani',
    archetype: 'adult_f',
    isPoetHero: false,
    defaultGlasses: false,
    defaultWings: 'off',
    defaultProp: 'none',
    initialClip: 'idle-listening',
    preloadClips: ['idle', 'walk', 'walk-carry', 'idle-talking', 'idle-listening', 'greeting', 'idle-foldarms', 'rope-pull', 'dance-simple', 'victory'],
  },
  makeda: {
    role: 'makeda',
    archetype: 'elder',
    isPoetHero: false,
    defaultGlasses: false,
    defaultWings: 'off',
    defaultProp: 'none',
    initialClip: 'idle',
    preloadClips: ['idle', 'walk', 'walk-carry', 'rope-pull', 'farm-watering', 'idle-talking', 'idle-listening', 'greeting', 'pray'],
  },
  bekele: {
    role: 'bekele',
    archetype: 'adult_m',
    isPoetHero: false,
    defaultGlasses: false,
    defaultWings: 'off',
    defaultProp: 'none',
    initialClip: 'idle-listening',
    preloadClips: ['idle', 'walk', 'idle-talking', 'idle-listening', 'greeting', 'idle-foldarms', 'sitting-talking', 'yes', 'pray'],
  },
  june: {
    role: 'june',
    archetype: 'child7',
    isPoetHero: false,
    defaultGlasses: false,
    defaultWings: 'off',
    defaultProp: 'none',
    initialClip: 'idle',
    preloadClips: ['idle', 'walk', 'jog', 'greeting', 'victory', 'clapping', 'dance-simple', 'sitting-talking', 'idle-talking'],
  },
  courier: {
    role: 'courier',
    archetype: 'adult_m',
    isPoetHero: false,
    defaultGlasses: false,
    defaultWings: 'off',
    defaultProp: 'parcel',
    initialClip: 'walk-carry',
    preloadClips: ['idle', 'walk', 'walk-carry', 'jog', 'greeting', 'idle-talking', 'idle-listening'],
  },
  chorus: {
    role: 'chorus',
    archetype: null,
    isPoetHero: false,
    defaultGlasses: false,
    defaultWings: 'off',
    defaultProp: 'none',
    initialClip: 'idle-listening',
    preloadClips: ['idle', 'walk', 'walk-relaxed', 'idle-talking', 'idle-listening', 'greeting', 'sitting-talking', 'pray', 'dance-simple', 'clapping', 'yes'],
  },
});

const EXTRA_CAST_MAP = Object.freeze({
  hero: 'poet_hero',
  poet: 'poet_hero',
  hiwot: 'imani',
  miriam: 'imani',
  maren: 'imani',
  selam: 'makeda',
  dawit: 'bekele',
  tadesse: 'bekele',
});

// ---------------------------------------------------------------------------
// Auto-Loader for Classic UMD Scripts (`Mesh2MotionAnny` & `AnnyHumanV7`)
// ---------------------------------------------------------------------------
let _runtimeScriptsPromise = null;
let _sharedLoader = null;
const _wingTexCache = new Map();

function loadClassicScriptOnce(src) {
  if (typeof document === 'undefined') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load runtime script: ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureAnnyRuntimeLoaded() {
  if (typeof window === 'undefined') return;
  if (window.Mesh2MotionAnny && window.AnnyHumanV7) return;
  if (!_runtimeScriptsPromise) {
    _runtimeScriptsPromise = (async () => {
      if (!window.Mesh2MotionAnny) {
        await loadClassicScriptOnce(M2M_SCRIPT_URL);
      }
      if (!window.AnnyHumanV7) {
        await loadClassicScriptOnce(ANNY_V7_SCRIPT_URL);
      }
    })();
  }
  await _runtimeScriptsPromise;
}

function ensureGLTFLoader(loaderOverride) {
  if (loaderOverride) {
    if (typeof loaderOverride.setMeshoptDecoder === 'function') {
      loaderOverride.setMeshoptDecoder(MeshoptDecoder);
    }
    return loaderOverride;
  }
  if (!_sharedLoader) {
    _sharedLoader = new GLTFLoader();
    _sharedLoader.setMeshoptDecoder(MeshoptDecoder);
  }
  return _sharedLoader;
}

function getWingTexture(THREE, relFile) {
  const url = `${HERO_ASSETS_URL}/wings/${relFile}`;
  if (_wingTexCache.has(url)) return _wingTexCache.get(url);
  const texLoader = new THREE.TextureLoader();
  const tex = texLoader.load(url);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  _wingTexCache.set(url, tex);
  return tex;
}

// ---------------------------------------------------------------------------
// Poet Hero Anatomical Chest Flattening + Continuous Masculine Tracksuit Jacket
// ---------------------------------------------------------------------------
function sculptMasculinePoetTorsoAndJacket(THREE, bodyMesh, jacketHex, trimHex, cuffHex, disposables) {
  const srcGeo = bodyMesh.geometry;
  const srcPos = srcGeo.attributes.position;
  const srcSi = srcGeo.attributes.skinIndex;
  const srcSw = srcGeo.attributes.skinWeight;
  const srcIdx = srcGeo.index;
  if (!srcPos || !srcIdx || !bodyMesh.skeleton) return null;

  const bones = bodyMesh.skeleton.bones;
  const boneNorm = bones.map((b) => normName(b.name));
  const vCount = srcPos.count;

  let minY = Infinity;
  let maxY = -Infinity;
  let torsoZSum = 0;
  let torsoZCnt = 0;
  const vDom = new Array(vCount);

  for (let v = 0; v < vCount; v++) {
    const y = srcPos.getY(v);
    const z = srcPos.getZ(v);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    const i0 = srcSi.getX(v), i1 = srcSi.getY(v), i2 = srcSi.getZ(v), i3 = srcSi.getW(v);
    const w0 = srcSw.getX(v), w1 = srcSw.getY(v), w2 = srcSw.getZ(v), w3 = srcSw.getW(v);
    let best = i0, bw = w0;
    if (w1 > bw) { best = i1; bw = w1; }
    if (w2 > bw) { best = i2; bw = w2; }
    if (w3 > bw) { best = i3; }
    const bn = boneNorm[best] || 'root';
    vDom[v] = bn;
    if (bn.startsWith('spine') || bn === 'root') {
      torsoZSum += z;
      torsoZCnt++;
    }
  }

  const height = Math.max(0.5, maxY - minY);
  const centerZ = torsoZCnt > 0 ? torsoZSum / torsoZCnt : 0.02;

  // 1. Flatten pectoral/breast curvature on base bodyMesh for an athletic male chest
  for (let v = 0; v < vCount; v++) {
    const bn = vDom[v];
    if (!bn.startsWith('spine') && !bn.startsWith('clavicle') && !bn.startsWith('shoulder')) continue;
    const x = srcPos.getX(v);
    const y = srcPos.getY(v);
    const z = srcPos.getZ(v);
    const yn = (y - minY) / height;
    if (yn > 0.64 && yn < 0.82 && z > centerZ + 0.035) {
      const chestMask = Math.sin(clamp((yn - 0.64) / 0.18, 0, 1) * Math.PI);
      const excessZ = z - (centerZ + 0.035);
      srcPos.setZ(v, z - excessZ * 0.46 * chestMask);
    }
    if (yn > 0.72 && yn < 0.84) {
      srcPos.setX(v, x * 1.035);
    }
  }
  srcPos.needsUpdate = true;
  srcGeo.computeVertexNormals();
  const srcNrm = srcGeo.attributes.normal;

  // 2. Build continuous straight-hemmed Poet Tracksuit Jacket (includes pelvis/hips down to yn=0.502 so ZERO V-cut!)
  const isJacketBone = (bn) => (
    bn.startsWith('spine') ||
    bn.startsWith('clavicle') ||
    bn.startsWith('shoulder') ||
    bn.startsWith('upperarm') ||
    bn.startsWith('lowerarm') ||
    bn.startsWith('pelvis') ||
    bn.startsWith('upperleg') ||
    bn === 'root'
  );

  const vInc = new Uint8Array(vCount);
  for (let v = 0; v < vCount; v++) {
    const bn = vDom[v];
    if (!isJacketBone(bn)) continue;
    const x = srcPos.getX(v);
    const y = srcPos.getY(v);
    const z = srcPos.getZ(v);
    const yn = (y - minY) / height;
    const isArm = bn.startsWith('upperarm') || bn.startsWith('lowerarm');
    if (!isArm) {
      // Straight horizontal blouson waistband hem at yn = 0.502, clean crew/collar neck at yn = 0.838
      const neckScoop = z > centerZ ? 0.014 * Math.max(0, 1 - Math.abs(x) / 0.10) : 0.004;
      if (yn < 0.502 || yn > 0.838 - neckScoop) continue;
    }
    vInc[v] = 1;
  }

  const idxArr = srcIdx.array;
  const triList = [];
  const oldToNew = new Int32Array(vCount).fill(-1);
  const newToOld = [];
  for (let t = 0; t < idxArr.length; t += 3) {
    const a = idxArr[t], b = idxArr[t + 1], c = idxArr[t + 2];
    if (!vInc[a] || !vInc[b] || !vInc[c]) continue;
    for (const ov of [a, b, c]) {
      if (oldToNew[ov] < 0) {
        oldToNew[ov] = newToOld.length;
        newToOld.push(ov);
      }
    }
    triList.push(oldToNew[a], oldToNew[b], oldToNew[c]);
  }

  const nV = newToOld.length;
  if (nV < 24) return null;

  // Boundary smoothing table for razor-straight waistband & sleeve cuffs
  const edgeCnt = new Map();
  const bAdj = new Map();
  const addE = (u, v) => {
    const lo = u < v ? u : v;
    const hi = u < v ? v : u;
    const k = lo * nV + hi;
    edgeCnt.set(k, (edgeCnt.get(k) || 0) + 1);
  };
  for (let t = 0; t < triList.length; t += 3) {
    addE(triList[t], triList[t + 1]);
    addE(triList[t + 1], triList[t + 2]);
    addE(triList[t + 2], triList[t]);
  }
  for (const [k, cnt] of edgeCnt.entries()) {
    if (cnt === 1) {
      const u = Math.floor(k / nV);
      const v = k - u * nV;
      if (!bAdj.has(u)) bAdj.set(u, []);
      if (!bAdj.has(v)) bAdj.set(v, []);
      bAdj.get(u).push(v);
      bAdj.get(v).push(u);
    }
  }

  const outPos = new Float32Array(nV * 3);
  const outCol = new Float32Array(nV * 3);
  const outSi = new Uint16Array(nV * 4);
  const outSw = new Float32Array(nV * 4);
  // Store vertex zone tag: 0 = main jacket body, 1 = piping stripe, 2 = cuff/hem rib
  const vZone = new Uint8Array(nV);

  for (let i = 0; i < nV; i++) {
    const ov = newToOld[i];
    const x = srcPos.getX(ov);
    const y = srcPos.getY(ov);
    const z = srcPos.getZ(ov);
    const nx = srcNrm.getX(ov);
    const ny = srcNrm.getY(ov);
    const nz = srcNrm.getZ(ov);
    const yn = (y - minY) / height;
    const bn = vDom[ov];
    const isArm = bn.startsWith('upperarm') || bn.startsWith('lowerarm');

    // Structured boxy masculine blouson ease (fills waist indent for clean straight athletic cut)
    const waistFill = !isArm && yn < 0.68 ? Math.sin(clamp((0.68 - yn) / 0.18, 0, 1) * Math.PI * 0.85) * 0.012 : 0;
    const off = (isArm ? 0.0115 : 0.0145) + waistFill;

    outPos[i * 3] = x + nx * off;
    outPos[i * 3 + 1] = y + ny * off * (isArm ? 1.0 : 0.35);
    outPos[i * 3 + 2] = z + nz * off;

    // Zone classification for crisp Poet Tracksuit piping (thin outer-seam line ONLY, never whole sleeve!)
    let zone = 0;
    if (isArm) {
      // Thin dorsal/outer piping stripe along top-outer ridge of sleeve (`abs(z - centerZ) < 0.012`)
      if (Math.abs(z - (centerZ - 0.015)) < 0.011) {
        zone = 1;
      } else if (bn.startsWith('lowerarm') && bAdj.has(i)) {
        zone = 2; // wrist cuff rib
      }
    } else {
      // Center-front thin zip track + thin shoulder-to-chest Raglan piping seam (just like 31-part Poet!)
      const dz = z - centerZ;
      const absX = Math.abs(x);
      const raglanLine = Math.abs(absX - (0.048 + (0.83 - yn) * 0.42));
      if (dz > 0.02 && absX < 0.0065) {
        zone = 2; // center zip
      } else if (dz > 0.01 && yn > 0.66 && raglanLine < 0.010) {
        zone = 1; // crisp Raglan chest/shoulder piping matching 01_torso_front.png!
      } else if (yn < 0.528) {
        zone = 2; // ribbed waistband hem
      }
    }
    vZone[i] = zone;

    outSi[i * 4] = srcSi.getX(ov);
    outSi[i * 4 + 1] = srcSi.getY(ov);
    outSi[i * 4 + 2] = srcSi.getZ(ov);
    outSi[i * 4 + 3] = srcSi.getW(ov);
    outSw[i * 4] = srcSw.getX(ov);
    outSw[i * 4 + 1] = srcSw.getY(ov);
    outSw[i * 4 + 2] = srcSw.getZ(ov);
    outSw[i * 4 + 3] = srcSw.getW(ov);
  }

  // Smooth boundary hems (4 passes)
  const tmp = new Float32Array(nV * 3);
  for (let pass = 0; pass < 4; pass++) {
    tmp.set(outPos);
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
      tmp[u * 3] = lerp(outPos[u * 3], sx * inv, 0.55);
      tmp[u * 3 + 1] = lerp(outPos[u * 3 + 1], sy * inv, 0.72);
      tmp[u * 3 + 2] = lerp(outPos[u * 3 + 2], sz * inv, 0.55);
    }
    outPos.set(tmp);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
  const colAttr = new THREE.BufferAttribute(outCol, 3);
  geo.setAttribute('color', colAttr);
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(outSi, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(outSw, 4));
  geo.setIndex(triList);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });
  disposables.push(geo, mat);

  function recolorJacket(jHex, tHex, cHex) {
    const cBody = new THREE.Color(jHex);
    const cTrim = new THREE.Color(tHex);
    const cRib = new THREE.Color(cHex);
    for (let i = 0; i < nV; i++) {
      const z = vZone[i];
      const c = z === 1 ? cTrim : (z === 2 ? cRib : cBody);
      outCol[i * 3] = c.r;
      outCol[i * 3 + 1] = c.g;
      outCol[i * 3 + 2] = c.b;
    }
    colAttr.needsUpdate = true;
  }
  recolorJacket(jacketHex, trimHex, cuffHex);

  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = 'v9_poet_tracksuit_jacket';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
  (bodyMesh.parent || bodyMesh).add(mesh);

  return { mesh, recolorJacket, minY, height, centerZ };
}

function recolorPoetTrousers(THREE, trouserMesh, bodyHex, trimHex, disposables) {
  if (!trouserMesh || !trouserMesh.geometry) return;
  const geo = trouserMesh.geometry;
  const pos = geo.attributes.position;
  const nV = pos.count;
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < nV; i++) {
    const x = Math.abs(pos.getX(i));
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const colArr = new Float32Array(nV * 3);
  const cBody = new THREE.Color(bodyHex);
  const cTrim = new THREE.Color(trimHex);
  for (let i = 0; i < nV; i++) {
    const x = Math.abs(pos.getX(i));
    const z = pos.getZ(i);
    // Thin outer-leg track stripe only along lateral outer seam (`x > maxX * 0.78 && abs(z) < 0.012`)
    const isStripe = x > maxX * 0.76 && Math.abs(z - 0.015) < 0.011;
    const c = isStripe ? cTrim : cBody;
    colArr[i * 3] = c.r;
    colArr[i * 3 + 1] = c.g;
    colArr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  disposables.push(mat);
  trouserMesh.material = mat;
}

// ---------------------------------------------------------------------------
// Measure Head Landmarks & Build Poet Buzz-Fade Hair, Trimmed Beard & Seated Sunglasses
// ---------------------------------------------------------------------------
function measureHeadAndEyeLandmarks(THREE, bodyMesh, headBone, eyeLBone, eyeRBone) {
  bodyMesh.updateMatrixWorld(true);
  headBone.updateMatrixWorld(true);
  const invHead = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
  const bodyToHead = new THREE.Matrix4().multiplyMatrices(invHead, bodyMesh.matrixWorld);
  const pos = bodyMesh.geometry.attributes.position;
  const si = bodyMesh.geometry.attributes.skinIndex;
  const sw = bodyMesh.geometry.attributes.skinWeight;
  const bones = bodyMesh.skeleton.bones;
  const headIdx = bones.indexOf(headBone);

  let hx0 = Infinity, hx1 = -Infinity, hy0 = Infinity, hy1 = -Infinity, hz0 = Infinity, hz1 = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const wHead = (si.getX(i) === headIdx ? sw.getX(i) : 0) +
                  (si.getY(i) === headIdx ? sw.getY(i) : 0) +
                  (si.getZ(i) === headIdx ? sw.getZ(i) : 0) +
                  (si.getW(i) === headIdx ? sw.getW(i) : 0);
    if (wHead < 0.35) continue;
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(bodyToHead);
    if (v.y < -0.02) continue;
    if (v.x < hx0) hx0 = v.x;
    if (v.x > hx1) hx1 = v.x;
    if (v.y < hy0) hy0 = v.y;
    if (v.y > hy1) hy1 = v.y;
    if (v.z < hz0) hz0 = v.z;
    if (v.z > hz1) hz1 = v.z;
  }

  const cx = Number.isFinite(hx0) ? (hx0 + hx1) * 0.5 : 0;
  const cy = Number.isFinite(hy0) ? (hy0 + hy1) * 0.5 : 0.085;
  const cz = Number.isFinite(hz0) ? (hz0 + hz1) * 0.5 : 0.008;
  const rx = Number.isFinite(hx0) ? Math.max(0.06, (hx1 - hx0) * 0.5) : 0.076;
  const ry = Number.isFinite(hy0) ? Math.max(0.075, (hy1 - hy0) * 0.5) : 0.098;
  const rz = Number.isFinite(hz0) ? Math.max(0.065, (hz1 - hz0) * 0.5) : 0.088;

  // Exact eye-line in headBone local space
  let eyeY = cy + ry * 0.05;
  let eyeZ = hz1 - rz * 0.16;
  let eyeHalfSpan = rx * 0.40;
  if (eyeLBone && eyeRBone) {
    const pL = new THREE.Vector3();
    const pR = new THREE.Vector3();
    eyeLBone.getWorldPosition(pL).applyMatrix4(invHead);
    eyeRBone.getWorldPosition(pR).applyMatrix4(invHead);
    eyeY = (pL.y + pR.y) * 0.5;
    eyeZ = Math.max(pL.z, pR.z);
    eyeHalfSpan = Math.max(0.026, Math.abs(pL.x - pR.x) * 0.5);
  }
  // Measure actual brow/nose-bridge skin front Z at eyeY
  let bridgeZ = eyeZ + 0.014;
  for (let i = 0; i < pos.count; i++) {
    const wHead = (si.getX(i) === headIdx ? sw.getX(i) : 0) + (si.getY(i) === headIdx ? sw.getY(i) : 0);
    if (wHead < 0.4) continue;
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(bodyToHead);
    if (Math.abs(v.y - eyeY) < 0.015 && Math.abs(v.x - cx) < eyeHalfSpan * 1.15) {
      if (v.z + 0.008 > bridgeZ) bridgeZ = v.z + 0.008;
    }
  }

  return { cx, cy, cz, rx, ry, rz, minY: hy0, maxY: hy1, maxZ: hz1, eyeY, eyeHalfSpan, bridgeZ };
}

function buildPoetHairAndBeard(THREE, headBone, hm, disposables) {
  const group = new THREE.Group();
  group.name = 'v9_poet_tapered_groom_and_beard';

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x151317,
    roughness: 0.92,
    metalness: 0.01,
  });
  disposables.push(hairMat);

  const { cx, cy, cz, rx, ry, rz } = hm;

  // Low-profile buzz-fade cranial cap wrapping crown, temples, and nape (matches 31-part Poet!)
  const capGeo = new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const sideburnGeo = new THREE.BoxGeometry(0.012, ry * 0.46, 0.022);
  const jawBeardGeo = new THREE.TorusGeometry(rx * 0.78, rx * 0.16, 10, 22, Math.PI * 0.96);
  const chinBeardGeo = new THREE.SphereGeometry(1, 14, 10);
  const stacheGeo = new THREE.CapsuleGeometry(rx * 0.055, rx * 0.34, 4, 8);
  disposables.push(capGeo, sideburnGeo, jawBeardGeo, chinBeardGeo, stacheGeo);

  const cap = new THREE.Mesh(capGeo, hairMat);
  cap.position.set(cx, cy + ry * 0.12, cz - rz * 0.06);
  cap.scale.set(rx * 1.035, ry * 0.92, rz * 1.03);
  cap.castShadow = true;
  group.add(cap);

  // Sideburns connecting hairline down into jaw beard
  for (const sx of [-1, 1]) {
    const sb = new THREE.Mesh(sideburnGeo, hairMat);
    sb.position.set(cx + sx * rx * 0.92, hm.eyeY - ry * 0.14, cz + rz * 0.24);
    sb.rotation.z = sx * -0.08;
    group.add(sb);
  }

  // Sculpted trimmed jaw-line beard & chin goatee (leaves lips open for FACS speech!)
  const jawArc = new THREE.Mesh(jawBeardGeo, hairMat);
  jawArc.position.set(cx, cy - ry * 0.56, cz + rz * 0.22);
  jawArc.rotation.x = Math.PI * 0.58;
  jawArc.rotation.z = Math.PI * 0.02;
  jawArc.scale.set(1.02, 1.08, 0.85);
  group.add(jawArc);

  const chin = new THREE.Mesh(chinBeardGeo, hairMat);
  chin.position.set(cx, cy - ry * 0.76, cz + rz * 0.56);
  chin.scale.set(rx * 0.52, ry * 0.24, rz * 0.36);
  group.add(chin);

  // Neat mustache above upper lip
  const stache = new THREE.Mesh(stacheGeo, hairMat);
  stache.position.set(cx, hm.eyeY - hm.eyeHalfSpan * 1.55, hm.bridgeZ - 0.004);
  stache.rotation.z = Math.PI * 0.5;
  group.add(stache);

  headBone.add(group);
  return group;
}

function buildSculptedChelseaBoot(THREE, footBone, side, trimMat, disposables) {
  const group = new THREE.Group();
  group.name = `v9_poet_boot_${side}`;

  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x14161d,
    roughness: 0.44,
    metalness: 0.12,
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: 0x0b0c10,
    roughness: 0.88,
    metalness: 0.04,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd8a854,
    roughness: 0.28,
    metalness: 0.86,
  });
  disposables.push(leatherMat, soleMat, brassMat);

  const soleGeo = new THREE.BoxGeometry(0.094, 0.020, 0.252);
  const vampGeo = new THREE.CapsuleGeometry(0.042, 0.112, 6, 12);
  const shaftGeo = new THREE.CylinderGeometry(0.045, 0.043, 0.105, 14);
  const weltGeo = new THREE.BoxGeometry(0.098, 0.004, 0.256);
  disposables.push(soleGeo, vampGeo, shaftGeo, weltGeo);

  const soleY = -0.050;
  const sole = new THREE.Mesh(soleGeo, soleMat);
  sole.position.set(0, soleY + 0.010, 0.054);
  sole.castShadow = true;
  group.add(sole);

  const welt = new THREE.Mesh(weltGeo, trimMat);
  welt.position.set(0, soleY + 0.021, 0.054);
  group.add(welt);

  const vamp = new THREE.Mesh(vampGeo, leatherMat);
  vamp.rotation.x = Math.PI * 0.5;
  vamp.scale.set(1.02, 1.0, 0.76);
  vamp.position.set(0, soleY + 0.045, 0.070);
  vamp.castShadow = true;
  group.add(vamp);

  const shaft = new THREE.Mesh(shaftGeo, leatherMat);
  shaft.position.set(0, soleY + 0.088, -0.005);
  shaft.castShadow = true;
  group.add(shaft);

  footBone.add(group);
  return { group, soleLocalY: soleY };
}

function buildSleekWristCuffsAndCollar(THREE, annyRoot, bonesByNorm, cuffRibMat, trimMat, disposables) {
  annyRoot.updateMatrixWorld(true);
  const cuffGeo = new THREE.CylinderGeometry(0.032, 0.029, 0.028, 16);
  const pipGeo = new THREE.TorusGeometry(0.0305, 0.0025, 6, 18);
  disposables.push(cuffGeo, pipGeo);

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const upY = new THREE.Vector3(0, 1, 0);

  for (const [side, lKey, wKey] of [['L', 'lowerarm01l', 'wristl'], ['R', 'lowerarm01r', 'wristr']]) {
    const lower = bonesByNorm.get(lKey);
    const wrist = bonesByNorm.get(wKey);
    if (!lower || !wrist) continue;

    // Align cuff cylinder along actual forearm->wrist bone axis in lowerarm local space
    const invLower = new THREE.Matrix4().copy(lower.matrixWorld).invert();
    lower.getWorldPosition(vA).applyMatrix4(invLower);
    wrist.getWorldPosition(vB).applyMatrix4(invLower);
    const dir = vB.clone().sub(vA);
    const len = dir.length();
    if (len < 0.04) continue;
    dir.divideScalar(len);

    const g = new THREE.Group();
    g.name = `v9_cuff_tuck_${side}`;
    g.position.copy(vB).addScaledVector(dir, -0.016);
    g.quaternion.setFromUnitVectors(upY, dir);

    const cuff = new THREE.Mesh(cuffGeo, cuffRibMat);
    cuff.castShadow = true;
    g.add(cuff);

    const pip = new THREE.Mesh(pipGeo, trimMat);
    pip.rotation.x = Math.PI * 0.5;
    pip.position.set(0, 0.014, 0);
    g.add(pip);

    lower.add(g);
  }

  const neck = bonesByNorm.get('neck01') || bonesByNorm.get('spine01');
  if (neck) {
    const collarGroup = new THREE.Group();
    collarGroup.name = 'v9_poet_stand_collar';
    const collarGeo = new THREE.CylinderGeometry(0.058, 0.064, 0.032, 20, 1, true, Math.PI * 0.16, Math.PI * 1.68);
    const rimGeo = new THREE.TorusGeometry(0.059, 0.0024, 6, 20, Math.PI * 1.66);
    disposables.push(collarGeo, rimGeo);

    const collar = new THREE.Mesh(collarGeo, cuffRibMat);
    collar.position.set(0, -0.010, -0.004);
    collarGroup.add(collar);

    const rim = new THREE.Mesh(rimGeo, trimMat);
    rim.rotation.x = Math.PI * 0.5;
    rim.rotation.z = Math.PI * 0.67;
    rim.position.set(0, 0.006, -0.004);
    collarGroup.add(rim);

    neck.add(collarGroup);
  }
}

function buildBrassSunglasses3D(THREE, headBone, hm, disposables) {
  const hingeRoot = new THREE.Group();
  hingeRoot.name = 'v9_brass_sunglasses_hinge';
  // Seated squarely across the measured eye sockets & nose bridge (NEVER high on forehead!)
  hingeRoot.position.set(hm.cx, hm.eyeY, hm.bridgeZ);

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xe2b665,
    roughness: 0.24,
    metalness: 0.88,
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x090b12,
    roughness: 0.12,
    metalness: 0.72,
  });
  disposables.push(brassMat, lensMat);

  const eyeOffX = hm.eyeHalfSpan;
  const lensW = Math.max(0.022, eyeOffX * 0.76);
  const rimGeo = new THREE.TorusGeometry(lensW, 0.0024, 8, 20);
  const lensGeo = new THREE.CylinderGeometry(lensW * 0.97, lensW * 0.97, 0.004, 20);
  const browBarGeo = new THREE.CylinderGeometry(0.0020, 0.0020, eyeOffX * 2.9, 8);
  const bridgeGeo = new THREE.TorusGeometry(eyeOffX * 0.28, 0.0020, 6, 12, Math.PI);
  const templeGeo = new THREE.BoxGeometry(0.0028, 0.0038, hm.rz * 0.95);
  disposables.push(rimGeo, lensGeo, browBarGeo, bridgeGeo, templeGeo);

  for (const sx of [-1, 1]) {
    const xPos = sx * eyeOffX;
    const rim = new THREE.Mesh(rimGeo, brassMat);
    rim.position.set(xPos, -0.002, 0.003);
    rim.scale.set(1.16, 0.82, 1.0);
    hingeRoot.add(rim);

    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.rotation.x = Math.PI * 0.5;
    lens.position.set(xPos, -0.002, 0.003);
    lens.scale.set(1.14, 1.0, 0.80);
    hingeRoot.add(lens);

    const temple = new THREE.Mesh(templeGeo, brassMat);
    temple.position.set(sx * (eyeOffX + lensW * 1.08), 0.002, -hm.rz * 0.45);
    temple.rotation.y = sx * -0.05;
    hingeRoot.add(temple);
  }

  const browBar = new THREE.Mesh(browBarGeo, brassMat);
  browBar.rotation.z = Math.PI * 0.5;
  browBar.position.set(0, lensW * 0.76, 0.004);
  hingeRoot.add(browBar);

  const bridge = new THREE.Mesh(bridgeGeo, brassMat);
  bridge.position.set(0, 0.001, 0.005);
  hingeRoot.add(bridge);

  headBone.add(hingeRoot);
  return { hingeRoot, brassMat, lensMat };
}

function buildSwappableProps3D(THREE, wristBone, spineBone, disposables) {
  const handMount = new THREE.Group();
  handMount.name = 'v9_prop_hand_mount';
  handMount.position.set(-0.042, -0.032, 0.022);
  if (wristBone) wristBone.add(handMount);

  const chestMount = new THREE.Group();
  chestMount.name = 'v9_prop_chest_mount';
  chestMount.position.set(0, -0.045, 0.148);
  if (spineBone) spineBone.add(chestMount);

  const brassMat = new THREE.MeshStandardMaterial({ color: 0xdfb260, roughness: 0.26, metalness: 0.86 });
  const mahoganyMat = new THREE.MeshStandardMaterial({ color: 0x5c2c18, roughness: 0.48, metalness: 0.08 });
  const bellowsMat = new THREE.MeshStandardMaterial({ color: 0x181920, roughness: 0.82, metalness: 0.05 });
  const cyanMat = new THREE.MeshStandardMaterial({ color: 0x18b4ff, roughness: 0.32, metalness: 0.12 });
  const kraftMat = new THREE.MeshStandardMaterial({ color: 0xc8a472, roughness: 0.86, metalness: 0.02 });
  const twineMat = new THREE.MeshStandardMaterial({ color: 0x6e5332, roughness: 0.92, metalness: 0.0 });
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffd78a,
    emissive: 0xffa834,
    emissiveIntensity: 1.35,
    roughness: 0.20,
  });
  disposables.push(brassMat, mahoganyMat, bellowsMat, cyanMat, kraftMat, twineMat, lanternGlowMat);

  // 1. 8x10 Brass & Mahogany Field Camera
  const cameraGroup = new THREE.Group();
  cameraGroup.visible = false;
  const camBodyGeo = new THREE.BoxGeometry(0.15, 0.13, 0.075);
  const camBellowsGeo = new THREE.BoxGeometry(0.11, 0.10, 0.055);
  const camLensGeo = new THREE.CylinderGeometry(0.028, 0.032, 0.045, 16);
  disposables.push(camBodyGeo, camBellowsGeo, camLensGeo);

  const camBody = new THREE.Mesh(camBodyGeo, mahoganyMat);
  camBody.castShadow = true;
  cameraGroup.add(camBody);
  const camBellows = new THREE.Mesh(camBellowsGeo, bellowsMat);
  camBellows.position.set(0, 0, 0.062);
  cameraGroup.add(camBellows);
  const camLens = new THREE.Mesh(camLensGeo, brassMat);
  camLens.rotation.x = Math.PI * 0.5;
  camLens.position.set(0, 0, 0.105);
  cameraGroup.add(camLens);
  chestMount.add(cameraGroup);

  // 2. 5L Severn Cyan Jerrycan
  const jerikanGroup = new THREE.Group();
  jerikanGroup.visible = false;
  const canBodyGeo = new THREE.BoxGeometry(0.15, 0.24, 0.10);
  const canHandleGeo = new THREE.TorusGeometry(0.036, 0.009, 6, 14, Math.PI);
  const canCapGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.022, 12);
  disposables.push(canBodyGeo, canHandleGeo, canCapGeo);

  const canBody = new THREE.Mesh(canBodyGeo, cyanMat);
  canBody.position.set(0, -0.145, 0);
  canBody.castShadow = true;
  jerikanGroup.add(canBody);
  const canHandle = new THREE.Mesh(canHandleGeo, cyanMat);
  canHandle.position.set(0, -0.022, 0);
  jerikanGroup.add(canHandle);
  const canCap = new THREE.Mesh(canCapGeo, brassMat);
  canCap.position.set(0.042, -0.018, 0);
  canCap.rotation.z = -0.35;
  jerikanGroup.add(canCap);
  handMount.add(jerikanGroup);

  // 3. Severn Kraft Archival Parcel
  const parcelGroup = new THREE.Group();
  parcelGroup.visible = false;
  const boxGeo = new THREE.BoxGeometry(0.21, 0.13, 0.15);
  const ribbonXGeo = new THREE.BoxGeometry(0.216, 0.136, 0.012);
  const ribbonZGeo = new THREE.BoxGeometry(0.012, 0.136, 0.156);
  disposables.push(boxGeo, ribbonXGeo, ribbonZGeo);

  const pBox = new THREE.Mesh(boxGeo, kraftMat);
  pBox.position.set(0, -0.065, 0.035);
  pBox.castShadow = true;
  parcelGroup.add(pBox);
  const ribX = new THREE.Mesh(ribbonXGeo, twineMat);
  ribX.position.copy(pBox.position);
  parcelGroup.add(ribX);
  const ribZ = new THREE.Mesh(ribbonZGeo, twineMat);
  ribZ.position.copy(pBox.position);
  parcelGroup.add(ribZ);
  handMount.add(parcelGroup);

  // 4. Warm Brass Harbor Lantern
  const lanternGroup = new THREE.Group();
  lanternGroup.visible = false;
  const lanTopGeo = new THREE.ConeGeometry(0.064, 0.052, 10);
  const lanBaseGeo = new THREE.CylinderGeometry(0.054, 0.064, 0.028, 10);
  const lanCoreGeo = new THREE.CylinderGeometry(0.040, 0.040, 0.105, 12);
  const lanBailGeo = new THREE.TorusGeometry(0.048, 0.0045, 6, 14, Math.PI);
  disposables.push(lanTopGeo, lanBaseGeo, lanCoreGeo, lanBailGeo);

  const lanBail = new THREE.Mesh(lanBailGeo, brassMat);
  lanBail.position.set(0, -0.018, 0);
  lanternGroup.add(lanBail);
  const lanTop = new THREE.Mesh(lanTopGeo, brassMat);
  lanTop.position.set(0, -0.060, 0);
  lanternGroup.add(lanTop);
  const lanCore = new THREE.Mesh(lanCoreGeo, lanternGlowMat);
  lanCore.position.set(0, -0.132, 0);
  lanternGroup.add(lanCore);
  const lanBase = new THREE.Mesh(lanBaseGeo, brassMat);
  lanBase.position.set(0, -0.195, 0);
  lanternGroup.add(lanBase);
  handMount.add(lanternGroup);

  return {
    handMount,
    chestMount,
    groups: {
      camera: cameraGroup,
      jerikan: jerikanGroup,
      parcel: parcelGroup,
      lantern: lanternGroup,
    },
  };
}

// ---------------------------------------------------------------------------
// Clean Overlapping P06-S01 Wings (Pure Cutout Cards OR Overlapping Marble Relief Fan)
// ---------------------------------------------------------------------------
function buildArticulatedP06Wings(THREE, spineTopBone, disposables) {
  const wingsRoot = new THREE.Group();
  wingsRoot.name = 'v9_p06_evolutionary_wings';
  wingsRoot.position.set(0, 0.02, -0.11);
  wingsRoot.visible = false;
  if (spineTopBone) spineTopBone.add(wingsRoot);

  const marbleMat = new THREE.MeshStandardMaterial({
    color: 0xf2efe8,
    roughness: 0.34,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const kintsugiGoldMat = new THREE.MeshStandardMaterial({
    color: 0xdcb05c,
    roughness: 0.24,
    metalness: 0.86,
  });

  // Use cohesive horizontal feathered spans so segments overlap seamlessly with ZERO floating gaps
  const angelTexInner = getWingTexture(THREE, '08.cast.angel.wings__p07.png');
  const angelTexOuter = getWingTexture(THREE, '08.cast.angel.wings__p08.png');
  const ravenTexInner = getWingTexture(THREE, '04.props.ravens-stumps__p03.png');
  const ravenTexOuter = getWingTexture(THREE, '04.props.ravens-stumps__p05.png');

  const makeCutoutMat = (tex) => new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.06,
    roughness: 0.68,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  const angelInnerMat = makeCutoutMat(angelTexInner);
  const angelOuterMat = makeCutoutMat(angelTexOuter);
  const ravenInnerMat = makeCutoutMat(ravenTexInner);
  const ravenOuterMat = makeCutoutMat(ravenTexOuter);

  disposables.push(marbleMat, kintsugiGoldMat, angelInnerMat, angelOuterMat, ravenInnerMat, ravenOuterMat);

  const innerCardGeo = new THREE.PlaneGeometry(0.56, 0.42);
  const outerCardGeo = new THREE.PlaneGeometry(0.54, 0.40);
  const tipCardGeo = new THREE.PlaneGeometry(0.44, 0.32);
  // Wide flat beveled Carrara marble feather slats (overlapping relief fan — zero thin sticks!)
  const marbleSlatGeo = new THREE.BoxGeometry(0.34, 0.082, 0.014);
  const kintsugiTrimGeo = new THREE.BoxGeometry(0.32, 0.012, 0.016);
  disposables.push(innerCardGeo, outerCardGeo, tipCardGeo, marbleSlatGeo, kintsugiTrimGeo);

  const sides = [];
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.name = `v9_wing_shoulder_${side}`;
    shoulderPivot.position.set(sx * 0.075, 0.02, 0);
    wingsRoot.add(shoulderPivot);

    const innerCard = new THREE.Mesh(innerCardGeo, angelInnerMat);
    innerCard.position.set(sx * 0.23, 0.05, -0.008);
    if (sx < 0) innerCard.scale.x = -1;
    shoulderPivot.add(innerCard);

    const marbleInnerGroup = new THREE.Group();
    for (let f = 0; f < 5; f++) {
      const frac = f / 4;
      const slat = new THREE.Mesh(marbleSlatGeo, marbleMat);
      slat.position.set(sx * (0.16 + frac * 0.04), 0.11 - frac * 0.065, -0.004 * f);
      slat.rotation.z = sx * (0.26 - frac * 0.22);
      slat.scale.set(0.88 + (1 - frac) * 0.22, 1.0, 1.0);
      slat.castShadow = true;
      marbleInnerGroup.add(slat);
    }
    const goldEdge1 = new THREE.Mesh(kintsugiTrimGeo, kintsugiGoldMat);
    goldEdge1.position.set(sx * 0.17, 0.145, 0.002);
    goldEdge1.rotation.z = sx * 0.28;
    marbleInnerGroup.add(goldEdge1);
    shoulderPivot.add(marbleInnerGroup);

    // Mid-Span Pivot (overlaps inner wing cleanly at 0.30m)
    const midSpanPivot = new THREE.Group();
    midSpanPivot.name = `v9_wing_midspan_${side}`;
    midSpanPivot.position.set(sx * 0.30, 0.08, -0.006);
    shoulderPivot.add(midSpanPivot);

    const outerCard = new THREE.Mesh(outerCardGeo, angelOuterMat);
    outerCard.position.set(sx * 0.21, 0.03, -0.006);
    if (sx < 0) outerCard.scale.x = -1;
    midSpanPivot.add(outerCard);

    const marbleMidGroup = new THREE.Group();
    for (let f = 0; f < 5; f++) {
      const frac = f / 4;
      const slat = new THREE.Mesh(marbleSlatGeo, marbleMat);
      slat.position.set(sx * (0.16 + frac * 0.03), 0.08 - frac * 0.062, -0.004 * f);
      slat.rotation.z = sx * (0.14 - frac * 0.24);
      slat.scale.set(0.96 - frac * 0.12, 0.92, 1.0);
      slat.castShadow = true;
      marbleMidGroup.add(slat);
    }
    const goldEdge2 = new THREE.Mesh(kintsugiTrimGeo, kintsugiGoldMat);
    goldEdge2.position.set(sx * 0.16, 0.115, 0.002);
    goldEdge2.rotation.z = sx * 0.16;
    marbleMidGroup.add(goldEdge2);
    midSpanPivot.add(marbleMidGroup);

    // Distal Primary Tip Pivot (overlaps mid-span cleanly at 0.26m)
    const tipPivot = new THREE.Group();
    tipPivot.name = `v9_wing_tip_${side}`;
    tipPivot.position.set(sx * 0.26, 0.03, -0.006);
    midSpanPivot.add(tipPivot);

    const tipCard = new THREE.Mesh(tipCardGeo, angelOuterMat);
    tipCard.position.set(sx * 0.16, -0.01, -0.005);
    if (sx < 0) tipCard.scale.x = -1;
    tipPivot.add(tipCard);

    const marbleTipGroup = new THREE.Group();
    for (let f = 0; f < 4; f++) {
      const frac = f / 3;
      const slat = new THREE.Mesh(marbleSlatGeo, f === 0 ? kintsugiGoldMat : marbleMat);
      slat.position.set(sx * (0.14 - frac * 0.02), 0.04 - frac * 0.055, -0.003 * f);
      slat.rotation.z = sx * (0.04 - frac * 0.26);
      slat.scale.set(0.84 - frac * 0.22, 0.80, 0.9);
      slat.castShadow = true;
      marbleTipGroup.add(slat);
    }
    tipPivot.add(marbleTipGroup);

    sides.push({
      side,
      sx,
      shoulderPivot,
      midSpanPivot,
      tipPivot,
      innerCard,
      outerCard,
      tipCard,
      marbleGroups: [marbleInnerGroup, marbleMidGroup, marbleTipGroup],
    });
  }

  function applyMode(mode) {
    const m = String(mode || 'off').toLowerCase();
    if (m === 'off' || m === 'none') {
      wingsRoot.visible = false;
      return 'off';
    }
    wingsRoot.visible = true;
    const isMarble = m === 'marble' || m === 'folded';
    const isRaven = m === 'raven';
    for (const s of sides) {
      const showCutout = !isMarble;
      s.innerCard.visible = showCutout;
      s.outerCard.visible = showCutout;
      s.tipCard.visible = showCutout;
      if (showCutout) {
        s.innerCard.material = isRaven ? ravenInnerMat : angelInnerMat;
        s.outerCard.material = isRaven ? ravenOuterMat : angelOuterMat;
        s.tipCard.material = isRaven ? ravenOuterMat : angelOuterMat;
      }
      // Pure cutout feather cards on angel/raven (ZERO sticks poking through!); full marble fan on marble/folded
      s.marbleGroups[0].visible = isMarble;
      s.marbleGroups[1].visible = isMarble;
      s.marbleGroups[2].visible = isMarble;
    }
    return isMarble ? (m === 'folded' ? 'folded' : 'marble') : (isRaven ? 'raven' : 'angel');
  }

  return { wingsRoot, sides, applyMode };
}

// ---------------------------------------------------------------------------
// Precompute Anatomical Relaxed Arm & Palmar Finger Basis on Anny 104-Bone Rig
// ---------------------------------------------------------------------------
function buildBiomechanicalAssist(THREE, annyRoot, bonesByNorm, restQuats) {
  annyRoot.updateMatrixWorld(true);
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const qWorldDelta = new THREE.Quaternion();
  const qParentInv = new THREE.Quaternion();

  const relaxedArmQuats = new Map();
  for (const [sx, uKey, lKey] of [
    [1, 'upperarm01l', 'lowerarm01l'],
    [-1, 'upperarm01r', 'lowerarm01r'],
  ]) {
    const uBone = bonesByNorm.get(uKey);
    const lBone = bonesByNorm.get(lKey);
    if (!uBone || !lBone || !uBone.parent) continue;

    uBone.getWorldPosition(tmpA);
    lBone.getWorldPosition(tmpB);
    const curDirW = tmpB.sub(tmpA).normalize();
    const wantDirW = tmpC.set(sx * 0.19, -0.978, 0.05).transformDirection(annyRoot.matrixWorld).normalize();
    qWorldDelta.setFromUnitVectors(curDirW, wantDirW);

    const uWorldQ = new THREE.Quaternion();
    uBone.getWorldQuaternion(uWorldQ);
    const pWorldQ = new THREE.Quaternion();
    uBone.parent.getWorldQuaternion(pWorldQ);
    qParentInv.copy(pWorldQ).invert();

    const newLocalQ = qParentInv.multiply(qWorldDelta).multiply(uWorldQ);
    relaxedArmQuats.set(uBone.name, newLocalQ);
  }

  const fingerAxes = [];
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const sLow = side.toLowerCase();
    const wrist = bonesByNorm.get(`wrist${sLow}`);
    const idx1 = bonesByNorm.get(`finger21${sLow}`);
    const mid1 = bonesByNorm.get(`finger31${sLow}`);
    const pnk1 = bonesByNorm.get(`finger51${sLow}`);
    if (!wrist || !idx1 || !mid1 || !pnk1) continue;

    idx1.getWorldPosition(tmpA);
    pnk1.getWorldPosition(tmpB);
    const acrossW = tmpB.sub(tmpA).normalize();

    wrist.getWorldPosition(tmpA);
    mid1.getWorldPosition(tmpC);
    const fwdW = tmpC.sub(tmpA).normalize();

    const downInW = new THREE.Vector3(-sx * 0.65, -0.75, 0.10).transformDirection(annyRoot.matrixWorld).normalize();
    let flexAxisW = new THREE.Vector3().crossVectors(fwdW, downInW).normalize();
    if (flexAxisW.lengthSq() < 0.2) flexAxisW.copy(acrossW);
    const testCurlDir = new THREE.Vector3().crossVectors(flexAxisW, fwdW);
    if (testCurlDir.dot(downInW) < 0) flexAxisW.negate();

    const bWorldQ = new THREE.Quaternion();
    for (let f = 2; f <= 5; f++) {
      for (let seg = 1; seg <= 3; seg++) {
        const b = bonesByNorm.get(`finger${f}${seg}${sLow}`);
        if (!b) continue;
        b.getWorldQuaternion(bWorldQ);
        const invB = bWorldQ.clone().invert();
        const localAxis = flexAxisW.clone().applyQuaternion(invB).normalize();
        fingerAxes.push({
          bone: b,
          side,
          digit: f,
          seg,
          localAxis,
          restQ: restQuats.get(b.name) ? restQuats.get(b.name).clone() : b.quaternion.clone(),
        });
      }
    }
  }

  return { relaxedArmQuats, fingerAxes };
}

// ---------------------------------------------------------------------------
// Main Factory: `createHeroOrCastV9`
// ---------------------------------------------------------------------------
export async function createHeroOrCastV9(opts = {}) {
  const THREE = opts.THREE || (typeof window !== 'undefined' ? window.THREE : null);
  if (!THREE) throw new Error('createHeroOrCastV9 requires opts.THREE');

  await ensureAnnyRuntimeLoaded();
  const loader = ensureGLTFLoader(opts.loader);

  const rawRole = String(opts.role || (opts.archetype ? '' : 'poet_hero')).trim().toLowerCase();
  const mappedRole = ROLE_PROFILES[rawRole] ? rawRole : (EXTRA_CAST_MAP[rawRole] || (opts.archetype ? 'chorus' : 'poet_hero'));
  const profile = ROLE_PROFILES[mappedRole] || ROLE_PROFILES.poet_hero;
  const seed = Number(opts.seed) || 0;

  const CHORUS_ARCHETYPES = ['adult_f', 'adult_m', 'elder'];
  const archKey = opts.archetype && ['adult_f', 'adult_m', 'elder', 'child7'].includes(opts.archetype)
    ? opts.archetype
    : (profile.archetype || CHORUS_ARCHETYPES[Math.floor(seededHash(seed, 3) * CHORUS_ARCHETYPES.length)]);

  const initialClip = resolveClipName(opts.initialClip || profile.initialClip || 'idle');
  const requestedPreload = Array.isArray(opts.preloadClips) && opts.preloadClips.length
    ? opts.preloadClips.map(resolveClipName)
    : profile.preloadClips;
  const fastClips = Array.from(new Set([initialClip, 'idle', 'walk']));
  const backgroundClips = Array.from(new Set([...requestedPreload, 'walk-relaxed', 'jog', 'sprint', 'walk-carry', 'idle-talking', 'idle-listening', 'greeting']));

  const baseInst = await window.AnnyHumanV7.createCharacter({
    THREE,
    loader,
    archetype: archKey,
    assetBaseUrl: opts.assetBaseUrl || ASSET_BASE_URL,
    clipsBaseUrl: opts.clipsBaseUrl || CLIPS_BASE_URL,
    clothed: opts.clothed !== false,
    groundY: Number(opts.groundY) || 0,
    lockRootMotion: opts.lockRootMotion !== false,
    keepVerticalBounce: opts.keepVerticalBounce !== false,
    preloadClips: fastClips,
    initialClip,
    speed: Number(opts.speed) || 1.0,
    wireframe: !!opts.wireframe,
  });

  if (baseInst.driver) {
    const restToLoad = backgroundClips.filter((c) => !baseInst.driver.hasClip(c));
    if (restToLoad.length) {
      baseInst.driver.loadLibrary(restToLoad).catch(() => {});
    }
  }

  const annyRoot = baseInst.root;
  const bonesByNorm = baseInst.bonesByNorm;
  const disposables = [];

  // Reset skeleton temporarily to clean restQuats so landmark/cuff/jacket bind measurements are 100% bind-pose exact
  for (const [bName, rQ] of baseInst.restQuats.entries()) {
    const b = baseInst.bonesByName.get(bName);
    if (b) b.quaternion.copy(rQ);
  }
  annyRoot.updateMatrixWorld(true);

  const headBone = bonesByNorm.get('head');
  const neckBone = bonesByNorm.get('neck01');
  const eyeLBone = bonesByNorm.get('eyel');
  const eyeRBone = bonesByNorm.get('eyer');
  const spineLow = bonesByNorm.get('spine05') || bonesByNorm.get('spine04');
  const spineMid = bonesByNorm.get('spine03');
  const spineTop = bonesByNorm.get('spine01');
  const upperArmL = bonesByNorm.get('upperarm01l');
  const upperArmR = bonesByNorm.get('upperarm01r');
  const lowerArmL = bonesByNorm.get('lowerarm01l');
  const lowerArmR = bonesByNorm.get('lowerarm01r');
  const wristL = bonesByNorm.get('wristl');
  const wristR = bonesByNorm.get('wristr');
  const footL = bonesByNorm.get('footl');
  const footR = bonesByNorm.get('footr');

  let bodyMesh = baseInst.rig ? baseInst.rig.bodyMesh : null;
  if (!bodyMesh) {
    annyRoot.traverse((o) => {
      if (o.isSkinnedMesh && !bodyMesh) bodyMesh = o;
    });
  }

  const hm = (bodyMesh && headBone)
    ? measureHeadAndEyeLandmarks(THREE, bodyMesh, headBone, eyeLBone, eyeRBone)
    : { cx: 0, cy: 0.085, cz: 0.008, rx: 0.076, ry: 0.098, rz: 0.088, eyeY: 0.090, eyeHalfSpan: 0.031, bridgeZ: 0.086 };

  // -------------------------------------------------------------------------
  // Poet Hero Custom Masculine Tracksuit, Beard, Cuff-Tucks & Boots
  // -------------------------------------------------------------------------
  const isPoetHero = profile.isPoetHero || rawRole === 'poet_hero' || rawRole === 'hero' || rawRole === 'poet';
  let poetJacketBuilder = null;
  let trouserMesh = null;
  let jacketHex = 0x151822; // deep matte obsidian-charcoal tracksuit
  let trimHex = 0xc8322b;   // crisp WYGWYL Poet crimson piping seam
  let cuffHex = 0x10131b;   // sleek dark ribbed cuff & waistband
  let customBootSoleY = null;

  const trimMat = new THREE.MeshStandardMaterial({
    color: trimHex,
    roughness: 0.46,
    metalness: 0.18,
  });
  const cuffRibMat = new THREE.MeshStandardMaterial({
    color: cuffHex,
    roughness: 0.78,
    metalness: 0.05,
  });
  disposables.push(trimMat, cuffRibMat);

  if (isPoetHero) {
    // Hide Elder's tunic, shamma, Verlet drape, turban/beard groom, and sandals cleanly
    annyRoot.traverse((obj) => {
      const nm = obj.name || '';
      if (
        nm === 'adult_m_v7_tunic_onepiece' ||
        nm.includes('shamma_wrap') ||
        nm.includes('verlet_shamma_drape') ||
        nm === 'anny_v7_groom_adult_m' ||
        nm.startsWith('anny_v7_sandal_')
      ) {
        obj.visible = false;
      }
      if (nm === 'adult_m_v7_trousers_onepiece') trouserMesh = obj;
    });

    if (bodyMesh) {
      poetJacketBuilder = sculptMasculinePoetTorsoAndJacket(THREE, bodyMesh, jacketHex, trimHex, cuffHex, disposables);
    }
    if (trouserMesh) {
      recolorPoetTrousers(THREE, trouserMesh, 0x12151f, trimHex, disposables);
    }
    if (headBone) {
      buildPoetHairAndBeard(THREE, headBone, hm, disposables);
    }
    buildSleekWristCuffsAndCollar(THREE, annyRoot, bonesByNorm, cuffRibMat, trimMat, disposables);

    if (footL) {
      const bL = buildSculptedChelseaBoot(THREE, footL, 'L', trimMat, disposables);
      customBootSoleY = bL.soleLocalY;
    }
    if (footR) {
      buildSculptedChelseaBoot(THREE, footR, 'R', trimMat, disposables);
    }
  }

  const glassesRig = headBone ? buildBrassSunglasses3D(THREE, headBone, hm, disposables) : null;
  const propsRig = buildSwappableProps3D(THREE, wristR, spineTop, disposables);
  const wingsRig = buildArticulatedP06Wings(THREE, spineTop, disposables);
  const bio = buildBiomechanicalAssist(THREE, annyRoot, bonesByNorm, baseInst.restQuats);

  // Collect all bones touched by procedural polish so we reset them cleanly BEFORE `driver.update(h)`
  // (Prevents ANY per-frame quaternion accumulation on unkeyed bones!)
  const proceduralBones = [
    spineLow, spineMid, spineTop,
    neckBone, headBone, eyeLBone, eyeRBone,
    upperArmL, upperArmR, lowerArmL, lowerArmR,
    ...bio.fingerAxes.map((f) => f.bone),
  ].filter(Boolean);

  // State
  let glassesState = opts.glasses !== undefined ? opts.glasses : profile.defaultGlasses;
  let propState = 'none';
  let wingsMode = 'off';
  let currentAction = initialClip;
  let moveSpeedMps = 0;
  let wasAutoLocomoting = false;
  let defaultLookTarget = opts.lookTargetVec3 || null;
  let groundY = Number(opts.groundY) || 0;
  let simTime = seededHash(seed, 11) * 10.0;
  let generation = 0;

  let smoothYaw = 0;
  let smoothPitch = 0;
  let smoothTurnLean = 0;
  let smoothCarryBlend = 0;
  let smoothWingAmp = 0;
  let wingPhase = seededHash(seed, 19) * Math.PI * 2;
  let saccadeTimer = 1.4;
  let saccadeYaw = 0;
  let saccadePitch = 0;

  // Scratch math (zero per-frame GC)
  const _vHeadW = new THREE.Vector3();
  const _vTgtW = new THREE.Vector3();
  const _vDirW = new THREE.Vector3();
  const _charLeftW = new THREE.Vector3();
  const _charUpW = new THREE.Vector3();
  const _charFwdW = new THREE.Vector3();
  const _vSpineW = new THREE.Vector3();
  const _vHandW = new THREE.Vector3();
  const _qYaw = new THREE.Quaternion();
  const _qPitch = new THREE.Quaternion();
  const _qRoll = new THREE.Quaternion();
  const _qDeltaW = new THREE.Quaternion();
  const _qBoneW = new THREE.Quaternion();
  const _qParentInvW = new THREE.Quaternion();
  const _qCurl = new THREE.Quaternion();

  /**
   * Apply (pitchX, yawY, rollZ) strictly in `annyRoot` character-aligned space
   * (`+X` character left, `+Y` vertical up, `+Z` character forward) regardless of Anny bone roll!
   */
  function rotateBoneInCharSpace(bone, pitchX, yawY, rollZ) {
    if (!bone || !bone.parent) return;
    if (Math.abs(pitchX) < 1e-5 && Math.abs(yawY) < 1e-5 && Math.abs(rollZ) < 1e-5) return;

    _qYaw.setFromAxisAngle(_charUpW, yawY);
    _qPitch.setFromAxisAngle(_charLeftW, pitchX);
    _qRoll.setFromAxisAngle(_charFwdW, rollZ);
    _qDeltaW.copy(_qYaw).multiply(_qPitch).multiply(_qRoll);

    bone.parent.updateMatrixWorld(true);
    bone.updateMatrixWorld(false);
    bone.getWorldQuaternion(_qBoneW);
    bone.parent.getWorldQuaternion(_qParentInvW);
    _qParentInvW.invert();

    bone.quaternion.copy(_qParentInvW.multiply(_qDeltaW).multiply(_qBoneW));
    bone.updateMatrixWorld(false);
  }

  function setGlasses(val) {
    if (val === 'toggle') {
      glassesState = !glassesState;
    } else if (val === 'up') {
      glassesState = 'up';
    } else {
      glassesState = !!(val && val !== 'off');
    }
    if (glassesRig) {
      glassesRig.hingeRoot.visible = glassesState !== false;
      glassesRig.hingeRoot.position.y = glassesState === 'up' ? (hm.eyeY + hm.ry * 0.34) : hm.eyeY;
      glassesRig.hingeRoot.rotation.x = glassesState === 'up' ? -0.32 : 0.0;
    }
    return glassesState;
  }

  function normalizePropKey(p) {
    const k = String(p || 'none').trim().toLowerCase();
    if (k === 'camera' || k === '8x10-camera' || k === '8x10') return 'camera';
    if (k === 'jerikan' || k === 'cyan-jerikan' || k === 'cyan-can' || k === 'jerrycan' || k === 'can') return 'jerikan';
    if (k === 'parcel' || k === 'box' || k === 'package') return 'parcel';
    if (k === 'lantern' || k === 'brass-lantern' || k === 'lamp') return 'lantern';
    return 'none';
  }

  function setProp(propName) {
    propState = normalizePropKey(propName);
    for (const [k, grp] of Object.entries(propsRig.groups)) {
      grp.visible = k === propState;
    }
    return propState;
  }

  const WING_CYCLE = ['off', 'folded', 'angel', 'raven', 'marble'];
  function setWingsMode(mode) {
    if (mode === 'cycle' || mode === 'toggle') {
      const idx = (WING_CYCLE.indexOf(wingsMode) + 1) % WING_CYCLE.length;
      wingsMode = wingsRig.applyMode(WING_CYCLE[idx]);
    } else {
      wingsMode = wingsRig.applyMode(mode);
    }
    return wingsMode;
  }

  function applyStrideSpeedForClip(clipKey, mps) {
    if (!baseInst.driver) return;
    const ref = LOCOMOTION_REF_MPS[clipKey];
    if (ref && mps > 0.05) {
      baseInst.driver.setSpeed(clamp(mps / ref, 0.42, 1.55));
    } else {
      baseInst.driver.setSpeed(1.0);
    }
  }

  function playAction(clipName, fade = 0.24) {
    const resolved = resolveClipName(clipName);
    if (resolved === currentAction && baseInst.driver && baseInst.driver.hasClip(resolved)) {
      return resolved;
    }
    currentAction = resolved;
    wasAutoLocomoting = false;
    if (!baseInst.driver) return resolved;

    if (baseInst.driver.hasClip(resolved)) {
      baseInst.driver.crossFadeTo(resolved, fade);
      applyStrideSpeedForClip(resolved, moveSpeedMps);
    } else {
      baseInst.driver.loadClip(resolved).then(() => {
        if (currentAction === resolved && baseInst.driver) {
          baseInst.driver.crossFadeTo(resolved, fade);
          applyStrideSpeedForClip(resolved, moveSpeedMps);
        }
      }).catch(() => {});
    }
    return resolved;
  }

  function setMoveSpeed(mps) {
    moveSpeedMps = Math.max(0, Number(mps) || 0);
    applyStrideSpeedForClip(currentAction, moveSpeedMps);
    return moveSpeedMps;
  }

  function setGroundY(y) {
    groundY = Number(y) || 0;
    baseInst.setGroundY(groundY);
  }

  function pinFeetCustom() {
    baseInst.rig?.pinFeetToGround();
    if (customBootSoleY !== null && footL && footR) {
      annyRoot.updateMatrixWorld(true);
      footL.getWorldPosition(_vHeadW);
      const yL = _vHeadW.y + customBootSoleY;
      footR.getWorldPosition(_vHeadW);
      const yR = _vHeadW.y + customBootSoleY;
      const minBootY = Math.min(yL, yR);
      if (Number.isFinite(minBootY)) {
        annyRoot.position.y += (groundY - minBootY);
        annyRoot.updateMatrixWorld(true);
      }
    }
  }

  function update(dt, uOpts = {}) {
    const h = clamp(Number(dt) || 0.016, 0.001, 0.05);
    simTime += h;

    // 1. Velocity-matched locomotion & optional auto-crossfade
    if (uOpts.moveSpeed !== undefined) {
      moveSpeedMps = Math.max(0, Number(uOpts.moveSpeed) || 0);
    }
    const allowAutoLoco = uOpts.autoLocomotion !== false && (uOpts.moveSpeed !== undefined || wasAutoLocomoting);
    if (allowAutoLoco) {
      if (moveSpeedMps > 4.15) {
        if (currentAction !== 'sprint') playAction('sprint', 0.20);
        wasAutoLocomoting = true;
      } else if (moveSpeedMps > 2.05) {
        if (currentAction !== 'jog') playAction('jog', 0.22);
        wasAutoLocomoting = true;
      } else if (moveSpeedMps > 0.08) {
        const handHeld = propState === 'jerikan' || propState === 'parcel' || propState === 'lantern';
        const want = handHeld ? 'walk-carry' : 'walk';
        if (currentAction !== want) playAction(want, 0.22);
        wasAutoLocomoting = true;
      } else if (wasAutoLocomoting) {
        playAction('idle', 0.28);
        wasAutoLocomoting = false;
      }
    }
    applyStrideSpeedForClip(currentAction, moveSpeedMps);

    // 2. Reset all procedural target bones to restQuats BEFORE driver.update(h)
    //    Keyed bones get cleanly overwritten by AnimationMixer; unkeyed bones NEVER accumulate!
    if (!uOpts.skipDriver) {
      for (let i = 0; i < proceduralBones.length; i++) {
        const b = proceduralBones[i];
        const rq = baseInst.restQuats.get(b.name);
        if (rq) b.quaternion.copy(rq);
      }
    }

    const hasClipNow = !!(baseInst.driver && baseInst.driver.hasClip(currentAction));
    if (baseInst.driver && !uOpts.skipDriver) {
      baseInst.driver.update(h);
    }

    // 3. Arm A-pose relaxation fallback when clips are still loading
    if (!hasClipNow && !uOpts.skipDriver) {
      for (const [bName, relQ] of bio.relaxedArmQuats.entries()) {
        const b = baseInst.bonesByName.get(bName);
        if (b) b.quaternion.copy(relQ);
      }
    }

    // Compute world-space character basis from `annyRoot` once per frame
    annyRoot.updateMatrixWorld(true);
    _charLeftW.set(1, 0, 0).transformDirection(annyRoot.matrixWorld).normalize();
    _charUpW.set(0, 1, 0).transformDirection(annyRoot.matrixWorld).normalize();
    _charFwdW.set(0, 0, 1).transformDirection(annyRoot.matrixWorld).normalize();

    // 4. Subtle chest/ribcage breathing + contra-lateral sway + turn lean (in pure character space!)
    const breath = Math.sin(simTime * 1.95) * 0.014;
    const sway = Math.sin(simTime * 1.35 + 0.7) * 0.010 * (moveSpeedMps < 0.15 ? 1.0 : 0.30);
    const rawTurn = clamp(Number(uOpts.turnRate) || 0, -3.5, 3.5);
    smoothTurnLean = lerp(smoothTurnLean, rawTurn, 1 - Math.exp(-8.5 * h));

    rotateBoneInCharSpace(spineLow, 0, smoothTurnLean * 0.02, -sway * 0.4 - smoothTurnLean * 0.035);
    rotateBoneInCharSpace(spineMid, -breath * 0.45, smoothTurnLean * 0.025, sway * 0.4 - smoothTurnLean * 0.045);
    rotateBoneInCharSpace(spineTop, -breath * 0.65, smoothTurnLean * 0.03, -smoothTurnLean * 0.04);

    // 5. Smooth Damped Head + Neck + Eye Gaze Tracking (strictly horizontal yaw & vertical pitch!)
    const lookTgt = uOpts.lookTargetVec3 !== undefined ? uOpts.lookTargetVec3 : defaultLookTarget;
    let wantYaw = 0;
    let wantPitch = 0;

    if (lookTgt && headBone) {
      headBone.getWorldPosition(_vHeadW);
      _vTgtW.set(Number(lookTgt.x) || 0, Number(lookTgt.y) || 0, Number(lookTgt.z) || 0);
      _vDirW.subVectors(_vTgtW, _vHeadW);
      const dist = _vDirW.length();
      if (dist > 0.22 && dist < 32.0) {
        _vDirW.divideScalar(dist);
        const fwdDot = _vDirW.dot(_charFwdW);
        if (fwdDot > -0.20) {
          const atten = fwdDot < 0.18 ? clamp((fwdDot + 0.20) / 0.38, 0, 1) : 1.0;
          const rawYaw = Math.atan2(_vDirW.dot(_charLeftW), Math.max(0.20, fwdDot));
          const rawPitch = -Math.asin(clamp(_vDirW.dot(_charUpW), -0.65, 0.65));
          wantYaw = clamp(rawYaw, -0.82, 0.82) * atten;
          wantPitch = clamp(rawPitch, -0.36, 0.36) * atten;
        }
      }
    } else {
      saccadeTimer -= h;
      if (saccadeTimer <= 0) {
        saccadeTimer = 2.0 + seededHash(Math.floor(simTime * 3), seed + 7) * 2.8;
        saccadeYaw = (seededHash(Math.floor(simTime * 5), seed + 13) - 0.5) * 0.16;
        saccadePitch = (seededHash(Math.floor(simTime * 7), seed + 23) - 0.5) * 0.07;
      }
      wantYaw = saccadeYaw;
      wantPitch = saccadePitch;
    }

    const gazeAlpha = 1 - Math.exp(-7.0 * h);
    smoothYaw = lerp(smoothYaw, wantYaw, gazeAlpha);
    smoothPitch = lerp(smoothPitch, wantPitch, gazeAlpha);

    rotateBoneInCharSpace(neckBone, smoothPitch * 0.35, smoothYaw * 0.35, 0);
    rotateBoneInCharSpace(headBone, smoothPitch * 0.50 + breath * 0.25, smoothYaw * 0.50, 0);
    rotateBoneInCharSpace(eyeLBone, smoothPitch * 0.15, smoothYaw * 0.15, 0);
    rotateBoneInCharSpace(eyeRBone, smoothPitch * 0.15, smoothYaw * 0.15, 0);

    // 6. Arm Anti-Clip + Carried-Prop Hold + Gentle Natural Finger Cascade
    const holdingHandProp = propState === 'jerikan' || propState === 'parcel' || propState === 'lantern';
    smoothCarryBlend = lerp(smoothCarryBlend, holdingHandProp ? 1.0 : 0.0, 1 - Math.exp(-9.0 * h));

    if (smoothCarryBlend > 0.01) {
      rotateBoneInCharSpace(upperArmR, -0.18 * smoothCarryBlend, 0, -0.08 * smoothCarryBlend);
      rotateBoneInCharSpace(lowerArmR, -0.42 * smoothCarryBlend, 0, 0);
    }

    if (spineMid && (wristL || wristR)) {
      spineMid.getWorldPosition(_vSpineW);
      if (wristL && upperArmL) {
        wristL.getWorldPosition(_vHandW);
        const horizL = Math.hypot(_vHandW.x - _vSpineW.x, _vHandW.z - _vSpineW.z);
        if (horizL < 0.145) {
          rotateBoneInCharSpace(upperArmL, 0, 0, -(0.145 - horizL) * 1.15);
        }
      }
      if (wristR && upperArmR) {
        wristR.getWorldPosition(_vHandW);
        const horizR = Math.hypot(_vHandW.x - _vSpineW.x, _vHandW.z - _vSpineW.z);
        if (horizR < 0.145) {
          rotateBoneInCharSpace(upperArmR, 0, 0, (0.145 - horizR) * 1.15);
        }
      }
    }

    // Subtle organic finger cascade (reset to restQuats before driver.update, so ZERO clawing!)
    for (let i = 0; i < bio.fingerAxes.length; i++) {
      const fa = bio.fingerAxes[i];
      const cascade = 0.07 + (fa.digit - 2) * 0.035;
      const micro = Math.sin(simTime * 1.5 + fa.digit * 0.5 + (fa.side === 'L' ? 0 : 1.3)) * 0.015;
      const segMult = fa.seg === 1 ? 0.75 : (fa.seg === 2 ? 0.85 : 0.60);
      const gripBoost = (fa.side === 'R' && smoothCarryBlend > 0.02) ? smoothCarryBlend * 0.42 : 0;
      const angle = (cascade + micro + gripBoost) * segMult;
      _qCurl.setFromAxisAngle(fa.localAxis, angle);
      fa.bone.quaternion.multiply(_qCurl);
    }

    // 7. Articulated 3-Joint P06-S01 Evolutionary Wing Kinematics
    if (wingsMode !== 'off') {
      const boost = clamp(Number(uOpts.wingFlapBoost) || 0, 0, 2.5);
      const isFolded = wingsMode === 'folded';
      const locoFactor = clamp(moveSpeedMps / 4.5, 0, 1.2);
      const isJump = currentAction === 'jump';
      const targetAmp = isFolded
        ? 0.05 + locoFactor * 0.06
        : 0.30 + locoFactor * 0.32 + boost * 0.38 + (isJump ? 0.34 : 0);
      smoothWingAmp = lerp(smoothWingAmp, targetAmp, 1 - Math.exp(-7.0 * h));

      const freq = isFolded ? 1.7 : (2.25 + locoFactor * 1.8 + boost * 2.0 + (isJump ? 1.9 : 0));
      wingPhase += h * freq * Math.PI * 2;

      for (const s of wingsRig.sides) {
        const sx = s.sx;
        if (isFolded) {
          const foldWave = Math.sin(wingPhase) * smoothWingAmp;
          s.shoulderPivot.rotation.set(0.10, sx * (0.76 + foldWave), sx * -0.46);
          s.midSpanPivot.rotation.set(0, sx * 0.34, sx * -0.56);
          s.tipPivot.rotation.set(0, sx * 0.18, sx * -0.30);
        } else {
          const w0 = Math.sin(wingPhase);
          const w1 = Math.sin(wingPhase - 0.58);
          const w2 = Math.sin(wingPhase - 1.16);
          s.shoulderPivot.rotation.set(
            0.06 + w0 * 0.08 * smoothWingAmp,
            sx * (-0.22 + w0 * smoothWingAmp * 0.85),
            sx * (0.12 + w0 * smoothWingAmp * 0.48)
          );
          s.midSpanPivot.rotation.set(
            0,
            sx * (0.06 + w1 * smoothWingAmp * 0.55),
            sx * (0.04 + w1 * smoothWingAmp * 0.36)
          );
          s.tipPivot.rotation.set(
            0,
            sx * (0.04 + w2 * smoothWingAmp * 0.46),
            sx * (w2 * smoothWingAmp * 0.30)
          );
        }
      }
    }

    // 8. Speech / Lip-Sync Convenience Wiring
    if (uOpts.talkText) {
      baseInst.setLyricSpeech(uOpts.talkText, uOpts.talkProgress ?? ((simTime * 0.28) % 1), uOpts.audioLevel ?? 1.0);
    } else if (uOpts.speaking === true) {
      if (baseInst.getExpression() !== 'talking') baseInst.setExpression('talking');
    } else if (uOpts.speaking === false && baseInst.getExpression() === 'talking') {
      baseInst.setExpression('neutral');
    }

    // 9. Exact Ground Pinning, 12-Target FACS Morphs & Verlet Cloth Step
    if (baseInst.rig) {
      baseInst.rig.update(h, uOpts);
    }
    if (!uOpts.skipGroundPin && customBootSoleY !== null) {
      pinFeetCustom();
    }
  }

  // Initial setup
  setGlasses(glassesState);
  setProp(opts.prop !== undefined ? opts.prop : profile.defaultProp);
  setWingsMode(opts.wingsMode !== undefined ? opts.wingsMode : profile.defaultWings);
  update(0.016, {});

  const phenotypeState = {
    generation: 0,
    poem: '06',
    jacketHex,
    trimHex,
    cuffHex,
    glasses: glassesState,
    prop: propState,
    wingsMode,
    clip: currentAction,
    contrastMode: 'balanced',
  };

  function applyCoatColors(newJacketHex, newTrimHex, newCuffHex, contrastMode = 'balanced') {
    jacketHex = newJacketHex;
    trimHex = newTrimHex;
    cuffHex = newCuffHex;
    trimMat.color.setHex(trimHex);
    cuffRibMat.color.setHex(cuffHex);
    if (isPoetHero && poetJacketBuilder) {
      poetJacketBuilder.recolorJacket(jacketHex, trimHex, cuffHex);
    }
    if (isPoetHero && trouserMesh) {
      recolorPoetTrousers(THREE, trouserMesh, jacketHex, trimHex, disposables);
    }
    phenotypeState.jacketHex = jacketHex;
    phenotypeState.trimHex = trimHex;
    phenotypeState.cuffHex = cuffHex;
    phenotypeState.contrastMode = contrastMode;
  }

  function getWorldBonePositions() {
    annyRoot.updateMatrixWorld(true);
    const posOf = (b) => {
      if (!b) return null;
      const v = new THREE.Vector3();
      b.getWorldPosition(v);
      return { x: Number(v.x.toFixed(4)), y: Number(v.y.toFixed(4)), z: Number(v.z.toFixed(4)) };
    };
    return {
      head: posOf(headBone),
      handL: posOf(wristL),
      handR: posOf(wristR),
      footL: posOf(footL),
      footR: posOf(footR),
      wingTipL: posOf(wingsRig.sides[0]?.tipPivot),
      wingTipR: posOf(wingsRig.sides[1]?.tipPivot),
    };
  }

  const heroInst = {
    version: VERSION,
    role: profile.role,
    archetype: archKey,
    isPoetHero,
    root: annyRoot,
    annyRoot,
    rig: baseInst.rig,
    driver: baseInst.driver,
    bonesByName: baseInst.bonesByName,
    bonesByNorm: baseInst.bonesByNorm,
    restQuats: baseInst.restQuats,

    playAction,
    play: (clip, playOpts) => playAction(clip, playOpts?.fadeDuration ?? 0.24),
    crossFadeTo: (clip, fade = 0.24) => playAction(clip, fade),
    getCurrentAction: () => currentAction,
    hasClip: (clip) => (baseInst.driver ? baseInst.driver.hasClip(resolveClipName(clip)) : false),
    loadClip: (clip) => (baseInst.driver ? baseInst.driver.loadClip(resolveClipName(clip)) : Promise.resolve(false)),
    getClipNames: () => (baseInst.driver ? baseInst.driver.getClipNames() : []),
    setSpeed: (s) => (baseInst.driver ? baseInst.driver.setSpeed(s) : undefined),
    setMoveSpeed,
    getMoveSpeed: () => moveSpeedMps,

    setGlasses,
    getGlasses: () => glassesState,
    setProp,
    getProp: () => propState,
    setWingsMode,
    getWingsMode: () => wingsMode,
    setLookTarget: (vec3) => { defaultLookTarget = vec3 || null; },
    applyCoatColors,

    evolvePhenotype: (evoOpts) => evolveHeroPhenotype(heroInst, evoOpts),
    getPhenotype: () => Object.assign({}, phenotypeState, {
      generation,
      glasses: glassesState,
      prop: propState,
      wingsMode,
      clip: currentAction,
    }),
    _bumpGeneration: () => {
      generation += 1;
      phenotypeState.generation = generation;
      return generation;
    },

    setGroundY,
    pinFeetToGround: pinFeetCustom,
    setWind: (vx, vz) => baseInst.setWind(vx, vz),
    setClothed: (b) => baseInst.setClothed(b),
    isClothed: () => baseInst.isClothed(),
    setWireframe: (b) => baseInst.setWireframe(b),
    setLyricSpeech: (text, p, lvl) => baseInst.setLyricSpeech(text, p, lvl),
    setJawOpenness: (v) => baseInst.setJawOpenness(v),
    setVisemeShape: (j, w, r, p, v) => baseInst.setVisemeShape(j, w, r, p, v),
    setExpression: (name) => baseInst.setExpression(name),
    getExpression: () => baseInst.getExpression(),
    setFacsTargets: (map) => baseInst.setFacsTargets(map),
    applySapiensPose: (sample, mode) => baseInst.applySapiensPose(sample, mode),
    getMetrics: () => Object.assign({}, baseInst.getMetrics() || {}, {
      version: VERSION,
      role: profile.role,
      currentAction,
      moveSpeedMps: Number(moveSpeedMps.toFixed(3)),
      glasses: glassesState,
      prop: propState,
      wingsMode,
      generation,
    }),
    getWorldBonePositions,
    update,
    dispose: () => {
      for (let i = 0; i < disposables.length; i++) {
        if (disposables[i] && typeof disposables[i].dispose === 'function') {
          disposables[i].dispose();
        }
      }
      baseInst.dispose();
    },
  };

  return heroInst;
}

// ---------------------------------------------------------------------------
// Hero Phenotype Co-Evolution Across Poems `01..14`, Shots & Backgrounds
// ---------------------------------------------------------------------------
export function evolveHeroPhenotype(heroInst, opts = {}) {
  if (!heroInst) return null;

  const gen = typeof heroInst._bumpGeneration === 'function'
    ? heroInst._bumpGeneration()
    : ((Number(opts.generation) || 0) + 1);

  const rawPoem = String(opts.poem ?? '06');
  const m = rawPoem.match(/(\d{1,2})/);
  const poemNum = m ? clamp(parseInt(m[1], 10), 1, 14) : 6;
  const seed = (Number(opts.seed) || 0) + gen * 31 + poemNum * 7;

  const bgLum = opts.bgLuminance !== undefined ? clamp(Number(opts.bgLuminance), 0, 1) : 0.35;
  const isDarkBg = bgLum < 0.44;
  const contrastMode = isDarkBg ? 'high-key-on-dark' : 'obsidian-on-light';

  // Keep Poet tracksuit rich dark indigo/charcoal/obsidian with high-contrast thin Raglan & seam piping!
  const DARK_BG_COATS = [0x1c2336, 0x20283d, 0x192534, 0x222034];
  const LIGHT_BG_COATS = [0x11141d, 0x141722, 0x161420, 0x0f151e];
  const DARK_BG_TRIMS = [0xe04238, 0xe8b858, 0x24b8f5, 0xede6d6];
  const LIGHT_BG_TRIMS = [0xc22b22, 0xb87e22, 0x0e7ec2, 0xcf3528];

  const coatList = isDarkBg ? DARK_BG_COATS : LIGHT_BG_COATS;
  const trimList = isDarkBg ? DARK_BG_TRIMS : LIGHT_BG_TRIMS;
  const jacketHex = coatList[Math.floor(seededHash(seed, 1) * coatList.length)];
  const trimHex = trimList[Math.floor(seededHash(seed, 2) * trimList.length)];
  const cuffHex = isDarkBg ? 0x242c42 : 0x10131b;

  if (typeof heroInst.applyCoatColors === 'function') {
    heroInst.applyCoatColors(jacketHex, trimHex, cuffHex, contrastMode);
  }

  let wingsMode = 'off';
  if (opts.wingsMode) {
    wingsMode = opts.wingsMode;
  } else if (poemNum <= 3) {
    wingsMode = gen % 3 === 2 ? 'folded' : 'off';
  } else if (poemNum <= 5) {
    wingsMode = seededHash(seed, 3) < 0.55 ? 'raven' : 'folded';
  } else if (poemNum === 6) {
    wingsMode = gen % 2 === 1 ? 'marble' : 'angel';
  } else if (poemNum <= 10) {
    const pick = ['angel', 'raven', 'marble', 'folded'];
    wingsMode = pick[Math.floor(seededHash(seed, 4) * pick.length)];
  } else {
    wingsMode = seededHash(seed, 5) < 0.65 ? 'marble' : 'angel';
  }
  if (typeof heroInst.setWingsMode === 'function') {
    wingsMode = heroInst.setWingsMode(wingsMode);
  }

  const glasses = opts.glasses !== undefined
    ? opts.glasses
    : (poemNum <= 3 ? (gen % 3 === 0) : (gen % 4 === 3 ? 'up' : true));
  if (typeof heroInst.setGlasses === 'function') {
    heroInst.setGlasses(glasses);
  }

  const shotKind = String(opts.shotKind || '').toLowerCase();
  const PROP_POOL = ['none', 'camera', 'jerikan', 'parcel', 'lantern'];
  let prop = 'none';
  if (opts.prop !== undefined) {
    prop = opts.prop;
  } else if (shotKind.includes('water') || shotKind.includes('standpipe') || shotKind.includes('harbor')) {
    prop = 'jerikan';
  } else if (shotKind.includes('night') || shotKind.includes('interior') || shotKind.includes('submerged')) {
    prop = 'lantern';
  } else if (shotKind.includes('handoff') || shotKind.includes('severn') || shotKind.includes('threshold')) {
    prop = 'parcel';
  } else if (shotKind.includes('survey') || shotKind.includes('street') || shotKind.includes('plate')) {
    prop = 'camera';
  } else {
    prop = PROP_POOL[(gen + poemNum) % PROP_POOL.length];
  }
  if (typeof heroInst.setProp === 'function') {
    prop = heroInst.setProp(prop);
  }

  let clip = 'idle';
  if (shotKind.includes('glide') || shotKind.includes('flight') || shotKind.includes('gate')) {
    clip = 'wing-glide';
  } else if (shotKind.includes('walk') || shotKind.includes('corridor') || shotKind.includes('street')) {
    clip = (prop === 'jerikan' || prop === 'parcel' || prop === 'lantern') ? 'carry' : 'walk';
  } else if (shotKind.includes('carry') || shotKind.includes('handoff')) {
    clip = 'carry';
  } else if (shotKind.includes('greet') || shotKind.includes('threshold')) {
    clip = 'greet';
  } else if (shotKind.includes('dance') || shotKind.includes('party')) {
    clip = 'dance';
  } else if (shotKind.includes('talk') || shotKind.includes('duet')) {
    clip = 'idle-talking';
  } else {
    const IDLE_POOL = ['idle', 'walk', 'carry', 'greet', 'listen', 'fold-arms'];
    clip = IDLE_POOL[(gen + poemNum) % IDLE_POOL.length];
  }
  if (typeof heroInst.playAction === 'function') {
    clip = heroInst.playAction(clip, 0.26);
  }

  if (opts.lookTargetVec3 && typeof heroInst.setLookTarget === 'function') {
    heroInst.setLookTarget(opts.lookTargetVec3);
  }

  return {
    generation: gen,
    poem: String(poemNum).padStart(2, '0'),
    jacketHex,
    trimHex,
    cuffHex,
    contrastMode,
    glasses,
    prop,
    wingsMode,
    clip,
  };
}
