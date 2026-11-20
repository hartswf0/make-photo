// Field sound for the Motion Lab: every sound is a real recording (see assets/sound/credits.json) placed in the world,
// and the moving ones are fired by the same events that move the bodies: a heel landing, a hoof planting, the
// pump lever reaching the bottom, the engine's speed and the throttle.
import * as THREE from 'three';
const BASE = 'assets/sound/';
export function makeAudio({ camera, G }) {
  let ctx = null, master, comp, verb, verbIn, dry, buffers = {}, sprites = {}, started = false, loading = null;
  const loops = [], emit = {}, RADIO_KEYS = /^(music_|chant_|radio_|amb_diredawa)/;
  async function fetchOne(k) { if (buffers[k] || !A.manifest.files[k]) return; try { const ab = await (await fetch(BASE + A.manifest.files[k].file)).arrayBuffer(); buffers[k] = await ctx.decodeAudioData(ab); } catch (e) { console.warn('sound', k, e); } }
  const A = { on: false, events: 0, log: [] };
  async function loadAll() {
    const man = await (await fetch(BASE + 'manifest.json')).json(); A.manifest = man;
    sprites = man.sprites;
    // the world's sounds load now; the radio's music (about 7 MB) only when the radio is first switched on
    await Promise.all(Object.keys(man.files).filter(k => !RADIO_KEYS.test(k)).map(fetchOne));
  }
  function impulse(sec, decay) {                       // a short outdoor-courtyard impulse response: early reflections, then a soft tail
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 900 && i % 211 < 3 ? 3 : 1); } }
    return b;
  }
  async function start() {
    if (started) return loading; started = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ctx.createGain(); master.gain.value = .9;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.knee.value = 8;
    master.connect(comp).connect(ctx.destination);
    dry = ctx.createGain(); dry.connect(master);
    verb = ctx.createConvolver(); verb.buffer = impulse(1.4, 3.2); verbIn = ctx.createGain(); verbIn.gain.value = .0; verbIn.connect(verb).connect(master);
    loading = loadAll().then(() => { A.on = true; buildWorld(); });
    return loading;
  }
  function panner(pos, ref = 4, roll = 1, max = 400) {
    const p = ctx.createPanner(); Object.assign(p, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: ref, rolloffFactor: roll, maxDistance: max });
    p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; return p;
  }
  function out(node, wet = 1) { node.connect(dry); const s = ctx.createGain(); s.gain.value = wet; node.connect(s).connect(verbIn); return node; }
  // a looping bed or emitter; gain is set every frame by the world
  function loop(key, { pos = null, ref = 6, roll = 1, gain = 0, rate = 1, offset = null, filter = null } = {}) {
    const b = buffers[key]; if (!b) return null;
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain; let tail = g;
    if (filter) { const f = ctx.createBiquadFilter(); Object.assign(f, { type: filter.type }); f.frequency.value = filter.f; f.Q.value = filter.q || .7; g.connect(f); tail = f; }
    src.connect(g);
    const pn = pos ? panner(pos, ref, roll) : null; if (pn) tail.connect(pn), tail = pn;
    out(tail);
    src.start(0, offset ?? Math.random() * b.duration);
    const L = { key, src, g, pn, target: gain, set(v, k = 2) { L.target = v; }, at(p) { if (pn) { pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; } } };
    loops.push(L); return L;
  }
  // one grain from a sprite sheet of sliced one-shots (footsteps, hooves, pump strokes)
  function hit(sprite, pos, { gain = 1, rate = 1, ref = 2, wet = .15, pick = null } = {}) {
    const S = sprites[sprite]; if (!S || !ctx) return; const b = buffers[S.file]; if (!b) return;
    const [t0, d] = pick !== null ? S.cuts[pick % S.cuts.length] : S.cuts[Math.floor(Math.random() * S.cuts.length)];
    const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate * (.94 + Math.random() * .12);
    const g = ctx.createGain(); g.gain.value = gain * (.85 + Math.random() * .3);
    const pn = panner(pos, ref, 1.2, 120); src.connect(g).connect(pn); out(pn, wet);
    src.start(0, t0, d / src.playbackRate.value + .02); A.events++; if (A.log.length < 400) A.log.push([+ctx.currentTime.toFixed(2), sprite]);
  }
  function oneShot(key, pos, { gain = 1, rate = 1, ref = 8, wet = .2, from = 0, dur = null } = {}) {
    const b = buffers[key]; if (!b || !ctx) return null;
    const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate; const g = ctx.createGain(); g.gain.value = gain;
    let tail = g; if (pos) { const pn = panner(pos, ref, 1, 900); g.connect(pn); tail = pn; } src.connect(g); out(tail, wet);
    src.start(0, from, dur ?? undefined); A.events++; if (A.log.length < 400) A.log.push([+ctx.currentTime.toFixed(2), key]); return src;
  }
  /* ---------------- the place ---------------- */
  let W = null;
  function buildWorld() {
    const st = A.world, v = (x, y, z) => new THREE.Vector3(x, y, z);
    W = {
      wind: loop('wind_gusts', { gain: 0 }),                                            // open-hill wind, louder with height and speed
      windLow: loop('wind_plain', { gain: 0 }),
      mastWind: loop('wind_antenna', { pos: st.mast, ref: 5, roll: 1.2 }),              // wind singing in the mast stays at the mast
      company: loop('amb_fire_voices', { pos: st.wellhead, ref: 5, roll: 1.4 }),        // people at the wellhead, low voices
      birds: loop('bird_baro', { pos: v(st.wellhead.x - 30, st.wellhead.y + 8, st.wellhead.z + 25), ref: 10 }),
      town: loop('amb_market', { pos: st.town, ref: 60, roll: .8 }),                   // Addis, far down the road
      sheep: loop('sheep_bells', { pos: st.pasture, ref: 14, roll: 1 }),
      dog: null, engine: loop('bajaj_tailpipe', { pos: v(0, 0, 0), ref: 3, roll: 1.1, gain: 0 }),
      engineIn: loop('bajaj_onboard', { pos: v(0, 0, 0), ref: 2, roll: 1.4, gain: 0 }),
      tyres: loop('bajaj_gravel', { pos: v(0, 0, 0), ref: 3, gain: 0 }),
      pour: loop('fill_plastic', { pos: st.bowl, ref: 2, roll: 1.6, gain: 0 }),
      munch: loop('munch', { pos: v(0, 0, 0), ref: 2, roll: 1.5, gain: 0 }),
      radio: null
    };
    A.radio = makeRadio();
    A.nextBray = 8 + Math.random() * 20; A.nextDog = 15 + Math.random() * 30; A.nextGelada = 25 + Math.random() * 40; A.nextBell = 60;
  }
  /* ---------------- the bajaj radio: real recordings, through a small speaker, each station keeps time while you are away ---------------- */
  const STATIONS = [
    { name: 'Azmari FM', tracks: ['music_azmari_fire', 'music_azmari_woman'] },
    { name: 'Azmari Bet live', tracks: ['music_azmaribeit', 'music_outside_azmaribeit'] },
    { name: 'Tewahedo', tracks: ['chant_addis', 'chant_lalibela'] },
    { name: 'Merkato ads', tracks: ['radio_loudspeaker', 'amb_diredawa'] }
  ];
  function makeRadio() {
    const R = { i: 0, on: false, node: null, src: null, g: ctx.createGain(), pn: panner(new THREE.Vector3(), 1.5, 1.6, 80), started: ctx.currentTime, name: STATIONS[0].name };
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
    const sh = ctx.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 1.8); } sh.curve = c;
    R.g.gain.value = 0; R.g.connect(hp).connect(lp).connect(sh).connect(R.pn); out(R.pn, .05);
    R.tune = async (i = R.i + 1) => {
      R.i = (i + STATIONS.length) % STATIONS.length; const S = STATIONS[R.i]; R.name = S.name;
      if (R.src) { try { R.src.stop(); } catch (e) { } R.src = null; }
      oneShot('static', null, { gain: .35, dur: .55 });
      // the station has been playing all along: its position is wall-clock time since the lab opened
      await Promise.all(S.tracks.map(fetchOne)); if (STATIONS[R.i] !== S) return;
      const list = S.tracks.filter(t => buffers[t]); if (!list.length) return;
      const total = list.reduce((s, t) => s + buffers[t].duration, 0); let tt = (ctx.currentTime - R.started) % total, k = 0;
      while (tt > buffers[list[k]].duration) { tt -= buffers[list[k]].duration; k++; }
      const play = (k, off) => { const src = ctx.createBufferSource(); src.buffer = buffers[list[k]]; src.connect(R.g); src.start(ctx.currentTime + .5, off); src.onended = () => { if (R.src === src) play((k + 1) % list.length, 0); }; R.src = src; };
      play(k, tt);
    };
    return R;
  }
  /* ---------------- per frame ---------------- */
  const fwd = new THREE.Vector3(), up = new THREE.Vector3();
  function update(dt, s) {
    if (!A.on || !W) return;
    const l = ctx.listener, cp = camera.position; camera.getWorldDirection(fwd); up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    if (l.positionX) { l.positionX.value = cp.x; l.positionY.value = cp.y; l.positionZ.value = cp.z; l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z; l.upX.value = up.x; l.upY.value = up.y; l.upZ.value = up.z; }
    else { l.setPosition(cp.x, cp.y, cp.z); l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
    // wind: open ground and height above the valley; the walls of the wellhead cut it
    const exposure = 1 - Math.min(1, s.shelter), rel = Math.max(0, s.height - s.lowest) / Math.max(1, s.highest - s.lowest);
    W.wind && W.wind.set((.05 + .22 * rel + .12 * Math.min(1, s.camSpeed / 10)) * exposure);
    W.windLow && W.windLow.set(.06 * exposure);
    W.mastWind && W.mastWind.set(.55); W.company && W.company.set(.8); W.birds && W.birds.set(.35); W.town && W.town.set(.9); W.sheep && W.sheep.set(.5);
    // the engine: idle loop pitched by engine speed, on-board loop takes over with road speed, tyres on gravel with speed
    const bj = s.bajaj; for (const L of [W.engine, W.engineIn, W.tyres, W.munch]) if (L) L.at(L === W.munch ? s.donkeyHead : bj.pos);
    const rpm = bj.running ? bj.rpm : 0;
    if (W.engine) { W.engine.set(bj.running ? .35 + .4 * bj.load : 0); W.engine.src.playbackRate.value = .78 + rpm * .75; }
    if (W.engineIn) { W.engineIn.set(bj.running ? Math.min(1, bj.speed / 6) * .6 : 0); W.engineIn.src.playbackRate.value = .85 + rpm * .35; }
    if (W.tyres) { W.tyres.set(Math.min(1, bj.speed / 9) * .55); W.tyres.src.playbackRate.value = .8 + Math.min(1, bj.speed / 14) * .5; }
    if (W.pour) W.pour.set(s.pumping ? .45 : 0); if (W.munch) W.munch.set(s.donkeyEating ? .5 : 0);
    verbIn.gain.value += ((s.shelter * .35 + .03) - verbIn.gain.value) * Math.min(1, dt * 3);
    for (const L of loops) L.g.gain.value += (L.target - L.g.gain.value) * Math.min(1, dt * 2.5);
    // radio follows the bajaj; only on while its engine runs
    const R = A.radio; if (R) { R.pn.positionX.value = bj.pos.x; R.pn.positionY.value = bj.pos.y + .9; R.pn.positionZ.value = bj.pos.z; const want = bj.running && R.on ? .55 : 0; R.g.gain.value += (want - R.g.gain.value) * Math.min(1, dt * 3); }
    // occasional life, placed where it belongs
    A.nextBray -= dt; if (A.nextBray < 0) { A.nextBray = 35 + Math.random() * 55; const k = ['bray_atlas', 'bray_morning', 'bray_village'][Math.floor(Math.random() * 3)]; if (buffers[k]) oneShot(k, s.donkeyHead, { gain: .9, ref: 6, from: (sprites['bray:' + k] || [0])[0], dur: 6 }); }
    A.nextDog -= dt; if (A.nextDog < 0) { A.nextDog = 40 + Math.random() * 60; oneShot('dog', A.world.house, { gain: .7, ref: 10, from: Math.random() * 30, dur: 6 }); }
    A.nextGelada -= dt; if (A.nextGelada < 0) { A.nextGelada = 70 + Math.random() * 80; oneShot('gelada_a', A.world.cliff, { gain: .8, ref: 30, roll: .8 }); }
  }
  Object.defineProperty(A, 'ctx', { get: () => ctx });
  return Object.assign(A, { start, update, hit, oneShot, STATIONS });
}
