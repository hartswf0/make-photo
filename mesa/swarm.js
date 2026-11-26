/* Swarms for MESA CHIP: glass figures made of shards pinned to a scion skeleton, a zebu herd, a cloud of luminous spore-creatures.

   ShardSwarm: one hidden cast character (a "driver") runs real motion-capture clips through the shared motion driver. Hundreds of
   instanced glass shards are pinned to its bones (each shard: a bone, an offset in that bone's frame, a spin, a colour). Any number
   of figures can wear the same pose, each with its own place and heading, so a procession costs one skeleton and one draw.
   Shards can fly in from a source to form a figure, be knocked loose by a hit (they fall, bounce, lie, then fly home), take paint,
   or all blow out at once.
     MesaSwarm.shards(T, scene, { driver, figures, per, palette, size, heightAt }) ->
       { place(i, x, y, z, heading), form(i, from, sec), hit(i, point, r, color), shatter(i, dir), update(dt), formed(i), mesh, shards }
   Herd: zebu, boids over the salt (separation, alignment, cohesion, a wandering goal), shy of the rider.
     MesaSwarm.herd(T, scene, { n, center, rMin, rMax, heightAt }) -> { update(dt, player), zebu }
   Spores: glass seed-moths around the oasis (after Scavengers Reign's flora), drawn to a passer-by, scattered by a splat.
     MesaSwarm.spores(T, scene, { n, center, radius }) -> { update(dt, t, player), scatter(point, power) } */
(() => {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, ease = t => t * t * (3 - 2 * t);
  /* bone segments of the 65-bone scion rig, with a radius for the body around each */
  const SEGS = [[1, 3, .17], [3, 5, .15], [5, 7, .07], [10, 12, .06], [12, 14, .05], [16, 18, .06], [18, 20, .05], [51, 53, .085], [53, 54, .065], [56, 58, .085], [58, 59, .065]];
  const HEAD = [7, .13];

  function shards(T, scene, o) {
    const drv = o.driver, F = o.figures || 1, N = o.per || 240, size = o.size || 1, pal = o.palette.map(c => new T.Color(c));
    drv.group.position.set(0, 0, 0); drv.group.rotation.set(0, 0, 0); drv.group.updateMatrixWorld(true);
    const B = drv.bones, _v = new T.Vector3(), _a = new T.Vector3(), _b = new T.Vector3(), _q = new T.Quaternion(), _m = new T.Matrix4(), _s = new T.Vector3();
    /* the shards of one figure, in bone space; every figure reuses them */
    const segW = SEGS.map(([a, b, r]) => (B[a] && B[b]) ? B[a].getWorldPosition(_a.clone()).distanceTo(B[b].getWorldPosition(_b.clone())) * r : 0), headW = .5 * HEAD[1], tot = segW.reduce((s, w) => s + w, headW);
    const P = [];
    for (let k = 0; k < N; k++) { let r = Math.random() * tot, bone, pt, rad;
      if (r < headW || !segW.some(w => w > 0)) { bone = B[HEAD[0]]; bone.getWorldPosition(_a); const d = new T.Vector3().randomDirection(); pt = _a.clone().add(new T.Vector3(0, .05, 0)).addScaledVector(d, HEAD[1] * (.85 + Math.random() * .25)); rad = HEAD[1]; }
      else { r -= headW; let i = 0; while (i < SEGS.length - 1 && r > segW[i]) { r -= segW[i]; i++; } const [a, b, rr] = SEGS[i]; bone = B[a]; B[a].getWorldPosition(_a); B[b].getWorldPosition(_b);
        const t = Math.random(), axis = _b.clone().sub(_a), L = axis.length(); axis.normalize(); const perp = new T.Vector3(1, 0, 0).cross(axis); if (perp.lengthSq() < 1e-4) perp.set(0, 0, 1).cross(axis); perp.normalize(); const ang = Math.random() * Math.PI * 2;
        perp.applyAxisAngle(axis, ang); pt = _a.clone().addScaledVector(axis, t * L).addScaledVector(perp, rr * (.8 + Math.random() * .3)); rad = rr; }
      const local = bone.worldToLocal(pt.clone()); const spin = new T.Quaternion().setFromEuler(new T.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      P.push({ bone, local, spin, s: (rad > .12 ? .13 : .085) * (.7 + Math.random() * .6) * size, c: pal[Math.floor(Math.pow(Math.random(), 1.6) * pal.length)] }); }
    const geo = new T.TetrahedronGeometry(1, 0); geo.scale(1, 1, .22);
    const mat = new T.MeshStandardMaterial({ roughness: .12, metalness: .15, flatShading: true });
    mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n #ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance += vColor * .55;\n #endif"); };
    const mesh = new T.InstancedMesh(geo, mat, F * N); mesh.frustumCulled = false; mesh.castShadow = true; scene.add(mesh);
    const figs = []; for (let f = 0; f < F; f++) { const fig = { M: new T.Matrix4(), q: new T.Quaternion(), form: 1, formSec: 2, from: new T.Vector3(), loose: new Float32Array(N), lp: [], lv: [], col: [] };
      for (let k = 0; k < N; k++) { fig.lp.push(new T.Vector3()); fig.lv.push(new T.Vector3()); fig.col.push(P[k].c.clone()); mesh.setColorAt(f * N + k, P[k].c); } figs.push(fig); }
    mesh.instanceColor.needsUpdate = true;
    const boneQ = new Map(), invD = new T.Matrix4(), dq = new T.Quaternion();
    function place(i, x, y, z, h) { const fig = figs[i]; fig.q.setFromAxisAngle(new T.Vector3(0, 1, 0), h); fig.M.compose(new T.Vector3(x, y, z), fig.q, new T.Vector3(1, 1, 1)); }
    function form(i, from, sec = 2.4) { const fig = figs[i]; fig.form = 0; fig.formSec = sec; fig.from.copy(from); fig.loose.fill(0); }
    function current(fig, k, out) { const p = P[k]; return out.copy(p.local).applyMatrix4(p.bone.matrixWorld).applyMatrix4(invD).applyMatrix4(fig.M); }
    function hit(i, point, r, color) { const fig = figs[i], col = color !== undefined ? new T.Color(color) : null; let n = 0;
      for (let k = 0; k < N; k++) { if (fig.loose[k] > 0) continue; current(fig, k, _v); const d = _v.distanceTo(point); if (d > r) continue;
        fig.loose[k] = 1e-3; fig.lp[k].copy(_v); fig.lv[k].copy(_v).sub(point).normalize().multiplyScalar(2 + Math.random() * 3).add(new T.Vector3(0, 1.5, 0)); if (col) fig.col[k].copy(col).lerp(P[k].c, .25); n++; }
      if (col) { for (let k = 0; k < N; k++) mesh.setColorAt(i * N + k, fig.col[k]); mesh.instanceColor.needsUpdate = true; } return n; }
    function shatter(i, dir) { const fig = figs[i]; for (let k = 0; k < N; k++) { current(fig, k, _v); fig.loose[k] = 1e-3; fig.lp[k].copy(_v); fig.lv[k].set((Math.random() - .5) * 8, 2 + Math.random() * 6, (Math.random() - .5) * 8); if (dir) fig.lv[k].addScaledVector(dir, 4); } fig.form = -1; }
    function update(dt) {
      drv.group.updateMatrixWorld(true); invD.copy(drv.group.matrixWorld).invert(); drv.group.getWorldQuaternion(dq).invert(); boneQ.clear();
      for (let f = 0; f < F; f++) { const fig = figs[f]; if (fig.form >= 0 && fig.form < 1) fig.form = Math.min(1, fig.form + dt / fig.formSec);
        for (let k = 0; k < N; k++) { const p = P[k], id = f * N + k; let bq = boneQ.get(p.bone); if (!bq) { bq = p.bone.getWorldQuaternion(new T.Quaternion()).premultiply(dq); boneQ.set(p.bone, bq); }
          current(fig, k, _v); _q.copy(fig.q).multiply(bq).multiply(p.spin); let s = p.s;
          if (fig.loose[k] > 0) { fig.loose[k] += dt; const lp = fig.lp[k], lv = fig.lv[k];
            if (fig.loose[k] < 3.5 || fig.form < 0) { lv.y -= 9.8 * dt; lp.addScaledVector(lv, dt); const gy = o.heightAt ? o.heightAt(lp.x, lp.z) + .03 : 0; if (lp.y < gy) { lp.y = gy; lv.multiplyScalar(.35); lv.y = Math.abs(lv.y) * .3; } _v.copy(lp); }
            else { const k2 = ease(clamp((fig.loose[k] - 3.5) / .9, 0, 1)); _v.lerpVectors(lp, _v, k2); if (k2 >= 1) fig.loose[k] = 0; } }
          else if (fig.form >= 0 && fig.form < 1) { const delay = (k / N) * .5, t = ease(clamp((fig.form - delay) / .5, 0, 1)); _a.copy(fig.from).add(_b.set(Math.sin(k * 7.1), Math.sin(k * 3.3) * .5 + .5, Math.cos(k * 5.7)).multiplyScalar(1.2)); _v.lerpVectors(_a, _v, t); s *= .5 + .5 * t; }
          else if (fig.form < 0) { s = 0; }
          _m.compose(_v, _q, _s.set(s, s, s)); mesh.setMatrixAt(id, _m); } }
      mesh.instanceMatrix.needsUpdate = true; }
    function reform(i, from, sec) { form(i, from, sec); }
    return { place, form, reform, hit, shatter, update, mesh, figures: figs, formed: i => figs[i].form >= 1, per: N, bonePoint: (i, bi, local, out) => { const b = B[bi]; out.copy(local || new T.Vector3()).applyMatrix4(b.matrixWorld).applyMatrix4(invD).applyMatrix4(figs[i].M); return out; } };
  }

  /* ---------- the zebu herd ---------- */
  function zebuMesh(T, hide) { const g = new T.Group(), m = new T.MeshStandardMaterial({ color: hide, roughness: .9 }), horn = new T.MeshStandardMaterial({ color: 0xe8dcc4, roughness: .6 }), dark = new T.MeshStandardMaterial({ color: 0x2a2420, roughness: .9 });
    const body = new T.Mesh(new T.SphereGeometry(.5, 14, 10), m); body.scale.set(.9, .85, 1.7); body.position.y = 1.15; g.add(body);
    const hump = new T.Mesh(new T.SphereGeometry(.28, 10, 8), m); hump.position.set(0, 1.62, .45); hump.scale.set(.9, 1, 1.1); g.add(hump);
    const dew = new T.Mesh(new T.SphereGeometry(.22, 10, 8), m); dew.scale.set(.6, 1.2, 1); dew.position.set(0, .95, .9); g.add(dew);
    const head = new T.Group(); head.position.set(0, 1.35, 1.0); g.add(head); const skull = new T.Mesh(new T.CylinderGeometry(.11, .17, .55, 10), m); skull.rotation.x = Math.PI / 2 + .5; skull.position.set(0, -.08, .2); head.add(skull);
    const muzzle = new T.Mesh(new T.SphereGeometry(.12, 8, 6), dark); muzzle.position.set(0, -.22, .44); head.add(muzzle);
    for (const s of [-1, 1]) { const c = new T.CatmullRomCurve3([new T.Vector3(s * .1, .1, 0), new T.Vector3(s * .3, .25, -.02), new T.Vector3(s * .42, .55, .05), new T.Vector3(s * .36, .82, .16)]); const t = new T.Mesh(new T.TubeGeometry(c, 10, .035, 6, false), horn); head.add(t);
      const ear = new T.Mesh(new T.ConeGeometry(.06, .18, 6), m); ear.rotation.z = s * 1.6; ear.position.set(s * .17, .02, -.05); head.add(ear); }
    const legs = []; for (const [x, z] of [[-.25, .6], [.25, .6], [-.25, -.6], [.25, -.6]]) { const piv = new T.Group(); piv.position.set(x, .95, z); const l = new T.Mesh(new T.CylinderGeometry(.07, .05, .95, 6), m); l.position.y = -.47; piv.add(l); const hoof = new T.Mesh(new T.CylinderGeometry(.06, .07, .08, 6), dark); hoof.position.y = -.95; piv.add(hoof); g.add(piv); legs.push(piv); }
    const tail = new T.Mesh(new T.CylinderGeometry(.02, .02, .7, 5), m); tail.position.set(0, .95, -.88); tail.rotation.x = .3; g.add(tail);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.userData = { legs, head, tail }; return g; }
  function herd(T, scene, o) { const n = o.n || 14, C = o.center, Z = [], HIDES = [0xf0ece2, 0xd8d0c0, 0x8a6a4a, 0x4a3a2a, 0xe8e0d0, 0xb8a080];
    for (let i = 0; i < n; i++) { const g = zebuMesh(T, HIDES[i % HIDES.length]), a = Math.random() * 6.28, r = lerp(o.rMin, o.rMax, Math.random()); scene.add(g); g.scale.setScalar(.95 + Math.random() * .2);
      Z.push({ g, p: new T.Vector3(C.x + Math.cos(a) * r, 0, C.z + Math.sin(a) * r), v: new T.Vector3(), h: Math.random() * 6, ph: Math.random() * 6 }); }
    let goal = new T.Vector3(C.x + o.rMin + 40, 0, C.z), gt = 0;
    function update(dt, pl) { gt -= dt; if (gt <= 0) { gt = 14 + Math.random() * 10; const a = Math.random() * 6.28, r = lerp(o.rMin + 10, o.rMax - 10, Math.random()); goal.set(C.x + Math.cos(a) * r, 0, C.z + Math.sin(a) * r); }
      for (const z of Z) { const acc = new T.Vector3(), coh = new T.Vector3(), ali = new T.Vector3(); let nb = 0;
        for (const w of Z) { if (w === z) continue; const d = z.p.distanceTo(w.p); if (d < 12) { coh.add(w.p); ali.add(w.v); nb++; if (d < 2.6) acc.addScaledVector(z.p.clone().sub(w.p).normalize(), (2.6 - d) * 2.2); } }
        if (nb) { acc.addScaledVector(coh.divideScalar(nb).sub(z.p), .05); acc.addScaledVector(ali.divideScalar(nb).sub(z.v), .4); }
        acc.addScaledVector(goal.clone().sub(z.p).setY(0).normalize(), .35);
        const dp = Math.hypot(pl.x - z.p.x, pl.z - z.p.z); if (dp < 16) acc.addScaledVector(z.p.clone().sub(new T.Vector3(pl.x, 0, pl.z)).setY(0).normalize(), (16 - dp) * .5);
        const r = Math.hypot(z.p.x - C.x, z.p.z - C.z); if (r < o.rMin) acc.add(new T.Vector3(z.p.x - C.x, 0, z.p.z - C.z).normalize().multiplyScalar(2)); if (r > o.rMax) acc.add(new T.Vector3(C.x - z.p.x, 0, C.z - z.p.z).normalize().multiplyScalar(2));
        z.v.addScaledVector(acc, dt); const sp = z.v.length(), max = dp < 16 ? 7 : 1.6; if (sp > max) z.v.multiplyScalar(max / sp); z.v.multiplyScalar(1 - dt * .15); z.p.addScaledVector(z.v, dt);
        const s = z.v.length(); if (s > .1) z.h = Math.atan2(z.v.x, z.v.z) * .2 + z.h * .8; z.ph += dt * s * 2.6;
        z.g.position.set(z.p.x, o.heightAt(z.p.x, z.p.z), z.p.z); z.g.rotation.y = z.h; const L = z.g.userData.legs; for (let k = 0; k < 4; k++) L[k].rotation.x = Math.sin(z.ph + (k === 0 || k === 3 ? 0 : Math.PI)) * clamp(s / 3, 0, 1) * .6;
        z.g.userData.head.rotation.x = s < .3 ? .5 + Math.sin(z.ph * .3) * .1 : 0; z.g.userData.tail.rotation.z = Math.sin(z.ph * 1.7) * .3; } }
    return { update, zebu: Z }; }

  /* ---------- spores: glass seed-moths ---------- */
  function spores(T, scene, o) { const n = o.n || 160, C = o.center, R = o.radius || 40, wing = new T.PlaneGeometry(.9, .5); wing.translate(.45, 0, 0);
    const mat = new T.MeshBasicMaterial({ transparent: true, opacity: .9, depthWrite: false, side: T.DoubleSide });   /* opaque enough to read against bright sand */
    const L = new T.InstancedMesh(wing, mat, n), Rm = new T.InstancedMesh(wing, mat, n); L.frustumCulled = Rm.frustumCulled = false; scene.add(L, Rm);
    const PAL = [0x40f0e0, 0xff4ab8, 0xb0ff5a, 0x8a7aff, 0xffd04a].map(c => new T.Color(c)), S = [];
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = Math.random() * R; S.push({ p: new T.Vector3(C.x + Math.cos(a) * r, C.y + 1 + Math.random() * 6, C.z + Math.sin(a) * r), v: new T.Vector3(), ph: Math.random() * 6, c: PAL[i % PAL.length] }); L.setColorAt(i, S[i].c); Rm.setColorAt(i, S[i].c); }
    const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _s = new T.Vector3(1, 1, 1);
    function update(dt, t, pl) { const pp = new T.Vector3(pl.x, pl.y + 1.6, pl.z), near = pp.distanceTo(new T.Vector3(C.x, pp.y, C.z)) < R + 25;
      S.forEach((s, i) => { const acc = new T.Vector3(Math.sin(t * .7 + i) * .8, Math.sin(t * 1.3 + i * 2.1) * .6, Math.cos(t * .9 + i * 1.7) * .8);
        acc.add(new T.Vector3(C.x - s.p.x, (C.y + 3) - s.p.y, C.z - s.p.z).multiplyScalar(.03));
        if (near) { const d = pp.clone().sub(s.p), dl = d.length(); if (dl < 18) acc.addScaledVector(d.normalize(), dl > 2.5 ? 1.4 : -2).add(new T.Vector3(-d.z, 0, d.x).multiplyScalar(1.2)); }
        s.v.addScaledVector(acc, dt); s.v.multiplyScalar(1 - dt * .6); const sp = s.v.length(); if (sp > 6) s.v.multiplyScalar(6 / sp); s.p.addScaledVector(s.v, dt); s.ph += dt * (10 + sp * 2);
        const h = Math.atan2(s.v.x, s.v.z), flap = Math.sin(s.ph) * .9;
        _e.set(0, h, flap); _q.setFromEuler(_e); _m.compose(s.p, _q, _s); L.setMatrixAt(i, _m); _e.set(0, h + Math.PI, -flap); _q.setFromEuler(_e); _m.compose(s.p, _q, _s); Rm.setMatrixAt(i, _m); });
      L.instanceMatrix.needsUpdate = Rm.instanceMatrix.needsUpdate = true; }
    function scatter(point, power = 1) { for (const s of S) { const d = s.p.clone().sub(point), dl = d.length(); if (dl < 8) s.v.addScaledVector(d.normalize(), (8 - dl) * 2.2 * power); } }
    return { update, scatter, spores: S }; }

  window.MesaSwarm = { shards, herd, spores };
})();
