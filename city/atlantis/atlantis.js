// Make-Photo City — Atlantis: Plato Voice Nolli Ring -> Verne Nautilus Dive -> Oulipo Screening Hall
// Implements Design Briefs 1, 6, 8, and 9 with strict zero-emoji rule and 23 GPU Shaders.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  mountWebGLShaderSuite,
  loadPilotState,
  savePilotState,
  subscribePilotState,
  applyPilotUrlHash,
  NOLLI_LEDGER_KEY,
} from '../shader-suite-bar.js';
import { buildObject } from '../worldtext/kit.js';

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

// Living-to-Submerged Landmark Register (Brief 6 Deliverable)
// Explicitly keeps Verne's extinct-volcano submarine shelter separate from Ch. IX Doric ruins.
const LANDMARK_REGISTER = [
  {
    name: 'Severn Threshold & 12-Step Stair',
    living: 'Brick vestibule + sash window facing Inner Canal (+0.0 to +8.4 m)',
    submerged: 'Sunken basalt doorway & north-bearing 12-step stair entering Oulipo Hall (-38.0 m)',
    prov: 'checked',
    note: 'Same doorway axis, hinge state (pilot.doorOpen), and -Z stair run preserved across eras.',
  },
  {
    name: 'Inner Moat Stone Bridge',
    living: 'Single-arch pedestrian canal bridge linking Ring II to Central Island',
    submerged: 'Drowned twin piers & arch ribs visible overhead through the Nautilus glass lightwell',
    prov: 'inferred',
    note: 'Alignment +/-1.2 m between voice-plan canal width (4.2 s) and metric arch.',
  },
  {
    name: 'The +4.00 m Flood Datum Wall',
    living: 'Chalked anniversary line on harbor seawall ("Never repair the line")',
    submerged: 'Mineralized white salt encrustation marking the Fall water table',
    prov: 'recorded',
    note: 'Physical +4.00 m flood wear boundary, kept distinct from 4/10 object stripes.',
  },
  {
    name: 'Central Island Public Commons (#01-#52)',
    living: '52 white Nolli interiors sung by >=6 chorus mouths on Plato rings',
    submerged: '16-column Doric courtyard & stretched 35mm Oulipo screening sheet',
    prov: 'recorded',
    note: 'Frontage derived directly from spoken word duration (1.0 u = 1.0 s).',
  },
  {
    name: 'Mount Atlas Volcanic Fissure (Ch. IX)',
    living: 'Northern mountain ridge bounding the plain of Critias',
    submerged: 'Submarine lava glow lighting ruined Doric colonnades during Nemo & Aronnax night walk',
    prov: 'literary',
    note: 'Jules Verne, Twenty Thousand Leagues Part II Ch. IX ("A Vanished Continent").',
  },
  {
    name: 'Extinct-Volcano Submarine Shelter (Ch. X)',
    living: 'Separate oceanic caldera outside the Atlantean ring plain',
    submerged: 'Captain Nemo closed coaling lagoon (KEPT SEPARATE — not merged into ruins)',
    prov: 'literary',
    note: 'Explicitly excluded from the Ch. IX seabed colonnade to honor account boundaries.',
  },
];

// 6-Shot SCION / Oulipo Threshold Itinerary (Brief 6 Acceptance Scene)
// Progresses from living street -> Severn room -> window bridge -> +4m salt line -> Verne glow -> submerged hall!
const SCION_STOPS = [
  {
    id: 'S01',
    stage: 'ring',
    depthT: 0.0,
    pos: [0, 74, 42],
    look: [0, 0, 2],
    kicker: 'SHOT S01 | PLATO VOICE NOLLI PLAN & CANAL BRIDGE',
    line: 'Fourteen poems arranged across concentric rings of land and water; 52 consensus commons carved in white.',
    meta: 'Account: Poetic Nolli (recorded) | 1.0 plan unit = 1.0 s spoken reading | Click any block or ring.',
  },
  {
    id: 'S02',
    stage: 'ring',
    depthT: 0.14,
    pos: [4.2, 3.2, 31.5],
    look: [0, 2.4, 21.5],
    kicker: 'SHOT S02 | LIVING STREET, BRIDGE & SEVERN THRESHOLD DOOR',
    line: 'Approach across the Inner Canal Bridge toward the Severn doorway; parcel ownership & door state persist.',
    meta: 'Account: Severn Pilot (checked) | Toggle Severn Door or hand off parcel in Register & Pilot tab.',
  },
  {
    id: 'S03',
    stage: 'dive',
    depthT: 0.24,
    pos: [0.0, 5.8, 19.2],
    look: [0.0, 2.2, 29.0],
    kicker: 'SHOT S03 | INSIDE SEVERN LOOKING BACK AT THE SAME BRIDGE',
    line: 'From the upper room window, look back across the canal bridge before crossing into the submerged account.',
    meta: 'Account: Threshold Reverse Angle (checked) | Same bridge & stair axis verified before descent.',
  },
  {
    id: 'S04',
    stage: 'dive',
    depthT: 0.42,
    pos: [12.5, 4.1, 25.5],
    look: [0.0, 3.8, 16.0],
    kicker: 'SHOT S04 | THE +4.00 METRE SALT FLOOD DATUM',
    line: '"You may plate a ruin in white ceramic, but you never paint over the flood line at four metres."',
    meta: 'Account: Gazetteer & Language (recorded) | Physical +4.00 m wear datum crossed into cobalt water.',
  },
  {
    id: 'S05',
    stage: 'dive',
    depthT: 0.68,
    pos: [-6.0, -15.5, 27.5],
    look: [6.0, -21.0, 2.0],
    kicker: 'SHOT S05 | VERNE: A VANISHED CONTINENT (PART II, CH. IX)',
    line: 'Night walk past obstructed basalt; Mount Atlas red mineral lava-glow & Nautilus beam reveal Doric columns.',
    meta: 'Account: Literary Second Reading (Verne 1870) | Arrival staged before overview; volcano shelter kept separate.',
  },
  {
    id: 'S06',
    stage: 'screening',
    depthT: 1.0,
    pos: [0.0, -35.6, 12.6],
    look: [0.0, -35.2, -9.5],
    kicker: 'SHOT S06 | SUBMERGED OULIPO SCREENING COURTYARD (-38.0 M)',
    line: 'Same 12-step stair & doorway survive underwater, opening onto the Oulipo shot-pool sheet & Codex Duets.',
    meta: 'Account: PAELEO SCION Screening + Codex Duets | WASD walk, switch Cut A/B, or return to Ring Map.',
  },
];

// ---------------------------------------------------------------------------
// 2. Scene, Renderer, Camera & 23-Look GPU Shader Suite
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
scene.background = new THREE.Color('#0c1f38');
scene.fog = new THREE.FogExp2('#0c223d', 0.0062);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.15, 320);
camera.position.set(0, 74, 42);
camera.lookAt(0, 0, 2);

const hemiLight = new THREE.HemisphereLight('#bce8ff', '#1b2b3a', 1.38);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#ffd7a8', 2.45);
sunLight.position.set(34, 58, 32);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 2;
sunLight.shadow.camera.far = 180;
const sd = 65;
sunLight.shadow.camera.left = -sd;
sunLight.shadow.camera.right = sd;
sunLight.shadow.camera.top = sd;
sunLight.shadow.camera.bottom = -sd;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// Underwater bioluminescent cyan lightwell + Verne volcanic mineral glow
const lightwellGlow = new THREE.PointLight('#18b4ff', 38, 52, 1.4);
lightwellGlow.position.set(0, -24, 0);
scene.add(lightwellGlow);

const volcanoGlow = new THREE.PointLight('#f26b2e', 34, 48, 1.5);
volcanoGlow.position.set(-22, -23, -14);
scene.add(volcanoGlow);

const screenBounceLight = new THREE.PointLight('#7ce8ff', 18, 26, 1.5);
screenBounceLight.position.set(0, -34.5, -7.5);
scene.add(screenBounceLight);

let currentTimePresetKey = 'bluehour';
const suite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: pilot.shader || 'weave',
  defaultTime: 'bluehour',
  locationName: 'Atlantis Nolli Ring & Oulipo Hall',
  cartridgeName: 'Atlantis',
  onTimeChange: (key, preset) => {
    currentTimePresetKey = key;
    applyAtmosphereForDepth(state.depthT, preset);
  },
});

// ---------------------------------------------------------------------------
// 3. Procedural Architectural & Nolli Textures
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
      const v = (Math.random() - 0.5) * 22;
      g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 248 : 10},${v > 0 ? 235 : 20},${Math.abs(v) / 140})`;
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
    g.fillStyle = 'rgba(38, 72, 68, 0.36)';
    g.fillRect(0, 290, 512, 222);
    g.fillStyle = '#f4eedd';
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
  grd.addColorStop(0, '#123e63');
  grd.addColorStop(0.55, '#0c2642');
  grd.addColorStop(1, '#08182c');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(24, 180, 255, 0.28)';
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

const stoneTex = makeStoneTexture('#586a74', 'rgba(24,180,255,0.55)', false);
const floodWallTex = makeStoneTexture('#6e463a', 'rgba(24,180,255,0.75)', true);
const parchmentMat = new THREE.MeshStandardMaterial({ color: '#efe7d2', roughness: 0.72, metalness: 0.04 });
const publicCommonsMat = new THREE.MeshStandardMaterial({
  color: '#faf6eb',
  emissive: '#18b4ff',
  emissiveIntensity: 0.14,
  roughness: 0.36,
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

// ---------------------------------------------------------------------------
// 4. Stage 1 — Plato Concentric Rings + 610 Real Word-Blocks + Severn Bridge
// ---------------------------------------------------------------------------
const RING_SCALE = 0.72; // 1 voice-second unit -> 0.72 world units on plan disc (metric section = 1.85m)
const worldRoot = new THREE.Group();
scene.add(worldRoot);

// Ocean surface plane
const oceanGeo = new THREE.CircleGeometry(190, 96);
oceanGeo.rotateX(-Math.PI / 2);
const oceanMesh = new THREE.Mesh(oceanGeo, canalMat);
oceanMesh.position.y = -0.05;
oceanMesh.receiveShadow = true;
worldRoot.add(oceanMesh);

// Concentric Plato Land Rings (matching plan.svg exact radii * RING_SCALE)
// Central Island: 0..26.4 | Inner Moat: 26.4..30.6 | Center Ring: 30.6..37.4 | Mid Moat: 37.4..41.6 | Outer Ring: 41.6..48.4 | Outer Moat: 48.4..52.6
const PLATO_LAND_RINGS = [
  { id: 'atlantis-island', label: 'Atlantis Central Island', rIn: 0.0, rOut: 26.4 * RING_SCALE, color: '#dfd5be', y: 0.35 },
  { id: 'center-ring', label: 'The Center Ring (Repair & Recurrence)', rIn: 30.6 * RING_SCALE, rOut: 37.4 * RING_SCALE, color: '#d5cab2', y: 0.32 },
  { id: 'baltimere-ring', label: 'Baltimere Outer Ring (Origins)', rIn: 41.6 * RING_SCALE, rOut: 48.4 * RING_SCALE, color: '#cbc0a8', y: 0.28 },
  { id: 'outer-plain', label: 'Critias Plain & Mountains', rIn: 52.6 * RING_SCALE, rOut: 64.0 * RING_SCALE, color: '#645c50', y: 0.22 },
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
  const mat = new THREE.MeshStandardMaterial({ color: rg.color, roughness: 0.78, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = rg.y;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.userData.ringId = rg.id;
  mesh.userData.ringLabel = rg.label;
  worldRoot.add(mesh);
  ringPickMeshes.push(mesh);

  // Cyan canal quay rim on every ring edge
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

// Magic Ride Sea Canal Spine (+Z axis from Inner Moat to Outer Sea)
const seaCanal = new THREE.Mesh(
  new THREE.BoxGeometry(3.4, 0.62, 34),
  new THREE.MeshStandardMaterial({ color: '#0d4f78', emissive: '#18b4ff', emissiveIntensity: 0.55, roughness: 0.15 })
);
seaCanal.position.set(0, 0.08, 33);
worldRoot.add(seaCanal);

// Registered Stone Canal Bridge + Severn Threshold Building (Brief 6 Continuity!)
const severnGroup = new THREE.Group();
worldRoot.add(severnGroup);

// Stone Canal Bridge across Inner Moat (r = 19.0 .. 22.1 -> z = 23.0 .. 28.5)
const bridgeDeck = new THREE.Mesh(
  new THREE.BoxGeometry(3.6, 0.55, 6.8),
  new THREE.MeshStandardMaterial({ color: '#e8dfc9', roughness: 0.6 })
);
bridgeDeck.position.set(0, 1.35, 25.6);
bridgeDeck.castShadow = true;
bridgeDeck.receiveShadow = true;
severnGroup.add(bridgeDeck);

[-1.65, 1.65].forEach((bx) => {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 6.8), parchmentMat);
  rail.position.set(bx, 1.95, 25.6);
  severnGroup.add(rail);
});

// Severn Threshold Pavilion at z = 19.2 (with +4.00m Salt Flood Line, Sash Window facing bridge, and Operable Door!)
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

// Explicit +4.00m Salt Flood Datum Band on Severn & Seawall
const saltBandSurface = new THREE.Mesh(
  new THREE.BoxGeometry(8.2, 0.18, 4.85),
  new THREE.MeshStandardMaterial({ color: '#faf6eb', emissive: '#faf6eb', emissiveIntensity: 0.32, roughness: 0.4 })
);
saltBandSurface.position.set(0, 4.0, 19.2);
severnGroup.add(saltBandSurface);

// Operable Severn Surface Door Pivot
const surfaceDoorPivot = new THREE.Group();
surfaceDoorPivot.position.set(-0.95, 0.35, 21.4);
const surfaceDoorLeaf = new THREE.Mesh(
  new THREE.BoxGeometry(1.85, 3.1, 0.14),
  new THREE.MeshStandardMaterial({ color: '#cbb182', roughness: 0.45, metalness: 0.25 })
);
surfaceDoorLeaf.position.set(0.92, 1.55, 0);
surfaceDoorPivot.add(surfaceDoorLeaf);
severnGroup.add(surfaceDoorPivot);

// 12-Step Stair descending -Z from Severn Threshold toward central lightwell
for (let st = 0; st < 12; st++) {
  const step = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.26, 0.55), parchmentMat);
  step.position.set(0, 1.2 - st * 0.22, 16.6 - st * 0.52);
  severnGroup.add(step);
}

// High-res plan.svg decal disc on Central Island for razor-sharp Nolli typography
const svgGroundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(141.2 * RING_SCALE, 181.955 * RING_SCALE),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.42, depthWrite: false })
);
svgGroundPlane.rotation.x = -Math.PI / 2;
svgGroundPlane.position.set(0, 0.41, 8.2 * RING_SCALE);
worldRoot.add(svgGroundPlane);

// Word-block meshes group (populated when data/plan.json loads)
const blocksGroup = new THREE.Group();
worldRoot.add(blocksGroup);
const blockPickMeshes = [];
const blockMeshByIndex = new Map();
const highlightRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.2, 0.12, 10, 32),
  new THREE.MeshBasicMaterial({ color: '#f2a541' })
);
highlightRing.rotation.x = Math.PI / 2;
highlightRing.visible = false;
worldRoot.add(highlightRing);

// ---------------------------------------------------------------------------
// 5. Stage 2 & Stage 3 — Submerged Descent, Verne's Nautilus & Oulipo Courtyard (-38 m)
// ---------------------------------------------------------------------------
const abyssGroup = new THREE.Group();
scene.add(abyssGroup);

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

// Luminous +4.00 m Flood Datum Ring on the seawall
const datumTorus = new THREE.Mesh(
  new THREE.TorusGeometry(33.2, 0.22, 10, 96),
  new THREE.MeshStandardMaterial({ color: '#faf6eb', emissive: '#faf6eb', emissiveIntensity: 0.65 })
);
datumTorus.rotation.x = Math.PI / 2;
datumTorus.position.y = 4.0;
abyssGroup.add(datumTorus);

// Obstructed Basalt Night-Walk Boulders & Mount Atlas Volcanic Lava Fissures (Verne Ch. IX)
const basaltMat = new THREE.MeshStandardMaterial({ color: '#242c35', roughness: 0.88 });
const lavaSeamMat = new THREE.MeshStandardMaterial({
  color: '#ff7a38',
  emissive: '#f25c19',
  emissiveIntensity: 2.2,
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

// Jules Verne's Nautilus Iron Submersible + Sweeping Salon Observation Beam (y = -18.5 m)
const nautilusGroup = new THREE.Group();
nautilusGroup.position.set(16.0, -17.5, 8.0);
nautilusGroup.rotation.y = -2.35;
abyssGroup.add(nautilusGroup);

const hullMat = new THREE.MeshStandardMaterial({ color: '#273542', roughness: 0.38, metalness: 0.76 });
const hullBody = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 11.0, 20), hullMat);
hullBody.rotation.z = Math.PI / 2;
nautilusGroup.add(hullBody);
[-5.5, 5.5].forEach((hx) => {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.75, 4.4, 20), hullMat);
  cone.rotation.z = hx > 0 ? -Math.PI / 2 : Math.PI / 2;
  cone.position.x = hx + (hx > 0 ? 2.2 : -2.2);
  nautilusGroup.add(cone);
});
const wheelhouse = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 1.1), hullMat);
wheelhouse.position.set(0.8, 1.85, 0);
nautilusGroup.add(wheelhouse);

// Glowing Salon Plate-Glass Window
const salonPort = new THREE.Mesh(
  new THREE.CircleGeometry(0.95, 24),
  new THREE.MeshBasicMaterial({ color: '#9cf4ff', side: THREE.DoubleSide })
);
salonPort.position.set(1.2, 0.2, 1.78);
nautilusGroup.add(salonPort);

// Volumetric Observation Beam Cone
const beamGeo = new THREE.ConeGeometry(3.4, 20.0, 24, 1, true);
beamGeo.translate(0, -10.0, 0);
beamGeo.rotateX(-Math.PI / 2);
const beamMat = new THREE.MeshBasicMaterial({
  color: '#3ce0ff',
  transparent: true,
  opacity: 0.085,
  side: THREE.FrontSide,
  depthWrite: false,
});
const nautilusBeam = new THREE.Mesh(beamGeo, beamMat);
nautilusBeam.position.set(1.2, 0.2, 1.82);
nautilusGroup.add(nautilusBeam);

// Glass-Dome Lightwell ("Nautilus-Well") crowning the Submerged Courtyard
const domeMesh = new THREE.Mesh(
  new THREE.TorusGeometry(13.5, 0.18, 12, 72),
  new THREE.MeshStandardMaterial({
    color: '#8ce8ff',
    emissive: '#18b4ff',
    emissiveIntensity: 0.9,
    roughness: 0.2,
  })
);
domeMesh.rotation.x = Math.PI / 2;
domeMesh.position.set(0, -24.5, 0);
abyssGroup.add(domeMesh);

for (let rib = 0; rib < 8; rib++) {
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(13.5, 0.09, 8, 48, Math.PI),
    new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 0.75 })
  );
  arch.position.set(0, -24.5, 0);
  arch.rotation.y = (rib / 8) * Math.PI;
  abyssGroup.add(arch);
}

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

// Carved White Nolli Inlay Ring on Courtyard Floor
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
  // Leave clear sightline directly behind screen & stair axis
  const rad = 13.8;
  const cx = Math.cos(a) * rad;
  const cz = Math.sin(a) * rad;
  const colGrp = new THREE.Group();
  colGrp.position.set(cx, FLOOR_Y, cz);

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.45, 1.35), colStoneMat);
  base.position.y = 0.225;
  colGrp.add(base);

  const colH = i % 5 === 2 ? 5.2 : 7.8; // Honest broken ruins repaired in ceramic
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, colH, 16), colStoneMat);
  shaft.position.y = 0.45 + colH / 2;
  shaft.castShadow = true;
  colGrp.add(shaft);

  // Kintsugi ceramic plate + cyan seam at repair joint
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

// Continuity Structure Underwater (South Side z = +15..+24):
// Same Severn Threshold Doorway, Operable Door Leaf, 12-Step Stair (-Z), and Submerged Bridge Piers!
const subSevernGroup = new THREE.Group();
subSevernGroup.position.set(0, FLOOR_Y, 0);
abyssGroup.add(subSevernGroup);

for (let st = 0; st < 12; st++) {
  const tread = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.28, 0.56), kintsugiSleeveMat);
  tread.position.set(0, (11 - st) * 0.25 + 0.14, 21.8 - st * 0.54);
  subSevernGroup.add(tread);
}
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
  new THREE.MeshStandardMaterial({ color: '#cbb182', emissive: '#18b4ff', emissiveIntensity: 0.18, roughness: 0.4 })
);
subDoorLeaf.position.set(0.97, 1.45, 0);
subDoorPivot.add(subDoorLeaf);
subSevernGroup.add(subDoorPivot);

// Submerged Canal Bridge Piers overhead behind the threshold (z = 26.5)
[-2.4, 2.4].forEach((bx) => {
  const bPier = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 14.0, 14), colStoneMat);
  bPier.position.set(bx, 7.0, 26.5);
  subSevernGroup.add(bPier);
});
const subBridgeArch = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.9, 3.2), kintsugiSleeveMat);
subBridgeArch.position.set(0, 13.8, 26.5);
subSevernGroup.add(subBridgeArch);

// Courtyard Kit Furniture (Benches facing the screen, Tide Lamps, Tide Board, Line Post)
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
// 6. Stretched 35 mm Oulipo Combinatorial Screening Sheet (z = -9.8, y = -34.2 m)
// ---------------------------------------------------------------------------
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
screenFrame.add(screenSheet);

// ---------------------------------------------------------------------------
// 7. Live Anny V8 Cast in Submerged Screening Courtyard + Parcel Ownership
// ---------------------------------------------------------------------------
const CAST_DEFS = [
  { id: 'poet', archetype: 'adult_m', name: 'The Poet', role: 'Dry Voice Spine', skin: '#613d2b', coat: '#182430', x: -2.4, z: -3.2, ry: 0.42 },
  { id: 'carrier', archetype: 'adult_f', name: 'Codex Carrier', role: 'Twin Sung Voice', skin: '#543525', coat: '#243c4c', x: 2.4, z: -3.2, ry: -0.42 },
  { id: 'bekele', archetype: 'elder', name: 'Bekele', role: 'Archive Keeper', skin: '#68432f', coat: '#3c3428', x: -2.8, z: 3.7, ry: 3.05 },
  { id: 'maren', archetype: 'adult_f', name: 'Maren', role: 'Severn 2A Witness', skin: '#7a523c', coat: '#2e4652', x: 2.8, z: 3.7, ry: -3.05 },
  { id: 'june', archetype: 'child7', name: 'June', role: 'Oulipo Projectionist', skin: '#4f3122', coat: '#1e3240', x: 0.0, z: 6.8, ry: Math.PI },
];

const castActors = [];
const v8Promises = new Map();

// Shared Severn Parcel Mesh (follows pilot.parcelHolder!)
const parcelMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.34, 0.22, 0.26),
  new THREE.MeshStandardMaterial({ color: '#e0b46a', emissive: '#f2a541', emissiveIntensity: 0.35, roughness: 0.4 })
);
abyssGroup.add(parcelMesh);

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

    const actor = { id: def.id, def, root, proxy, v8: null, talking: false, phase: idx * 1.3 };
    castActors.push(actor);

    if (typeof window !== 'undefined' && window.AnnyHumanV7 && window.AnnyHumanV7.createCharacter) {
      // Create independent instance per actor so all 5 render simultaneously
      window.AnnyHumanV7.createCharacter({
        THREE,
        loader: gltfLoader,
        archetype: def.archetype,
        assetBaseUrl: '../../abyssinian-highlands/human-forge/assets',
        clipsBaseUrl: '../../motion-pipeline/mesh2motion/clips',
        clothed: true,
        groundY: FLOOR_Y,
        preloadClips: ['idle', 'idle-talking'],
        initialClip: 'idle',
      })
        .then((inst) => {
          if (!inst) return;
          inst.root.position.set(0, 0, 0);
          inst.root.rotation.set(0, 0, 0);
          root.add(inst.root);
          proxy.visible = false;
          actor.v8 = inst;
          inst.setGroundY(FLOOR_Y);
        })
        .catch(() => {});
    }
  });
}
spawnCast();

// ---------------------------------------------------------------------------
// 8. Oulipo Shot Pool + Player-Captured Plates (make_photo_city_nolli_v1)
// ---------------------------------------------------------------------------
const BASE_SHOT_POOL = [
  { slot: 1, reslot: 6, fr: "L'horloge", en: 'Dispatcher Wall Clock', palette: ['#0c1f38', '#18b4ff', '#f4eedd'], motif: 'clock' },
  { slot: 2, reslot: 3, fr: 'Le colis', en: 'Hand Carrying Sealed Parcel', palette: ['#1d2b3a', '#e0b46a', '#f4eedd'], motif: 'parcel' },
  { slot: 3, reslot: 5, fr: 'La trotteuse', en: 'Conductor Second Hand', palette: ['#132840', '#5fe8ff', '#dfd3bc'], motif: 'watch' },
  { slot: 4, reslot: 2, fr: 'La porte', en: 'Severn Threshold Doorway', palette: ['#2b1e1a', '#f2a541', '#f4eedd'], motif: 'door' },
  { slot: 5, reslot: 1, fr: 'Le regard', en: 'Witness Glance Across Canal', palette: ['#0f263c', '#18b4ff', '#e8dec8'], motif: 'glance' },
  { slot: 6, reslot: 4, fr: 'Le recu', en: 'Tide Office Counter Slips', palette: ['#14303e', '#5fe8ff', '#ecebe4'], motif: 'slips' },
  { slot: 7, reslot: 7, fr: 'La sortie', en: 'Departure Along Salt Stair', palette: ['#1b2836', '#c74a3a', '#f4eedd'], motif: 'stair' },
  { slot: 8, reslot: 8, fr: 'Le seuil', en: 'Submerged Courtyard Threshold', palette: ['#08182c', '#24e0ff', '#f4eedd'], motif: 'threshold' },
];

const playerPlateImages = [];
function refreshPlayerPlates() {
  playerPlateImages.length = 0;
  try {
    const raw = localStorage.getItem(NOLLI_LEDGER_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    (parsed.plates || []).slice(-4).forEach((p) => {
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
//    (Brief 8: ZERO voice doubling, delaySend = 0, calm water/stone room tone,
//     speech ducking -9 dB, door-coupled lowpass muffling!)
// ---------------------------------------------------------------------------
class CleanCodexDuetEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.roomFilter = null;
    this.duckGain = null;
    this.convolver = null;
    this.waterSrc = null;
    this.stoneSrc = null;
    this.active = false;
    this.speakingRole = null; // null | 'poet' | 'breath' | 'carrier'
    this.currentSubtitle = '';
    this.stopToken = 0;
    this.activeAudioEl = null;
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
      this.roomFilter.frequency.value = pilot.doorOpen ? 1050 : 480;

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
    this.active = true;
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
    this.waterSrc = await loadLoop('../../audio/samples/river_gorge.mp3', 0.68, 0.36);
    this.stoneSrc = await loadLoop('../../audio/samples/ethiopia_field.mp3', 0.82, 0.14);
  }

  syncDoorAndDepth(doorOpen, depthT) {
    if (!this.ctx || !this.roomFilter) return;
    const baseHz = depthT > 0.45 ? 920 : 2800;
    const cutoff = doorOpen ? baseHz : Math.min(460, baseHz * 0.48);
    this.roomFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.18);
  }

  _setDucking(isSpeaking) {
    if (!this.ctx || !this.duckGain) return;
    const buses = (pilot && pilot.audioBuses) || {};
    const ambBase = Number.isFinite(buses.localAmbience) ? buses.localAmbience * 0.55 : 0.32;
    const target = isSpeaking ? ambBase * 0.28 : ambBase;
    this.duckGain.gain.setTargetAtTime(target, this.ctx.currentTime, isSpeaking ? 0.04 : 0.28);
  }

  hush() {
    this.stopToken++;
    this.speakingRole = null;
    this.currentSubtitle = '';
    if (this.activeAudioEl) {
      try {
        this.activeAudioEl.pause();
      } catch {}
      this.activeAudioEl = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this._setDucking(false);
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
      this.active = false;
    }
    updateDuetTurnBadge('HUSHED (0 ECHO)');
  }

  _speakSingleTurn(text, role, pitch = 1.0, rate = 0.94, token) {
    return new Promise((resolve) => {
      if (token !== this.stopToken) {
        resolve();
        return;
      }
      this.speakingRole = role;
      this.currentSubtitle = `${role === 'poet' ? 'POET (DRY)' : 'CARRIER (SUNG TWIN)'}: "${text}"`;
      this._setDucking(true);
      updateDuetTurnBadge(role === 'poet' ? 'VOICE A: POET (DRY)' : 'VOICE B: CARRIER REPLY');

      const fallbackMs = Math.max(1600, Math.min(4800, text.length * 52));
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
        } catch {
          // Headless fallback uses timed subtitle cadence cleanly
        }
      }
    });
  }

  async playTurnTakingLine(lineObj, mode = 'twin') {
    await this.ensureStarted();
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(0.85, this.ctx.currentTime, 0.1);
    }
    const token = ++this.stopToken;
    const text = lineObj.text || 'The gates open with wings gifted from evolution.';
    const f0 = (lineObj.voice && lineObj.voice.f0) || 185;
    const carrierPitch = Math.max(0.75, Math.min(1.45, f0 / 155));

    if (mode === 'read' || mode === 'twin') {
      await this._speakSingleTurn(text, 'poet', 0.94, 0.93, token);
    }
    if (token !== this.stopToken) return;

    if (mode === 'twin') {
      // Explicit 0.45 s breath silence between call and response (zero overlap!)
      this.speakingRole = 'breath';
      updateDuetTurnBadge('BREATH SILENCE (0.45S)');
      this._setDucking(false);
      await new Promise((r) => setTimeout(r, 450));
    }
    if (token !== this.stopToken) return;

    if (mode === 'sung' || mode === 'twin') {
      await this._speakSingleTurn(lineObj.heard || text, 'carrier', carrierPitch, 0.88, token);
    }
    if (token === this.stopToken) {
      this.speakingRole = null;
      this._setDucking(false);
      updateDuetTurnBadge('READY (TURN COMPLETE)');
    }
  }

  async playWholePoemDuet(lines) {
    await this.ensureStarted();
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(0.85, this.ctx.currentTime, 0.1);
    }
    const token = ++this.stopToken;
    const subset = (lines || []).slice(0, 6);
    for (const ln of subset) {
      if (token !== this.stopToken) break;
      await this.playTurnTakingLine(ln, 'twin');
      if (token !== this.stopToken) break;
      await new Promise((r) => setTimeout(r, 380));
    }
  }
}

const duetEngine = new CleanCodexDuetEngine();

// ---------------------------------------------------------------------------
// 10. State, Camera Choreography & WASD Courtyard Walk
// ---------------------------------------------------------------------------
const state = {
  stage: 'ring', // 'ring' | 'dive' | 'screening'
  depthT: 0.0, // 0.0 = +74m overhead plan, 1.0 = -38m Oulipo hall
  targetDepthT: 0.0,
  animatingDive: false,
  selectedPoem: pilot.poem || '06',
  selectedBlock: null,
  account: 'poetic-nolli',
  oulipoWorks: [],
  activeWorkIdx: 0,
  cutMode: 'pool', // 'pool' | 'reslot' | 'palindrome' | 'fibonacci'
  frameTick: 0,
  planData: null,
  codexByPoem: {},
  duetsMeta: {},
  samplesByPoem: {},
  walkOffset: new THREE.Vector3(0, 0, 0),
  lookYaw: 0,
  lookPitch: 0,
};

// Dive Spline Keyframes (Overhead Plato Ring -> Bridge/Severn -> +4m Salt Line -> Verne Nautilus -> Oulipo Hall)
const DIVE_CURVE_POS = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 74, 42),
  new THREE.Vector3(6, 26, 36),
  new THREE.Vector3(10, 4.2, 26),
  new THREE.Vector3(-12, -16, 20),
  new THREE.Vector3(6, -26, 16),
  new THREE.Vector3(0, -35.8, 12.8),
]);

const DIVE_CURVE_LOOK = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 2),
  new THREE.Vector3(0, 1.8, 19),
  new THREE.Vector3(0, 3.6, 15),
  new THREE.Vector3(4, -20, 2),
  new THREE.Vector3(0, -32, -6),
  new THREE.Vector3(0, -34.2, -9.8),
]);

function applyAtmosphereForDepth(depthT, preset) {
  const topSky = new THREE.Color((preset && preset.skyTop) || '#0c1f38');
  const abyssCol = new THREE.Color('#061528');
  const volcanoTint = new THREE.Color('#1a1626');
  const c = topSky.clone().lerp(abyssCol, Math.min(1, depthT * 1.25));
  if (state.account === 'verne-continent' && depthT > 0.35) {
    c.lerp(volcanoTint, 0.32);
  }
  scene.background.copy(c);
  scene.fog.color.copy(c);
  scene.fog.density = 0.0048 + depthT * 0.011;

  volcanoGlow.intensity = state.account === 'verne-continent' ? 58 : 34;
  nautilusBeam.material.opacity = depthT > 0.25 ? 0.08 : 0.03;
  duetEngine.syncDoorAndDepth(pilot.doorOpen, depthT);
}

function setDepthProgress(t, manual = false) {
  state.depthT = Math.max(0, Math.min(1, t));
  if (manual) {
    state.targetDepthT = state.depthT;
    state.animatingDive = false;
    state.walkOffset.set(0, 0, 0);
  }
  const elevM = 14.0 - state.depthT * 52.0; // +14.0m down to -38.0m
  const rd = document.getElementById('depth-readout');
  const sc = document.getElementById('depth-scrub');
  if (sc) sc.value = String(Math.round(state.depthT * 1000));
  if (rd) {
    const tag =
      state.depthT < 0.18 ? 'Plan' : state.depthT < 0.48 ? 'Salt Line' : state.depthT < 0.86 ? 'Nautilus' : 'Oulipo';
    rd.textContent = `${elevM >= 0 ? '+' : ''}${elevM.toFixed(1)} m ${tag}`;
  }

  const nextStage = state.depthT < 0.18 ? 'ring' : state.depthT > 0.88 ? 'screening' : 'dive';
  if (nextStage !== state.stage) {
    state.stage = nextStage;
    syncStageButtons();
  }
  applyAtmosphereForDepth(state.depthT, suite.timePresets[currentTimePresetKey]);
}

function syncStageButtons() {
  document.getElementById('btn-stage-1').classList.toggle('active', state.stage === 'ring');
  document.getElementById('btn-stage-2').classList.toggle('active', state.stage === 'dive');
  document.getElementById('btn-stage-3').classList.toggle('active', state.stage === 'screening');

  const kicker = document.getElementById('stage-kicker');
  const head = document.getElementById('stage-heading');
  const sub = document.getElementById('stage-sub');
  if (state.stage === 'ring') {
    kicker.textContent = 'STAGE 01 | PLATO RING NOLLI PLAN';
    head.textContent = 'Atlantis: The City Fourteen Poems Built';
    sub.textContent = 'Every word a building, every breath a piazza, >=6 mouths a carved white public interior.';
  } else if (state.stage === 'dive') {
    kicker.textContent = 'STAGE 02 | JULES VERNE NAUTILUS DESCENT';
    head.textContent = 'A Vanished Continent: +4.0m Line to Doric Ruins';
    sub.textContent = 'Descending past the +4.0m salt flood datum, Mount Atlas mineral glow, and Nautilus beam.';
  } else {
    kicker.textContent = 'STAGE 03 | SUBMERGED OULIPO SCREENING (-38 M)';
    head.textContent = 'Oulipo Combinatorial Courtyard & Codex Duets';
    sub.textContent = 'WASD walk | Drag look | Switch Cut A/B on frozen pool | Strict 2-voice turn-taking audio.';
  }
}

function triggerStage(stageName) {
  state.customCam = null;
  state.walkOffset.set(0, 0, 0);
  state.lookYaw = 0;
  state.lookPitch = 0;
  if (stageName === 'ring') {
    state.targetDepthT = 0.0;
    state.animatingDive = true;
    activateTab('obs');
  } else if (stageName === 'dive') {
    // Smoothly dive from current position to submerged screening (or pause at Verne vista if already at bottom)
    state.targetDepthT = state.depthT > 0.88 ? 0.68 : 1.0;
    state.animatingDive = true;
    activateTab('oulipo');
  } else {
    state.targetDepthT = 1.0;
    state.animatingDive = true;
    activateTab('oulipo');
  }
}

// ---------------------------------------------------------------------------
// 11. Build 610 Real 3D Word-Blocks + SVG Texture + 2D Modal from data/plan.*
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
  const matCache = {};
  const getBlockMat = (num, isPub) => {
    if (isPub) return publicCommonsMat;
    if (!matCache[num]) {
      matCache[num] = new THREE.MeshStandardMaterial({
        color: POEM_RING_COLORS[num] || '#7a6855',
        roughness: 0.62,
        metalness: 0.08,
      });
    }
    return matCache[num];
  };

  for (const b of plan.blocks) {
    const gm = b.geom;
    if (!gm) continue;
    const dur = Math.max(0.2, (b.e || 1) - (b.s || 0));
    const bh = (b.pub ? 1.85 : 0.65 + Math.min(1.6, dur * 0.28));
    let mesh = null;

    if (gm.kind === 'rect') {
      const geo = new THREE.BoxGeometry(
        Math.max(0.28, gm.w * RING_SCALE),
        bh,
        Math.max(0.28, gm.h * RING_SCALE)
      );
      mesh = new THREE.Mesh(geo, getBlockMat(b.num, !!b.pub));
      mesh.position.set(gm.x * RING_SCALE, 0.62 + bh / 2, gm.y * RING_SCALE);
    } else if (gm.kind === 'arc') {
      const r1 = gm.r1 * RING_SCALE;
      const r2 = gm.r2 * RING_SCALE;
      const dr = Math.max(0.32, r2 - r1);
      const rMid = (r1 + r2) * 0.5;
      const arcLen = Math.max(0.34, Math.abs(gm.da) * rMid);
      const aMid = gm.a1 + gm.da * 0.5;
      const geo = new THREE.BoxGeometry(arcLen, bh, dr);
      mesh = new THREE.Mesh(geo, getBlockMat(b.num, !!b.pub));
      const wx = Math.cos(aMid) * rMid;
      const wz = Math.sin(aMid) * rMid;
      mesh.position.set(wx, 0.62 + bh / 2, wz);
      mesh.rotation.y = -aMid + Math.PI / 2;
    }

    if (mesh) {
      mesh.castShadow = !!b.pub;
      mesh.receiveShadow = true;
      mesh.userData.block = b;
      blocksGroup.add(mesh);
      blockPickMeshes.push(mesh);
      blockMeshByIndex.set(b.i, mesh);
    }
  }
}

function selectBlock(b, focusRing = false) {
  if (!b) return;
  state.selectedBlock = b;
  if (b.num && b.num !== state.selectedPoem) {
    selectPoem(b.num, false);
  }
  const mesh = blockMeshByIndex.get(b.i);
  if (mesh) {
    highlightRing.position.set(mesh.position.x, mesh.position.y + 0.6, mesh.position.z);
    highlightRing.visible = true;
  }
  const pubInfo = b.pub
    ? `PUBLIC BUILDING #${String(b.pub).padStart(2, '0')} (${b.mouths} MOUTHS)`
    : `WORD BLOCK #${b.i}`;
  document.getElementById('caption-kicker').textContent = `${pubInfo} | POEM ${b.num} ${(POEM_TITLES[b.num] || '').toUpperCase()}`;
  document.getElementById('caption-line').textContent = `"${b.line || b.text}"`;
  document.getElementById('caption-meta').textContent = `${b.s.toFixed(1)}-${b.e.toFixed(1)} s (${(b.e - b.s).toFixed(2)} s frontage) | Click Dive to Screening to descend beneath this ring.`;

  // Highlight in 2D SVG if mounted
  const svgHost = document.getElementById('svg-host');
  svgHost.querySelectorAll('[data-b].on').forEach((el) => el.classList.remove('on'));
  const svgEl = svgHost.querySelector(`[data-b="${b.i}"]`);
  if (svgEl) svgEl.classList.add('on');

  if (focusRing && state.stage !== 'ring') {
    triggerStage('ring');
  }
}

// ---------------------------------------------------------------------------
// 12. Observatory 9-Lane Voice Canvas & Vowel Formant Orbit (observatory.html)
// ---------------------------------------------------------------------------
function drawObservatoryForPoem(num) {
  const track = state.samplesByPoem[num];
  const blocks = (state.planData ? state.planData.blocks : []).filter((b) => b.num === num);
  document.getElementById('obs-poem-title').textContent = `${num} | ${POEM_TITLES[num] || 'Poem'}`;
  document.getElementById('obs-poem-stats').textContent = `${blocks.length} word blocks`;

  const cv = document.getElementById('obs-lanes');
  const g = cv.getContext('2d');
  const W = cv.width;
  const H = cv.height;
  g.fillStyle = '#06101c';
  g.fillRect(0, 0, W, H);

  const dur = (track && track.dur) || (blocks.length ? blocks[blocks.length - 1].e : 90);
  const lanes = [
    { name: '01 BODY', y: 4, h: 22, col: '#5fe8ff' },
    { name: '02 F0 PULSE', y: 30, h: 24, col: '#e0b46a' },
    { name: '03 BREATH PIAZZA', y: 58, h: 20, col: '#18b4ff' },
    { name: '04 FORMANTS F1/F2', y: 82, h: 24, col: '#f2a541' },
    { name: '08 PHRASE BLOCKS', y: 110, h: 22, col: '#faf6eb' },
  ];

  lanes.forEach((ln) => {
    g.fillStyle = '#091829';
    g.fillRect(0, ln.y, W, ln.h);
    g.strokeStyle = 'rgba(244,238,221,0.1)';
    g.strokeRect(0, ln.y, W, ln.h);
    g.fillStyle = 'rgba(244,238,221,0.48)';
    g.font = '600 8px ui-monospace, monospace';
    g.fillText(ln.name, 5, ln.y + 9);
  });

  // Deterministic acoustic contour synthesized from real block timings & poem seed
  const seedBase = parseInt(num, 10) * 37;
  for (let x = 0; x < W; x += 2) {
    const t = (x / W) * dur;
    const activeB = blocks.find((b) => t >= b.s && t <= b.e);
    const amp = activeB ? 0.45 + 0.45 * Math.abs(Math.sin(t * 4.3 + seedBase)) : 0.04;
    // Body envelope
    g.fillStyle = activeB && activeB.pub ? '#f2a541' : 'rgba(95,232,255,0.65)';
    g.fillRect(x, 15 - amp * 9, 1.6, amp * 18);
    // F0 pitch contour
    if (activeB) {
      const py = 42 - Math.sin(t * 2.7 + seedBase) * 8;
      g.fillStyle = '#e0b46a';
      g.fillRect(x, py, 2, 2);
      // F1 / F2 formants
      g.fillStyle = '#f2a541';
      g.fillRect(x, 98 - Math.cos(t * 3.1) * 7, 1.6, 1.6);
      g.fillStyle = '#5fe8ff';
      g.fillRect(x, 89 - Math.sin(t * 5.2) * 5, 1.6, 1.6);
    } else {
      // Breath piazza marker in silence!
      g.fillStyle = 'rgba(24,180,255,0.42)';
      g.fillRect(x, 62, 1.5, 12);
    }
  }

  // Phrase blocks lane (white = >=6 mouths public building, cyan = private block)
  blocks.forEach((b) => {
    const bx = (b.s / dur) * W;
    const bw = Math.max(1.5, ((b.e - b.s) / dur) * W);
    g.fillStyle = b.pub ? '#faf6eb' : '#18b4ff';
    g.fillRect(bx, 115, bw, 13);
  });

  // Vowel Formant Orbit (F2 vs F1)
  const ob = document.getElementById('vowel-orbit');
  const og = ob.getContext('2d');
  og.fillStyle = '#06101c';
  og.fillRect(0, 0, ob.width, ob.height);
  for (let i = 0; i < 140; i++) {
    const u = i / 140;
    const ox = 16 + (0.5 + 0.42 * Math.sin(u * 19 + seedBase)) * (ob.width - 32);
    const oy = 14 + (0.5 + 0.4 * Math.cos(u * 13 + seedBase * 0.5)) * (ob.height - 28);
    og.fillStyle = `hsla(${188 + u * 45}, 82%, 64%, 0.48)`;
    og.fillRect(ox, oy, 2.2, 2.2);
  }
  og.fillStyle = 'rgba(244,238,221,0.55)';
  og.font = '9px ui-monospace, monospace';
  og.fillText('i', 6, 12);
  og.fillText('a', 52, 90);
  og.fillText('u', 98, 12);
}

// ---------------------------------------------------------------------------
// 13. Oulipo Projector Canvas & Montage Permutations (Cut A / Cut B / Palindrome / Fibonacci)
// ---------------------------------------------------------------------------
function computeOrderedPool() {
  const pool = BASE_SHOT_POOL.map((s) => ({ ...s }));
  if (state.cutMode === 'pool') return pool;
  if (state.cutMode === 'reslot') {
    return [...pool].sort((a, b) => a.reslot - b.reslot);
  }
  if (state.cutMode === 'palindrome') {
    const half = pool.slice(0, 4);
    return [...half, ...[...half].reverse()];
  }
  // Oucipo Fibonacci montage: durations [1, 1, 2, 3, 5, 8, 5, 3]
  const fibIdx = [0, 3, 1, 4, 2, 7, 5, 6];
  return fibIdx.map((i) => pool[i]);
}

function renderPoolStripUI() {
  const host = document.getElementById('pool-strip');
  if (!host) return;
  const ordered = computeOrderedPool();
  const activeSlotIdx = Math.floor(state.frameTick / 3.2) % ordered.length;
  host.innerHTML = ordered
    .map((item, idx) => {
      const renumbered = state.cutMode !== 'pool' && item.slot !== idx + 1;
      return `<div class="pool-slot ${idx === activeSlotIdx ? 'active' : ''}" data-slot="${idx}">
        <div>${renumbered ? `<span class="strike">0${item.slot}</span><span class="red-num">0${idx + 1}</span>` : `0${item.slot}`} ${item.fr}</div>
        <small>${item.en}</small>
      </div>`;
    })
    .join('');
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
    byline: 'Oucipo & Raymond Queneau, c. 1974',
    status: 'open',
    line: 'Make different films from one locked inventory of shots.',
  };

  // Cream notebook / darkroom slate backdrop
  g.fillStyle = '#091626';
  g.fillRect(0, 0, W, H);

  // Left 62%: Projected Plate (Player captured plate if available on slot 2/4, else handmade architectural rostrum)
  const plateX = 36;
  const plateY = 66;
  const plateW = 590;
  const plateH = 408;

  g.fillStyle = shot.palette[0];
  g.fillRect(plateX, plateY, plateW, plateH);

  const playerPlate = playerPlateImages.length ? playerPlateImages[idx % playerPlateImages.length] : null;
  if (playerPlate && playerPlate.img && playerPlate.img.complete && playerPlate.img.naturalWidth > 0 && idx % 2 === 1) {
    g.drawImage(playerPlate.img, plateX + 8, plateY + 8, plateW - 16, plateH - 16);
    g.fillStyle = 'rgba(8,21,38,0.78)';
    g.fillRect(plateX + 14, plateY + plateH - 46, 360, 30);
    g.fillStyle = '#5fe8ff';
    g.font = '600 14px ui-monospace, monospace';
    g.fillText(`SHARED LIGHT TABLE PLATE: ${playerPlate.caption.toUpperCase()}`, plateX + 24, plateY + plateH - 26);
  } else {
    // Crisp handmade architectural rostrum composition per motif
    const push = 1.0 + 0.08 * ((timeSec % 3.2) / 3.2);
    g.save();
    g.beginPath();
    g.rect(plateX, plateY, plateW, plateH);
    g.clip();
    g.translate(plateX + plateW / 2, plateY + plateH / 2);
    g.scale(push, push);

    // Concentric Nolli & flood line geometry inside frame
    g.strokeStyle = shot.palette[1];
    g.lineWidth = 3;
    for (let r = 45; r <= 210; r += 42) {
      g.beginPath();
      g.arc(0, 10, r, 0, Math.PI * 2);
      g.stroke();
    }
    // +4.0m Salt Flood Line across frame
    g.fillStyle = '#faf6eb';
    g.fillRect(-280, 42, 560, 5);
    g.font = '600 13px ui-monospace, monospace';
    g.fillText('+4.00 M FLOOD DATUM', 105, 34);

    // Severn Doorway & Parcel Silhouette
    g.fillStyle = shot.palette[2];
    g.fillRect(-48, -95, 96, 137);
    g.fillStyle = pilot.doorOpen ? '#18b4ff' : '#2a221c';
    g.fillRect(-34, -80, 68, 122);
    g.fillStyle = '#f2a541';
    g.fillRect(58, -12, 34, 24); // Brass parcel
    g.restore();
  }

  g.strokeStyle = '#efe7d2';
  g.lineWidth = 3;
  g.strokeRect(plateX, plateY, plateW, plateH);

  // Top Masthead on Screen
  g.fillStyle = '#f4eedd';
  g.font = '700 20px ui-monospace, monospace';
  g.fillText(`PAELEO SCION | ${work.work.toUpperCase()}`, 36, 42);
  g.fillStyle = '#5fe8ff';
  g.font = '600 14px ui-monospace, monospace';
  g.fillText(`CUT: ${state.cutMode.toUpperCase()} | POOL SHA256: 7E50704C...5164`, 640, 42);

  // Right 34%: Red Spiral Notebook Card & Critic Status
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

  // Wrap rule text cleanly
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
  g.fillText(`VERDICT: ${(work.status || 'OPEN').toUpperCase()}`, nbX + 26, nbY + 252);
  g.fillStyle = '#332c22';
  g.font = '13px ui-monospace, monospace';
  g.fillText(`PARCEL: ${pilot.parcelHolder.toUpperCase()}`, nbX + 26, nbY + 282);
  g.fillText(`SEVERN DOOR: ${pilot.doorOpen ? 'OPEN' : 'CLOSED'}`, nbX + 26, nbY + 306);
  g.fillText(`POEM: ${state.selectedPoem} ${POEM_TITLES[state.selectedPoem] || ''}`, nbX + 26, nbY + 330);
  g.fillText(`FORAGED OR HANDMADE, NEVER FAKED`, nbX + 26, nbY + 378);

  // Bottom Subtitle Bar (Codex Duet Call-and-Response)
  g.fillStyle = '#050d17';
  g.fillRect(36, 492, W - 72, 58);
  g.strokeStyle = 'rgba(24,180,255,0.45)';
  g.strokeRect(36, 492, W - 72, 58);
  g.fillStyle = duetEngine.speakingRole === 'carrier' ? '#f2a541' : '#7ce8ff';
  g.font = 'italic 18px Georgia, serif';
  const subTxt =
    duetEngine.currentSubtitle ||
    `Poem ${state.selectedPoem} (${POEM_TITLES[state.selectedPoem]}): Ready for strict 2-voice Codex Duet.`;
  g.fillText(subTxt.slice(0, 84), 52, 527);
  g.restore();

  screenTex.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// 14. UI Wiring, Tabs, Pilot Sync & Data Loading
// ---------------------------------------------------------------------------
function updateDuetTurnBadge(label) {
  const el = document.getElementById('duet-turn-state');
  if (el) el.textContent = label;
}

function activateTab(tabName) {
  document.querySelectorAll('.tab-btn[data-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  document.getElementById('tab-obs').hidden = tabName !== 'obs';
  document.getElementById('tab-oulipo').hidden = tabName !== 'oulipo';
  document.getElementById('tab-register').hidden = tabName !== 'register';
}

document.querySelectorAll('.tab-btn[data-tab]').forEach((b) => {
  b.addEventListener('click', () => activateTab(b.dataset.tab));
});

function toggleDrawer(force) {
  const d = document.getElementById('hud-right');
  const nextCollapsed = typeof force === 'boolean' ? force : !d.classList.contains('collapsed');
  d.classList.toggle('collapsed', nextCollapsed);
}
document.getElementById('btn-toggle-drawer').addEventListener('click', () => toggleDrawer());
document.getElementById('btn-close-drawer').addEventListener('click', () => toggleDrawer(true));
document.getElementById('drawer-toggle-floating').addEventListener('click', () => toggleDrawer(false));

document.getElementById('btn-stage-1').addEventListener('click', () => triggerStage('ring'));
document.getElementById('btn-stage-2').addEventListener('click', () => triggerStage('dive'));
document.getElementById('btn-stage-3').addEventListener('click', () => triggerStage('screening'));

document.getElementById('depth-scrub').addEventListener('input', (e) => {
  state.customCam = null;
  setDepthProgress(Number(e.target.value) / 1000, true);
});

document.getElementById('sel-account').addEventListener('change', (e) => {
  state.account = e.target.value;
  state.customCam = null;
  savePilotState({ account: state.account });
  if (state.account === 'verne-continent' && state.depthT < 0.55) {
    state.targetDepthT = 0.72;
    state.animatingDive = true;
  } else if (state.account === 'poetic-nolli' && state.depthT > 0.3) {
    state.targetDepthT = 0.0;
    state.animatingDive = true;
  }
  applyAtmosphereForDepth(state.depthT, suite.timePresets[currentTimePresetKey]);
});

// 6-Shot SCION Route Buttons
document.querySelectorAll('#scion-route-strip .route-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.stop);
    const stop = SCION_STOPS[idx];
    if (!stop) return;
    document.querySelectorAll('#scion-route-strip .route-btn').forEach((b) => b.classList.toggle('active', b === btn));
    state.animatingDive = false;
    state.walkOffset.set(0, 0, 0);
    state.lookYaw = 0;
    state.lookPitch = 0;
    setDepthProgress(stop.depthT, true);
    state.customCam = {
      pos: new THREE.Vector3(...stop.pos),
      look: new THREE.Vector3(...stop.look),
    };
    document.getElementById('caption-kicker').textContent = stop.kicker;
    document.getElementById('caption-line').textContent = `"${stop.line}"`;
    document.getElementById('caption-meta').textContent = stop.meta;
    savePilotState({ shot: stop.id });
  });
});

// Oulipo Montage Cut Buttons
document.querySelectorAll('[data-cut]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.cutMode = btn.dataset.cut;
    document.querySelectorAll('[data-cut]').forEach((b) => b.classList.toggle('active', b === btn));
    renderPoolStripUI();
    drawOulipoScreenCanvas(performance.now() * 0.001);
  });
});

function selectPoem(num, syncPilot = true) {
  state.selectedPoem = num;
  document.querySelectorAll('.poem-chip').forEach((c) => c.classList.toggle('active', c.dataset.num === num));
  drawObservatoryForPoem(num);
  renderCodexLinesForPoem(num);
  if (syncPilot) savePilotState({ poem: num });
}

function renderCodexLinesForPoem(num) {
  const poemEntry = state.codexByPoem[num];
  const host = document.getElementById('duet-lines-list');
  const meta = document.getElementById('duet-count-meta');
  if (!poemEntry || !poemEntry.lines || !poemEntry.lines.length) {
    meta.textContent = '0 carrier lines';
    host.innerHTML = `<div class="duet-row"><div style="font-size:11px;color:var(--muted);">No external sung carrier for Poem ${num} — Codex sings "Temple" in its place. Select Poem 02, 06, or 12 for multi-line duets.</div></div>`;
    return;
  }
  meta.textContent = `${poemEntry.lines.length} aligned twins`;
  host.innerHTML = '';
  poemEntry.lines.slice(0, 12).forEach((ln) => {
    const row = document.createElement('div');
    row.className = 'duet-row';
    const f0 = ln.voice && ln.voice.f0 ? `${ln.voice.f0} Hz` : 'twin';
    const dist = ln.voice && ln.voice.poet_dist ? `dist ${ln.voice.poet_dist}` : '';
    row.innerHTML = `
      <div style="font:italic 12px/1.35 var(--serif);color:var(--paper);">"${ln.text}"</div>
      <div class="duet-actions">
        <span style="font:400 9.5px var(--mono);color:var(--dim);margin-right:auto;">j=${ln.jaccard} | ${f0} ${dist}</span>
        <button type="button" class="btn-pill" data-act="read" style="padding:2px 6px;">Read</button>
        <button type="button" class="btn-pill" data-act="sung" style="padding:2px 6px;">Reply</button>
        <button type="button" class="btn-pill active" data-act="twin" style="padding:2px 6px;">Twin Duet</button>
      </div>
    `;
    row.querySelectorAll('button[data-act]').forEach((b) => {
      b.addEventListener('click', () => {
        host.querySelectorAll('.duet-row').forEach((r) => r.classList.remove('playing'));
        row.classList.add('playing');
        duetEngine.playTurnTakingLine(ln, b.dataset.act);
      });
    });
    host.appendChild(row);
  });
}

document.getElementById('btn-room-audio').addEventListener('click', () => {
  const entry = state.codexByPoem[state.selectedPoem] || state.codexByPoem['06'] || state.codexByPoem['02'];
  if (entry && entry.lines && entry.lines.length) {
    duetEngine.playWholePoemDuet(entry.lines);
  } else {
    duetEngine.playTurnTakingLine({ text: 'The gates open with wings gifted from evolution, and made of marble stones.' }, 'twin');
  }
});
document.getElementById('btn-play-duet-quick').addEventListener('click', () => {
  activateTab('oulipo');
  document.getElementById('btn-room-audio').click();
});
document.getElementById('btn-dive-poem').addEventListener('click', () => triggerStage('dive'));
document.getElementById('btn-stop-duet').addEventListener('click', () => duetEngine.hush());

// Landmark Register Table
const regTbody = document.querySelector('#landmark-register-table tbody');
regTbody.innerHTML = LANDMARK_REGISTER.map(
  (r) => `<tr>
    <td><b style="color:var(--paper);">${r.name}</b><br><span style="color:var(--dim);font-size:10px;">${r.note}</span></td>
    <td><span style="color:#efe7d2;">Living:</span> ${r.living}<br><span style="color:#7ce8ff;">Submerged:</span> ${r.submerged}</td>
    <td><span class="badge ${r.prov}">${r.prov}</span></td>
  </tr>`
).join('');

// Severn Pilot State UI Sync (Brief 9)
function applyPilotToScene(p) {
  pilot = p;
  const openAngle = p.doorOpen ? -1.18 : 0.0;
  surfaceDoorPivot.rotation.y = openAngle;
  subDoorPivot.rotation.y = openAngle;

  const doorBtn = document.getElementById('btn-pilot-door');
  if (doorBtn) {
    doorBtn.textContent = `Severn Door: ${p.doorOpen ? 'Open' : 'Closed'}`;
    doorBtn.classList.toggle('active', !!p.doorOpen);
  }
  const holderSel = document.getElementById('sel-parcel-holder');
  if (holderSel && holderSel.value !== p.parcelHolder) {
    holderSel.value = p.parcelHolder || 'player';
  }
  const syncEl = document.getElementById('pilot-sync-readout');
  if (syncEl) {
    syncEl.textContent = `SYNCED: building=${p.building} | poem=${p.poem} | door=${p.doorOpen ? 'open' : 'closed'} | parcel=${p.parcelHolder} | tide=${p.tidePhase}`;
  }

  // Position brass parcel with its current holder
  const holderActor = castActors.find((a) => a.id === p.parcelHolder);
  if (holderActor) {
    parcelMesh.position.set(holderActor.root.position.x + 0.34, FLOOR_Y + 1.05, holderActor.root.position.z + 0.25);
  } else {
    parcelMesh.position.set(0.55, FLOOR_Y + 1.15, 9.6);
  }
  duetEngine.syncDoorAndDepth(p.doorOpen, state.depthT);
}

document.getElementById('btn-pilot-door').addEventListener('click', () => {
  const next = !pilot.doorOpen;
  savePilotState({ doorOpen: next });
  applyPilotToScene(loadPilotState());
});
document.getElementById('sel-parcel-holder').addEventListener('change', (e) => {
  savePilotState({ parcelHolder: e.target.value });
  applyPilotToScene(loadPilotState());
});
subscribePilotState((next) => applyPilotToScene(next));
applyPilotToScene(pilot);

// 2D SVG Plan Sheet Modal + Pan/Zoom
let svgVB0 = [-70.6, -78.6, 141.2, 181.955];
let svgVB = svgVB0.slice();
function applySvgVB() {
  const svg = document.querySelector('#svg-host svg');
  if (svg) svg.setAttribute('viewBox', svgVB.join(' '));
}
document.getElementById('btn-svg-sheet').addEventListener('click', () => {
  document.getElementById('svg-modal').classList.add('open');
});
document.getElementById('svg-close').addEventListener('click', () => {
  document.getElementById('svg-modal').classList.remove('open');
});
document.getElementById('svg-zin').addEventListener('click', () => {
  svgVB = [svgVB[0] + svgVB[2] * 0.15, svgVB[1] + svgVB[3] * 0.15, svgVB[2] * 0.7, svgVB[3] * 0.7];
  applySvgVB();
});
document.getElementById('svg-zout').addEventListener('click', () => {
  svgVB = [svgVB[0] - svgVB[2] * 0.2, svgVB[1] - svgVB[3] * 0.2, Math.min(160, svgVB[2] * 1.4), Math.min(206, svgVB[3] * 1.4)];
  applySvgVB();
});
document.getElementById('svg-home').addEventListener('click', () => {
  svgVB = svgVB0.slice();
  applySvgVB();
});
document.getElementById('svg-dive-sel').addEventListener('click', () => {
  document.getElementById('svg-modal').classList.remove('open');
  triggerStage('dive');
});

// Load Bundled Upstream Datasets (Zero external 404s!)
async function loadDatasets() {
  const [planRes, svgRes, codexRes, duetsRes, sampRes, oulipoRes] = await Promise.all([
    fetch('./data/plan.json').then((r) => r.json()),
    fetch('./data/plan.svg').then((r) => r.text()),
    fetch('./data/codex_lines.json').then((r) => r.json()),
    fetch('./data/duets.json').then((r) => r.json()),
    fetch('./data/samples.json').then((r) => r.json()),
    fetch('./data/oulipo_catalogue.json').then((r) => r.json()),
  ]);

  state.planData = planRes;
  buildExtrudedBlocks(planRes);

  // Mount genuine plan.svg into 2D sheet modal AND rasterize onto 3D island decal
  const svgHost = document.getElementById('svg-host');
  svgHost.innerHTML = svgRes;
  const svgEl = svgHost.querySelector('svg');
  if (svgEl) {
    svgVB0 = svgEl.getAttribute('viewBox').split(/\s+/).map(Number);
    svgVB = svgVB0.slice();
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }
  const byI = Object.fromEntries(planRes.blocks.map((b) => [b.i, b]));
  svgHost.addEventListener('click', (e) => {
    const bi = e.target.closest('[data-b]');
    if (bi && byI[+bi.dataset.b]) {
      selectBlock(byI[+bi.dataset.b], false);
    }
  });

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

  // Populate 14 Poem Picker
  const picker = document.getElementById('poem-picker');
  Object.entries(POEM_TITLES).forEach(([num, title]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'poem-chip' + (num === state.selectedPoem ? ' active' : '');
    b.dataset.num = num;
    b.textContent = `${num} ${title}`;
    b.addEventListener('click', () => {
      selectPoem(num, true);
      const firstBlock = planRes.blocks.find((x) => x.num === num);
      if (firstBlock) selectBlock(firstBlock, false);
    });
    picker.appendChild(b);
  });

  // Populate 52 Public Buildings List
  const pubHost = document.getElementById('pub-list');
  pubHost.innerHTML = planRes.index
    .map(
      (x) => `<div class="pub-item" data-n="${x.n}">
        <b>#${String(x.n).padStart(2, '0')}</b>"${x.line}"
        <small>${x.num} ${x.poem} | sung by ${x.mouths} mouths: ${x.who.slice(0, 2).join(', ')}</small>
      </div>`
    )
    .join('');
  pubHost.addEventListener('click', (e) => {
    const item = e.target.closest('.pub-item');
    if (!item) return;
    const x = planRes.index.find((q) => q.n === Number(item.dataset.n));
    if (!x) return;
    const blk = planRes.blocks.find((q) => q.num === x.num && q.s >= x.s - 0.08);
    if (blk) selectBlock(blk, false);
  });

  // Index Codex Lines & Samples
  (codexRes.poems || []).forEach((p) => {
    state.codexByPoem[p.num] = p;
  });
  (duetsRes.duets || []).forEach((d) => {
    state.duetsMeta[d.num] = d;
  });
  (sampRes.tracks || []).forEach((t) => {
    state.samplesByPoem[t.num] = t;
  });

  // Populate Oulipo SCION Works Selector
  state.oulipoWorks = oulipoRes.works || [];
  const oulSel = document.getElementById('sel-oulipo-work');
  oulSel.innerHTML = state.oulipoWorks
    .map((w, i) => `<option value="${i}">${String(w.id).padStart(2, '0')} | ${w.work} (${w.family})</option>`)
    .join('');
  const syncOulipoCard = () => {
    const w = state.oulipoWorks[state.activeWorkIdx] || state.oulipoWorks[0];
    if (!w) return;
    const badge = document.getElementById('oulipo-status-badge');
    badge.textContent = (w.status || 'open').toUpperCase();
    badge.className = 'badge ' + (w.status === 'passed' ? 'passed' : w.status === 'near' ? 'near' : 'open');
    document.getElementById('oulipo-rule-text').textContent = `${w.title} — ${w.line}`;
    document.getElementById('oulipo-critic-text').textContent =
      w.notes ? w.notes.slice(0, 210) + (w.notes.length > 210 ? '...' : '') : w.byline;
  };
  oulSel.addEventListener('change', (e) => {
    state.activeWorkIdx = Number(e.target.value);
    syncOulipoCard();
    drawOulipoScreenCanvas(performance.now() * 0.001);
  });
  syncOulipoCard();
  renderPoolStripUI();

  selectPoem(state.selectedPoem, false);
  if (planRes.blocks.length) selectBlock(planRes.blocks[0], false);
}
loadDatasets();

// ---------------------------------------------------------------------------
// 15. Pointer Raycast (Click Ring/Block to Inspect or Dive) + WASD + Drag Look
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const keys = {};
let dragging = false;
let dragMoved = 0;
let lastPt = { x: 0, y: 0 };

renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true;
  dragMoved = 0;
  lastPt = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastPt.x;
  const dy = e.clientY - lastPt.y;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  lastPt = { x: e.clientX, y: e.clientY };
  state.lookYaw -= dx * 0.0032;
  state.lookPitch = Math.max(-0.55, Math.min(0.55, state.lookPitch - dy * 0.0026));
});
window.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  if (dragMoved > 6 || e.target !== renderer.domElement) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  if (state.depthT < 0.35) {
    const bHits = raycaster.intersectObjects(blockPickMeshes, false);
    if (bHits.length > 0) {
      selectBlock(bHits[0].object.userData.block, false);
      return;
    }
    const rHits = raycaster.intersectObjects(ringPickMeshes, false);
    if (rHits.length > 0) {
      // Clicking a Plato ring smoothly triggers the Nautilus Dive to Screening!
      triggerStage('dive');
    }
  }
});

window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  keys[e.code] = true;
  if (e.code === 'KeyH') toggleDrawer();
  if (e.code === 'Escape') document.getElementById('svg-modal').classList.remove('open');
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
// 16. Main Animation Loop
// ---------------------------------------------------------------------------
let prevT = performance.now() * 0.001;
let lastScreenBucket = -1;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now() * 0.001;
  const dt = Math.min(0.05, Math.max(0.001, now - prevT));
  prevT = now;
  state.frameTick = now;

  // Smooth Dive Interpolation
  if (state.animatingDive) {
    const diff = state.targetDepthT - state.depthT;
    if (Math.abs(diff) < 0.0025) {
      setDepthProgress(state.targetDepthT, false);
      state.animatingDive = false;
    } else {
      const step = Math.sign(diff) * Math.min(Math.abs(diff), dt * 0.24);
      setDepthProgress(state.depthT + step, false);
    }
  }

  // Camera Spline + Bespoke Route Stop + Free WASD Walk in Courtyard / Ring Orbit
  const basePos = state.customCam ? state.customCam.pos : DIVE_CURVE_POS.getPointAt(state.depthT);
  const baseLook = state.customCam ? state.customCam.look : DIVE_CURVE_LOOK.getPointAt(state.depthT);

  const moveSpeed = state.depthT > 0.7 ? 7.5 : 18.0;
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  if (fwd.lengthSq() > 0.001) fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

  if (keys.KeyW || keys.ArrowUp) state.walkOffset.addScaledVector(fwd, moveSpeed * dt);
  if (keys.KeyS || keys.ArrowDown) state.walkOffset.addScaledVector(fwd, -moveSpeed * dt);
  if (keys.KeyA || keys.ArrowLeft) state.walkOffset.addScaledVector(right, -moveSpeed * dt);
  if (keys.KeyD || keys.ArrowRight) state.walkOffset.addScaledVector(right, moveSpeed * dt);

  // Clamp courtyard walk inside colonnade unless door is open along south threshold
  const maxR = pilot.doorOpen ? 25.0 : 12.6;
  if (state.depthT > 0.8 && state.walkOffset.length() > maxR) {
    state.walkOffset.setLength(maxR);
  }

  camera.position.copy(basePos).add(state.walkOffset);
  const lookTarget = baseLook.clone().add(state.walkOffset);
  lookTarget.x += Math.sin(state.lookYaw) * 8.0;
  lookTarget.y += state.lookPitch * 6.0;
  camera.lookAt(lookTarget);

  // Gently sweep Verne's Nautilus Spotlight across the sunken Doric colonnade
  nautilusGroup.position.y = -17.5 + Math.sin(now * 0.55) * 0.65;
  nautilusBeam.rotation.y = Math.sin(now * 0.42) * 0.34;

  // Drift bioluminescent pelagic silt slowly upward
  const pArr = siltParticles.geometry.attributes.position.array;
  for (let i = 1; i < pArr.length; i += 3) {
    pArr[i] += dt * 0.28;
    if (pArr[i] > 5.0) pArr[i] = -38.0;
  }
  siltParticles.geometry.attributes.position.needsUpdate = true;

  // Update Anny V8 Cast + Strict Turn-Taking Lip-Sync / Gesture
  castActors.forEach((ac) => {
    const isSpeaker =
      (duetEngine.speakingRole === 'poet' && ac.id === 'poet') ||
      (duetEngine.speakingRole === 'carrier' && ac.id === 'carrier');
    if (ac.v8) {
      if (typeof ac.v8.crossFadeTo === 'function') {
        const want = isSpeaker ? 'idle-talking' : 'idle';
        if (ac.currentClip !== want) {
          ac.currentClip = want;
          ac.v8.crossFadeTo(want, 0.25);
        }
      }
      if (typeof ac.v8.setJawOpenness === 'function') {
        ac.v8.setJawOpenness(isSpeaker ? 0.35 + 0.3 * Math.abs(Math.sin(now * 9.5)) : 0);
      }
      if (typeof ac.v8.update === 'function') {
        ac.v8.update(dt);
      }
    } else {
      ac.proxy.position.y = isSpeaker ? Math.abs(Math.sin(now * 7.5)) * 0.04 : 0;
    }
  });

  // Refresh Oulipo 35mm Cinema Sheet at ~6 fps or on subtitle change
  const bucket = Math.floor(now * 6);
  if (bucket !== lastScreenBucket) {
    lastScreenBucket = bucket;
    refreshPlayerPlates();
    drawOulipoScreenCanvas(now);
    if (bucket % 18 === 0) renderPoolStripUI();
  }

  renderer.render(scene, camera);
}

setDepthProgress(0.0, false);
animate();
