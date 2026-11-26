// Bees: inhabitants, narrative force and camera guide. One lead bee, a drift of ordinary ones, and a swarm outside.
import * as THREE from 'three';
import { DIM, noise2, damp, clamp } from './kit.js';
import { makeHoneybee, swarmBeeGeometry } from './beemodel.js';

export function buildBees(scene, M, mobile) {
  const N = mobile ? 110 : 360, cast = swarmBeeGeometry(.17);
  const mesh = new THREE.InstancedMesh(cast.body, new THREE.MeshLambertMaterial({ vertexColors: true }), N); mesh.frustumCulled = false; scene.add(mesh);
  const wing = new THREE.InstancedMesh(cast.wings, new THREE.MeshBasicMaterial({ map: cast.wingTexture, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }), N); wing.frustumCulled = false; scene.add(wing);
  const heroBee = makeHoneybee(.3); scene.add(heroBee.group); let prevLead = null;
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
    let near = 0, mad = 0, fol = 0, atMob = 0; const joinedN = state.followers; state.cool -= dt;
    for (let k = 0; k < N; k++) {
      const b = bees[k];
      if (k === 0) b.p.copy(lead.p);
      else {
        if (!ctx.follow) b.joined = false;
        if (!b.joined && Math.abs(b.car - camCar) > 1) rehome(b, cars, camCar + (k % 3) - 1);
        if (!b.joined && Math.abs(b.p.x - b.home.x) > 14) { b.p.copy(b.home); b.v.set(0, 0, 0); }   // a bee sent to another carriage is already there
        // each bee steers: to its place in the carriage, or to a thrown can, or, if it is one of the angry ones, to his head
        const a = t * b.sp + b.ph, shownNow = b.joined || (ctx.density >= 0 && k < 1 + ctx.density * (N - 1)), angry = ctx.hostile && !ctx.follow && !ctx.decoy && shownNow && b.car === ctx.actorCar && (k % 10) / 10 < ctx.anger;
        // flown past closely enough, a bee joins you and stays joined from carriage to carriage: the swarm is something you gather
        if (ctx.follow && !b.joined && shownNow && b.p.distanceToSquared(ctx.follow) < 12) { b.joined = true; b.rank = joinedN; ctx.onJoin && ctx.onJoin(joinedN + 1); }
        const here = b.joined;
        if (b.joined) { fol++; b.rank = fol;
          if (ctx.mob) { tgt.set(ctx.mob.x + Math.sin(a * 5 + k) * .3, ctx.mob.y + Math.sin(a * 4) * .28, ctx.mob.z + Math.cos(a * 5 + k) * .3); if (b.p.distanceToSquared(ctx.mob) < .5) atMob++; }
          else { const back = .35 + Math.sqrt(b.rank) * (.16 + ctx.spread * .2), r = .12 + Math.sqrt(b.rank) * (.05 + ctx.spread * .05), ang = b.rank * 2.4 + a * (1.2 - ctx.spread * .6); tgt.set(ctx.follow.x - lead.v.x * back + Math.cos(ang) * r * -lead.v.z, ctx.follow.y + Math.sin(ang) * r, ctx.follow.z - lead.v.z * back + Math.cos(ang) * r * lead.v.x); } }
        else if (ctx.decoy && b.car === ctx.actorCar) tgt.set(ctx.decoy.x + Math.sin(a * 3) * .35, ctx.decoy.y + .15 + Math.abs(Math.sin(a * 2)) * .3, ctx.decoy.z + Math.cos(a * 3) * .35);
        else if (angry) tgt.set(ctx.head.x + Math.sin(a * 2.3 + k) * .5, ctx.head.y + Math.sin(a * 1.7) * .3, ctx.head.z + Math.cos(a * 2.3 + k) * .5);
        else tgt.set(b.home.x + Math.sin(a) * b.r + (noise2(a * .3, k) - .5), b.home.y + Math.sin(a * 1.7 + k) * .25, b.home.z + Math.cos(a * 1.3) * b.r * .7);
        const lively = here, gain = ctx.mob && lively ? 16 : lively ? 10 : angry ? 9 : ctx.decoy ? 7 : 4, vmax = ctx.mob && lively ? 9 : lively ? 8 : angry ? 6.5 : 4; b.v.x += (tgt.x - b.p.x) * gain * dt; b.v.y += (tgt.y - b.p.y) * gain * dt; b.v.z += (tgt.z - b.p.z) * gain * dt; b.v.multiplyScalar(1 - Math.min(.9, dt * 2.6)); const sp = b.v.length(); if (sp > vmax) b.v.multiplyScalar(vmax / sp);
        b.p.addScaledVector(b.v, dt); b.p.z = clamp(b.p.z, -1.36, 1.36); b.p.y = clamp(b.p.y, DIM.FLOOR + .12, DIM.FLOOR + DIM.ROOF - .1); if (b.p.y < -10) b.p.copy(tgt);
        if (shownNow) { const dc = b.p.distanceToSquared(ctx.eye); if (dc < 9) near++; if (angry) { mad++; if (state.cool <= 0 && b.p.distanceToSquared(ctx.head) < .12) { state.cool = 2.4 - ctx.anger; b.v.multiplyScalar(-2.5); ctx.onSting && ctx.onSting(); } } }
      }
      const hs = Math.hypot(b.v.x, b.v.z); e.set(0, Math.atan2(-b.v.z, b.v.x || 1e-6), k === 0 ? 0 : clamp(.25 - hs * .09 + b.v.y * .1, -.5, .45), 'YZX'); q.setFromEuler(e);   // tail-low when slow, nose-down when fast
      const shown = k > 0 && (b.joined || (ctx.density >= 0 && k < 1 + ctx.density * (N - 1))); s.setScalar(shown ? 1 : 0); m.compose(b.p, q, s); mesh.setMatrixAt(k, m); if (!shown) { wing.setMatrixAt(k, m); continue; }
      s.set(1, Math.sin(t * 90 + k * 1.7), 1); m.compose(b.p, q, s); wing.setMatrixAt(k, m);                                  // the wing pair is cast raised; flipping it through zero is the beat
    }
    { // the bee you follow, in full
      const H = ctx.hero || {}, moved = prevLead ? Math.hypot(lead.p.x - prevLead.x, lead.p.z - prevLead.z) / Math.max(dt, .001) : 0; (prevLead || (prevLead = lead.p.clone())).copy(lead.p);
      heroBee.group.position.copy(lead.p); heroBee.group.rotation.y = Math.atan2(-lead.v.z, lead.v.x || 1e-6); heroBee.group.visible = ctx.density >= 0 || !!ctx.follow;
      heroBee.update(dt, { speed: H.speed !== undefined ? H.speed : Math.min(1, moved / 3), turn: H.turn || 0, landed: lead.landed > .7 ? 1 : 0, sting: H.sting || 0 }); }
    mesh.instanceMatrix.needsUpdate = wing.instanceMatrix.needsUpdate = true; state.near = near; state.anger = mad; state.followers = fol; state.atMob = atMob;
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
