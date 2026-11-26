/* MESA CHIP's own score, played in the browser: nothing is streamed. Ninety-two beats a minute in the tizita minor on D
   (D E F A B-flat), the scale of the Ethiopian western this world borrows from. It is built in layers, and the game brings them in:

     always        a drone on D and A, and a plucked krar figure that changes every four bars
     heat > .15    a bass on the one and the three
     heat > .4     a kick, a rim shot and a shaker
     combo >= 4    a whistled line over the top, higher the longer the combo
     down          everything goes under water for as long as he is on the ground
     in the pit    slower pluck, more echo, the bass an octave down (the cathedral)

   MesaScore.start(); MesaScore.set({ heat: 0..1, combo, down, pit }); MesaScore.mute(bool). */
(() => {
  "use strict";
  let ctx = null, out, lp, echo, muted = false, timer = null, step = 0, nextT = 0; const ST = { heat: 0, combo: 0, down: false, pit: false }, BPM = 92, S16 = 60 / BPM / 4;
  const hz = n => 440 * Math.pow(2, (n - 69) / 12), SC = [62, 64, 65, 69, 70, 74, 76, 77, 81, 82];   /* D4 E4 F4 A4 Bb4 and the octave above */
  const FIG = [[0, -1, 3, -1, 2, 3, -1, 4, 5, -1, 3, -1, 2, -1, 0, -1], [3, -1, 5, 3, -1, 2, 0, -1, 3, -1, 2, 3, 4, -1, 3, -1], [0, 2, 3, -1, 5, -1, 3, 2, 0, -1, -1, 3, 2, -1, 0, -1], [5, -1, 6, 5, 3, -1, 2, -1, 3, 5, -1, 3, 2, 0, -1, -1]];
  const LEAD = [[8, 0, 6], [7, 6, 2], [5, 8, 6], [7, 16, 4], [8, 20, 2], [5, 22, 8]];   /* [scale degree, step in two bars, length] */
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function pluck(t, f, v, wet) { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = "sawtooth"; o2.type = "triangle"; o.frequency.value = f; o2.frequency.value = f * 2.003; fl.type = "lowpass"; fl.frequency.setValueAtTime(f * 7, t); fl.frequency.exponentialRampToValueAtTime(f * 1.4, t + .28); fl.Q.value = 3; env(g, t, .004, v, .55); o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(lp); if (wet) g.connect(echo); o.start(t); o2.start(t); o.stop(t + .7); o2.stop(t + .7); }
  function tone(t, f, v, len, type, vib) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.4; lg.gain.value = f * .012; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + len + .2); } g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + Math.min(.08, len * .3)); g.gain.setValueAtTime(v, t + len * .7); g.gain.exponentialRampToValueAtTime(0.0001, t + len + .12); o.connect(g); g.connect(lp); if (vib) g.connect(echo); o.start(t); o.stop(t + len + .2); }
  function hit(t, kind, v) { if (kind === "kick") { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + .16); env(g, t, .003, v, .22); o.connect(g).connect(lp); o.start(t); o.stop(t + .3); return; }
    const n = Math.floor(ctx.sampleRate * .12), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b; fl.type = kind === "rim" ? "bandpass" : "highpass"; fl.frequency.value = kind === "rim" ? 1800 : 6500; fl.Q.value = kind === "rim" ? 4 : 1; env(g, t, .002, v, kind === "rim" ? .09 : .04); s.connect(fl).connect(g).connect(lp); if (kind === "rim") g.connect(echo); s.start(t); }
  function tick() { if (!ctx) return; const pit = ST.pit, heat = ST.heat; lp.frequency.setTargetAtTime(ST.down ? 320 : 9000, ctx.currentTime, .25);
    while (nextT < ctx.currentTime + .18) { const s = step % 16, bar = Math.floor(step / 16), t = nextT, fig = FIG[Math.floor(bar / 4) % FIG.length], sw = s % 2 ? S16 * .12 : 0;
      if (s === 0 && bar % 2 === 0) { tone(t, hz(pit ? 26 : 38), .11, S16 * 31, "sine"); tone(t, hz(45), .05, S16 * 31, "sine"); }   /* the drone */
      const n = fig[s]; if (n >= 0 && (!pit || s % 4 === 0)) pluck(t + sw, hz(SC[n] - (pit ? 12 : 0)), .1 + heat * .05, true);
      if (heat > .15 && (s === 0 || s === 8 || (heat > .6 && s === 11))) pluck(t, hz(s === 8 ? 33 : 38) / (pit ? 2 : 1) * 1, .2, false);
      if (heat > .4) { if (s === 0 || s === 6 || s === 10) hit(t, "kick", .5); if (s === 4 || s === 12) hit(t, "rim", .22); if (s % 2 === 0 || heat > .75) hit(t + sw, "shake", .05 + heat * .04); }
      if (ST.combo >= 4) { const two = step % 32; for (const [deg, at, len] of LEAD) if (at === two) tone(t, hz(SC[deg] + (ST.combo >= 8 ? 12 : 0)), .06, S16 * len, "sine", true); }
      step++; nextT += S16; } }
  const api = { start() { if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; } ctx = new (window.AudioContext || window.webkitAudioContext)(); out = ctx.createGain(); out.gain.value = muted ? 0 : .7; lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 9000;
      echo = ctx.createDelay(1); echo.delayTime.value = S16 * 3; const fb = ctx.createGain(), eg = ctx.createGain(); fb.gain.value = .34; eg.gain.value = .3; echo.connect(fb).connect(echo); echo.connect(eg).connect(lp); lp.connect(out).connect(ctx.destination); nextT = ctx.currentTime + .1; timer = setInterval(tick, 50); },
    set(o) { Object.assign(ST, o); }, mute(m) { muted = !!m; if (out) out.gain.setTargetAtTime(muted ? 0 : .7, ctx.currentTime, .15); }, get on() { return !!ctx && !muted; }, state: ST };
  window.MesaScore = api;
})();
