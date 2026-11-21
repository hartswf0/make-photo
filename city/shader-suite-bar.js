// Make-Photo City Universal Suite Navigation, 23-Look GPU Shader Pipeline,
// 5-Bus Door-Coupled Sound Mixer (Brief 8), and Severn Pilot State Sync (Brief 9).
// Zero-emoji, drop-in ES module for /city/ and all /city/<subpage>/ worlds.

import * as THREE_DEFAULT from 'three';
import {
  CITY_LOOKS,
  DISTRICT_PALETTE_LOOKS,
  ALL_CITY_LOOKS,
  CityShaderPipeline,
} from './shaders.js';
import { CityAudioEngine } from './audio.js';
import {
  loadPilotState,
  savePilotState,
  subscribePilotState,
  applyPilotUrlHash,
  formatPilotHash,
  deriveClockMapping,
  TIDE_PHASES,
} from './design-room/pilot-state.js';

export {
  CITY_LOOKS,
  DISTRICT_PALETTE_LOOKS,
  ALL_CITY_LOOKS,
  CityShaderPipeline,
  CityAudioEngine,
  loadPilotState,
  savePilotState,
  subscribePilotState,
  applyPilotUrlHash,
  formatPilotHash,
};

export const NOLLI_LEDGER_KEY = 'make_photo_city_nolli_v1';

export const SUITE_DESTINATIONS = [
  { id: 'design-room', label: 'Design Room', verb: 'Enter & inspect nine briefs', rel: './design-room/' },
  { id: 'nolli', label: 'Nolli Block', verb: 'Walk street, shop & screening hall', rel: './' },
  { id: 'foundry', label: 'Foundry + Inverse', verb: 'Evolve exterior & interior rooms', rel: './foundry/' },
  { id: 'heroes', label: 'Hero Inspector', verb: 'Audit six hero buildings & light', rel: './heroes/' },
  { id: 'island', label: 'Island GTA', verb: 'Traverse multi-district harbor city', rel: './island/' },
  { id: 'maps', label: 'City/Movie/Mood Maps', verb: 'Navigate City3D, MovieMap & mood', rel: './maps/' },
  { id: 'weave', label: 'WEAVE + Spine', verb: 'Stage multiplane depth & score', rel: './weave/' },
  { id: 'pointcloud', label: '3D Splats', verb: 'Reconstruct metric depth & mesh', rel: './pointcloud/' },
  { id: 'atlantis', label: 'Atlantis -> Oulipo', verb: 'Read rings, dive & screen poems', rel: './atlantis/' },
  { id: 'worldtext', label: 'Worldtext + Studio', verb: 'Compile accounts, rules & studio', rel: './worldtext/' },
];

export const SUITE_TIME_PRESETS = {
  dawn: {
    key: 'dawn',
    label: 'Dawn',
    worldTime: 6.5,
    sunElevation: 18,
    sunAzimuth: 52,
    sunIntensity: 2.6,
    hemiIntensity: 1.35,
    lampIntensity: 18.0,
    fogDensity: 0.0055,
    skyTop: '#243a52',
    skyMid: '#4f7391',
    skyHorizon: '#d9b18b',
    sunColor: '#ffd7ad',
    ambientGround: '#4a453f',
    windowGlow: 0.65,
    audioNightMix: 0.35,
  },
  midday: {
    key: 'midday',
    label: 'Midday',
    worldTime: 13.0,
    sunElevation: 56,
    sunAzimuth: 145,
    sunIntensity: 3.4,
    hemiIntensity: 1.65,
    lampIntensity: 2.0,
    fogDensity: 0.0036,
    skyTop: '#4c7294',
    skyMid: '#7ea6c4',
    skyHorizon: '#cbd6dc',
    sunColor: '#fff8ec',
    ambientGround: '#595752',
    windowGlow: 0.18,
    audioNightMix: 0.0,
  },
  bluehour: {
    key: 'bluehour',
    label: 'Blue Hour',
    worldTime: 18.5,
    sunElevation: 14,
    sunAzimuth: 42,
    sunIntensity: 2.15,
    hemiIntensity: 1.25,
    lampIntensity: 38.0,
    fogDensity: 0.0068,
    skyTop: '#0c1f38',
    skyMid: '#2c6294',
    skyHorizon: '#6f93b0',
    sunColor: '#c4daf2',
    ambientGround: '#333b44',
    windowGlow: 1.15,
    audioNightMix: 0.72,
  },
  night: {
    key: 'night',
    label: 'Night',
    worldTime: 22.5,
    sunElevation: 22,
    sunAzimuth: 220,
    sunIntensity: 0.95,
    hemiIntensity: 0.72,
    lampIntensity: 52.0,
    fogDensity: 0.0085,
    skyTop: '#08111e',
    skyMid: '#162d47',
    skyHorizon: '#2a4158',
    sunColor: '#90b6db',
    ambientGround: '#1e252e',
    windowGlow: 1.55,
    audioNightMix: 1.0,
  },
};

export function hourToTimeKey(hour) {
  const h = Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : 18.5;
  if (h >= 5.0 && h < 9.5) return 'dawn';
  if (h >= 9.5 && h < 16.5) return 'midday';
  if (h >= 16.5 && h < 20.5) return 'bluehour';
  return 'night';
}

function detectActiveDestinationId() {
  if (typeof window === 'undefined') return 'nolli';
  const p = window.location.pathname.toLowerCase();
  for (const dest of SUITE_DESTINATIONS) {
    if (dest.id === 'nolli') continue;
    if (p.includes(`/city/${dest.id}`)) return dest.id;
  }
  return 'nolli';
}

function ensureSuiteStylesheet() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('mp-suite-nav-css')) return;
  const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some((l) =>
    (l.getAttribute('href') || '').includes('suite-nav.css')
  );
  if (existing) return;
  const link = document.createElement('link');
  link.id = 'mp-suite-nav-css';
  link.rel = 'stylesheet';
  link.href = new URL('./suite-nav.css', import.meta.url).href;
  document.head.appendChild(link);
}

// ---------------------------------------------------------------------------
// Shared Nolli Block Ledger (Plates appear in Nolli Camera Shop & Light Table)
// ---------------------------------------------------------------------------
export function loadSharedLedger() {
  const fresh = {
    cartridge: 'ahiya',
    timeOfDay: 'bluehour',
    carriedWaterL: 0,
    standpipeReserveL: 40,
    projectorTankL: 0,
    plates: [],
    windowPlateIds: [null, null, null],
    screenPlateId: null,
  };
  try {
    if (typeof localStorage === 'undefined') return fresh;
    const raw = localStorage.getItem(NOLLI_LEDGER_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw);
    return {
      ...fresh,
      ...parsed,
      plates: Array.isArray(parsed?.plates) ? parsed.plates : [],
      windowPlateIds: Array.isArray(parsed?.windowPlateIds) && parsed.windowPlateIds.length === 3
        ? parsed.windowPlateIds
        : [null, null, null],
    };
  } catch {
    return fresh;
  }
}

export function exposeSharedPlate({
  sourceCanvas,
  beforeCapture,
  lookId = 'weave',
  timeOfDay = 'bluehour',
  focalMm = 35,
  focusM = 12.0,
  exposureEv = 0.0,
  locationName,
  cartridgeName,
  viewpoint = null,
} = {}) {
  if (typeof document === 'undefined' || !sourceCanvas) return null;
  if (typeof beforeCapture === 'function') {
    beforeCapture();
  }

  const off = document.createElement('canvas');
  off.width = 480;
  off.height = 300;
  const ctx = off.getContext('2d');
  ctx.fillStyle = '#0c1f38';
  ctx.fillRect(0, 0, off.width, off.height);
  ctx.drawImage(sourceCanvas, 0, 0, off.width, off.height);
  const dataUrl = off.toDataURL('image/jpeg', 0.86);

  const activeDest = SUITE_DESTINATIONS.find((d) => d.id === detectActiveDestinationId());
  const pilot = loadPilotState();
  const locLabel = locationName || (activeDest ? activeDest.label : 'City Studio');
  const cartLabel = cartridgeName || (pilot.world ? pilot.world.charAt(0).toUpperCase() + pilot.world.slice(1) : 'Atlantis');
  const lookObj = ALL_CITY_LOOKS.find((l) => l.id === lookId) || ALL_CITY_LOOKS[0];
  const preset = SUITE_TIME_PRESETS[timeOfDay] || SUITE_TIME_PRESETS.bluehour;

  const plate = {
    id: 'P-' + Date.now().toString(36).toUpperCase(),
    dataUrl,
    cartridge: cartLabel,
    locationName: locLabel,
    timeOfDay: preset.label,
    focalMm: Math.round(focalMm || 35),
    focusM: Number(focusM || 12),
    exposureEv: Number(exposureEv || 0),
    stock: lookObj.id.toUpperCase(),
    subjectId: null,
    subjectName: `${locLabel} (${pilot.building || 'severn'})`,
    permission: 'public',
    caption: `${cartLabel} - ${locLabel} (${focalMm || 35}mm, ${lookObj.name})`,
    viewpoint: viewpoint || { x: 0, y: 0, z: 12, yaw: 0, pitch: 0 },
  };

  const ledger = loadSharedLedger();
  ledger.plates.push(plate);
  if (ledger.plates.length > 9) {
    ledger.plates = ledger.plates.slice(-9);
  }
  const validIds = new Set(ledger.plates.map((p) => p.id));
  const prevWin = ledger.windowPlateIds.map((id) => (validIds.has(id) ? id : null));
  // Mount newly exposed public plate in Storefront Window #1 and shift prior plates
  ledger.windowPlateIds = [plate.id, prevWin[0], prevWin[1]];
  if (!ledger.screenPlateId || !validIds.has(ledger.screenPlateId)) {
    ledger.screenPlateId = plate.id;
  }

  try {
    localStorage.setItem(NOLLI_LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // Ignore storage quota errors
  }
  return { plate, totalPlates: ledger.plates.length };
}

// ---------------------------------------------------------------------------
// Brief 8: 5-Bus Door-Coupled Freesound Audio Mixer (Zero Continuous Drone,
// DelaySend = 0 Default, Speech Ducking, Explicit User Action + Mute)
// ---------------------------------------------------------------------------
export class SuiteAudioController extends CityAudioEngine {
  constructor() {
    super();
    const pilot = loadPilotState();
    this.busLevels = {
      voice: pilot.audioBuses?.voice ?? 0.9,
      closeAction: pilot.audioBuses?.closeAction ?? 0.72,
      localAmbience: pilot.audioBuses?.localAmbience ?? 0.58,
      distantCity: pilot.audioBuses?.distantCity ?? 0.36,
      music: pilot.audioBuses?.music ?? 0.42,
    };
    this.delaySend = 0.0; // Brief 8: default delay sends to zero (no voice doubling)
    this.muted = Boolean(pilot.audioBuses?.muted);
    this.doorOpen = pilot.doorOpen !== false;
    this.speakingDuck = 1.0;
    this.buses = null;
    this.doorFilter = null;
    this.distantDuckGain = null;
    this.musicDuckGain = null;
    this.voiceDelaySendGain = null;
  }

  async _loadSamples() {
    // Resolve relative to /city/shader-suite-bar.js -> /audio/samples/ so zero 404 from /city/<subpage>/
    const files = {
      field: 'ethiopia_field.mp3',
      waterBed: 'river_gorge.mp3',
      night: 'crickets_night.mp3',
      footstep: 'gravel_footsteps.mp3',
      pump: 'metal_pump.mp3',
      pour: 'water_pour.mp3',
    };
    await Promise.all(
      Object.entries(files).map(async ([key, filename]) => {
        try {
          const url = new URL(`../audio/samples/${filename}`, import.meta.url).href;
          const res = await fetch(url);
          if (!res.ok) return;
          const arr = await res.arrayBuffer();
          this.buffers[key] = await this.ctx.decodeAudioData(arr);
        } catch {
          // Graceful offline fallback
        }
      })
    );
  }

  _ensureBusGraph() {
    if (!this.ctx || this.buses) return;
    this.buses = {
      voice: this.ctx.createGain(),
      closeAction: this.ctx.createGain(),
      localAmbience: this.ctx.createGain(),
      distantCity: this.ctx.createGain(),
      music: this.ctx.createGain(),
    };

    // Door-coupled transmission lowpass for distant street bed
    this.doorFilter = this.ctx.createBiquadFilter();
    this.doorFilter.type = 'lowpass';
    this.doorFilter.frequency.value = this.doorOpen ? 13500 : 580;
    this.doorFilter.Q.value = 0.7;

    // Speech ducking stages on distant bed & music
    this.distantDuckGain = this.ctx.createGain();
    this.distantDuckGain.gain.value = 1.0;
    this.musicDuckGain = this.ctx.createGain();
    this.musicDuckGain.gain.value = 1.0;

    // Explicit zero-default delay send on voice (Brief 8)
    this.voiceDelaySendGain = this.ctx.createGain();
    this.voiceDelaySendGain.gain.value = 0.0;

    this.buses.voice.connect(this.master);
    this.buses.voice.connect(this.voiceDelaySendGain);
    this.voiceDelaySendGain.connect(this.convolver);

    this.buses.closeAction.connect(this.master);

    this.buses.localAmbience.connect(this.exteriorFilter);
    this.buses.localAmbience.connect(this.convolver);

    this.buses.distantCity.connect(this.doorFilter);
    this.doorFilter.connect(this.distantDuckGain);
    this.distantDuckGain.connect(this.master);

    this.buses.music.connect(this.musicDuckGain);
    this.musicDuckGain.connect(this.master);

    this._applyBusGains();
  }

  _startAmbientLoops() {
    if (!this.ctx) return;
    this._ensureBusGraph();
    const attachLoop = (key, gainVal, rate, targetBus) => {
      const buf = this.buffers[key];
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = gainVal;
      src.connect(g);
      g.connect(targetBus);
      src.start(0);
      this.loops[key] = { src, gain: g };
    };
    attachLoop('field', 0.34, 0.96, this.buses.distantCity);
    attachLoop('night', 0.24 * this.nightMix, 1.0, this.buses.distantCity);
    attachLoop('waterBed', 0.22, 0.92, this.buses.localAmbience);
  }

  _playOneShot(key, vol, rate = 1.0, maxDur = 0.4) {
    if (!this.enabled || this.muted || !this.ctx || !this.buffers[key]) return;
    this._ensureBusGraph();
    const buf = this.buffers[key];
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.buses.closeAction);
    if (!this.doorOpen || this.isInside) {
      g.connect(this.convolver);
    }
    const offset = Math.random() * Math.max(0, buf.duration - maxDur - 0.05);
    src.start(0, offset, Math.min(maxDur, buf.duration));
  }

  playShutter() {
    if (!this.enabled || this.muted || !this.ctx) return;
    this._ensureBusGraph();
    const now = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.055);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = i < len * 0.35 ? 1 - i / (len * 0.35) : 0.6 * (1 - (i - len * 0.35) / (len * 0.65));
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.buses.closeAction);
    src.start(now);
  }

  playDoorTransition(isOpen) {
    if (!this.enabled || this.muted || !this.ctx) return;
    this._playOneShot('pump', 0.22, isOpen ? 1.25 : 0.78, 0.14);
  }

  _applyBusGains() {
    if (!this.ctx || !this.buses) return;
    const now = this.ctx.currentTime;
    const doorAtten = this.doorOpen ? 1.0 : 0.32;
    this.buses.voice.gain.setTargetAtTime(this.busLevels.voice, now, 0.08);
    this.buses.closeAction.gain.setTargetAtTime(this.busLevels.closeAction, now, 0.08);
    this.buses.localAmbience.gain.setTargetAtTime(this.busLevels.localAmbience, now, 0.12);
    this.buses.distantCity.gain.setTargetAtTime(this.busLevels.distantCity * doorAtten, now, 0.16);
    this.buses.music.gain.setTargetAtTime(this.busLevels.music, now, 0.12);

    this.doorFilter.frequency.setTargetAtTime(this.doorOpen ? 13500 : 580, now, 0.18);
    if (this.interiorGain) {
      this.interiorGain.gain.setTargetAtTime(this.doorOpen ? 0.06 : 0.30, now, 0.18);
    }
    if (this.voiceDelaySendGain) {
      this.voiceDelaySendGain.gain.setTargetAtTime(this.delaySend, now, 0.1);
    }
    if (this.master) {
      const targetMaster = this.enabled && !this.muted ? 0.85 : 0.0001;
      this.master.gain.setTargetAtTime(targetMaster, now, 0.1);
    }
  }

  setBusLevel(busName, val, persist = true) {
    if (!Object.prototype.hasOwnProperty.call(this.busLevels, busName)) return;
    const clamped = Math.max(0, Math.min(1, Number(val) || 0));
    this.busLevels[busName] = clamped;
    this._applyBusGains();
    if (persist) {
      savePilotState({ audioBuses: { [busName]: clamped } }, { syncHash: false });
    }
  }

  setDoorOpen(isOpen, playLatch = false) {
    const next = Boolean(isOpen);
    const changed = this.doorOpen !== next;
    this.doorOpen = next;
    this.isInside = !next;
    this._applyBusGains();
    if (changed && playLatch) {
      this.playDoorTransition(next);
    }
  }

  setMuted(muted, persist = true) {
    this.muted = Boolean(muted);
    this._applyBusGains();
    if (this.muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
    if (persist) {
      savePilotState({ audioBuses: { muted: this.muted } }, { syncHash: false });
    }
  }

  setQuietListeningMode() {
    this.busLevels.voice = 0.92;
    this.busLevels.closeAction = 0.55;
    this.busLevels.localAmbience = 0.38;
    this.busLevels.distantCity = 0.14;
    this.busLevels.music = 0.0;
    this.delaySend = 0.0;
    this._applyBusGains();
    savePilotState({ audioBuses: { ...this.busLevels, delaySend: 0.0 } }, { syncHash: false });
  }

  setSpeechDucking(active) {
    this.speakingDuck = active ? 0.36 : 1.0;
    if (!this.ctx || !this.distantDuckGain) return;
    const now = this.ctx.currentTime;
    this.distantDuckGain.gain.setTargetAtTime(this.speakingDuck, now, 0.14);
    this.musicDuckGain.gain.setTargetAtTime(active ? 0.32 : 1.0, now, 0.14);
  }

  speakDuet(speakerName, text, pitch = 1.0) {
    if (!this.enabled || this.muted || this.busLevels.voice <= 0.02) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      this.setSpeechDucking(true);
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.96;
      u.pitch = pitch;
      u.volume = Math.min(1.0, this.busLevels.voice);
      u.onend = () => this.setSpeechDucking(false);
      u.onerror = () => this.setSpeechDucking(false);
      window.speechSynthesis.speak(u);
    } catch {
      this.setSpeechDucking(false);
    }
  }

  async toggle() {
    const result = await super.toggle();
    this._ensureBusGraph();
    if (result && this.muted) {
      this.muted = false;
    }
    this._applyBusGains();
    return this.enabled && !this.muted;
  }
}

// ---------------------------------------------------------------------------
// Page-Level Shared Suite Singleton (Supports both WebGL & Canvas2D together)
// ---------------------------------------------------------------------------
let sharedSuite = null;

function getOrCreateSharedSuite(initOpts = {}) {
  if (sharedSuite) {
    if (typeof initOpts.onTimeChange === 'function') {
      sharedSuite.timeCallbacks.add(initOpts.onTimeChange);
    }
    return sharedSuite;
  }

  ensureSuiteStylesheet();
  const hydratedPilot = applyPilotUrlHash();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const queryShader = searchParams.get('shader') || searchParams.get('look');
  const queryTime = searchParams.get('time');
  const queryEv = searchParams.get('ev');
  const queryFocus = searchParams.get('focus');

  const initialLookId =
    (queryShader && ALL_CITY_LOOKS.some((l) => l.id === queryShader) && queryShader) ||
    (hydratedPilot.shader && ALL_CITY_LOOKS.some((l) => l.id === hydratedPilot.shader) && hydratedPilot.shader) ||
    (initOpts.defaultLook && ALL_CITY_LOOKS.some((l) => l.id === initOpts.defaultLook) && initOpts.defaultLook) ||
    'weave';

  const initialTimeKey =
    (queryTime && SUITE_TIME_PRESETS[queryTime] && queryTime) ||
    hourToTimeKey(hydratedPilot.worldTime) ||
    initOpts.defaultTime ||
    'bluehour';

  const audio = new SuiteAudioController();
  audio.nightMix = SUITE_TIME_PRESETS[initialTimeKey].audioNightMix;

  const state = {
    lookId: initialLookId,
    focusM: queryFocus !== null ? Math.max(1, Math.min(35, Number(queryFocus) || 12)) : 12.0,
    dofEnabled: queryFocus !== null,
    ev: queryEv !== null ? Math.max(-2.4, Math.min(1.6, Number(queryEv) || 0)) : 0.0,
    timeOfDay: initialTimeKey,
    focalMm: hydratedPilot.camera?.focalMm || 35,
  };

  const activeDestId = detectActiveDestinationId();
  const isEntrancePage = activeDestId === 'design-room';

  const controller = {
    state,
    audio,
    targets: [], // { kind: 'webgl' | 'canvas2d', getCanvas, forceRender, isVisible }
    timeCallbacks: new Set(),
    ui: {},
    toastTimer: null,
  };
  if (typeof initOpts.onTimeChange === 'function') {
    controller.timeCallbacks.add(initOpts.onTimeChange);
  }

  // Persist explicit URL query overrides (?shader=woodblock&time=night) into pilot record
  if (queryShader || queryTime) {
    const queryPatch = {};
    if (queryShader && ALL_CITY_LOOKS.some((l) => l.id === queryShader)) {
      queryPatch.shader = initialLookId;
    }
    if (queryTime && SUITE_TIME_PRESETS[queryTime]) {
      queryPatch.worldTime = SUITE_TIME_PRESETS[initialTimeKey].worldTime;
    }
    if (Object.keys(queryPatch).length > 0) {
      savePilotState(queryPatch, { syncHash: false });
    }
  }

  controller.showToast = (msg, ms = 2800) => {
    const t = controller.ui.toast;
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(controller.toastTimer);
    controller.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  };

  controller.setLook = (lookId, announce = false, persistPilot = true) => {
    const found = ALL_CITY_LOOKS.find((l) => l.id === lookId) || ALL_CITY_LOOKS[0];
    state.lookId = found.id;
    if (controller.ui.shaderSelect) controller.ui.shaderSelect.value = found.id;
    if (controller._syncPaletteStrip) controller._syncPaletteStrip(found);
    if (persistPilot) {
      savePilotState({ shader: found.id });
    }
    if (announce) {
      controller.showToast(`GPU Shader: ${found.name} - ${found.desc}`);
    }
  };

  controller.nextLook = (announce = true) => {
    const idx = ALL_CITY_LOOKS.findIndex((l) => l.id === state.lookId);
    const next = ALL_CITY_LOOKS[(idx + 1) % ALL_CITY_LOOKS.length];
    controller.setLook(next.id, announce, true);
  };

  controller.prevLook = (announce = true) => {
    const idx = ALL_CITY_LOOKS.findIndex((l) => l.id === state.lookId);
    const prev = ALL_CITY_LOOKS[(idx - 1 + ALL_CITY_LOOKS.length) % ALL_CITY_LOOKS.length];
    controller.setLook(prev.id, announce, true);
  };

  controller.setFocus = (focusM, enableDof = true) => {
    state.focusM = Math.max(1, Math.min(35, Number(focusM) || 12));
    if (enableDof) state.dofEnabled = true;
    if (controller.ui.focusInput) controller.ui.focusInput.value = String(state.focusM);
    if (controller.ui.focusVal) controller.ui.focusVal.textContent = `${state.focusM.toFixed(1)}m`;
    if (controller.ui.dofBtn) controller.ui.dofBtn.classList.toggle('active', state.dofEnabled);
  };

  controller.setExposure = (ev) => {
    state.ev = Math.max(-2.4, Math.min(1.6, Number(ev) || 0));
    if (controller.ui.evInput) controller.ui.evInput.value = String(state.ev);
    if (controller.ui.evVal) {
      controller.ui.evVal.textContent = `${state.ev >= 0 ? '+' : ''}${state.ev.toFixed(1)}`;
    }
  };

  controller.setTime = (timeKey, announce = false, persistPilot = true) => {
    const preset = SUITE_TIME_PRESETS[timeKey] || SUITE_TIME_PRESETS.bluehour;
    state.timeOfDay = preset.key;
    audio.nightMix = preset.audioNightMix;
    if (controller.ui.timeButtons) {
      Object.entries(controller.ui.timeButtons).forEach(([k, btn]) => {
        btn.classList.toggle('active', k === preset.key);
      });
    }
    if (persistPilot) {
      savePilotState({ worldTime: preset.worldTime });
    }
    for (const cb of controller.timeCallbacks) {
      try {
        cb(preset.key, preset);
      } catch {
        // Isolate callback errors
      }
    }
    if (announce) {
      controller.showToast(`Time of Day: ${preset.label} (${preset.worldTime.toFixed(1)}h)`);
    }
  };

  controller.exposePlate = (customMeta = {}) => {
    const activeTarget =
      controller.targets.find((t) => t.isVisible()) ||
      controller.targets[controller.targets.length - 1];
    if (!activeTarget) return null;

    audio.playShutter();
    if (controller.ui.flash) {
      controller.ui.flash.style.opacity = '0.82';
      setTimeout(() => {
        controller.ui.flash.style.opacity = '0';
      }, 140);
    }

    const res = exposeSharedPlate({
      sourceCanvas: activeTarget.getCanvas(),
      beforeCapture: () => activeTarget.forceRender(),
      lookId: state.lookId,
      timeOfDay: state.timeOfDay,
      focalMm: customMeta.focalMm || state.focalMm || 35,
      focusM: state.focusM,
      exposureEv: state.ev,
      locationName: customMeta.locationName,
      cartridgeName: customMeta.cartridgeName,
      viewpoint: activeTarget.getViewpoint ? activeTarget.getViewpoint() : null,
    });

    if (res) {
      if (controller.ui.plateBadge) {
        controller.ui.plateBadge.textContent = `Plates: ${res.totalPlates}`;
      }
      controller.showToast(
        `Exposed ${res.plate.id} (${res.plate.stock}) -> saved to Nolli Camera Shop Window & Light Table.`,
        3600
      );
      return res.plate;
    }
    return null;
  };

  // Build Root UI Container
  if (typeof document !== 'undefined') {
    const root = document.createElement('div');
    root.className = 'mp-suite-root';
    root.id = 'mp-suite-root';

    // 1. Top Suite Navigation Bar
    if (initOpts.nav !== false) {
      const nav = document.createElement('nav');
      nav.className = `mp-suite-nav ${initOpts.navPosition === 'bottom' ? 'mp-pos-bottom' : 'mp-pos-top'}${isEntrancePage || initOpts.quietNav ? ' mp-quiet' : ''}`;
      nav.setAttribute('aria-label', 'Make-Photo City Suite Navigation');

      const brand = document.createElement('a');
      brand.className = 'mp-suite-brand';
      brand.href = new URL('./design-room/', import.meta.url).pathname;
      brand.innerHTML = '<span class="mp-suite-dot"></span><span>Make-Photo City</span>';
      nav.appendChild(brand);

      const linksWrap = document.createElement('div');
      linksWrap.className = 'mp-suite-links';
      const pillAnchors = [];

      SUITE_DESTINATIONS.forEach((dest) => {
        const a = document.createElement('a');
        a.className = 'mp-suite-pill' + (dest.id === activeDestId ? ' active' : '');
        if (dest.id === activeDestId) a.setAttribute('aria-current', 'page');
        a.dataset.destId = dest.id;
        a.dataset.baseHref = new URL(dest.rel, import.meta.url).pathname;
        a.href = a.dataset.baseHref + formatPilotHash(hydratedPilot);
        a.textContent = dest.label;
        a.title = `${dest.label}: ${dest.verb}`;
        linksWrap.appendChild(a);
        pillAnchors.push(a);
      });
      nav.appendChild(linksWrap);

      const rightWrap = document.createElement('div');
      rightWrap.className = 'mp-suite-right';

      const pilotChip = document.createElement('button');
      pilotChip.type = 'button';
      pilotChip.className = 'mp-pilot-chip';
      pilotChip.title = 'Open Shared Severn Pilot State (Brief 9)';
      rightWrap.appendChild(pilotChip);

      const routesBtn = document.createElement('button');
      routesBtn.type = 'button';
      routesBtn.className = 'mp-suite-toggle-btn';
      routesBtn.setAttribute('aria-expanded', 'false');
      routesBtn.textContent = 'Routes (10)';
      rightWrap.appendChild(routesBtn);

      const quietBtn = document.createElement('button');
      quietBtn.type = 'button';
      quietBtn.className = 'mp-suite-toggle-btn';
      quietBtn.textContent = nav.classList.contains('mp-quiet') ? 'Expand Bar' : 'Compact';
      quietBtn.title = 'Toggle compact corner navigation';
      rightWrap.appendChild(quietBtn);

      nav.appendChild(rightWrap);
      root.appendChild(nav);

      // Accessible Route Directory Sheet (Mobile + Entrance Friendly)
      const routeDrawer = document.createElement('div');
      routeDrawer.className = 'mp-route-drawer';
      routeDrawer.setAttribute('role', 'dialog');
      routeDrawer.setAttribute('aria-label', 'Suite Tool Directory');
      const drawerHead = document.createElement('div');
      drawerHead.className = 'mp-pop-head';
      drawerHead.innerHTML = '<span class="mp-pop-title">City Worlds &amp; Production Tools (Pilot State Preserved)</span>';
      const closeRoutes = document.createElement('button');
      closeRoutes.type = 'button';
      closeRoutes.className = 'mp-btn';
      closeRoutes.textContent = 'Close';
      drawerHead.appendChild(closeRoutes);
      routeDrawer.appendChild(drawerHead);

      const routeGrid = document.createElement('div');
      routeGrid.className = 'mp-route-grid';
      const cardAnchors = [];
      SUITE_DESTINATIONS.forEach((dest) => {
        const card = document.createElement('a');
        card.className = 'mp-route-card';
        if (dest.id === activeDestId) card.setAttribute('aria-current', 'page');
        card.dataset.baseHref = new URL(dest.rel, import.meta.url).pathname;
        card.href = card.dataset.baseHref + formatPilotHash(hydratedPilot);
        card.innerHTML = `<strong>${dest.label}</strong><span>${dest.verb}</span>`;
        routeGrid.appendChild(card);
        cardAnchors.push(card);
      });
      routeDrawer.appendChild(routeGrid);
      root.appendChild(routeDrawer);

      routesBtn.addEventListener('click', () => {
        const open = !routeDrawer.classList.contains('open');
        routeDrawer.classList.toggle('open', open);
        routesBtn.setAttribute('aria-expanded', String(open));
      });
      closeRoutes.addEventListener('click', () => {
        routeDrawer.classList.remove('open');
        routesBtn.setAttribute('aria-expanded', 'false');
      });
      quietBtn.addEventListener('click', () => {
        const q = !nav.classList.contains('mp-quiet');
        nav.classList.toggle('mp-quiet', q);
        quietBtn.textContent = q ? 'Expand Bar' : 'Compact';
      });

      controller.ui.nav = nav;
      controller.ui.pilotChip = pilotChip;
      controller.ui.routeAnchors = [...pillAnchors, ...cardAnchors];
    }

    // 2. Bottom 23-Shader, Lens, Time, 5-Bus Sound & Plate Capture Capsule
    const dock = document.createElement('div');
    dock.className = 'mp-shader-dock' + (isEntrancePage || initOpts.collapsedDock ? ' mp-dock-collapsed' : '');
    dock.setAttribute('role', 'region');
    dock.setAttribute('aria-label', 'GPU Shader, Camera, Sound and Shared Pilot Controls');

    const dockBody = document.createElement('div');
    dockBody.className = 'mp-dock-body';

    // Shader Prev / Select / Next + Palette Swatch
    const shaderGroup = document.createElement('div');
    shaderGroup.className = 'mp-dock-group';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'mp-btn';
    prevBtn.textContent = '[';
    prevBtn.title = 'Previous GPU Shader ([)';

    const shaderSelect = document.createElement('select');
    shaderSelect.className = 'mp-shader-select';
    shaderSelect.setAttribute('aria-label', 'Select GPU Shader Look (23 total)');
    const grpZone = document.createElement('optgroup');
    grpZone.label = 'WEAVE & Zone GPU Shaders (16)';
    CITY_LOOKS.forEach((look) => {
      const opt = document.createElement('option');
      opt.value = look.id;
      opt.textContent = look.name;
      grpZone.appendChild(opt);
    });
    const grpDist = document.createElement('optgroup');
    grpDist.label = 'District Palette LUTs (7)';
    DISTRICT_PALETTE_LOOKS.forEach((look) => {
      const opt = document.createElement('option');
      opt.value = look.id;
      opt.textContent = look.name;
      grpDist.appendChild(opt);
    });
    shaderSelect.append(grpZone, grpDist);
    shaderSelect.value = state.lookId;

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'mp-btn';
    nextBtn.textContent = ']';
    nextBtn.title = 'Next GPU Shader (])';

    const palStrip = document.createElement('span');
    palStrip.className = 'mp-pal-strip';
    for (let i = 0; i < 6; i++) {
      const chip = document.createElement('span');
      chip.className = 'mp-pal-chip';
      palStrip.appendChild(chip);
    }

    shaderGroup.append(prevBtn, shaderSelect, nextBtn, palStrip);
    dockBody.appendChild(shaderGroup);

    // Focus (1-35m) + DoF Toggle + EV (-2.4 to +1.6)
    const lensGroup = document.createElement('div');
    lensGroup.className = 'mp-dock-group';

    const focusWrap = document.createElement('div');
    focusWrap.className = 'mp-slider-wrap';
    const focusLbl = document.createElement('span');
    focusLbl.className = 'mp-slider-lbl';
    focusLbl.textContent = 'Focus';
    const focusInput = document.createElement('input');
    focusInput.type = 'range';
    focusInput.min = '1';
    focusInput.max = '35';
    focusInput.step = '0.5';
    focusInput.value = String(state.focusM);
    focusInput.setAttribute('aria-label', 'Focus Distance in meters');
    const focusVal = document.createElement('span');
    focusVal.className = 'mp-slider-val';
    focusVal.textContent = `${state.focusM.toFixed(1)}m`;
    focusWrap.append(focusLbl, focusInput, focusVal);

    const dofBtn = document.createElement('button');
    dofBtn.type = 'button';
    dofBtn.className = 'mp-btn' + (state.dofEnabled ? ' active' : '');
    dofBtn.textContent = 'DoF';
    dofBtn.title = 'Toggle Optical Depth-of-Field Blur';

    const evWrap = document.createElement('div');
    evWrap.className = 'mp-slider-wrap';
    const evLbl = document.createElement('span');
    evLbl.className = 'mp-slider-lbl';
    evLbl.textContent = 'EV';
    const evInput = document.createElement('input');
    evInput.type = 'range';
    evInput.min = '-2.4';
    evInput.max = '1.6';
    evInput.step = '0.1';
    evInput.value = String(state.ev);
    evInput.setAttribute('aria-label', 'Exposure Compensation EV');
    const evVal = document.createElement('span');
    evVal.className = 'mp-slider-val';
    evVal.textContent = `${state.ev >= 0 ? '+' : ''}${state.ev.toFixed(1)}`;
    evWrap.append(evLbl, evInput, evVal);

    lensGroup.append(focusWrap, dofBtn, evWrap);
    dockBody.appendChild(lensGroup);

    // Time of Day Buttons (Dawn / Midday / Blue Hour / Night)
    const timeGroup = document.createElement('div');
    timeGroup.className = 'mp-dock-group';
    const timeButtons = {};
    Object.values(SUITE_TIME_PRESETS).forEach((preset) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mp-btn mp-brass-active' + (preset.key === state.timeOfDay ? ' active' : '');
      b.textContent = preset.label;
      b.addEventListener('click', () => controller.setTime(preset.key, true));
      timeGroup.appendChild(b);
      timeButtons[preset.key] = b;
    });
    dockBody.appendChild(timeGroup);

    // Sound Start / Mute + 5-Bus Mixer Button + Severn Door Quick Button
    const soundGroup = document.createElement('div');
    soundGroup.className = 'mp-dock-group';

    const audioStartBtn = document.createElement('button');
    audioStartBtn.type = 'button';
    audioStartBtn.className = 'mp-btn';
    audioStartBtn.textContent = 'Start Sound';
    audioStartBtn.title = 'Start Freesound Spatial Audio (Explicit User Action)';

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'mp-btn' + (audio.muted ? ' mp-mute-on' : '');
    muteBtn.textContent = audio.muted ? 'Unmute' : 'Mute';
    muteBtn.style.display = 'none';

    const mixerBtn = document.createElement('button');
    mixerBtn.type = 'button';
    mixerBtn.className = 'mp-btn';
    mixerBtn.textContent = '5-Bus Mix';
    mixerBtn.title = 'Open 5-Bus Audio & Door Transmission Controls (Brief 8)';

    soundGroup.append(audioStartBtn, muteBtn, mixerBtn);
    dockBody.appendChild(soundGroup);

    // Expose Plate (Space) + Plate Counter
    const captureGroup = document.createElement('div');
    captureGroup.className = 'mp-dock-group';

    const shutterBtn = document.createElement('button');
    shutterBtn.type = 'button';
    shutterBtn.className = 'mp-shutter-btn';
    shutterBtn.textContent = 'Expose Plate (Space)';

    const plateBadge = document.createElement('span');
    plateBadge.className = 'mp-plate-badge';
    const initialLedger = loadSharedLedger();
    plateBadge.textContent = `Plates: ${initialLedger.plates.length}`;

    captureGroup.append(shutterBtn, plateBadge);
    dockBody.appendChild(captureGroup);

    dock.appendChild(dockBody);

    const collapseDockBtn = document.createElement('button');
    collapseDockBtn.type = 'button';
    collapseDockBtn.className = 'mp-suite-toggle-btn';
    collapseDockBtn.textContent = dock.classList.contains('mp-dock-collapsed')
      ? 'Shader & Sound (23)'
      : 'Hide';
    collapseDockBtn.title = 'Collapse or expand bottom shader capsule';
    dock.appendChild(collapseDockBtn);

    root.appendChild(dock);

    // 3. Brief 8 Popover: 5-Bus Audio Mixer + Door Transmission + Quiet Mode
    const soundPopover = document.createElement('div');
    soundPopover.className = 'mp-popover';
    soundPopover.setAttribute('role', 'dialog');
    soundPopover.setAttribute('aria-label', 'Five-Bus Sound and Door Transmission Mixer');
    soundPopover.innerHTML = `
      <div class="mp-pop-head">
        <span class="mp-pop-title">Brief 8 - 5-Bus Sound &amp; Door Transmission (DelaySend = 0)</span>
        <div class="mp-dock-group">
          <button type="button" class="mp-btn" data-mp-act="quiet">Quiet Mode</button>
          <button type="button" class="mp-btn" data-mp-act="close-sound">Close</button>
        </div>
      </div>
      <div style="font-size:10.5px;color:var(--mp-muted);margin-bottom:8px;">
        Zero synthetic drone. Voice delay send defaults to 0.00; speech ducks distant city bed; Severn door state controls low-pass (13.5 kHz open vs 580 Hz closed) and stone room reverb.
      </div>
      <div class="mp-bus-list"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--mp-rule);">
        <span class="mp-door-acoustic-readout" style="font-size:10.5px;color:var(--mp-cyan);"></span>
        <button type="button" class="mp-btn" data-mp-act="toggle-door">Toggle Severn Door</button>
      </div>
    `;
    const busListEl = soundPopover.querySelector('.mp-bus-list');
    const busSpecs = [
      ['voice', 'Voice (Dry Ref)'],
      ['closeAction', 'Close Action'],
      ['localAmbience', 'Local Ambience'],
      ['distantCity', 'Distant City'],
      ['music', 'Music / Score'],
    ];
    const busInputs = {};
    busSpecs.forEach(([key, label]) => {
      const row = document.createElement('div');
      row.className = 'mp-bus-row';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = '0';
      inp.max = '1';
      inp.step = '0.02';
      inp.value = String(audio.busLevels[key]);
      inp.setAttribute('aria-label', `${label} bus gain`);
      const valEl = document.createElement('span');
      valEl.className = 'mp-bus-val';
      valEl.textContent = `${Math.round(audio.busLevels[key] * 100)}%`;
      inp.addEventListener('input', () => {
        const v = Number(inp.value);
        valEl.textContent = `${Math.round(v * 100)}%`;
        audio.setBusLevel(key, v, true);
      });
      row.append(lbl, inp, valEl);
      busListEl.appendChild(row);
      busInputs[key] = { inp, valEl };
    });
    root.appendChild(soundPopover);

    // 4. Brief 9 Popover: Shared Severn Pilot Record Across All Tools
    const pilotPopover = document.createElement('div');
    pilotPopover.className = 'mp-popover';
    pilotPopover.setAttribute('role', 'dialog');
    pilotPopover.setAttribute('aria-label', 'Shared Severn Pilot State');
    const poemOptions = Array.from({ length: 14 }, (_, i) => {
      const p = String(i + 1).padStart(2, '0');
      return `<option value="${p}">Poem ${p}</option>`;
    }).join('');
    const tideOptions = TIDE_PHASES.map((t) => `<option value="${t.id}">${t.label}</option>`).join('');
    pilotPopover.innerHTML = `
      <div class="mp-pop-head">
        <span class="mp-pop-title">Brief 9 - Severn Pilot Shared World Record</span>
        <button type="button" class="mp-btn" data-mp-act="close-pilot">Close</button>
      </div>
      <div class="mp-pilot-grid">
        <div class="mp-pilot-field">
          <label>Severn Threshold Door</label>
          <select data-pilot-key="doorOpen">
            <option value="true">Open (Street Clear - 13.5 kHz)</option>
            <option value="false">Closed (Interior Muffled - 580 Hz)</option>
          </select>
        </div>
        <div class="mp-pilot-field">
          <label>Parcel Ownership</label>
          <select data-pilot-key="parcelHolder">
            <option value="player">Player (Courier)</option>
            <option value="bekele">Bekele (Vestibule Keeper)</option>
            <option value="maren">Maren (Flat 2A)</option>
          </select>
        </div>
        <div class="mp-pilot-field">
          <label>Selected Poem</label>
          <select data-pilot-key="poem">${poemOptions}</select>
        </div>
        <div class="mp-pilot-field">
          <label>Tide Phase (+4.0m Datum)</label>
          <select data-pilot-key="tidePhase">${tideOptions}</select>
        </div>
        <div class="mp-pilot-field">
          <label>Local World Hour (0-24h)</label>
          <input type="range" min="0" max="23.75" step="0.25" data-pilot-key="worldTime">
        </div>
        <div class="mp-pilot-field">
          <label>Clock &amp; Era Readout</label>
          <div class="mp-clock-readout" style="padding:5px 0;font-size:11px;color:var(--mp-brass);"></div>
        </div>
      </div>
    `;
    root.appendChild(pilotPopover);

    // 5. Shutter Flash + Toast
    const flash = document.createElement('div');
    flash.className = 'mp-shutter-flash';
    const toast = document.createElement('div');
    toast.className = 'mp-suite-toast';
    toast.setAttribute('role', 'status');
    root.append(flash, toast);

    document.body.appendChild(root);

    Object.assign(controller.ui, {
      root,
      dock,
      collapseDockBtn,
      shaderSelect,
      palStrip,
      focusInput,
      focusVal,
      dofBtn,
      evInput,
      evVal,
      timeButtons,
      audioStartBtn,
      muteBtn,
      mixerBtn,
      shutterBtn,
      plateBadge,
      soundPopover,
      pilotPopover,
      busInputs,
      flash,
      toast,
    });

    // Wire UI Events
    prevBtn.addEventListener('click', () => controller.prevLook(true));
    nextBtn.addEventListener('click', () => controller.nextLook(true));
    shaderSelect.addEventListener('change', (e) => controller.setLook(e.target.value, true));

    focusInput.addEventListener('input', (e) => {
      controller.setFocus(Number(e.target.value), true);
    });
    dofBtn.addEventListener('click', () => {
      state.dofEnabled = !state.dofEnabled;
      dofBtn.classList.toggle('active', state.dofEnabled);
    });
    evInput.addEventListener('input', (e) => {
      controller.setExposure(Number(e.target.value));
    });

    audioStartBtn.addEventListener('click', async () => {
      const active = await audio.toggle();
      syncAudioUI();
      controller.showToast(
        active
          ? 'Freesound 5-bus spatial audio active (delaySend = 0, door-coupled).'
          : 'Audio paused.'
      );
    });
    muteBtn.addEventListener('click', () => {
      audio.setMuted(!audio.muted, true);
      syncAudioUI();
    });
    mixerBtn.addEventListener('click', () => {
      pilotPopover.classList.remove('open');
      soundPopover.classList.toggle('open');
    });
    soundPopover.querySelector('[data-mp-act="close-sound"]').addEventListener('click', () => {
      soundPopover.classList.remove('open');
    });
    soundPopover.querySelector('[data-mp-act="quiet"]').addEventListener('click', () => {
      audio.setQuietListeningMode();
      syncPilotToUI(loadPilotState());
      controller.showToast('Quiet listening mode: dry voice prioritized, distant city bed reduced.');
    });
    soundPopover.querySelector('[data-mp-act="toggle-door"]').addEventListener('click', () => {
      const cur = loadPilotState();
      savePilotState({ doorOpen: !cur.doorOpen });
      audio.playDoorTransition(!cur.doorOpen);
    });

    if (controller.ui.pilotChip) {
      controller.ui.pilotChip.addEventListener('click', () => {
        soundPopover.classList.remove('open');
        pilotPopover.classList.toggle('open');
      });
    }
    pilotPopover.querySelector('[data-mp-act="close-pilot"]').addEventListener('click', () => {
      pilotPopover.classList.remove('open');
    });
    pilotPopover.querySelectorAll('[data-pilot-key]').forEach((el) => {
      const k = el.getAttribute('data-pilot-key');
      el.addEventListener('input', () => {
        let val = el.value;
        if (k === 'doorOpen') val = el.value === 'true';
        if (k === 'worldTime') val = Number(el.value);
        savePilotState({ [k]: val });
        if (k === 'worldTime') {
          controller.setTime(hourToTimeKey(val), false, false);
        }
      });
    });

    shutterBtn.addEventListener('click', () => controller.exposePlate());

    collapseDockBtn.addEventListener('click', () => {
      const c = !dock.classList.contains('mp-dock-collapsed');
      dock.classList.toggle('mp-dock-collapsed', c);
      collapseDockBtn.textContent = c ? 'Shader & Sound (23)' : 'Hide';
    });

    function syncAudioUI() {
      if (audio.enabled) {
        audioStartBtn.textContent = 'Sound: On';
        audioStartBtn.classList.add('active');
        muteBtn.style.display = 'inline-block';
      } else {
        audioStartBtn.textContent = 'Start Sound';
        audioStartBtn.classList.remove('active');
        muteBtn.style.display = 'none';
      }
      muteBtn.textContent = audio.muted ? 'Unmute' : 'Mute';
      muteBtn.classList.toggle('mp-mute-on', audio.muted);
    }

    function syncPaletteStrip(lookObj) {
      if (lookObj && lookObj.colors && lookObj.colors.length >= 6) {
        palStrip.classList.add('visible');
        Array.from(palStrip.children).forEach((c, idx) => {
          c.style.background = lookObj.colors[idx];
        });
      } else {
        palStrip.classList.remove('visible');
      }
    }

    function syncPilotToUI(pilotState) {
      const clock = deriveClockMapping(pilotState);
      audio.setDoorOpen(pilotState.doorOpen, false);

      if (pilotState.audioBuses) {
        for (const [k, obj] of Object.entries(busInputs)) {
          if (typeof pilotState.audioBuses[k] === 'number') {
            audio.busLevels[k] = pilotState.audioBuses[k];
            obj.inp.value = String(pilotState.audioBuses[k]);
            obj.valEl.textContent = `${Math.round(pilotState.audioBuses[k] * 100)}%`;
          }
        }
        audio._applyBusGains();
      }

      if (controller.ui.pilotChip) {
        const doorTxt = pilotState.doorOpen ? 'Door Open' : 'Door Closed';
        controller.ui.pilotChip.textContent =
          `Poem ${pilotState.poem} | ${doorTxt} | Parcel: ${pilotState.parcelHolder} | ${clock.formattedLocalTime}`;
      }

      if (controller.ui.routeAnchors) {
        const hashStr = formatPilotHash(pilotState);
        controller.ui.routeAnchors.forEach((a) => {
          a.href = a.dataset.baseHref + hashStr;
        });
      }

      const doorReadout = soundPopover.querySelector('.mp-door-acoustic-readout');
      if (doorReadout) {
        doorReadout.textContent = pilotState.doorOpen
          ? 'Severn Door: OPEN (13.5 kHz street clear, 6% stone reverb)'
          : 'Severn Door: CLOSED (580 Hz wall muffling, 30% stone reverb)';
      }

      pilotPopover.querySelectorAll('[data-pilot-key]').forEach((el) => {
        const k = el.getAttribute('data-pilot-key');
        const nextVal = String(pilotState[k]);
        if (document.activeElement !== el) {
          el.value = nextVal;
        }
      });
      const clockEl = pilotPopover.querySelector('.mp-clock-readout');
      if (clockEl) {
        clockEl.textContent = `${clock.formattedLocalTime} | ${clock.tideLabel}`;
      }

      if (pilotState.shader && pilotState.shader !== state.lookId && ALL_CITY_LOOKS.some((l) => l.id === pilotState.shader)) {
        controller.setLook(pilotState.shader, false, false);
      }
      const mappedTime = hourToTimeKey(pilotState.worldTime);
      if (mappedTime !== state.timeOfDay) {
        controller.setTime(mappedTime, false, false);
      }
    }

    controller._syncPaletteStrip = syncPaletteStrip;
    controller._syncPilotToUI = syncPilotToUI;
    syncPaletteStrip(ALL_CITY_LOOKS.find((l) => l.id === state.lookId));
    syncPilotToUI(loadPilotState());

    subscribePilotState((nextPilot) => {
      syncPilotToUI(nextPilot);
    });

    // Global Hotkeys: [ / ] for shader cycling, Space for Expose Plate
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      const tag = activeEl ? activeEl.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || activeEl?.isContentEditable) {
        return;
      }
      if (e.key === '[') {
        e.preventDefault();
        controller.prevLook(true);
      } else if (e.key === ']') {
        e.preventDefault();
        controller.nextLook(true);
      } else if (e.code === 'Space' && !e.repeat && tag !== 'BUTTON' && initOpts.captureOnSpace !== false) {
        // Only prevent default if page body doesn't scroll
        if (getComputedStyle(document.body).overflow === 'hidden') {
          e.preventDefault();
        }
        controller.exposePlate();
      }
    });
  }

  sharedSuite = controller;
  return controller;
}

// ---------------------------------------------------------------------------
// 1. Standalone Suite Navigation Mount (Optional if page only wants nav bar)
// ---------------------------------------------------------------------------
export function mountSuiteNav(options = {}) {
  const ctrl = getOrCreateSharedSuite({ ...options, collapsedDock: options.collapsedDock ?? true });
  return ctrl.ui.nav || null;
}

// ---------------------------------------------------------------------------
// 2. WebGL Three.js 23-Shader Suite Wrapper
// Works seamlessly whether caller invokes `suite.render()` OR keeps calling
// `renderer.render(scene, camera)` directly in their animation loop!
// ---------------------------------------------------------------------------
export function mountWebGLShaderSuite({
  THREE = THREE_DEFAULT,
  renderer,
  scene,
  camera,
  onTimeChange,
  defaultLook,
  defaultTime,
  locationName,
  cartridgeName,
  navPosition,
  quietNav,
  collapsedDock,
  captureOnSpace,
  autoIntercept = true,
} = {}) {
  if (!renderer) {
    throw new Error('mountWebGLShaderSuite requires a Three.js WebGLRenderer (`renderer`).');
  }

  const ctrl = getOrCreateSharedSuite({
    onTimeChange,
    defaultLook,
    defaultTime,
    navPosition,
    quietNav,
    collapsedDock,
    captureOnSpace,
  });

  const sizeVec = new THREE.Vector2();
  renderer.getSize(sizeVec);
  const pr0 = renderer.getPixelRatio();
  let lastCssW = Math.max(1, sizeVec.x);
  let lastCssH = Math.max(1, sizeVec.y);
  let lastPr = pr0;

  const pipeline = new CityShaderPipeline(
    renderer,
    Math.max(1, Math.floor(lastCssW * pr0)),
    Math.max(1, Math.floor(lastCssH * pr0))
  );

  let activeScene = scene || null;
  let activeCamera = camera || null;
  let inPipeline = false;
  const rawRender = renderer.render.bind(renderer);

  function renderThroughSuite(overrideScene, overrideCamera) {
    const s = overrideScene || activeScene;
    const c = overrideCamera || activeCamera;
    if (!s || !c) return;
    activeScene = s;
    activeCamera = c;

    renderer.getSize(sizeVec);
    const pr = renderer.getPixelRatio();
    if (sizeVec.x !== lastCssW || sizeVec.y !== lastCssH || pr !== lastPr) {
      lastCssW = Math.max(1, sizeVec.x);
      lastCssH = Math.max(1, sizeVec.y);
      lastPr = pr;
      pipeline.setSize(lastCssW, lastCssH);
    }

    const lookObj = ALL_CITY_LOOKS.find((l) => l.id === ctrl.state.lookId) || ALL_CITY_LOOKS[0];
    inPipeline = true;
    try {
      pipeline.render(s, c, {
        time: performance.now() * 0.001,
        focusM: ctrl.state.focusM,
        dofAmount: ctrl.state.dofEnabled ? 0.58 : 0.0,
        ev: ctrl.state.ev,
        mode: lookObj.mode,
        paletteColors: lookObj.colors,
      });
    } finally {
      inPipeline = false;
    }
  }

  if (autoIntercept) {
    renderer.render = (s, c) => {
      if (
        !inPipeline &&
        renderer.getRenderTarget() === null &&
        s !== pipeline.postScene &&
        (s === activeScene || !activeScene || renderer.autoClear !== false)
      ) {
        renderThroughSuite(s, c);
        return;
      }
      rawRender(s, c);
    };
  }

  const targetEntry = {
    kind: 'webgl',
    getCanvas: () => renderer.domElement,
    forceRender: () => renderThroughSuite(activeScene, activeCamera),
    isVisible: () => {
      const el = renderer.domElement;
      if (!el || !el.isConnected) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    },
    getViewpoint: () =>
      activeCamera
        ? { x: activeCamera.position.x, y: activeCamera.position.y, z: activeCamera.position.z, yaw: 0, pitch: 0 }
        : null,
  };
  ctrl.targets.push(targetEntry);

  if (typeof onTimeChange === 'function') {
    queueMicrotask(() => {
      const preset = SUITE_TIME_PRESETS[ctrl.state.timeOfDay] || SUITE_TIME_PRESETS.bluehour;
      onTimeChange(preset.key, preset);
    });
  }

  return {
    pipeline,
    audio: ctrl.audio,
    looks: ALL_CITY_LOOKS,
    timePresets: SUITE_TIME_PRESETS,
    getState: () => ({ ...ctrl.state, pilot: loadPilotState() }),
    setLook: ctrl.setLook,
    nextLook: ctrl.nextLook,
    prevLook: ctrl.prevLook,
    setFocus: ctrl.setFocus,
    setExposure: ctrl.setExposure,
    setTime: ctrl.setTime,
    setSceneCamera: (nextScene, nextCamera) => {
      if (nextScene) activeScene = nextScene;
      if (nextCamera) activeCamera = nextCamera;
    },
    render: renderThroughSuite,
    exposePlate: (meta = {}) =>
      ctrl.exposePlate({ locationName, cartridgeName, ...meta }),
    speakLine: (speaker, text, pitch = 1.0) => ctrl.audio.speakDuet(speaker, text, pitch),
    updateAudio: (dt, params) => ctrl.audio.update(dt, params),
    showToast: ctrl.showToast,
    destroy: () => {
      renderer.render = rawRender;
      const idx = ctrl.targets.indexOf(targetEntry);
      if (idx >= 0) ctrl.targets.splice(idx, 1);
    },
  };
}

// ---------------------------------------------------------------------------
// 3. 2D Canvas 23-Shader Post-Process Overlay Suite
// Wraps any 2D <canvas> in a live WebGL CityShaderPipeline overlay with
// pointer-events: none so 2D interactions work seamlessly underneath!
// ---------------------------------------------------------------------------
export function mountCanvas2DShaderSuite({
  sourceCanvas,
  onTimeChange,
  defaultLook,
  defaultTime,
  locationName,
  cartridgeName,
  navPosition,
  quietNav,
  collapsedDock,
  captureOnSpace,
  autoLoop = true,
} = {}) {
  if (!sourceCanvas) {
    throw new Error('mountCanvas2DShaderSuite requires `sourceCanvas`.');
  }

  const ctrl = getOrCreateSharedSuite({
    onTimeChange,
    defaultLook,
    defaultTime,
    navPosition,
    quietNav,
    collapsedDock,
    captureOnSpace,
  });

  const overlayRenderer = new THREE_DEFAULT.WebGLRenderer({
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  const pr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
  overlayRenderer.setPixelRatio(pr);

  const initW = Math.max(2, sourceCanvas.clientWidth || sourceCanvas.width || 800);
  const initH = Math.max(2, sourceCanvas.clientHeight || sourceCanvas.height || 600);
  overlayRenderer.setSize(initW, initH, false);

  const overlayEl = overlayRenderer.domElement;
  overlayEl.className = 'mp-canvas2d-overlay';
  const parent = sourceCanvas.parentElement || document.body;
  if (parent && getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }
  sourceCanvas.insertAdjacentElement('afterend', overlayEl);

  const pipeline = new CityShaderPipeline(
    overlayRenderer,
    Math.max(2, Math.floor(initW * pr)),
    Math.max(2, Math.floor(initH * pr))
  );

  const canvasTex = new THREE_DEFAULT.CanvasTexture(sourceCanvas);
  canvasTex.colorSpace = THREE_DEFAULT.SRGBColorSpace;
  canvasTex.minFilter = THREE_DEFAULT.LinearFilter;
  canvasTex.magFilter = THREE_DEFAULT.LinearFilter;

  // Orthographic fullscreen quad with vertical depth ramp (3m..28m) so
  // screen (x,y) has zero distortion while Focus DoF & Glass X-Ray contours work!
  const planeGeo = new THREE_DEFAULT.PlaneGeometry(2, 2, 1, 1);
  const posAttr = planeGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    posAttr.setZ(i, y > 0 ? -28.0 : -3.5);
  }
  posAttr.needsUpdate = true;

  const quadMat = new THREE_DEFAULT.MeshBasicMaterial({
    map: canvasTex,
    toneMapped: false,
    depthWrite: true,
    depthTest: true,
  });
  const quadScene = new THREE_DEFAULT.Scene();
  quadScene.add(new THREE_DEFAULT.Mesh(planeGeo, quadMat));
  const quadCam = new THREE_DEFAULT.OrthographicCamera(-1, 1, 1, -1, 0.5, 60);

  let lastW = initW;
  let lastH = initH;
  let destroyed = false;

  function syncAndRender() {
    if (destroyed || !sourceCanvas.isConnected) return;
    const cs = getComputedStyle(sourceCanvas);
    const rect = sourceCanvas.getBoundingClientRect();
    if (
      cs.display === 'none' ||
      cs.visibility === 'hidden' ||
      parseFloat(cs.opacity) === 0 ||
      rect.width < 2 ||
      rect.height < 2 ||
      sourceCanvas.width < 1 ||
      sourceCanvas.height < 1
    ) {
      overlayEl.style.display = 'none';
      return;
    }

    overlayEl.style.display = 'block';
    if (cs.position === 'fixed') {
      overlayEl.style.position = 'fixed';
      overlayEl.style.left = `${rect.left}px`;
      overlayEl.style.top = `${rect.top}px`;
    } else {
      overlayEl.style.position = 'absolute';
      overlayEl.style.left = `${sourceCanvas.offsetLeft}px`;
      overlayEl.style.top = `${sourceCanvas.offsetTop}px`;
    }
    overlayEl.style.width = `${rect.width}px`;
    overlayEl.style.height = `${rect.height}px`;
    overlayEl.style.zIndex = cs.zIndex || 'auto';

    const w = Math.max(2, Math.round(rect.width));
    const h = Math.max(2, Math.round(rect.height));
    if (w !== lastW || h !== lastH) {
      lastW = w;
      lastH = h;
      overlayRenderer.setSize(w, h, false);
      pipeline.setSize(w, h);
    }

    canvasTex.needsUpdate = true;
    const lookObj = ALL_CITY_LOOKS.find((l) => l.id === ctrl.state.lookId) || ALL_CITY_LOOKS[0];
    pipeline.render(quadScene, quadCam, {
      time: performance.now() * 0.001,
      focusM: ctrl.state.focusM,
      dofAmount: ctrl.state.dofEnabled ? 0.52 : 0.0,
      ev: ctrl.state.ev,
      mode: lookObj.mode,
      paletteColors: lookObj.colors,
    });
  }

  function tick() {
    if (destroyed) return;
    syncAndRender();
    if (autoLoop) requestAnimationFrame(tick);
  }
  if (autoLoop && typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(tick);
  }

  const targetEntry = {
    kind: 'canvas2d',
    getCanvas: () => overlayEl,
    forceRender: syncAndRender,
    isVisible: () => overlayEl.isConnected && overlayEl.style.display !== 'none',
    getViewpoint: () => ({ x: 0, y: 12, z: 0, yaw: 0, pitch: -1.57 }),
  };
  ctrl.targets.push(targetEntry);

  if (typeof onTimeChange === 'function') {
    queueMicrotask(() => {
      const preset = SUITE_TIME_PRESETS[ctrl.state.timeOfDay] || SUITE_TIME_PRESETS.bluehour;
      onTimeChange(preset.key, preset);
    });
  }

  return {
    pipeline,
    overlayCanvas: overlayEl,
    audio: ctrl.audio,
    looks: ALL_CITY_LOOKS,
    timePresets: SUITE_TIME_PRESETS,
    getState: () => ({ ...ctrl.state, pilot: loadPilotState() }),
    setLook: ctrl.setLook,
    nextLook: ctrl.nextLook,
    prevLook: ctrl.prevLook,
    setFocus: ctrl.setFocus,
    setExposure: ctrl.setExposure,
    setTime: ctrl.setTime,
    render: syncAndRender,
    exposePlate: (meta = {}) =>
      ctrl.exposePlate({ locationName, cartridgeName, ...meta }),
    speakLine: (speaker, text, pitch = 1.0) => ctrl.audio.speakDuet(speaker, text, pitch),
    showToast: ctrl.showToast,
    destroy: () => {
      destroyed = true;
      overlayEl.remove();
      overlayRenderer.dispose();
      const idx = ctrl.targets.indexOf(targetEntry);
      if (idx >= 0) ctrl.targets.splice(idx, 1);
    },
  };
}
