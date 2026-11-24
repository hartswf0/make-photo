/**
 * cutout-31-rig.js — True-Scale 1.72m 31-Part Brass-Pivot Cutout Hero & Ensemble Rig
 *
 * Pure ES Module safe for import from `/city/` OR `/city/<subpage>/` with zero 404s.
 * Uses verified local `./assets/poet_tracksuit_31/`, `./assets/arena_actors/`, and `./assets/wings/` PNGs.
 *
 * Exports:
 *  - createArticulated31CutoutRig({ THREE, variant, showBrassPivots, wingsMode, glasses, prop, height, groundY, seed })
 *  - evolveCutoutPhenotype(cutoutInst, { poem, shotKind, seed, generation, bgLuminance, lookTargetVec3 })
 *  - CUTOUT_VARIANTS
 *  - VERSION
 */

export const VERSION = '9.1.0-cutout31';

const HERO_ASSETS_URL = new URL('./assets', import.meta.url).href.replace(/\/$/, '');

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

function seededHash(seedVal, salt = 0) {
  let h = (Math.imul(Math.floor(Number(seedVal) || 0) + 1, 2654435761) ^ Math.imul(salt + 17, 2246822519)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const _texCache = new Map();
function loadCutoutTex(THREE, relPath) {
  const url = `${HERO_ASSETS_URL}/${relPath}`;
  if (_texCache.has(url)) return _texCache.get(url);
  const loader = new THREE.TextureLoader();
  const tex = loader.load(url);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  _texCache.set(url, tex);
  return tex;
}

// ---------------------------------------------------------------------------
// Canonical 31-Part Poet Tracksuit Geometry & Exact Solved Stage Scales
// Total standing span = 565.2 stagePx -> 1.720 m (METERS_PER_STAGE_PX = 0.00304317)
// ---------------------------------------------------------------------------
const BASE_METERS_PER_STAGE_PX = 1.72 / 565.2;

const TRACKSUIT_31_PARTS = Object.freeze({
  torso_front: { file: 'poet_tracksuit_31/01_torso_front.png', w: 1278, h: 1230, s: 0.17121, pivots: { neck: [639.0, 108.0], shoulder_R: [300.4, 212.4], shoulder_L: [979.8, 212.1], waist: [639.4, 1048.4] } },
  torso_back: { file: 'poet_tracksuit_31/02_torso_back.png', w: 1305, h: 1206, s: 0.16574, pivots: { waist: [651.4, 1087.8] } },
  waist_link: { file: 'poet_tracksuit_31/03_waist_link.png', w: 1299, h: 1211, s: 0.08237, pivots: { top: [647.4, 339.2], bottom: [646.3, 895.1] } },
  hip_bridge: { file: 'poet_tracksuit_31/04_hip_bridge.png', w: 1536, h: 1024, s: 0.096, pivots: { waist: [759.6, 192.2], hip_R: [420.0, 791.2], hip_L: [1110.0, 791.3] } },
  rear_seat_cover: { file: 'poet_tracksuit_31/05_rear_seat_cover.png', w: 1457, h: 1080, s: 0.114, pivots: { waist: [726.8, 161.5] } },
  pelvis_front_cover: { file: 'poet_tracksuit_31/06_pelvis_front_cover.png', w: 1455, h: 1081, s: 0.118, pivots: { waist: [727.3, 180.5] } },
  upper_arm_L: { file: 'poet_tracksuit_31/07_upper_arm_L.png', w: 1024, h: 1536, s: 0.068, pivots: { shoulder: [507.7, 166.4], elbow: [493.6, 1362.5] } },
  forearm_L: { file: 'poet_tracksuit_31/08_forearm_L.png', w: 1024, h: 1536, s: 0.065, pivots: { elbow: [512.0, 180.0], wrist: [510.5, 1320.6] } },
  upper_arm_R: { file: 'poet_tracksuit_31/09_upper_arm_R.png', w: 1024, h: 1536, s: 0.066, pivots: { shoulder: [504.0, 138.5], elbow: [534.0, 1387.1] } },
  forearm_R: { file: 'poet_tracksuit_31/10_forearm_R.png', w: 1024, h: 1536, s: 0.063, pivots: { elbow: [513.8, 176.3], wrist: [510.7, 1375.5] } },
  thigh_L: { file: 'poet_tracksuit_31/11_thigh_L.png', w: 1024, h: 1536, s: 0.089, pivots: { hip: [511.0, 180.1], knee: [509.8, 1344.4] } },
  shin_L: { file: 'poet_tracksuit_31/12_shin_L.png', w: 1024, h: 1536, s: 0.081, pivots: { knee: [511.1, 198.3], ankle: [512.3, 1387.6] } },
  thigh_R: { file: 'poet_tracksuit_31/13_thigh_R.png', w: 1024, h: 1536, s: 0.089, pivots: { hip: [511.8, 192.2], knee: [514.4, 1342.4] } },
  shin_R: { file: 'poet_tracksuit_31/14_shin_R.png', w: 1024, h: 1536, s: 0.080, pivots: { knee: [507.4, 176.0], ankle: [519.9, 1392.9] } },
  hand_relaxed_L: { file: 'poet_tracksuit_31/15_hand_relaxed_L.png', w: 1271, h: 1237, s: 0.043, pivots: { wrist: [660.8, 190.1] }, rotZ: 0 },
  hand_relaxed_R: { file: 'poet_tracksuit_31/16_hand_relaxed_R.png', w: 1299, h: 1211, s: 0.048, pivots: { wrist: [646.0, 255.5] }, rotZ: 0 },
  hand_open_L: { file: 'poet_tracksuit_31/17_hand_open_L.png', w: 1281, h: 1228, s: 0.042, pivots: { wrist: [697.2, 1087.0] }, rotZ: Math.PI },
  hand_open_R: { file: 'poet_tracksuit_31/18_hand_open_R.png', w: 1287, h: 1222, s: 0.042, pivots: { wrist: [672.0, 1072.0] }, rotZ: Math.PI },
  boot_front_L: { file: 'poet_tracksuit_31/19_boot_front_L.png', w: 1278, h: 1230, s: 0.048, pivots: { ankle: [625.0, 315.0], sole: [625.0, 1183.0] } },
  boot_front_R: { file: 'poet_tracksuit_31/20_boot_front_R.png', w: 1263, h: 1245, s: 0.049, pivots: { ankle: [635.0, 315.0], sole: [635.0, 1181.0] } },
  head_front_blank: { file: 'poet_tracksuit_31/21_head_front_blank.png', w: 1155, h: 1362, s: 0.09718, pivots: { neck: [558.0, 1159.0], brows: [570.0, 525.0], eyes: [570.0, 608.0], sunglasses: [570.0, 606.0], nose: [570.0, 700.0], mouth: [570.0, 848.0] } },
  eyes_open: { file: 'poet_tracksuit_31/22_eyes_open.png', w: 2172, h: 724, s: 0.02383, pivots: { center: [1086.0, 378.0] } },
  eyes_closed: { file: 'poet_tracksuit_31/23_eyes_closed.png', w: 2172, h: 724, s: 0.02347, pivots: { center: [1082.0, 372.5] } },
  brows_rest: { file: 'poet_tracksuit_31/24_brows_rest.png', w: 2170, h: 725, s: 0.02038, pivots: { center: [1085.0, 375.0] } },
  brows_raised: { file: 'poet_tracksuit_31/25_brows_raised.png', w: 2172, h: 724, s: 0.02072, pivots: { center: [1087.5, 365.5] } },
  nose_front: { file: 'poet_tracksuit_31/26_nose_front.png', w: 1536, h: 1024, s: 0.04074, pivots: { center: [767.0, 510.5] } },
  mouth_rest: { file: 'poet_tracksuit_31/27_mouth_rest.png', w: 1774, h: 887, s: 0.02947, pivots: { center: [887.5, 444.0] } },
  mouth_smile: { file: 'poet_tracksuit_31/28_mouth_smile.png', w: 1942, h: 809, s: 0.03447, pivots: { center: [970.5, 408.5] } },
  mouth_open_O: { file: 'poet_tracksuit_31/29_mouth_open_O.png', w: 1678, h: 937, s: 0.03082, pivots: { center: [838.0, 478.5] } },
  mouth_open_A: { file: 'poet_tracksuit_31/30_mouth_open_A.png', w: 1672, h: 941, s: 0.03617, pivots: { center: [835.5, 489.0] } },
  sunglasses_front: { file: 'poet_tracksuit_31/31_sunglasses_front.png', w: 2172, h: 724, s: 0.02534, pivots: { center: [1087.5, 360.0], temple_R: [163.4, 280.9], temple_L: [2011.5, 280.9] } },
});

export const CUTOUT_VARIANTS = Object.freeze({
  poet_tracksuit_31: { id: 'poet_tracksuit_31', kind: 'tracksuit31', defaultHeight: 1.72 },
  poet_black_tshirt: { id: 'poet_black_tshirt', dir: 'poet.black_tshirt', view: 'front', hasPelvis: true, hasThigh: true, defaultHeight: 1.72 },
  poet_red_black: { id: 'poet_red_black', dir: 'poet.red_black_sunglasses', view: 'front', hasPelvis: true, hasThigh: true, defaultHeight: 1.72 },
  ancestor_robe: { id: 'ancestor_robe', dir: 'ancestors.ancestor_robe_indigo_gold', view: 'front', hasPelvis: true, hasThigh: true, defaultHeight: 1.70 },
  angel_white_robe: { id: 'angel_white_robe', dir: 'angels.angel_white_robe', view: 'front', hasPelvis: true, hasThigh: false, defaultHeight: 1.74 },
  atlantis_gatekeeper: { id: 'atlantis_gatekeeper', dir: 'atlantis.atlantis_gatekeeper', view: 'front', hasPelvis: false, hasThigh: true, defaultHeight: 1.76 },
  ex_jacket: { id: 'ex_jacket', dir: 'ex.ex_jacket', view: 'back', hasPelvis: true, hasThigh: true, defaultHeight: 1.75 },
  dj_cyber: { id: 'dj_cyber', dir: 'party.dj_cyber', view: 'front', hasPelvis: true, hasThigh: true, defaultHeight: 1.72 },
  vintage_party: { id: 'vintage_party', dir: 'party.vintage_party', view: 'front', hasPelvis: true, hasThigh: true, defaultHeight: 1.68 },
  woman_teal_dress: { id: 'woman_teal_dress', dir: 'woman.teal_dress', view: 'front', hasPelvis: true, hasThigh: true, defaultHeight: 1.64 },
  young_poet: { id: 'young_poet', dir: 'young_poet.child_clothes', view: 'front', hasPelvis: true, hasThigh: true, defaultHeight: 1.24 },
});

const VARIANT_ALIASES = Object.freeze({
  hero: 'poet_tracksuit_31',
  poet: 'poet_tracksuit_31',
  tracksuit: 'poet_tracksuit_31',
  tshirt: 'poet_black_tshirt',
  ancestor: 'ancestor_robe',
  angel: 'angel_white_robe',
  gatekeeper: 'atlantis_gatekeeper',
  ex: 'ex_jacket',
  dj: 'dj_cyber',
  party: 'vintage_party',
  woman: 'woman_teal_dress',
  muse: 'woman_teal_dress',
  child: 'young_poet',
  june: 'young_poet',
});

function sampleCutoutMouthKey(text, progress01) {
  const s = String(text || '').trim().toLowerCase();
  if (!s) return 'rest';
  const p = clamp(Number(progress01) || 0, 0, 0.9999);
  const idx = Math.min(s.length - 1, Math.floor(p * s.length));
  const ch = s[idx];
  if (ch === ' ' || ch === '.' || ch === ',' || ch === '-' || ch === ';' || ch === 'm' || ch === 'b' || ch === 'p') return 'rest';
  if (ch === 'o' || ch === 'u' || ch === 'w' || ch === 'q') return 'O';
  if (ch === 'e' || ch === 'i' || ch === 'y' || ch === 's' || ch === 'z') return 'smile';
  return 'A';
}

// ---------------------------------------------------------------------------
// Cohesive Overlapping P06-S01 Wings (Zero Gaps, Zero Poking Spars!)
// ---------------------------------------------------------------------------
function buildCutoutWings(THREE, mScale, disposables) {
  const wingsRoot = new THREE.Group();
  wingsRoot.name = 'cutout31_p06_wings';
  wingsRoot.visible = false;

  const angelInnerTex = loadCutoutTex(THREE, 'wings/08.cast.angel.wings__p07.png');
  const angelOuterTex = loadCutoutTex(THREE, 'wings/08.cast.angel.wings__p08.png');
  const ravenInnerTex = loadCutoutTex(THREE, 'wings/04.props.ravens-stumps__p03.png');
  const ravenOuterTex = loadCutoutTex(THREE, 'wings/04.props.ravens-stumps__p05.png');

  const makeMat = (tex) => new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.06,
    roughness: 0.68,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  const angelInnerMat = makeMat(angelInnerTex);
  const angelOuterMat = makeMat(angelOuterTex);
  const ravenInnerMat = makeMat(ravenInnerTex);
  const ravenOuterMat = makeMat(ravenOuterTex);
  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.34, metalness: 0.05, side: THREE.DoubleSide });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xdfb25e, roughness: 0.24, metalness: 0.86 });
  disposables.push(angelInnerMat, angelOuterMat, ravenInnerMat, ravenOuterMat, marbleMat, brassMat);

  const innerGeo = new THREE.PlaneGeometry(0.54 * mScale, 0.40 * mScale);
  const outerGeo = new THREE.PlaneGeometry(0.52 * mScale, 0.38 * mScale);
  const tipGeo = new THREE.PlaneGeometry(0.42 * mScale, 0.30 * mScale);
  const slatGeo = new THREE.BoxGeometry(0.32 * mScale, 0.078 * mScale, 0.012 * mScale);
  const trimGeo = new THREE.BoxGeometry(0.30 * mScale, 0.011 * mScale, 0.014 * mScale);
  disposables.push(innerGeo, outerGeo, tipGeo, slatGeo, trimGeo);

  const sides = [];
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(sx * 0.08 * mScale, 0.14 * mScale, -0.025);
    wingsRoot.add(shoulderPivot);

    const innerCard = new THREE.Mesh(innerGeo, angelInnerMat);
    innerCard.position.set(sx * 0.22 * mScale, 0.04 * mScale, -0.004);
    if (sx < 0) innerCard.scale.x = -1;
    shoulderPivot.add(innerCard);

    const marbleInner = new THREE.Group();
    for (let f = 0; f < 5; f++) {
      const frac = f / 4;
      const slat = new THREE.Mesh(slatGeo, marbleMat);
      slat.position.set(sx * (0.15 + frac * 0.035) * mScale, (0.10 - frac * 0.06) * mScale, -0.003 * f);
      slat.rotation.z = sx * (0.24 - frac * 0.22);
      slat.scale.set(0.88 + (1 - frac) * 0.20, 1.0, 1.0);
      marbleInner.add(slat);
    }
    const g1 = new THREE.Mesh(trimGeo, brassMat);
    g1.position.set(sx * 0.16 * mScale, 0.135 * mScale, 0.002);
    g1.rotation.z = sx * 0.26;
    marbleInner.add(g1);
    shoulderPivot.add(marbleInner);

    // Mid-span overlaps cleanly at 0.28m (zero floating winglet!)
    const midSpanPivot = new THREE.Group();
    midSpanPivot.position.set(sx * 0.28 * mScale, 0.07 * mScale, -0.005);
    shoulderPivot.add(midSpanPivot);

    const outerCard = new THREE.Mesh(outerGeo, angelOuterMat);
    outerCard.position.set(sx * 0.20 * mScale, 0.02 * mScale, -0.004);
    if (sx < 0) outerCard.scale.x = -1;
    midSpanPivot.add(outerCard);

    const marbleOuter = new THREE.Group();
    for (let f = 0; f < 5; f++) {
      const frac = f / 4;
      const slat = new THREE.Mesh(slatGeo, marbleMat);
      slat.position.set(sx * (0.15 + frac * 0.03) * mScale, (0.07 - frac * 0.058) * mScale, -0.003 * f);
      slat.rotation.z = sx * (0.12 - frac * 0.24);
      slat.scale.set(0.94 - frac * 0.12, 0.90, 1.0);
      marbleOuter.add(slat);
    }
    midSpanPivot.add(marbleOuter);

    const tipPivot = new THREE.Group();
    tipPivot.position.set(sx * 0.25 * mScale, 0.02 * mScale, -0.005);
    midSpanPivot.add(tipPivot);

    const tipCard = new THREE.Mesh(tipGeo, angelOuterMat);
    tipCard.position.set(sx * 0.15 * mScale, -0.01 * mScale, -0.004);
    if (sx < 0) tipCard.scale.x = -1;
    tipPivot.add(tipCard);

    const marbleTip = new THREE.Group();
    for (let f = 0; f < 4; f++) {
      const frac = f / 3;
      const slat = new THREE.Mesh(slatGeo, f === 0 ? brassMat : marbleMat);
      slat.position.set(sx * (0.13 - frac * 0.02) * mScale, (0.03 - frac * 0.05) * mScale, -0.002 * f);
      slat.rotation.z = sx * (0.02 - frac * 0.26);
      slat.scale.set(0.82 - frac * 0.20, 0.78, 0.9);
      marbleTip.add(slat);
    }
    tipPivot.add(marbleTip);

    sides.push({
      side,
      sx,
      shoulderPivot,
      midSpanPivot,
      tipPivot,
      innerCard,
      outerCard,
      tipCard,
      marbleGroups: [marbleInner, marbleOuter, marbleTip],
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
      s.marbleGroups[0].visible = isMarble;
      s.marbleGroups[1].visible = isMarble;
      s.marbleGroups[2].visible = isMarble;
    }
    return isMarble ? (m === 'folded' ? 'folded' : 'marble') : (isRaven ? 'raven' : 'angel');
  }

  return { wingsRoot, sides, applyMode };
}

function buildCutoutProps(THREE, wristPivotR, torsoPivot, mScale, disposables) {
  const handMount = new THREE.Group();
  handMount.position.set(0, -0.05 * mScale, 0.024);
  if (wristPivotR) wristPivotR.add(handMount);

  const chestMount = new THREE.Group();
  chestMount.position.set(0, 0.18 * mScale, 0.030);
  if (torsoPivot) torsoPivot.add(chestMount);

  const brassMat = new THREE.MeshStandardMaterial({ color: 0xe2b662, roughness: 0.24, metalness: 0.88 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c2c18, roughness: 0.50, metalness: 0.08 });
  const cyanMat = new THREE.MeshStandardMaterial({ color: 0x18b4ff, roughness: 0.34, metalness: 0.12 });
  const kraftMat = new THREE.MeshStandardMaterial({ color: 0xc8a472, roughness: 0.86, metalness: 0.02 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffe09a, emissive: 0xffa630, emissiveIntensity: 1.3, roughness: 0.2 });
  disposables.push(brassMat, woodMat, cyanMat, kraftMat, glowMat);

  const camGroup = new THREE.Group();
  camGroup.visible = false;
  const camBoxGeo = new THREE.BoxGeometry(0.15 * mScale, 0.13 * mScale, 0.075 * mScale);
  const camLensGeo = new THREE.CylinderGeometry(0.028 * mScale, 0.032 * mScale, 0.045 * mScale, 14);
  disposables.push(camBoxGeo, camLensGeo);
  camGroup.add(new THREE.Mesh(camBoxGeo, woodMat));
  const lens = new THREE.Mesh(camLensGeo, brassMat);
  lens.rotation.x = Math.PI * 0.5;
  lens.position.set(0, 0, 0.055 * mScale);
  camGroup.add(lens);
  chestMount.add(camGroup);

  const jerikanGroup = new THREE.Group();
  jerikanGroup.visible = false;
  const canGeo = new THREE.BoxGeometry(0.14 * mScale, 0.22 * mScale, 0.09 * mScale);
  disposables.push(canGeo);
  const canMesh = new THREE.Mesh(canGeo, cyanMat);
  canMesh.position.set(0, -0.12 * mScale, 0);
  jerikanGroup.add(canMesh);
  handMount.add(jerikanGroup);

  const parcelGroup = new THREE.Group();
  parcelGroup.visible = false;
  const pGeo = new THREE.BoxGeometry(0.19 * mScale, 0.12 * mScale, 0.12 * mScale);
  disposables.push(pGeo);
  const pMesh = new THREE.Mesh(pGeo, kraftMat);
  pMesh.position.set(0, -0.065 * mScale, 0);
  parcelGroup.add(pMesh);
  handMount.add(parcelGroup);

  const lanternGroup = new THREE.Group();
  lanternGroup.visible = false;
  const lCoreGeo = new THREE.CylinderGeometry(0.038 * mScale, 0.038 * mScale, 0.10 * mScale, 12);
  const lCapGeo = new THREE.ConeGeometry(0.058 * mScale, 0.048 * mScale, 10);
  disposables.push(lCoreGeo, lCapGeo);
  const lCap = new THREE.Mesh(lCapGeo, brassMat);
  lCap.position.set(0, -0.048 * mScale, 0);
  lanternGroup.add(lCap);
  const lCore = new THREE.Mesh(lCoreGeo, glowMat);
  lCore.position.set(0, -0.115 * mScale, 0);
  lanternGroup.add(lCore);
  handMount.add(lanternGroup);

  return {
    groups: {
      camera: camGroup,
      jerikan: jerikanGroup,
      parcel: parcelGroup,
      lantern: lanternGroup,
    },
  };
}

// ---------------------------------------------------------------------------
// Main Factory: `createArticulated31CutoutRig`
// ---------------------------------------------------------------------------
export function createArticulated31CutoutRig(opts = {}) {
  const THREE = opts.THREE || (typeof window !== 'undefined' ? window.THREE : null);
  if (!THREE) throw new Error('createArticulated31CutoutRig requires opts.THREE');

  const rawVar = String(opts.variant || 'poet_tracksuit_31').trim().toLowerCase();
  const varKey = CUTOUT_VARIANTS[rawVar] ? rawVar : (VARIANT_ALIASES[rawVar] || 'poet_tracksuit_31');
  const vInfo = CUTOUT_VARIANTS[varKey];
  const targetHeight = Number(opts.height) || vInfo.defaultHeight || 1.72;
  const mScale = targetHeight / 1.72;
  const mPerStagePx = BASE_METERS_PER_STAGE_PX * mScale;
  const seed = Number(opts.seed) || 0;

  const root = new THREE.Group();
  root.name = `cutout31_rig_${varKey}`;
  const bodyRoot = new THREE.Group();
  bodyRoot.name = 'cutout31_body_pelvis_root';
  root.add(bodyRoot);

  const disposables = [];
  const cardMaterials = [];
  const brassPins = [];

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xe6ba64,
    roughness: 0.24,
    metalness: 0.88,
  });
  const brassWasherMat = new THREE.MeshStandardMaterial({
    color: 0x8f682b,
    roughness: 0.38,
    metalness: 0.80,
  });
  disposables.push(brassMat, brassWasherMat);

  // Refined tailored brass rivets (0.0085m radius)
  const pinCapGeo = new THREE.CylinderGeometry(0.0085 * mScale, 0.0085 * mScale, 0.010 * mScale, 14);
  const pinWasherGeo = new THREE.TorusGeometry(0.0102 * mScale, 0.0020 * mScale, 6, 14);
  disposables.push(pinCapGeo, pinWasherGeo);

  function addBrassPin(parentJoint, zOffset = 0.010, radiusScale = 1.0) {
    const pinGroup = new THREE.Group();
    pinGroup.position.set(0, 0, zOffset);
    pinGroup.scale.setScalar(radiusScale);

    const cap = new THREE.Mesh(pinCapGeo, brassMat);
    cap.rotation.x = Math.PI * 0.5;
    pinGroup.add(cap);

    const washer = new THREE.Mesh(pinWasherGeo, brassWasherMat);
    washer.position.set(0, 0, 0.003 * mScale);
    pinGroup.add(washer);

    parentJoint.add(pinGroup);
    brassPins.push(pinGroup);
    return pinGroup;
  }

  function makePartCard(relFile, wMeters, hMeters, anchorDx, anchorDy, zOffset = 0, rotZ = 0) {
    const tex = loadCutoutTex(THREE, relFile);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.06,
      roughness: 0.72,
      metalness: 0.03,
      side: THREE.DoubleSide,
    });
    const geo = new THREE.PlaneGeometry(wMeters, hMeters);
    disposables.push(geo, mat);
    cardMaterials.push(mat);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (rotZ !== 0) {
      mesh.rotation.z = rotZ;
      const cosR = Math.cos(rotZ);
      const sinR = Math.sin(rotZ);
      mesh.position.set(
        -(anchorDx * cosR - anchorDy * sinR),
        -(anchorDx * sinR + anchorDy * cosR),
        zOffset
      );
    } else {
      mesh.position.set(-anchorDx, -anchorDy, zOffset);
    }
    return mesh;
  }

  function specMetrics(partKey) {
    const p = TRACKSUIT_31_PARTS[partKey];
    const mpp = p.s * mPerStagePx;
    const wM = p.w * mpp;
    const hM = p.h * mpp;
    const pt = (pivName) => {
      const xy = p.pivots[pivName] || [p.w * 0.5, p.h * 0.5];
      return [(xy[0] - p.w * 0.5) * mpp, (p.h * 0.5 - xy[1]) * mpp];
    };
    const delta = (fromPiv, toPiv) => {
      const a = pt(fromPiv);
      const b = pt(toPiv);
      return [b[0] - a[0], b[1] - a[1]];
    };
    return { p, wM, hM, pt, delta };
  }

  const joints = {
    pelvis: bodyRoot,
    waist: new THREE.Group(),
    torso: new THREE.Group(),
    neck: new THREE.Group(),
    shoulderL: new THREE.Group(),
    elbowL: new THREE.Group(),
    wristL: new THREE.Group(),
    shoulderR: new THREE.Group(),
    elbowR: new THREE.Group(),
    wristR: new THREE.Group(),
    hipL: new THREE.Group(),
    kneeL: new THREE.Group(),
    ankleL: new THREE.Group(),
    soleL: new THREE.Group(),
    hipR: new THREE.Group(),
    kneeR: new THREE.Group(),
    ankleR: new THREE.Group(),
    soleR: new THREE.Group(),
  };

  let faceSwaps = null;
  let handSwaps = null;
  let sunglassesHinge = null;
  let trimOverlayMat = null;

  if (vInfo.kind === 'tracksuit31') {
    const hipM = specMetrics('hip_bridge');
    const [hipWaistX, hipWaistY] = hipM.pt('waist');
    const [dHipRX, dHipRY] = hipM.delta('waist', 'hip_R');
    const [dHipLX, dHipLY] = hipM.delta('waist', 'hip_L');

    bodyRoot.add(makePartCard(hipM.p.file, hipM.wM, hipM.hM, hipWaistX, hipWaistY, 0.0));

    const rearM = specMetrics('rear_seat_cover');
    const [rWX, rWY] = rearM.pt('waist');
    bodyRoot.add(makePartCard(rearM.p.file, rearM.wM, rearM.hM, rWX, rWY, -0.014));

    const pelvFrontM = specMetrics('pelvis_front_cover');
    const [pfWX, pfWY] = pelvFrontM.pt('waist');
    bodyRoot.add(makePartCard(pelvFrontM.p.file, pelvFrontM.wM, pelvFrontM.hM, pfWX, pfWY, 0.004));

    const wLinkM = specMetrics('waist_link');
    const [wlBX, wlBY] = wLinkM.pt('bottom');
    bodyRoot.add(makePartCard(wLinkM.p.file, wLinkM.wM, wLinkM.hM, wlBX, wlBY, -0.002));

    // Waist -> Torso
    joints.waist.position.set(0, 0.02 * mScale, 0);
    bodyRoot.add(joints.waist);
    joints.waist.add(joints.torso);
    addBrassPin(joints.waist, 0.013, 1.05);

    const torsoBackM = specMetrics('torso_back');
    const [tbWX, tbWY] = torsoBackM.pt('waist');
    joints.torso.add(makePartCard(torsoBackM.p.file, torsoBackM.wM, torsoBackM.hM, tbWX, tbWY, -0.018));

    const torsoM = specMetrics('torso_front');
    const [tfWX, tfWY] = torsoM.pt('waist');
    joints.torso.add(makePartCard(torsoM.p.file, torsoM.wM, torsoM.hM, tfWX, tfWY, 0.008));

    trimOverlayMat = new THREE.MeshStandardMaterial({ color: 0xd63c34, roughness: 0.4, metalness: 0.25 });
    const collarPipGeo = new THREE.TorusGeometry(0.052 * mScale, 0.0032 * mScale, 6, 18, Math.PI);
    disposables.push(trimOverlayMat, collarPipGeo);
    const [dNeckX, dNeckY] = torsoM.delta('waist', 'neck');
    const collarPip = new THREE.Mesh(collarPipGeo, trimOverlayMat);
    collarPip.position.set(dNeckX, dNeckY + 0.012 * mScale, 0.011);
    collarPip.rotation.z = Math.PI;
    joints.torso.add(collarPip);

    // Neck -> Head + Modular Face Swaps
    joints.neck.position.set(dNeckX, dNeckY, 0.012);
    joints.torso.add(joints.neck);
    addBrassPin(joints.neck, 0.012, 0.90);

    const headM = specMetrics('head_front_blank');
    const [hNX, hNY] = headM.pt('neck');
    joints.neck.add(makePartCard(headM.p.file, headM.wM, headM.hM, hNX, hNY, 0.0));

    const [dEyeX, dEyeY] = headM.delta('neck', 'eyes');
    const [dBrowX, dBrowY] = headM.delta('neck', 'brows');
    const [dNoseX, dNoseY] = headM.delta('neck', 'nose');
    const [dMouthX, dMouthY] = headM.delta('neck', 'mouth');
    const [dSunX, dSunY] = headM.delta('neck', 'sunglasses');

    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(dEyeX, dEyeY, 0.004);
    joints.neck.add(eyeGroup);
    const eoM = specMetrics('eyes_open');
    const ecM = specMetrics('eyes_closed');
    const eyesOpenMesh = makePartCard(eoM.p.file, eoM.wM, eoM.hM, ...eoM.pt('center'), 0);
    const eyesClosedMesh = makePartCard(ecM.p.file, ecM.wM, ecM.hM, ...ecM.pt('center'), 0);
    eyesClosedMesh.visible = false;
    eyeGroup.add(eyesOpenMesh, eyesClosedMesh);

    const browGroup = new THREE.Group();
    browGroup.position.set(dBrowX, dBrowY, 0.005);
    joints.neck.add(browGroup);
    const brM = specMetrics('brows_rest');
    const buM = specMetrics('brows_raised');
    const browsRestMesh = makePartCard(brM.p.file, brM.wM, brM.hM, ...brM.pt('center'), 0);
    const browsRaisedMesh = makePartCard(buM.p.file, buM.wM, buM.hM, ...buM.pt('center'), 0);
    browsRaisedMesh.visible = false;
    browGroup.add(browsRestMesh, browsRaisedMesh);

    const noseM = specMetrics('nose_front');
    const noseMesh = makePartCard(noseM.p.file, noseM.wM, noseM.hM, ...noseM.pt('center'), 0.006);
    noseMesh.position.x += dNoseX;
    noseMesh.position.y += dNoseY;
    joints.neck.add(noseMesh);

    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(dMouthX, dMouthY, 0.005);
    joints.neck.add(mouthGroup);
    const mRestM = specMetrics('mouth_rest');
    const mSmileM = specMetrics('mouth_smile');
    const mOM = specMetrics('mouth_open_O');
    const mAM = specMetrics('mouth_open_A');
    const mouths = {
      rest: makePartCard(mRestM.p.file, mRestM.wM, mRestM.hM, ...mRestM.pt('center'), 0),
      smile: makePartCard(mSmileM.p.file, mSmileM.wM, mSmileM.hM, ...mSmileM.pt('center'), 0),
      O: makePartCard(mOM.p.file, mOM.wM, mOM.hM, ...mOM.pt('center'), 0),
      A: makePartCard(mAM.p.file, mAM.wM, mAM.hM, ...mAM.pt('center'), 0),
    };
    mouths.smile.visible = false;
    mouths.O.visible = false;
    mouths.A.visible = false;
    mouthGroup.add(mouths.rest, mouths.smile, mouths.O, mouths.A);

    sunglassesHinge = new THREE.Group();
    sunglassesHinge.position.set(dSunX, dSunY, 0.009);
    joints.neck.add(sunglassesHinge);
    const sunM = specMetrics('sunglasses_front');
    const sunMesh = makePartCard(sunM.p.file, sunM.wM, sunM.hM, ...sunM.pt('center'), 0);
    sunglassesHinge.add(sunMesh);
    const [dTRx, dTRy] = sunM.delta('center', 'temple_R');
    const [dTLx, dTLy] = sunM.delta('center', 'temple_L');
    const studR = new THREE.Group(); studR.position.set(dTRx, dTRy, 0.002); sunglassesHinge.add(studR);
    const studL = new THREE.Group(); studL.position.set(dTLx, dTLy, 0.002); sunglassesHinge.add(studL);
    addBrassPin(studR, 0.002, 0.45);
    addBrassPin(studL, 0.002, 0.45);

    faceSwaps = { eyeGroup, eyesOpenMesh, eyesClosedMesh, browGroup, browsRestMesh, browsRaisedMesh, mouths };

    // BOTH Left & Right Arms layered cleanly IN FRONT of torso_front (+0.008) & pelvis_front_cover (+0.004)
    // with Cuff-Tuck Z-Layering (forearm cuff over hand wrist!) so sleeves, cuffs, brass pins & hands read 100% clearly!
    const [dShLX, dShLY] = torsoM.delta('waist', 'shoulder_L');
    const [dShRX, dShRY] = torsoM.delta('waist', 'shoulder_R');

    joints.shoulderL.position.set(dShLX + 0.012 * mScale, dShLY, 0.016);
    joints.torso.add(joints.shoulderL);
    addBrassPin(joints.shoulderL, 0.010, 0.90);
    const uL = specMetrics('upper_arm_L');
    joints.shoulderL.add(makePartCard(uL.p.file, uL.wM, uL.hM, ...uL.pt('shoulder'), 0.0));

    const [dElbLX, dElbLY] = uL.delta('shoulder', 'elbow');
    joints.elbowL.position.set(dElbLX, dElbLY, 0.005); // +0.021 forearm over +0.016 upper_arm
    joints.shoulderL.add(joints.elbowL);
    addBrassPin(joints.elbowL, 0.008, 0.84);
    const fL = specMetrics('forearm_L');
    joints.elbowL.add(makePartCard(fL.p.file, fL.wM, fL.hM, ...fL.pt('elbow'), 0.0));

    const [dWrLX, dWrLY] = fL.delta('elbow', 'wrist');
    joints.wristL.position.set(dWrLX, dWrLY, -0.003); // +0.018 hand tucked under +0.021 forearm cuff (still > +0.008 torso!)
    joints.elbowL.add(joints.wristL);
    addBrassPin(joints.wristL, 0.009, 0.76);
    const hrL = specMetrics('hand_relaxed_L');
    const hoL = specMetrics('hand_open_L');
    const handRelL = makePartCard(hrL.p.file, hrL.wM, hrL.hM, ...hrL.pt('wrist'), 0, hrL.p.rotZ);
    const handOpenL = makePartCard(hoL.p.file, hoL.wM, hoL.hM, ...hoL.pt('wrist'), 0, hoL.p.rotZ);
    handOpenL.visible = false;
    joints.wristL.add(handRelL, handOpenL);

    // Right Arm also cleanly in front (+0.014 -> +0.019 forearm -> +0.016 hand tucked under cuff)
    joints.shoulderR.position.set(dShRX - 0.012 * mScale, dShRY, 0.014);
    joints.torso.add(joints.shoulderR);
    addBrassPin(joints.shoulderR, 0.010, 0.90);
    const uR = specMetrics('upper_arm_R');
    joints.shoulderR.add(makePartCard(uR.p.file, uR.wM, uR.hM, ...uR.pt('shoulder'), 0.0));

    const [dElbRX, dElbRY] = uR.delta('shoulder', 'elbow');
    joints.elbowR.position.set(dElbRX, dElbRY, 0.005); // +0.019 forearm over +0.014 upper_arm
    joints.shoulderR.add(joints.elbowR);
    addBrassPin(joints.elbowR, 0.008, 0.84);
    const fR = specMetrics('forearm_R');
    joints.elbowR.add(makePartCard(fR.p.file, fR.wM, fR.hM, ...fR.pt('elbow'), 0.0));

    const [dWrRX, dWrRY] = fR.delta('elbow', 'wrist');
    joints.wristR.position.set(dWrRX, dWrRY, -0.003); // +0.016 hand tucked under +0.019 forearm cuff!
    joints.elbowR.add(joints.wristR);
    addBrassPin(joints.wristR, 0.009, 0.76);
    const hrR = specMetrics('hand_relaxed_R');
    const hoR = specMetrics('hand_open_R');
    const handRelR = makePartCard(hrR.p.file, hrR.wM, hrR.hM, ...hrR.pt('wrist'), 0, hrR.p.rotZ);
    const handOpenR = makePartCard(hoR.p.file, hoR.wM, hoR.hM, ...hoR.pt('wrist'), 0, hoR.p.rotZ);
    handOpenR.visible = false;
    joints.wristR.add(handRelR, handOpenR);

    handSwaps = { handRelL, handOpenL, handRelR, handOpenR };

    // Left & Right Legs (shin trouser cuff over boot shaft!)
    joints.hipL.position.set(dHipLX, dHipLY, 0.006);
    bodyRoot.add(joints.hipL);
    addBrassPin(joints.hipL, 0.010, 0.92);
    const thL = specMetrics('thigh_L');
    joints.hipL.add(makePartCard(thL.p.file, thL.wM, thL.hM, ...thL.pt('hip'), 0));

    const [dKnLX, dKnLY] = thL.delta('hip', 'knee');
    joints.kneeL.position.set(dKnLX, dKnLY, 0.005);
    joints.hipL.add(joints.kneeL);
    addBrassPin(joints.kneeL, 0.009, 0.86);
    const shL = specMetrics('shin_L');
    joints.kneeL.add(makePartCard(shL.p.file, shL.wM, shL.hM, ...shL.pt('knee'), 0));

    const [dAnkLX, dAnkLY] = shL.delta('knee', 'ankle');
    joints.ankleL.position.set(dAnkLX, dAnkLY, -0.004);
    joints.kneeL.add(joints.ankleL);
    addBrassPin(joints.ankleL, 0.010, 0.78);
    const btL = specMetrics('boot_front_L');
    joints.ankleL.add(makePartCard(btL.p.file, btL.wM, btL.hM, ...btL.pt('ankle'), 0));
    const [dSoleLX, dSoleLY] = btL.delta('ankle', 'sole');
    joints.soleL.position.set(dSoleLX, dSoleLY, 0);
    joints.ankleL.add(joints.soleL);

    joints.hipR.position.set(dHipRX, dHipRY, 0.005);
    bodyRoot.add(joints.hipR);
    addBrassPin(joints.hipR, 0.010, 0.92);
    const thR = specMetrics('thigh_R');
    joints.hipR.add(makePartCard(thR.p.file, thR.wM, thR.hM, ...thR.pt('hip'), 0));

    const [dKnRX, dKnRY] = thR.delta('hip', 'knee');
    joints.kneeR.position.set(dKnRX, dKnRY, 0.005);
    joints.hipR.add(joints.kneeR);
    addBrassPin(joints.kneeR, 0.009, 0.86);
    const shR = specMetrics('shin_R');
    joints.kneeR.add(makePartCard(shR.p.file, shR.wM, shR.hM, ...shR.pt('knee'), 0));

    const [dAnkRX, dAnkRY] = shR.delta('knee', 'ankle');
    joints.ankleR.position.set(dAnkRX, dAnkRY, -0.004);
    joints.kneeR.add(joints.ankleR);
    addBrassPin(joints.ankleR, 0.010, 0.78);
    const btR = specMetrics('boot_front_R');
    joints.ankleR.add(makePartCard(btR.p.file, btR.wM, btR.hM, ...btR.pt('ankle'), 0));
    const [dSoleRX, dSoleRY] = btR.delta('ankle', 'sole');
    joints.soleR.position.set(dSoleRX, dSoleRY, 0);
    joints.ankleR.add(joints.soleR);
  } else {
    // -----------------------------------------------------------------------
    // 10 Verified Arena Ensemble Actors (ZERO mid-air gaps on robe/gatekeeper!)
    // -----------------------------------------------------------------------
    const dir = `arena_actors/${vInfo.dir}`;
    const vw = vInfo.view;
    const S = mScale;

    if (vInfo.hasPelvis) {
      // For `angel_white_robe` (`!hasThigh`), extend the robe skirt all the way down past knees!
      const pelvW = vInfo.hasThigh ? 0.34 * S : 0.42 * S;
      const pelvH = vInfo.hasThigh ? 0.24 * S : 0.56 * S;
      const pelvDy = vInfo.hasThigh ? 0.04 * S : 0.22 * S;
      bodyRoot.add(makePartCard(`${dir}/body.${vw}.pelvis.png`, pelvW, pelvH, 0, pelvDy, 0.002));
    } else {
      // `atlantis_gatekeeper` (`!hasPelvis`): sculpted pleated indigo-slate & brass tunic kilt bridging waist -> thighs!
      const kiltMat = new THREE.MeshStandardMaterial({ color: 0x1e283b, roughness: 0.68, metalness: 0.08, side: THREE.DoubleSide });
      const kiltGeo = new THREE.PlaneGeometry(0.35 * S, 0.28 * S);
      const sashGeo = new THREE.PlaneGeometry(0.36 * S, 0.036 * S);
      disposables.push(kiltMat, kiltGeo, sashGeo);
      const kilt = new THREE.Mesh(kiltGeo, kiltMat);
      kilt.position.set(0, -0.04 * S, 0.002);
      kilt.castShadow = true;
      bodyRoot.add(kilt);
      const sash = new THREE.Mesh(sashGeo, brassMat);
      sash.position.set(0, 0.07 * S, 0.005);
      bodyRoot.add(sash);
    }

    joints.waist.position.set(0, 0.05 * S, 0);
    bodyRoot.add(joints.waist);
    joints.waist.add(joints.torso);
    addBrassPin(joints.waist, 0.016, 0.95);

    const torsoH = vInfo.hasPelvis ? 0.50 * S : 0.56 * S;
    joints.torso.add(makePartCard(`${dir}/body.${vw}.torso.png`, 0.42 * S, torsoH, 0, -0.21 * S, 0.006));

    joints.neck.position.set(0, 0.44 * S, 0.012);
    joints.torso.add(joints.neck);
    addBrassPin(joints.neck, 0.010, 0.85);
    joints.neck.add(makePartCard(`${dir}/head.${vw}.png`, 0.25 * S, 0.34 * S, 0, -0.14 * S, 0));

    for (const [side, sx, shJ, elJ, wrJ, zBase] of [
      ['L', 1, joints.shoulderL, joints.elbowL, joints.wristL, 0.015],
      ['R', -1, joints.shoulderR, joints.elbowR, joints.wristR, 0.014],
    ]) {
      shJ.position.set(sx * 0.18 * S, 0.39 * S, zBase);
      joints.torso.add(shJ);
      addBrassPin(shJ, 0.009, 0.84);
      shJ.add(makePartCard(`${dir}/body.${vw}.uarm.${side}.png`, 0.14 * S, 0.28 * S, 0, 0.11 * S, 0));

      elJ.position.set(0, -0.23 * S, 0.004);
      shJ.add(elJ);
      addBrassPin(elJ, 0.008, 0.78);
      elJ.add(makePartCard(`${dir}/body.${vw}.farm.${side}.png`, 0.12 * S, 0.25 * S, 0, 0.10 * S, 0));

      wrJ.position.set(0, -0.21 * S, -0.003);
      elJ.add(wrJ);
      addBrassPin(wrJ, 0.008, 0.72);
      wrJ.add(makePartCard(`${dir}/body.${vw}.hand.${side}.png`, 0.10 * S, 0.14 * S, 0, 0.05 * S, 0));
    }

    const robeBridgeMat = !vInfo.hasThigh
      ? new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.72, metalness: 0.02, side: THREE.DoubleSide })
      : null;
    const robeBridgeGeo = !vInfo.hasThigh ? new THREE.PlaneGeometry(0.17 * S, 0.40 * S) : null;
    if (robeBridgeMat && robeBridgeGeo) disposables.push(robeBridgeMat, robeBridgeGeo);

    for (const [side, sx, hpJ, knJ, akJ, slJ, zBase] of [
      ['L', 1, joints.hipL, joints.kneeL, joints.ankleL, joints.soleL, 0.006],
      ['R', -1, joints.hipR, joints.kneeR, joints.ankleR, joints.soleR, 0.005],
    ]) {
      hpJ.position.set(sx * 0.095 * S, -0.06 * S, zBase);
      bodyRoot.add(hpJ);
      addBrassPin(hpJ, 0.009, 0.86);
      if (vInfo.hasThigh) {
        hpJ.add(makePartCard(`${dir}/body.${vw}.thigh.${side}.png`, 0.16 * S, 0.38 * S, 0, 0.16 * S, 0));
      } else if (robeBridgeGeo && robeBridgeMat) {
        const rb = new THREE.Mesh(robeBridgeGeo, robeBridgeMat);
        rb.position.set(0, -0.17 * S, -0.006);
        rb.castShadow = true;
        hpJ.add(rb);
      }

      knJ.position.set(0, -0.34 * S, 0.004);
      hpJ.add(knJ);
      addBrassPin(knJ, 0.008, 0.80);
      knJ.add(makePartCard(`${dir}/body.${vw}.shin.${side}.png`, 0.14 * S, 0.36 * S, 0, 0.15 * S, 0));

      akJ.position.set(0, -0.32 * S, -0.003);
      knJ.add(akJ);
      addBrassPin(akJ, 0.008, 0.74);
      akJ.add(makePartCard(`${dir}/body.${vw}.foot.${side}.png`, 0.16 * S, 0.12 * S, 0, 0.03 * S, 0));

      slJ.position.set(0, -0.08 * S, 0);
      akJ.add(slJ);
    }
  }

  const wingsRig = buildCutoutWings(THREE, mScale, disposables);
  wingsRig.wingsRoot.position.set(0, 0.24 * mScale, -0.024);
  joints.torso.add(wingsRig.wingsRoot);

  const propsRig = buildCutoutProps(THREE, joints.wristR, joints.torso, mScale, disposables);

  // State
  let showPivots = opts.showBrassPivots !== false;
  let glassesState = opts.glasses !== undefined ? opts.glasses : (vInfo.kind === 'tracksuit31');
  let propState = 'none';
  let wingsMode = 'off';
  let handPose = 'relaxed';
  let currentAction = String(opts.initialClip || 'idle').toLowerCase();
  let moveSpeedMps = 0;
  let wasAutoLocomoting = false;
  let groundY = Number(opts.groundY) || 0;
  let simTime = seededHash(seed, 5) * 10.0;
  let walkPhase = seededHash(seed, 9) * Math.PI * 2;
  let wingPhase = seededHash(seed, 13) * Math.PI * 2;
  let blinkTimer = 2.4 + seededHash(seed, 17) * 2.0;
  let blinkHold = 0;
  let explicitTalkText = '';
  let explicitTalkProg = 0;
  let expressionName = 'neutral';
  let defaultLookTarget = opts.lookTargetVec3 || null;
  let smoothGazeX = 0;
  let smoothGazeY = 0;
  let generation = 0;

  const _vA = new THREE.Vector3();
  const _vB = new THREE.Vector3();
  const _vFwd = new THREE.Vector3();
  const _vLeft = new THREE.Vector3();

  function setBrassPivots(flag) {
    showPivots = flag === 'toggle' ? !showPivots : !!flag;
    for (let i = 0; i < brassPins.length; i++) brassPins[i].visible = showPivots;
    return showPivots;
  }

  if (sunglassesHinge) sunglassesHinge.userData.baseY = sunglassesHinge.position.y;
  function setGlasses(val) {
    if (val === 'toggle') glassesState = !glassesState;
    else if (val === 'up') glassesState = 'up';
    else glassesState = !!(val && val !== 'off');

    if (sunglassesHinge) {
      sunglassesHinge.visible = glassesState !== false;
      sunglassesHinge.position.y = glassesState === 'up'
        ? sunglassesHinge.userData.baseY + 0.046 * mScale
        : sunglassesHinge.userData.baseY;
      sunglassesHinge.rotation.z = glassesState === 'up' ? -0.06 : 0;
    }
    return glassesState;
  }

  function setHandPose(pose) {
    handPose = pose === 'open' || pose === 'wave' ? 'open' : 'relaxed';
    if (handSwaps) {
      const isOpen = handPose === 'open';
      handSwaps.handRelL.visible = !isOpen;
      handSwaps.handOpenL.visible = isOpen;
      handSwaps.handRelR.visible = !isOpen;
      handSwaps.handOpenR.visible = isOpen;
    }
    return handPose;
  }

  function setProp(propName) {
    const k = String(propName || 'none').trim().toLowerCase();
    if (k === 'camera' || k === '8x10-camera' || k === '8x10') propState = 'camera';
    else if (k === 'jerikan' || k === 'cyan-jerikan' || k === 'cyan-can' || k === 'can') propState = 'jerikan';
    else if (k === 'parcel' || k === 'box') propState = 'parcel';
    else if (k === 'lantern' || k === 'brass-lantern') propState = 'lantern';
    else propState = 'none';

    for (const [key, grp] of Object.entries(propsRig.groups)) {
      grp.visible = key === propState;
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

  function playAction(clipName) {
    const raw = String(clipName || 'idle').trim().toLowerCase();
    currentAction = raw;
    wasAutoLocomoting = false;
    if (raw === 'greet' || raw === 'greeting' || raw === 'wave' || raw === 'victory' || raw === 'dance') {
      setHandPose('open');
    } else {
      setHandPose('relaxed');
    }
    return currentAction;
  }

  function setMoveSpeed(mps) {
    moveSpeedMps = Math.max(0, Number(mps) || 0);
    return moveSpeedMps;
  }

  function setGroundY(y) {
    groundY = Number(y) || 0;
  }

  function setLyricSpeech(text, progress01 = 0) {
    explicitTalkText = String(text || '');
    explicitTalkProg = Number(progress01) || 0;
  }

  function setExpression(name) {
    expressionName = String(name || 'neutral').toLowerCase();
    if (expressionName !== 'talking') explicitTalkText = '';
    return expressionName;
  }

  function pinSolesToGround() {
    root.updateMatrixWorld(true);
    joints.soleL.getWorldPosition(_vA);
    joints.soleR.getWorldPosition(_vB);
    const minY = Math.min(_vA.y, _vB.y);
    if (Number.isFinite(minY)) {
      bodyRoot.position.y += (groundY - minY);
      root.updateMatrixWorld(true);
    }
  }

  function update(dt, uOpts = {}) {
    const h = clamp(Number(dt) || 0.016, 0.001, 0.05);
    simTime += h;

    if (uOpts.moveSpeed !== undefined) {
      moveSpeedMps = Math.max(0, Number(uOpts.moveSpeed) || 0);
    }
    if (uOpts.autoLocomotion !== false && (uOpts.moveSpeed !== undefined || wasAutoLocomoting)) {
      if (moveSpeedMps > 3.8) { currentAction = 'sprint'; wasAutoLocomoting = true; }
      else if (moveSpeedMps > 1.9) { currentAction = 'jog'; wasAutoLocomoting = true; }
      else if (moveSpeedMps > 0.08) {
        currentAction = (propState === 'jerikan' || propState === 'parcel' || propState === 'lantern') ? 'carry' : 'walk';
        wasAutoLocomoting = true;
      } else if (wasAutoLocomoting) {
        currentAction = 'idle';
        wasAutoLocomoting = false;
      }
    }

    const act = currentAction;
    const isWalk = act.includes('walk') || act === 'relaxed' || act === 'carry';
    const isJog = act === 'jog';
    const isSprint = act === 'sprint' || act === 'run';
    const isGreet = act === 'greet' || act === 'greeting' || act === 'wave';
    const isPump = act === 'pump' || act === 'rope-pull' || act === 'water' || act === 'farm-watering';
    const isDance = act.includes('dance') || act === 'victory' || act === 'clap' || act === 'clapping';
    const isPray = act === 'pray' || act === 'fold-arms' || act === 'idle-foldarms';
    const isSit = act.includes('sit');
    const isGlide = act === 'jump' || act === 'wing-glide' || act === 'glide' || act === 'flight';
    const isTalk = act.includes('talk') || uOpts.speaking === true || !!uOpts.talkText || !!explicitTalkText;

    const refSpeed = isSprint ? 5.2 : (isJog ? 2.9 : 1.32);
    const freqScale = (isWalk || isJog || isSprint) && moveSpeedMps > 0.05
      ? clamp(moveSpeedMps / refSpeed, 0.45, 1.55)
      : 1.0;
    const baseHz = isSprint ? 2.65 : (isJog ? 1.95 : (isWalk ? 1.08 : 0.65));
    walkPhase += h * baseHz * freqScale * Math.PI * 2;

    const s = Math.sin(walkPhase);
    const c = Math.cos(walkPhase);
    const breath = Math.sin(simTime * 1.9) * 0.020;
    const turnLean = clamp(Number(uOpts.turnRate) || 0, -3.5, 3.5) * 0.05;

    // Natural clear outward arm silhouette (+0.11 / -0.11) so sleeves, cuff-tucks & hands read crisply!
    let waistZ = Math.sin(simTime * 1.2) * 0.015 - turnLean;
    let neckZ = -waistZ * 0.6;
    let shL = 0.11 + breath * 0.5, elL = -0.06, wrL = 0;
    let shR = -0.11 - breath * 0.5, elR = 0.06, wrR = 0;
    let hpL = 0.02, knL = 0, akL = 0;
    let hpR = -0.02, knR = 0, akR = 0;

    if (isWalk || isJog || isSprint) {
      const legAmp = isSprint ? 0.58 : (isJog ? 0.44 : 0.28);
      const kneeAmp = isSprint ? 0.64 : (isJog ? 0.48 : 0.26);
      const armAmp = isSprint ? 0.52 : (isJog ? 0.38 : 0.22);
      hpL = s * legAmp;
      hpR = -s * legAmp;
      knL = -Math.max(0, -c) * kneeAmp - 0.05;
      knR = -Math.max(0, c) * kneeAmp - 0.05;
      akL = -hpL * 0.35;
      akR = -hpR * 0.35;
      shL = 0.10 - s * armAmp;
      shR = -0.10 + s * armAmp;
      elL = (isSprint || isJog) ? 0.50 + Math.max(0, -s) * 0.22 : 0.12 + Math.max(0, -s) * 0.12;
      elR = (isSprint || isJog) ? -0.50 - Math.max(0, s) * 0.22 : -0.12 - Math.max(0, s) * 0.12;
      waistZ = s * 0.04 - turnLean;
    } else if (isGreet) {
      const wave = Math.sin(simTime * 5.4);
      shR = -2.10 + wave * 0.14;
      elR = -0.52 + wave * 0.26;
      wrR = wave * 0.20;
      shL = 0.12;
      waistZ = 0.03;
    } else if (isPump) {
      const pull = Math.sin(simTime * 3.1);
      waistZ = pull * 0.07;
      shL = 0.52 + pull * 0.32;
      elL = 0.42 - pull * 0.22;
      shR = -0.52 - pull * 0.32;
      elR = -0.42 + pull * 0.22;
      hpL = 0.08; knL = -0.12;
      hpR = -0.07; knR = -0.10;
    } else if (isDance) {
      const beat = Math.sin(simTime * 4.4);
      const half = Math.sin(simTime * 2.2);
      waistZ = half * 0.10;
      neckZ = -half * 0.07;
      shL = 1.60 + beat * 0.32;
      elL = 0.38 + beat * 0.20;
      shR = -1.60 + beat * 0.32;
      elR = -0.38 + beat * 0.20;
      hpL = beat * 0.14;
      knL = -Math.max(0, beat) * 0.25;
      hpR = -beat * 0.14;
      knR = -Math.max(0, -beat) * 0.25;
    } else if (isPray) {
      shL = 0.38;
      elL = 1.10;
      shR = -0.38;
      elR = -1.10;
      neckZ = 0.03;
    } else if (isSit) {
      hpL = 0.68; knL = -0.74; akL = 0.10;
      hpR = 0.60; knR = -0.68; akR = 0.08;
      shL = 0.24 + Math.sin(simTime * 2.4) * 0.07;
      elL = 0.42;
      shR = -0.24 - Math.cos(simTime * 2.2) * 0.07;
      elR = -0.42;
    } else if (isGlide) {
      shL = 0.78 + Math.sin(simTime * 3.0) * 0.10;
      elL = 0.18;
      shR = -0.78 - Math.sin(simTime * 3.0) * 0.10;
      elR = -0.18;
      hpL = 0.14; knL = -0.24;
      hpR = -0.10; knR = -0.30;
    } else if (isTalk) {
      const g1 = Math.sin(simTime * 2.7);
      const g2 = Math.cos(simTime * 1.9);
      shL = 0.20 + g1 * 0.10;
      elL = 0.44 + g2 * 0.15;
      wrL = g1 * 0.10;
      shR = -0.18 - g2 * 0.09;
      elR = -0.38 - g1 * 0.14;
    }

    if (propState === 'jerikan' || propState === 'parcel' || propState === 'lantern') {
      shR = lerp(shR, -0.28, 0.75);
      elR = lerp(elR, -0.54, 0.75);
    }

    const lookTgt = uOpts.lookTargetVec3 !== undefined ? uOpts.lookTargetVec3 : defaultLookTarget;
    let wantGX = 0;
    let wantGY = 0;
    if (lookTgt) {
      root.updateMatrixWorld(true);
      joints.neck.getWorldPosition(_vA);
      _vB.set(Number(lookTgt.x) || 0, Number(lookTgt.y) || 0, Number(lookTgt.z) || 0).sub(_vA);
      const d = _vB.length();
      if (d > 0.2 && d < 30.0) {
        _vB.divideScalar(d);
        _vFwd.set(0, 0, 1).transformDirection(root.matrixWorld).normalize();
        _vLeft.set(1, 0, 0).transformDirection(root.matrixWorld).normalize();
        if (_vB.dot(_vFwd) > -0.2) {
          wantGX = clamp(_vB.dot(_vLeft), -0.75, 0.75);
          wantGY = clamp(_vB.y, -0.45, 0.45);
        }
      }
    }
    const gRate = 1 - Math.exp(-7.5 * h);
    smoothGazeX = lerp(smoothGazeX, wantGX, gRate);
    smoothGazeY = lerp(smoothGazeY, wantGY, gRate);

    joints.waist.rotation.z = waistZ;
    joints.torso.rotation.y = smoothGazeX * 0.14;
    joints.neck.rotation.z = neckZ - smoothGazeX * 0.06;
    joints.neck.rotation.y = smoothGazeX * 0.30;
    joints.neck.rotation.x = -smoothGazeY * 0.20;

    joints.shoulderL.rotation.z = shL;
    joints.elbowL.rotation.z = elL;
    joints.wristL.rotation.z = wrL;
    joints.shoulderR.rotation.z = shR;
    joints.elbowR.rotation.z = elR;
    joints.wristR.rotation.z = wrR;

    joints.hipL.rotation.z = hpL;
    joints.kneeL.rotation.z = knL;
    joints.ankleL.rotation.z = akL;
    joints.hipR.rotation.z = hpR;
    joints.kneeR.rotation.z = knR;
    joints.ankleR.rotation.z = akR;

    if (faceSwaps) {
      blinkTimer -= h;
      if (blinkTimer <= 0) {
        blinkHold = 0.13;
        blinkTimer = 2.5 + seededHash(Math.floor(simTime * 3), seed + 31) * 2.8;
      }
      if (blinkHold > 0) blinkHold = Math.max(0, blinkHold - h);
      const blinking = blinkHold > 0;
      faceSwaps.eyesOpenMesh.visible = !blinking;
      faceSwaps.eyesClosedMesh.visible = blinking;
      faceSwaps.eyeGroup.position.x = smoothGazeX * 0.011 * mScale;

      let mouthKey = 'rest';
      const line = uOpts.talkText || explicitTalkText;
      if (line) {
        const prog = uOpts.talkProgress ?? explicitTalkProg ?? ((simTime * 0.32) % 1);
        mouthKey = sampleCutoutMouthKey(line, prog);
      } else if (isTalk || expressionName === 'talking') {
        const cyc = Math.floor(simTime * 6.5) % 5;
        mouthKey = cyc === 0 ? 'rest' : (cyc === 1 ? 'A' : (cyc === 2 ? 'O' : (cyc === 3 ? 'smile' : 'A')));
      } else if (expressionName === 'happy' || isGreet || isDance) {
        mouthKey = 'smile';
      } else if (expressionName === 'surprised') {
        mouthKey = 'O';
      }

      for (const [k, mMesh] of Object.entries(faceSwaps.mouths)) {
        mMesh.visible = k === mouthKey;
      }
      const raiseBrows = mouthKey === 'A' || mouthKey === 'O' || expressionName === 'surprised' || isGreet;
      faceSwaps.browsRestMesh.visible = !raiseBrows;
      faceSwaps.browsRaisedMesh.visible = raiseBrows;
    }

    if (wingsMode !== 'off') {
      const boost = clamp(Number(uOpts.wingFlapBoost) || 0, 0, 2.5);
      const isFold = wingsMode === 'folded';
      const loco = clamp(moveSpeedMps / 4.2, 0, 1.2);
      const amp = isFold ? (0.05 + loco * 0.06) : (0.30 + loco * 0.30 + boost * 0.36 + (isGlide ? 0.32 : 0));
      const freq = isFold ? 1.7 : (2.25 + loco * 1.8 + boost * 2.0 + (isGlide ? 1.8 : 0));
      wingPhase += h * freq * Math.PI * 2;

      for (const ws of wingsRig.sides) {
        const sx = ws.sx;
        if (isFold) {
          const fw = Math.sin(wingPhase) * amp;
          ws.shoulderPivot.rotation.set(0.08, sx * (0.76 + fw), sx * -0.46);
          ws.midSpanPivot.rotation.set(0, sx * 0.32, sx * -0.54);
          ws.tipPivot.rotation.set(0, sx * 0.18, sx * -0.28);
        } else {
          const w0 = Math.sin(wingPhase);
          const w1 = Math.sin(wingPhase - 0.58);
          const w2 = Math.sin(wingPhase - 1.16);
          ws.shoulderPivot.rotation.set(0.05, sx * (-0.20 + w0 * amp * 0.80), sx * (0.12 + w0 * amp * 0.50));
          ws.midSpanPivot.rotation.set(0, sx * (0.05 + w1 * amp * 0.52), sx * (0.04 + w1 * amp * 0.36));
          ws.tipPivot.rotation.set(0, sx * (0.03 + w2 * amp * 0.44), sx * (w2 * amp * 0.30));
        }
      }
    }

    if (!uOpts.skipGroundPin) {
      if (isGlide) {
        bodyRoot.position.y = groundY + 0.96 * mScale + Math.sin(simTime * 3.0) * 0.08 * mScale;
      } else {
        pinSolesToGround();
      }
    }
  }

  setBrassPivots(showPivots);
  setGlasses(glassesState);
  setProp(opts.prop || 'none');
  setWingsMode(opts.wingsMode || 'off');
  playAction(currentAction);
  bodyRoot.position.set(0, 0.92 * mScale, 0);
  update(0.016, {});

  function applyTintAndTrim(tintHex, trimHex) {
    for (let i = 0; i < cardMaterials.length; i++) {
      cardMaterials[i].color.setHex(tintHex);
    }
    if (trimOverlayMat && trimHex !== undefined) {
      trimOverlayMat.color.setHex(trimHex);
    }
  }

  function getWorldBonePositions() {
    root.updateMatrixWorld(true);
    const p = (j) => {
      const v = new THREE.Vector3();
      j.getWorldPosition(v);
      return { x: Number(v.x.toFixed(4)), y: Number(v.y.toFixed(4)), z: Number(v.z.toFixed(4)) };
    };
    return {
      head: p(joints.neck),
      handL: p(joints.wristL),
      handR: p(joints.wristR),
      footL: p(joints.soleL),
      footR: p(joints.soleR),
      wingTipL: wingsRig.sides[0] ? p(wingsRig.sides[0].tipPivot) : null,
      wingTipR: wingsRig.sides[1] ? p(wingsRig.sides[1].tipPivot) : null,
    };
  }

  const inst = {
    version: VERSION,
    variant: varKey,
    height: targetHeight,
    root,
    group: root,
    joints,
    brassPins,

    playAction,
    play: (clip) => playAction(clip),
    crossFadeTo: (clip) => playAction(clip),
    getCurrentAction: () => currentAction,
    setMoveSpeed,
    getMoveSpeed: () => moveSpeedMps,

    setBrassPivots,
    getBrassPivots: () => showPivots,
    setGlasses,
    getGlasses: () => glassesState,
    setHandPose,
    getHandPose: () => handPose,
    setProp,
    getProp: () => propState,
    setWingsMode,
    getWingsMode: () => wingsMode,
    setLookTarget: (vec3) => { defaultLookTarget = vec3 || null; },
    setGroundY,
    pinFeetToGround: pinSolesToGround,
    setLyricSpeech,
    setExpression,
    getExpression: () => expressionName,
    applyTintAndTrim,

    evolvePhenotype: (evoOpts) => evolveCutoutPhenotype(inst, evoOpts),
    _bumpGeneration: () => {
      generation += 1;
      return generation;
    },
    getPhenotype: () => ({
      generation,
      variant: varKey,
      glasses: glassesState,
      prop: propState,
      wingsMode,
      showBrassPivots: showPivots,
      clip: currentAction,
    }),
    getWorldBonePositions,
    update,
    dispose: () => {
      for (let i = 0; i < disposables.length; i++) {
        if (disposables[i] && typeof disposables[i].dispose === 'function') {
          disposables[i].dispose();
        }
      }
    },
  };

  return inst;
}

export function evolveCutoutPhenotype(cutoutInst, opts = {}) {
  if (!cutoutInst) return null;

  const gen = typeof cutoutInst._bumpGeneration === 'function'
    ? cutoutInst._bumpGeneration()
    : ((Number(opts.generation) || 0) + 1);

  const rawPoem = String(opts.poem ?? '06');
  const m = rawPoem.match(/(\d{1,2})/);
  const poemNum = m ? clamp(parseInt(m[1], 10), 1, 14) : 6;
  const seed = (Number(opts.seed) || 0) + gen * 29 + poemNum * 11;

  const bgLum = opts.bgLuminance !== undefined ? clamp(Number(opts.bgLuminance), 0, 1) : 0.35;
  const isDarkBg = bgLum < 0.44;
  const tintHex = isDarkBg ? 0xffffff : 0xebe6dc;
  const trimHex = isDarkBg ? 0xf25c48 : 0xc92c24;
  if (typeof cutoutInst.applyTintAndTrim === 'function') {
    cutoutInst.applyTintAndTrim(tintHex, trimHex);
  }

  let wingsMode = 'off';
  if (opts.wingsMode) wingsMode = opts.wingsMode;
  else if (poemNum <= 3) wingsMode = gen % 3 === 2 ? 'folded' : 'off';
  else if (poemNum <= 5) wingsMode = seededHash(seed, 2) < 0.55 ? 'raven' : 'folded';
  else if (poemNum === 6) wingsMode = gen % 2 === 1 ? 'angel' : 'marble';
  else wingsMode = seededHash(seed, 3) < 0.55 ? 'angel' : 'marble';

  if (typeof cutoutInst.setWingsMode === 'function') {
    wingsMode = cutoutInst.setWingsMode(wingsMode);
  }

  const glasses = opts.glasses !== undefined
    ? opts.glasses
    : (poemNum <= 3 ? (gen % 3 === 0) : (gen % 4 === 3 ? 'up' : true));
  if (typeof cutoutInst.setGlasses === 'function') {
    cutoutInst.setGlasses(glasses);
  }

  const shotKind = String(opts.shotKind || '').toLowerCase();
  const PROP_POOL = ['none', 'camera', 'jerikan', 'parcel', 'lantern'];
  let prop = opts.prop !== undefined ? opts.prop : PROP_POOL[(gen + poemNum) % PROP_POOL.length];
  if (opts.prop === undefined) {
    if (shotKind.includes('water') || shotKind.includes('standpipe')) prop = 'jerikan';
    else if (shotKind.includes('night') || shotKind.includes('submerged')) prop = 'lantern';
    else if (shotKind.includes('handoff') || shotKind.includes('severn')) prop = 'parcel';
    else if (shotKind.includes('survey') || shotKind.includes('plate')) prop = 'camera';
  }
  if (typeof cutoutInst.setProp === 'function') {
    prop = cutoutInst.setProp(prop);
  }

  let clip = 'idle';
  if (shotKind.includes('glide') || shotKind.includes('flight') || shotKind.includes('gate')) clip = 'wing-glide';
  else if (shotKind.includes('walk') || shotKind.includes('corridor')) clip = 'walk';
  else if (shotKind.includes('greet') || shotKind.includes('threshold')) clip = 'greet';
  else if (shotKind.includes('dance')) clip = 'dance';
  else if (shotKind.includes('talk')) clip = 'idle-talking';
  else {
    const POOL = ['idle', 'walk', 'greet', 'idle-talking', 'dance', 'pump'];
    clip = POOL[(gen + poemNum) % POOL.length];
  }
  if (typeof cutoutInst.playAction === 'function') {
    cutoutInst.playAction(clip);
  }

  if (opts.lookTargetVec3 && typeof cutoutInst.setLookTarget === 'function') {
    cutoutInst.setLookTarget(opts.lookTargetVec3);
  }

  return {
    generation: gen,
    poem: String(poemNum).padStart(2, '0'),
    contrastMode: isDarkBg ? 'high-key-on-dark' : 'obsidian-on-light',
    glasses,
    prop,
    wingsMode,
    clip,
  };
}

export { evolveCutoutPhenotype as evolveHeroPhenotype };
