/* Expedition & 2086 Night Post Human Cast — Sculpted SkinnedMesh + 2-Bone Analytic IK.
   Built with the exact Catmull-Rom refine + loft + Gaussian sculpt + noiseTexture + Skeleton
   architecture of donkey/donkey.js and faithful to the 2086 Donkey Water World Bible plates.
   Exposes window.makeExpeditionCharacter(THREE, spec) and window.makeExpeditionCast(THREE, opts). */
(function () {
  "use strict";

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
     are strictly counter-clockwise on FrontSide.
     Each ring: { p:[x,y,z], w (half-width X), f (front +Z), b (back -Z), e (superellipse exp), tw, bw } */
  function loftY(T, rings, o = {}) {
    const seg = o.seg || 28, n = rings.length, cols = seg + 1;
    const pos = [], uv = [], col = o.color ? [] : null, si = o.skin ? [] : null, sw = o.skin ? [] : null, idx = [];
    const ur = o.ur || 2, vr = o.vr || 3;
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
        pos.push(r.p[0] + lx, r.p[1] + ly, r.p[2] + lz);
        uv.push((j / seg) * ur, v * vr);
        if (col) {
          const c = o.color(r, sa, ca, v, lx, lz);
          if (Array.isArray(c)) col.push(c[0], c[1], c[2]);
          else col.push(c, c, c);
        }
        if (si) {
          const sk = o.skin(r, sa, ca, v, lx, lz);
          const b0 = sk[0] | 0, b1 = sk[1] | 0, wt = clamp(sk[2], 0, 1);
          const b2 = sk.length > 3 ? (sk[3] | 0) : 0, wt2 = sk.length > 4 ? clamp(sk[4], 0, 1) : 0;
          const rem = Math.max(0, 1 - wt2);
          si.push(b0, b1, b2, 0);
          sw.push(wt * rem, (1 - wt) * rem, wt2, 0);
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
    return g;
  }

  /* Open-front draped coat / shawl loft (a from a0 to a1, double-walled with real cloth thickness) */
  function loftOpenGarment(T, rings, o = {}) {
    const seg = o.seg || 30, n = rings.length, cols = seg + 1;
    const a0 = o.a0 !== undefined ? o.a0 : 0.42;        // open front gap around a = 0 (+Z)
    const a1 = o.a1 !== undefined ? o.a1 : TAU - 0.42;
    const thick = o.thick || 0.012;
    const pos = [], uv = [], col = o.color ? [] : null, si = o.skin ? [] : null, sw = o.skin ? [] : null, idx = [];
    const ur = o.ur || 3, vr = o.vr || 3;

    // Outer shell (layer 0) + inner lining (layer 1)
    for (let layer = 0; layer < 2; layer++) {
      const sh = layer === 0 ? 0 : -thick;
      for (let i = 0; i < n; i++) {
        const r = rings[i], e = r.e || 1.0, v = i / Math.max(1, n - 1);
        for (let j = 0; j <= seg; j++) {
          const u = j / seg, a = lerp(a0, a1, u), sa = Math.sin(a), ca = Math.cos(a);
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
            const sc = o.sculpt(r, u, v, sa, ca);
            lx += sc[0]; ly += sc[1]; lz += sc[2];
          }
          pos.push(r.p[0] + lx, r.p[1] + ly, r.p[2] + lz);
          uv.push(u * ur, v * vr);
          if (col) {
            const c = o.color(r, u, v, sa, ca, layer);
            if (Array.isArray(c)) col.push(c[0], c[1], c[2]);
            else col.push(c * (layer ? 0.72 : 1), c * (layer ? 0.72 : 1), c * (layer ? 0.72 : 1));
          }
          if (si) {
            const sk = o.skin(r, sa, ca, v, u);
            const b0 = sk[0] | 0, b1 = sk[1] | 0, wt = clamp(sk[2], 0, 1);
            const b2 = sk.length > 3 ? (sk[3] | 0) : 0, wt2 = sk.length > 4 ? clamp(sk[4], 0, 1) : 0;
            const rem = Math.max(0, 1 - wt2);
            si.push(b0, b1, b2, 0);
            sw.push(wt * rem, (1 - wt) * rem, wt2, 0);
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
    // Stitch front lapel edges (j = 0 and j = seg) + bottom hem (i = 0) + collar top (i = n - 1)
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
    const idx = [];
    let vo = 0;
    for (const g of geos) {
      const p = g.attributes.position.array;
      const n = g.attributes.normal.array;
      const u = g.attributes.uv ? g.attributes.uv.array : null;
      const c = g.attributes.color ? g.attributes.color.array : null;
      const si = g.attributes.skinIndex ? g.attributes.skinIndex.array : null;
      const sw = g.attributes.skinWeight ? g.attributes.skinWeight.array : null;
      const cnt = g.attributes.position.count;
      pos.set(p, vo * 3);
      nrm.set(n, vo * 3);
      if (u) uvs.set(u, vo * 2);
      if (c) col.set(c, vo * 3);
      else col.fill(1, vo * 3, (vo + cnt) * 3);
      if (si) ski.set(si, vo * 4);
      if (sw) skw.set(sw, vo * 4);
      else for (let k = 0; k < cnt; k++) skw[(vo + k) * 4] = 1;
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

  /* ---------- Cached Procedural Surface Textures (Shared Across Cast) ---------- */
  let sharedCache = null;
  function getSharedAssets(T) {
    if (sharedCache) return sharedCache;
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

    // 1. Skin micro-pore & dermal grain
    const skinBump = makeTex(192, (u, v) => {
      const pore = vnoise(u * 130, v * 130);
      const grain = fbm(u * 32, v * 48, 3);
      return 0.48 + 0.28 * grain - 0.18 * Math.pow(pore, 3);
    }, 3, 3);

    // 2. Heavy waxed oilskin / weathered canvas duster (Imani & June coats)
    const oilskinTex = makeTex(256, (u, v) => {
      const warp = Math.sin(u * TAU * 64) * 0.5 + 0.5;
      const weft = Math.sin(v * TAU * 64) * 0.5 + 0.5;
      const weave = 0.5 + 0.12 * (warp * 0.6 + weft * 0.4 - 0.5);
      const crease = Math.abs(fbm(u * 9, v * 14, 4) - 0.5) * 0.9;
      const scuff = fbm(u * 24 + 3.1, v * 24 + 7.4, 3);
      return clamp(weave - crease * 0.34 + (scuff - 0.5) * 0.28, 0.15, 0.95);
    }, 4, 5);

    // 3. Hand-loomed Ethiopian shamma / gabi cotton gauze + subtle tibeb border band
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

    // 6. Realistic glossy human eye texture (crisp sclera whites + warm dark iris + catchlight)
    const ec = document.createElement("canvas");
    ec.width = ec.height = 96;
    const ex = ec.getContext("2d");
    ex.fillStyle = "#f0ebe2";
    ex.fillRect(0, 0, 96, 96);
    const sg = ex.createRadialGradient(48, 48, 14, 48, 48, 48);
    sg.addColorStop(0, "rgba(244,240,232,0)");
    sg.addColorStop(0.72, "rgba(218,208,198,0.28)");
    sg.addColorStop(1, "rgba(168,148,138,0.55)");
    ex.fillStyle = sg;
    ex.fillRect(0, 0, 96, 96);
    const ig = ex.createRadialGradient(48, 48, 3, 48, 48, 13.5);
    ig.addColorStop(0, "#070606");
    ig.addColorStop(0.38, "#18120d");
    ig.addColorStop(0.78, "#4a3222");
    ig.addColorStop(0.95, "#19120e");
    ig.addColorStop(1, "rgba(25,18,14,0)");
    ex.fillStyle = ig;
    ex.beginPath(); ex.arc(48, 48, 13.5, 0, TAU); ex.fill();
    ex.fillStyle = "#050505";
    ex.beginPath(); ex.arc(48, 48, 5.8, 0, TAU); ex.fill();
    ex.fillStyle = "rgba(242,250,255,0.92)";
    ex.beginPath(); ex.arc(44, 43, 2.6, 0, TAU); ex.fill();
    const eyeTex = new T.CanvasTexture(ec);
    if (T.SRGBColorSpace) eyeTex.colorSpace = T.SRGBColorSpace;

    // 7. Soft contact shadow under feet
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
      skinBump, oilskinTex, shammaTex, twillTex, hairBump, eyeTex, shadowTex,
      eyeMat: new T.MeshPhysicalMaterial({ map: eyeTex, roughness: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.06 }),
      leatherDark: new T.MeshStandardMaterial({ color: 0x231d18, roughness: 0.68, bumpMap: oilskinTex, bumpScale: 0.015 }),
      leatherWorn: new T.MeshStandardMaterial({ color: 0x3a2d22, roughness: 0.74, bumpMap: oilskinTex, bumpScale: 0.018 }),
      bootSoleMat: new T.MeshStandardMaterial({ color: 0x161615, roughness: 0.92 }),
      steelToolMat: new T.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.34, metalness: 0.82 }),
      ironDarkMat: new T.MeshStandardMaterial({ color: 0x2c3032, roughness: 0.52, metalness: 0.64 }),
      enamelCupMat: new T.MeshStandardMaterial({ color: 0xdcd7cb, roughness: 0.44, metalness: 0.08 }),
      enamelRimMat: new T.MeshStandardMaterial({ color: 0x2b363b, roughness: 0.42, metalness: 0.25 }),
      tinMugMat: new T.MeshStandardMaterial({ color: 0x9fa5a8, roughness: 0.36, metalness: 0.76 }),
      cyanWaterMat: new T.MeshPhysicalMaterial({
        color: 0x3fd8e8, emissive: 0x1498b8, emissiveIntensity: 0.85,
        roughness: 0.14, transmission: 0.32, transparent: true, opacity: 0.92
      }),
      phoneBodyMat: new T.MeshStandardMaterial({ color: 0x15181b, roughness: 0.38, metalness: 0.45 }),
      phoneScreenMat: new T.MeshBasicMaterial({ color: 0x7ce8ff }),
      paperMat: new T.MeshStandardMaterial({ color: 0xe6e0d2, roughness: 0.88, side: T.DoubleSide }),
      ledgerMat: new T.MeshStandardMaterial({ color: 0x4b3f33, roughness: 0.84, bumpMap: oilskinTex, bumpScale: 0.014 }),
      woodChairMat: new T.MeshStandardMaterial({ color: 0x4d3b2b, roughness: 0.86, bumpMap: twillTex, bumpScale: 0.02 }),
      penBlueMat: new T.MeshStandardMaterial({ color: 0x1d4ea8, roughness: 0.4 })
    };
    return sharedCache;
  }

  /* ---------- Bone Indices (24-Bone Articulated Human Skeleton) ---------- */
  const B_ROOT   = 0;
  const B_PELVIS = 1;
  const B_SPINE  = 2;
  const B_CHEST  = 3;
  const B_NECK   = 4;
  const B_HEAD   = 5;
  const B_JAW    = 6;
  const B_CLAV_L = 7,  B_UARM_L = 8,  B_FARM_L = 9,  B_HAND_L = 10;
  const B_CLAV_R = 11, B_UARM_R = 12, B_FARM_R = 13, B_HAND_R = 14;
  const B_ULEG_L = 15, B_LLEG_L = 16, B_FOOT_L = 17;
  const B_ULEG_R = 18, B_LLEG_R = 19, B_FOOT_R = 20;
  const B_COAT_B = 21, B_COAT_L = 22, B_COAT_R = 23;

  /* ---------- Exact Orthonormal 2-Bone Analytic IK (Zero Gimbal Lock, Exact Bind Identity) ---------- */
  const _vS = { x: 0, y: 0, z: 0 };
  function makeIKScratch(T) {
    return {
      mInv: new T.Matrix4(),
      mUpper: new T.Matrix4(),
      mLower: new T.Matrix4(),
      qUpper: new T.Quaternion(),
      qUpperInv: new T.Quaternion(),
      qLowerWorld: new T.Quaternion(),
      S: new T.Vector3(),
      Tgt: new T.Vector3(),
      Pole: new T.Vector3(),
      D: new T.Vector3(),
      uD: new T.Vector3(),
      N: new T.Vector3(),
      uP: new T.Vector3(),
      J: new T.Vector3(),
      dir1: new T.Vector3(),
      dir2: new T.Vector3(),
      xAx: new T.Vector3(),
      yAx: new T.Vector3(),
      zAx: new T.Vector3(),
      yAx2: new T.Vector3(),
      zAx2: new T.Vector3()
    };
  }

  /* Solves a 2-bone chain whose bind-pose segments point strictly along local -Y (0, -L1, 0) & (0, -L2, 0),
     and whose bind-pose local +Z is front.
     poleSign = +1 when joint bends toward +Z (knees), -1 when joint bends toward -Z (elbows). */
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

    // Pole vector in parent space (normalized)
    ik.Pole.copy(poleLocalDir).normalize();
    // Bend direction in plane
    ik.N.crossVectors(ik.uD, ik.Pole);
    if (ik.N.lengthSq() < 1e-6) ik.N.set(1, 0, 0);
    else ik.N.normalize();
    ik.uP.crossVectors(ik.N, ik.uD).normalize(); // strictly toward Pole perpendicular to uD

    const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

    // Joint position in parent space
    ik.J.copy(ik.S)
      .addScaledVector(ik.uD, cosA * L1)
      .addScaledVector(ik.uP, sinA * L1);

    // Upper bone basis: yAx = -dir1 (points up from joint to root); xAx aligned so bind pose is identity
    ik.dir1.subVectors(ik.J, ik.S).normalize();
    ik.yAx.copy(ik.dir1).negate();
    // Front reference is +Pole for knees (poleSign > 0) or -Pole for elbows (poleSign < 0)
    if (poleSign > 0) ik.xAx.copy(ik.N).negate();
    else ik.xAx.copy(ik.N);
    // Gram-Schmidt orthogonalize xAx against yAx
    ik.xAx.addScaledVector(ik.yAx, -ik.xAx.dot(ik.yAx));
    if (ik.xAx.lengthSq() < 1e-6) ik.xAx.set(1, 0, 0);
    else ik.xAx.normalize();
    ik.zAx.crossVectors(ik.xAx, ik.yAx).normalize();

    ik.mUpper.makeBasis(ik.xAx, ik.yAx, ik.zAx);
    ik.qUpper.setFromRotationMatrix(ik.mUpper);
    upperBone.quaternion.copy(ik.qUpper);

    // Lower bone basis along J -> Tgt (with clamped reach target S + uD * d)
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

  /* ---------- Sculpted Hand & Boot Sub-Builders ---------- */
  function buildSculptedHand(T, side, skinMat, sleeveCuffMat) {
    const g = new T.Group();
    // Cuff ring at wrist
    if (sleeveCuffMat) {
      const cuff = new T.Mesh(new T.CylinderGeometry(0.038, 0.035, 0.036, 12), sleeveCuffMat);
      cuff.position.set(0, 0.012, 0);
      g.add(cuff);
    }
    // Sculpted palm / metacarpals
    const palm = new T.Mesh(roundedBox(T, 0.026, 0.074, 0.068, 0.010, 2), skinMat);
    palm.position.set(0, -0.036, 0.004);
    g.add(palm);

    const fingers = [];
    const fSpecs = [
      [-0.024, 0.064, 0.0095], // index
      [-0.008, 0.070, 0.0100], // middle
      [ 0.008, 0.065, 0.0095], // ring
      [ 0.023, 0.054, 0.0085]  // little
    ];
    for (const [fz, flen, frad] of fSpecs) {
      const piv = new T.Group();
      piv.position.set(0, -0.070, 0.004 - fz * side);
      const prox = new T.Mesh(new T.CapsuleGeometry(frad, flen * 0.48, 4, 8), skinMat);
      prox.position.set(0, -flen * 0.26, 0);
      piv.add(prox);
      const distPiv = new T.Group();
      distPiv.position.set(0, -flen * 0.52, 0);
      const dist = new T.Mesh(new T.CapsuleGeometry(frad * 0.86, flen * 0.40, 4, 8), skinMat);
      dist.position.set(0, -flen * 0.22, 0);
      distPiv.add(dist);
      piv.add(distPiv);
      g.add(piv);
      fingers.push({ piv, distPiv, side });
    }
    // Opposable thumb
    const thumbPiv = new T.Group();
    thumbPiv.position.set(-side * 0.008, -0.028, 0.034);
    thumbPiv.rotation.set(0.45, 0, -side * 0.35);
    const thumbM = new T.Mesh(new T.CapsuleGeometry(0.0105, 0.040, 4, 8), skinMat);
    thumbM.position.set(0, -0.024, 0);
    thumbPiv.add(thumbM);
    g.add(thumbPiv);

    g.userData.setCurl = curl => {
      for (let i = 0; i < fingers.length; i++) {
        const f = fingers[i];
        const c = curl * (0.92 + i * 0.06);
        f.piv.rotation.z = f.side * c * 1.05;
        f.distPiv.rotation.z = f.side * c * 1.15;
      }
      thumbPiv.rotation.z = -side * (0.32 - curl * 0.65);
      thumbPiv.rotation.x = 0.45 - curl * 0.25;
    };
    return g;
  }

  function buildLacedWorkBoot(T, side, assets) {
    const bootG = new T.Group();
    // Lofted leather upper + toe box from sole (y = -0.075) to ankle cuff (y = +0.065)
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

    // Lugged sole & heel block
    const soleRings = [
      { p: [0, -0.085, 0.048], w: 0.054, f: 0.124, b: 0.093, e: 0.68 },
      { p: [0, -0.068, 0.048], w: 0.054, f: 0.124, b: 0.093, e: 0.68 }
    ];
    bootG.add(new T.Mesh(loftY(T, soleRings, { seg: 20 }), assets.bootSoleMat));

    // Cross-laces up the instep
    for (let i = 0; i < 4; i++) {
      const ly = -0.018 + i * 0.020, lz = 0.078 - i * 0.011;
      const lace = new T.Mesh(roundedBox(T, 0.046, 0.006, 0.010, 0.002, 1), assets.leatherDark);
      lace.position.set(0, ly, lz);
      lace.rotation.z = (i % 2 ? 1 : -1) * 0.16;
      bootG.add(lace);
    }
    return bootG;
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

  /* ---------- Build One High-Resolution Sculpted SkinnedMesh Character ---------- */
  function makeExpeditionCharacter(T, spec = {}) {
    const assets = getSharedAssets(T);
    const group = new T.Group();
    const scale = spec.scale || 1.0;
    const build = spec.build || 1.0;      // shoulder/hip breadth multiplier
    const fem = spec.fem !== undefined ? spec.fem : 0.65;

    // Materials tailored to character palette & 2086 silver-gelatin reference plates (luminous midtone skin sheen)
    const skinBase = new T.Color(spec.skinHex !== undefined ? spec.skinHex : 0x5c4030);
    skinBase.offsetHSL(0, -0.04, 0.09); // lift Zone II shadows to rich Zone IV-V silver-gelatin facial planes
    const skinMat = new T.MeshPhysicalMaterial({
      color: skinBase,
      vertexColors: true,
      roughness: 0.52,
      metalness: 0.02,
      sheen: 0.42,
      sheenRoughness: 0.52,
      sheenColor: new T.Color(0xb89682),
      bumpMap: assets.skinBump,
      bumpScale: 0.009
    });
    const skinMatPlain = skinMat.clone();
    skinMatPlain.vertexColors = false;

    const shirtCol = new T.Color(spec.shirtHex !== undefined ? spec.shirtHex : 0x626662);
    shirtCol.offsetHSL(0, -0.02, 0.12);
    const shirtMat = new T.MeshStandardMaterial({
      color: shirtCol,
      vertexColors: true,
      roughness: 0.84,
      map: assets.twillTex,
      bumpMap: assets.twillTex,
      bumpScale: 0.022
    });

    const trouserCol = new T.Color(spec.trouserHex !== undefined ? spec.trouserHex : 0x4b4f50);
    trouserCol.offsetHSL(0, -0.02, 0.12);
    const trouserMat = new T.MeshStandardMaterial({
      color: trouserCol,
      vertexColors: true,
      roughness: 0.86,
      map: assets.twillTex,
      bumpMap: assets.twillTex,
      bumpScale: 0.025
    });

    const outerStyle = spec.outer || "duster"; // "duster" | "parka" | "shamma" | "vest" | "apron" | "none"
    const outerTex = outerStyle === "shamma" ? assets.shammaTex : assets.oilskinTex;
    const coatCol = new T.Color(spec.coatHex !== undefined ? spec.coatHex : 0x5d625c);
    if (outerStyle !== "shamma" && outerStyle !== "apron") coatCol.offsetHSL(0, -0.02, 0.18);
    const outerMat = new T.MeshStandardMaterial({
      color: coatCol,
      vertexColors: true,
      roughness: outerStyle === "shamma" ? 0.92 : 0.80,
      map: outerTex,
      bumpMap: outerTex,
      bumpScale: outerStyle === "shamma" ? 0.026 : 0.032
    });

    const hairMat = new T.MeshStandardMaterial({
      color: spec.hairHex !== undefined ? spec.hairHex : 0x171412,
      roughness: 0.88,
      bumpMap: assets.hairBump,
      bumpScale: 0.026
    });

    /* --- 1. Bind-Pose Skeleton (Meters, Unscaled Adult ~1.70 m) --- */
    const hipX = 0.094 * build;
    const shX = (0.184 - 0.016 * fem) * build;
    const L_THIGH = 0.40, L_SHIN = 0.39;     // hip at y = 0.875 -> ankle at y = 0.085, sole at y = 0.0
    const L_UARM  = 0.275, L_FARM = 0.255;   // shoulder at y = 1.385 -> wrist at y = 0.855

    const bind = [];
    bind[B_ROOT]   = [0, 0, 0, -1];
    bind[B_PELVIS] = [0, 0.885, 0, B_ROOT];
    bind[B_SPINE]  = [0, 1.075, -0.012, B_PELVIS];
    bind[B_CHEST]  = [0, 1.265, -0.016, B_SPINE];
    bind[B_NECK]   = [0, 1.445, -0.008, B_CHEST];
    bind[B_HEAD]   = [0, 1.525, 0.006, B_NECK];
    bind[B_JAW]    = [0, 1.535, 0.028, B_HEAD];

    bind[B_CLAV_L] = [ 0.065 * build, 1.405, -0.006, B_CHEST];
    bind[B_UARM_L] = [ shX,           1.385, -0.012, B_CLAV_L];
    bind[B_FARM_L] = [ shX,           1.385 - L_UARM, -0.012, B_UARM_L];
    bind[B_HAND_L] = [ shX,           1.385 - L_UARM - L_FARM, -0.012, B_FARM_L];

    bind[B_CLAV_R] = [-0.065 * build, 1.405, -0.006, B_CHEST];
    bind[B_UARM_R] = [-shX,           1.385, -0.012, B_CLAV_R];
    bind[B_FARM_R] = [-shX,           1.385 - L_UARM, -0.012, B_UARM_R];
    bind[B_HAND_R] = [-shX,           1.385 - L_UARM - L_FARM, -0.012, B_FARM_R];

    bind[B_ULEG_L] = [ hipX, 0.875, 0.000, B_PELVIS];
    bind[B_LLEG_L] = [ hipX, 0.875 - L_THIGH, 0.000, B_ULEG_L];
    bind[B_FOOT_L] = [ hipX, 0.875 - L_THIGH - L_SHIN, 0.000, B_LLEG_L];

    bind[B_ULEG_R] = [-hipX, 0.875, 0.000, B_PELVIS];
    bind[B_LLEG_R] = [-hipX, 0.875 - L_THIGH, 0.000, B_ULEG_R];
    bind[B_FOOT_R] = [-hipX, 0.875 - L_THIGH - L_SHIN, 0.000, B_LLEG_R];

    bind[B_COAT_B] = [0, 0.86, -0.11, B_PELVIS];
    bind[B_COAT_L] = [ 0.13 * build, 0.86, 0.02, B_PELVIS];
    bind[B_COAT_R] = [-0.13 * build, 0.86, 0.02, B_PELVIS];

    const bones = bind.map(([x, y, z, p], i) => {
      const b = new T.Bone();
      if (p < 0) b.position.set(x, y, z);
      else b.position.set(x - bind[p][0], y - bind[p][1], z - bind[p][2]);
      b.userData.rest = b.position.clone();
      b.userData.worldBind = new T.Vector3(x, y, z);
      return b;
    });
    bind.forEach((b, i) => { if (b[3] >= 0) bones[b[3]].add(bones[i]); });
    group.add(bones[B_ROOT]);
    bones[B_ROOT].updateMatrixWorld(true);
    const skeleton = new T.Skeleton(bones);

    const addSkinned = (geo, mat) => {
      const m = new T.SkinnedMesh(geo, mat);
      m.bind(skeleton);
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      return m;
    };

    /* --- 2. Sculpted Anatomical Head, Neck & Face (Skinned across Chest/Neck/Head/Jaw) --- */
    const noseLen = spec.noseLen || 1.0;
    const lipFull = spec.lipFull !== undefined ? spec.lipFull : 1.0;
    const headRings = refineRings([
      { p: [0, 1.410, -0.010], w: 0.064, f: 0.062, b: 0.066, e: 0.96 }, // base of neck
      { p: [0, 1.465, -0.006], w: 0.054, f: 0.055, b: 0.058, e: 0.96 }, // mid neck
      { p: [0, 1.505,  0.002], w: 0.056, f: 0.068, b: 0.064, e: 0.94 }, // sub-chin / throat
      { p: [0, 1.528,  0.012], w: 0.064, f: 0.094, b: 0.082, e: 0.90 }, // chin & jaw angle
      { p: [0, 1.556,  0.010], w: 0.072, f: 0.098, b: 0.094, e: 0.90 }, // mouth / lower cheek
      { p: [0, 1.586,  0.006], w: 0.078, f: 0.098, b: 0.102, e: 0.90 }, // nose tip / malar cheek
      { p: [0, 1.616,  0.002], w: 0.079, f: 0.094, b: 0.106, e: 0.92 }, // eye sockets / nasal bridge
      { p: [0, 1.644,  0.000], w: 0.077, f: 0.096, b: 0.105, e: 0.92 }, // supraorbital brow / forehead
      { p: [0, 1.678, -0.004], w: 0.072, f: 0.088, b: 0.098, e: 0.94 }, // upper forehead
      { p: [0, 1.706, -0.008], w: 0.054, f: 0.066, b: 0.074, e: 0.96 }, // crown dome
      { p: [0, 1.720, -0.010], w: 0.018, f: 0.022, b: 0.024, e: 1.00 }  // apex
    ], 3);

    const sculptFace = (r, lx, lz, sa, ca, v) => {
      const y = r.p[1], ax = Math.abs(lx), sx = Math.sign(lx) || 1;
      let dx = 0, dy = 0, dz = 0;
      if (ca > -0.25) {
        // recessed orbital eye sockets around (±0.031, 1.616)
        const eye = g2(ax, y, 0.031, 1.616, 0.020, 0.015) * smooth(0.2, 0.85, ca);
        dz -= 0.016 * eye;
        // supraorbital brow ridge
        const brow = g2(ax, y, 0.028, 1.634, 0.032, 0.010) * smooth(0.3, 0.9, ca);
        dz += 0.0085 * brow;
        // nasal bridge + dorsum + tip + flared alar nostrils
        const bridge = g1(ax, 0, 0.013) * g1(y, 1.606, 0.022) * smooth(0.55, 0.98, ca);
        const tip = g1(ax, 0, 0.015) * g1(y, 1.584, 0.012) * smooth(0.65, 1.0, ca);
        const alar = g2(ax, y, 0.016, 1.582, 0.010, 0.009) * smooth(0.45, 0.95, ca);
        dz += (0.014 * bridge + 0.022 * tip + 0.011 * alar) * noseLen;
        dx += sx * 0.0045 * alar;
        // malar cheekbones
        const cheek = g2(ax, y, 0.052, 1.592, 0.024, 0.019) * smooth(0.05, 0.75, ca);
        dx += sx * 0.007 * cheek;
        dz += 0.006 * cheek;
        // upper & lower lips + philtrum + mouth line
        const uLip = g1(ax, 0, 0.024) * g1(y, 1.563, 0.0065) * smooth(0.6, 1.0, ca);
        const lLip = g1(ax, 0, 0.022) * g1(y, 1.550, 0.0065) * smooth(0.6, 1.0, ca);
        const seam = g1(ax, 0, 0.026) * g1(y, 1.5565, 0.0028) * smooth(0.55, 1.0, ca);
        dz += (0.0105 * uLip + 0.0115 * lLip) * lipFull - 0.006 * seam;
        // chin boss & jawline definition
        const chin = g1(ax, 0, 0.022) * g1(y, 1.528, 0.011) * smooth(0.55, 1.0, ca);
        dz += 0.008 * chin;
        // sternocleidomastoid subtle neck cords
        const scm = g2(ax, y, 0.028, 1.46, 0.014, 0.036) * smooth(0.1, 0.8, ca);
        dz += 0.003 * scm;
      }
      return [dx, dy, dz];
    };

    const headGeo = loftY(T, headRings, {
      seg: 40,
      sculpt: sculptFace,
      color: (r, sa, ca, v, lx) => {
        const y = r.p[1], ax = Math.abs(lx);
        const socketShade = g2(ax, y, 0.031, 1.616, 0.021, 0.015) * Math.max(0, ca);
        const lipTint = g1(ax, 0, 0.024) * g1(y, 1.556, 0.010) * Math.max(0, ca);
        const underChin = (1 - smooth(1.49, 1.53, y)) * Math.max(0, ca) * 0.14;
        const warm = 0.90 + 0.10 * smooth(1.45, 1.66, y) - 0.18 * socketShade - underChin;
        return [warm + 0.05 * lipTint, warm - 0.02 * lipTint, warm - 0.04 * lipTint];
      },
      skin: (r, sa, ca) => {
        const y = r.p[1];
        if (y < 1.445) return [B_CHEST, B_NECK, 1 - smooth(1.41, 1.445, y)];
        if (y < 1.515) return [B_NECK, B_HEAD, 1 - smooth(1.445, 1.515, y)];
        const jawW = ca > 0.25 ? g1(y, 1.536, 0.020) * smooth(0.25, 0.75, ca) * 0.82 : 0;
        if (jawW > 0.02) return [B_JAW, B_HEAD, jawW];
        return [B_HEAD, B_NECK, 1];
      }
    });
    addSkinned(headGeo, skinMat);

    /* --- 3. Rigid Facial Attachments on B_HEAD: Eyeballs, Blinking Eyelids, Ears, Hair/Headwear --- */
    const headAnchor = new T.Group();
    headAnchor.position.set(-bind[B_HEAD][0], -bind[B_HEAD][1], -bind[B_HEAD][2]);
    bones[B_HEAD].add(headAnchor);

    const lids = [];
    for (const s of [1, -1]) {
      const ex = s * 0.031, ey = 1.616, ez = 0.079;
      const eye = new T.Mesh(new T.SphereGeometry(0.0118, 16, 12), assets.eyeMat);
      eye.position.set(ex, ey, ez);
      eye.rotation.y = -Math.PI * 0.5; // +Z faces iris center of CanvasTexture (u = 0.5)
      headAnchor.add(eye);

      const uLid = new T.Mesh(
        new T.SphereGeometry(0.0130, 14, 10, 0, TAU, 0, Math.PI * 0.52),
        skinMatPlain
      );
      uLid.position.set(ex, ey, ez);
      uLid.rotation.x = -0.32;
      headAnchor.add(uLid);

      const lLid = new T.Mesh(
        new T.SphereGeometry(0.0127, 14, 8, 0, TAU, Math.PI * 0.54, Math.PI * 0.42),
        skinMatPlain
      );
      lLid.position.set(ex, ey, ez);
      lLid.rotation.x = 0.14;
      headAnchor.add(lLid);
      lids.push({ eye, uLid, lLid, s });

      // Sculpted human ear (pinna helix)
      const earRings = refineRings([
        { p: [0, -0.022, 0], w: 0.006, f: 0.011, b: 0.010, e: 0.9 },
        { p: [0,  0.000, 0], w: 0.008, f: 0.015, b: 0.014, e: 0.85 },
        { p: [0,  0.022, 0], w: 0.007, f: 0.014, b: 0.012, e: 0.9 },
        { p: [0,  0.032, 0], w: 0.003, f: 0.006, b: 0.006, e: 1.0 }
      ], 2);
      const earM = new T.Mesh(loftY(T, earRings, { seg: 14 }), skinMatPlain);
      earM.position.set(s * 0.079, 1.602, -0.006);
      earM.rotation.set(-0.12, s * 0.28, -s * 0.08);
      headAnchor.add(earM);
    }

    // Hairstyles & Headwear (faithful to World Bible plates — zero neon tori & full crown coverage!)
    const hairStyle = spec.hair || "croppedCoily";
    if (hairStyle === "croppedCoily" || hairStyle === "glassesCrop") {
      // Natural close-cropped coily hair shell wrapping down nape & temples cleanly (Imani in saddle.jpg, convoy.jpg)
      const hRings = refineRings([
        { p: [0, 1.515, -0.046], w: 0.062, f: 0.012, b: 0.068, e: 0.92 },
        { p: [0, 1.568, -0.036], w: 0.076, f: 0.024, b: 0.084, e: 0.92 },
        { p: [0, 1.622, -0.024], w: 0.083, f: 0.044, b: 0.096, e: 0.92 },
        { p: [0, 1.668, -0.010], w: 0.084, f: 0.088, b: 0.108, e: 0.92 },
        { p: [0, 1.716, -0.008], w: 0.070, f: 0.086, b: 0.096, e: 0.94 },
        { p: [0, 1.744, -0.010], w: 0.003, f: 0.003, b: 0.003, e: 1.00 }
      ], 2);
      const hGeo = loftY(T, hRings, {
        seg: 30,
        disp: (r, sa, ca, v) => 1 + 0.042 * vnoise(sa * 9 + 3, v * 14)
      });
      headAnchor.add(new T.Mesh(hGeo, hairMat));
      if (hairStyle === "glassesCrop") {
        // Wire-rimmed operator spectacles (Hill Archive desk.jpg left operator!)
        for (const s of [-1, 1]) {
          const rim = new T.Mesh(new T.TorusGeometry(0.016, 0.0018, 6, 18), assets.ironDarkMat);
          rim.position.set(s * 0.031, 1.616, 0.094);
          headAnchor.add(rim);
          const arm = new T.Mesh(new T.BoxGeometry(0.002, 0.0025, 0.092), assets.ironDarkMat);
          arm.position.set(s * 0.048, 1.618, 0.046);
          headAnchor.add(arm);
        }
        const bridge = new T.Mesh(new T.BoxGeometry(0.018, 0.0025, 0.003), assets.ironDarkMat);
        bridge.position.set(0, 1.618, 0.095);
        headAnchor.add(bridge);
      }
    } else if (hairStyle === "shortLocs") {
      // June's short natural locs/twists (saddle.jpg!)
      const cap = new T.Mesh(new T.SphereGeometry(0.086, 18, 14, 0, TAU, 0, Math.PI * 0.66), hairMat);
      cap.position.set(0, 1.648, -0.010);
      cap.scale.set(0.99, 1.12, 1.18);
      headAnchor.add(cap);
      for (let i = 0; i < 28; i++) {
        const u = i / 28, ang = lerp(0.58, TAU - 0.58, u) + (hash(i * 3) - 0.5) * 0.14;
        const row = i % 3;
        const rad = 0.072 - row * 0.010;
        const x0 = Math.sin(ang) * rad, z0 = Math.cos(ang) * rad * 1.12 - 0.012;
        const y0 = 1.682 + row * 0.018;
        const len = 0.078 + hash(i * 7) * 0.045;
        const pts = [
          new T.Vector3(x0 * 0.7, y0 + 0.01, z0 * 0.75),
          new T.Vector3(x0 * 1.08, y0 - len * 0.45, z0 * 1.06),
          new T.Vector3(x0 * 1.16 + Math.sin(i) * 0.008, y0 - len, z0 * 1.08 - 0.008)
        ];
        const loc = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 7, 0.0088, 6, false), hairMat);
        headAnchor.add(loc);
      }
    } else if (hairStyle === "cornrowBraids") {
      // Makeda / Rahel front-to-back cornrow braids gathered at nape (grove.jpg!)
      const baseCap = new T.Mesh(new T.SphereGeometry(0.081, 16, 12, 0, TAU, 0, Math.PI * 0.62), hairMat);
      baseCap.position.set(0, 1.646, -0.010);
      baseCap.scale.set(0.98, 1.10, 1.14);
      headAnchor.add(baseCap);
      for (let b = -4; b <= 4; b++) {
        const bx = b * 0.0165;
        const pts = [];
        for (let k = 0; k <= 8; k++) {
          const t = k / 8;
          const ang = lerp(0.52, 2.55, t);
          const xr = bx * (1 - 0.35 * smooth(0.65, 1.0, t));
          const y = 1.628 + Math.sin(ang) * 0.102 * (1 - 0.14 * Math.abs(b) / 4);
          const z = Math.cos(ang) * 0.103 - 0.006;
          pts.push(new T.Vector3(xr, y, z));
        }
        const br = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 12, 0.0088, 6, false), hairMat);
        headAnchor.add(br);
      }
      // Tied braid bundle at nape
      const bun = new T.Mesh(new T.CapsuleGeometry(0.026, 0.055, 5, 10), hairMat);
      bun.position.set(0, 1.565, -0.105);
      bun.rotation.x = 0.55;
      headAnchor.add(bun);
    } else if (hairStyle === "silverSwept" || hairStyle === "ponytail") {
      // Etta's swept silver hair (grove.jpg) or Hill Archive / Registry female ponytail (desk.jpg & window.jpg)
      const hRings = refineRings([
        { p: [0, 1.512, -0.048], w: 0.066, f: 0.014, b: 0.074, e: 0.90 },
        { p: [0, 1.565, -0.038], w: 0.081, f: 0.026, b: 0.090, e: 0.90 },
        { p: [0, 1.624, -0.020], w: 0.086, f: 0.056, b: 0.102, e: 0.90 },
        { p: [0, 1.672, -0.006], w: 0.084, f: 0.092, b: 0.110, e: 0.92 },
        { p: [0, 1.722, -0.010], w: 0.060, f: 0.074, b: 0.086, e: 0.96 },
        { p: [0, 1.746, -0.012], w: 0.003, f: 0.003, b: 0.003, e: 1.00 }
      ], 2);
      headAnchor.add(new T.Mesh(loftY(T, hRings, {
        seg: 28,
        disp: (r, sa, ca, v) => 1 + 0.035 * Math.sin(sa * 14 + v * 6)
      }), hairMat));
      if (hairStyle === "ponytail") {
        const tailPts = [
          new T.Vector3(0, 1.625, -0.102),
          new T.Vector3(0.008, 1.575, -0.138),
          new T.Vector3(0.004, 1.495, -0.132),
          new T.Vector3(0, 1.435, -0.115)
        ];
        headAnchor.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(tailPts), 10, 0.022, 8, false), hairMat));
      }
    } else if (hairStyle === "shashWrap") {
      // Highland cloth headwrap (shash) with pleated folds
      const wrapMat = new T.MeshStandardMaterial({
        color: spec.wrapHex !== undefined ? spec.wrapHex : 0xc8c0b0,
        roughness: 0.92,
        map: assets.shammaTex,
        bumpMap: assets.shammaTex,
        bumpScale: 0.024
      });
      const wRings = refineRings([
        { p: [0, 1.608, -0.018], w: 0.084, f: 0.072, b: 0.108, e: 0.90 },
        { p: [0, 1.654, -0.014], w: 0.089, f: 0.092, b: 0.118, e: 0.90 },
        { p: [0, 1.706, -0.024], w: 0.082, f: 0.082, b: 0.116, e: 0.92 },
        { p: [0, 1.744, -0.036], w: 0.046, f: 0.048, b: 0.074, e: 0.96 }
      ], 2);
      headAnchor.add(new T.Mesh(loftY(T, wRings, {
        seg: 28,
        disp: (r, sa, ca, v) => 1 + 0.038 * Math.sin(v * 22 + sa * 3)
      }), wrapMat));
    } else if (hairStyle === "feltHat" || hairStyle === "hood") {
      if (hairStyle === "feltHat") {
        const hatMat = new T.MeshStandardMaterial({ color: spec.hatHex || 0x2f2923, roughness: 0.88, bumpMap: assets.oilskinTex, bumpScale: 0.02 });
        const brim = new T.Mesh(new T.CylinderGeometry(0.165, 0.172, 0.010, 26), hatMat);
        brim.position.set(0, 1.662, 0.002);
        brim.rotation.x = -0.06;
        headAnchor.add(brim);
        const crown = new T.Mesh(loftY(T, refineRings([
          { p: [0, 1.662, -0.004], w: 0.086, f: 0.098, b: 0.102, e: 0.92 },
          { p: [0, 1.725, -0.008], w: 0.076, f: 0.088, b: 0.092, e: 0.90 },
          { p: [0, 1.748, -0.010], w: 0.058, f: 0.068, b: 0.072, e: 0.94 }
        ], 2), { seg: 24 }), hatMat);
        headAnchor.add(crown);
      } else {
        // Hooded forest screening audience with round spectacles/goggles (grove.jpg right!)
        const hoodRings = refineRings([
          { p: [0, 1.515, -0.020], w: 0.105, f: 0.065, b: 0.118, e: 0.88 },
          { p: [0, 1.610, -0.012], w: 0.104, f: 0.082, b: 0.124, e: 0.88 },
          { p: [0, 1.695, -0.004], w: 0.096, f: 0.096, b: 0.118, e: 0.90 },
          { p: [0, 1.748, -0.018], w: 0.044, f: 0.048, b: 0.062, e: 0.96 }
        ], 2);
        headAnchor.add(new T.Mesh(loftOpenGarment(T, hoodRings, {
          seg: 24, a0: 0.56, a1: TAU - 0.56, thick: 0.012,
          fold: (r, u, v) => 0.008 * Math.sin(v * 14 + u * 9)
        }), outerMat));
        for (const s of [-1, 1]) {
          const gog = new T.Mesh(new T.TorusGeometry(0.017, 0.0032, 6, 16), assets.leatherDark);
          gog.position.set(s * 0.031, 1.616, 0.093);
          headAnchor.add(gog);
        }
      }
    }

    /* --- 4. Skinned Shirt / Tunic Torso + Sleeves --- */
    const rolledSleeves = Boolean(spec.rolledSleeves);
    const torsoRings = refineRings([
      { p: [0, 0.835,  0.000], w: 0.156 * build, f: 0.112, b: 0.118, e: 0.86 }, // shirt hem over hips
      { p: [0, 0.945, -0.004], w: 0.144 * build, f: 0.104, b: 0.108, e: 0.88 }, // waist
      { p: [0, 1.095, -0.008], w: 0.154 * build, f: 0.114, b: 0.116, e: 0.88 }, // lower ribcage
      { p: [0, 1.255, -0.006], w: (0.168 - 0.010 * fem) * build, f: 0.124 + 0.014 * fem, b: 0.122, e: 0.86 }, // chest
      { p: [0, 1.385, -0.008], w: (0.192 - 0.014 * fem) * build, f: 0.106, b: 0.112, e: 0.84 }, // shoulders
      { p: [0, 1.438, -0.008], w: 0.076, f: 0.074, b: 0.078, e: 0.94 }  // crew collar
    ], 3);

    const torsoGeo = loftY(T, torsoRings, {
      seg: 32,
      disp: (r, sa, ca, v) => 1 + 0.025 * Math.sin(sa * 7 + v * 13) * (1 - smooth(0.82, 1.0, v)),
      color: (r, sa, ca, v) => {
        const fold = 0.88 + 0.12 * Math.sin(sa * 6 + v * 11);
        return fold * lerp(0.84, 1.02, v);
      },
      skin: (r, sa) => {
        const y = r.p[1];
        if (y < 0.96) return [B_PELVIS, B_SPINE, 1 - smooth(0.84, 0.96, y)];
        if (y < 1.18) return [B_SPINE, B_CHEST, 1 - smooth(0.96, 1.18, y)];
        if (y > 1.34 && Math.abs(sa) > 0.65) {
          const cl = sa > 0 ? B_CLAV_L : B_CLAV_R;
          return [cl, B_CHEST, smooth(0.65, 0.98, Math.abs(sa)) * 0.55];
        }
        return [B_CHEST, B_SPINE, 1];
      }
    });
    addSkinned(torsoGeo, shirtMat);

    // Arms & Sleeves (left & right skinned along B_CLAV -> B_UARM -> B_FARM)
    const armClothGeos = [], armSkinGeos = [];
    for (const s of [1, -1]) {
      const bClav = s > 0 ? B_CLAV_L : B_CLAV_R;
      const bUA   = s > 0 ? B_UARM_L : B_UARM_R;
      const bFA   = s > 0 ? B_FARM_L : B_FARM_R;
      const ax = s * shX, az = -0.012;
      const yTop = 1.410, yElb = 1.385 - L_UARM, yWri = 1.385 - L_UARM - L_FARM;

      if (rolledSleeves) {
        // Rolled shirt sleeve above elbow + sculpted bare forearm down to wrist (Tess in window.jpg & desk.jpg!)
        const slvRings = refineRings([
          { p: [ax, yElb + 0.025, az], w: 0.056, f: 0.056, b: 0.058, e: 0.92 }, // rolled cuff bulge
          { p: [ax, yElb + 0.055, az], w: 0.052, f: 0.052, b: 0.054, e: 0.92 },
          { p: [ax, 1.275, az],        w: 0.056, f: 0.056, b: 0.058, e: 0.90 },
          { p: [ax * 0.92, yTop, az],  w: 0.064, f: 0.064, b: 0.066, e: 0.88 }
        ], 2);
        armClothGeos.push(loftY(T, slvRings, {
          seg: 20,
          disp: (r, sa, ca, v) => 1 + 0.03 * Math.sin(v * 18 + sa * 4),
          color: (r, sa, ca, v) => 0.88 + 0.12 * v,
          skin: r => r.p[1] > 1.355 ? [bClav, bUA, smooth(1.355, yTop, r.p[1]) * 0.5] : [bUA, bFA, smooth(yElb, yElb + 0.07, r.p[1])]
        }));
        const bareRings = refineRings([
          { p: [ax, yWri, az],         w: 0.030, f: 0.026, b: 0.026, e: 0.90 },
          { p: [ax, yWri + 0.11, az],  w: 0.038, f: 0.037, b: 0.038, e: 0.92 },
          { p: [ax, yElb + 0.03, az],  w: 0.043, f: 0.042, b: 0.045, e: 0.92 }
        ], 2);
        armSkinGeos.push(loftY(T, bareRings, {
          seg: 18,
          color: () => 0.96,
          skin: r => [bFA, bUA, 1 - smooth(yElb - 0.03, yElb + 0.03, r.p[1]) * 0.45]
        }));
      } else {
        // Full rugged coat/jacket sleeve with elbow crease folds & cuff
        const fullSlvMat = (outerStyle === "duster" || outerStyle === "parka") ? outerMat : shirtMat;
        const slvRings = refineRings([
          { p: [ax, yWri + 0.008, az], w: 0.044, f: 0.043, b: 0.044, e: 0.90 },
          { p: [ax, yWri + 0.095, az], w: 0.050, f: 0.049, b: 0.051, e: 0.90 },
          { p: [ax, yElb, az],         w: 0.055, f: 0.054, b: 0.058, e: 0.90 },
          { p: [ax, 1.265, az],        w: 0.061, f: 0.060, b: 0.062, e: 0.88 },
          { p: [ax * 0.90, yTop, az],  w: 0.070, f: 0.068, b: 0.070, e: 0.86 }
        ], 3);
        const slvGeo = loftY(T, slvRings, {
          seg: 22,
          disp: (r, sa, ca, v) => {
            const elbFold = g1(r.p[1], yElb, 0.055) * Math.sin(v * 42 + sa * 3) * 0.048;
            return 1 + elbFold + 0.022 * Math.sin(sa * 5 + v * 15);
          },
          color: (r, sa, ca, v) => 0.84 + 0.16 * v + 0.06 * Math.sin(v * 24 + sa * 3),
          skin: r => {
            const y = r.p[1];
            if (y > 1.355) return [bClav, bUA, smooth(1.355, yTop, y) * 0.48];
            if (y > yElb - 0.045) return [bUA, bFA, smooth(yElb - 0.045, yElb + 0.045, y)];
            return [bFA, bUA, 1];
          }
        });
        addSkinned(slvGeo, fullSlvMat);
      }
    }
    if (armClothGeos.length) addSkinned(mergeSkinnedGeos(T, armClothGeos), shirtMat);
    if (armSkinGeos.length) addSkinned(mergeSkinnedGeos(T, armSkinGeos), skinMat);

    // Attach sculpted hands with articulated fingers to B_HAND_L / B_HAND_R (using non-vertexColor skinMatPlain!)
    const handL = buildSculptedHand(T, 1, skinMatPlain, rolledSleeves ? null : shirtMat);
    const handR = buildSculptedHand(T, -1, skinMatPlain, rolledSleeves ? null : shirtMat);
    bones[B_HAND_L].add(handL);
    bones[B_HAND_R].add(handR);

    /* --- 5. Skinned Creased Work Trousers + Laced Leather Boots --- */
    const legGeos = [];
    // Pelvis trouser yoke bridging left & right thighs seamlessly
    const pelvisTrouser = refineRings([
      { p: [0, 0.785, 0.002], w: 0.158 * build, f: 0.106, b: 0.118, e: 0.86 },
      { p: [0, 0.855, 0.000], w: 0.154 * build, f: 0.108, b: 0.120, e: 0.86 },
      { p: [0, 0.905, -0.002], w: 0.148 * build, f: 0.104, b: 0.112, e: 0.88 }
    ], 2);
    legGeos.push(loftY(T, pelvisTrouser, {
      seg: 28,
      color: (r, sa, ca, v) => 0.84 + 0.14 * v,
      skin: (r, sa) => {
        const legB = sa >= 0 ? B_ULEG_L : B_ULEG_R;
        const legW = (1 - smooth(0.785, 0.865, r.p[1])) * smooth(0.25, 0.85, Math.abs(sa)) * 0.55;
        return [legB, B_PELVIS, legW];
      }
    }));

    const yKnee = 0.875 - L_THIGH, yAnk = 0.875 - L_THIGH - L_SHIN;
    for (const s of [1, -1]) {
      const bUL = s > 0 ? B_ULEG_L : B_ULEG_R;
      const bLL = s > 0 ? B_LLEG_L : B_LLEG_R;
      const bFT = s > 0 ? B_FOOT_L : B_FOOT_R;
      const lx = s * hipX;
      const legRings = refineRings([
        { p: [lx, yAnk + 0.055, 0.002], w: 0.056, f: 0.056, b: 0.058, e: 0.90 }, // tucked/bunched trouser cuff
        { p: [lx, yAnk + 0.140, 0.000], w: 0.062, f: 0.060, b: 0.064, e: 0.90 }, // lower shin
        { p: [lx, yKnee - 0.06, -0.002], w: 0.068, f: 0.066, b: 0.074, e: 0.90 }, // calf gastrocnemius
        { p: [lx, yKnee,        0.004], w: 0.069, f: 0.072, b: 0.068, e: 0.88 }, // knee patella & crease
        { p: [lx, yKnee + 0.16, 0.002], w: 0.080 * build, f: 0.082, b: 0.084, e: 0.88 }, // mid thigh
        { p: [lx * 0.96, 0.845, 0.000], w: 0.088 * build, f: 0.092, b: 0.098, e: 0.86 }  // upper thigh into pelvis
      ], 3);
      legGeos.push(loftY(T, legRings, {
        seg: 24,
        disp: (r, sa, ca, v) => {
          const kneeCrease = g1(r.p[1], yKnee, 0.06) * Math.sin(v * 46 + sa * 3) * 0.045;
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
          if (y > yKnee - 0.05) return [bUL, bLL, smooth(yKnee - 0.05, yKnee + 0.05, y)];
          return [bLL, bUL, 1];
        }
      }));

      const boot = buildLacedWorkBoot(T, s, assets);
      bones[bFT].add(boot);
    }
    addSkinned(mergeSkinnedGeos(T, legGeos), trouserMat);

    /* --- 6. Signature Layered Outer Garments (Duster Coat / Oversized Parka / Ethiopian Shamma / Apron) --- */
    if (outerStyle === "duster" || outerStyle === "parka") {
      const isParka = outerStyle === "parka";
      const hemY = isParka ? 0.58 : 0.42; // knee-length duster (Imani) vs mid-thigh oversized parka (June)
      const flare = isParka ? 1.18 : 1.28;
      const coatRings = refineRings([
        { p: [0, hemY,  -0.012], w: 0.230 * build * flare, f: 0.165 * flare, b: 0.182 * flare, e: 0.84 },
        { p: [0, lerp(hemY, 0.88, 0.48), -0.010], w: 0.198 * build * lerp(flare, 1, 0.5), f: 0.146, b: 0.160, e: 0.86 },
        { p: [0, 0.895, -0.006], w: 0.166 * build, f: 0.128, b: 0.135, e: 0.86 }, // belt / waist
        { p: [0, 1.105, -0.008], w: 0.168 * build, f: 0.132, b: 0.136, e: 0.86 }, // lower chest
        { p: [0, 1.285, -0.008], w: 0.172 * build, f: 0.138, b: 0.138, e: 0.84 }, // upper chest (leaves armholes clear!)
        { p: [0, 1.402, -0.010], w: 0.186 * build, f: 0.122, b: 0.130, e: 0.84 }, // coat shoulders
        { p: [0, 1.472, -0.014], w: 0.104,         f: 0.088, b: 0.106, e: 0.90 }  // turned storm collar / hood roll
      ], 3);

      const coatGeo = loftOpenGarment(T, coatRings, {
        seg: 34,
        a0: isParka ? 0.28 : 0.38,
        a1: TAU - (isParka ? 0.28 : 0.38),
        thick: 0.013,
        fold: (r, u, v, sa, ca) => {
          const drape = (1 - smooth(0.0, 0.55, v)) * 0.018 * Math.sin(u * 26 + 1.2);
          const lapel = v > 0.72 && (u < 0.12 || u > 0.88) ? 0.022 * smooth(0.72, 0.96, v) : 0;
          return drape + lapel + 0.005 * Math.sin(v * 19 + u * 11);
        },
        color: (r, u, v, sa, ca, layer) => {
          // Mud & chalk weathering along lower duster hem (directly from saddle.jpg!)
          const splatter = (1 - smooth(0.0, 0.34, v)) * fbm(u * 14 + 2, v * 16, 3) * 0.32;
          const crease = 0.84 + 0.16 * Math.sin(u * 22 + v * 7);
          const shade = (layer ? 0.68 : 1.0) * crease * lerp(0.86, 1.04, v);
          return [shade + splatter * 0.45, shade + splatter * 0.42, shade + splatter * 0.35];
        },
        skin: (r, sa, ca, v) => {
          const y = r.p[1];
          if (y < 0.88) {
            const skirtW = 1 - smooth(hemY, 0.88, y);
            // Weight lower coat to coat-tail bones + subtle leg follow so thighs never clip!
            if (ca < -0.25) return [B_COAT_B, B_PELVIS, skirtW * 0.88];
            const bSide = sa >= 0 ? B_COAT_L : B_COAT_R;
            const bLeg  = sa >= 0 ? B_ULEG_L : B_ULEG_R;
            return [bSide, B_PELVIS, skirtW * 0.68, bLeg, skirtW * 0.26];
          }
          if (y < 1.06) return [B_PELVIS, B_SPINE, 1 - smooth(0.88, 1.06, y)];
          if (y < 1.24) return [B_SPINE, B_CHEST, 1 - smooth(1.06, 1.24, y)];
          return [B_CHEST, B_NECK, 1 - smooth(1.40, 1.48, y) * 0.35];
        }
      });
      addSkinned(coatGeo, outerMat);
    } else if (outerStyle === "shamma") {
      // Draped Ethiopian highland gabi / shamma shawl across shoulders & chest (convoy.jpg, village.jpg, grove.jpg!)
      const shammaRings = refineRings([
        { p: [0, 0.72, -0.008], w: 0.225 * build, f: 0.162, b: 0.172, e: 0.86 },
        { p: [0, 0.98, -0.006], w: 0.215 * build, f: 0.158, b: 0.165, e: 0.86 },
        { p: [0, 1.24, -0.006], w: 0.222 * build, f: 0.164, b: 0.162, e: 0.84 },
        { p: [0, 1.40, -0.008], w: 0.218 * build, f: 0.138, b: 0.145, e: 0.84 },
        { p: [0, 1.465, -0.010], w: 0.112,        f: 0.102, b: 0.114, e: 0.90 }
      ], 3);
      const shGeo = loftOpenGarment(T, shammaRings, {
        seg: 34,
        a0: 0.14,
        a1: TAU - 0.14,
        thick: 0.010,
        fold: (r, u, v) => 0.014 * Math.sin(u * 30 + v * 9) + 0.008 * Math.cos(v * 20 - u * 12),
        color: (r, u, v, sa, ca, layer) => {
          const tibeb = (v < 0.08 || u < 0.07 || u > 0.93) ? 0.76 : 1.0;
          const base = (0.88 + 0.12 * Math.sin(u * 26 + v * 8)) * (layer ? 0.75 : 1.0) * tibeb;
          return [base, base * 0.99, base * 0.96];
        },
        skin: (r, sa, ca) => {
          const y = r.p[1];
          if (y < 0.90) {
            const w = 1 - smooth(0.72, 0.90, y);
            return [ca < -0.2 ? B_COAT_B : (sa >= 0 ? B_COAT_L : B_COAT_R), B_PELVIS, w * 0.72];
          }
          if (y < 1.14) return [B_SPINE, B_CHEST, 1 - smooth(0.90, 1.14, y)];
          return [B_CHEST, B_SPINE, 1];
        }
      });
      addSkinned(shGeo, outerMat);
    } else if (outerStyle === "apron") {
      // Baker's / craftsperson canvas apron (Nell at Moraine Switchback)
      const apRings = refineRings([
        { p: [0, 0.48, 0.02], w: 0.185 * build, f: 0.136, b: 0.04, e: 0.88 },
        { p: [0, 0.88, 0.01], w: 0.168 * build, f: 0.128, b: 0.04, e: 0.88 },
        { p: [0, 1.26, 0.01], w: 0.125 * build, f: 0.140, b: 0.03, e: 0.90 }
      ], 2);
      const apGeo = loftOpenGarment(T, apRings, {
        seg: 20, a0: -1.15, a1: 1.15, thick: 0.006,
        fold: (r, u, v) => 0.008 * Math.sin(u * 16 + v * 6),
        color: (r, u, v) => 0.88 + 0.12 * fbm(u * 10, v * 12, 2),
        skin: r => r.p[1] < 0.88 ? [B_COAT_L, B_PELVIS, (1 - smooth(0.48, 0.88, r.p[1])) * 0.55] : [B_CHEST, B_SPINE, smooth(0.92, 1.22, r.p[1])]
      });
      addSkinned(apGeo, outerMat);
    }

    /* --- 7. Character-Specific Belt, Mechanic's Wrenches/Satchel & Handheld Props --- */
    if (spec.toolBelt) {
      // Imani's heavy leather mechanic's belt + hip holster with sculpted steel wrenches & pliers (saddle.jpg!)
      const beltGrp = new T.Group();
      bones[B_PELVIS].add(beltGrp);
      const beltRing = new T.Mesh(
        loftY(T, [
          { p: [0, 0.015, -0.006], w: 0.180 * build, f: 0.138, b: 0.144, e: 0.86 },
          { p: [0, 0.062, -0.006], w: 0.180 * build, f: 0.138, b: 0.144, e: 0.86 }
        ], { seg: 28 }),
        assets.leatherDark
      );
      beltGrp.add(beltRing);
      const buckle = new T.Mesh(roundedBox(T, 0.052, 0.056, 0.018, 0.005, 1), assets.steelToolMat);
      buckle.position.set(0, 0.038, 0.142);
      beltGrp.add(buckle);

      // Left hip leather tool pouch + 3 sculpted open-end steel wrenches (exact saddle.jpg detail!)
      const pouch = new T.Mesh(roundedBox(T, 0.055, 0.19, 0.155, 0.014, 2), assets.leatherDark);
      pouch.position.set(0.182 * build, -0.045, 0.015);
      pouch.rotation.z = -0.14;
      pouch.rotation.y = 0.18;
      beltGrp.add(pouch);
      for (let w = 0; w < 3; w++) {
        const wr = new T.Group();
        wr.position.set(0.022, 0.065 - w * 0.008, -0.042 + w * 0.042);
        wr.rotation.x = (w - 1) * 0.08;
        const shank = new T.Mesh(roundedBox(T, 0.007, 0.115, 0.018, 0.002, 1), assets.steelToolMat);
        wr.add(shank);
        const jawL = new T.Mesh(roundedBox(T, 0.008, 0.026, 0.010, 0.002, 1), assets.steelToolMat);
        jawL.position.set(0, 0.062, -0.010); jawL.rotation.x = 0.22; wr.add(jawL);
        const jawR = new T.Mesh(roundedBox(T, 0.008, 0.026, 0.010, 0.002, 1), assets.steelToolMat);
        jawR.position.set(0, 0.062,  0.010); jawR.rotation.x = -0.22; wr.add(jawR);
        pouch.add(wr);
      }
    }

    if (spec.satchel) {
      // Cross-body canvas courier satchel (Makeda kneeling in grove.jpg & Etta!)
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
      // Diagonal shoulder strap on chest
      const strapPts = [
        new T.Vector3(-0.12 * build, 0.155, 0.06),
        new T.Vector3(0.02, 0.01, 0.136),
        new T.Vector3(0.175 * build, -0.18, 0.06),
        new T.Vector3(0.175 * build, -0.18, -0.11),
        new T.Vector3(0.01, 0.01, -0.132),
        new T.Vector3(-0.12 * build, 0.155, -0.06)
      ];
      const strap = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(strapPts, true), 22, 0.013, 6, true), assets.leatherDark);
      bones[B_CHEST].add(strap);
    }

    /* --- Handheld Props (Dynamically Toggled by Pose) --- */
    // 1. Matte ceramic/enamel cup (June in saddle.jpg, Tess, villagers)
    const cupProp = new T.Group();
    cupProp.visible = false;
    {
      const cBody = new T.Mesh(new T.CylinderGeometry(0.044, 0.035, 0.096, 18), assets.enamelCupMat);
      cupProp.add(cBody);
      const cRim = new T.Mesh(new T.TorusGeometry(0.044, 0.0035, 6, 18), assets.enamelRimMat);
      cRim.rotation.x = Math.PI * 0.5; cRim.position.y = 0.048;
      cupProp.add(cRim);
      const cLiq = new T.Mesh(new T.CircleGeometry(0.039, 16), assets.cyanWaterMat);
      cLiq.rotation.x = -Math.PI * 0.5; cLiq.position.y = 0.034;
      cupProp.add(cLiq);
    }
    group.add(cupProp);

    // 2. Pouring tin dipper + glowing cyan stream (Makeda kneeling at Cottonwood root-bowl in grove.jpg!)
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
    dipperProp.position.set(0, -0.055, 0.035);

    // 3. Smartphone with REAL upward cyan-blue face illumination (Ahiya Night Convoy in convoy.jpg!)
    const phoneProp = new T.Group();
    phoneProp.visible = false;
    let phoneLight = null;
    {
      const pCase = new T.Mesh(roundedBox(T, 0.076, 0.010, 0.145, 0.004, 1), assets.phoneBodyMat);
      phoneProp.add(pCase);
      const pScr = new T.Mesh(new T.PlaneGeometry(0.066, 0.128), assets.phoneScreenMat);
      pScr.rotation.x = -Math.PI * 0.5;
      pScr.position.y = 0.0056;
      phoneProp.add(pScr);
      if (spec.enablePhoneLight) {
        phoneLight = new T.PointLight(0x52c8ff, 1.55, 1.55, 1.8);
        phoneLight.position.set(0, 0.085, -0.02);
        phoneProp.add(phoneLight);
      }
    }
    group.add(phoneProp);

    // 4. Translucent cyan 20 L jerrycan / village kettle carried in right hand
    const carryCanProp = new T.Group();
    carryCanProp.visible = false;
    {
      const canMat = new T.MeshPhysicalMaterial({
        color: 0x2fc8e6, emissive: 0x0d6f96, emissiveIntensity: 0.45,
        roughness: 0.24, transparent: true, opacity: 0.88
      });
      const body = new T.Mesh(roundedBox(T, 0.16, 0.34, 0.25, 0.028, 2), canMat);
      body.position.set(0, -0.22, 0);
      carryCanProp.add(body);
      const hdl = new T.Mesh(roundedBox(T, 0.032, 0.042, 0.15, 0.01, 1), assets.enamelCupMat);
      hdl.position.set(0, -0.03, 0);
      carryCanProp.add(hdl);
      const cap = new T.Mesh(new T.CylinderGeometry(0.024, 0.024, 0.028, 10), assets.enamelCupMat);
      cap.position.set(0, -0.035, 0.085);
      carryCanProp.add(cap);
    }
    bones[B_HAND_R].add(carryCanProp);
    carryCanProp.position.set(0, -0.055, 0.01);

    // 5. Pen / Ration Card for Hill Archive Desk & Registry Clerk (desk.jpg & window.jpg)
    const penProp = new T.Mesh(new T.CylinderGeometry(0.0045, 0.0035, 0.135, 8), assets.penBlueMat);
    penProp.visible = false;
    penProp.position.set(0, -0.055, 0.035);
    penProp.rotation.set(0.95, 0, 0.25);
    bones[B_HAND_R].add(penProp);

    const cardProp = new T.Mesh(roundedBox(T, 0.095, 0.003, 0.135, 0.001, 1), assets.paperMat);
    cardProp.visible = false;
    cardProp.position.set(0, -0.055, 0.045);
    cardProp.rotation.set(0.35, 0.2, 0);
    bones[B_HAND_L].add(cardProp);

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

    // Subtle close-range label (hidden by default, NEVER shown in Machinima!)
    const label = makeSubtleTag(T, spec.name || "Villager", spec.role || "");
    label.sprite.position.set(0, 1.92, 0);
    group.add(label.sprite);

    /* --- 8. State & Biomechanical Update + 2-Bone IK --- */
    const state = {
      id: spec.id || "npc",
      name: spec.name || "Villager",
      role: spec.role || "",
      circuit: spec.circuit || "west",
      homeX: spec.x || 0,
      homeZ: spec.z || 0,
      x: spec.x || 0,
      y: 0,
      z: spec.z || 0,
      heading: spec.heading || 0,
      pose: spec.pose || "idle",
      speech: spec.speech || "",
      phase: (spec.phase || 0) + hash((spec.x || 1) * 3.7 + (spec.z || 2) * 1.9) * TAU,
      blink: 0,
      nextBlink: 1.5 + hash((spec.x || 3) * 7.1) * 4.0,
      lookYaw: 0,
      lookPitch: 0
    };

    const ik = makeIKScratch(T);
    const footTargetL = new T.Vector3();
    const footTargetR = new T.Vector3();
    const handTargetL = new T.Vector3();
    const handTargetR = new T.Vector3();
    const localTargetL = new T.Vector3();
    const localTargetR = new T.Vector3();
    const poleLeg = new T.Vector3(0, 0.15, 1.0);
    const poleArmL = new T.Vector3( 0.42, -0.15, -1.0);
    const poleArmR = new T.Vector3(-0.42, -0.15, -1.0);
    const tmpV = new T.Vector3();

    let lastSurfaceAt = null;
    function place(x, z, heading, surfaceAt) {
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

    // Convert character-local point (unscaled meters) to world space
    function charToWorld(lx, ly, lz, out) {
      return out.set(lx, ly, lz).applyMatrix4(group.matrixWorld);
    }

    function update(dt, nowSec, opts = {}) {
      const pose = opts.pose || state.pose || "idle";
      const beat = opts.beatPulse || 0;
      const surfaceAt = opts.surfaceAt || lastSurfaceAt;
      const t = nowSec + state.phase;

      // Natural blinking
      if (nowSec > state.nextBlink) {
        state.blink = 1.0;
        state.nextBlink = nowSec + 2.2 + hash(nowSec * 1.7 + state.phase) * 4.6;
      }
      state.blink = Math.max(0, state.blink - dt * 7.2);
      const shut = Math.sin(state.blink * Math.PI);
      for (const L of lids) {
        L.uLid.rotation.x = -0.32 + shut * 0.85;
        L.lLid.rotation.x = 0.14 - shut * 0.26;
      }

      // Smooth head look tracking
      let wantYaw = Math.sin(t * 0.55) * 0.14;
      let wantPitch = Math.sin(t * 0.42 + 1.1) * 0.04;
      if (opts.lookAt) {
        const dx = opts.lookAt.x - state.x, dz = opts.lookAt.z - state.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.35 && dist < 26) {
          const brg = Math.atan2(dx, dz);
          let diff = Math.atan2(Math.sin(brg - state.heading), Math.cos(brg - state.heading));
          wantYaw = clamp(diff, -0.78, 0.78);
          const dy = (opts.lookAt.y !== undefined ? opts.lookAt.y : state.y + 1.45) - (state.y + 1.56 * scale);
          wantPitch = clamp(-Math.atan2(dy, dist), -0.42, 0.45);
        }
      }
      const lk = 1 - Math.exp(-dt * 5.5);
      state.lookYaw = lerp(state.lookYaw, wantYaw, lk);
      state.lookPitch = lerp(state.lookPitch, wantPitch, lk);

      // Reset bone transforms before layering pose + IK
      for (const b of bones) {
        b.position.copy(b.userData.rest);
        b.rotation.set(0, 0, 0);
      }
      const breath = Math.sin(t * 2.1);

      // Default foot targets (standing hip-width on terrain) & arm targets
      let pelDrop = 0, pelSwayX = 0, pelFwdZ = 0;
      let spinePitch = 0.02 + 0.012 * breath, spineYaw = 0, spineRoll = 0;
      let chestPitch = 0.015 * breath, chestYaw = 0, chestRoll = 0;
      let clavLiftL = 0, clavLiftR = 0, clavFwdL = 0, clavFwdR = 0;
      let jawOpen = 0, curlL = 0.25, curlR = 0.25;
      let footPitchL = 0, footPitchR = 0;

      // Local ankle targets in unscaled character space (y = 0.085 is standing sole on y = 0)
      let fLx =  hipX + 0.012, fLy = 0.085, fLz = 0.01;
      let fRx = -hipX - 0.012, fRy = 0.085, fRz = -0.01;

      // Default relaxed hands at sides
      localTargetL.set( shX + 0.032, 0.855, 0.035 + 0.015 * Math.sin(t * 1.1));
      localTargetR.set(-shX - 0.032, 0.855, 0.035 - 0.015 * Math.sin(t * 1.1));
      let useWorldHandL = false, useWorldHandR = false;

      // Toggle handheld props off before enabling pose-specific props
      cupProp.visible = false;
      dipperProp.visible = false;
      phoneProp.visible = false;
      carryCanProp.visible = Boolean(opts.carryCan);
      penProp.visible = false;
      cardProp.visible = false;

      if (pose === "walk" || pose === "convoyPhoneWalk") {
        const wPh = nowSec * 4.8 + state.phase;
        const sL = Math.sin(wPh), cL = Math.cos(wPh);
        const sR = Math.sin(wPh + Math.PI), cR = Math.cos(wPh + Math.PI);
        const stepLen = 0.26, liftH = 0.095;
        fLz = sL * stepLen;
        fLy = 0.085 + Math.max(0, cL) * liftH;
        footPitchL = -sL * 0.28 + Math.max(0, cL) * 0.16;

        fRz = sR * stepLen;
        fRy = 0.085 + Math.max(0, cR) * liftH;
        footPitchR = -sR * 0.28 + Math.max(0, cR) * 0.16;

        pelDrop = -0.022 + 0.018 * Math.abs(sL);
        pelSwayX = 0.018 * cL;
        spineYaw = -sL * 0.08;
        chestYaw = -sL * 0.11;
        spinePitch = 0.06;

        if (pose === "convoyPhoneWalk") {
          // Walking beside glowing pack at night holding smartphone in both hands (convoy.jpg!)
          localTargetL.set( 0.052, 1.135 + 0.012 * Math.abs(sL), 0.255);
          localTargetR.set(-0.048, 1.130 + 0.012 * Math.abs(sL), 0.260);
          curlL = 0.65; curlR = 0.65;
          state.lookPitch = lerp(state.lookPitch, 0.36, 0.75);
          phoneProp.visible = true;
        } else {
          localTargetL.set( shX + 0.03, 0.87 + Math.max(0, -sL) * 0.06, -sL * 0.18 + 0.04);
          localTargetR.set(-shX - 0.03, 0.87 + Math.max(0, -sR) * 0.06, -sR * 0.18 + 0.04);
          if (opts.carryCan) {
            localTargetR.set(-shX - 0.055, 0.86, 0.04 - sR * 0.05);
            curlR = 0.88;
            spineRoll = 0.045;
          }
        }
      } else if (pose === "touchPack") {
        // World Bible Page 1 (saddle.jpg!): Imani walking/leaning right beside Mistletoe's flank, right hand on wet pannier, left hand poised by hip wrenches!
        pelDrop = -0.030;
        spinePitch = 0.12;
        chestPitch = 0.06;
        chestYaw = 0.16;
        fLz = 0.12; fRz = -0.10;
        curlL = 0.45; curlR = 0.26;
        localTargetL.set(shX + 0.065, 0.89 + 0.008 * breath, 0.08);
        if (opts.packTarget) {
          useWorldHandR = true;
          handTargetR.copy(opts.packTarget);
        } else {
          localTargetR.set(-0.28, 1.04 + 0.01 * breath, 0.22);
        }
      } else if (pose === "holdCup" || pose === "listen") {
        // World Bible Page 1 (saddle.jpg!): June holding matte enamel cup in BOTH hands at chest height!
        pelSwayX = 0.012 * Math.sin(t * 0.9);
        spinePitch = 0.03;
        localTargetL.set( 0.046, 1.045 + 0.008 * breath, 0.235);
        localTargetR.set(-0.046, 1.045 + 0.008 * breath, 0.235);
        curlL = 0.72; curlR = 0.72;
        cupProp.visible = true;
        if (pose === "listen") {
          // Listening on one earphone while holding cup in right hand
          localTargetL.set(0.088, 1.585, 0.025);
          curlL = 0.55;
        }
      } else if (pose === "phoneGlow") {
        // Standing / night trail pause with phone illuminating face from below (convoy.jpg!)
        pelSwayX = 0.014 * Math.sin(t * 0.8);
        spinePitch = 0.08;
        localTargetL.set( 0.050, 1.145 + 0.008 * breath, 0.255);
        localTargetR.set(-0.046, 1.140 + 0.008 * breath, 0.262);
        curlL = 0.68; curlR = 0.68;
        state.lookPitch = 0.38;
        state.lookYaw = Math.sin(t * 0.7) * 0.08;
        phoneProp.visible = true;
      } else if (pose === "pump") {
        // Operating cast-iron wellhead handle with full body knee/back leverage!
        const pPh = opts.pumpPhase !== undefined ? opts.pumpPhase : nowSec * 4.4;
        const stroke = Math.sin(pPh); // +1 up, -1 down-stroke
        pelDrop = -0.06 - Math.max(0, -stroke) * 0.085;
        spinePitch = 0.20 + Math.max(0, -stroke) * 0.18;
        chestPitch = 0.08 + Math.max(0, -stroke) * 0.08;
        fLz = 0.12; fRz = -0.11;
        const hY = 1.06 + stroke * 0.20;
        const hZ = 0.38 + (1 - Math.abs(stroke)) * 0.04;
        localTargetL.set( 0.055, hY, hZ);
        localTargetR.set(-0.055, hY, hZ + 0.03);
        curlL = 0.92; curlR = 0.92;
        state.lookPitch = 0.22 - stroke * 0.08;
      } else if (pose === "kneelPour") {
        // World Bible Page 15 (grove.jpg!): Makeda crouching/kneeling at Cottonwood root-bowl pouring cyan water!
        pelDrop = -0.44;
        pelFwdZ = -0.04;
        spinePitch = 0.34;
        chestPitch = 0.12;
        fLx =  hipX + 0.03; fLy = 0.085; fLz = 0.24;     // left boot planted forward
        fRx = -hipX - 0.02; fRy = 0.115; fRz = -0.22;    // right knee crouched low behind
        footPitchR = 0.55;
        localTargetL.set( 0.11, 0.62, 0.26);             // left hand resting over forward knee
        localTargetR.set(-0.04, 0.72 + 0.015 * Math.sin(t * 1.6), 0.44); // right hand tipping tin dipper!
        curlL = 0.45; curlR = 0.88;
        dipperProp.visible = true;
        if (dipperStream) {
          const pulseS = 0.92 + 0.10 * Math.sin(nowSec * 7.5);
          dipperStream.scale.set(pulseS, 1, pulseS);
        }
        state.lookPitch = 0.42;
        state.lookYaw = -0.08;
      } else if (pose === "shadeScreen") {
        // World Bible Page 15 (grove.jpg!): Etta standing by hanging forest sheet raising hand to shade/touch projected face!
        spinePitch = 0.04;
        chestYaw = -0.14;
        localTargetR.set(-0.10, 1.38 + 0.02 * Math.sin(t * 1.1), 0.36); // raised open hand in beam!
        localTargetL.set( 0.12, 0.96, 0.14);
        curlR = 0.08; // spread fingers!
        curlL = 0.35;
        state.lookPitch = -0.06;
        state.lookYaw = -0.16;
      } else if (pose === "clerkWindow") {
        // World Bible Page 18 (window.jpg!): Tess behind wire-glass counter stamping ledger & holding ration card!
        spinePitch = 0.16;
        chestPitch = 0.06;
        const stamp = Math.sin(t * 1.7);
        localTargetL.set( 0.12, 0.99, 0.28);
        localTargetR.set(-0.08 + 0.04 * stamp, 1.01 + Math.max(0, stamp) * 0.05, 0.30);
        curlL = 0.55; curlR = 0.75;
        cardProp.visible = true;
        penProp.visible = true;
        state.lookPitch = 0.30;
      } else if (pose === "deskWrite" || pose === "deskNotes") {
        // World Bible Page 4 (desk.jpg!): Seated operators at Hill Archive REC PPC desk!
        pelDrop = -0.36;
        pelFwdZ = -0.06;
        fLx =  hipX + 0.03; fLy = 0.085; fLz = 0.28;
        fRx = -hipX - 0.03; fRy = 0.085; fRz = 0.26;
        spinePitch = 0.22;
        chestPitch = 0.08;
        if (pose === "deskWrite") {
          localTargetL.set( 0.14, 0.80, 0.32);
          localTargetR.set(-0.06 + 0.025 * Math.sin(t * 5.2), 0.81, 0.34 + 0.015 * Math.cos(t * 5.2));
          curlL = 0.40; curlR = 0.82;
          penProp.visible = true;
          state.lookPitch = 0.36;
        } else {
          // Looking up at REC PPC monitor while holding dispatch notes & pen (desk.jpg right!)
          localTargetL.set( 0.12, 0.86, 0.30);
          localTargetR.set(-0.10, 0.82, 0.32);
          curlL = 0.60; curlR = 0.78;
          cardProp.visible = true;
          penProp.visible = true;
          state.lookPitch = -0.08 + 0.06 * Math.sin(t * 0.8);
        }
      } else if (pose === "seatedWatch") {
        // Seated old bride / witness in wooden yard chair watching cinema cloth (Page 2 & 20!)
        pelDrop = -0.38;
        pelFwdZ = -0.05;
        fLx =  hipX + 0.02; fLy = 0.085; fLz = 0.28;
        fRx = -hipX - 0.02; fRy = 0.085; fRz = 0.28;
        spinePitch = 0.12 + 0.02 * Math.sin(t * 0.9);
        localTargetL.set( hipX + 0.02, 0.62, 0.18);
        localTargetR.set(-hipX - 0.02, 0.62, 0.18);
        curlL = 0.35; curlR = 0.35;
        state.lookPitch = -0.10;
      } else if (pose === "pointPost") {
        // Silver Ford Ferryman pointing toward the wet flood post / alignment stone (Page 9 & 16!)
        pelSwayX = 0.015;
        chestYaw = -0.18;
        localTargetR.set(-0.18, 1.32 + 0.02 * Math.sin(t * 1.4), 0.42);
        localTargetL.set( shX + 0.03, 0.88, 0.06);
        curlR = 0.20; curlL = 0.45;
      } else if (pose === "queueWait") {
        // Highland Pueblo queue villagers wrapped in shawls / coats (village.jpg!)
        const shift = Math.sin(t * 0.65);
        pelSwayX = 0.024 * shift;
        pelDrop = -0.012 * Math.abs(shift);
        spineRoll = -0.03 * shift;
        // Folded/wrapped arms across shawl or holding cup/kettle
        if (spec.queueHasCup) {
          localTargetL.set( 0.048, 1.02, 0.22);
          localTargetR.set(-0.048, 1.02, 0.22);
          curlL = 0.72; curlR = 0.72;
          cupProp.visible = true;
        } else if (opts.carryCan || spec.queueHasCan) {
          carryCanProp.visible = true;
          localTargetR.set(-shX - 0.05, 0.85, 0.04);
          localTargetL.set( 0.06, 1.05, 0.18);
          curlR = 0.88; curlL = 0.55;
        } else {
          // Crossed / tucked warm hands inside shamma wrap (village.jpg!)
          localTargetL.set(-0.06, 1.06 + 0.008 * breath, 0.19);
          localTargetR.set( 0.06, 1.04 + 0.008 * breath, 0.20);
          curlL = 0.55; curlR = 0.55;
        }
      } else if (pose === "eskista" || pose === "dance") {
        // Authentic 6/8 Cosmic Addis Eskista — sharp clavicle/scapula forward-back isolations & thoracic groove!
        const ph = nowSec * (9.4 + beat * 1.2) + state.phase;
        const pop = Math.sin(ph * 2.0);
        const snap = Math.sign(pop) * Math.pow(Math.abs(pop), 0.55);
        pelDrop = -0.035 - 0.028 * Math.abs(Math.sin(ph));
        pelSwayX = 0.025 * Math.sin(ph * 0.5);
        spinePitch = 0.08 + 0.045 * Math.sin(ph);
        chestPitch = -0.055 * snap;
        chestYaw = 0.09 * Math.sin(ph);
        clavLiftL = 0.16 * Math.max(0, snap);
        clavLiftR = 0.16 * Math.max(0, -snap);
        clavFwdL  =  0.22 * snap;
        clavFwdR  = -0.22 * snap;
        fLz = 0.06 * Math.sin(ph * 0.5);
        fRz = -0.06 * Math.sin(ph * 0.5);
        localTargetL.set( shX + 0.07, 1.08 + 0.04 * snap, 0.22 - 0.05 * snap);
        localTargetR.set(-shX - 0.07, 1.08 - 0.04 * snap, 0.22 + 0.05 * snap);
        curlL = 0.18; curlR = 0.18;
        jawOpen = 0.10 + 0.08 * Math.max(0, Math.sin(ph));
      } else if (pose === "sing" || pose === "wave") {
        const sPh = nowSec * 3.4 + state.phase;
        spinePitch = -0.02 + 0.02 * Math.sin(sPh);
        jawOpen = pose === "sing" ? (0.18 + 0.16 * Math.max(0, Math.sin(sPh * 1.7))) : 0.05;
        if (pose === "wave") {
          localTargetR.set(-shX - 0.08 + 0.06 * Math.sin(nowSec * 5.2), 1.54, 0.18);
          curlR = 0.08;
        } else {
          localTargetL.set( 0.11, 1.14 + 0.03 * Math.sin(sPh), 0.24);
          localTargetR.set(-0.11, 1.14 + 0.03 * Math.cos(sPh), 0.24);
          curlL = 0.22; curlR = 0.22;
        }
      } else if (pose === "camera" || pose === "pour") {
        // Operating 8x10 mahogany field camera or tending cistern pour
        pelDrop = -0.04;
        spinePitch = 0.16;
        chestPitch = 0.06;
        fLz = 0.08; fRz = -0.08;
        localTargetL.set( 0.12, 1.18 + 0.02 * Math.sin(t * 1.6), 0.34);
        localTargetR.set(-0.11, 1.22 + 0.03 * Math.cos(t * 1.6), 0.36);
        curlL = 0.55; curlR = 0.65;
        state.lookPitch = 0.08;
      } else if (pose === "drive") {
        // Seated behind Woody wagon steering wheel!
        pelDrop = -0.34;
        pelFwdZ = -0.04;
        fLx =  hipX + 0.02; fLy = 0.12; fLz = 0.34;
        fRx = -hipX - 0.02; fRy = 0.12; fRz = 0.36;
        spinePitch = 0.10;
        const steer = opts.steerAngle || 0;
        localTargetL.set( 0.14, 1.02 + steer * 0.06, 0.34);
        localTargetR.set(-0.14, 1.02 - steer * 0.06, 0.34);
        curlL = 0.85; curlR = 0.85;
      } else {
        // Natural living idle: subtle hip weight shift, ribcage breath, occasional hand adjustment
        const wShift = Math.sin(t * 0.58);
        pelSwayX = 0.016 * wShift;
        pelDrop = -0.008 * Math.abs(wShift);
        spineRoll = -0.022 * wShift;
        if (opts.carryCan) {
          localTargetR.set(-shX - 0.055, 0.855, 0.045);
          curlR = 0.88;
          spineRoll += 0.04;
        }
      }

      // Apply pelvis, spine, chest, clavicles, neck, head, jaw & coat-tail bones
      bones[B_PELVIS].position.set(
        bind[B_PELVIS][0] + pelSwayX,
        bind[B_PELVIS][1] + pelDrop,
        bind[B_PELVIS][2] + pelFwdZ
      );
      bones[B_PELVIS].rotation.set(spinePitch * 0.25, spineYaw * 0.5, -spineRoll * 0.5);
      bones[B_SPINE].rotation.set(spinePitch * 0.55, spineYaw * 0.6, spineRoll);
      bones[B_CHEST].rotation.set(chestPitch + spinePitch * 0.35, chestYaw, spineRoll * 0.4);

      bones[B_CLAV_L].rotation.set(0, -clavFwdL,  clavLiftL);
      bones[B_CLAV_R].rotation.set(0,  clavFwdR, -clavLiftR);

      bones[B_NECK].rotation.set(state.lookPitch * 0.42 - spinePitch * 0.35, state.lookYaw * 0.42, 0);
      bones[B_HEAD].rotation.set(state.lookPitch * 0.58 - spinePitch * 0.25, state.lookYaw * 0.58, Math.sin(t * 0.5) * 0.03);
      bones[B_JAW].rotation.set(jawOpen * 0.38, 0, 0);

      // Coat-tail / shawl breeze & stride follow
      const breeze = 0.05 + 0.04 * Math.sin(nowSec * 1.9 + state.phase);
      bones[B_COAT_B].rotation.x = -breeze - Math.max(0, -pelDrop) * 0.45;
      bones[B_COAT_L].rotation.z =  breeze * 0.7;
      bones[B_COAT_R].rotation.z = -breeze * 0.7;

      // Update world matrices up to hip & shoulder parents before solving 2-bone IK!
      if (surfaceAt && group.parent && pose !== "drive") {
        state.y = surfaceAt(state.x, state.z);
        group.position.set(state.x, state.y + (spec.yOffset || 0), state.z);
        group.rotation.set(0, state.heading, 0, "YXZ");
      }
      group.updateMatrixWorld(true);

      // Solve Left & Right Leg 2-Bone IK (planting boots on sloped terrain!)
      charToWorld(fLx, fLy, fLz, footTargetL);
      charToWorld(fRx, fRy, fRz, footTargetR);
      if (surfaceAt && pose !== "drive") {
        const gL = surfaceAt(footTargetL.x, footTargetL.z);
        const gR = surfaceAt(footTargetR.x, footTargetR.z);
        const liftL = (fLy - 0.085) * scale;
        const liftR = (fRy - 0.085) * scale;
        footTargetL.y = clamp(gL + 0.085 * scale + liftL, state.y - 0.26 * scale, state.y + 0.42 * scale);
        footTargetR.y = clamp(gR + 0.085 * scale + liftR, state.y - 0.26 * scale, state.y + 0.42 * scale);
      }
      solveLimbIK(ik, bones[B_PELVIS], bones[B_ULEG_L], bones[B_LLEG_L], footTargetL, poleLeg, L_THIGH, L_SHIN, +1);
      solveLimbIK(ik, bones[B_PELVIS], bones[B_ULEG_R], bones[B_LLEG_R], footTargetR, poleLeg, L_THIGH, L_SHIN, +1);

      // Keep boot soles level with ground + gait pitch
      bones[B_PELVIS].updateWorldMatrix(false, true);
      for (const [bLL, bFT, fPitch] of [[B_LLEG_L, B_FOOT_L, footPitchL], [B_LLEG_R, B_FOOT_R, footPitchR]]) {
        bones[bLL].getWorldQuaternion(ik.qUpper);
        ik.qUpperInv.copy(ik.qUpper).invert();
        group.getWorldQuaternion(ik.qLowerWorld);
        bones[bFT].quaternion.copy(ik.qUpperInv).multiply(ik.qLowerWorld);
        bones[bFT].rotateX(fPitch);
      }

      // Solve Left & Right Arm 2-Bone IK
      if (!useWorldHandL) charToWorld(localTargetL.x, localTargetL.y, localTargetL.z, handTargetL);
      if (!useWorldHandR) charToWorld(localTargetR.x, localTargetR.y, localTargetR.z, handTargetR);
      solveLimbIK(ik, bones[B_CLAV_L], bones[B_UARM_L], bones[B_FARM_L], handTargetL, poleArmL, L_UARM, L_FARM, -1);
      solveLimbIK(ik, bones[B_CLAV_R], bones[B_UARM_R], bones[B_FARM_R], handTargetR, poleArmR, L_UARM, L_FARM, -1);

      handL.userData.setCurl(curlL);
      handR.userData.setCurl(curlR);

      // Position two-handed props cleanly between hands in character space
      if (cupProp.visible) {
        cupProp.position.set(
          (localTargetL.x + localTargetR.x) * 0.5,
          localTargetR.y - 0.015,
          (localTargetL.z + localTargetR.z) * 0.5 + 0.018
        );
      }
      if (phoneProp.visible) {
        phoneProp.position.set(
          (localTargetL.x + localTargetR.x) * 0.5,
          (localTargetL.y + localTargetR.y) * 0.5 + 0.012,
          (localTargetL.z + localTargetR.z) * 0.5 + 0.018
        );
        phoneProp.rotation.set(-0.62, 0, 0);
      }

      group.updateMatrixWorld(true);
    }

    place(state.x, state.z, state.heading, null);
    return { group, bones, skeleton, state, label, place, setSpeech, update };
  }

  /* ---------- Full Canonical 22-Character Cast Across West Expedition & Ahiya Highlands ---------- */
  const BASE_CAST = [
    // 1. SNAKE RIVER OVERLOOK WELLHEAD (World Bible Page 1 `saddle.jpg`!)
    {
      id: "imani", name: "Imani", role: "Carrier · Mistletoe's Handler",
      x: -24.8, z: -2.0, heading: 1.52, scale: 1.00, build: 1.02, fem: 0.68,
      skinHex: 0x3b261b, hair: "croppedCoily", hairHex: 0x151210,
      outer: "duster", coatHex: 0x2c312e, shirtHex: 0x3f433e, trouserHex: 0x222526,
      toolBelt: true, patchedKnees: true, pose: "touchPack"
    },
    {
      id: "june", name: "June", role: "Young Listener · Chipped Cup",
      x: -23.4, z: -3.2, heading: 1.65, scale: 0.76, build: 0.96, fem: 0.55,
      skinHex: 0x3f291e, hair: "shortLocs", hairHex: 0x161311,
      outer: "parka", coatHex: 0x3d413b, shirtHex: 0x52554e, trouserHex: 0x2b2e2d,
      patchedKnees: true, pose: "holdCup"
    },
    {
      id: "witness_tomas", name: "Tomas", role: "Dawn Pump Witness · 4 L Chalk",
      x: -20.2, z: -7.8, heading: -0.95, scale: 1.01, build: 1.04, fem: 0.15,
      skinHex: 0x4b3325, hair: "feltHat", hatHex: 0x2a2520,
      outer: "duster", coatHex: 0x36332e, shirtHex: 0x4a463f, trouserHex: 0x252728,
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

    // 3. SILVER FORD RELAY & FERRY LANDING (World Bible Pages 9 & 16!)
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
      skinHex: 0x422c20, hair: "feltHat", hatHex: 0x252320,
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

    // 4. COTTONWOOD OXBOW LIVING FILM GROVE (World Bible Page 15 `grove.jpg`!)
    {
      id: "makeda", name: "Makeda", role: "Grove Carrier · Root-Bowl Pour",
      x: -511.6, z: 98.0, heading: 1.92, scale: 0.98, build: 0.99, fem: 0.76,
      skinHex: 0x3c271c, hair: "cornrowBraids", hairHex: 0x141210,
      outer: "parka", coatHex: 0x3a3e38, shirtHex: 0x484b44, trouserHex: 0x272928,
      satchel: true, patchedKnees: true, pose: "kneelPour"
    },
    {
      id: "old_bride", name: "Woyzero Almaz", role: "Front-Row Witness · WF–08",
      x: -509.8, z: 98.8, heading: -2.68, scale: 0.94, build: 0.98, fem: 0.85,
      skinHex: 0x4a3326, hair: "shashWrap", wrapHex: 0xd8d2c4,
      outer: "shamma", coatHex: 0xbcb5a6, shirtHex: 0x423b35, trouserHex: 0x2a2725,
      pose: "seatedWatch"
    },
    {
      id: "hood_watcher_1", name: "Grove Projectionist", role: "Oxbow Lantern & Sheet Rig",
      x: -506.6, z: 96.4, heading: -2.45, scale: 1.01, build: 1.02, fem: 0.25,
      skinHex: 0x3a261b, hair: "hood",
      outer: "parka", coatHex: 0x1f2324, shirtHex: 0x292d2e, trouserHex: 0x1c1f20,
      pose: "idle"
    },
    {
      id: "hood_watcher_2", name: "Oxbow Listener", role: "Eight-Second Tail Witness",
      x: -505.8, z: 97.6, heading: -2.55, scale: 0.97, build: 0.98, fem: 0.65,
      skinHex: 0x442e21, hair: "hood",
      outer: "parka", coatHex: 0x25292a, shirtHex: 0x313536, trouserHex: 0x1e2122,
      pose: "queueWait"
    },

    // 5. HIGHLAND PUEBLO COOLING YARD, WIRE-GLASS REGISTRY & VILLAGE QUEUE (`village.jpg` & `window.jpg`!)
    {
      id: "tess", name: "Tess", role: "Registry Clerk & Cooling Operator",
      x: -773.3, z: -31.8, yOffset: 0.34, heading: 0.30, scale: 0.99, build: 1.00, fem: 0.72,
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
      pose: "queueWait"
    },
    {
      id: "queue_3", name: "Zewditu", role: "Highland Queue · Lower Yard",
      x: -775.4, z: -26.5, heading: -2.68, scale: 0.95, build: 1.00, fem: 0.82,
      skinHex: 0x493224, hair: "shashWrap", wrapHex: 0xb2aba0,
      outer: "shamma", coatHex: 0x68635a, shirtHex: 0x3a3632, trouserHex: 0x252423,
      queueHasCan: true, pose: "queueWait"
    },
    {
      id: "queue_4", name: "Berhanu", role: "Highland Drover · Lower Yard",
      x: -776.3, z: -25.2, heading: -2.62, scale: 1.02, build: 1.05, fem: 0.12,
      skinHex: 0x3f291d, hair: "feltHat", hatHex: 0x2b2621,
      outer: "duster", coatHex: 0x323634, shirtHex: 0x454844, trouserHex: 0x232627,
      pose: "queueWait"
    },

    // 6. ABYSSAL WHALE FLUKE & HALF DOME EAST APRON
    {
      id: "dawit", name: "Dawit", role: "Whale Fluke Keeper · Two Chairs",
      x: -1066.8, z: -24.2, heading: -2.55, scale: 1.02, build: 1.04, fem: 0.12,
      skinHex: 0x402a1e, hair: "feltHat", hatHex: 0x282623,
      outer: "duster", coatHex: 0x2a3136, shirtHex: 0x3d464c, trouserHex: 0x202528,
      pose: "idle"
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
    // 7. AHIYA HIGHLANDS NIGHT ROUTE (`convoy.jpg` & `desk.jpg`!)
    {
      id: "saba", name: "Saba", role: "Basalt Pump Keeper · Gauge Thread",
      circuit: "ahiya", x: -1458.4, z: 761.8, heading: -0.95, scale: 0.98, build: 1.01, fem: 0.78,
      skinHex: 0x3e281c, hair: "shashWrap", wrapHex: 0xcac2b2,
      outer: "shamma", coatHex: 0x868074, shirtHex: 0x383a3c, trouserHex: 0x232527,
      pose: "idle"
    },
    {
      id: "rahel", name: "Rahel", role: "Night-Trail Escort · Glowing Phone",
      circuit: "ahiya", x: -1461.8, z: 762.4, heading: 0.65, scale: 0.92, build: 0.96, fem: 0.72,
      skinHex: 0x3b261b, hair: "croppedCoily", hairHex: 0x141210,
      outer: "shamma", coatHex: 0xbab4a6, shirtHex: 0x2c3440, trouserHex: 0x1e2228,
      enablePhoneLight: true, pose: "phoneGlow"
    },
    {
      id: "escort_yared", name: "Yared", role: "Ahiya Youth · Blue Phone Lantern",
      circuit: "ahiya", x: -1462.9, z: 761.9, heading: 0.72, scale: 0.84, build: 0.94, fem: 0.20,
      skinHex: 0x392419, hair: "croppedCoily", hairHex: 0x141210,
      outer: "shamma", coatHex: 0xaeb0a8, shirtHex: 0x262e3a, trouserHex: 0x1c2026,
      enablePhoneLight: true, pose: "phoneGlow"
    },
    {
      id: "aunt_lemlem", name: "Aunt Lemlem", role: "Singer · AR–03 Rehearsal",
      circuit: "ahiya", x: -1612.2, z: 592.2, heading: 0.45, scale: 0.96, build: 1.02, fem: 0.84,
      skinHex: 0x452f22, hair: "shashWrap", wrapHex: 0xdad3c4,
      outer: "shamma", coatHex: 0xc6bfb0, shirtHex: 0x443a34, trouserHex: 0x282523,
      pose: "sing"
    },
    {
      id: "ppc_op_male", name: "bekele_ppc", displayName: "Daniel (REC PPC Log)", role: "Hill Archive Logbook Operator",
      circuit: "ahiya", x: -1765.85, z: 541.55, heading: Math.PI * 0.82, scale: 1.01, build: 1.05, fem: 0.08,
      skinHex: 0x9b7862, hair: "glassesCrop", hairHex: 0x221b16,
      outer: "none", shirtHex: 0x1d2836, trouserHex: 0x22262b,
      rolledSleeves: true, pose: "deskWrite"
    },
    {
      id: "ppc_op_female", name: "hanna_ppc", displayName: "Hanna (REC PPC Dispatch)", role: "Hill Archive Monitor Operator",
      circuit: "ahiya", x: -1764.15, z: 541.55, heading: -Math.PI * 0.82, scale: 0.97, build: 0.97, fem: 0.80,
      skinHex: 0xa27e68, hair: "ponytail", hairHex: 0x3b2a1e,
      outer: "none", shirtHex: 0x1b2634, trouserHex: 0x202429,
      rolledSleeves: true, pose: "deskNotes"
    }
  ];

  function makeExpeditionCast(T, opts = {}) {
    const group = new T.Group();
    if (opts.parent) opts.parent.add(group);
    const surfaceAt = opts.surfaceAt || (() => 0);

    // Always include Ahiya cast if requested (and in Zones we also include them so Machinima can stage them if needed)
    const specs = opts.hasAhiya ? BASE_CAST.concat(AHIYA_CAST) : BASE_CAST;
    const list = [];
    const byId = {};

    for (const raw of specs) {
      const sp = Object.assign({}, raw, { name: raw.displayName || raw.name });
      const ch = makeExpeditionCharacter(T, sp);
      ch.place(sp.x, sp.z, sp.heading, surfaceAt);
      group.add(ch.group);
      list.push(ch);
      byId[sp.id] = ch;
    }

    const packTarget = new T.Vector3();
    const camFwd = new T.Vector3();
    const toChar = new T.Vector3();

    function update(dt, nowSec, worldCtx = {}) {
      const { state: ws, donkey, wagon, camera, machinimaActive, hideLabels } = worldCtx;
      if (machinimaActive) {
        // Never show floating nameplates during Machinima!
        for (const ch of list) ch.label.sprite.visible = false;
        return;
      }

      const dancing = ws && ws.danceTimer > 0;
      const beatPulse = ws ? (ws.beatPulse || 0) : 0;
      if (camera) camera.getWorldDirection(camFwd);

      // Interactive Imani & June behavior in free gameplay
      const imani = byId.imani;
      const june = byId.june;
      if (imani && ws && donkey && wagon) {
        if (ws.drivingCart) {
          if (imani.group.parent !== wagon.chassis) {
            wagon.chassis.add(imani.group);
          }
          imani.group.visible = true;
          imani.group.position.set(0.38, 0.42, 0.28);
          imani.group.rotation.set(0, 0, 0, "YXZ");
          imani.update(dt, nowSec, { pose: "drive", steerAngle: wagon.steerAngle || 0, beatPulse });
        } else {
          if (imani.group.parent !== group) {
            group.add(imani.group);
          }
          if (ws.riding || ws.gliding) {
            imani.group.visible = false;
          } else {
            imani.group.visible = true;
            const dx = donkey.state.x, dz = donkey.state.z;
            const dNearOverlook = Math.hypot(dx - (-24), dz - (-3)) < 26;
            if (dancing) {
              imani.update(dt, nowSec, { pose: "eskista", surfaceAt, beatPulse, lookAt: camera?.position });
            } else if (ws.pumpFlow > 0.38 && Math.hypot(imani.state.x - (-22.2), imani.state.z - (-6.2)) < 8) {
              imani.place(-22.95, -6.15, 1.48, surfaceAt);
              imani.update(dt, nowSec, { pose: "pump", pumpPhase: ws.pumpLeverPhase, surfaceAt, beatPulse });
            } else if (dNearOverlook && Math.abs(donkey.state.speed) < 0.25) {
              // Exact World Bible Page 1 cover staging: Imani standing right at Mistletoe's flank touching the cyan-window pannier!
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
              imani.update(dt, nowSec, { pose: "touchPack", packTarget, surfaceAt, beatPulse, lookAt: donkey.group.position });
              if (june) {
                const jx = dx + sideX * 1.62 - fwdX * 0.35;
                const jz = dz + sideZ * 1.62 - fwdZ * 0.35;
                june.place(jx, jz, faceDonkey - 0.25, surfaceAt);
              }
            } else {
              imani.update(dt, nowSec, { pose: "idle", carryCan: true, surfaceAt, beatPulse, lookAt: donkey.group.position });
            }
          }
        }
      }

      for (const ch of list) {
        if (!ch.group.visible) continue;
        // Distance cull animation updates beyond 180 m for crisp 60 fps performance
        const distCam = camera ? Math.hypot(camera.position.x - ch.state.x, camera.position.z - ch.state.z) : 20;
        if (ch !== imani && distCam < 185) {
          const actPose = dancing && distCam < 38 ? "eskista" : ch.state.pose;
          ch.update(dt, nowSec, {
            pose: actPose,
            surfaceAt,
            beatPulse,
            lookAt: distCam < 14 ? camera?.position : donkey?.group.position
          });
        }

        // Subtle close-up inspector tag ONLY when player walks right up (< 5.2 m) & looks toward character
        if (hideLabels || !camera || distCam > 5.2 || (ws && (ws.drivingCart || ws.gliding))) {
          ch.label.sprite.visible = false;
        } else {
          toChar.set(ch.state.x - camera.position.x, (ch.state.y + 1.5) - camera.position.y, ch.state.z - camera.position.z).normalize();
          const aim = camFwd.dot(toChar);
          const show = aim > 0.86;
          ch.label.sprite.visible = show;
          if (show) ch.label.mat.opacity = smooth(5.2, 3.4, distCam) * smooth(0.86, 0.94, aim) * 0.88;
        }
      }
    }

    function resetHomes() {
      for (const ch of list) {
        if (ch.group.parent !== group) group.add(ch.group);
        ch.group.visible = true;
        ch.label.sprite.visible = false;
        ch.place(ch.state.homeX, ch.state.homeZ, ch.state.heading, surfaceAt);
      }
    }

    return { group, list, byId, update, resetHomes };
  }

  if (typeof window !== "undefined") {
    window.makeExpeditionCharacter = makeExpeditionCharacter;
    window.makeExpeditionCast = makeExpeditionCast;
  }
})();
