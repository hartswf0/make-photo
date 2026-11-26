// BEES ON A TRAIN — the sealed line. Boot, journey, passenger, input and the frame loop.
import * as THREE from 'three';
import { DIM, makeTextures, makeMaterials, clamp, damp, lerp } from './kit.js';
import { buildTrain, locate, bayX as bay } from './train.js';
import { buildLand, LOOP, STOP_AT, ahead } from './land.js';
import { buildBees } from './bees.js';
import { createRig, SHOTS } from './rig.js';
import { buildWorlds } from './worlds.js';
import { loadCast } from './cast.js';
import { createUI } from './ui.js';
import { createInteract } from './interact.js';
import { createGame, ROOF_Y } from './game.js';
import { buildProps } from './props.js';
import { createHeist } from './heist.js';
import { makeCan } from './cans.js';
import { createAudio } from './audio.js';

const mobile = matchMedia('(pointer:coarse)').matches || innerWidth < 760;
const params = new URLSearchParams(location.search);
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance', preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xdcc096, 500, 4200);
const camera = new THREE.PerspectiveCamera(58, 1, .06, 6500);
const hemi = new THREE.HemisphereLight(0xfff0d6, 0x4e4438, 1.0), sunL = new THREE.DirectionalLight(0xffd29a, 2.4);
sunL.position.set(.55, .42, .72); scene.add(hemi, sunL);
const lamps = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffc27a, 0, 9, 1.6); scene.add(l); return l; });

const tex = makeTextures(), M = makeMaterials(tex), tl = new THREE.TextureLoader();
const sTex = f => { const t = tl.load('assets/' + f); t.colorSpace = THREE.SRGBColorSpace; return t; };
M.panels = new THREE.MeshStandardMaterial({ map: (() => { const t = sTex('tex_panels.jpg'); t.wrapS = THREE.RepeatWrapping; t.repeat.x = 2.4; return t; })(), roughness: .8 });
M.screens = [0, 1, 2, 3].map(k => new THREE.MeshBasicMaterial({ color: [0x1f4d4a, 0x4a3a1c, 0x234046, 0x18302e][k] }));

const train = buildTrain(scene, M), land = buildLand(scene, M, tex, tl), bees = buildBees(scene, M, mobile), rig = createRig(camera);
const cars = train.cars, quiet = cars[1];
// posters and the route map: generated flats hung where a real carriage would hang them
for (const [file, car, x, w, h] of [['tex_poster.jpg', cars[1], DIM.L / 2 - .12, .62, .82], ['tex_ticket.jpg', cars[2], DIM.L / 2 - .12, .9, .52], ['tex_poster.jpg', cars[7], DIM.L / 2 - .12, .62, .82]]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: sTex(file) })); m.position.set(x, 1.35, -.95); m.rotation.y = -Math.PI / 2; car.group.add(m);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(.02, h + .06, w + .06), M.brass); fr.position.set(x + .02, 1.35, -.95); car.group.add(fr);
}
// projector beam in the cinema
{ const c = cars[7], p = c.projector, len = p.x - c.portal.x, g = new THREE.CylinderGeometry(.04, 1.0, len, 12, 1, true).rotateZ(-Math.PI / 2);
  const beam = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(p.x - len / 2, (p.y + c.portal.y) / 2, p.z / 2); beam.rotation.y = Math.atan2(p.z, len) * -1; c.group.add(beam); }

const cans = [];
// Donkey Water's 20-litre cans ride in the quiet car and the greenhouse: the train is part of the same world of water
try { if (window.makeWaterWifiCan) for (const [ci, x, y, z, ry] of [[1, bay(4) - 1.25, 0, .62, .3], [1, bay(5) + .72, 0, .6, -.4], [1, bay(2) + .2, 0, -.62, 1.2], [3, 6.9, 0, .15, .2], [3, 6.3, 0, -.2, 1.9], [0, -DIM.L / 2 + 1.1, 0, -.9, .4]]) {
  const made = window.makeWaterWifiCan(THREE, { textureBase: '../donkey/', withPourAndRipples: false }), can = made.canRoot || made.group || made; can.userData.car = ci; cans.push(can); interact.add({ id: 'can' + cans.length, car: ci, at: [x, .5, z], radius: 1.0, kicker: 'Jerikan · 20 L', title: 'Water for the road', rows: () => [['Carried', game.water.toFixed(0) + ' L'], ['Goes with you', 'to the next halt']], verbs: () => game.water < 20 ? [{ label: 'Draw 4 L', run: () => { game.water = Math.min(20, game.water + 4); return true; } }] : [] }); can.position.set(x, y, z); can.rotation.y = ry; cars[ci].group.add(can); } } catch (e) { console.warn('no cans', e); }

// ---- state
const seat0 = quiet.playerSeat;
const actor = { cam: -1, x: quiet.x + seat0.x, z: seat0.z, dir: 1, yaw: Math.PI / 2, seated: true, seat: { car: quiet, ...seat0 }, speed: 0 };
const journey = { dist: +(params.get('at') || 600), speed: 0, cruise: 26, dwell: 0, phase: 'run', wheel: 0 };
const state = { pass: 'beauty', calm: false, hostile: false, bee: false, beeYaw: Math.PI, beePitch: 0, shoulder: 1, stings: 0, nextSting: 12, react: null, doorCar: -1, t: 0, take: false, takeT: 0, takeI: 0, walkGoal: null, camCar: 1, log: [], paused: false, lastCar: -1, lastSeg: null, hud: true };
const input = { jx: 0, jy: 0, yaw: 0, pitch: 0, keys: new Set() };
const ui = createUI({ shots: SHOTS, mobile });
const audio = createAudio();
const stub = (title, sub = '') => { state.log.push({ t: +state.t.toFixed(1), km: +(journey.dist / 1000).toFixed(2), title, sub }); if (state.log.length > 400) state.log.shift(); ui.toast(title, sub); };
let worlds = null, cast = null, people = [], hero = null;
const interact = createInteract({ scene, cars, camera, stub }), game = interact.game;
const props = buildProps(train, M); interact.loadCorpus(props).catch(e => console.warn('no corpus', e));
// what the passengers say and do to him, by carriage: [line, what it does to him, what they hand over]
const TALK = { 1: [['Sit. The window is the only thing in here that changes.', 'greet']], 2: [['We applaud whoever comes through that door. It is not personal.', 'dazed'], ['The briefcase is not yours. Neither is the shoe.', 'swat']],
  3: [['Half for you. Half for them. Never both.', 'greet', 'half a comb']], 4: [['Wear this. They sting what they can see the face of.', 'kneel', 'veil']], 5: [['I heard what you were thinking just now. So did they.', 'dazed']],
  6: [['You tripped there a moment ago. Or you are about to.', 'crouch']], 7: [['We have seen this one. The train does not stop at the edge.', 'clap']], 8: [['…', 'kneel']] };
const BEEWORD = ['none', 'none', 'one', 'a dozen', 'hundreds', 'thousands', 'a man of them', 'the beam is solid with them', 'all of them'];
const tmp2 = new THREE.Vector3();
let gameSys = null;
const USE = /^(ladder|controls|queen|smoker)/;   // the only things the heist's action button uses besides robbing
function personItem(p) {
  const carOf = () => p.walk ? locate(cars, p.walk.x).i : p.car;
  interact.add({ id: p.key, radius: 1.5, pos: () => tmp2.copy(p.root.position).setY(DIM.FLOOR + 1.35), get car() { return carOf(); }, title: p.role, kicker: 'Passenger',
    rows: () => [['Carriage', cars[carOf()].name], ['Doing', p.walk ? 'walking the train' : p.loco.sitting ? (p.loco.talking ? 'talking' : 'sitting') : p.loco.working || (p.loco.dancing ? 'dancing' : 'standing')], ['Spoken to', game.talked.has(p.key) ? 'Yes' : 'Not yet']],
    verbs: () => [{ label: p.walk ? 'Show a stub' : 'Talk', run: it => { const opts = TALK[carOf()] || TALK[1], [line, d, gift] = p.walk ? [`Tickets. Any stub will do. You have ${game.stubs.size}.`, game.stubs.size ? 'greet' : 'dazed'] : opts[game.talked.size % opts.length];
      if (p.walk && game.stubs.size >= 5 && !game.key) { game.key = true; game.inv.push('cab key'); stub('Given: the cab key', 'the locomotive is forward of the quiet car'); }
      game.talked.add(p.key); it.note = '“' + line + '”'; deed(d); if (gift && !game.inv.includes(gift)) { game.inv.push(gift); if (gift === 'veil') game.veil = true; stub('Given: ' + gift, p.role); } return true; } }] });
}
for (const d of train.doors) { const here = d.x < d.car.x, nx = cars[Math.min(cars.length - 1, d.car.i + 1)];
  interact.add({ id: 'door' + d.car.i + (here ? 'r' : 'f'), car: d.car.i, at: [d.x - d.car.x + (here ? .9 : -.9), 1.25, -.75], radius: 1.3, kicker: 'Door', title: here ? 'To the ' + nx.name.toLowerCase() : 'To the locomotive',
    rows: () => [['Access', d.open > .5 ? 'Open' : 'Shut'], ['Beyond', here ? nx.sub : 'the engine'], ['Bees beyond', BEEWORD[here ? nx.i : 0] || 'none'], ['Seam', 'decided when it opens']], verbs: () => [] }); }


// ---- the line: the halt on each lap is the next station of make-photo's archipelago
const line = { stations: [{ id: 'amba', name: 'Amba halt' }], i: 0 };
fetch('line.json').then(r => r.json()).then(d => { line.stations = d.stations; line.i = Math.max(0, d.stations.findIndex(s => s.id === params.get('from'))); ui.next(nextHalt().name); }).catch(() => {});
const nextHalt = () => line.stations[(line.i + 1) % line.stations.length];
function getOff() { const s = nextHalt(), url = '../atlas/overworld.html'; stub('Getting off', s.name); const c = window.DW && window.DW.carry; if (window.DW) window.DW.go(url, { station: s.id, mode: 'walk', liters: game.water, ...(c && Number.isFinite(c.donkey) ? { donkey: c.donkey } : {}) }); else location.href = url; }

// ---- people: [role, carriage, seat index, talking]
// The further down the train, the less anyone behaves. [role, carriage, seat index or [x, z, facing], locomotion]
const PEOPLE = [['imani', 1, 5, { sitting: true }], ['elder', 1, 16, { sitting: true }], ['matriarch', 2, 9, { sitting: true, talking: true }], ['researcher', 2, 14, { sitting: true, talking: true }], ['rahel', 2, 20, { sitting: true }],
  ['child', 3, [-2.5, .0, 1], { dancing: 'simple' }], ['beekeeper', 4, [-3.2, .55, -1], { working: 'pray' }], ['saba', 5, [-4.5, .95, -1], { working: 'confused' }], ['watcher', 6, [1.2, .5, 1], { working: 'angry' }],
  ['bride', 7, [-3.5, -.7, 1], { working: 'clapping' }], ['elder', 7, [-1.2, .75, 1], { working: 'clapping' }], ['rahel', 8, [-3, .5, 1], { dancing: 'pump' }], ['saba', 8, [-6, -.5, 1], { working: 'pray' }]];
const DENSITY = [.03, 0, .03, .1, .22, .36, .52, .72, 1];   // how much of the swarm is aboard, by carriage: one bee in the quiet car, all of them in the hive
const DEEDS = { stung: ['jump', .9], swat: ['reject', 1.6], dazed: ['confused', 2.4], angry: ['angry', 2.2], kneel: ['pray', 3], dance: ['dance-arm-pump', 3], clap: ['clapping', 2], crouch: ['crouch-idle', 1.6], greet: ['greeting', 2], win: ['victory', 2.4] };
function deed(name) { const d = DEEDS[name]; if (!d || !hero) return false; state.react = { clip: d[0], until: state.t + d[1] }; if (name === 'stung') { audio.fx('sting'); navigator.vibrate?.(60); state.stings++; stub('Stung', `${state.stings} so far · ${cars[state.lastCar]?.name || ''}`); } return true; }
function bootCast() {
  try {
    cast = loadCast();
    hero = cast.make('traveler'); scene.add(hero.root); hero.root.traverse(o => { if (o.isMesh) o.castShadow = true; }); hero.root.userData.cls = 'person'; setTimeout(() => people.forEach(personItem), 0);
    for (const [id, ci, at, loco] of (mobile ? PEOPLE.filter((_, k) => k % 2 === 0) : PEOPLE)) {
      const c = cars[ci], p = cast.make(id); if (!p) continue;
      if (Array.isArray(at)) { p.root.position.set(c.x + at[0], DIM.FLOOR, at[1]); p.root.rotation.y = at[2] * Math.PI / 2; }
      else { const st = c.seats[at % c.seats.length]; if (c === quiet && st === seat0) continue; p.root.position.set(c.x + st.x, DIM.FLOOR + SEAT_Y, st.z); p.root.rotation.y = st.face * Math.PI / 2; }
      p.loco = { speedMps: 0, ...loco }; p.car = ci; p.root.userData.cls = 'person'; scene.add(p.root); people.push(p);
    }
    // the conductor walks the train; the musician of clip 1022 stands at the end of the dining car
    const cond = cast.make('conductor'); cond.walk = { a: cars[5].x, b: cars[1].x + 6, dir: 1, x: cars[3].x }; scene.add(cond.root); people.push(cond);
    const mus = cast.make('musician'); mus.root.position.set(cars[2].x + cars[2].stage.x, DIM.FLOOR, .25); mus.root.rotation.y = Math.PI / 2; mus.loco = { speedMps: 0, working: 'guitar-playing' }; mus.car = 2; scene.add(mus.root); people.push(mus);
  } catch (e) { console.warn('cast unavailable', e); }
  ui.loading(null);
}
const SEAT_Y = .0;

// ---- journey: cruise, slow for the halt, dwell, depart
function stepJourney(dt) {
  const d = ahead(STOP_AT, journey.dist);
  if (journey.phase === 'held') journey.speed = damp(journey.speed, 0, 1.2, dt);
  else if (journey.phase === 'run') {
    let v = journey.cruise; if (d > 0 && d < 900) v = Math.min(v, Math.sqrt(2 * .42 * d) + .4);
    journey.speed = damp(journey.speed, v, v < journey.speed ? 2.5 : .25, dt);
    if (d > 0 && d < .6) { journey.phase = 'dwell'; journey.dwell = 20; journey.speed = 0; stub(nextHalt().name, 'the train stands here; you may get off'); }
  } else if (journey.phase === 'dwell') { journey.dwell -= dt; if (journey.dwell <= 0) { journey.phase = 'run'; journey.dist += 1; line.i = (line.i + 1) % line.stations.length; ui.next(nextHalt().name); stub('Departure', 'next halt ' + nextHalt().name); } }
  journey.dist = (journey.dist + journey.speed * dt) % (LOOP * 1000);
  journey.wheel += journey.speed * dt / .46; train.spin(journey.wheel);
}

// ---- passenger
const fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
function nearestSeat() { const { car } = locate(cars, actor.x); let best = null, bd = 1.25; for (const s of car.seats) { const d = Math.hypot(car.x + s.x - actor.x, s.z - actor.z); if (d < bd) { bd = d; best = { car, ...s }; } } return best; }
function stand() { if (!actor.seated) return; const { car } = locate(cars, actor.x); actor.seated = false; actor.z = clamp(car.aisleZ + Math.sign(actor.z - car.aisleZ) * car.aisleHalf, -1.2, 1.2); actor.x += actor.dir * .0; stub('The traveler stands', car.name); }
function sit() { const s = nearestSeat(); if (!s) return; actor.seated = true; actor.seat = s; actor.x = s.car.x + s.x; actor.z = s.z; actor.dir = s.face; stub('The traveler sits', s.car.name); }
function stepActor(dt) {
  let mx = 0, mz = 0;
  const k = input.keys, live = state.bee ? 0 : 1, jx = live * input.jx + live * (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0), jy = live * input.jy + live * (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
  const heisting = game.mode === 'game' && !state.bee;
  if (Math.abs(jx) + Math.abs(jy) > .08) {
    state.walkGoal = null; if (actor.seated) stand();
    if (heisting) { mx = jy * actor.cam; mz = jx * actor.cam; } else
    if (rig.st.shot.inside && rig.st.shot.frame !== 'bee') { camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); mx = fwd.x * jy - fwd.z * jx; mz = fwd.z * jy + fwd.x * jx; }
    else { mx = jy; mz = jx; }
  } else if (state.walkGoal !== null && !actor.seated) { const d = state.walkGoal - actor.x; if (Math.abs(d) < .3) state.walkGoal = null; else mx = Math.sign(d) * (heisting ? 1 : .75); }
  const len = Math.hypot(mx, mz), sp = Math.min(1, len) * (heisting ? 2.5 : 1.45);
  if (len > .01 && !actor.seated) {
    actor.x += mx / len * sp * dt; actor.z += mz / len * sp * dt;
    const cN = cars[cars.length - 1], c0 = cars[0]; actor.x = clamp(actor.x, cN.x + cN.walkMin, c0.x + c0.walkMax);
    if (Math.abs(mx) > .2 * len) actor.dir = Math.sign(mx);
    actor.yaw = dampAngle(actor.yaw, Math.atan2(mx, mz), 10, dt);
  } else if (actor.seated) actor.yaw = dampAngle(actor.yaw, actor.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 8, dt);
  const loc = locate(cars, actor.x);
  if (actor.roof) { actor.z = clamp(actor.z, -.95, .95); actor.x = clamp(actor.x, train.tailX + .8, cars[0].x - DIM.L / 2 + 3); }
  else if (!actor.seated) actor.z = clamp(actor.z, loc.aisleZ - loc.half, loc.aisleZ + loc.half);
  actor.speed = len > .01 && !actor.seated ? sp : 0;
  if (loc.i !== state.lastCar) { state.lastCar = loc.i; stub(loc.car.name, loc.car.sub); ui.car(loc.car); }
  if (hero) {
    hero.root.position.set(actor.x, actor.roof ? ROOF_Y : DIM.FLOOR + (actor.seated ? SEAT_Y : 0), actor.z); hero.root.rotation.y = actor.yaw;
    hero.loco = { speedMps: actor.speed, sitting: actor.seated }; hero.clip = state.react && state.t < state.react.until ? state.react.clip : actor.roof && land.env.tunnel ? 'crouch-idle' : null;
    // from the apiary car on, the bees sting without being asked
    if (!actor.seated && !actor.roof && !state.calm && !state.decoy && !game.veil && !state.bee && game.mode !== 'game' && loc.i >= 4 && state.t > state.nextSting) { state.nextSting = state.t + 22 - loc.i * 2 + Math.random() * 8; if (state.t > 6) deed('stung'); } hero.root.visible = !(rig.st.shot.id === 'pov');
  }
  return loc;
}
const dampAngle = (a, b, k, dt) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * (1 - Math.exp(-k * dt)); };

// ---- the take: an unattended continuous performance
const TAKE = [['pushin', 9], ['window', 6], ['follow', 9, 'rear'], ['threshold', 8], ['lateral', 8], ['lead', 7], ['bee', 6], ['floor', 5], ['crane', 16], ['track', 7], ['follow', 9], ['cctv', 5], ['wheel', 4], ['drone', 8], ['lineside', 10], ['follow', 9], ['roof', 6], ['pov', 7], ['vista', 9], ['nose', 6], ['follow', 8, 'front'], ['tail', 6]];
function stepTake(dt) {
  if (!state.take) return; state.takeT -= dt; if (state.takeT > 0) return;
  const [shot, dur, go] = TAKE[state.takeI++ % TAKE.length]; setShot(shot, true); state.takeT = dur;
  if (go === 'rear') { if (actor.seated) stand(); state.walkGoal = cars[cars.length - 1].x - 4; } else if (go === 'front') { if (actor.seated) stand(); state.walkGoal = cars[1].x - 2; }
}
function setShot(id, fromTake = false) { if (!rig.set(id)) return; if (!fromTake) state.take = false; ui.shot(id, state.take); }

// ---- environment
const fogDay = new THREE.Color(0xdcc096), fogDusk = new THREE.Color(0xb98aa0), fogDark = new THREE.Color(0x07090c), sunDay = new THREE.Color(0xffd29a), sunDusk = new THREE.Color(0xff8f7a), col = new THREE.Color();
let dark = 0;
function stepEnv(dt, loc) {
  const e = land.env; dark = damp(dark, e.tunnel, 5, dt);
  scene.fog.color.copy(fogDay).lerp(fogDusk, e.dusk).lerp(fogDark, dark); scene.fog.far = lerp(4200, 160, dark); scene.fog.near = lerp(500, 4, dark);
  hemi.intensity = lerp(lerp(1.15, .75, e.dusk), .03, dark); sunL.intensity = lerp(lerp(2.4, 1.5, e.dusk), 0, dark); sunL.color.copy(sunDay).lerp(sunDusk, e.dusk);
  land.sky.material.uniforms.dark.value = dark; land.sky.material.uniforms.hor.value.set(0xf0cf8e).lerp(col.set(0xf2a6a0), e.dusk); land.sky.material.uniforms.top.value.set(0x356e7a).lerp(col.set(0x2b2a55), e.dusk);
  renderer.toneMappingExposure = lerp(1.08, 1.3, dark);
  const c = cars[state.camCar], inside = rig.st.shot.inside, power = (c.dim ? 2.2 : c.cool ? 4 : 4.6) * lerp(.55, 1.5, dark) * (inside ? 1 : .6);
  const xs = c.lamps.length ? c.lamps.slice().sort((a, b) => Math.abs(c.x + a - camera.position.x) - Math.abs(c.x + b - camera.position.x)) : [0];
  lamps.forEach((l, k) => { const x = xs[k % xs.length]; l.position.set(c.x + x, DIM.FLOOR + 1.95, 0); l.intensity = k < xs.length ? power : 0; l.color.setHex(c.cool ? 0x8fe0d8 : 0xffc27a); });
  for (const m of train.glowMats.values()) m.opacity = lerp(.5, .95, Math.max(dark, e.dusk * .6));
  if (e.segment !== state.lastSeg) { state.lastSeg = e.segment; if (e.segment && e.segment.type !== 'station') stub(e.segment.name, `km ${(journey.dist / 1000).toFixed(1)}`); }
  bees.state.swarmWant = (e.hive > .3 || e.viaduct > .5) ? 1 : state.forceSwarm ? 1 : 0; bees.state.side = 1;
  void loc;
}

// ---- frame
let slow = 0;
const clock = new THREE.Clock(), goal = new THREE.Vector3(), cup = new THREE.Vector3(quiet.x + quiet.props.cup.x, DIM.FLOOR + quiet.props.cup.y + .075, quiet.props.cup.z);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
function frame() {
  requestAnimationFrame(frame);
  const raw = clock.getDelta(), dt = Math.min(raw, .05); if (state.paused) return; state.t += dt;
  // if the device cannot hold the frame rate, give up resolution before giving up the journey
  slow = raw > .045 ? slow + raw : Math.max(0, slow - raw * 2); if (slow > 2.5 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - .5)); resize(); slow = 0; }
  stepJourney(dt);
  if (worlds && worlds.stage.active) {
    worlds.updateStage(dt, { x: input.jx + axis('d', 'a'), y: input.jy + axis('w', 's'), yaw: input.yaw, pitch: input.pitch }); input.yaw = input.pitch = 0;
    audio.update(journey.speed * .5, 1, 0); renderer.render(worlds.stage.scene, worlds.stage.camera); return;
  }
  const loc = stepActor(dt); stepTake(dt); stepRun();
  const portal = worlds ? worlds.nearest(tmp.set(actor.x, DIM.FLOOR + 1.2, actor.z), 3.2) : null, own = worlds && worlds.portals.find(p => p.car === loc.car);
  const ctx = { a: actor, car: loc.car, aisleZ: loc.aisleZ, side: actor.seated ? Math.sign(actor.z) || 1 : (own && Math.abs(own.pos.z) > .5 ? Math.sign(own.pos.z) : 1), bee: bees.lead, t: state.t, dist: journey.dist, speed: journey.speed, noseX: train.noseX, tailX: train.tailX };
  ctx.shoulder = state.shoulder; ctx.heist = game.mode === 'game'; ctx.high = state.high || run.on;   // the run and its seed use the high rear camera: whole body, feet and the door ahead
  if (ctx.heist && !state.bee && !run.on && rig.st.shot.id !== 'follow') setShot('follow', true);
  if (ctx.heist && !state.bee) { input.yaw = input.pitch = 0; rig.st.yaw = rig.st.pitch = 0; rig.st.zoom = 1; }   // the heist camera is fixed: a stray drag must not tip the lens
  if (ctx.heist) { const cN = cars[cars.length - 1]; if (actor.x < cN.x + cN.walkMin + .6) actor.cam = 1; if (actor.x > cars[0].x - DIM.L / 2 + 2.2) actor.cam = -1; }
  if (state.bee) {   // the player is the bee: fly where you look
    const B = bees.lead, ks = input.keys, f = input.jy + axis('w', 's'), sd = input.jx + axis('d', 'a'); state.beeYaw += input.yaw; state.beePitch = clamp(state.beePitch - input.pitch, -1.2, 1.2); input.yaw = input.pitch = 0;
    B.v.set(Math.cos(state.beeYaw) * Math.cos(state.beePitch), Math.sin(state.beePitch), Math.sin(state.beeYaw) * Math.cos(state.beePitch));
    B.p.x = clamp(B.p.x + (B.v.x * f - Math.sin(state.beeYaw) * sd) * 3.2 * dt, train.tailX + 2.4, cars[0].x - DIM.L / 2 + 2.8); B.p.y = clamp(B.p.y + (B.v.y * f + (ks.has(' ') ? 1 : 0) - (ks.has('shift') ? 1 : 0)) * 3.2 * dt, DIM.FLOOR + .12, DIM.FLOOR + 2.5); B.p.z = clamp(B.p.z + (B.v.z * f + Math.cos(state.beeYaw) * sd) * 3.2 * dt, -1.32, 1.32);
  }
  rig.st.yaw += input.yaw; rig.st.pitch = clamp(rig.st.pitch + input.pitch, -1.1, 1.1); input.yaw = input.pitch = 0;
  rig.update(dt, ctx);
  state.camCar = rig.st.shot.inside ? locate(cars, camera.position.x).i : loc.i;
  land.update(journey.dist, camera.position.x, state.t); stepEnv(dt, loc);
  if (own) goal.copy(own.pos);
  bees.update(dt, state.t, { cars, camCar: Math.max(1, game.mode === 'game' && !state.bee ? loc.i : state.camCar), actor, cup, goal: own ? goal : null, density: state.empty && state.camCar <= 1 ? -1 : (DENSITY[Math.max(1, state.camCar)] ?? 1) * (state.calm ? .25 : 1),
    hostile: game.mode === 'game' && !state.calm && !game.veil && !state.bee && !actor.roof, anger: clamp((loc.i - 1) / 8, 0, .8), actorCar: loc.i, head: tmp2.set(actor.x, DIM.FLOOR + (state.cans ? 1.3 : 1.6), actor.z), eye: camera.position, decoy: state.decoy && heist.H.decoyPos ? heist.H.decoyPos : null, onSting: () => deed('stung') });
  audio.swarm(Math.min(1, bees.state.near / 26), Math.min(1, bees.state.anger / 14)); audio.steps(actor.speed, dt, state.cans); audio.music(game.mode === 'game');
  for (const c of cans) c.visible = !(state.empty && c.userData.car === 1);
  for (const d of train.doors) { const near = Math.abs(actor.x - d.x) < 1.9 || (rig.st.shot.inside && (d.x - actor.x) * (d.x - camera.position.x) < 0) || Math.abs(camera.position.x - d.x) < .8 || people.some(p => p.walk && Math.abs(p.walk.x - d.x) < 1.6); if (near && d.open < .3 && !d.snd) { d.snd = 1; audio.fx('door'); } if (!near && d.open < .1) d.snd = 0; d.open = damp(d.open, near ? 1 : 0, near ? 7 : 3, dt); d.g.position.z = d.open * .88; }
  for (const p of people) {
    let ci = p.car;
    if (p.walk) { const w = p.walk; w.x += w.dir * .8 * dt; if (w.x > w.b) w.dir = -1; if (w.x < w.a) w.dir = 1; const l = locate(cars, w.x); ci = l.i; p.root.position.set(w.x, DIM.FLOOR, l.aisleZ + .12); p.root.rotation.y = w.dir * Math.PI / 2; p.loco = { speedMps: .8 }; }
    p.root.visible = Math.abs(ci - state.camCar) <= 2 && !(state.empty && ci === 1); p.wake(Math.abs(ci - state.camCar) <= 1);
  }
  if (cast) cast.update(dt); stepCans(dt);
  for (const c of cars) c.group.visible = !rig.st.shot.inside || Math.abs(c.i - state.camCar) <= 3;
  if (worlds) worlds.update(state.t, state.camCar, M);
  const stood = journey.phase === 'dwell' || (journey.phase === 'held' && journey.speed < .4), halt = stood && !actor.seated && !portal && !actor.roof;
  interact.update(state.bee ? bees.lead.p : tmp.set(actor.x, (actor.roof ? ROOF_Y : DIM.FLOOR) + 1.2, actor.z), state.t, actor.roof ? loc.i : state.camCar);
  if (gameSys) { gameSys.update(dt, state.t); if (state.t - goalT > .4) { goalT = state.t; ui.goals(gameSys.goals, game.mode); } }
  placeSun(); const lab = interact.label();
  const tgt = ctx.heist && heist ? heist.target(loc.i) : null, v0 = ctx.heist && interact.near && USE.test(interact.near.id) ? interact.near.verbs()[0] : null;
  if (heist) heist.update(dt, loc.i);
  if (ctx.heist) ui.context(tgt ? `${tgt.label} · ${tgt.what}` : v0 ? v0.label : (journey.phase === 'dwell' ? `Get off · ${nextHalt().name}` : null));
  else ui.context(lab && (!actor.seated || interact.open) ? lab : actor.seated ? 'Stand' : portal ? `Enter · ${portal.world.title}` : halt ? `Get off · ${nextHalt().name}` : nearestSeat() ? 'Sit' : null);
  ui.status(journey, land.env, rig.st.shot, `stubs ${game.stubs.size}/${game.total} · stings ${state.stings}${game.inv.length ? ' · ' + game.inv.join(', ') : ''}${state.bee ? ' · you are the bee' : ''}`);
  audio.update(journey.speed, rig.st.shot.inside ? 1 : .6, dark);
  renderPass(state.pass, scene, camera);
}
const axis = (p, n) => (input.keys.has(p) ? 1 : 0) - (input.keys.has(n) ? 1 : 0);

// ---- seeds: a composed, repeatable starting frame for a world model, with the true depth of the blocking
const depthMat = new THREE.ShaderMaterial({ side: THREE.DoubleSide,
  vertexShader: `varying float vZ;
#include <common>
#include <skinning_pars_vertex>
void main(){
#include <skinbase_vertex>
#include <begin_vertex>
#include <skinning_vertex>
#include <project_vertex>
vZ = -mvPosition.z; }`,
  fragmentShader: 'varying float vZ; void main(){ gl_FragColor = vec4(vZ, 0., 0., 1.); }' });
let seeds = null;
async function seed(id) {
  if (!seeds) seeds = (await (await fetch('data/seeds.json')).json()).seeds;
  const sd = seeds.find(x => x.id === id); if (!sd) return null;
  if (worlds && worlds.stage.active) await worlds.exit();
  const c = cars[sd.car]; state.take = false; state.walkGoal = null; journey.dist = sd.km * 1000; journey.phase = 'run'; journey.speed = journey.cruise;
  if (sd.seat !== undefined) { const st = sd.seat < 0 ? c.playerSeat : c.seats[sd.seat]; actor.seated = true; actor.seat = { car: c, ...st }; actor.x = c.x + st.x; actor.z = st.z; actor.dir = st.face; }
  else { actor.seated = false; actor.x = c.x + sd.x; actor.dir = sd.dir || -1; actor.z = c.aisleZ + (sd.z || 0); actor.yaw = actor.dir * Math.PI / 2; if (sd.walk) state.walkGoal = actor.x + actor.dir * sd.walk; }
  state.forceSwarm = !!sd.swarm; state.empty = !!sd.empty; setCans(!!sd.cans); state.high = !!sd.high; actor.cam = actor.dir; if (sd.cans && game.mode === 'game') gameSys.setMode('world'); setShot(sd.shot); const st = rig.st; st.yaw = sd.yaw || 0; st.pitch = sd.pitch || 0; st.zoom = sd.zoom || 1; if (sd.mt !== undefined) st.mem.t0 = state.t - sd.mt;
  document.body.classList.add('nohud'); return sd;
}
function b64(buf) { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); }
/** One frame as a generator wants it: the picture, linear depth along the view axis in metres, and the posed pinhole camera. */
function capture(w = 1280, h = 720) {
  const pr = renderer.getPixelRatio(); renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.render(scene, camera); const color = canvas.toDataURL('image/jpeg', .93);
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }), hidden = [];
  scene.traverse(o => { if (o.visible && (o.isSprite || o.isPoints || (o.material && o.material.transparent && o.material.opacity < .9))) { o.visible = false; hidden.push(o); } });
  scene.overrideMaterial = depthMat; const fog = scene.fog; scene.fog = null; renderer.setRenderTarget(rt); renderer.render(scene, camera);
  const px = new Float32Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px); renderer.setRenderTarget(null); scene.overrideMaterial = null; scene.fog = fog; hidden.forEach(o => o.visible = true); rt.dispose();
  const z = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) z[(h - 1 - y) * w + x] = px[(y * w + x) * 4] || 5000;   // top row first
  renderer.setPixelRatio(pr); resize(); const fy = h / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const pack = {}; for (const n of ['normals', 'ids', 'wire', 'clay']) { renderPass(n, scene, camera); pack[n] = canvas.toDataURL('image/jpeg', .9); }
  return { width: w, height: h, color, pack, depth: b64(z.buffer), camera: { extrinsics: { coordinateSystem: 'rub', position: camera.position.toArray(), quaternion: camera.quaternion.toArray() }, intrinsics: { width: w, height: h, fx: fy, fy, cx: w / 2, cy: h / 2 } }, observe: api.observe() };
}

gameSys = createGame({ scene, cars, train, bees, interact, actor, journey, state, stub, deed, env: land.env });
const heist = createHeist({ scene, cars, train, props, people, actor, state, stub, deed, game, sys: gameSys, audio });
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => audio.start(), { once: true });   // sound is on from the first touch

// ---- all people are SPAM: every body on the train swapped for a walking tin
function setCans(on) { state.cans = on; [hero, ...people].forEach((p, k) => { if (!p) return; if (on && !p.can) { p.can = makeCan(p === hero ? 0 : 1 + (k % 7)); p.can.group.userData.cls = 'person'; p.root.add(p.can.group); } if (p.can) p.can.group.visible = on; p.ch.group.visible = !on; }); return on; }
function stepCans(dt) { if (!state.cans) return; if (hero && hero.can) hero.can.update(dt, actor.speed, actor.seated, state.react && state.t < state.react.until ? 1 : 0); for (const p of people) if (p.can && p.root.visible) p.can.update(dt, p.walk ? .8 : 0, !!p.loco.sitting, p.loco.talking ? (Math.sin(state.t * 2 + p.root.position.x) > .6 ? 1 : 0) : 0); }

// ---- the run: a rehearsal of the single world-model session. Third-person lock, WASD, and at each door the cue that would be sent.
const run = { on: false, cars: [], n: 1 };
async function startRun() {
  if (!seeds) seeds = (await (await fetch('data/seeds.json')).json()).seeds;
  const spam = params.get('run') !== 'worlds';   // ?run is SPAM on a Train; ?run=worlds is the earlier corpus run
  run.cars = spam ? (await (await fetch('data/spam_session.json')).json()).run.map((c, k) => ({ ...c, car: k + 1 })) : seeds.filter(x => x.run).sort((a, b) => a.run - b.run); run.on = true; run.n = 1; actor.cam = -1; state.take = false; state.stings = 0; state.empty = spam || !!run.cars[0].empty; setCans(spam); if (game.mode === 'game') gameSys.setMode('world');
  if (worlds && worlds.stage.active) await worlds.exit();
  actor.seated = false; actor.x = cars[1].x + 5.6; actor.z = 0; actor.dir = -1; actor.yaw = -Math.PI / 2; state.walkGoal = null; rig.set('follow'); ui.shot('follow', false);
  document.body.classList.add('run'); ui.cue(run.cars[0], 1, run.cars.length, true); stub('The run', 'one session · hold W · a cue at every door'); return true;
}
function stepRun() {
  if (!run.on) return; if (rig.st.shot.id !== 'follow') rig.set('follow');
  const next = run.cars[run.n]; if (!next) return;
  const door = train.doors.find(d => d.car.i === next.car - 1 && d.x < d.car.x);     // the rear door of the carriage he is leaving
  const last = !door && next.car > cars.length - 1 && actor.x < cars[cars.length - 1].x - 3;   // the train has eight doors' worth of rooms; the ninth cue falls at the far end of the hive
  if (last || (door && door.open > .5 && actor.x - door.x < 1.9)) { run.n++; ui.cue(next, run.n, run.cars.length, false); state.log.push({ t: +state.t.toFixed(1), cue: next.id }); try { navigator.clipboard.writeText(next.genie).catch(() => {}); } catch { } }
}

// ---- light that casts: the sun through the windows, and a sky for the brass to reflect
if (!mobile) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; sunL.castShadow = true; sunL.shadow.mapSize.set(2048, 2048); const sc = sunL.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 14; sc.bottom = -14; sc.near = 5; sc.far = 140; sunL.shadow.bias = -.0006; sunL.shadow.normalBias = .04; scene.add(sunL.target); }
const SUN = new THREE.Vector3(.55, .42, .72).normalize();
function placeSun() { const x = Math.round(camera.position.x / 2) * 2; sunL.target.position.set(x, 2, 0); sunL.position.set(x + SUN.x * 60, 2 + SUN.y * 60, SUN.z * 60); }
{ const es = new THREE.Scene(), sky = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'varying vec3 p; void main(){ float h=normalize(p).y; vec3 c=mix(vec3(.55,.36,.2),vec3(.98,.82,.56),smoothstep(-.3,.1,h)); c=mix(c,vec3(.25,.45,.5),smoothstep(.1,.9,h)); gl_FragColor=vec4(c,1.); }' }));
  es.add(sky); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, .04).texture; pm.dispose(); }
let goalT = 0;
// ---- witness passes: the same frame as normals, depth, object classes, wireframe and clay, for conditioning and for reading the scene
const PASSES = ['beauty', 'clay', 'normals', 'depth', 'ids', 'wire'], passMat = { normals: new THREE.MeshNormalMaterial(), clay: new THREE.MeshLambertMaterial({ color: 0xbdb8ae }), wire: new THREE.MeshBasicMaterial({ color: 0x66ffcc, wireframe: true }),
  depth: new THREE.ShaderMaterial({ side: THREE.DoubleSide, vertexShader: depthMat.vertexShader, fragmentShader: 'varying float vZ; void main(){ float d=clamp(1.-log(vZ)/log(400.),0.,1.); vec3 c=mix(vec3(.9,.1,.05),vec3(.1,.2,.95),d); c=mix(c,vec3(.1,.9,.4),1.-abs(d-.5)*2.); gl_FragColor=vec4(c,1.); }' }) };
const CLS = { person: 0xff8a1e, train: 0x2a6f9c, land: 0x7a4bd0, bee: 0xffe600, screen: 0xff3b6b, prop: 0x35c46a }, idMats = Object.fromEntries(Object.entries(CLS).map(([k, c]) => [k, new THREE.MeshBasicMaterial({ color: c })]));
const classOf = o => { for (let p = o; p; p = p.parent) { if (p.userData.cls) return p.userData.cls; } return 'prop'; };
train.root.userData.cls = 'train'; land.root.userData.cls = 'land';
function renderPass(name, sc, cam) {
  if (name === 'beauty') return renderer.render(sc, cam);
  const hidden = [], swapped = []; sc.traverse(o => { if (o.visible && (o.isSprite || o.isPoints || (o.material && o.material.transparent && o.material.opacity < .9) || (name !== 'ids' && name !== 'depth' && o.material && o.material.side === THREE.BackSide))) { o.visible = false; hidden.push(o); } });
  const fog = sc.fog, bg = sc.background; sc.fog = null; sc.background = name === 'wire' ? new THREE.Color(0x05070a) : name === 'ids' ? new THREE.Color(0xf7e600) : bg;
  if (name === 'ids') sc.traverse(o => { if (o.isMesh && o.visible) { swapped.push([o, o.material]); o.material = o.isInstancedMesh && o.count > 100 && !o.parent.userData.cls ? idMats.bee : idMats[classOf(o)]; } }); else sc.overrideMaterial = passMat[name];
  renderer.render(sc, cam); sc.overrideMaterial = null; sc.fog = fog; sc.background = bg; for (const [o, m] of swapped) o.material = m; hidden.forEach(o => o.visible = true);
}

function toggleBee(on = !state.bee) { state.bee = on; bees.lead.manual = on; state.take = false; interact.close(); if (on) { state.beeYaw = actor.dir > 0 ? 0 : Math.PI; state.beePitch = 0; bees.lead.p.set(actor.x + actor.dir * .8, DIM.FLOOR + 1.5, actor.z); setShot('bee'); stub('You are the bee', 'fly where you look · Space up · Shift down · B to return'); } else setShot('follow'); document.body.classList.toggle('bee', on); return on; }

// ---- actions
async function act() {
  if (worlds && worlds.stage.active) return worlds.exit();
  if (game.mode === 'game' && heist) { const loc = locate(cars, actor.x), tgt = heist.target(loc.i); if (actor.seated) stand(); if (tgt) return tgt.run(); const n = interact.near, v0 = n && USE.test(n.id) ? n.verbs()[0] : null; if (v0) return v0.run(n); if (journey.phase === 'dwell') return getOff(); return; }
  if (interact.open || (interact.near && !actor.seated)) return interact.act();
  if (actor.seated) return stand();
  if ((journey.phase === 'dwell' || (journey.phase === 'held' && journey.speed < .4)) && !actor.roof && !(worlds && worlds.nearest(tmp.set(actor.x, DIM.FLOOR + 1.2, actor.z), 3.2))) return getOff();
  const portal = worlds && worlds.nearest(tmp.set(actor.x, DIM.FLOOR + 1.2, actor.z), 3.2);
  if (portal) { state.take = false; stub(`Through the threshold`, portal.world.title); return worlds.enter(portal); }
  sit();
}
function still() {
  const st = worlds && worlds.stage.active; renderer.render(st ? worlds.stage.scene : scene, st ? worlds.stage.camera : camera);
  canvas.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `bees-on-a-train_${st ? worlds.stage.id : rig.st.shot.id}_${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
}
let rec = null;
function record() {
  if (rec) { rec.stop(); return false; }
  const stream = canvas.captureStream(30), type = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)), chunks = [];
  rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 9e6 }); rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(chunks, { type })); a.download = `bees-on-a-train_take_${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`; a.click(); rec = null; ui.recording(false); };
  rec.start(); ui.recording(true); return true;
}
const api = {
  version: '2.0.0', shots: () => SHOTS.map(s => s.id), camera: id => setShot(id), take: (on = !state.take) => { state.take = on; state.takeT = 0; ui.shot(rig.st.shot.id, on); return on; },
  act, stand, sit, still, record, swarm: (on = !state.forceSwarm) => (state.forceSwarm = on), jump: km => { journey.dist = km * 1000; journey.phase = 'run'; },
  walkTo: car => { if (actor.seated) stand(); state.walkGoal = cars[clamp(car, 0, 7)].x; }, enter: id => { const p = worlds.portals.find(p => p.ids.includes(id)); return p && worlds.enter(p, id); }, exit: () => worlds.exit(),
  next: d => { const s = worlds.stage; if (s.active) { s.portal.show(s.portal.index + d); return worlds.enter(s.portal); } }, live: () => worlds.toggleLive(),
  run: startRun, cans: on => setCans(on ?? !state.cans), endRun: () => { run.on = false; state.empty = false; setCans(false); document.body.classList.remove('run'); ui.cue(null); }, mode: m => { if (m === 'game' && actor.seated) stand(); return gameSys.setMode(m); }, throw: () => heist.throwCan(), turn: () => { actor.cam *= -1; return actor.cam; }, heist: () => ({ ...heist.H, loose: undefined }), get sys() { return gameSys; }, smoke: () => gameSys.smoke(), goals: () => gameSys.goals.map(q => ({ id: q.id, done: !!q.done() })), pass: n => { state.pass = PASSES.includes(n) ? n : PASSES[(PASSES.indexOf(state.pass) + 1) % PASSES.length]; stub('Pass', state.pass); return state.pass; }, passes: () => PASSES.slice(), bee: toggleBee, game: () => ({ stubs: game.stubs.size, total: game.total, talked: game.talked.size, inv: game.inv.slice(), water: game.water, stings: state.stings }), interact, deed, deeds: () => Object.keys(DEEDS), seed, capture, seeds: async () => { if (!seeds) seeds = (await (await fetch('data/seeds.json')).json()).seeds; return seeds; },
  log: () => state.log.slice(), rig: (w, h) => rig.export({ a: actor, car: locate(cars, actor.x).car, aisleZ: 0, side: 1, bee: bees.lead, t: state.t, dist: journey.dist, speed: journey.speed, noseX: train.noseX, tailX: train.tailX }, w, h),
  observe: () => ({ t: +state.t.toFixed(2), km: +(journey.dist / 1000).toFixed(3), speed: +journey.speed.toFixed(1), phase: journey.phase, car: cars[state.lastCar]?.key, seated: actor.seated, stings: state.stings, x: +actor.x.toFixed(2), shot: rig.st.shot.id, take: state.take, run: run.on ? run.n : 0, world: worlds?.stage.active ? worlds.stage.id : null, segment: land.env.segment?.type || null, people: people.length, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
  _: { scene, camera, renderer, train, land, rig, actor, journey, state, input, get people() { return people; }, get cast() { return cast; }, get hero() { return hero; } },
};
window.trainFilm = api;
ui.bind({ api, input, audio, setShot, worldsRef: () => worlds, state });
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; const k = e.key.toLowerCase(); input.keys.add(k);
  if (k === 'e' || k === 'enter') act(); else if (k === 'f') deed('stung'); else if (k === 'g') deed('swat'); else if (k === 'v') deed('dazed'); else if (k === 't') api.take(); else if (k === 'c') setShot(SHOTS[(SHOTS.indexOf(rig.st.shot) + 1) % SHOTS.length].id); else if (k === 'p') still(); else if (k === 'h') ui.hud(state.hud = !state.hud); else if (k === 'escape' && worlds?.stage.active) worlds.exit(); else if (k === 'b') toggleBee(); else if ((k === ' ' || k === 'x') && !state.bee) heist.throwCan(); else if (k === 'z' && game.mode === 'game') actor.cam *= -1; else if (k === 'r') gameSys.smoke(); else if (k === 'm') api.pass(); else if (k === 'q') state.shoulder *= -1; else if (k === 'escape' || k === 'backspace') interact.close(); else if (/^[1-9]$/.test(k)) { if (interact.open) interact.run(+k - 1); else setShot(SHOTS[+k - 1].id); } });
addEventListener('keyup', e => input.keys.delete(e.key.toLowerCase())); addEventListener('blur', () => input.keys.clear());

ui.loading('laying track');
frame();
buildWorlds({ scene, train, renderer, ui, toast: stub }).then(w => { worlds = w;
  for (const pt of w.portals) interact.add({ id: 'threshold' + pt.car.i, car: pt.car.i, pos: () => pt.pos, radius: 2.6, kicker: 'Threshold', title: () => pt.world.title,
    rows: () => [['Source', pt.world.source], ['Kind', pt.world.kind === 'footage' ? 'a frame of footage' : 'a generated keyframe'], ['World', `${pt.index + 1} of ${pt.ids.length} behind this pane`]],
    verbs: () => [{ label: 'Step through', run: () => { state.take = false; stub('Through the threshold', pt.world.title); w.enter(pt); return false; } }, { label: 'Next world', run: () => { pt.show(pt.index + 1); return true; } }] }); if (params.get('world')) api.enter(params.get('world')); }).catch(e => console.warn('worlds unavailable', e));
Promise.resolve(bootCast()).then(() => { if (!params.has('world') && !params.has('run') && !params.has('take') && !params.get('seed') && !params.get('shot')) api.mode('game'); if (params.get('pass')) state.pass = params.get('pass');
  if (params.has('run')) startRun(); else if (params.get('seed')) seed(params.get('seed')); else if (params.get('shot')) setShot(params.get('shot')); else setShot('profile'); if (params.has('take')) api.take(true); stub('BEES ON A TRAIN', 'the sealed line · the train is moving, you cannot get off'); });
