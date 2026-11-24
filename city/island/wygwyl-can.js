// WYGWYL as a jerry can (see atlas/JERRYCAN.md). It brings only what lives on the island: the six real places' buildings, streets
// and trees; the Severn Pilot (a building you can open and walk into: the first portal); and the sound of the harbour and the parks.
// It owns no renderer, camera, loop, player, HUD or storage. The trough gives it ground (heights at true scale, island-corner metres)
// and takes back blockers (walls), interiors (rooms), sounds and landmarks.
(() => {
  const BASE = new URL('./', document.currentScript.src).href;
  const PAL = ['#b69784', '#cfc6b8', '#c8a78c', '#8e9aa8'];
  const inside = (pts, x, z) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };

  async function create(T, g) {   // g: { H(x, z) ground at island-corner metres }
    const get = f => fetch(BASE + 'data/' + f + '.json').then(r => r.json());
    const [blds, roads, trees, meta, sets] = await Promise.all(['buildings', 'roads', 'trees', 'meta', 'sets'].map(get));
    const root = new T.Group(); root.name = 'WYGWYL';
    const sev = sets.sets.find(s => s.num === '01'), SX = sev.x, SZ = sev.y;
    // ---------- buildings: walls and flat roofs, merged per kilometre cell so the trough can cull them; footprints become blockers ----------
    const cells = new Map(), blockers = [], col = new T.Color();
    for (let bi = 0; bi < blds.length; bi++) { const b = blds[bi], pts = []; for (let k = 2; k < b.length; k += 2) pts.push([b[k], b[k + 1]]);
      if (pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop(); if (pts.length < 3) continue;
      let cx = 0, cz = 0; for (const p of pts) { cx += p[0]; cz += p[1]; } cx /= pts.length; cz /= pts.length; if (Math.hypot(cx - SX, cz - SZ) < 34) continue;   // the Severn is built by hand below
      let base = Infinity; for (const p of pts) base = Math.min(base, g.H(p[0], p[1])); if (base < .6) continue;
      let area = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; } if (area < 0) pts.reverse();
      const key = Math.floor(cx / 1200) + '_' + Math.floor(cz / 1200); let c = cells.get(key); if (!c) cells.set(key, c = { P: [], C: [] });
      col.set(PAL[b[1] % 4]).offsetHSL(((bi % 17) - 8) * .004, 0, ((bi % 11) - 5) * .014); const top = base + b[0], bot = base - 2, rc = col.clone().multiplyScalar(.62);
      const tri = (a, b_, c_, k) => { c.P.push(...a, ...b_, ...c_); for (let n = 0; n < 3; n++) c.C.push(k.r, k.g, k.b); };
      for (let i = 0; i < pts.length; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length]; tri([x0, bot, z0], [x1, top, z1], [x1, bot, z1], col); tri([x0, bot, z0], [x0, top, z0], [x1, top, z1], col); }
      const tris = T.ShapeUtils.triangulateShape(pts.map(p => new T.Vector2(p[0], p[1])), []); for (const [a, b_, c_] of tris) tri([pts[a][0], top, pts[a][1]], [pts[c_][0], top, pts[c_][1]], [pts[b_][0], top, pts[b_][1]], rc);
      blockers.push(pts); }
    const wallMat = new T.MeshLambertMaterial({ vertexColors: true });
    for (const c of cells.values()) { const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(c.P, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(c.C, 3)); geo.computeVertexNormals(); geo.computeBoundingSphere(); root.add(new T.Mesh(geo, wallMat)); }
    // ---------- streets: flat asphalt ribbons laid on the ground ----------
    { const P = [], idx = []; const lay = (pts, w) => { const s = []; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 18)); for (let k = 0; k < n; k++) s.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); } s.push(pts[pts.length - 1]); if (s.length < 2) return;
        const b0 = P.length / 3; s.forEach((p, k) => { const a = s[Math.max(0, k - 1)], b = s[Math.min(s.length - 1, k + 1)], dx = b[1] - a[1], dz = -(b[0] - a[0]), L = Math.hypot(dx, dz) || 1, ox = dx / L * w / 2, oz = dz / L * w / 2, y = g.H(p[0], p[1]) + .12; P.push(p[0] + ox, y, p[1] + oz, p[0] - ox, y, p[1] - oz); if (k) { const q = b0 + (k - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } }); };
      for (const s of roads.streets) if (s.pts && s.pts.length > 1) lay(s.pts, Math.min(14, s.w || 7)); for (const h of roads.highways) if (h.pts) lay(h.pts, 12);
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      root.add(new T.Mesh(geo, new T.MeshLambertMaterial({ color: '#3b3d40', side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }))); }
    // ---------- street trees ----------
    { const ok = trees.filter(t => g.H(t[0], t[1]) > .8), crown = new T.SphereGeometry(1, 7, 5), trunk = new T.CylinderGeometry(.1, .16, 1, 5); crown.translate(0, 1.6, 0); trunk.translate(0, .5, 0);
      const C = new T.InstancedMesh(crown, new T.MeshLambertMaterial({ color: '#4d6b3a' }), ok.length), K = new T.InstancedMesh(trunk, new T.MeshLambertMaterial({ color: '#4a3826' }), ok.length), M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3(), V = new T.Vector3();
      ok.forEach(([x, z, h], k) => { const s = Math.max(2, h * .32); V.set(x, g.H(x, z), z); S.set(s, s, s); M.compose(V, Q, S); C.setMatrixAt(k, M); S.set(s * .7, h * .55, s * .7); M.compose(V, Q, S); K.setMatrixAt(k, M); }); root.add(C, K); }
    // ---------- the Severn Pilot: a brick shell with a door you can open, a lit vestibule and a room you can stand in ----------
    let near = null, nd = 1e9; for (const s of roads.streets) for (const p of s.pts || []) { const d = Math.hypot(p[0] - SX, p[1] - SZ); if (d > 14 && d < nd) { nd = d; near = p; } }
    const face = near ? Math.atan2(near[0] - SX, near[1] - SZ) : 0, fx = Math.sin(face), fz = Math.cos(face), rx = Math.cos(face), rz = -Math.sin(face);
    const W2 = 10, D2 = 6, HT = 9, GAP = .9, y0 = Math.max(g.H(SX, SZ), .6) + .05, at = (u, v) => [SX + rx * u + fx * v, SZ + rz * u + fz * v];
    const sev3 = new T.Group(); sev3.position.set(SX, y0, SZ); sev3.rotation.y = face; root.add(sev3);
    const brick = new T.MeshLambertMaterial({ color: '#8a4a36' }), trim = new T.MeshLambertMaterial({ color: '#d8d0c0' }), dark = new T.MeshLambertMaterial({ color: '#2a2420' });
    const box = (w, h, d, x, y, z, m) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); sev3.add(o); return o; };
    box(W2 * 2, HT, .4, 0, HT / 2, -D2, brick); box(.4, HT, D2 * 2, -W2, HT / 2, 0, brick); box(.4, HT, D2 * 2, W2, HT / 2, 0, brick);                       // back and sides
    box(W2 - GAP, HT, .4, -(W2 + GAP) / 2, HT / 2, D2, brick); box(W2 - GAP, HT, .4, (W2 + GAP) / 2, HT / 2, D2, brick); box(GAP * 2, HT - 2.6, .4, 0, 2.6 + (HT - 2.6) / 2, D2, brick);   // front, with a doorway
    box(W2 * 2 + .6, .4, D2 * 2 + .6, 0, HT, 0, trim); box(W2 * 2 - .2, .1, D2 * 2 - .2, 0, .05, 0, new T.MeshLambertMaterial({ color: '#6b5a48' }));     // roof cornice, floorboards
    box(2.2, .25, .5, 0, 2.75, D2 + .3, trim);
    for (const u of [-7, -4, 4, 7]) for (const h of [3.6, 6.4]) box(1.4, 1.8, .1, u, h, D2 + .22, dark);
    const doorPivot = new T.Group(); doorPivot.position.set(-GAP, 0, D2); sev3.add(doorPivot); const leaf = new T.Mesh(new T.BoxGeometry(GAP * 2, 2.5, .12), new T.MeshLambertMaterial({ color: '#5a2b1e' })); leaf.position.set(GAP, 1.25, 0); doorPivot.add(leaf);
    const lamp = new T.PointLight('#ffd9a0', 1.6, 18, 1.6); lamp.position.set(0, 3, 0); sev3.add(lamp); box(3, .5, .9, -5, .25, -4, dark);
    const wallPoly = (u0, v0, u1, v1) => [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
    const sevWalls = [wallPoly(-W2, -D2 - .3, W2, -D2 + .3), wallPoly(-W2 - .3, -D2, -W2 + .3, D2), wallPoly(W2 - .3, -D2, W2 + .3, D2), wallPoly(-W2, D2 - .3, -GAP, D2 + .3), wallPoly(GAP, D2 - .3, W2, D2 + .3)];
    const doorPoly = wallPoly(-GAP, D2 - .3, GAP, D2 + .3);
    let doorOpen = false, doorA = 0;
    const room = { id: 'severn', pts: [at(-W2 + .3, -D2 + .3), at(W2 - .3, -D2 + .3), at(W2 - .3, D2 - .3), at(-W2 + .3, D2 - .3)] };
    // ---------- the Inner Harbor salt line: the preposterous flood, if chance pours it ----------
    const harbor = meta.regions.flatMap(r => r.cores || []).find(c => c.key === 'inner-harbor');
    let flood = null; const setFlood = on => { if (on && !flood && harbor) { const y = g.H(harbor.x, harbor.y) + 4; flood = new T.Mesh(new T.CircleGeometry(harbor.r * 1.3, 48), new T.MeshPhongMaterial({ color: '#2e6f8e', transparent: true, opacity: .78, shininess: 80 })); flood.rotation.x = -Math.PI / 2; flood.position.set(harbor.x, y, harbor.y); root.add(flood); } else if (!on && flood) { root.remove(flood); flood = null; } };
    // ---------- landmarks the LEGOS graph names ----------
    const landmarks = { severnDoor: { x: at(0, D2 + 2)[0], z: at(0, D2 + 2)[1] }, severnRoom: { x: SX, z: SZ }, severnCurb: { x: at(0, D2 + 9)[0], z: at(0, D2 + 9)[1] } };
    for (const r of meta.regions) { landmarks[r.key] = { x: r.x, z: r.y, name: r.name }; for (const c of r.cores || []) landmarks[c.key] = { x: c.x, z: c.y, name: c.name, r: c.r }; }
    landmarks.hiwotHome = { x: 2394, z: 3388 }; landmarks.dawitHome = { x: 6706, z: 2268 }; landmarks.selamHome = { x: 6550, z: 3644 };
    return { root, landmarks, blockers, walls: sevWalls, door: doorPoly, room,
      get doorOpen() { return doorOpen; }, setDoor(o) { doorOpen = !!o; }, setFlood, inside,
      update(dt) { doorA += ((doorOpen ? -Math.PI * .58 : 0) - doorA) * Math.min(1, dt * 4); doorPivot.rotation.y = doorA; },
      dispose() { root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } };
  }
  window.WygwylCan = { create, inside };
})();
