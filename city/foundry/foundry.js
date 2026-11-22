// Foundry, Calvino Evolution & Inverse Tomology (100% Pure Diegetic In-World UI)
// Every control lives physically inside the 3D street and Severn building:
// - 3D Walnut & Brass Architectural Maquette Table on the sidewalk (6 evolving miniature Severns + Mutate Handwheel + Archive Folio)
// - 3D Glass X-Ray Prism on brass curb stand (peels back Severn facade into translucent Inverse-Tomology X-Ray + sightlines)
// - 3D Operable Severn Door (580 Hz acoustic muffling + make_photo_pilot_v1 sync), Stairs, Windows & Rooms
// - 3D Clothed Anny V8 Cast (Imani & Bekele parcel handoff + Maren in Flat 2A)
// - 3D 8x10 Brass Camera Tripod (forward/reverse angle lever, 23 GPU shaders, 8x10 plate exposure) & Stone Portals

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  mountWebGLShaderSuite,
  createWorldPortalAndTripod,
  projectWorldLabel,
  loadPilotState,
  savePilotState,
  subscribePilotState,
  applyPilotUrlHash,
} from '../shader-suite-bar.js';
import {
  useLibrary,
  build,
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
  rebuildMaquetteTableModels();
});

// ---------------------------------------------------------------------------
// Renderer, Sky Dome, Wet Street & Neighboring Context
// ---------------------------------------------------------------------------
const wrap = $('canvas-wrap');
const whisperEl = $('world-whisper');
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
scene.fog = new THREE.FogExp2('#132c4a', 0.0065);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.12, 320);
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

const hemiLight = new THREE.HemisphereLight('#c8e0f8', '#524034', 1.35);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#ffdcb8', 2.48);
sunLight.position.set(-28, 42, -32);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 2, far: 140 });
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// Procedural Wet Asphalt & Dry Granite Sidewalk
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

const hitInvisibleMat = new THREE.MeshBasicMaterial({ visible: false });
const interactiveTargets = [];
function registerTarget(mesh, data) {
  mesh.userData.foundryTarget = data;
  interactiveTargets.push(mesh);
  return mesh;
}

const streetTex = createStreetTextures();
const wetAsphalt = new THREE.Mesh(
  new THREE.PlaneGeometry(180, 180),
  new THREE.MeshStandardMaterial({
    map: streetTex.map,
    roughnessMap: streetTex.roughnessMap,
    roughness: 0.34,
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
const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(68, 0.14, 22.4), sidewalkMat);
sidewalk.position.set(0, -0.05, 3.0);
sidewalk.receiveShadow = true;
worldRoot.add(sidewalk);

const curbEdge = new THREE.Mesh(new THREE.BoxGeometry(68, 0.16, 0.28), curbMat);
curbEdge.position.set(0, -0.02, -8.25);
curbEdge.receiveShadow = true;
worldRoot.add(curbEdge);

// Cyan Street Water/Signal Trench at Curb
const cyanLineMat = new THREE.MeshStandardMaterial({
  color: '#18b4ff',
  emissive: '#18b4ff',
  emissiveIntensity: 1.35,
  roughness: 0.2,
});
const streetConduit = new THREE.Mesh(new THREE.BoxGeometry(48, 0.03, 0.11), cyanLineMat);
streetConduit.position.set(0, 0.025, -7.9);
worldRoot.add(streetConduit);

// Neighboring Flanking Terracotta/Ochre Masonry Context & Distant WEAVE Relay Dish Silhouette
function buildStreetContext() {
  const ctxGroup = new THREE.Group();
  const warmBrick = new THREE.MeshStandardMaterial({ color: '#9c523c', roughness: 0.84 });
  const ochreStone = new THREE.MeshStandardMaterial({ color: '#b88456', roughness: 0.76 });
  const slateTrim = new THREE.MeshStandardMaterial({ color: '#3b4654', roughness: 0.65 });
  const warmWin = new THREE.MeshStandardMaterial({ color: '#ffe4b5', emissive: '#ffae52', emissiveIntensity: 1.15 });

  const leftBldg = new THREE.Mesh(new THREE.BoxGeometry(11.5, 11.2, 11.5), ochreStone);
  leftBldg.position.set(-16.8, 5.6, 5.8);
  leftBldg.castShadow = true;
  leftBldg.receiveShadow = true;
  ctxGroup.add(leftBldg);
  const leftCornice = new THREE.Mesh(new THREE.BoxGeometry(11.9, 0.45, 11.9), slateTrim);
  leftCornice.position.set(-16.8, 11.3, 5.8);
  ctxGroup.add(leftCornice);

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

  // Grounded Curb Planter Trees
  const soilMat = new THREE.MeshStandardMaterial({ color: '#3b2d22', roughness: 0.95 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3728', roughness: 0.88 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3c6248', roughness: 0.82 });
  for (const tx of [-12.2, 12.4]) {
    const pit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 1.5), curbMat);
    pit.position.set(tx, 0.08, -5.0);
    ctxGroup.add(pit);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.26, 1.26), soilMat);
    soil.position.set(tx, 0.09, -5.0);
    ctxGroup.add(soil);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 3.2, 8), trunkMat);
    trunk.position.set(tx, 1.65, -5.0);
    trunk.castShadow = true;
    ctxGroup.add(trunk);
    for (const [ox, oy, oz, r] of [[0, 3.6, 0, 1.25], [-0.55, 3.2, 0.35, 0.92], [0.58, 3.3, -0.28, 0.95]]) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMat);
      crown.position.set(tx + ox, oy, -5.0 + oz);
      crown.castShadow = true;
      ctxGroup.add(crown);
    }
  }

  // Parked Delivery Cruiser at Usable Curb (tire contact at street y=-0.04)
  const car = new THREE.Group();
  car.position.set(-7.4, -0.04, -9.85);
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

  // Clicking the Cruiser from inside steps back out to the street curb
  const carHit = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.9, 2.2), hitInvisibleMat);
  carHit.position.y = 0.95;
  registerTarget(carHit, {
    action: 'jump-room',
    room: 'street',
    anchor: new THREE.Vector3(-7.2, 2.0, -7.85),
    getWhisper: () => 'Courier Cruiser (Tire Contact y=0) - click to step onto exterior street',
  });
  car.add(carHit);
  ctxGroup.add(car);

  // Monumental WEAVE Relay Dish Silhouette on Distant Ridge
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
worldRoot.add(buildStreetContext());

// Inverse Tomology Camera Frustum Rays + Recorded Masonry Envelope Wireframe (shown when Glass Prism X-Ray is active)
const xrayFrustumGroup = new THREE.Group();
xrayFrustumGroup.visible = false;
worldRoot.add(xrayFrustumGroup);
{
  // Recorded 20 x 12 x 16.4m Severn masonry envelope outline in cyan
  const envGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(20.0, 16.4, 12.0));
  const envWire = new THREE.LineSegments(
    envGeo,
    new THREE.LineBasicMaterial({ color: 0x18b4ff, transparent: true, opacity: 0.72 })
  );
  envWire.position.set(0, 8.2, 6.0);
  xrayFrustumGroup.add(envWire);

  // Inverse sightline frustum rays from street camera marks into interior carved rooms
  const invShots = FOUNDRY.inverse.shots.slice(0, 8);
  invShots.forEach((s, idx) => {
    const ang = ((idx / 8) * Math.PI * 0.85) - Math.PI * 0.42;
    const dist = 15 + (idx % 3) * 3.5;
    const ox = Math.sin(ang) * dist;
    const oz = -Math.cos(ang) * dist;
    const oy = 2.4 + (idx % 4) * 3.1;
    const tx = (idx - 3.5) * 1.9;
    const ty = 2.0 + (idx % 3) * 3.5;
    const tz = 3.6;
    const pts = [new THREE.Vector3(ox, oy, oz), new THREE.Vector3(tx, ty, tz)];
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: idx % 2 === 0 ? 0x18b4ff : 0xffb85c, transparent: true, opacity: 0.78 })
    );
    xrayFrustumGroup.add(line);
    const camNode = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0),
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
    new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 0.85 })
  );
  const parcelHit = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.46, 0.48), hitInvisibleMat);
  registerTarget(parcelHit, {
    action: 'toggle-parcel',
    anchor: new THREE.Vector3(0, 0.32, 0),
    isLocalAnchor: true,
    getWhisper: () =>
      parcelHolder === 'player'
        ? 'Severn Parcel (with Imani) - click to hand across threshold to Bekele'
        : 'Severn Parcel (with Bekele) - click to reclaim for courier dispatch',
  });
  parcelMesh.add(wrapBox, twine, parcelHit);
}
scene.add(parcelMesh);

const castActors = [];
function spawnAnnyActor({ id, name, archetype, x, y, z, rotY, coatHex, clip, targetAction, whisperFn }) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = rotY;
  castGroup.add(root);

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

  if (targetAction) {
    const hitCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.88, 10), hitInvisibleMat);
    hitCyl.position.y = 0.94;
    registerTarget(hitCyl, {
      action: targetAction.action,
      room: targetAction.room,
      anchor: new THREE.Vector3(0, 1.92, 0),
      isLocalAnchor: true,
      getWhisper: whisperFn,
    });
    root.add(hitCyl);
  }

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
  x: -0.68,
  y: 0,
  z: -2.35,
  rotY: 0.22,
  coatHex: '#354457',
  clip: 'idle',
  targetAction: { action: 'toggle-parcel' },
  whisperFn: () =>
    parcelHolder === 'player'
      ? 'Imani (Courier, holding parcel) - click to hand parcel to Bekele'
      : 'Imani (Courier) - click to return parcel to satchel',
});

const keeperActor = spawnAnnyActor({
  id: 'bekele',
  name: 'Bekele (Severn Keeper)',
  archetype: 'adult_m',
  x: 0.42,
  y: 0,
  z: 1.15,
  rotY: Math.PI - 0.16,
  coatHex: '#8c5438',
  clip: 'idle',
  targetAction: { action: 'toggle-parcel' },
  whisperFn: () =>
    parcelHolder === 'bekele'
      ? 'Bekele (Severn Keeper, holding parcel) - click to hand parcel back to Imani'
      : 'Bekele (Severn Keeper) - click to receive parcel at Severn threshold',
});

const witnessActor = spawnAnnyActor({
  id: 'maren',
  name: 'Maren (Flat 2A Tenant)',
  archetype: 'elder',
  x: -5.5,
  y: 6.8,
  z: 1.05,
  rotY: Math.PI,
  coatHex: '#5c6b78',
  clip: 'idle',
  targetAction: { action: 'jump-room', room: 'flat-2a' },
  whisperFn: () => 'Maren in Flat 2A (L2 Poet Desk) - click to step inside Flat 2A',
});

// ---------------------------------------------------------------------------
// Co-Evolution State & Full-Scale Severn Build
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
let activeMaquetteIdx = 5;
let severnPulse = 0;

let doorOpen = pilotInit.doorOpen !== false;
let doorAnimRot = doorOpen ? -1.18 : 0;
let parcelHolder = pilotInit.parcelHolder || 'player';
let parcelLerp = parcelHolder === 'bekele' ? 1 : 0;
let xrayActive = false;
let cameraStageMode = 'walk'; // 'walk' | 'forward' | 'reverse'
let inspectLevel = 0;

const severnAnchor = new THREE.Group();
worldRoot.add(severnAnchor);

// Diegetic Clickable Room, Window, Door & Stair Zones on Full-Scale Severn
const severnZonesGroup = new THREE.Group();
worldRoot.add(severnZonesGroup);
{
  // 1. Operable 3D Severn Street Door Hitbox (worldX=0, worldY=1.25, worldZ=0)
  const doorHit = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.55, 0.85), hitInvisibleMat);
  doorHit.position.set(0.0, 1.28, 0.0);
  registerTarget(doorHit, {
    action: 'toggle-door',
    anchor: new THREE.Vector3(0.0, 2.45, -0.25),
    getWhisper: () =>
      doorOpen
        ? 'Severn Street Door (Open, 13.5 kHz) - click to swing shut & muffle to 580 Hz'
        : 'Severn Street Door (Closed, 580 Hz muffled) - click to swing open',
  });
  severnZonesGroup.add(doorHit);

  // 2. Threshold Vestibule Interior Zone (behind door)
  const vestHit = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 2.8), hitInvisibleMat);
  vestHit.position.set(0.0, 1.35, 2.4);
  registerTarget(vestHit, {
    action: 'jump-room',
    room: 'vestibule',
    anchor: new THREE.Vector3(0.0, 2.1, 2.0),
    getWhisper: () => 'Threshold Vestibule (L0) - click to step inside',
  });
  severnZonesGroup.add(vestHit);

  // 3. L1 Silver-Gelatin Darkroom Window & Volume
  const darkHit = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.8, 3.2), hitInvisibleMat);
  darkHit.position.set(-5.8, 4.9, 1.2);
  registerTarget(darkHit, {
    action: 'jump-room',
    room: 'darkroom',
    anchor: new THREE.Vector3(-5.8, 5.4, 0.0),
    getWhisper: () => 'L1 Silver-Gelatin Darkroom (Enlarger & Safelight) - click to step inside',
  });
  severnZonesGroup.add(darkHit);

  // 4. L2 Flat 2A Front Window & Poet Desk
  const f2aHit = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.8, 3.2), hitInvisibleMat);
  f2aHit.position.set(-5.5, 8.2, 1.2);
  registerTarget(f2aHit, {
    action: 'jump-room',
    room: 'flat-2a',
    anchor: new THREE.Vector3(-5.5, 8.8, 0.0),
    getWhisper: () => 'L2 Flat 2A Window (Poet Desk & Street Sightline) - click to look from window',
  });
  severnZonesGroup.add(f2aHit);

  // 5. L3 Chamber Screening Room Window & Volume
  const screenHit = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.8, 3.4), hitInvisibleMat);
  screenHit.position.set(-5.4, 11.4, 1.4);
  registerTarget(screenHit, {
    action: 'jump-room',
    room: 'screening',
    anchor: new THREE.Vector3(-5.4, 12.0, 0.0),
    getWhisper: () => 'L3 Chamber Screening Room (16mm Projector & Screen) - click to enter',
  });
  severnZonesGroup.add(screenHit);

  // 6. East Stair Spine & Fire Escape (steps up floors sequentially)
  const stairHit = new THREE.Mesh(new THREE.BoxGeometry(4.4, 13.5, 5.2), hitInvisibleMat);
  stairHit.position.set(7.6, 6.8, 2.2);
  registerTarget(stairHit, {
    action: 'climb-stair',
    anchor: new THREE.Vector3(7.6, 7.5, -0.2),
    getWhisper: () => 'Severn East Stair Spine & Fire Escape - click to climb next level',
  });
  severnZonesGroup.add(stairHit);

  // 7. L4 Roof Parapet, Water-Tank & Cyan Beacon
  const roofHit = new THREE.Mesh(new THREE.BoxGeometry(19.5, 2.6, 5.5), hitInvisibleMat);
  roofHit.position.set(0.0, 16.5, 2.2);
  registerTarget(roofHit, {
    action: 'jump-room',
    room: 'roof',
    anchor: new THREE.Vector3(0.0, 17.2, 0.2),
    getWhisper: () => 'Severn Roof Overlook & Water Relay - click to ascend to roof',
  });
  severnZonesGroup.add(roofHit);
}

// ---------------------------------------------------------------------------
// 1. In-World 3D Architectural Maquette Table on the Sidewalk (6 Evolving Candidates)
// ---------------------------------------------------------------------------
const maquetteTableGroup = new THREE.Group();
maquetteTableGroup.position.set(-3.35, 0, -6.65);
maquetteTableGroup.rotation.y = 0.24;
worldRoot.add(maquetteTableGroup);

const maquetteModelsHolder = new THREE.Group();
maquetteTableGroup.add(maquetteModelsHolder);

let maquettePlinthMeshes = [];
let maquetteCandidates = [];
let mutateWheelMesh = null;

{
  const walnutMat = new THREE.MeshStandardMaterial({ color: '#4a2c1a', roughness: 0.52, metalness: 0.08 });
  const darkSlateMat = new THREE.MeshStandardMaterial({ color: '#111e30', roughness: 0.58, metalness: 0.18 });
  const brassMat = new THREE.MeshStandardMaterial({
    color: '#d9b26a',
    roughness: 0.28,
    metalness: 0.84,
    emissive: '#3b290c',
    emissiveIntensity: 0.16,
  });

  // Tabletop frame & inlaid slate blueprint bed (2.56m x 1.48m, height 0.86m)
  const topSlab = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.07, 1.50), walnutMat);
  topSlab.position.y = 0.835;
  topSlab.castShadow = true;
  topSlab.receiveShadow = true;
  maquetteTableGroup.add(topSlab);

  const slateInlay = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.02, 1.34), darkSlateMat);
  slateInlay.position.y = 0.875;
  slateInlay.receiveShadow = true;
  maquetteTableGroup.add(slateInlay);

  // Brass corner trim rails
  const frontRail = new THREE.Mesh(new THREE.BoxGeometry(2.60, 0.035, 0.03), brassMat);
  frontRail.position.set(0, 0.87, -0.755);
  const backRail = frontRail.clone();
  backRail.position.z = 0.755;
  maquetteTableGroup.add(frontRail, backRail);

  // 4 Turned Walnut & Brass Legs grounded at y = 0
  for (const [lx, lz] of [[-1.16, -0.63], [1.16, -0.63], [-1.16, 0.63], [1.16, 0.63]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.82, 10), walnutMat);
    leg.position.set(lx, 0.41, lz);
    leg.castShadow = true;
    maquetteTableGroup.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.040, 0.09, 10), brassMat);
    foot.position.set(lx, 0.045, lz);
    maquetteTableGroup.add(foot);
  }
  // Brass cross-stretcher
  const stretcher = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.30, 8), brassMat);
  stretcher.rotation.z = Math.PI / 2;
  stretcher.position.set(0, 0.24, 0);
  maquetteTableGroup.add(stretcher);

  // Warm gooseneck architect's lamp over the maquette table
  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.62, 8), brassMat);
  lampStem.position.set(-1.18, 1.18, 0.58);
  maquetteTableGroup.add(lampStem);
  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.16, 14, 1, true),
    new THREE.MeshStandardMaterial({ color: '#d9b26a', roughness: 0.3, metalness: 0.8, side: THREE.DoubleSide })
  );
  lampShade.position.set(-1.02, 1.46, 0.44);
  lampShade.rotation.z = -0.45;
  maquetteTableGroup.add(lampShade);
  const tableLampLight = new THREE.PointLight(0xffdca0, 5.5, 4.8, 1.6);
  tableLampLight.position.set(-0.92, 1.38, 0.36);
  maquetteTableGroup.add(tableLampLight);

  // Physical Brass Calvino Mutate Handwheel on Front Apron
  mutateWheelMesh = new THREE.Group();
  mutateWheelMesh.position.set(0.92, 0.83, -0.81);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 10, 20), brassMat);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10), brassMat);
  hub.rotation.x = Math.PI / 2;
  const spoke1 = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.016, 0.016), brassMat);
  const spoke2 = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.20, 0.016), brassMat);
  mutateWheelMesh.add(rim, hub, spoke1, spoke2);
  const wheelHit = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.26), hitInvisibleMat);
  registerTarget(wheelHit, {
    action: 'mutate-wheel',
    anchor: new THREE.Vector3(0, 0.22, 0),
    isLocalAnchor: true,
    getWhisper: () => `Calvino Mutate Handwheel (Seed ${currentSeed}) - click to evolve new Severn candidate`,
  });
  mutateWheelMesh.add(wheelHit);
  maquetteTableGroup.add(mutateWheelMesh);

  // Physical Bound 72-World Archive Ledger Folio on Left Edge of Table
  const folioGroup = new THREE.Group();
  folioGroup.position.set(-1.08, 0.905, -0.48);
  folioGroup.rotation.y = 0.18;
  const cover = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.035, 0.22),
    new THREE.MeshStandardMaterial({ color: '#243c58', roughness: 0.65 })
  );
  const page = new THREE.Mesh(
    new THREE.BoxGeometry(0.27, 0.04, 0.19),
    new THREE.MeshStandardMaterial({ color: '#efe8d8', roughness: 0.85 })
  );
  page.position.y = 0.006;
  const folioHit = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.30), hitInvisibleMat);
  registerTarget(folioHit, {
    action: 'open-archive',
    anchor: new THREE.Vector3(0, 0.18, 0),
    isLocalAnchor: true,
    getWhisper: () => '72-World Foundry Ledger & Poem Evidence - click to open archive sheet',
  });
  folioGroup.add(cover, page, folioHit);
  maquetteTableGroup.add(folioGroup);
}

const MAQUETTE_PRESETS = [
  { label: 'Gen 0: Baseline Severn', seed: 2080, parent: 'hdl-v1', ax: { thin: 0.30, hidden: 0.25, continuous: 0.50, memory: 0.50, desire: 0.35, signs: 0.50, eyes: 0.50 } },
  { label: 'Gen 1: Thin Cyan Lightwell', seed: 2082, parent: 'Gen 0', ax: { thin: 0.84, hidden: 0.32, continuous: 0.55, memory: 0.58, desire: 0.40, signs: 0.56, eyes: 0.62 } },
  { label: 'Gen 2: Hidden L1 Darkroom', seed: 2083, parent: 'Gen 1', ax: { thin: 0.72, hidden: 0.88, continuous: 0.58, memory: 0.64, desire: 0.44, signs: 0.62, eyes: 0.66 } },
  { label: 'Gen 3: Continuous Vestibule', seed: 2084, parent: 'Gen 2', ax: { thin: 0.68, hidden: 0.72, continuous: 0.90, memory: 0.70, desire: 0.52, signs: 0.70, eyes: 0.70 } },
  { label: 'Gen 4: L3 Screening Chamber', seed: 2085, parent: 'Gen 3', ax: { thin: 0.74, hidden: 0.76, continuous: 0.78, memory: 0.76, desire: 0.88, signs: 0.74, eyes: 0.80 } },
  { label: 'Gen 5: Active Co-Evolved', seed: currentSeed, parent: 'Gen 4', ax: null },
];

function rebuildMaquetteTableModels() {
  // Remove old miniature hit targets from interactiveTargets
  for (let i = interactiveTargets.length - 1; i >= 0; i--) {
    if (interactiveTargets[i].userData.foundryTarget?.action === 'maquette') {
      interactiveTargets.splice(i, 1);
    }
  }
  while (maquetteModelsHolder.children.length) {
    maquetteModelsHolder.remove(maquetteModelsHolder.children[0]);
  }
  maquettePlinthMeshes = [];
  maquetteCandidates = [];

  const sc = 0.029; // 20m -> 0.58m wide, 12m -> 0.35m deep on tabletop!
  MAQUETTE_PRESETS.forEach((p, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const gx = (col - 1) * 0.76;
    const gz = (row - 0.5) * 0.56;

    const candAxes = p.ax ? p.ax : { ...axes };
    const candSeed = idx === 5 ? currentSeed : p.seed;
    const cand = mutateSevernCandidate(SEVERN_BUNDLE.hero, candAxes, candSeed, idx, p.parent);
    maquetteCandidates.push(cand);

    const slot = new THREE.Group();
    slot.position.set(gx, 0.885, gz);

    const isSelected = idx === activeMaquetteIdx;
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.032, 0.43),
      new THREE.MeshStandardMaterial({
        color: isSelected ? '#1a6da4' : '#3a3022',
        emissive: isSelected ? '#18b4ff' : '#1b1408',
        emissiveIntensity: isSelected ? 0.65 : 0.15,
        roughness: 0.38,
        metalness: 0.62,
      })
    );
    plinth.position.y = 0.016;
    slot.add(plinth);
    maquettePlinthMeshes.push(plinth);

    const mini = new THREE.Group();
    mini.position.y = 0.032;
    mini.scale.setScalar(sc);
    const b = build(cand.H, { doorOpen: true });
    b.group.position.set(-10, 0, -6);
    b.mass.position.set(-10, 0, -6);
    // Peel top roof and show glowing interior tomology + cyan lightwell inside every miniature!
    b.roof.visible = false;
    b.levels.forEach((lg, lk) => {
      if (lk >= 4) lg.visible = false;
    });
    b.mass.visible = true;
    b.group.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    mini.add(b.group, b.mass);
    slot.add(mini);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.54, 0.48), hitInvisibleMat);
    hit.position.y = 0.27;
    registerTarget(hit, {
      action: 'maquette',
      candIdx: idx,
      anchor: new THREE.Vector3(0, 0.56, 0),
      isLocalAnchor: true,
      getWhisper: () =>
        idx === activeMaquetteIdx
          ? `${p.label} (Active) - click again to mutate new generation`
          : `Maquette ${p.label} - click to evolve full-scale Severn`,
    });
    slot.add(hit);

    maquetteModelsHolder.add(slot);
  });
}

// ---------------------------------------------------------------------------
// 2. In-World 3D Glass X-Ray Prism on Brass Curb Stand
// ---------------------------------------------------------------------------
const prismStandGroup = new THREE.Group();
prismStandGroup.position.set(-1.45, 0, -5.85);
worldRoot.add(prismStandGroup);

let prismCrystalMesh = null;
let prismCoreMat = null;
let prismPointLight = null;
{
  const brassStandMat = new THREE.MeshStandardMaterial({
    color: '#d9b26a',
    roughness: 0.26,
    metalness: 0.85,
  });
  const baseFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.08, 16), brassStandMat);
  baseFoot.position.y = 0.04;
  baseFoot.castShadow = true;
  prismStandGroup.add(baseFoot);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.048, 0.96, 12), brassStandMat);
  column.position.y = 0.52;
  column.castShadow = true;
  prismStandGroup.add(column);

  const gimbalRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.018, 10, 28), brassStandMat);
  gimbalRing.position.y = 1.22;
  prismStandGroup.add(gimbalRing);

  // Translucent 3-sided Optical Inverse-Tomology Glass Prism
  prismCrystalMesh = new THREE.Group();
  prismCrystalMesh.position.y = 1.22;
  prismCrystalMesh.rotation.z = 0.22;

  const glassPrismGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.44, 3);
  const glassPrismMat = new THREE.MeshStandardMaterial({
    color: '#9cebff',
    emissive: '#18b4ff',
    emissiveIntensity: 0.45,
    roughness: 0.06,
    metalness: 0.18,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
  });
  const glassShell = new THREE.Mesh(glassPrismGeo, glassPrismMat);
  prismCrystalMesh.add(glassShell);

  prismCoreMat = new THREE.MeshBasicMaterial({
    color: '#dff8ff',
    transparent: true,
    opacity: 0.78,
  });
  const innerCore = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 3), prismCoreMat);
  prismCrystalMesh.add(innerCore);

  const prismEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(glassPrismGeo),
    new THREE.LineBasicMaterial({ color: 0xe8fbff })
  );
  prismCrystalMesh.add(prismEdges);
  prismStandGroup.add(prismCrystalMesh);

  prismPointLight = new THREE.PointLight(0x18b4ff, 4.2, 5.5, 1.6);
  prismPointLight.position.set(0, 1.25, 0);
  prismStandGroup.add(prismPointLight);

  const prismHit = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.62, 10), hitInvisibleMat);
  prismHit.position.y = 0.82;
  registerTarget(prismHit, {
    action: 'toggle-xray',
    anchor: new THREE.Vector3(0, 1.64, 0),
    isLocalAnchor: true,
    getWhisper: () =>
      xrayActive
        ? 'Optical X-Ray Prism (Active) - click to restore solid Severn brick facade'
        : 'Optical Glass X-Ray Prism - click to peel Severn into Inverse-Tomology X-Ray',
  });
  prismStandGroup.add(prismHit);
}

// ---------------------------------------------------------------------------
// Mount Universal 23-Look GPU Shader Suite + In-World Brass Tripod & Portals
// ---------------------------------------------------------------------------
let currentNightMix = 0.72;
const suite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: pilotInit.shader || 'weave',
  locationName: 'The Severn - Foundry & Inverse Tomology',
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

// Spawn Physical 3D 8x10 Brass Camera Tripod + West/East Sidewalk Portals
const worldRig = createWorldPortalAndTripod({
  THREE,
  scene,
  camera,
  domElement: renderer.domElement,
  suite,
  tripodPos: { x: 2.55, y: 0, z: -6.75, rotY: Math.PI - 0.22 },
  portals: [
    {
      id: 'heroes',
      label: 'Hero Promenade (6 HDL Buildings)',
      href: '../heroes/',
      pos: [10.6, 0, -2.4],
      rotY: -Math.PI / 2,
    },
    {
      id: 'nolli',
      label: 'Nolli Block & Camera Shop',
      href: '../',
      pos: [-10.6, 0, -2.4],
      rotY: Math.PI / 2,
    },
  ],
  onTripodClick: ({ event }) => {
    if (event.altKey) {
      cycleTripodAngle();
      return true;
    }
    return false;
  },
});

// Add dedicated physical Brass Pan-Tilt Angle Lever onto the Camera Tripod so Forward/Reverse Shot Angle is 1-click!
if (worldRig.tripodGroup) {
  const leverMat = new THREE.MeshStandardMaterial({ color: '#e6be74', roughness: 0.25, metalness: 0.86 });
  const tipMat = new THREE.MeshStandardMaterial({
    color: '#18b4ff',
    emissive: '#18b4ff',
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });
  const panArm = new THREE.Group();
  panArm.position.set(-0.22, 1.34, -0.16);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8), leverMat);
  rod.rotation.z = 0.72;
  rod.rotation.x = -0.35;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 10), tipMat);
  knob.position.set(-0.11, -0.12, -0.06);
  panArm.add(rod, knob);

  const angleHit = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), hitInvisibleMat);
  angleHit.position.copy(knob.position);
  registerTarget(angleHit, {
    action: 'tripod-angle',
    anchor: new THREE.Vector3(-0.11, 0.22, -0.06),
    isLocalAnchor: true,
    getWhisper: () => `Tripod Pan Handle (${cameraStageMode.toUpperCase()}) - click for Forward / Reverse / Walk angle`,
  });
  panArm.add(angleHit);
  worldRig.tripodGroup.add(panArm);
}

// ---------------------------------------------------------------------------
// Severn Rebuild, X-Ray Visuals & Aura Lights
// ---------------------------------------------------------------------------
function syncAuraLights() {
  auraLights.forEach((l) => scene.remove(l));
  auraLights = [];
  if (!builtSevern) return;

  const ox = builtSevern.group.position.x;
  const oz = builtSevern.group.position.z;

  const lobbySpill = new THREE.PointLight(0xffc882, doorOpen ? 22 : 6, 14, 1.5);
  lobbySpill.position.set(0, 2.85, 1.8);
  scene.add(lobbySpill);
  auraLights.push(lobbySpill);

  for (const fx of builtSevern.fixtures) {
    if (!fx.color) continue;
    const pl = new THREE.PointLight(fx.color, fx.intensity || 8, fx.dist || 10, 1.6);
    pl.position.set(fx.pos[0] + ox, fx.pos[1], fx.pos[2] + oz);
    scene.add(pl);
    auraLights.push(pl);
  }
}

function applySevernVisualState() {
  if (!builtSevern) return;
  xrayFrustumGroup.visible = xrayActive;
  builtSevern.mass.visible = xrayActive;
  builtSevern.roof.visible = !xrayActive;
  builtSevern.levels.forEach((lg) => {
    lg.visible = true;
    lg.traverse((o) => {
      if (o.userData.wall) {
        o.visible = !(xrayActive && o.userData.wall.ext && o.userData.wall.side === 'front');
      }
      if (o.userData.ceiling) {
        o.visible = !xrayActive;
      }
    });
  });

  if (prismCoreMat) {
    prismCoreMat.color.set(xrayActive ? '#ffffff' : '#9cebff');
  }
  if (prismPointLight) {
    prismPointLight.intensity = xrayActive ? 9.5 : 4.2;
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

  applySevernVisualState();
  syncAuraLights();
  updateLineageUI();
  drawPlanCanvas();
}

// ---------------------------------------------------------------------------
// Player Walk State, Smooth Room Glides & Camera Angles
// ---------------------------------------------------------------------------
const player = {
  // HDL local coords: x in [0..20] (worldX = x - 10), y in [-16..14] (worldZ = y), z up (worldY = z)
  x: 9.35,
  y: -14.1,
  z: 0.0,
  yaw: Math.PI - 0.02,
  pitch: 0.13,
  isInside: false,
};

let glideAnim = null; // { t, dur, from, to }

const ROOM_JUMPS = {
  street: { x: 9.35, y: -14.1, z: 0.0, yaw: Math.PI - 0.02, pitch: 0.13, lv: 0, label: 'Exterior Street' },
  vestibule: { x: 10.0, y: 2.2, z: 0.0, yaw: Math.PI, pitch: 0.0, lv: 0, label: 'L0 Threshold Vestibule' },
  'flat-2a': { x: 4.5, y: 2.5, z: 6.8, yaw: 0.0, pitch: -0.06, lv: 2, label: 'L2 Flat 2A Window' },
  darkroom: { x: 4.0, y: 9.2, z: 3.6, yaw: Math.PI, pitch: -0.04, lv: 1, label: 'L1 Silver-Gelatin Darkroom' },
  screening: { x: 4.0, y: 8.4, z: 10.0, yaw: Math.PI, pitch: 0.02, lv: 3, label: 'L3 Chamber Screening Room' },
  roof: { x: 10.0, y: 4.0, z: 16.4, yaw: 0.15, pitch: -0.18, lv: 4, label: 'L4 Severn Roof Overlook' },
};

function shortestAngleDelta(from, to) {
  let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function jumpToRoom(key, smooth = true) {
  const j = ROOM_JUMPS[key] || ROOM_JUMPS.street;
  cameraStageMode = 'walk';
  orbit.enabled = false;
  camera.fov = 50;
  camera.updateProjectionMatrix();
  inspectLevel = j.lv;

  if (smooth) {
    glideAnim = {
      t: 0,
      dur: 0.55,
      from: { x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch },
      to: { x: j.x, y: j.y, z: j.z, yaw: player.yaw + shortestAngleDelta(player.yaw, j.yaw), pitch: j.pitch },
    };
  } else {
    glideAnim = null;
    player.x = j.x;
    player.y = j.y;
    player.z = j.z;
    player.yaw = j.yaw;
    player.pitch = j.pitch;
  }

  document.querySelectorAll('#room-jumps .pill').forEach((b) => b.classList.toggle('active', b.dataset.jump === key));
  document.querySelectorAll('#level-pills .pill').forEach((b) => b.classList.toggle('active', +b.dataset.lv === inspectLevel));
  savePilotState({ room: key, building: 'severn' });
  drawPlanCanvas();
  showActionWhisper(`Stepped -> ${j.label}`, new THREE.Vector3(j.x - 10, j.z + 2.0, j.y));
}

function toggleXray() {
  xrayActive = !xrayActive;
  applySevernVisualState();
  document.querySelectorAll('#view-modes .pill').forEach((b) => {
    if (b.dataset.mode === 'xray') b.classList.toggle('active', xrayActive);
  });
  showActionWhisper(
    xrayActive
      ? 'Inverse Tomology X-Ray: Carved Rooms + Cyan Lightwell + Frustums'
      : 'Solid Masonry Restored (20 x 12 m Recorded Envelope)',
    new THREE.Vector3(-1.38, 1.75, -4.65)
  );
}

function selectMaquette(idx) {
  if (idx === activeMaquetteIdx) {
    mutateCandidate();
    return;
  }
  const chosen = maquetteCandidates[idx];
  if (!chosen) return;
  activeMaquetteIdx = idx;
  Object.assign(axes, chosen.axes);
  currentSeed = chosen.seed;
  savePilotState({ seed: currentSeed });
  renderCalvinoSliders();
  rebuildActiveCandidate(true);
  rebuildMaquetteTableModels();
  severnPulse = 1.0;
  suite.audio?.playDoorTransition?.(true);
  const m = activeCand.metrics;
  showActionWhisper(
    `Evolved Severn -> ${MAQUETTE_PRESETS[idx].label} (Poems ${Math.round(m.poemsScore * 100)}%, Builder ${Math.round(m.builderScore * 100)}%)`,
    new THREE.Vector3(-3.15, 1.55, -5.45)
  );
}

function mutateCandidate() {
  currentSeed += 7;
  activeMaquetteIdx = 5;
  CALVINO_DEFS.forEach((d, idx) => {
    const delta = Math.sin(currentSeed * 0.37 + idx * 2.1) * 0.16;
    axes[d.key] = Math.max(0.15, Math.min(0.94, Number((axes[d.key] + delta).toFixed(2))));
    const inp = $(`ax-${d.key}`);
    if (inp) inp.value = axes[d.key];
    const lbl = $(`axv-${d.key}`);
    if (lbl) lbl.textContent = `${Math.round(axes[d.key] * 100)}%`;
  });
  savePilotState({ seed: currentSeed });
  rebuildActiveCandidate(true);
  rebuildMaquetteTableModels();
  severnPulse = 1.0;
  if (mutateWheelMesh) mutateWheelMesh.rotation.z += Math.PI * 0.65;
  suite.audio?.playDoorTransition?.(true);
  showActionWhisper(
    `Mutated Seed ${currentSeed} -> ${activeCand.mutations[0] || 'Co-Evolved Interior'}`,
    new THREE.Vector3(-2.5, 1.45, -5.8)
  );
}

function cycleTripodAngle() {
  if (cameraStageMode === 'walk') {
    cameraStageMode = 'forward';
    camera.fov = 40;
    camera.updateProjectionMatrix();
    camera.position.set(-2.9, 1.72, -10.6);
    camera.lookAt(0.2, 2.35, 1.5);
    showActionWhisper('Shot w1623-01-00: Forward Arrival Angle (29mm)', new THREE.Vector3(2.35, 1.85, -5.55));
  } else if (cameraStageMode === 'forward') {
    cameraStageMode = 'reverse';
    camera.fov = 44;
    camera.updateProjectionMatrix();
    camera.position.set(1.15, 1.72, 3.35);
    camera.lookAt(-0.65, 1.45, -3.2);
    showActionWhisper('Reverse Over-the-Shoulder Threshold Angle (Vestibule -> Curb)', new THREE.Vector3(0.2, 1.9, 0.5));
  } else {
    cameraStageMode = 'walk';
    camera.fov = 50;
    camera.updateProjectionMatrix();
    showActionWhisper('Returned to Free Street Walk (WASD)', new THREE.Vector3(2.35, 1.85, -5.55));
  }
  updatePilotHUD();
}

function toggleDoor() {
  doorOpen = !doorOpen;
  suite.audio?.setDoorOpen?.(doorOpen, true);
  syncAuraLights();
  savePilotState({ doorOpen });
  updatePilotHUD();
  drawPlanCanvas();
  showActionWhisper(
    doorOpen ? 'Severn Door Open - 13.5 kHz Street Air' : 'Severn Door Closed - Muffled 580 Hz',
    new THREE.Vector3(0, 2.45, -0.2)
  );
}

function toggleParcel() {
  parcelHolder = parcelHolder === 'player' ? 'bekele' : 'player';
  savePilotState({ parcelHolder });
  if (parcelHolder === 'bekele') {
    suite.speakLine('Bekele', 'Parcel received at the Severn threshold. Flat 2A is open upstairs.', 0.94);
    showActionWhisper(
      'Bekele: "Parcel received at the Severn threshold. Flat 2A is open upstairs."',
      new THREE.Vector3(0.42, 2.05, 1.15),
      3200
    );
  } else {
    suite.speakLine('Imani', 'Parcel back in courier satchel for street dispatch.', 1.04);
    showActionWhisper(
      'Imani: "Parcel back in courier satchel for street dispatch."',
      new THREE.Vector3(-0.68, 2.05, -2.35),
      3200
    );
  }
  updatePilotHUD();
}

// ---------------------------------------------------------------------------
// World-Projected 1-Line Diegetic Whisper (Unboxed, Hover or Transient Action)
// ---------------------------------------------------------------------------
let hoveredTarget = null;
let actionWhisper = null; // { text, worldVec3, until }
const _whisperVec = new THREE.Vector3();

function showActionWhisper(text, worldVec3, ms = 2400) {
  actionWhisper = {
    text,
    worldVec3: worldVec3.clone(),
    until: performance.now() + ms,
  };
}

function updateWhisperOverlay() {
  if (!whisperEl) return;
  const now = performance.now();
  let text = '';
  if (actionWhisper && now < actionWhisper.until) {
    text = actionWhisper.text;
    _whisperVec.copy(actionWhisper.worldVec3);
  } else {
    actionWhisper = null;
    if (hoveredTarget) {
      const td = hoveredTarget.object.userData.foundryTarget;
      if (td) {
        text = td.getWhisper ? td.getWhisper() : '';
        if (td.isLocalAnchor) {
          _whisperVec.copy(td.anchor);
          hoveredTarget.object.localToWorld(_whisperVec);
        } else if (td.anchor) {
          _whisperVec.copy(td.anchor);
        } else {
          _whisperVec.copy(hoveredTarget.point);
        }
      }
    }
  }

  if (!text) {
    whisperEl.style.display = 'none';
    return;
  }
  const proj = projectWorldLabel(camera, _whisperVec, renderer.domElement);
  if (!proj.visible) {
    whisperEl.style.display = 'none';
    return;
  }
  whisperEl.textContent = text;
  whisperEl.style.display = 'block';
  whisperEl.style.left = `${Math.max(120, Math.min(window.innerWidth - 120, proj.x))}px`;
  whisperEl.style.top = `${Math.max(28, Math.min(window.innerHeight - 24, proj.y))}px`;
}

// ---------------------------------------------------------------------------
// Audit Drawer UI Wiring (Hidden on load, synced if Tab is pressed)
// ---------------------------------------------------------------------------
function renderCalvinoSliders() {
  const host = $('calvino-sliders');
  if (!host) return;
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
      activeMaquetteIdx = 5;
      rebuildActiveCandidate(false);
      rebuildMaquetteTableModels();
    });
  });
}
renderCalvinoSliders();

function updateLineageUI() {
  if (!activeCand || !$('lineage-readout')) return;
  const m = activeCand.metrics;
  $('lineage-readout').innerHTML = `
    <div><b>${activeCand.id}</b> - seed <b>${activeCand.seed}</b> - parent <span>${activeCand.parent}</span></div>
    <div style="margin-top:3px;color:var(--paper);">${activeCand.mutations.join(' | ')}</div>
    <div style="margin-top:4px;color:var(--muted);">Poems <b>${Math.round(m.poemsScore * 100)}%</b> - Builder <b>${Math.round(m.builderScore * 100)}%</b> - Tomology <b>${Math.round(m.tomologyScore * 100)}%</b></div>
  `;
  const passCount = activeCand.proofs.filter((p) => p.state === 'PASS').length;
  const warnCount = activeCand.proofs.filter((p) => p.state === 'WARN').length;
  $('proof-summary').textContent = `Prototype & Clearance Gate: ${passCount} PASS, ${warnCount} WARN, ${m.fails} FAIL - Hallway ${m.hallwayDepthM}m`;
}

function updatePilotHUD() {
  if (!$('btn-door')) return;
  $('btn-door').textContent = `Door: ${doorOpen ? 'Open' : 'Closed'} (E)`;
  $('btn-door').classList.toggle('cyan-act', doorOpen);
  $('btn-parcel').textContent =
    parcelHolder === 'player' ? 'Hand Parcel to Bekele (H)' : 'Reclaim Parcel from Bekele (H)';
  $('btn-reverse-cam').textContent = `Angle: ${cameraStageMode.toUpperCase()} (R)`;

  const cutoffStr = player.isInside ? (doorOpen ? '1.8 kHz Bleed' : '580 Hz Muffled') : '13.5 kHz Open Air';
  $('space-status').textContent = `${player.isInside ? 'INSIDE SEVERN' : 'EXTERIOR STREET'} - ${cutoffStr}`;

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
  const doorX = px0 + 10 * sc;
  const doorY = py0 + 12 * sc;
  ctx.strokeStyle = doorOpen ? '#7fe0a0' : '#ff6a5a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(doorX - 8, doorY);
  ctx.lineTo(doorX + 8, doorOpen ? doorY - 7 : doorY);
  ctx.stroke();
  ctx.lineWidth = 1;

  const plX = px0 + Math.max(-1, Math.min(21, player.x)) * sc;
  const plY = py0 + (12 - Math.max(-4, Math.min(13, player.y))) * sc;
  ctx.fillStyle = '#18b4ff';
  ctx.beginPath();
  ctx.arc(plX, Math.min(H - 6, plY), 3.6, 0, Math.PI * 2);
  ctx.fill();

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
  const pySec = syBase - (player.z + 1.0) * sScZ;
  ctx.fillStyle = '#18b4ff';
  ctx.beginPath();
  ctx.arc(sx0 + Math.max(0, Math.min(20, player.x)) * sScX, pySec, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

subscribePilotState((next) => {
  if (typeof next.doorOpen === 'boolean' && next.doorOpen !== doorOpen) {
    doorOpen = next.doorOpen;
    suite.audio?.setDoorOpen?.(doorOpen, false);
    syncAuraLights();
  }
  if (next.parcelHolder && next.parcelHolder !== parcelHolder) {
    parcelHolder = next.parcelHolder;
  }
  updatePilotHUD();
  drawPlanCanvas();
});

// Wire optional Tab drawer buttons
document.querySelectorAll('#view-modes .pill').forEach((b) => {
  b.addEventListener('click', () => {
    if (b.dataset.mode === 'xray') toggleXray();
    else if (b.dataset.mode === 'stage') cycleTripodAngle();
    else {
      cameraStageMode = 'walk';
      if (xrayActive) toggleXray();
    }
  });
});
document.querySelectorAll('#room-jumps .pill').forEach((b) => {
  b.addEventListener('click', () => jumpToRoom(b.dataset.jump, true));
});
document.querySelectorAll('#level-pills .pill').forEach((b) => {
  b.addEventListener('click', () => {
    inspectLevel = +b.dataset.lv;
    document.querySelectorAll('#level-pills .pill').forEach((x) => x.classList.toggle('active', x === b));
    drawPlanCanvas();
  });
});
$('btn-mutate')?.addEventListener('click', mutateCandidate);
$('btn-revert')?.addEventListener('click', () => {
  if (!candidateHistory.length) return;
  const prev = candidateHistory.pop();
  Object.assign(axes, prev.axes);
  currentSeed = prev.seed;
  renderCalvinoSliders();
  rebuildActiveCandidate(false);
  rebuildMaquetteTableModels();
});
$('btn-door')?.addEventListener('click', toggleDoor);
$('btn-parcel')?.addEventListener('click', toggleParcel);
$('btn-reverse-cam')?.addEventListener('click', cycleTripodAngle);
$('toggle-left')?.addEventListener('click', () => {
  $('left-drawer').classList.toggle('collapsed');
});
$('toggle-right')?.addEventListener('click', () => {
  $('right-drawer').classList.toggle('collapsed');
});

// ---------------------------------------------------------------------------
// 72-World Archive Modal (Opened via Folio on Maquette Table or 'B')
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
  $('archive-stats-line').textContent = `${FOUNDRY.n_worlds} Worlds Grown (${FOUNDRY.gens} Gens) - ${Object.keys(FOUNDRY.worlds).length} Kept Elites - ${FOUNDRY.sets.length} Shot Sets`;
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
    <div><b>World ${w.id}</b> - Gen ${w.gen} - Niche ${w.cell} - Layout <b>${w.g.layout}</b> - ${w.d.street_km} km streets</div>
    <div style="margin-top:3px;">Combined <b>${Math.round(w.q * 100)}%</b> - Poems <b>${Math.round(w.r.score * 100)}%</b> - Builder <b>${Math.round((w.b?.score || 0) * 100)}%</b></div>
    <div style="margin-top:4px;color:var(--muted);">${(w.recipe || []).slice(0, 3).join(' | ')}</div>
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
          <b style="color:var(--brass)">${r.id} - ${r.mm}mm</b>
          <span class="prov-badge prov-${r.prov}">${r.refClass} - ${r.prov}</span>
        </div>
        <div style="color:var(--paper);font-style:italic;">"${(r.line || '').slice(0, 88)}"</div>
        <div style="margin-top:4px;color:var(--muted);font-size:10px;">Light: ${r.light} - Cam z=${Math.round(r.cam?.z || 2)}m</div>
      </div>`
    )
    .join('');
}

$('btn-open-archive')?.addEventListener('click', () => {
  $('archive-modal').classList.add('open');
  buildArchiveModal();
});
$('btn-close-archive')?.addEventListener('click', () => $('archive-modal').classList.remove('open'));
document.querySelectorAll('[data-rclass]').forEach((b) => {
  b.addEventListener('click', () => {
    refFilterClass = b.dataset.rclass;
    document.querySelectorAll('[data-rclass]').forEach((x) => x.classList.toggle('active', x === b));
    renderClassifiedRefs();
  });
});

// ---------------------------------------------------------------------------
// Input Controls: WASD Walk, Pointer Drag Look & 3D Diegetic Raycast Interactions
// ---------------------------------------------------------------------------
const keys = {};
let drag = null;
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();

function raycastSceneTargets(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObjects(interactiveTargets, false);
  return hits.length && hits[0].distance < 48 ? hits[0] : null;
}

window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    if (cameraStageMode !== 'walk') {
      cameraStageMode = 'walk';
      camera.fov = 50;
      camera.updateProjectionMatrix();
    }
    glideAnim = null;
  } else if (k === 'x') toggleXray();
  else if (k === 'e') toggleDoor();
  else if (k === 'h') toggleParcel();
  else if (k === 'r') cycleTripodAngle();
  else if (k === 'n') mutateCandidate();
  else if (k === 'b') {
    $('archive-modal').classList.toggle('open');
    if ($('archive-modal').classList.contains('open')) buildArchiveModal();
  } else if (e.key === 'Escape') {
    $('archive-modal').classList.remove('open');
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, moved: false };
});

window.addEventListener('pointermove', (e) => {
  if (drag) {
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 3) drag.moved = true;
    if (cameraStageMode === 'walk') {
      glideAnim = null;
      player.yaw -= dx * 0.0042;
      player.pitch = Math.max(-1.15, Math.min(1.15, player.pitch - dy * 0.0042));
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
  } else {
    hoveredTarget = raycastSceneTargets(e.clientX, e.clientY);
    if (hoveredTarget) {
      renderer.domElement.style.cursor = 'pointer';
    } else if (!renderer.domElement.dataset.mpPrevCursor) {
      renderer.domElement.style.cursor = 'grab';
    }
  }
});

window.addEventListener('pointerup', (e) => {
  if (drag && !drag.moved && e.button === 0) {
    const hit = raycastSceneTargets(e.clientX, e.clientY);
    if (hit) {
      const td = hit.object.userData.foundryTarget;
      if (td.action === 'maquette') {
        selectMaquette(td.candIdx);
      } else if (td.action === 'mutate-wheel') {
        mutateCandidate();
      } else if (td.action === 'toggle-xray') {
        toggleXray();
      } else if (td.action === 'toggle-door') {
        toggleDoor();
      } else if (td.action === 'toggle-parcel') {
        toggleParcel();
      } else if (td.action === 'tripod-angle') {
        cycleTripodAngle();
      } else if (td.action === 'open-archive') {
        $('archive-modal').classList.add('open');
        buildArchiveModal();
      } else if (td.action === 'jump-room') {
        jumpToRoom(td.room, true);
      } else if (td.action === 'climb-stair') {
        const order = ['vestibule', 'darkroom', 'flat-2a', 'screening', 'roof', 'street'];
        const nextIdx = (inspectLevel + 1) % order.length;
        jumpToRoom(order[nextIdx], true);
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

// Initialize Candidate, Sidewalk Maquette Table & Scene
rebuildActiveCandidate(false);
rebuildMaquetteTableModels();

const explicitUrlRoom =
  new URLSearchParams(window.location.search).get('room') ||
  (window.location.hash.includes('room=') && pilotInit.room !== 'vestibule' ? pilotInit.room : null);
if (explicitUrlRoom && ROOM_JUMPS[explicitUrlRoom]) {
  jumpToRoom(explicitUrlRoom, false);
} else {
  updatePilotHUD();
}

// ---------------------------------------------------------------------------
// Main Animation Loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const _courierHand = new THREE.Vector3();
const _keeperHand = new THREE.Vector3();

function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now() * 0.001;

  // Rotate 3D Optical Glass X-Ray Prism gently
  if (prismCrystalMesh) {
    prismCrystalMesh.rotation.y = now * (xrayActive ? 1.35 : 0.45);
  }

  // Smoothly animate 3D Severn Threshold Door swing
  const targetDoorRot = doorOpen ? -1.18 : 0;
  doorAnimRot += (targetDoorRot - doorAnimRot) * Math.min(1, dt * 10);
  if (builtSevern) {
    builtSevern.doorOpen = doorOpen;
    for (const td of builtSevern.thresholdDoors) {
      td.leaf.rotation.y = doorAnimRot;
    }
  }

  // Subtle cyan evolution shimmer decay
  if (severnPulse > 0.005) {
    severnPulse = Math.max(0, severnPulse - dt * 1.8);
  }

  let moving = false;
  if (cameraStageMode === 'walk' && builtSevern) {
    if (glideAnim) {
      glideAnim.t += dt;
      const u = Math.min(1, glideAnim.t / glideAnim.dur);
      const ease = 1 - Math.pow(1 - u, 3);
      player.x = glideAnim.from.x + (glideAnim.to.x - glideAnim.from.x) * ease;
      player.y = glideAnim.from.y + (glideAnim.to.y - glideAnim.from.y) * ease;
      player.z = glideAnim.from.z + (glideAnim.to.z - glideAnim.from.z) * ease;
      player.yaw = glideAnim.from.yaw + (glideAnim.to.yaw - glideAnim.from.yaw) * ease;
      player.pitch = glideAnim.from.pitch + (glideAnim.to.pitch - glideAnim.from.pitch) * ease;
      if (u >= 1) glideAnim = null;
      moving = true;
    } else {
      const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
      const s = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
      if (f !== 0 || s !== 0) {
        moving = true;
        const sp = (keys.shift ? 5.4 : 3.0) * dt;
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
    }

    const wasInside = player.isInside;
    player.isInside = player.x >= 0 && player.x <= 20 && player.y >= 0 && player.y <= 12;
    if (wasInside !== player.isInside || moving) updatePilotHUD();

    camera.position.set(player.x - 10, player.z + 1.65, player.y);
    camera.rotation.set(player.pitch, player.yaw, 0);
  } else if (orbit.enabled) {
    orbit.update();
  }

  // Update Anny V8 cast animations & smooth 3D parcel handoff arc
  for (const act of castActors) {
    if (act.v8?.update) act.v8.update(dt);
  }
  const targetParcelT = parcelHolder === 'bekele' ? 1 : 0;
  parcelLerp += (targetParcelT - parcelLerp) * Math.min(1, dt * 6.5);

  _courierHand.set(
    courierActor.root.position.x + Math.sin(courierActor.root.rotation.y) * 0.34,
    courierActor.root.position.y + 1.05 + Math.sin(now * 2.2) * 0.015,
    courierActor.root.position.z + Math.cos(courierActor.root.rotation.y) * 0.34
  );
  _keeperHand.set(
    keeperActor.root.position.x + Math.sin(keeperActor.root.rotation.y) * 0.34,
    keeperActor.root.position.y + 1.05 + Math.sin(now * 2.2 + 1.1) * 0.015,
    keeperActor.root.position.z + Math.cos(keeperActor.root.rotation.y) * 0.34
  );
  parcelMesh.position.lerpVectors(_courierHand, _keeperHand, parcelLerp);
  parcelMesh.position.y += Math.sin(parcelLerp * Math.PI) * 0.38;
  parcelMesh.rotation.y =
    courierActor.root.rotation.y +
    shortestAngleDelta(courierActor.root.rotation.y, keeperActor.root.rotation.y) * parcelLerp;

  // Update world portal & tripod rig
  worldRig.update({ x: player.x - 10, y: player.z, z: player.y });
  updateWhisperOverlay();

  // Door-coupled spatial audio (580 Hz muffled when door is closed!)
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
  toggleXray,
  selectMaquette,
  mutateCandidate,
  jumpToRoom,
  toggleDoor,
  toggleParcel,
  cycleTripodAngle,
  get xrayActive() {
    return xrayActive;
  },
  get activeCand() {
    return activeCand;
  },
  get maquetteCount() {
    return maquetteCandidates.length;
  },
  camera,
  suite,
};
