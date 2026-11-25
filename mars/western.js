/* The Western: what you can do in Ethiopia on Mars, and what it does to the world.
   Verbs taken from the El Desierto clips (mars/sources.json): ride and get down, walk into the Tezeta saloon through its batwing doors,
   play the krar on its stage (#754, #760), light a cigarette (#757), draw and fire a revolver (#988, #757), draw water at the windmill,
   take the lift and ride the monorail (#761). Every one of them has a body in a real physics engine and a sound in the world.

   Physics is Rapier (WASM, vendored in highland-exposure/motion-lab): the level's ground as a heightfield, every front, porch, bar,
   table, tukul, stela, dome and the station as colliders, bottles, cans, barrels and chairs as rigid bodies, Tex on foot as a
   character controller, the donkey kept out of walls by the same controller, and ragdolls (capsules on spherical joints driving the
   cast's own bones) for anyone who falls or is shot.
   Sound: real recordings from the motion lab's library (hooves, footsteps, wind, a donkey, azmari music in the saloon, chant at the
   rock church), placed in 3D with HRTF; the gunshot, glass, tin, match, krar and train are synthesized; a canyon echo outdoors and a
   wooden room indoors.
   Three ways in: World (explore), Game (goals), Cinema (an automatic director cuts Leone and Kurosawa shots while you play, and a take
   can be recorded to a video file).

   MarsWestern.create(ctx) -> the systems; mars.js calls step() every frame. */
(() => {
  "use strict";
  const RAPIER_URL = "../highland-exposure/motion-lab/vendor/rapier.es.js", SOUND = "../highland-exposure/motion-lab/assets/sound/";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

  async function create(c) {
    const { T, scene, camera, renderer, W, heightAt, tex, mount, say } = c;
    const R = (await import(RAPIER_URL)).default; await R.init();
    const world = new R.World({ x: 0, y: -9.81, z: 0 }); world.timestep = 1 / 60;
    const v3 = (x, y, z) => ({ x, y, z }), qY = a => ({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) });
    const OWNER = new Map();   // collider handle -> what it is (for shots and impacts)

    // ---------- the ground: the level's own heights, 1 m, over the town and its future ----------
    { const X0 = -200, Z0 = -330, S = 1, nr = 400, nc = 450, hts = new Float32Array((nr + 1) * (nc + 1)), alt = new Float32Array((nr + 1) * (nc + 1));
      for (let i = 0; i <= nr; i++) for (let j = 0; j <= nc; j++) { const h = heightAt(X0 + i * S, Z0 + j * S); hts[i * (nc + 1) + j] = h; alt[j * (nr + 1) + i] = h; }
      const w = nr * S, d = nc * S, probe = [[-150, 60], [-120, -200], [90, -280], [160, -40], [-60, 95], [120, 85], [-175, -300], [150, -190], [-185, -60], [185, 30]];   // out on the dunes, where a transposed field shows
      // Rapier's heightfield: rows run along z and columns along x, stored column-major (k = ix * (nz + 1) + iz). Measured, not guessed:
      // a vertical ray that lands exactly on a grid line can miss, so the check probes between the lines.
      const g = world.createCollider(R.ColliderDesc.heightfield(nc, nr, hts, v3(w, 1, d)).setTranslation(X0 + w / 2, 0, Z0 + d / 2).setFriction(.9)); OWNER.set(g.handle, { kind: "ground" }); world.step();
      let err = 0, miss = 0; for (const [x, z] of probe) { const hit = world.castRay(new R.Ray(v3(x + .37, 300, z + .41), v3(0, -1, 0)), 1000, true); if (!hit) { miss++; continue; } err = Math.max(err, Math.abs(300 - (hit.timeOfImpact ?? hit.toi) - heightAt(x + .37, z + .41))); }
      c.hfLayout = { layout: "rows=z cols=x", maxErr_m: +err.toFixed(3), missed: miss }; }

    // ---------- static colliders: the world says where its solids are ----------
    const futureColl = [];
    for (const k of W.colliders) {
      let d = k.type === "box" ? R.ColliderDesc.cuboid(k.hx, k.hy, k.hz).setRotation(qY(k.ry || 0)) : k.type === "cyl" ? R.ColliderDesc.cylinder(k.hh, k.r) : R.ColliderDesc.ball(k.r);
      const col = world.createCollider(d.setTranslation(k.x, k.y, k.z).setFriction(.8)); OWNER.set(col.handle, { kind: "static", tag: k.tag });
      if (k.future) { futureColl.push(col); col.setEnabled(false); }
    }

    // ---------- dynamic props: what a shot, a donkey or a fall can knock over ----------
    const props = [];
    const glassG = new T.MeshPhysicalMaterial({ color: 0x3f7a3a, roughness: .1, transmission: .4, transparent: true, opacity: .8 }), glassA = glassG.clone(); glassA.color.set(0x8a5a1a);
    const tin = new T.MeshStandardMaterial({ color: 0xb8b4ac, metalness: .8, roughness: .35 }), wood = new T.MeshStandardMaterial({ color: 0x6b4429, roughness: .85 }), band = new T.MeshStandardMaterial({ color: 0x3a3a3a, metalness: .6, roughness: .5 });
    function prop(kind, mesh, desc, x, y, z, ry = 0, mass = 1) {
      const b = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(qY(ry)).setCanSleep(true).setAngularDamping(.4).setLinearDamping(.05));
      const col = world.createCollider(desc.setMass(mass).setFriction(.6).setRestitution(kind === "can" ? .35 : .15), b);
      mesh.castShadow = true; scene.add(mesh); const p = { kind, mesh, body: b, col, home: { x, y, z, ry }, hit: 0, down: false }; OWNER.set(col.handle, { kind: "prop", p }); props.push(p); return p;
    }
    const RG = W.range;
    for (let k = 0; k < 9; k++) { const z = lerp(RG.z0 - .4, RG.z1 + .4, k / 8), isCan = k % 3 === 2;
      if (isCan) { const m = new T.Mesh(new T.CylinderGeometry(.05, .05, .13, 12), tin); prop("can", m, R.ColliderDesc.cylinder(.065, .05), RG.x, RG.y + .065, z, 0, .25); }
      else { const g = new T.Group(), body = new T.Mesh(new T.CylinderGeometry(.04, .045, .2, 10), k % 2 ? glassA : glassG), neck = new T.Mesh(new T.CylinderGeometry(.015, .02, .09, 8), body.material); neck.position.y = .14; g.add(body, neck); g.traverse(o => o.castShadow = true);
        prop("bottle", g, R.ColliderDesc.cylinder(.12, .045), RG.x, RG.y + .12, z, 0, .4); } }
    for (const [i, P] of W.porches.entries()) for (const s of [-1, 1]) { if ((i + s) % 3 === 0) continue;   // a few barrels at the ends of the porches
      const [bx, bz] = [P.x + Math.cos(P.ry) * s * (P.w / 2 - .5), P.z - Math.sin(P.ry) * s * (P.w / 2 - .5)];
      const g = new T.Group(), b = new T.Mesh(new T.CylinderGeometry(.3, .27, .86, 14), wood); g.add(b); for (const yy of [-.3, .3]) { const r = new T.Mesh(new T.TorusGeometry(.3, .015, 4, 18), band); r.rotation.x = Math.PI / 2; r.position.y = yy; g.add(r); }
      prop("barrel", g, R.ColliderDesc.cylinder(.43, .3), bx, P.y + .43, bz, 0, 30); }
    const SAL = W.saloon;
    for (const [k, t] of SAL.tables.entries()) for (const a of [0, 2.2]) {   // chairs at the saloon tables
      const ang = a + k, cx = t.x + Math.cos(ang) * .85, cz = t.z + Math.sin(ang) * .85, g = new T.Group(), seat = new T.Mesh(new T.BoxGeometry(.42, .05, .42), wood), back = new T.Mesh(new T.BoxGeometry(.42, .45, .04), wood);
      seat.position.y = 0; back.position.set(0, .24, -.19); g.add(seat, back); for (const [lx, lz] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) { const l = new T.Mesh(new T.BoxGeometry(.04, .45, .04), wood); l.position.set(lx, -.24, lz); g.add(l); }
      prop("chair", g, R.ColliderDesc.cuboid(.21, .24, .21), cx, SAL.y0 + .5, cz, -ang + Math.PI / 2, 5); }

    // ---------- Tex on foot: a capsule moved by a character controller ----------
    const ctrl = world.createCharacterController(.03); ctrl.enableAutostep(.35, .2, true); ctrl.enableSnapToGround(.4); ctrl.setApplyImpulsesToDynamicBodies(true); ctrl.setMaxSlopeClimbAngle(50 * Math.PI / 180);
    const texBody = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, heightAt(0, 0) + 1, 0)), texCol = world.createCollider(R.ColliderDesc.capsule(.55, .3), texBody); OWNER.set(texCol.handle, { kind: "tex" });
    const dkBody = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, heightAt(0, 0) + 1, 0)), dkCol = world.createCollider(R.ColliderDesc.capsule(.45, .5), dkBody); OWNER.set(dkCol.handle, { kind: "donkey" });
    const dkCtrl = world.createCharacterController(.05); dkCtrl.setApplyImpulsesToDynamicBodies(true); dkCtrl.enableSnapToGround(.6); dkCtrl.enableAutostep(.4, .3, true);

    // the settlers get bodies too: kinematic capsules that follow them, so a shot can find them and a ragdoll can take them
    const npcs = (c.people || []).map(p => { const b = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()), col = world.createCollider(R.ColliderDesc.capsule(.55, .28), b); const n = { p, ch: p.ch, body: b, col, rag: null, name: p.s.id }; OWNER.set(col.handle, { kind: "npc", n }); return n; });

    // ---------- the ragdoll: capsules on spherical joints, writing their motion back into the cast's own bones ----------
    const SEG = [["pelvis", 1, 3, .13], ["chest", 3, 6, .15], ["head", 7, -1, .11], ["uarmL", 10, 12, .05], ["farmL", 12, 14, .045], ["uarmR", 16, 18, .05], ["farmR", 18, 20, .045], ["ulegL", 51, 53, .075], ["llegL", 53, 54, .06], ["ulegR", 56, 58, .075], ["llegR", 58, 59, .06]];
    const JNT = [["pelvis", "chest", 3], ["chest", "head", 7], ["chest", "uarmL", 10], ["uarmL", "farmL", 12], ["chest", "uarmR", 16], ["uarmR", "farmR", 18], ["pelvis", "ulegL", 51], ["ulegL", "llegL", 53], ["pelvis", "ulegR", 56], ["ulegR", "llegR", 58]];
    const _a = new T.Vector3(), _b = new T.Vector3(), _q = new T.Quaternion(), _q2 = new T.Quaternion(), UPV = new T.Vector3(0, 1, 0);
    function ragdoll(ch, push, at) {
      ch.group.updateMatrixWorld(true); const B = ch.bones, parts = {}, frozen = B.map(b => b.quaternion.clone());
      for (const [name, bi, ci, r] of SEG) {
        B[bi].getWorldPosition(_a); if (ci >= 0) B[ci].getWorldPosition(_b); else _b.copy(_a).add(new T.Vector3(0, .24, 0));
        const dir = _b.clone().sub(_a), len = Math.max(.08, dir.length()); dir.normalize(); const mid = _a.clone().add(_b).multiplyScalar(.5), rot = new T.Quaternion().setFromUnitVectors(UPV, dir);
        const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(mid.x, mid.y, mid.z).setRotation(rot).setLinearDamping(.2).setAngularDamping(1.2).setCcdEnabled(true));
        const col = world.createCollider(R.ColliderDesc.capsule(Math.max(.02, len / 2 - r), r).setDensity(name === "pelvis" || name === "chest" ? 900 : 700).setFriction(.9).setCollisionGroups(0x0004FFFB), body);   // parts never collide with each other
        B[bi].getWorldQuaternion(_q); parts[name] = { body, col, bi, off: rot.clone().invert().multiply(_q) }; OWNER.set(col.handle, { kind: "part", ch });
      }
      for (const [a, b, bi] of JNT) { B[bi].getWorldPosition(_a); const pa = parts[a].body, pb = parts[b].body, la = local(pa, _a), lb = local(pb, _a); world.createImpulseJoint(R.JointData.spherical(la, lb), pa, pb, true); }
      if (push) { const target = at ? Object.values(parts).reduce((m, p) => { const t = p.body.translation(), d = Math.hypot(t.x - at.x, t.y - at.y, t.z - at.z); return !m || d < m.d ? { p, d } : m; }, null).p : parts.chest;
        target.body.applyImpulse(v3(push.x, push.y, push.z), true); for (const p of Object.values(parts)) p.body.applyImpulse(v3(push.x * .05, .2, push.z * .05), true); }
      const order = SEG.map(s => s[0]);   // parents come first in SEG
      return { parts, order, frozen, t: 0, ch,
        apply() { for (let i = 0; i < B.length; i++) if (!SEG.some(s => s[1] === i)) B[i].quaternion.copy(frozen[i]);
          for (const n of order) { const P = parts[n], r = P.body.rotation(); _q.set(r.x, r.y, r.z, r.w).multiply(P.off); const bone = B[P.bi]; bone.parent.updateMatrixWorld(true); bone.parent.getWorldQuaternion(_q2); bone.quaternion.copy(_q2.invert().multiply(_q)); bone.updateMatrixWorld(true); }
          const pt = parts.pelvis.body.translation(); B[1].getWorldPosition(_a); ch.group.position.x += pt.x - _a.x; ch.group.position.y += pt.y - _a.y; ch.group.position.z += pt.z - _a.z; ch.group.updateMatrixWorld(true); },
        speed() { let s = 0; for (const p of Object.values(parts)) { const v = p.body.linvel(); s = Math.max(s, Math.hypot(v.x, v.y, v.z)); } return s; },
        dispose() { for (const p of Object.values(parts)) { OWNER.delete(p.col.handle); world.removeRigidBody(p.body); } } };
    }
    function local(body, p) { const t = body.translation(), r = body.rotation(); _q.set(r.x, r.y, r.z, r.w).invert(); const v = new T.Vector3(p.x - t.x, p.y - t.y, p.z - t.z).applyQuaternion(_q); return v3(v.x, v.y, v.z); }

    // ---------- props in Tex's hands: a revolver, a cigarette, the krar ----------
    const gun = new T.Group(); { const steel = new T.MeshStandardMaterial({ color: 0x2a2a2c, metalness: .85, roughness: .3 }), grip = new T.MeshStandardMaterial({ color: 0x5a3a22, roughness: .6 });
      const barrel = new T.Mesh(new T.CylinderGeometry(.012, .012, .2, 8), steel); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .02, .14); const drum = new T.Mesh(new T.CylinderGeometry(.025, .025, .05, 8), steel); drum.rotation.x = Math.PI / 2; drum.position.set(0, .015, .03);
      const gp = new T.Mesh(new T.BoxGeometry(.025, .09, .035), grip); gp.position.set(0, -.04, -.01); gp.rotation.x = -.35; gun.add(barrel, drum, gp); gun.traverse(o => o.castShadow = true); }
    const cig = new T.Group(); { const paper = new T.Mesh(new T.CylinderGeometry(.004, .004, .07, 6), new T.MeshStandardMaterial({ color: 0xf4efe6 })); paper.rotation.z = Math.PI / 2; const ember = new T.Mesh(new T.SphereGeometry(.0055, 6, 4), new T.MeshBasicMaterial({ color: 0xff5a1a })); ember.position.x = .036; cig.add(paper, ember); cig.userData.ember = ember; }
    const krarHeld = W.makeKrar(); krarHeld.scale.setScalar(1); krarHeld.visible = false; tex.group.add(krarHeld); krarHeld.position.set(.04, .95, .26); krarHeld.rotation.set(-.35, 0, .12);
    const HAND_R = 20, PELVIS = 1;
    function holdIn(obj, bi, pos, rot) { const b = tex.bones[bi]; if (obj.parent !== b) b.add(obj); obj.position.set(...pos); obj.rotation.set(...rot); }
    holdIn(gun, PELVIS, [-.17, -.05, .02], [Math.PI / 2, 0, 0]);   // holstered at the right hip
    // smoke from the lips: sprites that rise and fade
    const puffTex = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 64; const g = cv.getContext("2d"), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, "rgba(235,232,228,.55)"); gr.addColorStop(1, "rgba(235,232,228,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(cv); return t; })();
    const puffs = []; for (let i = 0; i < 24; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); puffs.push({ s, t: 9 }); }
    const flash = new T.PointLight(0xffc070, 0, 14, 2); scene.add(flash); const flashSprite = new T.Sprite(new T.SpriteMaterial({ map: puffTex, color: 0xffd08a, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); flashSprite.scale.setScalar(.35); flashSprite.visible = false; scene.add(flashSprite);
    const dust = []; for (let i = 0; i < 16; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: puffTex, color: 0xc8906a, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); dust.push({ s, t: 9 }); }

    // ================= the glass games: the same mini-games the trough plays (atlas/glass-games.js) =================
    const GG = window.GlassGames ? window.GlassGames.create({ T, camera, canvas: renderer.domElement }) : null;
    const HOST = { freeze: v => { st.frozen = v; }, cam: f => { st.gameCam = f; }, post: o => { st.aimO = o; } };
    // ================= sound =================
    const S = await makeSound(T, camera);

    // ================= state =================
    const st = { mode: "ride", x: 0, y: 0, z: 0, heading: Math.PI, vy: 0, gait: 0, step: 0, gun: false, raise: 0, recoil: 0, cool: 0, smoking: false, smokeT: 0, puff: 0, krarT: 0, pluck: 0,
      inside: false, litres: 0, rag: null, ragT: 0, train: null, lift: 0, ammo: 6, shots: 0, notes: 0, label: "", events: [] };
    const goals = [
      { id: "water", text: "Draw water at the windmill tank", done: false },
      { id: "deliver", text: "Carry it to Selam at the telegraph", done: false },
      { id: "bottles", text: "Knock every bottle and can off the rail", done: false },
      { id: "krar", text: "Play a Tezeta on the saloon's krar", done: false },
      { id: "storm", text: "Ride through the storm", done: false },
      { id: "train", text: "Take the monorail", done: false }];
    const done = id => { const g = goals.find(x => x.id === id); if (g && !g.done) { g.done = true; st.events.push({ t: performance.now(), kind: "goal", id }); if (c.onGoal) c.onGoal(g, goals); } };
    const ev = (kind, extra) => st.events.push(Object.assign({ t: performance.now(), kind }, extra || {}));

    // ================= verbs =================
    const texPos = () => ({ x: st.x, y: st.y, z: st.z });
    const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) < r;
    const sel = () => tex.state;   // for clarity
    function offer() {   // the one thing E does here, now
      const M = mount.state, P = texPos(), STN = W.station;
      if (st.mode === "ragdoll") return null;
      if (st.mode === "ride") return { verb: "dismount", label: "Get down" };
      if (st.mode === "krar") return { verb: "stopKrar", label: "Put the krar down" };
      if (st.mode === "train") return STN.docked ? { verb: "alight", label: "Get off the train" } : { verb: null, label: "Riding the monorail" };
      if (st.mode === "lift") return null;
      if (near(P, M, 2.6)) return { verb: "mount", label: "Get on the donkey" };
      if (near(P, SAL.stage, 1.8) || near(P, SAL.krarAt, 1.5)) return { verb: "krar", label: "Play the krar" };
      const tank = W.landmarks.tank; if (near(P, tank, 3.2) && st.litres < 20) return { verb: "draw", label: "Draw water" };
      const selam = npcs.find(n => n.name === "selam" || n.name === "hirut"); if (st.litres > 0 && selam && near(P, selam.ch.state, 2.6)) return { verb: "give", label: "Give " + st.litres.toFixed(0) + " L of water" };
      if (W.future.visible && STN.lift) { const bot = { x: STN.liftX, z: STN.liftZ }; if (near(P, bot, 1.8)) return { verb: "lift", label: P.y > STN.deck - 3 ? "Take the lift down" : "Take the lift up" }; }
      if (W.future.visible && STN.docked && P.y > STN.deck - 1.5 && Math.abs(P.x - STN.x) < 14 && Math.abs(P.z - STN.z) < 3) return { verb: "board", label: "Board the train" };
      return null;
    }
    function act(verb) {
      const M = mount.state;
      if (verb === "dismount") { const side = new T.Vector3(Math.cos(M.heading), 0, -Math.sin(M.heading)); st.x = M.x + side.x * 1.3; st.z = M.z + side.z * 1.3; st.y = heightAt(st.x, st.z); st.heading = M.heading; st.mode = "foot"; placeTex(); S.cloth(texPos()); ev("dismount"); }
      else if (verb === "mount") { st.mode = "ride"; S.cloth(texPos()); ev("mount"); }
      else if (verb === "krar" && GG) { st.mode = "krar"; const s = SAL.stage; st.x = s.x; st.z = s.z; st.y = SAL.y0 + .32; st.heading = SAL.ry + Math.PI; SAL.krar.visible = false; krarHeld.visible = true; holster(); stopSmoke(); ev("krar");
        GG.play("krar", { cam: () => ({ pos: new T.Vector3(SAL.bar.x, SAL.y0 + 1.75, SAL.bar.z), look: new T.Vector3(st.x, st.y + 1.1, st.z), fov: 44 }), pluck: () => { st.pluck = 1; st.notes++; ev("note"); },
          onNote: (ok, n, of) => { if (n >= 8) done("krar"); } }, HOST).then(res => { act("stopKrar"); if (res && res.total) say(res.caught >= res.total * .7 ? "Almaz: “That was our mother's song. Stay as long as you like.”" : "Almaz: “The krar knows you a little. Come back.”"); }); }
      else if (verb === "krar") { st.mode = "krar"; const s = SAL.stage; st.x = s.x; st.z = s.z; st.y = SAL.y0 + .32; st.heading = SAL.ry + Math.PI; SAL.krar.visible = false; krarHeld.visible = true; holster(); stopSmoke(); ev("krar"); say("Yared: “Twin suns over the mines. The Empire takes the spice, but not our songs. This is our Tezeta.”"); }
      else if (verb === "stopKrar") { st.mode = "foot"; krarHeld.visible = false; SAL.krar.visible = true; const s = SAL.stage; st.x = s.x - Math.sin(SAL.ry) * 1.6; st.z = s.z - Math.cos(SAL.ry) * 1.6; }
      else if (verb === "draw") { st.litres = 20; S.pour(W.landmarks.tank); done("water"); say("Twenty litres from the windmill tank."); }
      else if (verb === "give") { const n = st.litres; st.litres = 0; done("deliver"); say("Selam: “Five litres for the line crew. The wire will sing tonight.”"); ev("give", { litres: n }); }
      else if (verb === "lift") { const STN = W.station; st.mode = "lift"; st.lift = { from: st.y, to: st.y > STN.deck - 3 ? STN.ground : STN.deck, t: 0 }; S.lift(); }
      else if (verb === "board") { st.mode = "train"; st.train = { car: 1 }; done("train"); S.chime(); ev("board"); say("The monorail runs out over the canyon."); }
      else if (verb === "alight") { const STN = W.station; st.mode = "foot"; st.train = null; st.x = STN.x; st.z = STN.z + .4; st.y = STN.deck; ev("alight"); }
    }
    function draw() { if (st.mode !== "foot") return;
      if (GG && !st.gun) { st.gun = true; holdIn(gun, HAND_R, [.0, -.03, .05], [0, 0, 0]); stopSmoke(); S.cloth(texPos()); ev("draw");
        const eye = () => { const h = new T.Vector3(); tex.bones[7].getWorldPosition(h); return h; };
        GG.play("draw", { eye, muzzle: () => { const h = new T.Vector3(); tex.bones[HAND_R].getWorldPosition(h); return h; }, yaw0: st.heading, pitch0: -.02, shots: 6, fire: dir => { st.cool = 0; const r = fire(dir); ev("shot"); return r; } }, HOST).then(() => { holster(); st.aimO = null; });
        return; }
      st.gun = !st.gun; if (st.gun) { holdIn(gun, HAND_R, [.0, -.03, .05], [0, 0, 0]); stopSmoke(); S.cloth(texPos()); } else holster(); }
    function holster() { st.gun = false; holdIn(gun, PELVIS, [-.17, -.05, .02], [Math.PI / 2, 0, 0]); }
    function smoke() { if (st.mode !== "foot") return; if (st.smoking) return stopSmoke(true); if (st.gun) holster(); st.smoking = true; st.smokeT = 0; holdIn(cig, HAND_R, [.0, -.02, .06], [0, 0, -.3]); cig.visible = true; S.match(texPos()); ev("smoke"); }
    function stopSmoke(drop) { if (!st.smoking) return; st.smoking = false; cig.visible = false; if (cig.parent) cig.parent.remove(cig); }
    const _o = new T.Vector3(), _d = new T.Vector3();
    function fire(aimDir) {
      if (st.mode !== "foot" || !st.gun || st.cool > 0) return;
      st.cool = .45; st.recoil = 1; st.shots++; tex.bones[HAND_R].getWorldPosition(_o);
      if (aimDir) _d.copy(aimDir); else _d.set(Math.sin(st.heading), 0, Math.cos(st.heading));
      // a little help aiming: the nearest target within 7 degrees of where he points
      let best = null; for (const p of props) { if (p.down) continue; const t = p.body.translation(), v = new T.Vector3(t.x - _o.x, t.y - _o.y, t.z - _o.z), dd = v.length(); if (dd > 60) continue; const a = v.clone().normalize().angleTo(_d); if (a < .12 && (!best || a < best.a)) best = { a, v: v.normalize() }; }
      for (const n of npcs) { if (n.rag) continue; const t = n.body.translation(), v = new T.Vector3(t.x - _o.x, t.y + .3 - _o.y, t.z - _o.z), dd = v.length(); if (dd > 60) continue; const a = v.clone().normalize().angleTo(_d); if (a < .1 && (!best || a < best.a)) best = { a, v: v.normalize() }; }
      if (best && !aimDir) _d.copy(best.v); else if (!aimDir) _d.y = -.03;
      const ray = new R.Ray(v3(_o.x + _d.x * .3, _o.y + _d.y * .3, _o.z + _d.z * .3), v3(_d.x, _d.y, _d.z));
      const hit = world.castRay(ray, 140, true, undefined, undefined, texCol, texBody), toi = hit ? (hit.timeOfImpact ?? hit.toi) : 140, hp = new T.Vector3(ray.origin.x + _d.x * toi, ray.origin.y + _d.y * toi, ray.origin.z + _d.z * toi);
      flash.position.copy(_o); flash.intensity = 6; flashSprite.position.copy(_o).addScaledVector(_d, .25); flashSprite.visible = true; flashSprite.material.opacity = 1;
      S.gunshot(_o, st.inside);
      const who = hit && OWNER.get(hit.collider.handle);
      if (who && who.kind === "prop") { const P = who.p; P.body.applyImpulseAtPoint(v3(_d.x * (P.kind === "barrel" ? 40 : 1.2), .6 + (P.kind === "barrel" ? 5 : 0), _d.z * (P.kind === "barrel" ? 40 : 1.2)), v3(hp.x, hp.y, hp.z), true); P.hit++;
        if (P.kind === "bottle") S.glass(hp); else if (P.kind === "can") S.tin(hp); else S.thud(hp); ev("hit", { what: P.kind }); }
      else if (who && who.kind === "npc") { fall(who.n, { x: _d.x * 18, y: 4, z: _d.z * 18 }, hp); S.thud(hp); ev("hit", { what: "person", who: who.n.name }); }
      else if (who && who.kind === "part") { S.thud(hp); }
      else { S.ricochet(hp); puffAt(hp); }
      if (hit) puffAt(hp);
      return { hit: !!(who && (who.kind === "prop" || who.kind === "npc")), point: hp, what: who && who.kind === "prop" ? who.p.kind : who && who.kind === "npc" ? who.n.name : null };
    }
    function puffAt(p) { const d = dust.find(x => x.t > 1.2) || dust[0]; d.t = 0; d.s.visible = true; d.s.position.copy(p); }
    function fall(who, push, at) {   // a ragdoll: Tex (who === "tex") or a settler
      if (who === "tex") { if (st.mode !== "foot" && st.mode !== "ride") return; if (st.mode === "ride") { const M = mount.state; st.x = M.x; st.z = M.z; st.y = (M.y || 0) + 1; st.heading = M.heading; }
        holster(); stopSmoke(); texCol.setEnabled(false); st.rag = ragdoll(tex, push || { x: Math.sin(st.heading) * 25, y: 10, z: Math.cos(st.heading) * 25 }); st.mode = "ragdoll"; st.ragT = 0; S.thud(texPos()); ev("fall", { who: "tex" }); }
      else if (!who.rag) { who.col.setEnabled(false); who.rag = ragdoll(who.ch, push, at); who.ragT = 0; who.p.ragging = true; if (who.p.d) who.p.d.state.speed = 0; ev("fall", { who: who.name }); }
    }
    function placeTex() { tex.group.position.set(st.x, st.y, st.z); tex.group.rotation.set(0, st.heading, 0); tex.state.x = st.x; tex.state.y = st.y; tex.state.z = st.z; tex.state.heading = st.heading; texBody.setNextKinematicTranslation(v3(st.x, st.y + .85, st.z)); texBody.setTranslation(v3(st.x, st.y + .85, st.z), true); }
    // ---------- krar: six strings in the Tezeta scale (G A B D E, and G above) ----------
    function pluck(k) { if (st.mode !== "krar") return; S.krar(k, texPos()); st.pluck = 1; st.notes++; if (st.notes === 8) { done("krar"); say("Almaz: “You rode here to write your names in my dust, but this ground remembers our mother's songs. Listen.”"); } ev("note", { k }); }

    // ================= the director: Cinema mode =================
    const DIR = { on: false, shot: "ots", until: 0, t: 0, cam: new T.Vector3(), look: new T.Vector3(), blend: 1, seed: 1, letterbox: 0 };
    const SHOTS = ["wide", "ots", "track", "low", "cu", "ots"];
    function cue(shot, sec) { DIR.shot = shot; DIR.until = DIR.t + sec; DIR.blend = 0; }
    function director(dt, focus, events) {
      DIR.t += dt; DIR.letterbox = lerp(DIR.letterbox, DIR.on ? 1 : 0, 1 - Math.exp(-dt * 3));
      if (!DIR.on) return null;
      for (const e of events) {   // the cut follows what happens
        if (e.kind === "shot") cue("hands", 1.1); else if (e.kind === "hit") cue(e.what === "person" ? "wide" : "insert", 2.2); else if (e.kind === "krar") cue("cu", 5); else if (e.kind === "smoke") cue("cu", 4); else if (e.kind === "fall") cue("wide", 3.5);
        else if (e.kind === "storm") cue("wide", 6); else if (e.kind === "board") cue("track", 6); }
      if (DIR.t > DIR.until) { DIR.seed = (DIR.seed * 16807) % 2147483647; const moving = focus.speed > .6, pick = st.mode === "krar" ? ["cu", "wide", "hands", "low"] : moving ? ["ots", "track", "wide", "low"] : ["cu", "wide", "ots", "low"]; cue(pick[DIR.seed % pick.length], 4 + (DIR.seed % 30) / 10); }
      const f = new T.Vector3(Math.sin(focus.heading), 0, Math.cos(focus.heading)), r = new T.Vector3(f.z, 0, -f.x), P = new T.Vector3(focus.x, focus.y, focus.z), head = P.clone().add(new T.Vector3(0, focus.headY || 1.62, 0));
      let pos, look;
      switch (DIR.shot) {
        case "wide": pos = P.clone().addScaledVector(f, 26).addScaledVector(r, 30); pos.y = heightAt(pos.x, pos.z) + 2.2; look = P.clone().add(new T.Vector3(0, 1.4, 0)); break;   // Leone: the figure small in the land
        case "track": pos = P.clone().addScaledVector(r, -7).addScaledVector(f, 1); pos.y = P.y + 1.6; look = P.clone().addScaledVector(f, 2).add(new T.Vector3(0, 1.3, 0)); break;
        case "low": pos = P.clone().addScaledVector(f, 3.2).addScaledVector(r, 1.2); pos.y = P.y + .35; look = head.clone(); break;   // Kurosawa's low hero
        case "cu": pos = head.clone().addScaledVector(f, .95).addScaledVector(r, .18); pos.y = head.y + .02; look = head.clone(); break;   // the eyes
        case "hands": { const hp = new T.Vector3(); tex.bones[HAND_R].getWorldPosition(hp); pos = hp.clone().addScaledVector(r, .8).addScaledVector(f, .3); pos.y += .12; look = hp; break; }
        case "insert": { const t = props.find(p => p.hit && !p.down) || props[0], q = t.body.translation(); look = new T.Vector3(q.x, q.y, q.z); pos = look.clone().add(new T.Vector3(1.6, .5, 1.2)); break; }
        default: return null;   // ots: the game's own chase camera
      }
      return { pos: avoid(look, pos), look, fov: DIR.shot === "cu" || DIR.shot === "hands" || DIR.shot === "insert" ? 30 : DIR.shot === "wide" ? 38 : 50 };
    }
    function avoid(from, to) {   // keep the camera out of walls: pull it in along the line of sight
      const d = new T.Vector3().subVectors(to, from), L = d.length(); if (L < .1) return to; d.multiplyScalar(1 / L);
      const hit = world.castRay(new R.Ray(v3(from.x, from.y, from.z), v3(d.x, d.y, d.z)), L, true, undefined, 0x0001FFFB, texCol, texBody); const toi = hit ? (hit.timeOfImpact ?? hit.toi) : null;
      return toi !== null && toi < L ? from.clone().addScaledVector(d, Math.max(.4, toi - .25)) : to;
    }
    // record a take: the canvas and the world's sound, to a video file
    const REC = { on: false, rec: null, chunks: [] };
    function record() {
      if (REC.on) { REC.rec.stop(); return false; }
      const vs = renderer.domElement.captureStream(30), as = S.stream(); const tracks = [...vs.getVideoTracks(), ...(as ? as.getAudioTracks() : [])];
      const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)); if (!type) return false;
      REC.chunks = []; REC.rec = new MediaRecorder(new MediaStream(tracks), { mimeType: type, videoBitsPerSecond: 6e6 }); REC.rec.ondataavailable = e => e.data.size && REC.chunks.push(e.data);
      REC.rec.onstop = () => { REC.on = false; const blob = new Blob(REC.chunks, { type: "video/webm" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "tex-lexington-take-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".webm"; a.click(); if (c.onRecord) c.onRecord(false); };
      REC.rec.start(250); REC.on = true; return true;
    }

    // ================= the step =================
    let acc = 0, fstep = 0, lastStorm = "far", seen = 0;
    function step(dt, clock, input) {
      const M = mount.state, evs = [];
      st.cool = Math.max(0, st.cool - dt); st.recoil = Math.max(0, st.recoil - dt * 4); st.pluck = Math.max(0, st.pluck - dt * 6);
      for (const c2 of futureColl) c2.setEnabled(W.future.visible);
      // the donkey: kept out of walls, and its collider follows it
      if (st.mode === "ride" && input.prevMount) { const p0 = input.prevMount, want = v3(M.x - p0.x, 0, M.z - p0.z); dkBody.setTranslation(v3(p0.x, (M.y || 0) + 1, p0.z), true); dkCtrl.computeColliderMovement(dkCol, want, R.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, c2 => c2 !== texCol);
        const mv = dkCtrl.computedMovement(), blocked = Math.hypot(want.x - mv.x, want.z - mv.z); M.x = p0.x + mv.x; M.z = p0.z + mv.z;
        if (blocked > .02 && Math.abs(M.speed) > 5.5) { fall("tex", { x: Math.sin(M.heading) * 40, y: 18, z: Math.cos(M.heading) * 40 }); M.speed = 0; say("The donkey stops dead at the wall. Tex does not."); } else if (blocked > .02) M.speed *= .5; }
      dkBody.setNextKinematicTranslation(v3(M.x, (M.y || 0) + 1, M.z));
      // Tex on foot
      if (st.mode === "foot") {
        const fwd = st.frozen ? 0 : input.throttle, turn = st.frozen ? 0 : input.steer, run = input.run;
        if (st.aimO) { st.heading = Math.atan2(st.aimO.aim.x, st.aimO.aim.z); st.recoil = Math.max(st.recoil, st.aimO.recoil || 0); }
        st.heading += turn * dt * (run ? 2.2 : 2.6);
        const speed = fwd * (fwd > 0 ? (run ? 4.2 : 1.55) : .9), dx = Math.sin(st.heading) * speed * dt, dz = Math.cos(st.heading) * speed * dt;
        st.vy = ctrl.computedGrounded() ? -1 : st.vy - 9.81 * dt;
        texBody.setTranslation(v3(st.x, st.y + .85, st.z), true); ctrl.computeColliderMovement(texCol, v3(dx, st.vy * dt, dz), undefined, undefined, c2 => c2 !== dkCol);
        const mv = ctrl.computedMovement(); st.x += mv.x; st.y += mv.y; st.z += mv.z; if (ctrl.computedGrounded()) st.vy = 0;
        const hg = heightAt(st.x, st.z); if (st.y < hg - 2) st.y = hg;   // never under the world
        const moved = Math.hypot(mv.x, mv.z); st.gait += moved / 1.35 * Math.PI * 2; st.speed = moved / Math.max(dt, 1e-3);
        if (moved > .001 && Math.floor(st.gait / Math.PI) !== st.step) { st.step = Math.floor(st.gait / Math.PI); S.step(texPos(), run, st.inside); }
        if (st.smoking) { st.smokeT += dt; const cyc = st.smokeT % 6; st.puff = cyc < 1.6 ? Math.sin(cyc / 1.6 * Math.PI) : 0; if (cyc > 1.6 && cyc - dt <= 1.6) exhale(); cig.userData.ember.material.color.setRGB(1, .35 + st.puff * .5, .1 + st.puff * .3); cig.userData.ember.scale.setScalar(1 + st.puff); }
        st.raise = lerp(st.raise, st.gun ? 1 : 0, 1 - Math.exp(-dt * 8));
        placeTex();
        const pose = st.gun ? "aim" : st.smoking ? "smoke" : st.speed > .25 ? "walk" : "idle";
        tex.update(dt, clock, { pose, gaitPhase: st.gait, walkRate: run ? 7 : 4.6, recoil: st.recoil, raise: st.raise, puff: st.puff, lodDist: 3 });
      } else if (st.mode === "krar") { placeTex(); tex.update(dt, clock, { pose: "krar", pluck: st.pluck, fret: (st.notes % 3) / 2, lodDist: 3 }); }
      else if (st.mode === "lift") { const L = st.lift; L.t += dt / 7; st.y = lerp(L.from, L.to, smooth(0, 1, L.t)); const STN = W.station; st.x = STN.liftX; st.z = STN.liftZ; STN.lift.position.y = st.y + .1; placeTex(); tex.update(dt, clock, { pose: "idle", lodDist: 3 });
        if (L.t >= 1) { st.mode = "foot"; if (L.to > L.from) { st.x = STN.liftX + 2.2; st.z = STN.z + 1.4; st.y = STN.deck; } } }
      else if (st.mode === "train") { const tr = W.train; tr.updateMatrixWorld(true); const car = tr.children[st.train.car], p = new T.Vector3(); car.getWorldPosition(p); st.x = p.x; st.y = p.y - 1.25; st.z = p.z; st.heading = Math.PI / 2; placeTex(); tex.update(dt, clock, { pose: "seatedWatch", seated: true, lodDist: 3 }); }
      else if (st.mode === "ragdoll") { st.ragT += dt; }
      // physics, at a fixed 60 Hz
      acc = Math.min(acc + dt, .1); while (acc >= 1 / 60) { world.step(); acc -= 1 / 60; fstep++; }
      for (const p of props) { const t = p.body.translation(), r = p.body.rotation(); p.mesh.position.set(t.x, t.y, t.z); p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
        if (!p.down && (p.kind === "bottle" || p.kind === "can") && (t.y < W.range.y - .3 || Math.hypot(t.x - p.home.x, t.z - p.home.z) > .6)) { p.down = true; if (p.kind === "bottle") S.glass(p.mesh.position, .5); } }
      if (props.filter(p => p.kind === "bottle" || p.kind === "can").every(p => p.down)) done("bottles");
      // ragdolls: Tex and the settlers. When the body is still, they get up.
      if (st.rag) { st.rag.apply(); if (st.ragT > 2.2 && (st.rag.speed() < .35 || st.ragT > 6)) { const pt = st.rag.parts.pelvis.body.translation(); st.rag.dispose(); st.rag = null; st.x = pt.x; st.z = pt.z; st.y = heightAt(pt.x, pt.z); texCol.setEnabled(true); st.mode = "foot"; say("Tex gets up and beats the dust out of his shamma."); } }
      for (const n of npcs) { if (n.rag) { n.ragT += dt; n.rag.apply(); if (n.ragT > 4 && (n.rag.speed() < .35 || n.ragT > 8)) { n.rag.dispose(); n.rag = null; n.col.setEnabled(true); n.p.ragging = false; if (say) say((n.ch.state.name || "A settler") + " gets up, slowly, and stares at Tex."); } }
        else { const g = n.ch.group.position; n.body.setNextKinematicTranslation(v3(g.x, g.y + .85, g.z)); } }
      // effects
      flash.intensity = Math.max(0, flash.intensity - dt * 60); flashSprite.material.opacity = Math.max(0, flashSprite.material.opacity - dt * 14); if (flashSprite.material.opacity <= 0) flashSprite.visible = false;
      for (const d of dust) { if (d.t > 1.2) { d.s.visible = false; continue; } d.t += dt; d.s.material.opacity = .7 * (1 - d.t / 1.2); d.s.scale.setScalar(.3 + d.t * 1.6); d.s.position.y += dt * .4; }
      for (const p of puffs) { if (p.t > 3) { p.s.visible = false; continue; } p.t += dt; p.s.position.y += dt * .35; p.s.position.x += dt * .12; p.s.material.opacity = .45 * (1 - p.t / 3); p.s.scale.setScalar(.12 + p.t * .45); }
      // batwing doors swing when someone passes
      for (const d of SAL.doors) { const wp = new T.Vector3(); d.hinge.getWorldPosition(wp); const who = [texPos(), mount.state].some(q => Math.hypot(q.x - wp.x, q.z - wp.z) < 1.4); d.v += ((who ? 1.15 : 0) - d.a) * dt * 18 - d.v * dt * 5; d.a += d.v * dt; d.hinge.rotation.y = d.sx * d.a; if (who && Math.abs(d.v) > 2 && !d.creak) { d.creak = 1; S.creak(wp); } if (!who) d.creak = 0; }
      // inside the saloon? (sound changes, lamps light, the camera comes close)
      const P = st.mode === "ride" ? { x: M.x, z: M.z } : texPos(); st.inside = pointIn(P, SAL.room);
      for (const L of SAL.lamps) L.intensity = lerp(L.intensity, L.isHemisphereLight ? (st.inside ? .9 : 0) : st.inside ? 9 : 1.2, 1 - Math.exp(-dt * 3));
      // the storm, as an event
      if (W.STORM.phase !== lastStorm) { if (W.STORM.phase === "coming") ev("storm"); if (W.STORM.phase === "clear" && lastStorm === "clearing") done("storm"); lastStorm = W.STORM.phase; }
      for (; seen < st.events.length; seen++) evs.push(st.events[seen]);   // everything since the last frame, including what a click or a key did between frames
      if (st.events.length > 200) { const cut = st.events.length - 200; st.events.splice(0, cut); seen -= cut; }
      // sound
      S.update(dt, { inside: st.inside, storm: W.STORM.phase === "inside" ? 1 : W.STORM.phase === "coming" ? .4 : W.STORM.phase === "clearing" ? .5 : 0, saloon: SAL, church: W.landmarks.church, train: W.future.visible ? W.train : null, onTrain: st.mode === "train" });
      st.label = (offer() || {}).label || "";
      const focus = st.mode === "ride" ? { x: M.x, y: M.y || 0, z: M.z, heading: M.heading, speed: Math.abs(M.speed), headY: 2.55 } : st.mode === "ragdoll" && st.rag ? (() => { const t = st.rag.parts.chest.body.translation(); return { x: t.x, y: t.y - 1, z: t.z, heading: st.heading, speed: 0, headY: 1.1 }; })() : { x: st.x, y: st.y, z: st.z, heading: st.heading, speed: st.speed || 0, headY: st.mode === "train" ? 1.3 : 1.62 };
      const modeCam = st.mode === "krar" ? { pos: new T.Vector3(SAL.bar.x, SAL.y0 + 1.75, SAL.bar.z), look: new T.Vector3(st.x, st.y + 1.1, st.z), fov: 44 }   // from the bar, across the room to the stage
        : st.mode === "train" ? (() => { const p = new T.Vector3(st.x, st.y + 1.2, st.z); return { pos: new T.Vector3(p.x - 10, p.y + 2.5, p.z + 15), look: p.clone().add(new T.Vector3(6, 0, 0)), fov: 46 }; })()   // tracking alongside the car, over the canyon
        : null;
      const cam = (st.gameCam && st.gameCam()) || director(dt, focus, evs) || modeCam || (st.inside ? (() => { const f = new T.Vector3(Math.sin(focus.heading), 0, Math.cos(focus.heading)), look = new T.Vector3(focus.x, focus.y + 1.45, focus.z).addScaledVector(f, 2); return { pos: avoid(new T.Vector3(focus.x, focus.y + 1.6, focus.z), new T.Vector3(focus.x, focus.y + 2.1, focus.z).addScaledVector(f, -3.2)), look, fov: 58 }; })() : null);
      return { mode: st.mode, focus, cam, events: evs };
    }
    function exhale() { const h = new T.Vector3(); tex.bones[7].getWorldPosition(h); h.add(new T.Vector3(Math.sin(st.heading) * .15, 0, Math.cos(st.heading) * .15)); for (let k = 0; k < 4; k++) { const p = puffs.find(x => x.t > 3) || puffs[0]; p.t = -k * .15; p.s.visible = true; p.s.position.copy(h).add(new T.Vector3((Math.random() - .5) * .05, 0, (Math.random() - .5) * .05)); } S.exhale(h); }
    function pointIn(p, poly) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > p.z) !== (zj > p.z) && p.x < (xj - xi) * (p.z - zi) / (zj - zi) + xi) ins = !ins; } return ins; }

    // ================= input =================
    const doIt = () => { const o = offer(); if (o && o.verb) act(o.verb); };
    addEventListener("keydown", e => { if (e.repeat || (GG && GG.running)) return; const k = e.key.toLowerCase(); S.resume();
      if (k === "e") doIt(); else if (k === "r") draw(); else if (k === " " ) { if (st.gun) { fire(); ev("shot"); } } else if (k === "x") smoke(); else if (k === "z") fall("tex");
      else if (k >= "1" && k <= "6") pluck(+k - 1); else if (k === "v") setCinema(!DIR.on); });
    addEventListener("pointerdown", () => S.resume(), { passive: true });
    c.canvas.addEventListener("pointerdown", e => { S.resume(); if (e.pointerType === "mouse" && e.button === 0 && st.gun && !(GG && GG.running)) { fire(); ev("shot"); } });
    function setCinema(on) { DIR.on = on; DIR.until = 0; if (c.onCinema) c.onCinema(on); }
    return { W, world, R, st, goals, props, npcs, step, act, offer, draw, fire: () => { fire(); ev("shot"); }, smoke, fall, pluck, record, setCinema, DIR, S, REC, hfLayout: c.hfLayout };
  }

  // ================= the sound of the place =================
  async function makeSound(T, camera) {
    let ctx = null, master, out, outdoor, indoor, dryO, buffers = {}, sprites = {}, man = null, loops = {}, streamDest = null; const pend = [];
    const S = { ready: false, resume() { if (!ctx) init(); else if (ctx.state !== "running") ctx.resume(); } };
    function ir(sec, echoes, decay) { const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) { const t = i / ctx.sampleRate; let v = (Math.random() * 2 - 1) * Math.exp(-t * decay) * .4; for (const [at, g] of echoes) { const dt = t - at - ch * .007; if (dt > 0 && dt < .09) v += (Math.random() * 2 - 1) * g * Math.exp(-dt * 40); } d[i] = v; } } return b; }
    function init() {
      ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createDynamicsCompressor(); master.threshold.value = -14; master.ratio.value = 4; out = ctx.createGain(); out.gain.value = .9; master.connect(out); out.connect(ctx.destination);
      streamDest = ctx.createMediaStreamDestination ? ctx.createMediaStreamDestination() : null; if (streamDest) out.connect(streamDest);
      outdoor = ctx.createConvolver(); outdoor.buffer = ir(3.2, [[.28, .5], [.61, .38], [1.05, .26], [1.6, .14]], 2.2); const og = ctx.createGain(); og.gain.value = .55; outdoor.connect(og); og.connect(master);   // the mesas answer
      indoor = ctx.createConvolver(); indoor.buffer = ir(.9, [[.012, .3], [.027, .25]], 7); const ig = ctx.createGain(); ig.gain.value = .5; indoor.connect(ig); ig.connect(master);
      S.ready = true; load().then(startBeds); for (const f of pend.splice(0)) f();
    }
    async function load() { try { man = await (await fetch(SOUND + "manifest.json")).json(); sprites = man.sprites || {};
      const want = ["wind_plain", "wind_gusts", "hoof", "hoof_hard", "dirt", "dirt_run", "stone", "cloth", "bray_village", "music_azmaribeit", "chant_lalibela", "fill_plastic"];
      await Promise.all(want.filter(k => man.files[k]).map(async k => { try { const ab = await (await fetch(SOUND + man.files[k].file)).arrayBuffer(); buffers[k] = await ctx.decodeAudioData(ab); S.loaded = (S.loaded || 0) + 1; } catch (e) { S.err = String(e); console.warn("sound", k, e); } })); } catch (e) { console.warn("sound manifest", e); } }
    const panner = (p, ref = 3, roll = 1.2) => { const pn = ctx.createPanner(); pn.panningModel = "HRTF"; pn.distanceModel = "inverse"; pn.refDistance = ref; pn.rolloffFactor = roll; pn.maxDistance = 600; if (p) { pn.positionX.value = p.x; pn.positionY.value = (p.y || 0) + 1; pn.positionZ.value = p.z; } return pn; };
    function send(node, wet = .35, room = false) { const g = ctx.createGain(); g.gain.value = 1; node.connect(g); g.connect(master); const w = ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(room ? indoor : outdoor); return g; }
    function loop(key, gain, p, ref) { const b = buffers[key]; if (!b) return null; const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 20000; const g = ctx.createGain(); g.gain.value = gain; s.connect(lp); lp.connect(g);
      let node = g; if (p) { const pn = panner(p, ref || 6, 1); g.connect(pn); node = pn; } send(node, .25); s.start(0, Math.random() * Math.max(0, b.duration - 1)); return { s, g, lp }; }
    function startBeds() { loops.wind = loop("wind_plain", .32); loops.gust = loop("wind_gusts", 0); }
    function cut(key, p, gain = 1, rate = 1, room = false) { const b = buffers[key], sp = sprites[key]; if (!ctx || !b) return; const cuts = sp && sp.cuts; const [t0, du] = cuts ? cuts[Math.floor(Math.random() * cuts.length)] : [0, Math.min(b.duration, 1)];
      const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate * (.94 + Math.random() * .12); const g = ctx.createGain(); g.gain.value = gain; s.connect(g); const pn = panner(p, 2.5, 1.4); g.connect(pn); send(pn, room ? .45 : .18, room); s.start(0, t0, du + .05); }
    function noise(sec) { const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
    function burst(p, { sec = .2, type = "lowpass", f = 1000, q = .7, gain = 1, attack = .002, decay = .15, wet = .4, room = false, ref = 3 } = {}) {
      const s = ctx.createBufferSource(); s.buffer = noise(sec + .05); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(), t = ctx.currentTime;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(.0005, t + attack + decay); s.connect(fl); fl.connect(g); const pn = panner(p, ref, 1.1); g.connect(pn); send(pn, wet, room); s.start(t); s.stop(t + sec + .1); return fl; }
    function tone(p, f0, f1, sec, gain, type = "sine", wet = .3, room = false) { const o = ctx.createOscillator(); o.type = type; const g = ctx.createGain(), t = ctx.currentTime; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + sec);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0005, t + sec); o.connect(g); const pn = panner(p, 3, 1.1); g.connect(pn); send(pn, wet, room); o.start(t); o.stop(t + sec + .05); }
    const go = f => { if (ctx && S.ready) f(); };
    S.gunshot = (p, inside) => go(() => { burst(p, { sec: .03, type: "highpass", f: 1800, gain: 1.4, decay: .025, wet: inside ? .7 : .9, room: inside, ref: 6 }); burst(p, { sec: .35, type: "lowpass", f: 1200, gain: 1.1, decay: .3, wet: inside ? .7 : 1, room: inside, ref: 6 }); tone(p, 140, 38, .18, 1.2, "sine", .6, inside); });
    S.ricochet = p => go(() => { tone(p, 3200, 900, .35, .25, "triangle", .5); burst(p, { sec: .08, type: "bandpass", f: 2500, q: 2, gain: .4, decay: .07 }); });
    S.glass = (p, k = 1) => go(() => { burst(p, { sec: .12, type: "highpass", f: 3000, gain: .7 * k, decay: .1 }); for (let i = 0; i < 5; i++) setTimeout(() => tone(p, 2400 + Math.random() * 3800, 2000, .18 + Math.random() * .2, .12 * k, "sine", .3), i * 25 + Math.random() * 40); });
    S.tin = p => go(() => { tone(p, 1180, 1150, .4, .35, "sine", .35); tone(p, 2710, 2690, .25, .2, "sine", .35); burst(p, { sec: .04, type: "bandpass", f: 3000, q: 1.5, gain: .3, decay: .03 }); });
    S.thud = p => go(() => { tone(p, 90, 40, .25, .9, "sine", .25); burst(p, { sec: .15, type: "lowpass", f: 400, gain: .8, decay: .12 }); cut("cloth", p, .7); });
    S.match = p => go(() => { burst(p, { sec: .12, type: "bandpass", f: 3500, q: 1.4, gain: .45, decay: .1, wet: .15 }); setTimeout(() => burst(p, { sec: .5, type: "lowpass", f: 700, gain: .35, attack: .05, decay: .4, wet: .1 }), 120); });
    S.exhale = p => go(() => burst(p, { sec: 1.2, type: "bandpass", f: 900, q: .5, gain: .12, attack: .15, decay: .9, wet: .1 }));
    S.creak = p => go(() => { tone(p, 260, 190, .35, .12, "sawtooth", .3, true); });
    S.cloth = p => go(() => cut("cloth", p, .8));
    S.pour = p => go(() => cut("fill_plastic", p, .9));
    S.lift = () => go(() => tone(camera.position, 110, 140, 6.5, .08, "sawtooth", .2));
    S.chime = () => go(() => { const p = camera.position; [659, 523, 392].forEach((f, i) => setTimeout(() => tone(p, f, f, .9, .2, "sine", .4), i * 220)); });
    S.step = (p, run, inside) => go(() => cut(inside ? "stone" : run ? "dirt_run" : "dirt", p, inside ? .5 : .7, 1, inside));
    S.hoof = (p, gait) => go(() => cut(gait > .5 ? "hoof_hard" : "hoof", p, .55 + gait * .3));
    S.bray = p => go(() => cut("bray_village", p, .8));
    // the krar: plucked strings (Karplus-Strong), the Tezeta scale on G
    const KRAR = [196, 220, 246.94, 293.66, 329.63, 392], kb = [];
    S.krar = (k, p) => go(() => { if (!kb[k]) { const sr = ctx.sampleRate, n = Math.floor(sr * 2.6), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), N = Math.round(sr / KRAR[k]), ring = new Float32Array(N); for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1; let q = 0; for (let i = 0; i < n; i++) { const a = ring[q], nx = ring[(q + 1) % N]; ring[q] = .4985 * (a + nx); d[i] = a * (i < 40 ? 1.4 : 1); q = (q + 1) % N; } kb[k] = b; }
      const s = ctx.createBufferSource(); s.buffer = kb[k]; const body = ctx.createBiquadFilter(); body.type = "peaking"; body.frequency.value = 420; body.gain.value = 6; body.Q.value = 1.2; const g = ctx.createGain(); g.gain.value = .55; s.connect(body); body.connect(g); const pn = panner(p, 3, 1); g.connect(pn); send(pn, .5, true); s.start(); });
    const _f = new T.Vector3(), _u = new T.Vector3();
    let trainHum = null, sal = null, chant = null;
    S.update = (dt, o) => { if (!ctx || !S.ready) return; const L = ctx.listener, cp = camera.position; camera.getWorldDirection(_f); _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
      if (L.positionX) { L.positionX.value = cp.x; L.positionY.value = cp.y; L.positionZ.value = cp.z; L.forwardX.value = _f.x; L.forwardY.value = _f.y; L.forwardZ.value = _f.z; L.upX.value = _u.x; L.upY.value = _u.y; L.upZ.value = _u.z; } else { L.setPosition(cp.x, cp.y, cp.z); L.setOrientation(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z); }
      if (loops.wind) loops.wind.g.gain.value = lerp(loops.wind.g.gain.value, o.inside ? .05 : .3, .05); if (loops.gust) loops.gust.g.gain.value = lerp(loops.gust.g.gain.value, o.storm * .9, .03);
      if (!sal && buffers.music_azmaribeit && o.saloon) { const c0 = o.saloon.room.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]); sal = loop("music_azmaribeit", .7, { x: c0[0], y: o.saloon.y0, z: c0[1] }, 4); }
      if (sal) { sal.lp.frequency.value = lerp(sal.lp.frequency.value, o.inside ? 16000 : 650, .08); sal.g.gain.value = lerp(sal.g.gain.value, o.inside ? .85 : .5, .05); }   // through the walls it is all bass
      if (!chant && buffers.chant_lalibela && o.church) chant = loop("chant_lalibela", .55, { x: o.church.x, y: -6, z: o.church.z }, 8);
      if (o.train && !trainHum) { const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 52; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260; const g = ctx.createGain(); g.gain.value = 0; osc.connect(lp); lp.connect(g); const pn = panner(null, 12, .8); g.connect(pn); send(pn, .3); osc.start(); trainHum = { osc, g, pn, last: 0 }; }
      if (trainHum && o.train) { o.train.updateMatrixWorld(true); const p = new T.Vector3(); o.train.children[2].getWorldPosition(p); trainHum.pn.positionX.value = p.x; trainHum.pn.positionY.value = p.y; trainHum.pn.positionZ.value = p.z; const moving = Math.abs(p.x - (trainHum.lx ?? p.x)) / Math.max(dt, 1e-3); trainHum.lx = p.x; trainHum.g.gain.value = lerp(trainHum.g.gain.value, clamp(moving / 25, 0, 1) * (o.onTrain ? .35 : .6), .1); }
    };
    S.stream = () => streamDest && streamDest.stream;
    S.debug = () => ({ loaded: S.loaded, err: S.err, man: !!man, state: ctx && ctx.state, ready: S.ready, buffers: Object.keys(buffers), loops: Object.keys(loops).concat(sal ? ['saloon'] : [], chant ? ['chant'] : []) });
    return S;
  }

  window.MarsWestern = { create };
})();
