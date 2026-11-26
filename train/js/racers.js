// SPAM WARS · Can Racers. Two engines, one pod, two drivers: each player holds one engine's throttle, so steering is an argument.
// Physics is Rapier (rigid bodies, walls, sweepers, thrown cans); the binder, the cables and the hover are forces written here.
import * as THREE from 'three';

const $ = id => document.getElementById(id), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const mobile = matchMedia('(pointer:coarse)').matches;
const R = (await import('../../highland-exposure/motion-lab/vendor/rapier.es.js')).default; await R.init();

// ---------------- the cans you can race
const CANS = [
  { id: 'classic', name: 'CLASSIC', style: 'All-rounder', a: '#17307a', b: '#ffd92e', mass: 1, thrust: 1, boost: 1, grip: 1, traits: ['Balanced', 'Starts with 3 cans', 'Boost refills at pace'] },
  { id: 'lite', name: 'LITE', style: 'Twitchy', a: '#1c8fc4', b: '#ffffff', mass: .78, thrust: .96, boost: .9, grip: 1.25, traits: ['Light: turns on a coin', 'Gets shoved around', 'Holds the inside line'] },
  { id: 'hot', name: 'HOT', style: 'Boost rider', a: '#b3261e', b: '#ffb52e', mass: 1, thrust: 1.02, boost: 1.45, grip: .9, traits: ['Boost burns hotter', 'Slides wide', 'Boost refills slowly'] },
  { id: 'thick', name: 'THICK', style: 'Bruiser', a: '#3a2416', b: '#f0d9a0', mass: 1.5, thrust: 1.12, boost: 1, grip: 1.05, traits: ['Heavy: shrugs off hits', 'Slow to turn', 'Starts with 6 cans'] },
];
function labelTex(c) { const k = document.createElement('canvas'); k.width = 512; k.height = 128; const q = k.getContext('2d'); q.fillStyle = c.a; q.fillRect(0, 0, 512, 128); q.fillStyle = c.b; q.font = '900 86px "Arial Black", Impact, sans-serif'; q.textBaseline = 'middle'; q.fillText('SPAM', 14, 66); q.font = '800 30px Arial, sans-serif'; q.fillText(c.name, 330, 44, 170); q.fillStyle = '#ffffff55'; q.fillRect(326, 70, 172, 34);
  const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// ---------------- scene
const canvas = $('stage'), renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
if (!mobile) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9c99a); scene.fog = new THREE.Fog(0xe9c99a, 140, 900);
const camera = new THREE.PerspectiveCamera(70, 1, .3, 2500);
scene.add(new THREE.HemisphereLight(0xfff0d6, 0x7a5a3c, 1.05)); const sun = new THREE.DirectionalLight(0xffd29a, 2.3); scene.add(sun, sun.target);
if (!mobile) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const s = sun.shadow.camera; s.left = s.bottom = -70; s.right = s.top = 70; s.near = 10; s.far = 300; sun.shadow.bias = -.0005; }
const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }; addEventListener('resize', resize); resize();

// ---------------- the circuit: a closed curve on the salt flat, beside the Sealed Line
const CP = [[0, 0], [170, -8], [300, 40], [330, 150], [250, 230], [140, 200], [70, 270], [-60, 300], [-170, 230], [-150, 110], [-230, 30], [-170, -70], [-70, -40]].map(([x, z]) => new THREE.Vector3(x, 0, z));
const curve = new THREE.CatmullRomCurve3(CP, true, 'catmullrom', .5), NS = 520, HALF = 11;
const P = curve.getSpacedPoints(NS).slice(0, NS), TAN = P.map((_, i) => P[(i + 1) % NS].clone().sub(P[(i - 1 + NS) % NS]).normalize()), NOR = TAN.map(t => new THREE.Vector3(t.z, 0, -t.x));
const world = new R.World({ x: 0, y: -18, z: 0 }); world.timestep = 1 / 60;
world.createCollider(R.ColliderDesc.cuboid(1200, .5, 1200).setTranslation(0, -.5, 0).setFriction(.2));
{ // road, kerbs and walls
  const pos = [], idx = [], col = [], c1 = new THREE.Color(0x4a3f38), c2 = new THREE.Color(0x574a40);
  for (let i = 0; i <= NS; i++) { const k = i % NS, c = i % 2 ? c1 : c2; for (const s of [-1, 1]) { pos.push(P[k].x + NOR[k].x * s * HALF, .03, P[k].z + NOR[k].z * s * HALF); col.push(c.r, c.g, c.b); } if (i < NS) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const road = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); road.receiveShadow = true; scene.add(road);
  const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.3, .6), new THREE.MeshLambertMaterial({ color: 0xffffff }), NS * 2), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3(), cc = new THREE.Color();
  for (let i = 0; i < NS; i++) { const j = (i + 1) % NS, len = P[i].distanceTo(P[j]) + .3, yaw = Math.atan2(TAN[i].x, TAN[i].z); q.setFromAxisAngle(up, yaw + Math.PI / 2);
    for (const sd of [-1, 1]) { const k = i * 2 + (sd > 0 ? 1 : 0); v.set((P[i].x + P[j].x) / 2 + NOR[i].x * sd * (HALF + .5), .65, (P[i].z + P[j].z) / 2 + NOR[i].z * sd * (HALF + .5)); m.compose(v, q, s.set(len, 1, 1)); wall.setMatrixAt(k, m); wall.setColorAt(k, cc.set(Math.floor(i / 3) % 2 ? 0xb3261e : 0xf1ede2));
      world.createCollider(R.ColliderDesc.cuboid(len / 2, 1.6, .3).setTranslation(v.x, 1.2, v.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setRestitution(.35).setFriction(0)); } }
  wall.castShadow = true; scene.add(wall);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0xd9b27a })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.02; ground.receiveShadow = true; scene.add(ground);
  const gate = new THREE.Group(), gm = new THREE.MeshLambertMaterial({ color: 0x17307a }); for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1, 9, 1), gm); p.position.set(sd * (HALF + 1), 4.5, 0); gate.add(p); }
  const k = document.createElement('canvas'); k.width = 1024; k.height = 128; const x = k.getContext('2d'); x.fillStyle = '#17307a'; x.fillRect(0, 0, 1024, 128); x.fillStyle = '#ffd92e'; x.font = '900 92px "Arial Black", Impact'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SPAM WARS · CAN RACERS', 512, 68, 990);
  const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; const banner = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 3, 2.6, .5), [gm, gm, gm, gm, new THREE.MeshBasicMaterial({ map: t }), new THREE.MeshBasicMaterial({ map: t })]); banner.position.y = 8.6; gate.add(banner);
  gate.position.copy(P[0]); gate.rotation.y = Math.atan2(TAN[0].x, TAN[0].z); scene.add(gate);
  for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 520 + (i * 97) % 380, mesa = new THREE.Mesh(new THREE.CylinderGeometry(30 + (i * 13) % 50, 60 + (i * 29) % 70, 40 + (i * 31) % 90, 7), new THREE.MeshLambertMaterial({ color: i % 2 ? 0xb07a4a : 0x9a6a52, flatShading: true })); mesa.position.set(60 + Math.cos(a) * r, 20, 110 + Math.sin(a) * r); scene.add(mesa); }
}
// the Sealed Line stands beside the back straight
if (!mobile) import('./train.js').then(async ({ buildTrain }) => { const { makeTextures, makeMaterials } = await import('./kit.js'); const M = makeMaterials(makeTextures()); M.panels = M.wood; M.screens = [new THREE.MeshBasicMaterial({ color: 0x1f4d4a })];
  const t = buildTrain(scene, M); t.root.position.set(170, 0, -42); t.root.rotation.y = .06; }).catch(() => {});

// ---------------- hazards: sweepers and bumpers, after the game-show fashion
const sweepers = [120, 300, 430].map((i, n) => { const g = new THREE.Group(), post = new THREE.Mesh(new THREE.CylinderGeometry(.7, .9, 3, 12), new THREE.MeshLambertMaterial({ color: 0x17307a })), arm = new THREE.Mesh(new THREE.BoxGeometry(HALF * .9, .8, .8), new THREE.MeshLambertMaterial({ color: 0xffd92e })); post.position.y = 1.5; arm.position.y = 1.2; arm.castShadow = true; g.add(post, arm); const sx = P[i].x + NOR[i].x * HALF * .5, sz = P[i].z + NOR[i].z * HALF * .5; g.position.set(sx, 0, sz); scene.add(g);
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(sx, 1.2, sz)); world.createCollider(R.ColliderDesc.cuboid(HALF * .45, .4, .4).setRestitution(1.2), body);   // it sweeps one half of the road; the other half is always open
  return { g, body, a: n * 1.3, w: (n % 2 ? -1 : 1) * (.9 + n * .25) }; });
for (const i of [60, 200, 205, 370, 480]) { const s = i % 2 ? 1 : -1, x = P[i].x + NOR[i].x * s * (HALF * .45), z = P[i].z + NOR[i].z * s * (HALF * .45), b = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.6, 16), new THREE.MeshLambertMaterial({ color: 0xe5588a })); b.position.set(x, .8, z); b.castShadow = true; scene.add(b); world.createCollider(R.ColliderDesc.cylinder(.8, 1.5).setTranslation(x, .8, z).setRestitution(1.7)); }
const pads = [40, 160, 260, 345, 455].map(i => { const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 9), new THREE.MeshBasicMaterial({ color: 0x38e0c0, transparent: true, opacity: .75 })); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(TAN[i].x, TAN[i].z); m.position.set(P[i].x, .06, P[i].z); scene.add(m); return { i, m }; });
const crates = [25, 90, 145, 215, 280, 330, 400, 470].map((i, n) => { const s = (n % 3) - 1, m = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1, .85), new THREE.MeshStandardMaterial({ map: labelTex(CANS[n % 4]), roughness: .4 })); m.position.set(P[i].x + NOR[i].x * s * 5, 1.4, P[i].z + NOR[i].z * s * 5); m.castShadow = true; scene.add(m); return { m, back: 0 }; });

// ---------------- craft
const boxG = new THREE.BoxGeometry(.8, .8, 2.6), podG = new THREE.CylinderGeometry(.75, .75, 1.3, 14), glowG = new THREE.ConeGeometry(.34, 2.2, 10).rotateX(-Math.PI / 2), lidM = new THREE.MeshStandardMaterial({ color: 0xb9bfc2, metalness: .9, roughness: .3 }), glowM = () => new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: .8 });
function canMesh(c) { const side = new THREE.MeshStandardMaterial({ map: labelTex(c), roughness: .4, metalness: .25 }), g = new THREE.Group(), m = new THREE.Mesh(boxG, [side, side, side, side, lidM, lidM]); m.castShadow = true; const fl = new THREE.Mesh(glowG, glowM()); fl.position.z = -2.3; g.add(m, fl); g.flame = fl; return g; }
function podMesh(c, crew) { const g = new THREE.Group(), m = new THREE.Mesh(podG, [new THREE.MeshStandardMaterial({ map: labelTex(c), roughness: .4 }), lidM, lidM]); m.castShadow = true; g.add(m);
  for (let k = 0; k < crew; k++) { const h = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), new THREE.MeshLambertMaterial({ color: 0x5a3b26 })), hat = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .05, 12), new THREE.MeshLambertMaterial({ color: k ? 0xb3261e : 0x3a2416 })); h.position.set((k - (crew - 1) / 2) * .5, .86, 0); hat.position.set(h.position.x, 1.05, 0); g.add(h, hat); } return g; }
const yawOf = b => { const q = b.rotation(); return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z)); };
const mkBody = (x, z, yaw, hx, hy, hz, mass) => { const b = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, 1.1, z).setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }).setLinearDamping(.05).setAngularDamping(2.5).enabledRotations(false, true, false).setCcdEnabled(true)); world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setMass(mass).setRestitution(.3).setFriction(0), b); return b; };
const HOVER = 1.1, F = 34;
function hoverAndGrip(b, m, grip, fwd) { const p = b.translation(), v = b.linvel(), rx = fwd.z, rz = -fwd.x, lat = v.x * rx + v.z * rz; b.addForce({ x: -lat * rx * grip * m * 4 - v.x * m * .7, y: m * (18 + (HOVER - p.y) * 60 - v.y * 9), z: -lat * rz * grip * m * 4 - v.z * m * .7 }, true); }
const fwdOf = (yaw, o = new THREE.Vector3()) => o.set(Math.sin(yaw), 0, Math.cos(yaw));
const tmpF = new THREE.Vector3(), tmpG = new THREE.Vector3(), tmpV = new THREE.Vector3();

const racers = [];
function grid(n) { const i = (NS - 6 - Math.floor(n / 2) * 7 + NS) % NS, s = n % 2 ? 1 : -1; return { x: P[i].x + NOR[i].x * s * 4.5, z: P[i].z + NOR[i].z * s * 4.5, yaw: Math.atan2(TAN[i].x, TAN[i].z), i }; }
function makePlayer(c) {
  const g = grid(0), f = fwdOf(g.yaw), rx = f.z, rz = -f.x, e = [-1, 1].map(s => mkBody(g.x + rx * s * 1.4, g.z + rz * s * 1.4, g.yaw, .4, .4, 1.3, 2.2 * c.mass)), pod = mkBody(g.x - f.x * 5, g.z - f.z * 5, g.yaw, .7, .6, .7, 1.6 * c.mass);
  const eng = e.map(() => { const m = canMesh(c); scene.add(m); return m; }), pm = podMesh(c, 2); scene.add(pm);
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(18), 3)), new THREE.LineBasicMaterial({ color: 0xff7ae0 })); lines.frustumCulled = false; scene.add(lines);
  return { player: true, c, e, pod, eng, pm, lines, thr: [0, 0], boost: 0, boostT: 0, meter: 1, ammo: c.id === 'thick' ? 6 : 3, stun: 0, idx: g.i, lap: -1, prog: 0, done: 0, name: 'YOU', mid: new THREE.Vector3(), yaw: g.yaw, speed: 0 };
}
function tag(text, col) { const k = document.createElement('canvas'); k.width = 256; k.height = 64; const q = k.getContext('2d'); q.fillStyle = col; q.fillRect(0, 8, 256, 48); q.fillStyle = '#fff'; q.font = '900 34px Arial Black, Impact'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(text, 128, 34, 240); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(k), depthTest: false })); sp.scale.set(3.2, .8, 1); sp.position.y = 2.2; return sp; }
const PILOTS = ['VOSS', 'MARA', 'NATE', 'ANTA', 'BEKELE'];
function makeAI(c, n) { const g = grid(n), b = mkBody(g.x, g.z, g.yaw, 1.7, .45, 1.4, 5 * c.mass), eng = [canMesh(c), canMesh(c)], pm = podMesh(c, 1); eng.forEach(m => scene.add(m)); scene.add(pm); pm.add(tag(PILOTS[n - 1] || c.name, c.a));
  return { c, b, eng, pm, lane: (n % 3 - 1) * 4.5, skill: .74 + (n * .37 % .14), ammo: 2, cool: 4 + n * 2, boostT: 0, stun: 0, idx: g.i, lap: -1, prog: 0, done: 0, name: PILOTS[n - 1] || c.name, mid: new THREE.Vector3(), yaw: g.yaw, speed: 0, podP: new THREE.Vector3(g.x, HOVER, g.z) }; }

// thrown cans
const shots = []; for (let k = 0; k < 10; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.7, .5, .45), new THREE.MeshStandardMaterial({ map: labelTex(CANS[k % 4]), roughness: .4 })); m.visible = false; m.castShadow = true; scene.add(m);
  const b = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, -50 - k * 3, 0).setCcdEnabled(true)); world.createCollider(R.ColliderDesc.cuboid(.35, .25, .22).setMass(.5).setRestitution(.5), b); shots.push({ m, b, life: 0, owner: null }); }
function fire(r) { if (r.ammo <= 0 || r.stun > 0 || state.phase !== 'race') return false; const s = shots.find(q => q.life <= 0); if (!s) return false; r.ammo--; const f = fwdOf(r.yaw, tmpF);
  s.b.setTranslation({ x: r.mid.x + f.x * 3.4, y: 1.5, z: r.mid.z + f.z * 3.4 }, true); s.b.setLinvel({ x: f.x * (r.speed + 42), y: 3.5, z: f.z * (r.speed + 42) }, true); s.b.setAngvel({ x: 9, y: 4, z: 0 }, true); s.life = 3.2; s.owner = r; s.m.visible = true; audio.fx('throw'); return true; }
function smack(r, from, power = 1) { const k = power / r.c.mass, f = tmpG.set(r.mid.x - from.x, 0, r.mid.z - from.z).normalize(), bodies = r.player ? [...r.e, r.pod] : [r.b]; for (const b of bodies) { b.applyImpulse({ x: f.x * 22 * k, y: 9 * k, z: f.z * 22 * k }, true); b.applyTorqueImpulse({ x: 0, y: (Math.random() - .5) * 60 * k, z: 0 }, true); } r.stun = 1.1 / r.c.mass; audio.fx('hit'); if (r.player) { shake = 1; flash('SPAMMED'); navigator.vibrate?.(120); } }

// ---------------- input: one throttle per player
const inp = { t: [0, 0], fire: false, boost: false, steer: 0, keys: new Set() }, state = { phase: 'select', mode: 'coop', t: 0, count: 0, pick: 0, laps: 3, finish: 0 };
for (const [id, k] of [['lev0', 0], ['lev1', 1]]) { const el = $(id), nub = el.firstElementChild; let pid = null, y0 = 0, x0 = 0;
  const mv = e => { const dy = clamp((y0 - e.clientY) / 70, -.5, 1); inp.t[k] = dy; const sx = clamp((e.clientX - x0) / 46, -1, 1); if (state.mode === 'solo') { inp.steer = sx; nub.style.transform = `translate(${sx * 30}px,${dy < -.25 ? 30 : 0}px)`; } else nub.style.transform = `translateY(${-dy * 56}px)`; };
  el.addEventListener('pointerdown', e => { pid = e.pointerId; el.setPointerCapture(pid); y0 = e.clientY + (state.mode === 'solo' ? 0 : 35); x0 = e.clientX; mv(e); audio.start(); });   // in co-op, touching is already half throttle
  el.addEventListener('pointermove', e => { if (e.pointerId === pid) mv(e); }); const end = e => { if (e.pointerId !== pid) return; pid = null; inp.t[k] = 0; inp.steer = 0; nub.style.transform = ''; }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); }
$('fire').addEventListener('pointerdown', () => { inp.fire = true; }); $('boost').addEventListener('pointerdown', () => { inp.boost = true; });
addEventListener('keydown', e => { const k = e.key.toLowerCase(); inp.keys.add(k); if (k === 'e' || k === ' ') inp.fire = true; if (k === 'enter' || k === 'shift' || k === '/') inp.boost = true; if (k === 'm') setMode(state.mode === 'coop' ? 'solo' : 'coop'); if (state.phase === 'select') { if (k === 'arrowright' || k === 'd') pick(state.pick + 1); if (k === 'arrowleft' || k === 'a') pick(state.pick - 1); if (k === 'enter' || k === ' ') begin(); } });
addEventListener('keyup', e => inp.keys.delete(e.key.toLowerCase()));
/** Both modes come down to a throttle and a steer. Solo drives itself forward and you steer; co-op takes the two throttles' average and their difference. */
function readInput() { const K = inp.keys, held = (...k) => k.some(x => K.has(x)); let a = inp.t[0], b = inp.t[1], st = inp.steer;
  const pads = [...(navigator.getGamepads?.() || [])].filter(Boolean);
  if (pads[0]) { const p = pads[0], q = pads[1]; if (Math.abs(p.axes[1]) > .12) a = -p.axes[1]; if (q) { if (Math.abs(q.axes[1]) > .12) b = -q.axes[1]; } else if (Math.abs(p.axes[3] ?? 0) > .12) b = -p.axes[3]; if (Math.abs(p.axes[0]) > .15) st = p.axes[0];
    for (const g of pads) { if ([0, 2, 4, 6].some(i => g.buttons[i]?.pressed)) { if (!g._f) inp.fire = true; g._f = 1; } else g._f = 0; if ([1, 3, 5, 7].some(i => g.buttons[i]?.pressed)) { if (!g._b) inp.boost = true; g._b = 1; } else g._b = 0; } }
  if (state.mode === 'solo') { st = clamp(st + (held('d', 'arrowright') ? 1 : 0) - (held('a', 'arrowleft') ? 1 : 0), -1, 1); const brake = held('s', 'arrowdown') || Math.min(a, b) < -.25; return [brake ? -.4 : 1, st]; }
  if (held('w')) a = 1; if (held('s')) a = -.5; if (held('arrowup')) b = 1; if (held('arrowdown')) b = -.5;
  return [clamp((a + b) / 2 + (a > .1 || b > .1 ? .25 : 0), -.5, 1), clamp((a - b) * .55, -1, 1)]; }
function setMode(m) { state.mode = m; document.body.dataset.mode = m; $('mode').textContent = m === 'coop' ? 'CO-OP · one engine each  ⇄' : 'SOLO · it drives, you steer  ⇄'; for (const [id, t] of [['lev0', m === 'coop' ? 'PLAYER 1 · LEFT ENGINE' : 'STEER ← →'], ['lev1', m === 'coop' ? 'PLAYER 2 · RIGHT ENGINE' : 'STEER ← →']]) $(id).lastElementChild.textContent = t; }
$('mode').onclick = () => setMode(state.mode === 'coop' ? 'solo' : 'coop');

// ---------------- sound: engines left and right, and a march that gets louder with the laps
const audio = (() => { let ctx, master, eng = [], on = false, step = 0, next = 0; const root = [38, 34, 41, 36], N = n => 440 * Math.pow(2, (n - 69) / 12);
  const env = (node, t, a, d, g) => { node.gain.setValueAtTime(0, t); node.gain.linearRampToValueAtTime(g, t + a); node.gain.exponentialRampToValueAtTime(.0008, t + a + d); };
  const tone = (type, f, t, d, g, dest = master, slide = 0) => { const o = ctx.createOscillator(), v = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d); env(v, t, .005, d, g); o.connect(v).connect(dest); o.start(t); o.stop(t + d + .05); };
  let nb; const noise = (t, d, g, hp = 6000) => { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), v = ctx.createGain(); s.buffer = nb; f.type = 'highpass'; f.frequency.value = hp; env(v, t, .002, d, g); s.connect(f).connect(v).connect(master); s.start(t, Math.random()); s.stop(t + d + .05); };
  function start() { if (ctx) { ctx.resume(); return; } ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .55; const comp = ctx.createDynamicsCompressor(); master.connect(comp).connect(ctx.destination);
    nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    eng = [1, -1].map(pan => { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner(); o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 300; g.gain.value = 0; p.pan.value = pan * .8; o.connect(f); o2.connect(f); f.connect(g).connect(p).connect(master); o.start(); o2.start(); return { o, o2, f, g }; }); on = true; next = ctx.currentTime + .1; }
  function music(intensity) { if (!on) return; const spb = 60 / 138 / 4; while (next < ctx.currentTime + .12) { const s = step % 16, bar = Math.floor(step / 16) % 4, r = root[bar], t = next;
      if (s % 4 === 0) tone('sine', 150, t, .22, .9, master, 40); if (s === 4 || s === 12) noise(t, .16, .4, 1800); if (s % 2 === 1 || intensity > 1) noise(t, .04, .12 + intensity * .04);
      tone('sawtooth', N(r + (s % 8 === 6 ? 12 : 0)), t, spb * 1.6, .22); if (s === 0) for (const iv of [0, 7, 15]) tone('sawtooth', N(r + 12 + iv), t, spb * 7, .1);                     // bass and a brass stab
      if (intensity > 0) { const arp = [0, 7, 12, 15, 19, 15, 12, 7][s % 8]; tone('square', N(r + 24 + arp), t, spb * .9, .05 + intensity * .02); }
      if (intensity > 1 && s % 4 === 2) tone('triangle', N(r + 36 + [0, 3, 7, 10][bar]), t, spb * 3, .09);
      next += spb; step++; } }
  return { start, music, engine(k, thr, speed, boost) { if (!on) return; const e = eng[k], t = ctx.currentTime, f = 48 + speed * 2.1 + Math.max(0, thr) * 46 + boost * 40; e.o.frequency.setTargetAtTime(f, t, .06); e.o2.frequency.setTargetAtTime(f * 1.505, t, .06); e.f.frequency.setTargetAtTime(260 + speed * 22 + boost * 900, t, .08); e.g.gain.setTargetAtTime(.05 + Math.abs(thr) * .11 + boost * .06, t, .05); },
    fx(n) { if (!on) return; const t = ctx.currentTime; if (n === 'throw') tone('square', 700, t, .14, .2, master, 180); else if (n === 'hit') { noise(t, .25, .7, 500); tone('triangle', 320, t, .3, .5, master, 60); } else if (n === 'pick') { tone('square', 880, t, .08, .2); tone('square', 1320, t + .08, .12, .2); } else if (n === 'boost') { noise(t, .6, .35, 900); tone('sawtooth', 110, t, .6, .3, master, 660); } else if (n === 'beep') tone('square', 440, t, .15, .35); else if (n === 'go') tone('square', 880, t, .5, .4); else if (n === 'lap') [0, 4, 7, 12].forEach((iv, k) => tone('sawtooth', N(62 + iv), t + k * .09, .3, .2)); else if (n === 'bump') tone('sine', 120, t, .18, .5, master, 50); } }; })();

// ---------------- the race
let me = null; const flashEl = $('flash'); let flashT = 0; function flash(s) { flashEl.textContent = s; flashEl.classList.add('on'); flashT = 1.2; }
function pick(k) { state.pick = (k + CANS.length) % CANS.length; const c = CANS[state.pick]; for (const b of $('cans').children) b.classList.toggle('on', +b.dataset.k === state.pick); $('cName').textContent = c.name; $('cStyle').textContent = c.style; $('cTraits').innerHTML = c.traits.map(t => `<li>${t}</li>`).join(''); }
CANS.forEach((c, k) => { const b = document.createElement('button'); b.dataset.k = k; b.textContent = c.name; b.style.background = c.a; b.style.color = c.b; b.onclick = () => pick(k); $('cans').append(b); }); pick(0); setMode('solo');
function begin() { if (state.phase !== 'select') return; audio.start(); me = makePlayer(CANS[state.pick]); racers.push(me); let n = 1; for (let k = 0; k < 5; k++) racers.push(makeAI(CANS[(state.pick + 1 + k) % 4], n++)); $('select').hidden = true; document.body.classList.add('racing'); state.phase = 'count'; state.count = 3.6; }
$('go').onclick = begin; $('again').onclick = () => location.reload();
// A craft that has stopped against a wall is set back on the line, facing the right way: nobody should have to three-point-turn a pod.
function rescue(r) { const i = r.idx, yaw = Math.atan2(TAN[i].x, TAN[i].z), f = fwdOf(yaw, tmpF), rx = f.z, rz = -f.x, q = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, zero = { x: 0, y: 0, z: 0 };
  const put = (b, x, z) => { b.setTranslation({ x, y: HOVER, z }, true); b.setRotation(q, true); b.setLinvel({ x: f.x * 8, y: 0, z: f.z * 8 }, true); b.setAngvel(zero, true); };
  if (r.player) { const ox = P[i].x - NOR[i].x * 5, oz = P[i].z - NOR[i].z * 5; put(r.e[0], ox - rx * 1.4, oz - rz * 1.4); put(r.e[1], ox + rx * 1.4, oz + rz * 1.4); put(r.pod, ox - f.x * 5, oz - f.z * 5); flash('BACK ON TRACK'); } else put(r.b, P[i].x + rx * r.lane, P[i].z + rz * r.lane); r.stuck = 0; }
function progress(r) { if (state.phase === 'race' && !r.done) { r.stuck = r.speed < 2.5 ? (r.stuck || 0) + 1 / 60 : 0; if (r.stuck > (r.player ? 1.6 : 2.2)) rescue(r); } let best = r.idx, bd = 1e9; for (let d = -6; d <= 14; d++) { const i = (r.idx + d + NS) % NS, q = P[i], dd = (q.x - r.mid.x) ** 2 + (q.z - r.mid.z) ** 2; if (dd < bd) { bd = dd; best = i; } } if (best < 40 && r.idx > NS - 40) { r.lap++; if (r.player && r.lap > 0 && r.lap < state.laps) { flash(r.lap === state.laps - 1 ? 'FINAL LAP' : `LAP ${r.lap + 1}`); audio.fx('lap'); } } else if (best > NS - 40 && r.idx < 40) r.lap--; r.idx = best; r.prog = r.lap * NS + best; if (r.lap >= state.laps && !r.done) { r.done = ++state.finish; if (r.player) finish(); } }
function finish() { state.phase = 'done'; const th = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH'][me.done - 1]; $('result').hidden = false; $('place').textContent = th; $('time').textContent = `${state.t.toFixed(1)} s · ${me.c.name}`; $('table').innerHTML = racers.slice().sort((a, b) => (a.done || 99) - (b.done || 99) || b.prog - a.prog).map((r, k) => `<li class="${r.player ? 'me' : ''}">${k + 1}. ${r.name}</li>`).join(''); audio.fx('lap'); }

function stepPlayer(r, dt) {
  const [th, stIn] = state.phase === 'race' && r.stun <= 0 ? readInput() : [0, 0], st = -stIn;   // yaw grows to the left of a chase camera, so a push to the right is a negative turn r.thr[0] = clamp(th + st * .5, -.5, 1); r.thr[1] = clamp(th - st * .5, -.5, 1);   // what each flame shows
  if (inp.fire) fire(r); if (inp.boost && r.meter >= 1 && state.phase === 'race') { r.boostT = 1.8; r.meter = 0; audio.fx('boost'); flash('BOOST'); shake = .5; } inp.fire = inp.boost = false;
  r.meter = Math.min(1, r.meter + dt / (r.c.id === 'hot' ? 9 : 6)); const bo = r.boostT > 0 ? 1 : 0;
  const p0 = r.e[0].translation(), p1 = r.e[1].translation(), dx = p1.x - p0.x, dz = p1.z - p0.z, d = Math.hypot(dx, dz) || 1, heading = Math.atan2(-dz, dx), f = fwdOf(heading, tmpF), fx = f.x, fz = f.z;   // the pair faces square to the line between its engines
  const va = r.e[0].linvel(), vb = r.e[1].linvel(), wPair = ((va.x - vb.x) * fx + (va.z - vb.z) * fz) / d;
  // steering is a turn rate, not a spin: bounded, slower at speed, and when the stick is let go the craft eases back onto the line of the track
  const look = (r.idx + 7 + Math.floor(r.speed * .12)) % NS; let da = Math.atan2(P[look].x - r.mid.x, P[look].z - r.mid.z) - heading; da = Math.atan2(Math.sin(da), Math.cos(da));
  const assist = (state.mode === 'solo' ? 1.5 : .7) * (1 - Math.abs(st) * .85), maxTurn = 1.55 * clamp(1.25 - r.speed / 110, .7, 1.1), wWant = clamp(st * maxTurn + clamp(da, -1, 1) * assist * (th > 0 ? 1 : .3), -maxTurn, maxTurn) * (r.speed < 3 && th <= 0 ? 0 : 1);
  // hold a hard turn at speed and it charges; straighten up and it lets go
  if (Math.abs(st) > .7 && r.speed > 16) r.drift = Math.min(1, (r.drift || 0) + dt * .7); else { if ((r.drift || 0) > .4 && Math.abs(st) < .35) { r.boostT = Math.max(r.boostT, r.drift * 1.3); flash('DRIFT BOOST'); audio.fx('boost'); shake = .3; } if (Math.abs(st) < .35) r.drift = 0; }
  r.tow = 0; for (const o of racers) if (o !== r) { const ox = o.mid.x - r.mid.x, oz = o.mid.z - r.mid.z, od = Math.hypot(ox, oz); if (od < 16 && od > 2 && (ox * fx + oz * fz) / od > .96) r.tow = 1; } if (r.tow && !r.towed) { flash('SLIPSTREAM'); } r.towed = r.tow;
  for (let k = 0; k < 2; k++) { const e = r.e[k], m = e.mass(), yaw = yawOf(e), s = k ? -1 : 1, w = e.angvel(); e.resetForces(true); e.resetTorques(true);
    hoverAndGrip(e, m, r.c.grip * 2.6, f); const ease = state.mode === 'solo' && th > 0 ? 1 - Math.min(.65, Math.max(0, Math.abs(da) - .12) * 1.5) : 1, T = th * ease * F * (1.12 + (r.tow ? .2 : 0)) * r.c.thrust * m * (1 + bo * .9 * r.c.boost) + s * (wWant - wPair) * m * 16 / r.c.mass; e.addForce({ x: fx * T, y: 0, z: fz * T }, true);
    const stretch = (d - 2.8) * 90, rel = ((vb.x - va.x) * dx + (vb.z - va.z) * dz) / d * 12; e.addForce({ x: s * dx / d * (stretch + rel) * m, y: 0, z: s * dz / d * (stretch + rel) * m }, true);   // the energy binder
    let ea = heading - yaw; ea = Math.atan2(Math.sin(ea), Math.cos(ea)); e.addTorque({ x: 0, y: (ea * 60 - w.y * 9) * m, z: 0 }, true); }
  // the pod on its two cables
  const pod = r.pod, pm = pod.mass(), pp = pod.translation(); pod.resetForces(true); pod.resetTorques(true); const py = yawOf(pod); hoverAndGrip(pod, pm, .9, fwdOf(py, tmpF));
  for (let k = 0; k < 2; k++) { const e = r.e[k], ep = e.translation(), cx = ep.x - pp.x, cz = ep.z - pp.z, L = Math.hypot(cx, cz) || 1, over = L - 5.2; if (over > 0) { const fN = over * 70 + 4; pod.addForce({ x: cx / L * fN * pm, y: 0, z: cz / L * fN * pm }, true); e.addForce({ x: -cx / L * fN * pm * .45, y: 0, z: -cz / L * fN * pm * .45 }, true); } }
  let pa = Math.atan2((p0.x + p1.x) / 2 - pp.x, (p0.z + p1.z) / 2 - pp.z) - py; pa = Math.atan2(Math.sin(pa), Math.cos(pa)); pod.addTorque({ x: 0, y: (pa * 30 - pod.angvel().y * 5) * pm, z: 0 }, true);
  r.mid.set((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2); r.yaw = heading; const sp = Math.hypot((va.x + vb.x) / 2, (va.z + vb.z) / 2); if (r.speed - sp > 7) { shake = Math.min(1, (r.speed - sp) / 20); audio.fx('bump'); navigator.vibrate?.(40); } r.speed = sp; r.slip = Math.abs(((va.x + vb.x) * fz - (va.z + vb.z) * fx) / 2);
}
function stepAI(r, dt) {
  const b = r.b, m = b.mass(), p = b.translation(), yaw = yawOf(b), f = fwdOf(yaw, tmpF), v = b.linvel(); r.mid.set(p.x, p.y, p.z); r.yaw = yaw; r.speed = Math.hypot(v.x, v.z); b.resetForces(true); b.resetTorques(true); hoverAndGrip(b, m, r.c.grip * 1.3, f);
  const look = (r.idx + 9 + Math.floor(r.speed * .22)) % NS, tx = P[look].x + NOR[look].x * r.lane, tz = P[look].z + NOR[look].z * r.lane; let da = Math.atan2(tx - p.x, tz - p.z) - yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
  b.addTorque({ x: 0, y: (da * 46 - b.angvel().y * 8) * m, z: 0 }, true); const go = state.phase === 'race' && r.stun <= 0 && !r.done ? r.skill * (1 - Math.min(.55, Math.abs(da) * .9)) : 0, T = go * F * r.c.thrust * m * (1 + (r.boostT > 0 ? .8 : 0)) * (me && r.prog < me.prog - 60 ? 1.14 : 1);
  b.addForce({ x: f.x * T, y: 0, z: f.z * T }, true);
  r.cool -= dt; if (r.cool <= 0 && r.ammo > 0 && state.phase === 'race') { const t = racers.find(o => o !== r && o.prog > r.prog && o.prog - r.prog < 26 && Math.abs(Math.atan2(o.mid.x - p.x, o.mid.z - p.z) - yaw) < .2); if (t) { fire(r); r.cool = 5 + Math.random() * 4; } }
}
let shake = 0;
const mm = $('map'), mq = mm.getContext('2d'), MB = (() => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const p of P) { a = Math.min(a, p.x); b = Math.max(b, p.x); c = Math.min(c, p.z); d = Math.max(d, p.z); } const sc = 100 / Math.max(b - a, d - c); return p => [120 - (10 + (p.x - a) * sc), 10 + (p.z - c) * sc]; })();
function drawMap() { mq.clearRect(0, 0, 120, 120); mq.strokeStyle = '#ffffffcc'; mq.lineWidth = 4; mq.beginPath(); for (let i = 0; i <= NS; i += 6) { const [x, y] = MB(P[i % NS]); i ? mq.lineTo(x, y) : mq.moveTo(x, y); } mq.closePath(); mq.stroke();
  for (const r of racers) { const [x, y] = MB(r.mid); mq.fillStyle = r.player ? '#ffd92e' : r.c.a; mq.strokeStyle = '#fff'; mq.lineWidth = 1.5; mq.beginPath(); mq.arc(x, y, r.player ? 6 : 4, 0, 7); mq.fill(); mq.stroke(); } }
let mapN = 0;
const DN = mobile ? 90 : 220, dustP = new Float32Array(DN * 3).fill(-99), dustV = new Float32Array(DN * 4), dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(dustP, 3));
const soft = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const dust = new THREE.Points(dustG, new THREE.PointsMaterial({ color: 0xe8cfa6, map: soft, size: .9, transparent: true, opacity: .4, depthWrite: false })); dust.frustumCulled = false; scene.add(dust); let dustI = 0;
function puff(x, z, vx, vz) { const k = dustI++ % DN; dustP[k * 3] = x; dustP[k * 3 + 1] = .3; dustP[k * 3 + 2] = z; dustV[k * 4] = vx; dustV[k * 4 + 1] = 1.5 + Math.random() * 2; dustV[k * 4 + 2] = vz; dustV[k * 4 + 3] = 1; }
const cam = { yaw: 0, p: new THREE.Vector3(0, 30, -40) }; let acc = 0, last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (state.phase === 'count') { const pc = Math.ceil(state.count); state.count -= dt; const c = Math.ceil(state.count); if (c !== pc && c > 0) { flash(String(c)); audio.fx('beep'); } if (state.count <= 0) { state.phase = 'race'; flash('GO'); audio.fx('go'); } }
  if (state.phase === 'race') state.t += dt;
  acc += dt; let n = 0; while (acc >= 1 / 60 && n++ < 3) { acc -= 1 / 60;
    for (const s of sweepers) { s.a += s.w / 60; s.body.setNextKinematicRotation({ x: 0, y: Math.sin(s.a / 2), z: 0, w: Math.cos(s.a / 2) }); }
    for (const r of racers) { r.stun = Math.max(0, r.stun - 1 / 60); r.boostT = Math.max(0, r.boostT - 1 / 60); r.player ? stepPlayer(r, 1 / 60) : stepAI(r, 1 / 60); }
    world.step(); }
  for (const s of sweepers) s.g.rotation.y = s.a;
  for (const r of racers) { progress(r);
    if (r.player) { r.e.forEach((e, k) => { const p = e.translation(), q = e.rotation(); r.eng[k].position.set(p.x, p.y, p.z); r.eng[k].quaternion.set(q.x, q.y, q.z, q.w); const th = Math.max(0, r.thr[k]) + (r.boostT > 0 ? 1 : 0); r.eng[k].flame.scale.set(1, 1, .2 + th * 1.4); r.eng[k].flame.material.color.setHex(r.boostT > 0 ? 0xff9a2e : 0x66e0ff); audio.engine(k, r.thr[k], r.speed, r.boostT > 0 ? 1 : 0); });
      const pp = r.pod.translation(), pq = r.pod.rotation(); r.pm.position.set(pp.x, pp.y, pp.z); r.pm.quaternion.set(pq.x, pq.y, pq.z, pq.w); const L = r.lines.geometry.attributes.position.array, a = r.eng[0].position, b = r.eng[1].position; L.set([a.x, a.y, a.z, b.x, b.y, b.z, a.x, a.y, a.z, pp.x, pp.y + .3, pp.z, b.x, b.y, b.z, pp.x, pp.y + .3, pp.z]); r.lines.geometry.attributes.position.needsUpdate = true; r.lines.material.color.setHex(Math.random() > .5 ? 0xff7ae0 : 0xffffff); }
    else { const f = fwdOf(r.yaw, tmpF), rx = f.z, rz = -f.x; r.eng.forEach((m, k) => { const s = k ? 1 : -1; m.position.set(r.mid.x + rx * s * 1.3, r.mid.y, r.mid.z + rz * s * 1.3); m.rotation.y = r.yaw; m.flame.scale.z = .4 + r.speed * .03; }); tmpV.set(r.mid.x - f.x * 4.6, HOVER, r.mid.z - f.z * 4.6); r.podP.lerp(tmpV, Math.min(1, dt * 5)); r.pm.position.copy(r.podP); r.pm.rotation.y = r.yaw; }
    if (state.phase === 'race') { for (const pd of pads) if (r.boostT <= 0 && (P[pd.i].x - r.mid.x) ** 2 + (P[pd.i].z - r.mid.z) ** 2 < 30) { r.boostT = 1.5; if (r.player) { audio.fx('boost'); flash('BOOST'); } }
      for (const cr of crates) if (cr.back <= 0 && cr.m.position.distanceToSquared(r.mid) < 9) { cr.back = 6; cr.m.visible = false; r.ammo = Math.min(9, r.ammo + 3); if (r.player) { audio.fx('pick'); flash('+3 SPAM'); } } } }
  for (const r of racers) if (r.speed > 6 && Math.random() < dt * (r.player ? 40 + (r.slip || 0) * 12 : 10)) { const f = fwdOf(r.yaw, tmpF); puff(r.mid.x - f.x * 2 + (Math.random() - .5) * 3, r.mid.z - f.z * 2 + (Math.random() - .5) * 3, -f.x * 3, -f.z * 3); }
  for (let k = 0; k < DN; k++) if (dustV[k * 4 + 3] > 0) { dustV[k * 4 + 3] -= dt * .9; dustP[k * 3] += dustV[k * 4] * dt; dustP[k * 3 + 1] += dustV[k * 4 + 1] * dt; dustP[k * 3 + 2] += dustV[k * 4 + 2] * dt; if (dustV[k * 4 + 3] <= 0) dustP[k * 3 + 1] = -99; } dustG.attributes.position.needsUpdate = true;
  for (const cr of crates) { cr.m.rotation.y += dt * 2; if (cr.back > 0 && (cr.back -= dt) <= 0) cr.m.visible = true; }
  for (const s of shots) if (s.life > 0) { s.life -= dt; const p = s.b.translation(), q = s.b.rotation(); s.m.position.set(p.x, p.y, p.z); s.m.quaternion.set(q.x, q.y, q.z, q.w);
    for (const r of racers) if (r !== s.owner && s.life > 0 && (r.mid.x - p.x) ** 2 + (r.mid.z - p.z) ** 2 < 6.5 && p.y < 3) { smack(r, s.owner.mid); s.life = 0; }
    if (s.life <= 0) { s.m.visible = false; s.b.setTranslation({ x: 0, y: -60, z: 0 }, true); s.b.setLinvel({ x: 0, y: 0, z: 0 }, true); } }
  if (me) { const portrait = innerHeight > innerWidth; let d = me.yaw - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); cam.yaw += d * Math.min(1, dt * 3.2); const f = fwdOf(cam.yaw, tmpF), back = portrait ? 15 : 11.5, up = portrait ? 7.5 : 4.6;
    tmpV.set(me.mid.x - f.x * back, up, me.mid.z - f.z * back); cam.p.lerp(tmpV, Math.min(1, dt * 7)); shake = Math.max(0, shake - dt * 2.2); camera.position.copy(cam.p); camera.position.x += (Math.random() - .5) * shake * .9; camera.position.y += (Math.random() - .5) * shake * .7 + (me.boostT > 0 ? (Math.random() - .5) * .12 : 0); camera.lookAt(me.mid.x + f.x * 9, 1.2, me.mid.z + f.z * 9);
    const fov = (portrait ? 84 : 66) + Math.min(16, me.speed * .22) + (me.boostT > 0 ? 8 : 0); if (Math.abs(camera.fov - fov) > .2) { camera.fov = lerp(camera.fov, fov, .1); camera.updateProjectionMatrix(); }
    sun.target.position.copy(me.mid); sun.position.set(me.mid.x + 60, 90, me.mid.z + 40);
    const order = racers.slice().sort((a, b) => (a.done || 99) - (b.done || 99) || b.prog - a.prog), pos = order.indexOf(me) + 1; $('pos').textContent = pos; $('lap').textContent = `LAP ${clamp(me.lap + 1, 1, state.laps)}/${state.laps}`; $('spd').textContent = Math.round(me.speed * 3.6); $('ammo').textContent = me.ammo; $('meter').style.width = (me.meter * 100) + '%'; $('fire').classList.toggle('off', me.ammo <= 0); $('boost').classList.toggle('off', me.meter < 1);
    if (mapN++ % 4 === 0) drawMap();
    audio.music(state.phase === 'race' ? (me.lap >= state.laps - 1 ? 2 : me.lap >= 1 ? 1 : 0) : 0); }
  else { const t = now / 9000; camera.position.set(60 + Math.cos(t) * 260, 90, 110 + Math.sin(t) * 260); camera.lookAt(60, 0, 110); }
  if (flashT > 0 && (flashT -= dt) <= 0) flashEl.classList.remove('on');
  renderer.render(scene, camera); }
requestAnimationFrame(frame);
window.canRacers = { P, NS, state, racers, get me() { return me; }, begin, pick, setMode, inp, fire: () => me && fire(me), observe: () => me && ({ phase: state.phase, t: +state.t.toFixed(1), lap: me.lap, idx: me.idx, speed: +me.speed.toFixed(1), ammo: me.ammo, y: +me.mid.y.toFixed(2), pos: racers.slice().sort((a, b) => b.prog - a.prog).indexOf(me) + 1, ai: racers.filter(r => !r.player).map(r => r.lap * NS + r.idx) }) };
