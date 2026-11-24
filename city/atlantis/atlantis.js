// Make-Photo City — Atlantis: Pure In-World Plato Nolli Rings, Verne Nautilus Dive & Oulipo Courtyard
// Zero overlaid grids or sidebars on load; every interaction lives directly in the 3D world.
// Strict zero-emoji rule across code and UI.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  mountWebGLShaderSuite,
  ALL_CITY_LOOKS,
  createWorldPortalAndTripod,
  projectWorldLabel,
  loadPilotState,
  savePilotState,
  subscribePilotState,
  applyPilotUrlHash,
  formatPilotHash,
  NOLLI_LEDGER_KEY,
} from '../shader-suite-bar.js';
import { buildObject } from '../worldtext/kit.js';
import { createHeroOrCastV9, evolveHeroPhenotype } from '../hero-build/anny-hero-v9.js';

// ---------------------------------------------------------------------------
// 1. Hydrate Severn Pilot State (Brief 9)
// ---------------------------------------------------------------------------
let pilot = applyPilotUrlHash();
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

const POEM_TITLES = {
  '01': 'Out of Life',
  '02': 'Flashing Lights',
  '03': 'How to Break off an Engagement',
  '04': 'Nevermore',
  '05': 'Bloodline',
  '06': 'Resurrecting Atlantis',
  '07': 'DJ Turn Me Up',
  '08': 'Newly Single',
  '09': 'Yet Heard',
  '10': 'Magic Ride',
  '11': 'New Day',
  '12': 'Reunion',
  '13': 'How to Win My Heart',
  '14': 'Hot Minute',
};

const CUT_MODES = ['pool', 'reslot', 'palindrome', 'fibonacci'];
const CUT_LABELS = {
  pool: 'Cut A · Pool Order',
  reslot: 'Cut B · Red-Pencil',
  palindrome: 'Palindrome Cut',
  fibonacci: 'Fibonacci Cut',
};

function navigateToCityRoute(relHref) {
  const hash = formatPilotHash(loadPilotState());
  window.location.href = `${relHref}${hash}`;
}

function triggerShutterFlash() {
  const el = document.getElementById('shutter-flash');
  if (!el) return;
  el.style.transition = 'none';
  el.style.opacity = '0.72';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 320ms ease-out';
      el.style.opacity = '0';
    });
  });
}

// ---------------------------------------------------------------------------
// 2. Full-Bleed Scene, Renderer, Camera & 23-Look GPU Shader Suite
// ---------------------------------------------------------------------------
const wrap = document.getElementById('canvas-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.24;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a1d35');
scene.fog = new THREE.FogExp2('#0c223d', 0.0052);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.15, 340);
camera.position.set(0, 56, 52);
camera.lookAt(0, 0.8, 5);

const hemiLight = new THREE.HemisphereLight('#bce8ff', '#1b2b3a', 1.42);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#ffd7a8', 2.5);
sunLight.position.set(34, 58, 32);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 2;
sunLight.shadow.camera.far = 190;
const sd = 68;
sunLight.shadow.camera.left = -sd;
sunLight.shadow.camera.right = sd;
sunLight.shadow.camera.top = sd;
sunLight.shadow.camera.bottom = -sd;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// Underwater bioluminescent cyan lightwell + Verne volcanic mineral glow + projector bounce
const lightwellGlow = new THREE.PointLight('#18b4ff', 42, 56, 1.4);
lightwellGlow.position.set(0, -24, 0);
scene.add(lightwellGlow);

const volcanoGlow = new THREE.PointLight('#f26b2e', 38, 50, 1.5);
volcanoGlow.position.set(-22, -23, -14);
scene.add(volcanoGlow);

const screenBounceLight = new THREE.PointLight('#7ce8ff', 22, 28, 1.5);
screenBounceLight.position.set(0, -34.2, -7.2);
scene.add(screenBounceLight);

let currentTimePresetKey = 'bluehour';
const state = {
  stage: 'ring',
  depthT: 0.0,
  targetDepthT: 0.0,
  animatingDive: false,
  selectedPoem: pilot.poem || '06',
  selectedBlock: null,
  oulipoWorks: [],
  activeWorkIdx: 0,
  cutMode: 'pool',
  frameTick: 0,
  planData: null,
  codexByPoem: {},
  duetsLineCursor: 0,
  walkOffset: new THREE.Vector3(0, 0, 0),
  lookYaw: 0,
  lookPitch: 0,
};

const suite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: pilot.shader || 'weave',
  defaultTime: 'bluehour',
  locationName: 'Atlantis Nolli Ring & Oulipo Courtyard',
  cartridgeName: 'Atlantis',
  onTimeChange: (key, preset) => {
    currentTimePresetKey = key;
    applyAtmosphereForDepth(state.depthT, preset);
  },
});

function getCurrentLookLabel() {
  const st = suite.getState ? suite.getState() : null;
  const id = (st && st.lookId) || pilot.shader || 'weave';
  const found = ALL_CITY_LOOKS.find((l) => l.id === id);
  return found ? found.name : id;
}

// ---------------------------------------------------------------------------
// 3. Procedural Architectural, Datum Sign & Water Textures
// ---------------------------------------------------------------------------
function makeStoneTexture(baseHex, seamHex, withSaltLine = false) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = baseHex;
  g.fillRect(0, 0, 512, 512);
  const rows = 14;
  const cols = 7;
  const rh = 512 / rows;
  const cw = 512 / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (cw * 0.5);
    for (let col = -1; col <= cols; col++) {
      const v = (((r * 19 + col * 37) % 29) - 14) * 1.4;
      g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 248 : 10},${v > 0 ? 235 : 20},${Math.abs(v) / 135})`;
      g.fillRect(col * cw + off + 2, r * rh + 2, cw - 4, rh - 4);
    }
  }
  g.strokeStyle = seamHex;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(90, 0);
  g.lineTo(118, 180);
  g.lineTo(86, 350);
  g.lineTo(110, 512);
  g.stroke();

  if (withSaltLine) {
    g.fillStyle = 'rgba(38, 72, 68, 0.40)';
    g.fillRect(0, 290, 512, 222);
    g.fillStyle = '#faf6eb';
    g.fillRect(0, 282, 512, 11);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCanalWaterTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(256, 256, 18, 256, 256, 260);
  grd.addColorStop(0, '#124268');
  grd.addColorStop(0.55, '#0c2846');
  grd.addColorStop(1, '#07172b');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(24, 180, 255, 0.30)';
  g.lineWidth = 1.4;
  for (let r = 28; r < 250; r += 18) {
    g.beginPath();
    g.arc(256, 256, r, 0, Math.PI * 2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeInWorldPlaqueTexture(topKicker, mainLine, accent = '#18b4ff') {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(8, 20, 34, 0.88)';
  g.fillRect(0, 0, 768, 192);
  g.strokeStyle = accent;
  g.lineWidth = 4;
  g.strokeRect(6, 6, 756, 180);
  g.fillStyle = accent;
  g.font = '600 22px ui-monospace, Menlo, monospace';
  g.fillText(topKicker, 28, 60);
  g.fillStyle = '#faf6eb';
  g.font = 'italic 36px Georgia, serif';
  g.fillText(mainLine, 28, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const stoneTex = makeStoneTexture('#586a74', 'rgba(24,180,255,0.55)', false);
const floodWallTex = makeStoneTexture('#6e463a', 'rgba(24,180,255,0.75)', true);
const parchmentMat = new THREE.MeshStandardMaterial({ color: '#efe7d2', roughness: 0.72, metalness: 0.04 });
const publicCommonsBaseMat = new THREE.MeshStandardMaterial({
  color: '#faf6eb',
  emissive: '#18b4ff',
  emissiveIntensity: 0.16,
  roughness: 0.34,
});
const canalMat = new THREE.MeshStandardMaterial({
  map: makeCanalWaterTexture(),
  color: '#14628c',
  emissive: '#0c4f78',
  emissiveIntensity: 0.42,
  roughness: 0.14,
  metalness: 0.35,
  transparent: true,
  opacity: 0.88,
});
const brassPropMat = new THREE.MeshStandardMaterial({
  color: '#d9ad62',
  emissive: '#3d2a0c',
  emissiveIntensity: 0.2,
  roughness: 0.28,
  metalness: 0.82,
});
const mahoganyPropMat = new THREE.MeshStandardMaterial({
  color: '#4a2918',
  roughness: 0.56,
  metalness: 0.12,
});
const hitColliderMat = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0.001,
  depthWrite: false,
});

// Helper to build a clickable 3D Brass Field Camera on Tripod anywhere in the scene
function buildBrassTripodMesh() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + 0.25;
    const legPivot = new THREE.Group();
    legPivot.position.set(0, 1.26, 0);
    legPivot.rotation.y = ang;
    legPivot.rotation.z = 0.27;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.018, 1.32, 8), mahoganyPropMat);
    leg.position.y = -0.65;
    leg.castShadow = true;
    legPivot.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.008, 0.22, 8), brassPropMat);
    foot.position.y = -1.22;
    legPivot.add(foot);
    g.add(legPivot);
  }
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.07, 14), brassPropMat);
  crown.position.y = 1.28;
  g.add(crown);

  const rear = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.27, 0.08), mahoganyPropMat);
  rear.position.set(0, 1.46, -0.1);
  g.add(rear);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.25, 0.2),
    new THREE.MeshStandardMaterial({
      color: '#d8f3ff',
      emissive: '#18b4ff',
      emissiveIntensity: 0.65,
      roughness: 0.2,
      side: THREE.DoubleSide,
    })
  );
  glass.position.set(0, 1.46, -0.146);
  g.add(glass);

  const bellows = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.21, 0.22),
    new THREE.MeshStandardMaterial({ color: '#191c22', roughness: 0.85 })
  );
  bellows.position.set(0, 1.45, 0.04);
  g.add(bellows);

  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.078, 0.13, 16), brassPropMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 1.45, 0.22);
  g.add(lens);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), brassPropMat);
  bulb.position.set(0.23, 1.38, 0.05);
  g.add(bulb);

  return { group: g, glass, bulb };
}

// ---------------------------------------------------------------------------
// 4. Stage 1 — Plato Concentric Rings + 610 Real Word-Blocks + Severn Bridge
// ---------------------------------------------------------------------------
const RING_SCALE = 0.72;
const worldRoot = new THREE.Group();
scene.add(worldRoot);

const surfaceInteractMeshes = [];

// Ocean surface plane
const oceanGeo = new THREE.CircleGeometry(210, 96);
oceanGeo.rotateX(-Math.PI / 2);
const oceanMesh = new THREE.Mesh(oceanGeo, canalMat);
oceanMesh.position.y = -0.05;
oceanMesh.receiveShadow = true;
worldRoot.add(oceanMesh);

const PLATO_LAND_RINGS = [
  { id: 'atlantis-island', label: 'Atlantis Central Island · Consensus Commons', rIn: 0.0, rOut: 26.4 * RING_SCALE, color: '#dfd5be', y: 0.35 },
  { id: 'center-ring', label: 'The Center Ring · Repair & Recurrence', rIn: 30.6 * RING_SCALE, rOut: 37.4 * RING_SCALE, color: '#d5cab2', y: 0.32 },
  { id: 'baltimere-ring', label: 'Baltimere Outer Ring · Harbor Origins', rIn: 41.6 * RING_SCALE, rOut: 48.4 * RING_SCALE, color: '#cbc0a8', y: 0.28 },
  { id: 'outer-plain', label: 'Critias Plain & Mount Atlas Ridge', rIn: 52.6 * RING_SCALE, rOut: 64.0 * RING_SCALE, color: '#645c50', y: 0.22 },
];

const ringPickMeshes = [];
PLATO_LAND_RINGS.forEach((rg) => {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rg.rOut, 0, Math.PI * 2, false);
  if (rg.rIn > 0.01) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, rg.rIn, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false, curveSegments: 72 });
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: rg.color,
    emissive: '#000000',
    emissiveIntensity: 0.0,
    roughness: 0.76,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = rg.y;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.userData.ringId = rg.id;
  mesh.userData.ringLabel = rg.label;
  worldRoot.add(mesh);
  ringPickMeshes.push(mesh);

  [rg.rIn, rg.rOut].forEach((rad) => {
    if (rad < 0.5) return;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(rad, 0.09, 8, 96),
      new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 0.85, roughness: 0.3 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = rg.y + 0.03;
    worldRoot.add(rim);
  });
});

// Magic Ride Sea Canal Spine
const seaCanal = new THREE.Mesh(
  new THREE.BoxGeometry(3.4, 0.62, 34),
  new THREE.MeshStandardMaterial({ color: '#0d4f78', emissive: '#18b4ff', emissiveIntensity: 0.55, roughness: 0.15 })
);
seaCanal.position.set(0, 0.08, 33);
worldRoot.add(seaCanal);

// Stone Canal Bridge Arch + Severn Threshold Pavilion on Surface
const severnGroup = new THREE.Group();
worldRoot.add(severnGroup);

const bridgeMat = new THREE.MeshStandardMaterial({ color: '#e8dfc9', roughness: 0.58 });
const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.55, 6.8), bridgeMat);
bridgeDeck.position.set(0, 1.4, 25.6);
bridgeDeck.castShadow = true;
bridgeDeck.receiveShadow = true;
severnGroup.add(bridgeDeck);

const surfaceBridgeArchRib = new THREE.Mesh(
  new THREE.TorusGeometry(2.6, 0.34, 10, 32, Math.PI),
  new THREE.MeshStandardMaterial({ color: '#faf6eb', emissive: '#18b4ff', emissiveIntensity: 0.32, roughness: 0.4 })
);
surfaceBridgeArchRib.rotation.y = Math.PI / 2;
surfaceBridgeArchRib.position.set(0, 0.25, 25.6);
severnGroup.add(surfaceBridgeArchRib);

[-1.7, 1.7].forEach((bx) => {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 6.8), parchmentMat);
  rail.position.set(bx, 2.0, 25.6);
  severnGroup.add(rail);
});

const surfaceBridgeHit = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.0, 7.2), hitColliderMat);
surfaceBridgeHit.position.set(0, 1.6, 25.6);
surfaceBridgeHit.userData.interact = {
  kind: 'bridge-portal',
  anchor: new THREE.Vector3(0, 3.2, 25.6),
  getWhisper: () => ['Stone Canal Bridge Arch', 'Click to Cross into Nolli Block'],
};
severnGroup.add(surfaceBridgeHit);
surfaceInteractMeshes.push(surfaceBridgeHit);

// Surface Brass Camera Tripod on the Canal Quay (scaled subtly for surface + street shots)
const surfTripod = buildBrassTripodMesh();
surfTripod.group.position.set(3.4, 0.35, 29.2);
surfTripod.group.rotation.y = -2.7;
surfTripod.group.scale.setScalar(1.45);
severnGroup.add(surfTripod.group);

const surfTripodHit = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.8, 10), hitColliderMat);
surfTripodHit.position.set(3.4, 1.75, 29.2);
surfTripodHit.userData.interact = {
  kind: 'tripod',
  anchor: new THREE.Vector3(3.4, 3.2, 29.2),
  getWhisper: () => [`Brass Field Camera · ${getCurrentLookLabel()}`, 'Click for 23 Shaders · Shift+Click Expose Plate'],
};
severnGroup.add(surfTripodHit);
surfaceInteractMeshes.push(surfTripodHit);

// Severn Brick Threshold Pavilion at z = 19.2 (+4.00 m Salt Flood Line & Operable Door)
const severnMat = new THREE.MeshStandardMaterial({ map: floodWallTex, roughness: 0.68 });
const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(2.8, 7.6, 4.6), severnMat);
wallLeft.position.set(-2.4, 4.0, 19.2);
wallLeft.castShadow = true;
severnGroup.add(wallLeft);

const wallRight = new THREE.Mesh(new THREE.BoxGeometry(2.8, 7.6, 4.6), severnMat);
wallRight.position.set(2.4, 4.0, 19.2);
wallRight.castShadow = true;
severnGroup.add(wallRight);

const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.2, 4.6), severnMat);
lintel.position.set(0, 5.7, 19.2);
severnGroup.add(lintel);

const saltBandSurface = new THREE.Mesh(
  new THREE.BoxGeometry(8.2, 0.2, 4.88),
  new THREE.MeshStandardMaterial({ color: '#faf6eb', emissive: '#faf6eb', emissiveIntensity: 0.42, roughness: 0.38 })
);
saltBandSurface.position.set(0, 4.0, 19.2);
severnGroup.add(saltBandSurface);

// Carved +4.00 m Datum Tablet on Severn Wall (legible as camera dives past!)
const surfaceDatumSign = new THREE.Mesh(
  new THREE.PlaneGeometry(5.6, 1.4),
  new THREE.MeshBasicMaterial({
    map: makeInWorldPlaqueTexture('CHALKED FALL BOUNDARY', '+4.00 m Salt Flood Datum'),
    transparent: true,
  })
);
surfaceDatumSign.position.set(0, 4.95, 21.62);
severnGroup.add(surfaceDatumSign);

const surfaceDoorPivot = new THREE.Group();
surfaceDoorPivot.position.set(-0.95, 0.35, 21.4);
const surfaceDoorLeaf = new THREE.Mesh(
  new THREE.BoxGeometry(1.85, 3.1, 0.14),
  new THREE.MeshStandardMaterial({ color: '#cbb182', roughness: 0.45, metalness: 0.25 })
);
surfaceDoorLeaf.position.set(0.92, 1.55, 0);
surfaceDoorPivot.add(surfaceDoorLeaf);
severnGroup.add(surfaceDoorPivot);

const surfaceDoorHit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.8, 1.8), hitColliderMat);
surfaceDoorHit.position.set(0, 2.1, 21.2);
surfaceDoorHit.userData.interact = {
  kind: 'severn-door',
  anchor: new THREE.Vector3(0, 4.2, 21.4),
  getWhisper: () => [
    `Severn Threshold Door (${pilot.doorOpen ? 'Open' : 'Closed'})`,
    `Click to ${pilot.doorOpen ? 'Close' : 'Open'}`,
  ],
};
severnGroup.add(surfaceDoorHit);
surfaceInteractMeshes.push(surfaceDoorHit);

// 12-Step Stair descending -Z from Severn Threshold toward central lightwell
for (let st = 0; st < 12; st++) {
  const step = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.26, 0.55), parchmentMat);
  step.position.set(0, 1.2 - st * 0.22, 16.6 - st * 0.52);
  severnGroup.add(step);
}

// High-res circular plan.svg decal clipped cleanly inside Plato's outer ring (zero square corners in sea)
const svgGroundPlane = new THREE.Mesh(
  new THREE.CircleGeometry(26.2 * RING_SCALE, 72),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.34, depthWrite: false })
);
svgGroundPlane.rotation.x = -Math.PI / 2;
svgGroundPlane.position.set(0, 0.41, 0);
worldRoot.add(svgGroundPlane);

// Word-block meshes group + Hover Halo Ring
const blocksGroup = new THREE.Group();
worldRoot.add(blocksGroup);
const blockPickMeshes = [];
const blockMeshByIndex = new Map();

const hoverHalo = new THREE.Mesh(
  new THREE.TorusGeometry(1.35, 0.12, 10, 36),
  new THREE.MeshBasicMaterial({ color: '#5fe8ff' })
);
hoverHalo.rotation.x = Math.PI / 2;
hoverHalo.visible = false;
worldRoot.add(hoverHalo);

const ringHoverHalo = new THREE.Mesh(
  new THREE.TorusGeometry(18.0, 0.22, 10, 96),
  new THREE.MeshBasicMaterial({ color: '#f2a541' })
);
ringHoverHalo.rotation.x = Math.PI / 2;
ringHoverHalo.visible = false;
worldRoot.add(ringHoverHalo);

// ---------------------------------------------------------------------------
// 5. Descent Shaft, +4.00 m Seawall, Riveted Nautilus & Oulipo Courtyard (-38 m)
// ---------------------------------------------------------------------------
const abyssGroup = new THREE.Group();
scene.add(abyssGroup);

const courtyardInteractMeshes = [];

// Sunken Harbor Seawall Ring carrying the +4.00 m Salt Line down into the abyss
const seawallCyl = new THREE.Mesh(
  new THREE.CylinderGeometry(33.5, 36.0, 44.0, 64, 1, true),
  new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: '#20384c',
    roughness: 0.78,
    side: THREE.BackSide,
  })
);
seawallCyl.position.y = -17.5;
abyssGroup.add(seawallCyl);

// Luminous +4.00 m Flood Datum Ring on the seawall + In-World Seawall Inscription
const datumTorus = new THREE.Mesh(
  new THREE.TorusGeometry(33.2, 0.24, 10, 96),
  new THREE.MeshStandardMaterial({ color: '#faf6eb', emissive: '#faf6eb', emissiveIntensity: 0.72 })
);
datumTorus.rotation.x = Math.PI / 2;
datumTorus.position.y = 4.0;
abyssGroup.add(datumTorus);

const seawallDatumPlaque = new THREE.Mesh(
  new THREE.PlaneGeometry(9.2, 2.3),
  new THREE.MeshBasicMaterial({
    map: makeInWorldPlaqueTexture('NEVER PAINT OVER THE FLOOD LINE', '+4.00 m Salt Datum · Entering Abyss', '#f2a541'),
    transparent: true,
    side: THREE.DoubleSide,
  })
);
seawallDatumPlaque.position.set(-3.8, -2.8, 14.0);
seawallDatumPlaque.lookAt(6, 2, 26);
abyssGroup.add(seawallDatumPlaque);

// Obstructed Basalt Night-Walk Boulders & Mount Atlas Volcanic Lava Fissures (Verne Ch. IX)
const basaltMat = new THREE.MeshStandardMaterial({ color: '#242c35', roughness: 0.88 });
const lavaSeamMat = new THREE.MeshStandardMaterial({
  color: '#ff7a38',
  emissive: '#f25c19',
  emissiveIntensity: 2.3,
  roughness: 0.4,
});
for (let i = 0; i < 18; i++) {
  const ang = (i / 18) * Math.PI * 2;
  const rad = 18 + (i % 3) * 4.5;
  const by = -9 - (i % 6) * 4.4;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6 + (i % 3) * 0.7, 0), basaltMat);
  rock.position.set(Math.cos(ang) * rad, by, Math.sin(ang) * rad);
  rock.rotation.set(i * 0.5, i * 0.8, 0);
  abyssGroup.add(rock);

  if (i % 3 === 0) {
    const vein = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.22, 0.45), lavaSeamMat);
    vein.position.set(Math.cos(ang) * (rad - 1.2), by - 0.6, Math.sin(ang) * (rad - 1.2));
    vein.rotation.y = -ang;
    abyssGroup.add(vein);
  }
}

// Jules Verne's Riveted Iron Nautilus Submersible + Glowing Searchlight Beam (y = -17.5 m)
const nautilusGroup = new THREE.Group();
nautilusGroup.position.set(14.8, -17.2, 7.6);
nautilusGroup.rotation.y = -2.32;
abyssGroup.add(nautilusGroup);

const hullMat = new THREE.MeshStandardMaterial({ color: '#273542', roughness: 0.34, metalness: 0.82 });
const rivetMat = new THREE.MeshStandardMaterial({ color: '#8aa0b4', roughness: 0.28, metalness: 0.88 });
const hullBody = new THREE.Mesh(new THREE.CylinderGeometry(1.82, 1.82, 11.4, 24), hullMat);
hullBody.rotation.z = Math.PI / 2;
nautilusGroup.add(hullBody);

// Riveted Iron Hull Rings & Dorsal Ramming Rakers
for (let rx = -5.0; rx <= 5.0; rx += 1.65) {
  const rib = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.045, 8, 28), rivetMat);
  rib.rotation.y = Math.PI / 2;
  rib.position.x = rx;
  nautilusGroup.add(rib);
}
for (let k = 0; k < 7; k++) {
  const raker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.62, 4), rivetMat);
  raker.position.set(-3.2 + k * 0.95, 1.98, 0);
  raker.rotation.z = -0.35;
  nautilusGroup.add(raker);
}
[-5.7, 5.7].forEach((hx) => {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.82, 4.8, 24), hullMat);
  cone.rotation.z = hx > 0 ? -Math.PI / 2 : Math.PI / 2;
  cone.position.x = hx + (hx > 0 ? 2.4 : -2.4);
  nautilusGroup.add(cone);
});
const sternShroud = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 8, 24), brassPropMat);
sternShroud.rotation.y = Math.PI / 2;
sternShroud.position.x = -9.8;
nautilusGroup.add(sternShroud);

const wheelhouse = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.95, 1.2), hullMat);
wheelhouse.position.set(1.2, 1.95, 0);
nautilusGroup.add(wheelhouse);

// Glowing Salon Plate-Glass Window + Brass Mullion Ring
const salonPort = new THREE.Mesh(
  new THREE.CircleGeometry(1.02, 28),
  new THREE.MeshBasicMaterial({ color: '#aef7ff', side: THREE.DoubleSide })
);
salonPort.position.set(1.2, 0.2, 1.85);
nautilusGroup.add(salonPort);

const salonFrame = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.07, 8, 28), brassPropMat);
salonFrame.position.set(1.2, 0.2, 1.86);
nautilusGroup.add(salonFrame);

const beamGeo = new THREE.ConeGeometry(3.8, 22.0, 28, 1, true);
beamGeo.translate(0, -11.0, 0);
beamGeo.rotateX(-Math.PI / 2);
const beamMat = new THREE.MeshBasicMaterial({
  color: '#46e5ff',
  transparent: true,
  opacity: 0.11,
  side: THREE.FrontSide,
  depthWrite: false,
});
const nautilusBeam = new THREE.Mesh(beamGeo, beamMat);
nautilusBeam.position.set(1.2, 0.2, 1.9);
nautilusGroup.add(nautilusBeam);

// Glass-Dome Lightwell ("Nautilus-Well") crowning the Submerged Courtyard (Clickable to Ascend!)
const lightwellGroup = new THREE.Group();
lightwellGroup.position.set(0, -24.5, 0);
abyssGroup.add(lightwellGroup);

const domeMesh = new THREE.Mesh(
  new THREE.TorusGeometry(13.5, 0.22, 12, 72),
  new THREE.MeshStandardMaterial({
    color: '#8ce8ff',
    emissive: '#18b4ff',
    emissiveIntensity: 0.95,
    roughness: 0.2,
  })
);
domeMesh.rotation.x = Math.PI / 2;
lightwellGroup.add(domeMesh);

for (let rib = 0; rib < 8; rib++) {
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(13.5, 0.1, 8, 48, Math.PI),
    new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 0.8 })
  );
  arch.rotation.y = (rib / 8) * Math.PI;
  lightwellGroup.add(arch);
}

const lightwellHitDisk = new THREE.Mesh(new THREE.CircleGeometry(13.5, 32), hitColliderMat);
lightwellHitDisk.rotation.x = Math.PI / 2;
lightwellHitDisk.position.y = 3.2;
lightwellHitDisk.userData.interact = {
  kind: 'ascend-rings',
  anchor: new THREE.Vector3(0, -22.5, 0),
  getWhisper: () => ['Nautilus Glass Lightwell', 'Click or Scroll Up to Ascend to Plato Rings'],
};
lightwellGroup.add(lightwellHitDisk);
courtyardInteractMeshes.push(lightwellHitDisk);

// Submerged Oulipo Courtyard Floor (y = -38.0 m)
const FLOOR_Y = -38.0;
const courtyardFloor = new THREE.Mesh(
  new THREE.CircleGeometry(30.0, 64),
  new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: '#344958',
    roughness: 0.32,
    metalness: 0.18,
  })
);
courtyardFloor.rotation.x = -Math.PI / 2;
courtyardFloor.position.y = FLOOR_Y;
courtyardFloor.receiveShadow = true;
abyssGroup.add(courtyardFloor);

const nolliFloorInlay = new THREE.Mesh(
  new THREE.RingGeometry(8.2, 12.6, 64),
  new THREE.MeshStandardMaterial({ color: '#efe7d2', roughness: 0.52 })
);
nolliFloorInlay.rotation.x = -Math.PI / 2;
nolliFloorInlay.position.y = FLOOR_Y + 0.02;
abyssGroup.add(nolliFloorInlay);

// 16 Sunken Doric Columns with White Ceramic Kintsugi Sleeves & Cyan Seams
const colStoneMat = new THREE.MeshStandardMaterial({ color: '#c8c2b4', roughness: 0.58 });
const kintsugiSleeveMat = new THREE.MeshStandardMaterial({ color: '#f7f4ec', roughness: 0.34 });
const cyanSeamMat = new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 1.4 });

for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2;
  const rad = 13.8;
  const cx = Math.cos(a) * rad;
  const cz = Math.sin(a) * rad;
  const colGrp = new THREE.Group();
  colGrp.position.set(cx, FLOOR_Y, cz);

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.45, 1.35), colStoneMat);
  base.position.y = 0.225;
  colGrp.add(base);

  const colH = i % 5 === 2 ? 5.2 : 7.8;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, colH, 16), colStoneMat);
  shaft.position.y = 0.45 + colH / 2;
  shaft.castShadow = true;
  colGrp.add(shaft);

  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.56, 1.1, 16), kintsugiSleeveMat);
  sleeve.position.y = 2.4;
  colGrp.add(sleeve);

  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.03, 8, 24), cyanSeamMat);
  seam.rotation.x = Math.PI / 2;
  seam.position.y = 2.95;
  colGrp.add(seam);

  if (colH > 6.5) {
    const echinus = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.48, 0.36, 16), kintsugiSleeveMat);
    echinus.position.y = 0.45 + colH + 0.18;
    colGrp.add(echinus);
    const abacus = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.28, 1.52), colStoneMat);
    abacus.position.y = 0.45 + colH + 0.5;
    colGrp.add(abacus);
  }
  abyssGroup.add(colGrp);
}

// Continuity Structure Underwater (South Side z = +15..+26.5) + East Canal Bridge Arch Portal
const subSevernGroup = new THREE.Group();
subSevernGroup.position.set(0, FLOOR_Y, 0);
abyssGroup.add(subSevernGroup);

for (let st = 0; st < 12; st++) {
  const tread = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.28, 0.56), kintsugiSleeveMat);
  tread.position.set(0, (11 - st) * 0.25 + 0.14, 21.8 - st * 0.54);
  subSevernGroup.add(tread);
}
const subStairHit = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.6, 7.0), hitColliderMat);
subStairHit.position.set(0, 1.8, 18.6);
subStairHit.userData.interact = {
  kind: 'ascend-rings',
  anchor: new THREE.Vector3(0, FLOOR_Y + 3.4, 18.6),
  getWhisper: () => ['12-Step Severn Stone Stair', 'Click or Scroll Up to Ascend to Plato Rings'],
};
subSevernGroup.add(subStairHit);
courtyardInteractMeshes.push(subStairHit);

[-2.1, 2.1].forEach((px) => {
  const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6.8, 1.4), colStoneMat);
  pier.position.set(px, 3.4, 22.4);
  subSevernGroup.add(pier);
});
const subLintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.6, 1.5), kintsugiSleeveMat);
subLintel.position.set(0, 6.2, 22.4);
subSevernGroup.add(subLintel);

const subDoorPivot = new THREE.Group();
subDoorPivot.position.set(-1.0, 3.0, 22.4);
const subDoorLeaf = new THREE.Mesh(
  new THREE.BoxGeometry(1.95, 2.9, 0.14),
  new THREE.MeshStandardMaterial({ color: '#cbb182', emissive: '#18b4ff', emissiveIntensity: 0.22, roughness: 0.4 })
);
subDoorLeaf.position.set(0.97, 1.45, 0);
subDoorPivot.add(subDoorLeaf);
subSevernGroup.add(subDoorPivot);

const subDoorHit = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.2, 2.2), hitColliderMat);
subDoorHit.position.set(0, 4.4, 22.4);
subDoorHit.userData.interact = {
  kind: 'severn-door',
  anchor: new THREE.Vector3(0, FLOOR_Y + 6.4, 22.4),
  getWhisper: () => [
    `Submerged Severn Doorway (${pilot.doorOpen ? 'Open' : 'Closed'})`,
    `Click to ${pilot.doorOpen ? 'Close' : 'Open'} Acoustic Seal`,
  ],
};
subSevernGroup.add(subDoorHit);
courtyardInteractMeshes.push(subDoorHit);

// Also place an Eastern Severn Threshold & Stone Canal Bridge Arch right inside the visible courtyard rim
// so visitors see both the Canal Bridge Arch and Severn Doorway without even needing to 180-turn, while preserving the South continuity stair!
const eastBridgeArch = new THREE.Group();
eastBridgeArch.position.set(10.8, FLOOR_Y, -3.6);
eastBridgeArch.rotation.y = -1.18;
abyssGroup.add(eastBridgeArch);

[-1.45, 1.45].forEach((px) => {
  const pier = new THREE.Mesh(new THREE.BoxGeometry(0.62, 4.4, 0.85), colStoneMat);
  pier.position.set(px, 2.2, 0);
  eastBridgeArch.add(pier);
});
const eastArchCrown = new THREE.Mesh(
  new THREE.TorusGeometry(1.45, 0.28, 10, 32, Math.PI),
  kintsugiSleeveMat
);
eastArchCrown.position.set(0, 4.35, 0);
eastBridgeArch.add(eastArchCrown);
const eastArchSeam = new THREE.Mesh(
  new THREE.TorusGeometry(1.48, 0.05, 8, 32, Math.PI),
  cyanSeamMat
);
eastArchSeam.position.set(0, 4.35, 0.44);
eastBridgeArch.add(eastArchSeam);
const eastArchVeil = new THREE.Mesh(
  new THREE.PlaneGeometry(2.3, 4.2),
  new THREE.MeshBasicMaterial({ color: '#18b4ff', transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
);
eastArchVeil.position.set(0, 2.15, 0);
eastBridgeArch.add(eastArchVeil);

const eastBridgeHit = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5.8, 1.8), hitColliderMat);
eastBridgeHit.position.set(0, 2.9, 0);
eastBridgeHit.userData.interact = {
  kind: 'bridge-portal',
  anchor: new THREE.Vector3(10.8, FLOOR_Y + 6.1, -3.6),
  getWhisper: () => ['Stone Canal Bridge Arch', 'Click to Cross into The Nolli Block'],
};
eastBridgeArch.add(eastBridgeHit);
courtyardInteractMeshes.push(eastBridgeHit);

// South Submerged Canal Bridge Piers & Arch (z = 26.5)
[-2.4, 2.4].forEach((bx) => {
  const bPier = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 14.0, 14), colStoneMat);
  bPier.position.set(bx, 7.0, 26.5);
  subSevernGroup.add(bPier);
});
const subBridgeArch = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.9, 3.2), kintsugiSleeveMat);
subBridgeArch.position.set(0, 13.8, 26.5);
subSevernGroup.add(subBridgeArch);

const southBridgeHit = new THREE.Mesh(new THREE.BoxGeometry(6.8, 14.2, 3.8), hitColliderMat);
southBridgeHit.position.set(0, 7.1, 26.5);
southBridgeHit.userData.interact = {
  kind: 'bridge-portal',
  anchor: new THREE.Vector3(0, FLOOR_Y + 14.6, 26.5),
  getWhisper: () => ['Stone Canal Bridge Arch', 'Click to Cross into The Nolli Block'],
};
subSevernGroup.add(southBridgeHit);
courtyardInteractMeshes.push(southBridgeHit);

// Shared 8x10 Brass Camera Tripod in Submerged Courtyard (via createWorldPortalAndTripod, >5m from arrival pos)
const worldRig = createWorldPortalAndTripod({
  THREE,
  scene,
  camera,
  domElement: renderer.domElement,
  suite,
  tripodPos: { x: -4.8, y: FLOOR_Y, z: 5.8, rotY: 0.45 },
  portals: [],
  onTripodClick: ({ expose }) => {
    if (expose) {
      triggerShutterFlash();
      refreshPlayerPlates();
      drawOulipoScreenCanvas(performance.now() * 0.001);
    }
  },
});

// Courtyard Kit Furniture
const kitPlacements = [
  { name: 'bench', x: -3.2, z: 4.5, ry: Math.PI },
  { name: 'bench', x: 3.2, z: 4.5, ry: Math.PI },
  { name: 'bench', x: -3.2, z: 8.2, ry: Math.PI },
  { name: 'bench', x: 3.2, z: 8.2, ry: Math.PI },
  { name: 'tide lamp', x: -7.8, z: -5.5, ry: 0 },
  { name: 'tide lamp', x: 7.8, z: -5.5, ry: 0 },
  { name: 'tide board', x: 8.6, z: 6.2, ry: -0.55 },
  { name: 'line post', x: -8.6, z: 6.2, ry: 0.45 },
  { name: 'salt fountain', x: 0.0, z: 11.8, ry: 0 },
];
kitPlacements.forEach((kp) => {
  const obj = buildObject(kp.name);
  obj.position.set(kp.x, FLOOR_Y, kp.z);
  obj.rotation.y = kp.ry;
  abyssGroup.add(obj);
});

// Bioluminescent Pelagic Silt Particles
const siltCount = 520;
const siltGeo = new THREE.BufferGeometry();
const siltPos = new Float32Array(siltCount * 3);
for (let i = 0; i < siltCount; i++) {
  siltPos[i * 3] = (Math.random() - 0.5) * 62;
  siltPos[i * 3 + 1] = -38 + Math.random() * 44;
  siltPos[i * 3 + 2] = (Math.random() - 0.5) * 62;
}
siltGeo.setAttribute('position', new THREE.BufferAttribute(siltPos, 3));
const siltParticles = new THREE.Points(
  siltGeo,
  new THREE.PointsMaterial({ color: '#5fe8ff', size: 0.16, transparent: true, opacity: 0.62 })
);
abyssGroup.add(siltParticles);

// ---------------------------------------------------------------------------
// 6. 3D 35mm Reels Projector + Stretched Linen Oulipo Screening Sheet
// ---------------------------------------------------------------------------
const projectorGroup = new THREE.Group();
projectorGroup.position.set(0, FLOOR_Y, 1.85);
abyssGroup.add(projectorGroup);

// Cast-iron pedestal & brass lamp housing
const projPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.34, 1.32, 14), hullMat);
projPedestal.position.y = 0.66;
projectorGroup.add(projPedestal);

const projBody = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.44, 0.58), hullMat);
projBody.position.set(0, 1.48, 0);
projectorGroup.add(projBody);

const projLens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.28, 16), brassPropMat);
projLens.rotation.x = Math.PI / 2;
projLens.position.set(0, 1.52, -0.38);
projectorGroup.add(projLens);

const projReelFront = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 24), brassPropMat);
projReelFront.rotation.z = Math.PI / 2;
projReelFront.position.set(0, 1.88, -0.22);
projectorGroup.add(projReelFront);

const projReelRear = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 24), brassPropMat);
projReelRear.rotation.z = Math.PI / 2;
projReelRear.position.set(0, 1.88, 0.24);
projectorGroup.add(projReelRear);

const projConeGeo = new THREE.ConeGeometry(2.9, 11.2, 24, 1, true);
projConeGeo.translate(0, -5.6, 0);
projConeGeo.rotateX(Math.PI / 2);
const projBeamMesh = new THREE.Mesh(
  projConeGeo,
  new THREE.MeshBasicMaterial({
    color: '#7ce8ff',
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
  })
);
projBeamMesh.position.set(0, 1.52, -0.48);
projectorGroup.add(projBeamMesh);

const projectorHit = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 2.25, 12), hitColliderMat);
projectorHit.position.set(0, 1.12, 0);
projectorHit.userData.interact = {
  kind: 'cycle-oulipo-cut',
  anchor: new THREE.Vector3(0, FLOOR_Y + 2.35, 1.85),
  getWhisper: () => [
    `35mm Oulipo Projector · ${CUT_LABELS[state.cutMode]}`,
    'Click to Cycle Cut · Shift+Click Next SCION Work',
  ],
};
projectorGroup.add(projectorHit);
courtyardInteractMeshes.push(projectorHit);

// Stretched Linen Projection Sheet (z = -9.8)
const screenCanvas = document.createElement('canvas');
screenCanvas.width = 1280;
screenCanvas.height = 720;
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

const screenFrame = new THREE.Group();
screenFrame.position.set(0, FLOOR_Y, -9.8);
abyssGroup.add(screenFrame);

[-5.2, 5.2].forEach((sx) => {
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7.6, 12), hullMat);
  mast.position.set(sx, 3.8, 0);
  screenFrame.add(mast);
});
const topBar = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.18, 0.18), cyanSeamMat);
topBar.position.set(0, 7.45, 0);
screenFrame.add(topBar);

const screenSheet = new THREE.Mesh(
  new THREE.PlaneGeometry(9.8, 5.5),
  new THREE.MeshBasicMaterial({ map: screenTex, side: THREE.DoubleSide })
);
screenSheet.position.set(0, 4.35, 0.06);
screenSheet.userData.interact = {
  kind: 'cycle-oulipo-cut',
  anchor: new THREE.Vector3(0, FLOOR_Y + 7.75, -9.8),
  getWhisper: () => [
    `Oulipo Linen Screen · ${CUT_LABELS[state.cutMode]}`,
    'Click to Cycle Cut A / Cut B / Palindrome / Fibonacci',
  ],
};
screenFrame.add(screenSheet);
courtyardInteractMeshes.push(screenSheet);

// ---------------------------------------------------------------------------
// 7. 5 Clothed Anny V9 Chorus / Spectators + V9 Winged Poet Hero + P06-S01 Winged Gate Portal
// ---------------------------------------------------------------------------
const CAST_DEFS = [
  { id: 'poet', v9Role: 'chorus', archetype: 'adult_m', postureClip: 'idle-talking', name: 'The Poet', role: 'Dry Voice Spine', skin: '#613d2b', coat: '#182430', x: -2.6, z: -3.1, ry: 0.44 },
  { id: 'carrier', v9Role: 'imani', archetype: 'adult_f', postureClip: 'pray', name: 'Codex Carrier', role: 'Twin Sung Voice', skin: '#543525', coat: '#243c4c', x: 2.6, z: -3.1, ry: -0.44 },
  { id: 'bekele', v9Role: 'bekele', archetype: 'elder', postureClip: 'sit-talk', name: 'Bekele', role: 'Archive Keeper', skin: '#68432f', coat: '#3c3428', x: -3.2, z: 4.35, ry: 0.14 },
  { id: 'maren', v9Role: 'maren', archetype: 'adult_f', postureClip: 'listen', name: 'Maren', role: 'Severn 2A Witness', skin: '#7a523c', coat: '#2e4652', x: 3.1, z: 3.85, ry: -2.85 },
  { id: 'june', v9Role: 'june', archetype: 'child7', postureClip: 'greet', name: 'June', role: 'Oulipo Projectionist', skin: '#4f3122', coat: '#1e3240', x: 1.35, z: 2.05, ry: 2.95 },
];

const castKeyLight = new THREE.PointLight('#ffe2b8', 24, 24, 1.4);
castKeyLight.position.set(-1.2, FLOOR_Y + 4.8, 2.8);
abyssGroup.add(castKeyLight);

const castActors = [];
let poetHeroActor = null;
const wingedGatePivots = [];

function buildWingedGatePortalMesh(scaleFactor = 1.0) {
  const grp = new THREE.Group();
  grp.scale.setScalar(scaleFactor);

  const marbleMat = new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.34, metalness: 0.06 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: '#e3b760',
    emissive: '#4d350c',
    emissiveIntensity: 0.28,
    roughness: 0.22,
    metalness: 0.88,
  });
  const veilMat = new THREE.MeshBasicMaterial({
    color: '#24d4ff',
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.22, 0.96), marbleMat);
  plinth.position.y = 0.11;
  plinth.receiveShadow = true;
  grp.add(plinth);

  for (const sx of [-1.2, 1.2]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 3.4, 16), marbleMat);
    col.position.set(sx, 1.92, 0);
    col.castShadow = true;
    grp.add(col);

    for (const sy of [1.25, 2.55]) {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 8, 22), goldMat);
      seam.rotation.x = Math.PI / 2;
      seam.position.set(sx, sy, 0);
      grp.add(seam);
    }

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.24, 0.54), marbleMat);
    cap.position.set(sx, 3.74, 0);
    grp.add(cap);
  }

  const lintelBar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 0.6), marbleMat);
  lintelBar.position.set(0, 4.0, 0);
  grp.add(lintelBar);

  const archCrown = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.18, 12, 36, Math.PI), marbleMat);
  archCrown.position.set(0, 4.02, 0);
  grp.add(archCrown);

  const goldSeamArch = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.03, 8, 36, Math.PI), goldMat);
  goldSeamArch.position.set(0, 4.02, 0.16);
  grp.add(goldSeamArch);

  const veil = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 3.55), veilMat);
  veil.position.set(0, 2.0, 0);
  grp.add(veil);

  const texLoader = new THREE.TextureLoader();
  const wingTexL = texLoader.load('../hero-build/assets/wings/08.cast.angel.wings__p07.png');
  const wingTexR = texLoader.load('../hero-build/assets/wings/08.cast.angel.wings__p08.png');
  wingTexL.colorSpace = THREE.SRGBColorSpace;
  wingTexR.colorSpace = THREE.SRGBColorSpace;

  const makeShoulderWing = (sx, wTex) => {
    const piv = new THREE.Group();
    piv.position.set(sx * 1.24, 4.06, -0.04);

    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(1.85, 1.35),
      new THREE.MeshStandardMaterial({
        map: wTex,
        transparent: true,
        alphaTest: 0.06,
        roughness: 0.45,
        side: THREE.DoubleSide,
      })
    );
    card.position.set(sx * 0.86, 0.46, -0.03);
    if (sx < 0) card.scale.x = -1;
    piv.add(card);

    for (let f = 0; f < 6; f++) {
      const frac = f / 5;
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 1.05 - frac * 0.18, 5),
        f === 0 ? goldMat : marbleMat
      );
      blade.position.set(sx * (0.25 + frac * 1.02), 0.30 + frac * 0.18, 0.02);
      blade.rotation.z = sx * (-0.50 - frac * 0.56);
      blade.scale.set(1.0, 1.0, 0.28);
      piv.add(blade);
    }
    grp.add(piv);
    return piv;
  };

  const pivL = makeShoulderWing(-1, wingTexR);
  const pivR = makeShoulderWing(1, wingTexL);
  wingedGatePivots.push({ pivL, pivR, veilMat });

  return grp;
}

// 1) Submerged Kintsugi Courtyard 3D Marble Winged Gate Portal -> ../stage/#P06-S01
const subWingedGate = buildWingedGatePortalMesh(1.0);
subWingedGate.position.set(-9.4, FLOOR_Y, -4.6);
subWingedGate.rotation.y = 0.84;
abyssGroup.add(subWingedGate);

const subWingedGateHit = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5.4, 1.6), hitColliderMat);
subWingedGateHit.position.set(0, 2.7, 0);
subWingedGateHit.userData.interact = {
  kind: 'winged-stage-portal',
  anchor: new THREE.Vector3(-9.4, FLOOR_Y + 5.6, -4.6),
  getWhisper: () => ['P06-S01 Marble Winged Gate', 'Click to Enter Hero Stage (../stage/#P06-S01)'],
};
subWingedGate.add(subWingedGateHit);
courtyardInteractMeshes.push(subWingedGateHit);

// 2) Surface Plato Ring Quay 3D Marble Winged Gate Portal -> ../stage/#P06-S01
const surfWingedGate = buildWingedGatePortalMesh(0.92);
surfWingedGate.position.set(-5.2, 0.35, 24.8);
surfWingedGate.rotation.y = 0.34;
severnGroup.add(surfWingedGate);

const surfWingedGateHit = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5.2, 1.6), hitColliderMat);
surfWingedGateHit.position.set(0, 2.6, 0);
surfWingedGateHit.userData.interact = {
  kind: 'winged-stage-portal',
  anchor: new THREE.Vector3(-5.2, 5.3, 24.8),
  getWhisper: () => ['P06-S01 Marble Winged Gate', 'Click to Enter Hero Stage (../stage/#P06-S01)'],
};
surfWingedGate.add(surfWingedGateHit);
surfaceInteractMeshes.push(surfWingedGateHit);

const parcelMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.36, 0.24, 0.28),
  new THREE.MeshStandardMaterial({ color: '#e0b46a', emissive: '#f2a541', emissiveIntensity: 0.42, roughness: 0.36 })
);
parcelMesh.userData.interact = {
  kind: 'cycle-parcel',
  anchor: new THREE.Vector3(0, FLOOR_Y + 1.5, 4.0),
  getWhisper: () => [`Sealed Severn Parcel (${pilot.parcelHolder})`, 'Click to Hand Off Parcel'],
};
abyssGroup.add(parcelMesh);
courtyardInteractMeshes.push(parcelMesh);

// Subtle glowing ring on floor beneath whichever speaker is currently singing
const speakerFloorRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.56, 0.035, 8, 32),
  new THREE.MeshBasicMaterial({ color: '#7ce8ff' })
);
speakerFloorRing.rotation.x = Math.PI / 2;
speakerFloorRing.visible = false;
abyssGroup.add(speakerFloorRing);

function spawnCast() {
  CAST_DEFS.forEach((def, idx) => {
    const root = new THREE.Group();
    root.position.set(def.x, FLOOR_Y, def.z);
    root.rotation.y = def.ry;
    abyssGroup.add(root);

    const proxy = new THREE.Group();
    const coatMat = new THREE.MeshStandardMaterial({ color: def.coat, roughness: 0.72 });
    const skinMat = new THREE.MeshStandardMaterial({ color: def.skin, roughness: 0.62 });
    const hScale = def.archetype === 'child7' ? 0.78 : 1.0;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19 * hScale, 0.25 * hScale, 0.84 * hScale, 12), coatMat);
    torso.position.y = 1.05 * hScale;
    proxy.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14 * hScale, 12, 10), skinMat);
    head.position.y = 1.62 * hScale;
    proxy.add(head);
    [-0.09, 0.09].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * hScale, 0.05 * hScale, 0.64 * hScale, 8), coatMat);
      leg.position.set(lx * hScale, 0.32 * hScale, 0);
      proxy.add(leg);
    });
    root.add(proxy);

    const actor = {
      id: def.id,
      def,
      root,
      proxy,
      v8: null,
      v9: null,
      postureClip: def.postureClip,
      currentClip: def.postureClip,
      hScale,
      phase: idx * 1.3,
    };
    castActors.push(actor);

    const hitCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1.95 * hScale, 10), hitColliderMat);
    hitCyl.position.y = 0.98 * hScale;
    hitCyl.userData.interact = {
      kind: 'chorus-actor',
      actor,
      anchor: new THREE.Vector3(def.x, FLOOR_Y + 1.95 * hScale, def.z),
      getWhisper: () => [
        `${def.name} · ${def.role}`,
        `Click for 2-Voice Codex Duet (Poem ${state.selectedPoem})`,
      ],
    };
    root.add(hitCyl);
    courtyardInteractMeshes.push(hitCyl);

    createHeroOrCastV9({
      THREE,
      loader: gltfLoader,
      role: def.v9Role,
      archetype: def.archetype,
      groundY: FLOOR_Y,
      initialClip: def.postureClip,
      glasses: false,
      wingsMode: 'off',
      prop: 'none',
      seed: 40 + idx * 17,
    })
      .then((inst) => {
        if (!inst) return;
        inst.root.position.set(0, 0, 0);
        inst.root.rotation.set(0, 0, 0);
        root.add(inst.root);
        proxy.visible = false;
        actor.v9 = inst;
        actor.v8 = inst;
        inst.setGroundY(FLOOR_Y);
        inst.playAction(def.postureClip, 0.25);
      })
      .catch(() => {});
  });

  // Spawn V9 Poet Hero (with P06-S01 Marble/Angel Evolutionary Wings!) at the Kintsugi Courtyard Threshold
  const heroDef = {
    id: 'poet_hero',
    name: 'Atlantis Poet Hero',
    role: 'P06-S01 Marble Winged Threshold',
    x: -5.45,
    z: -3.75,
    ry: 0.58,
  };
  const heroRoot = new THREE.Group();
  heroRoot.position.set(heroDef.x, FLOOR_Y, heroDef.z);
  heroRoot.rotation.y = heroDef.ry;
  abyssGroup.add(heroRoot);

  const heroProxy = new THREE.Group();
  const hpTorso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.25, 0.86, 12),
    new THREE.MeshStandardMaterial({ color: '#181d2c', roughness: 0.65 })
  );
  hpTorso.position.y = 1.08;
  const hpHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#613d2b', roughness: 0.6 })
  );
  hpHead.position.y = 1.64;
  heroProxy.add(hpTorso, hpHead);
  heroRoot.add(heroProxy);

  poetHeroActor = {
    id: heroDef.id,
    def: heroDef,
    root: heroRoot,
    proxy: heroProxy,
    v8: null,
    v9: null,
    postureClip: 'greet',
    currentClip: 'greet',
    hScale: 1.0,
    evoSeed: 6,
  };
  castActors.push(poetHeroActor);

  const heroHit = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 2.02, 12), hitColliderMat);
  heroHit.position.y = 1.01;
  heroHit.userData.interact = {
    kind: 'poet-hero',
    actor: poetHeroActor,
    anchor: new THREE.Vector3(heroDef.x, FLOOR_Y + 2.08, heroDef.z),
    getWhisper: () => [
      `V9 Poet Hero · Wings: ${poetHeroActor.v9 ? poetHeroActor.v9.getWingsMode() : 'marble'}`,
      'Click to Sing P06 Duet & Evolve Marble / Angel Wings',
    ],
  };
  heroRoot.add(heroHit);
  courtyardInteractMeshes.push(heroHit);

  createHeroOrCastV9({
    THREE,
    loader: gltfLoader,
    role: 'poet_hero',
    wingsMode: 'marble',
    glasses: true,
    prop: 'lantern',
    groundY: FLOOR_Y,
    initialClip: 'greet',
    bgLuminance: 0.18,
    seed: 606,
  })
    .then((inst) => {
      if (!inst) return;
      inst.root.position.set(0, 0, 0);
      inst.root.rotation.set(0, 0, 0);
      heroRoot.add(inst.root);
      heroProxy.visible = false;
      poetHeroActor.v9 = inst;
      poetHeroActor.v8 = inst;
      inst.setGroundY(FLOOR_Y);
    })
    .catch(() => {});
}
spawnCast();

// ---------------------------------------------------------------------------
// 8. Oulipo Shot Pool + Player-Captured Plates (make_photo_city_nolli_v1)
// ---------------------------------------------------------------------------
const BASE_SHOT_POOL = [
  { slot: 1, reslot: 6, fr: "L'horloge", en: 'Dispatcher Wall Clock', palette: ['#0c1f38', '#18b4ff', '#f4eedd'] },
  { slot: 2, reslot: 3, fr: 'Le colis', en: 'Hand Carrying Sealed Parcel', palette: ['#1d2b3a', '#e0b46a', '#f4eedd'] },
  { slot: 3, reslot: 5, fr: 'La trotteuse', en: 'Conductor Second Hand', palette: ['#132840', '#5fe8ff', '#dfd3bc'] },
  { slot: 4, reslot: 2, fr: 'La porte', en: 'Severn Threshold Doorway', palette: ['#2b1e1a', '#f2a541', '#f4eedd'] },
  { slot: 5, reslot: 1, fr: 'Le regard', en: 'Witness Glance Across Canal', palette: ['#0f263c', '#18b4ff', '#e8dec8'] },
  { slot: 6, reslot: 4, fr: 'Le recu', en: 'Tide Office Counter Slips', palette: ['#14303e', '#5fe8ff', '#ecebe4'] },
  { slot: 7, reslot: 7, fr: 'La sortie', en: 'Departure Along Salt Stair', palette: ['#1b2836', '#c74a3a', '#f4eedd'] },
  { slot: 8, reslot: 8, fr: 'Le seuil', en: 'Submerged Courtyard Threshold', palette: ['#08182c', '#24e0ff', '#f4eedd'] },
];

const playerPlateImages = [];
function refreshPlayerPlates() {
  playerPlateImages.length = 0;
  try {
    const raw = localStorage.getItem(NOLLI_LEDGER_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    (parsed.plates || []).slice(-6).forEach((p) => {
      if (p && p.dataUrl) {
        const im = new Image();
        im.src = p.dataUrl;
        playerPlateImages.push({ img: im, caption: p.location || p.lookName || 'Player Field Plate' });
      }
    });
  } catch {}
}
refreshPlayerPlates();

// ---------------------------------------------------------------------------
// 9. Clean Freesound Hydrophone + Strict 2-Voice Turn-Taking Codex Duet Engine
//    (delaySend = 0, speech-ducked hydrophone bed, lyric floating in 3D space!)
// ---------------------------------------------------------------------------
class CleanCodexDuetEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.roomFilter = null;
    this.duckGain = null;
    this.convolver = null;
    this.speakingRole = null; // null | 'poet' | 'breath' | 'carrier'
    this.speakingActor = null;
    this.currentLyric = '';
    this.currentSpeakerLabel = '';
    this.currentSubtitle = '';
    this.stopToken = 0;
  }

  async ensureStarted() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);

      this.roomFilter = this.ctx.createBiquadFilter();
      this.roomFilter.type = 'lowpass';
      this.roomFilter.frequency.value = pilot.doorOpen ? 1050 : 460;

      this.duckGain = this.ctx.createGain();
      this.duckGain.gain.value = 0.34;

      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = this._createCalmStoneImpulse(1.3, 3.1);
      const revGain = this.ctx.createGain();
      revGain.gain.value = 0.22;

      this.roomFilter.connect(this.duckGain);
      this.duckGain.connect(this.master);
      this.duckGain.connect(this.convolver);
      this.convolver.connect(revGain);
      revGain.connect(this.master);

      await this._startFreesoundHydrophoneBed();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  _createCalmStoneImpulse(dur, decay) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * 0.22;
      }
    }
    return buf;
  }

  async _startFreesoundHydrophoneBed() {
    const loadLoop = async (url, rate, gainVal) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const arr = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(arr);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.playbackRate.value = rate;
        const g = this.ctx.createGain();
        g.gain.value = gainVal;
        src.connect(g);
        g.connect(this.roomFilter);
        src.start(0);
        return src;
      } catch {
        return null;
      }
    };
    await loadLoop('../../audio/samples/river_gorge.mp3', 0.68, 0.36);
    await loadLoop('../../audio/samples/ethiopia_field.mp3', 0.82, 0.14);
  }

  syncDoorAndDepth(doorOpen, depthT) {
    if (!this.ctx || !this.roomFilter) return;
    const baseHz = depthT > 0.45 ? 920 : 2800;
    const cutoff = doorOpen ? baseHz : Math.min(440, baseHz * 0.46);
    this.roomFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.18);
  }

  _setDucking(isSpeaking) {
    if (!this.ctx || !this.duckGain) return;
    const buses = (pilot && pilot.audioBuses) || {};
    const ambBase = Number.isFinite(buses.localAmbience) ? buses.localAmbience * 0.55 : 0.32;
    const target = isSpeaking ? ambBase * 0.28 : ambBase;
    this.duckGain.gain.setTargetAtTime(target, this.ctx.currentTime, isSpeaking ? 0.04 : 0.28);
  }

  _speakSingleTurn(text, role, actorObj, pitch, rate, token) {
    return new Promise((resolve) => {
      if (token !== this.stopToken) {
        resolve();
        return;
      }
      this.speakingRole = role;
      this.speakingActor = actorObj;
      this.currentSpeakerLabel = `${actorObj ? actorObj.def.name : role.toUpperCase()} · ${role === 'poet' ? 'DRY VOICE' : 'SUNG CARRIER'} (0 ECHO)`;
      this.currentLyric = `"${text}"`;
      this.currentSubtitle = `${role === 'poet' ? 'POET' : 'CARRIER'}: "${text}"`;
      this._setDucking(true);

      const fallbackMs = Math.max(1800, Math.min(4800, text.length * 52));
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const timer = setTimeout(done, fallbackMs);

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.pitch = pitch;
          u.rate = rate;
          u.volume = Math.min(1, ((pilot.audioBuses && pilot.audioBuses.voice) ?? 0.9));
          u.onend = () => {
            clearTimeout(timer);
            done();
          };
          u.onerror = () => {
            clearTimeout(timer);
            done();
          };
          window.speechSynthesis.speak(u);
        } catch {}
      }
    });
  }

  async playDuetForClickedActor(clickedActor, lineObj) {
    await this.ensureStarted();
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(0.85, this.ctx.currentTime, 0.1);
    }
    const token = ++this.stopToken;
    const text = (lineObj && lineObj.text) || 'The gates open with wings gifted from evolution, and made of marble stones.';
    const replyText = (lineObj && lineObj.heard) || text;
    const f0 = (lineObj && lineObj.voice && lineObj.voice.f0) || 185;
    const carrierPitch = Math.max(0.76, Math.min(1.42, f0 / 155));

    const poetActor =
      clickedActor && clickedActor.id !== 'carrier'
        ? clickedActor
        : castActors.find((a) => a.id === 'poet') || castActors[0];
    const carrierActor =
      clickedActor && clickedActor.id === 'carrier'
        ? clickedActor
        : castActors.find((a) => a.id === 'carrier') || castActors[1];

    await this._speakSingleTurn(text, 'poet', poetActor, 0.94, 0.93, token);
    if (token !== this.stopToken) return;

    this.speakingRole = 'breath';
    this.speakingActor = null;
    this.currentLyric = '';
    this._setDucking(false);
    await new Promise((r) => setTimeout(r, 450));
    if (token !== this.stopToken) return;

    await this._speakSingleTurn(replyText, 'carrier', carrierActor, carrierPitch, 0.88, token);
    if (token === this.stopToken) {
      this.speakingRole = null;
      this.speakingActor = null;
      this.currentLyric = '';
      this._setDucking(false);
    }
  }
}

const duetEngine = new CleanCodexDuetEngine();

// ---------------------------------------------------------------------------
// 10. Dive Trajectory, Depth Atmosphere & Courtyard Walk
// ---------------------------------------------------------------------------
const DIVE_CURVE_POS = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 56, 52),
  new THREE.Vector3(5, 22, 35),
  new THREE.Vector3(9, 4.1, 26),
  new THREE.Vector3(-8, -16, 21),
  new THREE.Vector3(5, -26, 16),
  new THREE.Vector3(0, -35.6, 12.8),
]);

const DIVE_CURVE_LOOK = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0.8, 5),
  new THREE.Vector3(0, 2.8, 19.2),
  new THREE.Vector3(0, 3.8, 16),
  new THREE.Vector3(9, -18, 4),
  new THREE.Vector3(0, -32, -5),
  new THREE.Vector3(0, -34.2, -9.8),
]);

function applyAtmosphereForDepth(depthT, preset) {
  const topSky = new THREE.Color((preset && preset.skyTop) || '#0a1d35');
  const abyssCol = new THREE.Color('#061528');
  const c = topSky.clone().lerp(abyssCol, Math.min(1, depthT * 1.25));
  scene.background.copy(c);
  scene.fog.color.copy(c);
  scene.fog.density = 0.0046 + depthT * 0.0108;
  nautilusBeam.material.opacity = depthT > 0.2 ? 0.12 : 0.04;
  duetEngine.syncDoorAndDepth(pilot.doorOpen, depthT);
}

function syncNotesReadout() {
  const elevM = 14.0 - state.depthT * 52.0;
  const tag =
    state.depthT < 0.18
      ? 'Surface Ring Plan'
      : state.depthT < 0.48
        ? '+4.00 m Salt Flood Datum'
        : state.depthT < 0.86
          ? 'Verne Nautilus Abyss'
          : 'Submerged Oulipo Courtyard';
  const dl = document.getElementById('notes-depth-line');
  if (dl) dl.textContent = `Depth: ${elevM >= 0 ? '+' : ''}${elevM.toFixed(1)} m · ${tag}`;
  const pl = document.getElementById('notes-pilot-line');
  if (pl) {
    pl.textContent = `Severn Door: ${pilot.doorOpen ? 'Open' : 'Closed'} | Poem: ${state.selectedPoem} (${POEM_TITLES[state.selectedPoem] || ''}) | ${CUT_LABELS[state.cutMode]}`;
  }
}

function setDepthProgress(t) {
  state.depthT = Math.max(0, Math.min(1, t));
  state.stage = state.depthT < 0.18 ? 'ring' : state.depthT > 0.88 ? 'screening' : 'dive';
  applyAtmosphereForDepth(state.depthT, suite.timePresets[currentTimePresetKey]);
  syncNotesReadout();
}

function startDiveTo(targetT) {
  state.targetDepthT = Math.max(0, Math.min(1, targetT));
  state.animatingDive = true;
  if (state.targetDepthT < 0.15 || state.targetDepthT > 0.85) {
    state.walkOffset.set(0, 0, 0);
    state.lookYaw = 0;
    state.lookPitch = 0;
  }
}

// ---------------------------------------------------------------------------
// 11. Build 610 Real 3D Word-Blocks & 52 Carved White Public Buildings
// ---------------------------------------------------------------------------
const POEM_RING_COLORS = {
  '06': '#c97a53',
  '07': '#3b7fa8',
  '08': '#be6d4e',
  '09': '#8d5b8c',
  '11': '#b56345',
  '03': '#4d7894',
  '04': '#5d6e84',
  '05': '#6e648c',
  '12': '#c49b6c',
  '01': '#7c4c3e',
  '02': '#385d8a',
  '13': '#487688',
  '14': '#8f5d46',
  '10': '#d9823b',
};

function buildExtrudedBlocks(plan) {
  for (const b of plan.blocks) {
    const gm = b.geom;
    if (!gm) continue;
    const dur = Math.max(0.2, (b.e || 1) - (b.s || 0));
    const bh = b.pub ? 1.95 : 0.68 + Math.min(1.6, dur * 0.28);

    // Individual material per block so raycast hover gently illuminates that exact 3D building cleanly
    const baseCol = b.pub ? '#faf6eb' : POEM_RING_COLORS[b.num] || '#7a6855';
    const mat = new THREE.MeshStandardMaterial({
      color: baseCol,
      emissive: b.pub ? '#18b4ff' : '#000000',
      emissiveIntensity: b.pub ? 0.16 : 0.0,
      roughness: b.pub ? 0.34 : 0.62,
      metalness: 0.06,
    });

    let mesh = null;
    if (gm.kind === 'rect') {
      const geo = new THREE.BoxGeometry(
        Math.max(0.28, gm.w * RING_SCALE),
        bh,
        Math.max(0.28, gm.h * RING_SCALE)
      );
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(gm.x * RING_SCALE, 0.62 + bh / 2, gm.y * RING_SCALE);
    } else if (gm.kind === 'arc') {
      const r1 = gm.r1 * RING_SCALE;
      const r2 = gm.r2 * RING_SCALE;
      const dr = Math.max(0.32, r2 - r1);
      const rMid = (r1 + r2) * 0.5;
      const arcLen = Math.max(0.34, Math.abs(gm.da) * rMid);
      const aMid = gm.a1 + gm.da * 0.5;
      const geo = new THREE.BoxGeometry(arcLen, bh, dr);
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(Math.cos(aMid) * rMid, 0.62 + bh / 2, Math.sin(aMid) * rMid);
      mesh.rotation.y = -aMid + Math.PI / 2;
    }

    if (mesh) {
      mesh.castShadow = !!b.pub;
      mesh.receiveShadow = true;
      mesh.userData.block = b;
      mesh.userData.baseEmissiveHex = b.pub ? '#18b4ff' : '#000000';
      mesh.userData.baseEmissiveIntensity = b.pub ? 0.16 : 0.0;
      blocksGroup.add(mesh);
      blockPickMeshes.push(mesh);
      blockMeshByIndex.set(b.i, mesh);
    }
  }
}

// ---------------------------------------------------------------------------
// 12. Oulipo Combinatorial Screen Canvas (Cut A / Cut B / Palindrome / Fibonacci)
// ---------------------------------------------------------------------------
function computeOrderedPool() {
  const pool = BASE_SHOT_POOL.map((s) => ({ ...s }));
  if (state.cutMode === 'pool') return pool;
  if (state.cutMode === 'reslot') return [...pool].sort((a, b) => a.reslot - b.reslot);
  if (state.cutMode === 'palindrome') {
    const half = pool.slice(0, 4);
    return [...half, ...[...half].reverse()];
  }
  const fibIdx = [0, 3, 1, 4, 2, 7, 5, 6];
  return fibIdx.map((i) => pool[i]);
}

function cycleOulipoCut(shiftWork = false) {
  if (shiftWork && state.oulipoWorks.length) {
    state.activeWorkIdx = (state.activeWorkIdx + 1) % state.oulipoWorks.length;
  } else {
    const nxt = (CUT_MODES.indexOf(state.cutMode) + 1) % CUT_MODES.length;
    state.cutMode = CUT_MODES[nxt];
  }
  syncNotesReadout();
  drawOulipoScreenCanvas(performance.now() * 0.001);
}

function drawOulipoScreenCanvas(timeSec) {
  const g = screenCanvas.getContext('2d');
  const W = 1024;
  const H = 576;
  g.save();
  g.setTransform(screenCanvas.width / W, 0, 0, screenCanvas.height / H, 0, 0);
  const ordered = computeOrderedPool();
  const idx = Math.floor(timeSec / 3.2) % ordered.length;
  const shot = ordered[idx];
  const work = state.oulipoWorks[state.activeWorkIdx] || {
    work: 'La Machine a tuer le temps',
    title: 'Fixed shot pool',
    status: 'passed',
    line: 'Make different films from one locked inventory of shots.',
  };

  g.fillStyle = '#091626';
  g.fillRect(0, 0, W, H);

  const plateX = 36;
  const plateY = 66;
  const plateW = 590;
  const plateH = 408;

  g.fillStyle = shot.palette[0];
  g.fillRect(plateX, plateY, plateW, plateH);

  const playerPlate = playerPlateImages.length ? playerPlateImages[idx % playerPlateImages.length] : null;
  if (playerPlate && playerPlate.img && playerPlate.img.complete && playerPlate.img.naturalWidth > 0 && idx % 2 === 1) {
    g.drawImage(playerPlate.img, plateX + 8, plateY + 8, plateW - 16, plateH - 16);
    g.fillStyle = 'rgba(8,21,38,0.80)';
    g.fillRect(plateX + 14, plateY + plateH - 46, 390, 30);
    g.fillStyle = '#5fe8ff';
    g.font = '600 14px ui-monospace, monospace';
    g.fillText(`PLAYER PLATE: ${playerPlate.caption.toUpperCase()}`, plateX + 24, plateY + plateH - 26);
  } else {
    const push = 1.0 + 0.08 * ((timeSec % 3.2) / 3.2);
    g.save();
    g.beginPath();
    g.rect(plateX, plateY, plateW, plateH);
    g.clip();
    g.translate(plateX + plateW / 2, plateY + plateH / 2);
    g.scale(push, push);

    g.strokeStyle = shot.palette[1];
    g.lineWidth = 3;
    for (let r = 45; r <= 210; r += 42) {
      g.beginPath();
      g.arc(0, 10, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#faf6eb';
    g.fillRect(-280, 42, 560, 5);
    g.font = '600 13px ui-monospace, monospace';
    g.fillText('+4.00 M FLOOD DATUM', 105, 34);

    g.fillStyle = shot.palette[2];
    g.fillRect(-48, -95, 96, 137);
    g.fillStyle = pilot.doorOpen ? '#18b4ff' : '#2a221c';
    g.fillRect(-34, -80, 68, 122);
    g.fillStyle = '#f2a541';
    g.fillRect(58, -12, 34, 24);
    g.restore();
  }

  g.strokeStyle = '#efe7d2';
  g.lineWidth = 3;
  g.strokeRect(plateX, plateY, plateW, plateH);

  g.fillStyle = '#f4eedd';
  g.font = '700 20px ui-monospace, monospace';
  g.fillText(`OULIPO SCREENING | ${work.work.toUpperCase()}`, 36, 42);
  g.fillStyle = '#5fe8ff';
  g.font = '600 14px ui-monospace, monospace';
  g.fillText(`${CUT_LABELS[state.cutMode].toUpperCase()}`, 650, 42);

  const nbX = 650;
  const nbY = 66;
  const nbW = 338;
  const nbH = 408;
  g.fillStyle = '#efe7d2';
  g.fillRect(nbX, nbY, nbW, nbH);
  g.fillStyle = '#8c2a1c';
  g.fillRect(nbX, nbY, 12, nbH);

  g.fillStyle = '#17140f';
  g.font = '700 22px Georgia, serif';
  g.fillText(`${idx + 1}. ${shot.fr}`, nbX + 26, nbY + 42);
  g.font = 'italic 16px Georgia, serif';
  g.fillStyle = '#4a4031';
  g.fillText(shot.en, nbX + 26, nbY + 68);

  if (state.cutMode !== 'pool' && shot.slot !== idx + 1) {
    g.fillStyle = '#c74a3a';
    g.font = '700 16px ui-monospace, monospace';
    g.fillText(`POOL #0${shot.slot} -> RE-SLOTTED #0${idx + 1}`, nbX + 26, nbY + 102);
  } else {
    g.fillStyle = '#145a78';
    g.font = '600 15px ui-monospace, monospace';
    g.fillText(`FROZEN ASSET #0${shot.slot} (LOCKED)`, nbX + 26, nbY + 102);
  }

  g.fillStyle = '#17140f';
  g.font = '15px Georgia, serif';
  const words = (work.line || '').split(' ');
  let ln = '';
  let ty = nbY + 142;
  words.forEach((w) => {
    if ((ln + w).length > 34) {
      g.fillText(ln, nbX + 26, ty);
      ln = w + ' ';
      ty += 22;
    } else {
      ln += w + ' ';
    }
  });
  if (ln) g.fillText(ln, nbX + 26, ty);

  g.fillStyle = '#8c2a1c';
  g.font = '700 13px ui-monospace, monospace';
  g.fillText(`CLICK SCREEN OR PROJECTOR TO CUT`, nbX + 26, nbY + 252);
  g.fillStyle = '#332c22';
  g.font = '13px ui-monospace, monospace';
  g.fillText(`PARCEL: ${(pilot.parcelHolder || 'player').toUpperCase()}`, nbX + 26, nbY + 284);
  g.fillText(`SEVERN DOOR: ${pilot.doorOpen ? 'OPEN' : 'CLOSED'}`, nbX + 26, nbY + 308);
  g.fillText(`POEM ${state.selectedPoem}: ${POEM_TITLES[state.selectedPoem] || ''}`, nbX + 26, nbY + 332);
  g.fillText(`PLATES IN REEL: ${playerPlateImages.length}`, nbX + 26, nbY + 356);

  g.fillStyle = '#050d17';
  g.fillRect(36, 492, W - 72, 58);
  g.strokeStyle = 'rgba(24,180,255,0.45)';
  g.strokeRect(36, 492, W - 72, 58);
  g.fillStyle = duetEngine.speakingRole === 'carrier' ? '#f2a541' : '#7ce8ff';
  g.font = 'italic 18px Georgia, serif';
  const subTxt =
    duetEngine.currentSubtitle ||
    `Poem ${state.selectedPoem} · ${POEM_TITLES[state.selectedPoem]} — Click any spectator for 2-voice Codex Duet.`;
  g.fillText(subTxt.slice(0, 86), 52, 527);
  g.restore();

  screenTex.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// 13. Pilot State Sync & Bundled Data Loading
// ---------------------------------------------------------------------------
function applyPilotToScene(p) {
  pilot = p;
  const openAngle = p.doorOpen ? -1.18 : 0.0;
  surfaceDoorPivot.rotation.y = openAngle;
  subDoorPivot.rotation.y = openAngle;

  if (p.poem && POEM_TITLES[p.poem]) {
    state.selectedPoem = p.poem;
  }

  const holderActor = castActors.find((a) => a.id === p.parcelHolder);
  if (holderActor) {
    parcelMesh.position.set(holderActor.root.position.x + 0.34, FLOOR_Y + 1.05, holderActor.root.position.z + 0.25);
  } else {
    parcelMesh.position.set(0.55, FLOOR_Y + 1.15, 4.4);
  }
  parcelMesh.userData.interact.anchor.set(parcelMesh.position.x, parcelMesh.position.y + 0.45, parcelMesh.position.z);

  duetEngine.syncDoorAndDepth(p.doorOpen, state.depthT);
  syncNotesReadout();
}
subscribePilotState((next) => applyPilotToScene(next));
applyPilotToScene(pilot);

async function loadDatasets() {
  const [planRes, svgRes, codexRes, oulipoRes] = await Promise.all([
    fetch('./data/plan.json').then((r) => r.json()),
    fetch('./data/plan.svg').then((r) => r.text()),
    fetch('./data/codex_lines.json').then((r) => r.json()),
    fetch('./data/oulipo_catalogue.json').then((r) => r.json()),
  ]);

  state.planData = planRes;
  buildExtrudedBlocks(planRes);

  const svgBlob = new Blob([svgRes], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  const svgImg = new Image();
  svgImg.onload = () => {
    const tex = new THREE.Texture(svgImg);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    svgGroundPlane.material.map = tex;
    svgGroundPlane.material.needsUpdate = true;
    URL.revokeObjectURL(svgUrl);
  };
  svgImg.src = svgUrl;

  (codexRes.poems || []).forEach((p) => {
    state.codexByPoem[p.num] = p;
  });

  state.oulipoWorks = oulipoRes.works || [];
  drawOulipoScreenCanvas(performance.now() * 0.001);
}
loadDatasets();

// ---------------------------------------------------------------------------
// 14. In-World Raycast Hover Whispers + Click Actions + Scroll Dive + WASD
// ---------------------------------------------------------------------------
const whisperEl = document.getElementById('world-whisper');
const speakerLyricEl = document.getElementById('world-speaker-lyric');
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(-99, -99);
const keys = {};

let hoveredBlockMesh = null;
let hoveredRingMesh = null;
let activeWhisperAnchor = null;
let activeWhisperLead = '';
let activeWhisperMeta = '';

function clearSurfaceHoverGlow() {
  if (hoveredBlockMesh) {
    hoveredBlockMesh.material.emissive.set(hoveredBlockMesh.userData.baseEmissiveHex);
    hoveredBlockMesh.material.emissiveIntensity = hoveredBlockMesh.userData.baseEmissiveIntensity;
    hoveredBlockMesh.scale.y = 1.0;
    hoveredBlockMesh = null;
  }
  if (hoveredRingMesh) {
    hoveredRingMesh.material.emissive.set('#000000');
    hoveredRingMesh.material.emissiveIntensity = 0.0;
    hoveredRingMesh = null;
  }
  hoverHalo.visible = false;
  ringHoverHalo.visible = false;
}

function updateRaycastHover() {
  if (pointerNDC.x < -2) return;
  raycaster.setFromCamera(pointerNDC, camera);
  clearSurfaceHoverGlow();
  activeWhisperAnchor = null;

  if (state.depthT < 0.45) {
    // 1. Surface interactive props (Door, Bridge Arch, Brass Tripod)
    const propHits = raycaster.intersectObjects(surfaceInteractMeshes, false);
    if (propHits.length > 0) {
      const info = propHits[0].object.userData.interact;
      const [lead, meta] = info.getWhisper();
      activeWhisperAnchor = info.anchor;
      activeWhisperLead = lead;
      activeWhisperMeta = meta;
      renderer.domElement.style.cursor = 'pointer';
      return;
    }

    // 2. 610 Word-Timed Blocks & 52 Carved White Public Buildings
    const bHits = raycaster.intersectObjects(blockPickMeshes, false);
    if (bHits.length > 0) {
      const m = bHits[0].object;
      const b = m.userData.block;
      hoveredBlockMesh = m;
      m.material.emissive.set(b.pub ? '#5fe8ff' : '#f2a541');
      m.material.emissiveIntensity = b.pub ? 0.78 : 0.52;
      m.scale.y = 1.16;

      hoverHalo.position.set(m.position.x, m.position.y + 0.75, m.position.z);
      hoverHalo.material.color.set(b.pub ? '#5fe8ff' : '#f2a541');
      hoverHalo.visible = true;

      const title = POEM_TITLES[b.num] || 'Atlantis';
      const pubPrefix = b.pub ? `Commons #${String(b.pub).padStart(2, '0')} · ` : '';
      activeWhisperAnchor = new THREE.Vector3(m.position.x, m.position.y + 1.3, m.position.z);
      activeWhisperLead = `${pubPrefix}Poem ${b.num} · ${title}`;
      activeWhisperMeta = 'Click to Dive';
      renderer.domElement.style.cursor = 'pointer';
      return;
    }

    // 3. Plato Concentric Land Rings
    const rHits = raycaster.intersectObjects(ringPickMeshes, false);
    if (rHits.length > 0) {
      const rm = rHits[0].object;
      hoveredRingMesh = rm;
      rm.material.emissive.set('#18b4ff');
      rm.material.emissiveIntensity = 0.22;

      const pt = rHits[0].point;
      const hitRad = Math.hypot(pt.x, pt.z);
      ringHoverHalo.scale.setScalar(Math.max(0.25, hitRad / 18.0));
      ringHoverHalo.position.set(0, rm.position.y + 0.35, 0);
      ringHoverHalo.visible = true;

      activeWhisperAnchor = pt.clone().setY(rm.position.y + 1.8);
      activeWhisperLead = rm.userData.ringLabel;
      activeWhisperMeta = 'Click to Dive';
      renderer.domElement.style.cursor = 'pointer';
      return;
    }
  } else {
    // Submerged Courtyard interactive 3D architecture & cast
    const cHits = raycaster.intersectObjects(courtyardInteractMeshes, false);
    if (cHits.length > 0) {
      const info = cHits[0].object.userData.interact;
      const [lead, meta] = info.getWhisper();
      activeWhisperAnchor = info.anchor;
      activeWhisperLead = lead;
      activeWhisperMeta = meta;
      renderer.domElement.style.cursor = 'pointer';
      return;
    }
  }

  renderer.domElement.style.cursor = dragging ? 'grabbing' : 'grab';
}

function handleWorldInteract(info, shiftKey) {
  if (!info) return;
  if (info.kind === 'winged-stage-portal') {
    window.location.href = '../stage/#P06-S01';
    return;
  }
  if (info.kind === 'severn-door') {
    const next = !pilot.doorOpen;
    savePilotState({ doorOpen: next });
    applyPilotToScene(loadPilotState());
    return;
  }
  if (info.kind === 'bridge-portal') {
    navigateToCityRoute('../');
    return;
  }
  if (info.kind === 'tripod') {
    if (shiftKey) {
      suite.exposePlate({ locationName: 'Atlantis Surface Canal Quay' });
      triggerShutterFlash();
      refreshPlayerPlates();
    } else {
      suite.nextLook();
    }
    return;
  }
  if (info.kind === 'ascend-rings') {
    startDiveTo(0.0);
    return;
  }
  if (info.kind === 'cycle-oulipo-cut') {
    cycleOulipoCut(shiftKey);
    return;
  }
  if (info.kind === 'cycle-parcel') {
    const order = ['player', 'bekele', 'maren'];
    const nxt = order[(order.indexOf(pilot.parcelHolder || 'player') + 1) % order.length];
    savePilotState({ parcelHolder: nxt });
    applyPilotToScene(loadPilotState());
    return;
  }
  if (info.kind === 'poet-hero') {
    const heroAc = info.actor;
    if (heroAc && heroAc.v9) {
      heroAc.evoSeed = (heroAc.evoSeed || 6) + 1;
      const wingModes = ['marble', 'angel', 'raven', 'folded'];
      const nextWings = wingModes[heroAc.evoSeed % wingModes.length];
      evolveHeroPhenotype(heroAc.v9, {
        poem: '06',
        shotKind: 'submerged',
        wingsMode: nextWings,
        bgLuminance: 0.16,
        seed: heroAc.evoSeed * 19,
      });
    }
    state.selectedPoem = '06';
    const poem06 = state.codexByPoem['06'];
    const lines = (poem06 && poem06.lines) || [];
    const chosen = lines.length
      ? lines[state.duetsLineCursor++ % lines.length]
      : { text: 'The gates open with wings gifted from evolution, and made of marble stones.' };
    duetEngine.playDuetForClickedActor(heroAc, chosen);
    return;
  }
  if (info.kind === 'chorus-actor') {
    if (shiftKey && (info.actor.id === 'bekele' || info.actor.id === 'maren')) {
      savePilotState({ parcelHolder: info.actor.id });
      applyPilotToScene(loadPilotState());
      return;
    }
    const poemEntry =
      state.codexByPoem[state.selectedPoem] ||
      state.codexByPoem['06'] ||
      state.codexByPoem['02'] ||
      state.codexByPoem['12'];
    const lines = (poemEntry && poemEntry.lines) || [];
    const chosen = lines.length
      ? lines[state.duetsLineCursor++ % lines.length]
      : { text: 'The gates open with wings gifted from evolution, and made of marble stones.' };
    duetEngine.playDuetForClickedActor(info.actor, chosen);
  }
}

let dragging = false;
let dragMoved = 0;
let lastPt = { x: 0, y: 0 };

renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true;
  dragMoved = 0;
  lastPt = { x: e.clientX, y: e.clientY };
});

window.addEventListener('pointermove', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  if (dragging) {
    const dx = e.clientX - lastPt.x;
    const dy = e.clientY - lastPt.y;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    lastPt = { x: e.clientX, y: e.clientY };
    state.lookYaw -= dx * 0.0032;
    state.lookPitch = Math.max(-0.62, Math.min(0.62, state.lookPitch - dy * 0.0026));
  }
  updateRaycastHover();
});

window.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  if (dragMoved > 6 || e.target !== renderer.domElement) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  if (state.depthT < 0.45) {
    const propHits = raycaster.intersectObjects(surfaceInteractMeshes, false);
    if (propHits.length > 0) {
      handleWorldInteract(propHits[0].object.userData.interact, e.shiftKey);
      return;
    }

    const bHits = raycaster.intersectObjects(blockPickMeshes, false);
    if (bHits.length > 0) {
      const b = bHits[0].object.userData.block;
      state.selectedBlock = b;
      if (b.num) {
        state.selectedPoem = b.num;
        savePilotState({ poem: b.num });
      }
      startDiveTo(1.0);
      return;
    }

    const rHits = raycaster.intersectObjects(ringPickMeshes, false);
    if (rHits.length > 0) {
      startDiveTo(1.0);
      return;
    }
  } else {
    const cHits = raycaster.intersectObjects(courtyardInteractMeshes, false);
    if (cHits.length > 0) {
      handleWorldInteract(cHits[0].object.userData.interact, e.shiftKey);
    }
  }
});

// Mousewheel smoothly dives down into the abyss or ascends back up to Plato's Rings
renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const step = Math.sign(e.deltaY) * Math.min(0.18, Math.abs(e.deltaY) * 0.00085);
    const base = state.animatingDive ? state.targetDepthT : state.depthT;
    state.targetDepthT = Math.max(0, Math.min(1, base + step));
    state.animatingDive = true;
  },
  { passive: false }
);

window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  keys[e.code] = true;
  if (e.code === 'Space') {
    setTimeout(() => {
      triggerShutterFlash();
      refreshPlayerPlates();
    }, 40);
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// 15. Main Render & Diegetic Projection Loop
// ---------------------------------------------------------------------------
let prevT = performance.now() * 0.001;
let lastScreenBucket = -1;
const singerGazeTarget = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now() * 0.001;
  const dt = Math.min(0.05, Math.max(0.001, now - prevT));
  prevT = now;
  state.frameTick = now;

  // Smooth Dive / Ascent Interpolation (~2.2s full sweep)
  if (state.animatingDive) {
    const diff = state.targetDepthT - state.depthT;
    if (Math.abs(diff) < 0.0025) {
      setDepthProgress(state.targetDepthT);
      state.animatingDive = false;
    } else {
      const speed = Math.abs(diff) > 0.25 ? 0.46 : 0.34;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), dt * speed);
      setDepthProgress(state.depthT + step);
    }
  }

  // Camera Spline + Free WASD Walk + Drag Look
  const basePos = DIVE_CURVE_POS.getPointAt(state.depthT);
  const baseLook = DIVE_CURVE_LOOK.getPointAt(state.depthT);

  const moveSpeed = state.depthT > 0.7 ? 7.8 : 18.0;
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  if (fwd.lengthSq() > 0.001) fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

  if (keys.KeyW || keys.ArrowUp) state.walkOffset.addScaledVector(fwd, moveSpeed * dt);
  if (keys.KeyS || keys.ArrowDown) state.walkOffset.addScaledVector(fwd, -moveSpeed * dt);
  if (keys.KeyA || keys.ArrowLeft) state.walkOffset.addScaledVector(right, -moveSpeed * dt);
  if (keys.KeyD || keys.ArrowRight) state.walkOffset.addScaledVector(right, moveSpeed * dt);

  const maxR = pilot.doorOpen ? 25.0 : 12.6;
  if (state.depthT > 0.8 && state.walkOffset.length() > maxR) {
    state.walkOffset.setLength(maxR);
  }

  camera.position.copy(basePos).add(state.walkOffset);
  const lookDir = baseLook.clone().sub(basePos);
  const horizLen = Math.max(4.0, Math.hypot(lookDir.x, lookDir.z));
  const baseYaw = Math.atan2(lookDir.x, lookDir.z);
  const yaw = baseYaw + state.lookYaw;
  const lookTarget = new THREE.Vector3(
    camera.position.x + Math.sin(yaw) * horizLen,
    baseLook.y + state.lookPitch * horizLen * 0.55,
    camera.position.z + Math.cos(yaw) * horizLen
  );
  camera.lookAt(lookTarget);

  // Animate Verne's Nautilus Spotlight, 35mm Projector Reels & P06-S01 Winged Gate Portals
  nautilusGroup.position.y = -17.2 + Math.sin(now * 0.55) * 0.65;
  nautilusBeam.rotation.y = Math.sin(now * 0.42) * 0.34;
  projReelFront.rotation.x = now * 1.8;
  projReelRear.rotation.x = now * 1.8;

  for (let wIdx = 0; wIdx < wingedGatePivots.length; wIdx++) {
    const wg = wingedGatePivots[wIdx];
    const flap = Math.sin(now * 1.55 + wIdx * 0.9) * 0.08;
    wg.pivL.rotation.set(0.04, -0.16 - flap, 0.08 + flap * 0.6);
    wg.pivR.rotation.set(0.04, 0.16 + flap, -0.08 - flap * 0.6);
    wg.veilMat.opacity = 0.16 + Math.sin(now * 2.2 + wIdx) * 0.035;
  }

  // Drift bioluminescent pelagic silt upward
  const pArr = siltParticles.geometry.attributes.position.array;
  for (let i = 1; i < pArr.length; i += 3) {
    pArr[i] += dt * 0.28;
    if (pArr[i] > 5.0) pArr[i] = -38.0;
  }
  siltParticles.geometry.attributes.position.needsUpdate = true;

  // Determine gaze target: whoever is singing the Codex Duet, else the visitor's camera
  const activeSinger = duetEngine.speakingActor;
  if (activeSinger) {
    singerGazeTarget.set(
      activeSinger.root.position.x,
      FLOOR_Y + 1.62 * activeSinger.hScale,
      activeSinger.root.position.z
    );
  } else {
    singerGazeTarget.copy(camera.position);
  }

  // Update Anny V9 Chorus / Spectators + Winged V9 Poet Hero + Floating 3D Speaker Lyric
  castActors.forEach((ac) => {
    const isSpeaker = activeSinger === ac;
    if (ac.v9) {
      ac.v9.setGroundY(FLOOR_Y);
      let wantClip = ac.postureClip || 'listen';
      if (isSpeaker) {
        wantClip = 'idle-talking';
      } else if (ac.id === 'poet_hero') {
        wantClip = Math.floor(now * 0.18) % 2 === 0 ? 'greet' : 'listen';
      }
      if (ac.currentClip !== wantClip) {
        ac.currentClip = wantClip;
        ac.v9.playAction(wantClip, 0.28);
      }
      if (!isSpeaker) {
        ac.v9.setJawOpenness(0);
      }
      ac.v9.update(dt, {
        autoLocomotion: false,
        moveSpeed: 0,
        lookTargetVec3: isSpeaker ? camera.position : singerGazeTarget,
        speaking: isSpeaker,
        talkText: isSpeaker ? duetEngine.currentLyric : '',
        talkProgress: isSpeaker ? ((now * 0.34) % 1) : 0,
        wingFlapBoost: ac.id === 'poet_hero' ? (isSpeaker ? 0.55 : 0.18) : 0,
      });
    } else {
      ac.proxy.position.y = isSpeaker ? Math.abs(Math.sin(now * 7.5)) * 0.04 : 0;
    }
  });

  if (duetEngine.speakingActor && duetEngine.currentLyric) {
    const sp = duetEngine.speakingActor;
    speakerFloorRing.visible = true;
    speakerFloorRing.position.set(sp.root.position.x, FLOOR_Y + 0.04, sp.root.position.z);
    speakerFloorRing.material.color.set(duetEngine.speakingRole === 'carrier' ? '#f2a541' : '#7ce8ff');

    const headWorld = new THREE.Vector3(sp.root.position.x, FLOOR_Y + 2.08 * sp.hScale, sp.root.position.z);
    const proj = projectWorldLabel(camera, headWorld, renderer.domElement);
    if (proj.visible) {
      speakerLyricEl.style.display = 'block';
      speakerLyricEl.style.left = `${proj.left}px`;
      speakerLyricEl.style.top = `${proj.top}px`;
      speakerLyricEl.innerHTML = `<span class="sp-tag">${duetEngine.currentSpeakerLabel}</span>${duetEngine.currentLyric}`;
    } else {
      speakerLyricEl.style.display = 'none';
    }
  } else {
    speakerFloorRing.visible = false;
    speakerLyricEl.style.display = 'none';
  }

  // Project 1-line unboxed hover whisper right over hovered 3D object
  if (activeWhisperAnchor) {
    const p = projectWorldLabel(camera, activeWhisperAnchor, renderer.domElement);
    if (p.visible) {
      whisperEl.style.display = 'block';
      whisperEl.style.left = `${Math.max(120, Math.min(window.innerWidth - 120, p.left))}px`;
      whisperEl.style.top = `${Math.max(28, Math.min(window.innerHeight - 24, p.top))}px`;
      whisperEl.innerHTML = `${activeWhisperLead}<span class="wh-meta">— ${activeWhisperMeta}</span>`;
    } else {
      whisperEl.style.display = 'none';
    }
  } else {
    whisperEl.style.display = 'none';
  }

  if (worldRig && typeof worldRig.update === 'function') {
    worldRig.update(camera.position);
  }

  const bucket = Math.floor(now * 6);
  if (bucket !== lastScreenBucket) {
    lastScreenBucket = bucket;
    refreshPlayerPlates();
    drawOulipoScreenCanvas(now);
  }

  renderer.render(scene, camera);
}

const atlantisParams = new URLSearchParams(window.location.search);
const initDepthParam = atlantisParams.get('depth');
setDepthProgress(initDepthParam !== null ? Number(initDepthParam) : 0.0);

window.__ATLANTIS__ = {
  state,
  castActors,
  get poetHero() { return poetHeroActor; },
  subWingedGate,
  surfWingedGate,
  startDiveTo,
  setDepthProgress,
  duetEngine,
};

animate();
