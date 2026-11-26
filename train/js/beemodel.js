// The bee, as a character. Small, round and readable at a glance: a big head with two large eyes, brows, a mouth and
// cheeks; two little arms to gesture with; antennae that work like ears; a striped body that squashes and stretches.
// It has a face so that it can mean things. emote(name) plays one of sixteen expressions; flight leans, rolls and bobs under them.
// +X is forward, +Y up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp, YEL = 0xffc928, INK = 0x1b1410;
// brow: +1 angry, -1 worried · lid: 0 open, 1 shut · pup: pupil size · mouth: +1 smile, -1 frown · open: mouth open
// arms: [raise, forward] for each · ant: antennae forward(+)/drooped(-) · lean: body pitch · act: a motion layered on top
const R = [-.45, .25];
export const EMOTES = {
  idle:    { brow: 0, lid: .05, pup: 1, mouth: .35, open: 0, arms: [R, R], ant: .2, lean: 0 },
  happy:   { brow: -.2, browY: .04, lid: .1, pup: 1.1, mouth: 1, open: .5, arms: [[-2.5, 0], [-2.5, 0]], ant: .5, lean: .1, act: 'bounce', blush: 1 },
  laugh:   { brow: -.3, lid: .85, pup: 1, mouth: 1, open: 1, arms: [[-.9, .9], [-.9, .9]], ant: .4, lean: .2, act: 'shake', blush: 1 },
  angry:   { brow: 1, browY: -.03, lid: .35, pup: .7, mouth: -.8, open: 0, arms: [[-1.3, 1.1], [-1.3, 1.1]], ant: -.3, lean: -.15, act: 'tremble', flush: 1 },
  charge:  { brow: 1, browY: -.04, lid: .4, pup: .6, mouth: -.4, open: .7, arms: [[-.3, -1.2], [-.3, -1.2]], ant: -.8, lean: -.55, act: 'tremble', flush: 1 },
  smug:    { brow: .3, lid: .55, pup: .9, mouth: .7, open: 0, arms: [[-1.0, -.3], [-1.0, -.3]], ant: .3, lean: .15, tilt: .2 },
  scared:  { brow: -1, browY: .07, lid: 0, pup: .45, mouth: -.2, open: .9, arms: [[-.7, 1.9], [-.7, 1.9]], ant: -.9, lean: .3, act: 'tremble' },
  sad:     { brow: -1, lid: .4, pup: 1.1, mouth: -1, open: 0, arms: [[-.15, .1], [-.15, .1]], ant: -1.1, lean: -.2, act: 'droop' },
  curious: { brow: -.3, browY: .05, lid: 0, pup: 1.25, mouth: .1, open: .25, arms: [R, [-.5, 1.3]], ant: .9, lean: -.1, tilt: .35 },
  dizzy:   { brow: -.5, lid: .2, pup: .8, mouth: -.1, open: .5, arms: [[-1.6, .2], [-1.6, .2]], ant: -.2, lean: 0, act: 'spin' },
  sleepy:  { brow: -.4, lid: .8, pup: 1, mouth: 0, open: .35, arms: [[-.2, .1], [-.2, .1]], ant: -1.0, lean: .1, act: 'droop' },
  wave:    { brow: -.2, browY: .03, lid: .05, pup: 1.1, mouth: .9, open: .3, arms: [R, [-2.3, .3]], ant: .5, lean: .05, act: 'wave' },
  point:   { brow: .5, lid: .2, pup: .9, mouth: .2, open: .4, arms: [[-1.0, -.3], [-.25, 1.55]], ant: .7, lean: -.25 },
  shrug:   { brow: -.6, browY: .05, lid: .15, pup: 1, mouth: -.3, open: 0, arms: [[-1.5, .5], [-1.5, .5]], ant: -.2, lean: .1, act: 'shrug' },
  yes:     { brow: -.1, lid: .1, pup: 1, mouth: .8, open: 0, arms: [R, R], ant: .4, lean: 0, act: 'nod' },
  no:      { brow: .5, lid: .25, pup: .9, mouth: -.6, open: 0, arms: [[-1.0, -.3], [-1.0, -.3]], ant: -.2, lean: 0, act: 'headshake' },
};

/** The bee you fly. update(dt, { speed 0..1, turn -1..1, landed 0..1, look:[y,z] }) · emote(name, seconds). */
export function makeHoneybee(scale = .15) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(scale);
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .6, ...o }), yel = M(YEL), ink = M(INK, { roughness: .5 }), white = new THREE.MeshBasicMaterial({ color: 0xffffff }), black = new THREE.MeshBasicMaterial({ color: 0x0a0806 });
  const cheekM = new THREE.MeshBasicMaterial({ color: 0xff7a8a, transparent: true, opacity: 0 }), wingM = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: .62, side: THREE.DoubleSide, depthWrite: false });
  const ball = new THREE.SphereGeometry(1, 20, 14), add = (p, g, m, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = m !== wingM; p.add(o); return o; };
  // ---- body: one fat striped bean and a small sting
  const torso = new THREE.Group(); torso.position.set(-.3, -.04, 0); body.add(torso); add(torso, ball, yel, 0, 0, 0, .36, .31, .31);
  for (const [x, r] of [[-.03, .322], [-.2, .274]]) { const g = new THREE.CylinderGeometry(r, r * .97, .11, 24, 1, true); g.rotateZ(Math.PI / 2); const m = ink.clone(); m.side = THREE.DoubleSide; add(torso, g, m, x, 0, 0); }
  const sting = add(torso, new THREE.ConeGeometry(.05, .2, 8), ink, -.4, 0, 0); sting.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) add(torso, ball, ink, .05, -.3, s * .1, .05, .09, .05);                                              // two small feet
  // ---- head: most of the character
  const head = new THREE.Group(); head.position.set(.2, .08, 0); body.add(head); add(head, ball, yel, 0, 0, 0, .36, .35, .37);
  const face = [-1, 1].map(s => { const side = new THREE.Group(); side.scale.z = s; head.add(side);
    const eye = new THREE.Group(); eye.position.set(.275, .07, .15); side.add(eye); add(eye, ball, white, 0, 0, 0, .075, .15, .125); const pupil = add(eye, ball, black, .05, 0, 0, .04, .075, .07); add(pupil, ball, white, .5, .35, -.35, .3);
    const brow = add(side, new THREE.BoxGeometry(.04, .04, .19), ink, .31, .27, .15), cheek = add(side, ball, cheekM, .3, -.09, .24, .02, .05, .06);
    const ant = new THREE.Group(); ant.position.set(.08, .3, .13); side.add(ant); const rod = add(ant, new THREE.CylinderGeometry(.014, .014, .26, 6), ink, 0, .13, 0); void rod; add(ant, ball, ink, 0, .27, 0, .045);
    return { eye, pupil, brow, cheek, ant, s }; });
  const mouth = new THREE.Group(); mouth.position.set(.345, -.12, 0); head.add(mouth); const arc = add(mouth, new THREE.TorusGeometry(.085, .017, 6, 14, Math.PI).rotateY(Math.PI / 2), black), hole = add(mouth, ball, black, -.01, -.01, 0, .03, .06, .07);
  // ---- arms: two short ones, enough to wave, point, shrug and make fists
  const arms = [-1, 1].map(s => { const side = new THREE.Group(); side.scale.z = s; body.add(side); const sh = new THREE.Group(); sh.position.set(-.06, -.06, .27); side.add(sh); const g = new THREE.CylinderGeometry(.03, .026, .2, 8); g.translate(0, -.1, 0); add(sh, g, ink); add(sh, ball, ink, 0, -.22, 0, .05); return sh; });
  // ---- wings: two round ones
  const wg = new THREE.CircleGeometry(.5, 18); wg.rotateX(-Math.PI / 2); wg.scale(.5, 1, .9); wg.translate(-.08, 0, .42);
  const wings = [-1, 1].map(s => { const side = new THREE.Group(); side.scale.z = s; side.position.set(-.2, .2, 0); body.add(side); const w = new THREE.Group(); side.add(w); w.add(new THREE.Mesh(wg, wingM)); const g1 = new THREE.Mesh(wg, wingM), g2 = new THREE.Mesh(wg, wingM); side.add(g1, g2); g1.rotation.x = -.9; g2.rotation.x = .5; return { w, ghosts: [g1, g2] }; });

  const cur = { brow: 0, browY: 0, lid: 0, pup: 1, mouth: .3, open: 0, ant: .2, lean: 0, tilt: 0, blush: 0, flush: 0, a: [R[0], R[1], R[0], R[1]] }, st = { speed: 0, turn: 0, landed: 0, t: Math.random() * 9, blink: 2 + Math.random() * 3, name: 'idle', until: 0, look: [0, 0] };
  function emote(name, secs = 1.6) { if (!EMOTES[name]) return false; st.name = name; st.until = st.t + secs; return true; }
  function update(dt, s = {}) { st.t += dt; const t = st.t, k = Math.min(1, dt * 12); if (st.name !== 'idle' && t > st.until) st.name = 'idle';
    st.speed = lerp(st.speed, clamp(s.speed || 0, 0, 1), Math.min(1, dt * 6)); st.turn = lerp(st.turn, clamp(s.turn || 0, -1, 1), Math.min(1, dt * 6)); st.landed = lerp(st.landed, s.landed || 0, Math.min(1, dt * 6)); if (s.look) { st.look[0] = lerp(st.look[0], s.look[0], k); st.look[1] = lerp(st.look[1], s.look[1], k); }
    const E = EMOTES[st.name], act = E.act, fly = 1 - st.landed;
    for (const key of ['brow', 'lid', 'pup', 'mouth', 'open', 'ant', 'lean']) cur[key] = lerp(cur[key], E[key], k); for (const key of ['browY', 'tilt', 'blush', 'flush']) cur[key] = lerp(cur[key], E[key] || 0, k);
    const A = [E.arms[0][0], E.arms[0][1], E.arms[1][0], E.arms[1][1]]; for (let i = 0; i < 4; i++) cur.a[i] = lerp(cur.a[i], A[i], k);
    st.blink -= dt; const blink = st.blink < .12 ? 1 : 0; if (st.blink < 0) st.blink = 2 + Math.random() * 4;
    // the whole body: lean with speed and feeling, roll into turns, bob, and squash on the beat
    const bob = Math.sin(t * 6) * .03 * fly, tremble = act === 'tremble' ? Math.sin(t * 60) * .012 : 0, bounce = act === 'bounce' ? Math.abs(Math.sin(t * 9)) * .16 : act === 'shake' ? Math.abs(Math.sin(t * 14)) * .07 : 0, droop = act === 'droop' ? -.08 + Math.sin(t * 1.6) * .03 : 0;
    body.position.set(tremble * scale, (bob + bounce + droop) * scale, 0); body.rotation.z = (lerp(.12, -.4, st.speed) * fly + cur.lean) + (act === 'shrug' ? .08 : 0); body.rotation.x = st.turn * .5 * fly + cur.tilt * .5; body.rotation.y = act === 'spin' ? Math.sin(t * 5) * .5 : 0;
    const sq = 1 + (bounce > 0 ? Math.sin(t * 18) * .06 : Math.sin(t * 6) * .015); torso.scale.set(1 / sq, sq, 1 / sq); torso.rotation.z = (st.name === 'charge' ? .7 : 0) * k + torso.rotation.z * (1 - k); sting.scale.y = lerp(sting.scale.y, st.name === 'charge' ? 1.8 : 1, k);
    head.rotation.set(cur.tilt + (act === 'spin' ? Math.sin(t * 7) * .3 : 0), -st.turn * .3 + (act === 'headshake' ? Math.sin(t * 12) * .45 : 0) + st.look[1] * .4, (act === 'nod' ? Math.sin(t * 10) * .25 : 0) + st.look[0] * .3 - body.rotation.z * .5);
    for (const f of face) { f.eye.scale.y = Math.max(.08, 1 - Math.max(cur.lid, blink)); f.pupil.scale.set(.04 * cur.pup, .075 * cur.pup, .07 * cur.pup);
      if (act === 'spin') f.pupil.position.set(.05, Math.sin(t * 9 + f.s) * .06, Math.cos(t * 9 + f.s) * .05); else f.pupil.position.set(.05, clamp(st.look[0], -1, 1) * .05, clamp(st.look[1] * f.s, -1, 1) * .04);
      f.brow.rotation.x = -cur.brow * .5; f.brow.position.y = .27 + cur.browY - cur.lid * .03; f.cheek.material.opacity = Math.max(cur.blush * .8, cur.flush); f.cheek.material.color.setHex(cur.flush > cur.blush ? 0xe0261a : 0xff7a8a); f.cheek.scale.set(.02, .05 + cur.flush * .05, .06 + cur.flush * .05);
      f.ant.rotation.z = -cur.ant * .7 + Math.sin(t * 5 + f.s) * .08; f.ant.rotation.x = .25 + (cur.ant < 0 ? -cur.ant * .5 : 0) + Math.sin(t * 3.1 + f.s * 2) * .06; }
    arc.rotation.x = cur.mouth >= 0 ? Math.PI : 0; arc.scale.set(1, Math.max(.12, Math.abs(cur.mouth)), 1 - cur.open * .3); arc.visible = cur.open < .6; hole.visible = cur.open > .08; hole.scale.set(.03, .1 * cur.open * (act === 'shake' ? .7 + Math.abs(Math.sin(t * 14)) * .5 : 1), .05 + .05 * cur.open);
    arms.forEach((sh, i) => { let rx = cur.a[i * 2], rz = cur.a[i * 2 + 1]; if (act === 'wave' && i === 1) rx += Math.sin(t * 12) * .45; if (act === 'shrug') rx += Math.sin(Math.min(1, (t - (st.until - 1.6)) * 3) * Math.PI) * -.3; if (act === 'bounce') rx += Math.sin(t * 18) * .15; rx += Math.sin(t * 4 + i) * .05; sh.rotation.set(rx, 0, rz); });
    const beat = Math.sin(t * 90); for (const w of wings) { w.w.rotation.x = st.landed > .5 ? .2 : -beat * .8; w.w.rotation.y = -st.landed * 1.1; for (const gh of w.ghosts) gh.visible = fly > .5; }
  }
  update(.016, {});
  return { group: root, update, emote, get emoting() { return st.name; }, names: Object.keys(EMOTES) };
}

/** The same character cast for a crowd: body, stripes, a head with two eyes, antennae, and a wing pair to flip. Length in metres. */
export function swarmBeeGeometry(len = .1) {
  const parts = [], col = (g, hex) => { g = g.toNonIndexed(); const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); parts.push(g); };
  const sph = (x, y, z, sx, sy, sz, hex, w = 10, h = 7) => { const g = new THREE.SphereGeometry(1, w, h); g.scale(sx, sy, sz); g.translate(x, y, z); col(g, hex); };
  sph(-.3, -.04, 0, .36, .31, .31, YEL); for (const [x, r] of [[-.33, .326], [-.5, .276]]) { const g = new THREE.CylinderGeometry(r, r * .97, .11, 12, 1, false); g.rotateZ(Math.PI / 2); g.translate(x, -.04, 0); col(g, INK); }
  { const g = new THREE.ConeGeometry(.05, .2, 6); g.rotateZ(Math.PI / 2); g.translate(-.7, -.04, 0); col(g, INK); }
  sph(.2, .08, 0, .36, .35, .37, YEL); for (const s of [-1, 1]) { sph(.475, .15, s * .15, .075, .15, .125, 0xffffff, 8, 6); sph(.53, .15, s * .15, .04, .075, .07, 0x0a0806, 6, 5); const g = new THREE.CylinderGeometry(.016, .016, .26, 4); g.translate(0, .13, 0); g.rotateZ(-.3); g.rotateX(s * .3); g.translate(.28, .38, s * .13); col(g, INK); sph(.37, .62, s * .21, .05, .05, .05, INK, 6, 5); }
  const body = mergeGeometries(parts); body.scale(len / 1.2, len / 1.2, len / 1.2);
  const w = []; for (const s of [-1, 1]) { const g = new THREE.CircleGeometry(.5, 12); g.rotateX(-Math.PI / 2); g.scale(.5, 1, .9); g.translate(-.08, 0, .42); g.rotateX(-.5); g.scale(1, 1, s); g.translate(-.2, .2, 0); w.push(g); }
  const wings = mergeGeometries(w); wings.scale(len / 1.2, len / 1.2, len / 1.2);
  return { body, wings };
}
