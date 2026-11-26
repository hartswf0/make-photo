// Glass on the salt flat. A triptych painted in code, and four swarms made by hand for this circuit:
// a procession that walks out of the window, a knight assembled from its shards, a herd of zebu, and spores around the oasis.
// The walking figures are a motion-capture skeleton that is never drawn: shards of glass are pinned to its bones, so a crowd is one draw call.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const JEWEL = ['#b3122b', '#0f4fa8', '#e2a312', '#0f7a55', '#6a1f8a', '#e8742a', '#1aa3b8', '#f3e6b0'], LEAD = '#120d0a';
const CLIPS = '../highland-exposure/motion-lab/assets/clips/';
const SEG = [['pelvis', 'spine_03', .34], ['spine_03', 'neck_01', .4], ['neck_01', 'head', .2], ['head', null, .24],
  ...['l', 'r'].flatMap(s => [[`clavicle_${s}`, `upperarm_${s}`, .16], [`upperarm_${s}`, `lowerarm_${s}`, .13], [`lowerarm_${s}`, `hand_${s}`, .11], [`pelvis`, `thigh_${s}`, .2], [`thigh_${s}`, `calf_${s}`, .17], [`calf_${s}`, `foot_${s}`, .13], [`foot_${s}`, `ball_${s}`, .1]])];

// ---------------- the triptych: three windows of what this world has carried
function paint(n) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 880; const q = c.getContext('2d'); let sd = 7 + n * 31; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  q.lineJoin = q.lineCap = 'round'; q.strokeStyle = LEAD;
  const pane = (pts, col, lw = 9) => { q.beginPath(); pts.forEach(([x, y], k) => k ? q.lineTo(x, y) : q.moveTo(x, y)); q.closePath(); const g = q.createLinearGradient(pts[0][0], pts[0][1], pts[2][0], pts[2][1]); g.addColorStop(0, col); g.addColorStop(1, shade(col, rnd() * .5 - .15)); q.fillStyle = g; q.fill(); q.lineWidth = lw; q.stroke(); };
  const shade = (hex, k) => { const v = parseInt(hex.slice(1), 16), f = x => Math.max(0, Math.min(255, Math.round(x + (k > 0 ? (255 - x) * k : x * k)))); return `rgb(${f(v >> 16)},${f(v >> 8 & 255)},${f(v & 255)})`; };
  // the ground of each window: rays of glass thrown from a sun that sits low, at noon, or just risen
  const sun = [[256, 700], [256, 250], [256, 470]][n], sky = [[4, 1, 4, 0], [1, 6, 1, 3], [2, 5, 2, 7]][n], R = 900;
  for (let k = 0; k < 22; k++) { const a0 = k / 22 * 6.283 + n, a1 = (k + 1) / 22 * 6.283 + n, m = 150 + rnd() * 160; for (let band = 0; band < 3; band++) { const r0 = band ? m * band : 62, r1 = band === 2 ? R : m * (band + 1);
      pane([[sun[0] + Math.cos(a0) * r0, sun[1] + Math.sin(a0) * r0], [sun[0] + Math.cos(a1) * r0, sun[1] + Math.sin(a1) * r0], [sun[0] + Math.cos(a1) * r1, sun[1] + Math.sin(a1) * r1], [sun[0] + Math.cos(a0) * r1, sun[1] + Math.sin(a0) * r1]], JEWEL[sky[(k + band) % 4]], 6); } }
  q.beginPath(); q.arc(sun[0], sun[1], 62, 0, 7); q.fillStyle = n === 0 ? '#e8742a' : '#f3e6b0'; q.fill(); q.lineWidth = 10; q.stroke();
  // figures: long, bowed or upright, cut from a few panes each, the way a glazier would
  const figure = (x, y, h, lean, col, arms) => { const w = h * .13, hx = x + lean * h * .42, hy = y - h; pane([[x - w, y], [x + w, y], [hx + w * .8, hy + h * .3], [hx - w * .8, hy + h * .3]], col); pane([[hx - w * .9, hy + h * .3], [hx + w * .9, hy + h * .3], [hx + w * .6, hy + h * .1], [hx - w * .6, hy + h * .1]], shade(col, .25));
    q.beginPath(); q.ellipse(hx + lean * 8, hy, w * .62, w * .8, lean * .5, 0, 7); q.fillStyle = '#5a3320'; q.fill(); q.lineWidth = 8; q.stroke();
    q.lineWidth = 15; q.beginPath(); q.moveTo(hx, hy + h * .16); q.lineTo(hx + arms[0] * h, hy + h * .16 - arms[1] * h); q.stroke(); q.lineWidth = 7; q.strokeStyle = '#5a3320'; q.beginPath(); q.moveTo(hx, hy + h * .16); q.lineTo(hx + arms[0] * h, hy + h * .16 - arms[1] * h); q.stroke(); q.strokeStyle = LEAD; return [hx + arms[0] * h, hy + h * .16 - arms[1] * h]; };
  const hex = (x, y, r, col) => pane([0, 1, 2, 3, 4, 5].map(k => [x + Math.cos(k * 1.047) * r, y + Math.sin(k * 1.047) * r]), col, 7);
  if (n === 0) {      // WHAT THE HIVE KEPT: comb closing over bowed carriers
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) hex(40 + k * 86 + (r % 2) * 43, 60 + r * 74, 48, JEWEL[[2, 5, 2, 7][(r + k) % 4]]);
    figure(120, 820, 300, .5, JEWEL[4], [.3, -.1]); figure(256, 830, 330, .42, JEWEL[0], [.3, -.12]); figure(392, 820, 290, .55, JEWEL[1], [.28, -.1]);
  } else if (n === 1) {   // WHAT THE TRAIN CARRIED: a line of windows through the mountains, one figure standing in a broken cell
    for (let k = 0; k < 7; k++) pane([[k * 76 - 10, 560 + (k % 2) * 8], [k * 76 + 58, 560 + (k % 2) * 8], [k * 76 + 58, 626], [k * 76 - 10, 626]], JEWEL[[3, 6][k % 2]]); for (let k = 0; k < 7; k++) pane([[k * 76 + 4, 572], [k * 76 + 44, 572], [k * 76 + 44, 604], [k * 76 + 4, 604]], JEWEL[7], 5);
    for (let k = 0; k < 5; k++) hex(60 + k * 98, 730 + (k % 2) * 40, 54, JEWEL[[2, 5][k % 2]]);
    const hand = figure(256, 840, 420, 0, JEWEL[0], [.34, .3]); figure(256, 840, 420, 0, JEWEL[0], [-.34, .3]); hex(hand[0] + 6, hand[1] - 30, 30, JEWEL[2]);
  } else {                // WHAT THE CAN WILL HOLD: upright, a torch, a tin held up like a lamp
    const t = figure(256, 850, 470, 0, JEWEL[3], [.16, .42]); pane([[t[0] - 22, t[1]], [t[0] + 22, t[1]], [t[0] + 30, t[1] - 70], [t[0], t[1] - 120], [t[0] - 30, t[1] - 70]], JEWEL[5]); pane([[t[0] - 12, t[1] - 20], [t[0] + 12, t[1] - 20], [t[0], t[1] - 80]], JEWEL[2], 6);
    figure(110, 850, 330, -.08, JEWEL[1], [-.2, .34]); const c2 = figure(402, 850, 340, .08, JEWEL[4], [.2, .36]); pane([[c2[0] - 30, c2[1] - 44], [c2[0] + 30, c2[1] - 44], [c2[0] + 30, c2[1]], [c2[0] - 30, c2[1]]], JEWEL[1]); pane([[c2[0] - 22, c2[1] - 36], [c2[0] + 22, c2[1] - 36], [c2[0] + 22, c2[1] - 20], [c2[0] - 22, c2[1] - 20]], JEWEL[2], 4);
    for (let k = 0; k < 9; k++) { q.beginPath(); q.ellipse(60 + rnd() * 400, 120 + rnd() * 240, 9, 5, rnd() * 3, 0, 7); q.fillStyle = JEWEL[2]; q.fill(); q.lineWidth = 4; q.stroke(); } }
  // the leading that holds it, and the name of the window set in it
  q.lineWidth = 26; q.strokeRect(13, 13, 486, 854); q.fillStyle = LEAD; q.fillRect(13, 800, 486, 67); q.fillStyle = '#f3e6b0'; q.font = 'italic 700 30px Georgia, serif'; q.textAlign = 'center'; q.textBaseline = 'middle';
  q.fillText(['what the hive kept', 'what the train carried', 'what the can will hold'][n], 256, 834, 460);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export async function initGlass({ scene, P, NOR, racers, shots, getMe, smack, flash, audio, mobile }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), up = V(0, 1, 0), tmp = V(0, 0, 0), tmp2 = V(0, 0, 0), q1 = new THREE.Quaternion(), m4 = new THREE.Matrix4(), s3 = V(1, 1, 1), col = new THREE.Color();
  // ---- the window stands inside the first bend, lit from behind, facing the grid
  const WIN = V(92, 0, 46), win = new THREE.Group(); win.position.copy(WIN); win.rotation.y = Math.PI + .12; scene.add(win);
  const stone = new THREE.MeshLambertMaterial({ color: 0x3a2c22 });
  for (let n = 0; n < 3; n++) { const h = n === 1 ? 30 : 25, w = h * 512 / 880, m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: paint(n), side: THREE.DoubleSide, fog: false })); m.position.set((n - 1) * 16.4, h / 2 + 2, 0); win.add(m);
    const arch = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, h + 3.4, 1.2), stone); arch.position.set((n - 1) * 16.4, h / 2 + 1.6, -.7); arch.castShadow = true; win.add(arch); }
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(54, 2.2, 5), stone); plinth.position.y = 1.1; win.add(plinth);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(46, 22), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .22, map: null })); pool.rotation.x = -Math.PI / 2; pool.position.set(0, .05, 14); win.add(pool);   // the light it throws on the salt
  { const c = document.createElement('canvas'); c.width = 96; c.height = 48; const x = c.getContext('2d'); for (let k = 0; k < 24; k++) { x.fillStyle = JEWEL[k % 8]; x.fillRect(k * 4, 0, 4, 48); } const g = x.createLinearGradient(0, 0, 0, 48); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = g; x.fillRect(0, 0, 96, 48); pool.material.map = new THREE.CanvasTexture(c); pool.material.opacity = .5; }

  // ---- shards on bones
  const shardG = new THREE.OctahedronGeometry(.5, 0), glassM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .12, metalness: .05, transparent: true, opacity: .86, emissive: 0x332a18, envMapIntensity: 1 });
  let rigs = [], bones = [];
  try { const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), load = u => new Promise((a, b) => loader.load(CLIPS + u, a, undefined, b)), sk = await load('skeleton.glb'), walk = (await load('walk.glb')).animations[0];
    for (let k = 0; k < 3; k++) { const root = SkeletonUtils.clone(sk.scene), mixer = new THREE.AnimationMixer(root); mixer.clipAction(walk).play(); mixer.setTime(k * .41); const by = {}; root.traverse(o => { if (o.isBone) by[o.name] = o; }); rigs.push({ root, mixer, by, seg: SEG.map(() => ({ a: V(0, 0, 0), b: V(0, 0, 0) })) }); }
  } catch (e) { console.warn('no skeleton for the glass figures', e); }
  function pose(dt) { for (const r of rigs) { r.mixer.update(dt); r.root.updateMatrixWorld(true); SEG.forEach(([a, b], k) => { const A = r.by[a]; if (!A) return; A.getWorldPosition(r.seg[k].a); if (b && r.by[b]) r.by[b].getWorldPosition(r.seg[k].b); else r.seg[k].b.copy(r.seg[k].a).y += .22; }); r.hand = r.by.hand_r ? r.by.hand_r.getWorldPosition(r.handP || (r.handP = V(0, 0, 0))) : null; } }
  const PER = SEG.length * 2;
  /** Write one figure's shards into an instanced mesh. fig: { rig, x, z, yaw, scale }. extra(k, pos) may move a shard. */
  function writeFigure(mesh, base, fig, extra) { const r = rigs[fig.rig]; if (!r) return; const c = Math.cos(fig.yaw), s = Math.sin(fig.yaw), sc = fig.scale;
    for (let k = 0; k < SEG.length; k++) { const sg = r.seg[k], w = SEG[k][2] * sc; for (let h = 0; h < 2; h++) { const i = base + k * 2 + h;
        const ax = sg.a.x * sc, ay = sg.a.y * sc, az = sg.a.z * sc, bx = sg.b.x * sc, by = sg.b.y * sc, bz = sg.b.z * sc; tmp.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); tmp2.set(bx - ax, by - ay, bz - az); const len = tmp2.length() || .1; tmp2.multiplyScalar(1 / len);
        q1.setFromUnitVectors(up, tmp2); if (h) { tmp.x += w * .25; q1.multiply(HALF_TURN); }
        const px = tmp.x * c + tmp.z * s + fig.x, pz = -tmp.x * s + tmp.z * c + fig.z; tmp.set(px, tmp.y, pz); q1.premultiply(YAW.setFromAxisAngle(up, fig.yaw)); s3.set(w * (h ? 1.3 : 1.9), len * 1.25, w * (h ? 1.9 : 1.1));
        if (extra && extra(i - base, tmp, s3) === false) s3.setScalar(0); m4.compose(tmp, q1, s3); mesh.setMatrixAt(i, m4); } } }
  const HALF_TURN = new THREE.Quaternion().setFromAxisAngle(up, 1.3), YAW = new THREE.Quaternion();

  // ---- the procession: out of the centre window, down to the wall, along it, and back, behind a torch
  const NF = mobile ? 6 : 11, proc = new THREE.InstancedMesh(shardG, glassM, NF * PER); proc.frustumCulled = false; proc.castShadow = true; scene.add(proc);
  const path = new THREE.CatmullRomCurve3([[0, 4], [-6, 22], [-34, 30], [-60, 22], [-52, 8], [-24, 6]].map(([x, z]) => V(x, 0, z).applyAxisAngle(up, win.rotation.y).add(WIN)), true), PL = path.getLength();
  for (let f = 0; f < NF; f++) for (let k = 0; k < PER; k++) proc.setColorAt(f * PER + k, col.set(JEWEL[(f * 3 + k) % 7]));
  const torch = new THREE.PointLight(0xffb040, 60, 30, 1.6), flame = new THREE.Mesh(new THREE.OctahedronGeometry(.45, 0), new THREE.MeshBasicMaterial({ color: 0xffc04a })); scene.add(torch, flame);

  // ---- the knight: he is the window's shards, called out of it across the road
  const KI = 236, KN = PER + 10, knight = new THREE.InstancedMesh(shardG, glassM, KN); knight.frustumCulled = false; knight.castShadow = true; scene.add(knight);
  for (let k = 0; k < KN; k++) knight.setColorAt(k, col.set(k >= PER ? '#d0102a' : JEWEL[[1, 7, 6, 1, 2][k % 5]]));
  const K = { hp: 3, a: 0, t: 0, off: -1, dir: 1, down: 0, fall: new Float32Array(KN), vel: Array.from({ length: KN }, () => V(0, 0, 0)), home: V(P[KI].x + NOR[KI].x * 19, 7, P[KI].z + NOR[KI].z * 19), pos: V(0, 0, 0), hitT: 0 };
  { const a = new THREE.Mesh(new THREE.PlaneGeometry(9, 14), new THREE.MeshBasicMaterial({ map: paint(1), side: THREE.DoubleSide, fog: false })); a.position.copy(K.home); a.lookAt(P[KI].x, 7, P[KI].z); scene.add(a); const fr = new THREE.Mesh(new THREE.BoxGeometry(10.4, 15.6, 1), stone); fr.position.copy(K.home).addScaledVector(V(NOR[KI].x, 0, NOR[KI].z), .7); fr.quaternion.copy(a.quaternion); scene.add(fr); }
  function knightStep(dt, t) {
    if (K.down > 0) { K.down -= dt; if (K.down <= 0) { K.hp = 3; K.a = 0; K.fall.fill(0); } }
    else K.a = Math.min(1, K.a + dt * .35);
    K.off += K.dir * dt * .16; if (Math.abs(K.off) > .8) K.dir = -Math.sign(K.off);
    K.pos.set(P[KI].x + NOR[KI].x * K.off * 9, 0, P[KI].z + NOR[KI].z * K.off * 9); const yaw = Math.atan2(NOR[KI].x, NOR[KI].z) + (K.dir < 0 ? Math.PI : 0), e = K.a * K.a * (3 - 2 * K.a);
    writeFigure(knight, 0, { rig: 0, x: K.pos.x, z: K.pos.z, yaw, scale: 4.4 }, (k, p) => { const f = K.fall[k]; if (f > 0) { K.fall[k] += dt; p.addScaledVector(K.vel[k], f); p.y = Math.max(.15, p.y - 4.9 * f * f); return; } p.lerpVectors(tmp2.copy(K.home).add(V(Math.sin(k * 7) * 4, Math.cos(k * 5) * 6, 0)), p, e); p.y += Math.sin(t * 3 + k) * (1 - e) * 1.5; });
    const hand = rigs[0] && rigs[0].handP; for (let k = 0; k < 10; k++) { const i = PER + k; if (hand) { const c = Math.cos(yaw), s = Math.sin(yaw), hx = hand.x * 4.4, hz = hand.z * 4.4; tmp.set(hx * c + hz * s + K.pos.x, hand.y * 4.4 + .6 + k * .8, -hx * s + hz * c + K.pos.z); } else tmp.copy(K.pos).y = 3 + k * .6;
      const f = K.fall[i]; if (f > 0) { K.fall[i] += dt; tmp.addScaledVector(K.vel[i], f); tmp.y = Math.max(.15, tmp.y - 4.9 * f * f); } else tmp.lerpVectors(K.home, tmp, e); s3.set(.6 - k * .04, .95, .16); if (K.down > 0 && !f) s3.setScalar(0); m4.compose(tmp, q1.identity(), s3); knight.setMatrixAt(i, m4); }
    knight.instanceMatrix.needsUpdate = true;
    if (K.down > 0 || K.a < .9) return; K.hitT -= dt;
    for (const sh of shots) if (sh.life > 0) { const p = sh.b.translation(); if ((p.x - K.pos.x) ** 2 + (p.z - K.pos.z) ** 2 < 22 && p.y < 9) { sh.life = .01; K.hp--; audio.fx('hit'); let n = 0; for (let k = 0; k < KN && n < KN / 3 + 2; k++) if (!K.fall[k] && Math.random() < .5) { K.fall[k] = .01; K.vel[k].set((Math.random() - .5) * 9, 3 + Math.random() * 5, (Math.random() - .5) * 9); n++; }
        if (K.hp <= 0) { for (let k = 0; k < KN; k++) if (!K.fall[k]) { K.fall[k] = .01; K.vel[k].set((Math.random() - .5) * 14, 4 + Math.random() * 8, (Math.random() - .5) * 14); } K.down = 24; const me = getMe(); if (sh.owner === me) { me.boostT = 3; me.ammo = Math.min(9, me.ammo + 3); flash('THE KNIGHT BREAKS'); } } else if (sh.owner === getMe()) flash(K.hp === 2 ? 'A PANE FALLS' : 'ONE MORE'); } }
    if (K.hitT <= 0) for (const r of racers) if ((r.mid.x - K.pos.x) ** 2 + (r.mid.z - K.pos.z) ** 2 < 11) { smack(r, K.pos, .7); K.hitT = 1.2; if (r === getMe()) flash('THE GLASS SWORD'); }
  }

  // ---- zebu on the flats
  const ZN = mobile ? 14 : 30, zebu = (() => { const parts = [], add = (g, x, y, z) => { g.translate(x, y, z); parts.push(g); };
    add(new THREE.BoxGeometry(2.3, 1.1, .9), 0, 1.5, 0); add(new THREE.SphereGeometry(.42, 6, 5), .55, 2.2, 0); add(new THREE.BoxGeometry(.7, .6, .5), 1.45, 1.75, 0); for (const [x, z] of [[.85, .3], [.85, -.3], [-.85, .3], [-.85, -.3]]) add(new THREE.BoxGeometry(.2, 1.0, .2), x, .5, z);
    for (const s of [-1, 1]) { const h = new THREE.ConeGeometry(.09, 1.1, 5); h.rotateX(s * .9); h.rotateZ(-.3); add(h, 1.5, 2.45, s * .45); }
    let n = 0; for (const g of parts) n += g.toNonIndexed().attributes.position.count; const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0; for (const g of parts) { const t = g.toNonIndexed(); t.computeVertexNormals(); pos.set(t.attributes.position.array, o); nor.set(t.attributes.normal.array, o); o += t.attributes.position.array.length; }
    const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.BufferAttribute(pos, 3)); G.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); const im = new THREE.InstancedMesh(G, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), ZN); im.castShadow = true; im.frustumCulled = false; scene.add(im); return im; })();
  const herd = Array.from({ length: ZN }, (_, k) => ({ p: V(20 + (k * 37) % 70, 0, 80 + (k * 53) % 60), v: V(1, 0, 0), ph: k })), HC = V(55, 0, 112), hc = HC.clone(); herd.forEach((z, k) => zebu.setColorAt(k, col.set(['#e9e2d2', '#c9b8a0', '#8a6a52', '#f3ecdc'][k % 4])));
  function herdStep(dt, t) { hc.set(HC.x + Math.cos(t * .05) * 34, 0, HC.z + Math.sin(t * .07) * 30);
    for (const z of herd) { tmp.copy(hc).sub(z.p).multiplyScalar(.03); for (const o of herd) if (o !== z) { const dx = z.p.x - o.p.x, dz = z.p.z - o.p.z, d2 = dx * dx + dz * dz; if (d2 < 30 && d2 > .01) { tmp.x += dx / d2 * 2.2; tmp.z += dz / d2 * 2.2; } }
      for (const r of racers) { const dx = z.p.x - r.mid.x, dz = z.p.z - r.mid.z, d2 = dx * dx + dz * dz; if (d2 < 900) { tmp.x += dx / Math.sqrt(d2) * 5; tmp.z += dz / Math.sqrt(d2) * 5; } }
      const dx = z.p.x - HC.x, dz = z.p.z - HC.z, d = Math.hypot(dx, dz); if (d > 52) { tmp.x -= dx / d * 6; tmp.z -= dz / d * 6; }
      z.v.addScaledVector(tmp, dt); const sp = z.v.length(); if (sp > 7) z.v.multiplyScalar(7 / sp); if (sp < 1.2) z.v.multiplyScalar(1.2 / Math.max(sp, .01)); z.p.addScaledVector(z.v, dt);
      tmp.copy(z.p).y = Math.abs(Math.sin(t * 5 + z.ph)) * .12 * Math.min(1, sp / 3); q1.setFromAxisAngle(up, Math.atan2(-z.v.z, z.v.x)); m4.compose(tmp, q1, s3.setScalar(1.25 + (z.ph % 3) * .15)); zebu.setMatrixAt(herd.indexOf(z), m4); }
    zebu.instanceMatrix.needsUpdate = true; }

  // ---- the oasis and its spores
  const OA = V(-70, 0, 150); { const w = new THREE.Mesh(new THREE.CircleGeometry(13, 24), new THREE.MeshStandardMaterial({ color: 0x1aa3b8, roughness: .08, metalness: .6 })); w.rotation.x = -Math.PI / 2; w.position.copy(OA).y = .06; scene.add(w);
    for (let k = 0; k < 7; k++) { const a = k * .9, x = OA.x + Math.cos(a) * 15, z = OA.z + Math.sin(a) * 15, tr = new THREE.Mesh(new THREE.CylinderGeometry(.25, .4, 8, 6), new THREE.MeshLambertMaterial({ color: 0x5a4030 })); tr.position.set(x, 4, z); tr.rotation.z = Math.sin(a) * .2; const fr = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.6, 7), new THREE.MeshLambertMaterial({ color: 0x2f7a4a, flatShading: true })); fr.position.set(x, 8.4, z); scene.add(tr, fr); } }
  const SN = mobile ? 60 : 150, spores = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.34, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }), SN); spores.frustumCulled = false; scene.add(spores);
  const sp = Array.from({ length: SN }, (_, k) => ({ p: V(OA.x + Math.cos(k) * (4 + k % 11), 2 + k % 5, OA.z + Math.sin(k) * (4 + k % 11)), ph: k * 1.7, r: 3 + (k % 9), scat: 0, v: V(0, 0, 0) })); sp.forEach((s, k) => spores.setColorAt(k, col.set(['#7df2e0', '#f3e6b0', '#c88cff', '#8cffb0'][k % 4])));
  let wasNear = false;
  function sporeStep(dt, t) { const me = getMe(), near = me && me.mid.distanceToSquared(OA) < 110 * 110; if (near && !wasNear) flash('THEY COME TO YOU'); wasNear = near;
    let boom = null; for (const sh of shots) if (sh.life > 0) { const p = sh.b.translation(); boom = tmp2.set(p.x, p.y, p.z); }
    sp.forEach((s, k) => { const a = t * (.5 + (k % 5) * .13) + s.ph, cx = near ? me.mid.x : OA.x, cz = near ? me.mid.z : OA.z, rr = near ? 2.5 + s.r * .6 : s.r * 1.6; tmp.set(cx + Math.cos(a) * rr, (near ? 1.5 : 2.5) + Math.sin(a * 1.7) * 1.4 + (k % 4), cz + Math.sin(a) * rr);
      if (boom && s.p.distanceToSquared(boom) < 120) { s.scat = 2.5; s.v.copy(s.p).sub(boom).normalize().multiplyScalar(26); s.v.y = 8; }
      if (s.scat > 0) { s.scat -= dt; s.p.addScaledVector(s.v, dt); s.v.multiplyScalar(1 - dt * 1.5); } else s.p.lerp(tmp, Math.min(1, dt * (near ? 2.2 : 1)));
      m4.compose(s.p, q1.identity(), s3.setScalar(.7 + Math.sin(t * 4 + k) * .3)); spores.setMatrixAt(k, m4); }); spores.instanceMatrix.needsUpdate = true; }

  let t = 0, head = 0;
  return { update(dt) { t += dt; pose(dt); head = (head + dt * 1.25 / PL) % 1;
      for (let f = 0; f < NF; f++) { const u = (head - f * (4.2 / PL) + 1) % 1, p = path.getPointAt(u), tg = path.getTangentAt(u); writeFigure(proc, f * PER, { rig: f % 3, x: p.x, z: p.z, yaw: Math.atan2(tg.x, tg.z), scale: 3.1 + (f % 3) * .2 });
        if (f === 0) { const r = rigs[0], h = r && r.handP; flame.position.set(p.x, (h ? h.y * 3.1 : 4) + 1.4 + Math.sin(t * 9) * .08, p.z); flame.rotation.y = t * 3; torch.position.copy(flame.position); torch.intensity = 50 + Math.sin(t * 13) * 12; } }
      proc.instanceMatrix.needsUpdate = true; knightStep(dt, t); herdStep(dt, t); sporeStep(dt, t); },
    knight: K };
}

/** The horned motorcycle: a zebu's horns over the bars, a kanaga cross standing on the rear. */
export function hornedBike() { const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: .4, metalness: .6 }), chrome = new THREE.MeshStandardMaterial({ color: 0xcfd4d6, roughness: .2, metalness: 1 }), bone = new THREE.MeshLambertMaterial({ color: 0xe9dcc0 }), red = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
  for (const z of [1.25, -1.25]) { add(new THREE.TorusGeometry(.62, .15, 8, 18), dark, 0, 0, z, 0, Math.PI / 2); add(new THREE.CylinderGeometry(.5, .5, .06, 12), chrome, 0, 0, z, 0, 0, Math.PI / 2); }
  add(new THREE.BoxGeometry(.5, .5, 1.3), dark, 0, .75, .2); add(new THREE.BoxGeometry(.42, .16, 1.4), new THREE.MeshLambertMaterial({ color: 0x2a1a12 }), 0, 1.05, -.5); add(new THREE.BoxGeometry(.34, .5, .6), chrome, 0, .4, .1);
  add(new THREE.CylinderGeometry(.05, .05, 1.4, 6), chrome, 0, .75, 1.05, -.45); add(new THREE.CylinderGeometry(.04, .04, 1.2, 6), chrome, 0, 1.35, .82, 0, 0, Math.PI / 2); add(new THREE.SphereGeometry(.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), 0, 1.05, 1.3);
  add(new THREE.SphereGeometry(.2, 8, 6), bone, 0, 1.5, .95); for (const s of [-1, 1]) { add(new THREE.ConeGeometry(.1, 1.3, 6), bone, s * .62, 1.95, .95, 0, 0, -s * 1.0); add(new THREE.ConeGeometry(.07, .7, 6), bone, s * 1.12, 2.5, .95, 0, 0, -s * .25); add(new THREE.CylinderGeometry(.13, .13, .03, 10), chrome, s * .55, 1.5, .8, Math.PI / 2); }
  const kx = new THREE.MeshLambertMaterial({ color: 0x1a120c }), k = (w, h, x, y) => add(new THREE.BoxGeometry(w, h, .08), kx, x, y, -1.5); k(.09, 1.3, 0, 1.75); k(.8, .09, 0, 2.2); k(.8, .09, 0, 1.4); for (const s of [-1, 1]) { k(.09, .34, s * .4, 2.36); k(.09, .34, s * .4, 1.24); }
  add(new THREE.BoxGeometry(.3, .12, .05), red, 0, .95, -1.32); add(new THREE.CapsuleGeometry(.2, .6, 4, 8), new THREE.MeshLambertMaterial({ color: 0x5a3b26 }), 0, 1.65, -.3, .25); add(new THREE.SphereGeometry(.2, 8, 6), new THREE.MeshLambertMaterial({ color: 0x3a2418 }), 0, 2.25, -.15);
  g.position.y = -.45; const w = new THREE.Group(); w.add(g); return w; }

/** A tail light that stays in the air behind whatever carries it. */
export function tail(scene, n = 26) { const pos = new Float32Array(n * 3), c = new Float32Array(n * 3); for (let k = 0; k < n; k++) c[k * 3] = (1 - k / n) ** 1.5; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const line = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); line.frustumCulled = false; scene.add(line); let acc = 0;
  return (x, y, z, dt, on) => { line.visible = on; pos[0] = x; pos[1] = y; pos[2] = z; acc += dt; if (acc > .02) { acc = 0; pos.copyWithin(3, 0, (n - 1) * 3); } g.attributes.position.needsUpdate = true; }; }
