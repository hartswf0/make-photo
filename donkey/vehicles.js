/* The game's vehicles, shared by every world: the camera wagon (the Woody) from Donkey Water and zones,
   Ethiopia's Rogallo glider, and the Isuzu escarpment truck from the Abyssinian kits.
   Lifted verbatim from night-post/night-post.js (buildWagon, makeJerikan) and ethiopia-highlands/ethiopia-world.js
   (buildRogalloGlider); each source keeps its own copy until it is switched to this one.
   DWVehicles.wagon(THREE) -> { group, wheels, ... }   DWVehicles.rogallo(THREE) -> { root, ... }   DWVehicles.truck(THREE) */
(function () {
  "use strict";
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  let T = null;
  let jerReady = false, jerikanMat, jerikanRibMat, whiteCapMat, strapMat, leatherMat, sawWoodMat, brassMat, ropeHitchMat, antennaMat, beaconCyanMat, cyanWaterMat, jerBodyGeo, jerRibGeo, jerSeamGeo, jerHandleGeo, jerSpoutGeo, jerCapGeo;
  function jerInit() { if (jerReady) return; jerReady = true;
    jerikanMat = new T.MeshStandardMaterial({ color: 0x0066e8, emissive: 0x003ba8, emissiveIntensity: .68, roughness: .28, metalness: .06 });
    jerikanRibMat = new T.MeshStandardMaterial({ color: 0x004ec4, emissive: 0x002d8a, emissiveIntensity: .56, roughness: .34 });
    whiteCapMat = new T.MeshStandardMaterial({ color: 0xf4f4f0, roughness: .42 });
    strapMat = new T.MeshStandardMaterial({ color: 0x1e1b17, roughness: .72 });
    leatherMat = new T.MeshStandardMaterial({ color: 0x5c361c, roughness: .62 });
    sawWoodMat = new T.MeshStandardMaterial({ color: 0xb9986b, roughness: .74 });
    brassMat = new T.MeshStandardMaterial({ color: 0xcab070, roughness: .28, metalness: .82 });
    ropeHitchMat = new T.MeshStandardMaterial({ color: 0xc8b68c, roughness: .9 });
    antennaMat = new T.MeshStandardMaterial({ color: 0xe6e3d8, roughness: .25, metalness: .85 });
    beaconCyanMat = new T.MeshStandardMaterial({ color: 0x006eff, emissive: 0x0048dd, emissiveIntensity: 1.35, roughness: .16 });
    cyanWaterMat = new T.MeshStandardMaterial({ color: 0x006eff, emissive: 0x0052dd, emissiveIntensity: 1.05, roughness: .18, metalness: .08 });
    jerBodyGeo = (() => {
    const s = new T.Shape(), a = .112, b = .172, r = .028;
    s.moveTo(-a, -b - r); s.lineTo(a, -b - r); s.quadraticCurveTo(a + r, -b - r, a + r, -b);
    s.lineTo(a + r, b); s.quadraticCurveTo(a + r, b + r, a, b + r); s.lineTo(-a, b + r);
    s.quadraticCurveTo(-a - r, b + r, -a - r, b); s.lineTo(-a - r, -b); s.quadraticCurveTo(-a - r, -b - r, -a, -b - r);
    const g = new T.ExtrudeGeometry(s, { depth: .15, bevelEnabled: true, bevelThickness: .018, bevelSize: .014, bevelSegments: 2 });
    g.translate(0, 0, -.075);
    return g;
    })();
    jerRibGeo = new T.BoxGeometry(.18, .018, .014);
    jerSeamGeo = new T.BoxGeometry(.252, .36, .012);
    jerHandleGeo = new T.BoxGeometry(.155, .042, .052);
    jerSpoutGeo = new T.CylinderGeometry(.028, .036, .06, 12);
    jerCapGeo = new T.CylinderGeometry(.034, .034, .032, 12);
  }
  function makeJerikan(scale = 1) { jerInit();
      const g = new T.Group();
      const b = new T.Mesh(jerBodyGeo, jerikanMat); b.position.y = .21; g.add(b);
      const seam = new T.Mesh(jerSeamGeo, jerikanRibMat); seam.position.y = .21; g.add(seam);
      for (const sgn of [-1, 1]) {
        for (const ang of [.54, -.54]) {
          const rb = new T.Mesh(jerRibGeo, jerikanRibMat);
          rb.position.set(0, .205, sgn * .092); rb.rotation.z = ang; g.add(rb);
        }
      }
      const h = new T.Mesh(jerHandleGeo, jerikanMat); h.position.set(-.032, .42, 0); g.add(h);
      const sp = new T.Mesh(jerSpoutGeo, jerikanMat); sp.position.set(.082, .418, 0); sp.rotation.z = -.25; g.add(sp);
      const cp = new T.Mesh(jerCapGeo, whiteCapMat); cp.position.set(.094, .45, 0); cp.rotation.z = -.25; g.add(cp);
      g.scale.setScalar(scale);
      return g;
    }
  function buildWagon() { jerInit();
      const woodBox = new T.BoxGeometry(1, 1, 1), ball = new T.SphereGeometry(1, 18, 12);
      const coach = new T.MeshStandardMaterial({ color: 0x8e9597, roughness: .42, metalness: .18 });
      const ash = new T.MeshStandardMaterial({ color: 0xc2a67a, roughness: .72 });
      const walnut = new T.MeshStandardMaterial({ color: 0x5c3822, roughness: .78 });
      const deckWood = new T.MeshStandardMaterial({ color: 0x9b805c, roughness: .82 });
      const charcoal = new T.MeshStandardMaterial({ color: 0x262825, roughness: .82 });
      const nickel = new T.MeshStandardMaterial({ color: 0xe6e4dc, roughness: .22, metalness: .86 });
      const rubber = new T.MeshStandardMaterial({ color: 0x1c1c1a, roughness: .92 });
      const sidewall = new T.MeshStandardMaterial({ color: 0x33322d, roughness: .88 });
      const safetyGlass = new T.MeshStandardMaterial({ color: 0x2c3b46, roughness: .14, metalness: .35, transparent: true, opacity: .66 });
      const amber = new T.MeshStandardMaterial({ color: 0xe8bc64, emissive: 0x5a4218, emissiveIntensity: .6, roughness: .2 });
      const redLens = new T.MeshStandardMaterial({ color: 0xc93828, emissive: 0x501008, emissiveIntensity: .5, roughness: .25 });
      const darkTailgate = new T.MeshStandardMaterial({ color: 0x4c3220, roughness: .78 });
  
      const meshAt = (g, m, grp, x = 0, y = 0, z = 0) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); grp.add(o); return o; };
      const billet = (grp, m, x, y, z, w, h, l) => { const o = meshAt(woodBox, m, grp, x, y, z); o.scale.set(w, h, l); return o; };
      const oval = (grp, m, x, y, z, w, h, l) => { const o = meshAt(ball, m, grp, x, y, z); o.scale.set(w, h, l); return o; };
      const spar = (grp, m, a, b, r1, r2 = r1, sides = 8) => {
        const p = new T.Vector3(...a), q = new T.Vector3(...b), off = q.clone().sub(p);
        const t = meshAt(new T.CylinderGeometry(r2, r1, off.length(), sides, 1), m, grp);
        t.position.copy(p).lerp(q, .5); t.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), off.normalize());
        return t;
      };
      const pipe = (grp, m, pts, rad, seg = 20) => meshAt(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), seg, rad, 7, false), m, grp);
      const loft = (grp, m, profs, sides = 28, segs = 22, flat = 1) => {
        const spine = new T.CatmullRomCurve3(profs.map(([z, y, xr, yr]) => new T.Vector3(xr, yr, z)));
        const levels = new T.CatmullRomCurve3(profs.map(([z, y]) => new T.Vector3(0, y, z)));
        const p = [], uv = [], tri = [];
        for (let j = 0; j <= segs; j++) {
          const t = j / segs, pt = spine.getPoint(t), y = levels.getPoint(t).y;
          for (let i = 0; i <= sides; i++) {
            const th = (i / sides) * TAU, cnt = v => Math.sign(v) * (Math.abs(v) ** flat);
            p.push(cnt(Math.cos(th)) * Math.max(.001, pt.x), y + cnt(Math.sin(th)) * Math.max(.001, pt.y), pt.z);
            uv.push(i / sides, t);
            if (j < segs && i < sides) {
              const a = j * (sides + 1) + i;
              if (profs[0][0] < profs[profs.length - 1][0]) tri.push(a, a + 1, a + sides + 1, a + 1, a + sides + 2, a + sides + 1);
              else tri.push(a, a + sides + 1, a + 1, a + 1, a + sides + 1, a + sides + 2);
            }
          }
        }
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(p, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
        g.setIndex(tri); g.computeVertexNormals();
        return meshAt(g, m, grp);
      };
      const roundedCase = (grp, m, x, y, z, w, h, l, r = .06) => {
        const sh = new T.Shape(), a = w * .5 - r, b = h * .5 - r;
        sh.moveTo(-a, -b - r); sh.lineTo(a, -b - r); sh.quadraticCurveTo(a + r, -b - r, a + r, -b);
        sh.lineTo(a + r, b); sh.quadraticCurveTo(a + r, b + r, a, b + r); sh.lineTo(-a, b + r);
        sh.quadraticCurveTo(-a - r, b + r, -a - r, b); sh.lineTo(-a - r, -b); sh.quadraticCurveTo(-a - r, -b - r, -a, -b - r);
        const gm = new T.ExtrudeGeometry(sh, { depth: l, bevelEnabled: false, curveSegments: 4 }); gm.translate(0, 0, -l * .5);
        return meshAt(gm, m, grp, x, y, z);
      };
      const panelSide = (grp, m, side, pts, thk) => {
        const sh = new T.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); sh.closePath();
        const g = new T.ExtrudeGeometry(sh, { depth: thk, bevelEnabled: false, curveSegments: 4 });
        g.rotateY(-Math.PI * .5); g.translate(thk * .5, 0, 0);
        return meshAt(g, m, grp, side, 0, 0);
      };
      const makeWheel = (grp, x, y, z, front) => {
        const mount = new T.Group(); mount.position.set(x, y, z); grp.add(mount);
        const spin = new T.Group(); mount.add(spin);
        const tire = meshAt(new T.TorusGeometry(.30, .091, 12, 30), rubber, spin); tire.rotation.y = Math.PI * .5; tire.scale.z = 1.22;
        const dir = Math.sign(x);
        for (const off of [-.047, .047]) {
          const bead = meshAt(new T.TorusGeometry(.303, .051, 10, 28), sidewall, spin, off, 0, 0); bead.rotation.y = Math.PI * .5;
        }
        meshAt(new T.CylinderGeometry(.218, .218, .145, 24), charcoal, spin).rotation.z = Math.PI * .5;
        oval(spin, nickel, dir * .097, 0, 0, .038, .145, .145);
        oval(spin, coach, dir * .124, 0, 0, .019, .084, .084);
        const ring = meshAt(new T.TorusGeometry(.183, .011, 6, 24), nickel, spin, dir * .077, 0, 0); ring.rotation.y = Math.PI * .5;
        for (let i = 0; i < 24; i++) {
          const ang = (i / 24) * TAU;
          billet(spin, rubber, 0, .387 * Math.cos(ang), .387 * Math.sin(ang), .176, .014, .022).rotation.x = ang;
        }
        return { mount, spin, front, baseY: y };
      };
  
      const root = new T.Group();
      const inner = new T.Group(); inner.rotation.y = Math.PI; root.add(inner);
      const body = new T.Group(); inner.add(body);
  
      loft(body, coach, [[-2.61, .72, .08, .07], [-2.5, .77, .72, .24], [-2.1, .83, .93, .38], [-1.47, .87, .98, .43],
        [-.9, .88, .99, .45], [.1, .89, .97, .43], [1.1, .88, .96, .40], [1.99, .81, .94, .36], [2.44, .78, .75, .30], [2.59, .76, .016, .029]], 34, 30, .55);
      const hoodMesh = loft(body, coach, [[-2.6, .91, .045, .026], [-2.46, 1.04, .43, .22], [-2.14, 1.14, .58, .215], [-1.65, 1.22, .62, .214],
        [-1.15, 1.25, .68, .23], [-.79, 1.24, .69, .21]], 28, 22, .68);
      loft(body, charcoal, [[-1.26, 1.35, .72, .048], [-1.04, 1.65, .76, .17], [-.77, 1.75, .83, .32], [-.38, 1.78, .85, .34], [.52, 1.80, .86, .34],
        [1.43, 1.77, .85, .32], [2.04, 1.73, .78, .27], [2.33, 1.59, .70, .15], [2.48, 1.29, .67, .044]], 28, 28, .63);
  
      for (const sgn of [-1, 1]) {
        const x = sgn * .90;
        panelSide(body, walnut, x + sgn * .031, [[-1.03, .59], [-1.18, 1.28], [-.66, 1.41], [1.97, 1.41], [2.35, 1.10], [2.36, .66]], .037);
        for (const y of [.70, .91, 1.13, 1.365]) billet(body, ash, x + sgn * .018, y, .51, .068, .052, 3.28).rotation.x = -.016;
        const win = [[-1.03, 1.38], [-.64, 1.91], [1.87, 1.90], [2.15, 1.75], [2.35, 1.41]];
        panelSide(body, safetyGlass, x - sgn * .072, win, .035);
        pipe(body, ash, win.concat([win[0]]).map(([z, y]) => [x - sgn * .051, y, z]), .030, 20);
        for (const z of [-.96, .02, 1.08, 2.14]) {
          const y = z === -.96 ? 1.43 : 1.57;
          billet(body, ash, x + sgn * .010, y, z, .070, z === -.96 ? .80 : 1.16, .050).rotation.x = z === -.96 ? -.25 : z === 2.14 ? .30 : .007;
        }
        for (const z of [-.52, .52]) billet(body, nickel, x + sgn * .089, 1.23, z, .034, .038, .165).rotation.x = -.075;
        loft(body, coach, [[-2.58, .68, .019, .035], [-2.40, .75, .211, .224], [-2.06, .78, .276, .32], [-1.66, .77, .285, .30],
          [-1.27, .72, .237, .24], [-.94, .63, .14, .18], [-.57, .57, .03, .054]], 20, 18, .83).position.x = sgn * .73;
        loft(body, coach, [[.55, .57, .013, .028], [.87, .64, .155, .156], [1.27, .73, .271, .274], [1.66, .76, .295, .312],
          [2.12, .71, .254, .237], [2.48, .63, .139, .14], [2.58, .59, .016, .025]], 20, 18, .75).position.x = sgn * .735;
        for (const h of [.52, .58, .64]) { billet(body, nickel, sgn * 1.00, h, -1.74, .029, .022, 1.32); billet(body, nickel, sgn * 1.01, h, 1.71, .028, .021, 1.46); }
        oval(body, nickel, sgn * .66, .88, -2.36, .185, .187, .18);
        oval(body, amber, sgn * .66, .88, -2.48, .129, .131, .073);
        oval(body, redLens, sgn * .79, .65, 2.482, .051, .083, .046);
        oval(body, nickel, sgn * 1.01, 1.43, -.95, .082, .063, .032);
      }
      roundedCase(body, darkTailgate, 0, 1.049, 2.426, 1.61, .600, .135, .145);
      for (const y of [.84, 1.024, 1.205]) billet(body, ash, 0, y, 2.502, 1.43, .044, .052);
      for (const x of [-.735, .735]) billet(body, ash, x, 1.062, 2.50, .050, .44, .064);
      billet(body, nickel, 0, 1.248, 2.512, .218, .049, .038);
      for (const sgn of [-1, 1]) {
        billet(body, safetyGlass, sgn * .382, 1.615, -.946, .743, .405, .033).rotation.x = .59;
        billet(body, safetyGlass, sgn * .376, 1.60, 2.22, .696, .344, .04).rotation.x = -.44;
      }
      billet(body, ash, 0, 1.62, 2.224, .067, .42, .088).rotation.x = -.44;
      billet(body, nickel, 0, 1.59, -1.000, .038, .49, .05).rotation.x = .59;
      for (let i = 0; i < 5; i++) {
        const z = -2.35 + i * .173;
        for (let k = -2; k <= 2; k++) billet(body, nickel, k * .072, 1.35 + i * .025, z, .016, .015, .167);
        billet(body, nickel, 0, .60 + i * .062, -2.567 + i * .008, .99 - i * .031, .035, .050);
      }
      const frontBumper = billet(body, nickel, 0, .467, -2.59, 1.77, .121, .17);
      billet(body, nickel, 0, .446, 2.535, 1.85, .123, .19);
      for (const s of [-1, 1]) {
        billet(body, nickel, s * .58, .495, -2.658, .105, .245, .17);
        billet(body, deckWood, s * .95, 2.37, .44, .090, .118, 3.65);
        for (const z of [-1.06, .20, 1.65]) {
          billet(body, nickel, s * .944, 1.885, z, .035, .84, .062);
          billet(body, deckWood, s * .93, 2.36, z, .091, .367, .065);
        }
        spar(body, charcoal, [s * .946, 2.49, -1.39], [s * .946, 2.49, 2.29], .021);
      }
      for (let i = 0; i < 12; i++) billet(body, i % 3 ? deckWood : ash, (i - 5.5) * .153, 2.265, .43, .145, .065, 3.69);
      for (const x of [-.87, -.40]) spar(body, charcoal, [x, .37, 2.62], [x, 2.29, 2.10], .031, .028);
      for (let i = 0; i < 7; i++) {
        const f = (i + .38) / 7;
        spar(body, nickel, [-.87, lerp(.37, 2.29, f), lerp(2.62, 2.10, f)], [-.40, lerp(.37, 2.29, f), lerp(2.62, 2.10, f)], .023);
      }
      for (const sgn of [-1, 1]) {
        for (const z of [-.95, 1.68]) {
          const jc = makeJerikan(.96);
          jc.position.set(sgn * .72, 2.30, z); jc.rotation.y = sgn * .18;
          body.add(jc);
        }
      }
      spar(body, antennaMat, [0, 2.28, -1.28], [0, 3.45, -1.28], .022, .010, 8);
      const wagonBeacon = meshAt(new T.SphereGeometry(.092, 14, 10), beaconCyanMat, body, 0, 3.48, -1.28);
      const roofStandSpot = new T.Object3D();
      roofStandSpot.position.set(0, 2.30, -.15);
      body.add(roofStandSpot);
  
      const wheels = [
        makeWheel(inner, -.862, .394, -1.71, true),
        makeWheel(inner, .862, .394, -1.71, true),
        makeWheel(inner, -.882, .394, 1.61, false),
        makeWheel(inner, .882, .394, 1.61, false)
      ];
  
      return {
        group: root, inner, chassis: body, wheels, beacon: wagonBeacon, roofStandSpot,
        hoodMesh, frontBumper,
        x: -15.5, z: 4.8, y: 155, heading: -Math.PI * .52, speed: 0, steerAngle: 0, pitch: 0, roll: 0,
        get deckY() { return this.y + 2.30; }
      };
    }
  function buildRogalloGlider(T) {
      const root = new T.Group();
      root.name = "RogalloHangGlider";
      root.visible = false;
  
      const wingPivot = new T.Group();
      root.add(wingPivot);
  
      const aluMat = new T.MeshStandardMaterial({ color: 0xcbd3dc, roughness: 0.32, metalness: 0.82 });
      const darkWireMat = new T.MeshBasicMaterial({ color: 0x232830 });
      const sailRustMat = new T.MeshStandardMaterial({
        color: 0xc85d34,
        emissive: 0x3a1408,
        emissiveIntensity: 0.18,
        roughness: 0.48,
        side: T.DoubleSide
      });
      const sailCreamMat = new T.MeshStandardMaterial({
        color: 0xf0e6d2,
        roughness: 0.52,
        side: T.DoubleSide
      });
      const sailCyanMat = new T.MeshStandardMaterial({
        color: 0x28d8f0,
        emissive: 0x108eb0,
        emissiveIntensity: 0.82,
        roughness: 0.28,
        side: T.DoubleSide
      });
      sailCyanMat.userData.isWaterCyan = true;
  
      // Classic Rogallo swept delta geometry (+Z = nose forward, X = +/-4.9m wingspan)
      const nose = [0, 0.12, 2.45];
      const keelRear = [0, 0.08, -1.55];
      const tipL = [4.85, 0.28, -1.35];
      const tipR = [-4.85, 0.28, -1.35];
      const midL = [2.45, 0.44, 0.55];
      const midR = [-2.45, 0.44, 0.55];
      const lobeL = [2.35, 0.36, -1.12];
      const lobeR = [-2.35, 0.36, -1.12];
  
      const makeTriMesh = (tris, mat) => {
        const pos = [];
        for (const [a, b, c] of tris) pos.push(...a, ...b, ...c);
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        g.computeVertexNormals();
        const m = new T.Mesh(g, mat);
        m.castShadow = true;
        wingPivot.add(m);
        return m;
      };
  
      // Selective Cyan Leading-Edge Panels + Terracotta & Cream Billowing Conical Lobes
      makeTriMesh([[nose, midL, [1.55, 0.34, 0.45]], [nose, [-1.55, 0.34, 0.45], midR]], sailCyanMat);
      makeTriMesh([[midL, tipL, [3.4, 0.34, -0.75]], [midR, [-3.4, 0.34, -0.75], tipR]], sailCyanMat);
      makeTriMesh([
        [nose, [1.55, 0.34, 0.45], lobeL],
        [nose, lobeL, keelRear],
        [nose, lobeR, [-1.55, 0.34, 0.45]],
        [nose, keelRear, lobeR]
      ], sailCreamMat);
      makeTriMesh([
        [[1.55, 0.34, 0.45], midL, lobeL],
        [midL, [3.4, 0.34, -0.75], lobeL],
        [[3.4, 0.34, -0.75], tipL, lobeL],
        [[-1.55, 0.34, 0.45], lobeR, midR],
        [midR, lobeR, [-3.4, 0.34, -0.75]],
        [[-3.4, 0.34, -0.75], lobeR, tipR]
      ], sailRustMat);
  
      const addBar = (p0, p1, r, mat) => {
        const a = new T.Vector3(...p0), b = new T.Vector3(...p1);
        const d = b.clone().sub(a);
        const cyl = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 8), mat);
        cyl.position.copy(a).lerp(b, 0.5);
        cyl.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
        wingPivot.add(cyl);
      };
  
      // Keel, Leading-Edge Spars, Crossbar, Kingpost & Control A-Frame
      addBar(nose, [0, 0.08, -1.85], 0.026, aluMat);
      addBar(nose, tipL, 0.025, aluMat);
      addBar(nose, tipR, 0.025, aluMat);
      addBar([2.45, 0.24, 0.35], [-2.45, 0.24, 0.35], 0.022, aluMat);
      const kingTop = [0, 1.05, 0.25];
      addBar([0, 0.12, 0.25], kingTop, 0.018, aluMat);
      addBar(kingTop, nose, 0.005, darkWireMat);
      addBar(kingTop, tipL, 0.005, darkWireMat);
      addBar(kingTop, tipR, 0.005, darkWireMat);
      addBar(kingTop, keelRear, 0.005, darkWireMat);
  
      const barL = [0.62, -1.18, 0.38], barR = [-0.62, -1.18, 0.38], apex = [0, 0.12, 0.42];
      addBar(apex, barL, 0.018, aluMat);
      addBar(apex, barR, 0.018, aluMat);
      addBar(barL, barR, 0.020, aluMat);
      addBar(barL, nose, 0.005, darkWireMat);
      addBar(barR, nose, 0.005, darkWireMat);
  
      // Suspended Prone Pilot Pod (warm canvas harness + cyan Ahiya dorsal stripe)
      const podMat = new T.MeshStandardMaterial({ color: 0x8e795c, roughness: 0.68 });
      const skinMat = new T.MeshStandardMaterial({ color: 0x3b261b, roughness: 0.55 });
      const pilotPod = new T.Group();
      pilotPod.position.set(0, -0.92, -0.05);
      const podBody = new T.Mesh(new T.CapsuleGeometry(0.18, 1.15, 6, 10), podMat);
      podBody.rotation.x = Math.PI * 0.48;
      const podStripe = new T.Mesh(new T.BoxGeometry(0.12, 0.05, 0.95), sailCyanMat);
      podStripe.position.set(0, 0.17, -0.02);
      const helmet = new T.Mesh(new T.SphereGeometry(0.145, 10, 8), skinMat);
      helmet.position.set(0, 0.08, 0.68);
      const goggles = new T.Mesh(new T.BoxGeometry(0.18, 0.06, 0.08), sailCyanMat);
      goggles.position.set(0, 0.10, 0.78);
      pilotPod.add(podBody, podStripe, helmet, goggles);
      wingPivot.add(pilotPod);
      addBar(apex, [0, -0.85, 0.05], 0.010, darkWireMat);
  
      const tipAnchorL = new T.Object3D();
      tipAnchorL.position.set(...tipL);
      const tipAnchorR = new T.Object3D();
      tipAnchorR.position.set(...tipR);
      wingPivot.add(tipAnchorL, tipAnchorR);
  
      // Twin Cyan Wingtip Contrail Ribbons
      const TRAIL_LEN = 38;
      const makeRibbon = () => {
        const arr = new Float32Array(TRAIL_LEN * 3);
        const geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.BufferAttribute(arr, 3));
        const mat = new T.LineBasicMaterial({ color: 0x28d8f0, transparent: true, opacity: 0.82 });
        mat.userData.isWaterCyan = true;
        const line = new T.Line(geo, mat);
        line.frustumCulled = false;
        line.visible = false;
        return { line, arr, pts: Array.from({ length: TRAIL_LEN }, () => new T.Vector3()), inited: false };
      };
      const ribbonL = makeRibbon();
      const ribbonR = makeRibbon();
  
      const tmpL = new T.Vector3(), tmpR = new T.Vector3();
      function updateContrails(active) {
        ribbonL.line.visible = active;
        ribbonR.line.visible = active;
        if (!active) {
          ribbonL.inited = ribbonR.inited = false;
          return;
        }
        root.updateMatrixWorld(true);
        tipAnchorL.getWorldPosition(tmpL);
        tipAnchorR.getWorldPosition(tmpR);
        for (const [rib, tip] of [[ribbonL, tmpL], [ribbonR, tmpR]]) {
          if (!rib.inited) {
            for (const p of rib.pts) p.copy(tip);
            rib.inited = true;
          } else {
            for (let i = rib.pts.length - 1; i > 0; i--) rib.pts[i].copy(rib.pts[i - 1]);
            rib.pts[0].copy(tip);
          }
          for (let i = 0; i < rib.pts.length; i++) {
            rib.arr[i * 3] = rib.pts[i].x;
            rib.arr[i * 3 + 1] = rib.pts[i].y;
            rib.arr[i * 3 + 2] = rib.pts[i].z;
          }
          rib.line.geometry.attributes.position.needsUpdate = true;
        }
      }
  
      return { root, wingPivot, pilotPod, ribbonL, ribbonR, updateContrails };
    }
  window.DWVehicles = {
    wagon(THREE) { T = THREE; return buildWagon(); },
    rogallo(THREE) { T = THREE; return buildRogalloGlider(THREE); },
    truck(THREE) { return window.AbyssinianKits && window.AbyssinianKits.makeIsuzuEscarpmentTruck ? window.AbyssinianKits.makeIsuzuEscarpmentTruck(THREE) : null; }
  };
})();
