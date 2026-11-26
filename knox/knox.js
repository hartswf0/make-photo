/* Sunday at Eastminster: a custodian cowboy's morning in East Knoxville.
   Before eleven o'clock worship he unlocks the church, rings the bell, runs the raccoons off the trash, fights back the kudzu
   that is coming up the churchyard, hauls hay bales on the tractor and wagon to the church picnic at Holston Hills, and, because
   the pilot owes him one, flies the helicopter off the roof of World Headquarters and around the Sunsphere.

   Built on make-photo's own parts:
   - the one cast (donkey/characters.js, CAST_2086), driven by real motion capture (Mesh2Motion clips through m2m-world-bridge.js):
     walk, jog, rope-pull for the bell, push for the wagon, farm-watering, idle-talking;
   - Rapier physics (the vendored WASM build): the land as a heightfield, every wall as a collider, a character controller,
     dynamic trash cans and hay bales, and the wagon bed as a kinematic body that carries the bales by friction;
   - the glass look of the trough's mini-games for the marker's reticle (seven drops that close as the hand steadies).
   The world itself is knox-world.js, with no renderer, so a jerry can can pour it into the overworld later. */
(async () => {
  "use strict";
  const T = THREE, $ = id => document.getElementById(id), QS = new URLSearchParams(location.search);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const RAPIER_URL = "../highland-exposure/motion-lab/vendor/rapier.es.js", SOUND = "../highland-exposure/motion-lab/assets/sound/";
  const boot = s => { $("boot-s").textContent = s; };

  /* ---------- renderer, sky, light: a clear late-November morning, sun low in the south-east ---------- */
  const canvas = $("c"), renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(55, 1, .1, 4000);
  scene.fog = new T.Fog(0xc9d4dc, 260, 1500);
  const sky = new T.Mesh(new T.SphereGeometry(3000, 32, 16), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: new T.Vector3(.5, .32, .6).normalize() } },
    vertexShader: "varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: "varying vec3 vD; uniform vec3 uSun; void main(){ float h=clamp(vD.y,0.,1.); vec3 c=mix(vec3(.84,.87,.88),vec3(.45,.62,.82),smoothstep(0.,.6,h)); float s=max(dot(vD,uSun),0.); c+=vec3(1.,.92,.78)*(pow(s,600.)*2.+pow(s,8.)*.18); gl_FragColor=vec4(c,1.); }" }));
  scene.add(sky);
  scene.add(new T.HemisphereLight(0xdfe8f0, 0x6a5a3e, .75));
  const sun = new T.DirectionalLight(0xfff0d8, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 600 }); sun.shadow.bias = -.0004; scene.add(sun, sun.target);
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); fx.width = innerWidth * devicePixelRatio; fx.height = innerHeight * devicePixelRatio; };
  const fx = $("fx"), FX = fx.getContext("2d"); addEventListener("resize", resize); resize();

  /* ---------- the world ---------- */
  boot("Laying out Knoxville…");
  const { heightAt } = window.KnoxWorld, W = window.KnoxWorld.create(T); scene.add(W.root);
  const { church, shed, golf, hq, sunsphere } = W;

  /* ---------- physics ---------- */
  boot("Setting the physics…");
  const R = (await import(RAPIER_URL)).default; await R.init();
  const world = new R.World({ x: 0, y: -9.81, z: 0 }); world.timestep = 1 / 60;
  const v3 = (x, y, z) => ({ x, y, z }), qY = a => ({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) }), OWNER = new Map();
  { const B = W.BOUND, S = 2, nr = Math.round((B.x1 - B.x0) / S), nc = Math.round((B.z1 - B.z0) / S), hts = new Float32Array((nr + 1) * (nc + 1));
    /* Rapier's heightfield: rows along z, columns along x, column-major (measured in mars/western.js) */
    for (let i = 0; i <= nr; i++) for (let j = 0; j <= nc; j++) hts[i * (nc + 1) + j] = heightAt(B.x0 + i * S, B.z0 + j * S);
    const g = world.createCollider(R.ColliderDesc.heightfield(nc, nr, hts, v3(nr * S, 1, nc * S)).setTranslation((B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2).setFriction(.9)); OWNER.set(g.handle, { kind: "ground" }); }
  for (const k of W.colliders) { const q = new T.Quaternion().setFromEuler(new T.Euler(k.rx || 0, k.ry || 0, 0, "YXZ")), d = k.type === "box" ? R.ColliderDesc.cuboid(k.hx, k.hy, k.hz).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }) : R.ColliderDesc.cylinder(k.hh, k.r);
    const col = world.createCollider(d.setTranslation(k.x, k.y, k.z).setFriction(.8)); OWNER.set(col.handle, { kind: "static", tag: k.tag }); }
  const props = [];
  function prop(kind, mesh, desc, x, y, z, ry = 0, mass = 1, fr = .6) { const b = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(qY(ry)).setCanSleep(true).setAngularDamping(.3).setLinearDamping(.05));
    const c = world.createCollider(desc.setMass(mass).setFriction(fr).setRestitution(.15), b); mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(mesh); const p = { kind, mesh, body: b, col: c }; OWNER.set(c.handle, { kind: "prop", p }); props.push(p); return p; }

  /* ---------- the custodian, and the people of the morning, from the one cast ---------- */
  boot("Waking the custodian…");
  const CAST = [
    { id: "custodian", base: "tex", name: "Otis", role: "custodian, Eastminster", spec: { scale: 1.02, build: 1.08, fem: .05, skinHex: 0x3b2417, hair: "feltHat", hatHex: 0xa8865a, beard: true, hairHex: 0x8c8780, outer: "duster", coatHex: 0x26334a, shirtHex: 0x7d93b0, trouserHex: 0x2c3a55, tibebTrim: false, ownColors: true } },
    { id: "pastor", base: "almaz_matriarch", name: "Reverend Ruth", role: "pastor", at: () => ({ x: church.steps.x - 3.5, z: church.steps.z + 1.5, face: Math.PI }), clip: "idle-talking", spec: { scale: .96, fem: .9, skinHex: 0x4a2c1e, hair: "silverSwept", hairHex: 0xd8d4cc, outer: "shamma", coatHex: 0x4a2450, shirtHex: 0xe9e2d6, trouserHex: 0x2a2028, tibebTrim: true } },
    { id: "groundskeeper", base: "yared_krar", name: "Mr. Hollis", role: "greenskeeper, Holston Hills", at: () => ({ x: golf.holes[0].x - 6, z: golf.holes[0].z + 4, face: .6 }), clip: "farm-watering", spec: { scale: .98, fem: .05, skinHex: 0x352016, hair: "croppedCoily", hairHex: 0xb8b4ac, beard: true, outer: "parka", coatHex: 0x3e5a36, shirtHex: 0xd9cfbd, trouserHex: 0x4a4436, ownColors: true } },
    { id: "pilot", base: "selam_wire", name: "Captain Dee", role: "pilot", at: () => ({ x: hq.pad.x + 9, z: hq.pad.z - 6, face: -1.2, y: hq.roof }), clip: "idle-foldarms", spec: { scale: .97, fem: .85, skinHex: 0x5a3624, hair: "shortLocs", hairHex: 0x18120e, outer: "parka", coatHex: 0x4a3a26, shirtHex: 0xe8e4da, trouserHex: 0x2e3440 } }
  ];
  const people = {};
  for (const c of CAST) { let ch = null; try { ch = window.CAST_2086.make(T, c.base, Object.assign({ name: c.name }, c.spec)); } catch (e) { console.warn("cast", c.id, e); }
    if (!ch) continue; if (ch.label && ch.label.sprite) ch.label.sprite.visible = false; scene.add(ch.group); ch.group.traverse(o => { if (o.isMesh) o.castShadow = true; }); people[c.id] = { c, ch }; }
  const me = people.custodian.ch;
  let motion = null;
  try { motion = window.Mesh2MotionWorldBridge.createWorldCastDriver(T, { clipsBaseUrl: "../motion-pipeline/mesh2motion/clips", preload: ["idle", "walk", "jog", "walk-happy", "rope-pull", "push", "idle-talking", "farm-watering", "idle-foldarms", "sprint", "victory", "sitting-idle"], defaultBlend: 1, defaultFade: .25 });
    for (const id in people) motion.registerActor(id, people[id].ch, { defaultClip: "idle", blend: 1 }); } catch (e) { console.warn("motion", e); motion = null; }
  for (const id in people) { const c = people[id].c; if (!c.at) continue; const a = c.at(), g = people[id].ch.group; g.position.set(a.x, a.y ?? heightAt(a.x, a.z), a.z); g.rotation.y = a.face; if (motion) motion.setClip(id, c.clip, { fade: .2 }); }

  /* the custodian's body in the physics: a capsule moved by a character controller */
  const ctrl = world.createCharacterController(.03); ctrl.enableAutostep(.45, .2, true); ctrl.enableSnapToGround(.5); ctrl.setApplyImpulsesToDynamicBodies(true); ctrl.setMaxSlopeClimbAngle(48 * Math.PI / 180);
  const meBody = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()), meCol = world.createCollider(R.ColliderDesc.capsule(.55, .3), meBody); OWNER.set(meCol.handle, { kind: "me" });
  const st = { mode: "foot", x: church.lot.x + 6, z: church.lot.z + 14, y: 0, heading: Math.PI * .85, vy: 0, speed: 0, aim: false, pitch: 0, steady: 0, cool: 0, clip: null, clipT: 0, inside: false };
  st.y = heightAt(st.x, st.z);

  /* the paintball marker in his right hand */
  const marker = new T.Group(); { const body = new T.Mesh(new T.BoxGeometry(.08, .12, .42), new T.MeshStandardMaterial({ color: 0x1c1f24, roughness: .5 })), hop = new T.Mesh(new T.SphereGeometry(.09, 12, 8), new T.MeshStandardMaterial({ color: 0xe0761e, transparent: true, opacity: .75 })), barrel = new T.Mesh(new T.CylinderGeometry(.018, .018, .38, 8), body.material);
    hop.position.set(0, .14, -.04); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .02, .38); marker.add(body, hop, barrel); }
  const HAND = 20; function holdMarker(on) { const b = me.bones && me.bones[HAND]; if (!b) return; if (on) { b.add(marker); marker.position.set(0, -.06, .1); marker.rotation.set(-Math.PI / 2, 0, 0); } else if (marker.parent) marker.parent.remove(marker); }
  const _aw = new T.Vector3(), _ac = new T.Vector3(), _aq = new T.Quaternion(), _aq2 = new T.Quaternion();
  function aimArm(dir) { const B = me.bones; if (!B || !B[16]) return; me.group.updateMatrixWorld(true);
    for (const [bi, ci] of [[16, 18], [18, 20]]) { const b = B[bi], c = B[ci]; b.getWorldPosition(_aw); c.getWorldPosition(_ac); const cur = _ac.sub(_aw).normalize();
      _aq.setFromUnitVectors(cur, dir); b.getWorldQuaternion(_aq2); _aq2.premultiply(_aq); b.parent.getWorldQuaternion(_aq); b.quaternion.copy(_aq.invert().multiply(_aq2)); b.updateMatrixWorld(true); } }

  /* ---------- things in the way: kudzu coming up the churchyard, raccoons in the trash ---------- */
  const leafG = new T.PlaneGeometry(.7, .55); leafG.translate(0, .27, 0);
  const kudzu = [];
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + .3, r = 34 + (i % 3) * 5, x = church.x + Math.cos(a) * r, z = church.z - 4 + Math.sin(a) * r * .85;
    const N = 90, im = new T.InstancedMesh(leafG, new T.MeshStandardMaterial({ color: 0x3f7a2a, side: T.DoubleSide, roughness: .8 }), N), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), cc = new T.Color();
    for (let k = 0; k < N; k++) { const u = Math.random() * Math.PI * 2, v = Math.acos(1 - Math.random() * 1.6), rr = 1.6; e.set(Math.random() * 1.2 - .6, Math.random() * 6.28, Math.random() * 1.2 - .6); q.setFromEuler(e);
      m4.compose(new T.Vector3(Math.cos(u) * Math.sin(v) * rr, Math.cos(v) * rr * .7, Math.sin(u) * Math.sin(v) * rr), q, new T.Vector3(1, 1, 1)); im.setMatrixAt(k, m4); im.setColorAt(k, cc.setHSL(.27 + Math.random() * .06, .5, .22 + Math.random() * .12)); }
    im.castShadow = true; const g = new T.Group(); g.add(im); g.position.set(x, heightAt(x, z), z); scene.add(g); kudzu.push({ g, im, x, z, hp: 3, size: .8 + Math.random() * .4, alive: true, paint: 0 }); }
  const wallTarget = (x, z) => ({ x: clamp(x, church.x - 8, church.x + 8), z: clamp(z, church.z - 19, church.z + 11) });

  const raccoons = [];
  const cans = [];
  for (let i = 0; i < 4; i++) { const x = shed.x - 14 + i * 1.3, z = shed.z + 2, g = new T.Mesh(new T.CylinderGeometry(.32, .3, .95, 14), new T.MeshStandardMaterial({ color: 0x5f6a62, metalness: .5, roughness: .45 }));
    cans.push(prop("trash can", g, R.ColliderDesc.cylinder(.475, .31), x, heightAt(x, z) + .5, z, 0, 6)); }
  function makeRaccoon() { const g = new T.Group(), fur = new T.MeshStandardMaterial({ color: 0x77736c, roughness: 1 }), dark = new T.MeshStandardMaterial({ color: 0x1e1c1a, roughness: 1 });
    const body = new T.Mesh(new T.SphereGeometry(.28, 12, 8), fur); body.scale.set(1, .8, 1.5); body.position.y = .3; g.add(body);
    const head = new T.Mesh(new T.SphereGeometry(.15, 10, 8), fur); head.position.set(0, .38, .42); g.add(head); const mask = new T.Mesh(new T.BoxGeometry(.26, .06, .1), dark); mask.position.set(0, .41, .52); g.add(mask);
    for (const s of [-1, 1]) { const ear = new T.Mesh(new T.ConeGeometry(.05, .09, 6), fur); ear.position.set(s * .08, .52, .4); g.add(ear); }
    for (let k = 0; k < 5; k++) { const seg = new T.Mesh(new T.CylinderGeometry(.07 - k * .006, .075 - k * .006, .09, 8), k % 2 ? dark : fur); seg.rotation.x = 1.2; seg.position.set(0, .34 + k * .03, -.42 - k * .08); g.add(seg); }
    for (const [lx, lz] of [[-.13, .25], [.13, .25], [-.13, -.22], [.13, -.22]]) { const l = new T.Mesh(new T.CylinderGeometry(.035, .03, .2, 6), dark); l.position.set(lx, .1, lz); g.add(l); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }
  for (let i = 0; i < 3; i++) { const g = makeRaccoon(), x = shed.x - 14 + i * 2, z = shed.z + 4 + i * .6; g.position.set(x, heightAt(x, z), z); scene.add(g); raccoons.push({ g, x, z, h: Math.random() * 6, t: Math.random() * 5, run: false, gone: false }); }

  /* ---------- the tractor and the hay wagon ---------- */
  const tractor = new T.Group(); { const red = new T.MeshStandardMaterial({ color: 0xa8281e, roughness: .55, metalness: .2 }), blk = new T.MeshStandardMaterial({ color: 0x18181a, roughness: .9 }), steel = new T.MeshStandardMaterial({ color: 0x8a8a86, metalness: .7, roughness: .4 });
    const hood = new T.Mesh(new T.BoxGeometry(.9, .8, 2), red); hood.position.set(0, 1.25, .5); tractor.add(hood); const grill = new T.Mesh(new T.BoxGeometry(.85, .7, .05), steel); grill.position.set(0, 1.25, 1.5); tractor.add(grill);
    const seat = new T.Mesh(new T.BoxGeometry(.55, .12, .5), blk); seat.position.set(0, 1.55, -.95); tractor.add(seat); const back = new T.Mesh(new T.BoxGeometry(.55, .45, .08), blk); back.position.set(0, 1.8, -1.2); tractor.add(back);
    const fender = new T.Mesh(new T.CylinderGeometry(.85, .85, 1.7, 16, 1, true, 0, Math.PI), red); fender.rotation.z = Math.PI / 2; fender.position.set(0, .9, -.9); tractor.add(fender);
    const stack = new T.Mesh(new T.CylinderGeometry(.05, .06, 1, 8), blk); stack.position.set(.3, 2.0, .9); tractor.add(stack); const wheel = new T.Mesh(new T.CylinderGeometry(.85, .85, .38, 18), blk); const rim = new T.Mesh(new T.CylinderGeometry(.4, .4, .4, 12), new T.MeshStandardMaterial({ color: 0xd8c040 }));
    const steer = new T.Mesh(new T.TorusGeometry(.18, .025, 6, 16), blk); steer.position.set(0, 2.0, -.55); steer.rotation.x = -1; tractor.add(steer);
    tractor.userData.wheels = []; for (const [x, z, r] of [[-.95, -.9, .85], [.95, -.9, .85], [-.7, 1.2, .42], [.7, 1.2, .42]]) { const w = new T.Group(), t = wheel.clone(), m = rim.clone(); t.scale.set(r / .85, 1, r / .85); m.scale.set(r / .85, 1, r / .85); w.add(t, m); w.rotation.z = Math.PI / 2; w.position.set(x, r, z); tractor.add(w); tractor.userData.wheels.push({ w, r }); }
    tractor.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(tractor); }
  const wagon = new T.Group(); { const wood = new T.MeshStandardMaterial({ color: 0x7a5434, roughness: .9 }), blk = new T.MeshStandardMaterial({ color: 0x1a1a1a });
    const bed = new T.Mesh(new T.BoxGeometry(2.2, .12, 4), wood); bed.position.y = .9; wagon.add(bed);
    for (const [x, z, w, d] of [[-1.05, 0, .1, 4], [1.05, 0, .1, 4], [0, 1.95, 2.2, .1], [0, -1.95, 2.2, .1]]) { const r = new T.Mesh(new T.BoxGeometry(w, .5, d), wood); r.position.set(x, 1.2, z); wagon.add(r); }
    const tongue = new T.Mesh(new T.BoxGeometry(.1, .1, 1.6), wood); tongue.position.set(0, .7, 2.7); wagon.add(tongue);
    for (const [x, z] of [[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]]) { const w = new T.Mesh(new T.CylinderGeometry(.45, .45, .2, 14), blk); w.rotation.z = Math.PI / 2; w.position.set(x, .45, z); wagon.add(w); }
    wagon.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(wagon); }
  const WG0 = { x: 0, z: 0, h: 0, y: 0 };
  const TR = { x: shed.front.x - 3, z: shed.front.z + 2, h: 0, speed: 0, steer: 0, wx: 0, wz: 0, wh: 0 };
  TR.wx = TR.x - Math.sin(TR.h) * 5.6; TR.wz = TR.z - Math.cos(TR.h) * 5.6;
  const trBody = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(TR.x, heightAt(TR.x, TR.z) + 1, TR.z)), trCol = world.createCollider(R.ColliderDesc.cuboid(.95, .8, 1.6), trBody); OWNER.set(trCol.handle, { kind: "tractor" });
  const trCtrl = world.createCharacterController(.06); trCtrl.enableSnapToGround(.8); trCtrl.enableAutostep(.4, .3, true); trCtrl.setApplyImpulsesToDynamicBodies(true); trCtrl.setMaxSlopeClimbAngle(35 * Math.PI / 180);
  const wgBody = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
  for (const [x, y, z, hx, hy, hz] of [[0, .9, 0, 1.1, .06, 2], [-1.05, 1.2, 0, .05, .25, 2], [1.05, 1.2, 0, .05, .25, 2], [0, 1.2, 1.95, 1.1, .25, .05], [0, 1.2, -1.95, 1.1, .25, .05]]) { const c = world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(1.2), wgBody); OWNER.set(c.handle, { kind: "wagon" }); }
  const baleMat = new T.MeshStandardMaterial({ color: 0xcfae5e, roughness: 1 }), twine = new T.MeshStandardMaterial({ color: 0x6a4a2a });
  const bales = [];
  function placeWagon() { const y = heightAt(TR.wx, TR.wz); wagon.position.set(TR.wx, y, TR.wz); wagon.rotation.set(0, TR.wh, 0); wgBody.setNextKinematicTranslation(v3(TR.wx, y, TR.wz)); wgBody.setNextKinematicRotation(qY(TR.wh)); }
  placeWagon(); wgBody.setTranslation(v3(TR.wx, heightAt(TR.wx, TR.wz), TR.wz), true); wgBody.setRotation(qY(TR.wh), true);
  for (let i = 0; i < 6; i++) { const g = new T.Group(), b = new T.Mesh(new T.BoxGeometry(1, .44, .6), baleMat); g.add(b); for (const s of [-.25, .25]) { const t = new T.Mesh(new T.BoxGeometry(.02, .45, .61), twine); t.position.x = s; g.add(t); }
    const lx = (i % 2 - .5) * 1.05, lz = (Math.floor(i / 2) - 1) * 1.2, c = Math.cos(TR.wh), s = Math.sin(TR.wh), x = TR.wx + lx * c + lz * s, z = TR.wz - lx * s + lz * c;
    bales.push(prop("bale", g, R.ColliderDesc.cuboid(.5, .22, .3), x, heightAt(TR.wx, TR.wz) + 1.2, z, TR.wh, 18, 1)); }

  /* ---------- the helicopter on the roof of World Headquarters ---------- */
  const heli = new T.Group(); { const paint = new T.MeshStandardMaterial({ color: 0x1d3a5a, metalness: .4, roughness: .35 }), glass = new T.MeshStandardMaterial({ color: 0x9ab4c8, metalness: .2, roughness: .05, transparent: true, opacity: .55 }), blk = new T.MeshStandardMaterial({ color: 0x1a1a1c }), white = new T.MeshStandardMaterial({ color: 0xf2f0ea });
    const cab = new T.Mesh(new T.SphereGeometry(1.25, 20, 14), paint); cab.scale.set(1, .95, 1.6); cab.position.y = 1.7; heli.add(cab);
    const bubble = new T.Mesh(new T.SphereGeometry(1.1, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), glass); bubble.rotation.x = Math.PI / 2.3; bubble.scale.set(1, 1.2, .9); bubble.position.set(0, 1.9, 1.1); heli.add(bubble);
    const boom = new T.Mesh(new T.CylinderGeometry(.14, .3, 5.2, 10), paint); boom.rotation.x = Math.PI / 2; boom.position.set(0, 1.9, -3.9); heli.add(boom); const fin = new T.Mesh(new T.BoxGeometry(.08, 1.1, .7), paint); fin.position.set(0, 2.4, -6.4); heli.add(fin);
    const stripe = new T.Mesh(new T.BoxGeometry(2.52, .14, 2.2), white); stripe.position.set(0, 1.5, 0); heli.add(stripe);
    for (const s of [-1, 1]) { const skid = new T.Mesh(new T.CylinderGeometry(.05, .05, 3.6, 8), blk); skid.rotation.x = Math.PI / 2; skid.position.set(s * .95, .1, .1); heli.add(skid); for (const z of [-.8, .9]) { const strut = new T.Mesh(new T.CylinderGeometry(.04, .04, .9, 6), blk); strut.position.set(s * .85, .5, z); strut.rotation.z = s * .25; heli.add(strut); } }
    const mast = new T.Mesh(new T.CylinderGeometry(.08, .1, .6, 8), blk); mast.position.y = 3.05; heli.add(mast);
    const rotor = new T.Group(); for (let k = 0; k < 2; k++) { const b = new T.Mesh(new T.BoxGeometry(10.5, .04, .32), blk); b.rotation.y = k * Math.PI / 2; rotor.add(b); } rotor.position.y = 3.35; heli.add(rotor); heli.userData.rotor = rotor;
    const tail = new T.Group(); for (let k = 0; k < 2; k++) { const b = new T.Mesh(new T.BoxGeometry(.05, 1.4, .14), blk); b.rotation.x = k * Math.PI / 2; tail.add(b); } tail.position.set(.18, 2.4, -6.4); heli.add(tail); heli.userData.tail = tail;
    heli.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(heli); }
  const HL = { x: hq.pad.x, z: hq.pad.z, y: hq.roof, h: 0, vx: 0, vz: 0, vy: 0, spin: 0, tilt: 0, roll: 0, around: 0, lastA: null };

  /* ---------- paint: balls in flight, and splats where they land ---------- */
  const PAINT = [0xe0761e, 0xf2f2ee, 0x2a7ad8, 0xe8c32a];
  const balls = [], splats = [], splatG = new T.CircleGeometry(1, 14);
  const ballG = new T.SphereGeometry(.035, 8, 6);
  function splat(p, n, color, size = .22) { const m = new T.Mesh(splatG, new T.MeshStandardMaterial({ color, roughness: .4, polygonOffset: true, polygonOffsetFactor: -2, transparent: true, opacity: .95 }));
    m.position.copy(p).addScaledVector(n, .02); m.lookAt(p.clone().add(n)); m.scale.setScalar(size * (.8 + Math.random() * .5)); m.scale.y *= .7 + Math.random() * .5; m.rotateZ(Math.random() * 6.28); scene.add(m); splats.push(m); if (splats.length > 400) scene.remove(splats.shift()); }
  let paintN = 0;
  function fire(dir) { if (st.cool > 0) return; st.cool = .16; const o = new T.Vector3(); marker.getWorldPosition(o); if (!marker.parent) o.set(st.x, st.y + 1.4, st.z);
    const sway = (1 - st.steady) * .03, d = dir.clone().add(new T.Vector3((Math.random() - .5) * sway, (Math.random() - .5) * sway, (Math.random() - .5) * sway)).normalize();
    const color = PAINT[paintN++ % PAINT.length], m = new T.Mesh(ballG, new T.MeshBasicMaterial({ color })); m.position.copy(o); scene.add(m); balls.push({ m, v: d.multiplyScalar(62), color, t: 0 }); S.pop(o); st.steady *= .55; st.recoil = 1; }
  const _seg = new T.Vector3();
  function flyBalls(dt) {
    for (let i = balls.length - 1; i >= 0; i--) { const b = balls[i], p = b.m.position, v = b.v; b.t += dt; v.y -= 9.81 * dt; const len = v.length() * dt, dir = v.clone().normalize();
      let hit = null;
      for (const k of kudzu) { if (!k.alive) continue; const c = new T.Vector3(k.g.position.x, k.g.position.y + .9 * k.size, k.g.position.z), r = 1.6 * k.size; const tt = clamp(_seg.copy(c).sub(p).dot(dir), 0, len), q = p.clone().addScaledVector(dir, tt); if (q.distanceTo(c) < r) { hit = { kind: "kudzu", k, point: q, n: q.clone().sub(c).normalize(), toi: tt }; break; } }
      if (!hit) for (const r of raccoons) { if (r.gone) continue; const c = r.g.position.clone().add(new T.Vector3(0, .3, 0)); const tt = clamp(_seg.copy(c).sub(p).dot(dir), 0, len), q = p.clone().addScaledVector(dir, tt); if (q.distanceTo(c) < .6) { hit = { kind: "raccoon", r, point: q, n: dir.clone().negate(), toi: tt }; break; } }
      const ray = new R.Ray(v3(p.x, p.y, p.z), v3(dir.x, dir.y, dir.z)), rh = world.castRayAndGetNormal(ray, len, true, undefined, undefined, meCol);
      const rt = rh ? (rh.timeOfImpact ?? rh.toi) : 0;
      if (rh && (!hit || rt < hit.toi)) { const q = p.clone().addScaledVector(dir, rt), n = new T.Vector3(rh.normal.x, rh.normal.y, rh.normal.z), who = OWNER.get(rh.collider.handle); hit = { kind: who ? who.kind : "ground", who, point: q, n, toi: rt }; }
      if (hit) { scene.remove(b.m); balls.splice(i, 1); S.splat(hit.point);
        if (hit.kind === "kudzu") { const k = hit.k; k.hp--; k.size *= .72; k.paint++; tintKudzu(k, b.color); if (k.hp <= 0) { k.alive = false; S.rustle(k.g.position); say("The kudzu gives up its ground.", 2); } }
        else if (hit.kind === "raccoon") { const r = hit.r; if (!r.run) { r.run = true; r.t = 0; S.chitter(r.g.position); say(["A raccoon bolts for the woods, painted orange.", "Another one runs for the ridge.", "The last raccoon leaves the trash to God."][raccoons.filter(x => x.run).length - 1] || "", 2.4); } splat(hit.point, new T.Vector3(0, 1, 0), b.color, .1); }
        else { splat(hit.point, hit.n, b.color, hit.kind === "ground" ? .3 : .22); if (hit.kind === "prop") hit.who.p.body.applyImpulseAtPoint(v3(dir.x * 1.8, .5, dir.z * 1.8), v3(hit.point.x, hit.point.y, hit.point.z), true); }
        continue; }
      p.addScaledVector(dir, len); if (b.t > 3) { scene.remove(b.m); balls.splice(i, 1); } } }
  function tintKudzu(k, color) { const c = new T.Color(color), cc = new T.Color(); for (let i = 0; i < k.im.count; i++) { if (Math.random() < .35) { k.im.getColorAt(i, cc); cc.lerp(c, .8); k.im.setColorAt(i, cc); } } k.im.instanceColor.needsUpdate = true; }

  /* ---------- the jobs, and the one thing E does here ---------- */
  const GOALS = [
    ["unlock", "Unlock the church doors"], ["bell", "Ring the bell for eleven o'clock"], ["raccoons", "Run the raccoons off the trash"], ["kudzu", "Fight back the kudzu in the churchyard"],
    ["hay", "Haul four hay bales to the picnic at Holston Hills"], ["fly", "Fly the helicopter around the Sunsphere"]];
  const done = {}; const goalsEl = $("goals"); goalsEl.innerHTML = GOALS.map(([k, t]) => `<li data-k="${k}">${t}</li>`).join("");
  function complete(k, line) { if (done[k]) return; done[k] = true; const li = goalsEl.querySelector(`[data-k="${k}"]`); if (li) li.classList.add("done"); S.chime(); if (line) say(line, 4); if (GOALS.every(([g]) => done[g])) setTimeout(() => say("Reverend Ruth: \"Otis, the church has never looked so loved. Go sit down. Eat something.\"", 6), 4500); }
  let lineT = 0; function say(text, sec = 3.5) { const el = $("line"); el.textContent = text; el.classList.add("on"); lineT = sec; }
  const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) < r;
  function offer() { const p = { x: st.x, z: st.z };
    if (st.mode === "tractor") return { label: "Get down", run: () => leaveTractor() };
    if (st.mode === "heli") return HL.y - groundUnder(HL.x, HL.z, HL.y) < .6 ? { label: "Climb out", run: () => leaveHeli() } : null;
    if (st.mode === "bell") return null;
    if (near(p, church.door, 6.5) && !done.unlock) return { label: "Unlock the doors", run: () => { st.clip = "push"; st.clipT = 1.2; S.keys(church.door); setTimeout(() => complete("unlock", "The big doors swing open. The sanctuary smells of lemon oil and old hymnals."), 900); } };
    if (near(p, church.door, 6.5) && done.unlock && !done.bell) return { label: "Ring the bell", run: () => ringBell() };
    if (near(p, { x: TR.x, z: TR.z }, 3.4)) return { label: "Drive the tractor", run: () => { st.mode = "tractor"; st.aim = false; holdMarker(false); say("The old red tractor coughs twice and catches.", 2.5); S.engine(true); } };
    if (near(p, hq.lobbyDoor, 5) && st.y < hq.y + 5) return { label: "Take the elevator to the roof", run: () => elevator(true) };
    if (st.y > hq.roof - 2 && near(p, { x: hq.pad.x + 13, z: hq.pad.z + 8 }, 3.5)) return { label: "Take the elevator down", run: () => elevator(false) };
    if (st.y > hq.roof - 2 && near(p, { x: HL.x, z: HL.z }, 5)) return { label: "Fly the helicopter", run: () => boardHeli() };
    const pastor = people.pastor && people.pastor.ch.group.position; if (pastor && near(p, pastor, 3)) return { label: "Talk to Reverend Ruth", run: () => say(talkRuth(), 5) };
    const gk = people.groundskeeper && people.groundskeeper.ch.group.position; if (gk && near(p, gk, 3)) return { label: "Talk to Mr. Hollis", run: () => say(done.hay ? "Mr. Hollis: \"Four bales and not one in the river. You drive like a deacon.\"" : "Mr. Hollis: \"Picnic's by the clubhouse, Otis. Bring that hay before the Methodists take the good tables.\"", 5) };
    const pl = people.pilot && people.pilot.ch.group.position; if (pl && st.y > hq.roof - 2 && near(p, pl, 3)) return { label: "Talk to Captain Dee", run: () => say("Captain Dee: \"One lap of the Sunsphere and bring her back to the H. Space climbs, Shift sinks, W and S pitch, A and D turn.\"", 6) };
    return null; }
  function talkRuth() { if (!done.unlock) return "Reverend Ruth: \"Morning, Otis. The doors first, then the bell. And something is in the trash again.\"";
    if (!done.raccoons) return "Reverend Ruth: \"Those raccoons have opened the trash like it's a covered dish. Paint them, don't hurt them.\"";
    if (!done.kudzu) return "Reverend Ruth: \"The kudzu is coming up the yard again. It ate the old Methodist church, you know.\"";
    if (!done.hay) return "Reverend Ruth: \"The hay goes to the picnic at Holston Hills. Take the tractor, the wagon's already loaded.\"";
    return "Reverend Ruth: \"Captain Dee says you've earned a ride. World Headquarters, top of the building. Be back by eleven.\""; }
  function ringBell() { st.mode = "bell"; st.clip = "rope-pull"; st.clipT = 5.2; let n = 0; const ring = () => { if (n >= 6) { st.mode = "foot"; complete("bell", "Six strokes roll out over East Knoxville. Somewhere on Magnolia a dog answers."); return; } S.bell(); n++; setTimeout(ring, 850); }; setTimeout(ring, 400); birdsUp(); }
  function elevator(up) { const f = $("fade"); f.classList.add("on"); S.ding(); setTimeout(() => { if (up) { st.x = hq.pad.x + 11; st.z = hq.pad.z + 8; st.y = hq.roof; say("Ninety-two metres up. The whole city laid out, the Sunsphere gold over the park.", 4); } else { st.x = hq.lobbyDoor.x; st.z = hq.lobbyDoor.z + 4; st.y = heightAt(st.x, st.z); } meBody.setTranslation(v3(st.x, st.y + .85, st.z), true); f.classList.remove("on"); }, 900); }
  function boardHeli() { st.mode = "heli"; st.aim = false; holdMarker(false); HL.around = 0; HL.lastA = null; me.group.visible = false; say("Captain Dee slaps the door. \"She's yours.\"", 2.5); S.heli(true); }
  function leaveHeli() { st.mode = "foot"; me.group.visible = true; st.x = HL.x + 2.2; st.z = HL.z + .5; st.y = groundUnder(st.x, st.z, HL.y); meBody.setTranslation(v3(st.x, st.y + .85, st.z), true); S.heli(false); if (done.fly && Math.hypot(HL.x - hq.pad.x, HL.z - hq.pad.z) < 8 && HL.y > hq.roof - 1) say("Captain Dee: \"Right on the H. You can come back any Sunday.\"", 4); }
  function leaveTractor() { st.mode = "foot"; st.x = TR.x + Math.cos(TR.h) * 1.8; st.z = TR.z - Math.sin(TR.h) * 1.8; st.y = heightAt(st.x, st.z); meBody.setTranslation(v3(st.x, st.y + .85, st.z), true); S.engine(false); }
  function groundUnder(x, z, y) { const g = heightAt(x, z); return y !== undefined && y > hq.roof - 6 && Math.abs(x - hq.x) < 20 && Math.abs(z - hq.z) < 16 ? Math.max(g, hq.roof) : g; }   /* the roof counts as ground only for someone already up there */

  /* pigeons that leave the steeple when the bell rings */
  const birds = []; { const bg = new T.ConeGeometry(.12, .4, 4); bg.rotateX(Math.PI / 2); for (let i = 0; i < 14; i++) { const m = new T.Mesh(bg, new T.MeshStandardMaterial({ color: 0x6a6e78 })); m.visible = false; scene.add(m); birds.push({ m, v: new T.Vector3(), t: 99 }); } }
  function birdsUp() { const c = new T.Vector3(church.x, church.y + 25, church.z + 9); for (const b of birds) { b.m.position.copy(c).add(new T.Vector3(Math.random() * 3 - 1.5, Math.random(), Math.random() * 3 - 1.5)); b.v.set(Math.random() * 10 - 5, 3 + Math.random() * 4, Math.random() * 10 - 5); b.t = 0; b.m.visible = true; } }

  /* ---------- input ---------- */
  const keys = {}; addEventListener("keydown", e => { if (e.repeat) return; keys[e.code] = true; S.wake();
    if (e.code === "KeyE") { const o = offer(); if (o) o.run(); }
    if (e.code === "KeyR" && st.mode === "foot") { st.aim = !st.aim; holdMarker(st.aim); if (st.aim) say("The marker. Paint, not harm.", 1.6); }
    if (e.code === "KeyC") camWide = !camWide;
    if ((e.code === "Space" || e.code === "Enter") && st.aim && st.mode === "foot") { e.preventDefault(); fire(aimDir()); } });
  addEventListener("keyup", e => { keys[e.code] = false; });
  const mouse = { x: 0, y: 0, on: false };
  canvas.addEventListener("pointermove", e => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = -(e.clientY / innerHeight * 2 - 1); mouse.on = true; });
  canvas.addEventListener("pointerdown", e => { S.wake(); canvas.focus(); if (st.aim && st.mode === "foot") fire(aimDir()); });
  $("do").addEventListener("click", () => { const o = offer(); if (o) o.run(); });
  $("aim").addEventListener("click", () => { if (st.mode !== "foot") return; st.aim = !st.aim; holdMarker(st.aim); });
  const ray = new T.Raycaster();
  function aimDir() { ray.setFromCamera(new T.Vector2(mouse.on ? mouse.x : 0, mouse.on ? mouse.y : .08), camera); return ray.ray.direction.clone(); }
  let camWide = false;

  /* ---------- sound: synthesized, plus the library's wind and birds; it starts on the first key or tap ---------- */
  const S = (() => { let ctx = null, master, wet, beds = {}, eng = null, rot = null, buf = {};
    function wake() { if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; } ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .8; master.connect(ctx.destination);
      const n = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, n, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2) * (i > ctx.sampleRate * .09 ? 1 : .2); }
      wet = ctx.createConvolver(); wet.buffer = ir; const wg = ctx.createGain(); wg.gain.value = .35; wet.connect(wg).connect(master);
      for (const k of ["wind_plain", "bird_baro", "bajaj_start_idle", "dog"]) fetch(SOUND + k + ".mp3").then(r => r.arrayBuffer()).then(a => ctx.decodeAudioData(a)).then(b => { buf[k] = b; if (k === "wind_plain") beds.wind = loop(b, .12); if (k === "bird_baro") beds.birds = loop(b, .1); }).catch(() => { }); }
    function loop(b, g) { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; const gn = ctx.createGain(); gn.gain.value = g; s.connect(gn).connect(master); s.start(); return { s, gn }; }
    function out(p, gain = 1, w = .3) { const g = ctx.createGain(); g.gain.value = gain; let node = g; if (p) { const pn = ctx.createPanner(); pn.panningModel = "HRTF"; pn.refDistance = 4; pn.rolloffFactor = 1; pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; g.connect(pn); node = pn; }
      node.connect(master); if (w) { const s = ctx.createGain(); s.gain.value = w; node.connect(s).connect(wet); } return g; }
    function noise(sec) { const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
    function burst(p, sec, type, f, gain, decay, w) { if (!ctx) return; const s = ctx.createBufferSource(); s.buffer = noise(sec); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = ctx.createGain(), t = ctx.currentTime; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + decay); s.connect(fl).connect(g).connect(out(p, 1, w)); s.start(); }
    function tone(p, f0, f1, sec, gain, type = "sine", w = .3, at = 0) { if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at; o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + sec); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .005); g.gain.exponentialRampToValueAtTime(.0008, t + sec); o.connect(g).connect(out(p, 1, w)); o.start(t); o.stop(t + sec + .05); }
    const bellP = () => ({ x: church.x, y: church.y + 25, z: church.z + 9 });
    return { wake,
      listener(cam) { if (!ctx) return; const L = ctx.listener, f = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); if (L.positionX) { L.positionX.value = cam.position.x; L.positionY.value = cam.position.y; L.positionZ.value = cam.position.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; } },
      pop(p) { burst(p, .05, "highpass", 1800, .5, .05, .1); tone(p, 420, 120, .06, .25, "square", .05); },
      splat(p) { burst(p, .12, "lowpass", 900, .55, .11, .2); },
      bell() { if (!ctx) return; const f = 233, p = bellP(); for (const [r, g, d] of [[.5, .5, 6], [1, .9, 4.5], [1.2, .45, 3.5], [1.5, .35, 3], [2, .4, 2.6], [2.5, .2, 2], [3, .15, 1.6], [4.2, .08, 1.2]]) tone(p, f * r, f * r * .998, d, g * .35, "sine", .6); },
      chime() { if (!ctx) return; [784, 988, 1175].forEach((f, i) => tone(null, f, f, .6, .08, "triangle", .3, i * .09)); },
      ding() { if (!ctx) return; tone(null, 988, 988, 1.2, .12, "sine", .4); tone(null, 784, 784, 1.4, .1, "sine", .4, .25); },
      keys(p) { if (!ctx) return; for (let i = 0; i < 5; i++) tone({ x: p.x, y: church.y + 1.5, z: p.z }, 3000 + Math.random() * 2000, 2500, .04, .05, "square", .1, i * .05); burst({ x: p.x, y: church.y + 1.5, z: p.z }, .3, "lowpass", 300, .4, .3, .5); },
      rustle(p) { burst(p, .4, "bandpass", 2500, .3, .35, .2); },
      chitter(p) { if (!ctx) return; for (let i = 0; i < 6; i++) tone(p, 1800 + Math.random() * 800, 1200, .05, .08, "sawtooth", .1, i * .06); },
      step(p, run) { burst(p, .07, "lowpass", run ? 700 : 500, run ? .2 : .13, .06, .05); },
      engine(on) { if (!ctx) return; if (on && !eng && buf.bajaj_start_idle) { const s = ctx.createBufferSource(); s.buffer = buf.bajaj_start_idle; s.loop = true; const g = ctx.createGain(); g.gain.value = .35; s.connect(g).connect(master); s.start(); eng = { s, g }; } if (!on && eng) { eng.s.stop(); eng = null; } },
      engineRate(r) { if (eng) eng.s.playbackRate.value = r; },
      heli(on) { if (!ctx) return; if (on && !rot) { const s = ctx.createBufferSource(); s.buffer = noise(2); s.loop = true; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; const g = ctx.createGain(); g.gain.value = 0;
          const lfo = ctx.createOscillator(); lfo.frequency.value = 7; const lg = ctx.createGain(); lg.gain.value = .32; lfo.connect(lg).connect(g.gain); s.connect(lp).connect(g).connect(master); s.start(); lfo.start();
          const whine = ctx.createOscillator(); whine.type = "sawtooth"; whine.frequency.value = 180; const wg = ctx.createGain(); wg.gain.value = .02; whine.connect(wg).connect(master); whine.start(); rot = { s, lfo, whine, g, lg }; }
        if (!on && rot) { rot.s.stop(); rot.lfo.stop(); rot.whine.stop(); rot = null; } },
      heliRate(r) { if (rot) { rot.lfo.frequency.value = 6 + r * 4; rot.whine.frequency.value = 160 + r * 60; } } }; })();

  /* ---------- the frame ---------- */
  boot("Unlocking the morning…");
  const clock = new T.Clock(); let gaitStep = 0, offerNow = null, fstep = 0;
  const camPos = new T.Vector3(st.x - 6, st.y + 4, st.z - 6), camLook = new T.Vector3(st.x, st.y + 1.5, st.z);
  function frame() {
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), turn = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0), run = keys.ShiftLeft || keys.ShiftRight;
    st.cool = Math.max(0, st.cool - dt); st.recoil = Math.max(0, (st.recoil || 0) - dt * 5); st.steady = Math.min(1, st.steady + dt * (st.aim ? .9 : 0));
    if (lineT > 0) { lineT -= dt; if (lineT <= 0) $("line").classList.remove("on"); }

    if (st.mode === "foot" || st.mode === "bell") {
      const can = st.mode === "foot" && !(st.clipT > 0);
      if (st.aim) { const d = aimDir(); st.heading = lerp(st.heading, Math.atan2(d.x, d.z), 1 - Math.exp(-dt * 10)); }
      else if (can) st.heading += turn * dt * 2.4;
      const speed = can ? fwd * (fwd > 0 ? (st.aim ? 1.1 : run ? 4.6 : 1.5) : .9) : 0, sx = st.aim && can ? -turn * 1.1 : 0;
      const dx = (Math.sin(st.heading) * speed + Math.cos(st.heading) * sx) * dt, dz = (Math.cos(st.heading) * speed - Math.sin(st.heading) * sx) * dt;
      st.vy = ctrl.computedGrounded() ? -1 : st.vy - 9.81 * dt;
      meBody.setTranslation(v3(st.x, st.y + .85, st.z), true); ctrl.computeColliderMovement(meCol, v3(dx, st.vy * dt, dz), R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, c => c !== trCol || st.mode !== "tractor");
      const mv = ctrl.computedMovement(); st.x += mv.x; st.y += mv.y; st.z += mv.z; if (ctrl.computedGrounded()) st.vy = 0;
      const gnd = groundUnder(st.x, st.z, st.y); if (st.y < gnd - 2) st.y = gnd;
      if (W.water(st.x, st.z) > .9) { st.x -= dx * 1.2; st.z -= dz * 1.2; say("The river's too cold for that in November.", 1.5); }
      const moved = Math.hypot(mv.x, mv.z); st.speed = moved / Math.max(dt, 1e-3); gaitStep += moved; if (gaitStep > (run ? 1.6 : .75)) { gaitStep = 0; S.step({ x: st.x, y: st.y, z: st.z }, run); }
      me.group.position.set(st.x, st.y, st.z); me.group.rotation.set(0, st.heading, 0); me.group.visible = true;
      if (st.clipT > 0) st.clipT -= dt;
      if (motion) { try { if (st.clipT > 0 && st.clip) motion.setClip("custodian", st.clip, { fade: .25 }); else motion.setActorLocomotion("custodian", { speedMps: st.speed, carrying: false, blend: 1 }); } catch (e) { } }
    } else if (st.mode === "tractor") {
      const max = 8.5; TR.speed = lerp(TR.speed, fwd * (fwd > 0 ? max : 3), 1 - Math.exp(-dt * (fwd ? 1.2 : 2.4))); TR.steer = lerp(TR.steer, turn * .5, 1 - Math.exp(-dt * 5));
      TR.h += TR.speed * Math.tan(TR.steer) / 2.4 * dt;
      const want = v3(Math.sin(TR.h) * TR.speed * dt, -.4 * dt, Math.cos(TR.h) * TR.speed * dt); trBody.setTranslation(v3(TR.x, heightAt(TR.x, TR.z) + .85, TR.z), true);
      trCtrl.computeColliderMovement(trCol, want, R.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, c => c !== meCol);
      const mv = trCtrl.computedMovement(), blocked = Math.hypot(want.x - mv.x, want.z - mv.z); TR.x += mv.x; TR.z += mv.z; if (blocked > .02) TR.speed *= .4;
      if (W.water(TR.x, TR.z) > .3) { TR.x -= mv.x; TR.z -= mv.z; TR.speed = 0; }
      S.engineRate(.75 + Math.abs(TR.speed) * .09);
      st.x = TR.x; st.z = TR.z; st.y = heightAt(TR.x, TR.z) + 1.0; st.heading = TR.h;
      if (motion) try { motion.setActorLocomotion("custodian", { speedMps: 0, sitting: true, blend: 1 }); } catch (e) { }
    } else if (st.mode === "heli") {
      const lift = (keys.Space ? 1 : 0) - (keys.ShiftLeft || keys.ShiftRight ? 1 : 0);
      HL.spin = Math.min(1, HL.spin + dt * .6); const gnd = groundUnder(HL.x, HL.z, HL.y);
      HL.vy = lerp(HL.vy, lift * 7 * HL.spin, 1 - Math.exp(-dt * 1.8)); HL.h += turn * dt * 1.1;
      HL.tilt = lerp(HL.tilt, fwd * .22, 1 - Math.exp(-dt * 2)); const air = HL.y - gnd > .5;
      const ax = air ? Math.sin(HL.h) * HL.tilt * 70 : 0, az = air ? Math.cos(HL.h) * HL.tilt * 70 : 0;
      HL.vx = lerp(HL.vx, ax, 1 - Math.exp(-dt * .9)); HL.vz = lerp(HL.vz, az, 1 - Math.exp(-dt * .9));
      HL.x = clamp(HL.x + HL.vx * dt, W.BOUND.x0, W.BOUND.x1); HL.z = clamp(HL.z + HL.vz * dt, W.BOUND.z0, W.BOUND.z1); HL.y = Math.min(260, HL.y + HL.vy * dt);
      if (HL.y < gnd) { HL.y = gnd; HL.vy = Math.max(0, HL.vy); HL.vx *= .5; HL.vz *= .5; }
      const top = sunsphere.userData.top, dx = HL.x - top.x, dz = HL.z - top.z, d = Math.hypot(dx, dz);
      if (d > 18 && d < 110 && HL.y > 40) { const a = Math.atan2(dz, dx); if (HL.lastA !== null) HL.around += wrapA(a - HL.lastA); HL.lastA = a; if (Math.abs(HL.around) > Math.PI * 2 && !done.fly) complete("fly", "A full turn around the Sunsphere, the gold glass sliding by the window. Now bring her back to the H."); } else HL.lastA = null;
      S.heliRate(HL.spin * (.6 + Math.abs(HL.tilt) * 2 + Math.abs(HL.vy) * .05));
      st.x = HL.x; st.z = HL.z; st.y = HL.y; st.heading = HL.h;
    }
    /* the tractor and the wagon, placed every frame; the wagon trails the hitch */
    { const ty = heightAt(TR.x, TR.z), fy = heightAt(TR.x + Math.sin(TR.h) * 1.2, TR.z + Math.cos(TR.h) * 1.2), by = heightAt(TR.x - Math.sin(TR.h) * .9, TR.z - Math.cos(TR.h) * .9);
      tractor.position.set(TR.x, ty, TR.z); tractor.rotation.set(Math.atan2(by - fy, 2.1), TR.h, 0, "YXZ"); for (const w of tractor.userData.wheels) w.w.rotation.x += TR.speed * dt / w.r;
      trBody.setNextKinematicTranslation(v3(TR.x, ty + .85, TR.z)); trBody.setNextKinematicRotation(qY(TR.h));
      const hx = TR.x - Math.sin(TR.h) * 2.1, hz = TR.z - Math.cos(TR.h) * 2.1, ddx = hx - TR.wx, ddz = hz - TR.wz, dd = Math.hypot(ddx, ddz) || 1;
      WG0.x = TR.wx; WG0.z = TR.wz; WG0.h = TR.wh; WG0.y = heightAt(TR.wx, TR.wz);
      TR.wh = Math.atan2(ddx, ddz); TR.wx = hx - ddx / dd * 3.5; TR.wz = hz - ddz / dd * 3.5; wagon.position.set(TR.wx, heightAt(TR.wx, TR.wz), TR.wz); wagon.rotation.set(0, TR.wh, 0);
      if (st.mode === "tractor") { me.group.position.set(TR.x - Math.sin(TR.h) * .9, ty + 1.1, TR.z - Math.cos(TR.h) * .9); me.group.rotation.set(0, TR.h, 0); } }
    /* the helicopter */
    { heli.position.set(HL.x, HL.y, HL.z); heli.rotation.set(HL.tilt, HL.h, 0, "YXZ"); heli.userData.rotor.rotation.y += dt * (2 + HL.spin * 38); heli.userData.tail.rotation.x += dt * (4 + HL.spin * 60);
      if (st.mode !== "heli") HL.spin = Math.max(0, HL.spin - dt * .3); }

    /* physics at 60 Hz */
    /* physics at 60 Hz. The wagon bed moves in even sub-steps, and a bale lying in the bed moves with it, the way a load rides a
       trailer: carried while it sits between the rails, free once it bounces out. (Kinematic friction alone left every bale on the road.) */
    { const n = Math.max(1, Math.ceil(Math.min(dt, .1) * 60)), y1 = heightAt(TR.wx, TR.wz);
      for (let k = 1; k <= n; k++) { const f = k / n, px = lerp(WG0.x, TR.wx, (k - 1) / n), pz = lerp(WG0.z, TR.wz, (k - 1) / n), ph = WG0.h + wrapA(TR.wh - WG0.h) * (k - 1) / n,
          nx = lerp(WG0.x, TR.wx, f), nz = lerp(WG0.z, TR.wz, f), nh = WG0.h + wrapA(TR.wh - WG0.h) * f, py = lerp(WG0.y, y1, (k - 1) / n), ny = lerp(WG0.y, y1, f), dh = nh - ph;
        wgBody.setNextKinematicTranslation(v3(nx, ny, nz)); wgBody.setNextKinematicRotation(qY(nh));
        for (const b of bales) { const t0 = b.body.translation(), lx = t0.x - px, lz = t0.z - pz, c = Math.cos(-ph), sn = Math.sin(-ph), bx = lx * c + lz * sn, bz = -lx * sn + lz * c, by = t0.y - py;
          if (Math.abs(bx) < 1.02 && Math.abs(bz) < 1.92 && by > .8 && by < 2.2) { const w = dh * 60, lv = b.body.linvel();
            /* a carried bale moves at the bed's own velocity at that point (v + w x r), so friction has nothing to correct */
            b.body.setLinvel(v3((nx - px) * 60 + w * lz, lv.y, (nz - pz) * 60 - w * lx), true); const av = b.body.angvel(); b.body.setAngvel(v3(av.x * .5, w, av.z * .5), true); } }
        world.step(); fstep++; } }
    for (const p of props) { const tr = p.body.translation(), r = p.body.rotation(); p.mesh.position.set(tr.x, tr.y, tr.z); p.mesh.quaternion.set(r.x, r.y, r.z, r.w); }
    { let n = 0; for (const b of bales) { const tr = b.body.translation(); if (Math.hypot(tr.x - golf.picnic.x, tr.z - golf.picnic.z) < 10) n++; } if (n >= 4) complete("hay", `${n} bales at the picnic. Mr. Hollis lifts his cap.`); W._bales = n; }

    /* kudzu creeps toward the church; raccoons forage, and run when painted */
    let alive = 0; for (const k of kudzu) { if (!k.alive) { k.g.scale.setScalar(Math.max(0, k.g.scale.x - dt * .8)); k.g.visible = k.g.scale.x > .01; continue; } alive++;
      const w = wallTarget(k.x, k.z), dx = w.x - k.x, dz = w.z - k.z, d = Math.hypot(dx, dz); if (d > 1.5 && done.unlock) { k.x += dx / d * dt * .18; k.z += dz / d * dt * .18; }
      k.size = Math.min(1.6, k.size + dt * .004); k.g.position.set(k.x, heightAt(k.x, k.z), k.z); k.g.scale.setScalar(k.size * (1 + Math.sin(t * 1.3 + k.x) * .02)); }
    if (alive === 0) complete("kudzu", "The churchyard is clear. It will be back in June; it always is.");
    let left = 0; for (const r of raccoons) { if (r.gone) continue; left++; r.t += dt;
      if (r.run) { const tx = r.x + 4, tz = -380, dx = tx - r.x, dz = tz - r.z, d = Math.hypot(dx, dz); r.h = Math.atan2(dx, dz); r.x += dx / d * dt * 7.5; r.z += dz / d * dt * 7.5; if (r.t > 9) { r.gone = true; scene.remove(r.g); } }
      else { if (r.t > 2.5) { r.t = 0; r.h += (Math.random() - .5) * 2.4; const can = cans[Math.floor(Math.random() * cans.length)], cp = can.body.translation(); if (Math.hypot(cp.x - r.x, cp.z - r.z) < 1.6) can.body.applyImpulse(v3((Math.random() - .5) * 18, 2, (Math.random() - .5) * 18), true); }
        const home = { x: shed.x - 12, z: shed.z + 4 }; r.x += Math.sin(r.h) * dt * .6; r.z += Math.cos(r.h) * dt * .6; if (Math.hypot(r.x - home.x, r.z - home.z) > 4) r.h = Math.atan2(home.x - r.x, home.z - r.z); }
      r.g.position.set(r.x, heightAt(r.x, r.z) + (r.run ? Math.abs(Math.sin(r.t * 14)) * .06 : 0), r.z); r.g.rotation.y = r.h; }
    if (left === 0) complete("raccoons", "The trash is safe. Three orange raccoons sulk on Sharp's Ridge.");
    /* the church doors swing once unlocked; the bell swings when rung */
    for (const [i, d] of church.doors.entries()) d.rotation.y = lerp(d.rotation.y, done.unlock ? (i ? 1.6 : -1.6) : 0, 1 - Math.exp(-dt * 2));
    church.bell.rotation.x = st.mode === "bell" ? Math.sin(t * 7.4) * .6 : church.bell.rotation.x * .95;
    for (const b of birds) { if (b.t > 12) { b.m.visible = false; continue; } b.t += dt; b.v.y -= dt * .6; b.v.x += Math.sin(t * 3 + b.t) * dt * 2; b.m.position.addScaledVector(b.v, dt); b.m.lookAt(b.m.position.clone().add(b.v)); }
    flyBalls(dt);

    /* people: they turn to face him when he comes near */
    for (const id in people) { if (id === "custodian") continue; const g = people[id].ch.group, c = people[id].c, a = c.at(); const d = Math.hypot(st.x - g.position.x, st.z - g.position.z);
      g.rotation.y = lerp(g.rotation.y, d < 6 ? Math.atan2(st.x - g.position.x, st.z - g.position.z) : a.face, 1 - Math.exp(-dt * 3)); }
    if (motion) try { motion.update(dt); } catch (e) { }
    if (st.aim && st.mode === "foot") { const d = aimDir(); aimArm(d); }

    /* the camera: behind him on foot, over the shoulder with the marker, higher for the tractor, far for the helicopter */
    { let dist = camWide ? 11 : 5.2, up = camWide ? 4.2 : 2.3, side = 0, lookUp = 1.5, h = st.heading;
      if (st.aim) { dist = 3.0; up = 1.75; side = .75; lookUp = 1.55; }
      if (st.mode === "tractor") { dist = camWide ? 18 : 11; up = 5.5; lookUp = 1.6; }
      if (st.mode === "heli") { dist = 20; up = 7; lookUp = 2; }
      if (st.mode === "bell") { dist = 9; up = 3; h = st.heading + .6; }
      const want = new T.Vector3(st.x - Math.sin(h) * dist + Math.cos(h) * side, st.y + up, st.z - Math.cos(h) * dist - Math.sin(h) * side);
      want.y = Math.max(want.y, groundUnder(want.x, want.z, st.y) + 1.2);
      let lookAt = new T.Vector3(st.x + Math.sin(h) * (st.aim ? 6 : 1.5), st.y + lookUp, st.z + Math.cos(h) * (st.aim ? 6 : 1.5));
      if (st.mode === "heli") { const top = sunsphere.userData.top, d = Math.hypot(st.x - top.x, st.z - top.z); if (d < 170) { const k = smooth(170, 70, d); /* near the Sunsphere: hang the camera outside the circle and frame the gold ball with the helicopter */
          const ox = (st.x - top.x) / (d || 1), oz = (st.z - top.z) / (d || 1); want.lerp(new T.Vector3(st.x + ox * 26, st.y + 6, st.z + oz * 26), k); lookAt.lerp(new T.Vector3((st.x + top.x) / 2, (st.y + top.y) / 2, (st.z + top.z) / 2), k); } }
      camPos.lerp(want, 1 - Math.exp(-dt * (st.aim ? 10 : 4))); camLook.lerp(lookAt, 1 - Math.exp(-dt * 6));
      if (window.__knoxCam) { camPos.copy(window.__knoxCam.pos); camLook.copy(window.__knoxCam.at); }   /* a free camera for stills and tours */
      { const head = new T.Vector3(st.x, st.y + (st.mode === "heli" ? 2 : 1.6), st.z), to = camPos.clone().sub(head), L = to.length(); if (L > .5 && !window.__knoxCam) { to.divideScalar(L);
          const hit = world.castRay(new R.Ray(v3(head.x, head.y, head.z), v3(to.x, to.y, to.z)), L, true, undefined, undefined, meCol, undefined, c => { const o = OWNER.get(c.handle); return !o || (o.kind === "static" || o.kind === "ground"); });
          if (hit) camPos.copy(head).addScaledVector(to, Math.max(.6, (hit.timeOfImpact ?? hit.toi) - .35)); } }
      camera.position.copy(camPos); camera.lookAt(camLook); camera.fov = lerp(camera.fov, st.aim ? lerp(48, 38, st.steady) : 55, 1 - Math.exp(-dt * 6)); camera.updateProjectionMatrix(); }
    sun.position.set(st.x + 160, st.y + 110, st.z + 190); sun.target.position.set(st.x, st.y, st.z); S.listener(camera);

    /* the one offer, the place, the reticle */
    const o = offer(); if ((o && o.label) !== (offerNow && offerNow.label)) { $("do").textContent = o ? o.label : ""; $("do").hidden = !o; } offerNow = o;
    $("where").textContent = W.placeAt(st.x, st.z) + (st.mode === "heli" ? ` · ${Math.round(HL.y - groundUnder(HL.x, HL.z, HL.y))} m up` : st.mode === "tractor" ? ` · ${W._bales || 0} of 4 bales at the picnic` : "");
    reticle();
    renderer.render(scene, camera); requestAnimationFrame(frame);
  }
  /* the marker's reticle: seven drops on a ring that closes as the hand steadies, as in the trough's draw */
  function reticle() { const w = fx.width, h = fx.height, k = devicePixelRatio; FX.clearRect(0, 0, w, h); if (!st.aim || st.mode !== "foot") return;
    const cx = (mouse.on ? (mouse.x + 1) / 2 : .5) * w, cy = (mouse.on ? (1 - mouse.y) / 2 : .46) * h, r = lerp(46, 8, st.steady) * k * (1 + st.recoil * .6);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + performance.now() / 2600, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, s = 3.2 * k;
      FX.beginPath(); FX.ellipse(x, y, s, s * 1.25, a, 0, Math.PI * 2); FX.fillStyle = "rgba(161,232,228,.55)"; FX.fill(); FX.strokeStyle = "rgba(255,255,255,.6)"; FX.lineWidth = k; FX.stroke(); }
    if (st.steady > .85) { FX.beginPath(); FX.arc(cx, cy, 2.5 * k, 0, Math.PI * 2); FX.fillStyle = "rgba(248,205,145,.95)"; FX.fill(); } }

  $("boot").classList.add("done"); say("Sunday, ten in the morning. Otis has the keys to Eastminster and an hour before worship.", 5);
  window.__knox = { st, TR, HL, done, kudzu, raccoons, bales, people, offer, fire, aimDir, complete, W, camera, keys, get motion() { return !!motion; }, frames: () => fstep };
  requestAnimationFrame(frame);
})().catch(e => { console.error(e); const b = document.getElementById("boot-s"); if (b) b.textContent = "Something went wrong: " + e.message; });
