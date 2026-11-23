// Ethiopia Highlands on the one game surface. Reads window.__ethiopiaWorld and offers it to night-post/rain/surface.js
// through window.AhiyaBridge: the same water (can, Mistletoe's thirst, a draw at the standpipe relay), the same ways
// of moving, and Map opening the archipelago at this tile's real place.
(async () => {
  const wait = () => new Promise(ok => (function t() { const w = window.__ethiopiaWorld; if (w && w.getState && w.getState().player) ok(w); else setTimeout(t, 250); })());
  const E = await wait(), T = window.THREE, cam = E.camera, V = new T.Vector3();
  const ARCH = await fetch('../atlas/archipelago.json?v=1').then(r => r.json()).catch(() => null);
  const W = { liters: 12, dk: .8 }; let last = performance.now();
  const proj = (x, y, z) => { V.set(x, y, z).project(cam); return { x: (V.x * .5 + .5) * innerWidth, y: (-V.y * .5 + .5) * innerHeight, front: V.z < 1 }; };
  const sc = (x, y, z) => Math.abs(proj(x, y, z).y - proj(x, y + 1, z).y);
  const relay = () => { const lm = E.landmarks(); return lm && lm.relayPos ? lm.relayPos : null; };
  const H = (x, z) => E.heightAt(x, z);
  setInterval(() => { const now = performance.now(); W.dk = Math.max(0, W.dk - (now - last) / 1000 * .0025); last = now; }, 500);
  const MODE = { walk: 'walk', glider: 'glide', drone: 'drive' };
  window.AhiyaBridge = { version: 1, canvas: E.renderer.domElement,
    state() { const s = E.getState(), p = s.player, d = s.donkey, r = relay(), rd = r ? Math.hypot(p.x - r.x, p.z - r.z) : 1e9, me = s.mode === 'glider' ? s.glider : p;
      const isl = ARCH && ARCH.islands.find(i => i.id === s.regionId), span = 2400;
      const atlas = isl ? { base: '../atlas/', mx: (isl.center[0] - isl.size[0] / 2 + (me.x / span + .5) * isl.size[0]) * 1000, mz: (isl.center[1] - isl.size[1] / 2 + (me.z / span + .5) * isl.size[1]) * 1000 } : null;
      const live = s.mode === 'walk' && r && rd < 14 && W.liters < 19.9 ? { kind: 'draw', id: 'draw', label: 'Draw', delta: 20 - W.liters, ...proj(r.x, H(r.x, r.z) + 1.5, r.z) } : null;
      return { ready: true, clock: performance.now() / 1000, lang: 'en',
        water: { liters: W.liters, capacity: 20, reserve: 4, donkey: W.dk, donkeyDown: W.dk < .05 },
        place: { id: s.regionId, name: (isl && isl.name) || s.regionId, next: null, visited: [] }, signal: 1,
        mode: MODE[s.mode] || 'walk', speed: Math.abs(p.speed || 0), exit: s.mode !== 'walk' ? { id: 'down', label: s.mode === 'glider' ? 'Land' : 'Back to Imani' } : null,
        live, busy: false, speech: null, said: null,
        lens: { focus: 18, filter: 0, filterName: 'Clear', filters: ['Clear'], stop: 0, stopName: 'f/8', stops: ['f/8'], mode: 0, modeName: '', modes: [''], tilt: 0, plates: 0 },
        map: { stops: [], me: [0, 0], donkey: [0, 0], heading: 0 },
        things: { can: { ...proj(p.x, p.y + 1, p.z), s: sc(p.x, p.y, p.z), dist: 0 }, donkey: d ? { ...proj(d.x, d.y + 1.4, d.z), s: sc(d.x, d.y, d.z), dist: Math.hypot(d.x - p.x, d.z - p.z), wx: d.x, wz: d.z } : null,
          source: r ? { ...proj(r.x, H(r.x, r.z) + 1, r.z), s: sc(r.x, H(r.x, r.z), r.z), dist: rd, wx: r.x, wz: r.z } : null, people: [], next: null, wagon: null },
        pos: { x: p.x, z: p.z, yaw: 0 }, atlas, sound: { voices: false, tape: false, radio: false } }; },
    act: {
      live() { const r = relay(); if (r) W.liters = 20; return true; },
      exit() { E.setMode('walk'); },
      steer(x, y, active) { const st = E.input.touchStick; st.active = !!active; st.dx = active ? x : 0; st.dy = active ? y : 0; },
      look(dx, dy) { const o = E.input.orbit; o.yaw -= dx * .006; o.pitch = Math.max(-.2, Math.min(1.2, o.pitch + dy * .004)); },
      jump() { E.input.keys.Space = true; setTimeout(() => E.input.keys.Space = false, 120); },
      lean(kind, litres) { const s = E.getState(), p = s.player;
        if (kind === 'draw') { const r = relay(); if (!r || Math.hypot(p.x - r.x, p.z - r.z) > 30) return 0; const a = Math.min(litres, 20 - W.liters); W.liters += a; return a; }
        if (kind === 'donkey') { const a = Math.min(litres, W.liters, (1 - W.dk) * 8); if (a <= 0) return 0; W.liters -= a; W.dk = Math.min(1, W.dk + a / 8); return a; } return 0; },
      restore(sn) { if (sn && Number.isFinite(sn.liters)) W.liters = sn.liters; if (sn && Number.isFinite(sn.donkey)) W.dk = sn.donkey; return true; },
      warp() { return false; }, travel(id) { E.loadRegion(id); return true; },
      say() { }, focus() { }, set() { }, lang() { }, expose() { }, lastPlate() { return null; }, begin() { } },
    menu() { const s = E.getState(), it = (id, label, on, run) => ({ id, group: 'Go', label, value: '', on, run });
      return [it('glide', 'glide', s.mode === 'glider', () => E.setMode(s.mode === 'glider' ? 'walk' : 'glider')), it('cam', 'drone', s.mode === 'drone', () => E.setMode(s.mode === 'drone' ? 'walk' : 'drone')),
        it('jump', 'lookout', false, () => E.teleportTo('lookout')), it('run', 'run', false, () => { E.input.keys.ShiftLeft = !E.input.keys.ShiftLeft; })]; },
    chart: { draw() { }, uv() { return null; }, hit() { return null; } } };
})();
