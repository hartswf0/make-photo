/* Donkey Water / Night Post: liquid presentation of the game's own controls.
 * Source contract: hartswf0/make-photo@5cf1ddf9b3125447a8516e97869214cb3d2724bb.
 * Load world-rain-engine.js, then this file in place of dew-ui.js.
 * The game owns time, legality, sound, dialogue and the conserved water ledger.
 */
(function () {
  'use strict';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const finite = (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;
  const SELECT = '#dk-status,#dk-menu-btn,#dk-rail .bead,#dk-row .bead,#dk-verbs .verb,#dk-offers .verb,#dk-chips button,#dk-expose,#dk-veh,.dk-gauge,#dk-rain-options button';
  const styles = `
    #dew-glass{position:fixed;inset:0;width:100%;height:100%;z-index:64;pointer-events:none!important;touch-action:none}
    body.rain-game-skin #dk-status,body.rain-game-skin #dk-menu-btn,
    body.rain-game-skin #dk-ctx,body.rain-game-skin #dk-pad,
    body.rain-game-skin #dk-rail,body.rain-game-skin #dk-row,
    body.rain-game-skin .dk-gauge,body.rain-game-skin #dk-ctx *,
    body.rain-game-skin #dk-pad *,body.rain-game-skin #dk-rail *,
    body.rain-game-skin #dk-row *,body.rain-game-skin #dk-rain-options,
    body.rain-game-skin #dk-rain-options *{pointer-events:none!important}
    body.rain-game-skin #dk-rain-options{position:fixed;left:0;bottom:0;width:1px;height:1px;overflow:hidden;opacity:0}
    body.rain-game-skin #demo-brief{display:none!important}
    body.rain-game-skin #dk-row [data-item="hud"]{display:none!important}
    body.rain-game-skin #dk-row .bead.pic{background:none!important}
    body.rain-game-skin #demo-say input,body.rain-game-skin #demo-say button{
      background:transparent!important;border:0!important;border-bottom:1px solid rgba(220,251,247,.32)!important;
      border-radius:0!important;box-shadow:none!important;color:#eefffa;text-shadow:0 1px 3px #071716}
    #dew-reader{position:fixed;z-index:81;max-width:min(300px,calc(100vw - 48px));padding:0;
      margin:0;border:0;background:none;box-shadow:none;pointer-events:none;color:#eefffa;
      font:400 14px/1.5 system-ui,sans-serif;white-space:pre-line;text-shadow:0 1px 3px #071716,0 0 8px rgba(0,16,19,.8)}
    #dew-reader[hidden]{display:none}
    .dew-native-reader{position:fixed;width:1px;height:1px;clip-path:inset(50%);overflow:hidden;
      white-space:nowrap;pointer-events:none!important}
  `;

  window.makeDew = function makeDew(gameCanvas) {
    if (!gameCanvas || typeof window.WorldRainField !== 'function') {
      console.warn('Donkey Water rain: WorldRainField is unavailable; retaining the native controls.');
      return null;
    }
    const overlay = document.createElement('canvas');
    overlay.id = 'dew-glass'; overlay.setAttribute('aria-hidden', 'true');
    const style = document.createElement('style'); style.textContent = styles;
    const reader = document.createElement('div');
    reader.id = 'dew-reader'; reader.hidden = true; reader.setAttribute('role', 'status');
    reader.setAttribute('aria-live', 'polite'); reader.setAttribute('aria-atomic', 'true');
    const access = document.createElement('div');
    access.className = 'dew-native-reader'; access.setAttribute('aria-label', 'Optical trail history');
    document.head.append(style); document.body.append(overlay, reader, access);
    document.body.classList.add('rain-game-skin');

    // This object deliberately preserves the old makeDew data contract.
    const D = {
      drops: [], beads: [], wisps: [], msgs: [], streaks: [], skins: new Map(),
      rain: 0, enabled: true, light: null, flare: 0, breath: 0, bloomT: 0, mark: null, wet: 0,
      select: SELECT, map: null, mapA: 0, pool: null, hint: '', drag: null, onMerge: null,
      ways: [], lang: { words: [], label: {} }, gust: 0, glyphs: [], clouds: [],
      onSwat: null, onWipe: null, onBreathe: null, lastTouch: 0,
      wind: 0, mist: 0, smoke: 0, titleT: 0, titleText: '',
      carry: null, wetThing: null, lure: null, mini: null, scrub: 0
    };
    let dead = false, field, counter = 0, clock = 0, syncAt = -1, sceneId = null;
    let live = null, captured = null, blankHold = null, menuAnchor = null;
    let reading = null, focusedId = null, memory = [], pendingMemory = null, adjustment = null, motionOverride = false;
    const nativeById = new Map(), messages = new Map(), sliders = new Map(), listeners = [], opticalUndo = [];
    const ids = new WeakMap();
    const listen = (target, name, fn, capture) => {
      target.addEventListener(name, fn, capture);
      listeners.push(() => target.removeEventListener(name, fn, capture));
    };
    const state = () => {
      const game = window.__nightPost;
      if (game && typeof game.rainState === 'function') return game.rainState();
      // Pre-hook boot frames still use the exact carrier-backed native gauge.
      const status = document.getElementById('dk-status');
      return { liters: finite(status && status.dataset.fill, 0) * 20, capacity: 20,
        reserve: finite(status && status.dataset.mark, .2) * 20,
        sceneId: 'ahiya', wet: D.wetThing, live: null, busy: false };
    };
    const visible = el => {
      if (!el || el.hidden || el.closest('[hidden]')) return false;
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    };
    const idFor = el => {
      if (el.id === 'dk-menu-btn') return 'menu';
      if (el.id === 'dk-status') return 'water';
      if (el.id) return el.id;
      const d = el.dataset;
      if (d.group) return 'group:' + d.group;
      if (d.item) return 'item:' + d.item;
      if (d.key) return 'key:' + d.key;
      if (d.offer) return 'offer:' + d.offer;
      if (!ids.has(el)) ids.set(el, 'native:' + (++counter));
      return ids.get(el);
    };
    const item = id => field.getItems().find(d => d.id === id);
    const toUV = (x, y, drift) => ({ u: clamp(x / (field.w || innerWidth), 0, 1),
      v: clamp(y / (field.h || innerHeight), 0, 1), drift });
    const anchor = M => {
      let p;
      try { p = typeof M.anchor === 'function' ? M.anchor() : M.anchor; } catch (_) { p = null; }
      return Array.isArray(p) && p.length > 1 && p.every(Number.isFinite) ? p : null;
    };
    function labelFor(id) {
      const M = messages.get(id);
      if (M) return (M.name ? M.name + '\n' : '') + M.full;
      if (id === 'water') return `${live.liters} L / ${live.capacity} L\n${live.reserve} L held in reserve`;
      if (id === 'dk-rain-density') return 'Rain viscosity\n' + Math.round(field.viscosity * 100) + '% · drag the wet path to change it';
      if (id === 'dk-rain-motion') return field.still ? 'Still rain · on' : 'Still rain · off';
      if (id === 'dk-rain-pause') return field.running ? 'Pause the rain · game keeps running' : 'Resume the rain · game keeps running';
      if (id === 'dk-rain-undo') return opticalUndo.length ? 'Undo the last lens or viscosity edit\nWater and world movement stay current.' : '';
      if (id === 'wet-thing') {
        const L = live.live;
        return L && L.kind === 'draw' ? 'Basalt Pump\nCarry this water to your can.' :
          L && L.kind === 'give' ? 'Carry water from your can to this person or animal.' :
          'Hold to listen. Touch to speak.';
      }
      const el = nativeById.get(id);
      if (el) {
        const value = el.querySelector('i'), cap = el.getAttribute('aria-label') || el.dataset.dewLabel || el.textContent;
        return String(cap || '').trim() + (value && value.textContent ? '\n' + value.textContent : '');
      }
      const d = item(id); return d ? String(d.label || '') : '';
    }
    function reveal(id, persistent, text) {
      if (!live) live = state();
      reading = { id, until: persistent ? Infinity : clock + 4.2, text: text === undefined ? null : text };
      const M = messages.get(id); if (M) M.read = true;
      field.focusItem(id, true); updateReader();
    }
    function clearReader() {
      if (reading && reading.id !== focusedId) field.focusItem(reading.id, false);
      reading = null; reader.hidden = true; reader.textContent = '';
    }
    function updateReader() {
      if (!reading) return;
      if (clock > reading.until) { clearReader(); return; }
      const d = item(reading.id);
      if (!d) { clearReader(); return; }
      const text = reading.text === null ? labelFor(reading.id) : reading.text;
      if (!text) { reader.hidden = true; return; }
      if (reader.textContent !== text) reader.textContent = text;
      reader.hidden = false;
      // Reading lives at the nearest glass edge, preserving the world centre.
      const W = field.w, H = field.h, left = d.x < W * .5;
      reader.style.left = (left ? 22 : Math.max(22, W - Math.min(300, W - 48) - 22)) + 'px';
      reader.style.top = clamp(d.y + 25, 24, Math.max(24, H - reader.offsetHeight - 26)) + 'px';
    }
    function activate(id) {
      if (id === 'wet-thing') return transfer('thing');
      if (id === 'water' || messages.has(id)) return;
      const el = nativeById.get(id);
      if (el && visible(el) && !el.disabled) {
        const before = ['item:focus', 'item:stop', 'item:tilt', 'dk-rain-density'].includes(id) ? opticalState() : null;
        el.click(); if (before) rememberOptical(before); syncAt = -1;
      }
    }
    function opticalState() {
      const s = state(); return { focus: s.focus, stop: s.stop, tilt: s.tilt, viscosity: field.viscosity };
    }
    function rememberOptical(before) {
      const after = opticalState(), signature = JSON.stringify({ before, after });
      if (JSON.stringify(before) === JSON.stringify(after)) return;
      if (opticalUndo.length && opticalUndo[opticalUndo.length - 1].signature === signature) return;
      opticalUndo.push({ before, after, signature }); if (opticalUndo.length > 12) opticalUndo.shift(); syncAt = -1;
    }
    function undoOptical() {
      const last = opticalUndo.pop(); if (!last) return false;
      const game = window.__nightPost, s = last.before;
      if (game && typeof game.rainAdjust === 'function') {
        for (const key of ['focus', 'stop', 'tilt']) if (Number.isFinite(s[key])) game.rainAdjust(key, s[key]);
      }
      field.setViscosity(s.viscosity); syncAt = -1; return true;
    }
    function transfer(from) {
      const game = window.__nightPost;
      if (!game || typeof game.rainTransfer !== 'function') return false;
      const result = game.rainTransfer(from);
      syncAt = -1; return result;
    }
    function inside(d, x, y, extra) {
      return d && ((x - d.x) / (d.rx + (extra || 5))) ** 2 +
        ((y - d.y) / (d.ry + (extra || 5))) ** 2 <= 1;
    }
    function drag(e) {
      if (['item:focus', 'item:stop', 'item:tilt', 'dk-rain-density'].includes(e.id)) {
        if (e.phase === 'start') {
          const s = state(), path = e.fromTrail && e.traceOrigin && field.trails.find(t => t.id === e.traceOrigin.trailId);
          let length = 0;
          if (path) for (let i = 1; i < path.points.length; i++) length += Math.hypot(path.points[i].x - path.points[i - 1].x, path.points[i].y - path.points[i - 1].y);
          adjustment = { id: e.id, focus: s.focus, stop: s.stop, stopCount: s.stopCount, tilt: s.tilt, viscosity: field.viscosity,
            path: path ? Object.assign({}, path, { points: path.points.map(p => Object.assign({}, p)) }) : null, length,
            before: opticalState() };
        } else if (adjustment && adjustment.id === e.id && (e.phase === 'move' || e.phase === 'cancel')) {
          let delta = (e.totalX - e.totalY) / 260;
          if (e.fromTrail && e.traceOrigin) {
            const point = field.projectTrail(adjustment.path, e.x, e.y);
            if (point) {
              let distance = point.progress * adjustment.length;
              const ps = adjustment.path.points, edge = point.progress < .001 ? 0 : point.progress > .999 ? ps.length - 1 : -1;
              if (edge >= 0 && ps.length > 1) {
                const a = ps[edge ? edge - 1 : 0], b = ps[edge ? edge : 1], n = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                const extension = ((e.x - ps[edge].x) * (b.x - a.x) + (e.y - ps[edge].y) * (b.y - a.y)) / n;
                distance += edge ? Math.max(0, extension) : Math.min(0, extension);
              }
              delta = (distance - e.traceOrigin.progress * adjustment.length) / Math.max(180, adjustment.length);
            }
          }
          if (e.phase === 'cancel') delta = 0;
          if (e.id === 'dk-rain-density') field.setViscosity(clamp(adjustment.viscosity + delta * .9, .1, 1));
          else {
            const key = e.id.slice(5), game = window.__nightPost;
            const value = key === 'focus' ? Math.exp(Math.log(adjustment.focus || 18) + delta * Math.log(900 / 1.2)) :
              key === 'stop' ? Math.round(adjustment.stop + delta * Math.max(1, adjustment.stopCount - 1)) : adjustment.tilt + delta * .64;
            if (game && typeof game.rainAdjust === 'function') game.rainAdjust(key, value);
          }
          syncAt = -1;
        }
        if (e.phase === 'end' && adjustment) rememberOptical(adjustment.before);
        if (e.phase === 'end' || e.phase === 'cancel') adjustment = null;
        return;
      }
      if (e.id !== 'water' && e.id !== 'wet-thing') return;
      if (e.phase === 'start') D.carry = { x0: e.x, y0: e.y, x: e.x, y: e.y };
      else if (e.phase === 'move' && D.carry) { D.carry.x = e.x; D.carry.y = e.y; }
      else if (e.phase === 'end' || e.phase === 'cancel') {
        D.carry = null;
        if (e.phase !== 'end' || Math.hypot(e.totalX, e.totalY) < 6) return;
        const target = item(e.id === 'water' ? 'wet-thing' : 'water');
        const targetTrail = target && field.trails.find(t => t.id === target.trailKey && t.epoch === field.frameEpoch);
        const path = targetTrail && field.projectTrail(targetTrail, e.x, e.y);
        const onPath = path && path.live && path.distance <= Math.min(22, Math.max(5, (path.point.width || targetTrail.width) + 3));
        if (inside(target, e.x, e.y, 8) || onPath) transfer(e.id === 'water' ? 'can' : 'thing');
      }
    }
    function preview(e) {
      if (e.phase === 'end' || e.phase === 'cancel') {
        D.scrub = 0; field.setPreviewTime(null); return;
      }
      const epoch = e.point && e.point.epoch;
      if (field.frameAt(e.time, true, epoch)) {
        field.setPreviewTime(e.time, epoch); D.scrub = Math.max(.05, field.time - e.time);
      } else { field.setPreviewTime(null); D.scrub = 0; }
      // Preview changes only optical time. No action callback, state setter or replay.
    }
    try {
      field = new window.WorldRainField(overlay, {
        onActivate: activate, onDrag: drag, onTrail: preview,
        onInspect: e => { if (D.enabled) reveal(e.id, false); },
        onError: error => {
          console.warn('Donkey Water rain rendering stopped; native controls restored:', error);
          if (captured !== null && overlay.hasPointerCapture(captured)) overlay.releasePointerCapture(captured);
          if (field) { clearTimeout(field.longTimer); field.drag = null; field.trailHold = null; field.setPreviewTime(null); }
          D.enabled = false; D.carry = null; D.scrub = 0; captured = null;
          clearTimeout(blankHold && blankHold.timer); blankHold = null;
          overlay.hidden = true; reader.hidden = true; access.hidden = true;
          const controls = document.getElementById('dk-rain-options'); if (controls) controls.hidden = true;
          document.body.classList.remove('rain-game-skin', 'dew-skin');
        }
      }, { autoStart: false, renderWorld: false, bindPointer: false });
    } catch (error) {
      overlay.remove(); reader.remove(); access.remove(); style.remove();
      document.body.classList.remove('rain-game-skin'); console.warn(error); return null;
    }
    D.field = field; // Readable diagnostics; never the owner of game state.
    field.setViscosity(.62);
    const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    field.setStill(motionPreference.matches);
    if (motionPreference.addEventListener) listen(motionPreference, 'change', e => { if (!motionOverride) field.setStill(e.matches); });
    const rainControls = document.createElement('div'); rainControls.id = 'dk-rain-options'; rainControls.hidden = true;
    for (const [id, label, action] of [
      ['dk-rain-density', 'Rain viscosity', () => field.setViscosity(field.viscosity >= .85 ? .25 : Math.min(1, field.viscosity + .2))],
      ['dk-rain-motion', 'Still rain', () => { motionOverride = true; field.setStill(!field.still); }],
      ['dk-rain-pause', 'Pause rain', () => field.setRunning(!field.running)],
      ['dk-rain-undo', 'Undo lens or viscosity edit', undoOptical]
    ]) {
      const button = document.createElement('button'); button.type = 'button'; button.id = id;
      button.textContent = label; button.setAttribute('aria-label', label); button.onclick = action; rainControls.append(button);
    }
    document.body.append(rainControls);
    const brief = document.getElementById('demo-brief'); if (brief) brief.hidden = true;

    function controlPosition(el, index, count) {
      const W = field.w, H = field.h, d = el.dataset, r = el.getBoundingClientRect();
      if (el.id === 'dk-menu-btn') return menuAnchor || [W - 34, H - 42, 12];
      if (el.id === 'dk-status') return [40, H - 45, 10];
      if (el.id === 'dk-expose') return [W - 32, H - 115, 10];
      if (el.id === 'dk-veh') return [W - 32, H - 184, 10];
      if (el.id === 'dk-map') return [32, H - 118, 9];
      if (d.group) {
        const i = Array.from(el.parentElement.children).indexOf(el);
        return [W - 32, 91 + i * 58, 8];
      }
      if (d.item) {
        const i = Array.from(el.parentElement.children).indexOf(el);
        const top = Math.max(1, Math.floor((W - 122) / 54));
        return i < top ? [70 + i * Math.min(58, (W - 140) / Math.max(1, top - 1)), 34, 7] :
          [30, 100 + (i - top) * 54, 7];
      }
      if (el.id === 'dk-g-donkey') return [32, H - 188, 10];
      if (el.id === 'dk-g-signal') return [32, H - 244, 10];
      if (el.id === 'dk-rain-density') return [Math.min(110, W * .28), H - 42, 9];
      if (el.id === 'dk-rain-motion') return [Math.min(180, W * .46), H - 42, 8];
      if (el.id === 'dk-rain-pause') return [Math.min(250, W * .64), H - 42, 8];
      if (el.id === 'dk-rain-undo') return [Math.min(320, W * .81), H - 42, 8];
      return [clamp(r.left + r.width / 2, 28, W - 28), clamp(r.top + r.height / 2, 32, H - 32), 12];
    }
    function roleFor(el, id) {
      if (id === 'menu') return 'menu';
      if (id === 'water' || el.dataset.stain === 'water' || el.id === 'dk-g-donkey') return 'water';
      if (el.dataset.stain === 'go' || el.dataset.group === 'Go') return 'move';
      if (el.dataset.stain === 'sys' || el.dataset.group === 'Sound') return 'viscosity';
      if (id === 'dk-rain-density') return 'viscosity';
      if (id === 'dk-rain-undo') return 'memory';
      if (el.dataset.item === 'plates') return 'memory';
      return 'clear';
    }
    function sync() {
      live = state();
      const nextScene = String(live.sceneId || 'ahiya');
      if (sceneId !== nextScene) {
        sceneId = nextScene;
        field.setWorldSource(gameCanvas, { fit: 'contain', sceneId });
        memory = []; pendingMemory = null; D.scrub = 0;
      }
      nativeById.clear();
      const menu = document.getElementById('dk-menu-btn');
      rainControls.hidden = !menu || menu.getAttribute('aria-expanded') !== 'true';
      document.getElementById('dk-rain-motion').setAttribute('aria-pressed', String(field.still));
      document.getElementById('dk-rain-pause').setAttribute('aria-pressed', String(!field.running));
      document.getElementById('dk-rain-undo').hidden = opticalUndo.length === 0;
      const elements = Array.from(document.querySelectorAll(D.select)).filter(visible);
      elements.sort((a, b) => (a.id === 'dk-menu-btn' ? -1 : b.id === 'dk-menu-btn' ? 1 : 0));
      const list = [];
      for (const el of elements) {
        const id = idFor(el), role = roleFor(el, id), p = controlPosition(el);
        nativeById.set(id, el);
        let amount = finite(el.dataset.fill, .5);
        if (id === 'water') {
          amount = live.liters / live.capacity;
          el.tabIndex = 0;
          el.setAttribute('aria-label', `Water carried: ${live.liters} L of ${live.capacity} L. Reserve ${live.reserve} L.`);
        }
        const value = id === 'water' ? live.liters : id === 'item:focus' ? live.focus : id === 'item:stop' ? live.stop :
          id === 'item:tilt' ? live.tilt : id === 'dk-rain-density' ? field.viscosity : el.dataset.item ? el.textContent.trim() : amount;
        list.push({ id, role, label: el.getAttribute('aria-label') || el.dataset.dewLabel || el.textContent.trim(), value,
          amount, density: id === 'dk-rain-density' ? field.viscosity : role === 'viscosity' ? .72 : .42,
          spread: id === 'dk-rain-density' ? 1 - field.viscosity : role === 'move' ? .75 : .46,
          distortion: role === 'move' ? .78 : .36, disabled: !!el.disabled,
          active: el.classList.contains('on'), worldAnchor: toUV(p[0], p[1], p[2]),
          stamp: { place: live.place || sceneId, reserve: live.reserve,
            action: el.dataset.verb || el.dataset.ctx || el.dataset.item || null } });
      }
      // A projected wet object comes directly from demoAnchors; it is not a stand-in actor.
      const wet = D.wetThing || live.wet;
      if (wet) list.splice(Math.min(2, list.length), 0, {
        id: 'wet-thing', role: wet.kind === 'talk' ? 'clear' : 'water', label: 'World interaction',
        value: live.live && live.live.dl || 0, amount: wet.kind === 'draw' ? .95 : .42,
        density: .5, spread: .56, distortion: .4,
        worldAnchor: toUV(wet.x, wet.y, 9), stamp: { place: live.place, kind: wet.kind }
      });
      for (const M of D.msgs.slice(-3)) {
        if (M.endedAt !== null && clock - M.endedAt > 3.5) continue;
        const p = anchor(M); if (!p) continue;
        const drift = M.endedAt === null ? 18 : 30;
        list.push({ id: M.id, role: M.kind === 'smoke' ? 'viscosity' : 'clear', label: '',
          value: M.full, amount: .48, density: M.kind === 'smoke' ? .8 : .38,
          worldAnchor: toUV(p[0] + (p[0] < field.w / 2 ? -24 : 24), p[1] + 22, drift),
          stamp: { name: M.name, message: true } });
      }
      for (const way of (D.ways || []).slice(0, 3)) {
        const x = finite(way.sx, finite(way.tx, 0)), y = finite(way.sy, finite(way.ty, 0));
        if (!x && !y) continue;
        list.push({ id: 'way:' + way.id, role: 'move', label: [way.label, way.note].filter(Boolean).join('\n'),
          amount: .3, distortion: .75, worldAnchor: toUV(clamp(x, 24, field.w - 24), clamp(y, 34, field.h - 35), 8) });
      }
      if (pendingMemory && clock - pendingMemory.at < 16) list.push({
        id: 'memory', role: 'memory', label: 'The last handoff · hold and trace its recorded frames',
        value: live.liters, density: .63, amount: .5, worldAnchor: toUV(72, field.h - 125, 16) });
      if (D.map && D.mini) {
        const names = ['Basalt Pump', 'Cross-Beacon', 'Hill Archive', 'Daylight Compound'];
        D.mini.stops.forEach((p, i) => list.push({ id: 'map:' + i, role: 'move',
          label: names[i] + (p[2] ? '\nNext stop' : p[3] ? '\nVisited' : ''),
          amount: .25, distortion: .55, worldAnchor: toUV(field.w - 111 + p[0] * 65, field.h * .45 + p[1] * 112, 5) }));
      }
      field.setItems(list.slice(0, 32));
      if (pendingMemory && !pendingMemory.installed) installMemory();
      syncSliders();
      D.beads = field.getItems(); D.streaks = field.trails;
      D.skins.clear(); for (const [id, el] of nativeById) D.skins.set(el, item(id));
    }
    function installMemory() {
      const d = item('memory'), saved = pendingMemory && pendingMemory.frames;
      if (!d || !saved || saved.length < 2) return;
      const points = saved.filter(p => p.epoch === field.frameEpoch).map((p, i, all) => ({
        x: d.x + Math.sin(i / Math.max(1, all.length - 1) * Math.PI) * 13,
        y: d.y - (1 - i / Math.max(1, all.length - 1)) * 90,
        t: p.time, born: field.time, epoch: p.epoch, value: p.liters,
        width: 8, material: field.material(d), stamp: { recordedHandoff: true }
      }));
      const physical = field.items.find(p => p.id === 'memory');
      const trail = physical && field.trails.find(t => t.id === physical.trailKey);
      if (trail && points.length > 1) { trail.points = points; trail.last = field.time; }
      pendingMemory.installed = true;
    }
    function syncSliders() {
      const current = new Set(field.getItems().map(d => d.id));
      for (const [id, input] of sliders) if (!current.has(id)) { input.remove(); sliders.delete(id); }
      for (const d of field.getItems()) {
        let input = sliders.get(d.id);
        if (!input) {
          input = document.createElement('input'); input.type = 'range';
          input.min = '0'; input.max = '100'; input.step = '1'; input.value = '100';
          input.dataset.rainHistory = d.id;
          input.addEventListener('focus', () => { focusedId = d.id; reveal(d.id, true, 'Optical history\nUse arrow keys to read recorded frames.'); });
          input.addEventListener('input', () => previewFromSlider(d.id, input));
          input.addEventListener('blur', () => { focusedId = null; field.focusItem(d.id, false); field.setPreviewTime(null); D.scrub = 0; clearReader(); });
          access.append(input); sliders.set(d.id, input);
        }
        input.setAttribute('aria-label', 'Recorded frames: ' + (d.label || (messages.has(d.id) ? 'message' : d.id)));
      }
    }
    function previewFromSlider(id, input) {
      const d = item(id), trail = d && field.trails.find(t => t.id === d.trailKey);
      if (!trail || trail.points.length < 2) return;
      const f = clamp(Number(input.value) / 100, 0, 1), p = trail.points;
      let length = 0; const segments = [];
      for (let i = 1; i < p.length; i++) { const n = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); segments.push(n); length += n; }
      let remain = f * length, x = p[0].x, y = p[0].y;
      for (let i = 1; i < p.length; i++) {
        if (remain <= segments[i - 1] || i === p.length - 1) {
          const k = segments[i - 1] ? remain / segments[i - 1] : 0;
          x = p[i - 1].x + (p[i].x - p[i - 1].x) * k;
          y = p[i - 1].y + (p[i].y - p[i - 1].y) * k; break;
        }
        remain -= segments[i - 1];
      }
      const hit = field.projectTrail(trail, x, y); if (!hit) return;
      preview({ phase: 'move', time: hit.time, point: hit.point });
      const text = D.scrub ? `${Math.max(0, field.time - hit.time).toFixed(1)} seconds ago · recorded light` : 'No recorded frame at this point yet';
      input.setAttribute('aria-valuetext', text); reveal(id, true, text);
    }

    function isWorldEvent(e) {
      const t = e.target;
      return t === gameCanvas || t === overlay || t === document.body ||
        t && (t.id === 'viewfinder' || t.closest && t.closest('.dk'));
    }
    const consume = e => { e.preventDefault(); e.stopImmediatePropagation(); };
    function recallMenu(x, y) {
      menuAnchor = [x < field.w / 2 ? 33 : field.w - 33, clamp(y, 42, field.h - 42), 12];
      const el = document.getElementById('dk-menu-btn');
      if (el && el.getAttribute('aria-expanded') !== 'true') el.click();
      sync(); reveal('menu', false); if (typeof D.onBreathe === 'function') D.onBreathe();
    }
    function down(e) {
      if (dead || !D.enabled || captured !== null || !isWorldEvent(e) || e.button > 0) return;
      sync();
      const p = field.point(e), head = field.hit(p.x, p.y), trail = head ? null : field.hitTrail(p.x, p.y, e.pointerType);
      clearTimeout(blankHold && blankHold.timer); blankHold = null;
      if (head || trail) {
        captured = e.pointerId; consume(e);
        // Live paths operate their owner. Retired paths and Shift/Alt read time.
        field.setInteractionMode('trace');
        field.pointerDown(e); D.lastTouch = clock; return;
      }
      // Observe an empty hold without taking the camera or walking gesture away.
      blankHold = { id: e.pointerId, x: e.clientX, y: e.clientY,
        timer: setTimeout(() => { if (blankHold) recallMenu(p.x, p.y); }, 620) };
    }
    function move(e) {
      if (blankHold && blankHold.id === e.pointerId && Math.hypot(e.clientX - blankHold.x, e.clientY - blankHold.y) > 6) {
        clearTimeout(blankHold.timer); blankHold = null;
      }
      if (captured !== e.pointerId) return;
      consume(e); field.pointerMove(e);
    }
    function up(e) {
      if (blankHold && blankHold.id === e.pointerId) { clearTimeout(blankHold.timer); blankHold = null; }
      if (captured !== e.pointerId) return;
      consume(e); field.pointerUp(e); captured = null; field.setInteractionMode('trace'); D.carry = null;
      syncAt = -1;
    }
    function cancel(e) {
      if (blankHold && blankHold.id === e.pointerId) { clearTimeout(blankHold.timer); blankHold = null; }
      if (captured !== e.pointerId) return;
      consume(e); field.pointerCancel(e); captured = null; field.setInteractionMode('trace');
      D.carry = null; D.scrub = 0; field.setPreviewTime(null); syncAt = -1;
    }
    listen(window, 'pointerdown', down, true); listen(window, 'pointermove', move, true);
    listen(window, 'pointerup', up, true); listen(window, 'pointercancel', cancel, true);
    listen(document, 'focusin', e => {
      if (!D.enabled || dead) return;
      if (e.target.dataset && e.target.dataset.rainHistory) return;
      if (!e.target.matches || !e.target.matches(D.select)) return;
      sync(); focusedId = idFor(e.target); reveal(focusedId, true);
    }, true);
    listen(document, 'focusout', e => {
      if (e.target.matches && e.target.matches(D.select)) {
        if (focusedId) field.focusItem(focusedId, false); focusedId = null; clearReader();
      }
    }, true);
    listen(document, 'click', e => {
      if (!D.enabled || dead) return;
      const b = e.target.closest && e.target.closest('[data-item="help"],#demo-help');
      if (!b || !brief) return;
      const text = Array.from(brief.querySelectorAll('p')).map(p => p.textContent.trim()).join('\n');
      brief.hidden = true; sync(); reveal('menu', false, text);
    }, false);
    listen(window, 'click', e => {
      const b = e.target.closest && e.target.closest('[data-item="map"],[data-offer="map"],#dk-map');
      const game = window.__nightPost;
      if (!D.enabled || !b || !game || typeof game.rainMap !== 'function') return;
      consume(e); game.rainMap(); syncAt = -1;
    }, true);
    listen(window, 'click', e => {
      const b = e.target.closest && e.target.closest('[data-item="focus"],[data-item="stop"],[data-item="tilt"],#dk-rain-density');
      if (!D.enabled || !b) return;
      const before = opticalState();
      // Native keyboard clicks finish their real game handler before we record optics.
      Promise.resolve().then(() => { if (!dead && D.enabled) rememberOptical(before); });
    }, true);
    listen(window, 'keydown', e => {
      if (!D.enabled || dead) return;
      const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === 'Escape') {
        clearTimeout(blankHold && blankHold.timer); blankHold = null;
        if (captured !== null) {
          field.pointerCancel({ pointerId: captured }); captured = null; D.carry = null;
          field.setInteractionMode('trace'); syncAt = -1; consume(e);
        }
        clearReader(); field.setPreviewTime(null); D.scrub = 0; // The game's own Escape closes its menu.
        if (t && t.dataset && t.dataset.rainHistory) { t.value = '100'; t.setAttribute('aria-valuetext', 'Live light'); }
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() === 'm' && !e.repeat) {
        consume(e); recallMenu(field.w - 33, field.h - 42);
      }
    }, true);

    D.worldHit = (x, y) => D.enabled ? inside(item('wet-thing'), x, y, 5) :
      D.wetThing && Math.hypot(x - D.wetThing.x, y - D.wetThing.y) < D.wetThing.r + 30;
    D.drop = function drop(o) {
      const options = o || {}, p = field.makeParticle(finite(options.x, field.w / 2), finite(options.y, 0), finite(options.r, 4));
      Object.assign(p, options); p.age = 0; p.life = finite(options.life, 9); p.trail = p.trail || [];
      p.state = options.state || 'pin';
      p.release = () => { p.state = 'fall'; p.vy = Math.max(p.vy || 0, 3); return p; };
      p.smoke = () => { D.wisp(p.x, p.y, { r: p.r }); p.life = p.age; return p; };
      field.particles.push(p); field.cap(); D.drops = field.particles; return p;
    };
    D.wisp = (x, y, o) => {
      const w = Object.assign({ x, y, r: 9, t: 0, life: 3.8, d: .5 }, o || {});
      D.wisps.push(w); if (D.wisps.length > 28) D.wisps.shift(); return w;
    };
    D.say = function say(o) {
      o = o || {};
      const M = { id: 'message:' + (++counter), full: o.text || '', shown: 0, anchor: o.anchor,
        me: !!o.me, done: false, name: o.name || '', fade: 1, box: null, read: false,
        kind: 'fall', endedAt: null, d: null, p: null, s: null };
      M.set = (text, fraction) => { M.full = String(text || ''); M.shown = Math.round(M.full.length * finite(fraction, 1)); syncAt = -1; return M; };
      M.end = how => { if (M.done) return M; M.done = true; M.kind = how || 'fall'; M.endedAt = clock;
        const p = anchor(M); if (p && M.kind === 'smoke') D.wisp(p[0], p[1]); syncAt = -1; return M; };
      M.place = () => anchor(M);
      M.d = { release: () => M.end('fall'), smoke: () => M.end('smoke') };
      D.msgs.push(M); messages.set(M.id, M); syncAt = -1;
      // No text node is written here. Reading requires a deliberate hold or focus.
      return M;
    };
    D.remember = () => {
      field.captureFrame(); const s = live || state();
      memory.push({ time: field.time, epoch: field.frameEpoch, liters: s.liters });
      if (memory.length > 12) memory.shift();
    };
    D.recall = () => { pendingMemory = { at: clock, frames: memory.slice(), installed: false }; memory = []; syncAt = -1; };
    D.accent = () => {
      if (!D.enabled || field.still || !field.running) return false;
      for (const p of field.particles.slice(-6)) { p.vy = Math.max(p.vy || 0, 4.5); p.state = 'fall'; }
      return true;
    };
    D.bloom = () => { D.bloomT = .42; field.dirty = true; };
    D.title = t => { D.titleText = String(t || ''); D.titleT = 0; };
    D.setLang = L => { D.lang = L || { words: [], label: {} }; };
    D.size = () => [field.w, field.h];

    function drawAir(dt) {
      const c = field.ctx, W = field.w, H = field.h;
      c.save();
      for (const w of D.wisps) {
        w.t += dt; w.y -= dt * (7 + Math.abs(D.wind) * .03); w.x += dt * D.wind * .035;
        const r = w.r + w.t * 7, alpha = Math.max(0, 1 - w.t / w.life) * .065;
        const fog = c.createRadialGradient(w.x, w.y, 0, w.x, w.y, r);
        fog.addColorStop(0, `rgba(188,204,202,${alpha})`); fog.addColorStop(1, 'rgba(188,204,202,0)');
        c.fillStyle = fog; c.fillRect(w.x - r, w.y - r, r * 2, r * 2);
      }
      D.wisps = D.wisps.filter(w => w.t < w.life);
      // The actual world remains visible; only thin vapour at the glass edges.
      if (D.smoke > .04 || D.mist > .04 || D.breath > .04) {
        const alpha = Math.min(.04, D.smoke * .022 + D.mist * .012 + D.breath * .015);
        const fog = c.createRadialGradient(W * .94, H * .81, 0, W, H, W * .26);
        fog.addColorStop(0, `rgba(183,199,191,${alpha})`); fog.addColorStop(1, 'rgba(183,199,191,0)');
        c.fillStyle = fog; c.fillRect(W * .65, H * .35, W * .35, H * .65);
      }
      if (D.pool) {
        const p = D.pool, x = p.x + p.kx * 32, y = p.y + p.ky * 29;
        c.beginPath(); c.moveTo(p.x, p.y - 21);
        c.bezierCurveTo(p.x + 6, p.y - 10, x - 5, y - 8, x, y);
        c.lineCap = 'round'; c.strokeStyle = 'rgba(30,128,142,.18)'; c.lineWidth = 7; c.stroke();
        c.strokeStyle = 'rgba(222,253,245,.52)'; c.lineWidth = .7; c.stroke();
      }
      if (D.map && D.mini && D.mini.stops.length) {
        const route = D.mini.stops.map(p => ({ x: W - 111 + p[0] * 65, y: H * .45 + p[1] * 112 }));
        c.beginPath(); c.moveTo(route[0].x, route[0].y);
        for (let i = 1; i < route.length; i++) {
          const a = route[i - 1], b = route[i];
          c.bezierCurveTo(a.x + 5, a.y + (b.y - a.y) * .3, b.x - 5, a.y + (b.y - a.y) * .7, b.x, b.y);
        }
        c.lineCap = 'round'; c.strokeStyle = 'rgba(26,122,139,.22)'; c.lineWidth = 5; c.stroke();
        c.strokeStyle = 'rgba(225,251,235,.52)'; c.lineWidth = .65; c.stroke();
        const me = D.mini.me; c.beginPath(); c.ellipse(W - 111 + me[0] * 65, H * .45 + me[1] * 112, 2.5, 4, 0, 0, Math.PI * 2);
        c.fillStyle = 'rgba(233,251,236,.82)'; c.fill();
      }
      if (D.bloomT > 0) { D.bloomT = Math.max(0, D.bloomT - dt); c.fillStyle = `rgba(238,255,239,${D.bloomT * .12})`; c.fillRect(0, 0, W, H); }
      c.restore();
    }
    D.frame = function frame(dt) {
      if (dead) return;
      dt = clamp(finite(dt, 0), 0, .1); clock += dt;
      if (!D.enabled) { overlay.hidden = true; return; } overlay.hidden = false;
      if (clock >= syncAt) { sync(); syncAt = clock + .12; }
      // Source #view has already rendered the preceding game frame. No duplicate RAF.
      field.step(dt); drawAir(field.still || !field.running ? 0 : dt); updateReader();
      D.drops = field.particles; D.beads = field.getItems(); D.streaks = field.trails;
      D.msgs = D.msgs.filter(M => M.endedAt === null || clock - M.endedAt < 18);
      for (const [id, M] of messages) if (M.endedAt !== null && clock - M.endedAt > 60) messages.delete(id);
    };
    D.destroy = () => {
      dead = true; clearTimeout(blankHold && blankHold.timer); listeners.forEach(off => off());
      field.destroy(); overlay.remove(); reader.remove(); access.remove(); rainControls.remove(); style.remove();
      document.body.classList.remove('rain-game-skin', 'dew-skin');
    };
    sync(); return D;
  };
  window.DEW_GAME_ADAPTER_VERSION = '1.0.0';
})();
