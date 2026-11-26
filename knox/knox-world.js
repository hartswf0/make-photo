/* Knoxville, compressed: the custodian's Sunday. A world with no renderer, camera, player or loop, so the standalone page and a
   jerry can can both use it, as mars-world.js does.

   Frame: metres, x east, z south (north is -z), y up. The real city is about 12 km from the Sunsphere to Holston Hills; here it is
   about 1.2 km, so distances are compressed about ten times. The landmarks are near their real sizes: the Sunsphere's tower is 81 m
   with a 23 m sphere, the stadium bowl about 240 x 180 m. Their order on the map is the real one, west to east:
   World's Fair Park and the Sunsphere, downtown, the stadium on the river, East Knoxville along Magnolia Avenue, the church, Holston
   Hills on the Holston River, and the forks where the Holston and the French Broad make the Tennessee.

   KnoxWorld.heightAt(x, z) -> ground height. KnoxWorld.create(T) -> { root, colliders, places, church, shed, golf, hq, sunsphere,
   water(x, z), update(dt, t) }. colliders: { type: "box"|"cyl", x, y, z, hx, hy, hz | r, hh, ry, tag }. */
(() => {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const frac = x => x - Math.floor(x), hash = (a, b = 0) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); };
  const fbm = (x, y, o = 4) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); f *= 2.03; a *= .5; } return s; };

  const BOUND = { x0: -720, x1: 720, z0: -460, z1: 460 };
  /* the rivers, as polylines with a half-width: the Tennessee along the south, the Holston from the north-east, the French Broad from the south-east */
  const RIVERS = [
    { name: "Tennessee River", w: 55, pts: [[-760, 330], [-520, 312], [-330, 300], [-150, 322], [40, 334], [210, 312], [330, 280]] },
    { name: "Holston River", w: 34, pts: [[330, 280], [410, 190], [470, 90], [560, 20], [650, -40], [760, -70]] },
    { name: "French Broad River", w: 30, pts: [[330, 280], [460, 330], [600, 360], [760, 372]] }
  ];
  const SEGS = []; for (const r of RIVERS) for (let i = 0; i < r.pts.length - 1; i++) SEGS.push({ a: r.pts[i], b: r.pts[i + 1], w: r.w, river: r.name });
  function riverDist(x, z) { let best = 1e9, w = 40, name = null;
    for (const s of SEGS) { const [ax, az] = s.a, [bx, bz] = s.b, dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t) - s.w;
      if (d < best) { best = d; w = s.w; name = s.river; } }
    return { d: best, w, name }; }
  /* flat pads where something was built: each blends into the land over its edge */
  const PADS = [
    { x: -470, z: 120, r: 110, e: 40, tag: "World's Fair Park" }, { x: -330, z: 215, r: 140, e: 30, tag: "stadium" }, { x: -280, z: 30, r: 150, e: 50, tag: "downtown" },
    { x: 120, z: -40, r: 60, e: 30, tag: "church" }, { x: 400, z: -160, r: 45, e: 30, tag: "clubhouse" }, { x: -210, z: -70, r: 45, e: 25, tag: "headquarters" }];
  function base(x, z) { const n = fbm(x / 210 + 3.1, z / 210 + 7.7, 4); let h = 8 + n * 14 + fbm(x / 60, z / 60, 2) * 2;
    h += smooth(-260, -440, z) * 34 * (.6 + .4 * fbm(x / 120, 2.2, 3)); /* the ridge along the north */
    if (x > 280 && x < 680 && z > -260 && z < 140) h = lerp(h, 12 + fbm(x / 70 + 9, z / 70, 3) * 7, smooth(280, 320, x) * smooth(680, 640, x) * smooth(-260, -220, z) * smooth(140, 100, z)); /* the course: long gentle rolls */
    return h; }
  const PADH = PADS.map(p => base(p.x, p.z));
  function heightAt(x, z) {
    let h = base(x, z);
    for (let i = 0; i < PADS.length; i++) { const p = PADS[i], d = Math.hypot(x - p.x, z - p.z); if (d < p.r + p.e) h = lerp(h, PADH[i], smooth(p.r + p.e, p.r, d)); }
    const rv = riverDist(x, z); h = lerp(h, -4.5, smooth(26, -6, rv.d)); /* banks fall to the water over about 30 m */
    return h; }
  const WATER_Y = -1.2;

  function create(T) {
    const root = new T.Group(), colliders = [], places = [];
    const M = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .85 }, o));
    const box = (w, h, d, m) => new T.Mesh(new T.BoxGeometry(w, h, d), m);
    const coll = (k) => { colliders.push(k); return k; };
    const solid = (x, z, w, h, d, ry, tag, y0) => { const y = (y0 ?? heightAt(x, z)); coll({ type: "box", x, y: y + h / 2, z, hx: w / 2, hy: h / 2, hz: d / 2, ry: ry || 0, tag }); return y; };
    const shadow = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

    /* ---------- the ground: vertex colours by what it is (lawn, course, bank, field, the ridge's woods) ---------- */
    { const W = BOUND.x1 - BOUND.x0, D = BOUND.z1 - BOUND.z0, nx = 360, nz = 230, g = new T.PlaneGeometry(W, D, nx, nz); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color();
      const grass = new T.Color("#6f8a3e"), autumn = new T.Color("#8a7a3a"), fair = new T.Color("#5f9a3c"), bank = new T.Color("#7a6a4e"), clay = new T.Color("#9a5a38"), wood = new T.Color("#5a5030");
      for (let i = 0; i < p.count; i++) { const x = p.getX(i) + (BOUND.x0 + BOUND.x1) / 2, z = p.getZ(i) + (BOUND.z0 + BOUND.z1) / 2; p.setX(i, x); p.setZ(i, z); const y = heightAt(x, z); p.setY(i, y);
        const n = fbm(x / 30, z / 30, 3), rv = riverDist(x, z);
        c.copy(grass).lerp(autumn, n * .7);
        if (x > 300 && x < 660 && z > -240 && z < 120) c.lerp(fair, .55);
        if (z < -300) c.lerp(wood, .6 * smooth(-300, -360, z));
        if (rv.d < 22) c.lerp(bank, smooth(22, 4, rv.d)); if (rv.d < 6) c.lerp(clay, .5);
        col.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute("color", new T.BufferAttribute(col, 3)); g.translate(-(BOUND.x0 + BOUND.x1) / 2 * 0, 0, 0); g.computeVertexNormals();
      const ground = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); ground.receiveShadow = true; ground.userData.cls = "ground"; root.add(ground); }

    /* ---------- the rivers: one water sheet at WATER_Y, shown only where the ground is below it ---------- */
    const waterMat = new T.MeshStandardMaterial({ color: 0x3f5a55, roughness: .15, metalness: .1, transparent: true, opacity: .92 });
    { const w = new T.Mesh(new T.PlaneGeometry(BOUND.x1 - BOUND.x0, BOUND.z1 - BOUND.z0, 1, 1), waterMat); w.rotation.x = -Math.PI / 2; w.position.y = WATER_Y; w.receiveShadow = true; root.add(w); }

    /* ---------- roads: Magnolia Avenue east to the church and the course, and the grid of East Knoxville ---------- */
    const asphalt = M(0x3a3b3d, { roughness: .95 }), line = M(0xe8d27a, { roughness: .8 });
    function road(x0, z0, x1, z1, w = 9) { const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), n = Math.max(2, Math.ceil(len / 12));
      const g = new T.PlaneGeometry(w, len, 1, n); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const lx = p.getX(i), lz = p.getZ(i), wx = (x0 + x1) / 2 + lx * Math.cos(a) + lz * Math.sin(a), wz = (z0 + z1) / 2 - lx * Math.sin(a) + lz * Math.cos(a); p.setXYZ(i, wx, heightAt(wx, wz) + .06, wz); }
      g.computeVertexNormals(); const m = new T.Mesh(g, asphalt); m.receiveShadow = true; root.add(m); }
    road(-420, 0, 330, 0, 12); /* Magnolia Avenue */
    for (const x of [-120, -40, 40, 200, 260]) road(x, -170, x, 160, 8);
    road(-130, -110, 290, -110, 8); road(-130, 100, 290, 100, 8); road(330, 0, 400, -150, 8); road(-250, -70, -250, 130, 10); road(-420, 60, -120, 60, 10);

    /* ---------- trees: late November, so mostly bare, a few oaks still rust and gold ---------- */
    { const N = 900, trunk = new T.InstancedMesh(new T.CylinderGeometry(.25, .4, 1, 6), M(0x4a3a2a), N), crown = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), M(0xffffff, { roughness: .9, flatShading: true }), N);
      const m4 = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), v = new T.Vector3(), cc = new T.Color(), cols = ["#8a4a22", "#b0702a", "#7a5a2a", "#6a6a30", "#9a3a1c", "#5a4a32"]; let k = 0;
      for (let i = 0; i < 4000 && k < N; i++) { const x = lerp(BOUND.x0, BOUND.x1, hash(i, 1)), z = lerp(BOUND.z0, BOUND.z1, hash(i, 2)), rv = riverDist(x, z);
        if (rv.d < 4) continue; const onCourse = x > 300 && x < 660 && z > -240 && z < 120, inPad = PADS.some(p => Math.hypot(x - p.x, z - p.z) < p.r * .9), onRoad = Math.abs(z) < 9 || [-120, -40, 40, 200, 260].some(r => Math.abs(x - r) < 7);
        const dense = (z < -280 ? .9 : rv.d < 40 ? .7 : onCourse ? .12 : .25); if (inPad || onRoad || hash(i, 3) > dense) continue;
        const y = heightAt(x, z), h = 7 + hash(i, 4) * 9; m4.compose(v.set(x, y + h * .3, z), q, s.set(1, h * .6, 1)); trunk.setMatrixAt(k, m4);
        m4.compose(v.set(x, y + h * .75, z), q, s.set(2.5 + hash(i, 5) * 2.5, 2.4 + hash(i, 6) * 2, 2.5 + hash(i, 7) * 2.5)); crown.setMatrixAt(k, m4); crown.setColorAt(k, cc.set(cols[Math.floor(hash(i, 8) * cols.length)])); k++; }
      trunk.count = crown.count = k; trunk.castShadow = crown.castShadow = true; root.add(trunk, crown); }

    /* ---------- East Knoxville: frame houses with porches along the grid ---------- */
    const HOUSE = ["#d9d2c2", "#a9b8a4", "#c9a77a", "#8fa3b5", "#e2c98f", "#b98a78", "#f0ece2"], roofM = M(0x3d3632, { roughness: .9 });
    function house(x, z, ry, i) { const g = new T.Group(), w = 7 + hash(i, 1) * 3, d = 9 + hash(i, 2) * 3, h = 3.2 + (hash(i, 3) > .6 ? 2.8 : 0), y = heightAt(x, z);
      const wall = box(w, h, d, M(HOUSE[i % HOUSE.length])); wall.position.y = h / 2; g.add(wall);
      const roof = new T.Mesh(new T.CylinderGeometry(.01, w * .62, 2.4, 4, 1), roofM); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, d / w); roof.position.y = h + 1.2; g.add(roof);
      const porch = box(w, .25, 2.4, M(0x8a8478)); porch.position.set(0, .5, d / 2 + 1.2); g.add(porch); const pr = box(w, .15, 2.6, roofM); pr.position.set(0, 2.9, d / 2 + 1.25); g.add(pr);
      for (const sx of [-w / 2 + .2, w / 2 - .2]) { const post = box(.18, 2.4, .18, M(0xf2efe6)); post.position.set(sx, 1.7, d / 2 + 2.3); g.add(post); }
      for (const sx of [-w / 4, w / 4]) { const win = box(1.1, 1.3, .05, M(0x1f2a33, { emissive: 0x302010, emissiveIntensity: .3 })); win.position.set(sx, h * .55, d / 2 + .03); g.add(win); }
      g.position.set(x, y, z); g.rotation.y = ry; root.add(shadow(g)); solid(x, z, w, h, d, ry, "house", y); }
    { let i = 0; for (const rx of [-120, -40, 40, 200, 260]) for (let z = -160; z <= 150; z += 22) for (const s of [-1, 1]) { const x = rx + s * 14, zz = z + 5;
        if (Math.abs(zz) < 16 || Math.abs(zz + 110) < 12 || Math.abs(zz - 100) < 12) continue; if (Math.hypot(x - 120, zz + 40) < 70) continue; if (x > 150 && x < 230 && zz > -130 && zz < 0) continue;
        if (hash(i, 9) > .82) { i++; continue; } house(x, zz, s > 0 ? -Math.PI / 2 : Math.PI / 2, i++); } }

    /* ---------- downtown: brick and glass blocks ---------- */
    const BRICK = ["#7a3e2c", "#8a5a44", "#6a4a3a", "#9a8a7a", "#5a6a7a"];
    for (let i = 0; i < 30; i++) { const x = -380 + (i % 6) * 34 + hash(i, 1) * 6, z = -30 + Math.floor(i / 6) * 34 + hash(i, 2) * 6; if (Math.hypot(x + 250, z - 40) < 18) continue; if (Math.abs(z - 60) < 10 || Math.abs(x + 250) < 9) continue;
      const w = 18 + hash(i, 3) * 8, d = 18 + hash(i, 4) * 8, h = 10 + hash(i, 5) * hash(i, 6) * 70, y = heightAt(x, z), glass = hash(i, 7) > .7;
      const b = box(w, h, d, M(glass ? 0x5d7488 : BRICK[i % BRICK.length], glass ? { metalness: .5, roughness: .25 } : {})); b.position.set(x, y + h / 2, z); root.add(shadow(b)); solid(x, z, w, h, d, 0, "downtown", y); }

    /* ---------- World's Fair Park: the Sunsphere, a hexagonal steel truss 81 m tall carrying a 23 m sphere of gold glass ---------- */
    const sunsphere = new T.Group(); { const x = -470, z = 120, y = heightAt(x, z), steel = M(0x6b7178, { metalness: .7, roughness: .35 }), H = 55, R = 6.5;   /* 55 m of truss and the 23 m sphere: 81 m to the top, as built */
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, c = new T.Mesh(new T.CylinderGeometry(.55, .7, H, 8), steel); c.position.set(Math.cos(a) * R, H / 2, Math.sin(a) * R); sunsphere.add(c);
        coll({ type: "cyl", x: x + Math.cos(a) * R, y: y + H / 2, z: z + Math.sin(a) * R, r: .8, hh: H / 2, tag: "Sunsphere" });
        const b = (k + 1) / 6 * Math.PI * 2; for (let lv = 0; lv < 7; lv++) { const y0 = 4 + lv * 7.2, p0 = new T.Vector3(Math.cos(a) * R, y0, Math.sin(a) * R), p1 = new T.Vector3(Math.cos(b) * R, y0 + 7.2, Math.sin(b) * R), mid = p0.clone().add(p1).multiplyScalar(.5), len = p0.distanceTo(p1);
          const br = new T.Mesh(new T.CylinderGeometry(.18, .18, len, 5), steel); br.position.copy(mid); br.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()); sunsphere.add(br);
          const ring = new T.Mesh(new T.CylinderGeometry(.14, .14, R, 4), steel); const q0 = new T.Vector3(Math.cos(a) * R, y0, Math.sin(a) * R), q1 = new T.Vector3(Math.cos(b) * R, y0, Math.sin(b) * R); ring.position.copy(q0.clone().add(q1).multiplyScalar(.5)); ring.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), q1.clone().sub(q0).normalize()); sunsphere.add(ring); } }
      const cage = new T.Mesh(new T.CylinderGeometry(R + .5, R - 1, 6, 6, 1, true), steel); cage.position.y = H + 1; sunsphere.add(cage);
      const ball = new T.Mesh(new T.SphereGeometry(11.5, 48, 32), new T.MeshStandardMaterial({ color: 0xe8b450, metalness: .35, roughness: .28, emissive: 0x7a4e12, emissiveIntensity: .55 })   /* gold glass without an environment map: mostly diffuse gold, lit a little from within */); ball.position.y = H + 15; sunsphere.add(ball);
      const seams = new T.Mesh(new T.SphereGeometry(11.6, 24, 16), new T.MeshBasicMaterial({ color: 0x3a2a10, wireframe: true, transparent: true, opacity: .25 })); seams.position.y = H + 15; sunsphere.add(seams);
      sunsphere.position.set(x, y, z); root.add(shadow(sunsphere)); sunsphere.userData.top = new T.Vector3(x, y + H + 15, z);
      const lawn = new T.Mesh(new T.CircleGeometry(60, 40), M(0x7a9a46)); lawn.rotation.x = -Math.PI / 2; lawn.position.set(x + 40, y + .05, z + 20); root.add(lawn);
      places.push({ id: "sunsphere", name: "The Sunsphere", x, z, r: 40 }); }

    /* ---------- Neyland Stadium: a bowl of stands around the field, by the river ---------- */
    { const x = -330, z = 215, y = heightAt(x, z), g = new T.Group(), stand = M(0x9a9a96), orange = M(0xe0761e), white = M(0xf4f1ea), field = M(0x4f8a34);
      const ax = 120, az = 90, Hh = 34;
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new T.Vector2(lerp(.42, 1, t), t * Hh)); }
      const bowl = new T.Mesh(new T.LatheGeometry(pts, 64), new T.MeshStandardMaterial({ color: 0x8c8c88, roughness: .9, side: T.DoubleSide })); bowl.scale.set(ax, 1, az); g.add(bowl);
      for (let i = 0; i < 14; i++) { const r = new T.Mesh(new T.TorusGeometry(1, .012, 4, 64), i % 2 ? orange : white); r.rotation.x = Math.PI / 2; const t = (i + .5) / 14; r.scale.set(ax * lerp(.42, 1, t), az * lerp(.42, 1, t), 1); r.position.y = t * Hh + .3; g.add(r); }
      const pitch = new T.Mesh(new T.PlaneGeometry(ax * .66, az * .62), field); pitch.rotation.x = -Math.PI / 2; pitch.position.y = .1; g.add(pitch);
      for (const s of [-1, 1]) for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) { if ((i + j) % 2) continue; const sq = new T.Mesh(new T.PlaneGeometry(ax * .66 / 8, 5), orange); sq.rotation.x = -Math.PI / 2; sq.position.set(-ax * .33 + (i + .5) * ax * .66 / 8, .12, s * (az * .31 - 2.5 - j * 0)); if (j) continue; g.add(sq); }
      for (let i = -4; i <= 4; i++) { const l = new T.Mesh(new T.PlaneGeometry(.4, az * .5), white); l.rotation.x = -Math.PI / 2; l.position.set(i * ax * .066, .13, 0); g.add(l); }
      for (const [lx, lz] of [[-.8, -.8], [.8, -.8], [-.8, .8], [.8, .8]]) { const mast = new T.Mesh(new T.CylinderGeometry(.6, .8, 52, 6), stand); mast.position.set(lx * ax, 26, lz * az); g.add(mast); const lights = box(12, 4, 1, M(0xfff7d6, { emissive: 0xfff2c0, emissiveIntensity: .6 })); lights.position.set(lx * ax, 52, lz * az); g.add(lights); }
      g.position.set(x, y, z); root.add(shadow(g));
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, rx = Math.cos(a) * ax * .8, rz = Math.sin(a) * az * .8; coll({ type: "box", x: x + rx, y: y + Hh / 2, z: z + rz, hx: 14, hy: Hh / 2, hz: 3, ry: Math.atan2(-Math.sin(a) * ax, Math.cos(a) * az) + Math.PI / 2, tag: "stadium" }); }
      places.push({ id: "stadium", name: "Neyland Stadium", x, z, r: 100 }); }

    /* ---------- bridges over the Tennessee: Henley Street's concrete arches and the Gay Street truss ---------- */
    for (const [bx, arch] of [[-400, true], [-250, false]]) { const g = new T.Group(), y = 6, deck = box(14, 1.2, 150, M(0xb8b2a4)); deck.position.y = y; g.add(deck);
      for (let i = -2; i <= 2; i++) { const pier = box(4, y + 6, 5, M(0xa8a294)); pier.position.set(0, (y - 6) / 2, i * 30); g.add(pier);
        if (arch) { const a = new T.Mesh(new T.TorusGeometry(13, 1, 6, 20, Math.PI), M(0xb8b2a4)); a.position.set(0, y - 13, i * 30 + 15); a.rotation.y = Math.PI / 2; if (i < 2) g.add(a); } }
      if (!arch) for (const s of [-1, 1]) for (let i = 0; i < 12; i++) { const t = box(.4, 6, .4, M(0x4a5a64, { metalness: .6 })); t.position.set(s * 7, y + 3.5, -66 + i * 12); t.rotation.x = i % 2 ? .5 : -.5; g.add(t); }
      g.position.set(bx, 0, 305); root.add(shadow(g)); }

    /* ---------- World Headquarters: a glass tower with a helipad on its roof, and the helicopter on the pad ---------- */
    const hq = { x: -210, z: -70, h: 92 }; { const y = heightAt(hq.x, hq.z), g = new T.Group(), glass = M(0x30495e, { metalness: .6, roughness: .15 }), band = M(0xd8dde2, { metalness: .4, roughness: .4 });
      const t = box(34, hq.h, 26, glass); t.position.y = hq.h / 2; g.add(t);
      for (let i = 1; i < 23; i++) { const b = box(34.3, .5, 26.3, band); b.position.y = i * 4; g.add(b); }
      const lobby = box(40, 7, 32, M(0x8a8a86)); lobby.position.y = 3.5; g.add(lobby);
      const pad = new T.Mesh(new T.CylinderGeometry(11, 11, .6, 32), M(0x4a4e52)); pad.position.y = hq.h + .3; g.add(pad);
      const ring = new T.Mesh(new T.RingGeometry(9.4, 10, 48), new T.MeshBasicMaterial({ color: 0xf2d24a })); ring.rotation.x = -Math.PI / 2; ring.position.y = hq.h + .62; g.add(ring);
      for (const [hx, hz, hw, hd] of [[-2.6, 0, .9, 7], [2.6, 0, .9, 7], [0, 0, 4.4, .9]]) { const h = box(hw, .05, hd, new T.MeshBasicMaterial({ color: 0xf4f1ea })); h.position.set(hx, hq.h + .64, hz); g.add(h); }
      const sign = (() => { const c = document.createElement("canvas"); c.width = 1024; c.height = 128; const q = c.getContext("2d"); q.fillStyle = "#e8edf2"; q.font = "600 76px Georgia"; q.textAlign = "center"; q.fillText("WORLD HEADQUARTERS", 512, 92); const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; return new T.Mesh(new T.PlaneGeometry(30, 3.75), new T.MeshBasicMaterial({ map: tx, transparent: true })); })();
      sign.position.set(0, 8.6, 16.1); g.add(sign);
      /* the stair door on the roof: a lift takes you up */
      const stair = box(4, 3.4, 4, band); stair.position.set(13, hq.h + 1.7, 8); g.add(stair);
      g.position.set(hq.x, y, hq.z); root.add(shadow(g)); solid(hq.x, hq.z, 40, hq.h, 32, 0, "headquarters", y);
      Object.assign(hq, { y, roof: y + hq.h + .6, pad: { x: hq.x, z: hq.z }, lobbyDoor: { x: hq.x, z: hq.z + 18 } });
      places.push({ id: "hq", name: "World Headquarters", x: hq.x, z: hq.z, r: 40 }); }

    /* ---------- Eastminster Presbyterian: red brick, a white portico and steeple with the bell, the lawn, the lot, the custodian's shed ---------- */
    const church = { x: 120, z: -40, ry: 0 }; { const y = heightAt(church.x, church.z), g = new T.Group(), brick = M(0x8a3e2a, { roughness: .95 }), white = M(0xf3f0e8), slate = M(0x3a3e44, { roughness: .8 });
      const nave = box(16, 10, 30, brick); nave.position.set(0, 5, -4); g.add(nave);
      const roof = new T.Mesh(new T.CylinderGeometry(.01, 11.6, 6, 4, 1), slate); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 31 / 16); roof.position.set(0, 13, -4); g.add(roof);
      const portico = box(14, .6, 5, white); portico.position.set(0, 9.4, 13.6); g.add(portico); const ped = new T.Mesh(new T.CylinderGeometry(.01, 9.6, 3.2, 3, 1), white); ped.rotation.z = Math.PI / 2; ped.rotation.y = Math.PI / 2; ped.scale.set(1, 1, .5); ped.position.set(0, 11.2, 14.5); g.add(ped);
      for (let i = 0; i < 4; i++) { const col = new T.Mesh(new T.CylinderGeometry(.45, .5, 8.6, 14), white); col.position.set(-5.25 + i * 3.5, 4.8, 15.4); g.add(col); }
      for (let i = 0; i < 3; i++) { const stp = box(14, .27 * (3 - i), 1, M(0xb8b2a8)); stp.position.set(0, .135 * (3 - i), 16.2 + i); g.add(stp); }   /* three real steps up to the portico */
      const floor = box(14, .81, 4.6, M(0xc8c2b8)); floor.position.set(0, .405, 13.4); g.add(floor);
      const tower = box(6, 8, 6, white); tower.position.set(0, 18, 9); g.add(tower); const belfry = box(5, 4, 5, white); belfry.position.set(0, 24, 9); g.add(belfry);
      const open = box(5.2, 2.6, 3.6, M(0x1a1a1a)); open.position.set(0, 24, 9); g.add(open); const open2 = box(3.6, 2.6, 5.2, M(0x1a1a1a)); open2.position.set(0, 24, 9); g.add(open2);
      const spire = new T.Mesh(new T.ConeGeometry(3, 14, 8), white); spire.position.set(0, 33, 9); g.add(spire); const cross = box(.3, 2.4, .3, M(0xd8b860, { metalness: .8, roughness: .3 })); cross.position.set(0, 41, 9); g.add(cross); const crossB = box(1.4, .3, .3, cross.material); crossB.position.set(0, 41.4, 9); g.add(crossB);
      const bell = new T.Mesh(new T.CylinderGeometry(.5, 1.05, 1.4, 20, 1, true), M(0xa87a3a, { metalness: .9, roughness: .3, side: T.DoubleSide })); const bellG = new T.Group(); bell.position.y = -.7; bellG.add(bell); bellG.position.set(0, 25.2, 9); g.add(bellG);
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { const win = box(.1, 4.4, 1.6, M(0x3a5a8a, { emissive: 0x6a3a8a, emissiveIntensity: .25, roughness: .2 })); win.position.set(s * 8.05, 5.4, -16 + i * 5.6); g.add(win); }
      const doorL = box(1.5, 3.6, .2, M(0x5a2a1a)), doorR = doorL.clone(); const hingeL = new T.Group(), hingeR = new T.Group(); doorL.position.x = .75; doorR.position.x = -.75; hingeL.add(doorL); hingeR.add(doorR); hingeL.position.set(-1.5, 1.8 + .8, 11.05); hingeR.position.set(1.5, 1.8 + .8, 11.05); g.add(hingeL, hingeR);
      const sign = (() => { const c = document.createElement("canvas"); c.width = 768; c.height = 256; const q = c.getContext("2d"); q.fillStyle = "#1e2a3a"; q.fillRect(0, 0, 768, 256); q.strokeStyle = "#d8c690"; q.lineWidth = 8; q.strokeRect(10, 10, 748, 236); q.fillStyle = "#f2ead2"; q.textAlign = "center"; q.font = "600 54px Georgia"; q.fillText("EASTMINSTER", 384, 96); q.font = "400 40px Georgia"; q.fillText("Presbyterian Church", 384, 150); q.font = "italic 32px Georgia"; q.fillText("All are welcome · Worship 11:00", 384, 210); const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; return new T.Mesh(new T.PlaneGeometry(4.2, 1.4), new T.MeshStandardMaterial({ map: tx })); })();
      sign.position.set(9, 1.6, 26); g.add(sign); const legs = box(4.4, .3, .3, white); legs.position.set(9, .8, 26); g.add(legs);
      const lot = new T.Mesh(new T.PlaneGeometry(30, 34), asphalt); lot.rotation.x = -Math.PI / 2; lot.position.set(-26, .07, 0); g.add(lot);
      for (let i = 0; i < 7; i++) { const s = box(.15, .02, 5, new T.MeshBasicMaterial({ color: 0xf2f2ee })); s.position.set(-38 + i * 4, .1, -12); g.add(s); }
      g.position.set(church.x, y, church.z); root.add(shadow(g));
      solid(church.x, church.z - 4, 16, 14, 30, 0, "church", y); solid(church.x, church.z + 9, 6, 28, 6, 0, "steeple", y); for (let i = 0; i < 4; i++) coll({ type: "cyl", x: church.x - 5.25 + i * 3.5, y: y + 4.8, z: church.z + 15.4, r: .5, hh: 4.3, tag: "column" });
      { const a = Math.atan2(.81, 3), L = Math.hypot(3, .81) / 2; coll({ type: "box", x: church.x, y: y + .405 - Math.cos(a) * .2, z: church.z + 17.2 - Math.sin(a) * .2, hx: 7, hy: .2, hz: L, rx: a, tag: "steps" }); }   /* an invisible ramp under the three steps: the character controller climbs a slope, not a stair */
      coll({ type: "box", x: church.x, y: y + .405, z: church.z + 13.4, hx: 7, hy: .405, hz: 2.3, tag: "portico" });
      Object.assign(church, { y, group: g, bell: bellG, doors: [hingeL, hingeR], door: { x: church.x, z: church.z + 12.5 }, steps: { x: church.x, z: church.z + 19 }, rope: { x: church.x, z: church.z + 9 }, lawn: { x: church.x + 25, z: church.z + 22 }, lot: { x: church.x - 26, z: church.z },
        yard: [church.x - 40, church.z - 40, church.x + 45, church.z + 45], foot: [[church.x - 8, church.z - 19], [church.x + 8, church.z - 19], [church.x + 8, church.z + 11], [church.x - 8, church.z + 11]] });
      places.push({ id: "church", name: "Eastminster Presbyterian", x: church.x, z: church.z, r: 50 }); }

    /* the custodian's shed: barn red, the old tractor and the hay wagon inside its doors */
    const shed = { x: 175, z: -75 }; { const y = heightAt(shed.x, shed.z), g = new T.Group(), red = M(0x8a2a22), trim = M(0xf2efe6);
      const b = box(12, 5, 10, red); b.position.y = 2.5; g.add(b); const r = new T.Mesh(new T.CylinderGeometry(.01, 8.8, 3, 4, 1), M(0x5a5a5e)); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 10 / 12); r.position.y = 6.5; g.add(r);
      const xa = box(7, 4, .1, trim); xa.position.set(0, 2.2, 5.05); g.add(xa); const xb = box(6.6, 3.6, .12, M(0x6a2018)); xb.position.set(0, 2.2, 5.08); g.add(xb);
      g.position.set(shed.x, y, shed.z); root.add(shadow(g)); solid(shed.x, shed.z, 12, 5, 10, 0, "shed", y);
      Object.assign(shed, { y, front: { x: shed.x, z: shed.z + 12 } }); places.push({ id: "shed", name: "the custodian's shed", x: shed.x, z: shed.z, r: 14 }); }

    /* ---------- Holston Hills: fairways, greens, flags, bunkers, the stone clubhouse, the river along the course ---------- */
    const golf = { holes: [], picnic: { x: 410, z: -128 }, clubhouse: { x: 400, z: -160 } }; { const green = M(0x4f9a3a, { roughness: .7 }), sand = M(0xd9c79a), flagM = M(0xd8382a, { side: T.DoubleSide }), pole = M(0xf4f4f0);
      const HOLES = [[350, -60], [430, 40], [520, -40], [600, -150], [480, -200], [560, 70]];
      for (const [i, [x, z]] of HOLES.entries()) { const y = heightAt(x, z), gr = new T.Mesh(new T.CircleGeometry(13, 32), green); gr.rotation.x = -Math.PI / 2; gr.position.set(x, y + .08, z); gr.receiveShadow = true; root.add(gr);
        const p = new T.Mesh(new T.CylinderGeometry(.05, .05, 2.4, 6), pole); p.position.set(x + 2, y + 1.2, z); root.add(p); const f = new T.Mesh(new T.PlaneGeometry(.9, .55), flagM); f.position.set(x + 2.45, y + 2.1, z); root.add(f);
        const bk = new T.Mesh(new T.CircleGeometry(6, 20), sand); bk.rotation.x = -Math.PI / 2; bk.scale.set(1.4, .7, 1); bk.position.set(x - 15 + hash(i) * 6, heightAt(x - 15, z + 8) + .09, z + 8); root.add(bk);
        golf.holes.push({ n: i + 1, x, z, flag: f }); }
      const cx = golf.clubhouse.x, cz = golf.clubhouse.z, y = heightAt(cx, cz), g = new T.Group(), stone = M(0x9a8f7e, { roughness: 1 }), timber = M(0x3a2a1e), stucco = M(0xe8e0cc);
      const b = box(30, 6, 14, stone); b.position.y = 3; g.add(b); const up = box(24, 4, 12, stucco); up.position.y = 8; g.add(up);
      for (let i = 0; i < 7; i++) { const t = box(.35, 4, 12.2, timber); t.position.set(-11 + i * 3.7, 8, 0); g.add(t); }
      const roof = new T.Mesh(new T.CylinderGeometry(.01, 18, 5, 4, 1), M(0x4a3a34)); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 14 / 30); roof.position.y = 12.5; g.add(roof);
      const chim = box(2, 6, 2, stone); chim.position.set(9, 13, 0); g.add(chim);
      g.position.set(cx, y, cz); root.add(shadow(g)); solid(cx, cz, 30, 14, 14, 0, "clubhouse", y);
      const blanket = new T.Mesh(new T.PlaneGeometry(10, 8), M(0xc23a2a)); blanket.rotation.x = -Math.PI / 2; blanket.position.set(golf.picnic.x, heightAt(golf.picnic.x, golf.picnic.z) + .1, golf.picnic.z); root.add(blanket);
      for (let i = 0; i < 2; i++) { const tb = box(5, .12, 1.6, M(0x7a5a3a)); tb.position.set(golf.picnic.x - 7, heightAt(golf.picnic.x - 7, golf.picnic.z + i * 4) + .8, golf.picnic.z - 2 + i * 4); root.add(shadow(tb)); }
      places.push({ id: "golf", name: "Holston Hills", x: 480, z: -60, r: 160 }); }

    /* ---------- the forks of the river: a marker where the Holston and the French Broad become the Tennessee ---------- */
    { const x = 330, z = 270, y = 2, pole = new T.Mesh(new T.CylinderGeometry(.15, .15, 4, 6), M(0xe8e4d8)); pole.position.set(x - 40, heightAt(x - 40, z - 60) + 2, z - 60); root.add(pole); places.push({ id: "forks", name: "the Forks of the River", x, z, r: 70 }); }

    function water(x, z) { const h = heightAt(x, z); return h < WATER_Y ? WATER_Y - h : 0; }
    function placeAt(x, z) { let best = null, bd = 1e9; for (const p of places) { const d = Math.hypot(x - p.x, z - p.z) - p.r; if (d < bd) { bd = d; best = p; } } const rv = riverDist(x, z); if (rv.d < 10) return rv.name; return bd < 30 ? best.name : x < -150 ? "downtown" : x > 290 ? "Holston Hills" : "East Knoxville"; }
    return { root, colliders, places, church, shed, golf, hq, sunsphere, water, placeAt, WATER_Y, BOUND };
  }
  window.KnoxWorld = { heightAt, riverDist, create, BOUND };
})();
