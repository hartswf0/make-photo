// Make-Photo City — /city/stage/ (#P06-S01 Default): P06-S01 Atlantis Gate & Hero Character Stage
// Pure full-bleed 100vw x 100vh WebGL world wired through ../shader-suite-bar.js (23 GPU Shaders + 5-bus audio)
// and ../design-room/pilot-state.js. Zero overlaid grids, sidebars, or docks on default load (Tab only if summoned).
// Strict zero-emoji rule across code, UI, and state.

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
} from '../shader-suite-bar.js';
import { createHeroOrCastV9, evolveHeroPhenotype } from '../hero-build/anny-hero-v9.js';
import { createArticulated31CutoutRig, evolveCutoutPhenotype } from '../hero-build/cutout-31-rig.js';

// ---------------------------------------------------------------------------
// 1. Preserve #P06-S01 Scene Hash & Hydrate Severn Pilot State
// ---------------------------------------------------------------------------
const initialRawHash = (window.location.hash || '').replace(/^#/, '').trim();
const initialSceneAnchor =
  initialRawHash && !initialRawHash.includes('=') && /^P\d{2}-S\d{2}$/i.test(initialRawHash)
    ? initialRawHash.toUpperCase()
    : 'P06-S01';

if (!initialRawHash) {
  try {
    window.history.replaceState(null, '', '#P06-S01');
  } catch {
    // Ignore history restrictions
  }
}

let pilot = applyPilotUrlHash();
savePilotState({ poem: '06', shot: 'S01', world: 'atlantis' }, { syncHash: false });

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const texLoader = new THREE.TextureLoader();

const whisperEl = document.getElementById('world-whisper');
const speakerLyricEl = document.getElementById('world-speaker-lyric');
const notesSceneLineEl = document.getElementById('notes-scene-line');
const notesEnsembleLineEl = document.getElementById('notes-ensemble-line');

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

function navigateToCityRoute(relHref) {
  const hash = formatPilotHash(loadPilotState());
  window.location.href = `${relHref}${hash}`;
}

// ---------------------------------------------------------------------------
// 2. Renderer, Scene, Camera, Cerulean-Cobalt Comet Sky & Lighting
// ---------------------------------------------------------------------------
const wrap = document.getElementById('canvas-wrap');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#091c36');
scene.fog = new THREE.FogExp2('#0d2748', 0.0115);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.12, 360);
camera.position.set(0, 2.35, 6.8);

const skyUniforms = {
  uTop: { value: new THREE.Color('#061428') },
  uMid: { value: new THREE.Color('#123a6d') },
  uHor: { value: new THREE.Color('#3c7cb0') },
  uSunDir: { value: new THREE.Vector3(-0.34, 0.24, -0.91).normalize() },
  uSunCol: { value: new THREE.Color('#ffd39b') },
  uCometBoost: { value: 1.0 },
  uTime: { value: 0 },
};

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(240, 40, 26),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: skyUniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = normalize(wp.xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uHor;
      uniform vec3 uSunDir;
      uniform vec3 uSunCol;
      uniform float uCometBoost;
      uniform float uTime;
      varying vec3 vDir;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float y = clamp(d.y, -0.15, 1.0);
        vec3 col = mix(uHor, uMid, smoothstep(-0.02, 0.28, y));
        col = mix(col, uTop, smoothstep(0.26, 0.85, y));
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunCol * (pow(sd, 220.0) * 1.15 + pow(sd, 14.0) * 0.26 + pow(sd, 3.0) * 0.09);

        if (y > 0.04) {
          vec2 g = vec2(atan(d.z, d.x) * 120.0, asin(clamp(y, 0.0, 1.0)) * 240.0);
          vec2 cell = floor(g);
          float r = h21(cell);
          float tw = 0.65 + 0.35 * sin(uTime * 2.1 + r * 31.0);
          float st = step(0.9955, r) * smoothstep(0.45, 0.05, length(fract(g) - 0.5)) * tw;
          col += vec3(0.86, 0.94, 1.0) * st * 0.72 * smoothstep(0.04, 0.28, y);

          // P06-S01 Luminous Comet Streaks across the cobalt sky
          for (int k = 0; k < 3; k++) {
            float fk = float(k);
            float cyc = fract(uTime * (0.045 + fk * 0.012) + fk * 0.37);
            vec3 cHead = normalize(vec3(mix(-0.85, 0.85, cyc) + fk * 0.18 - 0.18, 0.38 - cyc * 0.14 + fk * 0.07, -0.88));
            vec3 cTail = normalize(cHead + vec3(-0.24, 0.09, 0.0));
            vec3 seg = cHead - cTail;
            float tProj = clamp(dot(d - cTail, seg) / max(0.0001, dot(seg, seg)), 0.0, 1.0);
            vec3 closest = normalize(mix(cTail, cHead, tProj));
            float dist = length(d - closest);
            float streak = smoothstep(0.014, 0.0012, dist) * pow(tProj, 1.8) * sin(cyc * 3.14159);
            col += mix(vec3(0.15, 0.75, 1.0), vec3(1.0, 0.92, 0.72), tProj) * streak * 1.15 * uCometBoost;
          }
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
);
skyDome.frustumCulled = false;
scene.add(skyDome);

const hemiLight = new THREE.HemisphereLight('#a8dcff', '#1c2838', 1.48);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight('#ffe4be', 2.65);
keyLight.position.set(14, 24, 16);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 72;
const shadowSpan = 18;
keyLight.shadow.camera.left = -shadowSpan;
keyLight.shadow.camera.right = shadowSpan;
keyLight.shadow.camera.top = shadowSpan;
keyLight.shadow.camera.bottom = -shadowSpan;
keyLight.shadow.bias = -0.0004;
scene.add(keyLight);

const rimCyanLight = new THREE.DirectionalLight('#38beff', 1.15);
rimCyanLight.position.set(-14, 11, -16);
scene.add(rimCyanLight);

const gatePortalLight = new THREE.PointLight('#18b4ff', 32, 26, 1.35);
gatePortalLight.position.set(0, 3.4, -9.8);
scene.add(gatePortalLight);

const stageWarmFootlight = new THREE.PointLight('#f2b365', 14, 18, 1.5);
stageWarmFootlight.position.set(0, 1.8, 4.6);
scene.add(stageWarmFootlight);

const suite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: pilot.shader || 'weave',
  defaultTime: 'bluehour',
  captureOnSpace: false,
  locationName: 'P06-S01 Atlantis Gate & Poet Hero Stage',
  cartridgeName: 'Atlantis',
  onTimeChange: (_key, preset) => {
    if (!preset) return;
    skyUniforms.uTop.value.set(preset.skyTop || '#061428');
    skyUniforms.uMid.value.set(preset.skyMid || '#123a6d');
    skyUniforms.uHor.value.set(preset.skyHorizon || '#3c7cb0');
    hemiLight.intensity = preset.hemiIntensity || 1.45;
    keyLight.intensity = Math.max(1.35, preset.sunIntensity || 2.5);
  },
});

// ---------------------------------------------------------------------------
// 3. Procedural Marble, Kintsugi Wet Slate & Engraved Brass Plaque Textures
// ---------------------------------------------------------------------------
function createWetSlateKintsugiTextures() {
  const size = 1024;
  const diffC = document.createElement('canvas');
  diffC.width = diffC.height = size;
  const ctx = diffC.getContext('2d');

  ctx.fillStyle = '#141e2b';
  ctx.fillRect(0, 0, size, size);

  const rows = 16;
  const cols = 8;
  const rh = size / rows;
  const cw = size / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const v = 22 + ((r * 17 + c * 31) % 18);
      const blue = 12 + ((r * 7 + c * 13) % 14);
      ctx.fillStyle = `rgb(${v},${v + 6},${v + blue})`;
      ctx.fillRect(c * cw + off + 2, r * rh + 2, cw - 4, rh - 4);
    }
  }

  // Kintsugi gold & cyan luminous seams across courtyard slabs
  ctx.lineCap = 'round';
  for (let s = 0; s < 9; s++) {
    ctx.strokeStyle = s % 3 === 0 ? 'rgba(24, 180, 255, 0.72)' : 'rgba(228, 182, 96, 0.85)';
    ctx.lineWidth = s % 3 === 0 ? 2.4 : 3.0;
    ctx.beginPath();
    let px = ((s * 137) % size);
    let py = 0;
    ctx.moveTo(px, py);
    for (let seg = 1; seg <= 8; seg++) {
      px += Math.sin(seg * 1.7 + s) * 44;
      py = (seg / 8) * size;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Roughness map (dark mirror puddles + damp slate)
  const roughC = document.createElement('canvas');
  roughC.width = roughC.height = size;
  const rctx = roughC.getContext('2d');
  rctx.fillStyle = '#7c8490';
  rctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 36; i++) {
    const px = ((i * 193) % size);
    const py = ((i * 271) % size);
    const rad = 48 + (i % 5) * 26;
    const g = rctx.createRadialGradient(px, py, 6, px, py, rad);
    g.addColorStop(0, 'rgba(12, 14, 18, 0.95)');
    g.addColorStop(0.65, 'rgba(36, 40, 48, 0.72)');
    g.addColorStop(1, 'rgba(124, 132, 144, 0)');
    rctx.fillStyle = g;
    rctx.beginPath();
    rctx.arc(px, py, rad, 0, Math.PI * 2);
    rctx.fill();
  }

  const map = new THREE.CanvasTexture(diffC);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(5, 5);
  map.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughC);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(5, 5);

  return { map, roughnessMap };
}

function createKintsugiMarbleTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');

  const grd = g.createLinearGradient(0, 0, size, size);
  grd.addColorStop(0, '#f2ede2');
  grd.addColorStop(0.5, '#e5dfd2');
  grd.addColorStop(1, '#d7d0c2');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);

  // Soft grey mineral veins
  g.strokeStyle = 'rgba(110, 118, 128, 0.26)';
  g.lineWidth = 2.2;
  for (let i = 0; i < 10; i++) {
    g.beginPath();
    let x = (i * 67) % size;
    g.moveTo(x, 0);
    for (let y = 64; y <= size; y += 64) {
      x += Math.sin(y * 0.03 + i) * 24;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // Kintsugi gold seams
  g.strokeStyle = '#d9a44b';
  g.lineWidth = 3.2;
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    let x = 70 + k * 115;
    g.moveTo(x, 0);
    for (let y = 80; y <= size; y += 80) {
      x += (k % 2 === 0 ? 1 : -1) * Math.cos(y * 0.025 + k) * 26;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePlaqueTexture(title, subtitle, accent = '#e0b46a') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#121a26';
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = accent;
  g.lineWidth = 5;
  g.strokeRect(8, 8, 496, 144);
  g.fillStyle = accent;
  g.font = '700 26px ui-monospace, SFMono-Regular, Menlo, monospace';
  g.textAlign = 'center';
  g.fillText(String(title || '').slice(0, 34), 256, 68);
  g.fillStyle = '#f4eedd';
  g.font = '500 20px Georgia, serif';
  g.fillText(String(subtitle || '').slice(0, 44), 256, 114);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Key near-white paper backgrounds cleanly when needed for cutout planes
const cutoutTexCache = new Map();
function loadCutoutTexture(url) {
  if (cutoutTexCache.has(url)) return cutoutTexCache.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, img.width);
      c.height = Math.max(1, img.height);
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      try {
        const id = cx.getImageData(0, 0, c.width, c.height);
        const d = id.data;
        // Check corner pixels: only key white paper if corners are opaque near-white
        const cornerOpaqueWhite =
          d[3] > 240 && d[0] > 236 && d[1] > 236 && d[2] > 232;
        if (cornerOpaqueWhite) {
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], gr = d[i + 1], b = d[i + 2];
            const mx = Math.max(r, gr, b);
            const mn = Math.min(r, gr, b);
            if (mx >= 238 && mx - mn <= 16) {
              d[i + 3] = mx >= 246 ? 0 : Math.round(((246 - mx) / 8) * d[i + 3]);
            }
          }
          cx.putImageData(id, 0, 0);
        }
      } catch {
        // Keep raw image
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve({ tex, width: c.width, height: c.height });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  cutoutTexCache.set(url, p);
  return p;
}

// ---------------------------------------------------------------------------
// 4. Courtyard Architecture: Wet Slate Floor, Reflecting Pool, Parabolic Dish,
//    and Monumental True-Scale P06-S01 Marble & Kintsugi Winged Gate
// ---------------------------------------------------------------------------
const worldRoot = new THREE.Group();
worldRoot.name = 'stage-p06-world-root';
scene.add(worldRoot);

const interactMeshes = [];
function registerInteract(mesh, meta) {
  mesh.userData.stageInteract = meta;
  interactMeshes.push(mesh);
  return mesh;
}

const slateTex = createWetSlateKintsugiTextures();
const marbleTex = createKintsugiMarbleTexture();

const slateFloorMat = new THREE.MeshStandardMaterial({
  map: slateTex.map,
  roughnessMap: slateTex.roughnessMap,
  roughness: 0.34,
  metalness: 0.28,
});

const marbleMat = new THREE.MeshStandardMaterial({
  map: marbleTex,
  roughness: 0.32,
  metalness: 0.08,
});

const brassMat = new THREE.MeshStandardMaterial({
  color: '#dfb264',
  roughness: 0.25,
  metalness: 0.85,
  emissive: '#3a280c',
  emissiveIntensity: 0.16,
});

const kintsugiGoldMat = new THREE.MeshStandardMaterial({
  color: '#f2c15a',
  roughness: 0.2,
  metalness: 0.9,
  emissive: '#6a4810',
  emissiveIntensity: 0.35,
});

const cyanGlowMat = new THREE.MeshStandardMaterial({
  color: '#18b4ff',
  emissive: '#18b4ff',
  emissiveIntensity: 1.4,
  roughness: 0.18,
  metalness: 0.25,
});

const darkTimberMat = new THREE.MeshStandardMaterial({
  color: '#2c1d15',
  roughness: 0.62,
  metalness: 0.1,
});

// Courtyard wet slate deck
const courtyardFloor = new THREE.Mesh(new THREE.CylinderGeometry(28, 29, 0.4, 64), slateFloorMat);
courtyardFloor.position.set(0, -0.2, -2.0);
courtyardFloor.receiveShadow = true;
worldRoot.add(courtyardFloor);

// Outer ocean / drowned Atlantis water sheet surrounding courtyard
const outerWaterMat = new THREE.MeshStandardMaterial({
  color: '#0b2c4d',
  roughness: 0.08,
  metalness: 0.68,
  emissive: '#071a30',
  emissiveIntensity: 0.35,
});
const outerWater = new THREE.Mesh(new THREE.PlaneGeometry(340, 340), outerWaterMat);
outerWater.rotation.x = -Math.PI / 2;
outerWater.position.set(0, -0.18, -20);
worldRoot.add(outerWater);

// Yellow-Brick / Kintsugi Processional Causeway leading to the Atlantis Gate
const causewayGroup = new THREE.Group();
for (let i = 0; i < 11; i++) {
  const z = 5.4 - i * 1.32;
  const w = 2.6 + (i / 10) * 0.9;
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.035, 1.16),
    new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? '#cfa04e' : '#b8893c',
      roughness: 0.3,
      metalness: 0.42,
      emissive: '#2c1e08',
      emissiveIntensity: 0.15,
    })
  );
  slab.position.set(0, 0.018, z);
  slab.receiveShadow = true;
  causewayGroup.add(slab);
}
worldRoot.add(causewayGroup);

// Shimmering Reflecting Pool at the Atlantis Gate Threshold
const reflectingPoolMat = new THREE.MeshStandardMaterial({
  color: '#124a78',
  roughness: 0.05,
  metalness: 0.82,
  emissive: '#0b3558',
  emissiveIntensity: 0.48,
});
const reflectingPool = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.05, 5.2), reflectingPoolMat);
reflectingPool.position.set(0, 0.015, -9.4);
reflectingPool.receiveShadow = true;
worldRoot.add(reflectingPool);

const poolRimFront = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.18, 0.32), marbleMat);
poolRimFront.position.set(0, 0.09, -6.75);
poolRimFront.castShadow = true;
poolRimFront.receiveShadow = true;
worldRoot.add(poolRimFront);

// Monumental Parabolic Dish Silhouette on the distant Atlantis horizon
const parabolicDishGroup = new THREE.Group();
parabolicDishGroup.position.set(-7.5, 9.5, -56.0);
parabolicDishGroup.rotation.x = 0.42;
parabolicDishGroup.rotation.z = -0.14;
{
  const dishSilMat = new THREE.MeshStandardMaterial({
    color: '#1b3556',
    roughness: 0.48,
    metalness: 0.62,
    emissive: '#0b1e36',
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide,
  });
  // Lathe parabolic reflector bowl + lattice rings
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const r = (i / 14) * 21.0;
    const y = (r * r) / 52.0;
    pts.push(new THREE.Vector2(r, y));
  }
  const bowlGeo = new THREE.LatheGeometry(pts, 36);
  const bowl = new THREE.Mesh(bowlGeo, dishSilMat);
  bowl.material.transparent = true;
  bowl.material.opacity = 0.62;
  parabolicDishGroup.add(bowl);

  for (let ringIdx = 1; ringIdx <= 4; ringIdx++) {
    const r = (ringIdx / 4) * 21.0;
    const y = (r * r) / 52.0;
    const torus = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 8, 48), dishSilMat);
    torus.rotation.x = Math.PI / 2;
    torus.position.y = y;
    parabolicDishGroup.add(torus);
  }
  // Feed horn tripod struts & glowing cyan receiver focal point
  for (let s = 0; s < 3; s++) {
    const a = (s / 3) * Math.PI * 2;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 19.5, 8), dishSilMat);
    strut.position.set(Math.cos(a) * 8.2, 11.2, Math.sin(a) * 8.2);
    strut.lookAt(0, 18.5, 0);
    strut.rotateX(Math.PI / 2);
    parabolicDishGroup.add(strut);
  }
  const receiverBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 1), cyanGlowMat);
  receiverBeacon.position.set(0, 18.4, 0);
  parabolicDishGroup.add(receiverBeacon);

  const pylonBase = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 4.2, 18, 12), dishSilMat);
  pylonBase.position.set(0, -8.8, 0);
  parabolicDishGroup.add(pylonBase);
}
worldRoot.add(parabolicDishGroup);

// Monumental True-Scale P06-S01 Marble & Kintsugi Gate (z = -9.6m)
const atlantisGateGroup = new THREE.Group();
atlantisGateGroup.position.set(0, 0, -9.6);
worldRoot.add(atlantisGateGroup);

const gateLeafLeftPivot = new THREE.Group();
const gateLeafRightPivot = new THREE.Group();
let gateCrestPlaqueMat = null;

{
  // Stepped marble stylobates + twin fluted pylons
  for (const side of [-1, 1]) {
    const px = side * 3.35;
    const plinth1 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.36, 1.85), marbleMat);
    plinth1.position.set(px, 0.18, 0);
    plinth1.castShadow = true;
    plinth1.receiveShadow = true;
    atlantisGateGroup.add(plinth1);

    const plinth2 = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.34, 1.52), marbleMat);
    plinth2.position.set(px, 0.52, 0);
    plinth2.castShadow = true;
    atlantisGateGroup.add(plinth2);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.64, 5.8, 20), marbleMat);
    shaft.position.set(px, 3.58, 0);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    atlantisGateGroup.add(shaft);

    // Kintsugi gold & cyan bands around marble pylons
    for (const by of [1.4, 3.5, 5.6]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 10, 28), kintsugiGoldMat);
      band.rotation.x = Math.PI / 2;
      band.position.set(px, by, 0);
      atlantisGateGroup.add(band);
    }

    const capital = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.48, 1.56), marbleMat);
    capital.position.set(px, 6.72, 0);
    capital.castShadow = true;
    atlantisGateGroup.add(capital);
  }

  // Monumental carved marble entablature + kintsugi winged architrave
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.78, 1.48), marbleMat);
  lintel.position.set(0, 7.32, 0);
  lintel.castShadow = true;
  atlantisGateGroup.add(lintel);

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.28, 1.72), kintsugiGoldMat);
  cornice.position.set(0, 7.82, 0);
  atlantisGateGroup.add(cornice);

  const cyanFrieze = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.11, 1.54), cyanGlowMat);
  cyanFrieze.position.set(0, 7.05, 0);
  atlantisGateGroup.add(cyanFrieze);

  // Sculpted marble crest wings atop the entablature
  for (const side of [-1, 1]) {
    for (let f = 0; f < 6; f++) {
      const len = 1.15 + f * 0.34;
      const feather = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.22), f % 2 === 0 ? marbleMat : kintsugiGoldMat);
      feather.position.set(side * (0.85 + f * 0.46), 8.15 + f * 0.18, 0);
      feather.rotation.z = side * (0.18 + f * 0.085);
      feather.castShadow = true;
      atlantisGateGroup.add(feather);
    }
  }

  gateCrestPlaqueMat = new THREE.MeshBasicMaterial({
    map: makePlaqueTexture('P06-S01 · ATLANTIS MARBLE GATE', 'Click Gate to Open Wings / Enter Atlantis'),
  });
  const crestPlaque = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.88), gateCrestPlaqueMat);
  crestPlaque.position.set(0, 7.36, 0.76);
  atlantisGateGroup.add(crestPlaque);

  // Hinged Monumental Winged Marble Gate Leaves ("wings gifted from evolution, made of marble stones")
  gateLeafLeftPivot.position.set(-2.72, 0.35, 0);
  gateLeafRightPivot.position.set(2.72, 0.35, 0);
  atlantisGateGroup.add(gateLeafLeftPivot, gateLeafRightPivot);

  function buildWingedMarbleDoorLeaf(pivotGroup, sideSign) {
    // sideSign = +1 extends right from left hinge; -1 extends left from right hinge
    const stile = new THREE.Mesh(new THREE.BoxGeometry(0.24, 6.1, 0.26), kintsugiGoldMat);
    stile.position.set(sideSign * 0.12, 3.05, 0);
    stile.castShadow = true;
    pivotGroup.add(stile);

    // Lower carved marble dado panel
    const lowerPanel = new THREE.Mesh(new THREE.BoxGeometry(2.58, 2.05, 0.18), marbleMat);
    lowerPanel.position.set(sideSign * 1.35, 1.05, 0);
    lowerPanel.castShadow = true;
    lowerPanel.receiveShadow = true;
    pivotGroup.add(lowerPanel);

    // Sculpted Evolutionary Marble Wing Feathers forming the upper gate leaf
    for (let row = 0; row < 9; row++) {
      const span = 2.52 - row * 0.14;
      const y = 2.32 + row * 0.42;
      const feather = new THREE.Mesh(
        new THREE.BoxGeometry(span, 0.30, 0.15),
        row % 3 === 2 ? kintsugiGoldMat : marbleMat
      );
      feather.position.set(sideSign * (0.22 + span * 0.5), y, 0);
      feather.rotation.z = sideSign * (0.04 + row * 0.028);
      feather.castShadow = true;
      pivotGroup.add(feather);
    }

    // Cyan luminous evolutionary vein
    const vein = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.06, 0.21), cyanGlowMat);
    vein.position.set(sideSign * 1.32, 2.12, 0);
    pivotGroup.add(vein);
  }

  buildWingedMarbleDoorLeaf(gateLeafLeftPivot, 1);
  buildWingedMarbleDoorLeaf(gateLeafRightPivot, -1);

  const gateHit = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 7.6, 1.8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  gateHit.position.set(0, 3.8, 0);
  registerInteract(gateHit, {
    kind: 'atlantis_gate',
    anchorWorld: new THREE.Vector3(0, 6.4, -9.2),
    getLead: () => (state.gateOpen ? 'Monumental Marble Winged Gate (Open)' : 'Monumental Marble Winged Gate (Closed)'),
    getMeta: () => (state.gateOpen ? 'Walk Through -> Atlantis | Click to Close' : 'Click to Swing Marble Wings Open'),
  });
  atlantisGateGroup.add(gateHit);
}

// Multiplane Cutout Stage Group (loads P06-S01 & scene layers from ./data/stage-scenes.json)
const multiplaneStageGroup = new THREE.Group();
multiplaneStageGroup.name = 'multiplane-cutout-layers';
worldRoot.add(multiplaneStageGroup);

// ---------------------------------------------------------------------------
// 5. Diegetic In-World Stage Controls (Zero Overlaid HTML Grids!)
//    A. 3D Full-Length Brass Cheval Mirror (Stage Left: Embodiment + Sunglasses)
//    B. 3D Sculpted Marble Wing Pedestal (Stage Left: P06-S01 Wings Mode)
//    C. 3D Choreographer's Brass Music Stand & Metronome (Downstage: 5 Ensemble States)
//    D. 6 In-World Theatrical Wing Flats (Switch Stage Scenes #P06-S01..#P08-S01)
//    E. 3D Brass 8x10 Camera Tripod & Peripheral Threshold Portals
// ---------------------------------------------------------------------------
const EMBODIMENT_MODES = ['v9_skinned', 'cutout_31', 'twin_audit'];
const EMBODIMENT_LABELS = {
  v9_skinned: '3D V9 Skinned Poet Hero',
  cutout_31: '31-Part Brass-Pivot Cutout Hero',
  twin_audit: 'Side-by-Side Twin Audit (V9 + 31-Part)',
};

const WINGS_MODES = ['angel', 'marble', 'raven', 'folded', 'off'];
const WINGS_LABELS = {
  angel: 'Angel Cutout Flap (08.cast.angel.wings)',
  marble: 'Sculpted Marble Stone Wings',
  raven: 'Raven Cutout Flap',
  folded: 'Folded Evolutionary Wings',
  off: 'Wings Off (Street Trench)',
};

const CHOREO_STATES = [
  {
    id: 'locomotion',
    label: 'Locomotion & Weight',
    bpm: 96,
    heroIdle: 'listen',
    castClips: {
      imani: 'carry',
      makeda: 'walk',
      bekele: 'listen',
      june: 'walk',
      chorus: 'sit-talk',
      cutout_twin: 'walk',
      angel_actor: 'pray',
    },
  },
  {
    id: 'work',
    label: 'Work & Carry',
    bpm: 84,
    heroIdle: 'carry',
    castClips: {
      imani: 'water',
      makeda: 'pump',
      bekele: 'fold-arms',
      june: 'carry',
      chorus: 'listen',
      cutout_twin: 'pump',
    },
  },
  {
    id: 'social',
    label: 'Social & Duet Speech',
    bpm: 76,
    heroIdle: 'idle-talking',
    castClips: {
      imani: 'greet',
      makeda: 'listen',
      bekele: 'idle-talking',
      june: 'yes',
      chorus: 'sit-talk',
      cutout_twin: 'greet',
    },
  },
  {
    id: 'dance',
    label: 'Dance & Celebration',
    bpm: 118,
    heroIdle: 'dance',
    castClips: {
      imani: 'dance',
      makeda: 'clap',
      bekele: 'victory',
      june: 'dance',
      chorus: 'clap',
      cutout_twin: 'dance',
    },
  },
  {
    id: 'flight_gate',
    label: 'Flight & P06 Gate Opening',
    bpm: 108,
    heroIdle: 'victory',
    castClips: {
      imani: 'victory',
      makeda: 'pray',
      bekele: 'pray',
      june: 'clap',
      chorus: 'victory',
      cutout_twin: 'greet',
    },
  },
];

const state = {
  sceneId: initialSceneAnchor,
  sceneDataById: new Map(),
  duetLines: [],
  duetCursor: 0,
  embodiment: 'v9_skinned',
  glasses: true,
  wingsMode: 'angel',
  heroProp: 'none',
  heroGen: 0,
  choreoIdx: 0,
  gateOpen: false,
  gateAngle: 0.18,
  heroPos: new THREE.Vector3(0, 0, 1.55),
  heroVel: new THREE.Vector3(0, 0, 0),
  heroYaw: Math.PI, // facing upstage toward the Atlantis Gate (-Z)
  heroTurnRate: 0,
  heroGroundSpeed: 0,
  heroAirborne: false,
  heroHasWalked: false,
  inspectLookingAtCamera: false,
  wingFlapBoost: 0,
  camYaw: 0.06,
  camPitch: 0.22,
  camDist: 5.85,
  camTargetSmooth: new THREE.Vector3(0, 1.38, 0.85),
  speakingActor: null,
  speakingLine: '',
  speakingLabel: '',
  speakingStart: 0,
  speakingDur: 4.5,
  replyTimer: 0,
  multiplaneMeshes: [],
};

// A. 3D Full-Length Brass Cheval Mirror (Stage Left)
const chevalMirrorGroup = new THREE.Group();
chevalMirrorGroup.position.set(-3.25, 0, 1.85);
chevalMirrorGroup.rotation.y = 0.56;
worldRoot.add(chevalMirrorGroup);

let mirrorPlaqueMesh = null;
{
  // Splayed brass cheval feet + upright posts
  for (const sx of [-0.56, 0.56]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 2.25, 14), brassMat);
    post.position.set(sx, 1.12, 0);
    post.castShadow = true;
    chevalMirrorGroup.add(post);

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 12), kintsugiGoldMat);
    finial.position.set(sx, 2.28, 0);
    chevalMirrorGroup.add(finial);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.07, 0.68), brassMat);
    foot.position.set(sx, 0.035, 0);
    foot.castShadow = true;
    chevalMirrorGroup.add(foot);
  }

  // Tilted full-length bevelled silvered mirror glass + brass frame
  const mirrorFrame = new THREE.Group();
  mirrorFrame.position.set(0, 1.18, 0);
  mirrorFrame.rotation.x = -0.06;
  chevalMirrorGroup.add(mirrorFrame);

  const frameBox = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.86, 0.07), brassMat);
  frameBox.castShadow = true;
  mirrorFrame.add(frameBox);

  const silverGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.88, 1.68),
    new THREE.MeshStandardMaterial({
      color: '#cfeaff',
      roughness: 0.04,
      metalness: 0.96,
      emissive: '#14385c',
      emissiveIntensity: 0.28,
    })
  );
  silverGlass.position.z = 0.04;
  mirrorFrame.add(silverGlass);

  // Upper frame sculpted Brass Sunglasses Crest (click upper frame to toggle Sunglasses!)
  const glassesCrestGroup = new THREE.Group();
  glassesCrestGroup.position.set(0, 1.04, 0.04);
  mirrorFrame.add(glassesCrestGroup);

  const crestBar = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.18, 0.06), kintsugiGoldMat);
  glassesCrestGroup.add(crestBar);
  for (const lx of [-0.17, 0.17]) {
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.04, 16),
      new THREE.MeshStandardMaterial({ color: '#0a0e14', roughness: 0.12, metalness: 0.75 })
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(lx, 0, 0.035);
    glassesCrestGroup.add(lens);
  }

  mirrorPlaqueMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.06, 0.30),
    new THREE.MeshBasicMaterial({
      map: makePlaqueTexture('CHEVAL MIRROR · V9 SKINNED', 'Click Mirror: Embodiment | Crest: Glasses'),
    })
  );
  mirrorPlaqueMesh.position.set(0, -1.06, 0.05);
  mirrorFrame.add(mirrorPlaqueMesh);

  const lowerMirrorHit = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 1.65, 0.36),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  lowerMirrorHit.position.set(0, 1.02, 0);
  registerInteract(lowerMirrorHit, {
    kind: 'cheval_embodiment',
    anchorWorld: new THREE.Vector3(-3.25, 2.48, 1.85),
    getLead: () => `Brass Cheval Mirror · ${EMBODIMENT_LABELS[state.embodiment]}`,
    getMeta: () => 'Click to Cycle V9 Skinned / 31-Part Cutout / Twin Audit',
  });
  chevalMirrorGroup.add(lowerMirrorHit);

  const upperGlassesHit = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.48, 0.42),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  upperGlassesHit.position.set(0, 2.18, 0);
  registerInteract(upperGlassesHit, {
    kind: 'cheval_glasses',
    anchorWorld: new THREE.Vector3(-3.25, 2.62, 1.85),
    getLead: () => `Poet Brass Sunglasses · ${state.glasses ? 'ON' : 'OFF'}`,
    getMeta: () => 'Click Upper Frame to Toggle Sunglasses',
  });
  chevalMirrorGroup.add(upperGlassesHit);
}

// B. 3D Sculpted Marble Wing Pedestal (Beside Cheval Mirror)
const wingPedestalGroup = new THREE.Group();
wingPedestalGroup.position.set(-2.15, 0, 0.78);
wingPedestalGroup.rotation.y = 0.44;
worldRoot.add(wingPedestalGroup);

const pedestalMiniWingL = new THREE.Group();
const pedestalMiniWingR = new THREE.Group();
let wingPedestalPlaque = null;
{
  const pedBase = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 0.68), marbleMat);
  pedBase.position.y = 0.08;
  pedBase.castShadow = true;
  wingPedestalGroup.add(pedBase);

  const pedShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.96, 16), marbleMat);
  pedShaft.position.y = 0.64;
  pedShaft.castShadow = true;
  wingPedestalGroup.add(pedShaft);

  const pedCap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.62), kintsugiGoldMat);
  pedCap.position.y = 1.18;
  wingPedestalGroup.add(pedCap);

  pedestalMiniWingL.position.set(-0.08, 1.38, 0);
  pedestalMiniWingR.position.set(0.08, 1.38, 0);
  wingPedestalGroup.add(pedestalMiniWingL, pedestalMiniWingR);

  for (const [grp, sgn] of [[pedestalMiniWingL, -1], [pedestalMiniWingR, 1]]) {
    for (let f = 0; f < 5; f++) {
      const feather = new THREE.Mesh(
        new THREE.BoxGeometry(0.32 + f * 0.08, 0.065, 0.05),
        f % 2 === 0 ? marbleMat : kintsugiGoldMat
      );
      feather.position.set(sgn * (0.16 + f * 0.09), f * 0.06, 0);
      feather.rotation.z = sgn * (0.22 + f * 0.1);
      feather.castShadow = true;
      grp.add(feather);
    }
  }

  wingPedestalPlaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.24),
    new THREE.MeshBasicMaterial({
      map: makePlaqueTexture('P06 WINGS · ANGEL FLAP', 'Click Pedestal to Cycle Wings'),
    })
  );
  wingPedestalPlaque.position.set(0, 0.72, 0.28);
  wingPedestalGroup.add(wingPedestalPlaque);

  const pedHit = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.9, 0.9),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  pedHit.position.y = 0.95;
  registerInteract(pedHit, {
    kind: 'wing_pedestal',
    anchorWorld: new THREE.Vector3(-2.15, 2.05, 0.78),
    getLead: () => `Marble Wing Pedestal · ${WINGS_LABELS[state.wingsMode]}`,
    getMeta: () => 'Click to Cycle Angel / Marble / Raven / Folded / Off',
  });
  wingPedestalGroup.add(pedHit);
}

// C. 3D Choreographer's Brass Music Stand & Ticking Metronome (Downstage)
const musicStandGroup = new THREE.Group();
musicStandGroup.position.set(1.55, 0, 2.85);
musicStandGroup.rotation.y = -0.44;
worldRoot.add(musicStandGroup);

const metronomePendulum = new THREE.Group();
let musicStandScoreMesh = null;
{
  const tripodBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.34, 0.14, 12), brassMat);
  tripodBase.position.y = 0.07;
  musicStandGroup.add(tripodBase);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 1.12, 12), brassMat);
  stem.position.y = 0.64;
  stem.castShadow = true;
  musicStandGroup.add(stem);

  const deskGroup = new THREE.Group();
  deskGroup.position.set(0, 1.22, 0);
  deskGroup.rotation.x = -0.48;
  musicStandGroup.add(deskGroup);

  const deskBoard = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.56, 0.04), darkTimberMat);
  deskBoard.castShadow = true;
  deskGroup.add(deskBoard);

  musicStandScoreMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.74, 0.46),
    new THREE.MeshBasicMaterial({
      map: makePlaqueTexture('CHOREO · LOCOMOTION & WEIGHT', 'Click Stand to Cycle 5 Ensemble States', '#7ce8ff'),
    })
  );
  musicStandScoreMesh.position.z = 0.026;
  deskGroup.add(musicStandScoreMesh);

  // Pyramid Mahogany & Brass Metronome perched on side table of stand
  const metroPlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 14), brassMat);
  metroPlinth.position.set(0.52, 0.92, 0.06);
  musicStandGroup.add(metroPlinth);

  const metroPost = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.92, 10), brassMat);
  metroPost.position.set(0.52, 0.46, 0.06);
  musicStandGroup.add(metroPost);

  const metroBody = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 4), darkTimberMat);
  metroBody.rotation.y = Math.PI / 4;
  metroBody.position.set(0.52, 1.11, 0.06);
  metroBody.castShadow = true;
  musicStandGroup.add(metroBody);

  metronomePendulum.position.set(0.52, 0.98, 0.14);
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.28, 0.012), kintsugiGoldMat);
  rod.position.y = 0.12;
  const weight = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.036, 0.024), kintsugiGoldMat);
  weight.position.y = 0.18;
  metronomePendulum.add(rod, weight);
  musicStandGroup.add(metronomePendulum);

  const standHit = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 1.68, 0.85),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  standHit.position.set(0.18, 0.84, 0);
  registerInteract(standHit, {
    kind: 'music_stand',
    anchorWorld: new THREE.Vector3(1.55, 1.82, 2.85),
    getLead: () => `Choreographer Stand · ${CHOREO_STATES[state.choreoIdx].label}`,
    getMeta: () => 'Click to Cycle Synchronized Ensemble & Hero Performance',
  });
  musicStandGroup.add(standHit);
}

// Stage Props for Cast Role Actions (Makeda's Brass Standpipe, Imani's Marble Cistern, Chorus Bench)
{
  // Stage Left Brass Standpipe for Makeda ('pump' / 'water')
  const standpipe = new THREE.Group();
  standpipe.position.set(-3.95, 0, -2.15);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.38, 0.28, 18), marbleMat);
  basin.position.y = 0.14;
  const basinWater = new THREE.Mesh(new THREE.CircleGeometry(0.39, 18), reflectingPoolMat);
  basinWater.rotation.x = -Math.PI / 2;
  basinWater.position.y = 0.29;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 1.08, 12), brassMat);
  column.position.set(-0.22, 0.54, 0);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.28, 10), brassMat);
  spout.rotation.z = Math.PI / 2.3;
  spout.position.set(-0.08, 0.92, 0);
  const pumpHandle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.035), kintsugiGoldMat);
  pumpHandle.position.set(-0.38, 0.98, 0);
  pumpHandle.rotation.z = 0.28;
  standpipe.add(basin, basinWater, column, spout, pumpHandle);
  worldRoot.add(standpipe);

  // Stage Right Kintsugi Cistern & Amphora for Imani ('water' / 'carry')
  const cistern = new THREE.Group();
  cistern.position.set(3.85, 0, -1.65);
  const wellRim = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.58, 0.44, 20), marbleMat);
  wellRim.position.y = 0.22;
  wellRim.castShadow = true;
  const wellWater = new THREE.Mesh(new THREE.CircleGeometry(0.48, 20), cyanGlowMat);
  wellWater.rotation.x = -Math.PI / 2;
  wellWater.position.y = 0.45;
  cistern.add(wellRim, wellWater);
  worldRoot.add(cistern);

  // Stage Right Carved Marble Bench for Chorus ('sit-talk')
  const bench = new THREE.Group();
  bench.position.set(4.55, 0, -4.55);
  bench.rotation.y = -0.68;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.10, 0.52), marbleMat);
  seat.position.y = 0.46;
  seat.castShadow = true;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.46), marbleMat);
  legL.position.set(-0.58, 0.22, 0);
  const legR = legL.clone();
  legR.position.x = 0.58;
  bench.add(seat, legL, legR);
  worldRoot.add(bench);
}

// D. In-World Theatrical Wing Flats (Switch Other Stage Scenes Live in 3D!)
const wingFlatsGroup = new THREE.Group();
worldRoot.add(wingFlatsGroup);
const wingFlatCards = [];

const WING_FLAT_SLOTS = [
  { sceneId: 'P06-S01', x: -6.8, z: -4.2, rotY: 0.46 },
  { sceneId: 'P06-S02', x: -7.4, z: -0.9, rotY: 0.54 },
  { sceneId: 'P06-S06', x: -6.9, z: 2.5, rotY: 0.68 },
  { sceneId: 'P04-S01', x: 6.8, z: -4.2, rotY: -0.46 },
  { sceneId: 'P07-S01', x: 7.4, z: -0.9, rotY: -0.54 },
  { sceneId: 'P08-S01', x: 6.9, z: 2.5, rotY: -0.68 },
];

// E. 3D Brass 8x10 Camera Tripod & Peripheral Threshold Portals
const worldRig = createWorldPortalAndTripod({
  THREE,
  scene,
  camera,
  domElement: renderer.domElement,
  suite,
  tripodPos: { x: 3.95, y: 0, z: 4.15, rotY: -2.5 },
  onTripodClick: ({ isShutter }) => {
    if (isShutter) {
      triggerShutterFlash();
    }
    return false;
  },
  portals: [
    {
      id: 'atlantis',
      label: 'Atlantis Rings & Oulipo (-38m)',
      href: '../atlantis/',
      pos: { x: -8.6, y: 0, z: -8.6 },
      rotY: 0.65,
      color: '#18b4ff',
    },
    {
      id: 'weave',
      label: 'WEAVE Multiplane Stage',
      href: '../weave/',
      pos: { x: 8.6, y: 0, z: -8.6 },
      rotY: -0.65,
      color: '#e0b46a',
    },
    {
      id: 'island',
      label: 'Open-World Island GTA',
      href: '../island/',
      pos: { x: -9.2, y: 0, z: 5.8 },
      rotY: 2.35,
      color: '#5ec8ff',
    },
    {
      id: 'nolli',
      label: 'Severn Nolli Block',
      href: '../',
      pos: { x: 9.2, y: 0, z: 5.8 },
      rotY: -2.35,
      color: '#f2a541',
    },
    {
      id: 'inverse-forge',
      label: 'Inverse Foundry 5-Level Shot Optimizer',
      href: '../inverse-forge/',
      pos: { x: 0, y: 0, z: 10.6 },
      rotY: Math.PI,
      color: '#7ce8ff',
    },
  ],
});

// ---------------------------------------------------------------------------
// 6. Hero & Ensemble Rig Spawners (Direct ../hero-build/anny-hero-v9.js &
//    ../hero-build/cutout-31-rig.js Integration)
// ---------------------------------------------------------------------------
async function spawnV9Character({
  role = 'poet_hero',
  archetype = undefined,
  wingsMode = 'off',
  glasses = false,
  prop = 'none',
  initialAction = 'idle',
  seed = 2086,
}) {
  const inst = await createHeroOrCastV9({
    THREE,
    loader: gltfLoader,
    role,
    archetype,
    wingsMode,
    glasses,
    prop,
    groundY: 0,
    seed,
  });
  if (inst && typeof inst.playAction === 'function') {
    inst.playAction(initialAction, 0.15);
  }
  return inst;
}

function spawnCutout31Character({
  variant = 'poet_tracksuit_31',
  wingsMode = 'angel',
  glasses = true,
  showBrassPivots = true,
  prop = 'none',
} = {}) {
  return createArticulated31CutoutRig({
    THREE,
    variant,
    showBrassPivots,
    wingsMode,
    glasses,
    prop,
    groundY: 0,
  });
}

// ---------------------------------------------------------------------------
// 7. Spawn Playable Center-Stage Poet Hero (V9 Skinned + 31-Part Cutout Twin)
//    and Full Living Ensemble Cast Across the Atlantis Gate Courtyard
// ---------------------------------------------------------------------------
const heroRootGroup = new THREE.Group();
heroRootGroup.name = 'playable-hero-anchor';
heroRootGroup.position.copy(state.heroPos);
heroRootGroup.rotation.y = state.heroYaw;
worldRoot.add(heroRootGroup);

let heroV9 = null;
let heroCutout31 = null;
const castEntries = [];

const speakerFloorRing = new THREE.Mesh(
  new THREE.RingGeometry(0.46, 0.56, 32),
  new THREE.MeshBasicMaterial({ color: '#7ce8ff', side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
);
speakerFloorRing.rotation.x = -Math.PI / 2;
speakerFloorRing.position.y = 0.03;
speakerFloorRing.visible = false;
worldRoot.add(speakerFloorRing);

function syncHeroEmbodimentLayout() {
  const mode = state.embodiment;
  if (heroV9?.root) {
    heroV9.root.visible = mode === 'v9_skinned' || mode === 'twin_audit';
    heroV9.root.position.set(mode === 'twin_audit' ? -0.52 : 0, 0, 0);
  }
  if (heroCutout31?.root) {
    heroCutout31.root.visible = mode === 'cutout_31' || mode === 'twin_audit';
    heroCutout31.root.position.set(mode === 'twin_audit' ? 0.52 : 0, 0, 0);
    // Cutout faces +Z natively; match hero forward direction
    heroCutout31.root.rotation.y = 0;
  }

  if (mirrorPlaqueMesh) {
    const shortMode =
      mode === 'v9_skinned' ? 'V9 SKINNED HERO' : mode === 'cutout_31' ? '31-PART CUTOUT' : 'TWIN AUDIT';
    mirrorPlaqueMesh.material.map = makePlaqueTexture(
      `MIRROR · ${shortMode}`,
      `Sunglasses: ${state.glasses ? 'ON' : 'OFF'} (Click Crest)`
    );
    mirrorPlaqueMesh.material.needsUpdate = true;
  }
  updateTabNotesText();
}

function syncHeroGear() {
  if (heroV9?.setGlasses) heroV9.setGlasses(state.glasses);
  if (heroCutout31?.setGlasses) heroCutout31.setGlasses(state.glasses);
  if (heroV9?.setWingsMode) heroV9.setWingsMode(state.wingsMode);
  if (heroCutout31?.setWingsMode) heroCutout31.setWingsMode(state.wingsMode);

  if (wingPedestalPlaque) {
    wingPedestalPlaque.material.map = makePlaqueTexture(
      `P06 WINGS · ${state.wingsMode.toUpperCase()}`,
      'Click Pedestal to Cycle Wings'
    );
    wingPedestalPlaque.material.needsUpdate = true;
  }
  syncHeroEmbodimentLayout();
}

function applyChoreographyState(idx) {
  state.choreoIdx = ((idx % CHOREO_STATES.length) + CHOREO_STATES.length) % CHOREO_STATES.length;
  const ch = CHOREO_STATES[state.choreoIdx];

  if (ch.id === 'flight_gate') {
    state.gateOpen = true;
    savePilotState({ doorOpen: true }, { syncHash: false });
    if (state.wingsMode === 'off' || state.wingsMode === 'folded') {
      state.wingsMode = 'marble';
      syncHeroGear();
    }
    state.wingFlapBoost = 1.0;
  }

  for (const actor of castEntries) {
    const wantClip = ch.castClips[actor.id] || actor.defaultClip;
    actor.activeAction = wantClip;
    if (actor.inst?.playAction) {
      actor.inst.playAction(wantClip, 0.28);
    }
  }

  if (state.heroGroundSpeed < 0.12) {
    if (heroV9?.playAction) heroV9.playAction(ch.heroIdle, 0.28);
    if (heroCutout31?.playAction) heroCutout31.playAction(ch.heroIdle, 0.28);
  }

  if (musicStandScoreMesh) {
    musicStandScoreMesh.material.map = makePlaqueTexture(
      `CHOREO · ${ch.label.toUpperCase()}`,
      `${ch.bpm} BPM | Click Stand for Next Ensemble`,
      '#7ce8ff'
    );
    musicStandScoreMesh.material.needsUpdate = true;
  }
  updateTabNotesText();
}

function triggerActorDuetSpeech(actorEntry, isReply = false) {
  if (!actorEntry) return;
  const lines = state.duetLines.length
    ? state.duetLines
    : [
        { speaker: 'Poet Hero', role: 'poet_hero', line: 'The gates open with wings gifted from evolution, and made of marble stones.' },
        { speaker: 'Elder Bekele', role: 'bekele', line: 'An orchestra of our ancestors wildest dreams rises where tide meets kintsugi stone.' },
      ];

  const matching = lines.find((l) => l.role === actorEntry.id);
  const chosen = isReply || !matching ? lines[state.duetCursor % lines.length] : matching;
  state.duetCursor = (state.duetCursor + 1) % lines.length;

  state.speakingActor = actorEntry;
  state.speakingLabel = `${actorEntry.label} · P06 Duet`;
  state.speakingLine = chosen.line;
  state.speakingStart = performance.now() * 0.001;
  state.speakingDur = 4.6;

  // Turn actor cleanly toward the Hero and play expressive role gesture
  if (actorEntry.group && actorEntry.id !== 'poet_hero') {
    const dx = state.heroPos.x - actorEntry.group.position.x;
    const dz = state.heroPos.z - actorEntry.group.position.z;
    actorEntry.targetYaw = Math.atan2(dx, dz);
  }

  const talkClip = actorEntry.talkClip || 'idle-talking';
  if (actorEntry.inst?.playAction) {
    actorEntry.inst.playAction(talkClip, 0.22);
  }
  suite.speakLine(actorEntry.label, chosen.line, actorEntry.pitch || 1.0);

  // Schedule turn-taking Codex answer if initiated by click
  if (!isReply) {
    const responder =
      actorEntry.id === 'bekele'
        ? castEntries.find((c) => c.id === 'imani')
        : castEntries.find((c) => c.id === 'bekele');
    if (responder) {
      state.replyTimer = 4.85;
      state.pendingResponder = responder;
    }
  }
}

// ---------------------------------------------------------------------------
// 8. Load Stage Scenes JSON & Build Multiplane Layers + Wing Flats
// ---------------------------------------------------------------------------
async function applyStageScene(sceneId) {
  const sc = state.sceneDataById.get(sceneId) || state.sceneDataById.get('P06-S01');
  if (!sc) return;
  state.sceneId = sc.id;

  try {
    window.history.replaceState(null, '', `#${sc.id}`);
  } catch {
    // Ignore history error
  }
  savePilotState({ poem: sc.poem || '06', shot: sc.id.split('-')[1] || 'S01' }, { syncHash: false });

  // Clear previous multiplane meshes
  while (multiplaneStageGroup.children.length > 0) {
    multiplaneStageGroup.remove(multiplaneStageGroup.children[0]);
  }
  state.multiplaneMeshes = [];

  // Build registered multiplane cutout layers behind & around the Atlantis Gate
  for (let i = 0; i < (sc.layers || []).length; i++) {
    const l = sc.layers[i];
    // Playable 3D Hero replaces static actor_poet cutout at center stage
    if (l.instance === 'actor_poet') continue;
    const res = await loadCutoutTexture(l.file);
    if (!res) continue;

    const ar = res.width / Math.max(1, res.height);
    const zDepth = -7.2 - (Number(l.z || 1.5) * 2.35);
    const baseH = Math.max(1.2, Number(l.scale || 0.45) * 8.2);
    const w = Math.min(18.5, baseH * ar);
    const h = w / ar;

    const mat = new THREE.MeshStandardMaterial({
      map: res.tex,
      transparent: true,
      alphaTest: 0.06,
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const worldX = ((Number(l.x ?? 0.5) - 0.5) * 14.5);
    const bottomY = Math.max(0.02, (1.0 - Number(l.y ?? 0.88)) * 4.8);
    mesh.position.set(worldX, bottomY + h * 0.5, zDepth);
    mesh.userData.animRole = l.anim_role || (l.part_id.includes('shore_night') ? 'wave' : '');
    mesh.userData.baseX = mesh.position.x;
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.phaseOff = i * 0.7;
    multiplaneStageGroup.add(mesh);
    state.multiplaneMeshes.push(mesh);
  }

  // Highlight active Wing Flat frame
  for (const wf of wingFlatCards) {
    const on = wf.sceneId === sc.id;
    wf.borderMesh.material = on ? cyanGlowMat : brassMat;
  }

  // Subtle poem mood shift on sky comet boost & gate portal hue
  skyUniforms.uCometBoost.value = sc.poem === '06' ? 1.15 : 0.45;
  gatePortalLight.color.set(sc.poem === '07' || sc.poem === '08' ? '#d96bff' : '#18b4ff');

  // Evolve Hero phenotype smoothly when switching poem scenes
  if (heroV9) {
    evolveHeroPhenotype(heroV9, {
      poem: sc.poem || '06',
      shotKind: sc.poem === '06' ? 'gate' : 'stage',
      seed: 2086 + Number(sc.book || 6),
      bgLuminance: 0.22,
    });
    state.wingsMode = heroV9.getWingsMode ? heroV9.getWingsMode() : state.wingsMode;
    state.glasses = heroV9.getGlasses ? Boolean(heroV9.getGlasses()) : state.glasses;
  }
  if (heroCutout31) {
    evolveCutoutPhenotype(heroCutout31, {
      poem: sc.poem || '06',
      shotKind: sc.poem === '06' ? 'gate' : 'stage',
      seed: 2086 + Number(sc.book || 6),
      bgLuminance: 0.22,
    });
  }
  updateTabNotesText();
}

async function buildWingFlats() {
  for (const slot of WING_FLAT_SLOTS) {
    const sc = state.sceneDataById.get(slot.sceneId);
    if (!sc) continue;

    const flat = new THREE.Group();
    flat.position.set(slot.x, 0, slot.z);
    flat.rotation.y = slot.rotY;
    wingFlatsGroup.add(flat);

    // Theatrical timber frame + brass brace + cutout preview canvas
    const timberBack = new THREE.Mesh(new THREE.BoxGeometry(2.05, 3.35, 0.09), darkTimberMat);
    timberBack.position.y = 1.68;
    timberBack.castShadow = true;
    timberBack.receiveShadow = true;
    flat.add(timberBack);

    const borderMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.14, 3.44, 0.06),
      slot.sceneId === state.sceneId ? cyanGlowMat : brassMat
    );
    borderMesh.position.set(0, 1.68, -0.02);
    flat.add(borderMesh);

    // Pick best non-strip set or character cutout for crisp aspect-preserved theatrical flat poster
    const bestLayer =
      (sc.layers || []).find((l) => l.part_id && (l.part_id.includes('crystal_tree') || l.part_id.includes('atlantis_gate__p01'))) ||
      (sc.layers || []).find((l) => l.instance !== 'actor_poet' && !String(l.part_id || '').includes('rainbow-clouds')) ||
      (sc.layers || [])[0];
    if (bestLayer) {
      const res = await loadCutoutTexture(bestLayer.file);
      const posterC = document.createElement('canvas');
      posterC.width = 512;
      posterC.height = 640;
      const pg = posterC.getContext('2d');
      const bg = pg.createLinearGradient(0, 0, 0, 640);
      bg.addColorStop(0, '#091b34');
      bg.addColorStop(0.65, '#163c68');
      bg.addColorStop(1, '#0d1926');
      pg.fillStyle = bg;
      pg.fillRect(0, 0, 512, 640);

      pg.strokeStyle = 'rgba(224, 180, 106, 0.55)';
      pg.lineWidth = 4;
      pg.strokeRect(14, 14, 484, 612);

      if (res && res.tex && res.tex.image) {
        const im = res.tex.image;
        const scale = Math.min(440 / Math.max(1, im.width), 430 / Math.max(1, im.height));
        const dw = im.width * scale;
        const dh = im.height * scale;
        pg.drawImage(im, (512 - dw) * 0.5, 42 + (440 - dh) * 0.5, dw, dh);
      }

      pg.fillStyle = '#e0b46a';
      pg.font = '700 22px ui-monospace, SFMono-Regular, Menlo, monospace';
      pg.textAlign = 'center';
      pg.fillText(sc.id, 256, 542);
      pg.fillStyle = '#f4eedd';
      pg.font = 'italic 18px Georgia, serif';
      const snippet = String(sc.lines || sc.title || '').replace(/\s+/g, ' ').slice(0, 42);
      pg.fillText(snippet, 256, 578);

      const posterTex = new THREE.CanvasTexture(posterC);
      posterTex.colorSpace = THREE.SRGBColorSpace;
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(1.82, 2.25),
        new THREE.MeshStandardMaterial({
          map: posterTex,
          roughness: 0.52,
          metalness: 0.08,
        })
      );
      art.position.set(0, 1.92, 0.06);
      flat.add(art);
    }

    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.86, 0.56),
      new THREE.MeshBasicMaterial({
        map: makePlaqueTexture(`${sc.id} · POEM ${sc.poem}`, sc.title),
      })
    );
    plaque.position.set(0, 0.44, 0.06);
    flat.add(plaque);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 3.5, 0.45),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 1.72;
    registerInteract(hit, {
      kind: 'wing_flat',
      sceneId: sc.id,
      anchorWorld: new THREE.Vector3(slot.x, 3.62, slot.z),
      getLead: () => `Stage Wing Flat · ${sc.id} (${sc.title})`,
      getMeta: () => (state.sceneId === sc.id ? 'Active Scene on Stage' : 'Click to Stage Multiplane Scene'),
    });
    flat.add(hit);

    wingFlatCards.push({ sceneId: sc.id, group: flat, borderMesh });
  }
}

function updateTabNotesText() {
  if (notesSceneLineEl) {
    notesSceneLineEl.textContent = `Scene: ${state.sceneId} | Hero: ${EMBODIMENT_LABELS[state.embodiment]} | Wings: ${state.wingsMode}`;
  }
  if (notesEnsembleLineEl) {
    const st = suite.getState ? suite.getState() : null;
    const lookId = st?.lookId || pilot.shader || 'weave';
    notesEnsembleLineEl.textContent = `Ensemble: ${CHOREO_STATES[state.choreoIdx].label} | Gate: ${state.gateOpen ? 'Open' : 'Closed'} | Look: ${lookId.toUpperCase()}`;
  }
}

// ---------------------------------------------------------------------------
// 9. Boot Stage Data, Hero Poet (V9 + 31-Part Cutout), and Full Ensemble Cast
// ---------------------------------------------------------------------------
async function bootStage() {
  const stageJson = await fetch('./data/stage-scenes.json')
    .then((r) => r.json())
    .catch(() => ({ scenes: [], duetLines: [] }));

  for (const sc of stageJson.scenes || []) {
    state.sceneDataById.set(sc.id, sc);
  }
  state.duetLines = stageJson.duetLines || [];

  await buildWingFlats();
  await applyStageScene(state.sceneId);

  // Spawn Playable Center-Stage Poet Hero (both V9 Skinned & 31-Part Brass-Pivot Cutout Twin)
  const [v9Hero, cutHero] = await Promise.all([
    spawnV9Character({
      role: 'poet_hero',
      wingsMode: state.wingsMode,
      glasses: state.glasses,
      prop: state.heroProp,
      initialAction: 'listen',
      seed: 1,
    }),
    Promise.resolve(
      spawnCutout31Character({
        variant: 'poet_tracksuit_31',
        wingsMode: state.wingsMode,
        glasses: state.glasses,
        showBrassPivots: true,
        prop: state.heroProp,
      })
    ),
  ]);

  heroV9 = v9Hero;
  heroCutout31 = cutHero;
  if (heroV9?.root) heroRootGroup.add(heroV9.root);
  if (heroCutout31?.root) heroRootGroup.add(heroCutout31.root);

  const heroHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 1.95, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  heroHit.position.y = 0.98;
  registerInteract(heroHit, {
    kind: 'hero_self',
    anchorWorld: state.heroPos,
    isHero: true,
    getLead: () => `Playable Poet Hero (Gen ${state.heroGen}) · ${EMBODIMENT_LABELS[state.embodiment]}`,
    getMeta: () => 'WASD Move | Shift Sprint | Space Wing-Glide | Click to Evolve Phenotype',
  });
  heroRootGroup.add(heroHit);

  syncHeroGear();

  // Spawn Courtyard Ensemble Cast with Distinct Living Role Animations & Eye/Head Gaze
  const ENSEMBLE_SPECS = [
    {
      id: 'imani',
      label: 'Imani',
      kind: 'v9',
      role: 'imani',
      archetype: 'adult_f',
      pos: [3.15, 0, -1.65],
      yaw: -1.15,
      defaultClip: 'carry',
      talkClip: 'greet',
      pitch: 1.08,
      wingsMode: 'off',
    },
    {
      id: 'makeda',
      label: 'Makeda',
      kind: 'v9',
      role: 'makeda',
      archetype: 'elder',
      pos: [-3.35, 0, -2.1],
      yaw: 1.12,
      defaultClip: 'pump',
      talkClip: 'idle-talking',
      pitch: 0.94,
      wingsMode: 'off',
    },
    {
      id: 'bekele',
      label: 'Elder Bekele',
      kind: 'v9',
      role: 'bekele',
      archetype: 'adult_m',
      pos: [-1.85, 0, -5.85],
      yaw: 0.36,
      defaultClip: 'listen',
      talkClip: 'idle-talking',
      pitch: 0.84,
      wingsMode: 'folded',
    },
    {
      id: 'june',
      label: 'June',
      kind: 'v9',
      role: 'june',
      archetype: 'child7',
      pos: [2.55, 0, 1.45],
      yaw: -2.25,
      defaultClip: 'dance',
      talkClip: 'yes',
      pitch: 1.24,
      wingsMode: 'off',
    },
    {
      id: 'chorus',
      label: 'Chorus Gatekeeper',
      kind: 'v9',
      role: 'chorus',
      archetype: 'adult_m',
      pos: [4.25, 0, -4.45],
      yaw: -0.75,
      defaultClip: 'sit-talk',
      talkClip: 'greet',
      pitch: 0.98,
      wingsMode: 'off',
    },
    {
      id: 'cutout_twin',
      label: '31-Part Cutout Gatekeeper',
      kind: 'cutout31',
      variant: 'atlantis_gatekeeper',
      pos: [1.85, 0, -5.75],
      yaw: -0.35,
      defaultClip: 'walk',
      talkClip: 'greet',
      pitch: 1.02,
      wingsMode: 'marble',
      glasses: false,
    },
    {
      id: 'angel_actor',
      label: '31-Part Cutout Winged Chorus',
      kind: 'cutout31',
      variant: 'angel_white_robe',
      pos: [-3.95, 0, -5.15],
      yaw: 0.58,
      defaultClip: 'pray',
      talkClip: 'greet',
      pitch: 1.12,
      wingsMode: 'angel',
      glasses: false,
    },
  ];

  await Promise.all(
    ENSEMBLE_SPECS.map(async (spec, idx) => {
      const grp = new THREE.Group();
      grp.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      grp.rotation.y = spec.yaw;
      worldRoot.add(grp);

      const inst =
        spec.kind === 'cutout31'
          ? spawnCutout31Character({
              variant: spec.variant || 'poet_tracksuit_31',
              wingsMode: spec.wingsMode,
              glasses: Boolean(spec.glasses),
              showBrassPivots: true,
            })
          : await spawnV9Character({
              role: spec.role,
              archetype: spec.archetype,
              wingsMode: spec.wingsMode,
              glasses: false,
              initialAction: spec.defaultClip,
              seed: 100 + idx * 17,
            });

      if (inst?.root) grp.add(inst.root);

      const entry = {
        ...spec,
        group: grp,
        inst,
        baseYaw: spec.yaw,
        targetYaw: spec.yaw,
        activeAction: spec.defaultClip,
      };

      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.48, 1.88, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.94;
      registerInteract(hit, {
        kind: 'cast_actor',
        actor: entry,
        anchorWorld: new THREE.Vector3(spec.pos[0], 2.05, spec.pos[2]),
        getLead: () => `${spec.label} · ${entry.activeAction}`,
        getMeta: () => 'Click for FACS + Viseme Duet Speech',
      });
      grp.add(hit);

      castEntries.push(entry);
    })
  );

  applyChoreographyState(0);
}

// ---------------------------------------------------------------------------
// 10. Input Handling: WASD + Shift Sprint + Space Wing-Glide + Orbit Drag + Raycast Click
// ---------------------------------------------------------------------------
const keys = Object.create(null);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let draggingOrbit = false;
let pointerDownPos = { x: 0, y: 0 };
let lastDragPos = { x: 0, y: 0 };
let hoveredInteract = null;

function updateNdc(e) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
}

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 && e.button !== 2) return;
  draggingOrbit = true;
  pointerDownPos = { x: e.clientX, y: e.clientY };
  lastDragPos = { x: e.clientX, y: e.clientY };
  try {
    renderer.domElement.setPointerCapture(e.pointerId);
  } catch {
    // Ignore pointer capture errors
  }
});

window.addEventListener('pointermove', (e) => {
  if (draggingOrbit) {
    const dx = e.clientX - lastDragPos.x;
    const dy = e.clientY - lastDragPos.y;
    lastDragPos = { x: e.clientX, y: e.clientY };
    state.camYaw -= dx * 0.0052;
    state.camPitch = THREE.MathUtils.clamp(state.camPitch + dy * 0.0042, -0.12, 1.18);
    return;
  }

  updateNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(interactMeshes, false);
  hoveredInteract = hits.length > 0 && hits[0].distance < 36 ? hits[0].object.userData.stageInteract : null;
  renderer.domElement.style.cursor = hoveredInteract ? 'pointer' : 'grab';
});

window.addEventListener('pointerup', (e) => {
  if (!draggingOrbit) return;
  draggingOrbit = false;
  const distMoved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (distMoved > 6) return;

  updateNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(interactMeshes, false);
  if (hits.length === 0 || hits[0].distance > 36) return;

  const item = hits[0].object.userData.stageInteract;
  if (!item) return;

  if (item.kind === 'cheval_embodiment') {
    const idx = (EMBODIMENT_MODES.indexOf(state.embodiment) + 1) % EMBODIMENT_MODES.length;
    state.embodiment = EMBODIMENT_MODES[idx];
    suite.audio?.playTripodLock?.();
    syncHeroEmbodimentLayout();
  } else if (item.kind === 'cheval_glasses') {
    state.glasses = !state.glasses;
    suite.audio?.playTripodLock?.();
    syncHeroGear();
  } else if (item.kind === 'wing_pedestal') {
    const idx = (WINGS_MODES.indexOf(state.wingsMode) + 1) % WINGS_MODES.length;
    state.wingsMode = WINGS_MODES[idx];
    state.wingFlapBoost = 0.85;
    suite.audio?.playTripodLock?.();
    syncHeroGear();
  } else if (item.kind === 'music_stand') {
    suite.audio?.playTripodLock?.();
    applyChoreographyState(state.choreoIdx + 1);
  } else if (item.kind === 'atlantis_gate') {
    state.gateOpen = !state.gateOpen;
    savePilotState({ doorOpen: state.gateOpen }, { syncHash: false });
    suite.audio?.playPour?.();
    updateTabNotesText();
  } else if (item.kind === 'wing_flat') {
    suite.audio?.playTripodLock?.();
    applyStageScene(item.sceneId);
  } else if (item.kind === 'cast_actor') {
    triggerActorDuetSpeech(item.actor, false);
  } else if (item.kind === 'hero_self') {
    state.heroGen += 1;
    if (heroV9) {
      const pheno = evolveHeroPhenotype(heroV9, {
        poem: state.sceneId,
        shotKind: 'hero-audit',
        seed: 2086 + state.heroGen * 37,
        bgLuminance: 0.22,
      });
      if (pheno) {
        state.wingsMode = pheno.wingsMode || state.wingsMode;
        state.glasses = Boolean(pheno.glasses);
        state.heroProp = pheno.prop || state.heroProp;
      }
    }
    if (heroCutout31) {
      evolveCutoutPhenotype(heroCutout31, {
        poem: state.sceneId,
        shotKind: 'hero-audit',
        seed: 2086 + state.heroGen * 37,
        bgLuminance: 0.22,
      });
    }
    syncHeroEmbodimentLayout();
    suite.audio?.playTripodLock?.();
  }
});

renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.08 : 0.92;
    state.camDist = THREE.MathUtils.clamp(state.camDist * factor, 1.15, 19.5);
  },
  { passive: false }
);

window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  keys[e.code] = true;

  if (e.code === 'Space') {
    e.preventDefault();
    if (!state.heroAirborne) {
      // Evolutionary Wing-Boost Jump!
      state.heroAirborne = true;
      state.heroVel.y = 6.25;
      state.wingFlapBoost = 1.0;
      if (state.wingsMode === 'off') {
        state.wingsMode = 'angel';
        syncHeroGear();
      }
    } else {
      state.wingFlapBoost = 1.0;
    }
  } else if (e.code === 'KeyG') {
    state.glasses = !state.glasses;
    syncHeroGear();
  } else if (e.code === 'KeyM') {
    const idx = (EMBODIMENT_MODES.indexOf(state.embodiment) + 1) % EMBODIMENT_MODES.length;
    state.embodiment = EMBODIMENT_MODES[idx];
    syncHeroEmbodimentLayout();
  } else if (e.code === 'KeyC') {
    applyChoreographyState(state.choreoIdx + 1);
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('hashchange', () => {
  const h = (window.location.hash || '').replace(/^#/, '').trim().toUpperCase();
  if (h && state.sceneDataById.has(h) && h !== state.sceneId) {
    applyStageScene(h);
  }
});

subscribePilotState((nextPilot) => {
  pilot = nextPilot;
  if (Boolean(nextPilot.doorOpen) !== state.gateOpen) {
    state.gateOpen = Boolean(nextPilot.doorOpen);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// 11. Diagnostic & Verification API (`window.__STAGE_P06__`) for Multi-Frame
//     Bone/Rig Motion Proof & Close-Up Hero Inspection
// ---------------------------------------------------------------------------
function sampleFirstMatchWorldPos(rootObj, keywords) {
  if (!rootObj) return null;
  rootObj.updateMatrixWorld(true);
  let target = null;
  rootObj.traverse((o) => {
    if (target) return;
    const n = (o.name || '').toLowerCase();
    if (keywords.some((k) => n.includes(k))) {
      target = o;
    }
  });
  if (!target) return null;
  const v = new THREE.Vector3();
  target.getWorldPosition(v);
  return [Number(v.x.toFixed(5)), Number(v.y.toFixed(5)), Number(v.z.toFixed(5))];
}

window.__STAGE_P06__ = {
  getState: () => ({
    sceneId: state.sceneId,
    embodiment: state.embodiment,
    glasses: state.glasses,
    wingsMode: state.wingsMode,
    choreography: CHOREO_STATES[state.choreoIdx].id,
    gateOpen: state.gateOpen,
    castCount: castEntries.length,
    heroLoaded: Boolean(heroV9 && heroCutout31),
  }),
  setEmbodiment: (m) => {
    if (EMBODIMENT_MODES.includes(m)) {
      state.embodiment = m;
      syncHeroEmbodimentLayout();
    }
  },
  setWingsMode: (m) => {
    if (WINGS_MODES.includes(m)) {
      state.wingsMode = m;
      syncHeroGear();
    }
  },
  setGlasses: (on) => {
    state.glasses = Boolean(on);
    syncHeroGear();
  },
  setChoreography: (idx) => applyChoreographyState(idx),
  setGateOpen: (open) => {
    state.gateOpen = Boolean(open);
  },
  setCameraInspectPreset: (preset = 'wide') => {
    if (preset === 'closeup_front') {
      state.inspectLookingAtCamera = true;
      state.glasses = true;
      syncHeroGear();
      state.heroYaw = 0; // face camera (+Z) for close-up inspection!
      state.camYaw = 0.04;
      state.camPitch = 0.10;
      state.camDist = 2.05;
      state.camTargetSmooth.set(state.heroPos.x, 1.18, state.heroPos.z);
    } else if (preset === 'twin_closeup') {
      state.inspectLookingAtCamera = true;
      state.embodiment = 'twin_audit';
      state.glasses = true;
      syncHeroGear();
      state.heroYaw = 0;
      state.camYaw = 0.0;
      state.camPitch = 0.12;
      state.camDist = 2.65;
      state.camTargetSmooth.set(state.heroPos.x, 1.14, state.heroPos.z);
    } else {
      state.inspectLookingAtCamera = false;
      state.heroYaw = Math.PI;
      state.camYaw = 0.06;
      state.camPitch = 0.22;
      state.camDist = 5.85;
    }
  },
  sampleMotionRig: () => {
    const v9Bones = heroV9 && typeof heroV9.getWorldBonePositions === 'function'
      ? heroV9.getWorldBonePositions()
      : null;
    const cutBones = heroCutout31 && typeof heroCutout31.getWorldBonePositions === 'function'
      ? heroCutout31.getWorldBonePositions()
      : null;
    const imaniActor = castEntries.find((c) => c.id === 'imani');
    const imaniBones = imaniActor?.inst && typeof imaniActor.inst.getWorldBonePositions === 'function'
      ? imaniActor.inst.getWorldBonePositions()
      : null;
    return {
      t: performance.now(),
      heroHead: v9Bones?.head || null,
      heroHandL: v9Bones?.handL || null,
      heroFootL: v9Bones?.footL || null,
      heroWing: v9Bones?.wingTipL || null,
      cutoutHead: cutBones?.head || null,
      cutoutHandL: cutBones?.handL || null,
      imaniHand: imaniBones?.handR || null,
    };
  },
};

// ---------------------------------------------------------------------------
// 12. Main 60 FPS Biomechanical, Multiplane & Diegetic Projection Loop
// ---------------------------------------------------------------------------
let prevTime = performance.now() * 0.001;
const lookAtScratch = new THREE.Vector3();
const heroHeadWorld = new THREE.Vector3();
const actorAnchorScratch = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now() * 0.001;
  const dt = Math.min(0.05, Math.max(0.001, now - prevTime));
  prevTime = now;

  skyUniforms.uTime.value = now;

  // 1. Playable 3rd-Person Hero Movement + Space Evolutionary Wing-Boost Jump & Glide
  const sprint = Boolean(keys.ShiftLeft || keys.ShiftRight);
  const targetMaxSpeed = sprint ? 5.35 : 2.45;

  let moveForward = 0;
  let moveRight = 0;
  if (keys.KeyW || keys.ArrowUp) moveForward += 1;
  if (keys.KeyS || keys.ArrowDown) moveForward -= 1;
  if (keys.KeyD || keys.ArrowRight) moveRight += 1;
  if (keys.KeyA || keys.ArrowLeft) moveRight -= 1;

  const camFwdX = -Math.sin(state.camYaw);
  const camFwdZ = -Math.cos(state.camYaw);
  const camRightX = Math.cos(state.camYaw);
  const camRightZ = -Math.sin(state.camYaw);

  let wishX = camFwdX * moveForward + camRightX * moveRight;
  let wishZ = camFwdZ * moveForward + camRightZ * moveRight;
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen > 0.001) {
    wishX /= wishLen;
    wishZ /= wishLen;
  }

  const gliding = state.heroAirborne && Boolean(keys.Space) && state.wingsMode !== 'off';
  const airSpeedBoost = gliding ? 1.28 : 1.0;
  const desiredVx = wishX * targetMaxSpeed * airSpeedBoost;
  const desiredVz = wishZ * targetMaxSpeed * airSpeedBoost;

  const accel = state.heroAirborne ? 5.5 : 11.5;
  state.heroVel.x += (desiredVx - state.heroVel.x) * Math.min(1, dt * accel);
  state.heroVel.z += (desiredVz - state.heroVel.z) * Math.min(1, dt * accel);
  state.heroGroundSpeed = Math.hypot(state.heroVel.x, state.heroVel.z);

  if (state.heroGroundSpeed > 0.14) {
    state.heroHasWalked = true;
    state.inspectLookingAtCamera = false;
    const targetYaw = Math.atan2(state.heroVel.x, state.heroVel.z);
    let diff = targetYaw - state.heroYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.heroTurnRate = THREE.MathUtils.clamp(diff * 5.0, -3.5, 3.5);
    state.heroYaw += diff * Math.min(1, dt * 9.5);
  } else {
    state.heroTurnRate *= Math.max(0, 1 - dt * 8);
  }

  // Vertical jump & evolutionary wing glide physics
  if (state.heroAirborne) {
    const gravity = gliding && state.heroVel.y < 0.4 ? 3.2 : 14.2;
    state.heroVel.y -= gravity * dt;
    state.heroPos.y += state.heroVel.y * dt;
    if (gliding) {
      state.wingFlapBoost = Math.max(state.wingFlapBoost, 0.78);
    }
    if (state.heroPos.y <= 0) {
      state.heroPos.y = 0;
      state.heroVel.y = 0;
      state.heroAirborne = false;
    }
  }

  state.heroPos.x += state.heroVel.x * dt;
  state.heroPos.z += state.heroVel.z * dt;

  // Courtyard & Atlantis Gate Collision / Walk-Through Portal
  const maxZ = 9.2;
  const minZClosed = -8.4;
  if (state.heroPos.z > maxZ) state.heroPos.z = maxZ;
  if (!state.gateOpen && state.heroPos.z < minZClosed && Math.abs(state.heroPos.x) < 3.8) {
    state.heroPos.z = minZClosed;
  }
  if (state.gateOpen && state.heroPos.z < -10.8 && Math.abs(state.heroPos.x) < 2.6) {
    navigateToCityRoute('../atlantis/');
    return;
  }
  const radialR = Math.hypot(state.heroPos.x, state.heroPos.z + 1.5);
  if (radialR > 13.5) {
    const scaleBack = 13.5 / radialR;
    state.heroPos.x *= scaleBack;
    state.heroPos.z = -1.5 + (state.heroPos.z + 1.5) * scaleBack;
  }

  state.wingFlapBoost = Math.max(0, state.wingFlapBoost - dt * 0.85);

  heroRootGroup.position.copy(state.heroPos);
  heroRootGroup.rotation.y = state.heroYaw;
  // Subtle aerodynamic turn/glide lean
  heroRootGroup.rotation.z = THREE.MathUtils.clamp(-state.heroTurnRate * 0.045, -0.14, 0.14);
  heroRootGroup.rotation.x = state.heroAirborne ? THREE.MathUtils.clamp(state.heroGroundSpeed * 0.04, 0, 0.18) : 0;

  heroHeadWorld.set(state.heroPos.x, state.heroPos.y + 1.58, state.heroPos.z);

  // 2. Update Playable Hero Rigs (V9 Skinned + 31-Part Brass-Pivot Cutout)
  if (heroV9) {
    if (state.heroAirborne) {
      if (heroV9.playAction) heroV9.playAction('wing-glide', 0.18);
    } else {
      if (heroV9.setMoveSpeed) heroV9.setMoveSpeed(state.heroGroundSpeed);
      if (state.heroGroundSpeed <= 0.12 && heroV9.playAction) {
        heroV9.playAction(CHOREO_STATES[state.choreoIdx].heroIdle, 0.3);
      }
    }
    // Gaze toward camera during close-up inspection, or toward cast within frontal cone
    let heroGazeTarget = null;
    if (state.inspectLookingAtCamera) {
      heroGazeTarget = camera.position;
    } else {
      let nearestD = 5.2;
      const hFwdX = Math.sin(state.heroYaw);
      const hFwdZ = Math.cos(state.heroYaw);
      for (const c of castEntries) {
        const dx = c.group.position.x - state.heroPos.x;
        const dz = c.group.position.z - state.heroPos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.4 && d < nearestD) {
          const dot = (dx * hFwdX + dz * hFwdZ) / d;
          if (dot > 0.45) {
            nearestD = d;
            heroGazeTarget = lookAtScratch.set(c.group.position.x, 1.55, c.group.position.z);
          }
        }
      }
    }
    heroV9.update(dt, {
      lookTargetVec3: heroGazeTarget,
      moveSpeed: state.heroGroundSpeed,
      turnRate: state.heroTurnRate,
      speaking: false,
      wingFlapBoost: state.wingFlapBoost + (state.choreoIdx === 4 ? 0.55 : 0),
    });
  }

  if (heroCutout31) {
    heroCutout31.update(dt, {
      lookTargetVec3: null,
      moveSpeed: state.heroGroundSpeed,
      turnRate: state.heroTurnRate,
      speaking: false,
      wingFlapBoost: state.wingFlapBoost + (state.choreoIdx === 4 ? 0.55 : 0),
    });
  }

  // 3. Update All Courtyard Ensemble Actors + Turn-Taking Duet Speech + Gaze Tracking
  if (state.replyTimer > 0) {
    state.replyTimer -= dt;
    if (state.replyTimer <= 0 && state.pendingResponder) {
      const nextSpeaker = state.pendingResponder;
      state.pendingResponder = null;
      triggerActorDuetSpeech(nextSpeaker, true);
    }
  }

  const speakingElapsed = now - state.speakingStart;
  if (state.speakingActor && speakingElapsed > state.speakingDur) {
    const prev = state.speakingActor;
    state.speakingActor = null;
    if (prev.inst?.playAction) {
      prev.inst.playAction(CHOREO_STATES[state.choreoIdx].castClips[prev.id] || prev.defaultClip, 0.3);
    }
  }

  for (const actor of castEntries) {
    const distToHero = actor.group.position.distanceTo(state.heroPos);
    const isSpeaking = state.speakingActor === actor;
    const talkProg = isSpeaking ? THREE.MathUtils.clamp(speakingElapsed / state.speakingDur, 0, 1) : 0;

    // Smooth yaw interpolation toward targetYaw (or gently return to baseYaw)
    if (!isSpeaking && distToHero > 4.5) {
      actor.targetYaw = actor.baseYaw;
    } else if (distToHero < 3.2) {
      actor.targetYaw = Math.atan2(
        state.heroPos.x - actor.group.position.x,
        state.heroPos.z - actor.group.position.z
      );
    }
    let yDiff = actor.targetYaw - actor.group.rotation.y;
    while (yDiff > Math.PI) yDiff -= Math.PI * 2;
    while (yDiff < -Math.PI) yDiff += Math.PI * 2;
    actor.group.rotation.y += yDiff * Math.min(1, dt * 4.5);

    const gazeTarget = distToHero < 7.2 ? heroHeadWorld : null;
    if (actor.inst?.update) {
      actor.inst.update(dt, {
        lookTargetVec3: gazeTarget,
        moveSpeed: actor.activeAction === 'walk' || actor.activeAction === 'carry' ? 0.0 : 0.0,
        speaking: isSpeaking,
        talkText: isSpeaking ? state.speakingLine : '',
        talkProgress: talkProg,
        wingFlapBoost: state.choreoIdx === 4 ? 0.5 : 0.1,
      });
    }
  }

  // 4. Animate Monumental Winged Marble Gate, Pedestal Wings, Metronome & Multiplane Waves
  const targetGateAngle = state.gateOpen ? 1.24 : 0.16;
  state.gateAngle += (targetGateAngle - state.gateAngle) * Math.min(1, dt * 3.2);
  gateLeafLeftPivot.rotation.y = -state.gateAngle;
  gateLeafRightPivot.rotation.y = state.gateAngle;
  gatePortalLight.intensity = 24 + state.gateAngle * 22 + Math.sin(now * 2.4) * 3.5;

  const pedFlap = state.wingsMode === 'off' ? 0.05 : Math.sin(now * 3.1) * 0.24;
  pedestalMiniWingL.rotation.y = -0.18 - pedFlap;
  pedestalMiniWingR.rotation.y = 0.18 + pedFlap;

  const bpm = CHOREO_STATES[state.choreoIdx].bpm || 96;
  metronomePendulum.rotation.z = Math.sin(now * (bpm / 60) * Math.PI) * 0.44;

  for (const mp of state.multiplaneMeshes) {
    if (mp.userData.animRole && mp.userData.animRole.includes('wave')) {
      mp.position.x = mp.userData.baseX + Math.sin(now * 1.4 + mp.userData.phaseOff) * 0.28;
      mp.position.y = mp.userData.baseY + Math.cos(now * 1.9 + mp.userData.phaseOff) * 0.05;
    }
  }

  // 5. Smooth Damped 3rd-Person Chase / Orbit Camera
  const desiredTargetY = state.heroPos.y + (state.camDist < 2.8 ? 1.24 : 1.38);
  state.camTargetSmooth.x += (state.heroPos.x - state.camTargetSmooth.x) * Math.min(1, dt * 9.0);
  state.camTargetSmooth.y += (desiredTargetY - state.camTargetSmooth.y) * Math.min(1, dt * 9.0);
  state.camTargetSmooth.z += (state.heroPos.z - state.camTargetSmooth.z) * Math.min(1, dt * 9.0);

  const horizR = Math.cos(state.camPitch) * state.camDist;
  const camX = state.camTargetSmooth.x + Math.sin(state.camYaw) * horizR;
  const camY = Math.max(0.28, state.camTargetSmooth.y + Math.sin(state.camPitch) * state.camDist);
  const camZ = state.camTargetSmooth.z + Math.cos(state.camYaw) * horizR;
  camera.position.set(camX, camY, camZ);
  camera.lookAt(state.camTargetSmooth);

  // 6. Diegetic Floating Speaker Duet Lyric & Unboxed 1-Line Hover Whisper
  if (state.speakingActor && state.speakingLine) {
    const sp = state.speakingActor;
    speakerFloorRing.visible = true;
    speakerFloorRing.position.set(sp.group.position.x, 0.03, sp.group.position.z);
    actorAnchorScratch.set(sp.group.position.x, 2.04, sp.group.position.z);
    const prj = projectWorldLabel(camera, actorAnchorScratch, renderer.domElement);
    if (prj.visible) {
      speakerLyricEl.style.display = 'block';
      speakerLyricEl.style.left = `${Math.round(prj.left)}px`;
      speakerLyricEl.style.top = `${Math.round(prj.top)}px`;
      speakerLyricEl.innerHTML = `<span class="sp-tag">${state.speakingLabel}</span>${state.speakingLine}`;
    } else {
      speakerLyricEl.style.display = 'none';
    }
  } else {
    speakerFloorRing.visible = false;
    speakerLyricEl.style.display = 'none';
  }

  if (hoveredInteract) {
    const anchor = hoveredInteract.isHero
      ? actorAnchorScratch.set(state.heroPos.x, state.heroPos.y + 2.08, state.heroPos.z)
      : hoveredInteract.anchorWorld;
    const p = projectWorldLabel(camera, anchor, renderer.domElement);
    if (p.visible) {
      whisperEl.style.display = 'block';
      whisperEl.style.left = `${Math.max(140, Math.min(window.innerWidth - 140, Math.round(p.left)))}px`;
      whisperEl.style.top = `${Math.max(28, Math.min(window.innerHeight - 24, Math.round(p.top)))}px`;
      whisperEl.innerHTML = `${hoveredInteract.getLead()}<span class="wh-meta">— ${hoveredInteract.getMeta()}</span>`;
    } else {
      whisperEl.style.display = 'none';
    }
  } else {
    whisperEl.style.display = 'none';
  }

  // 7. Update 5-Bus Freesound Spatial Audio & Diegetic Tripod/Portal Rig
  suite.updateAudio(dt, {
    isInside: false,
    nightMix: 0.72,
    submerged: false,
    moving: state.heroGroundSpeed > 0.2 && !state.heroAirborne,
    projectorDist: 40,
    projectorWet: true,
  });

  if (worldRig && typeof worldRig.update === 'function') {
    worldRig.update(state.heroHasWalked ? state.heroPos : null);
  }

  renderer.render(scene, camera);
}

bootStage().then(() => {
  animate();
});
