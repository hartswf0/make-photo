/* MESA CHIP swarms: crowds made of glass.

   A figure here is not a character. One hidden cast character (a "rig") plays the real motion-capture clips, and its bones are
   read every frame into a short history. A figure is a few hundred flat shards of leaded glass, each pinned to one bone of that
   rig, drawn as instances of a single triangle. So ten walkers cost one hidden skeleton and one draw call, and each walker reads
   the history a little further back, so no two are in step.

     the procession   ten robed figures led by a torchbearer. They pour out of the centre window as loose shards, take their
                      bodies on the sand east of the ziggurat, walk round its front through the light, and go back into the glass.
     the knight       stands in the north window of the sunken cathedral. Come near on the cathedral floor and his panes leave the
                      lead, form him, and he comes for Uncle Mesa with a sword of red glass. Paint knocks panes off him; nine hits
                      and he is on the floor in pieces. Later the pieces go home to the window.
     the zebu         a herd on the salt, after the skull on the bike. No cast skeleton fits a cow, so their bones are worked out
                      here: a body, a head, four legs of two parts, walking and galloping. They flock, and they run from the bike.
     the spores       small lit creatures over the oasis, each a body and three trailing beads. They come to Uncle Mesa and ring
                      him; paint landing near them scatters them and stains them.
     the tail light   a red streak behind the bike at speed, as long as the last seventeen metres of road.

   MesaSwarm.create({ T, scene, world, R, OWNER, heightAt, W, TRI, motion, makeRig, S, puff, say, complete, fall, st, BK, TK }) ->
     { step(dt, t, sun, fog), onPaint(q, col), knight, herd, spores, procession } */
(() => {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const USED = [1, 2, 3, 4, 5, 7, 10, 12, 14, 16, 18, 20, 51, 53, 54, 55, 56, 58, 59, 60], SLOT = {}; USED.forEach((b, i) => { SLOT[b] = i; });
  const SKINS = [0x472a19, 0x5a3520, 0x3a2216, 0x6c4226];

  function create(c) {
    const { T, scene, world, R, OWNER, heightAt, W, TRI, motion, makeRig, S, puff, say, complete, fall, st, BK, TK } = c, v3 = (x, y, z) => ({ x, y, z });
    const SUN = { value: new T.Vector3(0, 1, 0) }, FOG = { value: new T.Color() }, FOGD = { value: .0016 };
    const _m = new T.Matrix4(), _m2 = new T.Matrix4(), _p = new T.Vector3(), _p2 = new T.Vector3(), _q = new T.Quaternion(), _s = new T.Vector3(), _e = new T.Euler(), ZAX = new T.Vector3(0, 0, 1), YAX = new T.Vector3(0, 1, 0);

    /* ---------- one pane of leaded glass, drawn many times ---------- */
    function shards(n, glow = 1.1) { const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute([-.5, -.42, 0, .55, -.3, 0, -.05, .6, 0], 3)); g.setAttribute("normal", new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); g.setAttribute("aB", new T.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
      const mat = new T.ShaderMaterial({ side: T.DoubleSide, uniforms: { uSun: SUN, uFog: FOG, uFogD: FOGD, uGlow: { value: glow } },
        vertexShader: `attribute vec3 aB; varying vec3 vB; varying vec3 vC; varying vec3 vN; varying vec3 vW;
          void main(){ vB = aB; vC = vec3(1.);
          #ifdef USE_INSTANCING_COLOR
            vC = instanceColor;
          #endif
            vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.); vW = w.xyz; vN = mat3(modelMatrix) * mat3(instanceMatrix) * normal; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform vec3 uSun; uniform vec3 uFog; uniform float uFogD; uniform float uGlow; varying vec3 vB; varying vec3 vC; varying vec3 vN; varying vec3 vW;
          void main(){ float e = min(min(vB.x, vB.y), vB.z); vec3 n = normalize(vN), v = cameraPosition - vW; float dist = length(v); v /= dist; if (dot(n, v) < 0.) n = -n;
            float through = .58 + .42 * abs(dot(n, uSun)), sp = pow(max(dot(reflect(-uSun, n), v), 0.), 26.);
            vec3 col = vC * through * uGlow + vec3(1., .95, .82) * sp * .8; col = mix(vec3(.05, .04, .03), col, smoothstep(.03, .075, e));
            col = mix(col, uFog, 1. - exp(-uFogD * uFogD * dist * dist)); gl_FragColor = vec4(col, 1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }` });
      const mesh = new T.InstancedMesh(g, mat, n), z = new T.Matrix4().makeScale(0, 0, 0), col = new T.Color(1, 1, 1); for (let i = 0; i < n; i++) { mesh.setMatrixAt(i, z); mesh.setColorAt(i, col); } mesh.frustumCulled = false; mesh.castShadow = true; scene.add(mesh); return mesh; }
    const hide = (mesh, i) => { const a = mesh.instanceMatrix.array, o = i * 16; for (let k = 0; k < 16; k++) a[o + k] = 0; };

    /* ---------- the rig: a hidden cast character playing a clip, and a memory of where its bones were ---------- */
    function Rig(id, clip) { if (!motion || !makeRig) return null; const ch = makeRig(id); if (!ch || !ch.bones) return null; ch.group.visible = false; ch.group.position.set(0, -400, 0); ch.group.rotation.set(0, 0, 0);
      try { motion.registerActor(id, ch, { defaultClip: clip, blend: 1 }); } catch (e) { return null; }
      const K = 128, NB = USED.length, hist = new Float32Array(K * NB * 16), inv = new T.Matrix4(), m = new T.Matrix4(); let head = -1, n = 0;
      return { id, ch, get n() { return n; },
        sample() { ch.group.updateMatrixWorld(true); inv.copy(ch.group.matrixWorld).invert(); head = (head + 1) % K; n = Math.min(K, n + 1); for (let s = 0; s < NB; s++) { const b = ch.bones[USED[s]]; if (b) m.multiplyMatrices(inv, b.matrixWorld).toArray(hist, (head * NB + s) * 16); } },
        rel(slot, delay, out) { const f = ((head - Math.min(delay, n - 1)) % K + K) % K; return out.fromArray(hist, (f * NB + slot) * 16); },
        clip(name, o) { try { motion.setClip(id, name, o || { fade: .25 }); } catch (e) { } } }; }
    const BM = USED.map(() => new T.Matrix4());
    const bones = (rig, delay, F) => { for (let s = 0; s < USED.length; s++) BM[s].multiplyMatrices(F, rig.rel(s, delay, _m)); };

    /* ---------- cutting a body into shards, each pinned to the bone under it ---------- */
    function humanoid(rig, style) { const out = [], rnd = rng(style.seed || 1), P = b => new T.Vector3().setFromMatrixPosition(rig.rel(SLOT[b], 0, _m)), size = style.size || 1;
      const add = (bone, p, n, sx, sy, col, tag, roll) => { const q = new T.Quaternion().setFromUnitVectors(ZAX, n.clone().normalize()); q.multiply(new T.Quaternion().setFromAxisAngle(ZAX, roll ?? rnd() * 6.283));
        const Mw = new T.Matrix4().compose(p, q, new T.Vector3(sx, sy, 1)), L = rig.rel(SLOT[bone], 0, new T.Matrix4()).invert().multiply(Mw); const sh = { slot: SLOT[bone], L, col: new T.Color(col), rest: p.clone(), tag, u: rnd(), v: rnd(), d: rnd() }; out.push(sh); return sh; };
      const seg = (a, b, r, n, col, wx = 1, wz = 1, tag = "body") => { const A = P(a), B = P(b), ax = B.clone().sub(A), len = ax.length(); ax.normalize(); const u = new T.Vector3(1, 0, 0).addScaledVector(ax, -ax.x); if (u.lengthSq() < .01) u.set(0, 0, 1).addScaledVector(ax, -ax.z); u.normalize(); const v = new T.Vector3().crossVectors(ax, u);
        for (let k = 0; k < n; k++) { const t = (k + rnd()) / n, th = rnd() * 6.283, nr = u.clone().multiplyScalar(Math.cos(th)).addScaledVector(v, Math.sin(th)), p = A.clone().addScaledVector(ax, t * len).addScaledVector(u, Math.cos(th) * r * wx).addScaledVector(v, Math.sin(th) * r * wz), s = (r * 1.25 + .05) * size * (.8 + rnd() * .5); add(a, p, nr, s, s * (1 + rnd() * .5), col(t, th, k), tag); } };
      const blob = (bone, ctr, rx, ry, rz, n, col, tag = "head") => { for (let k = 0; k < n; k++) { const y = 1 - 2 * (k + .5) / n, rr = Math.sqrt(1 - y * y), th = k * 2.39996 + rnd() * .4, nr = new T.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr), p = ctr.clone().add(new T.Vector3(nr.x * rx, nr.y * ry, nr.z * rz)), s = (rx + rz) * .62 * size * (.85 + rnd() * .4); add(bone, p, nr, s, s * 1.15, col(nr), tag); } };
      const C = style.col, hips = P(1), head = P(7);
      seg(1, 2, .145, 9, C.torso, 1.2, .8); seg(2, 3, .15, 9, C.torso, 1.2, .8); seg(3, 4, .16, 11, C.torso, 1.25, .8); seg(4, 5, .13, 9, C.torso, 1.5, .8); seg(5, 7, .052, 4, C.skin);
      blob(7, head.clone().add(new T.Vector3(0, .1, .01)), .1, .125, .11, style.head || 18, C.head);
      if (style.torch) { /* the leader's right arm is not the clip's: it is held up, pinned to his chest, and carries the torch */
        const sh = P(16), top = sh.clone().add(new T.Vector3(.04, .62, .1)); for (let k = 0; k < 12; k++) { const t = (k + .5) / 12, th = rnd() * 6.283, p = sh.clone().lerp(top, t).add(new T.Vector3(Math.cos(th) * .045, 0, Math.sin(th) * .045)); add(4, p, new T.Vector3(Math.cos(th), 0, Math.sin(th)), .09, .13, t > .85 ? C.skin(0) : C.torso(t, th, k), "arm"); }
        for (let k = 0; k < 6; k++) { const th = k / 6 * 6.283; add(4, top.clone().add(new T.Vector3(Math.cos(th) * .06, .12, Math.sin(th) * .06)), new T.Vector3(Math.cos(th), -.4, Math.sin(th)), .11, .12, 0xf2c84a, "torch"); }
        for (let k = 0; k < 9; k++) { const th = rnd() * 6.283, h = .2 + rnd() * .26; add(4, top.clone().add(new T.Vector3(Math.cos(th) * .045, h, Math.sin(th) * .045)), new T.Vector3(Math.cos(th), .3, Math.sin(th)), .09, .2, [0xf2601e, 0xffd23a, 0xfffbe6][k % 3], "flame"); }
        out.torchL = top.clone().add(new T.Vector3(0, .32, 0)).applyMatrix4(rig.rel(SLOT[4], 0, new T.Matrix4()).invert()); }
      else { seg(16, 18, .048, 7, C.sleeve || C.torso); seg(18, 20, .04, 7, C.sleeve || C.torso); blob(20, P(20), .035, .05, .035, 3, () => C.skin(0), "hand"); }
      seg(10, 12, .048, 7, C.sleeve || C.torso); seg(12, 14, .04, 7, C.sleeve || C.torso); blob(14, P(14), .035, .05, .035, 3, () => C.skin(0), "hand");
      const legs = style.robe ? 4 : 10; for (const [a, b, d2, e] of [[51, 53, 54, 55], [56, 58, 59, 60]]) { seg(a, b, .075, legs, C.leg); seg(b, d2, .055, legs, C.leg); seg(d2, e, .045, 3, C.foot || C.leg); }
      if (style.robe) for (let k = 0; k < style.robe; k++) { const t = (k + rnd()) / style.robe, th = rnd() * 6.283, y = lerp(hips.y + .06, .1, t), r = lerp(.17, .34, t), p = new T.Vector3(hips.x + Math.cos(th) * r, y, hips.z + Math.sin(th) * r * .85), s = (.13 + t * .07) * size * (.8 + rnd() * .5); add(1, p, new T.Vector3(Math.cos(th), .25, Math.sin(th)), s, s * 1.6, C.robe(t, th, k), "robe"); }
      if (style.extra) style.extra({ add, seg, blob, P, rnd });
      return out; }

    /* ================= the procession ================= */
    const PR = { on: false, head: 0, near: 0 };
    { const rig = Rig("glass-walker", "walk"); if (rig && TRI) { const NF = 10, GAP = 2.7, V = 1.15, zz = W.zones.ziggurat_steps;
        const curve = new T.CatmullRomCurve3([[27, -14], [27.5, 0], [27, 13], [22, 19.5], [8, 21.5], [-8, 21.5], [-22, 19.5], [-27, 13], [-27.5, 0], [-27, -14]].map(([x, z]) => new T.Vector3(zz.x + x, 0, zz.z + z))), PTS = curve.getSpacedPoints(260), L = curve.getLength(), CYC = L + NF * GAP + 9;
        const at = (s, o) => { const f = clamp(s / L, 0, .9999) * 260, i = Math.floor(f), a = PTS[i], b = PTS[i + 1]; o.x = lerp(a.x, b.x, f - i); o.z = lerp(a.z, b.z, f - i); o.h = Math.atan2(b.x - a.x, b.z - a.z); return o; };
        const ROBES = [0xf6f1e3, 0xd8342c, 0x2a9a5a, 0x2a4ab8, 0xf2a83a, 0x6f8040, 0xe85aa8, 0xf2c81e, 0x2fd0d8, 0xc89a4a], ACC = [0xf2c81e, 0xf6efe0, 0xf2d04a, 0xf2c81e, 0x2a4ab8, 0xb88040, 0xf6efe0, 0xd8342c, 0x2a4ab8, 0x6c7c8c], WRAP = [0xefe6cc, 0x3a2c22, 0xf2c81e, 0xe85aa8, 0x8a5a34, 0x18110d, 0xf6efe0, 0x2a4ab8, 0x18110d, 0xb8a078];
        const light = new T.PointLight(0xffb040, 0, 22, 2); scene.add(light);
        let figs = null, mesh = null; const F = new T.Matrix4(), o = { x: 0, z: 0, h: 0 }, torchW = new T.Vector3();
        const build = () => { figs = []; let n = 0; for (let i = 0; i < NF; i++) { const skin = SKINS[i % SKINS.length], robe = ROBES[i], acc = ACC[i], wrap = WRAP[i], tone = (hex, k) => new T.Color(hex).multiplyScalar(.82 + (k * 7919 % 100) / 100 * .36).getHex();
              const tpl = humanoid(rig, { seed: 31 + i * 7, robe: 46, torch: i === 0, head: 18, col: { torso: (t, th, k) => k % 6 === 0 ? acc : tone(robe, k), sleeve: (t, th, k) => tone(robe, k + 3), robe: (t, th, k) => k % 9 === 0 ? acc : tone(robe, k), leg: () => tone(robe, 2), foot: () => 0x2a1a12, skin: () => skin, head: nr => nr.y > .35 ? wrap : nr.z > -.2 ? skin : wrap } });
              for (const sh of tpl) sh.win = TRI.windowPoint(new T.Vector3(), 1, .2 + sh.u * .6, .12 + sh.v * .6); figs.push({ tpl, base: n, delay: (i * 13) % 110, was: 0 }); n += tpl.length; }
          mesh = shards(n, 1.15); for (const f of figs) f.tpl.forEach((sh, k) => mesh.setColorAt(f.base + k, sh.col)); mesh.instanceColor.needsUpdate = true; PR.on = true; PR.count = n; };
        PR.step = (dt, t) => { rig.sample(); if (!figs) { if (rig.n < 8) return; build(); } PR.head = (PR.head + dt * V) % CYC; const arr = mesh.instanceMatrix.array; let lit = 0;
          figs.forEach((f, i) => { const s = PR.head - i * GAP; if (s <= 0 || s >= L) { if (f.was) { for (let k = 0; k < f.tpl.length; k++) hide(mesh, f.base + k); f.was = 0; } return; }
            at(s, o); const y = heightAt(o.x, o.z), a = smooth(0, 8, s) * (1 - smooth(L - 8, L, s)); F.compose(_p.set(o.x, y, o.z), _q.setFromAxisAngle(YAX, o.h), _s.set(1, 1, 1)); bones(rig, f.delay, F);
            if (a > .5 && f.was <= .5) S.cure(_p); f.was = a;
            for (let k = 0; k < f.tpl.length; k++) { const sh = f.tpl[k], off = (f.base + k) * 16; _m2.multiplyMatrices(BM[sh.slot], sh.L); if (sh.tag === "flame") { const fl = .8 + .45 * Math.sin(t * 13 + k * 2.1); _m2.scale(_s.set(1, fl, 1)); }
              if (a < 1) { /* loose: on a high arc between the window and the body, turning as it goes */ const aa = smooth(sh.d * .45, .55 + sh.d * .45, a), e = _m2.elements, px = e[12], py = e[13], pz = e[14], w = sh.win, k1 = (1 - aa) * (1 - aa), k2 = 2 * aa * (1 - aa), k3 = aa * aa, cx = (w.x + px) / 2 + (sh.u - .5) * 14, cy = Math.max(w.y, py) + 9 + sh.v * 6, cz = (w.z + pz) / 2 + 6;
                _m.makeRotationAxis(_p2.set(sh.u - .5, sh.v - .5, sh.d - .5).normalize(), (1 - aa) * 9); _m2.multiply(_m); const sc = smooth(0, .12, aa); _m2.scale(_s.set(sc, sc, sc)); e[12] = k1 * w.x + k2 * cx + k3 * px; e[13] = k1 * w.y + k2 * cy + k3 * py; e[14] = k1 * w.z + k2 * cz + k3 * pz; }
              _m2.toArray(arr, off); }
            if (i === 0) { torchW.copy(f.tpl.torchL).applyMatrix4(BM[SLOT[4]]); lit = a; light.position.copy(torchW);   /* the torch rides the chest */
              if (a > .9 && Math.random() < dt * 16) puff(torchW.clone().add(new T.Vector3((Math.random() - .5) * .08, 0, (Math.random() - .5) * .08)), Math.random() < .5 ? 0xffc040 : 0xff7a20, new T.Vector3(0, .9, 0), .7, .12, 1.6, true);
              const d = Math.hypot(st.x - o.x, st.z - o.z); if (a > .9 && d < 6) { PR.near += dt; if (PR.near > 5) complete("procession", "He falls in behind the torch. Ten people made of window, and none of them casts the same shadow twice."); } } });
          light.intensity = lit * (34 + 8 * Math.sin(t * 11)); mesh.instanceMatrix.needsUpdate = true; }; } }

    /* ================= the stained-glass knight ================= */
    const KN = { state: "none" };
    { const rig = Rig("glass-knight", "idle"), kit = window.MesaTriptych && window.MesaTriptych.kit; if (rig && kit) { const pit = W.PIT, fy = W.cathedralY, WW = 4, WH = 9, wz = pit.z - pit.hz + 1.1, wy = fy + 2.2, HP = 9;
        /* his window, painted twice: with him in it, and with the hole he leaves */
        const paint = full => { const Wd = 512, Hd = 1152, cv = document.createElement("canvas"); cv.width = Wd; cv.height = Hd; const q = cv.getContext("2d"), A = kit.sheet(Wd, Hd);
          A.q.fillStyle = A.lg(0, 0, 0, Hd, [[0, "#16307a"], [.5, "#1f4aa8"], [1, "#122660"]]); A.q.fillRect(0, 0, Wd, Hd);
          for (let j = 0; j < 12; j++) for (let i = 0; i < 6; i++) { const x = i * 96 + (j % 2) * 48 - 20, y = j * 100 + 40; A.piece([[x, y - 34], [x + 26, y], [x, y + 34], [x - 26, y]], (i + j) % 3 ? "#2f66c8" : "#f2c84a", { lead: 2.5 }); }
          A.piece([[0, 0], [44, 0], [44, Hd], [0, Hd]], "#b8222a", { lead: 5 }).piece([[Wd - 44, 0], [Wd, 0], [Wd, Hd], [Wd - 44, Hd]], "#b8222a", { lead: 5 }).piece([[44, Hd - 60], [Wd - 44, Hd - 60], [Wd - 44, Hd], [44, Hd]], "#8f1c22", { lead: 5 });
          A.cut({ fx: 256, fy: 260, ring: 44, wid: 30, seed: 5, vary: .2, lead: 1.4 }).onto(q);
          const B = kit.sheet(Wd, Hd), steel = ["#d2dde4", "#9fb2c0", "#62788c", "#f2c84a"], S2 = full ? steel : ["#e6f2f0", "#d8eae8", "#cfe2e2", "#e6f2f0"], red = full ? "#d8202c" : "#dcecea", pl = full ? "#d8342c" : "#e6f2f0", m = pts => pts.map(([x, y]) => [512 - x, y]);
          B.piece([[256, 160], [330, 84], [404, 128], [384, 236], [300, 214]], pl, { curve: true, lead: 6 });
          B.piece([[196, 190], [316, 190], [330, 330], [256, 372], [182, 330]], S2[0], { lead: 8 }).piece([[256, 190], [316, 190], [330, 330], [256, 372]], S2[1], { lead: 3 }).piece([[204, 262], [308, 262], [308, 280], [204, 280]], full ? "#141a22" : S2[2], { lead: 3 });
          B.piece([[206, 352], [306, 352], [324, 394], [188, 394]], S2[3], { lead: 6 });
          for (const f of [p => p, m]) { B.piece(f([[104, 404], [200, 386], [206, 474], [116, 494]]), S2[0], { lead: 7 }).piece(f([[112, 494], [178, 478], [192, 644], [140, 664]]), S2[2], { lead: 7 }); B.piece(f([[160, 824], [244, 824], [240, 1040], [168, 1040]]), S2[1], { lead: 7 }).piece(f([[148, 1040], [246, 1040], [246, 1080], [132, 1080]]), S2[2], { lead: 6 }); }
          B.piece([[196, 394], [316, 394], [342, 644], [256, 694], [170, 644]], S2[1], { lead: 8 }).piece([[256, 394], [316, 394], [342, 644], [256, 694]], S2[2], { lead: 3 });
          B.disc(256, 500, 36, full ? "#f2c84a" : S2[0], 5).piece([[206, 580], [232, 580], [240, 556], [274, 556], [282, 580], [306, 580], [306, 604], [206, 604]], full ? "#b8222a" : S2[0], { lead: 4 });
          B.piece([[170, 644], [256, 694], [342, 644], [366, 824], [146, 824]], S2[0], { lead: 8 }); for (const x of [200, 256, 312]) B.line([[x, 690], [x + (x - 256) * .2, 822]], 3, false);
          B.piece([[240, 730], [272, 730], [267, 1016], [256, 1060], [245, 1016]], red, { lead: 6 }).piece([[186, 714], [326, 714], [326, 738], [186, 738]], S2[3], { lead: 5 }).piece([[208, 660], [304, 660], [298, 716], [214, 716]], S2[3], { lead: 6 });
          B.cut({ fx: 256, fy: 500, ring: full ? 60 : 34, wid: full ? 44 : 26, seed: full ? 9 : 14, vary: full ? .14 : .1, lead: full ? 1.3 : 1.8 }).onto(q);
          /* a lancet: stone outside the arch */
          q.fillStyle = "#3a332c"; q.beginPath(); q.rect(0, 0, Wd, Hd); q.moveTo(0, Hd); q.lineTo(0, 300); q.quadraticCurveTo(10, 60, 256, 0); q.quadraticCurveTo(502, 60, 512, 300); q.lineTo(512, Hd); q.closePath(); q.fill("evenodd");
          kit.nib(q, () => { q.beginPath(); q.moveTo(0, Hd); q.lineTo(0, 300); q.quadraticCurveTo(10, 60, 256, 0); q.quadraticCurveTo(502, 60, 512, 300); q.lineTo(512, Hd); }, 12); kit.iron(q, Wd, Hd, 2, 6);
          const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 8; return tx; };
        const txFull = paint(true), txEmpty = paint(false), wm = new T.MeshStandardMaterial({ map: txFull, emissiveMap: txFull, emissive: 0xffffff, emissiveIntensity: .95, roughness: .2, side: T.DoubleSide });
        const win = new T.Mesh(new T.PlaneGeometry(WW, WH), wm); win.position.set(pit.x, wy + WH / 2, wz); scene.add(win);
        const stone = new T.Mesh(new T.BoxGeometry(WW + 1.4, WH + 3.4, .7), new T.MeshStandardMaterial({ color: 0x8a7a6a, roughness: .95 })); stone.position.set(pit.x, wy + WH / 2 - .9, wz - .42); stone.castShadow = true; scene.add(stone);
        const glow = new T.PointLight(0x6a9aff, 30, 26, 2); glow.position.set(pit.x, wy + 4, wz + 2.5); scene.add(glow);
        const setWin = full => { wm.map = wm.emissiveMap = full ? txFull : txEmpty; wm.needsUpdate = true; };
        const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -60, 0)), col = world.createCollider(R.ColliderDesc.capsule(.6, .38), body);
        let tpl = null, mesh = null, P = null; const F = new T.Matrix4();
        Object.assign(KN, { state: "window", x: pit.x, z: wz + 4, y: fy, h: 0, hp: HP, t: 0, cool: 0, struck: false, win, rig });
        const build = () => { const st0 = ["#d2dde4", "#9fb2c0", "#62788c"].map(h => new T.Color(h).getHex()), steel = k => st0[k % 3];
          tpl = humanoid(rig, { seed: 77, size: 1.35, head: 22, col: { torso: (t, th, k) => k % 7 === 0 ? 0xf2c84a : steel(k), sleeve: (t, th, k) => steel(k + 1), leg: (t, th, k) => steel(k + 2), foot: () => 0x62788c, skin: () => 0xf2c84a, head: nr => nr.z > .45 && Math.abs(nr.y) < .3 ? 0x141a22 : nr.y > .7 ? 0xf2c84a : 0xd2dde4 },
            extra: ({ add, P: BP, rnd }) => { const hd = BP(7), hp = BP(1), hand = BP(20), fore = BP(18), dir = hand.clone().sub(fore).normalize();
              for (let k = 0; k < 9; k++) { const t = k / 8; add(7, hd.clone().add(new T.Vector3((rnd() - .5) * .06, .26 + t * .2, -.02 - t * .2)), new T.Vector3(rnd() - .5, .3, rnd() - .5), .1, .2, 0xd8342c, "plume"); }   /* the red plume */
              for (let k = 0; k < 16; k++) { const th = k / 16 * 6.283, p = new T.Vector3(hp.x + Math.cos(th) * .25, hp.y - .16, hp.z + Math.sin(th) * .2); add(1, p, new T.Vector3(Math.cos(th), .2, Math.sin(th)), .14, .3, k % 4 === 0 ? 0xf2c84a : steel(k), "tasset", 0); }
              for (const s of [-1, 1]) { const sh = BP(s > 0 ? 10 : 16); for (let k = 0; k < 5; k++) { const th = k / 5 * 3.14; add(4, sh.clone().add(new T.Vector3(s * .04 + Math.cos(th) * .05 * s, .06, Math.sin(th - 1.57) * .09)), new T.Vector3(s * .6, .8, Math.sin(th - 1.57) * .5), .15, .15, k % 2 ? 0xd2dde4 : 0xf2c84a, "pauldron"); } }
              /* the sword of red glass, in the right hand: long panes laid along the blade, two faces */
              const side = new T.Vector3().crossVectors(dir, YAX).normalize(); if (side.lengthSq() < .1) side.set(1, 0, 0); const nrm = new T.Vector3().crossVectors(dir, side).normalize();
              for (let k = 0; k < 9; k++) { const t = .16 + k * .125, f = k % 2 ? -1 : 1, p = hand.clone().addScaledVector(dir, t), q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(side.clone().multiplyScalar(f), dir.clone().multiplyScalar(k === 8 ? 1 : f), nrm)); const sh = add(20, p, nrm, 1, 1, k % 2 ? 0xff3a44 : 0xd8202c, "sword"); sh.L = rig.rel(SLOT[20], 0, new T.Matrix4()).invert().multiply(new T.Matrix4().compose(p, q, new T.Vector3(.11 - k * .006, k === 8 ? .34 : .27, 1))); }
              for (const s of [-1, 1]) { add(20, hand.clone().addScaledVector(dir, .12).addScaledVector(side, s * .1), nrm, .12, .08, 0xf2c84a, "sword"); } } });
          mesh = shards(tpl.length, 1.2); P = tpl.map((sh, k) => { mesh.setColorAt(k, sh.col); const u = .5 + sh.rest.x * .9 / WW * 2.1, v = .07 + clamp(sh.rest.y / 1.95, 0, 1.1) * .78; sh.win = new T.Vector3(pit.x + (u - .5) * WW, wy + v * WH, wz + .08); return { loose: false, p: new T.Vector3(), v: new T.Vector3(), q: new T.Quaternion(), w: new T.Vector3(), from: new T.Vector3(), s: new T.Vector3(1, 1, 1) }; }); mesh.instanceColor.needsUpdate = true; KN.count = tpl.length; };
        const loosen = (k, d, kick, colr) => { const p = P[k]; if (p.loose) return; p.loose = true; _m.fromArray(mesh.instanceMatrix.array, k * 16).decompose(p.p, p.q, p.s); p.v.set(d.x * kick + (Math.random() - .5) * 3, 1.5 + Math.random() * 3, d.z * kick + (Math.random() - .5) * 3); p.w.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(14); if (colr !== undefined) { mesh.setColorAt(k, new T.Color(colr).lerp(tpl[k].col, .35)); mesh.instanceColor.needsUpdate = true; } };
        KN.hit = (q, n, d, colr) => { if (!tpl || (KN.state !== "hunt" && KN.state !== "strike" && KN.state !== "forming")) return true; KN.hp--; S.glass(q, .45); KN.stagger = .45; const order = tpl.map((sh, k) => [k, P[k].loose ? 1e9 : _p.setFromMatrixPosition(_m.fromArray(mesh.instanceMatrix.array, k * 16)).distanceToSquared(q)]).sort((a, b) => a[1] - b[1]);
          const take = KN.hp <= 0 ? tpl.length : Math.ceil(tpl.length / (HP + 2)); for (let i = 0; i < take && i < order.length; i++) if (order[i][1] < 1e9) loosen(order[i][0], d, KN.hp <= 0 ? 4 : 2.2, colr);
          for (let i = 0; i < 4; i++) puff(new T.Vector3(q.x, q.y, q.z), colr, new T.Vector3((Math.random() - .5) * 3, Math.random() * 2, (Math.random() - .5) * 3), .8, .25, 3, true);
          if (KN.hp <= 0) { KN.state = "broken"; KN.t = 0; S.glass(q, 1.4); S.thud(q); body.setNextKinematicTranslation(v3(0, -60, 0)); rig.clip("idle"); complete("knight", "The knight comes apart on the cathedral floor, every pane its own colour, and the red sword rings once."); }
          else if (KN.hp === 4) say("Half his panes are on the floor. He keeps coming.", 2.5); return true; };
        OWNER.set(col.handle, { kind: "glass", hit: KN.hit });
        KN.step = (dt, t) => { rig.sample(); if (!tpl) { if (rig.n < 8) return; build(); } const arr = mesh.instanceMatrix.array, onFloor = st.y < fy + 1.4 && Math.abs(st.x - pit.x) < pit.hx + 1 && Math.abs(st.z - pit.z) < pit.hz + 1, dx = st.x - KN.x, dz = st.z - KN.z, dist = Math.hypot(dx, dz);
          KN.t += dt; KN.cool = Math.max(0, KN.cool - dt); KN.stagger = Math.max(0, (KN.stagger || 0) - dt); glow.intensity = 26 + 8 * Math.sin(t * 1.7);
          if (KN.state === "window") { if (KN.t > 6 && onFloor && st.z < wz + 36 && st.mode !== "down") { KN.state = "forming"; KN.t = 0; KN.hp = HP; KN.x = pit.x; KN.z = wz + 5; KN.h = 0; setWin(false); for (const p of P) p.loose = false; tpl.forEach((sh, k) => mesh.setColorAt(k, sh.col)); mesh.instanceColor.needsUpdate = true; S.glass(win.position, 1); S.bell(); say("In the north window the knight's panes let go of their lead.", 3.5); } return; }
          if (KN.state === "broken" && (KN.t > 40 || (KN.t > 8 && dist > 70))) { KN.state = "returning"; KN.t = 0; P.forEach(p => p.from.copy(p.p)); S.cure(win.position); }
          if (KN.state === "returning") { const a = smooth(0, 3.2, KN.t); tpl.forEach((sh, k) => { const p = P[k], aa = smooth(sh.d * .5, .5 + sh.d * .5, a); _p.copy(p.from).lerp(sh.win, aa); _p.y += Math.sin(aa * Math.PI) * 3; const sc = 1 - smooth(.85, 1, aa); _m.compose(_p, _q.setFromAxisAngle(ZAX, aa * 7 + k), _s.copy(p.s).multiplyScalar(sc)); _m.toArray(arr, k * 16); }); mesh.instanceMatrix.needsUpdate = true; if (KN.t > 3.4) { KN.state = "window"; KN.t = -14; setWin(true); } return; }
          const alive = KN.state === "forming" || KN.state === "hunt" || KN.state === "strike";
          if (KN.state === "forming" && KN.t > 2.6) { KN.state = "hunt"; KN.t = 0; KN.cool = 1; say("He lands on the mirror floor and draws a sword of red glass.", 3); S.cock(); }
          if (KN.state === "hunt") { const want = Math.atan2(dx, dz); KN.h += wrapA(want - KN.h) * (1 - Math.exp(-dt * 4)); const go = onFloor && dist > 1.5 && !KN.stagger, sp = go ? (dist > 12 ? 2.7 : 1.7) : 0; KN.x = clamp(KN.x + Math.sin(KN.h) * sp * dt, pit.x - pit.hx + 1, pit.x + pit.hx - 1); KN.z = clamp(KN.z + Math.cos(KN.h) * sp * dt, pit.z - pit.hz + 2, pit.z + pit.hz - 2);
            rig.clip(sp > 2 ? "jog" : sp > 0 ? "walk" : "idle", { fade: .3 }); if (onFloor && dist < 1.9 && KN.cool <= 0 && st.mode === "foot") { KN.state = "strike"; KN.t = 0; KN.struck = false; rig.clip("hammering", { fade: .12 }); } }
          if (KN.state === "strike") { if (!KN.struck && KN.t > .55) { KN.struck = true; S.glass(_p.set(KN.x, KN.y + 1.5, KN.z), .3); if (dist < 2.5 && st.mode === "foot") { const h = document.getElementById("hurt"); if (h) { h.classList.add("on"); setTimeout(() => h.classList.remove("on"), 260); } fall("The red glass comes down across his shoulders."); } } if (KN.t > 1.25) { KN.state = "hunt"; KN.t = 0; KN.cool = 3.2; } }
          if (alive) { body.setNextKinematicTranslation(v3(KN.x, KN.y + .98, KN.z)); F.compose(_p.set(KN.x, KN.y, KN.z), _q.setFromAxisAngle(YAX, KN.h), _s.set(1, 1, 1)); bones(rig, 0, F); }
          const a = KN.state === "forming" ? smooth(0, 2.4, KN.t) : 1, drawn = KN.state === "forming" ? 0 : KN.state === "hunt" ? smooth(0, .5, KN.t + (KN.cool < 1 ? 1 : 0)) : 1;
          for (let k = 0; k < tpl.length; k++) { const sh = tpl[k], p = P[k], off = k * 16;
            if (p.loose) { /* a pane on its own: it falls, skips once and lies on the mirror */ const gy = onFloor || Math.abs(p.p.x - pit.x) < pit.hx ? fy + .03 : heightAt(p.p.x, p.p.z) + .03; if (p.p.y > gy || p.v.y > 0) { p.v.y -= 9.8 * dt; p.p.addScaledVector(p.v, dt); _q.setFromEuler(_e.set(p.w.x * dt, p.w.y * dt, p.w.z * dt)); p.q.premultiply(_q); if (p.p.y <= gy) { p.p.y = gy; if (p.v.y < -2.5) { p.v.y *= -.3; p.v.x *= .5; p.v.z *= .5; } else { p.v.set(0, 0, 0); p.q.setFromEuler(_e.set(-Math.PI / 2, 0, k)); } } } _m.compose(p.p, p.q, p.s).toArray(arr, off); continue; }
            if (!alive) continue; _m2.multiplyMatrices(BM[sh.slot], sh.L); if (sh.tag === "sword") { _m2.scale(_s.set(drawn, drawn, 1)); }
            if (a < 1) { const aa = smooth(sh.d * .5, .5 + sh.d * .5, a), e = _m2.elements, px = e[12], py = e[13], pz = e[14], w = sh.win, k1 = (1 - aa) * (1 - aa), k2 = 2 * aa * (1 - aa), k3 = aa * aa; _m.makeRotationAxis(_p2.set(sh.u - .5, sh.v - .5, sh.d - .5).normalize(), (1 - aa) * 7); _m2.multiply(_m); e[12] = k1 * w.x + k2 * ((w.x + px) / 2) + k3 * px; e[13] = k1 * w.y + k2 * (Math.max(w.y, py) + 2.5) + k3 * py; e[14] = k1 * w.z + k2 * (w.z + 3.2) + k3 * pz; }
            _m2.toArray(arr, off); }
          mesh.instanceMatrix.needsUpdate = true; }; } }

    /* ================= the zebu on the salt ================= */
    const HERD = { on: true, run: 0 };
    { const N = 12, rnd = rng(404), parts = [], COATS = [[0xf2ece0, 0xd8d0c0], [0x8a3a22, 0x5e2416], [0x221a16, 0x3a2c26], [0xe0c9a0, 0xb89a6a], [0xa8a8a4, 0x6e6e6c], [0xf2ece0, 0x221a16]];
      const add = (bone, p, n, sx, sy, kind, basis) => { const q = basis ? new T.Quaternion().setFromRotationMatrix(basis) : new T.Quaternion().setFromUnitVectors(ZAX, n.clone().normalize()).multiply(new T.Quaternion().setFromAxisAngle(ZAX, rnd() * 6.283)); parts.push({ bone, L: new T.Matrix4().compose(p, q, new T.Vector3(sx, sy, 1)), kind }); };
      const blob = (bone, c, rx, ry, rz, n, kind, s) => { for (let k = 0; k < n; k++) { const y = 1 - 2 * (k + .5) / n, rr = Math.sqrt(1 - y * y), th = k * 2.39996 + rnd() * .5, nr = new T.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr), sz = s * (.85 + rnd() * .4); add(bone, new T.Vector3(c[0] + nr.x * rx, c[1] + nr.y * ry, c[2] + nr.z * rz), nr, sz, sz * 1.2, kind); } };
      blob(0, [0, 1.08, 0], .3, .3, .78, 26, "coat", .34); blob(0, [0, 1.44, .4], .15, .2, .22, 6, "dark", .2); blob(1, [0, 1.22, .9], .13, .2, .22, 6, "coat", .22); blob(1, [0, 1.3, 1.24], .1, .12, .2, 7, "coat", .16);
      for (const s of [-1, 1]) { const cv = new T.CatmullRomCurve3([new T.Vector3(s * .08, 1.42, 1.2), new T.Vector3(s * .4, 1.52, 1.17), new T.Vector3(s * .62, 1.8, 1.14), new T.Vector3(s * .58, 2.12, 1.2)]); for (let k = 0; k < 6; k++) { const a = cv.getPoint(k / 6), b = cv.getPoint((k + 1) / 6), tan = b.clone().sub(a), len = tan.length(); tan.normalize(); const x = new T.Vector3().crossVectors(tan, ZAX).normalize(), z = new T.Vector3().crossVectors(x, tan); add(1, a.clone().add(b).multiplyScalar(.5), null, .11 - k * .012, len * 1.25, "horn", new T.Matrix4().makeBasis(x, tan, z)); } }
      const HIP = [[.19, .92, .52], [-.19, .92, .52], [.19, .92, -.56], [-.19, .92, -.56]]; HIP.forEach(([x, y, z], i) => { for (let k = 0; k < 3; k++) { const th = rnd() * 6.283; add(2 + i, new T.Vector3(x + Math.cos(th) * .05, y - .08 - k * .15, z + Math.sin(th) * .05), new T.Vector3(Math.cos(th), 0, Math.sin(th)), .15, .24, "coat"); add(6 + i, new T.Vector3(x + Math.cos(th) * .03, .4 - k * .14, z + Math.sin(th) * .03), new T.Vector3(Math.sin(th), 0, Math.cos(th)), .1, .22, k === 2 ? "dark" : "coat"); } });
      for (let k = 0; k < 3; k++) add(0, new T.Vector3(0, 1.2 - k * .22, -.8 - k * .02), new T.Vector3(1, 0, 0), .06, .24, k === 2 ? "dark" : "coat");
      const PN = parts.length, mesh = shards(N * PN, 1.05), zs = [], A0 = 2.25, RING = 372, CX = 0, CZ = -60; HERD.ang = A0; HERD.mesh = mesh; HERD.count = N * PN;
      for (let i = 0; i < N; i++) { const coat = COATS[i % COATS.length], sc = i > 9 ? .62 : .88 + rnd() * .3, offA = (rnd() - .5) * .075, offR = (rnd() - .5) * 26, a = A0 + offA; zs.push({ x: CX + Math.cos(a) * (RING + offR), z: CZ + Math.sin(a) * (RING + offR), h: a + Math.PI / 2, vx: 0, vz: 0, sp: 0, ph: rnd() * 6, sc, offA, offR, fear: 0 });
        parts.forEach((p, k) => { const tone = .85 + rnd() * .3, hex = p.kind === "horn" ? 0xefe6d0 : p.kind === "dark" ? coat[1] : rnd() < .06 ? [0x2fd0d8, 0xf2c84a, 0xe85aa8][k % 3] : rnd() < .25 ? coat[1] : coat[0]; mesh.setColorAt(i * PN + k, new T.Color(hex).multiplyScalar(tone)); }); } mesh.instanceColor.needsUpdate = true;
      const B = Array.from({ length: 10 }, () => new T.Matrix4()), F = new T.Matrix4(), TM = new T.Matrix4(), RM = new T.Matrix4(), hinge = (out, par, px, py, pz, ang) => out.copy(par).multiply(TM.makeTranslation(px, py, pz)).multiply(RM.makeRotationX(ang)).multiply(TM.makeTranslation(-px, -py, -pz));
      HERD.zs = zs; HERD.centre = new T.Vector3();
      HERD.step = (dt, t) => { const onBike = st.mode === "bike" || st.mode === "ride", arr = mesh.instanceMatrix.array; HERD.ang += dt * 1.5 / RING; let cx = 0, cz = 0;
        for (let i = 0; i < N; i++) { const z = zs[i], a = HERD.ang + z.offA, tx = CX + Math.cos(a) * (RING + z.offR), tz = CZ + Math.sin(a) * (RING + z.offR); let dx = tx - z.x, dz = tz - z.z; const d = Math.hypot(dx, dz) || 1, want = d > 14 ? 4.4 : d > 1.2 ? 1.5 : .0; let wx = dx / d * want, wz = dz / d * want;
          for (let j = 0; j < N; j++) if (j !== i) { const ox = z.x - zs[j].x, oz = z.z - zs[j].z, od = Math.hypot(ox, oz); if (od < 2.8 && od > .01) { wx += ox / od * (2.8 - od) * 1.6; wz += oz / od * (2.8 - od) * 1.6; } }
          const px = z.x - st.x, pz = z.z - st.z, pd = Math.hypot(px, pz), scare = onBike ? 30 : 13; if (pd < scare) { z.fear = 2.5; const k = (1 - pd / scare) * 9 + 3; wx += px / (pd || 1) * k; wz += pz / (pd || 1) * k; } z.fear = Math.max(0, z.fear - dt);
          const kk = 1 - Math.exp(-dt * (z.fear ? 3 : 1.4)); z.vx = lerp(z.vx, wx, kk); z.vz = lerp(z.vz, wz, kk); z.sp = Math.hypot(z.vx, z.vz); if (z.sp > 8) { z.vx *= 8 / z.sp; z.vz *= 8 / z.sp; z.sp = 8; } z.x += z.vx * dt; z.z += z.vz * dt; if (z.sp > .25) z.h += wrapA(Math.atan2(z.vx, z.vz) - z.h) * (1 - Math.exp(-dt * 5));
          z.ph += z.sp * dt * 2.6 / z.sc; cx += z.x; cz += z.z; const gal = smooth(3, 6, z.sp), amp = Math.min(1, z.sp / 1.2) * (.42 + gal * .3), y = heightAt(z.x, z.z);
          F.compose(_p.set(z.x, y, z.z), _q.setFromAxisAngle(YAX, z.h), _s.set(z.sc, z.sc, z.sc)); B[0].copy(F).multiply(TM.makeTranslation(0, Math.abs(Math.sin(z.ph * (1 + gal))) * (.03 + gal * .1), 0)); if (gal > 0) B[0].multiply(RM.makeRotationX(Math.sin(z.ph * 2) * .07 * gal));
          hinge(B[1], B[0], 0, 1.15, .72, Math.sin(z.ph * 2) * .05 + (z.sp < .3 ? .5 + .2 * Math.sin(t * .6 + i) : -gal * .12));   /* still, it lowers its head to the salt */
          for (let l = 0; l < 4; l++) { const [hx, hy, hz] = HIP[l], phs = z.ph + (gal > .5 ? (l < 2 ? 0 : 2.6) + (l % 2) * .5 : (l === 0 || l === 3 ? 0 : Math.PI)), sw = Math.sin(phs) * amp; hinge(B[2 + l], B[0], hx, hy, hz, sw); hinge(B[6 + l], B[2 + l], hx, .46, hz, Math.max(0, -Math.cos(phs)) * amp * 1.4); }
          for (let k = 0; k < PN; k++) _m.multiplyMatrices(B[parts[k].bone], parts[k].L).toArray(arr, (i * PN + k) * 16);
          if (gal > .5 && Math.random() < dt * 5) puff(new T.Vector3(z.x, y + .1, z.z), 0xeef4f2, new T.Vector3(-z.vx * .1, .5, -z.vz * .1), 1.1, .25, 3, false); }
        mesh.instanceMatrix.needsUpdate = true; HERD.centre.set(cx / N, 0, cz / N);
        if (st.mode === "bike" && Math.abs(BK.speed) > 9 && Math.hypot(st.x - cx / N, st.z - cz / N) < 26) { HERD.run += dt; if (HERD.run > 2.5) complete("zebu", "The herd breaks and runs beside the bike, glass hooves on the salt, the skull on the bars among its own."); } }; }

    /* ================= the spores over the oasis ================= */
    const SP = { near: 0 };
    { const N = 96, TAIL = 3, o = W.zones.oasis_pond, wy = W.oasisY, rnd = rng(909), mesh = new T.InstancedMesh(new T.OctahedronGeometry(1, 1), new T.MeshBasicMaterial({ transparent: true, opacity: .92, blending: T.AdditiveBlending, depthWrite: false, fog: false }), N * (TAIL + 1) + N); mesh.frustumCulled = false; scene.add(mesh);
      const COL = [0x2fd0d8, 0x58e8a0, 0xf2d04a, 0xe85aa8, 0x8fe6ea, 0xb8f47a], sp = [], cc = new T.Color();
      for (let i = 0; i < N; i++) { const a = rnd() * 6.283, r = 6 + rnd() * 30, h = { x: o.x + Math.cos(a) * r, y: wy + 1 + rnd() * 4.5, z: o.z + Math.sin(a) * r }; sp.push({ home: h, p: new T.Vector3(h.x, h.y, h.z), v: new T.Vector3(), tail: Array.from({ length: TAIL }, () => new T.Vector3(h.x, h.y, h.z)), ph: rnd() * 6.283, s: .045 + rnd() * .05, col: new T.Color(COL[i % COL.length]), base: new T.Color(COL[i % COL.length]), fear: 0, orbit: 1.4 + rnd() * 2, oh: .5 + rnd() * 1.8 }); }
      SP.sp = sp; SP.count = N;
      SP.scare = (q, colr) => { let n = 0; for (const s of sp) { const d = s.p.distanceTo(q); if (d < 9) { _p.copy(s.p).sub(q).normalize(); s.v.addScaledVector(_p, 14 * (1 - d / 9) + 4); s.v.y += 3; s.fear = 3 + Math.random() * 2; s.col.set(colr); n++; } } if (n) S.cure(q); };
      SP.step = (dt, t) => { const who = _p2.set(st.x, st.y, st.z), close = Math.hypot(st.x - o.x, st.z - o.z) < 60; let ringed = 0;
        sp.forEach((s, i) => { s.fear = Math.max(0, s.fear - dt); s.ph += dt * (.5 + (i % 5) * .08); let tx = s.home.x + Math.sin(s.ph * .7 + i) * 2.5, ty = s.home.y + Math.sin(s.ph * 1.3) * .8, tz = s.home.z + Math.cos(s.ph * .9 + i) * 2.5; const d = s.p.distanceTo(who);
          if (close && d < 30 && !s.fear) { const a = s.ph * .8 + i * .7; tx = who.x + Math.cos(a) * s.orbit; ty = who.y + s.oh + Math.sin(s.ph * 2) * .25; tz = who.z + Math.sin(a) * s.orbit; if (d < 4.5) ringed++; } else if (!s.fear) s.col.lerp(s.base, dt * .2);
          const k = s.fear ? .4 : 2.2; s.v.x += (tx - s.p.x) * k * dt; s.v.y += (ty - s.p.y) * k * dt; s.v.z += (tz - s.p.z) * k * dt; s.v.multiplyScalar(Math.exp(-dt * 1.6)); const sv = s.v.length(); if (sv > 9) s.v.multiplyScalar(9 / sv); s.p.addScaledVector(s.v, dt); s.p.y = Math.max(s.p.y, Math.max(wy, heightAt(s.p.x, s.p.z)) + .25);
          let prev = s.p; const pulse = 1 + .3 * Math.sin(t * 3 + i); _q.setFromEuler(_e.set(t * .7 + i, t * .9, 0)); mesh.setMatrixAt(i * 5, _m.compose(s.p, _q, _s.setScalar(s.s * pulse))); mesh.setColorAt(i * 5, cc.copy(s.col).multiplyScalar(.95));
          for (let j = 0; j < TAIL; j++) { const tl = s.tail[j]; tl.lerp(prev, 1 - Math.exp(-dt * (9 - j * 2))); mesh.setMatrixAt(i * 5 + 1 + j, _m.compose(tl, _q, _s.setScalar(s.s * (.6 - j * .15)))); mesh.setColorAt(i * 5 + 1 + j, cc.copy(s.col).multiplyScalar(.8 - j * .18)); prev = tl; }
          mesh.setMatrixAt(i * 5 + 4, _m.compose(s.p, _q, _s.setScalar(s.s * 2.2 * pulse))); mesh.setColorAt(i * 5 + 4, cc.copy(s.col).multiplyScalar(.12)); });   /* a soft halo round each body */
        mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; SP.ringed = ringed;
        if (ringed > 30) { SP.near += dt; if (SP.near > 3) complete("spores", "The spores come down off the water and ring him, slow as breath, each one lit from inside."); } }; }

    /* ================= the tail light ================= */
    const TR = {};
    if (TK && BK) { const N = 48, pos = new Float32Array(N * 4 * 3), al = new Float32Array(N * 4 * 2), idx = []; for (let i = 0; i < N - 1; i++) for (const b of [0, 2]) { const a = i * 4 + b, n = a + 4; idx.push(a, a + 1, n, a + 1, n + 1, n); }
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage)); g.setAttribute("aA", new T.BufferAttribute(al, 2).setUsage(T.DynamicDrawUsage)); g.setIndex(idx);
      const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: { uK: { value: 0 } }, vertexShader: "attribute vec2 aA; varying vec2 vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
        fragmentShader: "uniform float uK; varying vec2 vA; void main(){ float a = vA.x * vA.x * uK, core = 1. - abs(vA.y); vec3 c = mix(vec3(1., .06, .05), vec3(1., .7, .55), pow(core, 5.) * vA.x); gl_FragColor = vec4(c * a * (.35 + .9 * core * core) * 1.6, 1.);\n#include <colorspace_fragment>\n}" });
      const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; scene.add(mesh); const lamp = new T.PointLight(0xff2020, 0, 9, 2); scene.add(lamp);
      const pts = [], last = new T.Vector3(), tailL = new T.Vector3(0, .78, -.86), right = new T.Vector3();
      TR.step = dt => { const sp = Math.abs(BK.speed), k = st.mode === "bike" ? smooth(8, 15, sp) : 0; mat.uniforms.uK.value = lerp(mat.uniforms.uK.value, k, 1 - Math.exp(-dt * 3)); TR.k = mat.uniforms.uK.value; const p = TK.group.localToWorld(_p.copy(tailL)); lamp.position.copy(p); lamp.intensity = 2 + k * 14;
        if (pts.length && p.distanceTo(last) > 6) pts.length = 0;   /* the bike was moved, not ridden */
        if (!pts.length || p.distanceTo(last) > .36) { right.set(1, 0, 0).applyQuaternion(TK.group.quaternion); pts.unshift({ p: p.clone(), r: right.clone() }); if (pts.length > N) pts.pop(); last.copy(p); }
        if (mat.uniforms.uK.value < .01) { mesh.visible = false; return; } mesh.visible = true;
        for (let i = 0; i < N; i++) { const s = i === 0 ? { p, r: right } : pts[Math.min(i, pts.length - 1)], a = i < pts.length ? 1 - i / N : 0, w = .07 + i * .004, o = i * 12, q = i * 8;
          pos[o] = s.p.x - s.r.x * w; pos[o + 1] = s.p.y; pos[o + 2] = s.p.z - s.r.z * w; pos[o + 3] = s.p.x + s.r.x * w; pos[o + 4] = s.p.y; pos[o + 5] = s.p.z + s.r.z * w; pos[o + 6] = s.p.x; pos[o + 7] = s.p.y - w; pos[o + 8] = s.p.z; pos[o + 9] = s.p.x; pos[o + 10] = s.p.y + w; pos[o + 11] = s.p.z;
          al[q] = a; al[q + 1] = -1; al[q + 2] = a; al[q + 3] = 1; al[q + 4] = a; al[q + 5] = -1; al[q + 6] = a; al[q + 7] = 1; }
        g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true; }; }

    function step(dt, t, sun, fog) { SUN.value.copy(sun); FOG.value.copy(fog.color); FOGD.value = fog.density;
      for (const sys of [PR, KN, HERD, SP, TR]) if (sys.step) try { sys.step(dt, t); } catch (e) { console.warn("swarm", e); sys.step = null; } }
    return { step, onPaint(q, col) { if (SP.scare) SP.scare(q, col); }, procession: PR, knight: KN, herd: HERD, spores: SP, trail: TR };
  }
  window.MesaSwarm = { create };
})();
