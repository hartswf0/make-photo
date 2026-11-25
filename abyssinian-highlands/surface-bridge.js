// The Abyssinian roof on the one game surface. From orbit or aerial view the surface rests; on the ground it is Imani's.
(async () => {
  const A = await new Promise(ok => (function t() { const w = window.__abyss; if (w && w.surface && window.DWBridge) ok(w); else setTimeout(t, 250); })());
  const ARCH = await fetch('../atlas/archipelago.json?v=1').then(r => r.json()).catch(() => null), U = A.surface;
  const me = () => { const p = U.player(); return A.S.mode === 'walk' ? p : { x: A.GC.x, y: A.GC.y, z: A.GC.z, speed: 0 }; };
  window.DWBridge({ canvas: A.renderer.domElement, camera: () => A.S.mode === 'orbit' ? A.camOrb : A.camGnd,
    me, donkey: () => { const d = U.donkey(); return d && A.S.mode === 'walk' ? { x: d.state.x, y: d.group.position.y, z: d.state.z } : null; },
    water: () => { const lm = U.landmarks(); return lm && lm.relayPos ? { x: lm.relayPos.x, y: U.ground(lm.relayPos.x, lm.relayPos.z), z: lm.relayPos.z } : null; },
    place: () => { const isl = ARCH && ARCH.islands.find(i => i.id === A.S.region); return { id: A.S.region || 'orbit', name: A.S.mode === 'orbit' ? 'the roof of Africa' : isl ? isl.name : (A.S.region || '') }; },
    mode: () => A.S.mode === 'walk' ? 'walk' : 'glide', exit: () => A.S.mode === 'walk' ? null : A.S.mode === 'aerial' ? 'Walk here' : null, leave: () => U.walk(),
    steer(x, y, a) { const k = U.stick(); k.active = !!a; k.dx = a ? x : 0; k.dy = a ? y : 0; },
    look(dx, dy) { A.GC.yaw -= dx * .0055; A.GC.pitch = Math.max(-.1, Math.min(1.45, A.GC.pitch + dy * .0045)); },
    menu: () => [{ id: 'glide', label: A.S.mode === 'walk' ? 'aerial' : 'walk', on: A.S.mode !== 'walk', run: () => A.S.mode === 'walk' ? U.up() : U.walk() },
      { id: 'run', label: 'run', on: !!U.keys().ShiftLeft, run: () => { const k = U.keys(); k.ShiftLeft = !k.ShiftLeft; } }],
    atlas: () => { const isl = ARCH && ARCH.islands.find(i => i.id === A.S.region), p = me(); const F = isl && (isl.full || isl); return isl ? { mx: (F.center[0] - F.size[0] / 2 + (p.x / 2400 + .5) * F.size[0]) * 1000, mz: (F.center[1] - F.size[1] / 2 + (p.z / 2400 + .5) * F.size[1]) * 1000 } : null; } });
})();
