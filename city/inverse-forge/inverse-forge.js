// Inverse Foundry 5-Level Shot Optimizer & Hero Co-Evolution Stage
// 100% Pure Diegetic In-World 3D UI — Zero Overlaid Grids or Sidebars on Default Load.
// Exclusive directory: /city/inverse-forge/

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
  ALL_CITY_LOOKS,
} from '../shader-suite-bar.js';
import {
  useLibrary,
  build as buildHdlModel,
  setThresholdDoor,
  mutateSevernCandidate,
} from '../heroes/hdl-compiler.js';
import {
  createHeroOrCastV9,
  evolveHeroPhenotype,
} from '../hero-build/anny-hero-v9.js';
import {
  createArticulated31CutoutRig,
  evolveCutoutPhenotype,
} from '../hero-build/cutout-31-rig.js';

const $ = (id) => document.getElementById(id);
const wrap = $('canvas-wrap');
const whisperEl = $('world-whisper');
const flashEl = $('shutter-flash');

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('anonymous');

// Hydrate shared Severn Pilot state (make_photo_pilot_v1)
const pilotInit = applyPilotUrlHash();

// Load compiled 60-shot Inverse Foundry manifest + Severn HDL + PBR library
const [MANIFEST, FOUNDRY_RAW, SEVERN_BUNDLE, HDL_LIB] = await Promise.all([
  fetch('./data/inverse-shots-manifest.json').then((r) => r.json()),
  fetch('../foundry/data/foundry-data.json').then((r) => r.json()),
  fetch('../foundry/data/severn-hdl.json').then((r) => r.json()),
  fetch('../heroes/data/library.json').then((r) => r.json()),
]);

const SHOTS = MANIFEST.shots || [];

useLibrary(HDL_LIB, null);
texLoader.load('../heroes/data/library.webp', (atlasTex) => {
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  atlasTex.anisotropy = 8;
  useLibrary(HDL_LIB, atlasTex);
  rebuildL2Architecture();
});

const heroV9Module = { createHeroOrCastV9, evolveHeroPhenotype };
const cutout31Module = { createArticulated31CutoutRig, evolveCutoutPhenotype };
async function tryLoadHeroModules() {
  return true;
}

// ---------------------------------------------------------------------------
// Renderer, Camera & 23-Look GPU Shader Suite
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#09182c');
scene.fog = new THREE.FogExp2('#122844', 0.0024);

// Far plane = 420 m so L4 (> 180 m) sky cyclorama and palette beacons never clip
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.14, 420);
camera.rotation.order = 'YXZ';

const suite = mountWebGLShaderSuite({
  THREE,
  renderer,
  scene,
  camera,
  defaultLook: pilotInit.shader || 'weave',
  locationName: 'Inverse Foundry 5-Level Stage',
  cartridgeName: 'Inverse-60',
  captureOnSpace: false,
  autoIntercept: false,
  onTimeChange: (_timeKey, preset) => {
    applyTimePresetToLights(preset);
  },
});

// Lock optical Depth-of-Field focus onto the L1 Hero (5.8 m from camera)
const HERO_STAGE_Z = 3.8;
const CAM_LOCKED_POS = new THREE.Vector3(0, 1.58, 9.6);
suite.setFocus(CAM_LOCKED_POS.z - HERO_STAGE_Z, true);

// ---------------------------------------------------------------------------
// Multi-Pass Reference-Guided Darkroom Post-Processor (GPU)
// Pass 0: Final WEAVE Render (all 23 GPU shaders + live L0 DoF)
// Pass 1: Metric Depth Buffer (Inferno perceptual disparity + L0..L4 iso-rings)
// Pass 2: Notan / Canny Edge Mask (3-tone Notan + crisp Sobel/depth silhouette)
// Pass 3: 4-Up Control Sheet (Ref Plate + WEAVE + Metric Depth + Notan/Canny)
// ---------------------------------------------------------------------------
const PASS_NAMES = [
  'Final WEAVE Render',
  'Metric Depth Buffer',
  'Notan / Canny Edge Mask',
  '4-Up Control Sheet Export',
];

const weaveCompositeRT = new THREE.WebGLRenderTarget(
  Math.max(2, Math.floor(window.innerWidth * renderer.getPixelRatio())),
  Math.max(2, Math.floor(window.innerHeight * renderer.getPixelRatio())),
  { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.UnsignedByteType }
);

const fallbackRefCanvas = document.createElement('canvas');
fallbackRefCanvas.width = 512;
fallbackRefCanvas.height = 288;
const fallbackRefTex = new THREE.CanvasTexture(fallbackRefCanvas);
fallbackRefTex.colorSpace = THREE.SRGBColorSpace;

const darkroomMat = new THREE.ShaderMaterial({
  uniforms: {
    tWeave: { value: weaveCompositeRT.texture },
    tSceneRaw: { value: suite.pipeline.rt.texture },
    tDepth: { value: suite.pipeline.rt.depthTexture },
    tRefPlate: { value: fallbackRefTex },
    uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uNear: { value: camera.near },
    uFar: { value: camera.far },
    uHorizon: { value: 0.36 },
    uPassMode: { value: 1 },
    uPal: {
      value: [
        new THREE.Color('#1f1f25'),
        new THREE.Color('#75333e'),
        new THREE.Color('#29566e'),
        new THREE.Color('#6184ab'),
        new THREE.Color('#cf6a83'),
        new THREE.Color('#b1cbd8'),
      ],
    },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tWeave;
    uniform sampler2D tSceneRaw;
    uniform sampler2D tDepth;
    uniform sampler2D tRefPlate;
    uniform vec2 uRes;
    uniform float uNear;
    uniform float uFar;
    uniform float uHorizon;
    uniform int uPassMode;
    uniform vec3 uPal[6];
    varying vec2 vUv;

    float lum(vec3 c) {
      return clamp(dot(c, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    }

    float linearDist(vec2 uv) {
      float zb = texture2D(tDepth, clamp(uv, 0.001, 0.999)).x;
      return (uNear * uFar) / max(0.0001, uFar - zb * (uFar - uNear));
    }

    // Perceptual Inferno-like metric disparity ramp (near = warm gold/white, far = indigo/black)
    vec3 evalMetricDepth(vec2 uv) {
      float d = linearDist(uv);
      // Normalize across L0 (0.8m) -> L4 (240m) using log-metric scale
      float disp = 1.0 - clamp(log2(max(d, 0.8) / 0.8) / log2(240.0 / 0.8), 0.0, 1.0);
      vec3 c0 = vec3(0.04, 0.03, 0.12);
      vec3 c1 = vec3(0.28, 0.07, 0.44);
      vec3 c2 = vec3(0.76, 0.22, 0.30);
      vec3 c3 = vec3(0.97, 0.62, 0.16);
      vec3 c4 = vec3(0.99, 0.96, 0.74);
      vec3 ramp = disp < 0.25 ? mix(c0, c1, disp / 0.25)
                : disp < 0.50 ? mix(c1, c2, (disp - 0.25) / 0.25)
                : disp < 0.78 ? mix(c2, c3, (disp - 0.50) / 0.28)
                : mix(c3, c4, (disp - 0.78) / 0.22);

      // Subtle cyan L0/L1/L2/L3/L4 metric boundary rings (3m, 12m, 50m, 180m)
      float b0 = smoothstep(0.09, 0.0, abs(d - 3.0) / 3.0);
      float b1 = smoothstep(0.06, 0.0, abs(d - 12.0) / 12.0);
      float b2 = smoothstep(0.05, 0.0, abs(d - 50.0) / 50.0);
      float b3 = smoothstep(0.04, 0.0, abs(d - 180.0) / 180.0);
      float ring = max(max(b0, b1), max(b2, b3));
      return mix(ramp, vec3(0.10, 0.82, 1.0), ring * 0.55);
    }

    // 3-Tone Notan + Sobel/Depth Canny structural mask
    vec3 evalNotanCanny(vec2 uv) {
      vec2 e = 1.25 / uRes;
      vec3 sC = pow(clamp(texture2D(tSceneRaw, uv).rgb * 1.15, 0.0, 1.0), vec3(1.0 / 2.2));
      float lC = lum(sC);
      float lL = lum(pow(clamp(texture2D(tSceneRaw, uv - vec2(e.x, 0.0)).rgb * 1.15, 0.0, 1.0), vec3(1.0 / 2.2)));
      float lR = lum(pow(clamp(texture2D(tSceneRaw, uv + vec2(e.x, 0.0)).rgb * 1.15, 0.0, 1.0), vec3(1.0 / 2.2)));
      float lU = lum(pow(clamp(texture2D(tSceneRaw, uv + vec2(0.0, e.y)).rgb * 1.15, 0.0, 1.0), vec3(1.0 / 2.2)));
      float lD = lum(pow(clamp(texture2D(tSceneRaw, uv - vec2(0.0, e.y)).rgb * 1.15, 0.0, 1.0), vec3(1.0 / 2.2)));
      float lumEdge = length(vec2(lR - lL, lU - lD));

      float dC = linearDist(uv);
      float dR = linearDist(uv + vec2(e.x, 0.0));
      float dU = linearDist(uv + vec2(0.0, e.y));
      float depthEdge = clamp((abs(dR - dC) + abs(dU - dC)) / max(0.6, dC * 0.14), 0.0, 1.0);

      // 3-value Notan base (deep ink, mid-stone, warm paper) + crisp Canny edge lines
      float notanVal = lC < 0.24 ? 0.08 : (lC < 0.60 ? 0.50 : 0.94);
      vec3 base = vec3(notanVal) * vec3(0.96, 0.95, 0.91);
      float canny = smoothstep(0.07, 0.20, lumEdge) * 0.85 + smoothstep(0.22, 0.65, depthEdge) * 0.95;
      // Highlight L1 Hero band (3..12 m) silhouette edge in electric cyan for reference-guided conditioning
      vec3 edgeInk = (dC >= 3.0 && dC <= 12.2) ? vec3(0.09, 0.78, 1.0) : vec3(0.04, 0.06, 0.10);
      return mix(base, edgeInk, clamp(canny, 0.0, 1.0));
    }

    vec3 evalRefQuadrant(vec2 qUv) {
      vec3 refCol = texture2D(tRefPlate, qUv).rgb;
      float horY = 1.0 - uHorizon;
      float horLine = smoothstep(0.006, 0.0, abs(qUv.y - horY));
      refCol = mix(refCol, vec3(0.10, 0.78, 1.0), horLine * 0.82);
      // 6-color palette bar along bottom 6% of reference quadrant
      if (qUv.y < 0.065) {
        int idx = int(clamp(floor(qUv.x * 6.0), 0.0, 5.0));
        vec3 sw = idx == 0 ? uPal[0] : idx == 1 ? uPal[1] : idx == 2 ? uPal[2]
                : idx == 3 ? uPal[3] : idx == 4 ? uPal[4] : uPal[5];
        refCol = mix(sw, vec3(0.95), smoothstep(0.062, 0.065, qUv.y) * 0.5);
      }
      return refCol;
    }

    void main() {
      if (uPassMode == 1) {
        gl_FragColor = vec4(evalMetricDepth(vUv), 1.0);
        return;
      }
      if (uPassMode == 2) {
        gl_FragColor = vec4(evalNotanCanny(vUv), 1.0);
        return;
      }
      // Mode 3: 4-Up Control Sheet (TL: Reference + Palette, TR: Final WEAVE, BL: Metric Depth, BR: Notan/Canny)
      vec2 qUv = fract(vUv * 2.0);
      vec3 outCol;
      if (vUv.y >= 0.5) {
        if (vUv.x < 0.5) {
          outCol = evalRefQuadrant(qUv);
        } else {
          outCol = texture2D(tWeave, qUv).rgb;
        }
      } else {
        if (vUv.x < 0.5) {
          outCol = evalMetricDepth(qUv);
        } else {
          outCol = evalNotanCanny(qUv);
        }
      }
      // Crisp 2px brass/cyan crosshair divider
      vec2 pxDist = abs(vUv - 0.5) * uRes;
      float cross = step(min(pxDist.x, pxDist.y), 1.4);
      outCol = mix(outCol, vec3(0.88, 0.71, 0.42), cross * 0.92);
      gl_FragColor = vec4(outCol, 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false,
});

const darkroomPostScene = new THREE.Scene();
const darkroomPostCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
darkroomPostScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), darkroomMat));

// ---------------------------------------------------------------------------
// State: Active Inverse Shot, 5 Depth Levels (L0..L4), Darkroom Pass & Hero Gen
// ---------------------------------------------------------------------------
const state = {
  shotIndex: 0,
  easelFaceOffset: 0,
  darkroomPass: 0, // 0: WEAVE, 1: Depth, 2: Notan/Canny, 3: 4-Up Sheet
  soloLevel: -1, // -1 = all 5 levels active; 0..4 = solo L0..L4
  l4Variant: 0, // 0: Registered Plate + Sky, 1: Equirec Panorama + Palette Organ, 2: Segmentation Plate
  l3Variant: 0, // 0: After Inverse Grown, 1: Before Sculpt Baseline, 2: Cyan Sightline Massing
  l2Variant: 0, // 0: Lit Severn Threshold, 1: Inverse-Tomology X-Ray Cutaway, 2: Closed Storm Threshold
  l1Variant: 0, // 0: Co-Evolved Pair (V9 + Cutout Twin + Cast), 1: Solo V9 Poet + Cast, 2: Solo 31-Cutout + Cast
  l0Variant: 0, // 0: Iron Fire-Escape, 1: Severn Timber Doorjamb, 2: Shore Pine & Reeds, 3: Wet Puddle Grate, 4: Open
  heroGen: 0,
  heroSeed: 2086,
  heroPhenotype: {
    gen: 0,
    coatName: 'Nocturne Ivory-Piped Trench',
    coatHex: '#e6dfd1',
    trimHex: '#18b4ff',
    cuffHex: '#e0b46a',
    cuffLabel: 'Rolled Brass Cuff-Tuck',
    glasses: true,
    prop: 'camera', // 'camera' | 'jerikan' | 'parcel' | 'lantern'
    wings: 'folded', // 'off' | 'folded' | 'raven' | 'angel' | 'marble'
    motion: 'walk', // 'walk' | 'carry' | 'greet' | 'listen' | 'wing-glide'
    clipName: 'walk',
    contrastScore: 0.82,
    readabilityScore: 0.91,
  },
  cameraMode: 'locked', // 'locked' | 'free'
  orbitYaw: 0,
  orbitPitch: -0.10,
  orbitDist: 5.8,
  orbitTarget: new THREE.Vector3(0, 1.18, HERO_STAGE_Z),
};

// Match initial shot to pilot state poem if present
if (pilotInit.poem) {
  const foundIdx = SHOTS.findIndex((s) => s.poem === String(pilotInit.poem).padStart(2, '0'));
  if (foundIdx >= 0) state.shotIndex = foundIdx;
}

// ---------------------------------------------------------------------------
// Lighting & Root Level Groups (L4, L3, L2, L1, L0 + Diegetic Controls)
// ---------------------------------------------------------------------------
const hemiLight = new THREE.HemisphereLight('#c8e2ff', '#4b3b2f', 1.38);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#ffe0bc', 2.55);
sunLight.position.set(-24, 38, 22);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, {
  left: -28,
  right: 28,
  top: 28,
  bottom: -28,
  near: 1,
  far: 140,
});
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

const heroKeyLight = new THREE.SpotLight('#ffd8a8', 6.8, 24, Math.PI * 0.30, 0.58, 1.2);
heroKeyLight.position.set(3.2, 5.2, 8.6);
heroKeyLight.target.position.set(0, 1.25, HERO_STAGE_Z);
heroKeyLight.castShadow = true;
scene.add(heroKeyLight, heroKeyLight.target);

const heroCyanRim = new THREE.PointLight('#f2a541', 3.6, 16, 1.4);
heroCyanRim.position.set(-3.4, 2.6, 1.6);
scene.add(heroCyanRim);

function applyTimePresetToLights(preset) {
  if (!preset) return;
  hemiLight.intensity = preset.hemiIntensity ?? 1.35;
  sunLight.intensity = preset.sunIntensity ?? 2.4;
  sunLight.color.set(preset.sunColor || '#ffdcb8');
}

const levelGroups = {
  4: new THREE.Group(), // L4 (> 180 m): Sky Dome, Registered wygwyl Plate & 6-Color Palette Beacons
  3: new THREE.Group(), // L3 (50..180 m): Inverse-Grown Massing & Carved Reflective Water
  2: new THREE.Group(), // L2 (12..50 m): Severn/HDL Threshold, Lit Interior Rooms, Cyan Conduits & Wet Puddles
  1: new THREE.Group(), // L1 (3..12 m): Co-Evolved V9 Poet Hero + 31-Part Cutout Twin + Secondary Cast
  0: new THREE.Group(), // L0 (0.8..3 m): Foreground Optical Occluder (blurred by live DoF)
};
Object.values(levelGroups).forEach((g) => scene.add(g));

const diegeticGroup = new THREE.Group();
diegeticGroup.name = 'inverse-forge-diegetic-controls';
scene.add(diegeticGroup);

// Raycast registry for all in-world clickable 3D objects
const hitInvisibleMat = new THREE.MeshBasicMaterial({ visible: false });
const interactiveMeshes = [];
function registerInteractive(mesh, meta) {
  mesh.userData.invTarget = meta;
  interactiveMeshes.push(mesh);
  return mesh;
}

function clearGroup(grp) {
  while (grp.children.length > 0) {
    const ch = grp.children.pop();
    grp.remove(ch);
  }
}

// ---------------------------------------------------------------------------
// Reference Plate Texture Cache (Verified HTTP-200 wygwyl-world-arch URLs)
// ---------------------------------------------------------------------------
const refTextureCache = new Map();

function paintProceduralRefFallback(shot) {
  const ctx = fallbackRefCanvas.getContext('2d');
  const w = fallbackRefCanvas.width;
  const h = fallbackRefCanvas.height;
  const cols = shot?.palette?.colors || ['#16243a', '#2c4c6e', '#587b9c', '#98806c', '#cf9c78', '#ece4d8'];
  const horY = Math.round(h * (shot?.cam?.hor ?? 0.38));

  const skyG = ctx.createLinearGradient(0, 0, 0, Math.max(12, horY));
  skyG.addColorStop(0, cols[0]);
  skyG.addColorStop(0.55, cols[2]);
  skyG.addColorStop(1, cols[5]);
  ctx.fillStyle = skyG;
  ctx.fillRect(0, 0, w, horY);

  const grdG = ctx.createLinearGradient(0, horY, 0, h);
  grdG.addColorStop(0, cols[3]);
  grdG.addColorStop(0.5, cols[1]);
  grdG.addColorStop(1, cols[0]);
  ctx.fillStyle = grdG;
  ctx.fillRect(0, horY, w, h - horY);

  ctx.strokeStyle = '#18b4ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, horY);
  ctx.lineTo(w, horY);
  ctx.stroke();
  fallbackRefTex.needsUpdate = true;
}

function getShotPlateTexture(url, onReady) {
  if (!url) return fallbackRefTex;
  if (refTextureCache.has(url)) {
    const cached = refTextureCache.get(url);
    if (onReady && cached.image) onReady(cached);
    return cached;
  }
  const tex = texLoader.load(
    url,
    (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.minFilter = THREE.LinearFilter;
      loaded.magFilter = THREE.LinearFilter;
      if (onReady) onReady(loaded);
    },
    undefined,
    () => {
      // Keep procedural fallback cleanly if offline
    }
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  refTextureCache.set(url, tex);
  return tex;
}

// ---------------------------------------------------------------------------
// LEVEL L4 (> 180 m): GLSL 6-Color Palette Sky Dome + Registered wygwyl Plate
// ---------------------------------------------------------------------------
const skyUniforms = {
  uPal0: { value: new THREE.Color('#0b1a30') },
  uPal1: { value: new THREE.Color('#233f63') },
  uPal2: { value: new THREE.Color('#3b6992') },
  uPal3: { value: new THREE.Color('#7c8fa6') },
  uPal4: { value: new THREE.Color('#cfa07e') },
  uPal5: { value: new THREE.Color('#efe4d6') },
  uHorizonY: { value: 1.58 },
  uSunDir: { value: new THREE.Vector3(-0.35, 0.22, -0.91).normalize() },
  uTime: { value: 0 },
};

const skyDomeMesh = new THREE.Mesh(
  new THREE.SphereGeometry(315, 40, 24),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uPal0;
      uniform vec3 uPal1;
      uniform vec3 uPal2;
      uniform vec3 uPal3;
      uniform vec3 uPal4;
      uniform vec3 uPal5;
      uniform float uHorizonY;
      uniform vec3 uSunDir;
      uniform float uTime;
      varying vec3 vWorldPos;

      void main() {
        vec3 dir = normalize(vWorldPos - vec3(0.0, uHorizonY, 9.6));
        float elev = dir.y;
        // Smooth 6-band atmospheric ramp locked to mathematical horizon (elev = 0)
        vec3 sky;
        if (elev >= 0.0) {
          float t = pow(clamp(elev, 0.0, 1.0), 0.62);
          sky = t < 0.18 ? mix(uPal5, uPal4, t / 0.18)
              : t < 0.42 ? mix(uPal4, uPal3, (t - 0.18) / 0.24)
              : t < 0.72 ? mix(uPal3, uPal2, (t - 0.42) / 0.30)
              : mix(uPal2, uPal0, (t - 0.72) / 0.28);
        } else {
          float g = clamp(-elev * 3.5, 0.0, 1.0);
          sky = mix(uPal4 * 0.82, uPal0 * 0.55, g);
        }
        // Subtle Mie solar/lunar halo + horizon mist ribbon
        float sunAmt = max(dot(dir, uSunDir), 0.0);
        sky += uPal5 * pow(sunAmt, 24.0) * 0.38 + uPal4 * pow(sunAmt, 4.0) * 0.12;
        float mist = exp(-abs(elev) * 26.0);
        sky = mix(sky, mix(uPal4, uPal5, 0.55), mist * 0.36);
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  })
);
levelGroups[4].add(skyDomeMesh);

// Curved Cyclorama Reference Plate at z = -196 m (> 205 m from camera at z = +9.6 m)
const backdropUniforms = {
  tPlate: { value: fallbackRefTex },
  uRefHorizon: { value: 0.36 },
  uOpacity: { value: 0.88 },
  uTint: { value: new THREE.Color('#ffffff') },
};

function createCurvedCycloramaGeometry(radius = 208, arcRad = 1.18, height = 112, segX = 48, segY = 16) {
  const geo = new THREE.PlaneGeometry(radius * arcRad, height, segX, segY);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const theta = x / radius;
    pos.setX(i, Math.sin(theta) * radius);
    pos.setZ(i, 9.6 - Math.cos(theta) * radius);
  }
  geo.computeVertexNormals();
  return geo;
}

const refCycloramaMesh = new THREE.Mesh(
  createCurvedCycloramaGeometry(208, 1.24, 118, 48, 16),
  new THREE.ShaderMaterial({
    uniforms: backdropUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tPlate;
      uniform float uRefHorizon;
      uniform float uOpacity;
      uniform vec3 uTint;
      varying vec2 vUv;

      void main() {
        // Shift vUv.y so the reference plate's measured horizon aligns to vUv.y = 0.5 (world y = 1.58m)
        float targetY = (vUv.y - 0.5) + (1.0 - uRefHorizon);
        vec2 sampleUv = vec2(vUv.x, clamp(targetY, 0.01, 0.99));
        vec3 col = texture2D(tPlate, sampleUv).rgb * uTint;
        // Soft lateral & top/bottom atmospheric feathering into the 6-color GLSL sky dome
        float edgeX = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
        float edgeY = smoothstep(0.02, 0.20, vUv.y) * smoothstep(0.99, 0.82, vUv.y);
        float alpha = edgeX * edgeY * uOpacity;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  })
);
// Center at y = 1.58 m so vUv.y = 0.5 sits on the exact mathematical camera/hero eye horizon
refCycloramaMesh.position.set(0, 1.58, 0);
levelGroups[4].add(refCycloramaMesh);

const l4PaletteBeacons = new THREE.Group();
levelGroups[4].add(l4PaletteBeacons);

function rebuildL4SkyAndPlate(shot) {
  const cols = shot.palette?.colors || ['#0c1f38', '#285a8c', '#507aa6', '#8d9aa6', '#cfa482', '#efe6d8'];
  skyUniforms.uPal0.value.set(cols[0]);
  skyUniforms.uPal1.value.set(cols[1]);
  skyUniforms.uPal2.value.set(cols[2]);
  skyUniforms.uPal3.value.set(cols[3]);
  skyUniforms.uPal4.value.set(cols[4]);
  skyUniforms.uPal5.value.set(cols[5]);

  for (let i = 0; i < 6; i++) {
    darkroomMat.uniforms.uPal.value[i].set(cols[i]);
  }
  darkroomMat.uniforms.uHorizon.value = shot.cam?.hor ?? 0.36;

  // Sun direction matched to shot hour & camera heading
  const hdRad = THREE.MathUtils.degToRad(shot.cam?.hd || 150);
  const hourStr = (shot.refMeta?.hour || 'dusk').toLowerCase();
  const sunElev = hourStr.includes('day') ? 0.52 : hourStr.includes('night') ? 0.14 : 0.22;
  skyUniforms.uSunDir.value.set(Math.sin(hdRad * 0.5) * 0.55, sunElev, -0.84).normalize();

  scene.background.set(cols[0]);
  scene.fog.color.set(cols[2]);
  scene.fog.density = state.soloLevel >= 0 ? 0.0008 : 0.0021;

  paintProceduralRefFallback(shot);
  const url =
    state.l4Variant === 1
      ? shot.refMeta?.eqUrl
      : state.l4Variant === 2
      ? shot.refMeta?.segUrl
      : shot.refMeta?.refUrl;

  const plateTex = getShotPlateTexture(url, (loaded) => {
    backdropUniforms.tPlate.value = loaded;
    darkroomMat.uniforms.tRefPlate.value = loaded;
  });
  backdropUniforms.tPlate.value = plateTex;
  backdropUniforms.uRefHorizon.value = shot.refMeta?.horizon ?? shot.cam?.hor ?? 0.36;
  backdropUniforms.uOpacity.value = state.l4Variant === 2 ? 0.94 : 0.84;
  darkroomMat.uniforms.tRefPlate.value = getShotPlateTexture(shot.refMeta?.refUrl);

  // Build 6 distant (> 182 m) Palette Horizon Beacons at z = -182 m (191.6 m from camera)
  clearGroup(l4PaletteBeacons);
  for (let i = 0; i < 6; i++) {
    const bx = (i - 2.5) * 26.0;
    const h = 14 + (i === 2 || i === 3 ? 8 : 0) + (state.l4Variant === 1 ? 12 : 0);
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, h, 3.2),
      new THREE.MeshStandardMaterial({
        color: cols[i],
        emissive: cols[i],
        emissiveIntensity: state.l4Variant === 1 ? 0.85 : 0.42,
        roughness: 0.35,
      })
    );
    pillar.position.set(bx, h * 0.5 - 1.0, -182);
    l4PaletteBeacons.add(pillar);
  }
}

// ---------------------------------------------------------------------------
// LEVEL L3 (50..180 m): Inverse-Grown Massing & Carved Reflective Water
// Executes shot.grownOps (carve_water, raise_landmark, stand_city_block,
// raise_ridge, plant_forest, lay_beach, lay_street, open_meadow, open_sky)
// ---------------------------------------------------------------------------
const COMPASS_DEG = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
  F: null,
};

let l3WaterUniforms = null;

function compassToStageX(dirStr, camHdDeg, fallbackNormX = 0.5, spanM = 68) {
  if (!dirStr || COMPASS_DEG[dirStr] == null) {
    return (fallbackNormX - 0.5) * spanM;
  }
  let relDeg = ((COMPASS_DEG[dirStr] - (camHdDeg || 0) + 540) % 360) - 180;
  relDeg = THREE.MathUtils.clamp(relDeg, -75, 75);
  return (relDeg / 75) * (spanM * 0.5);
}

function buildLandmarkMesh(kind, baseColor, trimColor, cyanMat, wireMode) {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.68,
    metalness: 0.12,
    wireframe: wireMode,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: trimColor,
    roughness: 0.48,
    metalness: 0.24,
    wireframe: wireMode,
  });
  const warmWinMat = new THREE.MeshStandardMaterial({
    color: '#ffe3b3',
    emissive: '#ffa844',
    emissiveIntensity: 1.45,
    roughness: 0.25,
  });

  if (kind === 'chapel') {
    const nave = new THREE.Mesh(new THREE.BoxGeometry(16, 15, 24), stoneMat);
    nave.position.y = 7.5;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(12.2, 9.5, 4), accentMat);
    roof.rotation.y = Math.PI * 0.25;
    roof.position.y = 19.6;
    const belfry = new THREE.Mesh(new THREE.BoxGeometry(5.2, 28, 5.2), stoneMat);
    belfry.position.set(-5.4, 14, 9.2);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.8, 12, 4), accentMat);
    spire.rotation.y = Math.PI * 0.25;
    spire.position.set(-5.4, 34, 9.2);
    g.add(nave, roof, belfry, spire);
    for (const lx of [-4.2, 0, 4.2]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6.4, 0.4), warmWinMat);
      win.position.set(lx, 8.2, 12.1);
      g.add(win);
    }
  } else if (kind === 'temple') {
    const whiteMat = new THREE.MeshStandardMaterial({
      color: '#ebe8df',
      roughness: 0.32,
      metalness: 0.18,
      wireframe: wireMode,
    });
    for (let s = 0; s < 3; s++) {
      const w = 26 - s * 5;
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, w * 0.8), whiteMat);
      step.position.y = 1.1 + s * 2.2;
      g.add(step);
    }
    for (let cx = -8; cx <= 8; cx += 4) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 14, 12), whiteMat);
      col.position.set(cx, 13.6, 6.2);
      g.add(col);
    }
    const entablature = new THREE.Mesh(new THREE.BoxGeometry(20, 2.6, 15), whiteMat);
    entablature.position.y = 21.8;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.28, 10, 32), cyanMat);
    halo.position.set(0, 27.5, 2.0);
    g.add(entablature, halo);
  } else if (kind === 'hall' || kind === 'townhouse') {
    const w = kind === 'hall' ? 24 : 15;
    const h = kind === 'hall' ? 16 : 21;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 16), stoneMat);
    body.position.y = h * 0.5;
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 1.4, 17.2), accentMat);
    cornice.position.y = h + 0.6;
    g.add(body, cornice);
    for (let rx = -w * 0.36; rx <= w * 0.36; rx += 4.2) {
      for (let ry = 4.0; ry < h - 2.0; ry += 4.6) {
        const wMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.35), warmWinMat);
        wMesh.position.set(rx, ry, 8.1);
        g.add(wMesh);
      }
    }
  } else {
    // 'tower' or 'high-rise' — stepped slender spire + cyan relay crown
    const h1 = kind === 'high-rise' ? 44 : 38;
    const base = new THREE.Mesh(new THREE.BoxGeometry(13.5, h1 * 0.58, 13.5), stoneMat);
    base.position.y = h1 * 0.29;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(9.2, h1 * 0.48, 9.2), accentMat);
    shaft.position.y = h1 * 0.72;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(5.4, 9.0, 5.4), stoneMat);
    crown.position.y = h1 + 2.0;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.48, 12.0, 8), cyanMat);
    mast.position.y = h1 + 11.5;
    g.add(base, shaft, crown, mast);
    for (let wy = 6; wy < h1 - 2; wy += 4.4) {
      for (const wx of [-2.6, 0, 2.6]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.3), warmWinMat);
        win.position.set(wx, wy, 6.85);
        g.add(win);
      }
    }
  }
  return g;
}

function rebuildL3GrownWorld(shot) {
  clearGroup(levelGroups[3]);
  const cols = shot.palette?.colors || ['#16243a', '#2c4c6e', '#587b9c', '#98806c', '#cf9c78', '#ece4d8'];
  const wireMode = state.l3Variant === 2;
  const isBeforeBaseline = state.l3Variant === 1;

  const cyanMat = new THREE.MeshStandardMaterial({
    color: '#18b4ff',
    emissive: '#18b4ff',
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });

  // Base L3 ground terrace (z = -46 .. -178 m, i.e., 55.6 .. 187.6 m from camera)
  const terraceMat = new THREE.MeshStandardMaterial({
    color: cols[1],
    roughness: 0.86,
    metalness: 0.06,
    wireframe: wireMode,
  });

  const ops = shot.grownOps && shot.grownOps.length > 0
    ? shot.grownOps
    : [{ kind: 'sculpt_relief', distM: 95, dir: 'F' }];

  const hasCarvedWater = !isBeforeBaseline && ops.some((o) => o.kind === 'carve_water' || (shot.refMeta?.frac?.water || 0) > 12);
  const hasOpenSky = !isBeforeBaseline && ops.some((o) => o.kind === 'open_sky');

  if (hasCarvedWater) {
    const waterOp = ops.find((o) => o.kind === 'carve_water');
    const basinWidth = THREE.MathUtils.clamp((waterOp?.widthM || 180) * 0.72, 64, 210);
    const basinCenterX = compassToStageX(
      waterOp?.dir,
      shot.cam?.hd,
      shot.refMeta?.x?.water ?? 0.5,
      54
    );

    l3WaterUniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(cols[0]).lerp(new THREE.Color('#092844'), 0.6) },
      uShallow: { value: new THREE.Color(cols[2]).lerp(new THREE.Color('#18b4ff'), 0.38) },
      uGlint: { value: new THREE.Color(cols[5]) },
    };

    const waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(basinWidth, 118, 48, 32),
      new THREE.ShaderMaterial({
        uniforms: l3WaterUniforms,
        vertexShader: `
          uniform float uTime;
          varying vec2 vUv;
          varying float vWave;
          void main() {
            vUv = uv;
            vec3 p = position;
            float w = sin(p.x * 0.22 + uTime * 1.7) * 0.14 + cos(p.y * 0.31 - uTime * 1.3) * 0.11;
            p.z += w;
            vWave = w;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          uniform vec3 uGlint;
          uniform float uTime;
          varying vec2 vUv;
          varying float vWave;
          void main() {
            float fresnel = pow(clamp(1.0 - vUv.y * 0.85, 0.0, 1.0), 1.6);
            vec3 c = mix(uDeep, uShallow, fresnel * 0.72 + 0.18);
            // Specular horizon sun/cyan shimmer lanes
            float shimmer = smoothstep(0.16, 0.24, vWave + sin(vUv.x * 38.0 + uTime * 2.4) * 0.08);
            float centerPath = exp(-pow((vUv.x - 0.5) * 4.2, 2.0));
            c = mix(c, uGlint, shimmer * (0.28 + 0.45 * centerPath));
            c += vec3(0.06, 0.48, 0.72) * shimmer * 0.28;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
      })
    );
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(basinCenterX, -0.28, -106);
    levelGroups[3].add(waterMesh);

    // Carved stone quay seawall & cyan tide-gauge coping at z = -47 m (56.6 m from camera)
    const quayWall = new THREE.Mesh(
      new THREE.BoxGeometry(basinWidth + 18, 1.35, 3.2),
      new THREE.MeshStandardMaterial({ color: cols[2], roughness: 0.78 })
    );
    quayWall.position.set(basinCenterX, 0.25, -46.5);
    const tideStrip = new THREE.Mesh(new THREE.BoxGeometry(basinWidth + 14, 0.14, 0.26), cyanMat);
    tideStrip.position.set(basinCenterX, 0.82, -44.85);
    levelGroups[3].add(quayWall, tideStrip);
  } else {
    l3WaterUniforms = null;
    const dryBasin = new THREE.Mesh(new THREE.PlaneGeometry(240, 126), terraceMat);
    dryBasin.rotation.x = -Math.PI / 2;
    dryBasin.position.set(0, -0.12, -108);
    dryBasin.receiveShadow = true;
    levelGroups[3].add(dryBasin);
  }

  // If state.l3Variant === 1 ("Before Inverse Sculpt"), place the uncarved obstructing slab that hid the horizon
  if (isBeforeBaseline) {
    const obstructMat = new THREE.MeshStandardMaterial({ color: cols[1], roughness: 0.92 });
    for (let i = -3; i <= 3; i++) {
      const blk = new THREE.Mesh(new THREE.BoxGeometry(18, 22 + (Math.abs(i) % 2) * 8, 18), obstructMat);
      blk.position.set(i * 19.5, 11, -78 - (Math.abs(i) % 3) * 14);
      levelGroups[3].add(blk);
    }
    return;
  }

  // Execute each parsed grownOp in L3 (50..180 m)
  ops.forEach((op, idx) => {
    const zPos = -THREE.MathUtils.clamp(58 + idx * 18 + ((op.distM || 80) % 55), 54, 158);
    const xPos = compassToStageX(
      op.dir,
      shot.cam?.hd,
      shot.refMeta?.x?.city ?? 0.54,
      72
    );

    if (op.kind === 'raise_landmark') {
      const lm = buildLandmarkMesh(op.landmark, cols[3], cols[4], cyanMat, wireMode);
      // Place slightly right-of-center so Severn L2 on the left frames it cleanly
      const lx = Math.abs(xPos) < 4 ? 8.5 : xPos;
      lm.position.set(lx, -0.2, -78);
      levelGroups[3].add(lm);
    } else if (op.kind === 'stand_city_block') {
      const blockGroup = new THREE.Group();
      const targetH = THREE.MathUtils.clamp((op.heightM || 60) * 0.52, 18, 52);
      const bMat = new THREE.MeshStandardMaterial({ color: cols[2], roughness: 0.72, wireframe: wireMode });
      const wMat = new THREE.MeshStandardMaterial({ color: '#ffdca8', emissive: '#ff9d3b', emissiveIntensity: 1.1 });
      for (let k = -2; k <= 2; k++) {
        if (hasOpenSky && Math.abs(k) === 0) continue;
        const th = targetH * (0.68 + ((Math.abs(k * 7 + idx) % 5) * 0.1));
        const tw = 9.5 + (Math.abs(k) % 2) * 3.5;
        const tower = new THREE.Mesh(new THREE.BoxGeometry(tw, th, 11), bMat);
        tower.position.set(k * 12.5, th * 0.5 - 0.2, (Math.abs(k) % 2) * -8);
        blockGroup.add(tower);
        if (!wireMode) {
          const beacon = new THREE.Mesh(new THREE.BoxGeometry(tw * 0.55, 0.45, 0.45), k % 2 === 0 ? cyanMat : wMat);
          beacon.position.set(k * 12.5, th - 0.8, (Math.abs(k) % 2) * -8 + 5.6);
          blockGroup.add(beacon);
        }
      }
      blockGroup.position.set(xPos * 0.65, 0, zPos - 18);
      levelGroups[3].add(blockGroup);
    } else if (op.kind === 'raise_ridge') {
      const ridgeH = THREE.MathUtils.clamp((op.heightM || 18) * 0.48 + 9, 8, 44);
      const ridgeGeo = new THREE.ConeGeometry(42, ridgeH, 7);
      const ridgeMat = new THREE.MeshStandardMaterial({
        color: cols[1],
        roughness: 0.9,
        flatShading: true,
        wireframe: wireMode,
      });
      const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
      ridge.scale.set(1.65, 1.0, 0.55);
      ridge.position.set(xPos, ridgeH * 0.44 - 1.2, zPos - 14);
      levelGroups[3].add(ridge);
    } else if (op.kind === 'plant_forest') {
      const grove = new THREE.Group();
      const trunkMat = new THREE.MeshStandardMaterial({ color: '#3e2d21', roughness: 0.9 });
      const canopyMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cols[1]).lerp(new THREE.Color('#274e3c'), 0.65),
        roughness: 0.84,
        wireframe: wireMode,
      });
      for (let t = 0; t < 11; t++) {
        const tx = (t - 5) * 4.8 + ((t * 17) % 3);
        const tz = -((t * 13) % 18);
        const th = 6.5 + (t % 4) * 2.1;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.44, th * 0.45, 6), trunkMat);
        trunk.position.set(tx, th * 0.2, tz);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6 + (t % 3) * 0.5, th * 0.85, 7), canopyMat);
        crown.position.set(tx, th * 0.68, tz);
        grove.add(trunk, crown);
      }
      grove.position.set(xPos || 18, -0.15, THREE.MathUtils.clamp(zPos, -98, -52));
      levelGroups[3].add(grove);
    } else if (op.kind === 'lay_beach' || op.kind === 'open_meadow') {
      const stripColor = op.kind === 'lay_beach' ? '#c5ab86' : '#496348';
      const berm = new THREE.Mesh(
        new THREE.BoxGeometry(84, 0.95, 22),
        new THREE.MeshStandardMaterial({ color: stripColor, roughness: 0.92, wireframe: wireMode })
      );
      berm.position.set(xPos * 0.5, -0.1, -56);
      levelGroups[3].add(berm);
    } else if (op.kind === 'lay_street') {
      const ave = new THREE.Group();
      const road = new THREE.Mesh(
        new THREE.BoxGeometry(11.5, 0.18, 96),
        new THREE.MeshStandardMaterial({ color: '#1f2630', roughness: 0.34, metalness: 0.25 })
      );
      road.position.set(0, -0.05, -94);
      ave.add(road);
      for (let lz = -52; lz >= -132; lz -= 16) {
        for (const side of [-6.4, 6.4]) {
          const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.10, 0.14, 6.2, 6),
            new THREE.MeshStandardMaterial({ color: '#3b434d', metalness: 0.6, roughness: 0.4 })
          );
          pole.position.set(side, 3.0, lz);
          const lantern = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 8, 8),
            new THREE.MeshStandardMaterial({ color: '#ffe4b0', emissive: '#ffaa44', emissiveIntensity: 1.8 })
          );
          lantern.position.set(side, 6.2, lz);
          ave.add(pole, lantern);
        }
      }
      ave.position.x = xPos * 0.35;
      levelGroups[3].add(ave);
    }
  });

  // Always add flanking distant harbor silhouette piers if only sky/water ops ran so L3 depth reads crisply
  if (ops.every((o) => o.kind === 'open_sky' || o.kind === 'carve_water')) {
    const leftMole = buildLandmarkMesh('tower', cols[2], cols[4], cyanMat, wireMode);
    leftMole.position.set(22, -0.25, -92);
    levelGroups[3].add(leftMole);
  }
}

// ---------------------------------------------------------------------------
// LEVEL L2 (12..50 m): Severn/HDL Threshold, Carved Lit Rooms, Cyan Conduits
// & Wet-Only Street Puddle Reflections
// ---------------------------------------------------------------------------
let l2DoorOpen = pilotInit.doorOpen !== false;
let severnBuiltRef = null;

function createMidgroundWetPuddleTextures() {
  const sz = 512;
  const col = document.createElement('canvas');
  col.width = col.height = sz;
  const c = col.getContext('2d');
  c.fillStyle = '#242a33';
  c.fillRect(0, 0, sz, sz);
  for (let i = 0; i < 3800; i++) {
    const v = 28 + ((i * 23) % 24);
    c.fillStyle = `rgb(${v},${v + 3},${v + 7})`;
    c.fillRect((i * 79) % sz, (i * 149) % sz, 2, 2);
  }
  c.strokeStyle = 'rgba(14, 18, 24, 0.48)';
  for (let g = 0; g < sz; g += 64) {
    c.beginPath(); c.moveTo(g, 0); c.lineTo(g, sz); c.stroke();
    c.beginPath(); c.moveTo(0, g); c.lineTo(sz, g); c.stroke();
  }

  // Wet-only roughness map: dry paving = 225 (roughness ~0.88), rain puddles = 14 (mirror-wet ~0.06)
  const rgh = document.createElement('canvas');
  rgh.width = rgh.height = sz;
  const r = rgh.getContext('2d');
  r.fillStyle = 'rgb(225,225,225)';
  r.fillRect(0, 0, sz, sz);
  for (let i = 0; i < 16; i++) {
    const px = ((i * 103 + 44) % (sz - 96)) + 48;
    const py = ((i * 157 + 52) % (sz - 96)) + 48;
    const rx = 34 + (i % 4) * 18;
    const grd = r.createRadialGradient(px, py, 4, px, py, rx);
    grd.addColorStop(0, 'rgb(12,12,12)');
    grd.addColorStop(0.68, 'rgb(26,26,26)');
    grd.addColorStop(1, 'rgba(225,225,225,0)');
    r.fillStyle = grd;
    r.beginPath();
    r.arc(px, py, rx, 0, Math.PI * 2);
    r.fill();
  }

  const map = new THREE.CanvasTexture(col);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(8, 8);
  map.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(rgh);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(8, 8);

  return { map, roughnessMap };
}

const l2PuddleTex = createMidgroundWetPuddleTextures();

function rebuildL2Architecture() {
  clearGroup(levelGroups[2]);
  const shot = SHOTS[state.shotIndex] || SHOTS[0];
  const cols = shot?.palette?.colors || ['#16243a', '#2c4c6e', '#587b9c', '#98806c', '#cf9c78', '#ece4d8'];
  const xrayMode = state.l2Variant === 1;
  l2DoorOpen = state.l2Variant === 2 ? false : (loadPilotState().doorOpen !== false);

  // 1. Wet-Only Puddle Street Apron & Dry Granite Sidewalk (z = +9.5 .. -44 m)
  const streetPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(92, 62),
    new THREE.MeshStandardMaterial({
      map: l2PuddleTex.map,
      roughnessMap: l2PuddleTex.roughnessMap,
      roughness: 0.92,
      metalness: 0.34,
    })
  );
  streetPlane.rotation.x = -Math.PI / 2;
  streetPlane.position.set(0, -0.03, -16);
  streetPlane.receiveShadow = true;
  levelGroups[2].add(streetPlane);

  // Mirror-slick street puddles catching warm Severn windows & #18b4ff cyan conduits (14..34 m from camera)
  const puddleGlowMat = new THREE.MeshStandardMaterial({
    color: '#163654',
    emissive: '#18b4ff',
    emissiveIntensity: 0.28,
    roughness: 0.05,
    metalness: 0.88,
    transparent: true,
    opacity: 0.78,
  });
  for (const [px, pz, sx, sz] of [
    [-4.8, -8.5, 4.6, 2.8],
    [3.9, -12.4, 5.2, 3.1],
    [-1.4, -19.2, 6.4, 3.6],
  ]) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 24), puddleGlowMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(sx * 0.5, sz * 0.5, 1);
    puddle.position.set(px, -0.018, pz);
    levelGroups[2].add(puddle);
  }

  // Dry matte granite curb & stage sidewalk (roughness 0.88 -> strictly non-reflective when dry)
  const dryGraniteMat = new THREE.MeshStandardMaterial({ color: '#6e685f', roughness: 0.88, metalness: 0.02 });
  const leftWalk = new THREE.Mesh(new THREE.BoxGeometry(24, 0.16, 46), dryGraniteMat);
  leftWalk.position.set(-16.5, 0.05, -14);
  leftWalk.receiveShadow = true;
  const rightWalk = new THREE.Mesh(new THREE.BoxGeometry(20, 0.16, 46), dryGraniteMat);
  rightWalk.position.set(17.5, 0.05, -14);
  rightWalk.receiveShadow = true;
  levelGroups[2].add(leftWalk, rightWalk);

  // #18b4ff Cyan Curb Signal & Water Conduits leading into the Severn Threshold
  const cyanConduitMat = new THREE.MeshStandardMaterial({
    color: '#18b4ff',
    emissive: '#18b4ff',
    emissiveIntensity: 1.55,
    roughness: 0.18,
  });
  const leftConduit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 42), cyanConduitMat);
  leftConduit.position.set(-4.65, 0.02, -13);
  const crossConduit = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.04, 0.12), cyanConduitMat);
  crossConduit.position.set(0.8, 0.015, -6.2);
  levelGroups[2].add(leftConduit, crossConduit);

  // 2. Compiled Midground Severn HDL Hero Building (z = -15.8 m -> ~25.4 m from camera, L2 = 12..50 m!)
  try {
    const mutatedModel = mutateSevernCandidate(
      SEVERN_BUNDLE.severn || SEVERN_BUNDLE,
      (shot?.index || 0) + state.l2Variant * 7
    );
    severnBuiltRef = buildHdlModel(mutatedModel, {
      xray: xrayMode,
      doorOpen: l2DoorOpen,
    });
    const sevGroup = severnBuiltRef.group || severnBuiltRef;
    sevGroup.position.set(-13.8, 0.08, -16.5);
    sevGroup.rotation.y = 0.36;
    setThresholdDoor(severnBuiltRef, l2DoorOpen);
    levelGroups[2].add(sevGroup);

    const doorHit = registerInteractive(
      new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.2, 3.2), hitInvisibleMat),
      {
        kind: 'l2-threshold',
        anchor: new THREE.Vector3(-8.4, 3.4, -12.2),
        getWhisper: () =>
          `L2 Severn Threshold (${l2DoorOpen ? 'OPEN 13.5 kHz' : 'CLOSED 580 Hz'}) — click to swing door / cutaway`,
      }
    );
    doorHit.position.set(-8.6, 2.1, -12.4);
    levelGroups[2].add(doorHit);
  } catch {
    // Fallback carved Severn masonry + lit rooms if HDL model shape differs
  }

  // Explicit Carved Inverse-Tomology Interior Chambers & Warm Window Lamps on Right-Midground Arcade
  // (x = +11.6 m, z = -17.5 m -> 29 m from camera, framing the right side of the L3 canyon!)
  const arcadeGroup = new THREE.Group();
  arcadeGroup.position.set(12.2, 0.08, -17.8);
  arcadeGroup.rotation.y = -0.34;

  const brickShellMat = new THREE.MeshStandardMaterial({
    color: cols[3] || '#9c563f',
    roughness: 0.82,
    transparent: xrayMode,
    opacity: xrayMode ? 0.28 : 1.0,
  });
  const roomWallMat = new THREE.MeshStandardMaterial({
    color: '#d8b48a',
    emissive: '#ff9d3b',
    emissiveIntensity: 0.62,
    roughness: 0.68,
    side: THREE.BackSide,
  });
  const warmLampBulbMat = new THREE.MeshStandardMaterial({
    color: '#fff2cc',
    emissive: '#ffaa42',
    emissiveIntensity: 2.2,
  });

  // 3 storeys of carved interior rooms visible through deep window reveals
  for (let floor = 0; floor < 3; floor++) {
    const fy = 1.9 + floor * 3.6;
    const roomBox = new THREE.Mesh(new THREE.BoxGeometry(8.4, 2.9, 6.2), roomWallMat);
    roomBox.position.set(0, fy, 0);
    arcadeGroup.add(roomBox);

    // Hanging warm tungsten room lamp inside each carved chamber
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), warmLampBulbMat);
    bulb.position.set(-1.2 + floor * 1.1, fy + 0.95, 0.4);
    arcadeGroup.add(bulb);

    // Exterior piers around the open glazed room bays
    for (const px of [-4.4, 0, 4.4]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.85, 3.6, 0.9), brickShellMat);
      pier.position.set(px, fy, 3.15);
      pier.castShadow = true;
      arcadeGroup.add(pier);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.68, 1.05), brickShellMat);
    lintel.position.set(0, fy + 1.62, 3.18);
    arcadeGroup.add(lintel);
  }

  // Vertical #18b4ff cyan riser conduit on the arcade corner
  const riserPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 11.4, 10), cyanConduitMat);
  riserPipe.position.set(-4.65, 5.7, 3.55);
  arcadeGroup.add(riserPipe);

  const warmWindowLight = new THREE.PointLight('#ffaa44', 24.0, 28, 1.5);
  warmWindowLight.position.set(8.2, 4.8, -13.5);
  levelGroups[2].add(arcadeGroup, warmWindowLight);
}

// ---------------------------------------------------------------------------
// LEVEL L1 (3..12 m): Co-Evolved V9 Poet Hero + 31-Part Cutout Rig + Secondary Cast
// Grounded at 1.72 m scale, eye-line registered to cam.hor
// ---------------------------------------------------------------------------
const HERO_COATS_DARK_BG = [
  { name: 'Aubergine Poet Tracksuit + Ivory Cuff', coat: '#38263b', trim: '#f25c48', cuff: '#f6efe0', cuffLabel: 'Crisp Ivory Cuff-Tuck', lum: 0.84 },
  { name: 'Warm Ochre-Umber Trench + Gold Stripe', coat: '#5c3828', trim: '#e8b858', cuff: '#f6efe0', cuffLabel: 'Gilded Cuff-Tuck', lum: 0.78 },
  { name: 'Midnight Plum Tracksuit + Brass Piping', coat: '#2d2942', trim: '#e0b46a', cuff: '#f25c48', cuffLabel: 'Vermilion Cuff-Tuck', lum: 0.81 },
];

const HERO_COATS_LIGHT_BG = [
  { name: 'Obsidian Poet Tracksuit + Vermilion Stripe', coat: '#16151f', trim: '#d83b2d', cuff: '#f4eedd', cuffLabel: 'Crisp Ivory Cuff-Tuck', lum: 0.11 },
  { name: 'Charcoal Harbor Greatcoat + Brass Seam', coat: '#1d1a24', trim: '#c88a2e', cuff: '#e0b46a', cuffLabel: 'Rolled Brass Cuff-Tuck', lum: 0.14 },
  { name: 'Espresso Wool Tracksuit + Ochre Collar', coat: '#241b19', trim: '#d67b44', cuff: '#f4eedd', cuffLabel: 'Linen Cuff-Tuck', lum: 0.15 },
];

const HERO_PROPS = ['camera', 'jerikan', 'parcel', 'lantern'];
const HERO_WINGS = ['off', 'folded', 'raven', 'angel', 'marble'];
const HERO_MOTIONS = [
  { id: 'walk', clip: 'walk', label: 'Walk Stride' },
  { id: 'carry', clip: 'carry', label: 'Carry Burden' },
  { id: 'greet', clip: 'greet', label: 'Threshold Greet' },
  { id: 'listen', clip: 'listen', label: 'Poet Listen' },
  { id: 'wing-glide', clip: 'walk', label: 'P06 Wing-Glide' },
];

function hashInt(seed) {
  let x = (seed ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function computeCoEvolvedPhenotype(shot, gen = 0, baseSeed = 2086) {
  const poemNum = parseInt(shot?.poem || '01', 10) || 1;
  const bgLum = typeof shot?.refMeta?.lum === 'number' ? shot.refMeta.lum : 0.28;
  const h = hashInt(baseSeed + (shot?.index || 0) * 131 + gen * 977);

  // Evolutionary Selection: evaluate 4 candidate coats against bgLum and keep highest Weber/Michelson contrast!
  const pool = bgLum < 0.38 ? HERO_COATS_DARK_BG : HERO_COATS_LIGHT_BG;
  const altPool = bgLum < 0.38 ? HERO_COATS_LIGHT_BG : HERO_COATS_DARK_BG;
  const candidates = [
    pool[h % pool.length],
    pool[(h + 1) % pool.length],
    pool[(h + 2) % pool.length],
    altPool[h % altPool.length],
  ];
  let bestCoat = candidates[0];
  let bestContrast = -1;
  // At Gen 0 pick poem-seeded good match; as Gen increases, strictly optimize silhouette contrast + variety
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const contrast = Math.abs(c.lum - bgLum) + (i === (gen % 3) ? 0.08 : 0);
    if (contrast > bestContrast) {
      bestContrast = contrast;
      bestCoat = c;
    }
  }

  // Poem-coupled P06 wing lineage at Gen 0, evolving freely across generations
  let defaultWing = 'folded';
  if (poemNum <= 2) defaultWing = 'off';
  else if (poemNum === 3 || poemNum === 4) defaultWing = 'raven';
  else if (poemNum === 6 || poemNum === 8) defaultWing = 'angel';
  else if (poemNum >= 11) defaultWing = 'marble';

  const wings = gen === 0 ? defaultWing : HERO_WINGS[(HERO_WINGS.indexOf(defaultWing) + gen) % HERO_WINGS.length];

  // Prop coupled to poem/world action at Gen 0, rotating with evolution
  const defaultProp =
    poemNum === 1 || poemNum === 9 ? 'camera' :
    poemNum === 4 || poemNum === 11 ? 'lantern' :
    poemNum === 6 || poemNum === 13 ? 'jerikan' : 'parcel';
  const prop = gen === 0 ? defaultProp : HERO_PROPS[(HERO_PROPS.indexOf(defaultProp) + gen) % HERO_PROPS.length];

  // Motion matched to poem mode & wings
  let defaultMotionIdx = 0;
  if (wings === 'angel' || wings === 'marble' || shot?.poemMode === 'fly' || shot?.poemMode === 'fall') {
    defaultMotionIdx = 4; // wing-glide
  } else if (prop === 'parcel' || prop === 'jerikan') {
    defaultMotionIdx = 1; // carry
  } else if (poemNum === 7 || poemNum === 12) {
    defaultMotionIdx = 2; // greet
  } else if (poemNum === 9 || poemNum === 13) {
    defaultMotionIdx = 3; // listen
  }
  const motionObj = HERO_MOTIONS[(defaultMotionIdx + gen) % HERO_MOTIONS.length];

  const hourStr = (shot?.refMeta?.hour || '').toLowerCase();
  const glasses = gen === 0 ? (hourStr.includes('day') || poemNum === 6 || poemNum === 8 || poemNum === 10) : Boolean((gen + h) % 2);

  return {
    gen,
    coatName: bestCoat.name,
    coatHex: bestCoat.coat,
    trimHex: bestCoat.trim,
    cuffHex: bestCoat.cuff,
    cuffLabel: bestCoat.cuffLabel,
    glasses,
    prop,
    wings,
    motion: motionObj.id,
    clipName: motionObj.clip,
    motionLabel: motionObj.label,
    contrastScore: Number(Math.min(0.99, Math.abs(bestCoat.lum - bgLum) + 0.24).toFixed(2)),
    readabilityScore: Number(Math.min(0.99, 0.78 + (wings !== 'off' ? 0.09 : 0.04) + (gen > 0 ? 0.06 : 0)).toFixed(2)),
  };
}

// Stage plinth & active L1 character rig references
const l1StagePlinthGroup = new THREE.Group();
const l1HeroAnchor = new THREE.Group();
const l1CutoutAnchor = new THREE.Group();
const l1CastAnchor = new THREE.Group();
const l1AddonDecorGroup = new THREE.Group(); // Evolutionary cuff/prop/wing fallback & plinth ring

levelGroups[1].add(l1StagePlinthGroup, l1HeroAnchor, l1CutoutAnchor, l1CastAnchor);
l1HeroAnchor.add(l1AddonDecorGroup);

let activeHeroV9 = null;
let activeCutout31 = null;
let activeCastV9 = null;
let evolutionPulse = 0.0;
let plinthRingMat = null;

function buildL1StagePlinth() {
  clearGroup(l1StagePlinthGroup);
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#4d5058', roughness: 0.76, metalness: 0.08 });
  const brassInlayMat = new THREE.MeshStandardMaterial({ color: '#e0b46a', roughness: 0.28, metalness: 0.84 });
  plinthRingMat = new THREE.MeshStandardMaterial({
    color: '#18b4ff',
    emissive: '#18b4ff',
    emissiveIntensity: 1.25,
    roughness: 0.2,
  });

  // Grounded crosswalk-stone plinth flush at y = 0.0 m so Hero boots stand cleanly at y = 0
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.05, 0.08, 32), stoneMat);
  pad.position.set(0.2, -0.04, HERO_STAGE_Z - 0.3);
  pad.receiveShadow = true;

  const brassRing = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.022, 8, 48), brassInlayMat);
  brassRing.rotation.x = Math.PI / 2;
  brassRing.position.set(0.2, 0.005, HERO_STAGE_Z - 0.3);

  const cyanRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.018, 8, 48), plinthRingMat);
  cyanRing.rotation.x = Math.PI / 2;
  cyanRing.position.set(-0.15, 0.008, HERO_STAGE_Z);

  l1StagePlinthGroup.add(pad, brassRing, cyanRing);

  // Generous invisible raycast cylinder around the L1 Hero so clicking the Hero in 3D always triggers next Gen!
  const heroHit = registerInteractive(
    new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.95, 14), hitInvisibleMat),
    {
      kind: 'hero-evolve',
      anchor: new THREE.Vector3(-0.15, 1.88, HERO_STAGE_Z),
      getWhisper: () => {
        const p = state.heroPhenotype;
        return `L1 Poet Hero Gen ${p.gen} (${p.wings} wings · ${p.prop} · contrast ${p.contrastScore}) — click to evolve Gen ${p.gen + 1}`;
      },
    }
  );
  heroHit.position.set(-0.15, 0.96, HERO_STAGE_Z);
  l1StagePlinthGroup.add(heroHit);

  const cutoutHit = registerInteractive(
    new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.92, 12), hitInvisibleMat),
    {
      kind: 'cutout-click',
      anchor: new THREE.Vector3(0.95, 1.86, HERO_STAGE_Z - 0.92),
      getWhisper: () =>
        `31-Part Brass-Pivot Cutout Twin (1.72 m) — click to evolve Hero + Cutout phenotype`,
    }
  );
  cutoutHit.position.set(0.95, 0.95, HERO_STAGE_Z - 0.92);
  l1StagePlinthGroup.add(cutoutHit);
}

// Build fallback articulated 31-part cutout rig directly from ../hero-build/assets/poet_tracksuit_31/ & wings/
// if cutout-31-rig.js is still being written, and swap seamlessly once cutout-31-rig.js is live!
function buildFallbackCutoutRig() {
  const root = new THREE.Group();
  const basePath = new URL('../hero-build/assets/', import.meta.url).href;
  const brassPinMat = new THREE.MeshStandardMaterial({ color: '#e6bc6a', roughness: 0.22, metalness: 0.88 });

  function partPlane(relFile, wM, hM, x, y, z) {
    const tex = texLoader.load(basePath + relFile);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.12,
      roughness: 0.62,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }

  const wingPivotL = new THREE.Group();
  wingPivotL.position.set(-0.12, 1.34, -0.05);
  wingPivotL.add(partPlane('wings/08.cast.angel.wings.png', 0.95, 0.78, -0.36, 0.08, 0));

  const wingPivotR = new THREE.Group();
  wingPivotR.position.set(0.12, 1.34, -0.05);
  const wR = partPlane('wings/08.cast.angel.wings.png', 0.95, 0.78, 0.36, 0.08, 0);
  wR.scale.x = -1;
  wingPivotR.add(wR);

  const torso = partPlane('poet_tracksuit_31/01_torso_front.png', 0.48, 0.56, 0, 1.18, 0.02);
  const pelvis = partPlane('poet_tracksuit_31/06_pelvis_front_cover.png', 0.36, 0.26, 0, 0.86, 0.025);
  const head = partPlane('poet_tracksuit_31/21_head_front_blank.png', 0.24, 0.28, 0, 1.56, 0.035);
  const glasses = partPlane('poet_tracksuit_31/31_sunglasses_front.png', 0.20, 0.09, 0, 1.58, 0.048);
  const armL = partPlane('poet_tracksuit_31/07_upper_arm_L.png', 0.18, 0.34, -0.24, 1.18, 0.03);
  const foreL = partPlane('poet_tracksuit_31/08_forearm_L.png', 0.16, 0.30, -0.26, 0.92, 0.035);
  const armR = partPlane('poet_tracksuit_31/09_upper_arm_R.png', 0.18, 0.34, 0.24, 1.18, 0.03);
  const foreR = partPlane('poet_tracksuit_31/10_forearm_R.png', 0.16, 0.30, 0.26, 0.92, 0.035);
  const legL = partPlane('poet_tracksuit_31/11_thigh_L.png', 0.20, 0.42, -0.11, 0.62, 0.015);
  const shinL = partPlane('poet_tracksuit_31/12_shin_L.png', 0.18, 0.40, -0.11, 0.28, 0.02);
  const bootL = partPlane('poet_tracksuit_31/19_boot_front_L.png', 0.18, 0.16, -0.11, 0.08, 0.03);
  const legR = partPlane('poet_tracksuit_31/13_thigh_R.png', 0.20, 0.42, 0.11, 0.62, 0.015);
  const shinR = partPlane('poet_tracksuit_31/14_shin_R.png', 0.18, 0.40, 0.11, 0.28, 0.02);
  const bootR = partPlane('poet_tracksuit_31/20_boot_front_R.png', 0.18, 0.16, 0.11, 0.08, 0.03);

  root.add(wingPivotL, wingPivotR, legL, shinL, bootL, legR, shinR, bootR, pelvis, torso, armL, foreL, armR, foreR, head, glasses);

  // Gleaming 3D brass pivot pins at anatomical joints
  for (const [px, py] of [
    [0, 1.44], [-0.21, 1.34], [0.21, 1.34], [-0.25, 1.04], [0.25, 1.04],
    [0, 0.92], [-0.11, 0.80], [0.11, 0.80], [-0.11, 0.44], [0.11, 0.44],
  ]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 10), brassPinMat);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(px, py, 0.052);
    root.add(pin);
  }

  let tAcc = 0;
  return {
    group: root,
    isFallback: true,
    setGlasses: (on) => { glasses.visible = Boolean(on); },
    setWingsMode: (mode) => {
      const show = mode && mode !== 'off';
      wingPivotL.visible = show;
      wingPivotR.visible = show;
    },
    update: (dt) => {
      tAcc += dt;
      const sw = Math.sin(tAcc * 2.6);
      armL.rotation.z = sw * 0.14;
      armR.rotation.z = -sw * 0.14;
      wingPivotL.rotation.z = Math.sin(tAcc * 2.1) * 0.18 + 0.12;
      wingPivotR.rotation.z = -Math.sin(tAcc * 2.1) * 0.18 - 0.12;
      root.position.y = Math.abs(Math.sin(tAcc * 2.6)) * 0.015;
    },
  };
}

// Build fallback Anny V7 clothed Poet Hero if anny-hero-v9.js is not yet imported
async function buildFallbackAnnyHero(role = 'poet_hero') {
  const Anny = window.AnnyHumanV7;
  if (!Anny) return null;
  const isHero = role === 'poet_hero';
  const inst = new Anny({
    THREE,
    loader: gltfLoader,
    assetBaseUrl: new URL('../../abyssinian-highlands/human-forge/assets', import.meta.url).href,
    clipsBaseUrl: new URL('../../motion-pipeline/mesh2motion/clips', import.meta.url).href,
    archetype: isHero ? 'adult_m' : 'adult_f',
    heightM: isHero ? 1.72 : 1.68,
    skinHex: isHero ? '#593b2b' : '#6a4633',
    garments: isHero
      ? [
          { type: 'coat', color: '#1b263b', trimColor: '#e0b46a' },
          { type: 'trousers', color: '#141923' },
          { type: 'boots', color: '#1c1816' },
        ]
      : [
          { type: 'jacket', color: '#8f4736' },
          { type: 'trousers', color: '#242b38' },
          { type: 'boots', color: '#231d1a' },
        ],
  });
  if (typeof inst.load === 'function') {
    await inst.load();
  } else if (inst.ready) {
    await inst.ready;
  }
  const grp = inst.group || inst.root || inst;
  return {
    group: grp,
    raw: inst,
    isFallback: true,
    playAction: (clipName) => inst.playClip?.(clipName) || inst.playAction?.(clipName),
    update: (dt) => inst.update?.(dt),
  };
}

// Sculpted 3D evolutionary accessories (Prop, Sunglasses, Cuff-Tuck Rings & P06 Wings)
// used ONLY if activeHeroV9 is the fallback AnnyV7; when anny-hero-v9.js is active, V9 handles its own rig!
function rebuildFallbackHeroAccessories(pheno) {
  clearGroup(l1AddonDecorGroup);
  if (!activeHeroV9 || !activeHeroV9.isFallback) return;

  const brassMat = new THREE.MeshStandardMaterial({ color: '#e0b46a', roughness: 0.25, metalness: 0.85 });
  const cuffMat = new THREE.MeshStandardMaterial({
    color: pheno.cuffHex,
    emissive: pheno.cuffHex,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });

  // Cuff-tuck bands at wrists
  for (const sx of [-0.23, 0.23]) {
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.015, 8, 16), cuffMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(sx, 0.88, 0.06);
    l1AddonDecorGroup.add(cuff);
  }

  if (pheno.glasses) {
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.018, 0.02), brassMat);
    bridge.position.set(0, 1.59, 0.11);
    const lensMat = new THREE.MeshStandardMaterial({ color: '#0c1624', roughness: 0.12, metalness: 0.7 });
    const lL = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.032, 0.015), lensMat);
    lL.position.set(-0.034, 1.59, 0.115);
    const lR = lL.clone();
    lR.position.x = 0.034;
    l1AddonDecorGroup.add(bridge, lL, lR);
  }

  // Carried prop in right hand
  const propGroup = new THREE.Group();
  propGroup.position.set(0.28, 0.82, 0.16);
  if (pheno.prop === 'camera') {
    const camBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.15, 0.16),
      new THREE.MeshStandardMaterial({ color: '#4a2918', roughness: 0.52 })
    );
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.08, 14), brassMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.11;
    propGroup.add(camBox, lens);
  } else if (pheno.prop === 'jerikan') {
    const can = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.26, 0.12),
      new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 0.65, roughness: 0.28 })
    );
    propGroup.add(can);
  } else if (pheno.prop === 'lantern') {
    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.08, 0.20, 8),
      new THREE.MeshStandardMaterial({ color: '#ffe4a8', emissive: '#ffaa38', emissiveIntensity: 1.8 })
    );
    propGroup.add(lantern);
  } else {
    const parcel = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.16, 0.18),
      new THREE.MeshStandardMaterial({ color: '#c49b6c', roughness: 0.78 })
    );
    propGroup.add(parcel);
  }
  l1AddonDecorGroup.add(propGroup);

  if (pheno.wings && pheno.wings !== 'off') {
    const basePath = new URL('../hero-build/assets/', import.meta.url).href;
    const wingFile = pheno.wings === 'raven'
      ? 'wings/04.props.ravens-stumps__p01.png'
      : 'wings/08.cast.angel.wings.png';
    const wTex = texLoader.load(basePath + wingFile);
    wTex.colorSpace = THREE.SRGBColorSpace;
    const wMat = new THREE.MeshStandardMaterial({
      map: wTex,
      color: pheno.wings === 'marble' ? '#eae4d7' : '#ffffff',
      transparent: true,
      alphaTest: 0.12,
      side: THREE.DoubleSide,
      roughness: 0.42,
    });
    const span = pheno.wings === 'folded' ? 0.56 : 1.05;
    const wL = new THREE.Mesh(new THREE.PlaneGeometry(span, 0.86), wMat);
    wL.position.set(-0.42 * span - 0.08, 1.36, -0.14);
    wL.rotation.y = pheno.wings === 'folded' ? 0.48 : 0.18;
    const wR = new THREE.Mesh(new THREE.PlaneGeometry(span, 0.86), wMat);
    wR.scale.x = -1;
    wR.position.set(0.42 * span + 0.08, 1.36, -0.14);
    wR.rotation.y = pheno.wings === 'folded' ? -0.48 : -0.18;
    l1AddonDecorGroup.add(wL, wR);
  }
}

async function initL1HeroAndCast() {
  buildL1StagePlinth();
  await tryLoadHeroModules();

  const shot = SHOTS[state.shotIndex] || SHOTS[0];
  const pheno = state.heroPhenotype;

  // 1. Primary V9 Poet Hero (1.72 m) at (-0.18, 0, HERO_STAGE_Z)
  if (heroV9Module?.createHeroOrCastV9) {
    try {
      activeHeroV9 = await heroV9Module.createHeroOrCastV9({
        THREE,
        loader: gltfLoader,
        role: 'poet_hero',
        archetype: 'adult_m',
        wingsMode: pheno.wings,
        glasses: pheno.glasses,
        prop: pheno.prop,
        groundY: 0,
        seed: state.heroSeed,
      });
      const grp = activeHeroV9?.group || activeHeroV9?.root || activeHeroV9;
      if (grp) {
        grp.position.set(-0.18, 0, HERO_STAGE_Z);
        l1HeroAnchor.add(grp);
      }
    } catch (err) {
      console.warn('V9 Poet Hero fallback:', err);
    }
  }
  if (!activeHeroV9) {
    activeHeroV9 = await buildFallbackAnnyHero('poet_hero');
    if (activeHeroV9?.group) {
      activeHeroV9.group.position.set(-0.18, 0, HERO_STAGE_Z);
      l1HeroAnchor.add(activeHeroV9.group);
    }
  }

  // 2. 31-Part Articulated Cutout Rig Twin (1.72 m) at (+0.95, 0, HERO_STAGE_Z - 0.92)
  if (cutout31Module?.createArticulated31CutoutRig) {
    try {
      activeCutout31 = await cutout31Module.createArticulated31CutoutRig({
        THREE,
        variant: 'poet_tracksuit_31',
        showBrassPivots: true,
        wingsMode: pheno.wings,
        glasses: pheno.glasses,
        prop: pheno.prop,
        groundY: 0,
      });
      const cGrp = activeCutout31?.group || activeCutout31?.root || activeCutout31;
      if (cGrp) {
        cGrp.position.set(0.95, 0, HERO_STAGE_Z - 0.92);
        cGrp.rotation.y = -0.18;
        l1CutoutAnchor.add(cGrp);
      }
    } catch (err) {
      console.warn('31-Part Cutout fallback:', err);
    }
  }
  if (!activeCutout31) {
    activeCutout31 = buildFallbackCutoutRig();
    activeCutout31.group.position.set(0.95, 0, HERO_STAGE_Z - 0.92);
    activeCutout31.group.rotation.y = -0.18;
    l1CutoutAnchor.add(activeCutout31.group);
  }

  // 3. Secondary Cast Companion (Imani / Bekele at z = +1.35 m -> 8.25 m from camera, inside L1 3..12 m!)
  if (heroV9Module?.createHeroOrCastV9) {
    try {
      activeCastV9 = await heroV9Module.createHeroOrCastV9({
        THREE,
        loader: gltfLoader,
        role: 'imani',
        seed: state.heroSeed + 17,
      });
      const castGrp = activeCastV9?.group || activeCastV9?.root || activeCastV9;
      if (castGrp) {
        castGrp.position.set(-1.38, 0, 1.35);
        castGrp.rotation.y = 0.42;
        l1CastAnchor.add(castGrp);
        activeCastV9.playAction?.('listen', 0.25);
      }
    } catch {
      // Optional secondary cast
    }
  }
  if (!activeCastV9) {
    activeCastV9 = await buildFallbackAnnyHero('imani');
    if (activeCastV9?.group) {
      activeCastV9.group.position.set(-1.38, 0, 1.35);
      activeCastV9.group.rotation.y = 0.42;
      l1CastAnchor.add(activeCastV9.group);
      activeCastV9.playAction?.('listen');
    }
  }

  applyPhenotypeToRigs(shot, state.heroPhenotype);
}

function hexStrToInt(hex, fallback = 0x24304a) {
  const n = parseInt(String(hex || '').replace(/^#/, ''), 16);
  return Number.isFinite(n) ? n : fallback;
}

function applyPhenotypeToRigs(shot, pheno) {
  const bgLum = shot?.refMeta?.lum ?? 0.28;
  const seedVal = state.heroSeed + (shot?.index || 0) * 37 + pheno.gen * 101;

  if (activeHeroV9) {
    if (heroV9Module?.evolveHeroPhenotype && !activeHeroV9.isFallback) {
      try {
        heroV9Module.evolveHeroPhenotype(activeHeroV9, {
          poem: shot?.poem || '01',
          shotKind: pheno.clipName,
          seed: seedVal,
          generation: pheno.gen,
          bgLuminance: bgLum,
          lookTargetVec3: new THREE.Vector3(0, 1.62, CAM_LOCKED_POS.z),
        });
      } catch {
        // Apply explicit setters below as well
      }
    }
    // Apply our explicit co-evolved phenotype controls so UI/JSON/3D always agree
    activeHeroV9.applyCoatColors?.(
      hexStrToInt(pheno.coatHex, 0x24304a),
      hexStrToInt(pheno.trimHex, 0x18b4ff),
      hexStrToInt(pheno.cuffHex, 0xe0b46a),
      bgLum < 0.42 ? 'high-key-on-dark' : 'obsidian-on-light'
    );
    activeHeroV9.setGlasses?.(pheno.glasses);
    activeHeroV9.setProp?.(pheno.prop);
    activeHeroV9.setWingsMode?.(pheno.wings);
    activeHeroV9.playAction?.(pheno.clipName, 0.28);
    if (activeHeroV9.setMoveSpeed) {
      activeHeroV9.setMoveSpeed(pheno.motion === 'walk' || pheno.motion === 'carry' ? 1.25 : 0.0);
    }
    if (activeHeroV9.raw?.setCoatColors) {
      activeHeroV9.raw.setCoatColors(pheno.coatHex, pheno.trimHex);
    }
  }

  if (activeCutout31) {
    if (cutout31Module?.evolveCutoutPhenotype && !activeCutout31.isFallback) {
      try {
        cutout31Module.evolveCutoutPhenotype(activeCutout31, {
          poem: shot?.poem || '01',
          shotKind: pheno.motion,
          seed: seedVal,
          bgLuminance: bgLum,
        });
      } catch {
        // Explicit setters below
      }
    }
    activeCutout31.applyTintAndTrim?.(
      bgLum < 0.42 ? 0xffffff : 0xebe6dc,
      hexStrToInt(pheno.trimHex, 0x18b4ff)
    );
    activeCutout31.setGlasses?.(pheno.glasses);
    activeCutout31.setProp?.(pheno.prop);
    activeCutout31.setWingsMode?.(pheno.wings);
    activeCutout31.playAction?.(pheno.clipName);
  }

  rebuildFallbackHeroAccessories(pheno);

  // Sync L1 visibility mode (0: Both V9 + Cutout Twin, 1: V9 Only, 2: Cutout Only)
  l1HeroAnchor.visible = state.l1Variant !== 2;
  l1CutoutAnchor.visible = state.l1Variant !== 1;
}

function advanceHeroGeneration(announce = true) {
  const shot = SHOTS[state.shotIndex] || SHOTS[0];
  state.heroGen += 1;
  state.heroPhenotype = computeCoEvolvedPhenotype(shot, state.heroGen, state.heroSeed);
  applyPhenotypeToRigs(shot, state.heroPhenotype);
  evolutionPulse = 1.0;

  savePilotState({
    seed: state.heroSeed + state.heroGen,
    parcelHolder: state.heroPhenotype.prop === 'parcel' ? 'player' : 'bekele',
  });
  syncExportDrawerUI();

  if (announce) {
    const p = state.heroPhenotype;
    showTransientWhisper(
      new THREE.Vector3(-0.15, 1.92, HERO_STAGE_Z),
      `Hero Evolved -> Gen ${p.gen} | ${p.coatName} | ${p.wings} wings | ${p.prop} | ${p.motionLabel} (Contrast ${p.contrastScore})`
    );
  }
}

// ---------------------------------------------------------------------------
// LEVEL L0 (0.8..3 m): Foreground Optical Occluder (Blurred by Live DoF)
// Placed at z = +7.3 .. +8.4 m (1.2 .. 2.3 m from camera at z = +9.6 m!)
// ---------------------------------------------------------------------------
function defaultL0ForPoem(poemStr) {
  const p = parseInt(poemStr || '01', 10) || 1;
  if (p === 1 || p === 6 || p === 8) return 0; // Iron fire-escape rail
  if (p === 2 || p === 7 || p === 14) return 1; // Severn timber doorjamb
  if (p === 3 || p === 4 || p === 5 || p === 12) return 2; // Shore pine & reeds
  return 3; // Wet rain-puddle coping & cyan grate
}

function rebuildL0ForegroundFrame() {
  clearGroup(levelGroups[0]);
  if (state.l0Variant === 4) return; // Open lens

  const ironMat = new THREE.MeshStandardMaterial({ color: '#1b2028', roughness: 0.45, metalness: 0.78 });
  const timberMat = new THREE.MeshStandardMaterial({ color: '#3b2619', roughness: 0.76, metalness: 0.06 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#d8aa5e', roughness: 0.28, metalness: 0.84 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: '#1f3d2f', roughness: 0.84 });
  const cyanGlow = new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 1.2 });

  if (state.l0Variant === 0) {
    // Wrought-Iron Fire-Escape Rail & Upper Catwalk Treads (1.65 m in front of lens, outer edges only!)
    const railGroup = new THREE.Group();
    railGroup.position.set(0, 0, 7.95);
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 2.8, 10), ironMat);
    postL.position.set(-1.32, 1.55, 0);
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.045, 0.06), ironMat);
    topBar.position.set(0, 2.42, 0);
    railGroup.add(postL, topBar);
    for (let x = -1.25; x <= 1.25; x += 0.25) {
      if (Math.abs(x) < 0.75) continue; // Keep center sightline completely clear
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.42, 0.022), ironMat);
      slat.position.set(x, 2.22, 0);
      railGroup.add(slat);
    }
    levelGroups[0].add(railGroup);
  } else if (state.l0Variant === 1) {
    // Weathered Severn Timber Doorjamb & Brass Latch (z = 8.05 m -> 1.55 m from camera)
    const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.1, 0.26), timberMat);
    jambL.position.set(-1.36, 1.5, 8.05);
    const jambR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.1, 0.26), timberMat);
    jambR.position.set(1.36, 1.5, 8.05);
    const header = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.24, 0.28), timberMat);
    header.position.set(0, 2.46, 8.05);
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.08), brassMat);
    latch.position.set(-1.24, 1.38, 8.05);
    levelGroups[0].add(jambL, jambR, header, latch);
  } else if (state.l0Variant === 2) {
    // Overhanging Shore Pine Boughs & Coastal Reeds (z = 7.85 m -> 1.75 m from camera)
    for (let i = 0; i < 7; i++) {
      const bough = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.78, 6), foliageMat);
      bough.rotation.z = (i < 4 ? -1 : 1) * 1.15;
      bough.position.set(i < 4 ? -1.25 + i * 0.14 : 1.25 - (i - 4) * 0.14, 2.26 - (i % 2) * 0.14, 7.85);
      levelGroups[0].add(bough);
    }
  } else if (state.l0Variant === 3) {
    // Grounded Curbside Rain Puddle Mirror & Flanking Iron Drain Grates (z = 7.45 m -> 2.15 m from camera, y = 0.015 m)
    for (const sx of [-1.42, 1.42]) {
      const puddle = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, 20),
        new THREE.MeshStandardMaterial({ color: '#16283d', roughness: 0.05, metalness: 0.88 })
      );
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(sx, 0.012, 7.45);
      const grate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.32), ironMat);
      grate.position.set(sx, 0.018, 7.75);
      const cyanSlit = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.03), cyanGlow);
      cyanSlit.position.set(sx, 0.032, 7.75);
      levelGroups[0].add(puddle, grate, cyanSlit);
    }
  }
}

// ---------------------------------------------------------------------------
// DIEGETIC IN-WORLD CONTROLS (Zero Overlaid HTML Grids!)
// 1. Left Wing: 3D Revolving Contact-Sheet Easel (All 60 Inverse Shots!)
// 2. Stage Apron: 5 Physical 3D Depth-Level Stakes / Lenses (L4..L0)
// 3. Right Wing: 3D Multi-Pass Darkroom Dispersion Prism
// 4. Far-Right Curb: 8x10 Brass Tripod + Stone Portals (shader-suite-bar.js)
// ---------------------------------------------------------------------------
let easelDrumGroup = null;
const easelPlateMaterials = [];
const easelFrameMeshes = [];
const stakeLensMaterials = [];
let darkroomPrismCrystal = null;
let targetEaselAngle = 0;

function makeEngravedPlaqueTexture(title, sub, accentHex = '#18b4ff', w = 256, h = 96) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#121c2c';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#e0b46a';
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.fillStyle = accentHex;
  ctx.fillRect(8, 8, 6, h - 16);

  ctx.fillStyle = '#f6f0e2';
  ctx.font = '700 26px Georgia, serif';
  ctx.fillText(title, 22, 42);
  ctx.fillStyle = '#a8d8f0';
  ctx.font = '600 17px ui-monospace, monospace';
  ctx.fillText(sub, 22, 74);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMiniShotCardTexture(shot, idx) {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 104;
  const ctx = c.getContext('2d');
  const cols = shot?.palette?.colors || ['#14243b', '#2e557c', '#6c8aa6', '#9a8470', '#d2a27e', '#f0e6d8'];
  const horY = Math.round(104 * (shot?.cam?.hor ?? 0.4));

  const gTop = ctx.createLinearGradient(0, 0, 0, Math.max(8, horY));
  gTop.addColorStop(0, cols[0]);
  gTop.addColorStop(1, cols[4]);
  ctx.fillStyle = gTop;
  ctx.fillRect(0, 0, 160, horY);

  const gBot = ctx.createLinearGradient(0, horY, 0, 104);
  gBot.addColorStop(0, cols[3]);
  gBot.addColorStop(1, cols[1]);
  ctx.fillStyle = gBot;
  ctx.fillRect(0, horY, 160, 104 - horY);

  ctx.strokeStyle = '#18b4ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, horY);
  ctx.lineTo(160, horY);
  ctx.stroke();

  ctx.fillStyle = 'rgba(7, 14, 24, 0.78)';
  ctx.fillRect(0, 76, 160, 28);
  ctx.fillStyle = '#f4eedd';
  ctx.font = '700 15px ui-monospace, monospace';
  ctx.fillText(`${String(idx + 1).padStart(2, '0')} P${shot.poem} ${shot.world}`, 6, 95);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  // Stream real wygwyl reference thumbnail onto the 3D contact-sheet plate gently in batches
  setTimeout(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 160, 78);
      ctx.strokeStyle = '#18b4ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, horY * 0.75);
      ctx.lineTo(160, horY * 0.75);
      ctx.stroke();
      tex.needsUpdate = true;
    };
    img.src = shot.refMeta?.refUrl || '';
  }, 60 + idx * 35);

  return tex;
}

function buildDiegeticApparatuses() {
  const walnutMat = new THREE.MeshStandardMaterial({ color: '#452817', roughness: 0.56, metalness: 0.1 });
  const ironMat = new THREE.MeshStandardMaterial({ color: '#1c222b', roughness: 0.46, metalness: 0.74 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#e0b46a', roughness: 0.26, metalness: 0.86 });
  const activeCyanFrameMat = new THREE.MeshStandardMaterial({
    color: '#18b4ff',
    emissive: '#18b4ff',
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });

  // -------------------------------------------------------------------------
  // 1. LEFT WING: 3D Revolving Contact-Sheet Easel (All 60 Inverse Shots!)
  // Positioned at x = -2.08 m, y = 0, z = +5.45 m, angled toward the camera
  // -------------------------------------------------------------------------
  const easelRoot = new THREE.Group();
  easelRoot.position.set(-2.08, 0, 5.45);
  easelRoot.rotation.y = 0.46;
  diegeticGroup.add(easelRoot);

  // Tri-legged walnut & iron floor easel frame
  for (const lx of [-0.46, 0.46]) {
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.82, 0.065), walnutMat);
    upright.position.set(lx, 0.91, 0);
    upright.castShadow = true;
    easelRoot.add(upright);
  }
  const easelCrown = new THREE.Mesh(
    new THREE.BoxGeometry(1.04, 0.14, 0.08),
    new THREE.MeshStandardMaterial({
      map: makeEngravedPlaqueTexture('60 INVERSE SHOTS', 'CLICK PLATE OR WHEEL', '#18b4ff', 320, 80),
      roughness: 0.38,
    })
  );
  easelCrown.position.set(0, 1.84, 0.04);
  easelRoot.add(easelCrown);

  // 5-Sided Revolving Lantern Drum (5 faces x 12 plates/face = 60 physical 3D miniature plates!)
  easelDrumGroup = new THREE.Group();
  easelDrumGroup.position.set(0, 1.12, 0);
  easelRoot.add(easelDrumGroup);

  const drumCore = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 1.16, 10), ironMat);
  easelDrumGroup.add(drumCore);

  const faceRadius = 0.335;
  for (let face = 0; face < 5; face++) {
    const faceAngle = (face / 5) * Math.PI * 2;
    const facePivot = new THREE.Group();
    facePivot.rotation.y = faceAngle;
    easelDrumGroup.add(facePivot);

    // 3 cols x 4 rows = 12 plates per face * 5 faces = all 60 Inverse Foundry shots!
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const shotIdx = face * 12 + r * 3 + c;
        const shot = SHOTS[shotIdx];
        if (!shot) continue;

        const px = (c - 1) * 0.245;
        const py = (1.5 - r) * 0.255;

        const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(0.228, 0.225, 0.018), brassMat);
        frameMesh.position.set(px, py, faceRadius);
        facePivot.add(frameMesh);
        easelFrameMeshes[shotIdx] = { mesh: frameMesh, brassMat, activeCyanFrameMat };

        const plateMat = new THREE.MeshBasicMaterial({ map: makeMiniShotCardTexture(shot, shotIdx) });
        easelPlateMaterials[shotIdx] = plateMat;
        const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.206, 0.198), plateMat);
        plateMesh.position.set(px, py, faceRadius + 0.011);
        facePivot.add(plateMesh);

        registerInteractive(plateMesh, {
          kind: 'shot-plate',
          shotIndex: shotIdx,
          anchor: new THREE.Vector3(-2.08, 1.98, 5.45),
          getWhisper: () =>
            `Shot ${shotIdx + 1}/60 · ${shot.id} (Poem ${shot.poem}: ${shot.poemTitle}) — click to stage`,
        });
      }
    }
  }

  // Brass Revolve Handwheel on right upright of the Easel (rotates to next 12-shot face)
  const easelWheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 10, 24), brassMat);
  easelWheel.rotation.y = Math.PI / 2;
  easelWheel.position.set(0.54, 1.12, 0.08);
  easelRoot.add(easelWheel);
  const wheelHit = registerInteractive(
    new THREE.Mesh(new THREE.SphereGeometry(0.20, 10, 10), hitInvisibleMat),
    {
      kind: 'easel-spin',
      anchor: new THREE.Vector3(-1.62, 1.38, 5.3),
      getWhisper: () => `Revolve 60-Shot Contact Drum (or press , / . to step shots)`,
    }
  );
  wheelHit.position.copy(easelWheel.position);
  easelRoot.add(wheelHit);

  // -------------------------------------------------------------------------
  // 2. STAGE APRON: 5 Physical 3D Depth-Level Stakes / Optical Lenses (L4..L0)
  // Low surveyor stakes along z = +6.18 m so Hero at z = +3.8 m is 100% unobstructed!
  // -------------------------------------------------------------------------
  const stakeDefs = [
    { level: 4, code: 'L4', range: '>180m', name: 'Sky & Ref Plate', color: '#7ce8ff', x: -0.96 },
    { level: 3, code: 'L3', range: '50-180m', name: 'Grown Massing', color: '#42d6a4', x: -0.48 },
    { level: 2, code: 'L2', range: '12-50m', name: 'Lit Interior', color: '#ffae52', x: 0.0 },
    { level: 1, code: 'L1', range: '3-12m', name: 'Evolve Hero', color: '#18b4ff', x: 0.48 },
    { level: 0, code: 'L0', range: '0.8-3m', name: 'Optical Frame', color: '#e084ff', x: 0.96 },
  ];

  stakeDefs.forEach((sd) => {
    const sGrp = new THREE.Group();
    sGrp.position.set(sd.x, 0, 6.18);
    diegeticGroup.add(sGrp);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.135, 0.06, 16), brassMat);
    plinth.position.y = 0.03;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.30, 12), ironMat);
    post.position.y = 0.20;

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.016, 10, 24), brassMat);
    ring.position.set(0, 0.41, 0);

    const lensMat = new THREE.MeshStandardMaterial({
      color: sd.color,
      emissive: sd.color,
      emissiveIntensity: 0.95,
      roughness: 0.12,
      metalness: 0.25,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    });
    stakeLensMaterials[sd.level] = lensMat;
    const lensDisc = new THREE.Mesh(new THREE.CircleGeometry(0.076, 20), lensMat);
    lensDisc.position.set(0, 0.41, 0);

    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.105),
      new THREE.MeshStandardMaterial({
        map: makeEngravedPlaqueTexture(sd.code, sd.range, sd.color, 192, 84),
        roughness: 0.35,
      })
    );
    plaque.position.set(0, 0.17, 0.038);
    plaque.rotation.x = -0.22;

    sGrp.add(plinth, post, ring, lensDisc, plaque);

    const hit = registerInteractive(
      new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.56, 0.26), hitInvisibleMat),
      {
        kind: 'depth-stake',
        level: sd.level,
        name: sd.name,
        code: sd.code,
        anchor: new THREE.Vector3(sd.x, 0.62, 6.18),
        getWhisper: () => {
          const soloTxt = state.soloLevel === sd.level ? ' [SOLO]' : '';
          return `${sd.code} (${sd.range}) · ${sd.name}${soloTxt} — click mutate · shift+click solo`;
        },
      }
    );
    hit.position.y = 0.28;
    sGrp.add(hit);
  });

  // -------------------------------------------------------------------------
  // 3. RIGHT WING: 3D Multi-Pass Darkroom Dispersion Prism on Brass Bench
  // Positioned at x = +2.06 m, y = 0, z = +5.50 m, angled toward camera
  // -------------------------------------------------------------------------
  const prismRoot = new THREE.Group();
  prismRoot.position.set(2.06, 0, 5.50);
  prismRoot.rotation.y = -0.44;
  diegeticGroup.add(prismRoot);

  const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.10, 20), brassMat);
  pedBase.position.y = 0.05;
  const pedCol = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.92, 16), walnutMat);
  pedCol.position.y = 0.54;
  pedCol.castShadow = true;
  const goniometer = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.23, 0.06, 24), brassMat);
  goniometer.position.y = 1.02;

  // Equilateral Optical Dispersion Prism (3-sided glass column + internal spectral core)
  darkroomPrismCrystal = new THREE.Group();
  darkroomPrismCrystal.position.y = 1.28;

  const glassOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.44, 3),
    new THREE.MeshStandardMaterial({
      color: '#bfefff',
      emissive: '#18b4ff',
      emissiveIntensity: 0.52,
      roughness: 0.08,
      metalness: 0.32,
      transparent: true,
      opacity: 0.80,
    })
  );
  const spectralCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.11, 0),
    new THREE.MeshStandardMaterial({
      color: '#ffcf70',
      emissive: '#ff8a3d',
      emissiveIntensity: 1.4,
      roughness: 0.15,
    })
  );
  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 3), brassMat);
  topCap.position.y = 0.23;
  const botCap = topCap.clone();
  botCap.position.y = -0.23;
  darkroomPrismCrystal.add(glassOuter, spectralCore, topCap, botCap);

  const prismPlaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.14),
    new THREE.MeshStandardMaterial({
      map: makeEngravedPlaqueTexture('DARKROOM PRISM', 'WEAVE / DEPTH / NOTAN / 4-UP', '#ffcf70', 320, 96),
      roughness: 0.35,
    })
  );
  prismPlaque.position.set(0, 0.88, 0.16);
  prismPlaque.rotation.x = -0.18;

  prismRoot.add(pedBase, pedCol, goniometer, darkroomPrismCrystal, prismPlaque);

  const prismHit = registerInteractive(
    new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.92, 0.56), hitInvisibleMat),
    {
      kind: 'darkroom-prism',
      anchor: new THREE.Vector3(2.06, 1.66, 5.50),
      getWhisper: () =>
        `Darkroom Prism · Pass ${state.darkroomPass + 1}/4: ${PASS_NAMES[state.darkroomPass]} — click to cycle (Tab exports PNG + JSON)`,
    }
  );
  prismHit.position.y = 1.24;
  prismRoot.add(prismHit);
}

// 4. Shared 8x10 Brass Tripod (23 GPU Shaders + Expose Plate) & Stone Portals
const portalRig = createWorldPortalAndTripod({
  THREE,
  scene,
  camera,
  domElement: renderer.domElement,
  suite,
  tripodPos: { x: 3.65, y: 0, z: 4.65, rotY: -0.62 },
  portals: [
    { id: 'foundry', label: 'Foundry + Inverse Tomology', href: '../foundry/', pos: { x: -9.2, y: 0, z: 5.2 }, rotY: 1.15 },
    { id: 'stage', label: 'P06-S01 Atlantis Stage', href: '../stage/', pos: { x: 9.2, y: 0, z: 5.2 }, rotY: -1.15 },
  ],
});

// ---------------------------------------------------------------------------
// Applying an Inverse Shot Across All 5 Levels + Camera Horizon Lock
// ---------------------------------------------------------------------------
function lockCameraToShot(shot) {
  const fov = THREE.MathUtils.clamp(Number(shot?.cam?.fov) || 50, 36, 64);
  camera.fov = fov;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // Horizon lock: screenY fraction hor (0=top, 1=bottom) -> NDC y = 1 - 2*hor
  const hor = THREE.MathUtils.clamp(Number(shot?.cam?.hor ?? 0.38), 0.22, 0.66);
  const ndcHor = 1.0 - 2.0 * hor;
  const halfFovRad = THREE.MathUtils.degToRad(fov * 0.5);
  const pitchRad = -Math.atan(ndcHor * Math.tan(halfFovRad));

  camera.position.copy(CAM_LOCKED_POS);
  camera.rotation.set(pitchRad, 0, 0);
  state.cameraMode = 'locked';
  state.orbitYaw = 0;
  state.orbitPitch = pitchRad;
  state.orbitDist = CAM_LOCKED_POS.z - HERO_STAGE_Z;
  suite.setFocus(CAM_LOCKED_POS.z - HERO_STAGE_Z, true);
}

function updateEaselHighlight() {
  easelFrameMeshes.forEach((entry, idx) => {
    if (!entry) return;
    entry.mesh.material = idx === state.shotIndex ? entry.activeCyanFrameMat : entry.brassMat;
  });
  const faceIdx = Math.floor(state.shotIndex / 12) % 5;
  state.easelFaceOffset = faceIdx;
  targetEaselAngle = -(faceIdx / 5) * Math.PI * 2;
}

function syncSoloVisibility() {
  for (let lv = 0; lv <= 4; lv++) {
    const visible = state.soloLevel < 0 || state.soloLevel === lv;
    levelGroups[lv].visible = visible;
    if (stakeLensMaterials[lv]) {
      stakeLensMaterials[lv].emissiveIntensity =
        state.soloLevel === lv ? 2.1 : visible ? 0.95 : 0.15;
    }
  }
}

function selectInverseShot(nextIndex, announce = false) {
  const count = SHOTS.length;
  if (!count) return;
  state.shotIndex = ((nextIndex % count) + count) % count;
  const shot = SHOTS[state.shotIndex];

  state.l0Variant = defaultL0ForPoem(shot.poem);
  state.heroGen = 0;
  state.heroPhenotype = computeCoEvolvedPhenotype(shot, 0, state.heroSeed);

  lockCameraToShot(shot);
  rebuildL4SkyAndPlate(shot);
  rebuildL3GrownWorld(shot);
  rebuildL2Architecture();
  rebuildL0ForegroundFrame();
  applyPhenotypeToRigs(shot, state.heroPhenotype);
  updateEaselHighlight();
  syncSoloVisibility();

  savePilotState({
    poem: shot.poem,
    shot: shot.id,
    camera: {
      preset: 'inverse-locked',
      focalMm: Math.round(24 / Math.tan(THREE.MathUtils.degToRad((shot.cam?.fov || 50) * 0.5))),
      eyeHeightM: 1.58,
      pos: [CAM_LOCKED_POS.x, CAM_LOCKED_POS.y, CAM_LOCKED_POS.z],
      lookAt: [0, 1.58, HERO_STAGE_Z],
    },
  });

  syncExportDrawerUI();

  if (announce) {
    showTransientWhisper(
      new THREE.Vector3(-2.0, 1.98, 5.45),
      `Shot ${state.shotIndex + 1}/60 · ${shot.id} | Poem ${shot.poem} ${shot.poemTitle} | FOV ${shot.cam.fov} deg · Hor ${Math.round(shot.cam.hor * 100)}%`
    );
  }
}

// ---------------------------------------------------------------------------
// Diegetic Whisper & Pointer / Orbit / Keyboard Interaction
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let hoveredTarget = null;
let transientWhisper = null;
let isDragging = false;
let dragMoved = 0;
let downXY = { x: 0, y: 0 };

function showTransientWhisper(worldVec3, text, ms = 2400) {
  transientWhisper = {
    anchor: worldVec3.clone(),
    text,
    until: performance.now() + ms,
  };
}

function updateNdc(e) {
  const r = renderer.domElement.getBoundingClientRect();
  pointerNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}

function pickInteractive(e) {
  updateNdc(e);
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(interactiveMeshes, false);
  return hits.length > 0 ? hits[0].object.userData.invTarget : null;
}

function handleDepthStakeClick(level, shiftKey) {
  if (shiftKey) {
    state.soloLevel = state.soloLevel === level ? -1 : level;
    syncSoloVisibility();
    showTransientWhisper(
      new THREE.Vector3((level === 4 ? -0.96 : level === 3 ? -0.48 : level === 2 ? 0 : level === 1 ? 0.48 : 0.96), 0.65, 6.18),
      state.soloLevel === level ? `Soloed Level L${level}` : 'Restored All 5 Spatial Levels (L0..L4)'
    );
    syncExportDrawerUI();
    return;
  }

  const shot = SHOTS[state.shotIndex] || SHOTS[0];
  if (level === 4) {
    state.l4Variant = (state.l4Variant + 1) % 3;
    rebuildL4SkyAndPlate(shot);
    const names = ['Registered wygwyl Plate + Palette Sky', '360 Equirectangular + Palette Beacons', 'Panoptic Segmentation Plate'];
    showTransientWhisper(new THREE.Vector3(-0.96, 0.65, 6.18), `L4 (>180m): ${names[state.l4Variant]}`);
  } else if (level === 3) {
    state.l3Variant = (state.l3Variant + 1) % 3;
    rebuildL3GrownWorld(shot);
    const names = [
      `After Inverse Grown (${Math.round(shot.after * 100)}% match)`,
      `Before Sculpt Baseline (${Math.round(shot.before * 100)}% match)`,
      'Cyan Sightline Wireframe Massing',
    ];
    showTransientWhisper(new THREE.Vector3(-0.48, 0.65, 6.18), `L3 (50-180m): ${names[state.l3Variant]}`);
  } else if (level === 2) {
    state.l2Variant = (state.l2Variant + 1) % 3;
    if (state.l2Variant === 2) savePilotState({ doorOpen: false });
    else if (state.l2Variant === 0) savePilotState({ doorOpen: true });
    suite.audio?.playDoorTransition?.(state.l2Variant !== 2);
    rebuildL2Architecture();
    const names = ['Lit Severn Threshold (Doors Open)', 'Inverse-Tomology X-Ray Cutaway', 'Closed Storm Threshold (580 Hz)'];
    showTransientWhisper(new THREE.Vector3(0, 0.65, 6.18), `L2 (12-50m): ${names[state.l2Variant]}`);
  } else if (level === 1) {
    if (state.heroGen === 0 || state.l1Variant === 2) {
      state.l1Variant = (state.l1Variant + 1) % 3;
    }
    advanceHeroGeneration(false);
    const rigLabels = ['V9 Poet + Cutout Twin', 'Solo V9 Skinned Poet', 'Solo 31-Part Cutout'];
    showTransientWhisper(
      new THREE.Vector3(0.48, 0.65, 6.18),
      `L1 (3-12m): ${rigLabels[state.l1Variant]} · Gen ${state.heroPhenotype.gen}`
    );
  } else if (level === 0) {
    state.l0Variant = (state.l0Variant + 1) % 5;
    rebuildL0ForegroundFrame();
    const names = ['Iron Fire-Escape Rail', 'Severn Timber Doorjamb', 'Shore Pine & Reeds', 'Rain Puddle Sill', 'Open Unframed Lens'];
    showTransientWhisper(new THREE.Vector3(0.96, 0.65, 6.18), `L0 (0.8-3m): ${names[state.l0Variant]}`);
  }
  syncExportDrawerUI();
}

function cycleDarkroomPrism(explicitPass = null) {
  state.darkroomPass = explicitPass !== null ? explicitPass : (state.darkroomPass + 1) % 4;
  darkroomMat.uniforms.uPassMode.value = state.darkroomPass;
  showTransientWhisper(
    new THREE.Vector3(2.06, 1.66, 5.50),
    `Darkroom Pass ${state.darkroomPass + 1}/4: ${PASS_NAMES[state.darkroomPass]}`
  );
  syncExportDrawerUI();
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  isDragging = true;
  dragMoved = 0;
  downXY = { x: e.clientX, y: e.clientY };
});

window.addEventListener('pointermove', (e) => {
  if (isDragging) {
    const dx = e.clientX - downXY.x;
    const dy = e.clientY - downXY.y;
    dragMoved += Math.hypot(dx, dy);
    downXY = { x: e.clientX, y: e.clientY };
    if (dragMoved > 6) {
      state.cameraMode = 'free';
      state.orbitYaw -= dx * 0.0055;
      state.orbitPitch = THREE.MathUtils.clamp(state.orbitPitch - dy * 0.0045, -0.65, 0.35);
    }
    return;
  }
  hoveredTarget = pickInteractive(e);
  renderer.domElement.style.cursor = hoveredTarget ? 'pointer' : 'grab';
});

window.addEventListener('pointerup', (e) => {
  if (e.button !== 0) return;
  const wasClick = dragMoved <= 6;
  isDragging = false;
  if (!wasClick) return;

  const target = pickInteractive(e);
  if (!target) return;

  if (target.kind === 'shot-plate') {
    selectInverseShot(target.shotIndex, true);
  } else if (target.kind === 'easel-spin') {
    state.easelFaceOffset = (state.easelFaceOffset + 1) % 5;
    targetEaselAngle = -(state.easelFaceOffset / 5) * Math.PI * 2;
    selectInverseShot(state.easelFaceOffset * 12, true);
  } else if (target.kind === 'depth-stake') {
    handleDepthStakeClick(target.level, e.shiftKey);
  } else if (target.kind === 'darkroom-prism') {
    cycleDarkroomPrism();
  } else if (target.kind === 'hero-evolve' || target.kind === 'cutout-click') {
    advanceHeroGeneration(true);
  } else if (target.kind === 'l2-threshold') {
    handleDepthStakeClick(2, false);
  }
});

renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    state.cameraMode = 'free';
    state.orbitDist = THREE.MathUtils.clamp(state.orbitDist + e.deltaY * 0.006, 2.1, 18.0);
  },
  { passive: false }
);

const keysHeld = new Set();
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = document.activeElement?.tagName || '';
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

  keysHeld.add(e.code);
  if (e.key === ',') {
    e.preventDefault();
    selectInverseShot(state.shotIndex - 1, true);
  } else if (e.key === '.') {
    e.preventDefault();
    selectInverseShot(state.shotIndex + 1, true);
  } else if (e.key === 'p' || e.key === 'P') {
    cycleDarkroomPrism();
  } else if (e.key === 'g' || e.key === 'G') {
    advanceHeroGeneration(true);
  } else if (e.key === '0') {
    lockCameraToShot(SHOTS[state.shotIndex] || SHOTS[0]);
    showTransientWhisper(new THREE.Vector3(0, 1.85, HERO_STAGE_Z), 'Locked Camera to Inverse Shot Horizon & FOV');
  }
});

window.addEventListener('keyup', (e) => {
  keysHeld.delete(e.code);
});

subscribePilotState((nextPilot) => {
  const wantOpen = nextPilot.doorOpen !== false;
  if (wantOpen !== l2DoorOpen && state.l2Variant !== 1) {
    l2DoorOpen = wantOpen;
    if (severnBuiltRef) setThresholdDoor(severnBuiltRef, l2DoorOpen);
  }
});

// ---------------------------------------------------------------------------
// Tab-Only Raw Buffer & Structured Reference-Guided Prompt Export
// ---------------------------------------------------------------------------
const expShotTitle = $('exp-shot-title');
const expShotSummary = $('exp-shot-summary');
const expShotSelect = $('exp-shot-select');
const promptPreviewEl = $('prompt-json-preview');

SHOTS.forEach((s, idx) => {
  const opt = document.createElement('option');
  opt.value = String(idx);
  opt.textContent = `${String(idx + 1).padStart(2, '0')}/60 | ${s.id} | Poem ${s.poem} ${s.poemTitle} (${Math.round(s.before * 100)}%->${Math.round(s.after * 100)}%)`;
  expShotSelect.appendChild(opt);
});

expShotSelect.addEventListener('change', () => {
  selectInverseShot(Number(expShotSelect.value), true);
});

document.querySelectorAll('[data-pass-btn]').forEach((btn) => {
  btn.addEventListener('click', () => {
    cycleDarkroomPrism(Number(btn.getAttribute('data-pass-btn')));
  });
});

function buildStructuredPromptPayload() {
  const shot = SHOTS[state.shotIndex] || SHOTS[0];
  const p = state.heroPhenotype;
  const st = suite.getState();
  const lookObj = ALL_CITY_LOOKS.find((l) => l.id === st.lookId) || ALL_CITY_LOOKS[0];

  const promptString = [
    `Poem ${shot.poem} (${shot.poemTitle}) in ${shot.world}, ref ${shot.ref}: "${shot.poemLine}".`,
    `Foreground L0 (0.8-3m): optical framing blurred by f/1.8 DoF locked at ${(CAM_LOCKED_POS.z - HERO_STAGE_Z).toFixed(1)}m.`,
    `Subject L1 (3-12m): 1.72m WYGWYL Poet Hero (Gen ${p.gen}, ${p.coatName}, ${p.cuffLabel}, sunglasses ${p.glasses ? 'on' : 'off'}, carrying ${p.prop}, P06 wings ${p.wings}, ${p.motionLabel}) grounded on wet stone with eye-line locked to ${Math.round(shot.cam.hor * 100)}% horizon.`,
    `Midground L2 (12-50m): enterable Severn masonry threshold with lit tungsten interior rooms, #18b4ff cyan conduits, and wet-only rain puddle reflections.`,
    `Background L3 (50-180m): inverse-grown massing (${(shot.grown || []).join('; ') || 'sculpted sightline'}).`,
    `Horizon & Sky L4 (>180m): ${shot.palette?.name || 'district'} 6-color ramp (${(shot.palette?.colors || []).join(', ')}) registered to wygwyl reference plate.`,
    `Style: ${lookObj.name} (${lookObj.id}), ${shot.cam.fov}deg FOV.`,
  ].join(' ');

  return {
    schema: 'make-photo-inverse-shot-v1',
    shotIndex: state.shotIndex + 1,
    shotId: shot.id,
    world: shot.world,
    ref: shot.ref,
    poem: {
      number: shot.poem,
      title: shot.poemTitle,
      line: shot.poemLine,
      place: shot.poemPlace,
    },
    camera: {
      fovDeg: shot.cam.fov,
      horizonFractionFromTop: shot.cam.hor,
      headingDeg: shot.cam.hd,
      focusDistanceM: Number((CAM_LOCKED_POS.z - HERO_STAGE_Z).toFixed(2)),
      shaderLook: lookObj.id,
    },
    inverseOptimization: {
      matchBefore: shot.before,
      matchAfter: shot.after,
      grownOperations: shot.grown,
    },
    levels: {
      L4_farSkyAndPlate: { rangeM: '>180', refUrl: shot.refMeta?.refUrl, palette: shot.palette?.colors, variant: state.l4Variant },
      L3_grownMassingAndWater: { rangeM: '50..180', operations: shot.grown, variant: state.l3Variant },
      L2_thresholdAndRooms: { rangeM: '12..50', building: 'severn', doorOpen: l2DoorOpen, variant: state.l2Variant },
      L1_coEvolvedHero: { rangeM: '3..12', heightM: 1.72, phenotype: p, rigMode: state.l1Variant },
      L0_foregroundOccluder: { rangeM: '0.8..3', dofBlurred: true, variant: state.l0Variant },
    },
    referenceGuidedPrompt: promptString,
  };
}

function syncExportDrawerUI() {
  const shot = SHOTS[state.shotIndex];
  if (!shot || !expShotTitle) return;
  expShotSelect.value = String(state.shotIndex);
  expShotTitle.textContent = `Shot ${String(state.shotIndex + 1).padStart(2, '0')}/60 | ${shot.id} (${PASS_NAMES[state.darkroomPass]})`;
  expShotSummary.textContent =
    `Poem ${shot.poem} "${shot.poemTitle}" | FOV ${shot.cam.fov} deg | Hor ${Math.round(shot.cam.hor * 100)}% | Match ${Math.round(shot.before * 100)}% -> ${Math.round(shot.after * 100)}% | Hero Gen ${state.heroPhenotype.gen} (Contrast ${state.heroPhenotype.contrastScore})`;
  promptPreviewEl.textContent = JSON.stringify(buildStructuredPromptPayload(), null, 2);
}

function triggerDownload(dataUrlOrBlobUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrlOrBlobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function flashShutter() {
  if (!flashEl) return;
  flashEl.style.opacity = '0.78';
  setTimeout(() => {
    flashEl.style.opacity = '0';
  }, 150);
}

$('btn-export-pack')?.addEventListener('click', () => {
  const shot = SHOTS[state.shotIndex] || SHOTS[0];
  const prevPass = state.darkroomPass;
  const suffixes = ['1_final_weave', '2_metric_depth', '3_notan_canny', '4_control_sheet_4up'];
  flashShutter();
  suite.audio?.playShutter?.();

  suffixes.forEach((suf, passIdx) => {
    state.darkroomPass = passIdx;
    darkroomMat.uniforms.uPassMode.value = passIdx;
    renderFramePass();
    const pngUrl = renderer.domElement.toDataURL('image/png');
    triggerDownload(pngUrl, `${shot.id}_${suf}.png`);
  });

  state.darkroomPass = prevPass;
  darkroomMat.uniforms.uPassMode.value = prevPass;
  renderFramePass();
});

$('btn-export-json')?.addEventListener('click', () => {
  const payload = buildStructuredPromptPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${payload.shotId}_prompt_control.json`);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
});

$('btn-copy-json')?.addEventListener('click', () => {
  const txt = JSON.stringify(buildStructuredPromptPayload(), null, 2);
  navigator.clipboard?.writeText(txt).catch(() => {});
});

// ---------------------------------------------------------------------------
// Resize & Main Animation / Multi-Pass Render Loop
// ---------------------------------------------------------------------------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  suite.pipeline.setSize(w, h);
  const pr = renderer.getPixelRatio();
  weaveCompositeRT.setSize(Math.max(2, Math.floor(w * pr)), Math.max(2, Math.floor(h * pr)));
  darkroomMat.uniforms.uRes.value.set(Math.floor(w * pr), Math.floor(h * pr));
}
window.addEventListener('resize', onResize);

function renderFramePass() {
  darkroomMat.uniforms.uNear.value = camera.near;
  darkroomMat.uniforms.uFar.value = camera.far;

  if (state.darkroomPass === 0) {
    suite.render(scene, camera);
    return;
  }

  // First run CityShaderPipeline so suite.pipeline.rt (color + hardware depth) AND postScene are up to date
  suite.render(scene, camera);

  if (state.darkroomPass === 3) {
    // Capture the styled WEAVE post-process output into weaveCompositeRT for the 4-Up top-right quadrant
    renderer.setRenderTarget(weaveCompositeRT);
    renderer.render(suite.pipeline.postScene, suite.pipeline.postCam);
    renderer.setRenderTarget(null);
  }

  darkroomMat.uniforms.tSceneRaw.value = suite.pipeline.rt.texture;
  darkroomMat.uniforms.tDepth.value = suite.pipeline.rt.depthTexture;
  darkroomMat.uniforms.uPassMode.value = state.darkroomPass;
  renderer.setRenderTarget(null);
  renderer.render(darkroomPostScene, darkroomPostCam);
}

let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
  lastTime = now;
  const tSec = now * 0.001;

  skyUniforms.uTime.value = tSec;
  if (l3WaterUniforms) l3WaterUniforms.uTime.value = tSec;

  // Smoothly revolve 60-shot Contact-Sheet Easel drum
  if (easelDrumGroup) {
    easelDrumGroup.rotation.y += (targetEaselAngle - easelDrumGroup.rotation.y) * Math.min(1, dt * 8.0);
  }

  // Smoothly orient Multi-Pass Darkroom Prism to active facet + gentle optical float
  if (darkroomPrismCrystal) {
    const targetPrismYaw = state.darkroomPass * (Math.PI * 0.5);
    darkroomPrismCrystal.rotation.y += (targetPrismYaw - darkroomPrismCrystal.rotation.y) * Math.min(1, dt * 7.5);
    darkroomPrismCrystal.position.y = 1.28 + Math.sin(tSec * 1.8) * 0.015;
  }

  // Evolutionary plinth cyan/gold pulse
  if (evolutionPulse > 0.001 && plinthRingMat) {
    evolutionPulse = Math.max(0, evolutionPulse - dt * 1.4);
    plinthRingMat.emissiveIntensity = 1.25 + evolutionPulse * 2.8;
  }

  // Optional WASD / Orbit free inspection
  if (keysHeld.has('KeyW') || keysHeld.has('KeyS') || keysHeld.has('KeyA') || keysHeld.has('KeyD')) {
    state.cameraMode = 'free';
    const spd = (keysHeld.has('ShiftLeft') ? 6.5 : 3.2) * dt;
    if (keysHeld.has('KeyW')) state.orbitDist = Math.max(2.0, state.orbitDist - spd);
    if (keysHeld.has('KeyS')) state.orbitDist = Math.min(18.0, state.orbitDist + spd);
    if (keysHeld.has('KeyA')) state.orbitYaw -= spd * 0.35;
    if (keysHeld.has('KeyD')) state.orbitYaw += spd * 0.35;
  }

  if (state.cameraMode === 'free') {
    const cx = state.orbitTarget.x + Math.sin(state.orbitYaw) * Math.cos(state.orbitPitch) * state.orbitDist;
    const cy = Math.max(0.45, state.orbitTarget.y - Math.sin(state.orbitPitch) * state.orbitDist + 0.35);
    const cz = state.orbitTarget.z + Math.cos(state.orbitYaw) * Math.cos(state.orbitPitch) * state.orbitDist;
    camera.position.set(cx, cy, cz);
    camera.lookAt(state.orbitTarget);
    suite.setFocus(camera.position.distanceTo(state.orbitTarget), true);
  }

  // Update V9 Poet Hero, 31-Part Cutout Twin & Secondary Cast biomechanics + eye gaze toward camera
  const heroOpts = {
    lookTargetVec3: camera.position,
    autoLocomotion: false,
    moveSpeed: state.heroPhenotype.motion === 'walk' || state.heroPhenotype.motion === 'carry' ? 1.25 : 0.0,
    turnRate: 0.0,
    speaking: false,
    wingFlapBoost: state.heroPhenotype.motion === 'wing-glide' ? 1.45 : 0.35,
  };
  activeHeroV9?.update?.(dt, heroOpts);
  activeCutout31?.update?.(dt, heroOpts);
  activeCastV9?.update?.(dt, {
    lookTargetVec3: new THREE.Vector3(-0.18, 1.55, HERO_STAGE_Z),
    autoLocomotion: false,
    moveSpeed: 0,
  });

  portalRig.update(camera.position);

  // Project 1-line unboxed world whisper ONLY on hover or transient click action
  let whAnchor = null;
  let whText = '';
  if (transientWhisper && now < transientWhisper.until) {
    whAnchor = transientWhisper.anchor;
    whText = transientWhisper.text;
  } else {
    transientWhisper = null;
    if (hoveredTarget) {
      whAnchor = hoveredTarget.anchor;
      whText = hoveredTarget.getWhisper();
    }
  }

  if (whAnchor && whText && whisperEl) {
    const prj = projectWorldLabel(camera, whAnchor, renderer.domElement);
    if (prj.visible) {
      whisperEl.textContent = whText;
      whisperEl.style.left = `${Math.round(prj.x)}px`;
      whisperEl.style.top = `${Math.round(prj.y - 8)}px`;
      whisperEl.style.display = 'block';
    } else {
      whisperEl.style.display = 'none';
    }
  } else if (whisperEl) {
    whisperEl.style.display = 'none';
  }

  renderFramePass();
}

// Boot world
buildDiegeticApparatuses();
selectInverseShot(state.shotIndex, false);
onResize();
initL1HeroAndCast();
requestAnimationFrame(animate);

if (typeof window !== 'undefined') {
  window.__inverseForge = {
    getState: () => ({
      shotIndex: state.shotIndex,
      shotId: SHOTS[state.shotIndex]?.id,
      shotCount: SHOTS.length,
      darkroomPass: state.darkroomPass,
      passName: PASS_NAMES[state.darkroomPass],
      soloLevel: state.soloLevel,
      heroGen: state.heroGen,
      heroPhenotype: state.heroPhenotype,
      l0Variant: state.l0Variant,
      l1Variant: state.l1Variant,
      l2Variant: state.l2Variant,
      l3Variant: state.l3Variant,
      l4Variant: state.l4Variant,
      heroLoaded: Boolean(activeHeroV9 && !activeHeroV9.isFallback),
      cutoutLoaded: Boolean(activeCutout31 && !activeCutout31.isFallback),
    }),
    selectShot: (idx) => selectInverseShot(idx, true),
    evolveHero: () => advanceHeroGeneration(true),
    setPass: (p) => cycleDarkroomPrism(p),
    getHeroBones: () => activeHeroV9?.getWorldBonePositions?.() || null,
    getCutoutBones: () => activeCutout31?.getWorldBonePositions?.() || null,
    getPromptPayload: buildStructuredPromptPayload,
  };
}
