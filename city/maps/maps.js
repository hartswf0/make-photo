import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mountWebGLShaderSuite } from '../shader-suite-bar.js';
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

// +4m Flood Datum Salt Line Band (Brief 5 & 6: explicit +4m datum)
const saltDatumPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(W, H),
  new THREE.MeshBasicMaterial({
    color: '#efeadd',
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
);
saltDatumPlane.rotation.x = -Math.PI / 2;
saltDatumPlane.position.set(W * 0.5, 4.0, H * 0.5);
cityWorldGroup.add(saltDatumPlane);

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
    // Clear around The Severn hero & terraced structure footprints
    if (Math.hypot(x - SEVERN_POS.x, z - SEVERN_POS.z) < 26) continue;
    if (extraClearFootprints.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)) continue;

    // Rescale excessive generic tower heights into believable urban fabric
    let h = st === 3 ? Math.min(rawH, 18 + rawH * 0.42) : Math.min(rawH, 32);
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

  // Operable Threshold Door at (-1.35, 0.2, 6.0)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-1.35, 0.2, 6.0);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.65, 3.0, 0.14), matTimber);
  leaf.position.set(1.32, 1.5, 0);
  doorPivot.add(leaf);
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

  // Warm vestibule lamp
  const pLight = new THREE.PointLight('#ffb464', 2.8, 28, 1.5);
  pLight.position.set(0, 3.5, 2.5);
  g.add(pLight);

  g.userData = { severnPilot: true, provenance: 'checked' };
  cityWorldGroup.add(g);

  severnAtlas.bekeleActor = spawnAtlasAnny('adult_m', '#9c6840', SEVERN_POS.x - 0.8, SEVERN_POS.y + 0.2, SEVERN_POS.z + 3.6, 0.2);
  severnAtlas.playerActor = spawnAtlasAnny('adult_f', '#255a7a', SEVERN_POS.x + 0.9, SEVERN_POS.y + 0.2, SEVERN_POS.z + 8.2, Math.PI - 0.2);

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
  const blackDisc = new THREE.Mesh(
    new THREE.RingGeometry(BLACK_ANCHOR.r - 3, BLACK_ANCHOR.r, 64),
    new THREE.MeshBasicMaterial({ color: '#c98cff', side: THREE.DoubleSide })
  );
  blackDisc.rotation.x = -Math.PI / 2;
  blackDisc.position.set(BLACK_ANCHOR.x, Math.max(groundAt(BLACK_ANCHOR.x, BLACK_ANCHOR.z), 0.5) + 1.0, BLACK_ANCHOR.z);
  cityWorldGroup.add(blackDisc);
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
// 7. Mood Topography & Acoustic Field Group (Mode 3)
// ---------------------------------------------------------------------------
const moodGroup = new THREE.Group();
moodGroup.visible = false;
scene.add(moodGroup);

const moodDistricts = moodAtlas.city.districts || [];
const moodBeacons = [];

{
  for (let i = 0; i < moodDistricts.length; i++) {
    const md = moodDistricts[i];
    // Map SVG 600x480 coords into 8000x6000 City3D space (or match city.json district)
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

    // Sodium vs Cyan twin light-tech columns
    const sodH = 26 + sodiumShare * 140;
    const cyanH = 34 + (1 - sodiumShare) * 95;
    const sodPillar = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6.5, sodH, 16), matSodiumGlow);
    sodPillar.position.set(wx - 11, wy + sodH * 0.5, wz);
    const cyanPillar = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6.5, cyanH, 16), matCyanBand);
    cyanPillar.position.set(wx + 11, wy + cyanH * 0.5, wz);
    moodGroup.add(sodPillar, cyanPillar);

    moodBeacons.push({ md, wx, wy, wz, auraDome, sodPillar, cyanPillar });
  }

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
// 8. Elsewhere Hybrid 3D Fold Stage (Mode 4)
// ---------------------------------------------------------------------------
const elsewhereGroup = new THREE.Group();
elsewhereGroup.visible = false;
scene.add(elsewhereGroup);

const ewStations = mmElsewhere.elsewhere.stations;
let ewHybridMode = true;

function buildElsewhereStage(stationIdx) {
  elsewhereGroup.clear();
  const st = ewStations[stationIdx] || ewStations[0];
  elsewhereGroup.position.set(SEVERN_POS.x, SEVERN_POS.y + 85, SEVERN_POS.z);

  // Navigable dark basalt stage floor
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(34, 0.4, 34),
    new THREE.MeshStandardMaterial({ color: '#132438', roughness: 0.22, metalness: 0.25 })
  );
  floor.position.set(0, -0.2, 0);
  elsewhereGroup.add(floor);

  // Horizon & Skyline Folded Architectural Relief Planes from station.prof & station.enc
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

  // Solid 3D foreground threshold doorway, step & handrail (Brief 7 hybrid set!)
  const step = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.32, 2.4), matCornice);
  step.position.set(0, 0.16, -3.5);
  const archL = new THREE.Mesh(new THREE.BoxGeometry(0.65, 3.8, 0.65), matTimber);
  archL.position.set(-1.7, 1.9, -3.5);
  const archR = new THREE.Mesh(new THREE.BoxGeometry(0.65, 3.8, 0.65), matTimber);
  archR.position.set(1.7, 1.9, -3.5);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.55, 0.75), matCornice);
  lintel.position.set(0, 3.95, -3.5);
  const cyanPortal = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.6, 10), matCyanBand);
  cyanPortal.position.set(2.2, 1.8, -3.2);
  elsewhereGroup.add(step, archL, archR, lintel, cyanPortal);

  // Draw Skyline · Horizon · Vanishing Point Phenotype Graph
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
  era: parseEraIndex(pilot.era),
  variantIdx: 2, // 'the mixed city'
  saltDatumOn: true,
  reverseAngle: false,
  mmEdgeIdx: severnEdgeIdx,
  mmStepIdx: 4,
  mmView: 0, // 0 front, 1 right, 2 back, 3 left
  mmPlaying: false,
  mmCardOn: true,
  moodIdx: 0,
  acousticOn: true,
  ewIdx: 0,
  flyAnim: null,
};

function showToast(kicker, body) {
  $('toast-kicker').textContent = kicker;
  $('toast-body').textContent = body;
  $('inspector-toast').classList.add('visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => $('inspector-toast').classList.remove('visible'), 4200);
}

function flyCameraTo(pos, target, dur = 1.1) {
  atlas.flyAnim = {
    p0: camera.position.clone(),
    p1: pos.clone(),
    t0: controls.target.clone(),
    t1: target.clone(),
    elapsed: 0,
    dur,
  };
}

function focusSevernPilot(instant = false) {
  atlas.reverseAngle = false;
  const p = new THREE.Vector3(SEVERN_POS.x + 28, SEVERN_POS.y + 18, SEVERN_POS.z + 42);
  const t = new THREE.Vector3(SEVERN_POS.x, SEVERN_POS.y + 8.5, SEVERN_POS.z + 2);
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

// Switch between the 4 Unified Modes
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

  cityWorldGroup.visible = mode !== 'elsewhere';
  moodGroup.visible = mode === 'mood';
  elsewhereGroup.visible = mode === 'elsewhere';
  shotFrameCard.visible = mode === 'moviemap' && atlas.mmCardOn;
  controls.enabled = mode === 'city3d' || mode === 'mood' || mode === 'elsewhere';

  if (mode === 'city3d') {
    $('mode-headline').textContent = 'City3D Remastered · Terraced Masonry';
    $('mode-subtitle').textContent = '4,800 buildings · 33 landmarks · +4m salt datum · zero grain';
    focusSevernPilot(false);
  } else if (mode === 'moviemap') {
    $('mode-headline').textContent = 'MovieMap Director · Street-Edge Scrub';
    $('mode-subtitle').textContent = '767 registered shots · 3m centerline frames · smooth non-grainy 3D';
    syncMovieMapPose();
  } else if (mode === 'mood') {
    $('mode-headline').textContent = 'Mood Topography · Aura & Acoustic Field';
    $('mode-subtitle').textContent = '12 measured districts · sodium vs cyan aura · doorway acoustics';
    selectMoodDistrict(atlas.moodIdx);
  } else if (mode === 'elsewhere') {
    $('mode-headline').textContent = 'Elsewhere Jump · Seed & Spatial Rhyme';
    $('mode-subtitle').textContent = '240 folded stations · deterministic seed 2086 · hybrid 3D threshold';
    jumpElsewhereBySeed(Number($('inp-ew-seed').value) || 2086);
  }
}

// Mode 1 Setup: Era Slider, Structure Variants, Landmarks
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
    showToast('LANDMARK RECORDED', `${lm.name} · Poem ${lm.poem || '—'} · ${lm.evidence.length} archive witness shots.`);
  });

  const applyEra = (eVal) => {
    atlas.era = eVal;
    $('sl-era').value = String(eVal);
    $('val-era').textContent = `${eVal} · ${cityMeta.eras[eVal]}`;
    $('era-lore').textContent = cityMeta.lore[eVal];
    rebuildStructuresVariant(atlas.variantIdx, eVal);
    savePilotState({ era: eVal });
  };
  $('sl-era').addEventListener('input', (e) => applyEra(Number(e.target.value)));
  applyEra(atlas.era);

  $('btn-fly-severn').addEventListener('click', () => focusSevernPilot(false));
  $('btn-salt-datum').addEventListener('click', () => {
    atlas.saltDatumOn = !atlas.saltDatumOn;
    saltDatumPlane.visible = atlas.saltDatumOn;
    $('btn-salt-datum').classList.toggle('active', atlas.saltDatumOn);
  });
  $('btn-Aerial-Overview').addEventListener('click', () => {
    flyCameraTo(new THREE.Vector3(2520, 260, 2860), new THREE.Vector3(2180, 22, 2240), 1.3);
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
    applyEra(0);
    $('btn-play-eras').textContent = 'Stop Eras';
    eraTimer = setInterval(() => {
      e++;
      if (e > 5) {
        clearInterval(eraTimer);
        eraTimer = null;
        $('btn-play-eras').textContent = 'Play Eras';
        return;
      }
      applyEra(e);
    }, 2400);
  });
}

// Mode 2 Setup: MovieMap Street Scrubbing & Shot Pins
function syncMovieMapPose() {
  if (atlas.mode !== 'moviemap') return;
  const st = edgeSteps(atlas.mmEdgeIdx);
  atlas.mmStepIdx = THREE.MathUtils.clamp(atlas.mmStepIdx, 0, st.length - 1);
  const [sx, sz, baseHd] = st[atlas.mmStepIdx];
  const sy = Math.max(groundAt(sx, sz), 0.4) + 2.1;
  const viewHd = baseHd + atlas.mmView * (Math.PI * 0.5);

  const dx = Math.sin(viewHd);
  const dz = -Math.cos(viewHd);
  camera.position.set(sx, sy, sz);
  controls.target.set(sx + dx * 40, sy + 0.5, sz + dz * 40);
  camera.lookAt(controls.target);

  const e = mmEdges[atlas.mmEdgeIdx];
  const wayName = mmWays[e.w]?.name || 'Harbor Street';
  $('mm-street-name').textContent = `${wayName} · Segment #${e.id}`;
  $('mm-frame-readout').textContent = `Frame ${atlas.mmStepIdx + 1} / ${st.length}`;
  $('sl-mm-scrub').value = String(Math.round((atlas.mmStepIdx / Math.max(1, st.length - 1)) * 100));

  // Nearest registered shot along this street
  let bestShot = shots[0];
  let bestD = Infinity;
  for (let i = 0; i < shots.length; i++) {
    const d = Math.hypot(shots[i].x - sx, shots[i].y - sz);
    if (d < bestD) { bestD = d; bestShot = shots[i]; }
  }
  $('mm-cross-info').textContent = `Nearest Shot: ${bestShot.cid} (${Math.round(bestD)}m) · Zero-Grain Live 3D`;

  if (atlas.mmCardOn) {
    shotFrameCard.material.map?.dispose();
    shotFrameCard.material.map = createShotCardTexture(bestShot);
    shotFrameCard.material.needsUpdate = true;
    shotFrameCard.position.set(sx + dx * 15, sy + 0.8, sz + dz * 15);
    shotFrameCard.lookAt(camera.position);
    shotFrameCard.visible = true;
  } else {
    shotFrameCard.visible = false;
  }

  // Show corner turn buttons at end of street segment
  const turnEl = $('turn-overlay');
  if (atlas.mmStepIdx >= st.length - 1) {
    const node = e.b;
    const candidates = (nodeToEdges.get(node) || []).filter((idx) => idx !== atlas.mmEdgeIdx).slice(0, 4);
    if (candidates.length > 0) {
      turnEl.innerHTML = `<span class="kicker">CORNER INTERSECTION · CHOOSE STREET:</span>` +
        candidates.map((cIdx) => `<button class="pill cyan" type="button" data-edge="${cIdx}">${mmWays[mmEdges[cIdx].w]?.name || `Street ${cIdx}`}</button>`).join('');
      turnEl.classList.add('visible');
      turnEl.querySelectorAll('button[data-edge]').forEach((btn) => {
        btn.addEventListener('click', () => {
          atlas.mmEdgeIdx = Number(btn.dataset.edge);
          atlas.mmStepIdx = 0;
          turnEl.classList.remove('visible');
          syncMovieMapPose();
        });
      });
    }
  } else {
    turnEl.classList.remove('visible');
  }
}

{
  $('sl-mm-scrub').addEventListener('input', (e) => {
    const st = edgeSteps(atlas.mmEdgeIdx);
    // Reconstruct valid scene state cleanly without re-firing old events (Brief 9)
    atlas.mmStepIdx = Math.round((Number(e.target.value) / 100) * (st.length - 1));
    syncMovieMapPose();
  });
  document.querySelectorAll('#mm-views .pill[data-v]').forEach((btn) => {
    btn.addEventListener('click', () => {
      atlas.mmView = Number(btn.dataset.v);
      document.querySelectorAll('#mm-views .pill[data-v]').forEach((b) => b.classList.toggle('active', b === btn));
      syncMovieMapPose();
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
    syncMovieMapPose();
  });

  const shotSel = $('sel-mm-shot');
  shotSel.innerHTML = shots.slice(0, 80).map((s, idx) => `<option value="${idx}">${s.cid} · Poem ${s.poem || '01'} (${s.el})</option>`).join('');
  shotSel.addEventListener('change', () => {
    const s = shots[Number(shotSel.value)];
    if (!s) return;
    // Snap to street segment closest to this shot pin
    let bestE = 0, bestD = Infinity;
    mmEdges.forEach((edge, idx) => {
      const d = Math.hypot(edge.pts[0] - s.x, edge.pts[1] - s.y);
      if (d < bestD) { bestD = d; bestE = idx; }
    });
    atlas.mmEdgeIdx = bestE;
    atlas.mmStepIdx = 0;
    syncMovieMapPose();
  });
}

// Mode 3 Setup: Mood Topography & Acoustic Field
function selectMoodDistrict(idx) {
  atlas.moodIdx = THREE.MathUtils.clamp(idx, 0, moodBeacons.length - 1);
  const b = moodBeacons[atlas.moodIdx];
  if (!b) return;
  $('sel-mood-dist').value = String(atlas.moodIdx);
  $('mood-realm-tag').textContent = b.md.realm || 'Realm B';
  $('mood-quote').textContent = b.md.mood || '';
  $('mood-body-sw').innerHTML = (b.md.body || []).map((c) => `<span class="sw" style="background:${c}"></span>`).join('');
  $('mood-glow-sw').innerHTML = (b.md.glow || []).map((c) => `<span class="sw glow" style="background:${c};color:${c}"></span>`).join('');

  flyCameraTo(
    new THREE.Vector3(b.wx + 165, b.wy + 95, b.wz + 165),
    new THREE.Vector3(b.wx, b.wy + 24, b.wz),
    1.2
  );
}

{
  const mdSel = $('sel-mood-dist');
  mdSel.innerHTML = moodBeacons.map((b, i) => `<option value="${i}">${b.md.name} (${b.md.coords?.zone || 'Harbor'})</option>`).join('');
  mdSel.addEventListener('change', () => selectMoodDistrict(Number(mdSel.value)));

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
    flyCameraTo(new THREE.Vector3(3600, 1450, 5100), new THREE.Vector3(3400, 0, 2800), 1.4);
  });
}

// Mode 4 Setup: Elsewhere Seed / Coordinate / Spatial Rhyme Jumper
function setElsewhereStation(idx) {
  atlas.ewIdx = ((idx % ewStations.length) + ewStations.length) % ewStations.length;
  buildElsewhereStage(atlas.ewIdx);
  const center = elsewhereGroup.position;
  camera.position.set(center.x, center.y + 2.1, center.z + 8.5);
  controls.target.set(center.x, center.y + 2.2, center.z - 6);
  camera.lookAt(controls.target);
}

function jumpElsewhereBySeed(seedNum) {
  const idx = Math.abs(Math.imul(seedNum | 0, 2654435761)) % ewStations.length;
  savePilotState({ seed: seedNum });
  setElsewhereStation(idx);
}

{
  $('btn-ew-seed-go').addEventListener('click', () => {
    jumpElsewhereBySeed(Number($('inp-ew-seed').value) || 2086);
  });

  const poemSel = $('sel-ew-poem');
  poemSel.innerHTML = cityMeta.poems.map((p) => `<option value="${p.num}">Poem ${p.num} · ${p.title}</option>`).join('');
  poemSel.addEventListener('change', () => {
    const pNum = poemSel.value;
    if (pNum === '14') {
      showToast('NONGEOGRAPHIC THRESHOLD', 'Poem 14 (The Black) jumped via non-street account link.');
    }
    const found = ewStations.findIndex((s) => s.poem === pNum);
    setElsewhereStation(found >= 0 ? found : 0);
    savePilotState({ poem: pNum });
  });

  $('btn-ew-fwd').addEventListener('click', () => setElsewhereStation(ewStations[atlas.ewIdx].x.f));
  $('btn-ew-back').addEventListener('click', () => setElsewhereStation(ewStations[atlas.ewIdx].x.b));
  $('btn-ew-left').addEventListener('click', () => setElsewhereStation(ewStations[atlas.ewIdx].x.l));
  $('btn-ew-right').addEventListener('click', () => setElsewhereStation(ewStations[atlas.ewIdx].x.r));
  $('btn-ew-rhyme').addEventListener('click', () => {
    const rh = ewStations[atlas.ewIdx].x.rh;
    const next = rh && rh.length ? rh[0] : (atlas.ewIdx + 17) % ewStations.length;
    setElsewhereStation(next);
    showToast('SPATIAL RHYME', `Jumped to structural rhyme ${ewStations[next].cid} across unlike district.`);
  });
  $('btn-ew-hybrid').addEventListener('click', () => {
    ewHybridMode = !ewHybridMode;
    $('btn-ew-hybrid').classList.toggle('active', ewHybridMode);
    buildElsewhereStage(atlas.ewIdx);
  });
  $('btn-ew-black').addEventListener('click', () => {
    setAtlasMode('city3d');
    const by = Math.max(groundAt(BLACK_ANCHOR.x, BLACK_ANCHOR.z), 0.5);
    flyCameraTo(new THREE.Vector3(BLACK_ANCHOR.x + 80, by + 48, BLACK_ANCHOR.z + 80), new THREE.Vector3(BLACK_ANCHOR.x, by + 2, BLACK_ANCHOR.z));
    showToast('THE BLACK · NONGEOGRAPHIC', 'Explicitly isolated outside the street network (dashed violet ring).');
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
  if (shaderSuite?.audio) shaderSuite.audio.playDoorTransition(next);
  syncPilotUI();
  showToast('SEVERN THRESHOLD DOOR', next ? 'Door opened: interior vestibule & street sound coupled.' : 'Door closed: lobby sealed & street sound muffled.');
});

$('btn-pilot-parcel').addEventListener('click', () => {
  const next = (pilot.parcelHolder || 'player') === 'player' ? 'bekele' : 'player';
  savePilotState({ parcelHolder: next, building: 'severn' });
  pilot = { ...pilot, parcelHolder: next };
  syncPilotUI();
  showToast('PARCEL OWNERSHIP SYNCED', `Severn parcel now held by ${next.toUpperCase()} across Map, Island, Heroes, and Foundry.`);
});

$('btn-pilot-rev').addEventListener('click', () => {
  if (atlas.mode !== 'city3d') setAtlasMode('city3d');
  atlas.reverseAngle = !atlas.reverseAngle;
  $('btn-pilot-rev').classList.toggle('active', atlas.reverseAngle);
  if (atlas.reverseAngle) {
    flyCameraTo(
      new THREE.Vector3(SEVERN_POS.x, SEVERN_POS.y + 1.85, SEVERN_POS.z + 1.2),
      new THREE.Vector3(SEVERN_POS.x + 2, SEVERN_POS.y + 1.6, SEVERN_POS.z + 14),
      0.8
    );
    showToast('REVERSE THRESHOLD ANGLE', 'Looking out from Severn vestibule across Bekele and threshold door.');
  } else {
    focusSevernPilot(false);
  }
});

// 3D Viewport Picking (Buildings, Landmarks, Terraced Structures, Shot Pins)
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
let downPt = null;
canvas.addEventListener('pointerdown', (e) => { downPt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!downPt || Math.hypot(e.clientX - downPt[0], e.clientY - downPt[1]) > 6) return;
  if (atlas.mode === 'elsewhere') return;
  mouseNDC.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObjects([shotPinsMesh, terracedGroup, bldInstMesh], true);
  if (!hits.length) return;
  const h = hits[0];
  if (h.object === shotPinsMesh && h.instanceId != null) {
    const s = shots[h.instanceId];
    showToast(`SHOT PIN ${s.cid}`, `Poem ${s.poem || '01'} · ${s.el} · Source: ${s.source} (recorded).`);
    return;
  }
  let p = h.object;
  while (p && !p.userData?.structure) p = p.parent;
  if (p && p.userData?.structure) {
    const st = p.userData.structure;
    showToast('TERRACED STRUCTURE (INFERRED)', `Remastered ${st.t} · Cornice setbacks + glass lightwell · Answered ${st.causes?.length || 0} shots.`);
    return;
  }
  if (h.object === bldInstMesh && h.instanceId != null) {
    const bi = bldInstanceOwners[h.instanceId];
    const b = bldRaw[bi];
    if (b) {
      showToast('URBAN MASONRY BLOCK', `Height ${b[5]}m · Built Era ${b[7]} · +4m Flood Datum Checked.`);
    }
  }
});

// ---------------------------------------------------------------------------
// 10. Interactive 2D Cartography & Camera Frustum Canvas
// ---------------------------------------------------------------------------
const map2d = $('atlas-2d-canvas');
const ctx2d = map2d.getContext('2d');

function draw2DCartography() {
  const cw = map2d.width;
  const ch = map2d.height;
  ctx2d.fillStyle = '#071426';
  ctx2d.fillRect(0, 0, cw, ch);

  // Landmass & +4m datum tint
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

  // Major roads
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

  // District circles
  for (const d of cityMeta.districts) {
    const sx = (d.x / W) * cw;
    const sy = (d.y / H) * ch;
    ctx2d.strokeStyle = 'rgba(24, 180, 255, 0.25)';
    ctx2d.beginPath();
    ctx2d.arc(sx, sy, Math.max(4, (d.r / W) * cw), 0, Math.PI * 2);
    ctx2d.stroke();
  }

  // Nongeographic Black dashed boundary
  ctx2d.save();
  ctx2d.setLineDash([3, 3]);
  ctx2d.strokeStyle = '#c98cff';
  ctx2d.lineWidth = 1.4;
  ctx2d.beginPath();
  ctx2d.arc((BLACK_ANCHOR.x / W) * cw, (BLACK_ANCHOR.z / H) * ch, 7, 0, Math.PI * 2);
  ctx2d.stroke();
  ctx2d.restore();

  // Severn Pilot Gold Star / Pin
  const svX = (SEVERN_POS.x / W) * cw;
  const svY = (SEVERN_POS.z / H) * ch;
  ctx2d.fillStyle = '#f2a541';
  ctx2d.beginPath();
  ctx2d.arc(svX, svY, 4.5, 0, Math.PI * 2);
  ctx2d.fill();

  // Camera Frustum Wedge
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
    if (atlas.mode === 'elsewhere') setAtlasMode('city3d');
    focusSevernPilot(false);
    showToast('SEVERN PILOT SELECTED', '701 Cathedral St · Shared state synced across Map, Street, and Interior.');
    return;
  }
  const wy = Math.max(groundAt(wx, wz), 0.5);
  if (atlas.mode === 'moviemap') {
    let bestE = 0, bestD = Infinity;
    mmEdges.forEach((edge, idx) => {
      const d = Math.hypot(edge.pts[0] - wx, edge.pts[1] - wz);
      if (d < bestD) { bestD = d; bestE = idx; }
    });
    atlas.mmEdgeIdx = bestE;
    atlas.mmStepIdx = 0;
    syncMovieMapPose();
  } else {
    if (atlas.mode === 'elsewhere') setAtlasMode('city3d');
    flyCameraTo(new THREE.Vector3(wx + 95, wy + 58, wz + 95), new THREE.Vector3(wx, wy + 8, wz));
  }
});

window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === '1') setAtlasMode('city3d');
  else if (k === '2') setAtlasMode('moviemap');
  else if (k === '3') setAtlasMode('mood');
  else if (k === '4') setAtlasMode('elsewhere');
  else if (k === 'o') $('btn-pilot-door').click();
  else if (k === 'e') $('btn-pilot-parcel').click();
  else if (k === 'r') $('btn-pilot-rev').click();
});

// ---------------------------------------------------------------------------
// 11. Mount Universal 23-Look GPU Shader Suite Bar & Start Loop
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

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

applyHourToAtlasSky(pilot.worldTime ?? 18.5);
syncPilotUI();
focusSevernPilot(true);

// Handle #moviemap / #mood / #elsewhere deep links cleanly
if (window.location.hash.includes('moviemap')) setAtlasMode('moviemap');
else if (window.location.hash.includes('mood')) setAtlasMode('mood');
else if (window.location.hash.includes('elsewhere')) setAtlasMode('elsewhere');

const clock = new THREE.Clock();
let mapTimer = 0;
let mmDriveAcc = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  skyUniforms.uTime.value = elapsed;
  waterUniforms.uTime.value = elapsed;
  skyDome.position.copy(camera.position);

  // Smooth camera flight
  if (atlas.flyAnim) {
    atlas.flyAnim.elapsed += dt;
    const u = Math.min(1, atlas.flyAnim.elapsed / atlas.flyAnim.dur);
    const k = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) * 0.5;
    camera.position.lerpVectors(atlas.flyAnim.p0, atlas.flyAnim.p1, k);
    controls.target.lerpVectors(atlas.flyAnim.t0, atlas.flyAnim.t1, k);
    if (u >= 1) atlas.flyAnim = null;
  }

  if (controls.enabled) controls.update();

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

  // MovieMap auto-drive along street steps
  if (atlas.mode === 'moviemap' && atlas.mmPlaying) {
    mmDriveAcc += dt;
    if (mmDriveAcc > 0.22) {
      mmDriveAcc = 0;
      const st = edgeSteps(atlas.mmEdgeIdx);
      if (atlas.mmStepIdx < st.length - 1) {
        atlas.mmStepIdx++;
        syncMovieMapPose();
      } else {
        atlas.mmPlaying = false;
        $('btn-mm-play').classList.remove('active');
        $('btn-mm-play').textContent = 'Drive Street';
      }
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

  mapTimer += dt;
  if (mapTimer > 0.25) {
    mapTimer = 0;
    draw2DCartography();
  }

  shaderSuite.render(scene, camera);
});
