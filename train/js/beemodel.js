// The honeybee. Built from the animal: a head with compound eyes, elbowed antennae and a tongue; a furred thorax carrying
// two pairs of veined wings and six jointed legs, the hind pair with pollen baskets; a banded abdomen of six plates that
// telescopes as it breathes and curls under to sting. It flies the way a bee flies: nose down and legs trailing at speed,
// hanging tail-low with legs dangling in a hover, rolling into turns, head leading.
// +X is forward, +Y up. The hero is one bee in full; the swarm uses a lighter cast of the same body.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
const AMBER = 0xd98a1e, BROWN = 0x24160c, TAWNY = 0xb8863a, CHITIN = 0x15100b;

function wingTexture() { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const q = c.getContext('2d');
  const outline = () => { q.beginPath(); q.moveTo(64, 4); q.bezierCurveTo(96, 30, 122, 120, 104, 210); q.bezierCurveTo(92, 250, 52, 256, 36, 226); q.bezierCurveTo(14, 170, 30, 50, 64, 4); q.closePath(); };
  outline(); const g = q.createLinearGradient(0, 0, 128, 256); g.addColorStop(0, 'rgba(255,240,210,.42)'); g.addColorStop(1, 'rgba(220,235,255,.2)'); q.fillStyle = g; q.fill(); q.save(); outline(); q.clip();
  q.strokeStyle = 'rgba(60,36,14,.85)'; q.lineWidth = 3; q.beginPath(); q.moveTo(64, 4); q.bezierCurveTo(100, 40, 116, 120, 102, 208); q.stroke();                                // the leading vein
  q.lineWidth = 1.6; for (const [x1, y1, x2, y2] of [[64, 6, 44, 220], [64, 20, 84, 236], [50, 90, 104, 120], [44, 150, 106, 166], [70, 60, 108, 80], [40, 190, 96, 214], [78, 120, 72, 240], [58, 60, 94, 150]]) { q.beginPath(); q.moveTo(x1, y1); q.lineTo(x2, y2); q.stroke(); }
  q.restore(); outline(); q.lineWidth = 2; q.strokeStyle = 'rgba(60,36,14,.6)'; q.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
let WING = null; const wingTex = () => WING || (WING = wingTexture());
const wingGeo = (len, wid) => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0, .5); g.scale(wid, 1, len); return g; };   // hinge at the origin, tip toward +z

/** The full bee. update(dt, { speed 0..1, turn -1..1, landed 0..1, sting 0..1 }). */
export function makeHoneybee(scale = .3) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(scale);
  const S = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, metalness: .05, ...o });
  const amber = S(AMBER, { roughness: .45 }), brown = S(BROWN, { roughness: .4 }), chitin = S(CHITIN, { roughness: .35 }), eyeM = S(0x1a0d08, { roughness: .12, metalness: .3 }), fur = new THREE.MeshLambertMaterial({ color: TAWNY }), pollen = S(0xf2c12e, { roughness: .9 });
  const add = (p, geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; p.add(o); return o; };
  const ball = new THREE.SphereGeometry(1, 16, 12), seg = (len, r1 = .012, r2 = r1) => { const g = new THREE.CylinderGeometry(r1, r2, len, 6); g.translate(0, -len / 2, 0); return g; };
  // ---- thorax, and its fur
  add(body, ball, S(0x6a4a1e, { roughness: .95 }), 0, 0, 0, .2, .17, .17);
  { const hair = new THREE.ConeGeometry(.0045, .05, 3); hair.translate(0, .025, 0); const n = 900, im = new THREE.InstancedMesh(hair, fur, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (let k = 0; k < n; k++) { const u = (k + .5) / n, th = Math.acos(1 - 2 * u), ph = k * 2.39996; d.set(Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)); const head = k % 5 === 0;
      if (head) p.set(.27 + d.x * .09, .02 + d.y * .11, d.z * .12); else p.set(d.x * .19, d.y * .16, d.z * .16); if (d.y < -.7 && !head) { s.setScalar(0); } else s.setScalar(head ? .5 : .75 + (k % 4) * .18);
      d.x -= .5; d.normalize(); q.setFromUnitVectors(up, d); m.compose(p, q, s); im.setMatrixAt(k, m); } body.add(im); }
  // ---- head: wider than long, eyes wrapping the sides, antennae elbowed, tongue folded under
  const head = new THREE.Group(); head.position.set(.24, .0, 0); body.add(head);
  add(head, ball, chitin, .03, 0, 0, .09, .115, .13); for (const s of [-1, 1]) add(head, ball, eyeM, .035, .015, s * .095, .06, .1, .055); add(head, ball, chitin, .1, -.06, 0, .035, .05, .06);
  for (const s of [-1, 1]) add(head, new THREE.ConeGeometry(.016, .05, 5), brown, .115, -.1, s * .03).rotation.z = Math.PI;                         // mandibles
  const tongue = add(head, seg(.16, .01, .004), S(0x7a3a1a), .09, -.09, 0); tongue.rotation.z = -1.9;
  const antennae = [-1, 1].map(s => { const a = new THREE.Group(); a.position.set(.1, .07, s * .04); head.add(a); add(a, seg(.09, .009), chitin).rotation.z = Math.PI; const el = new THREE.Group(); el.position.y = .09; a.add(el); const fl = add(el, seg(.17, .008, .006), chitin); fl.rotation.z = Math.PI; a.elbow = el; a.side = s; return a; });
  // ---- abdomen: six plates in a chain, so it can breathe and curl
  const plates = []; { let parent = body, x = -.2; const R = [.155, .18, .185, .165, .13, .085], col = [amber, brown, amber, brown, amber, brown];
    R.forEach((r, i) => { const g = new THREE.Group(); g.position.set(i ? -.088 : x, i ? 0 : -.01, 0); parent.add(g); add(g, ball, col[i], -.03, 0, 0, .075, r, r * 1.04); if (i < 5) add(g, ball, brown, -.085, 0, 0, .02, r * .97, r * 1.0); plates.push(g); parent = g; }); }
  const stinger = add(plates[5], new THREE.ConeGeometry(.012, .12, 6), chitin, -.1, 0, 0); stinger.rotation.z = Math.PI / 2; stinger.scale.set(1, .2, 1);
  // ---- wings: fore and hind on each side, hooked together as they are in life; ghosts show the stroke while it beats
  const wm = o => new THREE.MeshBasicMaterial({ map: wingTex(), transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false });
  const wings = [-1, 1].map(s => { const side = new THREE.Group(); side.scale.z = s; side.position.set(.03, .13, 0); body.add(side); const sweep = new THREE.Group(); sweep.position.z = .07; side.add(sweep);
    const mk = (op) => { const f = new THREE.Group(); f.add(new THREE.Mesh(wingGeo(.56, .21), wm(op))); const h = new THREE.Mesh(wingGeo(.38, .17), wm(op)); h.position.set(-.1, -.004, .01); h.rotation.y = -.25; f.add(h); sweep.add(f); return f; };
    return { sweep, main: mk(.9), ghosts: [mk(.22), mk(.22), mk(.14)] }; });
  // ---- legs: coxa under the thorax, femur, tibia, tarsus; the hind tibia is broad and carries the pollen
  const legs = []; for (const s of [-1, 1]) { const side = new THREE.Group(); side.scale.z = s; body.add(side);
    [.11, .0, -.11].forEach((x, i) => { const hip = new THREE.Group(); hip.position.set(x, -.12, .07); side.add(hip); add(hip, seg(.15 + i * .01, .016, .013), chitin); const knee = new THREE.Group(); knee.position.y = -(.15 + i * .01); hip.add(knee); add(knee, seg(.17 + i * .02, i === 2 ? .024 : .013, .012), chitin);
      if (i === 2) add(knee, ball, pollen, 0, -.09, .012, .03, .055, .035); const ankle = new THREE.Group(); ankle.position.y = -(.17 + i * .02); knee.add(ankle); add(ankle, seg(.13, .009, .006), chitin); legs.push({ hip, knee, ankle, i, ph: i * 2.1 + (s > 0 ? 1 : 0) }); }); }
  // [hip out, hip fore/aft, knee, ankle] for each pair, in three attitudes
  const POSE = { hover: [[-.95, .55, 1.25, .3], [-1.0, .0, 1.3, .3], [-.85, -.55, 1.15, .35]], cruise: [[-.5, 1.0, 1.9, .5], [-.55, -.35, 1.7, .4], [-.4, -1.15, .9, .2]], stand: [[-1.2, .7, 1.5, .5], [-1.3, 0, 1.6, .5], [-1.2, -.7, 1.5, .5]] };
  const st = { speed: 0, turn: 0, landed: 0, sting: 0, t: Math.random() * 9 };
  function update(dt, s) { const k = Math.min(1, dt * 8); st.speed = lerp(st.speed, clamp(s.speed, 0, 1), k); st.turn = lerp(st.turn, clamp(s.turn, -1, 1), k); st.landed = lerp(st.landed, s.landed || 0, k); st.sting = lerp(st.sting, s.sting || 0, Math.min(1, dt * 14)); st.t += dt;
    const t = st.t, fly = 1 - st.landed, sp = st.speed;
    body.rotation.z = lerp(.3, -.32, sp) * fly - st.sting * .25; body.rotation.x = st.turn * .55 * fly; body.position.y = Math.sin(t * 5.2) * .012 * fly;          // tail-low in a hover, nose-down at speed, rolled into the turn
    head.rotation.y = -st.turn * .35; head.rotation.z = lerp(-.25, .15, sp) * fly + Math.sin(t * 1.7) * .04;
    for (const a of antennae) { a.rotation.z = lerp(-.5, -1.0, sp) + Math.sin(t * 7 + a.side) * .12 * (1 - sp * .6); a.rotation.x = a.side * (.35 + Math.sin(t * 3.3 + a.side * 2) * .1); a.elbow.rotation.z = -1.0 + Math.sin(t * 9 + a.side) * .1; }
    tongue.rotation.z = lerp(-1.9, -.3, st.landed);
    plates.forEach((g, i) => { g.rotation.z = (i ? .07 : .02) * (1 + st.landed) + st.sting * (i ? .34 : .1) + Math.sin(t * 6 - i * .5) * .012; g.scale.x = 1 + Math.sin(t * 6 - i * .7) * .05; }); stinger.scale.y = .2 + st.sting * 1.1;
    const beat = Math.sin(t * 2 * Math.PI * 14.3), amp = 1.05;                                                                    // 230 beats a second, as a screen catches it
    for (const w of wings) { w.sweep.rotation.y = -lerp(.2 + sp * .12, 1.32, st.landed); w.main.rotation.x = -(beat * amp * fly) + st.landed * .12; w.main.rotation.z = Math.cos(t * 2 * Math.PI * 14.3) * .35 * fly;
      w.ghosts.forEach((gh, i) => { gh.visible = fly > .5; gh.rotation.x = -[amp, -amp, 0][i]; }); }
    for (const l of legs) { const a = POSE.hover[l.i], b = POSE.cruise[l.i], c = POSE.stand[l.i], f = (j) => lerp(lerp(a[j], b[j], sp), c[j], st.landed), sway = Math.sin(t * 4 + l.ph) * .08 * fly * (1 - sp * .6), reach = st.sting * (l.i === 0 ? .5 : 0);
      l.hip.rotation.x = f(0) + sway; l.hip.rotation.z = f(1) + reach + sway * .5; l.knee.rotation.x = f(2) - reach; l.ankle.rotation.x = f(3); }
  }
  update(.016, { speed: 0, turn: 0 });
  return { group: root, update };
}

/** The same body cast for a crowd: one geometry for the body and one for both pairs of wings. Lengths in metres. */
export function swarmBeeGeometry(len = .17) {
  const parts = [], col = (g, hex) => { g = g.toNonIndexed(); const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); parts.push(g); };
  const sph = (x, y, z, sx, sy, sz, hex, w = 8, h = 6) => { const g = new THREE.SphereGeometry(1, w, h); g.scale(sx, sy, sz); g.translate(x, y, z); col(g, hex); };
  sph(0, 0, 0, .2, .17, .17, TAWNY); sph(.27, -.01, 0, .09, .115, .13, CHITIN); for (const s of [-1, 1]) sph(.275, .005, s * .095, .06, .1, .055, 0x1a0d08, 6, 5);
  [.155, .18, .185, .165, .13, .085].forEach((r, i) => sph(-.23 - i * .085, -.02 - i * i * .006, 0, .075, r, r * 1.04, i % 2 ? BROWN : AMBER));
  for (const s of [-1, 1]) for (const [x, a] of [[.1, .5], [0, 0], [-.1, -.6]]) { const g = new THREE.CylinderGeometry(.012, .008, .26, 4); g.translate(0, -.13, 0); g.rotateX(s * -.8); g.rotateZ(a); g.translate(x, -.1, s * .07); col(g, CHITIN); }
  for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(.008, .005, .22, 4); g.translate(0, .11, 0); g.rotateZ(-1.0); g.rotateX(s * .35); g.translate(.34, .06, s * .04); col(g, CHITIN); }
  const body = mergeGeometries(parts); body.scale(len, len, len);
  const w = []; for (const s of [-1, 1]) for (const [L, W, x, sw] of [[.56, .21, .03, .2], [.38, .17, -.07, .45]]) { const g = wingGeo(L, W); g.rotateX(-.45); g.rotateY(-sw); g.scale(1, 1, s); g.translate(x, .13, s * .07); w.push(g); }
  const wings = mergeGeometries(w); wings.scale(len, len, len);
  return { body, wings, wingTexture: wingTex() };
}
