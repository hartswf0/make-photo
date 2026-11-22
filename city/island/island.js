import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ALL_CITY_LOOKS } from '../shaders.js';
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

const $ = (id) => document.getElementById(id);
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const CUSTOM_BRUSH_KEY = 'make_photo_island_brush_v1';

// ---------------------------------------------------------------------------
// 1. Hydrate Shared Severn Pilot State (Brief 9)
// ---------------------------------------------------------------------------
let pilot = applyPilotUrlHash();
let shaderSuite = null;

// ---------------------------------------------------------------------------
// 2. Load Bundled Real Upstream Island Data
// ---------------------------------------------------------------------------
const [meta, hGrid, bldsRaw, roads, treesRaw, setsData] = await Promise.all([
  fetch('./data/meta.json').then((r) => r.json()),
  fetch('./data/height_grid.json').then((r) => r.json()),
  fetch('./data/buildings.json').then((r) => r.json()),
  fetch('./data/roads.json').then((r) => r.json()),
  fetch('./data/trees.json').then((r) => r.json()),
  fetch('./data/sets.json').then((r) => r.json()),
]);

const W = meta.W;
const H = meta.H;
const H_NX = hGrid.nx;
const H_NY = hGrid.ny;
const H_CELL = hGrid.cell;
const H_DATA = hGrid.data;

function hAt(x, z) {
  const fx = x / H_CELL;
  const fz = z / H_CELL;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= H_NX - 1 || j >= H_NY - 1) return -28;
  const tx = fx - i;
  const tz = fz - j;
  const o = j * H_NX + i;
  const h00 = H_DATA[o];
  const h10 = H_DATA[o + 1];
  const h01 = H_DATA[o + H_NX];
  const h11 = H_DATA[o + H_NX + 1];
  return ((h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz) / 10;
}

const SETS = setsData.sets;
const SET_BY_NUM = Object.fromEntries(SETS.map((s) => [s.num, s]));
const SEVERN_SET = SET_BY_NUM['01']; // 2152.6, 2597.1 — 701 Cathedral St, Mount Vernon

// Nongeographic Black Void coordinates (kept strictly outside street network)
const BLACK_SET = SET_BY_NUM['14'];

// ---------------------------------------------------------------------------
// 3. Renderer, Camera, Sky & WEAVE Cel Lighting
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
scene.fog = new THREE.FogExp2('#102644', 0.00058);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.35, 9200);

// Cobalt-Cerulean Sky Dome with Stars & Warm Horizon Rim
const skyUniforms = {
  uTop: { value: new THREE.Color('#08182e') },
  uMid: { value: new THREE.Color('#0f2c52') },
  uHor: { value: new THREE.Color('#2c5278') },
  uSunDir: { value: new THREE.Vector3(-0.55, 0.22, -0.80).normalize() },
  uSunCol: { value: new THREE.Color('#ffb870') },
  uStars: { value: 0.55 },
  uTime: { value: 0 },
};

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(8400, 40, 24),
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
      uniform float uStars;
      uniform float uTime;
      varying vec3 vDir;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float y = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(uHor, uMid, smoothstep(-0.02, 0.28, y));
        col = mix(col, uTop, smoothstep(0.24, 0.82, y));
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunCol * (pow(sd, 320.0) * 1.4 + pow(sd, 18.0) * 0.28 + pow(sd, 3.0) * 0.08);
        if (uStars > 0.02 && y > 0.06) {
          vec2 g = vec2(atan(d.z, d.x) * 150.0, asin(clamp(y, 0.0, 1.0)) * 300.0);
          vec2 cell = floor(g);
          float r = h21(cell);
          float tw = 0.65 + 0.35 * sin(uTime * 1.8 + r * 30.0);
          float st = step(0.9962, r) * smoothstep(0.46, 0.05, length(fract(g) - 0.5)) * tw;
          col += vec3(0.85, 0.93, 1.0) * st * uStars * smoothstep(0.06, 0.32, y);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
);
skyDome.frustumCulled = false;
scene.add(skyDome);

const hemiLight = new THREE.HemisphereLight('#5c8cc4', '#1d2430', 1.15);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#ffbe7d', 1.55);
sunLight.position.set(-220, 180, -260);
scene.add(sunLight);
scene.add(sunLight.target);

const cyanFillLight = new THREE.DirectionalLight('#18b4ff', 0.32);
cyanFillLight.position.set(180, 90, 210);
scene.add(cyanFillLight);

// ---------------------------------------------------------------------------
// 4. Procedural High-Res Textures (Wet Stone/Asphalt + Puddles + Rich Masonry)
// ---------------------------------------------------------------------------
function createWetIslandGroundTextures() {
  const size = 1024;
  const diffC = document.createElement('canvas');
  diffC.width = diffC.height = size;
  const ctx = diffC.getContext('2d');

  ctx.fillStyle = '#3b424c';
  ctx.fillRect(0, 0, size, size);

  // Granite & basalt block courses
  const step = 32;
  for (let y = 0; y < size; y += step) {
    const rowOff = ((y / step) % 2) * (step * 0.5);
    for (let x = -step; x < size + step; x += step) {
      const v = 50 + Math.floor(Math.random() * 24);
      const warm = Math.random() < 0.25 ? 6 : 0;
      ctx.fillStyle = `rgb(${v + warm},${v + 2},${v + 7})`;
      ctx.fillRect(x + rowOff + 1, y + 1, step - 2, step - 2);
    }
  }
  // Fine mineral grain
  for (let i = 0; i < 14000; i++) {
    const gx = Math.random() * size;
    const gy = Math.random() * size;
    const gv = 36 + Math.floor(Math.random() * 38);
    ctx.fillStyle = `rgba(${gv},${gv + 3},${gv + 8},0.35)`;
    ctx.fillRect(gx, gy, 2, 2);
  }
  // Wet sheen streaks
  const gradOverlay = ctx.createLinearGradient(0, 0, size, size);
  gradOverlay.addColorStop(0, 'rgba(18, 36, 58, 0.16)');
  gradOverlay.addColorStop(0.5, 'rgba(203, 177, 130, 0.08)');
  gradOverlay.addColorStop(1, 'rgba(24, 180, 255, 0.10)');
  ctx.fillStyle = gradOverlay;
  ctx.fillRect(0, 0, size, size);

  // Wet puddle roughness map (dark = mirror puddle 0.06, light = damp stone 0.78)
  const roughC = document.createElement('canvas');
  roughC.width = roughC.height = size;
  const rctx = roughC.getContext('2d');
  rctx.fillStyle = '#bcbcbc';
  rctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 42; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const rad = 36 + Math.random() * 96;
    const rg = rctx.createRadialGradient(px, py, 4, px, py, rad);
    rg.addColorStop(0, 'rgba(14, 14, 16, 0.96)');
    rg.addColorStop(0.62, 'rgba(42, 42, 46, 0.68)');
    rg.addColorStop(1, 'rgba(188, 188, 188, 0)');
    rctx.fillStyle = rg;
    rctx.beginPath();
    rctx.arc(px, py, rad, 0, Math.PI * 2);
    rctx.fill();
  }

  const map = new THREE.CanvasTexture(diffC);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(320, 220);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const roughnessMap = new THREE.CanvasTexture(roughC);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(320, 220);

  return { map, roughnessMap };
}

function createMasonryFacadeTextures() {
  const w = 512;
  const h = 512;
  const colC = document.createElement('canvas');
  colC.width = w;
  colC.height = h;
  const ctx = colC.getContext('2d');

  const emisC = document.createElement('canvas');
  emisC.width = w;
  emisC.height = h;
  const ectx = emisC.getContext('2d');
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);

  // Warm terracotta/limestone brick courses
  ctx.fillStyle = '#9c8876';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 8) {
    const off = ((y / 8) % 2) * 12;
    for (let x = -12; x < w + 12; x += 24) {
      const shade = 132 + Math.floor(Math.random() * 34);
      ctx.fillStyle = `rgb(${shade + 10},${shade - 2},${shade - 12})`;
      ctx.fillRect(x + off + 1, y + 1, 22, 6);
    }
  }

  // Cornice bands & recessed architectural windows (8 cols x 8 floors)
  const cols = 8;
  const rows = 8;
  const cw = w / cols;
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    const y0 = r * rh;
    // Stone belt course
    ctx.fillStyle = 'rgba(226, 216, 198, 0.55)';
    ctx.fillRect(0, y0, w, 4);
    ctx.fillStyle = 'rgba(24, 28, 36, 0.35)';
    ctx.fillRect(0, y0 + 4, w, 2);

    for (let c = 0; c < cols; c++) {
      const x0 = c * cw;
      const wx = x0 + 13;
      const wy = y0 + 12;
      const ww = cw - 26;
      const wh = rh - 20;

      // Stone lintel & sill
      ctx.fillStyle = '#dfd5c5';
      ctx.fillRect(wx - 3, wy - 4, ww + 6, 4);
      ctx.fillRect(wx - 2, wy + wh, ww + 4, 3);

      // Dark cobalt window pane
      const isLit = ((r * 13 + c * 7) % 11) < 4;
      const isCyan = ((r * 17 + c * 5) % 29) === 0;
      ctx.fillStyle = isLit ? (isCyan ? '#38b8e8' : '#f4b976') : '#152233';
      ctx.fillRect(wx, wy, ww, wh);

      // Mullions
      ctx.fillStyle = '#2d3540';
      ctx.fillRect(wx + ww * 0.5 - 1, wy, 2, wh);
      ctx.fillRect(wx, wy + wh * 0.48, ww, 2);

      if (isLit) {
        ectx.fillStyle = isCyan ? '#18b4ff' : (r % 2 === 0 ? '#ffad5c' : '#ffd89c');
        ectx.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);
      }
    }
  }

  const map = new THREE.CanvasTexture(colC);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const emissiveMap = new THREE.CanvasTexture(emisC);
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;

  return { map, emissiveMap };
}

function createRoadAsphaltTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  // Raised granite curb edges on left & right (0..18 and 238..256)
  ctx.fillStyle = '#212730';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = 20 + Math.random() * 216;
    const y = Math.random() * 256;
    const v = 26 + Math.floor(Math.random() * 22);
    ctx.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
    ctx.fillRect(x, y, 2, 3);
  }
  // Granite stone curbs + drainage gutter
  ctx.fillStyle = '#b4aca0';
  ctx.fillRect(0, 0, 18, 256);
  ctx.fillRect(238, 0, 18, 256);
  ctx.fillStyle = '#12171e';
  ctx.fillRect(18, 0, 5, 256);
  ctx.fillRect(233, 0, 5, 256);
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = 'rgba(30,28,26,0.45)';
    ctx.fillRect(0, y, 18, 2);
    ctx.fillRect(238, y, 18, 2);
  }
  // Dashed brass/ochre centerline
  ctx.fillStyle = 'rgba(232, 182, 96, 0.72)';
  for (let y = 12; y < 256; y += 64) {
    ctx.fillRect(125, y, 6, 34);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

const groundTex = createWetIslandGroundTextures();
const masonryTex = createMasonryFacadeTextures();
const roadTex = createRoadAsphaltTexture();

// ---------------------------------------------------------------------------
// 5. Island Terrain + Shimmering Harbor Water + Wet Puddle Reflections
// ---------------------------------------------------------------------------
const urbanCores = meta.regions.flatMap((r) => r.cores);
function urbanFactorAt(x, z) {
  let best = 0;
  for (let i = 0; i < urbanCores.length; i++) {
    const c = urbanCores[i];
    const d = Math.hypot(x - c.x, z - c.y);
    const f = 1 - Math.min(1, Math.max(0, (d - c.r * 0.75) / (c.r * 0.95)));
    if (f > best) best = f;
  }
  return best;
}

{
  const pos = new Float32Array(H_NX * H_NY * 3);
  const uv = new Float32Array(H_NX * H_NY * 2);
  const col = new Float32Array(H_NX * H_NY * 3);
  const tmpC = new THREE.Color();
  const urbanCol = new THREE.Color('#6b7380');
  const shoreCol = new THREE.Color('#b6a483');
  const grassCol = new THREE.Color('#4c6348');
  const highlandCol = new THREE.Color('#7c715e');
  const seabedCol = new THREE.Color('#0c233c');

  for (let j = 0; j < H_NY; j++) {
    for (let i = 0; i < H_NX; i++) {
      const k = j * H_NX + i;
      const x = i * H_CELL;
      const z = j * H_CELL;
      const y = H_DATA[k] / 10;
      pos[k * 3] = x;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = z;
      uv[k * 2] = x / W;
      uv[k * 2 + 1] = z / H;

      if (y < -0.2) {
        tmpC.copy(seabedCol);
      } else if (y < 2.2) {
        const uf = urbanFactorAt(x, z);
        tmpC.copy(shoreCol).lerp(urbanCol, uf * 0.85);
      } else {
        const uf = urbanFactorAt(x, z);
        tmpC.copy(grassCol).lerp(highlandCol, Math.min(1, Math.max(0, (y - 35) / 85)));
        tmpC.lerp(urbanCol, uf * 0.92);
      }
      // Keep nongeographic Black circle dark
      const db = Math.hypot(x - BLACK_SET.x, z - BLACK_SET.y);
      if (db < 48) {
        tmpC.lerp(new THREE.Color('#090d14'), 1 - db / 48);
      }
      col[k * 3] = tmpC.r;
      col[k * 3 + 1] = tmpC.g;
      col[k * 3 + 2] = tmpC.b;
    }
  }

  const idx = new Uint32Array((H_NX - 1) * (H_NY - 1) * 6);
  let ptr = 0;
  for (let j = 0; j < H_NY - 1; j++) {
    for (let i = 0; i < H_NX - 1; i++) {
      const a = j * H_NX + i;
      const b = a + 1;
      const c = a + H_NX;
      const d = c + 1;
      idx[ptr++] = a;
      idx[ptr++] = c;
      idx[ptr++] = b;
      idx[ptr++] = b;
      idx[ptr++] = c;
      idx[ptr++] = d;
    }
  }

  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  tGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  tGeo.computeVertexNormals();

  const tMat = new THREE.MeshStandardMaterial({
    map: groundTex.map,
    roughnessMap: groundTex.roughnessMap,
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.16,
  });
  const terrainMesh = new THREE.Mesh(tGeo, tMat);
  terrainMesh.name = 'island-terrain';
  scene.add(terrainMesh);
}

// Shimmering Harbor Water Shader
const waterUniforms = {
  uTime: { value: 0 },
  uSunDir: { value: skyUniforms.uSunDir.value },
  uDeep: { value: new THREE.Color('#081c36') },
  uShallow: { value: new THREE.Color('#13466e') },
  uCyan: { value: new THREE.Color('#18b4ff') },
  uSunCol: { value: new THREE.Color('#ffbe78') },
};

const harborWater = new THREE.Mesh(
  new THREE.PlaneGeometry(W * 2.4, H * 2.4, 96, 96),
  new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += sin(wp.x * 0.045 + uTime * 1.4) * 0.08 + cos(wp.z * 0.052 - uTime * 1.1) * 0.08;
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uCyan;
      uniform vec3 uSunCol;
      varying vec3 vWorldPos;
      void main() {
        vec2 p = vWorldPos.xz;
        float w1 = sin(p.x * 0.18 + uTime * 1.9 + sin(p.y * 0.09)) * 0.5 + 0.5;
        float w2 = cos(p.y * 0.22 - uTime * 1.5 + cos(p.x * 0.11)) * 0.5 + 0.5;
        vec3 n = normalize(vec3((w1 - 0.5) * 0.26, 1.0, (w2 - 0.5) * 0.26));
        vec3 v = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.2);
        vec3 base = mix(uDeep, uShallow, clamp(w1 * 0.55 + fres * 0.45, 0.0, 1.0));
        vec3 refl = reflect(-normalize(uSunDir), n);
        float spec = pow(max(dot(v, refl), 0.0), 64.0);
        float cyanGlint = smoothstep(0.84, 0.99, w1 * w2);
        vec3 col = base + uSunCol * spec * 0.85 + uCyan * cyanGlint * 0.38 + vec3(0.14, 0.30, 0.52) * fres * 0.55;
        gl_FragColor = vec4(col, 0.93);
      }
    `,
  })
);
harborWater.rotation.x = -Math.PI / 2;
harborWater.position.set(W * 0.5, -0.18, H * 0.5);
scene.add(harborWater);

// ---------------------------------------------------------------------------
// 6. Road Network, Raised Stone Curbs, Bridges & Rivers (Brief 6: Black excluded)
// ---------------------------------------------------------------------------
const roadSegments = [];
const bridgeSegs = [];

function inBlackNonRoadZone(x, z) {
  return Math.hypot(x - BLACK_SET.x, z - BLACK_SET.y) < 44;
}

function buildRibbonGeometry(ribbons, defaultW, lift, useCustomZ = false) {
  const P = [];
  const UV = [];
  const I = [];
  let vOff = 0;

  for (const item of ribbons) {
    const pts = item.pts || item;
    const zs = item.z || null;
    const w = item.w || defaultW;
    if (!pts || pts.length < 2) continue;

    let distAcc = 0;
    let validCount = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      if (inBlackNonRoadZone(x, z)) continue; // Keep The Black outside geographic street network
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      let dx = next[0] - prev[0];
      let dz = next[1] - prev[1];
      const L = Math.hypot(dx, dz) || 1;
      dx /= L;
      dz /= L;
      if (i > 0) distAcc += Math.hypot(x - prev[0], z - prev[1]);

      const yBase = useCustomZ && pts[i][2] != null
        ? pts[i][2]
        : zs && zs[i] != null
          ? Math.max(hAt(x, z), Math.min(zs[i], hAt(x, z) + 0.35))
          : hAt(x, z);
      const y = yBase + lift;

      P.push(x - dz * (w * 0.5), y, z + dx * (w * 0.5));
      P.push(x + dz * (w * 0.5), y, z - dx * (w * 0.5));
      UV.push(0, distAcc / 14, 1, distAcc / 14);
      if (validCount > 0) {
        const k = vOff + validCount * 2;
        I.push(k - 2, k, k - 1, k - 1, k, k + 1);
      }
      validCount++;
    }
    vOff += validCount * 2;
  }

  if (P.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

{
  // Index road segments for curb checks, tree clearance & cruiser navigation
  for (const r of [...roads.streets, ...roads.highways]) {
    const w = r.w || 14;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1];
      const b = r.pts[i];
      if (inBlackNonRoadZone(a[0], a[1]) || inBlackNonRoadZone(b[0], b[1])) continue;
      roadSegments.push({ a, b, w });
    }
  }
  for (const br of roads.bridges) {
    for (let i = 1; i < br.length; i++) {
      bridgeSegs.push([br[i - 1], br[i]]);
    }
  }

  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: 0.22,
    metalness: 0.18,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const hwGeo = buildRibbonGeometry(roads.highways, 15, 0.22, false);
  if (hwGeo) scene.add(new THREE.Mesh(hwGeo, roadMat));

  const coreStreets = roads.streets.filter((s) => s.k === 'core' || (s.w || 8) >= 9);
  const stGeo = buildRibbonGeometry(coreStreets, 10.5, 0.16, false);
  if (stGeo) scene.add(new THREE.Mesh(stGeo, roadMat));

  const brGeo = buildRibbonGeometry(roads.bridges, 15.5, 0.36, true);
  if (brGeo) {
    const brMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      color: '#d8d0c2',
      roughness: 0.35,
      metalness: 0.22,
    });
    scene.add(new THREE.Mesh(brGeo, brMat));
  }

  const rvGeo = buildRibbonGeometry(roads.rivers, 13, 0.12, true);
  if (rvGeo) {
    scene.add(
      new THREE.Mesh(
        rvGeo,
        new THREE.MeshStandardMaterial({
          color: '#146696',
          emissive: '#0a3554',
          emissiveIntensity: 0.45,
          roughness: 0.12,
          metalness: 0.55,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        })
      )
    );
  }
}

// Spatial hash for fast road distance queries
const ROAD_CELL = 80;
const roadGrid = new Map();
for (let idx = 0; idx < roadSegments.length; idx++) {
  const seg = roadSegments[idx];
  const minX = Math.floor(Math.min(seg.a[0], seg.b[0]) / ROAD_CELL);
  const maxX = Math.floor(Math.max(seg.a[0], seg.b[0]) / ROAD_CELL);
  const minZ = Math.floor(Math.min(seg.a[1], seg.b[1]) / ROAD_CELL);
  const maxZ = Math.floor(Math.max(seg.a[1], seg.b[1]) / ROAD_CELL);
  for (let gx = minX; gx <= maxX; gx++) {
    for (let gz = minZ; gz <= maxZ; gz++) {
      const k = gx * 10000 + gz;
      let arr = roadGrid.get(k);
      if (!arr) {
        arr = [];
        roadGrid.set(k, arr);
      }
      arr.push(seg);
    }
  }
}

function nearestRoad(x, z, maxDist = 240) {
  const gx0 = Math.floor(x / ROAD_CELL);
  const gz0 = Math.floor(z / ROAD_CELL);
  const rad = Math.ceil(maxDist / ROAD_CELL);
  let best = null;
  let bd = maxDist;
  for (let gx = gx0 - rad; gx <= gx0 + rad; gx++) {
    for (let gz = gz0 - rad; gz <= gz0 + rad; gz++) {
      const arr = roadGrid.get(gx * 10000 + gz);
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        const { a, b, w } = arr[i];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
        const px = a[0] + dx * t;
        const pz = a[1] + dz * t;
        const d = Math.hypot(px - x, pz - z);
        if (d < bd) {
          bd = d;
          best = { x: px, z: pz, d, w, hd: Math.atan2(dx, -dz), tx: dx / Math.sqrt(L2), tz: dz / Math.sqrt(L2) };
        }
      }
    }
  }
  return best;
}

function onBridgeDeck(x, z) {
  for (let i = 0; i < bridgeSegs.length; i++) {
    const [a, b] = bridgeSegs[i];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
    if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 8.8) {
      return a[2] + (b[2] - a[2]) * t + 0.38;
    }
  }
  return null;
}

function nearAnySet(x, z, pad = 10) {
  for (let i = 0; i < SETS.length; i++) {
    const s = SETS[i];
    if (Math.hypot(s.x - x, s.y - z) < (s.foot || 24) + pad) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 7. Cornice-Trimmed Masonry Buildings (buildings.json) + Collision Grid
// ---------------------------------------------------------------------------
const BLD_PALETTES = [
  new THREE.Color('#b69784'), // Baltimere warm terracotta brick
  new THREE.Color('#cfc6b8'), // Mount Vernon limestone
  new THREE.Color('#c8a78c'), // Condesa warm ochre stucco
  new THREE.Color('#8e9aa8'), // Inner Harbor slate masonry
];

const BLD_CELL = 45;
const bldGrid = new Map();
const bldPolys = [];

{
  const P = [];
  const N = [];
  const UV = [];
  const C = [];
  const roofP = [];
  const roofC = [];

  const pushTri = (ax, ay, az, bx, by, bz, cx, cy, cz, u0, v0, u1, v1, u2, v2, col) => {
    P.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    N.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    UV.push(u0, v0, u1, v1, u2, v2);
    C.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
  };

  for (let bi = 0; bi < bldsRaw.length; bi++) {
    const b = bldsRaw[bi];
    const h = b[0];
    const baseCol = BLD_PALETTES[b[1] % BLD_PALETTES.length].clone();
    baseCol.offsetHSL(((bi % 17) - 8) * 0.004, 0, ((bi % 11) - 5) * 0.014);

    const pts = [];
    for (let k = 2; k < b.length; k += 2) pts.push([b[k], b[k + 1]]);
    if (pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) {
      pts.pop();
    }
    if (pts.length < 3) continue;

    let cx = 0, cz = 0;
    for (let i = 0; i < pts.length; i++) { cx += pts[i][0]; cz += pts[i][1]; }
    cx /= pts.length;
    cz /= pts.length;
    if (nearAnySet(cx, cz, 12)) continue;

    let base = Infinity;
    for (let i = 0; i < pts.length; i++) base = Math.min(base, hAt(pts[i][0], pts[i][1]));
    if (base < -0.3) continue;

    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      area += p[0] * q[1] - q[0] * p[1];
    }
    if (area < 0) pts.reverse();

    const bot = base - 2.2;
    const top = base + h;
    const vTop = h / 24;

    let uAcc = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x0, z0] = pts[i];
      const [x1, z1] = pts[(i + 1) % pts.length];
      const segLen = Math.hypot(x1 - x0, z1 - z0);
      const u0 = uAcc / 24;
      const u1 = (uAcc + segLen) / 24;
      uAcc += segLen;

      pushTri(x0, bot, z0, x1, top, z1, x1, bot, z1, u0, 0, u1, vTop, u1, 0, baseCol);
      pushTri(x0, bot, z0, x0, top, z0, x1, top, z1, u0, 0, u0, vTop, u1, vTop, baseCol);
    }

    // Parapet cornice roof cap
    const rCol = baseCol.clone().multiplyScalar(0.62);
    const shapePts = pts.map((p) => new THREE.Vector2(p[0], p[1]));
    const tris = THREE.ShapeUtils.triangulateShape(shapePts, []);
    for (let t = 0; t < tris.length; t++) {
      const [ia, ib, ic] = tris[t];
      roofP.push(
        pts[ia][0], top, pts[ia][1],
        pts[ic][0], top, pts[ic][1],
        pts[ib][0], top, pts[ib][1]
      );
      roofC.push(rCol.r, rCol.g, rCol.b, rCol.r, rCol.g, rCol.b, rCol.r, rCol.g, rCol.b);
    }

    const bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pts.length; i++) {
      bb[0] = Math.min(bb[0], pts[i][0]);
      bb[1] = Math.min(bb[1], pts[i][1]);
      bb[2] = Math.max(bb[2], pts[i][0]);
      bb[3] = Math.max(bb[3], pts[i][1]);
    }
    const polyId = bldPolys.push({ pts, bb, top }) - 1;
    for (let gx = Math.floor(bb[0] / BLD_CELL); gx <= Math.floor(bb[2] / BLD_CELL); gx++) {
      for (let gz = Math.floor(bb[1] / BLD_CELL); gz <= Math.floor(bb[3] / BLD_CELL); gz++) {
        const key = gx * 10000 + gz;
        let arr = bldGrid.get(key);
        if (!arr) { arr = []; bldGrid.set(key, arr); }
        arr.push(polyId);
      }
    }
  }

  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  wallGeo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  wallGeo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));

  const wallMat = new THREE.MeshStandardMaterial({
    map: masonryTex.map,
    emissiveMap: masonryTex.emissiveMap,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.72,
    vertexColors: true,
    roughness: 0.76,
    metalness: 0.08,
  });
  scene.add(new THREE.Mesh(wallGeo, wallMat));

  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofP, 3));
  roofGeo.setAttribute('color', new THREE.Float32BufferAttribute(roofC, 3));
  roofGeo.computeVertexNormals();
  scene.add(
    new THREE.Mesh(
      roofGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1 })
    )
  );
}

function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function hitsBuilding(x, z) {
  const ids = bldGrid.get(Math.floor(x / BLD_CELL) * 10000 + Math.floor(z / BLD_CELL));
  if (!ids) return false;
  for (let i = 0; i < ids.length; i++) {
    const p = bldPolys[ids[i]];
    if (x >= p.bb[0] && x <= p.bb[2] && z >= p.bb[1] && z <= p.bb[3] && pointInPoly(x, z, p.pts)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 8. The Severn Pilot Hero + 14 Poem Sets + Enterable Nolli Water Depots
// ---------------------------------------------------------------------------
const wallColliders = []; // { x0, z0, x1, z1, y, activeFn }
const interactiveNodes = []; // { id, kind, label, x, y, z, radius, provenance, onAct }
const provenanceBadges3D = [];
const diegeticPickables = [];
const matHitProxy = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  side: THREE.DoubleSide,
});
function addDiegeticTarget(mesh, info) {
  mesh.userData.diegetic = info;
  diegeticPickables.push(mesh);
  return mesh;
}

function makePart(geo, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
}

// Shared architectural materials
const matSevernBrick = new THREE.MeshStandardMaterial({
  map: masonryTex.map,
  color: '#9c5244',
  roughness: 0.78,
});
const matLimestone = new THREE.MeshStandardMaterial({ color: '#ddd4c4', roughness: 0.68 });
const matWarmPlaster = new THREE.MeshStandardMaterial({ color: '#ede4d2', roughness: 0.74 });
const matDarkIron = new THREE.MeshStandardMaterial({ color: '#20262e', roughness: 0.42, metalness: 0.68 });
const matTimberDoor = new THREE.MeshStandardMaterial({ color: '#5c3824', roughness: 0.55 });
const matBrass = new THREE.MeshStandardMaterial({ color: '#cbb182', roughness: 0.32, metalness: 0.78 });
const matCyanRelay = new THREE.MeshStandardMaterial({
  color: '#18b4ff',
  emissive: '#1298e0',
  emissiveIntensity: 1.55,
  roughness: 0.18,
  metalness: 0.35,
});
const matSevernRedFixture = new THREE.MeshStandardMaterial({
  color: '#ff3b30',
  emissive: '#e0241a',
  emissiveIntensity: 1.8,
  roughness: 0.25,
});
const matWarmGlow = new THREE.MeshStandardMaterial({
  color: '#ffd699',
  emissive: '#ffaa4c',
  emissiveIntensity: 1.65,
  roughness: 0.2,
});

// Build The Severn Pilot (Set 01, 20m x 12m declared envelope + vestibule + operable door + curb bay)
const severnState = {
  cx: SEVERN_SET.x,
  cz: SEVERN_SET.y,
  y0: Math.max(hAt(SEVERN_SET.x, SEVERN_SET.y), 0.5),
  doorPivot: null,
  doorAngle: pilot.doorOpen ? -Math.PI * 0.58 : 0,
  vestibuleLight: null,
  curbX: 0,
  curbZ: 0,
  curbHd: 0,
  thresholdX: 0,
  thresholdZ: 0,
  bekelePos: new THREE.Vector3(),
  parcelMeshBekele: null,
};

function createParcelBundle() {
  const g = new THREE.Group();
  const parcel = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.28), new THREE.MeshStandardMaterial({ color: '#b99362', roughness: 0.65 }));
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.26, 0.05), matBrass);
  const can = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.22), matCyanRelay);
  can.position.set(0.28, 0.04, 0);
  g.add(parcel, strap, can);
  return g;
}

{
  // Orient Severn front toward nearest Mount Vernon street
  const nr = nearestRoad(severnState.cx, severnState.cz, 180);
  const fx = nr ? (nr.x - severnState.cx) : 1;
  const fz = nr ? (nr.z - severnState.cz) : 0;
  const fl = Math.hypot(fx, fz) || 1;
  const ux = fx / fl;
  const uz = fz / fl;
  const vx = -uz;
  const vz = ux;
  const rotY = Math.atan2(ux, uz);
  const toW = (f, s) => [severnState.cx + ux * f + vx * s, severnState.cz + uz * f + vz * s];

  const g = new THREE.Group();
  const y0 = severnState.y0;

  // Declared 20m wide (across s: -10..10) x 12m deep (along f: -12..0) Ground-Floor Nolli Vestibule + 9-Storey Upper Tower
  // Paved limestone threshold plaza & usable street curb loading bay
  const [plazaX, plazaZ] = toW(3.5, 0);
  g.add(makePart(new THREE.BoxGeometry(24, 0.16, 19), matLimestone, plazaX, y0 + 0.04, plazaZ, rotY));

  // Usable Curb Loading Bay at f = +7.8m, s = -4.4m (parked cleanly in 3/4 street view)
  const [curbX, curbZ] = toW(7.8, -4.4);
  severnState.curbX = curbX;
  severnState.curbZ = curbZ;
  severnState.curbHd = Math.atan2(vx, -vz);
  severnState.ux = ux;
  severnState.uz = uz;
  severnState.vx = vx;
  severnState.vz = vz;
  severnState.rotY = rotY;
  severnState.toW = toW;

  const curbBay = new THREE.Group();
  curbBay.position.set(curbX, y0 + 0.08, curbZ);
  curbBay.rotation.y = rotY;
  curbBay.add(makePart(new THREE.BoxGeometry(7.2, 0.18, 0.36), matLimestone, 0, 0.09, -1.8));
  curbBay.add(makePart(new THREE.BoxGeometry(6.8, 0.04, 3.1), matBrass, 0, 0.02, 0));
  curbBay.add(makePart(new THREE.BoxGeometry(6.4, 0.05, 2.7), new THREE.MeshStandardMaterial({ color: '#1b2636', roughness: 0.25 }), 0, 0.025, 0));
  for (const bxOff of [-3.1, 3.1]) {
    curbBay.add(makePart(new THREE.CylinderGeometry(0.11, 0.13, 0.88, 10), matDarkIron, bxOff, 0.44, -1.8));
    curbBay.add(makePart(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10), matCyanRelay, bxOff, 0.90, -1.8));
  }
  g.add(curbBay);

  // Ground-floor vestibule walls (f: -12..0, s: -10..10, height 4.4m) with 2.4m doorway at (f=0, s=0)
  const addWallSeg = (s0, f0, s1, f1, h, mat, activeFn = null) => {
    const [wx0, wz0] = toW(f0, s0);
    const [wx1, wz1] = toW(f1, s1);
    const len = Math.hypot(wx1 - wx0, wz1 - wz0);
    const ang = Math.atan2(wx1 - wx0, wz1 - wz0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.36, h, len), mat);
    m.position.set((wx0 + wx1) * 0.5, y0 + h * 0.5, (wz0 + wz1) * 0.5);
    m.rotation.y = ang;
    g.add(m);
    wallColliders.push({ x0: wx0, z0: wz0, x1: wx1, z1: wz1, y: y0, activeFn });
  };

  // Back & side walls of 20x12m Severn vestibule
  addWallSeg(-10, -12, 10, -12, 4.4, matSevernBrick);
  addWallSeg(-10, -12, -10, 0, 4.4, matSevernBrick);
  addWallSeg(10, -12, 10, 0, 4.4, matSevernBrick);
  // Front facade left & right of 2.6m threshold doorway
  addWallSeg(-10, 0, -1.35, 0, 4.4, matSevernBrick);
  addWallSeg(1.35, 0, 10, 0, 4.4, matSevernBrick);
  // Transom above doorway
  const [trX, trZ] = toW(0, 0);
  g.add(makePart(new THREE.BoxGeometry(2.8, 1.3, 0.42), matLimestone, trX, y0 + 3.75, trZ, rotY));

  // Interior warm timber/stone floor & ceiling slab
  const [inX, inZ] = toW(-6, 0);
  g.add(makePart(new THREE.BoxGeometry(19.6, 0.14, 11.6), matWarmPlaster, inX, y0 + 0.08, inZ, rotY));
  // Upper 8 storeys (y0 + 4.4m to y0 + 31.4m) preserving 20m x 12m envelope
  g.add(makePart(new THREE.BoxGeometry(20.0, 27.0, 12.0), matSevernBrick, inX, y0 + 4.4 + 13.5, inZ, rotY));
  // Limestone roof cornice
  g.add(makePart(new THREE.BoxGeometry(20.8, 0.75, 12.8), matLimestone, inX, y0 + 31.6, inZ, rotY));

  // Identifiable exterior fixtures (Brief 4: red & teal/cyan strictly bound to real fixtures)
  const [redFixX, redFixZ] = toW(0.32, -2.1);
  g.add(makePart(new THREE.BoxGeometry(0.28, 0.36, 0.22), matDarkIron, redFixX, y0 + 2.85, redFixZ, rotY));
  g.add(makePart(new THREE.SphereGeometry(0.13, 10, 8), matSevernRedFixture, redFixX, y0 + 2.85, redFixZ));

  const [tealFixX, tealFixZ] = toW(0.32, 2.1);
  g.add(makePart(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 10), matCyanRelay, tealFixX, y0 + 1.9, tealFixZ));

  // Exterior steel fire escape landings & stairs up front facade
  for (let flr = 1; flr <= 7; flr++) {
    const fy = y0 + flr * 3.5;
    const [lx, lz] = toW(0.85, 4.2);
    g.add(makePart(new THREE.BoxGeometry(3.4, 0.12, 1.45), matDarkIron, lx, fy, lz, rotY));
    g.add(makePart(new THREE.BoxGeometry(3.4, 0.9, 0.08), matDarkIron, lx + ux * 0.68, fy + 0.45, lz + uz * 0.68, rotY));
  }

  // Operable Severn Threshold Door (hinged at s = -1.3, f = 0)
  const [hingeX, hingeZ] = toW(0, -1.3);
  const doorPivot = new THREE.Group();
  doorPivot.position.set(hingeX, y0 + 0.1, hingeZ);
  doorPivot.rotation.y = rotY + severnState.doorAngle;
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.55, 2.95, 0.12), matTimberDoor);
  leaf.position.set(1.28, 1.48, 0);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.22), matBrass);
  handle.position.set(2.32, 1.38, 0);
  const glassPane = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.14), matWarmGlow);
  glassPane.position.set(1.28, 1.95, 0);
  const doorHit = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.4, 1.2), matHitProxy);
  doorHit.position.set(1.28, 1.65, 0);
  addDiegeticTarget(doorHit, {
    kind: 'severn-door',
    getAnchor: () => new THREE.Vector3(severnState.thresholdX, y0 + 3.25, severnState.thresholdZ),
    getWhisper: () =>
      pilot.doorOpen
        ? 'The Severn 3D Door · Open (13.5 kHz) — Click to Close Lobby'
        : 'The Severn 3D Door · Closed (580 Hz) — Click to Open & Enter Nolli Depot',
  });
  doorPivot.add(leaf, handle, glassPane, doorHit);
  g.add(doorPivot);
  severnState.doorPivot = doorPivot;

  // Dynamic doorway collider: blocks passage when pilot.doorOpen === false!
  const [d0x, d0z] = toW(0, -1.35);
  const [d1x, d1z] = toW(0, 1.35);
  wallColliders.push({
    x0: d0x,
    z0: d0z,
    x1: d1x,
    z1: d1z,
    y: y0,
    activeFn: () => !pilot.doorOpen,
  });

  const [thX, thZ] = toW(0.8, 0);
  severnState.thresholdX = thX;
  severnState.thresholdZ = thZ;

  // Interior Nolli Water Relay + Reception Table + Warm Interior Lamp
  const [relX, relZ] = toW(-6.8, -4.4);
  g.add(makePart(new THREE.CylinderGeometry(0.95, 1.08, 0.55, 16), matLimestone, relX, y0 + 0.35, relZ));
  g.add(makePart(new THREE.CylinderGeometry(0.24, 0.28, 2.1, 12), matCyanRelay, relX, y0 + 1.4, relZ));
  g.add(makePart(new THREE.TorusGeometry(0.68, 0.08, 8, 24), matCyanRelay, relX, y0 + 0.68, relZ)).rotation.x = Math.PI / 2;
  const relHit = makePart(new THREE.CylinderGeometry(1.35, 1.35, 2.8, 12), matHitProxy, relX, y0 + 1.4, relZ);
  addDiegeticTarget(relHit, {
    kind: 'water-relay',
    nodeId: 'severn-relay',
    getAnchor: () => new THREE.Vector3(relX, y0 + 2.85, relZ),
    getWhisper: () => `Severn Nolli Standpipe (${(pilot.waterLiters || 5).toFixed(1)}L) — Click to Draw +5L Cyan`,
  });
  g.add(relHit);

  const [tblX, tblZ] = toW(-4.4, 2.4);
  g.add(makePart(new THREE.BoxGeometry(2.1, 0.86, 1.05), matTimberDoor, tblX, y0 + 0.5, tblZ, rotY));

  const [bekX, bekZ] = toW(-1.15, 0.65);
  severnState.bekelePos.set(bekX, y0 + 0.15, bekZ);

  // Warm interior lamp casting light through open threshold onto pavement
  const vestLight = new THREE.PointLight('#ffb668', pilot.doorOpen ? 3.2 : 1.1, 24, 1.5);
  const [vlX, vlZ] = toW(-2.0, 0);
  vestLight.position.set(vlX, y0 + 3.4, vlZ);
  scene.add(vestLight);
  severnState.vestibuleLight = vestLight;

  const cyanLight = new THREE.PointLight('#18b4ff', 0.95, 10, 1.8);
  cyanLight.position.set(relX, y0 + 2.2, relZ);
  scene.add(cyanLight);

  scene.add(g);

  interactiveNodes.push({
    id: 'severn-threshold',
    kind: 'threshold',
    label: 'Severn Threshold Door & Parcel Handoff',
    x: thX,
    y: y0,
    z: thZ,
    radius: 6.8,
    provenance: 'checked',
    onAct: () => cycleParcelHandoff(),
  });
  interactiveNodes.push({
    id: 'severn-relay',
    kind: 'relay',
    label: 'Severn Nolli Cyan Water Relay (+5L)',
    x: relX,
    y: y0,
    z: relZ,
    radius: 4.5,
    provenance: 'recorded',
    onAct: () => {
      const nextL = Math.min(20, (pilot.waterLiters || 5) + 5);
      savePilotState({ waterLiters: nextL, coolingWet: true });
      if (shaderSuite?.audio) shaderSuite.audio.playPour();
      showSpeech('SEVERN NOLLI CISTERN', `Standpipe replenished: ${nextL.toFixed(1)}L electric-cyan reserve active.`);
    },
  });
}

// Build Regional Nolli Depots + Remaining 13 Poem Sets
for (const s of SETS) {
  if (s.num === '01') continue;
  const y0 = Math.max(hAt(s.x, s.y), 0.35);
  const g = new THREE.Group();
  g.position.set(s.x, y0, s.y);

  if (s.num === '14') {
    // Brief 6 & 9: The Black — explicitly nongeographic threshold disc outside street network
    const voidDisc = new THREE.Mesh(
      new THREE.CircleGeometry(22, 48),
      new THREE.MeshStandardMaterial({ color: '#05070c', roughness: 0.14, metalness: 0.65 })
    );
    voidDisc.rotation.x = -Math.PI / 2;
    voidDisc.position.y = 0.08;
    const dashedRing = new THREE.Mesh(
      new THREE.TorusGeometry(22, 0.14, 8, 64),
      new THREE.MeshBasicMaterial({ color: '#b88cff' })
    );
    dashedRing.rotation.x = Math.PI / 2;
    dashedRing.position.y = 0.14;
    const frameL = makePart(new THREE.BoxGeometry(0.28, 2.9, 0.28), matTimberDoor, -1.1, 1.45, 0);
    const frameR = makePart(new THREE.BoxGeometry(0.28, 2.9, 0.28), matTimberDoor, 1.1, 1.45, 0);
    const frameT = makePart(new THREE.BoxGeometry(2.5, 0.28, 0.32), matBrass, 0, 2.95, 0);
    const ajarDoor = makePart(new THREE.BoxGeometry(1.95, 2.75, 0.1), matTimberDoor, -0.3, 1.4, 0.5, 0.65);
    const blackHit = makePart(new THREE.CylinderGeometry(2.4, 2.4, 3.6, 12), matHitProxy, 0, 1.8, 0);
    addDiegeticTarget(blackHit, {
      kind: 'black-door',
      getAnchor: () => new THREE.Vector3(s.x, y0 + 3.4, s.y),
      getWhisper: () => 'Poem 14 · The Old Door in The Black — Click Nongeographic Cut to Severn',
    });
    g.add(voidDisc, dashedRing, frameL, frameR, frameT, ajarDoor, blackHit);
    scene.add(g);
    interactiveNodes.push({
      id: 'set-14',
      kind: 'nongeographic',
      label: 'Poem 14 · The Old Door in The Black (Nongeographic Account Cut)',
      x: s.x,
      y: y0,
      z: s.y,
      radius: 8,
      provenance: 'invented',
      onAct: () => {
        savePilotState({ poem: '14', district: 'the-black' });
        jumpToPreset('severn');
        showSpeech('NONGEOGRAPHIC THRESHOLD', 'Account cut from The Black back to Poem 01 (The Severn) without street-graph traversal.');
      },
    });
    continue;
  }

  // Enterable open-front Nolli pavilion + poem landmark + cyan water relay
  g.add(makePart(new THREE.BoxGeometry(16, 0.18, 14), matLimestone, 0, 0.09, 0));
  // Colonade piers + cornice roof with open central courtyard lightwell
  for (const px of [-7.2, 7.2]) {
    for (const pz of [-6.2, 0, 6.2]) {
      g.add(makePart(new THREE.BoxGeometry(0.85, 5.2, 0.85), matWarmPlaster, px, 2.6, pz));
    }
  }
  g.add(makePart(new THREE.BoxGeometry(15.4, 4.8, 0.5), matSevernBrick, 0, 2.5, -6.4));
  g.add(makePart(new THREE.BoxGeometry(16.6, 0.55, 4.2), matLimestone, 0, 5.35, -4.6));
  g.add(makePart(new THREE.BoxGeometry(16.6, 0.55, 4.2), matLimestone, 0, 5.35, 4.6));

  // Type-specific sculptural centerpiece
  if (s.type === 'gates') {
    g.add(makePart(new THREE.BoxGeometry(3.4, 22, 3.4), matWarmPlaster, -6.5, 11, -2));
    g.add(makePart(new THREE.BoxGeometry(3.4, 22, 3.4), matWarmPlaster, 6.5, 11, -2));
    g.add(makePart(new THREE.BoxGeometry(17.5, 2.6, 3.6), matLimestone, 0, 21.5, -2));
  } else if (s.type === 'temple') {
    g.add(makePart(new THREE.CylinderGeometry(6.8, 7.2, 0.9, 24), matWarmPlaster, 0, 0.5, 0));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5.6, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), matLimestone);
    dome.position.set(0, 5.6, 0);
    g.add(dome);
  } else if (s.type === 'chapel') {
    g.add(makePart(new THREE.BoxGeometry(11, 7.8, 8), matLimestone, 0, 3.9, -1));
    g.add(makePart(new THREE.ConeGeometry(5.8, 4.5, 4), matSevernBrick, 0, 10.0, -1, Math.PI * 0.25));
  }

  // Cyan Water Relay Standpipe + Curb Loading Bollard
  g.add(makePart(new THREE.CylinderGeometry(0.75, 0.9, 0.48, 14), matLimestone, 0, 0.32, 0.5));
  g.add(makePart(new THREE.CylinderGeometry(0.18, 0.22, 1.85, 12), matCyanRelay, 0, 1.25, 0.5));
  g.add(makePart(new THREE.SphereGeometry(0.24, 10, 8), matWarmGlow, 0, 4.8, -4.2));
  const depHit = makePart(new THREE.CylinderGeometry(2.2, 2.2, 3.2, 12), matHitProxy, 0, 1.5, 0.5);
  addDiegeticTarget(depHit, {
    kind: 'depot-relay',
    poemNum: s.num,
    title: s.title,
    place: s.place,
    getAnchor: () => new THREE.Vector3(s.x, y0 + 2.9, s.y + 0.5),
    getWhisper: () => `Poem ${s.num} · ${s.title} Nolli Standpipe — Click to Draw +2.5L Cyan`,
  });
  g.add(depHit);

  scene.add(g);
  interactiveNodes.push({
    id: `set-${s.num}`,
    kind: 'depot',
    label: `Poem ${s.num} · ${s.title} Nolli Relay`,
    x: s.x,
    y: y0,
    z: s.y,
    radius: 7.5,
    provenance: s.region === 'baltimere' ? 'recorded' : 'inferred',
    onAct: () => {
      savePilotState({ poem: s.num, waterLiters: Math.min(20, (pilot.waterLiters || 5) + 2.5) });
      if (shaderSuite?.audio) shaderSuite.audio.playPour();
      showSpeech(`POEM ${s.num} · ${s.title.toUpperCase()}`, `${s.place} — Cyan water relay synchronized with Severn ledger.`);
    },
  });
}

// ---------------------------------------------------------------------------
// 9. Multi-Species Layered 3D Instanced Trees + Soil/Curb Planters + Brush Tool
// ---------------------------------------------------------------------------
function makeColoredGeo(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const c = new THREE.Color(hex);
  const cnt = g.attributes.position.count;
  const arr = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  }
  return g;
}

function buildTreeSpeciesGeometries() {
  const cyl = (rTop, rBot, h, x = 0, y = 0, z = 0, rz = 0, rx = 0) => {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, 7);
    g.translate(0, h * 0.5, 0);
    if (rz) g.rotateZ(rz);
    if (rx) g.rotateX(rx);
    g.translate(x, y, z);
    return g;
  };
  const ico = (r, x, y, z, sy = 0.82) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1, sy, 1);
    g.translate(x, y, z);
    return g;
  };
  const cone = (r, h, x, y, z) => {
    const g = new THREE.ConeGeometry(r, h, 8);
    g.translate(x, y + h * 0.5, z);
    return g;
  };

  // 0: Chesapeake Broadleaf Oak (forked trunk + 4 rich canopy clusters)
  const oak = mergeGeometries([
    makeColoredGeo(cyl(0.032, 0.052, 0.44), '#4c3828'),
    makeColoredGeo(cyl(0.018, 0.028, 0.28, 0, 0.36, 0, -0.48, 0.2), '#58412f'),
    makeColoredGeo(cyl(0.018, 0.028, 0.26, 0, 0.38, 0, 0.45, -0.22), '#58412f'),
    makeColoredGeo(ico(0.28, 0, 0.68, 0, 0.78), '#2f6038'),
    makeColoredGeo(ico(0.22, 0.16, 0.62, 0.08, 0.80), '#3d7442'),
    makeColoredGeo(ico(0.21, -0.15, 0.60, -0.09, 0.76), '#285232'),
    makeColoredGeo(ico(0.18, 0.02, 0.84, 0.04, 0.75), '#4b864c'),
  ]);

  // 1: Condesa Jacaranda (slender dark fork + violet-indigo blossoms)
  const jacaranda = mergeGeometries([
    makeColoredGeo(cyl(0.026, 0.044, 0.42), '#3c302a'),
    makeColoredGeo(cyl(0.015, 0.024, 0.28, 0, 0.34, 0, -0.52, 0.15), '#463831'),
    makeColoredGeo(cyl(0.015, 0.024, 0.28, 0, 0.35, 0, 0.50, -0.18), '#463831'),
    makeColoredGeo(ico(0.27, 0, 0.66, 0, 0.72), '#6d54b5'),
    makeColoredGeo(ico(0.21, 0.17, 0.62, 0.06, 0.74), '#856ad1'),
    makeColoredGeo(ico(0.20, -0.16, 0.59, -0.07, 0.72), '#5c449e'),
    makeColoredGeo(ico(0.17, 0.03, 0.80, 0.02, 0.70), '#9b82e3'),
  ]);

  // 2: Harbor Tiered Pine (timber trunk + 3 layered bough cones)
  const pine = mergeGeometries([
    makeColoredGeo(cyl(0.022, 0.045, 0.48), '#4a3322'),
    makeColoredGeo(cone(0.28, 0.38, 0, 0.26, 0), '#1f4732'),
    makeColoredGeo(cone(0.22, 0.35, 0, 0.50, 0), '#26563c'),
    makeColoredGeo(cone(0.15, 0.32, 0, 0.72, 0), '#316949'),
  ]);

  // 3: Atlantis Columnar Cypress
  const cypress = mergeGeometries([
    makeColoredGeo(cyl(0.024, 0.040, 0.26), '#463528'),
    makeColoredGeo(ico(0.15, 0, 0.48, 0, 1.85), '#214a34'),
    makeColoredGeo(ico(0.12, 0, 0.76, 0, 1.75), '#2b5c40'),
  ]);

  // 4: Coastal Wind-Curved Palm
  const palmParts = [
    makeColoredGeo(cyl(0.024, 0.042, 0.48, 0, 0, 0, 0.08), '#755f4a'),
    makeColoredGeo(cyl(0.018, 0.026, 0.44, -0.04, 0.45, 0, 0.14), '#826b54'),
  ];
  for (let f = 0; f < 7; f++) {
    const a = (f / 7) * Math.PI * 2;
    const frond = new THREE.BoxGeometry(0.06, 0.02, 0.36);
    frond.translate(0, 0, 0.18);
    frond.rotateX(0.38);
    frond.rotateY(a);
    frond.translate(-0.10, 0.86, 0);
    palmParts.push(makeColoredGeo(frond, f % 2 === 0 ? '#3d743e' : '#4d8a48'));
  }
  const palm = mergeGeometries(palmParts);

  return [oak, jacaranda, pine, cypress, palm];
}

// Stone curb tree-pit planter geometry for urban sidewalk trees
const planterGeo = mergeGeometries([
  makeColoredGeo(new THREE.BoxGeometry(2.1, 0.26, 2.1).translate(0, 0.13, 0), '#bfb6a6'),
  makeColoredGeo(new THREE.BoxGeometry(1.65, 0.28, 1.65).translate(0, 0.14, 0), '#3b2d22'),
]);

const treeGeos = buildTreeSpeciesGeometries();
const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.04 });
const MAX_PER_SPECIES = 2600;
const treeMeshes = treeGeos.map((geo) => {
  const im = new THREE.InstancedMesh(geo, treeMat, MAX_PER_SPECIES);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.count = 0;
  im.frustumCulled = false;
  scene.add(im);
  return im;
});

const MAX_PLANTERS = 2400;
const planterMesh = new THREE.InstancedMesh(planterGeo, treeMat, MAX_PLANTERS);
planterMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
planterMesh.count = 0;
planterMesh.frustumCulled = false;
scene.add(planterMesh);

// Streetlamps & Custom Cyan Relays for Street Brush
const lampGeo = mergeGeometries([
  makeColoredGeo(new THREE.CylinderGeometry(0.07, 0.11, 4.6, 8).translate(0, 2.3, 0), '#232a34'),
  makeColoredGeo(new THREE.BoxGeometry(0.9, 0.1, 0.14).translate(0.38, 4.55, 0), '#232a34'),
  makeColoredGeo(new THREE.SphereGeometry(0.22, 10, 8).translate(0.75, 4.42, 0), '#ffc478'),
]);
const MAX_LAMPS = 900;
const streetLampMesh = new THREE.InstancedMesh(
  lampGeo,
  new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#ff9d42', emissiveIntensity: 0.35, roughness: 0.5 }),
  MAX_LAMPS
);
streetLampMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
streetLampMesh.count = 0;
streetLampMesh.frustumCulled = false;
scene.add(streetLampMesh);

const relayBrushGeo = mergeGeometries([
  makeColoredGeo(new THREE.CylinderGeometry(0.55, 0.65, 0.36, 12).translate(0, 0.18, 0), '#cfc6b8'),
  makeColoredGeo(new THREE.CylinderGeometry(0.16, 0.2, 1.65, 12).translate(0, 1.0, 0), '#18b4ff'),
]);
const customRelayMesh = new THREE.InstancedMesh(relayBrushGeo, matCyanRelay, 300);
customRelayMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
customRelayMesh.count = 0;
customRelayMesh.frustumCulled = false;
scene.add(customRelayMesh);

// Soil & Curb Placement Validator (Brief 3 & 6)
function canPlantTreeAt(x, z) {
  const y = hAt(x, z);
  if (y < 0.35) return null; // Never in water
  if (inBlackNonRoadZone(x, z)) return null;
  if (hitsBuilding(x, z)) return null;
  if (nearAnySet(x, z, 5.5)) return null;
  const nr = nearestRoad(x, z, 28);
  if (nr && nr.d < nr.w * 0.5 + 1.1) return null; // Never inside asphalt lane
  const needsPlanter = urbanFactorAt(x, z) > 0.32 || (nr && nr.d < nr.w * 0.5 + 5.5);
  return { y, needsPlanter };
}

function chooseRegionalSpecies(x, z, idx) {
  // Condesa / Atlantis gets Jacarandas & Cypresses; Coast gets Palms/Pines; Baltimere gets Oaks & Pines
  const dAtlantis = Math.hypot(x - 6750, z - 2850);
  const y = hAt(x, z);
  if (y < 3.2 && idx % 3 === 0) return 4; // Coastal Palm
  if (dAtlantis < 1400) return idx % 3 === 0 ? 3 : 1; // Jacaranda / Cypress
  if (y > 42) return 2; // Pine
  return idx % 4 === 0 ? 2 : 0; // Chesapeake Oak / Pine
}

const SPECIES_NAMES = [
  'Chesapeake Broadleaf Oak',
  'Condesa Jacaranda',
  'Harbor Tiered Pine',
  'Atlantis Columnar Cypress',
  'Coastal Wind-Curved Palm',
];
const CURB_PITS_STORAGE_KEY = 'make_photo_island_pits_v1';
let savedPitSpecies = {};
try {
  savedPitSpecies = JSON.parse(localStorage.getItem(CURB_PITS_STORAGE_KEY) || '{}') || {};
} catch {
  savedPitSpecies = {};
}
function persistPitSpecies() {
  try {
    localStorage.setItem(CURB_PITS_STORAGE_KEY, JSON.stringify(savedPitSpecies));
  } catch {
    // Ignore storage quota
  }
}

const treePitsGroup = new THREE.Group();
scene.add(treePitsGroup);
const interactiveTreePits = [];

function createInteractiveCurbPit({ id, x, z, initialSpecies = 0, heightM = 9.4, isSoilPatch = false }) {
  const y = Math.max(hAt(x, z), 0.32);
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // Carved stone curb rim (or raw soil border) + recessed rich dark loam soil bed
  const rimMat = new THREE.MeshStandardMaterial({
    color: isSoilPatch ? '#8f8270' : '#c8bfb0',
    roughness: 0.72,
  });
  const soilMat = new THREE.MeshStandardMaterial({
    color: '#2e2218',
    roughness: 0.94,
  });
  const rim = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.24, 2.36), rimMat);
  rim.position.y = 0.12;
  const soil = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.27, 1.88), soilMat);
  soil.position.y = 0.135;
  const cyanCollar = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 0.90, 24),
    new THREE.MeshBasicMaterial({ color: '#18b4ff', side: THREE.DoubleSide, transparent: true, opacity: 0.42 })
  );
  cyanCollar.rotation.x = -Math.PI / 2;
  cyanCollar.position.y = 0.28;
  g.add(rim, soil, cyanCollar);

  const treeHolder = new THREE.Group();
  treeHolder.position.y = -0.06;
  g.add(treeHolder);

  const spMeshes = treeGeos.map((geo, idx) => {
    const m = new THREE.Mesh(geo, treeMat);
    m.scale.setScalar(heightM);
    m.rotation.y = ((idx * 1.3 + x * 0.1) % (Math.PI * 2));
    m.visible = false;
    treeHolder.add(m);
    return m;
  });

  const savedVal = savedPitSpecies[id];
  const curSp = typeof savedVal === 'number' ? savedVal : initialSpecies;

  const pitRec = {
    id,
    x,
    y,
    z,
    heightM,
    species: curSp, // -1 = bare soil patch, 0..4 = 5 layered 3D tree species
    group: g,
    treeHolder,
    spMeshes,
    cyanCollar,
    growScale: 1.0,
  };

  function syncPitMeshes() {
    pitRec.spMeshes.forEach((m, idx) => {
      m.visible = idx === pitRec.species;
    });
    pitRec.cyanCollar.material.opacity = pitRec.species < 0 ? 0.68 : 0.34;
  }
  syncPitMeshes();
  pitRec.sync = syncPitMeshes;

  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.9, 4.2, 2.9), matHitProxy);
  hit.position.y = 1.9;
  addDiegeticTarget(hit, {
    kind: 'tree-pit',
    pit: pitRec,
    getAnchor: () => new THREE.Vector3(x, y + (pitRec.species >= 0 ? Math.min(5.2, heightM * 0.58) : 1.15), z),
    getWhisper: () =>
      pitRec.species < 0
        ? 'Curb Soil Patch · Unplanted — Click to Plant 3D Tree Species (1/5)'
        : `Stone Curb Tree-Pit · ${SPECIES_NAMES[pitRec.species]} (${pitRec.species + 1}/5) — Click to Cycle Species`,
  });
  g.add(hit);
  treePitsGroup.add(g);
  interactiveTreePits.push(pitRec);
  return pitRec;
}

const baseTrees = [];
const baseLamps = [];

{
  // Interactive Stone Curb Tree-Pits & Soil Patches along Cathedral St outside The Severn
  const severnPitSpecs = [
    [4.4, 4.3, 1, 9.2, false],   // Condesa Jacaranda in foreground-left curb pit
    [6.9, 4.5, -1, 9.0, true],   // Open curb soil patch ready to plant right beside camera!
    [4.4, -7.8, 0, 9.6, false],  // Chesapeake Broadleaf Oak in foreground-right curb pit
    [10.8, 5.2, 2, 9.4, false],  // Harbor Tiered Pine
    [11.4, -8.2, 3, 9.2, false], // Atlantis Columnar Cypress
    [15.2, 4.8, 4, 9.0, false],  // Coastal Wind-Curved Palm
  ];
  severnPitSpecs.forEach(([fOff, sOff, spIdx, hM, isSoil], idx) => {
    const tx = severnState.cx + severnState.ux * fOff + severnState.vx * sOff;
    const tz = severnState.cz + severnState.uz * fOff + severnState.vz * sOff;
    createInteractiveCurbPit({
      id: `severn-pit-${idx}`,
      x: tx,
      z: tz,
      initialSpecies: spIdx,
      heightM: hM,
      isSoilPatch: isSoil,
    });
  });

  // Regional Stone Curb Tree-Pits & Soil Patches across the 5 Harbor & Highland Districts
  const regionalPits = [
    ['ih-0', 2398, 3404, 0, false],
    ['ih-1', 2407, 3402, -1, true],
    ['ih-2', 2405, 3391, 4, false],
    ['fp-0', 3201, 3324, 0, false],
    ['fp-1', 3211, 3316, -1, true],
    ['fp-2', 3214, 3325, 2, false],
    ['ac-0', 6711, 2283, 3, false],
    ['ac-1', 6721, 2274, -1, true],
    ['ac-2', 6719, 2285, 1, false],
    ['co-0', 6553, 3656, 1, false],
    ['co-1', 6563, 3648, -1, true],
    ['co-2', 6562, 3658, 3, false],
    ['ch-0', 3885, 5065, 4, false],
    ['ch-1', 3895, 5056, -1, true],
    ['ch-2', 3896, 5066, 2, false],
  ];
  for (const [id, rx, rz, spIdx, isSoil] of regionalPits) {
    createInteractiveCurbPit({ id, x: rx, z: rz, initialSpecies: spIdx, heightM: 9.2, isSoilPatch: isSoil });
  }

  for (let i = 0; i < treesRaw.length; i++) {
    const [x, z, h] = treesRaw[i];
    if (interactiveTreePits.some((p) => Math.hypot(p.x - x, p.z - z) < 4.5)) continue;
    const check = canPlantTreeAt(x, z);
    if (!check) continue;
    const sp = chooseRegionalSpecies(x, z, i);
    baseTrees.push({ x, y: check.y, z, h: Math.max(6.5, h), sp, planter: check.needsPlanter, rot: (i * 1.73) % 6.28 });
  }

  // Seed warm sodium streetlamps along urban core streets (including Mount Vernon / Severn approach)
  for (let i = 0; i < roadSegments.length && baseLamps.length < 620; i += 4) {
    const seg = roadSegments[i];
    const mx = (seg.a[0] + seg.b[0]) * 0.5;
    const mz = (seg.a[1] + seg.b[1]) * 0.5;
    if (urbanFactorAt(mx, mz) < 0.25) continue;
    const off = seg.w * 0.5 + 1.25;
    const lx = mx - seg.tz * off;
    const lz = mz + seg.tx * off;
    const ly = hAt(lx, lz);
    if (ly < 0.4 || hitsBuilding(lx, lz)) continue;
    baseLamps.push({ x: lx, y: ly, z: lz, rot: Math.atan2(-seg.tz, seg.tx) });
  }
}

function loadCustomBrushItems() {
  try {
    const raw = localStorage.getItem(CUSTOM_BRUSH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

let customBrushItems = loadCustomBrushItems();

function saveCustomBrushItems() {
  try {
    localStorage.setItem(CUSTOM_BRUSH_KEY, JSON.stringify(customBrushItems.slice(-600)));
  } catch {
    // Ignore storage quota
  }
}

function rebuildInstancedBotanyAndStreetKit() {
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const upY = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();

  const spCounts = [0, 0, 0, 0, 0];
  let plCount = 0;
  let lmCount = 0;
  let rlCount = 0;

  const allTrees = [
    ...baseTrees,
    ...customBrushItems.filter((it) => it.kind === 'tree'),
  ];

  for (let i = 0; i < allTrees.length; i++) {
    const t = allTrees[i];
    const sp = Math.max(0, Math.min(4, t.sp || 0));
    const idx = spCounts[sp];
    if (idx >= MAX_PER_SPECIES) continue;
    q.setFromAxisAngle(upY, t.rot || 0);
    const h = t.h || 10;
    m4.compose(v.set(t.x, t.y - 0.15, t.z), q, sc.set(h, h, h));
    treeMeshes[sp].setMatrixAt(idx, m4);
    col.setHSL(0, 0, 0.88 + ((i % 7) - 3) * 0.03);
    treeMeshes[sp].setColorAt(idx, col);
    spCounts[sp]++;

    if (t.planter && plCount < MAX_PLANTERS) {
      q.setFromAxisAngle(upY, (t.rot || 0) * 0.5);
      m4.compose(v.set(t.x, t.y, t.z), q, sc.set(1, 1, 1));
      planterMesh.setMatrixAt(plCount++, m4);
    }
  }

  const allLamps = [
    ...baseLamps,
    ...customBrushItems.filter((it) => it.kind === 'lamp'),
  ];
  for (let i = 0; i < allLamps.length && lmCount < MAX_LAMPS; i++) {
    const l = allLamps[i];
    q.setFromAxisAngle(upY, l.rot || 0);
    m4.compose(v.set(l.x, l.y, l.z), q, sc.set(1, 1, 1));
    streetLampMesh.setMatrixAt(lmCount++, m4);
  }

  const customRelays = customBrushItems.filter((it) => it.kind === 'relay');
  for (let i = 0; i < customRelays.length && rlCount < 300; i++) {
    const r = customRelays[i];
    q.setFromAxisAngle(upY, 0);
    m4.compose(v.set(r.x, r.y, r.z), q, sc.set(1, 1, 1));
    customRelayMesh.setMatrixAt(rlCount++, m4);
  }

  treeMeshes.forEach((im, s) => {
    im.count = spCounts[s];
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });
  planterMesh.count = plCount;
  planterMesh.instanceMatrix.needsUpdate = true;
  streetLampMesh.count = lmCount;
  streetLampMesh.instanceMatrix.needsUpdate = true;
  customRelayMesh.count = rlCount;
  customRelayMesh.instanceMatrix.needsUpdate = true;

  $('brush-count-label').textContent = `${customBrushItems.length} custom planted`;
}

rebuildInstancedBotanyAndStreetKit();

// 3D Cyan Brush Cursor Ring
const brushCursor = new THREE.Mesh(
  new THREE.RingGeometry(0.92, 1.0, 48),
  new THREE.MeshBasicMaterial({ color: '#18b4ff', side: THREE.DoubleSide, transparent: true, opacity: 0.88 })
);
brushCursor.rotation.x = -Math.PI / 2;
brushCursor.visible = false;
scene.add(brushCursor);

// ---------------------------------------------------------------------------
// 10. Driveable Expedition Cruiser + Curb-Parked Service Cruisers
// ---------------------------------------------------------------------------
function buildExpeditionCruiser(bodyHex = '#1f3652') {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyHex, roughness: 0.34, metalness: 0.52 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#8fd4ff', roughness: 0.12, metalness: 0.78, transparent: true, opacity: 0.72 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#14171c', roughness: 0.85 });

  // Ground contact shadow plate
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 4.9),
    new THREE.MeshBasicMaterial({ color: '#05080e', transparent: true, opacity: 0.58, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  g.add(shadow);

  const chassis = makePart(new THREE.BoxGeometry(2.08, 0.78, 4.55), bodyMat, 0, 0.72, 0);
  const cabin = makePart(new THREE.BoxGeometry(1.82, 0.68, 2.35), bodyMat, 0, 1.42, -0.15);
  const windshield = makePart(new THREE.BoxGeometry(1.74, 0.54, 2.42), glassMat, 0, 1.41, -0.15);
  const bumperF = makePart(new THREE.BoxGeometry(2.14, 0.24, 0.26), matDarkIron, 0, 0.44, -2.32);
  const bumperR = makePart(new THREE.BoxGeometry(2.14, 0.24, 0.26), matDarkIron, 0, 0.44, 2.32);
  g.add(chassis, cabin, windshield, bumperF, bumperR);

  // Roof rack + brass tripod + twin 20L cyan canisters
  g.add(makePart(new THREE.BoxGeometry(1.56, 0.08, 1.9), matBrass, 0, 1.80, -0.15));
  g.add(makePart(new THREE.BoxGeometry(0.28, 0.34, 0.42), matCyanRelay, -0.44, 1.98, -0.25));
  g.add(makePart(new THREE.BoxGeometry(0.28, 0.34, 0.42), matCyanRelay, 0.44, 1.98, 0.22));
  g.add(makePart(new THREE.CylinderGeometry(0.05, 0.05, 1.35, 8), matBrass, 0, 1.92, -0.15).rotateX(Math.PI * 0.5));

  // Headlights & brake lamps
  for (const sx of [-0.72, 0.72]) {
    g.add(makePart(new THREE.BoxGeometry(0.36, 0.18, 0.1), matWarmGlow, sx, 0.78, -2.29));
    g.add(makePart(new THREE.BoxGeometry(0.34, 0.16, 0.1), matSevernRedFixture, sx, 0.78, 2.29));
  }

  const wheels = [];
  for (const [wx, wz] of [[-1.02, -1.42], [1.02, -1.42], [-1.02, 1.42], [1.02, 1.42]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16), tireMat);
    w.rotation.z = Math.PI * 0.5;
    w.position.set(wx, 0.38, wz);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.30, 10), matBrass);
    w.add(hub);
    g.add(w);
    wheels.push(w);
  }
  const parcelCargo = createParcelBundle();
  parcelCargo.position.set(0, 1.98, 0.52);
  g.add(parcelCargo);

  const cruiserHit = new THREE.Mesh(new THREE.BoxGeometry(2.85, 2.35, 5.25), matHitProxy);
  cruiserHit.position.set(0, 1.15, 0);
  g.add(cruiserHit);

  g.userData = { wheels, parcelCargo, cruiserHit };
  return g;
}

const cruiser = buildExpeditionCruiser('#1b3858');
addDiegeticTarget(cruiser.userData.cruiserHit, {
  kind: 'cruiser',
  isPlayerCruiser: true,
  getAnchor: () => new THREE.Vector3(cruiser.position.x, cruiser.position.y + 2.45, cruiser.position.z),
  getWhisper: () =>
    state.mode === 'drive'
      ? 'Expedition Cruiser · Driving (WASD) — Click Street Curb or Press F to Step Out'
      : 'Curb Expedition Cruiser — Click to Board & Drive (WASD)',
});
scene.add(cruiser);

// Place a couple of curb-waiting regional delivery cruisers with real destinations
const curbDestinations = [
  { name: 'Mount Vernon Bay', x: severnState.curbX, z: severnState.curbZ, hd: severnState.curbHd },
  { name: 'Inner Harbor Wharf', x: 2412, z: 3398, hd: 1.2 },
  { name: 'Fells Point Promenade', x: 3208, z: 3326, hd: -0.6 },
  { name: 'Atlantis Light Gates Curb', x: 6722, z: 2282, hd: 2.1 },
  { name: 'Condesa Courtyard Curb', x: 6562, z: 3652, hd: 0.4 },
];
for (let i = 1; i < 4; i++) {
  const cd = curbDestinations[i];
  const npcVan = buildExpeditionCruiser(i % 2 === 0 ? '#3a4a5e' : '#5c3c34');
  npcVan.position.set(cd.x, Math.max(hAt(cd.x, cd.z), 0.3), cd.z);
  npcVan.rotation.y = -cd.hd;
  npcVan.userData.parcelCargo.visible = true;
  addDiegeticTarget(npcVan.userData.cruiserHit, {
    kind: 'service-cruiser',
    dest: cd,
    van: npcVan,
    getAnchor: () => new THREE.Vector3(npcVan.position.x, npcVan.position.y + 2.45, npcVan.position.z),
    getWhisper: () => `${cd.name} Cruiser — Click to Board & Drive`,
  });
  scene.add(npcVan);
}

// ---------------------------------------------------------------------------
// 11. Playable Anny V8 Human + Persistent Anny V8 Regional Cast
// ---------------------------------------------------------------------------
function spawnAnnyActor({ archetype, skinHex, coatHex, x, y, z, ry = 0, initialClip = 'idle' }) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = ry;

  // Articulated proxy while GLB streams
  const proxy = new THREE.Group();
  const coatMat = new THREE.MeshStandardMaterial({ color: coatHex, roughness: 0.72 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.62 });
  const legMat = new THREE.MeshStandardMaterial({ color: '#1b222c', roughness: 0.82 });
  proxy.add(makePart(new THREE.CylinderGeometry(0.19, 0.25, 0.82, 10), coatMat, 0, 1.08, 0));
  proxy.add(makePart(new THREE.SphereGeometry(0.14, 12, 10), skinMat, 0, 1.64, 0));
  const legL = makePart(new THREE.CylinderGeometry(0.06, 0.05, 0.66, 8), legMat, -0.1, 0.33, 0);
  const legR = makePart(new THREE.CylinderGeometry(0.06, 0.05, 0.66, 8), legMat, 0.1, 0.33, 0);
  proxy.add(legL, legR);
  root.add(proxy);

  const carried = createParcelBundle();
  carried.position.set(0.24, 1.02, -0.26);
  carried.visible = false;
  root.add(carried);

  scene.add(root);

  const actor = { root, proxy, legL, legR, carried, v8: null, clip: initialClip, phase: Math.random() * 6 };

  if (typeof window !== 'undefined' && window.AnnyHumanV7 && window.AnnyHumanV7.createCharacter) {
    window.AnnyHumanV7.createCharacter({
      THREE,
      loader: gltfLoader,
      archetype,
      assetBaseUrl: '../../abyssinian-highlands/human-forge/assets',
      clipsBaseUrl: '../../motion-pipeline/mesh2motion/clips',
      clothed: true,
      groundY: y,
      preloadClips: ['idle', 'walk', 'idle-talking'],
      initialClip,
    })
      .then((inst) => {
        if (!inst) return;
        inst.root.position.set(0, 0, 0);
        inst.root.rotation.set(0, Math.PI, 0);
        root.add(inst.root);
        proxy.visible = false;
        actor.v8 = inst;
        inst.setGroundY(root.position.y);
      })
      .catch(() => {});
  }
  return actor;
}

const playerActor = spawnAnnyActor({
  archetype: 'adult_f',
  skinHex: '#8d5b3e',
  coatHex: '#255a7a',
  x: severnState.thresholdX,
  y: severnState.y0,
  z: severnState.thresholdZ,
});

const castDefs = [
  {
    id: 'bekele',
    name: 'Bekele · Severn Steward',
    archetype: 'adult_m',
    skinHex: '#7a4b32',
    coatHex: '#9a6842',
    x: severnState.bekelePos.x,
    y: severnState.bekelePos.y,
    z: severnState.bekelePos.z,
    ry: 0.4,
    line: 'Welcome to 701 Cathedral St. Hand me the Severn parcel or close the vestibule door to hear the street quiet down.',
  },
  {
    id: 'hiwot',
    name: 'Hiwot · Inner Harbor Warden',
    archetype: 'adult_f',
    skinHex: '#8c5a3e',
    coatHex: '#2f6d78',
    x: 2394,
    y: Math.max(hAt(2394, 3388), 0.5),
    z: 3388,
    ry: -0.8,
    line: 'The white temple stands on the chapel stones; every cyan standpipe feeds the harbor darkroom.',
  },
  {
    id: 'dawit',
    name: 'Dawit · Atlantis Archivist',
    archetype: 'elder',
    skinHex: '#7d523a',
    coatHex: '#6c5a88',
    x: 6706,
    y: Math.max(hAt(6706, 2268), 0.5),
    z: 2268,
    ry: 1.2,
    line: 'At the Light Gates of Centro, +4 metres marks the Fall salt line across every older facade.',
  },
  {
    id: 'selam',
    name: 'Selam · Condesa Courier',
    archetype: 'child7',
    skinHex: '#916043',
    coatHex: '#b86848',
    x: 6550,
    y: Math.max(hAt(6550, 3644), 0.5),
    z: 3644,
    ry: 0.2,
    line: 'Jacarandas only take root in the sidewalk soil pits here in Condesa.',
  },
];

const residents = castDefs.map((d) => {
  const actor = spawnAnnyActor(d);
  const resRec = { ...d, actor };
  const npcHit = makePart(new THREE.CylinderGeometry(0.78, 0.78, 2.1, 10), matHitProxy, 0, 1.05, 0);
  addDiegeticTarget(npcHit, {
    kind: 'resident',
    resident: resRec,
    getAnchor: () => new THREE.Vector3(actor.root.position.x, actor.root.position.y + 1.98, actor.root.position.z),
    getWhisper: () => {
      const holder = pilot.parcelHolder || 'player';
      const hasIt = holder === d.id;
      return hasIt
        ? `${d.name} (Holding Parcel + 5L Cyan) — Click to Retrieve`
        : `${d.name} — Click to Hand Off Parcel & 5L Cyan Jerrycan`;
    },
  });
  actor.root.add(npcHit);
  if (d.id !== 'bekele') {
    interactiveNodes.push({
      id: `npc-${d.id}`,
      kind: 'resident',
      label: `Talk to ${d.name}`,
      x: d.x,
      y: d.y,
      z: d.z,
      radius: 5.2,
      provenance: 'checked',
      onAct: () => handoffWithResident(resRec),
    });
  }
  return resRec;
});

const bekeleResident = residents[0];

// ---------------------------------------------------------------------------
// 12. Player / Cruiser / Camera State & Jump Presets
// ---------------------------------------------------------------------------
const state = {
  mode: 'walk', // 'walk' | 'drive'
  brushOpen: false,
  brushKind: 'grove',
  reverseAngle: false,
  px: severnState.cx + severnState.ux * 7.6 - severnState.vx * 1.4,
  pz: severnState.cz + severnState.uz * 7.6 - severnState.vz * 1.4,
  py: severnState.y0,
  phd: Math.atan2(-severnState.ux - severnState.vx * 0.56, severnState.uz + severnState.vz * 0.56),
  cx: severnState.curbX,
  cz: severnState.curbZ,
  cy: severnState.y0,
  chd: severnState.curbHd,
  cv: 0,
  camYaw: Math.atan2(-severnState.ux - severnState.vx * 0.56, severnState.uz + severnState.vz * 0.56),
  camPitch: -0.04,
  camDist: 9.2,
  curbDestIdx: 0,
  glideAnim: null,
};

// Warm curb streetlamp illuminating player, Cruiser, Tripod & Severn stoop
const curbHeroLight = new THREE.PointLight('#ffca88', 2.4, 28, 1.4);
curbHeroLight.position.set(
  severnState.cx + severnState.ux * 8.2,
  severnState.y0 + 5.2,
  severnState.cz + severnState.uz * 8.2
);
scene.add(curbHeroLight);

let worldSpeechState = null; // { anchorVec3, speaker, text, until }
function setWorldSpeech(anchorVec3, speaker, text, durMs = 4600) {
  worldSpeechState = {
    anchorVec3: anchorVec3 ? anchorVec3.clone() : new THREE.Vector3(state.px, state.py + 2.1, state.pz),
    speaker,
    text,
    until: performance.now() + durMs,
  };
}

function showSpeech(speaker, text, anchorVec3 = null) {
  $('speech-speaker').textContent = speaker;
  $('speech-line').textContent = text;
  $('speech-toast').classList.add('visible');
  clearTimeout(showSpeech._t);
  showSpeech._t = setTimeout(() => $('speech-toast').classList.remove('visible'), 4600);
  setWorldSpeech(
    anchorVec3 || new THREE.Vector3(severnState.thresholdX, severnState.y0 + 2.4, severnState.thresholdZ),
    speaker,
    text,
    4600
  );
}

function syncPilotVisuals() {
  const holder = pilot.parcelHolder || 'player';
  playerActor.carried.visible = holder === 'player' && state.mode === 'walk';
  for (const r of residents) {
    r.actor.carried.visible = holder === r.id;
  }
  cruiser.userData.parcelCargo.visible = holder === 'cruiser' || (holder === 'player' && state.mode === 'drive');

  $('val-door-state').textContent = pilot.doorOpen ? 'OPEN (Street + Lobby)' : 'CLOSED (Muffled)';
  $('val-parcel-holder').textContent = holder.toUpperCase();
  $('btn-toggle-door').classList.toggle('active', !!pilot.doorOpen);
  $('prov-select').value = pilot.provenanceFilter || 'all';

  if (severnState.vestibuleLight) {
    severnState.vestibuleLight.intensity = pilot.doorOpen ? 3.2 : 1.0;
  }

  const mapsLink = $('link-to-maps');
  if (mapsLink) {
    mapsLink.href = `../maps/${formatPilotHash(pilot)}`;
  }
}

function toggleSevernDoor(stepInside = false) {
  const next = !pilot.doorOpen;
  savePilotState({ doorOpen: next, building: 'severn' });
  pilot = { ...pilot, doorOpen: next };
  if (shaderSuite?.audio) {
    shaderSuite.audio.setDoorOpen?.(next, true);
    shaderSuite.audio.playDoorTransition?.(next);
  }
  syncPilotVisuals();
  if (next && stepInside && state.mode === 'walk') {
    const [inStepX, inStepZ] = severnState.toW(-2.2, -0.4);
    const d = Math.hypot(state.px - severnState.thresholdX, state.pz - severnState.thresholdZ);
    if (d < 24) {
      state.glideAnim = {
        elapsed: 0,
        dur: 0.72,
        x0: state.px,
        z0: state.pz,
        x1: inStepX,
        z1: inStepZ,
        cx0: state.cx,
        cz0: state.cz,
        cx1: state.cx,
        cz1: state.cz,
        yaw0: state.camYaw,
        yaw1: Math.atan2(-severnState.ux, severnState.uz),
        arcH: 0,
        keepMode: true,
      };
    }
  }
  showSpeech(
    'SEVERN THRESHOLD DOOR',
    next
      ? 'Door opened (13.5 kHz): step inside the Nolli water depot.'
      : 'Door closed (580 Hz): vestibule sealed and street bed muffled.',
    new THREE.Vector3(severnState.thresholdX, severnState.y0 + 3.1, severnState.thresholdZ)
  );
}

function handoffWithResident(res) {
  const targetId = res?.id || 'bekele';
  const cur = pilot.parcelHolder || 'player';
  const next = cur === targetId ? 'player' : targetId;
  savePilotState({ parcelHolder: next, building: 'severn' });
  pilot = { ...pilot, parcelHolder: next };
  syncPilotVisuals();

  if (res?.actor?.v8 && typeof res.actor.v8.playClip === 'function') {
    res.actor.v8.playClip('idle-talking', 0.2);
    setTimeout(() => {
      if (res.actor.v8 && typeof res.actor.v8.playClip === 'function') {
        res.actor.v8.playClip('idle', 0.3);
      }
    }, 3600);
  }
  if (shaderSuite?.audio) shaderSuite.audio.playPour?.();
  const spoken =
    next === targetId
      ? `${res.line} Parcel and 5L cyan jerrycan received.`
      : 'Parcel and 5L cyan jerrycan handed back to you for the road.';
  if (shaderSuite?.speakLine) {
    shaderSuite.speakLine(res.name, spoken, targetId === 'bekele' ? 0.94 : 1.04);
  }
  showSpeech(
    res.name.toUpperCase(),
    spoken,
    new THREE.Vector3(res.actor.root.position.x, res.actor.root.position.y + 1.98, res.actor.root.position.z)
  );
}

function cycleParcelHandoff() {
  let nearestRes = bekeleResident;
  let bestD = Infinity;
  for (const r of residents) {
    const d = Math.hypot(state.px - r.actor.root.position.x, state.pz - r.actor.root.position.z);
    if (d < bestD) {
      bestD = d;
      nearestRes = r;
    }
  }
  handoffWithResident(nearestRes);
}

subscribePilotState((next) => {
  pilot = next;
  applyHourToSky(pilot.worldTime ?? 18.5);
  syncPilotVisuals();
});

// Time-of-day sky lighting
function applyHourToSky(hourVal) {
  const h = Number.isFinite(hourVal) ? hourVal : 18.5;
  const rad = ((h - 6) / 24) * Math.PI * 2;
  const sunY = Math.sin(rad);
  const day01 = THREE.MathUtils.clamp((sunY + 0.18) / 0.85, 0, 1);
  const dusk01 = Math.exp(-Math.pow((h - 18.6) / 1.8, 2)) + Math.exp(-Math.pow((h - 6.2) / 1.5, 2));

  skyUniforms.uSunDir.value.set(Math.cos(rad) * 0.8, Math.max(-0.25, sunY), -0.6).normalize();
  skyUniforms.uStars.value = THREE.MathUtils.clamp(1 - day01 * 1.35, 0, 0.85);

  const topNight = new THREE.Color('#061224');
  const topBlue = new THREE.Color('#0c1f38');
  const topDay = new THREE.Color('#1c4c82');
  skyUniforms.uTop.value.copy(topNight).lerp(topDay, day01).lerp(topBlue, dusk01 * 0.65);

  const horNight = new THREE.Color('#132946');
  const horDusk = new THREE.Color('#c8764b');
  const horDay = new THREE.Color('#7aa8cf');
  skyUniforms.uHor.value.copy(horNight).lerp(horDay, day01).lerp(horDusk, Math.min(1, dusk01 * 0.85));

  sunLight.intensity = 0.45 + day01 * 1.45 + dusk01 * 0.45;
  sunLight.color.set(dusk01 > 0.35 ? '#ffb067' : day01 > 0.5 ? '#fff1dc' : '#7ba6de');
  hemiLight.intensity = 0.72 + day01 * 0.65;
  scene.fog.color.copy(skyUniforms.uHor.value).lerp(skyUniforms.uTop.value, 0.55);
}

applyHourToSky(pilot.worldTime ?? 18.5);

// Region & Poem Jump Presets
const JUMP_PRESETS = {
  severn: {
    label: 'The Severn · 701 Cathedral St',
    region: 'BALTIMERE · MOUNT VERNON',
    poem: '01',
    district: 'baltimere-mount-vernon',
    x: severnState.cx + severnState.ux * 8.6 + severnState.vx * 1.4,
    z: severnState.cz + severnState.uz * 8.6 + severnState.vz * 1.4,
    cx: severnState.curbX,
    cz: severnState.curbZ,
    yaw: Math.atan2(-severnState.ux - severnState.vx * 0.28, severnState.uz + severnState.vz * 0.28),
    prov: 'checked',
  },
  'inner-harbor': {
    label: 'White Temple & Harbor Promenade',
    region: 'BALTIMERE · INNER HARBOR',
    poem: '11',
    district: 'baltimere-inner-harbor',
    x: 2402,
    z: 3398,
    cx: 2414,
    cz: 3406,
    yaw: -0.5,
    prov: 'recorded',
  },
  'fells-point': {
    label: 'Corner Cafe & Harbor Cobbles',
    region: 'BALTIMERE · FELLS POINT',
    poem: '13',
    district: 'baltimere-fells-point',
    x: 3206,
    z: 3320,
    cx: 3216,
    cz: 3328,
    yaw: -0.65,
    prov: 'recorded',
  },
  centro: {
    label: 'The Light Gates · Resurrecting Atlantis',
    region: 'ATLANTIS · CENTRO HISTORICO',
    poem: '06',
    district: 'atlantis-centro',
    x: 6716,
    z: 2278,
    cx: 6726,
    cz: 2286,
    yaw: -0.75,
    prov: 'inferred',
  },
  condesa: {
    label: 'Condesa Jacaranda Courtyard',
    region: 'ATLANTIS · CONDESA',
    poem: '07',
    district: 'atlantis-condesa',
    x: 6558,
    z: 3652,
    cx: 6568,
    cz: 3660,
    yaw: -0.7,
    prov: 'inferred',
  },
  chapel: {
    label: 'Eroding Shore Chapel',
    region: 'CHAPEL · HOLLAND ISLAND',
    poem: '03',
    district: 'chapel-shore',
    x: 3890,
    z: 5060,
    cx: 3902,
    cz: 5068,
    yaw: -0.6,
    prov: 'recorded',
  },
  black: {
    label: 'The Old Door in The Black (Outside Street Network)',
    region: 'THE BLACK · NONGEOGRAPHIC ACCOUNT',
    poem: '14',
    district: 'the-black',
    x: BLACK_SET.x,
    z: BLACK_SET.y + 11,
    cx: severnState.curbX, // Cruiser stays parked on real Mount Vernon street!
    cz: severnState.curbZ,
    yaw: 0,
    prov: 'invented',
  },
};

// ---------------------------------------------------------------------------
// 12b. Sky-High District Light Beacons & Harbor Buoys (Click Horizon to Glide)
// ---------------------------------------------------------------------------
const beaconsGroup = new THREE.Group();
scene.add(beaconsGroup);
const districtBeacons = [];

function createBeaconBeamMaterial(hexColor) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(hexColor) },
      uTime: { value: 0 },
      uOpacity: { value: 0.72 },
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
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float edge = sin(vUv.x * 3.14159265);
        float core = pow(max(edge, 0.0), 1.45);
        float vFade = smoothstep(0.0, 0.06, vUv.y) * pow(1.0 - vUv.y, 1.35);
        float pulse = 0.86 + 0.14 * sin(uTime * 2.1 + vUv.y * 9.0);
        float alpha = core * vFade * pulse * uOpacity;
        gl_FragColor = vec4(uColor * (1.15 + core * 0.65), alpha);
      }
    `,
  });
}

const BEACON_DEFS = [
  { key: 'inner-harbor', name: 'Inner Harbor', sub: 'Harbor Lighthouse Buoy · Poem 11', color: '#38d6ff', buoy: true, beamH: 920 },
  { key: 'fells-point', name: 'Fells Point', sub: 'Cobble Wharf Bell-Buoy · Poem 13', color: '#ffb457', buoy: true, beamH: 980 },
  { key: 'centro', name: 'Atlantis Centro', sub: 'Light Gates Beacon · Poem 06', color: '#18b4ff', buoy: false, beamH: 1350 },
  { key: 'condesa', name: 'Condesa', sub: 'Jacaranda Terrace Beacon · Poem 07', color: '#a88cff', buoy: false, beamH: 1350 },
  { key: 'chapel', name: 'Chapel Shore', sub: 'Holland Island Channel Buoy · Poem 03', color: '#64e8c4', buoy: true, beamH: 1120 },
  { key: 'severn', name: 'Severn Pilot', sub: '701 Cathedral St · Mount Vernon', color: '#f2a541', buoy: false, beamH: 820 },
];

for (const bd of BEACON_DEFS) {
  const preset = JUMP_PRESETS[bd.key];
  if (!preset) continue;
  // Offset beacon base slightly from player landing spot so player lands facing it cleanly
  const bx = preset.x + (bd.buoy ? 18 : -14);
  const bz = preset.z + (bd.buoy ? 22 : -14);
  const by = Math.max(hAt(bx, bz), 0.15);

  const g = new THREE.Group();
  g.position.set(bx, by, bz);

  const lanternMat = new THREE.MeshStandardMaterial({
    color: bd.color,
    emissive: bd.color,
    emissiveIntensity: 2.1,
    roughness: 0.16,
  });

  if (bd.buoy) {
    // Sculptural Harbor Bell-Buoy / Quay Beacon Plinth
    const floatBase = makePart(new THREE.CylinderGeometry(2.1, 2.6, 1.5, 16), matDarkIron, 0, 0.75, 0);
    const brassRing = makePart(new THREE.TorusGeometry(2.35, 0.16, 8, 24), matBrass, 0, 1.45, 0);
    brassRing.rotation.x = Math.PI / 2;
    const cage = makePart(new THREE.CylinderGeometry(0.95, 1.55, 5.4, 8, 1, true), matBrass, 0, 4.1, 0);
    const globe = makePart(new THREE.OctahedronGeometry(1.15, 1), lanternMat, 0, 7.2, 0);
    g.add(floatBase, brassRing, cage, globe);
  } else {
    // Architectural Stone & Brass District Beacon Obelisk
    const plinth = makePart(new THREE.BoxGeometry(3.8, 1.4, 3.8), matLimestone, 0, 0.7, 0);
    const shaft = makePart(new THREE.CylinderGeometry(0.95, 1.35, 7.6, 8), matWarmPlaster, 0, 5.1, 0);
    const crown = makePart(new THREE.OctahedronGeometry(1.25, 1), lanternMat, 0, 9.5, 0);
    g.add(plinth, shaft, crown);
  }

  // Sky-High Horizon Light Shaft + High Star Lantern
  const beamMat = createBeaconBeamMaterial(bd.color);
  beamMat.uniforms.uOpacity.value = 0.92;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5, 11.5, bd.beamH, 16, 1, true),
    beamMat
  );
  beam.position.y = bd.beamH * 0.5 + 6.0;
  beam.frustumCulled = false;
  g.add(beam);

  const skyStar = new THREE.Mesh(
    new THREE.OctahedronGeometry(11.5, 0),
    new THREE.MeshBasicMaterial({ color: bd.color, fog: false })
  );
  skyStar.position.y = Math.min(340, bd.beamH * 0.34);
  skyStar.frustumCulled = false;
  g.add(skyStar);

  // Generous invisible raycast cylinder so horizon beacons click effortlessly from 4.6 km away
  const hitCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(48, 48, bd.beamH, 10),
    matHitProxy
  );
  hitCyl.position.y = bd.beamH * 0.5;
  hitCyl.frustumCulled = false;
  const beaconRec = { ...bd, bx, by, bz, group: g, beamMat, skyStar, hitCyl };
  addDiegeticTarget(hitCyl, {
    kind: 'beacon',
    beacon: beaconRec,
    getAnchor: () => {
      const dist = Math.hypot(camera.position.x - bx, camera.position.z - bz);
      const labelY = by + THREE.MathUtils.clamp(dist * 0.055, 13, 185);
      return new THREE.Vector3(bx, labelY, bz);
    },
    getWhisper: () => {
      const distKm = (Math.hypot(state.px - preset.x, state.pz - preset.z) / 1000).toFixed(1);
      return `${bd.name} Beacon (${distKm} km) · ${bd.sub} — Click to Glide There`;
    },
  });
  g.add(hitCyl);

  beaconsGroup.add(g);
  districtBeacons.push(beaconRec);
}

let worldRig = null;
function placeCurbTripodForPreset(key) {
  if (!worldRig || !worldRig.tripodGroup) return;
  if (key === 'severn') {
    const [tx, tz] = severnState.toW(5.6, 2.7);
    const ty = Math.max(hAt(tx, tz), severnState.y0);
    worldRig.tripodGroup.position.set(tx, ty + 0.06, tz);
    worldRig.tripodGroup.rotation.y = severnState.rotY + Math.PI;
    return;
  }
  const p = JUMP_PRESETS[key];
  if (!p) return;
  const tx = p.x + Math.cos(p.yaw) * 3.1 - Math.sin(p.yaw) * 1.8;
  const tz = p.z + Math.sin(p.yaw) * 3.1 + Math.cos(p.yaw) * 1.8;
  const ty = Math.max(hAt(tx, tz), 0.35);
  worldRig.tripodGroup.position.set(tx, ty, tz);
  worldRig.tripodGroup.rotation.y = -p.yaw + Math.PI;
}

function updateProvenanceBadge(prov) {
  const b = $('active-prov-badge');
  b.className = `prov-badge prov-${prov}`;
  b.textContent = prov.toUpperCase();
}

function glideToPreset(key, instant = false) {
  const p = JUMP_PRESETS[key];
  if (!p) return;
  state.reverseAngle = false;
  state.cv = 0;

  if (key === 'black') {
    state.mode = 'walk';
  }

  $('hud-region').textContent = p.region;
  $('hud-place').textContent = p.label;
  $('set-select').value = p.poem;
  updateProvenanceBadge(p.prov);
  document.querySelectorAll('#region-pills .pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.jump === key);
  });
  savePilotState({ poem: p.poem, district: p.district });

  const dist = Math.hypot(p.x - state.px, p.z - state.pz);
  if (instant || dist < 18) {
    state.px = p.x;
    state.pz = p.z;
    state.py = Math.max(hAt(p.x, p.z), 0.35);
    state.cx = p.cx;
    state.cz = p.cz;
    state.cy = Math.max(hAt(p.cx, p.cz), 0.35);
    state.camYaw = p.yaw;
    state.phd = p.yaw;
    state.chd = p.yaw;
    state.glideAnim = null;
    placeCurbTripodForPreset(key);
    syncModeButtons();
    return;
  }

  state.glideAnim = {
    key,
    elapsed: 0,
    dur: THREE.MathUtils.clamp(0.95 + dist / 4200, 1.0, 1.75),
    x0: state.px,
    z0: state.pz,
    x1: p.x,
    z1: p.z,
    cx0: state.cx,
    cz0: state.cz,
    cx1: p.cx,
    cz1: p.cz,
    yaw0: state.camYaw,
    yaw1: p.yaw,
    arcH: THREE.MathUtils.clamp(dist * 0.045, 14, 145),
    keepMode: key !== 'black',
  };
  placeCurbTripodForPreset(key);
  syncModeButtons();
  showSpeech(
    p.region,
    `Gliding across harbor to ${p.label}.`,
    new THREE.Vector3(p.x, Math.max(hAt(p.x, p.z), 0.5) + 2.4, p.z)
  );
}

function cycleTreePitSpecies(pit) {
  if (!pit) return;
  // Cycle 0 -> 1 -> 2 -> 3 -> 4 -> -1 (Open Soil Patch) -> 0
  pit.species = pit.species >= 4 ? -1 : pit.species + 1;
  savedPitSpecies[pit.id] = pit.species;
  persistPitSpecies();
  pit.sync();
  pit.growScale = 0.16;
  if (shaderSuite?.audio) shaderSuite.audio.playPour?.();
  const label =
    pit.species < 0
      ? 'Cleared back to open curb soil bed — click again to plant Chesapeake Broadleaf Oak.'
      : `Planted ${SPECIES_NAMES[pit.species]} (${pit.species + 1}/5) in stone curb pit.`;
  setWorldSpeech(
    new THREE.Vector3(pit.x, pit.y + (pit.species >= 0 ? 4.2 : 1.3), pit.z),
    'STONE CURB TREE-PIT',
    label,
    2800
  );
}

function jumpToPreset(key) {
  glideToPreset(key, false);
}

function jumpToSetNum(num) {
  if (num === '01') return jumpToPreset('severn');
  if (num === '14') return jumpToPreset('black');
  const s = SET_BY_NUM[num];
  if (!s) return;
  state.mode = 'walk';
  state.reverseAngle = false;
  state.px = s.x + 12;
  state.pz = s.y + 12;
  state.py = Math.max(hAt(state.px, state.pz), 0.35);
  const nr = nearestRoad(s.x, s.y, 180);
  if (nr) {
    state.cx = nr.x;
    state.cz = nr.z;
    state.chd = nr.hd;
  } else {
    state.cx = s.x + 18;
    state.cz = s.y + 16;
  }
  state.cy = Math.max(hAt(state.cx, state.cz), 0.35);
  state.camYaw = Math.atan2(s.x - state.px, -(s.y - state.pz));
  state.phd = state.camYaw;
  $('hud-region').textContent = `${s.region.toUpperCase()} · POEM ${s.num}`;
  $('hud-place').textContent = `${s.num} · ${s.title}`;
  updateProvenanceBadge(s.region === 'baltimere' ? 'recorded' : 'inferred');
  syncModeButtons();
  savePilotState({ poem: s.num });
}

// Populate 14 Poem Sets dropdown
{
  const sel = $('set-select');
  sel.innerHTML = SETS.map(
    (s) => `<option value="${s.num}">Poem ${s.num} · ${s.title}${s.num === '14' ? ' [Non-Road]' : ''}</option>`
  ).join('');
  sel.value = pilot.poem || '01';
  sel.addEventListener('change', () => jumpToSetNum(sel.value));
}

// ---------------------------------------------------------------------------
// 13. Controls, Collision, Driving, Walking & Tree/Street Brush
// ---------------------------------------------------------------------------
const keys = {};
function segDist(x, z, w) {
  const dx = w.x1 - w.x0;
  const dz = w.z1 - w.z0;
  const L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - w.x0) * dx + (z - w.z0) * dz) / L2));
  return Math.hypot(x - w.x0 - dx * t, z - w.z0 - dz * t);
}

function hitsWallCollider(x, z, y, radius = 0.42) {
  for (let i = 0; i < wallColliders.length; i++) {
    const w = wallColliders[i];
    if (w.activeFn && !w.activeFn()) continue;
    if (Math.abs(w.y - y) < 3.2 && segDist(x, z, w) < radius) return true;
  }
  return false;
}

function isInsideSevernVestibule(x, z) {
  return Math.hypot(x - severnState.cx, z - severnState.cz) < 12.5;
}

function syncModeButtons() {
  $('btn-mode-walk').classList.toggle('active', state.mode === 'walk');
  $('btn-mode-drive').classList.toggle('active', state.mode === 'drive');
  $('btn-mode-brush').classList.toggle('active', state.brushOpen);
  $('brush-drawer').classList.toggle('open', state.brushOpen);
  playerActor.root.visible = state.mode === 'walk';
  syncPilotVisuals();
}

function toggleDriveWalk() {
  if (state.mode === 'walk') {
    if (inBlackNonRoadZone(state.px, state.pz)) {
      showSpeech('NONGEOGRAPHIC ZONE', 'The Black lies outside the street network; return to a city street to board the Cruiser.');
      return;
    }
    state.mode = 'drive';
    if (Math.hypot(state.px - state.cx, state.pz - state.cz) > 22) {
      const nr = nearestRoad(state.px, state.pz, 160);
      state.cx = nr ? nr.x : state.px + 3;
      state.cz = nr ? nr.z : state.pz + 3;
      state.chd = nr ? nr.hd : state.phd;
    }
  } else {
    state.mode = 'walk';
    state.px = state.cx + Math.cos(state.chd) * 2.6;
    state.pz = state.cz + Math.sin(state.chd) * 2.6;
    state.py = Math.max(hAt(state.px, state.pz), 0.35);
  }
  state.reverseAngle = false;
  syncModeButtons();
}

// UI Button Wiring
$('btn-collapse-left').addEventListener('click', () => {
  const b = $('left-body');
  const hidden = b.style.display === 'none';
  b.style.display = hidden ? '' : 'none';
  $('btn-collapse-left').textContent = hidden ? 'Compact' : 'Expand';
});

document.querySelectorAll('#region-pills .pill').forEach((btn) => {
  btn.addEventListener('click', () => jumpToPreset(btn.dataset.jump));
});

$('prov-select').addEventListener('change', (e) => {
  savePilotState({ provenanceFilter: e.target.value });
  updateProvenanceBadge(e.target.value === 'all' ? 'checked' : e.target.value);
});

$('btn-mode-walk').addEventListener('click', () => {
  if (state.mode !== 'walk') toggleDriveWalk();
});
$('btn-mode-drive').addEventListener('click', () => {
  if (state.mode !== 'drive') toggleDriveWalk();
});
$('btn-mode-brush').addEventListener('click', () => {
  state.brushOpen = !state.brushOpen;
  brushCursor.visible = state.brushOpen;
  syncModeButtons();
});

$('btn-toggle-door').addEventListener('click', toggleSevernDoor);
$('btn-handoff').addEventListener('click', cycleParcelHandoff);
$('btn-reverse-angle').addEventListener('click', () => {
  // Jump cleanly to Severn threshold if far away so reverse cut is always meaningful
  if (Math.hypot(state.px - severnState.thresholdX, state.pz - severnState.thresholdZ) > 35) {
    jumpToPreset('severn');
  }
  state.reverseAngle = !state.reverseAngle;
  $('btn-reverse-angle').classList.toggle('active', state.reverseAngle);
  showSpeech(
    state.reverseAngle ? 'REVERSE THRESHOLD ANGLE' : 'FORWARD STREET ANGLE',
    state.reverseAngle
      ? 'Interior-to-street reverse shot active: verify identical door state, Bekele identity, and parcel ownership.'
      : 'Forward street-to-threshold camera restored.'
  );
});

// Brush Controls
document.querySelectorAll('#brush-kind-pills .pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.brushKind = btn.dataset.bkind;
    document.querySelectorAll('#brush-kind-pills .pill').forEach((b) => b.classList.toggle('active', b === btn));
  });
});
$('sl-bradius').addEventListener('input', (e) => { $('val-bradius').textContent = `${e.target.value}m`; });
$('sl-bdensity').addEventListener('input', (e) => { $('val-bdensity').textContent = e.target.value; });
$('sl-bscale').addEventListener('input', (e) => { $('val-bscale').textContent = `${Number(e.target.value).toFixed(2)}x`; });
$('btn-brush-clear').addEventListener('click', () => {
  customBrushItems = [];
  saveCustomBrushItems();
  rebuildInstancedBotanyAndStreetKit();
});
$('btn-brush-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(customBrushItems, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'island-custom-grove.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

// Raycasting for Orbit Drag & Tree/Street Brush
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let dragState = null;

function applyBrushAtWorldPoint(wx, wz) {
  const radius = Number($('sl-bradius').value);
  const density = Number($('sl-bdensity').value);
  const scaleMul = Number($('sl-bscale').value);
  const spSel = $('brush-species').value;

  if (state.brushKind === 'erase') {
    customBrushItems = customBrushItems.filter((it) => Math.hypot(it.x - wx, it.z - wz) > radius);
    saveCustomBrushItems();
    rebuildInstancedBotanyAndStreetKit();
    return;
  }
  if (state.brushKind === 'lamp') {
    const y = hAt(wx, wz);
    if (y > 0.35 && !hitsBuilding(wx, wz) && !inBlackNonRoadZone(wx, wz)) {
      customBrushItems.push({ kind: 'lamp', x: wx, y, z: wz, rot: Math.random() * 6.28 });
      saveCustomBrushItems();
      rebuildInstancedBotanyAndStreetKit();
    }
    return;
  }
  if (state.brushKind === 'relay') {
    const y = hAt(wx, wz);
    if (y > 0.35 && !hitsBuilding(wx, wz)) {
      customBrushItems.push({ kind: 'relay', x: wx, y, z: wz });
      saveCustomBrushItems();
      rebuildInstancedBotanyAndStreetKit();
    }
    return;
  }

  let planted = 0;
  const count = state.brushKind === 'planter' ? 1 : density;
  for (let i = 0; i < count * 3 && planted < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = count === 1 ? 0 : Math.sqrt(Math.random()) * radius;
    const tx = wx + Math.cos(ang) * r;
    const tz = wz + Math.sin(ang) * r;
    const check = canPlantTreeAt(tx, tz);
    if (!check) continue;
    const sp = spSel === 'mixed' ? chooseRegionalSpecies(tx, tz, customBrushItems.length + i) : Number(spSel);
    customBrushItems.push({
      kind: 'tree',
      x: Math.round(tx * 10) / 10,
      y: check.y,
      z: Math.round(tz * 10) / 10,
      h: Math.round((8.5 + Math.random() * 5.5) * scaleMul * 10) / 10,
      sp,
      planter: state.brushKind === 'planter' ? true : check.needsPlanter,
      rot: Math.round(Math.random() * 628) / 100,
    });
    planted++;
  }
  if (planted > 0) {
    saveCustomBrushItems();
    rebuildInstancedBotanyAndStreetKit();
  }
}

const worldWhisperEl = $('world-whisper');
const worldSpeechEl = $('world-speech');
let hoveredDiegetic = null;

function pickDiegeticAtClient(clientX, clientY) {
  pointerNDC.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointerNDC, camera);

  // Avoid hitting worldRig's own tripod/portal meshes twice
  if (worldRig && worldRig.hitMeshes && worldRig.hitMeshes.length > 0) {
    const rigHits = raycaster.intersectObjects(worldRig.hitMeshes, false);
    if (rigHits.length > 0 && rigHits[0].distance < 58) {
      return { kind: 'world-rig', hit: rigHits[0] };
    }
  }

  const hits = raycaster.intersectObjects(diegeticPickables, false);
  for (let i = 0; i < hits.length; i++) {
    const info = hits[i].object.userData.diegetic;
    if (!info) continue;
    // Hide Severn horizon beacon hit when already standing right at Severn (< 85m)
    if (info.kind === 'beacon' && info.beacon.key === 'severn') {
      if (Math.hypot(state.px - severnState.cx, state.pz - severnState.cz) < 85) continue;
    }
    return { ...info, hit: hits[i] };
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  dragState = { x: e.clientX, y: e.clientY, moved: 0 };
});

window.addEventListener('pointermove', (e) => {
  if (state.brushOpen) {
    pointerNDC.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointerNDC, camera);
    const planeY = state.mode === 'walk' ? state.py : state.cy;
    const t = (planeY - raycaster.ray.origin.y) / (raycaster.ray.direction.y || -0.001);
    if (t > 0 && t < 800) {
      const hx = raycaster.ray.origin.x + raycaster.ray.direction.x * t;
      const hz = raycaster.ray.origin.z + raycaster.ray.direction.z * t;
      const r = Number($('sl-bradius').value);
      brushCursor.position.set(hx, Math.max(hAt(hx, hz), 0.1) + 0.22, hz);
      brushCursor.scale.setScalar(r);
      brushCursor.visible = true;
    }
  }
  if (!dragState) {
    if (e.target === canvas) {
      const picked = pickDiegeticAtClient(e.clientX, e.clientY);
      hoveredDiegetic = picked && picked.kind !== 'world-rig' ? picked : null;
      if (!picked || picked.kind !== 'world-rig') {
        canvas.style.cursor = hoveredDiegetic ? 'pointer' : state.mode === 'drive' ? 'crosshair' : 'grab';
      }
    } else {
      hoveredDiegetic = null;
    }
    return;
  }
  const dx = e.clientX - dragState.x;
  const dy = e.clientY - dragState.y;
  dragState.moved += Math.abs(dx) + Math.abs(dy);
  if (dragState.moved > 4) hoveredDiegetic = null;
  state.camYaw -= dx * 0.0052;
  state.camPitch = Math.max(-0.25, Math.min(0.85, state.camPitch + dy * 0.0042));
  dragState.x = e.clientX;
  dragState.y = e.clientY;
});

window.addEventListener('pointerup', (e) => {
  const wasCleanClick = dragState && dragState.moved < 7 && e.button === 0 && e.target === canvas;
  dragState = null;
  if (!wasCleanClick) return;

  if (state.brushOpen && brushCursor.visible) {
    applyBrushAtWorldPoint(brushCursor.position.x, brushCursor.position.z);
    return;
  }

  const picked = pickDiegeticAtClient(e.clientX, e.clientY);
  if (picked) {
    if (picked.kind === 'world-rig') {
      // Handled directly by createWorldPortalAndTripod
      return;
    }
    if (picked.kind === 'cruiser') {
      toggleDriveWalk();
      setWorldSpeech(
        new THREE.Vector3(state.cx, state.cy + 2.4, state.cz),
        'EXPEDITION CRUISER',
        state.mode === 'drive'
          ? 'Driving Cruiser (WASD). Click outside on the curb or press F to step out.'
          : 'Stepped out onto the street curb.',
        3000
      );
      return;
    }
    if (picked.kind === 'service-cruiser') {
      state.cx = picked.van.position.x;
      state.cz = picked.van.position.z;
      state.cy = picked.van.position.y;
      state.chd = -picked.van.rotation.y;
      state.mode = 'drive';
      syncModeButtons();
      setWorldSpeech(
        new THREE.Vector3(state.cx, state.cy + 2.4, state.cz),
        picked.dest.name.toUpperCase(),
        'Boarded regional Cruiser (WASD). Click outside on the curb or press F to step out.',
        3000
      );
      return;
    }
    if (picked.kind === 'severn-door') {
      toggleSevernDoor(true);
      return;
    }
    if (picked.kind === 'resident') {
      handoffWithResident(picked.resident);
      return;
    }
    if (picked.kind === 'water-relay') {
      const nextL = Math.min(20, (pilot.waterLiters || 5) + 5);
      savePilotState({ waterLiters: nextL, coolingWet: true });
      pilot = { ...pilot, waterLiters: nextL, coolingWet: true };
      if (shaderSuite?.audio) shaderSuite.audio.playPour?.();
      showSpeech(
        'SEVERN NOLLI CISTERN',
        `Standpipe replenished: ${nextL.toFixed(1)}L electric-cyan reserve active.`,
        picked.getAnchor()
      );
      return;
    }
    if (picked.kind === 'depot-relay') {
      const nextL = Math.min(20, (pilot.waterLiters || 5) + 2.5);
      savePilotState({ poem: picked.poemNum, waterLiters: nextL, coolingWet: true });
      pilot = { ...pilot, poem: picked.poemNum, waterLiters: nextL, coolingWet: true };
      if (shaderSuite?.audio) shaderSuite.audio.playPour?.();
      showSpeech(
        `POEM ${picked.poemNum} · ${picked.title.toUpperCase()}`,
        `${picked.place} — +2.5L cyan reserve synced (${nextL.toFixed(1)}L).`,
        picked.getAnchor()
      );
      return;
    }
    if (picked.kind === 'black-door') {
      savePilotState({ poem: '14', district: 'the-black' });
      glideToPreset('severn', false);
      showSpeech(
        'NONGEOGRAPHIC THRESHOLD',
        'Account cut from The Black back to Poem 01 (The Severn) outside street network.'
      );
      return;
    }
    if (picked.kind === 'tree-pit') {
      cycleTreePitSpecies(picked.pit);
      return;
    }
    if (picked.kind === 'beacon') {
      glideToPreset(picked.beacon.key, false);
      return;
    }
  }

  // Clicking outside on street / sidewalk / soil:
  // 1) In Drive mode -> step back out onto the curb!
  // 2) In Walk mode on valid soil/curb patch with Shift+click -> plant a new curb tree-pit!
  pointerNDC.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointerNDC, camera);
  const planeY = state.mode === 'walk' ? state.py : state.cy;
  const tGround = (planeY - raycaster.ray.origin.y) / (raycaster.ray.direction.y || -0.001);
  if (state.mode === 'drive') {
    toggleDriveWalk();
    setWorldSpeech(
      new THREE.Vector3(state.px, state.py + 2.05, state.pz),
      'CURB DISEMBARK',
      'Stepped out onto the street curb beside the Cruiser.',
      2400
    );
    return;
  }
  if (tGround > 0 && tGround < 120 && e.shiftKey) {
    const gx = raycaster.ray.origin.x + raycaster.ray.direction.x * tGround;
    const gz = raycaster.ray.origin.z + raycaster.ray.direction.z * tGround;
    const check = canPlantTreeAt(gx, gz);
    if (check) {
      const sp = chooseRegionalSpecies(gx, gz, interactiveTreePits.length);
      const newPit = createInteractiveCurbPit({
        id: `user-pit-${Date.now()}`,
        x: gx,
        z: gz,
        initialSpecies: sp,
        heightM: 9.2,
        isSoilPatch: !check.needsPlanter,
      });
      newPit.growScale = 0.16;
      setWorldSpeech(
        new THREE.Vector3(gx, check.y + 3.8, gz),
        'NEW CURB TREE-PIT',
        `Planted ${SPECIES_NAMES[sp]} — click pit anytime to cycle all 5 species.`,
        2800
      );
    }
  }
});

// Fullscreen Click-to-Travel Map + Radar
const radarCanvas = $('radar-canvas');
const radarCtx = radarCanvas.getContext('2d');
const bigMapCanvas = $('big-map-canvas');
const bigMapCtx = bigMapCanvas.getContext('2d');
let mapModalOpen = false;

function drawIslandCartography(ctx, cw, ch, isFull) {
  ctx.fillStyle = '#071528';
  ctx.fillRect(0, 0, cw, ch);

  // Landmass silhouette from height grid
  const step = isFull ? 2 : 4;
  for (let j = 0; j < H_NY; j += step) {
    for (let i = 0; i < H_NX; i += step) {
      const h = H_DATA[j * H_NX + i] / 10;
      if (h < 0) continue;
      const sx = ((i * H_CELL) / W) * cw;
      const sy = ((j * H_CELL) / H) * ch;
      const pw = Math.ceil((H_CELL * step / W) * cw) + 1;
      const ph = Math.ceil((H_CELL * step / H) * ch) + 1;
      ctx.fillStyle = h > 45 ? '#2b3d34' : h > 6 ? '#1c2f3b' : '#3a4648';
      ctx.fillRect(sx, sy, pw, ph);
    }
  }

  // Highways & Bridges
  ctx.strokeStyle = 'rgba(203, 177, 130, 0.72)';
  ctx.lineWidth = isFull ? 2.0 : 1.1;
  for (const hw of roads.highways) {
    ctx.beginPath();
    hw.pts.forEach(([x, z], idx) => {
      const sx = (x / W) * cw;
      const sy = (z / H) * ch;
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();
  }

  // Core street grid
  if (isFull) {
    ctx.strokeStyle = 'rgba(160, 185, 215, 0.28)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < roads.streets.length; i += 2) {
      const s = roads.streets[i];
      if (inBlackNonRoadZone(s.pts[0][0], s.pts[0][1])) continue;
      ctx.beginPath();
      s.pts.forEach(([x, z], idx) => {
        const sx = (x / W) * cw;
        const sy = (z / H) * ch;
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
    }
  }

  // Poem Sets & Cyan Relays
  for (const s of SETS) {
    const sx = (s.x / W) * cw;
    const sy = (s.y / H) * ch;
    if (s.num === '14') {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#c98cff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, isFull ? 10 : 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = s.num === '01' ? '#f2a541' : '#18b4ff';
      ctx.beginPath();
      ctx.arc(sx, sy, s.num === '01' ? (isFull ? 5.5 : 3.5) : (isFull ? 3.5 : 2.2), 0, Math.PI * 2);
      ctx.fill();
    }
    if (isFull) {
      ctx.fillStyle = '#f1eee6';
      ctx.font = '600 10px Inter, system-ui, sans-serif';
      ctx.fillText(`${s.num} ${s.title}`, sx + 7, sy + 3);
    }
  }

  // Player / Cruiser marker
  const ax = state.mode === 'walk' ? state.px : state.cx;
  const az = state.mode === 'walk' ? state.pz : state.cz;
  const mx = (ax / W) * cw;
  const my = (az / H) * ch;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mx, my, isFull ? 5.5 : 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#18b4ff';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function toggleMapModal(force) {
  mapModalOpen = force != null ? force : !mapModalOpen;
  $('map-modal').classList.toggle('open', mapModalOpen);
  if (mapModalOpen) drawIslandCartography(bigMapCtx, bigMapCanvas.width, bigMapCanvas.height, true);
}

radarCanvas.addEventListener('click', () => toggleMapModal(true));
$('btn-open-map').addEventListener('click', () => toggleMapModal(true));
$('btn-close-map').addEventListener('click', () => toggleMapModal(false));

bigMapCanvas.addEventListener('click', (e) => {
  const r = bigMapCanvas.getBoundingClientRect();
  const wx = ((e.clientX - r.left) / r.width) * W;
  const wz = ((e.clientY - r.top) / r.height) * H;
  const wy = hAt(wx, wz);
  if (wy < -0.5) {
    showSpeech('HARBOR WATER', 'Choose land, street, or a regional Nolli depot to teleport.');
    return;
  }
  state.px = wx;
  state.pz = wz;
  state.py = Math.max(wy, 0.35);
  if (!inBlackNonRoadZone(wx, wz)) {
    const nr = nearestRoad(wx, wz, 220);
    state.cx = nr ? nr.x : wx + 6;
    state.cz = nr ? nr.z : wz + 6;
    state.cy = Math.max(hAt(state.cx, state.cz), 0.35);
  }
  toggleMapModal(false);
});

let activeContextNode = null;
$('btn-context-act').addEventListener('click', () => {
  if (activeContextNode && activeContextNode.onAct) activeContextNode.onAct();
});

window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'f') toggleDriveWalk();
  else if (k === 'o') toggleSevernDoor();
  else if (k === 'e') {
    if (activeContextNode && activeContextNode.onAct) activeContextNode.onAct();
    else cycleParcelHandoff();
  } else if (k === 'r') $('btn-reverse-angle').click();
  else if (k === 'b') $('btn-mode-brush').click();
  else if (k === 'm') toggleMapModal();
  else if (k === 'escape' && mapModalOpen) toggleMapModal(false);
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

function updateSimulation(dt, elapsed) {
  skyUniforms.uTime.value = elapsed;
  waterUniforms.uTime.value = elapsed;
  skyDome.position.copy(camera.position);

  const targetDoorAng = pilot.doorOpen ? -Math.PI * 0.58 : 0;
  severnState.doorAngle += (targetDoorAng - severnState.doorAngle) * Math.min(1, dt * 8.5);
  if (severnState.doorPivot) {
    severnState.doorPivot.rotation.y = severnState.rotY + severnState.doorAngle;
  }

  // Smooth organic growth spring on Curb Tree-Pits & Sky-High Beacon shimmer
  for (let i = 0; i < interactiveTreePits.length; i++) {
    const pit = interactiveTreePits[i];
    if (pit.growScale < 0.999) {
      pit.growScale += (1.0 - pit.growScale) * Math.min(1, dt * 8.5);
      pit.treeHolder.scale.setScalar(pit.growScale);
    }
  }
  for (let i = 0; i < districtBeacons.length; i++) {
    const bc = districtBeacons[i];
    bc.beamMat.uniforms.uTime.value = elapsed;
    bc.skyStar.rotation.y = elapsed * 0.9 + i;
    if (bc.key === 'severn') {
      const dSev = Math.hypot(state.px - severnState.cx, state.pz - severnState.cz);
      const vis = THREE.MathUtils.clamp((dSev - 65) / 70, 0, 1);
      bc.group.visible = vis > 0.02;
      bc.beamMat.uniforms.uOpacity.value = 0.72 * vis;
    }
  }

  let moving = false;
  let glideArcLift = 0;

  if (state.glideAnim) {
    const ga = state.glideAnim;
    ga.elapsed += dt;
    const u = Math.min(1, ga.elapsed / ga.dur);
    const k = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) * 0.5;
    state.px = THREE.MathUtils.lerp(ga.x0, ga.x1, k);
    state.pz = THREE.MathUtils.lerp(ga.z0, ga.z1, k);
    const brY = onBridgeDeck(state.px, state.pz);
    state.py = Math.max(brY != null ? brY : hAt(state.px, state.pz), 0.32);

    state.cx = THREE.MathUtils.lerp(ga.cx0, ga.cx1, k);
    state.cz = THREE.MathUtils.lerp(ga.cz0, ga.cz1, k);
    const brCY = onBridgeDeck(state.cx, state.cz);
    state.cy = Math.max(brCY != null ? brCY : hAt(state.cx, state.cz), 0.32);

    let dYaw = ga.yaw1 - ga.yaw0;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    state.camYaw = ga.yaw0 + dYaw * k;
    state.phd = state.camYaw;
    state.chd = state.camYaw;
    glideArcLift = Math.sin(u * Math.PI) * (ga.arcH || 0);
    moving = true;
    if (u >= 1) {
      state.glideAnim = null;
    }
    playerActor.root.position.set(state.px, state.py, state.pz);
    playerActor.root.rotation.y = -state.phd + Math.PI;
    if (playerActor.v8 && typeof playerActor.v8.update === 'function') {
      playerActor.v8.setGroundY(state.py);
      playerActor.v8.update(dt);
    }
  } else if (state.mode === 'walk') {
    const fwd = (keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 1 : 0);
    const str = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
    const len = Math.hypot(fwd, str);
    if (len > 0.05) {
      moving = true;
      state.reverseAngle = false;
      const spd = (keys['shift'] ? 7.6 : 3.6) * dt;
      const fx = Math.sin(state.camYaw);
      const fz = -Math.cos(state.camYaw);
      const mx = ((fx * fwd - fz * str) / len) * spd;
      const mz = ((fz * fwd + fx * str) / len) * spd;
      state.phd = Math.atan2(mx, -mz);

      const nx = state.px + mx;
      const nz = state.pz + mz;
      const brY = onBridgeDeck(nx, nz);
      const gy = brY != null ? brY : hAt(nx, nz);

      if (gy > -0.45 && !hitsBuilding(nx, nz) && !hitsWallCollider(nx, nz, state.py, 0.42)) {
        state.px = nx;
        state.pz = nz;
        state.py = Math.max(gy, 0.25);
      }
    }

    playerActor.root.position.set(state.px, state.py, state.pz);
    playerActor.root.rotation.y = -state.phd + Math.PI;
    if (playerActor.v8) {
      playerActor.v8.setGroundY(state.py);
      const want = moving ? 'walk' : 'idle';
      if (playerActor.clip !== want && typeof playerActor.v8.playClip === 'function') {
        playerActor.clip = want;
        playerActor.v8.playClip(want, 0.2);
      }
      if (typeof playerActor.v8.update === 'function') playerActor.v8.update(dt);
    } else {
      playerActor.phase += dt * (moving ? 9 : 2);
      playerActor.legL.rotation.x = moving ? Math.sin(playerActor.phase) * 0.45 : 0;
      playerActor.legR.rotation.x = moving ? -Math.sin(playerActor.phase) * 0.45 : 0;
    }
  } else {
    const gas = keys['w'] || keys['arrowup'];
    const brake = keys['s'] || keys['arrowdown'];
    const steer = (keys['a'] || keys['arrowleft'] ? -1 : 0) + (keys['d'] || keys['arrowright'] ? 1 : 0);
    const maxV = keys['shift'] ? 44 : 28;

    if (gas) state.cv += (state.cv < 0 ? 28 : 15) * dt;
    if (brake) state.cv -= (state.cv > 0 ? 30 : 10) * dt;
    state.cv *= Math.pow(0.84, dt);
    state.cv = Math.max(-12, Math.min(maxV, state.cv));

    if (Math.abs(state.cv) > 0.3) {
      moving = true;
      state.reverseAngle = false;
      state.chd += steer * dt * 1.65 * Math.sign(state.cv);
      const fx = Math.sin(state.chd);
      const fz = -Math.cos(state.chd);
      const nx = state.cx + fx * state.cv * dt;
      const nz = state.cz + fz * state.cv * dt;
      const brY = onBridgeDeck(nx, nz);
      const gy = brY != null ? brY : hAt(nx, nz);
      if (gy > -0.3 && !inBlackNonRoadZone(nx, nz) && !hitsBuilding(nx, nz) && !hitsWallCollider(nx, nz, state.cy, 1.1)) {
        state.cx = nx;
        state.cz = nz;
        state.cy = Math.max(gy, 0.3);
      } else {
        state.cv *= -0.3;
      }
    }
    state.px = state.cx;
    state.pz = state.cz;
    state.py = state.cy;
  }

  cruiser.position.set(state.cx, state.cy, state.cz);
  cruiser.rotation.y = -state.chd;
  for (const w of cruiser.userData.wheels) {
    w.rotation.x -= state.cv * dt * 1.8;
  }

  for (const r of residents) {
    if (r.actor.v8 && typeof r.actor.v8.update === 'function') {
      r.actor.v8.setGroundY(r.actor.root.position.y);
      r.actor.v8.update(dt);
    }
  }

  if (state.reverseAngle) {
    camera.position.set(
      severnState.bekelePos.x + (severnState.cx - severnState.thresholdX) * 0.25,
      severnState.y0 + 1.68,
      severnState.bekelePos.z + (severnState.cz - severnState.thresholdZ) * 0.25
    );
    camera.lookAt(severnState.curbX, severnState.y0 + 1.35, severnState.curbZ);
  } else if (state.mode === 'walk') {
    const dist = 9.2;
    const tx = state.px;
    const ty = state.py + 1.65 + glideArcLift * 0.35;
    const tz = state.pz;
    camera.position.set(
      tx - Math.sin(state.camYaw) * Math.cos(state.camPitch) * dist,
      Math.max(hAt(tx, tz) + 0.65, ty + Math.sin(state.camPitch) * dist + glideArcLift),
      tz + Math.cos(state.camYaw) * Math.cos(state.camPitch) * dist
    );
    camera.lookAt(tx, ty, tz);
  } else {
    const dist = 11.5;
    const yaw = state.chd;
    const tx = state.cx;
    const ty = state.cy + 1.6 + glideArcLift * 0.35;
    const tz = state.cz;
    camera.position.set(
      tx - Math.sin(yaw) * dist,
      ty + 3.6 + glideArcLift,
      tz + Math.cos(yaw) * dist
    );
    camera.lookAt(tx + Math.sin(yaw) * 4, ty, tz - Math.cos(yaw) * 4);
  }

  sunLight.position.set(
    camera.position.x + skyUniforms.uSunDir.value.x * 320,
    camera.position.y + 220,
    camera.position.z + skyUniforms.uSunDir.value.z * 320
  );
  sunLight.target.position.set(state.px, state.py, state.pz);

  const ax = state.mode === 'walk' ? state.px : state.cx;
  const az = state.mode === 'walk' ? state.pz : state.cz;
  let bestNode = null;
  let bestD = Infinity;
  for (const n of interactiveNodes) {
    const d = Math.hypot(n.x - ax, n.z - az);
    if (d < n.radius && d < bestD) {
      bestD = d;
      bestNode = n;
    }
  }
  activeContextNode = bestNode;
  const promptEl = $('context-prompt');
  if (bestNode) {
    $('context-text').textContent = bestNode.label;
    promptEl.classList.add('visible');
  } else {
    promptEl.classList.remove('visible');
  }

  // Project unboxed 1-line hover whisper & resident speech in 3D world space (never overlapping)
  const speechActive = Boolean(worldSpeechState && performance.now() < worldSpeechState.until);
  if (!speechActive && hoveredDiegetic && typeof hoveredDiegetic.getAnchor === 'function') {
    const prj = projectWorldLabel(camera, hoveredDiegetic.getAnchor(), canvas);
    if (prj.visible) {
      worldWhisperEl.textContent = hoveredDiegetic.getWhisper();
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
    worldRig.update({ x: ax, y: state.py, z: az });
  }

  const insideSealedRoom = isInsideSevernVestibule(ax, az) && !pilot.doorOpen;
  if (shaderSuite) {
    shaderSuite.updateAudio(dt, {
      isInside: insideSealedRoom,
      nightMix: 0.65,
      submerged: false,
      moving,
      projectorDist: bestD,
      projectorWet: !!pilot.coolingWet,
    });
  }

  // Telemetry & Radar update (only redraw 2D radar if Tab drawer is open)
  if (document.body.classList.contains('mp-tab-open')) {
    const nr = nearestRoad(ax, az, 90);
    const curbInfo = inBlackNonRoadZone(ax, az)
      ? 'Outside Street Network'
      : nr
        ? `On Curb / Street (${nr.d.toFixed(0)}m)`
        : 'Off-Street Terrain';
    $('hud-telemetry').textContent = `${state.mode === 'walk' ? 'Walk Mode' : `Cruiser ${Math.abs(Math.round(state.cv * 2.2))} mph`} · ${curbInfo} · +${state.py.toFixed(1)}m`;

    radarTimer += dt;
    if (radarTimer > 0.25) {
      radarTimer = 0;
      drawIslandCartography(radarCtx, radarCanvas.width, radarCanvas.height, false);
    }
  }
}

// ---------------------------------------------------------------------------
// 14. Mount Universal 23-Look GPU Shader Suite + Curb Brass Camera Tripod
// ---------------------------------------------------------------------------
shaderSuite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: pilot.shader || 'weave',
  locationName: 'Island Multi-Region City',
  cartridgeName: 'Atlantis',
  onTimeChange: (timeKey) => {
    const mapH = { dawn: 6.2, midday: 12.5, golden: 17.6, bluehour: 18.6, night: 22.5 };
    const h = typeof timeKey === 'number' ? timeKey : (mapH[timeKey] ?? 18.6);
    applyHourToSky(h);
  },
});

{
  const [tripX, tripZ] = severnState.toW(5.6, 3.1);
  const tripY = Math.max(hAt(tripX, tripZ), severnState.y0) + 0.06;
  const [portMapsX, portMapsZ] = severnState.toW(14.0, 9.6);
  const [portNolliX, portNolliZ] = severnState.toW(14.0, -9.8);
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
      rotY: severnState.rotY + Math.PI,
    },
    portals: [
      {
        id: 'maps',
        label: 'Living Cartography & MovieMap',
        href: '../maps/',
        pos: [portMapsX, Math.max(hAt(portMapsX, portMapsZ), severnState.y0), portMapsZ],
        rotY: severnState.rotY + Math.PI * 0.5,
        color: '#18b4ff',
      },
      {
        id: 'nolli',
        label: 'Nolli Block & Camera Shop',
        href: '../',
        pos: [portNolliX, Math.max(hAt(portNolliX, portNolliZ), severnState.y0), portNolliZ],
        rotY: severnState.rotY - Math.PI * 0.5,
        color: '#e0b46a',
      },
    ],
  });
  // Seed initial observer immediately so zero proximity whisper shows before user moves
  worldRig.update({ x: state.px, y: state.py, z: state.pz });
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ---------------------------------------------------------------------------
// 15. Main Simulation & Render Loop (120 FPS Clean)
// ---------------------------------------------------------------------------
syncPilotVisuals();
syncModeButtons();
updateProvenanceBadge('checked');

const clock = new THREE.Clock();
let radarTimer = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  updateSimulation(dt, elapsed);
  shaderSuite.render(scene, camera);
});
