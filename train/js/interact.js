// The game layer: things to walk up to. Anything with a position can offer a panel of facts and verbs
// (the passengers, the doors, the thresholds, the cans) and every carriage holds the worlds poured into it
// as ticket stubs to find. One system for the traveler and for the bee.
import * as THREE from 'three';
import { DIM } from './kit.js';

const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };

export function createInteract({ scene, cars, camera, stub }) {
  const items = [], game = { stubCars: new Set(), stubs: new Set(), total: 0, talked: new Set(), inv: [], veil: false, water: 12 };
  let open = null, near = null;
  const v = new THREE.Vector3(), T = it => typeof it.title === 'function' ? it.title() : it.title;
  /** item: { id, car, at:[x,y,z] local to the carriage (or pos(): Vector3), title, kicker, rows(): [[k, v]], verbs(): [{ label, run }], radius, gone } */
  function add(it) { it.radius = it.radius || 1.5; it.world = new THREE.Vector3(); items.push(it); return it; }
  const where = it => it.pos ? it.world.copy(it.pos()) : it.world.set(cars[it.car].x + it.at[0], DIM.FLOOR + it.at[1], it.at[2]);

  // ---- the corpus lives in the props: each thing in a carriage keeps the stubs of the worlds it stands for
  const norm = x => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  let tags = null, holders = [];
  async function loadCorpus(props) {
    const data = (await (await fetch('data/corpus.json')).json()).stubs; game.total = data.length;
    const left = new Set(data);
    for (const pr of props) { pr.stubs = []; for (const s of [...left]) if (s.car === pr.car && pr.worlds.some(w => norm(s.name).includes(w))) { pr.stubs.push(s); left.delete(s); } }
    for (const s of left) { const inCar = props.filter(p => p.car === s.car); if (!inCar.length) continue; inCar.sort((a, b) => a.stubs.length - b.stubs.length)[0].stubs.push(s); }   // every world rides somewhere
    tags = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.035, 0), new THREE.MeshBasicMaterial({ color: 0xf2c14a }), props.length); tags.frustumCulled = false; scene.add(tags);
    props.forEach((pr, k) => { let read = 0; const mine = () => pr.stubs.filter(s => !game.stubs.has(s.uid));
      const it = add({ id: 'prop' + k, car: pr.car, at: pr.at, radius: 1.35, index: k, prop: pr, kicker: () => `${cars[pr.car].name} · ${pr.stubs.length} world${pr.stubs.length === 1 ? '' : 's'}`, title: pr.title,
        rows: () => { const s = pr.stubs[read % Math.max(1, pr.stubs.length)]; return s ? [['World', `${s.uid} ${s.name}`], ['From', s.chapter], ['Holds', s.holds.slice(0, 2).join(', ') || '—'], ['Stubs here', `${pr.stubs.length - mine().length} of ${pr.stubs.length} taken`]] : [['Stubs here', 'none']]; },
        verbs: () => [...(mine().length ? [{ label: `Take ${mine().length} stub${mine().length === 1 ? '' : 's'}`, run: () => { const n = mine(); n.forEach(s => game.stubs.add(s.uid)); game.stubCars.add(pr.car); stub(pr.title, `${n.length} stub${n.length === 1 ? '' : 's'} · ${game.stubs.size} of ${game.total}`); return true; } }] : []),
          ...(pr.stubs.length > 1 ? [{ label: 'Read the next', run: () => { read++; it.note = pr.stubs[read % pr.stubs.length].what; return true; } }] : [])] });
      it.note = pr.stubs[0] ? pr.stubs[0].what : ''; it.left = mine; holders.push(it); });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3();
  function drawStubs(t, camCar) {
    if (!tags) return;
    for (const it of holders) { const show = game.mode !== 'game' && it.left().length && Math.abs(it.car - camCar) <= 1; where(it); e.set(0, t * 1.5 + it.index, 0); q.setFromEuler(e); one.setScalar(show ? 1 : 0); v.copy(it.world).y += .32 + Math.sin(t * 2 + it.index) * .03; m4.compose(v, q, one); tags.setMatrixAt(it.index, m4); }
    tags.instanceMatrix.needsUpdate = true;
  }

  // ---- the panel
  function show(it) {
    open = it; const p = $('panel'); p.hidden = false; $('pKicker').textContent = typeof it.kicker === 'function' ? it.kicker() : it.kicker || ''; $('pTitle').textContent = T(it);
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
