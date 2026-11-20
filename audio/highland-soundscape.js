/* HighlandSoundscape - Spatial Ethiopian Soundscape & 4-Station In-World Radio
 * Exposes window.HighlandSoundscape
 * Zero external dependencies; pairs CC0/CC-BY Freesound samples with WebAudio DSP.
 */
(function (global) {
  "use strict";

  const STATIONS = [
    {
      id: "cosmic_addis",
      freq: "98.4",
      name: "COSMIC ADDIS",
      tag: "TAPE STREAM",
      desc: "Addis nocturnal groove with warm analog tape saturation"
    },
    {
      id: "lalibela_krar",
      freq: "101.2",
      name: "LALIBELA KRAR",
      tag: "TEZETA / BATI",
      desc: "Pentatonic krar strings, kebero pulse & highland chant"
    },
    {
      id: "ahiya_dispatch",
      freq: "104.6",
      name: "AHIYA DISPATCH",
      tag: "RELAY VHF",
      desc: "Carrier wind, donkey bells & valley relay chatter"
    },
    {
      id: "highland_archive",
      freq: "107.8",
      name: "HIGHLAND ARCHIVE",
      tag: "FIELD TAPE",
      desc: "Ethiopian environmental field recordings & birdsong"
    }
  ];

  const BIOME_CONFIG = {
    courtyard: {
      reverbWet: 0.34,
      reverbDry: 0.92,
      windGain: 0.06,
      windFreq: 320,
      cricketsGain: 0.14,
      riverGain: 0.02,
      fieldGain: 0.08
    },
    highland_cliff: {
      reverbWet: 0.52,
      reverbDry: 0.85,
      windGain: 0.32,
      windFreq: 560,
      cricketsGain: 0.04,
      riverGain: 0.02,
      fieldGain: 0.05
    },
    valley_village: {
      reverbWet: 0.24,
      reverbDry: 0.95,
      windGain: 0.10,
      windFreq: 380,
      cricketsGain: 0.28,
      riverGain: 0.04,
      fieldGain: 0.11
    },
    gorge_water: {
      reverbWet: 0.48,
      reverbDry: 0.86,
      windGain: 0.12,
      windFreq: 420,
      cricketsGain: 0.08,
      riverGain: 0.36,
      fieldGain: 0.04
    }
  };

  const SAMPLE_FILES = {
    donkey: "samples/donkey.mp3",
    water_pour: "samples/water_pour.mp3",
    river_gorge: "samples/river_gorge.mp3",
    gravel_footsteps: "samples/gravel_footsteps.mp3",
    ethiopia_field: "samples/ethiopia_field.mp3",
    metal_pump: "samples/metal_pump.mp3",
    crickets_night: "samples/crickets_night.mp3"
  };

  // Ethiopian pentatonic scales (Hz): Tezeta minor & Bati major around D4
  const TEZETA_HZ = [293.66, 329.63, 349.23, 440.0, 466.16, 587.33];
  const BATI_HZ = [293.66, 369.99, 392.0, 440.0, 554.37, 587.33];

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function resolveDefaultBasePath() {
    if (typeof document !== "undefined") {
      const scripts = document.getElementsByTagName("script");
      for (let i = scripts.length - 1; i >= 0; i--) {
        const src = scripts[i].getAttribute("src") || "";
        if (src.indexOf("highland-soundscape.js") !== -1) {
          return src.replace(/highland-soundscape\.js(\?.*)?$/, "");
        }
      }
    }
    return "../audio/";
  }

  const state = {
    ctx: null,
    ready: false,
    initialized: false,
    basePath: resolveDefaultBasePath(),
    cosmicAddisUrl: "../zones/cyan-jerikan.ogg",
    muted: false,
    masterVol: 0.85,
    biome: "valley_village",
    elevationM: 2200,
    buffers: {},
    loadingBuffers: false,

    // Master graph
    masterGain: null,
    sfxBus: null,
    dryBus: null,
    reverbSend: null,
    reverbConvolver: null,
    reverbReturn: null,
    biomeIRs: {},
    noiseBuffer: null,

    // Ambient bed nodes
    windGain: null,
    windFilter: null,
    cricketsGain: null,
    riverGain: null,
    fieldGain: null,
    ambientStarted: false,
    birdTimer: null,

    // Spatial pump rig
    pumpPanner: null,
    pumpGain: null,
    pumpSqueakOsc: null,
    pumpSqueakGain: null,
    pumpStrokeAt: 0,
    pumpActive: false,

    // Spatial vehicle rig
    vehPanner: null,
    vehGain: null,
    vehOsc1: null,
    vehOsc2: null,
    vehFilter: null,
    vehRattleGain: null,
    vehRattleFilter: null,
    vehSputterLfo: null,
    vehSputterDepth: null,

    // Radio subsystem
    radioOn: false,
    radioStationIdx: 0,
    radioVol: 0.65,
    radioBus: null,
    radioEl: null,
    radioMediaSrc: null,
    radioTapeShaper: null,
    radioCosmicGain: null,
    radioSynthGain: null,
    radioLoopTimer: null,
    radioLoopStep: 0,
    radioBedSrc: null,
    radioBedGain: null,
    hudRoots: []
  };

  function makeNoiseBuffer(ctx, seconds) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return buf;
  }

  function makeImpulseResponse(ctx, duration, decay, bright) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      const alpha = clamp(bright, 0.08, 0.95);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, decay);
        const raw = (Math.random() * 2 - 1) * env;
        lp = lp + alpha * (raw - lp);
        data[i] = lp;
      }
    }
    return buf;
  }

  function makeTapeCurve(amount) {
    const n = 1024;
    const curve = new Float32Array(n);
    const k = amount || 18;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  function createPanner(ctx, pos) {
    const p = ctx.createPanner();
    p.panningModel = "HRTF";
    p.distanceModel = "inverse";
    p.refDistance = 3.5;
    p.maxDistance = 120;
    p.rolloffFactor = 1.15;
    if (pos) setPannerPos(p, pos);
    return p;
  }

  function setPannerPos(panner, pos) {
    if (!panner || !pos || !state.ctx) return;
    const t = state.ctx.currentTime;
    const x = Number(pos.x) || 0;
    const y = Number(pos.y) || 0;
    const z = Number(pos.z) || 0;
    if (panner.positionX) {
      panner.positionX.setTargetAtTime(x, t, 0.04);
      panner.positionY.setTargetAtTime(y, t, 0.04);
      panner.positionZ.setTargetAtTime(z, t, 0.04);
    } else if (typeof panner.setPosition === "function") {
      panner.setPosition(x, y, z);
    }
  }

  function buildAudioGraph() {
    const AudioCtx = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtx) return false;
    if (state.ctx) return true;

    const ctx = new AudioCtx();
    state.ctx = ctx;

    state.masterGain = ctx.createGain();
    state.masterGain.gain.value = state.muted ? 0 : state.masterVol;
    state.masterGain.connect(ctx.destination);

    state.sfxBus = ctx.createGain();
    state.sfxBus.gain.value = 0.9;
    state.dryBus = ctx.createGain();
    state.dryBus.gain.value = 0.92;
    state.sfxBus.connect(state.dryBus);
    state.dryBus.connect(state.masterGain);

    // Biome Convolver Reverb
    state.biomeIRs = {
      courtyard: makeImpulseResponse(ctx, 0.65, 2.8, 0.62),
      highland_cliff: makeImpulseResponse(ctx, 1.95, 2.2, 0.42),
      valley_village: makeImpulseResponse(ctx, 0.95, 2.6, 0.48),
      gorge_water: makeImpulseResponse(ctx, 1.45, 2.1, 0.56)
    };
    state.reverbSend = ctx.createGain();
    state.reverbSend.gain.value = 0.35;
    state.reverbConvolver = ctx.createConvolver();
    state.reverbConvolver.buffer = state.biomeIRs[state.biome] || state.biomeIRs.valley_village;
    state.reverbReturn = ctx.createGain();
    state.reverbReturn.gain.value = 0.30;
    state.sfxBus.connect(state.reverbSend);
    state.reverbSend.connect(state.reverbConvolver);
    state.reverbConvolver.connect(state.reverbReturn);
    state.reverbReturn.connect(state.masterGain);

    state.noiseBuffer = makeNoiseBuffer(ctx, 3.0);

    // Continuous Highland Wind Bed
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = state.noiseBuffer;
    windSrc.loop = true;
    state.windFilter = ctx.createBiquadFilter();
    state.windFilter.type = "bandpass";
    state.windFilter.frequency.value = 380;
    state.windFilter.Q.value = 1.8;
    state.windGain = ctx.createGain();
    state.windGain.gain.value = 0.08;
    windSrc.connect(state.windFilter);
    state.windFilter.connect(state.windGain);
    state.windGain.connect(state.sfxBus);
    windSrc.start();

    // Sample-backed ambient gain gates
    state.cricketsGain = ctx.createGain();
    state.cricketsGain.gain.value = 0.0001;
    state.cricketsGain.connect(state.sfxBus);

    state.riverGain = ctx.createGain();
    state.riverGain.gain.value = 0.0001;
    state.riverGain.connect(state.sfxBus);

    state.fieldGain = ctx.createGain();
    state.fieldGain.gain.value = 0.0001;
    state.fieldGain.connect(state.sfxBus);

    // Spatial Pump Rig
    state.pumpPanner = createPanner(ctx, { x: 0, y: 0, z: 0 });
    state.pumpGain = ctx.createGain();
    state.pumpGain.gain.value = 0.85;
    state.pumpPanner.connect(state.pumpGain);
    state.pumpGain.connect(state.sfxBus);

    state.pumpSqueakOsc = ctx.createOscillator();
    state.pumpSqueakOsc.type = "sawtooth";
    state.pumpSqueakOsc.frequency.value = 620;
    const sqFilter = ctx.createBiquadFilter();
    sqFilter.type = "bandpass";
    sqFilter.frequency.value = 1100;
    sqFilter.Q.value = 7.0;
    state.pumpSqueakGain = ctx.createGain();
    state.pumpSqueakGain.gain.value = 0.0001;
    state.pumpSqueakOsc.connect(sqFilter);
    sqFilter.connect(state.pumpSqueakGain);
    state.pumpSqueakGain.connect(state.pumpPanner);
    state.pumpSqueakOsc.start();

    // Spatial Vehicle Rig (engine + damaged chassis rattle/sputter)
    state.vehPanner = createPanner(ctx, { x: 0, y: 0, z: 0 });
    state.vehGain = ctx.createGain();
    state.vehGain.gain.value = 0.0001;
    state.vehFilter = ctx.createBiquadFilter();
    state.vehFilter.type = "lowpass";
    state.vehFilter.frequency.value = 260;
    state.vehFilter.Q.value = 1.4;

    state.vehOsc1 = ctx.createOscillator();
    state.vehOsc1.type = "sawtooth";
    state.vehOsc1.frequency.value = 48;
    state.vehOsc2 = ctx.createOscillator();
    state.vehOsc2.type = "triangle";
    state.vehOsc2.frequency.value = 96;

    const engMix = ctx.createGain();
    engMix.gain.value = 0.35;
    state.vehOsc1.connect(engMix);
    state.vehOsc2.connect(engMix);
    engMix.connect(state.vehFilter);
    state.vehFilter.connect(state.vehGain);

    // Low-integrity metallic rattle + sputter
    const rattleNoise = ctx.createBufferSource();
    rattleNoise.buffer = state.noiseBuffer;
    rattleNoise.loop = true;
    state.vehRattleFilter = ctx.createBiquadFilter();
    state.vehRattleFilter.type = "bandpass";
    state.vehRattleFilter.frequency.value = 1650;
    state.vehRattleFilter.Q.value = 4.5;
    state.vehRattleGain = ctx.createGain();
    state.vehRattleGain.gain.value = 0.0001;
    rattleNoise.connect(state.vehRattleFilter);
    state.vehRattleFilter.connect(state.vehRattleGain);
    state.vehRattleGain.connect(state.vehPanner);
    rattleNoise.start();

    state.vehSputterLfo = ctx.createOscillator();
    state.vehSputterLfo.type = "square";
    state.vehSputterLfo.frequency.value = 9.5;
    state.vehSputterDepth = ctx.createGain();
    state.vehSputterDepth.gain.value = 0.0;
    state.vehSputterLfo.connect(state.vehSputterDepth);
    state.vehSputterDepth.connect(state.vehGain.gain);
    state.vehSputterLfo.start();

    state.vehGain.connect(state.vehPanner);
    state.vehPanner.connect(state.sfxBus);
    state.vehOsc1.start();
    state.vehOsc2.start();

    // Radio Bus
    state.radioBus = ctx.createGain();
    state.radioBus.gain.value = state.radioOn ? state.radioVol : 0.0001;
    state.radioBus.connect(state.masterGain);

    state.radioCosmicGain = ctx.createGain();
    state.radioCosmicGain.gain.value = 0.0001;
    state.radioTapeShaper = ctx.createWaveShaper();
    state.radioTapeShaper.curve = makeTapeCurve(16);
    state.radioTapeShaper.oversample = "2x";
    const tapeWarmth = ctx.createBiquadFilter();
    tapeWarmth.type = "lowshelf";
    tapeWarmth.frequency.value = 240;
    tapeWarmth.gain.value = 3.5;
    state.radioTapeShaper.connect(tapeWarmth);
    tapeWarmth.connect(state.radioCosmicGain);
    state.radioCosmicGain.connect(state.radioBus);

    state.radioSynthGain = ctx.createGain();
    state.radioSynthGain.gain.value = 0.85;
    state.radioSynthGain.connect(state.radioBus);

    state.radioBedGain = ctx.createGain();
    state.radioBedGain.gain.value = 0.0001;
    state.radioBedGain.connect(state.radioBus);

    setupCosmicAudioElement();
    applyBiomeMix(state.biome, state.elevationM);
    startBirdScheduler();
    loadAllSamples();

    state.initialized = true;
    state.ready = ctx.state === "running";
    return true;
  }

  function setupCosmicAudioElement() {
    if (typeof document === "undefined" || !state.ctx || state.radioEl) return;
    try {
      const el = document.createElement("audio");
      el.src = state.cosmicAddisUrl;
      el.loop = true;
      el.crossOrigin = "anonymous";
      el.preload = "none";
      state.radioEl = el;
      state.radioMediaSrc = state.ctx.createMediaElementSource(el);
      state.radioMediaSrc.connect(state.radioTapeShaper);
    } catch (e) {
      // Fallback safely if media element routing is restricted
    }
  }

  function loadAllSamples() {
    if (state.loadingBuffers || !state.ctx || typeof fetch !== "function") return;
    state.loadingBuffers = true;
    const base = state.basePath.endsWith("/") ? state.basePath : state.basePath + "/";
    Object.keys(SAMPLE_FILES).forEach(function (key) {
      const url = base + SAMPLE_FILES[key];
      fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.arrayBuffer();
        })
        .then(function (arr) {
          return state.ctx.decodeAudioData(arr);
        })
        .then(function (decoded) {
          state.buffers[key] = decoded;
          startAmbientLoopsIfReady();
        })
        .catch(function () {
          // Procedural fallbacks stay active if a sample fails to load
        });
    });
  }

  function startAmbientLoopsIfReady() {
    if (!state.ctx) return;
    if (!state._cricketsSrc && state.buffers.crickets_night) {
      const s = state.ctx.createBufferSource();
      s.buffer = state.buffers.crickets_night;
      s.loop = true;
      s.connect(state.cricketsGain);
      s.start();
      state._cricketsSrc = s;
    }
    if (!state._riverSrc && state.buffers.river_gorge) {
      const s = state.ctx.createBufferSource();
      s.buffer = state.buffers.river_gorge;
      s.loop = true;
      s.connect(state.riverGain);
      s.start();
      state._riverSrc = s;
    }
    if (!state._fieldSrc && state.buffers.ethiopia_field) {
      const s = state.ctx.createBufferSource();
      s.buffer = state.buffers.ethiopia_field;
      s.loop = true;
      s.connect(state.fieldGain);
      s.start();
      state._fieldSrc = s;
    }
    applyBiomeMix(state.biome, state.elevationM);
  }

  function startBirdScheduler() {
    if (state.birdTimer) return;
    state.birdTimer = setInterval(function () {
      if (!state.ctx || state.ctx.state !== "running" || state.muted) return;
      if (state.biome === "highland_cliff" || state.biome === "valley_village") {
        if (Math.random() < 0.45) {
          playHighlandBirdChirp(state.biome === "highland_cliff" ? 0.045 : 0.06);
        }
      }
    }, 4200);
  }

  function playHighlandBirdChirp(vol) {
    const ctx = state.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const baseF = 1900 + Math.random() * 1400;
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseF, now);
    osc.frequency.exponentialRampToValueAtTime(baseF * 1.28, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(baseF * 0.92, now + 0.16);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol || 0.05, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    osc.connect(g);
    g.connect(state.reverbSend);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  function applyBiomeMix(biome, elevationM) {
    if (!state.ctx) return;
    const cfg = BIOME_CONFIG[biome] || BIOME_CONFIG.valley_village;
    const elevFactor = clamp(((Number(elevationM) || 2200) - 1800) / 1600, 0, 1);
    const t = state.ctx.currentTime;

    if (state.reverbConvolver && state.biomeIRs[biome] && state._lastIRBiome !== biome) {
      state.reverbConvolver.buffer = state.biomeIRs[biome];
      state._lastIRBiome = biome;
    }
    state.reverbReturn.gain.setTargetAtTime(cfg.reverbWet, t, 0.45);
    state.dryBus.gain.setTargetAtTime(cfg.reverbDry, t, 0.45);
    state.windGain.gain.setTargetAtTime(cfg.windGain + elevFactor * 0.14, t, 0.5);
    state.windFilter.frequency.setTargetAtTime(cfg.windFreq + elevFactor * 260, t, 0.5);
    state.cricketsGain.gain.setTargetAtTime(cfg.cricketsGain, t, 0.6);
    state.riverGain.gain.setTargetAtTime(cfg.riverGain, t, 0.6);
    state.fieldGain.gain.setTargetAtTime(cfg.fieldGain, t, 0.8);
  }

  function playTuningStatic() {
    const ctx = state.ctx;
    if (!ctx || ctx.state !== "running" || !state.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = state.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(2400, now);
    bp.frequency.exponentialRampToValueAtTime(1100, now + 0.22);
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.32 * state.radioVol, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    src.connect(bp);
    bp.connect(g);
    g.connect(state.masterGain);
    src.start(now);
    src.stop(now + 0.26);
  }

  function stopRadioGenerators() {
    if (state.radioLoopTimer) {
      clearInterval(state.radioLoopTimer);
      state.radioLoopTimer = null;
    }
    if (state.radioBedSrc) {
      try { state.radioBedSrc.stop(); } catch (e) {}
      state.radioBedSrc = null;
    }
    if (state.radioEl && !state.radioEl.paused) {
      try { state.radioEl.pause(); } catch (e) {}
    }
    if (state.ctx && state.radioCosmicGain) {
      state.radioCosmicGain.gain.setTargetAtTime(0.0001, state.ctx.currentTime, 0.08);
    }
    if (state.ctx && state.radioBedGain) {
      state.radioBedGain.gain.setTargetAtTime(0.0001, state.ctx.currentTime, 0.08);
    }
  }

  function triggerKrarPluck(freq, vol) {
    const ctx = state.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const harm = ctx.createOscillator();
    osc.type = "triangle";
    harm.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, now);
    harm.frequency.setValueAtTime(freq * 2.003, now);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(freq * 5.2, now);
    lp.frequency.exponentialRampToValueAtTime(freq * 1.4, now + 0.42);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    const hg = ctx.createGain();
    hg.gain.value = 0.22;
    osc.connect(lp);
    harm.connect(hg);
    hg.connect(lp);
    lp.connect(g);
    g.connect(state.radioSynthGain);
    osc.start(now);
    harm.start(now);
    osc.stop(now + 0.58);
    harm.stop(now + 0.58);
  }

  function triggerKeberoHit(low) {
    const ctx = state.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(low ? 128 : 245, now);
    osc.frequency.exponentialRampToValueAtTime(low ? 62 : 140, now + 0.14);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(low ? 0.22 : 0.12, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(g);
    g.connect(state.radioSynthGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  function triggerDonkeyBell() {
    const ctx = state.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    [880, 1342].forEach(function (f, idx) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(idx === 0 ? 0.09 : 0.045, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      osc.connect(g);
      g.connect(state.radioSynthGain);
      osc.start(now);
      osc.stop(now + 0.68);
    });
  }

  function startActiveStation() {
    stopRadioGenerators();
    if (!state.radioOn || !state.ctx) return;

    const ctx = state.ctx;
    const now = ctx.currentTime;
    const st = STATIONS[state.radioStationIdx] || STATIONS[0];
    state.radioBus.gain.setTargetAtTime(state.radioVol, now, 0.06);

    if (st.id === "cosmic_addis") {
      state.radioCosmicGain.gain.setTargetAtTime(0.82, now, 0.12);
      if (state.radioEl) {
        state.radioEl.play().catch(function () {});
      }
    } else if (st.id === "lalibela_krar") {
      if (state.buffers.ethiopia_field) {
        const s = ctx.createBufferSource();
        s.buffer = state.buffers.ethiopia_field;
        s.loop = true;
        s.connect(state.radioBedGain);
        s.start();
        state.radioBedSrc = s;
        state.radioBedGain.gain.setTargetAtTime(0.28, now, 0.18);
      }
      state.radioLoopStep = 0;
      const pattern = [0, 2, 3, 2, 4, 3, 1, 0, 5, 3, 2, 1];
      state.radioLoopTimer = setInterval(function () {
        if (!state.radioOn || !state.ctx || state.ctx.state !== "running") return;
        const step = state.radioLoopStep++;
        const scale = Math.floor(step / 24) % 2 === 0 ? TEZETA_HZ : BATI_HZ;
        const noteIdx = pattern[step % pattern.length];
        triggerKrarPluck(scale[noteIdx], 0.16);
        if (step % 6 === 0) triggerKeberoHit(true);
        else if (step % 6 === 3 || step % 6 === 5) triggerKeberoHit(false);
      }, 275);
    } else if (st.id === "ahiya_dispatch") {
      if (state.buffers.crickets_night) {
        const s = ctx.createBufferSource();
        s.buffer = state.buffers.crickets_night;
        s.loop = true;
        s.connect(state.radioBedGain);
        s.start();
        state.radioBedSrc = s;
        state.radioBedGain.gain.setTargetAtTime(0.32, now, 0.18);
      }
      state.radioLoopTimer = setInterval(function () {
        if (!state.radioOn || !state.ctx || state.ctx.state !== "running") return;
        const r = Math.random();
        if (r < 0.35) {
          triggerDonkeyBell();
        } else if (r < 0.65 && state.noiseBuffer) {
          // Brief VHF carrier squelch texture
          const n = ctx.createBufferSource();
          n.buffer = state.noiseBuffer;
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = 1350 + Math.random() * 500;
          bp.Q.value = 5.5;
          const g = ctx.createGain();
          const t0 = ctx.currentTime;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(0.07, t0 + 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);
          n.connect(bp);
          bp.connect(g);
          g.connect(state.radioSynthGain);
          n.start(t0);
          n.stop(t0 + 0.38);
        }
      }, 1900);
    } else if (st.id === "highland_archive") {
      const buf = state.buffers.ethiopia_field || state.buffers.river_gorge || state.buffers.crickets_night;
      if (buf) {
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        s.connect(state.radioBedGain);
        s.start();
        state.radioBedSrc = s;
        state.radioBedGain.gain.setTargetAtTime(0.45, now, 0.25);
      }
      state.radioLoopTimer = setInterval(function () {
        if (!state.radioOn || !state.ctx || state.ctx.state !== "running") return;
        if (Math.random() < 0.55) playHighlandBirdChirp(0.08);
      }, 2600);
    }
  }

  function syncRadioHUDs() {
    const st = STATIONS[state.radioStationIdx] || STATIONS[0];
    state.hudRoots.forEach(function (root) {
      if (!root) return;
      const freqEl = root.querySelector(".hs-freq");
      const nameEl = root.querySelector(".hs-station-name");
      const tagEl = root.querySelector(".hs-station-tag");
      const pwrBtn = root.querySelector(".hs-pwr-btn");
      const muteBtn = root.querySelector(".hs-mute-btn");
      const volSlider = root.querySelector(".hs-vol-slider");
      const biomeEl = root.querySelector(".hs-biome-readout");
      if (freqEl) freqEl.textContent = st.freq + " FM";
      if (nameEl) nameEl.textContent = st.name;
      if (tagEl) tagEl.textContent = state.radioOn ? st.tag : "STANDBY";
      if (pwrBtn) {
        pwrBtn.textContent = state.radioOn ? "RADIO ON" : "RADIO OFF";
        pwrBtn.classList.toggle("active", state.radioOn);
      }
      if (muteBtn) {
        muteBtn.textContent = state.muted ? "UNMUTE ALL" : "MUTE ALL";
        muteBtn.classList.toggle("active", state.muted);
      }
      if (volSlider) volSlider.value = String(Math.round(state.radioVol * 100));
      if (biomeEl) biomeEl.textContent = state.biome.replace(/_/g, " ").toUpperCase();
      const btns = root.querySelectorAll(".hs-preset-btn");
      btns.forEach(function (b, idx) {
        b.classList.toggle("active", idx === state.radioStationIdx && state.radioOn);
      });
    });
  }

  function injectHUDStyles() {
    if (typeof document === "undefined" || document.getElementById("hs-radio-hud-style")) return;
    const style = document.createElement("style");
    style.id = "hs-radio-hud-style";
    style.textContent = [
      ".hs-radio-hud{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(14,13,12,0.88);border:1px solid rgba(226,178,94,0.38);border-radius:8px;padding:8px 10px;color:#f2e7d2;width:248px;box-sizing:border-box;backdrop-filter:blur(8px);user-select:none;font-size:11px;line-height:1.25;}",
      ".hs-radio-top{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(226,178,94,0.22);padding-bottom:5px;margin-bottom:6px;}",
      ".hs-freq{color:#f0b85c;font-weight:700;font-size:13px;letter-spacing:0.06em;}",
      ".hs-station-tag{color:#a89b84;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;}",
      ".hs-station-name{font-weight:700;font-size:11px;letter-spacing:0.08em;color:#fff6e3;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".hs-presets{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:7px;}",
      ".hs-preset-btn{background:rgba(255,255,255,0.05);border:1px solid rgba(226,178,94,0.22);color:#d7cab3;border-radius:4px;padding:4px 5px;font-size:9.5px;font-family:inherit;cursor:pointer;text-align:left;transition:background 120ms,border-color 120ms;}",
      ".hs-preset-btn:hover{background:rgba(240,184,92,0.16);border-color:rgba(240,184,92,0.55);}",
      ".hs-preset-btn.active{background:rgba(240,184,92,0.26);border-color:#f0b85c;color:#fff8ea;font-weight:700;}",
      ".hs-controls{display:flex;align-items:center;gap:5px;margin-bottom:5px;}",
      ".hs-btn{background:rgba(255,255,255,0.07);border:1px solid rgba(226,178,94,0.3);color:#f2e7d2;border-radius:4px;padding:3px 6px;font-size:9.5px;font-family:inherit;cursor:pointer;letter-spacing:0.06em;}",
      ".hs-btn.active{background:#e2a84a;border-color:#f5c774;color:#12100d;font-weight:700;}",
      ".hs-vol-slider{flex:1;accent-color:#f0b85c;height:4px;cursor:pointer;}",
      ".hs-footer{display:flex;justify-content:space-between;font-size:9px;color:#9c8f78;letter-spacing:0.09em;}"
    ].join("\n");
    document.head.appendChild(style);
  }

  const API = {
    STATIONS: STATIONS,

    init: function (opts) {
      if (opts && typeof opts.basePath === "string") {
        state.basePath = opts.basePath;
      }
      if (opts && typeof opts.cosmicAddisUrl === "string") {
        state.cosmicAddisUrl = opts.cosmicAddisUrl;
      }
      buildAudioGraph();
      return state.initialized;
    },

    unlock: function () {
      if (!state.initialized) buildAudioGraph();
      if (!state.ctx) return false;
      if (state.ctx.state === "suspended") {
        state.ctx.resume().then(function () {
          state.ready = state.ctx.state === "running";
          startAmbientLoopsIfReady();
          if (state.radioOn) startActiveStation();
        }).catch(function () {});
      } else {
        state.ready = state.ctx.state === "running";
      }
      return state.ready;
    },

    isReady: function () {
      return Boolean(state.initialized && state.ctx && state.ctx.state === "running");
    },

    updateListener: function (pos, forward, up) {
      if (!state.ctx || !pos) return;
      const L = state.ctx.listener;
      const t = state.ctx.currentTime;
      const px = Number(pos.x) || 0;
      const py = Number(pos.y) || 0;
      const pz = Number(pos.z) || 0;
      if (L.positionX) {
        L.positionX.setTargetAtTime(px, t, 0.04);
        L.positionY.setTargetAtTime(py, t, 0.04);
        L.positionZ.setTargetAtTime(pz, t, 0.04);
      } else if (typeof L.setPosition === "function") {
        L.setPosition(px, py, pz);
      }
      if (forward) {
        const fx = Number(forward.x) || 0;
        const fy = Number(forward.y) || 0;
        const fz = Number(forward.z) || -1;
        const ux = up ? (Number(up.x) || 0) : 0;
        const uy = up ? (Number(up.y) || 1) : 1;
        const uz = up ? (Number(up.z) || 0) : 0;
        if (L.forwardX) {
          L.forwardX.setTargetAtTime(fx, t, 0.04);
          L.forwardY.setTargetAtTime(fy, t, 0.04);
          L.forwardZ.setTargetAtTime(fz, t, 0.04);
          L.upX.setTargetAtTime(ux, t, 0.04);
          L.upY.setTargetAtTime(uy, t, 0.04);
          L.upZ.setTargetAtTime(uz, t, 0.04);
        } else if (typeof L.setOrientation === "function") {
          L.setOrientation(fx, fy, fz, ux, uy, uz);
        }
      }
    },

    setBiome: function (biome, elevationM) {
      const nextBiome = BIOME_CONFIG[biome] ? biome : "valley_village";
      const nextElev = Number.isFinite(Number(elevationM)) ? Number(elevationM) : state.elevationM;
      const changed = nextBiome !== state.biome || Math.abs(nextElev - state.elevationM) > 15;
      state.biome = nextBiome;
      state.elevationM = nextElev;
      if (changed) {
        applyBiomeMix(state.biome, state.elevationM);
        syncRadioHUDs();
      }
    },

    playDonkeyCall: function (pos) {
      if (!state.ctx || state.ctx.state !== "running" || state.muted) return;
      const ctx = state.ctx;
      const panner = createPanner(ctx, pos || { x: 0, y: 1, z: -4 });
      const g = ctx.createGain();
      g.gain.value = 0.65;
      panner.connect(g);
      g.connect(state.sfxBus);

      if (state.buffers.donkey) {
        const src = ctx.createBufferSource();
        src.buffer = state.buffers.donkey;
        src.playbackRate.value = 0.92 + Math.random() * 0.16;
        src.connect(panner);
        src.start();
        src.onended = function () {
          try { panner.disconnect(); g.disconnect(); } catch (e) {}
        };
      } else {
        // Formant-filtered bray fallback
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const bp = ctx.createBiquadFilter();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(210, now);
        osc.frequency.linearRampToValueAtTime(420, now + 0.18);
        osc.frequency.linearRampToValueAtTime(165, now + 0.55);
        bp.type = "bandpass";
        bp.frequency.value = 780;
        bp.Q.value = 3.5;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.32, now + 0.05);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
        osc.connect(bp);
        bp.connect(env);
        env.connect(panner);
        osc.start(now);
        osc.stop(now + 0.68);
      }
    },

    updatePumpAudio: function (pos, pumping, condition01) {
      if (!state.ctx || state.ctx.state !== "running") return;
      const ctx = state.ctx;
      const now = ctx.currentTime;
      const cond = clamp(Number.isFinite(Number(condition01)) ? Number(condition01) : 0.85, 0, 1);
      setPannerPos(state.pumpPanner, pos);

      if (!pumping) {
        state.pumpActive = false;
        state.pumpSqueakGain.gain.setTargetAtTime(0.0001, now, 0.08);
        return;
      }

      state.pumpActive = true;
      const wear = 1 - cond;
      // Neglected pump rattles and squeaks noticeably higher/louder
      state.pumpSqueakOsc.frequency.setTargetAtTime(480 + wear * 720 + Math.sin(now * 9) * (35 + wear * 90), now, 0.04);
      state.pumpSqueakGain.gain.setTargetAtTime(0.015 + wear * 0.11, now, 0.06);

      if (now - state.pumpStrokeAt >= 0.72) {
        state.pumpStrokeAt = now;
        if (state.buffers.metal_pump) {
          const s = ctx.createBufferSource();
          s.buffer = state.buffers.metal_pump;
          s.playbackRate.value = 0.88 + wear * 0.24;
          const sg = ctx.createGain();
          sg.gain.value = 0.45 + wear * 0.35;
          s.connect(sg);
          sg.connect(state.pumpPanner);
          s.start(now);
        }
        if (state.buffers.water_pour) {
          const w = ctx.createBufferSource();
          w.buffer = state.buffers.water_pour;
          const wg = ctx.createGain();
          wg.gain.setValueAtTime(0.0001, now);
          wg.gain.linearRampToValueAtTime(0.32 * (0.4 + cond * 0.6), now + 0.08);
          wg.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);
          w.connect(wg);
          wg.connect(state.pumpPanner);
          w.start(now, 0, 0.7);
        }
      }
    },

    updateVehicleAudio: function (pos, speedMps, rpm01, integrity01) {
      if (!state.ctx || state.ctx.state !== "running") return;
      const now = state.ctx.currentTime;
      const spd = Math.max(0, Number(speedMps) || 0);
      const rpm = clamp(Number(rpm01) || 0, 0, 1);
      const integ = clamp(Number.isFinite(Number(integrity01)) ? Number(integrity01) : 1, 0, 1);
      setPannerPos(state.vehPanner, pos);

      const running = spd > 0.08 || rpm > 0.05;
      if (!running) {
        state.vehGain.gain.setTargetAtTime(0.0001, now, 0.12);
        state.vehRattleGain.gain.setTargetAtTime(0.0001, now, 0.12);
        state.vehSputterDepth.gain.setTargetAtTime(0.0, now, 0.12);
        return;
      }

      const baseFreq = 38 + rpm * 105 + Math.min(spd, 25) * 1.8;
      state.vehOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
      state.vehOsc2.frequency.setTargetAtTime(baseFreq * 1.98, now, 0.05);
      state.vehFilter.frequency.setTargetAtTime(220 + rpm * 820, now, 0.06);
      state.vehGain.gain.setTargetAtTime(0.14 + rpm * 0.22, now, 0.08);

      // Below 50% integrity: add metallic chassis rattle & exhaust sputter
      if (integ < 0.5) {
        const dmg = clamp((0.5 - integ) * 2, 0, 1);
        state.vehRattleFilter.frequency.setTargetAtTime(1250 + dmg * 900 + (spd * 18), now, 0.06);
        state.vehRattleGain.gain.setTargetAtTime(dmg * (0.08 + rpm * 0.16), now, 0.08);
        state.vehSputterLfo.frequency.setTargetAtTime(6.5 + dmg * 9.5, now, 0.08);
        state.vehSputterDepth.gain.setTargetAtTime(dmg * 0.09, now, 0.08);
      } else {
        state.vehRattleGain.gain.setTargetAtTime(0.0001, now, 0.1);
        state.vehSputterDepth.gain.setTargetAtTime(0.0, now, 0.1);
      }
    },

    playFootstep: function (surface, weightKg) {
      if (!state.ctx || state.ctx.state !== "running" || state.muted) return;
      const ctx = state.ctx;
      const now = ctx.currentTime;
      const surf = surface || "gravel";
      const load = clamp((Number(weightKg) || 0) / 40, 0, 1);

      // Weight-scaled low-end thud (heavier water load deepens thud)
      const thud = ctx.createOscillator();
      const thudG = ctx.createGain();
      thud.type = "sine";
      const startHz = (surf === "stone" ? 135 : 105) - load * 32;
      thud.frequency.setValueAtTime(Math.max(45, startHz), now);
      thud.frequency.exponentialRampToValueAtTime(34, now + 0.09 + load * 0.05);
      thudG.gain.setValueAtTime(0.0001, now);
      thudG.gain.linearRampToValueAtTime(0.12 + load * 0.18, now + 0.008);
      thudG.gain.exponentialRampToValueAtTime(0.0001, now + 0.11 + load * 0.06);
      thud.connect(thudG);
      thudG.connect(state.sfxBus);
      thud.start(now);
      thud.stop(now + 0.19);

      if (surf === "water" && state.buffers.water_pour) {
        const s = ctx.createBufferSource();
        s.buffer = state.buffers.water_pour;
        s.playbackRate.value = 1.15 + Math.random() * 0.25;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.22 + load * 0.14, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        s.connect(g);
        g.connect(state.sfxBus);
        s.start(now, Math.random() * 0.3, 0.24);
        return;
      }

      if (surf === "gravel" && state.buffers.gravel_footsteps) {
        const s = ctx.createBufferSource();
        s.buffer = state.buffers.gravel_footsteps;
        s.playbackRate.value = 0.92 + Math.random() * 0.18;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.24 + load * 0.12, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        s.connect(g);
        g.connect(state.sfxBus);
        const maxOff = Math.max(0, state.buffers.gravel_footsteps.duration - 0.25);
        s.start(now, Math.random() * maxOff, 0.18);
        return;
      }

      // Tailored stone / grass noise transient
      if (state.noiseBuffer) {
        const n = ctx.createBufferSource();
        n.buffer = state.noiseBuffer;
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = surf === "stone" ? 1950 : 920;
        f.Q.value = surf === "stone" ? 2.4 : 1.1;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime((surf === "stone" ? 0.14 : 0.09) + load * 0.07, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        n.connect(f);
        f.connect(g);
        g.connect(state.sfxBus);
        n.start(now, Math.random() * 1.5, 0.1);
      }
    },

    playWaterSpill: function (intensity) {
      if (!state.ctx || state.ctx.state !== "running" || state.muted) return;
      const ctx = state.ctx;
      const now = ctx.currentTime;
      const amt = clamp(Number(intensity) || 0.5, 0.1, 1);

      if (state.buffers.water_pour) {
        const s = ctx.createBufferSource();
        s.buffer = state.buffers.water_pour;
        s.playbackRate.value = 0.9 + amt * 0.3;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.38 * amt, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45 + amt * 0.35);
        s.connect(g);
        g.connect(state.sfxBus);
        s.start(now, 0, 0.85);
      } else if (state.noiseBuffer) {
        const n = ctx.createBufferSource();
        n.buffer = state.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(1400, now);
        bp.frequency.exponentialRampToValueAtTime(620, now + 0.4);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.28 * amt, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        n.connect(bp);
        bp.connect(g);
        g.connect(state.sfxBus);
        n.start(now, 0, 0.45);
      }
    },

    playImpact: function (intensity) {
      if (!state.ctx || state.ctx.state !== "running" || state.muted) return;
      const ctx = state.ctx;
      const now = ctx.currentTime;
      const amt = clamp(Number(intensity) || 0.5, 0.1, 1);

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(145 + amt * 65, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.45 * amt, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
      osc.connect(g);
      g.connect(state.sfxBus);
      osc.start(now);
      osc.stop(now + 0.28);

      if (state.noiseBuffer) {
        const n = ctx.createBufferSource();
        n.buffer = state.noiseBuffer;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 950 + amt * 1200;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.32 * amt, now);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        n.connect(lp);
        lp.connect(ng);
        ng.connect(state.sfxBus);
        n.start(now, 0, 0.2);
      }
    },

    setStation: function (indexOrId) {
      let idx = state.radioStationIdx;
      if (typeof indexOrId === "number") {
        idx = ((indexOrId % STATIONS.length) + STATIONS.length) % STATIONS.length;
      } else if (typeof indexOrId === "string") {
        const found = STATIONS.findIndex(function (s) { return s.id === indexOrId; });
        if (found !== -1) idx = found;
      }
      state.radioStationIdx = idx;
      state.radioOn = true;
      API.unlock();
      playTuningStatic();
      startActiveStation();
      syncRadioHUDs();
      return STATIONS[state.radioStationIdx];
    },

    toggleRadio: function (forceOn) {
      state.radioOn = typeof forceOn === "boolean" ? forceOn : !state.radioOn;
      API.unlock();
      if (state.radioOn) {
        playTuningStatic();
        startActiveStation();
      } else {
        stopRadioGenerators();
        if (state.ctx && state.radioBus) {
          state.radioBus.gain.setTargetAtTime(0.0001, state.ctx.currentTime, 0.06);
        }
      }
      syncRadioHUDs();
      return state.radioOn;
    },

    setRadioVolume: function (vol) {
      state.radioVol = clamp(Number(vol), 0, 1);
      if (state.ctx && state.radioBus && state.radioOn) {
        state.radioBus.gain.setTargetAtTime(state.radioVol, state.ctx.currentTime, 0.05);
      }
      syncRadioHUDs();
    },

    setMasterMute: function (muted) {
      state.muted = Boolean(muted);
      if (state.ctx && state.masterGain) {
        state.masterGain.gain.setTargetAtTime(state.muted ? 0.0001 : state.masterVol, state.ctx.currentTime, 0.04);
      }
      syncRadioHUDs();
      return state.muted;
    },

    mountRadioHUD: function (container) {
      if (typeof document === "undefined" || !container) return null;
      injectHUDStyles();

      const existing = container.querySelector(".hs-radio-hud");
      if (existing) {
        syncRadioHUDs();
        return existing;
      }

      const root = document.createElement("div");
      root.className = "hs-radio-hud";
      root.setAttribute("role", "region");
      root.setAttribute("aria-label", "Highland Radio Dial");

      const presetsHtml = STATIONS.map(function (s, idx) {
        return '<button type="button" class="hs-preset-btn" data-idx="' + idx + '">' + s.freq + " " + s.name.split(" ")[0] + "</button>";
      }).join("");

      root.innerHTML = [
        '<div class="hs-radio-top"><span class="hs-freq">98.4 FM</span><span class="hs-station-tag">STANDBY</span></div>',
        '<div class="hs-station-name">COSMIC ADDIS</div>',
        '<div class="hs-presets">' + presetsHtml + "</div>",
        '<div class="hs-controls">',
        '  <button type="button" class="hs-btn hs-pwr-btn">RADIO OFF</button>',
        '  <input type="range" class="hs-vol-slider" min="0" max="100" value="65" aria-label="Radio Volume" />',
        '  <button type="button" class="hs-btn hs-mute-btn">MUTE ALL</button>',
        "</div>",
        '<div class="hs-footer"><span>HIGHLAND FM</span><span class="hs-biome-readout">VALLEY VILLAGE</span></div>'
      ].join("");

      root.querySelectorAll(".hs-preset-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          API.setStation(Number(btn.getAttribute("data-idx")));
        });
      });

      const pwrBtn = root.querySelector(".hs-pwr-btn");
      if (pwrBtn) {
        pwrBtn.addEventListener("click", function () {
          API.toggleRadio();
        });
      }

      const muteBtn = root.querySelector(".hs-mute-btn");
      if (muteBtn) {
        muteBtn.addEventListener("click", function () {
          API.setMasterMute(!state.muted);
        });
      }

      const volSlider = root.querySelector(".hs-vol-slider");
      if (volSlider) {
        volSlider.addEventListener("input", function () {
          API.setRadioVolume(Number(volSlider.value) / 100);
        });
      }

      container.appendChild(root);
      state.hudRoots.push(root);
      syncRadioHUDs();
      return root;
    },

    getState: function () {
      return {
        initialized: state.initialized,
        ready: API.isReady(),
        muted: state.muted,
        biome: state.biome,
        elevationM: state.elevationM,
        radioOn: state.radioOn,
        radioVolume: state.radioVol,
        station: STATIONS[state.radioStationIdx],
        loadedSamples: Object.keys(state.buffers)
      };
    }
  };

  global.HighlandSoundscape = API;
})(typeof window !== "undefined" ? window : globalThis);
