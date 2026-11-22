// Make-Photo City — Worldtext: Pure Full-Screen Walkable 3D Severn Threshold & Archive Light-Table Darkroom
// Eliminates all webpage scroll grids, 6-tab bars, and card columns.
// Features Severn Gate (+4.00 m flood line vs 0.40 m bollard stripe), 2 clothed Anny V8 visitors,
// 5 physical Calvino Stone/Paper Folios on a 3D Light Table, 21 Glass Color Filters (palettes.json),
// and 14 physical 35mm Film Reels / Dossier Plates (Poems 01-14). Strict zero-emoji rule.

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
import { buildObject, drawEmblem } from './kit.js';

let pilot = applyPilotUrlHash();
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

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
// 1. Calvino's 5 Interlacing Readings (Spatial Gate Rules & Situated Passages)
// ---------------------------------------------------------------------------
const CALVINO_ORDER = ['memory', 'exchange', 'desire', 'signs', 'loss'];
const CALVINO_READINGS = {
  memory: {
    id: 'memory',
    roman: 'I',
    shortTitle: 'Memory',
    label: 'Cities & Memory',
    speaker: 'Salt Guild Chronicler · First Tide Ledger',
    prov: 'recorded',
    quote:
      'On the anniversary of the Fall, people chalk the flood line at four metres on every wall that does not already carry it. A clean wall at four metres is a lie about the city.',
    cite: 'wygwyl/world/gazetteer/world.json · Poem 01 (00:07.8)',
    visAOutcome: 'Makeda (Salt Guild): CLEARED — worn limestone groove glows; crosses public sill.',
    visBOutcome: 'Stranger: HELD AT +0.40m BOLLARD — must chalk +4.00m witness mark first.',
    floorColor: '#efe7d2',
    ribbonColor: '#e0b46a',
    seamBoost: 1.15,
    windowGlow: 0.55,
    gateRuleOpenForA: true,
    gateRuleOpenForB: false,
  },
  exchange: {
    id: 'exchange',
    roman: 'II',
    shortTitle: 'Exchange',
    label: 'Cities & Exchange',
    speaker: 'Tide Office Clerk · Pier Notice #02 (12h 25m Clock)',
    prov: 'checked',
    quote:
      'Appointments are made at the second gate or between gates. The Archive sells nothing, but the city trades in frames and logged water transfers.',
    cite: 'gazetteer/world.json ("The day of two gates") · Block IV Law',
    visAOutcome: 'Makeda: CLEARED AT SECOND GATE — carries 5L condensate & logged Severn parcel.',
    visBOutcome: 'Stranger: REDIRECTED TO LIGHT TABLE — deposit one street plate to unlock.',
    floorColor: '#5fe8ff',
    ribbonColor: '#18b4ff',
    seamBoost: 1.85,
    windowGlow: 0.85,
    gateRuleOpenForA: true,
    gateRuleOpenForB: false,
  },
  desire: {
    id: 'desire',
    roman: 'III',
    shortTitle: 'Desire',
    label: 'Cities & Desire',
    speaker: 'The Poet · Poem 01 "Out of Life" (00:07.8)',
    prov: 'recorded',
    quote:
      'I look for a way out through the hallways, within the drawers and fire escapes, trip on my own words, falling out of life, and find where you go when you leave.',
    cite: 'shots/poems/01.html · Set 01.1 Receding Fire-Escape Sash',
    visAOutcome: 'Makeda: GROUND VESTIBULE OPEN — enters utility stair calmly.',
    visBOutcome: 'Stranger / Poet: CLEARED — upper amber sash recedes along rail as both cross.',
    floorColor: '#f2a541',
    ribbonColor: '#ff9238',
    seamBoost: 0.95,
    windowGlow: 2.6,
    gateRuleOpenForA: true,
    gateRuleOpenForB: true,
  },
  signs: {
    id: 'signs',
    roman: 'IV',
    shortTitle: 'Signs',
    label: 'Cities & Signs',
    speaker: 'Keepers & Glaziers · Language Rule W00n',
    prov: 'recorded',
    quote:
      'The city greeting is "Where do you go?" The answer is "when I leave." Saying anything else marks a visitor. Meaning here is use.',
    cite: 'gazetteer/world.json ("Customs") · "The Line and the Seam"',
    visAOutcome: 'Makeda: ANSWERS "WHEN I LEAVE" — reads cyan seam as public Nolli shortcut.',
    visBOutcome: 'Stranger: READS HAZARD SIGN — halts at +0.40m bollard stripe.',
    floorColor: '#18b4ff',
    ribbonColor: '#5fe8ff',
    seamBoost: 2.25,
    windowGlow: 1.0,
    gateRuleOpenForA: true,
    gateRuleOpenForB: false,
  },
  loss: {
    id: 'loss',
    roman: 'V',
    shortTitle: 'Loss',
    label: 'Cities & Loss (Kintsugi)',
    speaker: 'Glazier Guild · Resurrection Repair Ledger',
    prov: 'checked',
    quote:
      'Ruins are not replaced, they are repaired: white ceramic plates over the old brick, with their seams drawn in cyan light, and no two seams drawn alike.',
    cite: 'language/index.html ("Kintsugi of the Resurrection") · Poem 06',
    visAOutcome: 'Makeda: TRACE RECORDED — leaves luminous kintsugi seam across threshold.',
    visBOutcome: 'Stranger: WITNESS VIEW — hears muffled choir resonance behind brick.',
    floorColor: '#d8b4fe',
    ribbonColor: '#c084fc',
    seamBoost: 2.85,
    windowGlow: 0.65,
    gateRuleOpenForA: true,
    gateRuleOpenForB: false,
  },
};

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
scene.background = new THREE.Color('#09182c');
scene.fog = new THREE.FogExp2('#0b1d34', 0.015);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.12, 160);
camera.position.set(0, 2.58, 8.45);
camera.lookAt(0, 1.82, 0.35);

const hemiLight = new THREE.HemisphereLight('#c6e4ff', '#2a241e', 1.38);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight('#ffd8ad', 2.55);
keyLight.position.set(8.5, 14.5, 10.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
const ks = 14;
keyLight.shadow.camera.left = -ks;
keyLight.shadow.camera.right = ks;
keyLight.shadow.camera.top = ks;
keyLight.shadow.camera.bottom = -ks;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const doorWarmLight = new THREE.PointLight('#ffb35c', 18, 15, 1.5);
doorWarmLight.position.set(0, 2.3, -2.0);
scene.add(doorWarmLight);

const seamCyanLight = new THREE.PointLight('#18b4ff', 14, 16, 1.5);
seamCyanLight.position.set(1.8, 3.8, 1.4);
scene.add(seamCyanLight);

const lightTableGlow = new THREE.PointLight('#9cecff', 14, 7.5, 1.6);
lightTableGlow.position.set(0, 1.35, 4.35);
scene.add(lightTableGlow);

const state = {
  reading: CALVINO_READINGS[pilot.account] ? pilot.account : 'memory',
  selectedPoem: pilot.poem || '01',
  activeFilterIdx: 0,
  poemsList: [],
  palettesList: [],
  encounterT: 0.72,
  replaying: true,
  walkOffset: new THREE.Vector3(0, 0, 0),
  lookYaw: 0,
  lookPitch: 0,
  dollyZ: 0,
  passageFloatUntil: 0,
  passageFloatKicker: '',
  passageFloatBody: '',
  passageFloatAnchor: new THREE.Vector3(-3.55, 3.35, -0.65),
};

const suite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: pilot.shader || 'weave',
  defaultTime: 'bluehour',
  locationName: 'Severn Threshold & Archive Light-Table Room',
  cartridgeName: 'Atlantis',
  onTimeChange: (_key, preset) => {
    if (preset) {
      scene.background.set(preset.skyTop || '#09182c');
      scene.fog.color.set(preset.skyTop || '#09182c');
      keyLight.intensity = preset.sunIntensity;
      hemiLight.intensity = preset.hemiIntensity;
    }
  },
});

const interactMeshes = [];
const hitColliderMat = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0.001,
  depthWrite: false,
});

// ---------------------------------------------------------------------------
// 3. Courtyard Ground, Darkroom Walls & Flanking Canonical Vignettes
// ---------------------------------------------------------------------------
const worldGroup = new THREE.Group();
scene.add(worldGroup);

function makeCourtyardPavingTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#182432';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(244, 238, 221, 0.08)';
  g.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 512);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(512, i);
    g.stroke();
  }
  // Subtle concentric Nolli courtyard arc
  g.strokeStyle = 'rgba(24, 180, 255, 0.24)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(256, 180, 210, 0, Math.PI * 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const courtyardFloor = new THREE.Mesh(
  new THREE.CircleGeometry(28.0, 72),
  new THREE.MeshStandardMaterial({
    map: makeCourtyardPavingTexture(),
    roughness: 0.38,
    metalness: 0.16,
  })
);
courtyardFloor.rotation.x = -Math.PI / 2;
courtyardFloor.receiveShadow = true;
worldGroup.add(courtyardFloor);

// Cyan perimeter ring framing the Severn & Light-Table stage
const stageRim = new THREE.Mesh(
  new THREE.TorusGeometry(9.6, 0.04, 8, 96),
  new THREE.MeshBasicMaterial({ color: '#18b4ff' })
);
stageRim.rotation.x = Math.PI / 2;
stageRim.position.y = 0.015;
worldGroup.add(stageRim);

//Shared Materials
function makeBrickDatumTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#7a382a';
  g.fillRect(0, 0, 512, 512);
  for (let r = 0; r < 18; r++) {
    const off = (r % 2) * 32;
    for (let col = -1; col < 9; col++) {
      const sh = 105 + ((r * 17 + col * 31) % 28);
      g.fillStyle = `rgb(${sh + 22},${Math.floor(sh * 0.56)},${Math.floor(sh * 0.44)})`;
      g.fillRect(col * 64 + off + 2, r * 28 + 2, 60, 24);
    }
  }
  const dampGrad = g.createLinearGradient(0, 190, 0, 512);
  dampGrad.addColorStop(0, 'rgba(46, 84, 74, 0.08)');
  dampGrad.addColorStop(1, 'rgba(32, 66, 58, 0.58)');
  g.fillStyle = dampGrad;
  g.fillRect(0, 192, 512, 320);
  g.fillStyle = '#faf6eb';
  g.fillRect(0, 186, 512, 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const severnBrickMat = new THREE.MeshStandardMaterial({ map: makeBrickDatumTexture(), roughness: 0.68 });
const ceramicMat = new THREE.MeshStandardMaterial({ color: '#f4f0e6', roughness: 0.34 });
const cyanSeamMat = new THREE.MeshStandardMaterial({
  color: '#18b4ff',
  emissive: '#18b4ff',
  emissiveIntensity: 1.4,
  roughness: 0.25,
});
const upperWindowMat = new THREE.MeshStandardMaterial({
  color: '#ffb35c',
  emissive: '#fa8d15',
  emissiveIntensity: 0.9,
  roughness: 0.2,
});
const brassMat = new THREE.MeshStandardMaterial({
  color: '#d9ad62',
  emissive: '#3b290c',
  emissiveIntensity: 0.2,
  roughness: 0.28,
  metalness: 0.82,
});
const walnutMat = new THREE.MeshStandardMaterial({
  color: '#342218',
  roughness: 0.54,
  metalness: 0.14,
});
const ironMat = new THREE.MeshStandardMaterial({
  color: '#1d232a',
  roughness: 0.5,
  metalness: 0.68,
});

// ---------------------------------------------------------------------------
// 4. Center Stage: Severn Brick Doorway (+4.00 m Flood Line vs 0.40 m Bollard)
//    & Two Clothed Anny V8 Visitors (Makeda & Unregistered Stranger)
// ---------------------------------------------------------------------------
const severnStage = new THREE.Group();
severnStage.position.set(0, 0, -0.8);
worldGroup.add(severnStage);

const sWallL = new THREE.Mesh(new THREE.BoxGeometry(2.7, 6.4, 0.88), severnBrickMat);
sWallL.position.set(-2.4, 3.2, -0.8);
sWallL.castShadow = true;
sWallL.receiveShadow = true;
severnStage.add(sWallL);

const sWallR = new THREE.Mesh(new THREE.BoxGeometry(2.7, 6.4, 0.88), severnBrickMat);
sWallR.position.set(2.4, 3.2, -0.8);
sWallR.castShadow = true;
sWallR.receiveShadow = true;
severnStage.add(sWallR);

const sWallTop = new THREE.Mesh(new THREE.BoxGeometry(2.15, 3.3, 0.88), severnBrickMat);
sWallTop.position.set(0, 4.75, -0.8);
sWallTop.castShadow = true;
severnStage.add(sWallTop);

// Explicit +4.00 m Salt Flood Band + Kintsugi Ceramic Patch & Cyan Seam
const datumBand3D = new THREE.Mesh(
  new THREE.BoxGeometry(7.6, 0.12, 0.94),
  new THREE.MeshStandardMaterial({ color: '#faf6eb', emissive: '#faf6eb', emissiveIntensity: 0.35 })
);
datumBand3D.position.set(0, 4.0, -0.8);
severnStage.add(datumBand3D);

// 3D Carved Stone +4.00 m Datum Plaque on Right Pier
function makeDatumPlaqueTex() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10, 22, 36, 0.9)';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#faf6eb';
  g.lineWidth = 3;
  g.strokeRect(4, 4, 504, 120);
  g.fillStyle = '#5fe8ff';
  g.font = '600 18px ui-monospace, monospace';
  g.fillText('PHYSICAL FALL FLOOD BOUNDARY', 20, 44);
  g.fillStyle = '#faf6eb';
  g.font = '700 30px Georgia, serif';
  g.fillText('+4.00 m Salt Datum', 20, 94);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const datumPlaqueMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(2.05, 0.52),
  new THREE.MeshBasicMaterial({ map: makeDatumPlaqueTex() })
);
datumPlaqueMesh.position.set(2.42, 3.55, -0.34);
severnStage.add(datumPlaqueMesh);

const kintsugiPatch = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.15, 0.92), ceramicMat);
kintsugiPatch.position.set(2.15, 4.88, -0.78);
severnStage.add(kintsugiPatch);

const kintsugiSeam = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.96), cyanSeamMat);
kintsugiSeam.position.set(2.15, 4.28, -0.78);
severnStage.add(kintsugiSeam);

// Upper Severn Bedroom Sash Window + Iron Fire Escape Landing (Poem 01)
const upperSash = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.55, 0.12), upperWindowMat);
upperSash.position.set(-2.25, 4.95, -0.34);
severnStage.add(upperSash);

const escapePlatform = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.1), ironMat);
escapePlatform.position.set(-2.25, 4.12, 0.22);
severnStage.add(escapePlatform);
const escapeRail = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 0.06), ironMat);
escapeRail.position.set(-2.25, 4.55, 0.74);
severnStage.add(escapeRail);

// Glowing Interior Severn Vestibule Aperture (Clicking steps through to ../ Nolli Block or Shift+Click ../foundry/)
const interiorPortalPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(1.98, 3.08),
  new THREE.MeshBasicMaterial({
    color: '#ffb866',
    transparent: true,
    opacity: 0.36,
    side: THREE.DoubleSide,
  })
);
interiorPortalPlane.position.set(0, 1.54, -0.92);
interiorPortalPlane.userData.interact = {
  kind: 'severn-portal',
  anchor: new THREE.Vector3(0, 3.25, -1.6),
  getWhisper: () => [
    'Severn Threshold Doorway',
    'Click to Step into Nolli Block · Shift+Click Foundry',
  ],
};
severnStage.add(interiorPortalPlane);
interactMeshes.push(interiorPortalPlane);

// Operable Wooden Severn Door Leaf (Clicking swings door open/closed & syncs pilot!)
const gateDoorPivot = new THREE.Group();
gateDoorPivot.position.set(-0.98, 0.0, -0.72);
const gateDoorLeaf = new THREE.Mesh(
  new THREE.BoxGeometry(1.94, 3.05, 0.12),
  new THREE.MeshStandardMaterial({ color: '#cbb182', roughness: 0.44, metalness: 0.24 })
);
gateDoorLeaf.position.set(0.97, 1.525, 0);
gateDoorLeaf.castShadow = true;
gateDoorLeaf.userData.interact = {
  kind: 'toggle-door',
  anchor: new THREE.Vector3(-0.95, 3.25, -0.6),
  getWhisper: () => [
    `Severn Wooden Door Leaf (${pilot.doorOpen ? 'Open' : 'Closed'})`,
    `Click to ${pilot.doorOpen ? 'Close' : 'Open'} Gate`,
  ],
};
gateDoorPivot.add(gateDoorLeaf);
severnStage.add(gateDoorPivot);
interactMeshes.push(gateDoorLeaf);

// Left Iron & Brick Foundry Alley Archway (Direct in-world doorway to ../foundry/)
const foundryArchGroup = new THREE.Group();
foundryArchGroup.position.set(-5.35, 0, -0.55);
foundryArchGroup.rotation.y = 0.28;
severnStage.add(foundryArchGroup);

[-0.95, 0.95].forEach((px) => {
  const pier = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.4, 0.55), severnBrickMat);
  pier.position.set(px, 1.7, 0);
  foundryArchGroup.add(pier);
});
const foundryLintel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.62), ceramicMat);
foundryLintel.position.set(0, 3.55, 0);
foundryArchGroup.add(foundryLintel);
const foundrySeam = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.05, 0.66), cyanSeamMat);
foundrySeam.position.set(0, 3.3, 0);
foundryArchGroup.add(foundrySeam);
const foundryVeil = new THREE.Mesh(
  new THREE.PlaneGeometry(1.48, 3.25),
  new THREE.MeshBasicMaterial({ color: '#18b4ff', transparent: true, opacity: 0.18, side: THREE.DoubleSide })
);
foundryVeil.position.set(0, 1.62, 0);
foundryVeil.userData.interact = {
  kind: 'foundry-portal',
  anchor: new THREE.Vector3(-5.35, 3.9, -1.35),
  getWhisper: () => ['Foundry & Inverse Tomology Arch', 'Click to Step into Foundry'],
};
foundryArchGroup.add(foundryVeil);
interactMeshes.push(foundryVeil);

// Calvino Observable Worn Limestone Floor Groove + +4.00m Line Post + +0.40m Bollard
const wornPathMat = new THREE.MeshStandardMaterial({
  color: '#efe7d2',
  emissive: '#efe7d2',
  emissiveIntensity: 0.34,
  roughness: 0.42,
});
const wornPathMesh = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.035, 4.9), wornPathMat);
wornPathMesh.position.set(-0.48, 0.02, 1.75);
severnStage.add(wornPathMesh);

const gateLinePost = buildObject('line post');
gateLinePost.position.set(-4.05, 0, 0.75);
severnStage.add(gateLinePost);

const linePostHit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 4.6, 8), hitColliderMat);
linePostHit.position.set(-4.05, 2.3, 0.75);
linePostHit.userData.interact = {
  kind: 'datum-inspect',
  anchor: new THREE.Vector3(-4.05, 4.4, 0.75),
  getWhisper: () => ['Physical Flood Datum Post (+4.00 m)', 'Matches Wall Line · Distinct from 4/10 Stripes'],
};
severnStage.add(linePostHit);
interactMeshes.push(linePostHit);

const gateBollard = buildObject('bollard');
gateBollard.position.set(1.62, 0, 2.2);
severnStage.add(gateBollard);

const bollardHit = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 8), hitColliderMat);
bollardHit.position.set(1.62, 0.6, 2.2);
bollardHit.userData.interact = {
  kind: 'datum-inspect',
  anchor: new THREE.Vector3(1.62, 1.35, 2.2),
  getWhisper: () => ['Quay Ceramic Bollard (0.40 m Symbolic Stripe)', '4/10 Object Height · Stranger Curb Boundary'],
};
severnStage.add(bollardHit);
interactMeshes.push(bollardHit);

// Two Clothed Anny V8 Visitors (Makeda & Unregistered Stranger) + Shared Brass Parcel
const visitorA = { id: 'makeda', name: 'Makeda (Salt Guild)', root: new THREE.Group(), v8: null, baseZ: 3.05, targetZ: -0.32 };
visitorA.root.position.set(-0.24, 0, 3.05);
visitorA.root.rotation.y = Math.PI;
severnStage.add(visitorA.root);

const visitorB = { id: 'stranger', name: 'Unregistered Stranger', root: new THREE.Group(), v8: null, baseZ: 3.35, targetZ: 2.05 };
visitorB.root.position.set(0.76, 0, 3.35);
visitorB.root.rotation.y = Math.PI;
severnStage.add(visitorB.root);

function addVisitorCharacter(targetObj, archetype, coatHex, skinHex) {
  const proxy = new THREE.Group();
  const cMat = new THREE.MeshStandardMaterial({ color: coatHex, roughness: 0.72 });
  const sMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.62 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, 0.86, 12), cMat);
  torso.position.y = 1.06;
  proxy.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), sMat);
  head.position.y = 1.64;
  proxy.add(head);
  targetObj.root.add(proxy);
  targetObj.proxy = proxy;

  const hitCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.88, 10), hitColliderMat);
  hitCyl.position.y = 0.94;
  hitCyl.userData.interact = {
    kind: 'visitor',
    visitor: targetObj,
    anchor: new THREE.Vector3(0, 2.0, 0),
    getWhisper: () => {
      const r = CALVINO_READINGS[state.reading];
      return [
        targetObj.name,
        targetObj.id === 'makeda' ? r.visAOutcome.slice(0, 56) : r.visBOutcome.slice(0, 56),
      ];
    },
  };
  targetObj.root.add(hitCyl);
  targetObj.hitCyl = hitCyl;
  interactMeshes.push(hitCyl);

  if (typeof window !== 'undefined' && window.AnnyHumanV7 && window.AnnyHumanV7.createCharacter) {
    window.AnnyHumanV7.createCharacter({
      THREE,
      loader: gltfLoader,
      archetype,
      assetBaseUrl: '../../abyssinian-highlands/human-forge/assets',
      clipsBaseUrl: '../../motion-pipeline/mesh2motion/clips',
      clothed: true,
      groundY: 0,
      preloadClips: ['idle', 'walk'],
      initialClip: 'idle',
    })
      .then((inst) => {
        if (!inst) return;
        inst.root.position.set(0, 0, 0);
        inst.root.rotation.set(0, 0, 0);
        targetObj.root.add(inst.root);
        proxy.visible = false;
        targetObj.v8 = inst;
        inst.setGroundY(0);
      })
      .catch(() => {});
  }
}
addVisitorCharacter(visitorA, 'elder', '#1c4d5e', '#5a3826');
addVisitorCharacter(visitorB, 'adult_m', '#262932', '#68432f');

const studioParcel = new THREE.Mesh(
  new THREE.BoxGeometry(0.32, 0.22, 0.24),
  new THREE.MeshStandardMaterial({ color: '#e0b46a', emissive: '#f2a541', emissiveIntensity: 0.42 })
);
studioParcel.userData.interact = {
  kind: 'cycle-parcel',
  anchor: new THREE.Vector3(0, 1.4, 2.0),
  getWhisper: () => [`Sealed Severn Parcel (${pilot.parcelHolder})`, 'Click to Cycle Parcel Holder'],
};
severnStage.add(studioParcel);
interactMeshes.push(studioParcel);

// ---------------------------------------------------------------------------
// 5. Floating 3D Situated Passage Inscription Plane Beside the Severn Wall
// ---------------------------------------------------------------------------
const wallPassageCanvas = document.createElement('canvas');
wallPassageCanvas.width = 1024;
wallPassageCanvas.height = 700;
const wallPassageTex = new THREE.CanvasTexture(wallPassageCanvas);
wallPassageTex.colorSpace = THREE.SRGBColorSpace;
wallPassageTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

const wallPassagePlane = new THREE.Mesh(
  new THREE.PlaneGeometry(3.05, 2.08),
  new THREE.MeshBasicMaterial({
    map: wallPassageTex,
    transparent: true,
    side: THREE.DoubleSide,
  })
);
// Positioned softly in 3D space beside the right Severn wall pier
wallPassagePlane.position.set(4.55, 2.48, 0.25);
wallPassagePlane.rotation.y = -0.32;
worldGroup.add(wallPassagePlane);

function wrapCanvasParagraph(ctx, text, x, y, maxChars, lineH, maxLines = 5) {
  const words = String(text || '').split(/\s+/);
  let ln = '';
  let count = 0;
  for (const w of words) {
    if ((ln + w).length > maxChars) {
      ctx.fillText(ln.trim(), x, y + count * lineH);
      count++;
      if (count >= maxLines) return y + count * lineH;
      ln = w + ' ';
    } else {
      ln += w + ' ';
    }
  }
  if (ln.trim() && count < maxLines) {
    ctx.fillText(ln.trim(), x, y + count * lineH);
    count++;
  }
  return y + count * lineH;
}

function redraw3DWallPassage() {
  const r = CALVINO_READINGS[state.reading] || CALVINO_READINGS.memory;
  const poemObj =
    state.poemsList.find((p) => p.num === state.selectedPoem) ||
    state.poemsList[0] || {
      num: state.selectedPoem,
      title: 'Out of Life',
      district: 'The Severn Bedroom',
      lines: [{ time: '00:07.8', text: 'I look for a way out through the hallways and fire escapes.' }],
    };

  const g = wallPassageCanvas.getContext('2d');
  g.clearRect(0, 0, 1024, 700);

  // Soft translucent darkroom slate floating in 3D space
  g.fillStyle = 'rgba(7, 17, 30, 0.94)';
  g.fillRect(14, 14, 996, 672);
  g.strokeStyle = r.floorColor;
  g.lineWidth = 4;
  g.strokeRect(14, 14, 996, 672);

  drawEmblem(g, 948, 72, 34, r.floorColor);

  g.fillStyle = r.floorColor;
  g.font = '700 22px ui-monospace, Menlo, monospace';
  g.fillText(`CALVINO ${r.roman} · ${r.label.toUpperCase()} [${r.prov.toUpperCase()}]`, 44, 62);

  g.fillStyle = '#e0b46a';
  g.font = '600 18px ui-monospace, Menlo, monospace';
  g.fillText(r.speaker, 44, 96);

  g.fillStyle = '#faf6eb';
  g.font = 'italic 30px Georgia, serif';
  const nextY = wrapCanvasParagraph(g, `"${r.quote}"`, 44, 152, 48, 40, 4);

  g.fillStyle = 'rgba(244, 238, 221, 0.65)';
  g.font = '500 17px ui-monospace, Menlo, monospace';
  g.fillText(r.cite, 44, nextY + 14);

  // Divider
  g.fillStyle = 'rgba(24, 180, 255, 0.35)';
  g.fillRect(44, nextY + 36, 936, 2);

  g.fillStyle = '#7ce8ff';
  g.font = '600 19px ui-monospace, Menlo, monospace';
  g.fillText(r.visAOutcome.slice(0, 72), 44, nextY + 72);

  g.fillStyle = '#f2a541';
  g.fillText(r.visBOutcome.slice(0, 72), 44, nextY + 104);

  // Active Reel / Dossier Strip at bottom of 3D wall projection
  const firstLine = (poemObj.lines && poemObj.lines[0] && poemObj.lines[0].text) || poemObj.essence || '';
  g.fillStyle = 'rgba(244, 238, 221, 0.14)';
  g.fillRect(44, 548, 936, 112);
  g.fillStyle = '#e0b46a';
  g.font = '700 19px ui-monospace, Menlo, monospace';
  g.fillText(`REEL ${poemObj.num} · ${(poemObj.title || '').toUpperCase()} (${poemObj.district || 'Atlantis'})`, 62, 584);
  g.fillStyle = '#faf6eb';
  g.font = 'italic 23px Georgia, serif';
  g.fillText(`"${firstLine.slice(0, 68)}"`, 62, 628);

  wallPassageTex.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// 6. Foreground 3D Archive Light Table:
//    - 5 Physical Glowing Stone/Paper Calvino Folios
//    - 21 Physical Glass Color Filters (palettes.json)
//    - 14 Physical 35mm Film Reels / Dossier Plates (Poems 01-14)
// ---------------------------------------------------------------------------
const archiveEnsemble = new THREE.Group();
archiveEnsemble.position.set(0, 0, 4.35);
worldGroup.add(archiveEnsemble);

// 6A. Center Illuminated Light Table + 5 Physical Calvino Stone/Paper Folios
const centerTable = new THREE.Group();
archiveEnsemble.add(centerTable);

// Walnut legs & cabinet apron
[-1.58, 1.58].forEach((lx) => {
  [-0.45, 0.45].forEach((lz) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.82, 0.09), walnutMat);
    leg.position.set(lx, 0.41, lz);
    leg.castShadow = true;
    centerTable.add(leg);
  });
});

const tableTopPivot = new THREE.Group();
tableTopPivot.position.set(0, 0.84, 0);
tableTopPivot.rotation.x = 0.24; // Tilted toward viewer like an architect's light table
centerTable.add(tableTopPivot);

const cabinetFrame = new THREE.Mesh(new THREE.BoxGeometry(3.52, 0.1, 1.12), walnutMat);
cabinetFrame.castShadow = true;
cabinetFrame.receiveShadow = true;
tableTopPivot.add(cabinetFrame);

const brassTrim = new THREE.Mesh(new THREE.BoxGeometry(3.56, 0.035, 1.16), brassMat);
brassTrim.position.y = 0.035;
tableTopPivot.add(brassTrim);

const backlitGlass = new THREE.Mesh(
  new THREE.PlaneGeometry(3.34, 0.96),
  new THREE.MeshStandardMaterial({
    color: '#d9f6ff',
    emissive: '#7be0ff',
    emissiveIntensity: 0.55,
    roughness: 0.18,
  })
);
backlitGlass.rotation.x = -Math.PI / 2;
backlitGlass.position.y = 0.053;
tableTopPivot.add(backlitGlass);

function makeFolioPageTexture(r) {
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#f3ebda';
  g.fillRect(0, 0, 384, 320);
  // Center spine crease
  g.fillStyle = 'rgba(60, 42, 24, 0.22)';
  g.fillRect(189, 0, 6, 320);
  g.strokeStyle = '#8b6f47';
  g.lineWidth = 4;
  g.strokeRect(8, 8, 368, 304);

  drawEmblem(g, 96, 86, 34, '#1b3a4b');
  g.fillStyle = '#17140f';
  g.font = '700 24px ui-monospace, monospace';
  g.fillText(r.roman, 84, 166);
  g.font = '700 26px Georgia, serif';
  g.fillText(r.shortTitle.toUpperCase(), 24, 214);

  // Right leaf lines
  g.fillStyle = '#3b3124';
  g.font = 'italic 18px Georgia, serif';
  wrapCanvasParagraph(g, r.quote, 204, 54, 16, 25, 8);

  // Ribbon stripe
  g.fillStyle = r.ribbonColor;
  g.fillRect(204, 268, 152, 16);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const folioEntries = [];
CALVINO_ORDER.forEach((key, idx) => {
  const r = CALVINO_READINGS[key];
  const fx = -1.24 + idx * 0.62;
  const fGroup = new THREE.Group();
  fGroup.position.set(fx, 0.075, 0.02);
  tableTopPivot.add(fGroup);

  const stoneSlab = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.042, 0.44),
    new THREE.MeshStandardMaterial({
      color: '#e8dfd0',
      emissive: r.floorColor,
      emissiveIntensity: 0.14,
      roughness: 0.46,
    })
  );
  stoneSlab.castShadow = true;
  fGroup.add(stoneSlab);

  const openPage = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.4),
    new THREE.MeshBasicMaterial({ map: makeFolioPageTexture(r) })
  );
  openPage.rotation.x = -Math.PI / 2;
  openPage.position.y = 0.023;
  fGroup.add(openPage);

  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.015, 0.14),
    new THREE.MeshBasicMaterial({ color: r.ribbonColor })
  );
  ribbon.position.set(0.12, 0.018, 0.25);
  fGroup.add(ribbon);

  const hitBox = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.22, 0.52), hitColliderMat);
  hitBox.position.y = 0.06;
  const worldAnchor = new THREE.Vector3(fx, 1.18, 4.35);
  hitBox.userData.interact = {
    kind: 'calvino-folio',
    readingId: key,
    anchor: worldAnchor,
    getWhisper: () => [`Calvino Folio ${r.roman} · ${r.label}`, 'Click to Compile Gate & Wall Passage'],
  };
  fGroup.add(hitBox);
  interactMeshes.push(hitBox);

  folioEntries.push({ id: key, group: fGroup, slab: stoneSlab, reading: r });
});

// 6B. Left Wing Optical Rack: 21 Physical Glass Color Filters (palettes.json)
const filterRackGroup = new THREE.Group();
filterRackGroup.position.set(-2.48, 0, -0.32);
filterRackGroup.rotation.y = 0.44;
archiveEnsemble.add(filterRackGroup);

const rackStandL = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.82, 0.72), walnutMat);
rackStandL.position.y = 0.41;
rackStandL.castShadow = true;
filterRackGroup.add(rackStandL);

const filterBacklight = new THREE.Mesh(
  new THREE.BoxGeometry(1.84, 0.56, 0.06),
  new THREE.MeshStandardMaterial({ color: '#c4f0ff', emissive: '#58cfff', emissiveIntensity: 0.48 })
);
filterBacklight.position.set(0, 1.14, -0.22);
filterBacklight.rotation.x = -0.18;
filterRackGroup.add(filterBacklight);

const filterEntries = [];
function makeGlassFilterTexture(colors, idx) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 192;
  const g = c.getContext('2d');
  const cols = colors && colors.length ? colors : ['#0c1f38', '#18b4ff', '#f4eedd', '#e0b46a', '#c74a3a', '#5fe8ff'];
  const bandH = 152 / cols.length;
  cols.forEach((hex, ci) => {
    g.fillStyle = hex;
    g.fillRect(8, 28 + ci * bandH, 112, bandH + 1);
  });
  g.fillStyle = '#d9ad62';
  g.fillRect(0, 0, 128, 28);
  g.fillStyle = '#17140f';
  g.font = '700 17px ui-monospace, monospace';
  g.fillText(`F${String(idx + 1).padStart(2, '0')}`, 42, 20);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function build21GlassFilters(palettes) {
  while (filterEntries.length) {
    const old = filterEntries.pop();
    if (old.hit) {
      const hi = interactMeshes.indexOf(old.hit);
      if (hi >= 0) interactMeshes.splice(hi, 1);
    }
    filterRackGroup.remove(old.group);
  }
  const count = Math.min(21, palettes.length || 21);
  for (let i = 0; i < count; i++) {
    const p = palettes[i] || { name: `Filter ${i + 1}`, colors: ['#0c1f38', '#18b4ff', '#f4eedd', '#e0b46a', '#7a382a', '#5fe8ff'] };
    const row = Math.floor(i / 7); // 3 stepped rows x 7 filters = 21 physical glass slides!
    const col = i % 7;
    const lx = -0.78 + col * 0.26;
    const baseY = 0.92 + row * 0.21;
    const lz = 0.18 - row * 0.16;

    const fg = new THREE.Group();
    fg.position.set(lx, baseY, lz);
    filterRackGroup.add(fg);

    const brassFrame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.23, 0.02), brassMat);
    fg.add(brassFrame);

    const glassPane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.19, 0.2),
      new THREE.MeshStandardMaterial({
        map: makeGlassFilterTexture(p.colors, i),
        emissive: p.colors[1] || '#18b4ff',
        emissiveIntensity: 0.35,
        roughness: 0.12,
        metalness: 0.15,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      })
    );
    glassPane.position.z = 0.012;
    fg.add(glassPane);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.12), hitColliderMat);
    const lookTarget = ALL_CITY_LOOKS[i % ALL_CITY_LOOKS.length];
    const worldPos = new THREE.Vector3();
    fg.updateMatrixWorld(true);
    worldPos.setFromMatrixPosition(fg.matrixWorld);

    hit.userData.interact = {
      kind: 'glass-filter',
      filterIdx: i,
      palette: p,
      lookId: lookTarget.id,
      lookName: lookTarget.name,
      getAnchor: () => {
        const v = new THREE.Vector3(0, 0.22, 0);
        return fg.localToWorld(v);
      },
      getWhisper: () => [
        `Glass Filter #${String(i + 1).padStart(2, '0')} · ${p.name}`,
        `Click for ${lookTarget.name} · Shift+Click 6-Color LUT`,
      ],
    };
    fg.add(hit);
    interactMeshes.push(hit);

    filterEntries.push({ idx: i, group: fg, hit, baseY, palette: p, lookId: lookTarget.id });
  }
}

// 6C. Right Wing Brass Darkroom Rack: 14 Physical 35mm Film Reels & Dossier Plates (Poems 01-14)
const reelRackGroup = new THREE.Group();
reelRackGroup.position.set(2.48, 0, -0.32);
reelRackGroup.rotation.y = -0.44;
archiveEnsemble.add(reelRackGroup);

const rackStandR = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.82, 0.72), walnutMat);
rackStandR.position.y = 0.41;
rackStandR.castShadow = true;
reelRackGroup.add(rackStandR);

const reelEntries = [];
function makeReelLabelTexture(num, swatches) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#181410';
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  const sw = swatches && swatches.length ? swatches : ['#18b4ff', '#f2a541', '#faf6eb'];
  g.strokeStyle = sw[0];
  g.lineWidth = 8;
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#efe7d2';
  g.beginPath();
  g.arc(64, 64, 34, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#17140f';
  g.font = '700 28px ui-monospace, monospace';
  g.fillText(num, 45, 74);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function build14PoemReels(poems) {
  while (reelEntries.length) {
    const old = reelEntries.pop();
    if (old.hit) {
      const hi = interactMeshes.indexOf(old.hit);
      if (hi >= 0) interactMeshes.splice(hi, 1);
    }
    reelRackGroup.remove(old.group);
  }
  const list = poems.slice(0, 14);
  list.forEach((p, i) => {
    const row = Math.floor(i / 7); // 2 stepped tiers x 7 reels = 14 physical 35mm reels & dossier plates!
    const col = i % 7;
    const rx = -0.78 + col * 0.26;
    const ry = 0.96 + row * 0.28;
    const rz = 0.16 - row * 0.2;

    const rg = new THREE.Group();
    rg.position.set(rx, ry, rz);
    reelRackGroup.add(rg);

    // 35mm Brass Film Reel Cylinder + Label Face + Glowing Dossier Contact Plate below
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.042, 20), brassMat);
    spool.rotation.x = Math.PI / 2 - 0.2;
    rg.add(spool);

    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.098, 20),
      new THREE.MeshBasicMaterial({ map: makeReelLabelTexture(p.num, p.swatches) })
    );
    face.rotation.x = -0.2;
    face.position.set(0, 0.005, 0.023);
    rg.add(face);

    const plateCol = (p.swatches && p.swatches[0]) || '#18b4ff';
    const contactPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.08, 0.018),
      new THREE.MeshStandardMaterial({
        color: '#faf6eb',
        emissive: plateCol,
        emissiveIntensity: 0.45,
        roughness: 0.25,
      })
    );
    contactPlate.position.set(0, -0.13, 0.03);
    rg.add(contactPlate);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.16), hitColliderMat);
    hit.userData.interact = {
      kind: 'poem-reel',
      poem: p,
      getAnchor: () => {
        const v = new THREE.Vector3(0, 0.2, 0);
        return rg.localToWorld(v);
      },
      getWhisper: () => [
        `35mm Reel ${p.num} · ${p.title}`,
        `Click to Stage Dossier (${p.district})`,
      ],
    };
    rg.add(hit);
    interactMeshes.push(hit);

    reelEntries.push({ num: p.num, group: rg, hit, spool, contactPlate, poem: p });
  });
}

// ---------------------------------------------------------------------------
// 7. Flanking Courtyard Architecture & Shared 8x10 Brass Tripod (>5m from cam)
// ---------------------------------------------------------------------------
// East Courtyard Plinth: White Ceramic Temple Dome, Reflecting Pool & Live Tide Board
const eastVignette = new THREE.Group();
eastVignette.position.set(6.8, 0, -0.6);
eastVignette.rotation.y = -0.5;
worldGroup.add(eastVignette);

const templePool = new THREE.Mesh(
  new THREE.CylinderGeometry(2.3, 2.4, 0.12, 36),
  new THREE.MeshStandardMaterial({ color: '#0d3b56', emissive: '#18b4ff', emissiveIntensity: 0.26, roughness: 0.1, metalness: 0.55 })
);
templePool.position.y = 0.06;
eastVignette.add(templePool);

const templeVault = new THREE.Mesh(
  new THREE.SphereGeometry(1.45, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
  ceramicMat
);
templeVault.position.y = 1.1;
eastVignette.add(templeVault);
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.1, 12), ceramicMat);
  col.position.set(Math.cos(a) * 1.3, 0.55, Math.sin(a) * 1.3);
  eastVignette.add(col);
}
const tideBoardObj = buildObject('tide board');
tideBoardObj.position.set(1.65, 0, 1.35);
eastVignette.add(tideBoardObj);

// West Courtyard Plinth: Baltimere Marble Stoop & Street Tide Lamp (2.24m 4/10 stripe)
const westVignette = new THREE.Group();
westVignette.position.set(-6.9, 0, 0.8);
westVignette.rotation.y = 0.52;
worldGroup.add(westVignette);

for (let s = 0; s < 5; s++) {
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 0.36), ceramicMat);
  step.position.set(0, 0.1 + s * 0.2, (4 - s) * 0.32);
  westVignette.add(step);
}
const westLamp = buildObject('tide lamp');
westLamp.position.set(1.6, 0, 0.9);
westVignette.add(westLamp);

// Shared 8x10 Brass Camera Tripod (dist = 6.9m from initial camera so zero auto-whisper on load!)
const worldRig = createWorldPortalAndTripod({
  THREE,
  scene,
  camera,
  domElement: renderer.domElement,
  suite,
  tripodPos: { x: 4.55, y: 0, z: 3.05, rotY: -2.42 },
  portals: [],
  onTripodClick: ({ expose }) => {
    if (expose) triggerShutterFlash();
  },
});

// ---------------------------------------------------------------------------
// 8. State Mutations: Calvino Folio, Glass Filter, Film Reel & Pilot Sync
// ---------------------------------------------------------------------------
function syncRawNotes() {
  const st = suite.getState ? suite.getState() : null;
  const lookId = (st && st.lookId) || pilot.shader || 'weave';
  const lookObj = ALL_CITY_LOOKS.find((l) => l.id === lookId);
  const rl = document.getElementById('notes-reading-line');
  if (rl) {
    rl.textContent = `Calvino Reading: ${CALVINO_READINGS[state.reading].label} | Poem: ${state.selectedPoem} | Shader: ${lookObj ? lookObj.name : lookId}`;
  }
  const gl = document.getElementById('notes-gate-line');
  if (gl) {
    gl.textContent = `Severn Door: ${pilot.doorOpen ? 'Open' : 'Closed'} | Parcel: ${pilot.parcelHolder} | +4.00 m Flood Datum vs 0.40 m Bollard Stripe`;
  }
}

function showPassageFloat(kicker, body, anchorVec3) {
  state.passageFloatKicker = kicker;
  state.passageFloatBody = body;
  if (anchorVec3) state.passageFloatAnchor.copy(anchorVec3);
  state.passageFloatUntil = performance.now() * 0.001 + 5.2;
}

function applyCalvinoReading(readingId, persist = true, showFloat = false) {
  const r = CALVINO_READINGS[readingId] || CALVINO_READINGS.memory;
  state.reading = r.id;

  // Elevate active 3D Folio on the Light Table
  folioEntries.forEach((f) => {
    const on = f.id === r.id;
    f.group.position.y = on ? 0.135 : 0.075;
    f.slab.material.emissiveIntensity = on ? 0.68 : 0.14;
  });

  // Update physical Severn floor groove, kintsugi seam, receding sash window & visitor clearance!
  wornPathMat.color.set(r.floorColor);
  wornPathMat.emissive.set(r.floorColor);
  cyanSeamMat.emissiveIntensity = r.seamBoost;
  upperWindowMat.emissiveIntensity = r.windowGlow;
  upperSash.position.z = r.id === 'desire' ? -0.98 : -0.34;

  visitorA.targetZ = pilot.doorOpen && r.gateRuleOpenForA ? -0.32 : 1.15;
  visitorB.targetZ = pilot.doorOpen && r.gateRuleOpenForB ? -0.55 : 2.15;

  state.encounterT = 0.0;
  state.replaying = true;

  redraw3DWallPassage();
  syncRawNotes();

  if (showFloat) {
    showPassageFloat(
      `${r.label} · ${r.speaker}`,
      `"${r.quote}"`,
      new THREE.Vector3(4.2, 3.65, 0.25)
    );
  }
  if (persist) savePilotState({ account: r.id });
}

function applyGlassFilter(idx, useCustomSixColorLut = false) {
  state.activeFilterIdx = idx;
  filterEntries.forEach((fe) => {
    fe.group.position.y = fe.baseY + (fe.idx === idx ? 0.085 : 0);
  });
  const entry = filterEntries[idx];
  if (!entry) return;

  if (useCustomSixColorLut && entry.palette && entry.palette.colors && entry.palette.colors.length >= 6) {
    const lutLook = ALL_CITY_LOOKS.find((l) => l.id === 'dist_nightlife');
    if (lutLook) lutLook.colors = entry.palette.colors.slice(0, 6);
    suite.setLook('dist_nightlife');
  } else {
    suite.setLook(entry.lookId);
  }
  lightTableGlow.color.set((entry.palette && entry.palette.colors && entry.palette.colors[1]) || '#7ce8ff');
  syncRawNotes();
}

function applyPoemReel(poemObj, showFloat = true) {
  if (!poemObj) return;
  state.selectedPoem = poemObj.num;
  reelEntries.forEach((re) => {
    const on = re.num === poemObj.num;
    re.contactPlate.material.emissiveIntensity = on ? 1.25 : 0.35;
    re.group.scale.setScalar(on ? 1.16 : 1.0);
  });
  savePilotState({ poem: poemObj.num });
  redraw3DWallPassage();
  syncRawNotes();

  if (showFloat) {
    const line0 = (poemObj.lines && poemObj.lines[0] && poemObj.lines[0].text) || poemObj.essence || '';
    showPassageFloat(
      `Poem ${poemObj.num} · ${poemObj.title} (${poemObj.district})`,
      `"${line0}"`,
      new THREE.Vector3(4.2, 3.65, 0.25)
    );
  }
}

function syncPilotToScene(p) {
  pilot = p;
  gateDoorPivot.rotation.y = p.doorOpen ? -1.22 : 0.0;
  interiorPortalPlane.material.opacity = p.doorOpen ? 0.42 : 0.08;
  const r = CALVINO_READINGS[state.reading] || CALVINO_READINGS.memory;
  visitorA.targetZ = p.doorOpen && r.gateRuleOpenForA ? -0.32 : 1.15;
  visitorB.targetZ = p.doorOpen && r.gateRuleOpenForB ? -0.55 : 2.15;
  syncRawNotes();
}
subscribePilotState((next) => syncPilotToScene(next));

// Build initial fallback 21 filters & 14 reels immediately, then hydrate from JSON
build21GlassFilters(
  Array.from({ length: 21 }, (_, i) => ({
    name: `District Filter ${i + 1}`,
    colors: ['#0c1f38', '#18b4ff', '#f4eedd', '#e0b46a', '#7a382a', '#5fe8ff'],
  }))
);

async function loadBundledData() {
  const [poems, palettes] = await Promise.all([
    fetch('./data/poems_dossiers.json').then((r) => r.json()),
    fetch('./data/palettes.json').then((r) => r.json()),
  ]);
  state.poemsList = poems || [];
  state.palettesList = palettes || [];

  build21GlassFilters(state.palettesList);
  build14PoemReels(state.poemsList);

  const initPoem = state.poemsList.find((x) => x.num === state.selectedPoem) || state.poemsList[0];
  if (initPoem) applyPoemReel(initPoem, false);
  applyCalvinoReading(state.reading, false, false);
}
loadBundledData();
applyCalvinoReading(state.reading, false, false);
syncPilotToScene(pilot);

// ---------------------------------------------------------------------------
// 9. Raycast Hover Whispers, Click Interactions, WASD Walk & Orbit Look
// ---------------------------------------------------------------------------
const whisperEl = document.getElementById('world-whisper');
const passageFloatEl = document.getElementById('world-passage-float');
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(-99, -99);
const keys = {};

let activeHoverAnchor = null;
let activeHoverLead = '';
let activeHoverMeta = '';

function resolveInteractAnchor(info, fallbackObj) {
  if (typeof info.getAnchor === 'function') return info.getAnchor();
  if (info.visitor) {
    const v = new THREE.Vector3(0, 1.98, 0);
    return info.visitor.root.localToWorld(v);
  }
  if (info.anchor) return info.anchor;
  const wp = new THREE.Vector3();
  fallbackObj.getWorldPosition(wp);
  wp.y += 0.4;
  return wp;
}

function updateRaycastHover() {
  if (pointerNDC.x < -2) return;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(interactMeshes, false);
  if (hits.length > 0) {
    const hitObj = hits[0].object;
    const info = hitObj.userData.interact;
    const [lead, meta] = info.getWhisper();
    activeHoverAnchor = resolveInteractAnchor(info, hitObj);
    activeHoverLead = lead;
    activeHoverMeta = meta;
    renderer.domElement.style.cursor = 'pointer';
    return;
  }
  activeHoverAnchor = null;
  renderer.domElement.style.cursor = dragging ? 'grabbing' : 'grab';
}

function executeInteract(info, shiftKey) {
  if (!info) return;
  if (info.kind === 'calvino-folio') {
    applyCalvinoReading(info.readingId, true, true);
    return;
  }
  if (info.kind === 'glass-filter') {
    applyGlassFilter(info.filterIdx, shiftKey);
    return;
  }
  if (info.kind === 'poem-reel') {
    applyPoemReel(info.poem, true);
    return;
  }
  if (info.kind === 'severn-portal') {
    if (!pilot.doorOpen && !shiftKey) {
      savePilotState({ doorOpen: true });
      syncPilotToScene(loadPilotState());
      state.encounterT = 0.0;
      state.replaying = true;
      return;
    }
    navigateToCityRoute(shiftKey ? '../foundry/' : '../');
    return;
  }
  if (info.kind === 'foundry-portal') {
    navigateToCityRoute('../foundry/');
    return;
  }
  if (info.kind === 'toggle-door') {
    savePilotState({ doorOpen: !pilot.doorOpen });
    syncPilotToScene(loadPilotState());
    state.encounterT = 0.0;
    state.replaying = true;
    return;
  }
  if (info.kind === 'visitor') {
    state.encounterT = 0.0;
    state.replaying = true;
    const r = CALVINO_READINGS[state.reading];
    const line = info.visitor.id === 'makeda' ? r.visAOutcome : r.visBOutcome;
    const anchor = info.visitor.root.localToWorld(new THREE.Vector3(0, 2.05, 0));
    showPassageFloat(info.visitor.name, line, anchor);
    return;
  }
  if (info.kind === 'cycle-parcel') {
    const order = ['player', 'bekele', 'maren'];
    const nxt = order[(order.indexOf(pilot.parcelHolder || 'player') + 1) % order.length];
    savePilotState({ parcelHolder: nxt });
    syncPilotToScene(loadPilotState());
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
    state.lookYaw -= dx * 0.0036;
    state.lookPitch = Math.max(-0.52, Math.min(0.55, state.lookPitch - dy * 0.0028));
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
  const hits = raycaster.intersectObjects(interactMeshes, false);
  if (hits.length > 0) {
    executeInteract(hits[0].object.userData.interact, e.shiftKey);
  }
});

renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    state.dollyZ = Math.max(-4.8, Math.min(5.2, state.dollyZ + e.deltaY * 0.0045));
  },
  { passive: false }
);

window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  keys[e.code] = true;
  if (e.code === 'Space') {
    setTimeout(() => triggerShutterFlash(), 40);
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
// 10. Main 3D Render & World-Space Label Projection Loop
// ---------------------------------------------------------------------------
let prevSec = performance.now() * 0.001;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now() * 0.001;
  const dt = Math.min(0.05, Math.max(0.001, now - prevSec));
  prevSec = now;

  // WASD Walk + Wheel Dolly + Drag Look
  const moveSpeed = 5.4;
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  if (fwd.lengthSq() > 0.001) fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

  if (keys.KeyW || keys.ArrowUp) state.walkOffset.addScaledVector(fwd, moveSpeed * dt);
  if (keys.KeyS || keys.ArrowDown) state.walkOffset.addScaledVector(fwd, -moveSpeed * dt);
  if (keys.KeyA || keys.ArrowLeft) state.walkOffset.addScaledVector(right, -moveSpeed * dt);
  if (keys.KeyD || keys.ArrowRight) state.walkOffset.addScaledVector(right, moveSpeed * dt);

  if (state.walkOffset.length() > 12.0) {
    state.walkOffset.setLength(12.0);
  }

  camera.position.set(
    state.walkOffset.x,
    2.58,
    8.45 + state.dollyZ + state.walkOffset.z
  );

  // Step through Severn doorway by walking past z < -1.55 when open!
  if (pilot.doorOpen && camera.position.z < -1.65 && Math.abs(camera.position.x) < 1.2) {
    state.walkOffset.z += 1.2;
    navigateToCityRoute('../');
    return;
  }

  const lookDist = 7.4;
  const lookTarget = new THREE.Vector3(
    camera.position.x + Math.sin(state.lookYaw) * lookDist,
    1.82 + state.lookPitch * 4.5,
    camera.position.z - Math.cos(state.lookYaw) * lookDist
  );
  camera.lookAt(lookTarget);

  // Two Visitors Approaching the Severn Gate
  if (state.replaying) {
    state.encounterT = Math.min(1, state.encounterT + dt * 0.4);
    if (state.encounterT >= 1) state.replaying = false;
  }
  const ease = 1 - Math.pow(1 - state.encounterT, 3);
  visitorA.root.position.z = THREE.MathUtils.lerp(visitorA.baseZ, visitorA.targetZ, ease);
  visitorB.root.position.z = THREE.MathUtils.lerp(visitorB.baseZ, visitorB.targetZ, ease);

  // Brass Parcel follows holder
  if (pilot.parcelHolder === 'player') {
    studioParcel.position.set(visitorB.root.position.x + 0.28, 1.05, visitorB.root.position.z - 0.14);
  } else {
    studioParcel.position.set(visitorA.root.position.x + 0.28, 1.05, visitorA.root.position.z - 0.14);
  }
  studioParcel.userData.interact.anchor.set(
    studioParcel.position.x,
    studioParcel.position.y + 0.4,
    studioParcel.position.z - 0.8
  );

  [visitorA, visitorB].forEach((h) => {
    if (h.v8 && typeof h.v8.update === 'function') {
      const want = state.replaying ? 'walk' : 'idle';
      if (h.clip !== want && typeof h.v8.crossFadeTo === 'function') {
        h.clip = want;
        h.v8.crossFadeTo(want, 0.25);
      }
      h.v8.update(dt);
    }
  });

  // Gently spin the active 35mm Film Reel
  reelEntries.forEach((re) => {
    if (re.num === state.selectedPoem) {
      re.spool.rotation.z = now * 1.4;
    }
  });

  // Project hover whisper
  if (activeHoverAnchor) {
    const p = projectWorldLabel(camera, activeHoverAnchor, renderer.domElement);
    if (p.visible) {
      whisperEl.style.display = 'block';
      whisperEl.style.left = `${Math.max(130, Math.min(window.innerWidth - 130, p.left))}px`;
      whisperEl.style.top = `${Math.max(28, Math.min(window.innerHeight - 24, p.top))}px`;
      whisperEl.innerHTML = `${activeHoverLead}<span class="wh-meta">— ${activeHoverMeta}</span>`;
    } else {
      whisperEl.style.display = 'none';
    }
  } else {
    whisperEl.style.display = 'none';
  }

  // Project transient floating passage whisper beside wall on click
  if (now < state.passageFloatUntil && state.passageFloatBody) {
    const pf = projectWorldLabel(camera, state.passageFloatAnchor, renderer.domElement);
    if (pf.visible) {
      passageFloatEl.style.display = 'block';
      passageFloatEl.style.left = `${Math.max(210, Math.min(window.innerWidth - 210, pf.left))}px`;
      passageFloatEl.style.top = `${Math.max(54, Math.min(window.innerHeight - 40, pf.top))}px`;
      passageFloatEl.innerHTML = `<span class="pf-kicker">${state.passageFloatKicker}</span>${state.passageFloatBody}`;
    } else {
      passageFloatEl.style.display = 'none';
    }
  } else {
    passageFloatEl.style.display = 'none';
  }

  if (worldRig && typeof worldRig.update === 'function') {
    worldRig.update(camera.position);
  }

  renderer.render(scene, camera);
}

animate();
