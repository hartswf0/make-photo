// Sound, all synthesised and on from the first touch: the rails, the swarm as a chord of wings that tightens when it is angry,
// footsteps, doors, every pick-up and throw, and a slow pentatonic line under the game.
export function createAudio() {
  let ctx = null, on = false, master, noiseBuf, rumbleGain, lp, clackT = 0, wings = [], wingGain, wingFilt, trem, stepT = 0, seqT = 0, seqI = 0, musicOn = false;
  const N = n => 440 * Math.pow(2, (n - 69) / 12);
  const env = (g, t, a, d, v) => { g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0008, t + a + d); };
  const tone = (type, f, t, d, v, slide = 0, dest = master) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d); env(g, t, .004, d, v); o.connect(g).connect(dest); o.start(t); o.stop(t + d + .06); };
  const noise = (t, d, v, type = 'bandpass', f = 1200, q = 1) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q; env(g, t, .003, d, v); s.connect(fl).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + d + .06); };
  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0; const comp = ctx.createDynamicsCompressor(); master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const r = ctx.createBufferSource(); r.buffer = noiseBuf; r.loop = true; lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0; r.connect(lp).connect(rumbleGain).connect(master); r.start();
    // the swarm: five wing voices a few hertz apart beat against each other; a tremolo makes them pulse the way a cluster does
    wingGain = ctx.createGain(); wingGain.gain.value = 0; wingFilt = ctx.createBiquadFilter(); wingFilt.type = 'bandpass'; wingFilt.frequency.value = 520; wingFilt.Q.value = 1.4; trem = ctx.createGain(); trem.gain.value = .8;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 7; lg.gain.value = .22; lfo.connect(lg).connect(trem.gain); lfo.start();
    for (const det of [-9, -4, 0, 5, 11]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 215 + det; o.connect(wingFilt); o.start(); wings.push({ o, det }); } wingFilt.connect(trem).connect(wingGain).connect(master);
  }
  const A = {
    get on() { return on; },
    start() { if (on) return; if (!ctx) init(); ctx.resume(); on = true; master.gain.linearRampToValueAtTime(.8, ctx.currentTime + .5); },
    toggle() { if (!ctx) init(); on = !on; ctx.resume(); master.gain.linearRampToValueAtTime(on ? .8 : 0, ctx.currentTime + .3); return on; },
    music(v) { musicOn = v; },
    update(speed, inside, tunnel) { if (!ctx || !on) return; const t = ctx.currentTime, v = Math.min(1, speed / 26);
      rumbleGain.gain.setTargetAtTime(v * (.14 + tunnel * .16) * (inside < 1 ? 1.5 : 1), t, .2); lp.frequency.setTargetAtTime(120 + v * 220 + tunnel * 260 + (inside < 1 ? 500 : 0), t, .3);
      if (speed > 1.5 && t > clackT) { const gap = 12.5 / speed; for (const o of [0, 2.4 / speed]) noise(t + .02 + o, .07, .16 * v + .05, 'bandpass', 900, 1.2); clackT = t + gap; }
      if (musicOn && t > seqT) { const spb = 60 / 92 / 2, bar = [45, 45, 48, 43][Math.floor(seqI / 8) % 4], line = [0, 3, 5, 7, 10, 7, 5, 3][seqI % 8]; if (seqI % 2 === 0) tone('triangle', N(bar), t, spb * 1.8, .16); if ([0, 3, 4, 6].includes(seqI % 8)) tone('sine', N(bar + 24 + line), t, spb * 2.4, .07); if (seqI % 8 === 4) noise(t, .05, .05, 'highpass', 5000); seqT = t + spb; seqI++; } },
    /** level 0..1: how much swarm is near the lens. anger 0..1 tightens and raises it. */
    swarm(level, anger) { if (!ctx || !on) return; const t = ctx.currentTime, base = 205 + anger * 70; for (const w of wings) w.o.frequency.setTargetAtTime(base + w.det * (1 + anger), t, .15); wingFilt.frequency.setTargetAtTime(480 + anger * 900 + level * 300, t, .2); wingGain.gain.setTargetAtTime(Math.min(.2, level * .2 + anger * .05 * level), t, .25); },
    steps(speed, dt, metal) { if (!ctx || !on || speed < .3) return; stepT -= dt * speed; if (stepT <= 0) { stepT = .62; const t = ctx.currentTime; metal ? tone('square', 900 + Math.random() * 200, t, .04, .06, 300) : noise(t, .05, .09, 'lowpass', 500); } },
    fx(n) { if (!ctx || !on) return; const t = ctx.currentTime;
      if (n === 'sting') { tone('sawtooth', 1400, t, .12, .22, 300); noise(t, .08, .2, 'highpass', 3000); }
      else if (n === 'pick') { tone('square', 660, t, .07, .14); tone('square', 990, t + .07, .1, .14); noise(t, .04, .1, 'bandpass', 2500, 4); }
      else if (n === 'rob') { for (let k = 0; k < 4; k++) noise(t + k * .05, .03, .14, 'bandpass', 1800 + k * 300, 5); tone('square', 520, t + .2, .08, .14); tone('square', 780, t + .28, .12, .14); }
      else if (n === 'throw') noise(t, .22, .22, 'bandpass', 700, .8);
      else if (n === 'clank') { tone('square', 1250, t, .06, .18, 500); tone('triangle', 380, t, .25, .2, 180); noise(t, .1, .2, 'bandpass', 2600, 6); }
      else if (n === 'bonk') { tone('sine', 220, t, .2, .4, 90); noise(t, .06, .2, 'lowpass', 900); }
      else if (n === 'door') { noise(t, .5, .14, 'bandpass', 420, .7); tone('sine', 90, t + .42, .12, .25, 60); }
      else if (n === 'win') [0, 4, 7, 12, 16].forEach((iv, k) => tone('triangle', N(57 + iv), t + k * .11, .5, .18));
      else if (n === 'out') tone('sawtooth', 300, t, .9, .25, 60);
      else if (n === 'smoke') noise(t, .5, .16, 'lowpass', 1400); } };
  return A;
}
