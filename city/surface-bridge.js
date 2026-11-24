// The Nolli Block (city.js) on the one game surface, through the standard kit (night-post/rain/bridge-kit.js): phone steering,
// the same drops and carry, the city's own looks on the lens, and the way back to the archipelago at the WYGWYL coast.
(async () => {
  const C = await new Promise(ok => (function t() { const w = window.__CITY__; if (w && w.player && w.keys && w.THREE && window.DWBridge) ok(w); else setTimeout(t, 250); })());
  const ARCH = await fetch('../atlas/archipelago.json?v=3').then(r => r.json()).catch(() => null), isl = ARCH && ARCH.islands.find(i => i.id === 'wygwyl');
  const K = C.keys, pl = C.player, su = C.suite, tap = k => { const code = k === ' ' ? 'Space' : 'Key' + k.toUpperCase(); dispatchEvent(new KeyboardEvent('keydown', { key: k, code })); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { key: k, code })), 140); };
  const ST = { x: 0, y: 0 }; let last = performance.now();
  (function turn(now) { const dt = Math.min(.05, (now - last) / 1000); last = now; if (Math.abs(ST.x) > .12) pl.yaw -= Math.sign(ST.x) * (Math.abs(ST.x) - .12) * (pl.isInside ? 1.9 : 2.4) * dt; requestAnimationFrame(turn); })(last);
  window.DWBridge({ THREE: C.THREE, canvas: C.renderer.domElement, camera: () => C.camera,
    me: () => ({ x: pl.pos.x, y: pl.floorY || 0, z: pl.pos.z, speed: (K.w || K.s || K.a || K.d) ? pl.speed : 0 }), donkey: () => null, water: () => null,
    place: () => ({ id: 'wygwyl', name: 'The Nolli Block' }), mode: () => 'walk', exit: () => null,
    steer(x, y, a) { ST.x = a ? x : 0; ST.y = a ? y : 0; K.w = a && y < -.2; K.s = a && y > .35; K.shift = a && y < -.92; },   // sideways turns you, as in the trough; it never strafes
    look(dx, dy) { pl.yaw -= dx * .0042; if (Number.isFinite(pl.pitch)) pl.pitch = Math.max(-.6, Math.min(.6, pl.pitch - (dy || 0) * .003)); },
    jump() { tap(' '); },
    looks: () => su ? { names: su.looks.map(l => l.name), index: su.looks.findIndex(l => l.id === su.getState().lookId) } : null,
    setLook: i => { if (su && su.looks[i]) { su.setLook(su.looks[i].id, true); if (C.camState) C.camState.stock = su.looks[i].id; } },
    menu: () => [{ id: 'talk', label: 'talk', run: () => tap('e') }, { id: 'use', label: 'use', run: () => tap('f') },
      { id: 'wings', label: 'wings', on: !!(C.poetHero && C.poetHero.embodied), run: () => C.togglePoetHeroEmbodiment && C.togglePoetHeroEmbodiment() },
      { id: 'coat', label: 'wardrobe', run: () => C.cyclePoetHeroWardrobe && C.cyclePoetHeroWardrobe() },
      { id: 'door', label: 'Severn door', on: !!C.doorOpen, run: () => C.setSevernDoor && C.setSevernDoor(!C.doorOpen) },
      { id: 'xray', label: 'x-ray', run: () => C.toggleXray && C.toggleXray() }, { id: 'plate', label: 'expose', run: () => C.capturePlate && C.capturePlate() },
      { id: 'run', label: 'run', on: !!K.shift, run: () => { K.shift = !K.shift; } }],
    atlas: () => isl ? { mx: isl.center[0] * 1000, mz: (isl.center[1] + isl.size[1] / 2) * 1000 - 400 } : null });
})();
