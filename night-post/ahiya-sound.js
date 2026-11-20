/* Ahiya field sound for DONKEY WATER, 2086 · Night Post (demo=ahiya).
   Real recordings from Freesound (credits in sound/credits.json), placed on the Ahiya circuit and fired by what
   happens in the game: a step, a hoof landing, the pump, the wagon's engine, a conversation.
   Everything runs through six buses that can be mixed, ducked, metered and inspected in the Listen panel. */
(function () {
  const BUSES = [
    { id: 'music', label: 'Music', db: -4, note: 'the Cyan Jerikan tape on the donkey' },
    { id: 'radio', label: 'Radio', db: -3, note: 'the wagon radio' },
    { id: 'ambience', label: 'Ambience', db: -2, note: 'night beds, wind, distant life' },
    { id: 'foley', label: 'Foley', db: 0, note: 'steps, hooves, pump, wagon' },
    { id: 'life', label: 'Voices & animals', db: -1, note: 'people, chant, dogs, brays' },
    { id: 'synth', label: 'Game tones', db: -14, note: 'the older synthesized cues' }
  ];
  const dbToGain = d => Math.pow(10, d / 20), gainToDb = g => 20 * Math.log10(Math.max(1e-5, g));
  const RADIO_KEYS = /^(music_|chant_|radio_|amb_diredawa)/;

  window.makeAhiyaSound = function (T, o) {
    const { ctx, camera, base = './sound/' } = o;
    const S = { ready: false, emitters: [], hits: [], buses: {}, duck: {}, mix: loadMix(), soloBus: null, soloEmitter: null, manifest: null, credits: [], stats: { hits: 0, steps: 0, hooves: 0, pumps: 0 } };
    const buffers = {};
    /* ---------- buses ---------- */
    const out = ctx.createDynamicsCompressor(); Object.assign(out, {}); out.threshold.value = -10; out.knee.value = 6; out.ratio.value = 8; out.attack.value = .004; out.release.value = .18;
    const masterA = ctx.createAnalyser(); masterA.fftSize = 2048; masterA.smoothingTimeConstant = .6;
    const master = ctx.createGain(); master.gain.value = .95; master.connect(out).connect(masterA).connect(ctx.destination);
    const verb = ctx.createConvolver(); verb.buffer = impulse(2.2, 2.6); const verbOut = ctx.createGain(); verbOut.gain.value = .6; verb.connect(verbOut).connect(master);
    for (const b of BUSES) {
      const input = ctx.createGain(), fader = ctx.createGain(), duck = ctx.createGain(), meter = ctx.createAnalyser(), send = ctx.createGain();
      meter.fftSize = 512; input.connect(duck).connect(fader).connect(meter).connect(master); fader.connect(send).connect(verb);
      send.gain.value = b.id === 'life' ? .35 : b.id === 'foley' ? .16 : b.id === 'ambience' ? .05 : 0;
      S.buses[b.id] = { ...b, input, fader, duck, meter, send, data: new Float32Array(512), level: -90 };
      S.duck[b.id] = 0;
    }
    applyMix();
    function impulse(sec, decay) {
      const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 1500 && i % 263 < 4 ? 2.5 : .7); } }
      return b;
    }
    function loadMix() { try { return JSON.parse(localStorage.getItem('ahiya-mix') || '{}'); } catch (e) { return {}; } }
    function saveMix() { try { localStorage.setItem('ahiya-mix', JSON.stringify(S.mix)); } catch (e) { } }
    function busDb(id) { return S.mix[id]?.db ?? BUSES.find(b => b.id === id).db; }
    function applyMix() {
      for (const b of BUSES) {
        const B = S.buses[b.id], m = S.mix[b.id] || {}, audible = !m.mute && (!S.soloBus || S.soloBus === b.id);
        B.fader.gain.setTargetAtTime(audible ? dbToGain(busDb(b.id)) : 0, ctx.currentTime, .05);
      }
    }
    /* ---------- loading ---------- */
    async function fetchOne(k) {
      if (buffers[k] || !S.manifest.files[k]) return buffers[k];
      try { buffers[k] = await ctx.decodeAudioData(await (await fetch(base + S.manifest.files[k].file)).arrayBuffer()); } catch (e) { console.warn('ahiya sound', k, e); }
      return buffers[k];
    }
    async function load() {
      S.manifest = await (await fetch(base + 'manifest.json')).json();
      S.credits = await (await fetch(base + 'credits.json')).json().catch(() => []);
      await Promise.all(Object.keys(S.manifest.files).filter(k => !RADIO_KEYS.test(k)).map(fetchOne));
      S.ready = true; build();
    }
    const creditOf = key => { const c = S.credits.find(c => c.use === key || c.use === 'steps_' + key || (key === 'hoof' && c.use === 'hooves_mud') || (key === 'hoof_hard' && c.use === 'hooves_clatter') || (key === 'pump' && c.use === 'pump_hand')); return c ? `${c.author} · ${c.license}` : ''; };
    /* ---------- emitters: looping sources placed in the world, each metered ---------- */
    function panner(pos, ref, roll, max = 600) {
      const p = ctx.createPanner(); Object.assign(p, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: ref, rolloffFactor: roll, maxDistance: max });
      p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; return p;
    }
    function emitter(id, label, key, bus, { pos = null, ref = 6, roll = 1, gain = 1, rate = 1, lowpass = null } = {}) {
      const b = buffers[key]; if (!b) return null;
      const src = ctx.createBufferSource(); src.buffer = b; src.loop = true; src.playbackRate.value = rate;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(g); let tail = g;
      let lp = null; if (lowpass || pos) { lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lowpass || 18000; lp.Q.value = .5; g.connect(lp); tail = lp; }
      const pn = pos ? panner(pos, ref, roll) : null; if (pn) { tail.connect(pn); tail = pn; }
      const meter = ctx.createAnalyser(); meter.fftSize = 256; tail.connect(meter); tail.connect(S.buses[bus].input);
      src.start(0, Math.random() * b.duration);
      const E = { id, label, key, bus, src, g, pn, lp, lpMax: lowpass || 18000, meter, data: new Float32Array(256), target: gain, base: gain, pos: pos ? pos.clone() : null, level: -90, credit: creditOf(key),
        set(v) { E.target = v; }, at(p) { if (!pn || !p) return; E.pos = (E.pos || new T.Vector3()).copy(p); pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; } };
      S.emitters.push(E); return E;
    }
    /* ---------- hits: single sounds from sprites, each one visible as a ripple ---------- */
    function hit(sprite, pos, { gain = 1, rate = 1, ref = 2, bus = 'foley', label = sprite } = {}) {
      const SP = S.manifest?.sprites[sprite]; if (!SP) return; const b = buffers[SP.file]; if (!b) return;
      const [t0, d] = SP.cuts[Math.floor(Math.random() * SP.cuts.length)];
      const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate * (.94 + Math.random() * .12);
      const g = ctx.createGain(); g.gain.value = gain * (.85 + Math.random() * .3); const pn = panner(pos, ref, 1.2, 160);
      src.connect(g).connect(pn).connect(S.buses[bus].input); src.start(0, t0, d / src.playbackRate.value + .02);
      S.stats.hits++; S.hits.push({ pos: pos.clone(), bus, label, t: ctx.currentTime, gain }); if (S.hits.length > 80) S.hits.shift();
    }
    function shot(key, pos, { gain = 1, rate = 1, ref = 8, bus = 'life', from = 0, dur, label = key } = {}) {
      const b = buffers[key]; if (!b) return null; const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
      const g = ctx.createGain(); g.gain.value = gain; src.connect(g); let tail = g; if (pos) { const pn = panner(pos, ref, 1, 900); g.connect(pn); tail = pn; }
      tail.connect(S.buses[bus].input); src.start(0, from, dur); S.stats.hits++;
      if (pos) { S.hits.push({ pos: pos.clone(), bus, label, t: ctx.currentTime, gain }); if (S.hits.length > 80) S.hits.shift(); }
      return src;
    }
    /* ---------- the circuit ---------- */
    let W = {};
    function build() {
      const A = o.anchors, V = (x, y, z) => new T.Vector3(x, y, z);
      W = {
        night: emitter('night', 'Night bed · Awassa, Ethiopia', 'amb_night', 'ambience', { gain: .36 }),
        crickets: emitter('crickets', 'Crickets and far voices', 'crickets_village', 'ambience', { gain: .24 }),
        wind: emitter('wind', 'Highland wind', 'wind_gusts', 'ambience', { gain: 0 }),
        mast: emitter('mast', 'Wind in the beacon mast', 'wind_antenna', 'ambience', { pos: A.beaconTop, ref: 6, roll: 1.1, gain: .6 }),
        chant: emitter('chant', 'Night chant · Cross-Beacon', 'amb_xmas_night', 'life', { pos: A.beacon, ref: 14, roll: 1.1, gain: 1 }),
        azmari: emitter('azmari', 'Azmari bet · Daylight Compound', 'music_outside_azmaribeit', 'life', { pos: A.compound, ref: 7, roll: 1.25, gain: 0, lowpass: 2600 }),
        yard: emitter('yard', 'Voices around the fire · Compound', 'amb_fire_voices', 'life', { pos: A.compoundYard, ref: 8, roll: 1.2, gain: 1.15 }),
        pumpWater: emitter('pumpWater', 'Water into the cans · Basalt Pump', 'fill_plastic', 'foley', { pos: A.pump, ref: 2.5, roll: 1.5, gain: 0 }),
        archive: emitter('archive', 'Archive radio static · Hill Archive', 'static', 'life', { pos: A.archive, ref: 3, roll: 1.6, gain: .12, rate: .8, lowpass: 1800 }),
        engine: emitter('engine', 'Wagon engine', 'bajaj_tailpipe', 'foley', { pos: V(0, 0, 0), ref: 3.5, roll: 1.1, gain: 0 }),
        engineRoad: emitter('engineRoad', 'Wagon on the road', 'bajaj_onboard', 'foley', { pos: V(0, 0, 0), ref: 2.5, roll: 1.3, gain: 0 }),
        tyres: emitter('tyres', 'Tyres on gravel', 'bajaj_gravel', 'foley', { pos: V(0, 0, 0), ref: 3, gain: 0 })
      };
      // the azmari bet only plays after the aunt has given leave at the white wall; until then the yard is quiet
      S.radio = makeRadio();
      S.next = { bray: 12 + Math.random() * 20, dog: 20 + Math.random() * 30 };
    }
    /* ---------- wagon radio: four stations of Ethiopian field recordings, each keeping time while you are away ---------- */
    const STATIONS = [
      { name: 'Azmari FM', tracks: ['music_azmari_fire', 'music_azmari_woman'] },
      { name: 'Azmari Bet live', tracks: ['music_azmaribeit', 'music_outside_azmaribeit'] },
      { name: 'Tewahedo', tracks: ['chant_addis', 'chant_lalibela'] },
      { name: 'Merkato', tracks: ['radio_loudspeaker', 'amb_diredawa'] }];
    function makeRadio() {
      const R = { i: 0, on: false, src: null, name: STATIONS[0].name, t0: ctx.currentTime };
      R.g = ctx.createGain(); R.g.gain.value = 0;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 280; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
      const sh = ctx.createWaveShaper(), cv = new Float32Array(256); for (let i = 0; i < 256; i++) cv[i] = Math.tanh((i / 128 - 1) * 1.6); sh.curve = cv;
      R.pn = panner(new T.Vector3(), 1.4, 1.5, 90); R.meter = ctx.createAnalyser(); R.meter.fftSize = 256; R.data = new Float32Array(256);
      R.g.connect(hp).connect(lp).connect(sh).connect(R.pn); R.pn.connect(R.meter); R.pn.connect(S.buses.radio.input);
      R.tune = async (i = R.i + 1) => {
        R.i = (i + STATIONS.length) % STATIONS.length; const ST = STATIONS[R.i]; R.name = ST.name; R.on = true;
        if (R.src) { try { R.src.stop(); } catch (e) { } R.src = null; }
        shot('static', null, { gain: .3, dur: .5, bus: 'radio' });
        await Promise.all(ST.tracks.map(fetchOne)); if (STATIONS[R.i] !== ST) return;
        const list = ST.tracks.filter(t => buffers[t]); if (!list.length) return;
        const total = list.reduce((s, t) => s + buffers[t].duration, 0); let tt = (ctx.currentTime - R.t0) % total, k = 0;
        while (tt > buffers[list[k]].duration) { tt -= buffers[list[k]].duration; k++; }
        const play = (k, off) => { const src = ctx.createBufferSource(); src.buffer = buffers[list[k]]; src.connect(R.g); src.start(ctx.currentTime + .45, off); src.onended = () => { if (R.src === src) play((k + 1) % list.length, 0); }; R.src = src; };
        play(k, tt);
      };
      return R;
    }
    /* ---------- events from the game ---------- */
    const lastStep = { d: 0, side: 1 };
    function footstep(p, speed, surface, running) {
      const right = new T.Vector3(Math.cos(p.yaw || 0), 0, -Math.sin(p.yaw || 0)); lastStep.side *= -1;
      const at = new T.Vector3(p.x, p.y, p.z).addScaledVector(right, .12 * lastStep.side);
      const spr = surface === 'stone' ? 'stone' : surface === 'grass' ? 'grass' : running ? 'dirt_run' : surface === 'gravel' ? 'gravel' : 'dirt';
      hit(spr, at, { gain: (running ? 1.05 : .75) * (surface === 'grass' ? .7 : 1), rate: p.load || 1, label: 'step · ' + surface });
      if (Math.random() < .2) hit('cloth', at.clone().setY(at.y + 1.1), { gain: .22, label: 'cloth' });
      S.stats.steps++;
    }
    function hoof(pos, gait, hard) { hit(hard ? 'hoof_hard' : 'hoof', pos, { gain: .55 + .25 * Math.min(2, gait), label: 'hoof' }); S.stats.hooves++; }
    function pumpStrokes(pos, n = 4) {
      for (let i = 0; i < n; i++) setTimeout(() => { hit('pump', pos, { gain: .95, label: 'pump stroke', ref: 3 }); S.stats.pumps++; }, i * 620);
      if (W.pumpWater) { W.pumpWater.set(.7); clearTimeout(S.pumpT); S.pumpT = setTimeout(() => W.pumpWater && W.pumpWater.set(0), n * 620 + 1400); }
    }
    /* ---------- per frame ---------- */
    const fwd = new T.Vector3(), up = new T.Vector3();
    function update(dt, g) {
      if (!S.ready) return;
      const L = ctx.listener, cp = camera.position; camera.getWorldDirection(fwd); up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      if (L.positionX) { L.positionX.value = cp.x; L.positionY.value = cp.y; L.positionZ.value = cp.z; L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z; L.upX.value = up.x; L.upY.value = up.y; L.upZ.value = up.z; }
      else { L.setPosition(cp.x, cp.y, cp.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
      // the wind follows real height on the Ahiya ground; it drops among the sets
      if (W.wind) W.wind.set(clamp01(.08 + .55 * g.heightRel + .15 * Math.min(1, g.speed / 8)) * (1 - .6 * g.shelter));
      if (W.night) W.night.set(.34 * (1 - .55 * g.shelter)); if (W.crickets) W.crickets.set(.24 * (1 - .5 * g.shelter));   // the place you are in leads the mix
      if (W.azmari) W.azmari.set(g.compoundOpen ? .9 : 0);
      // wagon: a big slow engine, pitched by speed and throttle; road noise and tyres take over as it moves
      const v = Math.abs(g.wagon.speed || 0), run = g.wagon.on;
      for (const k of ['engine', 'engineRoad', 'tyres']) W[k] && W[k].at(g.wagon.pos);
      if (W.engine) { W.engine.set(run ? .45 + .35 * g.wagon.throttle : 0); W.engine.src.playbackRate.value = .55 + Math.min(1, v / 22) * .55 + .12 * g.wagon.throttle; }
      if (W.engineRoad) { W.engineRoad.set(run ? Math.min(1, v / 8) * .55 : 0); W.engineRoad.src.playbackRate.value = .7 + Math.min(1, v / 25) * .45; }
      if (W.tyres) { W.tyres.set(Math.min(1, v / 10) * .5); W.tyres.src.playbackRate.value = .8 + Math.min(1, v / 20) * .5; }
      // radio rides in the wagon and plays only while its engine runs
      const R = S.radio; if (R) { R.pn.positionX.value = g.wagon.pos.x; R.pn.positionY.value = g.wagon.pos.y + 1.1; R.pn.positionZ.value = g.wagon.pos.z; R.g.gain.setTargetAtTime(run && R.on ? .6 : 0, ctx.currentTime, .15); }
      // ducking: a conversation pulls everything else back; driving pulls the night back
      const talk = g.talking ? 1 : 0, drive = run ? 1 : 0;
      const want = { music: -11 * talk - 4 * drive * (R && R.on ? 1 : 0), radio: -9 * talk, ambience: -5 * talk - 3 * drive, foley: -2 * talk, life: -4 * talk, synth: -6 * talk };
      for (const id in want) { S.duck[id] += (want[id] - S.duck[id]) * Math.min(1, dt * (want[id] < S.duck[id] ? 6 : 1.5)); S.buses[id].duck.gain.value = dbToGain(S.duck[id]); }
      // emitter gains, with solo
      for (const E of S.emitters) {
        const t = S.soloEmitter && S.soloEmitter !== E ? 0 : E.target; E.g.gain.value += (t - E.g.gain.value) * Math.min(1, dt * 2.5);
        if (E.lp && E.pos) { const d = E.pos.distanceTo(cp); E.dist = d; E.lp.frequency.value = Math.min(E.lpMax, 700 + 17000 * Math.exp(-d / 90)); }   // air takes the top off distant sounds
      }
      // occasional life, where it belongs, and when it belongs: brays from the donkey, dogs by the compound, a rooster before dawn
      S.next.bray -= dt; if (S.next.bray < 0) { S.next.bray = 40 + Math.random() * 60; const k = ['bray_atlas', 'bray_morning', 'bray_village'][Math.floor(Math.random() * 3)]; shot(k, g.donkeyHead, { gain: .85, ref: 6, from: S.manifest.sprites['bray:' + k]?.[0] || 0, dur: 6, label: 'bray' }); }
      S.next.dog -= dt; if (S.next.dog < 0) { S.next.dog = 45 + Math.random() * 70; shot('dog', o.anchors.dog, { gain: .6, ref: 10, from: Math.random() * 30, dur: 5, label: 'dog' }); }
      if (g.watch >= 15 && !S.roosterDone) { S.roosterDone = true; shot('rooster_morning', o.anchors.compoundYard, { gain: .7, ref: 12, dur: 14, label: 'rooster' }); }
      meter();
    }
    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function rms(an, buf) { an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return 10 * Math.log10(s / buf.length + 1e-10); }
    function meter() {
      for (const id in S.buses) { const B = S.buses[id]; B.level = rms(B.meter, B.data); }
      for (const E of S.emitters) E.level = rms(E.meter, E.data);
      if (S.radio) S.radio.level = rms(S.radio.meter, S.radio.data);
      S.reduction = out.reduction?.value ?? out.reduction ?? 0;
    }
    /* ---------- the Listen panel: see, inspect and mix the sound ---------- */
    let ui = null;
    function panel(open) {
      if (!ui) {
        const el = document.createElement('div'); el.id = 'listen'; el.hidden = true;
        el.innerHTML = `<style>
#listen{position:fixed;left:max(10px,env(safe-area-inset-left,0px));bottom:calc(150px + env(safe-area-inset-bottom,0px));width:min(380px,calc(100vw - 20px));max-height:min(70vh,640px);overflow:auto;z-index:70;
 background:rgba(6,16,22,.92);border:1px solid #38e8ff;border-radius:12px;padding:10px 12px;font:12px/1.35 system-ui,sans-serif;color:#dff4fa}
#listen[hidden]{display:none!important}
#listen h5{margin:6px 0 4px;font:600 10px system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#8fd0de;display:flex;justify-content:space-between}
#listen canvas{display:block;width:100%;height:78px;border-radius:6px;background:#020a0e}
#listen .bus{display:grid;grid-template-columns:86px 1fr 46px 22px 22px;gap:6px;align-items:center;margin:4px 0}
#listen .bus input{width:100%;accent-color:#38e8ff}
#listen .mtr{height:6px;background:#12232c;border-radius:3px;overflow:hidden;grid-column:2/3;margin-top:-2px}
#listen .mtr i{display:block;height:100%;background:#38e8ff;width:0}
#listen button{font:11px system-ui,sans-serif;background:#0b2a38;color:#dff4fa;border:1px solid #2a6a7a;border-radius:6px;padding:2px 0;cursor:pointer}
#listen button[aria-pressed="true"]{background:#38e8ff;color:#06222c;border-color:#38e8ff}
#listen .src{display:grid;grid-template-columns:1fr 54px;gap:2px 8px;padding:4px 0;border-top:1px solid #16323c;cursor:pointer}
#listen .src small{grid-column:1/3;color:#86a9b3}
#listen .src[aria-pressed="true"]{background:#0e3442}
#listen .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
#listen .row button{padding:4px 8px}</style>
<h5><span>Listening</span><span id="ls-lim"></span></h5><canvas id="ls-spec" width="356" height="78"></canvas>
<h5><span>Mix</span><span>dB · M · S</span></h5><div id="ls-buses"></div>
<h5><span>Nearest sources</span><span>tap to solo</span></h5><div id="ls-srcs"></div>
<div class="row"><button id="ls-rings" aria-pressed="true">Show sound in the world</button><button id="ls-reset">Reset mix</button><button id="ls-close">Close</button></div>`;
        document.body.append(el); const q = s => el.querySelector(s);
        const wrap = q('#ls-buses');
        for (const b of BUSES) {
          const r = document.createElement('div'); r.className = 'bus';
          r.innerHTML = `<span title="${b.note}">${b.label}</span><input type="range" min="-30" max="6" step="1" aria-label="${b.label} level"><span class="db"></span><button data-m>M</button><button data-s>S</button><div class="mtr"><i></i></div>`;
          const inp = r.querySelector('input'); inp.value = busDb(b.id); r.querySelector('.db').textContent = busDb(b.id) + ' dB';
          inp.oninput = () => { S.mix[b.id] = { ...(S.mix[b.id] || {}), db: +inp.value }; r.querySelector('.db').textContent = inp.value + ' dB'; applyMix(); saveMix(); };
          r.querySelector('[data-m]').onclick = e => { const m = S.mix[b.id] = { ...(S.mix[b.id] || {}), mute: !(S.mix[b.id]?.mute) }; e.target.setAttribute('aria-pressed', m.mute); applyMix(); saveMix(); };
          r.querySelector('[data-s]').onclick = e => { S.soloBus = S.soloBus === b.id ? null : b.id; wrap.querySelectorAll('[data-s]').forEach(x => x.setAttribute('aria-pressed', 'false')); e.target.setAttribute('aria-pressed', !!S.soloBus); applyMix(); };
          r.querySelector('[data-m]').setAttribute('aria-pressed', !!S.mix[b.id]?.mute);
          wrap.append(r); S.buses[b.id].row = r;
        }
        q('#ls-rings').onclick = e => { S.showRings = !S.showRings; e.target.setAttribute('aria-pressed', S.showRings); };
        q('#ls-reset').onclick = () => { S.mix = {}; saveMix(); S.soloBus = null; S.soloEmitter = null; for (const b of BUSES) { const r = S.buses[b.id].row; r.querySelector('input').value = b.db; r.querySelector('.db').textContent = b.db + ' dB'; r.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false')); } applyMix(); };
        q('#ls-close').onclick = () => panel(false);
        ui = { el, spec: q('#ls-spec'), srcs: q('#ls-srcs'), lim: q('#ls-lim'), freq: new Uint8Array(masterA.frequencyBinCount), t: 0 };
        S.showRings = true;
      }
      ui.el.hidden = !open; S.panelOpen = !!open;
    }
    function drawPanel(dt) {
      if (!ui || ui.el.hidden) return;
      // scrolling spectrogram of what you hear, low frequencies at the bottom, on a log scale
      const c = ui.spec, x = c.getContext('2d'), w = c.width, h = c.height; masterA.getByteFrequencyData(ui.freq);
      x.drawImage(c, -2, 0); const nyq = ctx.sampleRate / 2;
      for (let y = 0; y < h; y++) {
        const f = 40 * Math.pow(nyq / 40 / 2, 1 - y / h), bin = Math.min(ui.freq.length - 1, Math.round(f / nyq * ui.freq.length)), v = ui.freq[bin] / 255;
        x.fillStyle = `rgb(${Math.round(20 + 200 * v * v)},${Math.round(40 + 200 * v)},${Math.round(60 + 195 * v)})`; x.fillRect(w - 2, y, 2, 1);
      }
      ui.lim.textContent = `limiter ${(S.reduction || 0).toFixed(1)} dB`;
      ui.t -= dt; if (ui.t > 0) return; ui.t = .12;
      for (const id in S.buses) { const B = S.buses[id]; B.row.querySelector('.mtr i').style.width = Math.max(0, Math.min(100, (B.level + 60) * 1.8)) + '%'; }
      const cp = camera.position;
      const list = S.emitters.filter(E => E.target > 0.01 || E === S.soloEmitter).map(E => ({ E, d: E.pos ? E.pos.distanceTo(cp) : 0 })).sort((a, b) => b.E.level - a.E.level).slice(0, 7);
      ui.srcs.innerHTML = '';
      for (const { E, d } of list) {
        const r = document.createElement('div'); r.className = 'src'; r.setAttribute('aria-pressed', S.soloEmitter === E);
        r.innerHTML = `<span>${E.label}</span><span>${E.level > -80 ? E.level.toFixed(0) + ' dB' : '—'}</span><small>${E.pos ? Math.round(d) + ' m · ' : ''}${S.buses[E.bus].label}${E.credit ? ' · ' + E.credit : ''}</small>`;
        r.onclick = () => { S.soloEmitter = S.soloEmitter === E ? null : E; }; ui.srcs.append(r);
      }
    }
    return Object.assign(S, { load, update, footstep, hoof, pumpStrokes, shot, hit, panel, drawPanel, STATIONS, BUSES, busInput: id => S.buses[id].input, dbToGain, gainToDb });
  };
})();
