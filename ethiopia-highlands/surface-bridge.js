// Ethiopia Highlands on the one game surface, through the standard kit (night-post/rain/bridge-kit.js).
(async () => {
  const E = await new Promise(ok => (function t() { const w = window.__ethiopiaWorld; if (w && w.getState && w.getState().player && window.DWBridge) ok(w); else setTimeout(t, 250); })());
  const ARCH = await fetch('../atlas/archipelago.json?v=1').then(r => r.json()).catch(() => null);
  const st = () => E.getState(), me = () => { const s = st(); return s.mode === 'glider' ? { ...s.glider, speed: 0 } : s.player; };
  window.DWBridge({ canvas: E.renderer.domElement, camera: () => E.camera,
    me, donkey: () => st().donkey, water: () => { const lm = E.landmarks(); return lm && lm.relayPos ? { x: lm.relayPos.x, y: E.heightAt(lm.relayPos.x, lm.relayPos.z), z: lm.relayPos.z } : null; },
    place: () => { const s = st(), isl = ARCH && ARCH.islands.find(i => i.id === s.regionId); return { id: s.regionId, name: isl ? isl.name : s.regionId }; },
    mode: () => ({ walk: 'walk', glider: 'glide', drone: 'drive' })[st().mode] || 'walk', exit: () => st().mode === 'walk' ? null : st().mode === 'glider' ? 'Land' : 'Back to Imani', leave: () => E.setMode('walk'),
    steer(x, y, a) { const k = E.input.touchStick; k.active = !!a; k.dx = a ? x : 0; k.dy = a ? y : 0; },
    look(dx, dy) { const o = E.input.orbit; o.yaw -= dx * .006; o.pitch = Math.max(-.2, Math.min(1.2, o.pitch + dy * .004)); },
    jump() { E.input.keys.Space = true; setTimeout(() => E.input.keys.Space = false, 120); },
    menu: () => { const s = st(); return [{ id: 'glide', label: 'glide', on: s.mode === 'glider', run: () => E.setMode(s.mode === 'glider' ? 'walk' : 'glider') }, { id: 'cam', label: 'drone', on: s.mode === 'drone', run: () => E.setMode(s.mode === 'drone' ? 'walk' : 'drone') },
      { id: 'jump', label: 'lookout', run: () => E.teleportTo('lookout') }, { id: 'run', label: 'run', on: !!E.input.keys.ShiftLeft, run: () => { E.input.keys.ShiftLeft = !E.input.keys.ShiftLeft; } }]; },
    atlas: () => { const s = st(), isl = ARCH && ARCH.islands.find(i => i.id === s.regionId), p = me(); const F = isl && (isl.full || isl); return isl ? { mx: (F.center[0] - F.size[0] / 2 + (p.x / 2400 + .5) * F.size[0]) * 1000, mz: (F.center[1] - F.size[1] / 2 + (p.z / 2400 + .5) * F.size[1]) * 1000 } : null; } });
})();
