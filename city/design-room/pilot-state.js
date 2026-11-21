// Brief 9 — Keep One World Across Tools: Versioned Severn Pilot Scene Record & Adapters
// Storage key: make_photo_pilot_v1 (localStorage + URL hash sync + cross-tab storage events)

export const PILOT_STORAGE_KEY = 'make_photo_pilot_v1';
export const PILOT_SCHEMA_VERSION = 'pilot-v1';

export const DEFAULT_PILOT_STATE = Object.freeze({
  version: 'pilot-v1',
  world: 'atlantis',
  district: 'baltimere-mount-vernon',
  building: 'severn',
  room: 'vestibule',
  poem: '01',
  account: 'memory',
  shot: 'S01',
  seed: 2086,
  worldTime: 18.5,
  tidePhase: 'second-gate',
  shader: 'weave',
  doorOpen: true,
  parcelHolder: 'player',
  waterLiters: 5.0,
  coolingWet: false,
  provenanceFilter: 'all',
  rawDaylight: false,
  era: 'living-harbor',
  perfClockSec: 0.0,
  camera: {
    preset: 'street-eye',
    focalMm: 35,
    eyeHeightM: 1.65,
    pos: [0.0, 1.65, 11.4],
    lookAt: [0.0, 1.85, 0.0],
  },
  audioBuses: {
    voice: 0.9,
    closeAction: 0.72,
    localAmbience: 0.58,
    distantCity: 0.36,
    music: 0.42,
    delaySend: 0.0,
    muted: false,
  },
  completedEvents: [],
});

export const TIDE_PHASES = Object.freeze([
  { id: 'low-sill', label: 'Low Sill (+0.8m)', waterLevelM: 0.8, hourRange: [0, 6] },
  { id: 'first-gate', label: 'First Gate (+2.1m)', waterLevelM: 2.1, hourRange: [6, 12] },
  { id: 'second-gate', label: 'Second Gate (+3.4m)', waterLevelM: 3.4, hourRange: [12, 19.5] },
  { id: 'datum-crest', label: 'Flood Datum (+4.0m)', waterLevelM: 4.0, hourRange: [19.5, 24] },
]);

export const SEVERN_PILOT_CONTRACT = Object.freeze({
  pilotId: 'severn-pilot-v1',
  units: 'meters',
  axes: { right: '+X', up: '+Y', forward: '-Z' },
  floodDatumM: 4.0,
  envelopeM: { width: 20.0, depth: 12.0, height: 14.4, storeys: 4 },
  rooms: ['street-curb', 'vestibule', 'stair-hall', 'flat-2a', 'fire-escape'],
  cast: [
    { id: 'player', role: 'courier', anchor: 'street-curb' },
    { id: 'bekele', name: 'Bekele', role: 'resident-keeper', anchor: 'vestibule' },
    { id: 'maren', name: 'Maren', role: 'second-floor-tenant', anchor: 'flat-2a' },
  ],
  nonGeographicZones: {
    'the-black': {
      streetNetworkConnected: false,
      transitionType: 'authored-cut-only',
      note: 'Deliberately nongeographic transition kept outside metric street graph.',
    },
  },
  toolAdapters: {
    foundry: { path: '../foundry/', consumes: ['building', 'room', 'seed', 'doorOpen', 'parcelHolder', 'worldTime', 'provenanceFilter'] },
    heroes: { path: '../heroes/', consumes: ['building', 'room', 'poem', 'worldTime', 'rawDaylight', 'doorOpen', 'provenanceFilter', 'shader'] },
    city: { path: '../', consumes: ['district', 'building', 'worldTime', 'tidePhase', 'shader', 'doorOpen', 'parcelHolder', 'waterLiters', 'coolingWet'] },
    island: { path: '../island/', consumes: ['district', 'building', 'worldTime', 'tidePhase', 'doorOpen', 'parcelHolder', 'waterLiters'] },
    maps: { path: '../maps/', consumes: ['world', 'district', 'building', 'shot', 'poem', 'tidePhase', 'doorOpen', 'parcelHolder'] },
    weave: { path: '../weave/', consumes: ['shot', 'poem', 'worldTime', 'shader', 'doorOpen', 'parcelHolder', 'provenanceFilter'] },
    pointcloud: { path: '../pointcloud/', consumes: ['shot', 'building', 'rawDaylight', 'provenanceFilter', 'shader'] },
    worldtext: { path: '../worldtext/', consumes: ['building', 'room', 'poem', 'account', 'doorOpen', 'parcelHolder', 'tidePhase'] },
    atlantis: { path: '../atlantis/', consumes: ['poem', 'account', 'shot', 'era', 'tidePhase', 'worldTime', 'doorOpen'] },
  },
});

const HASH_SYNC_KEYS = [
  'world',
  'district',
  'building',
  'room',
  'poem',
  'account',
  'shot',
  'seed',
  'worldTime',
  'tidePhase',
  'shader',
  'doorOpen',
  'parcelHolder',
  'waterLiters',
  'coolingWet',
  'provenanceFilter',
  'rawDaylight',
  'era',
];

const BOOLEAN_KEYS = new Set(['doorOpen', 'coolingWet', 'rawDaylight']);
const NUMBER_KEYS = new Set(['seed', 'worldTime', 'waterLiters', 'perfClockSec']);

const listeners = new Set();
let globalsBound = false;

function coerceValue(key, raw) {
  if (raw === undefined || raw === null) return undefined;
  if (BOOLEAN_KEYS.has(key)) {
    if (typeof raw === 'boolean') return raw;
    const s = String(raw).trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'open' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'closed' || s === 'no') return false;
    return Boolean(raw);
  }
  if (NUMBER_KEYS.has(key)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_PILOT_STATE[key];
    if (key === 'worldTime') return ((n % 24) + 24) % 24;
    if (key === 'waterLiters') return Math.max(0, Math.round(n * 100) / 100);
    if (key === 'seed') return Math.trunc(n);
    return n;
  }
  return String(raw);
}

export function normalizePilotState(input = {}) {
  const base = {
    ...DEFAULT_PILOT_STATE,
    camera: { ...DEFAULT_PILOT_STATE.camera, ...(input?.camera || {}) },
    audioBuses: { ...DEFAULT_PILOT_STATE.audioBuses, ...(input?.audioBuses || {}) },
    completedEvents: Array.isArray(input?.completedEvents)
      ? Array.from(new Set(input.completedEvents.map(String)))
      : [...DEFAULT_PILOT_STATE.completedEvents],
  };

  for (const key of Object.keys(DEFAULT_PILOT_STATE)) {
    if (key === 'version' || key === 'camera' || key === 'audioBuses' || key === 'completedEvents') continue;
    if (input && Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined) {
      base[key] = coerceValue(key, input[key]);
    }
  }
  base.version = PILOT_SCHEMA_VERSION;
  return base;
}

export function deriveClockMapping(state = loadPilotState()) {
  const hour = Number.isFinite(state.worldTime) ? state.worldTime : 18.5;
  const wholeH = Math.floor(hour);
  const mins = Math.round((hour - wholeH) * 60) % 60;
  const hhmm = `${String(wholeH).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  const matchedTide =
    TIDE_PHASES.find((t) => t.id === state.tidePhase) ||
    TIDE_PHASES.find((t) => hour >= t.hourRange[0] && hour < t.hourRange[1]) ||
    TIDE_PHASES[2];
  return {
    localHour: hour,
    formattedLocalTime: hhmm,
    performanceClockSec: Number(state.perfClockSec || 0),
    historicalEra: state.era || 'living-harbor',
    tidePhase: matchedTide.id,
    tideLabel: matchedTide.label,
    waterLevelM: matchedTide.waterLevelM,
    belowFloodDatum: matchedTide.waterLevelM < SEVERN_PILOT_CONTRACT.floodDatumM,
  };
}

export function loadPilotState() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PILOT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return normalizePilotState(parsed);
        }
      }
    }
  } catch {
    // Fallback to default state if storage is blocked or malformed
  }
  return normalizePilotState(DEFAULT_PILOT_STATE);
}

export function formatPilotHash(state = loadPilotState()) {
  const s = normalizePilotState(state);
  const params = new URLSearchParams();
  params.set('building', s.building);
  params.set('room', s.room);
  params.set('poem', s.poem);
  params.set('account', s.account);
  params.set('shot', s.shot);
  params.set('worldTime', Number(s.worldTime).toFixed(2).replace(/\.?0+$/, ''));
  params.set('tidePhase', s.tidePhase);
  params.set('shader', s.shader);
  params.set('doorOpen', s.doorOpen ? '1' : '0');
  params.set('parcelHolder', s.parcelHolder);
  params.set('waterLiters', String(s.waterLiters));
  if (s.coolingWet) params.set('coolingWet', '1');
  if (s.provenanceFilter && s.provenanceFilter !== 'all') params.set('provenanceFilter', s.provenanceFilter);
  if (s.rawDaylight) params.set('rawDaylight', '1');
  return `#${params.toString()}`;
}

function statesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function notifyListeners(state) {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch {
      // Isolate subscriber errors
    }
  }
}

export function savePilotState(patch = {}, options = {}) {
  const prev = loadPilotState();
  const mergedInput = {
    ...prev,
    ...(patch || {}),
    camera: patch?.camera ? { ...prev.camera, ...patch.camera } : prev.camera,
    audioBuses: patch?.audioBuses ? { ...prev.audioBuses, ...patch.audioBuses } : prev.audioBuses,
    completedEvents: Array.isArray(patch?.completedEvents) ? patch.completedEvents : prev.completedEvents,
  };
  const next = normalizePilotState(mergedInput);
  const changed = !statesEqual(prev, next);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PILOT_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Ignore storage quota errors
  }

  if (options.syncHash !== false && typeof window !== 'undefined' && window.history?.replaceState) {
    const rawHash = window.location.hash || '';
    const isPlainAnchor = rawHash.length > 1 && !rawHash.includes('=');
    if (!isPlainAnchor) {
      const nextHash = formatPilotHash(next);
      if (rawHash !== nextHash) {
        try {
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
        } catch {
          // Ignore replaceState security restrictions on file://
        }
      }
    }
  }

  if (changed || options.forceNotify) {
    notifyListeners(next);
  }
  return next;
}

export function applyPilotUrlHash(customHash) {
  const current = loadPilotState();
  if (typeof window === 'undefined' && customHash === undefined) {
    return current;
  }
  const raw = typeof customHash === 'string' ? customHash : (window.location.hash || '');
  const trimmed = raw.replace(/^#/, '').trim();
  if (!trimmed || !trimmed.includes('=')) {
    return current;
  }

  const qIndex = trimmed.indexOf('?');
  const paramPart = qIndex >= 0 ? trimmed.slice(qIndex + 1) : trimmed;
  const params = new URLSearchParams(paramPart);
  const patch = {};
  let foundAny = false;

  for (const key of HASH_SYNC_KEYS) {
    if (params.has(key)) {
      patch[key] = coerceValue(key, params.get(key));
      foundAny = true;
    }
  }

  if (!foundAny) {
    return current;
  }
  return savePilotState(patch, { syncHash: false });
}

function ensureGlobalListeners() {
  if (globalsBound || typeof window === 'undefined') return;
  globalsBound = true;

  window.addEventListener('storage', (event) => {
    if (event.key === PILOT_STORAGE_KEY) {
      notifyListeners(loadPilotState());
    }
  });

  window.addEventListener('hashchange', () => {
    const raw = window.location.hash || '';
    if (raw.includes('=')) {
      applyPilotUrlHash(raw);
    }
  });
}

export function subscribePilotState(callback, options = {}) {
  if (typeof callback !== 'function') return () => {};
  ensureGlobalListeners();
  listeners.add(callback);
  if (options.immediate) {
    callback(loadPilotState());
  }
  return () => {
    listeners.delete(callback);
  };
}

export function resetPilotState() {
  return savePilotState({ ...DEFAULT_PILOT_STATE }, { forceNotify: true });
}

// Timeline scrub & idempotent event helper (Brief 9: scrubbing reconstructs state without firing old events twice)
const SCHEDULED_BEATS = [
  { id: 'courier-arrives-curb', atSec: 2.0, patch: { room: 'street-curb' } },
  { id: 'threshold-opened', atSec: 5.5, patch: { doorOpen: true, room: 'vestibule' } },
  { id: 'parcel-handed-to-bekele', atSec: 9.0, patch: { parcelHolder: 'bekele', room: 'vestibule' } },
  { id: 'cistern-cooled', atSec: 13.5, patch: { coolingWet: true, waterLiters: 3.5 } },
];

export function scrubPilotTimeline(perfSec) {
  const t = Math.max(0, Number(perfSec) || 0);
  const completed = [];
  const patch = { perfClockSec: t, parcelHolder: 'player', coolingWet: false, waterLiters: 5.0 };
  for (const beat of SCHEDULED_BEATS) {
    if (t >= beat.atSec) {
      completed.push(beat.id);
      Object.assign(patch, beat.patch);
    }
  }
  patch.completedEvents = completed;
  return savePilotState(patch);
}
