/* MESA CHIP ink: paintballs that land as wet ink and cure into stained glass.

   The liquid follows the rain kit's membrane (night-post/rain/demos/water.js): a field of blobs added together and cut at a
   threshold, so drops that touch merge into one body with a single hard, bright edge. Here the field is evaluated per splat in a
   shader, on a decal laid against the surface it hit:
     - a paintball is a real projectile, stretched along its speed, trailing droplets, falling on an arc;
     - it lands as a main blob, satellite droplets thrown forward, and a streak along the way it was travelling;
     - on a wall the ink runs: drips crawl down the face and stop with a bead;
     - then it cures. Over about two seconds lead lines grow through the wet ink, each cell takes its own glass colour leaning toward
       the paint, and it starts to glow. Wet ink is glossy; glass shines from inside.
   Graffiti: turf counted in one-metre cells across the arena, and tag spots on walls that bloom into a stained-glass mural once
   enough ink lands inside them.

   MesaInk.create({ T, scene, world, R, OWNER, exclude, heightAt, S, puff, say, complete, onHit }) ->
     { fire(origin, dir, color), step(dt, t), inkUnder(x, z, y), turf(), splats, balls, tags } */
(() => {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const MAXD = 1600, MAXB = 90;

  function create(c) {
    const { T, scene, world, R, OWNER } = c, v3 = (x, y, z) => ({ x, y, z });
    const SUN = { value: new T.Vector3(.3, .5, -.8).normalize() }, NOW = { value: 0 };

    /* ---------- the decals: one instanced mesh, one draw, every splat and drip in the world ---------- */
    const g = new T.PlaneGeometry(1, 1);
    const aCol = new T.InstancedBufferAttribute(new Float32Array(MAXD * 3), 3), aDat = new T.InstancedBufferAttribute(new Float32Array(MAXD * 4), 4), aDir = new T.InstancedBufferAttribute(new Float32Array(MAXD * 4), 4);
    aCol.setUsage(T.DynamicDrawUsage); aDat.setUsage(T.DynamicDrawUsage); aDir.setUsage(T.DynamicDrawUsage); g.setAttribute("aCol", aCol); g.setAttribute("aDat", aDat); g.setAttribute("aDir", aDir);
    const mat = new T.ShaderMaterial({ uniforms: { uSun: SUN, uNow: NOW, uFog: { value: new T.Color() }, uFogD: { value: .0016 } }, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -16,
      vertexShader: `attribute vec3 aCol; attribute vec4 aDat; attribute vec4 aDir; varying vec2 vUv; varying vec3 vCol; varying vec4 vDat; varying vec3 vW; varying vec3 vN; varying vec3 vV; varying vec4 vDir;
        void main(){ vUv = uv - .5; vCol = aCol; vDat = aDat; vDir = aDir; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * vec3(0., 0., 1.)); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uSun; uniform float uNow; uniform vec3 uFog; uniform float uFogD; varying vec2 vUv; varying vec3 vCol; varying vec4 vDat; varying vec3 vW; varying vec3 vN; varying vec3 vV; varying vec4 vDir;
        float h1(float n){ return fract(sin(n) * 43758.5453); } vec2 h2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
        float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 23758.5453); }
        vec3 pal(float h){ return h < .15 ? vec3(.18,.82,.85) : h < .3 ? vec3(.95,.66,.23) : h < .44 ? vec3(.85,.2,.17) : h < .58 ? vec3(.95,.82,.29) : h < .72 ? vec3(.16,.6,.35) : h < .86 ? vec3(.16,.29,.72) : vec3(.91,.35,.66); }
        /* the field: metaballs, as the membrane adds them; kind 0 a splat, kind 1 a drip, kind 2 a mural (a square of glass) */
        float field(vec2 p, float seed, float kind, float grow){
          if (kind > 1.5) { vec2 q = abs(p); return smoothstep(.5, .46, max(q.x, q.y)) * 2.; }
          if (kind > .5) { /* a drip: hangs from the top of its decal and crawls down as it grows, a bead at its foot */
            float yEnd = .45 - .9 * grow, w = .075 + .02 * sin(p.y * 29. + seed * 9.), inBody = step(yEnd, p.y) * step(p.y, .45);
            float body = inBody * w * w / (p.x * p.x + w * w * .3); vec2 b = p - vec2(0., yEnd); float bead = .0036 / (dot(b, b) + .0003); vec2 tp = p - vec2(0., .45); return body + bead + .006 / (dot(tp, tp) + .0005); }
          vec2 q = p * vec2(1., 1. / mix(1., 1.6, vDir.w)); float f = .055 / (dot(q, q) + .002);
          for (int i = 0; i < 9; i++) { float fi = float(i), a = h1(seed + fi * 3.7) * 6.283, r = .2 + h1(seed + fi * 7.1) * .22, s = .004 + h1(seed + fi * 1.3) * .01; vec2 c = vec2(cos(a), sin(a)) * r; c.y += vDir.w * .14 * (h1(seed + fi) - .2); vec2 d = p - c; f += s / (dot(d, d) + .0008); }
          vec2 st = vec2(p.x * 7., p.y + .12); f += .012 / (st.x * st.x + max(0., abs(st.y) - .22 * vDir.w) * 2. + .002) * vDir.w;
          return f * grow; }
        void main(){
          float age = uNow - vDat.x, seed = vDat.y, kind = vDat.z;
          float grow = kind > .5 && kind < 1.5 ? smoothstep(0., 1.8, age) * (.6 + .4 * h1(seed)) : smoothstep(0., .09, age) * (1. + .08 * exp(-age * 7.) * sin(age * 40.));
          float F = field(vUv, seed, kind, grow); if (F < 1.) discard;
          float edge = smoothstep(1., 1.6, F);
          float depth = smoothstep(1., 3.2, F);   /* how far in from the rim: the glass starts at the edge and crystallizes inward */
          float cure = kind > 1.5 ? 1. : smoothstep(1.1 + h1(seed) * .3 + depth * 1.1, 1.9 + h1(seed) * .3 + depth * 1.6, age);
          /* glass cells on the surface's own plane, continuous from one splat to the next */
          vec3 n = abs(vN); vec2 p = (n.y > .6 ? vW.xz : n.x > n.z ? vW.zy : vW.xy) * (kind > 1.5 ? 2.4 : 1.9);
          vec2 gg = floor(p), ff = fract(p); float d1 = 8., d2 = 8.; vec2 id = gg;
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(float(x), float(y)), r = o + h2(gg + o) * .8 + .1 - ff; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; id = gg + o; } else if (d < d2) d2 = d; }
          float gap = sqrt(d2) - sqrt(d1), leadW = mix(0., .085, cure), lead = smoothstep(leadW, leadW + .03, gap);
          vec3 cell = mix(pal(h21(id)), vCol, .55) * (.9 + .3 * h21(id + 7.)); cell = pow(cell, vec3(1.35)) * 1.15;
          vec3 L = normalize(uSun), V = normalize(vV), N = normalize(vN); if (dot(N, V) < 0.) N = -N;
          /* wet ink: the field's slope is its relief, so the edge rolls over like a bead of paint */
          vec2 gr = vec2(dFdx(F), dFdy(F)); vec3 Nb = normalize(N + vec3(gr.x, 0., gr.y) * (.06 * (1. - cure)));
          float dif = .45 + .55 * max(dot(Nb, L), 0.), spec = pow(max(dot(reflect(-L, Nb), V), 0.), 40.) * (1. - cure) * .9;
          vec3 wet = pow(vCol, vec3(1.15)) * dif * (.9 + .3 * (1. - edge)) + spec + vCol * .1;   /* bold, glossy, a darker rim where the bead rolls over */
          wet *= mix(.72, 1., smoothstep(1., 1.25, F));
          vec3 glass = mix(vec3(.04, .03, .025), cell * (.55 + .45 * dif), lead) + cell * lead * (.55 + .2 * sin(uNow * 1.6 + id.x * 3. + id.y));
          float sparkle = (1. - abs(cure - .5) * 2.) * step(.985, h21(floor(p * 6.) + floor(uNow * 8.))) * lead;
          vec3 col = mix(wet, glass, cure) + sparkle * vec3(1., .95, .8);
          float fog = 1. - exp(-uFogD * uFogD * dot(vV, vV)); col = mix(col, uFog, clamp(fog, 0., 1.));
          gl_FragColor = vec4(col, 1.); #include <colorspace_fragment>
        }`.replace("gl_FragColor = vec4(col, 1.); #include <colorspace_fragment>", "gl_FragColor = vec4(col, 1.);\n#include <colorspace_fragment>") });
    mat.extensions = { derivatives: true };
    const decals = new T.InstancedMesh(g, mat, MAXD); decals.count = 0; decals.frustumCulled = false; decals.renderOrder = 2; scene.add(decals);
    const splats = []; let head = 0, uses = 0;
    const _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _x = new T.Vector3(), _y = new T.Vector3(), _z = new T.Vector3(), _b = new T.Matrix4();
    function decal(p, n, along, w, h, col, kind, len, stretch) {
      const i = head; head = (head + 1) % MAXD; uses = Math.min(uses + 1, MAXD); decals.count = uses;
      _z.copy(n).normalize(); _y.copy(along).addScaledVector(_z, -along.dot(_z)); if (_y.lengthSq() < 1e-6) _y.set(1, 0, 0).cross(_z); _y.normalize(); _x.crossVectors(_y, _z).normalize();
      _b.makeBasis(_x, _y, _z); _q.setFromRotationMatrix(_b); const lift = (_z.y > .6 ? .055 : .025) + (uses % 40) * .0015;   /* each new splat a hair above the last, so overlaps never fight for depth */
      _m.compose(p.clone().addScaledVector(_z, lift), _q, _s.set(w, h, 1)); decals.setMatrixAt(i, _m);
      aCol.setXYZ(i, col.r, col.g, col.b); aDat.setXYZ(i, NOW.value, Math.random() * 100, kind); aDat.setW(i, len || 1); aDir.setXYZW(i, along.x, along.y, along.z, stretch || 0);
      decals.instanceMatrix.needsUpdate = aCol.needsUpdate = aDat.needsUpdate = aDir.needsUpdate = true;
      const s = { i, p: p.clone(), n: _z.clone(), r: Math.max(w, h) * .42, col, kind, t: NOW.value }; splats[i] = s; if (kind === 0 && _z.y > .6) mark(p, s.r); return s; }

    /* ---------- turf: one-metre cells; a cell is yours once ink cures on it ---------- */
    const TURF = new Map(); let turfN = 0;
    function mark(p, r) { const R2 = Math.ceil(r); for (let dx = -R2; dx <= R2; dx++) for (let dz = -R2; dz <= R2; dz++) { if (dx * dx + dz * dz > r * r + .5) continue; const k = (Math.round(p.x) + dx) + "," + (Math.round(p.z) + dz); if (!TURF.has(k)) { TURF.set(k, true); turfN++; } } }
    function inkUnder(x, z, y) { for (let k = 0; k < uses; k++) { const s = splats[k]; if (!s || s.kind !== 0 || s.n.y < .6) continue; if (Math.abs(s.p.y - y) > 1.2) continue; if ((s.p.x - x) ** 2 + (s.p.z - z) ** 2 < s.r * s.r) return s; } return null; }

    /* ---------- tag spots: frames on the walls; fill one with ink and it blooms into a glass mural ---------- */
    const tags = (c.tags || []).map(t => { const fr = new T.Group(), m = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 }), wv = t.w / 2, hv = t.h / 2;
      const pts = [[-wv, -hv], [wv, -hv], [wv, hv], [-wv, hv], [-wv, -hv]].map(([a, b]) => new T.Vector3(a, b, 0)); fr.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), m));
      for (let k = 0; k < 4; k++) { const cnr = new T.Mesh(new T.CircleGeometry(.12, 12), new T.MeshBasicMaterial({ color: 0xff3aa8 })); cnr.position.set(k % 2 ? wv : -wv, k < 2 ? -hv : hv, .01); fr.add(cnr); }
      fr.position.copy(t.p).addScaledVector(t.n, .05); fr.lookAt(t.p.clone().add(t.n)); scene.add(fr); return Object.assign({ fr, hits: 0, done: false }, t); });
    function tagHit(p) { for (const t of tags) { if (t.done) continue; const d = p.clone().sub(t.p); if (Math.abs(d.dot(t.n)) > .6) continue; const right = new T.Vector3(0, 1, 0).cross(t.n).normalize(), up = t.n.clone().cross(right);
        if (Math.abs(d.dot(right)) < t.w / 2 && Math.abs(d.dot(up)) < t.h / 2) { t.hits++; t.fr.children[0].material.opacity = .7 + t.hits / t.need * .3; if (t.hits >= t.need) bloomTag(t); return; } } }
    function bloomTag(t) { t.done = true; scene.remove(t.fr); const up = new T.Vector3(0, 1, 0); decal(t.p, t.n, up, t.w, t.h, new T.Color(t.color || 0xf2d04a), 2, 1, 0);
      if (t.mural) { const m = new T.Mesh(new T.PlaneGeometry(t.w * .92, t.h * .92), new T.MeshBasicMaterial({ map: t.mural, transparent: true, opacity: 0, depthWrite: false })); m.position.copy(t.p).addScaledVector(t.n, .08); m.lookAt(t.p.clone().add(t.n)); scene.add(m); t.muralMesh = m; }
      c.S && c.S.chord && c.S.chord(); c.say && c.say(`The ${t.name} takes the glass. A mural where the wall was.`, 3); if (tags.every(x => x.done)) c.complete && c.complete("tags", "Every wall that asked for it now holds a window."); }

    /* ---------- paintballs ---------- */
    const ballG = new T.SphereGeometry(.09, 14, 10), balls = [], ballMats = new Map();
    const bm = col => { const k = col.getHexString(); if (!ballMats.has(k)) ballMats.set(k, new T.MeshStandardMaterial({ color: col, roughness: .12, metalness: .05, emissive: col, emissiveIntensity: .35 })); return ballMats.get(k); };
    function fire(o, d, color, speed = 34) { if (balls.length >= MAXB) { const old = balls.shift(); scene.remove(old.m); } const col = new T.Color(color), m = new T.Mesh(ballG, bm(col)); m.position.copy(o); scene.add(m);
      balls.push({ m, v: d.clone().multiplyScalar(speed), col, t: 0 }); }
    function splat(p, n, dir, col, big = 1) {
      const along = dir.clone(), incid = 1 - Math.abs(dir.dot(n)), size = (1.05 + Math.random() * .5) * big, stretch = clamp(incid * 1.3, 0, 1);
      decal(p, n, along, size, size * (1 + stretch * .6), col, 0, 1, stretch);
      for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) { const off = along.clone().addScaledVector(n, -along.dot(n)).normalize().multiplyScalar(.5 + Math.random() * 1.4).add(new T.Vector3((Math.random() - .5) * .8, 0, (Math.random() - .5) * .8)), q = p.clone().add(off.addScaledVector(n, -off.dot(n))), s = (.25 + Math.random() * .3) * big;
        decal(q, n, along, s, s, col, 0, 1, 0); }
      if (Math.abs(n.y) < .6) { const down = new T.Vector3(0, -1, 0); for (let k = 0; k < 1 + Math.floor(Math.random() * 3); k++) { const q = p.clone().add(new T.Vector3((Math.random() - .5) * .5, -.1, (Math.random() - .5) * .5)); q.addScaledVector(n, -q.clone().sub(p).dot(n));
          const len = .8 + Math.random() * 1.8; decal(q.addScaledVector(down, len * .45), n, new T.Vector3(0, 1, 0), .5, len * 1.0, col, 1, len * .95, 0); } }
      tagHit(p); c.S && c.S.splat && c.S.splat(p); if (c.puff) for (let k = 0; k < 4; k++) c.puff(p.clone().addScaledVector(n, .1), col, n.clone().multiplyScalar(1.5).add(new T.Vector3((Math.random() - .5) * 2, Math.random(), (Math.random() - .5) * 2)), .45, .06, 1.2, false);
      cures.push({ p: p.clone(), at: NOW.value + 1.6 + Math.random() * .6 }); }
    const cures = [];
    function step(dt, t) { NOW.value = t;
      for (let i = balls.length - 1; i >= 0; i--) { const b = balls[i], p = b.m.position; b.t += dt; b.v.y -= 9.81 * dt; const len = b.v.length() * dt, d = b.v.clone().normalize();
        const hit = world.castRayAndGetNormal(new R.Ray(v3(p.x, p.y, p.z), v3(d.x, d.y, d.z)), len, true, undefined, undefined, c.exclude && c.exclude());
        if (hit) { const toi = hit.timeOfImpact ?? hit.toi, q = p.clone().addScaledVector(d, toi), n = new T.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), who = OWNER.get(hit.collider.handle);
          scene.remove(b.m); balls.splice(i, 1); const handled = c.onHit ? c.onHit(who, q, n, d, b.col) : false; if (!handled) splat(q, n, d, b.col); continue; }
        p.addScaledVector(d, len); b.m.quaternion.setFromUnitVectors(_y.set(0, 1, 0), d); b.m.scale.set(1, 1 + Math.min(1.6, b.v.length() * .03), 1);
        if (c.puff && Math.random() < dt * 22) c.puff(p.clone(), b.col, b.v.clone().multiplyScalar(.05), .35, .03, .6, false);
        if (b.t > 4) { scene.remove(b.m); balls.splice(i, 1); } }
      for (let i = cures.length - 1; i >= 0; i--) if (t > cures[i].at) { c.S && c.S.cure && c.S.cure(cures[i].p); cures.splice(i, 1); }
      for (const tg of tags) if (tg.muralMesh) tg.muralMesh.material.opacity = Math.min(.95, tg.muralMesh.material.opacity + dt * .25); }
    function setSun(dir, fogCol, fogD) { SUN.value.copy(dir); mat.uniforms.uFog.value.copy(fogCol); mat.uniforms.uFogD.value = fogD; }
    return { fire, step, splat, inkUnder, turf: () => turfN, splats, balls, tags, setSun, get count() { return uses; } };
  }
  window.MesaInk = { create };
})();
