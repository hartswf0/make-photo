import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ALL_CITY_LOOKS } from '../shaders.js';
import { mountWebGLShaderSuite, projectWorldLabel } from '../shader-suite-bar.js';

// Zero-dependency damped spherical Orbit + Pan + Dolly controller (vendor/three/addons has no OrbitControls.js)
class StageOrbitControls {
  constructor(cam, dom) {
    this.camera = cam;
    this.domElement = dom;
    this.target = new THREE.Vector3(0, 1.55, -10.5);
    this.minDistance = 1.2;
    this.maxDistance = 42.0;
    this.enableDamping = true;
    this.dampingFactor = 0.12;
    this._sph = new THREE.Spherical();
    this._sphTarget = new THREE.Spherical();
    this._panOffset = new THREE.Vector3();
    this._syncFromCamera();

    let mode = 0; // 0=none, 1=rotate, 2=pan
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
  formatPilotHash,
  deriveClockMapping,
} from '../design-room/pilot-state.js';

const NOLLI_STORAGE_KEY = 'make_photo_city_nolli_v1';
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let pilot = applyPilotUrlHash();

// ---------------------------------------------------------------------------
// Toast & Shared Nolli Light-Table Plate Writer
// ---------------------------------------------------------------------------
let toastTimer = 0;
function showToast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function savePlateToNolliLedger(dataUrl, label, shaderId) {
  try {
    const raw = localStorage.getItem(NOLLI_STORAGE_KEY);
    const ledger = raw ? JSON.parse(raw) : { plates: [] };
    if (!Array.isArray(ledger.plates)) ledger.plates = [];
    ledger.plates.push({
      id: 'plate_' + Date.now(),
      dataUrl,
      title: label,
      zone: shaderId || 'weave',
      cartridge: 'weave',
      public: true,
      ts: Date.now(),
    });
    if (ledger.plates.length > 9) ledger.plates = ledger.plates.slice(-9);
    localStorage.setItem(NOLLI_STORAGE_KEY, JSON.stringify(ledger));
    showToast('Plate exposed to shared Nolli Light Table (' + ledger.plates.length + ' saved)');
  } catch {
    showToast('Plate exposed');
  }
}

// ---------------------------------------------------------------------------
// 5-Bus Door-Coupled Spatial Audio & Freesound Foley Engine (Brief 8)
// Zero continuous synth oscillator drones; explicit user start + immediate mute
// ---------------------------------------------------------------------------
class WeaveAudioMixer {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.muted = Boolean(pilot.audioBuses?.muted);
    this.doorOpen = Boolean(pilot.doorOpen);
    this.speaking = false;
    this.buses = {};
    this.buffers = {};
    this.ambientNodes = {};
    this.doorFilter = null;
    this.reverbSend = null;
  }

  async ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0.0001 : 0.88;
      this.master.connect(this.ctx.destination);

      this.doorFilter = this.ctx.createBiquadFilter();
      this.doorFilter.type = 'lowpass';
      this.doorFilter.frequency.value = this.doorOpen ? 13500 : 580;

      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = this._buildRoomImpulse(1.25, 3.1);
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = this.doorOpen ? 0.08 : 0.28;
      this.convolver.connect(this.reverbSend);
      this.reverbSend.connect(this.master);

      for (const name of ['voice', 'closeAction', 'localAmbience', 'distantCity', 'music']) {
        const g = this.ctx.createGain();
        g.gain.value = pilot.audioBuses?.[name] ?? 0.5;
        if (name === 'distantCity' || name === 'localAmbience') {
          g.connect(this.doorFilter);
        } else {
          g.connect(this.master);
        }
        g.connect(this.convolver);
        this.buses[name] = g;
      }
      this.doorFilter.connect(this.master);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (!this.started) {
      this.started = true;
      await this._loadSamples();
      this._startEnvironmentalBeds();
    }
  }

  _buildRoomImpulse(sec, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * sec);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * 0.22;
      }
    }
    return buf;
  }

  async _loadSamples() {
    const files = {
      field: '../../audio/samples/ethiopia_field.mp3',
      gorge: '../../audio/samples/river_gorge.mp3',
      night: '../../audio/samples/crickets_night.mp3',
      step: '../../audio/samples/gravel_footsteps.mp3',
      pump: '../../audio/samples/metal_pump.mp3',
      pour: '../../audio/samples/water_pour.mp3',
    };
    await Promise.all(
      Object.entries(files).map(async ([k, url]) => {
        try {
          const r = await fetch(url);
          if (!r.ok) return;
          const ab = await r.arrayBuffer();
          this.buffers[k] = await this.ctx.decodeAudioData(ab);
        } catch {
          // Graceful offline skip
        }
      })
    );
  }

  _startEnvironmentalBeds() {
    const loopSample = (key, busName, baseGain, rate) => {
      const buf = this.buffers[key];
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = baseGain;
      src.connect(g);
      g.connect(this.buses[busName]);
      src.start(0);
      this.ambientNodes[key] = g;
    };
    loopSample('field', 'distantCity', 0.26, 0.96);
    loopSample('gorge', 'localAmbience', 0.16, 0.90);
    loopSample('night', 'localAmbience', 0.14, 1.0);
    this.syncAcoustics();
  }

  setBusGain(busName, val) {
    if (this.buses[busName] && this.ctx) {
      this.buses[busName].gain.setTargetAtTime(val, this.ctx.currentTime, 0.08);
    }
    this.syncAcoustics();
  }

  setDoorOpen(open) {
    this.doorOpen = open;
    this.syncAcoustics();
  }

  setSpeaking(isSpeaking, duckEnabled) {
    this.speaking = isSpeaking;
    this.duckEnabled = duckEnabled;
    this.syncAcoustics();
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0.0001 : 0.88, this.ctx.currentTime, 0.08);
    }
  }

  syncAcoustics() {
    if (!this.ctx || !this.doorFilter) return;
    const now = this.ctx.currentTime;
    const cutoff = this.doorOpen ? 13500 : 560;
    const rev = this.doorOpen ? 0.08 : 0.30;
    this.doorFilter.frequency.setTargetAtTime(cutoff, now, 0.18);
    this.reverbSend.gain.setTargetAtTime(rev, now, 0.18);

    const duckFactor = this.speaking && this.duckEnabled ? 0.35 : 1.0; // -9 dB duck under spoken line
    const baseDist = pilot.audioBuses?.distantCity ?? 0.36;
    if (this.buses.distantCity) {
      this.buses.distantCity.gain.setTargetAtTime(baseDist * duckFactor, now, 0.15);
    }
  }

  async triggerFoleyCell(cell) {
    await this.ensureContext();
    const mapKey = cell.sample.includes('water_pour')
      ? 'pour'
      : cell.sample.includes('gravel_footsteps')
      ? 'step'
      : cell.sample.includes('metal_pump')
      ? 'pump'
      : cell.sample.includes('crickets')
      ? 'night'
      : cell.sample.includes('ethiopia_field')
      ? 'field'
      : 'gorge';
    const buf = this.buffers[mapKey];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = cell.rate || 1.0;
    const g = this.ctx.createGain();
    g.gain.value = cell.gain || 0.25;
    const bus = cell.territory.startsWith('IN') ? this.buses.closeAction : cell.territory.startsWith('OFF') ? this.buses.localAmbience : this.buses.distantCity;
    src.connect(g);
    g.connect(bus || this.master);
    const maxDur = Math.min(cell.dur || 1.0, buf.duration);
    const offset = Math.random() * Math.max(0, buf.duration - maxDur - 0.05);
    src.start(0, offset, maxDur);
  }
}

const audioMixer = new WeaveAudioMixer();

// ---------------------------------------------------------------------------
// Scene, Renderer, Camera & Multiplane GLSL Depth-Slice Shader
// ---------------------------------------------------------------------------
const wrap = $('#stage-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0c1f38');
scene.fog = new THREE.FogExp2('#152a45', 0.0085);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.15, 180);
const controls = new StageOrbitControls(camera, renderer.domElement);

let externalSuite = null;
let activeLook = ALL_CITY_LOOKS.find((l) => l.id === (pilot.shader || 'weave')) || ALL_CITY_LOOKS[0];

// Sky Dome (Cobalt-Cerulean WEAVE standard vs Neutral Daylight Pass)
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uTop: { value: new THREE.Color('#0c1f38') },
    uMid: { value: new THREE.Color('#285a8a') },
    uHorizon: { value: new THREE.Color('#6b8fa9') },
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
      vec3 c = h < 0.30 ? mix(uHorizon, uMid, h / 0.30) : mix(uMid, uTop, (h - 0.30) / 0.70);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(140, 24, 16), skyMat));

// Lights
const hemiLight = new THREE.HemisphereLight('#c6def4', '#3b352e', 1.35);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#ffd8ad', 2.35);
sunLight.position.set(16, 26, 14);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 65;
sunLight.shadow.camera.left = -18;
sunLight.shadow.camera.right = 18;
sunLight.shadow.camera.top = 18;
sunLight.shadow.camera.bottom = -18;
scene.add(sunLight);

// Wet Reflective Ground & Curb Stage (y = 0)
function buildWetStageTextures() {
  const sz = 512;
  const col = document.createElement('canvas');
  col.width = col.height = sz;
  const ctx = col.getContext('2d');
  ctx.fillStyle = '#242930';
  ctx.fillRect(0, 0, sz, sz);
  for (let i = 0; i < 4500; i++) {
    const v = 30 + ((i * 37) % 24);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect((i * 97) % sz, (i * 53) % sz, 2, 2);
  }
  ctx.strokeStyle = 'rgba(10,13,18,0.45)';
  for (let g = 0; g < sz; g += 64) {
    ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, sz); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(sz, g); ctx.stroke();
  }

  const rough = document.createElement('canvas');
  rough.width = rough.height = sz;
  const rctx = rough.getContext('2d');
  rctx.fillStyle = '#cfcfcf';
  rctx.fillRect(0, 0, sz, sz);
  // Distinct wet puddle patches (Brief 4/7: restrict wet reflection to wet surfaces)
  const puddles = [[180, 310, 74], [340, 260, 62], [250, 390, 54]];
  for (const [px, py, rad] of puddles) {
    const grd = rctx.createRadialGradient(px, py, 4, px, py, rad);
    grd.addColorStop(0, '#181818');
    grd.addColorStop(0.7, '#454545');
    grd.addColorStop(1, 'rgba(207,207,207,0)');
    rctx.fillStyle = grd;
    rctx.beginPath(); rctx.arc(px, py, rad, 0, Math.PI * 2); rctx.fill();
  }
  const map = new THREE.CanvasTexture(col);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(8, 8);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(rough);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(8, 8);
  return { map, roughnessMap };
}

const stageTex = buildWetStageTextures();
const stageFloorMat = new THREE.MeshStandardMaterial({
  color: '#2c333d',
  map: stageTex.map,
  roughnessMap: stageTex.roughnessMap,
  roughness: 0.78,
  metalness: 0.14,
});
const stageFloor = new THREE.Mesh(new THREE.PlaneGeometry(54, 46), stageFloorMat);
stageFloor.rotation.x = -Math.PI / 2;
stageFloor.position.set(0, 0, -10);
stageFloor.receiveShadow = true;
scene.add(stageFloor);

// Selective Electric Cyan Puddle Reflection & Conduit Strip on Stage
const puddleCyanMat = new THREE.MeshStandardMaterial({
  color: '#123c52',
  emissive: '#18b4ff',
  emissiveIntensity: 0.85,
  roughness: 0.12,
  metalness: 0.35,
  transparent: true,
  opacity: 0.72,
});
const cyanPuddle = new THREE.Mesh(new THREE.CircleGeometry(1.45, 28), puddleCyanMat);
cyanPuddle.rotation.x = -Math.PI / 2;
cyanPuddle.position.set(-1.35, 0.012, -5.35);
scene.add(cyanPuddle);

const cyanConduit = new THREE.Mesh(
  new THREE.CylinderGeometry(0.045, 0.045, 9.6, 10),
  new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 1.35, roughness: 0.25 })
);
cyanConduit.rotation.z = Math.PI / 2;
cyanConduit.position.set(0, 0.045, -4.55);
scene.add(cyanConduit);

// ---------------------------------------------------------------------------
// Monumental Parabolic Relay Dish Silhouette (P4 Slot, z = -16.2m)
// ---------------------------------------------------------------------------
const dishGroup = new THREE.Group();
dishGroup.position.set(3.8, 0, -16.2);
const dishIronMat = new THREE.MeshStandardMaterial({ color: '#1b2838', roughness: 0.72, metalness: 0.38 });
const dishTower = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.15, 6.2, 10), dishIronMat);
dishTower.position.y = 3.1;
dishGroup.add(dishTower);

const dishHead = new THREE.Group();
dishHead.position.set(0, 6.5, 0);
dishHead.rotation.set(0.52, -0.36, 0.14);
const lathePts = [];
for (let i = 0; i <= 10; i++) {
  const u = i / 10;
  lathePts.push(new THREE.Vector2(u * 3.4, u * u * 1.08));
}
const dishBowl = new THREE.Mesh(
  new THREE.LatheGeometry(lathePts, 24),
  new THREE.MeshStandardMaterial({ color: '#223347', roughness: 0.62, metalness: 0.42, side: THREE.DoubleSide })
);
dishHead.add(dishBowl);
const dishFeed = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 2.2, 8), dishIronMat);
dishFeed.position.y = 1.1;
dishHead.add(dishFeed);
const dishBeacon = new THREE.Mesh(
  new THREE.SphereGeometry(0.18, 12, 10),
  new THREE.MeshStandardMaterial({ color: '#18b4ff', emissive: '#18b4ff', emissiveIntensity: 2.2 })
);
dishBeacon.position.y = 2.25;
dishHead.add(dishBeacon);
dishGroup.add(dishHead);
scene.add(dishGroup);

// ---------------------------------------------------------------------------
// Hybrid 3D Severn Threshold Set (Brief 3 & Brief 7: Solid Doorway, Steps, Handrail, Table)
// ---------------------------------------------------------------------------
const hybridSet = new THREE.Group();
hybridSet.position.set(1.15, 0, -6.25);
scene.add(hybridSet);

const stoneMasonryMat = new THREE.MeshStandardMaterial({ color: '#786858', roughness: 0.86, metalness: 0.04 });
const severnBrickRedMat = new THREE.MeshStandardMaterial({ color: '#7d3f34', roughness: 0.82, metalness: 0.05 });
const severnTrimTealMat = new THREE.MeshStandardMaterial({ color: '#275963', roughness: 0.54, metalness: 0.16 });
const brassRailMat = new THREE.MeshStandardMaterial({ color: '#c8a974', roughness: 0.32, metalness: 0.72 });
const paintedWoodDoorMat = new THREE.MeshStandardMaterial({ color: '#3b2820', roughness: 0.58, metalness: 0.08 });

// Curb & 2 Stone Stoop Steps
const stoopStep1 = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.16, 1.35), stoneMasonryMat);
stoopStep1.position.set(0, 0.08, 0.42);
stoopStep1.receiveShadow = true;
stoopStep1.castShadow = true;
hybridSet.add(stoopStep1);

const stoopStep2 = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.16, 0.88), stoneMasonryMat);
stoopStep2.position.set(0, 0.24, 0.16);
stoopStep2.receiveShadow = true;
stoopStep2.castShadow = true;
hybridSet.add(stoopStep2);

// Severn Brick Portal Jambs + Teal Transom Frame
const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.46, 2.75, 0.42), severnBrickRedMat);
jambL.position.set(-0.88, 1.375, -0.12);
jambL.castShadow = true;
hybridSet.add(jambL);

const jambR = new THREE.Mesh(new THREE.BoxGeometry(0.46, 2.75, 0.42), severnBrickRedMat);
jambR.position.set(0.88, 1.375, -0.12);
jambR.castShadow = true;
hybridSet.add(jambR);

const lintelTop = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.38, 0.48), severnTrimTealMat);
lintelTop.position.set(0, 2.86, -0.12);
lintelTop.castShadow = true;
hybridSet.add(lintelTop);

// Vestibule Backing Alcove so reverse angle and interior warm lamp have true architectural enclosure
const alcoveBack = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.9, 0.18), stoneMasonryMat);
alcoveBack.position.set(0, 1.45, -1.55);
hybridSet.add(alcoveBack);
const alcoveFloor = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.16, 1.5), stoneMasonryMat);
alcoveFloor.position.set(0, 0.24, -0.82);
hybridSet.add(alcoveFloor);

// Operable Severn Threshold Door (hinged at x = -0.64, z = -0.12)
const doorPivot = new THREE.Group();
doorPivot.position.set(-0.64, 0.32, -0.12);
const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.26, 2.32, 0.08), paintedWoodDoorMat);
doorLeaf.position.set(0.63, 1.16, 0);
doorLeaf.castShadow = true;
doorPivot.add(doorLeaf);
const doorHandle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), brassRailMat);
doorHandle.position.set(1.12, 1.05, 0.06);
doorPivot.add(doorHandle);
hybridSet.add(doorPivot);

// Warm Interior Vestibule Lamp (Brief 4: warm doorway is warm because of its interior lamp)
const doorwayLampBulb = new THREE.Mesh(
  new THREE.SphereGeometry(0.09, 12, 10),
  new THREE.MeshStandardMaterial({ color: '#ffdfad', emissive: '#ffae52', emissiveIntensity: 2.6 })
);
doorwayLampBulb.position.set(0, 2.48, -0.68);
hybridSet.add(doorwayLampBulb);

const doorwayWarmLight = new THREE.PointLight('#ffb969', 18.0, 9.5, 1.5);
doorwayWarmLight.position.set(0, 2.35, -0.55);
doorwayWarmLight.castShadow = true;
hybridSet.add(doorwayWarmLight);

// Solid Brass Stoop Handrail
const railPostA = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.92, 8), brassRailMat);
railPostA.position.set(-1.02, 0.62, 0.86);
const railPostB = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.92, 8), brassRailMat);
railPostB.position.set(-1.02, 0.78, 0.12);
const railBar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.88, 8), brassRailMat);
railBar.position.set(-1.02, 1.02, 0.49);
railBar.rotation.x = Math.atan2(0.16, 0.74) + Math.PI / 2;
hybridSet.add(railPostA, railPostB, railBar);

// Courier Side Table beside Stoop
const courierTable = new THREE.Group();
courierTable.position.set(1.48, 0, 0.55);
const tableTop = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 0.52), paintedWoodDoorMat);
tableTop.position.y = 0.76;
tableTop.castShadow = true;
courierTable.add(tableTop);
for (const [lx, lz] of [[-0.32, -0.2], [0.32, -0.2], [-0.32, 0.2], [0.32, 0.2]]) {
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.76, 6), brassRailMat);
  leg.position.set(lx, 0.38, lz);
  courierTable.add(leg);
}
hybridSet.add(courierTable);

// Shared Parcel Prop (Persists across tools via pilot.parcelHolder: 'player' | 'bekele' | 'table')
const parcelMesh = new THREE.Group();
const parcelBox = new THREE.Mesh(
  new THREE.BoxGeometry(0.30, 0.20, 0.24),
  new THREE.MeshStandardMaterial({ color: '#c79a62', roughness: 0.72 })
);
const parcelStrap = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.21, 0.04), severnTrimTealMat);
parcelMesh.add(parcelBox, parcelStrap);
scene.add(parcelMesh);

// ---------------------------------------------------------------------------
// Live 104-Bone Skinned Anny V8 Cast in P2 Multiplane Slot
// ---------------------------------------------------------------------------
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const cast = {
  courier: null,
  bekele: null,
};

function createCastActor({ id, archetype, coatHex, skinHex, pos, rotY }) {
  const root = new THREE.Group();
  root.position.set(...pos);
  root.rotation.y = rotY;

  // Grounded contact shadow disc (Brief 3 & 7: grounded feet & contact shadows)
  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 20),
    new THREE.MeshBasicMaterial({ color: '#05070a', transparent: true, opacity: 0.52, depthWrite: false })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.015;
  root.add(contactShadow);

  // Instant articulated proxy while GLB streams
  const proxy = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.25, 0.88, 12),
    new THREE.MeshStandardMaterial({ color: coatHex, roughness: 0.76 })
  );
  body.position.y = 1.06;
  body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 14, 12),
    new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.62 })
  );
  head.position.y = 1.63;
  head.castShadow = true;
  const legs = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.12, 0.64, 10),
    new THREE.MeshStandardMaterial({ color: '#1b2028', roughness: 0.85 })
  );
  legs.position.y = 0.32;
  proxy.add(body, head, legs);
  root.add(proxy);
  scene.add(root);

  const actor = { id, root, proxy, v8: null, clip: 'idle' };

  if (window.AnnyHumanV7 && window.AnnyHumanV7.createCharacter) {
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
        actor.v8 = inst;
        inst.setGroundY(0);
      })
      .catch(() => {});
  }
  return actor;
}

cast.courier = createCastActor({
  id: 'player',
  archetype: 'adult_f',
  coatHex: '#2c6294',
  skinHex: '#8d5b3e',
  pos: [-0.85, 0, -5.25],
  rotY: 0.65,
});

cast.bekele = createCastActor({
  id: 'bekele',
  archetype: 'adult_m',
  coatHex: '#9c623e',
  skinHex: '#734830',
  pos: [1.02, 0.32, -6.08],
  rotY: -0.52,
});

// ---------------------------------------------------------------------------
// Multiplane Registered Depth-Slice Shader (BG / MG / FG)
// ---------------------------------------------------------------------------
const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('anonymous');

function createBlankTex(hex = '#182436') {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const x = c.getContext('2d');
  x.fillStyle = hex;
  x.fillRect(0, 0, 16, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const blankColorTex = createBlankTex('#1a2a40');
const blankDepthTex = createBlankTex('#808080');

function createWeavePlaneMaterial(bandIndex) {
  // bandIndex: 0 = BG (far), 1 = MG (mid), 2 = FG (foreground occluder)
  return new THREE.ShaderMaterial({
    transparent: bandIndex > 0,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      tPhoto: { value: blankColorTex },
      tCel: { value: blankColorTex },
      tNotan: { value: blankColorTex },
      tDepth: { value: blankDepthTex },
      tSkyArchive: { value: blankColorTex },
      uBand: { value: bandIndex },
      uBgCut: { value: 0.34 },
      uFgCut: { value: 0.68 },
      uCelMix: { value: 0.55 },
      uNotanMix: { value: 0.22 },
      uSkyWipe: { value: 0.28 },
      uTime: { value: 0.0 },
      uNeutralPass: { value: 0.0 },
      uProvMode: { value: 0.0 },
      uProvFilter: { value: 0 }, // 0=all,1=recorded,2=checked,3=inferred,4=invented
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tPhoto;
      uniform sampler2D tCel;
      uniform sampler2D tNotan;
      uniform sampler2D tDepth;
      uniform sampler2D tSkyArchive;
      uniform int uBand;
      uniform float uBgCut;
      uniform float uFgCut;
      uniform float uCelMix;
      uniform float uNotanMix;
      uniform float uSkyWipe;
      uniform float uTime;
      uniform float uNeutralPass;
      uniform float uProvMode;
      uniform int uProvFilter;
      varying vec2 vUv;

      float hash12(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        // Depth in wygwyl shots/out/<id>/depth.jpg is Inferno perceptual-uniform disparity: luminance is strictly linear 0 (far) -> 1 (near)
        float d = dot(texture2D(tDepth, vUv).rgb, vec3(0.299, 0.587, 0.114));
        float alpha = 1.0;

        if (uBand == 1) {
          // Midground sheet: visible for d >= uBgCut and d < uFgCut + overlap
          float inFromBg = smoothstep(uBgCut - 0.04, uBgCut + 0.03, d);
          // Carve lower-center doorway slot slightly so solid 3D Severn doorway & actors breathe cleanly
          alpha = inFromBg;
          if (alpha < 0.04) discard;
        } else if (uBand == 2) {
          // Foreground occluder sheet (closer than P2 actors!)
          float inFg = smoothstep(uFgCut - 0.035, uFgCut + 0.035, d);
          // Keep foreground framing (sides/railing/steps) while keeping sky transparent
          float notSky = smoothstep(0.12, 0.24, d);
          alpha = inFg * notSky;
          if (alpha < 0.08) discard;
        }

        vec3 photo = texture2D(tPhoto, vUv).rgb;
        vec3 cel = texture2D(tCel, vUv).rgb;
        vec3 notan = texture2D(tNotan, vUv).rgb;

        vec3 col = mix(photo, cel, uCelMix);
        float notanLum = dot(notan, vec3(0.333));
        // Crisp Notan ink reinforcement on dark structural contours
        col = mix(col, col * (0.42 + 0.72 * notanLum), uNotanMix);

        // 1969 Archive Sky Torn-Paper Wipe on BG plane (WEAVE signature join!)
        if (uBand == 0 && uSkyWipe > 0.01 && uNeutralPass < 0.5) {
          float jag = (hash12(vec2(floor(vUv.x * 96.0), 7.0)) - 0.5) * 0.032 + sin(vUv.x * 19.0 + 1.3) * 0.014;
          float wipeLine = (1.0 - uSkyWipe * 0.62) + jag;
          float isFarSky = 1.0 - smoothstep(uBgCut - 0.06, uBgCut + 0.06, d);
          float aboveTear = smoothstep(wipeLine - 0.012, wipeLine + 0.008, vUv.y);
          float paperDeckle = smoothstep(0.018, 0.0, abs(vUv.y - wipeLine)) * isFarSky;
          vec3 archSky = texture2D(tSkyArchive, vUv).rgb * vec3(1.04, 0.96, 0.86);
          col = mix(col, archSky, aboveTear * isFarSky * 0.92);
          col = mix(col, vec3(0.95, 0.90, 0.79), paperDeckle * 0.85);
        }

        // Subtle cardboard cut-edge shadow on MG/FG silhouettes
        if (uBand > 0) {
          float edgeBand = smoothstep(0.08, 0.35, alpha) * (1.0 - smoothstep(0.35, 0.75, alpha));
          col = mix(col, vec3(0.07, 0.09, 0.14), edgeBand * 0.45);
        }

        if (uNeutralPass > 0.5) {
          // Neutral inspection pass: pure source photo + clean depth contour
          col = photo;
        }

        if (uProvMode > 0.5) {
          // Provenance tint: BG Photo=Recorded(teal), MG/FG=Inferred(amber), SkyWipe=Invented(rose)
          vec3 pTint = uBand == 0 ? vec3(0.37, 0.83, 0.75) : vec3(0.95, 0.65, 0.25);
          col = mix(col, pTint, 0.42);
        }

        if (uProvFilter == 2 || uProvFilter == 4) {
          // Dim inferred/recorded image planes when inspecting Checked or Invented 3D set alone
          col *= 0.28;
        }

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

const matBG = createWeavePlaneMaterial(0);
const matMG = createWeavePlaneMaterial(1);
const matFG = createWeavePlaneMaterial(2);

const planeRig = new THREE.Group();
scene.add(planeRig);

const meshBG = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matBG);
const meshMG = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matMG);
const meshFG = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matFG);
meshBG.renderOrder = 1;
meshMG.renderOrder = 2;
meshFG.renderOrder = 5;
planeRig.add(meshBG, meshMG, meshFG);

// Brass Supported Viewing Cone Rails (Brief 3 & Brief 7: mark supported viewing cone in authoring view)
const coneHelperGroup = new THREE.Group();
const coneLineMat = new THREE.LineBasicMaterial({ color: '#f2a541', transparent: true, opacity: 0.45 });
const coneGeo = new THREE.BufferGeometry();
coneHelperGroup.add(new THREE.LineSegments(coneGeo, coneLineMat));
scene.add(coneHelperGroup);

// ---------------------------------------------------------------------------
// Source Camera Registration & Viewing Cone Math
// ---------------------------------------------------------------------------
const sourceCamSpec = {
  pos: new THREE.Vector3(0, 1.65, 0.4),
  target: new THREE.Vector3(0, 1.55, -10.5),
  vFovDeg: 46,
  aspect: 16 / 9,
  maxLateralDeg: 18.0,
};

function registerPlanesToSourceCamera(shot) {
  const [imgW, imgH] = shot.size || [1456, 816];
  const aspect = imgW / Math.max(1, imgH);
  const focalPx = shot.camera?.focal_px || 1200;
  const vFovRad = 2 * Math.atan((imgH * 0.5) / focalPx);
  const vFovDeg = THREE.MathUtils.radToDeg(vFovRad);
  const camH = Math.max(1.15, Math.min(3.4, shot.camera?.height_m ?? 1.65));
  const pitchRad = THREE.MathUtils.degToRad(Math.max(-10, Math.min(10, shot.camera?.pitch_deg ?? -1.5)));

  sourceCamSpec.vFovDeg = THREE.MathUtils.clamp(vFovDeg, 32, 66);
  sourceCamSpec.aspect = aspect;
  sourceCamSpec.pos.set(0, camH, 0.4);
  const lookDist = 10.5;
  sourceCamSpec.target.set(0, camH + Math.sin(pitchRad) * lookDist, 0.4 - Math.cos(pitchRad) * lookDist);

  // Position planeRig at sourceCamSpec.pos oriented along source viewing ray so BG/MG/FG register cleanly!
  planeRig.position.copy(sourceCamSpec.pos);
  planeRig.lookAt(sourceCamSpec.target);

  const placeSheet = (mesh, dist) => {
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(sourceCamSpec.vFovDeg) * 0.5);
    const w = h * aspect;
    mesh.position.set(0, 0, -dist);
    mesh.rotation.set(0, Math.PI, 0); // face back toward source camera (+Z in rig local space, wait: lookAt points +Z toward target in Object3D! Let's check!)
    mesh.scale.set(w, h, 1);
  };

  // Note: Object3D.lookAt makes local +Z point toward target! Let's place sheets at +dist along local +Z facing -Z (toward origin)!
  const placeSheetRegistered = (mesh, dist) => {
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(sourceCamSpec.vFovDeg) * 0.5);
    const w = h * aspect;
    mesh.position.set(0, 0, dist);
    mesh.rotation.set(0, Math.PI, 0);
    mesh.scale.set(w, h, 1);
  };

  placeSheetRegistered(meshBG, 22.5);
  placeSheetRegistered(meshMG, 10.8);
  placeSheetRegistered(meshFG, 3.85);

  // Rebuild Supported Viewing Cone wireframe pyramid from sourceCamSpec.pos
  const rCone = 8.5;
  const halfAng = THREE.MathUtils.degToRad(sourceCamSpec.maxLateralDeg);
  const dx = Math.tan(halfAng) * rCone;
  const dy = dx / aspect;
  const p0 = sourceCamSpec.pos;
  const cCenter = p0.clone().add(new THREE.Vector3(0, 0, -rCone));
  const corners = [
    cCenter.clone().add(new THREE.Vector3(-dx, dy, 0)),
    cCenter.clone().add(new THREE.Vector3(dx, dy, 0)),
    cCenter.clone().add(new THREE.Vector3(dx, -dy, 0)),
    cCenter.clone().add(new THREE.Vector3(-dx, -dy, 0)),
  ];
  const segs = [];
  for (let i = 0; i < 4; i++) {
    segs.push(p0.x, p0.y, p0.z, corners[i].x, corners[i].y, corners[i].z);
    const nxt = corners[(i + 1) % 4];
    segs.push(corners[i].x, corners[i].y, corners[i].z, nxt.x, nxt.y, nxt.z);
  }
  coneGeo.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
}

let cameraMode = 'source'; // 'source' | 'reverse' | 'exploded'

function recoverSourceCamera() {
  cameraMode = 'source';
  $('#btn-reverse-angle').classList.remove('on');
  $('#btn-explode').classList.remove('on');
  camera.fov = sourceCamSpec.vFovDeg;
  camera.updateProjectionMatrix();
  camera.position.copy(sourceCamSpec.pos);
  controls.target.copy(sourceCamSpec.target);
  controls.syncImmediate();
}

function toggleReverseAngle() {
  if (cameraMode === 'reverse') {
    recoverSourceCamera();
    return;
  }
  cameraMode = 'reverse';
  $('#btn-reverse-angle').classList.add('on');
  $('#btn-explode').classList.remove('on');
  // Place camera inside Severn Vestibule looking back out through doorway across actors & parcel
  camera.fov = 52;
  camera.updateProjectionMatrix();
  camera.position.set(1.12, 1.68, -7.45);
  controls.target.set(-0.25, 1.35, -4.6);
  controls.syncImmediate();
  showToast('Reverse Angle: Severn Vestibule looking out across threshold');
}

function toggleExplodeStack() {
  if (cameraMode === 'exploded') {
    recoverSourceCamera();
    return;
  }
  cameraMode = 'exploded';
  $('#btn-explode').classList.add('on');
  $('#btn-reverse-angle').classList.remove('on');
  camera.fov = 48;
  camera.updateProjectionMatrix();
  camera.position.set(11.8, 5.8, 4.2);
  controls.target.set(0.4, 1.8, -9.8);
  controls.syncImmediate();
  showToast('Exploded Multiplane View: P5 BG, P4 Dish, P3 MG, P2 Hybrid 3D, P0-P1 FG');
}

// ---------------------------------------------------------------------------
// Catalog Loading & Texture Swapping (100% HTTP-200 Verified Assets)
// ---------------------------------------------------------------------------
let weaveCatalog = { passages: [], shots: [] };
let worldScoreData = null;
let activeEntry = null;
const texCache = new Map();

function loadTexCached(url, isData = false) {
  if (texCache.has(url)) return Promise.resolve(texCache.get(url));
  return new Promise((resolve) => {
    texLoader.load(
      url,
      (tex) => {
        if (!isData) tex.colorSpace = THREE.SRGBColorSpace;
        texCache.set(url, tex);
        resolve(tex);
      },
      undefined,
      () => resolve(isData ? blankDepthTex : blankColorTex)
    );
  });
}

async function selectEntryByKey(key) {
  let shot = null;
  let passage = null;
  if (key.startsWith('passage:')) {
    const pid = key.slice('passage:'.length);
    passage = weaveCatalog.passages.find((p) => p.id === pid) || weaveCatalog.passages[0];
    shot = weaveCatalog.shots.find((s) => s.id === passage.urls.shotPairId) || weaveCatalog.shots[0];
  } else {
    shot = weaveCatalog.shots.find((s) => s.id === key) || weaveCatalog.shots[0];
  }
  if (!shot) return;
  activeEntry = { key, shot, passage };

  $('#scene-title').textContent = passage ? passage.title : `${shot.district.toUpperCase()} · ${shot.title}`;
  $('#scene-caption').textContent = passage
    ? passage.about
    : `${shot.camera.shot_class} · ${shot.camera.focal_35mm_equiv}mm lens · ${shot.multiplane.planes.length} multiplane sheets + Severn Hybrid 3D`;
  $('#lbl-cam-lens').textContent = `${shot.camera.focal_35mm_equiv || 35}MM`;

  registerPlanesToSourceCamera(shot);
  recoverSourceCamera();

  const skyUrl = passage?.urls?.skyArchive || weaveCatalog.passages[0]?.urls?.skyArchive || shot.urls.image;
  const photoUrl = passage?.urls?.plate || shot.urls.image;

  const [tPhoto, tCel, tNotan, tDepth, tSky] = await Promise.all([
    loadTexCached(photoUrl, false),
    loadTexCached(shot.urls.cel, false),
    loadTexCached(shot.urls.notan, false),
    loadTexCached(shot.urls.depth, true),
    loadTexCached(skyUrl, false),
  ]);

  for (const m of [matBG, matMG, matFG]) {
    m.uniforms.tPhoto.value = tPhoto;
    m.uniforms.tCel.value = tCel;
    m.uniforms.tNotan.value = tNotan;
    m.uniforms.tDepth.value = tDepth;
    m.uniforms.tSkyArchive.value = tSky;
  }

  // Update 3-Up Compare reference images
  $('#cmp-img-orig').src = photoUrl;
  $('#cmp-img-weave').src = shot.urls.cel;

  renderLedgerAndPlanesUI();
  renderSpineStripUI();
  syncActiveWingPlates();
}

// ---------------------------------------------------------------------------
// Provenance Ledger & Multiplane Stack Inspector UI
// ---------------------------------------------------------------------------
let provFilter = pilot.provenanceFilter || 'all';
const PROV_NORM = {
  OBSERVED: 'recorded',
  RECORDED: 'recorded',
  CHECKED: 'checked',
  DRAWN: 'checked',
  INFERRED: 'inferred',
  RETOUCHED: 'inferred',
  INVENTED: 'invented',
  'CHARACTER BELIEF': 'invented',
  BELIEF: 'invented',
};

function getCombinedLedger() {
  if (!activeEntry) return [];
  const base = [
    ['RECORDED', `Source frame (${activeEntry.shot.size.join('x')}px) & poet suite clock.`],
    ['CHECKED', `Ground horizon y=0.0m, 1.70m Anny V8 scale, Severn stoop clearance & door swing.`],
    ['INFERRED', `DepthPro metric depth bands & ${activeEntry.shot.multiplane.planes.length} multiplane parallax sheets.`],
    ['INVENTED', `Hybrid 3D Severn doorway, operable door lamp, brass parcel handoff & relay dish.`],
  ];
  if (activeEntry.passage?.ledger) {
    return [...activeEntry.passage.ledger, ...base.slice(1, 3)];
  }
  return base;
}

function renderLedgerAndPlanesUI() {
  const listEl = $('#ledger-list');
  const items = getCombinedLedger().filter(([tag]) => {
    if (provFilter === 'all') return true;
    return (PROV_NORM[tag] || 'inferred') === provFilter;
  });

  listEl.innerHTML = items
    .map(([tag, desc]) => {
      const shortTag = tag.includes('BELIEF') ? 'BELIEF' : tag;
      return `<div class="ledger-item">
        <span class="prov-tag prov-${shortTag}">${shortTag}</span>
        <span>${desc}</span>
      </div>`;
    })
    .join('');

  const pColors = { P0: '#9aa0ab', P1: '#c49a6c', P2: '#5fd4c0', P3: '#f2a541', P4: '#5b8def', P5: '#8fb8f0', P6: '#a6e3f0' };
  const planes = activeEntry?.shot?.multiplane?.planes || [];
  $('#lbl-sheet-count').textContent = `${planes.length || 6} Planes`;
  $('#planes-list').innerHTML = planes
    .map((p) => {
      const isP2 = p.id === 'P2';
      const detail = isP2
        ? 'Live 3D Anny V8 Cast + Severn Doorway + Wet Puddles'
        : p.contents?.length
        ? p.contents.join(', ')
        : 'Registered depth slice';
      const zStr = isP2 ? '6.2m' : p.z_median_m != null ? `${p.z_median_m}m` : '22.5m';
      return `<div class="plane-row">
        <span class="plane-id" style="background:${pColors[p.id] || '#8fb8f0'}">${p.id}</span>
        <div>
          <div style="font-weight:600;color:var(--ink)">${p.name}</div>
          <div style="color:var(--dim);font-size:9.5px">${detail}</div>
        </div>
        <div style="font:600 9.5px var(--mono);color:var(--brass);text-align:right">${zStr}<br>x${p.parallax ?? '1.0'}</div>
      </div>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Spine-Cut 4-Row Strip (#spine) & Tightened World Score (#worldscore)
// ---------------------------------------------------------------------------
function renderSpineStripUI() {
  const container = $('#spine-rows');
  if (!container || !weaveCatalog.shots.length) return;
  const shots = weaveCatalog.shots.slice(0, 10);
  const rows = [
    { label: '1 · Archive Source', urlKey: 'image', shaderHint: 'natural' },
    { label: '2 · WEAVE Blend', urlKey: 'exploded', shaderHint: 'weave' },
    { label: '3 · Cel / Notan', urlKey: 'cel', shaderHint: 'woodblock' },
    { label: '4 · Live 3D Shader', urlKey: 'planeMap', shaderHint: 'jerikan' },
  ];

  container.innerHTML = rows
    .map((row) => {
      const cards = shots
        .map((s) => {
          const isCur = activeEntry?.shot?.id === s.id;
          return `<div class="spine-card ${isCur ? 'on' : ''}" data-sid="${s.id}" data-shader="${row.shaderHint}">
            <img src="${s.urls[row.urlKey]}" alt="${s.title}" loading="lazy">
            <span>${s.district} · ${s.title.slice(0, 18)}</span>
          </div>`;
        })
        .join('');
      return `<div class="spine-row">
        <div class="spine-lbl">${row.label}</div>
        <div class="spine-strip">${cards}</div>
      </div>`;
    })
    .join('');

  container.querySelectorAll('.spine-card').forEach((el) => {
    el.addEventListener('click', () => {
      const sid = el.dataset.sid;
      const sh = el.dataset.shader;
      $('#shot-select').value = sid;
      selectEntryByKey(sid);
      if (sh) applyShaderById(sh);
    });
  });
}

function renderFoleyPadsUI() {
  const grid = $('#foley-grid');
  if (!grid || !worldScoreData?.foleyCells) return;
  grid.innerHTML = worldScoreData.foleyCells
    .map(
      (c, i) => `<button class="foley-pad" data-fidx="${i}">
        <div class="foley-code"><span>#${c.code}</span><span style="color:var(--teal)">${c.territory.split(' ')[0]}</span></div>
        <div style="font-weight:600;font-size:10.5px;margin-top:2px;">${c.family}</div>
        <div class="foley-law">${c.law}</div>
      </button>`
    )
    .join('');

  grid.querySelectorAll('.foley-pad').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const cell = worldScoreData.foleyCells[Number(btn.dataset.fidx)];
      if (!cell) return;
      btn.classList.add('active');
      setTimeout(() => btn.classList.remove('active'), 420);
      await audioMixer.triggerFoleyCell(cell);
      showToast(`Auditioned #${cell.code} (${cell.territory})`);
    });
  });
}

const scoreState = {
  playing: false,
  sec: Number(pilot.perfClockSec || 0),
  duration: 1440.0,
  rules: { beds: true, hits: true, ghosts: true, duck: true },
};

function drawWorldScoreCanvas() {
  const cv = $('#worldscore-canvas');
  if (!cv || !worldScoreData) return;
  const ctx = cv.getContext('2d');
  const w = cv.width;
  const h = cv.height;
  ctx.fillStyle = '#06080c';
  ctx.fillRect(0, 0, w, h);

  const poemIdx = Math.max(0, Math.min(13, parseInt(pilot.poem || '01', 10) - 1));
  const sc = worldScoreData.script?.[poemIdx] || { num: '01', title: 'Out of Life', t0: 0, t1: 98 };
  const poem = worldScoreData.poems?.[poemIdx] || { num: '01', title: 'Out of Life', lines: [] };
  const pDur = Math.max(10, (sc.t1 || 98) - (sc.t0 || 0));
  const localT = ((scoreState.sec - (sc.t0 || 0)) % pDur + pDur) % pDur;

  const trackH = h / 4;
  const labels = [
    ['1 · READING VOICE', '#f2a541'],
    ['2 · SCENE BEDS (-9dB DUCK)', '#5fd4c0'],
    ['3 · CUE HITS (POST-LINE)', '#bce868'],
    ['4 · CODEX CALL-RESPONSE', '#df7ca2'],
  ];

  labels.forEach(([txt, col], idx) => {
    const y0 = idx * trackH;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = '600 9.5px ui-monospace, monospace';
    ctx.fillText(txt, 8, y0 + 12);
  });

  let activeLine = poem.lines[0];
  let speakingNow = false;

  poem.lines.forEach((ln, idx) => {
    const [r0, r1] = ln.read || [idx * 6, idx * 6 + 4.2];
    const x0 = (r0 / pDur) * w;
    const bw = Math.max(4, ((r1 - r0) / pDur) * w);

    // Track 1: Spoken Reading bar
    ctx.fillStyle = 'rgba(242, 165, 65, 0.78)';
    ctx.fillRect(x0, 16, bw, trackH - 20);

    // Track 2: Ducking Scene Bed envelope
    if (scoreState.rules.beds) {
      const bedH = scoreState.rules.duck ? 6 : 14;
      ctx.fillStyle = 'rgba(95, 212, 192, 0.42)';
      ctx.fillRect(x0, trackH + (trackH - bedH - 4), bw, bedH);
      // Full bed between lines
      const nextR0 = poem.lines[idx + 1]?.read?.[0] ?? pDur;
      if (nextR0 > r1) {
        const gx0 = (r1 / pDur) * w;
        const gw = ((nextR0 - r1) / pDur) * w;
        ctx.fillStyle = 'rgba(95, 212, 192, 0.72)';
        ctx.fillRect(gx0, trackH + 14, gw, trackH - 18);
      }
    }

    // Track 3: Cue Hit immediately AFTER spoken line (never covering voice!)
    if (scoreState.rules.hits) {
      const hx = ((r1 + 0.18) / pDur) * w;
      ctx.fillStyle = '#bce868';
      ctx.fillRect(hx, trackH * 2 + 12, 3.5, trackH - 16);
    }

    // Track 4: Sung Codex Response in rest gap after line
    if (scoreState.rules.ghosts) {
      const gx = ((r1 + 0.45) / pDur) * w;
      ctx.fillStyle = 'rgba(223, 124, 162, 0.80)';
      ctx.fillRect(gx, trackH * 3 + 15, Math.min(26, bw * 0.45), trackH - 20);
    }

    if (localT >= r0 && localT <= r1) {
      activeLine = ln;
      speakingNow = true;
    }
  });

  audioMixer.setSpeaking(speakingNow, scoreState.rules.duck);

  // Playhead
  const px = (localT / pDur) * w;
  ctx.fillStyle = '#18b4ff';
  ctx.fillRect(px - 1, 0, 2.5, h);

  if (activeLine) {
    $('#spoken-line-text').textContent = `"${activeLine.text}"`;
    $('#spoken-line-meta').textContent = `POEM ${poem.num} · F0 ${activeLine.f0}HZ · DELAY 0.00`;
  }
  const mm = String(Math.floor(scoreState.sec / 60)).padStart(2, '0');
  const ss = String(Math.floor(scoreState.sec % 60)).padStart(2, '0');
  $('#score-tc').textContent = `${mm}:${ss} / 24:00`;
}

// ---------------------------------------------------------------------------
// Severn Pilot State Synchronization & Encounter Animatic (Brief 3 & Brief 9)
// ---------------------------------------------------------------------------
let encounterAnim = {
  active: false,
  t: 0,
};

function applyShaderById(shaderId) {
  const found = ALL_CITY_LOOKS.find((l) => l.id === shaderId);
  if (!found) return;
  activeLook = found;
  if (externalSuite && typeof externalSuite.setLook === 'function') {
    externalSuite.setLook(found.id);
  }
  savePilotState({ shader: found.id });
}

function syncSceneToPilot(state) {
  pilot = state;
  const clock = deriveClockMapping(state);

  // 1. Severn Door state -> physical door angle + interior warm light spill + acoustic muffling
  const open = Boolean(state.doorOpen);
  doorPivot.rotation.y = open ? -1.28 : 0.0;
  doorwayWarmLight.intensity = state.rawDaylight ? 2.0 : open ? 20.0 : 1.2;
  doorwayLampBulb.material.emissiveIntensity = open ? 2.8 : 0.6;
  audioMixer.setDoorOpen(open);

  const doorBtn = $('#btn-severn-door');
  if (doorBtn) {
    doorBtn.textContent = open ? 'Door: Open' : 'Door: Closed';
    doorBtn.classList.toggle('on', open);
  }
  const acLbl = $('#door-acoustic-state');
  if (acLbl) {
    acLbl.textContent = open ? 'DOOR OPEN (CLEAR)' : 'DOOR CLOSED (560HZ LP)';
    acLbl.style.color = open ? 'var(--teal)' : 'var(--amber)';
  }

  // 2. Parcel Ownership ('player' | 'bekele' | 'table')
  const holder = state.parcelHolder || 'player';
  const parcelBtn = $('#btn-parcel-handoff');
  if (parcelBtn) {
    parcelBtn.textContent = `Parcel: ${holder.charAt(0).toUpperCase() + holder.slice(1)}`;
    parcelBtn.classList.toggle('on', holder === 'bekele');
  }
  if (!encounterAnim.active) {
    if (holder === 'player' && cast.courier) {
      parcelMesh.position.set(
        cast.courier.root.position.x + 0.22,
        cast.courier.root.position.y + 1.02,
        cast.courier.root.position.z + 0.18
      );
    } else if (holder === 'bekele' && cast.bekele) {
      parcelMesh.position.set(
        cast.bekele.root.position.x - 0.18,
        cast.bekele.root.position.y + 1.04,
        cast.bekele.root.position.z + 0.22
      );
    } else {
      parcelMesh.position.set(1.15 + 1.48, 0.89, -6.25 + 0.55);
    }
  }

  // 3. World Hour & Neutral Daylight vs District Atmosphere (Brief 4 & Brief 7)
  const raw = Boolean(state.rawDaylight);
  $('#btn-neutral-pass')?.classList.toggle('on', raw);
  for (const m of [matBG, matMG, matFG]) {
    m.uniforms.uNeutralPass.value = raw ? 1.0 : 0.0;
  }
  if (raw) {
    skyMat.uniforms.uTop.value.set('#9ab4cc');
    skyMat.uniforms.uMid.value.set('#bfd1e0');
    skyMat.uniforms.uHorizon.value.set('#dde4ea');
    hemiLight.intensity = 2.1;
    sunLight.intensity = 2.8;
    sunLight.color.set('#ffffff');
    scene.fog.density = 0.001;
  } else {
    const h = clock.localHour;
    const nightAmt = h < 6 || h >= 20 ? 1.0 : h >= 17 ? (h - 17) / 3 : h < 8 ? 1 - (h - 6) / 2 : 0.15;
    skyMat.uniforms.uTop.value.set(nightAmt > 0.5 ? '#081529' : '#18426e');
    skyMat.uniforms.uMid.value.set(nightAmt > 0.5 ? '#1f4c78' : '#4a80ab');
    skyMat.uniforms.uHorizon.value.set(nightAmt > 0.5 ? '#5b7f9c' : '#a8bdd0');
    hemiLight.intensity = 1.35 - nightAmt * 0.35;
    sunLight.intensity = 2.4 - nightAmt * 0.85;
    sunLight.color.set(nightAmt > 0.5 ? '#ffd4a3' : '#fff0db');
    scene.fog.density = 0.0085;
  }

  // 4. Hour slider & summary
  const hrSlider = $('#sl-world-hour');
  if (hrSlider && document.activeElement !== hrSlider) hrSlider.value = String(clock.localHour);
  if ($('#lbl-world-hour')) $('#lbl-world-hour').textContent = clock.formattedLocalTime;
  if ($('#pilot-summary')) {
    $('#pilot-summary').textContent = `Severn ${state.room} · ${clock.tideLabel} · Poem ${state.poem} · Parcel: ${holder}`;
  }

  // 5. Provenance filter
  provFilter = state.provenanceFilter || 'all';
  const pfMap = { all: 0, recorded: 1, checked: 2, inferred: 3, invented: 4 };
  for (const m of [matBG, matMG, matFG]) {
    m.uniforms.uProvFilter.value = pfMap[provFilter] || 0;
  }
  $$('#prov-filter-pills .btn').forEach((b) => b.classList.toggle('on', b.dataset.prov === provFilter));

  // 6. Shader sync
  if (state.shader && state.shader !== activeLook.id) {
    const lk = ALL_CITY_LOOKS.find((l) => l.id === state.shader);
    if (lk) activeLook = lk;
  }
}

subscribePilotState(syncSceneToPilot);

// ---------------------------------------------------------------------------
// Wire UI Controls
// ---------------------------------------------------------------------------
$('#btn-recover-cam').addEventListener('click', () => {
  recoverSourceCamera();
  showToast('Source camera recovered');
});

$('#btn-reverse-angle').addEventListener('click', toggleReverseAngle);
$('#btn-explode').addEventListener('click', toggleExplodeStack);

$('#btn-neutral-pass').addEventListener('click', () => {
  savePilotState({ rawDaylight: !pilot.rawDaylight });
});

let provMapOn = false;
$('#btn-prov-overlay').addEventListener('click', () => {
  provMapOn = !provMapOn;
  $('#btn-prov-overlay').classList.toggle('on', provMapOn);
  for (const m of [matBG, matMG, matFG]) {
    m.uniforms.uProvMode.value = provMapOn ? 1.0 : 0.0;
  }
});

function update3UpCapture() {
  try {
    $('#cmp-img-spatial').src = renderer.domElement.toDataURL('image/jpeg', 0.88);
  } catch {}
}

$('#btn-compare-3up').addEventListener('click', () => {
  const modal = $('#compare-modal');
  const next = !modal.classList.contains('open');
  if (next) {
    recoverSourceCamera();
    renderFrameOnce(performance.now() * 0.001);
    update3UpCapture();
  }
  modal.classList.toggle('open', next);
  $('#btn-compare-3up').classList.toggle('on', next);
});
$('#btn-refresh-compare').addEventListener('click', update3UpCapture);
$('#btn-close-compare').addEventListener('click', () => {
  $('#compare-modal').classList.remove('open');
  $('#btn-compare-3up').classList.remove('on');
});

$('#btn-play-encounter').addEventListener('click', async () => {
  encounterAnim.active = !encounterAnim.active;
  encounterAnim.t = 0;
  $('#btn-play-encounter').classList.toggle('on', encounterAnim.active);
  if (encounterAnim.active) {
    savePilotState({ doorOpen: true, parcelHolder: 'player', room: 'street-curb' });
    if (cast.courier?.v8) cast.courier.v8.playClip('walk', 0.2);
    showToast('Encounter: Courier approaches Severn stoop -> hands parcel to Bekele -> crosses threshold');
  } else if (cast.courier?.v8) {
    cast.courier.v8.playClip('idle', 0.25);
  }
});

$('#btn-severn-door').addEventListener('click', () => {
  const nextOpen = !pilot.doorOpen;
  savePilotState({ doorOpen: nextOpen });
  showToast(nextOpen ? 'Severn threshold door opened (warm light + clear street sound)' : 'Severn threshold door closed (560Hz acoustic muffling)');
});

$('#btn-parcel-handoff').addEventListener('click', () => {
  const order = ['player', 'bekele', 'table'];
  const next = order[(order.indexOf(pilot.parcelHolder || 'player') + 1) % order.length];
  savePilotState({ parcelHolder: next, room: next === 'bekele' ? 'vestibule' : 'street-curb' });
  showToast(`Parcel ownership persisted: ${next}`);
});

$('#sl-world-hour').addEventListener('input', (e) => {
  savePilotState({ worldTime: parseFloat(e.target.value) });
});

$('#sl-cel-mix').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  $('#val-cel-mix').textContent = Math.round(v * 100) + '%';
  for (const m of [matBG, matMG, matFG]) m.uniforms.uCelMix.value = v;
});

$('#sl-notan-mix').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  $('#val-notan-mix').textContent = Math.round(v * 100) + '%';
  for (const m of [matBG, matMG, matFG]) m.uniforms.uNotanMix.value = v;
});

$('#sl-sky-wipe').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  $('#val-sky-wipe').textContent = Math.round(v * 100) + '%';
  matBG.uniforms.uSkyWipe.value = v;
});

$('#sl-fg-cut').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  $('#val-fg-cut').textContent = v.toFixed(2);
  for (const m of [matBG, matMG, matFG]) m.uniforms.uFgCut.value = v;
});

$$('#prov-filter-pills .btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    savePilotState({ provenanceFilter: btn.dataset.prov });
    renderLedgerAndPlanesUI();
  });
});

$('#btn-collapse-inspector').addEventListener('click', () => $('#inspector').classList.add('collapsed'));
$('#btn-toggle-inspector').addEventListener('click', () => $('#inspector').classList.remove('collapsed'));

// Lower Drawer Tabs (#spine | #worldscore | #Dr-OUT)
function setDrawerTab(tab) {
  $('#lower-drawer').classList.remove('minimized');
  $('#btn-minimize-drawer').textContent = 'Minimize';
  $$('#drawer-tabs .btn').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  $$('.drawer-pane').forEach((p) => p.classList.toggle('on', p.id === `pane-${tab}`));
  if (tab === 'worldscore') drawWorldScoreCanvas();
}

$$('#drawer-tabs .btn').forEach((btn) => {
  btn.addEventListener('click', () => setDrawerTab(btn.dataset.tab));
});

$('#btn-minimize-drawer').addEventListener('click', () => {
  const min = $('#lower-drawer').classList.toggle('minimized');
  $('#btn-minimize-drawer').textContent = min ? 'Expand' : 'Minimize';
});

$('#btn-score-play').addEventListener('click', async () => {
  await audioMixer.ensureContext();
  scoreState.playing = !scoreState.playing;
  $('#btn-score-play').textContent = scoreState.playing ? 'Pause Score' : 'Play Score';
  $('#btn-score-play').classList.toggle('on', scoreState.playing);
});

$('#btn-audio-mute').addEventListener('click', () => {
  const nextMute = !audioMixer.muted;
  audioMixer.setMuted(nextMute);
  $('#btn-audio-mute').textContent = nextMute ? 'Mute: On' : 'Mute: Off';
  $('#btn-audio-mute').classList.toggle('on', nextMute);
  savePilotState({ audioBuses: { ...pilot.audioBuses, muted: nextMute } });
});

$$('#score-rule-btns .btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const k = btn.dataset.srule;
    scoreState.rules[k] = !scoreState.rules[k];
    btn.classList.toggle('on', scoreState.rules[k]);
    drawWorldScoreCanvas();
  });
});

$('#worldscore-canvas').addEventListener('click', (e) => {
  if (!worldScoreData) return;
  const r = e.target.getBoundingClientRect();
  const u = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  const poemIdx = Math.max(0, Math.min(13, parseInt(pilot.poem || '01', 10) - 1));
  const sc = worldScoreData.script?.[poemIdx] || { t0: 0, t1: 98 };
  scoreState.sec = (sc.t0 || 0) + u * ((sc.t1 || 98) - (sc.t0 || 0));
  drawWorldScoreCanvas();
});

$$('[data-bus]').forEach((sl) => {
  sl.addEventListener('input', (e) => {
    const bus = e.target.dataset.bus;
    const val = parseFloat(e.target.value);
    e.target.nextElementSibling.textContent = Math.round(val * 100) + '%';
    audioMixer.setBusGain(bus, val);
    savePilotState({ audioBuses: { ...pilot.audioBuses, [bus]: val, delaySend: 0.0 } });
  });
});

// ---------------------------------------------------------------------------
// Diegetic In-World UI:
// 1. 3D Hanging Darkroom Contact-Sheet & Spine-Cut Plates in Left/Right Wings
// 2. 3D Brass Camera Tripod (Recover Source Cam, Reverse Angle Prism, 23 GPU Shaders, Expose Plate)
// 3. 3D Courier, Bekele & Severn Threshold Door Encounter / Acoustic Door Coupling
// 4. World-Projected 1-Line Hover Whisper (Zero Overlaid Boxes or Grids)
// ---------------------------------------------------------------------------
const interactivePickables = [];
const wingPlateRecords = [];
const wingGalleryGroup = new THREE.Group();
scene.add(wingGalleryGroup);

function registerPickable(mesh, meta) {
  mesh.userData.weavePick = meta;
  interactivePickables.push(mesh);
  return mesh;
}

function createSprocketMatteTexture(tintHex = '#10141c', accentHex = '#d4b078') {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 340;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = tintHex;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, cv.width - 12, cv.height - 12);

  // Top & bottom 35mm darkroom filmstrip sprocket perforations
  ctx.fillStyle = '#05070b';
  for (let x = 22; x < cv.width - 22; x += 34) {
    ctx.fillRect(x, 13, 18, 13);
    ctx.fillRect(x, cv.height - 26, 18, 13);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const filmMatteTex = createSprocketMatteTexture('#111620', '#c8a974');
const spineMatteTex = createSprocketMatteTexture('#101922', '#5fd4c0');

function buildHangingDarkroomPlate({
  x,
  y,
  z,
  rotY,
  wireY,
  w = 1.48,
  h = 0.96,
  imageUrl,
  entryKey,
  shaderHint = null,
  celMixHint = null,
  whisperText,
  isSpine = false,
}) {
  const holder = new THREE.Group();
  holder.position.set(x, y, z);
  holder.rotation.y = rotY;

  // Vertical steel drop-wires up to overhead darkroom drying cable + 2 brass alligator clips
  const dropLen = Math.max(0.18, wireY - (y + h * 0.5));
  const wireMat = new THREE.MeshBasicMaterial({ color: '#7e8a9c' });
  for (const cx of [-w * 0.34, w * 0.34]) {
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, dropLen, 6), wireMat);
    drop.position.set(cx, h * 0.5 + dropLen * 0.5, 0);
    holder.add(drop);

    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.085, 0.035), brassRailMat);
    clip.position.set(cx, h * 0.5 + 0.03, 0);
    holder.add(clip);
  }

  // Perforated 35mm contact-sheet backing frame
  const frameMat = new THREE.MeshStandardMaterial({
    map: isSpine ? spineMatteTex : filmMatteTex,
    roughness: 0.55,
    metalness: 0.22,
    emissive: new THREE.Color('#000000'),
    emissiveIntensity: 0.0,
    side: THREE.DoubleSide,
  });
  const frameMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), frameMat);
  holder.add(frameMesh);

  // Glowing rim indicator when active or hovered
  const rimMesh = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(w + 0.04, h + 0.04)),
    new THREE.LineBasicMaterial({ color: isSpine ? '#5fd4c0' : '#f2a541', transparent: true, opacity: 0.32 })
  );
  rimMesh.position.z = 0.008;
  holder.add(rimMesh);

  // Backlit photograph / cel / spine emulsion plane
  const photoMat = new THREE.MeshBasicMaterial({
    map: blankColorTex,
    color: '#ffffff',
    side: THREE.DoubleSide,
  });
  const photoMesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.88, h * 0.72), photoMat);
  photoMesh.position.z = 0.012;
  holder.add(photoMesh);

  loadTexCached(imageUrl, false).then((tex) => {
    photoMat.map = tex;
    photoMat.needsUpdate = true;
  });

  const rec = {
    entryKey,
    shaderHint,
    celMixHint,
    holder,
    frameMat,
    rimMesh,
    photoMat,
    isSpine,
  };
  wingPlateRecords.push(rec);

  const pickMeta = {
    kind: 'wing-plate',
    rec,
    anchorObj: holder,
    anchorOffset: new THREE.Vector3(0, h * 0.55, 0),
    getWhisper: () => whisperText,
  };
  registerPickable(frameMesh, pickMeta);
  registerPickable(photoMesh, pickMeta);

  wingGalleryGroup.add(holder);
  return rec;
}

function buildDarkroomWingGalleries() {
  while (wingGalleryGroup.children.length > 0) {
    wingGalleryGroup.remove(wingGalleryGroup.children[0]);
  }
  wingPlateRecords.length = 0;

  // Overhead taut darkroom steel drying cables & warm amber safelights in Left & Right Wings
  const cableMat = new THREE.MeshStandardMaterial({ color: '#8c96a6', roughness: 0.38, metalness: 0.78 });
  for (const side of [-1, 1]) {
    for (const wy of [3.55, 2.15]) {
      const pStart = new THREE.Vector3(side * 3.55, wy, -3.9);
      const pEnd = new THREE.Vector3(side * 7.65, wy, -13.2);
      const span = pStart.distanceTo(pEnd);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, span, 8), cableMat);
      cable.position.copy(pStart).lerp(pEnd, 0.5);
      cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pEnd.clone().sub(pStart).normalize());
      wingGalleryGroup.add(cable);

      // Cast-iron proscenium post at front end of wire
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, wy + 0.15, 8), dishIronMat);
      post.position.set(pStart.x, (wy + 0.15) * 0.5, pStart.z);
      wingGalleryGroup.add(post);
    }

    // Warm darkroom safelight illuminating the hanging filmstrips
    const safeBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 10, 8),
      new THREE.MeshBasicMaterial({ color: side < 0 ? '#ff9d47' : '#5fd4c0' })
    );
    safeBulb.position.set(side * 5.2, 3.72, -7.8);
    wingGalleryGroup.add(safeBulb);

    const safeLight = new THREE.PointLight(side < 0 ? '#ff9844' : '#4ec9ff', 10.5, 11.5, 1.5);
    safeLight.position.copy(safeBulb.position);
    wingGalleryGroup.add(safeLight);
  }

  // LEFT WING: Physical 3D Hanging WEAVE Passages & District Contact-Sheet Plates (2 tiers x 6 columns = 12 plates)
  const leftItems = [
    ...weaveCatalog.passages.map((p) => ({
      entryKey: `passage:${p.id}`,
      imageUrl: p.urls.plate,
      label: `${p.tab} · ${p.title} — Click Plate to Stage`,
    })),
    ...weaveCatalog.shots.map((s) => ({
      entryKey: s.id,
      imageUrl: s.urls.image,
      label: `${s.district.toUpperCase()} · ${s.title.slice(0, 34)} — Click Plate to Stage`,
    })),
  ].slice(0, 12);

  leftItems.forEach((item, idx) => {
    const row = Math.floor(idx / 6); // 0 = upper wire, 1 = lower wire
    const col = idx % 6;
    const t = col / 5;
    const x = THREE.MathUtils.lerp(-3.78, -7.35, t);
    const z = THREE.MathUtils.lerp(-4.35, -12.6, t);
    const y = row === 0 ? 2.68 : 1.24;
    const wireY = row === 0 ? 3.55 : 2.15;
    buildHangingDarkroomPlate({
      x,
      y,
      z,
      rotY: 0.96,
      wireY,
      imageUrl: item.imageUrl,
      entryKey: item.entryKey,
      whisperText: item.label,
      isSpine: false,
    });
  });

  // RIGHT WING: Physical 3D Hanging Spine-Cut Filmstrips (Archive Source | WEAVE Blend | Cel/Notan | 3D Plane Map)
  const spineRows = [
    { name: 'Archive Source', urlKey: 'image', shaderHint: 'natural', celMix: 0.0 },
    { name: 'WEAVE Blend', urlKey: 'exploded', shaderHint: 'weave', celMix: 0.55 },
    { name: 'Cel / Notan', urlKey: 'cel', shaderHint: 'woodblock', celMix: 0.92 },
    { name: '3D Plane Map', urlKey: 'planeMap', shaderHint: 'jerikan', celMix: 0.45 },
  ];
  const rightShots = weaveCatalog.shots.slice(0, 6);
  let rIdx = 0;
  for (let tier = 0; tier < 2; tier++) {
    for (let col = 0; col < 6; col++) {
      const shot = rightShots[col % Math.max(1, rightShots.length)];
      if (!shot) continue;
      const sRow = spineRows[(tier * 2 + (col % 2)) % spineRows.length];
      const t = col / 5;
      const x = THREE.MathUtils.lerp(3.78, 7.35, t);
      const z = THREE.MathUtils.lerp(-4.35, -12.6, t);
      const y = tier === 0 ? 2.68 : 1.24;
      const wireY = tier === 0 ? 3.55 : 2.15;
      buildHangingDarkroomPlate({
        x,
        y,
        z,
        rotY: -0.96,
        wireY,
        imageUrl: shot.urls[sRow.urlKey] || shot.urls.image,
        entryKey: shot.id,
        shaderHint: sRow.shaderHint,
        celMixHint: sRow.celMix,
        whisperText: `Spine · ${sRow.name} · ${shot.district.toUpperCase()} — Click Strip to Load`,
        isSpine: true,
      });
      rIdx++;
    }
  }
  syncActiveWingPlates();
}

function syncActiveWingPlates() {
  const curKey = activeEntry?.key;
  const curShotId = activeEntry?.shot?.id;
  for (const rec of wingPlateRecords) {
    const isMatch = rec.entryKey === curKey || rec.entryKey === curShotId;
    rec.frameMat.emissive.set(isMatch ? (rec.isSpine ? '#124e48' : '#52340d') : '#000000');
    rec.frameMat.emissiveIntensity = isMatch ? 0.9 : 0.0;
    rec.rimMesh.material.opacity = isMatch ? 0.95 : 0.30;
  }
}

// Build 3D Brass 8x10 Camera Tripod + Reverse-Angle Prism + Source Origin Witness Tripod
const stageTripodGroup = new THREE.Group();
const sourceWitnessTripod = new THREE.Group();
let reversePrismMesh = null;

function assembleBrassCameraTripod(root, { includeInteractive = true, isOriginMark = false } = {}) {
  const woodLegMat = new THREE.MeshStandardMaterial({ color: '#4d311f', roughness: 0.62, metalness: 0.12 });
  const darkBellowsMat = new THREE.MeshStandardMaterial({ color: '#171a22', roughness: 0.78, metalness: 0.18 });
  const glassLensMat = new THREE.MeshStandardMaterial({
    color: '#18b4ff',
    emissive: '#0c5c8a',
    emissiveIntensity: 1.15,
    roughness: 0.12,
    metalness: 0.45,
  });

  // Ground contact shadow + brass survey ring
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 22),
    new THREE.MeshBasicMaterial({ color: '#05070b', transparent: true, opacity: 0.52, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.014;
  root.add(shadow);

  const surveyRing = new THREE.Mesh(new THREE.RingGeometry(0.30, 0.36, 28), brassRailMat);
  surveyRing.rotation.x = -Math.PI / 2;
  surveyRing.position.y = 0.018;
  root.add(surveyRing);

  // 3 splayed mahogany + brass survey legs + central plumb-bob
  const legsHitGroup = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.35;
    const topP = new THREE.Vector3(Math.cos(a) * 0.06, 1.24, Math.sin(a) * 0.06);
    const botP = new THREE.Vector3(Math.cos(a) * 0.36, 0.0, Math.sin(a) * 0.36);
    const len = topP.distanceTo(botP);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, len, 8), woodLegMat);
    leg.position.copy(topP).lerp(botP, 0.5);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), topP.clone().sub(botP).normalize());
    leg.castShadow = true;
    legsHitGroup.add(leg);
  }
  const plumbBob = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 10), brassRailMat);
  plumbBob.rotation.x = Math.PI;
  plumbBob.position.set(0, 0.72, 0);
  legsHitGroup.add(plumbBob);

  // Invisible generous hit cylinder around tripod base/legs -> Recover Source Camera
  const recoverHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.42, 1.12, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  recoverHit.position.y = 0.56;
  legsHitGroup.add(recoverHit);
  root.add(legsHitGroup);

  // Brass geared crown, mahogany 8x10 camera box, pleated bellows, and brass lens barrel -> Cycle 23 GPU Shaders
  const headCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 0.08, 14), brassRailMat);
  headCrown.position.y = 1.27;
  root.add(headCrown);

  const camBox = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.20), woodLegMat);
  camBox.position.set(0, 1.43, 0.02);
  camBox.castShadow = true;
  root.add(camBox);

  const bellows = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.18, 0.18), darkBellowsMat);
  bellows.position.set(0, 1.43, -0.16);
  root.add(bellows);

  const lensBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.072, 0.14, 16), brassRailMat);
  lensBarrel.rotation.x = Math.PI / 2;
  lensBarrel.position.set(0, 1.43, -0.30);
  root.add(lensBarrel);

  const lensGlass = new THREE.Mesh(new THREE.CircleGeometry(0.056, 16), glassLensMat);
  lensGlass.rotation.y = Math.PI;
  lensGlass.position.set(0, 1.43, -0.372);
  root.add(lensGlass);

  const shaderHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.34, 0.52),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  shaderHit.position.set(0, 1.43, -0.12);
  root.add(shaderHit);

  // Glowing Octahedral Reverse-Angle Prism mounted above viewfinder -> Toggle Reverse Angle
  const prismMat = new THREE.MeshStandardMaterial({
    color: '#f2a541',
    emissive: '#f2a541',
    emissiveIntensity: 1.35,
    roughness: 0.18,
    metalness: 0.35,
  });
  const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), prismMat);
  prism.position.set(0, 1.69, 0.02);
  root.add(prism);
  if (!isOriginMark) reversePrismMesh = prism;

  const prismHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  prismHit.position.copy(prism.position);
  root.add(prismHit);

  // Brass Cable Shutter Bulb at right side -> Expose Plate to Nolli Light Table
  const shutterBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#c85a3b', emissive: '#591d0e', roughness: 0.45 })
  );
  shutterBulb.position.set(0.22, 1.24, 0.06);
  root.add(shutterBulb);

  if (includeInteractive) {
    if (isOriginMark) {
      const originMeta = {
        kind: 'tripod-recover',
        anchorObj: root,
        anchorOffset: new THREE.Vector3(0, 1.65, 0),
        getWhisper: () => 'Source Camera Origin Mark — Click to Recover Calibrated Source Camera',
      };
      registerPickable(recoverHit, originMeta);
      registerPickable(shaderHit, originMeta);
      registerPickable(prismHit, originMeta);
    } else {
      registerPickable(recoverHit, {
        kind: 'tripod-recover',
        anchorObj: root,
        anchorOffset: new THREE.Vector3(0, 1.15, 0),
        getWhisper: () => 'Brass Survey Tripod — Click to Recover Exact Source Camera',
      });
      registerPickable(shaderHit, {
        kind: 'tripod-shader',
        anchorObj: root,
        anchorOffset: new THREE.Vector3(0, 1.62, -0.1),
        getWhisper: () => `8x10 Brass Lens (${activeLook.name}) — Click to Cycle 23 GPU Shaders · Shift+Click Expose Plate`,
      });
      registerPickable(prismHit, {
        kind: 'tripod-reverse',
        anchorObj: root,
        anchorOffset: new THREE.Vector3(0, 1.84, 0.02),
        getWhisper: () =>
          cameraMode === 'reverse'
            ? 'Reverse-Angle Prism — Click to Return to Street Forward Camera'
            : 'Reverse-Angle Prism — Click to Flip to Severn Vestibule Reverse Angle',
      });
      registerPickable(shutterBulb, {
        kind: 'tripod-expose',
        anchorObj: shutterBulb,
        anchorOffset: new THREE.Vector3(0, 0.14, 0),
        getWhisper: () => 'Pneumatic Shutter Bulb — Click to Expose 8x10 Plate to Nolli Light Table',
      });
    }
  }
}

stageTripodGroup.position.set(-1.68, 0, -3.95);
stageTripodGroup.rotation.y = -0.34;
assembleBrassCameraTripod(stageTripodGroup, { includeInteractive: true, isOriginMark: false });
scene.add(stageTripodGroup);

sourceWitnessTripod.position.set(0, 0, 0.4);
assembleBrassCameraTripod(sourceWitnessTripod, { includeInteractive: true, isOriginMark: true });
scene.add(sourceWitnessTripod);

// Register 3D Hit Volumes on Severn Doorway, Courier, Bekele, Parcel, Table & Relay Dish
const doorHitMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1.65, 2.65, 0.55),
  new THREE.MeshBasicMaterial({ visible: false })
);
doorHitMesh.position.set(0, 1.42, -0.10);
hybridSet.add(doorHitMesh);
registerPickable(doorHitMesh, {
  kind: 'severn-door',
  anchorObj: hybridSet,
  anchorOffset: new THREE.Vector3(0, 2.45, 0),
  getWhisper: () =>
    pilot.doorOpen
      ? 'Severn Threshold Door (Open) — Click to Close & Muffle Street (560 Hz) · Shift+Click Enter Nolli Block'
      : 'Severn Threshold Door (Closed · 560 Hz) — Click to Swing Open & Spill Warm Lamp',
});

function attachActorHitCapsule(actor, labelFn) {
  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.38, 1.82, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 0.91;
  actor.root.add(hit);
  registerPickable(hit, {
    kind: 'actor-encounter',
    anchorObj: actor.root,
    anchorOffset: new THREE.Vector3(0, 1.88, 0),
    getWhisper: labelFn,
  });
}

attachActorHitCapsule(
  cast.courier,
  () => `Courier (Parcel: ${pilot.parcelHolder}) — Click to Play Arrival, Handoff & Door-Close Encounter`
);
attachActorHitCapsule(
  cast.bekele,
  () => `Bekele at Severn Stoop — Click to Play Handoff Encounter · Shift+Click Pass Parcel`
);

registerPickable(parcelBox, {
  kind: 'parcel-cycle',
  anchorObj: parcelMesh,
  anchorOffset: new THREE.Vector3(0, 0.28, 0),
  getWhisper: () => `Shared Severn Parcel (${pilot.parcelHolder}) — Click to Hand Off Across Threshold`,
});

const tableHit = new THREE.Mesh(
  new THREE.BoxGeometry(0.86, 0.88, 0.62),
  new THREE.MeshBasicMaterial({ visible: false })
);
tableHit.position.y = 0.44;
courierTable.add(tableHit);
registerPickable(tableHit, {
  kind: 'parcel-cycle',
  anchorObj: courierTable,
  anchorOffset: new THREE.Vector3(0, 0.96, 0),
  getWhisper: () => `Stoop Side Table — Click to Cycle Shared Parcel Holder (${pilot.parcelHolder})`,
});

const dishHit = new THREE.Mesh(
  new THREE.SphereGeometry(3.35, 12, 10),
  new THREE.MeshBasicMaterial({ visible: false })
);
dishHit.position.set(0, 6.5, 0);
dishGroup.add(dishHit);
registerPickable(dishHit, {
  kind: 'relay-explode',
  anchorObj: dishGroup,
  anchorOffset: new THREE.Vector3(0, 8.6, 0),
  getWhisper: () =>
    cameraMode === 'exploded'
      ? 'Parabolic Relay Dish — Click to Collapse Multiplane Stack to Source Frame'
      : 'Parabolic Relay Dish — Click to Swing Into 3/4 Multiplane Depth Stack',
});

function runEncounterInWorld() {
  encounterAnim.active = true;
  encounterAnim.t = 0;
  $('#btn-play-encounter')?.classList.add('on');
  savePilotState({ doorOpen: true, parcelHolder: 'player', room: 'street-curb' });
  if (cast.courier?.v8) cast.courier.v8.playClip('walk', 0.2);
  showToast('Courier approaches Severn stoop -> hands parcel to Bekele -> closes threshold door');
}

function exposeCurrentWeavePlate() {
  if (externalSuite && typeof externalSuite.exposePlate === 'function') {
    externalSuite.exposePlate({ locationName: $('#scene-title')?.textContent || 'WEAVE Stage' });
    return;
  }
  renderFrameOnce(performance.now() * 0.001);
  savePlateToNolliLedger(
    renderer.domElement.toDataURL('image/jpeg', 0.86),
    $('#scene-title').textContent,
    activeLook.id
  );
}

// Raycaster & World-Projected 1-Line Whisper
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const whisperEl = $('#world-whisper');
const anchorWorldTmp = new THREE.Vector3();
let pointerDownXY = null;
let hoveredPickMeta = null;

function pickMetaFromEvent(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(interactivePickables, false);
  for (const h of hits) {
    let cur = h.object;
    let vis = true;
    while (cur) {
      if (cur.visible === false && cur !== h.object) {
        vis = false;
        break;
      }
      cur = cur.parent;
    }
    if (!vis) continue;
    if (h.object.userData?.weavePick) return h.object.userData.weavePick;
  }
  return null;
}

function updateWhisperProjection() {
  if (!whisperEl) return;
  if (!hoveredPickMeta || document.body.classList.contains('mp-tab-open')) {
    whisperEl.classList.remove('visible');
    return;
  }
  hoveredPickMeta.anchorObj.updateMatrixWorld();
  anchorWorldTmp.copy(hoveredPickMeta.anchorOffset || new THREE.Vector3());
  hoveredPickMeta.anchorObj.localToWorld(anchorWorldTmp);
  const proj = projectWorldLabel(camera, anchorWorldTmp, renderer.domElement);
  if (!proj.inFront) {
    whisperEl.classList.remove('visible');
    return;
  }
  whisperEl.textContent = hoveredPickMeta.getWhisper();
  whisperEl.classList.add('visible');
  const halfW = Math.ceil((whisperEl.offsetWidth || 260) * 0.5) + 16;
  const cx = THREE.MathUtils.clamp(proj.x, halfW, Math.max(halfW, window.innerWidth - halfW));
  const cy = THREE.MathUtils.clamp(proj.y, 38, window.innerHeight - 28);
  whisperEl.style.left = `${Math.round(cx)}px`;
  whisperEl.style.top = `${Math.round(cy)}px`;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 0) pointerDownXY = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.buttons !== 0) {
    hoveredPickMeta = null;
    if (whisperEl) whisperEl.classList.remove('visible');
    return;
  }
  hoveredPickMeta = pickMetaFromEvent(e);
  renderer.domElement.style.cursor = hoveredPickMeta ? 'pointer' : 'grab';
  updateWhisperProjection();
});

renderer.domElement.addEventListener('pointerleave', () => {
  hoveredPickMeta = null;
  renderer.domElement.style.cursor = '';
  if (whisperEl) whisperEl.classList.remove('visible');
});

renderer.domElement.addEventListener('pointerup', async (e) => {
  if (e.button !== 0 || !pointerDownXY) return;
  const distPx = Math.hypot(e.clientX - pointerDownXY.x, e.clientY - pointerDownXY.y);
  pointerDownXY = null;
  if (distPx > 6) return; // Dragged camera, not a click

  const picked = pickMetaFromEvent(e);
  if (!picked) return;

  switch (picked.kind) {
    case 'wing-plate': {
      const rec = picked.rec;
      if ($('#shot-select')) $('#shot-select').value = rec.entryKey;
      await selectEntryByKey(rec.entryKey);
      if (rec.shaderHint) applyShaderById(rec.shaderHint);
      if (typeof rec.celMixHint === 'number') {
        for (const m of [matBG, matMG, matFG]) m.uniforms.uCelMix.value = rec.celMixHint;
        if ($('#sl-cel-mix')) $('#sl-cel-mix').value = String(rec.celMixHint);
        if ($('#val-cel-mix')) $('#val-cel-mix').textContent = Math.round(rec.celMixHint * 100) + '%';
      }
      showToast(`Loaded onto WEAVE stage: ${$('#scene-title').textContent}`);
      break;
    }
    case 'severn-door': {
      if (e.shiftKey) {
        window.location.assign(`../${formatPilotHash(loadPilotState())}`);
        return;
      }
      const nextOpen = !pilot.doorOpen;
      savePilotState({ doorOpen: nextOpen });
      showToast(
        nextOpen
          ? 'Severn threshold door opened · warm lamp & clear street sound'
          : 'Severn threshold door closed · 560 Hz stone muffling'
      );
      break;
    }
    case 'actor-encounter': {
      if (e.shiftKey) {
        const order = ['player', 'bekele', 'table'];
        const next = order[(order.indexOf(pilot.parcelHolder || 'player') + 1) % order.length];
        savePilotState({ parcelHolder: next, room: next === 'bekele' ? 'vestibule' : 'street-curb' });
        showToast(`Parcel handed to ${next}`);
      } else {
        runEncounterInWorld();
      }
      break;
    }
    case 'parcel-cycle': {
      const order = ['player', 'bekele', 'table'];
      const next = order[(order.indexOf(pilot.parcelHolder || 'player') + 1) % order.length];
      savePilotState({ parcelHolder: next, room: next === 'bekele' ? 'vestibule' : 'street-curb' });
      showToast(`Parcel ownership persisted: ${next}`);
      break;
    }
    case 'tripod-recover': {
      recoverSourceCamera();
      showToast('Calibrated source camera recovered');
      break;
    }
    case 'tripod-reverse': {
      toggleReverseAngle();
      break;
    }
    case 'tripod-shader': {
      if (e.shiftKey) {
        exposeCurrentWeavePlate();
      } else if (externalSuite && typeof externalSuite.nextLook === 'function') {
        externalSuite.nextLook(true);
        const nextId = externalSuite.getState?.()?.lookId;
        const found = ALL_CITY_LOOKS.find((l) => l.id === nextId);
        if (found) activeLook = found;
        showToast(`GPU Look: ${activeLook.name}`);
      } else {
        const idx = ALL_CITY_LOOKS.findIndex((l) => l.id === activeLook.id);
        const nxt = ALL_CITY_LOOKS[(idx + 1) % ALL_CITY_LOOKS.length];
        applyShaderById(nxt.id);
        showToast(`GPU Look: ${nxt.name}`);
      }
      break;
    }
    case 'tripod-expose': {
      exposeCurrentWeavePlate();
      break;
    }
    case 'relay-explode': {
      toggleExplodeStack();
      break;
    }
  }
  updateWhisperProjection();
});

// Keyboard Pan/Turn into Left & Right Darkroom Wings (WASD / Q-E / Arrows) + Space Expose
const navKeys = {};
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input,select,textarea')) return;
  navKeys[e.code] = true;
  if (e.code === 'Space' && !externalSuite) {
    e.preventDefault();
    exposeCurrentWeavePlate();
  } else if (e.code === 'KeyR') {
    recoverSourceCamera();
    showToast('Calibrated source camera recovered');
  }
});
window.addEventListener('keyup', (e) => {
  navKeys[e.code] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Mount Universal 23-Look Shader Suite Bar (../shader-suite-bar.js)
// ---------------------------------------------------------------------------
function initShaderSuite() {
  externalSuite = mountWebGLShaderSuite({
    THREE,
    renderer,
    scene,
    camera,
    defaultLook: pilot.shader || 'weave',
    locationName: 'WEAVE Multiplane Stage',
    cartridgeName: 'weave',
    onTimeChange: (timeKey) => {
      const mapHr = { dawn: 6.5, midday: 12.5, bluehour: 18.5, night: 22.0 };
      if (mapHr[timeKey] !== undefined) savePilotState({ worldTime: mapHr[timeKey], rawDaylight: false });
    },
  });
}

// ---------------------------------------------------------------------------
// Main Render Loop & Viewing Cone Check
// ---------------------------------------------------------------------------
let lastTime = performance.now() * 0.001;

function updateEncounter(dt) {
  if (!encounterAnim.active || !cast.courier || !cast.bekele) return;
  encounterAnim.t += dt;
  const t = encounterAnim.t;

  // Phase 1 (0..3.6s): Courier walks from left foreground (-2.2, 0, -4.4) behind FG occlusion to Severn stoop (0.35, 0, -5.45)
  if (t < 3.6) {
    const u = t / 3.6;
    cast.courier.root.position.set(
      THREE.MathUtils.lerp(-2.35, 0.32, u),
      0,
      THREE.MathUtils.lerp(-4.35, -5.45, u)
    );
    cast.courier.root.rotation.y = 0.95;
    parcelMesh.position.set(
      cast.courier.root.position.x + 0.22,
      1.02,
      cast.courier.root.position.z + 0.16
    );
  } else if (t < 5.6) {
    // Phase 2 (3.6..5.6s): Handoff parcel to Bekele at threshold
    if (pilot.parcelHolder !== 'bekele') {
      savePilotState({ parcelHolder: 'bekele', room: 'vestibule' });
      if (cast.courier.v8) cast.courier.v8.playClip('idle-talking', 0.25);
      if (cast.bekele.v8) cast.bekele.v8.playClip('idle-talking', 0.25);
    }
    const u = (t - 3.6) / 2.0;
    parcelMesh.position.set(
      THREE.MathUtils.lerp(0.52, cast.bekele.root.position.x - 0.16, u),
      THREE.MathUtils.lerp(1.04, 1.34, u),
      THREE.MathUtils.lerp(-5.32, cast.bekele.root.position.z + 0.2, u)
    );
  } else if (t < 8.0) {
    // Phase 3 (5.6..8.0s): Threshold crossing & door closes cleanly, changing light and acoustic transmission
    if (pilot.doorOpen) {
      savePilotState({ doorOpen: false });
      showToast('Threshold crossed: Severn door closed, warm light & street sound muffled');
    }
  } else {
    encounterAnim.active = false;
    $('#btn-play-encounter')?.classList.remove('on');
    if (cast.courier.v8) cast.courier.v8.playClip('idle', 0.25);
    if (cast.bekele.v8) cast.bekele.v8.playClip('idle', 0.25);
  }
}

function updateConeBadge() {
  const badge = $('#cone-badge');
  const vSrc = sourceCamSpec.pos.clone().sub(sourceCamSpec.target).normalize();
  const vCur = camera.position.clone().sub(controls.target).normalize();
  const angDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(vSrc.dot(vCur), -1, 1)));

  if (badge) {
    if (cameraMode === 'reverse') {
      badge.textContent = 'REVERSE THRESHOLD CAM';
      badge.classList.remove('warn');
    } else if (angDeg <= sourceCamSpec.maxLateralDeg) {
      badge.textContent = `WITHIN CONE (${angDeg.toFixed(1)} DEG)`;
      badge.classList.remove('warn');
    } else {
      badge.textContent = `OUTSIDE CONE (${angDeg.toFixed(1)} DEG) · REQUEST EVIDENCE`;
      badge.classList.add('warn');
    }
  }
  coneHelperGroup.visible = cameraMode === 'exploded';
}

function renderFrameOnce(nowSec) {
  const dt = Math.min(0.05, Math.max(0.001, nowSec - lastTime));
  lastTime = nowSec;

  // Smooth keyboard turn/dolly to glance into Left & Right Darkroom Hanging Plate Wings
  const turnInput =
    (navKeys.KeyD || navKeys.ArrowRight || navKeys.KeyE ? 1 : 0) -
    (navKeys.KeyA || navKeys.ArrowLeft || navKeys.KeyQ ? 1 : 0);
  const dollyInput =
    (navKeys.KeyS || navKeys.ArrowDown ? 1 : 0) -
    (navKeys.KeyW || navKeys.ArrowUp ? 1 : 0);
  if (turnInput !== 0) {
    controls._sphTarget.theta -= turnInput * 0.95 * dt;
  }
  if (dollyInput !== 0) {
    controls._sphTarget.radius = THREE.MathUtils.clamp(
      controls._sphTarget.radius * (1 + dollyInput * 0.85 * dt),
      controls.minDistance,
      controls.maxDistance
    );
  }

  controls.update();
  updateEncounter(dt);
  updateConeBadge();

  // Show Source Camera Origin Tripod whenever camera moves away from sourceCamSpec.pos
  sourceWitnessTripod.position.set(sourceCamSpec.pos.x, 0, sourceCamSpec.pos.z);
  sourceWitnessTripod.visible = camera.position.distanceTo(sourceCamSpec.pos) > 1.05;

  // Gentle darkroom air sway on hanging filmstrip plates + spinning reverse prism
  if (reversePrismMesh) {
    reversePrismMesh.rotation.y = nowSec * 1.1;
  }
  for (let i = 0; i < wingPlateRecords.length; i++) {
    const rec = wingPlateRecords[i];
    rec.holder.rotation.z = Math.sin(nowSec * 0.9 + i * 0.65) * 0.012;
  }

  if (hoveredPickMeta) updateWhisperProjection();

  if (cast.courier?.v8) cast.courier.v8.update(dt);
  if (cast.bekele?.v8) cast.bekele.v8.update(dt);

  for (const m of [matBG, matMG, matFG]) {
    m.uniforms.uTime.value = nowSec;
  }

  if (scoreState.playing) {
    scoreState.sec = (scoreState.sec + dt) % scoreState.duration;
    drawWorldScoreCanvas();
  }

  if (pilot.rawDaylight && externalSuite) {
    externalSuite.pipeline.render(scene, camera, {
      time: nowSec,
      focusM: 6.4,
      dofAmount: 0.0,
      ev: 0.0,
      mode: -1,
      paletteColors: null,
    });
  } else if (externalSuite) {
    externalSuite.render(scene, camera);
  } else {
    renderer.render(scene, camera);
  }
}

function animate() {
  requestAnimationFrame(animate);
  renderFrameOnce(performance.now() * 0.001);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async function boot() {
  const [catRes, wsRes] = await Promise.all([
    fetch('./data/weave_catalog.json').then((r) => r.json()),
    fetch('./data/worldscore_spine.json').then((r) => r.json()),
  ]);
  weaveCatalog = catRes;
  worldScoreData = wsRes;

  // Populate Shot & Passage Selector (used if Tab workbench is summoned)
  const sel = $('#shot-select');
  const pGroup = weaveCatalog.passages
    .map((p) => `<option value="passage:${p.id}">${p.tab} · ${p.title}</option>`)
    .join('');
  const sGroup = weaveCatalog.shots
    .map((s) => `<option value="${s.id}">${s.district.toUpperCase()} · ${s.title}</option>`)
    .join('');
  sel.innerHTML = `<optgroup label="Registered WEAVE Passages">${pGroup}</optgroup><optgroup label="Multiplane District Shots">${sGroup}</optgroup>`;

  sel.addEventListener('change', (e) => selectEntryByKey(e.target.value));

  const rawHash = window.location.hash.replace(/^#/, '');
  if (rawHash === 'worldscore') setDrawerTab('worldscore');
  else if (rawHash === 'Dr-OUT' || rawHash === 'foley') setDrawerTab('foley');
  else if (rawHash === 'spine') setDrawerTab('spine');

  initShaderSuite();
  buildDarkroomWingGalleries();
  renderFoleyPadsUI();
  syncSceneToPilot(pilot);
  const heroDefault =
    weaveCatalog.shots.find((s) => s.id === 'bdc7d6ec-1d4e-4f99-ad7e-9917394c542a_2')?.id ||
    weaveCatalog.shots[0]?.id ||
    'passage:p04_hands';
  sel.value = heroDefault;
  await selectEntryByKey(heroDefault);
  drawWorldScoreCanvas();
  animate();
})();
