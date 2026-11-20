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
// Real Interactive Clip Props (Jerrycan, Standpipe Pump + Shekla Bowl, Hammer,
// Shovel, Stone Bench, Krar/Guitar)
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
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b472a, roughness: 0.82, metalness: 0.02 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9e8f7a, roughness: 0.92, metalness: 0.02 });

  // 1. 20L glowing #28d8f0 cyan jerrycan (hand-mounted)
  const jerrycan = new THREE.Group();
  const canBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.30, 0.25), canShellMat);
  canBody.position.set(0, -0.18, 0.02);
  canBody.castShadow = true;
  jerrycan.add(canBody);
  const canWater = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.20, 0.22), cyanGlowMat);
  canWater.position.set(0, -0.22, 0.02);
  jerrycan.add(canWater);
  const canHandle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 6, 12, Math.PI), ironMat);
  canHandle.position.set(0, -0.03, 0.02);
  jerrycan.add(canHandle);
  const canCap = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 10), ironMat);
  canCap.position.set(0, -0.02, 0.09);
  jerrycan.add(canCap);

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

  // 3. Hammer + timber post
  const hammer = new THREE.Group();
  const hShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.34, 8), woodMat);
  hShaft.position.set(0, 0.12, 0.04);
  hShaft.rotation.x = Math.PI * 0.45;
  hammer.add(hShaft);
  const hHead = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.115), ironMat);
  hHead.position.set(0, 0.14, 0.21);
  hammer.add(hHead);

  const timberPost = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.88, 10), woodMat);
  timberPost.position.set(0.18, 0.44, 0.56);
  timberPost.castShadow = true;
  timberPost.receiveShadow = true;
  worldProps.add(timberPost);

  // 4. Highland shovel
  const shovel = new THREE.Group();
  const sShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.05, 8), woodMat);
  sShaft.position.set(0, -0.22, 0.05);
  shovel.add(sShaft);
  const sBlade = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.22, 0.016), ironMat);
  sBlade.position.set(0, -0.78, 0.05);
  shovel.add(sBlade);

  // 5. Carved stone bench
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

  // 6. Ethiopian krar / acoustic guitar
  const guitar = new THREE.Group();
  const gBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.08, 16), woodMat);
  gBody.rotation.x = Math.PI * 0.5;
  guitar.add(gBody);
  const gHole = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), ironMat);
  gHole.position.z = 0.042;
  guitar.add(gHole);
  const gNeck = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.48, 0.025), woodMat);
  gNeck.position.set(0.24, 0.12, 0.01);
  gNeck.rotation.z = -Math.PI * 0.38;
  guitar.add(gNeck);

  let enabled = true;
  let activeClip = 'idle';
  let mountedParent = null;
  let mountedProp = null;

  function detachMounted() {
    if (mountedProp && mountedParent) {
      mountedParent.remove(mountedProp);
    }
    mountedProp = null;
    mountedParent = null;
  }

  function syncToClip(clipId, character) {
    activeClip = clipId;
    detachMounted();

    pumpSet.visible = false;
    timberPost.visible = false;
    bench.visible = false;
    if (!enabled || !character) return;

    const wristR = character.bonesByNorm.get('wristr');
    const spineMid = character.bonesByNorm.get('spine03') || character.bonesByNorm.get('spine01');

    if (clipId === 'walk-carry' || clipId === 'farm-watering') {
      if (wristR) {
        jerrycan.position.set(0, -0.02, 0.02);
        wristR.add(jerrycan);
        mountedProp = jerrycan;
        mountedParent = wristR;
      }
    }
    if (clipId === 'dance-arm-pump' || clipId === 'farm-watering' || clipId === 'push' || clipId === 'rope-pull') {
      pumpSet.visible = true;
    }
    if (clipId === 'hammering') {
      timberPost.visible = true;
      if (wristR) {
        wristR.add(hammer);
        mountedProp = hammer;
        mountedParent = wristR;
      }
    }
    if (clipId === 'shovel-dig') {
      if (wristR) {
        wristR.add(shovel);
        mountedProp = shovel;
        mountedParent = wristR;
      }
    }
    if (clipId === 'sitting-idle' || clipId === 'sitting-talking') {
      bench.visible = true;
    }
    if (clipId === 'guitar-playing' && spineMid) {
      guitar.position.set(0.02, 0.04, 0.18);
      guitar.rotation.set(0, 0, -0.25);
      spineMid.add(guitar);
      mountedProp = guitar;
      mountedParent = spineMid;
    }
  }

  function update(tSec) {
    if (!enabled) return;
    if (mountedProp === jerrycan) {
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

  function setEnabled(flag) {
    enabled = !!flag;
    if (enabled && ensureAudio() && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return enabled;
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
        // Gravel/stone footstep thud + subtle cloth swish
        triggerNoise(420 + Math.random() * 140, 1.8, 0.09, isSprint ? 0.11 : 0.075);
        triggerTone(115, 48, 0.08, 0.06, 'triangle');
        triggerNoise(1600, 1.2, 0.14, 0.022, 'highpass');
      }
    }

    // Clip-specific foley
    auxAccum += dt * rate;
    if ((clipId === 'walk-carry' || clipId === 'farm-watering') && auxAccum >= 0.48) {
      auxAccum = 0;
      triggerNoise(680 + Math.random() * 240, 2.4, 0.20, 0.045);
    } else if ((clipId === 'dance-arm-pump' || clipId === 'push') && auxAccum >= 0.65) {
      auxAccum = 0;
      triggerTone(420, 190, 0.11, 0.055, 'square');
      triggerNoise(920, 2.0, 0.16, 0.035);
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

  return { setEnabled, isEnabled: () => enabled, update };
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
  controls.target.set(p.x, p.y + 0.04, p.z);
  camera.position.set(p.x + 0.08, p.y + 0.07, p.z + 0.56);
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

  $('btnFaceCam').addEventListener('click', focusFace);
  $('btnFullCam').addEventListener('click', focusFullBody);

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
  const skipDriver = state.sceneMode === 'solo' || state.webcamActive;

  if (ch) {
    if (ch.driver && !skipDriver) ch.driver.update(dt);

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

    ch.update(dt, { skipDriver: true });
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
