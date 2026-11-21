// Condition-based Freesound Spatial Audio & Acoustic Interior Engine
// Zero continuous synthetic drones; real Freesound CC0/CC-BY samples + interior reverb crossfade

export class CityAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.master = null;
    this.exteriorFilter = null;
    this.exteriorGain = null;
    this.interiorGain = null;
    this.convolver = null;
    this.buffers = {};
    this.loops = {};
    this.isInside = false;
    this.nightMix = 0.7;
    this.submerged = false;
    this.pumpTimer = 0;
    this.footstepTimer = 0;
    this.loaded = false;
  }

  async toggle() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.0001;
      this.master.connect(this.ctx.destination);

      this.exteriorFilter = this.ctx.createBiquadFilter();
      this.exteriorFilter.type = 'lowpass';
      this.exteriorFilter.frequency.value = 14000;
      this.exteriorFilter.Q.value = 0.7;

      this.exteriorGain = this.ctx.createGain();
      this.exteriorGain.gain.value = 0.55;
      this.exteriorFilter.connect(this.exteriorGain);
      this.exteriorGain.connect(this.master);

      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = this._makeStoneImpulse(1.55, 2.8);
      this.interiorGain = this.ctx.createGain();
      this.interiorGain.gain.value = 0.0;
      this.convolver.connect(this.interiorGain);
      this.interiorGain.connect(this.master);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.enabled = !this.enabled;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.enabled ? 0.85 : 0.0001, now, 0.14);

    if (this.enabled && !this.loaded) {
      this.loaded = true;
      await this._loadSamples();
      this._startAmbientLoops();
    }
    return this.enabled;
  }

  _makeStoneImpulse(duration, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, decay);
        data[i] = (Math.random() * 2 - 1) * env * 0.28;
      }
    }
    return buf;
  }

  async _loadSamples() {
    const manifest = {
      field: '../audio/samples/ethiopia_field.mp3',
      waterBed: '../audio/samples/river_gorge.mp3',
      night: '../audio/samples/crickets_night.mp3',
      footstep: '../audio/samples/gravel_footsteps.mp3',
      pump: '../audio/samples/metal_pump.mp3',
      pour: '../audio/samples/water_pour.mp3',
    };
    await Promise.all(
      Object.entries(manifest).map(async ([key, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const arr = await res.arrayBuffer();
          this.buffers[key] = await this.ctx.decodeAudioData(arr);
        } catch {
          // Graceful fallback if offline
        }
      })
    );
  }

  _startAmbientLoops() {
    if (!this.ctx) return;
    const startLoop = (key, gainVal, rate = 1.0) => {
      const buf = this.buffers[key];
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = gainVal;
      src.connect(g);
      g.connect(this.exteriorFilter);
      g.connect(this.convolver);
      src.start(0);
      this.loops[key] = { src, gain: g };
    };
    startLoop('field', 0.24, 0.96);
    startLoop('waterBed', 0.12, 0.92);
    startLoop('night', 0.14, 1.0);
  }

  update(dt, { isInside, nightMix, submerged, moving, projectorDist, projectorWet }) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.isInside = isInside;
    this.nightMix = nightMix;
    this.submerged = submerged;

    // Exterior vs Interior acoustic transition (muffle street outside, warm stone reverb inside)
    const targetCutoff = isInside ? 640 : submerged ? 1800 : 13500;
    const targetExtGain = isInside ? 0.24 : 0.62;
    const targetIntGain = isInside ? 0.34 : 0.04;
    this.exteriorFilter.frequency.setTargetAtTime(targetCutoff, now, 0.22);
    this.exteriorGain.gain.setTargetAtTime(targetExtGain, now, 0.22);
    this.interiorGain.gain.setTargetAtTime(targetIntGain, now, 0.22);

    if (this.loops.field) {
      this.loops.field.gain.gain.setTargetAtTime(submerged ? 0.08 : 0.24 * (1 - nightMix * 0.45), now, 0.3);
    }
    if (this.loops.waterBed) {
      this.loops.waterBed.gain.gain.setTargetAtTime(submerged ? 0.32 : 0.10, now, 0.3);
      this.loops.waterBed.src.playbackRate.setTargetAtTime(submerged ? 0.72 : 0.95, now, 0.3);
    }
    if (this.loops.night) {
      this.loops.night.gain.gain.setTargetAtTime(submerged ? 0.02 : 0.18 * nightMix, now, 0.3);
    }

    // Condition-based projector cooling pump audio
    if (projectorDist < 16) {
      const atten = Math.max(0, 1 - projectorDist / 16);
      this.pumpTimer -= dt;
      if (this.pumpTimer <= 0) {
        if (!projectorWet) {
          // Dry pump: irregular metallic rattle/click
          this.pumpTimer = 0.65 + Math.random() * 0.65;
          this._playOneShot('pump', 0.14 * atten, 1.35 + Math.random() * 0.2, 0.12);
        } else {
          // Wet cooled pump: calm rhythmic low pulse
          this.pumpTimer = 1.35;
          this._playOneShot('pump', 0.06 * atten, 0.62, 0.22);
        }
      }
    }

    // Stride-synced footsteps
    if (moving) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 0.46;
        const rate = isInside ? 0.88 + Math.random() * 0.08 : 1.0 + Math.random() * 0.12;
        this._playOneShot('footstep', isInside ? 0.15 : 0.18, rate, 0.18);
      }
    } else {
      this.footstepTimer = 0.08;
    }
  }

  _playOneShot(key, vol, rate = 1.0, maxDur = 0.4) {
    if (!this.enabled || !this.ctx || !this.buffers[key]) return;
    const buf = this.buffers[key];
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.isInside ? this.convolver : this.master);
    if (this.isInside) g.connect(this.master);
    const offset = Math.random() * Math.max(0, buf.duration - maxDur - 0.05);
    src.start(0, offset, Math.min(maxDur, buf.duration));
  }

  playShutter() {
    if (!this.enabled || !this.ctx) return;
    // Crisp mechanical leaf shutter click using short filtered noise burst
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
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now);
  }

  playPour() {
    this._playOneShot('pour', 0.36, 0.96, 0.85);
  }

  playTripodLock() {
    this._playOneShot('pump', 0.18, 1.6, 0.09);
  }

  speakDuet(speakerName, text, pitch = 1.0) {
    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.96;
      u.pitch = pitch;
      u.volume = 0.85;
      window.speechSynthesis.speak(u);
    } catch {
      // Ignore speech synthesis errors in headless browsers
    }
  }
}
