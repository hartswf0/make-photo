// Bees: inhabitants, narrative force and camera guide. One lead bee, a drift of ordinary ones, and a swarm outside.
import * as THREE from 'three';
import { DIM, noise2, damp, clamp } from './kit.js';

export function buildBees(scene, M, mobile) {
  const N = mobile ? 110 : 360, geo = (() => { const parts = [[.022, -.05, 0x16110a], [.03, -.012, 0xf2b21e], [.032, .03, 0x16110a], [.03, .066, 0xf2b21e], [.02, .098, 0x16110a]].map(([r, x, c]) => { const g = new THREE.SphereGeometry(r, 6, 5).toNonIndexed(); g.translate(x, 0, 0); const col = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = col.r; a[i + 1] = col.g; a[i + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; });
    let n = 0; for (const g of parts) n += g.attributes.position.count; const P = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0; for (const g of parts) { P.set(g.attributes.position.array, o); C.set(g.attributes.color.array, o); o += g.attributes.position.array.length; } const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.BufferAttribute(P, 3)); G.setAttribute('color', new THREE.BufferAttribute(C, 3)); return G; })();
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }), N); mesh.frustumCulled = false; scene.add(mesh);
  const wing = new THREE.InstancedMesh(new THREE.PlaneGeometry(.07, .12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false }), N); wing.frustumCulled = false; scene.add(wing);
  const bees = []; for (let k = 0; k < N; k++) bees.push({ v: new THREE.Vector3(), p: new THREE.Vector3(0, -50, 0), home: new THREE.Vector3(), r: .3 + Math.random() * .9, ph: Math.random() * 100, car: -9, sp: .6 + Math.random() });
  const lead = { p: new THREE.Vector3(-23, 2.4, 1.1), v: new THREE.Vector3(1, 0, 0), target: new THREE.Vector3(), landed: 0 };
  // exterior swarm: a ribbon of points that paces the train
  const SN = mobile ? 500 : 1400, sp = new Float32Array(SN * 3), seeds = new Float32Array(SN * 3);
  for (let k = 0; k < SN * 3; k++) seeds[k] = Math.random();
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(16, 16, 13, 7, .5, 0, 7); g.fill(); return new THREE.CanvasTexture(c); })();
  const swarm = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x241606, size: .34, map: dot, alphaTest: .4, sizeAttenuation: true, transparent: true, opacity: 0 })); swarm.frustumCulled = false; scene.add(swarm);
  const state = { swarm: 0, swarmWant: 0, side: 1, near: 0, anger: 0, cool: 0, followers: 0 }, tgt = new THREE.Vector3();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), e = new THREE.Euler(), tmp = new THREE.Vector3();

  function rehome(b, cars, ci) {
    const c = cars[clamp(ci, 1, cars.length - 1)]; b.car = c.i; if (c.i >= 4 && Math.random() < .5) { b.home.set(c.x + (Math.random() - .5) * 16, DIM.FLOOR + .5 + Math.random() * 1.7, (Math.random() - .5) * 2.2); b.r = .3 + Math.random() * .8; return; }
    const spots = c.hives.length ? c.hives : c.lamps.map(x => ({ x, y: DIM.ROOF - .4, z: 0 }));
    const h = spots[(Math.random() * spots.length) | 0], spread = c.hives.length ? .5 : 1;
    b.home.set(c.x + h.x + (Math.random() - .5) * 2.5 * spread, DIM.FLOOR + h.y + Math.random() * .7, clamp(h.z + (Math.random() - .5) * 1.6 * spread, -1.25, 1.25));
    b.r = c.hives.length ? .2 + Math.random() * .7 : .3 + Math.random() * .9;
  }
  function update(dt, t, ctx) {
    const { cars, camCar, actor } = ctx;
    // lead bee: rests on the coffee cup while the traveler sits, then leads toward the nearest threshold
    if (lead.manual) { /* flown by the player */ } else {
    if (actor.seated && ctx.cup) { lead.target.copy(ctx.cup); lead.landed = damp(lead.landed, lead.p.distanceTo(ctx.cup) < .12 ? 1 : 0, 3, dt); }
    else { lead.landed = damp(lead.landed, 0, 6, dt); lead.target.set(actor.x + actor.dir * 1.5, DIM.FLOOR + 1.5, actor.z * .4); if (ctx.goal) { tmp.copy(ctx.goal).sub(lead.target); const d = tmp.length(); lead.target.addScaledVector(tmp, Math.min(1, 1.2 / Math.max(d, .01))); } }
    const wob = 1 - lead.landed;
    tmp.copy(lead.target); tmp.x += Math.sin(t * 2.3) * .22 * wob; tmp.y += Math.sin(t * 3.1) * .12 * wob + (lead.landed ? .012 : 0); tmp.z += Math.cos(t * 1.7) * .2 * wob;
    lead.v.copy(tmp).sub(lead.p); const dl = lead.v.length(); lead.p.addScaledVector(lead.v, Math.min(1, dt * (dl > 3 ? 6 : 2.6)));
    if (dl > .001) lead.v.multiplyScalar(1 / dl); }
    let near = 0, mad = 0, fol = 0; state.cool -= dt;
    for (let k = 0; k < N; k++) {
      const b = bees[k];
      if (k === 0) b.p.copy(lead.p);
      else {
        if (Math.abs(b.car - camCar) > 1) rehome(b, cars, camCar + (k % 3) - 1);
        if (Math.abs(b.p.x - b.home.x) > 14) { b.p.copy(b.home); b.v.set(0, 0, 0); }   // a bee sent to another carriage is already there
        // each bee steers: to its place in the carriage, or to a thrown can, or, if it is one of the angry ones, to his head
        const a = t * b.sp + b.ph, shownNow = ctx.density >= 0 && k < 1 + ctx.density * (N - 1), angry = ctx.hostile && !ctx.follow && !ctx.decoy && shownNow && b.car === ctx.actorCar && (k % 10) / 10 < ctx.anger;
        const here = Math.abs(b.p.x - (ctx.follow ? ctx.follow.x : 1e9)) < 12;
        if (ctx.mob && shownNow && b.p.distanceToSquared(ctx.mob) < 300) { tgt.set(ctx.mob.x + Math.sin(a * 5 + k) * .32, ctx.mob.y + Math.sin(a * 4) * .3, ctx.mob.z + Math.cos(a * 5 + k) * .32); fol++; }
        else if (ctx.follow && shownNow && here) { const r = .35 + (k % 9) * .09; tgt.set(ctx.follow.x - lead.v.x * (.5 + (k % 5) * .25) + Math.sin(a * 2 + k) * r, ctx.follow.y + Math.sin(a * 1.6 + k) * r * .6, ctx.follow.z - lead.v.z * (.5 + (k % 5) * .25) + Math.cos(a * 2 + k) * r); fol++; }
        else if (ctx.decoy && b.car === ctx.actorCar) tgt.set(ctx.decoy.x + Math.sin(a * 3) * .35, ctx.decoy.y + .15 + Math.abs(Math.sin(a * 2)) * .3, ctx.decoy.z + Math.cos(a * 3) * .35);
        else if (angry) tgt.set(ctx.head.x + Math.sin(a * 2.3 + k) * .5, ctx.head.y + Math.sin(a * 1.7) * .3, ctx.head.z + Math.cos(a * 2.3 + k) * .5);
        else tgt.set(b.home.x + Math.sin(a) * b.r + (noise2(a * .3, k) - .5), b.home.y + Math.sin(a * 1.7 + k) * .25, b.home.z + Math.cos(a * 1.3) * b.r * .7);
        const lively = (ctx.mob || ctx.follow) && shownNow && here, gain = ctx.mob && lively ? 16 : lively ? 10 : angry ? 9 : ctx.decoy ? 7 : 4, vmax = ctx.mob && lively ? 9 : lively ? 8 : angry ? 6.5 : 4; b.v.x += (tgt.x - b.p.x) * gain * dt; b.v.y += (tgt.y - b.p.y) * gain * dt; b.v.z += (tgt.z - b.p.z) * gain * dt; b.v.multiplyScalar(1 - Math.min(.9, dt * 2.6)); const sp = b.v.length(); if (sp > vmax) b.v.multiplyScalar(vmax / sp);
        b.p.addScaledVector(b.v, dt); b.p.z = clamp(b.p.z, -1.36, 1.36); b.p.y = clamp(b.p.y, DIM.FLOOR + .12, DIM.FLOOR + DIM.ROOF - .1); if (b.p.y < -10) b.p.copy(tgt);
        if (shownNow) { const dc = b.p.distanceToSquared(ctx.eye); if (dc < 9) near++; if (angry) { mad++; if (state.cool <= 0 && b.p.distanceToSquared(ctx.head) < .12) { state.cool = 2.4 - ctx.anger; b.v.multiplyScalar(-2.5); ctx.onSting && ctx.onSting(); } } }
      }
      e.set(0, k === 0 ? Math.atan2(-lead.v.z, lead.v.x || 1e-6) : Math.atan2(-b.v.z, b.v.x || 1e-6), 0); q.setFromEuler(e);
      const shown = ctx.density >= 0 && k < 1 + ctx.density * (N - 1); s.setScalar(k === 0 ? 1.5 : shown ? 1 : 0); m.compose(b.p, q, s); mesh.setMatrixAt(k, m); if (!shown) { wing.setMatrixAt(k, m); continue; }
      s.set(1, 1, .4 + Math.abs(Math.sin(t * 90 + k)) * 1.2); if (k === 0 && lead.landed > .8) s.z = .5;
      tmp.copy(b.p).y += .016; m.compose(tmp, q, s); wing.setMatrixAt(k, m);
    }
    mesh.instanceMatrix.needsUpdate = wing.instanceMatrix.needsUpdate = true; state.near = near; state.anger = mad; state.followers = fol;
    // swarm ribbon
    state.swarm = damp(state.swarm, state.swarmWant, .8, dt); swarm.material.opacity = Math.min(1, state.swarm * 1.2); swarm.visible = state.swarm > .01;
    if (swarm.visible) {
      for (let k = 0; k < SN; k++) {
        const u = seeds[k * 3], v = seeds[k * 3 + 1], w = seeds[k * 3 + 2], along = ((u + t * (.02 + w * .03)) % 1) * 190 - 150, a = along * .09 + t * (1 + w) + v * 6.28, rad = 1.2 + v * 4.5 * (.6 + .4 * Math.sin(along * .05 + t));
        sp[k * 3] = along; sp[k * 3 + 1] = 5 + Math.sin(along * .035 + t * .6) * 2.2 + Math.sin(a) * rad * .6; sp[k * 3 + 2] = state.side * (7.5 + Math.sin(along * .028 + t * .4) * 3 + Math.cos(a) * rad);
      }
      sg.attributes.position.needsUpdate = true;
    }
  }
  return { update, lead, state, count: N };
}
