// The game layer: things to walk up to. Anything with a position can offer a panel of facts and verbs
// (the passengers, the doors, the thresholds, the cans) and every carriage holds the worlds poured into it
// as ticket stubs to find. One system for the traveler and for the bee.
import * as THREE from 'three';
import { DIM } from './kit.js';

const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };

export function createInteract({ scene, cars, camera, stub }) {
  const items = [], game = { stubs: new Set(), total: 0, talked: new Set(), inv: [], veil: false, water: 12 };
  let open = null, near = null;
  const v = new THREE.Vector3(), T = it => typeof it.title === 'function' ? it.title() : it.title;
  /** item: { id, car, at:[x,y,z] local to the carriage (or pos(): Vector3), title, kicker, rows(): [[k, v]], verbs(): [{ label, run }], radius, gone } */
  function add(it) { it.radius = it.radius || 1.5; it.world = new THREE.Vector3(); items.push(it); return it; }
  const where = it => it.pos ? it.world.copy(it.pos()) : it.world.set(cars[it.car].x + it.at[0], DIM.FLOOR + it.at[1], it.at[2]);

  // ---- ticket stubs: one per world of the corpus, hanging beside the aisle of the carriage it was poured into
  const geo = new THREE.BoxGeometry(.19, .11, .012), mat = new THREE.MeshBasicMaterial({ color: 0xf2c14a });
  let stubs = null, stubItems = [];
  async function loadCorpus() {
    const data = (await (await fetch('data/corpus.json')).json()).stubs; game.total = data.length;
    stubs = new THREE.InstancedMesh(geo, mat, data.length); stubs.frustumCulled = false; scene.add(stubs);
    const by = {}; for (const s of data) (by[s.car] = by[s.car] || []).push(s);
    for (const [ci, list] of Object.entries(by)) { const c = cars[ci], n = list.length;
      list.forEach((s, k) => { const x = DIM.L / 2 - 1.6 - (k + .5) * (DIM.L - 3.6) / n, side = k % 2 ? 1 : -1, z = c.aisleZ + side * (c.aisleHalf + .16), y = 1.0 + ((k * 7) % 5) * .09;
        const it = add({ id: s.uid, car: +ci, at: [x, y, z], radius: 1.15, stub: s, index: stubItems.length, kicker: `${s.uid} · ${s.chapter}`, title: s.name,
          rows: () => [['Kind', s.kind || s.genre || 'world'], ['Holds', s.holds.slice(0, 2).join(', ') || '—'], ['Does', s.does || '—'], ['Stub', game.stubs.has(s.uid) ? 'Taken' : 'Hanging here']],
          note: s.what, verbs: () => game.stubs.has(s.uid) ? [] : [{ label: 'Take the stub', run: () => { game.stubs.add(s.uid); it.gone = true; stub(s.name, `stub ${game.stubs.size} of ${game.total} · ${s.chapter}`); return true; } }] });
        stubItems.push(it); }); }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3();
  function drawStubs(t, camCar) {
    if (!stubs) return;
    for (const it of stubItems) { const show = !it.gone && Math.abs(it.car - camCar) <= 1; where(it); e.set(0, t * 1.2 + it.index, Math.sin(t * 2 + it.index) * .1); q.setFromEuler(e); one.setScalar(show ? 1 : 0);
      v.copy(it.world).y += Math.sin(t * 1.6 + it.index) * .03; m4.compose(v, q, one); stubs.setMatrixAt(it.index, m4); }
    stubs.instanceMatrix.needsUpdate = true;
  }

  // ---- the panel
  function show(it) {
    open = it; const p = $('panel'); p.hidden = false; $('pKicker').textContent = it.kicker || ''; $('pTitle').textContent = T(it);
    const rows = $('pRows'); rows.textContent = ''; for (const [k, val] of it.rows ? it.rows() : []) { const r = el('div', 'row'); r.append(el('span', '', k), el('b', '', val)); rows.append(r); }
    $('pNote').textContent = it.note || ''; $('pNote').hidden = !it.note;
    const vs = $('pVerbs'); vs.textContent = ''; (it.verbs ? it.verbs() : []).forEach((vb, k) => { const b = el('button', 'verb'); b.append(el('kbd', '', String(k + 1)), el('span', '', vb.label)); b.onclick = () => run(k); vs.append(b); });
  }
  function close() { open = null; $('panel').hidden = true; }
  function run(k) { if (!open) return false; const vb = (open.verbs ? open.verbs() : [])[k]; if (!vb) return false; const it = open, keep = vb.run(it); if (keep === false || it.gone && !keep) close(); else if (open === it) show(it); if (it.gone) close(); return true; }
  $('pBack').onclick = close;

  /** Called each frame with where the player (traveler or bee) is. Returns the item in reach. */
  function update(pos, t, camCar) {
    drawStubs(t, camCar); near = null; let bd = 1e9;
    for (const it of items) { if (it.gone || (it.car !== undefined && Math.abs(it.car - camCar) > 1)) continue; const d = where(it).distanceTo(pos); if (d < it.radius && d < bd) { bd = d; near = it; } }
    if (open && (!near || near !== open) && where(open).distanceTo(pos) > open.radius + .9) close();
    const hint = $('hint');
    if (near && !open) { v.copy(near.world).project(camera); const on = v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1; hint.hidden = !on; if (on) { hint.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; hint.style.top = ((1 - v.y) / 2 * innerHeight - 26) + 'px'; hint.textContent = T(near); } }
    else hint.hidden = true;
    return near;
  }
  /** E: open what is near, or do its first verb if it is already open. */
  function act() { if (open) { if (!run(0)) close(); return true; } if (near) { show(near); return true; } return false; }
  return { add, update, act, label: () => near ? (open === near ? ((near.verbs ? near.verbs() : [])[0] || { label: 'Back' }).label : 'Inspect · ' + T(near)) : null, run, close, loadCorpus, game, get open() { return open; }, get near() { return near; }, items };
}
