import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mountWebGLShaderSuite } from '../shader-suite-bar.js';

// Zero-dependency damped spherical Orbit + Pan + Dolly controller
class StageOrbitControls {
  constructor(cam, dom) {
    this.camera = cam;
    this.domElement = dom;
    this.target = new THREE.Vector3(0, 1.55, -10.0);
    this.minDistance = 0.6;
    this.maxDistance = 58.0;
    this.dampingFactor = 0.12;
    this._sph = new THREE.Spherical();
    this._sphTarget = new THREE.Spherical();
    this._panOffset = new THREE.Vector3();
    this._syncFromCamera();

    let mode = 0;
    let lastX = 0;
    let lastY = 0;

    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => {
      mode = e.button === 2 || e.shiftKey ? 2 : 1;
      lastX = e.clientX;
      lastY = e.clientY;
      this._syncFromCamera();
      try { dom.setPointerCapture(e.pointerId); } catch {}
    });
    dom.addEventListener('pointermove', (e) => {
      if (!mode) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (mode === 1) {
        this._sphTarget.theta -= dx * 0.0045;
        this._sphTarget.phi = THREE.MathUtils.clamp(this._sphTarget.phi - dy * 0.0045, 0.12, Math.PI - 0.12);
      } else {
        const panScale = this._sphTarget.radius * 0.0014;
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
        this._panOffset.addScaledVector(right, -dx * panScale);
        this._panOffset.addScaledVector(up, dy * panScale);
      }
    });
    const endDrag = () => { mode = 0; };
    dom.addEventListener('pointerup', endDrag);
    dom.addEventListener('pointercancel', endDrag);
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._syncFromCamera();
      const factor = e.deltaY > 0 ? 1.09 : 0.91;
      this._sphTarget.radius = THREE.MathUtils.clamp(this._sphTarget.radius * factor, this.minDistance, this.maxDistance);
    }, { passive: false });
  }

  _syncFromCamera() {
    const off = this.camera.position.clone().sub(this.target);
    this._sph.setFromVector3(off);
    this._sphTarget.copy(this._sph);
  }

  syncImmediate() {
    this._panOffset.set(0, 0, 0);
    this._syncFromCamera();
    this.camera.lookAt(this.target);
  }

  update() {
    if (this._panOffset.lengthSq() > 1e-8) {
      this.target.addScaledVector(this._panOffset, this.dampingFactor);
      this._panOffset.multiplyScalar(1 - this.dampingFactor);
    }
    const off = this.camera.position.clone().sub(this.target);
    this._sph.setFromVector3(off);
    this._sph.theta += (this._sphTarget.theta - this._sph.theta) * this.dampingFactor;
    this._sph.phi += (this._sphTarget.phi - this._sph.phi) * this.dampingFactor;
    this._sph.radius += (this._sphTarget.radius - this._sph.radius) * this.dampingFactor;
    this._sph.makeSafe();
    off.setFromSpherical(this._sph);
    this.camera.position.copy(this.target).add(off);
    this.camera.lookAt(this.target);
  }
}
import {
  loadPilotState,
  savePilotState,
  subscribePilotState,
  applyPilotUrlHash,
} from '../design-room/pilot-state.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let pilot = applyPilotUrlHash();

// ---------------------------------------------------------------------------
// Toast Helper
// ---------------------------------------------------------------------------
let toastTimer = 0;
function showToast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}

// ---------------------------------------------------------------------------
// WebGL Renderer, Scene, Camera & 23-Shader Suite
// ---------------------------------------------------------------------------
const wrap = $('#viewport-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#091628');
scene.fog = new THREE.FogExp2('#0d1d33', 0.0075);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.15, 220);
const controls = new StageOrbitControls(camera, renderer.domElement);

// Sky Dome (WEAVE Cobalt-Cerulean vs Raw Neutral Daylight)
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uTop: { value: new THREE.Color('#091930') },
    uMid: { value: new THREE.Color('#214f7d') },
    uHorizon: { value: new THREE.Color('#5c809c') },
  },
  vertexShader: `
    varying vec3 vWorld;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform vec3 uTop, uMid, uHorizon;
    varying vec3 vWorld;
    void main() {
      float h = clamp(normalize(vWorld).y, 0.0, 1.0);
      vec3 c = h < 0.28 ? mix(uHorizon, uMid, h / 0.28) : mix(uMid, uTop, (h - 0.28) / 0.72);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(165, 24, 16), skyMat));

// Scene Lights
const hemiLight = new THREE.HemisphereLight('#c4dcf2', '#3a342c', 1.35);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight('#ffd7a8', 2.25);
dirLight.position.set(18, 28, 16);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 75;
dirLight.shadow.camera.left = -22;
dirLight.shadow.camera.right = 22;
dirLight.shadow.camera.top = 22;
dirLight.shadow.camera.bottom = -22;
scene.add(dirLight);

const probeCyanLight = new THREE.PointLight('#18b4ff', 9.5, 16, 1.5);
probeCyanLight.position.set(-1.4, 2.2, -6.5);
scene.add(probeCyanLight);

// Mount Universal 23-Look Shader Suite Bar
const suite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: pilot.shader || 'weave',
  locationName: 'Metric Depth 3D Stage',
  cartridgeName: 'pointcloud',
  onTimeChange: (timeKey) => {
    const mapHr = { dawn: 6.5, midday: 12.5, bluehour: 18.5, night: 22.0 };
    if (mapHr[timeKey] !== undefined) savePilotState({ worldTime: mapHr[timeKey], rawDaylight: false });
  },
});

// ---------------------------------------------------------------------------
// Walkable Nolli Ground, Severn Hybrid Threshold & 1.70m Anny V8 Scale Humans
// ---------------------------------------------------------------------------
const dioramaGroup = new THREE.Group();
scene.add(dioramaGroup);

function buildStoneFloorTex() {
  const sz = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = sz;
  const x = cv.getContext('2d');
  x.fillStyle = '#252b33';
  x.fillRect(0, 0, sz, sz);
  for (let i = 0; i < 4000; i++) {
    const v = 30 + ((i * 29) % 24);
    x.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    x.fillRect((i * 83) % sz, (i * 47) % sz, 2, 2);
  }
  x.strokeStyle = 'rgba(24, 180, 255, 0.11)';
  x.lineWidth = 1;
  for (let g = 0; g < sz; g += 64) {
    x.beginPath(); x.moveTo(g, 0); x.lineTo(g, sz); x.stroke();
    x.beginPath(); x.moveTo(0, g); x.lineTo(sz, g); x.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const nolliFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(64, 64),
  new THREE.MeshStandardMaterial({
    color: '#2d3540',
    map: buildStoneFloorTex(),
    roughness: 0.72,
    metalness: 0.14,
  })
);
nolliFloor.rotation.x = -Math.PI / 2;
nolliFloor.position.set(0, 0, -14);
nolliFloor.receiveShadow = true;
dioramaGroup.add(nolliFloor);

// Wet Cyan Reflection Puddle on Nolli Stage
const stagePuddle = new THREE.Mesh(
  new THREE.CircleGeometry(1.5, 28),
  new THREE.MeshStandardMaterial({
    color: '#123a50',
    emissive: '#18b4ff',
    emissiveIntensity: 0.85,
    roughness: 0.10,
    metalness: 0.38,
    transparent: true,
    opacity: 0.68,
  })
);
stagePuddle.rotation.x = -Math.PI / 2;
stagePuddle.position.set(-1.1, 0.012, -6.2);
dioramaGroup.add(stagePuddle);

// Hybrid 3D Severn Threshold Set (Solid Doorway, Steps, Handrail & Parcel Table where bodies cross)
const severnSet = new THREE.Group();
severnSet.position.set(1.55, 0, -7.4);
dioramaGroup.add(severnSet);

const stoneMat = new THREE.MeshStandardMaterial({ color: '#78695a', roughness: 0.86 });
const brickMat = new THREE.MeshStandardMaterial({ color: '#7c3e33', roughness: 0.82 });
const tealMat = new THREE.MeshStandardMaterial({ color: '#275963', roughness: 0.54, metalness: 0.16 });
const brassMat = new THREE.MeshStandardMaterial({ color: '#caa974', roughness: 0.32, metalness: 0.72 });
const doorWoodMat = new THREE.MeshStandardMaterial({ color: '#3b2820', roughness: 0.58 });

const stepA = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.3), stoneMat);
stepA.position.set(0, 0.08, 0.4);
stepA.receiveShadow = true;
const stepB = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.16, 0.84), stoneMat);
stepB.position.set(0, 0.24, 0.15);
stepB.receiveShadow = true;
const portalL = new THREE.Mesh(new THREE.BoxGeometry(0.44, 2.7, 0.4), brickMat);
portalL.position.set(-0.85, 1.35, -0.1);
const portalR = new THREE.Mesh(new THREE.BoxGeometry(0.44, 2.7, 0.4), brickMat);
portalR.position.set(0.85, 1.35, -0.1);
const portalTop = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.36, 0.46), tealMat);
portalTop.position.set(0, 2.82, -0.1);
severnSet.add(stepA, stepB, portalL, portalR, portalTop);

const doorPivot = new THREE.Group();
doorPivot.position.set(-0.62, 0.32, -0.1);
const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.22, 2.28, 0.08), doorWoodMat);
doorMesh.position.set(0.61, 1.14, 0);
doorPivot.add(doorMesh);
severnSet.add(doorPivot);

const thresholdWarmLight = new THREE.PointLight('#ffb969', 16.0, 9.0, 1.5);
thresholdWarmLight.position.set(0, 2.3, -0.5);
severnSet.add(thresholdWarmLight);

// Handrail
const hr1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8), brassMat);
hr1.position.set(-0.98, 0.6, 0.82);
const hr2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8), brassMat);
hr2.position.set(-0.98, 0.76, 0.12);
const hrTop = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.84, 8), brassMat);
hrTop.position.set(-0.98, 1.0, 0.47);
hrTop.rotation.x = Math.atan2(0.16, 0.7) + Math.PI / 2;
severnSet.add(hr1, hr2, hrTop);

// Shared Parcel Prop
const parcelProp = new THREE.Mesh(
  new THREE.BoxGeometry(0.28, 0.19, 0.22),
  new THREE.MeshStandardMaterial({ color: '#c79a62', roughness: 0.7 })
);
dioramaGroup.add(parcelProp);

// Bundled CAD Architecture Blocks Group (Naraka / Haze / Commons)
const cadBlocksGroup = new THREE.Group();
scene.add(cadBlocksGroup);

// 1.70m Skinned Anny V8 Scale Humans (Walkable Explorer + Bekele at Doorway)
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const humanActor = {
  root: new THREE.Group(),
  v8: null,
  pos: new THREE.Vector3(-0.35, 0, -6.4),
  yaw: 0.35,
  walking: false,
};
humanActor.root.position.copy(humanActor.pos);

// 1.70m Calibrated Scale Rod beside Human in Diorama / Neutral Pass
const scaleRodGroup = new THREE.Group();
const rodBar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.7, 8), brassMat);
rodBar.position.set(-0.48, 0.85, 0);
const rodCap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.04), brassMat);
rodCap.position.set(-0.48, 1.7, 0);
scaleRodGroup.add(rodBar, rodCap);
humanActor.root.add(scaleRodGroup);

const humanShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.36, 20),
  new THREE.MeshBasicMaterial({ color: '#05070b', transparent: true, opacity: 0.54, depthWrite: false })
);
humanShadow.rotation.x = -Math.PI / 2;
humanShadow.position.y = 0.015;
humanActor.root.add(humanShadow);

const humanProxy = new THREE.Group();
const pBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.19, 0.24, 0.88, 12),
  new THREE.MeshStandardMaterial({ color: '#2b6394', roughness: 0.74 })
);
pBody.position.y = 1.05;
const pHead = new THREE.Mesh(
  new THREE.SphereGeometry(0.145, 14, 12),
  new THREE.MeshStandardMaterial({ color: '#8c5a3c', roughness: 0.62 })
);
pHead.position.y = 1.62;
const pLegs = new THREE.Mesh(
  new THREE.CylinderGeometry(0.14, 0.12, 0.62, 10),
  new THREE.MeshStandardMaterial({ color: '#1b2028', roughness: 0.85 })
);
pLegs.position.y = 0.31;
humanProxy.add(pBody, pHead, pLegs);
humanActor.root.add(humanProxy);
scene.add(humanActor.root);

if (window.AnnyHumanV7 && window.AnnyHumanV7.createCharacter) {
  window.AnnyHumanV7.createCharacter({
    THREE,
    loader: gltfLoader,
    archetype: 'adult_f',
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
      humanActor.root.add(inst.root);
      humanProxy.visible = false;
      humanActor.v8 = inst;
      inst.setGroundY(0);
    })
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// Metric Depth Extraction, Bilateral Edge Refinement & 3 Superior Reconstructions
// ---------------------------------------------------------------------------
const GRID_W = 384;
const GRID_H = 216;
const offPhoto = document.createElement('canvas');
offPhoto.width = GRID_W;
offPhoto.height = GRID_H;
const offCel = document.createElement('canvas');
offCel.width = GRID_W;
offCel.height = GRID_H;
const offDepth = document.createElement('canvas');
offDepth.width = GRID_W;
offDepth.height = GRID_H;

const reconState = {
  mode: 'splats', // 'splats' | 'mesh' | 'diorama'
  splatRadius: 1.7,
  tearGuard: 0.09,
  edgeRefine: 0.55,
  depthScale: 1.0,
  useCelTex: false,
  showCadBlocks: true,
  lockFocusHuman: true,
  turntable: false,
  provMask: false,
  provFilter: pilot.provenanceFilter || 'all',
};

const sourceCam = {
  pos: new THREE.Vector3(0, 1.65, 0),
  target: new THREE.Vector3(0, 1.55, -10.0),
  vFovDeg: 46,
  aspect: 16 / 9,
  heightM: 1.65,
  pitchRad: -0.026,
  maxConeDeg: 18.0,
};

// Supported Viewing Cone Wireframe Pyramid
const coneLinesGroup = new THREE.Group();
const coneLinesGeo = new THREE.BufferGeometry();
coneLinesGroup.add(
  new THREE.LineSegments(
    coneLinesGeo,
    new THREE.LineBasicMaterial({ color: '#f2a541', transparent: true, opacity: 0.45 })
  )
);
scene.add(coneLinesGroup);

// Reconstruction Scene Objects
const reconRoot = new THREE.Group();
scene.add(reconRoot);

let splatsMesh = null;
let microMesh = null;
let shadowSkirtBackplate = null;
let cachedGrid = null; // { photoRgba, celRgba, dispRaw, shot }

// 1. GAUSSIAN SOFT SPLATS SHADER (Anisotropic Edge-Aware Soft Discs — Zero Black Gaps!)
const splatUniforms = {
  uRadiusScale: { value: 1.7 },
  uViewportH: { value: window.innerHeight * renderer.getPixelRatio() },
  uVFoVRad: { value: THREE.MathUtils.degToRad(46) },
  uUseCel: { value: 0.0 },
  uProvMask: { value: 0.0 },
  uProvFilter: { value: 0 },
};

const splatMaterial = new THREE.ShaderMaterial({
  uniforms: splatUniforms,
  transparent: true,
  depthWrite: true,
  vertexShader: `
    attribute vec3 aColor;
    attribute vec3 aCelColor;
    attribute vec3 aGrad; // x=dz/dx, y=dz/dy, z=edgeJump(0..1)
    uniform float uRadiusScale;
    uniform float uViewportH;
    uniform float uVFoVRad;
    uniform float uUseCel;
    varying vec3 vCol;
    varying vec3 vGrad;
    varying float vMetricZ;

    void main() {
      vCol = mix(aColor, aCelColor, uUseCel);
      vGrad = aGrad;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float dist = max(0.35, -mv.z);
      vMetricZ = dist;

      // Exact screen-space pixel spacing of a 216-row grid + overlap factor so continuous surfaces have ZERO black gaps!
      float gridStepWorld = (2.0 * dist * tan(uVFoVRad * 0.5)) / 216.0;
      float pxFootprint = (gridStepWorld / dist) * (uViewportH / (2.0 * tan(uVFoVRad * 0.5)));

      // Tighten splat radius across depth discontinuities so silhouettes never bleed halos!
      float silhouetteTighten = mix(1.85, 0.82, smoothstep(0.04, 0.22, aGrad.z));
      // Expand slightly when surface tilts away slightly, clamped cleanly
      float slopeBoost = clamp(1.0 + length(aGrad.xy) * 0.32, 1.0, 1.55);

      gl_PointSize = clamp(pxFootprint * uRadiusScale * silhouetteTighten * slopeBoost, 1.5, 64.0);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform float uProvMask;
    uniform int uProvFilter;
    varying vec3 vCol;
    varying vec3 vGrad;
    varying float vMetricZ;

    void main() {
      vec2 p = gl_PointCoord - vec2(0.5);
      // Subtle anisotropic ellipse aligned along surface tangent
      vec2 gDir = length(vGrad.xy) > 0.001 ? normalize(vGrad.xy) : vec2(1.0, 0.0);
      vec2 tDir = vec2(-gDir.y, gDir.x);
      float u = dot(p, gDir) * (1.0 + clamp(length(vGrad.xy) * 0.45, 0.0, 0.65));
      float v = dot(p, tDir);
      float r2 = u * u + v * v;
      if (r2 > 0.25) discard;

      // High-fill flat-top Gaussian kernel: opaque core prevents black pinholes, feathered rim blends smoothly
      float alpha = smoothstep(0.25, 0.06, r2);
      if (alpha < 0.08) discard;

      vec3 col = vCol;
      if (uProvMask > 0.5) {
        // Color-code: crisp low-jump surfaces = Recorded/Checked (teal), steep inferred jumps = Inferred (amber)
        vec3 pCol = mix(vec3(0.36, 0.83, 0.75), vec3(0.95, 0.65, 0.25), smoothstep(0.03, 0.16, vGrad.z));
        col = mix(col, pCol, 0.48);
      }
      if (uProvFilter == 4) col *= 0.22; // Dim when filtering for Invented 3D additions only

      // Convert sRGB vertex color to linear light so CityShaderPipeline applies single perceptual gamma
      gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(2.2)), alpha);
    }
  `,
});

// 2. DISPLACED MICRO-MESH + GRAZING TEAR GUARD MATERIAL
const microMeshUniforms = {
  uUseCel: { value: 0.0 },
  uTearGuard: { value: 0.09 },
  uLightDir: { value: new THREE.Vector3(0.45, 0.72, 0.52).normalize() },
  uNeutralPass: { value: 0.0 },
  uProvMask: { value: 0.0 },
};

const microMeshMaterial = new THREE.ShaderMaterial({
  uniforms: microMeshUniforms,
  side: THREE.DoubleSide,
  transparent: true,
  depthWrite: true,
  vertexShader: `
    attribute vec3 aColor;
    attribute vec3 aCelColor;
    attribute float aEdgeJump;
    uniform float uUseCel;
    varying vec3 vCol;
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    varying float vEdgeJump;

    void main() {
      vCol = mix(aColor, aCelColor, uUseCel);
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vViewDir = normalize(cameraPosition - wp.xyz);
      vEdgeJump = aEdgeJump;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform float uTearGuard;
    uniform vec3 uLightDir;
    uniform float uNeutralPass;
    uniform float uProvMask;
    varying vec3 vCol;
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    varying float vEdgeJump;

    void main() {
      // Grazing-angle Tear Guard: fade any residual steep depth-discontinuity triangles viewed at grazing angles
      float ndotv = abs(dot(normalize(vNormalW), normalize(vViewDir)));
      float tearFade = 1.0 - smoothstep(uTearGuard * 0.65, uTearGuard * 1.35, vEdgeJump * (1.35 - ndotv));
      if (tearFade < 0.12) discard;

      float diff = 0.68 + 0.42 * max(0.0, dot(normalize(vNormalW), uLightDir));
      vec3 col = uNeutralPass > 0.5 ? vec3(0.76, 0.78, 0.82) * diff : vCol * mix(1.0, diff, 0.34);

      if (uProvMask > 0.5) {
        vec3 pCol = mix(vec3(0.36, 0.83, 0.75), vec3(0.95, 0.65, 0.25), smoothstep(0.02, 0.12, vEdgeJump));
        col = mix(col, pCol, 0.48);
      }

      gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(2.2)), tearFade);
    }
  `,
});

function loadImg(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Failed ' + url));
    im.src = url;
  });
}

function refineDisparityField(dispRaw, photoRgba, w, h, edgeStrength) {
  // Joint bilateral / edge-guided 5x5 refinement + luminance micro-relief
  const out = new Float32Array(w * h);
  const sigmaColor = Math.max(0.04, 0.22 - edgeStrength * 0.15);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const pOff = idx * 4;
      const r0 = photoRgba[pOff] / 255;
      const g0 = photoRgba[pOff + 1] / 255;
      const b0 = photoRgba[pOff + 2] / 255;
      const lum0 = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;

      let sumW = 0;
      let sumD = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const ny = Math.min(h - 1, Math.max(0, y + dy));
        for (let dx = -2; dx <= 2; dx++) {
          const nx = Math.min(w - 1, Math.max(0, x + dx));
          const nIdx = ny * w + nx;
          const nOff = nIdx * 4;
          const dr = r0 - photoRgba[nOff] / 255;
          const dg = g0 - photoRgba[nOff + 1] / 255;
          const db = b0 - photoRgba[nOff + 2] / 255;
          const cDist2 = dr * dr + dg * dg + db * db;
          const spW = 1.0 / (1.0 + dx * dx + dy * dy);
          const colW = Math.exp(-cDist2 / (2 * sigmaColor * sigmaColor));
          const wgt = spW * colW;
          sumW += wgt;
          sumD += dispRaw[nIdx] * wgt;
        }
      }
      // Subtle high-frequency architectural stone relief guided by luminance
      const micro = (lum0 - 0.5) * 0.012 * edgeStrength;
      out[idx] = Math.max(0.01, Math.min(0.995, sumD / Math.max(1e-5, sumW) + micro));
    }
  }
  return out;
}

function renderRefinedDepthPip(disp, w, h) {
  const cv = $('#pip-depth-cv');
  if (!cv) return;
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  const d = imgData.data;
  for (let i = 0; i < w * h; i++) {
    const v = disp[i];
    // Clean cobalt -> cyan -> warm amber metric depth visualization
    d[i * 4 + 0] = Math.round(20 + 225 * Math.pow(v, 1.35));
    d[i * 4 + 1] = Math.round(45 + 165 * Math.sin(v * Math.PI * 0.85));
    d[i * 4 + 2] = Math.round(85 + 150 * (1 - v * 0.55));
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}

function rebuildGeometryFromCache() {
  if (!cachedGrid) return;
  const { photoRgba, celRgba, dispRaw, shot } = cachedGrid;
  const w = GRID_W;
  const h = GRID_H;

  // Dispose old geometries
  if (splatsMesh) {
    reconRoot.remove(splatsMesh);
    splatsMesh.geometry.dispose();
    splatsMesh = null;
  }
  if (microMesh) {
    reconRoot.remove(microMesh);
    microMesh.geometry.dispose();
    microMesh = null;
  }
  if (shadowSkirtBackplate) {
    reconRoot.remove(shadowSkirtBackplate);
    shadowSkirtBackplate.geometry.dispose();
    shadowSkirtBackplate.material.dispose();
    shadowSkirtBackplate = null;
  }

  const disp = refineDisparityField(dispRaw, photoRgba, w, h, reconState.edgeRefine);
  renderRefinedDepthPip(disp, w, h);

  const [imgW, imgH] = shot.size || [1456, 816];
  const aspect = imgW / Math.max(1, imgH);
  const focalPx = shot.camera?.focal_px || 1200;
  const vFovRad = 2 * Math.atan((imgH * 0.5) / focalPx);
  const tanHalfV = Math.tan(vFovRad * 0.5);
  const tanHalfH = tanHalfV * aspect;

  const camH = Math.max(1.2, Math.min(3.2, shot.camera?.height_m ?? 1.65));
  const pitchRad = THREE.MathUtils.degToRad(Math.max(-10, Math.min(10, shot.camera?.pitch_deg ?? -1.5)));

  sourceCam.vFovDeg = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vFovRad), 30, 68);
  sourceCam.aspect = aspect;
  sourceCam.heightM = camH;
  sourceCam.pitchRad = pitchRad;
  sourceCam.pos.set(0, camH, 0);
  sourceCam.target.set(0, camH + Math.sin(pitchRad) * 10.0, -Math.cos(pitchRad) * 10.0);

  // Place reconRoot at sourceCam.pos oriented along source optical axis so unprojected rays align 1:1 with y=0 ground!
  reconRoot.position.copy(sourceCam.pos);
  reconRoot.rotation.set(pitchRad, 0, 0);

  splatUniforms.uVFoVRad.value = THREE.MathUtils.degToRad(sourceCam.vFovDeg);

  // Convert normalized linear disparity (0=far 42m, 1=near 2.4m) into metric Z in meters
  const nearM = 2.4;
  const farM = 40.0;
  const invNear = 1.0 / nearM;
  const invFar = 1.0 / farM;
  const relief = reconState.depthScale;
  const midM = 9.5;

  const nVerts = w * h;
  const positions = new Float32Array(nVerts * 3);
  const colors = new Float32Array(nVerts * 3);
  const celColors = new Float32Array(nVerts * 3);
  const grads = new Float32Array(nVerts * 3);
  const edgeJumps = new Float32Array(nVerts);
  const metricZArr = new Float32Array(nVerts);

  const isDiorama = reconState.mode === 'diorama';

  for (let y = 0; y < h; y++) {
    const vNorm = (y + 0.5) / h; // 0 top .. 1 bottom
    const rayY = (0.5 - vNorm) * 2.0 * tanHalfV;
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const uNorm = (x + 0.5) / w; // 0 left .. 1 right
      const rayX = (uNorm - 0.5) * 2.0 * tanHalfH;

      const dVal = disp[idx];
      const rawZ = 1.0 / (invFar + dVal * (invNear - invFar));
      let zM = midM + (rawZ - midM) * relief;
      zM = Math.max(1.8, Math.min(52.0, zM));

      // In Inverse Interior Diorama mode, clamp lower ground rays onto walkable Nolli floor (y_world >= 0)
      let px = rayX * zM;
      let py = rayY * zM;
      let pz = -zM;

      if (isDiorama && camH + py < 0.02) {
        const floorScale = (camH - 0.02) / Math.max(0.05, -py);
        px *= floorScale;
        py *= floorScale;
        pz *= floorScale;
        zM *= floorScale;
      }

      metricZArr[idx] = zM;
      positions[idx * 3 + 0] = px;
      positions[idx * 3 + 1] = py;
      positions[idx * 3 + 2] = pz;

      const cOff = idx * 4;
      colors[idx * 3 + 0] = photoRgba[cOff] / 255;
      colors[idx * 3 + 1] = photoRgba[cOff + 1] / 255;
      colors[idx * 3 + 2] = photoRgba[cOff + 2] / 255;

      celColors[idx * 3 + 0] = celRgba[cOff] / 255;
      celColors[idx * 3 + 1] = celRgba[cOff + 1] / 255;
      celColors[idx * 3 + 2] = celRgba[cOff + 2] / 255;
    }
  }

  // Compute local depth gradients & relative silhouette discontinuity per vertex
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const zC = metricZArr[idx];
      const zL = metricZArr[y * w + Math.max(0, x - 1)];
      const zR = metricZArr[y * w + Math.min(w - 1, x + 1)];
      const zU = metricZArr[Math.max(0, y - 1) * w + x];
      const zD = metricZArr[Math.min(h - 1, y + 1) * w + x];

      const dzdx = (zR - zL) / Math.max(0.5, zC);
      const dzdy = (zD - zU) / Math.max(0.5, zC);
      const maxJump = Math.max(Math.abs(zR - zC), Math.abs(zL - zC), Math.abs(zD - zC), Math.abs(zU - zC)) / Math.max(0.5, zC);

      grads[idx * 3 + 0] = dzdx;
      grads[idx * 3 + 1] = dzdy;
      grads[idx * 3 + 2] = maxJump;
      edgeJumps[idx] = maxJump;
    }
  }

  // Build Mode 1: Gaussian Soft Splats Geometry
  const splatGeo = new THREE.BufferGeometry();
  splatGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  splatGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  splatGeo.setAttribute('aCelColor', new THREE.BufferAttribute(celColors, 3));
  splatGeo.setAttribute('aGrad', new THREE.BufferAttribute(grads, 3));
  splatsMesh = new THREE.Points(splatGeo, splatMaterial);
  reconRoot.add(splatsMesh);

  // Build Mode 2 & 3: Watertight Displaced Micro-Mesh with Silhouette Tear-Guard Index Severing
  const maxTris = (w - 1) * (h - 1) * 2;
  const indices = new Uint32Array(maxTris * 3);
  let ptr = 0;
  const tearLimit = reconState.tearGuard;

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i00 = y * w + x;
      const i10 = i00 + 1;
      const i01 = i00 + w;
      const i11 = i01 + 1;

      const z00 = metricZArr[i00];
      const z10 = metricZArr[i10];
      const z01 = metricZArr[i01];
      const z11 = metricZArr[i11];

      // Triangle A (i00, i01, i10)
      const minA = Math.min(z00, z01, z10);
      const maxA = Math.max(z00, z01, z10);
      if ((maxA - minA) / minA <= tearLimit) {
        indices[ptr++] = i00;
        indices[ptr++] = i01;
        indices[ptr++] = i10;
      }

      // Triangle B (i10, i01, i11)
      const minB = Math.min(z10, z01, z11);
      const maxB = Math.max(z10, z01, z11);
      if ((maxB - minB) / minB <= tearLimit) {
        indices[ptr++] = i10;
        indices[ptr++] = i01;
        indices[ptr++] = i11;
      }
    }
  }

  const meshGeo = new THREE.BufferGeometry();
  meshGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  meshGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  meshGeo.setAttribute('aCelColor', new THREE.BufferAttribute(celColors, 3));
  meshGeo.setAttribute('aEdgeJump', new THREE.BufferAttribute(edgeJumps, 1));
  meshGeo.setIndex(new THREE.BufferAttribute(indices.subarray(0, ptr), 1));
  meshGeo.computeVertexNormals();

  microMesh = new THREE.Mesh(meshGeo, microMeshMaterial);
  reconRoot.add(microMesh);

  // Subtle dark architectural backplate at z = -42m so severed tear-guard edges frame clean shadow depth instead of holes
  const bpTex = new THREE.CanvasTexture(offPhoto);
  bpTex.colorSpace = THREE.SRGBColorSpace;
  const bpDist = 42.5;
  const bpH = 2 * bpDist * tanHalfV;
  const bpW = bpH * aspect;
  shadowSkirtBackplate = new THREE.Mesh(
    new THREE.PlaneGeometry(bpW, bpH),
    new THREE.MeshBasicMaterial({ map: bpTex, color: '#424a58' })
  );
  shadowSkirtBackplate.position.set(0, 0, -bpDist);
  reconRoot.add(shadowSkirtBackplate);

  // Rebuild Supported Viewing Cone Wireframe
  const rCone = 9.0;
  const halfAng = THREE.MathUtils.degToRad(sourceCam.maxConeDeg);
  const dx = Math.tan(halfAng) * rCone;
  const dy = dx / aspect;
  const p0 = sourceCam.pos;
  const cMid = p0.clone().add(new THREE.Vector3(0, 0, -rCone));
  const corners = [
    cMid.clone().add(new THREE.Vector3(-dx, dy, 0)),
    cMid.clone().add(new THREE.Vector3(dx, dy, 0)),
    cMid.clone().add(new THREE.Vector3(dx, -dy, 0)),
    cMid.clone().add(new THREE.Vector3(-dx, -dy, 0)),
  ];
  const segs = [];
  for (let i = 0; i < 4; i++) {
    segs.push(p0.x, p0.y, p0.z, corners[i].x, corners[i].y, corners[i].z);
    const nxt = corners[(i + 1) % 4];
    segs.push(corners[i].x, corners[i].y, corners[i].z, nxt.x, nxt.y, nxt.z);
  }
  coneLinesGeo.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));

  applyReconModeVisibility(ptr / 3);
}

function applyReconModeVisibility(triCount = 148000) {
  const m = reconState.mode;
  if (splatsMesh) splatsMesh.visible = m === 'splats';
  if (microMesh) microMesh.visible = m === 'mesh' || m === 'diorama';
  if (shadowSkirtBackplate) shadowSkirtBackplate.visible = m === 'mesh' || m === 'diorama';

  dioramaGroup.visible = m === 'diorama';
  humanActor.root.visible = true; // Keep 1.70m scale human visible across modes, highlighted in Diorama!
  scaleRodGroup.visible = m === 'diorama' || Boolean(pilot.rawDaylight);
  cadBlocksGroup.visible = reconState.showCadBlocks && m === 'diorama';

  const modeNames = {
    splats: 'GAUSSIAN SOFT SPLATS (ANISOTROPIC)',
    mesh: 'MICRO-MESH + GRAZING TEAR GUARD',
    diorama: 'INVERSE INTERIOR DIORAMA + 1.7M V8',
  };
  $('#tel-mode').textContent = modeNames[m];
  const countStr = m === 'splats' ? `${(GRID_W * GRID_H).toLocaleString()} SPLATS` : `${Math.round(triCount).toLocaleString()} TRIS`;
  $('#tel-elems').textContent = countStr;
  $('#lbl-prim-count').textContent = countStr;
}

// ---------------------------------------------------------------------------
// Load Bundled Architecture CAD Blocks for Naraka / Haze / Commons
// ---------------------------------------------------------------------------
let catalogData = { shots: [], architectures: {} };
let activeShot = null;

function buildCadBlocksForDistrict(district) {
  while (cadBlocksGroup.children.length > 0) {
    const ch = cadBlocksGroup.children[0];
    cadBlocksGroup.remove(ch);
  }
  const arch = catalogData.architectures?.[district];
  if (!arch?.blocks) return;

  arch.blocks.slice(0, 42).forEach((b) => {
    if (b.geom !== 'box' || !Array.isArray(b.size)) return;
    const geo = new THREE.BoxGeometry(...b.size);
    const edgeGeo = new THREE.EdgesGeometry(geo, 22);
    const line = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({ color: '#18b4ff', transparent: true, opacity: 0.35 })
    );
    line.position.set(...(b.position || [0, 0, 0]));
    line.rotation.set(...(b.rotation || [0, 0, 0]));
    cadBlocksGroup.add(line);
  });
}

async function selectShot(shot) {
  activeShot = shot;
  $$('.shot-item').forEach((el) => el.classList.toggle('on', el.dataset.sid === shot.id));

  $('#insp-district').textContent = `${shot.district.toUpperCase()} · METRIC DEPTH`;
  $('#pip-photo').src = shot.urls.image;
  $('#cmp-orig').src = shot.urls.image;
  $('#cmp-cel').src = shot.urls.cel;
  $('#kv-height').textContent = `${(shot.camera?.height_m ?? 1.65).toFixed(2)} m`;
  $('#kv-fov').textContent = `${(shot.camera?.pitch_deg ?? -1.5).toFixed(1)} deg / ${(shot.camera?.fov_h_deg ?? 54).toFixed(0)} deg`;
  $('#kv-conf').textContent = `${Math.round((shot.camera?.physics_confidence || 0.86) * 100)}%`;
  $('#shot-prompt').textContent = shot.prompt.slice(0, 180) + (shot.prompt.length > 180 ? '...' : '');

  const focal35 = Math.round(shot.camera?.focal_35mm_equiv || 35);
  $('#sl-focal-mm').value = String(THREE.MathUtils.clamp(focal35, 24, 85));
  $('#val-focal-mm').textContent = `${focal35}mm`;

  buildCadBlocksForDistrict(shot.district);

  try {
    const [imPhoto, imCel, imDepth] = await Promise.all([
      loadImg(shot.urls.image),
      loadImg(shot.urls.cel),
      loadImg(shot.urls.depth),
    ]);

    const xP = offPhoto.getContext('2d');
    xP.drawImage(imPhoto, 0, 0, GRID_W, GRID_H);
    const photoRgba = xP.getImageData(0, 0, GRID_W, GRID_H).data;

    const xC = offCel.getContext('2d');
    xC.drawImage(imCel, 0, 0, GRID_W, GRID_H);
    const celRgba = xC.getImageData(0, 0, GRID_W, GRID_H).data;

    const xD = offDepth.getContext('2d');
    xD.drawImage(imDepth, 0, 0, GRID_W, GRID_H);
    const depthRgba = xD.getImageData(0, 0, GRID_W, GRID_H).data;

    // Extract monotonic perceptual luminance disparity from Matplotlib Inferno depth.jpg (0=far, 1=near)
    const dispRaw = new Float32Array(GRID_W * GRID_H);
    for (let i = 0; i < GRID_W * GRID_H; i++) {
      const r = depthRgba[i * 4];
      const g = depthRgba[i * 4 + 1];
      const b = depthRgba[i * 4 + 2];
      dispRaw[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
    }

    cachedGrid = { photoRgba, celRgba, dispRaw, shot };
    rebuildGeometryFromCache();
    recoverSourceCamera();
  } catch (err) {
    console.warn('Shot load error:', err);
  }
}

// ---------------------------------------------------------------------------
// Camera Presets & Viewing Cone Guard (Brief 7)
// ---------------------------------------------------------------------------
function recoverSourceCamera() {
  reconState.turntable = false;
  $('#btn-turntable').classList.remove('on');
  camera.fov = sourceCam.vFovDeg;
  camera.updateProjectionMatrix();
  camera.position.copy(sourceCam.pos);
  controls.target.copy(sourceCam.target);
  controls.syncImmediate();
}

function stepToHumanEye() {
  camera.fov = 50;
  camera.updateProjectionMatrix();
  camera.position.set(humanActor.pos.x - 0.3, 1.70, humanActor.pos.z + 2.8);
  controls.target.set(humanActor.pos.x + 0.4, 1.45, humanActor.pos.z - 3.0);
  controls.syncImmediate();
  showToast('1.70m Human Eye Height on walkable Nolli stone stage');
}

function testLateralParallax() {
  camera.fov = sourceCam.vFovDeg;
  camera.updateProjectionMatrix();
  camera.position.set(sourceCam.pos.x - 1.85, sourceCam.pos.y + 0.15, sourceCam.pos.z + 0.65);
  controls.target.copy(sourceCam.target);
  controls.syncImmediate();
  showToast('Lateral move: foreground overlap exposed cleanly with Tear Guard');
}

// ---------------------------------------------------------------------------
// Shared Severn Pilot Synchronization
// ---------------------------------------------------------------------------
function syncToPilotState(next) {
  pilot = next;
  const open = Boolean(next.doorOpen);
  doorPivot.rotation.y = open ? -1.25 : 0.0;
  thresholdWarmLight.intensity = next.rawDaylight ? 2.0 : open ? 18.0 : 1.0;
  $('#btn-pilot-door').textContent = open ? 'Door: Open' : 'Door: Closed';
  $('#btn-pilot-door').classList.toggle('on', open);

  const holder = next.parcelHolder || 'player';
  $('#btn-pilot-parcel').textContent = `Parcel: ${holder.charAt(0).toUpperCase() + holder.slice(1)}`;
  $('#btn-pilot-parcel').classList.toggle('on', holder === 'bekele');
  if (holder === 'player') {
    parcelProp.position.set(humanActor.pos.x + 0.24, 1.02, humanActor.pos.z + 0.16);
  } else {
    parcelProp.position.set(1.55 + 0.45, 0.45, -7.4 + 0.25);
  }

  const raw = Boolean(next.rawDaylight);
  $('#btn-neutral-pass').classList.toggle('on', raw);
  microMeshUniforms.uNeutralPass.value = raw ? 1.0 : 0.0;
  scaleRodGroup.visible = reconState.mode === 'diorama' || raw;
  if (raw) {
    skyMat.uniforms.uTop.value.set('#9ab4cc');
    skyMat.uniforms.uMid.value.set('#bfd1e0');
    skyMat.uniforms.uHorizon.value.set('#dde4ea');
    hemiLight.intensity = 2.1;
    dirLight.intensity = 2.8;
    scene.fog.density = 0.001;
  } else {
    skyMat.uniforms.uTop.value.set('#091930');
    skyMat.uniforms.uMid.value.set('#214f7d');
    skyMat.uniforms.uHorizon.value.set('#5c809c');
    hemiLight.intensity = 1.35;
    dirLight.intensity = 2.25;
    scene.fog.density = 0.0075;
  }

  const pfMap = { all: 0, recorded: 1, checked: 2, inferred: 3, invented: 4 };
  splatUniforms.uProvFilter.value = pfMap[next.provenanceFilter || 'all'] || 0;
  $$('#prov-filter-row .btn').forEach((b) => b.classList.toggle('on', b.dataset.pfilt === (next.provenanceFilter || 'all')));
}

subscribePilotState(syncToPilotState);

// ---------------------------------------------------------------------------
// UI Event Bindings & WASD 1.7m Human Movement
// ---------------------------------------------------------------------------
$$('#recon-mode-btns .btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('#recon-mode-btns .btn').forEach((b) => b.classList.toggle('on', b === btn));
    reconState.mode = btn.dataset.rmode;
    rebuildGeometryFromCache();
    if (reconState.mode === 'diorama') {
      camera.position.set(-1.35, 2.05, -1.8);
      controls.target.set(0.35, 1.35, -7.2);
      controls.syncImmediate();
    }
  });
});

$('#btn-recover-cam').addEventListener('click', () => {
  recoverSourceCamera();
  showToast('Exact calibrated source camera restored');
});
$('#btn-human-eye').addEventListener('click', stepToHumanEye);
$('#btn-lateral-test').addEventListener('click', testLateralParallax);

$('#btn-neutral-pass').addEventListener('click', () => {
  savePilotState({ rawDaylight: !pilot.rawDaylight });
});

$('#btn-prov-mask').addEventListener('click', () => {
  reconState.provMask = !reconState.provMask;
  $('#btn-prov-mask').classList.toggle('on', reconState.provMask);
  splatUniforms.uProvMask.value = reconState.provMask ? 1.0 : 0.0;
  microMeshUniforms.uProvMask.value = reconState.provMask ? 1.0 : 0.0;
});

function refresh3UpSpatial() {
  try {
    $('#cmp-3d').src = renderer.domElement.toDataURL('image/jpeg', 0.88);
  } catch {}
}

$('#btn-compare-3up').addEventListener('click', () => {
  const el = $('#compare-3up');
  const open = !el.classList.contains('open');
  if (open) {
    recoverSourceCamera();
    renderTick(performance.now() * 0.001);
    refresh3UpSpatial();
  }
  el.classList.toggle('open', open);
  $('#btn-compare-3up').classList.toggle('on', open);
});
$('#btn-refresh-3up').addEventListener('click', refresh3UpSpatial);
$('#btn-close-3up').addEventListener('click', () => {
  $('#compare-3up').classList.remove('open');
  $('#btn-compare-3up').classList.remove('on');
});

$('#sl-splat-size').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  reconState.splatRadius = v;
  splatUniforms.uRadiusScale.value = v;
  $('#val-splat-size').textContent = v.toFixed(1) + 'x';
});

$('#sl-tear-guard').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  reconState.tearGuard = v;
  microMeshUniforms.uTearGuard.value = v;
  $('#val-tear-guard').textContent = v.toFixed(2);
  rebuildGeometryFromCache();
});

$('#sl-edge-refine').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  reconState.edgeRefine = v;
  $('#val-edge-refine').textContent = Math.round(v * 100) + '%';
  rebuildGeometryFromCache();
});

$('#sl-depth-scale').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  reconState.depthScale = v;
  $('#val-depth-scale').textContent = v.toFixed(2) + 'x';
  rebuildGeometryFromCache();
});

$('#btn-tex-source').addEventListener('click', () => {
  reconState.useCelTex = !reconState.useCelTex;
  $('#btn-tex-source').textContent = reconState.useCelTex ? 'Source: WEAVE Cel' : 'Source: Photo RGB';
  $('#btn-tex-source').classList.toggle('on', reconState.useCelTex);
  splatUniforms.uUseCel.value = reconState.useCelTex ? 1.0 : 0.0;
  microMeshUniforms.uUseCel.value = reconState.useCelTex ? 1.0 : 0.0;
});

$('#btn-cad-overlay').addEventListener('click', () => {
  reconState.showCadBlocks = !reconState.showCadBlocks;
  $('#btn-cad-overlay').textContent = reconState.showCadBlocks ? 'CAD Blocks: On' : 'CAD Blocks: Off';
  $('#btn-cad-overlay').classList.toggle('on', reconState.showCadBlocks);
  applyReconModeVisibility();
});

$('#sl-focal-mm').addEventListener('input', (e) => {
  const mm = parseInt(e.target.value, 10);
  $('#val-focal-mm').textContent = mm + 'mm';
  const vFov = THREE.MathUtils.radToDeg(2 * Math.atan(12.0 / mm));
  camera.fov = THREE.MathUtils.clamp(vFov, 18, 75);
  camera.updateProjectionMatrix();
});

$('#sl-focus-m').addEventListener('input', (e) => {
  const m = parseFloat(e.target.value);
  reconState.lockFocusHuman = false;
  $('#btn-lock-human-focus').classList.remove('on');
  $('#val-focus-m').textContent = m.toFixed(1) + 'm';
  suite.setFocus(m);
});

$('#btn-lock-human-focus').addEventListener('click', () => {
  reconState.lockFocusHuman = !reconState.lockFocusHuman;
  $('#btn-lock-human-focus').classList.toggle('on', reconState.lockFocusHuman);
});

$('#btn-turntable').addEventListener('click', () => {
  reconState.turntable = !reconState.turntable;
  $('#btn-turntable').classList.toggle('on', reconState.turntable);
});

$('#btn-pilot-door').addEventListener('click', () => {
  savePilotState({ doorOpen: !pilot.doorOpen });
});

$('#btn-pilot-parcel').addEventListener('click', () => {
  const next = pilot.parcelHolder === 'player' ? 'bekele' : 'player';
  savePilotState({ parcelHolder: next });
});

$$('#prov-filter-row .btn').forEach((btn) => {
  btn.addEventListener('click', () => savePilotState({ provenanceFilter: btn.dataset.pfilt }));
});

$('#btn-collapse-catalog').addEventListener('click', () => $('#left-catalog').classList.add('collapsed'));
$('#btn-open-catalog').addEventListener('click', () => $('#left-catalog').classList.remove('collapsed'));
$('#btn-collapse-inspector').addEventListener('click', () => $('#right-inspector').classList.add('collapsed'));
$('#btn-open-inspector').addEventListener('click', () => $('#right-inspector').classList.remove('collapsed'));

// WASD Walkable 1.70m Human on Nolli Ground
const keys = {};
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input,select,textarea')) return;
  keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  splatUniforms.uViewportH.value = window.innerHeight * renderer.getPixelRatio();
});

// ---------------------------------------------------------------------------
// Catalog Filtering & Rendering
// ---------------------------------------------------------------------------
let activeDistFilter = 'ALL';

function renderCatalogList() {
  const q = ($('#shot-search').value || '').trim().toLowerCase();
  const listEl = $('#shot-list');
  const filtered = catalogData.shots.filter((s) => {
    const okD = activeDistFilter === 'ALL' || s.district === activeDistFilter;
    const okQ = !q || `${s.district} ${s.title} ${s.prompt}`.toLowerCase().includes(q);
    return okD && okQ;
  });

  listEl.innerHTML = filtered
    .map(
      (s) => `<div class="shot-item ${activeShot?.id === s.id ? 'on' : ''}" data-sid="${s.id}">
        <img src="${s.urls.image}" alt="${s.title}" loading="lazy">
        <div style="min-width:0;">
          <div class="shot-t">${s.title}</div>
          <div class="shot-m">${s.district.toUpperCase()} · ${s.camera.focal_35mm_equiv}MM</div>
        </div>
      </div>`
    )
    .join('');

  listEl.querySelectorAll('.shot-item').forEach((el) => {
    el.addEventListener('click', () => {
      const s = catalogData.shots.find((x) => x.id === el.dataset.sid);
      if (s) selectShot(s);
    });
  });
}

// ---------------------------------------------------------------------------
// Main Animation Loop
// ---------------------------------------------------------------------------
let prevSec = performance.now() * 0.001;

function renderTick(nowSec) {
  const dt = Math.min(0.05, Math.max(0.001, nowSec - prevSec));
  prevSec = nowSec;

  // WASD Human Movement on y = 0 Nolli Ground
  let mx = 0;
  let mz = 0;
  if (keys.KeyW) mz -= 1;
  if (keys.KeyS) mz += 1;
  if (keys.KeyA) mx -= 1;
  if (keys.KeyD) mx += 1;
  const moving = mx !== 0 || mz !== 0;

  if (moving) {
    const len = Math.hypot(mx, mz);
    humanActor.pos.x = THREE.MathUtils.clamp(humanActor.pos.x + (mx / len) * 2.8 * dt, -8.5, 8.5);
    humanActor.pos.z = THREE.MathUtils.clamp(humanActor.pos.z + (mz / len) * 2.8 * dt, -22.0, -2.2);
    humanActor.yaw = Math.atan2(mx, mz);
    humanActor.root.position.copy(humanActor.pos);
    humanActor.root.rotation.y = humanActor.yaw;
    if (pilot.parcelHolder === 'player') {
      parcelProp.position.set(humanActor.pos.x + 0.24, 1.02, humanActor.pos.z + 0.16);
    }
  }
  if (moving !== humanActor.walking) {
    humanActor.walking = moving;
    if (humanActor.v8) humanActor.v8.playClip(moving ? 'walk' : 'idle', 0.2);
  }
  if (humanActor.v8) humanActor.v8.update(dt);

  if (reconState.turntable) {
    const sway = Math.sin(nowSec * 0.65) * 1.45;
    camera.position.x = sourceCam.pos.x + sway;
    camera.position.y = sourceCam.pos.y + Math.cos(nowSec * 0.5) * 0.22;
  }

  controls.update();

  if (reconState.lockFocusHuman) {
    const dToHuman = camera.position.distanceTo(humanActor.pos);
    suite.setFocus(THREE.MathUtils.clamp(dToHuman, 1.5, 35.0));
    $('#val-focus-m').textContent = dToHuman.toFixed(1) + 'm';
    $('#sl-focus-m').value = String(THREE.MathUtils.clamp(dToHuman, 1.5, 35.0));
  }

  // Supported Viewing Cone Check
  const vSrc = sourceCam.pos.clone().sub(sourceCam.target).normalize();
  const vCur = camera.position.clone().sub(controls.target).normalize();
  const coneDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(vSrc.dot(vCur), -1, 1)));
  const coneEl = $('#cone-readout');
  if (coneEl) {
    if (coneDeg <= sourceCam.maxConeDeg) {
      coneEl.textContent = `WITHIN CONE (${coneDeg.toFixed(1)} DEG)`;
      coneEl.classList.remove('warn');
    } else {
      coneEl.textContent = `OUTSIDE CONE (${coneDeg.toFixed(1)} DEG) · REQUEST EVIDENCE`;
      coneEl.classList.add('warn');
    }
  }
  coneLinesGroup.visible = coneDeg > sourceCam.maxConeDeg || reconState.mode === 'diorama';

  if (pilot.rawDaylight) {
    suite.pipeline.render(scene, camera, {
      time: nowSec,
      focusM: 7.5,
      dofAmount: 0.0,
      ev: 0.0,
      mode: -1,
      paletteColors: null,
    });
  } else {
    suite.render(scene, camera);
  }
}

function animate() {
  requestAnimationFrame(animate);
  renderTick(performance.now() * 0.001);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async function boot() {
  catalogData = await fetch('./data/shots_catalog.json').then((r) => r.json());

  const districts = ['ALL', ...new Set(catalogData.shots.map((s) => s.district))];
  const chipsEl = $('#dist-chips');
  chipsEl.innerHTML = districts
    .map((d) => `<button class="btn ${d === 'ALL' ? 'on' : ''}" data-dist="${d}">${d}</button>`)
    .join('');
  chipsEl.querySelectorAll('.btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeDistFilter = btn.dataset.dist;
      chipsEl.querySelectorAll('.btn').forEach((b) => b.classList.toggle('on', b === btn));
      renderCatalogList();
    });
  });

  $('#shot-search').addEventListener('input', renderCatalogList);

  // URL mode override (?mode=splats|mesh|diorama)
  const q = new URLSearchParams(window.location.search);
  if (q.get('mode') && ['splats', 'mesh', 'diorama'].includes(q.get('mode'))) {
    reconState.mode = q.get('mode');
    $$('#recon-mode-btns .btn').forEach((b) => b.classList.toggle('on', b.dataset.rmode === reconState.mode));
  }

  syncToPilotState(pilot);
  const heroShot =
    catalogData.shots.find((s) => s.id === 'bdc7d6ec-1d4e-4f99-ad7e-9917394c542a_2') ||
    catalogData.shots[0];
  if (heroShot) {
    await selectShot(heroShot);
  }
  renderCatalogList();
  animate();
})();
