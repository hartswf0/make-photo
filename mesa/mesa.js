/* MESA CHIP: the cyber-western of glass, built from the film's keyframe breakdown (mesa/keyframes.json).
   Uncle Mesa walks north from the title gate, through the clockwork iris and the glass canyon, to the ziggurat under the curtain wall.

   Keys (from the breakdown's mechanics column):
     W A S D walk or ride · Shift run or gallop · E do what is here (mount the horse, sit at the booth or on the ziggurat)
     R draw · Space or click fire · X golden smoke · P poncho · T sandstorm · Z fall · G glass-block grid · 1–6 pads and time of day
     World / Game / Cinema at the bottom; Wide toggles the barrel-scope mask.
   Built on make-photo's parts: the one cast (CAST_2086) on Mesh2Motion clips, Rapier (heightfield, walls, prism shards, a character
   controller), makeDonkey for the mount (the film's horse is still the donkey), and the trough's glass look for the reticle. */
(async () => {
  "use strict";
  const T = THREE, $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a)), smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const RAPIER_URL = "../highland-exposure/motion-lab/vendor/rapier.es.js", SOUND = "../highland-exposure/motion-lab/assets/sound/";
  const boot = s => { $("boot-s").textContent = s; };

  /* ---------- renderer, the painted sky, the sun ---------- */
  const COARSE = matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900);   /* a phone: fewer pixels, a smaller shadow map */
  const canvas = $("c"), renderer = new T.WebGLRenderer({ canvas, antialias: !COARSE, preserveDrawingBuffer: !COARSE, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, COARSE ? 1.25 : 1.6)); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.localClippingEnabled = true;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(52, 1, .1, 5000);
  const GOV = { avg: 1 / 60, t: 0, base: Math.min(devicePixelRatio, 1.6) };
  const LENS = window.MesaLens ? window.MesaLens.create({ T, renderer }) : null;   /* the SCION lenses (lens.js): L cycles them */
  const GLASS = window.MesaStained ? window.MesaStained.create({ T, renderer, camera }) : null;   /* Tekle's lens, drawn the island-ecology way (stained.js) */
  scene.fog = new T.FogExp2(0xf0c890, .0024);
  /* the painted skybox: horizontal bands of yellow and blue over the salt, as in the film's brushstroke strata (01:10) */
  const SKY = { uSun: { value: new T.Vector3(.3, .2, -.9).normalize() }, uA: { value: new T.Color("#f2c84a") }, uB: { value: new T.Color("#3a6ab8") }, uC: { value: new T.Color("#f4e8d2") }, uStorm: { value: 0 }, uTime: { value: 0 } };
  const sky = new T.Mesh(new T.SphereGeometry(4000, 32, 16), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: SKY,
    vertexShader: "varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    /* the sky, after Superstudio's airbrushed collages (the Supersurface, the Continuous Monument): a soft gradient, long
       horizontal strokes of cloud laid on with an airbrush, and pale mountains on the horizon. The moods (1-6) still tint it. */
    fragmentShader: `varying vec3 vD; uniform vec3 uSun, uA, uB, uC; uniform float uStorm, uTime;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1., 0.)), f.x), mix(hh(i + vec2(0., 1.)), hh(i + vec2(1., 1.)), f.x), f.y); }
      float fb(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * n2(p); p *= 2.03; a *= .5; } return s; }
      void main(){ float y = clamp(vD.y, 0., 1.), az = atan(vD.x, vD.z);
        vec3 top = mix(uB, vec3(.32, .5, .74), .45), hor = mix(uC, vec3(.9, .93, .94), .5);
        vec3 c = mix(hor, top, smoothstep(.0, .62, y));
        float band = fb(vec2(az * 1.9 + uTime * .003, y * 9.5)), puff = fb(vec2(az * 5.5, y * 24.));
        float strokes = smoothstep(.5, .72, band) * smoothstep(.015, .07, y) * smoothstep(.55, .18, y);
        vec3 cloudLit = mix(vec3(1.), uA, .14), cloudShade = mix(top, vec3(.72, .8, .88), .55);
        c = mix(c, mix(cloudShade, cloudLit, smoothstep(.45, .8, puff)), strokes * .9);
        float ridge = .03 + .05 * fb(vec2(az * 2.4, 1.3)) + .018 * fb(vec2(az * 9., 4.));
        float m = smoothstep(ridge, ridge - .01, y) * smoothstep(-.02, .003, y);
        c = mix(c, mix(vec3(.94, .96, .98), hor * .92 + vec3(.0, .02, .05), smoothstep(ridge - .06, ridge, y)), m * .85);
        float s = max(dot(vD, uSun), 0.); vec3 burst = mix(vec3(.35, .9, .5), vec3(1., .82, .3), pow(s, 6.)); c += burst * (pow(s, 900.) * 3. + pow(s, 24.) * .3);
        float ang = atan(vD.x - uSun.x, vD.y - uSun.y); c += vec3(1., .85, .35) * pow(s, 40.) * (.5 + .5 * sin(ang * 18. + uTime * .3)) * .22;
        c = mix(c, vec3(.93, .72, .42), uStorm * .85); gl_FragColor = vec4(c, 1.); }` }));
  scene.add(sky);
  const hemi = new T.HemisphereLight(0xfff0d8, 0x9a5a2e, .8); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffe2b0, 2.8); sun.castShadow = true; sun.shadow.mapSize.set(COARSE ? 1024 : 2048, COARSE ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 700 }); sun.shadow.bias = -.0004; scene.add(sun, sun.target);
  const fx = $("fx"), FX = fx.getContext("2d"), grid = $("grid"), GX = grid.getContext("2d");
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); for (const c of [fx, grid]) { c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; } if (MIR) MIR.rt.setSize(Math.round(innerWidth * .5), Math.round(innerHeight * .5)); if (LENS) LENS.resize(); };
  let MIR = null; addEventListener("resize", resize);

  /* ---------- the world ---------- */
  boot("Leading the glass…");
  const { heightAt } = window.MesaWorld, W = window.MesaWorld.create(T); scene.add(W.root); const Z = W.zones;

  /* ---------- the salt flats as the Supersurface: beyond the town the ground turns to a glossy pale plane ruled in a grid,
     blotched with airbrushed yellow-green, catching the horizon; at the rim of the world it becomes al-Idrisi's sea, deep blue
     with white zigzag waves, as on the Tabula Rogeriana. ---------- */
  W.root.traverse(o => { if (!o.isMesh || o.userData.cls !== "ground") return; const m = o.material, prev = m.onBeforeCompile, pk = prev ? prev.toString() : ""; m.customProgramCacheKey = () => pk + "|supersurface";
    m.onBeforeCompile = (sh, r) => { if (prev) prev.call(m, sh, r); sh.uniforms.uHor = SKY.uC; sh.uniforms.uTop = SKY.uB;
      sh.vertexShader = "varying vec3 vGW;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.)).xyz;");
      sh.fragmentShader = `varying vec3 vGW; uniform vec3 uHor; uniform vec3 uTop; float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(gh(i), gh(i + vec2(1., 0.)), f.x), mix(gh(i + vec2(0., 1.)), gh(i + vec2(1., 1.)), f.x), f.y); }
        ` + sh.fragmentShader.replace("void main() {", "void main() {\n float gSalt = 0.;")
        .replace("#include <color_fragment>", `#include <color_fragment>
          { float r = length(vGW.xz - vec2(0., -60.)); gSalt = smoothstep(300., 345., r);
            if (gSalt > 0.) { float dist = length(vViewPosition), fade = 1. - smoothstep(90., 700., dist);
              vec2 g = abs(fract(vGW.xz / 4.) - .5), G = abs(fract(vGW.xz / 20.) - .5); float w = fwidth(vGW.x / 4.) * 1.2, W = fwidth(vGW.x / 20.) * 1.4;
              float fine = smoothstep(.5 - w - .012, .5, max(g.x, g.y)), major = smoothstep(.5 - W - .006, .5, max(G.x, G.y));
              float blot = gn(vGW.xz * .012) * .6 + gn(vGW.xz * .035) * .4;
              vec3 surf = mix(vec3(.76, .9, .91), vec3(.6, .8, .86), smoothstep(.3, .7, blot)); surf = mix(surf, vec3(.9, .9, .66), smoothstep(.62, .85, blot) * .55);
              surf = mix(surf, vec3(.26, .42, .48), max(fine * .6 * fade, major * .9 * (fade * .6 + .4)));
              float sea = smoothstep(440., 462., r);
              if (sea > 0.) { float ang = atan(vGW.z + 60., vGW.x), arc = ang * r * .11, rr = r * .16; float v = fract(rr + abs(fract(arc * .55) - .5) * 1.1);
                float wave = 1. - smoothstep(.05, .13, abs(v - .5)); vec3 ink = mix(vec3(.06, .12, .42), vec3(.1, .2, .55), gn(vGW.xz * .02)); surf = mix(surf, mix(ink, vec3(.94, .95, .97), wave * (fade * .7 + .3)), sea); }
              diffuseColor.rgb = mix(diffuseColor.rgb, surf, gSalt); } }`)
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, .32, gSalt);")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n { float fr = pow(1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), 3.); totalEmissiveRadiance += mix(uHor, uTop, .3) * fr * gSalt * .4 * (1. - smoothstep(440., 462., length(vGW.xz - vec2(0., -60.)))); }"); };
    m.needsUpdate = true; });

  /* ---------- planar mirrors: the oasis pond and the cathedral floor reflect what stands above them ---------- */
  { const rt = new T.WebGLRenderTarget(Math.round(innerWidth * .5), Math.round(innerHeight * .5), { type: T.HalfFloatType }), vcam = new T.PerspectiveCamera(), clip = new T.Plane(new T.Vector3(0, 1, 0), 0);
    for (const m of W.mirrors) m.mesh.material = new T.ShaderMaterial({ uniforms: { tMirror: { value: rt.texture }, uRes: { value: new T.Vector2(1, 1) }, uTint: { value: new T.Vector3(...m.tint) }, uTime: { value: 0 }, uOn: { value: 0 } },
      vertexShader: "varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }",
      fragmentShader: "uniform sampler2D tMirror; uniform vec2 uRes; uniform vec3 uTint; uniform float uTime; uniform float uOn; varying vec3 vW; void main(){ if (uOn < .5) { gl_FragColor = vec4(uTint * vec3(.5, .66, .78), 1.);\n#include <colorspace_fragment>\nreturn; } vec2 uv=gl_FragCoord.xy/uRes; uv.x=1.-uv.x; uv+=vec2(sin(vW.x*1.7+uTime*1.3),cos(vW.z*1.9+uTime))*.0025; vec3 c=texture2D(tMirror,uv).rgb*uTint; float edge=.08; gl_FragColor=vec4(c+edge*vec3(.2,.3,.32),1.);\n#include <colorspace_fragment>\n}" });
    MIR = { rt, vcam, clip }; }

  /* ---------- physics ---------- */
  boot("Setting the physics…");
  const R = (await import(RAPIER_URL)).default; await R.init();
  const world = new R.World({ x: 0, y: -9.81, z: 0 }); world.timestep = 1 / 60;
  const v3 = (x, y, z) => ({ x, y, z }), OWNER = new Map();
  { const B = W.BOUND, S = 2, nr = Math.round((B.x1 - B.x0) / S), nc = Math.round((B.z1 - B.z0) / S), hts = new Float32Array((nr + 1) * (nc + 1));
    for (let i = 0; i <= nr; i++) for (let j = 0; j <= nc; j++) hts[i * (nc + 1) + j] = heightAt(B.x0 + i * S, B.z0 + j * S);
    const g = world.createCollider(R.ColliderDesc.heightfield(nc, nr, hts, v3(nr * S, 1, nc * S)).setTranslation((B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2).setFriction(.9)); OWNER.set(g.handle, { kind: "ground" }); }
  { const pit = W.PIT, f = world.createCollider(R.ColliderDesc.cuboid(pit.hx + 1, .2, pit.hz + 1).setTranslation(pit.x, W.cathedralY - .2, pit.z)); OWNER.set(f.handle, { kind: "ground" }); }
  for (const k of W.colliders) { const q = new T.Quaternion().setFromEuler(new T.Euler(0, k.ry || 0, 0)), d = k.type === "box" ? R.ColliderDesc.cuboid(k.hx, k.hy, k.hz).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }) : R.ColliderDesc.cylinder(k.hh, k.r);
    const c = world.createCollider(d.setTranslation(k.x, k.y, k.z).setFriction(.8)); OWNER.set(c.handle, { kind: "static", tag: k.tag }); }
  for (const p of W.prisms) { p.col = world.createCollider(R.ColliderDesc.cylinder(1.3, 1.05).setTranslation(p.x, p.y, p.z)); OWNER.set(p.col.handle, { kind: "prism", p }); }
  const shards = [];

  let INK = null;   /* the paint: mesa/ink.js, created once the sound is up */

  /* ---------- Uncle Mesa, the outlaws, from the one cast ---------- */
  boot("Waking Uncle Mesa…");
  const spec = (base, s) => ({ base, s: Object.assign({ ownColors: true }, s) });
  const MESA = spec("tex", { name: "Uncle Mesa", scale: 1.02, build: .9, fem: .05, skinHex: 0x3e2618, hair: "feltHat", hatHex: 0xe8d2a6, beard: true, hairHex: 0xb9afa2, outer: "none", shirtHex: 0xf2efe6, trouserHex: 0x8a7a5a, tibebTrim: false });
  const OUTLAWS = [spec("yared_krar", { name: "Outlaw Jeb", skinHex: 0x8a6048, hair: "feltHat", hatHex: 0x2a2420, beard: true, hairHex: 0x1a1410, outer: "duster", coatHex: 0x2a2622, shirtHex: 0x4a3a30, trouserHex: 0x2a2826, build: .92 }),
    spec("yared_krar", { name: "Outlaw Ramón", skinHex: 0x6a4430, hair: "feltHat", hatHex: 0x3a2a1e, beard: true, hairHex: 0x14100c, outer: "duster", coatHex: 0x3a2e24, shirtHex: 0x2a2420, trouserHex: 0x24201c, build: .9 }),
    spec("yared_krar", { name: "Outlaw Silas", skinHex: 0x3a2418, hair: "feltHat", hatHex: 0x1e1a16, beard: true, hairHex: 0x100c0a, outer: "duster", coatHex: 0x1e2226, shirtHex: 0x3a3430, trouserHex: 0x1e1c1a, build: .92 })];
  const make = (c, label) => { let ch = null; try { ch = window.CAST_2086.make(T, c.base, c.s); } catch (e) { console.warn(label, e); } if (!ch) return null; if (ch.label && ch.label.sprite) ch.label.sprite.visible = false; scene.add(ch.group); ch.group.traverse(o => { if (o.isMesh) o.castShadow = true; }); return ch; };
  /* two players (mesa/net.js): the one who opened the link plays Anta, so on that phone "me" is Anta and the partner is Uncle Mesa */
  const NET = window.MesaNet || { role: "solo", live: false, send() { }, on() { } }, GUEST = NET.role === "guest", GL = () => GUEST && NET.live;
  const ANTASPEC = spec("selam_wire", { name: "Anta", scale: .97, build: .94, fem: .82, skinHex: 0x2c1a10, hair: "croppedCoily", hairHex: 0x100c0a, outer: "none", shirtHex: 0x6a6c48, trouserHex: 0xb8893a, tibebTrim: false });
  const me = make(GUEST ? ANTASPEC : MESA, "mesa");
  const outlaws = OUTLAWS.map((c, i) => ({ ch: make(c, "outlaw"), name: c.s.name, id: "outlaw" + i, state: "away", t: 0 }));
  /* Anta, from Touki Bouki: short natural hair, an olive-green shirt, mustard trousers, a tan leather satchel. She waits by the bike. */
  const anta = make(GUEST ? MESA : ANTASPEC, "anta"), MCH = GUEST ? anta : me, ACH = GUEST ? me : anta;   /* whoever is Uncle Mesa wears the brim, glasses and beard; whoever is Anta carries the satchel */
  /* the hidden drivers: scion skeletons that run motion capture for the glass figures; their own bodies are never drawn */
  const kD = make(spec("tex", { name: "Knight", scale: 1.08, build: 1.1, fem: .05, outer: "none" }), "knight"), pD = make(spec("yared_krar", { name: "Marcher", outer: "none" }), "marcher");
  for (const d of [kD, pD]) if (d) { d.group.visible = false; d.group.position.set(0, -200, 0); }
  let motion = null;
  try { motion = window.Mesh2MotionWorldBridge.createWorldCastDriver(T, { clipsBaseUrl: "../motion-pipeline/mesh2motion/clips", preload: ["idle", "walk", "jog", "sprint", "crouch-walk", "crouch-idle", "horse-idle", "horse-walk", "horse-trot", "sitting-idle", "idle-foldarms", "angry", "walk-backwards", "jump", "victory", "clapping", "greeting"], defaultBlend: 1, defaultFade: .25 });
    motion.registerActor("mesa", me, { defaultClip: "idle", blend: 1 }); if (anta) motion.registerActor("anta", anta, { defaultClip: "idle-foldarms", blend: 1 }); if (kD) motion.registerActor("knightD", kD, { defaultClip: "idle", blend: 1 }); if (pD) motion.registerActor("procD", pD, { defaultClip: "walk", blend: 1 }); for (const o of outlaws) if (o.ch) { motion.registerActor(o.id, o.ch, { defaultClip: "idle", blend: 1 }); o.ch.group.visible = false; } } catch (e) { console.warn("motion", e); motion = null; }
  /* his signature pieces, carried with the body: round white-rimmed glasses, the yellow-and-blue MESA CHIP pocket badge, the dark-weave poncho, the revolver */
  const glasses = new T.Group(); { const rim = new T.MeshStandardMaterial({ color: 0xf4f2ec, roughness: .3, metalness: .2 }), lens = new T.MeshStandardMaterial({ color: 0xf2c84a, transparent: true, opacity: .35, roughness: .05, metalness: .3 });
    for (const s of [-1, 1]) { const r = new T.Mesh(new T.TorusGeometry(.028, .0045, 8, 24), rim); r.position.x = s * .033; glasses.add(r); const l = new T.Mesh(new T.CircleGeometry(.027, 20), lens); l.position.x = s * .033; glasses.add(l); }
    const br = new T.Mesh(new T.CylinderGeometry(.003, .003, .014, 6), rim); br.rotation.z = Math.PI / 2; glasses.add(br); scene.add(glasses); }
  /* as the film draws him: a brim far wider than his shoulders, flat as a plate, and a beard down to the chest */
  const brim = new T.Mesh(new T.CylinderGeometry(.43, .43, .012, 40), new T.MeshStandardMaterial({ color: 0xe8d2a6, roughness: .85 })); brim.castShadow = true; scene.add(brim);
  const longBeard = (() => { const g = new T.SphereGeometry(1, 16, 12), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 1) / 2, w = .22 + .78 * Math.min(1, t * 1.5); p.setX(i, p.getX(i) * w); p.setZ(i, p.getZ(i) * w); } g.computeVertexNormals(); const m = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0xd6d0c6, roughness: 1 })); m.scale.set(.082, .2, .05); return m; })(); longBeard.castShadow = true; scene.add(longBeard);
  const badge = (() => { const c = document.createElement("canvas"); c.width = 128; c.height = 64; const q = c.getContext("2d"); q.fillStyle = "#f2d04a"; q.fillRect(0, 0, 128, 32); q.fillStyle = "#2a4ab8"; q.fillRect(0, 32, 128, 32); q.fillStyle = "#1a1410"; q.font = "700 22px Georgia"; q.textAlign = "center"; q.fillText("MESA", 64, 24); q.fillStyle = "#f6efe0"; q.fillText("CHIP", 64, 56); const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; return new T.Mesh(new T.PlaneGeometry(.07, .035), new T.MeshStandardMaterial({ map: tx, roughness: .5 })); })(); scene.add(badge);
  const poncho = (() => { const c = document.createElement("canvas"); c.width = 128; c.height = 128; const q = c.getContext("2d"); q.fillStyle = "#2a2420"; q.fillRect(0, 0, 128, 128); for (let y = 0; y < 128; y += 4) { q.fillStyle = y % 16 < 8 ? "#3a302a" : "#1e1a16"; q.fillRect(0, y, 128, 2); } q.fillStyle = "#8a4a2a"; for (const y of [90, 100]) q.fillRect(0, y, 128, 3);
    const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(3, 1); const m = new T.Mesh(new T.ConeGeometry(.62, .78, 18, 1, true), new T.MeshStandardMaterial({ map: tx, roughness: 1, side: T.DoubleSide })); m.visible = false; m.castShadow = true; scene.add(m); return m; })();
  const gun = new T.Group(); { const steel = new T.MeshStandardMaterial({ color: 0x2a2a2e, metalness: .8, roughness: .35 }), grip = new T.MeshStandardMaterial({ color: 0xe8e0d0, roughness: .5 });
    const barrel = new T.Mesh(new T.CylinderGeometry(.013, .013, .2, 8), steel); barrel.rotation.x = Math.PI / 2; barrel.position.z = .12; gun.add(barrel); const cyl = new T.Mesh(new T.CylinderGeometry(.028, .028, .05, 10), steel); cyl.rotation.x = Math.PI / 2; cyl.position.z = .02; gun.add(cyl);
    const g2 = new T.Mesh(new T.BoxGeometry(.03, .09, .04), grip); g2.position.set(0, -.05, -.03); g2.rotation.x = -.3; gun.add(g2); }
  let BRIM_UP = .15, BEARD_UP = -.3; const HAND = 20; const holdGun = on => { const b = me.bones && me.bones[HAND]; if (!b) return; if (on) { b.add(gun); gun.position.set(0, -.05, .06); gun.rotation.set(-Math.PI / 2, 0, 0); } else if (gun.parent) gun.parent.remove(gun); };
  const _aw = new T.Vector3(), _ac = new T.Vector3(), _aq = new T.Quaternion(), _aq2 = new T.Quaternion();
  function aimArm(ch, dir, left) { const B = ch.bones; if (!B || !B[16]) return; ch.group.updateMatrixWorld(true);
    for (const [bi, ci] of left ? [[10, 12], [12, 14]] : [[16, 18], [18, 20]]) { const b = B[bi], c = B[ci]; b.getWorldPosition(_aw); c.getWorldPosition(_ac); const cur = _ac.sub(_aw).normalize(); _aq.setFromUnitVectors(cur, dir); b.getWorldQuaternion(_aq2); _aq2.premultiply(_aq); b.parent.getWorldQuaternion(_aq); b.quaternion.copy(_aq.invert().multiply(_aq2)); b.updateMatrixWorld(true); } }
  const boneW = (ch, i, out) => { const b = ch.bones && ch.bones[i]; if (b) b.getWorldPosition(out); else out.copy(ch.group.position).add(new T.Vector3(0, 1.6, 0)); return out; };

  /* ---------- painted bodies: a hit is pinned to the nearest bone, so the paint walks, falls and rides with the body ----------
     Each body keeps up to NM marks (bone, offset in the bone's frame, radius, colour, when). Every frame they are carried to world
     space and handed to a shader patch on the body's own materials: inside a mark the cloth or skin takes the paint, with a ragged
     edge, running downward as wet paint does; for a second it is glossy, then it crystallizes into small leaded glass cells, as the
     world's paint does. */
  const NM = 24, BNOW = { value: 0 }, BODY_BONES = [1, 3, 5, 7, 10, 12, 14, 16, 18, 20, 51, 53, 54, 56, 58, 59];
  function paintable(ch) { if (!ch || ch.paint) return; const U = { uBP: { value: Array.from({ length: NM }, () => new T.Vector4(0, -999, 0, 0)) }, uBC: { value: Array.from({ length: NM }, () => new T.Vector4()) }, uBN: { value: 0 }, uBNow: BNOW };
    /* the cast's skin, cloth and eyes already have shader hooks of their own: ours runs after theirs, on the same material */
    ch.group.traverse(o => { if (!o.isMesh || !o.material) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (!m || !m.isMeshStandardMaterial || m.transparent) continue; if (m.userData.paintOwner) continue; m.userData.paintOwner = ch.group.uuid; patchBody(m, U); } });
    ch.paint = { U, marks: [] }; }
  function patchBody(m, U) { const prev = m.onBeforeCompile, prevKey = prev ? prev.toString() : ""; m.customProgramCacheKey = () => prevKey + "|painted-body";
    m.onBeforeCompile = (sh, r) => { if (prev) prev.call(m, sh, r); Object.assign(sh.uniforms, U);
      sh.vertexShader = "varying vec3 vBP; varying vec3 vBN;\n" + sh.vertexShader.replace("#include <skinning_vertex>", "#include <skinning_vertex>\n vBP = (modelMatrix * vec4(transformed, 1.)).xyz; vBN = normalize(mat3(modelMatrix) * objectNormal);");
      sh.fragmentShader = `uniform vec4 uBP[${NM}]; uniform vec4 uBC[${NM}]; uniform int uBN; uniform float uBNow; varying vec3 vBP; varying vec3 vBN;
        float bh(vec3 p){ return fract(sin(dot(p, vec3(41.3, 289.1, 17.7))) * 23758.5453); } vec2 bh2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
        ` + sh.fragmentShader.replace("void main() {", "void main() {\n float bCov = 0., bCure = 0.; vec3 bGlow = vec3(0.);")
        .replace("#include <color_fragment>", `#include <color_fragment>
          vec3 bCol = vec3(0.); for (int i = 0; i < ${NM}; i++) { if (i >= uBN) break; vec4 h = uBP[i]; vec3 dv = vBP - h.xyz; float run = smoothstep(0., 1.5, uBNow - uBC[i].w);
            dv.y = dv.y < 0. ? dv.y / (1. + run * 1.4) : dv.y * 1.3;   /* wet paint runs down the body */
            float rag = (bh(floor(vBP * 22.)) - .5) * h.w * .45, k = 1. - smoothstep(h.w * .78, h.w, length(dv) + rag);
            if (k > bCov) { bCov = k; bCol = uBC[i].rgb; bCure = smoothstep(1.2, 2.8, uBNow - uBC[i].w); } }
          if (bCov > 0.) { vec3 n = abs(vBN); vec2 p = (n.y > .6 ? vBP.xz : n.x > n.z ? vBP.zy : vBP.xy) * 9.;
            vec2 g = floor(p), f = fract(p); float d1 = 8., d2 = 8.; vec2 id = g;
            for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(float(x), float(y)), r = o + bh2(g + o) * .8 + .1 - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; id = g + o; } else if (d < d2) d2 = d; }
            float lead = smoothstep(.09 * bCure, .09 * bCure + .04, sqrt(d2) - sqrt(d1)); vec3 cell = bCol * (.8 + .4 * bh(vec3(id, 3.)));
            vec3 wetC = pow(bCol, vec3(1.1)), glassC = mix(vec3(.05, .04, .03), cell, lead);
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(wetC, glassC, bCure), smoothstep(0., .35, bCov)); bGlow = cell * lead * bCure * .55 * smoothstep(0., .35, bCov); }`)
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, mix(.1, .25, bCure), smoothstep(0., .35, bCov));")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += bGlow;"); };
    m.needsUpdate = true; }
  const _bw = new T.Vector3();
  function paintBody(ch, p, color, spread = 1) { if (!ch || !ch.paint || !ch.bones) return; const col = new T.Color(color); ch.group.updateMatrixWorld(true);
    for (let s2 = 0; s2 < spread; s2++) { const q = s2 ? p.clone().add(new T.Vector3((Math.random() - .5) * .45, (Math.random() - .6) * .5, (Math.random() - .5) * .45)) : p; let best = null, bd = 1e9;
      for (const bi of BODY_BONES) { const b = ch.bones[bi]; if (!b) continue; b.getWorldPosition(_bw); const d = _bw.distanceToSquared(q); if (d < bd) { bd = d; best = b; } }
      if (!best) return; const local = best.worldToLocal(q.clone()); ch.paint.marks.push({ bone: best, local, r: (s2 ? .1 : .17) + Math.random() * .08, col, t: BNOW.value }); if (ch.paint.marks.length > NM) ch.paint.marks.shift(); } }
  function paintStep(t) { BNOW.value = t; for (const ch of PAINTED) { if (!ch || !ch.paint) continue; const P = ch.paint; P.marks.forEach((m, i) => { m.bone.localToWorld(_bw.copy(m.local)); P.U.uBP.value[i].set(_bw.x, _bw.y, _bw.z, m.r); P.U.uBC.value[i].set(m.col.r, m.col.g, m.col.b, m.t); }); P.U.uBN.value = P.marks.length; } }
  const PAINTED = [me, anta, ...outlaws.map(o => o.ch)].filter(Boolean); PAINTED.forEach(paintable);

  /* ---------- the horned motorcycle (mesa/touki.js): parked by the title gate, Anta beside it ---------- */
  const TK = window.MesaTouki.build(T); scene.add(TK.group);
  const BK = { x: 7, z: 128, h: Math.PI, speed: 0, steer: 0, lean: 0, wheelie: 0, pitch: 0, rode: false };
  const bkBody = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(BK.x, heightAt(BK.x, BK.z) + .6, BK.z)), bkCol = world.createCollider(R.ColliderDesc.cuboid(.3, .5, 1.0), bkBody); OWNER.set(bkCol.handle, { kind: "bike" });
  const bkCtrl = world.createCharacterController(.05); bkCtrl.enableSnapToGround(.8); bkCtrl.enableAutostep(.35, .3, true); bkCtrl.setApplyImpulsesToDynamicBodies(true); bkCtrl.setMaxSlopeClimbAngle(38 * Math.PI / 180);
  const satchel = new T.Mesh(new T.BoxGeometry(.26, .22, .1), new T.MeshStandardMaterial({ color: 0x9a6a36, roughness: .7 })); satchel.castShadow = true; scene.add(satchel);
  const ANTA_AT = { x: 9.2, z: 127.4 }; if (anta) { anta.group.position.set(ANTA_AT.x, heightAt(ANTA_AT.x, ANTA_AT.z), ANTA_AT.z); anta.group.rotation.y = -1.9; }
  const SEATH = window.__seatH || .46, _bq = new T.Quaternion(), _be = new T.Euler(), _bs = new T.Vector3(), _bu = new T.Vector3();

  /* the controller */
  const ctrl = world.createCharacterController(.03); ctrl.enableAutostep(.5, .2, true); ctrl.enableSnapToGround(.5); ctrl.setApplyImpulsesToDynamicBodies(true); ctrl.setMaxSlopeClimbAngle(50 * Math.PI / 180);
  const meBody = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()), meCol = world.createCollider(R.ColliderDesc.capsule(.55, .3), meBody); OWNER.set(meCol.handle, { kind: "me" });
  const st = { ink: 100, swim: false, mode: "foot", x: 0, z: Z.title_gate.z + 10, y: 0, heading: Math.PI, vy: 0, speed: 0, gun: false, steady: 0, cool: 0, recoil: 0, poncho: false, smokeT: 0, downT: 0, clip: null };
  st.y = heightAt(st.x, st.z);
  const OUTLAW_BODIES = outlaws.map(o => { const b = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0)), c = world.createCollider(R.ColliderDesc.capsule(.55, .3), b); OWNER.set(c.handle, { kind: "outlaw", o }); o.body = b; return b; });

  /* the lone horse (the donkey, as in the Mars level: the cast has no horse yet) */
  const mount = window.makeDonkey({ assetPath: "../donkey/", shells: 10 }); mount.group.scale.setScalar(1.3); scene.add(mount.group); mount.place(W.horseAt.x, W.horseAt.z, W.horseAt.h, heightAt); mount.state.brainOff = true; mount.setCargo([]); mount.setLoad(0);
  mount.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const _sp = new T.Vector3(), _sq = new T.Quaternion();

  /* ---------- the Hall of Liberation (mesa/tekle.js) behind the ziggurat, and the swarms (mesa/swarm.js) ---------- */
  const HALL = window.MesaTekle.hall(T, { x: Z.ziggurat_steps.x, z: Z.ziggurat_steps.z - 36, y: heightAt(Z.ziggurat_steps.x, Z.ziggurat_steps.z - 36) - .5, W: 22, H: 44 }); scene.add(HALL.group);
  { const hc = world.createCollider(R.ColliderDesc.cuboid(41, 26, 2.5).setTranslation(HALL.group.position.x, HALL.group.position.y + 26, HALL.group.position.z)); OWNER.set(hc.handle, { kind: "static", tag: "hall" }); }
  /* the stained-glass knight: 420 shards of silver, gold and red on a scion skeleton; a red glass sword; a plume */
  const KN = kD ? window.MesaSwarm.shards(T, scene, { driver: kD, figures: 1, per: 760, size: 1.35, heightAt, palette: [0xc8d6de, 0xb0c2cc, 0x9ab0bc, 0xd8e2e8, 0xe8c060, 0x8aa0b0, 0xd8342c] }) : null;
  const KNIGHT = { state: "window", x: 0, z: W.PIT.z, h: 0, hp: 16, t: 0, cool: 0, swing: 0 };
  const blade = new T.Mesh(new T.BoxGeometry(.06, 1.15, .02), new T.MeshStandardMaterial({ color: 0xd8342c, emissive: 0x9a1020, emissiveIntensity: .9, roughness: .1, metalness: .3, transparent: true, opacity: .9 })); blade.geometry.translate(0, .55, 0); blade.visible = false; scene.add(blade);
  const plume = new T.Mesh(new T.ConeGeometry(.09, .5, 8), new T.MeshStandardMaterial({ color: 0xd8342c, emissive: 0x7a1010, emissiveIntensity: .6 })); plume.rotation.x = -.6; plume.visible = false; scene.add(plume);
  const kBody = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -60, 0)), kCol = world.createCollider(R.ColliderDesc.capsule(.7, .72).setSensor(false), kBody); OWNER.set(kCol.handle, { kind: "knight" });   /* as wide as its glass body, so paint that visibly lands on it counts */
  if (KN) KN.place(0, 0, -100, 0, 0);
  /* the procession: seven marchers of glass, white shamma, brown hands and faces, green and red sashes; the first carries the torch */
  const NP = 7, PR = pD ? window.MesaSwarm.shards(T, scene, { driver: pD, figures: NP, per: 300, size: 1.2, heightAt, palette: [0xf4f1e8, 0xe6ecee, 0xdfe6ea, 0x6a3820, 0x5a3018, 0x2a9a5a, 0xd8342c, 0xf2c84a] }) : null;
  const PROC = { started: false, s: 0, formAt: [] }, LOOP = t => { const zz = Z.ziggurat_steps, a = t * Math.PI * 2; return { x: zz.x + Math.sin(a) * 27, z: zz.z - 2 + Math.cos(a) * 21 }; };
  if (PR) for (let i = 0; i < NP; i++) PR.place(i, 0, -100, 0, 0);
  const torch = new T.Group(); { const pole = new T.Mesh(new T.CylinderGeometry(.03, .035, .9, 8), new T.MeshStandardMaterial({ color: 0x5a3018 })); pole.position.y = .1; torch.add(pole); const fl = new T.Mesh(new T.ConeGeometry(.16, .55, 10), new T.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: .9, blending: T.AdditiveBlending })); fl.position.y = .8; torch.add(fl); torch.userData.flame = fl; const L = new T.PointLight(0xffa040, 12, 14, 2); L.position.y = .8; torch.add(L); } torch.visible = false; scene.add(torch);
  /* the zebu herd on the salt, and the glass seed-moths at the oasis */
  const HERD = window.MesaSwarm.herd(T, scene, { n: 14, center: { x: 0, z: -60 }, rMin: 318, rMax: 405, heightAt });
  const SPORE = window.MesaSwarm.spores(T, scene, { n: 160, center: { x: Z.oasis_pond.x, y: W.oasisY, z: Z.oasis_pond.z }, radius: 30 });
  /* the Akira trail: the bike's red tail light leaves a ribbon behind it at speed */
  const TRAILN = 60, trailG = new T.BufferGeometry(), trailP = new Float32Array(TRAILN * 2 * 3), trailC = new Float32Array(TRAILN * 2 * 3), trailI = [];
  for (let k = 0; k < TRAILN - 1; k++) { const a = k * 2; trailI.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  trailG.setAttribute("position", new T.BufferAttribute(trailP, 3)); trailG.setAttribute("color", new T.BufferAttribute(trailC, 3)); trailG.setIndex(trailI);
  const trail = new T.Mesh(trailG, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); trail.frustumCulled = false; scene.add(trail); const TRAIL = [];
  function swarmStep(dt, t) {
    /* the knight: waits in the cathedral's glass; steps out when Uncle Mesa comes down onto the mirror floor */
    if (KN && kD) { const K = KNIGHT, inCath = st.y < W.cathedralY + 1.5 && Math.abs(st.x) < W.PIT.hx + 2 && Math.abs(st.z - W.PIT.z) < W.PIT.hz + 2;
      if (K.state === "window" && inCath) { const side = st.x > 0 ? -1 : 1; K.x = side * 5.5; K.z = clamp(st.z - 8, W.PIT.z - W.PIT.hz + 3, W.PIT.z + W.PIT.hz - 3); K.h = Math.atan2(st.x - K.x, st.z - K.z); K.hp = window.__trials ? window.__trials.hp : 16; KN.place(0, K.x, W.cathedralY, K.z, K.h); KN.form(0, new T.Vector3(side * 12, W.cathedralY + 9, K.z), 2.6); K.state = "forming"; K.t = 0; S.glass(new T.Vector3(side * 12, W.cathedralY + 9, K.z), 1.4); say("A knight steps out of the glass, and draws.", 3); }
      else if (K.state === "forming") { K.t += dt; if (KN.formed(0)) K.state = "hunt"; }
      else if (K.state === "hunt" || K.state === "strike") { const dx = st.x - K.x, dz = st.z - K.z, d = Math.hypot(dx, dz); K.h = Math.atan2(dx, dz); K.cool = Math.max(0, K.cool - dt);
        if (K.state === "hunt") { const sp = d > 9 ? 3.6 : d > 1.8 ? 2.2 : 0; K.x += Math.sin(K.h) * sp * dt; K.z += Math.cos(K.h) * sp * dt; if (motion) try { motion.setClip("knightD", sp > 3 ? "jog" : sp > 0 ? "walk" : "idle", { fade: .25 }); } catch (e) { } if (d < 2 && K.cool <= 0 && st.mode !== "down") { K.state = "strike"; K.swing = 0; } }
        else { K.swing += dt; if (motion) try { motion.setClip("knightD", "idle", { fade: .2 }); } catch (e) { } if (K.swing > .75 && K.swing - dt <= .75 && d < 2.6) { S.glass(new T.Vector3(st.x, st.y + 1.2, st.z), .5); fall("The glass sword knocks him flat."); } if (K.swing > 1.1) { K.state = "hunt"; K.cool = 1.4; } }
        const gy = inCath || st.y < W.cathedralY + 3 ? W.cathedralY : heightAt(K.x, K.z); KN.place(0, K.x, gy, K.z, K.h); kBody.setNextKinematicTranslation(v3(K.x, gy + .95, K.z)); }
      else if (K.state === "shattered") { K.t += dt; kBody.setNextKinematicTranslation(v3(0, -60, 0)); if (K.t > 30 && !inCath) K.state = "window"; }
      else kBody.setNextKinematicTranslation(v3(0, -60, 0));
      /* the sword arm: raised on the wind-up, cut down on the swing; the blade rides the hand */
      const live = K.state === "hunt" || K.state === "strike" || K.state === "forming"; blade.visible = plume.visible = live && KN.formed(0);
      if (live) { const f = new T.Vector3(Math.sin(K.h), 0, Math.cos(K.h)), up = new T.Vector3(0, 1, 0);
        const aim = K.state === "strike" ? (K.swing < .55 ? f.clone().multiplyScalar(.3).add(up).normalize() : f.clone().add(new T.Vector3(0, -.6, 0)).normalize()) : f.clone().add(new T.Vector3(0, -.3, 0)).normalize();
        const kq = new T.Quaternion().setFromAxisAngle(up, -K.h), local = aim.clone().applyQuaternion(kq); aimArm(kD, local);
        const hand = KN.bonePoint(0, 20, null, new T.Vector3()), elbow = KN.bonePoint(0, 18, null, new T.Vector3()); blade.position.copy(hand); blade.quaternion.setFromUnitVectors(up, hand.clone().sub(elbow).normalize());
        KN.bonePoint(0, 7, new T.Vector3(0, .22, -.05), plume.position); plume.rotation.y = K.h; } }
    /* the procession: forms out of the centre panel one marcher at a time, then walks round the ziggurat, the torch held up */
    if (PR && pD) { if (!PROC.started && Math.hypot(st.x - HALL.group.position.x, st.z - HALL.group.position.z) < 130) { PROC.started = true; PROC.t = 0; say("The marchers step down out of the glass.", 3); }
      if (PROC.started) { PROC.t += dt; PROC.s += dt * .012; if (motion) try { motion.setClip("procD", "walk", { fade: .3 }); } catch (e) { }
        aimArm(pD, new T.Vector3(.15, 1, .35).normalize());
        for (let i = 0; i < NP; i++) { const u = PROC.s - i * .035, p = LOOP(u), p2 = LOOP(u + .002), h = Math.atan2(p2.x - p.x, p2.z - p.z);
          if (PROC.formAt[i] === undefined && PROC.t > i * 1.3) { PROC.formAt[i] = PROC.t; PR.form(i, HALL.torchAt.clone().add(new T.Vector3((i - 3) * 3, -8, 0)), 2.4); }
          PR.place(i, p.x, heightAt(p.x, p.z), p.z, h); }
        torch.visible = PROC.formAt[0] !== undefined; if (torch.visible) { PR.bonePoint(0, 20, null, torch.position); torch.userData.flame.scale.set(1 + Math.sin(t * 13) * .12, 1 + Math.sin(t * 9) * .2, 1); } } }
    if (KN) KN.update(dt); if (PR) PR.update(dt);
    HERD.update(dt, st); SPORE.update(dt, t, st);
    /* the Akira trail */
    { const tl = TK.group.localToWorld(new T.Vector3(0, .78, -.84)); if (st.mode === "bike" && Math.abs(BK.speed) > 4) TRAIL.unshift({ p: tl, r: new T.Vector3(Math.cos(BK.h), 0, -Math.sin(BK.h)), t }); while (TRAIL.length > TRAILN || (TRAIL.length && t - TRAIL[TRAIL.length - 1].t > 1.4)) TRAIL.pop();
      for (let k = 0; k < TRAILN; k++) { const e = TRAIL[Math.min(k, TRAIL.length - 1)], a = TRAIL.length ? Math.max(0, 1 - (t - e.t) / 1.4) * (k < TRAIL.length ? 1 : 0) : 0, p = e ? e.p : new T.Vector3(0, -99, 0);
        const rv = e ? e.r : new T.Vector3(1, 0, 0); trailP.set([p.x + rv.x * .16, p.y + .05, p.z + rv.z * .16, p.x - rv.x * .16, p.y - .05, p.z - rv.z * .16], k * 6);   /* a flat band at tail-light height, so a chase camera sees it */ trailC.set([a * 2.4, a * .2, a * .3, a * 2.4, a * .2, a * .3], k * 6); }
      trailG.attributes.position.needsUpdate = trailG.attributes.color.needsUpdate = true; } }

  /* ---------- effects: muzzle plumes, curved light tracers, glass shards, golden smoke, sand ribbons, floating spectacles, dust ---------- */
  const puffTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const q = c.getContext("2d"), g = q.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); q.fillStyle = g; q.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  const puffs = []; for (let i = 0; i < 90; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); puffs.push({ s, t: 9, life: 1, v: new T.Vector3(), grow: 1 }); }
  function puff(p, color, v, life = 1.2, size = .3, grow = 1.5, add = false) { const q = puffs.find(x => x.t >= x.life) || puffs[0]; q.t = 0; q.life = life; q.s.visible = true; q.s.position.copy(p); q.v.copy(v); q.size = size; q.grow = grow; q.s.material.color.set(color); q.s.material.blending = add ? T.AdditiveBlending : T.NormalBlending; q.s.material.opacity = .85; }
  const tracers = [];
  const PAINT = [0x2fd0d8, 0xf2a83a, 0xd8342c, 0xf2d04a, 0x2a9a5a, 0x2a4ab8, 0xe85aa8]; let paintN = 0;
  function tracer(a, b, paint) { a = a.clone().addScaledVector(b.clone().sub(a).normalize(), .6); const mid = a.clone().lerp(b, .5).add(new T.Vector3((Math.random() - .5) * 1.2, .6 + Math.random() * .8, (Math.random() - .5) * 1.2)), curve = new T.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    for (const [col, rad] of [[paint ?? 0xff3aa8, .012], [0xff2a4a, .028]]) { const m = new T.Mesh(new T.TubeGeometry(curve, 24, rad, 6, false), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false })); scene.add(m); tracers.push({ m, t: 0 }); } }
  const flash = new T.PointLight(0x40e0e0, 0, 30, 2); scene.add(flash);
  const ribbons = []; { const g = new T.PlaneGeometry(14, .5, 24, 1); for (let i = 0; i < 46; i++) { const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: i % 3 ? 0xf2c060 : 0xffe08a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); scene.add(m); ribbons.push({ m, ph: Math.random() * 6, r: 6 + Math.random() * 30, y: Math.random() * 8, sp: .4 + Math.random() * .6 }); } }
  const specs = []; { const rim = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }); for (let i = 0; i < 7; i++) { const g = new T.Group(); for (const s of [-1, 1]) { const r = new T.Mesh(new T.TorusGeometry(.5, .05, 8, 32), rim); r.position.x = s * .6; g.add(r); } scene.add(g); specs.push({ g, ph: Math.random() * 6, r: 4 + Math.random() * 6 }); } specs.mat = rim; }
  const dust = new T.Points(new T.BufferGeometry().setAttribute("position", new T.BufferAttribute(new Float32Array(900 * 3), 3)), new T.PointsMaterial({ color: 0xfff0d0, size: .08, transparent: true, opacity: .55, depthWrite: false }));
  scene.add(dust); { const p = dust.geometry.attributes.position; for (let i = 0; i < 900; i++) p.setXYZ(i, (Math.random() - .5) * 60, Math.random() * 12, (Math.random() - .5) * 60); }

  /* ---------- shooting ---------- */
  function fire(dir) { if (st.cool > 0 || st.mode === "down" || !INK) return; if (st.ink < 2) { st.cool = .25; S.dry(); return; } st.cool = Math.max(.1, .2 - GAME.combo * .012); st.recoil = .8; st.ink -= 2; GAME.shake = Math.max(GAME.shake, .08);
    const o = new T.Vector3(); if (gun.parent) gun.localToWorld(o.set(0, 0, .26)); else o.set(st.x, st.y + 1.4, st.z);
    const spread = .012 + (1 - st.steady) * .02, col = PAINT[paintN++ % PAINT.length]; let d;
    if (LOCK.p) { const to = LOCK.p.clone(), tf = to.distanceTo(o) / 32; to.y += .5 * 9.81 * tf * tf; d = to.sub(o).normalize().add(new T.Vector3((Math.random() - .5) * .012, (Math.random() - .5) * .012, (Math.random() - .5) * .012)).normalize(); }   /* locked: lead the drop */
    else d = dir.clone().add(new T.Vector3((Math.random() - .5) * spread, (Math.random() - .5) * spread + .035, (Math.random() - .5) * spread)).normalize();
    const tru = st.steady >= .85 && !!LOCK.p; if (tru) { st.steady = .35; GAME.kick = 1; S.shot(o, .5); }   /* a settled, locked shot is a true shot: it hits twice as hard */
    tracer(o, o.clone().addScaledVector(d, tru ? 16 : 9), tru ? 0xffffff : col); puff(o.clone().addScaledVector(d, .2), 0xff3aa8, d.clone().multiplyScalar(2.4), .4, .14, 2.6, true); S.shot(o, .22); if (LENS) LENS.event("fire", col);
    INK.fire(o, d, col, LOCK.p ? 32 : 30 + Math.random() * 4, { owner: GL() ? "ghost" : tru ? "true" : "mesa", exclude: meCol }); if (NET.live) NET.send({ e: "f", o: [r2(o.x), r2(o.y), r2(o.z)], d: [d.x, d.y, d.z], c: col, v: 31, k: "p" }); puff(o.clone().addScaledVector(d, .12), col, d.clone().multiplyScalar(1.5), .3, .05, 1.4, false); S.launch(o); }
  function inkHit(who, q, n, d, col, owner) {
    if (owner === "ghost" || GL()) { /* on the second phone a ball only paints: the first player's game decides what it did */ if (who && who.kind === "outlaw") { paintBody(who.o.ch, q, col, 2); return true; } if (who && who.kind === "partner") { paintBody(anta, q, col, 2); return true; } return !!(who && (who.kind === "me" || who.kind === "chip" || who.kind === "knight")); }
    if (who && who.kind === "partner") { if (owner === "outlaw") { paintBody(anta, q, col, 3); NET.send({ e: "h" }); } return true; }
    SPORE.scatter(q, 1);
    if (who && who.kind === "knight" && owner !== "outlaw") { const dmg = window.__trials ? window.__trials.hit(q, col) : (owner === "true" ? 2 : 1); KN.hit(0, q, .42, col); KNIGHT.hp -= dmg; if (LENS) LENS.event("hit", col); S.glass(q, .5); if (KNIGHT.hp <= 0 && KNIGHT.state !== "shattered") { KN.shatter(0, d); if (LENS) LENS.event("shatter"); if (window.__trials) window.__trials.win(); KNIGHT.state = "shattered"; KNIGHT.t = 0; S.glass(q, 2); complete("knight", "The knight goes to pieces on the mirror floor, every shard still holding its colour."); } return true; }   /* what a paintball does besides land: prisms crack, outlaws go down in their own colour, shards skitter */
    if (who && who.kind === "prism") { const p = who.p; p.hp--; S.glass(q, .3); if (p.hp <= 0) shatter(p, d); return false; }
    if (who && who.kind === "me") { if (owner !== "outlaw") return true; paintBody(me, q, col, 3); if (st.mode !== "down" && GAME.dashT <= 0 && GAME.hurtT > .9) { $("hurt").classList.add("on"); setTimeout(() => $("hurt").classList.remove("on"), 260); GAME.hp--; GAME.hurtT = 0; GAME.combo = 0; GAME.shake = .6; S.hurt(); if (GAME.hp <= 0) { GAME.hp = 3; GAME.score = Math.max(0, GAME.score - 300); fall("Three hits. He goes down, and he gets up."); if (anta && done.gate) { st.downT = 1.5; say("Three hits. Anta hauls him back up.", 2.5); } } } return true; }
    if (who && who.kind === "chip") { if (owner === "outlaw") return true; const c = who.ch; if (!c.alive) return true; c.alive = false; c.t = -2 - Math.random() * 3; flash.color.set(col); flash.position.copy(q); flash.intensity = 60; S.glass(q, .3); st.ink = Math.min(100, st.ink + 12); score(40, q); for (let i = 0; i < 7; i++) puff(q.clone(), i % 2 ? col : 0xffffff, new T.Vector3((Math.random() - .5) * 6, Math.random() * 4, (Math.random() - .5) * 6), .7, .22, 2.5, true); return true; }
    if (who && who.kind === "outlaw") { const ol = who.o; paintBody(ol.ch, q, col, 3); if (owner === "outlaw") return true; if (ol.state === "run" || ol.state === "telegraph" || ol.state === "fire" || ol.state === "stagger") { ol.hp -= owner === "true" ? 2 : 1; if (ol.hp <= 0) { ol.state = "fall"; ol.t = 0; S.thud(q); score(100, q); if (owner === "true") { GAME.slow = Math.max(GAME.slow, .4); GAME.kick = 1.6; } } else { ol.state = "stagger"; ol.t = 0; ol.x += d.x * .6; ol.z += d.z * .6; score(30, q); } }
      const gp = new T.Vector3(q.x, heightAt(q.x, q.z), q.z); INK.splat(gp, new T.Vector3(0, 1, 0), d, col, 1.4); return true; }
    if (who && who.kind === "shard") { who.b.applyImpulseAtPoint(v3(d.x * .4, .3, d.z * .4), v3(q.x, q.y, q.z), true); return true; }
    return false; }
  function shatter(p, d) { p.broken = true; p.mesh.visible = false; world.removeCollider(p.col, true); flash.color.set(Math.random() < .5 ? 0x40e0e0 : 0xffb040); flash.position.set(p.x, p.y, p.z); flash.intensity = 120; S.glass(new T.Vector3(p.x, p.y, p.z), 1.2);
    for (let i = 0; i < 16; i++) { const s = .25 + Math.random() * .35, m = new T.Mesh(new T.TetrahedronGeometry(s), p.mesh.material); m.castShadow = true; scene.add(m);
      const b = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x + (Math.random() - .5), p.y + (Math.random() - .5) * 2, p.z + (Math.random() - .5)).setAngularDamping(.3));
      const c = world.createCollider(R.ColliderDesc.ball(s * .5).setMass(.6).setRestitution(.3).setFriction(.6), b); b.applyImpulse(v3(d.x * 2 + (Math.random() - .5) * 3, 2 + Math.random() * 3, d.z * 2 + (Math.random() - .5) * 3), true); b.applyTorqueImpulse(v3(Math.random() - .5, Math.random() - .5, Math.random() - .5), true);
      OWNER.set(c.handle, { kind: "shard", b }); shards.push({ m, b }); }
    for (let i = 0; i < 8; i++) puff(new T.Vector3(p.x, p.y, p.z), i % 2 ? 0x40e0e0 : 0xffb040, new T.Vector3((Math.random() - .5) * 4, Math.random() * 3, (Math.random() - .5) * 4), 1.4, .6, 4, true);
    complete("prism", "The prism goes to pieces, cyan and amber on the canyon floor."); }

  /* ---------- the duel (Game mode): outlaws come in along the sightlines and telegraph their draw ---------- */
  const SPOTS = [[-14, -24], [16, -26], [0, -44], [-22, 6], [22, -12], [-6, -70], [8, -100]];
  const ringTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; return { c, tx: new T.CanvasTexture(c) }; })();
  const rings = outlaws.map(() => { const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(Object.assign(document.createElement("canvas"), { width: 128, height: 128 })), transparent: true, depthWrite: false, depthTest: false })); s.scale.set(.9, .9, 1); s.visible = false; scene.add(s); return s; });
  const DUEL = { wave: 0, on: false, left: 0, next: 0 };
  /* ---------- the shootout: it comes to him wherever he is. Outlaws ride in three at a time and keep moving; each takes two hits.
     Glass chips hang in the air to be shot for ink. Hits in a row build a combo: each one rings a note higher up the scale, scores
     more and speeds the gun. He has three hits in him, and a dash that paint cannot touch. ---------- */
  const GAME = { score: 0, combo: 0, comboT: 0, hp: 3, hurtT: 0, dashT: 0, dashCool: 0, dx: 0, dz: 1, mvx: 0, mvz: 0, shake: 0, slow: 0, mark: 0, best: 0 };
  const NOTES = [392, 440, 523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7, 1318.5, 1568];
  const inPit = () => st.y < W.cathedralY + 2.5 && Math.abs(st.x - W.PIT.x) < W.PIT.hx + 3 && Math.abs(st.z - W.PIT.z) < W.PIT.hz + 3;
  function score(pts, p) { GAME.combo++; GAME.comboT = 3.4; GAME.score += pts * Math.min(GAME.combo, 10); GAME.best = Math.max(GAME.best, GAME.combo); GAME.mark = .16; GAME.shake = Math.max(GAME.shake, .18); S.note(NOTES[Math.min(GAME.combo - 1, NOTES.length - 1)], p); }
  /* Anta is the second gun. Once he is through the gate she follows on foot or rides pillion, and paints the nearest outlaw (or the
     knight) every second and a half. Her hits count toward the combo. When he goes down she hauls him up early. */
  const AN = { cool: 2, aimT: 0, dir: new T.Vector3(0, 0, 1), n: 0 };
  function antaStep(dt) { if (!anta || !INK || !done.gate) return; AN.cool -= dt; AN.aimT -= dt; if (AN.cool > 0) return; const from = boneW(anta, 20, new T.Vector3()); let best = null, bd = 46;
    for (const o of outlaws) if (o.ch && o.ch.group.visible && (o.state === "run" || o.state === "telegraph" || o.state === "fire" || o.state === "stagger")) { const p = boneW(o.ch, 3, new T.Vector3()), d = p.distanceTo(from); if (d < bd) { bd = d; best = p; } }
    if (!best && (KNIGHT.state === "hunt" || KNIGHT.state === "strike")) { const p = new T.Vector3(KNIGHT.x, W.cathedralY + 1.25, KNIGHT.z); if (p.distanceTo(from) < 40) best = p; }
    if (!best) { AN.cool = .4; return; } const tf = best.distanceTo(from) / 30; best.y += .5 * 9.81 * tf * tf; const d = best.sub(from).normalize(); d.x += (Math.random() - .5) * .07; d.z += (Math.random() - .5) * .07; d.normalize();
    AN.dir.copy(d); AN.aimT = .55; AN.cool = 1.3 + Math.random() * .6; INK.fire(from.clone().addScaledVector(d, .4), d, DAKAR[AN.n++ % DAKAR.length], 30, { owner: "anta", exclude: meCol }); S.launch(from); }
  /* ---------- the other player. PN is where their phone last said they were; NW is the world as the first player's game last saw it. */
  const PN = { has: false, x: 0, y: 0, z: 0, h: 0, sp: 0, mode: "foot", gun: false, ax: 0, ay: 0, az: 1 }; let NW = null, NETT = 0;
  const pBody = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -55, 0)), pCol = world.createCollider(R.ColliderDesc.capsule(.55, .3), pBody); OWNER.set(pCol.handle, { kind: "partner" });
  const r2 = v => Math.round(v * 100) / 100;
  function partnerStep(dt) { const g = anta.group, k = 1 - Math.exp(-dt * 12);
    if (PN.mode === "bike" || PN.mode === "pillion") { g.position.copy(TK.group.localToWorld(_bs.copy(PN.mode === "bike" ? TK.seat : TK.pillion))).addScaledVector(_bu, -SEATH); g.quaternion.copy(TK.group.quaternion); if (motion) try { motion.setClip("anta", "sitting-idle", { fade: .3 }); } catch (e) { } }
    else { if (Math.hypot(PN.x - g.position.x, PN.z - g.position.z) > 12) g.position.set(PN.x, PN.y, PN.z); g.position.set(lerp(g.position.x, PN.x, k), lerp(g.position.y, PN.y, k), lerp(g.position.z, PN.z, k)); const down = PN.mode === "down"; g.rotation.set(down ? -1.45 : 0, g.rotation.y + wrapA(PN.h - g.rotation.y) * k, 0, "YXZ"); if (down) g.position.y += .22;
      if (motion) try { if (PN.mode === "sit") motion.setClip("anta", "sitting-idle", { fade: .3 }); else motion.setActorLocomotion("anta", { speedMps: PN.sp, blend: 1 }); } catch (e) { } }
    if (PN.gun) { AN.dir.set(PN.ax, PN.ay, PN.az); AN.aimT = .2; } else AN.aimT = 0; pBody.setNextKinematicTranslation(v3(g.position.x, g.position.y + .85, g.position.z)); }
  function netSend(dt) { NETT += dt; if (!NET.live || NETT < .08) return; NETT = 0; const a = st.gun ? aimDir() : null, m = { e: "s", x: r2(st.x), y: r2(st.y), z: r2(st.z), h: r2(st.heading), sp: r2(st.speed), mode: st.mode, gun: !!st.gun };
    if (a) { m.ax = r2(a.x); m.ay = r2(a.y); m.az = r2(a.z); }
    if (!GUEST) m.w = { o: outlaws.map(o => [r2(o.x || 0), r2(o.z || 0), r2(o.ch.group.rotation.y), o.state, r2(Math.max(0, o.t)), o.ch.group.visible ? 1 : 0]), d: [DUEL.wave, DUEL.left], g: [GAME.score, GAME.combo, r2(GAME.comboT)], mi: MI, b: [r2(BK.x), r2(BK.z), r2(BK.h), r2(BK.speed), BK.rode ? 1 : 0] };
    NET.send(m); }
  function hurtMe() { if (st.mode === "down" || GAME.dashT > 0 || GAME.hurtT <= .9) return; $("hurt").classList.add("on"); setTimeout(() => $("hurt").classList.remove("on"), 260); GAME.hp--; GAME.hurtT = 0; GAME.shake = .6; S.hurt(); if (GAME.hp <= 0) { GAME.hp = 3; fall("Three hits. Down, and up again."); st.downT = 1.5; } }
  NET.on("s", d => { const first = !PN.has; Object.assign(PN, d); PN.has = true; if (d.w) NW = d.w; if (first && GUEST) { st.mode = "foot"; st.x = d.x + 1.6; st.z = d.z + .6; st.y = heightAt(st.x, st.z); CAM.yaw = st.heading = d.h; meBody.setTranslation(v3(st.x, st.y + .85, st.z), true); } });
  NET.on("f", d => { if (!INK) return; const o = new T.Vector3(...d.o), dir = new T.Vector3(...d.d); if (GUEST) { const n = d.k === "outlaw" ? 3 : 1; for (let k = 0; k < n; k++) INK.fire(o, k ? dir.clone().add(new T.Vector3((Math.random() - .5) * .03, (Math.random() - .5) * .02, (Math.random() - .5) * .03)).normalize() : dir, d.c, d.v + k, { owner: "ghost", exclude: d.k === "outlaw" && outlaws[d.i] ? outlaws[d.i].body.collider(0) : pCol }); }
    else INK.fire(o, dir, d.c, d.v, { owner: "anta", exclude: pCol }); S.launch(o); });
  NET.on("h", () => hurtMe());
  if (GUEST) { const b = document.querySelector(".top b"); if (b) b.textContent = "Anta"; }
  NET.on("join", () => { if (GUEST) { done.gate = true; nextGoal(); if (MODE !== "game") setMode("game"); say("You are Anta. Stay close to Uncle Mesa: when he takes the bike, you are on the back.", 6); } else say("Anta is here. Two guns now.", 4); S.chime(); });
  NET.on("leave", () => { PN.has = false; NW = null; pBody.setNextKinematicTranslation(v3(0, -55, 0)); if (st.mode === "pillion") st.mode = "foot"; say(GUEST ? "The line to Uncle Mesa dropped. Trying again…" : "Your friend has gone. Anta rides on with you.", 4); });
  function duelGuest(dt) { if (!NW) return; DUEL.wave = NW.d[0]; DUEL.left = NW.d[1]; if (NW.g[1] > GAME.combo) GAME.mark = .16; GAME.score = NW.g[0]; GAME.combo = NW.g[1]; GAME.comboT = NW.g[2];
    outlaws.forEach((o, i) => { const s2 = NW.o[i], g = o.ch.group, ring = rings[i]; if (!s2) return; const k = 1 - Math.exp(-dt * 10), was = o.state; o.state = s2[3]; g.visible = !!s2[5]; if (was === "away" || o.x === undefined) { o.x = s2[0]; o.z = s2[1]; } o.x = lerp(o.x, s2[0], k); o.z = lerp(o.z, s2[1], k);
      g.rotation.y = s2[2]; g.rotation.x = lerp(g.rotation.x, o.state === "fall" ? -Math.PI / 2 : 0, 1 - Math.exp(-dt * 6)); g.position.set(o.x, heightAt(o.x, o.z) + (o.state === "fall" ? .2 : 0), o.z);
      if (motion) try { if (o.state === "run") motion.setActorLocomotion(o.id, { speedMps: 3.6, blend: 1 }); else motion.setClip(o.id, o.state === "stagger" ? "angry" : "idle", { fade: .15 }); } catch (e) { }
      ring.visible = o.state === "telegraph"; if (ring.visible) { drawRing(ring, s2[4] / 1.2); const h = new T.Vector3(); boneW(o.ch, 7, h); ring.position.copy(h).add(new T.Vector3(0, .45, 0)); }
      o.body.setNextKinematicTranslation(o.state === "away" || o.state === "fall" || !g.visible ? v3(0, -50, 0) : v3(g.position.x, g.position.y + .85, g.position.z)); }); }
  function dash() { if (GAME.dashCool > 0 || st.mode !== "foot") return; const m = Math.hypot(GAME.mvx, GAME.mvz); GAME.dx = m > .1 ? GAME.mvx / m : Math.sin(st.heading); GAME.dz = m > .1 ? GAME.mvz / m : Math.cos(st.heading); GAME.dashT = .26; GAME.dashCool = .85; S.whoosh(); }
  const pickSpot = o => { const a = Math.atan2(o.x - st.x, o.z - st.z) + (Math.random() < .5 ? -1 : 1) * (.45 + Math.random() * .7), r = 8 + Math.random() * 9; o.tx = st.x + Math.sin(a) * r; o.tz = st.z + Math.cos(a) * r; };
  function startWave() { DUEL.wave++; DUEL.left = outlaws.length;
    outlaws.forEach((o, i) => { const a = CAM.yaw + (i - 1) * .75 + (Math.random() - .5) * .4, r = 21 + Math.random() * 7; o.x = st.x + Math.sin(a) * r; o.z = st.z + Math.cos(a) * r; o.hp = 2; o.state = "run"; o.t = -i * .6; o.ch.group.visible = true; o.ch.group.rotation.set(0, a + Math.PI, 0); o.ch.group.position.set(o.x, heightAt(o.x, o.z), o.z); pickSpot(o); for (let k = 0; k < 4; k++) puff(new T.Vector3(o.x, heightAt(o.x, o.z) + .4, o.z), 0xe8c890, new T.Vector3((Math.random() - .5) * 2, 1, (Math.random() - .5) * 2), 1.2, .5, 3, false); });
    say(DUEL.wave === 1 ? "Three of them, and they do not stand still. The red ring is the draw: shoot first, or dash." : `Wave ${DUEL.wave}.`, 3.5); S.bell(); }
  function duelStep(dt) { if (GL()) return duelGuest(dt);
    if (!DUEL.on) { outlaws.forEach((o, i) => { if (o.ch) o.ch.group.visible = false; rings[i].visible = false; o.state = "away"; o.body.setNextKinematicTranslation(v3(0, -50, 0)); }); DUEL.left = 0; return; }
    if (!done.gate || inPit()) return;   /* not before the gate, and not down in the cathedral: that is the knight's */
    if (DUEL.left === 0) { DUEL.next += dt; if (DUEL.next > (DUEL.wave ? 5 : 1.5)) { DUEL.next = 0; startWave(); } return; }
    const tele = Math.max(.75, 1.45 - DUEL.wave * .09), sp = Math.min(5.4, 3.3 + DUEL.wave * .25);
    outlaws.forEach((o, i) => { const g = o.ch.group, ring = rings[i]; o.t += dt; const toMe = Math.atan2(st.x - o.x, st.z - o.z); let mv = 0;
      if (o.state !== "away" && o.state !== "fall" && Math.hypot(st.x - o.x, st.z - o.z) > 55) { const a = CAM.yaw + (Math.random() - .5) * 1.6; o.x = st.x + Math.sin(a) * 24; o.z = st.z + Math.cos(a) * 24; pickSpot(o); }   /* he outran them: they cut him off */
      if (o.state === "run") { const dx = o.tx - o.x, dz = o.tz - o.z, d = Math.hypot(dx, dz); if (o.t > 0 && d > .7) { o.x += dx / d * sp * dt; o.z += dz / d * sp * dt; g.rotation.y += wrapA(Math.atan2(dx, dz) - g.rotation.y) * (1 - Math.exp(-dt * 8)); mv = sp; } else if (o.t > 0) { o.state = "telegraph"; o.t = 0; S.tick(g.position); } }
      else if (o.state === "telegraph") { g.rotation.y = toMe; drawRing(ring, o.t / tele); if (o.t > tele) { o.state = "fire"; o.t = 0; outlawShot(o); } }
      else if (o.state === "fire" || o.state === "stagger") { g.rotation.y = toMe; if (o.t > .5) { o.state = "run"; o.t = 0; pickSpot(o); } }
      else if (o.state === "fall") { g.rotation.x = lerp(g.rotation.x, -Math.PI / 2, 1 - Math.exp(-dt * 6)); if (o.t > 1.6) { o.state = "away"; g.visible = false; g.rotation.x = 0; DUEL.left--; if (DUEL.left === 0) { GAME.slow = .7; GAME.cleared = (GAME.cleared || 0) + 1; GAME.cheer = 2; S.chime(); GAME.score += 250 * DUEL.wave; if (DUEL.wave === 3) complete("duel", "Three waves down, painted to the hat. More are coming."); else say("Clear.", 1.5); } } }
      if (motion) try { if (o.state === "run") motion.setActorLocomotion(o.id, { speedMps: mv, blend: 1 }); else motion.setClip(o.id, o.state === "stagger" ? "angry" : "idle", { fade: .15 }); } catch (e) { }
      if (o.state !== "away") g.position.set(o.x, heightAt(o.x, o.z) + (o.state === "fall" ? .2 : 0), o.z);
      ring.visible = o.state === "telegraph"; if (ring.visible) { const h = new T.Vector3(); boneW(o.ch, 7, h); ring.position.copy(h).add(new T.Vector3(0, .45, 0)); }
      const p = g.position; o.body.setNextKinematicTranslation(o.state === "away" || o.state === "fall" ? v3(0, -50, 0) : v3(p.x, p.y + .85, p.z)); }); }
  /* glass chips: six-sided panes that hang and drift near him; a hit breaks one, pays ink and keeps the combo alive */
  const CHIPS = []; { const g = new T.CylinderGeometry(.5, .5, .07, 6); g.rotateX(Math.PI / 2); const cols = [["#2fd0d8", "#e9f4f0", "#2a4ab8"], ["#f2a83a", "#f2d04a", "#d8342c"], ["#e85aa8", "#f6efe0", "#2fd0d8"]];
    for (let i = 0; i < 7; i++) { const m = new T.Mesh(g, W.glassMat(W.leaded(700 + i, { cells: 3, pal: cols[i % 3] }), { opacity: .92, emissiveIntensity: 1.2 })); m.visible = false; scene.add(m); const b = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -70 - i, 0)), c = world.createCollider(R.ColliderDesc.ball(.58), b), ch = { m, b, alive: false, t: -1 - i * .8, ph: i * 1.7, x: 0, y: 0, z: 0 }; OWNER.set(c.handle, { kind: "chip", ch }); CHIPS.push(ch); } }
  function gameStep(dt, t) { GAME.comboT -= dt; if (GAME.comboT <= 0) GAME.combo = 0; GAME.dashT = Math.max(0, GAME.dashT - dt); GAME.dashCool = Math.max(0, GAME.dashCool - dt); GAME.mark = Math.max(0, GAME.mark - dt); GAME.shake = Math.max(0, GAME.shake - dt * 2.2); GAME.kick = Math.max(0, (GAME.kick || 0) - dt * 5); GAME.cheer = Math.max(0, (GAME.cheer || 0) - dt); GAME.hurtT += dt; if (GAME.hp < 3 && GAME.hurtT > 7) { GAME.hp++; GAME.hurtT = 0; }
    if (GAME.dashT > 0 && Math.random() < dt * 60) puff(new T.Vector3(st.x, st.y + .3 + Math.random(), st.z), 0xf2d8a8, new T.Vector3(-GAME.dx * 2, .4, -GAME.dz * 2), .5, .3, 2.5, false);
    const live = !GL() && DUEL.on && done.gate && st.mode === "foot" && !inPit();
    for (const c of CHIPS) { if (!c.alive) { c.m.visible = false; c.b.setNextKinematicTranslation(v3(0, -70, 0)); c.t += dt; if (c.t > 0 && live) { const a = CAM.yaw + (Math.random() - .5) * 2.4, r = 9 + Math.random() * 15; c.x = st.x + Math.sin(a) * r; c.z = st.z + Math.cos(a) * r; c.y = Math.max(heightAt(c.x, c.z), st.y) + 2.4 + Math.random() * 2; c.alive = true; c.life = 16; c.grow = 0; } continue; }
      c.life -= dt; c.grow = Math.min(1, c.grow + dt * 4); c.x += Math.cos(t * .6 + c.ph) * dt * 1.1; const y = c.y + Math.sin(t * 1.7 + c.ph) * .4; c.m.visible = true; c.m.position.set(c.x, y, c.z); c.m.rotation.y += dt * 2.2; c.m.scale.setScalar(c.grow * (c.life < 1 ? Math.max(.01, c.life) : 1)); c.b.setNextKinematicTranslation(v3(c.x, y, c.z));
      if (c.life < 0 || Math.hypot(c.x - st.x, c.z - st.z) > 42) { c.alive = false; c.t = -1; } } }
  function drawRing(s, k) { const c = s.material.map.image, q = c.getContext("2d"); q.clearRect(0, 0, 128, 128); q.lineWidth = 10; q.strokeStyle = "rgba(255,60,60,.35)"; q.beginPath(); q.arc(64, 64, 48, 0, 6.29); q.stroke(); q.strokeStyle = "rgba(255,40,60,.95)"; q.beginPath(); q.arc(64, 64, 48, -Math.PI / 2, -Math.PI / 2 + clamp(k, 0, 1) * 6.283); q.stroke(); s.material.map.needsUpdate = true; }
  const DAKAR = [0xd8342c, 0xf2c81e, 0x1f9a4a, 0x2a6ad8];   /* Touki Bouki: the red, yellow and green of the flag, and the blue of the Dakar sky */
  function outlawShot(o) { if (!INK) return; const from = new T.Vector3(); boneW(o.ch, 20, from); const tp = NET.live && PN.has && Math.random() < .45 ? anta.group.position : st, to = new T.Vector3(tp.x, tp.y + 1.2, tp.z), L = to.distanceTo(from), tf = L / 28; to.y += .5 * 9.81 * tf * tf;
    const d = to.sub(from).normalize(), col = DAKAR[(o.shots = (o.shots || 0) + 1) % DAKAR.length];
    for (let k = 0; k < 3; k++) INK.fire(from.clone().addScaledVector(d, .4), d.clone().add(new T.Vector3((Math.random() - .5) * .03, (Math.random() - .5) * .02, (Math.random() - .5) * .03)).normalize(), col, 27 + k, { owner: "outlaw", exclude: o.body.collider(0) });
    if (NET.live) NET.send({ e: "f", o: [r2(from.x + d.x * .4), r2(from.y + d.y * .4), r2(from.z + d.z * .4)], d: [d.x, d.y, d.z], c: col, v: 27, k: "outlaw", i: outlaws.indexOf(o) });
    S.launch(from); S.launch(from); puff(from.clone().addScaledVector(d, .3), col, d.clone().multiplyScalar(2), .5, .08, 1.6, false); }

  /* ---------- jobs, offers, modes ---------- */
  const GOALS = [["gate", "Pass through the title gate"], ["iris", "Sight the mesas through the clockwork iris"], ["horse", "Ride the lone horse"], ["prism", "Shatter a glass prism"], ["duel", "Win the duel (Game mode)"], ["cathedral", "Descend into the glass cathedral"], ["oasis", "Find the oasis"], ["zig", "Sit on the ziggurat steps"], ["turf", "Ink 250 m² of turf. It cures to glass"], ["tags", "Fill the four tag spots on Main Street"], ["touki", "Ride the horned motorcycle with Anta"], ["knight", "Shatter the stained-glass knight in the cathedral"]];
  const done = {}; $("goals").innerHTML = GOALS.map(([k, t]) => `<li data-k="${k}">${t}</li>`).join("");
  const nextGoal = () => { let found = false; for (const li of $("goals").children) { const n = !found && !done[li.dataset.k]; li.classList.toggle("next", n); if (n) found = true; } }; nextGoal(); $("goals").addEventListener("click", () => $("goals").classList.toggle("open"));
  function complete(k, line) { if (done[k]) return; done[k] = true; const li = $("goals").querySelector(`[data-k="${k}"]`); if (li) li.classList.add("done"); nextGoal(); S.chime(); if (line) say(line, 4); }
  /* ---------- the way through: five missions in order, each with a beam to walk to and an arrow on the glass, ending at the trough
     gate (atlas/trough-gate.js), which leads on into the trough. Nobody is left loose in the open world. ---------- */
  const GATE = { x: 26, z: -256 }, TG = window.TroughGate ? window.TroughGate.build(T) : null; if (TG) { TG.position.set(GATE.x, heightAt(GATE.x, GATE.z), GATE.z); TG.rotation.y = .5; scene.add(TG); }
  const MIS = [
    { t: "Walk north through the title gate", at: () => [0, Z.title_gate.z - 8], ok: () => done.gate },
    { t: "Clear the street with Anta", at: () => null, ok: () => (GAME.cleared || 0) >= 1 },
    { t: "Ride the horned bike to the oasis. Anta shoots from the back", at: () => st.mode === "bike" ? [Z.oasis_pond.x, Z.oasis_pond.z] : [BK.x, BK.z], ok: () => near(st, Z.oasis_pond, 34) },
    { t: "Go down into the glass cathedral and break the knight", at: () => [W.PIT.x, W.PIT.z + 20], ok: () => done.knight },
    { t: "Carry the chip north to the trough", at: () => [GATE.x, GATE.z], ok: () => false }];
  let MI = 0; const misLi = document.createElement("li"), WAY = new T.Mesh(new T.CylinderGeometry(.35, .35, 120, 10, 1, true), new T.MeshBasicMaterial({ color: 0xf2d04a, transparent: true, opacity: .3, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })), WAYAT = new T.Vector3(); WAY.visible = false; scene.add(WAY);
  misLi.className = "next"; misLi.textContent = MIS[0].t; $("goals").prepend(misLi);
  function missionStep() { if (GL() && NW && NW.mi !== MI && MIS[NW.mi]) { MI = NW.mi; misLi.textContent = MIS[MI].t; say(MIS[MI].t + ".", 4.5); } const m = MIS[MI]; if (!m) return; if (!GL() && m.ok()) { MI++; S.chime(); const n = MIS[MI]; if (n) { misLi.textContent = n.t; say(n.t + ".", 4.5); } return; }
    const a = MODE === "cinema" ? null : m.at(); WAY.visible = !!a && MI !== 4; if (a) { WAYAT.set(a[0], heightAt(a[0], a[1]) + 1.2, a[1]); WAY.position.set(a[0], WAYAT.y + 59, a[1]); } else WAYAT.y = -9999; }
  let lineT = 0; function say(t, sec = 3) { $("line").textContent = t; $("line").classList.add("on"); lineT = sec; }
  const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) < r;
  function offer() { const p = { x: st.x, z: st.z };
    if (st.mode === "bike") return Math.abs(BK.speed) < 7 ? { label: "Get off", run: () => { st.mode = "foot"; S.engine(false); st.x = BK.x + Math.cos(BK.h) * 1.2; st.z = BK.z - Math.sin(BK.h) * 1.2; st.y = heightAt(st.x, st.z); meBody.setTranslation(v3(st.x, st.y + .85, st.z), true); me.group.rotation.set(0, st.heading, 0); } } : null;
    if (st.mode === "foot" && !GL() && near(p, BK, 3.6)) return { label: "Ride the horned bike", run: () => { st.mode = "bike"; st.gun = false; holdGun(false); S.engine(true); if (!BK.rode) { BK.rode = true; say("Anta climbs on behind him. The horns point the way out of town.", 3.5); } complete("touki", "The zebu horns cut the wind. Touki Bouki: the journey of the hyena."); } };
    if (st.mode === "ride") return { label: "Get down", run: () => { st.mode = "foot"; const M = mount.state; st.x = M.x + Math.cos(M.heading) * 1.6; st.z = M.z - Math.sin(M.heading) * 1.6; st.y = heightAt(st.x, st.z); meBody.setTranslation(v3(st.x, st.y + .85, st.z), true); } };
    if (st.mode === "sit") return { label: "Stand", run: () => { st.mode = "foot"; } };
    if (st.mode !== "foot") return null;
    if (TG && near(p, GATE, 5)) return { label: "Pour into the trough", run: () => { say("The chip goes into the water, and the water remembers the way.", 3); S.chime(); setTimeout(() => window.TroughGate.go("mesa", "mars"), 1400); } };
    if (near(p, mount.state, 3)) return { label: "Saddle up", run: () => { st.mode = "ride"; st.gun = false; holdGun(false); complete("horse", "Uncle Mesa swings up in front of the striped glass, and the wall throws his shadow forty feet long."); S.neigh(); } };
    if (near(p, W.zig.seat, 4)) return { label: "Sit and rest", run: () => { st.mode = "sit"; st.x = W.zig.seat.x; st.z = W.zig.seat.z; st.y = W.zig.seat.y; st.heading = Math.PI / 2; complete("zig", "He sits on the warm steps in the low sun, and the glass columns burn gold behind him."); } };
    if (near(p, W.booth.userData.seat, 2.2)) return { label: "Take a seat at the booth", run: () => { st.mode = "sit"; const s = W.booth.userData.seat; st.x = s.x; st.z = s.z; st.y = s.y - .7; st.heading = Math.PI; say("Uncle Chip's booth. Under the glass sign, a man can sit and still draw.", 3); } };
    if (done.gate && !GL() && !near(p, BK, 3.6)) return { label: "Call the bike", run: () => { BK.x = st.x + Math.cos(CAM.yaw) * 2.4; BK.z = st.z - Math.sin(CAM.yaw) * 2.4; BK.h = CAM.yaw; BK.speed = 0; S.cock(); say("Anta brings the bike round.", 2); } };
    return null; }
  let MODE = "world"; function setMode(m) { MODE = m; document.body.classList.toggle("cinema", m === "cinema"); for (const b of document.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", b.dataset.mode === m); DUEL.on = m === "game"; if (m === "game") { DUEL.wave = 0; DUEL.left = 0; DUEL.next = 0; GAME.score = 0; GAME.combo = 0; GAME.hp = 3; } DIR.i = 0; DIR.t = 0; }
  function fall(line) { if (LENS) LENS.event("fall"); if (window.__trials) window.__trials.fall(); if (st.mode === "ride") { st.mode = "foot"; } st.mode = "down"; st.downT = 0; if (line) say(line, 2); S.thud(new T.Vector3(st.x, st.y, st.z)); }

  /* ---------- the director (Cinema): the breakdown's six cameras ---------- */
  const DIR = { i: 0, t: 0 }, SHOTS = [
    { name: "#1 through the clockwork iris", f: t => { const z = Z.clockwork_iris.z, y = W.iris.userData.y; return [[0, y, z + 14 - t * 4], [0, y + 3, -300]]; }, on: () => { IRIS.open = 1; } },
    { name: "#2 the sign monolith", f: t => { const z = Z.duel_arena.z + 26; return [[-14 + t * 28, 4 + t * 2, z + 22], [0, 12, z]]; } },
    { name: "#3 crane descent into the cathedral", f: t => { const y = W.cathedralY; return [[0, y + 46 - t * 40, W.PIT.z + 50 - t * 20], [0, y + 2, W.PIT.z - 10]]; } },
    { name: "#4 the silhouette wall in profile", f: t => { const w = Z.silhouette_wall, y = heightAt(w.x, w.z); return [[w.x - 30 + t * 30, y + 2.2, w.z + 26], [w.x - 30 + t * 30, y + 3, w.z - 8]]; } },
    { name: "#5 wide pullback from the curtain wall", f: t => { const z = Z.north_curtain_wall.z; return [[20, 6 + t * 50, z + 60 + t * 160], [0, 60, z]]; } },
    { name: "#6 the ziggurat, closing", f: t => { const s = W.zig.seat; return [[s.x + 20 - t * 4, s.y + 1.2, s.z + 2], [s.x, s.y + 1, s.z]]; } }];

  /* ---------- input ---------- */
  const keys = {}; addEventListener("keydown", e => { if (e.repeat) return; keys[e.code] = true; S.wake();
    if (e.code === "KeyE") { const o = offer(); if (o) o.run(); }
    if (e.code === "KeyR" && st.mode === "foot") { st.gun = !st.gun; st.gunLock = st.gun; holdGun(st.gun); S.cock(); }
    if (e.code === "Space") e.preventDefault();
    if (e.code === "KeyX") { st.smokeT = 2.2; S.exhale(); }
    if (e.code === "KeyP") { st.poncho = !st.poncho; say(st.poncho ? "The dark-weave poncho." : "The white shirt and the badge.", 1.4); }
    if (e.code === "KeyT") toggleStorm();
    if (e.code === "KeyZ" && st.mode !== "down") fall("He goes down. He gets up.");
    if (e.code === "KeyG") GRIDON = !GRIDON;
    if (/^Digit[1-6]$/.test(e.code)) mood(+e.code.slice(5) - 1);
    if (e.code === "KeyQ" || e.code === "KeyF") dash();
    if (e.code === "KeyV") setMode(MODE === "cinema" ? "world" : "cinema");
    if (e.code === "KeyL" && LENS) { LENS.cycle(); lensUI(); } });
  addEventListener("keyup", e => { keys[e.code] = false; });
  const mouse = { x: 0, y: .08, on: false }; canvas.addEventListener("pointermove", e => { if (e.pointerType === "touch") return; mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = -(e.clientY / innerHeight * 2 - 1); mouse.on = true; });
  canvas.addEventListener("pointerdown", e => { S.wake(); if (e.pointerType !== "touch") mouse.down = true; }); addEventListener("pointerup", () => { mouse.down = false; });
  $("do").addEventListener("click", () => { const o = offer(); if (o) o.run(); });
  for (const b of document.querySelectorAll("[data-mode]")) b.addEventListener("click", () => setMode(b.dataset.mode));
  $("wide").addEventListener("click", () => { WIDE = !WIDE; $("wide").setAttribute("aria-pressed", WIDE); });
  function lensUI() { const b = $("lens"); if (!b || !LENS) return; b.textContent = LENS.label(); b.setAttribute("aria-pressed", LENS.on()); if (LENS.on()) say({ tekle: "Afewerk Tekle: one window, cut once. Only the light moves.", lucas85: "1985: every facet takes its own light; the focus follows the fight.", mambety: "Mambéty: told, not shot. It holds, it jumps, the horns come back.", moebius: "Mœbius and Otomo: one line, flat colour, light that stays behind." }[LENS.name], 3); }
  if ($("lens")) { $("lens").addEventListener("click", () => { LENS.cycle(); lensUI(); }); lensUI(); }
  $("gridb").addEventListener("click", () => { GRIDON = !GRIDON; });
  /* ---------- touch: the left thumb is a stick wherever it lands, the right thumb turns the view, and there is one button to fire.
     PAD carries the stick; CAM is where the camera faces. On foot, W A S D and the stick move him where the camera faces. ---------- */
  const PAD = { mx: 0, my: 0, fire: false, look: false, touch: false, swim: false, sid: null, lid: null, sx: 0, sy: 0, lx: 0, ly: 0 }, CAM = { yaw: Math.PI, pitch: 0 };
  { const stickEl = $("stick"), knob = stickEl.firstElementChild, fb = $("fireb"), touchOn = () => { if (PAD.touch) return; PAD.touch = true; document.body.classList.add("touch"); WIDE = false; };
    const look = e => { CAM.yaw -= (e.clientX - PAD.lx) * .0055; CAM.pitch = clamp(CAM.pitch - (e.clientY - PAD.ly) * .004, -.3, .5); PAD.lx = e.clientX; PAD.ly = e.clientY; };
    canvas.addEventListener("pointerdown", e => { if (e.pointerType !== "touch") return; touchOn(); try { canvas.setPointerCapture(e.pointerId); } catch (x) { }
      if (e.clientX < innerWidth * .45 && PAD.sid === null) { PAD.sid = e.pointerId; PAD.sx = e.clientX; PAD.sy = e.clientY; stickEl.hidden = false; stickEl.style.left = e.clientX + "px"; stickEl.style.top = e.clientY + "px"; knob.style.transform = ""; }
      else if (PAD.lid === null) { PAD.lid = e.pointerId; PAD.lx = e.clientX; PAD.ly = e.clientY; PAD.look = true; } });
    canvas.addEventListener("pointermove", e => { if (e.pointerId === PAD.sid) { let dx = e.clientX - PAD.sx, dy = e.clientY - PAD.sy; const L = Math.hypot(dx, dy), M = 56; if (L > M) { dx *= M / L; dy *= M / L; } PAD.mx = dx / M; PAD.my = -dy / M; PAD.swim = Math.hypot(PAD.mx, PAD.my) > .85; knob.style.transform = `translate(${dx}px, ${dy}px)`; } else if (e.pointerId === PAD.lid) look(e); });
    const up = e => { if (e.pointerId === PAD.sid) { PAD.sid = null; PAD.mx = PAD.my = 0; PAD.swim = false; stickEl.hidden = true; } if (e.pointerId === PAD.lid) { PAD.lid = null; PAD.look = false; } }; canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    /* the fire button: hold to shoot, and slide the same thumb to turn while shooting */
    fb.addEventListener("pointerdown", e => { e.preventDefault(); touchOn(); S.wake(); PAD.fire = true; PAD.lx = e.clientX; PAD.ly = e.clientY; try { fb.setPointerCapture(e.pointerId); } catch (x) { } }); fb.addEventListener("pointermove", e => { if (PAD.fire) look(e); }); for (const ev of ["pointerup", "pointercancel"]) fb.addEventListener(ev, () => { PAD.fire = false; });
    $("dashb").addEventListener("pointerdown", e => { e.preventDefault(); touchOn(); dash(); });
    $("menub").addEventListener("click", () => { const on = document.body.classList.toggle("menu"); $("menub").setAttribute("aria-expanded", on); $("menub").textContent = on ? "×" : "☰"; });
    document.querySelector(".bar").addEventListener("click", e => { if (PAD.touch && e.target.closest("button")) { document.body.classList.remove("menu"); $("menub").textContent = "☰"; } });
    if (matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900)) setTimeout(touchOn, 0); }
  /* aiming: the shot goes where the reticle is, and if something worth shooting is within a few degrees of it, the gun finds it */
  const ray = new T.Raycaster(), LOCK = { p: null }, _lk = new T.Vector3();
  function aimDir() { ray.setFromCamera(new T.Vector2(mouse.on ? mouse.x : 0, mouse.on ? mouse.y : .1), camera); const d = ray.ray.direction.clone(); LOCK.p = null; let best = Math.cos(PAD.touch ? .5 : .24);   /* a thumb needs a wider cone than a mouse */
    const tryP = (p, far) => { const v = _lk.copy(p).sub(camera.position), L = v.length(); if (L > far || L < 1.5) return; const c = v.dot(d) / L; if (c > best) { best = c; LOCK.p = p.clone(); } };
    for (const o of outlaws) if (o.ch && o.ch.group.visible && (o.state === "run" || o.state === "telegraph" || o.state === "fire" || o.state === "stagger")) tryP(boneW(o.ch, 3, new T.Vector3()), 90);
    for (const c of CHIPS) if (c.alive) tryP(c.m.position, 45);
    if (KNIGHT.state === "hunt" || KNIGHT.state === "strike") tryP(new T.Vector3(KNIGHT.x, W.cathedralY + 1.25, KNIGHT.z), 60);
    for (const p of W.prisms) if (!p.broken) tryP(new T.Vector3(p.x, p.y, p.z), 30);
    return d; }
  const GRAB = document.createElement("canvas"); let GRIDON = !COARSE, WIDE = true, STORM = 0, STORMON = false, gridT = 0;
  function toggleStorm() { STORMON = !STORMON; S.storm(STORMON); say(STORMON ? "The sand comes up in gold ribbons, and the spectacles go with it." : "The storm lies down.", 2.2); }
  /* 1–6: six pads in the minor of the West, and six times of day to go with them */
  const MOODS = [
    { name: "dawn", el: .06, az: 1.2, a: "#f2a0a8", b: "#4a5ab8", c: "#f6e6dc", sun: 0xffc0a0, chord: [220, 261.6, 329.6] },
    { name: "morning", el: .35, az: .9, a: "#f2d04a", b: "#3a7ac8", c: "#f4ecd8", sun: 0xfff0d8, chord: [196, 246.9, 293.7] },
    { name: "noon", el: .9, az: .2, a: "#f4e070", b: "#2a6ad8", c: "#f8f2e4", sun: 0xffffff, chord: [174.6, 220, 261.6] },
    { name: "afternoon", el: .45, az: -.6, a: "#f2c84a", b: "#3a6ab8", c: "#f4e8d2", sun: 0xffe2b0, chord: [164.8, 207.7, 246.9] },
    { name: "golden hour", el: .14, az: -1.0, a: "#f2a83a", b: "#2a4a98", c: "#f6dcae", sun: 0xffb060, chord: [146.8, 174.6, 220] },
    { name: "dusk", el: .03, az: -1.3, a: "#e85a3a", b: "#2a2a6a", c: "#e8b090", sun: 0xff8050, chord: [130.8, 164.8, 196] }];
  let MOOD = 4, MOODK = 1; const sunCol = new T.Color(MOODS[MOOD].sun);
  function mood(i) { MOOD = i; MOODK = 0; S.pad(MOODS[i].chord); say(`${i + 1} · ${MOODS[i].name}`, 1.6); }

  /* ---------- sound ---------- */
  const S = (() => { let ctx = null, master, wet, beds = {}, buf = {}, stormG = null;
    function wake() { if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; } ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .8; master.connect(ctx.destination);
      const n = Math.floor(ctx.sampleRate * 3), ir = ctx.createBuffer(2, n, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) { const t = i / ctx.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6) * (t < .12 ? .15 : 1) * (1 + 1.2 * Math.exp(-((t - .5) ** 2) * 200) + .8 * Math.exp(-((t - 1.1) ** 2) * 120)); } }
      wet = ctx.createConvolver(); wet.buffer = ir; const wg = ctx.createGain(); wg.gain.value = .4; wet.connect(wg).connect(master);
      fetch(SOUND + "bajaj_start_idle.mp3").then(r => r.arrayBuffer()).then(a => ctx.decodeAudioData(a)).then(b => { buf.engine = b; }).catch(() => { });
      for (const k of ["wind_plain", "wind_gusts"]) fetch(SOUND + k + ".mp3").then(r => r.arrayBuffer()).then(a => ctx.decodeAudioData(a)).then(b => { buf[k] = b; const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; const g = ctx.createGain(); g.gain.value = k === "wind_plain" ? .16 : 0; s.connect(g).connect(master); s.start(); if (k === "wind_gusts") stormG = g; }).catch(() => { }); }
    function out(p, gain = 1, w = .35) { const g = ctx.createGain(); g.gain.value = gain; let node = g; if (p) { const pn = ctx.createPanner(); pn.panningModel = "HRTF"; pn.refDistance = 5; pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; g.connect(pn); node = pn; } node.connect(master); if (w) { const s = ctx.createGain(); s.gain.value = w; node.connect(s).connect(wet); } return g; }
    function noise(sec) { const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
    function burst(p, sec, type, f, gain, decay, w) { if (!ctx) return; const s = ctx.createBufferSource(); s.buffer = noise(sec); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = ctx.createGain(), t = ctx.currentTime; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + decay); s.connect(fl).connect(g).connect(out(p, 1, w)); s.start(); }
    function tone(p, f0, f1, sec, gain, type = "sine", w = .35, at = 0, attack = .005) { if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at; o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + sec); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(.0008, t + sec); o.connect(g).connect(out(p, 1, w)); o.start(t); o.stop(t + sec + .05); }
    return { wake,
      listener(cam) { if (!ctx) return; const L = ctx.listener, f = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); if (L.positionX) { L.positionX.value = cam.position.x; L.positionY.value = cam.position.y; L.positionZ.value = cam.position.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; } },
      shot(p, g = 1) { burst(p, .08, "highpass", 1500, 1.1 * g, .07, .4); burst(p, .4, "lowpass", 600, .9 * g, .35, .6); tone(p, 120, 40, .25, .6 * g, "sine", .3); },
      ric(p) { tone(p, 3200, 900, .25, .08, "sawtooth", .3); },
      launch(p) { burst(p, .06, "lowpass", 900, .35, .06, .1); tone(p, 260, 140, .07, .12, "sine", .1); },
      splat(p) { burst(p, .16, "lowpass", 700 + Math.random() * 500, .5, .14, .25); tone(p, 180 + Math.random() * 120, 70, .12, .12, "sine", .2); tone(p, 900 + Math.random() * 600, 1800, .05, .03, "sine", .3, .04); },
      cure(p) { if (!ctx || ctx.currentTime - (this._c || 0) < .07) return; this._c = ctx.currentTime; const f = [1568, 1760, 2093, 2349, 2637][Math.floor(Math.random() * 5)]; tone(p, f, f, .9, .035, "sine", .7, 0, .01); tone(p, f * 1.5, f * 1.5, .5, .015, "sine", .7, .03); },
      chord() { this.pad && this.pad([196, 246.9, 293.7]); },
      dry() { tone(null, 600, 500, .03, .06, "square", .05); },
      note(f, p) { tone(p || null, f, f, .55, .1, "triangle", .55); tone(null, f * 2, f * 2, .3, .035, "sine", .6, .02); },
      whoosh() { burst(null, .28, "bandpass", 1400, .35, .24, .15); },
      hurt() { burst(null, .22, "lowpass", 260, .9, .2, .2); tone(null, 170, 60, .32, .28, "sawtooth", .2); },
      step(p, glass) { if (!ctx) return; if (glass) { tone(p, 1900 + Math.random() * 900, 1500, .08, .045, "sine", .6); burst(p, .04, "highpass", 3200, .1, .04, .4); } else burst(p, .1, "lowpass", 340 + Math.random() * 180, .34, .09, .06); },
      bloom(p) { if (!ctx) return; const f = [784, 988, 1175, 1319, 1568][Math.floor(Math.random() * 5)]; tone(p, f, f, 1.4, .06, "sine", .7, .05, .02); tone(p, f * 2.01, f * 2.01, .9, .025, "sine", .7, .08); burst(p, .2, "highpass", 5000, .12, .18, .4); },
      glass(p, k = 1) { if (!ctx) return; burst(p, .3 * k, "highpass", 3500, .6 * k, .3 * k, .5); for (let i = 0; i < 10 * k; i++) tone(p, 2500 + Math.random() * 4000, 2000 + Math.random() * 3000, .2 + Math.random() * .4, .05, "sine", .5, Math.random() * .5 * k); },
      thud(p) { burst(p, .3, "lowpass", 200, .9, .28, .3); },
      tick(p) { tone(p, 1800, 1700, .05, .15, "square", .2); tone(p, 1800, 1700, .05, .15, "square", .2, .5); tone(p, 1800, 1700, .05, .15, "square", .2, 1); },
      cock() { tone(null, 2400, 2200, .03, .15, "square", .1); tone(null, 1600, 1400, .04, .15, "square", .1, .08); },
      exhale() { burst(null, 1.2, "bandpass", 900, .18, 1.1, .3); },
      neigh() { burst(null, .6, "bandpass", 1400, .25, .5, .3); },
      chime() { if (!ctx) return; [659, 784, 988].forEach((f, i) => tone(null, f, f, .7, .07, "triangle", .4, i * .1)); },
      bell() { if (!ctx) return; for (const [r, g] of [[1, .3], [2.4, .15], [3, .1]]) tone(null, 330 * r, 330 * r, 2.5, g, "sine", .6); },
      pad(chord) { if (!ctx) return; for (const f of chord) for (const det of [-3, 3]) { const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), t = ctx.currentTime; o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det;
          const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lfo.frequency.value = 5.2; lg.gain.value = .015; lfo.connect(lg).connect(g.gain); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + 1.2); g.gain.linearRampToValueAtTime(0, t + 6); o.connect(lp).connect(g).connect(out(null, 1, .7)); o.start(t); lfo.start(t); o.stop(t + 6.1); lfo.stop(t + 6.1); }
        tone(null, chord[2] * 2, chord[2] * 2.0, 2.4, .05, "sine", .8, .6, .4); tone(null, chord[1] * 2, chord[1] * 2, 2.4, .045, "sine", .8, 2.2, .4); },
      engine(on) { if (!ctx) return; if (on && !this._eng && buf.engine) { const src = ctx.createBufferSource(); src.buffer = buf.engine; src.loop = true; const g = ctx.createGain(); g.gain.value = .4; src.connect(g).connect(master); src.start(); this._eng = src; } if (!on && this._eng) { this._eng.stop(); this._eng = null; } },
      engineRate(r) { if (this._eng) this._eng.playbackRate.value = r; },
      storm(on) { if (stormG && ctx) stormG.gain.linearRampToValueAtTime(on ? .5 : 0, ctx.currentTime + 2); } }; })();

  /* ---------- the ink ---------- */
  { const TAGS = [[15, 110, -1, "east front", ["MESA", "CHIP"]], [15, 98, -1, "saloon front", ["DATA", "REMEMBERS"]], [-15, 86, 1, "west front", ["UNCLE", "MESA"]], [-15, 74, 1, "far front", ["THIS", "LAND"]]].map(([x, z, s2, name, text], i) => {
      const y = heightAt(x, z) + 4.2; return { name, p: new T.Vector3(x + s2 * .25, y, z), n: new T.Vector3(s2, 0, 0), w: 6.4, h: 3.4, need: 10, color: [0xf2d04a, 0x2fd0d8, 0xe85aa8, 0xf2a83a][i], mural: W.leaded(500 + i, { cells: 6, text, size: 96 }) }; });
    INK = window.MesaInk.create({ T, scene, world, R, OWNER, exclude: () => meCol, heightAt, S, puff, say, complete, onHit: inkHit, tags: TAGS }); }

  /* ---------- the frame ---------- */
  boot("Opening the iris…");
  let SCH = 0; const GODS = []; W.root.traverse(o => { if (o.userData.god) GODS.push(o); });
  const clock = new T.Clock(), IRIS = { open: 0 }; let offerNow = null, fstep = 0;
  const camPos = new T.Vector3(st.x, st.y + 3, st.z + 8), camLook = new T.Vector3(st.x, st.y + 1.5, st.z);
  function frame() {
    let dt = Math.min(clock.getDelta(), .05); const t = clock.elapsedTime; if (GAME.slow > 0) { GAME.slow -= dt; dt *= .35; }
    /* playable first: if the frame rate falls, render fewer pixels; when it recovers, give them back */
    GOV.avg += (dt - GOV.avg) * .05; GOV.t += dt;
    if (GOV.t > 1.5) { GOV.t = 0; const fps = 1 / Math.max(1e-3, GOV.avg), pr = renderer.getPixelRatio();
      if (fps < 40 && pr > .55) { renderer.setPixelRatio(Math.max(.55, pr - .2)); resize(); } else if (fps > 57 && pr < GOV.base - .01) { renderer.setPixelRatio(Math.min(GOV.base, pr + .1)); resize(); } }
    const padM = Math.hypot(PAD.mx, PAD.my), fwd = clamp((keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + (Math.abs(PAD.my) > .25 ? PAD.my : 0), -1, 1), turn = clamp((keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0) - (Math.abs(PAD.mx) > .25 ? PAD.mx : 0), -1, 1), run = keys.ShiftLeft || keys.ShiftRight || padM > .9;
    const kfwd = fwd, kturn = turn, trig = (keys.Space || mouse.down || PAD.fire) && (st.mode === "foot" || st.mode === "pillion");
    if (GL() && NW) { BK.x = NW.b[0]; BK.z = NW.b[1]; BK.h = NW.b[2]; BK.speed = NW.b[3]; BK.rode = true; if (PN.mode === "bike" && st.mode === "foot") { st.mode = "pillion"; say("On the back. Shoot.", 2); } else if (PN.mode !== "bike" && st.mode === "pillion") { st.mode = "foot"; st.x = BK.x + Math.cos(BK.h) * 1.3; st.z = BK.z - Math.sin(BK.h) * 1.3; st.y = heightAt(st.x, st.z); meBody.setTranslation(v3(st.x, st.y + .85, st.z), true); me.group.rotation.set(0, st.heading, 0); } }
    if (trig && !st.gun) { st.gun = true; holdGun(true); S.cock(); st.cool = .16; }   /* pulling the trigger draws */
    if (trig) st.gunT = 3.5; else if (st.gun && !st.gunLock) { st.gunT = (st.gunT || 0) - dt; if (st.gunT <= 0) { st.gun = false; st.steady = 0; holdGun(false); } }
    if (st.mode !== "foot" && st.mode !== "down" && st.mode !== "pillion") { CAM.yaw = st.heading; CAM.pitch = 0; }
    st.cool = Math.max(0, st.cool - dt); st.recoil = Math.max(0, st.recoil - dt * 5); st.steady = clamp(st.steady + dt * (st.gun ? (st.speed < .4 ? 1.7 : .8) : -3), 0, 1);   /* the aim settles: quicker standing still */
    if (lineT > 0) { lineT -= dt; if (lineT <= 0) $("line").classList.remove("on"); }
    if (st.mode === "foot") {
      /* he goes where the camera faces: W and S along it, A and D across it, the arrows (or the right thumb, or the mouse at the
         edge of the frame) turn it. He turns to face the way he walks; with the gun up he faces the way he aims and sidesteps. */
      const mx = clamp((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + PAD.mx, -1, 1), my = clamp((keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + PAD.my, -1, 1), mm = Math.min(1, Math.hypot(mx, my));
      CAM.yaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * dt * 2.2; if (!PAD.touch && mouse.on && Math.abs(mouse.x) > .6) CAM.yaw -= (Math.abs(mouse.x) - .6) * Math.sign(mouse.x) * dt * 4.5;
      const wx = Math.sin(CAM.yaw) * my - Math.cos(CAM.yaw) * mx, wz = Math.cos(CAM.yaw) * my + Math.sin(CAM.yaw) * mx;
      st.swim = !!((keys.ShiftLeft || keys.ShiftRight || PAD.swim) && INK && INK.inkUnder(st.x, st.z, st.y)); if (st.swim) st.ink = Math.min(100, st.ink + dt * 38);
      const speed = mm < .1 ? 0 : st.swim ? 6.2 : st.gun ? 2.6 : (run || mm > .8) && my > -.3 ? 4.6 : 1.9;
      if (st.gun) st.heading += wrapA(CAM.yaw - st.heading) * (1 - Math.exp(-dt * 14));
      else if (speed > 0) { st.heading += wrapA(Math.atan2(wx, wz) - st.heading) * (1 - Math.exp(-dt * 9)); if (!PAD.look && my > -.3) CAM.yaw += wrapA(st.heading - CAM.yaw) * (1 - Math.exp(-dt * .9)); }
      let dx = mm > 0 ? wx / mm * speed * dt : 0, dz = mm > 0 ? wz / mm * speed * dt : 0; GAME.mvx = speed > 0 ? wx : 0; GAME.mvz = speed > 0 ? wz : 0;
      if (GAME.dashT > 0) { dx = GAME.dx * 15 * dt; dz = GAME.dz * 15 * dt; }
      st.vy = ctrl.computedGrounded() ? -1 : st.vy - 9.81 * dt; meBody.setTranslation(v3(st.x, st.y + .85, st.z), true); ctrl.computeColliderMovement(meCol, v3(dx, st.vy * dt, dz));
      const mv = ctrl.computedMovement(); st.x += mv.x; st.y += mv.y; st.z += mv.z; if (ctrl.computedGrounded()) st.vy = 0; const g = heightAt(st.x, st.z); if (st.y < g - 3 && !(Math.abs(st.x) < 10 && Math.abs(st.z - W.PIT.z) < W.PIT.hz)) st.y = g;
      st.speed = Math.hypot(mv.x, mv.z) / Math.max(dt, 1e-3);
      st.stride = (st.stride || 0) + st.speed * dt; if (st.stride > (st.speed > 3 ? 1.2 : .74) && !st.swim) { st.stride = 0; S.step(_lk.set(st.x, st.y, st.z), st.y < W.cathedralY + .6); }
      me.group.position.set(st.x, st.y, st.z); me.group.rotation.set(0, st.heading, 0);
      if (motion) try { if (st.swim) motion.setClip("mesa", st.speed > .3 ? "crouch-walk" : "crouch-idle", { fade: .15 }); else if (GAME.dashT > 0) motion.setClip("mesa", "jump", { fade: .06 }); else if (GAME.cheer > 0 && st.speed < .3 && !trig) motion.setClip("mesa", "victory", { fade: .2 }); else if (st.gun && st.speed > .4 && GAME.mvx * Math.sin(st.heading) + GAME.mvz * Math.cos(st.heading) < -.4) motion.setClip("mesa", "walk-backwards", { fade: .15 }); else motion.setActorLocomotion("mesa", { speedMps: st.speed, blend: 1 }); } catch (e) { }
      if (st.swim && Math.random() < dt * 1.6) { const s0 = INK.inkUnder(st.x, st.z, st.y); if (s0 && me.bones) { const b = me.bones[[54, 59, 53, 58][Math.floor(Math.random() * 4)]]; if (b) paintBody(me, b.getWorldPosition(new T.Vector3()), s0.col, 1); } }
      if (st.swim && st.speed > .5 && Math.random() < dt * 30) { const s0 = INK.inkUnder(st.x, st.z, st.y); if (s0) puff(new T.Vector3(st.x, st.y + .1, st.z), s0.col, new T.Vector3((Math.random() - .5) * 2, 1.2, (Math.random() - .5) * 2), .5, .08, 1.5, false); }
    } else if (st.mode === "ride") {
      mount.update(dt, { throttle: fwd, steer: turn, pace: run ? 3 : 1 }, heightAt); const M = mount.state; mount.saddleAt(_sp, _sq);
      me.group.position.copy(_sp).add(new T.Vector3(0, -.62, 0)); me.group.quaternion.copy(_sq); st.x = M.x; st.z = M.z; st.y = _sp.y - 1.2; st.heading = M.heading;
      if (motion) try { motion.setClip("mesa", Math.abs(M.speed || 0) > 3.5 ? "horse-trot" : Math.abs(M.speed || 0) > .3 ? "horse-walk" : "horse-idle", { fade: .3 }); } catch (e) { }
    } else if (st.mode === "bike") {
      /* a thumb on the stick is the throttle; lean it to steer; pull it right back to brake. The steering calms down with speed. */
      const fwd = PAD.sid !== null ? (PAD.my < -.6 ? -1 : Math.max(.6, padM)) : kfwd, turn = PAD.sid !== null ? (Math.abs(PAD.mx) > .12 ? -PAD.mx : 0) : kturn;
      const boost = run ? 1.45 : 1, max = 19 * boost;
      BK.speed = lerp(BK.speed, fwd > 0 ? max * fwd : fwd < 0 ? (BK.speed > 1 ? 0 : -4) : 0, 1 - Math.exp(-dt * (fwd > 0 ? .7 : fwd < 0 ? 2.6 : 1.1)));
      BK.steer = lerp(BK.steer, turn * .42 / (1 + Math.abs(BK.speed) / 14), 1 - Math.exp(-dt * 6)); BK.h += BK.speed * Math.tan(BK.steer) / 1.46 * dt;
      const want = v3(Math.sin(BK.h) * BK.speed * dt, -.5 * dt, Math.cos(BK.h) * BK.speed * dt); bkBody.setTranslation(v3(BK.x, heightAt(BK.x, BK.z) + .6, BK.z), true);
      bkCtrl.computeColliderMovement(bkCol, want, R.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, c => c !== meCol);
      const mv = bkCtrl.computedMovement(), blocked = Math.hypot(want.x - mv.x, want.z - mv.z); BK.x += mv.x; BK.z += mv.z;
      if (blocked > .04) { if (Math.abs(BK.speed) > 21) { BK.speed = 0; S.engine(false); st.x = BK.x; st.z = BK.z; st.y = heightAt(BK.x, BK.z); st.heading = BK.h; meBody.setTranslation(v3(st.x, st.y + .85, st.z), true); fall("The horns hit first. Everyone goes over."); } else BK.speed *= .35; }
      BK.lean = lerp(BK.lean, -BK.steer * clamp(Math.abs(BK.speed) / 9, 0, 1.4) * 1.05, 1 - Math.exp(-dt * 5)); BK.wheelie = lerp(BK.wheelie, run && fwd > 0 && BK.speed < max * .75 ? .2 : 0, 1 - Math.exp(-dt * 3));
      if (st.mode === "bike") { st.x = BK.x; st.z = BK.z; st.y = heightAt(BK.x, BK.z); st.heading = BK.h; S.engineRate(.7 + Math.abs(BK.speed) * .055); if (Math.random() < dt * (4 + BK.speed)) { const ex = TK.group.localToWorld(TK.exhaust.clone()); puff(ex, 0xe8dccb, new T.Vector3(-Math.sin(BK.h), .4, -Math.cos(BK.h)), 1.2, .12, 3, false); } }
      meBody.setTranslation(v3(BK.x, st.y + 1.25, BK.z), true);   /* his body rides with the bike, so paint can still find him */
      if (motion) try { motion.setClip("mesa", "sitting-idle", { fade: .3 }); } catch (e) { }
    } else if (st.mode === "pillion") {   /* the second player on the back of the bike: carried, free to look round and shoot */
      CAM.yaw += ((keys.ArrowLeft || keys.KeyA ? 1 : 0) - (keys.ArrowRight || keys.KeyD ? 1 : 0)) * dt * 2.2; if (!PAD.look && !trig) CAM.yaw += wrapA(BK.h - CAM.yaw) * (1 - Math.exp(-dt * .8));
      st.x = BK.x; st.z = BK.z; st.y = heightAt(BK.x, BK.z); st.heading = CAM.yaw; st.speed = 0; meBody.setTranslation(v3(BK.x, st.y + 1.25, BK.z), true); if (motion) try { motion.setClip("mesa", "sitting-idle", { fade: .3 }); } catch (e) { }
    } else if (st.mode === "sit") { me.group.position.set(st.x, st.y, st.z); me.group.rotation.set(0, st.heading, 0); if (motion) try { motion.setClip("mesa", "sitting-idle", { fade: .4 }); } catch (e) { } }
    else if (st.mode === "down") { st.downT += dt; const k = st.downT < 2.2 ? smooth(0, .35, st.downT) : 1 - smooth(2.2, 3, st.downT); me.group.position.set(st.x, st.y + k * .25, st.z); me.group.rotation.set(-k * Math.PI / 2 * .95, st.heading, 0, "YXZ"); if (motion) try { motion.setClip("mesa", "idle", { fade: .2 }); } catch (e) { } if (st.downT > 3) { st.mode = "foot"; me.group.rotation.set(0, st.heading, 0); } }
    if (st.mode !== "ride") { mount.update(dt, { throttle: 0, steer: 0, pace: 0 }, heightAt); }
    /* the bike sits on its two wheels: pitch from the ground under each, lean into the turn, the fork turns with the steer */
    { if (st.mode !== "bike") { BK.speed = lerp(BK.speed, 0, 1 - Math.exp(-dt * 2)); BK.lean = lerp(BK.lean, st.mode === "foot" ? .12 : 0, 1 - Math.exp(-dt * 2)); BK.steer = lerp(BK.steer, .3, 1 - Math.exp(-dt * 2)); }
      const sx = Math.sin(BK.h), cz = Math.cos(BK.h), fy = heightAt(BK.x + sx * .74, BK.z + cz * .74), ry = heightAt(BK.x - sx * .72, BK.z - cz * .72), y = (fy + ry) / 2;
      BK.pitch = Math.atan2(ry - fy, 1.46) - BK.wheelie; TK.group.position.set(BK.x, y + Math.sin(BK.wheelie) * .3, BK.z); TK.group.rotation.set(BK.pitch, BK.h, BK.lean, "YXZ"); TK.fork.rotation.y = BK.steer * .9;
      for (const w of TK.wheels) w.rotation.x += BK.speed * dt / .35; TK.group.updateMatrixWorld(true);
      _be.set(0, BK.h, 0); _bq.setFromEuler(_be); bkBody.setNextKinematicTranslation(v3(BK.x, y + .6, BK.z)); bkBody.setNextKinematicRotation({ x: _bq.x, y: _bq.y, z: _bq.z, w: _bq.w });
      _bu.set(0, 1, 0).applyQuaternion(TK.group.quaternion);
      if (st.mode === "bike" || st.mode === "pillion") { me.group.position.copy(TK.group.localToWorld(_bs.copy(st.mode === "bike" ? TK.seat : TK.pillion))).addScaledVector(_bu, -SEATH); me.group.quaternion.copy(TK.group.quaternion); }
      if (anta) { if (NET.live && PN.has) partnerStep(dt); else if (BK.rode && (st.mode === "bike" || near({ x: BK.x, z: BK.z }, { x: anta.group.position.x, z: anta.group.position.z }, 1.5))) { anta.group.position.copy(TK.group.localToWorld(_bs.copy(TK.pillion))).addScaledVector(_bu, -SEATH); anta.group.quaternion.copy(TK.group.quaternion); if (motion) try { motion.setClip("anta", "sitting-idle", { fade: .3 }); } catch (e) { } }
        else if (done.gate) { /* on foot she keeps to his left, out of the line of the camera */ const g = anta.group.position, tx = st.x - Math.sin(CAM.yaw) * .6 - Math.cos(CAM.yaw) * 2.6, tz = st.z - Math.cos(CAM.yaw) * .6 + Math.sin(CAM.yaw) * 2.6, dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz), sp = d > 6 ? 5.2 : d > 1.1 ? 2.2 : 0;
          if (d > 34) { g.x = tx; g.z = tz; } else if (sp) { g.x += dx / d * sp * dt; g.z += dz / d * sp * dt; anta.group.rotation.set(0, Math.atan2(dx, dz), 0); } else if (AN.aimT > 0) anta.group.rotation.set(0, Math.atan2(AN.dir.x, AN.dir.z), 0);
          g.y = heightAt(g.x, g.z); if (motion) try { if (GAME.cheer > 0 && !sp) motion.setClip("anta", "clapping", { fade: .2 }); else motion.setActorLocomotion("anta", { speedMps: sp, blend: 1 }); } catch (e) { } }
        else { if (motion) try { motion.setClip("anta", near(st, anta.group.position, 7) ? "greeting" : "idle-foldarms", { fade: .3 }); } catch (e) { } }
        if (!NET.live) antaStep(dt);
        const ch = boneW(ACH, 3, new T.Vector3()), f = new T.Vector3(0, 0, 1).applyQuaternion(ACH.group.quaternion); satchel.position.copy(ch).addScaledVector(f, -.17).add(new T.Vector3(0, -.32, 0)); satchel.quaternion.copy(ACH.group.quaternion); } }

    /* physics */
    { const n = Math.max(1, Math.ceil(dt * 60)); for (let k = 0; k < n; k++) { world.step(); fstep++; } }
    for (const s of shards) { const p = s.b.translation(), r = s.b.rotation(); s.m.position.set(p.x, p.y, p.z); s.m.quaternion.set(r.x, r.y, r.z, r.w); }
    duelStep(dt); gameStep(dt, t); missionStep(); netSend(dt); paintStep(t);
    if (window.MesaScore) { /* the score follows the fight: how many are up, the combo, whether he is down, whether he is under the dune */ const up = DUEL.on ? outlaws.filter(o => o.state !== "away" && o.state !== "fall").length : 0, kn = KNIGHT.state === "hunt" || KNIGHT.state === "strike" ? 1 : 0;
      SCH = lerp(SCH, clamp(up * .28 + kn * .7 + (st.mode === "bike" ? .45 : 0) + GAME.combo * .03, 0, 1), 1 - Math.exp(-dt * 1.2)); window.MesaScore.set({ heat: SCH, combo: GAME.combo, down: st.mode === "down", pit: inPit() }); }
    if (trig && st.gun) { fire(aimDir()); if (LOCK.p) { /* the view leans toward what the gun has found */ const want = Math.atan2(LOCK.p.x - st.x, LOCK.p.z - st.z); CAM.yaw += wrapA(want - CAM.yaw) * (1 - Math.exp(-dt * (PAD.touch ? 5 : 2))); } } else { st.ink = Math.min(100, st.ink + dt * 6); if (st.gun && st.mode === "foot") aimDir(); else LOCK.p = null; }
    if (INK) { INK.step(dt, t); INK.setSun(SKY.uSun.value, scene.fog.color, scene.fog.density); if (INK.turf() >= 250) complete("turf", "250 square metres of the desert are yours, and all of it has turned to glass."); }
    if (motion) try { motion.update(dt); } catch (e) { }
    swarmStep(dt, t);
    if (st.gun && (st.mode === "foot" || st.mode === "pillion") && !(GAME.cheer > 0 && st.speed < .3 && !trig)) aimArm(me, aimDir().add(_lk.set(0, st.recoil * .3, 0)).normalize());   /* the arm kicks up with each shot */
    if (st.mode === "bike") { const d = _lk.set(0, -.42, .9).applyQuaternion(TK.group.quaternion).normalize().clone(); aimArm(me, d); aimArm(me, d, true); }   /* both hands on the bars */
    if (anta) { if (AN.aimT > 0) aimArm(anta, AN.dir); else if (BK.rode && st.mode === "bike") { const d = _lk.set(0, -.2, .95).applyQuaternion(TK.group.quaternion).normalize().clone(); aimArm(anta, d); aimArm(anta, d, true); } }
    for (const o of outlaws) if (o.state === "telegraph" || o.state === "fire") { const d = new T.Vector3(st.x - o.x, 1.2 + (o.state === "fire" ? .1 : -.25), st.z - o.z).normalize(); aimArm(o.ch, d); }

    /* his pieces follow his head and chest */
    { const head = boneW(MCH, 7, new T.Vector3()), chest = boneW(MCH, 3, new T.Vector3()), f = new T.Vector3(0, 0, 1).applyQuaternion(MCH.group.quaternion), up = new T.Vector3(0, 1, 0).applyQuaternion(MCH.group.quaternion);
      glasses.position.copy(head).addScaledVector(f, .105).addScaledVector(up, .045); glasses.quaternion.copy(MCH.group.quaternion); glasses.rotateY(Math.PI);
      brim.position.copy(head).addScaledVector(up, BRIM_UP).addScaledVector(f, .01); brim.quaternion.copy(MCH.group.quaternion); longBeard.position.copy(head).addScaledVector(f, .075).addScaledVector(up, BEARD_UP); longBeard.quaternion.copy(MCH.group.quaternion); longBeard.rotateX(-.12);
      badge.position.copy(chest).addScaledVector(f, .135).add(new T.Vector3(-Math.cos(MCH.group.rotation.y) * .08, .05, Math.sin(MCH.group.rotation.y) * .08)); badge.quaternion.copy(MCH.group.quaternion); badge.visible = !st.poncho;
      poncho.visible = st.poncho; poncho.position.copy(chest).addScaledVector(up, -.18); poncho.quaternion.copy(MCH.group.quaternion);
      if (st.smokeT > 0) { st.smokeT -= dt; if (Math.random() < dt * 30) puff(head.clone().addScaledVector(f, .16).addScaledVector(up, -.06), Math.random() < .5 ? 0xf2c84a : 0xffe08a, f.clone().multiplyScalar(.5).add(new T.Vector3(0, .35, 0)), 2.4, .12, 2.8, true); } }

    /* the iris breathes; it opens wide when he stands in it with the gun up (the sightline) */
    { const inIris = near(st, Z.clockwork_iris, 9) && st.gun && Math.cos(CAM.yaw) < -.8; IRIS.open = lerp(IRIS.open, inIris || MODE === "cinema" && DIR.i === 0 ? 1 : .35 + .15 * Math.sin(t * .4), 1 - Math.exp(-dt * 2)); W.iris.rotation.z += dt * .05;
      for (const b of W.iris.userData.blades) b.piv.rotation.z = b.a + Math.PI / 2 + lerp(.0, 1.25, IRIS.open);
      if (inIris && Math.cos(st.heading) < -.8) complete("iris", "Through the brass and the glass, the mesas sit in the aperture like a target."); }
    /* zones */
    if (st.z < Z.title_gate.z - 2) complete("gate"); if (st.y < W.cathedralY + 1 && near(st, Z.cathedral_trench, 50)) complete("cathedral", "Under the dune, the floor is glass, and the light comes down in columns.");
    if (near(st, Z.oasis_pond, 46)) complete("oasis", "A pond as still as a mirror, the mesa wall standing in it upside down.");
    /* effects */
    for (const q of puffs) { if (q.t >= q.life) { q.s.visible = false; continue; } q.t += dt; const k = q.t / q.life; q.s.position.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - dt * 1.5); q.s.scale.setScalar(q.size * (1 + k * q.grow)); q.s.material.opacity = .85 * (1 - k); }
    for (let i = tracers.length - 1; i >= 0; i--) { const tr = tracers[i]; tr.t += dt; tr.m.material.opacity = .95 * (1 - tr.t / .5); if (tr.t > .5) { scene.remove(tr.m); tr.m.geometry.dispose(); tracers.splice(i, 1); } }
    flash.intensity = Math.max(0, flash.intensity - dt * 300);
    STORM = lerp(STORM, STORMON ? 1 : 0, 1 - Math.exp(-dt * .8)); SKY.uStorm.value = STORM; scene.fog.density = .0024 + STORM * .028; SKY.uTime.value = t;
    for (const r of ribbons) { r.ph += dt * r.sp; const a = r.ph, x = st.x + Math.cos(a) * r.r, z = st.z + Math.sin(a) * r.r * .6; r.m.position.set(x, st.y + 1 + r.y + Math.sin(a * 2) * 1.5, z); r.m.rotation.set(Math.sin(a) * .3, -a, Math.sin(a * 3) * .2); r.m.material.opacity = STORM * .32; r.m.visible = STORM > .02; }
    specs.mat.opacity = STORM * .9; for (const s of specs) { s.ph += dt * .4; s.g.position.set(st.x + Math.cos(s.ph) * s.r, st.y + 2.2 + Math.sin(s.ph * 1.7), st.z + Math.sin(s.ph) * s.r); s.g.rotation.set(s.ph, s.ph * .7, 0); s.g.visible = STORM > .05; }
    { const p = dust.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i) + dt * (1.2 + STORM * 14), y = p.getY(i) + Math.sin(t + i) * dt * .2; if (x > 30) x -= 60; p.setXYZ(i, x, y, p.getZ(i)); } p.needsUpdate = true; dust.position.set(st.x, st.y, st.z); dust.material.opacity = .4 + STORM * .5; }
    for (const c of W.caustics) c.material.opacity = (.22 + .12 * Math.sin(t * 1.3 + c.position.x)) * (1 - STORM * .7);
    for (const o of GODS) o.material.opacity = .07 + .04 * Math.sin(t * .7 + o.position.z);
    /* the sun and the time of day: a slow cycle, or a mood from 1–6 */
    { MOODK = Math.min(1, MOODK + dt * .4); const m = MOODS[MOOD], el = m.el + Math.sin(t * .02) * .03, az = m.az, dir = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
      SKY.uSun.value.lerp(dir, .05); SKY.uA.value.lerp(new T.Color(m.a), .03); SKY.uB.value.lerp(new T.Color(m.b), .03); SKY.uC.value.lerp(new T.Color(m.c), .03); sunCol.lerp(new T.Color(m.sun), .03); sun.color.copy(sunCol); sun.intensity = 1 + 2.2 * smooth(0, .3, el);
      sun.position.copy(SKY.uSun.value).multiplyScalar(300).add(new T.Vector3(st.x, st.y, st.z)); sun.target.position.set(st.x, st.y, st.z); scene.fog.color.copy(SKY.uC.value).lerp(new T.Color(.93, .72, .42), STORM); }

    /* the camera */
    { const tall = camera.aspect < 1; let dist = tall ? 6.4 : WIDE ? 6.2 : 4.8, up = 2.3, side = 0, h = st.mode === "foot" || st.mode === "down" || st.mode === "pillion" ? CAM.yaw : st.heading, lookUp = (tall && st.gun ? 1.0 : 1.5) + CAM.pitch * 7, fov = tall ? 62 : 52;
      if (st.gun && st.mode === "foot") { const a = smooth(.1, .9, st.steady);   /* from the hip, to the shoulder, to the eye: the camera comes in as the aim settles */
        dist = lerp(tall ? 5.6 : 4.2, tall ? 3.7 : 2.5, a); up = lerp(tall ? 2.4 : 2.0, tall ? 2.0 : 1.75, a); side = lerp(.6, tall ? 1.0 : .95, a); fov = lerp(tall ? 64 : 54, tall ? 46 : 36, a) - (GAME.kick || 0) * 5; if (near(st, Z.clockwork_iris, 9) && Math.cos(CAM.yaw) < -.8) fov = 22; } up -= CAM.pitch * 2.5;
      if (st.mode === "ride") { dist = 8; up = 3.2; } if (st.mode === "bike") { dist = 6.4 + Math.abs(BK.speed) * .08; up = 2.2; lookUp = 1.3; fov = 52 + Math.abs(BK.speed) * .6; } if (st.mode === "sit") { dist = 5; up = 1.6; h = st.heading + 1.2; } if (st.mode === "down") { dist = 6; up = 3.5; }
      let want = new T.Vector3(st.x - Math.sin(h) * dist + Math.cos(h) * side, st.y + up, st.z - Math.cos(h) * dist - Math.sin(h) * side), look = new T.Vector3(st.x + Math.sin(h) * (st.gun ? 6 : 1.5), st.y + lookUp, st.z + Math.cos(h) * (st.gun ? 6 : 1.5));
      want.y = Math.max(want.y, heightAt(want.x, want.z) + .8);
      camPos.lerp(want, 1 - Math.exp(-dt * (st.gun || PAD.look ? 12 : 5))); camLook.lerp(look, 1 - Math.exp(-dt * 6));
      { const head = new T.Vector3(st.x, st.y + 1.6, st.z), to = camPos.clone().sub(head), L = to.length(); if (L > .5) { to.divideScalar(L); const hit = world.castRay(new R.Ray(v3(head.x, head.y, head.z), v3(to.x, to.y, to.z)), L, true, undefined, undefined, meCol, undefined, c => { const o = OWNER.get(c.handle); return !!o && (o.kind === "static" || o.kind === "ground"); }); if (hit) camPos.copy(head).addScaledVector(to, Math.max(.6, (hit.timeOfImpact ?? hit.toi) - .35)); } }
      if (MODE === "cinema") { const now = performance.now(); DIR.t += Math.min(1, (now - (DIR.last || now)) / 1000) / 7; DIR.last = now; if (DIR.t >= 1) { DIR.t = 0; DIR.i = (DIR.i + 1) % SHOTS.length; } const sh = SHOTS[DIR.i], [p, a] = sh.f(smooth(0, 1, DIR.t)); camPos.set(...p); camLook.set(...a); fov = 40; $("shot").textContent = sh.name; }
      if (window.__mesaCam) { camPos.copy(window.__mesaCam.pos); camLook.copy(window.__mesaCam.at); }
      camera.position.copy(camPos); if (GAME.shake > 0) camera.position.add(_lk.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(GAME.shake * .22)); camera.lookAt(camLook); camera.fov = lerp(camera.fov, fov, 1 - Math.exp(-dt * 6)); camera.updateProjectionMatrix(); }
    S.listener(camera);
    const o = offer(); if ((o && o.label) !== (offerNow && offerNow.label)) { $("do").textContent = o ? o.label : ""; $("do").hidden = !o; } offerNow = o;
    $("where").textContent = W.zoneAt(st.x, st.z) + (MODE === "game" && DUEL.on ? ` · wave ${DUEL.wave} · ${DUEL.left} left` : "");
    document.body.classList.toggle("wide", WIDE); $("gridb").setAttribute("aria-pressed", GRIDON);

    /* the mirrors: the nearest one renders the world flipped across its surface */
    const mi = W.mirrors.map(m => ({ m, d: Math.hypot(camera.position.x - m.x, camera.position.z - m.z) })).sort((a, b) => a.d - b.d)[0];
    for (const m of W.mirrors) { m.mesh.material.uniforms.uRes.value.set(renderer.domElement.width, renderer.domElement.height); m.mesh.material.uniforms.uOn.value = 0; }
    if (mi && mi.d < mi.m.r && camera.position.y > mi.m.y) { const y = mi.m.y, vc = MIR.vcam; vc.copy(camera); vc.position.y = 2 * y - camera.position.y; const f = new T.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); f.y = -f.y; const u = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion); u.y = -u.y; vc.up.copy(u); vc.lookAt(vc.position.clone().add(f)); vc.updateMatrixWorld();
      MIR.clip.constant = -y; renderer.clippingPlanes = [MIR.clip]; for (const m of W.mirrors) m.mesh.visible = false; renderer.setRenderTarget(MIR.rt); renderer.render(scene, vc); renderer.setRenderTarget(null); renderer.clippingPlanes = []; for (const m of W.mirrors) m.mesh.visible = true; mi.m.mesh.material.uniforms.uTime.value = t; mi.m.mesh.material.uniforms.uOn.value = 1; }
    if (LENS && LENS.name === "tekle" && GLASS) {   /* the game at full speed, the glass cut over it: the figures carry their own cells */
      renderer.render(scene, camera); const nodes = [], V = (x, y, z) => new T.Vector3(x, y, z);
      for (const h of [.15, .5, .85, 1.15, 1.45, 1.72]) nodes.push({ p: V(st.x, st.y + h, st.z), r: .24, heavy: true });
      const K = KNIGHT; if (K.state === "hunt" || K.state === "strike" || K.state === "forming") { const ky = Math.abs(st.y - W.cathedralY) < 3 ? W.cathedralY : heightAt(K.x, K.z); for (const h of [.2, .6, 1.0, 1.4, 1.8, 2.15]) nodes.push({ p: V(K.x, ky + h, K.z), r: .34, heavy: true }); }
      for (const o of outlaws) if (o.ch && o.ch.group.visible) { const q = o.ch.group.position; nodes.push({ p: V(q.x, q.y + 1.0, q.z), r: .4, heavy: true }); nodes.push({ p: V(q.x, q.y + 1.65, q.z), r: .22, heavy: true }); }
      GLASS.draw(nodes);
    } else if (LENS && LENS.on()) { if (GLASS) GLASS.hide();   /* the lens focuses on what matters: the knight when it is out of the glass and near, else Uncle Mesa */
      const K = KNIGHT, kOut = K.state === "hunt" || K.state === "strike" || K.state === "forming", kd = Math.hypot(camera.position.x - K.x, camera.position.z - K.z);
      const md = camera.position.distanceTo(new T.Vector3(st.x, st.y + 1.2, st.z)); LENS.render(scene, camera, dt, { focus: kOut && kd < 40 ? Math.min(kd, md * 1.6) : md });
    } else { if (GLASS) GLASS.hide(); renderer.render(scene, camera); }
    overlay(dt); requestAnimationFrame(frame);
  }

  /* ---------- the glass-block grid over the lens (G), the barrel-scope mask (Wide), the reticle ---------- */
  function overlay(dt) { const w = fx.width, h = fx.height, k = devicePixelRatio; FX.clearRect(0, 0, w, h);
    gridT = lerp(gridT, GRIDON ? 1 : 0, 1 - Math.exp(-dt * 3)); GX.clearRect(0, 0, w, h);
    if (gridT > .02) { /* one read of the frame into a small canvas, then every block refracts its own piece of it */
      const sw = Math.round(w / 2), sh = Math.round(h / 2); if (GRAB.width !== sw) { GRAB.width = sw; GRAB.height = sh; } GRAB.getContext("2d").drawImage(renderer.domElement, 0, 0, sw, sh); const src = GRAB, tile = Math.round(Math.min(w, h) / 6.5), cols = Math.ceil(w / tile), rows = Math.ceil(h / tile); GX.globalAlpha = gridT;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const x = i * tile, y = j * tile, m = .12, ox = ((i * 37 + j * 17) % 7 - 3) * k, oy = ((i * 11 + j * 29) % 5 - 2) * k;
        GX.drawImage(src, (x + tile * m / 2) * sw / w + ox, (y + tile * m / 2) * sh / h + oy, tile * (1 - m) * sw / w, tile * (1 - m) * sh / h, x, y, tile, tile);
        const g = GX.createLinearGradient(x, y, x + tile, y + tile); g.addColorStop(0, "rgba(255,255,255,.22)"); g.addColorStop(.5, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,.18)"); GX.fillStyle = g; GX.fillRect(x, y, tile, tile);
        GX.strokeStyle = "rgba(230,240,236,.55)"; GX.lineWidth = 2.5 * k; GX.strokeRect(x + 1, y + 1, tile - 2, tile - 2); }
      GX.globalAlpha = 1; }
    if (st.gun || st.swim) { /* the ink tank: a glass vial by the reticle, the colour of the next shot */ const vx = w - 34 * k, vy = h * .5, vh = 120 * k, vw = 12 * k, f = st.ink / 100, col = "#" + new T.Color(PAINT[paintN % PAINT.length]).getHexString();
      FX.fillStyle = "rgba(20,14,10,.45)"; FX.fillRect(vx - vw / 2, vy - vh / 2, vw, vh); FX.fillStyle = col; FX.fillRect(vx - vw / 2, vy + vh / 2 - vh * f, vw, vh * f); FX.strokeStyle = "rgba(255,255,255,.6)"; FX.lineWidth = 1.5 * k; FX.strokeRect(vx - vw / 2, vy - vh / 2, vw, vh);
      FX.fillStyle = "rgba(251,242,226,.75)"; FX.font = `${10 * k}px ui-monospace, monospace`; FX.textAlign = "right"; FX.fillText(st.swim ? "SWIM · REFILL" : `INK ${Math.round(st.ink)}`, vx - vw, vy + vh / 2); FX.fillText(`TURF ${INK ? INK.turf() : 0} m²`, vx - vw, vy + vh / 2 + 14 * k); }
    if (WAYAT.y > -9000 && MODE !== "cinema") { /* where to go: a gold mark on the place, or an arrow at the edge of the glass pointing to it */ const sp = _lk.copy(WAYAT).project(camera), back = sp.z > 1, dist = Math.round(Math.hypot(WAYAT.x - st.x, WAYAT.z - st.z)); let sx = (back ? -sp.x : sp.x), sy = (back ? -sp.y : sp.y); const off = back || Math.abs(sx) > .9 || Math.abs(sy) > .84;
      if (off) { const m = Math.max(Math.abs(sx) / .9, Math.abs(sy) / .84, 1e-3); sx /= m; sy /= m; if (back && Math.abs(sx) < .5) sx = Math.sign(sx || 1) * .9; } const px = (sx + 1) / 2 * w, py = (1 - sy) / 2 * h; if (dist > 6) { FX.save(); FX.translate(px, py); FX.rotate(off ? Math.atan2(-sy, sx) + Math.PI / 2 : Math.PI); FX.beginPath(); FX.moveTo(0, -11 * k); FX.lineTo(8 * k, 7 * k); FX.lineTo(-8 * k, 7 * k); FX.closePath(); FX.fillStyle = "rgba(242,208,74,.95)"; FX.fill(); FX.strokeStyle = "rgba(20,14,10,.8)"; FX.lineWidth = 1.5 * k; FX.stroke(); FX.restore();
        FX.font = `600 ${11 * k}px ui-monospace, monospace`; FX.textAlign = "center"; FX.fillStyle = "rgba(251,242,226,.95)"; FX.fillText(dist + " m", clamp(px, 30 * k, w - 30 * k), clamp(py + 24 * k, 20 * k, h - 10 * k)); } }
    if (DUEL.on && MODE !== "cinema") { /* three hits, the score, the combo and how long it has left */ const x0 = w / 2, y0 = (PAD.touch ? (h > w ? 152 : 22) : 26) * k; FX.textAlign = "center";
      for (let i = 0; i < 3; i++) { const x = x0 + (i - 1) * 20 * k; FX.beginPath(); FX.moveTo(x, y0 - 7 * k); FX.lineTo(x + 7 * k, y0); FX.lineTo(x, y0 + 7 * k); FX.lineTo(x - 7 * k, y0); FX.closePath(); FX.fillStyle = i < GAME.hp ? "rgba(255,58,168,.95)" : "rgba(20,14,10,.4)"; FX.fill(); FX.strokeStyle = "rgba(255,255,255,.7)"; FX.lineWidth = k; FX.stroke(); }
      FX.fillStyle = "rgba(251,242,226,.95)"; FX.font = `700 ${20 * k}px Georgia, serif`; FX.fillText(String(GAME.score), x0, y0 + 34 * k);
      if (GAME.combo > 1) { const s2 = 1 + GAME.mark * 2.5; FX.font = `italic 700 ${26 * k * s2}px Georgia, serif`; FX.fillStyle = "rgba(242,208,74,.98)"; FX.fillText("×" + Math.min(GAME.combo, 10), x0, y0 + 66 * k); FX.fillStyle = "rgba(242,208,74,.8)"; FX.fillRect(x0 - 30 * k, y0 + 74 * k, 60 * k * Math.max(0, GAME.comboT / 3.4), 3 * k); } }
    if (!st.gun || (st.mode !== "foot" && st.mode !== "pillion")) return; let cx = (mouse.on ? (mouse.x + 1) / 2 : .5) * w, cy = (mouse.on ? (1 - mouse.y) / 2 : .45) * h; const r = lerp(34, 9, st.steady) * k * (1 + st.recoil * .6);
    if (LOCK.p) { const sp = _lk.copy(LOCK.p).project(camera); cx = (sp.x + 1) / 2 * w; cy = (1 - sp.y) / 2 * h; FX.beginPath(); FX.arc(cx, cy, r + 7 * k, 0, Math.PI * 2); FX.strokeStyle = st.steady >= .85 ? "rgba(255,244,200,1)" : "rgba(255,58,168,.95)"; FX.lineWidth = (st.steady >= .85 ? 4 : 2.5) * k; FX.stroke(); }
    if (GAME.mark > 0) { const m = (10 + GAME.mark * 60) * k; FX.strokeStyle = "rgba(255,255,255,.95)"; FX.lineWidth = 3 * k; FX.beginPath(); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { FX.moveTo(cx + a * m * .5, cy + b * m * .5); FX.lineTo(cx + a * m, cy + b * m); } FX.stroke(); }
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + performance.now() / 2600, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, s = 3.2 * k; FX.beginPath(); FX.ellipse(x, y, s, s * 1.25, a, 0, Math.PI * 2); FX.fillStyle = "rgba(161,232,228,.6)"; FX.fill(); FX.strokeStyle = "rgba(255,255,255,.6)"; FX.lineWidth = k; FX.stroke(); }
    if (st.steady > .85) { FX.beginPath(); FX.arc(cx, cy, 2.5 * k, 0, Math.PI * 2); FX.fillStyle = "rgba(248,205,145,.95)"; FX.fill(); } }

  resize(); $("boot").classList.add("done"); $("title").classList.add("on"); setTimeout(() => { $("title").classList.remove("on"); GRIDON = false; }, 3600);
  setMode("game"); say("This land ain't dust anymore. It's data. And it remembers.", 5);
  window.__mesa = { NET, PN, GUEST, AN, MIS, GATE, get MI() { return MI; }, set MI(v) { MI = v; misLi.textContent = MIS[v].t; }, T, scene, camera, LENS, say, lensUI, GAME, CHIPS, dash, PAD, CAM, LOCK, tune(b, d) { BRIM_UP = b; BEARD_UP = d; }, KNIGHT, KN, PR, PROC, HERD, SPORE, HALL, BK, TK, anta, paintBody, get me() { return me; }, get ink() { return INK; }, st, done, W, outlaws, DUEL, mount, offer, fire, aimDir, setMode, mood, toggleStorm, complete, keys, get motion() { return !!motion; }, frames: () => fstep, get grid() { return GRIDON; }, set grid(v) { GRIDON = v; } };
  requestAnimationFrame(frame);
})().catch(e => { console.error(e); const b = document.getElementById("boot-s"); if (b) b.textContent = "Something went wrong: " + e.message; });
