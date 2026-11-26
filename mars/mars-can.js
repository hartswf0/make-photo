/* Ethiopia on Mars as a jerry can (can@1, adapter ground@1). See mars/can.json, mars/WESTERN.md and atlas/JERRYCAN.md.
   The trough brings the renderer, camera, light, the player and every way of moving (walk, ride, drive, fly, boat), its HUD (the rain
   surface) and its mini-games (atlas/glass-games.js); this brings the place, its people and the things you can do in it.

   The town stands at the centre of the mars island, on its own fine ground (holeGround + addHeights). Its verbs come up as the trough's
   one live offer: Take the draw (at the bottle rail), Play the krar (on the saloon's stage), Take the lift and Board the monorail (after
   the storm). The saloon plays a short scene the first time you walk in. The can brings its own physics (mars-physics.js) for its
   bottles, cans, barrels and chairs, and its own storm. */
(() => {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const BOX = [-300, -500, 300, 160], FADE = 70, MESH = [-450, -570, 450, 330];   // the town and its future (local metres); the fine ground's extent
  const HERE = document.currentScript ? new URL("./", document.currentScript.src).href : new URL("../mars/", location.href).href;
  const RAPIER = new URL("../highland-exposure/motion-lab/vendor/rapier.es.js", HERE).href;

  async function create(T, g) {
    const G0 = g.coarse || g.H, r = g.rect, C = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2], base = G0(C[0], C[1]) + .5;   // the trough's own tiles: the walking ground asks our heights first, so asking it back would loop
    const O = g.origin || [0, 0], M = window.MarsWorld, trough = (lx, lz) => G0(C[0] + lx, C[1] + lz);
    const Y = (lx, lz) => { const w = smooth(0, FADE, Math.min(lx - BOX[0], BOX[2] - lx, lz - BOX[1], BOX[3] - lz)); return w >= 1 ? base + M.heightAt(lx, lz) : w <= 0 ? trough(lx, lz) : trough(lx, lz) * (1 - w) + (base + M.heightAt(lx, lz)) * w; };
    const W = M.create(T, { Y, tune: g.tune });
    const root = new T.Group(); W.root.position.set(C[0], 0, C[1]); root.add(W.root);
    if (g.maxAnisotropy) root.traverse(o => { const m = o.material; if (m && m.map) m.map.anisotropy = g.maxAnisotropy; });
    const toWorld = (p, y) => new T.Vector3(p.x + C[0] + O[0], y, p.z + C[1] + O[1]), toLocal = p => ({ x: p.x - C[0] - O[0], y: p.y, z: p.z - C[1] - O[1] });
    const PH = await window.MarsPhysics.create(T, { W, Y, parent: W.root, rapierUrl: RAPIER }).catch(e => { console.warn("mars physics", e); return null; });

    // the dust pocket: two shells around the player. Things beyond them vanish into red dust; the rider and the ground near them stay readable.
    const dustMat = () => new T.MeshBasicMaterial({ color: 0xc98a62, side: T.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const far = new T.Mesh(new T.SphereGeometry(46, 24, 16), dustMat()), near = new T.Mesh(new T.SphereGeometry(24, 24, 16), dustMat());
    far.renderOrder = near.renderOrder = 20; far.frustumCulled = near.frustumCulled = false; far.visible = near.visible = false; root.add(far, near);

    // ---- where things are (local) ----
    const SAL = W.saloon, STN = W.station, RG = W.range, H = g.host || {};
    const along = (p, d) => ({ x: p.x - Math.sin(SAL.ry) * d, z: p.z - Math.cos(SAL.ry) * d });   // into the room from a point, away from the street
    const across = (p, d) => ({ x: p.x + Math.cos(SAL.ry) * d, z: p.z - Math.sin(SAL.ry) * d });   // across the room, from the bar's wall towards the stage's
    const stageFront = along(SAL.stage, -1.8);

    // ---- the lift and the platform: the walking ground follows them ----
    const DECK = { lift: null, on: false };
    const inTube = (x, z) => Math.hypot(x - STN.liftX, z - STN.liftZ) < 1.4, onPlat = (x, z) => x > STN.liftX - 1.5 && x < STN.x + 17 && z > STN.z - 1.6 && z < STN.z + 1.8;
    const heightAt = (lx, lz) => DECK.lift !== null && inTube(lx, lz) ? DECK.lift : DECK.on && onPlat(lx, lz) ? STN.deck : Y(lx, lz);

    // ---- scenes ----
    const W3 = (lx, ly, lz) => toWorld({ x: lx, z: lz }, ly);
    let seenSaloon = false, playing = false, riding = null;
    function saloonScene() {   // the first time you come in: the room, the music, the people, then you
      if (!g.cutscene) return; const st = SAL.stage, bar = SAL.bar, t0 = SAL.tables[1], y0 = SAL.y0;
      g.cutscene({ shots: [
        { pos: W3(SAL.inside.x, y0 + 2.6, SAL.inside.z), look: W3(st.x, y0 + 1.2, st.z), fov: 46, dur: 4.5, line: { name: "Yared", text: "Twin suns over the mines. The Empire takes the spice, but not our songs. This is our Tezeta." } },
        { pos: W3(along(bar, -1.2).x + .9, y0 + 1.7, along(bar, -1.2).z), look: W3(bar.x, y0 + 1.6, bar.z), fov: 32, dur: 4.5, line: { name: "Almaz", text: "You rode here to write your names in my dust, but this ground remembers our mother's songs. Listen." } },
        { pos: t => W3(t0.x + 2.2 - t * .25, y0 + 1.3, t0.z + 1.4), look: W3(t0.x, y0 + .9, t0.z), fov: 40, dur: 3.5, line: { name: "Girma", text: "Sit down, rider. The storm does not come in here." } }] });
    }
    function krarGame() {
      if (!g.play || playing) return; playing = true; const w = W3(stageFront.x, SAL.y0, stageFront.z);
      if (H.place) H.place(w.x, w.z, undefined, SAL.ry); if (H.clip) H.clip("guitar-playing");
      const k = W.makeKrar(); k.scale.setScalar(1.05); const off = H.hold ? H.hold(k, 4, [.02, -.1, .24], [-1.15, 0, .15]) : () => { };
      const cam = () => ({ pos: W3(SAL.bar.x, SAL.y0 + 1.8, SAL.bar.z), look: W3(stageFront.x, SAL.y0 + 1.25, stageFront.z), fov: 40 });
      g.play("krar", { cam, onNote: (ok, n, of) => { if (ok && n === 6 && g.speak) g.speak("Girma", "Listen to him."); } }).then(res => {
        playing = false; off(); if (H.clip) H.clip(null);
        if (res && g.speak) g.speak("Almaz", res.caught >= res.total * .7 ? "That was our mother's song. Stay as long as you like." : res.caught >= res.total * .35 ? "The krar knows you a little. Come back." : "Give it back to Yared before it forgets the tune."); });
    }
    function drawGame() {
      if (!g.play || playing) return; playing = true; const mid = { x: RG.x + 8.5, z: (RG.z0 + RG.z1) / 2 }, w = W3(mid.x, Y(mid.x, mid.z), mid.z);
      if (H.place) H.place(w.x, w.z, undefined, -Math.PI / 2);
      const eye = () => H.eye ? H.eye() : w.clone().add(new T.Vector3(0, 1.55, 0));
      const e0 = toLocal(eye()), pitch0 = Math.atan2(RG.y + .1 - e0.y, Math.abs(e0.x - RG.x));   // start aimed at the rail, not over it
      g.play("draw", { eye, muzzle: () => eye().add(new T.Vector3(0, -.2, 0)).addScaledVector(new T.Vector3(-1, 0, 0), .6), yaw0: -Math.PI / 2, pitch0, shots: 6,
        fire: dir => { if (!PH) return { hit: false }; const e = toLocal(eye());
          let best = null; for (const p of PH.props) { if (p.down || (p.kind !== "bottle" && p.kind !== "can")) continue; const t = p.body.translation(), v = new T.Vector3(t.x - e.x, t.y - e.y, t.z - e.z).normalize(), a = v.angleTo(dir); if (a < .06 && (!best || a < best.a)) best = { a, v }; }
          if (best) dir = best.v;   // a little help: within three degrees of a standing bottle, the shot finds it
          const r = PH.shoot(e, dir); return { hit: r.hit, what: r.what, point: r.point ? toWorld(r.point, r.point.y) : null }; } }).then(res => {
        playing = false; const left = PH ? PH.props.filter(p => (p.kind === "bottle" || p.kind === "can") && !p.down).length : 0;
        if (g.speak) g.speak("Tex Lexington", left === 0 ? "Not a bottle standing. The sun judges everything." : res && res.hits ? `${res.hits} for ${res.shots}. The sun judges everything.` : "The bottles are still laughing."); });
    }
    function liftRide(up) {
      if (!g.cutscene) return; const y0 = up ? Y(STN.liftX, STN.liftZ) : STN.deck, y1 = up ? STN.deck : Y(STN.liftX, STN.liftZ), t0 = performance.now(), w = W3(STN.liftX, y0, STN.liftZ);
      if (H.place) H.place(w.x, w.z, y0); DECK.lift = y0; DECK.on = false;
      const yAt = t => y0 + (y1 - y0) * smooth(0, 6, t);
      const tick = () => { const t = (performance.now() - t0) / 1000; DECK.lift = yAt(t); STN.lift.position.y = DECK.lift + .1; if (t < 6.2) requestAnimationFrame(tick); };
      tick();
      g.cutscene({ shots: [{ pos: t => W3(STN.liftX + 9, yAt(t) + 1.4, STN.liftZ + 7), look: t => W3(STN.liftX, yAt(t) + 1.2, STN.liftZ), fov: 44, dur: 6.2 }],
        done: () => { DECK.lift = null; DECK.on = up; const e = up ? W3(STN.liftX + 2.4, STN.deck, STN.z + 1.2) : W3(STN.liftX + 2.2, y1, STN.liftZ); if (H.place) H.place(e.x, e.z, up ? STN.deck : y1, Math.PI / 2); } });
    }
    function boardTrain() {
      if (!g.cutscene) return; riding = { car: 1 }; const carW = () => { W.train.updateMatrixWorld(true); const p = new T.Vector3(); W.train.children[1].getWorldPosition(p); return p; };
      g.cutscene({ shots: [
          { pos: t => carW().add(new T.Vector3(-12 + t * 1.5, 3, 16)), look: () => carW().add(new T.Vector3(6, 0, 0)), fov: 44, dur: 7, line: { name: "The monorail", text: "This rail belongs to the Three Highlands. The future rides with us." } },
          { pos: () => carW().add(new T.Vector3(30, 6, -10)), look: () => carW(), fov: 36, dur: 5 }],
        done: () => { riding = null; DECK.on = true; const e = W3(STN.x, STN.deck, STN.z + .6); if (H.place) H.place(e.x, e.z, STN.deck, Math.PI / 2); } });
    }

    // ---- the can's verbs, as the trough's one live offer ----
    const V = (p, label, when, run, rr) => ({ x: p.x + C[0], z: p.z + C[1], r: rr, label: typeof label === "function" ? label : () => label, when, run });
    const pl = () => H.player ? toLocal(H.player()) : { x: 0, y: 0, z: 0 };
    const verbs = [
      V({ x: RG.x + 8.5, z: (RG.z0 + RG.z1) / 2 }, "Take the draw", () => !playing, drawGame, 4),
      V(stageFront, "Play the krar", () => !playing, krarGame, 3),
      V({ x: STN.liftX, z: STN.liftZ }, () => DECK.on ? "Take the lift down" : "Take the lift up", () => W.future.visible && !playing, () => liftRide(!DECK.on), 2.4),
      V({ x: STN.x, z: STN.z }, "Board the monorail", () => W.future.visible && DECK.on && STN.docked && !riding, boardTrain, 12) ];
    // also from the deck: the lift down is offered where you stand at the top
    verbs.push(V({ x: STN.liftX + 2.4, z: STN.z + 1.2 }, "Take the lift down", () => W.future.visible && DECK.on && !playing, () => liftRide(false), 2.2));

    // the storm is triggered by where the player rides, as the legos variant says (setState)
    let state = "frontier", triggerZ = -95, line = "", lastLine = "";
    const setState = s => { state = s; if (s === "future") W.setFuture(true); if (s === "storm") triggerZ = 120; };
    const at = p => ({ x: p.x - C[0], z: p.z - C[1], y: p.y });   // can frame -> local
    const pointIn = (p, poly) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > p.z) !== (zj > p.z) && p.x < (xj - xi) * (p.z - zi) / (zj - zi) + xi) ins = !ins; } return ins; };
    const live = {
      root, landmarks: {}, verbs, blockers: W.blockers.map(pl2 => pl2.map(([x, z]) => [x + C[0], z + C[1]])),
      heights: { rect: [MESH[0] + C[0], MESH[1] + C[1], MESH[2] + C[0], MESH[3] + C[1]], at: (x, z) => heightAt(x - C[0], z - C[1]) },
      farRect: [MESH[0] + C[0], MESH[1] + C[1], MESH[2] + C[0], MESH[3] + C[1]],
      room: { id: "tezeta-saloon", pts: SAL.room.map(([x, z]) => [x + C[0], z + C[1]]) },   // the trough's interior service: inside, the rain leaves the glass and the street goes quiet
      setState, world: W, physics: PH, deck: DECK,
      get line() { return line; },
      update(dt, t, plc) {
        const p = plc ? at(plc) : null;
        if (p && state !== "future" && W.STORM.phase === "far" && Math.abs(p.x) < 60 && p.z < triggerZ && p.z > -260) W.callStorm();   // ride far enough up the street and the storm comes for you
        const S = W.update(dt, t, p || { x: 0, z: 0 }); line = S.line;
        for (const [m, k] of [[far, .9], [near, .45]]) { m.visible = S.amount > .01; m.material.opacity = S.amount * k; if (plc) m.position.set(plc.x, (plc.y || base) + 2, plc.z); }
        if (line !== lastLine) { lastLine = line; if (g.say && line) g.say(line); }
        if (PH) PH.step(dt, p && { x: p.x, y: p.y || Y(p.x, p.z), z: p.z }, W.future.visible);
        if (p && !seenSaloon && pointIn(p, SAL.room)) { seenSaloon = true; saloonScene(); }   // the first time through the batwing doors
        for (const d of SAL.doors) { const wp = new T.Vector3(); d.hinge.getWorldPosition(wp); const near2 = p && Math.hypot(p.x + C[0] + O[0] - wp.x, p.z + C[1] + O[1] - wp.z) < 1.5; d.v += ((near2 ? 1.15 : 0) - d.a) * dt * 18 - d.v * dt * 5; d.a += d.v * dt; d.hinge.rotation.y = d.sx * d.a; }
        for (const L of SAL.lamps) L.intensity = L.isHemisphereLight ? (p && pointIn(p, SAL.room) ? .9 : 0) : p && pointIn(p, SAL.room) ? 9 : 3;
      },
      dispose() { if (PH) PH.dispose(); W.dispose(); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    };
    for (const [k, v] of Object.entries(W.landmarks)) live.landmarks[k] = { x: v.x + C[0], z: v.z + C[1] };
    const L2 = (k, p) => live.landmarks[k] = { x: p.x + C[0], z: p.z + C[1] };
    L2("telegraph", { x: 12, z: -59 }); L2("bar", across(SAL.bar, .2)); L2("barback", across(SAL.bar, -1.7)); L2("stage", SAL.stage); L2("stagefront", stageFront);
    SAL.tables.forEach((tb, i) => L2("table" + i, tb)); L2("dance", along(SAL.stage, -3.4)); L2("door", SAL.inside);
    window.__marsCan = live;   // for checks
    return live;
  }
  window.MarsCan = { create };
})();
