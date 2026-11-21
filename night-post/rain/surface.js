// The rain surface: the Donkey Water rain system (night-post/rain/engine.js) driven by the live game.
// It reads window.AhiyaBridge.state() and calls AhiyaBridge.act.*; it owns no game state of its own.
//   edge current (right) -> a menu written in water down both sides
//   pull a current to adjust; the wet trace keeps the previous and the changed reading; Undo current / U
//   pull a voice to draw its words along your path; rub to thin them; Voices keeps the sentence
//   pull the lowest current left to look back up to twelve seconds; right / Home returns to now
(() => {
'use strict';
function boot() {
  const B = window.AhiyaBridge, M = window.RainModules;
  if (!B || !M || !document.body) { setTimeout(boot, 150); return; }
  try { start(B, M); } catch (err) { console.error('[rain] surface failed', err); document.body.classList.remove('rain2'); }
}
function start(B, M) {
const { createFluidGlass } = M['./fluid-glass.js'], { createRainField } = M['./rain-field.js'], { createWeatherMemory } = M['./weather-memory.js'], { createTraceInk } = M['./trace-ink.js'];
const world = document.createElement('main'); world.id = 'rw'; world.setAttribute('aria-label', 'Donkey Water rain surface');
world.innerHTML = `<canvas id="fluid" aria-hidden="true"></canvas><div id="drops" aria-label="Information in the rain"></div>
<button id="menu-toggle" class="liquid menu-drop amber" data-viscosity="2.8" aria-expanded="false" aria-controls="menu-stream"><span class="drop-label">Menu</span><span class="drop-note">catch the edge</span></button>
<nav id="menu-stream" aria-label="Places in the water" hidden></nav>
<button id="steer" class="liquid steer-drop" data-viscosity=".55" aria-label="Steer. Drag to move, release to stop."><span class="drop-label">Steer</span><span class="drop-note">pull · release</span></button>
<form id="say-form" class="liquid speech-input" hidden><label for="say-text">Your words</label><textarea id="say-text" rows="2" maxlength="180" placeholder="Say something…"></textarea><button type="submit" class="liquid tiny"><span class="drop-label">Say</span></button></form>
<p id="announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>`;
document.body.append(world);
const $ = id => world.querySelector('#' + id);
const n = v => String(Number((+v || 0).toFixed(2))), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const announce = text => { $('announcement').textContent = text; };
const ui = { menu: false, scene: 'world', past: false, timeAge: 0, words: false, page: 0, details: false, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, memory: false, rest: false, say: false, recallIndex: 0, recordClock: 0, open: null, openAt: 0, titleUntil: 0, voiceId: null, voiceUntil: 0, flowHeld: false };
if (/rainDebug/.test(location.search)) { let m = ui.menu; Object.defineProperty(ui, 'menu', { get: () => m, set: v => { if (v !== m) (window.__rainDbg = window.__rainDbg || []).push(v + ' @' + Math.round(performance.now()) + ' touch=' + Math.round(ui.menuTouch || 0) + ' ' + (new Error().stack || '').split('\n').slice(2, 5).map(l => l.trim().slice(0, 70)).join(' < ')); m = v; } }); }
const weather = { material: 'worms', erosion: .32, rain: .55 };
const memory = createWeatherMemory({ windowSeconds: 12, maxEvents: 160, maxUtterances: 20, erosion: weather.erosion });
const ink = createTraceInk({ host: world });
const glass = createFluidGlass($('fluid'), { image: () => B.canvas, reducedMotion: ui.reduced, historyFrames: 48, position: { x: .5, y: .5 } });
let field = null, specs = [], refs = new Map(), S = B.state(), frameTime = performance.now(), lastRender = 0, pendingFocus = null, cause = 'The surface was still.', seen = { liters: null, place: null, speech: 0, said: 0 }, mapImage = '', mapAt = 0;
const pulls = new Map(), caughtVoices = new Map(), undo = [];
const svgNS = 'http://www.w3.org/2000/svg', menuInk = document.createElementNS(svgNS, 'svg'); menuInk.id = 'menu-ink'; menuInk.setAttribute('aria-hidden', 'true'); world.append(menuInk);
let menuWater = [], lastAdmit = 0, held = null, mix = null; const admitted = new Set();

const add = spec => specs.push(spec);
const info = (id, slot, kicker, value, note = '', extra = {}) => add({ id, slot, kicker, value, note, kind: 'info', ...extra });
const button = (id, slot, label, note, action, extra = {}) => add({ id, slot, label, note, action, kind: 'button', ...extra });
const range = (id, slot, kicker, value, min, max, step, number, action, extra = {}) => add({ id, slot, kicker, value, min, max, step, number, action, kind: 'range', ...extra });
const live = fn => (...a) => { if (ui.past) { announce('Return to now to act.'); return; } const r = fn(...a); S = B.state(); render(); return r; };
const menuItems = () => { try { return B.menu(); } catch { return []; } };
const val = it => /^[A-Z]$|^$/.test(String(it.value || '').trim()) ? (it.on ? 'on' : '') : it.value;
function item(id, slot, viscosity = 2, extra = {}) { const it = menuItems().find(x => x.id === id); if (!it) return; button('it-' + id, slot, null, null, live(() => it.run()), { kicker: it.label, value: val(it), viscosity, className: 'acts', ...extra }); }

// ---- time held in weather ------------------------------------------------------------------------------------------
function captureWeather() { if (ui.past) return; memory.record({ scene: ui.scene, label: cause, values: { can: S.water.liters, place: S.place.name, focus: S.lens.focus, mode: S.mode } }); }
const timeAvailable = () => Math.min(12, memory.getHistoryRange().maxAge, field?.getHistoryRange?.().available ?? 12, glass.getStats().availableHistorySeconds ?? 12);
function setTimeAge(age) {
  age = clamp(age, 0, timeAvailable());
  if (age < .04) { returnNow(); return; }
  if (!ui.past) { stopSteer(); captureWeather(); ui.say = false; ui.memory = false; }
  ui.past = true; ui.timeAge = age; memory.seekAge(age); field?.setTimeOffset?.(age); glass.setTimeOffset?.(age); ink.setTimeOffset(age); render();
}
function returnNow(shouldRender = true) {
  const was = ui.past; ui.past = false; ui.timeAge = 0; memory.resume(); field?.setTimeOffset?.(0); glass.setTimeOffset?.(0); ink.setTimeOffset(0);
  if (shouldRender) { render(); if (was) announce('Now. Nothing was changed by looking back.'); }
}
function timeDrop() { if (ui.menu) return; range('time-current', 'time', 'Time', ui.past ? `${n(ui.timeAge)} seconds ago` : 'Now', 0, 12, .1, ui.timeAge, setTimeAge, { critical: true, viscosity: 5, className: 'time-current', note: ui.past ? 'pull right to now' : 'pull left to look back' }); }
function buildPast(view) {
  const v = view.snapshot || {};
  info('past-place', 'title', 'Earlier', v.place || S.place.name, 'Read only', { viscosity: 5, className: 'drop-title' });
  info('past-can', 'water', 'Can', `${n(v.can ?? S.water.liters)} L`, 'in this recorded moment', { viscosity: 5, fill: (v.can ?? S.water.liters) / 20 });
  info('past-condition', 'memory1', 'Then', '', view.event?.label || 'The surface was still.', { viscosity: 5, className: 'trace-drop' });
  if (view.dialogue) voiceDrop(view.dialogue);
  button('return-now', 'primary', 'Return to now', 'leave the past without changing it', () => returnNow(), { critical: true, viscosity: 5 });
}

// ---- voices --------------------------------------------------------------------------------------------------------
function voiceDrop(line, home) { if (!line) return; button('voice-current', 'speech', 'Read this voice', line.text, () => { memory.rewet(line.id); render(); }, { kicker: line.speaker, viscosity: 5, voiceId: line.id, voiceText: line.text, className: 'voice-current', fill: Math.max(.08, line.wetness ?? 1), fluidKind: 'voice', home }); }
function buildRecall() {
  const lines = memory.transcript();
  if (lines.length) {
    ui.recallIndex = clamp(ui.recallIndex, 0, lines.length - 1); voiceDrop(memory.projectDialogue(lines[lines.length - 1 - ui.recallIndex].id));
    if (ui.recallIndex < lines.length - 1) button('recall-older', 'a', 'Earlier voice', 'pull the older words', () => { ui.recallIndex++; render(); }, { viscosity: 4 });
    if (ui.recallIndex > 0) button('recall-newer', 'b', 'Later voice', 'pull the later words', () => { ui.recallIndex--; render(); }, { viscosity: 4 });
  } else info('empty-recall', 'speech', 'No words yet', '', 'Walk up to someone and pull their voice.', { viscosity: 4 });
  button('memory-return', 'primary', 'Return', 'to the world', () => { ui.memory = false; render(); }, { critical: true, viscosity: 4 });
}
// AN ALERT IS AN ACT. When something needs you, the surface does not report it: it offers the one thing to do, on the thing,
// with a line of droplets running from your can to it. One touch does it from wherever you stand.
let auto = null;
function alertNow() { if (!S.ready || ui.past) return null; const w = S.water, T = S.things || {}; if (!(w.donkeyDown || w.donkey < .3) || !T.donkey) return null;
  return w.liters >= .5 ? { to: 'donkey', word: 'Water', t: T.donkey } : T.source ? { to: 'source', word: 'Fill', t: T.source } : null; }
function doAlert() { const a = alertNow(); if (!a || auto || S.busy) return; const before = snapNow(); if (S.exit) B.act.exit();
  if (a.t.dist > 4.5 && a.t.wx != null) { B.act.warp(a.t.wx + 1.7, a.t.wz + 1.9); S = B.state(); }
  auto = { kind: a.to === 'donkey' ? 'donkey' : 'draw', left: a.to === 'donkey' ? 8 : 12, before, moved: 0, t: 0 }; cause = a.to === 'donkey' ? 'Watering the donkey.' : 'Filling the can.'; announce(cause); }
function autoTick(dt) { if (!auto) return; auto.t += dt; if (auto.t < .35) return; const T = S.things || {}, W = world.clientWidth, H = world.clientHeight, tgt = auto.kind === 'donkey' ? T.donkey : T.source, can = T.can && T.can.front ? T.can : { x: W * .5, y: H * .62 };
  const got = B.act.lean(auto.kind, Math.min(auto.left, 5 * dt)); auto.left -= got; auto.moved += got; S = B.state();
  const tx = tgt && tgt.front ? clamp(tgt.x, 20, W - 20) : W * .5, ty = tgt && tgt.front ? clamp(tgt.y, 60, H - 60) : H * .45, a = auto.kind === 'donkey' ? [can.x, can.y] : [tx, ty], b = auto.kind === 'donkey' ? [tx, ty] : [can.x, can.y];
  if (got > 0) for (let i = 0; i < 2; i++) SP.parts.push({ x: a[0], y: a[1], vx: (b[0] - a[0]) * 1.7 + (Math.random() - .5) * 40, vy: (b[1] - a[1]) * 1.7 - 240, r: 1.6 + Math.random() * 2, life: 0, ttl: .6, tone: '178,247,240' });
  if (got <= 0 || auto.left <= .01 || auto.t > 6) { const m = auto; auto = null; seen.liters = S.water.liters; stable = snapNow(); splash(b[0], b[1], 1.9); if (m.moved > .05) addKeep('act', b[0], b[1] - 40, { before: m.before, label: `${n(m.before.liters)} → ${n(S.water.liters)} L` }); cause = m.kind === 'donkey' ? 'The donkey drank.' : 'The can is filled.'; announce(cause); render(); } }
function alertCurrent() {                                             // droplets run from the can to the thing that needs it
  if (ui.scene !== 'world' || ui.menu || !field || !alertNow()) return []; const bs = field.getBodies(), z = bs.find(b => b.id === 'alert'); if (!z) return []; const T = S.things || {}, W = world.clientWidth, H = world.clientHeight, a = T.can && T.can.front ? { x: T.can.x, y: T.can.y } : { x: W * .5, y: H * .7 };
  const t = ui.reduced ? 0 : performance.now() / 1000, len = Math.hypot(z.x - a.x, z.y - a.y), count = Math.max(4, Math.round(len / 20));
  return [{ id: 'alert-current', kind: 'menu', nodes: Array.from({ length: count + 1 }, (_, i) => { const f = i / count, ph = (f * 3 - t * .9) % 1, bead = Math.pow(Math.max(0, Math.sin((ph < 0 ? ph + 1 : ph) * Math.PI)), 6); return { x: a.x + (z.x - a.x) * f + Math.sin(f * 9 + t) * 2.5, y: a.y + (z.y - a.y) * f - Math.sin(f * Math.PI) * 26, r: 2.4 + bead * 6.5, alpha: .95 }; }) }];
}
const snapNow = () => ({ liters: S.water.liters, donkey: S.water.donkey, x: S.pos.x, z: S.pos.z, yaw: S.pos.yaw, place: S.place.name });
let stable = null, worm = null;
function watchGame() {
  const w = S.water, sp = S.speech;
  const flowing = (mix && mix.c && mix.c.flow) || auto;
  if (S.live && S.live.x != null) ui.lastLive = [S.live.x, S.live.y];
  if (S.busy && !worm) worm = { root: ui.lastLive || [world.clientWidth * .5, world.clientHeight * .3], segs: [], t0: performance.now() };
  if (worm && !worm.end) { if (S.busy) { while (worm.segs.length < Math.min(7, Math.floor((performance.now() - worm.t0) / 700) + 1)) worm.segs.push({ l: w.liters }); worm.segs[worm.segs.length - 1].l = w.liters; } else worm.end = performance.now(); }
  if (worm && worm.end && performance.now() - worm.end > 700) worm = null;
  if (!flowing && seen.liters !== null && Math.abs(w.liters - seen.liters) > .05) { cause = w.liters > seen.liters ? `Water arrived. ${n(w.liters)} L in the can.` : `Water given. ${n(w.liters)} L left.`; const at = ui.lastLive || [world.clientWidth * .5, world.clientHeight * .6]; splash(at[0], at[1], 1.7); announce(cause);
    if (stable) addKeep('act', at[0], at[1] - 30, { before: stable, label: `${n(stable.liters)} → ${n(w.liters)} L` }); }
  if (!flowing && !S.busy) stable = snapNow();
  seen.liters = w.liters;
  if (seen.place !== null && S.place.name !== seen.place) cause = `Reached ${S.place.name}.`;
  if (seen.place !== S.place.name) ui.titleUntil = performance.now() + 7000;
  seen.place = S.place.name;
  if (S.said && S.said.seq !== seen.said) { seen.said = S.said.seq; memory.recordDialogue({ key: 'you-' + S.said.seq, speaker: 'You', text: S.said.text }); }
  if (sp && sp.seq !== seen.speech) { seen.speech = sp.seq; const line = memory.recordDialogue({ key: 'v-' + sp.seq, speaker: sp.name, text: sp.spoken || sp.text }); ui.voiceId = line?.id; ui.voiceUntil = performance.now() + (sp.dur || 4) * 1000 + 9000; cause = `${sp.name} spoke.`; }
}
function currentVoice() { if (!ui.voiceId) return null; const held = caughtVoices.size > 0; if (!held && performance.now() > ui.voiceUntil && ui.scene !== 'people') return null; return memory.projectDialogue(ui.voiceId); }
function voiceHome() { const sp = S.speech; if (!sp || sp.x == null) return null; return [clamp(sp.x / world.clientWidth, .2, .78), clamp(sp.y / world.clientHeight - .07, .16, .6)]; }

// ---- what is true now, as drops ------------------------------------------------------------------------------------
const TITLES = { all: 'Every control', world: null, lens: 'The lens', donkey: 'The donkey', water: 'Shared water', people: 'A voice beside you', rig: 'The camera', map: 'The way', sound: 'Listen here', weather: 'Living world' };
const MODE = { walk: 'On foot', ride: 'Riding', drive: 'Driving', glide: 'In the air' };
function pushUndo(label, restore) { undo.push({ label, restore }); if (undo.length > 12) undo.shift(); }
function doUndo() { if (ui.past) return; const u = undo.pop(); if (!u) return; u.restore(); S = B.state(); cause = `Restored ${u.label}.`; announce(cause); glass.burst(world.clientWidth * .5, world.clientHeight * .6, 'amber'); render(); }
function liveDrop(slot = 'primary') {
  const L = S.live; if (!L || S.busy) return false;
  const home = L.x != null && ui.scene === 'world' ? [clamp(L.x / world.clientWidth, .16, .84), clamp(L.y / world.clientHeight, .2, .78)] : null;
  const note = L.kind === 'draw' ? 'from the source to your can' : L.kind === 'give' ? 'pour from your can' : 'pull their voice';
  button('primary', slot, L.kind === 'draw' ? 'Draw' : L.id === 'share' ? 'Share' : L.kind === 'give' ? 'Water' : 'Ask', note, live(() => B.act.live(false)), { className: 'action-drop', viscosity: 1.15, home, flow: true });
  return true;
}
function exitDrop() { if (S.exit) button('exit', 'recovery', S.exit.label, 'back to your feet', live(() => B.act.exit()), { critical: true, className: 'amber', viscosity: 3, home: ui.scene === 'world' ? [.5, .86] : null }); }
function base() {
  if (!ui.menu && ui.scene !== 'world' && ui.scene !== 'map') button('place', 'title', TITLES[ui.scene] || S.place.name, 'tap for more', () => { ui.details = !ui.details; render(); }, { className: 'drop-title', viscosity: 4, kicker: ui.scene === 'world' ? MODE[S.mode] : S.place.name });
  if (ui.menu) { exitDrop(); if (undo.length) button('undo', 'recovery', 'Undo', undo.at(-1).label, doUndo, { critical: true, viscosity: 4, home: S.exit ? [.47, .68] : null }); return false; }
  if (ui.scene !== 'world' && ui.scene !== 'map') button('can', 'water', null, null, () => { ui.details = !ui.details; render(); }, { fill: S.water.liters / 20, kicker: 'Can', value: `${n(S.water.liters)} L`, note: ui.details ? 'of 20 L' : '', viscosity: 1.8 });
  if (ui.scene !== 'world' && (S.water.donkeyDown || S.water.donkey < .3)) button('need', 'need', null, null, () => { ui.scene = 'donkey'; render(); }, { kicker: 'Donkey', value: S.water.donkeyDown ? 'Down' : 'Thirsty', note: 'water before the climb', className: 'amber', viscosity: 3 });
  if (ui.rest) { info('rest', 'speech', 'Rest', 'The world waits.', 'Your water, plates and place are kept.', { className: 'speech-drop', viscosity: 3 }); button('resume', 'primary', 'Return', 'to this moment', () => { ui.rest = false; render(); }, { className: 'action-drop' }); return false; }
  if (ui.memory) { buildRecall(); return false; }
  return true;
}
const chart = document.createElement('img'); chart.id = 'rw-chart'; chart.alt = ''; chart.hidden = true; world.append(chart);
const shortName = nm => nm.replace(/^the /, '').replace(/^white wall at the /, '');
function mixSpec() { const W = world.clientWidth, H = world.clientHeight;
    if (mix) { const c = mix.c, pct = Math.round(mix.t * 100);
      info('mix', 'a', '', c.flow ? (mix.stuck ? '' : n(S.water.liters) + ' L') : c.dry ? '' : mix.fired ? '' : pct + '%', '', { label: c.flow ? (mix.stuck ? c.what : '') : c.dry || mix.fired ? c.what : '', critical: true, className: c.dry || (c.flow && mix.stuck) ? 'amber' : 'action-drop', viscosity: 1, home: [clamp(mix.x / W, .2, .78), clamp(mix.y / H - .11, .14, .8)] }); }
}
const BUILD = {
  world() {                                                           // only what this place and this moment are about, each drop on the thing it speaks for
    const W = world.clientWidth, H = world.clientHeight, T = S.things || {}, onScr = t => t && t.front && t.x > 0 && t.x < W && t.y > 0 && t.y < H;
    const at = (t, dy = 0) => [clamp(t.x / W, .16, .8), clamp(t.y / H + dy, .17, .74)];
    if (ui.open && performance.now() - ui.openAt > 11000) ui.open = null;
    const open = ui.open, opener = id => () => { ui.open = ui.open === id ? null : id; ui.openAt = performance.now(); render(); };
    mixSpec();
    exitDrop();
    if ((!open || open === 'primary') && !auto && !(S.water.donkeyDown || S.water.donkey < .3)) liveDrop();   // while something needs you, its act is the only act
    if (!open || open === 'can') button('can', 'water', null, null, opener('can'), { fill: S.water.liters / 20, kicker: 'Can', value: `${n(S.water.liters)} L`, viscosity: 1.8, opens: true });
    const d = T.donkey, thirsty = S.water.donkeyDown || S.water.donkey < .3, al = !open && !auto && !S.busy ? alertNow() : null;
    if (al) { const t = al.t, vis = onScr(t), hm = vis ? at(t, -.06) : [t.front ? clamp(t.x / W, .15, .82) : (t.x > W / 2 ? .15 : .82), .46];
      button('alert', 'need', al.word, '', live(() => doAlert()), { className: 'action-drop alert', critical: true, viscosity: 1, home: hm }); }
    if (al || auto) { /* the act stands in for the report */ } else if ((!open || open === 'donkey') && S.mode === 'walk' && d && d.dist < 28 && d.dist > 1.2 && onScr(d) && !(S.live && S.live.id === 'water-burro'))
      button('donkey', 'need', null, null, opener('donkey'), { kicker: 'Donkey', value: thirsty ? 'Thirsty' : `${Math.round(S.water.donkey * 100)}%`, className: thirsty ? 'amber' : '', viscosity: 3, home: at(d, -.03), opens: true });
    else if (!open && thirsty && S.mode === 'walk') button('donkey', 'need', null, null, opener('donkey'), { kicker: 'Donkey', value: 'Thirsty', className: 'amber', viscosity: 3, opens: true });
    const v = currentVoice(); if (v && (!open || open === 'voice-current')) voiceDrop(v, voiceHome());
    const nx = T.next;
    if ((!open || open === 'next') && nx && nx.dist > 14) { const side = !nx.front ? (nx.x < W / 2 ? .8 : .16) : clamp(nx.x / W, .16, .8);
      button('next', 'c', null, null, opener('next'), { kicker: 'Next', value: nx.name.split(' at the ').pop().replace(/^the /, ''), viscosity: 1.2, home: [side, nx.front ? clamp(nx.y / H - .05, .17, .5) : .5], opens: true }); }
    if (performance.now() < ui.titleUntil && !open) button('place', 'title', S.place.name, '', opener('place'), { className: 'drop-title', viscosity: 4, kicker: MODE[S.mode], opens: true });
    if (!open && !S.busy && !ui.touch) { const acts = [], it = id => menuItems().find(x => x.id === id), near = d && d.dist < 7;
      if (S.mode === 'walk') { acts.push(['jump', 'Jump']); acts.push(['run', 'Run']); if (near) acts.push(['ride', 'Ride']); else acts.push(['glide', 'Glide']); }
      else if (S.mode === 'ride' || S.mode === 'drive') acts.push(['run', 'Run']);
      acts.slice(0, 3).forEach(([id, word], i) => { const m = it(id); if (m) button('act-' + id, 'a', word, '', live(() => m.run()), { className: 'acts quick' + (m.on ? ' on' : ''), viscosity: .6 + i * .3, home: [.83, .8 - i * .105] }); }); }
    if (ui.touch && performance.now() - ui.touch.at > 7000) ui.touch = null;
    if (ui.touch && !open && !S.busy) { const t = ui.touch, L = S.live, mi = id => menuItems().find(x => x.id === id), list = [];
      const act = (id, word, run, cls = 'acts') => list.push([id, word, run, cls]), it = (id, word) => { const m = mi(id); if (m) act(id, word, () => m.run()); };
      if (t.kind === 'donkey') { const al2 = alertNow(); if (al2) act('water', al2.word, () => doAlert(), 'action-drop'); else if (S.water.liters >= .5 && S.water.donkey < .95) act('water', 'Water', () => { const T3 = S.things || {}; auto = { kind: 'donkey', left: 8, before: snapNow(), moved: 0, t: 0 }; if (T3.donkey && T3.donkey.dist > 4.5) { B.act.warp(T3.donkey.wx + 1.7, T3.donkey.wz + 1.9); } }, 'action-drop'); it('ride', S.mode === 'ride' ? 'Down' : 'Ride'); it('drive', 'Wagon'); }
      else if (t.kind === 'source') { if (L && L.kind === 'draw') act('draw', 'Draw', () => B.act.live(false), 'action-drop'); }
      else if (t.kind === 'person') { if (L && L.kind === 'talk') act('ask', 'Ask', () => B.act.live(false), 'action-drop'); if (L && L.id === 'share') act('share', 'Share', () => B.act.live(false), 'action-drop'); act('say', 'Say', () => { ui.scene = 'people'; ui.say = true; render(); $('say-text').focus(); }); }
      else if (t.kind === 'wagon') it('drive', S.mode === 'drive' ? 'Park' : 'Drive');
      else if (t.kind === 'me') { it('jump', 'Jump'); it('run', 'Run'); it('glide', 'Glide'); }
      else if (t.kind === 'sky') { it('glide', S.mode === 'glide' ? 'Land' : 'Glide'); act('weather', 'Weather', () => { ui.scene = 'weather'; }); }
      else if (t.kind === 'next') act('map', 'Map', () => { ui.mapSel = null; ui.scene = 'map'; });
      if (!list.length) ui.touch = null;
      const up = t.y / H > .3 ? -1 : 1; list.slice(0, 3).forEach(([id, word, run, cls], i, arr) => { const a = (i - (arr.length - 1) / 2) * .95, hm = [clamp(t.x / W + Math.sin(a) * 86 / W, .15, .82), clamp(t.y / H + up * Math.cos(a) * 92 / H, .13, .8)];
        if (run) button('aff-' + id, 'a', word, '', live(() => { run(); ui.touch = null; }), { className: cls + ' quick', viscosity: .7 + i * .3, home: hm, critical: true }); else info('aff-' + id, 'a', '', '', '', { label: word, className: cls + ' quick', viscosity: 2, home: hm, critical: true }); }); }
    { const now = performance.now(); for (const k of keeps.slice()) { k.life = 1 - (now - k.born) / k.ttl; if (k.life <= 0) dropKeep0(k.id); } }
    for (const k of keeps) button(k.id, 'a', null, null, () => restoreKeep(k), { value: k.label, fill: k.life, className: 'keep ' + (k.kind === 'act' ? '' : 'amber'), viscosity: 4.5, home: [k.x, k.y], keep: true });
    if (open) unfold(open);
  },
  lens() {
    const L = S.lens, f = Math.min(100, L.focus);
    range('focus', 'a', 'Focus', L.focus > 100 ? 'Far' : `${n(f)} m`, 1.5, 100, .5, f, v => B.act.focus(v), { viscosity: 2.2 });
    button('filter', 'b', null, null, live(() => B.act.set('filter', (L.filter + 1) % L.filters.length)), { kicker: 'Filter', value: L.filterName.split(' ')[0], note: 'pull sideways to change', viscosity: 2.5, cycle: ['filter', L.filters.length] });
    button('stop', 'c', null, null, live(() => B.act.set('stop', (L.stop + 1) % L.stops.length)), { kicker: 'Aperture', value: L.stopName, note: 'pull sideways to change', viscosity: 2.8, cycle: ['stop', L.stops.length] });
    range('tilt', 'd', 'Tilt', `${n(L.tilt * 57.3)}°`, -20, 20, 1, Math.round(L.tilt * 57.3), v => B.act.set('tilt', v / 57.3), { viscosity: 1.6 });
    if (ui.details) { item('mode', 'e', 1.4); }
    button('primary', 'primary', 'Expose', 'capture one plate', live(() => { B.act.expose(); cause = 'A plate was exposed.'; }), { className: 'action-drop', viscosity: 2.3 });
    if (undo.length) button('undo', 'recovery', 'Undo', undo.at(-1).label, doUndo, { className: 'amber', viscosity: 3 });
  },
  donkey() { info('shared', 'a', 'Donkey', `${Math.round(S.water.donkey * 100)}%`, S.water.donkeyDown ? 'Down. Water first.' : S.water.donkey < .3 ? 'Waiting for water.' : 'Enough for the climb.', { viscosity: 1.7, fill: S.water.donkey }); item('ride', 'b', 1.1); item('drive', 'c', 1.4); if (!liveDrop() && S.live == null) info('walk-to', 'primary', 'Water', 'Walk closer', 'the pour happens beside the donkey', { viscosity: 2 }); exitDrop(); },
  water() { info('reserve', 'a', 'Keep back', `${n(S.water.reserve)} L`, 'for the way home', { viscosity: 2.2 }); info('space', 'b', 'Space in the can', `${n(20 - S.water.liters)} L`, 'Nothing disappears.', { viscosity: 1.9 }); item('squirt', 'c', .6); item('throw', 'd', .7); if (!liveDrop()) info('walk-to', 'primary', 'Water', 'Find the pump', 'Basalt Pump holds the source', { viscosity: 2 }); },
  people() { const v = currentVoice(); if (!ui.say) { if (v) voiceDrop(v, voiceHome()); else info('no-voice', 'speech', 'No one near', '', 'Walk up to someone. Their voice arrives as water.', { viscosity: 4 }); } if (S.live && S.live.kind === 'talk') liveDrop('topic1'); button('say', 'c', ui.say ? 'Cancel' : 'Say', ui.say ? 'keep listening' : 'write into the water', () => { ui.say = !ui.say; render(); if (ui.say) $('say-text').focus(); }, { viscosity: 4 }); item('voice', 'd', 2); },
  rig() { item('rig', 'a', 2.4); item('sync', 'b', 1.8); item('plates', 'c', 2.6); item('cam', 'd', 1.4); if (ui.details) item('playas', 'e', 2); const p = B.act.lastPlate(); if (p) info('plate-view', 'speech', 'Last plate', '', `${n(Math.min(100, S.lens.focus))} m · ${S.lens.stopName}`, { className: 'plate-detail', image: p, viscosity: 3 }); button('primary', 'primary', 'Expose', 'capture one plate', live(() => B.act.expose()), { className: 'action-drop', viscosity: 2.2 }); },
  map() {                                                             // the way, in water: a pool of relief, the stops and you as drops, the route as a current
    const stops = S.map.stops, sel = stops.find(x => x.id === ui.mapSel) || stops.find(x => x.next) || stops[0]; ui.mapSel = sel.id;
    const W = world.clientWidth, H = world.clientHeight, w = Math.min(W - 60, 420), h = w * 660 / 720, cx = .46, cy = .37, img = drawMap();
    const at = id => { const uv = B.chart.uv(id); return uv ? [clamp(cx + (uv[0] - .5) * w / W, .14, .82), clamp(cy + (uv[1] - .5) * h / H, .12, .8)] : null; };
    mixSpec();
    chart.src !== img && (chart.src = img); Object.assign(chart.style, { left: (cx * W - w / 2) + 'px', top: (cy * H - h / 2) + 'px', width: w + 'px', height: h + 'px' });
    stops.forEach((st, i) => { const hm = at(st.id); if (!hm) return; button('stop-' + st.id, 'a', null, null, () => { ui.mapSel = st.id; mapAt = 0; glass.burst(hm[0] * W, hm[1] * H, 'water'); render(); }, { kicker: String(i + 1), value: shortName(st.name), className: 'stop-drop' + (st.next ? ' amber' : st.id === sel.id ? ' action-drop' : ''), fill: st.seen ? 1 : .15, viscosity: 2.4 + i * .3, home: hm, flow: false }); });
    const me = at('me'); if (me) button('me', 'a', null, null, () => { glass.burst(me[0] * W, me[1] * H, 'water'); }, { kicker: '', value: 'You', className: 'stop-drop me-drop', viscosity: .9, home: [me[0], me[1] + .012], carry: true });
    const dk = at('donkey'); if (dk && Math.hypot((dk[0] - (me ? me[0] : 0)) * W, (dk[1] - (me ? me[1] : 0)) * H) > 46) info('map-donkey', 'a', '', 'Donkey', '', { className: 'stop-drop amber', viscosity: 3, home: dk });
    if (sel.dist >= 14) button('primary', 'primary', 'Go', '', live(() => { B.act.travel(sel.id); cause = `Travelled to ${shortName(sel.name)}.`; ui.scene = 'world'; }), { className: 'action-drop', viscosity: 2, home: [.7, .84] });
    button('map-back', 'recovery', 'Back', '', () => { ui.scene = 'world'; render(); }, { className: 'amber', viscosity: 3, home: [.26, .84] });
  },
  all() {                                                             // every operational control the game has, eight to a page, nothing left out
    const items = menuItems(), per = 8, pages = Math.max(1, Math.ceil(items.length / per)); ui.page = ((ui.page % pages) + pages) % pages;
    const small = world.clientWidth < 701, lx = small ? .22 : .16, rx = small ? .74 : .84;
    items.slice(ui.page * per, ui.page * per + per).forEach((it, i) => button('all-' + it.id, 'a', null, null, live(() => it.run()), { kicker: it.label, value: val(it), className: 'acts', viscosity: 1.6 + (i % 3) * .4, home: [i % 2 ? rx : lx, .26 + Math.floor(i / 2) * .135] }));
    button('primary', 'primary', 'More', `${ui.page + 1} of ${pages}`, () => { ui.page++; render(); }, { className: 'action-drop', viscosity: 2, home: [rx, .82] });
    exitDrop();
  },
  sound() { item('voice', 'a', 1.2); item('tape', 'b', 1); item('radio', 'c', 1.6); item('listen', 'd', 2); if (ui.details) item('dance', 'e', .8); },
  weather() {
    const modes = ['worms', 'pane', 'fall', 'dew', 'breath'];
    button('material', 'a', null, null, () => { weather.material = modes[(modes.indexOf(weather.material) + 1) % modes.length]; render(); }, { kicker: 'Water', value: weather.material[0].toUpperCase() + weather.material.slice(1), note: 'pull sideways to change', viscosity: 2.6, cycle: ['material', modes.length] });
    range('erosion', 'erosion', 'Erosion', `${Math.round(weather.erosion * 100)}%`, 0, 1, .01, weather.erosion, v => { weather.erosion = v; }, { viscosity: 5 });
    range('rain-amount', 'b', 'Rainfall', `${Math.round(weather.rain * 100)}%`, .1, 1, .01, weather.rain, v => { weather.rain = v; }, { viscosity: 1.1 });
    item('glide', 'c', .5); item('run', 'd', .7); exitDrop();
  }
};
// Moving a drop opens it: what belongs to it comes out beside it, one at a time, and everything unrelated steps back.
function unfold(id) {
  const parent = specs.find(sp => sp.id === id); if (!parent) { ui.open = null; return; }
  const [px, py] = homeFor(parent), W = world.clientWidth, H = world.clientHeight, kids = [];
  const kInfo = (kid, kicker, value) => kids.push(h => info(kid, 'a', kicker, value, '', { viscosity: 2, home: h }));
  const kItem = (mid, visc) => { const it = menuItems().find(x => x.id === mid); if (it) kids.push(h => button('it-' + mid, 'a', null, null, live(() => { it.run(); ui.openAt = performance.now(); }), { kicker: it.label, value: val(it), viscosity: visc, className: 'acts', home: h })); };
  if (id === 'can') { kInfo('k-space', 'Room', `${n(20 - S.water.liters)} L`); kInfo('k-reserve', 'Keep back', `${n(S.water.reserve)} L`); if (S.water.liters > 0) { kItem('squirt', .6); kItem('throw', .7); } }
  else if (id === 'donkey') { kInfo('k-dwater', 'Water', `${Math.round(S.water.donkey * 100)}%`); kItem('ride', 1.1); kItem('drive', 1.4); }
  else if (id === 'next') { ui.open = null; ui.mapSel = null; ui.scene = 'map'; return; }
  else if (id === 'place') { kInfo('k-stops', 'Reached', `${S.place.visited.length} of 4`); kItem('region', 2); kItem('run', .7); }
  else if (id === 'voice-current') { kids.push(h => button('say', 'a', 'Say', '', () => { ui.scene = 'people'; ui.say = true; ui.open = null; render(); $('say-text').focus(); }, { viscosity: 4, className: 'acts', home: h })); kids.push(h => button('k-voices', 'a', 'Voices', '', () => { ui.memory = true; ui.open = null; render(); }, { viscosity: 4, className: 'amber', home: h })); }
  const toward = Math.atan2((.5 - py) * H, (.5 - px) * W), R = Math.min(150, W * .34), list = kids.filter(k => k.length);
  let slot = 0; for (const k of kids) { const a = toward + (slot - (kids.length - 1) / 2) * .78; slot++; k([clamp(px + Math.cos(a) * R / W, .16, .8), clamp(py + Math.sin(a) * R / H, .16, .78)]); }
}
// Collision: carry one drop into another and their functions mix. The share climbs while they stay together; at 100% the
// mixed function happens. Part them early and nothing moves. A pair with nothing to do together only says why.
const NAME = { can: 'Can', primary: () => S.live ? (S.live.kind === 'draw' ? 'Source' : S.live.person || 'Donkey') : 'Here', donkey: 'Donkey', next: 'Next stop', 'voice-current': () => S.speech?.name || 'Voice', place: 'Here' };
const nameOf = id => id.startsWith('w:') ? id.slice(2) : id === 'me' ? 'You' : id.startsWith('stop-') ? shortName((S.map.stops.find(x => 'stop-' + x.id === id) || {}).name || '') : typeof NAME[id] === 'function' ? NAME[id]() : NAME[id] || id;
// One water. A drop on the glass and the water it stands for in the scene are the same body: the can, the source, the
// donkey's share, a person's cup. Any of them can be carried into any other, from either side of the glass.
function kindOf(id) { const L = S.live; if (id === 'can' || id === 'w:can') return 'can'; if (id === 'w:source') return 'source'; if (id === 'w:donkey' || id === 'donkey') return 'donkey'; if (id === 'w:person') return 'person';
  if (id === 'primary' && L) return L.kind === 'draw' ? 'source' : L.id === 'water-burro' ? 'donkey' : L.id === 'share' ? 'person' : null; return null; }
function combo(a, b) {
  const has = x => a === x || b === x, L = S.live, w = S.water, T = S.things || {};
  if (a.startsWith('keep-') && b.startsWith('keep-')) { const A = keeps.find(k => k.id === a), Bk = keeps.find(k => k.id === b), pa = A && (A.before || A.pos), pb = Bk && (Bk.before || Bk.pos); if (!pa || !pb || pa.x == null || pb.x == null) return null;
    return { slide: true, what: '', run: t => { const here = snapNow(), T2 = S.things || {}, at = T2.can && T2.can.front ? [T2.can.x, T2.can.y - 70] : [world.clientWidth * .5, world.clientHeight * .5]; B.act.warp(pa.x + (pb.x - pa.x) * t, pa.z + (pb.z - pa.z) * t, pa.yaw); S = B.state(); stable = snapNow(); addKeep('back', at[0], at[1], { before: here, label: 'back' }); cause = 'Standing between two kept moments.'; announce(cause); } }; }
  { const ka = kindOf(a), kb = kindOf(b), K = x => ka === x || kb === x;
    if (ka && kb && ka !== kb && K('can')) {
      if (K('source')) return (L && L.kind === 'draw') || (T.source && T.source.dist < 12) ? { flow: 'draw', what: 'Full' } : { what: 'Closer', dry: true };
      if (K('donkey')) return (L && L.id === 'water-burro') || (T.donkey && T.donkey.dist < 14) ? { flow: 'donkey', what: w.liters < .05 ? 'Empty' : 'Full' } : { what: 'Closer', dry: true };
      if (K('person')) return L && L.id === 'share' ? { what: 'Shared', run: () => B.act.live(true) } : { what: w.liters < .05 ? 'Empty' : 'Closer', dry: true };
    }
    if (ka && kb && ka !== kb && K('source') && (K('donkey') || K('person'))) return { what: 'Use the can', dry: true }; }
  if (has('me')) { const o = a === 'me' ? b : a, st = o.startsWith('stop-') && S.map.stops.find(x => 'stop-' + x.id === o); if (!st) return null;
    return st.dist < 14 ? { what: 'You are here', dry: true } : { what: `Travel ${Math.round(st.dist)} m ${st.dir}`, run: () => { B.act.travel(st.id); ui.scene = 'world'; } }; }
  if (has('can') && has('primary') && L && L.kind !== 'talk') return { what: L.kind === 'draw' ? 'Fill the can' : L.id === 'share' ? 'Share water' : 'Water the donkey', litres: Math.abs(L.delta) || 0, run: () => B.act.live(true) };
  if (has('can') && has('donkey')) return { what: w.liters < .05 ? 'The can is empty' : 'Carry the can closer', dry: true };
  if (has('can') && has('voice-current')) return L && L.id === 'share' ? { what: 'Share water', litres: 0, run: () => B.act.live(true) } : { what: w.liters < .05 ? 'Nothing to pour' : 'Stand with them to share', dry: true };
  if (has('donkey') && has('next') && T.next) { const it = menuItems().find(x => x.id === 'ride'); if (it) return { what: 'Ride on', run: () => it.run() }; }
  if (has('can') && has('next') && T.next) return { what: `${n(w.liters)} L for ${Math.round(T.next.dist)} m`, dry: true };
  if (has('primary') && has('voice-current') && L && L.kind === 'talk') return { what: 'Ask', run: () => B.act.live(false) };
  return null;
}
function sceneWaters() {                                              // where the scene's water shows through the glass, in screen pixels
  if (!S.ready || ui.scene !== 'world' || ui.menu || ui.past) return []; const T = S.things || {}, W = world.clientWidth, H = world.clientHeight, L = S.live, out = [];
  const on = t => t && t.front && t.x > 10 && t.x < W - 10 && t.y > 10 && t.y < H - 10;
  if (on(T.can) && S.mode === 'walk') out.push({ id: 'w:can', x: T.can.x, y: T.can.y, r: 13 + S.water.liters * .55 });
  if (L && L.kind === 'draw' && L.x != null) out.push({ id: 'w:source', x: L.x, y: L.y, r: 27 }); else if (on(T.source) && T.source.dist < 45) out.push({ id: 'w:source', x: T.source.x, y: T.source.y, r: clamp(260 / Math.max(6, T.source.dist), 9, 27) });
  if (on(T.donkey) && T.donkey.dist < 30) out.push({ id: 'w:donkey', x: T.donkey.x, y: T.donkey.y + 16, r: clamp(190 / Math.max(5, T.donkey.dist), 8, 20) * (.6 + S.water.donkey * .5) });
  const p = (T.people || [])[0]; if (p && on(p) && p.dist < 6) out.push({ id: 'w:person', x: p.x, y: p.y + 46, r: 11 });
  return out;
}
function mixTick(bodies, dt) {
  for (const w of sceneWaters()) if (!bodies.has(w.id)) bodies.set(w.id, { id: w.id, x: w.x, y: w.y, rx: w.r, ry: w.r });
  if (!held || ui.past || ui.menu || (ui.scene !== 'world' && ui.scene !== 'map')) { mix = null; return; }
  let hit = null; for (const [id, b] of bodies) { if (id === held || /^(time-current|steer|mix|menu-)/.test(id)) continue; if (Math.hypot(ptr.x - b.x, ptr.y - b.y) < Math.max(b.rx || 40, b.ry || 30) + 16 && combo(held, id)) { hit = id; break; } }
  const c = hit && combo(held, hit);
  if (c) { if (!mix || mix.b !== hit) mix = { a: held, b: hit, t: 0, fired: false }; mix.c = c; mix.x = ptr.x; mix.y = ptr.y;
    if (c.flow) { if (!mix.before) { mix.before = snapNow(); mix.moved = 0; } const got = B.act.lean(c.flow, 4.2 * dt); mix.moved += got; mix.stuck = got <= 0; mix.t = 1; if (got > 0) { S = B.state(); if (Math.random() < .5) SP.parts.push({ x: ptr.x + (Math.random() - .5) * 16, y: ptr.y, vx: (Math.random() - .5) * 90, vy: -120 - Math.random() * 120, r: 1.4 + Math.random() * 1.6, life: 0, ttl: .5, tone: '178,247,240' }); } }
    else if (c.slide) { mix.ph = (mix.ph || 0) + dt / 2.6; mix.t = 1 - Math.abs((mix.ph % 1) * 2 - 1); }
    else if (!c.dry && !mix.fired) { mix.t = Math.min(1, mix.t + dt / 1.3); if (mix.t >= 1) { mix.fired = true; c.run(); cause = c.what + '.'; announce(cause); splash(ptr.x, ptr.y, 1.9); S = B.state(); } } }
  else if (mix && !mix.fired) { mix.t -= dt * 2.2; if (mix.t <= 0) mix = null; }
}
function endMix() {                                                   // a lean ends in one bead holding before and after; a slide ends where the point stood
  if (!mix) return false; const m = mix;
  if (m.c.flow) { if (m.moved > .05) { seen.liters = S.water.liters; addKeep('act', m.x, m.y - 30, { before: m.before, label: `${n(m.before.liters)} → ${n(S.water.liters)} L` }); cause = `${n(m.moved)} L moved.`; announce(cause); stable = snapNow(); } return true; }
  if (m.c.slide) { m.c.run(m.t); splash(m.x, m.y, 1.4); return true; }
  return !!m.fired;
}
// Thick description: drawn out of a drop along the finger's path, it says what the thing is, where it stands and what it is for, now.
function describe(id) {
  const T = S.things || {}, w = S.water, L = S.live, W = world.clientWidth, m = v => Math.round(v);
  const way = t => !t.front ? 'behind you' : t.x < W * .33 ? 'to your left' : t.x > W * .67 ? 'to your right' : 'ahead';
  if (id === 'can') return w.liters < .05 ? 'The can is empty. Twenty litres fit. The donkey drinks before the climb.' : `${n(w.liters)} litres in the can, room for ${n(20 - w.liters)}. Keep ${n(w.reserve)} back for the way home.`;
  if (id === 'donkey' && T.donkey) return `The donkey stands ${m(T.donkey.dist)} m ${way(T.donkey)}, ${w.donkeyDown ? 'down and needing water now' : w.donkey < .3 ? 'thirsty and waiting' : 'watered and ready'}. Open it to ride or hitch the wagon.`;
  if (id === 'next' && T.next) return `${T.next.name[0].toUpperCase() + T.next.name.slice(1)}, ${m(T.next.dist)} m ${way(T.next)}. ${S.place.visited.length} of 4 stops reached. Open it for the way.`;
  if (id === 'place') return `${S.place.name}. ${MODE[S.mode]}. ${T.next ? 'Next is ' + T.next.name + '.' : 'Every stop is reached.'}`;
  if (id === 'primary' && L && ui.scene === 'world') return L.kind === 'draw' ? `The source. Pull to draw ${n(Math.abs(L.delta) || 0)} litres into your can. Nothing is lost.` : L.kind === 'give' ? `Pour from your can here${L.person ? ', for ' + L.person : ''}. ${n(w.liters)} litres in hand.` : `${L.person || 'Someone'} is beside you. Pull to ask.`;
  if (id.startsWith('stop-')) { const st = S.map.stops.find(x => 'stop-' + x.id === id), WHAT = { basalt: 'The source. Saba keeps the pump; the can fills here.', beacon: 'The white wall. Ask here for the way on.', hill: 'The archive on the hill. Cool the reels and copy them.', compound: 'The compound. Listen, screen, and tap the line.' };
    return st ? `${shortName(st.name)}. ${WHAT[st.id] || ''} ${st.dist < 14 ? 'You are here.' : `${Math.round(st.dist)} m ${st.dir}.`} ${st.seen ? 'Reached.' : st.next ? 'Next.' : 'Not yet.'}` : ''; }
  if (id === 'me') return `You, at ${S.place.name}, with ${n(S.water.liters)} litres. Carry yourself into a stop to travel there.`;
  if (id === 'exit' && S.exit) return `${MODE[S.mode]}. ${S.exit.label}.`;
  return '';
}
function drawMap() {
  if (performance.now() - mapAt < 700 && mapImage) return mapImage; mapAt = performance.now();
  const c = drawMap.c || (drawMap.c = document.createElement('canvas')); c.width = 720; c.height = 660; B.chart.draw(c, ui.mapSel, true);
  return (mapImage = c.toDataURL('image/jpeg', .86));
}

// ---- render: specs -> DOM drops -> the field -------------------------------------------------------------------------
function render() {
  S = B.state(); const view = memory.view(); specs = [];
  world.className = `scene-${ui.scene} travel-${S.mode}${ui.menu ? ' menu-open' : ''}${ui.reduced ? ' still' : ''}${ui.words ? ' read-water' : ''}${ui.past ? ' reading-past' : ''}${ui.details ? ' details-open' : ''}${S.speed > .4 && !ui.past ? ' moving' : ''}`;
  world.dataset.scene = ui.scene;
  if (S.ready) { if (ui.past) buildPast(view); else if (base()) BUILD[ui.scene](); timeDrop(); }
  { const now = performance.now(), want = new Set(specs.map(sp => sp.id)); for (const id of admitted) if (!want.has(id)) admitted.delete(id);
    specs = specs.filter(sp => { if (admitted.has(sp.id)) return true; if (sp.critical || now - lastAdmit > 380) { admitted.add(sp.id); if (!sp.critical) lastAdmit = now; return true; } return false; }); }
  chart.hidden = !(S.ready && ui.scene === 'map' && !ui.menu && !ui.past);
  syncDrops(); renderMenu();
  const canSteer = S.ready && !ui.past && !ui.rest && !ui.memory && !ui.menu && !ui.say && ui.scene !== 'map';
  $('steer').hidden = !canSteer; $('say-form').hidden = !ui.say || ui.scene !== 'people' || ui.past; $('menu-toggle').hidden = !S.ready;
  field?.setErosion?.(weather.erosion); glass.setErosion?.(weather.erosion); memory.setErosion(weather.erosion); ink.setErosion(weather.erosion);
  glass.setMode(weather.material); field?.setMaterial(weather.material); glass.setIntensity(weather.rain); glass.setActivity(!!S.busy && !ui.past);
  syncField(); ink.setTrails(field?.getTrails() || []);
  if (pendingFocus) { const el = $(pendingFocus); if (el) { el.focus({ preventScroll: true }); pendingFocus = null; } }
}
function syncDrops() {
  const keep = new Set();
  for (const sp of specs) {
    keep.add(sp.id); let el = refs.get(sp.id);
    if (!el) {
      el = document.createElement(sp.kind === 'button' ? 'button' : sp.kind === 'range' ? 'label' : 'div'); el.id = sp.id;
      el.innerHTML = '<span class="drop-kicker"></span><span class="drop-value"></span><span class="drop-label"></span><span class="drop-note"></span>';
      if (sp.kind === 'range') { const input = document.createElement('input'); input.type = 'range'; input.className = 'control-range'; input.addEventListener('input', () => el._spec.action(Number(input.value))); el.append(input); }
      else if (sp.kind === 'info') el.addEventListener('click', e => { const p = el._spec, img = el.querySelector('.plate-preview'); if (!p.onPoint || !img || field?.suppressClick(e)) return; const r = img.getBoundingClientRect(); p.onPoint((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); });
      else if (sp.kind === 'button') el.addEventListener('click', e => { if (field?.suppressClick(e)) return; const r = el.getBoundingClientRect(), c = el._spec.className || ''; splash(r.x + r.width / 2, r.y + r.height / 2, /action-drop/.test(c) ? 1.5 : .8, /amber/.test(c) ? '255,223,168' : '178,247,240'); el._spec.action?.(); });
      $('drops').append(el); refs.set(sp.id, el);
    }
    const sig = [sp.kicker, sp.value, sp.label].join('|'); if (el._sig !== sig) { el._sig = sig; el._fresh = performance.now(); }
    el._spec = sp; el.dataset.voice = sp.voiceId || ''; el.dataset.traceText = sp.voiceText || '';
    const held = el.classList.contains('pinned'), settling = el.classList.contains('settling'), sheared = el.classList.contains('sheared');
    el.className = `liquid slot-${sp.slot} ${sp.kind === 'info' ? 'info' : ''} ${sp.kind === 'range' ? 'range-drop' : ''} ${sp.className || ''}${held ? ' pinned' : ''}${settling ? ' settling' : ''}${sheared ? ' sheared' : ''}`;
    el.dataset.viscosity = String(sp.viscosity || 1.5);
    for (const [cls, key] of [['drop-kicker', 'kicker'], ['drop-value', 'value'], ['drop-label', 'label'], ['drop-note', 'note']]) { const span = el.querySelector('.' + cls), txt = sp[key] || ''; if (span.textContent !== txt) span.textContent = txt; span.hidden = !txt; }
    el.setAttribute('aria-label', [sp.kicker, sp.value, sp.label, sp.note].filter(Boolean).join('. '));
    if (sp.kind === 'range') { const input = el.querySelector('input'); input.min = sp.min; input.max = sp.max; input.step = sp.step; if (document.activeElement !== input) input.value = sp.number; input.setAttribute('aria-label', sp.kicker); input.setAttribute('aria-valuetext', sp.value); }
    let img = el.querySelector('.plate-preview'); if (sp.image) { if (!img) { img = document.createElement('img'); img.className = 'plate-preview'; img.alt = sp.kicker || ''; el.prepend(img); } if (img.src !== sp.image) img.src = sp.image; } else img?.remove();
  }
  for (const [id, el] of refs) if (!keep.has(id)) { if (document.activeElement === el || el.contains(document.activeElement)) pendingFocus = specs.some(x => x.id === 'primary') ? 'primary' : 'menu-toggle'; el.remove(); refs.delete(id); }
}
const go = scene => () => { returnNow(false); stopSteer(); Object.assign(ui, { scene, menu: false, menuGroup: null, memory: false, say: false, rest: false, details: false }); render(); announce(TITLES[scene] || S.place.name); $('menu-toggle').focus({ preventScroll: true }); };
// THE MENU. Five words by the thumb, grouped by what you mean to do. A word opens its few acts in the same place;
// the acts run at once. Swipe toward the edge, or touch the world, to step back out.
const mItem = id => menuItems().find(x => x.id === id);
const runItem = id => () => { const it = mItem(id); if (!it || ui.past) return; it.run(); closeMenu(); S = B.state(); render(); };
const closeMenu = () => { ui.menu = false; ui.menuGroup = null; };
const GROUPS = {
  go: () => [['map', 'Map', go('map')], ['jump', 'Jump', runItem('jump')], ['run', mItem('run')?.on ? 'Walk' : 'Run', runItem('run')], ['ride', S.mode === 'ride' ? 'Get down' : 'Ride', runItem('ride')], ['glide', S.mode === 'glide' ? 'Land' : 'Glide', runItem('glide')], ['drive', S.mode === 'drive' ? 'Park' : 'Wagon', runItem('drive')]],
  water: () => [['can', 'Can', go('water')], ['donkey', 'Donkey', go('donkey')], ['squirt', 'Squirt', runItem('squirt')], ['throw', 'Throw', runItem('throw')]],
  camera: () => [['expose', 'Expose', () => { if (ui.past) return; B.act.expose(); cause = 'A plate was exposed.'; closeMenu(); render(); }], ['lens', 'Lens', go('lens')], ['rig', 'Rig', go('rig')], ['cam', 'View', runItem('cam')]],
  talk: () => [['say', 'Say', () => { returnNow(false); Object.assign(ui, { scene: 'people', say: true, menu: false, menuGroup: null }); render(); $('say-text').focus(); }], ['memory', 'Voices', () => { stopSteer(); returnNow(false); ui.memory = true; ui.recallIndex = 0; closeMenu(); render(); }], ['people', 'People', go('people')], ['lang', 'Language', () => { mItem('lang')?.run(); render(); announce('Language: ' + (B.state().lang || 'en')); }]],
  more: () => [['sound', 'Sound', go('sound')], ['weather', 'Weather', go('weather')], ['words', ui.words ? 'Hide words' : 'Words', () => { ui.words = !ui.words; closeMenu(); render(); }], ['hold', ui.reduced ? 'Let it move' : 'Hold rain', () => { ui.reduced = !ui.reduced; glass.setReducedMotion(ui.reduced); field?.setReducedMotion(ui.reduced); closeMenu(); render(); }], ['rest', 'Rest', () => { returnNow(false); stopSteer(); ui.rest = true; closeMenu(); render(); }], ['all', 'Everything', go('all')]]
};
function menuList() {
  if (ui.menuGroup && GROUPS[ui.menuGroup]) return [['back', '‹ Back', () => { ui.menuGroup = null; ui.menuAt = 0; render(); }], ...GROUPS[ui.menuGroup]()].map(([id, label, run]) => ({ id: ui.menuGroup + '-' + id, label, run }));
  const open = g => () => { ui.menuGroup = g; ui.menuAt = 0; ui.menuTouch = performance.now(); render(); };
  return [['go', 'Go'], ['water', 'Water'], ['camera', 'Camera'], ['talk', 'Talk'], ['more', 'More']].map(([id, label]) => ({ id, label, run: open(id) })).concat(ui.scene !== 'world' ? [{ id: 'here', label: 'Close ' + (TITLES[ui.scene] || '').toLowerCase(), run: go('world') }] : []);
}
function renderMenu() {
  const t = $('menu-toggle'), menu = $('menu-stream');
  t.setAttribute('aria-expanded', String(ui.menu)); t.setAttribute('aria-label', ui.menu ? 'Close menu' : 'Open menu'); t.querySelector('.drop-label').textContent = ui.menu ? '' : 'Menu'; menu.hidden = !ui.menu;
  if (!ui.menu) { ui.menuAt = 0; ui.menuGroup = null; menu._sig = ''; if (menu.children.length) menu.replaceChildren(); return; }
  if (!ui.menuAt) ui.menuAt = performance.now(); if (!ui.menuTouch) ui.menuTouch = performance.now(); if (ui.menuGroup === 'go' && !drawMap.c) { try { drawMap(); } catch { } }
  if (performance.now() - ui.menuTouch > 20000) { closeMenu(); ui.menuTouch = 0; menu.hidden = true; return; }
  const list = menuList(), sig = (ui.menuGroup || 'top') + '|' + list.map(x => x.id + ':' + x.label).join(',');
  if (menu._sig !== sig) { menu._sig = sig; menu.replaceChildren(); for (const it of list) { const b = document.createElement('button'); b.id = 'menu-' + it.id; b.className = 'liquid'; b.dataset.viscosity = '1.8'; b.innerHTML = '<span class="drop-label"></span>'; b.firstElementChild.textContent = it.label; b.addEventListener('click', e => { if (field?.suppressClick(e)) return; ui.menuTouch = performance.now(); const r = b.getBoundingClientRect(); splash(r.x + r.width / 2, r.y + r.height / 2, .7, '255,223,168'); it.run(); }); menu.append(b); } }
  [...menu.children].forEach((b, i) => { b.hidden = performance.now() - ui.menuAt < i * 70; });
}
function paintMenuWater(bodies) {
  if (!ui.menu) { menuInk.replaceChildren(); menuWater = []; return; }
  const liveIds = new Set(); menuWater = [];
  for (const b of bodies.filter(b => b.id.startsWith('menu-'))) {
    const key = 'wet-' + b.id, half = world.clientWidth < 701 ? 46 : 60;
    const nodes = [{ x: b.x - half, y: b.y + 5, r: 5.5, alpha: .75 }, { x: b.x, y: b.y - 1, r: 7.5, alpha: .8 }, { x: b.x + half, y: b.y + 3, r: 4, alpha: .6 }];
    menuWater.push({ id: key, kind: 'menu', nodes }); liveIds.add(key);
    let group = menuInk.querySelector(`[data-id="${key}"]`);
    if (!group) { group = document.createElementNS(svgNS, 'g'); group.dataset.id = key; const path = document.createElementNS(svgNS, 'path'); path.id = key; path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'none'); group.append(path); const text = document.createElementNS(svgNS, 'text'); text.setAttribute('text-anchor', 'middle'); const flow = document.createElementNS(svgNS, 'textPath'); flow.setAttribute('href', '#' + key); flow.setAttribute('startOffset', '50%'); text.append(flow); group.append(text); menuInk.append(group); }
    group.firstChild.setAttribute('d', `M${nodes[0].x - 36},${nodes[0].y} Q${b.x - 36},${b.y - 7} ${nodes[2].x - 36},${nodes[2].y}`);
    const native = $(b.id), label = native?.textContent.trim() || ''; group.querySelector('textPath').textContent = label; native?.setAttribute('aria-label', label);
  }
  for (const g of [...menuInk.children]) if (!liveIds.has(g.dataset.id)) g.remove();
}
function edgeCurrent() { const width = world.clientWidth, height = world.clientHeight, t = ui.reduced ? 0 : performance.now() / 1000; return { id: 'menu-edge-current', kind: 'menu', nodes: Array.from({ length: 12 }, (_, i) => ({ x: width - 18 + Math.sin(i * .88 + t * .18) * 3, y: i * height / 11, r: 2.8 + Math.pow(Math.sin(i * 1.73 + t * .12), 8) * 4.5, alpha: .9 })) }; }
// the route is a current: beads of water run from you to the chosen stop
function routeCurrent() {
  if (ui.scene !== 'map' || ui.menu || !field) return []; const bs = field.getBodies(), a = bs.find(b => b.id === 'me'), z = bs.find(b => b.id === 'stop-' + ui.mapSel); if (!a || !z) return [];
  const t = ui.reduced ? 0 : performance.now() / 1000, len = Math.hypot(z.x - a.x, z.y - a.y), count = Math.max(4, Math.round(len / 22));
  return [{ id: 'route-current', kind: 'menu', nodes: Array.from({ length: count + 1 }, (_, i) => { const f = i / count, ph = (f * 3 - t * .7) % 1, bead = Math.pow(Math.max(0, Math.sin((ph < 0 ? ph + 1 : ph) * Math.PI)), 6); return { x: a.x + (z.x - a.x) * f + Math.sin(f * 9 + t) * 2.5, y: a.y + (z.y - a.y) * f + Math.cos(f * 7 + t * .8) * 2.5, r: 2.6 + bead * 5.5, alpha: .9 }; }) }];
}
function inkLabel(id) {
  const sp = refs.get(id)?._spec; if (sp?.voiceText) return `${sp.kicker}. ${sp.voiceText}`;
  if (id === 'time-current') return ui.past ? `−${n(ui.timeAge)} s` : 'Now';
  if (sp) { const words = [sp.kicker, sp.value || sp.label].filter(Boolean).join(' '); return words || sp.note || ''; }
  if (id === 'steer') return 'Move';
  return $(id)?.getAttribute('aria-label') || $(id)?.textContent.trim() || '';
}
function initializeField() {
  const proxy = {
    setBodies: bodies => { if (!S.ready) { glass.setBodies([]); return; } paintMenuWater(bodies); glass.setBodies([...bodies.map(b => { const sp = refs.get(b.id)?._spec, m = b.id.startsWith('menu-'); const warm = /amber|time-current/.test(sp?.className || '') || sp?.critical, k = sp?.kind === 'info' ? .84 : 1; return { ...b, fill: sp?.fill, kind: sp?.fluidKind || (warm ? 'amber' : b.kind),  rx: m ? b.rx * .38 : b.id === 'time-current' ? b.rx * 1.3 : b.id === 'voice-current' ? b.rx * 1.15 : b.rx * k, ry: m ? b.ry * .34 : b.id === 'time-current' ? b.ry * .5 : b.id === 'voice-current' ? b.ry * .62 : b.ry * k }; }), { id: 'menu-spring', x: world.clientWidth - 18, y: world.clientHeight * (ui.menu ? .237 : .222), rx: 15, ry: ui.menu ? 55 : 43, viscosity: 4, kind: 'menu', critical: true, opacity: 1 }]); },
    setTrails: trails => { if (!S.ready) { glass.setTrails([]); return; } glass.setTrails([edgeCurrent(), ...routeCurrent(), ...alertCurrent(), ...menuWater, ...(ink.getTrails?.() || []), ...trails]); },
    setPointer: p => glass.setPointer(p), captureFrame: () => glass.captureFrame()
  };
  field = createRainField({ host: world, glass: proxy, historyLabels: false,
    onCatch: (id, meta) => {
      catchAt = { id, x: ptr.x, y: ptr.y }; { const kk = keeps.find(k => k.id === id); if (kk) kk.born = performance.now(); }
      const body = field?.getBodies().find(b => b.id === id), sp = refs.get(id)?._spec; if (meta.reason !== 'focus' && meta.reason !== 'keyboard' && !/^(time-current|mix)$/.test(id)) held = id;
      ink.arm({ id, text: inkLabel(id), x: meta.x ?? body?.x ?? 50, y: meta.y ?? body?.y ?? 100, keyboard: id === 'time-current' || meta.reason === 'focus' || meta.reason === 'keyboard', kind: id === 'voice-current' ? 'voice' : 'water' });
      if (id === 'voice-current' && sp?.voiceId) { caughtVoices.set(id, sp.voiceId); memory.holdDialogue(sp.voiceId, true); }
      if (sp?.kind === 'range' && id !== 'time-current' && !pulls.has(id)) { pulls.set(id, sp.number); pulls.set(id + ':from', { number: sp.number, label: inkLabel(id), action: sp.action }); }
      else if (sp?.cycle && !pulls.has(id)) pulls.set(id, 0);
    },
    onAdjust: (id, delta, meta) => {
      const sp = refs.get(id)?._spec;
      if (id === 'time-current') { const target = meta.key === 'Home' ? 0 : meta.key === 'End' ? timeAvailable() : clamp((pulls.get(id) ?? ui.timeAge) + (meta.phase === 'keyboard' ? -delta * 12 : -(meta.dx || 0) / Math.max(150, world.clientWidth * .6) * 12), 0, timeAvailable()); pulls.set(id, target); setTimeAge(target); ink.arm({ id, text: inkLabel(id), x: meta.x ?? 50, y: meta.y ?? 100, keyboard: true }); return; }
      if (id === 'voice-current' || ui.past) return;
      if (/^menu-(camera|camera-lens|camera-expose)$/.test(id)) { ui.menuTouch = performance.now(); const L = S.lens, t = pulls.get(id) || { f: Math.min(100, L.focus), x: 0 };
        t.f = clamp(t.f + delta * 75, 1.5, 100); t.x += meta.dx || 0; if (Math.abs(t.x) >= 38) { const dir = Math.sign(t.x); t.x -= dir * 38; B.act.set('filter', (L.filter + dir + L.filters.length) % L.filters.length); }
        B.act.focus(Math.round(t.f * 2) / 2); pulls.set(id, t); S = B.state(); ink.arm({ id, text: `Focus ${n(Math.min(100, S.lens.focus))} m · ${S.lens.filterName.split(' ')[0]}`, x: meta.x ?? 50, y: meta.y ?? 100 }); return; }
      if (sp?.cycle) { let travel = (pulls.get(id) || 0) + (meta.phase === 'keyboard' ? (delta > 0 ? 35 : -35) : (meta.dx || 0)); const dir = travel >= 35 ? 1 : travel <= -35 ? -1 : 0;
        if (dir) { travel -= dir * 35; const [what, len] = sp.cycle; if (what === 'material') { const modes = ['worms', 'pane', 'fall', 'dew', 'breath']; weather.material = modes[(modes.indexOf(weather.material) + dir + len) % len]; } else B.act.set(what, (S.lens[what] + dir + len) % len); render(); ink.arm({ id, text: inkLabel(id), x: meta.x ?? 50, y: meta.y ?? 100 }); }
        pulls.set(id, travel); return; }
      if (sp?.kind === 'range') { const raw = meta.key === 'Home' ? sp.min : meta.key === 'End' ? sp.max : clamp((pulls.get(id) ?? sp.number) + delta * (sp.max - sp.min) * .75, sp.min, sp.max); pulls.set(id, raw); const value = clamp(sp.min + Math.round((raw - sp.min) / sp.step) * sp.step, sp.min, sp.max); if (Math.abs(value - sp.number) > sp.step * .25) { sp.action(value); render(); ink.arm({ id, text: inkLabel(id), x: meta.x ?? 50, y: meta.y ?? 100, keyboard: meta.phase === 'keyboard' }); } return; }
      if (id === 'primary' && sp?.flow && !ui.flowHeld && Math.hypot(meta.totalDx || 0, meta.totalDy || 0) > 46) { ui.flowHeld = true; sp.action(); }
    },
    onRelease: (id, meta) => {
      if (meta.dragged || meta.reason === 'keyboard') { const b = field?.getBodies().find(b => b.id === id); ink.arm({ id, text: inkLabel(id), x: b?.x ?? meta.x ?? 50, y: b?.y ?? meta.y ?? 100 }); }
      if (!(id === 'time-current' && meta.reason === 'keyboard')) ink.hold(id, false);
      if (id === 'voice-current') { const voice = caughtVoices.get(id); if (voice) memory.holdDialogue(voice, false); caughtVoices.delete(id); ink.setTrails(field?.getTrails() || []); }
      const from = pulls.get(id + ':from'), sp = refs.get(id)?._spec;
      if (from && sp && Math.abs(sp.number - from.number) > 1e-6) { pushUndo(from.label, () => from.action(from.number)); cause = `${from.label} became ${inkLabel(id)}.`; render(); }
      const mixed = held === id && mix; if (mixed) endMix(); if (held === id) { held = null; mix = null; }
      const c0 = catchAt && catchAt.id === id ? catchAt : { x: ptr.x, y: ptr.y }, far = Math.max(Math.hypot(ptr.x - c0.x, ptr.y - c0.y), Math.hypot(meta.totalDx || 0, meta.totalDy || 0)), rise = c0.y - ptr.y;
      if (!mixed && id === 'time-current' && rise > 70 && !ui.past) addKeep('moment', ptr.x, ptr.y);
      else if (!mixed && far > 110 && /^menu-camera|^focus$|^filter$|^stop$|^tilt$/.test(id)) { addKeep('lens', ptr.x, ptr.y); closeMenu(); }
      else if (far > 120 && id.startsWith('keep-')) { splash(ptr.x, ptr.y, 1.1, '255,223,168'); dropKeep(id); }
      else if (id === 'can' && meta.dragged && !mixed && far > 150 && throwWater('can', ptr.x, ptr.y, far)) { /* thrown, not opened */ } else
      if (meta.dragged && !mixed && sp?.opens && ui.open !== id) { ui.open = id; ui.openAt = performance.now(); render(); }
      pulls.delete(id); pulls.delete(id + ':from'); if (id === 'primary') ui.flowHeld = false;
    }
  });
  field.setReducedMotion(ui.reduced);
}
function homeFor(sp) {
  if (sp.home) return sp.home;
  const small = world.clientWidth < 701, left = small ? .205 : .14, right = small ? .765 : .86;
  const homes = { title: [small ? .27 : .15, .09], water: [left, .235], need: [small ? .49 : .29, .22], a: [left, .405], b: [left, .575], c: [right, .255], d: [right, .425], e: [right, .605], primary: [right, .81], time: [small ? .43 : .2, .945], erosion: [right, .64], recovery: [small ? .51 : .72, .71], topic1: [left, .72], memory1: [small ? .3 : .2, .38], speech: [small ? .32 : .22, .42] };
  let home = homes[sp.slot] || [left, .42]; if (ui.menu && sp.slot === 'recovery') home = [.47, .83];
  if (ui.scene === 'all' && sp.slot === 'water') home = [small ? .62 : .4, .09];
  if (['lens', 'weather', 'sound', 'rig'].includes(ui.scene)) { if (sp.slot === 'a') home = [left, .27]; if (sp.slot === 'b') home = [left, .465]; if (sp.slot === 'water') home = [left, .685]; }
  if (ui.scene === 'rig' && sp.slot === 'speech') home = [small ? .5 : .5, .5];
  return home;
}
function syncField() {
  if (!field) return; const descriptors = [], mobile = world.clientWidth < 701;
  for (const sp of specs) {
    const element = refs.get(sp.id); if (!element) continue; const [anchorX, anchorY] = homeFor(sp);
    const critical = !!sp.critical || /undo/.test(sp.id); element.classList.toggle('critical', critical); element.dataset.message = String(!sp.value && !sp.label && !!sp.note);
    let width = sp.kind === 'range' ? (mobile ? 116 : 145) : sp.value ? clamp(String(sp.value).length * 12 + 36, 78, mobile ? 132 : 175) : clamp(String(sp.label || sp.note || '').length * 7 + 36, 72, mobile ? 132 : 175);
    if (sp.id === 'place' || sp.id === 'time-current') width = mobile ? 145 : 195; if (sp.id === 'voice-current') width = mobile ? 150 : 210; if (sp.className?.includes('trace-drop')) width = mobile ? 185 : 240; if (sp.className?.includes('plate-detail')) width = mobile ? 215 : 300; if (sp.className?.includes('map-drop')) width = Math.min(world.clientWidth - 60, 420); element.style.width = width + 'px';
    if (sp.kind === 'range') { element.setAttribute('role', 'slider'); element.setAttribute('aria-label', sp.kicker); element.setAttribute('aria-valuemin', sp.min); element.setAttribute('aria-valuemax', sp.max); element.setAttribute('aria-valuenow', sp.number); element.setAttribute('aria-valuetext', sp.value); const input = element.querySelector('input'); input.tabIndex = -1; input.setAttribute('aria-hidden', 'true'); if (!sp.note) { const note = element.querySelector('.drop-note'); note.hidden = false; note.textContent = sp.id === 'time-current' ? 'pull sideways through time' : `pull up · ${sp.min} to ${sp.max}`; } }
    descriptors.push({ id: sp.id, element, anchorX, anchorY, viscosity: sp.viscosity || 1.5, role: sp.kind === 'button' ? 'action' : sp.kind, critical, label: [sp.kicker, sp.value || sp.label || sp.note].filter(Boolean).join(' · '), adjust: sp.kind === 'range' || !!sp.cycle || !!sp.flow || !!sp.carry || !!sp.keep });
  }
  const fixed = (id, anchorX, anchorY, extra = {}) => { const element = $(id); if (element && !element.hidden && element.getClientRects().length) descriptors.push({ id, element, anchorX, anchorY, role: 'action', viscosity: 1.7, label: [...element.querySelectorAll('.drop-label,.drop-value,.drop-note')].map(el => el.textContent.trim()).filter(Boolean).join(' · '), ...extra }); };
  if (!ui.menu) { fixed('steer', .2, .81, { critical: true, viscosity: .55 }); fixed('say-form', mobile ? .32 : .23, .43, { role: 'info', critical: true, viscosity: 4 }); }
  else { const entries = [...$('menu-stream').children], mob = world.clientWidth < 701, step = Math.min(.09, 66 / world.clientHeight), y0 = .56 - (entries.length - 1) * step / 2;   // one short column by the right thumb
    entries.forEach((element, i) => { if (element.hidden) return; descriptors.push({ id: element.id, element, role: 'action', viscosity: 2.3 + (i % 3) * .4, anchorX: mob ? .76 : .88, anchorY: y0 + i * step, label: element.textContent.trim(), adjust: /^menu-(camera|camera-lens|camera-expose)$/.test(element.id) }); }); }
  field.setMenuOpen(ui.menu); field.sync(descriptors);
  const stats = glass.getStats(); world.dataset.fluidRenderer = stats.renderer; world.dataset.fluidFrameMs = stats.cpuFrameMs; world.dataset.fluidTexture = stats.sourceReady ? 'ready' : stats.textureError || 'loading';
}

// ---- gestures the field does not own ---------------------------------------------------------------------------------
let drag = null;
function steerInput(x, y) { if (ui.past || ui.menu || ui.rest || ui.memory) return; B.act.steer(x, y, !!(x || y)); const b = $('steer').getBoundingClientRect(), r = Math.min(130, world.clientWidth * .23, world.clientHeight * .19), ox = b.x + b.width / 2, oy = b.y + b.height / 2; glass.setPointer({ x: ox + x * r, y: oy + y * r, dx: x * r, dy: y * r, active: !!(x || y) }); $('steer').style.setProperty('--pull-x', `${x * 26}px`); $('steer').style.setProperty('--pull-y', `${y * 26}px`); $('steer').classList.toggle('pinned', !!(x || y)); }
function stopSteer() { if (drag || $('steer').classList.contains('pinned')) B.act.steer(0, 0, false); drag = null; glass.setPointer({ x: 0, y: 0, dx: 0, dy: 0, active: false }); $('steer').classList.remove('pinned'); $('steer').style.setProperty('--pull-x', '0px'); $('steer').style.setProperty('--pull-y', '0px'); }
$('steer').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); const r = world.getBoundingClientRect(); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, range: Math.min(130, r.width * .23, r.height * .19) }; $('steer').setPointerCapture(e.pointerId); $('steer').classList.add('pinned'); });
$('steer').addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id) steerInput(clamp((e.clientX - drag.x) / drag.range, -1, 1), clamp((e.clientY - drag.y) / drag.range, -1, 1)); });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('steer').addEventListener(type, () => stopSteer());
// rubbing: a finger dragged across the world thins the wet words and traces under it (the same drag still turns the view)
let grab = null;
window.addEventListener('pointerdown', e => {
  if (e.target.closest?.('#rw .liquid,input,textarea,button,a,nav') || e.button > 0 || ui.menu || ui.past || ui.scene !== 'world') return;
  const w = sceneWaters().find(w => Math.hypot(e.clientX - w.x, e.clientY - w.y) < w.r + 26); if (!w) return;
  e.stopPropagation(); e.preventDefault(); grab = { id: e.pointerId, from: w, x0: e.clientX, y0: e.clientY, far: 0 }; held = w.id; seePtr(e); splash(w.x, w.y, .6);
}, true);
window.addEventListener('pointermove', e => { if (!grab || grab.id !== e.pointerId) return; e.stopPropagation(); e.preventDefault(); grab.far = Math.max(grab.far, Math.hypot(e.clientX - grab.x0, e.clientY - grab.y0)); }, true);
for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, e => { if (!grab || grab.id !== e.pointerId) return; e.stopPropagation();
  if (!(mix && endMix())) throwWater(grab.from.id, e.clientX, e.clientY, grab.far); held = null; mix = null; grab = null; }, true);
// water let go over open ground goes back into the scene: the can squirts where it was released
function throwWater(id, x, y, far) { if (kindOf(id) !== 'can' || far < 130 || S.water.liters < .05 || ui.past) return false; const it = menuItems().find(m => m.id === 'squirt'); if (!it) return false; it.run(); splash(x, y, 1.3); cause = 'Water thrown on the ground.'; return true; }
let rub = null;
window.addEventListener('pointerdown', e => { if (e.target.closest?.('#rw .liquid,input,textarea,button,a,nav') || e.button > 0 || ui.menu || ui.past) return; if (ui.open) { ui.open = null; render(); } if (ui.scene === 'map') splash(e.clientX, e.clientY, .55); rub = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; }, true);
window.addEventListener('pointermove', e => { if (!rub || rub.id !== e.pointerId) return; if (Math.hypot(e.clientX - rub.x, e.clientY - rub.y) > 8) rub.moved = true; if (rub.moved) { ink.rub(e.clientX, e.clientY, 25); field?.erodeAt?.(e.clientX, e.clientY, 25); } }, true);
for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, e => { if (rub?.id === e.pointerId) rub = null; }, true);
let swAt = 0;
$('menu-toggle').addEventListener('click', () => { if (performance.now() - swAt < 600) return; returnNow(false); stopSteer(); ui.menu = !ui.menu; ui.menuGroup = null; ui.menuTouch = performance.now(); render(); });
// Touch anything in the scene and the water shows what can be done with it, there, on the thing.
function thingsOnScreen() { const T = S.things || {}, W = world.clientWidth, H = world.clientHeight, on = t => t && t.front && t.x > 0 && t.x < W && t.y > 0 && t.y < H, out = [];
  if (on(T.donkey)) out.push({ kind: 'donkey', x: T.donkey.x, y: T.donkey.y - T.donkey.s * .2, r: clamp(T.donkey.s * 1.2, 26, 170), dist: T.donkey.dist });
  if (on(T.source)) out.push({ kind: 'source', x: T.source.x, y: T.source.y, r: clamp(T.source.s * 1.2, 26, 150), dist: T.source.dist });
  for (const p of T.people || []) if (on(p)) out.push({ kind: 'person', x: p.x, y: p.y + p.s * .9, r: clamp(p.s * 1.05, 26, 170), dist: p.dist });
  if (on(T.wagon)) out.push({ kind: 'wagon', x: T.wagon.x, y: T.wagon.y, r: clamp(T.wagon.s * 1.8, 26, 190), dist: T.wagon.dist });
  if (on(T.can)) out.push({ kind: 'me', x: T.can.x, y: T.can.y - T.can.s * .2, r: clamp(T.can.s * 1.0, 26, 170), dist: 0 });
  if (on(T.next)) out.push({ kind: 'next', x: T.next.x, y: T.next.y, r: 44, dist: T.next.dist });
  return out; }
function touchThing(x, y) {
  const hit = thingsOnScreen().map(t => ({ t, d: Math.hypot(x - t.x, y - t.y) - t.r })).filter(o => o.d < 18).sort((a, b) => (a.d + a.t.r) / a.t.r - (b.d + b.t.r) / b.t.r)[0];
  const kind = hit ? hit.t.kind : y < world.clientHeight * .24 ? 'sky' : 'ground';
  if (kind === 'ground') { for (let i = 0; i < 7; i++) SP.parts.push({ x: x + (Math.random() - .5) * 26, y, vx: (Math.random() - .5) * 30, vy: 40 + Math.random() * 60, r: 1.4 + Math.random() * 1.6, life: 0, ttl: .7 + Math.random() * .4, tone: '178,247,240' }); ui.touch = null; render(); return; }   // nothing to do here: the water runs off
  if (hit && hit.t.dist > 5 && /source|donkey|person|wagon/.test(kind)) { const W = world.clientWidth, H = world.clientHeight; SP.falls = SP.falls || []; for (let i = 1; i <= 3; i++) SP.falls.push({ x: W * .5 + (hit.t.x - W * .5) * i / 4, y: -20 - i * 120, ty: H * .86 + (hit.t.y - H * .86) * i / 4, v: 520, tone: '255,223,168' }); }   // too far to use: the rain marks the way
  ui.touch = { kind, x, y, at: performance.now() }; ui.open = null; splash(x, y, .7); render();
}
// A moment can be kept. Drag "Now" up off its line, or carry a camera drop out onto the glass, and a bead stays where you
// let go, holding that state: where you stood and how the lens was set. Touch the bead to be there again; carry it far to let it go.
const keeps = []; let keepN = 0, catchAt = null;
function addKeep(kind, x, y, extra = {}) {
  if (keeps.length >= 7) { const old = keeps.shift(); PIC.thumbs.delete(old.id); }
  const id = 'keep-' + (++keepN), L = S.lens, W = world.clientWidth, H = world.clientHeight, th = document.createElement('canvas'); th.width = th.height = PIC.TH;
  try { const r = Math.min(W, H) * (kind === 'lens' ? .2 : .46), k = B.canvas.width / W; th.getContext('2d').drawImage(B.canvas, (W / 2 - r) * k, (H / 2 - r) * k, r * 2 * k, r * 2 * k, 0, 0, PIC.TH, PIC.TH); th._ok = true; } catch { }
  PIC.thumbs.set(id, th);
  keeps.push({ id, kind, x: clamp(x / W, .14, .82), y: clamp(y / H, .13, .82), born: performance.now(), ttl: kind === 'act' ? 45000 : kind === 'back' ? 32000 : 150000, lens: { focus: L.focus, filter: L.filter, stop: L.stop, tilt: L.tilt }, pos: kind === 'moment' ? { ...S.pos } : null, before: extra.before || null, label: extra.label || (kind === 'lens' ? `${n(Math.min(100, L.focus))} m` : shortName(S.place.name)) });
  if (kind === 'lens' || kind === 'moment') { cause = kind === 'lens' ? 'A lens setting was kept.' : 'This moment was kept.'; announce(cause); splash(x, y, 1.3, '255,223,168'); } render();
}
function restoreKeep(k) { if (ui.past) return;
  if (k.before) { const here = snapNow(), T = S.things || {}, at = T.can && T.can.front ? [T.can.x, T.can.y - 70] : [world.clientWidth * .5, world.clientHeight * .5]; B.act.restore(k.before); dropKeep(k.id); S = B.state(); seen.liters = S.water.liters; stable = snapNow(); addKeep('back', at[0], at[1], { before: here, label: 'back' }); cause = `Back to ${n(k.before.liters)} L at ${shortName(k.before.place || '')}.`; announce(cause); return; }
  B.act.focus(k.lens.focus); B.act.set('filter', k.lens.filter); B.act.set('stop', k.lens.stop); B.act.set('tilt', k.lens.tilt); if (k.pos) B.act.warp(k.pos.x, k.pos.z, k.pos.yaw); cause = k.pos ? `Back at ${k.label}.` : `Lens back to ${k.label}.`; announce(cause); S = B.state(); render(); }
function dropKeep0(id) { const i = keeps.findIndex(k => k.id === id); if (i >= 0) { keeps.splice(i, 1); PIC.thumbs.delete(id); } }
function dropKeep(id) { const i = keeps.findIndex(k => k.id === id); if (i < 0) return; keeps.splice(i, 1); PIC.thumbs.delete(id); cause = 'Let go.'; render(); }
// the menu is left the way it was entered: touch the world to close it, swipe toward the edge to step back, swipe in from the edge to open
let sw = null;
window.addEventListener('pointerdown', e => { if (e.button > 0 || !S.ready) return; const onDrop = !!e.target.closest?.('#rw .liquid:not(#menu-toggle),input,textarea'); sw = { id: e.pointerId, t0: performance.now(), x: e.clientX, y: e.clientY, edge: e.clientX > world.clientWidth - 30, onDrop, done: false };
  if (ui.menu && !onDrop && !sw.edge) { sw.tapClose = true; } }, true);
window.addEventListener('pointermove', e => { if (!sw || sw.id !== e.pointerId || sw.done) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; if (Math.abs(dx) < 46 || Math.abs(dy) > Math.abs(dx)) return;
  if (ui.menu && dx > 0) { sw.done = true; swAt = performance.now(); sw.tapClose = false; if (ui.menuGroup) { ui.menuGroup = null; ui.menuAt = 0; ui.menuTouch = performance.now(); } else closeMenu(); render(); }
  else if (!ui.menu && sw.edge && dx < 0 && !ui.past) { sw.done = true; swAt = performance.now(); ui.menu = true; ui.menuGroup = null; ui.menuTouch = performance.now(); stopSteer(); render(); } }, true);
for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, e => { if (!sw || sw.id !== e.pointerId) return; if (sw.done) swAt = performance.now(); else if (!sw.onDrop && !sw.edge && !ui.menu && !ui.past && ui.scene === 'world' && !grab && performance.now() - sw.t0 < 380 && Math.hypot(e.clientX - sw.x, e.clientY - sw.y) < 12) touchThing(e.clientX, e.clientY); if (sw.tapClose && ui.menu && Math.hypot(e.clientX - sw.x, e.clientY - sw.y) < 14) { closeMenu(); swAt = performance.now(); render(); } sw = null; }, true);
$('say-form').addEventListener('submit', e => { e.preventDefault(); const text = $('say-text').value.trim(); if (!text || ui.past) return; B.act.say(text); ui.say = false; $('say-text').value = ''; render(); });
for (const type of ['keydown', 'keyup', 'keypress']) $('say-text').addEventListener(type, e => e.stopPropagation());
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.target.matches?.('input,textarea')) return; const k = e.key.toLowerCase();
  if (k === 'escape') { if (ui.past) returnNow(); else { Object.assign(ui, { menu: false, memory: false, say: false, rest: false }); render(); } return; }
  if (k === 'home' && ui.past) { e.preventDefault(); returnNow(); return; }
  if (k === 'u' && !ui.past && undo.length) { e.preventDefault(); doUndo(); }
});
window.addEventListener('blur', stopSteer);

// ink: words rest as a ghost and come clear when new, or when a finger or cursor passes near (a swipe draws them out)
const ptr = { x: -1e5, y: -1e5, at: -1e9, mouse: false };
const seePtr = e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.at = performance.now(); ptr.mouse = e.pointerType === 'mouse'; };
window.addEventListener('pointermove', seePtr, true); window.addEventListener('pointerdown', seePtr, true);
document.addEventListener('mouseleave', () => { ptr.at = -1e9; });
function inkTick(now, dt) {
  const bodies = new Map((field?.getBodies() || []).map(b => [b.id, b])), alive = ptr.mouse ? now - ptr.at < 60000 : now - ptr.at < 1400, k = Math.min(1, dt * 7);
  mixTick(bodies, dt);
  const one = (el, id, base, fresh) => {
    const b = bodies.get(id); let near = 0;
    if (b && alive) { const d = Math.hypot(ptr.x - b.x, ptr.y - b.y) - Math.max(b.rx || 40, b.ry || 30); near = clamp(1 - d / 120, 0, 1); near *= near; }
    const caught = el.dataset.rainCaught === 'true' || el.classList.contains('pinned') || el === document.activeElement ? 1 : 0;
    const target = Math.max(base, near, fresh, caught); el._ink = (el._ink ?? base) + (target - (el._ink ?? base)) * k;
    el.style.setProperty('--ink', el._ink.toFixed(3)); el.style.setProperty('--ink2', clamp((el._ink - .5) / .5, 0, 1).toFixed(3));
  };
  for (const [id, el] of refs) { const sp = el._spec || {}, cls = sp.className || '';
    const base = /alert/.test(cls) ? 1 : id === 'time-current' ? .16 : /quick/.test(cls) ? .42 : /stop-drop/.test(cls) ? .3 : /action-drop/.test(cls) || sp.critical ? .58 : sp.slot === 'title' ? .3 : .14;
    one(el, id, base, clamp(1 - (now - (el._fresh || 0) - 2200) / 1200, 0, 1)); }
  const t = $('menu-toggle'); let near = 0; if (alive) { near = clamp(1 - (world.clientWidth - ptr.x - 30) / 110, 0, 1); }
  t._ink = (t._ink ?? .3) + (Math.max(.3, near, ui.menu ? 1 : 0) - (t._ink ?? .3)) * k; t.style.setProperty('--ink', t._ink.toFixed(3));
  const st = $('steer'); if (!st.hidden) one(st, 'steer', .14, 0);
}
// ---- a drop is what it does ---------------------------------------------------------------------------------------------
// Each drop carries a small live view of the thing it acts on, lifted from the scene itself: the wagon drop shows the
// wagon, the lens drop shows what the lens sees, the donkey drop the donkey. A view is kept when its subject leaves the
// frame, so the drop still shows it. A drop that opens into more trails a string of smaller beads.
const PIC = { cv: document.createElement('canvas'), snap: document.createElement('canvas'), at: 0, thumbs: new Map(), TH: 112 };
PIC.cv.id = 'rw-pic'; PIC.cv.setAttribute('aria-hidden', 'true'); Object.assign(PIC.cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '4', pointerEvents: 'none' }); world.append(PIC.cv);
function subjectOf(id) {                                              // -> { x, y, r } source circle on screen, or { img }, or null
  const T = S.things || {}, W = world.clientWidth, H = world.clientHeight, on = t => t && t.front && t.x > -40 && t.x < W + 40 && t.y > -40 && t.y < H + 40;
  const k = id.replace(/^menu-/, '').replace(/^(go|water|camera|talk|more)-/, '').replace(/^act-|^it-|^all-/, '');
  const me = T.can, sky = { x: W * .5, y: H * .13, r: 74 }, eye = { x: W * .5, y: H * .5, r: clamp(128 - Math.min(100, S.lens.focus) * .9, 34, 120) };
  const donkey = on(T.donkey) ? { x: T.donkey.x, y: T.donkey.y - T.donkey.s * .2, r: clamp(T.donkey.s * 1.25, 16, 150) } : null;
  const can = on(me) ? { x: me.x + me.s * .22, y: me.y + me.s * .1, r: clamp(me.s * .48, 12, 90) } : null, feet = on(me) ? { x: me.x, y: me.y + me.s * .62, r: clamp(me.s * .62, 14, 110) } : null, self = on(me) ? { x: me.x, y: me.y - me.s * .25, r: clamp(me.s * 1.05, 18, 150) } : null;
  const person = (T.people || []).find(on), face = person ? { x: person.x, y: person.y + person.s * .22, r: clamp(person.s * .42, 12, 90) } : null;
  const next = on(T.next) ? { x: T.next.x, y: T.next.y, r: clamp(T.next.s * 7, 22, 120) } : null, source = on(T.source) ? { x: T.source.x, y: T.source.y, r: clamp(T.source.s * 1.1, 14, 130) } : null, wagon = on(T.wagon) ? { x: T.wagon.x, y: T.wagon.y, r: clamp(T.wagon.s * 1.7, 16, 160) } : null;
  switch (k) {
    case 'go': case 'next': case 'route': return next; case 'map': return { img: 'map' }; case 'jump': case 'run': return feet; case 'ride': case 'donkey': return donkey; case 'glide': case 'weather': case 'more': case 'hold': return sky;
    case 'drive': return wagon; case 'water': case 'can': case 'squirt': case 'throw': return can; case 'camera': case 'lens': case 'expose': case 'focus': return eye; case 'cam': case 'all': return { x: W * .5, y: H * .5, r: Math.min(W, H) * .48 };
    case 'rig': case 'sync': case 'plates': return eye; case 'talk': case 'say': case 'people': case 'memory': case 'lang': case 'voice': return face || self; case 'rest': case 'here': return self; case 'sound': case 'tape': case 'radio': return face || sky; default: return null;
  }
}
const PRE = ['menu-go', 'menu-water', 'menu-camera', 'menu-talk', 'menu-more', 'menu-go-ride', 'menu-go-drive', 'menu-go-jump', 'menu-go-run', 'menu-go-glide', 'menu-water-can', 'menu-water-donkey', 'menu-water-squirt', 'menu-water-throw', 'menu-talk-say', 'menu-talk-memory', 'menu-talk-people', 'menu-talk-lang', 'act-ride', 'act-jump', 'act-run', 'act-glide', 'can', 'next'];
const HAS_MORE = /^menu-(go|water|camera|talk|more)$|^menu-[a-z]+-(map|can|donkey|lens|rig|people|sound|weather|all)$/;
function picTick(now) {
  const W = world.clientWidth, H = world.clientHeight, dpr = Math.min(2, devicePixelRatio || 1), cv = PIC.cv; if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'), bodies = (field?.getBodies() || []).filter(b => /^menu-(?!spring|edge)|^act-|^can$|^next$|^it-|^all-|^keep-|^aff-/.test(b.id));
  if (S.ready && !ui.past && now - (PIC.pre || 0) > 900) { PIC.pre = now;      // keep a view of every subject while it is in frame, so its drop can show it later
    const W2 = Math.round(W * .6), H2 = Math.round(H * .6); if (PIC.snap.width !== W2 || PIC.snap.height !== H2) { PIC.snap.width = W2; PIC.snap.height = H2; } let shot = false;
    for (const id of PRE) { if (bodies.some(b => b.id === id)) continue; const src = subjectOf(id); if (!src || src.img) continue; if (!shot) { try { PIC.snap.getContext('2d').drawImage(B.canvas, 0, 0, W2, H2); } catch { } shot = true; }
      let th = PIC.thumbs.get(id); if (!th) { th = document.createElement('canvas'); th.width = th.height = PIC.TH; PIC.thumbs.set(id, th); } const k = W2 / W; th.getContext('2d').drawImage(PIC.snap, (src.x - src.r) * k, (src.y - src.r) * k, src.r * 2 * k, src.r * 2 * k, 0, 0, PIC.TH, PIC.TH); th._ok = true; } }
  if (!S.ready || ui.past || !bodies.length) { if (PIC.dirty) { g.clearRect(0, 0, cv.width, cv.height); PIC.dirty = false; } return; }
  if (now - PIC.at > 110) { PIC.at = now; const sw = Math.round(W * .6), sh = Math.round(H * .6); if (PIC.snap.width !== sw || PIC.snap.height !== sh) { PIC.snap.width = sw; PIC.snap.height = sh; }
    try { PIC.snap.getContext('2d').drawImage(B.canvas, 0, 0, sw, sh); } catch { }
    for (const b of bodies) { const src = subjectOf(b.id); if (!src) continue; let th = PIC.thumbs.get(b.id); if (!th) { th = document.createElement('canvas'); th.width = th.height = PIC.TH; PIC.thumbs.set(b.id, th); }
      const tg = th.getContext('2d'), k = PIC.snap.width / W;
      if (src.img === 'map') { const im = drawMap.c; if (im) tg.drawImage(im, 0, 0, im.width, im.height, 0, 0, PIC.TH, PIC.TH); th._ok = true; continue; }
      tg.drawImage(PIC.snap, (src.x - src.r) * k, (src.y - src.r) * k, src.r * 2 * k, src.r * 2 * k, 0, 0, PIC.TH, PIC.TH); th._ok = true; } }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); PIC.dirty = true;
  for (const b of bodies) { const th = PIC.thumbs.get(b.id), has = th && th._ok; if (!has && !b.id.startsWith('menu-')) continue; const menu = b.id.startsWith('menu-'), R = menu ? 27 : clamp(Math.min(b.rx || 30, b.ry || 26) * .62, 15, 26), x = menu ? b.x + 34 : b.x, y = b.y + (menu ? 0 : -1), wob = Math.sin(now / 900 + x) * 1.2;
    g.save(); g.beginPath(); g.ellipse(x, y, R + wob * .4, R * 1.05 - wob * .4, 0, 0, 7); g.clip(); g.globalAlpha = .94; if (has) g.drawImage(th, x - R * 1.12, y - R * 1.12, R * 2.24, R * 2.24); else { g.fillStyle = 'rgba(150,225,235,.10)'; g.fillRect(x - R * 1.2, y - R * 1.2, R * 2.4, R * 2.4); }
    const sh = g.createRadialGradient(x - R * .35, y - R * .42, R * .1, x, y, R * 1.1); sh.addColorStop(0, 'rgba(255,255,255,.34)'); sh.addColorStop(.28, 'rgba(255,255,255,0)'); sh.addColorStop(.78, 'rgba(4,20,28,0)'); sh.addColorStop(1, 'rgba(4,20,28,.62)'); g.globalAlpha = 1; g.fillStyle = sh; g.fillRect(x - R * 1.2, y - R * 1.2, R * 2.4, R * 2.4); g.restore();
    g.shadowColor = 'rgba(200,248,250,.5)'; g.shadowBlur = 8; g.lineWidth = 2; g.strokeStyle = 'rgba(214,250,250,.10)'; g.beginPath(); g.ellipse(x, y, R + wob * .4, R * 1.05 - wob * .4, 0, 0, 7); g.stroke(); g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(x - R * .42, y - R * .5, R * .16, R * .08, -.6, 0, 7); g.fill();
    if (HAS_MORE.test(b.id)) { for (let i = 0; i < 3; i++) { const yy = y + R * 1.05 + 5 + i * 8, rr = 3.6 - i * .9; g.beginPath(); g.arc(x + Math.sin(now / 700 + i) * 1.5, yy, rr, 0, 7); g.fillStyle = 'rgba(190,240,245,.42)'; g.fill(); g.lineWidth = 1; g.strokeStyle = 'rgba(214,250,250,.75)'; g.stroke(); } }
  }
}
// ---- one membrane ------------------------------------------------------------------------------------------------------
// Every body of water on the glass (drops, the scene's water showing through, a carried blob and its strand, flying
// splash) is summed into one field and contoured with marching squares, so near bodies neck together and merge as one skin.
const MS = { cv: document.createElement('canvas'), low: document.createElement('canvas'), F: null, trail: [] };
MS.cv.id = 'rw-ms'; MS.cv.setAttribute('aria-hidden', 'true'); Object.assign(MS.cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '4', pointerEvents: 'none' }); world.append(MS.cv);
function msTick(now, dt) {
  const W = world.clientWidth, H = world.clientHeight, dpr = Math.min(2, devicePixelRatio || 1), cv = MS.cv, cell = W < 700 ? 6 : 9, cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  if (!MS.F || MS.F.length !== cols * rows) { MS.F = new Float32Array(cols * rows); MS.low.width = cols; MS.low.height = rows; MS.img = MS.low.getContext('2d').createImageData(cols, rows); }
  const g = cv.getContext('2d'), F = MS.F, src = [];
  if (S.ready && !ui.past) {
    for (const b of field?.getBodies() || []) { if (/^menu-|^time-current$/.test(b.id)) continue; src.push([b.x, b.y, Math.max(12, (b.rx || 30) * .56), Math.max(10, (b.ry || 24) * .56)]); }
    for (const w of sceneWaters()) src.push([w.x, w.y, w.r, w.r]);
    const carrying = held && now - ptr.at < 4000;
    if (carrying) { src.push([ptr.x, ptr.y, 21, 21]); const last = MS.trail.at(-1); if (!last || Math.hypot(last[0] - ptr.x, last[1] - ptr.y) > 14) MS.trail.push([ptr.x, ptr.y, 1]); }
    for (const t of MS.trail) { t[2] -= dt * (carrying ? .55 : 1.6); if (t[2] > 0) src.push([t[0], t[1], 4 + t[2] * 9, 4 + t[2] * 9]); } MS.trail = MS.trail.filter(t => t[2] > 0).slice(-40);
    if (worm) { const pull = worm.end ? clamp((now - worm.end) / 600, 0, 1) : 0; src.push([worm.root[0], worm.root[1], 20, 20]); worm.segs.forEach((q, i) => src.push([worm.root[0] + Math.sin(now / 600 + i * .8) * 6 * (1 - pull), worm.root[1] + (i + 1) * 40 * (1 - pull), i === worm.segs.length - 1 && !worm.end ? 15 + Math.sin(now / 120) * 2 : 13, 13])); }
    for (const p of SP.parts) { const a = 1 - p.life / p.ttl; if (a > 0) src.push([p.x, p.y, 3 + p.r * 2.2 * a, 3 + p.r * 2.2 * a]); }
  }
  if (!src.length) { if (MS.dirty) { g.clearRect(0, 0, cv.width, cv.height); MS.dirty = false; } return; }
  F.fill(0);
  for (const [x, y, rx, ry] of src) { const c0 = Math.max(0, Math.floor((x - rx * 3) / cell)), c1 = Math.min(cols - 1, Math.ceil((x + rx * 3) / cell)), r0 = Math.max(0, Math.floor((y - ry * 3) / cell)), r1 = Math.min(rows - 1, Math.ceil((y + ry * 3) / cell));
    for (let r = r0; r <= r1; r++) { const dy = (r * cell - y) / ry, dy2 = dy * dy; for (let c = c0; c <= c1; c++) { const dx = (c * cell - x) / rx, d2 = dx * dx + dy2; if (d2 < 9) F[r * cols + c] += 1 / (d2 + .06) - .11; } } }
  const d = MS.img.data; for (let i = 0; i < F.length; i++) { const t = clamp((F[i] - .7) / .7, 0, 1), a = t * t * (3 - 2 * t); d[i * 4] = 150; d[i * 4 + 1] = 228; d[i * 4 + 2] = 236; d[i * 4 + 3] = a * 46; }
  MS.low.getContext('2d').putImageData(MS.img, 0, 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = true; g.drawImage(MS.low, -cell / 2, -cell / 2, cols * cell, rows * cell); MS.dirty = true;
  const T = 1, lerp = (a, b) => (T - a) / (b - a); g.beginPath();
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const i = r * cols + c, a = F[i], b = F[i + 1], cc = F[i + cols + 1], dd = F[i + cols], k = (a > T ? 8 : 0) | (b > T ? 4 : 0) | (cc > T ? 2 : 0) | (dd > T ? 1 : 0); if (k === 0 || k === 15) continue;
    const x = c * cell, y = r * cell, top = [x + lerp(a, b) * cell, y], right = [x + cell, y + lerp(b, cc) * cell], bottom = [x + lerp(dd, cc) * cell, y + cell], left = [x, y + lerp(a, dd) * cell];
    const seg = (p, q) => { g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); };
    switch (k) { case 1: case 14: seg(left, bottom); break; case 2: case 13: seg(bottom, right); break; case 3: case 12: seg(left, right); break; case 4: case 11: seg(top, right); break; case 6: case 9: seg(top, bottom); break; case 7: case 8: seg(top, left); break; case 5: seg(top, left); seg(bottom, right); break; case 10: seg(top, right); seg(left, bottom); break; }
  }
  g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = 'rgba(200,248,250,.55)'; g.shadowBlur = 7; g.lineWidth = 2.2; g.strokeStyle = 'rgba(206,250,250,.07)'; g.stroke(); g.shadowBlur = 0;   // a soft meniscus glow, never a drawn outline
}
// ---- splash -------------------------------------------------------------------------------------------------------------
// Water answers a touch: a crown of droplets thrown up and falling back, and rings running out across the glass.
const SP = { cv: document.createElement('canvas'), parts: [], rings: [] };
SP.cv.id = 'rw-splash'; SP.cv.setAttribute('aria-hidden', 'true'); Object.assign(SP.cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '8', pointerEvents: 'none' }); world.append(SP.cv);
function splash(x, y, k = 1, tone = '178,247,240') {
  if (ui.reduced) { glass.burst(x, y, 'water'); return; }
  for (let i = 0; i < 3; i++) SP.rings.push({ x, y, r: 4 + i * 5, v: (210 - i * 55) * k, a: .85 - i * .2, tone, w: 2.6 - i * .6 });
  const count = Math.round(12 + 10 * k); for (let i = 0; i < count; i++) { const a = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.25, sp = (150 + Math.random() * 260) * k; SP.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1.2 + Math.random() * 2.6, life: 0, ttl: .55 + Math.random() * .5, tone }); }
  glass.burst(x, y, 'water'); if (navigator.vibrate && k > 1) { try { navigator.vibrate(8); } catch { } }
}
function guideTick(now) {                                             // it rains on the one thing that matters most now, harder when it matters more
  if (ui.reduced || ui.menu || ui.past || ui.scene !== 'world' || !S.ready || S.busy) return; const w = S.water, T = S.things || {}, W = world.clientWidth, H = world.clientHeight;
  const need = w.donkeyDown ? ['donkey', 10] : w.donkey < .3 && w.liters > .5 ? ['donkey', 6] : w.liters < 1 ? ['source', 5] : T.next ? ['next', 2] : null; if (!need) return;
  if (now - (SP.guideAt || 0) < 3600 / need[1] * (.8 + Math.random() * .4)) return; SP.guideAt = now; const t = T[need[0]]; if (!t) return; if (S.live && need[0] !== 'next' && Math.hypot((S.live.x || 0) - t.x, (S.live.y || 0) - t.y) < 60 && need[1] < 10) return;   // already under your hand
  SP.falls = SP.falls || []; const on = t.front && t.x > 20 && t.x < W - 20, count = need[1] >= 10 ? 3 : 1;
  for (let i = 0; i < count; i++) { if (on) SP.falls.push({ x: t.x + (Math.random() - .5) * 40, y: -20 - i * 60, ty: clamp(t.y, 40, H - 40), v: 520, tone: '255,223,168' }); else { const left = !t.front ? t.x > W / 2 : t.x < W / 2; SP.falls.push({ x: left ? 12 + Math.random() * 60 : W - 12 - Math.random() * 60, y: H * .08 - i * 50, ty: H * (.5 + Math.random() * .25), v: 480, vx: left ? -140 : 140, tone: '255,223,168' }); } }
}
function splashTick(dt) {
  guideTick(performance.now());
  if (SP.falls && SP.falls.length) { for (const f of SP.falls) { f.v += 1500 * dt; f.y += f.v * dt; f.x += (f.vx || 0) * dt; if (f.y >= f.ty && !f.done) { f.done = true; splash(f.x, f.ty, .45, f.tone || '178,247,240'); } } }
  const W = world.clientWidth, H = world.clientHeight, dpr = Math.min(2, devicePixelRatio || 1), cv = SP.cv; if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); if (!SP.parts.length && !SP.rings.length && !(SP.falls && SP.falls.length) && !worm) { if (SP.dirty) { g.clearRect(0, 0, cv.width, cv.height); SP.dirty = false; } return; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.lineCap = 'round'; SP.dirty = true;
  for (const r of SP.rings) { r.r += r.v * dt; r.v *= Math.pow(.05, dt); r.a -= dt * 1.25; if (r.a <= 0) continue; g.strokeStyle = `rgba(${r.tone},${r.a})`; g.lineWidth = r.w; g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * .42, 0, 0, 7); g.stroke(); }
  for (const p of SP.parts) { p.life += dt; p.vy += 1150 * dt; p.x += p.vx * dt; p.y += p.vy * dt; const a = 1 - p.life / p.ttl; if (a <= 0) continue; g.strokeStyle = `rgba(${p.tone},${a * .9})`; g.lineWidth = p.r * 2; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * .022, p.y - p.vy * .022); g.stroke(); g.fillStyle = `rgba(255,255,255,${a * .7})`; g.beginPath(); g.arc(p.x - p.r * .3, p.y - p.r * .3, p.r * .45, 0, 7); g.fill(); }
  if (worm) { const pull = worm.end ? clamp((performance.now() - worm.end) / 600, 0, 1) : 0; g.font = "italic 13px Georgia,serif"; g.textAlign = 'center'; worm.segs.forEach((q, i) => { const y = worm.root[1] + (i + 1) * 40 * (1 - pull); g.fillStyle = `rgba(238,246,242,${1 - pull})`; g.fillText(n(q.l), worm.root[0] + Math.sin(performance.now() / 600 + i * .8) * 6 * (1 - pull), y + 4); }); }
  if (SP.falls) { for (const f of SP.falls) if (!f.done) { g.strokeStyle = `rgba(${f.tone || '200,248,250'},.8)`; g.lineWidth = 2.2; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x - (f.vx || 0) * .05, f.y - Math.min(46, f.v * .05)); g.stroke(); } SP.falls = SP.falls.filter(f => !f.done); }
  SP.rings = SP.rings.filter(r => r.a > 0); SP.parts = SP.parts.filter(p => p.life < p.ttl && p.y < H + 20);
}
// ---- the text field ----------------------------------------------------------------------------------------------------
// One paragraph of thick description for where you are, typeset by Pretext line by line so it flows around every drop on
// the glass. It is never simply shown: it lies dry and invisible, and is read only where a finger or a pulled trail has
// wetted the glass, drying again behind it (the lantern/spotlight idea from pretext-field, with water for light).
const TF = { cv: document.createElement('canvas'), mask: document.createElement('canvas'), wet: 0, text: '', prep: null, font: "italic 17px 'Iowan Old Style','Palatino Linotype',Georgia,serif", lh: 25, ready: false, lx: null, ly: null };
TF.cv.id = 'rw-text'; TF.cv.setAttribute('aria-hidden', 'true'); Object.assign(TF.cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '5', pointerEvents: 'none' }); world.append(TF.cv);
{ const sc = document.createElement('script'); sc.src = './rain/pretext.js?v=1'; sc.onload = () => { TF.ready = !!window.Pretext; }; document.head.append(sc); }
function fieldText() {
  if (ui.past) { const v = memory.view(), sn = v.snapshot || {}; return `Earlier, ${n(ui.timeAge)} seconds ago. ${sn.place || S.place.name}. ${n(sn.can ?? S.water.liters)} litres in the can. ${v.event?.label || 'The surface was still.'} Looking back changes nothing.`; }
  const T = S.things || {}, W = world.clientWidth, parts = [describe('place'), describe('can')], m = v => Math.round(v);
  const way = t => !t.front ? 'behind you' : t.x < W * .33 ? 'to your left' : t.x > W * .67 ? 'to your right' : 'ahead';
  if (S.live) parts.push(describe('primary')); if (T.donkey && S.mode === 'walk') parts.push(describe('donkey')); if (T.next) parts.push(describe('next'));
  for (const p of T.people || []) parts.push(`${p.name} is ${m(p.dist)} m ${way(p)}.`);
  if (S.exit) parts.push(describe('exit')); parts.push(cause);
  for (const l of memory.transcript().slice(-2)) parts.push(`${l.speaker}: “${l.text}”`);
  if (undo.length) parts.push(`Undo holds ${undo.at(-1).label}.`);
  parts.push('Pull a drop to open it. Carry one drop into another and they mix.');
  return parts.filter(Boolean).join(' ').replace(/\b(\d+) m\b/g, (_, d) => `${Math.round(d / 5) * 5 || d} m`);   // coarse distances keep the paragraph from re-setting every step
}
function stamp(x, y, r, a) { const g = TF.mask.getContext('2d'), k = TF.mask.width / world.clientWidth, gr = g.createRadialGradient(x * k, y * k, 0, x * k, y * k, r * k); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.62, `rgba(255,255,255,${a * .85})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x * k, y * k, r * k, 0, 7); g.fill(); TF.wet = performance.now(); }
function wetAt(e) { return;                                                   // every pointer move wets the glass under it; a held drop wets wider
  if (ui.menu || !S.ready || !TF.mask.width || !held) { TF.lx = null; return; } const x = e.clientX, y = e.clientY, now = performance.now();
  if (TF.lx != null && now - TF.lt < 500 && Math.hypot(x - TF.lx, y - TF.ly) < 260) { const steps = Math.max(1, Math.ceil(Math.hypot(x - TF.lx, y - TF.ly) / 28)); for (let i = 1; i <= steps; i++) stamp(TF.lx + (x - TF.lx) * i / steps, TF.ly + (y - TF.ly) * i / steps, held ? 125 : 96, 1); } else stamp(x, y, 96, 1);
  TF.lx = x; TF.ly = y; TF.lt = now;
}
window.addEventListener('pointermove', wetAt, true); window.addEventListener('pointerdown', wetAt, true);
function textTick(now, dt) {
  const W = world.clientWidth, H = world.clientHeight, dpr = Math.min(2, devicePixelRatio || 1), cv = TF.cv, mk = TF.mask;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); mk.width = Math.round(W / 3); mk.height = Math.round(H / 3); }
  const g = cv.getContext('2d'); if (now - TF.wet > 7000 || !TF.ready || !S.ready || ui.scene === 'map' || ui.menu) { if (TF.drawn) { g.clearRect(0, 0, cv.width, cv.height); TF.drawn = false; } return; }
  { const mg = mk.getContext('2d'); mg.globalCompositeOperation = 'destination-out'; mg.fillStyle = `rgba(0,0,0,${Math.min(.5, dt * (.1 + weather.erosion * .5))})`; mg.fillRect(0, 0, mk.width, mk.height); mg.globalCompositeOperation = 'source-over'; }
  if (!TF.at || now - TF.at > 700) { TF.at = now; const t = fieldText(); if (t !== TF.text) { TF.text = t; TF.prep = window.Pretext.prepareWithSegments(t, TF.font); } }
  if (!TF.prep) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H); g.font = TF.font; g.textBaseline = 'alphabetic'; g.fillStyle = ui.past ? '#ffdfa8' : '#e6f1ec'; g.shadowColor = 'rgba(2,14,20,.95)'; g.shadowBlur = 6; g.lineWidth = 3; g.strokeStyle = 'rgba(2,14,20,.55)';
  const obs = (field?.getBodies() || []).filter(b => !/^menu-/.test(b.id)).map(b => ({ x: b.x, y: b.y, rx: (b.rx || 40) + 14, ry: (b.ry || 30) + 12 }));
  obs.push({ x: W / 2, y: H * .62, rx: W * .11, ry: H * .15 });                                     // the traveller keeps a clear body
  let cur = { segmentIndex: 0, graphemeIndex: 0 }, done = false; const x0 = 20, x1 = W - 54;
  for (let y = H * .14; y < H * .9 && !done; y += TF.lh) {
    let spans = [[x0, x1]];
    for (const o of obs) { const dy = (y - TF.lh * .35 - o.y) / o.ry; if (Math.abs(dy) >= 1) continue; const hw = o.rx * Math.sqrt(1 - dy * dy), a = o.x - hw, b = o.x + hw; spans = spans.flatMap(([s, e]) => b <= s || a >= e ? [[s, e]] : [[s, Math.min(e, a)], [Math.max(s, b), e]].filter(([p, q]) => q - p > 0)); }
    spans.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0])); spans.length = Math.min(1, spans.length);   // one run of words per line: the widest dry gap, so a sentence is never read across a drop
    for (const [s, e] of spans) { if (e - s < 84) continue; const line = window.Pretext.layoutNextLine(TF.prep, cur, e - s); if (!line) { done = true; break; } g.strokeText(line.text, s, y); g.fillText(line.text, s, y); cur = line.end; }
  }
  g.shadowBlur = 0; g.globalCompositeOperation = 'destination-in'; g.imageSmoothingEnabled = true; g.drawImage(mk, 0, 0, W, H); g.globalCompositeOperation = 'source-over'; TF.drawn = true;
}
function tick(now) {
  const dt = Math.min(.15, Math.max(0, (now - frameTime) / 1000)); frameTime = now;
  if (!document.hidden) {
    if (!ui.past) { memory.tick(dt); ui.recordClock += dt; if (ui.recordClock >= .25) { S = B.state(); if (S.ready) { watchGame(); captureWeather(); } ui.recordClock = 0; } }
    autoTick(dt); field?.tick(dt); inkTick(now, dt); try { picTick(now); } catch (err) { if (!PIC.err) { PIC.err = true; console.error('[rain] pictures', err); } } splashTick(dt); try { msTick(now, dt); } catch (err) { if (!MS.err) { MS.err = true; console.error('[rain] membrane', err); } } try { textTick(now, dt); } catch (err) { if (!TF.err) { TF.err = true; console.error('[rain] text field', err); } } ink.tick(ui.past ? 0 : dt); ink.setTrails(field?.getTrails() || []);
    world.dataset.timeMode = ui.past ? 'past' : 'now'; world.dataset.timeAge = n(ui.timeAge);
    if (now - lastRender > 180) { render(); lastRender = now; }
  }
  requestAnimationFrame(tick);
}
new ResizeObserver(() => syncField()).observe(world);
initializeField(); render(); requestAnimationFrame(tick);
window.__rainSurface = { alertNow, doAlert, get auto() { return auto; }, get worm() { return worm; }, endMix, keeps, touchThing, thingsOnScreen, PIC, subjectOf, MS, sceneWaters, get held() { return held; }, get mix() { return mix; }, SP, splash, TF, stamp, fieldText, ui, weather, glass, memory, ink, render, get field() { return field; }, get specs() { return specs; }, get undo() { return undo; }, setTimeAge, returnNow, go: s => go(s)() };
}
boot();
})();
