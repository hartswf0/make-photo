// Hero Building & Iconic Inspector — Severn & All 6 HDL Peers (Briefs 4 & 9)
// Audits metre-scale PBR materials, fixture-bound aura lights, walkable interiors,
// Raw Daylight vs. Authored Poem-Hour passes, 1.70m Anny V8 human scale, and Lynch Iconic siting.

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
const [HD, LIB, REFS, ICONIC] = await Promise.all([
  fetch('./data/hdl.json').then((r) => r.json()),
  fetch('./data/library.json').then((r) => r.json()),
  fetch('./data/refs.json').then((r) => r.json()),
  fetch('./data/iconic.json').then((r) => r.json()),
]);

useLibrary(LIB, null);
new THREE.TextureLoader().load('./data/library.webp', (tex) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  useLibrary(LIB, tex);
  compileActiveHero(false);
});

const PROOFS_BY_HERO = HD.heroes.map((h) => prove(h));

// ---------------------------------------------------------------------------
// Renderer, Sky Dome, Wet Asphalt vs. Matte Curb/Sidewalk & Harbor Water
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

const labelRenderer = new SimpleLabelProjector($('beat-labels'));

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0c1f38');
scene.fog = new THREE.FogExp2('#152e4d', 0.0055);

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.08, 420);
camera.rotation.order = 'YXZ';

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI * 0.49;

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
  new THREE.SphereGeometry(280, 28, 18),
  new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false })
);
scene.add(skyDome);

const hemi = new THREE.HemisphereLight('#d6e8f8', '#5a493c', 1.35);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#ffe4c4', 2.6);
sun.position.set(-34, 48, -32);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 2, far: 160 });
sun.shadow.bias = -0.0004;
scene.add(sun);

// Brief 4: Restrict wet reflection strictly to wet street asphalt & harbor water; sidewalks & stone stay matte!
function buildGroundEnvironment() {
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
  const map = new THREE.CanvasTexture(col);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(14, 14);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(rgh);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(14, 14);

  const wetRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 24),
    new THREE.MeshStandardMaterial({
      map,
      roughnessMap,
      roughness: 0.28,
      metalness: 0.24,
    })
  );
  wetRoad.rotation.x = -Math.PI / 2;
  wetRoad.position.set(0, -0.04, -15.5);
  wetRoad.receiveShadow = true;
  env.add(wetRoad);

  // Matte dry granite sidewalk & building lot pad
  const dryPad = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 120),
    new THREE.MeshStandardMaterial({ color: '#787166', roughness: 0.90, metalness: 0.01 })
  );
  dryPad.rotation.x = -Math.PI / 2;
  dryPad.position.set(0, -0.03, 56.5);
  dryPad.receiveShadow = true;
  env.add(dryPad);

  const curb = new THREE.Mesh(
    new THREE.BoxGeometry(120, 0.16, 0.30),
    new THREE.MeshStandardMaterial({ color: '#9e9688', roughness: 0.84 })
  );
  curb.position.set(0, -0.01, -3.5);
  curb.receiveShadow = true;
  env.add(curb);

  // Cyan municipal conduit line along curb
  const cyanStrip = new THREE.Mesh(
    new THREE.BoxGeometry(80, 0.025, 0.09),
    new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 1.25, roughness: 0.2 })
  );
  cyanStrip.position.set(0, 0.02, -3.22);
  env.add(cyanStrip);

  // Harbor water plane (enabled specifically for The Pier Cafe)
  const harborWater = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260),
    new THREE.MeshStandardMaterial({ color: '#144462', roughness: 0.09, metalness: 0.38 })
  );
  harborWater.rotation.x = -Math.PI / 2;
  harborWater.position.y = -0.68;
  harborWater.visible = false;
  env.add(harborWater);

  return { env, wetRoad, dryPad, curb, cyanStrip, harborWater };
}
const groundEnv = buildGroundEnvironment();
scene.add(groundEnv.env);

// ---------------------------------------------------------------------------
// Real 1.70m Anny V8 Scale Anchors & Parcel Ownership
// ---------------------------------------------------------------------------
const humanGroup = new THREE.Group();
scene.add(humanGroup);

const parcelMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.32, 0.22, 0.25),
  new THREE.MeshStandardMaterial({ color: '#c89b62', roughness: 0.7 })
);
scene.add(parcelMesh);

const scaleActors = [];
function createScaleActor({ id, archetype, coatHex }) {
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

  // Vertical 1.70m calibrated surveyor scale stadia rod beside exterior human!
  if (id === 'exterior-scale') {
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

  const entry = { id, root, proxy, v8: null };
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

const extScaleHuman = createScaleActor({ id: 'exterior-scale', archetype: 'adult_f', coatHex: '#354457' });
const intKeeperHuman = createScaleActor({ id: 'interior-keeper', archetype: 'adult_m', coatHex: '#8c5438' });

// ---------------------------------------------------------------------------
// State & Universal 23-Look GPU Shader Suite
// ---------------------------------------------------------------------------
let heroIdx = 0;
const reqId = urlParams.get('h') || pilotInit.building || 'severn';
const foundIdx = HD.heroes.findIndex((h) => h.id === reqId);
if (foundIdx >= 0) heroIdx = foundIdx;

let curHero = HD.heroes[heroIdx];
let built = null;
let repMode = 'resolved'; // 'resolved' | 'mass' | 'both'
let eraState = 'intact';
let storeyCut = 99;
let liftFront = false;
let beatsVisible = true;
let rawDaylight = !!pilotInit.rawDaylight;
let savedLookBeforeRaw = pilotInit.shader || 'weave';
let doorOpen = pilotInit.doorOpen !== false;
let parcelHolder = pilotInit.parcelHolder || 'player';
let walking = false;
let activeInspTab = 'checklist';
let activeLights = [];
let beatLabels = [];
let currentNightMix = 0.72;

const checklistStatus = {
  material: true,
  aura: true,
  collider: true,
  scale: true,
};

const suite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: rawDaylight ? 'natural' : savedLookBeforeRaw,
  locationName: 'Hero Building Inspector',
  cartridgeName: 'heroes',
  onTimeChange: (key, preset) => {
    currentNightMix = preset.audioNightMix;
    if (!rawDaylight) {
      paintSky(preset.skyTop, preset.skyMid, preset.skyHorizon);
      skyTex.needsUpdate = true;
      scene.fog.color.set(preset.skyMid);
      scene.fog.density = preset.fogDensity;
      sun.intensity = preset.sunIntensity;
      sun.color.set(preset.sunColor);
      hemi.intensity = preset.hemiIntensity;
    }
  },
});

let inLightingApply = false;
function applyLightingPass() {
  if (inLightingApply) return;
  inLightingApply = true;
  try {
    $('btn-grade-poem').classList.toggle('cyan-act', !rawDaylight);
    $('btn-grade-raw').classList.toggle('cyan-act', rawDaylight);

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
      scene.fog.density = 0.0018;
      sun.color.set('#ffffff');
      sun.intensity = 3.1;
      hemi.color.set('#eef4fa');
      hemi.groundColor.set('#6e6860');
      hemi.intensity = 1.65;
    } else {
      const p = suite.timePresets[st.timeOfDay] || suite.timePresets.bluehour;
      paintSky(p.skyTop, p.skyMid, p.skyHorizon);
      skyTex.needsUpdate = true;
      scene.fog.color.set(p.skyMid);
      scene.fog.density = p.fogDensity;
      sun.color.set(p.sunColor);
      sun.intensity = p.sunIntensity;
      hemi.intensity = p.hemiIntensity;
    }

    if (built) {
      built.group.traverse((o) => {
        if (o.userData.atmosphericShaft) o.visible = !rawDaylight;
      });
    }
    applyCutAndVisibility();
    syncHeroLights();
  } finally {
    inLightingApply = false;
  }
}

function syncHeroLights() {
  activeLights.forEach((l) => scene.remove(l));
  activeLights = [];
  if (!built) return;

  const ox = built.group.position.x;
  const oz = built.group.position.z;

  // Warm interior lamps in ground & occupied rooms (dimmed in Raw Daylight audit so unlit albedo reads cleanly)
  const roomMult = rawDaylight ? 0.15 : 1.0;
  const litRooms = built.rooms.slice(0, 10);
  const LC = { warm: [0xffc98a, 14], cool: [0x9ce2ff, 11], red: [0xff3848, 18], dim: [0xffd8a8, 6] };
  for (const r of litRooms) {
    const [col, inten] = LC[r.light] || LC.warm;
    const pl = new THREE.PointLight(col, inten * roomMult, Math.max(r.w, r.d) * 1.65, 1.5);
    pl.position.set(r.x + r.w / 2 + ox, r.z + r.h - 0.55, r.y + r.d / 2 + oz);
    scene.add(pl);
    activeLights.push(pl);
  }

  // Warm threshold spill across pavement when street door is open
  if (doorOpen && !rawDaylight) {
    const td = built.thresholdDoors[0];
    if (td) {
      const spill = new THREE.PointLight(0xffcb88, 18, 11, 1.5);
      spill.position.set(td.s + ox, td.z + 2.2, td.c - 0.8 + oz);
      scene.add(spill);
      activeLights.push(spill);
    }
  }

  // Fixture-bound exterior cyan & hero sign lights (disabled in Raw Daylight pass per Brief 4!)
  if (!rawDaylight) {
    for (const fx of built.fixtures) {
      if (!fx.color) continue;
      const pl = new THREE.PointLight(fx.color, fx.intensity || 8, fx.dist || 10, 1.6);
      pl.position.set(fx.pos[0] + ox, fx.pos[1], fx.pos[2] + oz);
      scene.add(pl);
      activeLights.push(pl);
    }
  }
}

// ---------------------------------------------------------------------------
// Compile Hero, Place Scale Humans, Staged Poem Beats & Camera Stations
// ---------------------------------------------------------------------------
const walkState = { x: 10, y: -4.2, z: 0, yaw: Math.PI, pitch: 0.04, isInside: false };

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

function placeScaleHumans() {
  if (!built) return;
  const ox = built.group.position.x;
  const oz = built.group.position.z;
  const doorX = getDoorX(curHero);
  const baseZ = curHero.levels[0]?.z || 0;

  // Exterior 1.70m Anny V8 scale anchor beside doorway on sidewalk/terrace
  const extY = curHero.id === 'cafe' ? -2.2 : -1.85;
  const extFloor = floorAt(built, doorX - 1.35, extY, baseZ);
  extScaleHuman.root.position.set(doorX - 1.35 + ox, extFloor, extY + oz);
  extScaleHuman.root.rotation.y = 0.25;

  // Interior keeper standing just inside threshold room
  const intFloor = floorAt(built, doorX + 0.55, 1.65, baseZ);
  intKeeperHuman.root.position.set(doorX + 0.55 + ox, intFloor, 1.65 + oz);
  intKeeperHuman.root.rotation.y = Math.PI - 0.2;
}

function placePoemBeats() {
  labelRenderer.clear();
  beatLabels = [];
  if (!built) return;
  const lines = (ICONIC.words || []).filter((w) => w.poem === curHero.poem).map((w) => w.t);
  const expH = expand(curHero);
  const rooms = expH.levels.flatMap((l) => l.rooms);
  const ox = built.group.position.x;
  const oz = built.group.position.z;
  (curHero.beats || []).forEach((b, idx) => {
    const text = lines[idx % Math.max(1, lines.length)] || curHero.note;
    let pos = null;
    let lv = 0;
    const rm = rooms.find((r) => r.id === b);
    if (rm) {
      pos = [rm.x + rm.w / 2, rm.z + 1.85, rm.y + rm.d / 2];
      lv = rm.level;
    } else if (b === 'fireescape') {
      const fe = (curHero.exterior || []).find((e) => e.kind === 'fireescape');
      if (fe && expH.levels[2]) {
        pos = [fe.x + fe.w / 2, expH.levels[2].z + 1.6, -0.9];
        lv = 2;
      }
    } else if (b === 'roof') {
      pos = [curHero.footprint[0] / 2, built.top + 1.6, curHero.footprint[1] / 2];
      lv = curHero.levels.length - 1;
    }
    if (!pos) return;
    const div = document.createElement('div');
    div.className = 'beat-tag';
    div.innerHTML = `"${text}"<small>${rm ? rm.name : b}</small>`;
    const item = labelRenderer.add(div, new THREE.Vector3(pos[0] + ox, pos[1], pos[2] + oz), lv);
    beatLabels.push(item);
  });
}

function applyCutAndVisibility() {
  if (!built) return;
  built.group.visible = repMode !== 'mass';
  built.mass.visible = repMode !== 'resolved';
  built.mass.children.forEach((m) => {
    m.material.opacity = repMode === 'both' ? 0.34 : 0.72;
  });

  const L = curHero.levels.length;
  const lim = Math.min(storeyCut, L) - 1;
  built.levels.forEach((lg, k) => {
    lg.visible = k <= lim;
    lg.traverse((o) => {
      if (o.userData.wall) {
        o.visible = !(liftFront && o.userData.wall.ext && o.userData.wall.side === 'front');
      }
      if (o.userData.ceiling) {
        o.visible = walking || k < lim || (storeyCut >= L && !liftFront);
      }
    });
  });
  built.stairs.children.forEach((sg) => {
    sg.visible = sg.userData.level <= lim;
  });
  built.roof.visible = storeyCut >= L && !liftFront;
  built.ext.visible = !liftFront || walking;
  built.mass.children.forEach((m) => {
    m.visible = (m.userData.room?.level ?? 0) <= lim;
  });
  beatLabels.forEach((o) => {
    o.visible = beatsVisible && !rawDaylight && (o.level ?? 0) <= lim;
  });
}

function applyCameraStation(station) {
  if (!built) return;
  walking = false;
  $('btn-walk').classList.remove('cyan-act');
  orbit.enabled = true;
  document.querySelectorAll('#cam-stations .pill').forEach((b) => b.classList.toggle('active', b.dataset.cam === station));

  const ox = built.group.position.x;
  const oz = built.group.position.z;
  const [W, D] = curHero.footprint;
  const doorX = getDoorX(curHero);
  const expH = expand(curHero);
  // Pick primary upper front room (e.g. Flat 2A in Severn) or main room in 1-storey heroes
  const targetLv = expH.levels[Math.min(2, expH.levels.length - 1)];
  const occRoom =
    targetLv.rooms.find((r) => r.id === 'f2a') ||
    targetLv.rooms.find((r) => ['home', 'assembly', 'cafe', 'shop'].includes(r.use)) ||
    targetLv.rooms[0];

  camera.fov = 42; // Identical 42 deg (~35mm equiv) lens across stations per Brief 4!
  camera.updateProjectionMatrix();

  if (station === 'hero') {
    const s = curHero.shot;
    if (s) {
      camera.position.set(s.pos[0] + ox, Math.max(1.8, s.pos[2]), s.pos[1] + oz);
      orbit.target.set(s.target[0] + ox, s.target[2], s.target[1] + oz);
    } else {
      const r = Math.max(W, D, built.top) * 1.45;
      camera.position.set(r * 0.65, built.top * 0.6 + 5, -r * 0.85);
      orbit.target.set(0, built.top * 0.38, D * 0.45);
    }
  } else if (station === 'threshold') {
    const baseZ = curHero.levels[0]?.z || 0;
    camera.position.set(doorX - 0.35 + ox, baseZ + 1.65, -3.6 + oz);
    orbit.target.set(doorX + 0.15 + ox, baseZ + 1.55, 2.5 + oz);
  } else if (station === 'standing' && occRoom) {
    camera.position.set(occRoom.x + occRoom.w * 0.25 + ox, occRoom.z + 1.65, occRoom.y + occRoom.d * 0.72 + oz);
    orbit.target.set(occRoom.x + occRoom.w * 0.68 + ox, occRoom.z + 1.35, occRoom.y + occRoom.d * 0.22 + oz);
  } else if (station === 'seated' && occRoom) {
    camera.position.set(occRoom.x + occRoom.w * 0.55 + ox, occRoom.z + 1.18, occRoom.y + occRoom.d * 0.62 + oz);
    orbit.target.set(occRoom.x + occRoom.w * 0.48 + ox, occRoom.z + 1.12, occRoom.y + 0.2 + oz);
  } else if (station === 'window-out' && occRoom) {
    // Inside room looking directly out through its actual front facade window onto the street!
    camera.position.set(occRoom.x + occRoom.w * 0.5 + ox, occRoom.z + 1.60, occRoom.y + 1.65 + oz);
    orbit.target.set(occRoom.x + occRoom.w * 0.5 + ox, 1.35, -8.5 + oz);
  }
  orbit.update();
  updateBottomReadout();
}

function compileActiveHero(resetCam = true) {
  if (built) {
    scene.remove(built.group);
    scene.remove(built.mass);
  }
  built = build(curHero, { state: eraState, doorOpen });
  const [W] = curHero.footprint;
  built.group.position.set(-W / 2, 0, 0);
  built.mass.position.set(-W / 2, 0, 0);
  scene.add(built.group);
  scene.add(built.mass);

  // Harbor setting for Pier Cafe vs. wet street + matte sidewalk for urban heroes
  const isHarbor = curHero.id === 'cafe';
  groundEnv.harborWater.visible = isHarbor;
  groundEnv.wetRoad.visible = !isHarbor;
  groundEnv.dryPad.visible = !isHarbor;
  groundEnv.curb.visible = !isHarbor;
  groundEnv.cyanStrip.visible = !isHarbor;

  placeScaleHumans();
  placePoemBeats();
  applyCutAndVisibility();
  applyLightingPass();
  if (resetCam) applyCameraStation('hero');
  renderInspectorContent();
}

function selectHero(idx) {
  heroIdx = idx;
  curHero = HD.heroes[idx];
  eraState = 'intact';
  storeyCut = curHero.levels.length;
  $('storey-cut').max = curHero.levels.length;
  $('storey-cut').value = storeyCut;
  $('storey-val').textContent = `${storeyCut}/${curHero.levels.length}`;
  liftFront = false;
  $('btn-lift-front').classList.remove('active');

  $('hero-title').textContent = `${curHero.name} — Poem ${curHero.poem} (${curHero.landmark})`;
  $('hero-note').textContent = `${curHero.footprint[0]} x ${curHero.footprint[1]} m · ${curHero.levels.length} level(s) · ${curHero.note}`;

  document.querySelectorAll('.hero-btn').forEach((b, k) => b.classList.toggle('active', k === idx));

  const eras = ['intact'];
  if (curHero.eras?.ruined != null) eras.push('ruin');
  if (curHero.eras?.reuse) eras.push('reuse');
  $('era-buttons').innerHTML = eras
    .map(
      (s) =>
        `<button class="pill ${s === 'intact' ? 'active' : ''}" data-era="${s}" type="button">${
          s === 'reuse' ? curHero.eras.reuse : s === 'ruin' ? 'After the Fall' : 'As Built'
        }</button>`
    )
    .join('');
  $('era-buttons').querySelectorAll('.pill').forEach((b) => {
    b.onclick = () => {
      eraState = b.dataset.era;
      $('era-buttons').querySelectorAll('.pill').forEach((x) => x.classList.toggle('active', x === b));
      compileActiveHero(false);
    };
  });

  window.history.replaceState(null, '', `?h=${curHero.id}`);
  savePilotState({ building: curHero.id, poem: curHero.poem });
  compileActiveHero(true);
}

// ---------------------------------------------------------------------------
// Roster, 4-Tab Inspector (Checklist, Aura Sheet, 15 Proofs, Provenance) & Iconic Map
// ---------------------------------------------------------------------------
function renderRoster() {
  $('hero-list').innerHTML = HD.heroes
    .map((h, i) => {
      const pr = PROOFS_BY_HERO[i];
      const warns = pr.filter((x) => x.state === 'WARN').length;
      return `<button class="hero-btn ${i === heroIdx ? 'active' : ''}" data-idx="${i}" type="button">
        <div class="hb-top">
          <span>${h.name}</span>
          <span class="${warns ? 'badge-warn' : 'badge-pass'}">${warns ? warns + ' WARN' : '15 PASS'}</span>
        </div>
        <div class="hb-sub">Poem ${h.poem} · ${h.footprint[0]}x${h.footprint[1]}m · ${h.levels.length}F · ${h.skin.wall.split('#')[0]}</div>
      </button>`;
    })
    .join('');
  $('hero-list').querySelectorAll('.hero-btn').forEach((b) => {
    b.addEventListener('click', () => selectHero(+b.dataset.idx));
  });
}

function renderInspectorContent() {
  const box = $('insp-content');
  const proofs = PROOFS_BY_HERO[heroIdx] || [];
  if (activeInspTab === 'checklist') {
    box.innerHTML = `
      <label class="check-item">
        <input type="checkbox" data-chk="material" ${checklistStatus.material ? 'checked' : ''}>
        <div>
          <b>1. Shader &amp; Metre-Scale Material Audit</b>
          <span>Skin: ${curHero.skin.wall} (rough 0.84), trim: ${curHero.skin.trim} (0.66), base: ${curHero.skin.base} (0.50). Toggle Raw Daylight above to verify unlit albedo.</span>
        </div>
      </label>
      <label class="check-item">
        <input type="checkbox" data-chk="aura" ${checklistStatus.aura ? 'checked' : ''}>
        <div>
          <b>2. Fixture-Bound Aura &amp; Wet-Only Reflection</b>
          <span>${built ? built.fixtures.length : 0} physical ceiling/sign/cyan-conduit fixtures; wet specular restricted strictly to ${curHero.id === 'cafe' ? 'harbor water' : 'street asphalt'}.</span>
        </div>
      </label>
      <label class="check-item">
        <input type="checkbox" data-chk="collider" ${checklistStatus.collider ? 'checked' : ''}>
        <div>
          <b>3. Walkable Interior, Stairs &amp; Door Collider</b>
          <span>${built ? built.rooms.length : 0} solid floor slabs, ${built ? built.flights.length : 0} stair flights (&gt;=2.1m headroom), operable threshold door (${doorOpen ? 'Open' : 'Closed'}).</span>
        </div>
      </label>
      <label class="check-item">
        <input type="checkbox" data-chk="scale" ${checklistStatus.scale ? 'checked' : ''}>
        <div>
          <b>4. 1.70m Anny V8 Scale &amp; Eye-Height Check</b>
          <span>104-bone Anny V8 + 1.70m stadia rod at doorway; test Standing (1.65m), Seated (1.18m) &amp; Window-Out stations above.</span>
        </div>
      </label>
    `;
    box.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        checklistStatus[cb.dataset.chk] = cb.checked;
      });
    });
  } else if (activeInspTab === 'aura') {
    const auraRows = [
      ['Light Entry', `Facade windows (${curHero.skin.surround ? 'cantera stone surrounds' : 'framed openings'}) + open street threshold.`],
      ['Receiving Surface', `Warm interior ${curHero.levels[0]?.rooms[0]?.floor || 'floorboards'} & sidewalk stoop spill.`],
      ['Dark Recess', 'Service/boiler core & deep party-wall corners remain unlit without artificial fill.'],
      ['Wear & Datum', `Granite plinth & threshold step wear; +4.0m flood datum tracked in Severn Pilot.`],
      ['Wall Acoustics', `Door Open: 13.5 kHz street air · Door Closed: 580 Hz low-pass + stone room impulse.`],
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
        (p) => `<div class="proof-row">
          <b class="${p.state}">${p.state}</b>
          <div>
            <strong style="color:var(--paper)">${p.rule}</strong>
            <div style="color:var(--muted);font-size:10.5px;">${p.detail}</div>
          </div>
        </div>`
      )
      .join('');
  } else {
    const factsHtml = (curHero.facts || [])
      .map(
        (f) => `<div style="padding:4px 0;border-bottom:1px solid var(--rule);font-size:11px;">
          <span class="prov-badge prov-${f.status}">${f.status}</span>${f.claim}
        </div>`
      )
      .join('');
    const fitHtml = (curHero.fit || [])
      .slice(0, 4)
      .map(
        (f) => `<div style="padding:4px 0;border-bottom:1px solid var(--rule);font-size:10.5px;color:var(--muted);">
          <b style="color:var(--paper);display:block;">Saw: ${f.saw}</b>Did: ${f.did}
        </div>`
      )
      .join('');
    box.innerHTML = `${factsHtml}${fitHtml}`;
  }
}

function buildIconicMapModal() {
  const svg = $('iconic-svg');
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
  for (const e of ICONIC.elements.filter((x) => x.kind === 'node')) {
    h += `<circle cx="${(e.x * sx).toFixed(1)}" cy="${(e.y * sy).toFixed(1)}" r="6" fill="#0c1f38" stroke="#18b4ff" stroke-width="2"/>`;
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
  svg.querySelectorAll('.ic-lm').forEach((g) => {
    g.addEventListener('click', () => {
      const el = ICONIC.elements.find((x) => x.id === g.dataset.id);
      if (!el) return;
      const linkedHero = HD.heroes.findIndex((hr) => hr.landmark === el.name);
      $('iconic-detail').innerHTML = `
        <div><b style="color:var(--cyan);font-size:13px;">${el.name}</b> (${el.kind})</div>
        <div style="margin-top:4px;">Held by <b>${el.n}</b> canon shots · Poem ${el.poem || 'all'}</div>
        ${linkedHero >= 0 ? `<div style="margin-top:6px;"><button class="pill cyan-act" id="jump-linked-hero" type="button">Inspect ${HD.heroes[linkedHero].name} in 3D</button></div>` : ''}
      `;
      const jb = $('jump-linked-hero');
      if (jb) {
        jb.onclick = () => {
          $('iconic-modal').classList.remove('open');
          selectHero(linkedHero);
        };
      }
    });
  });

  $('iconic-hero-links').innerHTML = HD.heroes
    .map((hr, i) => `<button class="pill ${i === heroIdx ? 'active' : ''}" data-hi="${i}" type="button">${hr.name} (${hr.landmark})</button>`)
    .join('');
  $('iconic-hero-links').querySelectorAll('.pill').forEach((b) => {
    b.onclick = () => {
      $('iconic-modal').classList.remove('open');
      selectHero(+b.dataset.hi);
    };
  });
}

function updateBottomReadout() {
  $('btn-door').textContent = `Door: ${doorOpen ? 'Open' : 'Closed'} (E)`;
  $('btn-door').classList.toggle('cyan-act', doorOpen);
  $('btn-parcel').textContent = `Parcel: ${parcelHolder === 'bekele' ? 'Keeper' : 'Courier'} (H)`;
  if (walking) {
    const ac = walkState.isInside ? (doorOpen ? '1.8 kHz' : '580 Hz Muffled') : '13.5 kHz';
    $('walk-readout').textContent = `${walkState.isInside ? 'WALK INSIDE' : 'WALK STREET'} · z=${walkState.z.toFixed(1)}m · ${ac}`;
  } else {
    $('walk-readout').textContent = rawDaylight ? 'RAW DAYLIGHT AUDIT' : 'POEM HOUR INSPECT';
  }
}

function toggleWalk() {
  walking = !walking;
  $('btn-walk').classList.toggle('cyan-act', walking);
  orbit.enabled = !walking;
  if (walking) {
    const doorX = getDoorX(curHero);
    walkState.x = doorX;
    walkState.y = -3.4;
    walkState.z = floorAt(built, doorX, -3.4, 0);
    walkState.yaw = Math.PI;
    walkState.pitch = 0.02;
    storeyCut = curHero.levels.length;
    $('storey-cut').value = storeyCut;
    $('storey-val').textContent = `${storeyCut}/${curHero.levels.length}`;
    applyCutAndVisibility();
  }
  updateBottomReadout();
}

function toggleDoor() {
  doorOpen = !doorOpen;
  setThresholdDoor(built, doorOpen);
  syncHeroLights();
  savePilotState({ doorOpen });
  updateBottomReadout();
  if (activeInspTab === 'checklist') renderInspectorContent();
}

function toggleParcel() {
  parcelHolder = parcelHolder === 'player' ? 'bekele' : 'player';
  savePilotState({ parcelHolder });
  updateBottomReadout();
}

subscribePilotState((next) => {
  if (typeof next.doorOpen === 'boolean' && next.doorOpen !== doorOpen) {
    doorOpen = next.doorOpen;
    setThresholdDoor(built, doorOpen);
    syncHeroLights();
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

// ---------------------------------------------------------------------------
// DOM Event Wiring & Controls
// ---------------------------------------------------------------------------
document.querySelectorAll('#cam-stations .pill').forEach((b) => {
  b.addEventListener('click', () => applyCameraStation(b.dataset.cam));
});
$('btn-grade-poem').addEventListener('click', () => {
  rawDaylight = false;
  applyLightingPass();
  updateBottomReadout();
});
$('btn-grade-raw').addEventListener('click', () => {
  rawDaylight = true;
  applyLightingPass();
  updateBottomReadout();
});
document.querySelectorAll('#rep-modes .pill').forEach((b) => {
  b.addEventListener('click', () => {
    repMode = b.dataset.rep;
    document.querySelectorAll('#rep-modes .pill').forEach((x) => x.classList.toggle('active', x === b));
    applyCutAndVisibility();
  });
});
$('storey-cut').addEventListener('input', (e) => {
  storeyCut = +e.target.value;
  $('storey-val').textContent = `${storeyCut}/${curHero.levels.length}`;
  applyCutAndVisibility();
});
$('btn-lift-front').addEventListener('click', () => {
  liftFront = !liftFront;
  $('btn-lift-front').classList.toggle('active', liftFront);
  applyCutAndVisibility();
});
$('btn-beats').addEventListener('click', () => {
  beatsVisible = !beatsVisible;
  $('btn-beats').classList.toggle('active', beatsVisible);
  applyCutAndVisibility();
});
document.querySelectorAll('#insp-tabs .pill').forEach((b) => {
  b.addEventListener('click', () => {
    activeInspTab = b.dataset.itab;
    document.querySelectorAll('#insp-tabs .pill').forEach((x) => x.classList.toggle('active', x === b));
    renderInspectorContent();
  });
});

$('btn-walk').addEventListener('click', toggleWalk);
$('btn-door').addEventListener('click', toggleDoor);
$('btn-parcel').addEventListener('click', toggleParcel);

$('btn-iconic').addEventListener('click', () => {
  $('iconic-modal').classList.add('open');
  buildIconicMapModal();
});
$('btn-close-iconic').addEventListener('click', () => $('iconic-modal').classList.remove('open'));

$('toggle-left').addEventListener('click', () => {
  $('left-roster').classList.toggle('collapsed');
  $('toggle-left').textContent = $('left-roster').classList.contains('collapsed') ? 'Open' : 'Fold';
});
$('toggle-right').addEventListener('click', () => {
  $('right-inspector').classList.toggle('collapsed');
  $('toggle-right').textContent = $('right-inspector').classList.contains('collapsed') ? 'Open' : 'Fold';
});

const keys = {};
let drag = null;
window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === '1') applyCameraStation('hero');
  else if (k === '2') applyCameraStation('threshold');
  else if (k === '3') applyCameraStation('standing');
  else if (k === '4') applyCameraStation('seated');
  else if (k === '5') applyCameraStation('window-out');
  else if (k === 'v') toggleWalk();
  else if (k === 'e') toggleDoor();
  else if (k === 'h') toggleParcel();
  else if (k === 'i') {
    $('iconic-modal').classList.toggle('open');
    if ($('iconic-modal').classList.contains('open')) buildIconicMapModal();
  } else if (e.key === 'Escape') $('iconic-modal').classList.remove('open');
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  drag = [e.clientX, e.clientY];
});
window.addEventListener('pointerup', () => {
  drag = null;
});
window.addEventListener('pointermove', (e) => {
  if (!drag || !walking) return;
  walkState.yaw -= (e.clientX - drag[0]) * 0.0042;
  walkState.pitch = Math.max(-1.15, Math.min(1.15, walkState.pitch - (e.clientY - drag[1]) * 0.0042));
  drag = [e.clientX, e.clientY];
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize Roster & Selected Hero
renderRoster();
selectHero(heroIdx);
updateBottomReadout();

// ---------------------------------------------------------------------------
// Animation Loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(0.05, clock.getDelta());

  let moving = false;
  if (walking && built) {
    const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    const s = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    if (f !== 0 || s !== 0) {
      moving = true;
      const sp = (keys.shift ? 4.4 : 2.3) * dt;
      const fx = -Math.sin(walkState.yaw);
      const fy = -Math.cos(walkState.yaw);
      const dx = (fx * f + Math.cos(walkState.yaw) * s) * sp;
      const dy = (fy * f - Math.sin(walkState.yaw) * s) * sp;
      if (!isBlocked(built, walkState.x, walkState.y, walkState.x + dx, walkState.y, walkState.z)) walkState.x += dx;
      if (!isBlocked(built, walkState.x, walkState.y, walkState.x, walkState.y + dy, walkState.z)) walkState.y += dy;
    }
    const fz = floorAt(built, walkState.x, walkState.y, walkState.z);
    walkState.z += (fz - walkState.z) * Math.min(1, dt * (fz < walkState.z ? 7 : 14));
    const [FW, FD] = curHero.footprint;
    walkState.isInside = walkState.x >= 0 && walkState.x <= FW && walkState.y >= 0 && walkState.y <= FD;
    camera.position.set(walkState.x + built.group.position.x, walkState.z + 1.65, walkState.y + built.group.position.z);
    camera.rotation.set(walkState.pitch, walkState.yaw, 0);
    if (moving) updateBottomReadout();
  } else {
    orbit.update();
  }

  for (const act of scaleActors) {
    if (act.v8?.update) act.v8.update(dt);
  }
  const holder = parcelHolder === 'bekele' ? intKeeperHuman : extScaleHuman;
  parcelMesh.position.set(
    holder.root.position.x + Math.sin(holder.root.rotation.y) * 0.32,
    holder.root.position.y + 1.04,
    holder.root.position.z + Math.cos(holder.root.rotation.y) * 0.32
  );
  parcelMesh.rotation.y = holder.root.rotation.y;

  suite.updateAudio(dt, {
    isInside: walking && walkState.isInside && !doorOpen,
    nightMix: rawDaylight ? 0.0 : currentNightMix,
    submerged: false,
    moving,
    projectorDist: 99,
    projectorWet: false,
  });

  suite.render(scene, camera);
  labelRenderer.render(camera);
  requestAnimationFrame(animate);
}
animate();

window.__heroes = {
  selectHero,
  applyCameraStation,
  toggleWalk,
  toggleDoor,
  toggleParcel,
  get rawDaylight() {
    return rawDaylight;
  },
  setRawDaylight: (v) => {
    rawDaylight = !!v;
    applyLightingPass();
  },
  PROOFS_BY_HERO,
  suite,
};
