// zones (THRESHOLD, the Grand Teton western basin) on the one game surface. Its frame is the Teton survey's, the same
// frame as the archipelago's Grand Teton island, so Map and the way out land exactly where you stand.
(async () => {
  const Z = await new Promise(ok => (function t() { const w = window.__zones; if (w && w.surface && w.isReady() && window.DWBridge) ok(w); else setTimeout(t, 250); })());
  const ARCH = await fetch('../atlas/archipelago.json?v=1').then(r => r.json()).catch(() => null), U = Z.surface, st = U.state;
  const teton = ARCH && ARCH.islands.find(i => i.id === 'teton');
  window.DWBridge({ canvas: U.canvas, camera: U.camera,
    me: () => { const s = st(); return { x: s.x, y: s.y - 1.6, z: s.z, speed: Math.hypot(s.vx || 0, s.vz || 0) }; },
    donkey: () => { const d = U.donkey(); return d ? { x: d.state.x, y: d.group.position.y, z: d.state.z } : null; },
    water: () => ({ x: -45, y: U.groundAt(-45, 1.4), z: 1.4 }),                                   // the Overlook Rim wellhead
    place: () => ({ id: 'teton', name: 'GRAND TETON' }),
    mode: () => { const s = st(); return s.gliding ? 'glide' : s.drivingCart ? 'drive' : s.riding ? 'ride' : 'walk'; },
    exit: () => { const s = st(); return s.gliding ? 'Come down' : s.riding ? 'Get down' : s.drivingCart ? 'Park the wagon' : null; },
    leave: () => { const s = st(); if (s.gliding) U.toggleGlide(); else if (s.riding) U.toggleRide(); else if (s.drivingCart) U.toggleCart(); },
    steer: (x, y, a) => U.steer(x, y, a), look: (dx, dy) => U.look(dx, dy), jump: () => U.jump(),
    menu: () => { const s = st(); return [{ id: 'ride', label: 'donkey', on: !!s.riding, run: () => U.toggleRide() }, { id: 'glide', label: 'glide', on: !!s.gliding, run: () => U.toggleGlide() }, { id: 'drive', label: 'wagon', on: !!s.drivingCart, run: () => U.toggleCart() }]; },
    atlas: () => { if (!teton || !teton.frame) return null; const s = st(), f = teton.frame; return { mx: (teton.center[0] - teton.size[0] / 2 + (s.x - f.x0) / f.w * teton.size[0]) * 1000, mz: (teton.center[1] - teton.size[1] / 2 + (s.z - f.z0) / f.h * teton.size[1]) * 1000 }; } });
})();
