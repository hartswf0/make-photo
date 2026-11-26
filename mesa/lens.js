/* The SCION lenses: the four PAE-09 swarms (bolas/paeleo/mesa-chip) as ways of seeing the playable world.
   The game is untouched (physics, paint, ink, swimming, the bike, the duel, the knight, the mirrors). Only the picture changes.
   The scene renders to a colour + depth target; one full-screen pass turns it into the swarm's language.
     tekle    Afewerk Tekle: one window, cut once. The cutting is fixed to the glass of the screen and never moves; the world is
              the light passing through it. Each piece takes the light at its centre; lead thickens where depth breaks, so the
              light itself draws every figure's contour.
     lucas85  Lucasfilm Computer Division 1985: a rack focus that follows the subject (the knight when it hunts, else Uncle Mesa),
              highlights that bloom per facet, and four-sub-frame motion blur by accumulation.
     mambety  Djibril Diop Mambety: told, not shot. The picture holds and jumps on a plucked rhythm (2,1,1,3,1,2,1,1,2,3 film
              frames) and cuts on the event; hot, worn stock; and the zebu horns return at the decisions, carrying every paint fired.
     moebius  Moebius and Otomo: one black line of constant weight from depth and colour breaks, flat colour, and light that stays
              behind: saturated bright things (paintballs, the red sword, emissive glass) leave Akira trails.
   MesaLens.create({ T, renderer }) -> { render(scene, camera, dt, info), event(kind, colour), set(name), cycle(), name, on(), resize() } */
(() => {
  "use strict";
  const NAMES = ["plain", "tekle", "lucas85", "mambety", "moebius"];
  const LABEL = { plain: "Plain", tekle: "Tekle · leaded light", lucas85: "1985 · shard light", mambety: "Mambéty · told", moebius: "Mœbius · line" };
  const FRAG = `
precision highp float;
uniform sampler2D tCol, tDepth, tPrev, tIns;
uniform vec2 uRes; uniform float uTime, uNear, uFar, uFocus, uCell, uIns, uDpr, uFresh;
uniform int uLens;
varying vec2 vUv;
vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c) {
  const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c *= 1.0 / 0.6; c = I * c; c = RRTAndODTFit(c); c = O * c; return clamp(c, 0.0, 1.0); }
vec3 srgb(vec3 c) { return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
vec3 disp(vec2 uv) { return srgb(aces(texture2D(tCol, uv).rgb)); }
float lin(vec2 uv) { float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 h2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 rgb2hsv(vec3 c) { vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); float e = 1.0e-10; return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }
vec3 hsv2rgb(vec3 c) { vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0); return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }

/* ---- Tekle: the fixed cutting ---- */
vec3 tekle(vec2 uv) {
  vec2 g = uv * uRes / uCell, ip = floor(g); vec2 p1 = vec2(0.0), p2 = vec2(0.0); float d1 = 1e9, d2 = 1e9;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = ip + vec2(float(i), float(j)), p = c + 0.12 + 0.76 * h2(c); float d = dot(p - g, p - g);
    if (d < d1) { d2 = d1; p2 = p1; d1 = d; p1 = p; } else if (d < d2) { d2 = d; p2 = p; } }
  vec2 n = normalize(p2 - p1); float edge = dot(0.5 * (p1 + p2) - g, n);   /* distance to the lead line, in cell units */
  vec2 cu = p1 * uCell / uRes, o = vec2(0.22) * uCell / uRes;
  vec3 light = (disp(cu) * 2.0 + disp(cu + o) + disp(cu - o) + disp(cu + vec2(o.x, -o.y)) + disp(cu + vec2(-o.x, o.y))) / 6.0;
  float z1 = lin(cu), z2 = lin(p2 * uCell / uRes); float brk = smoothstep(0.18, 0.45, abs(log(z1 / max(z2, 1e-3))));
  vec3 jewel = hsv2rgb(vec3(h1(p1 + 3.1), 0.75, 1.0));
  vec3 glass = mix(light, light * jewel * 1.6, 0.07);
  glass = mix(vec3(luma(glass)), glass, 1.25) * 1.08;                         /* backlit glass is more saturated than the world behind it */
  float body = 0.86 + 0.14 * smoothstep(0.0, 0.45, edge);                      /* thicker at the centre of each piece */
  float streak = 0.94 + 0.06 * sin(g.y * 9.0 + h1(p1) * 30.0 + g.x * 1.7);
  glass *= body * streak;
  float w = 0.03 + 0.1 * brk;                                                /* the lead: thicker where the depth breaks, so light draws the figures */
  float lead = 1.0 - smoothstep(w, w + 0.035, edge);
  return mix(glass, vec3(0.055, 0.045, 0.05), lead);
}

/* ---- Lucasfilm 1985: rack focus, facet bloom, accumulation blur ---- */
vec3 lucas(vec2 uv) {
  float z = lin(uv); float coc = clamp(abs(z - uFocus) / max(z, 0.5) * 1.6, 0.0, 1.0) * 5.0 * uDpr;
  vec3 acc = vec3(0.0); float wt = 0.0; vec3 hi = vec3(0.0);
  for (int k = 0; k < 16; k++) {
    float a = float(k) * 2.39996, r = sqrt((float(k) + 0.5) / 16.0);
    vec2 o = vec2(cos(a), sin(a)) * r * coc / uRes; vec3 c = disp(uv + o); acc += c; wt += 1.0;
    vec2 o2 = vec2(cos(a), sin(a)) * r * 9.0 * uDpr / uRes; vec3 c2 = disp(uv + o2); hi += max(c2 - 0.78, 0.0); }
  vec3 c = acc / wt + hi / 16.0 * 1.6;                                          /* each facet's highlight blooms on its own */
  c = c * vec3(1.04, 1.0, 0.93) + vec3(0.012, 0.006, 0.0);
  vec3 prev = texture2D(tPrev, uv).rgb; c = mix(c, prev, 0.42 * (1.0 - uFresh)); /* four sub-frames: the shutter stays open */
  return c;
}

/* ---- Mambety: hot, worn stock; the insert ---- */
vec3 mambety(vec2 uv) {
  float ff = floor(uTime * 24.0); vec2 weave = (h2(vec2(ff, 3.0)) - 0.5) * 2.0 / uRes;
  vec3 c = disp(uv + weave);
  c = mix(vec3(luma(c)), c, 1.32); c = c * vec3(1.08, 0.98, 0.86) + vec3(0.03, 0.01, -0.02);
  c = mix(c, floor(c * 7.0 + 0.5) / 7.0, 0.35);                               /* paper: a little cut, a little printed */
  c *= 1.0 + 0.04 * sin(ff * 2.1) + (h1(vec2(ff, 9.0)) - 0.5) * 0.04;          /* flicker */
  c += (h1(uv * uRes + ff) - 0.5) * 0.09;                                       /* grain */
  float sx = h1(vec2(ff, 1.0)); if (h1(vec2(ff, 2.0)) > 0.55 && abs(uv.x - sx) < 0.6 / uRes.x * uDpr) c = c * 0.5 + 0.32;  /* a scratch */
  vec2 dp = h2(vec2(ff, 5.0)); if (length((uv - dp) * uRes) < 2.0 * uDpr) c *= 0.15;  /* dust */
  vec3 ins = texture2D(tIns, uv).rgb; c = mix(c, ins * vec3(1.06, 0.98, 0.88), uIns);
  vec2 v = uv - 0.5; c *= 1.0 - 0.55 * dot(v, v) * 1.6;
  return c;
}

/* ---- Moebius / Otomo: the line, flat colour, light that stays ---- */
vec3 moebius(vec2 uv) {
  vec2 px = uDpr * 1.15 / uRes; float z = lin(uv);
  float zl = lin(uv - vec2(px.x, 0.0)), zr = lin(uv + vec2(px.x, 0.0)), zu = lin(uv + vec2(0.0, px.y)), zd = lin(uv - vec2(0.0, px.y));
  float de = (abs(zl + zr - 2.0 * z) + abs(zu + zd - 2.0 * z)) / max(z, 0.5);
  float lc = luma(disp(uv)), ll = luma(disp(uv - vec2(px.x, 0.0))), lr = luma(disp(uv + vec2(px.x, 0.0))), lu = luma(disp(uv + vec2(0.0, px.y))), ld = luma(disp(uv - vec2(0.0, px.y)));
  float le = length(vec2(lr - ll, lu - ld));
  float line = max(smoothstep(0.035, 0.07, de), smoothstep(0.16, 0.26, le));
  vec3 hsv = rgb2hsv(disp(uv)); hsv.z = mix(hsv.z, floor(hsv.z * 3.0 + 0.6) / 3.0, 0.8); hsv.y = min(1.0, hsv.y * 1.12);
  vec3 fl = hsv2rgb(hsv); fl = mix(fl, vec3(0.98, 0.95, 0.9), 0.08);
  vec3 c = mix(fl, vec3(0.085, 0.07, 0.08), line);
  vec3 cur = disp(uv); vec3 ch = rgb2hsv(cur);
  vec3 prev = texture2D(tPrev, uv).rgb; vec3 ph = rgb2hsv(prev);
  float glow = step(0.55, ch.y) * step(0.72, ch.z);                             /* bright, saturated: paint in flight, the red sword, lit glass */
  c = mix(c, cur * 1.08, glow);
  float trail = step(0.6, ph.y) * step(0.7, ph.z) * (1.0 - uFresh);            /* what was bright stays behind, fading */
  c = mix(c, max(c, prev * 0.9), trail * 0.85);
  return c;
}

void main() {
  vec3 c;
  if (uLens == 1) c = tekle(vUv); else if (uLens == 2) c = lucas(vUv); else if (uLens == 3) c = mambety(vUv); else c = moebius(vUv);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
  const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const COPY = `uniform sampler2D tSrc; varying vec2 vUv; void main() { gl_FragColor = texture2D(tSrc, vUv); }`;
  const HOLDS = [2, 1, 1, 3, 1, 2, 1, 1, 2, 3];

  function create({ T, renderer }) {
    let name = "plain"; try { const q = new URLSearchParams(location.search).get("lens"); if (NAMES.includes(q)) name = q; } catch (e) { }
    const size = new T.Vector2(); let rt = null, outA = null, outB = null;
    function make() {
      renderer.getDrawingBufferSize(size); const w = Math.max(2, size.x), h = Math.max(2, size.y);
      for (const r of [rt, outA, outB]) if (r) r.dispose();
      rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType });   /* not multisampled, so its depth can be read in every browser */ rt.depthTexture = new T.DepthTexture(w, h); rt.depthTexture.type = T.UnsignedIntType;
      outA = new T.WebGLRenderTarget(w, h); outB = new T.WebGLRenderTarget(w, h);
      U.uRes.value.set(w, h); U.uDpr.value = renderer.getPixelRatio(); U.uCell.value = 11 * renderer.getPixelRatio();
    }
    const U = { tCol: { value: null }, tDepth: { value: null }, tPrev: { value: null }, tIns: { value: null }, uRes: { value: new T.Vector2(2, 2) }, uTime: { value: 0 }, uNear: { value: .1 }, uFar: { value: 5000 },
      uFocus: { value: 8 }, uCell: { value: 13 }, uIns: { value: 0 }, uDpr: { value: 1 }, uFresh: { value: 1 }, uLens: { value: 1 } };
    const mat = new T.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false, toneMapped: false });
    const copy = new T.ShaderMaterial({ uniforms: { tSrc: { value: null } }, vertexShader: VERT, fragmentShader: COPY, depthTest: false, depthWrite: false, toneMapped: false });
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; const qs = new T.Scene(); qs.add(quad); const qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    /* the returning image: the zebu horns from the game's own horned motorcycle, painted with every colour fired so far */
    const fired = []; const ins = document.createElement("canvas"); ins.width = 768; ins.height = 432; const ix = ins.getContext("2d");
    const insTex = new T.CanvasTexture(ins); insTex.colorSpace = T.SRGBColorSpace; U.tIns.value = insTex;
    const horns = new Image(); horns.src = "./touki-front.jpg"; let insT = 0, insLen = 0;
    function paintInsert() {
      ix.fillStyle = "#3a2214"; ix.fillRect(0, 0, ins.width, ins.height);
      if (horns.complete && horns.naturalWidth) { const sw = horns.naturalWidth * .62, sh = sw * 9 / 16; ix.drawImage(horns, horns.naturalWidth * .19, horns.naturalHeight * .26, sw, sh, 0, 0, ins.width, ins.height); }
      let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (const c of fired) for (let k = 0; k < 9; k++) { const x = rnd() * ins.width, y = rnd() * ins.height, r = 10 + rnd() * 26; ix.fillStyle = c; ix.beginPath(); ix.ellipse(x, y, r, r * .8, rnd() * 3, 0, 7); ix.fill(); }
      insTex.needsUpdate = true;
    }
    let film = 0, nextAt = 0, hk = 0, fresh = true, cut = true;
    function on() { return name !== "plain"; }
    function set(n) { name = NAMES.includes(n) ? n : "plain"; fresh = true; cut = true; try { const u = new URL(location.href); if (name === "plain") u.searchParams.delete("lens"); else u.searchParams.set("lens", name); history.replaceState(null, "", u); } catch (e) { } return name; }
    function cycle() { return set(NAMES[(NAMES.indexOf(name) + 1) % NAMES.length]); }
    function event(kind, colour) {
      if (kind === "fire" && colour) { const c = typeof colour === "number" ? "#" + colour.toString(16).padStart(6, "0") : colour; if (!fired.includes(c)) fired.push(c); return; }
      cut = true;   /* every lens cuts on the event; the griot also interrupts with the horns at the decisions */
      if (name === "mambety" && (kind === "shatter" || kind === "fall" || kind === "mount")) { paintInsert(); insT = 0; insLen = kind === "shatter" ? .42 : .3; }
    }
    function render(scene, camera, dt, info) {
      if (!rt) make();
      U.uTime.value += dt; U.uNear.value = camera.near; U.uFar.value = Math.min(camera.far, 1500); U.uLens.value = NAMES.indexOf(name);
      if (info && info.focus) U.uFocus.value += (info.focus - U.uFocus.value) * (1 - Math.exp(-dt * 3.5));   /* the rack: it travels, it does not jump */
      /* the griot's rhythm: a new picture only on the beat, unless something happens */
      let draw = true;
      if (name === "mambety") { film += dt * 24; if (cut || film >= nextAt) { nextAt = film + HOLDS[hk++ % HOLDS.length]; cut = false; } else draw = false; }
      if (insLen > 0) { insT += dt; U.uIns.value = insT < insLen ? 1 : 0; if (insT >= insLen) insLen = 0; } else U.uIns.value = 0;
      if (draw) { renderer.setRenderTarget(rt); renderer.render(scene, camera); }
      U.tCol.value = rt.texture; U.tDepth.value = rt.depthTexture; U.tPrev.value = outB.texture; U.uFresh.value = fresh ? 1 : 0;
      quad.material = mat; renderer.setRenderTarget(outA); renderer.render(qs, qc);
      copy.uniforms.tSrc.value = outA.texture; quad.material = copy; renderer.setRenderTarget(null); renderer.render(qs, qc);
      const tmp = outA; outA = outB; outB = tmp; fresh = false; if (name !== "mambety") cut = false;
    }
    function resize() { if (rt) make(); }
    return { render, event, set, cycle, on, resize, get name() { return name; }, label: () => LABEL[name], names: NAMES };
  }
  window.MesaLens = { create, NAMES, LABEL };
})();
