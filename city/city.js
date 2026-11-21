import * as THREE from 'three';
import { CARTRIDGES, TIME_PRESETS } from './cartridges.js';
import { CityAudioEngine } from './audio.js';
import { CITY_LOOKS, CityShaderPipeline } from './shaders.js';

const STORAGE_KEY = 'make_photo_city_nolli_v1';

// ---------------------------------------------------------------------------
// Unified World Ledger (Single Source of Truth)
// ---------------------------------------------------------------------------
function loadLedger() {
  const fresh = {
    cartridge: 'ahiya',
    timeOfDay: 'bluehour',
    carriedWaterL: 0,
    standpipeReserveL: 40,
    projectorTankL: 0,
    plates: [],
    windowPlateIds: [null, null, null],
    screenPlateId: null,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw);
    return { ...fresh, ...parsed };
  } catch {
    return fresh;
  }
}

function saveLedger() {
  try {
    // Keep last 9 plates to stay comfortably inside localStorage quota
    if (ledger.plates.length > 9) {
      ledger.plates = ledger.plates.slice(-9);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // Ignore quota errors
  }
}

const ledger = loadLedger();
const audio = new CityAudioEngine();

// ---------------------------------------------------------------------------
// Procedural PBR Textures (Wet Asphalt, Masonry, Sidewalk, Cutout Skyline)
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
  // Subtle paving joints
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
  // Wet puddle patches (low roughness = bright sky & sodium reflections)
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
  // Weathering streaks
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

// ---------------------------------------------------------------------------
// Scene, Renderer, Camera
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

const shaderPipeline = new CityShaderPipeline(
  renderer,
  Math.floor(window.innerWidth * renderer.getPixelRatio()),
  Math.floor(window.innerHeight * renderer.getPixelRatio())
);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#233447');
scene.fog = new THREE.FogExp2('#35485c', 0.0068);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.12, 260);

// Lights (Physical Three.js r155+ intensities)
const hemiLight = new THREE.HemisphereLight('#c4dcf0', '#3d3934', 1.25);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#ffd6a6', 2.4);
sunLight.position.set(28, 36, 28);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 2;
sunLight.shadow.camera.far = 130;
const d = 48;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// Interior warm sconces
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

// ---------------------------------------------------------------------------
// Shared Materials (Updated dynamically on Cartridge / Time / X-Ray switch)
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
};

// ---------------------------------------------------------------------------
// World Geometry: Ground, Streets, Hero Nolli Building, Threshold Gate, Depot
// ---------------------------------------------------------------------------
const colliders = []; // { minX, maxX, minZ, maxZ, minY, maxY, tag }
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
    });
  }
  return m;
}

// 180x180 wet asphalt base
const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), mats.asphalt);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Sidewalk apron around Hero Building & Courtyard
addBox(26, 0.16, 22, 0, 0.08, 2, mats.sidewalk, { collide: false, cast: false });
addBox(12, 0.16, 20, -14, 0.08, -14, mats.sidewalk, { collide: false, cast: false });

// --- HERO BUILDING: "Severn Nolli House" (Enterable 2-Floor + Rooftop) ---
const exteriorShellMeshes = [];
function addExtWall(w, h, d, x, y, z, collide = true) {
  const m = addBox(w, h, d, x, y, z, mats.masonryExt, { collide, tag: 'hero-wall' });
  exteriorShellMeshes.push(m);
  return m;
}

// Interior Ground Floor slab (continuous Nolli stone floor)
addBox(18, 0.18, 14, 0, 0.09, 0, mats.floorInt, { collide: false, cast: false });

// South Facade (z = +7) with open central arched doorway (x: -2.4..2.4, y: 0..3.8)
addExtWall(6.6, 9.2, 0.45, -5.7, 4.6, 7.0, true);
addExtWall(6.6, 9.2, 0.45, 5.7, 4.6, 7.0, true);
addExtWall(4.8, 5.4, 0.45, 0, 6.5, 7.0, false); // Lintel above open doorway
// Brass lintel trim
addBox(5.2, 0.22, 0.62, 0, 3.85, 7.0, mats.trim, { collide: false });

// North, West, East exterior walls
addExtWall(18.0, 9.2, 0.45, 0, 4.6, -7.0, true);
addExtWall(0.45, 9.2, 14.0, -9.0, 4.6, 0, true);
addExtWall(0.45, 9.2, 14.0, 9.0, 4.6, 0, true);

// Upper Floor Slab (y = 4.6) with Lightwell opening (x: -2.4..2.4, z: -2.2..2.2) & Stair cutouts
addBox(18.0, 0.24, 4.8, 0, 4.5, -4.6, mats.floorInt, { collide: false }); // North bay
addBox(18.0, 0.24, 4.8, 0, 4.5, 4.6, mats.floorInt, { collide: false });  // South bay
addBox(6.6, 0.24, 4.4, -5.7, 4.5, 0, mats.floorInt, { collide: false }); // West bridge
addBox(3.6, 0.24, 4.4, 4.2, 4.5, 0, mats.floorInt, { collide: false });  // East bridge (leaves stair slot x: 6..8.8)

// Rooftop Overlook Slab (y = 9.2) with Glass Skylight Dome over Lightwell
addBox(18.2, 0.28, 4.9, 0, 9.1, -4.6, mats.sidewalk, { collide: false });
addBox(18.2, 0.28, 4.9, 0, 9.1, 4.6, mats.sidewalk, { collide: false });
addBox(6.7, 0.28, 4.4, -5.75, 9.1, 0, mats.sidewalk, { collide: false });
addBox(6.7, 0.28, 4.4, 5.75, 9.1, 0, mats.sidewalk, { collide: false });
// Glass skylight over lightwell
const skylight = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.45, 4.6), mats.glass);
skylight.position.set(0, 9.45, 0);
scene.add(skylight);
// Rooftop low parapet walls
addBox(18.2, 1.0, 0.35, 0, 9.7, -7.0, mats.trim, { collide: false });
addBox(18.2, 1.0, 0.35, 0, 9.7, 7.0, mats.trim, { collide: false });
addBox(0.35, 1.0, 14.0, -9.0, 9.7, 0, mats.trim, { collide: false });
addBox(0.35, 1.0, 14.0, 9.0, 9.7, 0, mats.trim, { collide: false });

// Walkable Ramp / Stairway 1 (Ground y=0 -> Upper Screening Hall y=4.6 along East wall x=6.2..8.6)
const stair1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 11.2), mats.trim);
stair1.position.set(7.4, 2.3, -0.5);
stair1.rotation.x = Math.atan2(4.6, 10.0);
stair1.receiveShadow = true;
scene.add(stair1);

// Walkable Ramp / Stairway 2 (Upper y=4.6 -> Rooftop Overlook y=9.2 along West wall x=-8.6..-6.2)
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

// Cyan Water & Signal Conduit Network (Standpipe -> Underground -> Hero Building -> Projector -> Rooftop Relay)
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

// --- GROUND FLOOR PROPS: Camera Shop Window Frames & Archive Light Table ---
const windowFrames = [];
const windowFrameX = [-5.8, -3.9, 5.4];
windowFrameX.forEach((wx, idx) => {
  // Storefront backing frame
  addBox(1.65, 1.2, 0.14, wx, 1.9, 7.26, mats.trim, { collide: false });
  const printMat = new THREE.MeshStandardMaterial({
    color: '#252a2e',
    roughness: 0.4,
    emissive: '#101418',
    emissiveIntensity: 0.35,
  });
  const printMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.98), printMat);
  printMesh.position.set(wx, 1.9, 7.34);
  scene.add(printMesh);
  windowFrames.push({ index: idx, mesh: printMesh, mat: printMat });
});

// Archive Light Table (inside ground floor at x=4.0, z=-1.8)
addBox(2.4, 0.92, 1.4, 4.0, 0.46, -1.8, mats.trim, { collide: true, tag: 'prop' });
const lightTableGlass = new THREE.Mesh(
  new THREE.PlaneGeometry(2.1, 1.15),
  new THREE.MeshStandardMaterial({
    color: '#d8f3ff',
    emissive: '#8ad8ff',
    emissiveIntensity: 0.9,
    roughness: 0.2,
  })
);
lightTableGlass.rotation.x = -Math.PI / 2;
lightTableGlass.position.set(4.0, 0.94, -1.8);
scene.add(lightTableGlass);

// --- UPPER FLOOR PROPS: 35mm Projector, Cyan Cooling Sight-Glass & Linen Sheet ---
addBox(1.1, 1.1, 1.1, -1.8, 5.15, 1.2, mats.trim, { collide: false });
const projectorLens = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.55, 12), mats.masonryDark || mats.trim);
projectorLens.rotation.x = Math.PI / 2;
projectorLens.position.set(-1.8, 5.65, 0.55);
scene.add(projectorLens);

// Visible Cyan Cooling Sight-Glass Cylinder
const sightGlassShell = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.35, 14), mats.glass);
sightGlassShell.position.set(-0.9, 5.3, 1.2);
scene.add(sightGlassShell);

const sightGlassLiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 1.25, 14), mats.cyanActive);
sightGlassLiquid.position.set(-0.9, 4.7, 1.2);
sightGlassLiquid.scale.y = 0.02;
scene.add(sightGlassLiquid);

// Stretched Linen Screening Sheet (North wall of upper floor, z = -6.4)
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

// --- STANDPIPE DEPOT (x = -16, z = 14) ---
addBox(2.2, 0.25, 2.2, -16, 0.12, 14, mats.trim, { collide: false });
const depotTank = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.2, 16), mats.glass);
depotTank.position.set(-16, 1.35, 14);
scene.add(depotTank);
const depotWater = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 2.0, 16), mats.cyanActive);
depotWater.position.set(-16, 1.25, 14);
scene.add(depotWater);
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

// --- SURROUNDING NEIGHBORHOOD BLOCKS, TREES, STREETLAMPS & 2D CUTOUTS ---
const neighborSpecs = [
  [-26, 7.5, -10, 14, 15, 18],
  [24, 8.5, -8, 14, 17, 16],
  [25, 6.5, 14, 14, 13, 12],
  [-30, 9.0, 22, 16, 18, 14],
  [0, 7.0, -28, 22, 14, 12],
  [18, 10.5, -30, 14, 21, 12],
];
const neighborMat = mats.masonryExt.clone();
neighborSpecs.forEach(([x, y, z, w, h, d]) => {
  addBox(w, h, d, x, y, z, neighborMat, { collide: true, tag: 'neighbor' });
  // Warm lit apartment windows on facing sides
  for (let wy = 2.4; wy < h - 1.5; wy += 3.1) {
    for (let wx = -w * 0.32; wx <= w * 0.32; wx += 3.2) {
      if (Math.random() > 0.42) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), mats.windowGlow);
        win.position.set(x + wx, wy, z + d / 2 + 0.04);
        scene.add(win);
      }
    }
  }
});

// 2D Theatrical Silhouette Cutout Flats on the far perimeter (depth framing)
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

// Multi-tier Instanced-style Urban Trees
const treeCoords = [
  [-12, 21], [12, 21], [15, 6], [15, -4], [-21, 8], [-11, -12], [-17, -20], [10, -16],
];
treeCoords.forEach(([tx, tz]) => {
  const g = new THREE.Group();
  g.position.set(tx, 0, tz);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 3.0, 7), mats.trunk);
  trunk.position.y = 1.5;
  trunk.castShadow = true;
  g.add(trunk);
  const crown1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, 1), mats.foliage);
  crown1.position.set(0, 3.7, 0);
  crown1.castShadow = true;
  g.add(crown1);
  const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), mats.foliage);
  crown2.position.set(0.65, 4.5, -0.35);
  crown2.castShadow = true;
  g.add(crown2);
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
// Articulated Persistent Cast (Natural Downward-Hanging Arms & Real Jobs)
// ---------------------------------------------------------------------------
const residents = [];
const residentHitMeshes = [];

function createArticulatedResident(def) {
  const root = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: def.skin, roughness: 0.65 });
  const coatMat = new THREE.MeshStandardMaterial({ color: def.coat, roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1b1d20', roughness: 0.85 });
  const accentMat = new THREE.MeshStandardMaterial({ color: def.accent, emissive: def.accent, emissiveIntensity: 0.3, roughness: 0.4 });

  // Torso / Coat
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.30, 0.88, 12), coatMat);
  torso.position.y = 1.08;
  torso.castShadow = true;
  root.add(torso);

  // Head + Ophthalmic White Sclera Eyes
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 14), skinMat);
  head.position.y = 1.66;
  head.castShadow = true;
  root.add(head);

  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: '#f4f2ec' });
  const pupilMat = new THREE.MeshBasicMaterial({ color: '#141110' });
  [-0.052, 0.052].forEach((ex) => {
    const ew = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), eyeWhiteMat);
    ew.position.set(ex, 1.68, 0.138);
    root.add(ew);
    const ep = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), pupilMat);
    ep.position.set(ex, 1.68, 0.156);
    root.add(ep);
  });

  // Hair cap
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.165, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), darkMat);
  hair.position.set(0, 1.69, -0.015);
  root.add(hair);

  // Natural Downward-Hanging Arms (pivots at shoulders, inward palms)
  const makeArm = (side) => {
    const piv = new THREE.Group();
    piv.position.set(side * 0.27, 1.44, 0);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.62, 8), coatMat);
    upper.position.y = -0.31;
    upper.castShadow = true;
    piv.add(upper);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.08), skinMat);
    hand.position.y = -0.66;
    piv.add(hand);
    piv.rotation.z = side * 0.06; // subtle natural downward hang
    root.add(piv);
    return piv;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Legs
  const makeLeg = (side) => {
    const piv = new THREE.Group();
    piv.position.set(side * 0.11, 0.66, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.055, 0.66, 8), darkMat);
    leg.position.y = -0.33;
    leg.castShadow = true;
    piv.add(leg);
    root.add(piv);
    return piv;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // Role badge / collar accent
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 8, 16), accentMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.49;
  root.add(scarf);

  // Invisible raycast hit cylinder for effortless click-to-talk
  const hitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 1.9, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.position.y = 0.95;
  hitMesh.userData.residentId = def.id;
  root.add(hitMesh);
  residentHitMeshes.push(hitMesh);

  const st0 = def.stations[0];
  root.position.set(st0.x, st0.y, st0.z);
  scene.add(root);

  return {
    id: def.id,
    def,
    root,
    armL,
    armR,
    legL,
    legR,
    stationIdx: 0,
    dwellTimer: 4 + Math.random() * 4,
    walkPhase: Math.random() * 6,
  };
}

function rebuildResidentsForCartridge(cart) {
  residents.forEach((r) => scene.remove(r.root));
  residents.length = 0;
  residentHitMeshes.length = 0;
  cart.residents.forEach((def) => {
    residents.push(createArticulatedResident(def));
  });
}

// ---------------------------------------------------------------------------
// Player Movement, Elevation (Continuous Stairs -> Upper Floor -> Rooftop)
// ---------------------------------------------------------------------------
const player = {
  pos: new THREE.Vector3(-5.8, 0, 21.5),
  yaw: -0.22,
  pitch: 0.04,
  eyeHeight: 1.65,
  speed: 5.8,
  floorY: 0,
  isInside: false,
};

const keys = {};
let dragging = false;
let lastMouse = { x: 0, y: 0 };
let pointerDownPos = { x: 0, y: 0 };

// Camera Mode State
const camState = {
  active: false,
  tripodLocked: false,
  focalMm: 50,
  focusM: 12.0,
  exposureEv: 0.0,
  stock: 'natural',
  xray: false,
};

let activeDialogueResident = null;
let nolliOpen = false;
let lightTableOpen = false;
let currentContextAction = null;

function computeFloorHeight(x, z, currentY) {
  const inHeroX = x > -8.8 && x < 8.8;
  const inHeroZ = z > -6.8 && z < 6.8;
  if (!inHeroX || !inHeroZ) return 0;

  // East Stairway 1: Ground (y=0 at z=+4.5) -> Upper Hall (y=4.6 at z=-5.5)
  if (x >= 5.9 && x <= 8.7 && z >= -6.2 && z <= 5.2 && currentY < 6.8) {
    const t = THREE.MathUtils.clamp((4.5 - z) / 10.0, 0, 1);
    return t * 4.6;
  }
  // West Stairway 2: Upper Hall (y=4.6 at z=-5.5) -> Rooftop (y=9.2 at z=+4.5)
  if (x >= -8.7 && x <= -5.9 && z >= -6.2 && z <= 5.2 && currentY >= 3.2) {
    const t = THREE.MathUtils.clamp((z + 5.5) / 10.0, 0, 1);
    return 4.6 + t * 4.6;
  }
  // Rooftop slab
  if (currentY >= 7.6) return 9.2;
  // Upper Screening Hall slab (avoid lightwell center cutout x:-2.2..2.2, z:-2.0..2.0)
  if (currentY >= 3.0) {
    const inLightwell = Math.abs(x) < 2.2 && Math.abs(z) < 2.0;
    return inLightwell ? 0 : 4.6;
  }
  return 0;
}

function collidesAt(nx, ny, nz) {
  const rad = 0.42;
  for (const c of colliders) {
    if (c.tag === 'threshold-gate' && !c.active) continue;
    // Allow walking onto rooftop above hero walls
    if (ny >= 8.8 && c.tag === 'hero-wall') continue;
    if (ny + 1.5 < c.minY || ny > c.maxY - 0.1) continue;
    if (nx + rad > c.minX && nx - rad < c.maxX && nz + rad > c.minZ && nz - rad < c.maxZ) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Optical Threshold Rule (MONOLITH III)
// ---------------------------------------------------------------------------
function updateThresholdGate() {
  // Gate opens when in Camera Mode and either out of focus (<4m or >18m) OR shadow exposed into Zone II (EV <= -1.2)
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

  const gateTxt = opticalOpen ? 'OPEN (OPTICAL PASSAGE)' : 'SOLID (IN FOCUS)';
  document.getElementById('val-gate').textContent = gateTxt;
  document.getElementById('vf-threshold').textContent = opticalOpen ? 'THRESHOLD GATE: OPEN' : 'THRESHOLD GATE: SOLID';
}

// ---------------------------------------------------------------------------
// Cartridge & Time-of-Day Switching
// ---------------------------------------------------------------------------
function applyCartridgeAndTime() {
  const cart = CARTRIDGES[ledger.cartridge] || CARTRIDGES.ahiya;
  const tp = TIME_PRESETS[ledger.timeOfDay] || TIME_PRESETS.bluehour;

  document.getElementById('city-title').textContent = cart.name;
  document.getElementById('city-district').textContent = cart.district;
  document.getElementById('city-sub').textContent = cart.subtitle;

  document.querySelectorAll('#cartridge-pills .pill').forEach((b) => {
    b.classList.toggle('active', b.dataset.cart === cart.id);
  });
  document.querySelectorAll('#time-pills .pill').forEach((b) => {
    b.classList.toggle('active', b.dataset.time === ledger.timeOfDay);
  });

  // Palette
  mats.masonryExt.color.set(cart.palette.masonry);
  neighborMat.color.set(cart.palette.masonryDark);
  mats.trim.color.set(cart.palette.trim);
  mats.asphalt.color.set(cart.palette.asphalt);
  mats.sidewalk.color.set(cart.palette.sidewalk);
  mats.foliage.color.set(cart.palette.foliage);
  mats.cyanActive.color.set(cart.palette.cyan);
  mats.cyanActive.emissive.set(cart.palette.cyan);

  // Sun & Atmosphere
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
  scene.fog.density = cart.palette.submerged ? 0.0145 : tp.fogDensity;

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
// Unified Water, Relay, Window Print & Screening Sheet Sync
// ---------------------------------------------------------------------------
function syncWorldVisualsFromLedger() {
  document.getElementById('val-water').textContent = `${ledger.carriedWaterL.toFixed(1)} / 20 L`;
  document.getElementById('bar-water').style.width = `${(ledger.carriedWaterL / 20) * 100}%`;

  const wet = ledger.projectorTankL >= 5.0;
  document.getElementById('val-tank').textContent = `${ledger.projectorTankL.toFixed(1)} / 5.0 L (${wet ? 'COOLED' : 'DRY'})`;

  // Sight-glass liquid level
  const fillFrac = THREE.MathUtils.clamp(ledger.projectorTankL / 5.0, 0.02, 1.0);
  sightGlassLiquid.scale.y = fillFrac;
  sightGlassLiquid.position.y = 4.68 + fillFrac * 0.62;

  // Cyan conduits & Rooftop Relay Mast respond directly to projectorTankL >= 5
  conduitMat.emissiveIntensity = wet ? 1.8 : 0.14;
  relayBeaconMat.emissiveIntensity = wet ? 2.6 : 0.12;
  relayPointLight.intensity = wet ? 45.0 : 1.5;

  // Standpipe water level
  const depotFrac = THREE.MathUtils.clamp(ledger.standpipeReserveL / 40.0, 0.05, 1.0);
  depotWater.scale.y = depotFrac;
  depotWater.position.y = 0.28 + depotFrac * 1.0;

  // Plates count
  const pubCount = ledger.plates.filter((p) => p.permission === 'public').length;
  document.getElementById('val-plates').textContent = `${ledger.plates.length} (${pubCount} PUBLIC)`;

  // Apply mounted textures to 3 Storefront Window Frames
  const loader = new THREE.TextureLoader();
  ledger.windowPlateIds.forEach((pid, idx) => {
    const wf = windowFrames[idx];
    if (!wf) return;
    const plate = ledger.plates.find((p) => p.id === pid);
    if (plate && plate.dataUrl) {
      if (wf.loadedId !== pid) {
        wf.loadedId = pid;
        loader.load(plate.dataUrl, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          wf.mat.map = tex;
          wf.mat.color.set('#ffffff');
          wf.mat.emissive.set('#222830');
          wf.mat.needsUpdate = true;
        });
      }
    }
  });

  // Apply projected texture to Upper Screening Sheet (only if cooling tank >= 5L!)
  const screenPlate = ledger.plates.find((p) => p.id === ledger.screenPlateId);
  if (wet && screenPlate && screenPlate.dataUrl) {
    projectorBeamLight.intensity = 4.2;
    if (screenMesh.userData.loadedId !== screenPlate.id) {
      screenMesh.userData.loadedId = screenPlate.id;
      loader.load(screenPlate.dataUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        screenMat.map = tex;
        screenMat.color.set('#ffffff');
        screenMat.emissive.set('#ffffff');
        screenMat.emissiveMap = tex;
        screenMat.emissiveIntensity = 0.72;
        screenMat.needsUpdate = true;
      });
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
// Toast Helper
// ---------------------------------------------------------------------------
let toastTimer = null;
function showToast(msg, ms = 3200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------------------------------------------------------------------------
// Photo Capture (Real Canvas Frame + Subject Detection + Permission Rule)
// ---------------------------------------------------------------------------
function capturePlate() {
  audio.playShutter();
  const flash = document.getElementById('shutter-flash');
  flash.style.opacity = '0.85';
  setTimeout(() => { flash.style.opacity = '0'; }, 140);

  // Render clean GPU-shaded frame right before capture
  const lookObj = CITY_LOOKS.find((l) => l.id === camState.stock) || CITY_LOOKS[0];
  shaderPipeline.render(scene, camera, {
    time: performance.now() * 0.001,
    focusM: camState.focusM,
    dofAmount: camState.active ? 0.65 : 0.0,
    ev: camState.exposureEv,
    mode: lookObj.mode,
  });

  // Downscale to 480x300 JPEG dataUrl preserving the exact GLSL GPU Zone shader output
  const off = document.createElement('canvas');
  off.width = 480;
  off.height = 300;
  const ctx = off.getContext('2d');
  ctx.drawImage(renderer.domElement, 0, 0, off.width, off.height);
  const dataUrl = off.toDataURL('image/jpeg', 0.86);

  // Detect if any persistent resident is framed in the center of the camera frustum
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
    stock: camState.stock.toUpperCase(),
    subjectId: framedResident ? framedResident.id : null,
    subjectName: framedResident ? framedResident.def.name : 'Architecture / Street',
    permission: framedResident ? 'pending' : 'public',
    caption: framedResident
      ? `Portrait of ${framedResident.def.name} (${framedResident.def.role}) — awaiting subject credit`
      : `${cart.name} · ${locLabel} (${camState.focalMm}mm, ${camState.stock.toUpperCase()})`,
    viewpoint: { x: player.pos.x, y: player.floorY, z: player.pos.z, yaw: player.yaw, pitch: player.pitch },
  };

  ledger.plates.push(plate);
  saveLedger();
  syncWorldVisualsFromLedger();
  renderLightTable();

  if (framedResident) {
    showToast(`Exposed ${plate.id} with ${framedResident.def.name}. Talk to ${framedResident.def.name} (E) to credit & unlock public display.`, 4500);
  } else {
    showToast(`Exposed public plate ${plate.id} (${locLabel}). Hang it in the Camera Shop Window or Screening Hall!`, 3600);
  }
}

// ---------------------------------------------------------------------------
// Resident Duet Dialogue
// ---------------------------------------------------------------------------
function openDialogue(res) {
  activeDialogueResident = res;
  const d = res.def;
  const card = document.getElementById('dialogue-card');
  document.getElementById('dlg-name').textContent = d.name;
  document.getElementById('dlg-role').textContent = `${d.role} · ${d.stations[res.stationIdx].task}`;
  document.getElementById('dlg-body').textContent = d.duet.greeting;
  document.getElementById('dlg-reply').textContent = `You: "${d.duet.reply}"`;

  audio.speakDuet(d.name, d.duet.greeting, d.id === 'bekele' ? 0.88 : 1.05);

  const actions = document.getElementById('dlg-actions');
  actions.innerHTML = '';

  const addBtn = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'ctx-btn';
    b.textContent = label;
    b.addEventListener('click', fn);
    actions.appendChild(b);
  };

  addBtn('Ask About Job', () => {
    document.getElementById('dlg-body').textContent = d.duet.job;
    audio.speakDuet(d.name, d.duet.job, d.id === 'bekele' ? 0.88 : 1.05);
  });

  // Check for pending portrait permission of this resident
  const pendingPlate = ledger.plates.find((p) => p.subjectId === res.id && p.permission === 'pending');
  if (pendingPlate) {
    addBtn(`Approve & Credit ${pendingPlate.id}`, () => {
      pendingPlate.permission = 'public';
      pendingPlate.caption = `${d.name} (${d.role}) — credited & approved for public screening`;
      saveLedger();
      syncWorldVisualsFromLedger();
      renderLightTable();
      document.getElementById('dlg-body').textContent = d.duet.creditApprove;
      audio.speakDuet(d.name, d.duet.creditApprove, d.id === 'bekele' ? 0.88 : 1.05);
      showToast(`${pendingPlate.id} approved for Camera Shop Window & Screening Hall.`);
      openDialogue(res);
    });
  }

  if (ledger.carriedWaterL >= 5.0) {
    addBtn('Pour 5 L Water', () => {
      ledger.carriedWaterL = Math.max(0, ledger.carriedWaterL - 5.0);
      if (res.id === 'june') {
        ledger.projectorTankL = Math.min(10.0, ledger.projectorTankL + 5.0);
      }
      saveLedger();
      syncWorldVisualsFromLedger();
      audio.playPour();
      document.getElementById('dlg-body').textContent = d.duet.waterThanks;
      audio.speakDuet(d.name, d.duet.waterThanks, d.id === 'bekele' ? 0.88 : 1.05);
      openDialogue(res);
    });
  }

  addBtn('Close (Esc)', closeDialogue);
  card.classList.add('open');
}

function closeDialogue() {
  activeDialogueResident = null;
  document.getElementById('dialogue-card').classList.remove('open');
}

// ---------------------------------------------------------------------------
// Contextual Proximity Actions (Standpipe, Cooling Tank, Shop Window, Screen, NPC)
// ---------------------------------------------------------------------------
function evaluateContextPrompt() {
  if (activeDialogueResident || nolliOpen || lightTableOpen) {
    document.getElementById('context-prompt').classList.remove('visible');
    currentContextAction = null;
    return;
  }

  const p = player.pos;
  let best = null;

  // 1. Nearby Resident (within 4.8 m)
  for (const r of residents) {
    const dist = p.distanceTo(r.root.position);
    if (dist < 4.8 && Math.abs(player.floorY - r.root.position.y) < 2.2) {
      best = {
        key: 'E',
        text: `[E] Talk to ${r.def.name} (${r.def.role})`,
        btn: `Talk to ${r.def.name}`,
        fn: () => openDialogue(r),
      };
      break;
    }
  }

  // 2. Standpipe Depot (-16, 0, 14)
  if (!best && p.distanceTo(new THREE.Vector3(-16, 0, 14)) < 4.2 && player.floorY < 1.5) {
    best = {
      key: 'F',
      text: `[F] Draw 5 L from ${CARTRIDGES[ledger.cartridge].depotName} (${ledger.standpipeReserveL.toFixed(0)} L left)`,
      btn: 'Draw 5 L',
      fn: () => {
        if (ledger.carriedWaterL >= 20) return showToast('Jerrycan is full (20 L).');
        if (ledger.standpipeReserveL < 5) return showToast('Standpipe reserve is low.');
        ledger.carriedWaterL = Math.min(20, ledger.carriedWaterL + 5);
        ledger.standpipeReserveL = Math.max(0, ledger.standpipeReserveL - 5);
        audio.playPour();
        saveLedger();
        syncWorldVisualsFromLedger();
        showToast('Drew 5 L of living water. Carry it up the interior stairwell to the Projector Tank.');
      },
    };
  }

  // 3. Hidden Courtyard Cistern (-14, 0, -16)
  if (!best && p.distanceTo(new THREE.Vector3(-14, 0, -16)) < 4.5 && player.floorY < 1.5) {
    best = {
      key: 'F',
      text: '[F] Refill 10 L from Hidden Courtyard Cistern',
      btn: 'Refill 10 L',
      fn: () => {
        ledger.carriedWaterL = Math.min(20, ledger.carriedWaterL + 10);
        audio.playPour();
        saveLedger();
        syncWorldVisualsFromLedger();
        showToast('Refilled from the Threshold Courtyard Cistern.');
      },
    };
  }

  // 4. Upper Screening Hall Projector Cooling Tank (-1.4, 4.6, 1.2)
  if (!best && p.distanceTo(new THREE.Vector3(-1.4, 4.6, 1.2)) < 4.4 && Math.abs(player.floorY - 4.6) < 1.8) {
    if (ledger.projectorTankL < 5.0) {
      best = {
        key: 'F',
        text: ledger.carriedWaterL >= 5.0
          ? '[F] Pour 5 L into Projector Cooling Sight-Glass'
          : 'Projector Cooling Tank is DRY — draw 5 L at the street Standpipe first',
        btn: ledger.carriedWaterL >= 5.0 ? 'Pour 5 L' : 'Need 5 L',
        fn: () => {
          if (ledger.carriedWaterL < 5.0) return showToast('Carry at least 5 L from the street Standpipe first.');
          ledger.carriedWaterL -= 5.0;
          ledger.projectorTankL = Math.min(10.0, ledger.projectorTankL + 5.0);
          audio.playPour();
          saveLedger();
          syncWorldVisualsFromLedger();
          showToast('Projector cooling loop filled! Cyan rooftop relay is LIVE — you can now project a public plate.');
        },
      };
    } else {
      const pubPlate = [...ledger.plates].reverse().find((pl) => pl.permission === 'public');
      best = {
        key: 'F',
        text: pubPlate
          ? `[F] Project ${pubPlate.id} onto Linen Sheet`
          : 'Cooling loop ready — expose a public photograph (C + Space) to project',
        btn: pubPlate ? 'Project Plate' : 'Open Camera',
        fn: () => {
          if (!pubPlate) return toggleCameraMode(true);
          ledger.screenPlateId = pubPlate.id;
          saveLedger();
          syncWorldVisualsFromLedger();
          showToast(`Now screening ${pubPlate.id} on the Upper Hall linen sheet.`);
        },
      };
    }
  }

  // 5. Camera Shop Storefront Window / Light Table (ground floor inside/outside near z=7 or x=4,z=-1.8)
  if (!best && player.floorY < 1.5 && (p.distanceTo(new THREE.Vector3(4.0, 0, -1.8)) < 4.2 || p.distanceTo(new THREE.Vector3(-4.8, 0, 8.2)) < 3.6)) {
    const pubPlate = [...ledger.plates].reverse().find((pl) => pl.permission === 'public');
    best = {
      key: 'F',
      text: pubPlate
        ? `[F] Hang ${pubPlate.id} in Camera Shop Storefront Window`
        : 'Camera Shop Window — expose an approved photograph (C + Space) to hang here',
      btn: pubPlate ? 'Hang Print' : 'Light Table',
      fn: () => {
        if (!pubPlate) return toggleLightTable(true);
        const slot = ledger.windowPlateIds.indexOf(null);
        const idx = slot >= 0 ? slot : 0;
        ledger.windowPlateIds[idx] = pubPlate.id;
        saveLedger();
        syncWorldVisualsFromLedger();
        showToast(`Mounted ${pubPlate.id} in Storefront Window #${idx + 1}. Step outside to see it from the street.`);
      },
    };
  }

  const promptEl = document.getElementById('context-prompt');
  if (best) {
    currentContextAction = best;
    document.getElementById('context-text').textContent = best.text;
    document.getElementById('context-btn').textContent = best.btn;
    promptEl.classList.add('visible');
  } else {
    currentContextAction = null;
    promptEl.classList.remove('visible');
  }
}

// ---------------------------------------------------------------------------
// 2D Nolli Plan Map (Click Any Street or Public Interior to Travel)
// ---------------------------------------------------------------------------
function drawNolliMap() {
  const canvas = document.getElementById('nolli-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const scale = 6.2; // pixels per meter
  const toX = (wx) => W / 2 + wx * scale;
  const toY = (wz) => H / 2 + wz * scale;

  // Nolli Convention: Open white/parchment = walkable streets & public interiors
  ctx.fillStyle = '#ece8de';
  ctx.fillRect(0, 0, W, H);

  // Subtle Atlantis concentric rings when Atlantis cartridge is active
  if (ledger.cartridge === 'atlantis') {
    ctx.strokeStyle = 'rgba(24, 180, 255, 0.22)';
    ctx.lineWidth = 1.5;
    [16, 28, 40].forEach((r) => {
      ctx.beginPath();
      ctx.arc(toX(0), toY(0), r * scale, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  // Solid Poche (dark charcoal) for surrounding private building footprints
  ctx.fillStyle = '#1b1d20';
  neighborSpecs.forEach(([x, , z, w, , d]) => {
    ctx.fillRect(toX(x - w / 2), toY(z - d / 2), w * scale, d * scale);
  });

  // Hero Nolli Building: Solid exterior poche walls ONLY, leaving public interior carved WHITE!
  ctx.strokeStyle = '#141618';
  ctx.lineWidth = 6;
  ctx.strokeRect(toX(-9), toY(-7), 18 * scale, 14 * scale);
  // Open front doorway gap in white
  ctx.fillStyle = '#ece8de';
  ctx.fillRect(toX(-2.4), toY(6.4), 4.8 * scale, 1.4 * scale);

  // Lightwell dashed square & stair indicators
  ctx.strokeStyle = 'rgba(24, 180, 255, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(toX(-2.4), toY(-2.2), 4.8 * scale, 4.4 * scale);
  ctx.setLineDash([]);

  // Threshold Gate bar
  ctx.strokeStyle = gateCollider.active ? '#b04a3a' : '#18b4ff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(toX(-19), toY(-7));
  ctx.lineTo(toX(-9), toY(-7));
  ctx.stroke();

  // Cyan Network Points
  const cyanPoints = [
    [-16, 14, 'Standpipe Depot'],
    [-14, -16, 'Courtyard Cistern'],
    [-1.8, 1.2, 'Upper Projector'],
    [-6.5, 4.5, 'Rooftop Relay'],
  ];
  ctx.font = '600 10px Inter, sans-serif';
  cyanPoints.forEach(([x, z, label]) => {
    ctx.fillStyle = '#0e90d4';
    ctx.beginPath();
    ctx.arc(toX(x), toY(z), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#141618';
    ctx.fillText(label, toX(x) + 8, toY(z) + 3);
  });

  // Labels for Public Nolli Interior
  ctx.fillStyle = '#4c4942';
  ctx.fillText('CAMERA SHOP & ARCHIVE (Y=0)', toX(-7.5), toY(4.5));
  ctx.fillText('SCREENING HALL (Y=4.6)', toX(-7.5), toY(-4.5));
  ctx.fillText('STAIRS ->', toX(4.8), toY(0));

  // Residents
  residents.forEach((r) => {
    ctx.fillStyle = '#9c7b43';
    ctx.beginPath();
    ctx.arc(toX(r.root.position.x), toY(r.root.position.z), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#141618';
    ctx.fillText(r.def.name, toX(r.root.position.x) + 7, toY(r.root.position.z) + 3);
  });

  // Player
  ctx.fillStyle = '#d93829';
  ctx.beginPath();
  ctx.arc(toX(player.pos.x), toY(player.pos.z), 6, 0, Math.PI * 2);
  ctx.fill();
}

document.getElementById('nolli-canvas').addEventListener('click', (e) => {
  const rect = e.target.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * 560;
  const cy = ((e.clientY - rect.top) / rect.height) * 560;
  const wx = (cx - 280) / 6.2;
  const wz = (cy - 280) / 6.2;
  if (!collidesAt(wx, 0, wz)) {
    player.pos.set(wx, 0, wz);
    player.floorY = 0;
    toggleNolliMap(false);
    showToast(`Dropped from Nolli Plan to (${wx.toFixed(1)}, ${wz.toFixed(1)}).`);
  }
});

// ---------------------------------------------------------------------------
// Light Table & Contact Sheet Modal
// ---------------------------------------------------------------------------
function renderLightTable() {
  const grid = document.getElementById('plate-grid');
  const empty = document.getElementById('plate-empty');
  grid.innerHTML = '';
  if (!ledger.plates.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  [...ledger.plates].reverse().forEach((pl) => {
    const card = document.createElement('div');
    card.className = 'plate-card';
    const isPub = pl.permission === 'public';
    card.innerHTML = `
      <img src="${pl.dataUrl}" alt="${pl.id}">
      <div class="plate-meta">
        <strong>${pl.id} · ${pl.locationName}</strong>
        <span style="color:var(--muted)">${pl.cartridge} · ${pl.timeOfDay} · ${pl.focalMm}mm · ${pl.stock}</span>
        <span>${pl.caption}</span>
        <span class="plate-badge ${isPub ? 'public' : 'pending'}">${isPub ? 'PUBLIC PERMITTED' : 'PENDING SUBJECT CREDIT'}</span>
        <div class="plate-btns"></div>
      </div>
    `;
    const btns = card.querySelector('.plate-btns');

    const btnVisit = document.createElement('button');
    btnVisit.className = 'pill';
    btnVisit.textContent = 'Return to Viewpoint';
    btnVisit.addEventListener('click', () => {
      if (pl.viewpoint) {
        player.pos.set(pl.viewpoint.x, pl.viewpoint.y, pl.viewpoint.z);
        player.floorY = pl.viewpoint.y;
        player.yaw = pl.viewpoint.yaw;
        player.pitch = pl.viewpoint.pitch;
        toggleLightTable(false);
        showToast(`Returned to viewpoint of ${pl.id}.`);
      }
    });
    btns.appendChild(btnVisit);

    if (isPub) {
      const btnWin = document.createElement('button');
      btnWin.className = 'pill cyan';
      btnWin.textContent = 'Hang in Shop Window';
      btnWin.addEventListener('click', () => {
        const slot = ledger.windowPlateIds.indexOf(null);
        ledger.windowPlateIds[slot >= 0 ? slot : 0] = pl.id;
        saveLedger();
        syncWorldVisualsFromLedger();
        showToast(`Mounted ${pl.id} in the Camera Shop storefront window.`);
      });
      btns.appendChild(btnWin);

      const btnProj = document.createElement('button');
      btnProj.className = 'pill cyan';
      btnProj.textContent = 'Project on Sheet';
      btnProj.addEventListener('click', () => {
        if (ledger.projectorTankL < 5.0) {
          showToast('Projector cooling tank is dry! Carry 5 L up to the Screening Hall first.');
          return;
        }
        ledger.screenPlateId = pl.id;
        saveLedger();
        syncWorldVisualsFromLedger();
        showToast(`Projecting ${pl.id} onto the Upper Screening Hall linen sheet.`);
      });
      btns.appendChild(btnProj);
    }

    grid.appendChild(card);
  });
}

// ---------------------------------------------------------------------------
// UI Toggles & Wiring
// ---------------------------------------------------------------------------
function toggleCameraMode(force) {
  camState.active = typeof force === 'boolean' ? force : !camState.active;
  document.getElementById('camera-hud').classList.toggle('active', camState.active);
  document.getElementById('btn-cam').classList.toggle('active', camState.active);
  updateCameraLensUI();
  updateThresholdGate();
}

function toggleXray(force) {
  camState.xray = typeof force === 'boolean' ? force : !camState.xray;
  document.getElementById('btn-xray').classList.toggle('active', camState.xray);
  mats.masonryExt.transparent = camState.xray;
  mats.masonryExt.opacity = camState.xray ? 0.16 : 1.0;
  mats.masonryExt.depthWrite = !camState.xray;
  mats.masonryExt.needsUpdate = true;
  mats.xrayWire.opacity = camState.xray ? 0.42 : 0.0;
  showToast(camState.xray ? 'Inverse Tomology X-Ray ON — interior rooms & cyan conduits revealed.' : 'Inverse X-Ray OFF.');
}

function toggleNolliMap(force) {
  nolliOpen = typeof force === 'boolean' ? force : !nolliOpen;
  document.getElementById('nolli-modal').classList.toggle('open', nolliOpen);
  document.getElementById('btn-nolli').classList.toggle('active', nolliOpen);
  if (nolliOpen) drawNolliMap();
}

function toggleLightTable(force) {
  lightTableOpen = typeof force === 'boolean' ? force : !lightTableOpen;
  document.getElementById('lighttable-modal').classList.toggle('open', lightTableOpen);
  document.getElementById('btn-lighttable').classList.toggle('active', lightTableOpen);
  if (lightTableOpen) renderLightTable();
}

const shaderSelect = document.getElementById('shader-select');
CITY_LOOKS.forEach((look) => {
  const opt = document.createElement('option');
  opt.value = look.id;
  opt.textContent = `Shader: ${look.name}`;
  shaderSelect.appendChild(opt);
});

function setLook(lookId, announce = false) {
  const found = CITY_LOOKS.find((l) => l.id === lookId) || CITY_LOOKS[0];
  camState.stock = found.id;
  shaderSelect.value = found.id;
  document.querySelectorAll('#stock-pills .pill').forEach((p) => {
    p.classList.toggle('active', p.dataset.stock === found.id);
  });
  updateCameraLensUI();
  if (announce) showToast(`GPU Shader: ${found.name} — ${found.desc}`, 2600);
}

shaderSelect.addEventListener('change', (e) => setLook(e.target.value, true));
document.getElementById('btn-prev-shader').addEventListener('click', () => {
  const idx = CITY_LOOKS.findIndex((l) => l.id === camState.stock);
  setLook(CITY_LOOKS[(idx - 1 + CITY_LOOKS.length) % CITY_LOOKS.length].id, true);
});
document.getElementById('btn-next-shader').addEventListener('click', () => {
  const idx = CITY_LOOKS.findIndex((l) => l.id === camState.stock);
  setLook(CITY_LOOKS[(idx + 1) % CITY_LOOKS.length].id, true);
});

function updateCameraLensUI() {
  // Approximate 35mm vertical FOV from focal length
  const fov = THREE.MathUtils.radToDeg(2 * Math.atan(24 / (2 * camState.focalMm)));
  camera.fov = camState.active ? fov : 52;
  camera.updateProjectionMatrix();

  const lookObj = CITY_LOOKS.find((l) => l.id === camState.stock) || CITY_LOOKS[0];
  document.getElementById('lbl-focal').textContent = `${camState.focalMm}mm`;
  document.getElementById('lbl-focus').textContent = `${camState.focusM.toFixed(1)}m`;
  document.getElementById('lbl-ev').textContent = `${camState.exposureEv >= 0 ? '+' : ''}${camState.exposureEv.toFixed(1)} EV`;
  document.getElementById('vf-readout').textContent =
    `${camState.focalMm}MM · FOCUS ${camState.focusM.toFixed(1)}M · EV ${camState.exposureEv.toFixed(1)} · ${lookObj.name.toUpperCase()}`;

  updateThresholdGate();
}

// Event Listeners
document.querySelectorAll('#cartridge-pills .pill').forEach((b) => {
  b.addEventListener('click', () => {
    ledger.cartridge = b.dataset.cart;
    applyCartridgeAndTime();
    showToast(`Switched Worldtext Cartridge to ${CARTRIDGES[ledger.cartridge].name}.`);
  });
});

document.querySelectorAll('#time-pills .pill').forEach((b) => {
  b.addEventListener('click', () => {
    ledger.timeOfDay = b.dataset.time;
    applyCartridgeAndTime();
  });
});

document.querySelectorAll('#stock-pills .pill').forEach((b) => {
  b.addEventListener('click', () => {
    setLook(b.dataset.stock, true);
  });
});

document.getElementById('sl-focal').addEventListener('input', (e) => {
  camState.focalMm = Number(e.target.value);
  updateCameraLensUI();
});
document.getElementById('sl-focus').addEventListener('input', (e) => {
  camState.focusM = Number(e.target.value);
  updateCameraLensUI();
});
document.getElementById('sl-ev').addEventListener('input', (e) => {
  camState.exposureEv = Number(e.target.value);
  updateCameraLensUI();
});
document.getElementById('btn-tripod').addEventListener('click', (e) => {
  camState.tripodLocked = !camState.tripodLocked;
  e.target.classList.toggle('active', camState.tripodLocked);
  e.target.textContent = camState.tripodLocked ? 'Tripod: Locked' : 'Tripod: Off';
  audio.playTripodLock();
});
document.getElementById('shutter-btn').addEventListener('click', capturePlate);

document.getElementById('btn-cam').addEventListener('click', () => toggleCameraMode());
document.getElementById('btn-xray').addEventListener('click', () => toggleXray());
document.getElementById('btn-nolli').addEventListener('click', () => toggleNolliMap());
document.getElementById('btn-lighttable').addEventListener('click', () => toggleLightTable());
document.getElementById('close-nolli').addEventListener('click', () => toggleNolliMap(false));
document.getElementById('close-lighttable').addEventListener('click', () => toggleLightTable(false));
document.getElementById('context-btn').addEventListener('click', () => {
  if (currentContextAction) currentContextAction.fn();
});

document.getElementById('btn-audio').addEventListener('click', async (e) => {
  const on = await audio.toggle();
  e.target.classList.toggle('active', on);
  e.target.textContent = on ? 'Audio: On' : 'Audio: Off';
});

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'escape') {
    closeDialogue();
    toggleNolliMap(false);
    toggleLightTable(false);
    if (camState.active) toggleCameraMode(false);
    return;
  }
  if (k === 'c') toggleCameraMode();
  if (k === 'x') toggleXray();
  if (k === 'm') toggleNolliMap();
  if (k === 'l') toggleLightTable();
  if (k === '[') document.getElementById('btn-prev-shader').click();
  if (k === ']') document.getElementById('btn-next-shader').click();
  if (k === ' ' && camState.active) {
    e.preventDefault();
    capturePlate();
  }
  if (k === 'e' && currentContextAction && currentContextAction.key === 'E') {
    currentContextAction.fn();
  }
  if (k === 'f' && currentContextAction && currentContextAction.key === 'F') {
    currentContextAction.fn();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Mouse drag look + Direct 3D Click-to-Talk Raycast
const raycaster = new THREE.Raycaster();
renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastMouse.x = e.clientX;
  lastMouse.y = e.clientY;
  pointerDownPos.x = e.clientX;
  pointerDownPos.y = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastMouse.x;
  const dy = e.clientY - lastMouse.y;
  lastMouse.x = e.clientX;
  lastMouse.y = e.clientY;
  player.yaw -= dx * 0.0042;
  player.pitch = THREE.MathUtils.clamp(player.pitch - dy * 0.0036, -0.95, 0.95);
});
window.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (moved < 6 && !nolliOpen && !lightTableOpen) {
    const ndc = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(residentHitMeshes, false);
    if (hits.length > 0 && hits[0].distance < 22) {
      const rid = hits[0].object.userData.residentId;
      const res = residents.find((r) => r.id === rid);
      if (res) openDialogue(res);
    }
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  shaderPipeline.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Main Simulation Loop
// ---------------------------------------------------------------------------
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('cart') && CARTRIDGES[urlParams.get('cart')]) {
  ledger.cartridge = urlParams.get('cart');
}
if (urlParams.get('time') && TIME_PRESETS[urlParams.get('time')]) {
  ledger.timeOfDay = urlParams.get('time');
}
if (urlParams.get('look')) {
  setLook(urlParams.get('look'), false);
}

applyCartridgeAndTime();
syncWorldVisualsFromLedger();
updateCameraLensUI();
showToast(CARTRIDGES[ledger.cartridge].assignment, 5200);

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
} else if (urlParams.get('map') === '1') {
  toggleNolliMap(true);
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const elapsed = clock.elapsedTime;

  // Player Movement (locked when tripod is deployed or modal open)
  let moving = false;
  if (!camState.tripodLocked && !nolliOpen && !lightTableOpen && !activeDialogueResident) {
    let fwd = 0;
    let strafe = 0;
    if (keys['w'] || keys['arrowup']) fwd += 1;
    if (keys['s'] || keys['arrowdown']) fwd -= 1;
    if (keys['a'] || keys['arrowleft']) strafe -= 1;
    if (keys['d'] || keys['arrowright']) strafe += 1;

    if (fwd !== 0 || strafe !== 0) {
      moving = true;
      const spd = (keys['shift'] ? 8.8 : player.speed) * dt;
      const sinY = Math.sin(player.yaw);
      const cosY = Math.cos(player.yaw);
      const vx = (-sinY * fwd + cosY * strafe) * spd;
      const vz = (-cosY * fwd - sinY * strafe) * spd;

      const nx = THREE.MathUtils.clamp(player.pos.x + vx, -44, 44);
      const nz = THREE.MathUtils.clamp(player.pos.z + vz, -44, 44);
      const nextFloor = computeFloorHeight(nx, nz, player.floorY);

      if (!collidesAt(nx, nextFloor, player.pos.z)) player.pos.x = nx;
      if (!collidesAt(player.pos.x, nextFloor, nz)) player.pos.z = nz;
      player.floorY = computeFloorHeight(player.pos.x, player.pos.z, player.floorY);
    }
  }

  player.pos.y = THREE.MathUtils.lerp(player.pos.y, player.floorY, Math.min(1, dt * 12));
  player.isInside = Math.abs(player.pos.x) < 8.8 && Math.abs(player.pos.z) < 6.8 && player.floorY < 8.6;

  const badge = document.getElementById('space-badge');
  if (player.isInside) {
    badge.textContent = player.floorY >= 3.8 ? 'INTERIOR · SCREENING HALL' : 'INTERIOR · CAMERA SHOP & ARCHIVE';
    badge.classList.add('inside');
  } else if (player.floorY >= 8.5) {
    badge.textContent = 'EXTERIOR · ROOFTOP OVERLOOK';
    badge.classList.remove('inside');
  } else {
    badge.textContent = 'EXTERIOR · STREET & COURTYARD';
    badge.classList.remove('inside');
  }

  // Camera transform
  camera.position.set(player.pos.x, player.pos.y + player.eyeHeight, player.pos.z);
  const euler = new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ');
  camera.quaternion.setFromEuler(euler);

  // Persistent Resident Jobs & Natural Walking / Idle Pose
  for (const r of residents) {
    const targetSt = r.def.stations[r.stationIdx];
    const targetVec = new THREE.Vector3(targetSt.x, targetSt.y, targetSt.z);
    const toT = targetVec.clone().sub(r.root.position);
    const dist = toT.length();
    const distToPlayer = r.root.position.distanceTo(player.pos);

    if (distToPlayer < 4.5 && Math.abs(r.root.position.y - player.floorY) < 2.0) {
      // Turn to face player with relaxed downward-hanging arms
      const ang = Math.atan2(player.pos.x - r.root.position.x, player.pos.z - r.root.position.z);
      r.root.rotation.y = THREE.MathUtils.lerp(r.root.rotation.y, ang, dt * 5);
      r.armL.rotation.x = THREE.MathUtils.lerp(r.armL.rotation.x, 0, dt * 6);
      r.armR.rotation.x = THREE.MathUtils.lerp(r.armR.rotation.x, 0, dt * 6);
      r.legL.rotation.x = THREE.MathUtils.lerp(r.legL.rotation.x, 0, dt * 6);
      r.legR.rotation.x = THREE.MathUtils.lerp(r.legR.rotation.x, 0, dt * 6);
    } else if (dist > 0.35) {
      toT.normalize();
      r.root.position.addScaledVector(toT, dt * 1.45);
      r.root.rotation.y = Math.atan2(toT.x, toT.z);
      r.walkPhase += dt * 5.2;
      const swing = Math.sin(r.walkPhase) * 0.32;
      r.armL.rotation.x = swing;
      r.armR.rotation.x = -swing;
      r.legL.rotation.x = -swing * 1.1;
      r.legR.rotation.x = swing * 1.1;
    } else {
      // Working at station (subtle natural breathing / relaxed arms)
      r.armL.rotation.x = THREE.MathUtils.lerp(r.armL.rotation.x, 0.04 * Math.sin(elapsed * 2), dt * 4);
      r.armR.rotation.x = THREE.MathUtils.lerp(r.armR.rotation.x, -0.04 * Math.sin(elapsed * 2), dt * 4);
      r.legL.rotation.x = THREE.MathUtils.lerp(r.legL.rotation.x, 0, dt * 5);
      r.legR.rotation.x = THREE.MathUtils.lerp(r.legR.rotation.x, 0, dt * 5);
      r.dwellTimer -= dt;
      if (r.dwellTimer <= 0) {
        r.stationIdx = (r.stationIdx + 1) % r.def.stations.length;
        r.dwellTimer = 6 + Math.random() * 6;
      }
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

  // Context prompt & Freesound Audio update
  evaluateContextPrompt();
  const projectorDist = player.pos.distanceTo(new THREE.Vector3(-1.8, 4.6, 1.2));
  audio.update(dt, {
    isInside: player.isInside,
    nightMix: TIME_PRESETS[ledger.timeOfDay].audioNightMix,
    submerged: cart.palette.submerged,
    moving,
    projectorDist,
    projectorWet: ledger.projectorTankL >= 5.0,
  });

  const lookObj = CITY_LOOKS.find((l) => l.id === camState.stock) || CITY_LOOKS[0];
  shaderPipeline.render(scene, camera, {
    time: elapsed,
    focusM: camState.focusM,
    dofAmount: camState.active ? 0.65 : 0.0,
    ev: camState.exposureEv,
    mode: lookObj.mode,
  });
}

animate();

// Expose minimal debug/verification handle
window.__CITY__ = {
  ledger,
  player,
  camState,
  toggleCameraMode,
  toggleXray,
  toggleNolliMap,
  toggleLightTable,
  capturePlate,
  applyCartridgeAndTime,
  syncWorldVisualsFromLedger,
};
