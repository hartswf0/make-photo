import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  mountWebGLShaderSuite,
  createWorldPortalAndTripod,
  projectWorldLabel,
} from '../shader-suite-bar.js';
import {
  savePilotState,
  subscribePilotState,
  applyPilotUrlHash,
  formatPilotHash,
} from '../design-room/pilot-state.js';

// Zero-dependency spherical Orbit + Pan + Zoom controller (zero missing addon 404s)
class SimpleOrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3();
    this.enabled = true;
    this.minDistance = 4;
    this.maxDistance = 6500;
    this.maxPolarAngle = Math.PI * 0.492;
    this._spherical = new THREE.Spherical();
    this._offset = new THREE.Vector3();
    this._drag = null;

    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    domElement.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      this._drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey };
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.enabled || !this._drag) return;
      const dx = e.clientX - this._drag.x;
      const dy = e.clientY - this._drag.y;
      this._drag.x = e.clientX;
      this._drag.y = e.clientY;

      this._offset.copy(this.camera.position).sub(this.target);
      this._spherical.setFromVector3(this._offset);

      if (this._drag.pan) {
        const panScale = this._spherical.radius * 0.0014;
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
        const up = new THREE.Vector3(0, 1, 0);
        this.target.addScaledVector(right, -dx * panScale);
        this.target.addScaledVector(up, dy * panScale);
      } else {
        this._spherical.theta -= dx * 0.0055;
        this._spherical.phi = THREE.MathUtils.clamp(
          this._spherical.phi - dy * 0.0045,
          0.08,
          this.maxPolarAngle
        );
      }
      this._offset.setFromSpherical(this._spherical);
      this.camera.position.copy(this.target).add(this._offset);
      this.camera.lookAt(this.target);
    });
    window.addEventListener('pointerup', () => { this._drag = null; });
    domElement.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this._offset.copy(this.camera.position).sub(this.target);
        this._spherical.setFromVector3(this._offset);
        const factor = e.deltaY > 0 ? 1.12 : 0.89;
        this._spherical.radius = THREE.MathUtils.clamp(
          this._spherical.radius * factor,
          this.minDistance,
          this.maxDistance
        );
        this._offset.setFromSpherical(this._spherical);
        this.camera.position.copy(this.target).add(this._offset);
        this.camera.lookAt(this.target);
      },
      { passive: false }
    );
  }

  update() {
    if (this.enabled) {
      this.camera.lookAt(this.target);
    }
  }
}

const $ = (id) => document.getElementById(id);
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

// ---------------------------------------------------------------------------
// 1. Hydrate Severn Pilot State & Load Bundled Upstream Data
// ---------------------------------------------------------------------------
let pilot = applyPilotUrlHash();
let shaderSuite = null;

const [cityMeta, structuresData, cityLayers, moodAtlas, mmElsewhere] = await Promise.all([
  fetch('./data/city.json').then((r) => r.json()),
  fetch('./data/structures.json').then((r) => r.json()),
  fetch('./data/city_layers.json').then((r) => r.json()),
  fetch('./data/mood_atlas.json').then((r) => r.json()),
  fetch('./data/moviemap_elsewhere.json').then((r) => r.json()),
]);

const W = cityLayers.W; // 8000
const H = cityLayers.H; // 6000
const NX = cityLayers.nx;
const NY = cityLayers.ny;
const CELL = cityLayers.cell;
const H_GRID = cityLayers.height;
const C_GRID = cityLayers.cover;

function groundAt(x, z) {
  const fx = THREE.MathUtils.clamp(x / CELL, 0, NX - 1.001);
  const fz = THREE.MathUtils.clamp(z / CELL, 0, NY - 1.001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const o = j * NX + i;
  const h00 = H_GRID[o] / 10;
  const h10 = H_GRID[o + 1] / 10;
  const h01 = H_GRID[o + NX] / 10;
  const h11 = H_GRID[o + NX + 1] / 10;
  return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
}

// Severn Pilot Anchor in City3D coordinates (Poem 01: 2089.9, 2319.3)
const SEVERN_POEM = cityMeta.poems.find((p) => p.num === '01') || { x: 2089.9, y: 2319.3, title: 'Out of Life' };
const SEVERN_POS = {
  x: SEVERN_POEM.x,
  z: SEVERN_POEM.y,
  y: Math.max(groundAt(SEVERN_POEM.x, SEVERN_POEM.y), 0.6),
};
// Nongeographic Black Anchor (kept explicitly outside road network)
const BLACK_ANCHOR = { x: 860, z: 5180, r: 95 };

// ---------------------------------------------------------------------------
// 2. Renderer, Scene, Camera, OrbitControls & Crisp WEAVE Sky
// ---------------------------------------------------------------------------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0c1f38');
scene.fog = new THREE.FogExp2('#102644', 0.00042);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.4, 14000);
const controls = new SimpleOrbitControls(camera, canvas);
controls.maxPolarAngle = Math.PI * 0.492;
controls.minDistance = 4;
controls.maxDistance = 6500;

const skyUniforms = {
  uTop: { value: new THREE.Color('#08182e') },
  uMid: { value: new THREE.Color('#0f2c52') },
  uHor: { value: new THREE.Color('#2d547c') },
  uSunDir: { value: new THREE.Vector3(-0.55, 0.25, -0.78).normalize() },
  uSunCol: { value: new THREE.Color('#ffbc75') },
  uTime: { value: 0 },
};

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(11500, 36, 20),
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
      uniform vec3 uTop, uMid, uHor, uSunDir, uSunCol;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float y = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(uHor, uMid, smoothstep(-0.02, 0.26, y));
        col = mix(col, uTop, smoothstep(0.24, 0.85, y));
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunCol * (pow(sd, 260.0) * 1.2 + pow(sd, 16.0) * 0.25);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
);
skyDome.frustumCulled = false;
scene.add(skyDome);

const hemiLight = new THREE.HemisphereLight('#6898cf', '#1b2330', 1.18);
scene.add(hemiLight);
const keyLight = new THREE.DirectionalLight('#ffc07d', 1.55);
keyLight.position.set(1600, 900, 1400);
scene.add(keyLight);
scene.add(keyLight.target);

// ---------------------------------------------------------------------------
// 3. Crisp Non-Grainy Procedural Architectural Textures
// ---------------------------------------------------------------------------
function makeCrispFacadeTextures() {
  const s = 512;
  const dc = document.createElement('canvas');
  dc.width = dc.height = s;
  const ctx = dc.getContext('2d');

  const ec = document.createElement('canvas');
  ec.width = ec.height = s;
  const ectx = ec.getContext('2d');
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, s, s);

  // Smooth cornice-banded masonry (zero noisy grain!)
  ctx.fillStyle = '#a99786';
  ctx.fillRect(0, 0, s, s);
  const cols = 8;
  const rows = 8;
  const cw = s / cols;
  const rh = s / rows;

  for (let r = 0; r < rows; r++) {
    const y0 = r * rh;
    // Crisp limestone cornice belt
    ctx.fillStyle = '#dfd6c7';
    ctx.fillRect(0, y0, s, 5);
    ctx.fillStyle = '#5c534b';
    ctx.fillRect(0, y0 + 5, s, 2);

    for (let c = 0; c < cols; c++) {
      const wx = c * cw + 12;
      const wy = y0 + 13;
      const ww = cw - 24;
      const wh = rh - 21;

      ctx.fillStyle = '#e5ddd0';
      ctx.fillRect(wx - 2, wy - 3, ww + 4, 3);
      ctx.fillRect(wx - 2, wy + wh, ww + 4, 3);

      const lit = ((r * 11 + c * 7) % 9) < 3;
      const cyan = ((r * 19 + c * 5) % 27) === 0;
      ctx.fillStyle = lit ? (cyan ? '#2ab8f0' : '#f5be7d') : '#162538';
      ctx.fillRect(wx, wy, ww, wh);

      ctx.fillStyle = '#2d3744';
      ctx.fillRect(wx + ww * 0.5 - 1, wy, 2, wh);
      ctx.fillRect(wx, wy + wh * 0.48, ww, 2);

      if (lit) {
        ectx.fillStyle = cyan ? '#18b4ff' : '#ffb260';
        ectx.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);
      }
    }
  }

  const map = new THREE.CanvasTexture(dc);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const emissiveMap = new THREE.CanvasTexture(ec);
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;

  return { map, emissiveMap };
}

function makeCrispStreetTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#202833';
  ctx.fillRect(0, 0, 256, 256);
  // Crisp granite curbs
  ctx.fillStyle = '#c8bfb0';
  ctx.fillRect(0, 0, 20, 256);
  ctx.fillRect(236, 0, 20, 256);
  ctx.fillStyle = '#121820';
  ctx.fillRect(20, 0, 4, 256);
  ctx.fillRect(232, 0, 4, 256);
  // Crisp brass lane dashes
  ctx.fillStyle = '#e5b363';
  for (let y = 14; y < 256; y += 64) ctx.fillRect(125, y, 6, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

const facadeTex = makeCrispFacadeTextures();
const streetTex = makeCrispStreetTexture();

// Shared Materials
const matMasonry = new THREE.MeshStandardMaterial({
  map: facadeTex.map,
  emissiveMap: facadeTex.emissiveMap,
  emissive: '#ffffff',
  emissiveIntensity: 0.65,
  vertexColors: true,
  roughness: 0.72,
  metalness: 0.08,
});
const matTerraceStone = new THREE.MeshStandardMaterial({
  map: facadeTex.map,
  color: '#ded5c5',
  roughness: 0.58,
  metalness: 0.06,
});
const matCornice = new THREE.MeshStandardMaterial({ color: '#e6dfd1', roughness: 0.55 });
const matLightwellGlass = new THREE.MeshStandardMaterial({
  color: '#4ea8d8',
  emissive: '#196f9c',
  emissiveIntensity: 0.75,
  roughness: 0.14,
  metalness: 0.78,
});
const matCyanBand = new THREE.MeshStandardMaterial({
  color: '#18b4ff',
  emissive: '#1498de',
  emissiveIntensity: 1.5,
  roughness: 0.2,
});
const matSodiumGlow = new THREE.MeshStandardMaterial({
  color: '#fa8d15',
  emissive: '#e8760c',
  emissiveIntensity: 1.45,
  roughness: 0.25,
});
const matRoofGarden = new THREE.MeshStandardMaterial({ color: '#396b42', roughness: 0.85 });
const matBrass = new THREE.MeshStandardMaterial({ color: '#cbb182', roughness: 0.32, metalness: 0.75 });
const matTimber = new THREE.MeshStandardMaterial({ color: '#5c3824', roughness: 0.58 });

// ---------------------------------------------------------------------------
// 4. World Groups: Terrain, Shimmering Sea, Roads, Buildings, Terraced Structures
// ---------------------------------------------------------------------------
const cityWorldGroup = new THREE.Group();
scene.add(cityWorldGroup);

// Terrain Mesh
const COVER_HEX = [
  '#0d253d', '#c5b494', '#4f6448', '#687452', '#35543a',
  '#7b7368', '#6c6864', '#63605e', '#767470', '#847968',
  '#566d46', '#2a2725', '#5e6e54', '#5c6268', '#4c5056',
];
{
  const pos = new Float32Array(NX * NY * 3);
  const col = new Float32Array(NX * NY * 3);
  const cTmp = new THREE.Color();
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      const x = i * CELL;
      const z = j * CELL;
      const y = H_GRID[k] / 10;
      pos[k * 3] = x;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = z;
      cTmp.set(COVER_HEX[C_GRID[k]] || '#4f5862');
      if (y < 0) cTmp.set('#0a2138');
      col[k * 3] = cTmp.r;
      col[k * 3 + 1] = cTmp.g;
      col[k * 3 + 2] = cTmp.b;
    }
  }
  const idx = new Uint32Array((NX - 1) * (NY - 1) * 6);
  let p = 0;
  for (let j = 0; j < NY - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i;
      idx[p++] = a; idx[p++] = a + NX; idx[p++] = a + 1;
      idx[p++] = a + 1; idx[p++] = a + NX; idx[p++] = a + NX + 1;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  cityWorldGroup.add(
    new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.12 }))
  );
}

// Shimmering Sea Plane + +4m Flood Datum Salt Ring Plane
const waterUniforms = {
  uTime: { value: 0 },
  uDeep: { value: new THREE.Color('#071a32') },
  uShallow: { value: new THREE.Color('#134872') },
  uCyan: { value: new THREE.Color('#18b4ff') },
};
const seaMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(W * 2.2, H * 2.2),
  new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    vertexShader: `
      varying vec3 vWP;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep, uShallow, uCyan;
      varying vec3 vWP;
      void main() {
        float w1 = sin(vWP.x * 0.08 + uTime * 1.6) * 0.5 + 0.5;
        float w2 = cos(vWP.z * 0.09 - uTime * 1.3) * 0.5 + 0.5;
        vec3 v = normalize(cameraPosition - vWP);
        float fres = pow(1.0 - max(v.y, 0.0), 3.0);
        vec3 col = mix(uDeep, uShallow, clamp(w1 * 0.45 + fres * 0.55, 0.0, 1.0));
        col += uCyan * smoothstep(0.86, 0.99, w1 * w2) * 0.35;
        gl_FragColor = vec4(col, 0.92);
      }
    `,
  })
);
seaMesh.rotation.x = -Math.PI / 2;
seaMesh.position.set(W * 0.5, -0.1, H * 0.5);
scene.add(seaMesh);

// +4m Flood Datum Salt Line Band + Physical Translucent +4.00m Flood Water Plane
const floodUniforms = {
  uTime: { value: 0 },
  uOpacity: { value: 0.44 },
};
const floodWaterMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(W * 1.35, H * 1.35),
  new THREE.ShaderMaterial({
    uniforms: floodUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec3 vWP;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vWP;
      void main() {
        float r1 = sin(vWP.x * 0.055 + uTime * 1.4) * 0.5 + 0.5;
        float r2 = cos(vWP.z * 0.062 - uTime * 1.1) * 0.5 + 0.5;
        vec3 col = mix(vec3(0.06, 0.30, 0.48), vec3(0.11, 0.70, 0.98), clamp(r1 * 0.6 + r2 * 0.4, 0.0, 1.0));
        float glint = smoothstep(0.82, 0.98, r1 * r2);
        col += vec3(0.75, 0.93, 1.0) * glint * 0.35;
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
  })
);
floodWaterMesh.rotation.x = -Math.PI / 2;
floodWaterMesh.position.set(W * 0.5, 4.0, H * 0.5);
cityWorldGroup.add(floodWaterMesh);

const saltDatumPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(W, H),
  new THREE.MeshBasicMaterial({
    color: '#efeadd',
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
);
saltDatumPlane.rotation.x = -Math.PI / 2;
saltDatumPlane.position.set(W * 0.5, 4.02, H * 0.5);
cityWorldGroup.add(saltDatumPlane);

const mapsPickables = [];
const matInvisibleHit = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  side: THREE.DoubleSide,
});
function addMapsTarget(mesh, info) {
  mesh.userData.mapsDiegetic = info;
  mapsPickables.push(mesh);
  return mesh;
}

// Crisp Curbed Roads (excluding nongeographic Black zone)
{
  const R_WIDTHS = [9.5, 16, 22, 14, 34];
  const P = [];
  const UV = [];
  const I = [];
  let vOff = 0;
  for (const [cls, , flat] of cityLayers.roads) {
    const rw = R_WIDTHS[cls] || 11;
    let cnt = 0;
    let dist = 0;
    for (let i = 0; i < flat.length; i += 2) {
      const x = flat[i];
      const z = flat[i + 1];
      if (Math.hypot(x - BLACK_ANCHOR.x, z - BLACK_ANCHOR.z) < BLACK_ANCHOR.r) continue;
      const px = flat[Math.max(0, i - 2)];
      const pz = flat[Math.max(1, i - 1)];
      const nx = flat[Math.min(flat.length - 2, i + 2)];
      const nz = flat[Math.min(flat.length - 1, i + 3)];
      let dx = nx - px;
      let dz = nz - pz;
      const L = Math.hypot(dx, dz) || 1;
      dx /= L; dz /= L;
      if (cnt > 0) dist += Math.hypot(x - px, z - pz);
      const y = Math.max(groundAt(x, z), 0.3) + 0.24;
      P.push(x - dz * rw * 0.5, y, z + dx * rw * 0.5);
      P.push(x + dz * rw * 0.5, y, z - dx * rw * 0.5);
      UV.push(0, dist / 16, 1, dist / 16);
      if (cnt > 0) {
        const k = vOff + cnt * 2;
        I.push(k - 2, k, k - 1, k - 1, k, k + 1);
      }
      cnt++;
    }
    vOff += cnt * 2;
  }
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  rGeo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  rGeo.setIndex(I);
  rGeo.computeVertexNormals();
  cityWorldGroup.add(
    new THREE.Mesh(
      rGeo,
      new THREE.MeshStandardMaterial({
        map: streetTex,
        roughness: 0.24,
        metalness: 0.16,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    )
  );
}

// Instanced City3D Buildings + Cornice Caps + Era Filtering
const STYLE_COLORS = [
  '#b87860', '#9f5848', '#dfd7c8', '#7d8c9c',
  '#d2bfa4', '#5c7c84', '#75685e', '#a89a82',
];
const bldRaw = cityLayers.buildings;
const bldBoxGeo = new THREE.BoxGeometry(1, 1, 1);
bldBoxGeo.translate(0, 0.5, 0);
const bldInstMesh = new THREE.InstancedMesh(bldBoxGeo, matMasonry, bldRaw.length);
bldInstMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

const corniceGeo = new THREE.BoxGeometry(1.06, 1, 1.06);
corniceGeo.translate(0, 0.5, 0);
const corniceInstMesh = new THREE.InstancedMesh(corniceGeo, matCornice, bldRaw.length);
corniceInstMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
cityWorldGroup.add(bldInstMesh, corniceInstMesh);

const bldInstanceOwners = [];

function updateBuildingsForEra(era, extraClearFootprints = []) {
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const upY = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();

  let count = 0;
  bldInstanceOwners.length = 0;

  for (let i = 0; i < bldRaw.length; i++) {
    const [x, z, w, d, rot, rawH, st, born, ruin, reuse, , gz] = bldRaw[i];
    if (born > era) continue;
    // Clear around The Severn hero, Harbor Quay Tide Gates, & terraced structure footprints
    if (Math.hypot(x - SEVERN_POS.x, z - SEVERN_POS.z) < 28) continue;
    if (Math.hypot(x - (SEVERN_POS.x - 24), z - (SEVERN_POS.z + 18)) < 18) continue;
    if (x > 2685 && x < 2785 && z > 2135 && z < 2480) continue;
    if (extraClearFootprints.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)) continue;

    // Rescale excessive generic tower heights into believable terraced harbor fabric
    let h = st === 3 ? Math.min(rawH, 18 + rawH * 0.42) : Math.min(rawH, 32);
    // Step down waterfront terraces toward the Harbor Quay (x = 2728, z = 2135..2480) so all 6 Tide Gates & sea stay unobstructed
    if (x > 2240 && x < 2700 && z > 2135 && z < 2480) {
      const quayCap = Math.max(5.5, ((2700 - x) / 460) * 14.5);
      h = Math.min(h, quayCap);
    }
    if (ruin <= era && !(era >= 5 && reuse)) h *= 0.48;

    q.setFromAxisAngle(upY, -rot);
    m4.compose(v.set(x, gz - 1.5, z), q, sc.set(w, h + 1.5, d));
    bldInstMesh.setMatrixAt(count, m4);
    col.set(STYLE_COLORS[st % STYLE_COLORS.length]);
    col.offsetHSL(0, 0, ((i % 9) - 4) * 0.015);
    bldInstMesh.setColorAt(count, col);

    // Crisp stone cornice cap
    m4.compose(v.set(x, gz + h, z), q, sc.set(w, 0.55, d));
    corniceInstMesh.setMatrixAt(count, m4);

    bldInstanceOwners[count] = i;
    count++;
  }

  bldInstMesh.count = count;
  bldInstMesh.instanceMatrix.needsUpdate = true;
  if (bldInstMesh.instanceColor) bldInstMesh.instanceColor.needsUpdate = true;
  corniceInstMesh.count = count;
  corniceInstMesh.instanceMatrix.needsUpdate = true;
}

// Multi-Species Layered 3D Trees
{
  const makeCol = (geo, hex) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
  };
  const treeCrownGeo = mergeGeometries([
    makeCol(new THREE.CylinderGeometry(0.18, 0.30, 3.4, 6).translate(0, 1.7, 0), '#4a3626'),
    makeCol(new THREE.IcosahedronGeometry(2.3, 1).translate(0, 4.9, 0), '#35683d'),
    makeCol(new THREE.IcosahedronGeometry(1.7, 1).translate(1.1, 5.7, 0.5), '#467d49'),
    makeCol(new THREE.IcosahedronGeometry(1.6, 1).translate(-1.0, 5.5, -0.6), '#2b5633'),
  ]);
  const tMesh = new THREE.InstancedMesh(
    treeCrownGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84 }),
    cityLayers.trees.length
  );
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const upY = new THREE.Vector3(0, 1, 0);
  let tc = 0;
  for (let i = 0; i < cityLayers.trees.length; i++) {
    const [x, z, , scaleVal] = cityLayers.trees[i];
    const gy = groundAt(x, z);
    if (gy < 0.4 || Math.hypot(x - SEVERN_POS.x, z - SEVERN_POS.z) < 22) continue;
    const s = Math.max(0.65, Math.min(1.5, scaleVal));
    q.setFromAxisAngle(upY, (i * 1.9) % 6.28);
    m4.compose(v.set(x, gy - 0.15, z), q, sc.set(s, s, s));
    tMesh.setMatrixAt(tc++, m4);
  }
  tMesh.count = tc;
  tMesh.instanceMatrix.needsUpdate = true;
  cityWorldGroup.add(tMesh);
}

// ---------------------------------------------------------------------------
// 5. Terraced Remastered Structures (Rescaling Unbelievable Megablocks!)
// ---------------------------------------------------------------------------
const terracedGroup = new THREE.Group();
cityWorldGroup.add(terracedGroup);

function buildTerracedStructure(s) {
  const g = new THREE.Group();
  // Rescale giant upstream radii/heights into believable human-scale terraced masonry + glass lightwells!
  const baseW = THREE.MathUtils.clamp((s.r || s.R || 24) * 0.72, 16, 46);
  const totalH = THREE.MathUtils.clamp((s.H || s.lift || 42) * 0.52, 18, 64);
  const tiers = Math.max(3, Math.min(6, s.tiers || s.seg || 4));
  const tierH = totalH / tiers;

  for (let k = 0; k < tiers; k++) {
    const frac = 1 - k * 0.16;
    const w = baseW * frac;
    const y = k * tierH;
    const wallT = Math.max(3.2, w * 0.22);

    // 4 perimeter masonry wings framing a central open glass-lined lightwell!
    const wings = [
      [0, (w - wallT) * 0.5, w, wallT],
      [0, -(w - wallT) * 0.5, w, wallT],
      [(w - wallT) * 0.5, 0, wallT, w - wallT * 2],
      [-(w - wallT) * 0.5, 0, wallT, w - wallT * 2],
    ];
    for (const [wx, wz, sx, sz] of wings) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, tierH * 0.92, Math.max(1.5, sz)), matTerraceStone);
      m.position.set(wx, y + tierH * 0.46, wz);
      g.add(m);
    }

    // Interior glass lightwell core visible from street & terraces
    const wellW = Math.max(3.0, w - wallT * 2.05);
    const well = new THREE.Mesh(new THREE.BoxGeometry(wellW, tierH * 0.90, wellW), matLightwellGlass);
    well.position.set(0, y + tierH * 0.45, 0);
    g.add(well);

    // Projecting limestone cornice + planted setback balustrade
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 1.1, 0.55, w + 1.1), matCornice);
    cornice.position.set(0, y + tierH * 0.94, 0);
    g.add(cornice);

    if (k > 0) {
      const planter = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.45, 1.4), matRoofGarden);
      planter.position.set(0, y + 0.24, w * 0.5 + 0.5);
      g.add(planter);
    }
  }

  // Selective electric-cyan water/signal crown ring
  const crown = new THREE.Mesh(new THREE.BoxGeometry(baseW * 0.48, 0.45, baseW * 0.48), matCyanBand);
  crown.position.set(0, totalH + 0.35, 0);
  g.add(crown);

  g.userData = { structure: s, provenance: 'inferred', totalH };
  return g;
}

function rebuildStructuresVariant(variantIdx, era) {
  terracedGroup.clear();
  const extraFootprints = [];
  if (variantIdx < 0 || !structuresData.variants[variantIdx]) {
    updateBuildingsForEra(era, []);
    return;
  }
  const v = structuresData.variants[variantIdx];
  for (const s of v.structures) {
    if (s.era && s.era[0] > era) continue;
    const gx = s.x;
    const gz = s.y;
    const gy = Math.max(groundAt(gx, gz), 0.3);
    const meshG = buildTerracedStructure(s);
    meshG.position.set(gx, gy, gz);
    meshG.rotation.y = -(s.rot || 0);
    terracedGroup.add(meshG);
    extraFootprints.push([gx, gz, Math.min(48, (s.r || 28) * 0.85 + 10)]);
  }
  updateBuildingsForEra(era, extraFootprints);
}

// Hand-Modeled Landmarks + Severn Pilot Hero Building + Bekele (Anny V8)
const severnAtlas = {
  doorPivot: null,
  doorAngle: pilot.doorOpen ? -Math.PI * 0.58 : 0,
  bekeleActor: null,
  playerActor: null,
  acousticRings: [],
};

function makeParcelProp() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.32), new THREE.MeshStandardMaterial({ color: '#b99362' })));
  const can = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.24), matCyanBand);
  can.position.set(0.32, 0.04, 0);
  g.add(can);
  return g;
}

function spawnAtlasAnny(archetype, coatHex, x, y, z, ry = 0) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = ry;
  const proxy = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.86, 10), new THREE.MeshStandardMaterial({ color: coatHex }));
  body.position.y = 1.08;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshStandardMaterial({ color: '#845439' }));
  head.position.y = 1.65;
  proxy.add(body, head);
  root.add(proxy);

  const parcel = makeParcelProp();
  parcel.position.set(0.26, 1.05, -0.25);
  parcel.visible = false;
  root.add(parcel);
  scene.add(root);

  const rec = { root, proxy, parcel, v8: null };
  if (typeof window !== 'undefined' && window.AnnyHumanV7 && window.AnnyHumanV7.createCharacter) {
    window.AnnyHumanV7.createCharacter({
      THREE,
      loader: gltfLoader,
      archetype,
      assetBaseUrl: '../../abyssinian-highlands/human-forge/assets',
      clipsBaseUrl: '../../motion-pipeline/mesh2motion/clips',
      clothed: true,
      groundY: y,
      preloadClips: ['idle', 'idle-talking'],
      initialClip: 'idle',
    })
      .then((inst) => {
        if (!inst) return;
        inst.root.position.set(0, 0, 0);
        inst.root.rotation.set(0, Math.PI, 0);
        root.add(inst.root);
        proxy.visible = false;
        rec.v8 = inst;
        inst.setGroundY(root.position.y);
      })
      .catch(() => {});
  }
  return rec;
}

{
  // Build The Severn Pilot (20m x 12m declared envelope + vestibule + operable door + curb cruiser)
  const g = new THREE.Group();
  g.position.set(SEVERN_POS.x, SEVERN_POS.y, SEVERN_POS.z);
  const brick = new THREE.MeshStandardMaterial({ map: facadeTex.map, color: '#a05244', roughness: 0.74 });

  // Limestone sidewalk & curb bay
  const pad = new THREE.Mesh(new THREE.BoxGeometry(26, 0.2, 20), matCornice);
  pad.position.set(0, 0.1, 3);
  g.add(pad);

  // Vestibule walls with open 2.6m front threshold at z = +6
  const backW = new THREE.Mesh(new THREE.BoxGeometry(20, 4.4, 0.4), brick);
  backW.position.set(0, 2.2, -6);
  const leftW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.4, 12), brick);
  leftW.position.set(-9.8, 2.2, 0);
  const rightW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.4, 12), brick);
  rightW.position.set(9.8, 2.2, 0);
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(8.5, 4.4, 0.4), brick);
  frontL.position.set(-5.75, 2.2, 6);
  const frontR = new THREE.Mesh(new THREE.BoxGeometry(8.5, 4.4, 0.4), brick);
  frontR.position.set(5.75, 2.2, 6);
  g.add(backW, leftW, rightW, frontL, frontR);

  // Upper storeys (20m x 12m) + cornice + fire escape + cyan water relay
  const upper = new THREE.Mesh(new THREE.BoxGeometry(20, 26, 12), brick);
  upper.position.set(0, 4.4 + 13, 0);
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(20.8, 0.8, 12.8), matCornice);
  roofCap.position.set(0, 30.8, 0);
  const relay = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.4, 12), matCyanBand);
  relay.position.set(-6.5, 1.4, -3.2);
  g.add(upper, roofCap, relay);

  // Glowing Warm Lit Doorway Portal inside The Severn's 2.6m Threshold (z = +5.92)
  const litDoorwayGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.52, 3.05),
    new THREE.MeshBasicMaterial({
      color: '#ffcc84',
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
    })
  );
  litDoorwayGlow.position.set(0, 1.72, 5.88);
  g.add(litDoorwayGlow);

  const doorwayHit = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.6, 1.4), matInvisibleHit);
  doorwayHit.position.set(0, 1.85, 6.1);
  addMapsTarget(doorwayHit, {
    kind: 'severn-doorway',
    getAnchor: () => new THREE.Vector3(SEVERN_POS.x, SEVERN_POS.y + 4.1, SEVERN_POS.z + 6.0),
    getWhisper: () => 'The Severn Lit Doorway (701 Cathedral St) — Click to Enter Island · Shift+Click Nolli Block',
  });
  g.add(doorwayHit);

  // Operable Threshold Door at (-1.35, 0.2, 6.0)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-1.35, 0.2, 6.0);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.65, 3.0, 0.14), matTimber);
  leaf.position.set(1.32, 1.5, 0);
  const leafHit = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.1, 0.55), matInvisibleHit);
  leafHit.position.set(1.32, 1.5, 0);
  addMapsTarget(leafHit, {
    kind: 'severn-door-leaf',
    getAnchor: () => new THREE.Vector3(SEVERN_POS.x - 1.2, SEVERN_POS.y + 3.4, SEVERN_POS.z + 6.0),
    getWhisper: () =>
      pilot.doorOpen
        ? 'Severn Door Leaf (Open · 13.5 kHz) — Click Door Leaf to Close & Muffle'
        : 'Severn Door Leaf (Closed · 580 Hz) — Click Door Leaf to Swing Open',
  });
  doorPivot.add(leaf, leafHit);
  g.add(doorPivot);
  severnAtlas.doorPivot = doorPivot;

  // Usable Curb Cruiser parked at z = +10.8
  const cruiserBox = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.35, 4.5),
    new THREE.MeshStandardMaterial({ color: '#1e3a5c', roughness: 0.32, metalness: 0.55 })
  );
  cruiserBox.rotation.y = Math.PI * 0.5;
  cruiserBox.position.set(4.5, 0.88, 10.6);
  g.add(cruiserBox);

  // Warm vestibule lamp + exterior threshold lantern
  const pLight = new THREE.PointLight('#ffb464', 3.4, 32, 1.4);
  pLight.position.set(0, 3.5, 4.2);
  g.add(pLight);

  g.userData = { severnPilot: true, provenance: 'checked' };
  cityWorldGroup.add(g);

  severnAtlas.bekeleActor = spawnAtlasAnny('adult_m', '#9c6840', SEVERN_POS.x - 0.8, SEVERN_POS.y + 0.2, SEVERN_POS.z + 3.6, 0.2);
  severnAtlas.playerActor = spawnAtlasAnny('adult_f', '#255a7a', SEVERN_POS.x + 0.9, SEVERN_POS.y + 0.2, SEVERN_POS.z + 8.2, Math.PI - 0.2);
  const bekHit = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.2, 10), matInvisibleHit);
  bekHit.position.set(0, 1.1, 0);
  addMapsTarget(bekHit, {
    kind: 'bekele',
    getAnchor: () => new THREE.Vector3(SEVERN_POS.x - 0.8, SEVERN_POS.y + 2.2, SEVERN_POS.z + 3.6),
    getWhisper: () => `Bekele · Severn Steward (Parcel: ${(pilot.parcelHolder || 'player').toUpperCase()}) — Click to Hand Off`,
  });
  severnAtlas.bekeleActor.root.add(bekHit);

  // Landmarks
  for (const lm of cityMeta.landmarks) {
    if (Math.hypot(lm.x - SEVERN_POS.x, lm.y - SEVERN_POS.z) < 35) continue;
    const ly = Math.max(groundAt(lm.x, lm.y), 0.3);
    const lg = new THREE.Group();
    lg.position.set(lm.x, ly, lm.y);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(6, 7.5, 16, 12), matTerraceStone);
    base.position.y = 8;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 5.5, 6, 12), matCyanBand);
    crown.position.y = 19;
    lg.add(base, crown);
    lg.userData = { landmark: lm, provenance: 'recorded' };
    cityWorldGroup.add(lg);
  }

  // Nongeographic Black Ring Marker (outside street network)
  const blackY = Math.max(groundAt(BLACK_ANCHOR.x, BLACK_ANCHOR.z), 0.5);
  const blackDisc = new THREE.Mesh(
    new THREE.RingGeometry(BLACK_ANCHOR.r - 3, BLACK_ANCHOR.r, 64),
    new THREE.MeshBasicMaterial({ color: '#c98cff', side: THREE.DoubleSide })
  );
  blackDisc.rotation.x = -Math.PI / 2;
  blackDisc.position.set(BLACK_ANCHOR.x, blackY + 1.0, BLACK_ANCHOR.z);
  const blackHit = new THREE.Mesh(new THREE.CylinderGeometry(BLACK_ANCHOR.r, BLACK_ANCHOR.r, 18, 24), matInvisibleHit);
  blackHit.position.set(BLACK_ANCHOR.x, blackY + 6, BLACK_ANCHOR.z);
  addMapsTarget(blackHit, {
    kind: 'black-zone',
    getAnchor: () => new THREE.Vector3(BLACK_ANCHOR.x, blackY + 18, BLACK_ANCHOR.z),
    getWhisper: () => 'The Black · Poem 14 Nongeographic Threshold (Outside Street Network)',
  });
  cityWorldGroup.add(blackDisc, blackHit);
}

// ---------------------------------------------------------------------------
// 5b. 6 Physical Stone Era Stelae / Tide Gates Along the Harbor Quay (Eras 0..5)
// ---------------------------------------------------------------------------
const eraStelaeGroup = new THREE.Group();
cityWorldGroup.add(eraStelaeGroup);
const eraStelae = [];
const ERA_FLOOD_LEVELS = [-0.08, 0.55, 1.25, 2.15, 4.0, 4.0];
const ERA_FLOOD_OPACITY = [0.12, 0.22, 0.28, 0.34, 0.56, 0.36];

{
  // Sculpted Granite Harbor Quay Seawall Esplanade facing the eastern sea (x = 2728)
  const quayPlinth = new THREE.Mesh(
    new THREE.BoxGeometry(28, 4.2, 336),
    new THREE.MeshStandardMaterial({ color: '#9c9486', roughness: 0.72, metalness: 0.08 })
  );
  quayPlinth.position.set(2728, -0.4, 2305);
  eraStelaeGroup.add(quayPlinth);

  const ERA_ROMAN = ['0 · SHORE', 'I · OLD CENTER', 'II · ADDITIONS', 'III · BOROUGHS', 'IV · THE FALL +4M', 'V · RESURRECTION'];
  for (let eIdx = 0; eIdx < 6; eIdx++) {
    const sx = 2728;
    const sz = 2170 + eIdx * 54;
    const baseY = 1.65; // Sits right at +1.65m harbor quay so +4.00m flood water washes up the sluice!

    const sg = new THREE.Group();
    sg.position.set(sx, 0, sz);

    // Twin Granite Tide-Gate Piers + Bronze Sluice Gate
    const pierMat = new THREE.MeshStandardMaterial({ color: '#cfc6b6', roughness: 0.62 });
    const pierL = new THREE.Mesh(new THREE.BoxGeometry(5.6, 36, 5.6), pierMat);
    pierL.position.set(0, baseY + 18, -8.5);
    const pierR = new THREE.Mesh(new THREE.BoxGeometry(5.6, 36, 5.6), pierMat);
    pierR.position.set(0, baseY + 18, 8.5);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.8, 3.6, 24.5), matCornice);
    lintel.position.set(0, baseY + 36.8, 0);
    sg.add(pierL, pierR, lintel);

    // Physical Sluice Gate Leaf + Explicit +4.00m Chalked Flood Datum Beam at world y = 4.00m
    const sluice = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 8.5, 11.2),
      new THREE.MeshStandardMaterial({ color: '#2b3948', roughness: 0.38, metalness: 0.68 })
    );
    sluice.position.set(0, 4.25, 0);
    const datumBar = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.55, 23.0),
      new THREE.MeshBasicMaterial({ color: '#e6f8ff' })
    );
    datumBar.position.set(0, 4.0, 0); // Exact +4.00 m world flood datum
    sg.add(sluice, datumBar);

    // Era Course Notches (eIdx + 1 glowing horizontal bands up the stele)
    const crownMat = new THREE.MeshStandardMaterial({
      color: eIdx === 4 ? '#f2a541' : '#18b4ff',
      emissive: eIdx === 4 ? '#e88b1e' : '#1498de',
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });
    for (let b = 0; b <= eIdx; b++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.9, 6.4), crownMat);
      band.position.set(0, baseY + 8 + b * 4.5, -8.5);
      const bandR = band.clone();
      bandR.position.z = 8.5;
      sg.add(band, bandR);
    }

    // Crown Lantern + Vertical Tide-Beacon Shaft so all 6 Stelae read cleanly from Severn Overview
    const crown = new THREE.Mesh(new THREE.OctahedronGeometry(3.8, 0), crownMat);
    crown.position.set(0, baseY + 42.5, 0);
    const shaftMat = new THREE.MeshBasicMaterial({
      color: eIdx === 4 ? '#f2a541' : '#18b4ff',
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3.2, 95, 12, 1, true), shaftMat);
    shaft.position.set(0, baseY + 88, 0);
    sg.add(crown, shaft);

    // Generous raycast hit volume for both aerial & quay-level clicking
    const hit = new THREE.Mesh(new THREE.BoxGeometry(24, 125, 38), matInvisibleHit);
    hit.position.set(0, 58, 0);
    const steleRec = { eraIdx: eIdx, title: ERA_ROMAN[eIdx], sx, sz, group: sg, sluice, crownMat, shaftMat, crown };
    addMapsTarget(hit, {
      kind: 'era-stele',
      stele: steleRec,
      getAnchor: () => new THREE.Vector3(sx, baseY + 46, sz),
      getWhisper: () =>
        `Quay Tide Gate ${ERA_ROMAN[eIdx]} (${cityMeta.eras[eIdx]}) — Click to Shift City Era & +4.00m Flood Plane`,
    });
    sg.add(hit);

    eraStelaeGroup.add(sg);
    eraStelae.push(steleRec);
  }
}

// ---------------------------------------------------------------------------
// 6. Shot Pins (767 Placed Shots) + MovieMap Street Scrubbing Director
// ---------------------------------------------------------------------------
const shots = cityMeta.shots;
const shotConeGeo = new THREE.ConeGeometry(1.4, 3.6, 4);
shotConeGeo.rotateX(Math.PI * 0.5);
const shotPinsMesh = new THREE.InstancedMesh(
  shotConeGeo,
  new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  shots.length
);
{
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3(1, 1, 1);
  const upY = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  const SRC_HEX = { archive: '#f2a541', generated: '#18b4ff', markov: '#c98cff', film: '#ff6452' };
  shots.forEach((s, i) => {
    const sy = Math.max(groundAt(s.x, s.y), s.z || 0) + 2.2;
    q.setFromAxisAngle(upY, -(s.hd * Math.PI) / 180 + Math.PI * 0.5);
    m4.compose(v.set(s.x, sy, s.y), q, sc);
    shotPinsMesh.setMatrixAt(i, m4);
    c.set(SRC_HEX[s.source] || '#cbb182');
    shotPinsMesh.setColorAt(i, c);
  });
  shotPinsMesh.instanceMatrix.needsUpdate = true;
  if (shotPinsMesh.instanceColor) shotPinsMesh.instanceColor.needsUpdate = true;
  cityWorldGroup.add(shotPinsMesh);
}

// Floating WEAVE Shot Alignment Frame Card for MovieMap Mode
function createShotCardTexture(shot) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 288;
  const ctx = c.getContext('2d');
  // Crisp architectural frame border + horizon reticle (no grain!)
  ctx.fillStyle = 'rgba(12, 31, 56, 0.28)';
  ctx.fillRect(0, 0, 512, 288);
  ctx.strokeStyle = '#18b4ff';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 500, 276);
  ctx.strokeStyle = 'rgba(242, 165, 65, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(20, 152);
  ctx.lineTo(492, 152);
  ctx.stroke();

  ctx.fillStyle = 'rgba(8, 14, 24, 0.86)';
  ctx.fillRect(14, 14, 484, 46);
  ctx.fillStyle = '#f1eee6';
  ctx.font = '700 16px Inter, system-ui, sans-serif';
  ctx.fillText(`REGISTERED SHOT ${shot.cid} · POEM ${shot.poem || '01'}`, 24, 34);
  ctx.fillStyle = '#18b4ff';
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  ctx.fillText(`Subject: ${shot.el || 'street facade'} · Source: ${shot.source} · Heading ${shot.hd} deg`, 24, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const shotFrameCard = new THREE.Mesh(
  new THREE.PlaneGeometry(7.8, 4.4),
  new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthTest: false })
);
shotFrameCard.renderOrder = 20;
shotFrameCard.visible = false;
scene.add(shotFrameCard);

// MovieMap Street Edges & Intersection Graph
const mmEdges = mmElsewhere.edges;
const mmNodes = mmElsewhere.nodes;
const mmWays = mmElsewhere.ways;
const nodeToEdges = new Map();
mmEdges.forEach((e, idx) => {
  if (!nodeToEdges.has(e.a)) nodeToEdges.set(e.a, []);
  if (!nodeToEdges.has(e.b)) nodeToEdges.set(e.b, []);
  nodeToEdges.get(e.a).push(idx);
  nodeToEdges.get(e.b).push(idx);
});

function edgeSteps(edgeIdx) {
  const e = mmEdges[edgeIdx];
  const pts = [];
  for (let i = 0; i < e.pts.length; i += 2) pts.push([e.pts[i], e.pts[i + 1]]);
  if (pts.length < 2) return [[SEVERN_POS.x, SEVERN_POS.z, 0]];
  const dists = [0];
  for (let i = 1; i < pts.length; i++) {
    dists.push(dists[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = Math.max(3, dists[dists.length - 1]);
  const n = Math.max(4, Math.round(total / 3.2));
  const at = (d) => {
    const dc = THREE.MathUtils.clamp(d, 0, total);
    let k = 1;
    while (k < dists.length - 1 && dists[k] < dc) k++;
    const seg = Math.max(0.001, dists[k] - dists[k - 1]);
    const t = (dc - dists[k - 1]) / seg;
    return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t];
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = (total * i) / (n - 1);
    const p = at(d);
    const a = at(d - 5);
    const b = at(d + 5);
    out.push([p[0], p[1], Math.atan2(b[0] - a[0], -(b[1] - a[1]))]);
  }
  return out;
}

// Find edge closest to The Severn for MovieMap initial street
let severnEdgeIdx = 0;
{
  let bestD = Infinity;
  mmEdges.forEach((e, idx) => {
    const mx = e.pts[0];
    const mz = e.pts[1];
    const d = Math.hypot(mx - SEVERN_POS.x, mz - SEVERN_POS.z);
    if (d < bestD && e.pts.length >= 4) {
      bestD = d;
      severnEdgeIdx = idx;
    }
  });
}

// ---------------------------------------------------------------------------
// 6b. Glowing 3D Shot Frames Along Actual Street Corridors + Ascent Light Beam
// ---------------------------------------------------------------------------
const shotFramesGroup = new THREE.Group();
cityWorldGroup.add(shotFramesGroup);
const corridorShotFrames = [];

{
  const matFrameCyan = new THREE.MeshStandardMaterial({
    color: '#3ad4ff',
    emissive: '#18b4ff',
    emissiveIntensity: 1.85,
    roughness: 0.18,
  });
  const matFrameAmber = new THREE.MeshStandardMaterial({
    color: '#ffd089',
    emissive: '#f2a541',
    emissiveIntensity: 1.65,
    roughness: 0.22,
  });
  const matFrameGlass = new THREE.MeshBasicMaterial({
    color: '#18b4ff',
    transparent: true,
    opacity: 0.13,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  function makeGlowingShotFrameMesh(isAmber = false) {
    const fg = new THREE.Group();
    const fw = 5.6;
    const fh = 3.3;
    const barMat = isAmber ? matFrameAmber : matFrameCyan;
    const topB = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.14, 0.14), barMat);
    topB.position.y = fh * 0.5;
    const botB = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.14, 0.14), barMat);
    botB.position.y = -fh * 0.5;
    const leftB = new THREE.Mesh(new THREE.BoxGeometry(0.14, fh, 0.14), barMat);
    leftB.position.x = -fw * 0.5;
    const rightB = new THREE.Mesh(new THREE.BoxGeometry(0.14, fh, 0.14), barMat);
    rightB.position.x = fw * 0.5;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(fw - 0.2, fh - 0.2), matFrameGlass);
    // Brass alignment ticks at corners
    for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.2), matBrass);
      tick.position.set(cx * (fw * 0.5), cy * (fh * 0.5), 0);
      fg.add(tick);
    }
    fg.add(topB, botB, leftB, rightB, pane);
    return fg;
  }

  // Place Glowing 3D Shot Frames directly along real MovieMap street corridors!
  const chosenCorridors = [];
  // Prioritize corridors near Severn -> Harbor Quay sightline first, then city-wide
  const rankedEdges = mmEdges
    .map((e, idx) => {
      if (!e.pts || e.pts.length < 4) return null;
      const mx = (e.pts[0] + e.pts[e.pts.length - 2]) * 0.5;
      const mz = (e.pts[1] + e.pts[e.pts.length - 1]) * 0.5;
      const dSev = Math.hypot(mx - 2240, mz - 2330);
      return { idx, mx, mz, dSev };
    })
    .filter(Boolean)
    .sort((a, b) => a.dSev - b.dSev);

  for (const cand of rankedEdges) {
    if (chosenCorridors.length >= 46) break;
    const minSep = cand.dSev < 420 ? 36 : 165;
    if (chosenCorridors.some((c) => Math.hypot(c.x - cand.mx, c.z - cand.mz) < minSep)) continue;
    const steps = edgeSteps(cand.idx);
    if (steps.length < 3) continue;
    const midStep = Math.floor(steps.length * 0.5);
    const [fx, fz, fhd] = steps[midStep];
    const fy = Math.max(groundAt(fx, fz), 0.4) + 3.4;

    // Nearest archive shot metadata
    let nearShot = shots[0];
    let bestSD = Infinity;
    for (let i = 0; i < shots.length; i++) {
      const sd = Math.hypot(shots[i].x - fx, shots[i].y - fz);
      if (sd < bestSD) {
        bestSD = sd;
        nearShot = shots[i];
      }
    }

    const wayName = mmWays[mmEdges[cand.idx].w]?.name || 'Harbor Corridor';
    const isAmber = nearShot?.source === 'archive' && chosenCorridors.length % 3 === 0;
    const frameGroup = makeGlowingShotFrameMesh(isAmber);
    frameGroup.position.set(fx, fy, fz);
    frameGroup.rotation.y = -fhd;

    const hit = new THREE.Mesh(new THREE.BoxGeometry(7.6, 5.4, 2.6), matInvisibleHit);
    const frameRec = {
      edgeIdx: cand.idx,
      stepIdx: midStep,
      x: fx,
      y: fy,
      z: fz,
      hd: fhd,
      wayName,
      shot: nearShot,
      group: frameGroup,
    };
    addMapsTarget(hit, {
      kind: 'shot-frame',
      frame: frameRec,
      getAnchor: () => new THREE.Vector3(fx, fy + 2.4, fz),
      getWhisper: () =>
        `MovieMap Corridor · ${wayName} (${nearShot.cid}) — Click to Drop to Street Eye-Level & Scrub`,
    });
    frameGroup.add(hit);
    shotFramesGroup.add(frameGroup);
    corridorShotFrames.push(frameRec);
    chosenCorridors.push({ x: fx, z: fz });
  }
}

// Skyward Cyan Ascent Light Beam + 3D Intersection Turn Portals (active at street eye-level)
const streetCorridorRig = new THREE.Group();
streetCorridorRig.visible = false;
scene.add(streetCorridorRig);

const ascentBeamMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  fog: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uColor: { value: new THREE.Color('#38d8ff') },
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      float core = pow(max(sin(vUv.x * 3.14159265), 0.0), 1.5);
      float vFade = smoothstep(0.0, 0.08, vUv.y) * pow(1.0 - vUv.y, 1.2);
      float pulse = 0.82 + 0.18 * sin(uTime * 2.6 - vUv.y * 8.0);
      gl_FragColor = vec4(uColor * 1.4, core * vFade * pulse * 0.68);
    }
  `,
});
const ascentBeamGroup = new THREE.Group();
const ascentBeamMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(0.55, 1.45, 220, 14, 1, true),
  ascentBeamMat
);
ascentBeamMesh.position.y = 110;
ascentBeamMesh.frustumCulled = false;
const ascentRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.75, 0.08, 8, 28),
  matCyanBand
);
ascentRing.rotation.x = Math.PI / 2;
ascentRing.position.y = 0.25;
const ascentHit = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 220, 10), matInvisibleHit);
ascentHit.position.y = 110;
ascentHit.frustumCulled = false;
addMapsTarget(ascentHit, {
  kind: 'ascent-beam',
  getAnchor: () => new THREE.Vector3(ascentBeamGroup.position.x, ascentBeamGroup.position.y + 4.8, ascentBeamGroup.position.z),
  getWhisper: () => 'Skyward Cartography Beam — Click (or Pull Up / Esc) to Rise to Aerial Overview',
});
ascentBeamGroup.add(ascentBeamMesh, ascentRing, ascentHit);
streetCorridorRig.add(ascentBeamGroup);

const corridorTurnGroup = new THREE.Group();
streetCorridorRig.add(corridorTurnGroup);

// ---------------------------------------------------------------------------
// 7. Mood Topography & 3D District Aura Lanterns Across the Streets
// ---------------------------------------------------------------------------
const moodGroup = new THREE.Group();
moodGroup.visible = false;
scene.add(moodGroup);

const auraLanternsGroup = new THREE.Group();
cityWorldGroup.add(auraLanternsGroup);
const auraLanterns = [];

const moodDistricts = moodAtlas.city.districts || [];
const moodBeacons = [];

function createAuraLanternStandard({ x, z, districtIdx, label, auraColor = '#18b4ff' }) {
  const y = Math.max(groundAt(x, z), 0.4);
  const lg = new THREE.Group();
  lg.position.set(x, y, z);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, 0.7, 12), matCornice);
  plinth.position.y = 0.35;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 9.2, 10), matBrass);
  mast.position.y = 4.9;
  const crossArm = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 0.18), matBrass);
  crossArm.position.y = 9.1;

  // Dual Sodium + Electric-Cyan Aura Globes
  const sodOrb = new THREE.Mesh(new THREE.SphereGeometry(0.68, 14, 12), matSodiumGlow);
  sodOrb.position.set(-1.65, 8.65, 0);
  const cyanOrb = new THREE.Mesh(new THREE.SphereGeometry(0.68, 14, 12), matCyanBand);
  cyanOrb.position.set(1.65, 8.65, 0);

  // Harmonic Acoustic Ring around mast + subtle ground halo
  const harmRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.9, 0.09, 8, 28),
    new THREE.MeshBasicMaterial({ color: auraColor })
  );
  harmRing.position.y = 8.65;
  const groundHalo = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.2, 32),
    new THREE.MeshBasicMaterial({ color: auraColor, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
  );
  groundHalo.rotation.x = -Math.PI / 2;
  groundHalo.position.y = 0.32;

  lg.add(plinth, mast, crossArm, sodOrb, cyanOrb, harmRing, groundHalo);

  const hit = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 12.5, 10), matInvisibleHit);
  hit.position.y = 6.2;
  const rec = { x, y, z, districtIdx, label, group: lg, harmRing, groundHalo };
  addMapsTarget(hit, {
    kind: 'aura-lantern',
    lantern: rec,
    getAnchor: () => new THREE.Vector3(x, y + 10.6, z),
    getWhisper: () =>
      moodGroup.visible && atlas.moodIdx === districtIdx
        ? `District Aura Lantern · ${label} (Active) — Click to Quiet Mood & Acoustic Rings`
        : `3D District Aura Lantern · ${label} — Click to Toggle Live Mood & Acoustic Rings`,
  });
  lg.add(hit);
  auraLanternsGroup.add(lg);
  auraLanterns.push(rec);
  return rec;
}

{
  for (let i = 0; i < moodDistricts.length; i++) {
    const md = moodDistricts[i];
    const matchD = cityMeta.districts.find((cd) => cd.name.toLowerCase().includes(md.id)) || cityMeta.districts[i % cityMeta.districts.length];
    const wx = matchD ? matchD.x : ((md.coords?.x || 200) / 600) * W;
    const wz = matchD ? matchD.y : ((md.coords?.y || 200) / 480) * H;
    const wy = Math.max(groundAt(wx, wz), 0.5);

    const sodiumShare = md.glow_share || 0.18;
    const domeR = 85 + sodiumShare * 140;
    const colHex = md.color || '#18b4ff';

    const auraDome = new THREE.Mesh(
      new THREE.SphereGeometry(domeR, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshBasicMaterial({
        color: colHex,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    auraDome.position.set(wx, wy, wz);
    moodGroup.add(auraDome);

    const sodH = 26 + sodiumShare * 140;
    const cyanH = 34 + (1 - sodiumShare) * 95;
    const sodPillar = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6.5, sodH, 16), matSodiumGlow);
    sodPillar.position.set(wx - 11, wy + sodH * 0.5, wz);
    const cyanPillar = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6.5, cyanH, 16), matCyanBand);
    cyanPillar.position.set(wx + 11, wy + cyanH * 0.5, wz);
    moodGroup.add(sodPillar, cyanPillar);

    moodBeacons.push({ md, wx, wy, wz, auraDome, sodPillar, cyanPillar });
    createAuraLanternStandard({
      x: wx + 18,
      z: wz + 18,
      districtIdx: i,
      label: md.name || `District ${i + 1}`,
      auraColor: colHex,
    });
  }

  // Prominent Street-Corner 3D District Aura Lanterns framing Severn & Harbor Corridor
  createAuraLanternStandard({
    x: SEVERN_POS.x + 22,
    z: SEVERN_POS.z + 17,
    districtIdx: 0,
    label: moodDistricts[0]?.name || 'Cathedral Nightlife Aura',
    auraColor: '#18b4ff',
  });
  createAuraLanternStandard({
    x: SEVERN_POS.x + 76,
    z: SEVERN_POS.z - 12,
    districtIdx: Math.min(1, moodDistricts.length - 1),
    label: moodDistricts[1]?.name || 'Harbor Industrial Aura',
    auraColor: '#fa8d15',
  });
  createAuraLanternStandard({
    x: SEVERN_POS.x + 148,
    z: SEVERN_POS.z + 28,
    districtIdx: Math.min(2, moodDistricts.length - 1),
    label: moodDistricts[2]?.name || 'Waterfront Tidal Aura',
    auraColor: '#38d6ff',
  });

  // 3D Acoustic Field Rings around Severn Threshold (coupled to doorOpen & audio buses!)
  for (let r = 0; r < 5; r++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(18 + r * 26, 20.2 + r * 26, 64),
      new THREE.MeshBasicMaterial({
        color: r % 2 === 0 ? '#18b4ff' : '#f2a541',
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(SEVERN_POS.x, SEVERN_POS.y + 1.8 + r * 0.4, SEVERN_POS.z + 6);
    moodGroup.add(ring);
    severnAtlas.acousticRings.push(ring);
  }
}

// ---------------------------------------------------------------------------
// 8. Elsewhere Hybrid 3D Fold Pavilion (Embedded on Severn West Terrace!)
// ---------------------------------------------------------------------------
const elsewhereGroup = new THREE.Group();
elsewhereGroup.visible = true;
elsewhereGroup.scale.setScalar(0.48);
cityWorldGroup.add(elsewhereGroup);

const ewStations = mmElsewhere.elsewhere.stations;
let ewHybridMode = true;

function buildElsewhereStage(stationIdx) {
  elsewhereGroup.clear();
  const st = ewStations[stationIdx] || ewStations[0];
  const ex = SEVERN_POS.x - 24;
  const ez = SEVERN_POS.z + 18;
  const ey = Math.max(groundAt(ex, ez), 0.5) + 0.25;
  elsewhereGroup.position.set(ex, ey, ez);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(34, 0.4, 34),
    new THREE.MeshStandardMaterial({ color: '#132438', roughness: 0.22, metalness: 0.25 })
  );
  floor.position.set(0, -0.2, 0);
  elsewhereGroup.add(floor);

  const prof = st.prof || [0.6, 0.7, 0.8, 0.5, 0.9, 0.7, 0.6];
  const nCols = prof.length;
  for (let i = 0; i < nCols; i++) {
    const u = i / Math.max(1, nCols - 1) - 0.5;
    const h = 4 + prof[i] * 18;
    const z = -14 + Math.abs(u) * 8 * (st.enc?.[0] || 0.6);
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(28 / nCols - 0.25, h, 1.8),
      i % 3 === 0 ? matLightwellGlass : matTerraceStone
    );
    slab.position.set(u * 26, h * 0.5, z);
    elsewhereGroup.add(slab);

    if (ewHybridMode) {
      const wire = new THREE.Mesh(
        new THREE.BoxGeometry(28 / nCols - 0.2, h + 0.05, 1.85),
        new THREE.MeshBasicMaterial({ color: '#18b4ff', wireframe: true, transparent: true, opacity: 0.38 })
      );
      wire.position.copy(slab.position);
      elsewhereGroup.add(wire);
    }
  }

  const step = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.32, 2.4), matCornice);
  step.position.set(0, 0.16, -3.5);
  const archL = new THREE.Mesh(new THREE.BoxGeometry(0.65, 3.8, 0.65), matTimber);
  archL.position.set(-1.7, 1.9, -3.5);
  const archR = new THREE.Mesh(new THREE.BoxGeometry(0.65, 3.8, 0.65), matTimber);
  archR.position.set(1.7, 1.9, -3.5);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.55, 0.75), matCornice);
  lintel.position.set(0, 3.95, -3.5);
  const cyanPortal = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 5.2, 10), matCyanBand);
  cyanPortal.position.set(2.2, 2.6, -3.2);
  elsewhereGroup.add(step, archL, archR, lintel, cyanPortal);

  const ewHit = new THREE.Mesh(new THREE.BoxGeometry(34, 22, 34), matInvisibleHit);
  ewHit.position.set(0, 10, -4);
  addMapsTarget(ewHit, {
    kind: 'elsewhere-fold',
    getAnchor: () => new THREE.Vector3(ex, ey + 9.5, ez),
    getWhisper: () => `Elsewhere Fold Pavilion · Station ${st.cid} (Poem ${st.poem || '01'}) — Click Spatial Rhyme`,
  });
  elsewhereGroup.add(ewHit);

  // Draw Skyline · Horizon · Vanishing Point Phenotype Graph (for Tab drawer)
  const pc = $('phenotype-canvas');
  const pctx = pc.getContext('2d');
  pctx.fillStyle = '#081526';
  pctx.fillRect(0, 0, pc.width, pc.height);
  pctx.fillStyle = 'rgba(24, 180, 255, 0.22)';
  pctx.beginPath();
  pctx.moveTo(0, pc.height);
  prof.forEach((v, idx) => {
    const px = (idx / Math.max(1, prof.length - 1)) * pc.width;
    const py = pc.height - v * (pc.height - 10);
    pctx.lineTo(px, py);
  });
  pctx.lineTo(pc.width, pc.height);
  pctx.fill();

  const hzY = (1 - (st.hz || 0.5)) * pc.height;
  pctx.strokeStyle = '#f2a541';
  pctx.lineWidth = 2;
  pctx.beginPath();
  pctx.moveTo(0, hzY);
  pctx.lineTo(pc.width, hzY);
  pctx.stroke();

  if (st.vp) {
    pctx.fillStyle = '#18b4ff';
    pctx.beginPath();
    pctx.arc(THREE.MathUtils.clamp(st.vp[0], 0.05, 0.95) * pc.width, THREE.MathUtils.clamp(st.vp[1], 0.1, 0.9) * pc.height, 4.5, 0, Math.PI * 2);
    pctx.fill();
  }
  pctx.fillStyle = '#f1eee6';
  pctx.font = '600 10px Inter, system-ui, sans-serif';
  pctx.fillText(`${st.cid} · Poem ${st.poem || '01'} · Horizon ${(st.hz || 0.5).toFixed(2)}`, 8, 14);
  $('ew-station-id').textContent = `Station ${st.cid}`;
}

// ---------------------------------------------------------------------------
// 9. Unified Atlas State, Mode Switching, Scrubbing & Pilot Sync
// ---------------------------------------------------------------------------
function parseEraIndex(val) {
  if (typeof val === 'number' && Number.isFinite(val)) return THREE.MathUtils.clamp(Math.round(val), 0, 5);
  const n = Number(val);
  if (Number.isFinite(n) && String(val).trim() !== '') return THREE.MathUtils.clamp(Math.round(n), 0, 5);
  const map = { shore: 0, founding: 1, rowhouse: 2, industrial: 3, 'the-fall': 4, fall: 4, resurrection: 5, 'living-harbor': 5 };
  return map[String(val || '').toLowerCase()] ?? 5;
}

const atlas = {
  mode: 'city3d', // 'city3d' | 'moviemap' | 'mood' | 'elsewhere'
  inStreetCorridor: false,
  era: parseEraIndex(pilot.era),
  variantIdx: 2, // 'the mixed city'
  saltDatumOn: true,
  floodTargetY: ERA_FLOOD_LEVELS[parseEraIndex(pilot.era)] ?? 4.0,
  floodCurrentY: ERA_FLOOD_LEVELS[parseEraIndex(pilot.era)] ?? 4.0,
  floodTargetOpacity: ERA_FLOOD_OPACITY[parseEraIndex(pilot.era)] ?? 0.36,
  reverseAngle: false,
  mmEdgeIdx: severnEdgeIdx,
  mmStepIdx: 4,
  mmStepFloat: 4.0,
  mmYawOffset: 0,
  mmPitch: 0.03,
  mmView: 0, // 0 front, 1 right, 2 back, 3 left
  mmPlaying: false,
  mmCardOn: false,
  moodIdx: 0,
  acousticOn: true,
  ewIdx: 0,
  flyAnim: null,
};

let worldSpeechState = null;
function setWorldSpeech(anchorVec3, speaker, text, durMs = 3800) {
  worldSpeechState = {
    anchorVec3: anchorVec3 ? anchorVec3.clone() : new THREE.Vector3(SEVERN_POS.x, SEVERN_POS.y + 8, SEVERN_POS.z),
    speaker,
    text,
    until: performance.now() + durMs,
  };
}

function showToast(kicker, body, anchorVec3 = null) {
  $('toast-kicker').textContent = kicker;
  $('toast-body').textContent = body;
  $('inspector-toast').classList.add('visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => $('inspector-toast').classList.remove('visible'), 4200);
  if (anchorVec3) {
    setWorldSpeech(anchorVec3, kicker, body, 3800);
  }
}

function flyCameraTo(pos, target, dur = 1.0, onDone = null) {
  atlas.flyAnim = {
    p0: camera.position.clone(),
    p1: pos.clone(),
    t0: controls.target.clone(),
    t1: target.clone(),
    elapsed: 0,
    dur,
    onDone,
  };
}

function focusSevernPilot(instant = false) {
  atlas.reverseAngle = false;
  atlas.inStreetCorridor = false;
  streetCorridorRig.visible = false;
  shotFrameCard.visible = false;
  controls.enabled = true;
  // Frame Severn Lit Doorway (left), Glowing Street Shot Frames + Aura Lanterns (center),
  // and the 6 Harbor Quay Stone Era Stelae / Tide Gates + +4.00m Flood Plane (right horizon)
  const p = new THREE.Vector3(2042, 56, 2374);
  const t = new THREE.Vector3(2185, 18, 2326);
  if (instant) {
    camera.position.copy(p);
    controls.target.copy(t);
    camera.lookAt(t);
  } else {
    flyCameraTo(p, t, 1.0);
  }
}

function syncPilotUI() {
  const holder = pilot.parcelHolder || 'player';
  $('val-pilot-place').textContent = `${(pilot.building || 'severn').toUpperCase()} · Poem ${pilot.poem || '01'}`;
  $('val-pilot-door').textContent = pilot.doorOpen ? 'OPEN (13.5 kHz)' : 'CLOSED (580 Hz)';
  $('val-pilot-parcel').textContent = holder.toUpperCase();
  $('btn-pilot-door').classList.toggle('active', !!pilot.doorOpen);

  if (severnAtlas.bekeleActor) severnAtlas.bekeleActor.parcel.visible = holder === 'bekele';
  if (severnAtlas.playerActor) severnAtlas.playerActor.parcel.visible = holder === 'player';

  const islLink = $('link-to-island');
  if (islLink) islLink.href = `../island/${formatPilotHash(pilot)}`;
}

subscribePilotState((next) => {
  pilot = next;
  applyHourToAtlasSky(pilot.worldTime ?? 18.5);
  syncPilotUI();
});

function applyHourToAtlasSky(hourVal) {
  const h = Number.isFinite(hourVal) ? hourVal : 18.5;
  const rad = ((h - 6) / 24) * Math.PI * 2;
  const sunY = Math.sin(rad);
  const day01 = THREE.MathUtils.clamp((sunY + 0.18) / 0.85, 0, 1);
  const dusk01 = Math.exp(-Math.pow((h - 18.6) / 1.8, 2));

  skyUniforms.uSunDir.value.set(Math.cos(rad) * 0.8, Math.max(-0.2, sunY), -0.6).normalize();
  skyUniforms.uTop.value.set('#061224').lerp(new THREE.Color('#1c4c82'), day01).lerp(new THREE.Color('#0c1f38'), dusk01 * 0.65);
  skyUniforms.uHor.value.set('#142a48').lerp(new THREE.Color('#7caad1'), day01).lerp(new THREE.Color('#c9784c'), dusk01 * 0.8);
  keyLight.intensity = 0.5 + day01 * 1.4 + dusk01 * 0.4;
  hemiLight.intensity = 0.78 + day01 * 0.55;
  scene.fog.color.copy(skyUniforms.uHor.value).lerp(skyUniforms.uTop.value, 0.55);
}

// Unified Mode Switch (never hides the 3D Terraced City!)
function setAtlasMode(mode) {
  atlas.mode = mode;
  atlas.mmPlaying = false;
  $('turn-overlay').classList.remove('visible');

  document.querySelectorAll('#mode-tabs .pill').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
    b.classList.toggle('cyan', b.dataset.mode === mode);
  });
  document.querySelectorAll('.mode-pane').forEach((p) => {
    p.classList.toggle('active', p.id === `pane-${mode}`);
  });

  cityWorldGroup.visible = true;
  elsewhereGroup.visible = true;

  if (mode === 'city3d') {
    moodGroup.visible = false;
    focusSevernPilot(false);
  } else if (mode === 'moviemap') {
    enterStreetCorridor(atlas.mmEdgeIdx, atlas.mmStepFloat, false);
  } else if (mode === 'mood') {
    moodGroup.visible = true;
    atlas.inStreetCorridor = false;
    streetCorridorRig.visible = false;
    controls.enabled = true;
    selectMoodDistrict(atlas.moodIdx);
  } else if (mode === 'elsewhere') {
    atlas.inStreetCorridor = false;
    streetCorridorRig.visible = false;
    controls.enabled = true;
    jumpElsewhereBySeed(Number($('inp-ew-seed').value) || 2086);
  }
}

let applyEraGlobal = null;

// Mode 1 Setup: Era Slider, 6 Harbor Quay Stone Stelae, Structure Variants, Landmarks
{
  const varSel = $('sel-variant');
  varSel.innerHTML = structuresData.variants
    .map((v, idx) => `<option value="${idx}">Terraced: ${v.name}</option>`)
    .concat(['<option value="-1">Terraced Structures: Off</option>'])
    .join('');
  varSel.value = String(atlas.variantIdx);
  varSel.addEventListener('change', () => {
    atlas.variantIdx = Number(varSel.value);
    rebuildStructuresVariant(atlas.variantIdx, atlas.era);
  });

  const lmSel = $('sel-landmark');
  lmSel.innerHTML = ['<option value="-1">Jump to Landmark...</option>']
    .concat(cityMeta.landmarks.map((l, i) => `<option value="${i}">${l.name.split(' · ')[0]}</option>`))
    .join('');
  lmSel.addEventListener('change', () => {
    const idx = Number(lmSel.value);
    if (idx < 0) return;
    const lm = cityMeta.landmarks[idx];
    const ly = Math.max(groundAt(lm.x, lm.y), 0.5);
    flyCameraTo(new THREE.Vector3(lm.x + 85, ly + 42, lm.y + 85), new THREE.Vector3(lm.x, ly + 10, lm.y));
    showToast('LANDMARK RECORDED', `${lm.name} · Poem ${lm.poem || '—'}`, new THREE.Vector3(lm.x, ly + 22, lm.y));
  });

  const applyEra = (eVal, toggleSurgeIfSame = false) => {
    const sameEra = atlas.era === eVal;
    atlas.era = eVal;
    $('sl-era').value = String(eVal);
    $('val-era').textContent = `${eVal} · ${cityMeta.eras[eVal]}`;
    $('era-lore').textContent = cityMeta.lore[eVal];
    rebuildStructuresVariant(atlas.variantIdx, eVal);

    if (sameEra && toggleSurgeIfSame) {
      const surged = atlas.floodTargetY < 3.2;
      atlas.floodTargetY = surged ? 4.0 : 0.35;
      atlas.floodTargetOpacity = surged ? 0.54 : 0.18;
    } else {
      atlas.floodTargetY = ERA_FLOOD_LEVELS[eVal] ?? 4.0;
      atlas.floodTargetOpacity = ERA_FLOOD_OPACITY[eVal] ?? 0.36;
    }
    saltDatumPlane.visible = atlas.saltDatumOn && atlas.floodTargetY >= 1.2;

    // Highlight active Stone Era Stele / Tide Gate on Harbor Quay
    eraStelae.forEach((st, idx) => {
      const active = idx === eVal;
      const past = idx <= eVal;
      st.crownMat.emissiveIntensity = active ? 2.6 : past ? 1.35 : 0.45;
      st.shaftMat.opacity = active ? 0.52 : past ? 0.24 : 0.10;
      st.sluice.position.y = active && atlas.floodTargetY >= 3.8 ? 6.8 : 3.6;
    });

    savePilotState({ era: eVal });
  };
  applyEraGlobal = applyEra;
  $('sl-era').addEventListener('input', (e) => applyEra(Number(e.target.value), false));
  applyEra(atlas.era, false);

  $('btn-fly-severn').addEventListener('click', () => focusSevernPilot(false));
  $('btn-salt-datum').addEventListener('click', () => {
    atlas.saltDatumOn = !atlas.saltDatumOn;
    saltDatumPlane.visible = atlas.saltDatumOn;
    floodWaterMesh.visible = atlas.saltDatumOn;
    $('btn-salt-datum').classList.toggle('active', atlas.saltDatumOn);
  });
  $('btn-Aerial-Overview').addEventListener('click', () => {
    ascendToLivingOverview();
  });
  let eraTimer = null;
  $('btn-play-eras').addEventListener('click', () => {
    if (eraTimer) {
      clearInterval(eraTimer);
      eraTimer = null;
      $('btn-play-eras').textContent = 'Play Eras';
      return;
    }
    let e = 0;
    applyEra(0, false);
    $('btn-play-eras').textContent = 'Stop Eras';
    eraTimer = setInterval(() => {
      e++;
      if (e > 5) {
        clearInterval(eraTimer);
        eraTimer = null;
        $('btn-play-eras').textContent = 'Play Eras';
        return;
      }
      applyEra(e, false);
    }, 2400);
  });
}

// Mode 2 Setup: Seamless Street-Level MovieMap Corridor Scrubbing + 3D Turn Frames
let turnPortalMeshes = [];

function sampleCorridorAt(edgeIdx, stepFloat) {
  const st = edgeSteps(edgeIdx);
  const clamped = THREE.MathUtils.clamp(stepFloat, 0, Math.max(0, st.length - 1));
  const i0 = Math.floor(clamped);
  const i1 = Math.min(st.length - 1, i0 + 1);
  const f = clamped - i0;
  const a = st[i0];
  const b = st[i1];
  let dHd = b[2] - a[2];
  while (dHd > Math.PI) dHd -= Math.PI * 2;
  while (dHd < -Math.PI) dHd += Math.PI * 2;
  return {
    x: THREE.MathUtils.lerp(a[0], b[0], f),
    z: THREE.MathUtils.lerp(a[1], b[1], f),
    hd: a[2] + dHd * f,
    totalSteps: st.length,
    clamped,
  };
}

function rebuildCorridorTurnPortals() {
  // Remove previous dynamic turn portal targets
  for (const m of turnPortalMeshes) {
    const idx = mapsPickables.indexOf(m);
    if (idx >= 0) mapsPickables.splice(idx, 1);
  }
  turnPortalMeshes = [];
  corridorTurnGroup.clear();

  if (!atlas.inStreetCorridor) return;
  const e = mmEdges[atlas.mmEdgeIdx];
  if (!e) return;
  const st = edgeSteps(atlas.mmEdgeIdx);
  const atEnd = atlas.mmStepFloat >= st.length - 2.4;
  const atStart = atlas.mmStepFloat <= 1.4;
  if (!atEnd && !atStart) return;

  const nodeId = atEnd ? e.b : e.a;
  const candidates = (nodeToEdges.get(nodeId) || []).filter((idx) => idx !== atlas.mmEdgeIdx).slice(0, 4);
  candidates.forEach((cIdx) => {
    const cEdge = mmEdges[cIdx];
    const cSteps = edgeSteps(cIdx);
    const fromStart = cEdge.a === nodeId;
    const sampleIdx = fromStart ? Math.min(2, cSteps.length - 1) : Math.max(0, cSteps.length - 3);
    const [tx, tz, thd] = cSteps[sampleIdx];
    const ty = Math.max(groundAt(tx, tz), 0.4) + 2.6;
    const wayName = mmWays[cEdge.w]?.name || `Corridor #${cEdge.id}`;

    const pg = new THREE.Group();
    pg.position.set(tx, ty, tz);
    pg.rotation.y = -(fromStart ? thd : thd + Math.PI);

    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(1.85, 0.09, 8, 4),
      new THREE.MeshBasicMaterial({ color: '#f2a541' })
    );
    frame.rotation.z = Math.PI * 0.25;
    const veil = new THREE.Mesh(
      new THREE.CircleGeometry(1.75, 4),
      new THREE.MeshBasicMaterial({ color: '#f2a541', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    veil.rotation.z = Math.PI * 0.25;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.2, 2.2), matInvisibleHit);
    addMapsTarget(hit, {
      kind: 'corridor-turn',
      edgeIdx: cIdx,
      startStep: fromStart ? 0.5 : Math.max(0, cSteps.length - 1.5),
      wayName,
      getAnchor: () => new THREE.Vector3(tx, ty + 2.2, tz),
      getWhisper: () => `Turn onto ${wayName} — Click to Continue Scrubbing`,
    });
    turnPortalMeshes.push(hit);
    pg.add(frame, veil, hit);
    corridorTurnGroup.add(pg);
  });
}

function syncMovieMapPose(applyCameraImmediate = true) {
  if (!atlas.inStreetCorridor && atlas.mode !== 'moviemap') return;
  const samp = sampleCorridorAt(atlas.mmEdgeIdx, atlas.mmStepFloat);
  atlas.mmStepFloat = samp.clamped;
  atlas.mmStepIdx = Math.round(samp.clamped);

  const sy = Math.max(groundAt(samp.x, samp.z), 0.4) + 2.05;
  const viewHd = samp.hd + atlas.mmView * (Math.PI * 0.5) + atlas.mmYawOffset;
  const dx = Math.sin(viewHd) * Math.cos(atlas.mmPitch);
  const dy = Math.sin(atlas.mmPitch);
  const dz = -Math.cos(viewHd) * Math.cos(atlas.mmPitch);

  const camPos = new THREE.Vector3(samp.x, sy, samp.z);
  const lookTarget = new THREE.Vector3(samp.x + dx * 42, sy + dy * 42, samp.z + dz * 42);

  if (applyCameraImmediate && !atlas.flyAnim) {
    camera.position.copy(camPos);
    controls.target.copy(lookTarget);
    camera.lookAt(lookTarget);
  }

  // Position Skyward Cyan Ascent Light Beam 14m ahead-left on the sidewalk so it's always reachable!
  const beamX = samp.x + Math.sin(samp.hd) * 14 - Math.cos(samp.hd) * 3.8;
  const beamZ = samp.z - Math.cos(samp.hd) * 14 - Math.sin(samp.hd) * 3.8;
  ascentBeamGroup.position.set(beamX, Math.max(groundAt(beamX, beamZ), 0.4), beamZ);

  const e = mmEdges[atlas.mmEdgeIdx];
  const wayName = mmWays[e.w]?.name || 'Harbor Street';
  $('mm-street-name').textContent = `${wayName} · Segment #${e.id}`;
  $('mm-frame-readout').textContent = `Frame ${atlas.mmStepIdx + 1} / ${samp.totalSteps}`;
  $('sl-mm-scrub').value = String(Math.round((atlas.mmStepFloat / Math.max(1, samp.totalSteps - 1)) * 100));

  let bestShot = shots[0];
  let bestD = Infinity;
  for (let i = 0; i < shots.length; i++) {
    const d = Math.hypot(shots[i].x - samp.x, shots[i].y - samp.z);
    if (d < bestD) { bestD = d; bestShot = shots[i]; }
  }
  $('mm-cross-info').textContent = `Nearest Shot: ${bestShot.cid} (${Math.round(bestD)}m) · Zero-Grain Live 3D`;

  shotFrameCard.visible = false;
  rebuildCorridorTurnPortals();
  return { camPos, lookTarget, wayName, bestShot };
}

function enterStreetCorridor(edgeIdx, stepFloat = 0, animateDrop = true) {
  atlas.mode = 'moviemap';
  atlas.inStreetCorridor = true;
  atlas.mmEdgeIdx = edgeIdx;
  atlas.mmStepFloat = stepFloat;
  atlas.mmYawOffset = 0;
  atlas.mmPitch = 0.03;
  controls.enabled = false;
  streetCorridorRig.visible = true;

  const pose = syncMovieMapPose(!animateDrop);
  if (animateDrop && pose) {
    flyCameraTo(pose.camPos, pose.lookTarget, 0.88);
  }
  if (pose) {
    setWorldSpeech(
      new THREE.Vector3(pose.camPos.x + (pose.lookTarget.x - pose.camPos.x) * 0.35, pose.camPos.y + 1.8, pose.camPos.z + (pose.lookTarget.z - pose.camPos.z) * 0.35),
      `MOVIEMAP CORRIDOR · ${pose.wayName.toUpperCase()}`,
      'Wheel or WASD scrubs street · Click cyan sky beam (or Esc) to rise to aerial overview.',
      3400
    );
  }
}

function ascendToLivingOverview() {
  atlas.inStreetCorridor = false;
  atlas.mode = 'city3d';
  streetCorridorRig.visible = false;
  controls.enabled = true;
  flyCameraTo(
    new THREE.Vector3(2042, 56, 2374),
    new THREE.Vector3(2185, 18, 2326),
    0.95
  );
}

{
  $('sl-mm-scrub').addEventListener('input', (e) => {
    const st = edgeSteps(atlas.mmEdgeIdx);
    atlas.mmStepFloat = (Number(e.target.value) / 100) * Math.max(0, st.length - 1);
    syncMovieMapPose(true);
  });
  document.querySelectorAll('#mm-views .pill[data-v]').forEach((btn) => {
    btn.addEventListener('click', () => {
      atlas.mmView = Number(btn.dataset.v);
      document.querySelectorAll('#mm-views .pill[data-v]').forEach((b) => b.classList.toggle('active', b === btn));
      syncMovieMapPose(true);
    });
  });
  $('btn-mm-play').addEventListener('click', () => {
    atlas.mmPlaying = !atlas.mmPlaying;
    $('btn-mm-play').classList.toggle('active', atlas.mmPlaying);
    $('btn-mm-play').textContent = atlas.mmPlaying ? 'Pause Street' : 'Drive Street';
  });
  $('btn-mm-frame-card').addEventListener('click', () => {
    atlas.mmCardOn = !atlas.mmCardOn;
    $('btn-mm-frame-card').textContent = atlas.mmCardOn ? 'Shot Card: On' : 'Shot Card: Off';
  });

  const shotSel = $('sel-mm-shot');
  shotSel.innerHTML = shots.slice(0, 80).map((s, idx) => `<option value="${idx}">${s.cid} · Poem ${s.poem || '01'} (${s.el})</option>`).join('');
  shotSel.addEventListener('change', () => {
    const s = shots[Number(shotSel.value)];
    if (!s) return;
    let bestE = 0, bestD = Infinity;
    mmEdges.forEach((edge, idx) => {
      const d = Math.hypot(edge.pts[0] - s.x, edge.pts[1] - s.y);
      if (d < bestD) { bestD = d; bestE = idx; }
    });
    enterStreetCorridor(bestE, 0, true);
  });
}

// Mode 3 Setup: Mood Topography & 3D District Aura Lanterns
function selectMoodDistrict(idx, fly = true) {
  atlas.moodIdx = THREE.MathUtils.clamp(idx, 0, moodBeacons.length - 1);
  const b = moodBeacons[atlas.moodIdx];
  if (!b) return;
  $('sel-mood-dist').value = String(atlas.moodIdx);
  $('mood-realm-tag').textContent = b.md.realm || 'Realm B';
  $('mood-quote').textContent = b.md.mood || '';
  $('mood-body-sw').innerHTML = (b.md.body || []).map((c) => `<span class="sw" style="background:${c}"></span>`).join('');
  $('mood-glow-sw').innerHTML = (b.md.glow || []).map((c) => `<span class="sw glow" style="background:${c};color:${c}"></span>`).join('');

  if (fly) {
    flyCameraTo(
      new THREE.Vector3(b.wx + 165, b.wy + 95, b.wz + 165),
      new THREE.Vector3(b.wx, b.wy + 24, b.wz),
      1.15
    );
  }
}

function toggleAuraLantern(lantern) {
  const sameActive = moodGroup.visible && atlas.moodIdx === lantern.districtIdx;
  if (sameActive) {
    moodGroup.visible = false;
    setWorldSpeech(
      new THREE.Vector3(lantern.x, lantern.y + 10.2, lantern.z),
      'DISTRICT AURA LANTERN',
      'Mood domes & acoustic rings quieted across the streets.',
      2600
    );
    return;
  }
  moodGroup.visible = true;
  atlas.acousticOn = true;
  severnAtlas.acousticRings.forEach((r) => { r.visible = true; });
  selectMoodDistrict(lantern.districtIdx, false);
  const b = moodBeacons[atlas.moodIdx];
  const doorHz = pilot.doorOpen ? '13.5 kHz Open Street' : '580 Hz Muffled Stone';
  setWorldSpeech(
    new THREE.Vector3(lantern.x, lantern.y + 10.2, lantern.z),
    `${lantern.label.toUpperCase()} · AURA & ACOUSTICS`,
    `${b?.md?.mood || 'Sodium vs electric-cyan street field'} (${doorHz}).`,
    3600
  );
}

{
  const mdSel = $('sel-mood-dist');
  mdSel.innerHTML = moodBeacons.map((b, i) => `<option value="${i}">${b.md.name} (${b.md.coords?.zone || 'Harbor'})</option>`).join('');
  mdSel.addEventListener('change', () => {
    moodGroup.visible = true;
    selectMoodDistrict(Number(mdSel.value), true);
  });

  $('sl-aura-balance').addEventListener('input', (e) => {
    const cyanWeight = Number(e.target.value) / 100;
    matSodiumGlow.emissiveIntensity = 0.4 + (1 - cyanWeight) * 2.1;
    matCyanBand.emissiveIntensity = 0.4 + cyanWeight * 2.1;
  });

  $('btn-acoustic-rings').addEventListener('click', () => {
    atlas.acousticOn = !atlas.acousticOn;
    severnAtlas.acousticRings.forEach((r) => { r.visible = atlas.acousticOn; });
    $('btn-acoustic-rings').classList.toggle('active', atlas.acousticOn);
    $('btn-acoustic-rings').textContent = atlas.acousticOn ? 'Acoustic Field: On' : 'Acoustic Field: Off';
  });

  $('btn-mood-archipelago').addEventListener('click', () => {
    moodGroup.visible = true;
    flyCameraTo(new THREE.Vector3(3600, 1450, 5100), new THREE.Vector3(3400, 0, 2800), 1.4);
  });
}

// Mode 4 Setup: Elsewhere Seed / Coordinate / Spatial Rhyme Pavilion
function setElsewhereStation(idx, fly = true) {
  // Prune old elsewhere hit targets before rebuilding
  for (let i = mapsPickables.length - 1; i >= 0; i--) {
    if (mapsPickables[i].userData?.mapsDiegetic?.kind === 'elsewhere-fold') {
      mapsPickables.splice(i, 1);
    }
  }
  atlas.ewIdx = ((idx % ewStations.length) + ewStations.length) % ewStations.length;
  buildElsewhereStage(atlas.ewIdx);
  if (fly) {
    const center = elsewhereGroup.position;
    flyCameraTo(
      new THREE.Vector3(center.x + 12, center.y + 11, center.z + 24),
      new THREE.Vector3(center.x, center.y + 3.5, center.z - 2),
      0.95
    );
  }
}

function jumpElsewhereBySeed(seedNum, fly = true) {
  const idx = Math.abs(Math.imul(seedNum | 0, 2654435761)) % ewStations.length;
  savePilotState({ seed: seedNum });
  setElsewhereStation(idx, fly);
}

// Build initial embedded Elsewhere Fold Pavilion on Severn West Terrace
jumpElsewhereBySeed(pilot.seed || 2086, false);

{
  $('btn-ew-seed-go').addEventListener('click', () => {
    jumpElsewhereBySeed(Number($('inp-ew-seed').value) || 2086, true);
  });

  const poemSel = $('sel-ew-poem');
  poemSel.innerHTML = cityMeta.poems.map((p) => `<option value="${p.num}">Poem ${p.num} · ${p.title}</option>`).join('');
  poemSel.addEventListener('change', () => {
    const pNum = poemSel.value;
    const found = ewStations.findIndex((s) => s.poem === pNum);
    setElsewhereStation(found >= 0 ? found : 0, true);
    savePilotState({ poem: pNum });
  });

  $('btn-ew-fwd').addEventListener('click', () => setElsewhereStation(ewStations[atlas.ewIdx].x.f, true));
  $('btn-ew-back').addEventListener('click', () => setElsewhereStation(ewStations[atlas.ewIdx].x.b, true));
  $('btn-ew-left').addEventListener('click', () => setElsewhereStation(ewStations[atlas.ewIdx].x.l, true));
  $('btn-ew-right').addEventListener('click', () => setElsewhereStation(ewStations[atlas.ewIdx].x.r, true));
  $('btn-ew-rhyme').addEventListener('click', () => {
    const rh = ewStations[atlas.ewIdx].x.rh;
    const next = rh && rh.length ? rh[0] : (atlas.ewIdx + 17) % ewStations.length;
    setElsewhereStation(next, true);
  });
  $('btn-ew-hybrid').addEventListener('click', () => {
    ewHybridMode = !ewHybridMode;
    $('btn-ew-hybrid').classList.toggle('active', ewHybridMode);
    setElsewhereStation(atlas.ewIdx, false);
  });
  $('btn-ew-black').addEventListener('click', () => {
    const by = Math.max(groundAt(BLACK_ANCHOR.x, BLACK_ANCHOR.z), 0.5);
    flyCameraTo(new THREE.Vector3(BLACK_ANCHOR.x + 80, by + 48, BLACK_ANCHOR.z + 80), new THREE.Vector3(BLACK_ANCHOR.x, by + 2, BLACK_ANCHOR.z));
  });
}

// Mode Tab Clicks & Shared Pilot Controls
document.querySelectorAll('#mode-tabs .pill').forEach((btn) => {
  btn.addEventListener('click', () => setAtlasMode(btn.dataset.mode));
});

$('btn-compact-left').addEventListener('click', () => {
  const d = $('left-details');
  const hidden = d.style.display === 'none';
  d.style.display = hidden ? '' : 'none';
  $('btn-compact-left').textContent = hidden ? 'Compact' : 'Expand';
});

$('btn-pilot-door').addEventListener('click', () => {
  const next = !pilot.doorOpen;
  savePilotState({ doorOpen: next, building: 'severn' });
  pilot = { ...pilot, doorOpen: next };
  if (shaderSuite?.audio) {
    shaderSuite.audio.setDoorOpen?.(next, true);
    shaderSuite.audio.playDoorTransition?.(next);
  }
  syncPilotUI();
  setWorldSpeech(
    new THREE.Vector3(SEVERN_POS.x, SEVERN_POS.y + 4.2, SEVERN_POS.z + 6.0),
    'SEVERN THRESHOLD DOOR',
    next ? 'Door opened (13.5 kHz): acoustic field rings expanded.' : 'Door closed (580 Hz): street bed muffled.',
    3000
  );
});

$('btn-pilot-parcel').addEventListener('click', () => {
  const next = (pilot.parcelHolder || 'player') === 'player' ? 'bekele' : 'player';
  savePilotState({ parcelHolder: next, building: 'severn' });
  pilot = { ...pilot, parcelHolder: next };
  syncPilotUI();
  setWorldSpeech(
    new THREE.Vector3(SEVERN_POS.x - 0.8, SEVERN_POS.y + 2.4, SEVERN_POS.z + 3.6),
    'PARCEL LEDGER SYNCED',
    `Severn parcel & 5L cyan canister held by ${next.toUpperCase()}.`,
    3000
  );
});

$('btn-pilot-rev').addEventListener('click', () => {
  atlas.inStreetCorridor = false;
  streetCorridorRig.visible = false;
  controls.enabled = true;
  atlas.reverseAngle = !atlas.reverseAngle;
  $('btn-pilot-rev').classList.toggle('active', atlas.reverseAngle);
  if (atlas.reverseAngle) {
    flyCameraTo(
      new THREE.Vector3(SEVERN_POS.x, SEVERN_POS.y + 1.85, SEVERN_POS.z + 1.2),
      new THREE.Vector3(SEVERN_POS.x + 2, SEVERN_POS.y + 1.6, SEVERN_POS.z + 14),
      0.8
    );
  } else {
    focusSevernPilot(false);
  }
});

// ---------------------------------------------------------------------------
// 9b. Unified In-World 3D Hover, Click, Street-Corridor Wheel & WASD Scrubbing
// ---------------------------------------------------------------------------
const worldWhisperEl = $('world-whisper');
const worldSpeechEl = $('world-speech');
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
let hoveredMapsTarget = null;
let downPt = null;
let corridorDrag = null;
const moveKeys = {};
let worldRig = null;

function pickMapsTargetAt(clientX, clientY) {
  mouseNDC.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouseNDC, camera);

  if (worldRig && worldRig.hitMeshes && worldRig.hitMeshes.length > 0) {
    const rigHits = raycaster.intersectObjects(worldRig.hitMeshes, false);
    if (rigHits.length > 0 && rigHits[0].distance < 75) {
      return { kind: 'world-rig', hit: rigHits[0] };
    }
  }

  const hits = raycaster.intersectObjects(mapsPickables, false);
  for (let i = 0; i < hits.length; i++) {
    const info = hits[i].object.userData.mapsDiegetic;
    if (!info) continue;
    if ((info.kind === 'ascent-beam' || info.kind === 'corridor-turn') && !atlas.inStreetCorridor) continue;
    return { ...info, hit: hits[i] };
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  downPt = { x: e.clientX, y: e.clientY, moved: 0 };
  if (atlas.inStreetCorridor) {
    corridorDrag = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('pointermove', (e) => {
  if (downPt) {
    downPt.moved += Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y);
    downPt.x = e.clientX;
    downPt.y = e.clientY;
  }
  if (corridorDrag && atlas.inStreetCorridor) {
    const dx = e.clientX - corridorDrag.x;
    const dy = e.clientY - corridorDrag.y;
    corridorDrag.x = e.clientX;
    corridorDrag.y = e.clientY;
    atlas.mmYawOffset -= dx * 0.0048;
    atlas.mmPitch = THREE.MathUtils.clamp(atlas.mmPitch - dy * 0.0042, -0.35, 0.78);
    // Pulling camera pitch strongly skyward (> 0.68 rad) rises cleanly back to aerial overview!
    if (atlas.mmPitch > 0.68) {
      corridorDrag = null;
      ascendToLivingOverview();
      return;
    }
    syncMovieMapPose(true);
    return;
  }

  if (e.target === canvas && (!downPt || downPt.moved < 5)) {
    const picked = pickMapsTargetAt(e.clientX, e.clientY);
    hoveredMapsTarget = picked && picked.kind !== 'world-rig' ? picked : null;
    if (!picked || picked.kind !== 'world-rig') {
      canvas.style.cursor = hoveredMapsTarget ? 'pointer' : atlas.inStreetCorridor ? 'grab' : 'default';
    }
  } else {
    hoveredMapsTarget = null;
  }
});

window.addEventListener('pointerup', (e) => {
  const cleanClick = downPt && downPt.moved < 7 && e.button === 0 && e.target === canvas;
  downPt = null;
  corridorDrag = null;
  if (!cleanClick) return;

  const picked = pickMapsTargetAt(e.clientX, e.clientY);
  if (picked) {
    if (picked.kind === 'world-rig') return;
    if (picked.kind === 'severn-doorway') {
      const dest = e.shiftKey ? '../' : '../island/';
      if (shaderSuite?.audio) shaderSuite.audio.playDoorTransition?.(true);
      window.location.href = `${dest}${formatPilotHash(pilot)}`;
      return;
    }
    if (picked.kind === 'severn-door-leaf') {
      $('btn-pilot-door').click();
      return;
    }
    if (picked.kind === 'bekele') {
      $('btn-pilot-parcel').click();
      return;
    }
    if (picked.kind === 'shot-frame') {
      enterStreetCorridor(picked.frame.edgeIdx, picked.frame.stepIdx, true);
      return;
    }
    if (picked.kind === 'corridor-turn') {
      enterStreetCorridor(picked.edgeIdx, picked.startStep, true);
      return;
    }
    if (picked.kind === 'ascent-beam') {
      ascendToLivingOverview();
      return;
    }
    if (picked.kind === 'era-stele') {
      if (applyEraGlobal) applyEraGlobal(picked.stele.eraIdx, true);
      const signedLvl = `${atlas.floodTargetY >= 0 ? '+' : ''}${atlas.floodTargetY.toFixed(2)}m`;
      setWorldSpeech(
        picked.getAnchor(),
        `ERA ${picked.stele.eraIdx} · ${cityMeta.eras[picked.stele.eraIdx].toUpperCase()}`,
        `Flood water plane at ${signedLvl} · ${cityMeta.lore[picked.stele.eraIdx]}`,
        3800
      );
      return;
    }
    if (picked.kind === 'aura-lantern') {
      toggleAuraLantern(picked.lantern);
      return;
    }
    if (picked.kind === 'elsewhere-fold') {
      const rh = ewStations[atlas.ewIdx].x.rh;
      const next = rh && rh.length ? rh[0] : (atlas.ewIdx + 17) % ewStations.length;
      setElsewhereStation(next, false);
      const st = ewStations[atlas.ewIdx];
      setWorldSpeech(
        picked.getAnchor(),
        `ELSEWHERE SPATIAL RHYME · ${st.cid}`,
        `Unfurled Poem ${st.poem || '01'} skyline relief (Horizon ${(st.hz || 0.5).toFixed(2)}).`,
        3400
      );
      return;
    }
    if (picked.kind === 'black-zone') {
      savePilotState({ poem: '14', district: 'the-black' });
      const by = Math.max(groundAt(BLACK_ANCHOR.x, BLACK_ANCHOR.z), 0.5);
      flyCameraTo(
        new THREE.Vector3(BLACK_ANCHOR.x + 70, by + 38, BLACK_ANCHOR.z + 70),
        new THREE.Vector3(BLACK_ANCHOR.x, by + 2, BLACK_ANCHOR.z)
      );
      setWorldSpeech(
        picked.getAnchor(),
        'THE BLACK · POEM 14',
        'Isolated nongeographic threshold outside the street graph.',
        3400
      );
      return;
    }
  }

  // Fallback raycast against 767 Shot Pins, Terraced Structures, and Landmarks
  mouseNDC.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObjects([shotPinsMesh, terracedGroup, bldInstMesh], true);
  if (!hits.length) return;
  const h = hits[0];
  if (h.object === shotPinsMesh && h.instanceId != null) {
    const s = shots[h.instanceId];
    let bestE = 0;
    let bestD = Infinity;
    mmEdges.forEach((edge, idx) => {
      const d = Math.hypot(edge.pts[0] - s.x, edge.pts[1] - s.y);
      if (d < bestD) { bestD = d; bestE = idx; }
    });
    enterStreetCorridor(bestE, 0, true);
    return;
  }
  let p = h.object;
  while (p && !p.userData?.structure) p = p.parent;
  if (p && p.userData?.structure) {
    const st = p.userData.structure;
    setWorldSpeech(
      h.point.clone().add(new THREE.Vector3(0, 6, 0)),
      'TERRACED STRUCTURE (INFERRED)',
      `Remastered ${st.t} · Cornice setbacks + glass lightwell (${st.causes?.length || 0} witness shots).`,
      3200
    );
  }
});

// Seamless Mousewheel Scrubbing along Street Corridor (or Pull-Up to Ascend!)
canvas.addEventListener(
  'wheel',
  (e) => {
    if (!atlas.inStreetCorridor) return;
    e.preventDefault();
    // If looking upward (pitch > 0.22) and scrolling backward/out, rise back to aerial overview!
    if (atlas.mmPitch > 0.22 && e.deltaY > 0) {
      ascendToLivingOverview();
      return;
    }
    const st = edgeSteps(atlas.mmEdgeIdx);
    const stepDelta = -e.deltaY * 0.014;
    const nextStep = atlas.mmStepFloat + stepDelta;
    if (nextStep < -0.6 && e.deltaY > 0) {
      ascendToLivingOverview();
      return;
    }
    atlas.mmStepFloat = THREE.MathUtils.clamp(nextStep, 0, Math.max(0, st.length - 1));
    syncMovieMapPose(true);
  },
  { passive: false }
);

// ---------------------------------------------------------------------------
// 10. Interactive 2D Cartography & Camera Frustum Canvas (Tab Drawer Only)
// ---------------------------------------------------------------------------
const map2d = $('atlas-2d-canvas');
const ctx2d = map2d.getContext('2d');

function draw2DCartography() {
  const cw = map2d.width;
  const ch = map2d.height;
  ctx2d.fillStyle = '#071426';
  ctx2d.fillRect(0, 0, cw, ch);

  for (let j = 0; j < NY; j += 3) {
    for (let i = 0; i < NX; i += 3) {
      const h = H_GRID[j * NX + i] / 10;
      if (h < 0) continue;
      const sx = ((i * CELL) / W) * cw;
      const sy = ((j * CELL) / H) * ch;
      ctx2d.fillStyle = h < 4.2 && atlas.saltDatumOn ? '#264258' : h > 50 ? '#2b3d38' : '#192c3e';
      ctx2d.fillRect(sx, sy, 5, 5);
    }
  }

  ctx2d.strokeStyle = 'rgba(203, 177, 130, 0.45)';
  ctx2d.lineWidth = 0.9;
  for (let i = 0; i < cityLayers.roads.length; i += 3) {
    const [cls, , flat] = cityLayers.roads[i];
    if (cls < 1) continue;
    ctx2d.beginPath();
    for (let k = 0; k < flat.length; k += 2) {
      const sx = (flat[k] / W) * cw;
      const sy = (flat[k + 1] / H) * ch;
      if (k === 0) ctx2d.moveTo(sx, sy);
      else ctx2d.lineTo(sx, sy);
    }
    ctx2d.stroke();
  }

  for (const d of cityMeta.districts) {
    const sx = (d.x / W) * cw;
    const sy = (d.y / H) * ch;
    ctx2d.strokeStyle = 'rgba(24, 180, 255, 0.25)';
    ctx2d.beginPath();
    ctx2d.arc(sx, sy, Math.max(4, (d.r / W) * cw), 0, Math.PI * 2);
    ctx2d.stroke();
  }

  ctx2d.save();
  ctx2d.setLineDash([3, 3]);
  ctx2d.strokeStyle = '#c98cff';
  ctx2d.lineWidth = 1.4;
  ctx2d.beginPath();
  ctx2d.arc((BLACK_ANCHOR.x / W) * cw, (BLACK_ANCHOR.z / H) * ch, 7, 0, Math.PI * 2);
  ctx2d.stroke();
  ctx2d.restore();

  const svX = (SEVERN_POS.x / W) * cw;
  const svY = (SEVERN_POS.z / H) * ch;
  ctx2d.fillStyle = '#f2a541';
  ctx2d.beginPath();
  ctx2d.arc(svX, svY, 4.5, 0, Math.PI * 2);
  ctx2d.fill();

  const camX = (camera.position.x / W) * cw;
  const camY = (camera.position.z / H) * ch;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const ang = Math.atan2(dir.z, dir.x);
  ctx2d.fillStyle = 'rgba(24, 180, 255, 0.28)';
  ctx2d.beginPath();
  ctx2d.moveTo(camX, camY);
  ctx2d.arc(camX, camY, 18, ang - 0.42, ang + 0.42);
  ctx2d.closePath();
  ctx2d.fill();
  ctx2d.fillStyle = '#ffffff';
  ctx2d.beginPath();
  ctx2d.arc(camX, camY, 3, 0, Math.PI * 2);
  ctx2d.fill();
}

map2d.addEventListener('click', (e) => {
  const r = map2d.getBoundingClientRect();
  const wx = ((e.clientX - r.left) / r.width) * W;
  const wz = ((e.clientY - r.top) / r.height) * H;
  $('cursor-coords').textContent = `X ${Math.round(wx)} · Y ${Math.round(wz)}`;

  if (Math.hypot(wx - SEVERN_POS.x, wz - SEVERN_POS.z) < 220) {
    focusSevernPilot(false);
    return;
  }
  const wy = Math.max(groundAt(wx, wz), 0.5);
  if (atlas.inStreetCorridor) {
    let bestE = 0, bestD = Infinity;
    mmEdges.forEach((edge, idx) => {
      const d = Math.hypot(edge.pts[0] - wx, edge.pts[1] - wz);
      if (d < bestD) { bestD = d; bestE = idx; }
    });
    enterStreetCorridor(bestE, 0, true);
  } else {
    flyCameraTo(new THREE.Vector3(wx + 95, wy + 58, wz + 95), new THREE.Vector3(wx, wy + 8, wz));
  }
});

window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  moveKeys[k] = true;
  if (k === 'escape' || k === 'q') {
    if (atlas.inStreetCorridor) ascendToLivingOverview();
  } else if (k === 'o') $('btn-pilot-door').click();
  else if (k === 'e') $('btn-pilot-parcel').click();
  else if (k === 'r') $('btn-pilot-rev').click();
});
window.addEventListener('keyup', (e) => {
  moveKeys[e.key.toLowerCase()] = false;
});

// ---------------------------------------------------------------------------
// 11. Mount Universal 23-Look GPU Shader Suite + Curb Brass Camera Tripod
// ---------------------------------------------------------------------------
shaderSuite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: pilot.shader || 'weave',
  locationName: 'Unified City3D & MovieMap Atlas',
  cartridgeName: 'Atlantis',
  onTimeChange: (timeKey) => {
    const mapH = { dawn: 6.2, midday: 12.5, golden: 17.6, bluehour: 18.6, night: 22.5 };
    const h = typeof timeKey === 'number' ? timeKey : (mapH[timeKey] ?? 18.6);
    applyHourToAtlasSky(h);
  },
});

{
  const tripX = SEVERN_POS.x + 11.5;
  const tripZ = SEVERN_POS.z + 13.5;
  const tripY = Math.max(groundAt(tripX, tripZ), SEVERN_POS.y);
  const nolliX = SEVERN_POS.x - 13.5;
  const nolliZ = SEVERN_POS.z + 11.5;
  worldRig = createWorldPortalAndTripod({
    THREE,
    scene,
    camera,
    domElement: canvas,
    suite: shaderSuite,
    tripodPos: {
      x: tripX,
      y: tripY,
      z: tripZ,
      rotY: -0.65,
      scale: 1.55,
    },
    portals: [
      {
        id: 'nolli',
        label: 'Nolli Block & Screening Hall',
        href: '../',
        pos: [nolliX, Math.max(groundAt(nolliX, nolliZ), SEVERN_POS.y), nolliZ],
        rotY: 0.35,
        scale: 1.35,
        color: '#e0b46a',
      },
    ],
  });
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

applyHourToAtlasSky(pilot.worldTime ?? 18.5);
syncPilotUI();
focusSevernPilot(true);

// Handle #moviemap / #mood / #elsewhere deep links cleanly
if (window.location.hash.includes('moviemap')) enterStreetCorridor(severnEdgeIdx, 3, false);
else if (window.location.hash.includes('mood')) {
  moodGroup.visible = true;
  selectMoodDistrict(0, false);
}

const clock = new THREE.Clock();
let mapTimer = 0;
let mmDriveAcc = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  skyUniforms.uTime.value = elapsed;
  waterUniforms.uTime.value = elapsed;
  floodUniforms.uTime.value = elapsed;
  ascentBeamMat.uniforms.uTime.value = elapsed;
  skyDome.position.copy(camera.position);

  // Smooth +4.00m physical flood water plane transition across Historical Eras 0..5
  atlas.floodCurrentY += (atlas.floodTargetY - atlas.floodCurrentY) * Math.min(1, dt * 4.5);
  floodWaterMesh.position.y = atlas.floodCurrentY;
  floodUniforms.uOpacity.value += (atlas.floodTargetOpacity - floodUniforms.uOpacity.value) * Math.min(1, dt * 4.5);

  // Animate Era Stelae crowns & District Aura Lantern harmonic rings
  for (let i = 0; i < eraStelae.length; i++) {
    eraStelae[i].crown.rotation.y = elapsed * 0.75 + i;
  }
  for (let i = 0; i < auraLanterns.length; i++) {
    auraLanterns[i].harmRing.rotation.y = elapsed * 1.1 + i * 0.5;
  }

  // Smooth camera flight
  if (atlas.flyAnim) {
    atlas.flyAnim.elapsed += dt;
    const u = Math.min(1, atlas.flyAnim.elapsed / atlas.flyAnim.dur);
    const k = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) * 0.5;
    camera.position.lerpVectors(atlas.flyAnim.p0, atlas.flyAnim.p1, k);
    controls.target.lerpVectors(atlas.flyAnim.t0, atlas.flyAnim.t1, k);
    camera.lookAt(controls.target);
    if (u >= 1) {
      const doneCb = atlas.flyAnim.onDone;
      atlas.flyAnim = null;
      if (typeof doneCb === 'function') doneCb();
    }
  } else if (atlas.inStreetCorridor) {
    // WASD / ArrowKey continuous MovieMap street corridor scrubbing
    const fwd = (moveKeys['w'] || moveKeys['arrowup'] ? 1 : 0) - (moveKeys['s'] || moveKeys['arrowdown'] ? 1 : 0);
    const turn = (moveKeys['d'] || moveKeys['arrowright'] ? 1 : 0) - (moveKeys['a'] || moveKeys['arrowleft'] ? 1 : 0);
    const boost = moveKeys['shift'] ? 2.2 : 1.0;
    if (Math.abs(fwd) > 0.01 || Math.abs(turn) > 0.01) {
      const st = edgeSteps(atlas.mmEdgeIdx);
      atlas.mmStepFloat = THREE.MathUtils.clamp(atlas.mmStepFloat + fwd * dt * 4.8 * boost, 0, Math.max(0, st.length - 1));
      atlas.mmYawOffset -= turn * dt * 1.45;
      syncMovieMapPose(true);
    }
  } else if (controls.enabled) {
    // Aerial WASD gentle glide across the terraced city when in overview
    const fwd = (moveKeys['w'] || moveKeys['arrowup'] ? 1 : 0) - (moveKeys['s'] || moveKeys['arrowdown'] ? 1 : 0);
    const str = (moveKeys['d'] || moveKeys['arrowright'] ? 1 : 0) - (moveKeys['a'] || moveKeys['arrowleft'] ? 1 : 0);
    if (Math.abs(fwd) > 0.01 || Math.abs(str) > 0.01) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.y = 0;
      dir.normalize();
      const right = new THREE.Vector3(-dir.z, 0, dir.x);
      const spd = (moveKeys['shift'] ? 180 : 85) * dt;
      const delta = dir.multiplyScalar(fwd * spd).addScaledVector(right, str * spd);
      camera.position.add(delta);
      controls.target.add(delta);
    }
    controls.update();
  }

  // Severn Threshold Door animation
  const targetAng = pilot.doorOpen ? -Math.PI * 0.58 : 0;
  severnAtlas.doorAngle += (targetAng - severnAtlas.doorAngle) * Math.min(1, dt * 8.5);
  if (severnAtlas.doorPivot) severnAtlas.doorPivot.rotation.y = severnAtlas.doorAngle;

  // Acoustic field ring animation coupled to Severn Door state!
  if (moodGroup.visible && atlas.acousticOn) {
    const spread = pilot.doorOpen ? 1.0 : 0.42;
    severnAtlas.acousticRings.forEach((ring, idx) => {
      const pulse = 1 + Math.sin(elapsed * 2.2 - idx * 0.7) * 0.08;
      ring.scale.setScalar(spread * pulse);
      ring.material.opacity = (pilot.doorOpen ? 0.42 : 0.18) * (1 - idx * 0.14);
    });
  }

  // MovieMap auto-drive along street steps (if triggered via Tab drawer)
  if (atlas.inStreetCorridor && atlas.mmPlaying) {
    mmDriveAcc += dt;
    if (mmDriveAcc > 0.05) {
      const st = edgeSteps(atlas.mmEdgeIdx);
      if (atlas.mmStepFloat < st.length - 1) {
        atlas.mmStepFloat = Math.min(st.length - 1, atlas.mmStepFloat + dt * 3.8);
        syncMovieMapPose(true);
      } else {
        atlas.mmPlaying = false;
        $('btn-mm-play').classList.remove('active');
        $('btn-mm-play').textContent = 'Drive Street';
      }
      mmDriveAcc = 0;
    }
  }

  if (severnAtlas.bekeleActor?.v8?.update) {
    severnAtlas.bekeleActor.v8.setGroundY(severnAtlas.bekeleActor.root.position.y);
    severnAtlas.bekeleActor.v8.update(dt);
  }
  if (severnAtlas.playerActor?.v8?.update) {
    severnAtlas.playerActor.v8.setGroundY(severnAtlas.playerActor.root.position.y);
    severnAtlas.playerActor.v8.update(dt);
  }

  // World-Projected Unboxed 1-Line Hover Whisper & Action Speech (never overlapping)
  const speechActive = Boolean(worldSpeechState && performance.now() < worldSpeechState.until);
  if (!speechActive && hoveredMapsTarget && typeof hoveredMapsTarget.getAnchor === 'function') {
    const prj = projectWorldLabel(camera, hoveredMapsTarget.getAnchor(), canvas);
    if (prj.visible) {
      worldWhisperEl.textContent = hoveredMapsTarget.getWhisper();
      worldWhisperEl.style.left = `${Math.round(prj.x)}px`;
      worldWhisperEl.style.top = `${Math.round(Math.max(22, prj.y - 8))}px`;
      worldWhisperEl.style.display = 'block';
    } else {
      worldWhisperEl.style.display = 'none';
    }
  } else {
    worldWhisperEl.style.display = 'none';
  }

  if (speechActive) {
    const prj = projectWorldLabel(camera, worldSpeechState.anchorVec3, canvas);
    if (prj.visible) {
      worldSpeechEl.innerHTML = '';
      const bEl = document.createElement('b');
      bEl.textContent = worldSpeechState.speaker;
      const sEl = document.createElement('span');
      sEl.textContent = worldSpeechState.text;
      worldSpeechEl.append(bEl, sEl);
      worldSpeechEl.style.left = `${Math.round(THREE.MathUtils.clamp(prj.x, 220, window.innerWidth - 220))}px`;
      worldSpeechEl.style.top = `${Math.round(THREE.MathUtils.clamp(prj.y - 12, 36, window.innerHeight - 36))}px`;
      worldSpeechEl.style.display = 'block';
    } else {
      worldSpeechEl.style.display = 'none';
    }
  } else {
    worldSpeechState = null;
    worldSpeechEl.style.display = 'none';
  }

  if (worldRig) {
    worldRig.update(camera.position);
  }

  if (shaderSuite) {
    shaderSuite.updateAudio(dt, {
      isInside: !pilot.doorOpen && camera.position.distanceTo(new THREE.Vector3(SEVERN_POS.x, SEVERN_POS.y, SEVERN_POS.z)) < 16,
      nightMix: 0.65,
      submerged: false,
      moving: atlas.mmPlaying,
      projectorDist: 18,
      projectorWet: !!pilot.coolingWet,
    });
  }

  keyLight.position.set(camera.position.x + 380, camera.position.y + 480, camera.position.z + 320);
  keyLight.target.position.copy(controls.target);

  if (document.body.classList.contains('mp-tab-open')) {
    mapTimer += dt;
    if (mapTimer > 0.25) {
      mapTimer = 0;
      draw2DCartography();
    }
  }

  shaderSuite.render(scene, camera);
});
