/* Expedition & 2086 Night Post Human Cast — Donkey-Method Orthographic Texture Projection,
   Sculpted SkinnedMesh, Diegetic Cyan Uplight Props & Multi-Actor Village Choreography.
   Built on the Catmull-Rom refine + loft + Gaussian sculpt + onBeforeCompile projection +
   2-Bone Analytic IK architecture of donkey/donkey.js and aligned to ZZlDs10FCZk & World Bible plates.
   Exposes window.makeExpeditionCharacter(THREE, spec) and window.makeExpeditionCast(THREE, opts). */
(function () {
  "use strict";

  // Capture script URL synchronously at evaluation time so ../donkey/textures/*.jpg resolves
  // with zero 404s whether loaded from /night-post/, /zones/, /study/, or /donkey/.
  const SCRIPT_SRC = (typeof document !== "undefined" && document.currentScript && document.currentScript.src) || "";

  function resolveDonkeyBase(overrideBase) {
    if (overrideBase) return overrideBase.endsWith("/") ? overrideBase : overrideBase + "/";
    if (SCRIPT_SRC) {
      try {
        return new URL("./", SCRIPT_SRC).href;
      } catch (e) {
        const clean = SCRIPT_SRC.split("?")[0].split("#")[0];
        return clean.slice(0, clean.lastIndexOf("/") + 1);
      }
    }
    if (typeof location !== "undefined" && location.pathname) {
      const p = location.pathname;
      if (p.indexOf("/night-post/") >= 0 || p.indexOf("/zones/") >= 0 || p.indexOf("/study/") >= 0) {
        return "../donkey/";
      }
    }
    return "./";
  }

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const frac = x => x - Math.floor(x);
  const hash = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const h = (a, b) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
  };
  const fbm = (x, y, oct = 4) => {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) {
      s += a * vnoise(x * f, y * f);
      f *= 2.03;
      a *= 0.5;
    }
    return s;
  };
  const g1 = (x, c, w) => { const d = (x - c) / w; return Math.exp(-d * d); };
  const g2 = (x, y, cx, cy, wx, wy) => {
    const dx = (x - cx) / wx, dy = (y - cy) / (wy || wx);
    return Math.exp(-(dx * dx + dy * dy));
  };

  /* ---------- Catmull-Rom Ring Refinement & Anatomical Vertical Loft ---------- */
  function catmull(a, b, c, d, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  }

  function refineRings(rings, sub) {
    if (rings.length < 3 || sub <= 1) return rings;
    const keys = Object.keys(rings[0]).filter(k => k !== "p" && typeof rings[0][k] === "number");
    const get = i => rings[clamp(i, 0, rings.length - 1)];
    const out = [];
    for (let i = 0; i < rings.length - 1; i++) {
      const n = i === 0 || i === rings.length - 2 ? sub + 1 : sub;
      const A = get(i - 1), B = get(i), C = get(i + 1), D = get(i + 2);
      for (let s = 0; s < n; s++) {
        const u = s / n;
        const r = { p: [0, 1, 2].map(k => catmull(A.p[k], B.p[k], C.p[k], D.p[k], u)) };
        for (const k of keys) {
          const v = catmull(A[k], B[k], C[k], D[k], u);
          r[k] = (k === "w" || k === "f" || k === "b") ? Math.max(0.0012, v) : v;
        }
        out.push(r);
      }
    }
    out.push(rings[rings.length - 1]);
    return out;
  }

  /* Vertical anatomical loft: rings ordered from bottom (-Y) to top (+Y) so outward normals
     are strictly counter-clockwise on FrontSide. Populates Donkey-Method aOrthoPos & aOrthoNrm. */
  function loftY(T, rings, o = {}) {
    const seg = o.seg || 28, n = rings.length, cols = seg + 1;
    const pos = [], uv = [], col = o.color ? [] : null, si = o.skin ? [] : null, sw = o.skin ? [] : null, idx = [];
    const orthoP = [];
    const ur = o.ur || 2, vr = o.vr || 3;
    const normX = o.normX || 1.0;
    const defW = o.orthoWeight !== undefined ? o.orthoWeight : 1.0;

    for (let i = 0; i < n; i++) {
      const r = rings[i], e = r.e || 1.0, v = i / Math.max(1, n - 1);
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * TAU, sa = Math.sin(a), ca = Math.cos(a);
        const w = r.tw !== undefined ? lerp(r.bw !== undefined ? r.bw : r.w, r.tw, 0.5 + 0.5 * ca) : r.w;
        const rz = ca >= 0 ? r.f : r.b;
        let lx = Math.sign(sa) * Math.pow(Math.abs(sa), e) * w;
        let lz = Math.sign(ca) * Math.pow(Math.abs(ca), e) * rz;
        let ly = 0;
        if (o.disp) {
          const d = o.disp(r, sa, ca, v, a);
          lx *= d; lz *= d;
        }
        if (o.sculpt) {
          const s = o.sculpt(r, lx, lz, sa, ca, v);
          lx += s[0]; ly += s[1]; lz += s[2];
        }
        const px = r.p[0] + lx, py = r.p[1] + ly, pz = r.p[2] + lz;
        pos.push(px, py, pz);
        uv.push((j / seg) * ur, v * vr);

        if (o.orthoMap) {
          const om = o.orthoMap(r, px, py, pz, sa, ca, v);
          orthoP.push(om[0], om[1], om[2], om[3]);
        } else {
          const ow = o.orthoWeightOf ? o.orthoWeightOf(r, sa, ca, v, px, py, pz) : defW;
          orthoP.push(px / normX, py, pz, ow);
        }

        if (col) {
          const c = o.color(r, sa, ca, v, lx, lz);
          if (Array.isArray(c)) col.push(c[0], c[1], c[2]);
          else col.push(c, c, c);
        }
        if (si) {
          const sk = o.skin(r, sa, ca, v, lx, lz);
          if (sk && sk.indices && sk.weights) {
            si.push(sk.indices[0] | 0, sk.indices[1] | 0, sk.indices[2] | 0, sk.indices[3] | 0);
            sw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
          } else {
            const b0 = sk[0] | 0, b1 = sk[1] | 0, wt = clamp(sk[2], 0, 1);
            const b2 = sk.length > 3 ? (sk[3] | 0) : 0, wt2 = sk.length > 4 ? clamp(sk[4], 0, 1) : 0;
            const rem = Math.max(0, 1 - wt2);
            si.push(b0, b1, b2, 0);
            sw.push(wt * rem, (1 - wt) * rem, wt2, 0);
          }
        }
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const A = i * cols + j, B = A + 1, C = A + cols, D = C + 1;
        idx.push(A, B, C, B, D, C);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    if (col) g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    if (si) {
      g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
      g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    }
    g.setIndex(idx);
    g.computeVertexNormals();
    // Average seam normals at j=0 / j=seg so cylindrical wrap has zero lighting crease
    const N = g.attributes.normal;
    for (let i = 0; i < n; i++) {
      const a0 = i * cols, a1 = a0 + seg;
      const nx = N.getX(a0) + N.getX(a1), ny = N.getY(a0) + N.getY(a1), nz = N.getZ(a0) + N.getZ(a1);
      const nl = Math.hypot(nx, ny, nz) || 1;
      N.setXYZ(a0, nx / nl, ny / nl, nz / nl);
      N.setXYZ(a1, nx / nl, ny / nl, nz / nl);
    }
    g.setAttribute("aOrthoPos", new T.Float32BufferAttribute(orthoP, 4));
    g.setAttribute("aOrthoNrm", new T.Float32BufferAttribute(Float32Array.from(N.array), 3));
    return g;
  }

  /* Open-front draped coat / shawl loft (a from a0 to a1, double-walled with real cloth thickness
     and outward-consistent Donkey-Method projection attributes on both shell & lining) */
  function loftOpenGarment(T, rings, o = {}) {
    const seg = o.seg || 30, n = rings.length, cols = seg + 1;
    const a0 = o.a0 !== undefined ? o.a0 : 0.42;
    const a1 = o.a1 !== undefined ? o.a1 : TAU - 0.42;
    const thick = o.thick || 0.012;
    const pos = [], uv = [], col = o.color ? [] : null, si = o.skin ? [] : null, sw = o.skin ? [] : null, idx = [];
    const orthoP = [];
    const ur = o.ur || 3, vr = o.vr || 3;
    const normX = o.normX || 1.0;
    const defW = o.orthoWeight !== undefined ? o.orthoWeight : 1.0;

    for (let layer = 0; layer < 2; layer++) {
      const sh = layer === 0 ? 0 : -thick;
      for (let i = 0; i < n; i++) {
        const r = rings[i], e = r.e || 1.0, v = i / Math.max(1, n - 1);
        const effA0 = o.a0Of ? o.a0Of(r, v) : a0;
        const effA1 = o.a1Of ? o.a1Of(r, v) : (o.a0Of ? (TAU - effA0) : a1);
        for (let j = 0; j <= seg; j++) {
          const u = j / seg, a = lerp(effA0, effA1, u), sa = Math.sin(a), ca = Math.cos(a);
          const rz = ca >= 0 ? r.f : r.b;
          let lx = Math.sign(sa) * Math.pow(Math.abs(sa), e) * (r.w + sh);
          let lz = Math.sign(ca) * Math.pow(Math.abs(ca), e) * (rz + sh);
          let ly = 0;
          if (o.fold) {
            const fd = o.fold(r, u, v, sa, ca);
            lx += sa * fd;
            lz += ca * fd;
          }
          if (o.sculpt) {
            const sc = o.sculpt(r, u, v, sa, ca, layer);
            lx += sc[0]; ly += sc[1]; lz += sc[2];
          }
          let px = r.p[0] + lx, py = r.p[1] + ly, pz = r.p[2] + lz;
          if (o.bustGuard) {
            const gd = o.bustGuard(px, py, pz, a, u, v, layer);
            px = gd[0]; py = gd[1]; pz = gd[2];
          }
          pos.push(px, py, pz);
          uv.push(u * ur, v * vr);
          const baseOw = o.orthoWeightOf ? o.orthoWeightOf(r, u, v, sa, ca, py) : defW;
          const ow = baseOw * (layer === 0 ? 1.0 : 0.42);
          const neckPinch = 1 - 0.26 * smooth(1.30, 1.465, py);
          orthoP.push((px / normX) * neckPinch, py, pz, ow);

          if (col) {
            const c = o.color(r, u, v, sa, ca, layer);
            if (Array.isArray(c)) col.push(c[0], c[1], c[2]);
            else col.push(c * (layer ? 0.72 : 1), c * (layer ? 0.72 : 1), c * (layer ? 0.72 : 1));
          }
          if (si) {
            const sk = o.skin(r, sa, ca, v, u, px, py, pz);
            if (sk && sk.indices && sk.weights) {
              si.push(sk.indices[0] | 0, sk.indices[1] | 0, sk.indices[2] | 0, sk.indices[3] | 0);
              sw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
            } else {
              const b0 = sk[0] | 0, b1 = sk[1] | 0, wt = clamp(sk[2], 0, 1);
              const b2 = sk.length > 3 ? (sk[3] | 0) : 0, wt2 = sk.length > 4 ? clamp(sk[4], 0, 1) : 0;
              const rem = Math.max(0, 1 - wt2);
              si.push(b0, b1, b2, 0);
              sw.push(wt * rem, (1 - wt) * rem, wt2, 0);
            }
          }
        }
      }
    }
    const stride = n * cols;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const A = i * cols + j, B = A + 1, C = A + cols, D = C + 1;
        idx.push(A, B, C, B, D, C);
        const Ai = stride + A, Bi = stride + B, Ci = stride + C, Di = stride + D;
        idx.push(Ai, Ci, Bi, Bi, Ci, Di);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const L0 = i * cols, L1 = (i + 1) * cols, Li0 = stride + L0, Li1 = stride + L1;
      idx.push(L0, L1, Li0, L1, Li1, Li0);
      const R0 = i * cols + seg, R1 = (i + 1) * cols + seg, Ri0 = stride + R0, Ri1 = stride + R1;
      idx.push(R0, Ri0, R1, R1, Ri0, Ri1);
    }
    for (let j = 0; j < seg; j++) {
      const B0 = j, B1 = j + 1, Bi0 = stride + B0, Bi1 = stride + B1;
      idx.push(B0, Bi0, B1, B1, Bi0, Bi1);
      const T0 = (n - 1) * cols + j, T1 = T0 + 1, Ti0 = stride + T0, Ti1 = stride + T1;
      idx.push(T0, T1, Ti0, T1, Ti1, Ti0);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    if (col) g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    if (si) {
      g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
      g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    }
    g.setIndex(idx);
    g.computeVertexNormals();
    // Copy outer shell outward normals onto inner lining for ortho projection so inner back never samples front!
    const nArr = Float32Array.from(g.attributes.normal.array);
    for (let k = 0; k < stride; k++) {
      nArr[(stride + k) * 3]     = nArr[k * 3];
      nArr[(stride + k) * 3 + 1] = nArr[k * 3 + 1];
      nArr[(stride + k) * 3 + 2] = nArr[k * 3 + 2];
    }
    g.setAttribute("aOrthoPos", new T.Float32BufferAttribute(orthoP, 4));
    g.setAttribute("aOrthoNrm", new T.Float32BufferAttribute(nArr, 3));
    return g;
  }

  function mergeSkinnedGeos(T, geos) {
    let vCount = 0;
    for (const g of geos) vCount += g.attributes.position.count;
    const pos = new Float32Array(vCount * 3);
    const nrm = new Float32Array(vCount * 3);
    const uvs = new Float32Array(vCount * 2);
    const col = new Float32Array(vCount * 3);
    const ski = new Uint16Array(vCount * 4);
    const skw = new Float32Array(vCount * 4);
    const orP = new Float32Array(vCount * 4);
    const orN = new Float32Array(vCount * 3);
    const idx = [];
    let vo = 0;
    for (const g of geos) {
      const p = g.attributes.position.array;
      const n = g.attributes.normal.array;
      const u = g.attributes.uv ? g.attributes.uv.array : null;
      const c = g.attributes.color ? g.attributes.color.array : null;
      const si = g.attributes.skinIndex ? g.attributes.skinIndex.array : null;
      const sw = g.attributes.skinWeight ? g.attributes.skinWeight.array : null;
      const op = g.attributes.aOrthoPos ? g.attributes.aOrthoPos.array : null;
      const on = g.attributes.aOrthoNrm ? g.attributes.aOrthoNrm.array : null;
      const cnt = g.attributes.position.count;
      pos.set(p, vo * 3);
      nrm.set(n, vo * 3);
      if (u) uvs.set(u, vo * 2);
      if (c) col.set(c, vo * 3);
      else col.fill(1, vo * 3, (vo + cnt) * 3);
      if (si) ski.set(si, vo * 4);
      if (sw) skw.set(sw, vo * 4);
      else for (let k = 0; k < cnt; k++) skw[(vo + k) * 4] = 1;
      if (op) orP.set(op, vo * 4);
      if (on) orN.set(on, vo * 3);
      else orN.set(n, vo * 3);
      if (g.index) {
        const gi = g.index.array;
        for (let k = 0; k < gi.length; k++) idx.push(gi[k] + vo);
      } else {
        for (let k = 0; k < cnt; k++) idx.push(vo + k);
      }
      vo += cnt;
    }
    const out = new T.BufferGeometry();
    out.setAttribute("position", new T.BufferAttribute(pos, 3));
    out.setAttribute("normal", new T.BufferAttribute(nrm, 3));
    out.setAttribute("uv", new T.BufferAttribute(uvs, 2));
    out.setAttribute("color", new T.BufferAttribute(col, 3));
    out.setAttribute("skinIndex", new T.BufferAttribute(ski, 4));
    out.setAttribute("skinWeight", new T.BufferAttribute(skw, 4));
    out.setAttribute("aOrthoPos", new T.BufferAttribute(orP, 4));
    out.setAttribute("aOrthoNrm", new T.BufferAttribute(orN, 3));
    out.setIndex(idx);
    return out;
  }

  function roundedBox(T, x, y, z, r, s = 3) {
    const g = new T.BoxGeometry(x, y, z, s * 2, s * 2, s * 2), p = g.attributes.position;
    const hx = Math.max(0.0005, x / 2 - r), hy = Math.max(0.0005, y / 2 - r), hz = Math.max(0.0005, z / 2 - r);
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const cx = clamp(vx, -hx, hx), cy = clamp(vy, -hy, hy), cz = clamp(vz, -hz, hz);
      const dx = vx - cx, dy = vy - cy, dz = vz - cz, l = Math.hypot(dx, dy, dz);
      if (l > 1e-5) p.setXYZ(i, cx + (dx / l) * r, cy + (dy / l) * r, cz + (dz / l) * r);
    }
    g.computeVertexNormals();
    return g;
  }

  /* ---------- Donkey-Method onBeforeCompile Multi-View Orthographic Projection Shader ---------- */
  function loadOrthoPlate(T, url, isAlpha = false) {
    const tex = new T.TextureLoader().load(url);
    tex.colorSpace = isAlpha && T.SRGBColorSpace ? T.SRGBColorSpace : T.NoColorSpace;
    tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
    tex.minFilter = T.LinearFilter;
    tex.magFilter = T.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  /* Weighted 3D-to-2D affine portrait landmark solver (ported from donkey.js fitPortrait)
     aligning sculpted human head landmarks (eyes, brows, nose tip, alae, mouth seam, chin, cheeks)
     to the 512x512 #424242 bleed-padded carrier_head.jpg orthographic portrait plate. */
  let cachedPortraitFit = null;
  function getHumanPortraitFit(T) {
    if (cachedPortraitFit) return cachedPortraitFit;
    const L = [
      [ 0.0305, 1.6160, 0.086, 297, 204, 12], // Left eye (viewer right)
      [-0.0305, 1.6160, 0.086, 215, 204, 12], // Right eye (viewer left)
      [ 0.0000, 1.6340, 0.098, 256, 182,  5], // Glabella / brow ridge
      [ 0.0000, 1.5840, 0.118, 256, 262,  8], // Nose tip
      [ 0.0170, 1.5820, 0.102, 282, 266,  4], // Left nostril wing
      [-0.0170, 1.5820, 0.102, 230, 266,  4], // Right nostril wing
      [ 0.0000, 1.5565, 0.102, 256, 304, 10], // Lip seam center
      [ 0.0000, 1.5220, 0.098, 256, 360,  6], // Chin pad
      [ 0.0560, 1.5920, 0.068, 334, 240,  3], // Left malar cheekbone
      [-0.0560, 1.5920, 0.068, 178, 240,  3], // Right malar cheekbone
      [ 0.0000, 1.6680, 0.086, 256, 118,  4]  // Forehead center
    ];
    const A = [0, 1, 2, 3].map(() => [0, 0, 0, 0, 0, 0]);
    for (const q of L) {
      const x = [q[0], q[1], q[2], 1];
      const wt = q[5] || 1;
      const uTarget = q[3] / 512;
      const vTarget = 1 - q[4] / 512;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) A[i][j] += wt * x[i] * x[j];
        A[i][4] += wt * x[i] * uTarget;
        A[i][5] += wt * x[i] * vTarget;
      }
    }
    // Mild Tikhonov regularization on Z since portrait is near-frontal orthographic
    A[2][2] += 0.0025;
    for (let i = 0; i < 4; i++) {
      let m = i;
      for (let k = i + 1; k < 4; k++) if (Math.abs(A[k][i]) > Math.abs(A[m][i])) m = k;
      [A[i], A[m]] = [A[m], A[i]];
      const piv = Math.abs(A[i][i]) > 1e-9 ? A[i][i] : 1e-9;
      for (let k = 0; k < 4; k++) {
        if (k !== i) {
          const f = A[k][i] / piv;
          for (let j = i; j < 6; j++) A[k][j] -= f * A[i][j];
        }
      }
    }
    const U = A.map((r, i) => r[4] / r[i]);
    const V = A.map((r, i) => r[5] / r[i]);
    let err = 0;
    for (const q of L) {
      const pu = (U[0] * q[0] + U[1] * q[1] + U[2] * q[2] + U[3]) * 512;
      const pv = (1 - (V[0] * q[0] + V[1] * q[1] + V[2] * q[2] + V[3])) * 512;
      err += Math.hypot(pu - q[3], pv - q[4]);
    }
    cachedPortraitFit = {
      hU: new T.Vector4(U[0], U[1], U[2], U[3]),
      hV: new T.Vector4(V[0], V[1], V[2], V[3]),
      meanPixelError: err / L.length
    };
    return cachedPortraitFit;
  }

  /* Tri-view normal-weighted orthographic projection + landmark-fitted head portrait projection +
     woven cloth micro-grain + grazing rim sheen + smartphone/jerrycan cyan face/shawl uplight bounce */
  function applyDonkeyOrthoShader(T, mat, cfg) {
    const portraitFit = getHumanPortraitFit(T);
    const uOrthoCfg = {
      value: new T.Vector4(
        cfg.photoMix !== undefined ? cfg.photoMix : 0.24,
        cfg.chromaMix !== undefined ? cfg.chromaMix : 0.45,
        cfg.lumContrast !== undefined ? cfg.lumContrast : 0.88,
        cfg.headMode ? 1.0 : 0.0
      )
    };
    const uStyleVec = {
      value: new T.Vector4(
        cfg.rimSheen !== undefined ? cfg.rimSheen : 0.06,
        cfg.weaveGrain !== undefined ? cfg.weaveGrain : 0.85,
        cfg.beardKeep !== undefined ? cfg.beardKeep : 0.0,
        cfg.uSpan !== undefined ? cfg.uSpan : 0.43
      )
    };
    const plates = cfg.plates;
    const cyanGlow = cfg.cyanGlow;

    mat.onBeforeCompile = sh => {
      sh.uniforms.tFront = { value: plates.front };
      sh.uniforms.tSide = { value: plates.side };
      sh.uniforms.tBack = { value: plates.back };
      sh.uniforms.tHead = { value: plates.head };
      sh.uniforms.uOrthoCfg = uOrthoCfg;
      sh.uniforms.uStyleVec = uStyleVec;
      sh.uniforms.uCyanGlow = cyanGlow;
      sh.uniforms.uHeadU = { value: portraitFit.hU };
      sh.uniforms.uHeadV = { value: portraitFit.hV };

      sh.vertexShader =
        "attribute vec4 aOrthoPos;\nattribute vec3 aOrthoNrm;\nvarying vec4 vOrthoPos;\nvarying vec3 vOrthoNrm;\nvarying vec3 vBindRaw;\nvarying vec2 vClothUv;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvOrthoPos = aOrthoPos;\nvOrthoNrm = aOrthoNrm;\nvBindRaw = position;\nvClothUv = uv;"
        );

      sh.fragmentShader =
        "uniform sampler2D tFront, tSide, tBack, tHead;\nuniform vec4 uOrthoCfg;\nuniform vec4 uStyleVec;\nuniform vec4 uCyanGlow;\nuniform vec4 uHeadU;\nuniform vec4 uHeadV;\nvarying vec4 vOrthoPos;\nvarying vec3 vOrthoNrm;\nvarying vec3 vBindRaw;\nvarying vec2 vClothUv;\n" +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "if (vOrthoPos.w > 0.001) {\n" +
            "  vec3 bn = normalize(vOrthoNrm + vec3(vOrthoPos.x * 0.28, 0.0, vOrthoPos.z >= 0.0 ? 0.14 : -0.14));\n" +
            "  float wF = pow(max(0.0, bn.z), 1.85);\n" +
            "  float wB = pow(max(0.0, -bn.z), 1.85);\n" +
            "  float wS = pow(abs(bn.x), 1.85);\n" +
            "  float wSum = max(0.0001, wF + wB + wS);\n" +
            "  wF /= wSum; wB /= wSum; wS /= wSum;\n" +
            "  float uSpan = uStyleVec.w;\n" +
            "  float vy = clamp(0.048 + vOrthoPos.y * 0.5178, 0.052, 0.948);\n" +
            "  vec2 uvF = vec2(clamp(0.5 - vOrthoPos.x * 1.16, 0.5 - uSpan, 0.5 + uSpan), vy);\n" +
            "  vec2 uvB = vec2(clamp(0.5 + vOrthoPos.x * 1.16, 0.5 - uSpan, 0.5 + uSpan), vy);\n" +
            "  vec2 uvS = vec2(clamp(0.5 - vOrthoPos.z * 1.18, 0.30, 0.70), vy);\n" +
            "  vec3 sRawF = texture2D(tFront, uvF).rgb;\n" +
            "  vec3 sRawS = texture2D(tSide,  uvS).rgb;\n" +
            "  vec3 sRawB = texture2D(tBack,  uvB).rgb;\n" +
            "  // Reject #424242 (0.2588 sRGB) background bleed at grazing cloth silhouette edges!\n" +
            "  float valF = smoothstep(0.018, 0.065, length(sRawF - vec3(0.2588)));\n" +
            "  float valS = smoothstep(0.018, 0.065, length(sRawS - vec3(0.2588)));\n" +
            "  float valB = smoothstep(0.018, 0.065, length(sRawB - vec3(0.2588)));\n" +
            "  vec3 cF = pow(max(vec3(0.001), sRawF), vec3(2.2));\n" +
            "  vec3 cS = pow(max(vec3(0.001), sRawS), vec3(2.2));\n" +
            "  vec3 cB = pow(max(vec3(0.001), sRawB), vec3(2.2));\n" +
            "  float wfV = wF * valF, wsV = wS * valS, wbV = wB * valB;\n" +
            "  float wValSum = wfV + wsV + wbV;\n" +
            "  vec3 pCol = wValSum > 0.002 ? (cF * wfV + cS * wsV + cB * wbV) / wValSum : diffuseColor.rgb;\n" +
            "  float validAny = clamp(wValSum / max(0.0001, wF + wS + wB), 0.0, 1.0);\n" +
            "  if (uOrthoCfg.w > 0.5 && vOrthoPos.y > 1.44) {\n" +
            "    float hW = smoothstep(0.14, 0.62, bn.z) * smoothstep(1.44, 1.495, vOrthoPos.y) * (1.0 - smoothstep(1.665, 1.705, vOrthoPos.y));\n" +
            "    vec4 hp = vec4(vOrthoPos.xyz, 1.0);\n" +
            "    vec2 uvH = clamp(vec2(dot(uHeadU, hp), dot(uHeadV, hp)), vec2(0.22, 0.14), vec2(0.78, 0.88));\n" +
            "    vec3 cH = pow(max(vec3(0.001), texture2D(tHead, uvH).rgb), vec3(2.2));\n" +
            "    if (uStyleVec.z < 0.5) {\n" +
            "      float beardZone = (1.0 - smoothstep(1.510, 1.578, vOrthoPos.y)) * (1.0 - 0.55 * (1.0 - smoothstep(0.008, 0.018, abs(vOrthoPos.y - 1.5565))));\n" +
            "      cH = mix(cH, max(cH, vec3(0.165, 0.094, 0.060)), beardZone * 0.90);\n" +
            "    }\n" +
            "    pCol = mix(pCol, cH, hW);\n" +
            "  }\n" +
            "  float pLum = dot(pCol, vec3(0.299, 0.587, 0.114));\n" +
            "  vec3 pChroma = clamp(pCol / max(pLum, 0.022), vec3(0.42), vec3(1.92));\n" +
            "  float cCurve = smoothstep(0.015, 0.68, pLum);\n" +
            "  float relief = mix(1.0, clamp(0.24 + 1.84 * pow(cCurve, 0.76), 0.22, 1.95), uOrthoCfg.z);\n" +
            "  float grain = 1.0 + uStyleVec.y * (sin(vClothUv.x * 188.0) * cos(vClothUv.y * 162.0) * 0.045);\n" +
            "  vec3 ridgeLift = vec3(0.065, 0.062, 0.058) * pow(cCurve, 1.65) * uOrthoCfg.z;\n" +
            "  vec3 tinted = (diffuseColor.rgb * mix(vec3(1.0), pChroma, uOrthoCfg.y) * relief + ridgeLift) * grain;\n" +
            "  // Normalized photographic seam/fold/pocket transfer: preserves cast coat color while projecting 72% photographic detail!\n" +
            "  float baseLum = max(0.02, dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));\n" +
            "  vec3 normPhoto = pCol * clamp(baseLum / max(pLum, 0.035), 0.32, 2.25) * grain;\n" +
            "  vec3 photoBlend = mix(normPhoto, pCol * grain, 0.34);\n" +
            "  vec3 finalOrtho = mix(tinted, photoBlend, uOrthoCfg.x);\n" +
            "  diffuseColor.rgb = mix(diffuseColor.rgb, finalOrtho, vOrthoPos.w * validAny);\n" +
            "}"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "if (uCyanGlow.w > 0.001) {\n" +
            "  vec3 toSurf = vBindRaw - uCyanGlow.xyz;\n" +
            "  float d2 = dot(toSurf, toSurf) + 0.028;\n" +
            "  vec3 lDir = normalize(-toSurf);\n" +
            "  float ndl = clamp(dot(normalize(vOrthoNrm), lDir) * 0.65 + 0.35, 0.0, 1.0);\n" +
            "  float eyeGuard = 1.0 - 0.82 * smoothstep(1.572, 1.628, vBindRaw.y);\n" +
            "  float atten = uCyanGlow.w * eyeGuard * ndl / (1.0 + 14.5 * d2);\n" +
            "  totalEmissiveRadiance += vec3(0.14, 0.74, 0.98) * atten * (0.42 + 0.58 * diffuseColor.rgb);\n" +
            "}\n" +
            "if (uStyleVec.x > 0.001) {\n" +
            "  float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.8);\n" +
            "  totalEmissiveRadiance += diffuseColor.rgb * (uStyleVec.x * fres);\n" +
            "}"
          );
    };
    mat.customProgramCacheKey = () => "npDonkeyOrtho_v2";
    return mat;
  }

  /* Lightweight cyan smartphone bounce shader for rigid non-skin sub-meshes (cuffs, headwraps, turbans) */
  function applyRigidCyanBounce(mat, cyanGlow, localOffsetY = 0) {
    const uOffY = { value: localOffsetY };
    mat.onBeforeCompile = sh => {
      sh.uniforms.uCyanGlow = cyanGlow;
      sh.uniforms.uBounceOffY = uOffY;
      sh.vertexShader =
        "uniform float uBounceOffY;\nvarying vec3 vRigPos;\nvarying vec3 vRigNrm;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvRigPos = position + vec3(0.0, uBounceOffY, 0.0);\nvRigNrm = normal;"
        );
      sh.fragmentShader =
        "uniform vec4 uCyanGlow;\nvarying vec3 vRigPos;\nvarying vec3 vRigNrm;\n" +
        sh.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n" +
          "if (uCyanGlow.w > 0.001) {\n" +
          "  vec3 toS = vRigPos - uCyanGlow.xyz;\n" +
          "  float d2 = dot(toS, toS) + 0.035;\n" +
          "  float ndl = clamp(dot(normalize(vRigNrm), normalize(-toS)) * 0.6 + 0.4, 0.0, 1.0);\n" +
          "  totalEmissiveRadiance += vec3(0.14, 0.74, 1.0) * (uCyanGlow.w * 0.72 * ndl / (1.0 + 14.0 * d2)) * (0.45 + 0.55 * diffuseColor.rgb);\n" +
          "}"
        );
    };
    mat.customProgramCacheKey = () => "npRigidCyanBounce_v1";
    return mat;
  }

  /* Set linear RGB onto a THREE.Color across both Three.js ColorManagement=true (r152+) and legacy modes */
  function setThreeColorFromLinear(T, col, lx, ly, lz) {
    const r = Math.max(0.0005, lx), g = Math.max(0.0005, ly), b = Math.max(0.0005, lz);
    if (T.LinearSRGBColorSpace && col.setRGB.length >= 4) {
      col.setRGB(r, g, b, T.LinearSRGBColorSpace);
    } else if (new T.Color(0x808080).r < 0.35) {
      col.setRGB(r, g, b);
    } else {
      col.setRGB(Math.pow(r, 1 / 2.2), Math.pow(g, 1 / 2.2), Math.pow(b, 1 / 2.2));
    }
    return col;
  }

  /* Unified Dermal Body Skin Shader (bare deltoids, upper arms, forearms, wrists, ankles, rigid ears):
     Matches `ScionNeck` / `headMesh` 1:1 in linear `uCanonicalSkinLin` RGB, `dGrainA/dGrainB` pore micro-grain,
     `microPore` roughness (around 0.72), Fresnel subsurface rim (`vec3(1.55, 0.52, 0.28) * rimSSS * 0.40`), & cyan bounce! */
  function applyUnifiedBodySkinShader(T, mat, cfg) {
    const canonicalSkin = cfg.canonicalSkinUniform;
    const cyanGlow = cfg.cyanGlow;
    const uOffY = { value: cfg.localOffsetY || 0.0 };
    const uSkinCfg = {
      value: new T.Vector4(
        cfg.sssWeight !== undefined ? cfg.sssWeight : 0.40,
        cfg.sssStrength !== undefined ? cfg.sssStrength : 0.36,
        cfg.baseShade !== undefined ? cfg.baseShade : 0.992,
        0.0
      )
    };
    mat.userData = mat.userData || {};
    mat.userData.canonicalSkinUniform = canonicalSkin;
    mat.onBeforeCompile = sh => {
      sh.uniforms.uCanonicalSkinLin = canonicalSkin;
      sh.uniforms.uCyanGlow = cyanGlow;
      sh.uniforms.uBounceOffY = uOffY;
      sh.uniforms.uBodySkinCfg = uSkinCfg;
      sh.vertexShader =
        "uniform float uBounceOffY;\nvarying vec3 vBodyBindPos;\nvarying vec3 vBodyRigPos;\nvarying vec3 vBodyRigNrm;\nvarying vec3 vBodyVertShade;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n" +
          "vBodyBindPos = position;\n" +
          "vBodyRigPos = position + vec3(0.0, uBounceOffY, 0.0);\n" +
          "vBodyRigNrm = normal;\n" +
          "#ifdef USE_COLOR\n  vBodyVertShade = color.rgb;\n#else\n  vBodyVertShade = vec3(1.0);\n#endif"
        );
      sh.fragmentShader =
        "uniform vec3 uCanonicalSkinLin;\nuniform vec4 uCyanGlow;\nuniform vec4 uBodySkinCfg;\n" +
        "varying vec3 vBodyBindPos;\nvarying vec3 vBodyRigPos;\nvarying vec3 vBodyRigNrm;\nvarying vec3 vBodyVertShade;\n" +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\n" +
            "float dGrainA = fract(sin(dot(floor(vBodyBindPos.xy * 980.0 + vBodyBindPos.z * 790.0), vec2(12.9898, 78.233))) * 43758.5453);\n" +
            "float dGrainB = sin(vBodyBindPos.x * 460.0 + sin(vBodyBindPos.y * 520.0 + vBodyBindPos.z * 380.0)) * 0.5 + 0.5;\n" +
            "float dermalGrain = 1.0 + ((dGrainA - 0.5) * 0.045 + (dGrainB - 0.5) * 0.032);\n" +
            "diffuseColor.rgb = uCanonicalSkinLin * (uBodySkinCfg.z * dermalGrain) * vBodyVertShade;"
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\n" +
            "float microPore = (fract(sin(dot(floor(vBodyBindPos.xy * 1150.0 + vBodyBindPos.z * 870.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.028;\n" +
            "roughnessFactor = clamp(roughnessFactor + microPore, 0.64, 0.88);"
          )
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "vec3 Vdir = normalize(vViewPosition);\n" +
            "float ndv = abs(dot(normalize(vNormal), Vdir));\n" +
            "float nightDamp = 1.0 - clamp(uCyanGlow.w * 0.95, 0.0, 0.88);\n" +
            "float rimSSS = pow(1.0 - ndv, 2.6) * uBodySkinCfg.x * uBodySkinCfg.y * nightDamp;\n" +
            "totalEmissiveRadiance += diffuseColor.rgb * vec3(1.55, 0.52, 0.28) * (rimSSS * 0.40);\n" +
            "if (uCyanGlow.w > 0.001) {\n" +
            "  vec3 toS = vBodyRigPos - uCyanGlow.xyz;\n" +
            "  float d2 = dot(toS, toS) + 0.032;\n" +
            "  float ndl = clamp(dot(normalize(vBodyRigNrm), normalize(-toS)) * 0.65 + 0.35, 0.0, 1.0);\n" +
            "  totalEmissiveRadiance += vec3(0.14, 0.72, 0.96) * (uCyanGlow.w * ndl / (1.0 + 15.0 * d2)) * (0.36 + 0.64 * diffuseColor.rgb);\n" +
            "}"
          );
    };
    mat.customProgramCacheKey = () => "npUnifiedDermalBodySkin_v52";
    return mat;
  }

  /* ---------- Cached Procedural & Photographic Surface Assets (Shared Across Cast) ---------- */
  let sharedCache = null;
  function getSharedAssets(T, donkeyBaseUrl) {
    if (sharedCache) return sharedCache;
    const texDir = resolveDonkeyBase(donkeyBaseUrl) + "textures/";

    const makeTex = (size, fn, repX = 4, repY = 4, isColor = false) => {
      const data = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const v = fn(x / size, y / size);
          if (Array.isArray(v)) {
            data[i] = clamp(v[0] * 255, 0, 255) | 0;
            data[i + 1] = clamp(v[1] * 255, 0, 255) | 0;
            data[i + 2] = clamp(v[2] * 255, 0, 255) | 0;
          } else {
            const b = clamp(v * 255, 0, 255) | 0;
            data[i] = data[i + 1] = data[i + 2] = b;
          }
          data[i + 3] = 255;
        }
      }
      const tex = new T.DataTexture(data, size, size, T.RGBAFormat);
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.repeat.set(repX, repY);
      tex.magFilter = T.LinearFilter;
      tex.minFilter = T.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      if (isColor && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    // Load #424242 bleed-padded Donkey-Method orthographic plates from donkey/textures/ & donkey/textures_v3/
    const texDirV3 = resolveDonkeyBase(donkeyBaseUrl) + "textures_v3/";
    const tCarrierHead = loadOrthoPlate(T, texDir + "carrier_head.jpg");
    const platesCarrier = {
      front: loadOrthoPlate(T, texDir + "carrier_front.jpg"),
      side:  loadOrthoPlate(T, texDir + "carrier_side.jpg"),
      back:  loadOrthoPlate(T, texDir + "carrier_back.jpg"),
      head:  tCarrierHead
    };
    const platesImani = {
      front: loadOrthoPlate(T, texDirV3 + "imani_photo_front.jpg"),
      side:  loadOrthoPlate(T, texDirV3 + "imani_photo_side.jpg"),
      back:  loadOrthoPlate(T, texDirV3 + "imani_photo_back.jpg"),
      head:  loadOrthoPlate(T, texDirV3 + "imani_head_front.jpg")
    };
    const platesChild = {
      front: loadOrthoPlate(T, texDir + "child_front.jpg"),
      side:  loadOrthoPlate(T, texDir + "child_side.jpg"),
      back:  loadOrthoPlate(T, texDir + "child_back.jpg"),
      head:  loadOrthoPlate(T, texDirV3 + "youth_head_front.jpg")
    };
    const jugWifiDecalTex = loadOrthoPlate(T, texDir + "jug_wifi_decal.png", true);

    // 1. Skin micro-pore & dermal grain
    const skinBump = makeTex(192, (u, v) => {
      const pore = vnoise(u * 130, v * 130);
      const grain = fbm(u * 32, v * 48, 3);
      return 0.48 + 0.28 * grain - 0.18 * Math.pow(pore, 3);
    }, 3, 3);

    // 2. Heavy waxed oilskin / weathered canvas duster
    const oilskinTex = makeTex(256, (u, v) => {
      const warp = Math.sin(u * TAU * 64) * 0.5 + 0.5;
      const weft = Math.sin(v * TAU * 64) * 0.5 + 0.5;
      const weave = 0.5 + 0.12 * (warp * 0.6 + weft * 0.4 - 0.5);
      const crease = Math.abs(fbm(u * 9, v * 14, 4) - 0.5) * 0.9;
      const scuff = fbm(u * 24 + 3.1, v * 24 + 7.4, 3);
      return clamp(weave - crease * 0.34 + (scuff - 0.5) * 0.28, 0.15, 0.95);
    }, 4, 5);

    // 3. Hand-loomed Ethiopian shamma / gabi cotton gauze + tibeb border relief
    const shammaTex = makeTex(256, (u, v) => {
      const gauze = 0.72 + 0.10 * Math.sin(u * TAU * 80) + 0.08 * Math.sin(v * TAU * 52);
      const slub = (fbm(u * 46, v * 18, 3) - 0.5) * 0.18;
      const border = (v < 0.09 || v > 0.91) ? -0.22 * (0.5 + 0.5 * Math.sin(u * TAU * 28)) : 0;
      return clamp(gauze + slub + border, 0.18, 0.98);
    }, 3, 2);

    // 4. Twill work trousers & crease relief
    const twillTex = makeTex(192, (u, v) => {
      const diag = Math.sin((u * 56 + v * 56) * TAU) * 0.09;
      const wear = (fbm(u * 14, v * 22, 4) - 0.5) * 0.32;
      return clamp(0.56 + diag + wear, 0.15, 0.95);
    }, 4, 5);

    // 5. Coily / loc hair relief
    const hairBump = makeTex(192, (u, v) => {
      const c1 = vnoise(u * 76, v * 76);
      const c2 = vnoise(u * 148 + 4, v * 148 + 2);
      return clamp(0.32 + 0.44 * Math.sin(c1 * Math.PI) + 0.28 * c2, 0.05, 0.98);
    }, 4, 4);

    // 6. Deep-lidded Donkey-caliber human eye texture (256x256 with 1:2 equirectangular spherical
    // aspect compensation so the warm dark iris + limbal ring map to a true round 58% cornea with
    // upper-sclera lid ambient occlusion — eliminating white-ring bug-eye stare!)
    const ec = document.createElement("canvas");
    ec.width = ec.height = 256;
    const ex = ec.getContext("2d");
    ex.fillStyle = "#6b5444";
    ex.fillRect(0, 0, 256, 256);
    // Soft vascular / orbital sclera falloff
    const sg = ex.createRadialGradient(128, 128, 24, 128, 128, 120);
    sg.addColorStop(0, "rgba(138,112,92,0)");
    sg.addColorStop(0.52, "rgba(84,60,46,0.56)");
    sg.addColorStop(1, "rgba(42,28,22,0.88)");
    ex.fillStyle = sg;
    ex.fillRect(0, 0, 256, 256);
    // Upper-eyelid ambient occlusion across upper sclera (v < 0.5 -> canvas y < 128)
    const uShade = ex.createLinearGradient(0, 28, 0, 144);
    uShade.addColorStop(0, "rgba(22,14,10,0.92)");
    uShade.addColorStop(0.60, "rgba(34,22,16,0.56)");
    uShade.addColorStop(1, "rgba(34,22,16,0)");
    ex.fillStyle = uShade;
    ex.fillRect(0, 0, 256, 146);
    // Scale Y by 2.0 around (128, 128) just like donkey.js line 473 so equirectangular SphereGeometry
    // (theta=pi vs phi=2*pi) renders a perfectly circular iris & pupil!
    ex.save();
    ex.translate(128, 128);
    ex.scale(1, 2);
    const ig = ex.createRadialGradient(0, 0, 6, 0, 0, 38.0);
    ig.addColorStop(0, "#040303");
    ig.addColorStop(0.36, "#140d08");
    ig.addColorStop(0.70, "#3b2315");
    ig.addColorStop(0.88, "#1c1009");
    ig.addColorStop(0.96, "#080504");
    ig.addColorStop(1, "rgba(8,5,4,0)");
    ex.fillStyle = ig;
    ex.beginPath(); ex.arc(0, 0, 38.0, 0, TAU); ex.fill();
    for (let i = 0; i < 48; i++) {
      const a = hash(i + 5) * TAU;
      ex.strokeStyle = "rgba(98,66,42,0.18)";
      ex.lineWidth = 1.0;
      ex.beginPath();
      ex.moveTo(Math.cos(a) * 14.0, Math.sin(a) * 14.0);
      ex.lineTo(Math.cos(a) * 33.0, Math.sin(a) * 33.0);
      ex.stroke();
    }
    ex.fillStyle = "#030303";
    ex.beginPath(); ex.arc(0, 0, 15.0, 0, TAU); ex.fill();
    ex.fillStyle = "rgba(232,214,192,0.36)";
    ex.beginPath(); ex.arc(-7.5, -7.0, 2.6, 0, TAU); ex.fill();
    ex.restore();
    const eyeTex = new T.CanvasTexture(ec);
    eyeTex.wrapS = eyeTex.wrapT = T.ClampToEdgeWrapping;
    if (T.SRGBColorSpace) eyeTex.colorSpace = T.SRGBColorSpace;

    // 7. Glowing cyan smartphone / tablet telemetry screen texture
    const pc = document.createElement("canvas");
    pc.width = 64; pc.height = 128;
    const px = pc.getContext("2d");
    const pg = px.createLinearGradient(0, 0, 0, 128);
    pg.addColorStop(0, "#9bf4ff");
    pg.addColorStop(0.5, "#3cd8ff");
    pg.addColorStop(1, "#1896d8");
    px.fillStyle = pg;
    px.fillRect(0, 0, 64, 128);
    px.strokeStyle = "rgba(255,255,255,0.88)";
    px.lineWidth = 2;
    px.strokeRect(5, 8, 54, 112);
    px.beginPath();
    px.arc(32, 48, 16, Math.PI * 1.18, Math.PI * 1.82);
    px.stroke();
    px.beginPath();
    px.arc(32, 48, 10, Math.PI * 1.22, Math.PI * 1.78);
    px.stroke();
    px.fillStyle = "#ffffff";
    px.fillRect(12, 74, 40, 4);
    px.fillRect(16, 84, 32, 3);
    const phoneUiTex = new T.CanvasTexture(pc);
    if (T.SRGBColorSpace) phoneUiTex.colorSpace = T.SRGBColorSpace;

    // 8. REC PPC Hill Archive Clipboard Sheet texture
    const cc = document.createElement("canvas");
    cc.width = 96; cc.height = 128;
    const cx = cc.getContext("2d");
    cx.fillStyle = "#ece6d8";
    cx.fillRect(0, 0, 96, 128);
    cx.fillStyle = "#22303c";
    cx.fillRect(10, 14, 76, 5);
    cx.fillStyle = "rgba(44, 62, 78, 0.45)";
    for (let y = 28; y < 114; y += 9) {
      cx.fillRect(10, y, 52 + ((y * 7) % 24), 2);
    }
    const clipboardSheetTex = new T.CanvasTexture(cc);
    if (T.SRGBColorSpace) clipboardSheetTex.colorSpace = T.SRGBColorSpace;

    // 9. Soft contact shadow under feet
    const sc = document.createElement("canvas");
    sc.width = sc.height = 64;
    const sx = sc.getContext("2d");
    const rg = sx.createRadialGradient(32, 32, 3, 32, 32, 30);
    rg.addColorStop(0, "rgba(12, 13, 12, 0.52)");
    rg.addColorStop(0.55, "rgba(12, 13, 12, 0.24)");
    rg.addColorStop(1, "rgba(12, 13, 12, 0)");
    sx.fillStyle = rg;
    sx.fillRect(0, 0, 64, 64);
    const shadowTex = new T.CanvasTexture(sc);

    sharedCache = {
      platesCarrier, platesImani, platesChild, jugWifiDecalTex,
      skinBump, oilskinTex, shammaTex, twillTex, hairBump, eyeTex, shadowTex,
      eyeMat: new T.MeshStandardMaterial({
        map: eyeTex, color: 0xb59b84, roughness: 0.48, metalness: 0.0
      }),
      lashMat: new T.MeshStandardMaterial({ color: 0x110d0b, roughness: 0.88 }),
      leatherDark: new T.MeshStandardMaterial({ color: 0x231d18, roughness: 0.68, bumpMap: oilskinTex, bumpScale: 0.015 }),
      leatherWorn: new T.MeshStandardMaterial({ color: 0x3a2d22, roughness: 0.74, bumpMap: oilskinTex, bumpScale: 0.018 }),
      bootSoleMat: new T.MeshStandardMaterial({ color: 0x161615, roughness: 0.92 }),
      steelToolMat: new T.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.34, metalness: 0.82 }),
      ironDarkMat: new T.MeshStandardMaterial({ color: 0x2c3032, roughness: 0.52, metalness: 0.64 }),
      enamelCupMat: new T.MeshStandardMaterial({ color: 0xdcd7cb, roughness: 0.44, metalness: 0.08 }),
      enamelRimMat: new T.MeshStandardMaterial({ color: 0x2b363b, roughness: 0.42, metalness: 0.25 }),
      tinMugMat: new T.MeshStandardMaterial({ color: 0xb2b8bc, roughness: 0.30, metalness: 0.80 }),
      cyanWaterMat: new T.MeshStandardMaterial({
        color: 0x3fd8e8, emissive: 0x169ec2, emissiveIntensity: 0.92,
        roughness: 0.14, transparent: true, opacity: 0.90
      }),
      chalkLineMat: new T.MeshBasicMaterial({ color: 0xf4f1e6, transparent: true, opacity: 0.86 }),
      jugDecalMat: new T.MeshBasicMaterial({
        map: jugWifiDecalTex, transparent: true, opacity: 0.94, depthWrite: false, side: T.DoubleSide
      }),
      sisalMat: new T.MeshStandardMaterial({ color: 0xc2b08c, roughness: 0.92, bumpMap: twillTex, bumpScale: 0.03 }),
      phoneBodyMat: new T.MeshStandardMaterial({ color: 0x13171b, roughness: 0.34, metalness: 0.48 }),
      phoneScreenMat: new T.MeshBasicMaterial({ map: phoneUiTex, color: 0x92f0ff }),
      radioLedMat: new T.MeshBasicMaterial({ color: 0x52e8ff }),
      clipboardBoardMat: new T.MeshStandardMaterial({ color: 0x6e5338, roughness: 0.78, bumpMap: twillTex, bumpScale: 0.015 }),
      clipboardPaperMat: new T.MeshStandardMaterial({ map: clipboardSheetTex, roughness: 0.88, side: T.DoubleSide }),
      paperMat: new T.MeshStandardMaterial({ color: 0xe6e0d2, roughness: 0.88, side: T.DoubleSide }),
      ledgerMat: new T.MeshStandardMaterial({ color: 0x4b3f33, roughness: 0.84, bumpMap: oilskinTex, bumpScale: 0.014 }),
      woodChairMat: new T.MeshStandardMaterial({ color: 0x4d3b2b, roughness: 0.86, bumpMap: twillTex, bumpScale: 0.02 }),
      penBlueMat: new T.MeshStandardMaterial({ color: 0x1d4ea8, roughness: 0.38 })
    };
    return sharedCache;
  }

  /* ---------- Bone Indices (56-Bone Anatomical Human Skeleton + 9 Volume/Cloth/Hair Physics Helpers) ---------- */
  const B_ROOT         = 0;
  const B_PELVIS       = 1;
  const B_LUMBAR       = 2;
  const B_SPINE        = 2; // alias
  const B_THORAX       = 3;
  const B_CHEST        = 4;
  const B_NECK_LOW     = 5;
  const B_NECK         = 5; // alias
  const B_NECK_HIGH    = 6;
  const B_HEAD         = 7;
  const B_JAW          = 8;
  const B_CLAV_L       = 9,  B_UARM_L = 10, B_ELBOW_VOL_L = 11, B_FARM_L = 12, B_FARM_TWIST_L = 13, B_HAND_L = 14;
  const B_CLAV_R       = 15, B_UARM_R = 16, B_ELBOW_VOL_R = 17, B_FARM_R = 18, B_FARM_TWIST_R = 19, B_HAND_R = 20;
  // 30 Finger Phalanges (21..35 Left, 36..50 Right)
  const B_ULEG_L       = 51, B_KNEE_VOL_L = 52, B_LLEG_L = 53, B_FOOT_L = 54, B_TOE_L = 55;
  const B_ULEG_R       = 56, B_KNEE_VOL_R = 57, B_LLEG_R = 58, B_FOOT_R = 59, B_TOE_R = 60;
  const B_COAT_B       = 61, B_COAT_L = 62, B_COAT_R = 63, B_HAIR_TAIL = 64;
  const B_TOTAL_COUNT  = 65;

  /* HLIDARENDI MUSCLE_PROFILE per-bone angular speed & stiffness damping table */
  const MUSCLE_PROFILE_BY_BONE = [];
  MUSCLE_PROFILE_BY_BONE[B_PELVIS]       = { speed: 2.55, stiff: 6.4 };
  MUSCLE_PROFILE_BY_BONE[B_LUMBAR]       = { speed: 2.75, stiff: 6.6 };
  MUSCLE_PROFILE_BY_BONE[B_THORAX]       = { speed: 3.40, stiff: 7.8 };
  MUSCLE_PROFILE_BY_BONE[B_CHEST]        = { speed: 3.70, stiff: 8.4 };
  MUSCLE_PROFILE_BY_BONE[B_NECK_LOW]     = { speed: 5.40, stiff: 10.6 };
  MUSCLE_PROFILE_BY_BONE[B_NECK_HIGH]    = { speed: 5.80, stiff: 11.2 };
  MUSCLE_PROFILE_BY_BONE[B_HEAD]         = { speed: 6.20, stiff: 11.8 };
  MUSCLE_PROFILE_BY_BONE[B_JAW]          = { speed: 16.0, stiff: 24.0 };
  MUSCLE_PROFILE_BY_BONE[B_CLAV_L]       = { speed: 4.40, stiff: 8.8 };
  MUSCLE_PROFILE_BY_BONE[B_CLAV_R]       = { speed: 4.40, stiff: 8.8 };
  MUSCLE_PROFILE_BY_BONE[B_UARM_L]       = { speed: 4.35, stiff: 8.4 };
  MUSCLE_PROFILE_BY_BONE[B_UARM_R]       = { speed: 4.35, stiff: 8.4 };
  MUSCLE_PROFILE_BY_BONE[B_FARM_L]       = { speed: 5.35, stiff: 9.6 };
  MUSCLE_PROFILE_BY_BONE[B_FARM_R]       = { speed: 5.35, stiff: 9.6 };
  MUSCLE_PROFILE_BY_BONE[B_FARM_TWIST_L] = { speed: 5.80, stiff: 10.2 };
  MUSCLE_PROFILE_BY_BONE[B_FARM_TWIST_R] = { speed: 5.80, stiff: 10.2 };
  MUSCLE_PROFILE_BY_BONE[B_HAND_L]       = { speed: 6.20, stiff: 10.8 };
  MUSCLE_PROFILE_BY_BONE[B_HAND_R]       = { speed: 6.20, stiff: 10.8 };
  MUSCLE_PROFILE_BY_BONE[B_ULEG_L]       = { speed: 4.10, stiff: 8.2 };
  MUSCLE_PROFILE_BY_BONE[B_ULEG_R]       = { speed: 4.10, stiff: 8.2 };
  MUSCLE_PROFILE_BY_BONE[B_LLEG_L]       = { speed: 5.10, stiff: 9.4 };
  MUSCLE_PROFILE_BY_BONE[B_LLEG_R]       = { speed: 5.10, stiff: 9.4 };
  MUSCLE_PROFILE_BY_BONE[B_FOOT_L]       = { speed: 5.60, stiff: 9.8 };
  MUSCLE_PROFILE_BY_BONE[B_FOOT_R]       = { speed: 5.60, stiff: 9.8 };
  MUSCLE_PROFILE_BY_BONE[B_TOE_L]        = { speed: 6.20, stiff: 10.4 };
  MUSCLE_PROFILE_BY_BONE[B_TOE_R]        = { speed: 6.20, stiff: 10.4 };
  MUSCLE_PROFILE_BY_BONE[B_HAIR_TAIL]    = { speed: 4.60, stiff: 6.8 };

  /* Anatomical 3-Joint Cervical Arc Solver (`applyCervicalLeanArc`):
     Distributes lateral neck lean (`rz` up to ±0.46 rad = ±26.5°), pitch (`rx` up to ±0.42 rad),
     yaw (`ry` up to ±0.72 rad), and Eskista horizontal cervical glide (`glideX`) smoothly across:
       - B_THORAX + B_CHEST: 10% sympathetic upper-ribcage lean & 4% turn
       - B_CLAV_L / B_CLAV_R: -12% stretched-side shoulder relaxation, +8% cozy lift toward leaning head
       - B_NECK_LOW (40% rz, 42% rx, 28% ry) -> B_NECK_HIGH (36% rz, 34% rx, 36% ry) -> B_HEAD (24% rz, 24% rx, 36% ry) */
  const B_CERVICAL_MAP = {
    THORAX: B_THORAX,
    CHEST: B_CHEST,
    NECK_LOW: B_NECK_LOW,
    NECK_HIGH: B_NECK_HIGH,
    HEAD: B_HEAD,
    JAW: B_JAW,
    CLAV_L: B_CLAV_L,
    CLAV_R: B_CLAV_R
  };

  function applyCervicalLeanArc(bones, B, pitchRx, yawRy, leanRollRz, chestAssist = 1.0, glideX = 0.0, uNeckLeanTargets = null) {
    const ExpV4 = typeof window !== "undefined" ? window.HumanExpressionsV4 : null;
    if (ExpV4 && typeof ExpV4.applyCervicalLeanArc === "function") {
      return ExpV4.applyCervicalLeanArc(bones, B || B_CERVICAL_MAP, pitchRx, yawRy, leanRollRz, chestAssist, glideX, uNeckLeanTargets);
    }
    const rx = clamp(pitchRx || 0, -0.42, 0.42);
    const ry = clamp(yawRy || 0, -0.72, 0.72);
    const rz = clamp(leanRollRz || 0, -0.46, 0.46);
    const gx = clamp(glideX || 0, -0.032, 0.032);
    const cAssist = clamp(chestAssist !== undefined ? chestAssist : 1.0, 0, 1.5);
    const coupledYaw  = -0.060 * rz * (1.0 - 0.75 * clamp(Math.abs(ry) / 0.28, 0, 1));
    const coupledRoll = -0.052 * ry * (1.0 - 0.75 * clamp(Math.abs(rz) / 0.22, 0, 1));
    const effRy = clamp(ry + coupledYaw, -0.74, 0.74);
    const effRz = clamp(rz + coupledRoll, -0.47, 0.47);
    if (cAssist > 0.001) {
      if (bones[B_THORAX]) {
        bones[B_THORAX].rotateX(rx * 0.03 * cAssist);
        bones[B_THORAX].rotateY(effRy * 0.016 * cAssist);
        bones[B_THORAX].rotateZ(effRz * 0.04 * cAssist);
      }
      if (bones[B_CHEST]) {
        bones[B_CHEST].rotateX(rx * 0.05 * cAssist);
        bones[B_CHEST].rotateY(effRy * 0.024 * cAssist);
        bones[B_CHEST].rotateZ(effRz * 0.06 * cAssist);
      }
      const rPos = Math.max(0, rz), rNeg = Math.max(0, -rz);
      if (bones[B_CLAV_L]) bones[B_CLAV_L].rotateZ((0.08 * rNeg - 0.12 * rPos) * cAssist);
      if (bones[B_CLAV_R]) bones[B_CLAV_R].rotateZ(-(0.08 * rPos - 0.12 * rNeg) * cAssist);
    }
    const glideCounterRz = gx * 1.65;
    if (bones[B_NECK_LOW]) {
      bones[B_NECK_LOW].position.x = bones[B_NECK_LOW].userData.rest.x + gx * 0.48;
      bones[B_NECK_LOW].rotation.set(rx * 0.42, effRy * 0.28, effRz * 0.40 - glideCounterRz * 0.50, "ZXY");
    }
    if (bones[B_NECK_HIGH]) {
      bones[B_NECK_HIGH].position.x = bones[B_NECK_HIGH].userData.rest.x + gx * 0.52;
      bones[B_NECK_HIGH].rotation.set(rx * 0.34, effRy * 0.36, effRz * 0.36 - glideCounterRz * 0.50, "ZXY");
    }
    if (bones[B_HEAD]) {
      bones[B_HEAD].rotation.set(rx * 0.24, effRy * 0.36, effRz * 0.24 + glideCounterRz, "ZXY");
    }
    if (uNeckLeanTargets) {
      const v = uNeckLeanTargets.value || uNeckLeanTargets;
      if (v && typeof v.set === "function") v.set(effRz, rx, effRy, gx);
    }
    return { roll: effRz, pitch: rx, yaw: effRy, glideX: gx };
  }

  const ARM_ROLL_CANDIDATES = [-80, -64, -48, -32, -16, 0, 16, 32, 48, 64, 80];

  /* ---------- Orthonormal 2-Bone IK + HLIDARENDI Capsule-Avoiding Arm Solver + 3-DOF Wrist Solver ---------- */
  function makeIKScratch(T) {
    return {
      mInv: new T.Matrix4(),
      mUpper: new T.Matrix4(),
      mLower: new T.Matrix4(),
      mHand: new T.Matrix4(),
      qUpper: new T.Quaternion(),
      qUpperInv: new T.Quaternion(),
      qLowerWorld: new T.Quaternion(),
      qParentWorld: new T.Quaternion(),
      qHandWorld: new T.Quaternion(),
      qRel: new T.Quaternion(),
      qRoll: new T.Quaternion(),
      S: new T.Vector3(),
      Tgt: new T.Vector3(),
      Pole: new T.Vector3(),
      D: new T.Vector3(),
      uD: new T.Vector3(),
      N: new T.Vector3(),
      uP: new T.Vector3(),
      J: new T.Vector3(),
      bestE: new T.Vector3(),
      bestB: new T.Vector3(),
      candE: new T.Vector3(),
      candB: new T.Vector3(),
      relE: new T.Vector3(),
      segPt: new T.Vector3(),
      abVec: new T.Vector3(),
      apVec: new T.Vector3(),
      cpVec: new T.Vector3(),
      charRight: new T.Vector3(),
      charUp: new T.Vector3(),
      charFwd: new T.Vector3(),
      fDir: new T.Vector3(),
      pNrm: new T.Vector3(),
      fArmDir: new T.Vector3(),
      dir1: new T.Vector3(),
      dir2: new T.Vector3(),
      xAx: new T.Vector3(),
      yAx: new T.Vector3(),
      zAx: new T.Vector3(),
      yAx2: new T.Vector3(),
      zAx2: new T.Vector3(),
      poleWorld: new T.Vector3()
    };
  }

  function closestPointOnSeg(ik, p, a, b, out) {
    ik.abVec.subVectors(b, a);
    const den = ik.abVec.lengthSq();
    if (den < 1e-9) return out.copy(a);
    ik.apVec.subVectors(p, a);
    const u = clamp(ik.apVec.dot(ik.abVec) / den, 0, 1);
    return out.copy(a).addScaledVector(ik.abVec, u);
  }

  function capsuleDist(ik, p, cap) {
    closestPointOnSeg(ik, p, cap.a, cap.b, ik.cpVec);
    return p.distanceTo(ik.cpVec) - cap.r;
  }

  function projectOutCapsules(ik, pt, caps, pad, fallbackSignX, charRight) {
    for (let pass = 0; pass < 3; pass++) {
      let worstCap = null, worstPen = 0;
      for (let i = 0; i < caps.length; i++) {
        const c = caps[i];
        closestPointOnSeg(ik, pt, c.a, c.b, ik.cpVec);
        ik.D.subVectors(pt, ik.cpVec);
        const dist = ik.D.length();
        const need = c.r + pad;
        const pen = need - dist;
        if (pen > worstPen) {
          worstPen = pen;
          worstCap = c;
          if (dist > 1e-6) ik.N.copy(ik.D).divideScalar(dist);
          else ik.N.copy(charRight).multiplyScalar(fallbackSignX);
          ik.segPt.copy(ik.cpVec);
        }
      }
      if (!worstCap) break;
      pt.copy(ik.segPt).addScaledVector(ik.N, worstCap.r + pad);
    }
    return pt;
  }

  function solveLimbIK(ik, parentBone, upperBone, lowerBone, targetWorld, poleLocalDir, L1, L2, poleSign) {
    ik.mInv.copy(parentBone.matrixWorld).invert();
    ik.Tgt.copy(targetWorld).applyMatrix4(ik.mInv);
    ik.S.copy(upperBone.userData.rest);
    upperBone.position.copy(ik.S);

    ik.D.subVectors(ik.Tgt, ik.S);
    const rawDist = ik.D.length();
    const minD = Math.abs(L1 - L2) + 0.015;
    const maxD = (L1 + L2) * 0.996;
    const d = clamp(rawDist, minD, maxD);
    if (rawDist > 1e-5) ik.uD.copy(ik.D).divideScalar(rawDist);
    else ik.uD.set(0, -1, 0);

    ik.Pole.copy(poleLocalDir).normalize();
    ik.N.crossVectors(ik.uD, ik.Pole);
    if (ik.N.lengthSq() < 1e-6) ik.N.set(1, 0, 0);
    else ik.N.normalize();
    ik.uP.crossVectors(ik.N, ik.uD).normalize();

    const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

    ik.J.copy(ik.S)
      .addScaledVector(ik.uD, cosA * L1)
      .addScaledVector(ik.uP, sinA * L1);

    ik.dir1.subVectors(ik.J, ik.S).normalize();
    ik.yAx.copy(ik.dir1).negate();
    if (poleSign > 0) ik.xAx.copy(ik.N).negate();
    else ik.xAx.copy(ik.N);
    ik.xAx.addScaledVector(ik.yAx, -ik.xAx.dot(ik.yAx));
    if (ik.xAx.lengthSq() < 1e-6) ik.xAx.set(1, 0, 0);
    else ik.xAx.normalize();
    ik.zAx.crossVectors(ik.xAx, ik.yAx).normalize();

    ik.mUpper.makeBasis(ik.xAx, ik.yAx, ik.zAx);
    ik.qUpper.setFromRotationMatrix(ik.mUpper);
    upperBone.quaternion.copy(ik.qUpper);

    ik.Tgt.copy(ik.S).addScaledVector(ik.uD, d);
    ik.dir2.subVectors(ik.Tgt, ik.J).normalize();
    ik.yAx2.copy(ik.dir2).negate();
    ik.zAx2.crossVectors(ik.xAx, ik.yAx2);
    if (ik.zAx2.lengthSq() < 1e-6) ik.zAx2.set(0, 0, 1);
    else ik.zAx2.normalize();
    const xAx2 = ik.D.crossVectors(ik.yAx2, ik.zAx2).normalize();

    ik.mLower.makeBasis(xAx2, ik.yAx2, ik.zAx2);
    ik.qLowerWorld.setFromRotationMatrix(ik.mLower);
    ik.qUpperInv.copy(ik.qUpper).invert();
    lowerBone.quaternion.copy(ik.qUpperInv).multiply(ik.qLowerWorld);
  }

  /* HLIDARENDI 11-angle capsule-avoiding 2-bone arm solver:
     - Evaluates [-80°..+80°] elbow roll candidates around the shoulder-to-wrist axis
     - Enforces maxFlexDeg = 142° so forearms never fold inside upper arms
     - Rejects elbows behind the ribcage or scarecrow-winged above shoulder height
     - Scores clearance against chest/abdomen/head/opposite-arm capsules + bendMem continuity */
  function solveArmSafe(ik, parentBone, upperBone, lowerBone, targetWorld, L1, L2, side, scale, caps, bendMem, groupQuat, outElbowWorld) {
    parentBone.updateMatrixWorld(true);
    upperBone.position.copy(upperBone.userData.rest);
    upperBone.quaternion.identity();
    lowerBone.quaternion.identity();
    upperBone.updateMatrixWorld(true);

    upperBone.getWorldPosition(ik.S);
    const l1 = L1 * scale;
    const l2 = L2 * scale;

    ik.D.subVectors(targetWorld, ik.S);
    const rawDist = ik.D.length();
    const maxFlex = 142 * DEG;
    const minFlex = 4 * DEG;
    const flexMin = Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 + 2 * l1 * l2 * Math.cos(maxFlex)));
    const flexMax = Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 + 2 * l1 * l2 * Math.cos(minFlex)));
    const minD = Math.max(Math.abs(l1 - l2) + 0.004 * scale, flexMin);
    const maxD = Math.min((l1 + l2) * 0.996, flexMax);
    const d = clamp(rawDist, minD, maxD);

    if (rawDist > 1e-6) ik.uD.copy(ik.D).divideScalar(rawDist);
    else ik.uD.set(0, -1, 0);

    // Character world axes
    ik.charRight.set(1, 0, 0).applyQuaternion(groupQuat);
    ik.charUp.set(0, 1, 0).applyQuaternion(groupQuat);
    ik.charFwd.set(0, 0, 1).applyQuaternion(groupQuat);

    // Natural gravity-adducted elbow pole: down (-Y), gently outward (±X), slightly back (-Z)
    ik.Pole.set(side * 0.42, -0.82, -0.38).applyQuaternion(groupQuat).normalize();
    ik.uP.copy(ik.Pole).addScaledVector(ik.uD, -ik.Pole.dot(ik.uD));
    if (ik.uP.lengthSq() < 1e-6) {
      ik.uP.copy(ik.charRight).multiplyScalar(side).addScaledVector(ik.uD, -side * ik.charRight.dot(ik.uD));
    }
    if (ik.uP.lengthSq() < 1e-6) ik.uP.set(0, 0, -1);
    ik.uP.normalize();

    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const y = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const handRelUp = ik.D.dot(ik.charUp) / scale;
    const handRelFwd = ik.D.dot(ik.charFwd) / scale;
    const handRelLat = side * ik.D.dot(ik.charRight) / scale;
    const maxElbowUp = handRelUp > -0.04 ? 0.36 : 0.05;
    const minElbowLat = handRelLat < -0.015 ? -0.22 : -0.025;
    const minElbowFwd = -0.26;

    let found = false;
    let bestScore = -1e12;
    const armR1 = 0.044 * scale;
    const armR2 = 0.036 * scale;
    const clampedTgt = ik.Tgt.copy(ik.S).addScaledVector(ik.uD, d);

    for (let k = 0; k < ARM_ROLL_CANDIDATES.length; k++) {
      const deg = ARM_ROLL_CANDIDATES[k];
      ik.qRoll.setFromAxisAngle(ik.uD, deg * DEG);
      ik.candB.copy(ik.uP).applyQuaternion(ik.qRoll).normalize();
      ik.candE.copy(ik.S).addScaledVector(ik.uD, x).addScaledVector(ik.candB, y);

      ik.relE.subVectors(ik.candE, ik.S).divideScalar(scale);
      const lat = side * ik.relE.dot(ik.charRight);
      const upv = ik.relE.dot(ik.charUp);
      const fwd = ik.relE.dot(ik.charFwd);

      // Reject scarecrow winged elbows, excessive sternum cross-overs, or backward neck-folding elbows
      if (lat < minElbowLat) continue;
      if (upv > maxElbowUp || upv < -0.34) continue;
      if (fwd < minElbowFwd) continue;

      let minClear = 1e6;
      for (let sIdx = 0; sIdx < 3; sIdx++) {
        const u = 0.38 + sIdx * 0.26;
        ik.segPt.copy(ik.S).lerp(ik.candE, u);
        for (let cIdx = 0; cIdx < caps.length; cIdx++) {
          const cl = capsuleDist(ik, ik.segPt, caps[cIdx]) - armR1;
          if (cl < minClear) minClear = cl;
        }
      }
      for (let sIdx = 0; sIdx < 4; sIdx++) {
        const u = 0.22 + sIdx * 0.24;
        ik.segPt.copy(ik.candE).lerp(clampedTgt, u);
        for (let cIdx = 0; cIdx < caps.length; cIdx++) {
          const cl = capsuleDist(ik, ik.segPt, caps[cIdx]) - armR2;
          if (cl < minClear) minClear = cl;
        }
      }

      const clearNorm = minClear / scale;
      const collisionPen = clearNorm < 0 ? (110 + Math.abs(clearNorm) * 850) : 0;
      // Prefer naturally relaxed downward elbows close to ribs (anti-scarecrow!)
      const gravityBonus = clamp(-upv, -0.08, 0.28) * 2.4 - Math.max(0, lat - 0.15) * 2.8;
      const outBonus = clamp(lat, 0.0, 0.16) * 1.4;
      const fwdBonus = clamp(fwd, -0.08, 0.24) * 1.1;
      const poleAlign = ik.candB.dot(ik.uP) * 0.45;
      const cont = (bendMem && bendMem.lengthSq() > 0.2) ? bendMem.dot(ik.candB) * 0.95 : 0;
      const score = clearNorm * 3.0 + gravityBonus + outBonus + fwdBonus + poleAlign + cont - collisionPen - Math.abs(deg) * 0.002;

      if (score > bestScore) {
        bestScore = score;
        ik.bestE.copy(ik.candE);
        ik.bestB.copy(ik.candB);
        found = true;
      }
    }

    if (!found) {
      ik.bestB.copy(ik.uP);
      ik.bestE.copy(ik.S).addScaledVector(ik.uD, x).addScaledVector(ik.uP, y);
    }
    if (bendMem) {
      if (bendMem.lengthSq() < 0.2) bendMem.copy(ik.bestB);
      else bendMem.lerp(ik.bestB, 0.22).normalize();
    }
    if (outElbowWorld) outElbowWorld.copy(ik.bestE);

    // Orthonormal world basis for upperBone (-Y along S -> E) and lowerBone (-Y along E -> W)
    ik.dir1.subVectors(ik.bestE, ik.S).normalize();
    ik.yAx.copy(ik.dir1).negate();
    ik.xAx.crossVectors(ik.uD, ik.bestB);
    if (ik.xAx.lengthSq() < 1e-6) ik.xAx.copy(ik.charRight);
    ik.xAx.addScaledVector(ik.yAx, -ik.xAx.dot(ik.yAx));
    if (ik.xAx.lengthSq() < 1e-6) ik.xAx.set(1, 0, 0);
    else ik.xAx.normalize();
    ik.zAx.crossVectors(ik.xAx, ik.yAx).normalize();

    ik.mUpper.makeBasis(ik.xAx, ik.yAx, ik.zAx);
    ik.qUpper.setFromRotationMatrix(ik.mUpper); // world quat of upperBone
    parentBone.getWorldQuaternion(ik.qParentWorld);
    upperBone.quaternion.copy(ik.qParentWorld).invert().multiply(ik.qUpper);

    ik.dir2.subVectors(clampedTgt, ik.bestE).normalize();
    ik.yAx2.copy(ik.dir2).negate();
    ik.zAx2.crossVectors(ik.xAx, ik.yAx2);
    if (ik.zAx2.lengthSq() < 1e-6) ik.zAx2.copy(ik.charFwd);
    else ik.zAx2.normalize();
    const xAx2 = ik.N.crossVectors(ik.yAx2, ik.zAx2).normalize();

    ik.mLower.makeBasis(xAx2, ik.yAx2, ik.zAx2);
    ik.qLowerWorld.setFromRotationMatrix(ik.mLower); // world quat of lowerBone
    ik.qUpperInv.copy(ik.qUpper).invert();
    lowerBone.quaternion.copy(ik.qUpperInv).multiply(ik.qLowerWorld);
    upperBone.updateMatrixWorld(true);
    lowerBone.updateMatrixWorld(true);
  }

  /* True 3-DOF Wrist Orientation + Anatomical Radius-Ulna Forearm Twist Sharing:
     - Clamps wrist bend angle relative to forearm within physiological 38° limit (zero boxy wrist kinks!)
     - Distributes 55% of pronation/supination twist onto B_FARM along local Y (leaving wrist position 100% invariant!)
     - Orients B_HAND so local -Y = fingerDirWorld and local (-side * X) = palmNormalWorld */
  function solveHandGrip(ik, lowerBone, handBone, side, palmNormalWorld, fingerDirWorld, maxWristRad = 0.66) {
    lowerBone.updateMatrixWorld(true);
    handBone.updateMatrixWorld(true);
    lowerBone.getWorldPosition(ik.S);
    handBone.getWorldPosition(ik.J);
    ik.fArmDir.subVectors(ik.J, ik.S);
    if (ik.fArmDir.lengthSq() > 1e-8) ik.fArmDir.normalize();
    else ik.fArmDir.set(0, -1, 0);

    if (fingerDirWorld && fingerDirWorld.lengthSq() > 1e-6) {
      ik.fDir.copy(fingerDirWorld).normalize();
      // Clamp angular deviation between forearm axis and metacarpal finger axis to prevent sharp pipe kinks
      const cosAng = clamp(ik.fArmDir.dot(ik.fDir), -1, 1);
      const ang = Math.acos(cosAng);
      if (ang > maxWristRad && ang > 1e-5) {
        const t = maxWristRad / ang;
        ik.fDir.copy(ik.fArmDir).lerp(ik.fDir, t).normalize();
      }
    } else {
      ik.fDir.copy(ik.fArmDir);
    }

    ik.yAx.copy(ik.fDir).negate(); // local +Y = -fingerDirWorld
    if (palmNormalWorld && palmNormalWorld.lengthSq() > 1e-6) {
      ik.pNrm.copy(palmNormalWorld).normalize();
    } else {
      ik.pNrm.set(-side, 0, 0);
    }
    ik.pNrm.addScaledVector(ik.yAx, -ik.pNrm.dot(ik.yAx));
    if (ik.pNrm.lengthSq() < 1e-6) {
      ik.pNrm.set(0, 1, 0).addScaledVector(ik.yAx, -ik.yAx.y);
      if (ik.pNrm.lengthSq() < 1e-6) ik.pNrm.set(1, 0, 0);
    }
    ik.pNrm.normalize();

    // Local palmar normal is (-side, 0, 0), so world X axis of B_HAND is (-side) * palmNormal
    ik.xAx.copy(ik.pNrm).multiplyScalar(-side);
    ik.zAx.crossVectors(ik.xAx, ik.yAx).normalize();

    ik.mHand.makeBasis(ik.xAx, ik.yAx, ik.zAx);
    ik.qHandWorld.setFromRotationMatrix(ik.mHand);

    // Share 55% of longitudinal pronation/supination twist onto B_FARM (since B_HAND rest is (0, -L_FARM, 0), wrist pos is invariant!)
    lowerBone.getWorldQuaternion(ik.qLowerWorld);
    ik.qRel.copy(ik.qLowerWorld).invert().multiply(ik.qHandWorld);
    if (ik.qRel.w < 0) ik.qRel.set(-ik.qRel.x, -ik.qRel.y, -ik.qRel.z, -ik.qRel.w);
    const twistY = clamp(2 * Math.atan2(ik.qRel.y, ik.qRel.w), -1.48, 1.48);
    lowerBone.rotateY(twistY * 0.55);
    lowerBone.updateMatrixWorld(true);

    lowerBone.getWorldQuaternion(ik.qLowerWorld);
    handBone.quaternion.copy(ik.qLowerWorld).invert().multiply(ik.qHandWorld);
    handBone.updateMatrixWorld(true);
  }

  /* ---------- Anatomical 5-Finger Knuckle-Flexion Sculpted Hand & Laced Work Boot ---------- */
  let cachedHandGeos = null;
  function getHandGeos(T) {
    if (cachedHandGeos) return cachedHandGeos;
    const makePalm = side => {
      // Watertight capped distal knuckle ridge (-0.0785m) & proximal carpus (+0.015m) so 90° flexed fingers never expose an open rim!
      const palmRings = refineRings([
        { p: [0, -0.0785, 0.002], w: 0.0004, f: 0.0004, b: 0.0004, e: 1.00 },
        { p: [0, -0.0765, 0.002], w: 0.0045, f: 0.031,  b: 0.029,  e: 0.88 },
        { p: [0, -0.0725, 0.002], w: 0.0125, f: 0.036,  b: 0.034,  e: 0.80 },
        { p: [0, -0.052,  0.003], w: 0.0145, f: 0.038,  b: 0.035,  e: 0.84 },
        { p: [0, -0.026,  0.002], w: 0.0165, f: 0.035,  b: 0.031,  e: 0.88 },
        { p: [0, -0.004,  0.000], w: 0.0185, f: 0.027,  b: 0.026,  e: 0.92 },
        { p: [0,  0.012,  0.000], w: 0.0195, f: 0.025,  b: 0.025,  e: 0.94 },
        { p: [0,  0.0155, 0.000], w: 0.0004, f: 0.0004, b: 0.0004, e: 1.00 }
      ], 2);
      return loftY(T, palmRings, {
        seg: 16,
        orthoWeight: 0,
        sculpt: (r, lx, lz) => {
          const y = r.p[1];
          const palmarSide = (-side * lx) > 0 ? 1 : 0;
          const hollow = palmarSide * g2(y, lz, -0.046, 0.000, 0.022, 0.020) * 0.0045;
          const thenar = palmarSide * g2(y, lz, -0.032, 0.024, 0.020, 0.016) * 0.0065;
          return [side * (hollow - thenar), 0, thenar * 0.35];
        }
      });
    };
    const fSpecs = [
      { z:  0.0245, y: -0.070, len: 0.066, r: 0.0080, splay:  0.055 }, // Index
      { z:  0.0085, y: -0.073, len: 0.072, r: 0.0084, splay:  0.015 }, // Middle
      { z: -0.0075, y: -0.071, len: 0.067, r: 0.0079, splay: -0.025 }, // Ring
      { z: -0.0225, y: -0.066, len: 0.054, r: 0.0070, splay: -0.065 }  // Pinky
    ];
    const fingerPhalanges = fSpecs.map(fs => {
      const l1 = fs.len * 0.45, l2 = fs.len * 0.31, l3 = fs.len * 0.24;
      return {
        fs, l1, l2, l3,
        g1: new T.CapsuleGeometry(fs.r, Math.max(0.004, l1 - fs.r * 0.9), 3, 6),
        g2: new T.CapsuleGeometry(fs.r * 0.88, Math.max(0.003, l2 - fs.r * 0.8), 3, 6),
        g3: new T.CapsuleGeometry(fs.r * 0.76, Math.max(0.002, l3 - fs.r * 0.7), 3, 6)
      };
    });
    const tL1 = 0.033, tL2 = 0.026;
    cachedHandGeos = {
      palmL: makePalm(+1),
      palmR: makePalm(-1),
      fingerPhalanges,
      tL1, tL2,
      thumbG1: new T.CapsuleGeometry(0.0092, tL1 - 0.008, 3, 6),
      thumbG2: new T.CapsuleGeometry(0.0080, tL2 - 0.007, 3, 6)
    };
    return cachedHandGeos;
  }

  function buildSculptedHand(T, side, skinMat) {
    const hg = getHandGeos(T);
    const g = new T.Group();

    const palmMesh = new T.Mesh(side > 0 ? hg.palmL : hg.palmR, skinMat);
    palmMesh.castShadow = false;
    palmMesh.receiveShadow = false;
    g.add(palmMesh);

    const fingersRoot = new T.Group();
    g.add(fingersRoot);

    const fingers = [];
    for (let i = 0; i < hg.fingerPhalanges.length; i++) {
      const fp = hg.fingerPhalanges[i];
      const { fs, l1, l2, l3 } = fp;

      const mcp = new T.Group();
      mcp.position.set(0, fs.y, fs.z);
      mcp.rotation.order = "XZY";
      const seg1 = new T.Mesh(fp.g1, skinMat);
      seg1.castShadow = false; seg1.receiveShadow = false;
      seg1.position.set(0, -l1 * 0.5, 0);
      mcp.add(seg1);

      const pip = new T.Group();
      pip.position.set(0, -l1, 0);
      const seg2 = new T.Mesh(fp.g2, skinMat);
      seg2.castShadow = false; seg2.receiveShadow = false;
      seg2.position.set(0, -l2 * 0.5, 0);
      pip.add(seg2);

      const dip = new T.Group();
      dip.position.set(0, -l2, 0);
      const seg3 = new T.Mesh(fp.g3, skinMat);
      seg3.castShadow = false; seg3.receiveShadow = false;
      seg3.position.set(0, -l3 * 0.5, 0);
      dip.add(seg3);

      pip.add(dip);
      mcp.add(pip);
      fingersRoot.add(mcp);
      fingers.push({ mcp, pip, dip, splay: fs.splay });
    }

    const thumbCmc = new T.Group();
    thumbCmc.position.set(-side * 0.009, -0.026, 0.028);
    thumbCmc.rotation.order = "YZX";
    const thumbSeg1 = new T.Mesh(hg.thumbG1, skinMat);
    thumbSeg1.castShadow = false; thumbSeg1.receiveShadow = false;
    thumbSeg1.position.set(0, -hg.tL1 * 0.5, 0);
    thumbCmc.add(thumbSeg1);

    const thumbIp = new T.Group();
    thumbIp.position.set(0, -hg.tL1, 0);
    const thumbSeg2 = new T.Mesh(hg.thumbG2, skinMat);
    thumbSeg2.castShadow = false; thumbSeg2.receiveShadow = false;
    thumbSeg2.position.set(0, -hg.tL2 * 0.5, 0);
    thumbIp.add(thumbSeg2);
    thumbCmc.add(thumbIp);
    fingersRoot.add(thumbCmc);

    let lastCurl = -1, lastSpread = -1, lastMode = "";
    g.userData.setLodNear = isNear => {
      fingersRoot.visible = Boolean(isNear);
    };

    /* Anatomical knuckle flexion across palmar face (-side * Z rotates -Y -> -side * X into palm!):
       mode: "wrap" | "pumpBar" | "handleTop" | "cradle" | "underRib" | "pinch" | "flat" */
    g.userData.setCurl = (curl, spread = 0.22, mode = "wrap") => {
      if (!fingersRoot.visible) return;
      const cBase = clamp(curl, 0, 1.15);
      if (Math.abs(cBase - lastCurl) < 0.003 && Math.abs(spread - lastSpread) < 0.005 && mode === lastMode) return;
      lastCurl = cBase; lastSpread = spread; lastMode = mode;

      for (let i = 0; i < fingers.length; i++) {
        const f = fingers[i];
        let c = cBase * (0.90 + i * 0.07);
        let mcpA, pipA, dipA, sp = spread;
        if (mode === "pinch") {
          if (i === 0) {
            mcpA = 0.58; pipA = 0.78; dipA = 0.42; sp = 0.08;
          } else {
            const k = 0.72 + i * 0.10;
            mcpA = 0.88 * k; pipA = 1.05 * k; dipA = 0.68 * k; sp = 0.12;
          }
        } else if (mode === "cradle") {
          mcpA = c * 0.72;
          pipA = c * 0.84;
          dipA = c * 0.36;
          sp = 0.28;
        } else if (mode === "underRib") {
          mcpA = c * 0.68;
          pipA = c * 0.86;
          dipA = c * 0.52;
          sp = 0.26;
        } else if (mode === "handleTop") {
          mcpA = c * 0.82;
          pipA = c * 1.24;
          dipA = c * 0.88;
          sp = 0.18;
        } else if (mode === "flat") {
          mcpA = 0.12 + c * 0.35;
          pipA = 0.16 + c * 0.40;
          dipA = 0.10 + c * 0.25;
          sp = 0.34;
        } else {
          mcpA = c * 1.06;
          pipA = c * 1.18;
          dipA = c * 0.76;
        }
        f.mcp.rotation.x = -f.splay * (0.35 + sp * 1.15);
        f.mcp.rotation.z = -side * mcpA;
        f.pip.rotation.z = -side * pipA;
        f.dip.rotation.z = -side * dipA;
      }

      if (mode === "pinch") {
        thumbCmc.rotation.set(0.52, side * 0.52, -side * 0.46);
        thumbIp.rotation.z = -side * 0.52;
      } else if (mode === "cradle") {
        thumbCmc.rotation.set(0.62, side * 0.22, -side * 0.18);
        thumbIp.rotation.z = -side * (0.20 + cBase * 0.22);
      } else if (mode === "flat") {
        thumbCmc.rotation.set(0.46, side * 0.12, side * 0.10);
        thumbIp.rotation.z = -side * 0.12;
      } else if (mode === "handleTop") {
        thumbCmc.rotation.set(0.42, side * 0.46, -side * 0.48);
        thumbIp.rotation.z = -side * 0.64;
      } else {
        thumbCmc.rotation.set(0.48 - cBase * 0.14, side * (0.18 + cBase * 0.42), -side * (0.10 + cBase * 0.48));
        thumbIp.rotation.z = -side * (0.18 + cBase * 0.62);
      }
    };
    g.userData.setCurl(0.25, 0.22, "wrap");
    return g;
  }

  function buildLacedWorkBoot(T, side, assets) {
    const bootG = new T.Group();
    const bootRings = refineRings([
      { p: [0, -0.072, 0.048], w: 0.050, f: 0.118, b: 0.088, e: 0.72 },
      { p: [0, -0.052, 0.046], w: 0.052, f: 0.122, b: 0.090, e: 0.76 },
      { p: [0, -0.026, 0.034], w: 0.049, f: 0.106, b: 0.082, e: 0.84 },
      { p: [0,  0.005, 0.008], w: 0.044, f: 0.062, b: 0.060, e: 0.92 },
      { p: [0,  0.048, 0.002], w: 0.046, f: 0.054, b: 0.054, e: 0.94 },
      { p: [0,  0.078, 0.000], w: 0.049, f: 0.056, b: 0.056, e: 0.94 }
    ], 2);
    const upperGeo = loftY(T, bootRings, {
      seg: 22,
      orthoWeight: 0,
      color: (r, sa, ca, v) => {
        const mud = (1 - smooth(0.0, 0.45, v)) * (0.14 + 0.10 * fbm(sa * 4 + side, v * 8, 2));
        const scuff = ca > 0.6 && v < 0.35 ? 0.08 : 0;
        const base = 0.76 + 0.16 * v + scuff;
        return [base + mud * 0.45, base + mud * 0.38, base + mud * 0.26];
      }
    });
    const bootMat = assets.leatherWorn.clone();
    bootMat.vertexColors = true;
    bootG.add(new T.Mesh(upperGeo, bootMat));

    const soleRings = [
      { p: [0, -0.085, 0.048], w: 0.054, f: 0.124, b: 0.093, e: 0.68 },
      { p: [0, -0.068, 0.048], w: 0.054, f: 0.124, b: 0.093, e: 0.68 }
    ];
    bootG.add(new T.Mesh(loftY(T, soleRings, { seg: 20, orthoWeight: 0 }), assets.bootSoleMat));

    for (let i = 0; i < 4; i++) {
      const ly = -0.018 + i * 0.020, lz = 0.078 - i * 0.011;
      const lace = new T.Mesh(roundedBox(T, 0.046, 0.006, 0.010, 0.002, 1), assets.leatherDark);
      lace.position.set(0, ly, lz);
      lace.rotation.z = (i % 2 ? 1 : -1) * 0.16;
      bootG.add(lace);
    }
    return bootG;
  }

  /* ---------- Build Shared / Per-Actor 20 L Translucent Cyan-Chalk Jerrycan (`WATER = WIFI`) ---------- */
  function build20LWaterWifiCan(T, assets, withPourAndRipples = true) {
    const canRoot = new T.Group();
    const canShellMat = new T.MeshStandardMaterial({
      color: 0xc2ecfa, emissive: 0x0b5878, emissiveIntensity: 0.30,
      roughness: 0.24, transparent: true, opacity: 0.88
    });
    const body = new T.Mesh(roundedBox(T, 0.195, 0.365, 0.275, 0.032, 2), canShellMat);
    canRoot.add(body);

    const innerLiq = new T.Mesh(roundedBox(T, 0.172, 0.255, 0.250, 0.022, 1), assets.cyanWaterMat);
    innerLiq.position.y = -0.035;
    canRoot.add(innerLiq);

    // 4 L survival chalk reserve mark around lower fifth of jerrycan
    const chalkBand = new T.Mesh(roundedBox(T, 0.199, 0.009, 0.279, 0.003, 1), assets.chalkLineMat);
    chalkBand.position.y = -0.105;
    canRoot.add(chalkBand);

    // Embossed 'X' stiffening ribs + glowing WATER = WIFI / SIGNAL OF GOD stencil decals on both flanks
    for (const sx of [-1, 1]) {
      for (const rz of [-0.62, 0.62]) {
        const rib = new T.Mesh(roundedBox(T, 0.010, 0.24, 0.020, 0.004, 1), canShellMat);
        rib.position.set(sx * 0.098, -0.01, 0);
        rib.rotation.x = rz;
        canRoot.add(rib);
      }
      const decal = new T.Mesh(new T.PlaneGeometry(0.19, 0.22), assets.jugDecalMat);
      decal.position.set(sx * 0.101, 0.01, 0);
      decal.rotation.y = sx > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      canRoot.add(decal);
    }

    // Blow-molded tubular top carry handle + front/rear risers (creating a real finger pass-through slot!) + blue cap
    const hdl = new T.Mesh(roundedBox(T, 0.026, 0.020, 0.142, 0.008, 1), canShellMat);
    hdl.position.set(0, 0.212, -0.022);
    canRoot.add(hdl);
    for (const hz of [-0.080, 0.036]) {
      const riser = new T.Mesh(roundedBox(T, 0.026, 0.028, 0.022, 0.005, 1), canShellMat);
      riser.position.set(0, 0.194, hz);
      canRoot.add(riser);
    }
    const spout = new T.Mesh(new T.CylinderGeometry(0.028, 0.031, 0.044, 12), assets.penBlueMat);
    spout.position.set(0, 0.202, 0.092);
    spout.rotation.x = 0.26;
    canRoot.add(spout);

    // World-space IK grip anchors on the jerrycan for synchronized two-person handoff & pour:
    // - gripLeadL: centered inside the blow-molded top handle slot
    // - gripLeadR: underneath the rear-bottom corner bevel for real 20 kg support & tilt leverage
    // - gripPartnerL/R: underneath the front-bottom bevels so receiving palms cup physical weight from below!
    const gripLeadL = new T.Object3D();    gripLeadL.position.set( 0.002,  0.208, -0.022); canRoot.add(gripLeadL);
    const gripLeadR = new T.Object3D();    gripLeadR.position.set(-0.018, -0.178, -0.108); canRoot.add(gripLeadR);
    const gripPartnerL = new T.Object3D(); gripPartnerL.position.set(-0.068, -0.174,  0.092); canRoot.add(gripPartnerL);
    const gripPartnerR = new T.Object3D(); gripPartnerR.position.set( 0.068, -0.174,  0.092); canRoot.add(gripPartnerR);

    let streamMesh = null;
    let streamCoreMesh = null;
    const ripples = [];
    const splashDrops = [];
    const rippleGrp = new T.Group();
    let stepBallisticPour = null;

    if (withPourAndRipples) {
      const buildStreamGrid = (segS, segR) => {
        const cols = segR + 1;
        const vCnt = (segS + 1) * cols;
        const pos = new Float32Array(vCnt * 3);
        const nrm = new Float32Array(vCnt * 3);
        const uvs = new Float32Array(vCnt * 2);
        const idx = [];
        for (let i = 0; i <= segS; i++) {
          for (let j = 0; j <= segR; j++) {
            const o = (i * cols + j) * 2;
            uvs[o] = j / segR;
            uvs[o + 1] = i / segS;
          }
        }
        for (let i = 0; i < segS; i++) {
          for (let j = 0; j < segR; j++) {
            const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
            idx.push(a, c, b, b, c, d);
          }
        }
        const geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.BufferAttribute(pos, 3));
        geo.setAttribute("normal", new T.BufferAttribute(nrm, 3));
        geo.setAttribute("uv", new T.BufferAttribute(uvs, 2));
        geo.setIndex(idx);
        geo.boundingSphere = new T.Sphere(new T.Vector3(0, 0.5, 0.4), 2.5);
        return geo;
      };

      // Parabolic stream lives inside unrotated `rippleGrp` (in character/world group space) so gravity is ALWAYS true -Y!
      streamMesh = new T.Mesh(buildStreamGrid(18, 12), assets.cyanWaterMat);
      streamMesh.frustumCulled = false;
      streamMesh.visible = false;
      rippleGrp.add(streamMesh);

      const coreMat = new T.MeshBasicMaterial({
        color: 0xe2fdff, transparent: true, opacity: 0.80, depthWrite: false
      });
      streamCoreMesh = new T.Mesh(buildStreamGrid(14, 8), coreMat);
      streamCoreMesh.frustumCulled = false;
      streamCoreMesh.visible = false;
      streamCoreMesh.renderOrder = 2;
      rippleGrp.add(streamCoreMesh);

      for (let r = 0; r < 3; r++) {
        const rm = new T.MeshBasicMaterial({
          color: r === 0 ? 0xeaffff : 0x8cf4ff,
          transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false
        });
        const ring = new T.Mesh(new T.RingGeometry(0.038, 0.056, 24), rm);
        ring.rotation.x = -Math.PI * 0.5;
        ring.renderOrder = 3;
        rippleGrp.add(ring);
        ripples.push({ mesh: ring, mat: rm, offset: r / 3 });
      }

      const dropGeo = new T.SphereGeometry(0.0085, 6, 5);
      const dropMat = new T.MeshBasicMaterial({ color: 0xdffcff, transparent: true, opacity: 0.92 });
      for (let d = 0; d < 10; d++) {
        const drop = new T.Mesh(dropGeo, dropMat);
        drop.visible = false;
        rippleGrp.add(drop);
        splashDrops.push(drop);
      }
      rippleGrp.visible = false;

      const spMouthW = new T.Vector3();
      const spDirW = new T.Vector3();
      const qCanW = new T.Quaternion();
      const qGrpInv = new T.Quaternion();

      stepBallisticPour = (nowSec, pourStrength, parentGroup, targetWaterY = 0.275, targetAimXZ = null) => {
        const amt = clamp(pourStrength, 0, 1.2);
        if (amt < 0.06 || !parentGroup) {
          streamMesh.visible = false;
          streamCoreMesh.visible = false;
          rippleGrp.visible = false;
          return;
        }
        rippleGrp.visible = true;
        rippleGrp.position.set(0, 0, 0);
        rippleGrp.rotation.set(0, 0, 0);
        streamMesh.visible = true;
        streamCoreMesh.visible = true;

        canRoot.updateWorldMatrix(true, true);
        parentGroup.updateWorldMatrix(true, false);

        spMouthW.set(0, 0.024, 0.004).applyMatrix4(spout.matrixWorld);
        parentGroup.worldToLocal(spMouthW);

        canRoot.getWorldQuaternion(qCanW);
        parentGroup.getWorldQuaternion(qGrpInv).invert();
        spDirW.set(0, 0.42, 0.91).normalize().applyQuaternion(qCanW).applyQuaternion(qGrpInv).normalize();

        const gAcc = 9.81;
        const x0 = spMouthW.x, y0 = spMouthW.y, z0 = spMouthW.z;
        const hitY = Math.min(y0 - 0.08, targetWaterY);
        const dyDrop = Math.max(0.08, y0 - hitY);

        // Launch velocity tracks spout orientation & tilts smoothly toward target bowl center when provided
        const vMag = lerp(0.68, 1.16, clamp(amt, 0, 1));
        let vx = spDirW.x * vMag;
        let vy0 = Math.min(0.18, spDirW.y * vMag);
        let vz = spDirW.z * vMag;
        let tFlight = (vy0 + Math.sqrt(vy0 * vy0 + 2.0 * gAcc * dyDrop)) / gAcc;

        if (targetAimXZ && tFlight > 0.05) {
          const wantVx = (targetAimXZ.x - x0) / tFlight;
          const wantVz = (targetAimXZ.z - z0) / tFlight;
          vx = lerp(vx, wantVx, 0.72);
          vz = lerp(vz, wantVz, 0.72);
        }

        const hitX = x0 + vx * tFlight;
        const hitZ = z0 + vz * tFlight;
        const baseR = 0.023 * (0.68 + 0.42 * clamp(amt, 0, 1));

        const writeTube = (mesh, segS, segR, radMul, isCore) => {
          const pos = mesh.geometry.attributes.position.array;
          const nrm = mesh.geometry.attributes.normal.array;
          const cols = segR + 1;
          for (let i = 0; i <= segS; i++) {
            const u = i / segS;
            const ti = u * tFlight;
            const px = x0 + vx * ti;
            const py = y0 + vy0 * ti - 0.5 * gAcc * ti * ti;
            const pz = z0 + vz * ti;

            let tx = vx, ty = vy0 - gAcc * ti, tz = vz;
            const tl = Math.hypot(tx, ty, tz) || 1;
            tx /= tl; ty /= tl; tz /= tl;

            let bx = -tz, by = 0, bz = tx;
            let bl = Math.hypot(bx, by, bz);
            if (bl < 1e-4) { bx = 1; by = 0; bz = 0; bl = 1; }
            bx /= bl; by /= bl; bz /= bl;

            const nx0 = by * tz - bz * ty;
            const ny0 = bz * tx - bx * tz;
            const nz0 = bx * ty - by * tx;

            const rProf = baseR * radMul * (1.0 - 0.28 * u + 0.24 * Math.pow(u, 4));
            for (let j = 0; j <= segR; j++) {
              const th = (j / segR) * TAU;
              const c = Math.cos(th), s = Math.sin(th);
              const hel1 = Math.sin(2.0 * th + u * 21.0 - nowSec * 16.5);
              const hel2 = Math.cos(3.0 * th - u * 15.0 - nowSec * 11.8);
              const rip = isCore
                ? (1.0 + 0.14 * hel1 * (0.3 + 0.7 * u))
                : (1.0 + (0.045 + 0.11 * u) * hel1 + 0.055 * u * hel2);
              const r = Math.max(0.002, rProf * rip);
              const rnx = nx0 * c + bx * s;
              const rny = ny0 * c + by * s;
              const rnz = nz0 * c + bz * s;
              const k3 = (i * cols + j) * 3;
              pos[k3]     = px + rnx * r;
              pos[k3 + 1] = py + rny * r;
              pos[k3 + 2] = pz + rnz * r;
              nrm[k3]     = rnx;
              nrm[k3 + 1] = rny;
              nrm[k3 + 2] = rnz;
            }
          }
          mesh.geometry.attributes.position.needsUpdate = true;
          mesh.geometry.attributes.normal.needsUpdate = true;
        };

        writeTube(streamMesh, 18, 12, 1.0, false);
        writeTube(streamCoreMesh, 14, 8, 0.44, true);

        for (let r = 0; r < ripples.length; r++) {
          const rp = ripples[r];
          const ph = frac(nowSec * 1.35 + rp.offset);
          const sc = lerp(0.42, 3.60, ph) * (0.75 + 0.35 * clamp(amt, 0, 1));
          rp.mesh.position.set(hitX, hitY + 0.004 + r * 0.0005, hitZ);
          rp.mesh.scale.set(sc, sc, 1);
          rp.mat.opacity = (1 - ph) * smooth(0.0, 0.16, ph) * 0.84 * clamp(amt, 0, 1);
        }

        for (let d = 0; d < splashDrops.length; d++) {
          const drop = splashDrops[d];
          drop.visible = true;
          const dPh = frac(nowSec * 2.4 + d * 0.137);
          const az = d * 2.39996 + Math.sin(nowSec * 0.8 + d) * 0.24;
          const vr = (0.16 + 0.09 * (d % 3)) * (0.65 + 0.50 * clamp(amt, 0, 1));
          const vyD = (0.78 + 0.36 * ((d * 5) % 4) / 3) * (0.65 + 0.52 * clamp(amt, 0, 1));
          const dtD = dPh * 0.23;
          const dyD = Math.max(0.004, vyD * dtD - 0.5 * gAcc * dtD * dtD);
          drop.position.set(hitX + Math.cos(az) * vr * dtD, hitY + dyD, hitZ + Math.sin(az) * vr * dtD);
          drop.scale.setScalar(Math.max(0.18, (1.0 - dPh * 0.72) * (0.72 + 0.46 * clamp(amt, 0, 1))));
        }
      };
    }

    return {
      canRoot, innerLiq, spout, streamMesh, streamCoreMesh, rippleGrp, ripples, splashDrops, stepBallisticPour,
      gripLeadL, gripLeadR, gripPartnerL, gripPartnerR
    };
  }

  /* ---------- Subtle Near-Proximity Inspector Tag (OFF in Machinima & OFF > 5.2 m) ---------- */
  function makeSubtleTag(T, name, role) {
    const c = document.createElement("canvas");
    c.width = 384; c.height = 68;
    const g = c.getContext("2d");
    const tex = new T.CanvasTexture(c);
    if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    const mat = new T.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: true, depthWrite: false });
    const sprite = new T.Sprite(mat);
    sprite.scale.set(0.88, 0.156, 1);
    sprite.visible = false;

    const draw = speech => {
      g.clearRect(0, 0, 384, 68);
      g.fillStyle = "rgba(10, 14, 15, 0.72)";
      g.beginPath();
      if (g.roundRect) g.roundRect(8, 8, 368, 52, 6);
      else g.rect(8, 8, 368, 52);
      g.fill();
      g.strokeStyle = "rgba(218, 212, 198, 0.32)";
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = "#f2ede2";
      g.font = "600 18px Georgia, serif";
      g.textAlign = "center";
      g.fillText(name, 192, 31);
      g.fillStyle = "rgba(182, 224, 222, 0.88)";
      g.font = "500 12px ui-monospace, Menlo, monospace";
      g.fillText((speech || role || "").slice(0, 40), 192, 50);
      tex.needsUpdate = true;
    };
    draw("");
    return { sprite, mat, draw };
  }

  /* ---------- Build One High-Resolution Donkey-Method Sculpted SkinnedMesh Character ---------- */
  function makeExpeditionCharacter(T, spec = {}) {
    const V3 = typeof window !== "undefined" ? window.HumanSculptV3 : null;
    const V6 = typeof window !== "undefined" ? window.HumanPhysicalV6 : null;
    const SGG = typeof window !== "undefined" ? window.ScionGroomGarments : null;
    const assets = getSharedAssets(T, spec.textureBase || spec.assetPath);
    const donkeyBase = resolveDonkeyBase(spec.textureBase || spec.assetPath);
    const assetsV3 = V3 ? V3.getAssetsV3(T, donkeyBase, true) : null;
    const group = new T.Group();
    const scale = spec.scale || 1.0;
    const build = spec.build || 1.0;
    const fem = spec.fem !== undefined ? spec.fem : 0.65;
    const isYouth = scale < 0.88;

    // Shared per-character smartphone / cyan-water uplight bounce uniform + T-pose-adapted hand cyan bounce uniform
    const cyanGlowUniform = { value: new T.Vector4(0, 1.15, 0.26, 0) };
    const handCyanGlowUniform = { value: new T.Vector4(0, 0.82, 0.04, 0) };

    const skinPlates = isYouth ? assets.platesChild : (fem >= 0.45 ? assets.platesImani : assets.platesCarrier);
    const useMaleHeadPortrait = !isYouth && fem < 0.45;

    const skinBase = new T.Color(spec.skinHex !== undefined ? spec.skinHex : 0x5c4030);
    if (!V3) skinBase.offsetHSL(0, -0.03, 0.09);

    const isLinearCol = new T.Color(0x808080).r < 0.35;
    const rawSkinCol = new T.Color(spec.skinHex !== undefined ? spec.skinHex : 0x5c4030);
    const bLinR = isLinearCol ? rawSkinCol.r : Math.pow(Math.max(0.001, rawSkinCol.r), 2.2);
    const bLinG = isLinearCol ? rawSkinCol.g : Math.pow(Math.max(0.001, rawSkinCol.g), 2.2);
    const bLinB = isLinearCol ? rawSkinCol.b : Math.pow(Math.max(0.001, rawSkinCol.b), 2.2);
    // Unified per-character linear skin albedo uniform shared identically across ALL body/arm/ear/hand skin meshes!
    const canonicalSkinUniform = { value: new T.Vector3(bLinR * 0.88, bLinG * 0.88, bLinB * 0.88) };

    const hairCol = new T.Color(spec.hairHex !== undefined ? spec.hairHex : 0x1e1916);
    if (hairCol.r + hairCol.g + hairCol.b < 0.30) hairCol.offsetHSL(0, 0, 0.04);

    // 100% Unified MeshPhysicalMaterial Skin PBR Constants across Face, Neck, Chest, Shoulders, Arms, Legs & Hands:
    // roughness = 0.72, metalness = 0.0, sheen = 0.42, sheenRoughness = 0.68, warm peach-amber sheenColor!
    const skinSheenCol = new T.Color(skinBase).lerp(new T.Color(0xe89872), 0.46);
    const SkinMatCtor = T.MeshPhysicalMaterial || T.MeshStandardMaterial;
    const makeUnifiedSkinMat = (roughVal, useVertCol) => {
      const m = new SkinMatCtor({
        color: skinBase,
        vertexColors: Boolean(useVertCol),
        roughness: V3 ? roughVal : 0.50,
        metalness: V3 ? 0.0 : 0.01,
        envMapIntensity: V3 ? 0.30 : 1.0,
        sheen: 0.42,
        sheenRoughness: 0.68,
        sheenColor: skinSheenCol,
        bumpMap: V3 ? null : assets.skinBump,
        bumpScale: V3 ? 0.0 : 0.006
      });
      m.userData = m.userData || {};
      m.userData.isSkin = true;
      return m;
    };
    const skinMat = makeUnifiedSkinMat(0.72, true);
    const skinMatPlain = makeUnifiedSkinMat(0.72, false);
    if (V3) {
      applyUnifiedBodySkinShader(T, skinMatPlain, { canonicalSkinUniform, cyanGlow: cyanGlowUniform, localOffsetY: 0.86 });
    } else {
      applyRigidCyanBounce(skinMatPlain, cyanGlowUniform, 0.86);
    }

    // Skinned bare deltoid/upper-arm/forearm/wrist material locked 1:1 to ScionNeck & watertight V3 hand cuff!
    const skinMatWrist = makeUnifiedSkinMat(0.72, false);
    if (V3) {
      applyUnifiedBodySkinShader(T, skinMatWrist, { canonicalSkinUniform, cyanGlow: cyanGlowUniform, localOffsetY: 0.0 });
    } else {
      applyRigidCyanBounce(skinMatWrist, cyanGlowUniform, 0.0);
    }

    const skinMatHeadRigid = makeUnifiedSkinMat(0.72, false);
    if (V3) {
      applyUnifiedBodySkinShader(T, skinMatHeadRigid, { canonicalSkinUniform, cyanGlow: cyanGlowUniform, localOffsetY: 0.0 });
    } else {
      applyRigidCyanBounce(skinMatHeadRigid, cyanGlowUniform, 0.0);
    }

    let portraitV3 = null;
    if (V3 && assetsV3) {
      portraitV3 = V3.selectPortraitArchetype(spec, assetsV3);
      V3.applyDualPortraitSubsurfaceShader(T, skinMat, {
        portrait: portraitV3,
        cyanGlow: cyanGlowUniform,
        photoMix: 0.87,
        sssStrength: 0.36,
        beardKeep: Boolean(spec.beard),
        hairRootColor: hairCol
      });
    } else {
      applyDonkeyOrthoShader(T, skinMat, {
        plates: skinPlates,
        cyanGlow: cyanGlowUniform,
        headMode: true,
        beardKeep: (useMaleHeadPortrait && spec.beard) ? 1.0 : 0.0,
        photoMix: useMaleHeadPortrait ? 0.24 : 0.14,
        chromaMix: 0.34,
        lumContrast: 0.68,
        rimSheen: 0.04,
        weaveGrain: 0.22,
        uSpan: 0.30
      });
    }
    skinMat.userData = skinMat.userData || {};
    const neckLeanUniform = skinMat.userData.uNeckLean || skinMat.userData.neckLeanUniform || { value: new T.Vector4(0, 0, 0, 0) };
    skinMat.userData.uNeckLean = neckLeanUniform;
    skinMat.userData.neckLeanUniform = neckLeanUniform;

    // Support `spec.openCollarBareArms` / `spec.neckStudyTank`: sleek highland scoop-neck sleeveless tunic
    // revealing unbroken skin continuity across face -> V-jaw -> leaning SCM neck -> full clavicles -> bare shoulders -> arms -> hands!
    const isTankBareArms = Boolean(spec.openCollarBareArms || spec.neckStudyTank);
    const outerStyle = isTankBareArms ? "none" : (spec.outer || "duster");
    const isPlainShirt = outerStyle === "none";
    const shirtPlates = isYouth ? assets.platesChild
      : (outerStyle === "duster" || outerStyle === "parka" || isPlainShirt) ? assets.platesImani
      : assets.platesCarrier;

    const shirtCol = new T.Color(spec.shirtHex !== undefined ? spec.shirtHex : 0x626662);
    shirtCol.offsetHSL(0, -0.02, isPlainShirt ? 0.06 : 0.12);
    const shirtMat = new T.MeshStandardMaterial({
      color: shirtCol,
      vertexColors: true,
      roughness: 0.84,
      map: assets.twillTex,
      bumpMap: assets.twillTex,
      bumpScale: 0.022
    });
    const cuffMat = shirtMat.clone();
    cuffMat.vertexColors = false;
    applyRigidCyanBounce(cuffMat, cyanGlowUniform, 0.86);

    applyDonkeyOrthoShader(T, shirtMat, {
      plates: shirtPlates,
      cyanGlow: cyanGlowUniform,
      headMode: false,
      photoMix: isPlainShirt ? 0.08 : (isYouth ? 0.32 : 0.68),
      chromaMix: isPlainShirt ? 0.16 : 0.45,
      lumContrast: isPlainShirt ? 0.42 : 0.90,
      rimSheen: 0.05,
      weaveGrain: 0.82,
      uSpan: 0.42
    });

    const trouserCol = new T.Color(spec.trouserHex !== undefined ? spec.trouserHex : 0x4b4f50);
    trouserCol.offsetHSL(0, -0.02, 0.12);
    const trouserMat = new T.MeshStandardMaterial({
      color: trouserCol,
      vertexColors: true,
      roughness: 0.86,
      map: assets.twillTex,
      bumpMap: assets.twillTex,
      bumpScale: 0.024
    });
    applyDonkeyOrthoShader(T, trouserMat, {
      plates: (outerStyle === "duster" || outerStyle === "parka") ? assets.platesImani : assets.platesCarrier,
      cyanGlow: cyanGlowUniform,
      headMode: false,
      photoMix: 0.66,
      chromaMix: 0.36,
      lumContrast: 0.92,
      rimSheen: 0.04,
      weaveGrain: 0.78,
      uSpan: 0.34
    });

    const isShamma = outerStyle === "shamma" || outerStyle === "apron";
    const outerTex = isShamma ? assets.shammaTex : assets.oilskinTex;
    const coatCol = new T.Color(spec.coatHex !== undefined ? spec.coatHex : 0x5d625c);
    if (!isShamma) coatCol.offsetHSL(0, -0.02, 0.18);
    const coatLum = coatCol.r * 0.299 + coatCol.g * 0.587 + coatCol.b * 0.114;
    const outerMat = new T.MeshStandardMaterial({
      color: coatCol,
      vertexColors: true,
      roughness: isShamma ? 0.91 : 0.76,
      map: outerTex,
      bumpMap: outerTex,
      bumpScale: isShamma ? 0.026 : 0.028
    });
    applyDonkeyOrthoShader(T, outerMat, {
      plates: isShamma ? assets.platesCarrier : assets.platesImani,
      cyanGlow: cyanGlowUniform,
      headMode: false,
      photoMix: isShamma ? (coatLum > 0.36 ? 0.74 : 0.56) : 0.72,
      chromaMix: isShamma ? 0.86 : 0.42,
      lumContrast: 0.94,
      rimSheen: isShamma ? 0.08 : 0.05,
      weaveGrain: isShamma ? 1.05 : 0.68,
      uSpan: 0.44
    });

    const hairMat = new T.MeshStandardMaterial({
      color: hairCol,
      roughness: 0.72,
      bumpMap: assets.hairBump,
      bumpScale: 0.026
    });

    /* --- 1. 56-Bone Anatomical Skeleton (+ 9 Volume/Garment/Hair Helpers = 65 THREE.Bones) --- */
    const skelBuild = isYouth ? build * 0.78 : build;
    let skelInfo;
    if (V3) {
      skelInfo = V3.createSkeleton56(T, skelBuild, fem);
    } else {
      const hipX0 = 0.094 * skelBuild;
      const shX0 = (0.184 - 0.016 * fem) * skelBuild;
      const LT = 0.40, LS = 0.39, LU = 0.275, LF = 0.255;
      const bArr = new Array(B_TOTAL_COUNT);
      for (let k = 0; k < B_TOTAL_COUNT; k++) bArr[k] = [0, 0, 0, 0];
      bArr[B_ROOT]      = [0, 0, 0, -1];
      bArr[B_PELVIS]    = [0, 0.885, 0.003, B_ROOT];
      bArr[B_LUMBAR]    = [0, 1.015, 0.014, B_PELVIS];
      bArr[B_THORAX]    = [0, 1.155, -0.010, B_LUMBAR];
      bArr[B_CHEST]     = [0, 1.295, -0.017, B_THORAX];
      bArr[B_NECK_LOW]  = [0, 1.422, -0.010, B_CHEST];
      bArr[B_NECK_HIGH] = [0, 1.480, -0.001, B_NECK_LOW];
      bArr[B_HEAD]      = [0, 1.534, 0.006, B_NECK_HIGH];
      bArr[B_JAW]       = [0, 1.564, 0.016, B_HEAD];
      for (const s of [1, -1]) {
        const bCl = s > 0 ? B_CLAV_L : B_CLAV_R, bUa = s > 0 ? B_UARM_L : B_UARM_R;
        const bEv = s > 0 ? B_ELBOW_VOL_L : B_ELBOW_VOL_R, bFa = s > 0 ? B_FARM_L : B_FARM_R;
        const bTw = s > 0 ? B_FARM_TWIST_L : B_FARM_TWIST_R, bHa = s > 0 ? B_HAND_L : B_HAND_R;
        bArr[bCl] = [s * 0.062 * build, 1.404, 0.008, B_CHEST];
        bArr[bUa] = [s * shX0, 1.385, -0.012, bCl];
        bArr[bEv] = [s * shX0, 1.385 - LU, -0.012, bUa];
        bArr[bFa] = [s * shX0, 1.385 - LU, -0.012, bUa];
        bArr[bTw] = [s * shX0, 1.385 - LU - LF * 0.52, -0.012, bFa];
        bArr[bHa] = [s * shX0, 1.385 - LU - LF, -0.012, bTw];
        const fStart = s > 0 ? 21 : 36;
        for (let f = 0; f < 15; f++) bArr[fStart + f] = [s * shX0, 1.385 - LU - LF - 0.03 * ((f % 3) + 1), -0.012, f % 3 === 0 ? bHa : (fStart + f - 1)];
      }
      bArr[B_ULEG_L] = [ hipX0, 0.875, 0, B_PELVIS];
      bArr[B_KNEE_VOL_L] = [ hipX0, 0.875 - LT, 0.004, B_ULEG_L];
      bArr[B_LLEG_L] = [ hipX0, 0.875 - LT, 0, B_ULEG_L];
      bArr[B_FOOT_L] = [ hipX0, 0.875 - LT - LS, 0, B_LLEG_L];
      bArr[B_TOE_L]  = [ hipX0, 0.875 - LT - LS - 0.055, 0.105, B_FOOT_L];
      bArr[B_ULEG_R] = [-hipX0, 0.875, 0, B_PELVIS];
      bArr[B_KNEE_VOL_R] = [-hipX0, 0.875 - LT, 0.004, B_ULEG_R];
      bArr[B_LLEG_R] = [-hipX0, 0.875 - LT, 0, B_ULEG_R];
      bArr[B_FOOT_R] = [-hipX0, 0.875 - LT - LS, 0, B_LLEG_R];
      bArr[B_TOE_R]  = [-hipX0, 0.875 - LT - LS - 0.055, 0.105, B_FOOT_R];
      bArr[B_COAT_B] = [0, 0.86, -0.11, B_PELVIS];
      bArr[B_COAT_L] = [ 0.13 * build, 0.86, 0.02, B_PELVIS];
      bArr[B_COAT_R] = [-0.13 * build, 0.86, 0.02, B_PELVIS];
      bArr[B_HAIR_TAIL] = [0, 1.592, -0.106, B_HEAD];
      const bs = bArr.map(([x, y, z, p]) => {
        const b = new T.Bone();
        if (p < 0) b.position.set(x, y, z);
        else b.position.set(x - bArr[p][0], y - bArr[p][1], z - bArr[p][2]);
        b.userData.rest = b.position.clone();
        b.userData.worldBind = new T.Vector3(x, y, z);
        b.userData.parentIdx = p;
        b.userData.isAnatomical = true;
        return b;
      });
      bArr.forEach((b, i) => { if (b[3] >= 0) bs[b[3]].add(bs[i]); });
      skelInfo = { bones: bs, bind: bArr, hipX: hipX0, shX: shX0, L_THIGH: LT, L_SHIN: LS, L_UARM: LU, L_FARM: LF };
    }

    const { bones, bind, hipX, shX, L_THIGH, L_SHIN, L_UARM, L_FARM } = skelInfo;
    group.add(bones[B_ROOT]);
    bones[B_ROOT].updateMatrixWorld(true);
    const skeleton = new T.Skeleton(bones);

    const addSkinned = (geo, mat) => {
      geo.boundingSphere = new T.Sphere(new T.Vector3(0, 1.05, 0), 2.85);
      const m = new T.SkinnedMesh(geo, mat);
      m.bind(skeleton);
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      return m;
    };

    /* --- 2 & 3. V3 Cranio-Mandibular Sculpted Head (seg=64), Multi-Fold Ears, Wet Cornea Eyes & Volumetric Hair --- */
    const headAnchor = new T.Group();
    headAnchor.position.set(-bind[B_HEAD][0], -bind[B_HEAD][1], -bind[B_HEAD][2]);
    bones[B_HEAD].add(headAnchor);

    const hairStyle = spec.hair || "croppedCoily";
    let lids = [];
    let hairCtrl = null;
    let garmentCtrl = null;
    const useScionGroom = Boolean(SGG && typeof SGG.buildHair === "function");
    const useScionGarments = Boolean(SGG && typeof SGG.buildGarmentsAndBoots === "function" && !isTankBareArms);

    let headMesh = null;
    let earsMesh = null;

    if (V3 && assetsV3) {
      headMesh = addSkinned(V3.buildCranioMandibularHeadGeo(T, spec, V3.B), skinMat);
      earsMesh = addSkinned(V3.buildSculptedHumanEarsGeo(T, V3.B), skinMat);
      if (typeof V3.buildOralAnatomyAssembly === "function" && !group.userData._oralBuilt) {
        const addOralSkinned = V6
          ? (geo, mat) => {
              // Clone first so V3's cached singleton oralGeo is NEVER mutated repeatedly across characters!
              const gClone = geo.clone();
              gClone.translate(0, 0, -0.0012);
              const om = addSkinned(gClone, mat);
              om.userData.isOral = true;
              return om;
            }
          : addSkinned;
        V3.buildOralAnatomyAssembly(T, spec, skeleton, addOralSkinned, headAnchor, assets, assetsV3, cyanGlowUniform);
      }
      lids = V3.buildWetEyeAssembly(T, headAnchor, assetsV3, skinMatHeadRigid, spec);
      if (useScionGroom) {
        hairCtrl = SGG.buildHair(T, spec, {
          B: V3.B,
          addSkinned,
          headAnchor,
          skeleton,
          cyanGlowUniform
        });
      } else {
        hairCtrl = V3.buildVolumetricHairAssembly(T, spec, skeleton, addSkinned, headAnchor, assets, assetsV3, cyanGlowUniform);
      }
    } else {
      const headRings = refineRings([
        { p: [0, 1.410, -0.010], w: 0.064, f: 0.062, b: 0.066, e: 0.96 },
        { p: [0, 1.486, -0.008], w: 0.052, f: 0.052, b: 0.058, e: 0.95 },
        { p: [0, 1.528,  0.004], w: 0.064, f: 0.090, b: 0.082, e: 0.90 },
        { p: [0, 1.586,  0.002], w: 0.076, f: 0.094, b: 0.104, e: 0.90 },
        { p: [0, 1.644, -0.004], w: 0.075, f: 0.090, b: 0.110, e: 0.92 },
        { p: [0, 1.724, -0.014], w: 0.018, f: 0.022, b: 0.024, e: 1.00 }
      ], 3);
      addSkinned(loftY(T, headRings, {
        seg: 40,
        color: () => 1.0,
        skin: r => r.p[1] < 1.49 ? [B_NECK_LOW, B_HEAD, 1 - smooth(1.42, 1.49, r.p[1])] : [B_HEAD, B_NECK_HIGH, 1]
      }), skinMat);
      for (const s of [1, -1]) {
        const ex = s * 0.0315, ey = 1.616, ez = 0.075;
        const eye = new T.Mesh(new T.SphereGeometry(0.011, 18, 14), assets.eyeMat);
        eye.position.set(ex, ey, ez); eye.rotation.order = "YXZ"; eye.rotation.y = -Math.PI * 0.5;
        headAnchor.add(eye);
        const uLid = new T.Mesh(new T.SphereGeometry(0.0122, 16, 10, 0, TAU, 0, Math.PI * 0.54), skinMatHeadRigid);
        uLid.position.set(ex, ey, ez); headAnchor.add(uLid);
        const lLid = new T.Mesh(new T.SphereGeometry(0.0119, 16, 8, 0, TAU, Math.PI * 0.53, Math.PI * 0.44), skinMatHeadRigid);
        lLid.position.set(ex, ey, ez); headAnchor.add(lLid);
        lids.push({ eye, uLid, lLid, s });
      }
      if (useScionGroom) {
        hairCtrl = SGG.buildHair(T, spec, { addSkinned, headAnchor, skeleton, cyanGlowUniform });
      }
    }

    // Woven Ethiopian Headwear (shashWrap & turban are built in 3D by ScionGroomGarments when present; keep feltHat & hood!)
    if (!useScionGroom && hairStyle === "shashWrap") {
      const wrapMat = new T.MeshStandardMaterial({
        color: spec.wrapHex !== undefined ? spec.wrapHex : 0xc8c0b0,
        roughness: 0.92,
        map: assets.shammaTex,
        bumpMap: assets.shammaTex,
        bumpScale: 0.024
      });
      applyRigidCyanBounce(wrapMat, cyanGlowUniform, 0);
      const wRings = refineRings([
        { p: [0, 1.608, -0.018], w: 0.083, f: 0.070, b: 0.112, e: 0.90 },
        { p: [0, 1.656, -0.014], w: 0.088, f: 0.088, b: 0.120, e: 0.90 },
        { p: [0, 1.708, -0.024], w: 0.081, f: 0.080, b: 0.118, e: 0.92 },
        { p: [0, 1.746, -0.036], w: 0.046, f: 0.048, b: 0.074, e: 0.96 }
      ], 2);
      headAnchor.add(new T.Mesh(loftY(T, wRings, {
        seg: 30, orthoWeight: 0,
        disp: (r, sa, ca, v) => 1 + 0.038 * Math.sin(v * 22 + sa * 3)
      }), wrapMat));
    } else if (!useScionGroom && hairStyle === "turban") {
      const turbMat = new T.MeshStandardMaterial({
        color: spec.wrapHex !== undefined ? spec.wrapHex : 0x5c5548,
        roughness: 0.92,
        map: assets.shammaTex,
        bumpMap: assets.shammaTex,
        bumpScale: 0.026
      });
      applyRigidCyanBounce(turbMat, cyanGlowUniform, 0);
      // Smooth circular/oval coiled turban (e >= 1.02, seg = 48) snugly hugging temples & occiput with zero angular flaps!
      const tRings = refineRings([
        { p: [0, 1.636, -0.014], w: 0.080, f: 0.086, b: 0.112, e: 1.02 },
        { p: [0, 1.678, -0.012], w: 0.094, f: 0.098, b: 0.122, e: 1.02 },
        { p: [0, 1.726, -0.016], w: 0.088, f: 0.092, b: 0.114, e: 1.04 },
        { p: [0, 1.766, -0.022], w: 0.044, f: 0.048, b: 0.060, e: 1.06 }
      ], 3);
      const turbMesh = new T.Mesh(loftY(T, tRings, {
        seg: 48, orthoWeight: 0,
        disp: (r, sa, ca, v) => 1 + 0.024 * Math.sin(v * 26 + sa * 2.0)
      }), turbMat);
      headAnchor.add(turbMesh);
    } else if (hairStyle === "feltHat" || hairStyle === "hood") {
      if (hairStyle === "feltHat") {
        const hatMat = new T.MeshStandardMaterial({ color: spec.hatHex || 0x2f2923, roughness: 0.88, bumpMap: assets.oilskinTex, bumpScale: 0.02 });
        const brim = new T.Mesh(new T.CylinderGeometry(0.165, 0.172, 0.010, 28), hatMat);
        brim.position.set(0, 1.664, 0.002);
        brim.rotation.x = -0.06;
        headAnchor.add(brim);
        const crown = new T.Mesh(loftY(T, refineRings([
          { p: [0, 1.664, -0.004], w: 0.085, f: 0.096, b: 0.106, e: 0.92 },
          { p: [0, 1.726, -0.008], w: 0.075, f: 0.086, b: 0.094, e: 0.90 },
          { p: [0, 1.750, -0.010], w: 0.056, f: 0.066, b: 0.072, e: 0.94 }
        ], 2), { seg: 26, orthoWeight: 0 }), hatMat);
        headAnchor.add(crown);
      } else {
        const hoodRings = refineRings([
          { p: [0, 1.515, -0.020], w: 0.105, f: 0.065, b: 0.120, e: 0.88 },
          { p: [0, 1.610, -0.012], w: 0.104, f: 0.082, b: 0.126, e: 0.88 },
          { p: [0, 1.696, -0.004], w: 0.096, f: 0.094, b: 0.120, e: 0.90 },
          { p: [0, 1.750, -0.018], w: 0.044, f: 0.048, b: 0.062, e: 0.96 }
        ], 2);
        headAnchor.add(new T.Mesh(loftOpenGarment(T, hoodRings, {
          seg: 24, a0: 0.56, a1: TAU - 0.56, thick: 0.012, orthoWeight: 0.35,
          fold: (r, u, v) => 0.008 * Math.sin(v * 14 + u * 9)
        }), outerMat));
        for (const s of [-1, 1]) {
          const gog = new T.Mesh(new T.TorusGeometry(0.017, 0.0032, 6, 16), assets.leatherDark);
          gog.position.set(s * 0.0315, 1.616, 0.093);
          headAnchor.add(gog);
        }
      }
    }

    /* --- 4. S-Curve Spine Torso + 3D Rolled V-Neck/Crew/Tank Collar Around y=1.408 ScionNeck Bust + Bare/Clothed Arms & Hands --- */
    const rolledSleeves = Boolean(spec.rolledSleeves) && outerStyle !== "shamma" && !isTankBareArms;
    const hasTibeb = Boolean(spec.tibebTrim);
    const ScNeck = typeof window !== "undefined" ? window.ScionNeck : null;
    const B_BUST_MAP = {
      HEAD: B_HEAD,
      JAW: B_JAW,
      NECK_HIGH: B_NECK_HIGH,
      NECK_LOW: B_NECK_LOW,
      CHEST: B_CHEST,
      CLAV_L: B_CLAV_L,
      CLAV_R: B_CLAV_R,
      UARM_L: B_UARM_L,
      UARM_R: B_UARM_R
    };

    // Per-character O(log N) ScionNeck v5.2 upper-thoracic/clavicular/trapezius bust surface sampler (clavicles y = 1.408m)
    const halfWNeckFallback = lerp(0.0580, 0.0525, fem) * lerp(1.0, build, 0.30) * (isYouth ? 0.94 : 1.0);
    const cachedBustRings = refineRings(
      ScNeck && typeof ScNeck.buildRawHeadNeckBustRings === "function"
        ? ScNeck.buildRawHeadNeckBustRings(spec)
        : [
            { p: [0, 1.258, -0.012], w: 0.135 * build,               f: 0.078, b: 0.088, e: 0.95 },
            { p: [0, 1.275, -0.012], w: 0.145 * build,               f: 0.088, b: 0.097, e: 0.94 },
            { p: [0, 1.335, -0.012], w: 0.146 * build,               f: 0.092, b: 0.099, e: 0.94 },
            { p: [0, 1.384, -0.012], w: 0.138 * lerp(1, build, 0.7), f: 0.078, b: 0.090, e: 0.96 },
            { p: [0, 1.408, -0.013], w: 0.112 * lerp(1, build, 0.5), f: 0.064, b: 0.081, e: 0.98 },
            { p: [0, 1.432, -0.014], w: lerp(halfWNeckFallback, 0.112 * lerp(1, build, 0.5), 0.36), f: 0.055, b: 0.070, e: 1.00 },
            { p: [0, 1.454, -0.015], w: halfWNeckFallback * 1.06,    f: 0.051, b: 0.062, e: 1.00 },
            { p: [0, 1.495, -0.015], w: halfWNeckFallback,           f: 0.049, b: 0.061, e: 1.00 }
          ],
      4
    );

    const evalBustAt = (yQuery, a) => {
      let lo = 0, hi = cachedBustRings.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cachedBustRings[mid].p[1] <= yQuery) lo = mid;
        else hi = mid;
      }
      const r0 = cachedBustRings[lo], r1 = cachedBustRings[hi];
      const tR = clamp((yQuery - r0.p[1]) / Math.max(1e-6, r1.p[1] - r0.p[1]), 0, 1);
      const z0 = lerp(r0.p[2], r1.p[2], tR);
      const w = lerp(r0.w, r1.w, tR);
      const f = lerp(r0.f, r1.f, tR);
      const b = lerp(r0.b, r1.b, tR);
      const e = lerp(r0.e || 1, r1.e || 1, tR);
      const sa = Math.sin(a), ca = Math.cos(a);
      const rz = ca >= 0 ? f : b;
      let lx = Math.sign(sa) * Math.pow(Math.abs(sa), e) * w;
      let lz = Math.sign(ca) * Math.pow(Math.abs(ca), e) * rz;
      let dy = 0;
      if (ScNeck && typeof ScNeck.evalCervicalClavicularRelief === "function") {
        const rel = ScNeck.evalCervicalClavicularRelief(Math.abs(lx), clamp(lx / 0.010, -1, 1), yQuery, ca, z0 + lz, z0, spec);
        lx += rel.dx; dy += rel.dy; lz += rel.dz;
      }
      return [lx, yQuery + dy, z0 + lz, z0];
    };

    const evalBustLockstepSkin = (px, py, pz) => {
      if (ScNeck && typeof ScNeck.computeBustSkinning === "function") {
        return ScNeck.computeBustSkinning(px, py, pz, B_BUST_MAP);
      }
      const ax = Math.abs(px);
      const tLow = smooth(1.395, 1.468, py - 0.026 * smooth(0.052, 0.116, ax));
      const clavFrac = 0.56 * smooth(0.040, 0.116, ax) * smooth(1.345, 1.408, py) * (1.0 - smooth(1.440, 1.472, py));
      const wChestBase = 1.0 - tLow;
      const wClav = wChestBase * clavFrac;
      const wChest = wChestBase * (1.0 - clavFrac);
      return {
        indices: [B_CHEST, px >= 0 ? B_CLAV_L : B_CLAV_R, B_NECK_LOW, 0],
        weights: [wChest, wClav, tLow, 0]
      };
    };

    const skinSpine = (y, sa, px, pz) => {
      if (y < 0.955) return [B_PELVIS, B_LUMBAR, 1 - smooth(0.822, 0.955, y)];
      if (y < 1.115) return [B_LUMBAR, B_THORAX, 1 - smooth(0.955, 1.115, y)];
      if (y < 1.275) return [B_THORAX, B_CHEST,  1 - smooth(1.115, 1.275, y)];
      const xx = px !== undefined ? px : sa * 0.10;
      const ax = Math.abs(xx);
      // Lateral acromial shoulder cap follow (~0.50 B_UARM + 0.34 B_CLAV on outer tip) so shirt shoulder drapes smoothly over deltoid!
      if (!isTankBareArms && isPlainShirt && y >= 1.295 && y <= 1.430 && ax > 0.115 * build) {
        const shW = smooth(0.115 * build, 0.205 * build, ax) * smooth(1.295, 1.370, y) * (1.0 - smooth(1.404, 1.432, y));
        const bCl = xx >= 0 ? B_CLAV_L : B_CLAV_R;
        const bUA = xx >= 0 ? B_UARM_L : B_UARM_R;
        const wUA = shW * 0.50;
        const wCl = shW * 0.34;
        return { indices: [B_CHEST, bCl, bUA, 0], weights: [1.0 - wUA - wCl, wCl, wUA, 0] };
      }
      if (y >= 1.320) return evalBustLockstepSkin(xx, y, pz !== undefined ? pz : 0.0);
      return [B_CHEST, B_THORAX, 1];
    };

    // Tailored 3D Shirt / Tunic / Scoop-Tank Collar Curve aligned 1:1 with True y = 1.408m Clavicles & Graceful 9.6cm Cylindrical Neck:
    // - `isTankBareArms` (`openCollarBareArms` / `neckStudyTank`): sleek highland scoop tunic (front 1.336, side 1.356, back 1.372)
    //    exposing unbroken skin across neck -> trapezius -> full S-clavicles -> upper chest -> bare deltoids -> arms -> hands!
    // - Crew/modest necklines (Hanna, Daniel, June): front scoop 1.372, side 1.422, back 1.430 (reveals clavicles & full neck column!)
    // - Open work shirts / tunics (Imani, Makeda, Elder): front V/scoop 1.348..1.354, side 1.420, back 1.428!
    const isCrewNeckShirt = !isTankBareArms && (
      isYouth
      || ((hairStyle === "ponytail" || hairStyle === "glassesCrop") && isPlainShirt)
      || (scale < 0.96 && outerStyle === "shamma")
    );
    const yCollarFront = isTankBareArms ? 1.334 : (isCrewNeckShirt ? 1.372 : (isPlainShirt ? 1.354 : 1.348));
    const yCollarSide  = isTankBareArms ? 1.304 : (isCrewNeckShirt ? 1.422 : 1.420);
    const yCollarBack  = isTankBareArms ? 1.348 : (isCrewNeckShirt ? 1.430 : 1.428);
    const evalShirtCollarY = ca => {
      if (isTankBareArms) {
        // Curved sleeveless highland scoop-tank bodice: open U-scoop front (1.334), front/back strap peaks at ca = ±0.58 (1.362/1.368), curved underarm scye (1.304)
        const strapPeakF = g1(ca,  0.58, 0.25);
        const strapPeakB = g1(ca, -0.58, 0.25);
        const underArm   = g1(ca,  0.00, 0.30);
        const baseY = ca >= 0 ? lerp(1.338, yCollarFront, Math.pow(ca, 1.45)) : lerp(1.344, yCollarBack, Math.pow(-ca, 1.45));
        return baseY + 0.027 * strapPeakF + 0.025 * strapPeakB - 0.034 * underArm;
      }
      if (ca < 0) return lerp(yCollarSide, yCollarBack, Math.pow(-ca, 1.35));
      const fwd = Math.max(0, ca);
      return yCollarSide - (yCollarSide - yCollarFront) * (0.58 * Math.pow(fwd, 1.40) + 0.42 * Math.pow(fwd, 3.15));
    };

    const buildTailoredTorsoGeo = () => {
      const seg = 48, cols = seg + 1;
      const lowerRings = refineRings([
        { p: [0, 0.822,  0.002], w: 0.165 * build, f: 0.120, b: 0.128, e: 0.86 },
        { p: [0, 0.935,  0.006], w: 0.151 * build, f: 0.110, b: 0.116, e: 0.88 },
        { p: [0, 1.095, -0.004], w: 0.154 * build, f: 0.114, b: 0.118, e: 0.88 },
        { p: [0, 1.285, -0.008], w: (0.168 - 0.010 * fem) * build, f: 0.122 + 0.012 * fem, b: 0.122, e: 0.87 }
      ], 3);

      // Upper chest + horizontal acromial shoulder crown (y ~ 1.404) + 3D rolled collar hem + inward watertight tuck into ScionNeck bust:
      const upperSteps = [
        { t: 0.18, mode: "outer", minClear: 0.0150 },
        { t: 0.38, mode: "outer", minClear: 0.0135 },
        { t: 0.56, mode: "outer", minClear: 0.0115 },
        { t: 0.72, mode: "outer", minClear: 0.0094 },
        { t: 0.86, mode: "outer", minClear: 0.0076 },
        { t: 0.95, mode: "outer", minClear: 0.0068 },
        { t: 1.00, mode: "crest", minClear: 0.0064 },
        { t: 1.00, mode: "roll",  minClear: 0.0026, dy:  0.0012 },
        { t: 1.00, mode: "tuck",  minClear: -0.0096, dy: -0.0115 }
      ];

      const nLow = lowerRings.length;
      const nTot = nLow + upperSteps.length;
      const pos = [], uv = [], col = [], si = [], sw = [], orthoP = [], idx = [];
      const rTopLow = lowerRings[nLow - 1];
      // Tailored acromial scye (`0.168` at armpit tapering early via `collarSnap` inside `slvRings` shoulder hood -> ZERO pinhole & ZERO shoulder crease!)
      const shCapW = ((isTankBareArms ? 0.154 : (isPlainShirt ? 0.168 : 0.156)) - 0.008 * fem) * build;

      const pushTorsoVert = (px, py, pz, sa, ca, vNorm, collarBandW, lipShade) => {
        pos.push(px, py, pz);
        uv.push(((Math.atan2(sa, ca) + TAU) % TAU) / TAU * 2.0, vNorm * 3.0);

        // Suppress 2D plate V-neck pale skin & chin shadow near the collar so shirt fabric stays 100% pure woven cloth!
        const yColHere = evalShirtCollarY(ca);
        const collarFade = 1.0 - smooth(yColHere - 0.068, yColHere - 0.016, py);
        const vNeckMask = smooth(1.20, 1.30, py) * smooth(0.22, 0.58, ca) * (1.0 - smooth(0.048 * build, 0.088 * build, Math.abs(px)));
        const ow = 0.94 * collarFade * (1.0 - 0.90 * vNeckMask) * (collarBandW > 0.5 ? 0.0 : 1.0);
        orthoP.push(px / build, py, pz, ow);

        // Pure fabric shade matched 1:1 to shirtHex (ZERO cyan-blue collar stain on June's warm oatmeal cream shirt!)
        const fold = (0.89 + 0.10 * Math.sin(sa * 6 + vNorm * 11)) * lerp(0.86, 1.02, clamp(vNorm, 0, 1)) * lipShade;
        if (!hasTibeb) {
          col.push(fold, fold, fold);
        } else {
          // Subtle warm hand-loomed oatmeal-umber geometric border weave ONLY at lower tunic hem (zero blue/cyan stain!)
          const hemBand = smooth(0.015, 0.035, vNorm) * (1.0 - smooth(0.075, 0.105, vNorm));
          if (hemBand < 0.01) {
            col.push(fold, fold, fold);
          } else {
            const motif = 0.5 + 0.5 * Math.sin((py * 165.0) + Math.abs(px) * 95.0) * Math.cos(sa * 48.0);
            const wv = lerp(1.0, 0.80 + 0.14 * motif, hemBand * 0.75);
            col.push(fold * wv, fold * wv * 0.97, fold * wv * 0.92);
          }
        }

        const sk = skinSpine(py, sa, px, pz);
        if (sk && sk.indices && sk.weights) {
          si.push(sk.indices[0] | 0, sk.indices[1] | 0, sk.indices[2] | 0, sk.indices[3] | 0);
          sw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
        } else {
          const b0 = sk[0] | 0, b1 = sk[1] | 0, wt = clamp(sk[2], 0, 1);
          si.push(b0, b1, 0, 0);
          sw.push(wt, 1 - wt, 0, 0);
        }
      };

      // 1. Lower & mid torso rings (y = 0.822 .. 1.285)
      for (let i = 0; i < nLow; i++) {
        const r = lowerRings[i], e = r.e || 1.0;
        const vNorm = (r.p[1] - 0.822) / (1.458 - 0.822);
        const rippleAmp = 0.022 * (1.0 - smooth(1.18, 1.285, r.p[1]));
        for (let j = 0; j <= seg; j++) {
          const a = (j / seg) * TAU, sa = Math.sin(a), ca = Math.cos(a);
          const rz = ca >= 0 ? r.f : r.b;
          const d = 1.0 + rippleAmp * Math.sin(sa * 7 + vNorm * 13);
          const lx = Math.sign(sa) * Math.pow(Math.abs(sa), e) * r.w * d;
          const lz = Math.sign(ca) * Math.pow(Math.abs(ca), e) * rz * d;
          pushTorsoVert(r.p[0] + lx, r.p[1], r.p[2] + lz, sa, ca, vNorm, 0.0, 1.0);
        }
      }

      // 2. Upper chest, horizontal acromial shoulder crown (peaking at uC=0.72 -> y~1.404), 3D rolled collar crest & watertight inner bust tuck
      for (let sIdx = 0; sIdx < upperSteps.length; sIdx++) {
        const st = upperSteps[sIdx];
        const uC = st.t;
        for (let j = 0; j <= seg; j++) {
          const a = (j / seg) * TAU, sa = Math.sin(a), ca = Math.cos(a);
          const yCol = evalShirtCollarY(ca);
          const pyBase = lerp(rTopLow.p[1], yCol, uC);
          const py = pyBase + (st.dy || 0.0);

          // Exact ScionNeck bust surface point & radial outward direction at (pyBase, a)
          const bp = evalBustAt(pyBase, a);
          const bx = bp[0], bz = bp[2], bz0 = bp[3];
          const rBust = Math.hypot(bx, bz - bz0) || 1e-4;
          const rxDir = bx / rBust, rzDir = (bz - bz0) / rBust;

          let px, pz, collarBandW = 0.0, lipShade = 1.0;
          if (st.mode === "outer") {
            // Peak lateral acromial crown high at uC=0.72 (y=1.404) so shoulders read horizontal & athletic, never 45° bottle-sloped!
            const eBase = lerp(rTopLow.e, 0.95, uC);
            const shBell = Math.sin(Math.pow(clamp(uC / 0.96, 0, 1), 0.72) * Math.PI);
            const wOuter = lerp(rTopLow.w, shCapW, clamp(shBell * 1.05, 0, 1) * Math.pow(Math.abs(sa), 0.85));
            const fOuter = lerp(rTopLow.f, 0.086, smooth(0.20, 0.95, uC));
            const bOuter = lerp(rTopLow.b, 0.096, smooth(0.20, 0.95, uC));
            const z0Outer = lerp(rTopLow.p[2], bz0, uC);
            const rzOuter = ca >= 0 ? fOuter : bOuter;
            const freeX = Math.sign(sa) * Math.pow(Math.abs(sa), eBase) * wOuter;
            const freeZ = z0Outer + Math.sign(ca) * Math.pow(Math.abs(ca), eBase) * rzOuter;

            const collarSnap = smooth(isPlainShirt ? 0.36 : 0.46, 0.96, uC);
            const wantColX = bx + rxDir * st.minClear;
            const wantColZ = bz + rzDir * st.minClear;
            px = lerp(freeX, wantColX, collarSnap);
            pz = lerp(freeZ, wantColZ, collarSnap);

            // Strict radial clearance guard so ScionNeck bust NEVER pokes through outer shirt!
            const curR = Math.hypot(px, pz - bz0);
            const minR = rBust + st.minClear;
            if (curR < minR) {
              const sc = minR / Math.max(1e-4, curR);
              px *= sc;
              pz = bz0 + (pz - bz0) * sc;
            }
            collarBandW = smooth(0.86, 0.96, uC);
            if (uC > 0.90) lipShade = 0.94;
          } else if (st.mode === "crest") {
            const lapelLift = (!isPlainShirt && ca > 0.35) ? 0.0018 * smooth(0.35, 0.85, ca) * (1.0 - smooth(0.88, 1.0, ca)) : 0.0;
            const effClear = st.minClear + lapelLift;
            px = bx + rxDir * effClear;
            pz = bz + rzDir * effClear;
            collarBandW = 1.0;
            lipShade = 1.03;
          } else if (st.mode === "roll") {
            px = bx + rxDir * st.minClear;
            pz = bz + rzDir * st.minClear;
            collarBandW = 1.0;
            lipShade = 0.78;
          } else {
            const bpTuck = evalBustAt(py, a);
            const rTuck = Math.hypot(bpTuck[0], bpTuck[2] - bpTuck[3]) || 1e-4;
            const rTarget = Math.max(0.018, rTuck + st.minClear);
            px = (bpTuck[0] / rTuck) * rTarget;
            pz = bpTuck[3] + ((bpTuck[2] - bpTuck[3]) / rTuck) * rTarget;
            collarBandW = 1.0;
            lipShade = 0.52;
          }

          const vNorm = clamp((py - 0.822) / (1.458 - 0.822), 0, 1);
          pushTorsoVert(px, py, pz, sa, ca, vNorm, collarBandW, lipShade);
        }
      }

      for (let i = 0; i < nTot - 1; i++) {
        for (let j = 0; j < seg; j++) {
          const A = i * cols + j, B = A + 1, C = A + cols, D = C + 1;
          idx.push(A, B, C, B, D, C);
        }
      }

      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
      g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
      g.setIndex(idx);
      g.computeVertexNormals();
      const N = g.attributes.normal;
      for (let i = 0; i < nTot; i++) {
        const a0 = i * cols, a1 = a0 + seg;
        const nx = N.getX(a0) + N.getX(a1), ny = N.getY(a0) + N.getY(a1), nz = N.getZ(a0) + N.getZ(a1);
        const nl = Math.hypot(nx, ny, nz) || 1;
        N.setXYZ(a0, nx / nl, ny / nl, nz / nl);
        N.setXYZ(a1, nx / nl, ny / nl, nz / nl);
      }
      g.setAttribute("aOrthoPos", new T.Float32BufferAttribute(orthoP, 4));
      g.setAttribute("aOrthoNrm", new T.Float32BufferAttribute(Float32Array.from(N.array), 3));
      return g;
    };

    const buildTankShoulderStrapsGeo = () => {
      const nLen = 20, nWid = 4, cols = nWid + 1;
      const pos = [], uv = [], col = [], si = [], sw = [], orthoP = [], idx = [];
      for (const s of [1, -1]) {
        const baseV = pos.length / 3;
        for (let layer = 0; layer < 2; layer++) {
          const clearOff = layer === 0 ? 0.0102 : 0.0048;
          const shade = layer === 0 ? 0.96 : 0.72;
          for (let i = 0; i <= nLen; i++) {
            const u = i / nLen;
            const arch = Math.sin(u * Math.PI);
            // Follow ScionNeck's exact shoulder contour: front strap root (a=0.58, y=1.346) -> outer clavicle (a=PI/2, y=1.405) -> back root (a=PI-0.58, y=1.352)
            const aCenter = s * lerp(0.58, Math.PI - 0.58, u);
            const pySurfBase = lerp(1.344, 1.350, u) + 0.061 * Math.pow(arch, 0.82);
            for (let j = 0; j <= nWid; j++) {
              const wFrac = j / nWid;
              // Across strap width (~2.4cm): inner edge sits closer to neck (higher y on trapezius slope), outer edge toward acromion
              const wCentered = wFrac - 0.5;
              const aHere = aCenter + s * wCentered * 0.14 * (1.0 - 0.55 * arch);
              const pyQuery = clamp(pySurfBase - wCentered * 0.006 * arch, 1.330, 1.4075);
              const bp = evalBustAt(pyQuery, aHere);
              const bx = bp[0] + s * wCentered * 0.022 * Math.pow(arch, 0.75);
              const by = bp[1];
              const bz = bp[2];
              const bz0 = bp[3];
              const rBust = Math.hypot(bx, bz - bz0) || 1e-4;
              const rxDir = bx / rBust, rzDir = (bz - bz0) / rBust;

              const nyLift = Math.pow(arch, 1.15);
              const nRad = 1.0 - 0.35 * nyLift;
              const edgeTuck = ((j === 0 || j === nWid) && layer === 0) ? -0.0010 : 0.0;
              const effOff = clearOff + edgeTuck;
              const strapOuterClear = 0.0055 * smooth(0.092 * build, 0.128 * build, Math.abs(bx));
              let px = bx + rxDir * (effOff + 0.0035 + strapOuterClear) * nRad;
              let py = by + (effOff + 0.0062 + strapOuterClear * 0.65) * nyLift;
              let pz = bz + rzDir * (effOff + 0.0035 + strapOuterClear) * nRad;
              // Exact post-shift radial guard against `ScionNeck` at `(py, atan2(px, pz - bz0))` so inner strap edge NEVER clips clavicle!
              if (py < 1.410) {
                const bpChk = evalBustAt(clamp(py, 1.320, 1.4075), Math.atan2(px, pz - bz0));
                const rNeed = Math.hypot(bpChk[0], bpChk[2] - bpChk[3]) + (layer === 0 ? 0.0065 : 0.0025);
                const rHave = Math.hypot(px, pz - bpChk[3]) || 1e-4;
                if (rHave < rNeed) {
                  const sc = rNeed / rHave;
                  px *= sc;
                  pz = bpChk[3] + (pz - bpChk[3]) * sc;
                }
              }

              pos.push(px, py, pz);
              uv.push(wFrac * 0.35, u * 1.6);
              orthoP.push(px / build, py, pz, 0.0);
              const edgeShade = (j === 0 || j === nWid) ? 0.91 : 1.0;
              const cVal = shade * edgeShade * (0.94 + 0.06 * arch);
              col.push(cVal, cVal, cVal);

              const sk = evalBustLockstepSkin(px, Math.min(1.408, py), pz);
              if (sk && sk.indices && sk.weights) {
                si.push(sk.indices[0] | 0, sk.indices[1] | 0, sk.indices[2] | 0, sk.indices[3] | 0);
                sw.push(sk.weights[0], sk.weights[1], sk.weights[2], sk.weights[3]);
              } else {
                si.push(B_CHEST, s > 0 ? B_CLAV_L : B_CLAV_R, 0, 0);
                sw.push(0.55, 0.45, 0, 0);
              }
            }
          }
        }
        const stride = (nLen + 1) * cols;
        for (let i = 0; i < nLen; i++) {
          for (let j = 0; j < nWid; j++) {
            const A = baseV + i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
            idx.push(A, Bv, C, Bv, D, C);
            const Ai = stride + A, Bi = stride + Bv, Ci = stride + C, Di = stride + D;
            idx.push(Ai, Ci, Bi, Bi, Ci, Di);
          }
        }
        for (let i = 0; i < nLen; i++) {
          const L0 = baseV + i * cols, L1 = baseV + (i + 1) * cols, Li0 = stride + L0, Li1 = stride + L1;
          idx.push(L0, L1, Li0, L1, Li1, Li0);
          const R0 = baseV + i * cols + nWid, R1 = baseV + (i + 1) * cols + nWid, Ri0 = stride + R0, Ri1 = stride + R1;
          idx.push(R0, Ri0, R1, R1, Ri0, Ri1);
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
      g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
      g.setIndex(idx);
      g.computeVertexNormals();
      g.setAttribute("aOrthoPos", new T.Float32BufferAttribute(orthoP, 4));
      g.setAttribute("aOrthoNrm", new T.Float32BufferAttribute(Float32Array.from(g.attributes.normal.array), 3));
      return g;
    };

    // Watertight Bare Axillary-Pectoral Skin Bridge (`isTankBareArms`):
    // Strictly below y = 1.382 and tucked inside `latTargetW <= shX * 0.90` (`wUA` up to 0.62 at lateral axilla)
    // so there is ZERO outer shoulder shelf cliff while sealing 100% of the inner armpit/pectoral wall when arms raise!
    const buildBareAxillaBridgeGeo = () => {
      const seg = 48, cols = seg + 1;
      const yLevels = [1.248, 1.276, 1.304, 1.330, 1.352, 1.370, 1.382];
      const pos = [], uv = [], col = [], si = [], sw = [], orthoP = [], idx = [];
      for (let i = 0; i < yLevels.length; i++) {
        const py = yLevels[i];
        const vNorm = i / (yLevels.length - 1);
        const isTopCap = i === yLevels.length - 1;
        const latTargetW = isTopCap
          ? 0.104 * build
          : py < 1.308
            ? lerp(0.146, 0.155, smooth(1.248, 1.308, py)) * build
            : lerp(0.155 * build, shX * 0.90, smooth(1.304, 1.372, py));
        const fAx = lerp(0.084, 0.034, smooth(1.265, 1.380, py)) * (isTopCap ? 0.60 : 1.0);
        const bAx = lerp(0.088, 0.038, smooth(1.265, 1.380, py)) * (isTopCap ? 0.60 : 1.0);

        for (let j = 0; j <= seg; j++) {
          const a = (j / seg) * TAU, sa = Math.sin(a), ca = Math.cos(a);
          const bp = evalBustAt(Math.min(1.404, py), a);
          const bx = bp[0], bz = bp[2], bz0 = bp[3];
          const rBust = Math.hypot(bx, bz - bz0) || 1e-4;
          const rxDir = bx / rBust, rzDir = (bz - bz0) / rBust;

          const medX = bx - rxDir * (py > 1.305 ? 0.0028 : 0.0006);
          const medZ = bz - rzDir * (py > 1.305 ? 0.0028 : 0.0006);
          const rzLat = ca >= 0 ? fAx : bAx;
          const latX = Math.sign(sa) * Math.pow(Math.abs(sa), 0.92) * latTargetW;
          const latZ = -0.012 + Math.sign(ca) * Math.pow(Math.abs(ca), 0.94) * rzLat;

          const latBlend = isTopCap ? 0.0 : smooth(0.74, 0.92, Math.abs(sa)) * smooth(1.268, 1.318, py) * (1.0 - 0.45 * smooth(1.368, 1.381, py));
          const px = lerp(medX, latX, latBlend);
          const pz = lerp(medZ, latZ, latBlend);

          pos.push(px, py, pz);
          uv.push(j / seg, vNorm);
          orthoP.push(px / build, py, pz, 0.0);
          col.push(1.0, 1.0, 1.0);

          const axAbs = Math.abs(px);
          const bCl = px >= 0 ? B_CLAV_L : B_CLAV_R;
          const bUA = px >= 0 ? B_UARM_L : B_UARM_R;
          const wUA = 0.62 * smooth(0.114 * build, shX * 0.90, axAbs) * smooth(1.290, 1.352, py);
          const wCl = (1.0 - wUA) * 0.56 * smooth(0.048 * build, 0.132 * build, axAbs) * smooth(1.320, 1.382, py);
          const wCh = Math.max(0.0, 1.0 - wUA - wCl);
          si.push(B_CHEST, bCl, bUA, 0);
          sw.push(wCh, wCl, wUA, 0);
        }
      }
      for (let i = 0; i < yLevels.length - 1; i++) {
        for (let j = 0; j < seg; j++) {
          const A = i * cols + j, Bv = A + 1, C = A + cols, D = C + 1;
          idx.push(A, Bv, C, Bv, D, C);
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
      g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
      g.setIndex(idx);
      g.computeVertexNormals();
      g.setAttribute("aOrthoPos", new T.Float32BufferAttribute(orthoP, 4));
      g.setAttribute("aOrthoNrm", new T.Float32BufferAttribute(Float32Array.from(g.attributes.normal.array), 3));
      return g;
    };

    if (useScionGarments) {
      garmentCtrl = SGG.buildGarmentsAndBoots(T, spec, {
        B: V3 ? V3.B : undefined,
        skelInfo,
        addSkinned,
        skinMatWrist,
        cyanGlowUniform
      });
    } else {
      const torsoGeo = isTankBareArms
        ? mergeSkinnedGeos(T, [buildTailoredTorsoGeo(), buildTankShoulderStrapsGeo()])
        : buildTailoredTorsoGeo();
      addSkinned(torsoGeo, shirtMat);
    }

    let shammaSleeveMat = null;
    if (outerStyle === "shamma") {
      const wvCol = shirtCol.clone().lerp(coatCol, 0.88);
      shammaSleeveMat = new T.MeshStandardMaterial({
        color: wvCol,
        vertexColors: true,
        roughness: 0.91,
        map: assets.shammaTex,
        bumpMap: assets.shammaTex,
        bumpScale: 0.024
      });
      applyDonkeyOrthoShader(T, shammaSleeveMat, {
        plates: assets.platesCarrier,
        cyanGlow: cyanGlowUniform,
        headMode: false,
        photoMix: 0.56,
        chromaMix: 0.58,
        lumContrast: 0.88,
        rimSheen: 0.06,
        weaveGrain: 1.05,
        uSpan: 0.42
      });
    }

    const mapArmOrtho = (s, shBase, weight) => (r, px, py, pz) => {
      const dArm = Math.max(0, 1.39 - py);
      const localX = px - s * shBase;
      const projX = s * (0.175 + dArm * 0.43) + localX * 0.88;
      const projY = 1.39 - dArm * 0.89;
      return [projX, projY, pz, weight];
    };

    // Volume-preserving, tangential-acromion & twist-distributing arm skinning helper
    const evalDeltoidClavicleSkin = (py, yTop, s, px, bCl, bUA) => {
      // True 2D anatomical deltoid-to-clavicle skinning (`tSh` driven by medial X proximity to clavicle `0.098*build` -> outer deltoid `shX + 0.024`):
      // - Medial weld (`s * px <= 0.098 * build` or `py >= yTop - 0.001`): tSh = 1.00 (wUarm = 0.00 -> 100% locked into ScionNeck!)
      // - Outer lateral deltoid (`s * px >= shX + 0.024`): tSh = 0.00 (wUarm = 1.00 -> outer deltoid follows humerus with ZERO frozen flap!)
      const xLat = px !== undefined ? (s * px) : shX;
      const yMask = smooth(1.342, 1.401, py);
      const xMedial = 1.0 - smooth(0.095 * build, shX + 0.018 * build, xLat);
      const topWeld = smooth(yTop - 0.005, yTop - 0.0005, py);
      const tSh = clamp(Math.max(topWeld, yMask * Math.pow(xMedial, 0.88)), 0.0, 1.0);
      const clavShare = lerp(0.66, 0.60, topWeld);
      return {
        indices: [bUA, bCl, B_CHEST, 0],
        weights: [1.0 - tSh, tSh * clavShare, tSh * (1.0 - clavShare), 0]
      };
    };

    const skinArmAtY = (y, yTop, yElb, yTw, yWri, bCl, bUA, bElbV, bFA, bTw, bHand, s = 0, px = undefined) => {
      if (y > 1.315) {
        return evalDeltoidClavicleSkin(y, yTop, s, px, bCl, bUA);
      }
      const elbVolW = g1(y, yElb, 0.054) * 0.78;
      if (y > yElb - 0.058) {
        const wUarm = smooth(yElb - 0.056, yElb + 0.056, y);
        return [bUA, bFA, wUarm, bElbV, elbVolW];
      }
      if (y > yTw - 0.015) {
        const wFarm = smooth(yTw - 0.015, yElb - 0.050, y);
        return [bFA, bTw, wFarm, bElbV, elbVolW];
      }
      const wTwist = smooth(yWri - 0.012, yWri + 0.042, y);
      return [bTw, bHand, wTwist];
    };

    const armClothGeos = [], armSkinGeos = [];
    if (isTankBareArms) {
      armSkinGeos.push(buildBareAxillaBridgeGeo());
    }
    for (const s of (useScionGarments ? [] : [1, -1])) {
      const bCl   = s > 0 ? B_CLAV_L       : B_CLAV_R;
      const bUA   = s > 0 ? B_UARM_L       : B_UARM_R;
      const bElbV = s > 0 ? B_ELBOW_VOL_L  : B_ELBOW_VOL_R;
      const bFA   = s > 0 ? B_FARM_L       : B_FARM_R;
      const bTw   = s > 0 ? B_FARM_TWIST_L : B_FARM_TWIST_R;
      const bHand = s > 0 ? B_HAND_L       : B_HAND_R;
      const ax = s * shX, az = -0.012;
      const yElb = 1.385 - L_UARM, yTw = yElb - L_FARM * 0.52, yWri = 1.385 - L_UARM - L_FARM;

      // Blend upper-sleeve normals (y > 1.350) smoothly into upward/lateral acromial shoulder normals so plain shirts have zero ball-joint lighting seam!
      const smoothSleeveShoulderNormals = slvG => {
        const P = slvG.attributes.position, N = slvG.attributes.normal;
        for (let k = 0; k < P.count; k++) {
          const py = P.getY(k);
          if (py > 1.345) {
            const wBlend = smooth(1.345, 1.408, py) * 0.78;
            const nx = lerp(N.getX(k), s * 0.62, wBlend);
            const ny = lerp(N.getY(k), 0.58, wBlend);
            const nz = N.getZ(k) * lerp(1.0, 0.82, wBlend);
            const nl = Math.hypot(nx, ny, nz) || 1;
            N.setXYZ(k, nx / nl, ny / nl, nz / nl);
          }
        }
        N.needsUpdate = true;
        if (slvG.attributes.aOrthoNrm) {
          slvG.attributes.aOrthoNrm.array.set(N.array);
          slvG.attributes.aOrthoNrm.needsUpdate = true;
        }
        return slvG;
      };

      if (isTankBareArms) {
        // Sculpted Unbroken Bare Deltoid Shoulder + Biceps/Triceps + Elbow + Forearm + Wrist (`openCollarBareArms` / `neckStudyTank`):
        // Welds upper deltoid arch continuously into `ScionNeck`'s lateral clavicle/trapezius dome (`wUarm = 0.0` at medial weld!)
        // so rotating `B_UARM` stretches the acromial-deltoid dome organically with ZERO ball-joint gap and ZERO cliff!
        const armMuscle = lerp(1.04, 0.94, fem) * lerp(1.0, build, 0.45);
        const bareFullRings = refineRings([
          { p: [ax, V3 ? (yWri + 0.011) : (yWri - 0.018), az], w: 0.0210,              f: 0.0246,              b: 0.0240,              e: 0.86 },
          { p: [ax, yWri + 0.024,                         az], w: 0.0230,              f: 0.0268,              b: 0.0260,              e: 0.86 },
          { p: [ax, yWri + 0.046,                         az], w: 0.0260 * armMuscle,  f: 0.0288 * armMuscle,  b: 0.0280 * armMuscle,  e: 0.89 },
          { p: [ax, yWri + 0.080,                         az], w: 0.0314 * armMuscle,  f: 0.0322 * armMuscle,  b: 0.0316 * armMuscle,  e: 0.92 },
          { p: [ax, yWri + 0.148,                         az], w: 0.0385 * armMuscle,  f: 0.0375 * armMuscle,  b: 0.0390 * armMuscle,  e: 0.92 },
          { p: [ax, yElb,                                 az], w: 0.0412 * armMuscle,  f: 0.0405 * armMuscle,  b: 0.0438 * armMuscle,  e: 0.91 },
          { p: [ax, yElb + 0.068,                         az], w: 0.0432 * armMuscle,  f: 0.0430 * armMuscle,  b: 0.0452 * armMuscle,  e: 0.92 },
          { p: [ax * 0.99, 1.268,                         az], w: 0.0460 * armMuscle,  f: 0.0465 * armMuscle,  b: 0.0485 * armMuscle,  e: 0.93 },
          { p: [ax * 0.98, 1.340,                         az], w: 0.0490 * armMuscle,  f: 0.0485 * armMuscle,  b: 0.0505 * armMuscle,  e: 0.94 },
          { p: [ax * 0.92, 1.378,                 az - 0.002], w: 0.0492 * armMuscle,  f: 0.0488 * armMuscle,  b: 0.0512 * armMuscle,  e: 0.96 },
          { p: [ax * 0.72, 1.400,                 az - 0.006], w: 0.0418 * armMuscle,  f: 0.0405 * armMuscle,  b: 0.0455 * armMuscle,  e: 0.98 },
          { p: [s * 0.088 * build, 1.4065,            -0.014], w: 0.0220,              f: 0.0360,              b: 0.0450,              e: 1.00 },
          { p: [s * 0.072 * build, 1.4055,            -0.014], w: 0.0040,              f: 0.0120,              b: 0.0140,              e: 1.00 }
        ], 3);
        armSkinGeos.push(smoothSleeveShoulderNormals(loftY(T, bareFullRings, {
          seg: 30,
          orthoWeight: 0,
          color: () => 1.0,
          skin: (r, sa, ca, v, u, px, py) => r.p[1] < yWri + 0.042
            ? [bTw, bHand, smooth(yWri - 0.006, yWri + 0.036, r.p[1])]
            : skinArmAtY(py !== undefined ? py : r.p[1], 1.406, yElb, yTw, yWri, bCl, bUA, bElbV, bFA, bTw, bHand, s, px)
        })));
      } else if (rolledSleeves) {
        const ySlvTop = isPlainShirt ? 1.410 : 1.404;
        // Deep upward-folded dark inner cuff return (`yElb + 0.066` -> `0.032` -> `0.035`) + smooth enveloping shoulder hood over `0.158` scye!
        const slvRings = refineRings([
          { p: [ax, yElb + 0.066, az],          w: 0.035, f: 0.035, b: 0.037, e: 0.94, innerLip: 1.0 },
          { p: [ax, yElb + 0.034, az],          w: 0.045, f: 0.045, b: 0.047, e: 0.93, innerLip: 0.72 },
          { p: [ax, yElb + 0.032, az],          w: 0.052, f: 0.052, b: 0.054, e: 0.92, innerLip: 0.0 },
          { p: [ax, yElb + 0.064, az],          w: 0.050, f: 0.050, b: 0.052, e: 0.92, innerLip: 0.0 },
          { p: [ax * 0.98, 1.268, az],          w: 0.049, f: 0.050, b: 0.052, e: 0.92, innerLip: 0.0 },
          { p: [ax * 0.96, 1.342, az - 0.001],  w: 0.050, f: 0.050, b: 0.052, e: 0.94, innerLip: 0.0 },
          { p: [ax * 0.94, 1.385, az - 0.002],  w: 0.049, f: 0.049, b: 0.051, e: 0.96, innerLip: 0.0 },
          { p: [ax * 0.76, 1.404, az - 0.004],  w: 0.044, f: 0.044, b: 0.047, e: 0.98, innerLip: 0.0 },
          { p: [isPlainShirt ? (s * 0.092 * build) : (ax * 0.44), ySlvTop, isPlainShirt ? -0.012 : (az - 0.007)], w: isPlainShirt ? 0.024 : 0.012, f: isPlainShirt ? 0.040 : 0.014, b: isPlainShirt ? 0.046 : 0.016, e: 1.00, innerLip: 0.0 }
        ], 3);
        armClothGeos.push(smoothSleeveShoulderNormals(loftY(T, slvRings, {
          seg: 24,
          orthoMap: mapArmOrtho(s, shX, isPlainShirt ? 0.16 : 0.68),
          disp: (r, sa, ca, v) => 1 + 0.022 * Math.sin(v * 18 + sa * 4) * smooth(0.14, 0.25, v) * (1 - smooth(0.52, 0.90, v)),
          color: (r, sa, ca, v) => (0.88 + 0.12 * v) * lerp(1.0, 0.22, clamp(r.innerLip || 0, 0, 1)),
          skin: (r, sa, ca, v, u, px, py) => skinArmAtY(py !== undefined ? py : r.p[1], ySlvTop, yElb, yTw, yWri, bCl, bUA, bElbV, bFA, bTw, bHand, s, px)
        })));

        // Sculpted Muscular Bare Forearm & Elbow extending deep inside sleeve (`yElb + 0.094` -> ZERO raised-arm cuff tear!)
        const bareRings = refineRings([
          { p: [ax, V3 ? (yWri + 0.011) : (yWri - 0.018), az], w: 0.0210, f: 0.0246, b: 0.0240, e: 0.86 },
          { p: [ax, yWri + 0.024,                         az], w: 0.0230, f: 0.0268, b: 0.0260, e: 0.86 },
          { p: [ax, yWri + 0.046,                         az], w: 0.0260, f: 0.0288, b: 0.0280, e: 0.89 },
          { p: [ax, yWri + 0.080,                         az], w: 0.0314, f: 0.0322, b: 0.0316, e: 0.92 },
          { p: [ax, yWri + 0.148,                         az], w: 0.0385, f: 0.0375, b: 0.0390, e: 0.92 }, // Brachioradialis belly!
          { p: [ax, yElb,                                 az], w: 0.0420, f: 0.0410, b: 0.0445, e: 0.91 }, // Olecranon & cubital fossa!
          { p: [ax, yElb + 0.056,                         az], w: 0.0422, f: 0.0412, b: 0.0438, e: 0.92 },
          { p: [ax, yElb + 0.090,                         az], w: 0.0402, f: 0.0395, b: 0.0415, e: 0.93 },
          { p: [ax, yElb + 0.098,                         az], w: 0.0050, f: 0.0050, b: 0.0050, e: 1.00 }
        ], 3);
        armSkinGeos.push(loftY(T, bareRings, {
          seg: 28,
          orthoWeight: 0,
          color: () => 1.0,
          skin: r => r.p[1] < yWri + 0.042
            ? [bTw, bHand, smooth(yWri - 0.006, yWri + 0.036, r.p[1])]
            : skinArmAtY(r.p[1], 1.404, yElb, yTw, yWri, bCl, bUA, bElbV, bFA, bTw, bHand)
        }));
      } else {
        const fullSlvMat = (outerStyle === "duster" || outerStyle === "parka") ? outerMat
          : (outerStyle === "shamma" ? shammaSleeveMat : shirtMat);
        const wFactor = outerStyle === "shamma" ? 1.04 : 1.0;
        const ySlvTop = isPlainShirt ? 1.410 : 1.404;
        // Watertight inner wrist cuff lip + smooth enveloping shoulder hood (`isPlainShirt`) / tucked inner sleeve (`outerStyle`)!
        const slvRings = refineRings([
          { p: [ax, yWri + 0.048, az],          w: 0.022,           f: 0.024,           b: 0.024,           e: 0.96, innerLip: 1.0 },
          { p: [ax, yWri + 0.040, az],          w: 0.028 * wFactor, f: 0.030 * wFactor, b: 0.029 * wFactor, e: 0.96, innerLip: 0.35 },
          { p: [ax, yWri + 0.055, az],          w: 0.036 * wFactor, f: 0.037 * wFactor, b: 0.036 * wFactor, e: 0.94, innerLip: 0.0 },
          { p: [ax, yWri + 0.115, az],          w: 0.047 * wFactor, f: 0.047 * wFactor, b: 0.049 * wFactor, e: 0.92, innerLip: 0.0 },
          { p: [ax, yElb,         az],          w: 0.050 * wFactor, f: 0.050 * wFactor, b: 0.053 * wFactor, e: 0.92, innerLip: 0.0 },
          { p: [ax * 0.98, 1.265, az],          w: 0.049 * wFactor, f: 0.050 * wFactor, b: 0.052 * wFactor, e: 0.92, innerLip: 0.0 },
          { p: [ax * 0.96, 1.342, az - 0.001],  w: (isPlainShirt ? 0.050 : 0.046) * wFactor, f: (isPlainShirt ? 0.050 : 0.048) * wFactor, b: (isPlainShirt ? 0.052 : 0.050) * wFactor, e: 0.94, innerLip: 0.0 },
          { p: [isPlainShirt ? (ax * 0.94) : (ax * 0.90), isPlainShirt ? 1.385 : 1.380, az - 0.002], w: isPlainShirt ? 0.049 : 0.041, f: isPlainShirt ? 0.049 : 0.040, b: isPlainShirt ? 0.051 : 0.042, e: 0.96, innerLip: 0.0 },
          { p: [isPlainShirt ? (ax * 0.76) : (ax * 0.72), isPlainShirt ? 1.404 : 1.401, az - 0.004], w: isPlainShirt ? 0.044 : 0.032, f: isPlainShirt ? 0.044 : 0.030, b: isPlainShirt ? 0.047 : 0.032, e: 0.98, innerLip: 0.0 },
          { p: [isPlainShirt ? (s * 0.092 * build) : (ax * 0.42), ySlvTop, isPlainShirt ? -0.012 : (az - 0.007)], w: isPlainShirt ? 0.024 : 0.012, f: isPlainShirt ? 0.040 : 0.014, b: isPlainShirt ? 0.046 : 0.016, e: 1.00, innerLip: 0.0 }
        ], 3);
        const slvGeo = smoothSleeveShoulderNormals(loftY(T, slvRings, {
          seg: 26,
          orthoMap: mapArmOrtho(s, shX, isPlainShirt ? 0.16 : 0.82),
          orthoWeightOf: (r, sa, ca, v) => smooth(0.08, 0.26, v) * (1 - smooth(0.64, 0.92, v)) * (isPlainShirt ? 0.16 : 0.82),
          disp: (r, sa, ca, v) => {
            const elbFold = g1(r.p[1], yElb, 0.055) * Math.sin(v * 42 + sa * 3) * 0.034;
            return 1 + (elbFold + 0.018 * Math.sin(sa * 6 + v * 15)) * smooth(0.12, 0.24, v) * (1 - smooth(0.55, 0.90, v));
          },
          color: (r, sa, ca, v) => {
            const tibCuff = (outerStyle === "shamma" && v < 0.12) ? 0.84 : 1.0;
            return (0.86 + 0.14 * v + 0.05 * Math.sin(v * 24 + sa * 3)) * tibCuff * lerp(1.0, 0.22, clamp(r.innerLip || 0, 0, 1));
          },
          // Keep sleeve cuff anchored to forearm twist bone (never pulled distally over knuckles by B_HAND!)
          skin: (r, sa, ca, v, u, px, py) => r.p[1] < yTw ? [bTw, bFA, smooth(yWri + 0.030, yTw, r.p[1]) * 0.15 + 0.85] : skinArmAtY(py !== undefined ? py : r.p[1], ySlvTop, yElb, yTw, yWri, bCl, bUA, bElbV, bFA, bTw, bHand, s, px)
        }));
        addSkinned(slvGeo, fullSlvMat);

        // Seamless bare wrist bridge from inside cuff (yWri + 0.065) tucked 12mm inside watertight V3 hand cuff (yWri + 0.011)!
        const wriBridge = refineRings([
          { p: [ax, V3 ? (yWri + 0.011) : (yWri - 0.016), az], w: 0.0210, f: 0.0246, b: 0.0240, e: 0.86 },
          { p: [ax, yWri + 0.024, az],                         w: 0.0230, f: 0.0268, b: 0.0260, e: 0.86 },
          { p: [ax, yWri + 0.044, az],                         w: 0.0256, f: 0.0284, b: 0.0276, e: 0.89 },
          { p: [ax, yWri + 0.065, az],                         w: 0.0295, f: 0.0305, b: 0.0300, e: 0.92 }
        ], 2);
        armSkinGeos.push(loftY(T, wriBridge, {
          seg: 24, orthoWeight: 0, color: () => 1.0,
          skin: r => [bTw, bHand, smooth(yWri - 0.006, yWri + 0.036, r.p[1])]
        }));
      }
    }
    if (armClothGeos.length) addSkinned(mergeSkinnedGeos(T, armClothGeos), shirtMat);
    if (armSkinGeos.length) addSkinned(mergeSkinnedGeos(T, armSkinGeos), skinMatWrist);

    // Unified Watertight SkinnedMesh Hands (V3) locked 100.0% to `portraitV3.canonicalSkinLin` (0.000 ΔE across Face/Neck/Chest/Arm/Hand!)
    let handL = null, handR = null;
    let handsMesh = null, handMat = null;
    if (V3 && assetsV3) {
      handMat = makeUnifiedSkinMat(0.72, false);
      V3.applyPhotographicHandShader(T, handMat, {
        assetsV3,
        cyanGlow: handCyanGlowUniform,
        photoMix: 0.78
      });
      // Wrap `handMat.onBeforeCompile` so wrist cuff (`cuffFade == 0`) starts at 100.0% `uCanonicalSkinLin` + identical dermal pore grain & baseline Fresnel SSS!
      const baseHandCompile = handMat.onBeforeCompile;
      handMat.onBeforeCompile = sh => {
        if (baseHandCompile) baseHandCompile(sh);
        sh.uniforms.uCanonicalSkinLin = canonicalSkinUniform;
        if (sh.fragmentShader.indexOf("uniform vec3 uCanonicalSkinLin;") < 0) {
          sh.fragmentShader = "uniform vec3 uCanonicalSkinLin;\n" + sh.fragmentShader;
        }
        sh.fragmentShader = sh.fragmentShader.replace(
          "float dorsalW = vHandMeta.x;",
          "float dGrainAH = fract(sin(dot(floor(vBindPos.xy * 980.0 + vBindPos.z * 790.0), vec2(12.9898, 78.233))) * 43758.5453);\n" +
          "float dGrainBH = sin(vBindPos.x * 460.0 + sin(vBindPos.y * 520.0 + vBindPos.z * 380.0)) * 0.5 + 0.5;\n" +
          "float dermalGrainH = 1.0 + ((dGrainAH - 0.5) * 0.045 + (dGrainBH - 0.5) * 0.032);\n" +
          "diffuseColor.rgb = uCanonicalSkinLin * (0.992 * dermalGrainH);\n" +
          "float dorsalW = vHandMeta.x;"
        );
        if (sh.fragmentShader.indexOf("microPoreH") < 0) {
          sh.fragmentShader = sh.fragmentShader.replace(
            "#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\n" +
            "float microPoreH = (fract(sin(dot(floor(vBindPos.xy * 1150.0 + vBindPos.z * 870.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.028;\n" +
            "roughnessFactor = clamp(roughnessFactor + microPoreH, 0.64, 0.88);"
          );
        }
        if (sh.fragmentShader.indexOf("vec3(1.55, 0.52, 0.28)") < 0) {
          sh.fragmentShader = sh.fragmentShader.replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "float ndvBaseH = abs(dot(normalize(vNormal), normalize(vViewPosition)));\n" +
            "float nightDampH = 1.0 - clamp(uCyanGlow.w * 0.95, 0.0, 0.88);\n" +
            "float baseRimH = pow(1.0 - ndvBaseH, 2.6) * 0.40 * 0.36 * nightDampH * (1.0 - 0.65 * clamp(vHandMeta.z, 0.0, 1.0));\n" +
            "totalEmissiveRadiance += diffuseColor.rgb * vec3(1.55, 0.52, 0.28) * (baseRimH * 0.40);"
          );
        }
      };
      handMat.customProgramCacheKey = () => "v52UnifiedCanonicalHandSSS";

      if (portraitV3) {
        const syncAllCharacterSkin = linArg => {
          const canonProp = portraitV3.canonicalSkinLin;
          const canonVec = canonProp ? (canonProp.value || canonProp) : null;
          let lx, ly, lz;
          if (canonVec && typeof canonVec.x === "number") {
            lx = Math.max(0.001, canonVec.x);
            ly = Math.max(0.001, canonVec.y);
            lz = Math.max(0.001, canonVec.z);
          } else {
            const fb = linArg || (portraitV3.cheekSkinLin && portraitV3.cheekSkinLin.value);
            if (fb && typeof fb.x === "number") {
              lx = Math.max(0.001, lerp(fb.x * 0.62, bLinR * 0.88, 0.20));
              ly = Math.max(0.001, lerp(fb.y * 0.62, bLinG * 0.88, 0.20));
              lz = Math.max(0.001, lerp(fb.z * 0.62, bLinB * 0.88, 0.20));
            } else {
              lx = Math.max(0.001, bLinR * 0.88);
              ly = Math.max(0.001, bLinG * 0.88);
              lz = Math.max(0.001, bLinB * 0.88);
            }
          }
          canonicalSkinUniform.value.set(lx, ly, lz);
          setThreeColorFromLinear(T, skinMat.color, lx, ly, lz);
          setThreeColorFromLinear(T, skinMatWrist.color, lx, ly, lz);
          setThreeColorFromLinear(T, skinMatPlain.color, lx, ly, lz);
          setThreeColorFromLinear(T, skinMatHeadRigid.color, lx, ly, lz);
          if (handMat) setThreeColorFromLinear(T, handMat.color, lx, ly, lz);
        };
        syncAllCharacterSkin(
          (portraitV3.canonicalSkinLin && (portraitV3.canonicalSkinLin.value || portraitV3.canonicalSkinLin))
          || (portraitV3.cheekSkinLin && portraitV3.cheekSkinLin.value)
        );
        if (portraitV3.lidListeners) portraitV3.lidListeners.push(syncAllCharacterSkin);
      }
      handsMesh = addSkinned(V3.buildCharacterSkinnedHandsGeo(T, skelInfo), handMat);
    } else {
      handL = buildSculptedHand(T, 1, skinMatPlain);
      handR = buildSculptedHand(T, -1, skinMatPlain);
      bones[B_HAND_L].add(handL);
      bones[B_HAND_R].add(handR);
    }

    /* --- 5. Skinned Creased Work Trousers (With B_KNEE_VOL Volume Preservation) + Laced Leather Boots --- */
    const legGeos = [];
    if (!useScionGarments) {
      const pelvisTrouser = refineRings([
        { p: [0, 0.785,  0.002], w: 0.156 * build, f: 0.105, b: 0.115, e: 0.86 },
        { p: [0, 0.855,  0.002], w: 0.145 * build, f: 0.098, b: 0.106, e: 0.86 },
        { p: [0, 0.902,  0.004], w: 0.136 * build, f: 0.092, b: 0.098, e: 0.88 }
      ], 2);
      legGeos.push(loftY(T, pelvisTrouser, {
        seg: 28,
        normX: build,
        orthoWeight: 0.86,
        color: (r, sa, ca, v) => 0.84 + 0.14 * v,
        skin: (r, sa) => {
          const y = r.p[1];
          if (y > 0.835) return [B_PELVIS, B_LUMBAR, 1 - smooth(0.835, 0.96, y)];
          const legB = sa >= 0 ? B_ULEG_L : B_ULEG_R;
          const legW = (1 - smooth(0.785, 0.845, y)) * smooth(0.25, 0.85, Math.abs(sa)) * 0.55;
          return [legB, B_PELVIS, legW];
        }
      }));
    }

    const yKnee = 0.875 - L_THIGH, yAnk = 0.875 - L_THIGH - L_SHIN;
    for (const s of (useScionGarments ? [] : [1, -1])) {
      const bUL  = s > 0 ? B_ULEG_L     : B_ULEG_R;
      const bKnV = s > 0 ? B_KNEE_VOL_L : B_KNEE_VOL_R;
      const bLL  = s > 0 ? B_LLEG_L     : B_LLEG_R;
      const bFT  = s > 0 ? B_FOOT_L     : B_FOOT_R;
      const lx = s * hipX;
      const legRings = refineRings([
        { p: [lx, yAnk + 0.055, 0.002], w: 0.056, f: 0.056, b: 0.058, e: 0.90 },
        { p: [lx, yAnk + 0.140, 0.000], w: 0.062, f: 0.060, b: 0.064, e: 0.90 },
        { p: [lx, yKnee - 0.06, -0.002], w: 0.068, f: 0.066, b: 0.074, e: 0.90 },
        { p: [lx, yKnee,        0.004], w: 0.069, f: 0.072, b: 0.068, e: 0.88 },
        { p: [lx, yKnee + 0.16, 0.002], w: 0.080 * build, f: 0.082, b: 0.084, e: 0.88 },
        { p: [lx * 0.96, 0.845, 0.000], w: 0.085 * build, f: 0.088, b: 0.094, e: 0.86 }
      ], 3);
      legGeos.push(loftY(T, legRings, {
        seg: 24,
        normX: build,
        orthoWeight: 0.88,
        disp: (r, sa, ca, v) => {
          const kneeCrease = g1(r.p[1], yKnee, 0.06) * Math.sin(v * 46 + sa * 3) * 0.042;
          const cuffBunch = (1 - smooth(0.0, 0.18, v)) * Math.sin(v * 38 + sa * 5) * 0.04;
          return 1 + kneeCrease + cuffBunch;
        },
        color: (r, sa, ca, v) => {
          const dust = (1 - smooth(0.0, 0.28, v)) * 0.15;
          const patch = (spec.patchedKnees && s > 0 && ca > 0.45 && Math.abs(r.p[1] - yKnee) < 0.065) ? -0.18 : 0;
          const base = 0.82 + 0.16 * v + patch;
          return [base + dust * 0.45, base + dust * 0.38, base + dust * 0.28];
        },
        skin: r => {
          const y = r.p[1];
          if (y > 0.815) return [B_PELVIS, bUL, smooth(0.815, 0.855, y) * 0.45];
          const knVolW = g1(y, yKnee, 0.054) * 0.68;
          if (y > yKnee - 0.06) return [bUL, bLL, smooth(yKnee - 0.055, yKnee + 0.055, y), bKnV, knVolW];
          return [bLL, bUL, 1];
        }
      }));

      const boot = buildLacedWorkBoot(T, s, assets);
      bones[bFT].add(boot);
    }
    if (legGeos.length) addSkinned(mergeSkinnedGeos(T, legGeos), trouserMat);

    /* --- 6. Signature Layered Outer Garments (y=1.392 Acromial Shoulders + y=1.422..1.430 Trapezius Collar Roll + ScionNeck Bust Guard) --- */
    const enforceOuterBustGuard = (px, py, pz, a, thickCloth, layer) => {
      if (py < 1.260 || py > 1.475) return [px, py, pz];
      const bp = evalBustAt(py, a);
      const bx = bp[0], bz = bp[2], bz0 = bp[3];
      const rBust = Math.hypot(bx, bz - bz0) || 1e-4;
      const curR = Math.hypot(px, pz - bz0) || 1e-4;
      const yShirt = evalShirtCollarY(Math.cos(a));
      // Clear inner shirt (+9.4mm) below shirt neckline, and keep +6.4mm radial breathing clearance above shirt neckline so ±26° leaning wider necks NEVER clip!
      const innerClear = lerp(0.0094, 0.0064, smooth(yShirt - 0.006, yShirt + 0.012, py));
      const minR = rBust + innerClear + (layer === 0 ? thickCloth : 0.0);
      if (curR < minR) {
        const sc = minR / curR;
        return [px * sc, py, bz0 + (pz - bz0) * sc];
      }
      return [px, py, pz];
    };

    if (!useScionGarments && (outerStyle === "duster" || outerStyle === "parka")) {
      const isParka = outerStyle === "parka";
      const hemY = isParka ? 0.58 : 0.42;
      const flare = isParka ? 1.18 : 1.28;
      const coatThick = 0.0086;
      // Athletic horizontal acromial shoulder crown at y=1.392 + tailored trapezius collar roll at y=1.422..1.430m (revealing full 9.6cm neck!)
      const coatRings = refineRings([
        { p: [0, hemY,  -0.012], w: 0.230 * build * flare, f: 0.165 * flare, b: 0.182 * flare, e: 0.84 },
        { p: [0, lerp(hemY, 0.88, 0.48), -0.010], w: 0.198 * build * lerp(flare, 1, 0.5), f: 0.146, b: 0.160, e: 0.86 },
        { p: [0, 0.895, -0.004], w: 0.166 * build, f: 0.128, b: 0.135, e: 0.86 },
        { p: [0, 1.105, -0.008], w: 0.168 * build, f: 0.132, b: 0.136, e: 0.86 },
        { p: [0, 1.275, -0.010], w: (0.192 - 0.008 * fem) * build, f: 0.136 + 0.010 * fem, b: 0.136, e: 0.86 },
        { p: [0, 1.352, -0.011], w: (0.222 - 0.008 * fem) * build, f: 0.124, b: 0.128, e: 0.88 },
        { p: [0, 1.392, -0.011], w: (0.218 - 0.008 * fem) * build, f: 0.114, b: 0.118, e: 0.90 },
        { p: [0, 1.410, -0.012], w: 0.160 * lerp(1, build, 0.60),  f: 0.092, b: 0.104, e: 0.94 },
        { p: [0, 1.422, -0.013], w: 0.118 * lerp(1, build, 0.35),  f: 0.078, b: 0.092, e: 0.98 },
        { p: [0, 1.430, -0.014], w: 0.103 * lerp(1, build, 0.25),  f: 0.073, b: 0.088, e: 1.00 }
      ], 3);

      const coatOpenBase = (isParka ? 0.048 : 0.058) * build;
      const coatOpenTop  = (isParka ? 0.078 : 0.086) * lerp(1, build, 0.25);
      const coatA0Base   = isParka ? 0.29 : 0.34;
      const coatGeo = loftOpenGarment(T, coatRings, {
        seg: 40,
        normX: build,
        orthoWeight: 0.96,
        orthoWeightOf: (_r, _u, _v, _sa, _ca, py) => 0.96 * (1.0 - 0.92 * smooth(1.355, 1.422, py)),
        a0: coatA0Base,
        a1: TAU - coatA0Base,
        // Exact inverse-sine tailor lapel curve: keeps front edge x = w(y)*sin(a0) monotonically smooth across wide shoulders into collar roll!
        a0Of: r => {
          const xOpen = lerp(coatOpenBase, coatOpenTop, smooth(1.22, 1.432, r.p[1]));
          return Math.asin(clamp(xOpen / Math.max(0.06, r.w), 0.18, 0.93));
        },
        thick: coatThick,
        sculpt: (r, u, v, sa) => {
          const edgeDist = Math.min(u, 1 - u);
          const lapelRoll = smooth(0.68, 0.98, v) * (1.0 - smooth(0.0, 0.22, edgeDist));
          return [Math.sign(sa) * 0.006 * lapelRoll, -0.014 * lapelRoll, 0.005 * lapelRoll];
        },
        fold: (r, u, v) => {
          const collarCalm = 1.0 - 0.85 * smooth(0.72, 0.98, v);
          const drape = (1 - smooth(0.0, 0.55, v)) * 0.018 * Math.sin(u * 26 + 1.2);
          return (drape + 0.005 * Math.sin(v * 19 + u * 11)) * collarCalm;
        },
        bustGuard: (px, py, pz, a, _u, _v, layer) => enforceOuterBustGuard(px, py, pz, a, coatThick, layer),
        color: (r, u, v, sa, ca, layer) => {
          const splatter = (1 - smooth(0.0, 0.34, v)) * fbm(u * 14 + 2, v * 16, 3) * 0.26;
          const crease = 0.88 + 0.12 * Math.sin(u * 22 + v * 7) * (1 - 0.55 * smooth(0.76, 1.0, v));
          const shade = (layer ? 0.68 : 1.0) * crease * lerp(0.88, 1.02, v);
          return [shade + splatter * 0.40, shade + splatter * 0.38, shade + splatter * 0.32];
        },
        skin: (r, sa, ca, _v, _u, px, py, pz) => {
          const y = py !== undefined ? py : r.p[1];
          if (y < 0.88) {
            const skirtW = 1 - smooth(hemY, 0.88, y);
            if (ca < -0.25) return [B_COAT_B, B_PELVIS, skirtW * 0.88];
            const bSide = sa >= 0 ? B_COAT_L : B_COAT_R;
            const bLeg  = sa >= 0 ? B_ULEG_L : B_ULEG_R;
            return [bSide, B_PELVIS, skirtW * 0.68, bLeg, skirtW * 0.26];
          }
          if (y < 1.02) return [B_PELVIS, B_LUMBAR, 1 - smooth(0.88, 1.02, y)];
          if (y < 1.18) return [B_LUMBAR, B_THORAX, 1 - smooth(1.02, 1.18, y)];
          if (y < 1.31) return [B_THORAX, B_CHEST,  1 - smooth(1.18, 1.31, y)];
          const xx = px !== undefined ? px : sa * 0.10;
          const ax = Math.abs(xx);
          // Blend outer acromial coat shoulder lip (~0.50 B_UARM + 0.34 B_CLAV) so coat shoulder drapes smoothly over deltoid sleeve!
          if (y <= 1.418 && ax > 0.120 * build) {
            const shW = smooth(0.120 * build, 0.205 * build, ax) * smooth(1.29, 1.370, y) * (1.0 - smooth(1.398, 1.422, y));
            const bCl = xx >= 0 ? B_CLAV_L : B_CLAV_R;
            const bUA = xx >= 0 ? B_UARM_L : B_UARM_R;
            const wUA = shW * 0.50;
            const wCl = shW * 0.34;
            return { indices: [B_CHEST, bCl, bUA, 0], weights: [1.0 - wUA - wCl, wCl, wUA, 0] };
          }
          return evalBustLockstepSkin(xx, Math.min(y, 1.422), pz !== undefined ? pz : 0.0);
        }
      });
      addSkinned(coatGeo, outerMat);
    } else if (!useScionGarments && outerStyle === "shamma") {
      // Athletic acromial drape (y=1.392) + tailored cotton gabi collar roll at y=1.422..1.430m resting on the y=1.408m clavicles!
      const shThick = 0.0080;
      const shammaRings = refineRings([
        { p: [0, 0.72,  -0.008], w: 0.228 * build,                   f: 0.164, b: 0.172, e: 0.92 },
        { p: [0, 0.98,  -0.006], w: 0.228 * build,                   f: 0.168, b: 0.170, e: 0.92 },
        { p: [0, 1.22,  -0.005], w: 0.232 * build,                   f: 0.172, b: 0.168, e: 0.91 },
        { p: [0, 1.348, -0.007], w: (0.224 - 0.008 * fem) * build,   f: 0.140, b: 0.144, e: 0.92 },
        { p: [0, 1.392, -0.009], w: (0.218 - 0.008 * fem) * build,   f: 0.120, b: 0.126, e: 0.93 },
        { p: [0, 1.410, -0.011], w: 0.155 * lerp(1, build, 0.50),    f: 0.090, b: 0.102, e: 0.96 },
        { p: [0, 1.422, -0.012], w: 0.116 * lerp(1, build, 0.30),    f: 0.078, b: 0.091, e: 0.99 },
        { p: [0, 1.430, -0.013], w: 0.102 * lerp(1, build, 0.25),    f: 0.072, b: 0.086, e: 1.00 }
      ], 3);
      const shOpenBase = 0.062 * build;
      const shOpenTop  = 0.084 * lerp(1, build, 0.25);
      const shGeo = loftOpenGarment(T, shammaRings, {
        seg: 42,
        normX: build * 1.12,
        orthoWeight: 0.98,
        orthoWeightOf: (_r, _u, _v, _sa, _ca, py) => 0.98 * (1.0 - 0.94 * smooth(1.355, 1.422, py)),
        a0: 0.28,
        a1: TAU - 0.28,
        // Exact inverse-sine draped gabi V-collar curve: keeps front shawl edge monotonically smooth across shoulders into trapezius roll!
        a0Of: r => {
          const xOpen = lerp(shOpenBase, shOpenTop, smooth(1.22, 1.432, r.p[1]));
          return Math.asin(clamp(xOpen / Math.max(0.06, r.w), 0.18, 0.93));
        },
        thick: shThick,
        sculpt: (r, u, v, sa, ca) => {
          const edgeDist = Math.min(u, 1 - u);
          const frontRoll = smooth(0.66, 0.98, v) * (1.0 - smooth(0.0, 0.24, edgeDist));
          const lapZ = u < 0.5 ? (frontRoll * 0.007) : (-frontRoll * 0.002);
          const napeRollY = smooth(0.80, 1.0, v) * smooth(0.1, -0.85, ca) * 0.005;
          return [Math.sign(sa) * 0.004 * frontRoll, -0.014 * frontRoll + napeRollY, lapZ];
        },
        fold: (r, u, v, sa, ca) => {
          const collarCalm = 1.0 - 0.88 * smooth(0.66, 0.96, v);
          const catenary = Math.abs(ca) > 0.3 ? 0.011 * Math.sin(v * 26 - Math.abs(sa) * 8) : 0;
          return (0.013 * Math.sin(u * 28 + v * 9) + 0.006 * Math.cos(v * 20 - u * 12) + catenary) * collarCalm;
        },
        bustGuard: (px, py, pz, a, _u, _v, layer) => enforceOuterBustGuard(px, py, pz, a, shThick, layer),
        color: (r, u, v, sa, ca, layer) => {
          const onBorder = (v < 0.08 || u < 0.07 || u > 0.93);
          if (onBorder && hasTibeb) {
            // Warm woven oatmeal-ochre Ethiopian tibeb border (never cyan-blue so CYAN JERIKAN stays selective to water/phones!)
            const motif = 0.5 + 0.5 * Math.sin((u + v) * 95);
            const sh = (layer ? 0.72 : 1.0) * (0.76 + 0.16 * motif);
            return [sh, sh * 0.96, sh * 0.89];
          }
          const tibeb = onBorder ? 0.82 : 1.0;
          const base = (0.91 + 0.09 * Math.sin(u * 26 + v * 8) * (1 - 0.6 * smooth(0.75, 1.0, v))) * (layer ? 0.75 : 1.0) * tibeb;
          return [base, base * 0.99, base * 0.96];
        },
        skin: (r, sa, ca, _v, _u, px, py, pz) => {
          const y = py !== undefined ? py : r.p[1];
          if (y < 0.90) {
            const w = 1 - smooth(0.72, 0.90, y);
            return [ca < -0.2 ? B_COAT_B : (sa >= 0 ? B_COAT_L : B_COAT_R), B_PELVIS, w * 0.72];
          }
          const xx = px !== undefined ? px : sa * 0.10;
          const ax = Math.abs(xx);
          if (y >= 1.24 && y <= 1.416 && ax > 0.125 * build && ca > -0.35) {
            const armB = xx >= 0 ? B_UARM_L : B_UARM_R;
            const clavB = xx >= 0 ? B_CLAV_L : B_CLAV_R;
            const capeW = smooth(1.24, 1.375, y) * (1.0 - smooth(1.396, 1.420, y)) * smooth(0.125 * build, 0.195 * build, ax);
            return { indices: [B_CHEST, clavB, armB, 0], weights: [1.0 - capeW * 0.58, capeW * 0.34, capeW * 0.24, 0] };
          }
          if (y >= 1.330) {
            return evalBustLockstepSkin(xx, Math.min(y, 1.422), pz !== undefined ? pz : 0.0);
          }
          if (y < 1.04) return [B_PELVIS, B_LUMBAR, 1 - smooth(0.90, 1.04, y)];
          if (y < 1.20) return [B_LUMBAR, B_THORAX, 1 - smooth(1.04, 1.20, y)];
          return [B_CHEST, B_THORAX, smooth(1.20, 1.33, y)];
        }
      });
      addSkinned(shGeo, outerMat);
    } else if (!useScionGarments && outerStyle === "apron") {
      const apRings = refineRings([
        { p: [0, 0.48, 0.02], w: 0.185 * build, f: 0.136, b: 0.04, e: 0.88 },
        { p: [0, 0.88, 0.01], w: 0.168 * build, f: 0.128, b: 0.04, e: 0.88 },
        { p: [0, 1.26, 0.01], w: 0.125 * build, f: 0.140, b: 0.03, e: 0.90 }
      ], 2);
      const apGeo = loftOpenGarment(T, apRings, {
        seg: 20, normX: build, orthoWeight: 0.80, a0: -1.15, a1: 1.15, thick: 0.006,
        fold: (r, u, v) => 0.008 * Math.sin(u * 16 + v * 6),
        color: (r, u, v) => 0.88 + 0.12 * fbm(u * 10, v * 12, 2),
        skin: r => r.p[1] < 0.88 ? [B_COAT_L, B_PELVIS, (1 - smooth(0.48, 0.88, r.p[1])) * 0.55] : [B_CHEST, B_THORAX, smooth(0.92, 1.22, r.p[1])]
      });
      addSkinned(apGeo, outerMat);
    }

    const xraySkeleton = V3 ? V3.createXRaySkeletonVisualizer(T, bones, group) : null;
    group.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) o.frustumCulled = false;
    });

    /* --- 7. Character-Specific Belt, Mechanic's Wrenches/Satchel & Diegetic Handheld Props --- */
    if (!useScionGarments && spec.toolBelt) {
      const beltGrp = new T.Group();
      bones[B_PELVIS].add(beltGrp);
      const beltRing = new T.Mesh(
        loftY(T, [
          { p: [0, 0.015, -0.006], w: 0.180 * build, f: 0.138, b: 0.144, e: 0.86 },
          { p: [0, 0.062, -0.006], w: 0.180 * build, f: 0.138, b: 0.144, e: 0.86 }
        ], { seg: 28, orthoWeight: 0 }),
        assets.leatherDark
      );
      beltGrp.add(beltRing);
      const buckle = new T.Mesh(roundedBox(T, 0.052, 0.056, 0.018, 0.005, 1), assets.steelToolMat);
      buckle.position.set(0, 0.038, 0.142);
      beltGrp.add(buckle);

      const pouch = new T.Mesh(roundedBox(T, 0.055, 0.19, 0.155, 0.014, 2), assets.leatherDark);
      pouch.position.set(0.182 * build, -0.045, 0.015);
      pouch.rotation.z = -0.14;
      pouch.rotation.y = 0.18;
      beltGrp.add(pouch);
      for (let w = 0; w < 3; w++) {
        const wr = new T.Group();
        wr.position.set(0.022, 0.065 - w * 0.008, -0.042 + w * 0.042);
        wr.rotation.x = (w - 1) * 0.08;
        wr.add(new T.Mesh(roundedBox(T, 0.007, 0.115, 0.018, 0.002, 1), assets.steelToolMat));
        const jawL = new T.Mesh(roundedBox(T, 0.008, 0.026, 0.010, 0.002, 1), assets.steelToolMat);
        jawL.position.set(0, 0.062, -0.010); jawL.rotation.x = 0.22; wr.add(jawL);
        const jawR = new T.Mesh(roundedBox(T, 0.008, 0.026, 0.010, 0.002, 1), assets.steelToolMat);
        jawR.position.set(0, 0.062,  0.010); jawR.rotation.x = -0.22; wr.add(jawR);
        pouch.add(wr);
      }
    }

    if (!useScionGarments && spec.satchel) {
      const satGrp = new T.Group();
      bones[B_PELVIS].add(satGrp);
      const bag = new T.Mesh(roundedBox(T, 0.09, 0.21, 0.24, 0.022, 2), assets.leatherWorn);
      bag.position.set(0.19 * build, -0.06, -0.03);
      bag.rotation.z = -0.12;
      satGrp.add(bag);
      const flap = new T.Mesh(roundedBox(T, 0.096, 0.11, 0.246, 0.016, 2), assets.leatherDark);
      flap.position.set(0.192 * build, 0.005, -0.03);
      flap.rotation.z = -0.12;
      satGrp.add(flap);
      const strapPts = [
        new T.Vector3(-0.102 * build, 0.106,  0.048),
        new T.Vector3(-0.106 * build, 0.110,  0.004),
        new T.Vector3(-0.100 * build, 0.104, -0.048),
        new T.Vector3( 0.010,         0.005, -0.132),
        new T.Vector3( 0.175 * build, -0.18, -0.110),
        new T.Vector3( 0.175 * build, -0.18,  0.060),
        new T.Vector3( 0.020,         0.005,  0.136)
      ];
      const strap = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(strapPts, true), 28, 0.010, 6, true), assets.leatherDark);
      bones[B_CHEST].add(strap);
    }

    /* --- Diegetic Handheld Props --- */
    // 1. Brushed Tin / Chipped Enamel Cup (held at chest or raised like a microphone by June!)
    const cupProp = new T.Group();
    cupProp.visible = false;
    {
      const useTin = spec.id === "june" || Boolean(spec.tinCup);
      const cBody = new T.Mesh(new T.CylinderGeometry(0.044, 0.036, 0.098, 18), useTin ? assets.tinMugMat : assets.enamelCupMat);
      cupProp.add(cBody);
      const cRim = new T.Mesh(new T.TorusGeometry(0.044, 0.0036, 6, 18), useTin ? assets.tinMugMat : assets.enamelRimMat);
      cRim.rotation.x = Math.PI * 0.5; cRim.position.y = 0.049;
      cupProp.add(cRim);
      const cEar = new T.Mesh(new T.TorusGeometry(0.022, 0.0042, 6, 12, Math.PI * 1.15), useTin ? assets.tinMugMat : assets.enamelRimMat);
      cEar.position.set(0.044, 0.004, 0);
      cEar.rotation.z = -Math.PI * 0.5;
      cupProp.add(cEar);
      const cLiq = new T.Mesh(new T.CircleGeometry(0.039, 16), assets.cyanWaterMat);
      cLiq.rotation.x = -Math.PI * 0.5; cLiq.position.y = 0.035;
      cupProp.add(cLiq);
    }
    group.add(cupProp);

    // 2. Pouring tin dipper + glowing cyan stream (Makeda kneeling at Cottonwood root-bowl)
    const dipperProp = new T.Group();
    dipperProp.visible = false;
    let dipperStream = null;
    {
      const dCup = new T.Mesh(new T.CylinderGeometry(0.056, 0.048, 0.115, 18, 1, false), assets.tinMugMat);
      dCup.rotation.z = 1.08;
      dipperProp.add(dCup);
      const dHandle = new T.Mesh(new T.TorusGeometry(0.030, 0.0055, 6, 14, Math.PI * 1.25), assets.tinMugMat);
      dHandle.position.set(0.042, 0.052, 0);
      dHandle.rotation.z = 0.6;
      dipperProp.add(dHandle);
      const sPts = [
        new T.Vector3(-0.068, -0.025, 0),
        new T.Vector3(-0.095, -0.18, 0.01),
        new T.Vector3(-0.105, -0.38, 0.015),
        new T.Vector3(-0.110, -0.56, 0.02)
      ];
      dipperStream = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(sPts), 14, 0.014, 8, false), assets.cyanWaterMat);
      dipperProp.add(dipperStream);
    }
    bones[B_HAND_R].add(dipperProp);
    dipperProp.position.set(0.024, -0.052, 0.018);

    // 3. Emissive Smartphone / Field Tablet + Cyan Face/Shawl Uplight (00:48, 00:59, 01:22!)
    const phoneProp = new T.Group();
    phoneProp.visible = false;
    let phoneLight = null;
    {
      const pw = spec.isTablet ? 0.135 : 0.078;
      const pd = spec.isTablet ? 0.195 : 0.148;
      const pCase = new T.Mesh(roundedBox(T, pw, 0.010, pd, 0.004, 1), assets.phoneBodyMat);
      phoneProp.add(pCase);
      const pScr = new T.Mesh(new T.PlaneGeometry(pw - 0.012, pd - 0.016), assets.phoneScreenMat);
      pScr.rotation.x = -Math.PI * 0.5;
      pScr.position.y = 0.0058;
      phoneProp.add(pScr);
      // Rear glow bezel so filming posture also shows crisp cyan screen edge
      const pBackEdge = new T.Mesh(new T.PlaneGeometry(pw * 0.26, pd * 0.16), assets.phoneScreenMat);
      pBackEdge.rotation.x = Math.PI * 0.5;
      pBackEdge.position.set(pw * 0.24, -0.0058, -pd * 0.30);
      phoneProp.add(pBackEdge);
      if (spec.enablePhoneLight) {
        phoneLight = new T.PointLight(0x4ad4ff, 0.38, 0.44, 2.0);
        phoneLight.position.set(0, 0.095, -0.035);
        phoneProp.add(phoneLight);
      }
    }
    group.add(phoneProp);

    // 4. Translucent cyan 20 L jerrycan with WATER = WIFI decal carried in right hand
    const carryCanProp = new T.Group();
    carryCanProp.visible = false;
    {
      const canMat = new T.MeshStandardMaterial({
        color: 0x2fc8e6, emissive: 0x0d6f96, emissiveIntensity: 0.48,
        roughness: 0.24, transparent: true, opacity: 0.88
      });
      const body = new T.Mesh(roundedBox(T, 0.16, 0.34, 0.25, 0.028, 2), canMat);
      body.position.set(0, -0.22, 0);
      carryCanProp.add(body);
      const chalk = new T.Mesh(roundedBox(T, 0.164, 0.008, 0.254, 0.002, 1), assets.chalkLineMat);
      chalk.position.set(0, -0.31, 0);
      carryCanProp.add(chalk);
      for (const sx of [-1, 1]) {
        const dec = new T.Mesh(new T.PlaneGeometry(0.16, 0.18), assets.jugDecalMat);
        dec.position.set(sx * 0.083, -0.21, 0);
        dec.rotation.y = sx > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        carryCanProp.add(dec);
      }
      const hdl = new T.Mesh(roundedBox(T, 0.032, 0.042, 0.15, 0.01, 1), assets.enamelCupMat);
      hdl.position.set(0, -0.03, 0);
      carryCanProp.add(hdl);
      const cap = new T.Mesh(new T.CylinderGeometry(0.024, 0.024, 0.028, 10), assets.penBlueMat);
      cap.position.set(0, -0.035, 0.085);
      carryCanProp.add(cap);
    }
    bones[B_HAND_R].add(carryCanProp);
    carryCanProp.position.set(0.020, -0.022, 0.004);

    // 5. Hill Archive Hardboard Clipboard + Brass Clip + Lined Log Sheet + Blue Pen + Ration Card (00:37 kf08!)
    const clipboardProp = new T.Group();
    clipboardProp.visible = false;
    {
      const board = new T.Mesh(roundedBox(T, 0.21, 0.007, 0.29, 0.003, 1), assets.clipboardBoardMat);
      clipboardProp.add(board);
      const sheet = new T.Mesh(new T.PlaneGeometry(0.185, 0.255), assets.clipboardPaperMat);
      sheet.rotation.x = -Math.PI * 0.5;
      sheet.position.set(0, 0.0045, 0.006);
      clipboardProp.add(sheet);
      const clipM = new T.Mesh(roundedBox(T, 0.085, 0.016, 0.028, 0.003, 1), assets.steelToolMat);
      clipM.position.set(0, 0.011, -0.125);
      clipboardProp.add(clipM);
    }
    group.add(clipboardProp);

    // Tripod-pinched blue pen: -Y steel nib meets pinched thumb/index pads at [+0.024, -0.101, +0.026], +Y barrel rests up through thumb-index web!
    const penProp = new T.Group();
    penProp.visible = false;
    {
      const barrel = new T.Mesh(new T.CylinderGeometry(0.0038, 0.0032, 0.126, 10), assets.penBlueMat);
      penProp.add(barrel);
      const nib = new T.Mesh(new T.ConeGeometry(0.0032, 0.014, 10), assets.steelToolMat);
      nib.rotation.x = Math.PI;
      nib.position.y = -0.070;
      penProp.add(nib);
    }
    penProp.position.set(0.010, -0.068, 0.034);
    penProp.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(-0.55, 0.83, 0.05).normalize());
    bones[B_HAND_R].add(penProp);

    // Ration card seated flush inside supinated left palmar hollow (-X palmar face, cradled by thumb & fingers with zero slicing!)
    const cardProp = new T.Mesh(roundedBox(T, 0.088, 0.0024, 0.124, 0.001, 1), assets.paperMat);
    cardProp.visible = false;
    cardProp.position.set(-0.023, -0.078, 0.004);
    cardProp.rotation.set(0.06, 0.08, Math.PI * 0.48);
    bones[B_HAND_L].add(cardProp);

    // 6. Per-Actor Two-Handed 20 L WATER = WIFI Jerrycan + Parabolic Stream + Ripple Rings
    const soloCanBundle = build20LWaterWifiCan(T, assets, true);
    const twoHandCanProp = soloCanBundle.canRoot;
    const twoHandStream = soloCanBundle.streamMesh;
    const soloRippleGrp = soloCanBundle.rippleGrp;
    const soloRipples = soloCanBundle.ripples;
    twoHandCanProp.visible = false;
    group.add(twoHandCanProp);
    group.add(soloRippleGrp);

    // 7. Braided Sisal Lashing Rope Loop
    const ropeProp = new T.Group();
    ropeProp.visible = false;
    {
      const loopPts = [
        new T.Vector3( 0.12, 0.02, 0),
        new T.Vector3( 0.04, 0.04, 0.04),
        new T.Vector3(-0.04, 0.03, 0.03),
        new T.Vector3(-0.12, 0.01, 0),
        new T.Vector3(-0.08, -0.22, 0.02),
        new T.Vector3( 0.09, -0.24, -0.01)
      ];
      ropeProp.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(loopPts), 18, 0.009, 6, false), assets.sisalMat));
    }
    group.add(ropeProp);

    // 8. Handheld VHF Walkie-Talkie with Whip Antenna & Cyan TX LED (Hill Archive kf08!)
    // Seated inside B_HAND_R curled fist (+X=+0.030, -Y=-0.048) with +Y antenna aligned to (-0.06, -0.94, +0.34) = 12-o'clock STRAIGHT UP (+Y world)!
    const radioProp = new T.Group();
    radioProp.visible = false;
    {
      const rBody = new T.Mesh(roundedBox(T, 0.036, 0.104, 0.048, 0.006, 1), assets.phoneBodyMat);
      radioProp.add(rBody);
      const rAnt = new T.Mesh(new T.CylinderGeometry(0.0028, 0.0046, 0.138, 6), assets.ironDarkMat);
      rAnt.position.set(0.008, 0.110, -0.010);
      radioProp.add(rAnt);
      const rLed = new T.Mesh(new T.SphereGeometry(0.0042, 6, 6), assets.radioLedMat);
      rLed.position.set(-0.010, 0.044, 0.022);
      radioProp.add(rLed);
    }
    bones[B_HAND_R].add(radioProp);
    // Seat VHF handset body deep inside B_HAND_R curled 4-finger cylinder (+X=+0.024, -Y=-0.072, -Z=-0.018) with +Y whip antenna aligned to 12-o'clock vertical!
    radioProp.position.set(0.024, -0.072, -0.018);
    radioProp.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(0.02, -0.64, 0.77).normalize());

    // Contact shadow on ground
    const shadowMesh = new T.Mesh(
      new T.PlaneGeometry(0.68, 0.68),
      new T.MeshBasicMaterial({
        map: assets.shadowTex, transparent: true, opacity: 0.78,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      })
    );
    shadowMesh.rotation.x = -Math.PI * 0.5;
    shadowMesh.position.set(0, 0.02, 0);
    shadowMesh.renderOrder = 5;
    group.add(shadowMesh);

    group.scale.setScalar(scale);

    const label = makeSubtleTag(T, spec.name || "Villager", spec.role || "");
    label.sprite.position.set(0, 1.92, 0);
    group.add(label.sprite);

    /* --- 8. State, Spring-Damped Micro-Life, HLIDARENDI Capsule Arm Solver, 3-DOF Wrists & Muscle Filter --- */
    const MOODS = {
      calm:      { label: "Calm",          f: (mt, P, c) => { P.lid = 0.03; P.roll = 0.025 * Math.sin(c * 0.6); } },
      focus:     { label: "Focused",       f: (mt, P, c) => { P.lid = -0.04; P.neck = 0.06; P.head = 0.04; P.eyeX = 0.16 * Math.sin(c * 0.8); } },
      strain20kg:{ label: "20 kg Effort",  f: (mt, P, c) => { P.lid = 0.14; P.jaw = 0.12 + 0.05 * Math.sin(c * 3.2); P.neck = 0.12; P.roll = -0.08; P.clav = 0.10; } },
      converse:  { label: "Speaking",      f: (mt, P, c) => { P.jaw = 0.08 + 0.18 * Math.max(0, Math.sin(c * 6.8)) * Math.max(0, Math.sin(c * 1.7)); P.roll = 0.05 * Math.sin(c * 1.3); P.yaw = 0.08 * Math.sin(c * 0.9); } },
      listen:    { label: "Listening",     f: (mt, P, c) => { P.roll = 0.09; P.lid = 0.08; P.head = -0.04; P.yaw = 0.06 * Math.sin(c * 0.5); } },
      rejoice:   { label: "Joyful Groove", f: (mt, P, c) => { P.lid = -0.04; P.jaw = 0.12 + 0.06 * Math.sin(c * 4.8); P.roll = 0.08 * Math.sin(c * 2.4); } }
    };
    const SPRING = { neck: [58, 0.62], head: [72, 0.58], yaw: [64, 0.64], roll: [68, 0.56], clav: [85, 0.52] };
    const F = { lid: 0, jaw: 0, neck: 0, head: 0, yaw: 0, roll: 0, clav: 0, eyeX: 0, eyeY: 0 };
    const T_ = Object.assign({}, F);
    const V = { neck: 0, head: 0, yaw: 0, roll: 0, clav: 0 };

    const state = {
      id: spec.id || "npc",
      name: spec.name || "Villager",
      role: spec.role || "",
      circuit: spec.circuit || "west",
      homeX: spec.x || 0,
      homeZ: spec.z || 0,
      homeHeading: spec.heading || 0,
      x: spec.x || 0,
      y: 0,
      z: spec.z || 0,
      heading: spec.heading || 0,
      pose: spec.pose || "idle",
      mood: spec.mood || "calm",
      moodT: 0,
      speech: spec.speech || "",
      phase: (spec.phase || 0) + hash((spec.x || 1) * 3.7 + (spec.z || 2) * 1.9) * TAU,
      blink: 0,
      nextBlink: 1.5 + hash((spec.x || 3) * 7.1) * 4.0,
      nextSaccade: 0.8 + hash((spec.z || 5) * 4.3) * 2.5,
      saccadeX: 0,
      saccadeY: 0,
      breathPh: hash((spec.x || 2) * 9.1) * TAU,
      lookYaw: 0,
      lookPitch: 0,
      bendMemL: new T.Vector3(),
      bendMemR: new T.Vector3(),
      boneQuats: bones.map(b => b.quaternion.clone()),
      musclesReady: false,
      lastPose: "",
      lastNowSec: -999,
      teleported: true,
      poseOpts: {},
      _userPinnedEmotion: false,
      _userPinnedSpeech: false,
      _userPinnedViseme: false,
      _userPinnedHandL: false,
      _userPinnedHandR: false,
      _pinnedNeckLean: null,
      _snapNeckOnce: false,
      _lastExplicitLeanRoll: null,
      _lastExplicitLeanPitch: null,
      _lastExplicitLeanYaw: null,
      _baseCervicalPitch: 0,
      _baseCervicalYaw: 0,
      _baseCervicalRoll: 0,
      _baseCervicalGlideX: 0,
      _preCervicalQuats: {
        thorax: new T.Quaternion(),
        chest: new T.Quaternion(),
        clavL: new T.Quaternion(),
        clavR: new T.Quaternion()
      },
      neckLeanState: { roll: 0, pitch: 0, yaw: 0, glideX: 0, rollDeg: 0, pitchDeg: 0, yawDeg: 0 },
      prevPumpGripY: null,
      pumpVelY: 0,
      autoEmotion: "neutral",
      autoEmotionIntensity: 0.85,
      autoSpeaking: false,
      autoViseme: null,
      autoVisemeAmount: 0,
      autoHandL: "relaxed_breathing",
      autoHandR: "relaxed_breathing"
    };

    const ik = makeIKScratch(T);
    const footTargetL = new T.Vector3();
    const footTargetR = new T.Vector3();
    const handTargetL = new T.Vector3();
    const handTargetR = new T.Vector3();
    const rawGripWorldL = new T.Vector3();
    const rawGripWorldR = new T.Vector3();
    const pocketTestWorld = new T.Vector3();
    const pourLocalTmp = new T.Vector3();
    const localTargetL = new T.Vector3();
    const localTargetR = new T.Vector3();
    const palmLocalL = new T.Vector3();
    const palmLocalR = new T.Vector3();
    const fDirLocalL = new T.Vector3();
    const fDirLocalR = new T.Vector3();
    const palmWorldL = new T.Vector3();
    const palmWorldR = new T.Vector3();
    const fDirWorldL = new T.Vector3();
    const fDirWorldR = new T.Vector3();
    const pumpBarTmp = new T.Vector3();
    const pumpUpTmp = new T.Vector3();
    const pumpSideTmp = new T.Vector3();
    const pumpCharFwd = new T.Vector3();
    const grpWorldQuat = new T.Quaternion();
    const grpWorldQuatInv = new T.Quaternion();
    const elbowWorldL = new T.Vector3();
    const elbowWorldR = new T.Vector3();
    const poleLeg = new T.Vector3(0, 0.15, 1.0);

    // Pre-allocated world-space body self-collision capsules (chest, abdomen, pelvis, head + opposite arm)
    const bodyCapPool = Array.from({ length: 6 }, () => ({ a: new T.Vector3(), b: new T.Vector3(), r: 0.1 }));
    const activeCapsL = [bodyCapPool[0], bodyCapPool[1], bodyCapPool[2], bodyCapPool[3]];
    const activeCapsR = [bodyCapPool[0], bodyCapPool[1], bodyCapPool[2], bodyCapPool[3], bodyCapPool[4], bodyCapPool[5]];

    let lastSurfaceAt = null;
    function place(x, z, heading, surfaceAt) {
      if (Math.hypot(x - state.x, z - state.z) > 0.45) {
        state.teleported = true;
      }
      state.x = x;
      state.z = z;
      if (heading !== undefined && heading !== null) state.heading = heading;
      if (surfaceAt) {
        lastSurfaceAt = surfaceAt;
        state.y = surfaceAt(x, z);
      }
      group.position.set(state.x, state.y + (spec.yOffset || 0), state.z);
      group.rotation.set(0, state.heading, 0, "YXZ");
    }

    function setSpeech(txt) {
      if (txt !== state.speech) {
        state.speech = txt || "";
        label.draw(state.speech);
      }
    }

    function setPose(poseOrObj) {
      if (typeof poseOrObj === "string") {
        state.pose = poseOrObj || "idle";
        state.poseOpts = {};
      } else if (poseOrObj && typeof poseOrObj === "object") {
        if (poseOrObj.pose) state.pose = poseOrObj.pose;
        if (poseOrObj.mood && MOODS[poseOrObj.mood]) state.mood = poseOrObj.mood;
        const pOpts = {};
        for (const k of [
          "emotion", "emotionIntensity", "speaking", "viseme", "visemeAmount",
          "handGestureL", "handGestureR", "handGestureIntensity", "expressiveArmGesture",
          "neckLean", "snapNeckLean",
          "carryCan", "cupAsMic", "phoneOut", "pourAmount", "unloadPhase", "unloadRole"
        ]) {
          if (poseOrObj[k] !== undefined) pOpts[k] = poseOrObj[k];
        }
        state.poseOpts = pOpts;
      }
      return charObj;
    }

    function charToWorld(lx, ly, lz, out) {
      return out.set(lx, ly, lz).applyMatrix4(group.matrixWorld);
    }

    function update(dt, nowSec, opts = {}) {
      if (state.poseOpts) {
        for (const k in state.poseOpts) {
          if (opts[k] === undefined) opts[k] = state.poseOpts[k];
        }
      }
      const pose = opts.pose || state.pose || "idle";
      const beat = opts.beatPulse || 0;
      const surfaceAt = opts.surfaceAt || lastSurfaceAt;
      const t = nowSec + state.phase;

      const sDt = clamp(dt, 0.001, 0.05);
      state.moodT += sDt;

      // Ground character root transform FIRST so any world-to-local or prop-anchor math uses exact frame
      if ((surfaceAt || opts.yOffset !== undefined) && group.parent && pose !== "drive") {
        if (surfaceAt) state.y = surfaceAt(state.x, state.z);
        const effYOff = opts.yOffset !== undefined ? opts.yOffset : (spec.yOffset || 0);
        group.position.set(state.x, state.y + effYOff, state.z);
        group.rotation.set(0, state.heading, 0, "YXZ");
      }
      group.updateMatrixWorld(true);
      group.getWorldQuaternion(grpWorldQuat);
      grpWorldQuatInv.copy(grpWorldQuat).invert();

      if (nowSec > state.nextSaccade) {
        state.saccadeX = (hash(nowSec * 2.3 + state.phase) - 0.5) * 0.14;
        state.saccadeY = (hash(nowSec * 5.1 + state.phase) - 0.5) * 0.10;
        state.nextSaccade = nowSec + 1.4 + hash(nowSec * 3.7 + state.phase) * 2.8;
      }

      if (nowSec > state.nextBlink) {
        state.blink = 1.0;
        state.nextBlink = nowSec + 2.2 + hash(nowSec * 1.7 + state.phase) * 4.6;
      }
      state.blink = Math.max(0, state.blink - sDt * 7.2);

      const isHeavyPose = pose === "heaveSaddle20kg" || pose === "basinPour20kg" || pose === "unloadHandoff" || pose === "pourBowl";
      const activeMoodId = opts.mood || (isHeavyPose ? "strain20kg"
        : pose === "eskista" || pose === "dance" ? "rejoice"
        : pose === "sing" || pose === "auntSing" ? "converse"
        : pose === "recDesk" || pose === "deskWrite" || pose === "deskNotes" || pose === "filmConvoy" ? "focus"
        : pose === "listen" || pose === "phoneGlow" || pose === "holdPhone" || pose === "screenWatch" ? "listen" : state.mood);
      const moodDef = MOODS[activeMoodId] || MOODS.calm;
      for (const k in F) T_[k] = 0;
      moodDef.f(state.moodT, T_, t);
      T_.eyeX += state.saccadeX;
      T_.eyeY += state.saccadeY;

      for (const k in F) {
        const sp = SPRING[k];
        if (sp) {
          V[k] += ((T_[k] - F[k]) * sp[0] - V[k] * 2 * Math.sqrt(sp[0]) * sp[1]) * sDt;
          F[k] += V[k] * sDt;
        } else {
          F[k] = lerp(F[k], T_[k], 1 - Math.exp(-sDt * 12));
        }
      }

      let wantYaw = Math.sin(t * 0.55) * 0.06 + state.saccadeX * 0.16;
      let wantPitch = Math.sin(t * 0.42 + 1.1) * 0.03 + state.saccadeY * 0.12;
      if (opts.lookAt) {
        const dx = opts.lookAt.x - state.x, dz = opts.lookAt.z - state.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.35 && dist < 34) {
          const brg = Math.atan2(dx, dz);
          const diff = Math.atan2(Math.sin(brg - state.heading), Math.cos(brg - state.heading));
          // Keep natural forward composure when inspected by 85mm macro/profile cameras (dist < 0.90m or |diff| > 52°)!
          const macroFollow = smooth(0.55, 1.05, dist) * (1.0 - smooth(0.85, 1.30, Math.abs(diff)));
          wantYaw = lerp(wantYaw, clamp(diff, -0.68, 0.68), macroFollow);
          const dy = (opts.lookAt.y !== undefined ? opts.lookAt.y : state.y + 1.45) - (state.y + 1.56 * scale);
          wantPitch = lerp(wantPitch, clamp(-Math.atan2(dy, dist), -0.36, 0.42), macroFollow);
        }
      }
      const lk = (state.teleported || pose !== state.lastPose) ? 1.0 : (1 - Math.exp(-sDt * 5.6));
      state.lookYaw = lerp(state.lookYaw, wantYaw, lk);
      state.lookPitch = lerp(state.lookPitch, wantPitch, lk);

      for (const b of bones) {
        b.position.copy(b.userData.rest);
        b.rotation.set(0, 0, 0);
        b.scale.set(1, 1, 1);
      }
      const effortRate = (isHeavyPose || pose === "pump" || pose === "eskista") ? 3.8 : 2.05;
      state.breathPh += sDt * effortRate;
      const breath = Math.sin(state.breathPh);

      let pelDrop = 0, pelSwayX = 0, pelFwdZ = 0;
      let spinePitch = 0.02 + 0.012 * breath, spineYaw = 0, spineRoll = 0;
      let chestPitch = 0.015 * breath, chestYaw = 0;
      let clavLiftL = 0, clavLiftR = 0, clavFwdL = 0, clavFwdR = 0;
      let sceneLeanRoll = 0, sceneLeanPitch = 0, sceneLeanYaw = 0, sceneGlideX = 0;
      let jawOpen = 0, curlL = 0.25, curlR = 0.25;
      let spreadL = 0.22, spreadR = 0.22;
      let gripModeL = "wrap", gripModeR = "wrap";
      let pocketPullL = 0, pocketPullR = 0;
      let footPitchL = 0, footPitchR = 0;

      let fLx =  hipX + 0.012, fLy = 0.085, fLz = 0.01;
      let fRx = -hipX - 0.012, fRy = 0.085, fRz = -0.01;

      // Natural relaxed standing hand targets & medial palmar normals (-X for L, +X for R)
      localTargetL.set( shX + 0.036, 0.855, 0.045 + 0.015 * Math.sin(t * 1.1));
      localTargetR.set(-shX - 0.036, 0.855, 0.045 - 0.015 * Math.sin(t * 1.1));
      palmLocalL.set(-0.92, -0.10, -0.36);
      palmLocalR.set( 0.92, -0.10, -0.36);
      fDirLocalL.set(0, 0, 0); // 0 = align smoothly with forearm
      fDirLocalR.set(0, 0, 0);
      let useWorldHandL = false, useWorldHandR = false;
      let useWorldFrameL = false, useWorldFrameR = false;
      let allowBodyAssist = true;
      let phonePitch = -0.66, phoneYaw = 0;
      let cupPitch = 0;
      const pwHalf = (spec.isTablet ? 0.135 : 0.078) * 0.5;

      // Scene-driven emotional, speech & free-hand acting defaults (overridable via opts or setEmotion/Director)
      let autoEmotion = "neutral";
      let autoEmotionIntensity = 0.72;
      let autoSpeaking = false;
      let autoViseme = null;
      let autoVisemeAmount = 0;
      let autoHandL = "relaxed_breathing";
      let autoHandR = "relaxed_breathing";
      let toolLockL = "";
      let toolLockR = opts.carryCan ? "jerrycan_handle" : "";

      // Reset diegetic props
      cupProp.visible = false;
      dipperProp.visible = false;
      phoneProp.visible = false;
      carryCanProp.visible = Boolean(opts.carryCan);
      clipboardProp.visible = false;
      penProp.visible = false;
      cardProp.visible = false;
      twoHandCanProp.visible = false;
      soloRippleGrp.visible = false;
      if (soloCanBundle.streamMesh) soloCanBundle.streamMesh.visible = false;
      if (soloCanBundle.streamCoreMesh) soloCanBundle.streamCoreMesh.visible = false;
      ropeProp.visible = false;
      radioProp.visible = false;
      cyanGlowUniform.value.w = 0;
      handCyanGlowUniform.value.w = 0;

      if (pose === "walk" || pose === "convoyPhoneWalk" || pose === "convoyWalk" || pose === "filmConvoy") {
        const wSpeed = opts.walkRate || 4.6;
        const wPh = (opts.gaitPhase !== undefined ? opts.gaitPhase : nowSec * wSpeed) + state.phase;
        // Grounded stance-to-swing asymmetric foot phase (CONTACT DRIVES MOTION: planted stance -> crisp swing arc!)
        const gaitSample = ph => {
          const u = frac(ph / TAU);
          if (u < 0.60) {
            const su = u / 0.60;
            const z = lerp(1.0, -1.0, su);
            const pitch = su < 0.18 ? lerp(-0.24, 0, su / 0.18) : (su > 0.78 ? lerp(0, 0.30, (su - 0.78) / 0.22) : 0);
            return { z, lift: 0, pitch, stance: Math.sin(su * Math.PI) };
          }
          const sw = (u - 0.60) / 0.40;
          const z = lerp(-1.0, 1.0, smooth(0, 1, sw));
          const lift = Math.sin(sw * Math.PI);
          const pitch = lerp(0.26, -0.22, sw);
          return { z, lift, pitch, stance: 0 };
        };
        const gL = gaitSample(wPh);
        const gR = gaitSample(wPh + Math.PI);
        const stepLen = opts.stepLen !== undefined ? opts.stepLen : 0.25;
        const liftH = 0.088;

        if (!opts.stationary) {
          fLz = gL.z * stepLen;
          fLy = 0.085 + gL.lift * liftH;
          footPitchL = gL.pitch;

          fRz = gR.z * stepLen;
          fRy = 0.085 + gR.lift * liftH;
          footPitchR = gR.pitch;

          const stanceShift = gL.stance - gR.stance;
          pelDrop = -0.020 - 0.014 * (1 - Math.max(gL.stance, gR.stance));
          pelSwayX = 0.024 * stanceShift;
          spineRoll = -0.032 * stanceShift;
          spineYaw = -gL.z * 0.075;
          chestYaw = -gL.z * 0.105;
          spinePitch = 0.055;
        } else {
          pelSwayX = 0.014 * Math.sin(t * 0.8);
          spinePitch = 0.04;
        }

        const hasPhone = pose === "convoyPhoneWalk" || pose === "filmConvoy"
          || (pose === "convoyWalk" && (opts.phoneOut !== undefined ? opts.phoneOut : (spec.enablePhoneLight || spec.circuit === "ahiya")));
        const bob = opts.stationary ? 0 : 0.009 * (gL.stance + gR.stance);
        const ridgeBeat = frac((nowSec + state.phase * 0.27) / 8.8);

        if (pose === "filmConvoy") {
          const py = 1.225 + bob, pz = 0.296;
          phonePitch = -1.24;
          phoneYaw = Math.sin(t * 0.65) * 0.07;
          phoneProp.visible = true;
          phoneProp.position.set(0, py, pz);
          phoneProp.rotation.set(phonePitch, phoneYaw, 0);

          localTargetL.set( pwHalf + 0.036, py - 0.042, pz - 0.036);
          localTargetR.set(-pwHalf - 0.036, py - 0.044, pz - 0.034);
          palmLocalL.set(-0.88, 0.24, 0.40);
          palmLocalR.set( 0.88, 0.24, 0.40);
          fDirLocalL.set(-0.12, 0.46, 0.88);
          fDirLocalR.set( 0.12, 0.46, 0.88);
          gripModeL = gripModeR = "cradle";
          toolLockL = toolLockR = "phone_cradle";
          curlL = 0.52; curlR = 0.52;
          state.lookPitch = lerp(state.lookPitch, 0.14, 0.75);
          state.lookYaw = lerp(state.lookYaw, Math.sin(t * 0.65) * 0.10, 0.65);
          autoEmotion = ridgeBeat < 0.45 ? "surprised_awe" : (ridgeBeat < 0.78 ? "speaking_animated" : "happy_joy");
          autoEmotionIntensity = 0.82;
          autoSpeaking = ridgeBeat >= 0.45 && ridgeBeat < 0.78 ? "ahiya_beacon_sight" : false;
        } else if (hasPhone) {
          // Smartphone cradled in supinated palms casting cyan-blue uplight onto expressive smiling/speaking faces (kf09 & kf12!)
          const oneHand = pose === "convoyWalk" && !spec.isTablet && (hash(state.phase) > 0.45);
          const py = 1.155 + bob, pz = 0.286;
          phonePitch = -0.66;
          phoneYaw = oneHand ? 0.08 : Math.sin(t * 0.55) * 0.04;
          phoneProp.visible = true;
          if (oneHand) {
            phoneProp.position.set(-0.048, py, pz - 0.008);
            phoneProp.rotation.set(phonePitch, phoneYaw, 0);
            localTargetR.set(-0.068, py - 0.026, pz - 0.052);
            palmLocalR.set(0.36, 0.84, 0.40);
            fDirLocalR.set(0.16, 0.12, 0.98);
            gripModeR = "cradle"; toolLockR = "phone_cradle"; curlR = 0.68;

            // Free left hand calls out & waves/points along the ridge periodically!
            const ridgeCall = smooth(0.55, 0.66, ridgeBeat) * (1 - smooth(0.88, 0.97, ridgeBeat));
            localTargetL.set(
              lerp(shX + 0.045, shX + 0.095, ridgeCall),
              lerp(0.89 + gR.lift * 0.04, 1.38 + 0.03 * Math.sin(nowSec * 4.8), ridgeCall),
              lerp(-gL.z * 0.12 + 0.07, 0.30, ridgeCall)
            );
            palmLocalL.set(lerp(-0.90, -0.25, ridgeCall), lerp(-0.10, 0.18, ridgeCall), lerp(-0.35, 0.92, ridgeCall)).normalize();
            curlL = lerp(0.34, 0.12, ridgeCall);
            autoHandL = ridgeCall > 0.35 ? (ridgeBeat < 0.74 ? "pointing_call" : "joyful_wave") : "relaxed_breathing";
          } else {
            phoneProp.position.set(0, py, pz);
            phoneProp.rotation.set(phonePitch, phoneYaw, 0);
            localTargetL.set( pwHalf + 0.025, py - 0.028, pz - 0.046);
            localTargetR.set(-pwHalf - 0.025, py - 0.030, pz - 0.044);
            palmLocalL.set(-0.66, 0.68, 0.32);
            palmLocalR.set( 0.66, 0.68, 0.32);
            fDirLocalL.set(-0.24, 0.12, 0.96);
            fDirLocalR.set( 0.24, 0.12, 0.96);
            gripModeL = gripModeR = "cradle";
            toolLockL = toolLockR = "phone_cradle";
            curlL = 0.66; curlR = 0.66;
          }
          state.lookPitch = lerp(state.lookPitch, 0.30 + 0.04 * Math.sin(t * 0.75), 0.78);
          state.lookYaw = lerp(state.lookYaw, Math.sin(t * 0.55) * 0.14, 0.55);
          // Quiet shared conversation, awe & smiles in upward cyan phone glow
          if (ridgeBeat < 0.38) {
            autoEmotion = "speaking_animated";
            autoEmotionIntensity = 0.80;
            autoSpeaking = "night_phone_whisper";
          } else if (ridgeBeat < 0.70) {
            autoEmotion = "surprised_awe";
            autoEmotionIntensity = 0.76;
          } else {
            autoEmotion = "happy_joy";
            autoEmotionIntensity = 0.84;
          }
        } else {
          // Contralateral walking arm swing + periodic highland ridge greeting wave/callout on free hand!
          const ridgeWave = (pose === "convoyWalk") ? (smooth(0.58, 0.68, ridgeBeat) * (1 - smooth(0.86, 0.95, ridgeBeat))) : 0;
          localTargetL.set(
            lerp(shX + 0.044, shX + 0.10, ridgeWave),
            lerp(0.875 + gR.lift * 0.05, 1.46 + 0.04 * Math.sin(nowSec * 5.0), ridgeWave),
            lerp(-gL.z * 0.16 + 0.06, 0.24, ridgeWave)
          );
          localTargetR.set(-shX - 0.044, 0.875 + gL.lift * 0.05, -gR.z * 0.16 + 0.06);
          if (ridgeWave > 0.3) {
            palmLocalL.set(-0.20, 0.14, 0.96);
            autoHandL = "joyful_wave";
            autoEmotion = "speaking_animated";
            autoSpeaking = "ridge_carrier_call";
            autoEmotionIntensity = 0.85;
          } else {
            autoEmotion = opts.carryCan ? "determined_focus" : "happy_joy";
            autoEmotionIntensity = opts.carryCan ? 0.72 : 0.55;
          }
          if (opts.carryCan) {
            localTargetR.set(-shX - 0.062, 0.86, 0.05 - gR.z * 0.04);
            palmLocalR.set(0.96, -0.05, 0.25);
            curlR = 0.88;
            toolLockR = "jerrycan_handle";
            spineRoll += 0.045;
          }
        }
      } else if (pose === "touchPack") {
        pelDrop = -0.030;
        spinePitch = 0.10;
        chestPitch = 0.05;
        chestYaw = 0.14;
        fLz = 0.12; fRz = -0.10;
        curlL = 0.42;
        localTargetL.set(shX + 0.062, 0.89 + 0.008 * breath, 0.08);
        if (opts.packTarget) {
          useWorldHandR = true;
          handTargetR.copy(opts.packTarget);
          pocketPullR = 0.040;
          toolLockR = "sideWrap";
        } else {
          localTargetR.set(-0.26, 1.04 + 0.01 * breath, 0.24);
        }
        palmLocalR.set(0.42, -0.22, 0.88);
        fDirLocalR.set(-0.18, 0.10, 0.98);
        gripModeR = "flat"; curlR = 0.22;
        const packTalk = frac((nowSec + state.phase * 0.2) / 7.5) < 0.42;
        autoEmotion = packTalk ? "speaking_animated" : "happy_joy";
        autoEmotionIntensity = 0.76;
        autoSpeaking = packTalk ? "mistletoe_check" : false;
        autoHandL = packTalk ? "talking_gesticulate" : "relaxed_breathing";
      } else if (pose === "holdCup" || pose === "micCup" || pose === "listen") {
        // June holding brushed tin cup at chest & raising it like a microphone — with relaxed tucked elbows!
        allowBodyAssist = false;
        pelSwayX = 0.012 * Math.sin(t * 0.9);
        const micCycle = (spec.id === "june" || pose === "micCup" || opts.cupAsMic)
          ? (pose === "micCup" ? 0.88 : smooth(0.32, 0.62, 0.5 + 0.5 * Math.sin(t * 0.85)))
          : 0.0;
        spinePitch = lerp(0.03, -0.01, micCycle);
        const cy = lerp(1.045, 1.335, micCycle) + 0.008 * breath;
        const cz = lerp(0.245, 0.225, micCycle);
        cupPitch = -0.24 * micCycle;
        cupProp.visible = true;

        if (pose === "listen") {
          cupProp.position.set(-0.035, 1.04, 0.24);
          cupProp.rotation.set(0, 0, 0);
          localTargetR.set(-0.092, 1.028, 0.195);
          palmLocalR.set(0.94, 0.18, -0.26);
          fDirLocalR.set(0.20, 0.10, 0.97);
          gripModeR = "wrap"; toolLockR = "sideWrap"; curlR = 0.78;

          localTargetL.set(0.098, 1.565, 0.018);
          palmLocalL.set(-0.68, 0.15, 0.72);
          fDirLocalL.set(-0.15, 0.92, -0.35);
          gripModeL = "underRib"; toolLockL = "underRib"; curlL = 0.42;
          autoEmotion = "surprised_awe";
          autoEmotionIntensity = 0.80;
        } else {
          cupProp.position.set(0, cy, cz);
          cupProp.rotation.set(cupPitch, 0, 0);
          localTargetL.set( 0.060, cy - 0.014, cz - 0.044);
          localTargetR.set(-0.060, cy - 0.014, cz - 0.044);
          palmLocalL.set(-0.94, 0.18, -0.28);
          palmLocalR.set( 0.94, 0.18, -0.28);
          fDirLocalL.set(-0.22, 0.14, 0.96);
          fDirLocalR.set( 0.22, 0.14, 0.96);
          gripModeL = gripModeR = "wrap";
          toolLockL = toolLockR = "sideWrap";
          curlL = 0.78; curlR = 0.78;
          if (micCycle > 0.45) {
            jawOpen = 0.10 + 0.12 * Math.max(0, Math.sin(t * 5.8));
            state.lookPitch = lerp(state.lookPitch, -0.05, 0.65);
            autoEmotion = "speaking_animated";
            autoEmotionIntensity = 0.88;
            autoSpeaking = "june_tin_cup_mic";
          } else {
            autoEmotion = "happy_joy";
            autoEmotionIntensity = 0.78;
          }
        }
      } else if (pose === "phoneGlow" || pose === "holdPhone" || pose === "tabletWatch") {
        pelSwayX = 0.012 * Math.sin(t * 0.8);
        spinePitch = 0.08;
        const py = 1.152 + 0.008 * breath, pz = 0.284;
        phonePitch = -0.66;
        phoneYaw = Math.sin(t * 0.65) * 0.04;
        phoneProp.visible = true;
        phoneProp.position.set(0, py, pz);
        phoneProp.rotation.set(phonePitch, phoneYaw, 0);

        localTargetL.set( pwHalf + 0.025, py - 0.028, pz - 0.046);
        localTargetR.set(-pwHalf - 0.025, py - 0.030, pz - 0.044);
        palmLocalL.set(-0.66, 0.68, 0.32);
        palmLocalR.set( 0.66, 0.68, 0.32);
        fDirLocalL.set(-0.24, 0.12, 0.96);
        fDirLocalR.set( 0.24, 0.12, 0.96);
        gripModeL = gripModeR = "cradle";
        toolLockL = toolLockR = "phone_cradle";
        curlL = 0.66; curlR = 0.66;
        state.lookPitch = pose === "tabletWatch" ? (0.26 + 0.08 * Math.sin(t * 0.9)) : 0.34;
        state.lookYaw = Math.sin(t * 0.7) * 0.09;
        const phArc = frac((nowSec + state.phase * 0.3) / 8.0);
        autoEmotion = phArc < 0.42 ? "surprised_awe" : (phArc < 0.74 ? "speaking_animated" : "happy_joy");
        autoEmotionIntensity = 0.80;
        autoSpeaking = phArc >= 0.42 && phArc < 0.74 ? "cyan_tablet_signal" : false;
      } else if (pose === "pump") {
        const pPh = opts.pumpPhase !== undefined ? opts.pumpPhase : nowSec * 4.4;
        const stroke = Math.sin(pPh);
        fLz = 0.13; fRz = -0.12;

        const extL = opts.pumpGripL || opts.worldGripL || null;
        const extR = opts.pumpGripR || opts.worldGripR || null;
        const extMid = opts.pumpGripWorld || null;

        if (extL && extR) {
          useWorldHandL = true;
          useWorldHandR = true;
          handTargetL.copy(extL);
          handTargetR.copy(extR);
        } else if (extMid) {
          useWorldHandL = true;
          useWorldHandR = true;
          if (opts.pumpBarDir && opts.pumpBarDir.lengthSq() > 1e-6) {
            pumpBarTmp.copy(opts.pumpBarDir).normalize();
          } else {
            pumpBarTmp.set(0, 0, 1).applyQuaternion(grpWorldQuat);
          }
          handTargetL.copy(extMid).addScaledVector(pumpBarTmp, -0.036 * scale);
          handTargetR.copy(extMid).addScaledVector(pumpBarTmp,  0.040 * scale);
        } else {
          const hY = 0.98 + stroke * 0.20;
          const hZ = 0.36 + (1 - Math.abs(stroke)) * 0.04;
          localTargetL.set( 0.032, hY, hZ - 0.022);
          localTargetR.set(-0.032, hY - 0.01, hZ + 0.028);
        }

        pumpCharFwd.set(0, 0, 1).applyQuaternion(grpWorldQuat);
        if (opts.pumpBarDir && opts.pumpBarDir.lengthSq() > 1e-6) {
          pumpBarTmp.copy(opts.pumpBarDir).normalize();
        } else {
          pumpBarTmp.copy(pumpCharFwd);
        }
        const fwdAlign = Math.abs(pumpBarTmp.dot(pumpCharFwd));
        const isTransverseBar = fwdAlign < 0.45;

        // Couple full-body knee bend, hip-hinge & automatic chest-clearance stand-off to live world grip center!
        const refGripY = useWorldHandL ? ((handTargetL.y + handTargetR.y) * 0.5 - state.y) / scale : (0.98 + stroke * 0.20);
        const downK = clamp((1.18 - refGripY) * 2.0, 0, 1);

        if (!isTransverseBar && useWorldHandL) {
          const midX = (handTargetL.x + handTargetR.x) * 0.5;
          const midZ = (handTargetL.z + handTargetR.z) * 0.5;
          const fwdDist = ((midX - state.x) * pumpCharFwd.x + (midZ - state.z) * pumpCharFwd.z) / scale;
          // Maintain ~0.46m ergonomic lever stand-off: chest stays >20cm clear of tip knob while BOTH hands reach gNear & gFar at 0.000m!
          const standShiftZ = clamp(fwdDist - 0.46, -0.32, 0.16);
          pelDrop = -0.05 - downK * 0.12;
          pelFwdZ = standShiftZ + downK * 0.022;
          fLz = 0.12 + standShiftZ * 0.92;
          fRz = -0.13 + standShiftZ * 0.92;
          spinePitch = 0.21 + downK * 0.18;
          chestPitch = 0.07 + downK * 0.08;
          allowBodyAssist = false;
        } else {
          pelDrop = -0.05 - downK * 0.11;
          pelFwdZ = 0.045 + downK * 0.025;
          spinePitch = 0.22 + downK * 0.18;
          chestPitch = 0.07 + downK * 0.08;
        }

        if (isTransverseBar) {
          // Transverse horizontal bar (e.g. M1 Macro Hands Stage 2): forearm-aligned pronated grip wrapping concentrically OVER & UNDER bar!
          useWorldFrameL = true;
          useWorldFrameR = true;
          palmLocalL.set(-0.10, -0.82, -0.56).normalize();
          fDirLocalL.set(-0.24, -0.34,  0.91).normalize();
          palmWorldL.copy(palmLocalL).applyQuaternion(grpWorldQuat).normalize();
          fDirWorldL.copy(fDirLocalL).applyQuaternion(grpWorldQuat).normalize();

          palmLocalR.set( 0.10, -0.82, -0.56).normalize();
          fDirLocalR.set( 0.24, -0.34,  0.91).normalize();
          palmWorldR.copy(palmLocalR).applyQuaternion(grpWorldQuat).normalize();
          fDirWorldR.copy(fDirLocalR).applyQuaternion(grpWorldQuat).normalize();
          spinePitch = 0.08;
          chestPitch = 0.03;
          pelDrop = -0.02;
          pelFwdZ = 0.01;
          allowBodyAssist = false;
        } else {
          // Longitudinal standpipe lever: pronated overhand grip seated flush on top of 14.5mm iron shaft!
          if (pumpBarTmp.dot(pumpCharFwd) < 0) pumpBarTmp.negate();
          pumpUpTmp.set(0, 1, 0).addScaledVector(pumpBarTmp, -pumpBarTmp.y).normalize();
          pumpSideTmp.crossVectors(pumpUpTmp, pumpBarTmp).normalize();

          useWorldFrameL = true;
          useWorldFrameR = true;
          palmWorldL.copy(pumpSideTmp).multiplyScalar(-0.28).addScaledVector(pumpUpTmp, -0.96).normalize();
          fDirWorldL.copy(pumpSideTmp).multiplyScalar(-0.88).addScaledVector(pumpUpTmp, -0.26).addScaledVector(pumpBarTmp, 0.40).normalize();
          fDirWorldL.addScaledVector(palmWorldL, -fDirWorldL.dot(palmWorldL)).normalize();

          palmWorldR.copy(pumpSideTmp).multiplyScalar( 0.28).addScaledVector(pumpUpTmp, -0.96).normalize();
          fDirWorldR.copy(pumpSideTmp).multiplyScalar( 0.88).addScaledVector(pumpUpTmp, -0.26).addScaledVector(pumpBarTmp, 0.40).normalize();
          fDirWorldR.addScaledVector(palmWorldR, -fDirWorldR.dot(palmWorldR)).normalize();
        }

        gripModeL = gripModeR = "pumpBar";
        toolLockL = toolLockR = "pumpBar";
        curlL = isTransverseBar ? 1.12 : 1.10;
        curlR = isTransverseBar ? 1.12 : 1.10;
        if (useWorldHandL) {
          pocketPullL = isTransverseBar ? 0.062 : 0.056;
          pocketPullR = isTransverseBar ? 0.062 : 0.056;
        }
        state.lookPitch = 0.16 + downK * 0.16;

        // Synchronize facial effort with live pump stroke velocity: top intake (determined_focus) -> heavy downstroke (effort_strain_20kg) -> bottom release (relief_sigh)!
        if (state.prevPumpGripY !== null && sDt > 0.0005) {
          const rawVel = clamp((refGripY - state.prevPumpGripY) / sDt, -2.5, 2.5);
          state.pumpVelY = lerp(state.pumpVelY, rawVel, 1 - Math.exp(-sDt * 14));
        }
        state.prevPumpGripY = refGripY;

        if (!isTransverseBar) {
          if (downK < 0.24 || (state.pumpVelY > 0.16 && downK < 0.52)) {
            autoEmotion = "determined_focus";
            autoEmotionIntensity = 0.76;
          } else if (state.pumpVelY < -0.10 || (downK >= 0.24 && downK < 0.76 && state.pumpVelY <= 0.10)) {
            autoEmotion = "effort_strain_20kg";
            autoEmotionIntensity = clamp(0.64 + downK * 0.22, 0.64, 0.84);
          } else {
            autoEmotion = "relief_sigh";
            autoEmotionIntensity = 0.74;
          }
        } else {
          autoEmotion = "determined_focus";
          autoEmotionIntensity = 0.75;
        }
      } else if (pose === "handInspect" || opts.handInspect) {
        // M1 Macro Dorsal + Palmar Showcase: Left Hand Pronated (Dorsal tendons & nails), Right Hand Supinated (Palmar creases & pads)
        allowBodyAssist = false;
        spinePitch = 0.04;
        chestPitch = 0.02;
        const twistWave = Math.sin(nowSec * 1.55) * 0.26;
        const liftWave = Math.sin(nowSec * 1.1) * 0.012;
        localTargetL.set( 0.092, 1.152 + liftWave, 0.268);
        localTargetR.set(-0.092, 1.152 - liftWave, 0.268);

        palmLocalL.set(-0.14 + twistWave * 0.55, -0.94, 0.28).normalize();
        fDirLocalL.set(-0.12, 0.26, 0.96).normalize();

        palmLocalR.set(-0.10 + twistWave * 0.55,  0.94, -0.28).normalize();
        fDirLocalR.set( 0.12, 0.26, 0.96).normalize();

        gripModeL = gripModeR = "inspectWave";
        toolLockL = toolLockR = "sideWrap";
        let priorFlex = 0.56;
        if (assetsV3 && assetsV3.motionPriors && assetsV3.motionPriors.loaded) {
          const curves = assetsV3.motionPriors.data?.m1_hands_grip?.curves?.finger_flexion_01;
          if (Array.isArray(curves) && curves.length > 0) {
            const idxP = Math.floor(frac(nowSec / 10.0) * curves.length) % curves.length;
            priorFlex = 0.36 + 0.48 * clamp(curves[idxP], 0, 1);
          }
        }
        curlL = priorFlex;
        curlR = priorFlex;
        spreadL = 0.34;
        spreadR = 0.34;
        state.lookPitch = 0.28;
        state.lookYaw = Math.sin(nowSec * 0.8) * 0.08;
        autoEmotion = "determined_focus";
        autoEmotionIntensity = 0.65;
      } else if (pose === "kneelPour") {
        allowBodyAssist = false;
        pelDrop = -0.44;
        pelFwdZ = -0.04;
        spinePitch = 0.34;
        chestPitch = 0.12;
        fLx =  hipX + 0.03; fLy = 0.085; fLz = 0.24;
        fRx = -hipX - 0.02; fRy = 0.115; fRz = -0.22;
        footPitchR = 0.55;
        localTargetL.set( 0.11, 0.62, 0.26);
        localTargetR.set(-0.04, 0.72 + 0.015 * Math.sin(t * 1.6), 0.44);
        palmLocalL.set(-0.24, -0.92, 0.28);
        palmLocalR.set( 0.74,  0.42, -0.52);
        fDirLocalR.set( 0.14, -0.18,  0.97);
        gripModeL = "flat"; gripModeR = "wrap";
        toolLockL = "sideWrap"; toolLockR = "sideWrap";
        curlL = 0.36; curlR = 0.88;
        dipperProp.visible = true;
        if (dipperStream) {
          const pulseS = 0.92 + 0.12 * Math.sin(nowSec * 7.5);
          dipperStream.scale.set(pulseS, 1, pulseS);
        }
        cyanGlowUniform.value.set(-0.04, 0.62, 0.42, 0.55);
        state.lookPitch = 0.42;
        state.lookYaw = -0.08;
        autoEmotion = Math.sin(t * 0.55) > 0 ? "happy_joy" : "relief_sigh";
        autoEmotionIntensity = 0.80;
      } else if (pose === "shadeScreen") {
        // Etta at the linen projection screen: transitions from brow_shade_lookout wonder (surprised_awe) -> poignant sad_grief / heart_gratitude touching sternum!
        allowBodyAssist = false;
        const ettaArc = frac((nowSec + state.phase * 0.15) / 9.2);
        const heartBlend = smooth(0.46, 0.56, ettaArc) * (1 - smooth(0.84, 0.94, ettaArc));
        spinePitch = lerp(0.03, 0.08, heartBlend);
        chestYaw = lerp(-0.14, -0.06, heartBlend);

        localTargetR.set(
          lerp(-0.075, -0.018, heartBlend),
          lerp(1.595 + 0.012 * Math.sin(t * 1.1), 1.255 + 0.008 * breath, heartBlend),
          lerp(0.155, 0.196, heartBlend)
        );
        palmLocalR.set(lerp(0.18, 0.16, heartBlend), lerp(-0.94, 0.18, heartBlend), lerp(0.28, -0.96, heartBlend)).normalize();
        fDirLocalR.set(lerp(0.78, 0.82, heartBlend), lerp(-0.04, 0.34, heartBlend), lerp(0.62, 0.42, heartBlend)).normalize();
        gripModeR = "flat"; curlR = lerp(0.08, 0.24, heartBlend);

        localTargetL.set(
          lerp(0.13, 0.035, heartBlend * 0.75),
          lerp(0.94, 1.215 + 0.008 * breath, heartBlend * 0.75),
          lerp(0.14, 0.205, heartBlend * 0.75)
        );
        palmLocalL.set(lerp(-0.78, -0.22, heartBlend), lerp(0.25, 0.20, heartBlend), lerp(-0.56, -0.95, heartBlend)).normalize();
        curlL = lerp(0.35, 0.26, heartBlend);

        const shoeBeat = Math.max(0, Math.sin(t * 1.35 - 0.8)) * (1 - heartBlend * 0.7);
        fRy = 0.085 + Math.pow(shoeBeat, 4) * 0.045;
        footPitchR = Math.pow(shoeBeat, 4) * 0.18;
        state.lookPitch = lerp(-0.08, 0.04, heartBlend);
        state.lookYaw = lerp(-0.16, -0.08, heartBlend);

        if (ettaArc < 0.48) {
          autoEmotion = "surprised_awe";
          autoEmotionIntensity = 0.88;
          autoViseme = "OH";
          autoVisemeAmount = 0.42;
          autoHandR = "brow_shade_lookout";
          autoHandL = "relaxed_breathing";
        } else if (ettaArc < 0.74) {
          autoEmotion = "sad_grief";
          autoEmotionIntensity = 0.90;
          autoHandR = "heart_gratitude";
          autoHandL = "heart_gratitude";
        } else {
          autoEmotion = "relief_sigh";
          autoEmotionIntensity = 0.84;
          autoHandR = "heart_gratitude";
          autoHandL = "relaxed_breathing";
        }
      } else if (pose === "screenWatch" || pose === "seatedWatch") {
        allowBodyAssist = false;
        const isSeated = pose === "seatedWatch" || Boolean(opts.seated) || spec.id === "old_bride";
        const footBeat = Math.pow(Math.max(0, Math.sin(t * 1.25 + 0.4)), 5);
        const reelPhase = frac((nowSec + state.phase * 0.22) / 10.0);
        if (isSeated) {
          pelDrop = -0.38;
          pelFwdZ = -0.05;
          fLx =  hipX + 0.02; fLy = 0.085 + footBeat * 0.048; fLz = 0.28 + footBeat * 0.03;
          fRx = -hipX - 0.02; fRy = 0.085; fRz = 0.28;
          footPitchL = -footBeat * 0.24;
          spinePitch = 0.11 + 0.022 * Math.sin(t * 0.9);
          localTargetL.set( hipX + 0.02, 0.63 + 0.01 * breath, 0.18);
          localTargetR.set(-hipX - 0.02, 0.63 + 0.01 * breath, 0.18);
          palmLocalL.set(-0.22, -0.94, 0.22);
          palmLocalR.set( 0.22, -0.94, 0.22);
          gripModeL = gripModeR = "flat";
          toolLockL = toolLockR = "sideWrap";
          curlL = 0.30; curlR = 0.30;
        } else {
          pelSwayX = 0.018 * Math.sin(t * 0.62);
          pelDrop = -0.012 * Math.abs(Math.sin(t * 0.62));
          spinePitch = 0.02 + 0.015 * breath;
          if (spec.id === "etta" || opts.footLift) {
            fRy = 0.085 + footBeat * 0.045;
            fRz = 0.03 * footBeat;
            footPitchR = -footBeat * 0.20;
          }
          const touchHeart = smooth(0.55, 0.68, reelPhase) * (1 - smooth(0.86, 0.96, reelPhase));
          localTargetL.set( 0.055, lerp(1.03, 1.21, touchHeart) + 0.008 * breath, 0.21);
          localTargetR.set(-0.055, lerp(1.02, 1.23, touchHeart) + 0.008 * breath, 0.22);
          palmLocalL.set(-0.72, 0.32, -0.60);
          palmLocalR.set( 0.72, 0.32, -0.60);
          curlL = 0.52; curlR = 0.52;
          autoHandL = touchHeart > 0.35 ? "heart_gratitude" : "relaxed_breathing";
          autoHandR = touchHeart > 0.35 ? "heart_gratitude" : "relaxed_breathing";
        }
        state.lookPitch = lerp(state.lookPitch, -0.12 + 0.03 * Math.sin(t * 0.5), 0.75);
        state.lookYaw = lerp(state.lookYaw, 0.10 * Math.sin(t * 0.42), 0.65);
        autoEmotion = reelPhase < 0.38 ? "surprised_awe" : (reelPhase < 0.68 ? "sad_grief" : "happy_joy");
        autoEmotionIntensity = 0.80;
      } else if (pose === "auntSing" || pose === "sing" || pose === "wave") {
        allowBodyAssist = false;
        const sPh = nowSec * 3.4 + state.phase;
        const phrase = 0.5 + 0.5 * Math.sin(sPh * 0.5);
        pelSwayX = 0.022 * Math.sin(sPh * 0.5);
        spinePitch = -0.035 + 0.028 * Math.sin(sPh);
        chestPitch = 0.035 * phrase + 0.02 * breath;
        chestYaw = 0.08 * Math.sin(sPh * 0.5);
        clavLiftL = 0.05 * phrase; clavLiftR = 0.05 * phrase;
        sceneLeanRoll = 0.14 * Math.sin(sPh * 0.5 + 0.4);
        sceneLeanPitch = -0.04 * phrase;
        jawOpen = pose === "wave" ? 0.10 : (0.16 + 0.16 * Math.max(0, Math.sin(sPh * 1.75)) * (0.55 + 0.45 * phrase));
        if (pose === "wave") {
          localTargetR.set(-shX - 0.08 + 0.06 * Math.sin(nowSec * 5.2), 1.54, 0.18);
          palmLocalR.set(0.15, 0.12, 0.98);
          fDirLocalR.set(-0.10, 0.96, 0.24);
          gripModeR = "flat"; curlR = 0.08;
          const callToggle = Math.sin(t * 0.9) > 0.15;
          autoEmotion = callToggle ? "laughing_open" : "speaking_animated";
          autoSpeaking = !callToggle ? "ridge_wave_greeting" : false;
          autoEmotionIntensity = 0.92;
          autoHandR = "joyful_wave";
          autoHandL = "relaxed_breathing";
        } else if (pose === "auntSing") {
          localTargetL.set( 0.13 + 0.05 * phrase, 1.16 + 0.06 * Math.sin(sPh), 0.25 + 0.05 * phrase);
          localTargetR.set(-0.13 - 0.05 * phrase, 1.19 + 0.06 * Math.sin(sPh - 0.6), 0.27 + 0.06 * phrase);
          palmLocalL.set(-0.55, 0.65, 0.52);
          palmLocalR.set( 0.55, 0.65, 0.52);
          fDirLocalL.set(-0.15, 0.18, 0.97);
          fDirLocalR.set( 0.15, 0.18, 0.97);
          gripModeL = gripModeR = "flat";
          curlL = 0.14; curlR = 0.12;
          state.lookPitch = -0.08 - 0.05 * phrase;
          autoEmotion = phrase > 0.28 ? "speaking_animated" : "happy_joy";
          autoEmotionIntensity = 0.94;
          autoSpeaking = "ar03_aunt_lemlem_song";
          autoHandL = phrase > 0.5 ? "talking_gesticulate" : "cupped_water_plea";
          autoHandR = phrase > 0.5 ? "talking_gesticulate" : "heart_gratitude";
        } else {
          localTargetL.set( 0.11, 1.14 + 0.03 * Math.sin(sPh), 0.24);
          localTargetR.set(-0.11, 1.14 + 0.03 * Math.cos(sPh), 0.24);
          palmLocalL.set(-0.62, 0.58, 0.52);
          palmLocalR.set( 0.62, 0.58, 0.52);
          gripModeL = gripModeR = "flat";
          curlL = 0.20; curlR = 0.20;
          autoEmotion = "speaking_animated";
          autoEmotionIntensity = 0.88;
          autoSpeaking = "oxbow_chorus";
          autoHandL = "talking_gesticulate";
          autoHandR = "talking_gesticulate";
        }
      } else if (pose === "clerkWindow") {
        allowBodyAssist = false;
        spinePitch = 0.15;
        chestPitch = 0.05;
        const stamp = Math.sin(t * 1.7);
        localTargetL.set( 0.12, 0.99, 0.28);
        localTargetR.set(-0.07 + 0.03 * stamp, 1.01 + Math.max(0, stamp) * 0.04, 0.30);
        palmLocalL.set(-0.52, 0.78, 0.34);
        fDirLocalL.set(-0.18, 0.08, 0.98);
        palmLocalR.set( 0.52, -0.82, 0.22);
        fDirLocalR.set( 0.28, -0.20, 0.94);
        gripModeL = "cradle"; gripModeR = "pinch";
        toolLockL = "cradle"; toolLockR = "pinch";
        curlL = 0.28; curlR = 0.78;
        cardProp.visible = true;
        penProp.visible = true;
        state.lookPitch = 0.28;
        const clerkSpeak = frac((nowSec + state.phase * 0.2) / 7.2) > 0.58;
        autoEmotion = clerkSpeak ? "speaking_animated" : "determined_focus";
        autoSpeaking = clerkSpeak ? "ration_ledger_verified" : false;
        autoEmotionIntensity = 0.78;
      } else if (pose === "recDesk" || pose === "deskWrite" || pose === "deskNotes") {
        // Hill Archive REC PPC Seated Operators (00:37 kf08!): Live VHF radio dispatch + expressive free-hand callouts & attentive logging!
        allowBodyAssist = false;
        pelDrop = -0.36;
        pelFwdZ = -0.06;
        fLx =  hipX + 0.03; fLy = 0.085; fLz = 0.28;
        fRx = -hipX - 0.03; fRy = 0.085; fRz = 0.26;
        spinePitch = 0.18;
        chestPitch = 0.06;

        const isRadioOp = pose === "deskNotes" || opts.deskRole === "radio" || opts.opRole === "radio" || spec.id === "ppc_op_female" || spec.id === "op_f";
        clipboardProp.visible = true;

        if (!isRadioOp) {
          // Daniel (left operator): writes with determined_focus + locked right-hand tripod pinch, then glances toward Hanna with surprised_awe -> happy_joy nod!
          const glanceCycle = frac((nowSec + state.phase * 0.12) / 7.8);
          const glanceUp = smooth(0.58, 0.68, glanceCycle) * (1 - smooth(0.90, 0.98, glanceCycle));
          clipboardProp.position.set(0.04, 0.786, 0.34);
          clipboardProp.rotation.set(0.08, -0.16, 0);

          localTargetL.set(0.132, 0.804, 0.292);
          palmLocalL.set(-0.14, -0.98, 0.10);
          fDirLocalL.set(-0.16, -0.08, 0.98);
          gripModeL = "flat"; toolLockL = "sideWrap"; curlL = 0.16; spreadL = 0.32;

          localTargetR.set(
            -0.052 + 0.022 * Math.sin(t * 5.2) * (1 - glanceUp),
            0.838 + 0.020 * glanceUp,
            0.302 + 0.012 * Math.cos(t * 5.2) * (1 - glanceUp)
          );
          palmLocalR.set(0.52, -0.82, 0.22);
          fDirLocalR.set(0.30, -0.22, 0.93);
          gripModeR = "pinch"; toolLockR = "pinch"; curlR = 0.78;
          penProp.visible = true;

          const nod = glanceCycle >= 0.76 ? Math.sin((glanceCycle - 0.76) * 28.0) * 0.06 * glanceUp : 0;
          state.lookPitch = lerp(0.32, -0.06 + nod, glanceUp);
          state.lookYaw = lerp(-0.06, -0.24, glanceUp);

          if (glanceUp < 0.25) {
            autoEmotion = "determined_focus";
            autoEmotionIntensity = 0.84;
          } else if (glanceCycle < 0.76) {
            autoEmotion = "surprised_awe";
            autoEmotionIntensity = 0.82;
            autoViseme = "IH";
            autoVisemeAmount = 0.45;
          } else {
            autoEmotion = "happy_joy";
            autoEmotionIntensity = 0.88;
          }
        } else {
          // Hanna (right operator): alternates active open-mouth VHF radio dispatch (+ expressive left-hand gesticulate/point toward monitor) & attentive listening!
          const dispPhase = frac((nowSec + state.phase * 0.15) / 8.2);
          const isDispatching = dispPhase < 0.62;
          const onCall = isDispatching
            ? (0.94 + 0.04 * Math.sin(t * 1.6))
            : (0.64 + 0.04 * Math.sin(t * 0.9));
          const leftGestureLift = isDispatching
            ? (smooth(0.06, 0.18, dispPhase) * (1 - smooth(0.50, 0.60, dispPhase)))
            : 0;
          const pointMonitor = isDispatching && dispPhase >= 0.32 && dispPhase < 0.54;

          clipboardProp.position.set(0.06, 0.786, 0.33);
          clipboardProp.rotation.set(0.08, 0.18, 0);

          // Free left hand rises off clipboard to gesture / point toward telemetry monitor during active VHF dispatch!
          localTargetL.set(
            lerp(0.125, pointMonitor ? 0.105 : 0.155 + 0.028 * Math.sin(nowSec * 4.2), leftGestureLift),
            lerp(0.804, pointMonitor ? 1.085 : 0.995 + 0.032 * Math.sin(nowSec * 5.1), leftGestureLift),
            lerp(0.286, pointMonitor ? 0.395 : 0.335, leftGestureLift)
          );
          palmLocalL.set(
            lerp(-0.12, pointMonitor ? -0.34 : -0.58, leftGestureLift),
            lerp(-0.98, pointMonitor ? -0.78 :  0.56, leftGestureLift),
            lerp( 0.12, pointMonitor ?  0.50 :  0.56, leftGestureLift)
          ).normalize();
          fDirLocalL.set(-0.18, pointMonitor ? 0.14 : 0.08, 0.97).normalize();
          gripModeL = "flat";
          toolLockL = leftGestureLift > 0.15 ? "" : "sideWrap";
          curlL = lerp(0.14, 0.22, leftGestureLift);
          spreadL = 0.32;

          // Right fist stays locked in upright VHF handset grip (`pumpBar`) held cleanly forward of mouth/chin with vertical whip antenna!
          localTargetR.set(
            lerp(-0.145, -0.108, onCall),
            lerp(0.845,  1.072,  onCall),
            lerp(0.285,  0.264,  onCall)
          );
          palmLocalR.set(lerp(0.68, 0.78, onCall), lerp(0.06, 0.08, onCall), lerp(-0.72, -0.62, onCall)).normalize();
          fDirLocalR.set(lerp(0.42, 0.62, onCall), lerp(0.02, 0.05, onCall), lerp(0.90, 0.78, onCall)).normalize();
          gripModeR = "pumpBar"; toolLockR = "vhf_handset"; curlR = 0.98;
          penProp.visible = false;
          radioProp.visible = true;

          if (isDispatching) {
            jawOpen = 0.12 + 0.14 * Math.max(0, Math.sin(t * 8.4));
            state.lookPitch = pointMonitor ? -0.11 : (-0.04 + 0.03 * Math.sin(t * 1.1));
            state.lookYaw = pointMonitor ? 0.20 : (0.13 + 0.04 * Math.sin(t * 0.8));
            autoEmotion = "speaking_animated";
            autoEmotionIntensity = 0.96;
            autoSpeaking = "hanna_rec_ppc_ch04";
            autoHandL = pointMonitor ? "pointing_call" : "talking_gesticulate";
          } else {
            jawOpen = 0.02;
            state.lookPitch = 0.06 + 0.03 * Math.sin(t * 0.8);
            state.lookYaw = 0.10 + 0.04 * Math.sin(t * 0.6);
            autoEmotion = dispPhase < 0.82 ? "concerned_pleading" : "determined_focus";
            autoEmotionIntensity = 0.82;
            autoSpeaking = false;
            autoHandL = "relaxed_breathing";
          }
        }
      } else if (pose === "unloadHandoff" || pose === "pourBowl" || pose === "basinPour20kg" || pose === "heaveSaddle20kg" || pose === "childReceive20kg") {
        const hasExtGrips = Boolean(opts.worldGripL && opts.worldGripR);
        if (opts._sharedUnload || hasExtGrips) {
          // Synchronized 2-Actor Jerrycan Handoff / Unload / Pour driven by authoritative world-space jerrycan grips!
          const u = opts.unloadPhase !== undefined ? opts.unloadPhase : 0.35;
          const role = opts.unloadRole || (pose === "childReceive20kg" ? "child" : "lead");
          const heaveK = opts._sharedUnload ? (smooth(0.20, 0.34, u) * (1 - smooth(0.44, 0.56, u))) : clamp((0.46 - u) * 4.5, 0, 1);
          const walkK  = opts._sharedUnload ? (smooth(0.44, 0.50, u) * (1 - smooth(0.64, 0.70, u))) : 0;
          const pourK  = opts._sharedUnload ? (smooth(0.66, 0.74, u) * (1 - smooth(0.89, 0.95, u))) : 0;

          if (walkK > 0.02) {
            const wPh = u * TAU * 7.0 + (role === "partner" ? Math.PI : 0);
            const sL = Math.sin(wPh), cL = Math.cos(wPh);
            const sR = Math.sin(wPh + Math.PI), cR = Math.cos(wPh + Math.PI);
            fLz = sL * 0.18 * walkK; fLy = 0.085 + Math.max(0, cL) * 0.065 * walkK;
            fRz = sR * 0.18 * walkK; fRy = 0.085 + Math.max(0, cR) * 0.065 * walkK;
          } else {
            fLx = hipX + 0.052; fLz = 0.14;
            fRx = -hipX - 0.052; fRz = -0.13;
          }

          if (pose === "childReceive20kg") {
            // June receiving 20 kg: dynamically step/lean into ergonomic reach so both open curved palms (`cradle`) press 0.000m underneath front-bottom bevels!
            allowBodyAssist = true;
            const recvK = clamp((u - 0.34) * 5.0, 0, 1);
            pumpCharFwd.set(0, 0, 1).applyQuaternion(grpWorldQuat);
            const midX = (opts.worldGripL.x + opts.worldGripR.x) * 0.5;
            const midZ = (opts.worldGripL.z + opts.worldGripR.z) * 0.5;
            const juneFwdDist = ((midX - state.x) * pumpCharFwd.x + (midZ - state.z) * pumpCharFwd.z) / scale;
            const juneGripY = ((opts.worldGripL.y + opts.worldGripR.y) * 0.5 - state.y) / scale;
            const stepIn = clamp(juneFwdDist - 0.26, -0.06, 0.26);
            const crouchNeed = clamp((0.94 - juneGripY) * 0.65, 0, 0.14);

            fLx = hipX + 0.044; fLz = 0.12 + stepIn * 0.88;
            fRx = -hipX - 0.044; fRz = -0.08 + stepIn * 0.88;
            pelDrop = -0.045 - crouchNeed - 0.025 * recvK;
            pelFwdZ = stepIn;
            spinePitch = 0.12 + 0.05 * recvK + crouchNeed * 0.5;
            chestPitch = 0.06;
            clavLiftL = 0.03 + 0.03 * recvK;
            clavLiftR = 0.03 + 0.03 * recvK;
            clavFwdL = 0.10;
            clavFwdR = 0.10;
            palmLocalL.set(-0.34, 0.90, 0.24).normalize();
            palmLocalR.set( 0.34, 0.90, 0.24).normalize();
            fDirLocalL.set(-0.14, 0.08, 0.98).normalize();
            fDirLocalR.set( 0.14, 0.08, 0.98).normalize();
            gripModeL = gripModeR = "cradle";
            curlL = 0.36; curlR = 0.36;
            spreadL = 0.28; spreadR = 0.28;
            state.lookPitch = -0.24;
            if (recvK < 0.48) {
              autoEmotion = "surprised_awe";
              autoEmotionIntensity = 0.88;
              autoViseme = "OH";
              autoVisemeAmount = 0.56;
            } else {
              autoEmotion = "happy_joy";
              autoEmotionIntensity = 0.94;
            }
          } else {
            // Elder / Carrier bearing 20 kg: couple squat depth, forward reach & lower-arm shoulder drop to live worldGripL/R so BOTH hands lock at 0.000m!
            pumpCharFwd.set(0, 0, 1).applyQuaternion(grpWorldQuat);
            const midX = (opts.worldGripL.x + opts.worldGripR.x) * 0.5;
            const midZ = (opts.worldGripL.z + opts.worldGripR.z) * 0.5;
            const elderFwdDist = ((midX - state.x) * pumpCharFwd.x + (midZ - state.z) * pumpCharFwd.z) / scale;
            const minGripY = (Math.min(opts.worldGripL.y, opts.worldGripR.y) - state.y) / scale;
            const lowNeed = clamp((0.88 - minGripY) * 1.15, 0, 0.22);
            const fwdStep = clamp(elderFwdDist - 0.30, -0.08, 0.18);

            if (walkK <= 0.02) {
              fLx = hipX + 0.055; fLz = 0.15 + fwdStep * 0.75;
              fRx = -hipX - 0.055; fRz = -0.13 + fwdStep * 0.75;
            }
            pelDrop = -0.095 - lowNeed * 0.72 - 0.065 * heaveK - 0.07 * pourK - 0.02 * walkK;
            pelFwdZ = fwdStep - 0.025 * (heaveK + pourK);
            spinePitch = 0.22 + lowNeed * 0.78 + 0.08 * heaveK + 0.16 * pourK;
            chestPitch = 0.08 + lowNeed * 0.38;

            const lHigher = opts.worldGripL.y >= opts.worldGripR.y - 0.02;
            const asym = clamp(Math.abs(opts.worldGripL.y - opts.worldGripR.y) / scale, 0, 0.42);
            // Tilt torso & drop clavicle toward the lower bottom-cradling hand so it easily reaches y ~ 0.64..0.72m!
            spineRoll = (lHigher ? 1 : -1) * (0.04 + asym * 0.22);
            clavLiftL = lHigher ? (0.06 * (0.4 + 0.6 * heaveK)) : (-0.12 * asym * 2.2);
            clavLiftR = lHigher ? (-0.12 * asym * 2.2) : (0.06 * (0.4 + 0.6 * heaveK));
            clavFwdL  = lHigher ? 0.06 : 0.14;
            clavFwdR  = lHigher ? 0.14 : 0.06;

            if (lHigher) {
              palmLocalL.set(-0.24, -0.94, -0.22).normalize(); fDirLocalL.set(-0.16, -0.18, 0.97).normalize(); gripModeL = "handleTop"; curlL = 0.94;
              palmLocalR.set( 0.36,  0.88,  0.28).normalize(); fDirLocalR.set( 0.16,  0.08, 0.98).normalize(); gripModeR = "cradle";    curlR = 0.44;
            } else {
              palmLocalL.set(-0.36,  0.88,  0.28).normalize(); fDirLocalL.set(-0.16,  0.08, 0.98).normalize(); gripModeL = "cradle";    curlL = 0.44;
              palmLocalR.set( 0.24, -0.94, -0.22).normalize(); fDirLocalR.set( 0.16, -0.18, 0.97).normalize(); gripModeR = "handleTop"; curlR = 0.94;
            }
            state.lookPitch = opts.lookAt ? state.lookPitch : lerp(0.22, 0.36, pourK);

            if (opts._sharedUnload) {
              if (heaveK > 0.35) {
                autoEmotion = "effort_strain_20kg";
                autoEmotionIntensity = 0.96;
              } else if (walkK > 0.25) {
                autoEmotion = "speaking_animated";
                autoSpeaking = role === "lead" ? "compound_carry_lead" : "compound_carry_steady";
                autoEmotionIntensity = 0.85;
              } else if (pourK > 0.25) {
                autoEmotion = u > 0.80 ? "relief_sigh" : "determined_focus";
                autoEmotionIntensity = 0.86;
              } else {
                autoEmotion = "happy_joy";
                autoEmotionIntensity = 0.78;
              }
            } else {
              // Study 2 (01:53 Father/Elder & Child Handoff): effort_strain_20kg on brace -> warm open-mouth encouraging remark + smile to June!
              if (heaveK > 0.42) {
                autoEmotion = "effort_strain_20kg";
                autoEmotionIntensity = 0.95;
              } else {
                autoEmotion = "happy_joy";
                autoEmotionIntensity = 0.90;
                autoSpeaking = "elder_encourage_june";
              }
            }
          }

          useWorldHandL = true;
          useWorldHandR = true;
          handTargetL.copy(opts.worldGripL);
          handTargetR.copy(opts.worldGripR);
          if (opts.gripModeL) {
            gripModeL = opts.gripModeL === "handleTop" ? "handleTop" : (pose === "childReceive20kg" ? "cradle" : "underRib");
            if (gripModeL === "underRib" && pose !== "childReceive20kg") curlL = 0.46;
          }
          if (opts.gripModeR) {
            gripModeR = opts.gripModeR === "handleTop" ? "handleTop" : (pose === "childReceive20kg" ? "cradle" : "underRib");
            if (gripModeR === "underRib" && pose !== "childReceive20kg") curlR = 0.46;
          }
          toolLockL = gripModeL;
          toolLockR = gripModeR;
          pocketPullL = gripModeL === "handleTop" ? 0.032 : 0.038;
          pocketPullR = gripModeR === "handleTop" ? 0.032 : 0.038;
          if (opts.gripNormalL) {
            useWorldFrameL = true;
            palmWorldL.copy(opts.gripNormalL).normalize();
            fDirWorldL.copy(fDirLocalL).applyQuaternion(grpWorldQuat);
            fDirWorldL.addScaledVector(palmWorldL, -fDirWorldL.dot(palmWorldL)).normalize();
          }
          if (opts.gripNormalR) {
            useWorldFrameR = true;
            palmWorldR.copy(opts.gripNormalR).normalize();
            fDirWorldR.copy(fDirLocalR).applyQuaternion(grpWorldQuat);
            fDirWorldR.addScaledVector(palmWorldR, -fDirWorldR.dot(palmWorldR)).normalize();
          }
          twoHandCanProp.visible = Boolean(opts.showSoloCan);
          cyanGlowUniform.value.set(0, 0.95, 0.34, 0.58);
        } else if (pose === "childReceive20kg") {
          const reach = 0.5 + 0.5 * Math.sin(t * 1.05);
          pelDrop = -0.04;
          spinePitch = 0.03;
          localTargetL.set( 0.088, 1.08 + 0.05 * reach, 0.33);
          localTargetR.set(-0.088, 1.08 + 0.05 * reach, 0.33);
          palmLocalL.set(-0.34, 0.90, 0.24).normalize();
          palmLocalR.set( 0.34, 0.90, 0.24).normalize();
          fDirLocalL.set(-0.14, 0.08, 0.98).normalize();
          fDirLocalR.set( 0.14, 0.08, 0.98).normalize();
          gripModeL = gripModeR = "cradle";
          toolLockL = toolLockR = "cradle";
          curlL = 0.36; curlR = 0.36;
          state.lookPitch = -0.22;
          autoEmotion = reach < 0.5 ? "surprised_awe" : "happy_joy";
          autoEmotionIntensity = 0.88;
        } else if (pose === "pourBowl" || pose === "basinPour20kg") {
          // Two-Handed 20 L Jerrycan Progressive Tilt (26° -> 67°) + Parabolic Gravity Stream & Concentric Splash!
          const isMacroHandStage = state.id === "imani_hands" || state.id === "imani_gestures";
          const tip = opts.pourAmount !== undefined
            ? opts.pourAmount
            : (0.50 - 0.50 * Math.cos(nowSec * 1.15 + state.phase * 0.15));

          if (isMacroHandStage) {
            pelDrop = -0.08;
            pelFwdZ = -0.04;
            spinePitch = 0.22;
            twoHandCanProp.visible = true;
            twoHandCanProp.position.set(-0.015, 0.83, 0.38);
            twoHandCanProp.rotation.set(0.66 + 0.22 * tip, 0.08, 0);
          } else {
            // Deep 20 kg athletic stance, hip-hinge counterbalance & progressive 26° -> 67° basin pour!
            pelDrop = -0.115 - 0.055 * tip;
            pelFwdZ = -0.075 - 0.020 * tip;
            spinePitch = 0.26 + 0.12 * tip;
            spineRoll = -0.055;
            clavLiftL = 0.08; clavLiftR = 0.05;
            fLx = hipX + 0.052; fLz = 0.16;
            fRx = -hipX - 0.052; fRz = -0.15;

            twoHandCanProp.visible = true;
            twoHandCanProp.position.set(-0.012, lerp(0.84, 0.78, tip), lerp(0.36, 0.40, tip));
            twoHandCanProp.rotation.set(lerp(0.46, 1.16, tip), 0.03, 0);
            if (soloCanBundle.innerLiq) {
              soloCanBundle.innerLiq.scale.y = lerp(0.98, 0.62, tip);
            }
          }

          twoHandCanProp.updateMatrixWorld(true);
          soloCanBundle.gripLeadL.getWorldPosition(handTargetL);
          soloCanBundle.gripLeadR.getWorldPosition(handTargetR);
          useWorldHandL = true;
          useWorldHandR = true;
          pocketPullL = 0.030;
          pocketPullR = 0.038;

          // Track exact tilted jerrycan top-handle & bottom-bevel world orientations at every pour angle!
          useWorldFrameL = true;
          useWorldFrameR = true;
          twoHandCanProp.getWorldQuaternion(ik.qUpper);
          palmWorldL.set(-0.18, -0.98, 0).normalize().applyQuaternion(ik.qUpper);
          fDirWorldL.set(-0.22, 0, 0.97).normalize().applyQuaternion(ik.qUpper);
          fDirWorldL.addScaledVector(palmWorldL, -fDirWorldL.dot(palmWorldL)).normalize();
          gripModeL = "handleTop"; curlL = 0.94;

          palmWorldR.set(0.42, 0.86, -0.28).normalize().applyQuaternion(ik.qUpper);
          fDirWorldR.set(0.18, 0.14, 0.97).normalize().applyQuaternion(grpWorldQuat);
          fDirWorldR.addScaledVector(palmWorldR, -fDirWorldR.dot(palmWorldR)).normalize();
          gripModeR = "cradle"; curlR = 0.46;
          toolLockL = "handleTop";
          toolLockR = "cradle";

          if (!isMacroHandStage && soloCanBundle.stepBallisticPour) {
            let aimXZ = { x: 0.00, z: 0.68 };
            let waterY = 0.275;
            if (opts.pourTarget) {
              pourLocalTmp.copy(opts.pourTarget);
              group.worldToLocal(pourLocalTmp);
              aimXZ = { x: pourLocalTmp.x, z: pourLocalTmp.z };
              waterY = Math.max(0.18, pourLocalTmp.y + 0.055);
            }
            const pourFlow = smooth(0.14, 0.42, tip);
            soloCanBundle.stepBallisticPour(nowSec, pourFlow, group, waterY, aimXZ);
          } else if (soloCanBundle.stepBallisticPour) {
            soloCanBundle.stepBallisticPour(nowSec, 0, group);
          }

          cyanGlowUniform.value.set(-0.02, 0.82, 0.40, 0.64);
          state.lookPitch = 0.36;
          autoEmotion = isMacroHandStage ? "determined_focus" : (tip < 0.72 ? "effort_strain_20kg" : "relief_sigh");
          autoEmotionIntensity = 0.90;
        } else {
          // Standalone unloadHandoff / heaveSaddle20kg with authoritative solo jerrycan grips
          const u = opts.unloadPhase !== undefined ? frac(opts.unloadPhase) : frac(nowSec * 0.12 + state.phase * 0.1);
          const untie = 1 - smooth(0.22, 0.32, u);
          const lift = smooth(0.25, 0.55, u) * (1 - smooth(0.75, 0.96, u));
          if (untie > 0.5 && pose === "unloadHandoff") {
            const pull = Math.sin(t * 3.4);
            pelDrop = -0.04;
            spinePitch = 0.14 + 0.03 * pull;
            localTargetL.set( 0.10 - 0.03 * pull, 1.12 + 0.02 * pull, 0.33);
            localTargetR.set(-0.09 + 0.03 * pull, 1.09 - 0.02 * pull, 0.35);
            palmLocalL.set(-0.62, -0.68, -0.38);
            palmLocalR.set( 0.62, -0.68, -0.38);
            curlL = 0.84; curlR = 0.84;
            toolLockL = toolLockR = "sideWrap";
            ropeProp.visible = true;
            ropeProp.position.set(0, 1.08, 0.34);
            state.lookPitch = 0.22;
            autoEmotion = "determined_focus";
            autoEmotionIntensity = 0.82;
          } else {
            const hK = pose === "heaveSaddle20kg" ? (0.5 + 0.5 * Math.sin(t * 1.05)) : (1 - lift);
            pelDrop = lerp(-0.16, -0.06, hK);
            pelFwdZ = lerp(-0.075, -0.045, hK);
            spinePitch = lerp(0.24, 0.10, hK);
            spineRoll = opts.unloadRole === "partner" ? 0.06 : -0.065;
            clavLiftL = 0.10; clavLiftR = 0.06;
            fLx = hipX + 0.055; fLz = 0.15;
            fRx = -hipX - 0.055; fRz = -0.14;
            const cy = lerp(0.84, 1.06, hK);
            if (opts.unloadRole !== "partner") {
              twoHandCanProp.visible = true;
              twoHandCanProp.position.set(-0.02, cy, 0.38);
              twoHandCanProp.rotation.set(-0.08, 0.16, -0.05);
              if (soloCanBundle.stepBallisticPour) soloCanBundle.stepBallisticPour(nowSec, 0, group);
              twoHandCanProp.updateMatrixWorld(true);
              soloCanBundle.gripLeadL.getWorldPosition(handTargetL);
              soloCanBundle.gripLeadR.getWorldPosition(handTargetR);
              useWorldHandL = true;
              useWorldHandR = true;
              pocketPullL = 0.030;
              pocketPullR = 0.038;
              useWorldFrameL = true;
              useWorldFrameR = true;
              twoHandCanProp.getWorldQuaternion(ik.qUpper);
              palmWorldL.set(-0.18, -0.98, 0).normalize().applyQuaternion(ik.qUpper);
              fDirWorldL.set(-0.22, 0, 0.97).normalize().applyQuaternion(ik.qUpper);
              fDirWorldL.addScaledVector(palmWorldL, -fDirWorldL.dot(palmWorldL)).normalize();
              palmWorldR.set(0.42, 0.88, -0.22).normalize().applyQuaternion(ik.qUpper);
              fDirWorldR.set(0.18, 0.10, 0.97).normalize().applyQuaternion(grpWorldQuat);
              fDirWorldR.addScaledVector(palmWorldR, -fDirWorldR.dot(palmWorldR)).normalize();
            } else {
              localTargetL.set( 0.08, cy + 0.12, 0.34);
              localTargetR.set(-0.10, cy - 0.08, 0.34);
              palmLocalL.set(-0.32, -0.90, -0.28); fDirLocalL.set(-0.16, -0.22, 0.96);
              palmLocalR.set( 0.38,  0.88,  0.26); fDirLocalR.set( 0.18,  0.10, 0.97);
            }
            gripModeL = "handleTop"; curlL = 0.94;
            gripModeR = "cradle";    curlR = 0.44;
            toolLockL = "handleTop";
            toolLockR = "cradle";
            cyanGlowUniform.value.set(-0.02, cy, 0.38, 0.56);
            state.lookPitch = lerp(0.26, 0.10, hK);
            autoEmotion = hK < 0.65 ? "effort_strain_20kg" : "relief_sigh";
            autoEmotionIntensity = 0.92;
          }
        }
      } else if (pose === "tieRope") {
        const pull = Math.sin(t * 2.2);
        pelDrop = -0.04;
        spinePitch = 0.14 + 0.04 * pull;
        localTargetL.set( 0.11 - 0.03 * pull, 1.08 + 0.02 * pull, 0.32);
        localTargetR.set(-0.10 + 0.03 * pull, 1.05 - 0.03 * pull, 0.34);
        palmLocalL.set(-0.62, -0.68, -0.38);
        palmLocalR.set( 0.62, -0.68, -0.38);
        fDirLocalL.set(-0.22, -0.10, 0.97);
        fDirLocalR.set( 0.22, -0.10, 0.97);
        curlL = 0.84; curlR = 0.84;
        toolLockL = toolLockR = "sideWrap";
        ropeProp.visible = true;
        ropeProp.position.set(0, 1.05, 0.33);
        state.lookPitch = 0.28;
        autoEmotion = Math.abs(pull) > 0.65 ? "effort_strain_20kg" : "determined_focus";
        autoEmotionIntensity = 0.78;
      } else if (pose === "pointPost") {
        allowBodyAssist = false;
        pelSwayX = 0.015;
        chestYaw = -0.18;
        localTargetR.set(-0.18, 1.32 + 0.025 * Math.sin(t * 1.4), 0.42);
        localTargetL.set( shX + 0.035, 0.88, 0.06);
        palmLocalR.set(0.35, -0.90, 0.25);
        fDirLocalR.set(-0.15, 0.12, 0.98);
        gripModeR = "flat"; curlR = 0.18; curlL = 0.45;
        const callOut = frac((nowSec + state.phase * 0.2) / 6.8) < 0.58;
        autoEmotion = callOut ? "speaking_animated" : "determined_focus";
        autoSpeaking = callOut ? "ford_gauge_callout" : false;
        autoEmotionIntensity = 0.86;
        autoHandR = "pointing_call";
        autoHandL = "relaxed_breathing";
      } else if (pose === "queueWait") {
        allowBodyAssist = false;
        const shift = Math.sin(t * 0.65);
        pelSwayX = 0.024 * shift;
        pelDrop = -0.012 * Math.abs(shift);
        spineRoll = -0.03 * shift;
        const chatTurn = frac((nowSec + state.phase * 0.33) / 9.4) < 0.36;
        if (spec.queueHasCup) {
          cupProp.visible = true;
          cupProp.position.set(0, 1.03, 0.24);
          cupProp.rotation.set(0, 0, 0);
          localTargetL.set( 0.060, 1.016, 0.196);
          localTargetR.set(-0.060, 1.016, 0.196);
          palmLocalL.set(-0.94, 0.18, -0.28);
          palmLocalR.set( 0.94, 0.18, -0.28);
          fDirLocalL.set(-0.22, 0.12, 0.96);
          fDirLocalR.set( 0.22, 0.12, 0.96);
          toolLockL = toolLockR = "sideWrap";
          curlL = 0.76; curlR = 0.76;
        } else if (opts.carryCan || spec.queueHasCan) {
          carryCanProp.visible = true;
          localTargetR.set(-shX - 0.058, 0.85, 0.045);
          localTargetL.set( 0.065, 1.04, 0.19);
          palmLocalR.set( 0.96, -0.05, 0.25);
          palmLocalL.set(-0.68,  0.30, -0.66);
          toolLockR = "jerrycan_handle";
          curlR = 0.88; curlL = 0.50;
          autoHandL = chatTurn ? "talking_gesticulate" : "relaxed_breathing";
        } else {
          localTargetL.set( 0.055, 1.04 + 0.008 * breath, 0.20);
          localTargetR.set(-0.055, 1.03 + 0.008 * breath, 0.21);
          palmLocalL.set(-0.72, 0.28, -0.62);
          palmLocalR.set( 0.72, 0.28, -0.62);
          curlL = 0.52; curlR = 0.52;
          autoHandL = chatTurn ? "talking_gesticulate" : "relaxed_breathing";
          autoHandR = chatTurn ? "talking_gesticulate" : "relaxed_breathing";
        }
        autoEmotion = chatTurn ? "speaking_animated" : "happy_joy";
        autoSpeaking = chatTurn ? "queue_neighbor_chat" : false;
        autoEmotionIntensity = chatTurn ? 0.78 : 0.62;
      } else if (pose === "eskista" || pose === "dance") {
        // Jitter-Free 104 BPM 6/8 Ethiopian Eskista Shoulder-Isolation Groove + Joyous Celebration!
        allowBodyAssist = false;
        // Strict monotonic 104 BPM 6/8 bar phase (1 bar = 1.15385s = two dotted-quarter beats, six eighth subdivisions!)
        const barSec = 1.153846;
        const uBar = frac((nowSec + state.phase * 0.19) / barSec);
        const radBar = uBar * TAU;
        const grooveAmp = 0.86 + 0.18 * clamp(beat, 0, 1);

        // Smooth C^2 3-pulse shoulder isolation per bar + 2-beat grounded knee bounce (ZERO unbounded phase velocity & ZERO pow cusp!)
        const s3 = Math.sin(radBar * 3.0);
        const pop = s3 * (0.68 + 0.32 * s3 * s3) * grooveAmp;
        const bounce2 = 0.5 - 0.5 * Math.cos(radBar * 2.0);
        const sway1 = Math.sin(radBar);

        pelDrop = -0.032 - 0.036 * bounce2 * grooveAmp;
        pelSwayX = 0.026 * sway1;
        spinePitch = 0.085 + 0.036 * bounce2;
        spineRoll = -0.028 * sway1;
        chestPitch = -0.062 * pop;
        chestYaw = 0.088 * Math.sin(radBar * 2.0);

        // Crisp alternating & bilateral clavicle/scapula protraction-retraction pops!
        const altMode = Math.sin(radBar * 0.5 + state.phase) > -0.25;
        clavLiftL = 0.15 * Math.max(0, pop) + 0.03 * bounce2;
        clavLiftR = 0.15 * Math.max(0, altMode ? -pop : pop) + 0.03 * bounce2;
        clavFwdL  =  0.22 * pop;
        clavFwdR  = (altMode ? -0.22 : 0.22) * pop;

        fLz =  0.065 * sway1;
        fRz = -0.065 * sway1;
        footPitchL = Math.max(0,  sway1) * 0.14;
        footPitchR = Math.max(0, -sway1) * 0.14;

        // Expressive bent-elbow highland dance frame + wrist flourishes
        const wristWave = Math.sin(radBar * 2.0 + 0.6);
        localTargetL.set( shX + 0.072, 1.09 + 0.036 * pop, 0.23 - 0.045 * pop);
        localTargetR.set(-shX - 0.072, 1.09 - 0.036 * (altMode ? pop : -pop), 0.23 + 0.045 * (altMode ? pop : -pop));
        palmLocalL.set(-0.42, -0.74 + 0.22 * wristWave, 0.46).normalize();
        palmLocalR.set( 0.42, -0.74 - 0.22 * wristWave, 0.46).normalize();
        fDirLocalL.set(-0.20, 0.18, 0.96).normalize();
        fDirLocalR.set( 0.20, 0.18, 0.96).normalize();
        gripModeL = gripModeR = "flat";
        curlL = 0.16; curlR = 0.16;
        spreadL = 0.36; spreadR = 0.36;
        jawOpen = 0.12 + 0.08 * bounce2;

        // Suppress random saccade head-fighting & drive authentic Ethiopian 6/8 Eskista horizontal cervical glide + lateral lean phrasing!
        state.lookPitch = lerp(state.lookPitch, -0.03 + 0.04 * bounce2, 0.45);
        state.lookYaw = lerp(state.lookYaw, 0.08 * sway1, 0.45);
        sceneGlideX = 0.021 * Math.sin(radBar * 2.0 + 0.35) * grooveAmp;
        sceneLeanRoll = (0.145 * sway1 + 0.052 * Math.sin(radBar * 3.0 - 0.5)) * grooveAmp;
        sceneLeanPitch = -0.038 + 0.032 * bounce2;

        // Cycle joyous celebration: laughing_open -> rhythmic ululation/singing (speaking_animated) -> happy_joy + splayed/waving hands!
        const celSlot = Math.floor(frac((nowSec + state.phase * 0.31) / 9.6) * 3);
        if (celSlot === 0) {
          autoEmotion = "laughing_open";
          autoEmotionIntensity = 0.96;
          autoHandL = "spread_splay_awe";
          autoHandR = "joyful_wave";
        } else if (celSlot === 1) {
          autoEmotion = "speaking_animated";
          autoEmotionIntensity = 0.94;
          autoSpeaking = "eskista_ululation_6_8";
          autoHandL = "talking_gesticulate";
          autoHandR = "talking_gesticulate";
        } else {
          autoEmotion = "happy_joy";
          autoEmotionIntensity = 0.95;
          autoHandL = "spread_splay_awe";
          autoHandR = "spread_splay_awe";
        }
      } else if (pose === "camera" || pose === "pour") {
        pelDrop = -0.04;
        spinePitch = 0.16;
        chestPitch = 0.06;
        fLz = 0.08; fRz = -0.08;
        localTargetL.set( 0.12, 1.18 + 0.02 * Math.sin(t * 1.6), 0.34);
        localTargetR.set(-0.11, 1.22 + 0.03 * Math.cos(t * 1.6), 0.36);
        palmLocalL.set(-0.86, 0.25, 0.44);
        palmLocalR.set( 0.86, 0.25, 0.44);
        toolLockL = toolLockR = "sideWrap";
        curlL = 0.55; curlR = 0.65;
        state.lookPitch = 0.08;
        autoEmotion = "determined_focus";
        autoEmotionIntensity = 0.80;
      } else if (pose === "drive") {
        allowBodyAssist = false;
        pelDrop = -0.34;
        pelFwdZ = -0.04;
        fLx =  hipX + 0.02; fLy = 0.12; fLz = 0.34;
        fRx = -hipX - 0.02; fRy = 0.12; fRz = 0.36;
        spinePitch = 0.10;
        const steer = opts.steerAngle || 0;
        localTargetL.set( 0.14, 1.02 + steer * 0.06, 0.34);
        localTargetR.set(-0.14, 1.02 - steer * 0.06, 0.34);
        palmLocalL.set(-0.55, -0.58, -0.60);
        palmLocalR.set( 0.55, -0.58, -0.60);
        toolLockL = toolLockR = "sideWrap";
        curlL = 0.85; curlR = 0.85;
        autoEmotion = Math.abs(steer) > 0.2 ? "determined_focus" : "happy_joy";
        autoEmotionIntensity = 0.74;
      } else if (pose === "tableauCustom") {
        allowBodyAssist = false;
        const wShift = Math.sin(t * 0.52);
        pelSwayX = opts.pelSwayX !== undefined ? opts.pelSwayX : (0.008 * wShift);
        pelDrop  = opts.pelDrop  !== undefined ? opts.pelDrop  : (-0.005 * Math.abs(wShift));
        pelFwdZ  = opts.pelFwdZ  !== undefined ? opts.pelFwdZ  : 0;
        if (opts.spinePitch !== undefined) spinePitch = opts.spinePitch + 0.010 * breath;
        if (opts.spineYaw   !== undefined) spineYaw   = opts.spineYaw;
        if (opts.spineRoll  !== undefined) spineRoll  = opts.spineRoll;
        if (opts.chestPitch !== undefined) chestPitch = opts.chestPitch + 0.012 * breath;
        if (opts.chestYaw   !== undefined) chestYaw   = opts.chestYaw;
        if (Array.isArray(opts.localFootL)) { fLx = opts.localFootL[0]; fLy = opts.localFootL[1]; fLz = opts.localFootL[2]; }
        if (Array.isArray(opts.localFootR)) { fRx = opts.localFootR[0]; fRy = opts.localFootR[1]; fRz = opts.localFootR[2]; }
        if (opts.footPitchL !== undefined) footPitchL = opts.footPitchL;
        if (opts.footPitchR !== undefined) footPitchR = opts.footPitchR;
        if (Array.isArray(opts.localHandL)) localTargetL.set(opts.localHandL[0], opts.localHandL[1], opts.localHandL[2]);
        if (Array.isArray(opts.localHandR)) localTargetR.set(opts.localHandR[0], opts.localHandR[1], opts.localHandR[2]);
        if (Array.isArray(opts.palmLocalL)) palmLocalL.set(opts.palmLocalL[0], opts.palmLocalL[1], opts.palmLocalL[2]).normalize();
        if (Array.isArray(opts.palmLocalR)) palmLocalR.set(opts.palmLocalR[0], opts.palmLocalR[1], opts.palmLocalR[2]).normalize();
        if (Array.isArray(opts.fDirLocalL)) fDirLocalL.set(opts.fDirLocalL[0], opts.fDirLocalL[1], opts.fDirLocalL[2]).normalize();
        if (Array.isArray(opts.fDirLocalR)) fDirLocalR.set(opts.fDirLocalR[0], opts.fDirLocalR[1], opts.fDirLocalR[2]).normalize();
        if (opts.worldHandL) {
          useWorldHandL = true;
          handTargetL.copy(opts.worldHandL);
          toolLockL = opts.gripModeL || "sideWrap";
        }
        if (opts.worldHandR) {
          useWorldHandR = true;
          handTargetR.copy(opts.worldHandR);
          toolLockR = opts.gripModeR || "sideWrap";
        }
        if (opts.palmWorldL) {
          useWorldFrameL = true;
          palmWorldL.copy(opts.palmWorldL).normalize();
          if (opts.fDirWorldL) fDirWorldL.copy(opts.fDirWorldL).normalize();
          else fDirWorldL.set(0, 0, 0);
        }
        if (opts.palmWorldR) {
          useWorldFrameR = true;
          palmWorldR.copy(opts.palmWorldR).normalize();
          if (opts.fDirWorldR) fDirWorldR.copy(opts.fDirWorldR).normalize();
          else fDirWorldR.set(0, 0, 0);
        }
        if (opts.gripModeL) gripModeL = opts.gripModeL;
        if (opts.gripModeR) gripModeR = opts.gripModeR;
        if (opts.curlL !== undefined) curlL = opts.curlL;
        if (opts.curlR !== undefined) curlR = opts.curlR;
        if (opts.pocketPullL !== undefined) pocketPullL = opts.pocketPullL;
        if (opts.pocketPullR !== undefined) pocketPullR = opts.pocketPullR;
      } else {
        const wShift = Math.sin(t * 0.58);
        pelSwayX = 0.016 * wShift;
        pelDrop = -0.008 * Math.abs(wShift);
        spineRoll = -0.022 * wShift;
        if (opts.carryCan) {
          localTargetR.set(-shX - 0.062, 0.855, 0.045);
          palmLocalR.set(0.96, -0.05, 0.25);
          toolLockR = "jerrycan_handle";
          curlR = 0.88;
          spineRoll += 0.04;
        }
        autoEmotion = "neutral";
        autoEmotionIntensity = 0.45;
      }

      state.autoEmotion = autoEmotion;
      state.autoEmotionIntensity = autoEmotionIntensity;
      state.autoSpeaking = autoSpeaking;
      state.autoViseme = autoViseme;
      state.autoVisemeAmount = autoVisemeAmount;
      state.autoHandL = autoHandL;
      state.autoHandR = autoHandR;
      group.userData.activeGripModeL = toolLockL;
      group.userData.activeGripModeR = toolLockR;
      opts._activeGripModeL = toolLockL;
      opts._activeGripModeR = toolLockR;
      // Never allow expressive arm/hand gestures to pry hands off an active physical prop grip!
      if (toolLockL || toolLockR) {
        opts.forceHandGesture = false;
        opts.armGesture = null;
        if (toolLockL) opts.handGestureL = null;
        if (toolLockR) opts.handGestureR = null;
      }

      // Inject scene acting into opts when caller has not explicitly pinned/passed overrides
      if (opts.emotion === undefined && !state._userPinnedEmotion) {
        opts.emotion = autoEmotion;
        if (opts.emotionIntensity === undefined) opts.emotionIntensity = autoEmotionIntensity;
      }
      if (opts.speaking === undefined && !state._userPinnedSpeech) {
        opts.speaking = autoSpeaking;
      }
      if (opts.viseme === undefined && !state._userPinnedViseme && autoViseme) {
        opts.viseme = autoViseme;
        opts.visemeAmount = autoVisemeAmount;
      }
      if (opts.handGestureL === undefined && !state._userPinnedHandL && !toolLockL) {
        opts.handGestureL = autoHandL;
      }
      if (opts.handGestureR === undefined && !state._userPinnedHandR && !toolLockR) {
        opts.handGestureR = autoHandR;
      }

      // Gaze-coupled ScionEyeGlobe + ScionEyelids (with fallback to legacy wet eyelids when Scion modules are absent)
      const shut = Math.sin(state.blink * Math.PI);
      const gazeDown = clamp(state.lookPitch * 0.72 - F.eyeY * 0.16, -0.12, 0.42);
      const eyeYaw   = clamp((wantYaw - state.lookYaw) * 0.40 + state.lookYaw * 0.05 + F.eyeX * 0.12, -0.13, 0.13);
      const eyePitch = clamp(state.lookPitch * 0.18 - F.eyeY * 0.14, -0.16, 0.22);
      const scionEyes = (headAnchor && headAnchor.userData && headAnchor.userData.scionEyes) || (lids && lids.scionEyes) || null;
      const scionLids = (headAnchor && headAnchor.userData && headAnchor.userData.scionLids) || (lids && lids.scionLids) || null;
      if (scionEyes || scionLids) {
        const gazeUpRad = -eyePitch; // Scion convention: +pitchRad = look UP (+Y), -pitchRad = look DOWN (-Y)
        const activeEmo = opts.emotion || state.autoEmotion || "neutral";
        const activeEmoInt = clamp(opts.emotionIntensity !== undefined ? opts.emotionIntensity : (state.autoEmotionIntensity || 0.8), 0, 1.25);
        const moodSquint = clamp(
          Math.max(0, F.lid * 0.75) +
          (activeEmo === "laughing_open" ? 0.56 : activeEmo === "happy_joy" ? 0.34 : activeEmo === "effort_strain_20kg" ? 0.42 : 0) * activeEmoInt,
          0, 1
        );
        const moodWide = clamp((activeEmo === "surprised_awe" ? 0.48 : 0) * activeEmoInt + Math.max(0, -F.lid * 0.45), 0, 1);
        const baseOpen = clamp((1.0 - F.lid * 0.14 + moodWide * 0.24 - (activeEmo === "sad_grief" ? 0.18 * activeEmoInt : 0)) * (1.0 - shut), 0, 1.32);

        if (scionEyes) {
          if (typeof scionEyes.setGaze === "function") scionEyes.setGaze(eyeYaw, gazeUpRad);
          if (typeof scionEyes.setLidShadow === "function") scionEyes.setLidShadow(baseOpen, baseOpen, moodSquint);
        }
        if (scionLids) {
          if (typeof scionLids.setGaze === "function") scionLids.setGaze(eyeYaw, gazeUpRad);
          if (typeof scionLids.setBlink === "function") scionLids.setBlink(shut);
          if (!charObj || !charObj._v4ExpCtrl) {
            if (typeof scionLids.setState === "function") {
              scionLids.setState({
                openL: baseOpen,
                openR: baseOpen,
                squintL: moodSquint,
                squintR: moodSquint,
                wideEyes: moodWide,
                gazeX: eyeYaw,
                gazeY: gazeUpRad
              });
            }
          }
        }
      }
      for (const L of lids) {
        if (V3) {
          L.uLid.rotation.x = clamp(-0.21 + gazeDown * 0.48 + F.lid * 0.22 + shut * 0.46, -0.28, 0.26);
          L.lLid.rotation.x = clamp( 0.24 + gazeDown * 0.12 - F.lid * 0.08 - shut * 0.16, 0.06, 0.32);
        } else {
          L.uLid.rotation.x = clamp(-0.05 + gazeDown + F.lid * 0.36 + shut * 0.76, -0.20, 0.68);
          L.lLid.rotation.x = clamp( 0.18 + gazeDown * 0.28 - F.lid * 0.15 - shut * 0.24, -0.18, 0.36);
        }
        L.eye.rotation.y = -Math.PI * 0.5 + eyeYaw;
        L.eye.rotation.z = -eyePitch;
      }

      // HLIDARENDI bodySolveAssist: hierarchical scapula -> chest -> spine -> pelvis reach cascade
      if (allowBodyAssist) {
        if (useWorldHandL) {
          ik.segPt.copy(handTargetL);
          group.worldToLocal(ik.segPt);
        } else {
          ik.segPt.copy(localTargetL);
        }
        if (useWorldHandR) {
          ik.cpVec.copy(handTargetR);
          group.worldToLocal(ik.cpVec);
        } else {
          ik.cpVec.copy(localTargetR);
        }
        const avgFront = Math.max(ik.segPt.z, ik.cpVec.z, (ik.segPt.z + ik.cpVec.z) * 0.5);
        const frontNeed = clamp((avgFront - 0.31) * 0.38, 0, 0.15);
        const lowNeed = clamp((0.88 - Math.min(ik.segPt.y, ik.cpVec.y)) * 0.24, 0, 0.12);
        const reachTwist = clamp((ik.cpVec.z - ik.segPt.z) * 0.22, -0.16, 0.16);
        pelFwdZ    += frontNeed * 0.12;
        pelDrop    -= lowNeed * 0.18;
        spinePitch += frontNeed * 0.28 + lowNeed * 0.22;
        chestPitch += frontNeed * 0.24 + lowNeed * 0.18;
        chestYaw   += reachTwist * 0.55;
        clavFwdL   += clamp((ik.segPt.z - 0.26) * 0.32, 0, 0.14);
        clavFwdR   += clamp((ik.cpVec.z - 0.26) * 0.32, 0, 0.14);
      }

      // Apply 4-segment S-Curve Spine (Pelvis -> Lumbar -> Thorax -> Chest), Clavicles, 3-Joint Supple Cervical Arc, Jaw & Hair Tail!
      bones[B_PELVIS].position.set(
        bind[B_PELVIS][0] + pelSwayX,
        bind[B_PELVIS][1] + pelDrop,
        bind[B_PELVIS][2] + pelFwdZ
      );
      bones[B_PELVIS].rotation.set(spinePitch * 0.22, spineYaw * 0.35, -spineRoll * 0.45);
      bones[B_LUMBAR].rotation.set(spinePitch * 0.32, spineYaw * 0.32, spineRoll * 0.48);
      bones[B_THORAX].rotation.set(spinePitch * 0.28 + chestPitch * 0.35, spineYaw * 0.33 + chestYaw * 0.35, spineRoll * 0.35);
      bones[B_CHEST].rotation.set(chestPitch * 0.65 + spinePitch * 0.20, chestYaw * 0.65, spineRoll * 0.22);
      bones[B_CHEST].scale.set(1 + 0.012 * breath, 1, 1 + 0.016 * breath);

      bones[B_CLAV_L].rotation.set(0, -clavFwdL,  clavLiftL + F.clav);
      bones[B_CLAV_R].rotation.set(0,  clavFwdR, -clavLiftR - F.clav);

      // Save pre-cervical base upper-torso quaternions so standalone `ch.setEmotion()` / `ch.setNeckLean()` can re-solve cleanly!
      state._preCervicalQuats.thorax.copy(bones[B_THORAX].quaternion);
      state._preCervicalQuats.chest.copy(bones[B_CHEST].quaternion);
      state._preCervicalQuats.clavL.copy(bones[B_CLAV_L].quaternion);
      state._preCervicalQuats.clavR.copy(bones[B_CLAV_R].quaternion);

      const baseCervPitch = state.lookPitch - spinePitch * 0.58 + F.neck + F.head + sceneLeanPitch;
      const baseCervYaw   = state.lookYaw + F.yaw + sceneLeanYaw;
      const baseCervRoll  = Math.sin(t * 0.5) * 0.022 + F.roll + sceneLeanRoll;
      state._baseCervicalPitch  = baseCervPitch;
      state._baseCervicalYaw    = baseCervYaw;
      state._baseCervicalRoll   = baseCervRoll;
      state._baseCervicalGlideX = sceneGlideX;

      const ExpV4Now = typeof window !== "undefined" ? window.HumanExpressionsV4 : null;
      const emoLean = (ExpV4Now && typeof ExpV4Now.computeEmotionalCervicalLean === "function")
        ? ExpV4Now.computeEmotionalCervicalLean(charObj, nowSec, opts)
        : { pitch: 0, yaw: 0, roll: 0 };
      const isEskistaPose = pose === "eskista" || pose === "dance";
      let totalCervPitch = baseCervPitch + emoLean.pitch * (isEskistaPose ? 0.45 : 1.0);
      let totalCervYaw   = baseCervYaw   + emoLean.yaw   * (isEskistaPose ? 0.55 : 1.0);
      let totalCervRoll  = baseCervRoll  + emoLean.roll  * (isEskistaPose ? 0.35 : 1.0);
      let totalGlideX    = sceneGlideX;
      let cervChestAssist = (isHeavyPose || pose === "pump" || useWorldHandL || useWorldHandR) ? 0.25 : 1.0;

      const globalOvNow = (typeof window !== "undefined" && window.NIGHT_POST_EMOTION_OVERRIDE) || null;
      const localOvNow  = (group.userData && group.userData.emotionOverride) || null;
      const ovNow = localOvNow || globalOvNow;
      const rawNeckLean = opts.neckLean !== undefined ? opts.neckLean
        : (ovNow && typeof ovNow === "object" && ovNow.neckLean !== undefined ? ovNow.neckLean : state._pinnedNeckLean);

      let snapNeckJump = false;
      if (rawNeckLean !== null && rawNeckLean !== undefined && rawNeckLean !== false && rawNeckLean !== "auto") {
        let parsedLean = null;
        if (ExpV4Now && typeof ExpV4Now.resolveNeckLeanSpec === "function") {
          parsedLean = ExpV4Now.resolveNeckLeanSpec(rawNeckLean, nowSec, state.phase);
        } else if (typeof rawNeckLean === "number") {
          parsedLean = { roll: Math.abs(rawNeckLean) > 1.60 ? rawNeckLean * DEG : rawNeckLean, additive: false };
        } else if (typeof rawNeckLean === "object") {
          parsedLean = {
            roll: rawNeckLean.roll !== undefined ? (Math.abs(rawNeckLean.roll) > 1.60 ? rawNeckLean.roll * DEG : rawNeckLean.roll) : undefined,
            pitch: rawNeckLean.pitch !== undefined ? (Math.abs(rawNeckLean.pitch) > 1.60 ? rawNeckLean.pitch * DEG : rawNeckLean.pitch) : undefined,
            yaw: rawNeckLean.yaw !== undefined ? (Math.abs(rawNeckLean.yaw) > 1.60 ? rawNeckLean.yaw * DEG : rawNeckLean.yaw) : undefined,
            glideX: rawNeckLean.glideX,
            chestAssist: rawNeckLean.chestAssist,
            additive: Boolean(rawNeckLean.additive)
          };
        }
        if (parsedLean) {
          if (parsedLean.roll !== undefined) {
            if (state._lastExplicitLeanRoll !== null && Math.abs(parsedLean.roll - state._lastExplicitLeanRoll) > 0.10) snapNeckJump = true;
            state._lastExplicitLeanRoll = parsedLean.roll;
            totalCervRoll = parsedLean.additive ? (totalCervRoll + parsedLean.roll) : parsedLean.roll;
          }
          if (parsedLean.pitch !== undefined) {
            if (state._lastExplicitLeanPitch !== null && Math.abs(parsedLean.pitch - state._lastExplicitLeanPitch) > 0.10) snapNeckJump = true;
            state._lastExplicitLeanPitch = parsedLean.pitch;
            totalCervPitch = parsedLean.additive ? (totalCervPitch + parsedLean.pitch) : parsedLean.pitch;
          }
          if (parsedLean.yaw !== undefined) {
            if (state._lastExplicitLeanYaw !== null && Math.abs(parsedLean.yaw - state._lastExplicitLeanYaw) > 0.10) snapNeckJump = true;
            state._lastExplicitLeanYaw = parsedLean.yaw;
            totalCervYaw = parsedLean.additive ? (totalCervYaw + parsedLean.yaw) : parsedLean.yaw;
          }
          if (parsedLean.glideX !== undefined) {
            totalGlideX = parsedLean.additive ? (totalGlideX + parsedLean.glideX) : parsedLean.glideX;
          }
          if (parsedLean.chestAssist !== undefined) {
            cervChestAssist = parsedLean.chestAssist;
          }
        }
      } else {
        state._lastExplicitLeanRoll = null;
        state._lastExplicitLeanPitch = null;
        state._lastExplicitLeanYaw = null;
      }

      applyCervicalLeanArc(bones, B_CERVICAL_MAP, totalCervPitch, totalCervYaw, totalCervRoll, cervChestAssist, totalGlideX, neckLeanUniform);
      opts._cervicalSolvedInUpdate = true;

      if (state.voiceJaw != null) jawOpen = state.voiceJaw;            // a recorded voice drives the jaw by its loudness
      bones[B_JAW].rotation.set(Math.max(jawOpen, F.jaw) * 0.38, 0, 0);
      if (isYouth) {
        bones[B_HEAD].scale.setScalar(1.13);
      }

      // 1. Pre-IK Axial & Clavicle Muscle Filter (so Leg & Arm IK solve from exact smoothed shoulder/hip roots with ZERO post-IK drift!)
      const snapNow = !state.musclesReady || state.teleported || pose !== state.lastPose || Math.abs(nowSec - state.lastNowSec) > 0.22;
      const snapNeckNow = snapNow || Boolean(opts.snapNeckLean || opts.immediate || state._snapNeckOnce || snapNeckJump);
      state._snapNeckOnce = false;
      const cocontract = (isHeavyPose || pose === "pump" || useWorldHandL || useWorldHandR) ? 1.35 : 1.0;
      const AXIAL_BONES = [B_PELVIS, B_LUMBAR, B_THORAX, B_CHEST, B_NECK_LOW, B_NECK_HIGH, B_HEAD, B_JAW, B_CLAV_L, B_CLAV_R];
      for (let ai = 0; ai < AXIAL_BONES.length; ai++) {
        const bi = AXIAL_BONES[ai];
        const prof = MUSCLE_PROFILE_BY_BONE[bi];
        if (!prof) continue;
        const b = bones[bi];
        const qMem = state.boneQuats[bi];
        const isCervicalChain = bi === B_NECK_LOW || bi === B_NECK_HIGH || bi === B_HEAD || bi === B_CLAV_L || bi === B_CLAV_R || bi === B_CHEST || bi === B_THORAX;
        if (snapNow || (snapNeckNow && isCervicalChain)) {
          qMem.copy(b.quaternion);
        } else {
          const ang = qMem.angleTo(b.quaternion);
          const alpha = 1 - Math.exp(-prof.stiff * cocontract * sDt);
          const maxStep = prof.speed * cocontract * sDt;
          const step = Math.min(1, alpha, ang > 1e-6 ? maxStep / ang : 1);
          qMem.slerp(b.quaternion, step);
          b.quaternion.copy(qMem);
        }
      }

      // Sync live post-filter 3-joint cervical angles into `neckLeanUniform` (`uNeckLean`) & `B_HAIR_TAIL` gravity follow!
      const liveNeckRoll  = bones[B_NECK_LOW].rotation.z + bones[B_NECK_HIGH].rotation.z + bones[B_HEAD].rotation.z;
      const liveNeckPitch = bones[B_NECK_LOW].rotation.x + bones[B_NECK_HIGH].rotation.x + bones[B_HEAD].rotation.x;
      const liveNeckYaw   = bones[B_NECK_LOW].rotation.y + bones[B_NECK_HIGH].rotation.y + bones[B_HEAD].rotation.y;
      neckLeanUniform.value.set(liveNeckRoll, liveNeckPitch, liveNeckYaw, totalGlideX);
      if (skinMat.userData && skinMat.userData.facsUniforms && skinMat.userData.facsUniforms.uNeckLean) {
        skinMat.userData.facsUniforms.uNeckLean.value.set(liveNeckRoll, liveNeckPitch, liveNeckYaw, totalGlideX);
      }
      state.neckLeanState = {
        roll: liveNeckRoll,
        pitch: liveNeckPitch,
        yaw: liveNeckYaw,
        glideX: totalGlideX,
        rollDeg: +(liveNeckRoll / DEG).toFixed(2),
        pitchDeg: +(liveNeckPitch / DEG).toFixed(2),
        yawDeg: +(liveNeckYaw / DEG).toFixed(2)
      };

      // Dynamic Ponytail / Locs Secondary Swing on B_HAIR_TAIL (drapes naturally under cervical lean!)
      const isWalking = pose === "walk" || pose === "convoyWalk" || pose === "convoyPhoneWalk" || pose === "filmConvoy";
      const strideSway = isWalking ? Math.sin(nowSec * 4.6 + state.phase) * 0.08 : 0;
      const breeze = 0.05 + 0.045 * Math.sin(nowSec * 1.9 + state.phase) + Math.abs(strideSway) * 0.4;
      bones[B_HAIR_TAIL].rotation.set(
        -0.08 - Math.max(0, liveNeckPitch) * 0.35 - breeze * 0.85,
        -liveNeckYaw * 0.28 + Math.sin(t * 1.6) * 0.04,
        strideSway * 0.55 - liveNeckRoll * 0.52
      );
      bones[B_COAT_B].rotation.x = -breeze - Math.max(0, -pelDrop) * 0.45;
      bones[B_COAT_L].rotation.z =  breeze * 0.72 + strideSway * 0.35;
      bones[B_COAT_R].rotation.z = -breeze * 0.72 + strideSway * 0.35;

      group.updateMatrixWorld(true);

      // Solve Left & Right Leg 2-Bone IK + Toe Roll (with optional worldFootL / worldFootR plinth step locks!)
      if (opts.worldFootL) footTargetL.copy(opts.worldFootL);
      else charToWorld(fLx, fLy, fLz, footTargetL);
      if (opts.worldFootR) footTargetR.copy(opts.worldFootR);
      else charToWorld(fRx, fRy, fRz, footTargetR);
      if (surfaceAt && pose !== "drive") {
        if (!opts.worldFootL) {
          const gL = surfaceAt(footTargetL.x, footTargetL.z);
          const liftL = (fLy - 0.085) * scale;
          footTargetL.y = clamp(gL + 0.085 * scale + liftL, state.y - 0.26 * scale, state.y + 0.42 * scale);
        }
        if (!opts.worldFootR) {
          const gR = surfaceAt(footTargetR.x, footTargetR.z);
          const liftR = (fRy - 0.085) * scale;
          footTargetR.y = clamp(gR + 0.085 * scale + liftR, state.y - 0.26 * scale, state.y + 0.42 * scale);
        }
      }
      solveLimbIK(ik, bones[B_PELVIS], bones[B_ULEG_L], bones[B_LLEG_L], footTargetL, poleLeg, L_THIGH, L_SHIN, +1);
      solveLimbIK(ik, bones[B_PELVIS], bones[B_ULEG_R], bones[B_LLEG_R], footTargetR, poleLeg, L_THIGH, L_SHIN, +1);

      bones[B_PELVIS].updateWorldMatrix(false, true);
      for (const [bLL, bFT, bToe, fPitch, fYaw] of [
        [B_LLEG_L, B_FOOT_L, B_TOE_L, footPitchL, opts.footYawL || 0],
        [B_LLEG_R, B_FOOT_R, B_TOE_R, footPitchR, opts.footYawR || 0]
      ]) {
        bones[bLL].getWorldQuaternion(ik.qUpper);
        ik.qUpperInv.copy(ik.qUpper).invert();
        bones[bFT].quaternion.copy(ik.qUpperInv).multiply(grpWorldQuat);
        if (fYaw) bones[bFT].rotateY(fYaw);
        bones[bFT].rotateX(fPitch);
        bones[bToe].rotation.x = Math.max(0, fPitch) * 0.55;
      }

      // Compute world-space wrist targets + palm/finger grip vectors
      if (!useWorldHandL) charToWorld(localTargetL.x, localTargetL.y, localTargetL.z, handTargetL);
      if (!useWorldHandR) charToWorld(localTargetR.x, localTargetR.y, localTargetR.z, handTargetR);
      rawGripWorldL.copy(handTargetL);
      rawGripWorldR.copy(handTargetR);

      if (!useWorldFrameL) {
        palmWorldL.copy(palmLocalL).applyQuaternion(grpWorldQuat).normalize();
        if (fDirLocalL.lengthSq() > 1e-6) fDirWorldL.copy(fDirLocalL).applyQuaternion(grpWorldQuat).normalize();
        else fDirWorldL.set(0, 0, 0);
      }
      if (!useWorldFrameR) {
        palmWorldR.copy(palmLocalR).applyQuaternion(grpWorldQuat).normalize();
        if (fDirLocalR.lengthSq() > 1e-6) fDirWorldR.copy(fDirLocalR).applyQuaternion(grpWorldQuat).normalize();
        else fDirWorldR.set(0, 0, 0);
      }

      const isLongPump = (pose === "pump" && pocketPullL > 0 && pocketPullL < 0.060)
        || gripModeL === "pumpBar" || gripModeR === "pumpBar";
      const localPocketOffset = (side, mode, out) => {
        if (mode === "pumpBar") {
          // Seat mid-palm hollow (y=-0.052) 21.5mm from bar axis (14.5mm shaft + 7mm palm pad = 0.0mm flush contact on BOTH hands!)
          return isLongPump ? out.set(-side * 0.0215, -0.052, 0.008) : out.set(-side * 0.024, -0.066, 0.004);
        }
        if (mode === "bowlRim") {
          // Seat distal index/middle fingerpads (y=-0.106) 0.000mm flush onto the grooved terracotta basin rim!
          return out.set(-side * 0.005, -0.106, 0.008);
        }
        if (mode === "handleTop") return out.set(-side * 0.028, -0.072, 0.004);
        if (mode === "cradle" || mode === "underRib") return out.set(-side * 0.009, -0.068, 0.004);
        return out.set(-side * 0.012, -0.062, 0.002);
      };

      if (pocketPullL > 0) {
        if (fDirWorldL.lengthSq() > 1e-6) handTargetL.addScaledVector(fDirWorldL, -pocketPullL * scale);
        const pPullL = gripModeL === "bowlRim" ? 0.008 : gripModeL === "handleTop" ? 0.028 : gripModeL === "pumpBar" ? 0.025 : gripModeL === "wrap" ? 0.026 : 0.010;
        handTargetL.addScaledVector(palmWorldL, -pPullL * scale);
      }
      if (pocketPullR > 0) {
        if (fDirWorldR.lengthSq() > 1e-6) handTargetR.addScaledVector(fDirWorldR, -pocketPullR * scale);
        const pPullR = gripModeR === "bowlRim" ? 0.008 : gripModeR === "handleTop" ? 0.028 : gripModeR === "pumpBar" ? 0.025 : gripModeR === "wrap" ? 0.026 : 0.010;
        handTargetR.addScaledVector(palmWorldR, -pPullR * scale);
      }

      const lodDist = opts.lodDist !== undefined ? opts.lodDist : 0;
      const useFullArmIK = lodDist < 22;
      const showFingers = lodDist < 16;
      if (handL && handR) {
        handL.userData.setLodNear(showFingers);
        handR.userData.setLodNear(showFingers);
      }
      if (hairCtrl) {
        hairCtrl.setHairLod(lodDist);
      }

      if (useFullArmIK) {
        bones[B_ULEG_L].getWorldPosition(bodyCapPool[0].a);
        bones[B_ULEG_R].getWorldPosition(bodyCapPool[0].b);
        bodyCapPool[0].r = 0.108 * scale * build;

        bones[B_PELVIS].getWorldPosition(bodyCapPool[1].a);
        bones[B_THORAX].getWorldPosition(bodyCapPool[1].b);
        bodyCapPool[1].r = 0.136 * scale * build;

        bones[B_THORAX].getWorldPosition(bodyCapPool[2].a);
        bones[B_CHEST].getWorldPosition(bodyCapPool[2].b);
        bodyCapPool[2].b.y += 0.085 * scale;
        bodyCapPool[2].r = (outerStyle === "shamma" ? 0.156 : 0.146) * scale * build;

        bones[B_NECK_LOW].getWorldPosition(bodyCapPool[3].a);
        bones[B_HEAD].getWorldPosition(bodyCapPool[3].b);
        bodyCapPool[3].b.y += 0.125 * scale;
        bodyCapPool[3].r = 0.104 * scale;

        ik.charRight.set(1, 0, 0).applyQuaternion(grpWorldQuat);
        if (!useWorldHandL) projectOutCapsules(ik, handTargetL, activeCapsL, 0.036 * scale, +1, ik.charRight);
        if (!useWorldHandR) projectOutCapsules(ik, handTargetR, activeCapsL, 0.036 * scale, -1, ik.charRight);

        solveArmSafe(ik, bones[B_CLAV_L], bones[B_UARM_L], bones[B_FARM_L], handTargetL, L_UARM, L_FARM, +1, scale, activeCapsL, state.bendMemL, grpWorldQuat, elbowWorldL);
        if (V3) {
          V3.solveWristTwistAndElbowVolume(ik, bones[B_FARM_L], bones[B_FARM_TWIST_L], bones[B_ELBOW_VOL_L], bones[B_HAND_L], +1, palmWorldL, fDirWorldL.lengthSq() > 1e-6 ? fDirWorldL : null);
          // Pass 2 Closed-Loop Palm-Pocket Lock: cancel exact wrist-twist/clamp offset so palmar grip hollow lands at 0.000m on prop!
          if (useWorldHandL && pocketPullL > 0) {
            localPocketOffset(+1, gripModeL, pocketTestWorld).applyMatrix4(bones[B_HAND_L].matrixWorld);
            ik.segPt.subVectors(rawGripWorldL, pocketTestWorld);
            if (ik.segPt.lengthSq() > 1e-8) {
              if (ik.segPt.length() > 0.14 * scale) ik.segPt.setLength(0.14 * scale);
              handTargetL.add(ik.segPt);
              solveArmSafe(ik, bones[B_CLAV_L], bones[B_UARM_L], bones[B_FARM_L], handTargetL, L_UARM, L_FARM, +1, scale, activeCapsL, state.bendMemL, grpWorldQuat, elbowWorldL);
              V3.solveWristTwistAndElbowVolume(ik, bones[B_FARM_L], bones[B_FARM_TWIST_L], bones[B_ELBOW_VOL_L], bones[B_HAND_L], +1, palmWorldL, fDirWorldL.lengthSq() > 1e-6 ? fDirWorldL : null);
            }
          }
        }

        bones[B_UARM_L].getWorldPosition(bodyCapPool[4].a);
        bodyCapPool[4].b.copy(elbowWorldL);
        bodyCapPool[4].r = 0.044 * scale;
        bodyCapPool[5].a.copy(elbowWorldL);
        bones[B_HAND_L].getWorldPosition(bodyCapPool[5].b);
        bodyCapPool[5].r = 0.036 * scale;

        solveArmSafe(ik, bones[B_CLAV_R], bones[B_UARM_R], bones[B_FARM_R], handTargetR, L_UARM, L_FARM, -1, scale, activeCapsR, state.bendMemR, grpWorldQuat, elbowWorldR);
        if (V3) {
          V3.solveWristTwistAndElbowVolume(ik, bones[B_FARM_R], bones[B_FARM_TWIST_R], bones[B_ELBOW_VOL_R], bones[B_HAND_R], -1, palmWorldR, fDirWorldR.lengthSq() > 1e-6 ? fDirWorldR : null);
          if (useWorldHandR && pocketPullR > 0) {
            localPocketOffset(-1, gripModeR, pocketTestWorld).applyMatrix4(bones[B_HAND_R].matrixWorld);
            ik.segPt.subVectors(rawGripWorldR, pocketTestWorld);
            if (ik.segPt.lengthSq() > 1e-8) {
              if (ik.segPt.length() > 0.14 * scale) ik.segPt.setLength(0.14 * scale);
              handTargetR.add(ik.segPt);
              solveArmSafe(ik, bones[B_CLAV_R], bones[B_UARM_R], bones[B_FARM_R], handTargetR, L_UARM, L_FARM, -1, scale, activeCapsR, state.bendMemR, grpWorldQuat, elbowWorldR);
              V3.solveWristTwistAndElbowVolume(ik, bones[B_FARM_R], bones[B_FARM_TWIST_R], bones[B_ELBOW_VOL_R], bones[B_HAND_R], -1, palmWorldR, fDirWorldR.lengthSq() > 1e-6 ? fDirWorldR : null);
            }
          }
        }
      } else {
        ik.poleWorld.set( 0.42, -0.35, -0.82).normalize();
        solveLimbIK(ik, bones[B_CLAV_L], bones[B_UARM_L], bones[B_FARM_L], handTargetL, ik.poleWorld, L_UARM, L_FARM, +1);
        ik.poleWorld.set(-0.42, -0.35, -0.82).normalize();
        solveLimbIK(ik, bones[B_CLAV_R], bones[B_UARM_R], bones[B_FARM_R], handTargetR, ik.poleWorld, L_UARM, L_FARM, +1);
        if (V3) {
          V3.solveWristTwistAndElbowVolume(ik, bones[B_FARM_L], bones[B_FARM_TWIST_L], bones[B_ELBOW_VOL_L], bones[B_HAND_L], +1, palmWorldL, fDirWorldL.lengthSq() > 1e-6 ? fDirWorldL : null);
          V3.solveWristTwistAndElbowVolume(ik, bones[B_FARM_R], bones[B_FARM_TWIST_R], bones[B_ELBOW_VOL_R], bones[B_HAND_R], -1, palmWorldR, fDirWorldR.lengthSq() > 1e-6 ? fDirWorldR : null);
        }
      }

      // Pose 30 Skinned Finger Phalanges (or legacy sculpted hands)
      if (V3) {
        if (showFingers) {
          V3.poseHandPhalanges(bones, +1, curlL, spreadL, gripModeL, nowSec);
          V3.poseHandPhalanges(bones, -1, curlR, spreadR, gripModeR, nowSec);
          // On longitudinal standpipe lever, hook IP & distal thumb phalanges smoothly UNDERNEATH the 14.5mm iron shaft!
          if (isLongPump && V3.B) {
            const B3 = V3.B;
            bones[B3.L_THUMB_1].rotation.set(0.60, 0.0, -0.26, "YZX");
            bones[B3.L_THUMB_2].rotation.set(0.16, 0.0, -1.24);
            bones[B3.L_THUMB_3].rotation.set(0.08, 0.0, -1.16);
            bones[B3.R_THUMB_1].rotation.set(0.60, 0.0,  0.26, "YZX");
            bones[B3.R_THUMB_2].rotation.set(0.16, 0.0,  1.24);
            bones[B3.R_THUMB_3].rotation.set(0.08, 0.0,  1.16);
          }
        }
      } else {
        solveHandGrip(ik, bones[B_FARM_L], bones[B_HAND_L], +1, palmWorldL, fDirWorldL.lengthSq() > 1e-6 ? fDirWorldL : null);
        solveHandGrip(ik, bones[B_FARM_R], bones[B_HAND_R], -1, palmWorldR, fDirWorldR.lengthSq() > 1e-6 ? fDirWorldR : null);
        if (showFingers && handL && handR) {
          handL.userData.setCurl(curlL, spreadL, gripModeL);
          handR.userData.setCurl(curlR, spreadR, gripModeR);
        }
      }

      // 2. Post-IK Limb Muscle Filter (skip slerp lag on world-prop-locked arms so hands stay 0.000m glued to moving levers & cans!)
      const LIMB_BONES = [
        B_ULEG_L, B_LLEG_L, B_FOOT_L, B_ULEG_R, B_LLEG_R, B_FOOT_R,
        B_UARM_L, B_FARM_L, B_HAND_L, B_UARM_R, B_FARM_R, B_HAND_R
      ];
      for (let li = 0; li < LIMB_BONES.length; li++) {
        const bi = LIMB_BONES[li];
        const prof = MUSCLE_PROFILE_BY_BONE[bi];
        if (!prof) continue;
        const b = bones[bi];
        const qMem = state.boneQuats[bi];
        const lockArmL = useWorldHandL && (bi === B_UARM_L || bi === B_FARM_L || bi === B_HAND_L);
        const lockArmR = useWorldHandR && (bi === B_UARM_R || bi === B_FARM_R || bi === B_HAND_R);
        if (snapNow || lockArmL || lockArmR) {
          qMem.copy(b.quaternion);
        } else {
          const ang = qMem.angleTo(b.quaternion);
          const alpha = 1 - Math.exp(-prof.stiff * cocontract * sDt);
          const maxStep = prof.speed * cocontract * sDt;
          const step = Math.min(1, alpha, ang > 1e-6 ? maxStep / ang : 1);
          qMem.slerp(b.quaternion, step);
          b.quaternion.copy(qMem);
        }
      }

      // Synchronize knee & elbow half-angle volume helpers AFTER slerp so bisector matches instantaneous joint bend 1:1!
      if (V3) {
        V3.updateKneeVolumeHelper(bones[B_LLEG_L], bones[B_KNEE_VOL_L]);
        V3.updateKneeVolumeHelper(bones[B_LLEG_R], bones[B_KNEE_VOL_R]);
        V3.updateKneeVolumeHelper(bones[B_FARM_L], bones[B_ELBOW_VOL_L]);
        V3.updateKneeVolumeHelper(bones[B_FARM_R], bones[B_ELBOW_VOL_R]);
      }

      // Step `three-vrm`-style damped spring-bone chains for sculpted hair grooms & multi-fold garments!
      if (hairCtrl && typeof hairCtrl.update === "function") {
        hairCtrl.update(sDt, nowSec, state.phase);
      }
      if (garmentCtrl && typeof garmentCtrl.update === "function") {
        garmentCtrl.update(sDt, nowSec, state.phase);
      }

      state.musclesReady = true;
      state.teleported = false;
      state.lastPose = pose;
      state.lastNowSec = nowSec;

      if (phoneProp.visible) {
        cyanGlowUniform.value.set(
          phoneProp.position.x,
          phoneProp.position.y - 0.032,
          phoneProp.position.z + 0.018,
          pose === "filmConvoy" ? 0.82 : 0.94
        );
        handCyanGlowUniform.value.set(0.0, 0.81, 0.035, pose === "filmConvoy" ? 0.92 : 1.12);
      } else if (carryCanProp.visible && cyanGlowUniform.value.w < 0.1) {
        cyanGlowUniform.value.set(-shX - 0.06, 0.72, 0.04, 0.35);
        handCyanGlowUniform.value.set(-shX - 0.02, 0.78, 0.02, 0.38);
      } else {
        handCyanGlowUniform.value.set(0.0, 0.81, 0.03, cyanGlowUniform.value.w * 0.75);
      }

      // Sync v4 Expression Controller display state so ch.getExpressionState() reflects live opts & scene acting!
      const expCtrl = charObj && charObj._v4ExpCtrl;
      if (expCtrl) {
        const globalOv = (typeof window !== "undefined" && window.NIGHT_POST_EMOTION_OVERRIDE) || null;
        const localOv = (group.userData && group.userData.emotionOverride) || null;
        const ov = localOv || globalOv;
        const ovEmo = ov && (typeof ov === "string" ? ov : (ov.emotion && ov.emotion !== "auto" ? ov.emotion : null));
        if (ovEmo) {
          expCtrl.emotionId = typeof ovEmo === "string" ? ovEmo : "custom";
        } else if (opts.emotion !== undefined) {
          expCtrl.emotionId = typeof opts.emotion === "string" ? opts.emotion : "custom";
          if (opts.emotionIntensity !== undefined) expCtrl.emotionIntensity = opts.emotionIntensity;
        }
        if (ov && ov.speaking !== undefined) {
          expCtrl.speaking = Boolean(ov.speaking);
        } else if (opts.speaking !== undefined) {
          expCtrl.speaking = Boolean(opts.speaking);
          if (typeof opts.speaking === "string" && opts.speaking.length > 0) expCtrl.speechPhrase = opts.speaking;
        }
        if (opts.viseme !== undefined) {
          expCtrl.visemeId = opts.viseme || "SIL";
          expCtrl.visemeAmount = opts.viseme ? (opts.visemeAmount !== undefined ? opts.visemeAmount : 1.0) : 0.0;
        } else if (!state._userPinnedViseme) {
          expCtrl.visemeAmount = 0.0;
        }
        if (opts.handGestureL !== undefined) expCtrl.handGestureL = opts.handGestureL;
        if (opts.handGestureR !== undefined) expCtrl.handGestureR = opts.handGestureR;
      }

      group.updateMatrixWorld(true);
      if (xraySkeleton && xraySkeleton.isEnabled()) {
        xraySkeleton.update();
      }
    }

    function setFingerLod(isNear) {
      if (handL && handR) {
        handL.userData.setLodNear(isNear);
        handR.userData.setLodNear(isNear);
      }
      if (hairCtrl) {
        hairCtrl.setHairLod(isNear ? 6 : 24);
      }
    }

    function setDebugSkeleton(flag) {
      if (xraySkeleton) xraySkeleton.setVisible(flag);
    }

    place(state.x, state.z, state.heading, null);
    makeExpeditionCharacter.fit = getHumanPortraitFit(T);

    // Safe standalone fallbacks when characters.js is loaded without expressions-v4.js
    const fallbackExpState = {
      emotion: "neutral",
      emotionIntensity: 1.0,
      speaking: false,
      viseme: "SIL",
      visemeAmount: 0.0,
      handGestureL: "relaxed_breathing",
      handGestureR: "relaxed_breathing",
      expressiveArmGesture: null
    };

    const charObj = {
      group,
      userData: group.userData,
      bones,
      skeleton,
      state,
      label,
      uNeckLean: neckLeanUniform,
      canonicalSkinUniform,
      place,
      setSpeech,
      setSpeechLabel: setSpeech,
      setPose,
      update,
      setFingerLod,
      setDebugSkeleton,
      setClayMode(flag) {
        if (SGG && typeof SGG.setClayMode === "function") SGG.setClayMode(group, flag);
        else if (V6 && typeof V6.setClayMode === "function") V6.setClayMode(group, flag);
        return charObj;
      },
      isDebugSkeleton: () => Boolean(xraySkeleton && xraySkeleton.isEnabled()),
      skeletonInfo: { anatomicalBones: 56, totalBones: bones.length, fingerPhalanges: 30 },
      moods: Object.keys(MOODS).map(k => ({ id: k, label: MOODS[k].label })),
      setMood(id) { if (MOODS[id]) { state.mood = id; state.moodT = 0; } },
      setNeckLean(leanSpecOrAngle, immediate = true) {
        if (leanSpecOrAngle === null || leanSpecOrAngle === undefined || leanSpecOrAngle === "auto" || leanSpecOrAngle === false) {
          state._pinnedNeckLean = null;
        } else {
          state._pinnedNeckLean = leanSpecOrAngle;
          if (immediate) state._snapNeckOnce = true;
        }
        if (immediate) {
          bones[B_THORAX].quaternion.copy(state._preCervicalQuats.thorax);
          bones[B_CHEST].quaternion.copy(state._preCervicalQuats.chest);
          bones[B_CLAV_L].quaternion.copy(state._preCervicalQuats.clavL);
          bones[B_CLAV_R].quaternion.copy(state._preCervicalQuats.clavR);
          let r = state._baseCervicalRoll, p = state._baseCervicalPitch, y = state._baseCervicalYaw, g = state._baseCervicalGlideX;
          if (typeof leanSpecOrAngle === "number") {
            r = Math.abs(leanSpecOrAngle) > 1.60 ? leanSpecOrAngle * DEG : leanSpecOrAngle;
          } else if (leanSpecOrAngle && typeof leanSpecOrAngle === "object") {
            if (leanSpecOrAngle.roll !== undefined) r = Math.abs(leanSpecOrAngle.roll) > 1.60 ? leanSpecOrAngle.roll * DEG : leanSpecOrAngle.roll;
            if (leanSpecOrAngle.pitch !== undefined) p = Math.abs(leanSpecOrAngle.pitch) > 1.60 ? leanSpecOrAngle.pitch * DEG : leanSpecOrAngle.pitch;
            if (leanSpecOrAngle.yaw !== undefined) y = Math.abs(leanSpecOrAngle.yaw) > 1.60 ? leanSpecOrAngle.yaw * DEG : leanSpecOrAngle.yaw;
            if (leanSpecOrAngle.glideX !== undefined) g = leanSpecOrAngle.glideX;
          }
          const solved = applyCervicalLeanArc(bones, B_CERVICAL_MAP, p, y, r, 1.0, g, neckLeanUniform);
          state.neckLeanState = {
            roll: solved.roll, pitch: solved.pitch, yaw: solved.yaw, glideX: solved.glideX,
            rollDeg: +(solved.roll / DEG).toFixed(2), pitchDeg: +(solved.pitch / DEG).toFixed(2), yawDeg: +(solved.yaw / DEG).toFixed(2)
          };
          group.updateMatrixWorld(true);
        }
        return charObj;
      },
      getNeckLeanState() {
        return Object.assign({}, state.neckLeanState);
      },
      setEmotion(presetOrWeights, intensity = 1.0) {
        if (!presetOrWeights || presetOrWeights === "auto") {
          state._userPinnedEmotion = false;
          fallbackExpState.emotion = "neutral";
        } else {
          state._userPinnedEmotion = true;
          fallbackExpState.emotion = typeof presetOrWeights === "string" ? presetOrWeights : "custom";
          fallbackExpState.emotionIntensity = clamp(intensity, 0, 1.5);
        }
        return charObj;
      },
      setViseme(visemeId, amount = 1.0) {
        state._userPinnedViseme = Boolean(visemeId && amount > 0);
        fallbackExpState.viseme = visemeId || "SIL";
        fallbackExpState.visemeAmount = visemeId ? clamp(amount, 0, 1.25) : 0;
        return charObj;
      },
      setHandGesture(sideOrBoth, gestureId, _t = 0, _intensity = 1.0) {
        const s = sideOrBoth;
        const doL = s === "L" || s === "left" || s === 1 || s === "both" || s === "all" || s === 0 || !s;
        const doR = s === "R" || s === "right" || s === -1 || s === "both" || s === "all" || s === 0 || !s;
        if (doL) { state._userPinnedHandL = Boolean(gestureId && gestureId !== "auto"); fallbackExpState.handGestureL = gestureId || "relaxed_breathing"; }
        if (doR) { state._userPinnedHandR = Boolean(gestureId && gestureId !== "auto"); fallbackExpState.handGestureR = gestureId || "relaxed_breathing"; }
        return charObj;
      },
      applyExpressiveArmPose(gestureId) {
        fallbackExpState.expressiveArmGesture = gestureId || null;
        return charObj;
      },
      getExpressionState() {
        return {
          emotion: state._userPinnedEmotion ? fallbackExpState.emotion : state.autoEmotion,
          emotionIntensity: state._userPinnedEmotion ? fallbackExpState.emotionIntensity : state.autoEmotionIntensity,
          speaking: Boolean(state._userPinnedSpeech ? fallbackExpState.speaking : state.autoSpeaking),
          viseme: state._userPinnedViseme ? fallbackExpState.viseme : (state.autoViseme || "SIL"),
          visemeAmount: state._userPinnedViseme ? fallbackExpState.visemeAmount : state.autoVisemeAmount,
          jawOpen: bones[B_JAW] ? clamp(bones[B_JAW].rotation.x / 0.45, 0, 1) : 0,
          neckLean: Object.assign({}, state.neckLeanState),
          handGestureL: state._userPinnedHandL ? fallbackExpState.handGestureL : state.autoHandL,
          handGestureR: state._userPinnedHandR ? fallbackExpState.handGestureR : state.autoHandR,
          expressiveArmGesture: fallbackExpState.expressiveArmGesture
        };
      }
    };

    const initScionEyes = (headAnchor && headAnchor.userData && headAnchor.userData.scionEyes) || (lids && lids.scionEyes) || null;
    const initScionLids = (headAnchor && headAnchor.userData && headAnchor.userData.scionLids) || (lids && lids.scionLids) || null;
    if (initScionEyes) {
      charObj.scionEyes = initScionEyes;
      group.userData.scionEyes = initScionEyes;
    }
    if (initScionLids) {
      charObj.scionLids = initScionLids;
      group.userData.scionLids = initScionLids;
    }

    charObj.spec = spec;
    group.userData.spec = spec;
    if (skinMatWrist && skinMatWrist.userData) skinMatWrist.userData.isSkin = true;

    if (V3) V3.registerCharacterInstance(charObj);

    // Attach HumanExpressionsV4 controller (FACS facial shader + Scion eyes/eyelids + jaw/teeth/tongue visemes + 30-bone expressive hands!)
    const ExpV4 = typeof window !== "undefined" ? window.HumanExpressionsV4 : null;
    if (ExpV4 && typeof ExpV4.attachCharacterExpressionController === "function") {
      ExpV4.attachCharacterExpressionController(T, charObj, {
        headMesh,
        earsMesh,
        handsMesh,
        skinMat: (headMesh && headMesh.material) || skinMat,
        handMat: (handsMesh && handsMesh.material) || handMat,
        lids,
        scionEyes: charObj.scionEyes || (headAnchor && headAnchor.userData && headAnchor.userData.scionEyes) || null,
        scionLids: charObj.scionLids || (headAnchor && headAnchor.userData && headAnchor.userData.scionLids) || null,
        headAnchor,
        bones,
        skeleton,
        xraySkeleton
      });
      const v4SetEmotion = charObj.setEmotion;
      charObj.setEmotion = function (presetOrWeights, intensity = 1.0) {
        if (!presetOrWeights || presetOrWeights === "auto") {
          state._userPinnedEmotion = false;
          return v4SetEmotion("neutral", intensity);
        }
        state._userPinnedEmotion = true;
        return v4SetEmotion(presetOrWeights, intensity);
      };
      const v4SetSpeech = charObj.setSpeech;
      charObj.setSpeech = function (activeOrPhrase, t, intensity = 1.0) {
        state._userPinnedSpeech = Boolean(activeOrPhrase && activeOrPhrase !== "auto");
        return v4SetSpeech(activeOrPhrase === "auto" ? false : activeOrPhrase, t, intensity);
      };
      const v4SetViseme = charObj.setViseme;
      charObj.setViseme = function (visemeId, amount = 1.0) {
        state._userPinnedViseme = Boolean(visemeId && visemeId !== "AUTO" && amount > 0);
        return v4SetViseme(visemeId === "AUTO" ? null : visemeId, amount);
      };
      const v4SetHand = charObj.setHandGesture;
      charObj.setHandGesture = function (sideOrBoth, gestureId, t = 0, intensity = 1.0) {
        const clear = !gestureId || gestureId === "auto";
        const s = sideOrBoth;
        const doL = s === "L" || s === "left" || s === 1 || s === "both" || s === "all" || s === 0 || !s;
        const doR = s === "R" || s === "right" || s === -1 || s === "both" || s === "all" || s === 0 || !s;
        if (doL) state._userPinnedHandL = !clear;
        if (doR) state._userPinnedHandR = !clear;
        return v4SetHand(sideOrBoth, clear ? null : gestureId, t, intensity);
      };
    }

    if (V6 && typeof V6.upgradeCharacterSkinMeshes === "function") {
      V6.upgradeCharacterSkinMeshes(T, charObj, spec);
    }

    return charObj;
  }

  /* ---------- Full Canonical Cast Across West Expedition & Ahiya Highlands ---------- */
  const BASE_CAST = [
    // 1. SNAKE RIVER OVERLOOK WELLHEAD (`saddle.jpg`)
    {
      id: "imani", name: "Imani", role: "Carrier · Mistletoe's Handler",
      x: -24.8, z: -2.0, heading: 1.52, scale: 1.00, build: 1.02, fem: 0.68,
      skinHex: 0x3b261b, hair: "croppedCoily", hairHex: 0x151210,
      outer: "duster", coatHex: 0x2c312e, shirtHex: 0x3f433e, trouserHex: 0x222526,
      toolBelt: true, patchedKnees: true, pose: "touchPack"
    },
    {
      id: "june", name: "June", role: "Young Listener · Tin Cup Mic",
      x: -23.4, z: -3.2, heading: 1.65, scale: 0.76, build: 0.96, fem: 0.55,
      skinHex: 0x3f291e, hair: "shortLocs", hairHex: 0x161311,
      outer: "parka", coatHex: 0x3d413b, shirtHex: 0x9b8f7a, trouserHex: 0x2b2e2d,
      tibebTrim: true, tinCup: true, patchedKnees: true, pose: "holdCup"
    },
    {
      id: "witness_tomas", name: "Tomas", role: "Dawn Pump Witness · 4 L Chalk",
      x: -20.2, z: -7.8, heading: -0.95, scale: 1.01, build: 1.04, fem: 0.15,
      skinHex: 0x4b3325, hair: "turban", wrapHex: 0x625a4c, beard: true, hairHex: 0x1a1715,
      outer: "shamma", coatHex: 0xa8a090, shirtHex: 0x4a463f, trouserHex: 0x252728,
      queueHasCan: true, pose: "queueWait"
    },

    // 2. MORAINE SWITCHBACK
    {
      id: "nell", name: "Nell", role: "Switchback Baker · Flour Apron",
      x: -45.4, z: -164.6, heading: 0.55, scale: 0.98, build: 1.06, fem: 0.78,
      skinHex: 0x513829, hair: "shashWrap", wrapHex: 0xd6cfc0,
      outer: "apron", coatHex: 0xc8c0b2, shirtHex: 0x443c35, trouserHex: 0x2b2928,
      rolledSleeves: true, pose: "idle"
    },
    {
      id: "kaleb", name: "Kaleb", role: "Saddle-Pad & Cinch Mender",
      x: -51.2, z: -166.4, heading: 1.15, scale: 1.00, build: 1.05, fem: 0.12,
      skinHex: 0x3d281c, hair: "croppedCoily", hairHex: 0x171412,
      outer: "none", shirtHex: 0x474a44, trouserHex: 0x26292b,
      rolledSleeves: true, patchedKnees: true, pose: "idle"
    },

    // 3. SILVER FORD RELAY & FERRY LANDING
    {
      id: "etta", name: "Etta", role: "Print Keeper · Silver Ford & Oxbow",
      x: -244.8, z: -53.0, heading: -0.75, scale: 0.96, build: 0.98, fem: 0.82,
      skinHex: 0x6a5040, hair: "silverSwept", hairHex: 0xb8b5ae,
      outer: "shamma", coatHex: 0x6e685e, shirtHex: 0x3d3934, trouserHex: 0x282624,
      satchel: true, pose: "shadeScreen"
    },
    {
      id: "ferry_bekele", name: "Bekele", role: "Elder Ferryman · Wet Post Gauge",
      x: -252.2, z: -52.4, heading: 1.85, scale: 1.02, build: 1.08, fem: 0.10,
      skinHex: 0x422c20, hair: "feltHat", hatHex: 0x252320, beard: true, hairHex: 0x24201d,
      outer: "duster", coatHex: 0x2d3234, shirtHex: 0x3e4447, trouserHex: 0x222528,
      pose: "pointPost"
    },
    {
      id: "ferry_tadesse", name: "Tadesse", role: "Younger Ferryman · Alignment Stone",
      x: -241.5, z: -59.2, heading: -2.25, scale: 1.00, build: 1.03, fem: 0.12,
      skinHex: 0x452e21, hair: "croppedCoily", hairHex: 0x161412,
      outer: "shamma", coatHex: 0x8e887c, shirtHex: 0x363a3c, trouserHex: 0x242628,
      pose: "idle"
    },

    // 4. COTTONWOOD OXBOW LIVING FILM GROVE (`grove.jpg`)
    {
      id: "makeda", name: "Makeda", role: "Grove Carrier · Root-Bowl Pour",
      x: -511.6, z: 98.0, heading: 1.92, scale: 0.98, build: 0.99, fem: 0.76,
      skinHex: 0x3c271c, hair: "cornrowBraids", hairHex: 0x141210,
      outer: "shamma", coatHex: 0xd8cfc0, shirtHex: 0x6e5948, trouserHex: 0x645244,
      satchel: true, patchedKnees: true, pose: "kneelPour"
    },
    {
      id: "old_bride", name: "Woyzero Almaz", role: "Front-Row Witness · WF–08",
      x: -509.8, z: 98.8, heading: -2.68, scale: 0.94, build: 0.98, fem: 0.85,
      skinHex: 0x4a3326, hair: "shashWrap", wrapHex: 0xd8d2c4,
      outer: "shamma", coatHex: 0xbcb5a6, shirtHex: 0x423b35, trouserHex: 0x2a2725,
      pose: "screenWatch"
    },
    {
      id: "hood_watcher_1", name: "Grove Projectionist", role: "Oxbow Lantern & Sheet Rig",
      x: -506.6, z: 96.4, heading: -2.45, scale: 1.01, build: 1.02, fem: 0.25,
      skinHex: 0x3a261b, hair: "hood",
      outer: "parka", coatHex: 0x1f2324, shirtHex: 0x292d2e, trouserHex: 0x1c1f20,
      pose: "screenWatch"
    },
    {
      id: "hood_watcher_2", name: "Oxbow Listener", role: "Eight-Second Tail Witness",
      x: -505.8, z: 97.6, heading: -2.55, scale: 0.97, build: 0.98, fem: 0.65,
      skinHex: 0x442e21, hair: "hood",
      outer: "parka", coatHex: 0x25292a, shirtHex: 0x313536, trouserHex: 0x1e2122,
      pose: "screenWatch"
    },

    // 5. HIGHLAND PUEBLO COOLING YARD, WIRE-GLASS REGISTRY & VILLAGE QUEUE
    {
      id: "tess", name: "Tess", role: "Registry Clerk & Cooling Operator",
      x: -772.97, z: -32.24, yOffset: 0.38, heading: 0.30, scale: 0.99, build: 1.00, fem: 0.72,
      skinHex: 0x7c5e4b, hair: "ponytail", hairHex: 0x2b221c,
      outer: "duster", coatHex: 0x4c5254, shirtHex: 0xbac0be, trouserHex: 0x2b3034,
      rolledSleeves: true, pose: "clerkWindow"
    },
    {
      id: "queue_1", name: "Abeba", role: "Highland Queue · Enamel Cup",
      x: -773.9, z: -29.2, heading: -2.84, scale: 0.96, build: 0.98, fem: 0.80,
      skinHex: 0x442e22, hair: "shashWrap", wrapHex: 0xc4bdb0,
      outer: "shamma", coatHex: 0x7c766c, shirtHex: 0x3d3a36, trouserHex: 0x262524,
      queueHasCup: true, pose: "queueWait"
    },
    {
      id: "queue_2", name: "Girma", role: "Highland Queue · Ration Holder",
      x: -774.6, z: -27.8, heading: -2.75, scale: 1.01, build: 1.04, fem: 0.15,
      skinHex: 0x3d281c, hair: "croppedCoily", hairHex: 0x161412,
      outer: "shamma", coatHex: 0x928b7e, shirtHex: 0x383b3c, trouserHex: 0x242628,
      beard: true, pose: "queueWait"
    },
    {
      id: "queue_3", name: "Zewditu", role: "Highland Queue · Lower Yard",
      x: -775.4, z: -26.5, heading: -2.68, scale: 0.95, build: 1.00, fem: 0.82,
      skinHex: 0x493224, hair: "shashWrap", wrapHex: 0xb2aba0,
      outer: "shamma", coatHex: 0x68635a, shirtHex: 0x3a3632, trouserHex: 0x252423,
      queueHasCan: true, pose: "queueWait"
    },
    {
      id: "queue_4", name: "Berhanu", role: "Highland Elder · Sisal Rope & Can",
      x: -776.3, z: -25.2, heading: -2.62, scale: 1.02, build: 1.05, fem: 0.10,
      skinHex: 0x3f291d, hair: "turban", wrapHex: 0x585246, beard: true, hairHex: 0x1d1a18,
      outer: "shamma", coatHex: 0xb2aa9a, shirtHex: 0x5a5044, trouserHex: 0x232627,
      pose: "tieRope"
    },

    // 6. ABYSSAL WHALE FLUKE & HALF DOME EAST APRON
    {
      id: "dawit", name: "Dawit", role: "Whale Fluke Keeper · Two Chairs",
      x: -1066.8, z: -24.2, heading: -2.55, scale: 1.02, build: 1.04, fem: 0.12,
      skinHex: 0x402a1e, hair: "feltHat", hatHex: 0x282623, beard: true,
      outer: "duster", coatHex: 0x2a3136, shirtHex: 0x3d464c, trouserHex: 0x202528,
      pose: "screenWatch"
    },
    {
      id: "alma", name: "Alma", role: "East Apron Midwife · Seep Relay",
      x: 437.4, z: 36.2, heading: -2.35, scale: 0.97, build: 0.99, fem: 0.80,
      skinHex: 0x483124, hair: "shashWrap", wrapHex: 0xd0c9ba,
      outer: "shamma", coatHex: 0xa8a092, shirtHex: 0x3f3c38, trouserHex: 0x272625,
      enablePhoneLight: true, pose: "phoneGlow"
    }
  ];

  const AHIYA_CAST = [
    // 7. AHIYA HIGHLANDS NIGHT RIDGE, CROSS-BEACON, HILL ARCHIVE & DAYLIGHT COMPOUND
    {
      id: "saba", name: "Saba", role: "Basalt Pump Keeper · Gauge Thread",
      circuit: "ahiya", x: -1458.4, z: 761.8, heading: -0.95, scale: 0.98, build: 1.01, fem: 0.78,
      skinHex: 0x3e281c, hair: "shashWrap", wrapHex: 0xcac2b2,
      outer: "shamma", coatHex: 0x868074, shirtHex: 0x383a3c, trouserHex: 0x232527,
      pose: "idle"
    },
    {
      id: "rahel", name: "Rahel", role: "Night-Trail Escort · Glowing Phone",
      circuit: "ahiya", x: -1582.0, z: 623.0, heading: -2.50, scale: 0.92, build: 0.96, fem: 0.72,
      skinHex: 0x3b261b, hair: "croppedCoily", hairHex: 0x141210,
      outer: "shamma", coatHex: 0xbab4a6, shirtHex: 0x2c3440, trouserHex: 0x1e2228,
      enablePhoneLight: true, pose: "convoyWalk"
    },
    {
      id: "escort_yared", name: "Yared", role: "Ahiya Youth · Filming Convoy",
      circuit: "ahiya", x: -1580.6, z: 625.2, heading: -2.50, scale: 0.84, build: 0.94, fem: 0.20,
      skinHex: 0x392419, hair: "croppedCoily", hairHex: 0x141210,
      outer: "shamma", coatHex: 0xaeb0a8, shirtHex: 0x262e3a, trouserHex: 0x1c2026,
      tibebTrim: true, enablePhoneLight: true, pose: "filmConvoy"
    },
    {
      id: "convoy_elder_1", name: "Abba Gebre", role: "Night Ridge Elder · Gabi Procession",
      circuit: "ahiya", x: -1578.2, z: 628.4, heading: -2.50, scale: 1.02, build: 1.04, fem: 0.10,
      skinHex: 0x3e281b, hair: "turban", wrapHex: 0x625a4c, beard: true, hairHex: 0x181513,
      outer: "shamma", coatHex: 0xbeb6a4, shirtHex: 0x524536, trouserHex: 0x232526,
      pose: "convoyWalk"
    },
    {
      id: "convoy_elder_2", name: "Memhir Solomon", role: "Night Ridge Carrier · Signal Witness",
      circuit: "ahiya", x: -1575.8, z: 631.5, heading: -2.50, scale: 1.00, build: 1.02, fem: 0.12,
      skinHex: 0x422b1e, hair: "croppedCoily", beard: true, hairHex: 0x171412,
      outer: "shamma", coatHex: 0xa69e8e, shirtHex: 0x4a3f33, trouserHex: 0x212426,
      pose: "filmConvoy"
    },
    {
      id: "aunt_lemlem", name: "Aunt Lemlem", role: "Singer · AR–03 Live Answer",
      circuit: "ahiya", x: -1612.2, z: 592.2, heading: 0.45, scale: 0.96, build: 1.02, fem: 0.84,
      skinHex: 0x452f22, hair: "shashWrap", wrapHex: 0xdad3c4,
      outer: "shamma", coatHex: 0xc6bfb0, shirtHex: 0x443a34, trouserHex: 0x282523,
      pose: "auntSing"
    },
    {
      id: "ppc_op_male", name: "bekele_ppc", displayName: "Daniel (REC PPC Log)", role: "Hill Archive Clipboard Operator",
      circuit: "ahiya", x: -1765.85, z: 541.55, heading: Math.PI * 0.82, scale: 1.01, build: 1.05, fem: 0.08,
      skinHex: 0x9b7862, hair: "glassesCrop", hairHex: 0x221b16,
      outer: "none", shirtHex: 0x1d2836, trouserHex: 0x22262b,
      rolledSleeves: true, pose: "recDesk"
    },
    {
      id: "ppc_op_female", name: "hanna_ppc", displayName: "Hanna (REC PPC Dispatch)", role: "Hill Archive Radio & Monitor",
      circuit: "ahiya", x: -1764.15, z: 541.55, heading: -Math.PI * 0.82, scale: 0.97, build: 0.97, fem: 0.80,
      skinHex: 0xa27e68, hair: "ponytail", hairHex: 0x3b2a1e,
      outer: "none", shirtHex: 0x1b2634, trouserHex: 0x202429,
      rolledSleeves: true, pose: "recDesk"
    },
    // Daylight Compound 2-Person 20 L Jerrycan Unload, Terracotta Bowl Pour & Tablet Youth (-1680, 775)
    {
      id: "compound_lead", name: "Tesfaye", role: "Compound Carrier · 20 L Unload & Pour",
      circuit: "ahiya", x: -1682.15, z: 774.25, heading: 1.55, scale: 1.01, build: 1.04, fem: 0.10,
      skinHex: 0x3d271b, hair: "croppedCoily", beard: true, hairHex: 0x151210,
      outer: "shamma", coatHex: 0x6c655b, shirtHex: 0x4c4034, trouserHex: 0x212324,
      pose: "unloadHandoff"
    },
    {
      id: "compound_partner", name: "Abba Desta", role: "Courtyard Elder · Hitch & Handoff",
      circuit: "ahiya", x: -1681.55, z: 774.75, heading: -1.65, scale: 0.99, build: 1.02, fem: 0.12,
      skinHex: 0x432c1f, hair: "turban", wrapHex: 0xbcb3a2, beard: true, hairHex: 0x1c1917,
      outer: "shamma", coatHex: 0xbab1a0, shirtHex: 0x56483a, trouserHex: 0x262523,
      pose: "unloadHandoff"
    },
    {
      id: "compound_child", name: "Biruk", role: "Courtyard Youth · Cyan Field Tablet",
      circuit: "ahiya", x: -1683.55, z: 775.58, heading: 2.15, scale: 0.78, build: 0.95, fem: 0.22,
      skinHex: 0x3e281c, hair: "shortLocs", hairHex: 0x151210,
      outer: "none", shirtHex: 0xb5a68e, trouserHex: 0x2a2926,
      tibebTrim: true, isTablet: true, enablePhoneLight: true, pose: "tabletWatch"
    }
  ];

  function makeExpeditionCast(T, opts = {}) {
    const assets = getSharedAssets(T, opts.textureBase || opts.assetPath);
    const group = new T.Group();
    if (opts.parent) opts.parent.add(group);
    const rawSurfaceAt = opts.surfaceAt || (() => 0);
    // Respect Daylight Compound flat basalt pad (+0.52m above analytic center) so boots & cans never clip coarse terrain
    const surfaceAt = (x, z) => (
      Math.abs(x - (-1680)) < 7.4 && Math.abs(z - 775) < 6.2
        ? Math.max(rawSurfaceAt(x, z), rawSurfaceAt(-1680, 775) + 0.52)
        : rawSurfaceAt(x, z)
    );

    const specs = opts.hasAhiya ? BASE_CAST.concat(AHIYA_CAST) : BASE_CAST;
    const list = [];
    const byId = {};

    for (const raw of specs) {
      const sp = Object.assign({}, raw, {
        name: raw.displayName || raw.name,
        textureBase: opts.textureBase || opts.assetPath
      });
      const ch = makeExpeditionCharacter(T, sp);
      ch.place(sp.x, sp.z, sp.heading, surfaceAt);
      group.add(ch.group);
      list.push(ch);
      byId[sp.id] = ch;
    }

    /* --- Shared Daylight Compound 20 L Unload, Sisal Hitch & Terracotta Bowl Pour Rig --- */
    const sharedUnload = build20LWaterWifiCan(T, assets, true);
    sharedUnload.canRoot.visible = false;
    sharedUnload.rippleGrp.visible = false;
    group.add(sharedUnload.canRoot);
    group.add(sharedUnload.rippleGrp);

    // Dynamic braided sisal saddle-hitch rope for Phase A (untie)
    const hitchPts = Array.from({ length: 7 }, () => new T.Vector3());
    const hitchGeo = new T.BufferGeometry();
    hitchGeo.setAttribute("position", new T.Float32BufferAttribute(new Float32Array(7 * 3), 3));
    const hitchLine = new T.Line(hitchGeo, new T.LineBasicMaterial({ color: 0xcab892 }));
    const hitchLoop = new T.Mesh(
      new T.TorusGeometry(0.11, 0.011, 6, 18),
      assets.sisalMat
    );
    hitchLoop.visible = false;
    hitchLine.visible = false;
    group.add(hitchLoop);
    group.add(hitchLine);

    const gripWLeadL = new T.Vector3();
    const gripWLeadR = new T.Vector3();
    const gripWPartL = new T.Vector3();
    const gripWPartR = new T.Vector3();
    let lastUnloadStamp = -999;

    /* Synchronized 10-second loop at Daylight Compound (-1680, 775):
       0.00..0.22: untie sisal hitch at saddle -> 0.22..0.46: two-person 20kg heave & lower ->
       0.46..0.66: two-person walk carry to terracotta bowl (-1680.85, 774.35) ->
       0.66..0.91: tilt & pour churning cyan water arc + 3 expanding ripple rings ->
       0.91..1.00: right can & step back to complete loop. */
    function stepCompoundUnload(dt, nowSec, cfg = {}) {
      const lead = byId[cfg.leadId || "compound_lead"] || byId.saba;
      const partner = byId[cfg.partnerId || "compound_partner"] || byId.escort_yared;
      const child = byId[cfg.childId || "compound_child"];
      if (!lead || !partner) return;

      lastUnloadStamp = nowSec;
      const u = cfg.phase !== undefined ? clamp(cfg.phase, 0, 0.999) : frac(nowSec / 10.0);
      const sPos = cfg.saddlePos || { x: -1682.45, z: 774.48 };
      const bPos = cfg.bowlPos   || { x: -1680.85, z: 774.35 };
      // Always anchor padY to rawSurfaceAt(-1680, 775) + 0.52 (never double-adding if caller passed pre-offset compSurf!)
      const padY = rawSurfaceAt(-1680, 775) + 0.52;
      const compSurf = (x, z) => Math.max(rawSurfaceAt(x, z), padY);

      const sY = compSurf(sPos.x, sPos.z);
      const bY = compSurf(bPos.x, bPos.z);

      // Smooth trajectory parameter from saddle (0) to bowl (1) and back (0)
      const moveToBowl = smooth(0.42, 0.66, u) * (1 - smooth(0.90, 0.99, u));
      const heavePeak  = smooth(0.20, 0.30, u) * (1 - smooth(0.32, 0.46, u));
      const lowered    = smooth(0.32, 0.46, u) * (1 - smooth(0.90, 0.98, u));
      const pourK      = smooth(0.66, 0.74, u) * (1 - smooth(0.87, 0.92, u));
      const untieK     = 1 - smooth(0.18, 0.25, u);

      // Shared 20 L WATER = WIFI jerrycan world position & tilt on flat COMPOUND_PAD_Y (rim = bY + 0.30, meniscus = bY + 0.23)
      const canX = lerp(sPos.x + 0.12, bPos.x - 0.04, moveToBowl);
      const canZ = lerp(sPos.z - 0.06, bPos.z - 0.36, moveToBowl);
      const baseGround = lerp(sY, bY, moveToBowl);
      const canY = baseGround + lerp(1.06, 0.78, lowered) + heavePeak * 0.14 + pourK * 0.04;

      sharedUnload.canRoot.visible = true;
      sharedUnload.canRoot.position.set(canX, canY, canZ);
      // Orient spout (+Z in can local space) toward +Z South directly into the terracotta bowl center (bPos.x, bPos.z)!
      const canYaw = lerp(0.55, 0.10, smooth(0.35, 0.66, u));
      const canPitch = pourK * 0.92 - heavePeak * 0.10;
      sharedUnload.canRoot.rotation.set(canPitch, canYaw, 0, "YXZ");
      sharedUnload.canRoot.updateMatrixWorld(true);

      // Sisal hitch rope taut to saddle during untie phase
      hitchLoop.visible = untieK > 0.02;
      hitchLine.visible = untieK > 0.02;
      if (hitchLoop.visible) {
        const pull = Math.sin(nowSec * 6.2) * 0.025 * untieK;
        hitchLoop.position.set(canX - 0.04, canY + 0.19 + pull, canZ);
        hitchLoop.rotation.set(0.8, 0.4, pull * 4);
        const pArr = hitchGeo.attributes.position.array;
        const anchorX = sPos.x - 0.52, anchorY = sY + 1.14, anchorZ = sPos.z + 0.05;
        for (let k = 0; k < 7; k++) {
          const fk = k / 6;
          pArr[k * 3]     = lerp(anchorX, canX - 0.02, fk);
          pArr[k * 3 + 1] = lerp(anchorY, canY + 0.20, fk) - Math.sin(fk * Math.PI) * (0.04 + (1 - untieK) * 0.18) + pull;
          pArr[k * 3 + 2] = lerp(anchorZ, canZ, fk);
        }
        hitchGeo.attributes.position.needsUpdate = true;
      }

      // Dynamic gravity-parabolic pouring stream, aerated core, expanding concentric ripples & splash droplets inside terracotta bowl!
      if (sharedUnload.stepBallisticPour) {
        sharedUnload.stepBallisticPour(nowSec, pourK, group, bY + 0.236, { x: bPos.x, z: bPos.z });
      }
      if (sharedUnload.innerLiq) {
        sharedUnload.innerLiq.scale.y = lerp(0.98, 0.64, smooth(0.66, 0.90, u));
      }

      // Extract exact 3D world grip positions on the shared 20L jerrycan
      sharedUnload.gripLeadL.getWorldPosition(gripWLeadL);
      sharedUnload.gripLeadR.getWorldPosition(gripWLeadR);
      sharedUnload.gripPartnerL.getWorldPosition(gripWPartL);
      sharedUnload.gripPartnerR.getWorldPosition(gripWPartR);

      if (untieK > 0.45) {
        const knotJiggle = Math.sin(nowSec * 5.8) * 0.03;
        gripWLeadL.set(canX - 0.05, canY + 0.21 + knotJiggle, canZ - 0.03);
        gripWLeadR.set(canX - 0.02, canY + 0.18 - knotJiggle, canZ + 0.04);
      }

      // Stage Lead Carrier (Left-North of can) and Partner Elder (Right-North of can) facing the can, bowl & camera cleanly!
      const leadX = canX - 0.40, leadZ = canZ - 0.16;
      const partX = canX + 0.40, partZ = canZ - 0.16;
      const leadHdg = Math.atan2(canX - leadX, (canZ + 0.12) - leadZ);
      const partHdg = Math.atan2(canX - partX, (canZ + 0.12) - partZ);

      if (lead.group.parent !== group) group.add(lead.group);
      if (partner.group.parent !== group) group.add(partner.group);
      lead.group.visible = true;
      partner.group.visible = true;
      lead.place(leadX, leadZ, leadHdg, compSurf);
      partner.place(partX, partZ, partHdg, compSurf);

      lead.update(dt, nowSec, {
        pose: pourK > 0.25 ? "pourBowl" : "unloadHandoff",
        _sharedUnload: true,
        unloadRole: "lead",
        unloadPhase: u,
        worldGripL: gripWLeadL,
        worldGripR: gripWLeadR,
        surfaceAt: compSurf,
        lookAt: pourK > 0.2 ? { x: bPos.x, y: bY + 0.25, z: bPos.z } : sharedUnload.canRoot.position
      });
      partner.update(dt, nowSec, {
        pose: "unloadHandoff",
        _sharedUnload: true,
        unloadRole: "partner",
        unloadPhase: u,
        worldGripL: gripWPartR,
        worldGripR: gripWPartL,
        surfaceAt: compSurf,
        lookAt: pourK > 0.2 ? { x: bPos.x, y: bY + 0.25, z: bPos.z } : sharedUnload.canRoot.position
      });

      if (child) {
        if (child.group.parent !== group) group.add(child.group);
        child.group.visible = true;
        const cx = cfg.childX !== undefined ? cfg.childX : (sPos.x - 1.05);
        const cz = cfg.childZ !== undefined ? cfg.childZ : (sPos.z + 1.10);
        const chdg = Math.atan2(bPos.x - cx, bPos.z - cz);
        child.place(cx, cz, chdg, compSurf);
        child.update(dt, nowSec, {
          pose: "tabletWatch",
          surfaceAt: compSurf,
          lookAt: sharedUnload.canRoot.position
        });
      }
    }

    /* --- Autonomous & Machinima Ahiya Night Ridge Walking Procession Spline --- */
    // Climbs SE -> NW (-1572, 636) -> (-1598, 603) directly over @np-arch's cyan Delaunay network lines toward Cross-Beacon (-1610, 590)!
    const CONVOY_WAYPOINTS = [
      [-1571.5, 636.5],
      [-1577.5, 629.0],
      [-1583.8, 621.2],
      [-1590.2, 613.2],
      [-1596.8, 605.0]
    ];
    const CONVOY_SLOTS = [
      { id: "rahel",          offset: 0.00, lat: -0.65, pose: "convoyWalk" },
      { id: "escort_yared",   offset: -0.09, lat:  0.72, pose: "filmConvoy" },
      { id: "convoy_elder_1", offset: -0.21, lat: -0.95, pose: "convoyWalk" },
      { id: "convoy_elder_2", offset: -0.32, lat:  0.88, pose: "filmConvoy" }
    ];

    function sampleConvoySpline(uRaw) {
      const u = clamp(uRaw, 0, 1);
      const segs = CONVOY_WAYPOINTS.length - 1;
      const f = u * segs, i = Math.min(segs - 1, Math.floor(f)), t = f - i;
      const p0 = CONVOY_WAYPOINTS[Math.max(0, i - 1)];
      const p1 = CONVOY_WAYPOINTS[i];
      const p2 = CONVOY_WAYPOINTS[i + 1];
      const p3 = CONVOY_WAYPOINTS[Math.min(segs, i + 2)];
      const x = catmull(p0[0], p1[0], p2[0], p3[0], t);
      const z = catmull(p0[1], p1[1], p2[1], p3[1], t);
      const dx = p2[0] - p1[0], dz = p2[1] - p1[1];
      const len = Math.hypot(dx, dz) || 1;
      return { x, z, hdg: Math.atan2(dx, dz), rx: dz / len, rz: -dx / len };
    }

    function stepConvoyProcession(dt, nowSec, cfg = {}) {
      const surf = cfg.surfaceAt || surfaceAt;
      const baseProg = cfg.progress !== undefined ? cfg.progress : frac(nowSec * 0.022);
      const beaconLook = { x: -1610, y: surf(-1610, 590) + 7.5, z: 590 };

      for (const slot of CONVOY_SLOTS) {
        const ch = byId[slot.id];
        if (!ch) continue;
        if (ch.group.parent !== group) group.add(ch.group);
        ch.group.visible = true;
        const u = cfg.progress !== undefined
          ? clamp(baseProg + slot.offset * 0.45, 0.02, 0.98)
          : frac(baseProg + slot.offset + 1.0);
        const pt = sampleConvoySpline(u);
        const wx = pt.x + pt.rx * slot.lat;
        const wz = pt.z + pt.rz * slot.lat;
        ch.place(wx, wz, pt.hdg, surf);
        ch.update(dt, nowSec, {
          pose: slot.pose,
          surfaceAt: surf,
          beatPulse: cfg.beatPulse || 0,
          lookAt: slot.pose === "filmConvoy" ? beaconLook : undefined
        });
      }
    }

    const packTarget = new T.Vector3();
    const camFwd = new T.Vector3();
    const toChar = new T.Vector3();
    const freePlayPumpGrips = {
      pumpGripL: new T.Vector3(),
      pumpGripR: new T.Vector3(),
      pumpGripWorld: new T.Vector3(),
      pumpBarDir: new T.Vector3()
    };

    const hideSharedUnload = () => {
      sharedUnload.canRoot.visible = false;
      sharedUnload.rippleGrp.visible = false;
      if (sharedUnload.streamMesh) sharedUnload.streamMesh.visible = false;
      if (sharedUnload.streamCoreMesh) sharedUnload.streamCoreMesh.visible = false;
      hitchLoop.visible = false;
      hitchLine.visible = false;
    };

    function update(dt, nowSec, worldCtx = {}) {
      const { state: ws, donkey, wagon, camera, machinimaActive, hideLabels } = worldCtx;

      // Auto-hide shared compound unload props if Machinima is running a different shot + apply finger distance LOD
      if (machinimaActive) {
        if (nowSec - lastUnloadStamp > 0.16) {
          hideSharedUnload();
        }
        for (const ch of list) {
          ch.label.sprite.visible = false;
          if (camera && ch.setFingerLod) {
            const d = Math.hypot(camera.position.x - ch.group.position.x, camera.position.z - ch.group.position.z);
            ch.setFingerLod(d < 15);
          }
        }
        return;
      }

      const dancing = ws && ws.danceTimer > 0;
      const beatPulse = ws ? (ws.beatPulse || 0) : 0;
      if (camera) camera.getWorldDirection(camFwd);

      // 1. Autonomous Daylight Compound 2-Person 20 L Unload & Bowl Pour in Free-Play
      const handledIds = new Set();
      if (opts.hasAhiya && !dancing) {
        const distCompound = camera ? Math.hypot(camera.position.x - (-1681), camera.position.z - 774.5) : 999;
        if (distCompound < 62) {
          stepCompoundUnload(dt, nowSec, { surfaceAt });
          handledIds.add("compound_lead");
          handledIds.add("compound_partner");
          handledIds.add("compound_child");
        } else {
          hideSharedUnload();
        }

        // 2. Autonomous Ahiya Night Ridge Walking Convoy in Free-Play
        const distRidge = camera ? Math.hypot(camera.position.x - (-1585), camera.position.z - 620) : 999;
        if (distRidge < 85) {
          stepConvoyProcession(dt, nowSec, { surfaceAt, beatPulse });
          for (const s of CONVOY_SLOTS) handledIds.add(s.id);
        }
      }

      // 3. Interactive Imani & June behavior in free gameplay
      const imani = byId.imani;
      const june = byId.june;
      if (imani && ws && donkey && wagon) {
        handledIds.add("imani");
        if (ws.drivingCart) {
          if (imani.group.parent !== wagon.chassis) {
            wagon.chassis.add(imani.group);
          }
          imani.group.visible = true;
          imani.group.position.set(0.38, 0.42, 0.28);
          imani.group.rotation.set(0, 0, 0, "YXZ");
          imani.update(dt, nowSec, { pose: "drive", steerAngle: wagon.steerAngle || 0, beatPulse, lodDist: 3 });
        } else {
          if (imani.group.parent !== group) {
            group.add(imani.group);
          }
          if (ws.riding || ws.gliding) {
            imani.group.visible = false;
          } else {
            imani.group.visible = true;
            const dImaniCam = camera ? Math.hypot(camera.position.x - imani.state.x, camera.position.z - imani.state.z) : 6;
            const dx = donkey.state.x, dz = donkey.state.z;
            const dNearOverlook = Math.hypot(dx - (-24), dz - (-3)) < 26;
            if (imani.state.scripted) {                                     // the game is staging this body (a can changing hands)
              imani.update(dt, nowSec, { ...imani.state.poseOpts, pose: imani.state.pose, surfaceAt, beatPulse, lodDist: dImaniCam });
            } else if (dancing) {
              imani.update(dt, nowSec, { pose: "eskista", surfaceAt, beatPulse, lookAt: camera?.position, lodDist: dImaniCam });
            } else if (ws.pumpFlow > 0.38 && Math.hypot(imani.state.x - (-22.2), imani.state.z - (-6.2)) < 8) {
              imani.place(-23.16, -6.20, Math.PI * 0.5, surfaceAt);
              const hasOv = typeof window !== "undefined" && typeof window.stepStandpipePump === "function" && window.__npStandpipePumps?.overlook;
              if (hasOv) {
                window.stepStandpipePump("overlook", ws.pumpLeverPhase, freePlayPumpGrips, { rawLeverSign: true, flowScale: ws.pumpFlow });
                imani.update(dt, nowSec, {
                  pose: "pump",
                  pumpPhase: freePlayPumpGrips.pumpPhase,
                  pumpGripL: freePlayPumpGrips.pumpGripL,
                  pumpGripR: freePlayPumpGrips.pumpGripR,
                  worldGripL: freePlayPumpGrips.pumpGripL,
                  worldGripR: freePlayPumpGrips.pumpGripR,
                  pumpGripWorld: freePlayPumpGrips.pumpGripWorld,
                  pumpBarDir: freePlayPumpGrips.pumpBarDir,
                  lookAt: freePlayPumpGrips.pumpGripWorld,
                  surfaceAt,
                  beatPulse,
                  lodDist: dImaniCam
                });
              } else {
                imani.update(dt, nowSec, { pose: "pump", pumpPhase: ws.pumpLeverPhase, surfaceAt, beatPulse, lodDist: dImaniCam });
              }
            } else if (dNearOverlook && Math.abs(donkey.state.speed) < 0.25) {
              const dh = donkey.state.heading;
              const sideX = Math.cos(dh), sideZ = -Math.sin(dh);
              const fwdX = Math.sin(dh), fwdZ = Math.cos(dh);
              const ix = dx + sideX * 0.88 - fwdX * 0.05;
              const iz = dz + sideZ * 0.88 - fwdZ * 0.05;
              const faceDonkey = Math.atan2(dx - ix, dz - iz);
              imani.place(ix, iz, faceDonkey, surfaceAt);
              packTarget.set(
                dx + sideX * 0.38 + fwdX * 0.04,
                donkey.group.position.y + 0.96,
                dz + sideZ * 0.38 + fwdZ * 0.04
              );
              imani.update(dt, nowSec, { pose: "touchPack", packTarget, surfaceAt, beatPulse, lookAt: donkey.group.position, lodDist: dImaniCam });
              if (june) {
                const jx = dx + sideX * 1.62 - fwdX * 0.35;
                const jz = dz + sideZ * 1.62 - fwdZ * 0.35;
                june.place(jx, jz, faceDonkey - 0.25, surfaceAt);
              }
            } else {
              imani.update(dt, nowSec, { pose: "idle", carryCan: true, surfaceAt, beatPulse, lookAt: donkey.group.position, lodDist: dImaniCam });
            }
          }
        }
      }

      for (const ch of list) {
        if (!ch.group.visible) continue;
        const distCam = camera ? Math.hypot(camera.position.x - ch.state.x, camera.position.z - ch.state.z) : 20;
        let aim = 1.0;
        if (camera && distCam > 0.01) {
          toChar.set(ch.state.x - camera.position.x, (ch.state.y + 1.5) - camera.position.y, ch.state.z - camera.position.z).normalize();
          aim = camFwd.dot(toChar);
        }
        const inActiveFrustum = distCam < 50 && !(distCam > 8 && aim < -0.15);
        if (ch.setFingerLod) ch.setFingerLod(distCam < 14 && aim > -0.20);

        if (!handledIds.has(ch.state.id) && inActiveFrustum) {
          const actPose = dancing && distCam < 38 ? "eskista" : ch.state.pose;
          const isScreenPose = actPose === "screenWatch" || actPose === "shadeScreen" || actPose === "recDesk";
          ch.update(dt, nowSec, {
            pose: actPose,
            surfaceAt,
            beatPulse,
            lodDist: distCam,
            lookAt: isScreenPose ? undefined : (distCam < 14 ? camera?.position : donkey?.group.position)
          });
        }

        if (hideLabels || !camera || distCam > 5.2 || (ws && (ws.drivingCart || ws.gliding))) {
          ch.label.sprite.visible = false;
        } else {
          const show = aim > 0.86;
          ch.label.sprite.visible = show;
          if (show) ch.label.mat.opacity = smooth(5.2, 3.4, distCam) * smooth(0.86, 0.94, aim) * 0.88;
        }
      }
    }

    function resetHomes() {
      hideSharedUnload();
      for (const ch of list) {
        if (ch.group.parent !== group) group.add(ch.group);
        ch.group.visible = true;
        ch.label.sprite.visible = false;
        ch.place(ch.state.homeX, ch.state.homeZ, ch.state.homeHeading, surfaceAt);
      }
    }

    function setDebugSkeleton(flag) {
      for (const ch of list) {
        if (ch.setDebugSkeleton) ch.setDebugSkeleton(flag);
      }
    }

    return {
      group,
      list,
      byId,
      update,
      resetHomes,
      setDebugSkeleton,
      stepCompoundUnload,
      stepConvoyProcession,
      sharedUnload
    };
  }

  makeExpeditionCharacter.applyCervicalLeanArc = applyCervicalLeanArc;
  makeExpeditionCharacter.resolveNeckLeanSpec = spec => {
    const ExpV4 = typeof window !== "undefined" ? window.HumanExpressionsV4 : null;
    if (ExpV4 && typeof ExpV4.resolveNeckLeanSpec === "function") return ExpV4.resolveNeckLeanSpec(spec);
    if (!spec) return null;
    if (typeof spec === "number") return { roll: spec, pitch: 0, yaw: 0, glideX: 0 };
    if (typeof spec === "object") return { roll: spec.roll || 0, pitch: spec.pitch || 0, yaw: spec.yaw || 0, glideX: spec.glideX || 0 };
    return null;
  };

  if (typeof window !== "undefined") {
    window.makeExpeditionCharacter = makeExpeditionCharacter;
    window.makeExpeditionCast = makeExpeditionCast;
    // THE ONE CAST. Every world builds its people from these specs, so Imani is the same Imani everywhere.
    // CAST_2086.make(THREE, "imani") -> a character; CAST_2086.specs lists everyone; CAST_2086.get(id) returns a copy of one spec.
    window.CAST_2086 = {
      specs: BASE_CAST.concat(AHIYA_CAST),
      get(id) { const s = BASE_CAST.concat(AHIYA_CAST).find(c => c.id === id); return s ? Object.assign({}, s) : null; },
      make(T, id, extra) { const s = this.get(id); return s ? makeExpeditionCharacter(T, Object.assign({ textureBase: resolveDonkeyBase() }, s, extra || {})) : null; },
      donkey: { name: "Mistletoe", note: "the gray pack donkey: window.makeDonkey({ assetPath: '../donkey/' })" }
    };
    window.applyCervicalLeanArc = applyCervicalLeanArc;
    window.makeWaterWifiCan = (T, opts = {}) =>
      build20LWaterWifiCan(T, getSharedAssets(T, opts.textureBase || opts.assetPath), opts.withPourAndRipples !== false);
  }
})();
