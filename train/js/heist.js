// The heist: the train as a run of rooms to rob, in the manner of Void Bastards. A map you can read at a glance and tap to travel,
// SPAM to pick up, rob out of things and people, and throw. Everything a thumb needs is two buttons and a stick.
import * as THREE from 'three';
import { DIM, clamp } from './kit.js';

const { L, FLOOR: F } = DIM;
const $ = id => document.getElementById(id);
const SHORT = ['ENGINE', 'QUIET', 'DINING', 'GARDEN', 'APIARY', 'MIRROR', 'WATCH', 'CINEMA', 'HIVE'];
export const QUOTA = 20;

export function createHeist({ scene, cars, train, props, people, actor, state, stub, deed, game, sys, audio }) {
  const H = { spam: 0, robbed: 0, thrown: 0, done: false, decoyUntil: 0, loose: [], left: cars.map(() => 0) };
  // ---- the can: drawn, not borrowed
  const label = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 192; const q = c.getContext('2d'); q.fillStyle = '#17307a'; q.fillRect(0, 0, 256, 192); q.fillStyle = '#ffd92e'; q.font = '900 78px Arial Black, Impact, sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('SPAM', 128, 62, 236);
    q.fillStyle = '#e9a26a'; q.fillRect(36, 112, 184, 52); q.fillStyle = '#c96a4a'; q.fillRect(36, 132, 184, 14); q.fillStyle = '#fff'; q.font = '700 16px Arial'; q.fillText('TINNED · 340 g', 128, 178); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const canGeo = new THREE.BoxGeometry(.24, .18, .15), side = new THREE.MeshStandardMaterial({ map: label, roughness: .4, metalness: .3 }), lid = new THREE.MeshStandardMaterial({ color: 0xb9bfc2, metalness: .9, roughness: .3 });
  const canMats = [side, side, lid, lid, side, side], mk = () => { const m = new THREE.Mesh(canGeo, canMats); m.castShadow = true; scene.add(m); return m; };
  // loose cans: three in the aisle of every carriage, a table of them in the quiet car
  cars.forEach(c => { if (c.i === 0) return; const n = c.i === 1 ? 6 : 3;
    for (let k = 0; k < n; k++) { const m = mk(), x = c.x + L / 2 - 3 - k * ((L - 6) / n) - (c.i * .7 % 1), z = c.aisleZ + (k % 2 ? .24 : -.24); m.position.set(x, F + .1, z); m.rotation.y = k * 1.3; H.loose.push({ m, car: c.i, x, z }); H.left[c.i]++; } });
  // hidden cans: in the things and on the people
  for (const pr of props) { pr.loot = 1 + (pr.title.length % 3); H.left[pr.car] += pr.loot; }
  const pocket = new Map();
  const throwsPool = []; for (let k = 0; k < 6; k++) { const m = mk(); m.visible = false; throwsPool.push({ m, v: new THREE.Vector3(), live: 0, rest: 0 }); }

  // ---- the map: every carriage, where you are, what is left to take
  const map = $('map');
  cars.forEach(c => { const b = document.createElement('button'); b.dataset.car = c.i; b.innerHTML = `<b>${SHORT[c.i]}</b><i></i>`; map.append(b); });
  map.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const c = cars[+b.dataset.car]; actor.seated = false; actor.roof = false; state.walkGoal = c.x + (c.i === 0 ? -L / 2 + 1.8 : 0); actor.cam = state.walkGoal < actor.x ? -1 : 1; });
  let mapT = 0;
  function drawMap(ci) { for (const b of map.children) { const i = +b.dataset.car; b.classList.toggle('here', i === ci); b.classList.toggle('clear', i > 0 && H.left[i] === 0); b.lastChild.textContent = i === 0 ? (H.spam >= QUOTA ? 'GO' : '') : H.left[i] || '✓'; }
    $('spam').textContent = H.spam; $('quota').textContent = H.done ? 'robbed' : H.spam >= QUOTA ? 'to the ENGINE →' : `of ${QUOTA}`; $('hp').textContent = '●'.repeat(Math.max(0, 8 - state.stings)) + '○'.repeat(Math.min(8, state.stings)); }

  const near = (list, x, z, r, f) => { let best = null, bd = r; for (const o of list) { const p = f(o); if (!p) continue; const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = o; } } return best; };
  /** What the one action button would do here, or null. */
  function target(ci) {
    const pr = near(props, actor.x, actor.z, 1.5, p => p.car === ci && p.loot > 0 ? [cars[p.car].x + p.at[0], p.at[2]] : null); if (pr) return { label: 'ROB', what: pr.title.split(/[,;:]/)[0], run: () => rob(pr.loot, pr.title, () => { H.left[pr.car] -= pr.loot; pr.loot = 0; }) };
    const who = near(people, actor.x, actor.z, 1.3, p => p.root.visible && !pocket.get(p) ? [p.root.position.x, p.root.position.z] : null); if (who) return { label: 'ROB', what: who.role, run: () => rob(1, who.role, () => { pocket.set(who, 1); who.clip = 'angry'; setTimeout(() => { who.clip = null; }, 2600); }) };
    return null;
  }
  function rob(n, from, after) { audio.fx('rob'); H.spam += n; H.robbed += n; after(); deed('crouch'); stub(`+${n} SPAM`, from.split(/[,;:]/)[0]); }
  function throwCan() {
    if (H.spam <= 0) { stub('No SPAM', 'rob some first'); return false; } const t = throwsPool.find(q => q.live <= 0 && q.rest <= 0); if (!t) return false; H.spam--; H.thrown++;
    const d = actor.dir, y0 = (actor.roof ? F + DIM.ROOF + .14 : F) + 1.35; t.m.visible = true; t.m.position.set(actor.x + d * .4, y0, actor.z); t.v.set(d * 9.5, 3.2, 0);
    if (sys.cloud.visible && actor.roof) { const s = sys.swarm.p; t.v.set(s.x - actor.x, s.y - y0 + 2, s.z - actor.z).normalize().multiplyScalar(13); }   // on the roof it flies at the swarm
    t.live = 1.6; deed('swat'); audio.fx('throw'); return true;
  }
  let shown = true;
  function update(dt, ci) {
    const on = game.mode === 'game'; if (on !== shown) { shown = on; for (const c of H.loose) c.m.visible = on && !c.taken; }   // the loose cans belong to the heist; the film and the run do not see them
    if (!on) return;
    for (const c of H.loose) if (c.m.visible && Math.abs(c.x - actor.x) < .9 && !actor.roof) { c.m.visible = false; c.taken = true; audio.fx('pick'); H.spam++; H.left[c.car]--; stub('+1 SPAM', cars[c.car].name); }
    for (const t of throwsPool) {
      if (t.live > 0) { t.live -= dt; t.v.y -= 9.8 * dt; t.m.position.addScaledVector(t.v, dt); t.m.rotation.x += dt * 9; t.m.rotation.z += dt * 6;
        const floor = (t.m.position.y > F + 2 || actor.roof ? F + DIM.ROOF + .24 : F + .1);
        if (sys.cloud.visible && t.m.position.distanceTo(sys.swarm.p) < 2.6) { sys.hit(14, 'SPAM hits the swarm'); t.live = 0; t.m.visible = false; continue; }
        const hit = near(people, t.m.position.x, t.m.position.z, .7, p => p.root.visible ? [p.root.position.x, p.root.position.z] : null); if (hit && t.m.position.y < F + 1.9) { hit.clip = 'confused'; setTimeout(() => { hit.clip = null; }, 2400); audio.fx('bonk'); stub('Bonk', hit.role); t.v.set(0, 0, 0); t.live = Math.min(t.live, .05); }
        if (t.m.position.y <= floor || t.live <= 0) { t.m.position.y = floor; t.live = 0; t.rest = 8; H.decoyUntil = state.t + 8; H.decoyPos = t.m.position.clone(); audio.fx('clank'); stub('They go for the SPAM', 'eight seconds without a sting'); } }
      else if (t.rest > 0) { t.rest -= dt; if (t.rest <= 0) t.m.visible = false; }
    }
    state.decoy = state.t < H.decoyUntil;
    if (state.stings >= 8) { const lost = Math.ceil(H.spam / 2); H.spam -= lost; state.stings = 0; actor.roof = false; actor.x = cars[1].x + 5; actor.z = 0; actor.cam = -1; audio.fx('out'); stub('Stung out', `you come round in the quiet car, ${lost} SPAM lighter`); }
    if (!H.done && H.spam >= QUOTA && ci === 0) { H.done = true; audio.fx('win'); deed('win'); $('banner').hidden = false; $('bannerText').textContent = `${H.spam} SPAM · ${H.robbed} robbed · ${H.thrown} thrown · ${state.stings} stings`; }
    if (state.t - mapT > .25) { mapT = state.t; drawMap(ci); }
    for (const c of H.loose) if (c.m.visible) c.m.rotation.y += dt * 1.5;
  }
  $('bannerOk').onclick = () => { $('banner').hidden = true; };
  return { H, update, target, throwCan, drawMap };
}
