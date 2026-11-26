// The game on the train: the great swarm as an opponent, the roof, the smoker, the cab and its controls, and the goals that tie them together.
// World mode leaves all of it dormant so the train can simply be walked and filmed; Game mode wakes it.
import * as THREE from 'three';
import { DIM, clamp, damp } from './kit.js';

const { L, FLOOR: F, ROOF, SPAN } = DIM;
export const ROOF_Y = F + ROOF + .14;

export function createGame({ scene, cars, train, bees, interact, actor, journey, state, stub, deed, env }) {
  const g = interact.game; Object.assign(g, { mode: 'world', swarm: 100, calm: false, smoker: false, key: false, hijacked: false, roofed: false, knelt: false, venom: 0 });
  const stubCars = () => g.stubCars.size;
  const goals = [
    { id: 'stubs', text: 'Take a stub in seven carriages', done: () => stubCars() >= 7, show: () => `${stubCars()}/7` },
    { id: 'veil', text: 'Get the veil from the beekeeper', done: () => g.veil },
    { id: 'smoker', text: 'Find the smoker in the apiary car', done: () => g.smoker },
    { id: 'roof', text: 'Climb onto the roof', done: () => g.roofed },
    { id: 'swarm', text: 'Smoke the great swarm down', done: () => g.calm, show: () => g.calm ? '' : `${Math.ceil(g.swarm)}%` },
    { id: 'key', text: 'Show the conductor five stubs for the cab key', done: () => g.key },
    { id: 'train', text: 'Take the train', done: () => g.hijacked },
    { id: 'queen', text: 'Kneel at the queen’s cell', done: () => g.knelt },
  ];

  // ---- the great swarm: one body made of many, with a mind of four states
  const N = matchMedia('(pointer:coarse)').matches ? 380 : 1100, seed = new Float32Array(N * 3); for (let k = 0; k < N * 3; k++) seed[k] = Math.random();
  // real bodies, not points: they catch the sun, cast on the roof, and appear in every render pass
  const cloud = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.032, 0).scale(1.8, .8, .8), new THREE.MeshLambertMaterial({ color: 0x3a2406, emissive: 0x2a1802 }), N); cloud.frustumCulled = false; cloud.visible = false; cloud.castShadow = true; cloud.userData.cls = 'bee'; scene.add(cloud);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3();
  const S = { p: new THREE.Vector3(-20, 9, 9), want: new THREE.Vector3(), mode: 'shadow', t: 0, r: 3.5 };
  // smoke puffs
  const puffTex = train.glowTex, puffs = []; for (let k = 0; k < 14; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0xd8d2c4, transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; scene.add(sp); puffs.push({ sp, life: 0, v: new THREE.Vector3() }); }
  let puffAt = 0;
  function smoke() {
    if (!g.smoker) { stub('No smoker', 'there is one in the apiary car'); return false; } if (state.t < puffAt) return false; puffAt = state.t + .8;
    const y = actor.roof ? ROOF_Y + 1.3 : F + 1.3; let n = 0;
    for (const p of puffs) if (p.life <= 0 && n < 4) { p.life = 2.2; p.sp.visible = true; p.sp.position.set(actor.x + actor.dir * .7, y, actor.z); p.v.set(actor.dir * (1.4 + Math.random()), .5 + Math.random() * .6, (Math.random() - .5) * 1.2); n++; }
    const d = S.p.distanceTo(tmp.set(actor.x, y, actor.z)); if (!g.calm && d < 11) hurt(d < 5 ? 16 : 9, 'Smoke');
    deed('swat'); return true;
  }
  function hurt(n, why) { g.swarm = Math.max(0, g.swarm - n); S.mode = 'reel'; S.t = 0; if (g.swarm <= 0 && !g.calm) { g.calm = true; stub('The swarm settles', 'they go quiet all down the train'); } else stub(why, `the swarm is at ${Math.ceil(g.swarm)}%`); }
  const tmp = new THREE.Vector3(); let wasTunnel = 0;
  function update(dt, t) {
    const game = g.mode === 'game';
    for (const p of puffs) if (p.life > 0) { p.life -= dt; p.sp.position.addScaledVector(p.v, dt); p.sp.position.x -= actor.roof ? journey.speed * dt * .25 : 0; const a = clamp(p.life / 2.2, 0, 1); p.sp.scale.setScalar(.5 + (1 - a) * 2.6); p.sp.material.opacity = a * .5; if (p.life <= 0) p.sp.visible = false; }
    cloud.visible = game && !g.calm && g.swarm > 0; state.calm = g.calm; state.hostile = game;
    if (!cloud.visible) return;
    const head = tmp.set(actor.x, actor.roof ? ROOF_Y + 1.5 : F + 1.5, actor.z); S.t += dt;
    if (env.tunnel && !wasTunnel && !g.calm) hurt(8, 'The tunnel strips them off'); wasTunnel = env.tunnel;
    if (!actor.roof) { S.mode = 'shadow'; S.want.set(actor.x + Math.sin(t * .4) * 5, F + 3.4 + Math.sin(t * .7), 5.5 + Math.sin(t * .3) * 1.5); S.r = 3.2; }     // it paces him outside the glass
    else if (S.mode === 'shadow' || (S.mode === 'reel' && S.t > 1.6)) { S.mode = 'circle'; S.t = 0; }
    if (actor.roof && S.mode === 'circle') { const a = t * .9; S.want.set(head.x + Math.cos(a) * 5.5, head.y + 2.2 + Math.sin(t * 1.3), head.z + Math.sin(a) * 5.5); S.r = 2.6; if (S.t > 4.5 - (100 - g.swarm) * .01) { S.mode = 'dive'; S.t = 0; stub('It turns', 'the swarm is coming down'); } }
    if (S.mode === 'dive') { S.want.copy(head); S.r = 1.3; if (S.p.distanceTo(head) < 1.1) { if (!g.veil) { g.venom += 2; deed('stung'); deed('swat'); } else stub('The veil holds', 'they cannot find your face'); S.mode = 'reel'; S.t = 0; } else if (S.t > 3) { S.mode = 'circle'; S.t = 0; } }
    if (S.mode === 'reel') { S.want.set(head.x - actor.dir * 9, head.y + 6, head.z + 8); S.r = 5; }
    const k = S.mode === 'dive' ? 2.6 : 1.4; S.p.x = damp(S.p.x, S.want.x, k, dt); S.p.y = damp(S.p.y, S.want.y, k, dt); S.p.z = damp(S.p.z, S.want.z, k, dt);
    const n = Math.floor(N * (.25 + .75 * g.swarm / 100)), r = S.r * (.6 + .4 * g.swarm / 100);
    for (let i = 0; i < N; i++) { const u = seed[i * 3], v = seed[i * 3 + 1], w = seed[i * 3 + 2], a = t * (1.5 + w * 2.5) + u * 6.283, b = t * (1 + u) + v * 6.283, rr = r * Math.cbrt(w);
      p4.set(S.p.x + Math.cos(a) * Math.cos(b) * rr * 1.5, S.p.y + Math.sin(b) * rr * .8, S.p.z + Math.sin(a) * Math.cos(b) * rr); e4.set(0, -a, b * .3); q4.setFromEuler(e4); s4.setScalar(i < n ? 1 : 0); m4.compose(p4, q4, s4); cloud.setMatrixAt(i, m4); }
    cloud.instanceMatrix.needsUpdate = true;
    if (g.venom >= 12) { g.venom = 0; state.stings = Math.max(0, state.stings); actor.roof = false; actor.x = cars[4].x + 5; actor.z = 0; deed('dazed'); stub('Too many stings', 'you come round in the apiary car'); }
  }

  // ---- the roof: a ladder in every gangway
  for (let i = 1; i < cars.length; i++) { const x = cars[i].x + L / 2 + DIM.GAP / 2;
    interact.add({ id: 'ladder' + i, pos: () => tmp2.set(x, actor.roof ? ROOF_Y + 1 : F + 1.2, 0), get car() { return i; }, radius: 1.25, kicker: 'Gangway', title: 'Ladder to the roof',
      rows: () => [['Above', actor.roof ? 'you are on the roof' : 'wind, and the swarm'], ['Speed', Math.round(journey.speed * 3.6) + ' km/h'], ['Tunnels', 'you will duck']],
      verbs: () => [{ label: actor.roof ? 'Climb down' : 'Climb up', run: () => { actor.roof = !actor.roof; actor.seated = false; actor.x = x + (actor.roof ? -1.2 : -1.6) * 1; actor.z = 0; if (actor.roof) { g.roofed = true; stub('On the roof', 'R to smoke · the swarm will come'); } return false; } }] }); }
  const tmp2 = new THREE.Vector3();
  // ---- the smoker, the queen, and the cab
  { const c = cars[4], m = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .22, 12), new THREE.MeshStandardMaterial({ color: 0x8f9896, metalness: .8, roughness: .35 })); m.position.set(3.9, .95, -1.02); c.group.add(m);
    const it = interact.add({ id: 'smoker', car: 4, at: [3.9, 1.0, -.95], radius: 1.3, kicker: 'Tool', title: 'Bee smoker', rows: () => [['Burns', 'burlap and pine needles'], ['Use', 'R, when they are close'], ['Carried', g.smoker ? 'Yes' : 'No']], verbs: () => g.smoker ? [] : [{ label: 'Take it', run: () => { g.smoker = true; g.inv.push('smoker'); m.visible = false; it.gone = true; stub('Smoker', 'R to puff'); return false; } }] }); }
  { const c = cars[cars.length - 1]; interact.add({ id: 'queen', car: c.i, at: [-L / 2 + 2.9, 1.1, 0], radius: 1.5, kicker: 'The hive', title: 'The queen’s cell', rows: () => [['Stings so far', String(state.stings)], ['The swarm', g.calm ? 'quiet' : Math.ceil(g.swarm) + '%'], ['Stubs', `${g.stubs.size} of ${g.total}`]], verbs: () => [{ label: 'Kneel', run: () => { g.knelt = true; deed('kneel'); stub('He kneels', 'the cells behind him go dark one by one'); return true; } }] }); }
  { const c = cars[0], speeds = [12, 26, 40];
    interact.add({ id: 'controls', car: 0, at: [-L / 2 + 2.6, 1.1, .75], radius: 1.4, kicker: 'Locomotive', title: () => g.hijacked ? 'The train is yours' : 'The controls',
      rows: () => [['Access', g.key ? 'Unlocked' : 'Locked'], ['Speed', Math.round(journey.speed * 3.6) + ' km/h'], ['Regulator', journey.phase === 'held' ? 'brake on' : Math.round(journey.cruise * 3.6) + ' km/h'], ['Driver', g.hijacked ? 'you' : 'nobody you can see']],
      verbs: () => !g.key ? [] : !g.hijacked ? [{ label: 'Take the train', run: () => { g.hijacked = true; deed('win'); stub('The train is yours', 'faster, slower, or stop it anywhere'); return true; } }]
        : [{ label: 'Faster / slower', run: () => { journey.phase = 'run'; journey.cruise = speeds[(speeds.indexOf(journey.cruise) + 1) % speeds.length]; return true; } }, { label: journey.phase === 'held' ? 'Release the brake' : 'Stop the train here', run: () => { journey.phase = journey.phase === 'held' ? 'run' : 'held'; return true; } },
          { label: 'Sound the horn', run: () => { if (!g.calm) hurt(25, 'The horn'); else stub('The horn', 'it carries down the valley'); return true; } }] }); }
  function setMode(m) { g.mode = m; document.body.dataset.mode = m; for (const b of document.querySelectorAll('#modes button')) b.classList.toggle('on', b.dataset.mode === m); return m; }
  return { goals, update, smoke, setMode, hit: hurt, swarm: S, cloud, g };
}
