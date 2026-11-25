// Grand Teton as a jerry can (ground@1). Every detail comes from MONOLITH-3's own packets (monolith3/packets/, extracted by
// extract_packets.py): its NAIP aerial imagery draped at its own resolution (21.6 m far, 2.7 m near, 1 m at the overlook), its 9,428
// surveyed tree crowns (USGS 3DEP) where they stand, and the Snake River at its own water level (USGS NHD). The trough gives ground,
// light and grade; the can brings what Teton is made of. Coordinates arrive in metres from the island's corner.
(() => {
  const BASE = new URL('./', document.currentScript.src).href;
  async function create(T, g) {
    const man = await (await fetch(BASE + 'packets.json')).json(), P = id => man.packets.find(p => p.id === id), url = id => new URL(P(id).file, BASE).href;
    const far = P('far-surface').bounds, W0 = far[0], N0 = far[3];                     // the island corner is the far grid's north-west: local x = cx - W0, z = cz - N0
    const toC = (x, z) => [x - W0, z + N0];                                             // MONOLITH-3 local metres -> island-corner metres
    const datum = g.datum ?? (man.frame.base_elev_m + 14), lift = man.frame.base_elev_m - datum;   // local y is metres above 1950; trough y is metres above this island's datum
    const root = new T.Group(); root.name = 'GRAND TETON';
    const load = id => new Promise(ok => new T.TextureLoader().load(url(id), t => { t.colorSpace = T.SRGBColorSpace; t.anisotropy = Math.min(8, g.maxAnisotropy || 8); ok(t); }, undefined, () => ok(null)));
    const [tFar, tNear, tDetail] = await Promise.all(['far-surface', 'near-surface', 'detail-surface'].map(load));
    // ---------- heightfield@1: the level's near (5.9 m) and detail (2.15 m) grids, decoded as MONOLITH-3 decodes them ----------
    const grid = async id => { const pk = P(id), im = await createImageBitmap(await (await fetch(url(id))).blob()), c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, im.width, im.height).data, w = im.width, h = im.height, H = new Float32Array(w * h); for (let k = 0; k < w * h; k++) H[k] = (d[k * 4] * 256 + d[k * 4 + 1]) * .1 + d[k * 4 + 2] * .02 - 120 + man.frame.base_elev_m - datum;
      const b = pk.bounds, [x0, z0] = toC(b[0], -b[3]), [x1, z1] = toC(b[1], -b[2]);
      return { w, h, H, x0, z0, x1, z1, at(x, z) { const u = (x - x0) / (x1 - x0) * (w - 1), v = (z - z0) / (z1 - z0) * (h - 1); if (u < 0 || v < 0 || u > w - 1 || v > h - 1) return null; const i = Math.min(w - 2, Math.floor(u)), j = Math.min(h - 2, Math.floor(v)), a = u - i, q = v - j;
        return H[j * w + i] * (1 - a) * (1 - q) + H[j * w + i + 1] * a * (1 - q) + H[(j + 1) * w + i] * (1 - a) * q + H[(j + 1) * w + i + 1] * a * q; } }; };
    const [gNear, gDetail, gFar] = await Promise.all([grid('near-height'), grid('detail-height'), grid('far-height')]);
    // the far grid, eased into the trough's island shape at the coast: one height for what is drawn and what is walked outside the near grid
    /* the island as the trough has it (focused): the far grid stands only inside it, its edge eases into the trough's ground there */
    const FR = g.rect ? [Math.max(gFar.x0, g.rect[0]), Math.max(gFar.z0, g.rect[1]), Math.min(gFar.x1, g.rect[2]), Math.min(gFar.z1, g.rect[3])] : [gFar.x0, gFar.z0, gFar.x1, gFar.z1];
    const farAt = (x, z) => { const real = gFar.at(x, z); if (real === null) return null; const lo = g.low ? g.low(x, z) : real, t = Math.min(1, Math.max(0, (lo - 2) / 60)), v = lo * (1 - t) + real * t;
      if (!g.low) return v; const d = Math.min(x - FR[0], FR[2] - x, z - FR[1], FR[3] - z), e = Math.min(1, Math.max(0, d / 1500)), w = e * e * (3 - 2 * e);   /* and into the trough's ground at its outer edge, so the cut-out meets it */
      const f = w >= 1 ? v : lo + (v - lo) * w; return g.shape ? g.shape(x, z, f, 55) : f; };   /* widened by about one far-grid cell, so its 65 m triangles can hold the road */   /* and the archipelago's landings: causeway and ramp */
    const farEdge = (x, z) => { const d = Math.min(x - FR[0], FR[2] - x, z - FR[1], FR[3] - z), e = Math.min(1, Math.max(0, d / 1500)); return e * e * (3 - 2 * e); };
    // feather each finer grid into the ground around it, so there is no wall or drop at its edge: near into the trough's coarse ground over 150 m, detail into near over 25 m
    const feather = (G, edge, outer) => { for (let j = 0; j < G.h; j++) for (let i = 0; i < G.w; i++) { const x = G.x0 + i / (G.w - 1) * (G.x1 - G.x0), z = G.z0 + j / (G.h - 1) * (G.z1 - G.z0), d = Math.min(x - G.x0, G.x1 - x, z - G.z0, G.z1 - z), t = Math.min(1, d / edge), w = t * t * (3 - 2 * t);
        if (w < 1) { const o = outer(x, z); if (o !== null && o !== undefined) G.H[j * G.w + i] = o + (G.H[j * G.w + i] - o) * w; } } };
    feather(gNear, 150, (x, z) => farAt(x, z) ?? (g.coarse ? g.coarse(x, z) : null)); feather(gDetail, 25, (x, z) => gNear.at(x, z));
    const fine = (x, z) => { const d = gDetail.at(x, z); if (d !== null) return d; const n = gNear.at(x, z); return n !== null ? n : farAt(x, z); };
    const fineMesh = (G, tex, stride, holeRect) => { const cw = Math.floor((G.w - 1) / stride) + 1, ch = Math.floor((G.h - 1) / stride) + 1, pos = new Float32Array(cw * ch * 3), uv = new Float32Array(cw * ch * 2), idx = [];
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) { const k = j * cw + i, gi = Math.min(G.w - 1, i * stride), gj = Math.min(G.h - 1, j * stride), x = G.x0 + gi / (G.w - 1) * (G.x1 - G.x0), z = G.z0 + gj / (G.h - 1) * (G.z1 - G.z0);
        pos[k * 3] = x; pos[k * 3 + 1] = G.H[gj * G.w + gi]; pos[k * 3 + 2] = z; uv[k * 2] = gi / (G.w - 1); uv[k * 2 + 1] = 1 - gj / (G.h - 1); }
      for (let j = 0; j < ch - 1; j++) for (let i = 0; i < cw - 1; i++) { const a = j * cw + i; idx.push(a, a + cw, a + 1, a + 1, a + cw, a + cw + 1); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      const mat = new T.MeshLambertMaterial({ map: tex }); if (holeRect) { const hr = new T.Vector4(...holeRect); mat.onBeforeCompile = sh => { sh.uniforms.uHole = { value: hr }; sh.vertexShader = 'varying vec2 vLx;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLx = position.xz;'); sh.fragmentShader = 'uniform vec4 uHole; varying vec2 vLx;\n' + sh.fragmentShader.replace('void main() {', 'void main() { if (vLx.x > uHole.x && vLx.x < uHole.z && vLx.y > uHole.y && vLx.y < uHole.w) discard;'); }; }
      const m = new T.Mesh(geo, mat); m.receiveShadow = m.castShadow = true; return m; };
    root.add(fineMesh(gNear, tNear, 2, [gDetail.x0 + 1, gDetail.z0 + 1, gDetail.x1 - 1, gDetail.z1 - 1]), fineMesh(gDetail, tDetail, 1));
    // ---------- the far grid (801 x 1281, about 30 m): Teton's own range out to the horizon, with its own imagery. It owns all of its rect
    //            outside the near grid (the trough's ground is cut out there), and eases into the trough's island shape at the coast so it never stands as a cliff over the sea ----------
    const FS = 3, fw = Math.floor((gFar.w - 1) / FS) + 1, fh = Math.floor((gFar.h - 1) / FS) + 1, fpos = new Float32Array(fw * fh * 3), fedge = new Float32Array(fw * fh), fuv = new Float32Array(fw * fh * 2), fidx = [];
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const k = j * fw + i, gi = Math.min(gFar.w - 1, i * FS), gj = Math.min(gFar.h - 1, j * FS), x = gFar.x0 + gi / (gFar.w - 1) * (gFar.x1 - gFar.x0), z = gFar.z0 + gj / (gFar.h - 1) * (gFar.z1 - gFar.z0);
      fpos[k * 3] = x; fpos[k * 3 + 1] = farAt(x, z) - .3; fedge[k] = farEdge(x, z); fpos[k * 3 + 2] = z; fuv[k * 2] = gi / (gFar.w - 1); fuv[k * 2 + 1] = 1 - gj / (gFar.h - 1); }
    for (let j = 0; j < fh - 1; j++) for (let i = 0; i < fw - 1; i++) { const a = j * fw + i; fidx.push(a, a + fw, a + 1, a + 1, a + fw, a + fw + 1); }
    { const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(fpos, 3)); geo.setAttribute('uv', new T.BufferAttribute(fuv, 2)); geo.setAttribute('aEdge', new T.BufferAttribute(fedge, 1)); geo.setIndex(fidx); geo.computeVertexNormals();
      const mat = new T.MeshLambertMaterial({ map: tFar }), nr = new T.Vector4(gNear.x0 + g.origin[0], gNear.z0 + g.origin[1], gNear.x1 + g.origin[0], gNear.z1 + g.origin[1]);
      const clip = new T.Vector4(FR[0] + g.origin[0], FR[1] + g.origin[1], FR[2] + g.origin[0], FR[3] + g.origin[1]); mat.onBeforeCompile = sh => { sh.uniforms.uNearR = { value: nr }; sh.uniforms.uClip = { value: clip }; Object.assign(sh.uniforms, SNOW_U); sh.vertexShader = 'attribute float aEdge; varying float vEdge; varying vec3 vFw;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vFw = (modelMatrix * vec4(transformed, 1.0)).xyz; vEdge = aEdge;');
        sh.fragmentShader = SNOW_GLSL + 'uniform vec4 uNearR, uClip; varying vec3 vFw; varying float vEdge;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(vec3(.30, .30, .29), diffuseColor.rgb, vEdge); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.93, .94, .95), tetonSnow(vFw));').replace('void main() {', 'void main() { if (vFw.x < uClip.x || vFw.x > uClip.z || vFw.z < uClip.y || vFw.z > uClip.w) discard; if (vFw.x > uNearR.x && vFw.x < uNearR.z && vFw.z > uNearR.y && vFw.z < uNearR.w) discard;'); };
      const farMesh = new T.Mesh(geo, mat); farMesh.receiveShadow = true; farMesh.name = 'teton-far'; root.add(farMesh); }
    g.fine = fine;
    // ---------- MONOLITH-3's snow on the range (its terrain shader, :1907-1948): a snow line about 920 m above its base, shifted by wash,
    //            aspect and exposure, cut by the mountain-relief gullies and kept off steep faces ----------
    const tRelief = await load('mountain-relief'); if (tRelief) tRelief.colorSpace = T.NoColorSpace;
    const mb = P('mountain-relief').bounds, SNOW_U = { uRelief: { value: tRelief }, uMB: { value: new T.Vector4(mb[0], -mb[2], 1 / (mb[1] - mb[0]), -1 / (mb[3] - mb[2])) }, uLoc: { value: new T.Vector2(W0 - g.origin[0], -N0 - g.origin[1]) }, uLift: { value: lift } };
    const SNOW_GLSL = `uniform sampler2D uRelief; uniform vec4 uMB; uniform vec2 uLoc; uniform float uLift;
      float tHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float tNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(tHash(i), tHash(i + vec2(1, 0)), f.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), f.x), f.y); }
      float tetonSnow(vec3 w) { vec3 p = vec3(w.x + uLoc.x, w.y - uLift, w.z + uLoc.y); vec3 n = normalize(cross(dFdx(w), dFdy(w))); if (n.y < 0.) n = -n; float slope = 1. - n.y;
        float wash = tNoise(vec2(p.x * .005 + 2., p.z * .006)) * .7 + tNoise(vec2(p.x * .013, p.z * .015)) * .3; float alpine = smoothstep(255., 800., p.y);
        vec2 mUV = (p.xz - uMB.xy) * uMB.zw; float inF = step(0., mUV.x) * step(mUV.x, 1.) * step(0., mUV.y) * step(mUV.y, 1.); vec3 relief = texture2D(uRelief, mUV).rgb;
        float leftExposure = smoothstep(2200., 6400., p.z), snowHeight = 920. + 300. * (wash - .5) - 270. * n.z - 290. * leftExposure + 190. * smoothstep(2000., 4200., -p.z);
        float snowBase = smoothstep(snowHeight - 90., snowHeight + 345., p.y), crack = mix(.62, relief.r * .66 - relief.b * .32 + .40, alpine * inF * .9);
        return snowBase * smoothstep(.48, .70, crack) * (1. - smoothstep(.43, .89, slope)); }\n`;
    // ---------- the drape: NAIP imagery on the trough's ground, each grid at its own resolution, blended at their seams ----------
    const rect = id => { const b = P(id).bounds, [x0, z0] = toC(b[0], -b[3]), [x1, z1] = toC(b[1], -b[2]); return new T.Vector4(x0 + g.origin[0], z0 + g.origin[1], x1 + g.origin[0], z1 + g.origin[1]); };
    const U = { tFar: { value: tFar }, tNear: { value: tNear }, tDetail: { value: tDetail }, rFar: { value: rect('far-surface') }, rNear: { value: rect('near-surface') }, rDetail: { value: rect('detail-surface') } };
    const ground = new T.MeshLambertMaterial({ color: '#ffffff' });
    ground.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, SNOW_U);
      sh.vertexShader = 'varying vec3 vTw;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vTw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = SNOW_GLSL + `uniform sampler2D tFar, tNear, tDetail; uniform vec4 rFar, rNear, rDetail; varying vec3 vTw;
        vec2 uvIn(vec4 r) { return vec2((vTw.x - r.x) / (r.z - r.x), 1.0 - (vTw.z - r.y) / (r.w - r.y)); }
        float inside(vec4 r, float edge) { vec2 d = min(vTw.xz - r.xy, r.zw - vTw.xz); return smoothstep(0.0, edge, min(d.x, d.y)); }\n` + sh.fragmentShader.replace('void main() {', 'void main() { if (vTw.x > rNear.x + 2.0 && vTw.x < rNear.z - 2.0 && vTw.z > rNear.y + 2.0 && vTw.z < rNear.w - 2.0) discard;').replace('#include <map_fragment>', `#include <map_fragment>
        vec3 c = texture2D(tFar, uvIn(rFar)).rgb; c = mix(c, texture2D(tNear, uvIn(rNear)).rgb, inside(rNear, 120.0)); c = mix(c, texture2D(tDetail, uvIn(rDetail)).rgb, inside(rDetail, 25.0));
        diffuseColor.rgb = mix(c, vec3(.93, .94, .95), tetonSnow(vTw));`); };
    ground.customProgramCacheKey = () => 'teton-naip-drape-1';
    // ---------- the Snake River, at its own level, wherever that level stands above the ground ----------
    const rv = P('river-level'), [gw, gh] = rv.grid, lev = new Float32Array(await (await fetch(url('river-level'))).arrayBuffer()), rb = rv.bounds;
    { const pos = [], idx = [], wet = [], [x0, z0] = toC(rb[0], -rb[3]), [x1, z1] = toC(rb[1], -rb[2]), dx = (x1 - x0) / (gw - 1), dz = (z1 - z0) / (gh - 1);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const x = x0 + i * dx, z = z0 + j * dz, y = lev[j * gw + i] + lift, gy = g.H(x, z); pos.push(x, Math.max(y, gy + .12), z); wet.push(y > gy - .25); }
      for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) { const a = j * gw + i, b = a + 1, c = a + gw, d = c + 1; if (wet[a] || wet[b] || wet[c] || wet[d]) idx.push(a, c, b, b, c, d); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const river = new T.Mesh(geo, new T.MeshPhongMaterial({ color: '#2a6688', specular: '#cfe8ff', shininess: 70, transparent: true, opacity: .9 })); river.receiveShadow = true; river.name = 'snake-river'; root.add(river);
      root.userData.wetAt = (x, z) => { const i = Math.round((x - x0) / dx), j = Math.round((z - z0) / dz); return i >= 0 && j >= 0 && i < gw && j < gh && wet[j * gw + i]; }; }
    // ---------- the forest, as MONOLITH-3 plants it: every surveyed crown, its species chosen by height through the level's own seeded
    //            stream (seedRandom 77269), drawn with the level's own billboard shader over its 12-species crown atlas (crowns.webp) ----------
    { const cr = new Float32Array(await (await fetch(url('crown-positions'))).arrayBuffer()), td = await (await fetch(url('terrain-data'))).json(), ratios = td.crownRatios;
      let sd = 77269; const random = () => (sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296;
      const list = [];
      for (let i = 0; i < cr.length; i += 5) { const lx = cr[i], lz = cr[i + 2], raw = cr[i + 3], cover = cr[i + 4]; const [x, z] = toC(lx, lz);
        if (root.userData.wetAt(x, z) || random() < .19) continue;
        if ((lx > -450 && lx < -205 && Math.abs(lz + 54) < 9) || (lx > -120 && lx < -12 && lz > -180 && lz < 15)) continue;   /* the road and the overlook clearing, kept open as the level keeps them */
        const h = Math.min(raw, 27) * (.86 + .13 * random()), id = h > 10 ? (random() < .70 ? 0 : 3) : h > 6 ? (random() < .51 ? 10 : 6) : 8;
        list.push([x, (fine(x, z) ?? g.H(x, z)), z, h, h * ratios[id] * (.71 + cover * .19), id + random() * .995]); }
      const tCrowns = await load('crowns'); tCrowns.colorSpace = T.NoColorSpace;
      const mat = new T.ShaderMaterial({ uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { uCrowns: { value: null }, uTime: { value: 0 }, uSun: { value: new T.Vector3(.4, .8, .3) } }]), fog: true, side: T.DoubleSide,
        vertexShader: `attribute float aSeed; varying vec2 vUV; varying vec3 vBase; varying float vSeed; uniform float uTime;
          #include <fog_pars_vertex>
          void main(){ vec3 root=(modelMatrix*vec4(instanceMatrix[3].xyz,1.)).xyz;   /* the level draws in world space; here the can sits at its island's corner */ vec3 facing=normalize(vec3(cameraPosition.x-root.x,0.,cameraPosition.z-root.z)); vec3 right=vec3(facing.z,0.,-facing.x);
            float width=length(instanceMatrix[0].xyz); float height=length(instanceMatrix[1].xyz); float sway=sin(uTime*1.11+root.x*.04+root.z*.03)*.021*uv.y*uv.y;
            vec3 world=root+right*((position.x+sway)*width)+vec3(0.,uv.y*height,0.); vUV=uv; vBase=root; vSeed=aSeed;
            vec4 mvPosition=viewMatrix*vec4(world,1.); gl_Position=projectionMatrix*mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `varying vec2 vUV; varying vec3 vBase; varying float vSeed; uniform sampler2D uCrowns; uniform vec3 uSun;
          #include <fog_pars_fragment>
          void main(){ float species=floor(vSeed); float seed=fract(vSeed); vec2 tile=vec2(floor(seed*4.),11.-species);
            vec4 sampleColor=texture2D(uCrowns,(tile+vUV*.972+.014)/vec2(4.,12.)); if(sampleColor.a<.32)discard;
            float trunk=(.018+.27*pow(clamp(sampleColor.r/max(.16,sampleColor.a),0.,1.),1.5));
            float value=trunk*(.34+.48*clamp(uSun.y*1.2,0.,1.)+.39*vUV.y)*(.74+.44*seed);   /* the level's own crown shading; the trough's light replaces its storm window */
            gl_FragColor=vec4(vec3(value)*vec3(.86,1.,.84),1.);
            #include <fog_fragment>
          }` });
      mat.uniforms.uCrowns.value = tCrowns;
      const geo = new T.PlaneGeometry(1, 1); geo.translate(0, .5, 0); const mesh = new T.InstancedMesh(geo, mat, list.length), o = new T.Object3D(), seed = new Float32Array(list.length);
      list.forEach(([x, y, z, h, w, mark], k) => { o.position.set(x, y - .06, z); o.scale.set(w, h, 1); o.updateMatrix(); mesh.setMatrixAt(k, o.matrix); seed[k] = mark; });
      geo.setAttribute('aSeed', new T.InstancedBufferAttribute(seed, 1)); mesh.frustumCulled = false; mesh.name = 'teton-forest'; root.add(mesh); root.userData.crowns = list.length; root.userData.forestMat = mat; }
    // ---------- landmarks, and the level's own camera (so the level and the trough can be compared from the same eye) ----------
    const cam = man.packets.find(p => p.id === 'terrain-data') ? (await (await fetch(url('terrain-data'))).json()).camera : null;
    const [ex, ez] = toC(-46.3, 1.4), landmarks = { overlook: { x: ex, z: ez }, river: (() => { const [x, z] = toC(-1200, 300); return { x, z }; })() };
    if (cam) { const [cx, cz] = toC(cam.eye[0], cam.eye[2]); landmarks.levelCamera = { x: cx, z: cz, y: cam.eye[1] + lift, heading: cam.heading, pitch: cam.pitch, fov: cam.fov }; }
    const cb = P('crown-positions').bounds, [hx0, hz0] = toC(cb[0], -cb[3]), [hx1, hz1] = toC(cb[1], -cb[2]);
    const nr = [gNear.x0, gNear.z0, gNear.x1, gNear.z1];
    return { root, landmarks, farRect: FR, heights: { rect: FR, at: fine }, floraHole: [hx0, hz0, hx1, hz1], materials: { ground: { material: ground } }, update(dt, t) { const fm = root.userData.forestMat; if (fm) { fm.uniforms.uTime.value = t || 0; if (g.sunDir) fm.uniforms.uSun.value.copy(g.sunDir()); } }, dispose() { root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); for (const t of [tFar, tNear, tDetail]) if (t) t.dispose(); } };
  }
  window.TetonCan = { create };
})();
