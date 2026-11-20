import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const CAST = {
  adult_f: { label: 'Adult F (Imani)', url: '../abyssinian-highlands/human-forge/assets/adult_f.glb' },
  child7: { label: 'Child 7y', url: '../abyssinian-highlands/human-forge/assets/child7.glb' },
  adult_m: { label: 'Adult M', url: '../abyssinian-highlands/human-forge/assets/adult_m.glb' },
  elder: { label: 'Elder', url: '../abyssinian-highlands/human-forge/assets/elder.glb' },
};

const CLIP_GROUPS = [
  {
    title: 'Locomotion',
    clips: [
      { id: 'walk', label: 'Walk' },
      { id: 'walk-relaxed', label: 'Relaxed' },
      { id: 'walk-cautious', label: 'Cautious' },
      { id: 'walk-happy', label: 'Happy' },
      { id: 'walk-carry', label: 'Carry' },
      { id: 'walk-backwards', label: 'Back' },
      { id: 'jog', label: 'Jog' },
      { id: 'sprint', label: 'Sprint' },
    ],
  },
  {
    title: 'Idle & Social',
    clips: [
      { id: 'idle', label: 'Idle' },
      { id: 'idle-talking', label: 'Talk' },
      { id: 'idle-listening', label: 'Listen' },
      { id: 'idle-foldarms', label: 'Fold Arms' },
      { id: 'greeting', label: 'Greet' },
      { id: 'clapping', label: 'Clap' },
      { id: 'yes', label: 'Yes' },
    ],
  },
  {
    title: 'Emotions',
    clips: [
      { id: 'angry', label: 'Angry' },
      { id: 'confused', label: 'Confused' },
      { id: 'reject', label: 'Reject' },
      { id: 'victory', label: 'Victory' },
      { id: 'pray', label: 'Pray' },
    ],
  },
  {
    title: 'Work & Carry',
    clips: [
      { id: 'push', label: 'Push' },
      { id: 'rope-pull', label: 'Pull' },
      { id: 'hammering', label: 'Hammer' },
      { id: 'shovel-dig', label: 'Dig' },
      { id: 'farm-watering', label: 'Water' },
    ],
  },
  {
    title: 'Stance & Climb',
    clips: [
      { id: 'crouch-idle', label: 'Crouch' },
      { id: 'crouch-walk', label: 'Sneak' },
      { id: 'sitting-idle', label: 'Sit' },
      { id: 'sitting-talking', label: 'Sit Talk' },
      { id: 'climb-ladder', label: 'Climb' },
    ],
  },
  {
    title: 'Action & Dance',
    clips: [
      { id: 'jump', label: 'Jump' },
      { id: 'dance-simple', label: 'Dance' },
      { id: 'dance-arm-pump', label: 'Pump' },
      { id: 'dance-charleston', label: 'Charleston' },
      { id: 'guitar-playing', label: 'Guitar' },
    ],
  },
];

const CLIPS = CLIP_GROUPS.flatMap((g) => g.clips);
const PRELOAD_CLIPS = ['idle', 'idle-talking', 'walk', 'walk-carry', 'greeting'];

const COCO17_EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16],
];

const $ = (id) => document.getElementById(id);

const canvas = $('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141311);
scene.fog = new THREE.FogExp2(0x141311, 0.045);

const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
camera.position.set(0.0, 1.38, 3.1);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.92, 0);
controls.minDistance = 0.8;
controls.maxDistance = 8.0;
controls.maxPolarAngle = Math.PI * 0.52;

// Studio 3-point warm editorial lighting
scene.add(new THREE.HemisphereLight(0xf6e9d7, 0x26211c, 0.85));
const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
keyLight.position.set(2.4, 4.2, 3.0);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 14;
keyLight.shadow.camera.left = -2.2;
keyLight.shadow.camera.right = 2.2;
keyLight.shadow.camera.top = 2.6;
keyLight.shadow.camera.bottom = -0.6;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x88b4e8, 0.95);
rimLight.position.set(-2.6, 2.5, -2.5);
scene.add(rimLight);

// Ground disc + subtle grid
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(4.5, 48),
  new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.92, metalness: 0.04 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(6, 24, 0x4b4236, 0x28231e);
grid.position.y = 0.002;
scene.add(grid);

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
window.MeshoptDecoder = MeshoptDecoder;

const state = {
  castKey: 'adult_f',
  clipName: 'idle',
  speed: 1.0,
  paused: false,
  wireframe: false,
  showSkeleton: false,
  lockRoot: true,
  e1Mode: 'off', // 'off' | 'additive' | 'solo'
  e1Playing: true,
  e1Time: 0,
  driver: null,
  avatarRoot: null,
  skeletonHelper: null,
  bonesByName: new Map(),
  restQuats: new Map(),
  manifest: null,
  e1Track: null,
  refView: 'normal', // 'rgb' | 'normal' | 'seg'
  refOverlay: true,
  refIndex: 0,
  refKpCache: new Map(),
  fps: 60,
  frameCount: 0,
  fpsAccum: 0,
};

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function applyMaterialFlags(root) {
  if (!root) return;
  root.traverse((o) => {
    if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        m.wireframe = state.wireframe;
      }
    }
  });
}

async function loadCast(castKey) {
  const info = CAST[castKey];
  if (!info) return;
  state.castKey = castKey;
  $('hudStatus').textContent = `Loading ${info.label}…`;

  if (state.driver) {
    state.driver.dispose();
    state.driver = null;
  }
  if (state.skeletonHelper) {
    scene.remove(state.skeletonHelper);
    state.skeletonHelper = null;
  }
  if (state.avatarRoot) {
    scene.remove(state.avatarRoot);
    state.avatarRoot = null;
  }

  const gltf = await gltfLoader.loadAsync(info.url);
  const root = gltf.scene;

  // Give Anny a clean terracotta/warm-clay studio shader while preserving skinning
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) {
        o.material.roughness = 0.62;
        o.material.metalness = 0.05;
        if (o.material.color) o.material.color.setHex(0xd6b497);
      }
    }
  });

  // Ground bbox to y=0
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
  const h = Math.max(0.9, box.max.y - box.min.y);
  controls.target.set(0, h * 0.54, 0);
  camera.position.set(0.35, h * 0.72, h * 1.95);
  controls.update();

  scene.add(root);
  state.avatarRoot = root;

  state.bonesByName.clear();
  state.restQuats.clear();
  root.traverse((o) => {
    if (o.isBone) {
      state.bonesByName.set(o.name, o);
      state.restQuats.set(o.name, o.quaternion.clone());
    }
  });

  const skel = new THREE.SkeletonHelper(root);
  skel.visible = state.showSkeleton;
  scene.add(skel);
  state.skeletonHelper = skel;
  applyMaterialFlags(root);

  if (!window.Mesh2MotionAnny) {
    $('hudStatus').textContent = 'Mesh2MotionAnny script missing';
    return;
  }

  const driver = window.Mesh2MotionAnny.createAnnyDriver(root, {
    THREE,
    loader: gltfLoader,
    baseUrl: 'mesh2motion/clips',
    lockRootMotion: state.lockRoot,
    keepVerticalBounce: true,
    armBindAlign: true,
    includeFingers: true,
    defaultFade: 0.25,
    speed: state.speed,
  });

  const initialClips = Array.from(new Set([state.clipName, ...PRELOAD_CLIPS]));
  await driver.loadLibrary(initialClips);
  state.driver = driver;
  driver.play(state.clipName, { fadeDuration: 0 });
  if (state.paused) driver.pause();
  driver.update(0);

  const cov = driver.getBoneCoverage(state.clipName);
  const covTxt = cov
    ? `${cov.mappedBoneCount}/${cov.totalSourceQuatTracks} bones · hipScale ${cov.hipScale}`
    : 'retargeted';
  $('hudCoverage').textContent = `Anny 104b · ${covTxt}`;
  $('hudStatus').textContent = `${info.label} · ${state.clipName}`;
}

function sampleE1Angles(tSec) {
  const tr = state.e1Track;
  if (!tr || !tr.frames || !tr.frames.length) return null;
  const frames = tr.frames;
  const dur = Math.max(0.01, tr.duration_sec || frames[frames.length - 1].time || 10);
  const t = ((tSec % dur) + dur) % dur;
  let i = 0;
  while (i < frames.length - 2 && frames[i + 1].time < t) i++;
  const a = frames[i];
  const b = frames[Math.min(i + 1, frames.length - 1)];
  const span = Math.max(1e-4, b.time - a.time);
  const alpha = Math.max(0, Math.min(1, (t - a.time) / span));

  const out = {};
  for (const k of Object.keys(a.angles)) {
    out[k] = a.angles[k] + (b.angles[k] - a.angles[k]) * alpha;
  }
  const core17 = a.core17.map((p, idx) => {
    const q = b.core17[idx] || p;
    return [
      p[0] + (q[0] - p[0]) * alpha,
      p[1] + (q[1] - p[1]) * alpha,
      p[2] + (q[2] - p[2]) * alpha,
    ];
  });
  return { t, dur, angles: out, core17 };
}

const _eul = new THREE.Euler(0, 0, 0, 'YXZ');
const _qDelta = new THREE.Quaternion();

function applyE1ToAnny(sample) {
  if (!sample || !state.bonesByName.size) return;
  const a = sample.angles;
  const solo = state.e1Mode === 'solo';

  const applyBone = (name, rx, ry, rz) => {
    const bone = state.bonesByName.get(name) || state.bonesByName.get(name.replace(/\./g, ''));
    if (!bone) return;
    _eul.set(rx, ry, rz, 'YXZ');
    _qDelta.setFromEuler(_eul);
    if (solo) {
      const rest = state.restQuats.get(bone.name);
      if (rest) bone.quaternion.copy(rest).multiply(_qDelta);
    } else {
      bone.quaternion.multiply(_qDelta);
    }
  };

  if (solo) {
    // Reset all bones to rest before applying E1 speech-arc pose
    for (const [name, rest] of state.restQuats.entries()) {
      const b = state.bonesByName.get(name);
      if (b) b.quaternion.copy(rest);
    }
  }

  applyBone('spine03', a.spinePitch * 0.5, a.spineYaw * 0.45, a.spineRoll * 0.5);
  applyBone('spine01', a.spinePitch * 0.5, a.spineYaw * 0.55, a.spineRoll * 0.5);
  applyBone('neck01', a.headPitch * 0.45, a.headYaw * 0.45, a.headRoll * 0.4);
  applyBone('head', a.headPitch * 0.55, a.headYaw * 0.55, a.headRoll * 0.6);
  applyBone('upperarm01.L', 0, 0, a.leftArmZ * 0.45);
  applyBone('upperarm01.R', 0, 0, -a.rightArmZ * 0.45);
  applyBone('lowerarm01.L', a.leftElbowFlex * 0.35, 0, 0);
  applyBone('lowerarm01.R', a.rightElbowFlex * 0.35, 0, 0);
}

function drawE1MiniCanvas(sample) {
  const cv = $('e1Canvas');
  if (!cv || !sample) return;
  const ctx = cv.getContext('2d');
  const w = cv.width;
  const h = cv.height;
  ctx.fillStyle = '#12100e';
  ctx.fillRect(0, 0, w, h);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
  ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
  ctx.stroke();

  const pts = sample.core17;
  ctx.strokeStyle = '#e5a957';
  ctx.lineWidth = 2;
  for (const [i, j] of COCO17_EDGES) {
    const p = pts[i];
    const q = pts[j];
    if (p && q && p[2] > 0.15 && q[2] > 0.15) {
      ctx.beginPath();
      ctx.moveTo(p[0] * w, p[1] * h);
      ctx.lineTo(q[0] * w, q[1] * h);
      ctx.stroke();
    }
  }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p || p[2] <= 0.15) continue;
    ctx.fillStyle = i <= 4 ? '#7dd3fc' : '#f7d694';
    ctx.beginPath();
    ctx.arc(p[0] * w, p[1] * h, i <= 4 ? 3 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

async function renderRefInspector() {
  if (!state.manifest || !state.manifest.refs.length) return;
  const ref = state.manifest.refs[state.refIndex];
  const cv = $('refCanvas');
  const ctx = cv.getContext('2d');

  const imgUrl =
    state.refView === 'rgb' ? ref.source :
    state.refView === 'seg' ? ref.seg :
    ref.normal;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
    img.src = imgUrl;
  });

  const w = cv.width;
  const h = cv.height;
  ctx.fillStyle = '#12100e';
  ctx.fillRect(0, 0, w, h);

  let dx = 0, dy = 0, dw = w, dh = h;
  if (img.naturalWidth > 0) {
    const aspect = img.naturalWidth / img.naturalHeight;
    if (aspect > w / h) {
      dh = w / aspect;
      dy = (h - dh) * 0.5;
    } else {
      dw = h * aspect;
      dx = (w - dw) * 0.5;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  let kpData = state.refKpCache.get(ref.id);
  if (!kpData) {
    try {
      kpData = await (await fetch(ref.keypoints)).json();
      state.refKpCache.set(ref.id, kpData);
    } catch (_) {
      kpData = null;
    }
  }

  if (state.refOverlay && kpData && Array.isArray(kpData.keypoints_308)) {
    const kps = kpData.keypoints_308;
    // Draw dense 308 face/hand/foot keypoints as fine cyan dots
    ctx.fillStyle = 'rgba(110, 224, 255, 0.72)';
    for (let i = 17; i < kps.length; i++) {
      const p = kps[i];
      if (p[2] > 0.25) {
        ctx.fillRect(dx + p[0] * dw - 1, dy + p[1] * dh - 1, 2, 2);
      }
    }
    // Draw COCO-17 body skeleton
    ctx.strokeStyle = 'rgba(245, 190, 96, 0.92)';
    ctx.lineWidth = 2;
    for (const [i, j] of COCO17_EDGES) {
      const p = kps[i];
      const q = kps[j];
      if (p[2] > 0.2 && q[2] > 0.2) {
        ctx.beginPath();
        ctx.moveTo(dx + p[0] * dw, dy + p[1] * dh);
        ctx.lineTo(dx + q[0] * dw, dy + q[1] * dh);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 17; i++) {
      const p = kps[i];
      if (p[2] > 0.2) {
        ctx.fillStyle = '#fff1d0';
        ctx.beginPath();
        ctx.arc(dx + p[0] * dw, dy + p[1] * dh, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  $('refMeta').textContent = `${ref.width}×${ref.height} · ${ref.valid_keypoints}/308 kps · ${ref.infer_sec}s`;
}

async function loadSapiensManifest() {
  try {
    const manifest = await (await fetch('sapiens2/extracted/manifest.json')).json();
    state.manifest = manifest;

    const badge = $('sapiensBadge');
    const isReal = manifest.backend && !manifest.backend.includes('fallback');
    badge.textContent = isReal ? `LIVE · ${manifest.backend}` : `FALLBACK · ${manifest.backend}`;
    badge.className = isReal ? 'badge ok' : 'badge warn';
    $('sapiensDetail').textContent = `${manifest.license} · ${manifest.device}`;

    const refSel = $('refSelect');
    refSel.innerHTML = '';
    manifest.refs.forEach((r, idx) => {
      refSel.add(new Option(r.id.replace(/^ref_0/, '#'), String(idx)));
    });
    await renderRefInspector();

    if (manifest.video_track && manifest.video_track.file) {
      state.e1Track = await (await fetch(manifest.video_track.file)).json();
      $('e1Scrub').max = String(state.e1Track.duration_sec || 10);
      const s0 = sampleE1Angles(0);
      if (s0) drawE1MiniCanvas(s0);
    }
  } catch (err) {
    $('sapiensBadge').textContent = 'UNAVAILABLE';
    $('sapiensBadge').className = 'badge warn';
    $('sapiensDetail').textContent = String(err);
  }
}

async function selectClip(clipId, fadeDuration = 0.25) {
  state.clipName = clipId;
  const clipWrap = $('clipButtons');
  if (clipWrap) {
    clipWrap.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.clip === clipId));
  }
  if (!state.driver) return;
  if (!state.driver.hasClip(clipId)) {
    $('hudStatus').textContent = `Loading ${clipId}…`;
    await state.driver.loadClip(clipId);
  }
  state.driver.crossFadeTo(clipId, fadeDuration);
  if (state.paused) state.driver.pause();
  state.driver.update(0);
  $('hudStatus').textContent = `${CAST[state.castKey].label} · ${clipId}`;
}

function focusHands(side = 'both') {
  if (!state.avatarRoot) return;
  state.avatarRoot.updateMatrixWorld(true);
  const wL = state.bonesByName.get('wristL') || state.bonesByName.get('wrist.L');
  const wR = state.bonesByName.get('wristR') || state.bonesByName.get('wrist.R');
  if (!wL || !wR) return;
  const pL = new THREE.Vector3();
  const pR = new THREE.Vector3();
  wL.getWorldPosition(pL);
  wR.getWorldPosition(pR);
  const target = new THREE.Vector3();
  if (side === 'L') {
    target.copy(pL);
    camera.position.set(pL.x + 0.14, pL.y + 0.08, pL.z + 0.34);
  } else if (side === 'R') {
    target.copy(pR);
    camera.position.set(pR.x - 0.14, pR.y + 0.08, pR.z + 0.34);
  } else {
    target.addVectors(pL, pR).multiplyScalar(0.5);
    const span = Math.max(0.32, pL.distanceTo(pR));
    camera.position.set(target.x, target.y + 0.10, target.z + span * 1.15 + 0.28);
  }
  controls.minDistance = 0.18;
  controls.target.copy(target);
  controls.update();
}

function wireUI() {
  // Cast selector
  const castSel = $('castSelect');
  for (const [k, v] of Object.entries(CAST)) {
    castSel.add(new Option(v.label, k));
  }
  castSel.value = state.castKey;
  castSel.addEventListener('change', () => loadCast(castSel.value));

  // Categorized clip buttons (35 CC0 clips, lazy-loaded on demand)
  const clipWrap = $('clipButtons');
  CLIP_GROUPS.forEach((group) => {
    const hdr = document.createElement('div');
    hdr.className = 'clip-cat';
    hdr.textContent = group.title;
    clipWrap.appendChild(hdr);
    const row = document.createElement('div');
    row.className = 'row';
    group.clips.forEach((c) => {
      const btn = document.createElement('button');
      btn.textContent = c.label;
      btn.dataset.clip = c.id;
      if (c.id === state.clipName) btn.classList.add('on');
      btn.addEventListener('click', () => selectClip(c.id));
      row.appendChild(btn);
    });
    clipWrap.appendChild(row);
  });

  // Speed & toggles
  $('speedSlider').addEventListener('input', (e) => {
    state.speed = parseFloat(e.target.value);
    $('speedVal').textContent = `${state.speed.toFixed(2)}×`;
    if (state.driver) state.driver.setSpeed(state.speed);
  });

  $('btnPause').addEventListener('click', (e) => {
    state.paused = !state.paused;
    e.target.classList.toggle('on', state.paused);
    e.target.textContent = state.paused ? 'Resume' : 'Pause';
    if (state.driver) {
      if (state.paused) state.driver.pause();
      else state.driver.resume();
    }
  });

  $('btnWire').addEventListener('click', (e) => {
    state.wireframe = !state.wireframe;
    e.target.classList.toggle('on', state.wireframe);
    applyMaterialFlags(state.avatarRoot);
  });

  $('btnSkel').addEventListener('click', (e) => {
    state.showSkeleton = !state.showSkeleton;
    e.target.classList.toggle('on', state.showSkeleton);
    if (state.skeletonHelper) state.skeletonHelper.visible = state.showSkeleton;
  });

  $('btnRootLock').addEventListener('click', (e) => {
    state.lockRoot = !state.lockRoot;
    e.target.classList.toggle('on', state.lockRoot);
    if (state.driver) state.driver.setRootMotionLock(state.lockRoot);
  });

  // Ref inspector controls
  $('refSelect').addEventListener('change', (e) => {
    state.refIndex = parseInt(e.target.value, 10) || 0;
    renderRefInspector();
  });

  document.querySelectorAll('[data-refview]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.refView = btn.dataset.refview;
      document.querySelectorAll('[data-refview]').forEach((b) => b.classList.toggle('on', b === btn));
      renderRefInspector();
    });
  });

  $('btnKpOverlay').addEventListener('click', (e) => {
    state.refOverlay = !state.refOverlay;
    e.target.classList.toggle('on', state.refOverlay);
    renderRefInspector();
  });

  // E1 Mocap controls
  document.querySelectorAll('[data-e1mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.e1Mode = btn.dataset.e1mode;
      document.querySelectorAll('[data-e1mode]').forEach((b) => b.classList.toggle('on', b === btn));
    });
  });

  $('btnE1Play').addEventListener('click', (e) => {
    state.e1Playing = !state.e1Playing;
    e.target.textContent = state.e1Playing ? 'Pause E1' : 'Play E1';
  });

  $('e1Scrub').addEventListener('input', (e) => {
    state.e1Time = parseFloat(e.target.value) || 0;
    state.e1Playing = false;
    $('btnE1Play').textContent = 'Play E1';
    const s = sampleE1Angles(state.e1Time);
    if (s) drawE1MiniCanvas(s);
  });
}

let lastNow = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;

  if (state.driver && state.e1Mode !== 'solo') {
    state.driver.update(dt);
  }

  if (state.e1Track) {
    if (state.e1Playing) {
      state.e1Time += dt * state.speed;
    }
    const sample = sampleE1Angles(state.e1Time);
    if (sample) {
      $('e1Time').textContent = `${sample.t.toFixed(1)}s / ${sample.dur.toFixed(1)}s`;
      if (state.e1Playing) $('e1Scrub').value = String(sample.t);
      if (state.e1Mode !== 'off') {
        applyE1ToAnny(sample);
      }
      if (state.frameCount % 2 === 0) drawE1MiniCanvas(sample);
    }
  }

  controls.update();
  renderer.render(scene, camera);

  state.frameCount++;
  state.fpsAccum += dt;
  if (state.fpsAccum >= 0.5) {
    state.fps = Math.round(state.frameCount / state.fpsAccum);
    $('hudFps').textContent = `${state.fps} FPS`;
    state.frameCount = 0;
    state.fpsAccum = 0;
  }
}

window.__STUDIO__ = {
  state,
  THREE,
  scene,
  camera,
  controls,
  renderer,
  loadCast,
  selectClip,
  focusHands,
  getGLContext: () => renderer.getContext(),
  getSummary: () => ({
    cast: state.castKey,
    clip: state.clipName,
    fps: state.fps,
    e1Mode: state.e1Mode,
    backend: state.manifest ? state.manifest.backend : null,
    refs: state.manifest ? state.manifest.refs.length : 0,
    e1Samples: state.e1Track ? state.e1Track.sample_count : 0,
    bones: state.bonesByName.size,
    clipsLoaded: state.driver ? state.driver.getClipNames().length : 0,
    totalClips: CLIPS.length,
    glError: renderer.getContext().getError(),
  }),
};

wireUI();
Promise.all([loadCast(state.castKey), loadSapiensManifest()]).then(() => {
  requestAnimationFrame(animate);
});
