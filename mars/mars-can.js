/* Ethiopia on Mars as a jerry can (can@1, adapter ground@1). See mars/can.json and atlas/JERRYCAN.md.
   The trough brings the renderer, camera, light, the player and every way of moving (walk, ride, drive, fly, boat); this brings the place.
   The town stands at the centre of the mars island. Its own fine ground (the street, the ruts, the rock church's pit) is laid over the
   trough's and blends into it at the edges; walking follows it (heights), the trough's tiles step aside beneath it (farRect), and the
   fronts, tukuls, stelae and domes are walls (blockers). The storm is the level's own: a wall of dust that comes up the street, and a
   dust pocket around the player that whites out the distance while the near ground stays readable, behind which the future appears. */
(() => {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const BOX = [-300, -500, 300, 160], FADE = 70, MESH = [-450, -570, 450, 330];   // the town and its future (local metres); the fine ground's extent

  function create(T, g) {
    const G0 = g.coarse || g.H, r = g.rect, C = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2], base = G0(C[0], C[1]) + .5;   // the trough's own tiles (coarse): the walking ground asks our heights first, so asking it back would loop   // the town at the island's centre, on its plateau
    const M = window.MarsWorld, trough = (lx, lz) => G0(C[0] + lx, C[1] + lz);
    const Y = (lx, lz) => { const w = smooth(0, FADE, Math.min(lx - BOX[0], BOX[2] - lx, lz - BOX[1], BOX[3] - lz)); return w >= 1 ? base + M.heightAt(lx, lz) : w <= 0 ? trough(lx, lz) : trough(lx, lz) * (1 - w) + (base + M.heightAt(lx, lz)) * w; };
    const W = M.create(T, { Y, tune: g.tune });
    const root = new T.Group(); W.root.position.set(C[0], 0, C[1]); root.add(W.root);
    if (g.maxAnisotropy) root.traverse(o => { const m = o.material; if (m && m.map) { m.map.anisotropy = g.maxAnisotropy; } });

    // the dust pocket: two shells around the player. Things beyond them vanish into red dust; the rider and the ground near them stay readable.
    const dustMat = (o) => new T.MeshBasicMaterial({ color: 0xc98a62, side: T.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const far = new T.Mesh(new T.SphereGeometry(46, 24, 16), dustMat()), near = new T.Mesh(new T.SphereGeometry(24, 24, 16), dustMat());
    far.renderOrder = near.renderOrder = 20; far.frustumCulled = near.frustumCulled = false; far.visible = near.visible = false; root.add(far, near);

    // the storm is triggered by where the player rides, as the legos variant says (setState)
    let state = "frontier", triggerZ = -95, line = "", lastLine = "";
    const setState = s => { state = s; if (s === "future") W.setFuture(true); if (s === "storm") triggerZ = 120; };
    const at = p => ({ x: p.x - C[0], z: p.z - C[1] });   // can frame -> local
    const live = {
      root, landmarks: {}, blockers: W.blockers.map(pl => pl.map(([x, z]) => [x + C[0], z + C[1]])),
      heights: { rect: [MESH[0] + C[0], MESH[1] + C[1], MESH[2] + C[0], MESH[3] + C[1]], at: (x, z) => Y(x - C[0], z - C[1]) },
      farRect: [MESH[0] + C[0], MESH[1] + C[1], MESH[2] + C[0], MESH[3] + C[1]],
      setState, world: W,
      get line() { return line; },
      update(dt, t, pl) {
        const p = pl ? at(pl) : null;
        if (p && state !== "future" && W.STORM.phase === "far" && Math.abs(p.x) < 60 && p.z < triggerZ && p.z > -260) W.callStorm();   // ride far enough up the street and the storm comes for you
        const S = W.update(dt, t, p || { x: 0, z: 0 }); line = S.line;
        for (const [m, k] of [[far, .9], [near, .45]]) { m.visible = S.amount > .01; m.material.opacity = S.amount * k; if (pl) m.position.set(pl.x, (pl.y || base) + 2, pl.z); }   // pl is in the can's frame, as root is
        if (line !== lastLine) { lastLine = line; if (g.say && line) g.say(line); }
      },
      dispose() { W.dispose(); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    };
    for (const [k, v] of Object.entries(W.landmarks)) live.landmarks[k] = { x: v.x + C[0], z: v.z + C[1] };
    live.landmarks.telegraph = { x: 12 + C[0], z: -59 + C[1] };
    window.__marsCan = live;   // for checks
    return live;
  }
  window.MarsCan = { create };
})();
