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
const ui = { menu: false, scene: 'world', past: false, timeAge: 0, words: false, details: false, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, memory: false, rest: false, say: false, recallIndex: 0, recordClock: 0, voiceId: null, voiceUntil: 0, flowHeld: false };
const weather = { material: 'worms', erosion: .32, rain: .55 };
const memory = createWeatherMemory({ windowSeconds: 12, maxEvents: 160, maxUtterances: 20, erosion: weather.erosion });
const ink = createTraceInk({ host: world });
const glass = createFluidGlass($('fluid'), { image: () => B.canvas, reducedMotion: ui.reduced, historyFrames: 48, position: { x: .5, y: .5 } });
let field = null, specs = [], refs = new Map(), S = B.state(), frameTime = performance.now(), lastRender = 0, pendingFocus = null, cause = 'The surface was still.', seen = { liters: null, place: null, speech: 0, said: 0 }, mapImage = '', mapAt = 0;
const pulls = new Map(), caughtVoices = new Map(), undo = [];
const svgNS = 'http://www.w3.org/2000/svg', menuInk = document.createElementNS(svgNS, 'svg'); menuInk.id = 'menu-ink'; menuInk.setAttribute('aria-hidden', 'true'); world.append(menuInk);
let menuWater = [];

const add = spec => specs.push(spec);
const info = (id, slot, kicker, value, note = '', extra = {}) => add({ id, slot, kicker, value, note, kind: 'info', ...extra });
const button = (id, slot, label, note, action, extra = {}) => add({ id, slot, label, note, action, kind: 'button', ...extra });
const range = (id, slot, kicker, value, min, max, step, number, action, extra = {}) => add({ id, slot, kicker, value, min, max, step, number, action, kind: 'range', ...extra });
const live = fn => (...a) => { if (ui.past) { announce('Return to now to act.'); return; } const r = fn(...a); S = B.state(); render(); return r; };
const menuItems = () => { try { return B.menu(); } catch { return []; } };
function item(id, slot, viscosity = 2, extra = {}) { const it = menuItems().find(x => x.id === id); if (!it) return; button('it-' + id, slot, null, null, live(() => it.run()), { kicker: it.label, value: it.value || (it.on ? 'on' : 'off'), viscosity, ...extra }); }

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
function timeDrop() { if (ui.menu) return; range('time-current', 'time', 'Time', ui.past ? `${n(ui.timeAge)} seconds ago` : 'Now', 0, 12, .1, ui.timeAge, setTimeAge, { critical: true, viscosity: 5, className: 'time-current', note: ui.past ? 'Read only. Pull right to now.' : 'Pull left through the last twelve seconds.' }); }
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
function watchGame() {
  const w = S.water, sp = S.speech;
  if (seen.liters !== null && Math.abs(w.liters - seen.liters) > .05) { cause = w.liters > seen.liters ? `Water arrived. ${n(w.liters)} L in the can.` : `Water given. ${n(w.liters)} L left.`; glass.burst(world.clientWidth * .5, world.clientHeight * .62, 'water'); announce(cause); }
  seen.liters = w.liters;
  if (seen.place !== null && S.place.name !== seen.place) cause = `Reached ${S.place.name}.`;
  seen.place = S.place.name;
  if (S.said && S.said.seq !== seen.said) { seen.said = S.said.seq; memory.recordDialogue({ key: 'you-' + S.said.seq, speaker: 'You', text: S.said.text }); }
  if (sp && sp.seq !== seen.speech) { seen.speech = sp.seq; const line = memory.recordDialogue({ key: 'v-' + sp.seq, speaker: sp.name, text: sp.spoken || sp.text }); ui.voiceId = line?.id; ui.voiceUntil = performance.now() + (sp.dur || 4) * 1000 + 9000; cause = `${sp.name} spoke.`; }
}
function currentVoice() { if (!ui.voiceId) return null; const held = caughtVoices.size > 0; if (!held && performance.now() > ui.voiceUntil && ui.scene !== 'people') return null; return memory.projectDialogue(ui.voiceId); }
function voiceHome() { const sp = S.speech; if (!sp || sp.x == null) return null; return [clamp(sp.x / world.clientWidth, .2, .78), clamp(sp.y / world.clientHeight - .07, .16, .6)]; }

// ---- what is true now, as drops ------------------------------------------------------------------------------------
const TITLES = { world: null, lens: 'The lens', donkey: 'The donkey', water: 'Shared water', people: 'A voice beside you', rig: 'The camera', map: 'The way', sound: 'Listen here', weather: 'Living world' };
const MODE = { walk: 'On foot', ride: 'Riding', drive: 'Driving', glide: 'In the air' };
function pushUndo(label, restore) { undo.push({ label, restore }); if (undo.length > 12) undo.shift(); }
function doUndo() { if (ui.past) return; const u = undo.pop(); if (!u) return; u.restore(); S = B.state(); cause = `Restored ${u.label}.`; announce(cause); glass.burst(world.clientWidth * .5, world.clientHeight * .6, 'amber'); render(); }
function liveDrop(slot = 'primary') {
  const L = S.live; if (!L || S.busy) return false;
  const home = L.x != null && ui.scene === 'world' ? [clamp(L.x / world.clientWidth, .16, .84), clamp(L.y / world.clientHeight, .2, .78)] : null;
  const note = L.kind === 'draw' ? 'from the source to your can' : L.kind === 'give' ? 'pour from your can' : 'pull their voice';
  button('primary', slot, L.label + (L.delta ? ` ${n(Math.abs(L.delta))} L` : ''), note, live(() => B.act.live(false)), { className: 'action-drop', viscosity: 1.15, home, flow: true });
  return true;
}
function exitDrop() { if (S.exit) button('exit', 'recovery', S.exit.label, 'back to your feet', live(() => B.act.exit()), { critical: true, className: 'amber', viscosity: 3, home: ui.scene === 'world' ? [.5, .86] : null }); }
function base() {
  if (!ui.menu) button('place', 'title', TITLES[ui.scene] || S.place.name, 'tap for more', () => { ui.details = !ui.details; render(); }, { className: 'drop-title', viscosity: 4, kicker: ui.scene === 'world' ? MODE[S.mode] : S.place.name });
  if (ui.menu) { exitDrop(); if (undo.length) button('undo', 'recovery', 'Undo', undo.at(-1).label, doUndo, { critical: true, viscosity: 4, home: S.exit ? [.47, .68] : null }); return false; }
  button('can', 'water', null, null, () => { ui.details = !ui.details; render(); }, { fill: S.water.liters / 20, kicker: 'Can', value: `${n(S.water.liters)} L`, note: ui.details ? 'of 20 L' : '', viscosity: 1.8 });
  if (S.water.donkeyDown || S.water.donkey < .3) button('need', 'need', null, null, () => { ui.scene = 'donkey'; render(); }, { kicker: 'Donkey', value: S.water.donkeyDown ? 'Down' : 'Thirsty', note: 'water before the climb', className: 'amber', viscosity: 3 });
  if (ui.rest) { info('rest', 'speech', 'Rest', 'The world waits.', 'Your water, plates and place are kept.', { className: 'speech-drop', viscosity: 3 }); button('resume', 'primary', 'Return', 'to this moment', () => { ui.rest = false; render(); }, { className: 'action-drop' }); return false; }
  if (ui.memory) { buildRecall(); return false; }
  return true;
}
const BUILD = {
  world() { liveDrop(); exitDrop(); const v = currentVoice(); if (v) voiceDrop(v, voiceHome()); if (ui.details && S.place.next) info('next', 'c', 'Next', (S.map.stops.find(x => x.next) || {}).name || '', 'open Map in the edge current', { viscosity: 1.4 }); },
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
  map() { info('map-view', 'speech', 'The way', '', S.place.next ? `Next: ${(S.map.stops.find(x => x.next) || {}).name}` : 'Every stop reached.', { className: 'plate-detail map-drop', image: drawMap(), viscosity: 3, home: [world.clientWidth < 701 ? .36 : .24, .4] }); item('route', 'c', 1.4); item('region', 'd', 2); if (ui.details) item('map', 'e', 2); },
  sound() { item('voice', 'a', 1.2); item('tape', 'b', 1); item('radio', 'c', 1.6); item('listen', 'd', 2); if (ui.details) item('dance', 'e', .8); },
  weather() {
    const modes = ['worms', 'pane', 'fall', 'dew', 'breath'];
    button('material', 'a', null, null, () => { weather.material = modes[(modes.indexOf(weather.material) + 1) % modes.length]; render(); }, { kicker: 'Water', value: weather.material[0].toUpperCase() + weather.material.slice(1), note: 'pull sideways to change', viscosity: 2.6, cycle: ['material', modes.length] });
    range('erosion', 'erosion', 'Erosion', `${Math.round(weather.erosion * 100)}%`, 0, 1, .01, weather.erosion, v => { weather.erosion = v; }, { viscosity: 5 });
    range('rain-amount', 'b', 'Rainfall', `${Math.round(weather.rain * 100)}%`, .1, 1, .01, weather.rain, v => { weather.rain = v; }, { viscosity: 1.1 });
    item('glide', 'c', .5); item('run', 'd', .7); exitDrop();
  }
};
function drawMap() {
  if (performance.now() - mapAt < 900 && mapImage) return mapImage; mapAt = performance.now();
  const c = drawMap.c || (drawMap.c = document.createElement('canvas')); c.width = 360; c.height = 250; const g = c.getContext('2d'), P = (u, v) => [36 + u * 288, 34 + v * 176];
  g.fillStyle = '#04141a'; g.fillRect(0, 0, 360, 250); g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = 'rgba(150,230,225,.5)'; g.lineWidth = 2.5; g.setLineDash([2, 9]); g.beginPath(); S.map.stops.forEach((s, i) => { const [x, y] = P(s.u, s.v); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.setLineDash([]);
  g.font = 'italic 14px Georgia,serif'; g.textAlign = 'center';
  for (const s of S.map.stops) { const [x, y] = P(s.u, s.v); g.beginPath(); g.arc(x, y, s.next ? 11 : 7, 0, 7); g.fillStyle = s.next ? '#f8cd91' : s.seen ? 'rgba(150,230,225,.45)' : 'rgba(215,245,240,.9)'; g.fill(); g.fillStyle = s.next ? '#ffe9c4' : '#d9eeea'; g.fillText(s.name.replace(/^the /, ''), clamp(x, 95, 265), y + (s.v > .6 ? -16 : 28)); }
  const [dx, dy] = P(S.map.donkey[0], S.map.donkey[1]); g.fillStyle = '#c9a36a'; g.beginPath(); g.ellipse(clamp(dx, 8, 352), clamp(dy, 8, 242), 7, 5, 0, 0, 7); g.fill();
  const [mx, my] = P(S.map.me[0], S.map.me[1]), h = S.map.heading; g.save(); g.translate(clamp(mx, 10, 350), clamp(my, 10, 240)); g.rotate(h); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fill(); g.restore();
  return (mapImage = c.toDataURL('image/jpeg', .82));
}

// ---- render: specs -> DOM drops -> the field -------------------------------------------------------------------------
function render() {
  S = B.state(); const view = memory.view(); specs = [];
  world.className = `scene-${ui.scene} travel-${S.mode}${ui.menu ? ' menu-open' : ''}${ui.reduced ? ' still' : ''}${ui.words ? ' read-water' : ''}${ui.past ? ' reading-past' : ''}${ui.details ? ' details-open' : ''}${S.speed > .4 && !ui.past ? ' moving' : ''}`;
  world.dataset.scene = ui.scene;
  if (S.ready) { if (ui.past) buildPast(view); else if (base()) BUILD[ui.scene](); timeDrop(); }
  syncDrops(); renderMenu();
  const canSteer = S.ready && !ui.past && !ui.rest && !ui.memory && !ui.menu && !ui.say;
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
      else if (sp.kind === 'button') el.addEventListener('click', e => { if (field?.suppressClick(e)) return; el._spec.action?.(); });
      $('drops').append(el); refs.set(sp.id, el);
    }
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
const go = scene => () => { returnNow(false); stopSteer(); Object.assign(ui, { scene, menu: false, memory: false, say: false, rest: false, details: false }); render(); announce(TITLES[scene] || S.place.name); $('menu-toggle').focus({ preventScroll: true }); };
const ENTRIES = [
  { id: 'donkey', label: 'Donkey', run: go('donkey') }, { id: 'lens', label: 'Lens', run: go('lens') },
  { id: 'people', label: 'People', run: go('people') }, { id: 'water', label: 'Water', run: go('water') },
  { id: 'rig', label: 'Rig', run: go('rig') }, { id: 'map', label: 'Map', run: go('map') },
  { id: 'sound', label: 'Sound', run: go('sound') }, { id: 'weather', label: 'World', run: go('weather') },
  { id: 'read-water', label: 'Read water', run: () => { ui.words = !ui.words; render(); announce(ui.words ? 'Words shown.' : 'Words stay in the trace.'); } },
  { id: 'hold-rain', label: 'Hold rain', run: () => { ui.reduced = !ui.reduced; glass.setReducedMotion(ui.reduced); field?.setReducedMotion(ui.reduced); render(); announce(ui.reduced ? 'Rain held. Every drop stays reachable.' : 'The water can move again.'); } },
  { id: 'lang', label: 'Language', run: () => { const it = menuItems().find(x => x.id === 'lang'); it?.run(); render(); announce('Language: ' + (B.state().lang || 'en')); } },
  { id: 'memory', label: 'Voices', run: () => { stopSteer(); returnNow(false); ui.memory = !ui.memory; ui.recallIndex = 0; ui.menu = false; render(); } },
  { id: 'rest', label: 'Rest here', run: () => { returnNow(false); stopSteer(); ui.rest = true; ui.menu = false; render(); } },
  { id: 'jump', label: 'Jump', run: () => { ui.menu = false; menuItems().find(x => x.id === 'jump')?.run(); render(); } },
  { id: 'here', label: 'Here', run: go('world') }
];
function renderMenu() {
  const t = $('menu-toggle'), menu = $('menu-stream');
  t.setAttribute('aria-expanded', String(ui.menu)); t.setAttribute('aria-label', ui.menu ? 'Close menu' : 'Open menu'); t.querySelector('.drop-label').textContent = ui.menu ? 'Return' : 'Menu'; menu.hidden = !ui.menu;
  if (!ui.menu) return;
  if (!menu.children.length) for (const it of ENTRIES) { const b = document.createElement('button'); b.id = 'menu-' + it.id; b.className = 'liquid'; b.dataset.viscosity = '1.8'; b.innerHTML = '<span class="drop-label"></span>'; b.firstElementChild.textContent = it.label; b.addEventListener('click', e => { if (field?.suppressClick(e)) return; it.run(); }); menu.append(b); }
  for (const b of menu.children) { if (b.id === 'menu-' + (ui.scene === 'world' ? 'here' : ui.scene)) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  $('menu-hold-rain').querySelector('.drop-label').textContent = ui.reduced ? 'Let it move' : 'Hold rain'; $('menu-read-water').querySelector('.drop-label').textContent = ui.words ? 'Hide words' : 'Read water';
}
function paintMenuWater(bodies) {
  if (!ui.menu) { menuInk.replaceChildren(); menuWater = []; return; }
  const liveIds = new Set(); menuWater = [];
  for (const b of bodies.filter(b => b.id.startsWith('menu-'))) {
    const key = 'wet-' + b.id, half = world.clientWidth < 701 ? 54 : 68;
    const nodes = [{ x: b.x - half, y: b.y + 5, r: 5.5, alpha: .75 }, { x: b.x, y: b.y - 1, r: 7.5, alpha: .8 }, { x: b.x + half, y: b.y + 3, r: 4, alpha: .6 }];
    menuWater.push({ id: key, kind: 'menu', nodes }); liveIds.add(key);
    let group = menuInk.querySelector(`[data-id="${key}"]`);
    if (!group) { group = document.createElementNS(svgNS, 'g'); group.dataset.id = key; const path = document.createElementNS(svgNS, 'path'); path.id = key; path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'none'); group.append(path); const text = document.createElementNS(svgNS, 'text'); text.setAttribute('text-anchor', 'middle'); const flow = document.createElementNS(svgNS, 'textPath'); flow.setAttribute('href', '#' + key); flow.setAttribute('startOffset', '50%'); text.append(flow); group.append(text); menuInk.append(group); }
    group.firstChild.setAttribute('d', `M${nodes[0].x},${nodes[0].y} Q${b.x},${b.y - 7} ${nodes[2].x},${nodes[2].y}`);
    const native = $(b.id), label = native?.textContent.trim() || ''; group.querySelector('textPath').textContent = label; native?.setAttribute('aria-label', label);
  }
  for (const g of [...menuInk.children]) if (!liveIds.has(g.dataset.id)) g.remove();
}
function edgeCurrent() { const width = world.clientWidth, height = world.clientHeight, t = ui.reduced ? 0 : performance.now() / 1000; return { id: 'menu-edge-current', kind: 'menu', nodes: Array.from({ length: 12 }, (_, i) => ({ x: width - 18 + Math.sin(i * .88 + t * .18) * 3, y: i * height / 11, r: 2.8 + Math.pow(Math.sin(i * 1.73 + t * .12), 8) * 4.5, alpha: .9 })) }; }
function inkLabel(id) {
  const sp = refs.get(id)?._spec; if (sp?.voiceText) return `${sp.kicker}. ${sp.voiceText}`;
  if (id === 'time-current') return ui.past ? `−${n(ui.timeAge)} s` : 'Now';
  if (sp) { const words = [sp.kicker, sp.value || sp.label].filter(Boolean).join(' '); return words || sp.note || ''; }
  if (id === 'steer') return 'Move';
  return $(id)?.getAttribute('aria-label') || $(id)?.textContent.trim() || '';
}
function initializeField() {
  const proxy = {
    setBodies: bodies => { if (!S.ready) { glass.setBodies([]); return; } paintMenuWater(bodies); glass.setBodies([...bodies.map(b => { const sp = refs.get(b.id)?._spec, m = b.id.startsWith('menu-'); return { ...b, fill: sp?.fill, kind: sp?.fluidKind || b.kind, rx: m ? b.rx * .38 : b.id === 'time-current' ? b.rx * 1.3 : b.id === 'voice-current' ? b.rx * 1.15 : b.rx, ry: m ? b.ry * .34 : b.id === 'time-current' ? b.ry * .5 : b.id === 'voice-current' ? b.ry * .62 : b.ry }; }), { id: 'menu-spring', x: world.clientWidth - 18, y: world.clientHeight * (ui.menu ? .237 : .222), rx: 15, ry: ui.menu ? 55 : 43, viscosity: 4, kind: 'menu', critical: true, opacity: 1 }]); },
    setTrails: trails => { if (!S.ready) { glass.setTrails([]); return; } glass.setTrails([edgeCurrent(), ...menuWater, ...(ink.getTrails?.() || []), ...trails]); },
    setPointer: p => glass.setPointer(p), captureFrame: () => glass.captureFrame()
  };
  field = createRainField({ host: world, glass: proxy, historyLabels: false,
    onCatch: (id, meta) => {
      const body = field?.getBodies().find(b => b.id === id), sp = refs.get(id)?._spec;
      ink.arm({ id, text: inkLabel(id), x: meta.x ?? body?.x ?? 50, y: meta.y ?? body?.y ?? 100, keyboard: id === 'time-current' || meta.reason === 'focus' || meta.reason === 'keyboard', kind: id === 'voice-current' ? 'voice' : 'water' });
      if (id === 'voice-current' && sp?.voiceId) { caughtVoices.set(id, sp.voiceId); memory.holdDialogue(sp.voiceId, true); }
      if (sp?.kind === 'range' && id !== 'time-current' && !pulls.has(id)) { pulls.set(id, sp.number); pulls.set(id + ':from', { number: sp.number, label: inkLabel(id), action: sp.action }); }
      else if (sp?.cycle && !pulls.has(id)) pulls.set(id, 0);
    },
    onAdjust: (id, delta, meta) => {
      const sp = refs.get(id)?._spec;
      if (id === 'time-current') { const target = meta.key === 'Home' ? 0 : meta.key === 'End' ? timeAvailable() : clamp((pulls.get(id) ?? ui.timeAge) + (meta.phase === 'keyboard' ? -delta * 12 : -(meta.dx || 0) / Math.max(150, world.clientWidth * .6) * 12), 0, timeAvailable()); pulls.set(id, target); setTimeAge(target); ink.arm({ id, text: inkLabel(id), x: meta.x ?? 50, y: meta.y ?? 100, keyboard: true }); return; }
      if (id === 'voice-current' || ui.past) return;
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
    if (sp.id === 'place' || sp.id === 'time-current') width = mobile ? 145 : 195; if (sp.id === 'voice-current') width = mobile ? 150 : 210; if (sp.className?.includes('trace-drop')) width = mobile ? 185 : 240; if (sp.className?.includes('plate-detail')) width = mobile ? 215 : 300; element.style.width = width + 'px';
    if (sp.kind === 'range') { element.setAttribute('role', 'slider'); element.setAttribute('aria-label', sp.kicker); element.setAttribute('aria-valuemin', sp.min); element.setAttribute('aria-valuemax', sp.max); element.setAttribute('aria-valuenow', sp.number); element.setAttribute('aria-valuetext', sp.value); const input = element.querySelector('input'); input.tabIndex = -1; input.setAttribute('aria-hidden', 'true'); if (!sp.note) { const note = element.querySelector('.drop-note'); note.hidden = false; note.textContent = sp.id === 'time-current' ? 'pull sideways through time' : `pull up · ${sp.min} to ${sp.max}`; } }
    descriptors.push({ id: sp.id, element, anchorX, anchorY, viscosity: sp.viscosity || 1.5, role: sp.kind === 'button' ? 'action' : sp.kind, critical, label: [sp.kicker, sp.value || sp.label || sp.note].filter(Boolean).join(' · '), adjust: sp.kind === 'range' || !!sp.cycle || !!sp.flow });
  }
  const fixed = (id, anchorX, anchorY, extra = {}) => { const element = $(id); if (element && !element.hidden && element.getClientRects().length) descriptors.push({ id, element, anchorX, anchorY, role: 'action', viscosity: 1.7, label: [...element.querySelectorAll('.drop-label,.drop-value,.drop-note')].map(el => el.textContent.trim()).filter(Boolean).join(' · '), ...extra }); };
  if (!ui.menu) { fixed('steer', .2, .81, { critical: true, viscosity: .55 }); fixed('say-form', mobile ? .32 : .23, .43, { role: 'info', critical: true, viscosity: 4 }); }
  else { const entries = [...$('menu-stream').children], gap = .735 / Math.max(1, Math.ceil(entries.length / 2) - 1); entries.forEach((element, i) => { const col = i % 2, row = Math.floor(i / 2); descriptors.push({ id: element.id, element, role: 'action', viscosity: 2.3 + (i % 3) * .4, anchorX: col ? .77 : .18, anchorY: .155 + row * gap + (col ? .013 : 0), label: element.textContent.trim() }); }); }
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
let rub = null;
window.addEventListener('pointerdown', e => { if (e.target.closest?.('#rw .liquid,input,textarea,button,a,nav') || e.button > 0 || ui.menu || ui.past) return; rub = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; }, true);
window.addEventListener('pointermove', e => { if (!rub || rub.id !== e.pointerId) return; if (Math.hypot(e.clientX - rub.x, e.clientY - rub.y) > 8) rub.moved = true; if (rub.moved) { ink.rub(e.clientX, e.clientY, 25); field?.erodeAt?.(e.clientX, e.clientY, 25); } }, true);
for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, e => { if (rub?.id === e.pointerId) rub = null; }, true);
$('menu-toggle').addEventListener('click', () => { returnNow(false); stopSteer(); ui.menu = !ui.menu; render(); });
$('say-form').addEventListener('submit', e => { e.preventDefault(); const text = $('say-text').value.trim(); if (!text || ui.past) return; B.act.say(text); ui.say = false; $('say-text').value = ''; render(); });
for (const type of ['keydown', 'keyup', 'keypress']) $('say-text').addEventListener(type, e => e.stopPropagation());
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.target.matches?.('input,textarea')) return; const k = e.key.toLowerCase();
  if (k === 'escape') { if (ui.past) returnNow(); else { Object.assign(ui, { menu: false, memory: false, say: false, rest: false }); render(); } return; }
  if (k === 'home' && ui.past) { e.preventDefault(); returnNow(); return; }
  if (k === 'u' && !ui.past && undo.length) { e.preventDefault(); doUndo(); }
});
window.addEventListener('blur', stopSteer);

function tick(now) {
  const dt = Math.min(.15, Math.max(0, (now - frameTime) / 1000)); frameTime = now;
  if (!document.hidden) {
    if (!ui.past) { memory.tick(dt); ui.recordClock += dt; if (ui.recordClock >= .25) { S = B.state(); if (S.ready) { watchGame(); captureWeather(); } ui.recordClock = 0; } }
    field?.tick(dt); ink.tick(ui.past ? 0 : dt); ink.setTrails(field?.getTrails() || []);
    world.dataset.timeMode = ui.past ? 'past' : 'now'; world.dataset.timeAge = n(ui.timeAge);
    if (now - lastRender > 180) { render(); lastRender = now; }
  }
  requestAnimationFrame(tick);
}
new ResizeObserver(() => syncField()).observe(world);
initializeField(); render(); requestAnimationFrame(tick);
window.__rainSurface = { ui, weather, glass, memory, ink, render, get field() { return field; }, get specs() { return specs; }, get undo() { return undo; }, setTimeAge, returnNow, go: s => go(s)() };
}
boot();
})();
