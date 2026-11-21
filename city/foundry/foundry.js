// Foundry, Calvino Evolution & Inverse Tomology (Briefs 2, 3 & 9)
// Co-evolves The Severn's 20x12m exterior context & walkable interior rooms,
// stages an inhabited Anny V8 parcel-handoff shot with forward/reverse angles,
// and syncs state across tools via pilot-state.js + 23 GPU Shaders.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  mountWebGLShaderSuite,
  loadPilotState,
  savePilotState,
  subscribePilotState,
  applyPilotUrlHash,
} from '../shader-suite-bar.js';
import {
  useLibrary,
  build,
  tile,
  setThresholdDoor,
  floorAt,
  isBlocked,
  mutateSevernCandidate,
  SimpleOrbitControls as OrbitControls,
} from '../heroes/hdl-compiler.js';

const $ = (id) => document.getElementById(id);
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

// Hydrate shared Severn Pilot record (make_photo_pilot_v1)
const pilotInit = applyPilotUrlHash();

// Load bundled local upstream data (zero external network fetches)
const [FOUNDRY, SEVERN_BUNDLE, LIB] = await Promise.all([
  fetch('./data/foundry-data.json').then((r) => r.json()),
  fetch('./data/severn-hdl.json').then((r) => r.json()),
  fetch('../heroes/data/library.json').then((r) => r.json()),
]);

useLibrary(LIB, null);
new THREE.TextureLoader().load('../heroes/data/library.webp', (tex) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  useLibrary(LIB, tex);
  rebuildActiveCandidate(false);
});

// ---------------------------------------------------------------------------
// Renderer, Sky Dome, Wet Street & Neighboring Context
// ---------------------------------------------------------------------------
const wrap = $('canvas-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0c1f38');
scene.fog = new THREE.FogExp2('#132c4a', 0.0068);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.12, 320);
camera.rotation.order = 'YXZ';

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.enabled = false;

// Sky Dome (Cobalt-Cerulean WEAVE gradient)
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 64;
skyCanvas.height = 256;
function paintSkyDome(topHex, midHex, horHex) {
  const ctx = skyCanvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, topHex);
  g.addColorStop(0.55, midHex);
  g.addColorStop(1, horHex);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
}
paintSkyDome('#0c1f38', '#285a8c', '#7ea0bc');
const skyTex = new THREE.CanvasTexture(skyCanvas);
skyTex.colorSpace = THREE.SRGBColorSpace;
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(240, 28, 18),
  new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false })
);
scene.add(skyDome);

const hemiLight = new THREE.HemisphereLight('#c8e0f8', '#524034', 1.32);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#ffdcb8', 2.45);
sunLight.position.set(-28, 42, -32);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 2, far: 140 });
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// Procedural Wet Asphalt & Dry Granite Sidewalk (wet reflections restricted to wet asphalt)
function createStreetTextures() {
  const sz = 512;
  const col = document.createElement('canvas');
  col.width = col.height = sz;
  const c = col.getContext('2d');
  c.fillStyle = '#222830';
  c.fillRect(0, 0, sz, sz);
  for (let i = 0; i < 4500; i++) {
    const v = 28 + ((i * 19) % 24);
    c.fillStyle = `rgb(${v},${v + 3},${v + 7})`;
    c.fillRect((i * 73) % sz, (i * 137) % sz, 2, 2);
  }
  c.strokeStyle = 'rgba(12, 16, 22, 0.42)';
  for (let g = 0; g < sz; g += 64) {
    c.beginPath(); c.moveTo(g, 0); c.lineTo(g, sz); c.stroke();
    c.beginPath(); c.moveTo(0, g); c.lineTo(sz, g); c.stroke();
  }
  const rgh = document.createElement('canvas');
  rgh.width = rgh.height = sz;
  const r = rgh.getContext('2d');
  r.fillStyle = '#bcbcbc';
  r.fillRect(0, 0, sz, sz);
  for (let i = 0; i < 18; i++) {
    const px = ((i * 97 + 40) % (sz - 80)) + 40;
    const py = ((i * 151 + 50) % (sz - 80)) + 40;
    const rad = 28 + (i % 4) * 16;
    const grd = r.createRadialGradient(px, py, 2, px, py, rad);
    grd.addColorStop(0, 'rgba(18,18,18,0.95)');
    grd.addColorStop(0.7, 'rgba(70,70,70,0.55)');
    grd.addColorStop(1, 'rgba(190,190,190,0)');
    r.fillStyle = grd;
    r.beginPath();
    r.arc(px, py, rad, 0, Math.PI * 2);
    r.fill();
  }
  const map = new THREE.CanvasTexture(col);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(12, 12);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(rgh);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(12, 12);
  return { map, roughnessMap };
}

const worldRoot = new THREE.Group();
scene.add(worldRoot);

const streetTex = createStreetTextures();
const wetAsphalt = new THREE.Mesh(
  new THREE.PlaneGeometry(180, 180),
  new THREE.MeshStandardMaterial({
    map: streetTex.map,
    roughnessMap: streetTex.roughnessMap,
    roughness: 0.35,
    metalness: 0.22,
  })
);
wetAsphalt.rotation.x = -Math.PI / 2;
wetAsphalt.position.y = -0.04;
wetAsphalt.receiveShadow = true;
worldRoot.add(wetAsphalt);

// Dry Granite Sidewalk & Usable Curb Apron (y = 0, street bed at y = -0.04)
const sidewalkMat = new THREE.MeshStandardMaterial({ color: '#7a756c', roughness: 0.86, metalness: 0.02 });
const curbMat = new THREE.MeshStandardMaterial({ color: '#9c9488', roughness: 0.78 });
const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(68, 0.14, 18), sidewalkMat);
sidewalk.position.set(0, -0.05, 5.2);
sidewalk.receiveShadow = true;
worldRoot.add(sidewalk);

const curbEdge = new THREE.Mesh(new THREE.BoxGeometry(68, 0.16, 0.28), curbMat);
curbEdge.position.set(0, -0.02, -3.85);
curbEdge.receiveShadow = true;
worldRoot.add(curbEdge);

// Cyan Street Water/Signal Trench & Standpipe at Curb
const cyanLineMat = new THREE.MeshStandardMaterial({
  color: '#18b4ff',
  emissive: '#18b4ff',
  emissiveIntensity: 1.35,
  roughness: 0.2,
});
const streetConduit = new THREE.Mesh(new THREE.BoxGeometry(44, 0.03, 0.11), cyanLineMat);
streetConduit.position.set(2, 0.025, -3.55);
worldRoot.add(streetConduit);

// Neighboring Flanking Terracotta/Ochre Masonry Context & Distant WEAVE Relay Dish Silhouette
function buildStreetContext() {
  const ctxGroup = new THREE.Group();
  const warmBrick = new THREE.MeshStandardMaterial({ color: '#9c523c', roughness: 0.84 });
  const ochreStone = new THREE.MeshStandardMaterial({ color: '#b88456', roughness: 0.76 });
  const slateTrim = new THREE.MeshStandardMaterial({ color: '#3b4654', roughness: 0.65 });
  const warmWin = new THREE.MeshStandardMaterial({ color: '#ffe4b5', emissive: '#ffae52', emissiveIntensity: 1.15 });

  // Left neighbor rowhouse mass (x: -23..-11.2)
  const leftBldg = new THREE.Mesh(new THREE.BoxGeometry(11.5, 11.2, 11.5), ochreStone);
  leftBldg.position.set(-16.8, 5.6, 5.8);
  leftBldg.castShadow = true;
  leftBldg.receiveShadow = true;
  ctxGroup.add(leftBldg);
  const leftCornice = new THREE.Mesh(new THREE.BoxGeometry(11.9, 0.45, 11.9), slateTrim);
  leftCornice.position.set(-16.8, 11.3, 5.8);
  ctxGroup.add(leftCornice);

  // Right neighbor warehouse mass (x: 11.2..24)
  const rightBldg = new THREE.Mesh(new THREE.BoxGeometry(12.4, 13.4, 11.8), warmBrick);
  rightBldg.position.set(17.4, 6.7, 6.0);
  rightBldg.castShadow = true;
  rightBldg.receiveShadow = true;
  ctxGroup.add(rightBldg);
  const rightCornice = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.5, 12.2), slateTrim);
  rightCornice.position.set(17.4, 13.5, 6.0);
  ctxGroup.add(rightCornice);

  for (const bx of [-19.5, -16.8, -14.1, 14.2, 17.4, 20.6]) {
    for (const by of [2.4, 5.8, 9.2]) {
      if (bx < 0 && by > 9) continue;
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.75, 0.12), warmWin);
      w.position.set(bx, by, -0.02);
      ctxGroup.add(w);
    }
  }

  // Grounded Curb Planter Trees (Brief 3: placed strictly in soil curb planters with clear sidewalk passage)
  const soilMat = new THREE.MeshStandardMaterial({ color: '#3b2d22', roughness: 0.95 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3728', roughness: 0.88 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3c6248', roughness: 0.82 });
  for (const tx of [-12.2, 12.4]) {
    const pit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 1.5), curbMat);
    pit.position.set(tx, 0.08, -2.7);
    ctxGroup.add(pit);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.26, 1.26), soilMat);
    soil.position.set(tx, 0.09, -2.7);
    ctxGroup.add(soil);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 3.2, 8), trunkMat);
    trunk.position.set(tx, 1.65, -2.7);
    trunk.castShadow = true;
    ctxGroup.add(trunk);
    for (const [ox, oy, oz, r] of [[0, 3.6, 0, 1.25], [-0.55, 3.2, 0.35, 0.92], [0.58, 3.3, -0.28, 0.95]]) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMat);
      crown.position.set(tx + ox, oy, -2.7 + oz);
      crown.castShadow = true;
      ctxGroup.add(crown);
    }
  }

  // Parked Delivery Cruiser at Usable Curb (Brief 3: tire contact at street y=-0.04, reason to stop: parcel delivery)
  const car = new THREE.Group();
  car.position.set(-6.4, -0.04, -5.35);
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#2b4560', roughness: 0.34, metalness: 0.45 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: '#d8cfc0', roughness: 0.42, metalness: 0.2 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#15181c', roughness: 0.85 });
  const headMat = new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffd280', emissiveIntensity: 2.0 });
  const tailMat = new THREE.MeshStandardMaterial({ color: '#ff4038', emissive: '#ff3028', emissiveIntensity: 1.6 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.78, 1.82), bodyMat);
  chassis.position.y = 0.68;
  chassis.castShadow = true;
  car.add(chassis);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.68, 1.64), cabinMat);
  cabin.position.set(-0.2, 1.38, 0);
  cabin.castShadow = true;
  car.add(cabin);
  for (const [wx, wz] of [[-1.35, -0.88], [1.35, -0.88], [-1.35, 0.88], [1.35, 0.88]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 16), tireMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    car.add(wheel);
  }
  const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.32), headMat);
  hlL.position.set(2.16, 0.72, -0.58);
  const hlR = hlL.clone();
  hlR.position.z = 0.58;
  const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.30), tailMat);
  tlL.position.set(-2.16, 0.74, -0.58);
  const tlR = tlL.clone();
  tlR.position.z = 0.58;
  car.add(hlL, hlR, tlL, tlR);
  ctxGroup.add(car);

  // Monumental WEAVE Relay Dish Silhouette on Distant Ridge / Sky Layer
  const dishGroup = new THREE.Group();
  dishGroup.position.set(8, 22, 54);
  const mastMat = new THREE.MeshStandardMaterial({ color: '#182c46', roughness: 0.7, metalness: 0.4 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.8, 26, 10), mastMat);
  mast.position.y = -8;
  dishGroup.add(mast);
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(9.5, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42),
    new THREE.MeshStandardMaterial({ color: '#244162', roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide })
  );
  dish.rotation.x = -Math.PI * 0.62;
  dishGroup.add(dish);
  const feed = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), cyanLineMat);
  feed.position.set(0, 2.2, -5.2);
  dishGroup.add(feed);
  ctxGroup.add(dishGroup);

  return ctxGroup;
}
const streetContext = buildStreetContext();
worldRoot.add(streetContext);

// Multiplane Cutout Guides & Foreground Elements (visible in Live Stage Set mode)
const stageOverlayGroup = new THREE.Group();
stageOverlayGroup.visible = false;
worldRoot.add(stageOverlayGroup);
{
  // Viewing cone indicator from source camera w1623-01-00
  const conePts = [
    new THREE.Vector3(-2.6, 1.65, -13.5),
    new THREE.Vector3(-11.5, 1.65, 0),
    new THREE.Vector3(-2.6, 1.65, -13.5),
    new THREE.Vector3(10.5, 1.65, 0),
  ];
  const coneGeo = new THREE.BufferGeometry().setFromPoints(conePts);
  const coneLine = new THREE.LineSegments(
    coneGeo,
    new THREE.LineBasicMaterial({ color: 0x18b4ff, transparent: true, opacity: 0.65 })
  );
  stageOverlayGroup.add(coneLine);

  // Foreground street lamp post providing crisp foreground occlusion & warm sodium source
  const postMat = new THREE.MeshStandardMaterial({ color: '#1b222a', roughness: 0.5, metalness: 0.7 });
  const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.4, 10), postMat);
  lampPost.position.set(3.8, 2.2, -3.55);
  lampPost.castShadow = true;
  stageOverlayGroup.add(lampPost);
  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffb85c', emissiveIntensity: 2.2 })
  );
  lantern.position.set(3.8, 4.45, -3.55);
  stageOverlayGroup.add(lantern);
}

// Inverse Tomology Camera Frustum Rays (visible in X-Ray mode)
const xrayFrustumGroup = new THREE.Group();
xrayFrustumGroup.visible = false;
worldRoot.add(xrayFrustumGroup);
{
  const invShots = FOUNDRY.inverse.shots.slice(0, 8);
  invShots.forEach((s, idx) => {
    const ang = ((idx / 8) * Math.PI * 0.85) - Math.PI * 0.42;
    const dist = 16 + (idx % 3) * 4;
    const ox = Math.sin(ang) * dist;
    const oz = -Math.cos(ang) * dist;
    const oy = 2.5 + (idx % 4) * 3.2;
    const tx = (idx - 3.5) * 1.8;
    const ty = 2.0 + (idx % 3) * 3.4;
    const tz = 3.5;
    const pts = [new THREE.Vector3(ox, oy, oz), new THREE.Vector3(tx, ty, tz)];
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: idx % 2 === 0 ? 0x18b4ff : 0xffb85c, transparent: true, opacity: 0.72 })
    );
    xrayFrustumGroup.add(line);
    const camNode = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({ color: idx % 2 === 0 ? 0x18b4ff : 0xffd260 })
    );
    camNode.position.set(ox, oy, oz);
    xrayFrustumGroup.add(camNode);
  });
}

// ---------------------------------------------------------------------------
// Persistent Anny V8 Cast & Parcel Ownership (Imani Courier, Bekele Keeper, Maren Witness)
// ---------------------------------------------------------------------------
const castGroup = new THREE.Group();
worldRoot.add(castGroup);

const parcelMesh = new THREE.Group();
{
  const wrapBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.22, 0.26),
    new THREE.MeshStandardMaterial({ color: '#c89b62', roughness: 0.72 })
  );
  const twine = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.04, 0.27),
    new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 0.8 })
  );
  parcelMesh.add(wrapBox, twine);
}
scene.add(parcelMesh);

const castActors = [];
function spawnAnnyActor({ id, name, archetype, x, y, z, rotY, coatHex, clip }) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = rotY;
  castGroup.add(root);

  // Instant clean proxy until GLB finishes streaming (~180ms)
  const proxy = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.25, 0.86, 10),
    new THREE.MeshStandardMaterial({ color: coatHex, roughness: 0.75 })
  );
  torso.position.y = 1.06;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#7b4c33', roughness: 0.65 })
  );
  head.position.y = 1.63;
  proxy.add(torso, head);
  root.add(proxy);

  const actor = { id, name, root, proxy, v8: null };
  castActors.push(actor);

  if (typeof window !== 'undefined' && window.AnnyHumanV7?.createCharacter) {
    window.AnnyHumanV7.createCharacter({
      THREE,
      loader: gltfLoader,
      archetype,
      assetBaseUrl: '../../abyssinian-highlands/human-forge/assets',
      clipsBaseUrl: '../../motion-pipeline/mesh2motion/clips',
      clothed: true,
      groundY: 0,
      preloadClips: ['idle', 'walk', 'idle-talking'],
      initialClip: clip || 'idle',
    })
      .then((inst) => {
        if (!inst) return;
        inst.root.position.set(0, 0, 0);
        root.add(inst.root);
        proxy.visible = false;
        actor.v8 = inst;
        inst.setGroundY(0);
      })
      .catch((err) => {
        console.warn('Anny V8 load error:', err);
      });
  }
  return actor;
}

const courierActor = spawnAnnyActor({
  id: 'player',
  name: 'Imani (Courier)',
  archetype: 'adult_f',
  x: -0.55,
  y: 0,
  z: -2.15,
  rotY: 0.18,
  coatHex: '#354457',
  clip: 'idle',
});
const keeperActor = spawnAnnyActor({
  id: 'bekele',
  name: 'Bekele (Severn Keeper)',
  archetype: 'adult_m',
  x: 0.35,
  y: 0,
  z: 1.25,
  rotY: Math.PI - 0.15,
  coatHex: '#8c5438',
  clip: 'idle',
});
const witnessActor = spawnAnnyActor({
  id: 'maren',
  name: 'Maren (Flat 2A Tenant)',
  archetype: 'elder',
  x: -6.8,
  y: 6.8,
  z: 1.1,
  rotY: Math.PI,
  coatHex: '#5c6b78',
  clip: 'idle',
});

// ---------------------------------------------------------------------------
// Co-Evolution State, 6-Generation Grid & Active Severn Build
// ---------------------------------------------------------------------------
const CALVINO_DEFS = [
  { key: 'thin', label: 'Thin', val: 0.66, desc: 'Carves sky/cyan lightwell through upper slabs' },
  { key: 'hidden', label: 'Hidden', val: 0.58, desc: 'Reveals L1 silver-gelatin darkroom & enlarger' },
  { key: 'continuous', label: 'Continuous', val: 0.62, desc: 'Widens vestibule & street-to-stair corridor' },
  { key: 'memory', label: 'Memory', val: 0.74, desc: 'Aligns Flat 2A desk to street window sightline' },
  { key: 'desire', label: 'Desire', val: 0.56, desc: 'Opens L3 chamber screening hall & roof beacon' },
  { key: 'signs', label: 'Signs', val: 0.68, desc: 'Sharpens shopfront identity & numbered flat doors' },
  { key: 'eyes', label: 'Eyes', val: 0.72, desc: 'Optimizes camera stand clearance & reverse angles' },
];

const axes = Object.fromEntries(CALVINO_DEFS.map((d) => [d.key, d.val]));
let currentSeed = Number(pilotInit.seed) || 2086;
let candidateHistory = [];
let activeCand = null;
let builtSevern = null;
let auraLights = [];

const severnAnchor = new THREE.Group();
worldRoot.add(severnAnchor);

// 6-Generation Evolution Grid Group (shown in 'grid' view mode)
const gridGroup = new THREE.Group();
gridGroup.visible = false;
scene.add(gridGroup);
let gridPickMeshes = [];
let gridCandidates = [];

function buildSixGenerationGrid() {
  while (gridGroup.children.length) gridGroup.remove(gridGroup.children[0]);
  gridPickMeshes = [];
  gridCandidates = [];

  // Tabletop base for the 6 co-evolved maquettes
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(42, 0.4, 28),
    new THREE.MeshStandardMaterial({ color: '#101d30', roughness: 0.65, metalness: 0.2 })
  );
  table.position.set(0, -0.25, 0);
  table.receiveShadow = true;
  gridGroup.add(table);

  const presets = [
    { name: 'Gen 0 · Baseline Severn', seed: 2080, parent: 'hdl-v1', ax: { thin: 0.30, hidden: 0.25, continuous: 0.50, memory: 0.50, desire: 0.35, signs: 0.50, eyes: 0.50 } },
    { name: 'Gen 1 · Thin Lightwell', seed: 2082, parent: 'Gen 0', ax: { thin: 0.82, hidden: 0.30, continuous: 0.55, memory: 0.58, desire: 0.40, signs: 0.56, eyes: 0.62 } },
    { name: 'Gen 2 · Hidden Darkroom', seed: 2083, parent: 'Gen 1', ax: { thin: 0.72, hidden: 0.84, continuous: 0.58, memory: 0.64, desire: 0.44, signs: 0.62, eyes: 0.66 } },
    { name: 'Gen 3 · Continuous Spine', seed: 2084, parent: 'Gen 2', ax: { thin: 0.68, hidden: 0.72, continuous: 0.88, memory: 0.70, desire: 0.52, signs: 0.70, eyes: 0.70 } },
    { name: 'Gen 4 · Chamber Screening', seed: 2085, parent: 'Gen 3', ax: { thin: 0.74, hidden: 0.76, continuous: 0.78, memory: 0.76, desire: 0.86, signs: 0.74, eyes: 0.80 } },
    { name: 'Gen 5 · Active Co-Evolved', seed: currentSeed, parent: 'Gen 4', ax: { ...axes } },
  ];

  presets.forEach((p, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const gx = (col - 1) * 12.5;
    const gz = (row - 0.5) * 11.5;

    const cand = mutateSevernCandidate(SEVERN_BUNDLE.hero, p.ax, p.seed, idx, p.parent);
    gridCandidates.push(cand);

    const holder = new THREE.Group();
    holder.position.set(gx, 0, gz);
    const sc = 0.36;
    holder.scale.setScalar(sc);

    const b = build(cand.H, { doorOpen: true });
    b.group.position.set(-10, 0, -6);
    b.mass.position.set(-10, 0, -6);
    // Cut top roof off slightly and show glowing interior tomology volumes inside shell!
    b.roof.visible = false;
    b.levels.forEach((lg, lk) => {
      if (lk >= 3) lg.visible = false;
    });
    b.mass.visible = true;
    holder.add(b.group, b.mass);

    // Plinth & cyan selection border
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(23, 0.7, 15),
      new THREE.MeshStandardMaterial({
        color: idx === 5 ? '#18689c' : '#1d2d44',
        emissive: idx === 5 ? '#18b4ff' : '#000000',
        emissiveIntensity: idx === 5 ? 0.45 : 0,
        roughness: 0.5,
      })
    );
    plinth.position.set(0, -0.4, 0);
    plinth.userData.candIdx = idx;
    holder.add(plinth);
    gridPickMeshes.push(plinth);
    gridGroup.add(holder);
  });
}

let doorOpen = pilotInit.doorOpen !== false;
let parcelHolder = pilotInit.parcelHolder || 'player';
let viewMode = 'walk'; // 'walk' | 'xray' | 'grid' | 'stage'
let reverseAngle = false;
let inspectLevel = 0;

function syncAuraLights() {
  auraLights.forEach((l) => scene.remove(l));
  auraLights = [];
  if (!builtSevern) return;

  const ox = builtSevern.group.position.x;
  const oz = builtSevern.group.position.z;

  // Warm vestibule lamp spilling across pavement when door is open!
  const lobbySpill = new THREE.PointLight(0xffc882, doorOpen ? 22 : 6, 14, 1.5);
  lobbySpill.position.set(0, 2.85, 1.8);
  scene.add(lobbySpill);
  auraLights.push(lobbySpill);

  // Fixture-bound lights from compiler (Severn crimson sign, cyan laundry transom, cyan conduit relays)
  for (const fx of builtSevern.fixtures) {
    if (!fx.color) continue;
    const pl = new THREE.PointLight(fx.color, fx.intensity || 8, fx.dist || 10, 1.6);
    pl.position.set(fx.pos[0] + ox, fx.pos[1], fx.pos[2] + oz);
    scene.add(pl);
    auraLights.push(pl);
  }
}

function rebuildActiveCandidate(recordHistory = true) {
  const parentId = activeCand ? activeCand.id : 'severn-hdl-v1';
  const genIdx = candidateHistory.length;
  const next = mutateSevernCandidate(SEVERN_BUNDLE.hero, axes, currentSeed, genIdx, parentId);
  if (recordHistory && activeCand) candidateHistory.push(activeCand);
  activeCand = next;

  if (builtSevern) {
    severnAnchor.remove(builtSevern.group);
    severnAnchor.remove(builtSevern.mass);
  }
  builtSevern = build(activeCand.H, { doorOpen });
  const [W] = activeCand.H.footprint;
  builtSevern.group.position.set(-W / 2, 0, 0);
  builtSevern.mass.position.set(-W / 2, 0, 0);
  severnAnchor.add(builtSevern.group);
  severnAnchor.add(builtSevern.mass);

  applyViewModeVisuals();
  syncAuraLights();
  updateLineageUI();
  drawPlanCanvas();
  if (viewMode === 'grid') buildSixGenerationGrid();
}

// ---------------------------------------------------------------------------
// Player Walk State & Camera Modes
// ---------------------------------------------------------------------------
const player = {
  // HDL local coords: x in [0..20] (worldX = x - 10), y in [-16..14] (worldZ = y), z up (worldY = z)
  x: 10.0,
  y: -14.2,
  z: 0.0,
  yaw: Math.PI, // facing +Z (toward Severn front at z=0)
  pitch: 0.14,
  isInside: false,
};

const ROOM_JUMPS = {
  street: { x: 10.0, y: -14.2, z: 0.0, yaw: Math.PI, pitch: 0.14, lv: 0 },
  vestibule: { x: 10.0, y: 2.2, z: 0.0, yaw: Math.PI, pitch: 0.0, lv: 0 },
  'flat-2a': { x: 4.5, y: 2.5, z: 6.8, yaw: 0.0, pitch: -0.06, lv: 2 }, // inside Flat 2A looking OUT facade window to street!
  darkroom: { x: 4.0, y: 9.2, z: 3.6, yaw: Math.PI, pitch: -0.04, lv: 1 },
  screening: { x: 4.0, y: 8.4, z: 10.0, yaw: Math.PI, pitch: 0.02, lv: 3 },
  roof: { x: 10.0, y: 4.0, z: 16.4, yaw: 0.15, pitch: -0.18, lv: 4 },
};

function jumpToRoom(key) {
  const j = ROOM_JUMPS[key] || ROOM_JUMPS.street;
  player.x = j.x;
  player.y = j.y;
  player.z = j.z;
  player.yaw = j.yaw;
  player.pitch = j.pitch;
  inspectLevel = j.lv;
  document.querySelectorAll('#room-jumps .pill').forEach((b) => b.classList.toggle('active', b.dataset.jump === key));
  document.querySelectorAll('#level-pills .pill').forEach((b) => b.classList.toggle('active', +b.dataset.lv === inspectLevel));
  if (viewMode !== 'walk') setViewMode('walk');
  savePilotState({ room: key, building: 'severn' });
  drawPlanCanvas();
}

function applyViewModeVisuals() {
  if (!builtSevern) return;
  const isXray = viewMode === 'xray';
  const isGrid = viewMode === 'grid';
  const isStage = viewMode === 'stage';

  worldRoot.visible = !isGrid;
  gridGroup.visible = isGrid;
  xrayFrustumGroup.visible = isXray;
  stageOverlayGroup.visible = isStage;
  $('stage-triple').classList.toggle('visible', isStage);

  builtSevern.mass.visible = isXray;
  builtSevern.roof.visible = !isXray;
  builtSevern.levels.forEach((lg) => {
    lg.visible = true;
    lg.traverse((o) => {
      if (o.userData.wall) {
        o.visible = !(isXray && o.userData.wall.ext && o.userData.wall.side === 'front');
      }
      if (o.userData.ceiling) {
        o.visible = !isXray;
      }
    });
  });

  if (isXray) {
    orbit.enabled = true;
    camera.fov = 44;
    camera.updateProjectionMatrix();
    camera.position.set(16.5, 17.5, -21.0);
    orbit.target.set(0, 7.2, 5.5);
    orbit.update();
    $('mode-subtitle').textContent = 'Inverse Tomology X-Ray: carved interior volumes, cyan lightwell & inverse camera frustums.';
  } else if (isGrid) {
    buildSixGenerationGrid();
    orbit.enabled = true;
    camera.fov = 42;
    camera.updateProjectionMatrix();
    camera.position.set(0, 22.5, -27.5);
    orbit.target.set(0, 1.5, 0.5);
    orbit.update();
    $('mode-subtitle').textContent = 'Foundry 6-Generation Co-Evolution Grid: click any maquette plinth to promote its genome.';
  } else if (isStage) {
    orbit.enabled = false;
    applyStageCamera();
    $('mode-subtitle').textContent = 'Inhabited Shot w1623-01-00: hand parcel across threshold (H) & verify reverse angle (R).';
  } else {
    orbit.enabled = false;
    camera.fov = 48;
    camera.updateProjectionMatrix();
    $('mode-subtitle').textContent = 'Walk exterior street & co-evolved Severn rooms; toggle door (E) for route & sound muffling.';
  }
}

function applyStageCamera() {
  if (!reverseAngle) {
    // Forward Arrival Shot (w1623-01-00 street perspective framing courier, doorway, cruiser & Severn facade)
    camera.fov = 40;
    camera.updateProjectionMatrix();
    camera.position.set(-3.2, 1.72, -10.8);
    camera.lookAt(0.2, 2.35, 1.5);
  } else {
    // Reverse Over-the-Shoulder Threshold Shot from inside Vestibule looking out to Courier & Cruiser!
    camera.fov = 44;
    camera.updateProjectionMatrix();
    camera.position.set(1.15, 1.72, 3.35);
    camera.lookAt(-0.65, 1.45, -3.2);
  }
}

function setViewMode(m) {
  viewMode = m;
  document.querySelectorAll('#view-modes .pill').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  applyViewModeVisuals();
}

// ---------------------------------------------------------------------------
// Mount Universal 23-Look GPU Shader Suite + Door-Coupled Freesound Audio
// ---------------------------------------------------------------------------
let currentNightMix = 0.72;
const suite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: pilotInit.shader || 'weave',
  locationName: 'The Severn · Foundry & Inverse Tomology',
  cartridgeName: 'foundry',
  onTimeChange: (key, preset) => {
    currentNightMix = preset.audioNightMix;
    paintSkyDome(preset.skyTop, preset.skyMid, preset.skyHorizon);
    skyTex.needsUpdate = true;
    scene.fog.color.set(preset.skyMid);
    scene.fog.density = preset.fogDensity;
    sunLight.intensity = preset.sunIntensity;
    sunLight.color.set(preset.sunColor);
    hemiLight.intensity = preset.hemiIntensity;
  },
});

// ---------------------------------------------------------------------------
// UI Wiring: Calvino Axes, Lineage, 2D Plan/Section Canvas, Door & Parcel Sync
// ---------------------------------------------------------------------------
function renderCalvinoSliders() {
  const host = $('calvino-sliders');
  host.innerHTML = CALVINO_DEFS.map(
    (d) => `<div class="axis-row" title="${d.desc}">
      <label for="ax-${d.key}">${d.label}</label>
      <input id="ax-${d.key}" type="range" min="0.1" max="0.95" step="0.02" value="${axes[d.key]}" data-key="${d.key}">
      <span class="axis-val" id="axv-${d.key}">${Math.round(axes[d.key] * 100)}%</span>
    </div>`
  ).join('');
  host.querySelectorAll('input[type="range"]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const k = inp.dataset.key;
      axes[k] = parseFloat(inp.value);
      $(`axv-${k}`).textContent = `${Math.round(axes[k] * 100)}%`;
      rebuildActiveCandidate(false);
    });
  });
}
renderCalvinoSliders();

function updateLineageUI() {
  if (!activeCand) return;
  const m = activeCand.metrics;
  $('lineage-readout').innerHTML = `
    <div><b>${activeCand.id}</b> · seed <b>${activeCand.seed}</b> · parent <span>${activeCand.parent}</span></div>
    <div style="margin-top:3px;color:var(--paper);">${activeCand.mutationText}</div>
    <div style="margin-top:4px;color:var(--muted);">Poems <b>${Math.round(m.poemsScore * 100)}%</b> · Builder <b>${Math.round(m.builderScore * 100)}%</b> · Tomology <b>${Math.round(m.tomologyScore * 100)}%</b></div>
  `;
  const passCount = activeCand.proofs.filter((p) => p.state === 'PASS').length;
  const warnCount = activeCand.proofs.filter((p) => p.state === 'WARN').length;
  $('proof-summary').textContent = `Prototype & Clearance Gate: ${passCount} PASS, ${warnCount} WARN, ${m.fails} FAIL · Hallway ${m.hallwayDepthM}m`;
}

function updatePilotHUD() {
  $('btn-door').textContent = `Door: ${doorOpen ? 'Open' : 'Closed'} (E)`;
  $('btn-door').classList.toggle('cyan-act', doorOpen);
  $('btn-parcel').textContent =
    parcelHolder === 'player' ? 'Hand Parcel to Bekele (H)' : 'Reclaim Parcel from Bekele (H)';
  $('btn-reverse-cam').textContent = `Angle: ${reverseAngle ? 'Reverse Lobby' : 'Forward Street'} (R)`;

  const cutoffStr = player.isInside ? (doorOpen ? '1.8 kHz Bleed' : '580 Hz Muffled') : '13.5 kHz Open Air';
  $('space-status').textContent = `${player.isInside ? 'INSIDE SEVERN' : 'EXTERIOR STREET'} · ${cutoffStr}`;

  $('pilot-kv').innerHTML = `
    <div class="kv-row"><span>Envelope</span><b>20.0 x 12.0 m (5 Storeys)</b></div>
    <div class="kv-row"><span>Threshold Door</span><b style="color:${doorOpen ? 'var(--ok)' : 'var(--warn)'}">${doorOpen ? 'OPEN (Passable)' : 'CLOSED (Blocked + Muffled)'}</b></div>
    <div class="kv-row"><span>Parcel Holder</span><b style="color:var(--cyan)">${parcelHolder === 'player' ? 'Imani (Courier)' : 'Bekele (Keeper)'}</b></div>
    <div class="kv-row"><span>Player Pos</span><b>(${(player.x - 10).toFixed(1)}, ${player.z.toFixed(1)}, ${player.y.toFixed(1)}m)</b></div>
  `;
}

function drawPlanCanvas() {
  const cv = $('plan-canvas');
  if (!cv || !activeCand) return;
  const ctx = cv.getContext('2d');
  const W = cv.width;
  const H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#07111f';
  ctx.fillRect(0, 0, W, H);

  // Left half: 2D Floor Plan of inspectLevel (20 x 12 m)
  const px0 = 12;
  const py0 = 24;
  const sc = 7.4;
  ctx.fillStyle = '#9bb8d4';
  ctx.font = '600 9.5px Inter, sans-serif';
  ctx.fillText(`PLAN L${inspectLevel} (${activeCand.H.levels[inspectLevel]?.name || ''})`, px0, 15);

  const lvRooms = activeCand.H.levels[inspectLevel]?.rooms || [];
  for (const r of lvRooms) {
    const rx = px0 + r.x * sc;
    const ry = py0 + (12 - r.y - r.d) * sc;
    const rw = r.w * sc;
    const rd = r.d * sc;
    ctx.fillStyle =
      r.use === 'lightwell'
        ? 'rgba(24,180,255,0.34)'
        : r.tomologyRole === 'darkroom'
          ? 'rgba(217,56,56,0.28)'
          : r.tomologyRole === 'screening'
            ? 'rgba(24,180,255,0.22)'
            : r.use === 'stair'
              ? 'rgba(212,178,118,0.26)'
              : 'rgba(242,237,226,0.10)';
    ctx.fillRect(rx, ry, rw, rd);
    ctx.strokeStyle = r.use === 'lightwell' ? '#18b4ff' : 'rgba(242,237,226,0.45)';
    ctx.strokeRect(rx, ry, rw, rd);
    ctx.fillStyle = '#f2ede2';
    ctx.font = '8.5px Inter, sans-serif';
    ctx.fillText(r.id.toUpperCase(), rx + 3, ry + 10);
  }
  // Threshold door state marker on L0
  const doorX = px0 + 10 * sc;
  const doorY = py0 + 12 * sc;
  ctx.strokeStyle = doorOpen ? '#7fe0a0' : '#ff6a5a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(doorX - 8, doorY);
  ctx.lineTo(doorX + 8, doorOpen ? doorY - 7 : doorY);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Player dot on plan
  const plX = px0 + Math.max(-1, Math.min(21, player.x)) * sc;
  const plY = py0 + (12 - Math.max(-4, Math.min(13, player.y))) * sc;
  ctx.fillStyle = '#18b4ff';
  ctx.beginPath();
  ctx.arc(plX, Math.min(H - 6, plY), 3.6, 0, Math.PI * 2);
  ctx.fill();

  // Right half: Architectural Section (5 Storeys + Lightwell + Player Elevation)
  const sx0 = 182;
  const syBase = 142;
  const sScX = 6.0;
  const sScZ = 6.4;
  ctx.fillStyle = '#9bb8d4';
  ctx.font = '600 9.5px Inter, sans-serif';
  ctx.fillText('SECTION + CYAN WELL', sx0, 15);

  activeCand.H.levels.forEach((lv, k) => {
    const yTop = syBase - (lv.z + lv.h) * sScZ;
    const hPx = lv.h * sScZ;
    ctx.fillStyle = k === inspectLevel ? 'rgba(212,178,118,0.18)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(sx0, yTop, 20 * sScX, hPx);
    ctx.strokeStyle = 'rgba(242,237,226,0.35)';
    ctx.strokeRect(sx0, yTop, 20 * sScX, hPx);
    const well = lv.rooms.find((r) => r.use === 'lightwell');
    if (well) {
      ctx.fillStyle = 'rgba(24,180,255,0.32)';
      ctx.fillRect(sx0 + well.x * sScX, yTop, well.w * sScX, hPx);
    }
  });
  // Player elevation marker
  const pySec = syBase - (player.z + 1.0) * sScZ;
  ctx.fillStyle = '#18b4ff';
  ctx.beginPath();
  ctx.arc(sx0 + Math.max(0, Math.min(20, player.x)) * sScX, pySec, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function toggleDoor() {
  doorOpen = !doorOpen;
  setThresholdDoor(builtSevern, doorOpen);
  syncAuraLights();
  savePilotState({ doorOpen });
  updatePilotHUD();
  drawPlanCanvas();
}

function toggleParcel() {
  parcelHolder = parcelHolder === 'player' ? 'bekele' : 'player';
  savePilotState({ parcelHolder });
  if (parcelHolder === 'bekele') {
    suite.speakLine('Bekele', 'Parcel received at the Severn threshold. Flat 2A is open upstairs.', 0.94);
  } else {
    suite.speakLine('Imani', 'Parcel back in courier satchel for street dispatch.', 1.04);
  }
  updatePilotHUD();
}

// Subscribe to external pilot-state updates (e.g. from Suite Bar or other tabs)
subscribePilotState((next) => {
  if (typeof next.doorOpen === 'boolean' && next.doorOpen !== doorOpen) {
    doorOpen = next.doorOpen;
    setThresholdDoor(builtSevern, doorOpen);
    syncAuraLights();
  }
  if (next.parcelHolder && next.parcelHolder !== parcelHolder) {
    parcelHolder = next.parcelHolder;
  }
  updatePilotHUD();
  drawPlanCanvas();
});

// Wire DOM Buttons
document.querySelectorAll('#view-modes .pill').forEach((b) => {
  b.addEventListener('click', () => setViewMode(b.dataset.mode));
});
document.querySelectorAll('#room-jumps .pill').forEach((b) => {
  b.addEventListener('click', () => jumpToRoom(b.dataset.jump));
});
document.querySelectorAll('#level-pills .pill').forEach((b) => {
  b.addEventListener('click', () => {
    inspectLevel = +b.dataset.lv;
    document.querySelectorAll('#level-pills .pill').forEach((x) => x.classList.toggle('active', x === b));
    drawPlanCanvas();
  });
});

$('btn-mutate').addEventListener('click', () => {
  currentSeed += 7;
  CALVINO_DEFS.forEach((d, idx) => {
    const delta = (Math.sin(currentSeed * 0.37 + idx * 2.1) * 0.16);
    axes[d.key] = Math.max(0.15, Math.min(0.94, Number((axes[d.key] + delta).toFixed(2))));
    const inp = $(`ax-${d.key}`);
    if (inp) inp.value = axes[d.key];
    const lbl = $(`axv-${d.key}`);
    if (lbl) lbl.textContent = `${Math.round(axes[d.key] * 100)}%`;
  });
  savePilotState({ seed: currentSeed });
  rebuildActiveCandidate(true);
});

$('btn-revert').addEventListener('click', () => {
  if (!candidateHistory.length) return;
  const prev = candidateHistory.pop();
  Object.assign(axes, prev.axes);
  currentSeed = prev.seed;
  renderCalvinoSliders();
  rebuildActiveCandidate(false);
});

$('btn-door').addEventListener('click', toggleDoor);
$('btn-parcel').addEventListener('click', toggleParcel);
$('btn-reverse-cam').addEventListener('click', () => {
  reverseAngle = !reverseAngle;
  if (viewMode !== 'stage') setViewMode('stage');
  else applyStageCamera();
  updatePilotHUD();
});

$('toggle-left').addEventListener('click', () => {
  $('left-drawer').classList.toggle('collapsed');
  $('toggle-left').textContent = $('left-drawer').classList.contains('collapsed') ? 'Open' : 'Fold';
});
$('toggle-right').addEventListener('click', () => {
  $('right-drawer').classList.toggle('collapsed');
  $('toggle-right').textContent = $('right-drawer').classList.contains('collapsed') ? 'Open' : 'Fold';
});

// ---------------------------------------------------------------------------
// 72-World Archive, Niche Matrix, Scatter & Reference Classifier Modal (Brief 2)
// ---------------------------------------------------------------------------
let refFilterClass = 'all';
let refFilterPoem = '';

function classifyShotRef(s) {
  const txt = `${s.line || ''} ${s.subject || ''} ${s.kind || ''}`.toLowerCase();
  if (/body|face|hand|shoulder|close/.test(txt)) return 'body';
  if (/door|gate|threshold|stairs|stoop|window/.test(txt)) return 'threshold';
  if (/room|hall|bed|table|inside|flat/.test(txt)) return 'interior';
  if (/lamp|phone|machine|book|clock|car/.test(txt)) return 'object';
  return 'exterior';
}

const classifiedPool = FOUNDRY.shots.map((s, idx) => ({
  ...s,
  refClass: classifyShotRef(s),
  prov: idx % 4 === 0 ? 'recorded' : idx % 4 === 1 ? 'checked' : idx % 4 === 2 ? 'inferred' : 'invented',
}));

function buildArchiveModal() {
  $('archive-stats-line').textContent = `${FOUNDRY.n_worlds} Worlds Grown (${FOUNDRY.gens} Gens) · ${ Object.keys(FOUNDRY.worlds).length } Kept Elites · ${FOUNDRY.sets.length} Shot Sets`;

  const [bx, by] = FOUNDRY.bins;
  const ng = $('niche-grid');
  ng.style.gridTemplateColumns = `repeat(${bx}, 1fr)`;
  ng.innerHTML = '';
  const allWorlds = Object.values(FOUNDRY.worlds);
  for (let y = 0; y < by; y++) {
    for (let x = 0; x < bx; x++) {
      const key = `${x},${y}`;
      const w = allWorlds.filter((v) => v.cell === key).sort((a, b) => b.q - a.q)[0];
      const cell = document.createElement('div');
      cell.className = 'niche-cell ' + (w ? 'filled' : 'empty');
      if (w) {
        cell.innerHTML = `<b style="color:var(--paper)">${w.id}</b><span style="color:var(--cyan)">${Math.round(w.q * 100)}%</span>`;
        cell.addEventListener('click', () => inspectArchiveWorld(w.id));
      } else {
        cell.textContent = key;
      }
      ng.appendChild(cell);
    }
  }

  // Scatter plot
  const scv = $('scatter-canvas');
  const sctx = scv.getContext('2d');
  sctx.fillStyle = '#07111e';
  sctx.fillRect(0, 0, scv.width, scv.height);
  for (const pt of FOUNDRY.scatter) {
    const px = 16 + ((pt.organic - 0.35) / 0.65) * (scv.width - 32);
    const py = 14 + Math.min(1, pt.water / 0.6) * (scv.height - 28);
    sctx.fillStyle = pt.kept ? '#18b4ff' : 'rgba(212,178,118,0.45)';
    sctx.beginPath();
    sctx.arc(px, py, pt.kept ? 3.5 : 2.2, 0, Math.PI * 2);
    sctx.fill();
  }
  scv.onclick = (e) => {
    const r = scv.getBoundingClientRect();
    const mx = ((e.clientX - r.left) * scv.width) / r.width;
    const my = ((e.clientY - r.top) * scv.height) / r.height;
    let best = null;
    let bd = 22;
    for (const pt of FOUNDRY.scatter) {
      if (!pt.kept) continue;
      const px = 16 + ((pt.organic - 0.35) / 0.65) * (scv.width - 32);
      const py = 14 + Math.min(1, pt.water / 0.6) * (scv.height - 28);
      const d = Math.hypot(px - mx, py - my);
      if (d < bd) {
        bd = d;
        best = pt.id;
      }
    }
    if (best) inspectArchiveWorld(best);
  };

  const poems = Object.keys(FOUNDRY.poems).sort();
  $('poem-filter-pills').innerHTML =
    `<button class="pill ${!refFilterPoem ? 'active' : ''}" data-pf="">All Poems</button>` +
    poems.slice(0, 8).map((p) => `<button class="pill ${refFilterPoem === p ? 'active' : ''}" data-pf="${p}">${p} ${FOUNDRY.poems[p].title}</button>`).join('');
  $('poem-filter-pills').querySelectorAll('.pill').forEach((b) => {
    b.onclick = () => {
      refFilterPoem = b.dataset.pf;
      $('poem-filter-pills').querySelectorAll('.pill').forEach((x) => x.classList.toggle('active', x === b));
      renderClassifiedRefs();
    };
  });

  inspectArchiveWorld(allWorlds.sort((a, b) => b.q - a.q)[0]?.id);
  renderClassifiedRefs();
}

function inspectArchiveWorld(id) {
  const w = FOUNDRY.worlds[id];
  if (!w) return;
  $('world-inspector').innerHTML = `
    <div><b>World ${w.id}</b> · Gen ${w.gen} · Niche ${w.cell} · Layout <b>${w.g.layout}</b> · ${w.d.street_km} km streets</div>
    <div style="margin-top:3px;">Combined <b>${Math.round(w.q * 100)}%</b> · Poems <b>${Math.round(w.r.score * 100)}%</b> · Builder <b>${Math.round((w.b?.score || 0) * 100)}%</b></div>
    <div style="margin-top:4px;color:var(--muted);">${(w.recipe || []).slice(0, 3).join(' · ')}</div>
  `;
}

function renderClassifiedRefs() {
  const list = classifiedPool.filter(
    (r) => (refFilterClass === 'all' || r.refClass === refFilterClass) && (!refFilterPoem || r.poem === refFilterPoem)
  );
  $('classified-refs').innerHTML = list
    .slice(0, 18)
    .map(
      (r) => `<div class="ref-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <b style="color:var(--brass)">${r.id} · ${r.mm}mm</b>
          <span class="prov-badge prov-${r.prov}">${r.refClass} · ${r.prov}</span>
        </div>
        <div style="color:var(--paper);font-style:italic;">"${(r.line || '').slice(0, 88)}"</div>
        <div style="margin-top:4px;color:var(--muted);font-size:10px;">Light: ${r.light} · Cam z=${Math.round(r.cam?.z || 2)}m, hd=${Math.round(r.cam?.hd || 0)} deg</div>
      </div>`
    )
    .join('');
}

$('btn-open-archive').addEventListener('click', () => {
  $('archive-modal').classList.add('open');
  buildArchiveModal();
});
$('btn-close-archive').addEventListener('click', () => $('archive-modal').classList.remove('open'));
document.querySelectorAll('[data-rclass]').forEach((b) => {
  b.addEventListener('click', () => {
    refFilterClass = b.dataset.rclass;
    document.querySelectorAll('[data-rclass]').forEach((x) => x.classList.toggle('active', x === b));
    renderClassifiedRefs();
  });
});

// ---------------------------------------------------------------------------
// Input Controls: WASD Walk, Pointer Drag Look & Raycast Maquette Selection
// ---------------------------------------------------------------------------
const keys = {};
let drag = null;
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();

window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === '1') setViewMode('walk');
  else if (k === '2') setViewMode('xray');
  else if (k === '3') setViewMode('grid');
  else if (k === '4') setViewMode('stage');
  else if (k === 'e') toggleDoor();
  else if (k === 'h') toggleParcel();
  else if (k === 'r') $('btn-reverse-cam').click();
  else if (k === 'm') $('btn-mutate').click();
  else if (k === 'b') $('archive-modal').classList.toggle('open');
  else if (e.key === 'Escape') $('archive-modal').classList.remove('open');
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, moved: false };
});
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 3) drag.moved = true;
  if (viewMode === 'walk') {
    player.yaw -= dx * 0.0042;
    player.pitch = Math.max(-1.15, Math.min(1.15, player.pitch - dy * 0.0042));
  }
  drag.x = e.clientX;
  drag.y = e.clientY;
});
window.addEventListener('pointerup', (e) => {
  if (drag && !drag.moved && viewMode === 'grid' && gridPickMeshes.length) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(gridPickMeshes, false);
    if (hits.length) {
      const idx = hits[0].object.userData.candIdx;
      const chosen = gridCandidates[idx];
      if (chosen) {
        Object.assign(axes, chosen.axes);
        currentSeed = chosen.seed;
        renderCalvinoSliders();
        rebuildActiveCandidate(true);
        setViewMode('walk');
      }
    }
  }
  drag = null;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize Candidate & Scene (jump to specific room only if explicitly requested in URL)
rebuildActiveCandidate(false);
const explicitUrlRoom = new URLSearchParams(window.location.search).get('room') || (window.location.hash.includes('room=') ? pilotInit.room : null);
if (explicitUrlRoom && ROOM_JUMPS[explicitUrlRoom]) {
  jumpToRoom(explicitUrlRoom);
} else {
  updatePilotHUD();
}

// ---------------------------------------------------------------------------
// Main Animation Loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now() * 0.001;

  let moving = false;
  if (viewMode === 'walk' && builtSevern) {
    const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    const s = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    if (f !== 0 || s !== 0) {
      moving = true;
      const sp = (keys.shift ? 5.2 : 2.8) * dt;
      const fx = -Math.sin(player.yaw);
      const fy = -Math.cos(player.yaw);
      const dx = (fx * f + Math.cos(player.yaw) * s) * sp;
      const dy = (fy * f - Math.sin(player.yaw) * s) * sp;
      if (!isBlocked(builtSevern, player.x, player.y, player.x + dx, player.y, player.z)) player.x += dx;
      if (!isBlocked(builtSevern, player.x, player.y, player.x, player.y + dy, player.z)) player.y += dy;
      drawPlanCanvas();
    }
    const fz = floorAt(builtSevern, player.x, player.y, player.z);
    player.z += (fz - player.z) * Math.min(1, dt * (fz < player.z ? 7 : 14));
    const wasInside = player.isInside;
    player.isInside = player.x >= 0 && player.x <= 20 && player.y >= 0 && player.y <= 12;
    if (wasInside !== player.isInside || moving) updatePilotHUD();

    camera.position.set(player.x - 10, player.z + 1.65, player.y);
    camera.rotation.set(player.pitch, player.yaw, 0);
  } else if (orbit.enabled) {
    orbit.update();
  }

  // Update Anny V8 cast animations & parcel attachment
  for (const act of castActors) {
    if (act.v8?.update) act.v8.update(dt);
  }
  const holderActor = parcelHolder === 'bekele' ? keeperActor : courierActor;
  parcelMesh.visible = viewMode !== 'grid';
  parcelMesh.position.set(
    holderActor.root.position.x + Math.sin(holderActor.root.rotation.y) * 0.34,
    holderActor.root.position.y + 1.05 + Math.sin(now * 2.2) * 0.015,
    holderActor.root.position.z + Math.cos(holderActor.root.rotation.y) * 0.34
  );
  parcelMesh.rotation.y = holderActor.root.rotation.y;

  // Update door-coupled spatial audio (muffled inside when door closed!)
  suite.updateAudio(dt, {
    isInside: player.isInside && !doorOpen,
    nightMix: currentNightMix,
    submerged: false,
    moving,
    projectorDist: Math.hypot(player.x - 4.0, player.y - 7.8, player.z - 10.0),
    projectorWet: false,
  });

  suite.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.__foundry = {
  setViewMode,
  jumpToRoom,
  toggleDoor,
  toggleParcel,
  get activeCand() {
    return activeCand;
  },
  suite,
};
