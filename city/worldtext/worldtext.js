// Make-Photo City — Worldtext Bible, Calvino Rule Compiler, 14 Poem Dossiers,
// 21 Palettes Language, Gazetteer, Canon Archive & Live 3D Darkroom Studio.
// Implements Design Briefs 1, 5, 8, and 9 with strict zero-emoji rule and 23 GPU Shaders.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  mountWebGLShaderSuite,
  ALL_CITY_LOOKS,
  loadPilotState,
  savePilotState,
  subscribePilotState,
  applyPilotUrlHash,
  NOLLI_LEDGER_KEY,
} from '../shader-suite-bar.js';
import { CARTRIDGES } from '../cartridges.js';
import { KIT, buildObject, EMBLEM_SVG } from './kit.js';

const CUSTOM_CART_KEY = 'make_photo_worldtext_custom_v1';
let pilot = applyPilotUrlHash();
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

// Mount Atlantis Emblem SVG cleanly
const emblemHost = document.getElementById('emblem-box');
if (emblemHost) emblemHost.innerHTML = EMBLEM_SVG;

// ---------------------------------------------------------------------------
// 1. Brief 5 — Calvino Interlacing Readings & Situated Source Ledger
// ---------------------------------------------------------------------------
const CALVINO_READINGS = {
  memory: {
    id: 'memory',
    label: 'Cities & Memory',
    speaker: 'Salt Guild Chronicler | First Tide Ledger (W00p)',
    prov: 'recorded',
    quote:
      'On the anniversary of the Fall, people chalk the flood line at four metres on every wall that does not already carry it. A clean wall at four metres is a lie about the city.',
    cite: 'Source: wygwyl/world/gazetteer/world.json ("The Night of the Line") + Poem 01 (00:07.8)',
    visAHistory: 'Salt Guild carrier; walked the third landing of the Salt Stair across 14 tides.',
    visAOutcome: 'CLEARED: Worn limestone groove illuminates; threshold door swings open (+0 dB interior transition).',
    visBHistory: 'First-time arrival without logged chalk mark or sitter Margin-Credit.',
    visBOutcome: 'HELD AT CURB: Must chalk +4.00m flood datum witness mark before crossing public Nolli sill.',
    floorColor: '#efe7d2',
    seamBoost: 1.1,
    windowGlow: 0.45,
    gateRuleOpenForA: true,
    gateRuleOpenForB: false,
  },
  exchange: {
    id: 'exchange',
    label: 'Cities & Exchange',
    speaker: 'The Tide Office Clerk | Pier Notice #02 (12h 25m Gate Clock)',
    prov: 'checked',
    quote:
      'Appointments are made at the second gate or between gates. The Archive sells nothing, but the city trades in frames and logged water transfers.',
    cite: 'Source: gazetteer/world.json ("The day of two gates", "pictures") + cartridges.js Block IV Law',
    visAHistory: 'Carries 5.0 L condensate + sealed Severn parcel logged at Standpipe #04.',
    visAOutcome: 'CLEARED AT SECOND GATE: Brass tide lock retracts; parcel handoff to Bekele enabled inside.',
    visBHistory: 'Arrives between gates with unlogged frame and 0 L cooling water.',
    visBOutcome: 'REDIRECTED TO ARCHIVE WINDOW: Must deposit one street plate on the Light Table to unlock.',
    floorColor: '#5fe8ff',
    seamBoost: 1.8,
    windowGlow: 0.75,
    gateRuleOpenForA: true,
    gateRuleOpenForB: false,
  },
  desire: {
    id: 'desire',
    label: 'Cities & Desire',
    speaker: 'The Poet | Poem 01 "Out of Life" (00:07.8 - 00:13.5, 35mm sitting height)',
    prov: 'recorded',
    quote:
      'I look for a way out through the hallways, within the drawers and fire escapes, trip on my own words, falling out of life, and find where you go when you leave.',
    cite: 'Source: wygwyl-world-arch/shots/poems/01.html (set 01.1 fire_escape_night, receding sash window)',
    visAHistory: 'Resident tending ground boiler & laundry; ignores upper escape haze.',
    visAOutcome: 'GROUND ENTRY ONLY: Enters utility corridor; upper sash window remains calm.',
    visBHistory: 'Poet searching for the Ex on the iron fire escape landing.',
    visBOutcome: 'UPPER STAIR UNLOCKED, WINDOW RECEDES: Upper amber sash brightens while threshold stretches back.',
    floorColor: '#f2a541',
    seamBoost: 0.85,
    windowGlow: 2.4,
    gateRuleOpenForA: true,
    gateRuleOpenForB: true,
  },
  signs: {
    id: 'signs',
    label: 'Cities & Signs',
    speaker: 'Keepers & Glaziers | Language Rule W00n ("Where do you go?")',
    prov: 'recorded',
    quote:
      'The city greeting is "Where do you go?" The answer is "when I leave." Saying anything else marks a visitor. Meaning here is use.',
    cite: 'Source: gazetteer/world.json ("Customs") + language/index.html ("The Line and the Seam")',
    visAHistory: 'Answers "when I leave"; reads cyan ring+seam as public Nolli shortcut.',
    visAOutcome: 'READS COMMONS SIGN: Passes straight through vestibule to the courtyard stair.',
    visBHistory: 'Answers with a street number; reads +4.00m salt band as active flood closure.',
    visBOutcome: 'READS HAZARD SIGN: Stops at +0.40m bollard, circling exterior alley instead of entering.',
    floorColor: '#18b4ff',
    seamBoost: 2.2,
    windowGlow: 0.9,
    gateRuleOpenForA: true,
    gateRuleOpenForB: false,
  },
  loss: {
    id: 'loss',
    label: 'Cities & Loss (Kintsugi)',
    speaker: 'Glazier Guild | Resurrection Repair Ledger (Kind 2 Reuse)',
    prov: 'checked',
    quote:
      'Ruins are not replaced, they are repaired: white ceramic plates over the old brick, with their seams drawn in cyan light, and no two seams drawn alike.',
    cite: 'Source: wygwyl/world/language/index.html ("Kintsugi of the Resurrection") + Poem 06',
    visAHistory: 'Paid Glazier ceramic repair bill; carries ancestral shard from the Fall.',
    visAOutcome: 'TRACE RECORDED: Leaves permanent luminous cyan kintsugi seam on threshold stone upon exit.',
    visBHistory: 'Unfamiliar with pre-Fall chapel footprint beneath the vault.',
    visBOutcome: 'WITNESS VIEW ONLY: Threshold holds half-open; hears muffled choir resonance behind brick.',
    floorColor: '#d8b4fe',
    seamBoost: 2.8,
    windowGlow: 0.55,
    gateRuleOpenForA: true,
    gateRuleOpenForB: false,
  },
};

const SITUATED_PLACES = [
  {
    place: '01 | The Severn Bedroom, Hallway & Fire Escape',
    accounts: [
      'Poet Account (Poem 01, 00:00-01:26, POV sitting height): Window slides away on a rail as orange haze eats the cold TV-lit room.',
      'Hero Compiler Account (heroes/hdl.json, checked): Fixed 20x12m 4-storey brick envelope; flats 1A-4E around a stable stair core; only sash opens.',
      'Disagreement Preserved: Hallway recedes infinitely in Poem 01 memory reading, whereas HDL enforces finite 12.0m metric depth.',
    ],
    prov: 'recorded',
  },
  {
    place: '02 | Baltimere Rowhouse, Marble Stoop & Back Stair',
    accounts: [
      'Language Rule W00n (checked): Circulation stays outside on marble stoops and iron back stairs (22% of tall old houses) with lighter wood/stucco roof additions.',
      'Poem 03 / 08 Account (situated dusk): Back stair acts as private departure route bypassing street-front threshold.',
      'Disagreement Preserved: Gazetteer addresses landings as public streets; residents treat upper landings as domestic thresholds.',
    ],
    prov: 'checked',
  },
  {
    place: '03 | Drowned Chapel -> White Temple & Reflecting Pool',
    accounts: [
      'Gazetteer Custom ("Meaning is use", recorded): Pre-Fall stone chapel ruin under the ceramic vault is called "the white temple" now; old name survives only in the Archive.',
      'Poem 12 "Reunion" (situated night mirror-pool): Perfect still water doubles skyline; cyan pulse silences street speech as it crosses.',
      'Disagreement Preserved: Resonance Society factions dispute whether summit pipes follow the 12.42h tide or poem line breaks.',
    ],
    prov: 'inferred',
  },
];

const COMPILED_RULES = [
  {
    id: 'WT-R01',
    series: 'Memory',
    rule: 'Physical +4.00 m Flood Datum vs 4/10 Symbolic Object Stripe',
    evidence: 'language/index.html: Fall water stood at +4.00m across all low-lying pre-Fall walls; small objects carry a 4/10 memory band.',
    op: 'Applies damp verdigris wear below y=+4.00m on buildings & line-post while keeping bollard stripe at y=+0.40m.',
    status: 'checked',
    source: 'https://hartswf0.github.io/butterfly-halfworld/wygwyl/world/language/index.html',
  },
  {
    id: 'WT-R02',
    series: 'Exchange',
    rule: 'Semidiurnal Two-Gate Access & Parcel Handoff Persistence',
    evidence: 'gazetteer/world.json + Brief 9: Tide gates open every 12h 25m; parcel ownership survives view switches.',
    op: 'Couples gate clearance & `make_photo_pilot_v1.parcelHolder` across Worldtext, Foundry, Island, and Atlantis.',
    status: 'checked',
    source: 'https://hartswf0.github.io/butterfly-halfworld/wygwyl/world/gazetteer/index.html',
  },
  {
    id: 'WT-R03',
    series: 'Signs',
    rule: 'Door-Coupled Acoustic Low-Pass & Greeting Verification',
    evidence: 'Brief 5 & Brief 8: Closing Severn door changes both walkability and street-to-room sound transmission.',
    op: 'Swings `doorLeaf` mesh, blocks Stranger path in Signs/Memory mode, and drops exterior filter to 580 Hz.',
    status: 'checked',
    source: 'https://hartswf0.github.io/wygwyl-world-arch/design-prompts.html#worldtext',
  },
  {
    id: 'WT-R04',
    series: 'Loss',
    rule: 'Voronoi White Ceramic Kintsugi Plates & Unique Cyan Seams',
    evidence: 'language/index.html: Glaziers mend broken brick in white ceramic with emissive cyan seams brighter at night.',
    op: 'Mounts proud ceramic repair slabs + emissive `#18b4ff` seam geometry scaled by `seamBoost` & night mix.',
    status: 'recorded',
    source: 'https://hartswf0.github.io/butterfly-halfworld/wygwyl/world/language/index.html',
  },
  {
    id: 'WT-R05',
    series: 'Desire',
    rule: 'Nongeographic "The Black" Suspension Outside Street Graph',
    evidence: 'districts/scenes.json + Brief 9: Realm X (ballroom hole in floor, floating door) has no line, no seam, no street coordinates.',
    op: 'Flags `the-black` as authored-cut-only (`streetNetworkConnected: false`), never routed by ground vehicles.',
    status: 'checked',
    source: 'https://hartswf0.github.io/butterfly-halfworld/wygwyl/world/districts/index.html',
  },
  {
    id: 'WT-R06',
    series: 'Unresolved',
    rule: 'Street-Wide Speech Silence During Night Cyan Resonance Wave',
    evidence: 'gazetteer/world.json ("The pulse"): "When the cyan ring crosses the facades at night, people on the street stop talking until it has passed."',
    op: 'UNRESOLVED REQUIREMENT: Needs city-wide wavefront phase bus across all autonomous Island/Nolli NPCs.',
    status: 'unresolved',
    source: 'https://hartswf0.github.io/butterfly-halfworld/wygwyl/world/gazetteer/index.html#customs',
  },
  {
    id: 'WT-R07',
    series: 'Unresolved',
    rule: 'Everyday Street Grit Coverage (<6 Strong Archive Frames)',
    evidence: 'language/grit.json: Archive is rich in puddles & neon, sparse in lived-in domestic hardware & corner-shop counters.',
    op: 'UNRESOLVED REQUIREMENT: Preserves deterministic generation prompts in Tab 04 until new footage is verified.',
    status: 'unresolved',
    source: 'https://hartswf0.github.io/butterfly-halfworld/wygwyl/world/language/index.html',
  },
];

// ---------------------------------------------------------------------------
// 2. Live 3D Studio Turntable & Severn Gate Stage (Three.js + 23 Shaders)
// ---------------------------------------------------------------------------
const ttWrap = document.getElementById('turntable-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const initRect = ttWrap.getBoundingClientRect();
renderer.setSize(Math.max(320, initRect.width || 760), Math.max(340, initRect.height || 400));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
ttWrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0c1f38');
scene.fog = new THREE.FogExp2('#0e2440', 0.014);

const camera = new THREE.PerspectiveCamera(
  42,
  Math.max(320, initRect.width || 760) / Math.max(340, initRect.height || 400),
  0.12,
  160
);

const hemiLight = new THREE.HemisphereLight('#c6e4ff', '#2a2622', 1.35);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight('#ffd8ad', 2.6);
keyLight.position.set(9, 14, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);

const doorWarmLight = new THREE.PointLight('#ffb35c', 14, 14, 1.5);
doorWarmLight.position.set(0, 2.2, -1.2);
scene.add(doorWarmLight);

const seamCyanLight = new THREE.PointLight('#18b4ff', 12, 16, 1.5);
seamCyanLight.position.set(1.6, 3.6, 2.2);
scene.add(seamCyanLight);

const suite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: pilot.shader || 'weave',
  defaultTime: 'bluehour',
  locationName: 'Worldtext Studio & Severn Gate',
  cartridgeName: 'Atlantis',
  onTimeChange: (_key, preset) => {
    if (!studioState.rawDaylight && preset) {
      scene.background.set(preset.skyTop || '#0c1f38');
      scene.fog.color.set(preset.skyTop || '#0c1f38');
      keyLight.intensity = preset.sunIntensity;
      hemiLight.intensity = preset.hemiIntensity;
    }
  },
});

// Turntable Plinth & Subject Groups
const turntableRoot = new THREE.Group();
scene.add(turntableRoot);

const plinth = new THREE.Mesh(
  new THREE.CylinderGeometry(7.6, 8.0, 0.36, 64),
  new THREE.MeshStandardMaterial({ color: '#1e2936', roughness: 0.42, metalness: 0.18 })
);
plinth.position.y = -0.18;
plinth.receiveShadow = true;
turntableRoot.add(plinth);

const plinthRim = new THREE.Mesh(
  new THREE.TorusGeometry(7.8, 0.05, 8, 96),
  new THREE.MeshBasicMaterial({ color: '#18b4ff' })
);
plinthRim.rotation.x = Math.PI / 2;
plinthRim.position.y = 0.01;
turntableRoot.add(plinthRim);

const gateSubjectGroup = new THREE.Group();
const vignetteSubjectGroup = new THREE.Group();
const kitSubjectGroup = new THREE.Group();
const cartridgeSubjectGroup = new THREE.Group();
turntableRoot.add(gateSubjectGroup, vignetteSubjectGroup, kitSubjectGroup, cartridgeSubjectGroup);

// --- Build Subject 01: Severn Threshold Gate (+4.00m Flood Datum vs 0.40m Bollard Stripe + 2 Visitors) ---
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
  // Damp green-salt moss wear strictly below +4.00 m (lower 62% of 6.4m wall)
  const dampGrad = g.createLinearGradient(0, 190, 0, 512);
  dampGrad.addColorStop(0, 'rgba(46, 84, 74, 0.08)');
  dampGrad.addColorStop(1, 'rgba(32, 66, 58, 0.58)');
  g.fillStyle = dampGrad;
  g.fillRect(0, 192, 512, 320);
  // Crisp +4.00 m chalked salt flood line
  g.fillStyle = '#f4eedd';
  g.fillRect(0, 186, 512, 9);
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
  emissiveIntensity: 0.85,
  roughness: 0.2,
});

// Left & right Severn wall piers (height 6.4m so +4.00m line sits accurately at y = 4.00m!)
const sWallL = new THREE.Mesh(new THREE.BoxGeometry(2.6, 6.4, 0.85), severnBrickMat);
sWallL.position.set(-2.35, 3.2, -0.8);
sWallL.castShadow = true;
sWallL.receiveShadow = true;
gateSubjectGroup.add(sWallL);

const sWallR = new THREE.Mesh(new THREE.BoxGeometry(2.6, 6.4, 0.85), severnBrickMat);
sWallR.position.set(2.35, 3.2, -0.8);
sWallR.castShadow = true;
sWallR.receiveShadow = true;
gateSubjectGroup.add(sWallR);

const sWallTop = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.3, 0.85), severnBrickMat);
sWallTop.position.set(0, 4.75, -0.8);
sWallTop.castShadow = true;
gateSubjectGroup.add(sWallTop);

// Explicit +4.00 m Salt Flood Band & Kintsugi Ceramic Patch + Cyan Seam
const datumBand3D = new THREE.Mesh(
  new THREE.BoxGeometry(7.35, 0.11, 0.92),
  new THREE.MeshStandardMaterial({ color: '#faf6eb', emissive: '#faf6eb', emissiveIntensity: 0.28 })
);
datumBand3D.position.set(0, 4.0, -0.8);
gateSubjectGroup.add(datumBand3D);

const kintsugiPatch = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.15, 0.9), ceramicMat);
kintsugiPatch.position.set(2.1, 4.85, -0.78);
gateSubjectGroup.add(kintsugiPatch);

const kintsugiSeam = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.94), cyanSeamMat);
kintsugiSeam.position.set(2.1, 4.28, -0.78);
gateSubjectGroup.add(kintsugiSeam);

// Upper Severn Bedroom Sash Window + Iron Fire Escape Landing (Poem 01)
const upperSash = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.55, 0.12), upperWindowMat);
upperSash.position.set(-2.25, 4.95, -0.34);
gateSubjectGroup.add(upperSash);

const ironMat = new THREE.MeshStandardMaterial({ color: '#1d232a', roughness: 0.5, metalness: 0.65 });
const escapePlatform = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.1), ironMat);
escapePlatform.position.set(-2.25, 4.12, 0.22);
gateSubjectGroup.add(escapePlatform);
const escapeRail = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 0.06), ironMat);
escapeRail.position.set(-2.25, 4.55, 0.74);
gateSubjectGroup.add(escapeRail);

// Operable Severn Threshold Door Leaf
const gateDoorPivot = new THREE.Group();
gateDoorPivot.position.set(-0.98, 0.0, -0.75);
const gateDoorLeaf = new THREE.Mesh(
  new THREE.BoxGeometry(1.94, 3.05, 0.12),
  new THREE.MeshStandardMaterial({ color: '#cbb182', roughness: 0.44, metalness: 0.24 })
);
gateDoorLeaf.position.set(0.97, 1.525, 0);
gateDoorLeaf.castShadow = true;
gateDoorPivot.add(gateDoorLeaf);
gateSubjectGroup.add(gateDoorPivot);

// Calvino Observable Floor Trace Path + Tide-Post (+4.00m) vs Small Bollard (+0.40m stripe)
const wornPathMat = new THREE.MeshStandardMaterial({
  color: '#efe7d2',
  emissive: '#18b4ff',
  emissiveIntensity: 0.35,
  roughness: 0.45,
});
const wornPathMesh = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.03, 5.8), wornPathMat);
wornPathMesh.position.set(-0.45, 0.02, 1.6);
gateSubjectGroup.add(wornPathMesh);

const gateLinePost = buildObject('line post'); // Exact +4.00 m physical datum post!
gateLinePost.position.set(-4.35, 0, 0.85);
gateSubjectGroup.add(gateLinePost);

const gateBollard = buildObject('bollard'); // Symbolic 0.40 m (4/10) stripe object!
gateBollard.position.set(1.65, 0, 2.35);
gateSubjectGroup.add(gateBollard);

const gateBench = buildObject('bench');
gateBench.position.set(3.8, 0, 1.8);
gateBench.rotation.y = -0.6;
gateSubjectGroup.add(gateBench);

// Two Visitors with Different Histories (Anny V8) + Shared Parcel
const visitorA = { root: new THREE.Group(), v8: null, baseZ: 3.8, targetZ: -1.6 };
visitorA.root.position.set(-0.55, 0, 3.8);
visitorA.root.rotation.y = Math.PI;
gateSubjectGroup.add(visitorA.root);

const visitorB = { root: new THREE.Group(), v8: null, baseZ: 4.3, targetZ: 1.9 };
visitorB.root.position.set(0.85, 0, 4.3);
visitorB.root.rotation.y = Math.PI;
gateSubjectGroup.add(visitorB.root);

function addHumanWithProxy(targetObj, archetype, coatHex, skinHex) {
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
addHumanWithProxy(visitorA, 'elder', '#1c4d5e', '#5a3826'); // Makeda (Salt Guild)
addHumanWithProxy(visitorB, 'adult_m', '#262932', '#68432f'); // Unregistered Stranger / Poet

const studioParcel = new THREE.Mesh(
  new THREE.BoxGeometry(0.32, 0.2, 0.24),
  new THREE.MeshStandardMaterial({ color: '#e0b46a', emissive: '#f2a541', emissiveIntensity: 0.35 })
);
gateSubjectGroup.add(studioParcel);

// --- Build Subject 02: Canonical Poem Vignettes (White Temple Pool / Rowhouse Stoop / Severn Escape) ---
let activeVignetteId = 'temple';
function rebuildVignette(id) {
  activeVignetteId = id;
  while (vignetteSubjectGroup.children.length) vignetteSubjectGroup.remove(vignetteSubjectGroup.children[0]);

  if (id === 'temple') {
    const pool = new THREE.Mesh(
      new THREE.CylinderGeometry(5.6, 5.6, 0.14, 48),
      new THREE.MeshStandardMaterial({ color: '#0d3b56', emissive: '#18b4ff', emissiveIntensity: 0.28, roughness: 0.08, metalness: 0.6 })
    );
    pool.position.y = 0.07;
    vignetteSubjectGroup.add(pool);
    const vault = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.5),
      ceramicMat
    );
    vault.position.y = 1.6;
    vignetteSubjectGroup.add(vault);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 3.2, 14), ceramicMat);
      col.position.set(Math.cos(a) * 3.1, 1.6, Math.sin(a) * 3.1);
      vignetteSubjectGroup.add(col);
    }
    const ringHalo = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.08, 10, 48), cyanSeamMat);
    ringHalo.rotation.x = Math.PI / 2;
    ringHalo.position.y = 3.6;
    vignetteSubjectGroup.add(ringHalo);
  } else {
    // Baltimere Rowhouse + Marble Stoop + Later Roof Addition
    const house = new THREE.Mesh(new THREE.BoxGeometry(4.8, 4.6, 4.2), severnBrickMat);
    house.position.y = 2.3;
    vignetteSubjectGroup.add(house);
    const addition = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.8, 3.0),
      new THREE.MeshStandardMaterial({ color: '#d8ceb8', roughness: 0.7 })
    );
    addition.position.set(0.3, 5.5, -0.2);
    vignetteSubjectGroup.add(addition);
    for (let s = 0; s < 5; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.38), ceramicMat);
      step.position.set(-0.8, 0.11 + s * 0.22, 2.3 + (4 - s) * 0.34);
      vignetteSubjectGroup.add(step);
    }
  }
}
rebuildVignette('temple');

// --- Build Subject 03: Atlantis Object Kit (All 11 kit.js objects + Human Scale) ---
let activeKitName = 'tide lamp';
const kitHumanRef = { root: new THREE.Group(), v8: null };
addHumanWithProxy(kitHumanRef, 'adult_f', '#243c4c', '#543525');
kitHumanRef.root.position.set(-1.65, 0, 0.3);

function rebuildKitTurntable(name) {
  activeKitName = name;
  while (kitSubjectGroup.children.length) kitSubjectGroup.remove(kitSubjectGroup.children[0]);
  const obj = buildObject(name);
  kitSubjectGroup.add(obj);
  kitSubjectGroup.add(kitHumanRef.root);
}
rebuildKitTurntable('tide lamp');

// --- Build Subject 04: Authored Worldtext Cartridge Block ---
let authoredCartridge = {
  id: 'atlantis',
  name: CARTRIDGES.atlantis.name,
  district: CARTRIDGES.atlantis.district,
  buildingName: CARTRIDGES.atlantis.buildingName,
  masonry: CARTRIDGES.atlantis.palette.masonry,
  cyan: CARTRIDGES.atlantis.palette.cyan,
  sodium: CARTRIDGES.atlantis.palette.sodium,
  law: CARTRIDGES.atlantis.worldtext.gazetteer.law,
  arch: CARTRIDGES.atlantis.worldtext.gazetteer.architecture,
  lexicon: CARTRIDGES.atlantis.worldtext.lexicon.map((l) => `${l.term} : ${l.meaning}`).join('\n'),
  duet: CARTRIDGES.atlantis.residents[0].duet.greeting,
};

function rebuildCartridgeBlock(cart) {
  while (cartridgeSubjectGroup.children.length) cartridgeSubjectGroup.remove(cartridgeSubjectGroup.children[0]);
  const mMat = new THREE.MeshStandardMaterial({ color: cart.masonry || '#475c63', roughness: 0.65 });
  const cMat = new THREE.MeshStandardMaterial({
    color: cart.cyan || '#18b4ff',
    emissive: cart.cyan || '#18b4ff',
    emissiveIntensity: 1.35,
  });
  const sMat = new THREE.MeshStandardMaterial({
    color: cart.sodium || '#ffb35c',
    emissive: cart.sodium || '#ffb35c',
    emissiveIntensity: 1.1,
  });

  const mainHall = new THREE.Mesh(new THREE.BoxGeometry(5.6, 4.8, 4.8), mMat);
  mainHall.position.y = 2.4;
  mainHall.castShadow = true;
  cartridgeSubjectGroup.add(mainHall);

  // Carved White Nolli Ground Passage
  const nolliCut = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.8, 5.0), ceramicMat);
  nolliCut.position.set(0, 1.4, 0);
  cartridgeSubjectGroup.add(nolliCut);

  const datum = new THREE.Mesh(new THREE.BoxGeometry(5.75, 0.1, 4.95), ceramicMat);
  datum.position.y = 4.0;
  cartridgeSubjectGroup.add(datum);

  const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.4, 12), cMat);
  conduit.position.set(2.1, 2.7, 2.45);
  cartridgeSubjectGroup.add(conduit);

  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), sMat);
  lantern.position.set(-1.6, 3.1, 2.55);
  cartridgeSubjectGroup.add(lantern);
}
rebuildCartridgeBlock(authoredCartridge);

// ---------------------------------------------------------------------------
// 3. Studio Subject Switching, Calvino Reading Execution & Orbit Camera
// ---------------------------------------------------------------------------
const studioState = {
  subject: 'gate', // 'gate' | 'vignette' | 'kit' | 'cartridge'
  reading: CALVINO_READINGS[pilot.account] ? pilot.account : 'memory',
  rawDaylight: !!pilot.rawDaylight,
  autoSpin: false,
  orbitYaw: 0.34,
  orbitPitch: 0.24,
  orbitDist: 11.2,
  encounterT: 0.65,
  replaying: true,
};

function updateSubSelectorBar() {
  const bar = document.getElementById('sub-selector-bar');
  bar.innerHTML = '';
  if (studioState.subject === 'kit') {
    Object.keys(KIT).forEach((k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill' + (k === activeKitName ? ' active' : '');
      b.style.padding = '2px 6px';
      b.textContent = k;
      b.addEventListener('click', () => {
        rebuildKitTurntable(k);
        updateSubSelectorBar();
        const spec = KIT[k];
        document.getElementById('vp-subject-title').textContent = `KIT: ${k.toUpperCase()} (${spec.h}M | ${spec.datumKind.toUpperCase()})`;
      });
      bar.appendChild(b);
    });
  } else if (studioState.subject === 'vignette') {
    [
      ['temple', 'White Temple & Mirror Pool'],
      ['rowhouse', 'Baltimere Stoop & Addition'],
    ].forEach(([id, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill' + (id === activeVignetteId ? ' active' : '');
      b.style.padding = '2px 7px';
      b.textContent = label;
      b.addEventListener('click', () => {
        rebuildVignette(id);
        updateSubSelectorBar();
      });
      bar.appendChild(b);
    });
  }
}

function setStudioSubject(subj) {
  studioState.subject = subj;
  gateSubjectGroup.visible = subj === 'gate';
  vignetteSubjectGroup.visible = subj === 'vignette';
  kitSubjectGroup.visible = subj === 'kit';
  cartridgeSubjectGroup.visible = subj === 'cartridge';

  document.querySelectorAll('#stage-mode-strip .pill').forEach((b) => {
    b.classList.toggle('active', b.dataset.subject === subj);
  });

  const titles = {
    gate: 'STAGE: THE SEVERN THRESHOLD (+4.00 M PHYSICAL FLOOD DATUM VS 0.40 M BOLLARD STRIPE)',
    vignette: 'STAGE: CANONICAL POEM VIGNETTE TURNTABLE',
    kit: `KIT: ${activeKitName.toUpperCase()} (${KIT[activeKitName].h}M | ${KIT[activeKitName].datumKind.toUpperCase()})`,
    cartridge: `CARTRIDGE PREVIEW: ${authoredCartridge.name.toUpperCase()}`,
  };
  document.getElementById('vp-subject-title').textContent = titles[subj];
  updateSubSelectorBar();
}

document.querySelectorAll('#stage-mode-strip .pill').forEach((b) => {
  b.addEventListener('click', () => setStudioSubject(b.dataset.subject));
});

function applyCalvinoReading(readingId, persist = true) {
  const r = CALVINO_READINGS[readingId] || CALVINO_READINGS.memory;
  studioState.reading = r.id;
  document.querySelectorAll('#calvino-reading-strip .pill').forEach((b) => {
    b.classList.toggle('active', b.dataset.reading === r.id);
  });

  document.getElementById('situated-speaker').textContent = r.speaker;
  const provBadge = document.getElementById('situated-prov');
  provBadge.textContent = r.prov;
  provBadge.className = `badge ${r.prov}`;
  document.getElementById('situated-quote').textContent = `"${r.quote}"`;
  document.getElementById('situated-cite').textContent = r.cite;
  document.getElementById('vis-a-history').textContent = r.visAHistory;
  document.getElementById('vis-a-outcome').textContent = r.visAOutcome;
  document.getElementById('vis-b-history').textContent = r.visBHistory;
  document.getElementById('vis-b-outcome').textContent = r.visBOutcome;

  // Apply observable spatial changes to the 3D Severn Gate Stage!
  wornPathMat.color.set(r.floorColor);
  wornPathMat.emissive.set(r.floorColor);
  cyanSeamMat.emissiveIntensity = r.seamBoost;
  upperWindowMat.emissiveIntensity = r.windowGlow;

  // Visitor A vs Visitor B stop/pass targets
  visitorA.targetZ = pilot.doorOpen && r.gateRuleOpenForA ? -1.8 : 1.1;
  visitorB.targetZ = pilot.doorOpen && r.gateRuleOpenForB ? -1.4 : 2.15;

  // Receding window rail in Desire mode (Poem 01.1)!
  upperSash.position.z = r.id === 'desire' ? -0.95 : -0.34;

  studioState.encounterT = 0.0;
  studioState.replaying = true;
  if (persist) savePilotState({ account: r.id });
}

document.querySelectorAll('#calvino-reading-strip .pill').forEach((b) => {
  b.addEventListener('click', () => applyCalvinoReading(b.dataset.reading, true));
});
document.getElementById('btn-replay-gate').addEventListener('click', () => {
  setStudioSubject('gate');
  studioState.encounterT = 0.0;
  studioState.replaying = true;
});

document.getElementById('btn-raw-daylight').addEventListener('click', () => {
  studioState.rawDaylight = !studioState.rawDaylight;
  const btn = document.getElementById('btn-raw-daylight');
  btn.textContent = studioState.rawDaylight ? 'Light: Raw Daylight' : 'Light: Authored Hour';
  btn.classList.toggle('active', studioState.rawDaylight);
  if (studioState.rawDaylight) {
    scene.background.set('#cfd8e0');
    scene.fog.density = 0.001;
    hemiLight.intensity = 2.1;
    keyLight.intensity = 3.1;
    suite.setLook('natural');
  } else {
    scene.background.set('#0c1f38');
    scene.fog.density = 0.014;
    suite.setLook(pilot.shader || 'weave');
  }
  savePilotState({ rawDaylight: studioState.rawDaylight });
});

document.getElementById('btn-spin-toggle').addEventListener('click', (e) => {
  studioState.autoSpin = !studioState.autoSpin;
  e.currentTarget.textContent = `Spin: ${studioState.autoSpin ? 'On' : 'Off'}`;
  e.currentTarget.classList.toggle('active', studioState.autoSpin);
});

document.getElementById('btn-studio-plate').addEventListener('click', () => {
  suite.exposePlate({ locationName: `Worldtext Studio (${studioState.subject})` });
  renderSharedLightTable();
});

// Sync Pilot Door & Parcel
function syncPilotUI(p) {
  pilot = p;
  gateDoorPivot.rotation.y = p.doorOpen ? -1.22 : 0.0;
  visitorA.targetZ = p.doorOpen && CALVINO_READINGS[studioState.reading].gateRuleOpenForA ? -1.8 : 1.1;
  visitorB.targetZ = p.doorOpen && CALVINO_READINGS[studioState.reading].gateRuleOpenForB ? -1.4 : 2.15;

  document.getElementById('vp-pilot-status').textContent =
    `PILOT SYNC: building=${p.building} | poem=${p.poem} | door=${p.doorOpen ? 'open' : 'closed'} | parcel=${p.parcelHolder} | tide=${p.tidePhase}`;
  document.getElementById('btn-wt-door').textContent = `Severn Door: ${p.doorOpen ? 'Open' : 'Closed'}`;
  document.getElementById('btn-wt-parcel').textContent = `Parcel: ${p.parcelHolder.toUpperCase()} (Cycle)`;
}
document.getElementById('btn-wt-door').addEventListener('click', () => {
  savePilotState({ doorOpen: !pilot.doorOpen });
  syncPilotUI(loadPilotState());
});
document.getElementById('btn-wt-parcel').addEventListener('click', () => {
  const order = ['player', 'bekele', 'maren'];
  const nxt = order[(order.indexOf(pilot.parcelHolder) + 1) % order.length];
  savePilotState({ parcelHolder: nxt });
  syncPilotUI(loadPilotState());
});
subscribePilotState((next) => syncPilotUI(next));

// Pointer drag orbit on #turntable-wrap
let dragging = false;
let lastPt = { x: 0, y: 0 };
ttWrap.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastPt = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastPt.x;
  const dy = e.clientY - lastPt.y;
  lastPt = { x: e.clientX, y: e.clientY };
  studioState.orbitYaw -= dx * 0.006;
  studioState.orbitPitch = Math.max(0.06, Math.min(0.85, studioState.orbitPitch + dy * 0.005));
});
window.addEventListener('pointerup', () => {
  dragging = false;
});
ttWrap.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    studioState.orbitDist = Math.max(4.8, Math.min(19.0, studioState.orbitDist + e.deltaY * 0.008));
  },
  { passive: false }
);

function resizeStudio() {
  const r = ttWrap.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  renderer.setSize(r.width, r.height);
}
window.addEventListener('resize', resizeStudio);

// ---------------------------------------------------------------------------
// 4. Workbench 6-Tab Switching & Rendering Bundled Datasets
// ---------------------------------------------------------------------------
document.querySelectorAll('[data-wbtab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.wbtab;
    document.querySelectorAll('[data-wbtab]').forEach((b) => b.classList.toggle('active', b === btn));
    ['compiler', 'cartridges', 'poems', 'palettes', 'gazetteer', 'archive'].forEach((id) => {
      document.getElementById(`wb-${id}`).hidden = id !== target;
    });
    if (target === 'archive') renderSharedLightTable();
  });
});

// Tab 01: Situated Places & Executable Rule Compiler
document.getElementById('situated-places-grid').innerHTML = SITUATED_PLACES.map(
  (sp) => `<article class="item-card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
      <b style="font:600 15px var(--serif);color:var(--paper);">${sp.place}</b>
      <span class="badge ${sp.prov}">${sp.prov}</span>
    </div>
    <ul style="margin:4px 0 0;padding-left:16px;color:var(--muted);font-size:12px;display:grid;gap:5px;">
      ${sp.accounts.map((a) => `<li>${a}</li>`).join('')}
    </ul>
  </article>`
).join('');

document.querySelector('#rules-compiler-table tbody').innerHTML = COMPILED_RULES.map(
  (r) => `<tr>
    <td style="font:600 11px var(--mono);color:var(--cyan);white-space:nowrap;">${r.id}</td>
    <td><span class="badge ${r.status === 'unresolved' ? 'unresolved' : 'recorded'}">${r.series}</span></td>
    <td><b style="color:var(--paper);">${r.rule}</b><br><span style="color:var(--dim);font-size:11.5px;">${r.evidence}</span></td>
    <td style="color:var(--muted);">${r.op}</td>
    <td><span class="badge ${r.status}">${r.status}</span><br><a href="${r.source}" target="_blank" rel="noopener" style="font:500 10.5px var(--mono);color:var(--aqua);">Source</a></td>
  </tr>`
).join('');

// Tab 02: Cartridge Authoring (Atlantis, Baltimere, Ahiya, Blank Slate)
const BALTIMERE_PRESET = {
  id: 'baltimere',
  name: 'Baltimere · Harbor Stoops',
  district: 'Mount Vernon & Fells Point · Outer Ring',
  buildingName: 'The Severn Rowhouse & Stoop',
  masonry: '#7a3c32',
  cyan: '#18b4ff',
  sodium: '#ffae62',
  law: 'Every marble stoop belongs to the public walk; rooftop wood additions mark each generation after the shore.',
  arch: 'Red-brick rowhouses with white marble steps, iron fire escapes, and ceramic kintsugi crowns above +4.00 m.',
  lexicon: 'Stoop-Right : Public seating on domestic marble steps\nBack-Iron : Exterior switchback stair used as vertical alley',
  duet: 'Step up out of the harbor damp; the upper room holds the view across the canal.',
};

function loadCartridgeForm(presetKey) {
  document.querySelectorAll('#cartridge-preset-btns .pill').forEach((b) => {
    b.classList.toggle('active', b.dataset.cart === presetKey);
  });
  let c;
  if (presetKey === 'blank') {
    c = {
      id: 'custom',
      name: 'Untitled Nolli Cartridge',
      district: 'Ward 01 · Custom Threshold',
      buildingName: 'New Lightwell House',
      masonry: '#485866',
      cyan: '#18b4ff',
      sodium: '#f2a541',
      law: 'Declare the public floor datum, reserve rule, and sitter margin-credit.',
      arch: 'Carved ground-floor Nolli passage continuous with the street and lit by an upper glass lightwell.',
      lexicon: 'Threshold-Mark : Chalked consent at +4.00 m\nLight-Well : Shared sky shaft linking street to screening room',
      duet: 'Bring a clear plate from the quay and we will hang it in tonight window.',
    };
  } else if (presetKey === 'baltimere') {
    c = { ...BALTIMERE_PRESET };
  } else {
    const src = CARTRIDGES[presetKey] || CARTRIDGES.atlantis;
    c = {
      id: src.id,
      name: src.name,
      district: src.district,
      buildingName: src.buildingName,
      masonry: src.palette.masonry,
      cyan: src.palette.cyan,
      sodium: src.palette.sodium,
      law: src.worldtext.gazetteer.law,
      arch: src.worldtext.gazetteer.architecture,
      lexicon: src.worldtext.lexicon.map((l) => `${l.term} : ${l.meaning}`).join('\n'),
      duet: src.residents[0].duet.greeting,
    };
  }
  authoredCartridge = c;
  document.getElementById('cf-name').value = c.name;
  document.getElementById('cf-district').value = c.district;
  document.getElementById('cf-building').value = c.buildingName;
  document.getElementById('cf-col-masonry').value = c.masonry;
  document.getElementById('cf-col-cyan').value = c.cyan;
  document.getElementById('cf-col-sodium').value = c.sodium;
  document.getElementById('cf-law').value = c.law;
  document.getElementById('cf-arch').value = c.arch;
  document.getElementById('cf-lexicon').value = c.lexicon;
  document.getElementById('cf-duet').value = c.duet;
  rebuildCartridgeBlock(c);
}

document.querySelectorAll('#cartridge-preset-btns .pill').forEach((b) => {
  b.addEventListener('click', () => {
    loadCartridgeForm(b.dataset.cart);
    setStudioSubject('cartridge');
  });
});

document.getElementById('btn-apply-cartridge').addEventListener('click', () => {
  authoredCartridge = {
    id: authoredCartridge.id || 'custom',
    name: document.getElementById('cf-name').value.trim() || 'Custom Cartridge',
    district: document.getElementById('cf-district').value.trim(),
    buildingName: document.getElementById('cf-building').value.trim(),
    masonry: document.getElementById('cf-col-masonry').value,
    cyan: document.getElementById('cf-col-cyan').value,
    sodium: document.getElementById('cf-col-sodium').value,
    law: document.getElementById('cf-law').value.trim(),
    arch: document.getElementById('cf-arch').value.trim(),
    lexicon: document.getElementById('cf-lexicon').value.trim(),
    duet: document.getElementById('cf-duet').value.trim(),
  };
  try {
    localStorage.setItem(CUSTOM_CART_KEY, JSON.stringify(authoredCartridge));
  } catch {}
  rebuildCartridgeBlock(authoredCartridge);
  setStudioSubject('cartridge');
  savePilotState({ world: authoredCartridge.id });
  document.getElementById('cartridge-save-msg').textContent = `Saved "${authoredCartridge.name}" to studio & pilot state.`;
});

document.getElementById('btn-export-cartridge').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(authoredCartridge, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(authoredCartridge.id || 'worldtext')}-cartridge.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});
loadCartridgeForm('atlantis');

// Apply any 6-color array directly into Mode 14 District LUT shader!
function applyCustomSixColorPalette(colors, label) {
  if (!colors || colors.length < 6) return;
  const targetLook = ALL_CITY_LOOKS.find((l) => l.id === 'dist_nightlife');
  if (targetLook) {
    targetLook.colors = colors.slice(0, 6);
  }
  suite.setLook('dist_nightlife');
  document.getElementById('vp-subject-title').textContent = `PALETTE LUT ACTIVE: ${label.toUpperCase()}`;
}

// Tab 06: Shared Light Table (`make_photo_city_nolli_v1`)
function renderSharedLightTable() {
  const grid = document.getElementById('lighttable-grid');
  if (!grid) return;
  let ledger = { plates: [], windowPlateIds: [null, null, null], screenPlateId: null };
  try {
    const raw = localStorage.getItem(NOLLI_LEDGER_KEY);
    if (raw) ledger = { ...ledger, ...JSON.parse(raw) };
  } catch {}

  if (!ledger.plates || !ledger.plates.length) {
    grid.innerHTML = `<div class="item-card"><b style="color:var(--brass);">Light Table Ready</b><div style="color:var(--muted);font-size:12.5px;">No field plates in shared localStorage yet. Click "Expose Plate" above (or press Space) to develop a 3D studio plate directly onto the shared Nolli Light Table.</div></div>`;
    return;
  }

  grid.innerHTML = ledger.plates
    .slice()
    .reverse()
    .map(
      (p, idx) => `<article class="item-card">
        <img src="${p.dataUrl}" alt="Exposed plate" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:5px;border:1px solid var(--rule);">
        <div style="display:flex;justify-content:space-between;gap:6px;font:600 10.5px var(--mono);color:var(--cyan);">
          <span>${p.lookName || p.look || 'WEAVE'}</span>
          <span>${p.focalMm || 35}mm</span>
        </div>
        <div style="font-size:12px;color:var(--paper);">${p.location || 'Make-Photo City'}</div>
        <div style="font:400 10px var(--mono);color:var(--dim);">Credit: ${p.credit || 'Margin-Credit Verified'}</div>
        <div class="pill-row" style="margin-top:4px;">
          <button type="button" class="pill" data-win="${p.id}" style="padding:3px 7px;">Mount Window #1</button>
          <button type="button" class="pill" data-scr="${p.id}" style="padding:3px 7px;">Project Reel</button>
        </div>
      </article>`
    )
    .join('');

  grid.querySelectorAll('button[data-win]').forEach((b) => {
    b.addEventListener('click', () => {
      ledger.windowPlateIds = [b.dataset.win, ledger.windowPlateIds[1], ledger.windowPlateIds[2]];
      localStorage.setItem(NOLLI_LEDGER_KEY, JSON.stringify(ledger));
      b.textContent = 'Mounted #1';
    });
  });
  grid.querySelectorAll('button[data-scr]').forEach((b) => {
    b.addEventListener('click', () => {
      ledger.screenPlateId = b.dataset.scr;
      localStorage.setItem(NOLLI_LEDGER_KEY, JSON.stringify(ledger));
      b.textContent = 'On Reel';
    });
  });
}

document.getElementById('btn-expose-from-archive').addEventListener('click', () => {
  suite.exposePlate({ locationName: 'Worldtext Light Table Studio' });
  renderSharedLightTable();
});
document.getElementById('btn-refresh-plates').addEventListener('click', renderSharedLightTable);

// ---------------------------------------------------------------------------
// 5. Load Bundled Worldtext JSONs (Poems, 21 Palettes, Language, Gazetteer, Archive)
// ---------------------------------------------------------------------------
let archiveData = null;

async function loadWorldtextData() {
  const [poems, palettes, lang, world, scenes, archive] = await Promise.all([
    fetch('./data/poems_dossiers.json').then((r) => r.json()),
    fetch('./data/palettes.json').then((r) => r.json()),
    fetch('./data/language_bundle.json').then((r) => r.json()),
    fetch('./data/world.json').then((r) => r.json()),
    fetch('./data/scenes.json').then((r) => r.json()),
    fetch('./data/archive_curated.json').then((r) => r.json()),
  ]);

  // --- Tab 03: 14 Poem Dossiers ---
  const dNav = document.getElementById('dossier-nav');
  const dDetail = document.getElementById('dossier-detail');

  function renderPoemDossier(p) {
    dNav.querySelectorAll('.pill').forEach((b) => b.classList.toggle('active', b.dataset.num === p.num));
    const swHtml = (p.swatches || [])
      .map((hex) => `<i style="background:${hex};flex:1;" title="${hex}"></i>`)
      .join('');
    dDetail.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:10px;">
        <div>
          <div class="sec-kicker">POEM ${p.num} | ${p.district}</div>
          <h2 class="sec-h2" style="font-size:26px;">${p.title}</h2>
        </div>
        <div class="pill-row">
          <button type="button" class="pill active" id="btn-sync-poem-pilot">Sync Poem ${p.num} to Pilot</button>
          <button type="button" class="pill" id="btn-grade-poem-swatches">Apply Dossier Swatches to 3D Studio</button>
        </div>
      </div>
      ${swHtml ? `<div class="swatch-bar" style="height:26px;">${swHtml}</div>` : ''}
      <p style="margin:0;color:var(--paper);font-size:14.5px;">${p.essence}</p>

      <div class="sec-kicker">TIMED READING TRANSCRIPT (${p.lines.length} LINES)</div>
      <div class="poem-lines-cols">
        ${p.lines.map((l) => `<div><code>${l.time}</code>${l.text}</div>`).join('')}
      </div>

      <div class="sec-kicker">MOVEMENTS &amp; BLOCKING BEATS (${p.movements.length})</div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>Movement</th><th>Action Beat</th><th>Feeling</th><th>Frame Composition</th></tr></thead>
          <tbody>
            ${p.movements
              .map(
                (m) => `<tr>
                  <td style="font:600 11px var(--mono);color:var(--amber);">${m.movement}</td>
                  <td>${m.beat}</td>
                  <td style="color:var(--aqua);">${m.feeling}</td>
                  <td style="color:var(--muted);">${m.image}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>

      ${
        p.stages && p.stages.length
          ? `<div class="sec-kicker">SCENE-BY-SCENE SET STAGING (${p.stages.length} SETS)</div>
             <div class="cards-grid">
               ${p.stages
                 .map(
                   (s) => `<article class="item-card">
                     <div style="font:600 10px var(--mono);color:var(--brass);">${s.set}</div>
                     <b style="color:var(--paper);">${s.title}</b>
                     <div style="font:italic 12px var(--serif);color:var(--aqua);">${s.lyric}</div>
                     <div style="font-size:12px;color:var(--muted);">${s.blocking}</div>
                   </article>`
                 )
                 .join('')}
             </div>`
          : ''
      }
    `;

    document.getElementById('btn-sync-poem-pilot')?.addEventListener('click', () => {
      savePilotState({ poem: p.num });
      syncPilotUI(loadPilotState());
    });
    document.getElementById('btn-grade-poem-swatches')?.addEventListener('click', () => {
      const padded = [...(p.swatches || []), '#0c1f38', '#18b4ff', '#f4eedd', '#e0b46a', '#faf6eb', '#ffffff'];
      applyCustomSixColorPalette(padded.slice(0, 6), `Poem ${p.num} ${p.title}`);
    });
  }

  poems.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill';
    b.style.textAlign = 'left';
    b.dataset.num = p.num;
    b.textContent = `${p.num} | ${p.title}`;
    b.addEventListener('click', () => renderPoemDossier(p));
    dNav.appendChild(b);
  });
  const initPoem = poems.find((x) => x.num === pilot.poem) || poems[0];
  if (initPoem) renderPoemDossier(initPoem);

  // --- Tab 04: All 21 language/palettes.json Grammars + Found Architecture + Gaps ---
  const palGrid = document.getElementById('palettes-grid');
  palGrid.innerHTML = palettes
    .map(
      (p, idx) => `<article class="item-card clickable" data-palidx="${idx}">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px;">
          <b style="color:var(--paper);text-transform:capitalize;">${idx + 1}. ${p.name.replace(/^the /, '')}</b>
          <span style="font:500 10px var(--mono);color:var(--dim);">(${p.x}, ${p.y})</span>
        </div>
        <div class="swatch-bar">
          ${p.colors.map((c, ci) => `<i style="background:${c};flex:${Math.max(0.35, (p.weights[ci] || 0.16) * 8)};" title="${c}"></i>`).join('')}
        </div>
        <div style="font:500 10px var(--mono);color:var(--muted);">${p.colors.join(' ')}</div>
      </article>`
    )
    .join('');

  palGrid.querySelectorAll('[data-palidx]').forEach((card) => {
    card.addEventListener('click', () => {
      palGrid.querySelectorAll('.item-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      const p = palettes[Number(card.dataset.palidx)];
      applyCustomSixColorPalette(p.colors, p.name);
    });
  });

  const fgGrid = document.getElementById('found-and-gaps-grid');
  const foundCards = (lang.found || []).slice(0, 8).map((f) => {
    const kInfo = (lang.keep || {})[f.id] || {};
    return `<article class="item-card">
      <div style="display:flex;justify-content:space-between;gap:6px;">
        <b style="color:var(--paper);">${kInfo.name || f.id}</b>
        <span class="badge recorded">found (${Math.round((f.unique || 0.8) * 100)}% unique)</span>
      </div>
      <div class="swatch-bar">${(f.palette || []).map((c) => `<i style="background:${c};flex:1;"></i>`).join('')}</div>
      <div style="font-size:12px;color:var(--muted);">${kInfo.kind || ''} | ${f.read?.material || 'masonry'} | source: ${f.src}</div>
    </article>`;
  });

  const gapCards = Object.entries(lang.grit || {})
    .filter(([, e]) => e.strong < 6)
    .slice(0, 6)
    .map(
      ([k, e]) => `<article class="item-card">
        <div style="display:flex;justify-content:space-between;gap:6px;">
          <b style="color:var(--amber);">Gap: ${k}</b>
          <span class="badge unresolved">${e.strong} strong frames</span>
        </div>
        <div style="font:400 11px/1.45 var(--mono);color:var(--muted);">Collect prompt: WYGWYL still, Atlantis, ${e.prompt}, +4.00m salt flood line, white ceramic repairs with thin cyan seams, 35mm.</div>
      </article>`
    );
  fgGrid.innerHTML = [...foundCards, ...gapCards].join('');

  // --- Tab 05: Gazetteer & 13 Districts (with Colour Script) ---
  const distById = Object.fromEntries((scenes.districts || []).map((d) => [d.id, d]));
  document.getElementById('album-colour-script').innerHTML = (scenes.script || [])
    .map(
      (c) => `<div class="script-seg" style="flex:${Math.max(1, c.t1 - c.t0)};" title="${c.num} ${c.title}">
        ${(c.seq || []).map((did) => `<i style="background:${(distById[did] && distById[did].color) || '#18b4ff'};"></i>`).join('')}
      </div>`
    )
    .join('');

  document.getElementById('gazetteer-overview').textContent = world.overview || '';
  const gazCards = [
    ...(world.calendar || []).map((c) => ({ kind: 'Tide Calendar', name: c.name, text: c.text })),
    ...(world.institutions || []).slice(0, 6).map((x) => ({ kind: 'Institution', name: x.name, text: x.text })),
    ...(world.customs || []).map((x) => ({ kind: 'Civic Custom', name: x.name, text: x.text })),
  ];
  document.getElementById('gazetteer-cards').innerHTML = gazCards
    .map(
      (g) => `<article class="item-card">
        <div class="sec-kicker">${g.kind}</div>
        <b style="font:600 15px var(--serif);color:var(--paper);">${g.name}</b>
        <div style="font-size:12.5px;color:var(--muted);">${g.text}</div>
      </article>`
    )
    .join('');

  document.getElementById('districts-cards').innerHTML = (scenes.districts || [])
    .map((d) => {
      const isBlack = d.id === 'black' || /black/i.test(d.name);
      const sw = [...(d.body || []), ...(d.glow || [])];
      return `<article class="item-card clickable" data-dist="${d.id}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <b style="color:var(--paper);">${d.name}</b>
          <span class="badge ${isBlack ? 'unresolved' : 'checked'}">${isBlack ? 'nongeographic' : d.hour || 'district'}</span>
        </div>
        ${sw.length ? `<div class="swatch-bar">${sw.map((c) => `<i style="background:${c};flex:1;"></i>`).join('')}</div>` : ''}
        <div style="font-size:12px;color:var(--muted);">${d.tone || ''}</div>
        <div style="font:400 10.5px var(--mono);color:var(--dim);">Sound: ${d.sound || 'quiet'} | ${isBlack ? 'Outside street network (authored cut only)' : d.site?.on || ''}</div>
      </article>`;
    })
    .join('');

  document.querySelectorAll('#districts-cards [data-dist]').forEach((card) => {
    card.addEventListener('click', () => {
      const d = distById[card.dataset.dist];
      if (!d) return;
      const cols = [...(d.body || []), ...(d.glow || [])];
      if (cols.length >= 6) applyCustomSixColorPalette(cols.slice(0, 6), d.name);
    });
  });

  // --- Tab 06: Curated Canon Archive Search ---
  archiveData = archive;
  const poemSel = document.getElementById('arch-poem-filter');
  poems.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.num;
    opt.textContent = `${p.num} | ${p.title}`;
    poemSel.appendChild(opt);
  });

  renderArchiveSearch();
  renderSharedLightTable();
}

function renderArchiveSearch() {
  if (!archiveData) return;
  const q = (document.getElementById('arch-search').value || '').trim().toLowerCase();
  const pf = document.getElementById('arch-poem-filter').value;
  const sf = document.getElementById('arch-src-filter').value;

  const matches = (archiveData.items || []).filter((it) => {
    if (pf && it.poem !== pf && it.clip_poem !== pf) return false;
    if (sf && it.source !== sf) return false;
    if (q) {
      const hay = `${(it.tags || []).join(' ')} ${it.path || ''} ${it.source || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  document.getElementById('arch-count').textContent =
    `Showing ${Math.min(36, matches.length)} of ${matches.length} matched frames (from ${archiveData.store?.unique?.toLocaleString() || '45,000'} unique archive items).`;

  document.getElementById('archive-results-grid').innerHTML = matches
    .slice(0, 36)
    .map(
      (it) => `<article class="item-card">
        <div style="display:flex;justify-content:space-between;gap:6px;">
          <span class="badge recorded">${it.source} | ${it.kind}</span>
          <span style="font:600 10.5px var(--mono);color:var(--amber);">Poem ${it.poem || it.clip_poem}</span>
        </div>
        <div style="font-size:12px;color:var(--paper);">${(it.tags || []).slice(0, 6).join(' · ') || 'Architectural frame'}</div>
        <div style="font:400 10px var(--mono);color:var(--dim);word-break:break-all;">Light ${Math.round(it.lum * 100)}% | ${it.warm > 0.04 ? 'Warm sodium' : it.warm < -0.03 ? 'Cool cobalt' : 'Neutral'} | ${(it.path || '').slice(-46)}</div>
      </article>`
    )
    .join('');
}

['arch-search', 'arch-poem-filter', 'arch-src-filter'].forEach((id) => {
  document.getElementById(id).addEventListener('input', renderArchiveSearch);
  document.getElementById(id).addEventListener('change', renderArchiveSearch);
});

loadWorldtextData();
setStudioSubject('gate');
applyCalvinoReading(studioState.reading, false);
syncPilotUI(pilot);

// ---------------------------------------------------------------------------
// 6. Main 3D Studio Render Loop
// ---------------------------------------------------------------------------
let prevSec = performance.now() * 0.001;

function animateStudio() {
  requestAnimationFrame(animateStudio);
  const now = performance.now() * 0.001;
  const dt = Math.min(0.05, Math.max(0.001, now - prevSec));
  prevSec = now;

  if (studioState.autoSpin) {
    studioState.orbitYaw += dt * 0.35;
  }

  // Camera orbit around turntable center
  const targetY = studioState.subject === 'kit' ? 1.8 : 2.3;
  const cx = Math.sin(studioState.orbitYaw) * Math.cos(studioState.orbitPitch) * studioState.orbitDist;
  const cy = targetY + Math.sin(studioState.orbitPitch) * studioState.orbitDist * 0.72;
  const cz = Math.cos(studioState.orbitYaw) * Math.cos(studioState.orbitPitch) * studioState.orbitDist;
  camera.position.set(cx, cy, cz);
  camera.lookAt(0, targetY, 0);

  // Brief 5 Acceptance Scene: Two Visitors Approaching the Same Gate
  if (studioState.replaying) {
    studioState.encounterT = Math.min(1, studioState.encounterT + dt * 0.36);
    if (studioState.encounterT >= 1) studioState.replaying = false;
  }
  const ease = 1 - Math.pow(1 - studioState.encounterT, 3);
  visitorA.root.position.z = THREE.MathUtils.lerp(visitorA.baseZ, visitorA.targetZ, ease);
  visitorB.root.position.z = THREE.MathUtils.lerp(visitorB.baseZ, visitorB.targetZ, ease);

  // Parcel follows owner on the gate stage
  if (pilot.parcelHolder === 'player') {
    studioParcel.position.set(visitorB.root.position.x + 0.28, 1.05, visitorB.root.position.z - 0.15);
  } else {
    studioParcel.position.set(visitorA.root.position.x + 0.28, 1.05, visitorA.root.position.z - 0.15);
  }

  [visitorA, visitorB, kitHumanRef].forEach((h) => {
    if (h.v8 && typeof h.v8.update === 'function') {
      const moving = studioState.replaying && h !== kitHumanRef;
      const want = moving ? 'walk' : 'idle';
      if (h.clip !== want && typeof h.v8.crossFadeTo === 'function') {
        h.clip = want;
        h.v8.crossFadeTo(want, 0.25);
      }
      h.v8.update(dt);
    }
  });

  renderer.render(scene, camera);
}

resizeStudio();
animateStudio();
