/* UP BACK: the next edition. A wet November yard in East Tennessee, built by hand from a set of photographs.

   It starts in the den: a room with one wall and no roof, standing at the bottom of the yard, so the rain falls on the carpet. A
   burgundy wingback chair with a cane hooked on its wing, pleated curtains, a floor vent, a coffee table with a cast-iron pot
   for an ashtray and a can, and on the wall a photograph of "Idlehour", a house that stood four miles east of Knoxville.
   Then he gets up and goes up back, through oak leaves:
     the zero-turn mower with its hood up . the black Denali (one chrome wheel, one not) . the yellow cart and the barrel .
     the fig bush . the Suburban with no grille, by the garage . the Deere track loader . the red-and-white camper on blocks .
     the utility trailer full of leaves . and the Airstream, at the top.
   Ten things to find. The Deere runs: drive it and it clears the leaves.

   Keys: W A S D move where the camera faces . arrows turn . Shift run . E do what is here. On a phone: the left thumb is a stick,
   the right thumb turns the view, and one button does what is here.
   Built on make-photo's cast (CAST_2086) and Mesh2Motion clips. No physics engine: the yard's obstacles are circles. */
(async () => {
  "use strict";
  const T = THREE, $ = id => document.getElementById(id), TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a)), smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const frac = x => x - Math.floor(x), hash = (a, b = 0) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); };
  let seed = 7; const rnd = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };

  /* ---------- the day: overcast, wet, the light flat ---------- */
  const canvas = $("c"), renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(54, 1, .1, 600), SKY = 0xc9ced2; scene.background = new T.Color(SKY); scene.fog = new T.FogExp2(SKY, .012);
  scene.add(new T.HemisphereLight(0xe6ecf2, 0x6a5a48, 1.25)); const sun = new T.DirectionalLight(0xfff4e6, 1.1); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 5, far: 160 }); sun.shadow.bias = -.0006; sun.shadow.radius = 6; scene.add(sun, sun.target);
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }; addEventListener("resize", resize);

  /* ---------- the ground: level by the den, then it climbs. Up back is north, and uphill. ---------- */
  const heightAt = (x, z) => Math.max(0, 22 - z) * .05 + smooth(18, -30, z) * (vn(x * .06 + 3, z * .06) - .5) * 1.4 + smooth(26, 10, z) * vn(x * .3, z * .3) * .08;
  const X0 = -52, X1 = 52, Z0 = -104, Z1 = 46;
  { const g = new T.PlaneGeometry(X1 - X0, Z1 - Z0, 104, 150); g.rotateX(-Math.PI / 2); const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color(), grass = new T.Color("#5f7040"), mud = new T.Color("#4a3a2a"), moss = new T.Color("#6f8a48"), litter = new T.Color("#6e4c30");
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + (X0 + X1) / 2, z = p.getZ(i) + (Z0 + Z1) / 2; p.setXYZ(i, x, heightAt(x, z), z); c.copy(grass).lerp(mud, smooth(.35, .7, vn(x * .12, z * .12))).lerp(moss, smooth(.5, .9, vn(x * .05 + 9, z * .05)) * smooth(-20, -60, z) * smooth(8, 30, x)); c.lerp(litter, smooth(.3, .62, vn(x * .1, z * .1)) * .8 * (1 - smooth(8, 26, x) * smooth(-28, -50, z) * smooth(-96, -80, z))); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute("color", new T.BufferAttribute(col, 3)); g.computeVertexNormals(); const m = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: .92 })); m.receiveShadow = true; scene.add(m); }

  /* ---------- building blocks ---------- */
  const M = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .8 }, o)), SOLID = [];   /* SOLID: circles nobody walks through */
  const box = (par, w, h, d, m, x = 0, y = 0, z = 0) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; par.add(b); return b; };
  const cyl = (par, r0, r1, h, m, x = 0, y = 0, z = 0, seg = 16) => { const b = new T.Mesh(new T.CylinderGeometry(r0, r1, h, seg), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; par.add(b); return b; };
  const tex = (w, h, draw, rep) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
  const place = (g, x, z, ry, solids = []) => { g.position.set(x, heightAt(x, z), z); g.rotation.y = ry; scene.add(g); g.updateMatrixWorld(true); for (const [lx, lz, r] of solids) { const p = new T.Vector3(lx, 0, lz).applyMatrix4(g.matrixWorld); SOLID.push({ x: p.x, z: p.z, r }); } return g; };
  const black = M(0x121212, { roughness: .5 }), rubber = M(0x161616, { roughness: .95 }), glassM = M(0x0c1014, { roughness: .08, metalness: .6 }), chromeM = M(0xcfd4d8, { metalness: 1, roughness: .25 }), steelM = M(0x3a3d40, { metalness: .6, roughness: .6 });
  const wheel = (par, x, z, r, rim) => { const g = new T.Group(); par.add(g); g.position.set(x, r, z); const t = cyl(g, r, r, .3, rubber); t.rotation.x = Math.PI / 2; const h = cyl(g, r * .62, r * .62, .31, rim, 0, 0, 0, 14); h.rotation.x = Math.PI / 2; return g; };
  const label = (text, w, h, fg, bg, font) => tex(256, 64, (q, W, H) => { if (bg) { q.fillStyle = bg; q.fillRect(0, 0, W, H); } q.fillStyle = fg; q.font = font || "700 34px Helvetica, Arial, sans-serif"; q.textAlign = "center"; q.textBaseline = "middle"; q.fillText(text, W / 2, H / 2 + 2); });

  /* a long truck of that make and those years: nose, cab, the long back. Front is +x. */
  function truck(o) { const g = new T.Group(), body = M(o.color, { roughness: .32, metalness: .12 }), low = M(o.low ?? o.color, { roughness: .45, metalness: .1 });
    box(g, 5.5, .5, 2.0, low, 0, .62, 0); box(g, 5.5, .5, 2.02, body, 0, 1.1, 0); box(g, 3.9, .78, 1.9, body, -.75, 1.72, 0); box(g, .5, .2, 1.9, body, 1.38, 1.44, 0).rotation.z = -.5;   /* the sills, the body, the cabin, the windscreen's rake */
    for (const s of [-1, 1]) { for (const [x, w] of [[.62, .95], [-.42, .95], [-1.75, 1.55]]) box(g, w, .5, .02, glassM, x, 1.74, s * .96); box(g, 5.5, .08, .25, black, 0, .42, s * .98); cyl(g, .03, .03, 3.4, black, -.8, 2.16, s * .7).rotation.z = Math.PI / 2; }
    box(g, .02, .5, 1.6, glassM, -2.71, 1.74, 0); box(g, .25, .3, 2.06, black, -2.8, .62, 0); for (const s of [-1, 1]) box(g, .06, .5, .16, M(0xb01818, { emissive: 0x400808 }), -2.76, 1.5, s * .9);
    if (o.noGrille) { box(g, .1, .55, 1.5, M(0x0a0a0a), 2.72, 1.02, 0); for (let k = 0; k < 5; k++) box(g, .06, .1 + rnd() * .3, .08, steelM, 2.76, .9 + rnd() * .3, (k - 2) * .3); box(g, .28, .26, 2.06, M(0x9a9a92, { metalness: .5, roughness: .5 }), 2.76, .6, 0); }
    else { box(g, .08, .5, 1.5, chromeM, 2.76, 1.05, 0); box(g, .3, .28, 2.06, low, 2.78, .6, 0); for (const s of [-1, 1]) box(g, .08, .22, .34, M(0xe8e2c8, { emissive: 0x302810 }), 2.77, 1.12, s * .86); }
    wheel(g, 1.78, 1, .4, o.rims[0]); wheel(g, 1.78, -1, .4, o.rims[0]); wheel(g, -1.6, 1, .4, o.rims[1]); wheel(g, -1.6, -1, .4, o.rims[1]);
    if (o.badge) for (const s of [-1, 1]) { const b = new T.Mesh(new T.PlaneGeometry(.5, .11), new T.MeshBasicMaterial({ map: label(o.badge, 0, 0, "#c9ced2"), transparent: true })); b.position.set(.95, 1.02, s * 1.02); b.rotation.y = s > 0 ? 0 : Math.PI; g.add(b); }
    return g; }

  /* ---------- the den: one wall, a carpet, no roof ---------- */
  const DEN = { x: 0, z: 34 }, den = new T.Group(); den.position.set(DEN.x, 0, DEN.z); scene.add(den);
  { const carpet = tex(256, 256, (q, W, H) => { q.fillStyle = "#9c9788"; q.fillRect(0, 0, W, H); for (let i = 0; i < 9000; i++) { q.fillStyle = ["#6f6c62", "#b9b4a4", "#56544c", "#a8a394"][i % 4]; q.fillRect(Math.random() * W, Math.random() * H, 2, 2); } }, [4, 3]);
    const fl = box(den, 9, .12, 6.4, new T.MeshStandardMaterial({ map: carpet, roughness: 1 }), 0, .06, 0); fl.castShadow = false;
    const wallM = M(0xe6e2d8, { roughness: .95 }), woodM = M(0x6a3e22, { roughness: .6 }), winM = M(0xdfe8ee, { roughness: .1, emissive: 0xb8c4cc, emissiveIntensity: .7 });
    box(den, 9, 3.1, .16, wallM, 0, 1.6, 3.2); box(den, 2.6, 2.0, .06, winM, 1.9, 1.8, 3.1); box(den, 2.8, .1, .12, woodM, 1.9, .78, 3.08); box(den, .1, 2.1, .1, woodM, 1.9, 1.8, 3.06); box(den, 9, .14, .06, woodM, 0, .19, 3.1);   /* the back wall, the window, the baseboard */
    box(den, .16, 3.1, 3.4, wallM, -4.5, 1.6, 1.5);   /* a stub of the west wall */
    /* the curtains: mauve, pinch-pleated, drawn to the left of the window */
    const pleat = tex(256, 64, (q, W, H) => { for (let x = 0; x < W; x++) { const k = .5 + .5 * Math.sin(x / W * TAU * 16), r = Math.round(118 + k * 62), g2 = Math.round(76 + k * 44), b = Math.round(80 + k * 44); q.fillStyle = `rgb(${r},${g2},${b})`; q.fillRect(x, 0, 1, H); } });
    const cur = new T.Mesh(new T.PlaneGeometry(4.4, 2.75, 64, 1), new T.MeshStandardMaterial({ map: pleat, roughness: 1, side: T.DoubleSide })); { const p = cur.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / 4.4 * TAU * 16) * .05); cur.geometry.computeVertexNormals(); } cur.position.set(-1.9, 1.62, 3.0); cur.rotation.y = Math.PI; cur.castShadow = true; den.add(cur);
    box(den, .7, .02, .18, M(0x2a1a12), -.4, .125, 2.2);   /* the floor vent */
    /* the wingback chair, and the cane hooked on its wing */
    const chair = new T.Group(), up = M(0x4a1f26, { roughness: 1 }), leg = M(0x3a1410, { roughness: .4 }); chair.position.set(2.2, .12, 1.3); chair.rotation.y = Math.PI + .5; den.add(chair);
    box(chair, .78, .34, .78, up, 0, .36, 0); box(chair, .62, .16, .62, up, 0, .58, .04); box(chair, .8, 1.0, .18, up, 0, .98, -.36); for (const s of [-1, 1]) { box(chair, .16, .5, .7, up, s * .42, .56, .02); const w = box(chair, .12, .62, .34, up, s * .4, 1.18, -.2); w.rotation.y = -s * .3; for (const z of [.3, -.3]) cyl(chair, .045, .03, .2, leg, s * .32, .1, z); }
    const cane = new T.Group(), caneM = M(0x9a6a30, { roughness: .5 }); cyl(cane, .013, .011, .9, caneM, 0, .45, 0, 8); const hk = new T.Mesh(new T.TorusGeometry(.055, .013, 8, 14, Math.PI), caneM); hk.position.set(.055, .9, 0); cane.add(hk); cane.position.set(1.62, .12, 1.0); cane.rotation.z = -.16; cane.rotation.x = .1; den.add(cane);
    /* the coffee table: the cast-iron pot, the can, two magazines */
    const tb = new T.Group(); tb.position.set(-.6, .12, .9); tb.rotation.y = .25; den.add(tb); box(tb, 1.3, .05, .66, M(0xa8743a, { roughness: .45 }), 0, .44, 0); for (const [x, z] of [[-.58, -.26], [.58, -.26], [-.58, .26], [.58, .26]]) box(tb, .05, .42, .05, M(0x7a5024), x, .21, z);
    const pot = M(0x2a2826, { roughness: .9, metalness: .3 }); cyl(tb, .1, .085, .09, pot, -.2, .51, .05); cyl(tb, .088, .088, .01, M(0xb8b4ac), -.2, .545, .05); for (const s of [-1, 1]) box(tb, .05, .012, .03, pot, -.2 + s * .12, .54, .05);
    cyl(tb, .033, .033, .12, chromeM, .32, .53, .16); cyl(tb, .028, .028, .004, M(0x9aa0a4, { metalness: 1, roughness: .4 }), .32, .592, .16); box(tb, .28, .008, .2, M(0xd8c22a), -.05, .47, -.12).rotation.y = .3; box(tb, .24, .008, .18, M(0x9a2420), .12, .476, -.16).rotation.y = -.2;
    /* the photograph on the wall */
    const photo = tex(512, 384, (q, W, H) => { q.fillStyle = "#e9e6dc"; q.fillRect(0, 0, W, H); q.fillStyle = "#c9c8c0"; q.fillRect(20, 18, W - 40, H - 84); q.fillStyle = "#8f8f88"; q.fillRect(20, H - 150, W - 40, 84); q.fillStyle = "#b9b8b0"; q.beginPath(); q.moveTo(20, H - 66); q.lineTo(W - 20, H - 66); q.lineTo(W - 20, H - 110); q.lineTo(180, H - 96); q.closePath(); q.fill();
      const hs = (x, y, w, h, c) => { q.fillStyle = c; q.fillRect(x, y, w, h); }; hs(150, 120, 230, 120, "#77776f"); hs(170, 96, 190, 30, "#55554f"); hs(250, 70, 16, 34, "#6a6a62"); hs(80, 150, 90, 90, "#82827a"); hs(366, 160, 80, 80, "#82827a"); hs(70, 196, 120, 8, "#d8d6cc"); hs(150, 190, 240, 8, "#d8d6cc"); hs(150, 150, 240, 6, "#d8d6cc");
      for (let k = 0; k < 16; k++) hs(80 + k * 22, 196, 3, 46, "#deddd2"); for (let k = 0; k < 8; k++) hs(170 + k * 26, 128, 12, 18, "#3a3a36");
      q.fillStyle = "#3a3a36"; for (const [x, r] of [[60, 60], [330, 54], [440, 40]]) { q.fillRect(x - 3, 40, 6, 200); for (let k = 0; k < 40; k++) { q.beginPath(); q.arc(x + (Math.random() - .5) * r * 2, 60 + Math.random() * 90, 6 + Math.random() * 10, 0, TAU); q.fill(); } }
      const im = q.getImageData(0, 0, W, H - 60); for (let i = 0; i < im.data.length; i += 4) { const n = (Math.random() - .5) * 46; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; } q.putImageData(im, 0, 0);
      q.fillStyle = "#3a3a36"; q.font = "600 13px Georgia, serif"; q.textAlign = "center"; q.fillText("“IDLEHOUR,” FOUR MILES EAST OF KNOXVILLE", W / 2, H - 30); });
    /* it hangs on the stub wall, beside the curtains */
    box(den, .05, .94, 1.22, M(0x2a1e16), -4.4, 1.7, 1.6).castShadow = false; const ph = new T.Mesh(new T.PlaneGeometry(1.1, .82), new T.MeshStandardMaterial({ map: photo, roughness: .9 })); ph.position.set(-4.37, 1.7, 1.6); ph.rotation.y = Math.PI / 2; den.add(ph);
    for (const [x, z, r] of [[2.2, 1.3, .6], [-.6, .9, .7], [-4.5, 1.5, .5], [-4.5, 2.8, .5]]) SOLID.push({ x: DEN.x + x, z: DEN.z + z, r }); for (let k = -4; k <= 4; k++) SOLID.push({ x: DEN.x + k, z: DEN.z + 3.3, r: .6 }); }
  const CHAIR = { x: DEN.x + 2.2, z: DEN.z + 1.3, h: Math.PI + .5 };

  /* ---------- what is up back ---------- */
  const mower = new T.Group(); { const y = M(0xe0a020, { roughness: .5 }); box(mower, 1.5, .1, 1.25, y, .2, .3, 0); box(mower, 1.0, .5, .8, y, -.5, .62, 0); const hood = box(mower, .9, .06, .8, y, -.75, 1.25, 0); hood.rotation.z = -1.0; box(mower, .5, .4, .5, M(0x1a1a1a, { roughness: .6 }), -.45, 1.0, 0); cyl(mower, .12, .12, .3, M(0xb85a2a), -.3, 1.3, .2); box(mower, .3, .28, .34, black, .15, .78, -.4);
    for (const s of [-1, 1]) { const w = cyl(mower, .3, .3, .3, rubber, -.5, .3, s * .62); w.rotation.x = Math.PI / 2; const c = cyl(mower, .12, .12, .1, rubber, .85, .12, s * .5); c.rotation.x = Math.PI / 2; const b = cyl(mower, .02, .02, .9, black, .1, 1.0, s * .42, 8); b.rotation.z = .2; } }
  place(mower, -5.5, 24, .4, [[0, 0, 1.1]]);
  const denali = place(truck({ color: 0x0c0c0d, rims: [chromeM, M(0x1a1a1c, { roughness: .6 })], badge: "DENALI" }), -9, 2, .12, [[1.6, 0, 1.5], [-.3, 0, 1.5], [-2, 0, 1.5]]);
  const suburban = place(truck({ color: 0x6c6e5a, low: 0xaaa696, rims: [M(0x9a9a90, { metalness: .6, roughness: .5 }), M(0x9a9a90, { metalness: .6, roughness: .5 })], noGrille: true }), 9.5, 12, -.25, [[1.6, 0, 1.5], [-.3, 0, 1.5], [-2, 0, 1.5]]);
  { const fl = new T.Mesh(new T.TorusGeometry(.42, .16, 8, 16, Math.PI), black); fl.position.set(-3.1, .1, 1.3); fl.rotation.y = .4; suburban.add(fl); }   /* the fender liner on the ground behind it */
  /* the garage: lap siding, a shingle roof, leaves on it */
  { const g = new T.Group(), side = tex(128, 128, (q, W, H) => { for (let j = 0; j < 8; j++) { q.fillStyle = j % 2 ? "#7a6450" : "#84705a"; q.fillRect(0, j * 16, W, 16); q.fillStyle = "rgba(30,20,12,.5)"; q.fillRect(0, j * 16 + 14, W, 2); } }, [5, 2]);
    box(g, 10, 2.9, 7.5, new T.MeshStandardMaterial({ map: side, roughness: .95 }), 0, 1.45, 0); const roof = new T.Mesh(new T.ConeGeometry(7.6, 2.2, 4), M(0x5f646a, { roughness: .95, flatShading: true })); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, .8); roof.position.y = 4.0; roof.castShadow = true; g.add(roof); box(g, .9, 2.0, .06, M(0xb8bcc0), -3.2, 1.0, 3.78);
    place(g, 19, 10, 0); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) SOLID.push({ x: 19 + i * 3.6, z: 10 + j * 2.6, r: 2.3 }); }
  /* the yellow cart, the white barrel in its liner */
  { const g = new T.Group(), y = M(0xd8b42a, { roughness: .6 }); box(g, 1.3, .04, .7, y, 0, .5, 0); for (const [w, d, x, z] of [[1.3, .02, 0, .35], [1.3, .02, 0, -.35], [.02, .7, .65, 0], [.02, .7, -.65, 0]]) box(g, w, .3, d, y, x, .65, z); for (const [x, z] of [[.5, .36], [.5, -.36], [-.5, .36], [-.5, -.36]]) { const w = cyl(g, .17, .17, .1, rubber, x, .17, z); w.rotation.x = Math.PI / 2; } box(g, 1.2, .04, .62, M(0x8a5a30), 0, .56, 0);
    place(g, -13.2, .2, .2, [[0, 0, .8]]); const b = new T.Group(); cyl(b, .32, .3, .9, M(0xe8e6e0, { roughness: .6 }), 0, .45, 0); cyl(b, .36, .34, .14, M(0xf4f4f0, { transparent: true, opacity: .7 }), 0, .86, 0); cyl(b, .3, .3, .02, M(0x7a4a26), 0, .9, 0); place(b, -14.8, .4, 0, [[0, 0, .5]]); }

  /* the Deere: a track loader. It runs. */
  const deere = new T.Group(), DEERE = { x: 4, z: -16, h: Math.PI * .9, sp: 0, on: false }; { const y = M(0xdcb21e, { roughness: .6 }), trk = M(0x3a2e24, { roughness: 1 }), grid = tex(64, 64, (q, W, H) => { q.clearRect(0, 0, W, H); q.strokeStyle = "#0c0c0c"; q.lineWidth = 3; for (let k = 0; k <= 8; k++) { q.beginPath(); q.moveTo(k * 8, 0); q.lineTo(k * 8, H); q.stroke(); q.beginPath(); q.moveTo(0, k * 8); q.lineTo(W, k * 8); q.stroke(); } });
    for (const s of [-1, 1]) { box(deere, 2.3, .34, .42, trk, 0, .2, s * .78); box(deere, 1.5, .34, .42, trk, -.2, .52, s * .78); cyl(deere, .2, .2, .44, steelM, .95, .22, s * .78).rotation.x = Math.PI / 2; cyl(deere, .2, .2, .44, steelM, -.95, .22, s * .78).rotation.x = Math.PI / 2;
      const arm = box(deere, 2.5, .28, .16, y, .1, 1.2, s * .62); arm.rotation.z = -.28; const d = new T.Mesh(new T.PlaneGeometry(.9, .22), new T.MeshBasicMaterial({ map: label("DEERE", 0, 0, "#f2f2ec", "#6a6c66") })); d.position.set(-.1, 1.28, s * .71); d.rotation.set(0, s > 0 ? 0 : Math.PI, s * -.28); deere.add(d);
      const cage = new T.Mesh(new T.PlaneGeometry(1.0, .95), new T.MeshBasicMaterial({ map: grid, transparent: true, side: T.DoubleSide })); cage.position.set(-.2, 1.95, s * .5); deere.add(cage); for (const x of [-.72, .3]) box(deere, .08, 1.0, .08, black, x, 1.95, s * .5); }
    box(deere, 2.1, .7, 1.1, y, -.1, 1.0, 0); box(deere, 1.1, .08, 1.08, black, -.2, 2.46, 0); box(deere, .9, .5, .9, black, -.95, 1.6, 0); box(deere, .1, .9, 1.7, y, 1.5, .5, 0); box(deere, .5, .06, 1.7, steelM, 1.72, .1, 0); deere.userData.seat = new T.Vector3(-.2, 1.3, 0); scene.add(deere); }
  /* the camper: red and white, on blocks, leaning into the ivy; a bicycle behind it, a folding chair, another barrel */
  const camper = new T.Group(); { const skin = tex(256, 256, (q, W, H) => { const bands = [["#e9e7e2", .38], ["#a8281e", .16], ["#e9e7e2", .16], ["#a8281e", .3]]; let y = 0; for (const [c, h] of bands) { q.fillStyle = c; q.fillRect(0, y * H, W, h * H + 1); y += h; } q.strokeStyle = "rgba(0,0,0,.14)"; for (let j = 0; j < 32; j++) { q.beginPath(); q.moveTo(0, j * 8); q.lineTo(W, j * 8); q.stroke(); } for (let i = 0; i < 60; i++) { q.fillStyle = `rgba(40,50,30,${.05 + Math.random() * .12})`; q.fillRect(Math.random() * W, 0, 3 + Math.random() * 8, Math.random() * H * .6); } });
    const sm = new T.MeshStandardMaterial({ map: skin, roughness: .7, metalness: .2 }), shell = new T.Group(); camper.add(shell); shell.rotation.set(.05, 0, .07); shell.position.y = .1;
    box(shell, 3.5, 2.0, 2.0, sm, 0, 1.6, 0); const cap = cyl(shell, .6, .6, 2.0, sm, 1.45, 2.3, 0, 12); cap.rotation.x = Math.PI / 2; box(shell, .7, 1.5, .04, M(0xe4e2dc), .5, 1.45, 1.02); box(shell, .36, .4, .05, glassM, .5, 1.85, 1.03); box(shell, .5, .3, .05, glassM, 1.76, 1.9, .3); box(shell, 1.6, .05, .5, steelM, .3, 2.66, 1.1).rotation.x = .3;
    const w = cyl(camper, .3, .3, .2, rubber, -.4, .3, 1.0); w.rotation.x = Math.PI / 2; box(camper, .4, .2, .4, M(0x9a9a94), 1.3, .1, .7); box(camper, 1.3, .1, .12, M(0xa8281e), 2.3, .55, 0).rotation.y = .2; box(camper, 1.3, .1, .12, M(0xa8281e), 2.3, .55, 0).rotation.y = -.2;
    const fc = new T.Group(); box(fc, .5, .04, .5, M(0x2a4a8a), 0, .42, 0); box(fc, .5, .5, .04, M(0x2a4a8a), 0, .7, -.25); for (const [x, z] of [[.22, .22], [-.22, .22], [.22, -.22], [-.22, -.22]]) cyl(fc, .012, .012, .42, steelM, x, .21, z, 6); fc.position.set(2.6, 0, 1.1); fc.rotation.y = -.6; camper.add(fc);
    cyl(camper, .42, .4, .7, M(0xe8e6e0), 3.3, .35, 1.6); cyl(camper, .4, .4, .02, M(0x6a4426), 3.3, .71, 1.6);
    const bike = new T.Group(), red = M(0x9a2a22); for (const x of [-.5, .5]) { const t = new T.Mesh(new T.TorusGeometry(.33, .025, 6, 20), rubber); t.position.set(x, .35, 0); bike.add(t); } for (const [a, b] of [[[-.5, .35], [0, .7]], [[0, .7], [.4, .78]], [[.4, .78], [.5, .35]], [[0, .7], [-.05, .35]], [[-.05, .35], [-.5, .35]]]) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), t = cyl(bike, .018, .018, L, red, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0, 6); t.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2; } bike.position.set(-2.4, 0, -.2); bike.rotation.set(0, .5, .25); camper.add(bike); }
  place(camper, -19, -38, .35, [[.9, 0, 1.4], [-.9, 0, 1.4], [3.3, 1.6, .6]]);
  /* the old blue trailer tongue lying near it, a wiring harness on it */
  { const g = new T.Group(), bl = M(0x2a4a7a, { roughness: .7, metalness: .3 }); for (const s of [-1, 1]) { const b = box(g, 2.6, .12, .14, M(0x1a1c22), -1.2, .3, s * .5); b.rotation.y = s * .32; } box(g, .5, .16, .2, bl, .3, .34, 0); cyl(g, .03, .03, .5, steelM, -.4, .5, 0, 8); box(g, .6, .1, .3, steelM, -1.3, .42, .1); place(g, -12.5, -31, -.9, [[-.8, 0, .9]]); }
  /* the utility trailer: black rail, mesh gate up, a white wheel, a deck of leaves */
  const trailer = new T.Group(); { const gateT = tex(64, 64, (q, W, H) => { q.clearRect(0, 0, W, H); q.strokeStyle = "#141414"; q.lineWidth = 2; for (let k = -8; k <= 16; k++) { q.beginPath(); q.moveTo(k * 8, 0); q.lineTo(k * 8 + 64, 64); q.stroke(); q.beginPath(); q.moveTo(k * 8 + 64, 0); q.lineTo(k * 8, 64); q.stroke(); } }, [4, 3]);
    box(trailer, 3.6, .08, 1.9, M(0x4a3626, { roughness: 1 }), 0, .55, 0); for (const s of [-1, 1]) { box(trailer, 3.6, .05, .05, black, 0, .92, s * .95); box(trailer, 3.6, .08, .06, black, 0, .56, s * .95); for (let k = 0; k < 6; k++) box(trailer, .04, .36, .04, black, -1.75 + k * .7, .74, s * .95); const w = wheel(trailer, -.2, s * 1.1, .3, M(0xf2f2ee, { roughness: .5 })); w.position.y = .3; }
    box(trailer, .05, .36, 1.9, black, 1.78, .74, 0); const gate = new T.Mesh(new T.PlaneGeometry(1.9, 1.4), new T.MeshBasicMaterial({ map: gateT, transparent: true, side: T.DoubleSide })); gate.position.set(-1.8, 1.25, 0); gate.rotation.y = Math.PI / 2; trailer.add(gate); box(trailer, .06, 1.45, .06, black, -1.8, 1.25, .95); box(trailer, .06, 1.45, .06, black, -1.8, 1.25, -.95); box(trailer, 1.5, .08, .08, black, 2.5, .5, 0); }
  place(trailer, -6, -47, .05, [[1, 0, 1.2], [-1, 0, 1.2]]);
  /* the tarp over something, two tyres, the three-legged ladder */
  { const g = new T.Group(), tp = new T.Mesh(new T.SphereGeometry(1.1, 10, 6, 0, TAU, 0, Math.PI / 2), M(0x5a6068, { roughness: .5, flatShading: true })); tp.scale.set(1.2, .5, .9); tp.castShadow = true; g.add(tp); for (const [x, z] of [[-1.8, .4], [-2.3, -.3]]) { const t = new T.Mesh(new T.TorusGeometry(.3, .12, 8, 16), rubber); t.rotation.x = Math.PI / 2; t.position.set(x, .12, z); g.add(t); }
    for (const a of [0, 2.1, 4.2]) { const l = cyl(g, .025, .025, 3.2, M(0x9a8a6a), 1.2 + Math.cos(a) * .5, 1.5, -1.6 + Math.sin(a) * .5, 6); l.rotation.set(Math.sin(a) * .3, 0, -Math.cos(a) * .3); } place(g, 8, -62, .3, [[0, 0, 1.3]]); }
  /* the Airstream, gone the colour of the sky */
  const air = new T.Group(); { const al = tex(256, 128, (q, W, H) => { q.fillStyle = "#a9aeb0"; q.fillRect(0, 0, W, H); for (let i = 0; i < 400; i++) { q.fillStyle = `rgba(${60 + Math.random() * 40},${64 + Math.random() * 30},${60 + Math.random() * 20},${.04 + Math.random() * .1})`; q.fillRect(Math.random() * W, Math.random() * H, 4 + Math.random() * 14, 10 + Math.random() * 50); } q.strokeStyle = "rgba(20,20,20,.35)"; for (let k = 0; k <= 8; k++) { q.beginPath(); q.moveTo(k * 32, 0); q.lineTo(k * 32, H); q.stroke(); } q.beginPath(); q.moveTo(0, 60); q.lineTo(W, 60); q.stroke(); });
    const shell = new T.Mesh(new T.CapsuleGeometry(1.2, 5.2, 10, 24), new T.MeshStandardMaterial({ map: al, metalness: .4, roughness: .36 })); shell.rotation.z = Math.PI / 2; shell.scale.set(1, 1, .95); shell.position.y = 1.75; shell.castShadow = true; air.add(shell);
    for (const x of [-1.8, -.4, 1.4]) box(air, .7, .4, .04, glassM, x, 2.1, 1.1); box(air, .65, 1.5, .04, M(0x8f9496, { metalness: .7, roughness: .5 }), .5, 1.5, 1.14); for (const x of [-.6, .1]) { wheel(air, x, 1.0, .3, steelM); wheel(air, x, -1.0, .3, steelM); } box(air, 1.4, .1, .1, steelM, 4.3, .6, 0); }
  place(air, 22, -74, .28, [[2.2, 0, 1.5], [0, 0, 1.5], [-2.2, 0, 1.5]]);

  /* the trough gate, past the Airstream: the way on from here (atlas/trough-gate.js) */
  const GATE = { x: 8, z: -90 }, TG = window.TroughGate ? place(window.TroughGate.build(T), GATE.x, GATE.z, .2, [[0, 0, 1.6]]) : null;

  /* ---------- the fig bush, behind the Denali: yellow going, a few figs the frost missed ---------- */
  const FIG = { x: -13.5, z: -6.5, left: 0, figs: [] }, leafShape = (() => { const s = new T.Shape(), P = [[0, -.5], [.12, -.3], [.3, -.34], [.26, -.12], [.46, -.04], [.3, .1], [.4, .3], [.18, .28], [.12, .48], [0, .36]]; s.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) s.lineTo(P[i][0], P[i][1]); for (let i = P.length - 2; i > 0; i--) s.lineTo(-P[i][0], P[i][1]); s.closePath(); const g = new T.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g; })();
  { const g = new T.Group(), y0 = heightAt(FIG.x, FIG.z), bark = M(0x8a8478, { roughness: .9 }), N = 170, lv = new T.InstancedMesh(leafShape, new T.MeshStandardMaterial({ roughness: .6, side: T.DoubleSide }), N), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), c = new T.Color(); let n = 0;
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU + rnd(), lean = .25 + rnd() * .45, h = 2.2 + rnd() * 1.4, st = cyl(g, .03, .05, h, bark, Math.sin(a) * lean * h * .5, h * .5 * Math.cos(lean), Math.cos(a) * lean * h * .5, 6); st.rotation.set(Math.cos(a) * lean, 0, -Math.sin(a) * lean);
      for (let j = 0; j < 18 && n < N; j++) { const t = .35 + rnd() * .65, px = Math.sin(a) * lean * h * t + (rnd() - .5) * .7, py = h * t * Math.cos(lean) + (rnd() - .5) * .4, pz = Math.cos(a) * lean * h * t + (rnd() - .5) * .7, s = .34 + rnd() * .22; m4.compose(new T.Vector3(px, py, pz), q.setFromEuler(e.set((rnd() - .5) * 1.4, rnd() * TAU, (rnd() - .5) * 1.4)), new T.Vector3(s, s, s)); lv.setMatrixAt(n, m4); lv.setColorAt(n++, c.set(["#b8c832", "#d4d02a", "#9ab83a", "#e0c22e", "#c8a82a"][Math.floor(rnd() * 5)])); }
      if (k < 6) { const f = new T.Mesh(new T.SphereGeometry(.05, 10, 8), M(0x5a2f5e, { roughness: .5 })); f.scale.y = 1.25; f.position.set(Math.sin(a) * lean * h * .8, h * .8 * Math.cos(lean) - .1, Math.cos(a) * lean * h * .8); g.add(f); FIG.figs.push(f); } }
    lv.count = n; lv.castShadow = true; g.add(lv); g.position.set(FIG.x, y0, FIG.z); scene.add(g); FIG.left = FIG.figs.length; SOLID.push({ x: FIG.x, z: FIG.z, r: .7 }); }

  /* ---------- the woods: bare hardwoods in one draw, ivy up some, a few oaks still holding brown, privet underneath ---------- */
  { const mats = [], ivy = [], brown = [], shrubs = [], m4 = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), v = new T.Vector3();
    const limb = (a, b, r) => { v.copy(b).sub(a); const L = v.length(); mats.push(m4.compose(a.clone().add(b).multiplyScalar(.5), q.setFromUnitVectors(up, v.normalize()), new T.Vector3(r, L, r)).clone()); };
    const grow = (a, dir, len, r, d, holds) => { const b = a.clone().addScaledVector(dir, len); limb(a, b, r); if (d === 0) { if (holds && rnd() < .7) brown.push(b.clone()); return; } const n = d > 2 ? 2 : 2 + (rnd() < .4 ? 1 : 0); for (let k = 0; k < n; k++) { const nd = dir.clone().add(new T.Vector3((rnd() - .5) * 1.5, .25 + rnd() * .5, (rnd() - .5) * 1.5)).normalize(); grow(b, nd, len * (.62 + rnd() * .2), r * .62, d - 1, holds); } };
    const clear = (x, z) => Math.hypot(x - DEN.x, z - DEN.z) > 11 && !(Math.abs(x) < 15 && z < 28 && z > -62) && Math.hypot(x - 22, z + 74) > 7 && Math.hypot(x + 19, z + 38) > 4.5 && !(x > 12 && x < 27 && z > 3 && z < 17);
    for (let i = 0; i < 95; i++) { const x = X0 + 4 + rnd() * (X1 - X0 - 8), z = Z0 + 4 + rnd() * (Z1 - Z0 - 14); if (!clear(x, z)) continue; const y = heightAt(x, z), h = 5 + rnd() * 5, r = .16 + rnd() * .16, holds = rnd() < .22; grow(new T.Vector3(x, y - .2, z), new T.Vector3((rnd() - .5) * .12, 1, (rnd() - .5) * .12).normalize(), h, r, 4, holds); SOLID.push({ x, z, r: r + .25 });
      if (rnd() < .3) for (let k = 0; k < 16; k++) ivy.push(new T.Vector3(x + (rnd() - .5) * r * 3, y + .3 + rnd() * h, z + (rnd() - .5) * r * 3)); }
    for (const [x, z] of [[-3, 6], [3, -30], [12, -52], [-12, -22], [16, -66]]) { const y = heightAt(x, z); grow(new T.Vector3(x, y - .2, z), up.clone(), 7, .26, 4, x > 0); SOLID.push({ x, z, r: .5 }); }   /* the yard's own trees */
    for (let i = 0; i < 150; i++) { const x = X0 + 2 + rnd() * (X1 - X0 - 4), z = Z0 + 2 + rnd() * (Z1 - Z0 - 12); if (clear(x, z) && (Math.abs(x) > 24 || z < -80 || rnd() < .12)) shrubs.push(new T.Vector3(x, heightAt(x, z) + .7, z)); }
    const inst = (geo, mat, list, f) => { const im = new T.InstancedMesh(geo, mat, list.length), c = new T.Color(); list.forEach((p, i) => f(i, p, im, c)); im.castShadow = true; im.receiveShadow = true; scene.add(im); return im; };
    inst(new T.CylinderGeometry(.7, 1, 1, 6), M(0x2e2924, { roughness: 1 }), mats, (i, m, im) => im.setMatrixAt(i, m));
    inst(new T.IcosahedronGeometry(.34, 0), M(0xffffff, { roughness: .8, flatShading: true }), ivy, (i, p, im, c) => { im.setMatrixAt(i, m4.compose(p, q.identity(), new T.Vector3(1, 1.3, 1))); im.setColorAt(i, c.set(["#2e4a2a", "#3a5a30", "#27402a"][i % 3])); });
    inst(new T.IcosahedronGeometry(1, 0), M(0xffffff, { roughness: .9, flatShading: true }), brown, (i, p, im, c) => { const s = .6 + hash(i) * .9; im.setMatrixAt(i, m4.compose(p, q.setFromAxisAngle(up, i), new T.Vector3(s, s * .7, s))); im.setColorAt(i, c.set(["#a8603a", "#8a4a2a", "#b8743e", "#96503a"][i % 4])); });
    inst(new T.IcosahedronGeometry(1, 1), M(0xffffff, { roughness: .9, flatShading: true }), shrubs, (i, p, im, c) => { const s = .9 + hash(i, 2) * 1.3; im.setMatrixAt(i, m4.compose(p, q.setFromAxisAngle(up, i), new T.Vector3(s * 1.2, s * .8, s * 1.2))); im.setColorAt(i, c.set(["#b8c63e", "#8fa838", "#5f7a34", "#d0cc48", "#4a6a34"][i % 5])); }); }

  /* ---------- the leaves: oak, sweetgum, magnolia, down and wet. Walk through them and they move; the Deere moves them all. ---------- */
  const NL = 17000, LV = { x: new Float32Array(NL), z: new Float32Array(NL), r: new Float32Array(NL), s: new Float32Array(NL), vx: new Float32Array(NL), vz: new Float32Array(NL), t: new Float32Array(NL), moved: new Uint8Array(NL), live: new Set(), cleared: 0 };
  const leaves = new T.InstancedMesh(leafShape, new T.MeshStandardMaterial({ roughness: .5, side: T.DoubleSide }), NL), _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3();
  const setLeaf = (i, lift = 0, tilt = 0) => { _m.compose(_p.set(LV.x[i], heightAt(LV.x[i], LV.z[i]) + .03 + lift, LV.z[i]), _q.setFromEuler(_e.set(tilt, LV.r[i], tilt * .7)), _s.setScalar(LV.s[i])); leaves.setMatrixAt(i, _m); };
  { const c = new T.Color(), COL = ["#b0703a", "#8f5630", "#c4904a", "#a88a70", "#d8a84a", "#7a4a2c", "#c0a890", "#e0be5a", "#9a6a4a"]; let i = 0, guard = 0;
    while (i < NL && guard++ < NL * 6) { const yardy = i < NL * .72, x = yardy ? -30 + rnd() * 60 : X0 + 3 + rnd() * (X1 - X0 - 6), z = yardy ? -72 + rnd() * 102 : Z0 + 3 + rnd() * (Z1 - Z0 - 6), lawn = smooth(8, 26, x) * smooth(-28, -50, z) * smooth(-96, -80, z); if (rnd() < lawn * .85 || rnd() > .45 + vn(x * .1, z * .1) * .9) continue; if (Math.abs(x - DEN.x) < 4.5 && Math.abs(z - DEN.z) < 3.2 && rnd() < .93) continue;
      LV.x[i] = x; LV.z[i] = z; LV.r[i] = rnd() * TAU; LV.s[i] = .2 + rnd() * .16; setLeaf(i); leaves.setColorAt(i, c.set(COL[Math.floor(rnd() * COL.length)]).multiplyScalar(.75 + rnd() * .4)); i++; }
    leaves.count = i; leaves.receiveShadow = true; leaves.frustumCulled = false; scene.add(leaves); LV.n = i; }
  function pushLeaves(px, pz, r, vx, vz, k, mark) { const r2 = r * r; for (let i = 0; i < LV.n; i++) { const dx = LV.x[i] - px, dz = LV.z[i] - pz, d2 = dx * dx + dz * dz; if (d2 > r2) continue; const d = Math.sqrt(d2) || .01, f = (1 - d / r) * k; LV.vx[i] += dx / d * f + vx * .5; LV.vz[i] += dz / d * f + vz * .5; LV.t[i] = 0; LV.live.add(i); if (mark && !LV.moved[i]) { LV.moved[i] = 1; LV.cleared++; } } }
  function leafStep(dt) { if (!LV.live.size) return; for (const i of LV.live) { LV.t[i] += dt; LV.x[i] = clamp(LV.x[i] + LV.vx[i] * dt, X0 + 1, X1 - 1); LV.z[i] = clamp(LV.z[i] + LV.vz[i] * dt, Z0 + 1, Z1 - 1); const k = Math.exp(-dt * 3.2); LV.vx[i] *= k; LV.vz[i] *= k; const sp = Math.hypot(LV.vx[i], LV.vz[i]); LV.r[i] += sp * dt * 2; if (sp < .08) { LV.vx[i] = LV.vz[i] = 0; LV.live.delete(i); setLeaf(i); } else setLeaf(i, Math.min(.35, sp * .09) * Math.abs(Math.sin(LV.t[i] * 9)), sp * .5); } leaves.instanceMatrix.needsUpdate = true; }

  /* ---------- rain ---------- */
  const RN = 900, rainP = new Float32Array(RN * 6), rainG = new T.BufferGeometry(); rainG.setAttribute("position", new T.BufferAttribute(rainP, 3)); const rain = new T.LineSegments(rainG, new T.LineBasicMaterial({ color: 0xe8eef2, transparent: true, opacity: .32 })); rain.frustumCulled = false; scene.add(rain);
  const drops = Array.from({ length: RN }, () => ({ x: (Math.random() - .5) * 36, y: Math.random() * 16, z: (Math.random() - .5) * 36 }));

  /* ---------- him ---------- */
  $("boot-s").textContent = "Waking him…";
  let me = null, motion = null; try { me = window.CAST_2086.make(T, "tex", { ownColors: true, name: "Up Back", scale: 1.0, build: .9, fem: .05, skinHex: 0x3e2618, beard: true, hairHex: 0xb9afa2, hair: "feltHat", hatHex: 0x3a3632, outer: "duster", coatHex: 0x7d838a, shirtHex: 0xe8e6e0, trouserHex: 0x3a4048 }); } catch (e) { console.warn("cast", e); }
  if (me) { if (me.label && me.label.sprite) me.label.sprite.visible = false; scene.add(me.group); me.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    try { motion = window.Mesh2MotionWorldBridge.createWorldCastDriver(T, { clipsBaseUrl: "../motion-pipeline/mesh2motion/clips", preload: ["idle", "walk", "jog", "sitting-idle"], defaultBlend: 1, defaultFade: .25 }); motion.registerActor("me", me, { defaultClip: "sitting-idle", blend: 1 }); } catch (e) { console.warn("motion", e); motion = null; } }
  else { me = { group: new T.Group() }; box(me.group, .5, 1.7, .3, M(0x7d838a), 0, .85, 0); scene.add(me.group); }
  const st = { x: CHAIR.x, z: CHAIR.z, y: .12, h: CHAIR.h, mode: "sit", speed: 0, stride: 0 }, CAM = { yaw: Math.PI * .1, pitch: 0 }, PAD = { mx: 0, my: 0, look: false, touch: false, sid: null, lid: null, sx: 0, sy: 0, lx: 0, ly: 0 };

  /* ---------- sound: rain, leaves underfoot, a crow, the Deere ---------- */
  const S = (() => { let ctx = null, master, eng = null; const noise = sec => { const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; };
    function wake() { if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; } ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .8; master.connect(ctx.destination);
      for (const [type, f, q, g] of [["bandpass", 2600, .5, .09], ["lowpass", 420, .7, .12]]) { const s = ctx.createBufferSource(); s.buffer = noise(3); s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const gn = ctx.createGain(); gn.gain.value = g; s.connect(fl).connect(gn).connect(master); s.start(); } }
    const burst = (sec, type, f, gain, q = 1) => { if (!ctx) return; const s = ctx.createBufferSource(); s.buffer = noise(sec); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(), t = ctx.currentTime; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + sec); s.connect(fl).connect(g).connect(master); s.start(); };
    const tone = (f0, f1, sec, gain, type = "sine", at = 0) => { if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at; o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + sec); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .02); g.gain.exponentialRampToValueAtTime(.0008, t + sec); o.connect(g).connect(master); o.start(t); o.stop(t + sec + .05); };
    return { wake, step(carpet) { carpet ? burst(.08, "lowpass", 260, .12) : (burst(.13, "highpass", 2400 + Math.random() * 1500, .16), burst(.1, "lowpass", 300, .14)); },
      crow() { for (let k = 0; k < 3; k++) { tone(760, 520, .22, .05, "sawtooth", k * .34); tone(1180, 800, .2, .025, "square", k * .34); } },
      knock() { for (let k = 0; k < 3; k++) setTimeout(() => burst(.09, "lowpass", 300, .7), k * 260); }, ring() { tone(196, 190, 2.2, .1, "sine"); tone(392.6, 388, 1.6, .04, "sine"); burst(.05, "highpass", 3000, .2); },
      pick() { tone(520, 780, .12, .06, "triangle"); }, chime() { [523, 659, 784].forEach((f, i) => tone(f, f, .8, .05, "triangle", i * .11)); }, door() { burst(.2, "lowpass", 180, .8); tone(90, 60, .2, .2, "sine"); },
      sputter() { for (let k = 0; k < 7; k++) setTimeout(() => { burst(.07, "lowpass", 240, .5); tone(70 + k * 4, 50, .08, .2, "sawtooth"); }, k * (110 + k * 30)); },
      engine(on) { if (!ctx) return; if (on && !eng) { const g = ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(.16, ctx.currentTime + .6); const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; const os = [41, 61.5, 82.4].map((f, i) => { const o = ctx.createOscillator(); o.type = i ? "square" : "sawtooth"; o.frequency.value = f; o.connect(lp); o.start(); return o; }); const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 13; lg.gain.value = .06; lfo.connect(lg).connect(g.gain); lfo.start(); lp.connect(g).connect(master); eng = { g, os, lfo, f: [41, 61.5, 82.4] }; }
        if (!on && eng) { const e = eng; eng = null; e.g.gain.linearRampToValueAtTime(0, ctx.currentTime + .5); setTimeout(() => { e.os.forEach(o => o.stop()); e.lfo.stop(); }, 700); } },
      rev(k) { if (eng) eng.os.forEach((o, i) => { o.frequency.value = eng.f[i] * (1 + k * .55); }); } }; })();

  /* ---------- ten things to find ---------- */
  const FINDS = [["chair", "Get up out of the chair"], ["photo", "Look at the photograph on the wall"], ["mower", "Try the mower"], ["denali", "The black Denali"], ["fig", "Pick a fig"], ["suburban", "The Suburban by the garage"], ["deere", "Start the Deere"], ["camper", "Knock on the camper"], ["trailer", "The trailer of leaves"], ["air", "Walk up to the Airstream"]], done = {};
  const nextUp = () => { const n = FINDS.find(([k]) => !done[k]); $("next").textContent = n ? n[1] : `All ten. ${LV.cleared} leaves moved with the Deere.`; }; nextUp();
  let lineT = 0; const say = (t, sec = 4) => { $("line").textContent = t; $("line").classList.add("on"); lineT = sec; };
  const found = (k, line) => { if (line) say(line, 5); if (done[k]) return; done[k] = true; S.chime(); nextUp(); if (FINDS.every(([f]) => done[f])) setTimeout(() => say("That is everything up back. Past the Airstream, the blue light is the way on.", 6), 5500); };
  const dist = (x, z) => Math.hypot(st.x - x, st.z - z), wp = (g, x, z) => _p.set(x, 0, z).applyMatrix4(g.matrixWorld);
  function offer() {
    if (st.mode === "sit") return { label: "Get up", run: () => { st.mode = "foot"; st.x = CHAIR.x + Math.sin(CHAIR.h) * .7; st.z = CHAIR.z + Math.cos(CHAIR.h) * .7; CAM.yaw = Math.PI; found("chair", "The cane stays where it is, hooked on the wing of the chair."); } };
    if (st.mode === "deere") return Math.abs(DEERE.sp) < .4 ? { label: "Climb down", run: () => { st.mode = "foot"; S.engine(false); me.group.visible = true; st.x = DEERE.x + Math.cos(DEERE.h) * 1.7; st.z = DEERE.z - Math.sin(DEERE.h) * 1.7; CAM.yaw = DEERE.h; } } : null;
    if (dist(CHAIR.x, CHAIR.z) < 1.3) return { label: "Sit back down", run: () => { st.mode = "sit"; st.x = CHAIR.x; st.z = CHAIR.z; st.h = CHAIR.h; say("Rain on the carpet. Nobody minds.", 3); } };
    if (dist(DEN.x - 3.6, DEN.z + 1.6) < 1.7) return { label: "Look at the photograph", run: () => found("photo", "“Idlehour.” A big house with porches all round, four miles east of Knoxville. Somebody was asking where it stood.") };
    if (dist(mower.position.x, mower.position.z) < 2.2) return { label: "Try the mower", run: () => { S.sputter(); found("mower", "Hood up, tank off. It turns over, thinks about it, and quits."); } };
    if (dist(denali.position.x, denali.position.z) < 3.6) return { label: "The Denali", run: () => { S.door(); found("denali", "The black Denali. One chrome wheel, and one that isn't."); } };
    if (dist(FIG.x, FIG.z) < 3.1) return FIG.left ? { label: "Pick a fig", run: () => { const f = FIG.figs.find(g => g.visible); f.visible = false; FIG.left--; S.pick(); found("fig", FIG.left ? `A fig the frost missed. ${FIG.left} left on the bush.` : "The last one. The leaves have gone yellow and will be down by the weekend."); } } : null;
    if (dist(suburban.position.x, suburban.position.z) < 3.6) return { label: "The Suburban", run: () => { S.door(); found("suburban", "The Suburban gave its grille to something else. The oak has been filling the hood since."); } };
    if (dist(DEERE.x, DEERE.z) < 2.8) return { label: "Start the Deere", run: () => { st.mode = "deere"; S.wake(); S.engine(true); me.group.visible = false; found("deere", "The Deere starts. Everything else up here has been waiting on it."); } };
    if (dist(camper.position.x, camper.position.z) < 3.4) return { label: "Knock", run: () => { S.knock(); found("camper", "Red and white, on blocks, leaning into the ivy. Nobody answers."); } };
    if (dist(trailer.position.x, trailer.position.z) < 3) return { label: "The trailer", run: () => found("trailer", "The gate is up and the deck is full. It is hauling leaves nowhere.") };
    if (dist(air.position.x, air.position.z) < 4.6) return { label: "Lay a hand on it", run: () => { S.ring(); found("air", "The Airstream, gone the colour of the sky. This is as far up back as up back goes."); } };
    if (TG && dist(GATE.x, GATE.z) < 5) return { label: "Go on into the trough", run: () => { say("Past the Airstream the yard runs out, and the water starts.", 3); S.chime(); setTimeout(() => window.TroughGate.go("up-back", "teton"), 1400); } };
    return null; }

  /* ---------- input ---------- */
  const keys = {}; addEventListener("keydown", e => { if (e.repeat) return; keys[e.code] = true; S.wake(); if (e.code === "KeyE" || e.code === "Enter") { const o = offer(); if (o) o.run(); } if (e.code === "Space") e.preventDefault(); }); addEventListener("keyup", e => { keys[e.code] = false; });
  $("do").addEventListener("click", () => { S.wake(); const o = offer(); if (o) o.run(); });
  { const stickEl = $("stick"), knob = stickEl.firstElementChild, touchOn = () => { PAD.touch = true; document.body.classList.add("touch"); };
    canvas.addEventListener("pointerdown", e => { S.wake(); if (e.pointerType !== "touch") { PAD.lid = e.pointerId; PAD.lx = e.clientX; PAD.ly = e.clientY; PAD.look = true; return; } touchOn(); try { canvas.setPointerCapture(e.pointerId); } catch (x) { }
      if (e.clientX < innerWidth * .45 && PAD.sid === null) { PAD.sid = e.pointerId; PAD.sx = e.clientX; PAD.sy = e.clientY; stickEl.hidden = false; stickEl.style.left = e.clientX + "px"; stickEl.style.top = e.clientY + "px"; knob.style.transform = ""; } else if (PAD.lid === null) { PAD.lid = e.pointerId; PAD.lx = e.clientX; PAD.ly = e.clientY; PAD.look = true; } });
    canvas.addEventListener("pointermove", e => { if (e.pointerId === PAD.sid) { let dx = e.clientX - PAD.sx, dy = e.clientY - PAD.sy; const L = Math.hypot(dx, dy), R = 56; if (L > R) { dx *= R / L; dy *= R / L; } PAD.mx = dx / R; PAD.my = -dy / R; knob.style.transform = `translate(${dx}px, ${dy}px)`; } else if (e.pointerId === PAD.lid && PAD.look) { CAM.yaw -= (e.clientX - PAD.lx) * .0055; CAM.pitch = clamp(CAM.pitch - (e.clientY - PAD.ly) * .004, -.25, .5); PAD.lx = e.clientX; PAD.ly = e.clientY; } });
    const up = e => { if (e.pointerId === PAD.sid) { PAD.sid = null; PAD.mx = PAD.my = 0; stickEl.hidden = true; } if (e.pointerId === PAD.lid) { PAD.lid = null; PAD.look = false; } }; addEventListener("pointerup", up); addEventListener("pointercancel", up);
    if (matchMedia("(pointer: coarse)").matches) touchOn(); }

  /* ---------- the frame ---------- */
  const clock = new T.Clock(), camPos = new T.Vector3(DEN.x - 1, 2.4, DEN.z - 6), camLook = new T.Vector3(CHAIR.x, 1.2, CHAIR.z); let crowT = 9, offerNow = null, frames = 0;
  const solid = (x, z, r) => { for (const s of SOLID) { const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz), m = s.r + r; if (d < m && d > 1e-4) { x = s.x + dx / d * m; z = s.z + dz / d * m; } } return [clamp(x, X0 + 2, X1 - 2), clamp(z, Z0 + 2, Z1 - 3)]; };
  function frame() { const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime; frames++;
    const mx = clamp((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + PAD.mx, -1, 1), my = clamp((keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + PAD.my, -1, 1), mm = Math.min(1, Math.hypot(mx, my)), run = keys.ShiftLeft || keys.ShiftRight || mm > .85;
    const arrows = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0); if (lineT > 0) { lineT -= dt; if (lineT <= 0) $("line").classList.remove("on"); }
    if (st.mode === "foot") { CAM.yaw += arrows * dt * 2.2; const wx = Math.sin(CAM.yaw) * my - Math.cos(CAM.yaw) * mx, wz = Math.cos(CAM.yaw) * my + Math.sin(CAM.yaw) * mx, sp = mm < .1 ? 0 : run && my > -.3 ? 3.6 : 1.5;
      if (sp > 0) { st.h += wrapA(Math.atan2(wx, wz) - st.h) * (1 - Math.exp(-dt * 9)); if (!PAD.look && my > -.3) CAM.yaw += wrapA(st.h - CAM.yaw) * (1 - Math.exp(-dt * .9)); const [nx, nz] = solid(st.x + wx / mm * sp * dt, st.z + wz / mm * sp * dt, .35); st.speed = Math.hypot(nx - st.x, nz - st.z) / dt; st.x = nx; st.z = nz; } else st.speed = 0;
      const onCarpet = Math.abs(st.x - DEN.x) < 4.5 && Math.abs(st.z - DEN.z) < 3.2; st.y = heightAt(st.x, st.z) + (onCarpet ? .12 : 0); me.group.position.set(st.x, st.y, st.z); me.group.rotation.set(0, st.h, 0);
      if (motion) try { motion.setActorLocomotion("me", { speedMps: st.speed, blend: 1 }); } catch (e) { }
      if (st.speed > .3) { pushLeaves(st.x, st.z, .7, Math.sin(st.h) * st.speed, Math.cos(st.h) * st.speed, st.speed * .5, false); st.stride += st.speed * dt; if (st.stride > (st.speed > 2.5 ? 1.1 : .72)) { st.stride = 0; S.step(onCarpet); } } }
    else if (st.mode === "sit") { CAM.yaw += arrows * dt * 1.2; st.y = .12; me.group.position.set(st.x, st.y, st.z); me.group.rotation.set(0, st.h, 0); if (motion) try { motion.setClip("me", "sitting-idle", { fade: .4 }); } catch (e) { } }
    else if (st.mode === "deere") { const turn = clamp((keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0) - PAD.mx, -1, 1); DEERE.sp = lerp(DEERE.sp, my * 3.4, 1 - Math.exp(-dt * 2.5)); DEERE.h += turn * dt * 1.3 * (Math.abs(DEERE.sp) > .3 || Math.abs(turn) > .1 ? 1 : 0);
      const [nx, nz] = solid(DEERE.x + Math.sin(DEERE.h) * DEERE.sp * dt, DEERE.z + Math.cos(DEERE.h) * DEERE.sp * dt, 1.3); DEERE.x = nx; DEERE.z = nz; st.x = nx; st.z = nz; st.y = heightAt(nx, nz); st.h = DEERE.h; CAM.yaw += wrapA(DEERE.h - CAM.yaw) * (1 - Math.exp(-dt * 2)); S.rev(Math.abs(DEERE.sp) / 3.4 + Math.abs(turn) * .3);
      if (Math.abs(DEERE.sp) > .2 || Math.abs(turn) > .2) { const fx = DEERE.x + Math.sin(DEERE.h) * 1.6 * Math.sign(DEERE.sp || 1), fz = DEERE.z + Math.cos(DEERE.h) * 1.6 * Math.sign(DEERE.sp || 1); pushLeaves(fx, fz, 1.9, Math.sin(DEERE.h) * DEERE.sp * 1.6, Math.cos(DEERE.h) * DEERE.sp * 1.6, 2.2, true); if (done.air && frames % 30 === 0) nextUp(); } }
    /* the Deere sits on the slope under it and shakes when it runs */
    { const fy = heightAt(DEERE.x + Math.sin(DEERE.h), DEERE.z + Math.cos(DEERE.h)), by = heightAt(DEERE.x - Math.sin(DEERE.h), DEERE.z - Math.cos(DEERE.h)); deere.position.set(DEERE.x, (fy + by) / 2 + (st.mode === "deere" ? Math.sin(t * 40) * .006 : 0), DEERE.z); deere.rotation.set(0, DEERE.h - Math.PI / 2, Math.atan2(fy - by, 2), "YXZ"); }
    leafStep(dt); if (motion) try { motion.update(dt); } catch (e) { }
    crowT -= dt; if (crowT < 0) { crowT = 18 + Math.random() * 26; S.crow(); }
    /* rain falls round the camera */
    { const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z; for (let i = 0; i < RN; i++) { const d = drops[i]; d.y -= dt * 17; if (d.y < -3) { d.y = 13; d.x = (Math.random() - .5) * 36; d.z = (Math.random() - .5) * 36; } const o = i * 6; rainP[o] = cx + d.x; rainP[o + 1] = cy + d.y; rainP[o + 2] = cz + d.z; rainP[o + 3] = cx + d.x + .03; rainP[o + 4] = cy + d.y - .5; rainP[o + 5] = cz + d.z; } rainG.attributes.position.needsUpdate = true; }
    /* the camera */
    { const tall = camera.aspect < 1, drive = st.mode === "deere", dist2 = (drive ? 8 : st.mode === "sit" ? 4.6 : 4.8) * (tall ? 1.3 : 1), upY = drive ? 3.6 : 2.2, want = _p.set(st.x - Math.sin(CAM.yaw) * dist2, st.y + upY - CAM.pitch * 2.5, st.z - Math.cos(CAM.yaw) * dist2); want.y = Math.max(want.y, heightAt(want.x, want.z) + .6);
      camPos.lerp(want, 1 - Math.exp(-dt * (PAD.look ? 12 : 4))); camLook.lerp(_s.set(st.x + Math.sin(CAM.yaw) * 1.5, st.y + (drive ? 1.6 : 1.35) + CAM.pitch * 7, st.z + Math.cos(CAM.yaw) * 1.5), 1 - Math.exp(-dt * 6)); camera.position.copy(camPos); camera.lookAt(camLook); camera.fov = tall ? 64 : 54; camera.updateProjectionMatrix(); }
    sun.position.set(st.x - 30, st.y + 60, st.z + 24); sun.target.position.set(st.x, st.y, st.z);
    const o = offer(); if ((o && o.label) !== (offerNow && offerNow.label)) { $("do").textContent = o ? o.label : ""; $("do").hidden = !o; } offerNow = o;
    $("where").textContent = st.mode === "deere" ? `On the Deere · ${LV.cleared} leaves moved` : Math.abs(st.x - DEN.x) < 5 && Math.abs(st.z - DEN.z) < 4 ? "The den" : st.z > 14 ? "The yard" : st.z > -30 ? "Up back" : st.z > -60 ? "Further up back" : "The top";
    renderer.render(scene, camera); requestAnimationFrame(frame); }

  resize(); $("boot").classList.add("done"); say("Rain since morning. The leaves are all down, and everything up back is where it was left.", 6);
  window.__upback = { st, CAM, PAD, DEERE, LV, done, offer, keys, frames: () => frames, heightAt, FIG, pos: { mower, denali, suburban, camper, trailer, air } };
  requestAnimationFrame(frame);
})().catch(e => { console.error(e); const b = document.getElementById("boot-s"); if (b) b.textContent = "Something went wrong: " + e.message; });
