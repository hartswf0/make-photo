// WYGWYL's level page on the one game surface, through the standard kit (night-post/rain/bridge-kit.js): the same drops, the same
// steering on a phone (the page had keys only), the same carry and the same way back to the archipelago as every other level.
(async () => {
  const I = await new Promise(ok => (function t() { const w = window.__island; if (w && w.state && w.keys && window.DWBridge) ok(w); else setTimeout(t, 250); })());
  const ARCH = await fetch('../../atlas/archipelago.json?v=4').then(r => r.json()).catch(() => null), isl = ARCH && ARCH.islands.find(i => i.id === 'wygwyl');
  const S = I.state, K = I.keys, tap = k => { dispatchEvent(new KeyboardEvent('keydown', { key: k })); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { key: k })), 140); };
  window.DWBridge({ THREE: I.THREE, canvas: document.getElementById('gl'), camera: () => I.camera,
    me: () => ({ x: S.px, y: S.py, z: S.pz, speed: Math.abs(S.moveSpeed || 0) }), donkey: () => null, water: () => null,
    place: () => ({ id: 'wygwyl', name: (document.getElementById('hud-region') || {}).textContent || 'WYGWYL' }),
    mode: () => S.mode === 'drive' ? 'drive' : 'walk', exit: () => S.mode === 'drive' ? 'Get out' : null, leave: () => tap('f'),
    steer(x, y, a) { K.w = K.arrowup = a && y < -.25; K.s = K.arrowdown = a && y > .25; K.a = K.arrowleft = a && x < -.25; K.d = K.arrowright = a && x > .25; K.shift = a && Math.hypot(x, y) > .92; },
    look(dx) { S.camYaw = (S.camYaw || 0) - dx * .006; },
    jump() { tap(' '); },
    looks: () => { const su = I.suite; if (!su) return null; const id = su.getState().lookId; return { names: su.looks.map(l => l.name), index: su.looks.findIndex(l => l.id === id) }; },
    setLook: i => { const su = I.suite; if (su && su.looks[i]) su.setLook(su.looks[i].id, true); },
    menu: () => [{ id: 'drive', label: 'drive', on: S.mode === 'drive', run: () => tap('f') }, { id: 'door', label: 'Severn door', run: () => I.toggleSevernDoor && I.toggleSevernDoor() },
      { id: 'parcel', label: 'parcel', run: () => I.cycleParcelHandoff && I.cycleParcelHandoff() }, { id: 'run', label: 'run', on: !!K.shift, run: () => { K.shift = !K.shift; } }],
    atlas: () => isl ? { mx: (isl.center[0] - isl.size[0] / 2) * 1000 + S.px, mz: (isl.center[1] - isl.size[1] / 2) * 1000 + S.pz } : null });
})();
