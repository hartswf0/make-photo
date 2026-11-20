/* HighlandSoundscape - Warm Cinema-Grade Highland Soundscape, Tactile Foley & Collapsible 1-Pill Radio HUD
 * Exposes window.HighlandSoundscape
 * Zero external dependencies; pairs smooth pink-noise DSP & harmonic tezeta pad with soft WebAudio foley.
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
      desc: "Soft pentatonic krar strings and warm kebero pulse"
    },
    {
      id: "ahiya_dispatch",
      freq: "104.6",
      name: "AHIYA DISPATCH",
      tag: "VALLEY RELAY",
      desc: "Distant valley wind and gentle harmonic chimes"
    },
    {
      id: "highland_archive",
      freq: "107.8",
      name: "HIGHLAND ARCHIVE",
      tag: "AMBIENT BED",
      desc: "Quiet highland field recordings and distant birdsong"
    }
  ];

  // Linear gain helpers (dB reference: -20dB=0.10, -22dB=0.079, -24dB=0.063, -16dB=0.158)
  const BIOME_CONFIG = {
    courtyard: {
      reverbWet: 0.28,
      reverbDry: 0.94,
      windGain: 0.085,
      windFreq: 310,
      padGain: 0.075,
      cricketsGain: 0.045,
      riverGain: 0.015,
      fieldGain: 0.04
    },
    highland_cliff: {
      reverbWet: 0.42,
      reverbDry: 0.88,
      windGain: 0.105,
      windFreq: 520,
      padGain: 0.082,
      cricketsGain: 0.02,
      riverGain: 0.01,
      fieldGain: 0.03
    },
    valley_village: {
      reverbWet: 0.24,
      reverbDry: 0.95,
      windGain: 0.09,
      windFreq: 360,
      padGain: 0.078,
      cricketsGain: 0.055,
      riverGain: 0.02,
      fieldGain: 0.045
    },
    gorge_water: {
      reverbWet: 0.38,
      reverbDry: 0.90,
      windGain: 0.085,
      windFreq: 400,
      padGain: 0.072,
      cricketsGain: 0.03,
      riverGain: 0.085,
      fieldGain: 0.03
    }
  };

  // Donkey bray sample intentionally omitted so loud braying can never play
  const SAMPLE_FILES = {
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
    masterVol: 0.82,
    biome: "valley_village",
    elevationM: 2200,
    buffers: {},
    loadingBuffers: false,

    // Master graph with soft limiter
    masterLimiter: null,
    masterTone: null,
    masterGain: null,
    sfxBus: null,
    dryBus: null,
    reverbSend: null,
    reverbConvolver: null,
    reverbReturn: null,
    biomeIRs: {},
    pinkNoiseBuffer: null,

    // Ambient bed nodes (pink-noise breeze + tezeta harmonic pad + soft beds)
    windGain: null,
    windFilter: null,
    windLfo: null,
    padGain: null,
    padFilter: null,
    padLfo: null,
    cricketsGain: null,
    riverGain: null,
    fieldGain: null,
    ambientStarted: false,
    birdTimer: null,
    lastDonkeyAt: -999,

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
    radioVol: 0.55,
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

  // Paul Kellet pink-noise generator for warm, non-fatiguing breeze & foley
  function makePinkNoiseBuffer(ctx, seconds) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        data[i] = clamp(pink * 0.11, -0.95, 0.95);
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
      const alpha = clamp(bright, 0.06, 0.65);
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
    const k = amount || 10;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 18 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
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

    // Soft master tone ceiling + DynamicsCompressorNode limiter so nothing ever clips or sounds harsh
    state.masterGain = ctx.createGain();
    state.masterGain.gain.value = state.muted ? 0.0001 : state.masterVol;

    state.masterTone = ctx.createBiquadFilter();
    state.masterTone.type = "lowpass";
    state.masterTone.frequency.value = 10800;
    state.masterTone.Q.value = 0.5;

    state.masterLimiter = ctx.createDynamicsCompressor();
    state.masterLimiter.threshold.value = -10;
    state.masterLimiter.knee.value = 14;
    state.masterLimiter.ratio.value = 10;
    state.masterLimiter.attack.value = 0.005;
    state.masterLimiter.release.value = 0.14;

    state.masterGain.connect(state.masterTone);
    state.masterTone.connect(state.masterLimiter);
    state.masterLimiter.connect(ctx.destination);

    state.sfxBus = ctx.createGain();
    state.sfxBus.gain.value = 0.88;
    state.dryBus = ctx.createGain();
    state.dryBus.gain.value = 0.94;
    state.sfxBus.connect(state.dryBus);
    state.dryBus.connect(state.masterGain);

    // Warm Biome Convolver Reverb
    state.biomeIRs = {
      courtyard: makeImpulseResponse(ctx, 0.65, 2.9, 0.42),
      highland_cliff: makeImpulseResponse(ctx, 1.85, 2.3, 0.30),
      valley_village: makeImpulseResponse(ctx, 0.95, 2.7, 0.34),
      gorge_water: makeImpulseResponse(ctx, 1.35, 2.2, 0.38)
    };
    state.reverbSend = ctx.createGain();
    state.reverbSend.gain.value = 0.32;
    state.reverbConvolver = ctx.createConvolver();
    state.reverbConvolver.buffer = state.biomeIRs[state.biome] || state.biomeIRs.valley_village;
    state.reverbReturn = ctx.createGain();
    state.reverbReturn.gain.value = 0.24;
    state.sfxBus.connect(state.reverbSend);
    state.reverbSend.connect(state.reverbConvolver);
    state.reverbConvolver.connect(state.reverbReturn);
    state.reverbReturn.connect(state.masterGain);

    state.pinkNoiseBuffer = makePinkNoiseBuffer(ctx, 4.0);

    // 1. Smooth Pink-Noise Low-Passed Highland Breeze (280-650 Hz, ~ -20 dB)
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = state.pinkNoiseBuffer;
    windSrc.loop = true;
    state.windFilter = ctx.createBiquadFilter();
    state.windFilter.type = "lowpass";
    state.windFilter.frequency.value = 360;
    state.windFilter.Q.value = 0.65;
    state.windGain = ctx.createGain();
    state.windGain.gain.value = 0.09;

    // Slow breeze swell LFO
    state.windLfo = ctx.createOscillator();
    state.windLfo.type = "sine";
    state.windLfo.frequency.value = 0.085;
    const windLfoDepth = ctx.createGain();
    windLfoDepth.gain.value = 75;
    state.windLfo.connect(windLfoDepth);
    windLfoDepth.connect(state.windFilter.frequency);
    state.windLfo.start();

    windSrc.connect(state.windFilter);
    state.windFilter.connect(state.windGain);
    state.windGain.connect(state.sfxBus);
    windSrc.start();

    // 2. Gentle Distant Harmonic Tezeta Pentatonic Acoustic Pad (~ -22 dB)
    // Soft warm sine + triangle open fifths (D3 146.83 Hz, A3 220 Hz, D4 293.66 Hz) with slow LFO breathing
    state.padFilter = ctx.createBiquadFilter();
    state.padFilter.type = "lowpass";
    state.padFilter.frequency.value = 540;
    state.padFilter.Q.value = 0.5;

    state.padGain = ctx.createGain();
    state.padGain.gain.value = 0.075;

    const padBreathGain = ctx.createGain();
    padBreathGain.gain.value = 0.78;
    state.padLfo = ctx.createOscillator();
    state.padLfo.type = "sine";
    state.padLfo.frequency.value = 0.065;
    const padLfoDepth = ctx.createGain();
    padLfoDepth.gain.value = 0.22;
    state.padLfo.connect(padLfoDepth);
    padLfoDepth.connect(padBreathGain.gain);
    state.padLfo.start();

    const padVoices = [
      { type: "sine", freq: 146.83, gain: 0.42 },     // D3 root
      { type: "triangle", freq: 220.0, gain: 0.24 },  // A3 fifth
      { type: "sine", freq: 293.66, gain: 0.16 },     // D4 octave
      { type: "sine", freq: 349.23, gain: 0.08 }      // F4 gentle tezeta color
    ];
    padVoices.forEach(function (v) {
      const osc = ctx.createOscillator();
      const vg = ctx.createGain();
      osc.type = v.type;
      osc.frequency.value = v.freq;
      vg.gain.value = v.gain;
      osc.connect(vg);
      vg.connect(state.padFilter);
      osc.start();
    });

    state.padFilter.connect(padBreathGain);
    padBreathGain.connect(state.padGain);
    state.padGain.connect(state.reverbSend);
    state.padGain.connect(state.dryBus);

    // 3. Soft Low-Passed Sample Ambient Beds (~ -24 dB)
    const bedLP = ctx.createBiquadFilter();
    bedLP.type = "lowpass";
    bedLP.frequency.value = 3400;
    bedLP.Q.value = 0.6;
    bedLP.connect(state.sfxBus);

    state.cricketsGain = ctx.createGain();
    state.cricketsGain.gain.value = 0.0001;
    state.cricketsGain.connect(bedLP);

    state.riverGain = ctx.createGain();
    state.riverGain.gain.value = 0.0001;
    state.riverGain.connect(bedLP);

    state.fieldGain = ctx.createGain();
    state.fieldGain.gain.value = 0.0001;
    state.fieldGain.connect(bedLP);

    // Spatial Pump Rig (warm damped mechanical creak, no harsh sawtooth screech)
    state.pumpPanner = createPanner(ctx, { x: 0, y: 0, z: 0 });
    state.pumpGain = ctx.createGain();
    state.pumpGain.gain.value = 0.55;
    state.pumpPanner.connect(state.pumpGain);
    state.pumpGain.connect(state.sfxBus);

    state.pumpSqueakOsc = ctx.createOscillator();
    state.pumpSqueakOsc.type = "triangle";
    state.pumpSqueakOsc.frequency.value = 320;
    const sqFilter = ctx.createBiquadFilter();
    sqFilter.type = "bandpass";
    sqFilter.frequency.value = 540;
    sqFilter.Q.value = 1.6;
    state.pumpSqueakGain = ctx.createGain();
    state.pumpSqueakGain.gain.value = 0.0001;
    state.pumpSqueakOsc.connect(sqFilter);
    sqFilter.connect(state.pumpSqueakGain);
    state.pumpSqueakGain.connect(state.pumpPanner);
    state.pumpSqueakOsc.start();

    // Spatial Vehicle Rig (warm low-passed triangle/sine hum, gentle rattle)
    state.vehPanner = createPanner(ctx, { x: 0, y: 0, z: 0 });
    state.vehGain = ctx.createGain();
    state.vehGain.gain.value = 0.0001;
    state.vehFilter = ctx.createBiquadFilter();
    state.vehFilter.type = "lowpass";
    state.vehFilter.frequency.value = 210;
    state.vehFilter.Q.value = 0.9;

    state.vehOsc1 = ctx.createOscillator();
    state.vehOsc1.type = "triangle";
    state.vehOsc1.frequency.value = 48;
    state.vehOsc2 = ctx.createOscillator();
    state.vehOsc2.type = "sine";
    state.vehOsc2.frequency.value = 96;

    const engMix = ctx.createGain();
    engMix.gain.value = 0.25;
    state.vehOsc1.connect(engMix);
    state.vehOsc2.connect(engMix);
    engMix.connect(state.vehFilter);
    state.vehFilter.connect(state.vehGain);

    const rattleNoise = ctx.createBufferSource();
    rattleNoise.buffer = state.pinkNoiseBuffer;
    rattleNoise.loop = true;
    state.vehRattleFilter = ctx.createBiquadFilter();
    state.vehRattleFilter.type = "bandpass";
    state.vehRattleFilter.frequency.value = 780;
    state.vehRattleFilter.Q.value = 2.0;
    state.vehRattleGain = ctx.createGain();
    state.vehRattleGain.gain.value = 0.0001;
    rattleNoise.connect(state.vehRattleFilter);
    state.vehRattleFilter.connect(state.vehRattleGain);
    state.vehRattleGain.connect(state.vehPanner);
    rattleNoise.start();

    state.vehSputterLfo = ctx.createOscillator();
    state.vehSputterLfo.type = "sine";
    state.vehSputterLfo.frequency.value = 6.5;
    state.vehSputterDepth = ctx.createGain();
    state.vehSputterDepth.gain.value = 0.0;
    state.vehSputterLfo.connect(state.vehSputterDepth);
    state.vehSputterDepth.connect(state.vehGain.gain);
    state.vehSputterLfo.start();

    state.vehGain.connect(state.vehPanner);
    state.vehPanner.connect(state.sfxBus);
    state.vehOsc1.start();
    state.vehOsc2.start();

    // Radio Bus (warm tape shelf + gentle level)
    state.radioBus = ctx.createGain();
    state.radioBus.gain.value = state.radioOn ? state.radioVol : 0.0001;
    state.radioBus.connect(state.masterGain);

    state.radioCosmicGain = ctx.createGain();
    state.radioCosmicGain.gain.value = 0.0001;
    state.radioTapeShaper = ctx.createWaveShaper();
    state.radioTapeShaper.curve = makeTapeCurve(10);
    state.radioTapeShaper.oversample = "2x";
    const tapeWarmth = ctx.createBiquadFilter();
    tapeWarmth.type = "lowshelf";
    tapeWarmth.frequency.value = 240;
    tapeWarmth.gain.value = 2.5;
    state.radioTapeShaper.connect(tapeWarmth);
    tapeWarmth.connect(state.radioCosmicGain);
    state.radioCosmicGain.connect(state.radioBus);

    state.radioSynthGain = ctx.createGain();
    state.radioSynthGain.gain.value = 0.72;
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
      if (state.biome === "highland_cliff" || state.biome === "valley_village" || state.biome === "courtyard") {
        if (Math.random() < 0.35) {
          // Subtle distant birdsong at ~ -24 dB
          playHighlandBirdChirp(0.055);
        }
      }
    }, 6800);
  }

  function playHighlandBirdChirp(vol) {
    const ctx = state.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const baseF = 1350 + Math.random() * 650;
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseF, now);
    osc.frequency.exponentialRampToValueAtTime(baseF * 1.18, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(baseF * 0.94, now + 0.22);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(clamp(vol || 0.05, 0.01, 0.063), now + 0.035);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.connect(g);
    g.connect(state.reverbSend);
    osc.start(now);
    osc.stop(now + 0.27);
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
    state.reverbReturn.gain.setTargetAtTime(cfg.reverbWet, t, 0.55);
    state.dryBus.gain.setTargetAtTime(cfg.reverbDry, t, 0.55);

    // Keep highland breeze strictly within 280-650 Hz and around -20 dB (0.08 - 0.115)
    const targetWindFreq = clamp(cfg.windFreq + elevFactor * 120, 280, 650);
    const targetWindGain = clamp(cfg.windGain + elevFactor * 0.018, 0.07, 0.115);
    state.windGain.gain.setTargetAtTime(targetWindGain, t, 0.65);
    state.windFilter.frequency.setTargetAtTime(targetWindFreq, t, 0.65);

    if (state.padGain) {
      state.padGain.gain.setTargetAtTime(cfg.padGain, t, 0.9);
    }
    state.cricketsGain.gain.setTargetAtTime(cfg.cricketsGain, t, 0.7);
    state.riverGain.gain.setTargetAtTime(cfg.riverGain, t, 0.7);
    state.fieldGain.gain.setTargetAtTime(cfg.fieldGain, t, 0.9);
  }

  // Soft warm dial click/whoosh instead of harsh radio static burst
  function playTuningStatic() {
    const ctx = state.ctx;
    if (!ctx || ctx.state !== "running" || !state.pinkNoiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = state.pinkNoiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(920, now);
    lp.frequency.exponentialRampToValueAtTime(420, now + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.055 * state.radioVol, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    src.connect(lp);
    lp.connect(g);
    g.connect(state.masterGain);
    src.start(now, Math.random() * 1.5, 0.13);
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

  // Warm plucked krar (triangle + sine, smooth lowpass, no harsh sawtooth)
  function triggerKrarPluck(freq, vol) {
    const ctx = state.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const harm = ctx.createOscillator();
    osc.type = "triangle";
    harm.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    harm.frequency.setValueAtTime(freq * 2.0, now);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(freq * 3.4, now);
    lp.frequency.exponentialRampToValueAtTime(freq * 1.3, now + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
    const hg = ctx.createGain();
    hg.gain.value = 0.16;
    osc.connect(lp);
    harm.connect(hg);
    hg.connect(lp);
    lp.connect(g);
    g.connect(state.radioSynthGain);
    osc.start(now);
    harm.start(now);
    osc.stop(now + 0.65);
    harm.stop(now + 0.65);
  }

  function triggerKeberoHit(low) {
    const ctx = state.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(low ? 118 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(low ? 58 : 128, now + 0.14);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(low ? 0.13 : 0.07, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(g);
    g.connect(state.radioSynthGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  function triggerSoftChime() {
    const ctx = state.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const f = TEZETA_HZ[Math.floor(Math.random() * TEZETA_HZ.length)];
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f * 2, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.045, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
    osc.connect(g);
    g.connect(state.radioSynthGain);
    osc.start(now);
    osc.stop(now + 1.0);
  }

  function startActiveStation() {
    stopRadioGenerators();
    if (!state.radioOn || !state.ctx) return;

    const ctx = state.ctx;
    const now = ctx.currentTime;
    const st = STATIONS[state.radioStationIdx] || STATIONS[0];
    state.radioBus.gain.setTargetAtTime(state.radioVol, now, 0.08);

    if (st.id === "cosmic_addis") {
      state.radioCosmicGain.gain.setTargetAtTime(0.75, now, 0.16);
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
        state.radioBedGain.gain.setTargetAtTime(0.14, now, 0.22);
      }
      state.radioLoopStep = 0;
      const pattern = [0, 2, 3, 2, 4, 3, 1, 0, 5, 3, 2, 1];
      state.radioLoopTimer = setInterval(function () {
        if (!state.radioOn || !state.ctx || state.ctx.state !== "running") return;
        const step = state.radioLoopStep++;
        const scale = Math.floor(step / 24) % 2 === 0 ? TEZETA_HZ : BATI_HZ;
        const noteIdx = pattern[step % pattern.length];
        triggerKrarPluck(scale[noteIdx], 0.11);
        if (step % 6 === 0) triggerKeberoHit(true);
        else if (step % 6 === 3) triggerKeberoHit(false);
      }, 340);
    } else if (st.id === "ahiya_dispatch") {
      if (state.buffers.crickets_night) {
        const s = ctx.createBufferSource();
        s.buffer = state.buffers.crickets_night;
        s.loop = true;
        s.connect(state.radioBedGain);
        s.start();
        state.radioBedSrc = s;
        state.radioBedGain.gain.setTargetAtTime(0.15, now, 0.22);
      }
      state.radioLoopTimer = setInterval(function () {
        if (!state.radioOn || !state.ctx || state.ctx.state !== "running") return;
        if (Math.random() < 0.45) {
          triggerSoftChime();
        }
      }, 2800);
    } else if (st.id === "highland_archive") {
      const buf = state.buffers.ethiopia_field || state.buffers.river_gorge || state.buffers.crickets_night;
      if (buf) {
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        s.connect(state.radioBedGain);
        s.start();
        state.radioBedSrc = s;
        state.radioBedGain.gain.setTargetAtTime(0.22, now, 0.28);
      }
      state.radioLoopTimer = setInterval(function () {
        if (!state.radioOn || !state.ctx || state.ctx.state !== "running") return;
        if (Math.random() < 0.4) playHighlandBirdChirp(0.055);
      }, 3800);
    }
  }

  function syncRadioHUDs() {
    const st = STATIONS[state.radioStationIdx] || STATIONS[0];
    state.hudRoots.forEach(function (root) {
      if (!root) return;
      const pillLabel = root.querySelector(".hs-pill-label");
      const pillDot = root.querySelector(".hs-pill-dot");
      const freqEl = root.querySelector(".hs-freq");
      const nameEl = root.querySelector(".hs-station-name");
      const tagEl = root.querySelector(".hs-station-tag");
      const pwrBtn = root.querySelector(".hs-pwr-btn");
      const muteBtn = root.querySelector(".hs-mute-btn");
      const volSlider = root.querySelector(".hs-vol-slider");
      const biomeEl = root.querySelector(".hs-biome-readout");

      if (pillLabel) {
        if (state.muted) {
          pillLabel.textContent = "AUDIO \u00B7 MUTE";
        } else if (state.radioOn) {
          pillLabel.textContent = "RADIO \u00B7 " + st.freq;
        } else {
          pillLabel.textContent = "AUDIO \u00B7 OFF";
        }
      }
      if (pillDot) {
        pillDot.classList.toggle("on", state.radioOn && !state.muted);
        pillDot.classList.toggle("muted", state.muted);
      }
      if (freqEl) freqEl.textContent = st.freq + " FM";
      if (nameEl) nameEl.textContent = st.name;
      if (tagEl) tagEl.textContent = state.radioOn ? st.tag : "STANDBY";
      if (pwrBtn) {
        pwrBtn.textContent = state.radioOn ? "RADIO ON" : "RADIO OFF";
        pwrBtn.classList.toggle("active", state.radioOn);
      }
      if (muteBtn) {
        muteBtn.textContent = state.muted ? "UNMUTE" : "MUTE";
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
      ".hs-radio-hud{position:relative;display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#f2e7d2;user-select:none;font-size:11px;line-height:1.25;z-index:20;}",
      ".hs-pill-btn{display:inline-flex;align-items:center;gap:6px;background:rgba(14,13,12,0.82);border:1px solid rgba(226,178,94,0.36);border-radius:999px;padding:5px 11px;color:#f2e7d2;font-family:inherit;font-size:10px;font-weight:700;letter-spacing:0.09em;cursor:pointer;backdrop-filter:blur(8px);transition:border-color 120ms,background 120ms;}",
      ".hs-pill-btn:hover{border-color:rgba(240,184,92,0.72);background:rgba(24,21,18,0.92);}",
      ".hs-pill-dot{width:6px;height:6px;border-radius:50%;background:#7c705d;display:inline-block;flex-shrink:0;}",
      ".hs-pill-dot.on{background:#e8b45a;box-shadow:0 0 6px rgba(232,180,90,0.75);}",
      ".hs-pill-dot.muted{background:#a6534b;}",
      ".hs-popover{display:none;position:absolute;bottom:calc(100% + 7px);right:0;width:228px;background:rgba(14,13,12,0.93);border:1px solid rgba(226,178,94,0.38);border-radius:8px;padding:8px 9px;box-sizing:border-box;backdrop-filter:blur(10px);box-shadow:0 8px 24px rgba(0,0,0,0.45);}",
      ".hs-radio-hud.hs-open .hs-popover{display:block;}",
      ".hs-radio-top{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(226,178,94,0.2);padding-bottom:4px;margin-bottom:5px;}",
      ".hs-freq{color:#f0b85c;font-weight:700;font-size:12px;letter-spacing:0.06em;}",
      ".hs-station-tag{color:#a89b84;font-size:8.5px;letter-spacing:0.11em;text-transform:uppercase;}",
      ".hs-station-name{font-weight:700;font-size:10.5px;letter-spacing:0.08em;color:#fff6e3;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".hs-presets{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px;}",
      ".hs-preset-btn{background:rgba(255,255,255,0.05);border:1px solid rgba(226,178,94,0.2);color:#d7cab3;border-radius:4px;padding:3px 5px;font-size:9px;font-family:inherit;cursor:pointer;text-align:left;transition:background 120ms,border-color 120ms;}",
      ".hs-preset-btn:hover{background:rgba(240,184,92,0.16);border-color:rgba(240,184,92,0.55);}",
      ".hs-preset-btn.active{background:rgba(240,184,92,0.24);border-color:#f0b85c;color:#fff8ea;font-weight:700;}",
      ".hs-controls{display:flex;align-items:center;gap:5px;margin-bottom:4px;}",
      ".hs-btn{background:rgba(255,255,255,0.07);border:1px solid rgba(226,178,94,0.28);color:#f2e7d2;border-radius:4px;padding:3px 6px;font-size:9px;font-family:inherit;cursor:pointer;letter-spacing:0.06em;}",
      ".hs-btn.active{background:#e2a84a;border-color:#f5c774;color:#12100d;font-weight:700;}",
      ".hs-vol-slider{flex:1;accent-color:#f0b85c;height:4px;cursor:pointer;}",
      ".hs-footer{display:flex;justify-content:space-between;font-size:8.5px;color:#9c8f78;letter-spacing:0.08em;}"
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

    // Disabled loud donkey braying: now a very soft, rare low-passed gentle hoof-tap / exhale at -24 dB
    playDonkeyCall: function (pos) {
      if (!state.ctx || state.ctx.state !== "running" || state.muted) return;
      const ctx = state.ctx;
      const now = ctx.currentTime;
      if (now - state.lastDonkeyAt < 10.0) return;
      state.lastDonkeyAt = now;

      const panner = createPanner(ctx, pos || { x: 0, y: 1, z: -4 });
      const outGain = ctx.createGain();
      outGain.gain.value = 0.063; // -24 dB ceiling
      panner.connect(outGain);
      outGain.connect(state.sfxBus);

      // Gentle muted hoof tap
      const tap = ctx.createOscillator();
      const tapG = ctx.createGain();
      tap.type = "sine";
      tap.frequency.setValueAtTime(115, now);
      tap.frequency.exponentialRampToValueAtTime(48, now + 0.07);
      tapG.gain.setValueAtTime(0.0001, now);
      tapG.gain.linearRampToValueAtTime(0.75, now + 0.006);
      tapG.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      tap.connect(tapG);
      tapG.connect(panner);
      tap.start(now);
      tap.stop(now + 0.11);

      // Soft low-passed breath exhale
      if (state.pinkNoiseBuffer) {
        const n = ctx.createBufferSource();
        n.buffer = state.pinkNoiseBuffer;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(340, now + 0.05);
        lp.frequency.exponentialRampToValueAtTime(180, now + 0.34);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, now + 0.05);
        ng.gain.linearRampToValueAtTime(0.65, now + 0.12);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
        n.connect(lp);
        lp.connect(ng);
        ng.connect(panner);
        n.start(now + 0.05, Math.random() * 1.5, 0.35);
      }

      setTimeout(function () {
        try { panner.disconnect(); outGain.disconnect(); } catch (e) {}
      }, 600);
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
      state.pumpSqueakOsc.frequency.setTargetAtTime(260 + wear * 180 + Math.sin(now * 6) * 20, now, 0.05);
      state.pumpSqueakGain.gain.setTargetAtTime(0.008 + wear * 0.022, now, 0.07);

      if (now - state.pumpStrokeAt >= 0.78) {
        state.pumpStrokeAt = now;
        if (state.buffers.metal_pump) {
          const s = ctx.createBufferSource();
          s.buffer = state.buffers.metal_pump;
          s.playbackRate.value = 0.88 + wear * 0.14;
          const lp = ctx.createBiquadFilter();
          lp.type = "lowpass";
          lp.frequency.value = 1800;
          const sg = ctx.createGain();
          sg.gain.value = 0.18 + wear * 0.12;
          s.connect(lp);
          lp.connect(sg);
          sg.connect(state.pumpPanner);
          s.start(now);
        }
        if (state.buffers.water_pour) {
          const w = ctx.createBufferSource();
          w.buffer = state.buffers.water_pour;
          const wg = ctx.createGain();
          wg.gain.setValueAtTime(0.0001, now);
          wg.gain.linearRampToValueAtTime(0.18 * (0.4 + cond * 0.6), now + 0.08);
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

      const baseFreq = 38 + rpm * 82 + Math.min(spd, 25) * 1.4;
      state.vehOsc1.frequency.setTargetAtTime(baseFreq, now, 0.06);
      state.vehOsc2.frequency.setTargetAtTime(baseFreq * 2.0, now, 0.06);
      state.vehFilter.frequency.setTargetAtTime(180 + rpm * 420, now, 0.07);
      state.vehGain.gain.setTargetAtTime(0.07 + rpm * 0.09, now, 0.09);

      if (integ < 0.5) {
        const dmg = clamp((0.5 - integ) * 2, 0, 1);
        state.vehRattleFilter.frequency.setTargetAtTime(680 + dmg * 420 + (spd * 12), now, 0.07);
        state.vehRattleGain.gain.setTargetAtTime(dmg * (0.025 + rpm * 0.04), now, 0.09);
        state.vehSputterLfo.frequency.setTargetAtTime(5.5 + dmg * 5.0, now, 0.09);
        state.vehSputterDepth.gain.setTargetAtTime(dmg * 0.03, now, 0.09);
      } else {
        state.vehRattleGain.gain.setTargetAtTime(0.0001, now, 0.1);
        state.vehSputterDepth.gain.setTargetAtTime(0.0, now, 0.1);
      }
    },

    // Clean gentle tactile footstep (~ -16 dB)
    playFootstep: function (surface, weightKg) {
      if (!state.ctx || state.ctx.state !== "running" || state.muted) return;
      const ctx = state.ctx;
      const now = ctx.currentTime;
      const surf = surface || "gravel";
      const load = clamp((Number(weightKg) || 0) / 40, 0, 1);

      // Soft weight-scaled low thud
      const thud = ctx.createOscillator();
      const thudG = ctx.createGain();
      thud.type = "sine";
      const startHz = (surf === "stone" ? 118 : 92) - load * 22;
      thud.frequency.setValueAtTime(Math.max(44, startHz), now);
      thud.frequency.exponentialRampToValueAtTime(34, now + 0.08 + load * 0.04);
      thudG.gain.setValueAtTime(0.0001, now);
      thudG.gain.linearRampToValueAtTime(0.09 + load * 0.065, now + 0.007);
      thudG.gain.exponentialRampToValueAtTime(0.0001, now + 0.095 + load * 0.045);
      thud.connect(thudG);
      thudG.connect(state.sfxBus);
      thud.start(now);
      thud.stop(now + 0.16);

      if (surf === "water" && state.buffers.water_pour) {
        const s = ctx.createBufferSource();
        s.buffer = state.buffers.water_pour;
        s.playbackRate.value = 1.1 + Math.random() * 0.2;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 2200;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.11 + load * 0.05, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        s.connect(lp);
        lp.connect(g);
        g.connect(state.sfxBus);
        s.start(now, Math.random() * 0.3, 0.2);
        return;
      }

      if (surf === "gravel" && state.buffers.gravel_footsteps) {
        const s = ctx.createBufferSource();
        s.buffer = state.buffers.gravel_footsteps;
        s.playbackRate.value = 0.92 + Math.random() * 0.16;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 2100;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.12 + load * 0.04, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
        s.connect(lp);
        lp.connect(g);
        g.connect(state.sfxBus);
        const maxOff = Math.max(0, state.buffers.gravel_footsteps.duration - 0.22);
        s.start(now, Math.random() * maxOff, 0.15);
        return;
      }

      // Soft pink-noise surface brush
      if (state.pinkNoiseBuffer) {
        const n = ctx.createBufferSource();
        n.buffer = state.pinkNoiseBuffer;
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = surf === "stone" ? 1250 : 680;
        f.Q.value = surf === "stone" ? 1.5 : 0.9;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime((surf === "stone" ? 0.09 : 0.065) + load * 0.035, now + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
        n.connect(f);
        f.connect(g);
        g.connect(state.sfxBus);
        n.start(now, Math.random() * 2.0, 0.09);
      }
    },

    // Crisp, subtle tactile item pickup (~ -16 dB)
    playPickup: function () {
      if (!state.ctx || state.ctx.state !== "running" || state.muted) return;
      const ctx = state.ctx;
      const now = ctx.currentTime;

      // Subtle warm wooden/plastic contact tap
      const tap = ctx.createOscillator();
      const tapG = ctx.createGain();
      tap.type = "triangle";
      tap.frequency.setValueAtTime(310, now);
      tap.frequency.exponentialRampToValueAtTime(520, now + 0.065);
      tapG.gain.setValueAtTime(0.0001, now);
      tapG.gain.linearRampToValueAtTime(0.13, now + 0.006);
      tapG.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
      tap.connect(tapG);
      tapG.connect(state.sfxBus);
      tap.start(now);
      tap.stop(now + 0.1);

      // Gentle upward harmonic confirmation
      const chime = ctx.createOscillator();
      const chG = ctx.createGain();
      chime.type = "sine";
      chime.frequency.setValueAtTime(440, now + 0.035);
      chime.frequency.exponentialRampToValueAtTime(587.33, now + 0.11);
      chG.gain.setValueAtTime(0.0001, now + 0.035);
      chG.gain.linearRampToValueAtTime(0.085, now + 0.05);
      chG.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
      chime.connect(chG);
      chG.connect(state.sfxBus);
      chime.start(now + 0.035);
      chime.stop(now + 0.19);
    },

    // Smooth tactile throw/release whoosh (~ -16 dB)
    playThrow: function () {
      if (!state.ctx || state.ctx.state !== "running" || state.muted) return;
      const ctx = state.ctx;
      const now = ctx.currentTime;

      if (state.pinkNoiseBuffer) {
        const n = ctx.createBufferSource();
        n.buffer = state.pinkNoiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(680, now);
        bp.frequency.exponentialRampToValueAtTime(240, now + 0.14);
        bp.Q.value = 1.1;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.15, now + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        n.connect(bp);
        bp.connect(g);
        g.connect(state.sfxBus);
        n.start(now, Math.random() * 2.0, 0.18);
      }

      const body = ctx.createOscillator();
      const bg = ctx.createGain();
      body.type = "sine";
      body.frequency.setValueAtTime(220, now);
      body.frequency.exponentialRampToValueAtTime(110, now + 0.09);
      bg.gain.setValueAtTime(0.0001, now);
      bg.gain.linearRampToValueAtTime(0.08, now + 0.01);
      bg.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      body.connect(bg);
      bg.connect(state.sfxBus);
      body.start(now);
      body.stop(now + 0.12);
    },

    // Muffled, non-jarring ragdoll tumble / body thud (scaled by intensity 0..1)
    playRagdollThud: function (intensity) {
      if (!state.ctx || state.ctx.state !== "running" || state.muted) return;
      const ctx = state.ctx;
      const now = ctx.currentTime;
      const amt = clamp(Number.isFinite(Number(intensity)) ? Number(intensity) : 0.6, 0.1, 1);

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(98 + amt * 36, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.16);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.19 * amt, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
      osc.connect(g);
      g.connect(state.sfxBus);
      osc.start(now);
      osc.stop(now + 0.21);

      if (state.pinkNoiseBuffer) {
        const n = ctx.createBufferSource();
        n.buffer = state.pinkNoiseBuffer;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 380 + amt * 260;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, now);
        ng.gain.linearRampToValueAtTime(0.14 * amt, now + 0.009);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        n.connect(lp);
        lp.connect(ng);
        ng.connect(state.sfxBus);
        n.start(now, Math.random() * 2.0, 0.16);
      }
    },

    // Pleasant warm water delivery pour + gentle pentatonic confirmation (~ -16 dB)
    playWaterDeliver: function () {
      if (!state.ctx || state.ctx.state !== "running" || state.muted) return;
      const ctx = state.ctx;
      const now = ctx.currentTime;

      if (state.buffers.water_pour) {
        const s = ctx.createBufferSource();
        s.buffer = state.buffers.water_pour;
        s.playbackRate.value = 1.02;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 2400;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.14, now + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        s.connect(lp);
        lp.connect(g);
        g.connect(state.sfxBus);
        s.start(now, 0, 0.45);
      }

      // Warm 2-note tezeta fifth (D4 -> A4)
      [293.66, 440.0].forEach(function (freq, i) {
        const t0 = now + i * 0.11;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.11, t0 + 0.018);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.48);
        osc.connect(g);
        g.connect(state.sfxBus);
        osc.start(t0);
        osc.stop(t0 + 0.52);
      });
    },

    playWaterSpill: function (intensity) {
      if (!state.ctx || state.ctx.state !== "running" || state.muted) return;
      const ctx = state.ctx;
      const now = ctx.currentTime;
      const amt = clamp(Number(intensity) || 0.5, 0.1, 1);

      if (state.buffers.water_pour) {
        const s = ctx.createBufferSource();
        s.buffer = state.buffers.water_pour;
        s.playbackRate.value = 0.92 + amt * 0.22;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 2200;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.19 * amt, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38 + amt * 0.25);
        s.connect(lp);
        lp.connect(g);
        g.connect(state.sfxBus);
        s.start(now, 0, 0.7);
      } else if (state.pinkNoiseBuffer) {
        const n = ctx.createBufferSource();
        n.buffer = state.pinkNoiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(1100, now);
        bp.frequency.exponentialRampToValueAtTime(480, now + 0.34);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.16 * amt, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
        n.connect(bp);
        bp.connect(g);
        g.connect(state.sfxBus);
        n.start(now, 0, 0.4);
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
      osc.frequency.setValueAtTime(125 + amt * 45, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.18);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.22 * amt, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(g);
      g.connect(state.sfxBus);
      osc.start(now);
      osc.stop(now + 0.24);

      if (state.pinkNoiseBuffer) {
        const n = ctx.createBufferSource();
        n.buffer = state.pinkNoiseBuffer;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 620 + amt * 580;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.15 * amt, now);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        n.connect(lp);
        lp.connect(ng);
        ng.connect(state.sfxBus);
        n.start(now, Math.random() * 2.0, 0.17);
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

    // Uncluttered collapsible 1-pill Radio HUD: collapsed by default, expands small popover on click
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
      root.setAttribute("aria-label", "Highland Audio Controls");

      const presetsHtml = STATIONS.map(function (s, idx) {
        return '<button type="button" class="hs-preset-btn" data-idx="' + idx + '">' + s.freq + " " + s.name.split(" ")[0] + "</button>";
      }).join("");

      root.innerHTML = [
        '<button type="button" class="hs-pill-btn" aria-expanded="false" aria-haspopup="true">',
        '  <span class="hs-pill-dot"></span>',
        '  <span class="hs-pill-label">AUDIO \u00B7 OFF</span>',
        "</button>",
        '<div class="hs-popover" role="dialog" aria-label="Highland Radio Panel">',
        '  <div class="hs-radio-top"><span class="hs-freq">98.4 FM</span><span class="hs-station-tag">STANDBY</span></div>',
        '  <div class="hs-station-name">COSMIC ADDIS</div>',
        '  <div class="hs-presets">' + presetsHtml + "</div>",
        '  <div class="hs-controls">',
        '    <button type="button" class="hs-btn hs-pwr-btn">RADIO OFF</button>',
        '    <input type="range" class="hs-vol-slider" min="0" max="100" value="55" aria-label="Radio Volume" />',
        '    <button type="button" class="hs-btn hs-mute-btn">MUTE</button>',
        "  </div>",
        '  <div class="hs-footer"><span>HIGHLAND FM</span><span class="hs-biome-readout">VALLEY VILLAGE</span></div>',
        "</div>"
      ].join("");

      const pillBtn = root.querySelector(".hs-pill-btn");
      function setOpen(open) {
        root.classList.toggle("hs-open", open);
        if (pillBtn) pillBtn.setAttribute("aria-expanded", open ? "true" : "false");
      }

      if (pillBtn) {
        pillBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          API.unlock();
          setOpen(!root.classList.contains("hs-open"));
        });
      }

      document.addEventListener("click", function (ev) {
        if (root.classList.contains("hs-open") && !root.contains(ev.target)) {
          setOpen(false);
        }
      });

      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && root.classList.contains("hs-open")) {
          setOpen(false);
        }
      });

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
