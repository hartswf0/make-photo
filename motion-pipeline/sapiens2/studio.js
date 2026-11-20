import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const CAST = {
  adult_f: { label: 'Imani (Adult F)', url: '../abyssinian-highlands/human-forge/assets/adult_f.glb' },
  child7: { label: 'June (Child 7y)', url: '../abyssinian-highlands/human-forge/assets/child7.glb' },
  adult_m: { label: 'Elder (Adult M)', url: '../abyssinian-highlands/human-forge/assets/adult_m.glb' },
  elder: { label: 'Makeda (Elder)', url: '../abyssinian-highlands/human-forge/assets/elder.glb' },
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

// ---------------------------------------------------------------------------
// Three.js Renderer (60+ FPS: pixelRatio capped <= 1.5, clean soft shadows)
// ---------------------------------------------------------------------------
const canvas = $('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const COURTYARD_SKY = new THREE.Color(0xcabca5);
const DARK_BG = new THREE.Color(0x141311);
const courtyardFog = new THREE.FogExp2(0xcabca5, 0.032);
const darkFog = new THREE.FogExp2(0x141311, 0.045);

const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 70);
camera.position.set(0.35, 1.32, 3.15);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.92, 0);
controls.minDistance = 0.32;
controls.maxDistance = 8.5;
controls.maxPolarAngle = Math.PI * 0.51;

// Warm sunlit highland 3-point lighting
const hemiLight = new THREE.HemisphereLight(0xfff4e0, 0x615242, 0.95);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfff0d4, 2.35);
keyLight.position.set(2.8, 5.2, 3.4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 16;
keyLight.shadow.camera.left = -2.8;
keyLight.shadow.camera.right = 2.8;
keyLight.shadow.camera.top = 3.0;
keyLight.shadow.camera.bottom = -0.8;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x8bb8e8, 0.85);
rimLight.position.set(-2.6, 2.8, -2.8);
scene.add(rimLight);

// ---------------------------------------------------------------------------
// Environments: Sunlit Highland Stone Courtyard & Chapel Wall vs Dark Grid
// ---------------------------------------------------------------------------
function buildCourtyardEnvironment() {
  const group = new THREE.Group();
  group.name = 'highland_courtyard_set';

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb7a48a, roughness: 0.92, metalness: 0.02 });
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0xc5b296, roughness: 0.88, metalness: 0.03 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcdbc9f, roughness: 0.94, metalness: 0.01 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x8d765c, roughness: 0.90, metalness: 0.02 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x4f3523, roughness: 0.86, metalness: 0.02 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x4b5d3b, roughness: 0.92, metalness: 0.0 });

  // Broad limestone courtyard floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), stoneMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  floor.receiveShadow = true;
  group.add(floor);

  // Subtle radial stone paving ring around character
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.85, 0.04, 36), plinthMat);
  plinth.position.y = -0.02;
  plinth.receiveShadow = true;
  group.add(plinth);

  const ring = new THREE.Mesh(new THREE.RingGeometry(1.76, 1.88, 36), trimMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.001;
  ring.receiveShadow = true;
  group.add(ring);

  // Back sunlit Ethiopian highland chapel wall with recessed arched doorway
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(9.5, 3.6, 0.45), wallMat);
  backWall.position.set(0, 1.8, -3.9);
  backWall.receiveShadow = true;
  backWall.castShadow = true;
  group.add(backWall);

  // Wall cornice & pilasters
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.22, 0.62), trimMat);
  cornice.position.set(0, 3.62, -3.88);
  cornice.castShadow = true;
  group.add(cornice);

  for (const px of [-3.4, -1.4, 1.4, 3.4]) {
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.36, 3.6, 0.56), trimMat);
    pilaster.position.set(px, 1.8, -3.84);
    pilaster.castShadow = true;
    pilaster.receiveShadow = true;
    group.add(pilaster);
  }

  // Recessed timber chapel door
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.25, 0.14), timberMat);
  door.position.set(0, 1.12, -3.66);
  door.receiveShadow = true;
  group.add(door);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.18, 0.26), trimMat);
  lintel.position.set(0, 2.32, -3.64);
  lintel.castShadow = true;
  group.add(lintel);

  // Low courtyard stone balustrades flanking left & right
  for (const side of [-1, 1]) {
    const lowWall = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.85, 5.2), wallMat);
    lowWall.position.set(side * 4.2, 0.42, -1.4);
    lowWall.castShadow = true;
    lowWall.receiveShadow = true;
    group.add(lowWall);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.10, 5.3), trimMat);
    cap.position.set(side * 4.2, 0.88, -1.4);
    group.add(cap);
  }

  // Distant highland acacia tree silhouette behind wall
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 2.9, 8), timberMat);
  trunk.position.set(-2.9, 1.45, -5.0);
  trunk.rotation.z = 0.08;
  group.add(trunk);

  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.2, 0.55, 14), foliageMat);
  canopy.position.set(-2.8, 3.15, -5.0);
  canopy.castShadow = true;
  group.add(canopy);

  return group;
}

function buildDarkGridEnvironment() {
  const group = new THREE.Group();
  group.name = 'dark_grid_set';
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 48),
    new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.92, metalness: 0.04 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const grid = new THREE.GridHelper(6, 24, 0x4b4236, 0x28231e);
  grid.position.y = 0.002;
  group.add(grid);
  return group;
}

const courtyardSet = buildCourtyardEnvironment();
const darkGridSet = buildDarkGridEnvironment();
scene.add(courtyardSet);
scene.add(darkGridSet);

// ---------------------------------------------------------------------------
// Story-Authentic Interactive Props ONLY (20L Cyan Jerrycan centered between
// both palms on Carry, Cast-Iron Standpipe Pump & Terracotta Shekla Bowl on
// Water/Pump, Carved Stone Bench on Sit)
// ---------------------------------------------------------------------------
const propSystem = (() => {
  const worldProps = new THREE.Group();
  worldProps.name = 'interactive_world_props';
  scene.add(worldProps);

  const cyanGlowMat = new THREE.MeshStandardMaterial({
    color: 0x28d8f0,
    emissive: 0x168da3,
    emissiveIntensity: 0.65,
    roughness: 0.20,
    metalness: 0.05,
    transparent: true,
    opacity: 0.88,
  });
  const canShellMat = new THREE.MeshStandardMaterial({
    color: 0x199ab0,
    roughness: 0.35,
    metalness: 0.08,
    transparent: true,
    opacity: 0.68,
  });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x35373a, roughness: 0.52, metalness: 0.72 });
  const terracottaMat = new THREE.MeshStandardMaterial({ color: 0x9e5134, roughness: 0.84, metalness: 0.02 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9e8f7a, roughness: 0.92, metalness: 0.02 });

  // 1. 20L glowing #28d8f0 cyan jerrycan (world-space, centered cleanly between both palms on Carry)
  const jerrycan = new THREE.Group();
  jerrycan.name = 'story_prop_jerrycan';
  const canBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.24), canShellMat);
  canBody.position.set(0, -0.10, 0);
  canBody.castShadow = true;
  jerrycan.add(canBody);
  const canWater = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.19, 0.21), cyanGlowMat);
  canWater.position.set(0, -0.13, 0);
  jerrycan.add(canWater);
  const canHandle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.013, 6, 12, Math.PI), ironMat);
  canHandle.position.set(0, 0.04, 0);
  jerrycan.add(canHandle);
  const canCap = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 10), ironMat);
  canCap.position.set(0, 0.05, 0.08);
  jerrycan.add(canCap);
  jerrycan.visible = false;
  worldProps.add(jerrycan);

  // 2. Cast-iron standpipe pump & ribbed terracotta shekla bowl + parabolic cyan stream
  const pumpSet = new THREE.Group();
  pumpSet.position.set(0.68, 0, 0.42);
  const standBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.14, 14), stoneMat);
  standBase.position.y = 0.07;
  standBase.castShadow = true;
  standBase.receiveShadow = true;
  pumpSet.add(standBase);
  const standPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.92, 12), ironMat);
  standPipe.position.y = 0.56;
  standPipe.castShadow = true;
  pumpSet.add(standPipe);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.24, 10), ironMat);
  spout.position.set(-0.12, 0.84, 0);
  spout.rotation.z = Math.PI * 0.42;
  pumpSet.add(spout);
  const leverPivot = new THREE.Group();
  leverPivot.position.set(0, 0.96, 0);
  const leverBar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.52, 8), ironMat);
  leverBar.position.set(0.18, 0.05, 0);
  leverBar.rotation.z = -Math.PI * 0.36;
  leverPivot.add(leverBar);
  pumpSet.add(leverPivot);

  // Ribbed terracotta shekla bowl + water surface + ripples
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.22, 18, 1, true), terracottaMat);
  bowl.position.set(-0.26, 0.11, 0);
  bowl.material = terracottaMat.clone();
  bowl.material.side = THREE.DoubleSide;
  bowl.castShadow = true;
  pumpSet.add(bowl);
  const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.21, 18), cyanGlowMat);
  bowlWater.rotation.x = -Math.PI / 2;
  bowlWater.position.set(-0.26, 0.17, 0);
  pumpSet.add(bowlWater);
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.065, 18), cyanGlowMat);
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.set(-0.26, 0.174, 0);
  pumpSet.add(ripple);

  // Parabolic cyan water stream from spout into shekla bowl
  const streamPts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    streamPts.push(new THREE.Vector3(-0.21 - t * 0.07, 0.80 - t * t * 0.63, 0));
  }
  const streamGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(streamPts), 14, 0.015, 7, false);
  const waterStream = new THREE.Mesh(streamGeo, cyanGlowMat);
  pumpSet.add(waterStream);
  worldProps.add(pumpSet);

  // 3. Carved stone bench (Sit / Sit Talk)
  const bench = new THREE.Group();
  bench.position.set(0, 0, -0.18);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.10, 0.42), stoneMat);
  seat.position.y = 0.44;
  seat.castShadow = true;
  seat.receiveShadow = true;
  bench.add(seat);
  for (const bx of [-0.34, 0.34]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.40, 0.36), stoneMat);
    leg.position.set(bx, 0.20, 0);
    leg.castShadow = true;
    bench.add(leg);
  }
  worldProps.add(bench);

  let enabled = true;
  let activeClip = 'idle';
  let activeChar = null;
  const _wL = new THREE.Vector3();
  const _wR = new THREE.Vector3();

  function syncToClip(clipId, character) {
    activeClip = clipId;
    activeChar = character || null;

    jerrycan.visible = false;
    pumpSet.visible = false;
    bench.visible = false;
    if (!enabled || !character) return;

    if (clipId === 'walk-carry') {
      jerrycan.visible = true;
    }
    if (clipId === 'dance-arm-pump' || clipId === 'farm-watering') {
      pumpSet.visible = true;
    }
    if (clipId === 'sitting-idle' || clipId === 'sitting-talking') {
      bench.visible = true;
    }
  }

  function update(tSec) {
    if (!enabled) return;
    if (jerrycan.visible && activeChar) {
      const wristL = activeChar.bonesByNorm.get('wristl');
      const wristR = activeChar.bonesByNorm.get('wristr');
      if (wristL && wristR) {
        wristL.getWorldPosition(_wL);
        wristR.getWorldPosition(_wR);
        jerrycan.position.set(
          (_wL.x + _wR.x) * 0.5,
          Math.max(0.26, (_wL.y + _wR.y) * 0.5 - 0.02),
          (_wL.z + _wR.z) * 0.5 + 0.06
        );
        const dx = _wL.x - _wR.x;
        const dz = _wL.z - _wR.z;
        jerrycan.rotation.set(0, Math.atan2(-dz, dx), 0);
      }
      canWater.rotation.z = Math.sin(tSec * 5.2) * 0.14;
      canWater.rotation.x = Math.cos(tSec * 4.4) * 0.10;
    }
    if (pumpSet.visible) {
      leverPivot.rotation.z = Math.sin(tSec * 4.2) * 0.34;
      const pulse = (tSec * 1.8) % 1;
      ripple.scale.setScalar(0.6 + pulse * 2.1);
      waterStream.scale.set(1, 0.92 + 0.08 * Math.sin(tSec * 14), 1);
    }
  }

  function setEnabled(flag, character) {
    enabled = !!flag;
    syncToClip(activeClip, character);
  }

  return { syncToClip, update, setEnabled, isEnabled: () => enabled };
})();

// ---------------------------------------------------------------------------
// WebAudio Procedural Foley Engine (Footsteps, Cloth, Water, Pump, Claps, Voice)
// ---------------------------------------------------------------------------
const soundEngine = (() => {
  let ctx = null;
  let noiseBuf = null;
  let enabled = false;
  let stepAccum = 0;
  let auxAccum = 0;
  let voiceAccum = 0;

  function ensureAudio() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const len = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    return true;
  }

  let hsInited = false;
  function ensureHighlandSoundscape() {
    if (!window.HighlandSoundscape) return null;
    if (!hsInited) {
      hsInited = true;
      try {
        window.HighlandSoundscape.init({
          basePath: '../audio/',
          cosmicAddisUrl: '../zones/cyan-jerikan.ogg',
        });
        window.HighlandSoundscape.setBiome('courtyard', 2400);
      } catch (_) {}
    }
    return window.HighlandSoundscape;
  }

  function setEnabled(flag) {
    enabled = !!flag;
    if (enabled && ensureAudio() && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const hs = ensureHighlandSoundscape();
    if (hs) {
      try {
        if (enabled) {
          hs.unlock();
          hs.setMasterMute(false);
          hs.setBiome('courtyard', 2400);
        } else {
          hs.setMasterMute(true);
        }
      } catch (_) {}
    }
    return enabled;
  }

  function setRadioStation(stationIdx) {
    const hs = ensureHighlandSoundscape();
    if (!hs) return;
    try {
      if (stationIdx > 0) {
        if (!enabled) setEnabled(true);
        hs.toggleRadio(true);
        hs.setStation(stationIdx - 1);
      } else {
        hs.toggleRadio(false);
      }
    } catch (_) {}
  }

  function triggerNoise(freq, q, dur, gainVal, type = 'bandpass') {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(freq, now);
    flt.Q.setValueAtTime(q, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, now);
    g.gain.exponentialRampToValueAtTime(0.0005, now + dur);
    src.connect(flt).connect(g).connect(ctx.destination);
    src.start(now);
    src.stop(now + dur);
  }

  function triggerTone(freq0, freq1, dur, gainVal, wave = 'sine') {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq0, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, now);
    g.gain.exponentialRampToValueAtTime(0.0005, now + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  function update(dt, clipId, speed, paused, jawOpen) {
    if (!enabled || paused || !ctx || ctx.state !== 'running') return;
    const rate = Math.max(0.2, speed || 1);

    // Footsteps & cloth rustle on locomotion / dance / jump
    const isSprint = clipId === 'sprint';
    const isJog = clipId === 'jog';
    const isWalk = clipId.startsWith('walk') || clipId === 'crouch-walk';
    const isDance = clipId.startsWith('dance') || clipId === 'jump';
    if (isWalk || isJog || isSprint || isDance) {
      const interval = isSprint ? 0.28 : isJog ? 0.36 : isDance ? 0.44 : 0.54;
      stepAccum += dt * rate;
      if (stepAccum >= interval) {
        stepAccum -= interval;
        const hs = window.HighlandSoundscape;
        if (hs && hs.isReady && hs.isReady()) {
          try { hs.playFootstep('stone', isSprint ? 72 : 58); } catch (_) {}
        } else {
          // Gravel/stone footstep thud + subtle cloth swish
          triggerNoise(420 + Math.random() * 140, 1.8, 0.09, isSprint ? 0.11 : 0.075);
          triggerTone(115, 48, 0.08, 0.06, 'triangle');
          triggerNoise(1600, 1.2, 0.14, 0.022, 'highpass');
        }
      }
    }

    // Clip-specific foley
    auxAccum += dt * rate;
    if ((clipId === 'walk-carry' || clipId === 'farm-watering') && auxAccum >= 0.48) {
      auxAccum = 0;
      const hs = window.HighlandSoundscape;
      if (hs && hs.isReady && hs.isReady()) {
        try { hs.playWaterSpill(0.45); } catch (_) {}
      } else {
        triggerNoise(680 + Math.random() * 240, 2.4, 0.20, 0.045);
      }
    } else if ((clipId === 'dance-arm-pump' || clipId === 'push') && auxAccum >= 0.65) {
      auxAccum = 0;
      const hs = window.HighlandSoundscape;
      if (hs && hs.isReady && hs.isReady()) {
        try { hs.updatePumpAudio({ x: 0.68, y: 0.8, z: 0.42 }, true, 0.72); } catch (_) {}
      } else {
        triggerTone(420, 190, 0.11, 0.055, 'square');
        triggerNoise(920, 2.0, 0.16, 0.035);
      }
    } else if (clipId === 'hammering' && auxAccum >= 0.58) {
      auxAccum = 0;
      triggerTone(280, 95, 0.12, 0.09, 'triangle');
      triggerNoise(1100, 3.0, 0.08, 0.06);
    } else if (clipId === 'clapping' && auxAccum >= 0.36) {
      auxAccum = 0;
      triggerNoise(1350, 1.6, 0.07, 0.10);
    }

    // Soft formant vocal murmur synced to jawOpen
    if (jawOpen > 0.18) {
      voiceAccum += dt;
      if (voiceAccum >= 0.16) {
        voiceAccum = 0;
        const basePitch = 175 + Math.random() * 55;
        triggerTone(basePitch, basePitch * 0.92, 0.14, 0.028 * jawOpen, 'triangle');
      }
    }
  }

  function playImpact(strength = 1.0) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const s = Math.max(0.2, Math.min(1.6, strength));
    triggerTone(125 * s, 36, 0.18, 0.16 * s, 'triangle');
    triggerNoise(340, 1.4, 0.14, 0.12 * s, 'lowpass');
  }

  function playSplash(strength = 1.0) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const s = Math.max(0.2, Math.min(1.5, strength));
    triggerNoise(1200, 1.1, 0.28, 0.10 * s, 'bandpass');
    triggerNoise(2400, 1.8, 0.18, 0.05 * s, 'highpass');
  }

  function playWhoosh() {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    triggerNoise(620, 1.3, 0.16, 0.09, 'bandpass');
    triggerTone(240, 110, 0.12, 0.05, 'sine');
  }

  function playFormantPulse(viseme, level = 0.7) {
    if (!ctx || ctx.state !== 'running') return;
    const fMap = { AA: 210, OH: 175, OO: 160, EE: 245, LL: 195, TH: 230, FF: 260, MM: 150 };
    const f0 = fMap[viseme] || 190;
    triggerTone(f0, f0 * 0.94, 0.11, 0.032 * level, 'triangle');
  }

  return {
    setEnabled,
    isEnabled: () => enabled,
    setRadioStation,
    update,
    playImpact,
    playSplash,
    playWhoosh,
    playFormantPulse,
    ensureAudio,
    getContext: () => ctx,
  };
})();

// ---------------------------------------------------------------------------
// Spoken Phrases (Web speechSynthesis + Formant Fallback) & Live Mic Lip-Sync
// ---------------------------------------------------------------------------
const SPOKEN_PHRASES = [
  'Iron lever cracks before the rooster.',
  'Carry the cyan up the ridge with me.',
  'Watch the steep slope with that water.',
  'The basin is filling.',
];

const voiceEngine = (() => {
  let speaking = false;
  let phraseText = '';
  let phraseStartMs = 0;
  let phraseDurMs = 2800;
  let usingSynthFallback = false;
  let fallbackPulseAccum = 0;

  let micActive = false;
  let micStream = null;
  let micCtx = null;
  let micAnalyser = null;
  let micFreqData = null;
  let lastMicViseme = 'SIL';

  function setStatus(msg) {
    const el = $('voiceStatus');
    if (el) el.textContent = msg;
  }

  function stopSpeaking() {
    speaking = false;
    phraseText = '';
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
    const btn = $('btnSpeakPhrase');
    if (btn) btn.classList.remove('live');
  }

  function speakPhrase(idxOrText) {
    const text = typeof idxOrText === 'number'
      ? (SPOKEN_PHRASES[idxOrText] || SPOKEN_PHRASES[0])
      : String(idxOrText || SPOKEN_PHRASES[0]).trim();
    if (!text) return false;

    if (micActive) stopMic();
    stopSpeaking();

    phraseText = text;
    phraseStartMs = performance.now();
    // Estimate natural speaking duration (~14.5 chars/sec, min 1.7s)
    phraseDurMs = Math.max(1700, Math.min(5500, text.length * 72 + 450));
    speaking = true;
    usingSynthFallback = false;
    fallbackPulseAccum = 0;

    const btn = $('btnSpeakPhrase');
    if (btn) btn.classList.add('live');
    setStatus(`Speaking: "${text}"`);

    const hasSynth = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
    if (hasSynth) {
      try {
        const utt = new window.SpeechSynthesisUtterance(text);
        utt.rate = 0.94;
        utt.pitch = 1.04;
        utt.volume = 1.0;
        const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
        const pref = voices.find((v) => /en/i.test(v.lang) && /(samantha|victoria|karen|zira|google us english|natural)/i.test(v.name))
          || voices.find((v) => /en/i.test(v.lang));
        if (pref) utt.voice = pref;
        utt.onstart = () => {
          phraseStartMs = performance.now();
        };
        utt.onend = () => {
          speaking = false;
          if (btn) btn.classList.remove('live');
          setStatus('Voice ready. Click SPEAK PHRASE or MIC LIP-SYNC.');
          if (state.character) state.character.setLyricSpeech('', 0, 0);
        };
        utt.onerror = () => {
          usingSynthFallback = true;
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utt);
      } catch (_) {
        usingSynthFallback = true;
      }
    } else {
      usingSynthFallback = true;
    }

    if (usingSynthFallback) {
      soundEngine.ensureAudio();
    }
    return true;
  }

  async function startMic() {
    if (micActive) return true;
    stopSpeaking();
    const btn = $('btnMicLipSync');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Microphone API unavailable in this browser.');
      return false;
    }
    setStatus('Requesting microphone permission...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      if (ctx.state === 'suspended') await ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.42;
      src.connect(analyser);

      micStream = stream;
      micCtx = ctx;
      micAnalyser = analyser;
      micFreqData = new Uint8Array(analyser.frequencyBinCount);
      micActive = true;
      if (btn) {
        btn.classList.add('live');
        btn.textContent = 'STOP MIC';
      }
      setStatus('MIC LIVE: Speak into your microphone to drive real-time lip-sync.');
      return true;
    } catch (err) {
      stopMic();
      setStatus(`Mic unavailable (${err && err.message ? err.message : 'denied'}).`);
      return false;
    }
  }

  function stopMic() {
    micActive = false;
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    if (micCtx) {
      try { micCtx.close(); } catch (_) {}
      micCtx = null;
    }
    micAnalyser = null;
    micFreqData = null;
    lastMicViseme = 'SIL';
    const btn = $('btnMicLipSync');
    if (btn) {
      btn.classList.remove('live');
      btn.textContent = 'MIC LIP-SYNC';
    }
    if (state.character) state.character.setVisemeShape(0, 0, 0, 0.05, 'SIL');
    setStatus('Voice ready. Click SPEAK PHRASE or MIC LIP-SYNC.');
  }

  function toggleMic() {
    if (micActive) {
      stopMic();
      return Promise.resolve(false);
    }
    return startMic();
  }

  function update(dt, ch) {
    if (!ch) return;

    if (micActive && micAnalyser && micFreqData && micCtx) {
      micAnalyser.getByteFrequencyData(micFreqData);
      const binHz = (micCtx.sampleRate * 0.5) / micFreqData.length;
      const bandAvg = (hzLo, hzHi) => {
        const i0 = Math.max(1, Math.floor(hzLo / binHz));
        const i1 = Math.min(micFreqData.length - 1, Math.ceil(hzHi / binHz));
        let sum = 0;
        let cnt = 0;
        for (let i = i0; i <= i1; i++) {
          sum += micFreqData[i];
          cnt++;
        }
        return cnt > 0 ? sum / (cnt * 255) : 0;
      };

      const lowE = bandAvg(120, 550);   // OH / OO
      const midE = bandAvg(550, 1800);  // AA
      const highE = bandAvg(1800, 4800);// EE / FF
      const totalE = lowE * 0.35 + midE * 0.45 + highE * 0.20;

      if (totalE < 0.045) {
        lastMicViseme = 'SIL';
        ch.setVisemeShape(0, 0, 0, 0.06, 'SIL');
      } else {
        const gain = Math.min(1.0, (totalE - 0.03) * 3.4);
        let jaw = 0.25 * gain;
        let wide = 0.10 * gain;
        let round = 0.05 * gain;
        let press = 0.0;
        if (midE >= lowE * 0.92 && midE >= highE * 1.05) {
          lastMicViseme = 'AA';
          jaw = Math.min(1.0, 0.85 * gain);
          wide = 0.42 * gain;
          round = 0.10 * gain;
        } else if (lowE > midE && lowE >= highE) {
          lastMicViseme = lowE > midE * 1.35 ? 'OO' : 'OH';
          jaw = Math.min(0.85, (lastMicViseme === 'OO' ? 0.42 : 0.70) * gain);
          wide = 0.04 * gain;
          round = Math.min(1.0, 0.92 * gain);
        } else {
          lastMicViseme = highE > midE * 1.4 ? 'FF' : 'EE';
          jaw = Math.min(0.55, (lastMicViseme === 'FF' ? 0.20 : 0.36) * gain);
          wide = Math.min(1.0, 0.88 * gain);
          press = lastMicViseme === 'FF' ? 0.45 * gain : 0.0;
        }
        ch.setVisemeShape(jaw, wide, round, press, lastMicViseme);
      }
      if (state.frameCount % 6 === 0) {
        setStatus(`MIC LIVE | Viseme: ${lastMicViseme} | Level: ${Math.round(totalE * 100)}%`);
      }
      return;
    }

    if (speaking && phraseText) {
      const elapsed = performance.now() - phraseStartMs;
      const p01 = Math.max(0, Math.min(1, elapsed / phraseDurMs));
      const env = p01 < 0.94 ? (0.78 + 0.22 * Math.sin(elapsed * 0.022)) : 0;
      const vis = ch.setLyricSpeech(phraseText, p01, env);
      if (usingSynthFallback && vis && vis.active) {
        fallbackPulseAccum += dt;
        if (fallbackPulseAccum >= 0.13) {
          fallbackPulseAccum = 0;
          soundEngine.playFormantPulse(vis.viseme, env);
        }
      }
      if (elapsed >= phraseDurMs + 180) {
        speaking = false;
        const btn = $('btnSpeakPhrase');
        if (btn) btn.classList.remove('live');
        ch.setLyricSpeech('', 0, 0);
        setStatus('Voice ready. Click SPEAK PHRASE or MIC LIP-SYNC.');
      }
    }
  }

  return {
    speakPhrase,
    stopSpeaking,
    toggleMic,
    stopMic,
    update,
    isSpeaking: () => speaking,
    isMicActive: () => micActive,
  };
})();

// ---------------------------------------------------------------------------
// Interactive Physics & Action System: Articulated Ragdoll Fall,
// Ballistic 20L Cyan Jerrycan Throw + Splash, and Combat Fight / Punch
// ---------------------------------------------------------------------------
const physicsAction = (() => {
  const _eul = new THREE.Euler(0, 0, 0, 'YXZ');
  const _qTmp = new THREE.Quaternion();
  const _vTmp = new THREE.Vector3();

  // Articulated Ragdoll state (-22 m/s^2 gravity, floor bounce, smooth standup)
  const ragdoll = {
    active: false,
    phase: 'idle', // 'fall' | 'settle' | 'recover'
    t: 0,
    pos: new THREE.Vector3(0, 0, 0),
    vel: new THREE.Vector3(0, 0, 0),
    rot: new THREE.Vector3(0, 0, 0),
    angVel: new THREE.Vector3(0, 0, 0),
    bounces: 0,
    limbAngles: {},
    limbVel: {},
    recoverStartPos: new THREE.Vector3(),
    recoverStartRot: new THREE.Vector3(),
  };

  // Thrown 20L cyan jerrycan ballistic rigidbody + splash droplets
  const thrownCanGroup = new THREE.Group();
  thrownCanGroup.name = 'physics_thrown_jerrycan';
  const tShellMat = new THREE.MeshStandardMaterial({
    color: 0x199ab0, roughness: 0.30, metalness: 0.08, transparent: true, opacity: 0.72,
  });
  const tWaterMat = new THREE.MeshStandardMaterial({
    color: 0x28d8f0, emissive: 0x168da3, emissiveIntensity: 0.75, roughness: 0.18, transparent: true, opacity: 0.90,
  });
  const tIronMat = new THREE.MeshStandardMaterial({ color: 0x35373a, roughness: 0.50, metalness: 0.70 });
  const tBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.24), tShellMat);
  tBody.castShadow = true;
  thrownCanGroup.add(tBody);
  const tWater = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.19, 0.21), tWaterMat);
  tWater.position.y = -0.025;
  thrownCanGroup.add(tWater);
  const tHandle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.013, 6, 12, Math.PI), tIronMat);
  tHandle.position.y = 0.14;
  thrownCanGroup.add(tHandle);
  thrownCanGroup.visible = false;
  scene.add(thrownCanGroup);

  // Cyan splash droplet pool (14 droplets, zero per-frame alloc)
  const splashPool = [];
  const dropGeo = new THREE.SphereGeometry(0.024, 8, 6);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(dropGeo, tWaterMat);
    m.visible = false;
    scene.add(m);
    splashPool.push({ mesh: m, vel: new THREE.Vector3(), life: 0, maxLife: 0.65 });
  }

  const throwState = {
    active: false,
    phase: 'idle', // 'windup' | 'flight'
    t: 0,
    launched: false,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    rot: new THREE.Vector3(),
    angVel: new THREE.Vector3(),
    bounces: 0,
  };

  const fightState = {
    active: false,
    t: 0,
    dur: 0.95,
    hitFired: false,
  };

  function setStatus(msg) {
    const el = $('physicsStatus');
    if (el) el.textContent = msg;
  }

  function spawnSplash(x, y, z, power = 1.0) {
    for (let i = 0; i < splashPool.length; i++) {
      const d = splashPool[i];
      const ang = (i / splashPool.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const spd = (1.1 + Math.random() * 1.8) * power;
      d.mesh.position.set(x, Math.max(0.04, y), z);
      d.mesh.scale.setScalar(0.75 + Math.random() * 0.7);
      d.vel.set(Math.cos(ang) * spd, (1.4 + Math.random() * 1.8) * power, Math.sin(ang) * spd);
      d.life = 0.55 + Math.random() * 0.35;
      d.maxLife = d.life;
      d.mesh.visible = true;
    }
    soundEngine.playSplash(power);
  }

  function resetCharacterTransform(ch) {
    if (!ch || !ch.root) return;
    ch.root.position.set(0, 0, 0);
    ch.root.rotation.set(0, 0, 0);
  }

  function triggerRagdoll() {
    const ch = state.character;
    if (!ch) return false;
    fightState.active = false;
    ragdoll.active = true;
    ragdoll.phase = 'fall';
    ragdoll.t = 0;
    ragdoll.bounces = 0;
    ragdoll.pos.set(0, 0.02, 0);
    ragdoll.vel.set((Math.random() - 0.5) * 1.2, 1.35, -2.1);
    ragdoll.rot.set(0, 0, 0);
    ragdoll.angVel.set(-4.6, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2.2);

    const joints = [
      'spine05', 'spine03', 'spine01', 'neck01', 'head',
      'upperarm01l', 'lowerarm01l', 'upperarm01r', 'lowerarm01r',
      'upperleg01l', 'lowerleg01l', 'upperleg01r', 'lowerleg01r',
    ];
    for (const j of joints) {
      ragdoll.limbAngles[j] = [0, 0, 0];
      ragdoll.limbVel[j] = [
        (Math.random() - 0.5) * 5.2,
        (Math.random() - 0.5) * 2.4,
        (Math.random() - 0.5) * 4.4,
      ];
    }
    ch.setExpression('surprised');
    soundEngine.playWhoosh();
    setStatus('RAGDOLL FALL: -22 m/s^2 articulated collapse + floor bounce + recovery.');
    return true;
  }

  function triggerThrowCan() {
    const ch = state.character;
    if (!ch) return false;
    if (ragdoll.active) {
      ragdoll.active = false;
      resetCharacterTransform(ch);
    }
    fightState.active = false;
    throwState.active = true;
    throwState.phase = 'windup';
    throwState.t = 0;
    throwState.launched = false;
    throwState.bounces = 0;
    thrownCanGroup.visible = true;
    ch.setExpression('strain');
    soundEngine.playWhoosh();
    setStatus('THROW CAN: Windup -> ballistic 20L cyan jerrycan launch, bounce & splash.');
    return true;
  }

  function triggerFightPunch() {
    const ch = state.character;
    if (!ch) return false;
    if (ragdoll.active) {
      ragdoll.active = false;
      resetCharacterTransform(ch);
    }
    fightState.active = true;
    fightState.t = 0;
    fightState.hitFired = false;
    ch.setExpression('angry');
    soundEngine.playWhoosh();
    setStatus('FIGHT / PUNCH: 1-2 combat strike choreography + knockback recoil.');
    return true;
  }

  function applyBoneOffset(ch, key, rx, ry, rz, solo) {
    const bone = ch.bonesByNorm.get(key);
    if (!bone) return;
    _eul.set(rx, ry, rz, 'YXZ');
    _qTmp.setFromEuler(_eul);
    if (solo) {
      const rest = ch.restQuats.get(bone.name);
      if (rest) bone.quaternion.copy(rest).multiply(_qTmp);
    } else {
      bone.quaternion.multiply(_qTmp);
    }
  }

  function update(dt, ch) {
    // Update cyan splash droplets
    for (let i = 0; i < splashPool.length; i++) {
      const d = splashPool[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.mesh.visible = false;
        continue;
      }
      d.vel.y -= 14.0 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      if (d.mesh.position.y < 0.02) {
        d.mesh.position.y = 0.02;
        d.vel.y *= -0.3;
        d.vel.x *= 0.6;
        d.vel.z *= 0.6;
      }
      d.mesh.scale.setScalar(Math.max(0.05, (d.life / d.maxLife) * 1.1));
    }

    // 1. Articulated Ragdoll Fall & Smooth Recovery
    if (ragdoll.active && ch) {
      ragdoll.t += dt;
      if (ragdoll.phase === 'fall') {
        const G = -22.0;
        ragdoll.vel.y += G * dt;
        ragdoll.pos.addScaledVector(ragdoll.vel, dt);
        ragdoll.rot.addScaledVector(ragdoll.angVel, dt);
        ragdoll.angVel.multiplyScalar(Math.max(0, 1 - 1.4 * dt));

        // Clamp tilt to horizontal courtyard floor impact (~-1.48 rad back collapse)
        if (ragdoll.rot.x < -1.48) {
          ragdoll.rot.x = -1.48;
          ragdoll.angVel.x = Math.abs(ragdoll.angVel.x) * 0.28;
        }
        const floorY = 0.14;
        if (ragdoll.pos.y <= floorY) {
          ragdoll.pos.y = floorY;
          if (Math.abs(ragdoll.vel.y) > 0.65) {
            ragdoll.vel.y = -ragdoll.vel.y * 0.36;
            ragdoll.vel.x *= 0.65;
            ragdoll.vel.z *= 0.65;
            ragdoll.bounces++;
            soundEngine.playImpact(Math.min(1.3, Math.abs(ragdoll.vel.y) * 0.5));
          } else {
            ragdoll.vel.y = 0;
            ragdoll.vel.x *= Math.max(0, 1 - 7 * dt);
            ragdoll.vel.z *= Math.max(0, 1 - 7 * dt);
          }
        }

        // Integrate articulated joint floppy momentum + anatomical joint limits
        const limits = {
          spine05: [-0.45, 0.55], spine03: [-0.45, 0.55], spine01: [-0.4, 0.5],
          neck01: [-0.55, 0.55], head: [-0.65, 0.65],
          upperarm01l: [-1.1, 1.3], lowerarm01l: [0.05, 1.6],
          upperarm01r: [-1.1, 1.3], lowerarm01r: [0.05, 1.6],
          upperleg01l: [-0.85, 0.9], lowerleg01l: [0.05, 1.45],
          upperleg01r: [-0.85, 0.9], lowerleg01r: [0.05, 1.45],
        };
        for (const k of Object.keys(ragdoll.limbAngles)) {
          const ang = ragdoll.limbAngles[k];
          const vel = ragdoll.limbVel[k];
          const lim = limits[k] || [-0.8, 0.8];
          // Gravity torque pulling limbs toward courtyard floor
          vel[0] += (k.includes('leg') ? -2.8 : 2.2) * dt;
          for (let c = 0; c < 3; c++) {
            vel[c] *= Math.max(0, 1 - 2.6 * dt);
            ang[c] += vel[c] * dt;
          }
          ang[0] = Math.max(lim[0], Math.min(lim[1], ang[0]));
          ang[1] = Math.max(-0.55, Math.min(0.55, ang[1]));
          ang[2] = Math.max(-0.85, Math.min(0.85, ang[2]));
          applyBoneOffset(ch, k, ang[0], ang[1], ang[2], true);
        }

        ch.root.position.copy(ragdoll.pos);
        ch.root.rotation.set(ragdoll.rot.x, ragdoll.rot.y, ragdoll.rot.z);

        if (ragdoll.t >= 2.15) {
          ragdoll.phase = 'recover';
          ragdoll.t = 0;
          ragdoll.recoverStartPos.copy(ragdoll.pos);
          ragdoll.recoverStartRot.copy(ragdoll.rot);
          ch.setExpression('strain');
          setStatus('RAGDOLL FALL: Recovering smoothly back to standing...');
        }
      } else if (ragdoll.phase === 'recover') {
        const u = Math.min(1, ragdoll.t / 1.15);
        const s = u * u * (3 - 2 * u);
        ch.root.position.lerpVectors(ragdoll.recoverStartPos, _vTmp.set(0, 0, 0), s);
        ch.root.rotation.set(
          ragdoll.recoverStartRot.x * (1 - s),
          ragdoll.recoverStartRot.y * (1 - s),
          ragdoll.recoverStartRot.z * (1 - s)
        );
        for (const k of Object.keys(ragdoll.limbAngles)) {
          const ang = ragdoll.limbAngles[k];
          applyBoneOffset(ch, k, ang[0] * (1 - s), ang[1] * (1 - s), ang[2] * (1 - s), true);
        }
        if (u >= 1) {
          ragdoll.active = false;
          ragdoll.phase = 'idle';
          resetCharacterTransform(ch);
          ch.setExpression(state.expression);
          setStatus('Ready: Articulated ragdoll, ballistic 20L jerrycan throw & combat punch.');
        }
      }
    }

    // 2. Throw 20L Cyan Jerrycan (Windup + Ballistic Flight + Bounce + Roll + Splash)
    if (throwState.active && ch) {
      throwState.t += dt;
      if (throwState.phase === 'windup') {
        const w = Math.min(1, throwState.t / 0.28);
        // Windup twist right shoulder & torso back
        applyBoneOffset(ch, 'spine03', -0.14 * w, -0.52 * w, 0, false);
        applyBoneOffset(ch, 'upperarm01r', -1.25 * w, 0, -0.45 * w, false);
        applyBoneOffset(ch, 'lowerarm01r', 0.95 * w, 0, 0, false);
        const wristR = ch.bonesByNorm.get('wristr');
        if (wristR) {
          wristR.getWorldPosition(_vTmp);
          thrownCanGroup.position.set(_vTmp.x, _vTmp.y - 0.05, _vTmp.z + 0.06);
          thrownCanGroup.rotation.set(0.3 * w, -0.4 * w, 0.2 * w);
        }
        if (throwState.t >= 0.28) {
          throwState.phase = 'flight';
          throwState.launched = true;
          throwState.pos.copy(thrownCanGroup.position);
          throwState.vel.set(0.45, 3.6, 5.2);
          throwState.rot.set(0, 0, 0);
          throwState.angVel.set(7.2, 3.1, -4.4);
          soundEngine.playWhoosh();
        }
      } else if (throwState.phase === 'flight') {
        // Follow-through arm extension for first 0.45s after release
        const ft = throwState.t - 0.28;
        if (ft < 0.45) {
          const f = Math.sin((ft / 0.45) * Math.PI);
          applyBoneOffset(ch, 'spine03', 0.18 * f, 0.48 * f, 0, false);
          applyBoneOffset(ch, 'upperarm01r', 0.95 * f, 0, -0.22 * f, false);
          applyBoneOffset(ch, 'lowerarm01r', 0.2 * f, 0, 0, false);
        }
        throwState.vel.y -= 14.5 * dt;
        throwState.pos.addScaledVector(throwState.vel, dt);
        throwState.rot.addScaledVector(throwState.angVel, dt);
        if (throwState.pos.y <= 0.14) {
          throwState.pos.y = 0.14;
          if (Math.abs(throwState.vel.y) > 0.7) {
            const impact = Math.min(1.4, Math.abs(throwState.vel.y) * 0.3);
            throwState.vel.y = -throwState.vel.y * 0.46;
            throwState.vel.x *= 0.76;
            throwState.vel.z *= 0.76;
            throwState.angVel.multiplyScalar(0.72);
            throwState.bounces++;
            soundEngine.playImpact(impact);
            spawnSplash(throwState.pos.x, 0.16, throwState.pos.z, impact);
          } else {
            throwState.vel.y = 0;
            throwState.vel.x *= Math.max(0, 1 - 3.2 * dt);
            throwState.vel.z *= Math.max(0, 1 - 3.2 * dt);
            throwState.angVel.multiplyScalar(Math.max(0, 1 - 3.5 * dt));
          }
        }
        thrownCanGroup.position.copy(throwState.pos);
        thrownCanGroup.rotation.set(throwState.rot.x, throwState.rot.y, throwState.rot.z);
        if (throwState.t >= 3.2) {
          throwState.active = false;
          thrownCanGroup.visible = false;
          ch.setExpression(state.expression);
          setStatus('Ready: Articulated ragdoll, ballistic 20L jerrycan throw & combat punch.');
        }
      }
    }

    // 3. Fight / Punch Choreography + Knockback Impulse
    if (fightState.active && ch) {
      fightState.t += dt;
      const u = Math.min(1, fightState.t / fightState.dur);
      // 0..0.38: Left Jab; 0.38..0.78: Right Cross; 0.78..1.0: Guard Recoil
      let torsoYaw = 0;
      let torsoPitch = 0;
      let lArmX = 0, lElb = 0.95;
      let rArmX = 0, rElb = 0.95;
      let recoilZ = 0;

      if (u < 0.38) {
        const p = Math.sin((u / 0.38) * Math.PI);
        torsoYaw = -0.34 * p;
        torsoPitch = 0.10 * p;
        lArmX = 1.28 * p;
        lElb = 0.95 * (1 - 0.85 * p);
        rArmX = 0.55;
        recoilZ = 0.08 * p;
      } else if (u < 0.78) {
        const p = Math.sin(((u - 0.38) / 0.40) * Math.PI);
        if (!fightState.hitFired && u > 0.54) {
          fightState.hitFired = true;
          soundEngine.playImpact(1.1);
        }
        torsoYaw = 0.52 * p;
        torsoPitch = 0.16 * p;
        rArmX = 1.42 * p;
        rElb = 0.95 * (1 - 0.90 * p);
        lArmX = 0.62;
        recoilZ = 0.14 * p;
      } else {
        const p = 1 - (u - 0.78) / 0.22;
        torsoYaw = 0.12 * p;
        torsoPitch = -0.08 * p;
        lArmX = 0.55 * p;
        rArmX = 0.55 * p;
        recoilZ = -0.10 * Math.sin(p * Math.PI);
      }

      applyBoneOffset(ch, 'spine03', torsoPitch, torsoYaw, 0, false);
      applyBoneOffset(ch, 'spine01', torsoPitch * 0.5, torsoYaw * 0.6, 0, false);
      applyBoneOffset(ch, 'upperarm01l', lArmX, 0, 0.18, false);
      applyBoneOffset(ch, 'lowerarm01l', lElb, 0, 0, false);
      applyBoneOffset(ch, 'upperarm01r', rArmX, 0, -0.18, false);
      applyBoneOffset(ch, 'lowerarm01r', rElb, 0, 0, false);
      ch.root.position.z = recoilZ;

      if (u >= 1) {
        fightState.active = false;
        ch.root.position.z = 0;
        ch.setExpression(state.expression);
        setStatus('Ready: Articulated ragdoll, ballistic 20L jerrycan throw & combat punch.');
      }
    }
  }

  return {
    triggerRagdoll,
    triggerThrowCan,
    triggerFightPunch,
    update,
    isRagdollActive: () => ragdoll.active,
    isThrowActive: () => throwState.active,
    isFightActive: () => fightState.active,
  };
})();

// ---------------------------------------------------------------------------
// State & Loaders
// ---------------------------------------------------------------------------
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
window.MeshoptDecoder = MeshoptDecoder;

const state = {
  castKey: 'adult_f',
  clipName: 'idle',
  speed: 1.0,
  paused: false,
  clothed: true,
  propsOn: true,
  setMode: 'courtyard', // 'courtyard' | 'dark'
  expression: 'neutral',
  wireframe: false,
  showSkeleton: false,
  lockRoot: true,
  character: null,
  skeletonHelper: null,
  // Sapiens tracked video scenes (E1..E4)
  sceneManifest: null,
  activeSceneIdx: 0,
  activeSceneTrack: null,
  sceneTrackCache: new Map(),
  sceneMode: 'off', // 'off' | 'additive' | 'solo'
  scenePlaying: true,
  sceneTime: 0,
  // Live Webcam MediaPipe driver
  webcamActive: false,
  webcamStream: null,
  webcamSample: null,
  // Static Sapiens refs
  refManifest: null,
  refView: 'normal',
  refOverlay: true,
  refIndex: 0,
  refKpCache: new Map(),
  // FPS
  fps: 60,
  frameCount: 0,
  fpsAccum: 0,
  simTime: 0,
};

function applySetMode(mode) {
  state.setMode = mode === 'dark' ? 'dark' : 'courtyard';
  const isCourtyard = state.setMode === 'courtyard';
  courtyardSet.visible = isCourtyard;
  darkGridSet.visible = !isCourtyard;
  scene.background = isCourtyard ? COURTYARD_SKY : DARK_BG;
  scene.fog = isCourtyard ? courtyardFog : darkFog;
  hemiLight.intensity = isCourtyard ? 0.98 : 0.85;
  keyLight.intensity = isCourtyard ? 2.4 : 2.15;
  const btn = $('btnSet');
  if (btn) {
    btn.classList.toggle('on', isCourtyard);
    btn.textContent = isCourtyard ? 'Set: Courtyard' : 'Set: Dark Grid';
  }
}
applySetMode('courtyard');

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

// ---------------------------------------------------------------------------
// Cast & Clip Management (Powered by AnnyHumanV7)
// ---------------------------------------------------------------------------
function autoExpressionForClip(clipId) {
  if (clipId === 'idle-talking' || clipId === 'sitting-talking' || clipId === 'greeting') return 'talking';
  if (clipId === 'walk-happy' || clipId === 'victory' || clipId === 'clapping' || clipId.startsWith('dance')) return 'happy';
  if (clipId === 'angry' || clipId === 'reject') return 'angry';
  if (clipId === 'walk-carry' || clipId === 'push' || clipId === 'rope-pull' || clipId === 'hammering') return 'strain';
  if (clipId === 'confused') return 'surprised';
  return 'neutral';
}

function setExpression(exprKey) {
  state.expression = exprKey;
  if ($('exprSelect')) $('exprSelect').value = exprKey;
  if (state.character) state.character.setExpression(exprKey);
}

async function loadCast(castKey) {
  const info = CAST[castKey];
  if (!info || !window.AnnyHumanV7) return;
  state.castKey = castKey;
  if ($('castSelect')) $('castSelect').value = castKey;
  $('hudStatus').textContent = `Loading ${info.label}...`;

  if (state.skeletonHelper) {
    scene.remove(state.skeletonHelper);
    state.skeletonHelper = null;
  }
  if (state.character) {
    scene.remove(state.character.root);
    state.character.dispose();
    state.character = null;
  }

  const ch = await window.AnnyHumanV7.createCharacter({
    THREE,
    loader: gltfLoader,
    archetype: castKey,
    assetBaseUrl: '../abyssinian-highlands/human-forge/assets',
    clipsBaseUrl: 'mesh2motion/clips',
    clothed: state.clothed,
    groundY: 0.0,
    lockRootMotion: state.lockRoot,
    keepVerticalBounce: true,
    preloadClips: PRELOAD_CLIPS,
    initialClip: state.clipName,
    speed: state.speed,
    wireframe: state.wireframe,
  });

  if (state.paused) ch.pause();
  scene.add(ch.root);
  state.character = ch;

  const metrics = ch.getMetrics();
  const h = Math.max(0.95, metrics ? metrics.height : 1.65);
  controls.target.set(0, h * 0.54, 0);
  camera.position.set(0.32, h * 0.72, h * 1.98);
  controls.update();

  const skel = new THREE.SkeletonHelper(ch.root);
  skel.visible = state.showSkeleton;
  scene.add(skel);
  state.skeletonHelper = skel;

  setExpression(autoExpressionForClip(state.clipName));
  propSystem.syncToClip(state.clipName, ch);

  const cov = ch.getBoneCoverage(state.clipName);
  const covTxt = cov
    ? `${cov.mappedBoneCount}/${cov.totalSourceQuatTracks} bones | hipScale ${cov.hipScale}`
    : 'retargeted';
  $('hudCoverage').textContent = `Anny 104b | ${covTxt}`;
  $('hudStatus').textContent = `${info.label} | ${state.clipName}`;
}

async function selectClip(clipId, fadeDuration = 0.25) {
  state.clipName = clipId;
  const clipWrap = $('clipButtons');
  if (clipWrap) {
    clipWrap.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.clip === clipId));
  }
  if (!state.character) return;
  if (!state.character.hasClip(clipId)) {
    $('hudStatus').textContent = `Loading ${clipId}...`;
    await state.character.loadClip(clipId);
  }
  state.character.crossFadeTo(clipId, fadeDuration);
  if (state.paused) state.character.pause();
  state.character.update(0);
  setExpression(autoExpressionForClip(clipId));
  propSystem.syncToClip(clipId, state.character);
  $('hudStatus').textContent = `${CAST[state.castKey].label} | ${clipId}`;
}

function setClothed(flag) {
  state.clothed = !!flag;
  if (state.character) state.character.setClothed(state.clothed);
  const btn = $('btnClothed');
  if (btn) {
    btn.classList.toggle('on', state.clothed);
    btn.textContent = state.clothed ? 'Clothed V7' : 'Base Mesh';
  }
  return state.clothed;
}

function focusFace() {
  if (!state.character) return;
  state.character.root.updateMatrixWorld(true);
  const head = state.character.bonesByNorm.get('head');
  if (!head) return;
  const p = new THREE.Vector3();
  head.getWorldPosition(p);
  controls.target.set(p.x, p.y - 0.005, p.z);
  camera.position.set(p.x + 0.05, p.y + 0.015, p.z + 0.54);
  controls.update();
}

function focusFullBody() {
  const m = state.character ? state.character.getMetrics() : null;
  const h = Math.max(0.95, m ? m.height : 1.65);
  controls.target.set(0, h * 0.54, 0);
  camera.position.set(0.32, h * 0.72, h * 1.98);
  controls.update();
}

// ---------------------------------------------------------------------------
// Sapiens Tracked Video Scenes (E1..E4) Side-by-Side Playback
// ---------------------------------------------------------------------------
function sampleSceneTrack(track, tSec) {
  if (!track || !track.frames || !track.frames.length) return null;
  const frames = track.frames;
  const dur = Math.max(0.01, track.durationSec || track.duration_sec || frames[frames.length - 1].time || 10);
  const t = ((tSec % dur) + dur) % dur;
  let i = 0;
  while (i < frames.length - 2 && frames[i + 1].time < t) i++;
  const a = frames[i];
  const b = frames[Math.min(i + 1, frames.length - 1)];
  const span = Math.max(1e-4, b.time - a.time);
  const alpha = Math.max(0, Math.min(1, (t - a.time) / span));

  const angles = {};
  for (const k of Object.keys(a.angles || {})) {
    const va = a.angles[k];
    const vb = b.angles ? b.angles[k] : va;
    if (typeof va === 'number' && typeof vb === 'number') {
      angles[k] = va + (vb - va) * alpha;
    }
  }
  const core17 = (a.core17 || []).map((p, idx) => {
    const q = (b.core17 && b.core17[idx]) || p;
    return [
      p[0] + (q[0] - p[0]) * alpha,
      p[1] + (q[1] - p[1]) * alpha,
      p[2] + (q[2] - p[2]) * alpha,
    ];
  });
  return { t, dur, angles, core17 };
}

function drawSceneMiniCanvas(sample) {
  const cv = $('sceneCanvas');
  if (!cv || !sample) return;
  const ctx = cv.getContext('2d');
  const w = cv.width;
  const h = cv.height;
  ctx.fillStyle = '#12100e';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
  ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
  ctx.stroke();

  const pts = sample.core17 || [];
  ctx.strokeStyle = '#28d8f0';
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
    ctx.fillStyle = i <= 4 ? '#f7d694' : '#7dd3fc';
    ctx.beginPath();
    ctx.arc(p[0] * w, p[1] * h, i <= 4 ? 3 : 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

async function selectTrackedScene(idx) {
  if (!state.sceneManifest || !state.sceneManifest.scenes.length) return;
  const sc = state.sceneManifest.scenes[idx] || state.sceneManifest.scenes[0];
  state.activeSceneIdx = idx;
  state.sceneTime = 0;

  let tr = state.sceneTrackCache.get(sc.id);
  if (!tr) {
    tr = await (await fetch(sc.track)).json();
    state.sceneTrackCache.set(sc.id, tr);
  }
  state.activeSceneTrack = tr;

  const vid = $('sceneVideo');
  if (vid && sc.video) {
    vid.src = sc.video;
    vid.currentTime = 0;
    if (state.scenePlaying && state.sceneMode !== 'off') {
      vid.play().catch(() => {});
    }
  }

  $('sceneScrub').max = String(sc.durationSec || 10);
  $('sceneMeta').textContent = `${sc.id}: ${sc.title} | ${sc.sampleCount} kfs | kp ${sc.stats ? sc.stats.meanValidKeypoints : '--'}`;
  const s0 = sampleSceneTrack(tr, 0);
  if (s0) drawSceneMiniCanvas(s0);
}

// ---------------------------------------------------------------------------
// Live Webcam -> Anny V7 Driver (MediaPipe Tasks Vision via CDN, zero API key)
// ---------------------------------------------------------------------------
const webcamDriver = (() => {
  let poseLM = null;
  let faceLM = null;
  let rafId = 0;
  let lastVideoT = -1;

  async function start() {
    const statusEl = $('webcamStatus');
    const vid = $('webcamVideo');
    const btn = $('btnWebcam');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      statusEl.textContent = 'Webcam API unavailable in this browser. Use offline Sapiens MPS via extract_sapiens.py.';
      return false;
    }

    statusEl.textContent = 'Requesting camera permission...';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      state.webcamStream = stream;
      vid.srcObject = stream;
      vid.classList.remove('hidden');
      await vid.play();

      statusEl.textContent = 'Loading MediaPipe Pose + Face Landmarker...';
      const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
      const fileset = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      if (!poseLM) {
        poseLM = await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
      }
      if (!faceLM) {
        faceLM = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          outputFaceBlendshapes: true,
          numFaces: 1,
        });
      }

      state.webcamActive = true;
      btn.classList.add('live');
      btn.textContent = 'STOP WEBCAM';
      statusEl.textContent = 'LIVE: Driving Anny V7 arms, torso, head & mouth openness at 30+ FPS.';
      loop();
      return true;
    } catch (err) {
      stop();
      statusEl.textContent = `Webcam unavailable (${err && err.message ? err.message : 'denied'}). Offline Sapiens MPS remains active.`;
      return false;
    }
  }

  function loop() {
    if (!state.webcamActive) return;
    rafId = requestAnimationFrame(loop);
    const vid = $('webcamVideo');
    if (!vid || vid.readyState < 2 || vid.currentTime === lastVideoT) return;
    lastVideoT = vid.currentTime;
    const ts = performance.now();

    const angles = {
      headYaw: 0, headPitch: 0, headRoll: 0,
      spineYaw: 0, spinePitch: 0, spineRoll: 0,
      leftArmZ: 0, rightArmZ: 0, leftElbowFlex: 0, rightElbowFlex: 0,
      jawOpen: 0,
    };

    if (poseLM) {
      const res = poseLM.detectForVideo(vid, ts);
      if (res && res.landmarks && res.landmarks[0]) {
        const lm = res.landmarks[0];
        const lSh = lm[11], rSh = lm[12], lEl = lm[13], rEl = lm[14], lWr = lm[15], rWr = lm[16], nose = lm[0];
        if (lSh && rSh) {
          const midX = (lSh.x + rSh.x) * 0.5;
          const midY = (lSh.y + rSh.y) * 0.5;
          angles.spineRoll = (lSh.y - rSh.y) * 1.4;
          if (nose) {
            angles.headYaw = (midX - nose.x) * 2.4;
            angles.headPitch = (nose.y - (midY - 0.18)) * 1.8;
          }
          if (lEl) angles.leftArmZ = Math.max(-0.2, Math.min(1.5, (lSh.y - lEl.y + 0.18) * 3.0));
          if (rEl) angles.rightArmZ = Math.max(-0.2, Math.min(1.5, (rSh.y - rEl.y + 0.18) * 3.0));
          if (lEl && lWr) angles.leftElbowFlex = Math.max(0, Math.min(1.5, (lEl.y - lWr.y + 0.1) * 2.6));
          if (rEl && rWr) angles.rightElbowFlex = Math.max(0, Math.min(1.5, (rEl.y - rWr.y + 0.1) * 2.6));
        }
      }
    }

    if (faceLM) {
      const fres = faceLM.detectForVideo(vid, ts);
      if (fres && fres.faceBlendshapes && fres.faceBlendshapes[0]) {
        const cats = fres.faceBlendshapes[0].categories;
        for (let i = 0; i < cats.length; i++) {
          if (cats[i].categoryName === 'jawOpen') {
            angles.jawOpen = cats[i].score;
            break;
          }
        }
      }
    }

    state.webcamSample = { angles };
  }

  function stop() {
    state.webcamActive = false;
    state.webcamSample = null;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (state.webcamStream) {
      state.webcamStream.getTracks().forEach((t) => t.stop());
      state.webcamStream = null;
    }
    const vid = $('webcamVideo');
    if (vid) {
      vid.srcObject = null;
      vid.classList.add('hidden');
    }
    const btn = $('btnWebcam');
    if (btn) {
      btn.classList.remove('live');
      btn.textContent = 'LIVE WEBCAM';
    }
  }

  return { start, stop };
})();

// ---------------------------------------------------------------------------
// Sapiens Static Ref Targets Inspector
// ---------------------------------------------------------------------------
async function renderRefInspector() {
  if (!state.refManifest || !state.refManifest.refs.length) return;
  const ref = state.refManifest.refs[state.refIndex];
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
    ctx.fillStyle = 'rgba(110, 224, 255, 0.72)';
    for (let i = 17; i < kps.length; i++) {
      const p = kps[i];
      if (p[2] > 0.25) ctx.fillRect(dx + p[0] * dw - 1, dy + p[1] * dh - 1, 2, 2);
    }
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
  }
  $('refMeta').textContent = `${ref.width}x${ref.height} | ${ref.valid_keypoints}/308 kps | ${ref.infer_sec}s`;
}

async function loadSapiensManifests() {
  try {
    const [refRes, scenesRes] = await Promise.all([
      fetch('sapiens2/extracted/manifest.json').then((r) => (r.ok ? r.json() : null)),
      fetch('sapiens2/extracted/scenes/manifest.json').then((r) => (r.ok ? r.json() : null)),
    ]);

    if (refRes) {
      state.refManifest = refRes;
      const badge = $('sapiensBadge');
      const isReal = refRes.backend && !refRes.backend.includes('fallback');
      badge.textContent = isReal ? `LIVE | ${refRes.backend}` : `FALLBACK | ${refRes.backend}`;
      badge.className = isReal ? 'badge ok' : 'badge warn';
      $('sapiensDetail').textContent = `${refRes.license} | ${refRes.device}`;

      const refSel = $('refSelect');
      refSel.innerHTML = '';
      refRes.refs.forEach((r, idx) => refSel.add(new Option(r.id.replace(/^ref_0/, '#'), String(idx))));
      await renderRefInspector();
    }

    if (scenesRes && Array.isArray(scenesRes.scenes) && scenesRes.scenes.length) {
      state.sceneManifest = scenesRes;
      const sceneSel = $('sceneSelect');
      sceneSel.innerHTML = '';
      scenesRes.scenes.forEach((sc, idx) => {
        sceneSel.add(new Option(`${sc.id} - ${sc.title}`, String(idx)));
      });
      await selectTrackedScene(0);
    }
  } catch (err) {
    $('sapiensBadge').textContent = 'UNAVAILABLE';
    $('sapiensBadge').className = 'badge warn';
    $('sapiensDetail').textContent = String(err);
  }
}

// ---------------------------------------------------------------------------
// UI Wiring
// ---------------------------------------------------------------------------
function wireUI() {
  const castSel = $('castSelect');
  for (const [k, v] of Object.entries(CAST)) castSel.add(new Option(v.label, k));
  castSel.value = state.castKey;
  castSel.addEventListener('change', () => loadCast(castSel.value));

  const exprSel = $('exprSelect');
  const exprs = (window.AnnyHumanV7 && window.AnnyHumanV7.EXPRESSIONS) || { neutral: { label: 'Neutral' } };
  for (const [k, v] of Object.entries(exprs)) exprSel.add(new Option(v.label, k));
  exprSel.value = state.expression;
  exprSel.addEventListener('change', () => setExpression(exprSel.value));

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

  $('speedSlider').addEventListener('input', (e) => {
    state.speed = parseFloat(e.target.value);
    $('speedVal').textContent = `${state.speed.toFixed(2)}x`;
    if (state.character) state.character.setSpeed(state.speed);
  });

  $('btnPause').addEventListener('click', (e) => {
    state.paused = !state.paused;
    e.target.classList.toggle('on', state.paused);
    e.target.textContent = state.paused ? 'Resume' : 'Pause';
    if (state.character) {
      if (state.paused) state.character.pause();
      else state.character.resume();
    }
  });

  $('btnWire').addEventListener('click', (e) => {
    state.wireframe = !state.wireframe;
    e.target.classList.toggle('on', state.wireframe);
    if (state.character) state.character.setWireframe(state.wireframe);
  });

  $('btnSkel').addEventListener('click', (e) => {
    state.showSkeleton = !state.showSkeleton;
    e.target.classList.toggle('on', state.showSkeleton);
    if (state.skeletonHelper) state.skeletonHelper.visible = state.showSkeleton;
  });

  $('btnRootLock').addEventListener('click', (e) => {
    state.lockRoot = !state.lockRoot;
    e.target.classList.toggle('on', state.lockRoot);
    if (state.character) state.character.setRootMotionLock(state.lockRoot);
  });

  $('btnClothed').addEventListener('click', () => setClothed(!state.clothed));

  $('btnProps').addEventListener('click', (e) => {
    state.propsOn = !state.propsOn;
    e.target.classList.toggle('on', state.propsOn);
    e.target.textContent = state.propsOn ? 'Props: ON' : 'Props: OFF';
    propSystem.setEnabled(state.propsOn, state.character);
  });

  $('btnSet').addEventListener('click', () => {
    applySetMode(state.setMode === 'courtyard' ? 'dark' : 'courtyard');
  });

  $('btnSound').addEventListener('click', (e) => {
    const on = soundEngine.setEnabled(!soundEngine.isEnabled());
    e.target.classList.toggle('on', on);
    e.target.textContent = on ? 'SOUND: ON' : 'SOUND: MUTE';
  });

  document.querySelectorAll('[data-radio]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.radio, 10) || 0;
      document.querySelectorAll('[data-radio]').forEach((b) => b.classList.toggle('on', b === btn));
      soundEngine.setRadioStation(idx);
      if (idx > 0 && $('btnSound')) {
        $('btnSound').classList.add('on');
        $('btnSound').textContent = 'SOUND: ON';
      }
    });
  });

  $('btnFaceCam').addEventListener('click', focusFace);
  $('btnFullCam').addEventListener('click', focusFullBody);

  // Spoken Phrases & Live Microphone Lip-Sync
  const btnSpeak = $('btnSpeakPhrase');
  if (btnSpeak) {
    btnSpeak.addEventListener('click', () => {
      const idx = parseInt($('phraseSelect') ? $('phraseSelect').value : '0', 10) || 0;
      voiceEngine.speakPhrase(idx);
    });
  }
  const btnMic = $('btnMicLipSync');
  if (btnMic) {
    btnMic.addEventListener('click', () => voiceEngine.toggleMic());
  }

  // Interactive Physics & Action buttons
  const btnRag = $('btnRagdoll');
  if (btnRag) btnRag.addEventListener('click', () => physicsAction.triggerRagdoll());
  const btnThrow = $('btnThrowCan');
  if (btnThrow) btnThrow.addEventListener('click', () => physicsAction.triggerThrowCan());
  const btnFight = $('btnFightPunch');
  if (btnFight) btnFight.addEventListener('click', () => physicsAction.triggerFightPunch());

  // Collapsible side drawers for responsive narrow / landscape phone screens
  const appEl = $('app');
  const toggleDrawer = (side) => {
    if (!appEl) return;
    if (side === 'left') appEl.classList.toggle('hide-left');
    else appEl.classList.toggle('hide-right');
    setTimeout(resize, 200);
    resize();
  };
  const btnLeft = $('btnToggleLeft');
  const btnRight = $('btnToggleRight');
  if (btnLeft) btnLeft.addEventListener('click', () => toggleDrawer('left'));
  if (btnRight) btnRight.addEventListener('click', () => toggleDrawer('right'));
  if (appEl && window.innerWidth <= 1120) {
    appEl.classList.add('hide-left', 'hide-right');
    setTimeout(resize, 50);
  }
  window.__toggleDrawer = toggleDrawer;

  // Sapiens Tracked Video Scene controls
  $('sceneSelect').addEventListener('change', (e) => {
    selectTrackedScene(parseInt(e.target.value, 10) || 0);
  });

  document.querySelectorAll('[data-scenemode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.sceneMode = btn.dataset.scenemode;
      document.querySelectorAll('[data-scenemode]').forEach((b) => b.classList.toggle('on', b === btn));
      const vid = $('sceneVideo');
      if (vid) {
        if (state.sceneMode === 'off') vid.pause();
        else if (state.scenePlaying) vid.play().catch(() => {});
      }
      if (state.sceneMode !== 'off' && state.sceneManifest) {
        const sc = state.sceneManifest.scenes[state.activeSceneIdx];
        if (sc && (sc.id === 'E1' || sc.id === 'E4')) setExpression('talking');
      }
    });
  });

  $('btnScenePlay').addEventListener('click', (e) => {
    state.scenePlaying = !state.scenePlaying;
    e.target.textContent = state.scenePlaying ? 'Pause' : 'Play';
    const vid = $('sceneVideo');
    if (vid && state.sceneMode !== 'off') {
      if (state.scenePlaying) vid.play().catch(() => {});
      else vid.pause();
    }
  });

  $('sceneScrub').addEventListener('input', (e) => {
    state.sceneTime = parseFloat(e.target.value) || 0;
    state.scenePlaying = false;
    $('btnScenePlay').textContent = 'Play';
    const vid = $('sceneVideo');
    if (vid) {
      vid.pause();
      if (Number.isFinite(vid.duration) && vid.duration > 0) {
        vid.currentTime = Math.min(vid.duration - 0.01, state.sceneTime);
      }
    }
    const s = sampleSceneTrack(state.activeSceneTrack, state.sceneTime);
    if (s) drawSceneMiniCanvas(s);
  });

  // Live Webcam button
  $('btnWebcam').addEventListener('click', () => {
    if (state.webcamActive) webcamDriver.stop();
    else webcamDriver.start();
  });

  // Static Ref targets
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
}

// ---------------------------------------------------------------------------
// Main Animation Loop (Zero-Alloc, 60+ FPS)
// ---------------------------------------------------------------------------
let lastNow = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;
  state.simTime += dt;

  const ch = state.character;
  const ragActive = physicsAction.isRagdollActive();
  const skipDriver = ragActive || state.sceneMode === 'solo' || state.webcamActive;

  if (ch) {
    if (ch.driver && !skipDriver) ch.driver.update(dt);

    if (!ragActive) {
      if (state.webcamActive && state.webcamSample) {
        ch.applySapiensPose(state.webcamSample, 'solo');
      } else if (state.activeSceneTrack) {
        if (state.scenePlaying && state.sceneMode !== 'off') {
          const vid = $('sceneVideo');
          if (vid && !vid.paused && Number.isFinite(vid.currentTime)) {
            state.sceneTime = vid.currentTime;
          } else {
            state.sceneTime += dt * state.speed;
          }
        }
        const sample = sampleSceneTrack(state.activeSceneTrack, state.sceneTime);
        if (sample) {
          if (state.frameCount % 3 === 0) {
            $('sceneTime').textContent = `${sample.t.toFixed(1)}s / ${sample.dur.toFixed(1)}s`;
            if (state.scenePlaying) $('sceneScrub').value = String(sample.t);
            drawSceneMiniCanvas(sample);
          }
          if (state.sceneMode !== 'off') {
            ch.applySapiensPose(sample, state.sceneMode);
          }
        }
      }
    }

    voiceEngine.update(dt, ch);
    physicsAction.update(dt, ch);
    ch.update(dt, { skipDriver: true, skipGroundPin: ragActive });
    const metrics = ch.getMetrics();
    soundEngine.update(dt, state.clipName, state.speed, state.paused, metrics ? metrics.jawOpen : 0);
  }

  propSystem.update(state.simTime);
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
  setClothed,
  setExpression,
  applySetMode,
  focusFace,
  focusFullBody,
  selectTrackedScene,
  speakPhrase: (v) => voiceEngine.speakPhrase(v),
  toggleMicLipSync: () => voiceEngine.toggleMic(),
  triggerRagdoll: () => physicsAction.triggerRagdoll(),
  triggerThrowCan: () => physicsAction.triggerThrowCan(),
  triggerFightPunch: () => physicsAction.triggerFightPunch(),
  toggleDrawer: (side) => window.__toggleDrawer && window.__toggleDrawer(side),
  getGLContext: () => renderer.getContext(),
  getSummary: () => ({
    v7: true,
    cast: state.castKey,
    clothed: state.clothed,
    setMode: state.setMode,
    propsOn: state.propsOn,
    expression: state.expression,
    clip: state.clipName,
    fps: state.fps,
    sceneMode: state.sceneMode,
    trackedScenes: state.sceneManifest ? state.sceneManifest.scenes.length : 0,
    speaking: voiceEngine.isSpeaking(),
    micActive: voiceEngine.isMicActive(),
    ragdollActive: physicsAction.isRagdollActive(),
    throwActive: physicsAction.isThrowActive(),
    fightActive: physicsAction.isFightActive(),
    metrics: state.character ? state.character.getMetrics() : null,
    bones: state.character ? state.character.bonesByName.size : 0,
    clipsLoaded: state.character ? state.character.getClipNames().length : 0,
    totalClips: CLIPS.length,
    glError: renderer.getContext().getError(),
  }),
};

wireUI();
Promise.all([loadCast(state.castKey), loadSapiensManifests()]).then(() => {
  requestAnimationFrame(animate);
});
