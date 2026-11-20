// Highland Exposure motion lab: one walkable, drivable patch of real Entoto ground.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import RAPIER from './vendor/rapier.es.js';
import { loadGround } from './ground.js';
import { makeRetarget, clipGroundSpeed, twoBoneIK } from './retarget.js';

const $ = id => document.getElementById(id);
const status = t => { $('boot').textContent = t; };
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const load = u => new Promise((a, b) => loader.load(u, a, undefined, b));
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/* ---------------- renderer, scene ---------------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const SKY = new THREE.Color('#b9c6cf'), HAZE = new THREE.Color('#c3c8c4');
scene.background = HAZE; scene.fog = new THREE.Fog(HAZE, 220, 3200);
const camera = new THREE.PerspectiveCamera(52, 1, .1, 9000);
const hemi = new THREE.HemisphereLight('#dfe8ee', '#6e5a3f', .9); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d8', 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 220 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(-.55, .62, -.56).normalize();
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

/* ---------------- world ---------------- */
let G, world, chassis, vehicle, bajaj;
const people = {}, input = { f: 0, s: 0, run: false, brake: false }, keys = new Set();
const state = { mode: 'foot', t: 0, talk: null, lead: false, stats: { foot: [] } };

function buildGround() {
  const s = 2, nx = Math.floor((G.nx - 1) / s) + 1, nz = Math.floor((G.nz - 1) / s) + 1;
  const geo = new THREE.PlaneGeometry((nx - 1) * s, (nz - 1) * s, nx - 1, nz - 1); geo.rotateX(-Math.PI / 2);
  geo.translate(G.lx0 + (nx - 1) * s / 2, 0, G.lz0 + (nz - 1) * s / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const grass = new THREE.Color('#6f7d45'), dry = new THREE.Color('#9a8c5a'), rock = new THREE.Color('#7b746a'), dirt = new THREE.Color('#a07650'), ruts = new THREE.Color('#8a6444');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = G.height(x, z); p.setY(i, y);
    const gx = G.height(x + 1, z) - G.height(x - 1, z), gz = G.height(x, z + 1) - G.height(x, z - 1), slope = Math.hypot(gx, gz) / 2;
    const n = Math.sin(x * .13 + Math.sin(z * .07) * 2) * .5 + Math.sin(z * .19 - x * .05) * .5;
    c.copy(grass).lerp(dry, clamp(.45 + n * .35, 0, 1)).lerp(rock, clamp((slope - .35) * 2.2, 0, 1));
    const r = G.roadInfo(x, z), hw = G.roadWidth / 2;
    if (r.d < hw + 2.2) { const k = 1 - clamp((r.d - hw + .6) / 2.8, 0, 1), rut = Math.abs(Math.abs(r.d) - .8) < .25 ? 1 : 0; c.lerp(dirt, k).lerp(ruts, k * rut * .5); }
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, metalness: 0 }));
  m.receiveShadow = true; scene.add(m);
}
async function buildFar() {        // the game's own 25 m terrain for 3 km around, so the horizon is real hills
  const m = await (await fetch('assets/entoto_far.json')).json(), q = new Uint16Array(await (await fetch('assets/entoto_far.bin')).arrayBuffer());
  const [OX, OY, OZ] = G.origin, n = m.n, geo = new THREE.PlaneGeometry((n - 1) * m.step, (n - 1) * m.step, n - 1, n - 1); geo.rotateX(-Math.PI / 2);
  geo.translate(m.x0 - OX + (n - 1) * m.step / 2, 0, m.z0 - OZ + (n - 1) * m.step / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), a = new THREE.Color('#6d7a46'), b = new THREE.Color('#8f8458'), r = new THREE.Color('#7a7268');
  const [bx0, bx1, bz0, bz1] = G.bounds;
  for (let i = 0; i < p.count; i++) {
    const v = q[i], y = v === 65535 ? -300 : m.base + v / 10 - OY, x = p.getX(i), z = p.getZ(i);
    const inside = x > bx0 + 4 && x < bx1 - 4 && z > bz0 + 4 && z < bz1 - 4;
    p.setY(i, inside ? y - 4 : y);
    const nn = Math.sin(x * .011) * Math.sin(z * .013); c.copy(a).lerp(b, .5 + nn * .4); if (y < -150) c.lerp(r, .5); col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); mesh.receiveShadow = false; scene.add(mesh);
  // sky dome, horizon colour shared with the fog
  const sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#6f93b5') }, hor: { value: HAZE }, sunDir: { value: SUN_DIR } },
    vertexShader: 'varying vec3 d;void main(){d=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top,hor,sunDir;varying vec3 d;void main(){float h=clamp((d.y+.02)*1.6,0.,1.);vec3 c=mix(hor,top,pow(h,.55));float s=max(dot(d,sunDir),0.);c+=vec3(1.,.9,.7)*pow(s,400.)*2.+vec3(1.,.85,.6)*pow(s,8.)*.18;gl_FragColor=vec4(c,1.);}' }));
  sky.renderOrder = -1; scene.add(sky); state.sky = sky;
}
function buildItems(stageGltf) {
  const mats = { stone: new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: .95 }), tin: new THREE.MeshStandardMaterial({ color: '#9aa3a7', roughness: .55, metalness: .4 }),
    wood: new THREE.MeshStandardMaterial({ color: '#7a5b3e', roughness: .9 }), mud: new THREE.MeshStandardMaterial({ color: '#b2946c', roughness: 1 }), red: new THREE.MeshStandardMaterial({ color: '#b8402e', roughness: .7 }), white: new THREE.MeshStandardMaterial({ color: '#e8e4da', roughness: .7 }) };
  const solids = [];
  mats.leaf = new THREE.MeshStandardMaterial({ color: '#3d5232', roughness: .95 }); mats.bark = new THREE.MeshStandardMaterial({ color: '#5b4a3a', roughness: 1 });
  for (const it of G.items) {
    const gy = G.height(it.x, it.z), y = Math.abs(it.y - gy) < 30 ? it.y : gy, lifted = y - gy > .8;
    if (it.kind === 'dawn_stage') { const s = stageGltf.scene; s.position.set(it.x, it.y, it.z); s.rotation.y = it.yaw; s.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); scene.add(s); state.stage = { x: it.x, z: it.z, y: it.y, yaw: it.yaw }; continue; }
    if (it.kind.startsWith('dawn_')) continue;
    let o;
    if (it.kind === 'house') {
      o = new THREE.Group(); const w = 5.2 * (it.sx || 1), d = 4.2 * (it.sz || 1), h = 2.6 * (it.sy || 1);
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.mud); walls.position.y = h / 2; o.add(walls);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + .5, .12, d + .6), mats.tin); roof.position.y = h + .1; roof.rotation.z = .07; o.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.9, .06), mats.wood); door.position.set(0, .95, d / 2 + .02); o.add(door);
      solids.push({ x: it.x, z: it.z, hx: w / 2, hz: d / 2, yaw: it.yaw || 0, h });
    } else if (it.kind === 'mast') {
      o = new THREE.Group(); const H = 24 * (it.sy || 1);
      for (let k = 0; k < 4; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.05, .09, H, 5), k % 2 ? mats.red : mats.white); const a = k * Math.PI / 2 + Math.PI / 4; leg.position.set(Math.cos(a) * .9, H / 2, Math.sin(a) * .9); leg.rotation.set(Math.sin(a) * .028, 0, -Math.cos(a) * .028); o.add(leg); }
      for (let k = 1; k < 10; k++) { const r = .9 * (1 - k / 11) * (it.sy || 1); const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.4, .03, 3, 4), k % 2 ? mats.red : mats.white); ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 4; ring.position.y = k * H / 10; o.add(ring); }
      solids.push({ x: it.x, z: it.z, hx: 1.1, hz: 1.1, yaw: 0, h: 30 });
    } else if (it.kind === 'box') {
      const sx = it.sx || 1, sy = it.sy || 1, sz = it.sz || 1; o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mats.wood); o.position.y = sy / 2;
      if (Math.max(sx, sz) > .5 && sy > .4) solids.push({ x: it.x, z: it.z, hx: sx / 2, hz: sz / 2, yaw: it.yaw || 0, h: sy });
    } else if (it.kind === 'cylinder') {
      const r = (it.sx || .5) / 2, h = it.sy || 1, trunk = h > 4; o = new THREE.Mesh(new THREE.CylinderGeometry(r * (trunk ? .7 : 1), r, h, trunk ? 7 : 10), trunk ? mats.bark : mats.wood); o.position.y = h / 2;
      if (r > .06 && h > .4) solids.push({ x: it.x, z: it.z, hx: Math.max(r, .12), hz: Math.max(r, .12), yaw: 0, h });
    } else if (it.kind === 'rock') {
      const sx = it.sx || 1, sy = it.sy || .6, sz = it.sz || 1; o = new THREE.Mesh(lifted ? new THREE.ConeGeometry(.5, 1, 9) : new THREE.DodecahedronGeometry(.5, 0), lifted ? mats.leaf : mats.stone); o.scale.set(sx, sy, sz); o.position.y = lifted ? sy / 2 : sy * .3;
      if (!lifted && Math.max(sx, sz) > .7) solids.push({ x: it.x, z: it.z, hx: sx * .4, hz: sz * .4, yaw: 0, h: sy });
    } else continue;
    const g = o.isGroup ? o : new THREE.Group().add(o); g.position.set(it.x, it.kind === 'house' || it.kind === 'mast' ? gy : y, it.z); g.rotation.y = it.yaw || 0;
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(g);
  }
  return solids;
}
/* ---------------- physics ---------------- */
function buildPhysics(solids) {
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  // heightfield at 2 m; Rapier wants (nrows+1)*(ncols+1) heights, column-major, rows along x
  const s = 2, nr = Math.floor((G.nx - 1) / s), nc = Math.floor((G.nz - 1) / s), hts = new Float32Array((nr + 1) * (nc + 1));
  for (let i = 0; i <= nr; i++) for (let j = 0; j <= nc; j++) hts[i * (nc + 1) + j] = G.height(G.lx0 + i * s, G.lz0 + j * s);
  const w = nr * s, d = nc * s;
  const alt = new Float32Array((nr + 1) * (nc + 1));
  for (let i = 0; i <= nr; i++) for (let j = 0; j <= nc; j++) alt[j * (nr + 1) + i] = hts[i * (nc + 1) + j];
  let best = null; const cands = { A: [hts, nr, nc], B: [alt, nr, nc], C: [hts, nc, nr], D: [alt, nc, nr] };
  for (const [name, [arr, R, Cc]] of Object.entries(cands)) {
    let col; try { col = world.createCollider(RAPIER.ColliderDesc.heightfield(R, Cc, arr, { x: w, y: 1, z: d }).setTranslation(G.lx0 + w / 2, 0, G.lz0 + d / 2)); } catch (e) { continue; }
    world.step(); const err = hfCheck().reduce((m, v) => Math.max(m, v === null ? 99 : Math.abs(v)), 0);
    world.removeCollider(col, false); world.step();
    if (!best || err < best.err) best = { err, name };
  }
  { const [arr, R, Cc] = cands[best.name]; world.createCollider(RAPIER.ColliderDesc.heightfield(R, Cc, arr, { x: w, y: 1, z: d }).setTranslation(G.lx0 + w / 2, 0, G.lz0 + d / 2).setFriction(.9)); world.step(); }
  state.hfLayout = best && { layout: best.name, maxErr_m: +best.err.toFixed(3) };
  for (const b of solids) {
    const cd = RAPIER.ColliderDesc.cuboid(b.hx, b.h / 2, b.hz).setTranslation(b.x, G.height(b.x, b.z) + b.h / 2, b.z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.yaw));
    world.createCollider(cd);
  }
  state.solids = solids;
}
function hfCheck() {           // the physics ground must agree with the drawn ground
  const pts = [[3, -2], [60, 40], [200, 160], [-30, -30], [400, 500]], out = [];
  for (const [x, z] of pts) {
    const ray = new RAPIER.Ray({ x, y: 400, z }, { x: 0, y: -1, z: 0 }), hit = world.castRay(ray, 1000, true);
    out.push(hit ? +(400 - hit.timeOfImpact - G.height(x, z)).toFixed(3) : null);
  }
  return out;
}
/* ---------------- the bajaj: Rapier ray-cast vehicle, 3 wheels ---------------- */
// Forward is local +x. Mass and power are those of a small three-wheeler: about 400 kg loaded, 4 kW at the wheel.
const BJ = { cda: .95, crr: .018, vmax: 15.5, engineBrake: 2.2, mass: 400, wheelR: .23, rest: .25, travel: .2, stiff: 55, comp: 4.4, relax: 5.2, slip: .9, side: 1.0, power: 4000, fmax: 800, steerMax: .55, brake: 9 };
function buildBajaj(x, z, yaw) {
  const y = G.height(x, z) + 1.0;
  const rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw - Math.PI / 2))
    .setLinearDamping(.05).setAngularDamping(.6).setCanSleep(false));
  world.createCollider(RAPIER.ColliderDesc.cuboid(1.25, .3, .62).setTranslation(-.1, .05, 0).setMass(BJ.mass * .45), rb);         // tub and canopy frame
  world.createCollider(RAPIER.ColliderDesc.cuboid(.45, .12, .5).setTranslation(-.75, -.16, 0).setMass(BJ.mass * .4), rb);          // engine under the rear bench, as on a real three-wheeler
  world.createCollider(RAPIER.ColliderDesc.cuboid(.35, .15, .3).setTranslation(.65, .0, 0).setMass(BJ.mass * .15), rb);            // driver
  const vc = world.createVehicleController(rb);
  const pts = [[1.05, -.15, 0, true], [-.95, -.15, .58, false], [-.95, -.15, -.58, false]];
  for (const [px, py, pz] of pts) vc.addWheel({ x: px, y: py, z: pz }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, BJ.rest, BJ.wheelR);
  for (let i = 0; i < 3; i++) {
    vc.setWheelSuspensionStiffness(i, BJ.stiff); vc.setWheelSuspensionCompression(i, BJ.comp); vc.setWheelSuspensionRelaxation(i, BJ.relax);
    vc.setWheelMaxSuspensionTravel(i, BJ.travel); vc.setWheelFrictionSlip(i, BJ.slip); vc.setWheelSideFrictionStiffness(i, BJ.side); vc.setWheelMaxSuspensionForce(i, 9000);
  }
  chassis = rb; vehicle = vc;
  // body
  const g = new THREE.Group(), blue = new THREE.MeshStandardMaterial({ color: '#2e7fa8', roughness: .45, metalness: .25 }), dark = new THREE.MeshStandardMaterial({ color: '#202426', roughness: .8 }),
    canvasM = new THREE.MeshStandardMaterial({ color: '#d9d2bf', roughness: .95, side: THREE.DoubleSide }), chrome = new THREE.MeshStandardMaterial({ color: '#c9ccce', roughness: .25, metalness: .9 }), glass = new THREE.MeshStandardMaterial({ color: '#9fb6c0', roughness: .1, metalness: .1, transparent: true, opacity: .45 });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
  const prof = new THREE.Shape();                                                   // side profile, x forward, y up (metres)
  prof.moveTo(-1.32, -.08); prof.lineTo(.55, -.08); prof.quadraticCurveTo(1.18, -.08, 1.32, .18); prof.quadraticCurveTo(1.36, .42, 1.2, .62);
  prof.lineTo(.88, .66); prof.lineTo(.5, .52); prof.lineTo(-.15, .52); prof.lineTo(-.2, .72); prof.lineTo(-1.32, .72); prof.closePath();
  const tub = new THREE.ExtrudeGeometry(prof, { depth: 1.22, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 2, steps: 1 }); tub.translate(0, 0, -.61);
  add(tub, blue, 0, 0, 0);
  const roofP = new THREE.Shape(); roofP.moveTo(-1.36, 1.3); roofP.lineTo(.62, 1.42); roofP.quadraticCurveTo(1.02, 1.42, 1.16, 1.12); roofP.lineTo(1.12, 1.08); roofP.quadraticCurveTo(.96, 1.34, .62, 1.36); roofP.lineTo(-1.32, 1.24); roofP.quadraticCurveTo(-1.4, 1.0, -1.34, .74); roofP.lineTo(-1.3, .74); roofP.quadraticCurveTo(-1.34, 1.02, -1.36, 1.3);
  const roof = new THREE.ExtrudeGeometry(roofP, { depth: 1.3, bevelEnabled: false }); roof.translate(0, 0, -.65); add(roof, new THREE.MeshStandardMaterial({ color: '#1f2a27', roughness: .85, side: THREE.DoubleSide }), 0, 0, 0);
  add(new THREE.BoxGeometry(.04, .55, 1.08), glass, 1.06, .9, 0, 0, 0, -.42);       // windscreen, raked
  for (const [x, z] of [[1.0, .58], [1.0, -.58], [-1.3, .63], [-1.3, -.63], [-.22, .63], [-.22, -.63]]) add(new THREE.CylinderGeometry(.022, .022, .72, 6), chrome, x, 1.02, z);
  add(new THREE.BoxGeometry(.5, .14, 1.12), dark, -.75, .78, 0); add(new THREE.BoxGeometry(.12, .5, 1.12), dark, -1.05, 1.0, 0);   // rear bench and back
  add(new THREE.BoxGeometry(.34, .1, .38), dark, .38, .62, 0);                                                                     // driver seat
  add(new THREE.CylinderGeometry(.022, .022, .5, 6), chrome, .74, .86, 0, 0, 0, .5); add(new THREE.BoxGeometry(.05, .05, .6), chrome, .86, 1.07, 0);   // bars
  add(new THREE.SphereGeometry(.09, 12, 8), new THREE.MeshStandardMaterial({ color: '#fff4cf', emissive: '#ffd27a', emissiveIntensity: .7 }), 1.33, .36, 0);
  add(new THREE.BoxGeometry(.03, .1, 1.28), new THREE.MeshStandardMaterial({ color: '#e9e4d8', roughness: .6 }), .2, .34, 0);       // white side stripe
  const wheels = pts.map(() => { const w = new THREE.Group(), t = new THREE.Mesh(new THREE.CylinderGeometry(BJ.wheelR, BJ.wheelR, .14, 18), dark); t.rotation.x = Math.PI / 2; t.castShadow = true; const hub = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .15, 8), chrome); hub.rotation.x = Math.PI / 2; w.add(t, hub); scene.add(w); return w; });
  scene.add(g); bajaj = { g, wheels, steer: 0 };
}
function stepVehicle(dt) {
  const v = vehicle.currentVehicleSpeed(), driving = state.mode === 'drive';
  const thr = driving ? input.f : 0, steerIn = driving ? -input.s : 0;
  // engine: constant power above the traction limit, so hills slow it and it pulls hard from rest
  // power falls away near the governed top speed of a small single-cylinder engine
  let F = 0; if (thr > 0) F = Math.min(BJ.fmax, BJ.power / Math.max(Math.abs(v), .5)) * thr * clamp((BJ.vmax - v) / 2.5, 0, 1); else if (thr < 0) F = v > 1 ? 0 : -600 * -thr;
  let braking = driving && (input.brake || (thr < 0 && v > 1)) ? BJ.brake * (input.brake ? 1 : -thr) : (!driving ? 8 : 0);
  if (driving && thr <= 0 && !input.brake) braking = Math.max(braking, BJ.engineBrake * clamp(Math.abs(v) / 4, 0, 1));   // engine braking off the throttle
  // air drag and rolling resistance on the chassis
  const lv = chassis.linvel(), sp = Math.hypot(lv.x, lv.y, lv.z);
  if (sp > .05) { const Fd = .5 * 1.0 * BJ.cda * sp * sp + BJ.crr * BJ.mass * 9.81; chassis.addForce({ x: -lv.x / sp * Fd, y: -lv.y / sp * Fd, z: -lv.z / sp * Fd }, true); }
  bajaj.steer = damp(bajaj.steer, steerIn * BJ.steerMax * clamp(1.25 - Math.abs(v) / 18, .35, 1), 6, dt);
  vehicle.setWheelSteering(0, bajaj.steer);
  vehicle.setWheelEngineForce(1, F / 2); vehicle.setWheelEngineForce(2, F / 2);
  for (let i = 0; i < 3; i++) vehicle.setWheelBrake(i, braking);
  vehicle.updateVehicle(dt);
  chassis.resetForces(true); if (sp > .05) { const Fd = .5 * 1.0 * BJ.cda * sp * sp + BJ.crr * BJ.mass * 9.81; chassis.addForce({ x: -lv.x / sp * Fd, y: -lv.y / sp * Fd, z: -lv.z / sp * Fd }, true); }
  // upside down or on its side for 2 s: set it back on its wheels
  const r = chassis.rotation(), upY = 1 - 2 * (r.x * r.x + r.z * r.z); bajaj.tipped = upY < .3 ? (bajaj.tipped || 0) + dt : 0;
  if (bajaj.tipped > 2) { const t = chassis.translation(), f = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)); chassis.setTranslation({ x: t.x, y: G.height(t.x, t.z) + 1.2, z: t.z }, true); chassis.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-f.z, f.x)), true); chassis.setLinvel({ x: 0, y: 0, z: 0 }, true); chassis.setAngvel({ x: 0, y: 0, z: 0 }, true); bajaj.tipped = 0; state.resets = (state.resets || 0) + 1; }
}
function syncVehicle() {
  const t = chassis.translation(), r = chassis.rotation();
  bajaj.g.position.set(t.x, t.y, t.z); bajaj.g.quaternion.set(r.x, r.y, r.z, r.w);
  const q = bajaj.g.quaternion;
  for (let i = 0; i < 3; i++) {
    const cp = vehicle.wheelChassisConnectionPointCs(i), sl = vehicle.wheelSuspensionLength(i) ?? BJ.rest, rot = vehicle.wheelRotation(i) || 0, st = vehicle.wheelSteering(i) || 0;
    const p = new THREE.Vector3(cp.x, cp.y - sl, cp.z).applyQuaternion(q).add(bajaj.g.position);
    const w = bajaj.wheels[i]; w.position.copy(p); w.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, st, 0))).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -rot)));
  }
}
/* ---------------- people ---------------- */
const CAST = {
  imani: { file: 'Imani', role: 'Field composer', idle: 'idle-listening', talk: 'idle-talking', line: 'Leave the first beat empty. I’ll bring the string in on two. Take this recorder. The metal lid gives us the first short sound.' },
  makeda: { file: 'Makeda', role: 'Wellhead operator', idle: 'pump', talk: 'idle-talking', line: 'Listen at the pin, then at the lip of the bowl. It is the same stroke from two different places.' },
  june: { file: 'June', role: 'Basin listener', idle: 'idle-subtle', talk: 'idle-talking', line: 'I put my finger on the rim after the tap. Listen for the part that disappears.' },
  berhanu: { file: 'Berhanu', role: 'Timekeeper', idle: 'idle-foldarms', talk: 'idle-talking', line: 'I wait until the water stops before ringing. Otherwise you lose the end of it.' },
  hanna: { file: 'Hanna', role: 'Pack handler', idle: 'idle-talkingphone', talk: 'idle-talking', line: 'The near strap sounds first. I use a short pull, then wait for Mistletoe to settle her feet.' }
};
const CLIPS = ['walk', 'walk-female', 'run-female', 'walk-carry', 'jog', 'idle-subtle', 'idle-listening', 'idle-talking', 'idle-talkingphone', 'idle-foldarms', 'greeting', 'head-nod', 'yes', 'driving', 'hammering'];
let skelGltf, clipLib = {}, walkSpeed = 1.3, jogSpeed = 3.2;
async function loadClips() {
  skelGltf = await load('assets/clips/_skeleton.glb');
  await Promise.all(CLIPS.map(async n => { try { const g = await load('assets/clips/' + n + '.glb'); clipLib[n] = g.animations[0]; } catch (e) { /* optional */ } }));
  const sk = SkeletonUtils.clone(skelGltf.scene);
  clipLib.walk = clipLib['walk-female'] || clipLib.walk; clipLib.jog = clipLib['run-female'] || clipLib.jog;              // the most upright walk and run in the library
  delete clipLib['walk-female']; delete clipLib['run-female'];                                   // one action per clip, or the weights fight
  walkSpeed = clipGroundSpeed(sk, clipLib.walk) || 1.3; jogSpeed = clipGroundSpeed(sk, clipLib.jog) || 3.2;
  state.clipSpeeds = { walk: +walkSpeed.toFixed(3), jog: +jogSpeed.toFixed(3), carry: clipLib['walk-carry'] ? +clipGroundSpeed(sk, clipLib['walk-carry']).toFixed(3) : null };
}
async function makePerson(id) {
  const c = CAST[id], g = await load('assets/people/' + c.file + '.glb'), fig = g.scene;
  fig.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const src = SkeletonUtils.clone(skelGltf.scene);
  const rt = makeRetarget(src, fig);
  const mixer = new THREE.AnimationMixer(src), act = {};
  for (const [n, clip] of Object.entries(clipLib)) { const a = mixer.clipAction(clip); a.enabled = true; a.setEffectiveWeight(0); a.play(); act[n] = a; }
  if (act.hammering && id === 'makeda') { act.pump = act.hammering; }
  const root = new THREE.Group(); root.add(fig); scene.add(root);
  const D = rt.D, legs = { L: [D.upperleg01L, D.lowerleg01L, D.footL], R: [D.upperleg01R, D.lowerleg01R, D.footR] };
  const p = { id, c, fig, src, rt, mixer, act, root, legs, x: 0, z: 0, y: 0, yaw: 0, speed: 0, weights: {}, base: c.idle, oneShot: null, jaw: D.jaw, jawRest: D.jaw ? D.jaw.quaternion.clone() : null, head: D.head, says: 0 };
  setWeights(p, { [p.base]: 1 }, 0);
  if (id === 'hanna' && D.wristR) {
    const ph = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(.072, .15, .009), new THREE.MeshStandardMaterial({ color: '#15191b', roughness: .4 })),
      scr = new THREE.Mesh(new THREE.PlaneGeometry(.064, .136), new THREE.MeshBasicMaterial({ color: '#9fe8ff' })); scr.position.z = .0052; ph.add(body, scr);
    ph.position.set(-.02, .07, .04); ph.rotation.set(.2, 0, .3); D.wristR.add(ph); p.phone = ph;
  }
  return p;
}
function setWeights(p, target, dt, k = 6) {
  for (const [n, a] of Object.entries(p.act)) {
    const w = target[n] || 0, cur = p.weights[n] || 0, nw = dt ? damp(cur, w, k, dt) : w; p.weights[n] = nw; a.setEffectiveWeight(nw);
  }
}
const tmpV = new THREE.Vector3(), tmpT = new THREE.Vector3();
function poseOnGround(p, dt) {
  p.root.position.set(p.x, p.y, p.z); p.root.quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.yaw); p.root.updateMatrixWorld(true);
  p.src.position.set(0, 0, 0); p.src.updateMatrixWorld(true);
  p.rt.apply();
  // jaw while speaking
  if (p.jaw && p.jawRest) { const open = p.says > 0 ? Math.max(0, .14 * Math.sin(state.t * 17) * Math.sin(state.t * 5.3 + p.id.length)) : 0; p.jaw.quaternion.copy(p.jawRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), open)); }
  // foot IK: the clip assumes flat ground at the root; correct each ankle by the real height under it
  p.root.updateMatrixWorld(true);
  const off = {}, base = p.y;
  for (const k of ['L', 'R']) { p.legs[k][2].getWorldPosition(tmpV); off[k] = G.height(tmpV.x, tmpV.z) - base; }
  const drop = Math.min(0, off.L, off.R);
  if (drop < -1e-3) { const r = p.rt.D.root; r.position.y += drop / (p.root.scale.y || 1); r.updateMatrixWorld(true); }
  for (const k of ['L', 'R']) {
    const [a, b, c] = p.legs[k]; c.getWorldPosition(tmpV);
    tmpT.copy(tmpV); tmpT.y += off[k] - drop;
    if (Math.abs(off[k] - drop) > .004) twoBoneIK(a, b, c, tmpT, new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw));
  }
}
const SEAT = new THREE.Vector3(.38, -.36, 0), FACE_X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
function seatDriver(p) {                 // sit the player on the driver's saddle, facing forward, hands on the bars
  p.root.position.copy(SEAT).applyQuaternion(bajaj.g.quaternion).add(bajaj.g.position); p.root.quaternion.copy(bajaj.g.quaternion).multiply(FACE_X);
  p.root.updateMatrixWorld(true); p.src.updateMatrixWorld(true); p.rt.apply();
}
function locomote(p, wantSpeed, dt, carry = false) {
  p.speed = damp(p.speed, wantSpeed, 5, dt);
  const W1 = Math.max(1.05, walkSpeed * 1.25), J1 = Math.max(2.6, jogSpeed * 1.05), s = p.speed, wJog = clamp((s - W1) / (J1 - W1), 0, 1), wWalk = clamp(s / .4, 0, 1) * (1 - wJog);
  const wIdle = 1 - clamp(s / .4, 0, 1), walkName = carry && p.act['walk-carry'] ? 'walk-carry' : 'walk';
  setWeights(p, { [p.base]: wIdle, [walkName]: wWalk, jog: wJog }, dt, 10);
  const rate = s > .05 ? s / ((walkName === 'walk-carry' ? state.clipSpeeds.carry || walkSpeed : walkSpeed) * p.rt.ratio) : 1;
  p.act[walkName].timeScale = rate; if (p.act.jog) p.act.jog.timeScale = s / (jogSpeed * p.rt.ratio);
}
/* ---------------- the donkey (Mesh2Motion horse, CC0, scaled and re-coloured) ---------------- */
let donkey;
async function makeDonkey() {
  const g = await load('assets/horse/model.glb'), m = g.scene;
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material) { o.material = o.material.clone(); o.material.map = null; o.material.color = new THREE.Color('#8d867f'); o.material.roughness = .95; if ('clearcoat' in o.material) o.material.clearcoat = 0; } } if (/^ear_\d_[lr]$/.test(o.name)) o.scale.setScalar(o.name.startsWith('ear_1') ? 2.0 : 1.3); });
  const S = .68; m.scale.set(.74, .6, S);               // a donkey: shorter in the leg and stockier than the horse rig it is built on
  const clips = {}; for (const n of ['walk', 'trot', 'idle', 'eating']) clips[n] = (await load('assets/horse/' + n + '.glb')).animations[0];
  const mixer = new THREE.AnimationMixer(m), act = {}; for (const [n, c] of Object.entries(clips)) { const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(n === 'idle' ? 1 : 0); act[n] = a; }
  const speeds = { walk: clipGroundSpeed(m, clips.walk, ['front_leg_foot_l', 'front_leg_foot_r']) , trot: clipGroundSpeed(m, clips.trot, ['front_leg_foot_l', 'front_leg_foot_r']) };
  const root = new THREE.Group(); root.add(m); scene.add(root);
  // panniers and a yellow 20 L can on each side, hung from the spine
  const bones = {}; m.traverse(o => { if (o.isBone) bones[o.name] = o; });
  const pack = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: '#6b4f35', roughness: .9 }), yellow = new THREE.MeshStandardMaterial({ color: '#e0b123', roughness: .55 });
  for (const sd of [-1, 1]) { const bag = new THREE.Mesh(new THREE.BoxGeometry(.18, .42, .55), wood); bag.position.set(sd * .36, -.16, 0); pack.add(bag); const can = new THREE.Mesh(new THREE.BoxGeometry(.16, .36, .3), yellow); can.position.set(sd * .5, -.12, .02); can.castShadow = true; pack.add(can); }
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(.6, .08, .7), new THREE.MeshStandardMaterial({ color: '#3b3f6e', roughness: 1 })); saddle.position.y = .06; pack.add(saddle);
  pack.traverse(o => { if (o.isMesh) o.castShadow = true; });
  (bones.spine_2 || m).add(pack); pack.scale.set(1 / .74, 1 / .6, 1 / S); pack.position.set(0, .12 / .6, 0);
  donkey = { m, mixer, act, root, speeds, S, x: 0, z: 0, y: 0, yaw: 0, speed: 0, pitch: 0, weights: { idle: 1 }, rope: null };
  const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#4a3b2a' })); scene.add(rope); donkey.rope = rope;
}
function setDonkeyWeights(dt) {
  const d = donkey, s = d.speed, wW = clamp(s / .3, 0, 1) * (1 - clamp((s - 1.5) / 1.2, 0, 1)), wT = clamp((s - 1.5) / 1.2, 0, 1), wI = 1 - clamp(s / .3, 0, 1);
  for (const [n, w] of Object.entries({ idle: wI * (state.t % 14 < 9 ? 1 : 0), eating: wI * (state.t % 14 >= 9 ? 1 : 0), walk: wW, trot: wT })) { d.weights[n] = damp(d.weights[n] || 0, w, 6, dt); d.act[n].setEffectiveWeight(d.weights[n]); }
  d.act.walk.timeScale = s > .05 ? s / d.speeds.walk : 1; d.act.trot.timeScale = s > .05 ? s / d.speeds.trot : 1;     // speeds were measured on the scaled model
}
function stepDonkey(dt, leader) {
  const d = donkey; let want = 0;
  if (state.lead && leader) {
    const dx = leader.x - d.x, dz = leader.z - d.z, dist = Math.hypot(dx, dz), head = Math.atan2(dx, dz);
    if (dist > 2.2) { d.yaw += clamp(angleTo(d.yaw, head), -1.6 * dt, 1.6 * dt); want = clamp((dist - 2.0) * 1.1, 0, leader.speed > 2 ? 3.2 : 1.6); }
  }
  // push out of solids and people, then move
  d.speed = damp(d.speed, want, 3, dt);
  setDonkeyWeights(dt); d.mixer.update(dt);
  let adv = d.speed * dt;
  if (!d.fl) d.m.traverse(o => { if (o.name === 'front_leg_foot_l') d.fl = o; if (o.name === 'front_leg_foot_r') d.fr = o; if (o.name === 'root') d.rootBone = o; });
  if (d.fl && d.speed > .05) {
    d.m.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(d.m.matrixWorld).invert();
    const l = d.fl.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv), r = d.fr.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv), k = l.y <= r.y ? 0 : 1, cur = k ? r : l;
    if (d.prev) { const dz = (d.prev[k].z - cur.z) * d.S; if (dz > 0 && Math.min(l.y, r.y) < .2) adv = dz; }
    d.prev = [l, r];
  } else d.prev = null;
  const nx = d.x + Math.sin(d.yaw) * adv, nz = d.z + Math.cos(d.yaw) * adv; [d.x, d.z] = resolve(nx, nz, .7, d);
  d.y = G.height(d.x, d.z);
  const L = 1.2, fy = G.height(d.x + Math.sin(d.yaw) * L, d.z + Math.cos(d.yaw) * L), by = G.height(d.x - Math.sin(d.yaw) * L, d.z - Math.cos(d.yaw) * L);
  d.pitch = damp(d.pitch, Math.atan2(by - fy, 2 * L), 8, dt);

  d.root.position.set(d.x, d.y + Math.min(0, Math.min(fy, by) - d.y) * .5, d.z); d.root.rotation.set(d.pitch, d.yaw, 0, 'YXZ');
  if (state.lead && leader) { const hand = leader.rt.D.wristR.getWorldPosition(new THREE.Vector3()), b = {}; d.m.traverse(o => { if (o.name === 'head') b.h = o; }); const nose = b.h ? b.h.getWorldPosition(new THREE.Vector3()) : d.root.position; d.rope.geometry.setFromPoints([hand, new THREE.Vector3().lerpVectors(hand, nose, .5).add(new THREE.Vector3(0, -.25, 0)), nose]); d.rope.visible = true; } else d.rope.visible = false;
}
/* ---------------- collision for walkers: solids, people, donkey, bajaj ---------------- */
function resolve(x, z, r, self) {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of state.solids) {
      const c = Math.cos(b.yaw), s = Math.sin(b.yaw), dx = x - b.x, dz = z - b.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      const px = b.hx + r - Math.abs(lx), pz = b.hz + r - Math.abs(lz); if (px <= 0 || pz <= 0) continue;
      let ox = 0, oz = 0; if (px < pz) ox = px * Math.sign(lx || 1); else oz = pz * Math.sign(lz || 1);
      x += ox * c + oz * s; z += -ox * s + oz * c;
    }
    const others = Object.values(people).filter(o => o !== self).map(o => [o.x, o.z, .3]);
    if (donkey && donkey !== self) others.push([donkey.x, donkey.z, .75], [donkey.x + Math.sin(donkey.yaw) * .9, donkey.z + Math.cos(donkey.yaw) * .9, .45], [donkey.x - Math.sin(donkey.yaw) * .9, donkey.z - Math.cos(donkey.yaw) * .9, .45]);
    if (chassis && state.mode !== 'drive') { const t = chassis.translation(); others.push([t.x, t.z, 1.15]); }
    for (const [ox, oz, orr] of others) { const dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz), need = r + orr; if (d < need && d > 1e-4) { x = ox + dx / d * need; z = oz + dz / d * need; } }
  }
  return [x, z];
}
/* ---------------- talking ---------------- */
function nearestPerson(p, maxD = 2.6) { let best = null, bd = maxD; for (const o of Object.values(people)) { if (o === p) continue; const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd) { bd = d; best = o; } } return best; }
function startTalk(o) {
  if (!o) return; state.talk = { o, t: 0, dur: 1.2 + o.c.line.length * .055 };
  o.says = state.talk.dur; o.oneShot = 'greeting';
  $('bub-name').textContent = o.id[0].toUpperCase() + o.id.slice(1); $('bub-text').textContent = o.c.line; $('bub').hidden = false;
}
/* ---------------- camera ---------------- */
const cam = { yaw: 0, pitch: -.18, dist: 4.2, x: 0, y: 0, z: 0, drag: null };
function stepCamera(dt) {
  let tx, ty, tz, heading;
  if (state.mode === 'drive') { const t = chassis.translation(); tx = t.x; ty = t.y + .9; tz = t.z; const f = new THREE.Vector3(1, 0, 0).applyQuaternion(bajaj.g.quaternion); heading = Math.atan2(f.x, f.z); cam.dist = damp(cam.dist, 6.2, 3, dt); }
  else { const p = player(), hip = p.rt.D.root.getWorldPosition(new THREE.Vector3()); cam.hx = damp(cam.hx ?? hip.x, hip.x, 10, dt); cam.hz = damp(cam.hz ?? hip.z, hip.z, 10, dt); tx = cam.hx; ty = p.y + 1.45; tz = cam.hz; heading = p.yaw; cam.dist = damp(cam.dist, state.talk ? 2.6 : state.lead ? 6.0 : 4.0, 3, dt); if (!cam.drag) cam.pitch = damp(cam.pitch, state.lead ? -.34 : -.18, 2, dt); }
  if (!cam.drag) cam.yaw = cam.yaw + angleTo(cam.yaw, heading) * (1 - Math.exp(-(state.mode === 'drive' ? 3 : 1.6) * dt));
  let cx = tx - Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cz = tz - Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cy = ty - Math.sin(cam.pitch) * cam.dist;
  cy = Math.max(cy, G.height(cx, cz) + .5);
  cam.x = damp(cam.x || cx, cx, 8, dt); cam.y = damp(cam.y || cy, cy, 8, dt); cam.z = damp(cam.z || cz, cz, 8, dt);
  camera.position.set(cam.x, cam.y, cam.z); camera.lookAt(tx, ty, tz);
  sun.position.set(tx + SUN_DIR.x * 100, ty + SUN_DIR.y * 100, tz + SUN_DIR.z * 100); sun.target.position.set(tx, ty, tz);
}
/* ---------------- loop ---------------- */
const player = () => people[state.playerId];
function stepFoot(dt) {
  const p = player();
  const mag = Math.min(1, Math.hypot(input.f, input.s));
  if (mag > .05) {
    const want = Math.atan2(-input.s, input.f) + cam.yaw;
    p.yaw += clamp(angleTo(p.yaw, want), -5 * dt, 5 * dt);
  }
  const slopeAhead = (G.height(p.x + Math.sin(p.yaw) * .8, p.z + Math.cos(p.yaw) * .8) - G.height(p.x, p.z)) / .8;
  const carrying = state.carry;
  let want = mag * (input.run ? Math.max(2.6, jogSpeed * 1.05) : Math.max(1.05, walkSpeed * 1.25)) * (carrying ? .82 : 1);
  if (slopeAhead > 0) want *= clamp(1 - slopeAhead * 1.4, .35, 1);                // uphill costs pace
  if (state.talk) want = 0;
  locomote(p, want, dt, carrying);
  p.mixer.update(dt); p.mixed = true;
  const adv = footAdvance(p, dt);                     // the body moves exactly as far as the planted foot pushes it
  const nx = p.x + Math.sin(p.yaw) * adv, nz = p.z + Math.cos(p.yaw) * adv;
  [p.x, p.z] = resolve(nx, nz, .3, p); p.y = G.height(p.x, p.z);
}
const fv = new THREE.Vector3();
function footAdvance(p, dt) {
  p.src.updateMatrixWorld(true); const S = p.rt.S, l = S.foot_l.getWorldPosition(fv).clone(), r = S.foot_r.getWorldPosition(fv).clone();
  const prev = p.feetPrev; p.feetPrev = [l, r];
  if (!prev || p.speed < .05) { p.advV = damp(p.advV || 0, p.speed, 8, dt); return p.speed * dt; }
  const k = l.y <= r.y ? 0 : 1, cur = k ? r : l, was = prev[k], low = Math.min(l.y, r.y);
  let d = (was.z - cur.z) * p.rt.ratio;
  if (low > .16 || d < 0) d = (p.advV || p.speed) * dt;              // in the air (running) or a swing frame: keep momentum
  p.advV = damp(p.advV || 0, d / dt, 12, dt); return Math.max(0, d);
}
function stepNPC(o, dt) {
  const p = player(); let want = o.base;
  if (state.talk && state.talk.o === o) {
    const face = Math.atan2(p.x - o.x, p.z - o.z); o.yaw += clamp(angleTo(o.yaw, face), -2.5 * dt, 2.5 * dt);
    want = state.talk.t < 1.6 && o.act.greeting ? 'greeting' : (o.act[o.c.talk] ? o.c.talk : o.base);
  } else if (Math.hypot(p.x - o.x, p.z - o.z) < 3.2 && o.base !== 'pump') {                       // look over at someone close by
    const face = Math.atan2(p.x - o.x, p.z - o.z); o.yaw += clamp(angleTo(o.yaw, face), -.8 * dt, .8 * dt);
  } else if (o.homeYaw !== undefined) o.yaw += clamp(angleTo(o.yaw, o.homeYaw), -.6 * dt, .6 * dt);  // drift back to their work
  const W = { [want]: 1 }; if (want === 'pump') { W.pump = .55; W['idle-subtle'] = .45; }
  setWeights(o, W, dt, 5); o.y = G.height(o.x, o.z);
}
let last = 0, frameMs = [];
function tick(now) {
  requestAnimationFrame(tick); const dt = Math.min(.05, last ? (now - last) / 1000 : 1 / 60); last = now; step(dt); render();
}
function step(dt) {
  state.t += dt;
  readKeys();
  if (state.mode !== 'drive') stepFoot(dt);
  const sub = Math.max(1, Math.ceil(dt / (1 / 60))), h = dt / sub;     // physics at 60 Hz or finer
  for (let k = 0; k < sub; k++) { stepVehicle(h); world.timestep = h; world.step(); }
  syncVehicle();
  if (state.mode === 'drive') { const t = chassis.translation(); const p = player(); p.x = t.x; p.z = t.z; p.y = t.y; setWeights(p, { driving: 1 }, dt, 8); p.speed = 0; }
  for (const o of Object.values(people)) if (o !== player()) stepNPC(o, dt);
  if (state.talk) { state.talk.t += dt; state.talk.o.says = Math.max(0, state.talk.dur - state.talk.t); if (state.talk.t > state.talk.dur + 1.5 || Math.hypot(player().x - state.talk.o.x, player().z - state.talk.o.z) > 4) { state.talk = null; $('bub').hidden = true; } }
  for (const o of Object.values(people)) { if (!o.mixed) o.mixer.update(dt); o.mixed = false; if (state.mode === 'drive' && o === player()) seatDriver(o); else poseOnGround(o, dt); }
  stepDonkey(dt, state.mode === 'foot' ? player() : null);
  stepCamera(dt); if (state.sky) state.sky.position.copy(camera.position); hud();
}
function render() { const t0 = performance.now(); renderer.render(scene, camera); frameMs.push(performance.now() - t0); if (frameMs.length > 240) frameMs.shift(); }
function hud() {
  const p = player(), near = state.mode === 'foot' && !state.talk ? nearestPerson(p) : null, nearDonkey = Math.hypot(donkey.x - p.x, donkey.z - p.z) < 2.6, t = chassis.translation(), nearBajaj = Math.hypot(t.x - p.x, t.z - p.z) < 3.2;
  const acts = [];
  if (state.mode === 'drive') acts.push(['F', 'Get out']);
  else { if (near) acts.push(['E', 'Talk to ' + near.id[0].toUpperCase() + near.id.slice(1)]); if (nearBajaj) acts.push(['F', 'Drive the bajaj']); if (nearDonkey || state.lead) acts.push(['G', state.lead ? 'Let go of Mistletoe' : 'Lead Mistletoe']); }
  const html = acts.map(([k, l]) => `<button data-k="${k}"><b>${k}</b> ${l}</button>`).join('');
  if ($('acts').dataset.h !== html) { $('acts').innerHTML = html; $('acts').dataset.h = html; }
  const v = state.mode === 'drive' ? vehicle.currentVehicleSpeed() * 3.6 : (p.advV || 0) * 3.6;
  $('spd').textContent = `${v.toFixed(0)} km/h`;
  if (state.talk) { const o = state.talk.o, hp = o.rt.D.head.getWorldPosition(new THREE.Vector3()); hp.y += .35; hp.project(camera); $('bub').style.left = clamp((hp.x * .5 + .5) * innerWidth, 140, innerWidth - 140) + 'px'; $('bub').style.top = clamp((-hp.y * .5 + .5) * innerHeight, 60, innerHeight - 200) + 'px'; }
}
function act(k) {
  const p = player();
  if (k === 'E' && state.mode === 'foot') startTalk(nearestPerson(p));
  if (k === 'F') {
    if (state.mode === 'drive') { const t = chassis.translation(), r = new THREE.Vector3(0, 0, 1.4).applyQuaternion(bajaj.g.quaternion); [p.x, p.z] = resolve(t.x + r.x, t.z + r.z, .3, p); p.y = G.height(p.x, p.z); state.mode = 'foot'; }
    else { const t = chassis.translation(); if (Math.hypot(t.x - p.x, t.z - p.z) < 3.2) { state.mode = 'drive'; state.lead = false; } }
  }
  if (k === 'G' && state.mode === 'foot' && (state.lead || Math.hypot(donkey.x - p.x, donkey.z - p.z) < 2.6)) state.lead = !state.lead;
}
function readKeys() {
  if (state.overrideInput) return;
  const st = joy.active ? joy : null;
  input.f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) + (st ? -st.y : 0);
  input.s = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + (st ? st.x : 0);
  input.f = clamp(input.f, -1, 1); input.s = clamp(input.s, -1, 1);
  input.run = keys.has('shift') || (st && Math.hypot(st.x, st.y) > .92); input.brake = keys.has(' ');
}
addEventListener('keydown', e => { const k = e.key.toLowerCase(); keys.add(k); if (['e', 'f', 'g'].includes(k) && !e.repeat) act(k.toUpperCase()); if (k === ' ') e.preventDefault(); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
$('acts').addEventListener('click', e => { const b = e.target.closest('button'); if (b) act(b.dataset.k); });
// touch: left thumb moves, drag elsewhere orbits
const joy = { active: false, x: 0, y: 0, id: null, ox: 0, oy: 0 };
const pad = $('joy'), knob = $('knob');
pad.addEventListener('pointerdown', e => { joy.active = true; joy.id = e.pointerId; const r = pad.getBoundingClientRect(); joy.ox = r.left + r.width / 2; joy.oy = r.top + r.height / 2; pad.setPointerCapture(e.pointerId); move(e); });
pad.addEventListener('pointermove', e => { if (joy.active && e.pointerId === joy.id) move(e); });
const endJoy = () => { joy.active = false; joy.x = joy.y = 0; knob.style.transform = ''; }; pad.addEventListener('pointerup', endJoy); pad.addEventListener('pointercancel', endJoy);
function move(e) { const R = 46, dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, d = Math.min(R, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); joy.x = Math.cos(a) * d / R; joy.y = Math.sin(a) * d / R; knob.style.transform = `translate(${joy.x * R}px,${joy.y * R}px)`; }
canvas.addEventListener('pointerdown', e => { cam.drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (!cam.drag) return; cam.yaw = cam.drag.yaw - (e.clientX - cam.drag.x) * .006; cam.pitch = clamp(cam.drag.pitch + (e.clientY - cam.drag.y) * .004, -.9, .5); });
canvas.addEventListener('pointerup', () => { cam.drag = null; });
/* ---------------- boot ---------------- */
async function boot() {
  status('Loading ground'); G = await loadGround();
  status('Loading physics'); await RAPIER.init();
  status('Loading people');
  const [stage] = await Promise.all([load('assets/people/Stage.glb'), loadClips()]);
  buildGround(); await buildFar(); const solids = buildItems(stage); buildPhysics(solids);
  for (const id of Object.keys(CAST)) people[id] = await makePerson(id);
  // the wellhead company stands where the game puts them
  for (const [id, [x, z, y, yaw]] of Object.entries(G.home)) if (people[id]) Object.assign(people[id], { x, z, y: G.height(x, z), yaw });
  for (const o of Object.values(people)) o.homeYaw = o.yaw;
  state.playerId = 'imani';
  const pl = player(); const roadDir = Math.atan2(G.road[3][0] - G.road[0][0], G.road[3][1] - G.road[0][1]);
  { const h = G.home.makeda; Object.assign(pl, { x: h[0] + Math.sin(h[3]) * 4.2, z: h[1] + Math.cos(h[3]) * 4.2 }); pl.yaw = Math.atan2(h[0] - pl.x, h[1] - pl.z); pl.y = G.height(pl.x, pl.z); }
  await makeDonkey(); Object.assign(donkey, { x: (state.stage?.x ?? 0) + 2.6, z: (state.stage?.z ?? 0) + 3.2, yaw: 1.2 });
  const br = G.road[6]; buildBajaj(br[0] + 3.6, br[1] + 1.2, roadDir);
  for (let i = 0; i < 120; i++) { stepVehicle(1 / 60); world.timestep = 1 / 60; world.step(); }       // let the bajaj settle on its springs
  state.checks = { heightfield: state.hfLayout, heightfieldError_m: hfCheck(), clipSpeeds: state.clipSpeeds, retargetMissing: player().rt.missing, ratio: +player().rt.ratio.toFixed(3) };
  $('boot').hidden = true; cam.yaw = pl.yaw; if (!location.search.includes('test')) requestAnimationFrame(tick);
  window.__lab = { scene, state, people, donkey: () => donkey, chassis: () => chassis, vehicle: () => vehicle, G, step, render, act, input, keys, camera, cam, renderer, frameMs: () => frameMs, player };
}
boot().catch(e => { status('Could not start: ' + e.message); console.error(e); });
