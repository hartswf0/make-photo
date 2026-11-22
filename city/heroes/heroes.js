// Walkable 3D Hero Street Promenade — All 6 Compiled HDL Heroes in One World (100% Pure Diegetic In-World UI)
// Arranges The Severn, The Atlantis Rowhouse, The Clock Tower, The Chapel, The NEW SINGLE, and The Pier Cafe (over harbor water)
// along one continuous walkable (WASD) & clickable waterfront promenade with clothed 1.70m Anny V8 residents,
// 3D Brass Sundial Lamp Posts (Poem Hour <-> Raw Neutral Daylight), 3D Cutaway Section Switchstands, and 8x10 Brass Camera Tripod.

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
  expand,
  prove,
  build,
  setThresholdDoor,
  floorAt,
  isBlocked,
  SimpleOrbitControls as OrbitControls,
  SimpleLabelProjector,
} from './hdl-compiler.js';

const $ = (id) => document.getElementById(id);
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const urlParams = new URLSearchParams(window.location.search);

// Hydrate shared Severn Pilot state
const pilotInit = applyPilotUrlHash();

// Load local bundled upstream data
const [HD, LIB, ICONIC] = await Promise.all([
  fetch('./data/hdl.json').then((r) => r.json()),
  fetch('./data/library.json').then((r) => r.json()),
  fetch('./data/iconic.json').then((r) => r.json()),
]);

useLibrary(LIB, null);
new THREE.TextureLoader().load('./data/library.webp', (tex) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  useLibrary(LIB, tex);
  compileAllHeroes();
});

const PROOFS_BY_HERO = HD.heroes.map((h) => prove(h));

// ---------------------------------------------------------------------------
// Renderer, Sky Dome & Continuous Waterfront Street Promenade Environment
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

const labelRenderer = new SimpleLabelProjector($('beat-labels'));

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0c1f38');
scene.fog = new THREE.FogExp2('#152e4d', 0.0046);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 460);
camera.rotation.order = 'YXZ';

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.enabled = false;

const skyCanvas = document.createElement('canvas');
skyCanvas.width = 64;
skyCanvas.height = 256;
function paintSky(topHex, midHex, horHex) {
  const ctx = skyCanvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, topHex);
  g.addColorStop(0.56, midHex);
  g.addColorStop(1, horHex);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
}
paintSky('#0c1f38', '#2c6294', '#7ca0bc');
const skyTex = new THREE.CanvasTexture(skyCanvas);
skyTex.colorSpace = THREE.SRGBColorSpace;
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(320, 28, 18),
  new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false })
);
scene.add(skyDome);

const hemi = new THREE.HemisphereLight('#d6e8f8', '#5a493c', 1.38);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#ffe4c4', 2.65);
sun.position.set(-42, 56, -38);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -58, right: 64, top: 48, bottom: -48, near: 2, far: 210 });
sun.shadow.bias = -0.0004;
scene.add(sun);

const hitInvisibleMat = new THREE.MeshBasicMaterial({ visible: false });
const interactiveTargets = [];
function registerTarget(mesh, data) {
  mesh.userData.heroTarget = data;
  interactiveTargets.push(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Continuous Waterfront Street, Matte Granite Sidewalk, Quay Seawall & Harbor Slip
// (Restricts wet reflection strictly to wet street asphalt & harbor water per Brief 4)
// ---------------------------------------------------------------------------
function buildPromenadeEnvironment() {
  const env = new THREE.Group();
  const sz = 512;
  const col = document.createElement('canvas');
  col.width = col.height = sz;
  const c = col.getContext('2d');
  c.fillStyle = '#232931';
  c.fillRect(0, 0, sz, sz);
  for (let i = 0; i < 4000; i++) {
    const v = 30 + ((i * 17) % 22);
    c.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    c.fillRect((i * 83) % sz, (i * 149) % sz, 2, 2);
  }
  const rgh = document.createElement('canvas');
  rgh.width = rgh.height = sz;
  const r = rgh.getContext('2d');
  r.fillStyle = '#c4c4c4';
  r.fillRect(0, 0, sz, sz);
  for (let i = 0; i < 16; i++) {
    const px = ((i * 103 + 48) % (sz - 96)) + 48;
    const py = ((i * 157 + 48) % (sz - 96)) + 48;
    const rad = 32 + (i % 4) * 18;
    const grd = r.createRadialGradient(px, py, 2, px, py, rad);
    grd.addColorStop(0, 'rgba(14,14,14,0.95)');
    grd.addColorStop(0.7, 'rgba(68,68,68,0.5)');
    grd.addColorStop(1, 'rgba(196,196,196,0)');
    r.fillStyle = grd;
    r.beginPath();
    r.arc(px, py, rad, 0, Math.PI * 2);
    r.fill();
  }
  const roadMap = new THREE.CanvasTexture(col);
  roadMap.wrapS = roadMap.wrapT = THREE.RepeatWrapping;
  roadMap.repeat.set(16, 4);
  roadMap.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(rgh);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(16, 4);

  const graniteMat = new THREE.MeshStandardMaterial({ color: '#787166', roughness: 0.90, metalness: 0.01 });
  const curbMat = new THREE.MeshStandardMaterial({ color: '#9e9688', roughness: 0.84, metalness: 0.02 });
  const seawallMat = new THREE.MeshStandardMaterial({ color: '#5c5852', roughness: 0.88, metalness: 0.03 });
  const timberMat = new THREE.MeshStandardMaterial({ color: '#6b4d35', roughness: 0.76, metalness: 0.02 });
  const ironMat = new THREE.MeshStandardMaterial({ color: '#1f252c', roughness: 0.45, metalness: 0.72 });

  // 1. Open Harbor Water (South of Quay z < -15.4 AND East Pier Slip x > 36.2 directly beneath The Pier Cafe!)
  const harborWater = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 320),
    new THREE.MeshStandardMaterial({
      color: '#134664',
      roughness: 0.08,
      metalness: 0.42,
    })
  );
  harborWater.rotation.x = -Math.PI / 2;
  harborWater.position.set(12, -0.68, -24);
  harborWater.receiveShadow = true;
  env.add(harborWater);

  // 2. North Matte Granite Sidewalk & Urban Building Pad (x: -44 .. +36.2, z: -4.2 .. +38.0)
  const northPad = new THREE.Mesh(new THREE.BoxGeometry(80.2, 0.92, 42.2), graniteMat);
  northPad.position.set(-3.9, -0.47, 16.9);
  northPad.receiveShadow = true;
  env.add(northPad);

  const northCurb = new THREE.Mesh(new THREE.BoxGeometry(80.2, 0.16, 0.30), curbMat);
  northCurb.position.set(-3.9, 0.01, -4.15);
  northCurb.receiveShadow = true;
  env.add(northCurb);

  // Cyan municipal conduit line along North curb
  const cyanStrip = new THREE.Mesh(
    new THREE.BoxGeometry(80.0, 0.028, 0.095),
    new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 1.3, roughness: 0.2 })
  );
  cyanStrip.position.set(-3.9, 0.03, -3.88);
  env.add(cyanStrip);

  // 3. Wet Waterfront Street Asphalt (x: -44 .. +36.2, z: -12.2 .. -4.2)
  const roadFoundation = new THREE.Mesh(new THREE.BoxGeometry(80.2, 0.86, 8.0), seawallMat);
  roadFoundation.position.set(-3.9, -0.48, -8.2);
  env.add(roadFoundation);

  const wetRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(80.2, 8.0),
    new THREE.MeshStandardMaterial({
      map: roadMap,
      roughnessMap,
      roughness: 0.27,
      metalness: 0.25,
    })
  );
  wetRoad.rotation.x = -Math.PI / 2;
  wetRoad.position.set(-3.9, -0.04, -8.2);
  wetRoad.receiveShadow = true;
  env.add(wetRoad);

  // 4. South Harbor Quay Promenade & West Stone Belvedere Pier
  const southQuay = new THREE.Mesh(new THREE.BoxGeometry(80.2, 0.96, 3.4), graniteMat);
  southQuay.position.set(-3.9, -0.46, -13.9);
  southQuay.receiveShadow = true;
  env.add(southQuay);

  const southCoping = new THREE.Mesh(new THREE.BoxGeometry(80.4, 0.18, 0.36), curbMat);
  southCoping.position.set(-3.9, 0.04, -15.45);
  env.add(southCoping);

  const eastSeawallCoping = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 53.6), curbMat);
  eastSeawallCoping.position.set(36.1, 0.04, 11.2);
  env.add(eastSeawallCoping);

  // West Quay Stone Belvedere (walkable harbor overlook framing all 6 Hero Buildings!)
  const belvedere = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.96, 7.2), graniteMat);
  belvedere.position.set(-32.2, -0.46, -19.0);
  belvedere.receiveShadow = true;
  env.add(belvedere);

  const belvedereCoping = new THREE.Mesh(new THREE.BoxGeometry(15.8, 0.18, 0.36), curbMat);
  belvedereCoping.position.set(-32.2, 0.04, -22.5);
  env.add(belvedereCoping);

  // Cast-iron harbor bollards along the Quay seawall
  for (const bx of [-38, -32, -26, -18, -10, -2, 6, 14, 22, 30, 35.5]) {
    const bz = bx <= -25 ? -22.2 : -15.25;
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.58, 10), ironMat);
    bollard.position.set(bx, 0.31, bz);
    bollard.castShadow = true;
    env.add(bollard);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 8), ironMat);
    cap.position.set(bx, 0.60, bz);
    env.add(cap);
  }

  // 5. Timber Pier Boardwalk Gangway connecting North Sidewalk (x=35.5) over Harbor Water to The Pier Cafe Terrace (x=38.5..52.5)
  const gangway = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.16, 4.2), timberMat);
  deck.position.set(37.4, 0.18, -0.6);
  deck.rotation.z = 0.08;
  deck.castShadow = true;
  deck.receiveShadow = true;
  gangway.add(deck);
  for (const px of [36.8, 38.2]) {
    for (const pz of [-2.4, 1.2]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 2.2, 8), timberMat);
      pile.position.set(px, -0.45, pz);
      gangway.add(pile);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.95, 8), timberMat);
      post.position.set(px, 0.68, pz);
      gangway.add(post);
    }
  }
  env.add(gangway);

  // Distant WEAVE Relay Dish silhouette on the far horizon ridge
  const dishGroup = new THREE.Group();
  dishGroup.position.set(16, 26, 78);
  const mastMat = new THREE.MeshStandardMaterial({ color: '#182c46', roughness: 0.7, metalness: 0.4 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.1, 30, 10), mastMat);
  mast.position.y = -10;
  dishGroup.add(mast);
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(11.0, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42),
    new THREE.MeshStandardMaterial({ color: '#244162', roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide })
  );
  dish.rotation.x = -Math.PI * 0.62;
  dishGroup.add(dish);
  env.add(dishGroup);

  return { env, harborWater };
}
const promenadeEnv = buildPromenadeEnvironment();
scene.add(promenadeEnv.env);

// ---------------------------------------------------------------------------
// Siting Coordinates for All 6 Compiled HDL Hero Buildings Along the Promenade
// ---------------------------------------------------------------------------
const HERO_SITING = {
  severn: { ox: -32.0, oz: 0.0, residentName: 'Imani (Courier)', archetype: 'adult_f', coatHex: '#354457' },
  rowhouse: { ox: -9.5, oz: 0.0, residentName: 'Tadesse (Rowhouse Tenant)', archetype: 'adult_m', coatHex: '#6c4f3d' },
  clocktower: { ox: -2.0, oz: 0.5, residentName: 'Makeda (Timekeeper)', archetype: 'elder', coatHex: '#753e45' },
  chapel: { ox: 7.5, oz: 0.5, residentName: 'Miriam (Chapel Cantor)', archetype: 'adult_f', coatHex: '#3e5468' },
  marquee: { ox: 19.0, oz: 0.0, residentName: 'June (Cinema Usher)', archetype: 'child7', coatHex: '#c36539' },
  cafe: { ox: 38.5, oz: 2.0, residentName: 'Dawit (Pier Host)', archetype: 'adult_m', coatHex: '#8c5438' },
};

function getDoorX(H) {
  const d = (H.doors || []).find((x) => x.a === 'street' || x.b === 'street');
  const expH = expand(H);
  if (d) {
    const rid = d.a === 'street' ? d.b : d.a;
    const rm = expH.levels[0].rooms.find((r) => r.id === rid);
    if (d.at != null) return d.at;
    if (rm) return rm.x + rm.w / 2;
  }
  return H.footprint[0] / 2;
}

// ---------------------------------------------------------------------------
// Clothed 1.70m Anny V8 Threshold Residents Across All 6 Hero Buildings + Severn Parcel
// ---------------------------------------------------------------------------
const humanGroup = new THREE.Group();
scene.add(humanGroup);

const parcelMesh = new THREE.Group();
{
  const wrapBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.22, 0.25),
    new THREE.MeshStandardMaterial({ color: '#c89b62', roughness: 0.7 })
  );
  const twine = new THREE.Mesh(
    new THREE.BoxGeometry(0.33, 0.04, 0.26),
    new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 0.85 })
  );
  parcelMesh.add(wrapBox, twine);
}
scene.add(parcelMesh);

const scaleActors = [];
function createPromenadeResident({ id, heroIdx, name, archetype, coatHex, withStadiaRod = false }) {
  const root = new THREE.Group();
  humanGroup.add(root);

  const proxy = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.24, 0.88, 10),
    new THREE.MeshStandardMaterial({ color: coatHex, roughness: 0.76 })
  );
  body.position.y = 1.06;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#7b4c33', roughness: 0.65 })
  );
  head.position.y = 1.63;
  proxy.add(body, head);
  root.add(proxy);

  // Calibrated 1.70m surveyor stadia rod beside Severn exterior courier
  if (withStadiaRod) {
    const rod = new THREE.Group();
    rod.position.set(-0.55, 0, 0);
    for (let s = 0; s < 5; s++) {
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.34, 0.05),
        new THREE.MeshStandardMaterial({ color: s % 2 === 0 ? '#f2ede2' : '#18b4ff', roughness: 0.5 })
      );
      seg.position.y = s * 0.34 + 0.17;
      rod.add(seg);
    }
    root.add(rod);
  }

  const hitCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.86, 10), hitInvisibleMat);
  hitCyl.position.y = 0.93;
  registerTarget(hitCyl, {
    action: 'resident',
    heroIdx,
    residentId: id,
    name,
    anchor: new THREE.Vector3(0, 1.92, 0),
    isLocalAnchor: true,
    getWhisper: () =>
      id === 'severn-courier' || id === 'severn-keeper'
        ? `${name} (1.70m Anny V8) - click to hand off Severn parcel`
        : `${name} at ${HD.heroes[heroIdx]?.name || 'Threshold'} - click to speak`,
  });
  root.add(hitCyl);

  const entry = { id, heroIdx, name, root, proxy, v8: null };
  scaleActors.push(entry);

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
      initialClip: 'idle',
    })
      .then((inst) => {
        if (!inst) return;
        inst.root.position.set(0, 0, 0);
        root.add(inst.root);
        proxy.visible = false;
        entry.v8 = inst;
        inst.setGroundY(0);
      })
      .catch((err) => {
        console.warn('Anny V8 load error:', err);
      });
  }
  return entry;
}

const residentByHeroIdx = HD.heroes.map((h, idx) => {
  const site = HERO_SITING[h.id] || { residentName: 'Resident', archetype: 'adult_f', coatHex: '#354457' };
  return createPromenadeResident({
    id: h.id === 'severn' ? 'severn-courier' : `res-${h.id}`,
    heroIdx: idx,
    name: site.residentName,
    archetype: site.archetype,
    coatHex: site.coatHex,
    withStadiaRod: h.id === 'severn',
  });
});

const severnIdx = Math.max(0, HD.heroes.findIndex((h) => h.id === 'severn'));
const severnKeeperActor = createPromenadeResident({
  id: 'severn-keeper',
  heroIdx: severnIdx,
  name: 'Bekele (Severn Keeper)',
  archetype: 'adult_m',
  coatHex: '#8c5438',
  withStadiaRod: false,
});

// ---------------------------------------------------------------------------
// 3D In-World Brass Sundial Lamp Posts (Poem Hour <-> Raw Neutral Daylight)
// & 3D Cutaway Section Switchstands beside Every Hero Building
// ---------------------------------------------------------------------------
const sundialPosts = [];
function buildBrassSundialLampPost(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const castIronMat = new THREE.MeshStandardMaterial({ color: '#1d242c', roughness: 0.46, metalness: 0.72 });
  const brassMat = new THREE.MeshStandardMaterial({
    color: '#dcb468',
    roughness: 0.25,
    metalness: 0.86,
    emissive: '#3a290c',
    emissiveIntensity: 0.16,
  });
  const lanternMat = new THREE.MeshStandardMaterial({
    color: '#fff4d8',
    emissive: '#ffb85c',
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.28, 12), castIronMat);
  plinth.position.y = 0.14;
  plinth.castShadow = true;
  g.add(plinth);

  const lowerPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.86, 12), castIronMat);
  lowerPost.position.y = 0.70;
  lowerPost.castShadow = true;
  g.add(lowerPost);

  // Waist-high Engraved Brass Sundial Table & Rotating Gnomon Arm (y = 1.12m)
  const dialPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.06, 24), brassMat);
  dialPlate.position.y = 1.12;
  dialPlate.castShadow = true;
  g.add(dialPlate);

  const compassRing = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.016, 8, 24), brassMat);
  compassRing.rotation.x = Math.PI / 2;
  compassRing.position.y = 1.155;
  g.add(compassRing);

  const gnomonPivot = new THREE.Group();
  gnomonPivot.position.y = 1.16;
  const gnomonFin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.18, 0.24), brassMat);
  gnomonFin.position.set(0, 0.09, -0.04);
  gnomonFin.rotation.x = -0.35;
  gnomonPivot.add(gnomonFin);
  g.add(gnomonPivot);

  // Upper Lamp Post & Warm Glass Lantern
  const upperPost = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 2.45, 10), castIronMat);
  upperPost.position.y = 2.42;
  upperPost.castShadow = true;
  g.add(upperPost);

  const brassCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.09, 0.12, 12), brassMat);
  brassCollar.position.y = 3.68;
  g.add(brassCollar);

  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), lanternMat);
  globe.position.y = 3.92;
  g.add(globe);

  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 4.1, 10), hitInvisibleMat);
  hit.position.y = 2.05;
  registerTarget(hit, {
    action: 'toggle-daylight',
    anchor: new THREE.Vector3(0, 1.65, 0),
    isLocalAnchor: true,
    getWhisper: () =>
      rawDaylight
        ? 'Brass Sundial Lamp Post (Raw Neutral Daylight) - click for Authored Poem Hour'
        : 'Brass Sundial Lamp Post (Authored Poem Hour) - click for Raw Neutral Daylight Audit',
  });
  g.add(hit);

  scene.add(g);
  const postEntry = { group: g, gnomonPivot, lanternMat };
  sundialPosts.push(postEntry);
  return postEntry;
}

// Place 3 Brass Sundial Lamp Posts along the Promenade (West Quay foreground, Clock Tower Square, East Pier Slip)
buildBrassSundialLampPost(-30.8, 0.02, -15.2);
buildBrassSundialLampPost(1.5, 0.0, -3.55);
buildBrassSundialLampPost(35.2, 0.0, -3.55);

const cutawayLevers = [];
function buildCutawaySwitchstand({ x, y, z, heroIdx, isMaster = false }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const ironMat = new THREE.MeshStandardMaterial({ color: '#1d242c', roughness: 0.48, metalness: 0.72 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#ddb66c', roughness: 0.26, metalness: 0.85 });
  const cyanGripMat = new THREE.MeshStandardMaterial({
    color: '#18b4ff',
    emissive: '#18b4ff',
    emissiveIntensity: 1.15,
    roughness: 0.2,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.34), ironMat);
  base.position.y = 0.04;
  base.castShadow = true;
  g.add(base);

  // Notched brass quadrant arc
  const quadArc = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.022, 8, 18, Math.PI * 0.75), brassMat);
  quadArc.position.set(0, 0.38, 0);
  quadArc.rotation.z = Math.PI * 0.125;
  g.add(quadArc);

  const stanchion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.12), ironMat);
  stanchion.position.y = 0.24;
  g.add(stanchion);

  // Throwable Brass Section Lever Arm
  const armPivot = new THREE.Group();
  armPivot.position.set(0, 0.38, 0);
  armPivot.rotation.z = -0.38;

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.76, 10), brassMat);
  shaft.position.y = 0.38;
  shaft.castShadow = true;
  armPivot.add(shaft);

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.16, 12), cyanGripMat);
  grip.position.y = 0.78;
  armPivot.add(grip);

  // Miniature section-cut icon plate on lever
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.02), brassMat);
  flag.position.set(0.11, 0.56, 0);
  armPivot.add(flag);

  g.add(armPivot);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.35, 0.68), hitInvisibleMat);
  hit.position.y = 0.68;
  registerTarget(hit, {
    action: 'cutaway-lever',
    heroIdx,
    isMaster,
    anchor: new THREE.Vector3(0, 1.32, 0),
    isLocalAnchor: true,
    getWhisper: () => {
      const targetIdx = isMaster ? activeHeroIdx : heroIdx;
      const st = heroPlacements[targetIdx];
      const name = HD.heroes[targetIdx]?.name || 'Hero Building';
      const modeLabel =
        st?.cutMode === 1
          ? 'Front Wall Lifted'
          : st?.cutMode === 2
            ? 'Mid-Storey Slice + Mass'
            : 'Intact Facade';
      return `Section Cutaway Lever: ${name} (${modeLabel}) - click to slice walls & storeys`;
    },
  });
  g.add(hit);

  scene.add(g);
  const entry = { group: g, armPivot, gripMat: cyanGripMat, heroIdx, isMaster };
  cutawayLevers.push(entry);
  return entry;
}

// Foreground Master Section Switchstand on West Quay + Individual Switchstand beside every Hero Building!
buildCutawaySwitchstand({ x: -28.8, y: 0.02, z: -15.6, heroIdx: severnIdx, isMaster: true });
HD.heroes.forEach((h, idx) => {
  const site = HERO_SITING[h.id];
  const lx = h.id === 'cafe' ? 37.8 : site.ox - 0.85;
  const lz = h.id === 'cafe' ? -1.8 : -2.35;
  const ly = h.id === 'cafe' ? 0.28 : 0.0;
  buildCutawaySwitchstand({ x: lx, y: ly, z: lz, heroIdx: idx, isMaster: false });
});

// ---------------------------------------------------------------------------
// State, Compilation of All 6 HDL Hero Buildings & Lighting Audit Pass
// ---------------------------------------------------------------------------
let activeHeroIdx = severnIdx;
const explicitHeroParam = urlParams.get('h');
if (explicitHeroParam) {
  const found = HD.heroes.findIndex((h) => h.id === explicitHeroParam);
  if (found >= 0) activeHeroIdx = found;
} else if (pilotInit.building) {
  const found = HD.heroes.findIndex((h) => h.id === pilotInit.building);
  if (found >= 0) activeHeroIdx = found;
}

let rawDaylight = !!pilotInit.rawDaylight;
let savedLookBeforeRaw = pilotInit.shader || 'weave';
let severnDoorOpen = pilotInit.doorOpen !== false;
let parcelHolder = pilotInit.parcelHolder || 'player';
let parcelLerp = parcelHolder === 'bekele' ? 1 : 0;
let activeInspTab = 'checklist';
let repMode = 'resolved';
let beatsVisible = false;
let currentNightMix = 0.72;

const checklistStatus = { material: true, aura: true, collider: true, scale: true };

// Compiled Hero Placements Array (all 6 in scene simultaneously!)
const heroesRoot = new THREE.Group();
scene.add(heroesRoot);
let heroPlacements = [];
let heroLights = [];

const suite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: rawDaylight ? 'natural' : savedLookBeforeRaw,
  locationName: 'Waterfront Hero Promenade (All 6 HDL Buildings)',
  cartridgeName: 'heroes',
  onTimeChange: (key, preset) => {
    currentNightMix = preset.audioNightMix;
    if (!rawDaylight) {
      paintSky(preset.skyTop, preset.skyMid, preset.skyHorizon);
      skyTex.needsUpdate = true;
      scene.fog.color.set(preset.skyMid);
      scene.fog.density = Math.min(0.0048, preset.fogDensity);
      sun.intensity = preset.sunIntensity;
      sun.color.set(preset.sunColor);
      hemi.intensity = preset.hemiIntensity;
    }
  },
});

// Spawn Physical 3D 8x10 Brass Camera Tripod on the West Quay Belvedere + Stone Portals
const worldRig = createWorldPortalAndTripod({
  THREE,
  scene,
  camera,
  domElement: renderer.domElement,
  suite,
  tripodPos: { x: -26.8, y: 0.02, z: -16.2, rotY: Math.PI + 0.72 },
  portals: [
    {
      id: 'foundry',
      label: 'Foundry & Inverse Tomology',
      href: '../foundry/',
      pos: [-36.8, 0, -2.2],
      rotY: Math.PI / 2,
    },
    {
      id: 'island',
      label: 'Make-Photo Harbor Island',
      href: '../island/',
      pos: [34.2, 0, -13.8],
      rotY: -Math.PI / 2,
    },
  ],
});

function compileAllHeroes() {
  // Remove previous hero hit targets
  for (let i = interactiveTargets.length - 1; i >= 0; i--) {
    const act = interactiveTargets[i].userData.heroTarget?.action;
    if (act === 'hero-door' || act === 'hero-facade') {
      interactiveTargets.splice(i, 1);
    }
  }
  while (heroesRoot.children.length) heroesRoot.remove(heroesRoot.children[0]);

  const prevStates = heroPlacements.map((p) => ({
    doorOpen: p.doorOpen,
    cutMode: p.cutMode,
    stationCycle: p.stationCycle,
  }));

  heroPlacements = HD.heroes.map((h, idx) => {
    const site = HERO_SITING[h.id] || { ox: idx * 18 - 30, oz: 0 };
    const isSevern = h.id === 'severn';
    const dOpen = isSevern ? severnDoorOpen : prevStates[idx]?.doorOpen ?? true;
    const cutMode = prevStates[idx]?.cutMode ?? 0; // 0: intact, 1: lift front wall, 2: mid-storey slice + mass
    const stationCycle = prevStates[idx]?.stationCycle ?? 0;

    const built = build(h, { state: 'intact', doorOpen: dOpen });
    built.group.position.set(site.ox, 0, site.oz);
    built.mass.position.set(site.ox, 0, site.oz);
    heroesRoot.add(built.group, built.mass);

    const [W, D] = h.footprint;
    const doorX = getDoorX(h);
    const baseZ = h.levels[0]?.z || 0;

    // Position clothed 1.70m Anny V8 threshold resident
    const res = residentByHeroIdx[idx];
    if (res) {
      const extLocalY = h.id === 'cafe' ? -2.1 : -1.85;
      const extFloor = floorAt(built, doorX - 1.25, extLocalY, baseZ);
      res.root.position.set(site.ox + doorX - 1.25, extFloor, site.oz + extLocalY);
      res.root.rotation.y = 0.24;
    }
    if (isSevern && severnKeeperActor) {
      const intFloor = floorAt(built, doorX + 0.55, 1.55, baseZ);
      severnKeeperActor.root.position.set(site.ox + doorX + 0.55, intFloor, site.oz + 1.55);
      severnKeeperActor.root.rotation.y = Math.PI - 0.18;
    }

    // 1. Operable 3D Doorway Hitbox
    const doorHit = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.8, 1.1), hitInvisibleMat);
    doorHit.position.set(site.ox + doorX, baseZ + 1.4, site.oz);
    registerTarget(doorHit, {
      action: 'hero-door',
      heroIdx: idx,
      anchor: new THREE.Vector3(site.ox + doorX, baseZ + 2.6, site.oz - 0.3),
      getWhisper: () => {
        const p = heroPlacements[idx];
        return `${h.name} Door (${p?.doorOpen ? 'Open' : 'Closed'}) - click to glide or swing door`;
      },
    });
    heroesRoot.add(doorHit);

    // 2. Full Hero Building Facade & Interior Volume Hitbox
    const bldgHeight = Math.max(4.5, built.top + (h.roof?.rise || 0));
    const facadeHit = new THREE.Mesh(new THREE.BoxGeometry(W, bldgHeight, D), hitInvisibleMat);
    facadeHit.position.set(site.ox + W / 2, bldgHeight / 2, site.oz + D / 2);
    registerTarget(facadeHit, {
      action: 'hero-facade',
      heroIdx: idx,
      anchor: new THREE.Vector3(site.ox + W / 2, Math.min(12.5, bldgHeight * 0.65 + 1.2), site.oz - 0.4),
      getWhisper: () =>
        `${h.name} (Poem ${h.poem}, ${W}x${D}m, ${h.levels.length}F) - click to glide to threshold or step inside`,
    });
    heroesRoot.add(facadeHit);

    const placement = {
      idx,
      hero: h,
      built,
      ox: site.ox,
      oz: site.oz,
      w: W,
      d: D,
      doorX,
      baseZ,
      doorOpen: dOpen,
      doorAnimRot: dOpen ? -1.18 : 0,
      cutMode,
      stationCycle,
    };
    applyHeroCutaway(placement);
    return placement;
  });

  syncPromenadeLights();
  applyLightingPass();
  renderInspectorContent();
}

function applyHeroCutaway(p) {
  if (!p || !p.built) return;
  const L = p.hero.levels.length;
  const liftFront = p.cutMode === 1;
  const sliceMid = p.cutMode === 2;
  const maxLv = sliceMid ? Math.max(0, Math.ceil(L * 0.5) - 1) : L - 1;

  p.built.group.visible = repMode !== 'mass';
  p.built.mass.visible = sliceMid || repMode !== 'resolved';
  p.built.mass.children.forEach((m) => {
    m.material.opacity = repMode === 'mass' ? 0.72 : 0.36;
    m.visible = (m.userData.room?.level ?? 0) <= maxLv;
  });

  p.built.levels.forEach((lg, k) => {
    lg.visible = k <= maxLv;
    lg.traverse((o) => {
      if (o.userData.wall) {
        o.visible = !(liftFront && o.userData.wall.ext && o.userData.wall.side === 'front');
      }
      if (o.userData.ceiling) {
        o.visible = !liftFront && (!sliceMid || k < maxLv);
      }
    });
  });
  p.built.stairs.children.forEach((sg) => {
    sg.visible = sg.userData.level <= maxLv;
  });
  p.built.roof.visible = !liftFront && !sliceMid;
  p.built.ext.visible = !liftFront;

  // Sync physical 3D Cutaway Switchstand lever angles
  for (const lv of cutawayLevers) {
    const targetIdx = lv.isMaster ? activeHeroIdx : lv.heroIdx;
    if (targetIdx === p.idx) {
      const targetAngle = p.cutMode === 0 ? -0.38 : p.cutMode === 1 ? 0.0 : 0.42;
      lv.armPivot.rotation.z = targetAngle;
      lv.gripMat.color.set(p.cutMode === 0 ? '#18b4ff' : p.cutMode === 1 ? '#ffb85c' : '#ff5868');
      lv.gripMat.emissive.set(p.cutMode === 0 ? '#18b4ff' : p.cutMode === 1 ? '#ffb85c' : '#ff3848');
    }
  }
}

function syncPromenadeLights() {
  heroLights.forEach((l) => scene.remove(l));
  heroLights = [];
  if (!heroPlacements.length) return;

  const auraSignatures = {
    severn: [0xff3848, 15, 0.35, 3.8, -0.9],
    rowhouse: [0xffcb88, 10, 3.5, 2.6, -0.8],
    clocktower: [0xffe0a0, 14, 3.5, 13.5, -1.2],
    chapel: [0x9c78ff, 12, 4.5, 4.2, -0.8],
    marquee: [0xffb858, 18, 8.0, 4.2, -1.5],
    cafe: [0xffc880, 14, 7.0, 2.8, -1.6],
  };

  for (const p of heroPlacements) {
    // 1. Warm interior / threshold spill light
    const spillInten = rawDaylight ? 1.5 : p.doorOpen ? 15 : 5;
    const spill = new THREE.PointLight(0xffcb88, spillInten, 13, 1.5);
    spill.position.set(p.ox + p.doorX, p.baseZ + 2.35, p.oz + 1.2);
    scene.add(spill);
    heroLights.push(spill);

    // 2. Fixture-bound exterior signature light (disabled in Raw Neutral Daylight audit per Brief 4!)
    if (!rawDaylight) {
      const sig = auraSignatures[p.hero.id];
      if (sig) {
        const [col, inten, lx, ly, lz] = sig;
        const pl = new THREE.PointLight(col, inten, 15, 1.6);
        pl.position.set(p.ox + lx, ly, p.oz + lz);
        scene.add(pl);
        heroLights.push(pl);
      }
    }
  }
}

let inLightingApply = false;
function applyLightingPass() {
  if (inLightingApply) return;
  inLightingApply = true;
  try {
    $('btn-grade-poem')?.classList.toggle('cyan-act', !rawDaylight);
    $('btn-grade-raw')?.classList.toggle('cyan-act', rawDaylight);

    const st = suite.getState();
    if (rawDaylight && st.lookId && st.lookId !== 'natural') {
      savedLookBeforeRaw = st.lookId;
    }
    const targetLook = rawDaylight ? 'natural' : savedLookBeforeRaw || 'weave';
    savePilotState({ rawDaylight, shader: targetLook });
    suite.setLook(targetLook, false, false);

    if (rawDaylight) {
      paintSky('#7fa4c4', '#b4cadc', '#dce4e8');
      skyTex.needsUpdate = true;
      scene.fog.color.set('#b8ccd8');
      scene.fog.density = 0.0016;
      sun.color.set('#ffffff');
      sun.intensity = 3.15;
      hemi.color.set('#eef4fa');
      hemi.groundColor.set('#6e6860');
      hemi.intensity = 1.68;
    } else {
      const p = suite.timePresets[st.timeOfDay] || suite.timePresets.bluehour;
      paintSky(p.skyTop, p.skyMid, p.skyHorizon);
      skyTex.needsUpdate = true;
      scene.fog.color.set(p.skyMid);
      scene.fog.density = Math.min(0.0048, p.fogDensity);
      sun.color.set(p.sunColor);
      sun.intensity = p.sunIntensity;
      hemi.intensity = p.hemiIntensity;
    }

    // Rotate 3D Brass Sundial gnomon arms & dim street lanterns in Raw Daylight
    for (const sp of sundialPosts) {
      sp.gnomonPivot.rotation.y = rawDaylight ? 0.0 : Math.PI * 0.65;
      sp.lanternMat.emissiveIntensity = rawDaylight ? 0.15 : 2.25;
    }

    syncPromenadeLights();
  } finally {
    inLightingApply = false;
  }
}

// ---------------------------------------------------------------------------
// Walkable Multi-Building Promenade State, Collision & Smooth Glides
// ---------------------------------------------------------------------------
// Default opening vista on the West Quay Stone Belvedere framing ALL 6 Hero Buildings + Harbor Water!
const PROMENADE_VISTA = {
  wx: -35.4,
  wz: -20.6,
  z: 0.02,
  yaw: Math.PI + 0.78,
  pitch: 0.09,
};

const walkState = {
  wx: PROMENADE_VISTA.wx,
  wz: PROMENADE_VISTA.wz,
  z: PROMENADE_VISTA.z,
  yaw: PROMENADE_VISTA.yaw,
  pitch: PROMENADE_VISTA.pitch,
  insideHeroIdx: -1,
};

let glideAnim = null;

function shortestAngleDelta(from, to) {
  let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function glidePlayerTo(wx, wz, z, yaw, pitch, dur = 0.65) {
  orbit.enabled = false;
  camera.fov = 50;
  camera.updateProjectionMatrix();
  glideAnim = {
    t: 0,
    dur,
    from: { wx: walkState.wx, wz: walkState.wz, z: walkState.z, yaw: walkState.yaw, pitch: walkState.pitch },
    to: {
      wx,
      wz,
      z,
      yaw: walkState.yaw + shortestAngleDelta(walkState.yaw, yaw),
      pitch,
    },
  };
}

function worldFloorAt(wx, wz, curZ) {
  // Check each Hero Building footprint + front stoop/terrace apron
  for (const p of heroPlacements) {
    if (wx >= p.ox - 0.5 && wx <= p.ox + p.w + 0.5 && wz >= p.oz - 4.5 && wz <= p.oz + p.d + 2.0) {
      const lx = wx - p.ox;
      const ly = wz - p.oz;
      if (lx >= 0 && lx <= p.w && ly >= -4.2 && ly <= p.d) {
        return floorAt(p.built, lx, ly, curZ);
      }
    }
  }
  // Timber Pier Boardwalk Gangway ramp (x: 35.0..38.8, z: -3.2..1.8 -> rises smoothly 0.0m to 0.40m)
  if (wx >= 35.0 && wx <= 38.8 && wz >= -3.2 && wz <= 2.0) {
    const t = Math.max(0, Math.min(1, (wx - 35.2) / 3.3));
    return t * 0.40;
  }
  // West Quay Belvedere & South Quay
  if (wz < -12.2) return 0.02;
  // Wet street bed
  if (wz < -4.2) return -0.04;
  return 0.0;
}

function worldIsBlocked(wx0, wz0, wx1, wz1, curZ) {
  // Seawall water boundaries (keep walker on dry land, quay, belvedere, gangway, or Pier Cafe!)
  const onBelvedere = wx1 >= -39.4 && wx1 <= -24.8 && wz1 >= -22.2 && wz1 <= -15.0;
  const onQuayOrRoadOrPad = wx1 >= -43.5 && wx1 <= 36.0 && wz1 >= -15.1 && wz1 <= 37.5;
  const onGangway = wx1 >= 34.8 && wx1 <= 39.0 && wz1 >= -3.0 && wz1 <= 2.2;
  const cafeP = heroPlacements.find((p) => p.hero.id === 'cafe');
  const onPierCafe =
    cafeP &&
    wx1 >= cafeP.ox - 0.2 &&
    wx1 <= cafeP.ox + cafeP.w + 0.2 &&
    wz1 >= cafeP.oz - 3.9 &&
    wz1 <= cafeP.oz + cafeP.d + 0.2;

  if (!onBelvedere && !onQuayOrRoadOrPad && !onGangway && !onPierCafe) {
    return true;
  }

  // Building wall & closed-door collisions across all 6 Hero Buildings
  for (const p of heroPlacements) {
    if (
      wx1 >= p.ox - 0.6 &&
      wx1 <= p.ox + p.w + 0.6 &&
      wz1 >= p.oz - 0.6 &&
      wz1 <= p.oz + p.d + 0.6
    ) {
      if (isBlocked(p.built, wx0 - p.ox, wz0 - p.oz, wx1 - p.ox, wz1 - p.oz, curZ)) {
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// In-World Inspection Actions (Click Building, Door, Sundial, Cutaway Lever, Resident)
// ---------------------------------------------------------------------------
function setActiveHeroMeta(idx) {
  activeHeroIdx = idx;
  const h = HD.heroes[idx];
  if (!h) return;
  if ($('hero-title')) {
    $('hero-title').textContent = `${h.name} - Poem ${h.poem} (${h.landmark})`;
    $('hero-note').textContent = `${h.footprint[0]} x ${h.footprint[1]} m - ${h.levels.length} level(s) - ${h.note}`;
  }
  document.querySelectorAll('.hero-btn').forEach((b, k) => b.classList.toggle('active', k === idx));
  savePilotState({ building: h.id, poem: h.poem });
  renderInspectorContent();
  // Sync master cutaway lever to newly selected hero
  const p = heroPlacements[idx];
  if (p) applyHeroCutaway(p);
}

function applyHeroCameraStation(idx, station) {
  const p = heroPlacements[idx];
  if (!p) return;
  setActiveHeroMeta(idx);

  document.querySelectorAll('#cam-stations .pill').forEach((b) => b.classList.toggle('active', b.dataset.cam === station));

  if (station === 'promenade') {
    glidePlayerTo(PROMENADE_VISTA.wx, PROMENADE_VISTA.wz, PROMENADE_VISTA.z, PROMENADE_VISTA.yaw, PROMENADE_VISTA.pitch);
    showActionWhisper('Waterfront Promenade Vista (All 6 HDL Heroes)', new THREE.Vector3(-12, 5.5, 0));
    return;
  }

  const expH = expand(p.hero);
  const targetLv = expH.levels[Math.min(2, expH.levels.length - 1)];
  const occRoom =
    targetLv.rooms.find((r) => r.id === 'f2a') ||
    targetLv.rooms.find((r) => ['home', 'assembly', 'cafe', 'shop'].includes(r.use)) ||
    targetLv.rooms[0];

  if (station === 'threshold') {
    const tz = p.hero.id === 'cafe' ? p.oz - 3.4 : p.oz - 4.4;
    const fz = worldFloorAt(p.ox + p.doorX - 0.25, tz, p.baseZ);
    glidePlayerTo(p.ox + p.doorX - 0.25, tz, fz, Math.PI, 0.05);
    showActionWhisper(
      `${p.hero.name} Threshold (1.65m Eye Height) - click again to step inside`,
      new THREE.Vector3(p.ox + p.doorX, p.baseZ + 2.5, p.oz)
    );
  } else if (station === 'standing' && occRoom) {
    // Ensure all storeys visible when stepping inside upper room
    if (p.cutMode !== 0) {
      p.cutMode = 0;
      applyHeroCutaway(p);
    }
    const wx = p.ox + occRoom.x + occRoom.w * 0.35;
    const wz = p.oz + occRoom.y + occRoom.d * 0.65;
    glidePlayerTo(wx, wz, occRoom.z, 0.25, -0.04);
    showActionWhisper(
      `Inside ${p.hero.name}: ${occRoom.name} (Standing 1.65m)`,
      new THREE.Vector3(wx, occRoom.z + 1.8, wz)
    );
  } else if (station === 'seated' && occRoom) {
    const wx = p.ox + occRoom.x + occRoom.w * 0.52;
    const wz = p.oz + occRoom.y + occRoom.d * 0.58;
    glidePlayerTo(wx, wz, Math.max(0, occRoom.z - 0.47), 0.0, -0.02);
    showActionWhisper(`Inside ${p.hero.name}: ${occRoom.name} (Seated 1.18m)`, new THREE.Vector3(wx, occRoom.z + 1.3, wz));
  } else if (station === 'window-out' && occRoom) {
    const wx = p.ox + occRoom.x + occRoom.w * 0.5;
    const wz = p.oz + occRoom.y + 1.45;
    glidePlayerTo(wx, wz, occRoom.z, 0.0, -0.06);
    showActionWhisper(
      `${p.hero.name}: Looking Out ${occRoom.name} Window -> Waterfront Street`,
      new THREE.Vector3(wx, occRoom.z + 1.6, p.oz - 1.5)
    );
  }
}

function onHeroDoorClicked(idx) {
  const p = heroPlacements[idx];
  if (!p) return;
  const dist = Math.hypot(walkState.wx - (p.ox + p.doorX), walkState.wz - p.oz);
  if (dist > 8.5) {
    p.stationCycle = 1;
    applyHeroCameraStation(idx, 'threshold');
    return;
  }
  toggleHeroDoor(idx);
}

function toggleHeroDoor(idx = activeHeroIdx) {
  const p = heroPlacements[idx];
  if (!p) return;
  p.doorOpen = !p.doorOpen;
  p.built.doorOpen = p.doorOpen;
  if (p.hero.id === 'severn') {
    severnDoorOpen = p.doorOpen;
    suite.audio?.setDoorOpen?.(severnDoorOpen, true);
    savePilotState({ doorOpen: severnDoorOpen });
  } else {
    suite.audio?.playDoorTransition?.(p.doorOpen);
  }
  syncPromenadeLights();
  updateBottomReadout();
  showActionWhisper(
    `${p.hero.name} Door ${p.doorOpen ? 'Open (13.5 kHz Air)' : 'Closed (580 Hz Muffled)'}`,
    new THREE.Vector3(p.ox + p.doorX, p.baseZ + 2.3, p.oz)
  );
}

function onHeroFacadeClicked(idx) {
  const p = heroPlacements[idx];
  if (!p) return;
  const distToDoor = Math.hypot(walkState.wx - (p.ox + p.doorX), walkState.wz - (p.oz - 3.5));
  if (activeHeroIdx !== idx && distToDoor > 9.0) {
    p.stationCycle = 1;
    applyHeroCameraStation(idx, 'threshold');
    return;
  }
  const order = ['threshold', 'standing', 'window-out', 'promenade'];
  const stName = order[p.stationCycle % order.length];
  p.stationCycle = (p.stationCycle + 1) % order.length;
  applyHeroCameraStation(idx, stName);
}

function toggleDaylightInWorld(anchorVec) {
  rawDaylight = !rawDaylight;
  applyLightingPass();
  updateBottomReadout();
  suite.audio?.playDoorTransition?.(!rawDaylight);
  showActionWhisper(
    rawDaylight
      ? 'Raw Neutral Daylight Audit (Unlit Albedo & Roughness, Fixture Glows Off)'
      : 'Authored Poem Hour (Fixture-Bound Auras & Wet Street Specular)',
    anchorVec || new THREE.Vector3(-30.8, 2.2, -15.2),
    2800
  );
}

function cycleCutawayLever(idx, isMaster, anchorVec) {
  const targetIdx = isMaster ? activeHeroIdx : idx;
  const p = heroPlacements[targetIdx];
  if (!p) return;
  setActiveHeroMeta(targetIdx);
  p.cutMode = (p.cutMode + 1) % 3;
  applyHeroCutaway(p);
  suite.audio?.playDoorTransition?.(true);
  const desc =
    p.cutMode === 1
      ? `${p.hero.name}: Front Wall Lifted (Floor Slabs, Mullions & Stair Headroom)`
      : p.cutMode === 2
        ? `${p.hero.name}: Mid-Storey Section Slice + Room-Use Volumes`
        : `${p.hero.name}: Intact Resolved Architecture Restored`;
  showActionWhisper(desc, anchorVec || new THREE.Vector3(p.ox + p.w / 2, 4.2, p.oz), 2800);
}

function onResidentClicked(td) {
  if (td.residentId === 'severn-courier' || td.residentId === 'severn-keeper') {
    parcelHolder = parcelHolder === 'player' ? 'bekele' : 'player';
    savePilotState({ parcelHolder });
    updateBottomReadout();
    const speaker = parcelHolder === 'bekele' ? 'Bekele' : 'Imani';
    const line =
      parcelHolder === 'bekele'
        ? 'Bekele: "Parcel logged inside The Severn lobby. All six promenade doors stand ready."'
        : 'Imani: "Parcel returned to courier satchel along the harbor promenade."';
    suite.speakLine(speaker, line, parcelHolder === 'bekele' ? 0.94 : 1.04);
    const act = parcelHolder === 'bekele' ? severnKeeperActor : residentByHeroIdx[severnIdx];
    showActionWhisper(line, act.root.position.clone().add(new THREE.Vector3(0, 2.0, 0)), 3200);
    return;
  }

  const h = HD.heroes[td.heroIdx];
  const res = residentByHeroIdx[td.heroIdx];
  setActiveHeroMeta(td.heroIdx);
  const poemWords = (ICONIC.words || []).filter((w) => w.poem === h.poem).map((w) => w.t);
  const verse = poemWords[0] || h.note;
  const spoken = `${td.name}: "${verse}"`;
  suite.speakLine(td.name, verse, 1.0);
  if (res) {
    showActionWhisper(spoken, res.root.position.clone().add(new THREE.Vector3(0, 2.0, 0)), 3200);
  }
}

// ---------------------------------------------------------------------------
// World-Projected 1-Line Diegetic Whisper (Unboxed, Hover or Transient Action)
// ---------------------------------------------------------------------------
let hoveredTarget = null;
let actionWhisper = null;
const _whisperVec = new THREE.Vector3();

function showActionWhisper(text, worldVec3, ms = 2500) {
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
      const td = hoveredTarget.object.userData.heroTarget;
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
  whisperEl.style.left = `${Math.max(140, Math.min(window.innerWidth - 140, proj.x))}px`;
  whisperEl.style.top = `${Math.max(28, Math.min(window.innerHeight - 24, proj.y))}px`;
}

// ---------------------------------------------------------------------------
// Optional Raw Audit Drawer Sync (Hidden on load; summoned only via Tab)
// ---------------------------------------------------------------------------
function renderRoster() {
  if (!$('hero-list')) return;
  $('hero-list').innerHTML = HD.heroes
    .map((h, i) => {
      const pr = PROOFS_BY_HERO[i];
      const warns = pr.filter((x) => x.state === 'WARN').length;
      return `<button class="hero-btn ${i === activeHeroIdx ? 'active' : ''}" data-idx="${i}" type="button">
        <div class="hb-top">
          <span>${h.name}</span>
          <span class="${warns ? 'badge-warn' : 'badge-pass'}">${warns ? warns + ' WARN' : '15 PASS'}</span>
        </div>
        <div class="hb-sub">Poem ${h.poem} - ${h.footprint[0]}x${h.footprint[1]}m - ${h.levels.length}F</div>
      </button>`;
    })
    .join('');
  $('hero-list').querySelectorAll('.hero-btn').forEach((b) => {
    b.addEventListener('click', () => applyHeroCameraStation(+b.dataset.idx, 'threshold'));
  });
}

function renderInspectorContent() {
  const box = $('insp-content');
  if (!box) return;
  const curHero = HD.heroes[activeHeroIdx];
  const p = heroPlacements[activeHeroIdx];
  const built = p?.built;
  const proofs = PROOFS_BY_HERO[activeHeroIdx] || [];
  if (activeInspTab === 'checklist') {
    box.innerHTML = `
      <label class="check-item">
        <input type="checkbox" data-chk="material" ${checklistStatus.material ? 'checked' : ''}>
        <div>
          <b>1. Shader &amp; Metre-Scale Material Audit</b>
          <span>Skin: ${curHero.skin.wall} (rough 0.84), trim: ${curHero.skin.trim}. Click any 3D Brass Sundial Post to toggle Raw Daylight.</span>
        </div>
      </label>
      <label class="check-item">
        <input type="checkbox" data-chk="aura" ${checklistStatus.aura ? 'checked' : ''}>
        <div>
          <b>2. Fixture-Bound Aura &amp; Wet-Only Reflection</b>
          <span>${built ? built.fixtures.length : 0} physical fixtures; wet specular restricted strictly to street asphalt &amp; harbor water.</span>
        </div>
      </label>
      <label class="check-item">
        <input type="checkbox" data-chk="collider" ${checklistStatus.collider ? 'checked' : ''}>
        <div>
          <b>3. Walkable Interior, Stairs &amp; Door Collider</b>
          <span>${built ? built.rooms.length : 0} solid floor slabs, ${built ? built.flights.length : 0} stair flights (&gt;=2.1m headroom), operable 3D door.</span>
        </div>
      </label>
      <label class="check-item">
        <input type="checkbox" data-chk="scale" ${checklistStatus.scale ? 'checked' : ''}>
        <div>
          <b>4. 1.70m Anny V8 Scale &amp; Eye-Height Check</b>
          <span>Clothed 104-bone Anny V8 residents at all 6 thresholds + 1.70m stadia rod at Severn.</span>
        </div>
      </label>
    `;
  } else if (activeInspTab === 'aura') {
    const auraRows = [
      ['Light Entry', `Facade windows + open street threshold.`],
      ['Receiving Surface', `Warm interior ${curHero.levels[0]?.rooms[0]?.floor || 'floorboards'} & matte granite sidewalk.`],
      ['Dark Recess', 'Service/boiler core & deep party-wall corners remain unlit without artificial fill.'],
      ['Wall Acoustics', `Door Open: 13.5 kHz street air - Door Closed: 580 Hz low-pass.`],
    ];
    box.innerHTML = auraRows
      .map(
        ([k, v]) => `<div style="padding:5px 0;border-bottom:1px solid var(--rule);font-size:11px;">
          <b style="color:var(--brass);display:block;font-size:10px;text-transform:uppercase;">${k}</b>
          <span>${v}</span>
        </div>`
      )
      .join('');
  } else if (activeInspTab === 'proofs') {
    box.innerHTML = proofs
      .map(
        (pr) => `<div class="proof-row">
          <b class="${pr.state}">${pr.state}</b>
          <div>
            <strong style="color:var(--paper)">${pr.rule}</strong>
            <div style="color:var(--muted);font-size:10.5px;">${pr.detail}</div>
          </div>
        </div>`
      )
      .join('');
  } else {
    box.innerHTML = (curHero.facts || [])
      .map(
        (f) => `<div style="padding:4px 0;border-bottom:1px solid var(--rule);font-size:11px;">
          <span class="prov-badge prov-${f.status}">${f.status}</span>${f.claim}
        </div>`
      )
      .join('');
  }
}

function buildIconicMapModal() {
  const svg = $('iconic-svg');
  if (!svg) return;
  const sx = 800 / ICONIC.W;
  const sy = 560 / ICONIC.H;
  let h = '';
  for (const e of ICONIC.elements.filter((x) => x.kind === 'district')) {
    const r = (e.r || 90) * sx;
    h += `<ellipse cx="${(e.x * sx).toFixed(1)}" cy="${(e.y * sy).toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * 0.76).toFixed(1)}" fill="rgba(24,180,255,0.06)" stroke="rgba(24,180,255,0.35)" stroke-dasharray="4 3"/>`;
  }
  for (const e of ICONIC.elements.filter((x) => x.kind === 'path' && e.pts)) {
    const d = 'M' + e.pts.map((p) => `${(p[0] * sx).toFixed(1)},${(p[1] * sy).toFixed(1)}`).join('L');
    h += `<path d="${d}" fill="none" stroke="rgba(212,178,118,0.65)" stroke-width="2.2"/>`;
  }
  const lms = ICONIC.elements.filter((x) => x.kind === 'landmark');
  for (const e of lms) {
    const x = e.x * sx;
    const y = e.y * sy;
    const s = 6 + Math.min(8, Math.sqrt(e.n || 1) * 1.4);
    const matchHero = HD.heroes.some((hr) => hr.landmark === e.name);
    const fill = matchHero ? '#18b4ff' : e.named ? '#d4b276' : '#8ea4bc';
    h += `<g class="ic-lm" data-id="${e.id}" style="cursor:pointer">
      <polygon points="${x.toFixed(1)},${(y - s).toFixed(1)} ${(x + s * 0.85).toFixed(1)},${(y + s * 0.65).toFixed(1)} ${(x - s * 0.85).toFixed(1)},${(y + s * 0.65).toFixed(1)}" fill="${fill}" stroke="#081322" stroke-width="1.2"/>
      ${matchHero || e.named ? `<text x="${x.toFixed(1)}" y="${(y - s - 4).toFixed(1)}" fill="#f2ede2" font-size="10" text-anchor="middle">${e.name}</text>` : ''}
    </g>`;
  }
  svg.innerHTML = h;
  $('iconic-hero-links').innerHTML = HD.heroes
    .map((hr, i) => `<button class="pill ${i === activeHeroIdx ? 'active' : ''}" data-hi="${i}" type="button">${hr.name}</button>`)
    .join('');
  $('iconic-hero-links').querySelectorAll('.pill').forEach((b) => {
    b.onclick = () => {
      $('iconic-modal').classList.remove('open');
      applyHeroCameraStation(+b.dataset.hi, 'threshold');
    };
  });
}

function updateBottomReadout() {
  if (!$('btn-door')) return;
  const p = heroPlacements[activeHeroIdx];
  const dOpen = p ? p.doorOpen : severnDoorOpen;
  $('btn-door').textContent = `Door: ${dOpen ? 'Open' : 'Closed'} (E)`;
  $('btn-door').classList.toggle('cyan-act', dOpen);
  $('btn-parcel').textContent = `Parcel: ${parcelHolder === 'bekele' ? 'Keeper' : 'Courier'} (H)`;
  $('walk-readout').textContent = rawDaylight ? 'RAW DAYLIGHT AUDIT' : 'POEM HOUR PROMENADE';
}

subscribePilotState((next) => {
  if (typeof next.doorOpen === 'boolean' && next.doorOpen !== severnDoorOpen) {
    severnDoorOpen = next.doorOpen;
    const sp = heroPlacements[severnIdx];
    if (sp) {
      sp.doorOpen = severnDoorOpen;
      sp.built.doorOpen = severnDoorOpen;
    }
    suite.audio?.setDoorOpen?.(severnDoorOpen, false);
    syncPromenadeLights();
  }
  if (next.parcelHolder && next.parcelHolder !== parcelHolder) {
    parcelHolder = next.parcelHolder;
  }
  if (typeof next.rawDaylight === 'boolean' && next.rawDaylight !== rawDaylight) {
    rawDaylight = next.rawDaylight;
    applyLightingPass();
  }
  updateBottomReadout();
});

// Wire optional Tab Audit Drawer controls
document.querySelectorAll('#cam-stations .pill').forEach((b) => {
  b.addEventListener('click', () => applyHeroCameraStation(activeHeroIdx, b.dataset.cam));
});
$('btn-grade-poem')?.addEventListener('click', () => {
  rawDaylight = false;
  applyLightingPass();
  updateBottomReadout();
});
$('btn-grade-raw')?.addEventListener('click', () => {
  rawDaylight = true;
  applyLightingPass();
  updateBottomReadout();
});
document.querySelectorAll('#rep-modes .pill').forEach((b) => {
  b.addEventListener('click', () => {
    repMode = b.dataset.rep;
    document.querySelectorAll('#rep-modes .pill').forEach((x) => x.classList.toggle('active', x === b));
    heroPlacements.forEach((p) => applyHeroCutaway(p));
  });
});
$('storey-cut')?.addEventListener('input', (e) => {
  const p = heroPlacements[activeHeroIdx];
  if (!p) return;
  const val = +e.target.value;
  $('storey-val').textContent = `${val}/${p.hero.levels.length}`;
  p.cutMode = val < p.hero.levels.length ? 2 : 0;
  applyHeroCutaway(p);
});
$('btn-lift-front')?.addEventListener('click', () => {
  const p = heroPlacements[activeHeroIdx];
  if (!p) return;
  p.cutMode = p.cutMode === 1 ? 0 : 1;
  $('btn-lift-front').classList.toggle('active', p.cutMode === 1);
  applyHeroCutaway(p);
});
document.querySelectorAll('#insp-tabs .pill').forEach((b) => {
  b.addEventListener('click', () => {
    activeInspTab = b.dataset.itab;
    document.querySelectorAll('#insp-tabs .pill').forEach((x) => x.classList.toggle('active', x === b));
    renderInspectorContent();
  });
});
$('btn-walk')?.addEventListener('click', () => applyHeroCameraStation(activeHeroIdx, 'promenade'));
$('btn-door')?.addEventListener('click', () => toggleHeroDoor(activeHeroIdx));
$('btn-parcel')?.addEventListener('click', () => onResidentClicked({ residentId: 'severn-courier' }));
$('btn-iconic')?.addEventListener('click', () => {
  $('iconic-modal').classList.add('open');
  buildIconicMapModal();
});
$('btn-close-iconic')?.addEventListener('click', () => $('iconic-modal').classList.remove('open'));
$('toggle-left')?.addEventListener('click', () => $('left-roster').classList.toggle('collapsed'));
$('toggle-right')?.addEventListener('click', () => $('right-inspector').classList.toggle('collapsed'));

// ---------------------------------------------------------------------------
// Input Controls: WASD Promenade Walk, Drag Look & 3D Diegetic Raycasting
// ---------------------------------------------------------------------------
const keys = {};
let drag = null;
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();

function raycastPromenadeTargets(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObjects(interactiveTargets, false);
  return hits.length && hits[0].distance < 120 ? hits[0] : null;
}

window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    glideAnim = null;
  } else if (k === '0') applyHeroCameraStation(activeHeroIdx, 'promenade');
  else if (k === 'e') toggleHeroDoor(activeHeroIdx);
  else if (k === 'h') onResidentClicked({ residentId: 'severn-courier' });
  else if (k === 'l') toggleDaylightInWorld();
  else if (k === 'c') cycleCutawayLever(activeHeroIdx, true);
  else if (k === 'i') {
    $('iconic-modal').classList.toggle('open');
    if ($('iconic-modal').classList.contains('open')) buildIconicMapModal();
  } else if (e.key === 'Escape') {
    $('iconic-modal').classList.remove('open');
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
    glideAnim = null;
    walkState.yaw -= dx * 0.0042;
    walkState.pitch = Math.max(-1.15, Math.min(1.15, walkState.pitch - dy * 0.0042));
    drag.x = e.clientX;
    drag.y = e.clientY;
  } else {
    hoveredTarget = raycastPromenadeTargets(e.clientX, e.clientY);
    if (hoveredTarget) {
      renderer.domElement.style.cursor = 'pointer';
    } else if (!renderer.domElement.dataset.mpPrevCursor) {
      renderer.domElement.style.cursor = 'grab';
    }
  }
});

window.addEventListener('pointerup', (e) => {
  if (drag && !drag.moved && e.button === 0) {
    const hit = raycastPromenadeTargets(e.clientX, e.clientY);
    if (hit) {
      const td = hit.object.userData.heroTarget;
      const worldPt = hit.point.clone();
      if (td.action === 'toggle-daylight') {
        toggleDaylightInWorld(worldPt.add(new THREE.Vector3(0, 0.5, 0)));
      } else if (td.action === 'cutaway-lever') {
        cycleCutawayLever(td.heroIdx, td.isMaster, worldPt.add(new THREE.Vector3(0, 0.6, 0)));
      } else if (td.action === 'hero-door') {
        onHeroDoorClicked(td.heroIdx);
      } else if (td.action === 'hero-facade') {
        onHeroFacadeClicked(td.heroIdx);
      } else if (td.action === 'resident') {
        onResidentClicked(td);
      }
    }
  }
  drag = null;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize All 6 Compiled HDL Heroes on the Promenade
renderRoster();
compileAllHeroes();
if (explicitHeroParam) {
  applyHeroCameraStation(activeHeroIdx, 'threshold');
} else {
  setActiveHeroMeta(activeHeroIdx);
}
updateBottomReadout();

// ---------------------------------------------------------------------------
// Animation Loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const _courierHand = new THREE.Vector3();
const _keeperHand = new THREE.Vector3();

function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now() * 0.001;

  // Smoothly swing operable 3D threshold doors across all 6 Hero Buildings
  for (const p of heroPlacements) {
    const targetRot = p.doorOpen ? -1.18 : 0;
    p.doorAnimRot += (targetRot - p.doorAnimRot) * Math.min(1, dt * 10);
    for (const td of p.built.thresholdDoors) {
      td.leaf.rotation.y = p.doorAnimRot;
    }
  }

  let moving = false;
  if (glideAnim) {
    glideAnim.t += dt;
    const u = Math.min(1, glideAnim.t / glideAnim.dur);
    const ease = 1 - Math.pow(1 - u, 3);
    walkState.wx = glideAnim.from.wx + (glideAnim.to.wx - glideAnim.from.wx) * ease;
    walkState.wz = glideAnim.from.wz + (glideAnim.to.wz - glideAnim.from.wz) * ease;
    walkState.z = glideAnim.from.z + (glideAnim.to.z - glideAnim.from.z) * ease;
    walkState.yaw = glideAnim.from.yaw + (glideAnim.to.yaw - glideAnim.from.yaw) * ease;
    walkState.pitch = glideAnim.from.pitch + (glideAnim.to.pitch - glideAnim.from.pitch) * ease;
    if (u >= 1) glideAnim = null;
    moving = true;
  } else {
    const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    const s = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    if (f !== 0 || s !== 0) {
      moving = true;
      const sp = (keys.shift ? 6.2 : 3.4) * dt;
      const fx = -Math.sin(walkState.yaw);
      const fz = -Math.cos(walkState.yaw);
      const dx = (fx * f + Math.cos(walkState.yaw) * s) * sp;
      const dz = (fz * f - Math.sin(walkState.yaw) * s) * sp;
      if (!worldIsBlocked(walkState.wx, walkState.wz, walkState.wx + dx, walkState.wz, walkState.z)) {
        walkState.wx += dx;
      }
      if (!worldIsBlocked(walkState.wx, walkState.wz, walkState.wx, walkState.wz + dz, walkState.z)) {
        walkState.wz += dz;
      }
    }
    const fz = worldFloorAt(walkState.wx, walkState.wz, walkState.z);
    walkState.z += (fz - walkState.z) * Math.min(1, dt * (fz < walkState.z ? 7 : 14));
  }

  // Check if player is currently inside any Hero Building (for door-coupled room acoustics!)
  let insideClosedDoor = false;
  walkState.insideHeroIdx = -1;
  for (const p of heroPlacements) {
    if (walkState.wx >= p.ox && walkState.wx <= p.ox + p.w && walkState.wz >= p.oz && walkState.wz <= p.oz + p.d) {
      walkState.insideHeroIdx = p.idx;
      if (!p.doorOpen) insideClosedDoor = true;
      break;
    }
  }

  camera.position.set(walkState.wx, walkState.z + 1.68, walkState.wz);
  camera.rotation.set(walkState.pitch, walkState.yaw, 0);

  // Update all clothed Anny V8 residents & Severn parcel arc
  for (const act of scaleActors) {
    if (act.v8?.update) act.v8.update(dt);
  }
  const courier = residentByHeroIdx[severnIdx];
  if (courier && severnKeeperActor) {
    const targetT = parcelHolder === 'bekele' ? 1 : 0;
    parcelLerp += (targetT - parcelLerp) * Math.min(1, dt * 6.5);
    _courierHand.set(
      courier.root.position.x + Math.sin(courier.root.rotation.y) * 0.32,
      courier.root.position.y + 1.04 + Math.sin(now * 2.2) * 0.015,
      courier.root.position.z + Math.cos(courier.root.rotation.y) * 0.32
    );
    _keeperHand.set(
      severnKeeperActor.root.position.x + Math.sin(severnKeeperActor.root.rotation.y) * 0.32,
      severnKeeperActor.root.position.y + 1.04 + Math.sin(now * 2.2 + 1.1) * 0.015,
      severnKeeperActor.root.position.z + Math.cos(severnKeeperActor.root.rotation.y) * 0.32
    );
    parcelMesh.position.lerpVectors(_courierHand, _keeperHand, parcelLerp);
    parcelMesh.position.y += Math.sin(parcelLerp * Math.PI) * 0.34;
    parcelMesh.rotation.y = courier.root.rotation.y;
  }

  worldRig.update({ x: walkState.wx, y: walkState.z, z: walkState.wz });
  updateWhisperOverlay();

  suite.updateAudio(dt, {
    isInside: insideClosedDoor,
    nightMix: rawDaylight ? 0.0 : currentNightMix,
    submerged: false,
    moving,
    projectorDist: 99,
    projectorWet: false,
  });

  suite.render(scene, camera);
  if (document.body.classList.contains('mp-tab-open')) {
    labelRenderer.render(camera);
  }
  requestAnimationFrame(animate);
}
animate();

window.__heroes = {
  get heroCount() {
    return heroPlacements.length;
  },
  get heroIds() {
    return heroPlacements.map((p) => p.hero.id);
  },
  selectHero: (idx) => applyHeroCameraStation(idx, 'threshold'),
  applyCameraStation: (st) => applyHeroCameraStation(activeHeroIdx, st),
  toggleDoor: () => toggleHeroDoor(activeHeroIdx),
  toggleDaylightInWorld,
  cycleCutawayLever: (idx = activeHeroIdx) => cycleCutawayLever(idx, false),
  get rawDaylight() {
    return rawDaylight;
  },
  setRawDaylight: (v) => {
    rawDaylight = !!v;
    applyLightingPass();
  },
  PROOFS_BY_HERO,
  camera,
  suite,
};
