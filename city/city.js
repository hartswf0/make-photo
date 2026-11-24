import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CARTRIDGES, TIME_PRESETS } from './cartridges.js';
import { createHeroOrCastV9, evolveHeroPhenotype } from './hero-build/anny-hero-v9.js';
import {
  ALL_CITY_LOOKS,
  SUITE_TIME_PRESETS,
  hourToTimeKey,
  mountWebGLShaderSuite,
  createWorldPortalAndTripod,
  projectWorldLabel,
  loadPilotState,
  savePilotState,
  subscribePilotState,
  applyPilotUrlHash,
} from './shader-suite-bar.js';

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const wygwylAssets = {
  island: null,
  world: null,
  scenes: null,
  palettes: null,
};

const STORAGE_KEY = 'make_photo_city_nolli_v1';

// ---------------------------------------------------------------------------
// Unified World Ledger + Severn Pilot State (Single Source of Truth)
// ---------------------------------------------------------------------------
const pilotInit = applyPilotUrlHash();

function loadLedger() {
  const fresh = {
    cartridge: 'ahiya',
    timeOfDay: hourToTimeKey(pilotInit.worldTime) || 'bluehour',
    carriedWaterL: 0,
    standpipeReserveL: 40,
    projectorTankL: pilotInit.coolingWet ? 5.0 : 0,
    plates: [],
    windowPlateIds: [null, null, null],
    screenPlateId: null,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw);
    return {
      ...fresh,
      ...parsed,
      plates: Array.isArray(parsed?.plates) ? parsed.plates : [],
      windowPlateIds:
        Array.isArray(parsed?.windowPlateIds) && parsed.windowPlateIds.length === 3
          ? parsed.windowPlateIds
          : [null, null, null],
    };
  } catch {
    return fresh;
  }
}

function saveLedger() {
  try {
    if (ledger.plates.length > 9) {
      ledger.plates = ledger.plates.slice(-9);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // Ignore storage quota errors
  }
}

const ledger = loadLedger();

// ---------------------------------------------------------------------------
// Procedural PBR Textures (Wet Asphalt, Masonry, Chalk Datum, Glow Sprites)
// ---------------------------------------------------------------------------
function makeWetGroundTextures() {
  const size = 512;
  const colC = document.createElement('canvas');
  colC.width = colC.height = size;
  const c = colC.getContext('2d');
  c.fillStyle = '#2d3033';
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 34 + Math.floor(Math.random() * 28);
    c.fillStyle = `rgb(${v},${v + 1},${v + 2})`;
    c.fillRect(x, y, 2, 2);
  }
  c.strokeStyle = 'rgba(12,14,16,0.35)';
  c.lineWidth = 1;
  for (let g = 0; g < size; g += 64) {
    c.beginPath(); c.moveTo(g, 0); c.lineTo(g, size); c.stroke();
    c.beginPath(); c.moveTo(0, g); c.lineTo(size, g); c.stroke();
  }

  const roughC = document.createElement('canvas');
  roughC.width = roughC.height = size;
  const r = roughC.getContext('2d');
  r.fillStyle = '#c8c8c8';
  r.fillRect(0, 0, size, size);
  for (let i = 0; i < 24; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const rad = 24 + Math.random() * 68;
    const grad = r.createRadialGradient(px, py, 2, px, py, rad);
    grad.addColorStop(0, 'rgba(22,22,22,0.92)');
    grad.addColorStop(0.65, 'rgba(60,60,60,0.55)');
    grad.addColorStop(1, 'rgba(200,200,200,0)');
    r.fillStyle = grad;
    r.beginPath();
    r.arc(px, py, rad, 0, Math.PI * 2);
    r.fill();
  }

  const map = new THREE.CanvasTexture(colC);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(14, 14);
  map.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughC);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(14, 14);
  return { map, roughnessMap };
}

function makeMasonryTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8b857c';
  ctx.fillRect(0, 0, 512, 512);
  const rows = 16;
  const cols = 8;
  const rh = 512 / rows;
  const cw = 512 / cols;
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * (cw * 0.5);
    for (let col = -1; col <= cols; col++) {
      const shade = 112 + Math.floor(Math.random() * 34);
      ctx.fillStyle = `rgb(${shade},${shade - 3},${shade - 7})`;
      ctx.fillRect(col * cw + offset + 2, row * rh + 2, cw - 4, rh - 4);
    }
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = 'rgba(24,22,20,0.08)';
    ctx.fillRect(Math.random() * 512, 0, 2 + Math.random() * 5, 512);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlowSpriteTexture(colorHex) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, colorHex);
  g.addColorStop(0.35, colorHex + '88');
  g.addColorStop(1, colorHex + '00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeChalkDatumTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 96);
  ctx.strokeStyle = 'rgba(216, 243, 255, 0.85)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.beginPath();
  ctx.moveTo(8, 56);
  ctx.lineTo(248, 56);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(235, 244, 248, 0.88)';
  ctx.font = '600 18px Inter, system-ui, sans-serif';
  ctx.fillText('+4.00 m SALT DATUM', 20, 42);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Scene, Renderer, Camera & 23-Shader Diegetic Suite
// ---------------------------------------------------------------------------
const wrap = document.getElementById('canvas-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#233447');
scene.fog = new THREE.FogExp2('#35485c', 0.0068);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.12, 260);
scene.add(camera);

const suite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: pilotInit.shader || 'weave',
  defaultTime: ledger.timeOfDay,
  locationName: 'Severn Nolli Block',
  cartridgeName: 'Ahiya',
  autoIntercept: false,
  captureOnSpace: false,
  onTimeChange: (timeKey) => {
    if (TIME_PRESETS[timeKey] && ledger.timeOfDay !== timeKey) {
      ledger.timeOfDay = timeKey;
      applyCartridgeAndTime();
    }
  },
});

const audio = suite.audio;

// Lights (Physical Three.js r155+ intensities)
const hemiLight = new THREE.HemisphereLight('#c4dcf0', '#3d3934', 1.25);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#ffd6a6', 2.4);
sunLight.position.set(28, 36, 28);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 2;
sunLight.shadow.camera.far = 130;
const dShadow = 48;
sunLight.shadow.camera.left = -dShadow;
sunLight.shadow.camera.right = dShadow;
sunLight.shadow.camera.top = dShadow;
sunLight.shadow.camera.bottom = -dShadow;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

const shopLight = new THREE.PointLight('#ffcf91', 38.0, 22, 1.5);
shopLight.position.set(0, 3.6, 1.2);
scene.add(shopLight);

const hallLight = new THREE.PointLight('#ffd6a1', 34.0, 22, 1.5);
hallLight.position.set(0, 8.2, -1.5);
scene.add(hallLight);

const lightwellSpot = new THREE.SpotLight('#9cdfff', 55.0, 26, Math.PI * 0.34, 0.6, 1.2);
lightwellSpot.position.set(0, 11.2, -0.5);
lightwellSpot.target.position.set(0, 0, -0.5);
scene.add(lightwellSpot, lightwellSpot.target);

// --- GLSL CERULEAN-COBALT GRADIENT SKY DOME ---
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uTop: { value: new THREE.Color('#0c1f38') },
    uMid: { value: new THREE.Color('#2c6294') },
    uHorizon: { value: new THREE.Color('#6f93b0') },
  },
  vertexShader: `
    varying vec3 vWorldPos;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform vec3 uTop, uMid, uHorizon;
    varying vec3 vWorldPos;
    void main() {
      float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);
      vec3 col = h < 0.28 ? mix(uHorizon, uMid, h / 0.28) : mix(uMid, uTop, (h - 0.28) / 0.72);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(210, 24, 16), skyMat);
scene.add(skyDome);

// --- MONUMENTAL ATLANTIS / AHIYA PARABOLIC RELAY DISH SILHOUETTE ---
const dishGroup = new THREE.Group();
dishGroup.position.set(6, 0, -32);
const dishDarkMat = new THREE.MeshStandardMaterial({ color: '#1b2736', roughness: 0.78, metalness: 0.35 });
const dishPedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.4, 24, 10), dishDarkMat);
dishPedestal.position.y = 12;
dishGroup.add(dishPedestal);

const dishTilt = new THREE.Group();
dishTilt.position.set(0, 26.0, 0);
dishTilt.rotation.set(0.55, -0.32, 0.18);
const dishPts = [];
for (let i = 0; i <= 12; i++) {
  const t = i / 12;
  dishPts.push(new THREE.Vector2(t * 14.5, t * t * 4.4));
}
const dishBowl = new THREE.Mesh(
  new THREE.LatheGeometry(dishPts, 28),
  new THREE.MeshStandardMaterial({ color: '#243547', roughness: 0.65, metalness: 0.42, side: THREE.DoubleSide })
);
dishTilt.add(dishBowl);
const feedMast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 9.5, 8), dishDarkMat);
feedMast.position.y = 4.8;
dishTilt.add(feedMast);
const feedTip = new THREE.Mesh(
  new THREE.SphereGeometry(0.75, 14, 12),
  new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 2.2 })
);
feedTip.position.y = 9.6;
dishTilt.add(feedTip);
dishGroup.add(dishTilt);
scene.add(dishGroup);

const puddleMagLight = new THREE.PointLight('#e856c8', 24.0, 14, 1.6);
puddleMagLight.position.set(-3.2, 1.4, 12.2);
scene.add(puddleMagLight);

// ---------------------------------------------------------------------------
// Shared Materials
// ---------------------------------------------------------------------------
const groundTex = makeWetGroundTextures();
const masonryTex = makeMasonryTexture();

const mats = {
  asphalt: new THREE.MeshStandardMaterial({
    color: '#2d3033',
    map: groundTex.map,
    roughnessMap: groundTex.roughnessMap,
    roughness: 0.72,
    metalness: 0.12,
  }),
  sidewalk: new THREE.MeshStandardMaterial({
    color: '#5a5852',
    roughness: 0.82,
    metalness: 0.05,
  }),
  masonryExt: new THREE.MeshStandardMaterial({
    color: '#6d665c',
    map: masonryTex,
    roughness: 0.86,
    metalness: 0.04,
    transparent: false,
    opacity: 1.0,
  }),
  masonryInt: new THREE.MeshStandardMaterial({
    color: '#8f887d',
    roughness: 0.88,
    metalness: 0.02,
  }),
  trim: new THREE.MeshStandardMaterial({
    color: '#8f8472',
    roughness: 0.65,
    metalness: 0.15,
  }),
  brass: new THREE.MeshStandardMaterial({
    color: '#d8ab61',
    roughness: 0.28,
    metalness: 0.84,
    emissive: '#3a280e',
    emissiveIntensity: 0.16,
  }),
  oakDoor: new THREE.MeshStandardMaterial({
    color: '#462c1b',
    roughness: 0.58,
    metalness: 0.12,
  }),
  floorInt: new THREE.MeshStandardMaterial({
    color: '#4f4c46',
    roughness: 0.55,
    metalness: 0.08,
  }),
  glass: new THREE.MeshPhysicalMaterial({
    color: '#a8cbe0',
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.34,
  }),
  cyanActive: new THREE.MeshStandardMaterial({
    color: '#18b4ff',
    emissive: '#18b4ff',
    emissiveIntensity: 1.4,
    roughness: 0.25,
    metalness: 0.2,
  }),
  cyanIdle: new THREE.MeshStandardMaterial({
    color: '#2c4652',
    emissive: '#18b4ff',
    emissiveIntensity: 0.12,
    roughness: 0.4,
    metalness: 0.3,
  }),
  foliage: new THREE.MeshStandardMaterial({
    color: '#3c4c38',
    roughness: 0.9,
  }),
  trunk: new THREE.MeshStandardMaterial({
    color: '#42362c',
    roughness: 0.92,
  }),
  windowGlow: new THREE.MeshStandardMaterial({
    color: '#ffcf8f',
    emissive: '#ffb866',
    emissiveIntensity: 0.85,
    roughness: 0.3,
  }),
  gateSolid: new THREE.MeshStandardMaterial({
    color: '#353a3e',
    roughness: 0.55,
    metalness: 0.65,
    transparent: true,
    opacity: 0.96,
  }),
  xrayWire: new THREE.MeshBasicMaterial({
    color: '#18b4ff',
    wireframe: true,
    transparent: true,
    opacity: 0.0,
  }),
  hitInvisible: new THREE.MeshBasicMaterial({ visible: false }),
};

// ---------------------------------------------------------------------------
// Physical 3D Cyan Jerrycan in Hand / at Hip (First-Person Diegetic Carrier)
// ---------------------------------------------------------------------------
const playerJerrycan = new THREE.Group();
playerJerrycan.position.set(0.36, -0.35, -0.62);
playerJerrycan.rotation.set(0.12, -0.38, 0.05);
playerJerrycan.visible = ledger.carriedWaterL > 0.05;

const jerryShellMat = new THREE.MeshPhysicalMaterial({
  color: '#67d4ff',
  emissive: '#0c5278',
  emissiveIntensity: 0.35,
  roughness: 0.22,
  metalness: 0.05,
  transparent: true,
  opacity: 0.52,
});
const jerryBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.13), jerryShellMat);
playerJerrycan.add(jerryBody);

const jerryLiquid = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.22, 0.105), mats.cyanActive);
jerryLiquid.position.set(0, -0.01, 0);
playerJerrycan.add(jerryLiquid);

const jerryHandle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.03), mats.brass);
jerryHandle.position.set(-0.015, 0.145, 0);
playerJerrycan.add(jerryHandle);

const jerryCap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.035, 10), mats.brass);
jerryCap.position.set(0.052, 0.142, 0);
jerryCap.rotation.z = -0.22;
playerJerrycan.add(jerryCap);

camera.add(playerJerrycan);

// ---------------------------------------------------------------------------
// World Geometry: Ground, Streets, Hero Severn Nolli Building, Props
// ---------------------------------------------------------------------------
const colliders = [];
function addBox(w, h, d, x, y, z, mat, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  scene.add(m);
  if (opts.collide !== false) {
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      minY: y - h / 2,
      maxY: y + h / 2,
      tag: opts.tag || 'wall',
      active: true,
    });
  }
  return m;
}

const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), mats.asphalt);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Sidewalk apron around Hero Building & Courtyard
addBox(26, 0.16, 22, 0, 0.08, 2, mats.sidewalk, { collide: false, cast: false });
addBox(12, 0.16, 20, -14, 0.08, -14, mats.sidewalk, { collide: false, cast: false });

// --- HERO BUILDING: "Severn Nolli House" ---
const exteriorShellMeshes = [];
function addExtWall(w, h, d, x, y, z, collide = true) {
  const m = addBox(w, h, d, x, y, z, mats.masonryExt, { collide, tag: 'hero-wall' });
  exteriorShellMeshes.push(m);
  return m;
}

addBox(18, 0.18, 14, 0, 0.09, 0, mats.floorInt, { collide: false, cast: false });

// South Facade (z = +7) with central arched doorway (x: -2.4..2.4, y: 0..3.8)
addExtWall(6.6, 9.2, 0.45, -5.7, 4.6, 7.0, true);
addExtWall(6.6, 9.2, 0.45, 5.7, 4.6, 7.0, true);
addExtWall(4.8, 5.4, 0.45, 0, 6.5, 7.0, false);
addBox(5.2, 0.22, 0.62, 0, 3.85, 7.0, mats.trim, { collide: false });

// Chalked +4.00m Salt Flood Datum etched on South Facade beside Severn Doorway
const datumPlaque = new THREE.Mesh(
  new THREE.PlaneGeometry(1.75, 0.65),
  new THREE.MeshBasicMaterial({ map: makeChalkDatumTexture(), transparent: true, depthWrite: false })
);
datumPlaque.position.set(3.35, 3.95, 7.25);
scene.add(datumPlaque);

// --- PHYSICAL 3D HINGED SEVERN DOUBLE DOORS (Click in 3D to Open/Close) ---
let doorOpen = pilotInit.doorOpen !== false;
const severnDoorCollider = {
  minX: -2.4,
  maxX: 2.4,
  minZ: 6.72,
  maxZ: 7.36,
  minY: 0,
  maxY: 3.8,
  tag: 'severn-door',
  active: !doorOpen,
};
colliders.push(severnDoorCollider);

// Stone doorway jambs & brass threshold bar
addBox(0.22, 3.8, 0.56, -2.36, 1.9, 7.02, mats.trim, { collide: false });
addBox(0.22, 3.8, 0.56, 2.36, 1.9, 7.02, mats.trim, { collide: false });
addBox(4.6, 0.05, 0.34, 0, 0.19, 7.04, mats.brass, { collide: false });

function buildSevernDoorLeaf(sideSign) {
  const pivot = new THREE.Group();
  pivot.position.set(sideSign * 2.26, 0.18, 7.04);

  const leafW = 2.24;
  const leafH = 3.58;
  const cx = -sideSign * (leafW * 0.5);

  const stiles = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.09), mats.oakDoor);
  stiles.position.set(cx, leafH * 0.5, 0);
  stiles.castShadow = true;
  pivot.add(stiles);

  // Glazed upper transom window inset in door leaf
  const upperPane = new THREE.Mesh(new THREE.BoxGeometry(leafW * 0.72, 1.32, 0.11), mats.glass);
  upperPane.position.set(cx, 2.58, 0);
  pivot.add(upperPane);

  // Brass kickplate & vertical pull handle
  const kick = new THREE.Mesh(new THREE.BoxGeometry(leafW * 0.88, 0.28, 0.11), mats.brass);
  kick.position.set(cx, 0.22, 0);
  pivot.add(kick);

  const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.48, 10), mats.brass);
  pull.position.set(-sideSign * (leafW - 0.18), 1.18, 0.09);
  pivot.add(pull);

  const pullBack = pull.clone();
  pullBack.position.z = -0.09;
  pivot.add(pullBack);

  scene.add(pivot);
  return { pivot, leafMesh: stiles };
}

const doorLeafL = buildSevernDoorLeaf(-1);
const doorLeafR = buildSevernDoorLeaf(1);
doorLeafL.pivot.rotation.y = doorOpen ? 1.34 : 0.0;
doorLeafR.pivot.rotation.y = doorOpen ? -1.34 : 0.0;

// North, West, East exterior walls
addExtWall(18.0, 9.2, 0.45, 0, 4.6, -7.0, true);
addExtWall(0.45, 9.2, 14.0, -9.0, 4.6, 0, true);
addExtWall(0.45, 9.2, 14.0, 9.0, 4.6, 0, true);

// Upper Floor Slab (y = 4.6) with Lightwell opening & Stair cutouts
addBox(18.0, 0.24, 4.8, 0, 4.5, -4.6, mats.floorInt, { collide: false });
addBox(18.0, 0.24, 4.8, 0, 4.5, 4.6, mats.floorInt, { collide: false });
addBox(6.6, 0.24, 4.4, -5.7, 4.5, 0, mats.floorInt, { collide: false });
addBox(3.6, 0.24, 4.4, 4.2, 4.5, 0, mats.floorInt, { collide: false });

// Rooftop Overlook Slab (y = 9.2) with Glass Skylight Dome
addBox(18.2, 0.28, 4.9, 0, 9.1, -4.6, mats.sidewalk, { collide: false });
addBox(18.2, 0.28, 4.9, 0, 9.1, 4.6, mats.sidewalk, { collide: false });
addBox(6.7, 0.28, 4.4, -5.75, 9.1, 0, mats.sidewalk, { collide: false });
addBox(6.7, 0.28, 4.4, 5.75, 9.1, 0, mats.sidewalk, { collide: false });
const skylight = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.45, 4.6), mats.glass);
skylight.position.set(0, 9.45, 0);
scene.add(skylight);
addBox(18.2, 1.0, 0.35, 0, 9.7, -7.0, mats.trim, { collide: false });
addBox(18.2, 1.0, 0.35, 0, 9.7, 7.0, mats.trim, { collide: false });
addBox(0.35, 1.0, 14.0, -9.0, 9.7, 0, mats.trim, { collide: false });
addBox(0.35, 1.0, 14.0, 9.0, 9.7, 0, mats.trim, { collide: false });

// Walkable Ramps / Stairways
const stair1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 11.2), mats.trim);
stair1.position.set(7.4, 2.3, -0.5);
stair1.rotation.x = Math.atan2(4.6, 10.0);
stair1.receiveShadow = true;
scene.add(stair1);

const stair2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 11.2), mats.trim);
stair2.position.set(-7.4, 6.9, -0.5);
stair2.rotation.x = -Math.atan2(4.6, 10.0);
stair2.receiveShadow = true;
scene.add(stair2);

// X-Ray Inverse-Tomology Wireframe Shell & Cyan Conduits
const xrayGroup = new THREE.Group();
const xrayBox = new THREE.Mesh(new THREE.BoxGeometry(18.2, 9.3, 14.2), mats.xrayWire);
xrayBox.position.set(0, 4.65, 0);
xrayGroup.add(xrayBox);
scene.add(xrayGroup);

const conduitMat = mats.cyanIdle.clone();
const conduitSegments = [
  [[-16, 0.25, 14], [-16, 0.25, 8]],
  [[-16, 0.25, 8], [-9.2, 0.25, 2]],
  [[-9.2, 0.25, 2], [-9.2, 5.2, 2]],
  [[-9.2, 5.2, 2], [-1.8, 5.2, 1.2]],
  [[-1.8, 5.2, 1.2], [-6.5, 9.4, 4.5]],
];
conduitSegments.forEach(([a, b]) => {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dist = va.distanceTo(vb);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, dist, 8), conduitMat);
  cyl.position.copy(va).add(vb).multiplyScalar(0.5);
  cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  scene.add(cyl);
});

// --- GROUND FLOOR PROPS: 3 Storefront Window Frames (Clickable in 3D) ---
const WEAVE_ARCHIVE_URLS = [
  'https://hartswf0.github.io/wygwyl-world-arch/shots/out/05a0677a-e3e8-49d1-a313-eb729b649cad_3/cartoon/cel.png',
  'https://hartswf0.github.io/wygwyl-world-arch/shots/out/646ab0f0-8950-495f-9f61-f2db42db81ce_0/image.jpg',
  'https://hartswf0.github.io/wygwyl-world-arch/shots/out/bdc7d6ec-1d4e-4f99-ad7e-9917394c542a_2/image.jpg',
];
const archiveTextures = [null, null, null];
const archiveTexLoader = new THREE.TextureLoader();
archiveTexLoader.setCrossOrigin('anonymous');

const windowFrames = [];
const windowFrameX = [-5.8, -3.9, 5.4];
windowFrameX.forEach((wx, idx) => {
  addBox(1.65, 1.2, 0.14, wx, 1.9, 7.26, mats.trim, { collide: false });
  const printMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.35,
    emissive: '#3a4a58',
    emissiveIntensity: 0.42,
    side: THREE.DoubleSide,
  });
  archiveTexLoader.load(WEAVE_ARCHIVE_URLS[idx], (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    archiveTextures[idx] = tex;
    if (!windowFrames[idx].loadedId) {
      printMat.map = tex;
      printMat.emissiveMap = tex;
      printMat.needsUpdate = true;
    }
  });
  const printMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.98), printMat);
  printMesh.position.set(wx, 1.9, 7.34);
  scene.add(printMesh);
  windowFrames.push({ index: idx, wx, mesh: printMesh, mat: printMat, archiveCycle: idx, loadedId: null });
});

// --- GROUND FLOOR: 3D Archive Light Table with Physical Contact-Sheet Prints ---
addBox(2.4, 0.92, 1.4, 4.0, 0.46, -1.8, mats.trim, { collide: true, tag: 'prop' });
const lightTableGlass = new THREE.Mesh(
  new THREE.PlaneGeometry(2.1, 1.15),
  new THREE.MeshStandardMaterial({
    color: '#d8f3ff',
    emissive: '#8ad8ff',
    emissiveIntensity: 0.92,
    roughness: 0.2,
  })
);
lightTableGlass.rotation.x = -Math.PI / 2;
lightTableGlass.position.set(4.0, 0.94, -1.8);
scene.add(lightTableGlass);

// 6 physical miniature 8x10 contact prints resting directly on the 3D Light Table
const lightTableSlots = [];
for (let sIdx = 0; sIdx < 6; sIdx++) {
  const col = sIdx % 3;
  const row = Math.floor(sIdx / 3);
  const slotMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#4b687a',
    emissiveIntensity: 0.55,
    roughness: 0.28,
  });
  const slotMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.38), slotMat);
  slotMesh.rotation.x = -Math.PI / 2;
  slotMesh.position.set(4.0 + (col - 1) * 0.66, 0.952, -1.8 + (row - 0.5) * 0.48);
  scene.add(slotMesh);
  lightTableSlots.push({ mesh: slotMesh, mat: slotMat, loadedKey: null, plateId: null });
}

// --- UPPER FLOOR PROPS: 35mm Projector, Cyan Cooling Sight-Glass & Linen Sheet ---
addBox(1.1, 1.1, 1.1, -1.8, 5.15, 1.2, mats.trim, { collide: false });
const projectorLens = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.55, 12), mats.brass);
projectorLens.rotation.x = Math.PI / 2;
projectorLens.position.set(-1.8, 5.65, 0.55);
scene.add(projectorLens);

const sightGlassShell = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.35, 14), mats.glass);
sightGlassShell.position.set(-0.9, 5.3, 1.2);
scene.add(sightGlassShell);

// Brass sight-glass top & bottom collars
addBox(0.56, 0.08, 0.56, -0.9, 6.0, 1.2, mats.brass, { collide: false });
addBox(0.56, 0.08, 0.56, -0.9, 4.62, 1.2, mats.brass, { collide: false });

const sightGlassLiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 1.25, 14), mats.cyanActive);
sightGlassLiquid.position.set(-0.9, 4.7, 1.2);
sightGlassLiquid.scale.y = 0.02;
scene.add(sightGlassLiquid);

// Stretched Linen Screening Sheet (North wall of upper floor, z = -6.42)
addBox(7.2, 4.1, 0.12, 0, 6.85, -6.5, mats.trim, { collide: false });
const screenMat = new THREE.MeshStandardMaterial({
  color: '#e8e4da',
  emissive: '#18242e',
  emissiveIntensity: 0.2,
  roughness: 0.85,
});
const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 3.7), screenMat);
screenMesh.position.set(0, 6.85, -6.42);
scene.add(screenMesh);

const projectorBeamLight = new THREE.SpotLight('#c7eeff', 0.0, 14, Math.PI * 0.25, 0.5, 1.2);
projectorBeamLight.position.set(-1.8, 5.7, 0.5);
projectorBeamLight.target.position.set(0, 6.85, -6.4);
scene.add(projectorBeamLight, projectorBeamLight.target);

// --- ROOFTOP RELAY MAST (y = 9.2) ---
const relayMast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.6, 10), mats.trim);
relayMast.position.set(-6.5, 11.0, 4.5);
scene.add(relayMast);
const relayBeaconMat = mats.cyanIdle.clone();
const relayBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), relayBeaconMat);
relayBeacon.position.set(-6.5, 12.9, 4.5);
scene.add(relayBeacon);
const relayPointLight = new THREE.PointLight('#18b4ff', 0.2, 18, 1.5);
relayPointLight.position.set(-6.5, 13.0, 4.5);
scene.add(relayPointLight);

// --- 3D STANDPIPE SIGHT-GLASS DEPOT (x = -16, z = 14) ---
addBox(2.2, 0.25, 2.2, -16, 0.12, 14, mats.trim, { collide: false });
const depotTank = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.2, 16), mats.glass);
depotTank.position.set(-16, 1.35, 14);
scene.add(depotTank);
const depotWater = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 2.0, 16), mats.cyanActive);
depotWater.position.set(-16, 1.25, 14);
scene.add(depotWater);

// Brass gauge rings + handwheel + spigot on Standpipe Sight-Glass
[0.55, 1.05, 1.55, 2.05].forEach((ry) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.635, 0.022, 8, 20), mats.brass);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(-16, ry, 14);
  scene.add(ring);
});
const standpipeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.12, 16), mats.brass);
standpipeCap.position.set(-16, 2.48, 14);
scene.add(standpipeCap);
const standpipeWheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 8, 16), mats.brass);
standpipeWheel.rotation.x = Math.PI / 2;
standpipeWheel.position.set(-16, 2.68, 14);
scene.add(standpipeWheel);
const standpipeSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 10), mats.brass);
standpipeSpout.rotation.x = Math.PI / 2.4;
standpipeSpout.position.set(-16, 0.95, 14.72);
scene.add(standpipeSpout);

const depotLight = new THREE.PointLight('#18b4ff', 28.0, 16, 1.5);
depotLight.position.set(-16, 2.6, 14);
scene.add(depotLight);

// --- OPTICAL THRESHOLD GATE (MONOLITH III Rule, x = -14, z = -7) ---
const gateGroup = new THREE.Group();
gateGroup.position.set(-14, 0, -7);
for (let i = -4; i <= 4; i++) {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.2, 0.16), mats.gateSolid);
  bar.position.set(i * 1.1, 2.1, 0);
  gateGroup.add(bar);
}
const gateCross = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.24, 0.24), mats.gateSolid);
gateCross.position.set(0, 3.8, 0);
gateGroup.add(gateCross);
scene.add(gateGroup);

const gateCollider = {
  minX: -19.0,
  maxX: -9.0,
  minZ: -7.5,
  maxZ: -6.5,
  minY: 0,
  maxY: 4.5,
  tag: 'threshold-gate',
  active: true,
};
colliders.push(gateCollider);

// Hidden Courtyard Cistern behind the Threshold Gate (x = -14, z = -16)
const cisternPool = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.45, 20), mats.trim);
cisternPool.position.set(-14, 0.25, -16);
scene.add(cisternPool);
const cisternWater = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.5, 20), mats.cyanActive);
cisternWater.position.set(-14, 0.28, -16);
scene.add(cisternWater);

// --- ISLAND PENINSULA WATERFRONT (Canal Quay + Shimmering Water + Bollards) ---
const canalMat = new THREE.MeshStandardMaterial({
  color: '#15394a',
  roughness: 0.14,
  metalness: 0.45,
  emissive: '#071b26',
  emissiveIntensity: 0.35,
});
const canalSouth = new THREE.Mesh(new THREE.PlaneGeometry(180, 56), canalMat);
canalSouth.rotation.x = -Math.PI / 2;
canalSouth.position.set(0, -0.35, 56);
canalSouth.receiveShadow = true;
scene.add(canalSouth);

const canalWest = new THREE.Mesh(new THREE.PlaneGeometry(56, 180), canalMat);
canalWest.rotation.x = -Math.PI / 2;
canalWest.position.set(-64, -0.35, 0);
canalWest.receiveShadow = true;
scene.add(canalWest);

addBox(88, 0.85, 1.2, 4, 0.18, 28.0, mats.trim, { collide: true, tag: 'quay' });
for (let bx = -32; bx <= 36; bx += 11) {
  const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.72, 10), mats.trim);
  bollard.position.set(bx, 0.82, 28.0);
  bollard.castShadow = true;
  scene.add(bollard);
}

// --- SURROUNDING NEIGHBORHOOD BLOCKS ---
const neighborSpecs = [
  [-26, 7.5, -10, 14, 15, 18],
  [24, 8.5, -8, 14, 17, 16],
  [25, 6.5, 14, 14, 13, 12],
  [-30, 8.0, 20, 14, 16, 12],
  [0, 7.0, -28, 22, 14, 12],
  [18, 10.5, -30, 14, 21, 12],
];
const neighborMat = mats.masonryExt.clone();
neighborSpecs.forEach(([x, y, z, w, h, d], bIdx) => {
  addBox(w, h, d, x, y, z, neighborMat, { collide: true, tag: 'neighbor' });
  addBox(w + 0.7, 0.55, d + 0.7, x, h + 0.25, z, mats.trim, { collide: false });
  addBox(w * 0.72, 0.18, 1.6, x, 3.3, z + d / 2 + 0.75, mats.trim, { collide: false });
  if (bIdx % 2 === 0) {
    const wtLegs = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.25, 2.2, 6, 1, true), mats.trim);
    wtLegs.position.set(x - w * 0.2, h + 1.2, z);
    scene.add(wtLegs);
    const wtTank = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 2.6, 12), mats.trunk);
    wtTank.position.set(x - w * 0.2, h + 3.4, z);
    wtTank.castShadow = true;
    scene.add(wtTank);
    const wtRoof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.0, 12), mats.trim);
    wtRoof.position.set(x - w * 0.2, h + 5.2, z);
    scene.add(wtRoof);
  }
  for (let wy = 4.6; wy < h - 1.5; wy += 3.1) {
    for (let wx = -w * 0.32; wx <= w * 0.32; wx += 3.2) {
      if ((Math.abs(Math.floor(wx + wy + bIdx)) % 3) !== 0) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), mats.windowGlow);
        win.position.set(x + wx, wy, z + d / 2 + 0.04);
        scene.add(win);
      }
    }
  }
});

// --- REAL WYGWYL ISLAND EXTRUDED BUILDINGS & SURVEYED ROADS ---
const wygwylCityGroup = new THREE.Group();
scene.add(wygwylCityGroup);

async function loadWygwylAssets() {
  try {
    const [islandRes, worldRes, scenesRes, palRes] = await Promise.all([
      fetch('./wygwyl-data/island_slice.json'),
      fetch('./wygwyl-data/world.json'),
      fetch('./wygwyl-data/scenes.json'),
      fetch('./wygwyl-data/palettes.json'),
    ]);
    if (islandRes.ok) wygwylAssets.island = await islandRes.json();
    if (worldRes.ok) wygwylAssets.world = await worldRes.json();
    if (scenesRes.ok) wygwylAssets.scenes = await scenesRes.json();
    if (palRes.ok) wygwylAssets.palettes = await palRes.json();
  } catch (err) {
    console.warn('wygwyl-data load warning:', err);
  }

  if (wygwylAssets.island && wygwylAssets.island.buildings) {
    const bMat = neighborMat;
    const roofMat = mats.trim;
    wygwylAssets.island.buildings.forEach((b) => {
      if (!b.pts || b.pts.length < 3) return;
      if (b.pts.some(([px, pz]) => px > -20 && px < 18 && pz > -18 && pz < 22)) return;
      const shape = new THREE.Shape();
      shape.moveTo(b.pts[0][0], -b.pts[0][1]);
      for (let i = 1; i < b.pts.length; i++) {
        shape.lineTo(b.pts[i][0], -b.pts[i][1]);
      }
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, [roofMat, bMat]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wygwylCityGroup.add(mesh);
    });
  }

  if (wygwylAssets.island && wygwylAssets.island.roads) {
    const roadLineMat = new THREE.LineBasicMaterial({ color: '#586875', transparent: true, opacity: 0.45 });
    wygwylAssets.island.roads.forEach((pts) => {
      if (pts.length < 2) return;
      const vecs = pts.map(([rx, rz]) => new THREE.Vector3(rx, 0.05, rz));
      const geo = new THREE.BufferGeometry().setFromPoints(vecs);
      wygwylCityGroup.add(new THREE.Line(geo, roadLineMat));
    });
  }
}
loadWygwylAssets();

const cutoutMat = new THREE.MeshBasicMaterial({ color: '#1b2228', side: THREE.DoubleSide, transparent: true, opacity: 0.82 });
for (let i = 0; i < 8; i++) {
  const ang = (i / 8) * Math.PI * 2;
  const dist = 62;
  const flat = new THREE.Mesh(new THREE.PlaneGeometry(26, 22 + (i % 3) * 8), cutoutMat);
  flat.position.set(Math.cos(ang) * dist, 12, Math.sin(ang) * dist);
  flat.lookAt(0, 12, 0);
  scene.add(flat);
}

// Streetlamps with volumetric sodium aura sprites
const lampLights = [];
const lampSprites = [];
const glowTex = makeGlowSpriteTexture('#ffc478');
const lampCoords = [
  [-11, 12], [11, 12], [-18, 22], [2, 22], [18, 22], [-18, -2],
];
lampCoords.forEach(([lx, lz]) => {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5.4, 8), mats.trim);
  pole.position.set(lx, 2.7, lz);
  pole.castShadow = true;
  scene.add(pole);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mats.windowGlow);
  bulb.position.set(lx, 5.45, lz);
  scene.add(bulb);

  const pl = new THREE.PointLight('#ffbe73', 2.0, 18, 1.6);
  pl.position.set(lx, 5.2, lz);
  scene.add(pl);
  lampLights.push(pl);

  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  sp.position.set(lx, 5.45, lz);
  sp.scale.set(3.2, 3.2, 1);
  scene.add(sp);
  lampSprites.push(sp);
});

// Multi-Branch Layered Urban Trees with Stone Planters
const treeCoords = [
  [-12, 22], [12, 22], [15, 6], [15, -4], [-21, 8], [-11, -12], [-17, -20], [10, -16], [11, 25.5], [-19, 25.5],
];
const foliageDarkMat = mats.foliage.clone();
treeCoords.forEach(([tx, tz], tIdx) => {
  const g = new THREE.Group();
  g.position.set(tx, 0, tz);
  const scale = 0.85 + (tIdx % 3) * 0.16;
  const curb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 1.4), mats.trim);
  curb.position.y = 0.11;
  g.add(curb);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.26 * scale, 3.2 * scale, 8), mats.trunk);
  trunk.position.y = 1.6 * scale;
  trunk.castShadow = true;
  g.add(trunk);

  const branchAngles = [0.4, 2.5, 4.6];
  branchAngles.forEach((ba, bi) => {
    const bLen = (1.35 + bi * 0.15) * scale;
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.10 * scale, bLen, 6), mats.trunk);
    br.position.set(Math.cos(ba) * 0.42 * scale, (2.8 + bi * 0.22) * scale, Math.sin(ba) * 0.42 * scale);
    br.rotation.z = -Math.cos(ba) * 0.58;
    br.rotation.x = Math.sin(ba) * 0.58;
    br.castShadow = true;
    g.add(br);

    const leaf = new THREE.Mesh(
      new THREE.DodecahedronGeometry((1.25 + (bi % 2) * 0.25) * scale, 1),
      bi === 1 ? foliageDarkMat : mats.foliage
    );
    leaf.position.set(Math.cos(ba) * 1.05 * scale, (3.65 + bi * 0.28) * scale, Math.sin(ba) * 1.05 * scale);
    leaf.scale.set(1.15, 0.82, 1.15);
    leaf.castShadow = true;
    g.add(leaf);
  });

  const crownTop = new THREE.Mesh(new THREE.DodecahedronGeometry(1.48 * scale, 1), mats.foliage);
  crownTop.position.set(0, 4.45 * scale, 0);
  crownTop.scale.set(1.1, 0.78, 1.1);
  crownTop.castShadow = true;
  g.add(crownTop);

  scene.add(g);
});

// Floating submerged silt / rain dust particles
const partCount = 320;
const partGeo = new THREE.BufferGeometry();
const partPos = new Float32Array(partCount * 3);
for (let i = 0; i < partCount; i++) {
  partPos[i * 3] = (Math.random() - 0.5) * 70;
  partPos[i * 3 + 1] = Math.random() * 18;
  partPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
}
partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
const partMat = new THREE.PointsMaterial({ color: '#9cd8f0', size: 0.12, transparent: true, opacity: 0.45 });
const particles = new THREE.Points(partGeo, partMat);
scene.add(particles);

// ---------------------------------------------------------------------------
// 3D Brass Camera Tripod + 3D Portal Thresholds (Canal Quay, East, West, Cinema)
// ---------------------------------------------------------------------------
const worldRig = createWorldPortalAndTripod({
  THREE,
  scene,
  camera,
  domElement: renderer.domElement,
  suite,
  tripodPos: { x: 2.2, y: 0.16, z: 12.6, rotY: -2.75 },
  portals: [
    { id: 'atlantis', whisper: 'Canal Quay -> Atlantis', href: './atlantis/', pos: [4.5, 0, 26.6], rotY: Math.PI },
    { id: 'island', whisper: 'East Street -> Island', href: './island/', pos: [16.5, 0, 12.5], rotY: -Math.PI / 2 },
    { id: 'foundry', whisper: 'West Alley -> Foundry', href: './foundry/', pos: [-16.2, 0, 5.8], rotY: Math.PI / 2 },
    { id: 'heroes', whisper: 'West Alley -> Heroes', href: './heroes/', pos: [-16.2, 0, 1.0], rotY: Math.PI / 2 },
    { id: 'weave', whisper: 'Cinema -> WEAVE Stage', href: './weave/', pos: [-5.4, 4.6, -4.8], rotY: 0.35 },
    { id: 'pointcloud', whisper: 'Cinema -> 3D Splats', href: './pointcloud/', pos: [5.4, 4.6, -4.8], rotY: -0.35 },
  ],
  onTripodClick: ({ isShutter, entry }) => {
    if (isShutter) {
      const pl = capturePlate();
      worldRig.setWhisper(`Exposed ${pl.id} (${pl.stock}) -> Shop Window & Light Table`, 2200, entry);
      return true;
    }
    suite.nextLook(false);
    const nextLookId = suite.getState().lookId;
    camState.stock = nextLookId;
    camState.active = !camState.active;
    updateCameraLensState();
    const lookObj = ALL_CITY_LOOKS.find((l) => l.id === nextLookId) || ALL_CITY_LOOKS[0];
    worldRig.setWhisper(
      `8x10 Ground Glass · ${lookObj.name} — click look · shift+click / Space expose`,
      2200,
      entry
    );
    return true;
  },
});

// ---------------------------------------------------------------------------
// Exact Visual Surface Elevation Helper (Street, Sidewalk Apron, Shop, Stairs, Roof)
// ---------------------------------------------------------------------------
function getExactVisualSurfaceY(x, z, floorY) {
  if (floorY > 8.8) return Math.max(floorY, 9.24);
  if (floorY > 4.35 && floorY < 4.85) return 4.62;
  if (floorY > 0.25) return floorY;
  if (Math.abs(x) < 8.8 && Math.abs(z) < 6.8) return 0.18;
  if (Math.abs(x) < 13.0 && z > -9.0 && z < 13.0) return 0.16;
  if (x > -20.0 && x < -8.0 && z > -24.0 && z < -4.0) return 0.16;
  return 0.0;
}

// ---------------------------------------------------------------------------
// Persistent Anny V9 Cast (Makeda, Bekele, June) + Biomechanical Role Suites
// ---------------------------------------------------------------------------
const residents = [];
const residentHitMeshes = [];
const v9ResidentCache = new Map();

function createArticulatedResident(def) {
  const root = new THREE.Group();
  const fallbackGroup = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: def.skin, roughness: 0.65 });
  const coatMat = new THREE.MeshStandardMaterial({ color: def.coat, roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1b1d20', roughness: 0.85 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.28, 0.86, 10), coatMat);
  torso.position.y = 1.08;
  fallbackGroup.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skinMat);
  head.position.y = 1.65;
  fallbackGroup.add(head);
  const legL = new THREE.Group(); legL.position.set(-0.1, 0.66, 0);
  const legR = new THREE.Group(); legR.position.set(0.1, 0.66, 0);
  const armL = new THREE.Group(); armL.position.set(-0.26, 1.44, 0);
  const armR = new THREE.Group(); armR.position.set(0.26, 1.44, 0);
  [legL, legR].forEach((lg) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.66, 8), darkMat);
    m.position.y = -0.33;
    lg.add(m);
    fallbackGroup.add(lg);
  });
  [armL, armR].forEach((ar, idx) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.62, 8), coatMat);
    m.position.y = -0.31;
    ar.add(m);
    ar.rotation.z = (idx === 0 ? -1 : 1) * 0.06;
    fallbackGroup.add(ar);
  });
  root.add(fallbackGroup);

  root.userData = { propKind: 'resident', residentId: def.id };
  const hitMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 2.02, 10), mats.hitInvisible);
  hitMesh.position.y = 1.0;
  hitMesh.userData = { propKind: 'resident', residentId: def.id };
  root.add(hitMesh);
  residentHitMeshes.push(hitMesh);

  const st0 = def.stations[0];
  const initSurfaceY = getExactVisualSurfaceY(st0.x, st0.z, st0.y);
  root.position.set(st0.x, st0.y, st0.z);
  scene.add(root);

  const resObj = {
    id: def.id,
    def,
    root,
    fallbackGroup,
    armL,
    armR,
    legL,
    legR,
    v8: null,
    v9: null,
    currentClip: 'idle',
    speechText: '',
    speechTimer: 0,
    speechDur: 0,
    stationIdx: 0,
    dwellTimer: 5 + Math.random() * 4,
    greetTimer: 0,
    wasNearPlayer: false,
    walkPhase: Math.random() * 6,
  };

  const arch = def.archetype || 'adult_f';
  const cacheKey = `${def.id}:${arch}`;
  let prom = v9ResidentCache.get(cacheKey);
  if (!prom) {
    const seedMap = { makeda: 101, bekele: 202, june: 303 };
    const initClipMap = { makeda: 'pump', bekele: 'listen', june: 'idle' };
    prom = createHeroOrCastV9({
      THREE,
      loader: gltfLoader,
      role: def.id,
      archetype: arch,
      groundY: initSurfaceY,
      initialClip: initClipMap[def.id] || 'idle',
      prop: 'none',
      glasses: false,
      wingsMode: 'off',
      seed: seedMap[def.id] || 77,
    }).catch((err) => {
      console.warn('Anny V9 cast fallback:', def.id, err);
      return null;
    });
    v9ResidentCache.set(cacheKey, prom);
  }
  prom.then((v9Inst) => {
    if (!v9Inst) return;
    if (v9Inst.root.parent) v9Inst.root.parent.remove(v9Inst.root);
    v9Inst.root.position.set(0, 0, 0);
    v9Inst.root.rotation.set(0, 0, 0);
    resObj.root.add(v9Inst.root);
    resObj.fallbackGroup.visible = false;
    resObj.v9 = v9Inst;
    resObj.v8 = v9Inst;
    const curSurfY = getExactVisualSurfaceY(resObj.root.position.x, resObj.root.position.z, resObj.root.position.y);
    v9Inst.setGroundY(curSurfY);
  });

  return resObj;
}

function rebuildResidentsForCartridge(cart) {
  residents.forEach((r) => {
    if (r.v9 && r.v9.root && r.v9.root.parent === r.root) {
      r.root.remove(r.v9.root);
    }
    scene.remove(r.root);
  });
  residents.length = 0;
  residentHitMeshes.length = 0;
  cart.residents.forEach((def) => {
    residents.push(createArticulatedResident(def));
  });
}

// ---------------------------------------------------------------------------
// 3D Coat-Stand & Cheval Mirror + Playable V9 Poet Hero + P06-S01 Marble Winged Portal Arch
// ---------------------------------------------------------------------------
const HERO_HOME_POS = new THREE.Vector3(-2.15, 0.16, 11.35);
const HERO_HOME_YAW = 0.22;

const coatStandMirrorGroup = new THREE.Group();
coatStandMirrorGroup.position.set(-3.28, 0.16, 10.75);
coatStandMirrorGroup.rotation.y = 0.36;
scene.add(coatStandMirrorGroup);

{
  // Full-length Brass-Framed Cheval Mirror tilted gracefully toward the Poet Hero & street
  const mirrorStand = new THREE.Group();
  mirrorStand.position.set(-0.36, 0, -0.08);
  mirrorStand.rotation.y = 0.22;

  for (const sx of [-0.42, 0.42]) {
    const upright = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 1.72, 10), mats.oakDoor);
    upright.position.set(sx, 0.86, 0);
    upright.castShadow = true;
    mirrorStand.add(upright);

    const footSplay = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.56), mats.brass);
    footSplay.position.set(sx, 0.025, 0);
    mirrorStand.add(footSplay);

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), mats.brass);
    finial.position.set(sx, 1.75, 0);
    mirrorStand.add(finial);
  }

  const mirrorPivot = new THREE.Group();
  mirrorPivot.position.set(0, 0.96, 0);
  mirrorPivot.rotation.x = -0.07;

  const brassFrame = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.56, 0.045), mats.brass);
  brassFrame.castShadow = true;
  mirrorPivot.add(brassFrame);

  const silverGlassMat = new THREE.MeshStandardMaterial({
    color: '#d9eefc',
    emissive: '#10354f',
    emissiveIntensity: 0.28,
    roughness: 0.06,
    metalness: 0.94,
  });
  const silverGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.46), silverGlassMat);
  silverGlass.position.z = 0.026;
  mirrorPivot.add(silverGlass);

  const archCrown = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.024, 8, 24, Math.PI), mats.brass);
  archCrown.position.set(0, 0.78, 0);
  mirrorPivot.add(archCrown);

  mirrorStand.add(mirrorPivot);
  coatStandMirrorGroup.add(mirrorStand);

  // Turned Mahogany & Brass Coat-Stand with Draped Spare Trench Collar & Cyan Camera Strap
  const standPost = new THREE.Group();
  standPost.position.set(0.42, 0, 0.14);

  const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.05, 16), mats.brass);
  baseDisc.position.y = 0.025;
  standPost.add(baseDisc);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.042, 1.84, 12), mats.oakDoor);
  column.position.y = 0.94;
  column.castShadow = true;
  standPost.add(column);

  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 16), mats.brass);
  collarRing.rotation.x = Math.PI / 2;
  collarRing.position.y = 1.66;
  standPost.add(collarRing);

  for (let hIdx = 0; hIdx < 4; hIdx++) {
    const a = (hIdx / 4) * Math.PI * 2 + 0.4;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.011, 8, 14, Math.PI * 1.1), mats.brass);
    hook.position.set(Math.cos(a) * 0.08, 1.72, Math.sin(a) * 0.08);
    hook.rotation.y = -a;
    standPost.add(hook);
  }

  // Spare dark indigo Poet trench-coat & crimson piping draped on hook
  const drapedCoatMat = new THREE.MeshStandardMaterial({ color: '#1b2236', roughness: 0.68 });
  const drapedTrimMat = new THREE.MeshStandardMaterial({ color: '#d63c34', roughness: 0.45 });
  const drapedCoat = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.88, 10, 1, true), drapedCoatMat);
  drapedCoat.position.set(-0.08, 1.24, 0.06);
  drapedCoat.rotation.z = 0.08;
  drapedCoat.castShadow = true;
  standPost.add(drapedCoat);

  const drapedPiping = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.84, 0.022), drapedTrimMat);
  drapedPiping.position.set(-0.08, 1.24, 0.19);
  standPost.add(drapedPiping);

  const cyanStrap = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 18), mats.cyanActive);
  cyanStrap.position.set(0.09, 1.54, 0.04);
  cyanStrap.rotation.y = 0.6;
  standPost.add(cyanStrap);

  coatStandMirrorGroup.add(standPost);
}

// Spawn V9 Poet Hero standing beside the 3D Coat-Stand / Cheval Mirror
const poetHeroRoot = new THREE.Group();
poetHeroRoot.position.copy(HERO_HOME_POS);
poetHeroRoot.rotation.y = HERO_HOME_YAW;
scene.add(poetHeroRoot);

const poetHeroShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.38, 20),
  new THREE.MeshBasicMaterial({ color: '#05080d', transparent: true, opacity: 0.48, depthWrite: false })
);
poetHeroShadow.rotation.x = -Math.PI / 2;
poetHeroShadow.position.y = 0.01;
poetHeroRoot.add(poetHeroShadow);

const poetHeroFallback = new THREE.Group();
{
  const fbJacket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.24, 0.86, 12),
    new THREE.MeshStandardMaterial({ color: '#181d2c', roughness: 0.65 })
  );
  fbJacket.position.y = 1.1;
  fbJacket.castShadow = true;
  const fbHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#613d2b', roughness: 0.6 })
  );
  fbHead.position.y = 1.65;
  poetHeroFallback.add(fbJacket, fbHead);
}
poetHeroRoot.add(poetHeroFallback);

const poetHeroState = {
  root: poetHeroRoot,
  v9: null,
  embodied: false,
  facingYaw: HERO_HOME_YAW,
  prevYaw: HERO_HOME_YAW,
  evoSeed: 6,
  greetTimer: 0,
};

createHeroOrCastV9({
  THREE,
  loader: gltfLoader,
  role: 'poet_hero',
  wingsMode: 'marble',
  glasses: true,
  prop: 'camera',
  groundY: HERO_HOME_POS.y,
  initialClip: 'idle',
  seed: 6,
})
  .then((inst) => {
    if (!inst) return;
    inst.root.position.set(0, 0, 0);
    inst.root.rotation.set(0, 0, 0);
    poetHeroRoot.add(inst.root);
    poetHeroFallback.visible = false;
    poetHeroState.v9 = inst;
    inst.setGroundY(poetHeroRoot.position.y);
  })
  .catch((err) => {
    console.warn('Poet Hero V9 spawn warning:', err);
  });

// Build 3D Marble Winged Portal Arch leading directly to ./stage/#P06-S01
const wingedPortalGroup = new THREE.Group();
wingedPortalGroup.position.set(-8.4, 0.16, 13.0);
wingedPortalGroup.rotation.y = 0.36;
scene.add(wingedPortalGroup);

const wingedPortalState = {
  group: wingedPortalGroup,
  wingPivotL: null,
  wingPivotR: null,
  veilMat: null,
  armedForWalk: false,
  navigating: false,
};

{
  const carraraMat = new THREE.MeshStandardMaterial({
    color: '#f2eee6',
    roughness: 0.34,
    metalness: 0.06,
  });
  const kintsugiGoldMat = new THREE.MeshStandardMaterial({
    color: '#e2b65e',
    emissive: '#4d350c',
    emissiveIntensity: 0.26,
    roughness: 0.24,
    metalness: 0.88,
  });
  const portalVeilMat = new THREE.MeshBasicMaterial({
    color: '#24c8ff',
    transparent: true,
    opacity: 0.17,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  wingedPortalState.veilMat = portalVeilMat;

  // Stepped marble plinth
  const plinthA = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.14, 0.96), carraraMat);
  plinthA.position.y = 0.07;
  plinthA.receiveShadow = true;
  wingedPortalGroup.add(plinthA);

  const plinthB = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.12, 0.78), carraraMat);
  plinthB.position.y = 0.20;
  plinthB.receiveShadow = true;
  wingedPortalGroup.add(plinthB);

  // Fluted Carrara marble columns + kintsugi gold collar rings
  for (const sx of [-1.14, 1.14]) {
    const colBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.46), carraraMat);
    colBase.position.set(sx, 0.38, 0);
    wingedPortalGroup.add(colBase);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.20, 2.75, 16), carraraMat);
    shaft.position.set(sx, 1.88, 0);
    shaft.castShadow = true;
    wingedPortalGroup.add(shaft);

    for (const ry of [1.15, 2.25]) {
      const goldSeam = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.016, 8, 22), kintsugiGoldMat);
      goldSeam.rotation.x = Math.PI / 2;
      goldSeam.position.set(sx, ry, 0);
      wingedPortalGroup.add(goldSeam);
    }

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.22, 0.50), carraraMat);
    cap.position.set(sx, 3.36, 0);
    wingedPortalGroup.add(cap);
  }

  // Marble architrave + vaulted arch + kintsugi keystone
  const architrave = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.26, 0.56), carraraMat);
  architrave.position.set(0, 3.60, 0);
  architrave.castShadow = true;
  wingedPortalGroup.add(architrave);

  const marbleArch = new THREE.Mesh(new THREE.TorusGeometry(1.14, 0.17, 12, 36, Math.PI), carraraMat);
  marbleArch.position.set(0, 3.62, 0);
  marbleArch.castShadow = true;
  wingedPortalGroup.add(marbleArch);

  const goldArchRib = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.026, 8, 36, Math.PI), kintsugiGoldMat);
  goldArchRib.position.set(0, 3.62, 0.16);
  wingedPortalGroup.add(goldArchRib);

  const keystone = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), kintsugiGoldMat);
  keystone.position.set(0, 4.82, 0.08);
  wingedPortalGroup.add(keystone);

  // Shimmering cyan threshold veil inside the marble arch
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(1.94, 3.18), portalVeilMat);
  veil.position.set(0, 1.85, 0);
  wingedPortalGroup.add(veil);

  // Sculpted P06-S01 Evolutionary Marble & Angel Feather Wings crowning left/right shoulders
  const wingTexLoader = new THREE.TextureLoader();
  const wingTexL = wingTexLoader.load('./hero-build/assets/wings/08.cast.angel.wings__p07.png');
  const wingTexR = wingTexLoader.load('./hero-build/assets/wings/08.cast.angel.wings__p08.png');
  wingTexL.colorSpace = THREE.SRGBColorSpace;
  wingTexR.colorSpace = THREE.SRGBColorSpace;

  const buildArchWing = (sx, wTex) => {
    const piv = new THREE.Group();
    piv.position.set(sx * 1.18, 3.68, -0.04);

    const cardMat = new THREE.MeshStandardMaterial({
      map: wTex,
      transparent: true,
      alphaTest: 0.06,
      roughness: 0.48,
      side: THREE.DoubleSide,
    });
    const wingCard = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 1.22), cardMat);
    wingCard.position.set(sx * 0.78, 0.42, -0.03);
    if (sx < 0) wingCard.scale.x = -1;
    piv.add(wingCard);

    for (let f = 0; f < 6; f++) {
      const frac = f / 5;
      const feather = new THREE.Mesh(
        new THREE.ConeGeometry(0.075, 0.96 - frac * 0.18, 5),
        f === 0 ? kintsugiGoldMat : carraraMat
      );
      feather.position.set(sx * (0.24 + frac * 0.95), 0.28 + frac * 0.16, 0.02);
      feather.rotation.z = sx * (-0.52 - frac * 0.56);
      feather.scale.set(1.0, 1.0, 0.28);
      feather.castShadow = true;
      piv.add(feather);
    }
    wingedPortalGroup.add(piv);
    return piv;
  };

  wingedPortalState.wingPivotL = buildArchWing(-1, wingTexR);
  wingedPortalState.wingPivotR = buildArchWing(1, wingTexL);
}

// ---------------------------------------------------------------------------
// Player Movement, Lens State & Optical Threshold Rule
// ---------------------------------------------------------------------------
const player = {
  pos: new THREE.Vector3(-5.2, 0, 25.5),
  yaw: -0.15,
  pitch: 0.06,
  eyeHeight: 1.65,
  speed: 5.8,
  floorY: 0,
  isInside: false,
  walkBob: 0,
};

const keys = {};
let dragging = false;
let lastMouse = { x: 0, y: 0 };
let pointerDownPos = { x: 0, y: 0 };

const camState = {
  active: false,
  focalMm: 50,
  focusM: 12.0,
  exposureEv: 0.0,
  stock: suite.getState().lookId || 'weave',
  xray: false,
};

let activeDialogueResident = null;
let screenArchiveIdx = 0;
let lightTableCursor = 0;

function computeFloorHeight(x, z, currentY) {
  const inHeroX = x > -8.8 && x < 8.8;
  const inHeroZ = z > -6.8 && z < 6.8;
  if (!inHeroX || !inHeroZ) return 0;

  if (x >= 5.9 && x <= 8.7 && z >= -6.2 && z <= 5.2 && currentY < 6.8) {
    const t = THREE.MathUtils.clamp((4.5 - z) / 10.0, 0, 1);
    return t * 4.6;
  }
  if (x >= -8.7 && x <= -5.9 && z >= -6.2 && z <= 5.2 && currentY >= 3.2) {
    const t = THREE.MathUtils.clamp((z + 5.5) / 10.0, 0, 1);
    return 4.6 + t * 4.6;
  }
  if (currentY >= 7.6) return 9.2;
  if (currentY >= 3.0) {
    const inLightwell = Math.abs(x) < 2.2 && Math.abs(z) < 2.0;
    return inLightwell ? 0 : 4.6;
  }
  return 0;
}

function collidesAt(nx, ny, nz) {
  const rad = 0.42;
  for (const c of colliders) {
    if (c.active === false) continue;
    if (ny >= 8.8 && c.tag === 'hero-wall') continue;
    if (ny + 1.5 < c.minY || ny > c.maxY - 0.1) continue;
    if (nx + rad > c.minX && nx - rad < c.maxX && nz + rad > c.minZ && nz - rad < c.maxZ) {
      return true;
    }
  }
  return false;
}

function updateThresholdGate() {
  const opticalOpen = camState.active && (camState.focusM < 4.0 || camState.focusM > 18.0 || camState.exposureEv <= -1.2);
  gateCollider.active = !opticalOpen;

  if (opticalOpen) {
    mats.gateSolid.color.set('#18b4ff');
    mats.gateSolid.emissive = new THREE.Color('#18b4ff');
    mats.gateSolid.emissiveIntensity = 0.65;
    mats.gateSolid.opacity = 0.24;
  } else {
    mats.gateSolid.color.set('#353a3e');
    mats.gateSolid.emissive = new THREE.Color('#000000');
    mats.gateSolid.emissiveIntensity = 0;
    mats.gateSolid.opacity = 0.96;
  }

  const gateEl = document.getElementById('val-gate');
  if (gateEl) gateEl.textContent = opticalOpen ? 'OPEN (OPTICAL PASSAGE)' : 'SOLID (IN FOCUS)';
}

function updateCameraLensState() {
  const fov = THREE.MathUtils.radToDeg(2 * Math.atan(24 / (2 * camState.focalMm)));
  camera.fov = camState.active ? fov : 52;
  camera.updateProjectionMatrix();
  updateThresholdGate();
}

// ---------------------------------------------------------------------------
// Severn Door Control (Coupled to 5-Bus Audio & Shared Pilot Record)
// ---------------------------------------------------------------------------
function setSevernDoor(nextOpen, fromUserAction = false) {
  doorOpen = Boolean(nextOpen);
  severnDoorCollider.active = !doorOpen;
  audio.setDoorOpen(doorOpen, fromUserAction);
  const doorValEl = document.getElementById('val-door');
  if (doorValEl) {
    doorValEl.textContent = doorOpen ? 'OPEN (13.5 KHZ)' : 'CLOSED (580 HZ)';
  }
  if (fromUserAction) {
    savePilotState({ doorOpen });
    setPropWhisper(
      new THREE.Vector3(0, 3.65, 7.2),
      doorOpen ? 'Severn Door · Open (13.5 kHz street clear)' : 'Severn Door · Closed (580 Hz stone muffled)',
      2200
    );
  }
}

// ---------------------------------------------------------------------------
// Cartridge & Time-of-Day Atmosphere
// ---------------------------------------------------------------------------
function applyCartridgeAndTime() {
  const cart = CARTRIDGES[ledger.cartridge] || CARTRIDGES.ahiya;
  const tp = TIME_PRESETS[ledger.timeOfDay] || TIME_PRESETS.bluehour;

  mats.masonryExt.color.set(cart.palette.masonry);
  neighborMat.color.set(cart.palette.masonryDark);
  mats.trim.color.set(cart.palette.trim);
  mats.asphalt.color.set(cart.palette.asphalt);
  mats.sidewalk.color.set(cart.palette.sidewalk);
  mats.foliage.color.set(cart.palette.foliage);
  foliageDarkMat.color.set(cart.palette.foliage).multiplyScalar(0.72);
  canalMat.color.set(cart.palette.water || '#15394a');
  mats.cyanActive.color.set(cart.palette.cyan);
  mats.cyanActive.emissive.set(cart.palette.cyan);

  const elevRad = THREE.MathUtils.degToRad(tp.sunElevation);
  const azRad = THREE.MathUtils.degToRad(tp.sunAzimuth);
  sunLight.position.set(
    Math.cos(elevRad) * Math.sin(azRad) * 48,
    Math.max(4, Math.sin(elevRad) * 48),
    Math.cos(elevRad) * Math.cos(azRad) * 48
  );
  sunLight.intensity = cart.palette.submerged ? tp.sunIntensity * 0.75 : tp.sunIntensity;
  sunLight.color.set(cart.palette.submerged ? '#7ce8ff' : tp.sunColor);

  hemiLight.intensity = tp.hemiIntensity;
  hemiLight.color.set(cart.palette.submerged ? '#4ec9e6' : tp.skyHorizon);
  hemiLight.groundColor.set(tp.ambientGround);

  const bgCol = new THREE.Color(cart.palette.submerged ? '#0b222c' : tp.skyTop);
  scene.background = bgCol;
  scene.fog.color.set(cart.palette.submerged ? '#0d2936' : tp.skyHorizon).lerp(bgCol, 0.55);
  scene.fog.density = cart.palette.submerged ? 0.0115 : tp.fogDensity;

  skyMat.uniforms.uTop.value.set(cart.palette.submerged ? '#071b26' : tp.skyTop);
  skyMat.uniforms.uMid.value.set(cart.palette.submerged ? '#17546e' : '#2d6394');
  skyMat.uniforms.uHorizon.value.set(cart.palette.submerged ? '#358da8' : tp.skyHorizon);

  mats.windowGlow.emissiveIntensity = tp.windowGlow;
  lampLights.forEach((l) => {
    l.intensity = tp.lampIntensity;
    l.color.set(cart.palette.sodium);
  });
  lampSprites.forEach((s) => {
    s.material.opacity = Math.min(0.85, tp.lampIntensity * 0.25);
  });

  partMat.color.set(cart.palette.submerged ? '#48eeff' : '#a8c6d8');
  partMat.opacity = cart.palette.submerged ? 0.72 : 0.35;

  rebuildResidentsForCartridge(cart);
  saveLedger();
}

// ---------------------------------------------------------------------------
// Unified Water, Jerrycan, Relay, Storefront Window, Light Table & Linen Screen
// ---------------------------------------------------------------------------
const runtimeTexLoader = new THREE.TextureLoader();

function syncWorldVisualsFromLedger() {
  const wEl = document.getElementById('val-water');
  if (wEl) wEl.textContent = `${ledger.carriedWaterL.toFixed(1)} / 20 L`;
  const spEl = document.getElementById('val-standpipe');
  if (spEl) spEl.textContent = `${ledger.standpipeReserveL.toFixed(1)} L`;

  const wet = ledger.projectorTankL >= 5.0;
  const tEl = document.getElementById('val-tank');
  if (tEl) tEl.textContent = `${ledger.projectorTankL.toFixed(1)} / 5.0 L (${wet ? 'COOLED' : 'DRY'})`;

  // Physical Cyan Jerrycan in hand / at hip
  playerJerrycan.visible = ledger.carriedWaterL > 0.05;
  const jerryFrac = THREE.MathUtils.clamp(ledger.carriedWaterL / 20.0, 0.08, 1.0);
  jerryLiquid.scale.y = jerryFrac;
  jerryLiquid.position.y = -0.11 + jerryFrac * 0.11;

  // Upper Projector Sight-glass liquid level
  const fillFrac = THREE.MathUtils.clamp(ledger.projectorTankL / 5.0, 0.02, 1.0);
  sightGlassLiquid.scale.y = fillFrac;
  sightGlassLiquid.position.y = 4.68 + fillFrac * 0.62;

  // Cyan conduits & Rooftop Relay Mast
  conduitMat.emissiveIntensity = wet ? 1.8 : 0.14;
  relayBeaconMat.emissiveIntensity = wet ? 2.6 : 0.12;
  relayPointLight.intensity = wet ? 45.0 : 1.5;

  // Street Standpipe Sight-Glass water column height
  const depotFrac = THREE.MathUtils.clamp(ledger.standpipeReserveL / 40.0, 0.05, 1.0);
  depotWater.scale.y = depotFrac;
  depotWater.position.y = 0.28 + depotFrac * 1.0;

  const pubCount = ledger.plates.filter((p) => p.permission === 'public').length;
  const pEl = document.getElementById('val-plates');
  if (pEl) pEl.textContent = `${ledger.plates.length} (${pubCount} PUBLIC)`;

  // Apply mounted textures to 3 Storefront Window Frames
  ledger.windowPlateIds.forEach((pid, idx) => {
    const wf = windowFrames[idx];
    if (!wf) return;
    const plate = ledger.plates.find((p) => p.id === pid);
    if (plate && plate.dataUrl) {
      if (wf.loadedId !== pid) {
        wf.loadedId = pid;
        runtimeTexLoader.load(plate.dataUrl, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          wf.mat.map = tex;
          wf.mat.emissiveMap = tex;
          wf.mat.color.set('#ffffff');
          wf.mat.emissive.set('#2b3642');
          wf.mat.needsUpdate = true;
        });
      }
    }
  });

  // Update 6 physical contact-sheet prints resting on 3D Archive Light Table
  const recentPlates = [...ledger.plates].reverse();
  lightTableSlots.forEach((slot, idx) => {
    const pl = recentPlates[idx];
    if (pl && pl.dataUrl) {
      slot.plateId = pl.id;
      if (slot.loadedKey !== pl.id) {
        slot.loadedKey = pl.id;
        runtimeTexLoader.load(pl.dataUrl, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          slot.mat.map = tex;
          slot.mat.emissiveMap = tex;
          slot.mat.emissive.set('#6a9bb8');
          slot.mat.needsUpdate = true;
        });
      }
    } else {
      slot.plateId = null;
      const archIdx = idx % WEAVE_ARCHIVE_URLS.length;
      const archKey = `arch-${archIdx}`;
      if (slot.loadedKey !== archKey && archiveTextures[archIdx]) {
        slot.loadedKey = archKey;
        slot.mat.map = archiveTextures[archIdx];
        slot.mat.emissiveMap = archiveTextures[archIdx];
        slot.mat.emissive.set('#446073');
        slot.mat.needsUpdate = true;
      }
    }
  });

  // Apply projected texture to Upper Stretched Linen Sheet when cooled (>= 5L)
  const screenPlate = ledger.plates.find((p) => p.id === ledger.screenPlateId && p.permission === 'public');
  if (wet && screenPlate && screenPlate.dataUrl) {
    projectorBeamLight.intensity = 4.5;
    if (screenMesh.userData.loadedId !== screenPlate.id) {
      screenMesh.userData.loadedId = screenPlate.id;
      runtimeTexLoader.load(screenPlate.dataUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        screenMat.map = tex;
        screenMat.color.set('#ffffff');
        screenMat.emissive.set('#ffffff');
        screenMat.emissiveMap = tex;
        screenMat.emissiveIntensity = 0.74;
        screenMat.needsUpdate = true;
      });
    }
  } else if (wet && archiveTextures[screenArchiveIdx % archiveTextures.length]) {
    projectorBeamLight.intensity = 4.2;
    const archKey = `weave-${screenArchiveIdx % archiveTextures.length}`;
    if (screenMesh.userData.loadedId !== archKey) {
      screenMesh.userData.loadedId = archKey;
      const tex = archiveTextures[screenArchiveIdx % archiveTextures.length];
      screenMat.map = tex;
      screenMat.color.set('#ffffff');
      screenMat.emissive.set('#ffffff');
      screenMat.emissiveMap = tex;
      screenMat.emissiveIntensity = 0.72;
      screenMat.needsUpdate = true;
    }
  } else {
    projectorBeamLight.intensity = 0.0;
    if (screenMesh.userData.loadedId) {
      screenMesh.userData.loadedId = null;
      screenMat.map = null;
      screenMat.emissiveMap = null;
      screenMat.color.set('#e8e4da');
      screenMat.emissive.set('#18242e');
      screenMat.emissiveIntensity = 0.2;
      screenMat.needsUpdate = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Photo Capture (8x10 Plate + Resident Framing Credit Rule)
// ---------------------------------------------------------------------------
function capturePlate() {
  audio.playShutter();
  const flash = document.getElementById('shutter-flash');
  if (flash) {
    flash.style.opacity = '0.84';
    setTimeout(() => { flash.style.opacity = '0'; }, 140);
  }

  const currentLookId = suite.getState().lookId || camState.stock;
  camState.stock = currentLookId;
  const lookObj = ALL_CITY_LOOKS.find((l) => l.id === currentLookId) || ALL_CITY_LOOKS[0];
  suite.pipeline.render(scene, camera, {
    time: performance.now() * 0.001,
    focusM: camState.focusM,
    dofAmount: camState.active ? 0.62 : 0.0,
    ev: camState.exposureEv,
    mode: lookObj.mode,
    paletteColors: lookObj.colors,
  });

  const off = document.createElement('canvas');
  off.width = 480;
  off.height = 300;
  const ctx = off.getContext('2d');
  ctx.drawImage(renderer.domElement, 0, 0, off.width, off.height);
  const dataUrl = off.toDataURL('image/jpeg', 0.86);

  let framedResident = null;
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  for (const r of residents) {
    const rPos = r.root.position.clone().add(new THREE.Vector3(0, 1.3, 0));
    const toR = rPos.sub(camera.position);
    const dist = toR.length();
    if (dist < 24 && toR.normalize().dot(camDir) > 0.84) {
      framedResident = r;
      break;
    }
  }

  const cart = CARTRIDGES[ledger.cartridge];
  const locLabel = player.isInside
    ? (player.floorY >= 4.0 ? 'Upper Screening Hall' : 'Camera Shop & Archive')
    : (player.floorY >= 8.5 ? 'Rooftop Overlook' : 'Street & Standpipe');

  const plate = {
    id: 'P-' + Date.now().toString(36).toUpperCase(),
    dataUrl,
    cartridge: cart.name,
    locationName: locLabel,
    timeOfDay: TIME_PRESETS[ledger.timeOfDay].label,
    focalMm: camState.focalMm,
    focusM: camState.focusM,
    exposureEv: camState.exposureEv,
    stock: currentLookId.toUpperCase(),
    subjectId: framedResident ? framedResident.id : null,
    subjectName: framedResident ? framedResident.def.name : 'Architecture / Street',
    permission: framedResident ? 'pending' : 'public',
    caption: framedResident
      ? `Portrait of ${framedResident.def.name} (${framedResident.def.role}) - awaiting subject credit`
      : `${cart.name} - ${locLabel} (${camState.focalMm}mm, ${currentLookId.toUpperCase()})`,
    viewpoint: { x: player.pos.x, y: player.floorY, z: player.pos.z, yaw: player.yaw, pitch: player.pitch },
  };

  ledger.plates.push(plate);
  if (plate.permission === 'public') {
    ledger.windowPlateIds = [plate.id, ledger.windowPlateIds[0], ledger.windowPlateIds[1]];
    ledger.screenPlateId = plate.id;
  }
  saveLedger();
  syncWorldVisualsFromLedger();
  return plate;
}

// ---------------------------------------------------------------------------
// 3D Resident Overhead World-Projected Speech & Inline Choices (Zero Modal Box)
// ---------------------------------------------------------------------------
const rwsEl = document.getElementById('resident-world-speech');
const rwsSpeakerEl = document.getElementById('rws-speaker');
const rwsLineEl = document.getElementById('rws-line');

function triggerResidentSpeech(res, text, expr = 'warm') {
  res.speechText = text;
  res.speechDur = Math.max(2.6, Math.min(7.5, text.length * 0.055));
  res.speechTimer = res.speechDur;
  if (res.v9) {
    res.v9.setExpression(expr);
    if (res.currentClip !== 'idle-talking') {
      res.currentClip = 'idle-talking';
      res.v9.playAction('idle-talking', 0.22);
    }
  }
  audio.speakDuet(res.def.name, text, res.def.id === 'bekele' ? 0.88 : 1.05);
}

function openDialogue(res, customLine = null, expr = 'warm') {
  activeDialogueResident = res;
  const d = res.def;
  const spoken = customLine || d.duet.greeting;
  if (rwsSpeakerEl) rwsSpeakerEl.textContent = `${d.name} · ${d.role}`;
  if (rwsLineEl) rwsLineEl.textContent = `"${spoken}"`;
  triggerResidentSpeech(res, spoken, expr);
}

function closeDialogue() {
  activeDialogueResident = null;
  if (rwsEl) rwsEl.classList.remove('visible');
}

document.querySelectorAll('[data-rws]').forEach((btn) => {
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('pointerup', (e) => e.stopPropagation());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const res = activeDialogueResident;
    if (!res) return;
    const d = res.def;
    const action = btn.getAttribute('data-rws');

    if (action === 'job') {
      openDialogue(res, d.duet.job, 'focus');
    } else if (action === 'credit') {
      const pending =
        ledger.plates.find((p) => p.subjectId === res.id && p.permission === 'pending') ||
        ledger.plates.find((p) => p.permission === 'pending');
      if (pending) {
        pending.permission = 'public';
        pending.caption = `${d.name} (${d.role}) - credited & approved for public screening`;
        ledger.windowPlateIds[0] = pending.id;
        ledger.screenPlateId = pending.id;
        saveLedger();
        syncWorldVisualsFromLedger();
        openDialogue(res, d.duet.creditApprove, 'smile');
      } else if (ledger.plates.length > 0) {
        const latest = ledger.plates[ledger.plates.length - 1];
        latest.permission = 'public';
        ledger.windowPlateIds[0] = latest.id;
        ledger.screenPlateId = latest.id;
        saveLedger();
        syncWorldVisualsFromLedger();
        openDialogue(res, d.duet.creditApprove, 'smile');
      } else {
        openDialogue(res, 'Expose a plate with the brass 8x10 camera first, and I will sign the margin.', 'warm');
      }
    } else if (action === 'water') {
      if (ledger.carriedWaterL >= 5.0) {
        ledger.carriedWaterL = Math.max(0, ledger.carriedWaterL - 5.0);
        if (res.id === 'june' || res.id === 'makeda') {
          ledger.projectorTankL = Math.min(10.0, ledger.projectorTankL + 5.0);
        }
        saveLedger();
        syncWorldVisualsFromLedger();
        savePilotState({
          waterLiters: ledger.carriedWaterL,
          coolingWet: ledger.projectorTankL >= 5.0,
          parcelHolder: res.id === 'bekele' ? 'bekele' : loadPilotState().parcelHolder,
        });
        audio.playPour();
        openDialogue(res, d.duet.waterThanks, 'smile');
      } else if (res.id === 'bekele' && loadPilotState().parcelHolder !== 'bekele') {
        savePilotState({ parcelHolder: 'bekele' });
        openDialogue(res, 'I have logged the Severn parcel at the vestibule desk. Draw 5 liters outside if June needs cooling water.', 'smile');
      } else {
        openDialogue(res, 'Click the cyan Standpipe Sight-Glass on the corner first to draw 5 liters into your jerrycan.', 'warm');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// In-World 3D Architectural Prop Interactions & World-Projected 1-Line Whisper
// ---------------------------------------------------------------------------
const propWhisperEl = document.getElementById('world-prop-whisper');
const worldPropHitMeshes = [];
const worldPropEntries = [];
let hoveredPropEntry = null;
let transientPropWhisper = null; // { anchorVec, text, until }

function setPropWhisper(anchorVec, text, ms = 2200) {
  transientPropWhisper = {
    anchorVec: anchorVec.clone(),
    text,
    until: performance.now() + ms,
  };
}

function registerWorldProp({ mesh, anchorPos, getWhisper, onActivate, interactRadius = 4.6 }) {
  const entry = {
    mesh,
    anchorPos: anchorPos.clone(),
    getWhisper,
    onActivate,
    interactRadius,
  };
  mesh.userData = { ...mesh.userData, propKind: 'world-prop', propEntry: entry };
  worldPropHitMeshes.push(mesh);
  worldPropEntries.push(entry);
  return entry;
}

// 1. 3D Severn Door Hit Targets (both swinging leaves + doorway threshold frame)
const severnDoorHitFrame = new THREE.Mesh(new THREE.BoxGeometry(4.9, 3.85, 0.55), mats.hitInvisible);
severnDoorHitFrame.position.set(0, 1.92, 7.05);
scene.add(severnDoorHitFrame);

[severnDoorHitFrame, doorLeafL.leafMesh, doorLeafR.leafMesh].forEach((m) => {
  registerWorldProp({
    mesh: m,
    anchorPos: new THREE.Vector3(0, 3.65, 7.2),
    interactRadius: 4.5,
    getWhisper: () =>
      doorOpen
        ? 'Severn Threshold Door · Open (13.5 kHz) — click to close'
        : 'Severn Threshold Door · Closed (580 Hz) — click to open',
    onActivate: () => setSevernDoor(!doorOpen, true),
  });
});

// 2. 3D Standpipe Sight-Glass Hit Target (-16, 1.35, 14)
const standpipeHit = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 2.85, 12), mats.hitInvisible);
standpipeHit.position.set(-16, 1.4, 14);
scene.add(standpipeHit);

registerWorldProp({
  mesh: standpipeHit,
  anchorPos: new THREE.Vector3(-16, 2.95, 14),
  interactRadius: 4.8,
  getWhisper: () =>
    `Standpipe Sight-Glass (${ledger.standpipeReserveL.toFixed(0)} L reserve) — click to draw 5 L`,
  onActivate: () => {
    if (ledger.carriedWaterL >= 20) {
      setPropWhisper(new THREE.Vector3(-16, 2.95, 14), 'Cyan Jerrycan Full (20.0 L) — carry upstairs to Sight-Glass', 2200);
      return;
    }
    if (ledger.standpipeReserveL < 5) {
      ledger.standpipeReserveL = 40;
    }
    ledger.carriedWaterL = Math.min(20, ledger.carriedWaterL + 5);
    ledger.standpipeReserveL = Math.max(0, ledger.standpipeReserveL - 5);
    audio.playPour();
    saveLedger();
    syncWorldVisualsFromLedger();
    savePilotState({ waterLiters: ledger.carriedWaterL });
    setPropWhisper(
      new THREE.Vector3(-16, 2.95, 14),
      `Drew 5 L -> Cyan Jerrycan ${ledger.carriedWaterL.toFixed(0)} L (${ledger.standpipeReserveL.toFixed(0)} L left)`,
      2400
    );
  },
});

// 3. 3D Storefront Window Frames (#1, #2, #3)
windowFrames.forEach((wf, idx) => {
  const hitFrame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.28, 0.36), mats.hitInvisible);
  hitFrame.position.set(wf.wx, 1.9, 7.3);
  scene.add(hitFrame);

  registerWorldProp({
    mesh: hitFrame,
    anchorPos: new THREE.Vector3(wf.wx, 2.68, 7.36),
    interactRadius: 4.0,
    getWhisper: () => {
      const pid = ledger.windowPlateIds[idx];
      return pid
        ? `Storefront Frame #${idx + 1} (${pid}) — click to mount plate`
        : `Storefront Frame #${idx + 1} — click to mount captured plate`;
    },
    onActivate: () => {
      const pubPlates = [...ledger.plates].reverse().filter((p) => p.permission === 'public');
      if (pubPlates.length > 0) {
        const curIdx = pubPlates.findIndex((p) => p.id === ledger.windowPlateIds[idx]);
        const chosen = pubPlates[(curIdx + 1) % pubPlates.length];
        ledger.windowPlateIds[idx] = chosen.id;
        saveLedger();
        syncWorldVisualsFromLedger();
        setPropWhisper(
          new THREE.Vector3(wf.wx, 2.68, 7.36),
          `Mounted ${chosen.id} in Storefront Frame #${idx + 1}`,
          2200
        );
      } else {
        wf.archiveCycle = (wf.archiveCycle + 1) % WEAVE_ARCHIVE_URLS.length;
        const tex = archiveTextures[wf.archiveCycle];
        if (tex) {
          wf.mat.map = tex;
          wf.mat.emissiveMap = tex;
          wf.mat.needsUpdate = true;
        }
        setPropWhisper(
          new THREE.Vector3(wf.wx, 2.68, 7.36),
          `Storefront Frame #${idx + 1} · WEAVE Plate #${wf.archiveCycle + 1} (Space to expose yours)`,
          2200
        );
      }
    },
  });
});

// 4. 3D Archive Light Table inside Severn Ground Floor (4.0, 0.94, -1.8)
const lightTableHit = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.15, 1.55), mats.hitInvisible);
lightTableHit.position.set(4.0, 0.62, -1.8);
scene.add(lightTableHit);

registerWorldProp({
  mesh: lightTableHit,
  anchorPos: new THREE.Vector3(4.0, 1.48, -1.8),
  interactRadius: 4.2,
  getWhisper: () =>
    ledger.plates.length > 0
      ? `Archive Light Table (${ledger.plates.length} plates) — click to mount & queue`
      : 'Archive Light Table — expose a plate (Space / Tripod) to inspect & mount',
  onActivate: () => {
    const pubPlates = [...ledger.plates].reverse().filter((p) => p.permission === 'public');
    if (pubPlates.length > 0) {
      const chosen = pubPlates[lightTableCursor % pubPlates.length];
      lightTableCursor += 1;
      ledger.windowPlateIds[0] = chosen.id;
      ledger.screenPlateId = chosen.id;
      saveLedger();
      syncWorldVisualsFromLedger();
      setPropWhisper(
        new THREE.Vector3(4.0, 1.48, -1.8),
        `Light Table · Queued ${chosen.id} -> Window #1 & Upper Projector`,
        2400
      );
    } else {
      const freshPlate = capturePlate();
      setPropWhisper(
        new THREE.Vector3(4.0, 1.48, -1.8),
        `Exposed & Mounted ${freshPlate.id} on Archive Light Table`,
        2400
      );
    }
  },
});

// 5. 3D Upper Projector & Cyan Cooling Sight-Glass (-1.35, 5.25, 1.2)
const sightGlassHit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.65, 1.35), mats.hitInvisible);
sightGlassHit.position.set(-1.35, 5.32, 1.05);
scene.add(sightGlassHit);

registerWorldProp({
  mesh: sightGlassHit,
  anchorPos: new THREE.Vector3(-1.1, 6.25, 1.2),
  interactRadius: 4.5,
  getWhisper: () => {
    if (ledger.projectorTankL < 5.0) {
      return ledger.carriedWaterL >= 5.0
        ? 'Projector Sight-Glass (Dry) — click to pour 5 L from Jerrycan'
        : 'Projector Sight-Glass Dry (0/5 L) — draw 5 L at Street Standpipe';
    }
    return `Projector Sight-Glass Cooled (${ledger.projectorTankL.toFixed(1)} L) — click to advance reel`;
  },
  onActivate: () => {
    if (ledger.carriedWaterL >= 5.0 && ledger.projectorTankL < 10.0) {
      ledger.carriedWaterL = Math.max(0, ledger.carriedWaterL - 5.0);
      ledger.projectorTankL = Math.min(10.0, ledger.projectorTankL + 5.0);
      audio.playPour();
      const pubPlate = [...ledger.plates].reverse().find((pl) => pl.permission === 'public');
      if (pubPlate && !ledger.screenPlateId) ledger.screenPlateId = pubPlate.id;
      saveLedger();
      syncWorldVisualsFromLedger();
      savePilotState({ waterLiters: ledger.carriedWaterL, coolingWet: true });
      setPropWhisper(
        new THREE.Vector3(-1.1, 6.25, 1.2),
        'Poured 5 L -> Sight-Glass Cooled & Rooftop Cyan Relay Live',
        2600
      );
    } else if (ledger.projectorTankL >= 5.0) {
      screenArchiveIdx += 1;
      const pubPlates = [...ledger.plates].reverse().filter((pl) => pl.permission === 'public');
      if (pubPlates.length > 0) {
        const nextP = pubPlates[screenArchiveIdx % pubPlates.length];
        ledger.screenPlateId = nextP.id;
        saveLedger();
        syncWorldVisualsFromLedger();
        setPropWhisper(new THREE.Vector3(-1.1, 6.25, 1.2), `35mm Projector · Screening ${nextP.id}`, 2200);
      } else {
        ledger.screenPlateId = null;
        syncWorldVisualsFromLedger();
        setPropWhisper(
          new THREE.Vector3(-1.1, 6.25, 1.2),
          `35mm Projector · Screening WEAVE Reel #${(screenArchiveIdx % WEAVE_ARCHIVE_URLS.length) + 1}`,
          2200
        );
      }
    } else {
      setPropWhisper(
        new THREE.Vector3(-1.1, 6.25, 1.2),
        'Sight-Glass is Dry — click Street Standpipe (-16, 14) for 5 L first',
        2400
      );
    }
  },
});

// 6. 3D Stretched Linen Screening Sheet (0, 6.85, -6.42)
const linenScreenHit = new THREE.Mesh(new THREE.BoxGeometry(6.9, 3.8, 0.35), mats.hitInvisible);
linenScreenHit.position.set(0, 6.85, -6.42);
scene.add(linenScreenHit);

registerWorldProp({
  mesh: linenScreenHit,
  anchorPos: new THREE.Vector3(0, 8.85, -6.35),
  interactRadius: 5.5,
  getWhisper: () =>
    ledger.projectorTankL >= 5.0
      ? '35mm Linen Screen — click to project next plate'
      : '35mm Linen Screen — pour 5 L into Sight-Glass to cool lamp',
  onActivate: () => {
    if (ledger.projectorTankL < 5.0 && ledger.carriedWaterL >= 5.0) {
      ledger.carriedWaterL = Math.max(0, ledger.carriedWaterL - 5.0);
      ledger.projectorTankL = 5.0;
      audio.playPour();
      savePilotState({ waterLiters: ledger.carriedWaterL, coolingWet: true });
    }
    if (ledger.projectorTankL < 5.0) {
      setPropWhisper(
        new THREE.Vector3(0, 8.85, -6.35),
        'Linen Screen Dry — pour 5 L into the cyan Sight-Glass behind you first',
        2400
      );
      return;
    }
    const pubPlates = [...ledger.plates].reverse().filter((pl) => pl.permission === 'public');
    if (pubPlates.length > 0) {
      const cur = pubPlates.findIndex((p) => p.id === ledger.screenPlateId);
      const nextP = pubPlates[(cur + 1) % pubPlates.length];
      ledger.screenPlateId = nextP.id;
      saveLedger();
      syncWorldVisualsFromLedger();
      setPropWhisper(new THREE.Vector3(0, 8.85, -6.35), `Projecting ${nextP.id} onto Stretched Linen`, 2200);
    } else {
      screenArchiveIdx += 1;
      syncWorldVisualsFromLedger();
      setPropWhisper(
        new THREE.Vector3(0, 8.85, -6.35),
        `Projecting WEAVE Archive Reel #${(screenArchiveIdx % WEAVE_ARCHIVE_URLS.length) + 1}`,
        2200
      );
    }
  },
});

// 7. 3D Optical Threshold Gate (-14, 2.1, -7) & Hidden Courtyard Cistern (-14, 0.5, -16)
const gateHit = new THREE.Mesh(new THREE.BoxGeometry(9.4, 4.1, 0.55), mats.hitInvisible);
gateHit.position.set(-14, 2.05, -7);
scene.add(gateHit);

registerWorldProp({
  mesh: gateHit,
  anchorPos: new THREE.Vector3(-14, 4.15, -7),
  interactRadius: 4.8,
  getWhisper: () =>
    gateCollider.active
      ? 'Optical Threshold Gate (Solid) — click to defocus into Zone II passage'
      : 'Optical Threshold Gate (Open Passage) — click to restore sharp focus',
  onActivate: () => {
    if (gateCollider.active) {
      camState.active = true;
      camState.focusM = 2.6;
    } else {
      camState.active = false;
      camState.focusM = 12.0;
    }
    updateCameraLensState();
    setPropWhisper(
      new THREE.Vector3(-14, 4.15, -7),
      gateCollider.active ? 'Optical Gate · Restored Focus (Solid)' : 'Optical Gate · Shifted Focus -> Passage Open',
      2200
    );
  },
});

const cisternHit = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 0.9, 16), mats.hitInvisible);
cisternHit.position.set(-14, 0.45, -16);
scene.add(cisternHit);

registerWorldProp({
  mesh: cisternHit,
  anchorPos: new THREE.Vector3(-14, 1.35, -16),
  interactRadius: 4.8,
  getWhisper: () => 'Courtyard Cistern — click to draw 10 L into Cyan Jerrycan',
  onActivate: () => {
    ledger.carriedWaterL = Math.min(20, ledger.carriedWaterL + 10);
    audio.playPour();
    saveLedger();
    syncWorldVisualsFromLedger();
    savePilotState({ waterLiters: ledger.carriedWaterL });
    setPropWhisper(
      new THREE.Vector3(-14, 1.35, -16),
      `Courtyard Cistern -> Cyan Jerrycan ${ledger.carriedWaterL.toFixed(0)} L`,
      2200
    );
  },
});

// 8. 3D Coat-Stand & Cheval Mirror + Playable V9 Poet Hero + P06-S01 Marble Winged Arch
function navigateToHeroStageP06() {
  if (wingedPortalState.navigating) return;
  wingedPortalState.navigating = true;
  audio.playDoorTransition?.(true);
  window.location.href = './stage/#P06-S01';
}

function togglePoetHeroEmbodiment() {
  poetHeroState.embodied = !poetHeroState.embodied;
  if (poetHeroState.embodied) {
    // Step smoothly into 3rd-person Poet Hero embodiment
    const curSurfY = getExactVisualSurfaceY(player.pos.x, player.pos.z, player.floorY);
    poetHeroRoot.position.set(player.pos.x, curSurfY, player.pos.z);
    poetHeroState.facingYaw = player.yaw + Math.PI;
    poetHeroRoot.rotation.y = poetHeroState.facingYaw;
    if (poetHeroState.v9) {
      poetHeroState.v9.setGroundY(curSurfY);
      poetHeroState.v9.playAction('greet', 0.22);
      poetHeroState.greetTimer = 1.4;
    }
    setPropWhisper(
      new THREE.Vector3(player.pos.x, curSurfY + 2.02, player.pos.z),
      'Embodied V9 Poet Hero (3rd-Person) — WASD walk stairs & rooftop · G evolve wings & glasses · V 1st-person',
      2800
    );
  } else {
    // Return to 1st-person street lens & station Poet Hero back at the Coat-Stand / Mirror
    poetHeroRoot.position.copy(HERO_HOME_POS);
    poetHeroState.facingYaw = HERO_HOME_YAW;
    poetHeroRoot.rotation.y = HERO_HOME_YAW;
    if (poetHeroState.v9) {
      poetHeroState.v9.setGroundY(HERO_HOME_POS.y);
      poetHeroState.v9.setMoveSpeed(0);
      poetHeroState.v9.playAction('idle', 0.25);
    }
    syncWorldVisualsFromLedger();
    setPropWhisper(
      HERO_HOME_POS.clone().add(new THREE.Vector3(0, 2.05, 0)),
      '1st-Person View Restored — V9 Poet Hero stationed by Coat-Stand & Mirror',
      2400
    );
  }
}

function cyclePoetHeroWardrobe() {
  if (!poetHeroState.v9) return;
  poetHeroState.evoSeed += 1;
  const tp = TIME_PRESETS[ledger.timeOfDay] || TIME_PRESETS.bluehour;
  const bgLum = ledger.timeOfDay === 'midday' ? 0.68 : (ledger.timeOfDay === 'dawn' ? 0.48 : 0.22);
  const pheno = evolveHeroPhenotype(poetHeroState.v9, {
    poem: String(((poetHeroState.evoSeed - 1) % 14) + 1).padStart(2, '0'),
    shotKind: ledger.carriedWaterL > 0.05 ? 'water' : (player.floorY > 4.5 ? 'gate-glide' : 'street'),
    bgLuminance: bgLum,
    seed: poetHeroState.evoSeed * 13 + (tp ? 3 : 0),
  });
  const anchor = poetHeroRoot.position.clone().add(new THREE.Vector3(0, 2.05, 0));
  setPropWhisper(
    anchor,
    `Poet Hero Gen ${pheno.generation} · Wings: ${pheno.wingsMode} · Glasses: ${String(pheno.glasses)} · Prop: ${pheno.prop}`,
    2600
  );
}

const coatMirrorHit = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.95, 0.85), mats.hitInvisible);
coatMirrorHit.position.set(-3.28, 1.12, 10.75);
scene.add(coatMirrorHit);

registerWorldProp({
  mesh: coatMirrorHit,
  anchorPos: new THREE.Vector3(-3.28, 2.18, 10.75),
  interactRadius: 4.5,
  getWhisper: () => '3D Coat-Stand & Cheval Mirror — click to evolve Poet Hero wings, sunglasses & coat (G)',
  onActivate: () => cyclePoetHeroWardrobe(),
});

const poetHeroHit = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.96, 12), mats.hitInvisible);
poetHeroHit.position.y = 0.98;
poetHeroRoot.add(poetHeroHit);

const poetHeroPropEntry = registerWorldProp({
  mesh: poetHeroHit,
  anchorPos: HERO_HOME_POS.clone().add(new THREE.Vector3(0, 2.04, 0)),
  interactRadius: 4.6,
  getWhisper: () =>
    poetHeroState.embodied
      ? 'V9 Poet Hero (3rd-Person) — click or press G to cycle wings & sunglasses · press V for 1st-person'
      : 'V9 Poet Hero (P06-S01 Wings & Sunglasses) — click or press V to embody 3rd-person',
  onActivate: () => {
    if (poetHeroState.embodied) {
      cyclePoetHeroWardrobe();
    } else {
      togglePoetHeroEmbodiment();
    }
  },
});

const wingedPortalHit = new THREE.Mesh(new THREE.BoxGeometry(3.15, 4.45, 1.1), mats.hitInvisible);
wingedPortalHit.position.set(0, 2.22, 0);
wingedPortalGroup.add(wingedPortalHit);

registerWorldProp({
  mesh: wingedPortalHit,
  anchorPos: new THREE.Vector3(-8.4, 5.15, 13.0),
  interactRadius: 5.2,
  getWhisper: () => 'P06-S01 Marble Winged Portal Arch -> Hero Stage — click or walk through',
  onActivate: () => navigateToHeroStageP06(),
});

// ---------------------------------------------------------------------------
// Inverse Tomology X-Ray & Silent Background Keyboard Shortcuts
// ---------------------------------------------------------------------------
function toggleXray(force) {
  camState.xray = typeof force === 'boolean' ? force : !camState.xray;
  mats.masonryExt.transparent = camState.xray;
  mats.masonryExt.opacity = camState.xray ? 0.16 : 1.0;
  mats.masonryExt.depthWrite = !camState.xray;
  mats.masonryExt.needsUpdate = true;
  mats.xrayWire.opacity = camState.xray ? 0.42 : 0.0;
}

function setLook(lookId) {
  suite.setLook(lookId, false, true);
  camState.stock = suite.getState().lookId;
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const activeEl = document.activeElement;
  const tag = activeEl ? activeEl.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  const k = e.key.toLowerCase();
  keys[k] = true;

  if (k === 'escape') {
    closeDialogue();
    if (camState.active) {
      camState.active = false;
      updateCameraLensState();
    }
    return;
  }
  if (k === 'v' && !e.repeat) {
    togglePoetHeroEmbodiment();
    return;
  }
  if (k === 'g' && !e.repeat) {
    cyclePoetHeroWardrobe();
    return;
  }
  if (k === 'c' && !e.repeat) {
    camState.active = !camState.active;
    updateCameraLensState();
  }
  if (k === 'x' && !e.repeat) {
    toggleXray();
  }
  if (e.code === 'Space' && !e.repeat && tag !== 'BUTTON') {
    e.preventDefault();
    const pl = capturePlate();
    setPropWhisper(
      new THREE.Vector3(player.pos.x - Math.sin(player.yaw) * 3.2, player.floorY + 1.85, player.pos.z - Math.cos(player.yaw) * 3.2),
      `Exposed ${pl.id} (${pl.stock}) -> Shop Window & Light Table`,
      1900
    );
  }
  if (k === 'e' && !e.repeat) {
    const nearRes = residents.find(
      (r) => player.pos.distanceTo(r.root.position) < 5.2 && Math.abs(player.floorY - r.root.position.y) < 2.2
    );
    if (nearRes) openDialogue(nearRes);
  }
  if (k === 'f' && !e.repeat) {
    let bestProp = null;
    let bestDist = Infinity;
    for (const p of worldPropEntries) {
      const d = player.pos.distanceTo(p.anchorPos);
      if (d < p.interactRadius + 1.2 && d < bestDist) {
        bestDist = d;
        bestProp = p;
      }
    }
    if (bestProp) bestProp.onActivate();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// ---------------------------------------------------------------------------
// Mouse Drag Look + Direct 3D Raycast (Residents + Architectural Props)
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let playerHasWalked = false;

function updateNdc(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.set(
    ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
    -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
  );
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastMouse.x = e.clientX;
  lastMouse.y = e.clientY;
  pointerDownPos.x = e.clientX;
  pointerDownPos.y = e.clientY;
});

function resolveResidentFromHitObject(obj) {
  let cur = obj;
  while (cur) {
    if (cur.userData && cur.userData.residentId) {
      return residents.find((r) => r.id === cur.userData.residentId) || null;
    }
    cur = cur.parent;
  }
  return null;
}

window.addEventListener('pointermove', (e) => {
  if (dragging) {
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
    player.yaw -= dx * 0.0042;
    player.pitch = THREE.MathUtils.clamp(player.pitch - dy * 0.0036, -0.95, 0.95);
    return;
  }

  updateNdc(e.clientX, e.clientY);
  raycaster.setFromCamera(pointerNdc, camera);

  const resRoots = residents.map((r) => r.root);
  const resHits = raycaster.intersectObjects(resRoots, true);
  const propHits = raycaster.intersectObjects(worldPropHitMeshes, false);

  const bestResHit = resHits.length > 0 && resHits[0].distance < 28 ? resHits[0] : null;
  const bestProp = propHits.length > 0 && propHits[0].distance < 42 ? propHits[0] : null;
  const hitOpenDoorAir = bestProp && bestProp.object === severnDoorHitFrame && doorOpen;

  if (bestResHit && (hitOpenDoorAir || !bestProp || bestResHit.distance <= bestProp.distance)) {
    const res = resolveResidentFromHitObject(bestResHit.object);
    hoveredPropEntry = res
      ? {
          anchorPos: res.root.position.clone().add(new THREE.Vector3(0, 2.04, 0)),
          getWhisper: () => `${res.def.name} · ${res.def.role} — click to speak`,
        }
      : null;
  } else if (bestProp) {
    hoveredPropEntry = bestProp.object.userData.propEntry || null;
  } else {
    hoveredPropEntry = null;
  }

  if (!renderer.domElement.dataset.mpPrevCursor) {
    renderer.domElement.style.cursor = hoveredPropEntry ? 'pointer' : '';
  }
});

window.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  if (e.button !== 0) return;

  const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (moved > 6) return;

  updateNdc(e.clientX, e.clientY);
  raycaster.setFromCamera(pointerNdc, camera);

  const rigHits = raycaster.intersectObjects(worldRig.hitMeshes, false);
  const resHits = raycaster.intersectObjects(residents.map((r) => r.root), true);
  const propHits = raycaster.intersectObjects(worldPropHitMeshes, false);

  const rigDist = rigHits.length > 0 ? rigHits[0].distance : Infinity;
  const resDist = resHits.length > 0 && resHits[0].distance < 28 ? resHits[0].distance : Infinity;
  const propDist = propHits.length > 0 && propHits[0].distance < 42 ? propHits[0].distance : Infinity;
  const hitOpenDoorAir = propDist < Infinity && propHits[0].object === severnDoorHitFrame && doorOpen;

  if (rigDist < resDist && rigDist < propDist && rigDist < 58) {
    return;
  }

  if (resDist < 28 && (hitOpenDoorAir || resDist <= propDist)) {
    const res = resolveResidentFromHitObject(resHits[0].object);
    if (res) {
      openDialogue(res);
      return;
    }
  }

  if (propDist < 42) {
    const propEntry = propHits[0].object.userData.propEntry;
    if (propEntry && typeof propEntry.onActivate === 'function') {
      if (e.shiftKey && propEntry === poetHeroPropEntry) {
        cyclePoetHeroWardrobe();
      } else {
        propEntry.onActivate();
      }
      return;
    }
  }

  if (activeDialogueResident) {
    closeDialogue();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  suite.pipeline.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Subscribe to Shared Severn Pilot State Updates
// ---------------------------------------------------------------------------
subscribePilotState((nextPilot) => {
  if (typeof nextPilot.doorOpen === 'boolean' && nextPilot.doorOpen !== doorOpen) {
    setSevernDoor(nextPilot.doorOpen, false);
  }
  if (nextPilot.shader && nextPilot.shader !== camState.stock && ALL_CITY_LOOKS.some((l) => l.id === nextPilot.shader)) {
    camState.stock = nextPilot.shader;
  }
  const mappedTime = hourToTimeKey(nextPilot.worldTime);
  if (mappedTime && TIME_PRESETS[mappedTime] && mappedTime !== ledger.timeOfDay) {
    ledger.timeOfDay = mappedTime;
    applyCartridgeAndTime();
  }
});

// ---------------------------------------------------------------------------
// Initial URL Query Overrides & Startup
// ---------------------------------------------------------------------------
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('cart') && CARTRIDGES[urlParams.get('cart')]) {
  ledger.cartridge = urlParams.get('cart');
}
if (urlParams.get('time') && TIME_PRESETS[urlParams.get('time')]) {
  ledger.timeOfDay = urlParams.get('time');
}
if (urlParams.get('look') || urlParams.get('shader')) {
  setLook(urlParams.get('look') || urlParams.get('shader'));
}

applyCartridgeAndTime();
setSevernDoor(doorOpen, false);
syncWorldVisualsFromLedger();
updateCameraLensState();

if (urlParams.get('xray') === '1') {
  ledger.projectorTankL = 5.0;
  syncWorldVisualsFromLedger();
  toggleXray(true);
  player.pos.set(-13.5, 0, 19.0);
  player.yaw = -0.52;
  player.pitch = 0.14;
} else if (urlParams.get('view') === 'interior') {
  ledger.projectorTankL = 5.0;
  syncWorldVisualsFromLedger();
  player.pos.set(0.4, 0, 5.2);
  player.floorY = 0;
  player.yaw = 0.04;
  player.pitch = 0.06;
} else if (urlParams.get('view') === 'cast') {
  player.pos.set(-4.2, 0, 6.2);
  player.floorY = 0;
  player.yaw = 0.0;
  player.pitch = -0.02;
} else if (urlParams.get('embody') === '1') {
  poetHeroState.embodied = true;
}

// ---------------------------------------------------------------------------
// Main Simulation Loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const headWorldScratch = new THREE.Vector3();
const playerGazeTarget = new THREE.Vector3();
const thirdPersonTargetScratch = new THREE.Vector3();

function shortestAngleDelta(fromRad, toRad) {
  let d = ((toRad - fromRad + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function updateWorldOverlays() {
  const now = performance.now();

  // 1. Floating Overhead Resident Speech + Minimal Inline Choices
  if (activeDialogueResident && rwsEl) {
    const dist = player.pos.distanceTo(activeDialogueResident.root.position);
    if (dist > 14.5) {
      closeDialogue();
    } else {
      headWorldScratch.copy(activeDialogueResident.root.position).add(new THREE.Vector3(0, 2.08, 0));
      const prj = projectWorldLabel(camera, headWorldScratch, renderer.domElement);
      if (prj.visible) {
        rwsEl.style.left = `${Math.round(prj.x)}px`;
        rwsEl.style.top = `${Math.round(prj.y - 8)}px`;
        rwsEl.classList.add('visible');
      } else {
        rwsEl.classList.remove('visible');
      }
    }
  }

  // 2. Plain 1-line World-Projected Prop Whisper (ONLY on hover, click, or < 4.5m after movement)
  if (!propWhisperEl) return;
  if (worldRig.whisperEl && worldRig.whisperEl.classList.contains('visible')) {
    propWhisperEl.classList.remove('visible');
    return;
  }
  let targetAnchor = null;
  let targetText = '';

  if (transientPropWhisper && now < transientPropWhisper.until) {
    targetAnchor = transientPropWhisper.anchorVec;
    targetText = transientPropWhisper.text;
  } else {
    transientPropWhisper = null;
    if (hoveredPropEntry && !activeDialogueResident) {
      targetAnchor = hoveredPropEntry.anchorPos;
      targetText = hoveredPropEntry.getWhisper();
    } else if (playerHasWalked && !activeDialogueResident) {
      let bestDist = 4.6;
      for (const p of worldPropEntries) {
        if (poetHeroState.embodied && p === poetHeroPropEntry) continue;
        const d = player.pos.distanceTo(p.anchorPos);
        if (d < bestDist) {
          const prj = projectWorldLabel(camera, p.anchorPos, renderer.domElement);
          if (prj.visible) {
            bestDist = d;
            targetAnchor = p.anchorPos;
            targetText = p.getWhisper();
          }
        }
      }
    }
  }

  if (targetAnchor && targetText) {
    const prj = projectWorldLabel(camera, targetAnchor, renderer.domElement);
    if (prj.visible) {
      propWhisperEl.textContent = targetText;
      propWhisperEl.style.left = `${Math.round(prj.x)}px`;
      propWhisperEl.style.top = `${Math.round(prj.y - 6)}px`;
      propWhisperEl.classList.add('visible');
      return;
    }
  }
  propWhisperEl.classList.remove('visible');
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const elapsed = clock.elapsedTime;

  // Smoothly animate double-leaf 3D Severn Threshold Doors
  const targetDoorL = doorOpen ? 1.34 : 0.0;
  const targetDoorR = doorOpen ? -1.34 : 0.0;
  doorLeafL.pivot.rotation.y = THREE.MathUtils.lerp(doorLeafL.pivot.rotation.y, targetDoorL, Math.min(1, dt * 8.5));
  doorLeafR.pivot.rotation.y = THREE.MathUtils.lerp(doorLeafR.pivot.rotation.y, targetDoorR, Math.min(1, dt * 8.5));

  // Animate P06-S01 Marble Winged Portal Arch wings & walk-through trigger
  if (wingedPortalState.wingPivotL && wingedPortalState.wingPivotR) {
    const flap = Math.sin(elapsed * 1.65) * 0.075;
    wingedPortalState.wingPivotL.rotation.set(0.04, -0.18 - flap, 0.08 + flap * 0.6);
    wingedPortalState.wingPivotR.rotation.set(0.04, 0.18 + flap, -0.08 - flap * 0.6);
  }
  const distToWingedPortal = Math.hypot(
    player.pos.x - wingedPortalGroup.position.x,
    player.pos.z - wingedPortalGroup.position.z
  );
  if (wingedPortalState.veilMat) {
    const nearBoost = distToWingedPortal < 6.5 ? (1 - distToWingedPortal / 6.5) * 0.16 : 0;
    wingedPortalState.veilMat.opacity = 0.15 + nearBoost + Math.sin(elapsed * 2.3) * 0.025;
  }
  if (distToWingedPortal > 2.3) {
    wingedPortalState.armedForWalk = true;
  } else if (
    wingedPortalState.armedForWalk &&
    playerHasWalked &&
    distToWingedPortal < 1.35 &&
    Math.abs(player.floorY - 0) < 1.8
  ) {
    navigateToHeroStageP06();
  }

  // Player Movement (WASD / Arrows)
  let moving = false;
  let fwd = 0;
  let strafe = 0;
  if (keys['w'] || keys['arrowup']) fwd += 1;
  if (keys['s'] || keys['arrowdown']) fwd -= 1;
  if (keys['a'] || keys['arrowleft']) strafe -= 1;
  if (keys['d'] || keys['arrowright']) strafe += 1;

  const prevX = player.pos.x;
  const prevZ = player.pos.z;
  let moveDirX = 0;
  let moveDirZ = 0;

  if (fwd !== 0 || strafe !== 0) {
    moving = true;
    playerHasWalked = true;
    const baseMoveRate = poetHeroState.embodied ? (keys['shift'] ? 5.2 : 2.85) : (keys['shift'] ? 8.8 : player.speed);
    const lenInput = Math.hypot(fwd, strafe) || 1;
    const sinY = Math.sin(player.yaw);
    const cosY = Math.cos(player.yaw);
    moveDirX = (-sinY * (fwd / lenInput) + cosY * (strafe / lenInput));
    moveDirZ = (-cosY * (fwd / lenInput) - sinY * (strafe / lenInput));

    const vx = moveDirX * baseMoveRate * dt;
    const vz = moveDirZ * baseMoveRate * dt;

    const nx = THREE.MathUtils.clamp(player.pos.x + vx, -44, 44);
    const nz = THREE.MathUtils.clamp(player.pos.z + vz, -44, 44);
    const nextFloor = computeFloorHeight(nx, nz, player.floorY);

    if (!collidesAt(nx, nextFloor, player.pos.z)) player.pos.x = nx;
    if (!collidesAt(player.pos.x, nextFloor, nz)) player.pos.z = nz;
    player.floorY = computeFloorHeight(player.pos.x, player.pos.z, player.floorY);
  }

  player.pos.y = THREE.MathUtils.lerp(player.pos.y, player.floorY, Math.min(1, dt * 12));
  player.isInside = Math.abs(player.pos.x) < 8.8 && Math.abs(player.pos.z) < 6.8 && player.floorY < 8.6;
  const actualHorizMps = Math.hypot(player.pos.x - prevX, player.pos.z - prevZ) / Math.max(0.001, dt);

  // Subtle physical bob on carried 3D Cyan Jerrycan in 1st-person (hidden in 3rd-person where Hero holds it!)
  playerJerrycan.visible = !poetHeroState.embodied && ledger.carriedWaterL > 0.05;
  if (playerJerrycan.visible) {
    player.walkBob += dt * (moving ? 9.5 : 1.8);
    const bobAmt = moving ? 0.016 : 0.004;
    playerJerrycan.position.y = -0.35 + Math.sin(player.walkBob) * bobAmt;
    playerJerrycan.rotation.z = 0.05 + Math.cos(player.walkBob * 0.5) * (moving ? 0.04 : 0.01);
  }

  const badge = document.getElementById('space-badge');
  if (badge) {
    if (player.isInside) {
      badge.textContent = player.floorY >= 3.8 ? 'INTERIOR | SCREENING HALL' : 'INTERIOR | CAMERA SHOP';
    } else if (player.floorY >= 8.5) {
      badge.textContent = 'EXTERIOR | ROOFTOP OVERLOOK';
    } else {
      badge.textContent = 'EXTERIOR | STREET & QUAY';
    }
  }

  // Update V9 Poet Hero (Playable 3rd-Person Embodiment OR Coat-Stand / Mirror Sentinel)
  const playerSurfaceY = getExactVisualSurfaceY(player.pos.x, player.pos.z, player.pos.y);
  playerGazeTarget.set(player.pos.x, playerSurfaceY + 1.62, player.pos.z);

  if (poetHeroState.embodied) {
    poetHeroRoot.visible = !camState.active;
    poetHeroRoot.position.set(player.pos.x, playerSurfaceY, player.pos.z);
    poetHeroPropEntry.anchorPos.set(player.pos.x, playerSurfaceY + 2.04, player.pos.z);

    if (moving && (Math.abs(moveDirX) > 0.01 || Math.abs(moveDirZ) > 0.01)) {
      const wantYaw = Math.atan2(moveDirX, moveDirZ);
      const dYaw = shortestAngleDelta(poetHeroState.facingYaw, wantYaw);
      poetHeroState.facingYaw += dYaw * Math.min(1, dt * 10.5);
    }
    poetHeroRoot.rotation.y = poetHeroState.facingYaw;
    const yawRate = shortestAngleDelta(poetHeroState.prevYaw, poetHeroState.facingYaw) / Math.max(0.001, dt);
    poetHeroState.prevYaw = poetHeroState.facingYaw;

    if (poetHeroState.v9) {
      poetHeroState.v9.setGroundY(playerSurfaceY);
      if (ledger.carriedWaterL > 0.05 && poetHeroState.v9.getProp() !== 'jerikan') {
        poetHeroState.v9.setProp('jerikan');
      } else if (ledger.carriedWaterL <= 0.05 && poetHeroState.v9.getProp() === 'jerikan') {
        poetHeroState.v9.setProp('camera');
      }
      if (poetHeroState.greetTimer > 0 && !moving) {
        poetHeroState.greetTimer = Math.max(0, poetHeroState.greetTimer - dt);
        poetHeroState.v9.update(dt, {
          autoLocomotion: false,
          moveSpeed: 0,
          turnRate: yawRate,
          wingFlapBoost: player.floorY >= 8.5 ? 0.55 : 0.15,
        });
      } else {
        poetHeroState.greetTimer = 0;
        poetHeroState.v9.update(dt, {
          moveSpeed: moving ? actualHorizMps : 0,
          turnRate: yawRate,
          wingFlapBoost: (player.floorY >= 8.5 ? 0.65 : 0.0) + (moving && keys['shift'] ? 0.55 : 0.0),
        });
      }
    }

    // Collision-safe 3rd-Person Follow Camera (switches cleanly to 1st-person lens if C viewfinder is active)
    if (camState.active) {
      camera.position.set(player.pos.x, playerSurfaceY + player.eyeHeight, player.pos.z);
      const euler = new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);
    } else {
      const desiredDist = player.isInside ? 2.25 : 3.45;
      const backX = Math.sin(player.yaw);
      const backZ = Math.cos(player.yaw);
      let safeDist = desiredDist;
      for (let sIdx = 1; sIdx <= 6; sIdx++) {
        const testD = (desiredDist * sIdx) / 6;
        const tx = player.pos.x + backX * testD;
        const tz = player.pos.z + backZ * testD;
        if (collidesAt(tx, playerSurfaceY, tz)) {
          safeDist = Math.max(0.95, ((sIdx - 1) / 6) * desiredDist);
          break;
        }
      }
      const camLift = 1.56 - Math.sin(player.pitch) * safeDist * 0.46;
      camera.position.set(
        player.pos.x + backX * safeDist,
        Math.max(playerSurfaceY + 0.45, playerSurfaceY + camLift),
        player.pos.z + backZ * safeDist
      );
      thirdPersonTargetScratch.set(
        player.pos.x - backX * 0.55,
        playerSurfaceY + 1.46 + Math.sin(player.pitch) * 0.85,
        player.pos.z - backZ * 0.55
      );
      camera.lookAt(thirdPersonTargetScratch);
    }
  } else {
    // Unembodied 1st-Person Camera + Living V9 Poet Hero by the Coat-Stand & Mirror
    poetHeroRoot.visible = true;
    poetHeroPropEntry.anchorPos.copy(HERO_HOME_POS).add(new THREE.Vector3(0, 2.04, 0));
    camera.position.set(player.pos.x, playerSurfaceY + player.eyeHeight, player.pos.z);
    const euler = new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    if (poetHeroState.v9) {
      const dHero = player.pos.distanceTo(poetHeroRoot.position);
      let heroAction = 'idle';
      if (dHero < 5.5 && player.floorY < 1.5) {
        const faceAng = Math.atan2(player.pos.x - poetHeroRoot.position.x, player.pos.z - poetHeroRoot.position.z);
        poetHeroRoot.rotation.y += shortestAngleDelta(poetHeroRoot.rotation.y, faceAng) * Math.min(1, dt * 4.5);
        heroAction = Math.floor(elapsed * 0.22) % 2 === 0 ? 'greet' : 'listen';
      } else {
        poetHeroRoot.rotation.y += shortestAngleDelta(poetHeroRoot.rotation.y, HERO_HOME_YAW) * Math.min(1, dt * 3.0);
        heroAction = Math.floor(elapsed * 0.16) % 2 === 0 ? 'idle' : 'fold-arms';
      }
      if (poetHeroState.v9.getCurrentAction() !== heroAction && poetHeroState.v9.hasClip(heroAction)) {
        poetHeroState.v9.playAction(heroAction, 0.30);
      }
      poetHeroState.v9.setGroundY(HERO_HOME_POS.y);
      poetHeroState.v9.update(dt, {
        autoLocomotion: false,
        moveSpeed: 0,
        lookTargetVec3: camera.position,
        wingFlapBoost: dHero < 5.5 ? 0.28 : 0.05,
      });
    }
  }

  // Update 3D Tripod & Portal Thresholds (walk-in travel + world whispers)
  worldRig.update({ x: player.pos.x, y: player.floorY, z: player.pos.z });
  updateWorldOverlays();

  // Persistent Anny V9 Resident Jobs, Velocity-Matched Walking, Gaze, Blink & Role Clips
  const projectorWetNow = ledger.projectorTankL >= 5.0;
  for (const r of residents) {
    const targetSt = r.def.stations[r.stationIdx];
    const targetVec = new THREE.Vector3(targetSt.x, targetSt.y, targetSt.z);
    const toT = targetVec.clone().sub(r.root.position);
    const dist = toT.length();
    const distToPlayer = r.root.position.distanceTo(player.pos);
    const nearPlayer = activeDialogueResident === r || (distToPlayer < 4.5 && Math.abs(r.root.position.y - player.floorY) < 2.0);
    let desiredClip = 'idle';
    let resMoveSpeed = 0;

    if (nearPlayer && !r.wasNearPlayer) {
      r.greetTimer = 2.6;
    }
    r.wasNearPlayer = nearPlayer;
    if (r.greetTimer > 0) {
      r.greetTimer = Math.max(0, r.greetTimer - dt);
    }

    if (nearPlayer) {
      const ang = Math.atan2(player.pos.x - r.root.position.x, player.pos.z - r.root.position.z);
      r.root.rotation.y += shortestAngleDelta(r.root.rotation.y, ang) * Math.min(1, dt * 5.5);
      r.armL.rotation.x = THREE.MathUtils.lerp(r.armL.rotation.x, 0, dt * 6);
      r.armR.rotation.x = THREE.MathUtils.lerp(r.armR.rotation.x, 0, dt * 6);
      r.legL.rotation.x = THREE.MathUtils.lerp(r.legL.rotation.x, 0, dt * 6);
      r.legR.rotation.x = THREE.MathUtils.lerp(r.legR.rotation.x, 0, dt * 6);

      if (r.speechTimer > 0) {
        desiredClip = 'idle-talking';
      } else if (r.id === 'june' && projectorWetNow) {
        desiredClip = Math.floor(elapsed * 0.28) % 2 === 0 ? 'victory' : 'greet';
      } else if (r.greetTimer > 0) {
        desiredClip = 'greet';
      } else {
        desiredClip = r.id === 'bekele' ? 'listen' : 'idle';
      }
    } else if (dist > 0.35) {
      resMoveSpeed = 1.38;
      toT.normalize();
      r.root.position.addScaledVector(toT, dt * resMoveSpeed);
      const walkYaw = Math.atan2(toT.x, toT.z);
      r.root.rotation.y += shortestAngleDelta(r.root.rotation.y, walkYaw) * Math.min(1, dt * 7.5);
      r.walkPhase += dt * 5.2;
      const swing = Math.sin(r.walkPhase) * 0.32;
      r.armL.rotation.x = swing;
      r.armR.rotation.x = -swing;
      r.legL.rotation.x = -swing * 1.1;
      r.legR.rotation.x = swing * 1.1;

      if (r.id === 'makeda') {
        desiredClip = r.stationIdx === 1 ? 'carry' : 'walk';
        if (r.v9) r.v9.setProp(r.stationIdx === 1 ? 'jerikan' : 'none');
      } else {
        desiredClip = 'walk';
      }
    } else {
      r.armL.rotation.x = THREE.MathUtils.lerp(r.armL.rotation.x, 0.04 * Math.sin(elapsed * 2), dt * 4);
      r.armR.rotation.x = THREE.MathUtils.lerp(r.armR.rotation.x, -0.04 * Math.sin(elapsed * 2), dt * 4);
      r.legL.rotation.x = THREE.MathUtils.lerp(r.legL.rotation.x, 0, dt * 5);
      r.legR.rotation.x = THREE.MathUtils.lerp(r.legR.rotation.x, 0, dt * 5);
      r.dwellTimer -= dt;
      if (r.dwellTimer <= 0) {
        r.stationIdx = (r.stationIdx + 1) % r.def.stations.length;
        r.dwellTimer = 7 + Math.random() * 5;
      }

      if (r.speechTimer > 0) {
        desiredClip = 'idle-talking';
      } else if (r.id === 'makeda') {
        if (r.stationIdx === 0) {
          const isWatering = Math.floor(elapsed * 0.22) % 2 === 1;
          desiredClip = isWatering ? 'water' : 'pump';
          if (r.v9) r.v9.setProp(isWatering ? 'jerikan' : 'none');
        } else {
          desiredClip = 'water';
          if (r.v9) r.v9.setProp('jerikan');
        }
      } else if (r.id === 'bekele') {
        if (r.stationIdx === 0) {
          desiredClip = Math.floor(elapsed * 0.20) % 3 === 0 ? 'greet' : 'idle-talking';
        } else {
          desiredClip = Math.floor(elapsed * 0.18) % 2 === 0 ? 'listen' : 'fold-arms';
        }
      } else if (r.id === 'june') {
        if (projectorWetNow) {
          desiredClip = Math.floor(elapsed * 0.24) % 2 === 0 ? 'victory' : 'clap';
        } else {
          desiredClip = Math.floor(elapsed * 0.20) % 3 === 0 ? 'greet' : 'idle';
        }
      }
    }

    if (r.v9) {
      const surfY = getExactVisualSurfaceY(r.root.position.x, r.root.position.z, r.root.position.y);
      r.v9.setGroundY(surfY);
      if (r.currentClip !== desiredClip) {
        r.currentClip = desiredClip;
        r.v9.playAction(desiredClip, 0.28);
      }
      let talkProg = 0;
      const isSpeaking = r.speechTimer > 0;
      if (isSpeaking) {
        r.speechTimer = Math.max(0, r.speechTimer - dt);
        talkProg = 1 - r.speechTimer / Math.max(0.1, r.speechDur);
      } else {
        r.v9.setJawOpenness(0);
      }
      r.v9.update(dt, {
        autoLocomotion: false,
        moveSpeed: resMoveSpeed,
        lookTargetVec3: distToPlayer < 16.0 ? playerGazeTarget : null,
        speaking: isSpeaking,
        talkText: isSpeaking ? r.speechText : '',
        talkProgress: talkProg,
      });
    }
  }

  // Gentle silt / mist drift
  const pArr = partGeo.attributes.position.array;
  const cart = CARTRIDGES[ledger.cartridge];
  for (let i = 0; i < partCount; i++) {
    pArr[i * 3 + 1] += (cart.palette.submerged ? 0.35 : -0.6) * dt;
    if (pArr[i * 3 + 1] < 0) pArr[i * 3 + 1] = 18;
    if (pArr[i * 3 + 1] > 18) pArr[i * 3 + 1] = 0;
  }
  partGeo.attributes.position.needsUpdate = true;

  // 5-Bus Door-Coupled Freesound Audio update
  const projectorDist = player.pos.distanceTo(new THREE.Vector3(-1.8, 4.6, 1.2));
  audio.update(dt, {
    isInside: player.isInside || !doorOpen,
    nightMix: TIME_PRESETS[ledger.timeOfDay].audioNightMix,
    submerged: cart.palette.submerged,
    moving,
    projectorDist,
    projectorWet: ledger.projectorTankL >= 5.0,
  });

  const suiteSt = suite.getState();
  camState.stock = suiteSt.lookId;
  const lookObj = ALL_CITY_LOOKS.find((l) => l.id === suiteSt.lookId) || ALL_CITY_LOOKS[0];
  suite.pipeline.render(scene, camera, {
    time: elapsed,
    focusM: camState.active ? camState.focusM : suiteSt.focusM,
    dofAmount: camState.active ? 0.62 : (suiteSt.dofEnabled ? 0.58 : 0.0),
    ev: camState.active ? camState.exposureEv : suiteSt.ev,
    mode: lookObj.mode,
    paletteColors: lookObj.colors,
  });
}

animate();

// Expose clean verification handle
window.__CITY__ = {
  ledger,
  player,
  residents,
  poetHero: poetHeroState,
  wingedPortal: wingedPortalState,
  camState,
  suite,
  worldRig,
  get doorOpen() { return doorOpen; },
  setSevernDoor,
  togglePoetHeroEmbodiment,
  cyclePoetHeroWardrobe,
  toggleXray,
  capturePlate,
  applyCartridgeAndTime,
  syncWorldVisualsFromLedger,
};
