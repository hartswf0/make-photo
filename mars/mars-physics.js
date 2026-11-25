/* The Mars can's own physics: a liquid the can carries, like its materials (atlas/JERRYCAN.md §6). The trough has no rigid bodies of its
   own, so the can brings Rapier for its region: the level's ground as a heightfield (rows along z, columns along x, column-major,
   measured in western.js), every solid of mars-world.js as colliders, bottles, cans, barrels and saloon chairs as bodies, and a capsule
   that follows the trough's player so walking into a chair moves it. Everything is in the town's local frame (MarsWorld coordinates).
   MarsPhysics.create(T, { W, Y, parent }) -> { step(dt, playerLocal), shoot(origin, dir) -> { hit, point, what }, props, dispose } */
(() => {
  "use strict";
  const lerp = (a, b, t) => a + (b - a) * t;
  async function create(T, { W, Y, parent, rapierUrl }) {
    const R = (await import(rapierUrl)).default; await R.init();
    const world = new R.World({ x: 0, y: -9.81, z: 0 }), v3 = (x, y, z) => ({ x, y, z }), qY = a => ({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) }), OWNER = new Map();
    { const X0 = -200, Z0 = -330, nr = 400, nc = 450, hts = new Float32Array((nr + 1) * (nc + 1));
      for (let i = 0; i <= nr; i++) for (let j = 0; j <= nc; j++) hts[i * (nc + 1) + j] = Y(X0 + i, Z0 + j);
      world.createCollider(R.ColliderDesc.heightfield(nc, nr, hts, v3(nr, 1, nc)).setTranslation(X0 + nr / 2, 0, Z0 + nc / 2).setFriction(.9)); }
    const future = [];
    for (const k of W.colliders) { const d = k.type === "box" ? R.ColliderDesc.cuboid(k.hx, k.hy, k.hz).setRotation(qY(k.ry || 0)) : k.type === "cyl" ? R.ColliderDesc.cylinder(k.hh, k.r) : R.ColliderDesc.ball(k.r);
      const c = world.createCollider(d.setTranslation(k.x, k.y, k.z)); OWNER.set(c.handle, { kind: "static", tag: k.tag }); if (k.future) { future.push(c); c.setEnabled(false); } }
    const props = [], glassG = new T.MeshPhysicalMaterial({ color: 0x3f7a3a, roughness: .1, transmission: .4, transparent: true, opacity: .85 }), glassA = glassG.clone(); glassA.color.set(0x8a5a1a);
    const tin = new T.MeshStandardMaterial({ color: 0xb8b4ac, metalness: .8, roughness: .35 }), wood = new T.MeshStandardMaterial({ color: 0x6b4429, roughness: .85 }), band = new T.MeshStandardMaterial({ color: 0x3a3a3a, metalness: .6, roughness: .5 });
    function prop(kind, mesh, desc, x, y, z, ry, mass) { const b = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(qY(ry || 0)).setCanSleep(true).setAngularDamping(.4));
      const c = world.createCollider(desc.setMass(mass).setFriction(.6).setRestitution(kind === "can" ? .35 : .15), b); mesh.traverse(o => o.castShadow = true); parent.add(mesh); const p = { kind, mesh, body: b, home: { x, y, z }, down: false }; OWNER.set(c.handle, { kind: "prop", p }); props.push(p); return p; }
    const RG = W.range;
    for (let k = 0; k < 9; k++) { const z = lerp(RG.z0 - .4, RG.z1 + .4, k / 8);
      if (k % 3 === 2) prop("can", new T.Mesh(new T.CylinderGeometry(.05, .05, .13, 12), tin), R.ColliderDesc.cylinder(.065, .05), RG.x, RG.y + .065, z, 0, .25);
      else { const g = new T.Group(), b = new T.Mesh(new T.CylinderGeometry(.04, .045, .2, 10), k % 2 ? glassA : glassG), n = new T.Mesh(new T.CylinderGeometry(.015, .02, .09, 8), b.material); n.position.y = .14; g.add(b, n); prop("bottle", g, R.ColliderDesc.cylinder(.12, .045), RG.x, RG.y + .12, z, 0, .4); } }
    for (const [i, P] of W.porches.entries()) for (const s of [-1, 1]) { if ((i + s) % 3 === 0) continue; const bx = P.x + Math.cos(P.ry) * s * (P.w / 2 - .5), bz = P.z - Math.sin(P.ry) * s * (P.w / 2 - .5);
      const g = new T.Group(); g.add(new T.Mesh(new T.CylinderGeometry(.3, .27, .86, 14), wood)); for (const yy of [-.3, .3]) { const r = new T.Mesh(new T.TorusGeometry(.3, .015, 4, 18), band); r.rotation.x = Math.PI / 2; r.position.y = yy; g.add(r); }
      prop("barrel", g, R.ColliderDesc.cylinder(.43, .3), bx, P.y + .43, bz, 0, 30); }
    const SAL = W.saloon;
    for (const [k, t] of SAL.tables.entries()) for (const a of [0, 2.2]) { const ang = a + k, g = new T.Group(), seat = new T.Mesh(new T.BoxGeometry(.42, .05, .42), wood), back = new T.Mesh(new T.BoxGeometry(.42, .45, .04), wood); back.position.set(0, .24, -.19); g.add(seat, back);
      for (const [lx, lz] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) { const l = new T.Mesh(new T.BoxGeometry(.04, .45, .04), wood); l.position.set(lx, -.24, lz); g.add(l); }
      prop("chair", g, R.ColliderDesc.cuboid(.21, .24, .21), t.x + Math.cos(ang) * .85, SAL.y0 + .5, t.z + Math.sin(ang) * .85, -ang + Math.PI / 2, 5); }
    const me = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()), meC = world.createCollider(R.ColliderDesc.capsule(.55, .3), me);
    let acc = 0;
    return {
      R, world, props,
      step(dt, pl, futureOn) { for (const c of future) c.setEnabled(!!futureOn); if (pl) me.setNextKinematicTranslation(v3(pl.x, pl.y + .85, pl.z));
        acc = Math.min(acc + dt, .1); while (acc >= 1 / 60) { world.step(); acc -= 1 / 60; }
        for (const p of props) { const t = p.body.translation(), r = p.body.rotation(); p.mesh.position.set(t.x, t.y, t.z); p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
          if (!p.down && (p.kind === "bottle" || p.kind === "can") && (t.y < RG.y - .3 || Math.hypot(t.x - p.home.x, t.z - p.home.z) > .6)) p.down = true; } },
      shoot(o, d) { const ray = new R.Ray(v3(o.x + d.x * .4, o.y + d.y * .4, o.z + d.z * .4), v3(d.x, d.y, d.z)), hit = world.castRay(ray, 160, true, undefined, undefined, meC, me);
        if (!hit) return { hit: false }; const toi = hit.timeOfImpact ?? hit.toi, point = new T.Vector3(ray.origin.x + d.x * toi, ray.origin.y + d.y * toi, ray.origin.z + d.z * toi), who = OWNER.get(hit.collider.handle);
        if (who && who.kind === "prop") { const P = who.p, k = P.kind === "barrel" ? 40 : 1.2; P.body.applyImpulseAtPoint(v3(d.x * k, .6 + (P.kind === "barrel" ? 5 : 0), d.z * k), v3(point.x, point.y, point.z), true); return { hit: true, point, what: P.kind }; }
        return { hit: false, point, what: who && who.tag }; },
      dispose() { for (const p of props) parent.remove(p.mesh); world.free && world.free(); }
    };
  }
  window.MarsPhysics = { create };
})();
