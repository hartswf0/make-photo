const KIT_BASE = (document.currentScript && document.currentScript.src) || location.href;
// The standard bridge between a world and the one game surface. A world describes itself; the kit supplies the shared
// rules: the 20 L can with its 4 L chalk, Mistletoe's thirst, a draw at the world's water, the carry between worlds,
// and the way back out to the archipelago at the place you stand.
//   DWBridge({ canvas, camera(), me() -> {x,y,z,speed}, donkey() -> {x,y,z}|null, water() -> {x,y,z}|null,
//              place() -> {id, name}, mode() -> 'walk'|'ride'|'drive'|'glide', exit() -> label|null, leave(),
//              steer(x,y,active), look(dx,dy), jump(), menu() -> [{id,label,on,run}], atlas() -> {mx,mz}|null })
window.DWBridge = function (W) {
  const T = W.THREE || window.THREE, V = new T.Vector3(), carry = window.DW && window.DW.carry;
  const S = { liters: carry && Number.isFinite(carry.liters) ? carry.liters : 12, dk: carry && Number.isFinite(carry.donkey) ? carry.donkey : .8, t: performance.now() };
  setInterval(() => { const now = performance.now(); S.dk = Math.max(0, S.dk - (now - S.t) / 1000 * .0025); S.t = now; }, 500);
  const proj = (x, y, z) => { V.set(x, y, z).project(W.camera()); return { x: (V.x * .5 + .5) * innerWidth, y: (-V.y * .5 + .5) * innerHeight, front: V.z < 1 }; };
  const sc = (x, y, z) => Math.abs(proj(x, y, z).y - proj(x, y + 1, z).y);
  const near = (a, b) => a && b ? Math.hypot(a.x - b.x, a.z - b.z) : 1e9;
  const out = () => { const a = W.atlas && W.atlas(); return new URL(`../../atlas/overworld.html${a ? `?mx=${Math.round(a.mx)}&mz=${Math.round(a.mz)}` : ''}`, KIT_BASE).href; };   // from the kit's own folder, so a level at any depth finds its way home
  window.AhiyaBridge = { version: 1, canvas: W.canvas,
    state() { const me = W.me(), d = W.donkey && W.donkey(), w = W.water && W.water(), wd = near(me, w), pl = W.place(), ex = W.exit && W.exit();
      const live = W.mode() === 'walk' && w && wd < 16 && S.liters < 19.9 ? { kind: 'draw', id: 'draw', label: 'Draw', delta: 20 - S.liters, ...proj(w.x, w.y + 1.5, w.z) } : null;
      const a = W.atlas && W.atlas();
      return { ready: true, clock: performance.now() / 1000, lang: 'en',
        water: { liters: S.liters, capacity: 20, reserve: 4, donkey: S.dk, donkeyDown: S.dk < .05 },
        place: { id: pl.id, name: pl.name, next: null, visited: [] }, signal: 1, mode: W.mode(), speed: Math.abs(me.speed || 0),
        exit: ex ? { id: 'down', label: ex } : null, live, busy: false, speech: null, said: null,
        lens: { focus: 18, filter: 0, filterName: 'Clear', filters: ['Clear'], stop: 0, stopName: 'f/8', stops: ['f/8'], mode: 0, modeName: '', modes: [''], tilt: 0, plates: 0 },
        map: { stops: [], me: [0, 0], donkey: [0, 0], heading: 0 },
        things: { can: { ...proj(me.x, me.y + 1, me.z), s: sc(me.x, me.y, me.z), dist: 0 }, donkey: d ? { ...proj(d.x, d.y + 1.4, d.z), s: sc(d.x, d.y, d.z), dist: near(me, d), wx: d.x, wz: d.z } : null,
          source: w ? { ...proj(w.x, w.y + 1, w.z), s: sc(w.x, w.y, w.z), dist: wd, wx: w.x, wz: w.z } : null, people: [], next: null, wagon: null },
        pos: { x: me.x, z: me.z, yaw: 0 }, atlas: a ? { base: '../atlas/', mx: a.mx, mz: a.mz } : null, sound: { voices: false, tape: false, radio: false } }; },
    act: {
      live() { const w = W.water && W.water(); if (w && near(W.me(), w) < 16) S.liters = 20; return true; },
      exit() { W.leave && W.leave(); }, steer: (x, y, a) => W.steer(x, y, a), look: (dx, dy) => W.look && W.look(dx, dy), jump: () => W.jump && W.jump(),
      lean(kind, litres) { const me = W.me();
        if (kind === 'draw') { const w = W.water && W.water(); if (!w || near(me, w) > 30) return 0; const a = Math.min(litres, 20 - S.liters); S.liters += a; return a; }
        if (kind === 'donkey') { const a = Math.min(litres, S.liters, (1 - S.dk) * 8); if (a <= 0) return 0; S.liters -= a; S.dk = Math.min(1, S.dk + a / 8); return a; } return 0; },
      restore(sn) { if (sn && Number.isFinite(sn.liters)) S.liters = sn.liters; if (sn && Number.isFinite(sn.donkey)) S.dk = sn.donkey; return true; },
      warp() { return false; }, travel() { return false; }, overworld() { window.DW ? window.DW.go(out()) : (location.href = out()); },
      say() { }, focus() { }, set() { }, lang() { }, expose() { }, lastPlate() { return null; }, begin() { } },
    menu: () => (W.menu ? W.menu() : []).map(m => ({ group: 'Go', value: '', ...m })),
    chart: { draw() { }, uv() { return null; }, hit() { return null; } } };
  return window.AhiyaBridge;
};
